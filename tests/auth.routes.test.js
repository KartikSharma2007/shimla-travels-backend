// tests/auth.routes.test.js
//
// Integration tests for /api/v1/auth/register and /api/v1/auth/login
// Uses supertest to fire real HTTP requests against the Express app.
//
// What is tested:
//   Registration:
//     1. Successful registration returns 201 + requiresVerification flag
//     2. Duplicate email returns 409 EMAIL_EXISTS
//     3. Duplicate username returns 409 USERNAME_TAKEN
//     4. Missing required fields return 400 VALIDATION_ERROR
//     5. Underage user (age < 18) is rejected
//
//   Login:
//     6. Unverified email is blocked
//     7. Wrong password returns 401
//     8. Correct credentials return token + user data
//     9. Non-existent email returns 401 (not 404 — avoids user enumeration)

const request = require('supertest');
const app     = require('../server');   // your Express app
const { User } = require('../models');

// ─── Shared test user data ────────────────────────────────────────────────────
const validUser = {
  fullName:            'Kartik Sharma',
  age:                 22,
  gender:              'male',
  username:            'kartik_test',
  email:               'kartik@example.com',
  phone:               '9876543210',
  password:            'Password123!',
  preferredTravelType: 'adventure',
};

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/register', () => {

  // ── Test 1: Successful registration ────────────────────────────────────────
  test('returns 201 and requiresVerification:true for valid new user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(validUser)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.requiresVerification).toBe(true);
    expect(res.body.data.email).toBe(validUser.email);
    // Should NOT return a token before email verification
    expect(res.body.token).toBeUndefined();
  });

  // ── Test 2: Duplicate email ────────────────────────────────────────────────
  test('returns 409 EMAIL_EXISTS when email is already registered', async () => {
    // Register once
    await request(app).post('/api/v1/auth/register').send(validUser);

    // Try same email with different username
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validUser, username: 'different_user' })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('EMAIL_EXISTS');
  });

  // ── Test 3: Duplicate username ─────────────────────────────────────────────
  test('returns 409 USERNAME_TAKEN when username is already taken', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validUser, email: 'different@example.com' })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('USERNAME_TAKEN');
  });

  // ── Test 4: Missing required fields ───────────────────────────────────────
  test('returns 400 VALIDATION_ERROR when email is missing', async () => {
    const { email, ...withoutEmail } = validUser;

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(withoutEmail)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  // ── Test 5: Underage user ──────────────────────────────────────────────────
  test('returns 400 VALIDATION_ERROR for age < 18', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validUser, age: 16, username: 'teen_user', email: 'teen@example.com' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/login', () => {

  // Helper: register + manually verify a user (bypasses email flow for tests)
  const registerAndVerify = async (userData = validUser) => {
    await request(app).post('/api/v1/auth/register').send(userData);
    // Directly mark as verified in DB — we're testing login, not email flow
    await User.findOneAndUpdate(
      { email: userData.email },
      { isEmailVerified: true }
    );
  };

  // ── Test 6: Unverified email is blocked ───────────────────────────────────
  test('returns 401 when email is not verified', async () => {
    // Register but do NOT verify
    await request(app).post('/api/v1/auth/register').send(validUser);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password })
      .expect(401);

    expect(res.body.success).toBe(false);
    // Should mention verification (not just "invalid credentials")
    expect(res.body.message.toLowerCase()).toMatch(/verif/);
  });

  // ── Test 7: Wrong password ─────────────────────────────────────────────────
  test('returns 401 for incorrect password', async () => {
    await registerAndVerify();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: 'WrongPassword999!' })
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  // ── Test 8: Correct credentials ───────────────────────────────────────────
  test('returns 200 with token and user data for valid credentials', async () => {
    await registerAndVerify();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
    expect(res.body.data.user.email).toBe(validUser.email);
    // Password should NEVER appear in response
    expect(res.body.data.user.password).toBeUndefined();
  });

  // ── Test 9: Non-existent email ────────────────────────────────────────────
  // IMPORTANT: Must return 401, not 404 — 404 would confirm email exists (enumeration attack)
  test('returns 401 (not 404) for unregistered email — prevents user enumeration', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'somepassword' })
      .expect(401);

    expect(res.body.success).toBe(false);
    // Must NOT say "user not found" — that reveals whether the email is registered
    expect(res.body.message.toLowerCase()).not.toMatch(/not found/);
  });
});
