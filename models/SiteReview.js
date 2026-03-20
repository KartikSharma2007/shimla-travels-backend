const mongoose = require('mongoose');

/**
 * SiteReview Schema
 * Stores general testimonial/review entries shown on the About page.
 * These are distinct from hotel/package reviews — they're site-level testimonials.
 */
const siteReviewSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true, maxlength: 100 },
  location: { type: String, required: true, trim: true, maxlength: 100 },
  trip:     { type: String, required: true, trim: true, maxlength: 200 },
  story:    { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
  rating:   { type: Number, required: true, min: 1, max: 5 },
  image:    { type: String, default: null },

  // Optional user linkage (if logged in)
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
});

siteReviewSchema.index({ createdAt: -1 });
siteReviewSchema.index({ isActive: 1 });

module.exports = mongoose.model('SiteReview', siteReviewSchema);
