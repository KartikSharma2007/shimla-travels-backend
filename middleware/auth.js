const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

/**
 * Authentication Middleware
 * Handles JWT verification and user authentication
 */

// Verify JWT token and attach user to request
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Check for token in cookies (optional)
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
        error: 'NO_TOKEN',
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if user still exists
      const user = await User.findById(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User no longer exists',
          error: 'USER_NOT_FOUND',
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User account is deactivated',
          error: 'ACCOUNT_INACTIVE',
        });
      }

      // Check if user changed password after token was issued
      if (user.changedPasswordAfter(decoded.iat)) {
        return res.status(401).json({
          success: false,
          message: 'Password recently changed. Please log in again',
          error: 'PASSWORD_CHANGED',
        });
      }

      // Attach user to request object
      req.user = user;
      req.userId = user._id;
      req.token = token;

      next();
    } catch (jwtError) {
      logger.error(`JWT verification failed: ${jwtError.message}`);

      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please log in again',
          error: 'TOKEN_EXPIRED',
        });
      }

      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Please log in again',
          error: 'INVALID_TOKEN',
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
        error: 'TOKEN_VERIFICATION_FAILED',
      });
    }
  } catch (error) {
    logger.error(`Auth middleware error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message,
    });
  }
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (user && user.isActive) {
          req.user = user;
          req.userId = user._id;
        }
      } catch (error) {
        // Silently fail for optional auth
        logger.debug(`Optional auth failed: ${error.message}`);
      }
    }

    next();
  } catch (error) {
    next();
  }
};

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
        error: 'NOT_AUTHENTICATED',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to perform this action',
        error: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    next();
  };
};

// Check if user owns resource or is admin
const ownsResourceOrAdmin = (getResourceUserId) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
        error: 'NOT_AUTHENTICATED',
      });
    }

    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    try {
      const resourceUserId = await getResourceUserId(req);

      if (resourceUserId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this resource',
          error: 'NOT_RESOURCE_OWNER',
        });
      }

      next();
    } catch (error) {
      logger.error(`Resource ownership check failed: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Error checking resource ownership',
        error: error.message,
      });
    }
  };
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Generate refresh token — uses a SEPARATE secret from the access token.
// This means a stolen access token cannot be used as a refresh token.
// Set JWT_REFRESH_SECRET in your .env file (different value from JWT_SECRET).
const generateRefreshToken = (userId) => {
  const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!process.env.JWT_REFRESH_SECRET) {
    logger.warn('JWT_REFRESH_SECRET is not set — falling back to JWT_SECRET. Add JWT_REFRESH_SECRET to .env for proper security.');
  }
  return jwt.sign(
    { id: userId, type: 'refresh' },
    refreshSecret,
    { expiresIn: '30d' }
  );
};

// Set token cookie
const setTokenCookie = (res, token) => {
  const cookieOptions = {
    expires: new Date(
      Date.now() + (process.env.JWT_COOKIE_EXPIRE || 7) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };

  res.cookie('token', token, cookieOptions);
};

// Clear token cookie
const clearTokenCookie = (res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
};

module.exports = {
  protect,
  optionalAuth,
  authorize,
  ownsResourceOrAdmin,
  generateToken,
  generateRefreshToken,
  setTokenCookie,
  clearTokenCookie,
};
