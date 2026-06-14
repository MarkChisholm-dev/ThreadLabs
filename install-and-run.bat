@echo off
setlocal

REM Run from the repository root even if launched from another folder.
cd /d "%~dp0"

echo ============================================
echo ThreadLabs - Install and Run
echo ============================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found in PATH.
  echo Install Node.js (which includes npm) and try again.
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

echo [1/2] Installing dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

echo.
echo [2/2] Starting development servers...
echo App: http://localhost:5173
echo API: http://localhost:4000
echo.
echo Press Ctrl+C to stop.
echo.

call npm run dev
set EXIT_CODE=%ERRORLEVEL%

echo.
if not "%EXIT_CODE%"=="0" (
  echo Process exited with code %EXIT_CODE%.
)

echo Press any key to close this window.
pause >nul
exit /b %EXIT_CODE%
