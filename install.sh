#!/usr/bin/env bash
# Redrawn 3D Story program — Linux / Codespaces installer (idempotent).
# Installs Node.js 24 + ffmpeg + Python 3 if missing, then runs npm install.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found — installing Node.js 24 LTS (linux-x64) into ~/.local/node ..."
  NODE_VER=24.22.1
  curl -fsSL "https://nodejs.org/dist/v${NODE_VER}/node-v${NODE_VER}-linux-x64.tar.xz" -o /tmp/node.tar.xz
  mkdir -p "$HOME/.local/node"
  tar -xJf /tmp/node.tar.xz -C "$HOME/.local/node" --strip-components=1
  export PATH="$HOME/.local/node/bin:$PATH"
  grep -q '.local/node/bin' "$HOME/.bashrc" 2>/dev/null || echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> "$HOME/.bashrc"
fi
node -v
npm -v

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found — trying to install it (needs sudo/apt)..."
  if command -v sudo >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y ffmpeg python3
  else
    apt-get update && apt-get install -y ffmpeg python3
  fi
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "WARNING: python3 not found (needed only for the audio pipeline in templates/audio/)."
fi

export REMOTION_TMP="$PWD/out/remotion-tmp"
export TEMP="$REMOTION_TMP" TMP="$REMOTION_TMP"
mkdir -p out "$REMOTION_TMP" public

npm install

echo "Install done. Render with: bash render.sh  (30-frame test: bash test_render.sh)"
