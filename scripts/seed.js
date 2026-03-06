require('dotenv').config()
const { pool } = require('../src/config/database')
const { hashPassword } = require('../src/config/auth')
const crypto = require('crypto')

const seedData = async () => {
  try {
    console.log('🌱 Starting database seeding...')
    
    // Clear existing data (in reverse order of dependencies)
    console.log('🧹 Clearing existing data...')
    await pool.query('DELETE FROM certificates')
    await pool.query('DELETE FROM completions')
    await pool.query('DELETE FROM enrollments')
    await pool.query('DELETE FROM transcripts')
    await pool.query('DELETE FROM lessons')
    await pool.query('DELETE FROM courses')
    await pool.query('DELETE FROM creator_applications')
    await pool.query('DELETE FROM users')
    
    // Reset sequences (PostgreSQL)
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('sqlite:')) {
      await pool.query('ALTER SEQUENCE users_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE creator_applications_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE courses_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE lessons_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE transcripts_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE enrollments_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE completions_id_seq RESTART WITH 1')
      await pool.query('ALTER SEQUENCE certificates_id_seq RESTART WITH 1')
    }
    
    // Create test users
    console.log('👥 Creating test users...')
    const adminPasswordHash = await hashPassword('pass123')
    const creatorPasswordHash = await hashPassword('pass123')
    const learnerPasswordHash = await hashPassword('pass123')
    
    const adminResult = await pool.query(`
      INSERT INTO users (name, email, password_hash, role) 
      VALUES ($1, $2, $3, $4) 
      RETURNING id
    `, ['Admin User', 'admin@micro.io', adminPasswordHash, 'admin'])
    const adminId = adminResult.rows[0].id
    
    const creatorResult = await pool.query(`
      INSERT INTO users (name, email, password_hash, role) 
      VALUES ($1, $2, $3, $4) 
      RETURNING id
    `, ['Creator User', 'creator@micro.io', creatorPasswordHash, 'creator'])
    const creatorId = creatorResult.rows[0].id
    
    const learnerResult = await pool.query(`
      INSERT INTO users (name, email, password_hash, role) 
      VALUES ($1, $2, $3, $4) 
      RETURNING id
    `, ['Learner User', 'learner@micro.io', learnerPasswordHash, 'learner'])
    const learnerId = learnerResult.rows[0].id
    
    console.log(`✅ Created users: Admin(${adminId}), Creator(${creatorId}), Learner(${learnerId})`)
    
    // Create approved creator application
    console.log('📝 Creating creator application...')
    const applicationResult = await pool.query(`
      INSERT INTO creator_applications (user_id, name, bio, portfolio_url, status) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING id
    `, [
      creatorId,
      'Creator User',
      'Experienced educator with 5+ years in online learning. Passionate about creating engaging educational content.',
      'https://portfolio.creator.com',
      'APPROVED'
    ])
    const applicationId = applicationResult.rows[0].id
    
    console.log(`✅ Created approved creator application: ${applicationId}`)
    
    // Create sample course
    console.log('📚 Creating sample course...')
    const courseResult = await pool.query(`
      INSERT INTO courses (creator_id, title, description, thumbnail_url, published) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING id
    `, [
      creatorId,
      'Introduction to Web Development',
      'Learn the fundamentals of web development including HTML, CSS, and JavaScript. Perfect for beginners who want to start their journey in web development.',
      'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400',
      true
    ])
    const courseId = courseResult.rows[0].id
    
    console.log(`✅ Created course: ${courseId}`)
    
    // Create sample lessons
    console.log('📖 Creating sample lessons...')
    const lessons = [
      {
        title: 'HTML Basics',
        contentUrl: 'https://example.com/videos/html-basics.mp4',
        durationSec: 1800,
        order: 1
      },
      {
        title: 'CSS Fundamentals',
        contentUrl: 'https://example.com/videos/css-fundamentals.mp4',
        durationSec: 2100,
        order: 2
      },
      {
        title: 'JavaScript Introduction',
        contentUrl: 'https://example.com/videos/js-intro.mp4',
        durationSec: 2400,
        order: 3
      }
    ]
    
    const lessonIds = []
    for (const lesson of lessons) {
      const lessonResult = await pool.query(`
        INSERT INTO lessons (course_id, title, content_url, duration_sec, "order") 
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING id
      `, [courseId, lesson.title, lesson.contentUrl, lesson.durationSec, lesson.order])
      
      lessonIds.push(lessonResult.rows[0].id)
    }
    
    console.log(`✅ Created lessons: ${lessonIds.join(', ')}`)
    
    // Create transcripts for lessons
    console.log('📝 Creating transcripts...')
    const transcripts = [
      'Welcome to HTML Basics! In this lesson, we will cover the fundamental building blocks of web pages. HTML, or HyperText Markup Language, is the standard markup language used to create web pages. We will start with basic tags like headings, paragraphs, and links.',
      'CSS, or Cascading Style Sheets, is used to style and layout web pages. In this lesson, we will learn about selectors, properties, and values. We will also cover the box model, which is fundamental to understanding how CSS works.',
      'JavaScript is a programming language that adds interactivity to web pages. In this introduction, we will cover variables, functions, and basic DOM manipulation. By the end of this lesson, you will be able to create simple interactive elements.'
    ]
    
    for (let i = 0; i < lessonIds.length; i++) {
      const transcriptResult = await pool.query(`
        INSERT INTO transcripts (lesson_id, text) 
        VALUES ($1, $2) 
        RETURNING id
      `, [lessonIds[i], transcripts[i]])
      
      // Update lesson with transcript_id
      await pool.query(`
        UPDATE lessons SET transcript_id = $1 WHERE id = $2
      `, [transcriptResult.rows[0].id, lessonIds[i]])
    }
    
    console.log('✅ Created transcripts for all lessons')
    
    // Create enrollment for learner
    console.log('🎓 Creating enrollment...')
    const enrollmentResult = await pool.query(`
      INSERT INTO enrollments (user_id, course_id) 
      VALUES ($1, $2) 
      RETURNING id
    `, [learnerId, courseId])
    const enrollmentId = enrollmentResult.rows[0].id
    
    console.log(`✅ Created enrollment: ${enrollmentId}`)
    
    // Mark first two lessons as completed for learner
    console.log('✅ Creating lesson completions...')
    for (let i = 0; i < 2; i++) {
      await pool.query(`
        INSERT INTO completions (user_id, lesson_id) 
        VALUES ($1, $2)
      `, [learnerId, lessonIds[i]])
    }
    
    console.log('✅ Marked first 2 lessons as completed (66.67% progress)')
    
    // Create additional test data
    console.log('🔄 Creating additional test data...')
    
    // Additional learner
    const learner2Result = await pool.query(`
      INSERT INTO users (name, email, password_hash, role) 
      VALUES ($1, $2, $3, $4) 
      RETURNING id
    `, ['Jane Smith', 'jane@example.com', await hashPassword('password123'), 'learner'])
    const learner2Id = learner2Result.rows[0].id
    
    // Additional creator (pending application)
    const creator2Result = await pool.query(`
      INSERT INTO users (name, email, password_hash, role) 
      VALUES ($1, $2, $3, $4) 
      RETURNING id
    `, ['John Doe', 'john@example.com', await hashPassword('password123'), 'creator'])
    const creator2Id = creator2Result.rows[0].id
    
    await pool.query(`
      INSERT INTO creator_applications (user_id, name, bio, portfolio_url, status) 
      VALUES ($1, $2, $3, $4, $5)
    `, [
      creator2Id,
      'John Doe',
      'Software engineer with passion for teaching programming concepts.',
      'https://johndoe.dev',
      'PENDING'
    ])
    
    console.log('✅ Created additional test users and pending application')
    
    // Summary
    console.log('\n🎉 Database seeding completed successfully!')
    console.log('\n📊 Seed Data Summary:')
    console.log('👥 Users:')
    console.log('   - admin@micro.io / pass123 (Admin)')
    console.log('   - creator@micro.io / pass123 (Creator - Approved)')
    console.log('   - learner@micro.io / pass123 (Learner - Enrolled in course)')
    console.log('   - jane@example.com / password123 (Additional Learner)')
    console.log('   - john@example.com / password123 (Creator - Pending approval)')
    console.log('\n📚 Courses:')
    console.log('   - "Introduction to Web Development" (3 lessons, published)')
    console.log('\n📖 Lessons:')
    console.log('   - HTML Basics (completed by learner)')
    console.log('   - CSS Fundamentals (completed by learner)')
    console.log('   - JavaScript Introduction (not completed)')
    console.log('\n🎓 Progress:')
    console.log('   - Learner has 66.67% progress (2/3 lessons completed)')
    console.log('   - Ready to test certificate generation after completing lesson 3')
    
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run seeding if this script is executed directly
if (require.main === module) {
  seedData()
}

module.exports = { seedData }