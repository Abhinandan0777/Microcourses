# MicroCourses Windows Setup Script (No Build Tools Required)

Write-Host "🚀 MicroCourses Windows Setup" -ForegroundColor Green
Write-Host "This script sets up MicroCourses without requiring Visual Studio build tools." -ForegroundColor Yellow
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "📝 Creating .env file from template..." -ForegroundColor Cyan
    Copy-Item ".env.example" ".env"
    Write-Host "✅ Created .env file" -ForegroundColor Green
}

Write-Host "⚙️  Configuring .env for local development..." -ForegroundColor Cyan

# Read current .env content
$envContent = Get-Content ".env" -Raw

# Update DATABASE_URL to use a cloud database or local PostgreSQL
$envContent = $envContent -replace 'DATABASE_URL=.*', 'DATABASE_URL=postgresql://postgres:password@localhost:5432/microcourses'

# Write back to .env
Set-Content ".env" $envContent

Write-Host "✅ Environment configured" -ForegroundColor Green
Write-Host ""

Write-Host "🎯 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Install PostgreSQL locally OR use a cloud database" -ForegroundColor White
Write-Host "2. Update DATABASE_URL in .env with your database connection" -ForegroundColor White
Write-Host "3. Run: npm install --omit=optional" -ForegroundColor White
Write-Host "4. Run: npm run db:migrate" -ForegroundColor White
Write-Host "5. Run: npm run seed" -ForegroundColor White
Write-Host "6. Run: npm run dev" -ForegroundColor White
Write-Host ""

Write-Host "🌐 Cloud Database Options (Free):" -ForegroundColor Cyan
Write-Host "• Supabase: https://supabase.com (Free PostgreSQL)" -ForegroundColor White
Write-Host "• Neon: https://neon.tech (Free PostgreSQL)" -ForegroundColor White
Write-Host "• Railway: https://railway.app (Free PostgreSQL)" -ForegroundColor White
Write-Host "• Render: https://render.com (Free PostgreSQL)" -ForegroundColor White
Write-Host ""

Write-Host "💡 Alternative: Use Docker Desktop" -ForegroundColor Cyan
Write-Host "1. Install Docker Desktop for Windows" -ForegroundColor White
Write-Host "2. Run: docker compose up -d" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Would you like to try installing dependencies now? (y/n)"

if ($choice -eq 'y' -or $choice -eq 'Y') {
    Write-Host "📦 Installing backend dependencies (without optional packages)..." -ForegroundColor Cyan
    
    try {
        npm install --omit=optional
        Write-Host "✅ Backend dependencies installed successfully!" -ForegroundColor Green
        
        Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Cyan
        Set-Location frontend
        npm install
        Set-Location ..
        Write-Host "✅ Frontend dependencies installed successfully!" -ForegroundColor Green
        
        Write-Host ""
        Write-Host "🎉 Setup complete! Next steps:" -ForegroundColor Green
        Write-Host "1. Set up your database (PostgreSQL)" -ForegroundColor White
        Write-Host "2. Update DATABASE_URL in .env" -ForegroundColor White
        Write-Host "3. Run: npm run db:migrate" -ForegroundColor White
        Write-Host "4. Run: npm run seed" -ForegroundColor White
        Write-Host "5. Run: npm run dev" -ForegroundColor White
        
    } catch {
        Write-Host "❌ Installation failed. Try using a cloud database or Docker instead." -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "👍 Skipped installation. Follow the manual steps above when ready." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "• README.md - Complete setup guide" -ForegroundColor White
Write-Host "• DEPLOYMENT.md - Cloud deployment options" -ForegroundColor White
Write-Host "• curl-examples.md - API testing examples" -ForegroundColor White