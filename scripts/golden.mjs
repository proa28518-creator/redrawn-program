// Golden acceptance video (Layla's office report, suggestion C): capture a fixed
// 30-frame golden (BridgeShort 0-29) once, then compare every re-render against it
// with per-frame psnr. Opus 5.5 authored; one correction by رورو: ffmpeg numbers
// extracted frames from 1 by default, but the manifest reads f_0000.png..f_0029.png
// — the extract now passes -start_number 0 so the files match the manifest.
// The golden itself is NOT rendered by this script's author — run golden:capture.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const action = process.argv[2];

if (action === 'capture') {
  fs.mkdirSync('out/golden/frames', { recursive: true });
  
  console.log('Rendering golden video...');
  const renderRes = spawnSync('node', ['scripts/render-chunked.mjs', 'BridgeShort', 'out/golden/golden-30f.mp4', '15', '0', '29'], { stdio: 'inherit' });
  if (renderRes.status !== 0) {
    console.error('Render failed with status', renderRes.status);
    process.exit(1);
  }

  console.log('Extracting frames...');
  const ffmpegRes = spawnSync('ffmpeg', ['-y', '-start_number', '0', '-i', 'out/golden/golden-30f.mp4', 'out/golden/frames/f_%04d.png'], { stdio: 'inherit' });
  if (ffmpegRes.status !== 0) {
    console.error('FFmpeg frame extraction failed with status', ffmpegRes.status);
    process.exit(1);
  }

  console.log('Computing frame hashes...');
  const frames = [];
  for (let i = 0; i <= 29; i++) {
    const fileName = `f_${String(i).padStart(4, '0')}.png`;
    const filePath = path.join('out/golden/frames', fileName);
    const fileBuffer = fs.readFileSync(filePath);
    const md5 = crypto.createHash('md5').update(fileBuffer).digest('hex');
    frames.push({
      frame: i,
      file: `frames/${fileName}`,
      md5: md5
    });
  }

  const manifest = {
    composition: "BridgeShort",
    start: 0,
    end: 29,
    perChunk: 15,
    command: "node scripts/render-chunked.mjs BridgeShort out/golden/golden-30f.mp4 15 0 29",
    frames: frames
  };

  fs.writeFileSync('out/golden/manifest.json', JSON.stringify(manifest, null, 2));
  console.log('GOLDEN CAPTURED: out/golden/golden-30f.mp4 (30 frames)');
  process.exit(0);

} else if (action === 'compare') {
  if (!fs.existsSync('out/golden/golden-30f.mp4') || !fs.existsSync('out/golden/manifest.json')) {
    console.log('GOLDEN MISSING: run golden:capture first');
    process.exit(1);
  }

  fs.mkdirSync('out/golden/check', { recursive: true });

  console.log('Rendering check video...');
  const renderRes = spawnSync('node', ['scripts/render-chunked.mjs', 'BridgeShort', 'out/golden/check/check-30f.mp4', '15', '0', '29'], { stdio: 'inherit' });
  if (renderRes.status !== 0) {
    console.error('Render failed with status', renderRes.status);
    process.exit(1);
  }

  const psnrLog = 'out/golden/check/psnr.log';
  console.log('Running PSNR comparison...');
  const ffmpegRes = spawnSync('ffmpeg', [
    '-i', 'out/golden/golden-30f.mp4',
    '-i', 'out/golden/check/check-30f.mp4',
    '-filter_complex', `psnr=stats_file=${psnrLog}`,
    '-f', 'null',
    '-'
  ], { encoding: 'utf8' });

  if (ffmpegRes.status !== 0) {
    console.error('FFmpeg error:', ffmpegRes.stderr);
    process.exit(1);
  }

  if (!fs.existsSync(psnrLog)) {
    console.error('PSNR log file was not created');
    process.exit(1);
  }

  const logContent = fs.readFileSync(psnrLog, 'utf8');
  const lines = logContent.split('\n');
  let failed = false;

  for (const line of lines) {
    if (!line.trim()) continue;
    const nMatch = line.match(/n:(-?\d+)/);
    const psnrMatch = line.match(/psnr_avg:([^\s]+)/);
    if (nMatch && psnrMatch) {
      const frameNum = parseInt(nMatch[1], 10);
      const psnrValStr = psnrMatch[1];
      if (psnrValStr === 'inf') {
        continue;
      }
      const psnrVal = parseFloat(psnrValStr);
      if (psnrVal < 40) {
        console.log(`GOLDEN DIFF: frame ${frameNum} psnr ${psnrVal} dB (below 40 dB)`);
        failed = true;
      }
    }
  }

  if (failed) {
    process.exit(1);
  } else {
    console.log('GOLDEN MATCH: all 30 frames >= 40 dB');
    process.exit(0);
  }
} else {
  console.error('Unknown action. Use "capture" or "compare".');
  process.exit(1);
}

// package.json script lines:
// "golden:capture": "node scripts/golden.mjs capture"
// "golden:compare": "node scripts/golden.mjs compare"