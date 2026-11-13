// Dead-camera guard (Opus round 4, 2026-11-12; corrected by رورو: chromeMode is a top-level
// option, not a chromiumOptions field; bundle temp dirs are cleaned up on exit).
// Renders 2 tiny stills (frames 10 and 150, scale 0.05) and fails if they are byte-identical
// (a dead camera on an empty stage, the BA5390N case). Exit 0 = camera moves, exit 1 = dead.
// LIMIT (known): if the scene itself animates while the camera is dead, the two frames differ
// and the check passes — it catches the empty-stage case, not every dead camera. The human
// stills QC remains the backstop. NOTE: this takes minutes (bundle + 2 stills), not <5 s.
// Usage: node scripts/check-camera.mjs [compositionId]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const compId = process.argv[2] || "BridgeShort";

const tmpDir = process.env.REMOTION_TMP || os.tmpdir();
if (process.env.REMOTION_TMP) {
  fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true });
  process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP;
}

function cleanupTempBundles() {
  try {
    for (const file of fs.readdirSync(tmpDir)) {
      if (file.startsWith("remotion-webpack-bundle-")) {
        fs.rmSync(path.join(tmpDir, file), { recursive: true, force: true });
      }
    }
  } catch (_e) {
    // Ignore cleanup errors on exit
  }
}

const LINUX_CHROMIUM_CANDIDATES = [
  "/home/hatch/.cache/ms-playwright/chromium-1194/chrome-linux/chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
];

const browserExecutable =
  process.env.REMOTION_BROWSER_EXECUTABLE ||
  process.env.BROWSER_EXECUTABLE ||
  (process.platform === "win32"
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : LINUX_CHROMIUM_CANDIDATES.find((p) => {
        try {
          return fs.existsSync(p);
        } catch {
          return false;
        }
      }));

const chromiumOptions = {
  // Platform-aware default (verified 2026-11-12): "angle" FAILS on this headless Linux VM
  // ("Error creating WebGL context") — "swangle" (SwiftShader) is required here. Windows keeps
  // "angle" (GPU) for speed. Override with REMOTION_GL when needed.
  gl: process.env.REMOTION_GL || (process.platform === "win32" ? "angle" : "swangle"),
};
const chromeMode = "chrome-for-testing";

const tmpOut1 = path.join(tmpDir, "_cam_check_0.jpg");
const tmpOut2 = path.join(tmpDir, "_cam_check_150.jpg");

try {
  const serveUrl = await bundle({
    entryPoint: path.resolve(process.env.BRIDGE_ENTRY || "src/index.ts"),
    publicDir: path.resolve("public"),
  });

  const composition = await selectComposition({
    serveUrl,
    id: compId,
    browserExecutable,
    chromiumOptions,
    chromeMode,
  });

  // Opus second look (round 6): clamp the probe frames to the composition length — a short
  // composition (< 150 frames) would otherwise crash renderStill with an out-of-bounds frame.
  const f1 = Math.min(10, composition.durationInFrames - 1);
  const f2 = Math.min(150, composition.durationInFrames - 1);

  // Render 2 low-resolution test frames (scale 0.05) to test camera movement.
  // timeoutInMilliseconds 180000: on SwiftShader the page needs well over the 33 s default
  // to become ready (verified 2026-11-12: default timeout fails even on a healthy page).
  await renderStill({
    composition,
    serveUrl,
    frame: f1,
    output: tmpOut1,
    imageFormat: "jpeg",
    scale: 0.05,
    browserExecutable,
    chromiumOptions,
    chromeMode,
    timeoutInMilliseconds: 180000,
  });

  await renderStill({
    composition,
    serveUrl,
    frame: f2,
    output: tmpOut2,
    imageFormat: "jpeg",
    scale: 0.05,
    browserExecutable,
    chromiumOptions,
    chromeMode,
    timeoutInMilliseconds: 180000,
  });

  const b1 = fs.readFileSync(tmpOut1);
  const b2 = fs.readFileSync(tmpOut2);

  if (b1.equals(b2)) {
    console.error(`[ERROR] Dead camera detected on composition "${compId}": Frame ${f1} and Frame ${f2} are identical.`);
    process.exit(1);
  }

  console.log(`[OK] Camera check passed for ${compId}. Camera movement verified.`);
} finally {
  if (fs.existsSync(tmpOut1)) fs.unlinkSync(tmpOut1);
  if (fs.existsSync(tmpOut2)) fs.unlinkSync(tmpOut2);
  cleanupTempBundles();
}
