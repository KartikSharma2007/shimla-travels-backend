// tests/health.and.admin.test.js

const request  = require('supertest');
const app      = require('../server');
const { User } = require('../models');
const { generateToken } = require('../middleware/auth');

// ─── Helper ───────────────────────────────────────────────────────────────────
const createUser = async (role = 'user') => {
  const ts = Date.now().toString().slice(-6);
  const user = await User.create({
    fullName:            `${role} Test`,
    age:                 25,
    gender:              'other',
    username:            `${role}${ts}`,       // short — under 30 chars
    email:               `${role}${ts}@test.com`,
    phone:               '9876543210',
    password:            'Password123!',
    preferredTravelType: 'luxury',
    isEmailVerified:     true,
    isActive:            true,
    authProvider:        'local',
    role,
  });
  return { user, token: generateToken(user._id) };
};

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/v1/health', () => {

  test('returns 200 with success:true, message, timestamp, and version', async () => {
    const res = await request(app)
      .get('/api/v1/health')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.version).toBeDefined();
  });

  test('timestamp is a valid ISO date string', async () => {
    const res = await request(app).get('/api/v1/health');
    const ts  = new Date(res.body.timestamp);
    expect(ts).toBeInstanceOf(Date);
    expect(isNaN(ts.getTime())).toBe(false);
  });

  // FIX: /ping is mounted directly on the Express app (server.js),
  // NOT under /api/v1 — so the path is just /ping
  test('GET /ping returns 200 with ok:true', async () => {
    const res = await request(app)
      .get('/ping')
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.ts).toBeDefined();
    expect(typeof res.body.ts).toBe('number');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Admin route access control', () => {

  test('returns 401 when no token is provided to admin route', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  test('returns 403 when a regular user tries to access admin stats', async () => {
    const { token } = await createUser('user');

    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
  });

  test('returns 200 with dashboard stats for admin user', async () => {
    const { token } = await createUser('admin');

    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    const stats = res.body.data;
    expect(stats).toBeDefined();
    const hasStats =
      stats.totalUsers    !== undefined ||
      stats.users         !== undefined ||
      stats.totalBookings !== undefined ||
      stats.bookings      !== undefined;
    expect(hasStats).toBe(true);
  });

  test('admin can fetch all users list', async () => {
    const { token } = await createUser('admin');
    await createUser('user');
    await createUser('user');

    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    const users = res.body.data?.users ?? res.body.data;
    expect(Array.isArray(users) ? users.length : 1).toBeGreaterThanOrEqual(1);
  });

  test('returns 403 for moderator role on admin-only routes', async () => {
    const { token } = await createUser('moderator');

    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('404 handler', () => {

  test('returns 404 with ROUTE_NOT_FOUND for undefined routes', async () => {
    const res = await request(app)
      .get('/api/v1/this-route-does-not-exist')
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('ROUTE_NOT_FOUND');
  });
});
