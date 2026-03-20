const express = require('express');
const router = express.Router();
const { bookingController } = require('../controllers');
const {
  protect,
  authorize,
  paymentLimiter,
  createHotelBookingValidator,
  createPackageBookingValidator,
  paginationValidator,
  idParamValidator,
} = require('../middleware');

/**
 * Booking Routes
 * Base path: /api/bookings
 */

// All routes require authentication
router.use(protect);

// Get user's bookings
router.get('/', paginationValidator, bookingController.getUserBookings);

// Get booking statistics
router.get('/stats', bookingController.getBookingStats);

// Create bookings
router.post(
  '/hotel',
  paymentLimiter,
  createHotelBookingValidator,
  bookingController.createHotelBooking
);

router.post(
  '/package',
  paymentLimiter,
  createPackageBookingValidator,
  bookingController.createPackageBooking
);

// Get single booking
router.get('/:id', bookingController.getBooking);

// Cancel booking
router.put('/:id/cancel', bookingController.cancelBooking);

// Update booking (admin only)
router.put('/:id', authorize('admin'), bookingController.updateBooking);

module.exports = router;
