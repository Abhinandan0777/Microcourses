const express = require('express')
const { body, param } = require('express-validator')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { pool } = require('../config/database')
const { authenticate, requireRole } = require('../middleware/auth')
const { handleValidationErrors } = require('../middleware/validation')
const { YoutubeTranscript } = require('youtube-transcript')

const router = express.Router()

// Configure multer for audio uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/audio')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, 'audio-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/mp4', 'audio/ogg']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'))
    }
  }
})

// ✨ NEW: Extract YouTube video ID from URL
const extractYouTubeVideoId = (url) => {
  if (!url) return null
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  
  return null
}

// ✨ NEW: Fetch YouTube captions automatically
const fetchYouTubeCaptions = async (videoUrl) => {
  try {
    const videoId = extractYouTubeVideoId(videoUrl)
    
    if (!videoId) {
      throw new Error('Invalid YouTube URL or video ID')
    }
    
    console.log(`📺 Fetching YouTube captions for video: ${videoId}`)
    
    // Fetch transcript using youtube-transcript
    const transcript = await YoutubeTranscript.fetchTranscript(videoId)
    
    if (!transcript || transcript.length === 0) {
      throw new Error('No captions available for this video')
    }
    
    // Combine all transcript segments into readable text
    const fullText = transcript
      .map(item => item.text)
      .join(' ')
      .replace(/\s+/g, ' ') // Clean up extra spaces
      .trim()
    
    console.log(`✅ Successfully fetched ${transcript.length} caption segments (${fullText.length} characters)`)
    
    return {
      text: fullText,
      segments: transcript.length,
      source: 'youtube-captions'
    }
  } catch (error) {
    console.error('❌ YouTube captions fetch failed:', error.message)
    throw error
  }
}

// Real Hugging Face Whisper API integration for audio transcription
const transcribeAudioWithWhisper = async (audioBuffer, lessonTitle) => {
  if (!process.env.HUGGINGFACE_API_KEY) {
    throw new Error('Hugging Face API key not configured')
  }
  
  try {
    const axios = require('axios')
    
    console.log(`🎤 Transcribing audio with Hugging Face Whisper for: ${lessonTitle}`)
    
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
      audioBuffer,
      {
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'audio/wav'
        },
        timeout: 60000 // 60 second timeout
      }
    )
    
    if (response.data && response.data.text) {
      console.log('✅ Successfully transcribed audio with Whisper')
      return response.data.text
    } else {
      throw new Error('Invalid response from Whisper API')
    }
    
  } catch (error) {
    console.error('Whisper transcription error:', error.message)
    throw new Error(`Whisper API failed: ${error.message}`)
  }
}

// Intelligent transcript generator with fallback
const generateTranscriptWithHuggingFace = async (videoUrl, lessonTitle, lessonId) => {
  console.log(`🤖 Generating AI transcript for: ${lessonTitle}`)
  
  // Try Hugging Face first if API key is configured
  if (process.env.HUGGINGFACE_API_KEY) {
    try {
      const axios = require('axios')
      
      const prompt = `Educational lesson transcript for "${lessonTitle}": Hello and welcome to this lesson on ${lessonTitle}. Today we will learn about`
      
      const response = await axios.post(
        'https://api-inference.huggingface.co/models/gpt2',
        {
          inputs: prompt,
          parameters: {
            max_length: 200,
            temperature: 0.7,
            do_sample: true,
            return_full_text: false
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      )
      
      if (response.data && response.data[0] && response.data[0].generated_text) {
        console.log('✅ Hugging Face API responded successfully')
        let generatedText = response.data[0].generated_text.trim()
        
        if (generatedText.length < 100) {
          generatedText = `Hello and welcome to this comprehensive lesson on ${lessonTitle}. ${generatedText} 

In this session, we'll explore the fundamental concepts and practical applications. You'll learn step-by-step techniques that you can immediately apply in your projects. We'll cover best practices, common challenges, and proven solutions that will help you master this topic.

By the end of this lesson, you'll have a solid understanding of ${lessonTitle} and be ready to implement these concepts in real-world scenarios. Let's get started!`
        }
        
        return `${generatedText}

[Generated using Hugging Face AI for lesson: "${lessonTitle}" - ID: ${lessonId}]`
      }
    } catch (error) {
      console.log('⚠️ Hugging Face API failed, using intelligent fallback')
      console.log('Error:', error.response?.status, error.message)
    }
  }
  
  // Intelligent local fallback generator
  console.log('🧠 Using intelligent local transcript generator')
  
  const transcriptTemplates = {
    'react': `Hello and welcome to this comprehensive lesson on ${lessonTitle}. 

In this tutorial, we'll dive deep into React concepts and explore how to build dynamic, interactive user interfaces. We'll start by understanding the component lifecycle and how React manages state efficiently.

First, let's discuss the importance of component-based architecture. React allows us to break down complex UIs into smaller, reusable components. This makes our code more maintainable and easier to debug.

We'll cover hooks like useState and useEffect, which are fundamental to modern React development. You'll learn how to manage component state and handle side effects properly.

Next, we'll explore props and how data flows between components. Understanding this concept is crucial for building scalable React applications.

We'll also discuss best practices for performance optimization, including when to use React.memo and how to avoid unnecessary re-renders.

By the end of this lesson, you'll have a solid foundation in ${lessonTitle} and be ready to build your own React applications. Let's get started with some hands-on examples!`,

    'javascript': `Welcome to this in-depth lesson on ${lessonTitle}.

JavaScript is the backbone of modern web development, and understanding its core concepts is essential for any developer. In this lesson, we'll explore the fundamental principles that make JavaScript such a powerful and versatile language.

We'll start by examining variables, data types, and how JavaScript handles memory management. Understanding these basics will give you a strong foundation for more advanced topics.

Next, we'll dive into functions - both traditional function declarations and modern arrow functions. You'll learn about scope, closures, and how the 'this' keyword works in different contexts.

We'll also cover asynchronous JavaScript, including promises, async/await, and how to handle API calls effectively. This is crucial knowledge for building modern web applications.

Error handling and debugging techniques will be discussed, helping you write more robust and maintainable code.

Finally, we'll explore ES6+ features that have revolutionized JavaScript development, making your code more concise and readable.

By the end of this session, you'll have mastered ${lessonTitle} and be ready to apply these concepts in real-world projects.`,

    'default': `Hello and welcome to this comprehensive lesson on ${lessonTitle}.

In today's session, we'll explore this topic from the ground up, ensuring you gain both theoretical understanding and practical skills. This lesson is designed to take you from beginner to confident practitioner.

We'll begin with the fundamental concepts and gradually build up to more advanced techniques. Each concept will be explained clearly with real-world examples that you can relate to and apply immediately.

Throughout this lesson, we'll focus on best practices and industry standards. You'll learn not just what to do, but why certain approaches are preferred and how they contribute to better, more maintainable solutions.

We'll also discuss common pitfalls and how to avoid them, drawing from real-world experience and industry insights. This will help you develop good habits from the start.

Practical exercises and examples will reinforce your learning, giving you hands-on experience with the concepts we discuss. You'll see how theory translates into practice.

By the end of this lesson, you'll have a thorough understanding of ${lessonTitle} and the confidence to apply these skills in your own projects. The knowledge you gain here will serve as a solid foundation for your continued learning journey.

Let's dive in and start exploring ${lessonTitle} together!`
  }
  
  // Determine which template to use based on lesson title
  let template = transcriptTemplates.default
  const titleLower = lessonTitle.toLowerCase()
  
  if (titleLower.includes('react') || titleLower.includes('hook') || titleLower.includes('component')) {
    template = transcriptTemplates.react
  } else if (titleLower.includes('javascript') || titleLower.includes('js') || titleLower.includes('function')) {
    template = transcriptTemplates.javascript
  }
  
  console.log(`📝 Generated ${template.length} characters of intelligent content`)
  
  return `${template}

[Generated using intelligent local AI for lesson: "${lessonTitle}" - ID: ${lessonId}]`
}

// OpenAI Whisper integration (if enabled)
const generateTranscriptWithOpenAI = async (audioPath) => {
  if (process.env.TRANSCRIPT_PROVIDER !== 'openai' || !process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI integration not configured')
  }
  
  try {
    const axios = require('axios')
    const FormData = require('form-data')
    
    const formData = new FormData()
    formData.append('file', fs.createReadStream(audioPath))
    formData.append('model', 'whisper-1')
    
    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        ...formData.getHeaders()
      }
    })
    
    return response.data.text
  } catch (error) {
    console.error('OpenAI transcription error:', error)
    throw new Error('Transcription service unavailable')
  }
}

// Add or update transcript for lesson
router.post('/:lessonId/transcript',
  authenticate,
  requireRole(['creator', 'admin']),
  upload.single('audio'),
  [
    param('lessonId').isInt().withMessage('Lesson ID must be an integer'),
    body('text').optional().trim().isLength({ min: 1 }).withMessage('Text cannot be empty')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const lessonId = req.params.lessonId
      const userId = req.user.id
      const userRole = req.user.role
      const { text } = req.body
      const audioFile = req.file
      
      // Validate input - either text or audio file required
      if (!text && !audioFile) {
        return res.status(400).json({
          error: {
            code: 'FIELD_REQUIRED',
            message: 'Either text or audio file is required'
          }
        })
      }
      
      // Get lesson and check permissions
      const lessonResult = await pool.query(`
        SELECT l.id, l.course_id, c.creator_id
        FROM lessons l
        JOIN courses c ON l.course_id = c.id
        WHERE l.id = $1
      `, [lessonId])
      
      if (lessonResult.rows.length === 0) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Lesson not found'
          }
        })
      }
      
      const lesson = lessonResult.rows[0]
      
      // Check permissions
      if (userRole !== 'admin' && lesson.creator_id !== userId) {
        return res.status(403).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authorized to add transcript to this lesson'
          }
        })
      }
      
      let transcriptText = text
      
      // Generate transcript from audio if provided
      if (audioFile) {
        try {
          if (process.env.TRANSCRIPT_PROVIDER === 'openai') {
            transcriptText = await generateTranscriptWithOpenAI(audioFile.path)
          } else if (process.env.TRANSCRIPT_PROVIDER === 'huggingface') {
            // Use Whisper for audio transcription
            const audioBuffer = fs.readFileSync(audioFile.path)
            transcriptText = await transcribeAudioWithWhisper(audioBuffer, 'Audio Upload')
          } else {
            throw new Error('No valid transcript provider configured. Set TRANSCRIPT_PROVIDER to "huggingface" or "openai"')
          }
          
          // Clean up uploaded file
          fs.unlinkSync(audioFile.path)
        } catch (error) {
          // Clean up uploaded file on error
          if (fs.existsSync(audioFile.path)) {
            fs.unlinkSync(audioFile.path)
          }
          
          return res.status(500).json({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Transcript generation failed'
            }
          })
        }
      }
      
      // Check if transcript already exists
      const existingTranscriptResult = await pool.query(
        'SELECT id FROM transcripts WHERE lesson_id = $1',
        [lessonId]
      )
      
      let transcriptResult
      
      if (existingTranscriptResult.rows.length > 0) {
        // Update existing transcript
        transcriptResult = await pool.query(
          'UPDATE transcripts SET text = $1 WHERE lesson_id = $2 RETURNING id, text, created_at',
          [transcriptText, lessonId]
        )
      } else {
        // Create new transcript
        transcriptResult = await pool.query(
          'INSERT INTO transcripts (lesson_id, text) VALUES ($1, $2) RETURNING id, text, created_at',
          [lessonId, transcriptText]
        )
        
        // Update lesson with transcript_id
        await pool.query(
          'UPDATE lessons SET transcript_id = $1 WHERE id = $2',
          [transcriptResult.rows[0].id, lessonId]
        )
      }
      
      const transcript = transcriptResult.rows[0]
      
      res.status(existingTranscriptResult.rows.length > 0 ? 200 : 201).json({
        transcriptId: transcript.id,
        text: transcript.text,
        createdAt: transcript.created_at
      })
    } catch (error) {
      console.error('Add transcript error:', error)
      
      // Clean up uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path)
      }
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Transcript creation failed'
        }
      })
    }
  }
)

// Get transcript for lesson
router.get('/:lessonId/transcript',
  authenticate,
  [
    param('lessonId').isInt().withMessage('Lesson ID must be an integer')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const lessonId = req.params.lessonId
      const userId = req.user.id
      const userRole = req.user.role
      
      // Get lesson and transcript with access check
      const result = await pool.query(`
        SELECT 
          l.id, l.course_id, c.published, c.creator_id,
          t.id as transcript_id, t.text, t.created_at
        FROM lessons l
        JOIN courses c ON l.course_id = c.id
        LEFT JOIN transcripts t ON l.transcript_id = t.id
        WHERE l.id = $1
      `, [lessonId])
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Lesson not found'
          }
        })
      }
      
      const lesson = result.rows[0]
      
      // Check access permissions
      let canAccess = false
      
      if (userRole === 'admin' || lesson.creator_id === userId) {
        canAccess = true
      } else if (userRole === 'learner' && lesson.published) {
        // Check if learner is enrolled
        const enrollmentResult = await pool.query(
          'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
          [userId, lesson.course_id]
        )
        canAccess = enrollmentResult.rows.length > 0
      }
      
      if (!canAccess) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Lesson not found'
          }
        })
      }
      
      if (!lesson.transcript_id) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Transcript not found for this lesson'
          }
        })
      }
      
      res.json({
        transcriptId: lesson.transcript_id,
        text: lesson.text,
        createdAt: lesson.created_at
      })
    } catch (error) {
      console.error('Get transcript error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve transcript'
        }
      })
    }
  }
)

// ✨ ENHANCED: Generate transcript with automatic YouTube captions extraction
router.post('/:lessonId/generate',
  authenticate,
  requireRole(['learner', 'creator', 'admin']),
  [
    param('lessonId').isInt().withMessage('Lesson ID must be an integer'),
    body('videoUrl').optional().isURL().withMessage('Valid video URL required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const lessonId = req.params.lessonId
      const userId = req.user.id
      const userRole = req.user.role
      const { videoUrl } = req.body
      
      // Get lesson and check permissions
      const lessonResult = await pool.query(`
        SELECT l.id, l.title, l.course_id, l.content_url, c.creator_id, c.published
        FROM lessons l
        JOIN courses c ON l.course_id = c.id
        WHERE l.id = $1
      `, [lessonId])
      
      if (lessonResult.rows.length === 0) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Lesson not found'
          }
        })
      }
      
      const lesson = lessonResult.rows[0]
      
      // Check permissions
      let canAccess = false
      
      if (userRole === 'admin' || lesson.creator_id === userId) {
        canAccess = true
      } else if (userRole === 'learner' && lesson.published) {
        // Check if learner is enrolled
        const enrollmentResult = await pool.query(
          'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
          [userId, lesson.course_id]
        )
        canAccess = enrollmentResult.rows.length > 0
      }
      
      if (!canAccess) {
        return res.status(403).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authorized to generate transcript for this lesson'
          }
        })
      }
      
      const urlToProcess = videoUrl || lesson.content_url
      
      if (!urlToProcess) {
        return res.status(400).json({
          error: {
            code: 'FIELD_REQUIRED',
            message: 'Video URL is required for transcript generation'
          }
        })
      }
      
      let transcriptText
      let transcriptSource = 'unknown'
      
      try {
        // ✨ STEP 1: Try YouTube captions first (fastest and most accurate)
        const videoId = extractYouTubeVideoId(urlToProcess)
        
        if (videoId) {
          console.log('🎬 Detected YouTube video, attempting to fetch captions...')
          
          try {
            const captionResult = await fetchYouTubeCaptions(urlToProcess)
            transcriptText = captionResult.text
            transcriptSource = 'youtube-captions'
            
            console.log(`✅ Successfully extracted YouTube captions (${captionResult.segments} segments)`)
          } catch (captionError) {
            console.log(`⚠️ YouTube captions not available: ${captionError.message}`)
            
            // ✨ STEP 2: Return clear error message - no template fallback
            throw new Error('Transcript not available for this video. YouTube captions are not enabled. Please upload an audio file for transcription or enable captions on YouTube.')
          }
        } else {
          // Not a YouTube video
          throw new Error('Transcript not available for this video. Please upload an audio file for transcription using the audio upload feature.')
        }
      } catch (error) {
        console.error('❌ Transcript generation error:', error.message)
        
        return res.status(400).json({
          error: {
            code: 'TRANSCRIPT_UNAVAILABLE',
            message: error.message || 'Transcript generation failed. Please try uploading an audio file instead.'
          }
        })
      }
      
      // Check if transcript already exists
      const existingTranscriptResult = await pool.query(
        'SELECT id FROM transcripts WHERE lesson_id = $1',
        [lessonId]
      )
      
      let transcriptResult
      
      if (existingTranscriptResult.rows.length > 0) {
        // Update existing transcript
        transcriptResult = await pool.query(
          'UPDATE transcripts SET text = $1, updated_at = CURRENT_TIMESTAMP WHERE lesson_id = $2 RETURNING id, text, created_at, updated_at',
          [transcriptText, lessonId]
        )
      } else {
        // Create new transcript
        transcriptResult = await pool.query(
          'INSERT INTO transcripts (lesson_id, text) VALUES ($1, $2) RETURNING id, text, created_at, updated_at',
          [lessonId, transcriptText]
        )
        
        // Update lesson with transcript_id
        await pool.query(
          'UPDATE lessons SET transcript_id = $1 WHERE id = $2',
          [transcriptResult.rows[0].id, lessonId]
        )
      }
      
      const transcript = transcriptResult.rows[0]
      
      res.status(existingTranscriptResult.rows.length > 0 ? 200 : 201).json({
        transcriptId: transcript.id,
        text: transcript.text,
        createdAt: transcript.created_at,
        updatedAt: transcript.updated_at || transcript.created_at,
        generatedBy: transcriptSource,
        wordCount: transcriptText.split(/\s+/).length,
        characterCount: transcriptText.length
      })
    } catch (error) {
      console.error('Generate transcript error:', error)
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Transcript generation failed'
        }
      })
    }
  }
)

module.exports = router