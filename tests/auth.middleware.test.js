// tests/auth.middleware.test.js
//
// Tests the protect() and authorize() middleware from middleware/auth.js
// These are the most critical security functions in the entire app.
//
// What is tested:
//   1. Rejects requests with no token               → 401 NO_TOKEN
//   2. Rejects requests with an invalid token       → 401 INVALID_TOKEN
//   3. Rejects requests with an expired token       → 401 TOKEN_EXPIRED
//   4. Accepts valid token and attaches user to req → 200 + user object
//   5. authorize() blocks users with wrong role     → 403 INSUFFICIENT_PERMISSIONS
//   6. authorize() allows users with correct role   → passes through

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const httpMocks = require('node-mocks-http');  // npm i -D node-mocks-http
const { User } = require('../models');
const { protect, authorize, generateToken } = require('../middleware/auth');

// ─── Helper: create a real user in the in-memory DB ──────────────────────────
const createTestUser = async (overrides = {}) => {
  return User.create({
    fullName: 'Test User',
    age: 25,
    gender: 'male',
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    phone: '9876543210',
    password: 'Password123!',
    preferredTravelType: 'adventure',
    isEmailVerified: true,
    isActive: true,
    authProvider: 'local',
    ...overrides,
  });
};

// ─── Helper: build a mock Express req/res/next triplet ───────────────────────
const mockRequest = (headers = {}, cookies = {}) => {
  const req = httpMocks.createRequest({ headers, cookies });
  return req;
};

const mockResponse = () => httpMocks.createResponse();

// ─────────────────────────────────────────────────────────────────────────────
describe('protect() middleware', () => {

  // ── Test 1: No token at all ────────────────────────────────────────────────
  test('returns 401 NO_TOKEN when Authorization header is missing', async () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.statusCode).toBe(401);
    const body = res._getJSONData();
    expect(body.success).toBe(false);
    expect(body.error).toBe('NO_TOKEN');
    expect(next).not.toHaveBeenCalled();
  });

  // ── Test 2: Malformed / invalid token ─────────────────────────────────────
  test('returns 401 INVALID_TOKEN when token is garbage', async () => {
    const req = mockRequest({ authorization: 'Bearer this.is.garbage' });
    const res = mockResponse();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.statusCode).toBe(401);
    const body = res._getJSONData();
    expect(body.success).toBe(false);
    expect(body.error).toBe('INVALID_TOKEN');
    expect(next).not.toHaveBeenCalled();
  });

  // ── Test 3: Expired token ──────────────────────────────────────────────────
  test('returns 401 TOKEN_EXPIRED when token is expired', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    // Sign a token that expired 1 second ago
    const expiredToken = jwt.sign(
      { id: fakeId },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }   // negative = already expired
    );

    const req = mockRequest({ authorization: `Bearer ${expiredToken}` });
    const res = mockResponse();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.statusCode).toBe(401);
    const body = res._getJSONData();
    expect(body.success).toBe(false);
    expect(body.error).toBe('TOKEN_EXPIRED');
    expect(next).not.toHaveBeenCalled();
  });

  // ── Test 4: Valid token — user gets attached to req ───────────────────────
  test('calls next() and attaches user to req when token is valid', async () => {
    const user = await createTestUser();
    const token = generateToken(user._id);

    const req = mockRequest({ authorization: `Bearer ${token}` });
    const res = mockResponse();
    const next = jest.fn();

    await protect(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();  // no error passed
    expect(req.user).toBeDefined();
    expect(req.user._id.toString()).toBe(user._id.toString());
    expect(req.userId.toString()).toBe(user._id.toString());
  });

  // ── Test 5: Token valid but user deleted from DB ──────────────────────────
  test('returns 401 USER_NOT_FOUND when user no longer exists in DB', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const token = generateToken(fakeId);

    const req = mockRequest({ authorization: `Bearer ${token}` });
    const res = mockResponse();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.statusCode).toBe(401);
    const body = res._getJSONData();
    expect(body.error).toBe('USER_NOT_FOUND');
    expect(next).not.toHaveBeenCalled();
  });

  // ── Test 6: Deactivated account ───────────────────────────────────────────
  test('returns 401 ACCOUNT_INACTIVE for deactivated users', async () => {
    const user = await createTestUser({ isActive: false });
    const token = generateToken(user._id);

    const req = mockRequest({ authorization: `Bearer ${token}` });
    const res = mockResponse();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.statusCode).toBe(401);
    const body = res._getJSONData();
    expect(body.error).toBe('ACCOUNT_INACTIVE');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('authorize() middleware', () => {

  // ── Test 7: User role blocked from admin route ────────────────────────────
  test('returns 403 INSUFFICIENT_PERMISSIONS when user role is not in allowed list', async () => {
    const req = mockRequest();
    req.user = { role: 'user' };     // simulate protect() having run
    const res = mockResponse();
    const next = jest.fn();

    // Only admins allowed
    const adminOnly = authorize('admin');
    adminOnly(req, res, next);

    expect(res.statusCode).toBe(403);
    const body = res._getJSONData();
    expect(body.error).toBe('INSUFFICIENT_PERMISSIONS');
    expect(next).not.toHaveBeenCalled();
  });

  // ── Test 8: Admin passes ──────────────────────────────────────────────────
  test('calls next() when user role matches allowed list', async () => {
    const req = mockRequest();
    req.user = { role: 'admin' };
    const res = mockResponse();
    const next = jest.fn();

    const adminOnly = authorize('admin');
    adminOnly(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  // ── Test 9: Multiple roles allowed ───────────────────────────────────────
  test('calls next() when role is one of multiple allowed roles', async () => {
    const req = mockRequest();
    req.user = { role: 'moderator' };
    const res = mockResponse();
    const next = jest.fn();

    const multiRole = authorize('admin', 'moderator');
    multiRole(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
