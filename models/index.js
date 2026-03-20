/**
 * Models Index
 * Central export for all MongoDB models
 */

const User = require('./User');
const Hotel = require('./Hotel');
const Package = require('./Package');
const Review = require('./Review');
const Booking = require('./Booking');
const SavedItem = require('./SavedItem');
const SiteReview = require('./SiteReview');
const AuditLog = require('./AuditLog');

module.exports = {
  User,
  Hotel,
  Package,
  Review,
  Booking,
  SavedItem,
  SiteReview,
  AuditLog,
};