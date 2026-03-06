# Simple MicroCourses Setup for Windows

Write-Host "MicroCourses Windows Setup" -ForegroundColor Green
Write-Host ""

# Create .env file
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env file" -ForegroundColor Green
} else {
    Write-Host ".env file already exists" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Get a free database from Supabase.com" -ForegroundColor White
Write-Host "2. Edit .env file with your database URL" -ForegroundColor White
Write-Host "3. Run: npm install --omit=optional" -ForegroundColor White
Write-Host "4. Run: npm run db:migrate" -ForegroundColor White
Write-Host "5. Run: npm run seed" -ForegroundColor White
Write-Host "6. Run: npm run dev" -ForegroundColor White
Write-Host ""

$install = Read-Host "Install dependencies now? (y/n)"

if ($install -eq "y") {
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    npm install --omit=optional
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Backend dependencies installed!" -ForegroundColor Green
        
        Set-Location frontend
        npm install
        Set-Location ..
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Frontend dependencies installed!" -ForegroundColor Green
            Write-Host "Setup complete! Now configure your database." -ForegroundColor Green
        }
    }
}