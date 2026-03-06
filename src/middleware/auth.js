const { verifyToken } = require('../config/auth')
const { pool } = require('../config/database')

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization token required'
        }
      })
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    
    // Get user from database
    const userResult = await pool.query(
      'SELECT id, email, name, role FROM users WHERE id = $1',
      [decoded.userId]
    )
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token'
        }
      })
    }
    
    req.user = userResult.rows[0]
    next()
  } catch (error) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid token'
      }
    })
  }
}

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      })
    }
    
    const userRoles = Array.isArray(roles) ? roles : [roles]
    
    if (!userRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Insufficient permissions'
        }
      })
    }
    
    next()
  }
}

module.exports = {
  authenticate,
  requireRole
}