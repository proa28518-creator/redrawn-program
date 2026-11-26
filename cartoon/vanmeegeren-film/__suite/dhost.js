// Creatorize's preview / render host for 3D DOCUMENTARY (style id 'documentary', 1920x1080). Served at
// /p/<projectId>/__suite/documentary.html. The engine is the project's own engine.js copy (the 3D Documentary engine, exported to
// templates/documentary by the lab's tools/export_suite.mjs): F.init() reads film.json, builds every scene module in this page
// (scenes/*.js import 'three', 'doc' and ../lib/ helpers) and `await F.frame(t)` draws any moment, pure in t. Pictures come
// from the project's world/ first, then the shared world kit the app serves at ../__docworld/ (never copied into projects).
// It speaks the same messages as host.js / chost.js, so the editor (Preview.tsx: seek, playing, pick, frame, info, ping,
// graphics) and the render workers (window.suite: info, stills, sweep, exportVideo, events, layout, errors) work unchanged.
import './encoders.js';   // (first: the encoder count render.ts reads, and the app's own encoder on ?cpuenc=1)
const qs = new URLSearchParams(location.search);
const MODE = qs.get('mode') || 'preview';
const RENDER = MODE === 'render';
const FW = 1920, FH = 1080;
const parentPost = msg => { try { window.parent !== window && window.parent.postMessage({ source: 'cz-host', ...msg }, '*'); } catch {} };
const errors = [];
const logError = (level, text) => { errors.push({ level, text: String(text), at: Date.now() }); if (errors.length > 200) errors.shift(); if (MODE === 'preview') parentPost({ type: 'log', level, text: String(text) }); else console.log(`[${level}] ${text}`); };
window.addEventListener('error', e => logError('error', e.message || String(e.error)));
window.addEventListener('unhandledrejection', e => logError('error', String(e.reason?.message || e.reason)));
window.__czWarn = text => logError('warn', text);
document.addEventListener('securitypolicyviolation', e => logError('error', `Blocked by the app's security policy: ${e.effectiveDirective || e.violatedDirective} ${String(e.blockedURI || 'inline').slice(0, 160)}`));

const FILM = 'film.json';
let E = null, F = null, P = null, FILMJ = null, END = 0, t = 0, placeholder = false, WORDS = [];
const out = document.getElementById('out'), outG = out.getContext('2d');
const scenesOf = () => (F ? F.info().scenes : []).slice().sort((a, b) => a.start - b.start);

// ---------- shots: film.json's scenes, named by the words spoken in them ----------
const wordsIn = (t0, t1) => { const w = WORDS.filter(x => x.start >= t0 - .05 && x.start < t1 - .05).map(x => x.word).join(' ').trim(); return w.length > 42 ? w.slice(0, 40).replace(/\s+\S*$/, '') + '…' : w; };
const fileOf = id => { const e = (FILMJ?.scenes || []).find(s => (typeof s === 'string' ? s.replace(/.*\/|\.js$/g, '') : (s.id || s.file.replace(/.*\/|\.js$/g, ''))) === id); return e ? (typeof e === 'string' ? e : e.file) : `scenes/${id}.js`; };
function shotsOf() {
  return scenesOf().map((s, i) => ({ index: i, t0: s.start, t1: s.end, file: fileOf(s.id), line: 1, name: wordsIn(s.start, s.end) || `${s.id}`, id: s.id,
    chapter: null, chapterFirst: false, cut: true, trans: null }));
}
const shotIndexAt = time => { const S = scenesOf(); let k = 0; for (let i = 0; i < S.length; i++) if (S[i].start <= time + 1e-6) k = i; return k; };
const fmtT = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const whereAt = time => { const s = scenesOf()[shotIndexAt(time)]; return `scene ${s ? s.id : '?'} at ${time.toFixed(2)}s: `; };

// ---------- the plain picture when there is no film yet, or it does not load ----------
function card(lines, color = '#e8e8e8') {
  window.__cardText = lines.join(' ');   // (what the card says, for tests: the card itself is pixels)
  out.width = 960; out.height = 540; outG.fillStyle = '#16181d'; outG.fillRect(0, 0, out.width, out.height);
  outG.textAlign = 'center'; outG.textBaseline = 'middle';
  lines.forEach((l, i) => { outG.fillStyle = i ? '#9aa0aa' : color; outG.font = `${i ? 500 : 700} ${i ? 22 : 30}px "Segoe UI", Arial, sans-serif`;
    wrap(l, 800).forEach((w, k, a) => outG.fillText(w, 480, 200 + i * 70 + (k - (a.length - 1) / 2) * 30)); });
}
function wrap(s, max) { const ws = String(s).split(/\s+/), o = []; let cur = ''; for (const w of ws) { const n = cur ? cur + ' ' + w : w; if (outG.measureText(n).width > max && cur) { o.push(cur); cur = w; } else cur = n; } if (cur) o.push(cur); return o.slice(0, 6); }

// ---------- drawing (frame(t) is async: draws are queued, the newest time wins) ----------
let busy = null, want = null;
function blit(c) { if (out.width !== c.width || out.height !== c.height) { out.width = c.width; out.height = c.height; } outG.drawImage(c, 0, 0); }
function draw(time) {
  t = Math.max(0, Math.min(END, +time || 0));
  if (!F) return Promise.resolve();
  want = t;
  if (busy) return busy;
  busy = (async () => {
    while (want != null) { const tt = want; want = null;
      try { const r = await F.frame(Math.max(0, Math.min(END - 1e-4, tt))); blit(r.canvas); } catch (e) { logError('error', whereAt(tt) + (e?.message || e)); } }
    busy = null;
  })();
  return busy;
}
/** one frame for a render worker (never queued, never coalesced): the canvas to capture. The last frame of the film is drawn
 *  just before END (a scene's end is exclusive). */
let lastSceneErrors = 0;
async function frameAt(tt) {
  const r = await F.frame(Math.max(0, Math.min(END - 1e-4, tt)));
  const errs = F.info().errors; if (errs.length > lastSceneErrors) { for (const e of errs.slice(lastSceneErrors)) logError('error', `scene ${e.scene}${e.t != null ? ` at ${(+e.t).toFixed(2)}s` : ''}: ${String(e.message).split('\n')[0]}`); lastSceneErrors = errs.length; }
  return r.canvas;
}

// ---------- its own clock while the video plays (the editor plays the audio; this page follows its epoch clock) ----------
const run = { t: 0, at: 0, rate: 1 }; let playing = false, raf = 0;
const epochNow = () => performance.timeOrigin + performance.now();
function loop() {
  if (!playing) return;
  if (!busy) draw(Math.min(END, run.t + Math.max(0, epochNow() - run.at) / 1000 * run.rate));   // a slow frame skips, never piles up
  raf = requestAnimationFrame(loop);
}
function setPlaying(on, m) {
  if (m) { run.t = m.t; run.at = m.at; run.rate = +m.rate > 0 ? +m.rate : 1; }
  if (on && !playing) { playing = true; raf = requestAnimationFrame(loop); }
  if (!on && playing) { playing = false; cancelAnimationFrame(raf); draw(t); }
}

// ---------- picking: the scene under the click (a desk or a 3D scene is one scene file) ----------
async function pick(nx, ny, time) {
  await draw(time !== undefined ? time : t);
  const sh = shotsOf()[shotIndexAt(t)] || null;
  return { kind: 'shot', time: t, shot: sh ? { index: sh.index, t0: sh.t0, t1: sh.t1, file: sh.file, line: sh.line, name: sh.name } : null };
}

function info() {
  const fi = F ? F.info() : null;
  return { end: END, title: P?.title, settings: P?.settings || {}, art: [FW, FH], size: [FW, FH], kind: 'documentary', errors: errors.slice(-50), cues: [],
    preview: { asked: 1, scale: 1, scalable: false, drawn: [out.width, out.height] }, graphics: {}, gpu: null, shots: shotsOf(), placeholder,
    film: fi ? { id: fi.id, duration: fi.duration, fps: fi.fps, W: fi.W, H: fi.H, scenes: fi.scenes.length, standins: fi.standins.length, sceneErrors: fi.errors.length,
      transitions: (FILMJ?.transitions || []).length } : null };
}

// ---------- boot ----------
async function loadWords() {
  for (const f of ['../audio/timeline.json', '../audio/voice.json']) {
    try {
      const r = await fetch(f, { cache: 'no-store' }); if (!r.ok) continue;
      const j = await r.json(), w = Array.isArray(j?.words) ? j.words : Array.isArray(j) ? j : [];
      const list = w.map(x => ({ word: String(x.word ?? x.text ?? x.w ?? ''), start: +(x.start ?? x.s ?? x.t0 ?? NaN) })).filter(x => x.word && Number.isFinite(x.start));
      if (list.length) return list;
    } catch { /* no words: shots keep their scene ids */ }
  }
  return [];
}
// ---------- the scenes' load, watched (B-0028) ----------
// The engine builds film.json's scenes one after the other (import, build(k)), then waits for the pictures and models they asked
// for. A scene whose import or build never finishes (a top-level await, a picture or model that never arrives) left the page on
// "Loading the scenes..." forever, and doc_check's render page with it. So the load is watched: every scene built or failed is a
// step (window.loadProgress, the editor's "Loading the scenes... 12 of 76", the render worker's deadline counts from the last
// step), and no step for STALL_MS ends the load with an error that names the scene (and the file it still waits for).
const STALL_MS = +qs.get('bootstall') > 0 ? +qs.get('bootstall') : 120000;
const inflight = new Map();   // url -> when it was asked, until it answers (the page's fetches: models, data; imports are not fetches)
{ const f0 = window.fetch.bind(window);
  window.fetch = (input, init) => { const u = String(input?.url ?? input), at = Date.now(); inflight.set(u, at);
    const p = f0(input, init), off = () => { if (inflight.get(u) === at) inflight.delete(u); }; p.then(off, off); return p; }; }
const shortUrl = u => { try { const x = new URL(u, location.href), base = new URL('../', location.href).pathname; return x.pathname.startsWith(base) ? x.pathname.slice(base.length) : x.pathname.replace(/^.*\/__docworld\//, 'world kit: '); } catch { return String(u); } };
const skipped = new Set();
{ const l0 = console.log.bind(console);
  console.log = (...a) => { const m = /^\[skip\] scene (\S+?):/.exec(String(a[0] ?? '')); if (m) skipped.add(m[1]); return l0(...a); }; }
function watchedInit(Fe, args) {
  const list = (FILMJ?.scenes || []).map(e => typeof e === 'string' ? { id: e.replace(/.*\/|\.js$/g, ''), file: e } : { id: e.id || String(e.file).replace(/.*\/|\.js$/g, ''), file: e.file });
  const total = list.length;
  return new Promise((resolve, reject) => {
    let last = -1, lastAt = Date.now(), done = false;
    const state = () => { const fi = Fe.info(), ids = new Set([...fi.scenes.map(s => s.id), ...fi.errors.map(e => e.scene), ...skipped]);
      let k = -1; list.forEach((e, i) => { if (ids.has(e.id)) k = i; });
      return { n: ids.size, next: list[k + 1] || null }; };
    const tick = () => {
      if (done) return;
      const s = state();
      window.loadProgress = { done: s.n, total, scene: s.next?.id || null };
      if (s.n !== last) { last = s.n; lastAt = Date.now(); }
      parentPost({ type: 'loading', done: Math.min(s.n, total), total, scene: s.next?.id || null });
      if (Date.now() - lastAt < STALL_MS) return;
      done = true; clearInterval(iv);
      const waits = [...inflight.entries()].filter(([, at]) => at <= lastAt + 1000).map(([u]) => shortUrl(u)).slice(0, 3);
      const still = waits.length ? ` It was still waiting for ${waits.join(', ')}.` : '';
      const secs = Math.round(STALL_MS / 1000);
      reject(new Error(s.next
        ? `scene ${s.next.id} (${s.next.file}) did not finish loading in ${secs} s: its import or its build(k) never finished (a top-level await, a picture or model that never arrives, or a loop).${still} Fix that scene, or take it out of its part and run doc_merge, and the film loads again.`
        : `the pictures and models the scenes load did not arrive in ${secs} s after the last scene was built.${still} Check that every file the scenes name is in the project (doc_stills and the preview warnings say which ones), then reload.`));
    };
    const iv = setInterval(tick, 1000);
    Fe.init(args).then(r => { done = true; clearInterval(iv); window.loadProgress = { done: total, total, scene: null }; resolve(r); },
      e => { done = true; clearInterval(iv); reject(e); });
  });
}
async function boot() {
  P = await (await fetch('../project.json', { cache: 'no-store' })).json();
  // a new project before Build has no film yet: a plain card, never an error
  const has = await fetch('../' + FILM, { method: 'HEAD', cache: 'no-store' }).then(r => r.ok, () => false);
  // (the voice timed = project.json has its length: then the next step is Build, not the voiceover)
  if (!has) { placeholder = true; END = +P.end > 0 ? +P.end : 0;
    card(END > 0 ? ['No film yet', 'Press Build: it makes the film here from your voiceover: the desk, the archive pictures, the maps and the 3D scenes.']
      : ['No film yet', 'Add the voiceover first. Then Build makes the film here: the desk, the archive pictures, the maps and the 3D scenes.']);
    return { sceneErrors: [] }; }
  try { FILMJ = await (await fetch('../' + FILM, { cache: 'no-store' })).json(); } catch (e) { throw new Error(`film.json is not valid JSON: ${e.message}`); }
  E = await import('../engine.js');
  if (E.ENGINE_KIND !== 'documentary') throw new Error(`this project's engine.js is not the 3D Documentary engine (${E.ENGINE_KIND || 'unknown'})`);
  WORDS = await loadWords();
  await watchedInit(E.F, { film: new URL('../', location.href).href, world: new URL('../__docworld/', location.href).href });
  F = E.F;
  const fi = F.info();
  END = +fi.duration || 0;
  window.F = F; window.E = E;
  const sceneErrors = fi.errors.map(e => ({ scene: e.scene, message: String(e.message).split('\n')[0] }));
  for (const e of sceneErrors) logError('error', `scene ${e.scene} did not build: ${e.message}`);
  lastSceneErrors = fi.errors.length;
  return { sceneErrors };
}

// ---------- message API (preview mode) ----------
let ready = false;
window.addEventListener('message', async e => {
  const m = e.data; if (!m || m.target !== 'cz-host') return;
  if (!ready) { if (m.id) parentPost({ type: 'reply-error', id: m.id, message: window.bootError || 'The preview is not loaded.' }); return; }
  try {
    if (m.type === 'seek') { if (m.playing && typeof m.at === 'number') setPlaying(true, m); else { setPlaying(false); draw(m.t); } }
    else if (m.type === 'playing') setPlaying(!!m.on);
    else if (m.type === 'crisp') { /* the preview draws one size */ }
    else if (m.type === 'pick') parentPost({ type: 'picked', id: m.id, result: F ? await pick(m.x, m.y, m.t) : { kind: 'shot', time: t, shot: null } });
    else if (m.type === 'frame') {
      await draw(m.t ?? t); const s = m.scale || .25, c = document.createElement('canvas'); c.width = Math.round(FW * s); c.height = Math.round(FH * s);
      c.getContext('2d').drawImage(out, 0, 0, c.width, c.height); parentPost({ type: 'frame', id: m.id, dataUrl: c.toDataURL('image/jpeg', .85) });
    }
    else if (m.type === 'info') parentPost({ type: 'info', id: m.id, info: info() });
    else if (m.type === 'ping') parentPost({ type: 'pong', id: m.id, result: { t, lost: !!window.contextLost } });
    else if (m.type === 'graphics') { if (m.id) parentPost({ type: 'graphics', id: m.id, result: { t } }); }
    else if (m.type === 'bench') { const n = m.n || 8, a = performance.now(); for (let k = 0; k < n && F; k++) await F.frame(t); parentPost({ type: 'bench', id: m.id, result: { fps: +(n / Math.max(.001, (performance.now() - a) / 1000)).toFixed(1), t } }); }
  } catch (err) { logError('error', err.message); parentPost({ type: 'reply-error', id: m.id, message: err.message }); }
});

// ---------- render worker API (render mode) ----------
const NO_FILM = 'There is no film yet (film.json): press Build first.';
const FRAME_MS = 10000; let stuckFrame = null;
window.suite = {
  info,
  async stills(times, scale = .5) {
    const res = [];
    for (const tt of times) {
      try {
        if (!F) { res.push(null); continue; }
        // a frame that never finishes (it waits for a picture or model that never arrives) is an error that names its scene,
        // and every later frame of this page answers at once: the page is not usable until it loads again (B-0028)
        if (stuckFrame) { res.push(null); continue; }
        const src = await Promise.race([frameAt(tt), new Promise((_, rej) => setTimeout(() => rej(new Error(`the frame did not finish drawing in ${FRAME_MS / 1000} s: it waits for a picture or model that never arrives`)), FRAME_MS))])
          .catch(e => { if (/did not finish drawing/.test(e?.message)) stuckFrame = whereAt(tt) + e.message; throw e; });
        if (Math.abs(scale - 1) < 1e-6) res.push(src.toDataURL('image/png'));
        else { const c = document.createElement('canvas'); c.width = Math.round(FW * scale); c.height = Math.round(FH * scale); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); res.push(c.toDataURL('image/png')); }
      } catch (err) { logError('error', whereAt(tt) + (err?.message || err)); res.push(null); }
      await new Promise(r => setTimeout(r, 0));
    }
    return res;
  },
  async sweep(fps = 10) {
    const found = new Map(); let n = 0;
    if (!F) return { frames: 0, errors: [] };
    const before = F.info().errors.length;
    for (let f = 0; f <= END * fps; f++) {
      const tt = Math.min(END - 1e-4, f / fps); try { await F.frame(tt); } catch (err) { const k = shotIndexAt(tt) + '|' + err.message; if (!found.has(k)) found.set(k, { t: +tt.toFixed(3), where: whereAt(tt).replace(/: $/, ''), message: err.message }); }
      if (++n % 20 === 0) await new Promise(r => setTimeout(r, 0));
    }
    for (const e of F.info().errors.slice(before)) found.set(e.scene + '|' + e.message, { t: +(+e.t || 0).toFixed(3), where: `scene ${e.scene}`, message: String(e.message).split('\n')[0] });
    return { frames: n, errors: [...found.values()] };
  },
  // the H.264 stream (out/<name>.h264 through the app's server); CZKEY lines: where each key frame starts in the file (render.ts
  // goes on from there after a stop); swenc=1: the software encoder. The post processing is in the frames (no grade handed back).
  async exportVideo({ name = 'video', fps = 30, from = 0, to, bitrate = 16e6 } = {}) {
    if (!F) throw new Error(NO_FILM);
    window.exporting = true;
    to = to ?? END;
    const base = location.pathname.replace(/\/documentary\.html$/, '');
    const chunks = []; let bytes = 0, total = 0, first = true, err = null, encOut = 0;
    const enc = new VideoEncoder({ output: c => { const b = new Uint8Array(c.byteLength); c.copyTo(b);
      if (c.type === 'key') console.log(`CZKEY ${Math.round(c.timestamp * fps / 1e6)} ${total}`);
      chunks.push(b); bytes += b.length; total += b.length; encOut++; }, error: e => err = e });
    let cfg = { codec: 'avc1.640033', width: FW, height: FH, bitrate, framerate: fps, latencyMode: 'quality', avc: { format: 'annexb' } };
    const tries = qs.get('swenc') === '1' ? ['prefer-software'] : ['prefer-hardware', 'no-preference', 'prefer-software'];
    let ok = false;
    for (const hw of tries) { const c = { ...cfg, hardwareAcceleration: hw }; if ((await VideoEncoder.isConfigSupported(c)).supported) { cfg = c; ok = true; break; } }
    if (!ok) throw new Error('This computer has no H.264 video encoder the app can use for a ' + FW + 'x' + FH + ' video.');
    enc.configure(cfg);
    const flush = async force => { if (!chunks.length || (!force && bytes < 8e6)) return; const blob = new Blob(chunks); chunks.length = 0; bytes = 0;
      const r = await fetch(`${base}/append/${name}${first ? '?reset=1' : ''}`, { method: 'POST', body: blob }); first = false;
      if (!r.ok) throw new Error(`Could not write the video: ${await r.text().catch(() => r.status)}`); };
    const n = Math.round((to - from) * fps), t0 = performance.now();
    for (let f = 0; f < n; f++) {
      if (err) throw err;
      const tt = from + f / fps;
      let src; try { src = await frameAt(tt); } catch (e) { throw new Error(`The film throws an error at ${fmtT(tt)} (${whereAt(tt).replace(/: $/, '')}), so the video cannot be exported: ${e.message}. Ask Claude to fix it, then export again.`); }
      const vf = new VideoFrame(src, { timestamp: Math.round(f * 1e6 / fps), duration: Math.round(1e6 / fps) });
      enc.encode(vf, { keyFrame: f % (fps * 2) === 0 }); vf.close();
      while (enc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 1));
      if (f % 30 === 0) { await flush(false); console.log(`PROGRESS ${f} ${n} ${(f / Math.max((performance.now() - t0) / 1000, .001)).toFixed(1)}`); }
    }
    await enc.flush(); await flush(true); enc.close();
    const secs = (performance.now() - t0) / 1000;
    return { frames: n, seconds: +secs.toFixed(1), fps: +(n / secs).toFixed(1), realtime: +((to - from) / secs).toFixed(2), encIn: n, encOut, grade: null };
  },
  // the film.json master as plain JSON (doc_check and doc_merge read the same file from disk)
  film() { return FILMJ ? JSON.parse(JSON.stringify(FILMJ)) : null; },
  // sound design: every scene start is a cut; 2D/3D dissolves come from film.json's transitions
  async events() {
    const fps = FILMJ?.fps || 30;
    return { shots: shotsOf().map(s => ({ t0: +s.t0.toFixed(3), chapter: false, cut: true, mode: 0, name: s.name })), hits: [], cards: [],
      transitions: (FILMJ?.transitions || []).map(x => ({ t0: +((x.f0 || 0) / fps).toFixed(3), t1: +((x.f1 || 0) / fps).toFixed(3), kind: x.kind || 'dissolve', from: x.from, to: x.to })),
      sfx: [], style: 'documentary' };
  },
  // the page half of doc_check / check_layout: one steady frame of each scene (or the asked times), and what can't be right:
  // a scene that did not build, a frame that throws, a frame that is one flat colour, stand-ins (a picture or model the film
  // names that is missing), and a film where every frame is black.
  async layout(times, range) {
    if (!F) return { times: [], issues: [{ t: 0, type: 'no film', what: 'the film', detail: window.bootError || NO_FILM }] };
    const fi = F.info(), issues = [];
    for (const e of fi.errors) if (e.t == null) issues.push({ t: +(e.start || 0), type: 'error', what: `scene ${e.scene}`, detail: `did not build: ${String(e.message).split('\n')[0]}` });
    for (const s of fi.standins) issues.push({ t: 0, type: 'standin', what: String(s?.name || s), detail: 'a picture or model this film names is missing, so a plain stand-in is drawn in its place' });
    const inRange = tt => (range?.from == null || tt >= range.from) && (range?.to == null || tt <= range.to);
    let list = (times?.length ? times : shotsOf().map(s => (s.t0 + s.t1) / 2)).map(tt => +Math.max(0, Math.min(END, +tt || 0)).toFixed(3)).filter(inRange);
    if (!list.length && range) list = [+Math.max(0, Math.min(END, +(range.from ?? range.to) || 0)).toFixed(3)];
    const dark = [], c = document.createElement('canvas'); c.width = 64; c.height = 36;
    const g = c.getContext('2d', { willReadFrequently: true });
    for (const tt of list) {
      try {
        g.drawImage(await frameAt(tt), 0, 0, c.width, c.height);
        const d = g.getImageData(0, 0, c.width, c.height).data; let lo = 255, hi = 0;
        for (let i = 0; i < d.length; i += 4) { const y = .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2]; if (y < lo) lo = y; if (y > hi) hi = y; }
        if (hi - lo < 3) { if (hi < 12) dark.push(tt); else issues.push({ t: tt, type: 'blank', what: whereAt(tt).replace(/: $/, ''), detail: 'the whole frame is one flat colour: nothing of the scene was drawn here. Look at it with doc_stills.' }); }
      } catch (err) { issues.push({ t: tt, type: 'error', what: whereAt(tt).replace(/: $/, ''), detail: String(err?.message || err) }); }
      await new Promise(r => setTimeout(r, 0));
    }
    if (list.length > 1 && dark.length === list.length) issues.push({ t: list[0], type: 'blank', what: 'the whole film', detail: `all ${list.length} checked frames are black: the scenes, the lights or the camera do not show anything.` });
    return { times: list, issues };
  },
  errors: () => errors.slice(),
};

boot().then(async ({ sceneErrors }) => {
  ready = true;
  if (F) await draw(+(qs.get('t') || 0));
  window.ready = true;
  parentPost({ type: 'ready', info: info(), sceneErrors });
}).catch(err => {
  const msg = String(err?.message || err);
  logError('error', 'boot failed: ' + msg); window.bootError = msg; window.ready = true;
  card(['The film did not load', msg.slice(0, 400)], '#ff8a80');
  parentPost({ type: 'boot-error', message: window.bootError });
});
