@echo off
setlocal enabledelayedexpansion
title WealthFlow - Deploy to Cloudflare
cd /d "%~dp0"

echo ================================================
echo   WealthFlow - Cloudflare Deploy
echo ================================================
echo.

REM --- Check Node.js is installed ---
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed on this computer.
    echo.
    echo Please install it first from https://nodejs.org
    echo ^(choose the "LTS" version, click through the installer with defaults^)
    echo then double-click this file again.
    echo.
    pause
    exit /b 1
)

REM --- Install project dependencies if needed ---
if not exist "node_modules" (
    echo Installing dependencies - this can take a few minutes the first time...
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed. See the messages above.
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed, skipping.
)
echo.

REM --- Make sure we're logged into Cloudflare ---
echo Checking Cloudflare login...
call npx wrangler whoami >nul 2>nul
if errorlevel 1 (
    echo.
    echo Not logged in yet. A browser window will open so you can
    echo sign in to Cloudflare ^(or create a free account if you don't
    echo have one^). Come back to this window once you're done there.
    echo.
    call npx wrangler login
    if errorlevel 1 (
        echo.
        echo [ERROR] Cloudflare login did not complete. Please try again.
        pause
        exit /b 1
    )
) else (
    echo Already logged in.
)
echo.

REM --- Build the app ---
echo Building the app...
call npm run build
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed. See the messages above.
    pause
    exit /b 1
)
echo.

REM --- Deploy to Cloudflare Workers ---
echo Deploying to Cloudflare...
echo ^(if this is the first deploy, Cloudflare will create the
echo  "wealthflow" project automatically - nothing to set up by hand^)
echo.
call npx wrangler deploy
if errorlevel 1 (
    echo.
    echo [ERROR] Deploy failed. See the messages above.
    pause
    exit /b 1
)

echo.
echo ================================================
echo   Done! Look for the link above starting with
echo   https://wealthflow... .workers.dev
echo   That's your app - open it on any device.
echo ================================================
echo.
pause
