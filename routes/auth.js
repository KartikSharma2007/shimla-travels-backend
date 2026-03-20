const express = require('express');
const router = express.Router();
const { authController } = require('../controllers');
const {
  protect,
  authLimiter,
  sensitiveOpLimiter,
  registerValidator,
  loginValidator,
  updateProfileValidator,
  changePasswordValidator,
} = require('../middleware');

/**
 * Auth Routes
 * Base path: /api/auth
 */

// Public routes
router.post('/register', authLimiter, registerValidator, authController.register);
router.post('/login', authLimiter, loginValidator, authController.login);
router.post('/google', authLimiter, authController.googleLogin);                          // Google OAuth
router.post('/google/set-password', authLimiter, authController.setGooglePassword);       // New Google user sets password
router.post('/google/confirm-password', authLimiter, authController.googleConfirmPassword); // Local user confirms password via Google button
router.post('/google/link', protect, authController.linkGoogleAccount); // Link Google ID after password confirmed
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password/:token', authLimiter, authController.resetPassword);
router.put('/travel-preferences', authController.updateTravelPreferences);

// Protected routes
router.use(protect);

router.post('/logout', authController.logout);
router.get('/me', authController.getMe);
router.put('/profile', updateProfileValidator, authController.updateProfile);
router.put('/change-password', changePasswordValidator, authController.changePassword);
router.put('/preferences', authController.updatePreferences);
router.post('/refresh', authController.refreshToken);

// Account deletion - extra protection
router.delete('/account', sensitiveOpLimiter, authController.deleteAccount);

module.exports = router;
