const { SavedItem } = require('../models');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const getSavedItems = asyncHandler(async (req, res) => {
  const items = await SavedItem.find({ user: req.user._id }).sort({ createdAt: -1 });

  const hotels = items
    .filter(i => i.itemType === 'hotel')
    .map(i => ({
      id: i.itemId.replace('hotel_', ''),
      type: 'hotel',
      name: i.itemSnapshot?.name,
      image: i.itemSnapshot?.image,
      location: i.itemSnapshot?.location,
      price: i.itemSnapshot?.price,
      rating: i.itemSnapshot?.rating,
      savedAt: i.createdAt,
    }));

  const packages = items
    .filter(i => i.itemType === 'package')
    .map(i => ({
      id: i.itemId.replace('package_', ''),
      type: 'package',
      name: i.itemSnapshot?.name,
      image: i.itemSnapshot?.image,
      location: i.itemSnapshot?.location,
      price: i.itemSnapshot?.price,
      rating: i.itemSnapshot?.rating,
      duration: i.itemSnapshot?.duration,
      savedAt: i.createdAt,
    }));

  res.json({
    success: true,
    data: { hotels, packages, total: items.length },
  });
});

const addSavedItem = asyncHandler(async (req, res) => {
  const { itemId, itemType, name, image, location, price, rating, duration } = req.body;
  const userId = req.user._id;

  if (!['hotel', 'package'].includes(itemType)) {
    throw new AppError('Invalid item type', 400, 'INVALID_ITEM_TYPE');
  }

  if (!itemId) {
    throw new AppError('itemId is required', 400, 'MISSING_ITEM_ID');
  }

  const compositeId = String(itemId); // e.g. "hotel_1" or "package_3"

  const existing = await SavedItem.findOne({ user: userId, itemId: compositeId });
  if (existing) {
    throw new AppError('Item already in saved list', 409, 'ALREADY_SAVED');
  }

  const savedItem = await SavedItem.create({
    user: userId,
    itemId: compositeId,
    itemType,
    itemSnapshot: { name, image, location, price, rating, duration },
  });

  logger.info(`Item saved: ${compositeId} by user: ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: 'Item saved successfully',
    data: {
      savedItem: {
        id: savedItem._id,
        itemId: compositeId,
        itemType,
        savedAt: savedItem.createdAt,
      },
    },
  });
});

const removeSavedItem = asyncHandler(async (req, res) => {
  const { itemType, itemId } = req.params;
  const userId = req.user._id;

  if (!['hotel', 'package'].includes(itemType)) {
    throw new AppError('Invalid item type', 400, 'INVALID_ITEM_TYPE');
  }

  const savedItem = await SavedItem.findOne({
    user: userId,
    itemId: String(itemId),
  });

  if (!savedItem) {
    throw new AppError('Item not found in saved list', 404, 'ITEM_NOT_SAVED');
  }

  await savedItem.deleteOne();

  logger.info(`Item removed: ${itemId} by user: ${req.user.email}`);

  res.json({ success: true, message: 'Item removed from saved list' });
});

const clearAllSavedItems = asyncHandler(async (req, res) => {
  const result = await SavedItem.clearAll(req.user._id);
  logger.info(`All saved items cleared for user: ${req.user.email}`);
  res.json({
    success: true,
    message: 'All saved items removed',
    data: { deleted: result.deleted },
  });
});

module.exports = {
  getSavedItems,
  addSavedItem,
  removeSavedItem,
  clearAllSavedItems,
};