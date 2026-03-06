const express = require('express')
const { body } = require('express-validator')
const { pool } = require('../config/database')
const { authenticate, requireRole } = require('../middleware/auth')
const { handleValidationErrors } = require('../middleware/validation')
const { handleIdempotency } = require('../middleware/idempotency')

const router = express.Router()

// Creator application endpoint
router.post('/apply', 
  authenticate,
  requireRole(['creator']),
  handleIdempotency,
  [
    body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
    body('bio').trim().isLength({ min: 10 }).withMessage('Bio must be at least 10 characters'),
    body('portfolioUrl').optional().isURL().withMessage('Portfolio URL must be valid')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, bio, portfolioUrl } = req.body
      const userId = req.user.id
      
      // Check if user already has an application
      const existingApplication = await pool.query(
        'SELECT id, status FROM creator_applications WHERE user_id = $1',
        [userId]
      )
      
      if (existingApplication.rows.length > 0) {
        const application = existingApplication.rows[0]
        return res.status(200).json({
          applicationId: application.id,
          status: application.status
        })
      }
      
      // Create new application
      const result = await pool.query(
        'INSERT INTO creator_applications (user_id, name, bio, portfolio_url, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, status',
        [userId, name, bio, portfolioUrl, 'PENDING']
      )
      
      const application = result.rows[0]
      
      res.status(201).json({
        applicationId: application.id,
        status: application.status
      })
    } catch (error) {
      console.error('Creator application error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Application submission failed'
        }
      })
    }
  }
)

// Get creator application status
router.get('/application', authenticate, requireRole(['creator']), async (req, res) => {
  try {
    const userId = req.user.id
    
    const result = await pool.query(
      'SELECT id, name, bio, portfolio_url, status, created_at FROM creator_applications WHERE user_id = $1',
      [userId]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'No application found'
        }
      })
    }
    
    const application = result.rows[0]
    
    res.json({
      applicationId: application.id,
      name: application.name,
      bio: application.bio,
      portfolioUrl: application.portfolio_url,
      status: application.status,
      createdAt: application.created_at
    })
  } catch (error) {
    console.error('Get application error:', error)
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve application'
      }
    })
  }
})

module.exports = router