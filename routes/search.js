/**
 * search.js — Global Search Route
 * Base path: /api/v1/search
 *
 * Returns combined results from packages AND hotels in one request,
 * which is what the HeroSection search bar uses (single API call).
 *
 * HOW TO REGISTER in routes/index.js:
 *   const searchRoutes = require('./search');
 *   router.use('/v1/search', searchRoutes);
 */

const express = require('express');
const router = express.Router();
const { Package } = require('../models');
const { Hotel } = require('../models');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const rateLimit = require('express-rate-limit');

// Relaxed limiter for search — users type-search in real time
const searchLimiter = rateLimit({
    windowMs: 60 * 1000,        // 1 minute
    max: process.env.NODE_ENV !== 'production' ? 500 : 60,
    keyGenerator: (req) => {
        if (req.user?._id) return `user_${req.user._id}`;
        return req.ip;
    },
    message: {
        success: false,
        message: 'Too many search requests. Please wait a moment.',
        error: 'SEARCH_RATE_LIMIT',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * GET /api/v1/search?q=shimla&limit=5
 *
 * Returns:
 *   { packages: [...], hotels: [...], total: N, query: "..." }
 */
router.get('/', searchLimiter, asyncHandler(async (req, res) => {
    const { q, limit = 5 } = req.query;

    if (!q || !q.trim()) {
        throw new AppError('Search query is required', 400, 'SEARCH_QUERY_REQUIRED');
    }

    const searchTerm = q.trim();
    const maxResults = Math.min(parseInt(limit) || 5, 10); // cap at 10

    // Run both searches in parallel
    const [packages, hotels] = await Promise.all([
        Package.search ? Package.search(searchTerm) : Package.find({
            $or: [
                { title: { $regex: searchTerm, $options: 'i' } },
                { shortDescription: { $regex: searchTerm, $options: 'i' } },
                { location: { $regex: searchTerm, $options: 'i' } },
                { category: { $regex: searchTerm, $options: 'i' } },
            ],
            isActive: true,
        }).limit(maxResults).lean(),

        Hotel.search ? Hotel.search(searchTerm) : Hotel.find({
            $or: [
                { name: { $regex: searchTerm, $options: 'i' } },
                { shortDescription: { $regex: searchTerm, $options: 'i' } },
                { location: { $regex: searchTerm, $options: 'i' } },
            ],
            isActive: true,
        }).limit(maxResults).lean(),
    ]);

    const mappedPackages = packages.slice(0, maxResults).map(pkg => ({
        id: pkg._id,
        title: pkg.title,
        shortDescription: pkg.shortDescription,
        category: pkg.category,
        location: pkg.location,
        coverImage: pkg.coverImage,
        price: pkg.price,
        duration: pkg.duration,
        rating: pkg.rating || 0,
        totalReviews: pkg.totalReviews || 0,
    }));

    const mappedHotels = hotels.slice(0, maxResults).map(hotel => ({
        id: hotel._id,
        name: hotel.name,
        shortDescription: hotel.shortDescription,
        location: hotel.location,
        coverImage: hotel.coverImage,
        basePrice: hotel.basePrice,
        rating: hotel.rating || 0,
        totalReviews: hotel.totalReviews || 0,
    }));

    res.json({
        success: true,
        data: {
            query: searchTerm,
            packages: mappedPackages,
            hotels: mappedHotels,
            total: mappedPackages.length + mappedHotels.length,
        },
    });
}));

module.exports = router;
