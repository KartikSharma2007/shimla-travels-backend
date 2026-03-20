const express = require('express');
const router  = express.Router();
const { getSiteReviews, createSiteReview, deleteSiteReview } = require('../controllers/siteReviewController');
const { protect, optionalAuth, reviewLimiter } = require('../middleware');

// GET all reviews — public
router.get('/', getSiteReviews);

// POST new review — public (optional auth for userId linkage)
router.post('/', optionalAuth, reviewLimiter, createSiteReview);

// DELETE own review — private
router.delete('/:id', protect, deleteSiteReview);

module.exports = router;
