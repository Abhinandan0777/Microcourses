#!/bin/bash

# MicroCourses Startup Script

echo "🚀 Starting MicroCourses..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your configuration before running again."
    exit 1
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend && npm install && cd ..

# Run database migrations
echo "🗄️  Running database migrations..."
npm run db:migrate

# Seed database with test data
echo "🌱 Seeding database..."
npm run seed

# Build frontend
echo "🏗️  Building frontend..."
cd frontend && npm run build && cd ..

echo "✅ Setup complete!"
echo ""
echo "🎯 Test Users:"
echo "   Admin:   admin@micro.io / pass123"
echo "   Creator: creator@micro.io / pass123"
echo "   Learner: learner@micro.io / pass123"
echo ""
echo "🚀 Starting servers..."
echo "   Backend:  http://localhost:4000"
echo "   Frontend: http://localhost:3000"
echo ""

# Start backend in background
npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend
cd frontend && npm start &
FRONTEND_PID=$!

# Wait for user to stop
echo "Press Ctrl+C to stop all servers..."
wait

# Cleanup
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null