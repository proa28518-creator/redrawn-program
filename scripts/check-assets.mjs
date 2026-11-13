// Asset validation pre-flight (Opus round 4, 2026-11-12).
// Checks the 26 Kenney GLBs expected in public/bridge/kenney/. Warns (exit 0) when absent,
// because procedural fallbacks exist — this is a warning, not a hard failure.
// Usage: node scripts/check-assets.mjs
import fs from "node:fs";
import path from "node:path";

const KENNEY_DIR = path.resolve("public/bridge/kenney");
const EXPECTED_COUNT = 26;

console.log(`Checking Kenney GLB assets in: ${KENNEY_DIR}`);

// Opus second look (round 6): if the path exists as a FILE (aborted checkout/tar artifact),
// readdirSync would throw ENOTDIR and crash the pre-flight instead of falling back.
if (!fs.existsSync(KENNEY_DIR) || !fs.statSync(KENNEY_DIR).isDirectory()) {
  console.warn(`[WARN] Directory absent or invalid: ${KENNEY_DIR}. Procedural fallbacks will be used.`);
  process.exit(0);
}

const glbFiles = fs.readdirSync(KENNEY_DIR).filter((f) => f.endsWith(".glb"));

if (glbFiles.length < EXPECTED_COUNT) {
  console.warn(
    `[WARN] Found ${glbFiles.length}/${EXPECTED_COUNT} GLB files in ${KENNEY_DIR}. Procedural fallbacks active for missing models.`
  );
} else {
  console.log(`[OK] All ${glbFiles.length} Kenney GLB models are present.`);
}
