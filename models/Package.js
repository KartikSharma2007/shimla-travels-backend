const mongoose = require('mongoose');

/**
 * Package Schema
 * Stores travel package information with itineraries
 */

const itineraryDaySchema = new mongoose.Schema({
  day: {
    type: Number,
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  meals: {
    breakfast: { type: Boolean, default: false },
    lunch: { type: Boolean, default: false },
    dinner: { type: Boolean, default: false },
  },
  activities: [{
    name: { type: String },
    time: { type: String },
    description: { type: String },
  }],
});

const packageSchema = new mongoose.Schema({
  // Links this MongoDB record to the static packagesData.js id
  staticId: {
    type: Number,
    index: true,
    sparse: true,
  },

  // Basic Information
  title: {
    type: String,
    required: [true, 'Package title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters'],
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [3000, 'Description cannot exceed 3000 characters'],
  },
  shortDescription: {
    type: String,
    maxlength: [200, 'Short description cannot exceed 200 characters'],
  },

  // Category & Type
  category: {
    type: String,
    required: true,
    enum: ['Adventure', 'Family', 'Romantic', 'Budget', 'Luxury', 'Honeymoon', 'Group', 'Solo'],
  },
  tags: [{
    type: String,
    trim: true,
  }],

  // Media
  images: [{
    type: String,
  }],
  coverImage: {
    type: String,
    required: true,
  },

  // Pricing
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: 0,
  },
  originalPrice: {
    type: Number,
    min: 0,
  },
  childPrice: {
    type: Number,
    min: 0,
    default: function () {
      return this.price * 0.7; // 70% of adult price
    },
  },

  // Duration & Group
  duration: {
    type: String,
    required: true, // e.g., "3 Days / 2 Nights"
  },
  durationDays: {
    type: Number,
    required: true,
    min: 1,
  },
  groupSize: {
    type: String,
    default: '2-12 People',
  },
  maxGroupSize: {
    type: Number,
    default: 12,
  },
  minGroupSize: {
    type: Number,
    default: 2,
  },

  // Location
  location: {
    type: String,
    required: true,
  },
  destinations: [{
    name: { type: String, required: true },
    description: { type: String },
    image: { type: String },
  }],

  // Itinerary
  itinerary: [itineraryDaySchema],

  // Inclusions & Exclusions
  inclusions: [{
    type: String,
    required: true,
  }],
  exclusions: [{
    type: String,
  }],

  // Highlights
  highlights: [{
    type: String,
  }],

  // Rating & Reviews
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
    set: val => Math.round(val * 10) / 10,
  },
  totalReviews: {
    type: Number,
    default: 0,
  },

  // Best Time to Visit
  bestTimeToVisit: {
    summer: { months: { type: String, default: 'Mar - Jun' }, description: { type: String } },
    winter: { months: { type: String, default: 'Oct - Feb' }, description: { type: String } },
    monsoon: { months: { type: String, default: 'Jul - Sep' }, description: { type: String } },
  },

  // Policies
  policies: {
    cancellation: { type: String, default: 'Free cancellation up to 7 days before departure' },
    refund: { type: String },
    booking: { type: String },
  },

  // Status
  isActive: {
    type: Boolean,
    default: true,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  startDate: {
    type: Date,
  },
  endDate: {
    type: Date,
  },

  // Availability
  availableSlots: {
    type: Number,
    default: 20,
  },
  bookedSlots: {
    type: Number,
    default: 0,
  },

  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes
packageSchema.index({ title: 'text', description: 'text', location: 'text' });
packageSchema.index({ category: 1 });
packageSchema.index({ price: 1 });
packageSchema.index({ rating: -1 });
packageSchema.index({ isActive: 1, isFeatured: 1 });
packageSchema.index({ durationDays: 1 });
packageSchema.index({ tags: 1 });

// Virtual for reviews
packageSchema.virtual('reviewsList', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'package',
});

// Virtual for discount percentage
packageSchema.virtual('discountPercentage').get(function () {
  if (!this.originalPrice || this.originalPrice <= this.price) return 0;
  return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
});

// Virtual for availability status
packageSchema.virtual('isAvailable').get(function () {
  return this.isActive && this.availableSlots > this.bookedSlots;
});

// Method to update rating based on reviews
packageSchema.methods.updateRating = async function () {
  const Review = mongoose.model('Review');

  const stats = await Review.aggregate([
    { $match: { package: this._id, isActive: true } },
    {
      $group: {
        _id: '$package',
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    this.rating = Math.round(stats[0].avgRating * 10) / 10;
    this.totalReviews = stats[0].count;
  } else {
    this.rating = 0;
    this.totalReviews = 0;
  }

  await this.save({ validateBeforeSave: false });
};

// Method to check availability for dates
packageSchema.methods.checkAvailability = async function (travelDate, travelers) {
  const Booking = mongoose.model('Booking');

  const bookings = await Booking.countDocuments({
    package: this._id,
    travelDate: {
      $gte: new Date(travelDate),
      $lt: new Date(new Date(travelDate).setDate(new Date(travelDate).getDate() + 1)),
    },
    status: { $in: ['confirmed', 'pending'] },
  });

  const remainingSlots = this.maxGroupSize - bookings;
  return remainingSlots >= travelers;
};

// Static method to search packages
packageSchema.statics.search = async function (query, filters = {}) {
  const searchCriteria = {
    isActive: true,
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { location: { $regex: query, $options: 'i' } },
    ],
  };

  if (filters.category) {
    searchCriteria.category = filters.category;
  }
  if (filters.minPrice) {
    searchCriteria.price = { $gte: filters.minPrice };
  }
  if (filters.maxPrice) {
    searchCriteria.price = {
      ...searchCriteria.price,
      $lte: filters.maxPrice
    };
  }
  if (filters.duration) {
    searchCriteria.durationDays = { $lte: filters.duration };
  }
  if (filters.rating) {
    searchCriteria.rating = { $gte: filters.rating };
  }

  return this.find(searchCriteria).sort({ isFeatured: -1, rating: -1 });
};

module.exports = mongoose.model('Package', packageSchema);
