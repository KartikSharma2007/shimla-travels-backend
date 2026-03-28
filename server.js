const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const hpp = require('hpp');
const mongoSanitize = require('mongo-sanitize');
require('dotenv').config();

const connectDB = require('./config/database');
const logger = require('./utils/logger');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const { runStartupEmailTest } = require('./utils/emailService');

const app = express();

// Connect to database
connectDB();

// ── Startup email test — runs once when server starts ─────────────────────────
// Sends a test email to EMAIL_USER. Shows ✅ or ❌ in terminal immediately.
// If this fails, booking/cancel emails will also fail.
runStartupEmailTest();

// ── Fix #17 — Daily cron job: auto-complete bookings whose travel dates have passed ──
// Previously, bookings were only auto-completed when the specific user fetched theirs.
// If a user never logged back in, confirmed bookings stayed "confirmed" forever,
// making admin stats wrong. This job runs every day at 2:00 AM server time.
const setupCronJobs = () => {
  try {
    const cron = require('node-cron');
    const { Booking } = require('./models');

    cron.schedule('0 2 * * *', async () => {
      logger.info('Running daily booking auto-complete job...');
      try {
        const now = new Date();

        // Auto-complete hotel bookings where checkout date has passed
        const hotelResult = await Booking.updateMany(
          {
            bookingType: 'hotel',
            status: { $in: ['upcoming', 'confirmed'] },
            'payment.status': 'completed',
            checkOut: { $lt: now },
          },
          { $set: { status: 'completed' } }
        );

        // Auto-complete package bookings where travel date has passed
        const packageResult = await Booking.updateMany(
          {
            bookingType: 'package',
            status: { $in: ['upcoming', 'confirmed'] },
            'payment.status': 'completed',
            travelDate: { $lt: now },
          },
          { $set: { status: 'completed' } }
        );

        logger.info(
          `Booking auto-complete: ${hotelResult.modifiedCount} hotel + ${packageResult.modifiedCount} package bookings completed.`
        );
      } catch (err) {
        logger.error(`Daily booking cron job failed: ${err.message}`);
      }
    });

    logger.info('Cron jobs scheduled: booking auto-complete runs daily at 02:00.');
  } catch (err) {
    // node-cron not installed yet — warn but don't crash the server
    logger.warn(`Cron jobs not started (node-cron missing?): ${err.message}. Run: npm install node-cron`);
  }
};

setupCronJobs();

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// FIX: CORS now reads from env variable, no hardcoded LAN IPs
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(hpp());
app.use(compression());

// FIX: body limit reduced from 50mb to 2mb (was DoS vulnerability)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// MongoDB Sanitization
app.use((req, res, next) => {
  if (req.body) req.body = mongoSanitize(req.body);
  if (req.query) req.query = mongoSanitize(req.query);
  if (req.params) req.params = mongoSanitize(req.params);
  next();
});

app.use(morgan('combined', { stream: logger.stream }));
app.use('/api', apiLimiter);

// API Routes
app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Shimla Travels API',
    version: '1.0.0',
    documentation: '/api/health',
  });
});


// ── Email diagnosis endpoint ──────────────────────────────────────────────────
// URL: https://shimla-travels-backend.onrender.com/api/v1/email-diagnosis
app.get('/api/v1/email-diagnosis', async (req, res) => {
  const apiKey = process.env.RESEND_API_KEY;
  const report = {
    timestamp: new Date().toISOString(),
    server: 'RENDER (cloud)',
    emailService: 'Resend (HTTP API — not SMTP)',
    config: {
      RESEND_API_KEY: apiKey ? `SET (${apiKey.substring(0, 10)}...)` : 'NOT SET — add this in Render Environment tab',
      RESEND_FROM: process.env.RESEND_FROM || 'not set (will use onboarding@resend.dev)',
      SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || 'not set',
      NODE_ENV: process.env.NODE_ENV || 'not set',
      CLIENT_URL: process.env.CLIENT_URL || 'not set',
    },
    test: 'not run',
    fix: null,
  };

  if (!apiKey) {
    report.test = 'SKIPPED — RESEND_API_KEY is missing';
    report.fix = 'Go to resend.com → sign up free → API Keys → create key → add RESEND_API_KEY to Render Environment tab';
    return res.json(report);
  }

  try {
    const { Resend } = require('resend');
    const resend = new Resend(apiKey);
    const to = process.env.SUPPORT_EMAIL || 'shimlaatravels@gmail.com';
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM || 'onboarding@resend.dev',
      to: [to],
      subject: 'Render Email Diagnosis Test — ' + new Date().toISOString(),
      text: 'Resend email is working from Render!',
    });
    if (error) {
      report.test = 'FAILED';
      report.error = JSON.stringify(error);
      report.fix = 'Resend API key may be invalid. Check it at resend.com dashboard.';
    } else {
      report.test = 'SUCCESS';
      report.resendId = data.id;
      report.fix = 'Everything is working! Emails will be sent to users on booking/cancel.';
    }
  } catch (err) {
    report.test = 'EXCEPTION';
    report.error = err.message;
    report.fix = 'Check RESEND_API_KEY value in Render Environment tab.';
  }

  res.json(report);
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

module.exports = app;