#!/usr/bin/env bash
# Redrawn 3D Story program — Linux / Codespaces 30-frame test render.
set -euo pipefail
cd "$(dirname "$0")"

export REMOTION_TMP="$PWD/out/remotion-tmp"
export TEMP="$REMOTION_TMP" TMP="$REMOTION_TMP"
mkdir -p out "$REMOTION_TMP"

npm install

npx remotion render src/index.ts BridgeShort out/test_30f.mp4 --frames=0-29 --gl=angle --concurrency=4 --image-format=jpeg --jpeg-quality=92 --crf=16
echo "Done. 30-frame test video: out/test_30f.mp4"
