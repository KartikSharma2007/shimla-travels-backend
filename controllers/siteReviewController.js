const { SiteReview, User } = require('../models');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Site Review Controller
 * Handles general testimonial reviews shown on the About page.
 */

// ─── Helper: build initials avatar URL ──────────────────────────────────────
const initialsAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2f7d57&color=fff&size=128`;

// @desc    Get all active site reviews
// @route   GET /api/site-reviews
// @access  Public
const getSiteReviews = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
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
// @access  Public (optional auth for userId + profilePicture linkage)
const createSiteReview = asyncHandler(async (req, res) => {
  const { name, location, trip, story, rating, tripImage } = req.body;

  if (!name || !location || !trip || !story || !rating) {
    throw new AppError('name, location, trip, story and rating are required', 400, 'VALIDATION_ERROR');
  }

  // ── Resolve profilePicture ───────────────────────────────────────────────
  // Priority: logged-in user's saved avatar → initials fallback.
  // We snapshot it now so every future viewer sees the correct picture,
  // regardless of which account they are logged in with.
  let profilePicture = initialsAvatar(name.trim());

  if (req.user?._id) {
    // Re-fetch to guarantee we have the latest avatar (not stale JWT payload)
    const freshUser = await User.findById(req.user._id).select('avatar').lean();
    if (freshUser?.avatar) {
      profilePicture = freshUser.avatar;
    }
  }

  const review = await SiteReview.create({
    name: name.trim(),
    location: location.trim(),
    trip: trip.trim(),
    story: story.trim(),
    rating: Number(rating),
    profilePicture,                      // ✅ always a valid URL
    tripImage: tripImage || null,   // ✅ separate from profile pic
    userId: req.user?._id || null,
    likes: [],
  });

  logger.info(`Site review created: ${review._id} by "${name}"`);

  res.status(201).json({
    success: true,
    message: 'Review submitted successfully',
    data: { review },
  });
});

// @desc    Toggle like on a review (add if not liked, remove if already liked)
// @route   POST /api/site-reviews/:id/like
// @access  Private
const toggleLike = asyncHandler(async (req, res) => {
  const review = await SiteReview.findById(req.params.id);
  if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND');

  const userId = req.user._id.toString();
  const alreadyLiked = review.likes.includes(userId);

  if (alreadyLiked) {
    review.likes = review.likes.filter(id => id !== userId);
  } else {
    review.likes.push(userId);
  }

  await review.save();

  res.json({
    success: true,
    data: {
      liked: !alreadyLiked,
      likeCount: review.likes.length,
      likes: review.likes,
    },
  });
});

// @desc    Delete own site review
// @route   DELETE /api/site-reviews/:id
// @access  Private (owner only)
const deleteSiteReview = asyncHandler(async (req, res) => {
  const review = await SiteReview.findById(req.params.id);
  if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND');

  if (review.userId && review.userId.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorised to delete this review', 403, 'FORBIDDEN');
  }

  await review.deleteOne();
  logger.info(`Site review deleted: ${req.params.id}`);

  res.json({ success: true, message: 'Review deleted' });
});

module.exports = { getSiteReviews, createSiteReview, toggleLike, deleteSiteReview };