const { Package } = require('../models');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

/**
 * Package Controller
 * Handles travel package listings and details
 */

// @desc    Get all packages
// @route   GET /api/packages
// @access  Public
const getPackages = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sortBy = 'rating',
    order = 'desc',
    category,
    minPrice,
    maxPrice,
    rating,
    duration,
    search,
  } = req.query;

  // Build query
  const query = { isActive: true };

  if (category) {
    query.category = category;
  }

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseInt(minPrice);
    if (maxPrice) query.price.$lte = parseInt(maxPrice);
  }

  if (rating) {
    query.rating = { $gte: parseFloat(rating) };
  }

  if (duration) {
    query.durationDays = { $lte: parseInt(duration) };
  }

  if (search) {
    query.$text = { $search: search };
  }

  // Build sort
  const sort = {};
  sort[sortBy] = order === 'asc' ? 1 : -1;

  // Execute query
  const packages = await Package.find(query)
    .sort(sort)
    .skip((parseInt(page) - 1) * parseInt(limit))
    .limit(parseInt(limit));

  const total = await Package.countDocuments(query);

  res.json({
    success: true,
    data: {
      packages: packages.map(pkg => ({
        id: pkg._id,
        title: pkg.title,
        description: pkg.shortDescription || pkg.description.substring(0, 200),
        category: pkg.category,
        location: pkg.location,
        coverImage: pkg.coverImage,
        price: pkg.price,
        originalPrice: pkg.originalPrice,
        discountPercentage: pkg.discountPercentage,
        duration: pkg.duration,
        durationDays: pkg.durationDays,
        groupSize: pkg.groupSize,
        rating: pkg.rating,
        totalReviews: pkg.totalReviews,
        highlights: pkg.highlights.slice(0, 4),
        inclusions: pkg.inclusions.slice(0, 4),
        isAvailable: pkg.isAvailable,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    },
  });
});

// @desc    Get single package
// @route   GET /api/packages/:id
// @access  Public
const getPackage = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const pkg = await Package.findById(id);

  if (!pkg) {
    throw new AppError('Package not found', 404, 'PACKAGE_NOT_FOUND');
  }

  res.json({
    success: true,
    data: {
      package: {
        id: pkg._id,
        title: pkg.title,
        description: pkg.description,
        shortDescription: pkg.shortDescription,
        category: pkg.category,
        tags: pkg.tags,
        location: pkg.location,
        destinations: pkg.destinations,
        images: pkg.images,
        coverImage: pkg.coverImage,
        price: pkg.price,
        originalPrice: pkg.originalPrice,
        childPrice: pkg.childPrice,
        discountPercentage: pkg.discountPercentage,
        duration: pkg.duration,
        durationDays: pkg.durationDays,
        groupSize: pkg.groupSize,
        maxGroupSize: pkg.maxGroupSize,
        minGroupSize: pkg.minGroupSize,
        rating: pkg.rating,
        totalReviews: pkg.totalReviews,
        highlights: pkg.highlights,
        inclusions: pkg.inclusions,
        exclusions: pkg.exclusions,
        itinerary: pkg.itinerary,
        bestTimeToVisit: pkg.bestTimeToVisit,
        policies: pkg.policies,
        isAvailable: pkg.isAvailable,
        availableSlots: pkg.availableSlots,
      },
    },
  });
});

// @desc    Get featured packages
// @route   GET /api/packages/featured
// @access  Public
const getFeaturedPackages = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 6;

  const packages = await Package.find({ isActive: true, isFeatured: true })
    .sort({ rating: -1 })
    .limit(limit);

  res.json({
    success: true,
    data: {
      packages: packages.map(pkg => ({
        id: pkg._id,
        title: pkg.title,
        shortDescription: pkg.shortDescription,
        category: pkg.category,
        location: pkg.location,
        coverImage: pkg.coverImage,
        price: pkg.price,
        originalPrice: pkg.originalPrice,
        discountPercentage: pkg.discountPercentage,
        duration: pkg.duration,
        rating: pkg.rating,
        totalReviews: pkg.totalReviews,
        highlights: pkg.highlights.slice(0, 3),
      })),
    },
  });
});

// @desc    Get packages by category
// @route   GET /api/packages/category/:category
// @access  Public
const getPackagesByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const validCategories = ['Adventure', 'Family', 'Romantic', 'Budget', 'Luxury', 'Honeymoon', 'Group', 'Solo'];

  if (!validCategories.includes(category)) {
    throw new AppError('Invalid category', 400, 'INVALID_CATEGORY');
  }

  const packages = await Package.find({ isActive: true, category })
    .sort({ rating: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await Package.countDocuments({ isActive: true, category });

  res.json({
    success: true,
    data: {
      packages: packages.map(pkg => ({
        id: pkg._id,
        title: pkg.title,
        shortDescription: pkg.shortDescription,
        location: pkg.location,
        coverImage: pkg.coverImage,
        price: pkg.price,
        duration: pkg.duration,
        rating: pkg.rating,
        totalReviews: pkg.totalReviews,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

// @desc    Search packages
// @route   GET /api/packages/search
// @access  Public
const searchPackages = asyncHandler(async (req, res) => {
  const { q, ...filters } = req.query;

  if (!q) {
    throw new AppError('Search query is required', 400, 'SEARCH_QUERY_REQUIRED');
  }

  const packages = await Package.search(q, filters);

  res.json({
    success: true,
    data: {
      packages: packages.map(pkg => ({
        id: pkg._id,
        title: pkg.title,
        shortDescription: pkg.shortDescription,
        category: pkg.category,
        location: pkg.location,
        coverImage: pkg.coverImage,
        price: pkg.price,
        duration: pkg.duration,
        rating: pkg.rating,
        totalReviews: pkg.totalReviews,
      })),
      total: packages.length,
    },
  });
});

// @desc    Check package availability
// @route   GET /api/packages/:id/availability
// @access  Public
const checkAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { date, travelers } = req.query;

  const pkg = await Package.findById(id);

  if (!pkg) {
    throw new AppError('Package not found', 404, 'PACKAGE_NOT_FOUND');
  }

  if (!date || !travelers) {
    throw new AppError('Date and travelers are required', 400, 'MISSING_PARAMS');
  }

  const travelDate = new Date(date);
  const isAvailable = await pkg.checkAvailability(travelDate, parseInt(travelers));

  res.json({
    success: true,
    data: {
      isAvailable,
      travelDate,
      travelers: parseInt(travelers),
      maxGroupSize: pkg.maxGroupSize,
    },
  });
});

// @desc    Create package (admin only)
// @route   POST /api/packages
// @access  Private (Admin)
const createPackage = asyncHandler(async (req, res) => {
  const packageData = req.body;
  packageData.createdBy = req.user._id;

  const pkg = await Package.create(packageData);

  logger.info(`Package created: ${pkg.title} by admin: ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: 'Package created successfully',
    data: { package: pkg },
  });
});

// @desc    Update package (admin only)
// @route   PUT /api/packages/:id
// @access  Private (Admin)
const updatePackage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const pkg = await Package.findByIdAndUpdate(
    id,
    updates,
    { new: true, runValidators: true }
  );

  if (!pkg) {
    throw new AppError('Package not found', 404, 'PACKAGE_NOT_FOUND');
  }

  logger.info(`Package updated: ${pkg.title} by admin: ${req.user.email}`);

  res.json({
    success: true,
    message: 'Package updated successfully',
    data: { package: pkg },
  });
});

// @desc    Delete package (admin only)
// @route   DELETE /api/packages/:id
// @access  Private (Admin)
const deletePackage = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const pkg = await Package.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true }
  );

  if (!pkg) {
    throw new AppError('Package not found', 404, 'PACKAGE_NOT_FOUND');
  }

  logger.info(`Package deactivated: ${pkg.title} by admin: ${req.user.email}`);

  res.json({
    success: true,
    message: 'Package deactivated successfully',
  });
});

module.exports = {
  getPackages,
  getPackage,
  getFeaturedPackages,
  getPackagesByCategory,
  searchPackages,
  checkAvailability,
  createPackage,
  updatePackage,
  deletePackage,
};
