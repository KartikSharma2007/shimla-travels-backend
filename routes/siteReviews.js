const express = require('express');
const router = express.Router();
const {
    getSiteReviews,
    createSiteReview,
    toggleLike,
    deleteSiteReview,
} = require('../controllers/siteReviewController');
const { protect, optionalAuth, reviewLimiter } = require('../middleware');

// GET all reviews — public
router.get('/', getSiteReviews);

// POST new review — public (optional auth for userId + profilePicture linkage)
router.post('/', optionalAuth, reviewLimiter, createSiteReview);

// POST toggle like — private (must be logged in to like)
router.post('/:id/like', protect, toggleLike);

// DELETE own review — private
router.delete('/:id', protect, deleteSiteReview);

module.exports = router;