// Working-copy stills script (Opus round 4, 2026-11-12; corrected by رورو: chromeMode is a
// TOP-LEVEL renderStill/selectComposition option in Remotion 4.0.290, NOT a chromiumOptions
// field — Opus put it inside chromiumOptions where it would be silently ignored).
// Usage: node scripts/stills.mjs <outPrefix> <frame,frame,...> [scale] [compositionId]
// BRIDGE_ENTRY=src/sandboxes/<name>/index.tsx renders a sandbox copy instead of the main entry.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = process.env.REMOTION_TMP || os.tmpdir();
if (process.env.REMOTION_TMP) {
  fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true });
  process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP;
}

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const [prefix, frames, scale = "0.5", compId = "BridgeShort"] = process.argv.slice(2);

function cleanupTempBundles() {
  try {
    const files = fs.readdirSync(tmpDir);
    for (const file of files) {
      if (file.startsWith("remotion-webpack-bundle-")) {
        fs.rmSync(path.join(tmpDir, file), { recursive: true, force: true });
      }
    }
  } catch (_e) {
    // Ignore cleanup errors on exit
  }
}

process.on("exit", cleanupTempBundles);
process.on("SIGINT", () => {
  cleanupTempBundles();
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error(err);
  cleanupTempBundles();
  process.exit(1);
});
// Opus second look (round 6): top-level await rejections surface as unhandledRejection,
// NOT uncaughtException — without this handler a rejected render leaves bundles orphaned.
process.on("unhandledRejection", (err) => {
  console.error(err);
  cleanupTempBundles();
  process.exit(1);
});

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
// chromeMode is a top-level option of selectComposition/renderStill (Remotion 4.0.290),
// NOT a chromiumOptions field. Default is 'headless-shell'; stills need 'chrome-for-testing'.
const chromeMode = "chrome-for-testing";

let serveUrl = null;

try {
  serveUrl = await bundle({
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

  const onBrowserLog = (l) => {
    if (l.type === "error" || l.type === "warning") {
      console.log(`[${l.type}]`, l.text.slice(0, 300));
    }
  };

  if (frames) {
    for (const f of frames.split(",").map(Number)) {
      const t0 = Date.now();
      await renderStill({
        composition,
        serveUrl,
        frame: f,
        output: `${prefix}${f}.jpg`,
        imageFormat: "jpeg",
        jpegQuality: 88,
        scale: Number(scale),
        browserExecutable,
        chromiumOptions,
        chromeMode,
        timeoutInMilliseconds: 180000,
        onBrowserLog,
      });
      console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
    }
  }
} finally {
  cleanupTempBundles();
}
