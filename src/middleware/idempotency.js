const crypto = require('crypto')
const { pool } = require('../config/database')

// In-memory store for idempotency keys (use Redis in production)
const idempotencyStore = new Map()

const handleIdempotency = async (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key']
  
  if (!idempotencyKey) {
    return res.status(400).json({
      error: {
        code: 'FIELD_REQUIRED',
        field: 'idempotency-key',
        message: 'Idempotency-Key header is required'
      }
    })
  }
  
  const userId = req.user ? req.user.id : 'anonymous'
  const storeKey = `${userId}:${idempotencyKey}`
  
  // Check if we've seen this key before
  if (idempotencyStore.has(storeKey)) {
    const stored = idempotencyStore.get(storeKey)
    
    // Compare request body hash to detect payload changes
    const currentBodyHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(req.body))
      .digest('hex')
    
    if (stored.bodyHash !== currentBodyHash) {
      return res.status(409).json({
        error: {
          code: 'IDEMPOTENCY_VIOLATION',
          message: 'Idempotency key reused with different payload'
        }
      })
    }
    
    // Return cached response
    return res.status(stored.statusCode).json(stored.response)
  }
  
  // Store the request for future idempotency checks
  const bodyHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(req.body))
    .digest('hex')
  
  req.idempotencyKey = storeKey
  req.idempotencyBodyHash = bodyHash
  
  // Override res.json to cache the response
  const originalJson = res.json
  res.json = function(data) {
    // Cache successful responses (2xx status codes)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyStore.set(storeKey, {
        statusCode: res.statusCode,
        response: data,
        bodyHash: req.idempotencyBodyHash,
        timestamp: Date.now()
      })
      
      // Clean up old entries (keep for 24 hours)
      setTimeout(() => {
        idempotencyStore.delete(storeKey)
      }, 24 * 60 * 60 * 1000)
    }
    
    return originalJson.call(this, data)
  }
  
  next()
}

module.exports = {
  handleIdempotency
}