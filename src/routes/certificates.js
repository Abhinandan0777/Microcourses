const express = require('express')
const { param } = require('express-validator')
const crypto = require('crypto')
const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')
const { pool } = require('../config/database')
const { authenticate, requireRole } = require('../middleware/auth')
const { handleValidationErrors } = require('../middleware/validation')

const router = express.Router()

// Generate certificate serial hash
const generateCertificateSerial = (courseId, userId, issuedAt) => {
  const salt = crypto.randomBytes(16).toString('hex')
  const data = `${courseId}|${userId}|${issuedAt}|${salt}`
  return crypto.createHash('sha256').update(data).digest('hex')
}

// Issue certificate for completed course
router.post('/:courseId/certificate',
  authenticate,
  requireRole(['learner']),
  [
    param('courseId').isInt().withMessage('Course ID must be an integer')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const courseId = req.params.courseId
      const userId = req.user.id
      
      // Check if course exists and is published
      const courseResult = await pool.query(`
        SELECT c.id, c.title, c.description, u.name as creator_name
        FROM courses c
        JOIN users u ON c.creator_id = u.id
        WHERE c.id = $1 AND c.published = true
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
      
      // Check if user is enrolled
      const enrollmentResult = await pool.query(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [userId, courseId]
      )
      
      if (enrollmentResult.rows.length === 0) {
        return res.status(403).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Must be enrolled in course to receive certificate'
          }
        })
      }
      
      // Check if user has 100% progress
      const progressResult = await pool.query(`
        SELECT 
          COUNT(l.id) as total_lessons,
          COUNT(comp.id) as completed_lessons
        FROM lessons l
        LEFT JOIN completions comp ON l.id = comp.lesson_id AND comp.user_id = $1
        WHERE l.course_id = $2
        GROUP BY l.course_id
      `, [userId, courseId])
      
      if (progressResult.rows.length === 0) {
        return res.status(400).json({
          error: {
            code: 'INSUFFICIENT_PROGRESS',
            message: 'Course has no lessons'
          }
        })
      }
      
      const progress = progressResult.rows[0]
      const percentage = progress.total_lessons > 0 
        ? (progress.completed_lessons / progress.total_lessons) * 100 
        : 0
      
      if (percentage < 100) {
        return res.status(400).json({
          error: {
            code: 'INSUFFICIENT_PROGRESS',
            message: `Course completion required. Current progress: ${percentage.toFixed(1)}%`
          }
        })
      }
      
      // Check if certificate already exists
      const existingCertResult = await pool.query(
        'SELECT id, serial, issued_at, download_url FROM certificates WHERE user_id = $1 AND course_id = $2',
        [userId, courseId]
      )
      
      if (existingCertResult.rows.length > 0) {
        const existing = existingCertResult.rows[0]
        return res.status(200).json({
          certificateId: existing.id,
          serial: existing.serial,
          issuedAt: existing.issued_at,
          downloadUrl: existing.download_url || `/api/certificates/${existing.id}/download`
        })
      }
      
      // Generate certificate
      const issuedAt = new Date().toISOString()
      const serial = generateCertificateSerial(courseId, userId, issuedAt)
      const downloadUrl = `/api/certificates/download/${serial}`
      
      const certResult = await pool.query(
        'INSERT INTO certificates (user_id, course_id, serial, issued_at, download_url) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [userId, courseId, serial, issuedAt, downloadUrl]
      )
      
      const certificateId = certResult.rows[0].id
      
      res.status(201).json({
        certificateId,
        serial,
        issuedAt,
        downloadUrl
      })
    } catch (error) {
      console.error('Issue certificate error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Certificate generation failed'
        }
      })
    }
  }
)

// Download certificate PDF
router.get('/download/:serial',
  async (req, res) => {
    try {
      const serial = req.params.serial
      
      // Get certificate details
      const certResult = await pool.query(`
        SELECT 
          cert.id, cert.serial, cert.issued_at,
          u.name as user_name, u.email as user_email,
          c.title as course_title, c.description as course_description,
          creator.name as creator_name
        FROM certificates cert
        JOIN users u ON cert.user_id = u.id
        JOIN courses c ON cert.course_id = c.id
        JOIN users creator ON c.creator_id = creator.id
        WHERE cert.serial = $1
      `, [serial])
      
      if (certResult.rows.length === 0) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Certificate not found'
          }
        })
      }
      
      const cert = certResult.rows[0]
      
      // ✅ FIX ISSUE 2: Set headers BEFORE creating PDF
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="certificate-${serial.substring(0, 8)}.pdf"`)
      
      // Generate PDF
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      })
      
      // ✅ FIX ISSUE 2: Pipe IMMEDIATELY after creation
      doc.pipe(res)
      
      // Certificate design
      const pageWidth = doc.page.width
      const pageHeight = doc.page.height
      
      // Border
      doc.rect(30, 30, pageWidth - 60, pageHeight - 60)
        .stroke('#2563eb')
      doc.lineWidth(3)
      
      // Header
      doc.fontSize(36)
        .fillColor('#1e40af')
        .text('Certificate of Completion', 0, 100, { align: 'center' })
      
      // Decorative line
      doc.moveTo(150, 160)
        .lineTo(pageWidth - 150, 160)
        .stroke('#94a3b8')
      doc.lineWidth(2)
      
      // Main content
      doc.fontSize(18)
        .fillColor('#374151')
        .text('This is to certify that', 0, 200, { align: 'center' })
      
      doc.fontSize(28)
        .fillColor('#1f2937')
        .text(cert.user_name, 0, 240, { align: 'center' })
      
      doc.fontSize(18)
        .fillColor('#374151')
        .text('has successfully completed the course', 0, 290, { align: 'center' })
      
      doc.fontSize(24)
        .fillColor('#1e40af')
        .text(cert.course_title, 0, 330, { align: 'center' })
      
      // Course description (if available and not too long)
      if (cert.course_description && cert.course_description.length < 200) {
        doc.fontSize(14)
          .fillColor('#6b7280')
          .text(cert.course_description, 100, 380, { 
            align: 'center',
            width: pageWidth - 200
          })
      }
      
      // Issue date
      const issueDate = new Date(cert.issued_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      
      doc.fontSize(16)
        .fillColor('#374151')
        .text(`Issued on ${issueDate}`, 0, 450, { align: 'center' })
      
      // Creator signature
      doc.fontSize(14)
        .fillColor('#6b7280')
        .text('Course Creator:', 100, 500)
        .text(cert.creator_name, 100, 520)
      
      // Certificate ID and serial
      doc.fontSize(10)
        .fillColor('#9ca3af')
        .text(`Certificate ID: ${cert.id}`, pageWidth - 250, 500)
        .text(`Serial: ${serial.substring(0, 16)}...`, pageWidth - 250, 515)
        .text('Verify at: /api/certificates/verify/' + serial, pageWidth - 250, 530)
      
      // MicroCourses branding
      doc.fontSize(12)
        .fillColor('#2563eb')
        .text('MicroCourses Learning Platform', 0, pageHeight - 80, { align: 'center' })
      
      // ✅ FIX ISSUE 2: Properly finalize PDF
      doc.end()
      
      // ✅ FIX ISSUE 2: Log successful generation
      console.log(`✅ Certificate PDF generated successfully for serial: ${serial.substring(0, 8)}...`)
      
    } catch (error) {
      console.error('Download certificate error:', error)
      
      // ✅ FIX ISSUE 2: Only send JSON error if headers not sent
      if (!res.headersSent) {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Certificate download failed'
          }
        })
      }
    }
  }
)

// Verify certificate by serial
router.get('/verify/:serial',
  [
    param('serial').isLength({ min: 64, max: 64 }).withMessage('Invalid serial format')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const serial = req.params.serial
      
      const result = await pool.query(`
        SELECT 
          cert.id as certificate_id,
          cert.user_id,
          cert.course_id,
          cert.serial,
          cert.issued_at,
          u.name as user_name,
          c.title as course_title,
          creator.name as creator_name
        FROM certificates cert
        JOIN users u ON cert.user_id = u.id
        JOIN courses c ON cert.course_id = c.id
        JOIN users creator ON c.creator_id = creator.id
        WHERE cert.serial = $1
      `, [serial])
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Certificate not found'
          }
        })
      }
      
      const cert = result.rows[0]
      
      res.json({
        certificateId: cert.certificate_id,
        userId: cert.user_id,
        courseId: cert.course_id,
        serial: cert.serial,
        issuedAt: cert.issued_at,
        hashAlgorithm: 'sha256',
        userName: cert.user_name,
        courseTitle: cert.course_title,
        creatorName: cert.creator_name,
        verified: true
      })
    } catch (error) {
      console.error('Verify certificate error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Certificate verification failed'
        }
      })
    }
  }
)

// Get user's certificates
router.get('/user/:userId',
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
            message: 'Not authorized to view this user\'s certificates'
          }
        })
      }
      
      const result = await pool.query(`
        SELECT 
          cert.id as certificate_id,
          cert.serial,
          cert.issued_at,
          cert.download_url,
          c.id as course_id,
          c.title as course_title,
          c.description as course_description,
          creator.name as creator_name
        FROM certificates cert
        JOIN courses c ON cert.course_id = c.id
        JOIN users creator ON c.creator_id = creator.id
        WHERE cert.user_id = $1
        ORDER BY cert.issued_at DESC
      `, [requestedUserId])
      
      const certificates = result.rows.map(cert => ({
        certificateId: cert.certificate_id,
        serial: cert.serial,
        issuedAt: cert.issued_at,
        downloadUrl: cert.download_url,
        course: {
          id: cert.course_id,
          title: cert.course_title,
          description: cert.course_description,
          creatorName: cert.creator_name
        }
      }))
      
      res.json({
        userId: requestedUserId,
        certificates
      })
    } catch (error) {
      console.error('Get user certificates error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve certificates'
        }
      })
    }
  }
)

module.exports = router