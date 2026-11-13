@echo off
REM Redrawn 3D Story program — Windows 30-frame test render.
setlocal
cd /d "%~dp0"
set "REMOTION_TMP=%CD%\out\remotion-tmp"
set "TEMP=%REMOTION_TMP%"
set "TMP=%REMOTION_TMP%"
if not exist out mkdir out
if not exist "%REMOTION_TMP%" mkdir "%REMOTION_TMP%"
call npm install
if errorlevel 1 (
  echo [ERROR] npm install failed. Check Node.js is installed, then try again.
  pause
  exit /b 1
)
npx remotion render src/index.ts BridgeShort out\test_30f.mp4 --frames=0-29 --gl=angle --concurrency=4 --image-format=jpeg --jpeg-quality=92 --crf=16
if errorlevel 1 (
  echo [ERROR] Test render failed.
  pause
  exit /b 1
)
echo Done. 30-frame test video: out\test_30f.mp4
pause
