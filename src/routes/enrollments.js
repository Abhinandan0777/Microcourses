const express = require('express')
const { body, param } = require('express-validator')
const { pool } = require('../config/database')
const { authenticate, requireRole } = require('../middleware/auth')
const { handleValidationErrors } = require('../middleware/validation')
const { handleIdempotency } = require('../middleware/idempotency')

const router = express.Router()

// Enroll in course
router.post('/courses/:courseId/enroll',
  authenticate,
  requireRole(['learner']),
  handleIdempotency,
  [
    param('courseId').isInt().withMessage('Course ID must be an integer')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const courseId = req.params.courseId
      const userId = req.user.id
      
      // Check if course exists and is published
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
      
      if (!course.published) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Cannot enroll in unpublished course'
          }
        })
      }
      
      // Check if already enrolled
      const existingEnrollment = await pool.query(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [userId, courseId]
      )
      
      if (existingEnrollment.rows.length > 0) {
        return res.status(200).json({
          enrollmentId: existingEnrollment.rows[0].id,
          courseId: parseInt(courseId),
          userId: userId,
          message: 'Already enrolled'
        })
      }
      
      // Create enrollment
      const enrollmentResult = await pool.query(
        'INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2) RETURNING id, created_at',
        [userId, courseId]
      )
      
      const enrollment = enrollmentResult.rows[0]
      
      res.status(201).json({
        enrollmentId: enrollment.id,
        courseId: parseInt(courseId),
        userId: userId,
        enrolledAt: enrollment.created_at
      })
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        // Handle race condition - return existing enrollment
        const existingEnrollment = await pool.query(
          'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
          [req.user.id, req.params.courseId]
        )
        
        if (existingEnrollment.rows.length > 0) {
          return res.status(200).json({
            enrollmentId: existingEnrollment.rows[0].id,
            courseId: parseInt(req.params.courseId),
            userId: req.user.id,
            message: 'Already enrolled'
          })
        }
      }
      
      console.error('Enrollment error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Enrollment failed'
        }
      })
    }
  }
)

// Mark lesson as complete with performance tracking
router.post('/lessons/:lessonId/complete',
  authenticate,
  requireRole(['learner']),
  [
    param('lessonId').isInt().withMessage('Lesson ID must be an integer'),
    body('watchTime').optional().isInt({ min: 0 }).withMessage('Watch time must be a non-negative integer'),
    body('watchPercentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Watch percentage must be between 0 and 100')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const lessonId = req.params.lessonId
      const userId = req.user.id
      const { watchTime = 0, watchPercentage = 0 } = req.body
      
      // Get lesson and course info
      const lessonResult = await pool.query(`
        SELECT l.id, l.course_id, l.duration_sec, l.title, c.published, c.title as course_title
        FROM lessons l
        JOIN courses c ON l.course_id = c.id
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
      
      if (!lesson.published) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Cannot complete lesson from unpublished course'
          }
        })
      }
      
      // Check if user is enrolled in the course
      const enrollmentResult = await pool.query(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [userId, lesson.course_id]
      )
      
      if (enrollmentResult.rows.length === 0) {
        return res.status(403).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Must be enrolled in course to complete lessons'
          }
        })
      }
      
      // Validate completion requirements (80% minimum watch time)
      const requiredWatchPercentage = 80;
      if (watchPercentage > 0 && watchPercentage < requiredWatchPercentage) {
        return res.status(400).json({
          error: {
            code: 'INSUFFICIENT_PROGRESS',
            message: `Must watch at least ${requiredWatchPercentage}% of the lesson to mark it complete`,
            requiredPercentage: requiredWatchPercentage,
            currentPercentage: watchPercentage
          }
        })
      }
      
      // Check if already completed
      const existingCompletion = await pool.query(
        'SELECT id, completed_at FROM completions WHERE user_id = $1 AND lesson_id = $2',
        [userId, lessonId]
      )
      
      if (existingCompletion.rows.length > 0) {
        return res.status(200).json({
          lessonId: parseInt(lessonId),
          completedAt: existingCompletion.rows[0].completed_at,
          message: 'Already completed'
        })
      }
      
      // Mark as complete with performance tracking
      const completionResult = await pool.query(
        'INSERT INTO completions (user_id, lesson_id, watch_time, watch_percentage) VALUES ($1, $2, $3, $4) RETURNING id, completed_at',
        [userId, lessonId, watchTime, watchPercentage]
      )
      
      const completion = completionResult.rows[0]
      
      res.status(201).json({
        lessonId: parseInt(lessonId),
        lessonTitle: lesson.title,
        courseTitle: lesson.course_title,
        completedAt: completion.completed_at,
        watchTime,
        watchPercentage,
        message: 'Lesson completed successfully!',
        achievements: watchPercentage >= 95 ? ['Perfect Completion'] : watchPercentage >= 85 ? ['Great Progress'] : []
      })
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        // Handle race condition - return existing completion
        const existingCompletion = await pool.query(
          'SELECT completed_at FROM completions WHERE user_id = $1 AND lesson_id = $2',
          [req.user.id, req.params.lessonId]
        )
        
        if (existingCompletion.rows.length > 0) {
          return res.status(200).json({
            lessonId: parseInt(req.params.lessonId),
            completedAt: existingCompletion.rows[0].completed_at,
            message: 'Already completed'
          })
        }
      }
      
      console.error('Complete lesson error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to mark lesson as complete'
        }
      })
    }
  }
)

// Get user progress
router.get('/users/:userId/progress',
  authenticate,
  [
    param('userId').isInt().withMessage('User ID must be an integer')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const requestedUserId = parseInt(req.params.userId)
      const currentUserId = req.user.id
      const userRole = req.user.role
      
      // Check permissions - users can only see their own progress unless admin
      if (userRole !== 'admin' && requestedUserId !== currentUserId) {
        return res.status(403).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authorized to view this user\'s progress'
          }
        })
      }
      
      // Get enrolled courses with progress
      const coursesResult = await pool.query(`
        SELECT 
          c.id as course_id,
          c.title,
          c.description,
          c.thumbnail_url,
          e.created_at as enrolled_at,
          COUNT(l.id) as total_lessons,
          COUNT(comp.id) as completed_lessons,
          CASE 
            WHEN COUNT(l.id) = 0 THEN 0
            ELSE ROUND((COUNT(comp.id)::decimal / COUNT(l.id)) * 100, 2)
          END as percentage
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        LEFT JOIN lessons l ON c.id = l.course_id
        LEFT JOIN completions comp ON l.id = comp.lesson_id AND comp.user_id = e.user_id
        WHERE e.user_id = $1 AND c.published = true
        GROUP BY c.id, c.title, c.description, c.thumbnail_url, e.created_at
        ORDER BY e.created_at DESC
      `, [requestedUserId])
      
      // Get all completed lessons for the user
      const completionsResult = await pool.query(`
        SELECT 
          comp.lesson_id,
          comp.completed_at,
          l.title as lesson_title,
          c.id as course_id,
          c.title as course_title
        FROM completions comp
        JOIN lessons l ON comp.lesson_id = l.id
        JOIN courses c ON l.course_id = c.id
        JOIN enrollments e ON c.id = e.course_id AND e.user_id = comp.user_id
        WHERE comp.user_id = $1 AND c.published = true
        ORDER BY comp.completed_at DESC
      `, [requestedUserId])
      
      const courses = coursesResult.rows.map(course => ({
        courseId: course.course_id,
        title: course.title,
        description: course.description,
        thumbnailUrl: course.thumbnail_url,
        enrolledAt: course.enrolled_at,
        percentage: parseFloat(course.percentage),
        completedLessons: parseInt(course.completed_lessons),
        totalLessons: parseInt(course.total_lessons)
      }))
      
      const completedLessons = completionsResult.rows.map(completion => ({
        lessonId: completion.lesson_id,
        lessonTitle: completion.lesson_title,
        courseId: completion.course_id,
        courseTitle: completion.course_title,
        completedAt: completion.completed_at
      }))
      
      res.json({
        userId: requestedUserId,
        courses,
        completedLessons,
        totalEnrollments: courses.length,
        totalCompletedLessons: completedLessons.length
      })
    } catch (error) {
      console.error('Get progress error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve progress'
        }
      })
    }
  }
)

// Get user's enrollments
router.get('/users/:userId/enrollments',
  authenticate,
  [
    param('userId').isInt().withMessage('User ID must be an integer')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const requestedUserId = parseInt(req.params.userId)
      const currentUserId = req.user.id
      const userRole = req.user.role
      
      // Check permissions
      if (userRole !== 'admin' && requestedUserId !== currentUserId) {
        return res.status(403).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authorized to view this user\'s enrollments'
          }
        })
      }
      
      const result = await pool.query(`
        SELECT 
          e.id as enrollment_id,
          e.created_at as enrolled_at,
          c.id as course_id,
          c.title,
          c.description,
          c.thumbnail_url,
          u.name as creator_name,
          COUNT(l.id) as total_lessons,
          COUNT(comp.id) as completed_lessons
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        JOIN users u ON c.creator_id = u.id
        LEFT JOIN lessons l ON c.id = l.course_id
        LEFT JOIN completions comp ON l.id = comp.lesson_id AND comp.user_id = e.user_id
        WHERE e.user_id = $1 AND c.published = true
        GROUP BY e.id, e.created_at, c.id, c.title, c.description, c.thumbnail_url, u.name
        ORDER BY e.created_at DESC
      `, [requestedUserId])
      
      const enrollments = result.rows.map(enrollment => ({
        enrollmentId: enrollment.enrollment_id,
        enrolledAt: enrollment.enrolled_at,
        course: {
          id: enrollment.course_id,
          title: enrollment.title,
          description: enrollment.description,
          thumbnailUrl: enrollment.thumbnail_url,
          creatorName: enrollment.creator_name,
          totalLessons: parseInt(enrollment.total_lessons),
          completedLessons: parseInt(enrollment.completed_lessons),
          percentage: enrollment.total_lessons > 0 
            ? Math.round((enrollment.completed_lessons / enrollment.total_lessons) * 100)
            : 0
        }
      }))
      
      res.json({
        userId: requestedUserId,
        enrollments
      })
    } catch (error) {
      console.error('Get enrollments error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve enrollments'
        }
      })
    }
  }
)

module.exports = router