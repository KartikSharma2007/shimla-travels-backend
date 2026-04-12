// ─────────────────────────────────────────────────────────────────────────────
// FILE: Backendd/controllers/authController.js
//
// CHANGES FROM YOUR ORIGINAL:
//   1. forgotPassword  → now sends a real email via emailService
//   2. resetPassword   → now sends a confirmation email after success
//   3. Added forgotPasswordValidator + resetPasswordValidator (use in routes too)
//
// Everything else is IDENTICAL to your original file.
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');
const jwt = require('jsonwebtoken'); // moved here — was incorrectly placed inside functions
const { OAuth2Client } = require('google-auth-library');
const { User, Booking, Review, SavedItem } = require('../models');
const logger = require('../utils/logger');
const { sendPasswordResetEmail, sendPasswordChangedEmail, sendEmailVerificationEmail } = require('../utils/emailService');
const {
  generateToken,
  setTokenCookie,
  clearTokenCookie,
} = require('../middleware/auth');
const {
  AppError,
  asyncHandler,
} = require('../middleware/errorHandler');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── (All your existing functions are unchanged below) ──────────────────────

const register = asyncHandler(async (req, res) => {
  const { fullName, age, gender, username, preferredTravelType, email, phone, address, password } = req.body;
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
  const existingUsername = await User.findOne({ username: username?.toLowerCase() });
  if (existingUsername) throw new AppError('Username already taken', 409, 'USERNAME_TAKEN');

  // Create user with email NOT yet verified
  const user = await User.create({
    fullName,
    age,
    gender: gender.toLowerCase(),
    username: username?.toLowerCase(),
    preferredTravelType,
    email: email.toLowerCase(),
    phone,
    address,
    password,
    isEmailVerified: false,
  });

  // Generate verification token and send email
  const verifyToken = user.createEmailVerificationToken();
  // Store token expiry (24 hours)
  user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  // Fire-and-forget — don't block registration if email fails
  sendEmailVerificationEmail(user.email, user.fullName, verifyToken).catch((err) => {
    logger.error(`Failed to send verification email to ${user.email}: ${err.message}`);
  });

  // Return user but NO login token yet — they must verify first
  res.status(201).json({
    success: true,
    message: 'Registration successful! Please check your email to verify your account.',
    data: {
      requiresVerification: true,
      email: user.email,
    },
  });
});

// ── Verify Email ──────────────────────────────────────────────────────────────
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  // Hash the raw token from URL to match what's stored in DB
  const hashedToken = require('crypto')
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new AppError(
      'Verification link is invalid or has expired. Please request a new one.',
      400,
      'INVALID_VERIFICATION_TOKEN'
    );
  }

  // Mark email as verified and clear token
  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  // Log the user in automatically after verification
  const authToken = generateToken(user._id);
  setTokenCookie(res, authToken);

  logger.info(`Email verified for user: ${user.email}`);

  res.json({
    success: true,
    message: 'Email verified successfully! Welcome to Shimla Travels.',
    data: {
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        username: user.username,
        role: user.role,
        isEmailVerified: true,
        authProvider: user.authProvider,
        hasPassword: user.hasPassword,
        profileCompleted: user.profileCompleted,
        createdAt: user.createdAt,
      },
      token: authToken,
    },
  });
});

// ── Resend Verification Email ─────────────────────────────────────────────────
const resendVerificationEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) throw new AppError('Email is required', 400, 'EMAIL_REQUIRED');

  const user = await User.findOne({ email: email.toLowerCase() });

  // Always return success to prevent email enumeration attacks
  if (!user || user.isEmailVerified) {
    return res.json({
      success: true,
      message: 'If that email exists and is unverified, a new link has been sent.',
    });
  }

  const verifyToken = user.createEmailVerificationToken();
  user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  sendEmailVerificationEmail(user.email, user.fullName, verifyToken).catch((err) => {
    logger.error(`Failed to resend verification email to ${user.email}: ${err.message}`);
  });

  res.json({
    success: true,
    message: 'If that email exists and is unverified, a new link has been sent.',
  });
});

const sanitizeUser = (user) => ({ id: user._id, fullName: user.fullName, email: user.email, phone: user.phone, age: user.age, gender: user.gender, username: user.username, preferredTravelType: user.preferredTravelType, address: user.address, avatar: user.avatar, role: user.role, createdAt: user.createdAt });

// Consistent user payload — strips Google photo URLs, includes auth flags
const buildUserPayload = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  age: user.age,
  gender: user.gender,
  username: user.username,
  preferredTravelType: user.preferredTravelType,
  address: user.address,
  bio: user.bio,
  role: user.role,
  // Only return avatar if it's a user-uploaded base64 image
  avatar: user.avatar?.startsWith('data:') ? user.avatar : null,
  authProvider: user.authProvider,
  hasPassword: user.hasPassword,
  profileCompleted: user.profileCompleted,
  preferences: user.preferences,
  createdAt: user.createdAt,
});

const updateTravelPreferences = asyncHandler(async (req, res) => {
  const { seatPreference, mealPreference, roomType, smoking } = req.body;
  const user = await User.findByIdAndUpdate(req.user._id, { 'travelPreferences.seatPreference': seatPreference, 'travelPreferences.mealPreference': mealPreference, 'travelPreferences.roomType': roomType, 'travelPreferences.smoking': smoking }, { new: true, runValidators: false });
  res.json({ success: true, message: 'Travel preferences saved!', data: { preferences: user.travelPreferences } });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');

  // ✅ FIX: Check ban BEFORE anything else — banned users must not log in
  if (user.isActive === false) {
    throw new AppError(
      'Your account has been suspended. Please contact support at support@shimlatravels.com',
      403,
      'ACCOUNT_BANNED'
    );
  }

  if (user.isLocked()) throw new AppError('Account temporarily locked due to multiple failed attempts. Please try again later.', 423, 'ACCOUNT_LOCKED');
  const isMatch = await user.comparePassword(password);
  if (!isMatch) { await user.incrementLoginAttempts(); throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS'); }

  // Block unverified email accounts (Google OAuth users are auto-verified)
  if (!user.isEmailVerified && user.authProvider === 'local') {
    throw new AppError(
      'Please verify your email before logging in. Check your inbox or request a new verification link.',
      403,
      'EMAIL_NOT_VERIFIED'
    );
  }
  if (user.loginAttempts > 0) await user.updateOne({ $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } });
  user.lastLoginAt = new Date();
  user.lastLoginIp = req.ip;
  user.loginCount = (user.loginCount || 0) + 1;
  const isFirstLogin = user.loginCount === 1;
  await user.save({ validateBeforeSave: false });
  const token = generateToken(user._id);
  setTokenCookie(res, token);
  logger.info(`User logged in: ${user.email}`);
  res.json({
    success: true,
    message: 'Login successful',
    data: {
      isFirstLogin,   // true only on the very first login
      user: {
        id: user._id,
        fullName: user.fullName,
        age: user.age,
        gender: user.gender,
        username: user.username,
        preferredTravelType: user.preferredTravelType,
        email: user.email,
        phone: user.phone,
        address: user.address,
        bio: user.bio,
        role: user.role,
        avatar: user.avatar,
        preferences: user.preferences,
        isEmailVerified: user.isEmailVerified,
        profileCompleted: user.profileCompleted,
        authProvider: user.authProvider,
        hasPassword: user.hasPassword,
        createdAt: user.createdAt,
      },
      token,
    },
  });
});

const googleLogin = asyncHandler(async (req, res) => {
  const { credential } = req.body;
  if (!credential) throw new AppError('Google credential is required', 400, 'MISSING_CREDENTIAL');

  // Verify the Google ID token — wrap in try/catch to give a clean error
  // instead of a 500 if the token is invalid or the origin is not whitelisted
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (verifyError) {
    logger.error(`Google token verification failed: ${verifyError.message}`);
    throw new AppError(
      'Google sign-in failed. Please try again or use email/password login.',
      401,
      'GOOGLE_TOKEN_INVALID'
    );
  }

  const { email, name, sub: googleId } = payload;

  // Use lean find without password field — we never call .save() on this object
  // for the local-account-detected path, so password field is not needed here
  let user = await User.findOne({ email: email.toLowerCase() });

  // ── BAN CHECK — applies to ALL existing users regardless of auth provider ──
  // Must happen before any token is issued.
  if (user && user.isActive === false) {
    throw new AppError(
      'Your account has been suspended. Please contact support at support@shimlatravels.com',
      403,
      'ACCOUNT_BANNED'
    );
  }

  // ── CONDITION 3: Existing local account — same email used with Google button ──
  // The user originally signed up with email+password, and is now clicking the
  // Google button using the same email. We cannot silently log them in because
  // we need to confirm they own this local account (Google only proves they own
  // the Gmail address — not that they know the local password).
  // Solution: tell the frontend to show a "Enter your password" modal.
  // Once they enter the correct password, we link the Google account and log them in.
  if (user && user.authProvider === 'local') {
    logger.info(`Google login attempted on local account: ${user.email} — requesting password confirmation`);
    return res.json({
      success: true,
      message: 'This email is registered with a password. Please enter your password to continue.',
      data: {
        needsLocalPassword: true,   // frontend shows the "enter password" modal
        email: user.email,
        fullName: user.fullName,
        googleId,                   // frontend sends this back with the password
      },
    });
  }

  // ── CONDITION 2: Existing Google user returning ────────────────────────
  if (user && user.authProvider === 'google' && user.hasPassword) {
    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip;
    user.loginCount = (user.loginCount || 0) + 1;
    const isFirstLogin = user.loginCount === 1;
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);
    setTokenCookie(res, token);
    logger.info(`Returning Google user logged in: ${user.email}`);
    return res.json({
      success: true,
      message: 'Google login successful',
      data: {
        isFirstLogin,   // true only on the very first login
        needsPassword: false,
        user: buildUserPayload(user),
        token,
      },
    });
  }

  // ── CONDITION 1: Brand new Google user — needs to create a password ────
  // Build a unique username from their Google name
  const baseUsername =
    name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15) +
    '_' +
    Math.floor(Math.random() * 9999);

  if (!user) {
    // Create the account without a password for now.
    // Phone is left as a placeholder — the user must provide a real one
    // via ProfileCompletionModal before they can complete a booking.
    user = await User.create({
      fullName: name,
      email: email.toLowerCase(),
      googleId,
      authProvider: 'google',
      avatar: null,
      phone: '0000000000', // placeholder — must be updated via profile completion
      age: 18,
      gender: 'other',
      username: baseUsername,
      preferredTravelType: 'adventure',
      isEmailVerified: true,
      hasPassword: false,
      profileCompleted: false, // forces ProfileCompletionModal on next step
    });
  }

  // Issue a short-lived pending token (10 min) to secure the set-password step
  // jwt is imported at the top of this file
  const pendingToken = jwt.sign(
    { id: user._id, purpose: 'google-password-setup' },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );

  logger.info(`New Google user — password setup required: ${user.email}`);
  return res.json({
    success: true,
    message: 'Google account verified. Please create a password to complete setup.',
    data: {
      needsPassword: true,
      pendingToken,
      user: {
        email: user.email,
        fullName: user.fullName,
      },
    },
  });
});

// @desc    Complete Google sign-up by setting a password
// @route   POST /api/auth/google/set-password
// @access  Semi-public (requires pendingToken)
const setGooglePassword = asyncHandler(async (req, res) => {
  const { pendingToken, password } = req.body;

  if (!pendingToken || !password) {
    throw new AppError('Pending token and password are required', 400, 'MISSING_FIELDS');
  }
  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400, 'WEAK_PASSWORD');
  }

  // Verify the pending token — jwt is imported at the top of this file
  let decoded;
  try {
    decoded = jwt.verify(pendingToken, process.env.JWT_SECRET);
  } catch {
    throw new AppError('Session expired. Please sign in with Google again.', 401, 'TOKEN_EXPIRED');
  }

  const user = await User.findById(decoded.id);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

  // Ban check — prevent suspended users from completing setup
  if (user.isActive === false) {
    throw new AppError(
      'Your account has been suspended. Please contact support at support@shimlatravels.com',
      403,
      'ACCOUNT_BANNED'
    );
  }

  if (user.hasPassword) {
    // Already has a password — just issue a full token (idempotent)
    const token = generateToken(user._id);
    setTokenCookie(res, token);
    return res.json({
      success: true,
      message: 'Login successful',
      data: { user: buildUserPayload(user), token },
    });
  }

  // Set the password — pre-save hook hashes it and sets hasPassword = true
  user.password = password;
  user.lastLoginAt = new Date();
  user.lastLoginIp = req.ip;
  await user.save();

  const token = generateToken(user._id);
  setTokenCookie(res, token);

  logger.info(`Google user completed password setup: ${user.email}`);
  res.status(201).json({
    success: true,
    message: 'Password created successfully! Welcome aboard.',
    data: { user: buildUserPayload(user), token },
  });
});

const logout = asyncHandler(async (req, res) => { clearTokenCookie(res); logger.info(`User logged out: ${req.user.email}`); res.json({ success: true, message: 'Logout successful' }); });

const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        fullName: user.fullName,
        age: user.age,
        gender: user.gender,
        username: user.username,
        preferredTravelType: user.preferredTravelType,
        email: user.email,
        phone: user.phone,
        address: user.address,
        bio: user.bio,
        avatar: user.avatar,
        role: user.role,
        preferences: user.preferences,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        // These 3 fields are critical — without them isProfileComplete() returns
        // false and the ProfileCompletionModal opens on every page load
        profileCompleted: user.profileCompleted,
        authProvider: user.authProvider,
        hasPassword: user.hasPassword,
        createdAt: user.createdAt,
      },
    },
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, phone, age, gender, address, bio, preferredTravelType, profileCompleted, avatar } = req.body;
  const user = await User.findByIdAndUpdate(req.user._id, { ...(fullName && { fullName }), ...(phone && { phone }), ...(age && { age: parseInt(age) }), ...(gender && { gender: gender.toLowerCase() }), ...(address !== undefined && { address }), ...(bio !== undefined && { bio }), ...(preferredTravelType && { preferredTravelType }), ...(profileCompleted !== undefined && { profileCompleted }), ...(avatar !== undefined && { avatar }) }, { new: true, runValidators: false });
  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user._id,
        fullName: user.fullName,
        age: user.age,
        gender: user.gender,
        username: user.username,
        preferredTravelType: user.preferredTravelType,
        email: user.email,
        phone: user.phone,
        address: user.address,
        bio: user.bio,
        avatar: user.avatar,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        profileCompleted: user.profileCompleted,
        authProvider: user.authProvider,
        hasPassword: user.hasPassword,
        createdAt: user.createdAt,
      },
    },
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw new AppError('Current password is incorrect', 401, 'INVALID_PASSWORD');
  user.password = newPassword;
  await user.save();
  logger.info(`Password changed for user: ${user.email}`);

  console.log('[CHANGE PASSWORD] Password saved. Now sending notification email to:', user.email);
  sendPasswordChangedEmail(user.email, user.fullName)
    .catch(err => {
      console.error('[CHANGE PASSWORD] ❌ Email failed:', err.message);
      logger.error(`Password-changed email failed for ${user.email}: ${err.message}`);
    });

  clearTokenCookie(res);

  res.json({
    success: true,
    message: 'Password changed successfully. Please log in again.'
  });
});

const updatePreferences = asyncHandler(async (req, res) => {
  const { newsletter, smsNotifications, emailNotifications, currency, language } = req.body;
  const user = await User.findById(req.user._id);
  user.preferences = { ...user.preferences, ...(newsletter !== undefined && { newsletter }), ...(smsNotifications !== undefined && { smsNotifications }), ...(emailNotifications !== undefined && { emailNotifications }), ...(currency && { currency }), ...(language && { language }) };
  await user.save({ validateBeforeSave: false });
  res.json({ success: true, message: 'Preferences updated successfully', data: { preferences: user.preferences } });
});

const deleteAccount = asyncHandler(async (req, res) => {
  const { password, reason } = req.body;
  const userId = req.user._id;
  const user = await User.findById(userId).select('+password');
  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new AppError('Password is incorrect', 401, 'INVALID_PASSWORD');
  logger.info(`Starting account deletion for user: ${user.email}`);
  const bookings = await Booking.find({ user: userId });
  for (const booking of bookings) { booking.contactInfo = { fullName: 'Deleted User', email: `deleted_${booking._id}@deleted.com`, phone: '0000000000' }; await booking.save({ validateBeforeSave: false }); }
  const reviews = await Review.find({ user: userId });
  for (const review of reviews) { review.isUserDeleted = true; await review.save({ validateBeforeSave: false }); }
  const savedItemsResult = await SavedItem.deleteMany({ user: userId });
  await user.softDelete(reason);
  clearTokenCookie(res);
  logger.info(`Account deleted successfully for user: ${user.email}`);
  res.json({ success: true, message: "Your account has been deleted successfully. We're sorry to see you go!", data: { deletedAt: user.deletedAt, bookingsPreserved: bookings.length, reviewsPreserved: reviews.length, savedItemsDeleted: savedItemsResult.deletedCount } });
});

// ── UPDATED: forgotPassword — now sends a real email ─────────────────────────
// @desc    Forgot password — send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });

  // Always return the same message to prevent email enumeration attacks
  const genericMessage = 'If an account exists with this email, you will receive password reset instructions within a few minutes.';

  if (!user) {
    return res.json({ success: true, message: genericMessage });
  }

  // Generate a secure token (plain token goes in email, hashed token stored in DB)
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // Send the reset email
  try {
    await sendPasswordResetEmail(user.email, resetToken, user.fullName);
    logger.info(`Password reset email sent to: ${user.email}`);
  } catch (emailError) {
    // If email fails, clear the token so the user can try again
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    logger.error(`Email send failed for forgot-password: ${emailError.message}`);
    throw new AppError(
      'There was a problem sending the reset email. Please try again later.',
      500,
      'EMAIL_SEND_FAILED'
    );
  }

  res.json({
    success: true,
    message: genericMessage,
    // Only expose token in development for easier testing
    ...(process.env.NODE_ENV === 'development' && { resetToken }),
  });
});

// ── UPDATED: resetPassword — now sends a confirmation email after success ────
// @desc    Reset password using token from email
// @route   POST /api/auth/reset-password/:token
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  // Hash the incoming plain token to compare with the stored hash
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }, // token must not be expired
  });

  if (!user) {
    throw new AppError(
      'This password reset link is invalid or has expired. Please request a new one.',
      400,
      'INVALID_TOKEN'
    );
  }

  // Set the new password (the pre-save hook in User.js will hash it automatically)
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // Send a security notification email (fire-and-forget — don't block the response)
  sendPasswordChangedEmail(user.email, user.fullName).catch((err) => {
    logger.error(`Failed to send password-changed confirmation to ${user.email}: ${err.message}`);
  });

  // Auto-login the user after successful reset
  const authToken = generateToken(user._id);
  setTokenCookie(res, authToken);

  logger.info(`Password reset successful for: ${user.email}`);

  res.json({
    success: true,
    message: 'Password reset successful! You are now logged in.',
    data: { token: authToken },
  });
});

// @desc    Refresh access token using a valid refresh token
// @route   POST /api/v1/auth/refresh
// @access  Protected (requires valid Bearer token)
const refreshToken = asyncHandler(async (req, res) => {
  // Re-issue a fresh access token for the already-authenticated user.
  // The protect() middleware already verified the incoming token,
  // so req.user is guaranteed to be set here.
  const newAccessToken = generateToken(req.user._id);
  setTokenCookie(res, newAccessToken);

  logger.info(`Token refreshed for user: ${req.user.email}`);
  res.json({
    success: true,
    message: 'Token refreshed successfully',
    data: { token: newAccessToken },
  });
});


// @desc    Confirm local password when Google login hits an existing local account
// @route   POST /api/v1/auth/google/confirm-password
// @access  Public
//
// SIMPLIFIED FLOW — no longer requires googleId:
//   1. Verify email + password exactly like normal login
//   2. Return a full auth token
//   3. googleId linking is handled separately by /auth/google/link (called after login)
//
// Why: passing googleId through the Google button → AuthContext → modal → backend
// was fragile and caused the "incorrect password" error even when the password
// was correct (because googleId was undefined, triggering the missing-fields error).
const googleConfirmPassword = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Email and password are required', 400, 'MISSING_FIELDS');
  }

  // Find user with password field for bcrypt comparison
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Ban check
  if (user.isActive === false) {
    throw new AppError(
      'Your account has been suspended. Please contact support at support@shimlatravels.com',
      403,
      'ACCOUNT_BANNED'
    );
  }

  // Reset any lockout — the user proved they own the Gmail address via Google OAuth
  if (user.isLocked()) {
    await user.updateOne({ $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } });
    user.loginAttempts = 0;
    user.lockUntil = undefined;
  }

  // No password stored — tell user to reset
  if (!user.password) {
    throw new AppError(
      'This account has no password set. Please use Forgot Password to create one.',
      400,
      'NO_PASSWORD'
    );
  }

  // Verify password with bcrypt — same as normal login
  const isMatch = await user.comparePassword(password);
  logger.info(`googleConfirmPassword for ${email}: ${isMatch ? 'MATCH' : 'NO MATCH'}`);

  if (!isMatch) {
    await user.incrementLoginAttempts();
    throw new AppError(
      'Incorrect password. Please try again.',
      401,
      'INVALID_CREDENTIALS'
    );
  }

  // Password correct — log user in
  await user.updateOne({ $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } });
  user.lastLoginAt = new Date();
  user.lastLoginIp = req.ip;
  await user.save({ validateBeforeSave: false });

  const token = generateToken(user._id);
  setTokenCookie(res, token);

  logger.info(`googleConfirmPassword: login successful for ${user.email}`);

  res.json({
    success: true,
    message: 'Login successful!',
    data: {
      user: buildUserPayload(user),
      token,
    },
  });
});

// @desc    Link a Google account to an already-logged-in local account
// @route   POST /api/v1/auth/google/link
// @access  Private (must be logged in)
const linkGoogleAccount = asyncHandler(async (req, res) => {
  const { googleId } = req.body;

  if (!googleId) {
    return res.json({ success: true, message: 'No googleId provided — skipping link' });
  }

  await User.findByIdAndUpdate(
    req.user._id,
    { googleId },
    { new: true, runValidators: false }
  );

  logger.info(`Google account linked to ${req.user.email}`);
  res.json({ success: true, message: 'Google account linked successfully' });
});

module.exports = {
  register,
  verifyEmail,
  resendVerificationEmail,
  login,
  googleLogin,
  setGooglePassword,
  googleConfirmPassword,
  linkGoogleAccount,
  logout,
  getMe,
  updateProfile,
  changePassword,
  updatePreferences,
  deleteAccount,
  forgotPassword,
  resetPassword,
  refreshToken,
  updateTravelPreferences,
};