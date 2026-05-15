const express = require('express');
const router = express.Router();
const { hotelController } = require('../controllers');
const {
  protect,
  authorize,
  paginationValidator,
  idParamValidator,
} = require('../middleware');

/**
 * Hotel Routes
 * Base path: /api/hotels
 */

// Public routes
router.get('/', paginationValidator, hotelController.getHotels);
router.get('/featured', hotelController.getFeaturedHotels);
router.get('/search', hotelController.searchHotels);

// ✅ Returns staticIds of deactivated hotels so frontend can filter static data
// Public — no auth needed, no sensitive info
router.get('/deactivated-ids', async (req, res) => {
  try {
    const Hotel = require('../models/Hotel');
    const deactivated = await Hotel.find(
      { isActive: false, staticId: { $exists: true, $ne: null } },
      { staticId: 1, _id: 0 }
    ).lean();
    res.json({
      success: true,
      data: { deactivatedIds: deactivated.map(h => h.staticId) },
    });
  } catch (err) {
    res.json({ success: true, data: { deactivatedIds: [] } });
  }
});

router.get('/by-static/:staticId', hotelController.getHotelByStaticId); // Cloudinary images by staticId
router.get('/:id', idParamValidator, hotelController.getHotel);

// Protected admin routes
router.use(protect);
router.use(authorize('admin'));

router.post('/', hotelController.createHotel);
router.put('/:id', idParamValidator, hotelController.updateHotel);
router.delete('/:id', idParamValidator, hotelController.deleteHotel);

module.exports = router;

// ONE-TIME cleanup — removes duplicate image URLs from all hotels
// Call once: GET /api/v1/hotels/cleanup-duplicates then remove this route
router.get('/cleanup-duplicates', async (req, res) => {
  const Hotel = require('../models/Hotel');
  const hotels = await Hotel.find({}).lean();
  let fixed = 0;
  for (const h of hotels) {
    const unique = [...new Set((h.images || []).filter(u => u && u.startsWith('http')))];
    if (unique.length !== (h.images || []).length) {
      await Hotel.findByIdAndUpdate(h._id, { $set: { images: unique } });
      fixed++;
    }
  }
  res.json({ success: true, message: `Cleaned ${fixed} hotels` });
});
