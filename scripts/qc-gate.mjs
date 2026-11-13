// "qc:all": "node scripts/qc-gate.mjs"
// QC gate (Layla's office report, suggestion B): one command running the five checks,
// rendering 6 check frames, measuring luma + hero size, green/red report.
// Opus 5.5 authored the runner; four corrections by رورو (recorded in the record file):
// (1) stills render grouped by video (3 spawns, frames comma-joined) — Opus spawned one
//     render per frame (6 bundles instead of 3). (2) still filenames use the RAW frame
//     number (x_466.jpg, not x_0466.jpg — stills.mjs does not pad) — Opus padded to 4
//     digits, so the luma step would have opened nonexistent files and passed vacuously
//     (NaN < 0.05 is false). The luma step now REDs on a missing file / python error / NaN.
// (3) the composition-id -> video-dir mapping is explicit (Opus's string replaces made
//     "abusimbel" out of "AbuSimbel"). (4) each check's stdout/stderr is written through
//     so a RED line is actionable (Opus swallowed it).
import { spawnSync } from 'node:child_process';
import { checkHeroSize } from './hero-size.mjs';

const results = [];
const scripts = [
  { name: 'assets', cmd: 'node', args: ['scripts/check-assets.mjs'] },
  { name: 'camera-bridge', cmd: 'node', args: ['scripts/check-camera.mjs', 'BridgeShort'] },
  { name: 'audit-cameras', cmd: 'node', args: ['scripts/audit-cameras.mjs'] },
  { name: 'audit-anchors', cmd: 'node', args: ['scripts/audit-anchors.mjs'] },
  { name: 'check-hero', cmd: 'node', args: ['scripts/check-hero.mjs'] }
];

for (const s of scripts) {
  const res = spawnSync(s.cmd, s.args, { encoding: 'utf8' });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  if (res.status === 0) {
    if (s.name === 'check-hero' && res.stdout.includes('PARTIAL')) {
      results.push({ name: 'check-hero', status: 'YELLOW', reason: 'bridge + abu-simbel were not checked' });
    } else {
      results.push({ name: s.name, status: 'GREEN' });
    }
  } else {
    const reason = (res.error && res.error.message) || res.stderr.trim() || `Exit code ${res.status}`;
    results.push({ name: s.name, status: 'RED', reason });
  }
}

// Composition id (for stills.mjs) -> video dir (for story.ts / the still filenames).
const stills = [
  { comp: 'StormTest', dir: 'storm-test', frames: [466, 150] },
  { comp: 'BridgeShort', dir: 'bridge', frames: [100, 400] },
  { comp: 'AbuSimbel', dir: 'abu-simbel', frames: [1424, 800] }
];
const flatStills = [];
for (const s of stills) {
  const render = spawnSync('node', ['scripts/stills.mjs', 'out/qc-gate/x_', s.frames.join(','), '0.5', s.comp], { encoding: 'utf8' });
  if (render.stdout) process.stdout.write(render.stdout);
  if (render.stderr) process.stderr.write(render.stderr);
  if (render.status !== 0) {
    for (const f of s.frames) {
      results.push({ name: `still-${s.dir}-${f}`, status: 'RED', reason: 'Render failed' });
    }
    continue;
  }
  for (const f of s.frames) {
    // stills.mjs names files by the RAW frame number (x_466.jpg, no zero-padding).
    const path = `out/qc-gate/x_${f}.jpg`;
    flatStills.push({ video: s.dir, frame: f, path });
    const luma = spawnSync('python3', ['-c', "from PIL import Image; import numpy as np, sys; a = np.asarray(Image.open(sys.argv[1]).convert('L'), dtype=float) / 255.0; print(f'{a.mean():.4f} {np.percentile(a, 5):.4f}')", path], { encoding: 'utf8' });
    if (luma.status !== 0) {
      results.push({ name: `still-${s.dir}-${f}`, status: 'RED', reason: `Luma measurement failed: ${(luma.stderr || '').trim()}` });
      continue;
    }
    const [mean, p5] = luma.stdout.trim().split(' ').map(Number);
    if (!Number.isFinite(mean) || !Number.isFinite(p5)) {
      results.push({ name: `still-${s.dir}-${f}`, status: 'RED', reason: `Luma measurement returned no numbers for ${path}` });
    } else if (mean < 0.05 || p5 < 0.005) {
      results.push({ name: `still-${s.dir}-${f}`, status: 'RED', reason: `Crushed luma (mean ${mean}, p5 ${p5})` });
    } else {
      results.push({ name: `still-${s.dir}-${f}`, status: 'GREEN' });
    }
  }
}

const sizeResults = await checkHeroSize(flatStills.map((s) => ({ video: s.video, frame: s.frame })));
results.push(...sizeResults);

let fail = false;
for (const r of results) {
  if (r.status === 'RED') fail = true;
  console.log(r.status === 'GREEN' ? `GREEN ${r.name}` : `${r.status} ${r.name}: ${r.reason}`);
}

console.log(`QC GATE: ${fail ? 'FAIL' : 'PASS'}`);
process.exit(fail ? 1 : 0);
