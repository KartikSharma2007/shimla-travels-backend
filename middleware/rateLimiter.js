/**
 * rateLimiter.js  — Smart Rate Limiting Middleware
 *
 * Strategy:
 *  - Strict limits ONLY on auth (login/signup/password reset)
 *  - Relaxed limits on normal user actions (profile, bookings, reviews)
 *  - User-ID-based limiting for authenticated routes (not just IP)
 *  - Friendly error messages with retry-after information
 *  - Generous development limits; secure production limits
 *  - Skip localhost in development so local testing never gets blocked
 */

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

const isDev = process.env.NODE_ENV !== 'production';

// ─── Helper: skip localhost in development ────────────────────────────────────
const skipLocalhost = (req) => {
  if (!isDev) return false;
  const ip = req.ip || req.connection?.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
};

// ─── Helper: key generator — use userId when available, fall back to IP ───────
// This prevents innocent users sharing a NAT/office IP from blocking each other.
const userOrIpKey = (req) => {
  // req.user is set by the protect middleware for authenticated routes
  if (req.user && (req.user._id || req.user.id)) {
    return `user_${req.user._id || req.user.id}`;
  }
  return req.ip;
};

// ─── Helper: friendly retry message ──────────────────────────────────────────
const buildMessage = (action, windowMinutes) => ({
  success: false,
  message: `Too many ${action} attempts. Please wait ${windowMinutes} minute${windowMinutes > 1 ? 's' : ''} and try again.`,
  retryAfter: `${windowMinutes} minute${windowMinutes > 1 ? 's' : ''}`,
  error: 'RATE_LIMIT_EXCEEDED',
});

// ─────────────────────────────────────────────────────────────────────────────
//  1. GLOBAL API LIMITER  (applied to all /api/* routes)
//     Generous — prevents scraping/DoS without affecting real users.
//     Production: 300 req / 15 min per IP  (20 req/min average — very comfortable)
// ─────────────────────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,                    // 15 minutes
  max: isDev ? 5000 : 300,                      // 300 in production (was 100 — too strict)
  skip: skipLocalhost,
  standardHeaders: true,
  legacyHeaders: false,
  message: buildMessage('API', 15),
  handler: (req, res, _next, options) => {
    logger.warn(`[apiLimiter] IP=${req.ip} PATH=${req.path}`);
    res.status(429).json(options.message);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
//  2. AUTH LIMITER  (login, register, google login, forgot-password)
//     Strict — these are the only endpoints that need real brute-force protection.
//     Production: 20 attempts / 15 min per IP
//     skipSuccessfulRequests: true — successful logins don't count toward limit
// ─────────────────────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 500 : 20,                        // 20 in production (was 10 — too strict for users)
  skip: skipLocalhost,
  skipSuccessfulRequests: true,                 // only count FAILED attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: buildMessage('login/signup', 15),
  handler: (req, res, _next, options) => {
    logger.warn(`[authLimiter] IP=${req.ip} PATH=${req.path}`);
    res.status(429).json(options.message);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
//  3. PROFILE UPDATE LIMITER  (PUT /auth/profile, avatar uploads, preferences)
//     Relaxed — users legitimately edit their profile multiple times per session.
//     Production: 60 updates / 15 min per user (or IP if not authenticated)
// ─────────────────────────────────────────────────────────────────────────────
const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 60,                       // 4 updates/min average — comfortable
  skip: skipLocalhost,
  keyGenerator: userOrIpKey,                    // per-user, not per-IP
  standardHeaders: true,
  legacyHeaders: false,
  message: buildMessage('profile update', 15),
  handler: (req, res, _next, options) => {
    logger.warn(`[profileLimiter] KEY=${userOrIpKey(req)} PATH=${req.path}`);
    res.status(429).json(options.message);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
//  4. BOOKING LIMITER
//     Production: 30 bookings / 60 min per user
//     Real users won't make 30 bookings in an hour; bots/scripts will.
// ─────────────────────────────────────────────────────────────────────────────
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 500 : 30,                        // was missing — added protection
  skip: skipLocalhost,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: buildMessage('booking', 60),
  handler: (req, res, _next, options) => {
    logger.warn(`[bookingLimiter] KEY=${userOrIpKey(req)} PATH=${req.path}`);
    res.status(429).json(options.message);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
//  5. PAYMENT LIMITER
//     Moderate — payment failures happen; users retry legitimately.
//     Production: 30 payment attempts / 60 min per user
// ─────────────────────────────────────────────────────────────────────────────
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 500 : 30,                        // 30 (was 20 — users retry on failure)
  skip: skipLocalhost,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: buildMessage('payment', 60),
  handler: (req, res, _next, options) => {
    logger.warn(`[paymentLimiter] KEY=${userOrIpKey(req)} PATH=${req.path}`);
    res.status(429).json(options.message);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
//  6. REVIEW LIMITER
//     Production: 20 reviews / 60 min per user
// ─────────────────────────────────────────────────────────────────────────────
const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 300 : 20,                        // 20 (was 10 — too strict)
  skip: skipLocalhost,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: buildMessage('review submission', 60),
  handler: (req, res, _next, options) => {
    logger.warn(`[reviewLimiter] KEY=${userOrIpKey(req)} PATH=${req.path}`);
    res.status(429).json(options.message);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
//  7. SENSITIVE OPERATIONS LIMITER  (account deletion, password reset)
//     Strict — these are irreversible or security-critical actions.
//     Production: 10 attempts / 60 min per user
// ─────────────────────────────────────────────────────────────────────────────
const sensitiveOpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 200 : 10,                        // 10 (was 5 — users legitimately retry)
  skip: skipLocalhost,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: buildMessage('sensitive operation', 60),
  handler: (req, res, _next, options) => {
    logger.warn(`[sensitiveOpLimiter] KEY=${userOrIpKey(req)} PATH=${req.path}`);
    res.status(429).json(options.message);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
//  8. CHAT LIMITER
//     Production: 60 messages / min per user (1/sec average)
// ─────────────────────────────────────────────────────────────────────────────
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 300 : 60,                        // 60/min (was 30 — too low for chat)
  skip: skipLocalhost,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: buildMessage('chat message', 1),
  handler: (req, res, _next, options) => {
    logger.warn(`[chatLimiter] KEY=${userOrIpKey(req)}`);
    res.status(429).json(options.message);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
//  9. FORM SUBMISSION LIMITER  (contact forms, support tickets)
//     Production: 15 submissions / 30 min per user/IP
// ─────────────────────────────────────────────────────────────────────────────
const formLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: isDev ? 200 : 15,
  skip: skipLocalhost,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: buildMessage('form submission', 30),
  handler: (req, res, _next, options) => {
    logger.warn(`[formLimiter] KEY=${userOrIpKey(req)} PATH=${req.path}`);
    res.status(429).json(options.message);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
//  10. FILE UPLOAD LIMITER
//      Production: 20 uploads / 60 min per user
// ─────────────────────────────────────────────────────────────────────────────
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 200 : 20,
  skip: skipLocalhost,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: buildMessage('file upload', 60),
  handler: (req, res, _next, options) => {
    logger.warn(`[uploadLimiter] KEY=${userOrIpKey(req)} PATH=${req.path}`);
    res.status(429).json(options.message);
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  profileLimiter,
  bookingLimiter,
  paymentLimiter,
  reviewLimiter,
  sensitiveOpLimiter,
  chatLimiter,
  formLimiter,
  uploadLimiter,
};
