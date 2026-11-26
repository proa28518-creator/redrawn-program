// harness/drive.mjs — drives the project's host page (__suite/cartoon.html?mode=render)
// in the Chrome Headless Shell over CDP, the way the app's render workers drive window.suite.
// Usage:
//   node drive.mjs info                       boot, print window.suite.info() + page errors
//   node drive.mjs stills 0,1.7,4.5 [scale] [outdir]   PNG stills (default scale 1, .suite/frames/harness)
//   node drive.mjs sweep                      suite.sweep(10): every 1/10 s frame drawn, errors collected
//   node drive.mjs track                      suite.track() -> harness/out/track.json (PROP GUARD input)
//   node drive.mjs layout                     suite.layout(): blank/error frame scan
//   node drive.mjs export 0 15.31 pilot       suite.exportVideo -> harness/out/pilot.h264 (via the append server)
//   node drive.mjs frames 0 458 outdir        PNG sequence f_00000.png.. for frames from..to at 30 fps (fleet chunks)
//   node drive.mjs eval "<js expr>"           evaluate in the page, print JSON
// Env: CZ_CHROME (chrome binary), CZ_PORT (http port, default 8765), CZ_CDP (default 9333)
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, ROOT, OUT } from './server.mjs';

const CHROME = process.env.CZ_CHROME || '/home/hatch/workspace/ricksclips-engine-plugin/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell';
const PORT = +(process.env.CZ_PORT || 8765), CDP = +(process.env.CZ_CDP || 9333);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// the Arabic caption fix: the engine's caption stack ("Segoe UI Black", "Arial Black", weight 900) has no
// Arabic on this machine, and lib/stage.js capFaces() returns null for Arabic (no bundled face), so the
// stack is used as-is. Register the project's own Noto Sans Arabic Black under those two family names,
// restricted by unicode-range to Arabic codepoints: Arabic caption runs draw in it, Latin is untouched.
const FONT_INJECT = `(() => { const add = () => { try {
  for (const fam of ['Segoe UI Black', 'Arial Black']) {
    const f = new FontFace(fam, "url('/harness/fonts/NotoSansArabic-Black.ttf')", { weight: '900',
      unicodeRange: 'U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+0640' });
    document.fonts.add(f); f.load().catch(() => {});
  } } catch (e) {} };
  add(); document.addEventListener('DOMContentLoaded', add); })();`;

async function waitJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) { try { const r = await fetch(url); if (r.ok) return await r.json(); } catch {} await sleep(250); }
  throw new Error('no answer from ' + url);
}

class Page {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = [];
    ws.addEventListener('message', ev => { const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
      else if (m.method) this.events.push(m); }); }
  send(method, params = {}) { const id = ++this.id; return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  async eval(expr, awaitPromise = true) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise, returnByValue: true });
    if (r.exceptionDetails) throw new Error('page eval failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result?.value;
  }
}

async function boot() {
  const server = await startServer(PORT);
  const chrome = spawn(CHROME, ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio',
    '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', `--remote-debugging-port=${CDP}`,
    '--user-data-dir=/tmp/cz-chrome-profile', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  chrome.stderr.on('data', () => {});
  const cleanup = async () => { try { chrome.kill('SIGKILL'); } catch {} server.close(); };
  try {
    await waitJson(`http://127.0.0.1:${CDP}/json/version`);
    const targets = await waitJson(`http://127.0.0.1:${CDP}/json/list`);
    const page = targets.find(t => t.type === 'page');
    if (!page) throw new Error('no page target');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    const P = new Page(ws);
    await P.send('Page.enable'); await P.send('Runtime.enable');
    await P.send('Page.addScriptToEvaluateOnNewDocument', { source: FONT_INJECT });
    await P.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/__suite/cartoon.html?mode=render` });
    const t0 = Date.now();
    for (;;) { if (await P.eval('window.ready === true').catch(() => false)) break;
      if (Date.now() - t0 > 180000) throw new Error('page did not become ready in 180 s; bootError=' + await P.eval('window.bootError || null').catch(() => '?'));
      await sleep(500); }
    return { P, cleanup };
  } catch (e) { await cleanup(); throw e; }
}

const [cmd, ...args] = process.argv.slice(2);
const { P, cleanup } = await boot();
try {
  if (cmd === 'info') {
    console.log(JSON.stringify(await P.eval('window.suite.info()'), null, 1));
    console.log('ERRORS:', JSON.stringify(await P.eval('window.suite.errors()')));
  } else if (cmd === 'stills') {
    const times = args[0].split(',').map(Number), scale = +(args[1] || 1), dir = args[2] || join(ROOT, '.suite', 'frames', 'harness');
    mkdirSync(dir, { recursive: true });
    const res = await P.eval(`window.suite.stills(${JSON.stringify(times)}, ${scale})`);
    res.forEach((d, i) => { if (!d) { console.log(times[i], 'NULL'); return; }
      const f = join(dir, `f_${String(times[i]).replace('.', '_')}.png`); writeFileSync(f, Buffer.from(d.split(',')[1], 'base64')); console.log(f); });
    console.log('ERRORS:', JSON.stringify(await P.eval('window.suite.errors()')));
  } else if (cmd === 'sweep') {
    console.log(JSON.stringify(await P.eval('window.suite.sweep(10)')));
  } else if (cmd === 'track') {
    const tr = await P.eval('window.suite.track()');
    writeFileSync(join(OUT, 'track.json'), JSON.stringify(tr)); console.log('ids:', tr?.ids, 'frames:', tr ? Object.keys(tr.frames).length : 0);
  } else if (cmd === 'layout') {
    console.log(JSON.stringify(await P.eval('window.suite.layout()'), null, 1));
  } else if (cmd === 'frames') {
    const from = +args[0], to = +args[1], dir = args[2] || join(ROOT, 'harness', 'out', 'frames');
    mkdirSync(dir, { recursive: true });
    let done = 0, nulls = 0;
    for (let b = from; b <= to; b += 9) {
      const batch = []; for (let f = b; f <= Math.min(b + 8, to); f++) batch.push(f);
      const res = await P.eval(`window.suite.stills(${JSON.stringify(batch.map(f => f / 30))}, 1)`);
      res.forEach((d, i) => { const f = batch[i];
        if (!d) { nulls++; console.log('frame', f, 'NULL'); return; }
        writeFileSync(join(dir, `f_${String(f).padStart(5, '0')}.png`), Buffer.from(d.split(',')[1], 'base64')); done++; });
      console.log(`frames ${batch[0]}..${batch[batch.length - 1]} written (${done}/${to - from + 1})`);
    }
    console.log('FRAMES DONE:', done, 'NULLS:', nulls);
    console.log('ERRORS:', JSON.stringify(await P.eval('window.suite.errors()')));
    if (nulls || done !== to - from + 1) process.exitCode = 3;
  } else if (cmd === 'export') {
    const [from, to, name] = [+args[0], +args[1], args[2] || 'video'];
    console.log(JSON.stringify(await P.eval(`window.suite.exportVideo({ name: ${JSON.stringify(name)}, from: ${from}, to: ${to}, fps: 30 })`)));
  } else if (cmd === 'eval') {
    console.log(JSON.stringify(await P.eval(args[0])));
  } else console.error('unknown command: ' + cmd);
} finally { await cleanup(); }
