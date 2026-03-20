const mongoose = require('mongoose');

/**
 * Booking Schema
 * Stores booking information for hotels and packages
 * Integrated with payment system
 */

const guestSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  age: { type: Number },
  isChild: { type: Boolean, default: false },
});

const bookingSchema = new mongoose.Schema({
  // Booking Reference
  bookingReference: {
    type: String,
    unique: true,
  },

  // User who made the booking
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Contact Information (snapshot at booking time)
  contactInfo: {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
  },

  // Booking Type
  bookingType: {
    type: String,
    enum: ['hotel', 'package'],
    required: true,
  },

  // Hotel Booking Details
  hotel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
  },
  hotelRef: {
    type: String,   // stores static frontend hotel id as string
  },
  hotelName: {
    type: String,   // snapshot of hotel name at booking time
  },
  roomType: {
    type: String,
  },
  roomTypeId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  checkIn: {
    type: Date,
  },
  checkOut: {
    type: Date,
  },
  nights: {
    type: Number,
  },
  rooms: {
    type: Number,
    default: 1,
  },

  // Package Booking Details
  package: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
  },
  packageRef: {
    type: String,   // stores static frontend package id as string
  },
  packageTitle: {
    type: String,   // snapshot of package title at booking time
  },
  travelDate: {
    type: Date,
  },
  pickupLocation: {
    type: String,
  },

  // Guests
  guests: {
    adults: {
      type: Number,
      required: true,
      min: 1,
    },
    children: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    details: [guestSchema], // Optional detailed guest info
  },

  // Pricing
  pricing: {
    baseAmount: { type: Number, required: true },
    extraGuestCharge: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
  },

  // Special Requests
  specialRequests: {
    type: String,
    maxlength: [500, 'Special requests cannot exceed 500 characters'],
  },

  // Payment Information
  payment: {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending',
    },
    method: {
      type: String,
      enum: ['razorpay', 'upi', 'card', 'netbanking', 'wallet', 'cash'],
    },
    transactionId: {
      type: String,
    },
    orderId: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    failureReason: {
      type: String,
    },
    refundAmount: {
      type: Number,
      default: 0,
    },
    refundReason: {
      type: String,
    },
    refundedAt: {
      type: Date,
    },
  },

  // Booking Status
  status: {
    type: String,
    enum: ['pending', 'upcoming', 'confirmed', 'cancelled', 'completed', 'no_show'],
    default: 'upcoming',
  },

  // Confirmation
  confirmedAt: {
    type: Date,
  },
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

  // Cancellation
  cancelledAt: {
    type: Date,
  },
  cancellationReason: {
    type: String,
  },
  cancelledBy: {
    type: String,
    enum: ['user', 'admin', 'system'],
  },
  cancellationCharges: {
    type: Number,
    default: 0,
  },

  // Internal Notes
  adminNotes: {
    type: String,
  },

  // Reminders
  remindersSent: {
    confirmation: { type: Boolean, default: false },
    preArrival: { type: Boolean, default: false },
    feedback: { type: Boolean, default: false },
  },

  // Review Status
  isReviewed: {
    type: Boolean,
    default: false,
  },
  reviewId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ 'payment.status': 1 });
bookingSchema.index({ hotel: 1, checkIn: 1 });
bookingSchema.index({ package: 1, travelDate: 1 });

// Generate booking reference before saving
bookingSchema.pre('save', async function (next) {
  if (!this.bookingReference) {
    const prefix = this.bookingType === 'hotel' ? 'HTL' : 'PKG';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    this.bookingReference = `${prefix}-${timestamp}-${random}`;
  }

  // Calculate total guests
  if (this.isModified('guests')) {
    this.guests.total = this.guests.adults + this.guests.children;
  }

  next();
});

// Virtual for booking duration
bookingSchema.virtual('duration').get(function () {
  if (this.bookingType === 'hotel' && this.checkIn && this.checkOut) {
    const diffTime = Math.abs(this.checkOut - this.checkIn);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return null;
});

// Virtual for payment status display
bookingSchema.virtual('paymentStatusDisplay').get(function () {
  const statusMap = {
    pending: 'Payment Pending',
    processing: 'Processing',
    completed: 'Paid',
    failed: 'Payment Failed',
    refunded: 'Refunded',
    partially_refunded: 'Partially Refunded',
  };
  return statusMap[this.payment.status] || this.payment.status;
});

// Virtual for booking status display
bookingSchema.virtual('statusDisplay').get(function () {
  const statusMap = {
    pending: 'Pending Confirmation',
    upcoming: 'Upcoming',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    completed: 'Completed',
    no_show: 'No Show',
  };
  return statusMap[this.status] || this.status;
});

// Method to confirm booking
bookingSchema.methods.confirm = async function (confirmedBy) {
  this.status = 'confirmed';
  this.confirmedAt = new Date();
  if (confirmedBy) {
    this.confirmedBy = confirmedBy;
  }
  await this.save();
};

// Method to cancel booking
bookingSchema.methods.cancel = async function (reason, cancelledBy) {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  this.cancelledBy = cancelledBy;

  // Calculate cancellation charges based on policy
  const hoursBefore = this.getHoursBeforeBooking();
  if (hoursBefore > 48) {
    this.cancellationCharges = 0; // Full refund
  } else if (hoursBefore > 24) {
    this.cancellationCharges = this.pricing.totalAmount * 0.1; // 10% charge
  } else {
    this.cancellationCharges = this.pricing.totalAmount * 0.5; // 50% charge
  }

  await this.save();
};

// Helper to get hours before booking
bookingSchema.methods.getHoursBeforeBooking = function () {
  const bookingDate = this.bookingType === 'hotel' ? this.checkIn : this.travelDate;
  if (!bookingDate) return 0;

  const diffTime = bookingDate - new Date();
  return Math.ceil(diffTime / (1000 * 60 * 60));
};

// Method to complete booking
bookingSchema.methods.complete = async function () {
  this.status = 'completed';
  await this.save();
};

// Method to mark payment as completed
bookingSchema.methods.markPaymentCompleted = async function (transactionId) {
  this.payment.status = 'completed';
  this.payment.transactionId = transactionId;
  this.payment.paidAt = new Date();

  // Auto-confirm if payment is successful
  if (this.status === 'pending') {
    this.status = 'confirmed';
    this.confirmedAt = new Date();
  }

  await this.save();
};

// Method to mark payment as failed
bookingSchema.methods.markPaymentFailed = async function () {
  this.payment.status = 'failed';
  await this.save();
};

// Static method to get user's bookings
bookingSchema.statics.getUserBookings = async function (userId, options = {}) {
  const { page = 1, limit = 10, status } = options;

  const query = { user: userId };
  if (status) {
    query.status = status;
  }

  const bookings = await this.find(query)
    .populate('hotel', 'name location images')
    .populate('package', 'title location coverImage duration')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await this.countDocuments(query);

  return {
    bookings,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// Static method to check for duplicate bookings
bookingSchema.statics.checkDuplicate = async function (userId, itemId, itemType, dateInfo) {
  const query = {
    user: userId,
    [itemType]: itemId,
    status: { $nin: ['cancelled', 'no_show'] },
  };

  if (itemType === 'hotel') {
    query.checkIn = dateInfo.checkIn;
  } else {
    query.travelDate = dateInfo.travelDate;
  }

  const existing = await this.findOne(query);
  return !!existing;
};

// Static method to get booking statistics
bookingSchema.statics.getStats = async function (userId) {
  const stats = await this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalSpent: {
          $sum: {
            $cond: [
              { $eq: ['$payment.status', 'completed'] },
              '$pricing.totalAmount',
              0
            ]
          }
        },
      },
    },
  ]);

  const result = {
    total: 0,
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    totalSpent: 0,
  };

  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
    result.totalSpent += stat.totalSpent;
  });

  return result;
};

module.exports = mongoose.model('Booking', bookingSchema);
