const rateLimit = require('express-rate-limit');

/** Generic API rate limiter */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

/** Stricter limiter for login endpoints to slow brute-force attempts */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' }
});

/** Stricter limiter for the USSD endpoint (per Africa's Talking callback) */
const ussdLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'END Too many requests. Please try again shortly.'
});

/** Centralized error handler */
function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
}

module.exports = { apiLimiter, loginLimiter, ussdLimiter, errorHandler };
