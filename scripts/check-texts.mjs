import fs from 'fs';
import path from 'path';

try {
  const storyPath = path.join('src', 'videos', 'abu-simbel', 'story.ts');
  const paintPath = path.join('src', 'videos', 'abu-simbel', 'paint.ts');
  const buildPath = path.join('src', 'videos', 'abu-simbel', 'build.ts');
  const toonPaths = [
    path.join('src', 'videos', 'bridge', 'toon.ts'),
    path.join('src', 'videos', 'abu-simbel', 'toon.ts'),
    path.join('src', 'videos', 'storm-test', 'toon.ts')
  ];

  if (!fs.existsSync(storyPath)) {
    console.error(`Missing file: ${storyPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(paintPath)) {
    console.error(`Missing file: ${paintPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(buildPath)) {
    console.error(`Missing file: ${buildPath}`);
    process.exit(1);
  }
  for (const tp of toonPaths) {
    if (!fs.existsSync(tp)) {
      console.error(`Missing file: ${tp}`);
      process.exit(1);
    }
  }

  const storyContent = fs.readFileSync(storyPath, 'utf8');
  const textsMatch = storyContent.match(/export const TEXTS:[\s\S]*?\];/);
  if (!textsMatch) {
    console.error("TEXTS block not found in story.ts");
    process.exit(1);
  }
  const textsBlock = textsMatch[0];

  const table = [];
  const entryRegex = /\{ key: "([^"]+)", lines: \[([^\]]*)\] \}/g;
  let entryMatch;
  while ((entryMatch = entryRegex.exec(textsBlock)) !== null) {
    const key = entryMatch[1];
    const linesStr = entryMatch[2];
    const lines = [];
    const lineRegex = /"([^"]+)"/g;
    let lineMatch;
    while ((lineMatch = lineRegex.exec(linesStr)) !== null) {
      lines.push(lineMatch[1]);
    }
    table.push({ key, lines });
  }

  const allTableLines = new Set(table.flatMap(t => t.lines));

  const paintContent = fs.readFileSync(paintPath, 'utf8');
  const fillTextRegex = /fillText\("([^"]*)"/g;
  let fillTextMatch;
  const fillTextLiterals = [];
  while ((fillTextMatch = fillTextRegex.exec(paintContent)) !== null) {
    fillTextLiterals.push(fillTextMatch[1]);
  }

  let failed = false;
  for (const literal of fillTextLiterals) {
    if (!allTableLines.has(literal)) {
      console.error(`Literal "${literal}" in paint.ts is not in the TEXTS table.`);
      failed = true;
    }
  }

  const buildContent = fs.readFileSync(buildPath, 'utf8');
  const signBoardRegex = /signBoard\([^;]*?"([^"]+)", \[([^\]]*)\]\)/g;
  let signBoardMatch;
  const signBoardCalls = [];
  while ((signBoardMatch = signBoardRegex.exec(buildContent)) !== null) {
    const key = signBoardMatch[1];
    const linesStr = signBoardMatch[2];
    const lines = [];
    const lineRegex = /"([^"]+)"/g;
    let lineMatch;
    while ((lineMatch = lineRegex.exec(linesStr)) !== null) {
      lines.push(lineMatch[1]);
    }
    signBoardCalls.push({ key, lines });
  }

  for (const call of signBoardCalls) {
    const entry = table.find(t => t.key === call.key);
    if (!entry) {
      console.error(`signBoard call with key "${call.key}" is not in the TEXTS table.`);
      failed = true;
    } else {
      if (JSON.stringify(entry.lines) !== JSON.stringify(call.lines)) {
        console.error(`signBoard call lines for key "${call.key}" do not match the TEXTS table.`);
        failed = true;
      }
    }
  }

  let toonFilesChecked = 0;
  for (const tp of toonPaths) {
    const toonContent = fs.readFileSync(tp, 'utf8');
    toonFilesChecked++;
    if (toonContent.includes('fillText')) {
      console.error(`File ${tp} contains forbidden 'fillText'.`);
      failed = true;
    }
  }

  for (const entry of table) {
    const usedInSignBoard = signBoardCalls.some(call => call.key === entry.key);
    const usedInFillText = entry.lines.every(line => fillTextLiterals.includes(line));
    if (!usedInSignBoard && !usedInFillText) {
      console.error(`Unused TEXTS entry: "${entry.key}"`);
      failed = true;
    }
  }

  console.log(`Table entries: ${table.length}`);
  console.log(`Distinct fillText literals: ${new Set(fillTextLiterals).size}`);
  console.log(`signBoard calls: ${signBoardCalls.length}`);
  console.log(`Toon files checked: ${toonFilesChecked}`);

  if (failed) {
    console.log("TEXTS CHECK: FAIL");
    process.exit(1);
  } else {
    console.log("TEXTS CHECK: PASS");
    process.exit(0);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
