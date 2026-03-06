require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const path = require('path')

const { testConnection } = require('./config/database')
const { defaultRateLimit } = require('./middleware/rateLimit')

// Import routes
const authRoutes = require('./routes/auth')
const creatorRoutes = require('./routes/creators')
const courseRoutes = require('./routes/courses')
const creatorCourseRoutes = require('./routes/creator-courses')
const lessonRoutes = require('./routes/lessons')
const transcriptRoutes = require('./routes/transcripts')
const enrollmentRoutes = require('./routes/enrollments')
const certificateRoutes = require('./routes/certificates')
const adminRoutes = require('./routes/admin')

const app = express()
const PORT = process.env.PORT || 4000

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}))

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}))

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
}

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check (before rate limiting)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
})

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'MicroCourses API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  })
})

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working!',
    timestamp: new Date().toISOString()
  })
})

// Debug endpoint
app.get('/api/debug-env', (req, res) => {
  res.json({
    hasDatabase: !!process.env.DATABASE_URL,
    databaseHost: process.env.DATABASE_URL ? process.env.DATABASE_URL.split('@')[1]?.split('/')[0] : 'not found',
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  })
})

// Simple test endpoint without dependencies
app.post('/api/simple-test', (req, res) => {
  try {
    const { name, email } = req.body || {}
    
    res.json({
      success: true,
      message: 'Simple test works!',
      received: { name, email },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'SIMPLE_TEST_ERROR',
        message: error.message
      }
    })
  }
})

// Test registration endpoint
app.post('/api/test-register', async (req, res) => {
  try {
    const { name, email, password, role = 'learner' } = req.body
    
    // Simple response without bcrypt or JWT for now
    res.status(201).json({
      success: true,
      message: 'Test registration endpoint works!',
      user: {
        id: 1,
        name,
        email,
        role
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Test registration error:', error)
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Registration failed: ' + error.message
      }
    })
  }
})

// Database setup endpoint
app.post('/api/setup-db', async (req, res) => {
  try {
    const { pool } = require('./config/database')
    
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'learner',
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // Create courses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        creator_id INTEGER REFERENCES users(id),
        published BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    console.log('✅ Database tables created successfully')
    res.json({ 
      message: 'Database setup completed successfully!',
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Database setup error:', error)
    res.status(500).json({
      error: {
        code: 'SETUP_ERROR',
        message: 'Database setup failed: ' + error.message
      }
    })
  }
})

// Rate limiting (after health checks)
app.use('/api', defaultRateLimit)

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/creators', creatorRoutes)
app.use('/api/courses', courseRoutes)
app.use('/api/creator/courses', creatorCourseRoutes)
app.use('/api/lessons', lessonRoutes)
app.use('/api/lessons', transcriptRoutes)
app.use('/api', enrollmentRoutes)
app.use('/api/courses', certificateRoutes)
app.use('/api/certificates', certificateRoutes)
app.use('/api/admin', adminRoutes)

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')))
  
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'API endpoint not found'
        }
      })
    }
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'))
  })
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err)
  
  if (err.code === '23505') {
    return res.status(409).json({
      error: {
        code: 'ALREADY_EXISTS',
        message: 'Resource already exists'
      }
    })
  }
  
  if (err.code === '23503') {
    return res.status(400).json({
      error: {
        code: 'INVALID_REFERENCE',
        message: 'Referenced resource does not exist'
      }
    })
  }
  
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal server error occurred'
    }
  })
})

// Start server function
const startServer = async () => {
  try {
    if (process.env.NODE_ENV !== 'production') {
      await testConnection()
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`📊 Health check: http://localhost:${PORT}/health`)
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1)
    }
  }
}

// Start server only if this file is run directly (not imported)
if (require.main === module) {
  startServer()
}

module.exports = app