@echo off
REM BoxHero API Integration Setup Script for Windows
REM This script helps set up the BoxHero API integration with proper dependencies

echo 🚀 Setting up BoxHero API Integration...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check Node.js version
echo 📋 Node.js version:
node --version

REM Install/update node-fetch to version 2 (CommonJS compatible)
echo 📦 Installing node-fetch v2 for Node.js compatibility...
npm install node-fetch@2.7.0

REM Verify installation
npm list node-fetch >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ node-fetch installed successfully
    echo 📋 Version:
    npm list node-fetch --depth=0
) else (
    echo ❌ Failed to install node-fetch
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  .env file not found. Creating from example...
    if exist "env.example" (
        copy env.example .env
        echo ✅ Created .env file from env.example
        echo 🔧 Please update BOXHERO_API_TOKEN in .env file
    ) else (
        echo ❌ env.example file not found
    )
) else (
    echo ✅ .env file exists
)

echo.
echo 🎉 Setup complete!
echo.
echo 📋 Next steps:
echo 1. Update BOXHERO_API_TOKEN in .env file
echo 2. Run: npm run db:generate
echo 3. Run: npm run db:push
echo 4. Start server: npm run dev
echo 5. Test API: node test-real-boxhero-api.js
echo.
echo 🔧 Troubleshooting:
echo - If you get 'fetch is not a function', run: npm install node-fetch@2.7.0
echo - If you get module errors, try: npm install
echo - Check Node.js version: node -v (should be 14+)
echo.
pause



