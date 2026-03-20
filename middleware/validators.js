const { body, param, query, validationResult } = require('express-validator');
const { ValidationError } = require('./errorHandler');

/**
 * Validation Middleware
 * Input validation using express-validator
 */

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value,
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: 'VALIDATION_ERROR',
      errors: errorMessages,
    });
  }
  next();
};

// Auth Validators
const registerValidator = [
  body('fullName').trim().notEmpty().withMessage('Full name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('age').isInt({ min: 18, max: 100 }).withMessage('Must be 18 or older'),
  body('gender')
    .isIn(['male', 'female', 'other', 'Male', 'Female', 'Other'])
    .withMessage('Invalid gender'),
  body('username').trim().notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username: letters, numbers, underscores only'),
  body('preferredTravelType')
    .isIn(['adventure', 'family', 'honeymoon', 'luxury', 'budget', 'nature'])
    .withMessage('Invalid travel type'),
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('phone').trim().matches(/^[\d\s\-\+\(\)]{10,}$/)
    .withMessage('Valid phone number required'),
  body('password').isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  handleValidationErrors,
];

const loginValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email'),
  body('password')
    .notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

const updateProfileValidator = [
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[\d\s\-\+\(\)]{10,}$/).withMessage('Please enter a valid phone number'),
  body('age')
    .optional()
    .isInt({ min: 18, max: 120 }).withMessage('Age must be between 18 and 120'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other', 'Male', 'Female', 'Other'])
    .withMessage('Invalid gender'),
  handleValidationErrors,
];

const changePasswordValidator = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  handleValidationErrors,
];

const forgotPasswordValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail(),
  handleValidationErrors,
];

const resetPasswordValidator = [
  body('password')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  handleValidationErrors,
];

// Booking Validators
const createHotelBookingValidator = [
  body('hotelId').optional(),
  body('roomType').notEmpty().withMessage('Room type is required'),
  body('checkIn')
    .notEmpty().withMessage('Check-in date is required')
    .custom((value) => {
      if (!value || isNaN(new Date(value).getTime())) throw new Error('Invalid check-in date');
      return true;
    }),
  body('checkOut')
    .notEmpty().withMessage('Check-out date is required')
    .custom((value, { req }) => {
      if (!value || isNaN(new Date(value).getTime())) throw new Error('Invalid check-out date');
      if (new Date(value) <= new Date(req.body.checkIn)) throw new Error('Check-out must be after check-in');
      return true;
    }),
  body('guests.adults')
    .notEmpty().withMessage('Number of adults is required')
    .custom((value) => {
      const num = Number(value);
      if (isNaN(num) || num < 1 || num > 20) throw new Error('Adults must be between 1 and 20');
      return true;
    }),
  body('guests.children')
    .optional()
    .custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      const num = Number(value);
      if (isNaN(num) || num < 0 || num > 10) throw new Error('Children must be between 0 and 10');
      return true;
    }),
  body('rooms')
    .optional()
    .custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      const num = Number(value);
      if (isNaN(num) || num < 1 || num > 10) throw new Error('Rooms must be between 1 and 10');
      return true;
    }),
  body('contactInfo.fullName').notEmpty().withMessage('Full name is required'),
  body('contactInfo.email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email'),
  body('contactInfo.phone').notEmpty().withMessage('Phone is required'),
  handleValidationErrors,
];

const createPackageBookingValidator = [
  body('packageId').notEmpty().withMessage('Package ID is required'),
  body('travelDate')
    .notEmpty().withMessage('Travel date is required')
    .custom((value) => {
      if (!value || isNaN(new Date(value).getTime())) throw new Error('Invalid travel date');
      return true;
    }),
  body('pickupLocation')
    .optional()
    .isLength({ max: 200 }).withMessage('Pickup location must be under 200 characters'),
  body('guests.adults')
    .notEmpty().withMessage('Number of adults is required')
    .custom((value) => {
      const num = Number(value);
      if (isNaN(num) || num < 1 || num > 20) throw new Error('Adults must be between 1 and 20');
      return true;
    }),
  body('guests.children')
    .optional()
    .custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      const num = Number(value);
      if (isNaN(num) || num < 0 || num > 10) throw new Error('Children must be between 0 and 10');
      return true;
    }),
  body('contactInfo.fullName').notEmpty().withMessage('Full name is required'),
  body('contactInfo.email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email'),
  body('contactInfo.phone').notEmpty().withMessage('Phone is required'),
  handleValidationErrors,
];

// ✅ FIXED Review Validator
// Problem: body('rating').isInt() can fail when rating arrives as a JS number (not string)
// in express-validator v7. Using custom() validator handles both number and string types safely.
const createReviewValidator = [
  body('rating')
    .custom((value) => {
      const num = Number(value);
      if (value === undefined || value === null || value === '') {
        throw new Error('Rating is required');
      }
      if (isNaN(num) || num < 1 || num > 5) {
        throw new Error('Rating must be between 1 and 5');
      }
      return true;
    }),

  body('comment')
    .custom((value) => {
      if (!value || String(value).trim().length === 0) {
        throw new Error('Comment is required');
      }
      if (String(value).trim().length < 10) {
        throw new Error('Comment must be at least 10 characters');
      }
      if (String(value).length > 2000) {
        throw new Error('Comment cannot exceed 2000 characters');
      }
      return true;
    }),

  body('title')
    .optional()
    .custom((value) => {
      if (value !== undefined && value !== null && String(value).length > 100) {
        throw new Error('Title cannot exceed 100 characters');
      }
      return true;
    }),

  handleValidationErrors,
];

// Payment Validators
const verifyPaymentValidator = [
  body('razorpay_payment_id').notEmpty().withMessage('Payment ID is required'),
  body('razorpay_order_id').notEmpty().withMessage('Order ID is required'),
  body('razorpay_signature').notEmpty().withMessage('Signature is required'),
  handleValidationErrors,
];

// Support/Chat Validators
const supportMessageValidator = [
  body('message')
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 1, max: 500 }).withMessage('Message must be 1-500 characters'),
  handleValidationErrors,
];

// Pagination Validator
const paginationValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  handleValidationErrors,
];

// ID Parameter Validator
const idParamValidator = [
  param('id').isMongoId().withMessage('Invalid ID format'),
  handleValidationErrors,
];

module.exports = {
  handleValidationErrors,
  registerValidator,
  loginValidator,
  updateProfileValidator,
  changePasswordValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  createHotelBookingValidator,
  createPackageBookingValidator,
  createReviewValidator,
  verifyPaymentValidator,
  supportMessageValidator,
  paginationValidator,
  idParamValidator,
};
