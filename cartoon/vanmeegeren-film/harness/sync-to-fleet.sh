#!/bin/bash
# sync-to-fleet.sh — copy the final vanmeegeren-film project into the fleet repo clone
# (cartoon/vanmeegeren-film/), excluding heavy/local-only artifacts, then commit + push.
# Run ONLY when the film is final (all passes closed). The fleet workflow
# (.github/workflows/cartoon-render.yml) renders frames; assembly/mix stay local.
set -euo pipefail
SRC="$HOME/workspace/vanmeegeren-film"
DST="$HOME/workspace/fleet/redrawn-program/cartoon/vanmeegeren-film"
mkdir -p "$DST"
rsync -a --delete \
  --exclude 'world/assets/' \
  --exclude '.suite/' \
  --exclude 'harness/out/' \
  --exclude 'harness/fleet-in/' \
  --exclude '*.bak' \
  --exclude 'harness/fleet-sync.sh' \
  "$SRC/" "$DST/"
cd "$HOME/workspace/fleet/redrawn-program"
git add cartoon/vanmeegeren-film .github/workflows/cartoon-render.yml
git status --short | head -20
echo "Review the diff, then: git commit -m 'vanmeegeren-film: final passes' && git push"
echo "Then trigger: gh workflow run cartoon-render.yml -f frames=0-2277 -f max_chunks=20"
