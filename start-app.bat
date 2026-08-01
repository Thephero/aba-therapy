@echo off
title ABA Therapy Platform - Starting...

:: ──────────────────────────────────────────────
::  ABA Therapy Platform - One-Click Launcher
::  Starts Backend API + Web Frontend + Browser
:: ──────────────────────────────────────────────

set PROJECT_ROOT=%~dp0

:: Validate directories exist
if not exist "%PROJECT_ROOT%aba-backend\package.json" (
    cls
    echo ╔═══════════════════════════════════════════════╗
    echo ║                  ERROR                        ║
    echo ╠═══════════════════════════════════════════════╣
    echo ║  Could not find aba-backend\package.json      ║
    echo ║                                               ║
    echo ║  Make sure this .bat file is in the           ║
    echo ║  project root directory, alongside the        ║
    echo ║  'aba-backend' and 'aba-web' folders.         ║
    echo ╚═══════════════════════════════════════════════╝
    echo.
    pause
    exit /b 1
)

if not exist "%PROJECT_ROOT%aba-web\package.json" (
    cls
    echo ╔═══════════════════════════════════════════════╗
    echo ║                  ERROR                        ║
    echo ╠═══════════════════════════════════════════════╣
    echo ║  Could not find aba-web\package.json          ║
    echo ║                                               ║
    echo ║  Make sure this .bat file is in the           ║
    echo ║  project root directory, alongside the        ║
    echo ║  'aba-backend' and 'aba-web' folders.         ║
    echo ╚═══════════════════════════════════════════════╝
    echo.
    pause
    exit /b 1
)

cls
echo ╔═══════════════════════════════════════════════╗
echo ║      ABA Therapy Platform - Launcher         ║
echo ╚═══════════════════════════════════════════════╝
echo.
echo  Project: %PROJECT_ROOT%
echo.

:: ── Step 1: Start Backend API ──────────────────────
echo  [1/3] Starting Backend API (port 3001)...
start "ABA Backend" cmd /k "cd /d "%PROJECT_ROOT%aba-backend" && echo [Backend] Ready on http://localhost:3001 && npm run dev"

:: Wait for backend to initialize
timeout /t 3 /nobreak >nul

:: ── Step 2: Start Web Frontend ────────────────────
echo  [2/3] Starting Web Frontend (port 3000)...
start "ABA Web" cmd /k "cd /d "%PROJECT_ROOT%aba-web" && echo [Frontend] Ready on http://localhost:3000 && npm run dev"

:: Wait for web server to start responding
timeout /t 6 /nobreak >nul

:: ── Step 3: Open Browser ──────────────────────────
echo  [3/3] Opening browser...
start http://localhost:3000

echo.
echo ╔═══════════════════════════════════════════════╗
echo ║   App is starting!                            ║
echo ║                                               ║
echo ║   Backend  ═^>  http://localhost:3001          ║
echo ║   Frontend ═^>  http://localhost:3000          ║
echo ║                                               ║
echo ║   Keep this window open to monitor status.    ║
echo ║   Close each server window to stop them.      ║
echo ╚═══════════════════════════════════════════════╝
echo.
pause
