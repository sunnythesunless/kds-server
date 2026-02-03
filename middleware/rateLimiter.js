const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

// General rate limiter
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Use ipKeyGenerator to safely handle IPv6
  keyGenerator: (req) => {
    return ipKeyGenerator(req, { ipv6Subnet: 64 }); // Group /64 subnet (typical for IPv6 clients)
  },
});

// Login-specific limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many login attempts, try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return ipKeyGenerator(req, { ipv6Subnet: 64 });
  },
});

module.exports = { rateLimiter, loginLimiter };