// tests/password.reset.test.js
//
// Tests the full password reset flow:
//   POST /api/v1/auth/forgot-password  → generates reset token, sends email
//   POST /api/v1/auth/reset-password/:token → resets password
//
// What is tested:
//   1. forgotPassword returns 200 even for unknown email (no enumeration)
//   2. forgotPassword stores a hashed reset token in the DB
//   3. resetPassword with wrong token returns 400
//   4. resetPassword with valid token updates the password
//   5. Used reset token cannot be reused (one-time use)
//   6. Expired token is rejected
//   7. Old password no longer works after reset
//   8. New password works after reset

const request = require('supertest');
const crypto = require('crypto');
const app = require('../server');
const { User } = require('../models');
const { generateToken } = require('../middleware/auth');

// ─── Helper ───────────────────────────────────────────────────────────────────
const createVerifiedUser = async () => {
  return User.create({
    fullName: 'Reset Test User',
    age: 30,
    gender: 'male',
    username: `resetuser_${Date.now()}`,
    email: `reset_${Date.now()}@test.com`,
    phone: '9876543210',
    password: 'OldPassword123!',
    preferredTravelType: 'nature',
    isEmailVerified: true,
    isActive: true,
    authProvider: 'local',
  });
};

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/forgot-password', () => {

  // ── Test 1: Unknown email still returns 200 ───────────────────────────────
  // This prevents attackers from discovering which emails are registered
  test('returns 200 for unknown email — no user enumeration', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody_at_all@doesnotexist.com' })
      .expect(200);

    expect(res.body.success).toBe(true);
    // The message should be generic — no "email not found" leak
    expect(res.body.message.toLowerCase()).toMatch(/email|sent|check/);
  });

  // ── Test 2: Token is stored in DB (hashed) ────────────────────────────────
  test('stores a hashed reset token in the user document', async () => {
    const user = await createVerifiedUser();

    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: user.email })
      .expect(200);

    // Re-fetch user — token should now be set
    const updatedUser = await User.findById(user._id).select('+passwordResetToken +passwordResetExpires');
    expect(updatedUser.passwordResetToken).toBeDefined();
    expect(updatedUser.passwordResetExpires).toBeDefined();
    expect(new Date(updatedUser.passwordResetExpires) > new Date()).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/reset-password/:token', () => {

  // Helper: trigger forgot-password and extract the raw token by reverse-engineering
  // In real code the raw token is emailed; in tests we regenerate it from scratch
  const setupReset = async () => {
    const user = await createVerifiedUser();

    // Simulate what forgotPassword does: create raw token, hash it, store it
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save({ validateBeforeSave: false });

    return { user, rawToken };
  };

  // ── Test 3: Invalid token returns 400 ─────────────────────────────────────
  test('returns 400 for an invalid/random reset token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password/thisisnotavalidtoken123456')
      .send({ password: 'NewPassword999!' })
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  // ── Test 4: Valid token resets the password ────────────────────────────────
  test('resets the password and clears the token for a valid token', async () => {
    const { user, rawToken } = await setupReset();

    const res = await request(app)
      .post(`/api/v1/auth/reset-password/${rawToken}`)
      .send({ password: 'NewPassword999!' })
      .expect(200);

    expect(res.body.success).toBe(true);

    // Token should be cleared in DB
    const updatedUser = await User.findById(user._id).select('+passwordResetToken +passwordResetExpires');
    expect(updatedUser.passwordResetToken).toBeFalsy();
  });

  // ── Test 5: Token cannot be reused ───────────────────────────────────────
  test('returns 400 when the same reset token is used twice', async () => {
    const { rawToken } = await setupReset();

    // First use — should succeed
    await request(app)
      .post(`/api/v1/auth/reset-password/${rawToken}`)
      .send({ password: 'NewPassword999!' })
      .expect(200);

    // Second use — same token, should fail (token cleared after first use)
    const res = await request(app)
      .post(`/api/v1/auth/reset-password/${rawToken}`)
      .send({ password: 'AnotherPassword123!' })
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  // ── Test 6: Expired token is rejected ────────────────────────────────────
  test('returns 400 for an expired reset token', async () => {
    const user = await createVerifiedUser();
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Set token that expired 1 minute ago
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() - 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const res = await request(app)
      .post(`/api/v1/auth/reset-password/${rawToken}`)
      .send({ password: 'ShouldNotWork123!' })
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  // ── Test 7 & 8: Old password fails, new password works ───────────────────
  test('old password fails and new password works after reset', async () => {
    const { user, rawToken } = await setupReset();
    const newPassword = 'BrandNewPassword999!';

    // Reset password
    await request(app)
      .post(`/api/v1/auth/reset-password/${rawToken}`)
      .send({ password: newPassword })
      .expect(200);

    // Old password should now fail
    const oldLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'OldPassword123!' });
    expect(oldLoginRes.statusCode).toBe(401);

    // New password should work
    const newLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: newPassword });
    expect(newLoginRes.statusCode).toBe(200);
    expect(newLoginRes.body.token).toBeDefined();
  });
});
