<#
.SYNOPSIS
    Starts TimeTrack in development mode.

.DESCRIPTION
    Installs dependencies if needed, then runs the backend (with hot reload)
    and the Vite frontend dev server side by side. A local admin account
    "dev" / "dev" is automatically seeded on first run so you can log in
    immediately - the first-launch setup wizard is skipped in dev mode.

    Backend:  http://localhost:4000  (API only)
    Frontend: http://localhost:5173  (open this in your browser)
#>

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function Install-IfNeeded($path) {
    if (-not (Test-Path (Join-Path $path "node_modules"))) {
        Write-Host "Installing dependencies in $path..." -ForegroundColor Cyan
        Push-Location $path
        npm install
        Pop-Location
    }
}

Install-IfNeeded (Join-Path $root "server")
Install-IfNeeded (Join-Path $root "client")

$env:NODE_ENV = "development"
$env:DEV_SEED_ADMIN = "true"
if (-not $env:JWT_SECRET) { $env:JWT_SECRET = "dev-insecure-secret-change-me" }
if (-not $env:PORT) { $env:PORT = "4000" }
if (-not $env:CLIENT_ORIGIN) { $env:CLIENT_ORIGIN = "http://localhost:5173" }

Write-Host ""
Write-Host "Starting TimeTrack (development mode)" -ForegroundColor Green
Write-Host "  API:      http://localhost:$($env:PORT)" -ForegroundColor Gray
Write-Host "  App:      http://localhost:5173" -ForegroundColor Gray
Write-Host "  Dev user: dev / dev" -ForegroundColor Gray
Write-Host ""

$serverJob = Start-Process -FilePath "npm" -ArgumentList "run", "dev" `
    -WorkingDirectory (Join-Path $root "server") -PassThru -NoNewWindow

$clientJob = Start-Process -FilePath "npm" -ArgumentList "run", "dev" `
    -WorkingDirectory (Join-Path $root "client") -PassThru -NoNewWindow

try {
    Wait-Process -Id $serverJob.Id, $clientJob.Id
}
finally {
    Write-Host "Shutting down..." -ForegroundColor Yellow
    Stop-Process -Id $serverJob.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $clientJob.Id -ErrorAction SilentlyContinue
}
