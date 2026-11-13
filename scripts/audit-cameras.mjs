// scripts/audit-cameras.mjs — Item 2 (Layla's office report): numeric camAt audit, pre-render.
// Bundles each video's story.ts with esbuild (a Remotion dependency; no tsx needed),
// iterates every shot/frame, and FAILS LOUDLY listing video + shot + frame for:
//   non-finite pos/look/fov/roll, |look-pos| <= near plane (0.2) + 0.01 margin,
//   fov outside [10,120], |roll| > 2*pi, camAt throwing or returning nothing.
// Run: node scripts/audit-cameras.mjs  (from the program root). Exit 0 = pass, 1 = fail.
// Written by رورو from Opus's round-3 draft, with his finite-check gap fixed (he checked
// only pos[0]/look[0]) and a null guard added (his version crashed on destructure).
import { build } from "esbuild";
import { pathToFileURL } from "url";
import fs from "fs";
import path from "path";

const videos = ["bridge", "abu-simbel", "storm-test"];
const tmpDir = path.resolve(process.cwd(), ".tmp");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};

for (const v of videos) {
  const storyPath = path.resolve(process.cwd(), `src/videos/${v}/story.ts`);
  const tmpPath = path.join(tmpDir, `story-${v}.mjs`);
  // try/finally (Opus re-review Bug 1): a build/import failure used to leave the temp
  // bundle behind. The unlink lives in finally so it runs on those paths; the checks
  // below still exit via fail() AFTER the temp is already gone, so nothing leaks there.
  let story;
  try {
    await build({
      entryPoints: [storyPath],
      outfile: tmpPath,
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node18",
    });
    story = await import(pathToFileURL(tmpPath).href);
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }

  const { SHOTS, camAt } = story;
  if (!Array.isArray(SHOTS) || SHOTS.length === 0) fail(`${v}: SHOTS export missing or empty`);
  if (typeof camAt !== "function") fail(`${v}: camAt export missing`);

  for (const shot of SHOTS) {
    const hist = [];
    for (let f = shot.a; f <= shot.b; f++) {
      let cam;
      try {
        cam = camAt(shot.id, f);
      } catch (err) {
        fail(`${v} shot ${shot.id} frame ${f} threw: ${err.message}`);
      }
      if (!cam || !Array.isArray(cam.pos) || !Array.isArray(cam.look)) {
        fail(`${v} shot ${shot.id} frame ${f}: camAt returned nothing usable (${JSON.stringify(cam)})`);
      }
      const { pos, look, fov, roll } = cam;
      const nums = [...pos, ...look, fov, roll];
      if (nums.length !== 8 || nums.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
        fail(`${v} shot ${shot.id} frame ${f}: non-finite Cam values ${JSON.stringify(cam)}`);
      }
      const dist = Math.hypot(look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]);
      if (dist <= 0.21) {
        fail(`${v} shot ${shot.id} frame ${f}: |look-pos| ${dist.toFixed(4)} <= near plane + margin (0.21)`);
      }
      if (fov < 10 || fov > 120) {
        fail(`${v} shot ${shot.id} frame ${f}: fov ${fov} outside [10, 120]`);
      }
      if (Math.abs(roll) > Math.PI * 2) {
        fail(`${v} shot ${shot.id} frame ${f}: |roll| ${roll} > 2*pi`);
      }
      // Static-hold check (Item 1c): over any 4-frame window the camera must MOVE.
      // "Move" means ANY of pos / look / fov / roll changes — a pure fov zoom moves
      // the picture (bridge S2a zooms 44 -> 43 with a fixed position; the first version
      // of this check measured position only and false-flagged it). Static = all four
      // unchanged across the window (house rule: zero static holds >= 4 frames).
      // History resets per shot (hard cuts jump the camera).
      hist.push({ pos: [...pos], look: [...look], fov, roll });
      if (hist.length > 4) hist.shift();
      if (hist.length === 4) {
        let moved = false;
        for (let k = 0; k < 3; k++) {
          const a = hist[k], b = hist[k + 1];
          const pd = Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2]);
          const ld = Math.hypot(b.look[0] - a.look[0], b.look[1] - a.look[1], b.look[2] - a.look[2]);
          if (pd > 0.001 || ld > 0.001 || Math.abs(b.fov - a.fov) > 0.001 || Math.abs(b.roll - a.roll) > 0.0001) {
            moved = true;
            break;
          }
        }
        if (!moved) {
          fail(`${v} shot ${shot.id} frame ${f}: camera fully static over 4 frames (pos, look, fov and roll all unchanged)`);
        }
      }
    }
  }
}
console.log("SUCCESS: camera numeric audit passed for all videos.");
