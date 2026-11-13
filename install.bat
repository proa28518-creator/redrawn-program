@echo off
REM Redrawn 3D Story program — Windows installer (idempotent).
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed.
  echo Download Node.js 24 LTS from https://nodejs.org and install it, then run install.bat again.
  pause
  exit /b 1
)
node -v
npm -v
where ffmpeg >nul 2>nul
if errorlevel 1 echo [NOTE] ffmpeg was not found on PATH. It is only needed for the final mux step; install it from https://ffmpeg.org if you want final.mp4 with sound.
if not exist out mkdir out
if not exist public mkdir public
call npm install
if errorlevel 1 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)
echo Install done. Double-click render.bat to render, or test_render.bat for a 30-frame test.
pause
