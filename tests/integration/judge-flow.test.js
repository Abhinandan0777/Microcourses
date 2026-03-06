const request = require('supertest')
const app = require('../../src/server')
const { hashPassword } = require('../../src/config/auth')
const { pool } = require('../../src/config/database')

describe('Judge Acceptance Flow', () => {
  let adminToken, creatorToken, learnerToken
  let adminId, creatorId, learnerId
  let applicationId, courseId, lessonIds = []

  beforeAll(async () => {
    // Create test users
    const adminPasswordHash = await hashPassword('pass123')
    const creatorPasswordHash = await hashPassword('pass123')
    const learnerPasswordHash = await hashPassword('pass123')

    // Create admin
    const adminResult = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Admin User', 'admin@test.com', adminPasswordHash, 'admin']
    )
    adminId = adminResult.rows[0].id

    // Create creator
    const creatorResult = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Creator User', 'creator@test.com', creatorPasswordHash, 'creator']
    )
    creatorId = creatorResult.rows[0].id

    // Create learner
    const learnerResult = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Learner User', 'learner@test.com', learnerPasswordHash, 'learner']
    )
    learnerId = learnerResult.rows[0].id

    // Login to get tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'pass123' })
    adminToken = adminLogin.body.token

    const creatorLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'creator@test.com', password: 'pass123' })
    creatorToken = creatorLogin.body.token

    const learnerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'learner@test.com', password: 'pass123' })
    learnerToken = learnerLogin.body.token
  })

  describe('1. Creator Application Flow', () => {
    test('Creator applies to become approved creator', async () => {
      const response = await request(app)
        .post('/api/creators/apply')
        .set('Authorization', `Bearer ${creatorToken}`)
        .set('Idempotency-Key', 'apply-test-123')
        .send({
          name: 'Test Creator',
          bio: 'Experienced educator with passion for teaching',
          portfolioUrl: 'https://portfolio.example.com'
        })

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        applicationId: expect.any(Number),
        status: 'PENDING'
      })

      applicationId = response.body.applicationId
    })

    test('Admin approves creator application', async () => {
      const response = await request(app)
        .put(`/api/admin/creators/${applicationId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        applicationId,
        status: 'APPROVED'
      })
    })
  })

  describe('2. Course Creation and Publishing', () => {
    test('Creator creates course', async () => {
      const response = await request(app)
        .post('/api/creator/courses')
        .set('Authorization', `Bearer ${creatorToken}`)
        .set('Idempotency-Key', 'course-test-123')
        .send({
          title: 'Test Course',
          description: 'A comprehensive test course for validation',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          published: false
        })

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        courseId: expect.any(Number),
        title: 'Test Course',
        published: false
      })

      courseId = response.body.courseId
    })

    test('Creator adds lessons to course', async () => {
      const lessons = [
        {
          title: 'Lesson 1: Introduction',
          contentUrl: 'https://example.com/lesson1.mp4',
          durationSec: 600,
          order: 1
        },
        {
          title: 'Lesson 2: Advanced Topics',
          contentUrl: 'https://example.com/lesson2.mp4',
          durationSec: 900,
          order: 2
        },
        {
          title: 'Lesson 3: Final Project',
          contentUrl: 'https://example.com/lesson3.mp4',
          durationSec: 1200,
          order: 3
        }
      ]

      for (let i = 0; i < lessons.length; i++) {
        const response = await request(app)
          .post(`/api/creator/courses/${courseId}/lessons`)
          .set('Authorization', `Bearer ${creatorToken}`)
          .set('Idempotency-Key', `lesson-${i}-test-123`)
          .send(lessons[i])

        expect(response.status).toBe(201)
        expect(response.body).toMatchObject({
          lessonId: expect.any(Number),
          title: lessons[i].title,
          order: lessons[i].order
        })

        lessonIds.push(response.body.lessonId)
      }
    })

    test('Creator publishes course', async () => {
      const response = await request(app)
        .put(`/api/creator/courses/${courseId}`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ published: true })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        courseId,
        published: true
      })
    })
  })

  describe('3. Learner Enrollment and Progress', () => {
    test('Learner enrolls in course', async () => {
      const response = await request(app)
        .post(`/api/courses/${courseId}/enroll`)
        .set('Authorization', `Bearer ${learnerToken}`)
        .set('Idempotency-Key', 'enroll-test-123')

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        enrollmentId: expect.any(Number),
        courseId,
        userId: learnerId
      })
    })

    test('Learner completes all lessons', async () => {
      for (const lessonId of lessonIds) {
        const response = await request(app)
          .post(`/api/lessons/${lessonId}/complete`)
          .set('Authorization', `Bearer ${learnerToken}`)

        expect(response.status).toBe(201)
        expect(response.body).toMatchObject({
          lessonId,
          completedAt: expect.any(String)
        })
      }
    })

    test('Verify 100% progress', async () => {
      const response = await request(app)
        .get(`/api/users/${learnerId}/progress`)
        .set('Authorization', `Bearer ${learnerToken}`)

      expect(response.status).toBe(200)
      expect(response.body.courses).toHaveLength(1)
      expect(response.body.courses[0]).toMatchObject({
        courseId,
        percentage: 100,
        completedLessons: 3,
        totalLessons: 3
      })
    })
  })

  describe('4. Certificate Generation and Verification', () => {
    let certificateSerial

    test('Issue certificate after 100% completion', async () => {
      const response = await request(app)
        .post(`/api/courses/${courseId}/certificate`)
        .set('Authorization', `Bearer ${learnerToken}`)

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        certificateId: expect.any(Number),
        serial: expect.any(String),
        issuedAt: expect.any(String),
        downloadUrl: expect.any(String)
      })

      certificateSerial = response.body.serial
      
      // Verify serial is SHA-256 hash (64 characters)
      expect(certificateSerial).toHaveLength(64)
      expect(certificateSerial).toMatch(/^[a-f0-9]{64}$/)
    })

    test('Verify certificate serial matches expected format', async () => {
      // The serial should be sha256(courseId|userId|issuedAt|salt)
      expect(certificateSerial).toBeDefined()
      expect(typeof certificateSerial).toBe('string')
      expect(certificateSerial.length).toBe(64)
    })

    test('Verify certificate via API', async () => {
      const response = await request(app)
        .get(`/api/certificates/verify/${certificateSerial}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        certificateId: expect.any(Number),
        userId: learnerId,
        courseId,
        serial: certificateSerial,
        issuedAt: expect.any(String),
        hashAlgorithm: 'sha256',
        verified: true
      })
    })

    test('Download certificate PDF', async () => {
      const response = await request(app)
        .get(`/api/certificates/download/${certificateSerial}`)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe('application/pdf')
      expect(response.headers['content-disposition']).toContain('attachment')
    })

    test('Prevent duplicate certificate issuance', async () => {
      const response = await request(app)
        .post(`/api/courses/${courseId}/certificate`)
        .set('Authorization', `Bearer ${learnerToken}`)

      expect(response.status).toBe(200) // Should return existing certificate
      expect(response.body.serial).toBe(certificateSerial)
    })
  })

  describe('5. Error Handling and Edge Cases', () => {
    test('Cannot enroll in unpublished course', async () => {
      // Create unpublished course
      const courseResponse = await request(app)
        .post('/api/creator/courses')
        .set('Authorization', `Bearer ${creatorToken}`)
        .set('Idempotency-Key', 'unpublished-course-123')
        .send({
          title: 'Unpublished Course',
          description: 'This course is not published',
          published: false
        })

      const unpublishedCourseId = courseResponse.body.courseId

      const enrollResponse = await request(app)
        .post(`/api/courses/${unpublishedCourseId}/enroll`)
        .set('Authorization', `Bearer ${learnerToken}`)
        .set('Idempotency-Key', 'enroll-unpublished-123')

      expect(enrollResponse.status).toBe(400)
      expect(enrollResponse.body.error.code).toBe('INVALID_REQUEST')
    })

    test('Cannot issue certificate without 100% completion', async () => {
      // Create new course and enroll but don't complete all lessons
      const courseResponse = await request(app)
        .post('/api/creator/courses')
        .set('Authorization', `Bearer ${creatorToken}`)
        .set('Idempotency-Key', 'incomplete-course-123')
        .send({
          title: 'Incomplete Course',
          description: 'Course for testing incomplete progress',
          published: true
        })

      const incompleteCourseId = courseResponse.body.courseId

      // Add lesson
      await request(app)
        .post(`/api/creator/courses/${incompleteCourseId}/lessons`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .set('Idempotency-Key', 'incomplete-lesson-123')
        .send({
          title: 'Incomplete Lesson',
          contentUrl: 'https://example.com/incomplete.mp4',
          durationSec: 300,
          order: 1
        })

      // Enroll but don't complete
      await request(app)
        .post(`/api/courses/${incompleteCourseId}/enroll`)
        .set('Authorization', `Bearer ${learnerToken}`)
        .set('Idempotency-Key', 'enroll-incomplete-123')

      // Try to get certificate
      const certResponse = await request(app)
        .post(`/api/courses/${incompleteCourseId}/certificate`)
        .set('Authorization', `Bearer ${learnerToken}`)

      expect(certResponse.status).toBe(400)
      expect(certResponse.body.error.code).toBe('INSUFFICIENT_PROGRESS')
    })

    test('Idempotency works correctly', async () => {
      const idempotencyKey = 'test-idempotency-123'
      
      // First request
      const response1 = await request(app)
        .post('/api/creators/apply')
        .set('Authorization', `Bearer ${creatorToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          name: 'Idempotency Test',
          bio: 'Testing idempotency functionality',
          portfolioUrl: 'https://test.com'
        })

      // Second request with same key and payload
      const response2 = await request(app)
        .post('/api/creators/apply')
        .set('Authorization', `Bearer ${creatorToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          name: 'Idempotency Test',
          bio: 'Testing idempotency functionality',
          portfolioUrl: 'https://test.com'
        })

      expect(response1.status).toBe(201)
      expect(response2.status).toBe(200) // Should return cached response
      expect(response1.body.applicationId).toBe(response2.body.applicationId)
    })

    test('Order conflict prevention works', async () => {
      // Try to add lesson with duplicate order
      const response = await request(app)
        .post(`/api/creator/courses/${courseId}/lessons`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .set('Idempotency-Key', 'duplicate-order-123')
        .send({
          title: 'Duplicate Order Lesson',
          contentUrl: 'https://example.com/duplicate.mp4',
          durationSec: 300,
          order: 1 // This order already exists
        })

      expect(response.status).toBe(409)
      expect(response.body.error.code).toBe('ORDER_CONFLICT')
    })
  })

  describe('6. API Response Format Validation', () => {
    test('All error responses follow uniform format', async () => {
      const response = await request(app)
        .get('/api/courses/99999') // Non-existent course
        .set('Authorization', `Bearer ${learnerToken}`)

      expect(response.status).toBe(404)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toHaveProperty('code')
      expect(response.body.error).toHaveProperty('message')
    })

    test('Pagination works correctly', async () => {
      const response = await request(app)
        .get('/api/courses?limit=1&offset=0')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('items')
      expect(response.body).toHaveProperty('next_offset')
      expect(Array.isArray(response.body.items)).toBe(true)
    })
  })
})

describe('Authentication and Authorization', () => {
  test('Requires authentication for protected endpoints', async () => {
    const response = await request(app)
      .post('/api/creators/apply')
      .send({
        name: 'Test',
        bio: 'Test bio',
        portfolioUrl: 'https://test.com'
      })

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })

  test('Requires correct role for role-specific endpoints', async () => {
    // Try to access admin endpoint with learner token
    const learnerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'learner@test.com', password: 'pass123' })

    const response = await request(app)
      .get('/api/admin/creators')
      .set('Authorization', `Bearer ${learnerLogin.body.token}`)

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })
})