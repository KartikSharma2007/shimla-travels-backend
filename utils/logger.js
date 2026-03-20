const winston = require('winston');
const path = require('path');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}`
  )
);

const transports = [
  // Always log to console — Render captures stdout as logs in the dashboard
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat,
  }),
];

// Only write to disk files in development — Render filesystem is ephemeral
// so log files written there are lost on every redeploy anyway
if (process.env.NODE_ENV !== 'production') {
  try {
    const DailyRotateFile = require('winston-daily-rotate-file');
    transports.push(
      new DailyRotateFile({
        filename: path.join(process.cwd(), 'logs', 'application-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format: logFormat,
      }),
      new DailyRotateFile({
        filename: path.join(process.cwd(), 'logs', 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        level: 'error',
        format: logFormat,
      })
    );
  } catch (e) {
    // winston-daily-rotate-file not available — console only
  }
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'shimla-travels-api' },
  transports,
  exitOnError: false,
});

// Stream for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

module.exports = logger;
