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

const app = express();

// Connect to database
connectDB();

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
