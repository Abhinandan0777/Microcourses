require('dotenv').config({ path: '.env.test' })

// Set test environment
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'sqlite:./test.db'
process.env.JWT_SECRET = 'test-jwt-secret'
process.env.TRANSCRIPT_PROVIDER = 'mock'

const { pool } = require('../src/config/database')
const { runMigrations } = require('../scripts/migrate')

// Global test setup
beforeAll(async () => {
  // Run migrations for test database
  await runMigrations()
})

// Clean up after all tests
afterAll(async () => {
  await pool.end()
})

// Clean database before each test
beforeEach(async () => {
  // Clear all tables in reverse dependency order
  await pool.query('DELETE FROM certificates')
  await pool.query('DELETE FROM completions')
  await pool.query('DELETE FROM enrollments')
  await pool.query('DELETE FROM transcripts')
  await pool.query('DELETE FROM lessons')
  await pool.query('DELETE FROM courses')
  await pool.query('DELETE FROM creator_applications')
  await pool.query('DELETE FROM users')
})