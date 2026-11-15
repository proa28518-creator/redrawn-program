/**
 * Postinstall Port Patch for @remotion/renderer
 *
 * Patches isPortAvailableOnHost in both @remotion/renderer module builds so
 * wildcard host checks ('0.0.0.0' and '::') immediately resolve as 'available':
 *   1. CJS build: node_modules/@remotion/renderer/dist/get-port.js
 *   2. ESM build: node_modules/@remotion/renderer/dist/esm/index.mjs
 *
 * Usage:
 *   node scripts/postinstall-port-patch.mjs [targetPath ...]
 *
 * When invoked without arguments (via npm postinstall), patches both default
 * targets. When invoked with one or more file paths (e.g. argv[2]), patches
 * each specified target path using the matching CJS or ESM anchor profile.
 * Idempotent per target; exits 1 if any target file or anchor is missing.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const guardStatement =
  "if (host === '0.0.0.0' || host === '::') { return Promise.resolve('available'); }";

const cjsAnchor = "const isPortAvailableOnHost = ({ portToTry, host, }) => {";
const cjsPatchLine = guardStatement;

const esmAnchor =
  "var isPortAvailableOnHost = ({\n  portToTry,\n  host\n}) => {";
const esmPatchLine = `  ${guardStatement}`;

const defaultTargets = [
  {
    targetPath: path.resolve(
      __dirname,
      '../node_modules/@remotion/renderer/dist/get-port.js'
    ),
    anchor: cjsAnchor,
    patchLine: cjsPatchLine,
  },
  {
    targetPath: path.resolve(
      __dirname,
      '../node_modules/@remotion/renderer/dist/esm/index.mjs'
    ),
    anchor: esmAnchor,
    patchLine: esmPatchLine,
  },
];

async function patchTarget({ targetPath, anchor, patchLine }) {
  let content;
  try {
    content = await fs.readFile(targetPath, 'utf8');
  } catch (err) {
    console.error(`Error: Could not read target file at ${targetPath}`);
    process.exit(1);
  }

  if (content.includes(guardStatement)) {
    console.log(`Port patch is already applied in ${targetPath}`);
    return;
  }

  let resolvedAnchor = anchor;
  let resolvedPatchLine = patchLine;

  if (!resolvedAnchor) {
    if (content.includes(cjsAnchor)) {
      resolvedAnchor = cjsAnchor;
      resolvedPatchLine = cjsPatchLine;
    } else if (content.includes(esmAnchor)) {
      resolvedAnchor = esmAnchor;
      resolvedPatchLine = esmPatchLine;
    } else {
      const expected = targetPath.endsWith('.mjs') ? esmAnchor : cjsAnchor;
      console.error(
        `Error: Anchor line not found in ${targetPath}: "${expected}"`
      );
      process.exit(1);
    }
  } else if (!content.includes(resolvedAnchor)) {
    console.error(
      `Error: Anchor line not found in ${targetPath}: "${resolvedAnchor}"`
    );
    process.exit(1);
  }

  const replacement = `${resolvedAnchor}\n${resolvedPatchLine}`;
  const updatedContent = content.replace(resolvedAnchor, replacement);

  await fs.writeFile(targetPath, updatedContent, 'utf8');
  console.log(`Successfully applied port patch to ${targetPath}`);
}

async function main() {
  try {
    const cliArgs = process.argv.slice(2);
    const targets =
      cliArgs.length > 0
        ? cliArgs.map((arg) => ({
            targetPath: path.resolve(process.cwd(), arg),
            anchor: null,
            patchLine: null,
          }))
        : defaultTargets;

    for (const target of targets) {
      await patchTarget(target);
    }

    process.exit(0);
  } catch (err) {
    console.error(`Unexpected error during postinstall patch:`, err);
    process.exit(1);
  }
}

main();
