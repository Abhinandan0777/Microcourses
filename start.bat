@echo off
echo 🚀 Starting MicroCourses...

REM Check if .env exists
if not exist .env (
    echo 📝 Creating .env file from template...
    copy .env.example .env
    echo ⚠️  Please edit .env with your configuration before running again.
    pause
    exit /b 1
)

REM Install backend dependencies
echo 📦 Installing backend dependencies...
call npm install

REM Install frontend dependencies
echo 📦 Installing frontend dependencies...
cd frontend
call npm install
cd ..

REM Run database migrations
echo 🗄️  Running database migrations...
call npm run db:migrate

REM Seed database with test data
echo 🌱 Seeding database...
call npm run seed

REM Build frontend
echo 🏗️  Building frontend...
cd frontend
call npm run build
cd ..

echo ✅ Setup complete!
echo.
echo 🎯 Test Users:
echo    Admin:   admin@micro.io / pass123
echo    Creator: creator@micro.io / pass123
echo    Learner: learner@micro.io / pass123
echo.
echo 🚀 Starting servers...
echo    Backend:  http://localhost:4000
echo    Frontend: http://localhost:3000
echo.
echo Press Ctrl+C to stop servers...

REM Start backend and frontend
start "MicroCourses Backend" cmd /k "npm run dev"
timeout /t 3 /nobreak > nul
start "MicroCourses Frontend" cmd /k "cd frontend && npm start"

echo Servers started in separate windows.
echo Close those windows to stop the servers.
pause