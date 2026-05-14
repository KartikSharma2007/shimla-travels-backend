// tests/auth.routes.test.js

const request = require('supertest');
const app     = require('../server');
const { User } = require('../models');

const validUser = {
  fullName:            'Kartik Sharma',
  age:                 22,
  gender:              'male',
  username:            'kartik_test',       // under 30 chars
  email:               'kartik@example.com',
  phone:               '9876543210',
  password:            'Password123!',
  preferredTravelType: 'adventure',
};

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/register', () => {

  test('returns 201 and requiresVerification:true for valid new user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(validUser)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.requiresVerification).toBe(true);
    expect(res.body.data.email).toBe(validUser.email);
    expect(res.body.token).toBeUndefined();
  });

  test('returns 409 EMAIL_EXISTS when email is already registered', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validUser, username: 'diff_user' })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('EMAIL_EXISTS');
  });

  test('returns 409 USERNAME_TAKEN when username is already taken', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validUser, email: 'different@example.com' })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('USERNAME_TAKEN');
  });

  test('returns 400 VALIDATION_ERROR when email is missing', async () => {
    const { email, ...withoutEmail } = validUser;

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(withoutEmail)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  test('returns 400 VALIDATION_ERROR for age < 18', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validUser, age: 16, username: 'teen_usr', email: 'teen@example.com' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/login', () => {

  const registerAndVerify = async (userData = validUser) => {
    await request(app).post('/api/v1/auth/register').send(userData);
    await User.findOneAndUpdate(
      { email: userData.email },
      { isEmailVerified: true }
    );
  };

  // FIX: your authController throws 403 (not 401) for unverified email
  test('returns 403 when email is not verified', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password })
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.message.toLowerCase()).toMatch(/verif/);
  });

  test('returns 401 for incorrect password', async () => {
    await registerAndVerify();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: 'WrongPassword999!' })
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  // FIX: token is inside res.body.data.token not res.body.token
  test('returns 200 with token and user data for valid credentials', async () => {
    await registerAndVerify();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password })
      .expect(200);

    expect(res.body.success).toBe(true);
    // token lives inside data object
    expect(res.body.data.token).toBeDefined();
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.user.email).toBe(validUser.email);
    expect(res.body.data.user.password).toBeUndefined();
  });

  test('returns 401 for unregistered email — prevents user enumeration', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'somepassword' })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.message.toLowerCase()).not.toMatch(/not found/);
  });
});
