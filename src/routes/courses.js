const express = require('express')
const { body, param, query } = require('express-validator')
const { pool } = require('../config/database')
const { authenticate, requireRole } = require('../middleware/auth')
const { handleValidationErrors } = require('../middleware/validation')
const { handleIdempotency } = require('../middleware/idempotency')

const router = express.Router()

// Get public courses (published only)
router.get('/', [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  query('search').optional().trim()
], handleValidationErrors, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10
    const offset = parseInt(req.query.offset) || 0
    const search = req.query.search
    
    let query = `
      SELECT 
        c.id, c.title, c.description, c.thumbnail_url, c.created_at,
        u.name as creator_name,
        COUNT(l.id) as lesson_count
      FROM courses c
      JOIN users u ON c.creator_id = u.id
      LEFT JOIN lessons l ON c.id = l.course_id
      WHERE c.published = true
    `
    
    const params = []
    
    if (search) {
      query += ` AND (c.title ILIKE $${params.length + 1} OR c.description ILIKE $${params.length + 1})`
      params.push(`%${search}%`)
    }
    
    query += `
      GROUP BY c.id, u.name
      ORDER BY c.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    
    params.push(limit + 1, offset) // Get one extra to check if there are more
    
    const result = await pool.query(query, params)
    const courses = result.rows
    
    const hasMore = courses.length > limit
    if (hasMore) {
      courses.pop() // Remove the extra item
    }
    
    const items = courses.map(course => ({
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnail_url,
      creatorName: course.creator_name,
      lessonCount: parseInt(course.lesson_count),
      createdAt: course.created_at
    }))
    
    res.json({
      items,
      next_offset: hasMore ? offset + limit : null
    })
  } catch (error) {
    console.error('Get courses error:', error)
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve courses'
      }
    })
  }
})

// Get course details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const courseId = req.params.id
    const userId = req.user.id
    const userRole = req.user.role
    
    // Get course details
    const courseResult = await pool.query(`
      SELECT 
        c.id, c.title, c.description, c.thumbnail_url, c.published, c.created_at,
        u.name as creator_name, c.creator_id
      FROM courses c
      JOIN users u ON c.creator_id = u.id
      WHERE c.id = $1
    `, [courseId])
    
    if (courseResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Course not found'
        }
      })
    }
    
    const course = courseResult.rows[0]
    
    // Check if user can access this course
    const canAccess = course.published || 
                     course.creator_id === userId || 
                     userRole === 'admin'
    
    if (!canAccess) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Course not found'
        }
      })
    }
    
    // Get lessons
    const lessonsResult = await pool.query(`
      SELECT id, title, content_url, duration_sec, "order"
      FROM lessons
      WHERE course_id = $1
      ORDER BY "order"
    `, [courseId])
    
    // Check if user is enrolled
    let isEnrolled = false
    if (userRole === 'learner') {
      const enrollmentResult = await pool.query(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [userId, courseId]
      )
      isEnrolled = enrollmentResult.rows.length > 0
    }
    
    res.json({
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnail_url,
      published: course.published,
      creatorName: course.creator_name,
      createdAt: course.created_at,
      isEnrolled,
      lessons: lessonsResult.rows.map(lesson => ({
        id: lesson.id,
        title: lesson.title,
        contentUrl: lesson.content_url,
        durationSec: lesson.duration_sec,
        order: lesson.order
      }))
    })
  } catch (error) {
    console.error('Get course details error:', error)
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve course details'
      }
    })
  }
})

// Get course progress for enrolled user
router.get('/:id/progress',
  authenticate,
  requireRole(['learner']),
  [
    param('id').isInt().withMessage('Course ID must be an integer')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const courseId = req.params.id
      const userId = req.user.id
      
      // Check if user is enrolled
      const enrollmentResult = await pool.query(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [userId, courseId]
      )
      
      if (enrollmentResult.rows.length === 0) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Enrollment not found'
          }
        })
      }
      
      // Get course lessons and completion status
      const lessonsResult = await pool.query(`
        SELECT 
          l.id,
          l.title,
          l.duration_sec,
          CASE WHEN c.id IS NOT NULL THEN true ELSE false END as is_completed,
          c.completed_at
        FROM lessons l
        LEFT JOIN completions c ON l.id = c.lesson_id AND c.user_id = $1
        WHERE l.course_id = $2
        ORDER BY l.lesson_order
      `, [userId, courseId])
      
      const lessons = lessonsResult.rows
      const completedLessons = lessons.filter(l => l.is_completed).length
      const totalLessons = lessons.length
      const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
      
      // Calculate time spent
      const timeSpentResult = await pool.query(`
        SELECT COALESCE(SUM(l.duration_sec), 0) as total_time_spent
        FROM lessons l
        JOIN completions c ON l.id = c.lesson_id
        WHERE l.course_id = $1 AND c.user_id = $2
      `, [courseId, userId])
      
      const totalTimeSpent = parseInt(timeSpentResult.rows[0].total_time_spent)
      
      res.json({
        courseId: parseInt(courseId),
        completedLessons,
        totalLessons,
        progressPercentage,
        totalTimeSpent,
        completedLessonIds: lessons.filter(l => l.is_completed).map(l => l.id),
        lessons: lessons.map(lesson => ({
          id: lesson.id,
          title: lesson.title,
          durationSec: lesson.duration_sec,
          isCompleted: lesson.is_completed,
          completedAt: lesson.completed_at
        }))
      })
    } catch (error) {
      console.error('Get course progress error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve course progress'
        }
      })
    }
  }
)

module.exports = router