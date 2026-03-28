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


// ── Email diagnosis endpoint — open in browser to see what is wrong ───────────
// URL: https://shimla-travels-backend.onrender.com/api/v1/email-diagnosis
app.get('/api/v1/email-diagnosis', async (req, res) => {
  const nodemailer = require('nodemailer');
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  const report = {
    timestamp: new Date().toISOString(),
    server: 'RENDER (cloud)',
    emailConfig: {
      EMAIL_USER: user || 'NOT SET',
      EMAIL_PASS_SET: !!pass,
      EMAIL_PASS_LENGTH: pass ? pass.replace(/\s/g, '').length : 0,
      EMAIL_PASS_VALUE: pass || 'NOT SET',
      EMAIL_FROM: process.env.EMAIL_FROM || 'not set',
    },
    environment: {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      CLIENT_URL: process.env.CLIENT_URL || 'not set',
      CORS_ORIGINS: process.env.CORS_ORIGINS || 'not set',
    },
    smtpTest: 'not run',
    fix: null,
  };

  if (!user || !pass) {
    report.smtpTest = 'SKIPPED - missing credentials';
    report.fix = 'Go to Render Dashboard → Environment tab → add EMAIL_USER and EMAIL_PASS';
    return res.json(report);
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 587, secure: false,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });
    const info = await transporter.sendMail({
      from: user, to: user,
      subject: 'Render Diagnosis Test - ' + new Date().toISOString(),
      text: 'Email works from Render!',
    });
    report.smtpTest = 'SUCCESS';
    report.messageId = info.messageId;
    report.fix = 'Email is working! If users not getting emails, check their SPAM folder.';
  } catch (err) {
    report.smtpTest = 'FAILED';
    report.error = err.message;
    report.errorCode = err.code || 'none';
    if (err.message.includes('535') || err.message.includes('BadCredentials')) {
      report.fix = 'EMAIL_PASS is wrong or expired. Go to myaccount.google.com/apppasswords, create new App Password, update in Render Environment tab.';
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT' || err.message.includes('connect')) {
      report.fix = 'RENDER BLOCKS PORT 587. You must switch to Resend.com API (free). Cannot use nodemailer SMTP on Render free tier.';
      report.renderBlocksSmtp = true;
    } else {
      report.fix = 'Unknown error - see error field above';
    }
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
