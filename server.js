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

connectDB();
runStartupEmailTest();

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

// Security
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], scriptSrc: ["'self'"], imgSrc: ["'self'", "data:", "https:"] } } }));

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
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

// Root
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Shimla Travels API', version: '1.0.0' });
});

// ── Email diagnosis ───────────────────────────────────────────────────────────
app.get('/api/v1/email-diagnosis', async (req, res) => {
  const apiKey = process.env.BREVO_API_KEY;
  res.json({
    timestamp: new Date().toISOString(),
    emailService: 'Brevo (HTTP API — works on Render free tier)',
    BREVO_API_KEY: apiKey ? `SET (${apiKey.substring(0, 12)}...)` : 'NOT SET — add to Render Environment tab',
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || 'not set',
    NODE_ENV: process.env.NODE_ENV,
    CLIENT_URL: process.env.CLIENT_URL,
    next: 'Open /api/v1/test-send-email?to=youremail@gmail.com to test',
  });
});

// ── Test send email ───────────────────────────────────────────────────────────
app.get('/api/v1/test-send-email', async (req, res) => {
  const https = require('https');
  const apiKey = process.env.BREVO_API_KEY;
  const toEmail = req.query.to;

  if (!toEmail) return res.json({ error: 'Add ?to=youremail@gmail.com to the URL' });
  if (!apiKey) return res.json({ error: 'BREVO_API_KEY not set on Render — add it in Environment tab' });

  const payload = JSON.stringify({
    sender: { name: 'Shimla Travels', email: 'shimlaatravels@gmail.com' },
    to: [{ email: toEmail }],
    subject: 'Test Email from Shimla Travels — ' + new Date().toISOString(),
    htmlContent: '<h2>Test Email</h2><p>Brevo email is working from Render!</p>',
    textContent: 'Test email from Shimla Travels. Brevo is working!',
  });

  const options = {
    hostname: 'api.brevo.com',
    path: '/v3/smtp/email',
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
  };

  const req2 = https.request(options, (r) => {
    let data = '';
    r.on('data', c => data += c);
    r.on('end', () => {
      if (r.statusCode >= 200 && r.statusCode < 300) {
        res.json({ success: true, to: toEmail, message: 'Email sent! Check inbox AND spam folder of ' + toEmail });
      } else {
        try { res.json({ success: false, to: toEmail, error: JSON.parse(data) }); }
        catch { res.json({ success: false, to: toEmail, error: data }); }
      }
    });
  });
  req2.on('error', e => res.json({ success: false, error: e.message }));
  req2.write(payload);
  req2.end();
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