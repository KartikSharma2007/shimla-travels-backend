// routes/upload.js
//
// All image upload routes
// Base path (register in routes/index.js): /api/v1/upload
//
// How to register — add these two lines to routes/index.js:
//   const uploadRoutes = require('./upload');
//   router.use('/v1/upload', uploadRoutes);

const express    = require('express');
const router     = express.Router();
const { protect, authorize } = require('../middleware');
const {
  uploadSingle,
  uploadMultiple,
  uploadFields,
} = require('../middleware/upload');
const {
  uploadHotelImages,
  uploadPackageImages,
  uploadAvatar,
  uploadAttractionImages,
  deleteUploadedImage,
  removeHotelImage,
} = require('../controllers/uploadController');

// ── User routes (any logged-in user) ─────────────────────────────────────────

// Upload profile avatar
// Field name: "avatar" | Type: single image
router.post(
  '/avatar',
  protect,
  uploadSingle('avatar', 'avatar'),
  uploadAvatar
);

// ── Admin-only routes ─────────────────────────────────────────────────────────
router.use(protect);
router.use(authorize('admin'));

// Upload hotel images
// Field name: "images" | Type: up to 10 images
// Optional body field: hotelId (auto-saves to hotel document)
router.post(
  '/hotel-images',
  uploadMultiple('images', 10, 'hotel'),
  uploadHotelImages
);

// Upload hotel cover image + gallery in one request
// Fields: "coverImage" (1 file) + "images" (up to 9 files)
router.post(
  '/hotel-images-full',
  uploadFields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'images',     maxCount: 9 },
  ], 'hotel'),
  uploadHotelImages
);

// Upload package images
// Field name: "images" | Type: up to 10 images
// Optional body field: packageId
router.post(
  '/package-images',
  uploadMultiple('images', 10, 'package'),
  uploadPackageImages
);

// Upload attraction / blog images
// Field name: "images" | Type: up to 10 images
router.post(
  '/attraction-images',
  uploadMultiple('images', 10, 'attraction'),
  uploadAttractionImages
);

// Delete a single image from Cloudinary
// Body: { imageUrl: "https://res.cloudinary.com/..." }
router.delete('/image', deleteUploadedImage);

// Remove a specific image from a hotel's images array + delete from Cloudinary
// Body: { hotelId, imageUrl }
router.delete('/hotel-image', removeHotelImage);

module.exports = router;
