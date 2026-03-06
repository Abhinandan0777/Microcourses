const { Pool } = require('pg')
const path = require('path')
const fs = require('fs')

let pool

// PostgreSQL configuration
pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

// Test database connection
const testConnection = async () => {
  try {
    await pool.query('SELECT 1')
    console.log('✅ Database connected successfully')
  } catch (error) {
    console.error('❌ Database connection failed:', error.message)
    process.exit(1)
  }
}

module.exports = {
  pool,
  testConnection
}