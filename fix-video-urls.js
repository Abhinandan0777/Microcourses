// Replace placeholder video URLs with real working videos
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Real, working video URLs for testing
const workingVideos = {
  'html-basics': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'css-fundamentals': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'js-intro': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
};

async function fixVideoUrls() {
  console.log('🔧 Fixing placeholder video URLs with real working videos...');

  try {
    // Get all lessons with example.com URLs
    const lessonsResult = await pool.query(`
      SELECT 
        l.id,
        l.title,
        l.content_url,
        c.title as course_title
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      WHERE l.content_url LIKE '%example.com%'
      ORDER BY l.id
    `);

    console.log(`📹 Found ${lessonsResult.rows.length} lessons with placeholder URLs`);

    if (lessonsResult.rows.length === 0) {
      console.log('✅ No placeholder URLs found!');
      return;
    }

    // Update each lesson with a working video URL
    for (let i = 0; i < lessonsResult.rows.length; i++) {
      const lesson = lessonsResult.rows[i];

      // Try to match by content or use index
      let newVideoUrl;
      if (lesson.content_url.includes('html-basics')) {
        newVideoUrl = workingVideos['html-basics'];
      } else if (lesson.content_url.includes('css-fundamentals')) {
        newVideoUrl = workingVideos['css-fundamentals'];
      } else if (lesson.content_url.includes('js-intro')) {
        newVideoUrl = workingVideos['js-intro'];
      } else {
        // Fallback to cycling through available videos
        const videoKeys = Object.keys(workingVideos);
        newVideoUrl = workingVideos[videoKeys[i % videoKeys.length]];
      }

      await pool.query(
        'UPDATE lessons SET content_url = $1 WHERE id = $2',
        [newVideoUrl, lesson.id]
      );

      console.log(`✅ Updated "${lesson.title}"`);
      console.log(`   Old: ${lesson.content_url}`);
      console.log(`   New: ${newVideoUrl}`);
      console.log('');
    }

    console.log(`🎉 Successfully updated ${lessonsResult.rows.length} lessons with working video URLs!`);
    console.log('\n📺 Videos now include:');
    console.log('   • Big Buck Bunny - Classic open source animation');
    console.log('   • Elephants Dream - Beautiful 3D animation');
    console.log('   • For Bigger Blazes - Google sample video');
    console.log('\n🚀 Your video player should now work perfectly!');
    console.log('💡 Try refreshing your browser and playing the lessons.');

  } catch (error) {
    console.error('❌ Error fixing video URLs:', error.message);
  } finally {
    await pool.end();
  }
}

fixVideoUrls();