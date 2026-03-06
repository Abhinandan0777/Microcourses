const rateLimit = require('express-rate-limit')

const createRateLimit = (windowMs = 60000, max = 60) => {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => {
      // Rate limit per user if authenticated, otherwise per IP
      return req.user ? `user:${req.user.id}` : `ip:${req.ip}`
    },
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT',
          message: 'Too many requests, please try again later'
        }
      })
    },
    standardHeaders: true,
    legacyHeaders: false
  })
}

// Default rate limit: 60 requests per minute per user
const defaultRateLimit = createRateLimit(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 60
)

module.exports = {
  createRateLimit,
  defaultRateLimit
}