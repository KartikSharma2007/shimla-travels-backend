const mongoose = require('mongoose');  // ✅ FIX: moved to top — was declared after first use
const { Review, Hotel, Package, Booking } = require('../models');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

/**
 * Review Controller
 * Supports both MongoDB ObjectId refs AND static numeric IDs (from hotelData.js)
 */

// ── Helper: check if a string is a valid 24-char MongoDB ObjectId ─────────────
const isMongoId = (id) =>
  mongoose.Types.ObjectId.isValid(id) && String(id).length === 24;

// @desc    Create review
// @route   POST /api/reviews
// @access  Private
const createReview = asyncHandler(async (req, res) => {
  const { itemId, itemType, rating, comment, title, visitDate, travelType, itemName } = req.body;
  const userId = req.user._id;
  const user = req.user;

  if (!['hotel', 'package'].includes(itemType)) {
    throw new AppError('Invalid item type. Must be hotel or package', 400, 'INVALID_ITEM_TYPE');
  }
  if (!itemId) {
    throw new AppError('itemId is required', 400, 'VALIDATION_ERROR');
  }

  // ✅ FIX: single declaration, used throughout this function
  const objectId = isMongoId(itemId);

  // Check for existing review — match by itemSnapshot.itemId OR MongoDB ref
  const existingReview = await Review.findOne({
    user: userId,
    reviewType: itemType,
    $or: [
      { 'itemSnapshot.itemId': String(itemId) },
      ...(objectId ? [{ [itemType]: itemId }] : []),
    ],
  });
  if (existingReview) {
    throw new AppError('You already reviewed this item', 409, 'REVIEW_EXISTS');
  }

  // Check if user has a completed booking (for verified badge)
  // ✅ FIX: only query { hotel: ObjectId } when itemId is a valid ObjectId
  // For static numeric IDs like "2", only match hotelRef/packageRef (string fields)
  const bookingQuery = {
    user: userId,
    status: { $in: ['completed', 'confirmed'] },
    $or: [
      { [`${itemType}Ref`]: String(itemId) },                        // static string ID
      ...(objectId ? [{ [itemType]: itemId }] : []),                  // MongoDB ObjectId only
    ],
  };
  const hasBooking = await Booking.exists(bookingQuery);

  // Build review data
  // For static hotel IDs (e.g. "1", "2", "3" from hotelData.js),
  // we do NOT set the hotel/package ObjectId field — only itemSnapshot is used.
  // The pre-validate hook allows reviews with itemSnapshot.itemId + reviewType set.
  const reviewData = {
    user: userId,
    userSnapshot: {
      fullName: user.fullName || 'Anonymous',
      avatar: user.avatar || null,
    },
    itemSnapshot: {
      itemId: String(itemId),
      itemName: itemName || '',
    },
    reviewType: itemType,   // Always set so pre-validate static path works
    rating,
    comment,
    title,
    visitDate,
    travelType,
    isVerified: !!hasBooking,
  };

  // Only attach MongoDB ObjectId ref if itemId is actually a valid ObjectId
  if (objectId) {
    reviewData[itemType] = itemId;
  }

  const review = await Review.create(reviewData);

  logger.info(`Review created: ${review._id} by user: ${user.email} for ${itemType}: ${itemId}`);

  res.status(201).json({
    success: true,
    message: 'Review submitted successfully',
    data: {
      review: {
        id: review._id,
        rating: review.rating,
        comment: review.comment,
        title: review.title,
        reviewerName: review.userSnapshot.fullName,
        reviewerAvatar: review.userSnapshot.avatar,
        isVerified: review.isVerified,
        createdAt: review.createdAt,
      },
    },
  });
});

// @desc    Get reviews for an item
// @route   GET /api/reviews/:itemType/:itemId
// @access  Public
const getReviews = asyncHandler(async (req, res) => {
  const { itemType, itemId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const sortBy = req.query.sortBy || 'newest';

  if (!['hotel', 'package'].includes(itemType)) {
    throw new AppError('Invalid item type', 400, 'INVALID_ITEM_TYPE');
  }

  const result = await Review.getReviewsForItem(itemId, itemType, { page, limit, sortBy });
  const stats = await Review.getRatingStats(itemId, itemType);

  res.json({
    success: true,
    data: {
      reviews: result.reviews.map(review => ({
        id: review._id,
        rating: review.rating,
        comment: review.comment,
        title: review.title,
        reviewerName: review.isUserDeleted ? 'Deleted User' : (review.userSnapshot?.fullName || 'Anonymous'),
        reviewerAvatar: review.isUserDeleted ? null : (review.userSnapshot?.avatar || null),
        isVerified: review.isVerified,
        isUserDeleted: review.isUserDeleted,
        helpful: review.helpful,
        createdAt: review.createdAt,
        isEdited: review.isEdited,
      })),
      stats,
      pagination: result.pagination,
    },
  });
});

// @desc    Get user's own reviews
// @route   GET /api/reviews/my-reviews
// @access  Private
const getMyReviews = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const reviews = await Review.find({ user: userId })
    .populate('hotel', 'name location images')
    .populate('package', 'title location coverImage')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await Review.countDocuments({ user: userId });

  res.json({
    success: true,
    data: {
      reviews: reviews.map(r => ({
        id: r._id,
        rating: r.rating,
        comment: r.comment,
        title: r.title,
        itemType: r.reviewType,
        itemName: r.itemSnapshot?.itemName || r.hotel?.name || r.package?.title || '',
        item: r.hotel || r.package,
        helpful: r.helpful,
        createdAt: r.createdAt,
        isEdited: r.isEdited,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private
const updateReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, comment, title } = req.body;
  const userId = req.user._id;

  const review = await Review.findOne({ _id: id, user: userId });
  if (!review) throw new AppError('Review not found', 404, 'REVIEW_NOT_FOUND');

  await review.edit(comment, rating, title);

  logger.info(`Review updated: ${review._id} by user: ${req.user.email}`);

  res.json({
    success: true,
    message: 'Review updated successfully',
    data: {
      review: {
        id: review._id,
        rating: review.rating,
        comment: review.comment,
        title: review.title,
        isEdited: review.isEdited,
        editedAt: review.editedAt,
      },
    },
  });
});

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private
const deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const review = await Review.findOne({ _id: id, user: userId });
  if (!review) throw new AppError('Review not found', 404, 'REVIEW_NOT_FOUND');

  await review.deleteOne();

  if (review.hotel) {
    const hotel = await Hotel.findById(review.hotel);
    if (hotel && hotel.updateRating) await hotel.updateRating();
  } else if (review.package) {
    const pkg = await Package.findById(review.package);
    if (pkg && pkg.updateRating) await pkg.updateRating();
  }

  logger.info(`Review deleted: ${id} by user: ${req.user.email}`);
  res.json({ success: true, message: 'Review deleted successfully' });
});

// @desc    Mark review as helpful
// @route   POST /api/reviews/:id/helpful
// @access  Private
const markHelpful = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const review = await Review.findById(id);
  if (!review) throw new AppError('Review not found', 404, 'REVIEW_NOT_FOUND');

  if (review.user.toString() === userId.toString()) {
    throw new AppError('Cannot mark your own review as helpful', 400, 'OWN_REVIEW');
  }

  const result = await review.markHelpful(userId);
  res.json({
    success: result.success,
    message: result.success ? 'Marked as helpful' : result.message,
    data: { helpful: review.helpful },
  });
});

// @desc    Check if user can review an item
// @route   GET /api/reviews/can-review/:itemType/:itemId
// @access  Private
const canReview = asyncHandler(async (req, res) => {
  const { itemType, itemId } = req.params;
  const userId = req.user._id;

  if (!['hotel', 'package'].includes(itemType)) {
    throw new AppError('Invalid item type', 400, 'INVALID_ITEM_TYPE');
  }

  const hasBooking = await Review.canReview(userId, itemId, itemType);
  const objId = isMongoId(itemId);
  const existingReview = await Review.findOne({
    user: userId,
    reviewType: itemType,
    $or: [
      { 'itemSnapshot.itemId': String(itemId) },
      ...(objId ? [{ [itemType]: itemId }] : []),
    ],
  });

  res.json({
    success: true,
    data: {
      canReview: !existingReview,
      hasBooking,
      hasReviewed: !!existingReview,
      existingReviewId: existingReview?._id,
    },
  });
});

module.exports = {
  createReview,
  getReviews,
  getMyReviews,
  updateReview,
  deleteReview,
  markHelpful,
  canReview,
};
