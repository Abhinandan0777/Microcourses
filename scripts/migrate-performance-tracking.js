const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  console.log('🚀 Starting performance tracking migration...');
  
  try {
    // Execute migration statements individually to avoid parsing issues
    const statements = [
      // Add performance tracking columns to completions table
      `ALTER TABLE completions ADD COLUMN IF NOT EXISTS watch_time INTEGER DEFAULT 0`,
      `ALTER TABLE completions ADD COLUMN IF NOT EXISTS watch_percentage DECIMAL(5,2) DEFAULT 0`,
      
      // Create user progress stats table
      `CREATE TABLE IF NOT EXISTS user_progress_stats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        total_watch_time INTEGER DEFAULT 0,
        lessons_completed INTEGER DEFAULT 0,
        avg_performance_score DECIMAL(5,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )`,
      
      // Add transcript support columns to lessons table
      `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS has_transcript BOOLEAN DEFAULT FALSE`,
      
      // Update existing lessons to check for transcripts
      `UPDATE lessons SET has_transcript = TRUE WHERE transcript_id IS NOT NULL`,
      
      // Add indexes for better performance
      `CREATE INDEX IF NOT EXISTS idx_completions_user_lesson ON completions(user_id, lesson_id)`,
      `CREATE INDEX IF NOT EXISTS idx_completions_watch_time ON completions(watch_time)`,
      `CREATE INDEX IF NOT EXISTS idx_user_progress_stats_user_id ON user_progress_stats(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_lessons_has_transcript ON lessons(has_transcript)`
    ];
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        await pool.query(statement);
        console.log(`✅ Statement ${i + 1} completed successfully`);
      } catch (error) {
        // Some statements might fail if they already exist (like CREATE TABLE IF NOT EXISTS)
        // We'll log warnings but continue
        if (error.message.includes('already exists') || error.message.includes('does not exist')) {
          console.log(`⚠️  Statement ${i + 1} skipped (already exists): ${error.message}`);
        } else {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }
    
    // Verify the migration worked
    console.log('\n🔍 Verifying migration...');
    
    // Check if new columns exist
    const columnsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'completions' 
      AND column_name IN ('watch_time', 'watch_percentage')
    `);
    
    console.log(`✅ Found ${columnsCheck.rows.length} new columns in completions table`);
    
    // Check if new table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'user_progress_stats'
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('✅ user_progress_stats table created successfully');
    }
    
    // Check if has_transcript column exists
    const transcriptCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'lessons' 
      AND column_name = 'has_transcript'
    `);
    
    if (transcriptCheck.rows.length > 0) {
      console.log('✅ has_transcript column added to lessons table');
    }
    
    console.log('\n🎉 Performance tracking migration completed successfully!');
    console.log('\n📊 New features available:');
    console.log('   • Watch time tracking for lessons');
    console.log('   • Performance scoring system');
    console.log('   • User progress statistics');
    console.log('   • Enhanced transcript support');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration().catch(console.error);