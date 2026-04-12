const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * User Schema
 * Stores user account information with authentication details
 */

const userSchema = new mongoose.Schema({
  // Basic Information
  fullName: {
    type: String,
    required: [true, "Full name is required"],
    trim: true,
    maxlength: [100, "Full name cannot exceed 100 characters"],
  },
  age: {
    type: Number,
    required: [true, "Age is required"],
    min: [18, "Must be at least 18"],
    max: [100, "Invalid age"],
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true,
    lowercase: true,  // ✅ auto-converts "Male" → "male" before saving
  },
  username: {
    type: String,
    required: [true, "Username is required"],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, "Min 3 chars"],
    maxlength: [30, "Max 30 chars"],
  },
  preferredTravelType: {
    type: String,
    enum: ["adventure", "family", "honeymoon", "luxury", "budget", "nature"],
    default: "adventure",
  },
  // Keep phone, email, password as-is
  // Update address to simple String:
  address: {
    type: String,
    default: "",
    maxlength: [300, "Address too long"],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\S+@\S+\.\S+$/,
      'Please enter a valid email address',
    ],
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [
      /^[\d\s\-\+\(\)]{10,}$/,
      'Please enter a valid phone number',
    ],
  },

  // Authentication
  // NOTE: not `required` here — Google users start without a password.
  // The pre-save hook enforces it for local accounts.
  password: {
    type: String,
    minlength: [8, 'Password must be at least 8 characters'],
    select: false,
  },

  // Profile
  avatar: {
    type: String,
    default: null,
  },
  bio: {                          // ✅ add this
    type: String,
    default: '',
    maxlength: [500, 'Bio cannot exceed 500 characters'],
  },
  // Google OAuth completion tracking
  profileCompleted: {
    type: Boolean,
    default: false,
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local',
  },
  googleId: {
    type: String,
    default: null,
  },
  // True once a real password has been explicitly set (not a random placeholder)
  hasPassword: {
    type: Boolean,
    default: false,
  },
  // Account Status
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  isPhoneVerified: {
    type: Boolean,
    default: false,
  },

  // Account Deletion
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  deletionReason: {
    type: String,
    default: null,
  },

  // Security
  passwordChangedAt: {
    type: Date,
    default: null,
  },
  passwordResetToken: {
    type: String,
    default: null,
  },
  passwordResetExpires: {
    type: Date,
    default: null,
  },
  emailVerificationToken: {
    type: String,
    default: null,
  },
  emailVerificationExpires: {
    type: Date,
    default: null,
  },
  loginAttempts: {
    type: Number,
    default: 0,
  },
  lockUntil: {
    type: Number,
    default: null,
  },

  // Last Activity
  lastLoginAt: {
    type: Date,
    default: null,
  },
  lastLoginIp: {
    type: String,
    default: null,
  },

  // Login history — used to distinguish first-time vs returning users
  loginCount: {
    type: Number,
    default: 0,
  },

  // Preferences
  preferences: {
    newsletter: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true },
    currency: { type: String, default: 'INR' },
    language: { type: String, default: 'en' },
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for performance
userSchema.index({ phone: 1 });
userSchema.index({ isActive: 1, isDeleted: 1 });
userSchema.index({ createdAt: -1 });

// Virtual for full name


// Virtual for user's bookings
userSchema.virtual('bookings', {
  ref: 'Booking',
  localField: '_id',
  foreignField: 'user',
});

// Virtual for user's reviews
userSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'user',
});

// Virtual for user's saved items
userSchema.virtual('savedItems', {
  ref: 'SavedItem',
  localField: '_id',
  foreignField: 'user',
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Enforce password for local accounts — only on NEW documents being created.
  // When an existing user is loaded from DB (password field not selected)
  // and .save() is called, this.password is undefined — but that is fine
  // because the password already exists in the database.
  // Using this.isNew prevents false "Password is required" 500 errors.
  if (this.isNew && this.authProvider === 'local' && !this.password) {
    return next(new Error('Password is required for local accounts'));
  }

  // Only hash if password field was actually modified
  if (!this.isModified('password') || !this.password) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    // Mark that a real password is now set
    this.hasPassword = true;
    next();
  } catch (error) {
    next(error);
  }
});

// Update passwordChangedAt when password changes
userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000; // Subtract 1 second to ensure token is created after
  next();
});

// Soft delete middleware - filter out deleted users by default
userSchema.pre(/^find/, function (next) {
  // If explicitly querying for deleted users, don't filter
  if (this.getQuery().isDeleted === true) return next();

  this.find({ isDeleted: { $ne: true } });
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if password was changed after JWT token was issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Create password reset token
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// Create email verification token
userSchema.methods.createEmailVerificationToken = function () {
  const verifyToken = crypto.randomBytes(32).toString('hex');

  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verifyToken)
    .digest('hex');

  return verifyToken;
};

// Soft delete user account
userSchema.methods.softDelete = async function (reason) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletionReason = reason;
  this.isActive = false;
  this.email = `deleted_${this._id}_${this.email}`; // Preserve uniqueness
  this.phone = `deleted_${this._id}_${this.phone}`;

  await this.save({ validateBeforeSave: false });
};

// Check if account is locked
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incrementLoginAttempts = async function () {
  // Reset if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account after 5 failed attempts
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }

  return this.updateOne(updates);
};

module.exports = mongoose.model('User', userSchema);