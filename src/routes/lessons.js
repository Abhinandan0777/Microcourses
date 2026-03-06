const express = require('express')
const { body, param } = require('express-validator')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { pool } = require('../config/database')
const { authenticate, requireRole } = require('../middleware/auth')
const { handleValidationErrors } = require('../middleware/validation')
const { handleIdempotency } = require('../middleware/idempotency')

const router = express.Router()

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/audio')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, 'audio-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/mp4']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'))
    }
  }
})

// Add lesson to course
router.post('/creator/courses/:courseId/lessons',
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

// Update lesson
router.put('/creator/courses/:courseId/lessons/:lessonId',
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
router.delete('/creator/courses/:courseId/lessons/:lessonId',
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

// Get lesson details with transcript
router.get('/:lessonId',
  authenticate,
  [
    param('lessonId').isInt().withMessage('Lesson ID must be an integer')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const lessonId = req.params.lessonId
      const userId = req.user.id
      const userRole = req.user.role
      
      // Get lesson with course info
      const lessonResult = await pool.query(`
        SELECT 
          l.id, l.title, l.content_url, l.duration_sec, l."order", l.created_at,
          c.id as course_id, c.title as course_title, c.published, c.creator_id,
          t.text as transcript_text
        FROM lessons l
        JOIN courses c ON l.course_id = c.id
        LEFT JOIN transcripts t ON l.transcript_id = t.id
        WHERE l.id = $1
      `, [lessonId])
      
      if (lessonResult.rows.length === 0) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Lesson not found'
          }
        })
      }
      
      const lesson = lessonResult.rows[0]
      
      // Check access permissions
      let canAccess = false
      
      if (userRole === 'admin' || lesson.creator_id === userId) {
        canAccess = true
      } else if (userRole === 'learner' && lesson.published) {
        // Check if learner is enrolled
        const enrollmentResult = await pool.query(
          'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
          [userId, lesson.course_id]
        )
        canAccess = enrollmentResult.rows.length > 0
      } else if (userRole === 'creator' && lesson.published) {
        canAccess = true
      }
      
      if (!canAccess) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Lesson not found'
          }
        })
      }
      
      // Check if lesson is completed by user (for learners)
      let isCompleted = false
      if (userRole === 'learner') {
        const completionResult = await pool.query(
          'SELECT id FROM completions WHERE user_id = $1 AND lesson_id = $2',
          [userId, lessonId]
        )
        isCompleted = completionResult.rows.length > 0
      }
      
      res.json({
        id: lesson.id,
        title: lesson.title,
        contentUrl: lesson.content_url,
        durationSec: lesson.duration_sec,
        order: lesson.order,
        courseId: lesson.course_id,
        courseTitle: lesson.course_title,
        isCompleted,
        transcript: lesson.transcript_text ? {
          text: lesson.transcript_text
        } : null,
        createdAt: lesson.created_at
      })
    } catch (error) {
      console.error('Get lesson error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve lesson'
        }
      })
    }
  }
)

module.exports = router