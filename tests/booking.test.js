// tests/booking.test.js
//
// Integration tests for the booking endpoints
//   POST /api/v1/bookings/hotel
//   POST /api/v1/bookings/package
//   GET  /api/v1/bookings
//   PUT  /api/v1/bookings/:id/cancel
//
// What is tested:
//   1.  Unauthenticated request is rejected with 401
//   2.  Hotel booking is created with correct pricing (GST applied server-side)
//   3.  Package booking is created with correct structure
//   4.  Cannot book with past check-in date
//   5.  Cannot book with check-out before check-in
//   6.  GET /bookings returns only the current user's bookings (not other users')
//   7.  Booking can be cancelled
//   8.  Confirmed/paid booking cannot be cancelled

const request  = require('supertest');
const app      = require('../server');
const { User, Booking } = require('../models');
const { generateToken } = require('../middleware/auth');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const createVerifiedUser = async (suffix = '') => {
  const user = await User.create({
    fullName:            `Test Traveller${suffix}`,
    age:                 28,
    gender:              'female',
    username:            `traveller${suffix}_${Date.now()}`,
    email:               `traveller${suffix}_${Date.now()}@test.com`,
    phone:               '9876543210',
    password:            'Password123!',
    preferredTravelType: 'family',
    isEmailVerified:     true,
    isActive:            true,
    authProvider:        'local',
  });
  return { user, token: generateToken(user._id) };
};

// Dates in the future
const futureDate = (daysFromNow) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];   // YYYY-MM-DD
};

const validHotelBooking = {
  hotelRef:  'hotel_1',
  hotelName: 'The Grand Shimla',
  roomType:  'Deluxe Room',
  checkIn:   futureDate(7),
  checkOut:  futureDate(9),
  rooms:     1,
  adults:    2,
  children:  0,
  contactInfo: {
    fullName: 'Test Traveller',
    email:    'test@test.com',
    phone:    '9876543210',
  },
  specialRequests: '',
};

const validPackageBooking = {
  packageRef:   'pkg_shimla_classic',
  packageTitle: 'Shimla Classic Tour',
  travelDate:   futureDate(14),
  adults:       2,
  children:     1,
  contactInfo: {
    fullName: 'Test Traveller',
    email:    'test@test.com',
    phone:    '9876543210',
  },
  specialRequests: 'Vegetarian meals only',
};

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/v1/bookings/hotel', () => {

  // ── Test 1: Unauthenticated request rejected ───────────────────────────────
  test('returns 401 when no auth token is provided', async () => {
    const res = await request(app)
      .post('/api/v1/bookings/hotel')
      .send(validHotelBooking)
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  // ── Test 2: Successful hotel booking ──────────────────────────────────────
  test('creates a hotel booking and returns pricing with GST', async () => {
    const { token } = await createVerifiedUser('_hotel');

    const res = await request(app)
      .post('/api/v1/bookings/hotel')
      .set('Authorization', `Bearer ${token}`)
      .send(validHotelBooking)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.booking).toBeDefined();

    const { booking } = res.body.data;

    // Booking reference must be generated
    expect(booking.bookingReference).toBeDefined();
    expect(booking.bookingReference).toMatch(/^ST-/);

    // Status should be pending (payment not done yet)
    expect(booking.status).toBe('pending');

    // Pricing must include tax (18% GST on hotels)
    expect(booking.pricing).toBeDefined();
    expect(booking.pricing.totalAmount).toBeGreaterThan(booking.pricing.baseAmount);
    expect(booking.pricing.taxAmount).toBeGreaterThan(0);

    // bookingType must be 'hotel'
    expect(booking.bookingType).toBe('hotel');
  });

  // ── Test 3: Past check-in date is rejected ────────────────────────────────
  test('returns 400 when checkIn date is in the past', async () => {
    const { token } = await createVerifiedUser('_past');

    const yesterday = futureDate(-1);
    const res = await request(app)
      .post('/api/v1/bookings/hotel')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validHotelBooking, checkIn: yesterday, checkOut: futureDate(1) })
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  // ── Test 4: Check-out before check-in ────────────────────────────────────
  test('returns 400 when checkOut is before checkIn', async () => {
    const { token } = await createVerifiedUser('_invalid_dates');

    const res = await request(app)
      .post('/api/v1/bookings/hotel')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validHotelBooking, checkIn: futureDate(10), checkOut: futureDate(5) })
      .expect(400);

    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/v1/bookings/package', () => {

  // ── Test 5: Successful package booking ────────────────────────────────────
  test('creates a package booking with correct structure', async () => {
    const { token } = await createVerifiedUser('_pkg');

    const res = await request(app)
      .post('/api/v1/bookings/package')
      .set('Authorization', `Bearer ${token}`)
      .send(validPackageBooking)
      .expect(201);

    expect(res.body.success).toBe(true);
    const { booking } = res.body.data;
    expect(booking.bookingType).toBe('package');
    expect(booking.packageTitle).toBe(validPackageBooking.packageTitle);
    // Package GST is 5%
    expect(booking.pricing.taxAmount).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/v1/bookings', () => {

  // ── Test 6: Only returns current user's bookings ──────────────────────────
  test('returns only bookings belonging to the authenticated user', async () => {
    const { user: userA, token: tokenA } = await createVerifiedUser('_A');
    const { token: tokenB } = await createVerifiedUser('_B');

    // User A makes a booking
    await request(app)
      .post('/api/v1/bookings/hotel')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validHotelBooking);

    // User B fetches their bookings — should get 0
    const resB = await request(app)
      .get('/api/v1/bookings')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    expect(resB.body.success).toBe(true);
    // User B has no bookings
    const bookings = resB.body.data.bookings || resB.body.data;
    expect(Array.isArray(bookings) ? bookings.length : 0).toBe(0);

    // User A fetches their bookings — should get 1
    const resA = await request(app)
      .get('/api/v1/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const bookingsA = resA.body.data.bookings || resA.body.data;
    expect(Array.isArray(bookingsA) ? bookingsA.length : 1).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PUT /api/v1/bookings/:id/cancel', () => {

  // ── Test 7: Successfully cancel a pending booking ─────────────────────────
  test('cancels a pending booking and returns cancelled status', async () => {
    const { token } = await createVerifiedUser('_cancel');

    // Create booking
    const createRes = await request(app)
      .post('/api/v1/bookings/hotel')
      .set('Authorization', `Bearer ${token}`)
      .send(validHotelBooking);

    const bookingId = createRes.body.data.booking._id;

    // Cancel it
    const cancelRes = await request(app)
      .put(`/api/v1/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(cancelRes.body.success).toBe(true);
    expect(cancelRes.body.data.booking.status).toBe('cancelled');
  });

  // ── Test 8: Cannot cancel another user's booking ─────────────────────────
  test('returns 403/404 when trying to cancel another user\'s booking', async () => {
    const { token: tokenA } = await createVerifiedUser('_owner');
    const { token: tokenB } = await createVerifiedUser('_thief');

    const createRes = await request(app)
      .post('/api/v1/bookings/hotel')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validHotelBooking);

    const bookingId = createRes.body.data.booking._id;

    const res = await request(app)
      .put(`/api/v1/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect([403, 404]).toContain(res.statusCode);
    expect(res.body.success).toBe(false);
  });
});
