const logger = require('../utils/logger');

/**
 * Error Handler Middleware
 * Centralized error handling for the application
 */

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.errorCode = errorCode;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Not authorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

class PaymentError extends AppError {
  constructor(message = 'Payment processing failed') {
    super(message, 402, 'PAYMENT_ERROR');
  }
}

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log error
  logger.error({
    message: err.message,
    statusCode: err.statusCode,
    stack: err.stack,
    path: req.path,
    method: req.method,
    user: req.user ? req.user._id : null,
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      error: 'VALIDATION_ERROR',
      errors: messages,
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `${field} already exists`,
      error: 'DUPLICATE_FIELD',
      field,
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid ${err.path}: ${err.value}`,
      error: 'INVALID_ID',
    });
  }

  // Mongoose duplicate key error (more detailed)
  if (err.name === 'MongoServerError' && err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      success: false,
      message: `Duplicate value for ${field}`,
      error: 'DUPLICATE_VALUE',
      field,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: 'INVALID_TOKEN',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
      error: 'TOKEN_EXPIRED',
    });
  }

  // Razorpay errors
  if (err.name === 'RazorpayError') {
    return res.status(402).json({
      success: false,
      message: err.message || 'Payment processing failed',
      error: 'PAYMENT_ERROR',
    });
  }

  // AppError (custom operational errors)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: err.errorCode,
      ...(err.errors && { errors: err.errors }),
    });
  }

  // Production vs Development error response
  if (process.env.NODE_ENV === 'production') {
    // Don't leak error details in production
    return res.status(500).json({
      success: false,
      message: 'Something went wrong',
      error: 'INTERNAL_SERVER_ERROR',
    });
  } else {
    // Development error response with stack trace
    return res.status(500).json({
      success: false,
      message: err.message,
      error: 'INTERNAL_SERVER_ERROR',
      stack: err.stack,
    });
  }
};

// 404 handler for undefined routes
const notFound = (req, res, next) => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

// Async handler wrapper to catch errors
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  PaymentError,
  errorHandler,
  notFound,
  asyncHandler,
};
