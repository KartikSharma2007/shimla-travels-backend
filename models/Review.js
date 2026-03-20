const mongoose = require('mongoose');

/**
 * Review Schema
 * Stores user reviews for hotels and packages
 * FIX: Renamed itemSnapshot → userSnapshot to match all controller & virtual references
 */

const reviewSchema = new mongoose.Schema({
  // User who wrote the review
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // ✅ FIX: was named "itemSnapshot" — renamed to "userSnapshot" to match virtuals & controller
  userSnapshot: {
    fullName: { type: String, default: 'Anonymous' },
    avatar: { type: String, default: null },
  },

  // For static-data linking (hotel id / package id from JS files)
  itemSnapshot: {
    itemId: { type: String },   // static data ID (e.g. hotelData id)
    itemName: { type: String },   // hotel or package name snapshot
  },

  // Review can be for Hotel OR Package
  hotel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    index: true,
  },
  package: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
    index: true,
  },

  // Review Content
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters'],
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    minlength: [10, 'Comment must be at least 10 characters'],
    maxlength: [2000, 'Comment cannot exceed 2000 characters'],
  },

  // Review Type
  reviewType: {
    type: String,
    enum: ['hotel', 'package'],
    required: true,
  },

  // Review Details
  visitDate: { type: Date },
  travelType: {
    type: String,
    enum: ['Solo', 'Couple', 'Family', 'Friends', 'Business'],
  },

  // Helpful votes
  helpful: { type: Number, default: 0 },
  helpfulVoters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Photos (optional)
  photos: [{ type: String }],

  // Status
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  isUserDeleted: { type: Boolean, default: false },

  // Moderation
  isFlagged: { type: Boolean, default: false },
  flagReason: { type: String },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  moderatedAt: { type: Date },

  // Edit History
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date },
  originalComment: { type: String },

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Compound indexes for unique reviews
reviewSchema.index({ user: 1, hotel: 1 }, {
  unique: true,
  partialFilterExpression: { hotel: { $exists: true } }
});
reviewSchema.index({ user: 1, package: 1 }, {
  unique: true,
  partialFilterExpression: { package: { $exists: true } }
});
reviewSchema.index({ rating: -1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ isActive: 1, isUserDeleted: 1 });
reviewSchema.index({ helpful: -1 });

// Pre-validate: ensure hotel XOR package, set reviewType
reviewSchema.pre('validate', function (next) {
  const hasMongoRef = this.hotel || this.package;
  const hasStaticRef = this.itemSnapshot?.itemId && this.reviewType;

  // Allow static-data reviews (hotel/package from JS files with numeric IDs)
  // These don't have a MongoDB ObjectId — they use itemSnapshot.itemId instead
  if (!hasMongoRef && !hasStaticRef) {
    return next(new Error('Review must be associated with either a hotel or package'));
  }
  if (this.hotel && this.package) {
    return next(new Error('Review cannot be associated with both hotel and package'));
  }

  // Set reviewType from MongoDB ref if available, otherwise keep the one already set
  if (this.hotel) this.reviewType = 'hotel';
  else if (this.package) this.reviewType = 'package';
  // If neither (static data) — reviewType must have been set before calling create()
  next();
});

// ✅ FIX: virtuals now correctly reference userSnapshot
reviewSchema.virtual('displayName').get(function () {
  if (this.isUserDeleted) return 'Deleted User';
  return this.userSnapshot?.fullName || 'Anonymous';
});

reviewSchema.virtual('displayAvatar').get(function () {
  if (this.isUserDeleted) return null;
  return this.userSnapshot?.avatar || null;
});

// Static: check if user can review
reviewSchema.statics.canReview = async function (userId, itemId, itemType) {
  const Booking = mongoose.model('Booking');
  const hasBooking = await Booking.exists({
    user: userId,
    [itemType]: itemId,
    status: 'confirmed',
    checkOut: { $lt: new Date() },
  });
  return !!hasBooking;
};

// Static: get reviews for an item with pagination & sort
// Supports both MongoDB ObjectId refs AND static numeric IDs via itemSnapshot.itemId
reviewSchema.statics.getReviewsForItem = async function (itemId, itemType, options = {}) {
  const { page = 1, limit = 10, sortBy = 'newest' } = options;

  const mongoose = require('mongoose');
  const isObjectId = mongoose.Types.ObjectId.isValid(itemId) && String(itemId).length === 24;

  // Build query: match by MongoDB ObjectId OR by static itemSnapshot.itemId
  const query = {
    isActive: true,
    reviewType: itemType,
    $or: [
      ...(isObjectId ? [{ [itemType]: new mongoose.Types.ObjectId(itemId) }] : []),
      { 'itemSnapshot.itemId': String(itemId) },
    ],
  };

  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    highest: { rating: -1 },
    lowest: { rating: 1 },
    helpful: { helpful: -1 },
  };
  const sort = sortMap[sortBy] || { createdAt: -1 };

  const reviews = await this.find(query)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean({ virtuals: true });

  const total = await this.countDocuments(query);
  return {
    reviews,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

// Static: rating statistics — supports both ObjectId and static string IDs
reviewSchema.statics.getRatingStats = async function (itemId, itemType) {
  const isObjectId = mongoose.Types.ObjectId.isValid(itemId) && String(itemId).length === 24;

  // Match condition: MongoDB ObjectId OR static itemSnapshot.itemId
  const matchCondition = {
    isActive: true,
    reviewType: itemType,
    $or: [
      ...(isObjectId ? [{ [itemType]: new mongoose.Types.ObjectId(itemId) }] : []),
      { 'itemSnapshot.itemId': String(itemId) },
    ],
  };

  const stats = await this.aggregate([
    { $match: matchCondition },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
    { $sort: { _id: -1 } },
  ]);

  const totalStats = await this.aggregate([
    { $match: matchCondition },
    { $group: { _id: null, avgRating: { $avg: '$rating' }, totalCount: { $sum: 1 } } },
  ]);

  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  stats.forEach(s => { distribution[s._id] = s.count; });

  return {
    averageRating: totalStats[0]?.avgRating ? Math.round(totalStats[0].avgRating * 10) / 10 : 0,
    totalCount: totalStats[0]?.totalCount || 0,
    distribution,
  };
};

// Instance: mark helpful
reviewSchema.methods.markHelpful = async function (userId) {
  if (this.helpfulVoters.includes(userId)) {
    return { success: false, message: 'Already marked as helpful' };
  }
  this.helpfulVoters.push(userId);
  this.helpful += 1;
  await this.save();
  return { success: true, helpful: this.helpful };
};

// Instance: edit review
reviewSchema.methods.edit = async function (newComment, newRating, newTitle) {
  if (!this.isEdited) this.originalComment = this.comment;
  this.comment = newComment;
  if (newRating) this.rating = newRating;
  if (newTitle !== undefined) this.title = newTitle;
  this.isEdited = true;
  this.editedAt = new Date();
  await this.save();
  await this._updateParentRating();
};

reviewSchema.methods._updateParentRating = async function () {
  if (this.hotel) {
    const Hotel = mongoose.model('Hotel');
    const hotel = await Hotel.findById(this.hotel);
    if (hotel && hotel.updateRating) await hotel.updateRating();
  } else if (this.package) {
    const Package = mongoose.model('Package');
    const pkg = await Package.findById(this.package);
    if (pkg && pkg.updateRating) await pkg.updateRating();
  }
};

reviewSchema.post('save', async function () { await this._updateParentRating(); });
reviewSchema.post('remove', async function () { await this._updateParentRating(); });

module.exports = mongoose.model('Review', reviewSchema);
