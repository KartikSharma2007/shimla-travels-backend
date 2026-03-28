const { Booking, User } = require('../models');
const { sendBookingConfirmationEmail } = require('../utils/emailService');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// @desc    Create mock payment order for a booking
// @route   POST /api/payments/create-order
// @access  Private
const createOrder = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;
  const userId = req.user._id;

  const booking = await Booking.findOne({ _id: bookingId, user: userId });
  if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

  if (booking.payment?.status === 'completed') {
    throw new AppError('Payment already completed for this booking', 400, 'ALREADY_PAID');
  }

  const mockOrderId = `mock_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  booking.payment = { status: 'processing', orderId: mockOrderId, method: 'upi' };
  await booking.save({ validateBeforeSave: false });

  logger.info(`Mock payment order created: ${mockOrderId} for booking: ${booking.bookingReference}`);

  res.status(200).json({
    success: true,
    data: {
      orderId: mockOrderId,
      amount: booking.pricing.totalAmount,
      currency: 'INR',
      bookingRef: booking.bookingReference,
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
    },
  });
});

// @desc    Confirm mock payment success
// @route   POST /api/payments/confirm
// @access  Private
const confirmPayment = asyncHandler(async (req, res) => {
  const { bookingId, paymentMethod = 'upi', mockPaymentId } = req.body;
  const userId = req.user._id;

  const booking = await Booking.findOne({ _id: bookingId, user: userId });
  if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

  const transactionId = mockPaymentId || `mock_pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  booking.status = 'confirmed';
  booking.confirmedAt = new Date();
  booking.payment = {
    status: 'completed',
    method: paymentMethod,
    transactionId,
    orderId: booking.payment?.orderId || `mock_order_${Date.now()}`,
    paidAt: new Date(),
    paidAmount: booking.pricing.totalAmount,
  };
  await booking.save({ validateBeforeSave: false });

  logger.info(`Payment confirmed: ${transactionId} for booking: ${booking.bookingReference}`);

  // ── Send booking confirmation email ──────────────────────────────────────────
  // AWAITED — we wait for the email to send before responding
  // This guarantees the terminal shows success/failure BEFORE the response goes out
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  BOOKING CONFIRMED — attempting confirmation email...    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Booking  : ${booking.bookingReference}`);
  console.log(`  Type     : ${booking.bookingType}`);
  console.log(`  Amount   : ₹${booking.pricing?.totalAmount}`);
  console.log(`  User ID  : ${booking.user}`);

  try {
    // Step 1: Find the user in the database
    const userForEmail = await User.findById(booking.user).select('email fullName');

    if (!userForEmail) {
      console.error('  ❌ PROBLEM: User not found in database for ID:', booking.user);
      console.error('  ❌ No email will be sent because we cannot find the user\'s email address.');
    } else {
      console.log(`  User     : ${userForEmail.fullName} <${userForEmail.email}>`);
      console.log(`  Sending confirmation email TO: ${userForEmail.email} ...`);

      // Step 2: Send the email — AWAITED so we see result before response
      await sendBookingConfirmationEmail(userForEmail.email, userForEmail.fullName, booking);

      console.log(`  ✅ Confirmation email sent successfully to: ${userForEmail.email}`);
      console.log(`  ✅ Check inbox (and SPAM folder) of: ${userForEmail.email}`);
    }
  } catch (err) {
    console.error(`  ❌ EMAIL FAILED: ${err.message}`);
    console.error(`  ❌ Code: ${err.code || 'none'}`);
    console.error(`  ❌ Response: ${err.response || 'none'}`);
    logger.error(`Confirmation email failed for booking ${booking.bookingReference}: ${err.message}`);
    // Don't throw — booking is already saved, email failure is non-critical
  }

  res.status(200).json({
    success: true,
    message: 'Payment confirmed successfully',
    data: {
      bookingId: booking._id,
      bookingReference: booking.bookingReference,
      transactionId,
      amount: booking.pricing.totalAmount,
      status: booking.status,
      paymentStatus: booking.payment.status,
      bookingType: booking.bookingType,
      hotelName: booking.hotelName,
      packageTitle: booking.packageTitle,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      travelDate: booking.travelDate,
    },
  });
});

// @desc    Handle mock payment failure
// @route   POST /api/payments/failed
// @access  Private
const paymentFailed = asyncHandler(async (req, res) => {
  const { bookingId, reason = 'Payment cancelled by user' } = req.body;
  const userId = req.user._id;

  const booking = await Booking.findOne({ _id: bookingId, user: userId });
  if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

  booking.payment = { ...booking.payment, status: 'failed', failureReason: reason };
  booking.status = 'cancelled';
  booking.cancellationReason = reason;
  booking.cancelledAt = new Date();
  await booking.save({ validateBeforeSave: false });

  logger.info(`Payment failed for booking: ${booking.bookingReference}, reason: ${reason}`);

  res.status(200).json({
    success: true,
    message: 'Payment failure recorded',
    data: { bookingReference: booking.bookingReference, status: 'failed' },
  });
});

// @desc    Get payment status for a booking
// @route   GET /api/payments/status/:bookingId
// @access  Private
const getPaymentStatus = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.bookingId, user: req.user._id })
    .select('bookingReference status payment pricing');

  if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

  res.status(200).json({
    success: true,
    data: {
      bookingReference: booking.bookingReference,
      bookingStatus: booking.status,
      paymentStatus: booking.payment?.status || 'pending',
      amount: booking.pricing.totalAmount,
      transactionId: booking.payment?.transactionId,
      paidAt: booking.payment?.paidAt,
    },
  });
});

module.exports = { createOrder, confirmPayment, paymentFailed, getPaymentStatus };