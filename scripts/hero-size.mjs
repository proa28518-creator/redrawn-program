// Hero size ratio (part of the QC gate, suggestion B): for each check frame, the
// projected head-width fraction of the subject, checked against the house 25-40%
// range for close-ups. Derived from scripts/check-hero.mjs (same parse, same subject
// rule, same projection) with ONLY the verdict changed to the ratio. Opus 5.5's
// hero-size draft truncated into a loop twice (the file is too long for one response
// when re-derived), so رورو wrote this module by copying check-hero's tested code;
// Opus re-reviews this applied file next (second-look rule).
import fs from 'node:fs';
import path from 'node:path';
import { unlink } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import * as THREE from 'three';

const ASPECT = 1080 / 1920;
/** head width 0.38 m, derived from the house numbers (character height 1.44 m, 3.5
 *  head-heights -> head height 0.41 m, head h/w 0.93 -> head width 0.38 m). */
const HEAD_W = 0.38;
/** face height 1.44 m, measured (COOK_FACE_S5A). */
const FACE_Y = 1.44;

/** Parse one video's cast.ts into [{ shot, okey, anchorName }] — identical to
 *  check-hero.mjs: person() calls live in `const shot<N> = ...` functions (stage()
 *  only dispatches); o is an UNQUOTED identifier; anchor is NAME[0], 0, NAME[2]
 *  (backreference \3, the anchor name — \1 is the o identifier and matches nothing). */
function parseCast(video) {
  const castPath = path.join('src', 'videos', video, 'cast.ts');
  if (!fs.existsSync(castPath)) return [];
  const lines = fs.readFileSync(castPath, 'utf8').split(/\r?\n/);
  let currentShot = null;
  const characters = [];
  for (const line of lines) {
    const shotFnMatch = line.match(/const\s+shot(\d+)\s*=/);
    if (shotFnMatch) {
      currentShot = parseInt(shotFnMatch[1], 10);
      continue;
    }
    const shotMatch = line.match(/if\s*\(\s*id\s*===\s*(\d+)\s*\)/);
    if (shotMatch) {
      currentShot = parseInt(shotMatch[1], 10);
      continue;
    }
    if (currentShot !== null) {
      const personMatch = line.match(/person\s*\(\s*\w+\s*,\s*\{\s*i\s*:\s*\d+\s*,\s*o\s*:\s*([A-Z_]+)\s*,\s*okey\s*:\s*"([^"]+)"\s*\}\s*,\s*([A-Z0-9_]+)\[0\]\s*,\s*0\s*,\s*\3\[2\]\s*,/);
      if (personMatch) {
        const anchorName = personMatch[3];
        if (anchorName.endsWith('_PT')) {
          characters.push({ shot: currentShot, o: personMatch[1], okey: personMatch[2], anchorName });
        }
      }
    }
  }
  return characters;
}

export async function checkHeroSize(frames) {
  const results = [];
  const byVideo = new Map();
  for (const f of frames) {
    if (!byVideo.has(f.video)) byVideo.set(f.video, []);
    byVideo.get(f.video).push(f.frame);
  }

  for (const [video, videoFrames] of byVideo) {
    const characters = parseCast(video);
    if (characters.length === 0) {
      // Bridge/abu-simbel place characters with computed positions — not checkable
      // statically (same limitation as check-hero.mjs).
      for (const frame of videoFrames) {
        results.push({ name: `hero-size-${video}-${frame}`, status: 'YELLOW', reason: 'placements computed at runtime, not checkable statically' });
      }
      continue;
    }

    const tmpOut = path.join('.tmp', `hero-size-story-${video}.mjs`);
    fs.mkdirSync('.tmp', { recursive: true });
    try {
      await build({
        entryPoints: [path.join('src', 'videos', video, 'story.ts')],
        outfile: tmpOut,
        bundle: true,
        format: 'esm',
        platform: 'node',
        target: 'node18',
      });
      const storyMod = await import(pathToFileURL(path.resolve(tmpOut)).href);
      const SHOTS = storyMod.SHOTS;
      const camAt = storyMod.camAt;
      if (!SHOTS || typeof camAt !== 'function') {
        for (const frame of videoFrames) {
          results.push({ name: `hero-size-${video}-${frame}`, status: 'RED', reason: 'story.ts missing SHOTS or camAt' });
        }
        continue;
      }

      // Group the parsed characters by shot, resolving anchors to face points.
      const byShot = new Map();
      for (const char of characters) {
        const anchorVal = storyMod[char.anchorName];
        if (!anchorVal || !Array.isArray(anchorVal)) continue;
        const face = new THREE.Vector3(anchorVal[0], FACE_Y, anchorVal[2]);
        if (!byShot.has(char.shot)) byShot.set(char.shot, []);
        byShot.get(char.shot).push({ ...char, face });
      }

      for (const frame of videoFrames) {
        const name = `hero-size-${video}-${frame}`;
        // Shots are [a, b): a boundary frame belongs to the shot that STARTS there
        // (the cut lands on that frame). Using <= b picks the ENDING shot instead —
        // f466 is shot 5's first frame, not shot 4's last, and the old lookup made the
        // gate test the wrong shot's characters (a false set-piece verdict).
        const shotObj = SHOTS.find((s) => frame >= s.a && frame < s.b)
          || SHOTS.find((s) => frame >= s.a && frame <= s.b);
        if (!shotObj) {
          results.push({ name, status: 'YELLOW', reason: `frame ${frame} is in no shot` });
          continue;
        }
        const shotChars = byShot.get(shotObj.id) || [];
        if (shotChars.length === 0) {
          results.push({ name, status: 'GREEN', reason: 'no character placed in this shot' });
          continue;
        }
        const cam = camAt(shotObj.id, frame);
        if (!cam) {
          results.push({ name, status: 'YELLOW', reason: 'no camera for this frame' });
          continue;
        }
        const pos = new THREE.Vector3(...cam.pos);
        const look = new THREE.Vector3(...cam.look);
        // Subject = the placed character whose anchor is closest (horizontally, x/z)
        // to the look point; beyond 3 m the camera is on a set-piece (mast/sea/sheen).
        let subject = null;
        let bestDist = Infinity;
        for (const c of shotChars) {
          const dx = c.face.x - look.x;
          const dz = c.face.z - look.z;
          const dist = Math.hypot(dx, dz);
          if (dist < bestDist) { bestDist = dist; subject = c; }
        }
        if (!subject || bestDist > 3) {
          results.push({ name, status: 'GREEN', reason: 'set-piece framing (no character subject)' });
          continue;
        }
        const dist = new THREE.Vector3().subVectors(subject.face, pos).length();
        const fovRad = THREE.MathUtils.degToRad(cam.fov);
        const ratio = (HEAD_W / dist) / (2 * Math.tan(fovRad / 2) * ASPECT);
        // Threshold 4.5 m, not the house 3.0 m: the house CU target is 1.8-3.0 m, but
        // this program's actual CU framings sit at 3.36-4.16 m (measured: mocker CU f273
        // 3.36 m, cook CU f466 4.16 m — the v5 QC "close-up dominance" partial, the
        // cameras sit too far). A 3.0 m threshold never fires on this program (vacuous
        // check). 4.5 m covers the real CUs while excluding mediums (~6 m, e.g. f100
        // 5.94 m, ratio 0.135 — correctly exempt, a medium is not a close-up).
        if (dist <= 4.5 && (ratio < 0.25 || ratio > 0.40)) {
          results.push({ name, status: 'RED', reason: `okey=${subject.okey} ratio=${ratio.toFixed(3)} dist=${dist.toFixed(2)}m (outside 0.25-0.40)` });
        } else if (dist <= 4.5) {
          // Ratio was computed and is in range — carry the numbers so a GREEN here is
          // provably exercised, not an exemption.
          results.push({ name, status: 'GREEN', reason: `okey=${subject.okey} ratio=${ratio.toFixed(3)} dist=${dist.toFixed(2)}m` });
        } else {
          results.push({ name, status: 'GREEN' });
        }
      }
    } finally {
      await unlink(tmpOut).catch(() => {});
    }
  }
  return results;
}
