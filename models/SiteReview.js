const mongoose = require('mongoose');

/**
 * SiteReview Schema
 * Stores general testimonial/review entries shown on the About page.
 *
 * KEY SEPARATION:
 *  - profilePicture : the reviewer's account avatar snapshot — visible to ALL users
 *  - tripImage      : optional trip photo uploaded with the review
 *  - likes          : array of userId strings — global, persistent, one-per-user
 */
const siteReviewSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  location: { type: String, required: true, trim: true, maxlength: 100 },
  trip: { type: String, required: true, trim: true, maxlength: 200 },
  story: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
  rating: { type: Number, required: true, min: 1, max: 5 },

  // Profile picture of the reviewer — snapshotted at submission time so it
  // renders correctly for ALL users regardless of who is currently logged in.
  profilePicture: { type: String, default: null },

  // Optional trip photo uploaded by the reviewer (base64 or URL).
  // Kept separate from profilePicture — displayed inside the card body.
  tripImage: { type: String, default: null },

  // Optional user linkage (if logged in)
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Helpful / Like system — array of userId strings.
  // Ensures global count and one-like-per-user enforcement.
  likes: { type: [String], default: [] },

  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
});

siteReviewSchema.index({ createdAt: -1 });
siteReviewSchema.index({ isActive: 1 });

module.exports = mongoose.model('SiteReview', siteReviewSchema);