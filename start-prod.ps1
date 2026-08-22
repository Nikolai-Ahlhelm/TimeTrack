<#
.SYNOPSIS
    Builds and starts TimeTrack in production mode.

.DESCRIPTION
    Installs dependencies, builds the React client and the Express server,
    then runs the compiled server. The server serves the built client and
    the /api routes from a single port. On a fresh database the first-launch
    admin setup wizard is shown (no dev user is seeded).

    App: http://localhost:4000 (override with $env:PORT before running)
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

Write-Host "Building client..." -ForegroundColor Cyan
Push-Location (Join-Path $root "client")
npm run build
Pop-Location

Write-Host "Building server..." -ForegroundColor Cyan
Push-Location (Join-Path $root "server")
npm run build
Pop-Location

$env:NODE_ENV = "production"
if (-not $env:JWT_SECRET) {
    Write-Warning "JWT_SECRET is not set - using an insecure default. Set a real secret for production use."
    $env:JWT_SECRET = "dev-insecure-secret-change-me"
}
if (-not $env:PORT) { $env:PORT = "4000" }

Write-Host ""
Write-Host "Starting TimeTrack (production mode) on http://localhost:$($env:PORT)" -ForegroundColor Green
Write-Host ""

Push-Location (Join-Path $root "server")
node dist/index.js
Pop-Location
