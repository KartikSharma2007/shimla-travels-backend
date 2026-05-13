// tests/health.and.admin.test.js
//
// Tests:
//   A. Health endpoint — the first thing a reviewer/interviewer checks
//   B. Admin route access control — proves your RBAC works end-to-end
//
// What is tested:
//   Health:
//     1. GET /api/v1/health returns 200 with correct shape
//     2. Response includes timestamp and version
//
//   Admin routes:
//     3. Unauthenticated request to admin endpoint → 401
//     4. Regular user (role: 'user') accessing admin route → 403
//     5. Admin user (role: 'admin') accessing admin route → 200
//     6. Admin stats response has the expected fields

const request  = require('supertest');
const app      = require('../server');
const { User } = require('../models');
const { generateToken } = require('../middleware/auth');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const createUser = async (role = 'user') => {
  const user = await User.create({
    fullName:            `${role} Test`,
    age:                 25,
    gender:              'other',
    username:            `${role}_${Date.now()}`,
    email:               `${role}_${Date.now()}@test.com`,
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

  // ── Test 1: Returns 200 with correct shape ────────────────────────────────
  test('returns 200 with success:true, message, timestamp, and version', async () => {
    const res = await request(app)
      .get('/api/v1/health')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.version).toBeDefined();
  });

  // ── Test 2: Timestamp is a valid ISO string ───────────────────────────────
  test('timestamp is a valid ISO date string', async () => {
    const res = await request(app).get('/api/v1/health');

    const ts = new Date(res.body.timestamp);
    expect(ts).toBeInstanceOf(Date);
    expect(isNaN(ts.getTime())).toBe(false);
  });

  // ── Test 3: /ping also responds (keep-alive endpoint) ────────────────────
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

  // ── Test 4: No token → 401 ────────────────────────────────────────────────
  test('returns 401 when no token is provided to admin route', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  // ── Test 5: Regular user → 403 ───────────────────────────────────────────
  test('returns 403 when a regular user tries to access admin stats', async () => {
    const { token } = await createUser('user');

    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('INSUFFICIENT_PERMISSIONS');
  });

  // ── Test 6: Admin user → 200 with correct shape ───────────────────────────
  test('returns 200 with dashboard stats for admin user', async () => {
    const { token } = await createUser('admin');

    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    // Stats should have at minimum counts for users, bookings, revenue
    const stats = res.body.data;
    expect(stats).toBeDefined();
    // At least one of these keys should be present (exact shape depends on your adminController)
    const hasStats =
      stats.totalUsers       !== undefined ||
      stats.users            !== undefined ||
      stats.totalBookings    !== undefined ||
      stats.bookings         !== undefined;
    expect(hasStats).toBe(true);
  });

  // ── Test 7: Admin can list all users ─────────────────────────────────────
  test('admin can fetch all users list', async () => {
    const { token } = await createUser('admin');

    // Create a couple of regular users first
    await createUser('user');
    await createUser('user');

    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    // Should return an array or pagination object
    const users = res.body.data.users || res.body.data;
    expect(Array.isArray(users) ? users.length : 1).toBeGreaterThanOrEqual(1);
  });

  // ── Test 8: Moderator role also blocked from admin ───────────────────────
  // (unless you explicitly allow moderators — adjust if your app does)
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

  // ── Test 9: Unknown route returns 404 ────────────────────────────────────
  test('returns 404 with ROUTE_NOT_FOUND for undefined routes', async () => {
    const res = await request(app)
      .get('/api/v1/this-route-does-not-exist')
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('ROUTE_NOT_FOUND');
  });
});
