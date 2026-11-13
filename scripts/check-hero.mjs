// scripts/check-hero.mjs — Item 4 (Layla's office report): hero-in-frame QC.
// Opus 5.5 draft (v2) + 3 fixes by رورو against the real code (Opus's v3 rewrite was
// unusable: hardcoded SHOTS from the wrong video, invented anchors, bundled cast.ts):
// (1) person() regex: o is an UNQUOTED identifier; anchor is NAME[0], 0, NAME[2].
// (2) shot tracking: person() calls live in `const shot<N> = ...` functions, not in
//     `if (id === N)` blocks (stage() only dispatches). (3) SHOTS a/b are FRAME numbers.
// (4) the anchor backreference is \3 (group 3), not \1 (group 1 is the o identifier) —
//     with \1 the regex matched nothing and the script passed vacuously.
// Opus re-reviews this applied file next (second-look rule).
// Subject rule added by رورو after the first run's false positive (see the block comment).
import fs from 'node:fs';
import path from 'node:path';
import { unlink } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import * as THREE from 'three';

const videos = ['storm-test', 'bridge', 'abu-simbel'];
const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;
const ASPECT = WIDTH / HEIGHT;

async function run() {
  let failed = false;
  let partial = false;

  for (const video of videos) {
    const castPath = path.join('src', 'videos', video, 'cast.ts');
    if (!fs.existsSync(castPath)) {
      console.log(`Video ${video}: no cast.ts found, skipping.`);
      continue;
    }

    const castContent = fs.readFileSync(castPath, 'utf8');
    const lines = castContent.split(/\r?\n/);
    
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
          const oName = personMatch[1];
          const okey = personMatch[2];
          const anchorName = personMatch[3];
          
          if (anchorName.endsWith('_PT')) {
            characters.push({
              shot: currentShot,
              o: oName,
              okey,
              anchorName
            });
          }
        }
      }
    }

    if (characters.length === 0) {
      // Bridge/abu-simbel place characters with COMPUTED positions (variables, helper
      // functions — e.g. bridge person(cam, who, x, y, z, ...), abu-simbel X, 0, 3) so the
      // static parse cannot see them. That is a limitation of this check, not a pass:
      // those videos need the runtime check (calling stage() under node) as a follow-up.
      console.log(`Video ${video}: NOT CHECKED — no person() calls with literal ANCHOR[0], 0, ANCHOR[2] positions (placements are computed at runtime).`);
      partial = true;
      continue;
    }

    const tmpOut = path.join('.tmp', `story-${video}.mjs`);
    fs.mkdirSync('.tmp', { recursive: true });
    let checkedFrames = 0;
    let skippedFrames = 0;

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
        console.error(`Video ${video}: story.ts missing SHOTS or camAt`);
        process.exit(1);
      }

      // Subject rule (corrected twice after the first runs): a shot has several framings and
      // the camera moves between subjects (wheel -> mast -> cook). Checking EVERY placed
      // character at every frame false-positives whenever the camera is on a different
      // subject (a cook CU legitimately excludes the captain; a mast cutaway has no
      // character subject at all — storm-test shot 2 f142-172 looks at the mast, f182
      // at the cook). So per sampled frame the subject is the placed character whose
      // anchor is NEAREST the look direction; if even the nearest is outside the
      // half-FOV, the camera is aimed at a non-character subject (mast/sea/sheen) and
      // the frame is skipped. Only the subject is checked — that is the hero-vanishing
      // defect (Whale ending, GLM adhesion shot, Nemotron absence).
      // Second correction: the subject is picked by horizontal look-point distance (3 m),
      // not by angle — the angle rule false-positived on shot 5 f586 (camera on the sea).
      const byShot = new Map();
      for (const char of characters) {
        const anchorVal = storyMod[char.anchorName];
        if (!anchorVal || !Array.isArray(anchorVal)) {
          console.warn(`Warning: Anchor ${char.anchorName} not exported in story.ts for video ${video}, skipping.`);
          continue;
        }
        // Project the FACE, not the feet: the anchor tuple's y is the set-piece height
        // (WHEEL_PT y=1.1 is the wheel centre; SAILOR/COOK/RAIL_PT y=0 is the ground),
        // but the hero is visible when the FACE is in frame — in a close-up the feet are
        // legitimately below the frame (storm-test shot 3 f273: feet NDC y=-1.92, face
        // y=-0.39). Face height 1.44 m is measured: COOK_FACE_S5A = [4, 1.44, 2].
        const anchor = new THREE.Vector3(anchorVal[0], 1.44, anchorVal[2]);
        if (!byShot.has(char.shot)) byShot.set(char.shot, []);
        byShot.get(char.shot).push({ ...char, anchor });
      }

      for (const [shotId, shotChars] of byShot) {
        const shotObj = SHOTS.find((s) => s.id === shotId);
        if (!shotObj) continue;
        let consecutiveOut = 0;
        for (let f = shotObj.a; f <= shotObj.b; f += 10) {
          const cam = camAt(shotId, f);
          if (!cam) continue;
          const pos = new THREE.Vector3(...cam.pos);
          const look = new THREE.Vector3(...cam.look);
          const roll = cam.roll;
          const fovDeg = cam.fov;
          const fovRad = THREE.MathUtils.degToRad(fovDeg);
          const forward = new THREE.Vector3().subVectors(look, pos).normalize();
          const worldUp = new THREE.Vector3(0, 1, 0);
          const right0 = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
          const up0 = new THREE.Vector3().crossVectors(right0, forward);
          const right = right0.clone().applyAxisAngle(forward, roll);
          const up = up0.clone().applyAxisAngle(forward, roll);
          // Subject = the placed character whose anchor is CLOSEST (horizontally) to
          // the look point. The angle rule was wrong: on a portrait frame the horizontal
          // half-FOV (~13 deg at fov 44) is far narrower than the vertical half-FOV, so a
          // character 17 deg off-axis is already out of frame while still "within" fov/2
          // — storm-test shot 5 f586 false-positived on the cook that way (the camera
          // looks at the sea at [1.5,-1.4,-8], 10.3 m from the rail). Measured cases:
          // wheel framing look-to-anchor ~2.6 m (subject), cook CU 0 m (subject),
          // mast cutaway ~6.6 m (skip), sea ~10-14 m (skip). Threshold 3 m.
          let subject = null;
          let bestDist = Infinity;
          for (const c of shotChars) {
            const dx = c.anchor.x - look.x;
            const dz = c.anchor.z - look.z;
            const dist = Math.hypot(dx, dz);
            if (dist < bestDist) { bestDist = dist; subject = c; }
          }
          if (!subject || bestDist > 3) {
            consecutiveOut = 0;
            skippedFrames++;
            continue;
          }
          checkedFrames++;
          const toAnchor = new THREE.Vector3().subVectors(subject.anchor, pos);
          const d = toAnchor.dot(forward);
          const tanHalfFov = Math.tan(fovRad / 2);
          const x_ndc = d <= 0.21 ? 999 : toAnchor.dot(right) / (d * tanHalfFov * ASPECT);
          const y_ndc = d <= 0.21 ? 999 : toAnchor.dot(up) / (d * tanHalfFov);
          if (d <= 0.21 || Math.abs(x_ndc) > 1.05 || Math.abs(y_ndc) > 1.05) consecutiveOut++;
          else consecutiveOut = 0;
          if (consecutiveOut >= 3) {
            console.log(`FAIL: video=${video} shot=${shotId} frame=${f} okey=${subject.okey} x_ndc=${x_ndc.toFixed(3)} y_ndc=${y_ndc.toFixed(3)}`);
            failed = true;
            break;
          }
        }
        if (failed) break;
      }
    } finally {
      await unlink(tmpOut).catch(() => {});
    }

    if (!failed) {
      console.log(`Video ${video}: ${characters.length} characters, ${checkedFrames} sampled frames checked (subject in frame), ${skippedFrames} frames skipped (camera on a set-piece). PASS.`);
    }

    if (failed) break;
  }

  if (failed) {
    process.exit(1);
  } else if (partial) {
    console.log('PARTIAL — no hero-vanishing defect found in the videos that could be checked; bridge and/or abu-simbel were NOT checked (runtime placements — see the notes above).');
    process.exit(0);
  } else {
    console.log('SUCCESS');
    process.exit(0);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});