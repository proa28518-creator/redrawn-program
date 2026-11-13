// scripts/instrumented-render.mjs — P9: instrumented full render.
// Traps SIGTERM/SIGINT/SIGHUP (logs the signal + last memory sample, exits 143/130/129),
// samples memory every 5 s (wrapper RSS + system MemAvailable/SwapFree from /proc/meminfo),
// and streams the child's output to out/render-debug.log. If a run ever dies, the log
// names the killer instead of dying silent. Renders BridgeShort at the locked settings
// with --concurrency=1 (this VM has 1.5 shared CPUs; the default concurrency starves it).
// Run: npm run render:bridge:instrumented  (pre-render checks run first).
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const LOG = path.resolve(process.cwd(), "out/render-debug.log");
fs.mkdirSync(path.dirname(LOG), { recursive: true });
const logStream = fs.createWriteStream(LOG, { flags: "a" });
const stamp = () => new Date().toISOString();
const log = (m) => {
  const line = `[${stamp()}] ${m}\n`;
  process.stdout.write(line);
  logStream.write(line);
};

let lastMem = "no sample yet";
const memTimer = setInterval(() => {
  try {
    const rss = (process.memoryUsage().rss / 1048576).toFixed(0);
    let sys = "";
    if (fs.existsSync("/proc/meminfo")) {
      const mi = fs.readFileSync("/proc/meminfo", "utf8");
      const get = (k) => {
        const m = mi.match(new RegExp(`^${k}:\\s+(\\d+)`, "m"));
        return m ? (parseInt(m[1], 10) / 1024).toFixed(0) : "?";
      };
      sys = ` sysAvail ${get("MemAvailable")} MiB, swapFree ${get("SwapFree")} MiB`;
    }
    lastMem = `wrapper RSS ${rss} MiB,${sys}`;
    log(`[mem] ${lastMem}`);
  } catch (e) {
    log(`[mem error] ${e.message}`);
  }
}, 5000);

log(`=== instrumented render start (pid ${process.pid}) ===`);
const child = spawn(
  "npx",
  ["remotion", "render", "src/index.ts", "BridgeShort", "out/bridge/video.mp4", "--codec", "h264", "--crf", "16", "--scale", "1.3333", "--concurrency=1", "--gl=swangle", "--chrome-mode=chrome-for-testing", "--timeout=180000", "--browser-executable=/home/hatch/.cache/ms-playwright/chromium-1194/chrome-linux/chrome"],
  { stdio: ["ignore", "pipe", "pipe"] },
);
child.stdout.on("data", (d) => {
  process.stdout.write(d);
  logStream.write(d);
});
child.stderr.on("data", (d) => {
  process.stderr.write(d);
  logStream.write(d);
});

const exitCodes = { SIGTERM: 143, SIGINT: 130, SIGHUP: 129 };
const onSignal = (sig) => {
  const msg = `[SIGNAL] ${sig} received. Last memory: ${lastMem}`;
  try {
    fs.appendFileSync(LOG, `[${stamp()}] ${msg}\n`);
  } catch {
    /* log file may be gone; the console line below still lands */
  }
  console.error(msg);
  if (child && !child.killed) child.kill(sig);
  clearInterval(memTimer);
  logStream.end();
  process.exit(exitCodes[sig] || 1);
};
process.on("SIGTERM", () => onSignal("SIGTERM"));
process.on("SIGINT", () => onSignal("SIGINT"));
process.on("SIGHUP", () => onSignal("SIGHUP"));

child.on("close", (code) => {
  clearInterval(memTimer);
  logStream.end();
  log(`[exit] remotion exited with code ${code}`);
  process.exit(code ?? 0);
});
child.on("error", (err) => {
  clearInterval(memTimer);
  logStream.end();
  log(`[error] failed to start: ${err.message}`);
  process.exit(1);
});
