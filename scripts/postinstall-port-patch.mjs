// scripts/postinstall-port-patch.mjs — Item 12 (Layla's office report): the port-check patch.
// Layla's office (Telegram group msgs 3625-3626, 2026-11-13): every fresh install needs ONE
// line inside node_modules/@remotion/renderer/dist/get-port.js (4.0.290) or the render dies at
// startup with "Error: No available ports found" (their environment answers any connection to
// 0.0.0.0, so the stock socket test sees all ports busy). The patch is install-time: it lives
// in node_modules and disappears on reinstall, so this postinstall script re-applies it.
// Opus 5.5 authored (RadoxAI); verified against a COPY in /tmp before any live use.
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultTargetPath = path.resolve(
  __dirname,
  '../node_modules/@remotion/renderer/dist/get-port.js'
);

const targetPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : defaultTargetPath;

const anchor = "const isPortAvailableOnHost = ({ portToTry, host, }) => {";
const patchLine = "if (host === '0.0.0.0' || host === '::') { return Promise.resolve('available'); }";

async function main() {
  try {
    let content;
    try {
      content = await fs.readFile(targetPath, 'utf8');
    } catch (err) {
      console.error(`Error: Could not read target file at ${targetPath}`);
      process.exit(1);
    }

    if (content.includes(patchLine)) {
      console.log(`Port patch is already applied in ${targetPath}`);
      process.exit(0);
    }

    if (!content.includes(anchor)) {
      console.error(`Error: Anchor line not found in ${targetPath}: "${anchor}"`);
      process.exit(1);
    }

    const replacement = `${anchor}\n${patchLine}`;
    const updatedContent = content.replace(anchor, replacement);

    await fs.writeFile(targetPath, updatedContent, 'utf8');
    console.log(`Successfully applied port patch to ${targetPath}`);
    process.exit(0);
  } catch (err) {
    console.error(`Unexpected error during postinstall patch:`, err);
    process.exit(1);
  }
}

main();
