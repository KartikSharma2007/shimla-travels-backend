const { Booking, Hotel, Package } = require('../models');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { User } = require('../models');
const { sendBookingCancellationEmail, sendBookingConfirmationEmail } = require('../utils/emailService');

// ── PRICING CONSTANTS (never trust client-sent prices) ───────────────────
const TAX_RATE_HOTEL = 0.18; // 18% GST on hotels
const TAX_RATE_PACKAGE = 0.05; // 5% GST on packages
const EXTRA_GUEST_RATE = 0.25; // 25% per extra adult beyond 2 per room
const BASE_GUESTS_PER_ROOM = 2;
const CHILD_PRICE_FACTOR = 0.70; // children pay 70% of adult price

// ── Auto-complete bookings whose dates have passed ───────────────────────
// Called whenever bookings are fetched — no cron job needed.
// Any confirmed/upcoming booking where checkout (hotel) or travel date (package)
// is in the past gets automatically moved to 'completed'.
const autoCompleteExpiredBookings = async (userId) => {
  try {
    const now = new Date();

    // Hotel bookings: complete when checkOut date has passed
    await Booking.updateMany(
      {
        user: userId,
        bookingType: 'hotel',
        status: { $in: ['upcoming', 'confirmed'] },
        'payment.status': 'completed',
        checkOut: { $lt: now },
      },
      { $set: { status: 'completed' } }
    );

    // Package bookings: complete when travelDate has passed
    await Booking.updateMany(
      {
        user: userId,
        bookingType: 'package',
        status: { $in: ['upcoming', 'confirmed'] },
        'payment.status': 'completed',
        travelDate: { $lt: now },
      },
      { $set: { status: 'completed' } }
    );
  } catch (err) {
    // Non-critical — log and continue, don't break the request
    logger.error(`autoCompleteExpiredBookings failed: ${err.message}`);
  }
};



// Static hotel data import for server-side price lookup
// This mirrors the same data the frontend uses — single source of truth
const getHotelPriceFromStatic = (hotelId, roomTypeName) => {
  // Fallback price tiers by room type keyword (used when hotel not in DB)
  const roomTiers = {
    deluxe: 6000, suite: 12000, premium: 8000, standard: 4000,
    luxury: 15000, super: 9000, executive: 10000, family: 7000,
    cottage: 5000, villa: 18000,
  };
  const key = Object.keys(roomTiers).find(k =>
    roomTypeName?.toLowerCase().includes(k)
  );
  return key ? roomTiers[key] : 5000; // safe default
};

const calculateHotelPricing = (pricePerNight, nights, rooms, adults, children) => {
  const baseAmount = pricePerNight * nights * rooms;
  const guestsPerRoom = Math.ceil(adults / rooms);
  const extraGuests = Math.max(0, guestsPerRoom - BASE_GUESTS_PER_ROOM);
  const extraCharge = Math.round(pricePerNight * EXTRA_GUEST_RATE * extraGuests) * nights * rooms;
  const subtotal = baseAmount + extraCharge;
  const taxAmount = Math.round(subtotal * TAX_RATE_HOTEL);
  return {
    baseAmount, extraGuestCharge: extraCharge,
    discountAmount: 0, taxAmount,
    totalAmount: subtotal + taxAmount, currency: 'INR',
  };
};

const calculatePackagePricing = (pricePerPerson, adults, children) => {
  const adultTotal = pricePerPerson * adults;
  const childTotal = Math.round(pricePerPerson * CHILD_PRICE_FACTOR) * children;
  const baseAmount = adultTotal + childTotal;
  const taxAmount = Math.round(baseAmount * TAX_RATE_PACKAGE);
  return {
    baseAmount, extraGuestCharge: 0,
    discountAmount: 0, taxAmount,
    totalAmount: baseAmount + taxAmount, currency: 'INR',
  };
};

// @desc   Create hotel booking
// @route  POST /api/bookings/hotel
// @access Private
const createHotelBooking = asyncHandler(async (req, res) => {
  // Fix #16 — Enforce email verification before any booking is allowed.
  // Note: isEmailVerified === undefined (old accounts) is treated as verified
  // so existing users are never accidentally blocked.
  if (req.user.isEmailVerified === false) {
    throw new AppError(
      'Please verify your email address before making a booking. Check your inbox for the verification email.',
      403,
      'EMAIL_NOT_VERIFIED'
    );
  }

  const {
    hotelId, hotelName, roomType,
    checkIn, checkOut,
    guests, rooms, contactInfo, specialRequests,
    // NOTE: roomPrice from client is IGNORED — we compute it server-side
  } = req.body;

  const userId = req.user._id;

  // Date validation
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  if (checkInDate < new Date()) throw new AppError('Check-in date cannot be in the past', 400, 'INVALID_DATE');
  const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
  if (nights < 1) throw new AppError('Check-out must be after check-in', 400, 'INVALID_DATE');

  // Duplicate booking check
  const existing = await Booking.findOne({
    user: userId,
    hotelRef: String(hotelId),
    checkIn: checkInDate,
    status: { $nin: ['cancelled', 'no_show'] },
  });
  if (existing) throw new AppError('You already have a booking for this hotel on these dates. View it in My Bookings.', 409, 'DUPLICATE_BOOKING');

  // Server-side price lookup — NEVER trust client
  let pricePerNight;
  try {
    const hotelDoc = await Hotel.findOne({ staticId: Number(hotelId) }).select('roomTypes');
    if (hotelDoc && hotelDoc.roomTypes?.length) {
      const rt = hotelDoc.roomTypes.find(r => r.type?.toLowerCase() === roomType?.toLowerCase());
      pricePerNight = rt?.price || getHotelPriceFromStatic(hotelId, roomType);
    } else {
      pricePerNight = getHotelPriceFromStatic(hotelId, roomType);
    }
  } catch {
    pricePerNight = getHotelPriceFromStatic(hotelId, roomType);
  }

  const adults = Number(guests?.adults) || 1;
  const children = Number(guests?.children) || 0;
  const numRooms = Number(rooms) || 1;
  const pricing = calculateHotelPricing(pricePerNight, nights, numRooms, adults, children);

  const booking = await Booking.create({
    user: userId, contactInfo, bookingType: 'hotel',
    hotelRef: String(hotelId),
    hotelName: hotelName || 'Hotel Booking',
    roomType: roomType || 'Standard',
    checkIn: checkInDate, checkOut: checkOutDate,
    nights, rooms: numRooms,
    guests: { adults, children, total: adults + children },
    specialRequests, pricing, status: 'upcoming',
  });

  logger.info(`Hotel booking created: ${booking.bookingReference} by ${req.user.email}`);
  res.status(201).json({
    success: true,
    message: 'Booking created successfully',
    data: {
      booking: {
        id: booking._id, bookingReference: booking.bookingReference,
        roomType, checkIn: booking.checkIn, checkOut: booking.checkOut,
        nights, rooms: booking.rooms, guests: booking.guests,
        pricing: booking.pricing, status: booking.status, createdAt: booking.createdAt,
      },
    },
  });
});

// @desc   Create package booking
// @route  POST /api/bookings/package
// @access Private
const createPackageBooking = asyncHandler(async (req, res) => {
  // Fix #16 — Enforce email verification before any booking is allowed.
  // Note: isEmailVerified === undefined (old accounts) is treated as verified.
  if (req.user.isEmailVerified === false) {
    throw new AppError(
      'Please verify your email address before making a booking. Check your inbox for the verification email.',
      403,
      'EMAIL_NOT_VERIFIED'
    );
  }

  const {
    packageId, packageTitle, packageDuration,
    travelDate, pickupLocation, guests, contactInfo, specialRequests,
    // NOTE: packagePrice from client is IGNORED — computed server-side
  } = req.body;

  const userId = req.user._id;

  const travelDateObj = new Date(travelDate);
  if (travelDateObj < new Date()) throw new AppError('Travel date cannot be in the past', 400, 'INVALID_DATE');

  // Duplicate booking check
  const existing = await Booking.findOne({
    user: userId,
    packageRef: String(packageId),
    travelDate: travelDateObj,
    status: { $nin: ['cancelled', 'no_show'] },
  });
  if (existing) throw new AppError('You already have a booking for this package on this date. View it in My Bookings.', 409, 'DUPLICATE_BOOKING');

  // Server-side price lookup
  let pricePerPerson = 10000; // safe default
  try {
    const pkgDoc = await Package.findOne({ staticId: Number(packageId) }).select('price');
    if (pkgDoc?.price) pricePerPerson = pkgDoc.price;
  } catch { /* use default */ }

  const adults = Number(guests?.adults) || 1;
  const children = Number(guests?.children) || 0;
  const pricing = calculatePackagePricing(pricePerPerson, adults, children);

  const booking = await Booking.create({
    user: userId, contactInfo, bookingType: 'package',
    packageRef: String(packageId),
    packageTitle: packageTitle || 'Package Booking',
    travelDate: travelDateObj, pickupLocation,
    guests: { adults, children, total: adults + children },
    specialRequests, pricing, status: 'upcoming',
  });

  logger.info(`Package booking created: ${booking.bookingReference} by ${req.user.email}`);
  res.status(201).json({
    success: true,
    message: 'Booking created successfully',
    data: {
      booking: {
        id: booking._id, bookingReference: booking.bookingReference,
        travelDate: booking.travelDate, pickupLocation,
        guests: booking.guests, pricing: booking.pricing,
        status: booking.status, createdAt: booking.createdAt,
      },
    },
  });
});

// @desc   Get user's bookings
const getUserBookings = asyncHandler(async (req, res) => {
  // Auto-complete any bookings whose dates have passed
  await autoCompleteExpiredBookings(req.user._id);

  const result = await Booking.getUserBookings(req.user._id, {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 10,
    status: req.query.status,
  });
  res.json({ success: true, data: result });
});

// @desc   Get single booking
const getBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({
    $or: [{ _id: req.params.id }, { bookingReference: req.params.id }],
    user: req.user._id,
  }).populate('hotel', 'name location images amenities contact')
    .populate('package', 'title duration coverImage itinerary inclusions exclusions');
  if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  res.json({ success: true, data: { booking } });
});

// @desc   Cancel booking
const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({
    $or: [{ _id: req.params.id }, { bookingReference: req.params.id }],
    user: req.user._id,
  });
  if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  if (booking.status === 'cancelled') throw new AppError('Booking is already cancelled', 400, 'ALREADY_CANCELLED');
  if (booking.status === 'completed') throw new AppError('Cannot cancel a completed booking', 400, 'BOOKING_COMPLETED');

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancellationReason = req.body.reason || 'Cancelled by user';
  booking.cancelledBy = 'user';
  await booking.save({ validateBeforeSave: false });

  logger.info(`Booking cancelled: ${booking.bookingReference} by ${req.user.email}`);

  // ── Send cancellation email — AWAITED for full terminal visibility ───────────
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  BOOKING CANCELLED — attempting cancellation email...    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Booking  : ${booking.bookingReference}`);
  console.log(`  User ID  : ${req.user._id}`);
  console.log(`  User email from token: ${req.user.email}`);

  try {
    const userForEmail = await User.findById(req.user._id).select('email fullName');

    if (!userForEmail) {
      console.error('  ❌ PROBLEM: User not found in database for ID:', req.user._id);
    } else {
      console.log(`  User     : ${userForEmail.fullName} <${userForEmail.email}>`);
      console.log(`  Sending cancellation email TO: ${userForEmail.email} ...`);

      await sendBookingCancellationEmail(userForEmail.email, userForEmail.fullName, booking);

      console.log(`  ✅ Cancellation email sent successfully to: ${userForEmail.email}`);
      console.log(`  ✅ Check inbox (and SPAM folder) of: ${userForEmail.email}`);
    }
  } catch (err) {
    console.error(`  ❌ CANCEL EMAIL FAILED: ${err.message}`);
    console.error(`  ❌ Code: ${err.code || 'none'}`);
    console.error(`  ❌ Response: ${err.response || 'none'}`);
    logger.error(`Cancellation email failed for booking ${booking.bookingReference}: ${err.message}`);
    // Don't throw — booking is already cancelled
  }

  res.json({
    success: true,
    message: 'Booking cancelled successfully',
    data: { bookingReference: booking.bookingReference, status: booking.status, cancelledAt: booking.cancelledAt },
  });
});

// @desc   Get booking stats
const getBookingStats = asyncHandler(async (req, res) => {
  await autoCompleteExpiredBookings(req.user._id);
  const stats = await Booking.getStats(req.user._id);
  res.json({ success: true, data: stats });
});

// @desc   Update booking (admin only)
const updateBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

  const allowed = ['status', 'adminNotes', 'specialRequests'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  if (req.body.status === 'confirmed' && booking.status !== 'confirmed') {
    updates.confirmedAt = new Date();
    updates.confirmedBy = req.user._id;
  }
  const updated = await Booking.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  logger.info(`Booking updated: ${booking.bookingReference} by admin ${req.user.email}`);
  res.json({ success: true, message: 'Booking updated', data: { booking: updated } });
});

module.exports = { createHotelBooking, createPackageBooking, getUserBookings, getBooking, cancelBooking, getBookingStats, updateBooking };