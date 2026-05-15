// middleware/upload.js
//
// Cloudinary image upload middleware using multer + cloudinary v2
//
// Install dependencies (run in Backend/ folder):
//   npm install cloudinary multer multer-storage-cloudinary
//
// Add these to your Backend/.env:
//   CLOUDINARY_CLOUD_NAME=your_cloud_name
//   CLOUDINARY_API_KEY=your_api_key
//   CLOUDINARY_API_SECRET=your_api_secret
//
// Get free credentials at: https://cloudinary.com (free tier = 25GB storage, 25GB bandwidth/month)
//
// Usage in any route:
//   const { uploadSingle, uploadMultiple, uploadFields } = require('../middleware/upload');
//
//   router.post('/hotel', protect, authorize('admin'), uploadMultiple('images', 5), handler);
//   router.put('/avatar', protect, uploadSingle('avatar'), handler);

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');
const logger = require('../utils/logger');

// ── Configure Cloudinary ──────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,   // always use https URLs
});

// Check if Cloudinary is configured (not needed during tests)
const cloudinaryConfigured =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name' &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

// ── Allowed file types ────────────────────────────────────────────────────────
const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;   // 5MB per file
const MAX_FILES = 10;                  // max files in a multi-upload

// ── File filter: only images allowed ─────────────────────────────────────────
const imageFileFilter = (req, file, cb) => {
  // Check extension only — mimetype is unreliable for avif/webp on some browsers
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');

  if (!ALLOWED_FORMATS.includes(ext)) {
    return cb(
      new Error(`Only image files are allowed (${ALLOWED_FORMATS.join(', ')})`),
      false
    );
  }
  cb(null, true);
};

// ─────────────────────────────────────────────────────────────────────────────
//  Storage factory
//  Creates a Cloudinary storage config for a specific folder and transformations.
//  Each upload type (hotel, package, avatar) gets its own folder + transforms.
//  Falls back to memory storage during tests (when Cloudinary isn't configured).
// ─────────────────────────────────────────────────────────────────────────────
const makeStorage = (folder, transformations = []) => {
  // Use memory storage during tests — no real uploads needed
  if (!cloudinaryConfigured) {
    return multer.memoryStorage();
  }

  return new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      // Build a unique public_id:  shimla-travels/hotels/1748123456789-random
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const publicId = `shimla-travels/${folder}/${timestamp}-${random}`;

      return {
        // Don't set folder separately — public_id already contains the full path
        public_id: publicId,
        allowed_formats: ALLOWED_FORMATS,
        transformation: transformations.length > 0 ? transformations : undefined,
        // quality: auto — Cloudinary picks the best quality/size balance
        quality: 'auto',
        fetch_format: 'auto',  // serve webp to browsers that support it
      };
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
//  Pre-built storage configs
// ─────────────────────────────────────────────────────────────────────────────

// Hotel images: resize to max 1200x800, maintain aspect ratio
const hotelStorage = makeStorage('hotels', [
  { width: 1200, height: 800, crop: 'limit', quality: 'auto' },
]);

// Package images: resize to max 1200x800
const packageStorage = makeStorage('packages', [
  { width: 1200, height: 800, crop: 'limit', quality: 'auto' },
]);

// Avatar / profile picture: crop to 400x400 circle
const avatarStorage = makeStorage('avatars', [
  { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' },
]);

// Attraction / blog images: resize to max 1400x900
const attractionStorage = makeStorage('attractions', [
  { width: 1400, height: 900, crop: 'limit', quality: 'auto' },
]);

// ─────────────────────────────────────────────────────────────────────────────
//  Multer upload instances — one per upload type
// ─────────────────────────────────────────────────────────────────────────────
const createUploader = (storage) =>
  multer({
    storage,
    fileFilter: imageFileFilter,
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: MAX_FILES,
    },
  });

const hotelUploader = createUploader(hotelStorage);
const packageUploader = createUploader(packageStorage);
const avatarUploader = createUploader(avatarStorage);
const attractionUploader = createUploader(attractionStorage);

// ─────────────────────────────────────────────────────────────────────────────
//  Middleware factory functions (used in route definitions)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a single file
 * @param {string} fieldName - form field name (e.g. 'avatar')
 * @param {'hotel'|'package'|'avatar'|'attraction'} type - which uploader to use
 */
const uploadSingle = (fieldName, type = 'hotel') => {
  const uploader = {
    hotel: hotelUploader,
    package: packageUploader,
    avatar: avatarUploader,
    attraction: attractionUploader,
  }[type] || hotelUploader;

  return (req, res, next) => {
    uploader.single(fieldName)(req, res, (err) => {
      if (err) return handleUploadError(err, res);
      next();
    });
  };
};

/**
 * Upload multiple files (same field name, e.g. multiple hotel photos)
 * @param {string} fieldName - form field name
 * @param {number} maxCount  - max number of files
 * @param {string} type      - uploader type
 */
const uploadMultiple = (fieldName, maxCount = 5, type = 'hotel') => {
  const uploader = {
    hotel: hotelUploader,
    package: packageUploader,
    avatar: avatarUploader,
    attraction: attractionUploader,
  }[type] || hotelUploader;

  return (req, res, next) => {
    uploader.array(fieldName, maxCount)(req, res, (err) => {
      if (err) return handleUploadError(err, res);
      next();
    });
  };
};

/**
 * Upload multiple fields (e.g. coverImage + images[])
 * @param {Array<{name: string, maxCount: number}>} fields
 * @param {string} type - uploader type
 */
const uploadFields = (fields, type = 'hotel') => {
  const uploader = {
    hotel: hotelUploader,
    package: packageUploader,
    avatar: avatarUploader,
    attraction: attractionUploader,
  }[type] || hotelUploader;

  return (req, res, next) => {
    uploader.fields(fields)(req, res, (err) => {
      if (err) return handleUploadError(err, res);
      next();
    });
  };
};

// ─────────────────────────────────────────────────────────────────────────────
//  Error handler for upload errors (file too large, wrong type, etc.)
// ─────────────────────────────────────────────────────────────────────────────
const handleUploadError = (err, res) => {
  logger.error(`Upload error: ${err.message}`);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        error: 'FILE_TOO_LARGE',
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: `Too many files. Maximum is ${MAX_FILES} files`,
        error: 'TOO_MANY_FILES',
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field name in upload',
        error: 'UNEXPECTED_FIELD',
      });
    }
  }

  return res.status(400).json({
    success: false,
    message: err.message || 'File upload failed',
    error: 'UPLOAD_ERROR',
  });
};

// ─────────────────────────────────────────────────────────────────────────────
//  Cloudinary utility functions (use these in your controllers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Delete an image from Cloudinary by its public_id
 * Call this when admin deletes a hotel, user changes avatar, etc.
 * @param {string} publicIdOrUrl - either the public_id or the full Cloudinary URL
 */
const deleteImage = async (publicIdOrUrl) => {
  // No-op in test environment or when Cloudinary isn't configured
  if (!cloudinaryConfigured) {
    logger.debug(`Cloudinary not configured — skipping delete for: ${publicIdOrUrl}`);
    return { result: 'ok' };
  }

  try {
    // Extract public_id from URL if a full URL was passed
    let publicId = publicIdOrUrl;
    if (publicIdOrUrl.includes('cloudinary.com')) {
      // URL format: .../shimla-travels/hotels/1748123456789-abc123.jpg
      // Extract: shimla-travels/hotels/1748123456789-abc123
      const parts = publicIdOrUrl.split('/');
      const filename = parts[parts.length - 1].replace(/\.[^.]+$/, ''); // remove extension
      const folder = parts.slice(parts.indexOf('shimla-travels')).slice(0, -1).join('/');
      publicId = `${folder}/${filename}`;
    }

    const result = await cloudinary.uploader.destroy(publicId);
    logger.info(`Cloudinary delete: ${publicId} → ${result.result}`);
    return result;
  } catch (err) {
    logger.error(`Cloudinary delete failed: ${err.message}`);
    throw err;
  }
};

/**
 * Delete multiple images from Cloudinary
 * @param {string[]} publicIdsOrUrls
 */
const deleteImages = async (publicIdsOrUrls) => {
  const results = await Promise.allSettled(
    publicIdsOrUrls.map(id => deleteImage(id))
  );
  return results;
};

/**
 * Get a secure, optimized URL for an image with on-the-fly transformations
 * @param {string} publicId
 * @param {object} options - Cloudinary transformation options
 */
const getOptimizedUrl = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    secure: true,
    quality: 'auto',
    fetch_format: 'auto',
    ...options,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
//  Extract Cloudinary URL from uploaded file(s)
//  Use in controllers after upload middleware runs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract Cloudinary URL from a multer file object.
 * multer-storage-cloudinary v4 + cloudinary v1 stores URL in:
 *   f.path OR f.secure_url OR f.url
 */
const getFileUrl = (f) => f.secure_url || f.path || f.url || null;

/**
 * Get the secure URL from req.file (single upload)
 */
const getUploadedUrl = (req) => {
  if (!req.file) return null;
  return getFileUrl(req.file);
};

/**
 * Get array of secure URLs from req.files (multiple upload)
 */
const getUploadedUrls = (req) => {
  if (!req.files) return [];
  if (Array.isArray(req.files)) return req.files.map(getFileUrl).filter(Boolean);
  // req.files is an object when using .fields()
  const urls = [];
  for (const field in req.files) {
    req.files[field].forEach(f => {
      const url = getFileUrl(f);
      if (url) urls.push(url);
    });
  }
  return urls;
};

module.exports = {
  // Middleware functions (use in routes)
  uploadSingle,
  uploadMultiple,
  uploadFields,

  // Cloudinary utilities (use in controllers)
  deleteImage,
  deleteImages,
  getOptimizedUrl,
  getUploadedUrl,
  getUploadedUrls,

  // Direct cloudinary access for custom operations
  cloudinary,
};
