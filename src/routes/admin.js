const express = require('express')
const { body, param, query } = require('express-validator')
const { pool } = require('../config/database')
const { authenticate, requireRole } = require('../middleware/auth')
const { handleValidationErrors } = require('../middleware/validation')

const router = express.Router()

// Get pending creator applications
router.get('/creators',
  authenticate,
  requireRole(['admin']),
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    query('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED']).withMessage('Invalid status')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10
      const offset = parseInt(req.query.offset) || 0
      const status = req.query.status || 'PENDING'
      
      const result = await pool.query(`
        SELECT 
          ca.id, ca.name, ca.bio, ca.portfolio_url, ca.status, ca.created_at,
          u.id as user_id, u.email, u.name as user_name
        FROM creator_applications ca
        JOIN users u ON ca.user_id = u.id
        WHERE ca.status = $1
        ORDER BY ca.created_at ASC
        LIMIT $2 OFFSET $3
      `, [status, limit + 1, offset])
      
      const applications = result.rows
      const hasMore = applications.length > limit
      if (hasMore) {
        applications.pop()
      }
      
      const items = applications.map(app => ({
        applicationId: app.id,
        name: app.name,
        bio: app.bio,
        portfolioUrl: app.portfolio_url,
        status: app.status,
        createdAt: app.created_at,
        user: {
          id: app.user_id,
          email: app.email,
          name: app.user_name
        }
      }))
      
      res.json({
        items,
        next_offset: hasMore ? offset + limit : null
      })
    } catch (error) {
      console.error('Get creator applications error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve creator applications'
        }
      })
    }
  }
)

// Approve or reject creator application
router.put('/creators/:applicationId/approve',
  authenticate,
  requireRole(['admin']),
  [
    param('applicationId').isInt().withMessage('Application ID must be an integer')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const applicationId = req.params.applicationId
      
      // Check if application exists and is pending
      const appResult = await pool.query(
        'SELECT id, status, user_id FROM creator_applications WHERE id = $1',
        [applicationId]
      )
      
      if (appResult.rows.length === 0) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Creator application not found'
          }
        })
      }
      
      const application = appResult.rows[0]
      
      if (application.status !== 'PENDING') {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: `Application is already ${application.status.toLowerCase()}`
          }
        })
      }
      
      // Start transaction to update both application status and user role
      await pool.query('BEGIN')
      
      try {
        // Update application status
        await pool.query(
          'UPDATE creator_applications SET status = $1 WHERE id = $2',
          ['APPROVED', applicationId]
        )
        
        // Update user role to creator
        await pool.query(
          'UPDATE users SET role = $1 WHERE id = $2',
          ['creator', application.user_id]
        )
        
        await pool.query('COMMIT')
        
        res.json({
          applicationId: parseInt(applicationId),
          status: 'APPROVED',
          message: 'Creator application approved successfully. User role updated to creator.'
        })
      } catch (error) {
        await pool.query('ROLLBACK')
        throw error
      }
    } catch (error) {
      console.error('Approve creator error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to approve creator application'
        }
      })
    }
  }
)

router.put('/creators/:applicationId/reject',
  authenticate,
  requireRole(['admin']),
  [
    param('applicationId').isInt().withMessage('Application ID must be an integer'),
    body('reason').optional().trim().isLength({ min: 1 }).withMessage('Reason cannot be empty')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const applicationId = req.params.applicationId
      const { reason } = req.body
      
      // Check if application exists and is pending
      const appResult = await pool.query(
        'SELECT id, status FROM creator_applications WHERE id = $1',
        [applicationId]
      )
      
      if (appResult.rows.length === 0) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Creator application not found'
          }
        })
      }
      
      const application = appResult.rows[0]
      
      if (application.status !== 'PENDING') {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: `Application is already ${application.status.toLowerCase()}`
          }
        })
      }
      
      // Update application status
      await pool.query(
        'UPDATE creator_applications SET status = $1 WHERE id = $2',
        ['REJECTED', applicationId]
      )
      
      res.json({
        applicationId: parseInt(applicationId),
        status: 'REJECTED',
        reason: reason || 'No reason provided',
        message: 'Creator application rejected'
      })
    } catch (error) {
      console.error('Reject creator error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to reject creator application'
        }
      })
    }
  }
)

// Get all courses for review
router.get('/courses',
  authenticate,
  requireRole(['admin']),
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    query('published').optional().isBoolean().withMessage('Published must be boolean')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10
      const offset = parseInt(req.query.offset) || 0
      const published = req.query.published !== undefined ? req.query.published === 'true' : null
      
      let whereClause = ''
      const params = []
      
      if (published !== null) {
        whereClause = 'WHERE c.published = $1'
        params.push(published)
      }
      
      const result = await pool.query(`
        SELECT 
          c.id, c.title, c.description, c.thumbnail_url, c.published, c.created_at,
          u.name as creator_name, u.email as creator_email,
          COUNT(l.id) as lesson_count,
          COUNT(e.id) as enrollment_count
        FROM courses c
        JOIN users u ON c.creator_id = u.id
        LEFT JOIN lessons l ON c.id = l.course_id
        LEFT JOIN enrollments e ON c.id = e.course_id
        ${whereClause}
        GROUP BY c.id, u.name, u.email
        ORDER BY c.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit + 1, offset])
      
      const courses = result.rows
      const hasMore = courses.length > limit
      if (hasMore) {
        courses.pop()
      }
      
      const items = courses.map(course => ({
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnailUrl: course.thumbnail_url,
        published: course.published,
        createdAt: course.created_at,
        creator: {
          name: course.creator_name,
          email: course.creator_email
        },
        lessonCount: parseInt(course.lesson_count),
        enrollmentCount: parseInt(course.enrollment_count)
      }))
      
      res.json({
        items,
        next_offset: hasMore ? offset + limit : null
      })
    } catch (error) {
      console.error('Get admin courses error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve courses'
        }
      })
    }
  }
)

// Publish or unpublish course
router.put('/courses/:courseId/publish',
  authenticate,
  requireRole(['admin']),
  [
    param('courseId').isInt().withMessage('Course ID must be an integer'),
    body('published').isBoolean().withMessage('Published status is required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const courseId = req.params.courseId
      const { published } = req.body
      
      // Check if course exists
      const courseResult = await pool.query(
        'SELECT id, title, published FROM courses WHERE id = $1',
        [courseId]
      )
      
      if (courseResult.rows.length === 0) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Course not found'
          }
        })
      }
      
      const course = courseResult.rows[0]
      
      // Update published status
      await pool.query(
        'UPDATE courses SET published = $1 WHERE id = $2',
        [published, courseId]
      )
      
      res.json({
        courseId: parseInt(courseId),
        title: course.title,
        published,
        message: `Course ${published ? 'published' : 'unpublished'} successfully`
      })
    } catch (error) {
      console.error('Update course publish status error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update course publish status'
        }
      })
    }
  }
)

// Get platform statistics
router.get('/stats',
  authenticate,
  requireRole(['admin']),
  async (req, res) => {
    try {
      // Get various statistics
      const [
        usersResult,
        coursesResult,
        enrollmentsResult,
        certificatesResult,
        applicationsResult
      ] = await Promise.all([
        pool.query(`
          SELECT 
            role,
            COUNT(*) as count
          FROM users 
          GROUP BY role
        `),
        pool.query(`
          SELECT 
            published,
            COUNT(*) as count
          FROM courses 
          GROUP BY published
        `),
        pool.query(`
          SELECT COUNT(*) as total_enrollments
          FROM enrollments
        `),
        pool.query(`
          SELECT COUNT(*) as total_certificates
          FROM certificates
        `),
        pool.query(`
          SELECT 
            status,
            COUNT(*) as count
          FROM creator_applications 
          GROUP BY status
        `)
      ])
      
      // Process user stats
      const userStats = {}
      usersResult.rows.forEach(row => {
        userStats[row.role] = parseInt(row.count)
      })
      
      // Process course stats
      const courseStats = {}
      coursesResult.rows.forEach(row => {
        courseStats[row.published ? 'published' : 'unpublished'] = parseInt(row.count)
      })
      
      // Process application stats
      const applicationStats = {}
      applicationsResult.rows.forEach(row => {
        applicationStats[row.status.toLowerCase()] = parseInt(row.count)
      })
      
      res.json({
        users: {
          total: Object.values(userStats).reduce((sum, count) => sum + count, 0),
          ...userStats
        },
        courses: {
          total: Object.values(courseStats).reduce((sum, count) => sum + count, 0),
          ...courseStats
        },
        enrollments: {
          total: parseInt(enrollmentsResult.rows[0].total_enrollments)
        },
        certificates: {
          total: parseInt(certificatesResult.rows[0].total_certificates)
        },
        applications: {
          total: Object.values(applicationStats).reduce((sum, count) => sum + count, 0),
          ...applicationStats
        }
      })
    } catch (error) {
      console.error('Get admin stats error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve statistics'
        }
      })
    }
  }
)

// Get recent activity
router.get('/activity',
  authenticate,
  requireRole(['admin']),
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20
      
      // Get recent activities from various tables
      const activities = []
      
      // Recent user registrations
      const usersResult = await pool.query(`
        SELECT 'user_registered' as type, name, email, role, created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT $1
      `, [limit])
      
      usersResult.rows.forEach(row => {
        activities.push({
          type: 'user_registered',
          description: `New ${row.role} registered: ${row.name} (${row.email})`,
          timestamp: row.created_at
        })
      })
      
      // Recent course creations
      const coursesResult = await pool.query(`
        SELECT 'course_created' as type, c.title, u.name as creator_name, c.created_at
        FROM courses c
        JOIN users u ON c.creator_id = u.id
        ORDER BY c.created_at DESC
        LIMIT $1
      `, [limit])
      
      coursesResult.rows.forEach(row => {
        activities.push({
          type: 'course_created',
          description: `Course created: "${row.title}" by ${row.creator_name}`,
          timestamp: row.created_at
        })
      })
      
      // Recent enrollments
      const enrollmentsResult = await pool.query(`
        SELECT 'enrollment' as type, u.name as user_name, c.title as course_title, e.created_at
        FROM enrollments e
        JOIN users u ON e.user_id = u.id
        JOIN courses c ON e.course_id = c.id
        ORDER BY e.created_at DESC
        LIMIT $1
      `, [limit])
      
      enrollmentsResult.rows.forEach(row => {
        activities.push({
          type: 'enrollment',
          description: `${row.user_name} enrolled in "${row.course_title}"`,
          timestamp: row.created_at
        })
      })
      
      // Recent certificates
      const certificatesResult = await pool.query(`
        SELECT 'certificate_issued' as type, u.name as user_name, c.title as course_title, cert.issued_at
        FROM certificates cert
        JOIN users u ON cert.user_id = u.id
        JOIN courses c ON cert.course_id = c.id
        ORDER BY cert.issued_at DESC
        LIMIT $1
      `, [limit])
      
      certificatesResult.rows.forEach(row => {
        activities.push({
          type: 'certificate_issued',
          description: `Certificate issued to ${row.user_name} for "${row.course_title}"`,
          timestamp: row.issued_at
        })
      })
      
      // Sort all activities by timestamp and limit
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      
      res.json({
        activities: activities.slice(0, limit)
      })
    } catch (error) {
      console.error('Get admin activity error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve activity'
        }
      })
    }
  }
)

module.exports = router