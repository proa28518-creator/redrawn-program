// Check-beats (Layla's office report, suggestion G): every expression step is tied to
// a narration beat — 1 frame before a spoken word, or the shot's start as its initial
// expression. Opus 5.5 authored; two corrections by رورو: the temp bundle goes in .tmp/
// (audit-cameras.mjs's pattern) not inside src/videos/<v>/, and a dead writeFileSync
// import was removed.
// "check:beats": "node scripts/check-beats.mjs"
import { readFileSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const videos = ["storm-test", "abu-simbel", "bridge"];
let failed = false;

for (const v of videos) {
  const castPath = join("src", "videos", v, "cast.ts");
  const toonPath = join("src", "videos", v, "toon.ts");
  const storyPath = join("src", "videos", v, "story.ts");

  let castText;
  try {
    castText = readFileSync(castPath, "utf8");
  } catch {
    castText = "";
  }

  const tableRegex = /const (\w+_S(\d+)): Step\[\] = \[([\s\S]*?)\];/g;
  let match;
  const tables = [];

  while ((match = tableRegex.exec(castText)) !== null) {
    const tableName = match[1];
    const shotNum = parseInt(match[2], 10);
    const body = match[3];

    const stepRegex = /\{ f: (\d+), expr: "([a-z_]+)" \}/g;
    let stepMatch;
    const steps = [];

    while ((stepMatch = stepRegex.exec(body)) !== null) {
      steps.push({
        f: parseInt(stepMatch[1], 10),
        expr: stepMatch[2],
      });
    }

    tables.push({ tableName, shotNum, steps });
  }

  if (tables.length === 0) {
    console.log(`${v}: no Step tables (expressions computed, by design)`);
    continue;
  }

  let toonText;
  try {
    toonText = readFileSync(toonPath, "utf8");
  } catch {
    console.log(`${v}: Expr union not found in toon.ts`);
    process.exit(1);
  }

  const exprUnionMatch = toonText.match(/export type Expr = ([\s\S]*?);/);
  if (!exprUnionMatch) {
    console.log(`${v}: Expr union not found in toon.ts`);
    process.exit(1);
  }

  const exprBody = exprUnionMatch[1];
  const vocab = new Set();
  const quoteRegex = /"([^"]+)"/g;
  let qMatch;
  while ((qMatch = quoteRegex.exec(exprBody)) !== null) {
    vocab.add(qMatch[1]);
  }

  const tmpDir = join(process.cwd(), ".tmp");
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  const tmpPath = join(tmpDir, `story-beats-${v}.mjs`);
  try {
    await build({
      entryPoints: [storyPath],
      outfile: tmpPath,
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node18",
    });
  } catch {
    console.log(`${v}: story.ts build failed`);
    process.exit(1);
  }

  let storyModule;
  try {
    storyModule = await import(pathToFileURL(tmpPath).href);
  } finally {
    try {
      unlinkSync(tmpPath);
    } catch {}
  }

  const { SHOTS, WORD_FRAMES } = storyModule;
  if (!SHOTS) {
    console.log(`${v}: missing SHOTS export`);
    process.exit(1);
  }
  if (!WORD_FRAMES) {
    console.log(`${v}: missing WORD_FRAMES export`);
    process.exit(1);
  }

  let totalSteps = 0;

  for (const t of tables) {
    const shotIndex = t.shotNum - 1;
    const shot = SHOTS[shotIndex];
    const wordFramesList = WORD_FRAMES[shotIndex] || [];
    const wordFramesSet = new Set(wordFramesList);

    let lastF = -1;

    for (const step of t.steps) {
      totalSteps++;

      if (!vocab.has(step.expr)) {
        console.log(`BEATS FAIL: ${v} ${t.tableName} f${step.f} expr "${step.expr}" is not in the Expr union`);
        failed = true;
      }

      const isStart = shot && step.f === shot.a;
      const isBeforeWord = wordFramesSet.has(step.f + 1);

      if (!isStart && !isBeforeWord) {
        console.log(`BEATS FAIL: ${v} ${t.tableName} f${step.f} is neither shot ${t.shotNum}'s start (${shot ? shot.a : 'unknown'}) nor 1 frame before a word in shot ${t.shotNum}`);
        failed = true;
      }

      if (step.f <= lastF) {
        console.log(`BEATS FAIL: ${v} ${t.tableName} steps out of order at f${step.f}`);
        failed = true;
      }

      lastF = step.f;
    }
  }

  console.log(`${v}: ${tables.length} Step tables, ${totalSteps} steps, ${vocab.size} Expr names`);
}

if (failed) {
  console.log("BEATS CHECK: FAIL");
  process.exit(1);
} else {
  console.log("BEATS CHECK: PASS");
  process.exit(0);
}