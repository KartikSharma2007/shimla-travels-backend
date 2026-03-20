const express = require('express');
const router = express.Router();
const { supportController } = require('../controllers');
const {
  chatLimiter,
  supportMessageValidator,
} = require('../middleware');

/**
 * Support Routes
 * Base path: /api/support
 */

// Get contact info
router.get('/contact', supportController.getContactInfo);

// Initialize chat session
router.post('/chat/init', supportController.initChat);

// Send message to chat
router.post('/chat/message', chatLimiter, supportController.sendMessage);

// Submit support ticket
router.post('/ticket', supportController.submitTicket);

module.exports = router;
