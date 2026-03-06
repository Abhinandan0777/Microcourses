require('dotenv').config()
const { pool } = require('../src/config/database')

const migrations = [
  {
    name: '001_create_users_table',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('learner', 'creator', 'admin')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    `
  },
  {
    name: '002_create_creator_applications_table',
    sql: `
      CREATE TABLE IF NOT EXISTS creator_applications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        bio TEXT NOT NULL,
        portfolio_url VARCHAR(500),
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_creator_applications_user_id ON creator_applications(user_id);
      CREATE INDEX IF NOT EXISTS idx_creator_applications_status ON creator_applications(status);
    `
  },
  {
    name: '003_create_courses_table',
    sql: `
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        thumbnail_url VARCHAR(500),
        published BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_courses_creator_id ON courses(creator_id);
      CREATE INDEX IF NOT EXISTS idx_courses_published ON courses(published);
    `
  },
  {
    name: '004_create_lessons_table',
    sql: `
      CREATE TABLE IF NOT EXISTS lessons (
        id SERIAL PRIMARY KEY,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content_url VARCHAR(500) NOT NULL,
        duration_sec INTEGER NOT NULL,
        "order" INTEGER NOT NULL,
        transcript_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(course_id, "order")
      );
      
      CREATE INDEX IF NOT EXISTS idx_lessons_course_id ON lessons(course_id);
      CREATE INDEX IF NOT EXISTS idx_lessons_order ON lessons(course_id, "order");
    `
  },
  {
    name: '005_create_transcripts_table',
    sql: `
      CREATE TABLE IF NOT EXISTS transcripts (
        id SERIAL PRIMARY KEY,
        lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_transcripts_lesson_id ON transcripts(lesson_id);
      
      -- Add foreign key constraint to lessons table
      ALTER TABLE lessons 
      ADD CONSTRAINT fk_lessons_transcript_id 
      FOREIGN KEY (transcript_id) REFERENCES transcripts(id) ON DELETE SET NULL;
    `
  },
  {
    name: '006_create_enrollments_table',
    sql: `
      CREATE TABLE IF NOT EXISTS enrollments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, course_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON enrollments(user_id);
      CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);
    `
  },
  {
    name: '007_create_completions_table',
    sql: `
      CREATE TABLE IF NOT EXISTS completions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, lesson_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_completions_user_id ON completions(user_id);
      CREATE INDEX IF NOT EXISTS idx_completions_lesson_id ON completions(lesson_id);
    `
  },
  {
    name: '008_create_certificates_table',
    sql: `
      CREATE TABLE IF NOT EXISTS certificates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        serial VARCHAR(64) UNIQUE NOT NULL,
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        download_url VARCHAR(500),
        UNIQUE(user_id, course_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON certificates(user_id);
      CREATE INDEX IF NOT EXISTS idx_certificates_course_id ON certificates(course_id);
      CREATE INDEX IF NOT EXISTS idx_certificates_serial ON certificates(serial);
    `
  },
  {
    name: '009_add_updated_at_to_transcripts',
    sql: `
      ALTER TABLE transcripts 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      
      -- Create trigger to automatically update updated_at
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
      
      DROP TRIGGER IF EXISTS update_transcripts_updated_at ON transcripts;
      CREATE TRIGGER update_transcripts_updated_at
          BEFORE UPDATE ON transcripts
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    `
  }
]

const runMigrations = async () => {
  try {
    console.log('🚀 Starting database migrations...')
    
    // Create migrations tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // Get already executed migrations
    const executedResult = await pool.query('SELECT name FROM migrations')
    const executedMigrations = executedResult.rows.map(row => row.name)
    
    // Run pending migrations
    for (const migration of migrations) {
      if (!executedMigrations.includes(migration.name)) {
        console.log(`📝 Running migration: ${migration.name}`)
        
        await pool.query('BEGIN')
        try {
          await pool.query(migration.sql)
          await pool.query('INSERT INTO migrations (name) VALUES ($1)', [migration.name])
          await pool.query('COMMIT')
          console.log(`✅ Migration completed: ${migration.name}`)
        } catch (error) {
          await pool.query('ROLLBACK')
          throw error
        }
      } else {
        console.log(`⏭️  Skipping already executed migration: ${migration.name}`)
      }
    }
    
    console.log('🎉 All migrations completed successfully!')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations()
}

module.exports = { runMigrations }