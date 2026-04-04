const express = require('express');
const router = express.Router();
const { authController } = require('../controllers');
const {
  protect,
  authLimiter,
  profileLimiter,      // ← NEW: relaxed limiter for profile/preference updates
  sensitiveOpLimiter,
  registerValidator,
  loginValidator,
  updateProfileValidator,
  changePasswordValidator,
} = require('../middleware');

/**
 * Auth Routes
 * Base path: /api/auth
 *
 * Rate limiting strategy:
 *  - authLimiter       → login, register, password reset (strict, IP-based)
 *  - profileLimiter    → profile updates, preferences (relaxed, user-based)
 *  - sensitiveOpLimiter → account deletion (strict, user-based)
 */

// ── Public routes ─────────────────────────────────────────────────────────────
router.post('/register', authLimiter, registerValidator, authController.register);
router.post('/login', authLimiter, loginValidator, authController.login);
router.post('/google', authLimiter, authController.googleLogin);
router.post('/google/set-password', authLimiter, authController.setGooglePassword);
router.post('/google/confirm-password', authLimiter, authController.googleConfirmPassword);
router.post('/google/link', protect, authController.linkGoogleAccount);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password/:token', authLimiter, authController.resetPassword);

// Travel preferences — public endpoint, no auth required (user identified by body)
router.put('/travel-preferences', authController.updateTravelPreferences);

// ── Protected routes ──────────────────────────────────────────────────────────
router.use(protect);

router.post('/logout', authController.logout);
router.get('/me', authController.getMe);
router.post('/refresh', authController.refreshToken);

// Profile & preferences — use profileLimiter (relaxed, user-based)
router.put('/profile', profileLimiter, updateProfileValidator, authController.updateProfile);
router.put('/preferences', profileLimiter, authController.updatePreferences);
router.put('/change-password', changePasswordValidator, authController.changePassword);

// Account deletion — keep strict protection (irreversible)
router.delete('/account', sensitiveOpLimiter, authController.deleteAccount);

module.exports = router;
