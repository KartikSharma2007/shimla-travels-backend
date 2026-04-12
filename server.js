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

connectDB();

// Daily cron job
const setupCronJobs = () => {
  try {
    const cron = require('node-cron');
    const { Booking } = require('./models');
    cron.schedule('0 2 * * *', async () => {
      try {
        const now = new Date();
        const h = await Booking.updateMany(
          { bookingType: 'hotel', status: { $in: ['upcoming', 'confirmed'] }, 'payment.status': 'completed', checkOut: { $lt: now } },
          { $set: { status: 'completed' } }
        );
        const p = await Booking.updateMany(
          { bookingType: 'package', status: { $in: ['upcoming', 'confirmed'] }, 'payment.status': 'completed', travelDate: { $lt: now } },
          { $set: { status: 'completed' } }
        );
        logger.info(`Auto-complete: ${h.modifiedCount} hotel + ${p.modifiedCount} package bookings completed.`);
      } catch (err) { logger.error(`Cron job failed: ${err.message}`); }
    });
    logger.info('Cron jobs scheduled: booking auto-complete runs daily at 02:00.');
  } catch (err) {
    logger.warn(`Cron jobs not started: ${err.message}`);
  }
};
setupCronJobs();

app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], scriptSrc: ["'self'"], imgSrc: ["'self'", "data:", "https:"] } } }));

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    logger.warn(`CORS blocked: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(hpp());
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use((req, res, next) => {
  if (req.body) req.body = mongoSanitize(req.body);
  if (req.query) req.query = mongoSanitize(req.query);
  if (req.params) req.params = mongoSanitize(req.params);
  next();
});

app.use(morgan('combined', { stream: logger.stream }));
app.use('/api', apiLimiter);
app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Shimla Travels API', version: '1.0.0' });
});

// Keep-alive ping for Render free tier / UptimeRobot
app.get('/ping', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// Debug endpoints removed — they exposed internal config publicly.

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
