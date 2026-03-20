const { Hotel } = require('../models');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

/**
 * Hotel Controller
 * Handles hotel listings and details
 */

// @desc    Get all hotels
// @route   GET /api/hotels
// @access  Public
const getHotels = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sortBy = 'rating',
    order = 'desc',
    minPrice,
    maxPrice,
    rating,
    amenities,
    location,
    search,
  } = req.query;

  // Build query
  const query = { isActive: true };

  if (minPrice || maxPrice) {
    query.basePrice = {};
    if (minPrice) query.basePrice.$gte = parseInt(minPrice);
    if (maxPrice) query.basePrice.$lte = parseInt(maxPrice);
  }

  if (rating) {
    query.rating = { $gte: parseFloat(rating) };
  }

  if (amenities) {
    const amenityList = amenities.split(',');
    query.amenities = { $in: amenityList };
  }

  if (location) {
    query.$or = [
      { 'location.city': { $regex: location, $options: 'i' } },
      { 'location.state': { $regex: location, $options: 'i' } },
    ];
  }

  if (search) {
    query.$text = { $search: search };
  }

  // Build sort
  const sort = {};
  sort[sortBy] = order === 'asc' ? 1 : -1;

  // Execute query
  const hotels = await Hotel.find(query)
    .sort(sort)
    .skip((parseInt(page) - 1) * parseInt(limit))
    .limit(parseInt(limit));

  const total = await Hotel.countDocuments(query);

  res.json({
    success: true,
    data: {
      hotels: hotels.map(hotel => ({
        id: hotel._id,
        name: hotel.name,
        description: hotel.shortDescription || hotel.description.substring(0, 200),
        location: hotel.location,
        images: hotel.images,
        coverImage: hotel.coverImage,
        basePrice: hotel.basePrice,
        averagePrice: hotel.averagePrice,
        rating: hotel.rating,
        totalReviews: hotel.totalReviews,
        amenities: hotel.amenities.slice(0, 6),
        starRating: hotel.starRating,
        roomTypes: hotel.roomTypes.map(room => ({
          type: room.type,
          price: room.price,
          features: room.features.slice(0, 3),
        })),
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

// @desc    Get single hotel
// @route   GET /api/hotels/:id
// @access  Public
const getHotel = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const hotel = await Hotel.findById(id);

  if (!hotel) {
    throw new AppError('Hotel not found', 404, 'HOTEL_NOT_FOUND');
  }

  res.json({
    success: true,
    data: {
      hotel: {
        id: hotel._id,
        name: hotel.name,
        description: hotel.description,
        shortDescription: hotel.shortDescription,
        location: hotel.location,
        images: hotel.images,
        coverImage: hotel.coverImage,
        basePrice: hotel.basePrice,
        averagePrice: hotel.averagePrice,
        rating: hotel.rating,
        totalReviews: hotel.totalReviews,
        amenities: hotel.amenities,
        starRating: hotel.starRating,
        checkInTime: hotel.checkInTime,
        checkOutTime: hotel.checkOutTime,
        roomTypes: hotel.roomTypes,
        nearby: hotel.nearby,
        policies: hotel.policies,
        contact: hotel.contact,
      },
    },
  });
});

// @desc    Get featured hotels
// @route   GET /api/hotels/featured
// @access  Public
const getFeaturedHotels = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 6;

  const hotels = await Hotel.find({ isActive: true, isFeatured: true })
    .sort({ rating: -1 })
    .limit(limit);

  res.json({
    success: true,
    data: {
      hotels: hotels.map(hotel => ({
        id: hotel._id,
        name: hotel.name,
        shortDescription: hotel.shortDescription,
        location: hotel.location,
        coverImage: hotel.coverImage,
        basePrice: hotel.basePrice,
        rating: hotel.rating,
        totalReviews: hotel.totalReviews,
        amenities: hotel.amenities.slice(0, 4),
      })),
    },
  });
});

// @desc    Search hotels
// @route   GET /api/hotels/search
// @access  Public
const searchHotels = asyncHandler(async (req, res) => {
  const { q, ...filters } = req.query;

  if (!q) {
    throw new AppError('Search query is required', 400, 'SEARCH_QUERY_REQUIRED');
  }

  const hotels = await Hotel.search(q, filters);

  res.json({
    success: true,
    data: {
      hotels: hotels.map(hotel => ({
        id: hotel._id,
        name: hotel.name,
        shortDescription: hotel.shortDescription,
        location: hotel.location,
        coverImage: hotel.coverImage,
        basePrice: hotel.basePrice,
        rating: hotel.rating,
        totalReviews: hotel.totalReviews,
      })),
      total: hotels.length,
    },
  });
});

// @desc    Create hotel (admin only)
// @route   POST /api/hotels
// @access  Private (Admin)
const createHotel = asyncHandler(async (req, res) => {
  const hotelData = req.body;
  hotelData.createdBy = req.user._id;

  const hotel = await Hotel.create(hotelData);

  logger.info(`Hotel created: ${hotel.name} by admin: ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: 'Hotel created successfully',
    data: { hotel },
  });
});

// @desc    Update hotel (admin only)
// @route   PUT /api/hotels/:id
// @access  Private (Admin)
const updateHotel = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const hotel = await Hotel.findByIdAndUpdate(
    id,
    updates,
    { new: true, runValidators: true }
  );

  if (!hotel) {
    throw new AppError('Hotel not found', 404, 'HOTEL_NOT_FOUND');
  }

  logger.info(`Hotel updated: ${hotel.name} by admin: ${req.user.email}`);

  res.json({
    success: true,
    message: 'Hotel updated successfully',
    data: { hotel },
  });
});

// @desc    Delete hotel (admin only)
// @route   DELETE /api/hotels/:id
// @access  Private (Admin)
const deleteHotel = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const hotel = await Hotel.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true }
  );

  if (!hotel) {
    throw new AppError('Hotel not found', 404, 'HOTEL_NOT_FOUND');
  }

  logger.info(`Hotel deactivated: ${hotel.name} by admin: ${req.user.email}`);

  res.json({
    success: true,
    message: 'Hotel deactivated successfully',
  });
});

module.exports = {
  getHotels,
  getHotel,
  getFeaturedHotels,
  searchHotels,
  createHotel,
  updateHotel,
  deleteHotel,
};
