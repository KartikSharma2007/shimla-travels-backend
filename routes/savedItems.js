const express = require('express');
const router = express.Router();
const { savedItemController } = require('../controllers');
const { protect, paginationValidator } = require('../middleware');

router.use(protect);

router.get('/', paginationValidator, savedItemController.getSavedItems);
router.post('/', savedItemController.addSavedItem);
router.delete('/:itemType/:itemId', savedItemController.removeSavedItem);
router.delete('/', savedItemController.clearAllSavedItems);

module.exports = router;