const express = require('express');
const router = express.Router();
const { packageController } = require('../controllers');
const {
  protect,
  authorize,
  paginationValidator,
  idParamValidator,
} = require('../middleware');

/**
 * Package Routes
 * Base path: /api/packages
 */

// Public routes
router.get('/', paginationValidator, packageController.getPackages);
router.get('/featured', packageController.getFeaturedPackages);
router.get('/search', packageController.searchPackages);
router.get('/category/:category', packageController.getPackagesByCategory);
router.get('/:id/availability', packageController.checkAvailability);
router.get('/:id', idParamValidator, packageController.getPackage);

// Protected admin routes
router.use(protect);
router.use(authorize('admin'));

router.post('/', packageController.createPackage);
router.put('/:id', idParamValidator, packageController.updatePackage);
router.delete('/:id', idParamValidator, packageController.deletePackage);

module.exports = router;
