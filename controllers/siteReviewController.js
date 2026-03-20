const { SiteReview } = require('../models');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Site Review Controller
 * Handles general testimonial reviews shown on the About page.
 */

// @desc    Get all active site reviews
// @route   GET /api/site-reviews
// @access  Public
const getSiteReviews = asyncHandler(async (req, res) => {
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 50;

  const reviews = await SiteReview.find({ isActive: true })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await SiteReview.countDocuments({ isActive: true });

  res.json({
    success: true,
    data: {
      reviews,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

// @desc    Create a site review
// @route   POST /api/site-reviews
// @access  Public (no login required — anyone can leave a testimonial)
const createSiteReview = asyncHandler(async (req, res) => {
  const { name, location, trip, story, rating, image } = req.body;

  if (!name || !location || !trip || !story || !rating) {
    throw new AppError('name, location, trip, story and rating are required', 400, 'VALIDATION_ERROR');
  }

  const review = await SiteReview.create({
    name:     name.trim(),
    location: location.trim(),
    trip:     trip.trim(),
    story:    story.trim(),
    rating:   Number(rating),
    image:    image || `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=2f7d57&color=fff&size=128`,
    userId:   req.user?._id || null,
  });

  logger.info(`Site review created: ${review._id} by "${name}"`);

  res.status(201).json({
    success: true,
    message: 'Review submitted successfully',
    data: { review },
  });
});

// @desc    Delete own site review
// @route   DELETE /api/site-reviews/:id
// @access  Private (owner only)
const deleteSiteReview = asyncHandler(async (req, res) => {
  const review = await SiteReview.findById(req.params.id);
  if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND');

  // Only allow deletion if this user created it
  if (review.userId && review.userId.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorised to delete this review', 403, 'FORBIDDEN');
  }

  await review.deleteOne();
  logger.info(`Site review deleted: ${req.params.id}`);

  res.json({ success: true, message: 'Review deleted' });
});

module.exports = { getSiteReviews, createSiteReview, deleteSiteReview };
