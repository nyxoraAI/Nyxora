$ErrorActionPreference = "Stop"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "🤖 Nyxora Agent - Automated Installer (Windows)" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# 1. Check Node.js availability
try {
    $nodeVersionStr = node -v
} catch {
    Write-Host "❌ Error: Node.js not found!" -ForegroundColor Red
    Write-Host "Nyxora requires Node.js version 18 or higher."
    Write-Host "Please install Node.js from https://nodejs.org/"
    exit 1
}

if ($nodeVersionStr -match "^v(\d+)") {
    $nodeVersion = [int]$matches[1]
    if ($nodeVersion -lt 18) {
        Write-Host "❌ Error: Node.js version is too old! ($nodeVersionStr)" -ForegroundColor Red
        Write-Host "Nyxora requires Node.js v18+. Please update your installation."
        exit 1
    }
}
Write-Host "✓ Node.js ($nodeVersionStr) detected." -ForegroundColor Green

# 2. Check npm availability
try {
    $npmVersionStr = npm -v
} catch {
    Write-Host "❌ Error: NPM not found!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ NPM detected." -ForegroundColor Green

# 3. Global Installation Process
Write-Host "`n📦 Downloading and installing nyxora globally from NPM Registry..." -ForegroundColor Yellow
Write-Host "Please wait a moment (this may require Administrator privileges)."

try {
    # In Windows PowerShell, running external commands requires calling them directly or using &
    & npm install -g nyxora
    if ($LASTEXITCODE -ne 0) {
        throw "NPM installation returned non-zero exit code."
    }
} catch {
    Write-Host "❌ Installation failed. Please open PowerShell as Administrator and run 'npm install -g nyxora' manually." -ForegroundColor Red
    exit 1
}

Write-Host "`n================================================" -ForegroundColor Green
Write-Host "🎉 INSTALLATION SUCCESSFUL!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host "`nNyxora Agent has been successfully installed on your Windows machine."
Write-Host "`n🚀 Next Steps:" -ForegroundColor Yellow
Write-Host "Run the following command in your terminal to begin the setup wizard:"
Write-Host "`n   nyxora setup`n" -ForegroundColor Cyan
