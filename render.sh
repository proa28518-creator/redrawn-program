#!/usr/bin/env bash
# Redrawn 3D Story program — Linux / Codespaces render driver.
# Renders the bridge short (silent) then muxes with voiceover.wav if present.
set -euo pipefail
cd "$(dirname "$0")"

export REMOTION_TMP="$PWD/out/remotion-tmp"
export TEMP="$REMOTION_TMP" TMP="$REMOTION_TMP"
mkdir -p out "$REMOTION_TMP"

npm install

npx remotion render src/index.ts BridgeShort out/full_silent.mp4 --gl=angle --concurrency=4 --image-format=jpeg --jpeg-quality=92 --crf=16

if [ ! -f voiceover.wav ]; then
  echo "[NOTE] voiceover.wav not found next to render.sh — silent video saved as out/full_silent.mp4"
  echo "Place your voiceover.wav in this folder and run render.sh again to get final.mp4"
  exit 0
fi

npx remotion ffmpeg -y -i out/full_silent.mp4 -i voiceover.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest final.mp4
echo "Done. Final video: final.mp4"
