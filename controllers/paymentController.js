const { Booking, User } = require('../models');
const { sendBookingConfirmationEmail } = require('../utils/emailService');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

/**
 * Mock Payment Controller
 * Simulates Razorpay-style payment without real transactions.
 * Flow: create booking (pending) → createOrder → confirmMockPayment
 */

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

  // Generate a mock order ID
  const mockOrderId = `mock_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Update booking payment status to processing
  booking.payment = {
    status: 'processing',
    orderId: mockOrderId,
    method: 'upi',
  };
  await booking.save({ validateBeforeSave: false });

  logger.info(`Mock payment order created: ${mockOrderId} for booking: ${booking.bookingReference}`);

  res.status(200).json({
    success: true,
    data: {
      orderId: mockOrderId,
      amount: booking.pricing.totalAmount,
      currency: 'INR',
      bookingRef: booking.bookingReference,
      // Mock key — frontend uses this to show payment UI
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

  // Generate mock transaction ID
  const transactionId = mockPaymentId || `mock_pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Update booking to confirmed + payment completed
  booking.status = 'confirmed';
  booking.confirmedAt = new Date();
  booking.payment = {
    status: 'completed',
    method: paymentMethod,
    transactionId: transactionId,
    orderId: booking.payment?.orderId || `mock_order_${Date.now()}`,
    paidAt: new Date(),
    paidAmount: booking.pricing.totalAmount,
  };
  await booking.save({ validateBeforeSave: false });

  logger.info(`Mock payment confirmed: ${transactionId} for booking: ${booking.bookingReference}`);

  // Send booking confirmation email (fire-and-forget — don't block response)
  try {
    const user = await User.findById(booking.user).select('email fullName');
    if (user) {
      sendBookingConfirmationEmail(user.email, user.fullName, booking)
        .catch(err => logger.error(`Confirmation email failed: ${err.message}`));
    }
  } catch (err) {
    logger.error(`Could not fetch user for confirmation email: ${err.message}`);
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
      // ✅ Extra fields so frontend can immediately display booking details
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

  booking.payment = {
    ...booking.payment,
    status: 'failed',
    failureReason: reason,
  };
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
  const { bookingId } = req.params;
  const userId = req.user._id;

  const booking = await Booking.findOne({ _id: bookingId, user: userId })
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
