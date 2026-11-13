// scripts/audit-anchors.mjs — Item 5 (Layla's office report): single-source anchors audit.
// Rule: story.ts is the ONLY file that may define `export const *_PT` anchors.
// build.ts / cast.ts / world.ts must IMPORT any *_PT they use from './story'.
// Run: node scripts/audit-anchors.mjs (from the program root). Exit 0 = pass, 1 = fail.
// Written by رورو. (Opus's drafts had a /g lastIndex bug in .test() and a dead import
// check with no error path; this version uses String.match and checks the real imports.)
import fs from "fs";
import path from "path";

const videos = ["bridge", "abu-simbel", "storm-test"];
const files = ["build.ts", "cast.ts", "world.ts"];
let failed = false;

for (const v of videos) {
  const dir = path.resolve(process.cwd(), `src/videos/${v}`);
  const storyPath = path.join(dir, "story.ts");
  const storyCode = fs.existsSync(storyPath) ? fs.readFileSync(storyPath, "utf8") : "";

  for (const file of files) {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) continue;
    const code = fs.readFileSync(filePath, "utf8");
    // Match CODE only: strip /* */ blocks and // line comments first, so a comment
    // that merely mentions an anchor (e.g. "centre at BLOCK_PT") is not counted as a use.
    // (All 5 first-run findings were comment mentions; the code itself was clean.)
    const codeOnly = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

    // 1. No *_PT definitions outside story.ts. (String.match has no lastIndex state.)
    const defs = codeOnly.match(/export\s+const\s+\w+_PT\s*=/g);
    if (defs) {
      console.error(`FAIL: ${v}/${file} defines its own anchors (must live in story.ts): ${defs.join(", ")}`);
      failed = true;
    }

    // 2. Every *_PT name the file uses must be imported from './story'.
    const used = new Set([...codeOnly.matchAll(/\b([A-Z][A-Z0-9]*_PT)\b/g)].map((m) => m[1]));
    for (const name of used) {
      const importMatch = codeOnly.match(/import\s*\{([^}]*)\}\s*from\s*["']\.\/story["']/);
      const imported = importMatch ? importMatch[1].split(",").map((s) => s.trim()) : [];
      if (!imported.includes(name)) {
        console.error(`FAIL: ${v}/${file} uses ${name} without importing it from './story'`);
        failed = true;
      }
    }
  }

  // 3. story.ts itself must not define the same anchor twice.
  const storyDefs = storyCode.match(/export\s+const\s+(\w+_PT)\s*=/g) || [];
  const names = storyDefs.map((d) => d.match(/(\w+_PT)/)[1]);
  if (new Set(names).size !== names.length) {
    console.error(`FAIL: ${v}/story.ts defines a duplicate anchor: ${names.join(", ")}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("SUCCESS: anchor single-source audit passed for all videos.");
