const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, authorize } = require('../middleware');

/**
 * Admin Routes
 * Base path: /api/admin
 * ALL routes require: logged in + role === 'admin'
 */

router.use(protect);
router.use(authorize('admin'));

// ── Dashboard ────────────────────────────────────────────────────────────────
router.get('/stats', adminController.getDashboardStats);

// ── Bookings ─────────────────────────────────────────────────────────────────
router.get('/bookings', adminController.getAllBookings);
router.get('/bookings/:id', adminController.getBookingDetail);
router.put('/bookings/:id/confirm', adminController.confirmBooking);
router.put('/bookings/:id/cancel', adminController.cancelBooking);
router.put('/bookings/:id/notes', adminController.updateBookingNotes);

// ── Users ────────────────────────────────────────────────────────────────────
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserDetail);
router.put('/users/:id/ban', adminController.banUser);
router.put('/users/:id/unban', adminController.unbanUser);

// ── Reviews ──────────────────────────────────────────────────────────────────
router.get('/reviews', adminController.getAllReviews);
router.get('/reviews/site', adminController.getAllSiteReviews);
router.delete('/reviews/:id', adminController.deleteReview);
router.delete('/reviews/site/:id', adminController.deleteSiteReview);
router.put('/reviews/:id/flag', adminController.flagReview);
router.put('/reviews/:id/unflag', adminController.unflagReview);

// ── Hotels ───────────────────────────────────────────────────────────────────
router.get('/hotels', adminController.getAllHotels);
router.put('/hotels/:id/toggle', adminController.toggleHotel);
router.put('/hotels/:id/price', adminController.updateHotelPrice);

// ── Packages ─────────────────────────────────────────────────────────────────
router.get('/packages', adminController.getAllPackages);
router.put('/packages/:id/toggle', adminController.togglePackage);
router.put('/packages/:id/price', adminController.updatePackagePrice);

// ── Audit Log ─────────────────────────────────────────────────────────────────
router.get('/audit-log', adminController.getAuditLog);

module.exports = router;
