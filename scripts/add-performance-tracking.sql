-- Add performance tracking columns to completions table
ALTER TABLE completions ADD COLUMN IF NOT EXISTS watch_time INTEGER DEFAULT 0;
ALTER TABLE completions ADD COLUMN IF NOT EXISTS watch_percentage DECIMAL(5,2) DEFAULT 0;

-- Create user progress stats table for overall performance tracking
CREATE TABLE IF NOT EXISTS user_progress_stats (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_watch_time INTEGER DEFAULT 0,
  lessons_completed INTEGER DEFAULT 0,
  avg_performance_score DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Add transcript support columns to lessons table
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS has_transcript BOOLEAN DEFAULT FALSE;

-- Update existing lessons to check for transcripts
UPDATE lessons SET has_transcript = TRUE WHERE transcript_id IS NOT NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_completions_user_lesson ON completions(user_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_completions_watch_time ON completions(watch_time);
CREATE INDEX IF NOT EXISTS idx_user_progress_stats_user_id ON user_progress_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_lessons_has_transcript ON lessons(has_transcript);

-- Add updated_at trigger for user_progress_stats
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER IF NOT EXISTS update_user_progress_stats_updated_at 
    BEFORE UPDATE ON user_progress_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();