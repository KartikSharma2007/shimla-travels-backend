// tests/setup.js
// This file runs once before all tests.
// It starts an in-memory MongoDB instance so your real Atlas DB is never touched.
//
// Install the in-memory server:
//   npm install --save-dev mongodb-memory-server
//
// It auto-downloads a MongoDB binary on first run (~70MB, cached after that).

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

// ── Set test environment variables BEFORE app is imported ────────────────────
// These override your .env so tests never hit real Atlas / real Razorpay
process.env.NODE_ENV       = 'test';
process.env.JWT_SECRET     = 'test-jwt-secret-at-least-32-chars-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-chars';
process.env.JWT_EXPIRE     = '1h';
process.env.JWT_COOKIE_EXPIRE = '1';
process.env.GOOGLE_CLIENT_ID   = 'test-google-client-id';
process.env.RAZORPAY_KEY_ID    = 'rzp_test_mock_key';
process.env.RAZORPAY_KEY_SECRET = 'mock_secret';
process.env.EMAIL_USER     = 'test@test.com';
process.env.EMAIL_PASS     = 'test-pass';
process.env.EMAIL_FROM     = 'test@test.com';
process.env.LOG_LEVEL      = 'silent';   // suppress Winston logs during tests

// ── Start in-memory MongoDB before all tests ─────────────────────────────────
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}, 60000); // allow 60s for first-time binary download

// ── Clear all collections between tests ──────────────────────────────────────
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// ── Stop MongoDB after all tests ──────────────────────────────────────────────
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
});
