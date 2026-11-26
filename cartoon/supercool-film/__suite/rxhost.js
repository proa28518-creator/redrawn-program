// Creatorize's preview / render host for ROBLOX STORY SHORTS, look COMPLEX (style id 'robloxcx', 1080x1440, 60 fps). Served at
// /p/<projectId>/__suite/robloxcx.html. The engine is the project's own copy (engine/, char/, env/shots/: exported to
// templates/robloxcx by experiments/roblox-style/complex/tools/export_suite.mjs). A film is film.json: shot modules on the film
// clock (the member's voice): { fps, size, shots: [{ id, t0, file, args }], end?, captions? }. A shot runs from its t0 to the next
// shot's t0. This page builds the shot under the playhead in ITS OWN stage (stage.js: 2x supersampled in render mode, 1x in the
// preview) and disposes the previous one, so every frame is a pure function of t. The one-word captions are drawn on top here
// (the reference's measured style). The big Roblox library comes from ../__cxlib/ (the app serves it; never in the project).
// It speaks the same messages as host.js / dhost.js, so the editor (Preview.tsx) and the render workers (window.suite) work unchanged.
import './encoders.js';   // (first: the encoder count render.ts reads, and the app's own encoder on ?cpuenc=1)
const qs = new URLSearchParams(location.search);
const MODE = qs.get('mode') || 'preview';
const RENDER = MODE === 'render';
const FW = 1080, FH = 1440;
const parentPost = msg => { try { window.parent !== window && window.parent.postMessage({ source: 'cz-host', ...msg }, '*'); } catch {} };
const errors = [];
const logError = (level, text) => { errors.push({ level, text: String(text), at: Date.now() }); if (errors.length > 200) errors.shift(); if (MODE === 'preview') parentPost({ type: 'log', level, text: String(text) }); else console.log(`[${level}] ${text}`); };
window.addEventListener('error', e => logError('error', e.message || String(e.error)));
window.addEventListener('unhandledrejection', e => logError('error', String(e.reason?.message || e.reason)));
window.__czWarn = text => logError('warn', text);
document.addEventListener('securitypolicyviolation', e => logError('error', `Blocked by the app's security policy: ${e.effectiveDirective || e.violatedDirective} ${String(e.blockedURI || 'inline').slice(0, 160)}`));

const STAMP = Date.now();
let P = null, FILMJ = null, SHOTS = [], END = 0, t = 0, placeholder = false, WORDS = [], CAPS = [], E = null;
const out = document.getElementById('out'), outG = out.getContext('2d');
out.width = FW; out.height = FH;
const fmtT = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const shotIndexAt = time => { let k = 0; for (let i = 0; i < SHOTS.length; i++) if (SHOTS[i].t0 <= time + 1e-6) k = i; return k; };
const whereAt = time => { const s = SHOTS[shotIndexAt(time)]; return `shot ${s ? s.id : '?'} at ${time.toFixed(2)}s: `; };

// ---------- shots: film.json, named by the words spoken in them ----------
const wordsIn = (t0, t1) => { const w = WORDS.filter(x => x.start >= t0 - .05 && x.start < t1 - .05).map(x => x.word).join(' ').trim(); return w.length > 42 ? w.slice(0, 40).replace(/\s+\S*$/, '') + '…' : w; };
function shotsOf() { return SHOTS.map((s, i) => ({ index: i, t0: s.t0, t1: s.t1, file: s.file, line: 1, name: wordsIn(s.t0, s.t1) || s.id, id: s.id, chapter: null, chapterFirst: false, cut: true, trans: null })); }

// ---------- captions: one word at a time from the voice's words (COMPLEX_REF.md section 5) ----------
// lower case, no punctuation, names and "I" keep their capital, sound words in full caps; film.json "captions": { keep: [words that keep
// their capital], sound: { word: 'BOOM' }, replace: { word: 'Mr' }, hide: [words not shown], names: false (no automatic name capitals) }
export function captionWords(words, cap = {}) {
  const keep = new Set(['I', "I'm", "I've", "I'll", "I'd", ...(cap.keep || [])]);
  const low = o => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [String(k).toLowerCase(), String(v)]));
  const sound = low(cap.sound), repl = low(cap.replace), hide = new Set((cap.hide || []).map(w => String(w).toLowerCase()));
  const out = [];
  words.forEach((w, i) => {
    const raw = String(w.word).trim(), s = raw.replace(/[.,!?;:"“”…()[\]{}]/g, '').replace(/^['‘’]+|['‘’]+$/g, '');
    if (!s) return;
    const l = s.toLowerCase();
    if (hide.has(l)) return;
    const prev = i ? String(words[i - 1].word).trim() : '.';
    const start = i === 0 || /[.!?…]["')\]]*$/.test(prev);
    let txt = sound[l] ?? repl[l] ?? (keep.has(s) ? s : (cap.names !== false && /^[A-Z][a-z]/.test(s) && !start) ? s : /^[A-Z]{3,}$/.test(s) ? s : l);
    out.push({ t: i === 0 ? 0 : +w.start, w: txt });
  });
  return out;
}
let capFont = null;   // { size }: Poppins Bold sized so a lower-case x is 54 px tall at 1440, baseline at y 1021
let capFamily = 'Poppins';
const capFace = size => `700 ${size}px ${capFamily}, "Segoe UI", Arial, sans-serif`;
function captionAt(time) { let lo = 0, hi = CAPS.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (CAPS[m].t <= time + 1e-6) { k = m; lo = m + 1; } else hi = m - 1; } return k >= 0 ? CAPS[k].w : ''; }
function drawCaption(g, time) {
  if (P?.settings?.captions?.on === false || !CAPS.length) return;
  const w = captionAt(time); if (!w) return;
  if (!capFont) { g.font = capFace(100); const xh = g.measureText('x').actualBoundingBoxAscent || 54; capFont = { size: 100 * 54 / xh }; }
  const k = g.canvas.height / FH, size = capFont.size * k, x = g.canvas.width / 2, y = 1021 * k, lw = 12 * k, sh = 3 * k;
  g.save(); g.font = capFace(size); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.miterLimit = 2;
  g.fillStyle = '#000'; g.strokeStyle = '#000'; g.lineWidth = lw;
  g.strokeText(w, x + sh, y + sh); g.fillText(w, x + sh, y + sh);     // the small hard shadow to the lower right
  g.strokeText(w, x, y);                                                 // the 6 px outline
  g.fillStyle = '#fff'; g.fillText(w, x, y);
  g.restore();
}

// ---------- the plain picture when there is no film yet, or it does not load ----------
function card(lines, color = '#e8e8e8') {
  window.__cardText = lines.join(' ');
  outG.fillStyle = '#16181d'; outG.fillRect(0, 0, out.width, out.height);
  outG.textAlign = 'center'; outG.textBaseline = 'middle';
  lines.forEach((l, i) => { outG.fillStyle = i ? '#9aa0aa' : color; outG.font = `${i ? 500 : 700} ${i ? 40 : 56}px "Segoe UI", Arial, sans-serif`;
    wrap(l, 900).forEach((w, k, a) => outG.fillText(w, FW / 2, 560 + i * 170 + (k - (a.length - 1) / 2) * 54)); });
}
function wrap(s, max) { const ws = String(s).split(/\s+/), o = []; let cur = ''; for (const w of ws) { const n = cur ? cur + ' ' + w : w; if (outG.measureText(n).width > max && cur) { o.push(cur); cur = w; } else cur = n; } if (cur) o.push(cur); return o.slice(0, 8); }

// ---------- one stage per shot ----------
const SS = Math.max(1, Math.min(2, +(qs.get('ss') || (RENDER ? 2 : 1))));
let ssNow = SS;            // (the review draws its small sheets and probes at 1x: review() below)
let cur = null;            // { idx, stage, shot, error }
let building = null;       // Promise of the shot being built
const shotErrors = new Map();   // id -> message (a shot that did not build)
// how far the page's load is (render.ts load(): a page that reports a new step gets its 3 minutes from that step, at most 15 in
// all): the film read, the library and the engine, then each part of the first shot's build. A heavy first shot on a slower
// card took longer than the flat 3 minutes and the render page was killed as stuck (0.28.3).
let loadN = 0;
const loadStep = label => { if (!window.ready) window.loadProgress = { done: ++loadN, total: 0, scene: label }; };
window.loadProgress = { done: 0, total: 0, scene: 'film' };
// a shot being built: since when (an export page says it is alive while it waits for one, see exportVideo)
let buildingSince = 0;
async function buildShot(idx) {
  const s = SHOTS[idx];
  if (cur && cur.idx === idx && cur.ss === ssNow) return cur;
  if (cur) { try { cur.stage.dispose(); } catch (e) { logError('warn', 'dispose: ' + e.message); } cur = null; }
  window.__filmCuts = [];
  const t0 = performance.now(); buildingSince = Date.now(); window.__czBuilding = true;
  try {
  loadStep(`shot ${s.id}: stage`);
  const stage = await E.createStage({ width: FW, height: FH, ss: ssNow });
  try {
    loadStep(`shot ${s.id}: module`);
    const mod = await import(`../${s.file.replace(/^\.?\//, '')}?v=${STAMP}`);
    if (typeof mod.default !== 'function') throw new Error(`${s.file} has no default export (a shot module is: export default async function (stage, args) { ... })`);
    loadStep(`shot ${s.id}: build`);
    const shot = await mod.default(stage, { t0: s.t0, t1: s.t1, ...(s.args || {}) });
    if (!shot || typeof shot.update !== 'function') throw new Error(`${s.file} returned no { update(t) } (end the shot with return F.done())`);
    loadStep(`shot ${s.id}: warm`);
    await stage.warm();
    loadStep(`shot ${s.id}: built`);
    cur = { idx, stage, shot, ss: ssNow, cuts: (window.__filmCuts || []).slice(), ms: Math.round(performance.now() - t0) };
    shotErrors.delete(s.id);
    return cur;
  } catch (e) {
    try { stage.dispose(); } catch { /* best effort */ }
    // (a loader that failed hands back the browser's error Event, not an Error: say which file did not load)
    const ev = e && typeof e === 'object' && 'type' in e && 'target' in e && !e.message;
    const msg = ev ? `a file did not load (${e.target?.currentSrc || e.target?.src || e.target?.responseURL || e.type})` : String(e?.message || e).split('\n')[0];
    shotErrors.set(s.id, msg); logError('error', `shot ${s.id} did not build: ${msg}`);
    throw new Error(`shot ${s.id} did not build: ${msg}`);
  }
  } finally { buildingSince = 0; window.__czBuilding = false; }
}
function ensureShot(idx) {
  if (cur && cur.idx === idx && cur.ss === ssNow) return Promise.resolve(cur);
  const p = (building || Promise.resolve()).catch(() => {}).then(() => buildShot(idx));
  building = p.finally(() => { if (building === q) building = null; }); const q = building;
  return p;
}
/** the stage's picture at film time tt (the shot under it, built if needed), captions not drawn */
async function renderAt(tt) {
  tt = Math.max(0, Math.min(END - 1e-4, tt));
  const c = await ensureShot(shotIndexAt(tt));
  c.shot.update(tt); c.stage.render(tt);
  return c.stage.renderer.domElement;
}

// ---------- drawing (frames are async: draws are queued, the newest time wins) ----------
let busy = null, want = null;
function draw(time) {
  t = Math.max(0, Math.min(END, +time || 0));
  if (!SHOTS.length) return Promise.resolve();
  want = t;
  if (busy) return busy;
  busy = (async () => {
    while (want != null) { const tt = want; want = null;
      const idx = shotIndexAt(tt);
      if (!(cur && cur.idx === idx) && !RENDER) card([`Building shot ${SHOTS[idx].id}…`, wordsIn(SHOTS[idx].t0, SHOTS[idx].t1) || ' ']);
      try { const src = await renderAt(tt); outG.drawImage(src, 0, 0, FW, FH); drawCaption(outG, tt); }
      catch (e) { logError('error', whereAt(tt) + (e?.message || e)); card([`Shot ${SHOTS[idx].id} did not draw`, String(e?.message || e).slice(0, 300)], '#ff8a80'); } }
    busy = null;
  })();
  return busy;
}
/** one finished frame for a render worker: `sub` renders over the open shutter averaged (motion blur), never across a hard cut or into
 *  the next shot; then the caption. Returns the canvas to capture. */
const acc = document.createElement('canvas'); acc.width = FW; acc.height = FH;
const accG = acc.getContext('2d');
async function frameAt(tt, sub = 1, shutter = 0) {
  tt = Math.max(0, Math.min(END - 1e-4, tt));
  const s = SHOTS[shotIndexAt(tt)];
  if (sub <= 1 || shutter <= 0) { accG.globalAlpha = 1; accG.drawImage(await renderAt(tt), 0, 0, FW, FH); }
  else {
    const c = await ensureShot(shotIndexAt(tt)), cuts = c.cuts || [];
    for (let k = 0; k < sub; k++) {
      let tk = tt + shutter * k / sub;
      for (const x of cuts) if (tt < x - 1e-6 && tk >= x) tk = x - 1e-4;
      if (tk >= s.t1) tk = s.t1 - 1e-4;
      const src = await renderAt(tk);
      accG.globalAlpha = 1 / (k + 1); accG.drawImage(src, 0, 0, FW, FH);
    }
    accG.globalAlpha = 1;
  }
  drawCaption(accG, tt);
  return acc;
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
async function pick(nx, ny, time) {
  await draw(time !== undefined ? time : t);
  const sh = shotsOf()[shotIndexAt(t)] || null;
  return { kind: 'shot', time: t, shot: sh ? { index: sh.index, t0: sh.t0, t1: sh.t1, file: sh.file, line: sh.line, name: sh.name } : null };
}
function info() {
  return { end: END, title: P?.title, settings: P?.settings || {}, art: [FW, FH], size: [FW, FH], kind: 'robloxcx', errors: errors.slice(-50), cues: [],
    preview: { asked: 1, scale: SS, scalable: false, drawn: [out.width, out.height] }, graphics: {}, gpu: null, shots: shotsOf(), placeholder,
    film: FILMJ ? { shots: SHOTS.length, fps: FILMJ.fps || 60, W: FW, H: FH, shotErrors: [...shotErrors].map(([id, message]) => ({ id, message })), captions: CAPS.length, library: !!E } : null };
}

// ---------- boot ----------
async function loadWords() {
  for (const f of ['../audio/timeline.json', '../audio/clean.json', '../audio/voice.json']) {
    try {
      const r = await fetch(f, { cache: 'no-store' }); if (!r.ok) continue;
      // (timeline.json: [{ s, e, text, words: [{ w, s, e }] }] segments; clean.json / voice.json: { words: [{ word, start, end }] })
      const j = await r.json(), w = Array.isArray(j?.words) ? j.words : Array.isArray(j) ? (j.some(x => Array.isArray(x?.words)) ? j.flatMap(x => x?.words || []) : j) : [];
      const list = w.map(x => ({ word: String(x.word ?? x.text ?? x.w ?? ''), start: +(x.start ?? x.s ?? x.t0 ?? NaN), end: +(x.end ?? x.e ?? x.t1 ?? NaN) })).filter(x => x.word && Number.isFinite(x.start));
      if (list.length) return list;
    } catch { /* no words: no captions */ }
  }
  return [];
}
const NO_LIB = 'The Roblox library is not on this computer yet. Press Build on the Scenes row, then Get it in its panel (a one-time download).';
async function boot() {
  P = await (await fetch('../project.json', { cache: 'no-store' })).json();
  // a render worker's own settings (?settings=, render.ts): a vertical export with Captions unticked renders without the film's
  // captions (it never reached this page: they stayed in, under or over the ones the export burns in)
  try { const over = qs.get('settings') ? JSON.parse(qs.get('settings')) : null; if (over && typeof over === 'object') P = { ...P, settings: { ...(P.settings || {}), ...over } }; }
  catch { logError('warn', 'bad settings override'); }
  const has = await fetch('../film.json', { method: 'HEAD', cache: 'no-store' }).then(r => r.ok, () => false);
  if (!has) { placeholder = true; END = +P.end > 0 ? +P.end : 0;
    card(END > 0 ? ['No film yet', 'Press Build: it makes the film here from your voiceover: the storyboard, the world, the cast, the crowds and every shot.']
      : ['No film yet', 'Add the voiceover first. Then Build makes the film here from it.']);
    return { shotErrors: [] }; }
  try { FILMJ = await (await fetch('../film.json', { cache: 'no-store' })).json(); } catch (e) { throw new Error(`film.json is not valid JSON: ${e.message}`); }
  loadStep('words');
  WORDS = await loadWords();
  const list = (Array.isArray(FILMJ.shots) ? FILMJ.shots : []).filter(s => s && typeof s.file === 'string' && Number.isFinite(+s.t0)).map(s => ({ ...s, id: String(s.id || s.file.replace(/.*\/|\.js$/g, '')), t0: +s.t0 })).sort((a, b) => a.t0 - b.t0);
  const lastWord = WORDS.length ? Math.max(...WORDS.map(w => Number.isFinite(w.end) ? w.end : w.start + .4)) + .3 : 0;
  END = +FILMJ.end > 0 ? +FILMJ.end : +P.end > 0 ? +P.end : lastWord;
  SHOTS = list.map((s, i) => ({ ...s, t1: i + 1 < list.length ? list[i + 1].t0 : END })).filter(s => s.t1 > s.t0);
  CAPS = captionWords(WORDS, FILMJ.captions || {});
  if (!SHOTS.length) { placeholder = true; card(['The film has no shots yet', 'film.json lists no shot modules.']); return { shotErrors: [] }; }
  const libOk = await fetch('../__cxlib/CXLIB.json', { cache: 'no-store' }).then(r => r.ok, () => false);
  if (!libOk) throw new Error(NO_LIB);
  loadStep('engine');
  // the caption font: the project's own Poppins Bold under a name of ours (fonts.check() says true for a family that has no face
  // at all, so the font is always loaded and added here, before the first caption is measured)
  try { const f = new FontFace('CzCaption', 'url(../font/Poppins-Bold.ttf)', { weight: '700' }); await f.load(); document.fonts.add(f); capFamily = 'CzCaption'; }
  catch (e) { logError('warn', 'caption font: ' + (e?.message || e)); }
  E = await import('../engine/stage.js');
  if (typeof E.createStage !== 'function') throw new Error("this project's engine/stage.js is not the Complex engine");
  window.E = E;
  loadStep('first shot');
  return { shotErrors: [] };
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
    else if (m.type === 'pick') parentPost({ type: 'picked', id: m.id, result: SHOTS.length ? await pick(m.x, m.y, m.t) : { kind: 'shot', time: t, shot: null } });
    else if (m.type === 'frame') {
      await draw(m.t ?? t); const s = m.scale || .25, c = document.createElement('canvas'); c.width = Math.round(FW * s); c.height = Math.round(FH * s);
      c.getContext('2d').drawImage(out, 0, 0, c.width, c.height); parentPost({ type: 'frame', id: m.id, dataUrl: c.toDataURL('image/jpeg', .85) });
    }
    else if (m.type === 'info') parentPost({ type: 'info', id: m.id, info: info() });
    else if (m.type === 'ping') parentPost({ type: 'pong', id: m.id, result: { t, lost: !!window.contextLost } });
    else if (m.type === 'graphics') { if (m.id) parentPost({ type: 'graphics', id: m.id, result: { t } }); }
    else if (m.type === 'bench') { const n = m.n || 8, a = performance.now(); for (let k = 0; k < n && SHOTS.length; k++) await renderAt(t); parentPost({ type: 'bench', id: m.id, result: { fps: +(n / Math.max(.001, (performance.now() - a) / 1000)).toFixed(1), t } }); }
  } catch (err) { logError('error', err.message); parentPost({ type: 'reply-error', id: m.id, message: err.message }); }
});

// ---------- render worker API (render mode) ----------
const NO_FILM = 'There is no film yet (film.json): press Build first.';
const grey = (c, w, h) => { const g = grey.c || (grey.c = document.createElement('canvas')); g.width = w; g.height = h; const x = g.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data, o = new Float32Array(w * h); for (let i = 0; i < o.length; i++) o[i] = .2126 * d[i * 4] + .7152 * d[i * 4 + 1] + .0722 * d[i * 4 + 2]; return o; };
// ---------- the quality scan: cx_check's eyes (QUALITY_STANDARD.md), what the camera sees at one film moment ----------
// From the scene itself, not from guesses: who is in the frame and how tall (px of 1440), how many separate things the lens
// sees, which share of the frame untextured primitives, people and sky take, and per big object whether it reads as one flat
// colour (its mean picture gradient). Plus the picture's light: mean luma, the dark share, the share of hot glow, saturation.
// An id pass at 216x288 (every mesh drawn in its own flat colour, effects hidden) gives the shares; the final frame at the same
// size gives the gradients and the light. Each call costs one small extra render.
const SCAN_W = 216, SCAN_H = 288;
const PRIM = new Set(['BoxGeometry', 'ConeGeometry', 'CylinderGeometry', 'SphereGeometry', 'PlaneGeometry', 'CircleGeometry', 'TorusGeometry', 'CapsuleGeometry',
  'IcosahedronGeometry', 'DodecahedronGeometry', 'OctahedronGeometry', 'TetrahedronGeometry', 'RingGeometry', 'LatheGeometry']);
// (a surface of its own counts as dressed: a texture map, a shader, or a material patched in onBeforeCompile (sand, sea, pbr);
//  whether it READS flat is the gradient rule's job)
const texOf = m => !!(m && (m.map || m.vertexColors || m.normalMap || m.roughnessMap || m.aoMap || m.isShaderMaterial || (m.userData && m.userData.uniforms)
  || (typeof m.onBeforeCompile === 'function' && /\S/.test(String(m.onBeforeCompile).replace(/^[^{]*\{/, '').replace(/\}\s*$/, '')))));
// a light source: emissive (standard materials), an HDR colour (basic materials, not tone-mapped), or a lava / fire shader by name
const emissiveOf = m => !!(m && ((m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) * (m.emissiveIntensity ?? 1) > .3) || (m.isMeshBasicMaterial && Math.max(m.color.r, m.color.g, m.color.b) > 1.001)
  || /lava|fire|glow|ember|magma/i.test(m.name || '') || (m.userData && (m.userData.lava || m.userData.glow))));
function personRoot(o) { for (let p = o; p; p = p.parent) { if (p.userData && p.userData.character) return p; if (p.name === 'mob') return p; } return null; }
function shown(o) { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true; }
function scanFrame(c, canvas) {
  const S = c.stage, THREE = S.THREE, scene = S.scene, cam = S.camera;
  scene.updateMatrixWorld(true); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const pm = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse), fr = new THREE.Frustum().setFromProjectionMatrix(pm);
  const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
  const k = FH / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));   // px per metre at 1 m depth
  const v = new THREE.Vector3(), m4 = new THREE.Matrix4(), sph = new THREE.Sphere(), box = new THREE.Box3();
  const ndcIn = p => { v.copy(p).applyMatrix4(pm); return v.z < 1 && v.z > -1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1; };
  // people: named actors (their box) and the mobs' instances (one instance per person of the first part of each archetype)
  const heights = [];
  const roots = []; scene.traverse(o => { if (o.userData && o.userData.character && shown(o)) roots.push(o); });
  const hands = [];
  for (const r of roots) { box.setFromObject(r); if (box.isEmpty()) continue; const ctr = box.getCenter(new THREE.Vector3()); if (!ndcIn(ctr)) continue;
    const d = ctr.clone().sub(cam.position).dot(fwd); if (d <= .05) continue; const h = (box.max.y - box.min.y) * k / d; heights.push(h);
    // the character's own hand report (engine/rbxchar.js handReport: hands inside the body, a held prop not in the fist), only when it is big enough to see
    // plain limbs: a real avatar's torso and arms share ONE shirt material (rbxchar.js matTop, the classic template: a T-shirt's arms
    // are skin inside that same texture), so an arm block without a texture next to a textured torso was painted over by the film
    // (firewater's builder: map = null for "one red sleeve"); a character with no real parts at all is the fallback kit body
    if (h >= 90) { const who = (r.userData.character && (r.userData.character.spec?.name || r.userData.character.name)) || r.name || 'a character', parts = {};
      r.traverse(g => { if (!/^real_/.test(g.name)) return; g.traverse(m => { if (!m.isMesh || m.name !== 'block') return; const mm = Array.isArray(m.material) ? m.material[0] : m.material; if (mm && !(g.name in parts)) parts[g.name] = !!mm.map; }); });
      const names = Object.keys(parts), torso = names.find(n => /Torso/.test(n));
      if (!names.length && r.userData.character?.spec && !r.userData.character.spec.real) hands.push({ who, issue: 'is the fallback block body, not a real avatar (plain limbs): give it a real avatar spec (F.real / kit.real.avatar)' });
      else if (torso && parts[torso]) for (const n of names) if (/Arm/.test(n) && !parts[n]) hands.push({ who, issue: `its ${n.replace(/^real_/, '')} is a flat colour block next to a textured shirt (plain limbs)` }); }
    const api = r.userData.character; if (h >= 120 && api && typeof api.handReport === 'function') { try { for (const x of api.handReport() || []) hands.push({ who: api.name || r.name || 'a character', issue: String(x.issue || x) }); } catch { /* the report is a courtesy */ } } }
  scene.traverse(g => { if (g.name !== 'mob' || !shown(g)) return; const firstOf = new Map();
    for (const im of g.children) if (im.isInstancedMesh && !firstOf.has(im.name)) firstOf.set(im.name, im);
    const H = 1.2;   // a mob person's height in metres (adults 1.285, kids about 1)
    for (const im of firstOf.values()) { const n = Math.min(im.count, 4000);
      for (let i = 0; i < n; i++) { im.getMatrixAt(i, m4); m4.premultiply(im.matrixWorld); const sc = Math.cbrt(Math.abs(m4.determinant())); if (sc < 1e-4) continue;
        const p = new THREE.Vector3().setFromMatrixPosition(m4); if (!ndcIn(p)) continue; const d = p.clone().sub(cam.position).dot(fwd); if (d <= .05) continue; heights.push(H * k / d); } } });
  heights.sort((a, b) => b - a);
  // separate things in view (people not counted): meshes whose bounds meet the frustum, instanced pieces one by one (capped)
  // (kinds = distinct meshes in view: one scatter of 30,000 flowers is many things but one kind)
  let things = 0; const kinds = new Set(), geoTri = g => g.index ? g.index.count / 3 : (g.attributes.position?.count || 0) / 3;
  scene.traverse(o => { if (!o.isMesh || !shown(o) || personRoot(o)) return; const g = o.geometry; if (!g) return; if (!g.boundingSphere) g.computeBoundingSphere(); if (!g.boundingSphere) return;
    const m0 = Array.isArray(o.material) ? o.material[0] : o.material; if (m0 && m0.transparent && m0.depthWrite === false) return;
    if (o.isInstancedMesh) { const n = o.count, step = Math.max(1, Math.floor(n / 6000)); let seen = 0;
      for (let i = 0; i < n; i += step) { o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld); sph.copy(g.boundingSphere).applyMatrix4(m4); if (sph.radius > 1e-4 && fr.intersectsSphere(sph)) seen++; }
      things += seen * step; if (seen) kinds.add(g.uuid); }
    else { sph.copy(g.boundingSphere).applyMatrix4(o.matrixWorld); if (fr.intersectsSphere(sph)) { things++; kinds.add(g.uuid); } } });
  // the id pass
  const R = S.renderer, list = [null], swaps = [], hidden = [];
  let vfxIn = 0;   // effects (particles, sprites, rain lines, soft transparent smoke) whose bounds the lens sees
  const inView = o => { const g = o.geometry; if (!g) return true; if (!g.boundingSphere) g.computeBoundingSphere(); if (!g.boundingSphere) return true;
    if (o.isInstancedMesh || o.isPoints) return true; sph.copy(g.boundingSphere).applyMatrix4(o.matrixWorld); return fr.intersectsSphere(sph); };
  scene.traverse(o => {
    if ((o.isPoints || o.isLine || o.isSprite) && o.visible) { hidden.push(o); if (shown(o) && inView(o)) vfxIn++; return; }
    if (!o.isMesh || !o.visible) return;
    const m0 = Array.isArray(o.material) ? o.material[0] : o.material; if (!m0 || m0.visible === false) return;
    if (m0.transparent && (m0.depthWrite === false || m0.blending === THREE.AdditiveBlending || (m0.opacity ?? 1) < .6)) { hidden.push(o); if (shown(o) && inView(o)) vfxIn++; return; }
    const id = list.length, person = !!personRoot(o), g = o.geometry, prim = !person && PRIM.has(g?.type) && !texOf(m0);
    let label = o.name; for (let p = o.parent; !label && p && p !== scene; p = p.parent) label = p.name;
    list.push({ o, person, prim, tex: texOf(m0), hot: emissiveOf(m0), tris: g ? Math.round(geoTri(g)) : 0, name: (label || g?.type || 'mesh').slice(0, 40), type: g?.type || '' });
    const mat = new THREE.MeshBasicMaterial({ fog: false, toneMapped: false, side: m0.side ?? THREE.FrontSide });
    mat.color.setRGB((id & 255) / 255, ((id >> 8) & 255) / 255, ((id >> 16) & 255) / 255, THREE.LinearSRGBColorSpace);
    swaps.push([o, o.material, mat]); o.material = mat;
  });
  for (const o of hidden) o.visible = false;
  // (the effects module's own scene, stage.vfx: smoke, embers, ash, rain drawn after the fog; older stages have none)
  const vfxScene = S.vfx && S.vfx.isScene ? S.vfx : null, vfxOwn = [];
  if (vfxScene) vfxScene.traverse(o => { if ((o.isMesh || o.isPoints || o.isSprite || o.isLine) && o.visible && shown(o)) { vfxOwn.push(o); if (inView(o)) vfxIn++; } });
  const rt = new THREE.WebGLRenderTarget(SCAN_W, SCAN_H), px = new Uint8Array(SCAN_W * SCAN_H * 4);
  const bg = scene.background, cc = new THREE.Color(), ca = R.getClearAlpha(), oldRT = R.getRenderTarget(), ac = R.autoClear, clip = R.clippingPlanes;
  R.getClearColor(cc);
  let vpx = null, rtBig = null, shaderPx = null; const vmats = [], shaderAir = [];
  try { scene.background = null; R.clippingPlanes = []; R.setRenderTarget(rt); R.setClearColor(0x000000, 1); R.autoClear = true; R.clear(); R.render(scene, cam); R.readRenderTargetPixels(rt, 0, 0, SCAN_W, SCAN_H, px);
    // the effects alone, in white, against the first pass's depth: how much of the frame smoke, embers, rain and dust cover
    if (hidden.length || vfxOwn.length) {
      for (const [o] of swaps) o.visible = false;
      for (const o of [...hidden, ...vfxOwn]) { const m0 = Array.isArray(o.material) ? o.material[0] : o.material, base = { color: 0xffffff, fog: false, toneMapped: false, depthWrite: false, alphaTest: .25, map: m0?.map || null };
        // (a shader effect places its own particles in its vertex shader (engine/vfx.js): it is measured with its own material below)
        if (m0 && m0.isShaderMaterial) { shaderAir.push(o); o.visible = false; continue; }
        const vm = o.isPoints ? new THREE.PointsMaterial({ ...base, size: m0?.size ?? 1, sizeAttenuation: m0?.sizeAttenuation ?? true }) : o.isSprite ? new THREE.SpriteMaterial({ ...base, rotation: m0?.rotation ?? 0 })
          : o.isLine ? new THREE.LineBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false, depthWrite: false }) : new THREE.MeshBasicMaterial({ ...base, alphaMap: m0?.alphaMap || null, side: m0?.side ?? THREE.FrontSide });
        vmats.push([o, o.material, vm]); o.material = vm; o.visible = true; }
      R.autoClear = false; R.render(scene, cam); if (vfxScene) { const vb = vfxScene.background; vfxScene.background = null; R.render(vfxScene, cam); vfxScene.background = vb; }
      vpx = new Uint8Array(SCAN_W * SCAN_H * 4); R.readRenderTargetPixels(rt, 0, 0, SCAN_W, SCAN_H, vpx);
      // the shader effects alone with their own materials, at the stage's own size (their soft-particle depth test reads the
      // frame's depth by pixel), once over black and once over white: dark smoke shows on white, glowing embers on black
      if (shaderAir.length) {
        for (const [o] of vmats) o.visible = false; for (const o of shaderAir) o.visible = true;
        const FWs = Math.round((S.width || FW) * (S.ss || 1)), FHs = Math.round((S.height || FH) * (S.ss || 1));
        rtBig = new THREE.WebGLRenderTarget(FWs, FHs); R.setRenderTarget(rtBig); R.autoClear = true;
        const sx = FWs / SCAN_W, sy = FHs / SCAN_H, grab = () => { const b = new Uint8Array(FWs * FHs * 4); R.readRenderTargetPixels(rtBig, 0, 0, FWs, FHs, b); return b; };
        const pass = col => { R.setClearColor(col, 1); R.clear(); R.render(scene, cam); if (vfxScene) R.render(vfxScene, cam); return grab(); };
        const onB = pass(0x000000), onW = pass(0xffffff);
        shaderPx = new Uint8Array(SCAN_W * SCAN_H);
        for (let y = 0; y < SCAN_H; y++) for (let x = 0; x < SCAN_W; x++) { const j = (Math.floor(y * sy) * FWs + Math.floor(x * sx)) * 4;
          if (Math.max(onB[j], onB[j + 1], onB[j + 2]) > 14 || Math.min(onW[j], onW[j + 1], onW[j + 2]) < 240) shaderPx[y * SCAN_W + x] = 1; }
      }
    } }
  finally { R.setRenderTarget(oldRT); R.setClearColor(cc, ca); R.autoClear = ac; R.clippingPlanes = clip; scene.background = bg;
    for (const [o, m0, vm] of vmats) { o.material = m0; o.visible = true; vm.dispose(); }
    for (const o of shaderAir) o.visible = true;
    for (const [o, m0, mat] of swaps) { o.material = m0; o.visible = true; mat.dispose(); } for (const o of hidden) o.visible = true; rt.dispose(); if (rtBig) rtBig.dispose(); }
  // (airAt: the effects mask per scan pixel, rows top-down like the picture; the id buffer and vpx are bottom-up)
  const airAt = new Uint8Array(SCAN_W * SCAN_H); let vfxPx = 0; if (vpx) for (let j = 0, i = 0; j < vpx.length; j += 4, i++) if ((vpx[j] === 255 && vpx[j + 1] === 255 && vpx[j + 2] === 255) || (shaderPx && shaderPx[i])) { vfxPx++; airAt[(SCAN_H - 1 - Math.floor(i / SCAN_W)) * SCAN_W + (i % SCAN_W)] = 1; }
  // the final picture at the same size: light, colour, gradients
  const g2 = grey.c2 || (grey.c2 = document.createElement('canvas')); g2.width = SCAN_W; g2.height = SCAN_H;
  const x2 = g2.getContext('2d', { willReadFrequently: true }); x2.drawImage(canvas, 0, 0, SCAN_W, SCAN_H); const d = x2.getImageData(0, 0, SCAN_W, SCAN_H).data;
  const N = SCAN_W * SCAN_H, L = new Float32Array(N), hotPx = new Uint8Array(N); let sum = 0, dark = 0, dark70 = 0, glow = 0, sat = 0; const hist = new Uint32Array(256);
  for (let i = 0; i < N; i++) { const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2], l = .2126 * r + .7152 * gg + .0722 * b; L[i] = l; sum += l; if (l < 40) dark++; if (l < 70) dark70++; hist[Math.min(255, l | 0)]++;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), s = mx ? (mx - mn) / mx : 0; sat += s * 255; if (mx > 200 && s > .43 && r >= gg && gg >= b * .9 && r > b + 60) hotPx[i] = 1; }
  const stat = new Map(); let sky = 0, skyGrad = 0, skyAir = 0, people = 0, prim = 0, gradAll = 0, nAll = 0;
  for (let y = 0; y < SCAN_H - 1; y++) for (let x = 0; x < SCAN_W - 1; x++) {
    const j = ((SCAN_H - 1 - y) * SCAN_W + x) * 4, id = px[j] | (px[j + 1] << 8) | (px[j + 2] << 16), i = y * SCAN_W + x;
    const gr = Math.abs(L[i + 1] - L[i]) + Math.abs(L[i + SCAN_W] - L[i]);
    if (!id || id >= list.length) { sky++; skyGrad += gr; if (airAt[i]) skyAir++; continue; }
    const e = list[id]; if (hotPx[i] && e.hot) glow++; if (e.person) { people++; continue; }
    gradAll += gr; nAll++;
    let s = stat.get(id); if (!s) stat.set(id, s = { n: 0, g: 0, l: 0 }); s.n++; s.g += gr; s.l += L[i];
  }
  const A = (SCAN_W - 1) * (SCAN_H - 1);
  // (a plain shape counts as a primitive only where it also reads plain: mean gradient under 16)
  for (const [id, s] of stat) if (list[id].prim && s.g / s.n < 16) prim += s.n;
  const big = [...stat.entries()].filter(([, s]) => s.n / A >= .08).sort((a, b) => b[1].n - a[1].n).slice(0, 4)
    .map(([id, s]) => ({ name: list[id].name, type: list[id].type, share: +(s.n / A).toFixed(3), grad: +(s.g / s.n).toFixed(2), luma: +(s.l / s.n).toFixed(1), tex: list[id].tex, prim: list[id].prim, tris: list[id].tris }));
  const pct = q => { let c = 0; const k = N * q / 100; for (let v = 0; v < 256; v++) { c += hist[v]; if (c >= k) return v; } return 255; };
  // fog: the scene's exponential fog or the stage's height fog (stage.atmo.fog), whichever is thicker
  const vfx = vfxIn, fog = +Math.max(scene.fog ? (scene.fog.density ?? (scene.fog.far ? 1 / scene.fog.far : 0)) : 0, +(S.atmo && S.atmo.fog) || 0).toFixed(4);
  return { people: heights.length, readable: heights.filter(h => h >= 40).length, small: heights.filter(h => h >= 15).length, top: +((heights[0] || 0).toFixed(0)),
    things, kinds: kinds.size, air: +(vfxPx / (SCAN_W * SCAN_H)).toFixed(3), sky: +(sky / A).toFixed(3), peopleShare: +(people / A).toFixed(3), prim: +(prim / A).toFixed(3), grad: +(nAll ? gradAll / nAll : 0).toFixed(2),
    luma: +(sum / N).toFixed(1), p5: pct(5), p95: pct(95), dark70: +(dark70 / N).toFixed(3), skyGrad: +(sky ? skyGrad / sky : 0).toFixed(2), skyAir: +(sky ? skyAir / sky : 0).toFixed(3), dark: +(dark / N).toFixed(3), glow: +(glow / N).toFixed(3), sat: +(sat / N).toFixed(1), vfx, fog, big, hands };
}
// ---------- the effects on screen (the lab's env/tools/vfx_check.mjs, in the page): every effect layer (objects named "vfx:<name>",
// engine/vfx.js and engine/particles.js, in stage.vfx or the scene) hidden in turn, the frame drawn again, and the pixels that change
// counted at 270x360 (a channel more than 6 / 255). A layer with instances that changes almost nothing draws nothing (wrong winding,
// zero alpha, out of frame, fogged away, behind a wall): the quality check FAILs it. One extra render per layer and moment.
const VFX_W = 270, VFX_H = 360;
function vfxPixels(c) { const g2 = vfxPixels.c || (vfxPixels.c = document.createElement('canvas')); g2.width = VFX_W; g2.height = VFX_H;
  const x = g2.getContext('2d', { willReadFrequently: true }); x.drawImage(c.stage.renderer.domElement, 0, 0, VFX_W, VFX_H); return x.getImageData(0, 0, VFX_W, VFX_H).data; }
function vfxLayers(c, tt) {
  const S = c.stage, groups = new Map();
  const visit = o => { if (!o.name || !/^vfx:/.test(o.name) || !o.visible) return; const n = o.name.slice(4) || '?';
    const count = o.isInstancedMesh ? o.count : (o.geometry && (o.geometry.instanceCount ?? (o.geometry.attributes?.position?.count ? 1 : 0))) || 1;
    const g = groups.get(n) || { name: n, objs: [], n: 0 }; g.objs.push(o); g.n += Number.isFinite(count) && count < 1e7 ? count : 1; groups.set(n, g); };
  S.scene.traverse(visit); if (S.vfx && S.vfx.isScene) S.vfx.traverse(visit);
  if (!groups.size) return [];
  const base = vfxPixels(c), out = [];
  try {
    for (const g of groups.values()) {
      c.shot.update(tt); for (const o of g.objs) o.visible = false;   // (hidden after the shot's own update, which may show them)
      S.render(tt);
      const d = vfxPixels(c); let px = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.max(Math.abs(d[i] - base[i]), Math.abs(d[i + 1] - base[i + 1]), Math.abs(d[i + 2] - base[i + 2])) > 6) px++;
      for (const o of g.objs) o.visible = true;
      out.push({ name: g.name, n: g.n, px, share: +(px / (VFX_W * VFX_H)).toFixed(4) });
    }
  } finally { for (const g of groups.values()) for (const o of g.objs) o.visible = true; c.shot.update(tt); S.render(tt); }
  return out;
}
window.suite = {
  info,
  async stills(times, scale = .5) {
    const res = [];
    for (const tt of times) {
      try {
        if (!SHOTS.length) { res.push(null); continue; }
        const src = await frameAt(tt);
        if (Math.abs(scale - 1) < 1e-6) res.push(src.toDataURL('image/png'));
        else { const c = document.createElement('canvas'); c.width = Math.round(FW * scale); c.height = Math.round(FH * scale); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); res.push(c.toDataURL('image/png')); }
      } catch (err) { logError('error', whereAt(tt) + (err?.message || err)); res.push(null); }
      await new Promise(r => setTimeout(r, 0));
    }
    return res;
  },
  async sweep(fps = 4) {
    const found = new Map(); let n = 0;
    if (!SHOTS.length) return { frames: 0, errors: [] };
    for (let f = 0; f <= END * fps; f++) {
      const tt = Math.min(END - 1e-4, f / fps); try { await renderAt(tt); } catch (err) { const k = shotIndexAt(tt) + '|' + err.message; if (!found.has(k)) found.set(k, { t: +tt.toFixed(3), where: whereAt(tt).replace(/: $/, ''), message: err.message }); }
      if (++n % 10 === 0) await new Promise(r => setTimeout(r, 0));
    }
    return { frames: n, errors: [...found.values()] };
  },
  // The page half of cx_check and cx_sheet, in ONE pass over the shots (or the ids asked), each built once at 1x:
  //   probe: three sample moments per shot, a frame and the frame 1/30 s later at 108x144 grey: mean luma, its spread and the mean
  //          change per second between the two (the camera or the people moving); build and frame times
  //   sheet: { per: 1-4, w: tile width } a contact sheet (6 tiles a row, the shot id, its start and its words under each), as a JPEG
  //   scan (with probe, default on): the quality scan at each sample moment (scanFrame above); hands: each named actor's own
  //          report when its character offers one (characters' handReport: hands inside the body, props not in the hand)
  async review({ ids = null, probe = true, sheet = null, size = [108, 144], scan: scanOn = true } = {}) {
    const res = [], tiles = [];
    const per = sheet ? Math.max(1, Math.min(4, Math.round(+sheet.per || 1))) : 0, tw = sheet ? Math.max(120, Math.min(360, +sheet.w || 216)) : 0, th = Math.round(tw * FH / FW);
    const tile = (src, s, tt) => { const c = document.createElement('canvas'); c.width = tw; c.height = th; const g = c.getContext('2d'); g.drawImage(src, 0, 0, tw, th); drawCaption(g, tt); tiles.push({ c, s, t: tt }); };
    ssNow = 1;
    try {
      for (let i = 0; i < SHOTS.length; i++) {
        const s = SHOTS[i]; if (ids && !ids.includes(s.id)) continue;
        const r = { id: s.id, file: s.file, t0: s.t0, t1: s.t1, error: null, buildMs: null, frameMs: null, samples: [] };
        const len = s.t1 - s.t0;
        try {
          const b = performance.now(); await ensureShot(i); r.buildMs = Math.round(performance.now() - b);
          if (probe) {
            const ts = len < .5 ? [s.t0 + len / 2] : [s.t0 + Math.min(.15, len * .2), s.t0 + len / 2, s.t1 - Math.min(.2, len * .25)];
            let fm = 0, nf = 0;
            for (const tt of ts) {
              const f0 = performance.now(); const cv = await renderAt(tt), a = grey(cv, size[0], size[1]); fm += performance.now() - f0; nf++;
              let scan = null; if (scanOn) { try { scan = scanFrame(cur, cv); } catch (e) { scan = { error: String(e?.message || e).slice(0, 200) }; }
                if (scan && !scan.error) try { scan.layers = vfxLayers(cur, tt); } catch (e) { scan.layers = [{ name: '(measure failed)', n: 0, px: -1, share: 0, error: String(e?.message || e).slice(0, 120) }]; } }
              const t2 = Math.min(s.t1 - 1e-4, tt + 1 / 30), bb = grey(await renderAt(t2), size[0], size[1]);
              let sum = 0, sq = 0, d = 0; for (let k = 0; k < a.length; k++) { sum += a[k]; sq += a[k] * a[k]; d += Math.abs(a[k] - bb[k]); }
              const mean = sum / a.length;
              r.samples.push({ t: +tt.toFixed(3), luma: +mean.toFixed(1), spread: +Math.sqrt(Math.max(0, sq / a.length - mean * mean)).toFixed(1), change: +(d / a.length * 30).toFixed(2), scan });
            }
            r.frameMs = Math.round(fm / Math.max(1, nf));
          }
          if (per) for (let k = 0; k < per; k++) { const tt = per === 1 ? s.t0 + len / 2 : s.t0 + Math.min(.1, len * .1) + (len - Math.min(.1, len * .1) * 2) * k / (per - 1); tile(await renderAt(tt), s, tt); }
        } catch (e) { r.error = String(e?.message || e).replace(/^shot \S+ did not build: /, ''); if (per) { const c = document.createElement('canvas'); c.width = tw; c.height = th; const g = c.getContext('2d'); g.fillStyle = '#5a1d1d'; g.fillRect(0, 0, tw, th); g.fillStyle = '#fff'; g.font = '600 14px "Segoe UI", Arial'; g.fillText('did not build', 8, 22); tiles.push({ c, s, t: s.t0 }); } }
        res.push(r);
        await new Promise(rr => setTimeout(rr, 0));
      }
    } finally { ssNow = SS; if (cur) { try { cur.stage.dispose(); } catch { /* best effort */ } cur = null; } }
    let sheetUrl = null;
    if (per && tiles.length) {
      const cols = Math.min(6, tiles.length), rows = Math.ceil(tiles.length / cols), lab = 34, pad = 4;
      const c = document.createElement('canvas'); c.width = cols * (tw + pad) + pad; c.height = rows * (th + lab + pad) + pad;
      const g = c.getContext('2d'); g.fillStyle = '#101114'; g.fillRect(0, 0, c.width, c.height);
      tiles.forEach((x, k) => { const cx = pad + (k % cols) * (tw + pad), cy = pad + Math.floor(k / cols) * (th + lab + pad);
        g.drawImage(x.c, cx, cy); g.fillStyle = '#e8e8e8'; g.font = '600 12px "Segoe UI", Arial, sans-serif'; g.textBaseline = 'top';
        g.fillText(`${x.s.id}  ${fmtT(x.t)}`.slice(0, 40), cx + 2, cy + th + 3);
        g.fillStyle = '#9aa0aa'; g.font = '11px "Segoe UI", Arial, sans-serif'; const w = wordsIn(x.s.t0, x.s.t1); let line = w; while (line && g.measureText(line).width > tw - 4) line = line.slice(0, -2); g.fillText(line + (line.length < w.length ? '…' : ''), cx + 2, cy + th + 18); });
      sheetUrl = c.toDataURL('image/jpeg', .86);
    }
    return { shots: res, sheet: sheetUrl, words: WORDS.map(w => +w.start.toFixed(3)), end: END, captions: CAPS.length, captionsOn: P?.settings?.captions?.on !== false, pageErrors: errors.filter(e => e.level === 'error').slice(-20).map(e => e.text) };
  },
  // the H.264 stream (out/<name>.h264 through the app's server); CZKEY lines: where each key frame starts. blur: the project's
  // settings.render.blur renders per frame over a 180 degree shutter (0 or 1 = off); swenc=1: the software encoder.
  async exportVideo({ name = 'video', fps = 60, from = 0, to, bitrate = 16e6 } = {}) {
    if (!SHOTS.length) throw new Error(NO_FILM);
    window.exporting = true;
    to = to ?? END;
    const sub = Math.max(1, Math.min(16, Math.round(+(qs.get('blur') ?? P?.settings?.render?.blur ?? 4)) || 1)), shutter = sub > 1 ? .5 / fps : 0;
    const base = location.pathname.replace(/\/robloxcx\.html$/, '');
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
    // a sign of life while a heavy shot builds mid-export (render.ts: 'PROGRESS beat' keeps the export's stall watchdog from
    // reading a slow build as a stuck encoder and starting the whole video again with a slower one). Only while a build runs,
    // and at most 15 minutes for one shot: a load that never ends still stops the export. A scene in an endless loop blocks
    // the page, so no beat comes then either.
    const beatIv = setInterval(() => { if (buildingSince && Date.now() - buildingSince < 15 * 60_000) console.log('PROGRESS beat'); }, 4000);
    try {
    for (let f = 0; f < n; f++) {
      if (err) throw err;
      const tt = from + f / fps;
      let src; try { src = await frameAt(tt, sub, shutter); } catch (e) { throw new Error(`The film throws an error at ${fmtT(tt)} (${whereAt(tt).replace(/: $/, '')}), so the video cannot be exported: ${e.message}. Ask Claude to fix it, then export again.`); }
      const vf = new VideoFrame(src, { timestamp: Math.round(f * 1e6 / fps), duration: Math.round(1e6 / fps) });
      enc.encode(vf, { keyFrame: f % (fps * 2) === 0 }); vf.close();
      while (enc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 1));
      if (f % 30 === 0) { await flush(false); console.log(`PROGRESS ${f} ${n} ${(f / Math.max((performance.now() - t0) / 1000, .001)).toFixed(1)}`); }
    }
    } finally { clearInterval(beatIv); }
    await enc.flush(); await flush(true); enc.close();
    const secs = (performance.now() - t0) / 1000;
    return { frames: n, seconds: +secs.toFixed(1), fps: +(n / secs).toFixed(1), realtime: +((to - from) / secs).toFixed(2), encIn: n, encOut, grade: null, blur: sub };
  },
  film() { return FILMJ ? JSON.parse(JSON.stringify(FILMJ)) : null; },
  captions() { return CAPS.slice(); },
  async events() {
    return { shots: shotsOf().map(s => ({ t0: +s.t0.toFixed(3), chapter: false, cut: true, mode: 0, name: s.name })), hits: [], cards: [], transitions: [], sfx: [], style: 'robloxcx' };
  },
  // check_layout's page half: a shot that did not build, a frame that throws, a frame that is one flat colour, a film where every frame is black
  async layout(times, range) {
    if (!SHOTS.length) return { times: [], issues: [{ t: 0, type: 'no film', what: 'the film', detail: window.bootError || NO_FILM }] };
    const issues = [];
    const inRange = tt => (range?.from == null || tt >= range.from) && (range?.to == null || tt <= range.to);
    let list = (times?.length ? times : SHOTS.map(s => (s.t0 + s.t1) / 2)).map(tt => +Math.max(0, Math.min(END, +tt || 0)).toFixed(3)).filter(inRange);
    if (!list.length && range) list = [+Math.max(0, Math.min(END, +(range.from ?? range.to) || 0)).toFixed(3)];
    const dark = [];
    for (const tt of list) {
      try {
        const a = grey(await renderAt(tt), 64, 85); let lo = 255, hi = 0; for (const y of a) { if (y < lo) lo = y; if (y > hi) hi = y; }
        if (hi - lo < 3) { if (hi < 12) dark.push(tt); else issues.push({ t: tt, type: 'blank', what: whereAt(tt).replace(/: $/, ''), detail: 'the whole frame is one flat colour: nothing of the shot was drawn here (the camera inside a wall, under the ground or the water?).' }); }
      } catch (err) { issues.push({ t: tt, type: 'error', what: whereAt(tt).replace(/: $/, ''), detail: String(err?.message || err) }); }
      await new Promise(r => setTimeout(r, 0));
    }
    if (list.length > 1 && dark.length === list.length) issues.push({ t: list[0], type: 'blank', what: 'the whole film', detail: `all ${list.length} checked frames are black.` });
    return { times: list, issues };
  },
  errors: () => errors.slice(),
};

// a sign of life while the page loads (the engine, the Roblox library, the first shot): the editor gives a page 25 s from its
// last message before it calls it stuck, and on a slower computer this look's first load alone takes longer than that
// (2026-11-16: four members got "did not finish loading within 25 s" on finished films). A scene in an endless loop blocks
// the page, so these stop and the editor still says so; an async load that never ends stops beating after 5 minutes.
const beatAt0 = Date.now(), beat = setInterval(() => { if (Date.now() - beatAt0 > 300000) return clearInterval(beat); parentPost({ type: 'loading', done: 0, total: 0 }); }, 1000);
boot().then(async () => {
  ready = true;
  if (SHOTS.length && E) await draw(+(qs.get('t') || 0));
  window.ready = true; clearInterval(beat);
  parentPost({ type: 'ready', info: info(), sceneErrors: [] });
}).catch(err => {
  clearInterval(beat);
  const msg = String(err?.message || err);
  logError('error', 'boot failed: ' + msg); window.bootError = msg; window.ready = true;
  card(msg === NO_LIB ? ['The Roblox library is missing', msg] : ['The film did not load', msg.slice(0, 400)], msg === NO_LIB ? '#ffd27a' : '#ff8a80');
  parentPost({ type: 'boot-error', message: window.bootError });
});
