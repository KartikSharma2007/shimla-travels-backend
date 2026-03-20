const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Rate Limiting Middleware
 *
 * Development vs Production:
 *  - In development (NODE_ENV=development), limits are very high so normal
 *    browsing/testing never triggers 429 errors.
 *  - Localhost requests are skipped entirely in development.
 *  - In production, limits are strict to prevent abuse.
 */

const isDev = process.env.NODE_ENV !== 'production';

// Skip rate limiting for localhost in development
const skipLocalhost = (req) => {
  if (!isDev) return false;
  const ip = req.ip || req.connection?.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
};

// General API rate limiter — applied to ALL /api/* routes
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (isDev ? 2000 : 100),
  skip: skipLocalhost,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later',
    error: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(429).json(options.message);
  },
});

// Auth limiter — login, register, forgot-password
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 10,
  skip: skipLocalhost,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
    error: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(options.message);
  },
});

// Payment limiter
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 500 : 20,
  skip: skipLocalhost,
  message: {
    success: false,
    message: 'Too many payment attempts, please try again later',
    error: 'PAYMENT_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Payment rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(options.message);
  },
});

// Review limiter
const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 200 : 10,
  skip: skipLocalhost,
  message: {
    success: false,
    message: 'Too many reviews submitted, please try again later',
    error: 'REVIEW_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Review rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(options.message);
  },
});

// Sensitive operations limiter
const sensitiveOpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 500 : 5,
  skip: skipLocalhost,
  message: {
    success: false,
    message: 'Too many attempts for this sensitive operation',
    error: 'SENSITIVE_OP_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Sensitive op rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(options.message);
  },
});

// Chat limiter
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 200 : 30,
  skip: skipLocalhost,
  message: {
    success: false,
    message: 'Too many messages, please slow down',
    error: 'CHAT_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Chat rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(options.message);
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  paymentLimiter,
  reviewLimiter,
  sensitiveOpLimiter,
  chatLimiter,
};
