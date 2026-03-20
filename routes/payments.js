const express = require('express');
const router  = express.Router();
const { paymentController } = require('../controllers');
const { protect, paymentLimiter } = require('../middleware');

/**
 * Payment Routes
 * Base path: /api/payments
 * All routes require authentication
 */

router.use(protect);

// Create mock payment order for a booking
router.post('/create-order', paymentLimiter, paymentController.createOrder);

// Confirm mock payment success
router.post('/confirm', paymentLimiter, paymentController.confirmPayment);

// Record payment failure
router.post('/failed', paymentController.paymentFailed);

// Get payment status for a booking
router.get('/status/:bookingId', paymentController.getPaymentStatus);

module.exports = router;
