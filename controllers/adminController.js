const mongoose = require('mongoose');
const { User, Booking, Review, Hotel, Package, SiteReview, AuditLog } = require('../models');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');


// ── Audit log helper — call after every admin action ──────────────────────
const logAdminAction = async (req, action, targetType, targetId, details = {}) => {
  try {
    await AuditLog.create({
      adminId: req.user._id,
      adminEmail: req.user.email,
      action, targetType,
      targetId: targetId ? String(targetId) : undefined,
      details,
      ip: req.ip,
    });
  } catch (err) {
    logger.error(`Audit log failed for ${action}: ${err.message}`);
  }
};

/**
 * Admin Controller
 * All routes require: protect + authorize('admin')
 */

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD STATS
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Get dashboard overview stats
// @route   GET /api/admin/stats
const getDashboardStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    newUsersToday,
    totalBookings,
    bookingsToday,
    bookingsThisMonth,
    pendingBookings,
    confirmedBookings,
    cancelledBookings,
    completedBookings,
    revenueData,
    revenueToday,
    revenueThisMonth,
    totalReviews,
    totalHotels,
    totalPackages,
    recentBookings,
    recentUsers,
  ] = await Promise.all([
    User.countDocuments({ isActive: true }),
    User.countDocuments({ createdAt: { $gte: todayStart } }),
    Booking.countDocuments(),
    Booking.countDocuments({ createdAt: { $gte: todayStart } }),
    Booking.countDocuments({ createdAt: { $gte: monthStart } }),
    Booking.countDocuments({ status: 'upcoming' }),
    Booking.countDocuments({ status: 'confirmed' }),
    Booking.countDocuments({ status: 'cancelled' }),
    Booking.countDocuments({ status: 'completed' }),
    Booking.aggregate([
      { $match: { 'payment.status': 'completed' } },
      { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } },
    ]),
    Booking.aggregate([
      { $match: { 'payment.status': 'completed', createdAt: { $gte: todayStart } } },
      { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } },
    ]),
    Booking.aggregate([
      { $match: { 'payment.status': 'completed', createdAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } },
    ]),
    Review.countDocuments({ isActive: true }),
    Hotel.countDocuments({ isActive: true }),
    Package.countDocuments({ isActive: true }),
    Booking.find()
      .populate('user', 'fullName email username')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('fullName email username createdAt authProvider')
      .lean(),
  ]);

  // Monthly booking trend (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const monthlyTrend = await Booking.aggregate([
    { $match: { createdAt: { $gte: sixMonthsAgo } } },
    {
      $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        count: { $sum: 1 },
        revenue: { $sum: { $cond: [{ $eq: ['$payment.status', 'completed'] }, '$pricing.totalAmount', 0] } },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  res.json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        newToday: newUsersToday,
        recent: recentUsers,
      },
      bookings: {
        total: totalBookings,
        today: bookingsToday,
        thisMonth: bookingsThisMonth,
        pending: pendingBookings,
        confirmed: confirmedBookings,
        cancelled: cancelledBookings,
        completed: completedBookings,
        recent: recentBookings,
      },
      revenue: {
        total: revenueData[0]?.total || 0,
        today: revenueToday[0]?.total || 0,
        thisMonth: revenueThisMonth[0]?.total || 0,
      },
      content: {
        reviews: totalReviews,
        hotels: totalHotels,
        packages: totalPackages,
      },
      monthlyTrend,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOKINGS MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// ── Admin-level auto-complete: update all expired bookings across all users ─
const autoCompleteAllExpiredBookings = async () => {
  try {
    const now = new Date();
    const r1 = await Booking.updateMany(
      { bookingType: 'hotel', status: { $in: ['upcoming', 'confirmed'] }, 'payment.status': 'completed', checkOut: { $lt: now } },
      { $set: { status: 'completed' } }
    );
    const r2 = await Booking.updateMany(
      { bookingType: 'package', status: { $in: ['upcoming', 'confirmed'] }, 'payment.status': 'completed', travelDate: { $lt: now } },
      { $set: { status: 'completed' } }
    );
    if (r1.modifiedCount + r2.modifiedCount > 0)
      logger.info(`Auto-completed ${r1.modifiedCount + r2.modifiedCount} expired booking(s)`);
  } catch (err) {
    logger.error(`Admin autoComplete failed: ${err.message}`);
  }
};

// @desc    Get all bookings (paginated, filterable)
// @route   GET /api/admin/bookings
const getAllBookings = asyncHandler(async (req, res) => {
  await autoCompleteAllExpiredBookings();
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const status = req.query.status;
  const type = req.query.type;
  const search = req.query.search;

  const query = {};
  if (status) query.status = status;
  if (type) query.bookingType = type;

  // Search by booking reference
  if (search) {
    query.$or = [
      { bookingReference: { $regex: search, $options: 'i' } },
      { hotelName: { $regex: search, $options: 'i' } },
      { packageTitle: { $regex: search, $options: 'i' } },
    ];
  }

  const bookings = await Booking.find(query)
    .populate('user', 'fullName email phone username')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await Booking.countDocuments(query);

  res.json({
    success: true,
    data: {
      bookings,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

// @desc    Get single booking detail
// @route   GET /api/admin/bookings/:id
const getBookingDetail = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('user', 'fullName email phone createdAt');

  if (!booking) throw new AppError('Booking not found', 404, 'NOT_FOUND');

  res.json({ success: true, data: { booking } });
});

// @desc    Confirm a booking
// @route   PUT /api/admin/bookings/:id/confirm
const confirmBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404, 'NOT_FOUND');

  if (booking.status === 'cancelled') {
    throw new AppError('Cannot confirm a cancelled booking', 400, 'INVALID_STATUS');
  }

  booking.status = 'confirmed';
  booking.confirmedAt = new Date();
  booking.confirmedBy = req.user._id;
  if (req.body.adminNotes) booking.adminNotes = req.body.adminNotes;
  await booking.save({ validateBeforeSave: false });

  logger.info(`Admin ${req.user.email} confirmed booking ${booking.bookingReference}`);
  await logAdminAction(req, 'CONFIRM_BOOKING', 'Booking', booking._id, { ref: booking.bookingReference });

  res.json({
    success: true,
    message: `Booking ${booking.bookingReference} confirmed`,
    data: { booking },
  });
});

// @desc    Cancel a booking (admin)
// @route   PUT /api/admin/bookings/:id/cancel
const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404, 'NOT_FOUND');

  if (booking.status === 'cancelled') {
    throw new AppError('Booking is already cancelled', 400, 'ALREADY_CANCELLED');
  }

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancellationReason = req.body.reason || 'Cancelled by admin';
  booking.cancelledBy = 'admin';
  if (req.body.adminNotes) booking.adminNotes = req.body.adminNotes;
  await booking.save({ validateBeforeSave: false });

  logger.info(`Admin ${req.user.email} cancelled booking ${booking.bookingReference}`);
  await logAdminAction(req, 'CANCEL_BOOKING', 'Booking', booking._id, { ref: booking.bookingReference, reason: req.body.reason });

  res.json({
    success: true,
    message: `Booking ${booking.bookingReference} cancelled`,
    data: { booking },
  });
});

// @desc    Update admin notes on a booking
// @route   PUT /api/admin/bookings/:id/notes
const updateBookingNotes = asyncHandler(async (req, res) => {
  const booking = await Booking.findByIdAndUpdate(
    req.params.id,
    { adminNotes: req.body.adminNotes },
    { new: true }
  );
  if (!booking) throw new AppError('Booking not found', 404, 'NOT_FOUND');

  res.json({ success: true, message: 'Notes updated', data: { booking } });
});

// ─────────────────────────────────────────────────────────────────────────────
// USERS MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Get all users
// @route   GET /api/admin/users
const getAllUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const search = req.query.search;

  const query = {};
  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const users = await User.find(query)
    .select('-password -resetPasswordToken -resetPasswordExpire')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  // Add booking count — single aggregate query (avoids N+1)
  const bookingCounts = await Booking.aggregate([
    { $group: { _id: '$user', count: { $sum: 1 } } }
  ]);
  const countMap = {};
  bookingCounts.forEach(b => { countMap[String(b._id)] = b.count; });
  const usersWithStats = users.map(u => ({
    ...u,
    bookingCount: countMap[String(u._id)] || 0,
  }));

  const total = await User.countDocuments(query);

  res.json({
    success: true,
    data: {
      users: usersWithStats,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

// @desc    Get single user detail with their bookings
// @route   GET /api/admin/users/:id
const getUserDetail = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('-password -resetPasswordToken -resetPasswordExpire');
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

  const bookings = await Booking.find({ user: req.params.id })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  res.json({ success: true, data: { user, bookings } });
});

// @desc    Ban / deactivate a user
// @route   PUT /api/admin/users/:id/ban
const banUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

  if (user.role === 'admin') {
    throw new AppError('Cannot ban an admin account', 403, 'FORBIDDEN');
  }

  user.isActive = false;
  await user.save({ validateBeforeSave: false });

  logger.info(`Admin ${req.user.email} banned user ${user.email}`);
  await logAdminAction(req, 'BAN_USER', 'User', user._id, { email: user.email, fullName: user.fullName });

  res.json({ success: true, message: `User ${user.email} has been deactivated` });
});

// @desc    Unban / reactivate a user
// @route   PUT /api/admin/users/:id/unban
const unbanUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

  user.isActive = true;
  await user.save({ validateBeforeSave: false });

  logger.info(`Admin ${req.user.email} reactivated user ${user.email}`);
  await logAdminAction(req, 'UNBAN_USER', 'User', user._id, { email: user.email });

  res.json({ success: true, message: `User ${user.email} has been reactivated` });
});

// ─────────────────────────────────────────────────────────────────────────────
// REVIEWS MODERATION
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Get all site reviews (About page)
// @route   GET /api/admin/reviews/site
const getAllSiteReviews = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const reviews = await SiteReview.find()
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await SiteReview.countDocuments();

  res.json({
    success: true,
    data: { reviews, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
  });
});

// @desc    Get all hotel/package reviews
// @route   GET /api/admin/reviews
const getAllReviews = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const flagged = req.query.flagged === 'true';

  const query = {};
  if (flagged) query.isFlagged = true;
  // ✅ FIX: Support filtering by reviewType ('hotel' or 'package') from admin panel
  if (req.query.reviewType && ['hotel', 'package'].includes(req.query.reviewType)) {
    query.reviewType = req.query.reviewType;
  }

  const reviews = await Review.find(query)
    .populate('user', 'fullName email username')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await Review.countDocuments(query);

  res.json({
    success: true,
    data: { reviews, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
  });
});

// @desc    Delete a review (hotel/package)
// @route   DELETE /api/admin/reviews/:id
const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND');

  await review.deleteOne();
  logger.info(`Admin ${req.user.email} deleted review ${req.params.id}`);
  await logAdminAction(req, 'DELETE_REVIEW', 'Review', req.params.id, {});

  res.json({ success: true, message: 'Review deleted' });
});

// @desc    Delete a site review (About page)
// @route   DELETE /api/admin/reviews/site/:id
const deleteSiteReview = asyncHandler(async (req, res) => {
  const review = await SiteReview.findById(req.params.id);
  if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND');

  await review.deleteOne();
  logger.info(`Admin ${req.user.email} deleted site review ${req.params.id}`);

  res.json({ success: true, message: 'Site review deleted' });
});

// @desc    Flag a review
// @route   PUT /api/admin/reviews/:id/flag
const flagReview = asyncHandler(async (req, res) => {
  // ✅ FIX: isActive: false hides the review from hotel/package pages immediately
  // isFlagged: true marks it for admin review
  const review = await Review.findByIdAndUpdate(
    req.params.id,
    {
      isFlagged: true,
      isActive: false,   // hides from public — getReviewsForItem filters isActive:true
      flagReason: req.body.reason || 'Flagged by admin',
      moderatedBy: req.user._id,
      moderatedAt: new Date(),
    },
    { new: true }
  );
  if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND');
  await logAdminAction(req, 'FLAG_REVIEW', 'Review', req.params.id, { reason: req.body.reason });

  res.json({ success: true, message: 'Review flagged and hidden from public', data: { review } });
});

// @desc    Unflag review — restore to public view
// @route   PUT /api/admin/reviews/:id/unflag
const unflagReview = asyncHandler(async (req, res) => {
  const review = await Review.findByIdAndUpdate(
    req.params.id,
    {
      isFlagged: false,
      isActive: true,    // restore to public
      flagReason: null,
      moderatedBy: req.user._id,
      moderatedAt: new Date(),
    },
    { new: true }
  );
  if (!review) throw new AppError('Review not found', 404, 'NOT_FOUND');
  res.json({ success: true, message: 'Review restored to public view', data: { review } });
});

// ─────────────────────────────────────────────────────────────────────────────
// HOTELS & PACKAGES MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Get all hotels
// @route   GET /api/admin/hotels
const getAllHotels = asyncHandler(async (req, res) => {
  const hotels = await Hotel.find()
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, data: { hotels } });
});

// @desc    Toggle hotel active status
// @route   PUT /api/admin/hotels/:id/toggle
const toggleHotel = asyncHandler(async (req, res) => {
  const hotel = await Hotel.findById(req.params.id);
  if (!hotel) throw new AppError('Hotel not found', 404, 'NOT_FOUND');

  hotel.isActive = !hotel.isActive;
  await hotel.save({ validateBeforeSave: false });

  res.json({
    success: true,
    message: `Hotel ${hotel.isActive ? 'activated' : 'deactivated'}`,
    data: { isActive: hotel.isActive },
  });
});

// @desc    Update hotel price
// @route   PUT /api/admin/hotels/:id/price
const updateHotelPrice = asyncHandler(async (req, res) => {
  const { basePrice } = req.body;
  if (!basePrice || isNaN(basePrice)) throw new AppError('Valid basePrice required', 400, 'VALIDATION_ERROR');

  const hotel = await Hotel.findByIdAndUpdate(
    req.params.id,
    { 'pricing.basePrice': Number(basePrice) },
    { new: true }
  );
  if (!hotel) throw new AppError('Hotel not found', 404, 'NOT_FOUND');

  res.json({ success: true, message: 'Price updated', data: { hotel } });
});

// @desc    Get all packages
// @route   GET /api/admin/packages
const getAllPackages = asyncHandler(async (req, res) => {
  const packages = await Package.find()
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, data: { packages } });
});

// @desc    Toggle package active status
// @route   PUT /api/admin/packages/:id/toggle
const togglePackage = asyncHandler(async (req, res) => {
  const pkg = await Package.findById(req.params.id);
  if (!pkg) throw new AppError('Package not found', 404, 'NOT_FOUND');

  pkg.isActive = !pkg.isActive;
  await pkg.save({ validateBeforeSave: false });

  res.json({
    success: true,
    message: `Package ${pkg.isActive ? 'activated' : 'deactivated'}`,
    data: { isActive: pkg.isActive },
  });
});

// @desc    Update package price
// @route   PUT /api/admin/packages/:id/price
const updatePackagePrice = asyncHandler(async (req, res) => {
  const { price } = req.body;
  if (!price || isNaN(price)) throw new AppError('Valid price required', 400, 'VALIDATION_ERROR');

  const pkg = await Package.findByIdAndUpdate(
    req.params.id,
    { price: Number(price) },
    { new: true }
  );
  if (!pkg) throw new AppError('Package not found', 404, 'NOT_FOUND');

  res.json({ success: true, message: 'Price updated', data: { pkg } });
});


// @desc    Get admin audit log
// @route   GET /api/v1/admin/audit-log
const getAuditLog = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const logs = await AuditLog.find()
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await AuditLog.countDocuments();

  res.json({
    success: true,
    data: {
      logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

module.exports = {
  getDashboardStats,
  getAllBookings,
  getBookingDetail,
  confirmBooking,
  cancelBooking,
  updateBookingNotes,
  getAllUsers,
  getUserDetail,
  banUser,
  unbanUser,
  getAllSiteReviews,
  getAllReviews,
  deleteReview,
  deleteSiteReview,
  flagReview,
  unflagReview,
  getAllHotels,
  toggleHotel,
  updateHotelPrice,
  getAllPackages,
  togglePackage,
  updatePackagePrice,
  getAuditLog,
};
