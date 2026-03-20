/**
 * Middleware Index
 * Central export for all middleware
 */

const auth = require('./auth');
const errorHandler = require('./errorHandler');
const validators = require('./validators');
const rateLimiter = require('./rateLimiter');

module.exports = {
  ...auth,
  ...errorHandler,
  ...validators,
  ...rateLimiter,
};
