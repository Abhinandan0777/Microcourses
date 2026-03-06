# MicroCourses PowerShell Startup Script

Write-Host "🚀 Starting MicroCourses..." -ForegroundColor Green

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "📝 Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "⚠️  Please edit .env with your configuration before running again." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

try {
    # Install backend dependencies
    Write-Host "📦 Installing backend dependencies..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) { throw "Backend npm install failed" }

    # Install frontend dependencies
    Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Cyan
    Set-Location frontend
    npm install
    if ($LASTEXITCODE -ne 0) { throw "Frontend npm install failed" }
    Set-Location ..

    # Run database migrations
    Write-Host "🗄️  Running database migrations..." -ForegroundColor Cyan
    npm run db:migrate
    if ($LASTEXITCODE -ne 0) { throw "Database migration failed" }

    # Seed database with test data
    Write-Host "🌱 Seeding database..." -ForegroundColor Cyan
    npm run seed
    if ($LASTEXITCODE -ne 0) { throw "Database seeding failed" }

    # Build frontend
    Write-Host "🏗️  Building frontend..." -ForegroundColor Cyan
    Set-Location frontend
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
    Set-Location ..

    Write-Host "✅ Setup complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎯 Test Users:" -ForegroundColor Yellow
    Write-Host "   Admin:   admin@micro.io / pass123" -ForegroundColor White
    Write-Host "   Creator: creator@micro.io / pass123" -ForegroundColor White
    Write-Host "   Learner: learner@micro.io / pass123" -ForegroundColor White
    Write-Host ""
    Write-Host "🚀 Starting servers..." -ForegroundColor Green
    Write-Host "   Backend:  http://localhost:4000" -ForegroundColor White
    Write-Host "   Frontend: http://localhost:3000" -ForegroundColor White
    Write-Host ""
    Write-Host "Press Ctrl+C to stop servers..." -ForegroundColor Yellow

    # Start backend in background
    $backendJob = Start-Job -ScriptBlock { 
        Set-Location $using:PWD
        npm run dev 
    }

    # Wait a moment for backend to start
    Start-Sleep -Seconds 3

    # Start frontend in background
    $frontendJob = Start-Job -ScriptBlock { 
        Set-Location $using:PWD/frontend
        npm start 
    }

    Write-Host "✅ Servers started!" -ForegroundColor Green
    Write-Host "Backend Job ID: $($backendJob.Id)" -ForegroundColor Gray
    Write-Host "Frontend Job ID: $($frontendJob.Id)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To stop servers, run: Stop-Job $($backendJob.Id), $($frontendJob.Id)" -ForegroundColor Yellow

    # Wait for user input to stop
    Read-Host "Press Enter to stop all servers"

    # Stop jobs
    Stop-Job $backendJob, $frontendJob
    Remove-Job $backendJob, $frontendJob

    Write-Host "🛑 Servers stopped." -ForegroundColor Red

} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}