// scripts/render-chunked.mjs — P9 hardening: a full render is split into frame-range
// chunks so no single run must survive 15+ minutes (the SIGTERM kill). Chunks are
// joined with ffmpeg's concat demuxer (-c copy, identical codec settings, each chunk
// starts with an IDR frame, so the join is lossless). Existing chunk files are
// SKIPPED, so a killed run resumes from the next missing chunk instead of restarting.
// Usage: node scripts/render-chunked.mjs <composition> <out.mp4> <framesPerChunk> <startFrame> <endFrame>
//   full:  node scripts/render-chunked.mjs BridgeShort out/bridge/video.mp4 500 0 2024
//   test:  node scripts/render-chunked.mjs BridgeShort out/bridge/test-30f.mp4 15 0 29
// Run via: npm run render:bridge:chunked  (pre-render checks run first).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [comp, out, perChunkArg, startArg, endArg] = process.argv.slice(2);
if (!comp || !out || !perChunkArg || startArg === undefined || endArg === undefined) {
  console.error("usage: node scripts/render-chunked.mjs <composition> <out.mp4> <framesPerChunk> <startFrame> <endFrame>");
  process.exit(2);
}
const perChunk = parseInt(perChunkArg, 10);
const start = parseInt(startArg, 10);
const end = parseInt(endArg, 10);
if (!perChunk || perChunk < 1 || Number.isNaN(start) || Number.isNaN(end) || end < start) {
  console.error("bad range: framesPerChunk >= 1 and 0 <= startFrame <= endFrame required");
  process.exit(2);
}

const root = process.cwd();
const chunkDir = path.resolve(root, "out/.chunks", comp);
fs.mkdirSync(chunkDir, { recursive: true });
const outPath = path.resolve(root, out);
fs.mkdirSync(path.dirname(outPath), { recursive: true });

const chunks = [];
for (let a = start; a <= end; a += perChunk) {
  const b = Math.min(a + perChunk - 1, end);
  const chunkPath = path.join(chunkDir, `${comp}-${a}-${b}.mp4`);
  chunks.push(chunkPath);
  if (fs.existsSync(chunkPath)) {
    console.log(`[chunk] skip ${a}-${b} (already rendered)`);
    continue;
  }
  console.log(`[chunk] rendering frames ${a}-${b} ...`);
  const r = spawnSync(
    "npx",
    ["remotion", "render", "src/index.ts", comp, chunkPath, "--codec", "h264", "--crf", "16", "--scale", "1.3333", "--concurrency=1", `--frames=${a}-${b}`, "--gl=swangle", "--chrome-mode=chrome-for-testing", "--timeout=180000", "--browser-executable=/home/hatch/.cache/ms-playwright/chromium-1194/chrome-linux/chrome"],
    { stdio: "inherit" },
  );
  if (r.status !== 0) {
    console.error(`[chunk] frames ${a}-${b} FAILED (exit ${r.status}). Re-run to resume from this chunk.`);
    process.exit(r.status ?? 1);
  }
}

const listPath = path.join(chunkDir, "concat.txt");
fs.writeFileSync(listPath, chunks.map((c) => `file '${c}'`).join("\n") + "\n");
console.log(`[concat] joining ${chunks.length} chunks -> ${outPath} ...`);
const c = spawnSync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath], { stdio: "inherit" });
if (c.status !== 0) {
  console.error(`[concat] FAILED (exit ${c.status}). Chunks kept in ${chunkDir}.`);
  process.exit(c.status ?? 1);
}
fs.rmSync(chunkDir, { recursive: true, force: true });
console.log(`[done] ${outPath} (${end - start + 1} frames in ${chunks.length} chunks)`);
