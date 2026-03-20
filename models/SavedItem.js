const mongoose = require('mongoose');

const savedItemSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  itemId: {
    type: String,
    required: true,
  },
  itemType: {
    type: String,
    enum: ['hotel', 'package'],
    required: true,
  },
  itemSnapshot: {
    name: { type: String },
    location: { type: String },
    image: { type: String },
    price: { type: Number },
    rating: { type: Number },
    duration: { type: String },
  },
}, {
  timestamps: true,
});

// Unique per user + itemId — "hotel_1" and "package_1" are different
savedItemSchema.index({ user: 1, itemId: 1 }, { unique: true });
savedItemSchema.index({ user: 1, createdAt: -1 });
savedItemSchema.index({ itemType: 1 });

savedItemSchema.statics.clearAll = async function(userId) {
  const result = await this.deleteMany({ user: userId });
  return { deleted: result.deletedCount };
};

module.exports = mongoose.model('SavedItem', savedItemSchema);