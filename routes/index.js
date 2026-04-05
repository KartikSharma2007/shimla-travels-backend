const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const bookingRoutes = require('./bookings');
const hotelRoutes = require('./hotels');
const packageRoutes = require('./packages');
const reviewRoutes = require('./reviews');
const savedItemRoutes = require('./savedItems');
const supportRoutes = require('./support');
const paymentRoutes = require('./payments');
const siteReviewRoutes = require('./siteReviews');
const adminRoutes = require('./admin');        // ✅ NEW
const searchRoutes = require('./search');

router.use('/v1/auth', authRoutes);
router.use('/v1/bookings', bookingRoutes);
router.use('/v1/hotels', hotelRoutes);
router.use('/v1/packages', packageRoutes);
router.use('/v1/reviews', reviewRoutes);
router.use('/v1/saved-items', savedItemRoutes);
router.use('/v1/support', supportRoutes);
router.use('/v1/payments', paymentRoutes);
router.use('/v1/site-reviews', siteReviewRoutes);
router.use('/v1/admin', adminRoutes);
router.use('/v1/search', searchRoutes);        // ✅ NEW

router.get('/v1/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

module.exports = router;
