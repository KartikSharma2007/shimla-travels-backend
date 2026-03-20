const express = require('express');
const router = express.Router();
const { reviewController } = require('../controllers');
const {
  protect, optionalAuth, reviewLimiter,
  createReviewValidator, paginationValidator,
} = require('../middleware');

/**
 * Review Routes
 * Base path: /api/v1/reviews
 *
 * IMPORTANT: Public routes MUST come before router.use(protect)
 * Otherwise all routes including the public GET require login.
 */

// ── PUBLIC route — no auth required (optionalAuth only adds user if logged in) ──
// Must be registered BEFORE protect middleware
router.get('/:itemType/:itemId', optionalAuth, paginationValidator, reviewController.getReviews);

// ── All routes below this line require authentication ──────────────────────────
router.use(protect);

router.get('/my-reviews', paginationValidator, reviewController.getMyReviews);
router.get('/can-review/:itemType/:itemId', reviewController.canReview);
router.post('/', reviewLimiter, createReviewValidator, reviewController.createReview);
router.put('/:id', reviewLimiter, createReviewValidator, reviewController.updateReview);
router.delete('/:id', reviewController.deleteReview);
router.post('/:id/helpful', reviewController.markHelpful);

module.exports = router;
