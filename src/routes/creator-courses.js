const express = require('express')
const { body, param } = require('express-validator')
const { pool } = require('../config/database')
const { authenticate, requireRole } = require('../middleware/auth')
const { handleValidationErrors } = require('../middleware/validation')
const { handleIdempotency } = require('../middleware/idempotency')

const router = express.Router()

// Create course (Creator only)
router.post('/', 
  authenticate,
  requireRole(['creator']),
  handleIdempotency,
  [
    body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
    body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
    body('thumbnailUrl').optional().isURL().withMessage('Thumbnail URL must be valid'),
    body('published').optional().isBoolean().withMessage('Published must be boolean')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { title, description, thumbnailUrl, published = false } = req.body
      const creatorId = req.user.id
      
      // Check if creator is approved
      const applicationResult = await pool.query(
        'SELECT status FROM creator_applications WHERE user_id = $1',
        [creatorId]
      )
      
      if (applicationResult.rows.length === 0 || applicationResult.rows[0].status !== 'APPROVED') {
        return res.status(403).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Creator application must be approved first'
          }
        })
      }
      
      const result = await pool.query(
        'INSERT INTO courses (creator_id, title, description, thumbnail_url, published) VALUES ($1, $2, $3, $4, $5) RETURNING id, title, description, thumbnail_url, published, created_at',
        [creatorId, title, description, thumbnailUrl, published]
      )
      
      const course = result.rows[0]
      
      res.status(201).json({
        courseId: course.id,
        title: course.title,
        description: course.description,
        thumbnailUrl: course.thumbnail_url,
        published: course.published,
        createdAt: course.created_at
      })
    } catch (error) {
      console.error('Create course error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Course creation failed'
        }
      })
    }
  }
)

// Update course
router.put('/:courseId',
  authenticate,
  requireRole(['creator']),
  [
    param('courseId').isInt().withMessage('Course ID must be an integer'),
    body('title').optional().trim().isLength({ min: 1 }).withMessage('Title cannot be empty'),
    body('description').optional().trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
    body('thumbnailUrl').optional().isURL().withMessage('Thumbnail URL must be valid'),
    body('published').optional().isBoolean().withMessage('Published must be boolean')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const courseId = req.params.courseId
      const creatorId = req.user.id
      const updates = req.body
      
      // Check if course exists and belongs to creator
      const courseResult = await pool.query(
        'SELECT id, creator_id FROM courses WHERE id = $1',
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
      
      if (courseResult.rows[0].creator_id !== creatorId) {
        return res.status(403).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authorized to update this course'
          }
        })
      }
      
      // Build update query
      const updateFields = []
      const values = []
      let paramCount = 1
      
      Object.keys(updates).forEach(key => {
        if (['title', 'description', 'thumbnailUrl', 'published'].includes(key)) {
          const dbField = key === 'thumbnailUrl' ? 'thumbnail_url' : key
          updateFields.push(`${dbField} = $${paramCount}`)
          values.push(updates[key])
          paramCount++
        }
      })
      
      if (updateFields.length === 0) {
        return res.status(400).json({
          error: {
            code: 'FIELD_REQUIRED',
            message: 'At least one field must be provided for update'
          }
        })
      }
      
      values.push(courseId)
      
      const updateQuery = `
        UPDATE courses 
        SET ${updateFields.join(', ')} 
        WHERE id = $${paramCount} 
        RETURNING id, title, description, thumbnail_url, published, created_at
      `
      
      const result = await pool.query(updateQuery, values)
      const course = result.rows[0]
      
      res.json({
        courseId: course.id,
        title: course.title,
        description: course.description,
        thumbnailUrl: course.thumbnail_url,
        published: course.published,
        createdAt: course.created_at
      })
    } catch (error) {
      console.error('Update course error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Course update failed'
        }
      })
    }
  }
)

// Delete course
router.delete('/:courseId',
  authenticate,
  requireRole(['creator']),
  [
    param('courseId').isInt().withMessage('Course ID must be an integer')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const courseId = req.params.courseId
      const creatorId = req.user.id
      
      // Check if course exists and belongs to creator
      const courseResult = await pool.query(
        'SELECT id, creator_id FROM courses WHERE id = $1',
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
      
      if (courseResult.rows[0].creator_id !== creatorId) {
        return res.status(403).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authorized to delete this course'
          }
        })
      }
      
      // Delete course (cascading will handle related records)
      await pool.query('DELETE FROM courses WHERE id = $1', [courseId])
      
      res.status(204).send()
    } catch (error) {
      console.error('Delete course error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Course deletion failed'
        }
      })
    }
  }
)

// Get creator's courses
router.get('/',
  authenticate,
  requireRole(['creator']),
  async (req, res) => {
    try {
      const creatorId = req.user.id
      
      const result = await pool.query(`
        SELECT 
          c.id, c.title, c.description, c.thumbnail_url, c.published, c.created_at,
          COUNT(l.id) as lesson_count,
          COUNT(e.id) as enrollment_count
        FROM courses c
        LEFT JOIN lessons l ON c.id = l.course_id
        LEFT JOIN enrollments e ON c.id = e.course_id
        WHERE c.creator_id = $1
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `, [creatorId])
      
      const courses = result.rows.map(course => ({
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnailUrl: course.thumbnail_url,
        published: course.published,
        lessonCount: parseInt(course.lesson_count),
        enrollmentCount: parseInt(course.enrollment_count),
        createdAt: course.created_at
      }))
      
      res.json({ courses })
    } catch (error) {
      console.error('Get creator courses error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve courses'
        }
      })
    }
  }
)

// Add lesson to course
router.post('/:courseId/lessons',
  authenticate,
  requireRole(['creator']),
  handleIdempotency,
  [
    param('courseId').isInt().withMessage('Course ID must be an integer'),
    body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
    body('contentUrl').isURL().withMessage('Content URL must be valid'),
    body('durationSec').isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
    body('order').isInt({ min: 1 }).withMessage('Order must be a positive integer')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const courseId = req.params.courseId
      const { title, contentUrl, durationSec, order } = req.body
      const creatorId = req.user.id
      
      // Check if course exists and belongs to creator
      const courseResult = await pool.query(
        'SELECT id, creator_id FROM courses WHERE id = $1',
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
      
      if (courseResult.rows[0].creator_id !== creatorId) {
        return res.status(403).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authorized to add lessons to this course'
          }
        })
      }
      
      // Check if order is unique for this course
      const orderResult = await pool.query(
        'SELECT id FROM lessons WHERE course_id = $1 AND "order" = $2',
        [courseId, order]
      )
      
      if (orderResult.rows.length > 0) {
        return res.status(409).json({
          error: {
            code: 'ORDER_CONFLICT',
            field: 'order',
            message: 'Lesson order must be unique within the course'
          }
        })
      }
      
      const result = await pool.query(
        'INSERT INTO lessons (course_id, title, content_url, duration_sec, "order") VALUES ($1, $2, $3, $4, $5) RETURNING id, title, content_url, duration_sec, "order", created_at',
        [courseId, title, contentUrl, durationSec, order]
      )
      
      const lesson = result.rows[0]
      
      res.status(201).json({
        lessonId: lesson.id,
        title: lesson.title,
        contentUrl: lesson.content_url,
        durationSec: lesson.duration_sec,
        order: lesson.order,
        createdAt: lesson.created_at
      })
    } catch (error) {
      if (error.code === '23505' && error.constraint && error.constraint.includes('order')) {
        return res.status(409).json({
          error: {
            code: 'ORDER_CONFLICT',
            field: 'order',
            message: 'Lesson order must be unique within the course'
          }
        })
      }
      
      console.error('Add lesson error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Lesson creation failed'
        }
      })
    }
  }
)

// Get lessons for a course
router.get('/:courseId/lessons',
  authenticate,
  requireRole(['creator']),
  [
    param('courseId').isInt().withMessage('Course ID must be an integer')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const courseId = req.params.courseId
      const creatorId = req.user.id
      
      // Check if course exists and belongs to creator
      const courseResult = await pool.query(
        'SELECT id, creator_id FROM courses WHERE id = $1',
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
      
      if (courseResult.rows[0].creator_id !== creatorId) {
        return res.status(403).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authorized to view lessons for this course'
          }
        })
      }
      
      const result = await pool.query(
        'SELECT id, title, content_url, duration_sec, "order", created_at FROM lessons WHERE course_id = $1 ORDER BY "order"',
        [courseId]
      )
      
      const lessons = result.rows.map(lesson => ({
        id: lesson.id,
        title: lesson.title,
        contentUrl: lesson.content_url,
        durationSec: lesson.duration_sec,
        order: lesson.order,
        createdAt: lesson.created_at
      }))
      
      res.json({ lessons })
    } catch (error) {
      console.error('Get course lessons error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve lessons'
        }
      })
    }
  }
)

// Update lesson
router.put('/:courseId/lessons/:lessonId',
  authenticate,
  requireRole(['creator']),
  [
    param('courseId').isInt().withMessage('Course ID must be an integer'),
    param('lessonId').isInt().withMessage('Lesson ID must be an integer'),
    body('title').optional().trim().isLength({ min: 1 }).withMessage('Title cannot be empty'),
    body('contentUrl').optional().isURL().withMessage('Content URL must be valid'),
    body('durationSec').optional().isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
    body('order').optional().isInt({ min: 1 }).withMessage('Order must be a positive integer')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { courseId, lessonId } = req.params
      const updates = req.body
      const creatorId = req.user.id
      
      // Check if lesson exists and belongs to creator's course
      const lessonResult = await pool.query(`
        SELECT l.id, l.course_id, c.creator_id
        FROM lessons l
        JOIN courses c ON l.course_id = c.id
        WHERE l.id = $1 AND l.course_id = $2
      `, [lessonId, courseId])
      
      if (lessonResult.rows.length === 0) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Lesson not found'
          }
        })
      }
      
      if (lessonResult.rows[0].creator_id !== creatorId) {
        return res.status(403).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authorized to update this lesson'
          }
        })
      }
      
      // Check order uniqueness if order is being updated
      if (updates.order) {
        const orderResult = await pool.query(
          'SELECT id FROM lessons WHERE course_id = $1 AND "order" = $2 AND id != $3',
          [courseId, updates.order, lessonId]
        )
        
        if (orderResult.rows.length > 0) {
          return res.status(409).json({
            error: {
              code: 'ORDER_CONFLICT',
              field: 'order',
              message: 'Lesson order must be unique within the course'
            }
          })
        }
      }
      
      // Build update query
      const updateFields = []
      const values = []
      let paramCount = 1
      
      Object.keys(updates).forEach(key => {
        if (['title', 'contentUrl', 'durationSec', 'order'].includes(key)) {
          const dbField = key === 'contentUrl' ? 'content_url' : 
                         key === 'durationSec' ? 'duration_sec' : 
                         key === 'order' ? '"order"' : key
          updateFields.push(`${dbField} = $${paramCount}`)
          values.push(updates[key])
          paramCount++
        }
      })
      
      if (updateFields.length === 0) {
        return res.status(400).json({
          error: {
            code: 'FIELD_REQUIRED',
            message: 'At least one field must be provided for update'
          }
        })
      }
      
      values.push(lessonId)
      
      const updateQuery = `
        UPDATE lessons 
        SET ${updateFields.join(', ')} 
        WHERE id = $${paramCount} 
        RETURNING id, title, content_url, duration_sec, "order", created_at
      `
      
      const result = await pool.query(updateQuery, values)
      const lesson = result.rows[0]
      
      res.json({
        lessonId: lesson.id,
        title: lesson.title,
        contentUrl: lesson.content_url,
        durationSec: lesson.duration_sec,
        order: lesson.order,
        createdAt: lesson.created_at
      })
    } catch (error) {
      if (error.code === '23505' && error.constraint && error.constraint.includes('order')) {
        return res.status(409).json({
          error: {
            code: 'ORDER_CONFLICT',
            field: 'order',
            message: 'Lesson order must be unique within the course'
          }
        })
      }
      
      console.error('Update lesson error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Lesson update failed'
        }
      })
    }
  }
)

// Delete lesson
router.delete('/:courseId/lessons/:lessonId',
  authenticate,
  requireRole(['creator']),
  [
    param('courseId').isInt().withMessage('Course ID must be an integer'),
    param('lessonId').isInt().withMessage('Lesson ID must be an integer')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { courseId, lessonId } = req.params
      const creatorId = req.user.id
      
      // Check if lesson exists and belongs to creator's course
      const lessonResult = await pool.query(`
        SELECT l.id, l.course_id, c.creator_id
        FROM lessons l
        JOIN courses c ON l.course_id = c.id
        WHERE l.id = $1 AND l.course_id = $2
      `, [lessonId, courseId])
      
      if (lessonResult.rows.length === 0) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Lesson not found'
          }
        })
      }
      
      if (lessonResult.rows[0].creator_id !== creatorId) {
        return res.status(403).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authorized to delete this lesson'
          }
        })
      }
      
      // Delete lesson (cascading will handle related records)
      await pool.query('DELETE FROM lessons WHERE id = $1', [lessonId])
      
      res.status(204).send()
    } catch (error) {
      console.error('Delete lesson error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Lesson deletion failed'
        }
      })
    }
  }
)

module.exports = router