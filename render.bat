@echo off
REM Redrawn 3D Story program — Windows render driver.
REM Renders the bridge short (silent) then muxes with voiceover.wav if present.
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
npx remotion render src/index.ts BridgeShort out\full_silent.mp4 --gl=angle --concurrency=4 --image-format=jpeg --jpeg-quality=92 --crf=16
if errorlevel 1 (
  echo [ERROR] Remotion render failed.
  pause
  exit /b 1
)
if not exist voiceover.wav (
  echo [NOTE] voiceover.wav not found next to render.bat — silent video saved as out\full_silent.mp4
  echo Place your voiceover.wav in this folder and run render.bat again to get final.mp4
  pause
  exit /b 0
)
npx remotion ffmpeg -y -i out\full_silent.mp4 -i voiceover.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest final.mp4
if errorlevel 1 (
  echo [ERROR] ffmpeg mux failed.
  pause
  exit /b 1
)
echo Done. Final video: final.mp4
pause
