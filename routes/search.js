/**
 * search.js — Combined Search Route
 * Base path: /api/v1/search
 *
 * GET /api/v1/search?q=shimla&limit=5
 * Returns both packages and hotels in one call.
 *
 * REGISTER in routes/index.js:
 *   const searchRoutes = require('./search');
 *   router.use('/v1/search', searchRoutes);
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { Package, Hotel } = require('../models');

const isDev = process.env.NODE_ENV !== 'production';

const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: isDev ? 600 : 60,
    keyGenerator: (req) => req.user?._id ? `user_${req.user._id}` : req.ip,
    message: { success: false, message: 'Too many search requests. Please slow down.', error: 'SEARCH_RATE_LIMIT' },
    standardHeaders: true, legacyHeaders: false,
});

/**
 * GET /api/v1/search?q=shimla&limit=5
 */
router.get('/', searchLimiter, asyncHandler(async (req, res) => {
    const { q, limit = 5 } = req.query;

    if (!q?.trim()) {
        throw new AppError('Search query is required', 400, 'SEARCH_QUERY_REQUIRED');
    }

    const cap = Math.min(parseInt(limit) || 5, 10);
    const query = q.trim();

    const [packages, hotels] = await Promise.all([
        Package.search(query).then(r => r.slice(0, cap)).catch(() => []),
        Hotel.search(query).then(r => r.slice(0, cap)).catch(() => []),
    ]);

    res.json({
        success: true,
        data: {
            query,
            packages: packages.map(p => ({
                id: p._id,
                title: p.title,
                location: p.location,
                category: p.category,
                duration: p.duration,
                price: p.price,
                rating: p.rating || 0,
                totalReviews: p.totalReviews || 0,
                coverImage: p.coverImage,
            })),
            hotels: hotels.map(h => ({
                id: h._id,
                name: h.name,
                location: h.location,
                basePrice: h.basePrice,
                rating: h.rating || 0,
                totalReviews: h.totalReviews || 0,
                coverImage: h.coverImage,
            })),
            total: packages.length + hotels.length,
        },
    });
}));

module.exports = router;
