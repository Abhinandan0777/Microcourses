// Check database connection and tables
require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function checkDatabase() {
  try {
    console.log('🔍 Checking database connection...')
    
    // Test connection
    const client = await pool.connect()
    console.log('✅ Database connected')
    
    // Check if tables exist
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)
    
    console.log('\n📋 Database tables:')
    if (tables.rows.length === 0) {
      console.log('❌ No tables found - need to run migrations')
      console.log('Run: npm run db:migrate')
    } else {
      tables.rows.forEach(row => {
        console.log(`✅ ${row.table_name}`)
      })
    }
    
    // Check if we have test data
    const userCount = await client.query('SELECT COUNT(*) FROM users')
    console.log(`\n👥 Users in database: ${userCount.rows[0].count}`)
    
    if (userCount.rows[0].count === '0') {
      console.log('❌ No test data - need to run seeding')
      console.log('Run: npm run seed')
    }
    
    client.release()
    await pool.end()
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message)
    
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log('\n💡 Solution: Run database migrations')
      console.log('npm run db:migrate')
    }
  }
}

checkDatabase()