// controllers/uploadController.js
//
// Handles all image upload endpoints:
//   POST /api/v1/upload/hotel-images        → upload hotel photos (admin only)
//   POST /api/v1/upload/package-images      → upload package photos (admin only)
//   POST /api/v1/upload/avatar              → upload user profile picture
//   POST /api/v1/upload/attraction-images   → upload attraction photos (admin only)
//   DELETE /api/v1/upload/image             → delete an image by URL (admin only)
//
// After upload, the controller returns the Cloudinary URLs.
// You then save those URLs into your Hotel/Package/User model as needed.

const { asyncHandler, AppError } = require('../middleware/errorHandler');
const {
  deleteImage,
  getUploadedUrl,
  getUploadedUrls,
} = require('../middleware/upload');
const { Hotel, Package, User } = require('../models');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Upload hotel images (admin only)
// @route   POST /api/v1/upload/hotel-images
// @access  Private/Admin
// @body    multipart/form-data — field: "images" (up to 10 files)
//          optionally: hotelId (to auto-update the hotel document)
// ─────────────────────────────────────────────────────────────────────────────
const uploadHotelImages = asyncHandler(async (req, res) => {
  const urls = getUploadedUrls(req);

  if (!urls.length) {
    throw new AppError('No images uploaded', 400, 'NO_FILES');
  }

  logger.info(`Admin ${req.user._id} uploaded ${urls.length} hotel image(s)`);

  // If a hotelId was provided, update the hotel document immediately
  if (req.body.hotelId) {
    logger.info(`Saving images to hotel ${req.body.hotelId}: ${JSON.stringify(urls)}`);
    const hotel = await Hotel.findById(req.body.hotelId);
    if (!hotel) throw new AppError('Hotel not found', 404, 'HOTEL_NOT_FOUND');

    // Clean nulls + duplicates, then add new URLs (addToSet prevents duplicates)
    await Hotel.findByIdAndUpdate(req.body.hotelId, {
      $pull: { images: null }
    });

    // $addToSet with $each prevents same URL being stored twice
    const pushQuery = { $addToSet: { images: { $each: urls } } };
    if (!hotel.coverImage) pushQuery.$set = { coverImage: urls[0] };
    await Hotel.findByIdAndUpdate(req.body.hotelId, pushQuery, { new: true });
    const updated = await Hotel.findById(req.body.hotelId).lean();
    logger.info(`Hotel ${req.body.hotelId} now has ${updated.images.length} images`);

    return res.status(200).json({
      success: true,
      message: `${urls.length} image(s) uploaded and saved to hotel`,
      data: {
        urls,
        coverImage: updated.coverImage,
        totalImages: updated.images.length,
      },
    });
  }

  // Otherwise just return the URLs — caller saves them manually
  res.status(200).json({
    success: true,
    message: `${urls.length} image(s) uploaded successfully`,
    data: { urls },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Upload package images (admin only)
// @route   POST /api/v1/upload/package-images
// @access  Private/Admin
// @body    multipart/form-data — field: "images" (up to 10 files)
//          optionally: packageId
// ─────────────────────────────────────────────────────────────────────────────
const uploadPackageImages = asyncHandler(async (req, res) => {
  const urls = getUploadedUrls(req);

  if (!urls.length) {
    throw new AppError('No images uploaded', 400, 'NO_FILES');
  }

  logger.info(`Admin ${req.user._id} uploaded ${urls.length} package image(s)`);

  if (req.body.packageId) {
    const pkg = await Package.findById(req.body.packageId);
    if (!pkg) throw new AppError('Package not found', 404, 'PACKAGE_NOT_FOUND');

    if (!pkg.coverImage) pkg.coverImage = urls[0];
    pkg.images.push(...urls);
    await pkg.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: `${urls.length} image(s) uploaded and saved to package`,
      data: {
        urls,
        coverImage: pkg.coverImage,
        totalImages: pkg.images.length,
      },
    });
  }

  res.status(200).json({
    success: true,
    message: `${urls.length} image(s) uploaded successfully`,
    data: { urls },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Upload user avatar / profile picture
// @route   POST /api/v1/upload/avatar
// @access  Private (any logged-in user)
// @body    multipart/form-data — field: "avatar" (single file)
// ─────────────────────────────────────────────────────────────────────────────
const uploadAvatar = asyncHandler(async (req, res) => {
  const newAvatarUrl = getUploadedUrl(req);

  if (!newAvatarUrl) {
    throw new AppError('No image uploaded', 400, 'NO_FILE');
  }

  // Delete the old avatar from Cloudinary (saves storage quota)
  const user = await User.findById(req.user._id);
  if (user.profilePicture && user.profilePicture.includes('cloudinary.com')) {
    try {
      await deleteImage(user.profilePicture);
    } catch (err) {
      // Non-critical — old image delete failure shouldn't block the update
      logger.warn(`Failed to delete old avatar: ${err.message}`);
    }
  }

  // Save new avatar URL
  user.profilePicture = newAvatarUrl;
  await user.save({ validateBeforeSave: false });

  logger.info(`User ${user._id} updated profile picture`);

  res.status(200).json({
    success: true,
    message: 'Profile picture updated successfully',
    data: {
      profilePicture: newAvatarUrl,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Upload attraction / blog images (admin only)
// @route   POST /api/v1/upload/attraction-images
// @access  Private/Admin
// @body    multipart/form-data — field: "images" (up to 10 files)
// ─────────────────────────────────────────────────────────────────────────────
const uploadAttractionImages = asyncHandler(async (req, res) => {
  const urls = getUploadedUrls(req);

  if (!urls.length) {
    throw new AppError('No images uploaded', 400, 'NO_FILES');
  }

  logger.info(`Admin ${req.user._id} uploaded ${urls.length} attraction image(s)`);

  res.status(200).json({
    success: true,
    message: `${urls.length} image(s) uploaded successfully`,
    data: { urls },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete an image from Cloudinary (admin only)
// @route   DELETE /api/v1/upload/image
// @access  Private/Admin
// @body    { imageUrl: "https://res.cloudinary.com/..." }
// ─────────────────────────────────────────────────────────────────────────────
const deleteUploadedImage = asyncHandler(async (req, res) => {
  const { imageUrl } = req.body;

  if (!imageUrl) {
    throw new AppError('imageUrl is required', 400, 'MISSING_URL');
  }

  // Safety check: only delete our own Cloudinary images
  if (!imageUrl.includes('cloudinary.com')) {
    throw new AppError('Only Cloudinary images can be deleted via this endpoint', 400, 'INVALID_URL');
  }

  const result = await deleteImage(imageUrl);
  logger.info(`Admin ${req.user._id} deleted image: ${imageUrl}`);

  res.status(200).json({
    success: true,
    message: 'Image deleted successfully',
    data: { result: result.result },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Remove a specific image from a hotel's images array
// @route   DELETE /api/v1/upload/hotel-image
// @access  Private/Admin
// @body    { hotelId, imageUrl }
// ─────────────────────────────────────────────────────────────────────────────
const removeHotelImage = asyncHandler(async (req, res) => {
  const { hotelId, imageUrl } = req.body;

  if (!hotelId || !imageUrl) {
    throw new AppError('hotelId and imageUrl are required', 400, 'MISSING_FIELDS');
  }

  const hotel = await Hotel.findById(hotelId);
  if (!hotel) throw new AppError('Hotel not found', 404, 'HOTEL_NOT_FOUND');

  // Remove from DB array
  hotel.images = hotel.images.filter(img => img !== imageUrl);

  // If removed image was the cover, set next available as cover
  if (hotel.coverImage === imageUrl) {
    hotel.coverImage = hotel.images[0] || '';
  }

  await hotel.save({ validateBeforeSave: false });

  // Delete from Cloudinary
  if (imageUrl.includes('cloudinary.com')) {
    await deleteImage(imageUrl).catch(err =>
      logger.warn(`Could not delete image from Cloudinary: ${err.message}`)
    );
  }

  res.status(200).json({
    success: true,
    message: 'Image removed from hotel',
    data: {
      remainingImages: hotel.images,
      coverImage: hotel.coverImage,
    },
  });
});

module.exports = {
  uploadHotelImages,
  uploadPackageImages,
  uploadAvatar,
  uploadAttractionImages,
  deleteUploadedImage,
  removeHotelImage,
};
