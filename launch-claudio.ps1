#!/usr/bin/env pwsh
# Claudio Launcher with Netease API
# Personal AI Radio

$ErrorActionPreference = "Continue"
$host.ui.RawUI.WindowTitle = "Claudio Launcher"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Claudio - Personal AI Radio" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if port 3000 is in use (Rust API server runs inside Tauri app)
$apiRunning = (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue)

if (-not $apiRunning) {
    Write-Host "[1/2] Starting Claudio (API server will start inside the app)..." -ForegroundColor Yellow
} else {
    Write-Host "[1/2] API server already running on :3000" -ForegroundColor Green
}

Write-Host ""
Write-Host "[2/2] Starting Claudio..." -ForegroundColor Yellow
Write-Host ""

$appPath = Join-Path $PSScriptRoot "src-tauri\target\release\app.exe"

if (Test-Path $appPath) {
    Start-Process $appPath
    Write-Host "Claudio started successfully!" -ForegroundColor Green
} else {
    Write-Host "Error: app.exe not found at:" -ForegroundColor Red
    Write-Host $appPath -ForegroundColor Gray
    Write-Host ""
    Write-Host "Please run 'npm run tauri build' first." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Usage Tips:" -ForegroundColor Cyan
Write-Host "  - Click the green button to chat with Claudio" -ForegroundColor Gray
Write-Host "  - Search for songs in the search bar" -ForegroundColor Gray
Write-Host "  - Click a song to play it" -ForegroundColor Gray
Write-Host "  - Use controls to pause/skip/adjust" -ForegroundColor Gray
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit" | Out-Null
