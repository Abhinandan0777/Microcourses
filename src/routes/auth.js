const express = require('express')
const { body } = require('express-validator')
const { pool } = require('../config/database')
const { generateToken, hashPassword, comparePassword } = require('../config/auth')
const { authenticate } = require('../middleware/auth')
const { handleValidationErrors } = require('../middleware/validation')

const router = express.Router()

// Register endpoint
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
  body('role').isIn(['learner', 'creator']).withMessage('Role must be learner or creator')
], handleValidationErrors, async (req, res) => {
  try {
    const { email, password, name, role } = req.body
    
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    )
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: {
          code: 'ALREADY_EXISTS',
          field: 'email',
          message: 'User with this email already exists'
        }
      })
    }
    
    // Hash password and create user
    const passwordHash = await hashPassword(password)
    
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, passwordHash, role]
    )
    
    const user = result.rows[0]
    const token = generateToken({ userId: user.id, email: user.email, role: user.role })
    
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Registration failed'
      }
    })
  }
})

// Login endpoint
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body
    
    // Find user by email
    const result = await pool.query(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = $1',
      [email]
    )
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password'
        }
      })
    }
    
    const user = result.rows[0]
    
    // Verify password
    const isValidPassword = await comparePassword(password, user.password_hash)
    
    if (!isValidPassword) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password'
        }
      })
    }
    
    // Generate token
    const token = generateToken({ userId: user.id, email: user.email, role: user.role })
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Login failed'
      }
    })
  }
})

// Get current user profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const userId = req.user.id
    
    // Get fresh user data from database
    const result = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [userId]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        }
      })
    }
    
    const user = result.rows[0]
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.created_at
      }
    })
  } catch (error) {
    console.error('Get user profile error:', error)
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get user profile'
      }
    })
  }
})

module.exports = router