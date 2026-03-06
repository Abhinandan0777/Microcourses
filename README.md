# MicroCourses - Mini Learning Management System

A production-ready mini LMS with three roles: Learner, Creator, and Admin. Features include creator application flow, course management, lesson tracking, progress monitoring, and certificate generation.

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)
```bash
git clone <repo-url>
cd microcourses
docker compose up -d
```
Visit: http://localhost:3000

### Option 2: Windows Users (Special Instructions)

**⚠️ Windows users**: Due to build tool requirements, please use one of these options:

1. **Cloud Database (Easiest)**:
   ```powershell
   .\setup-windows.ps1
   ```
   Then follow the cloud database setup in `QUICK-START-WINDOWS.md`

2. **Docker Desktop**:
   - Install Docker Desktop for Windows
   - Run: `docker compose up -d`

3. **See detailed guide**: `QUICK-START-WINDOWS.md`

### Option 3: Local Development (Linux/Mac)

**Prerequisites:**
- Node.js 18+
- PostgreSQL 14+

**Setup:**
```bash
git clone <repo-url>
cd microcourses

# Install dependencies
npm install
cd frontend && npm install && cd ..

# Environment setup
cp .env.example .env
# Edit .env with your database credentials

# Database setup
npm run db:migrate
npm run seed

# Start development servers
# Terminal 1 - Backend
npm run dev

# Terminal 2 - Frontend  
cd frontend && npm start
```

Visit: http://localhost:3000

### Option 4: Quick Start Script (Linux/Mac)

```bash
chmod +x start.sh
./start.sh
```

## 🧪 Test Users

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@micro.io | pass123 |
| Creator | creator@micro.io | pass123 |
| Learner | learner@micro.io | pass123 |

## 📋 Judge Acceptance Checklist

Run the automated test suite to verify all requirements:

```bash
npm test
```

### Manual Testing Flow:

1. **Creator Application:**
   ```bash
   curl -X POST "http://localhost:4000/api/creators/apply" \
     -H "Authorization: Bearer <creator-token>" \
     -H "Idempotency-Key: apply-123" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Creator","bio":"Test bio","portfolioUrl":"https://example.com"}'
   ```

2. **Admin Approval:**
   ```bash
   curl -X PUT "http://localhost:4000/api/admin/creators/1/approve" \
     -H "Authorization: Bearer <admin-token>"
   ```

3. **Course Creation & Publishing:**
   ```bash
   curl -X POST "http://localhost:4000/api/creator/courses" \
     -H "Authorization: Bearer <creator-token>" \
     -H "Idempotency-Key: course-123" \
     -H "Content-Type: application/json" \
     -d '{"title":"Test Course","description":"Test description","published":true}'
   ```

4. **Learner Enrollment:**
   ```bash
   curl -X POST "http://localhost:4000/api/courses/1/enroll" \
     -H "Authorization: Bearer <learner-token>" \
     -H "Idempotency-Key: enroll-123"
   ```

5. **Complete All Lessons:**
   ```bash
   curl -X POST "http://localhost:4000/api/lessons/1/complete" \
     -H "Authorization: Bearer <learner-token>"
   ```

6. **Certificate Generation:**
   ```bash
   curl -X POST "http://localhost:4000/api/courses/1/certificate" \
     -H "Authorization: Bearer <learner-token>"
   ```

## 🏗️ Architecture

### Backend Stack
- **Runtime:** Node.js + Express
- **Database:** PostgreSQL with migrations
- **Auth:** JWT tokens
- **Validation:** Express-validator
- **Rate Limiting:** Express-rate-limit
- **File Upload:** Multer
- **PDF Generation:** PDFKit

### Frontend Stack
- **Framework:** React (Create React App)
- **Styling:** Tailwind CSS
- **HTTP Client:** Axios
- **Routing:** React Router
- **State:** React Context + Hooks

### Database Schema

```sql
-- Users table
users (id, name, email, password_hash, role, created_at)

-- Creator applications
creator_applications (id, user_id, name, bio, portfolio_url, status, created_at)

-- Courses
courses (id, creator_id, title, description, thumbnail_url, published, created_at)

-- Lessons with unique ordering per course
lessons (id, course_id, title, content_url, duration_sec, "order", transcript_id, created_at)
-- Index: UNIQUE(course_id, "order")

-- Transcripts
transcripts (id, lesson_id, text, created_at)

-- Enrollments
enrollments (id, user_id, course_id, created_at)

-- Lesson completions
completions (id, user_id, lesson_id, completed_at)

-- Certificates with SHA-256 serial
certificates (id, user_id, course_id, serial, issued_at, download_url)
```

## 🔌 API Reference

### Authentication

**Register:**
```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name",
  "role": "learner" // or "creator"
}

Response: {
  "token": "jwt-token",
  "user": { "id": 1, "email": "user@example.com", "name": "User Name", "role": "learner" }
}
```

**Login:**
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response: {
  "token": "jwt-token",
  "user": { "id": 1, "email": "user@example.com", "name": "User Name", "role": "learner" }
}
```

### Creator Application

**Apply to become creator:**
```bash
POST /api/creators/apply
Authorization: Bearer <token>
Idempotency-Key: unique-key
Content-Type: application/json

{
  "name": "Creator Name",
  "bio": "Creator biography",
  "portfolioUrl": "https://portfolio.com"
}

Response: {
  "applicationId": 1,
  "status": "PENDING"
}
```

### Courses

**List published courses:**
```bash
GET /api/courses?limit=10&offset=0

Response: {
  "items": [
    {
      "id": 1,
      "title": "Course Title",
      "description": "Course description",
      "thumbnailUrl": "https://example.com/thumb.jpg",
      "creatorName": "Creator Name"
    }
  ],
  "next_offset": 10
}
```

**Get course details:**
```bash
GET /api/courses/1
Authorization: Bearer <token>

Response: {
  "id": 1,
  "title": "Course Title",
  "description": "Course description",
  "lessons": [
    {
      "id": 1,
      "title": "Lesson 1",
      "order": 1,
      "durationSec": 300
    }
  ]
}
```

**Create course (Creator only):**
```bash
POST /api/creator/courses
Authorization: Bearer <token>
Idempotency-Key: unique-key
Content-Type: application/json

{
  "title": "New Course",
  "description": "Course description",
  "thumbnailUrl": "https://example.com/thumb.jpg",
  "published": false
}

Response: {
  "courseId": 1,
  "title": "New Course",
  "published": false
}
```

### Lessons

**Add lesson to course:**
```bash
POST /api/creator/courses/1/lessons
Authorization: Bearer <token>
Idempotency-Key: unique-key
Content-Type: application/json

{
  "title": "Lesson Title",
  "contentUrl": "https://example.com/video.mp4",
  "durationSec": 300,
  "order": 1
}

Response: {
  "lessonId": 1,
  "title": "Lesson Title",
  "order": 1
}
```

**Get lesson with transcript:**
```bash
GET /api/lessons/1
Authorization: Bearer <token>

Response: {
  "id": 1,
  "title": "Lesson Title",
  "contentUrl": "https://example.com/video.mp4",
  "durationSec": 300,
  "transcript": {
    "text": "Lesson transcript content..."
  }
}
```

### Transcripts

**Upload transcript:**
```bash
POST /api/lessons/1/transcript
Authorization: Bearer <token>
Content-Type: multipart/form-data

# For audio file:
audio: <audio-file>

# Or for text:
Content-Type: application/json
{ "text": "Transcript content..." }

Response: {
  "transcriptId": 1,
  "text": "Generated or provided transcript..."
}
```

### Enrollment & Progress

**Enroll in course:**
```bash
POST /api/courses/1/enroll
Authorization: Bearer <token>
Idempotency-Key: unique-key

Response: {
  "enrollmentId": 1,
  "courseId": 1,
  "userId": 1
}
```

**Mark lesson complete:**
```bash
POST /api/lessons/1/complete
Authorization: Bearer <token>

Response: {
  "lessonId": 1,
  "completedAt": "2025-10-04T10:00:00.000Z"
}
```

**Get user progress:**
```bash
GET /api/users/1/progress
Authorization: Bearer <token>

Response: {
  "courses": [
    {
      "courseId": 1,
      "title": "Course Title",
      "percentage": 66.67,
      "completedLessons": 2,
      "totalLessons": 3
    }
  ],
  "completedLessons": [
    {
      "lessonId": 1,
      "completedAt": "2025-10-04T10:00:00.000Z"
    }
  ]
}
```

### Certificates

**Issue certificate:**
```bash
POST /api/courses/1/certificate
Authorization: Bearer <token>

Response: {
  "certificateId": 1,
  "serial": "3b1f8a2c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
  "issuedAt": "2025-10-04T10:00:00.000Z",
  "downloadUrl": "/api/certificates/1/download"
}
```

**Verify certificate:**
```bash
GET /api/certificates/verify/3b1f8a2c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c

Response: {
  "certificateId": 1,
  "userId": 1,
  "courseId": 1,
  "serial": "3b1f8a2c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
  "issuedAt": "2025-10-04T10:00:00.000Z",
  "hashAlgorithm": "sha256"
}
```

## 🔒 Security Features

- **JWT Authentication:** Secure token-based auth
- **Rate Limiting:** 60 requests/minute per user
- **Input Validation:** Comprehensive request validation
- **CORS:** Configured for development (open for judging)
- **Password Hashing:** bcrypt with salt rounds
- **Idempotency:** Prevents duplicate operations

## 🧪 Testing

**Run all tests:**
```bash
npm test
```

**Run specific test suites:**
```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

**Test coverage:**
```bash
npm run test:coverage
```

## 🚀 Deployment

### Docker Compose (Recommended)

```bash
docker-compose up -d
```

### Manual Deployment

**Environment Variables:**
```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://user:pass@localhost:5432/microcourses
JWT_SECRET=your-super-secret-jwt-key
TRANSCRIPT_PROVIDER=mock # or 'openai' for real STT
OPENAI_API_KEY=your-openai-key # if using OpenAI STT
```

**Build and start:**
```bash
npm run build
npm start
```

### Platform-Specific Deployment

**Vercel:**
1. Connect GitHub repo to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push

**Render:**
1. Create new Web Service from GitHub
2. Set build command: `npm install && npm run build`
3. Set start command: `npm start`
4. Add environment variables

**Railway:**
1. Connect GitHub repo to Railway
2. Set environment variables
3. Deploy automatically

## 📊 Features Implemented

✅ **Core Features:**
- Three-role system (Learner, Creator, Admin)
- Creator application & approval flow
- Course CRUD operations
- Lesson management with unique ordering
- Enrollment system
- Progress tracking
- Certificate generation with SHA-256 serial
- Transcript generation (mock + OpenAI integration)

✅ **API Requirements:**
- All specified endpoints implemented
- Proper error handling with uniform JSON format
- Idempotency support on all POST endpoints
- Rate limiting (60 req/min/user)
- Pagination support
- CORS configuration

✅ **Frontend Pages:**
- Learner: Course listing, course details, lesson player, progress
- Creator: Application form, dashboard, course management
- Admin: Review applications, approve courses

✅ **Technical Requirements:**
- PostgreSQL database with migrations
- JWT authentication
- Comprehensive test suite
- CI/CD with GitHub Actions
- Docker support
- Seed data with test users

✅ **Security & Quality:**
- Input validation
- Error handling
- Logging
- Clean, modular code
- Environment configuration
- Documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.