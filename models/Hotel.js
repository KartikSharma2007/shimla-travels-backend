const mongoose = require('mongoose');

/**
 * Hotel Schema
 * Stores hotel information with room types and amenities
 */

const roomTypeSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  features: [{
    type: String,
    trim: true,
  }],
  maxGuests: {
    type: Number,
    default: 2,
  },
  availableRooms: {
    type: Number,
    default: 10,
  },
  images: [{
    type: String,
  }],
});

const hotelSchema = new mongoose.Schema({
  // Basic Information
  // Links this MongoDB record to the static hotelData.js id (e.g. 1, 2, 3...)
  staticId: {
    type: Number,
    index: true,
    sparse: true,   // allows null/undefined — not all hotels need a static ID
  },

  name: {
    type: String,
    required: [true, 'Hotel name is required'],
    trim: true,
    maxlength: [100, 'Hotel name cannot exceed 100 characters'],
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
  },
  shortDescription: {
    type: String,
    maxlength: [200, 'Short description cannot exceed 200 characters'],
  },

  // Location
  location: {
    address: { type: String, required: true },
    city: { type: String, required: true, default: 'Shimla' },
    state: { type: String, required: true, default: 'Himachal Pradesh' },
    country: { type: String, default: 'India' },
    zipCode: { type: String },
    coordinates: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
  },

  // Media
  images: [{
    type: String,
    required: true,
  }],
  coverImage: {
    type: String,
    required: true,
  },

  // Pricing & Rooms
  basePrice: {
    type: Number,
    required: true,
    min: 0,
  },
  roomTypes: [roomTypeSchema],

  // Amenities
  amenities: [{
    type: String,
    trim: true,
  }],

  // Rating & Reviews
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
    set: val => Math.round(val * 10) / 10, // Round to 1 decimal
  },
  totalReviews: {
    type: Number,
    default: 0,
  },

  // Nearby Attractions
  nearby: [{
    name: { type: String, required: true },
    distance: { type: String }, // e.g., "2 km"
    description: { type: String },
  }],

  // Hotel Details
  starRating: {
    type: Number,
    min: 1,
    max: 5,
    default: 3,
  },
  checkInTime: {
    type: String,
    default: '14:00',
  },
  checkOutTime: {
    type: String,
    default: '11:00',
  },

  // Policies
  policies: {
    cancellation: { type: String, default: 'Free cancellation up to 24 hours before check-in' },
    petsAllowed: { type: Boolean, default: false },
    smokingAllowed: { type: Boolean, default: false },
  },

  // Contact
  contact: {
    phone: { type: String },
    email: { type: String },
    website: { type: String },
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
hotelSchema.index({ name: 'text', description: 'text', 'location.city': 'text' });
hotelSchema.index({ 'location.city': 1, 'location.state': 1 });
hotelSchema.index({ rating: -1 });
hotelSchema.index({ basePrice: 1 });
hotelSchema.index({ isActive: 1, isFeatured: 1 });
hotelSchema.index({ amenities: 1 });

// Virtual for reviews
hotelSchema.virtual('reviewsList', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'hotel',
});

// Virtual for average price across all room types
hotelSchema.virtual('averagePrice').get(function () {
  if (!this.roomTypes || this.roomTypes.length === 0) {
    return this.basePrice;
  }
  const total = this.roomTypes.reduce((sum, room) => sum + room.price, 0);
  return Math.round(total / this.roomTypes.length);
});

// Method to update rating based on reviews
hotelSchema.methods.updateRating = async function () {
  const Review = mongoose.model('Review');

  const stats = await Review.aggregate([
    { $match: { hotel: this._id, isActive: true } },
    {
      $group: {
        _id: '$hotel',
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

// Static method to search hotels
hotelSchema.statics.search = async function (query, filters = {}) {
  const searchCriteria = {
    isActive: true,
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { 'location.city': { $regex: query, $options: 'i' } },
      { 'location.state': { $regex: query, $options: 'i' } },
    ],
  };

  if (filters.minPrice) {
    searchCriteria.basePrice = { $gte: filters.minPrice };
  }
  if (filters.maxPrice) {
    searchCriteria.basePrice = {
      ...searchCriteria.basePrice,
      $lte: filters.maxPrice
    };
  }
  if (filters.amenities && filters.amenities.length > 0) {
    searchCriteria.amenities = { $in: filters.amenities };
  }
  if (filters.rating) {
    searchCriteria.rating = { $gte: filters.rating };
  }

  return this.find(searchCriteria).sort({ rating: -1, basePrice: 1 });
};

module.exports = mongoose.model('Hotel', hotelSchema);
