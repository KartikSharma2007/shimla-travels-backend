const express = require('express');
const router = express.Router();
const { bookingController } = require('../controllers');
const {
  protect,
  authorize,
  bookingLimiter,   // ← was paymentLimiter; bookings get their own relaxed limiter
  paymentLimiter,
  createHotelBookingValidator,
  createPackageBookingValidator,
  paginationValidator,
  idParamValidator,
} = require('../middleware');

/**
 * Booking Routes
 * Base path: /api/bookings
 *
 * Rate limiting:
 *  - bookingLimiter  → creating bookings  (30/hr per user — relaxed)
 *  - paymentLimiter  → payment endpoints  (30/hr per user)
 */

// All routes require authentication
router.use(protect);

// Read operations — no rate limiting (just auth)
router.get('/', paginationValidator, bookingController.getUserBookings);
router.get('/stats', bookingController.getBookingStats);
router.get('/:id', bookingController.getBooking);

// Create bookings — bookingLimiter (separate from payment)
router.post('/hotel', bookingLimiter, createHotelBookingValidator, bookingController.createHotelBooking);
router.post('/package', bookingLimiter, createPackageBookingValidator, bookingController.createPackageBooking);

// Mutations
router.put('/:id/cancel', bookingController.cancelBooking);
router.put('/:id', authorize('admin'), bookingController.updateBooking);

module.exports = router;
