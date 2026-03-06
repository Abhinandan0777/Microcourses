// Add your own video URLs to lessons
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Replace these with your actual video URLs
const myVideos = {
  1: 'https://your-video-hosting.com/lesson1.mp4',  // Lesson ID 1
  2: 'https://your-video-hosting.com/lesson2.mp4',  // Lesson ID 2
  3: 'https://your-video-hosting.com/lesson3.mp4',  // Lesson ID 3
  // Add more as needed
};

async function addMyVideos() {
  console.log('🎬 Adding your custom video URLs...');

  try {
    // Show current lessons
    const lessonsResult = await pool.query(`
      SELECT 
        l.id,
        l.title,
        l.content_url,
        c.title as course_title
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      ORDER BY l.id
    `);

    console.log('\n📹 Current lessons:');
    lessonsResult.rows.forEach(lesson => {
      console.log(`${lesson.id}. ${lesson.course_title} - ${lesson.title}`);
      console.log(`   Current URL: ${lesson.content_url}`);
    });

    console.log('\n🔄 Updating with your videos...');

    // Update lessons with your video URLs
    for (const [lessonId, videoUrl] of Object.entries(myVideos)) {
      const lesson = lessonsResult.rows.find(l => l.id == lessonId);

      if (lesson) {
        await pool.query(
          'UPDATE lessons SET content_url = $1 WHERE id = $2',
          [videoUrl, lessonId]
        );

        console.log(`✅ Updated Lesson ${lessonId}: ${lesson.title}`);
        console.log(`   New URL: ${videoUrl}`);
      } else {
        console.log(`⚠️  Lesson ${lessonId} not found`);
      }
    }

    console.log('\n🎉 Successfully updated lessons with your videos!');
    console.log('\n💡 Instructions:');
    console.log('1. Edit this script to add your actual video URLs');
    console.log('2. Run the script again to update the database');
    console.log('3. Refresh your browser to see the changes');

  } catch (error) {
    console.error('❌ Error adding videos:', error.message);
  } finally {
    await pool.end();
  }
}

addMyVideos();