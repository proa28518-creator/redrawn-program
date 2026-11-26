// Creatorize's preview / render host for 3D CARTOON SHORTS (NEW) (style id 'cartoon', 1080x1920, or 1920x1080 in a wide project). Served at
// /p/<projectId>/__suite/cartoon.html. The engine is the project's own engine.js copy (the charsys film engine, exported to
// templates/cartoon by charsys tools/export_suite.mjs): initFilm() resolves scenes/film.js in this page (make_film's own
// resolution, no node) and frame(t) draws any moment, pure in t, pixel for pixel what make_film renders.
// It speaks the same messages as host.js / rhost.js, so the editor (Preview.tsx: seek, playing, pick, frame, info, ping,
// graphics) and the render workers (window.suite: info, stills, sweep, exportVideo, events, errors) work unchanged.
// Preview mode draws a half-size picture at the looks' 'preview' quality (playback stays smooth); render mode (stills,
// export, Claude's frames) draws the full frame at 'full' quality with the captions burned in, as make_film does.
// The frame is the project's: project.json settings.format 'landscape' = 1920x1080, whatever size the film file says.
import './encoders.js';   // (first: the encoder count render.ts reads, and the app's own encoder on ?cpuenc=1)
const qs = new URLSearchParams(location.search);
const MODE = qs.get('mode') || 'preview';
const RENDER = MODE === 'render';
let FW = 1080, FH = 1920;
const parentPost = msg => { try { window.parent !== window && window.parent.postMessage({ source: 'cz-host', ...msg }, '*'); } catch {} };
const errors = [];
const logError = (level, text) => { errors.push({ level, text: String(text), at: Date.now() }); if (errors.length > 200) errors.shift(); if (MODE === 'preview') parentPost({ type: 'log', level, text: String(text) }); else console.log(`[${level}] ${text}`); };
window.addEventListener('error', e => logError('error', e.message || String(e.error)));
window.addEventListener('unhandledrejection', e => logError('error', String(e.reason?.message || e.reason)));
window.__czWarn = text => logError('warn', text);
document.addEventListener('securitypolicyviolation', e => logError('error', `Blocked by the app's security policy: ${e.effectiveDirective || e.violatedDirective} ${String(e.blockedURI || 'inline').slice(0, 160)}`));

const FILM = 'scenes/film.js';
let E = null, F = null, P = null, END = 0, t = 0, srcLines = [], placeholder = false;
const out = document.getElementById('out'), outG = out.getContext('2d');
const gl = document.createElement('canvas');                       // the engine's WebGL canvas (not shown: frames are copied onto `out`)
gl.addEventListener('webglcontextlost', () => { window.contextLost = true; logError('error', 'The graphics card reset (WebGL context lost).'); });

// ---------- shots: the resolved film's shots, named by the words spoken in them, line = where their t0 is written ----------
const words = () => F?.info?.words || [];
const wordsIn = (t0, t1) => { const w = words().filter(x => x.start >= t0 - .05 && x.start < t1 - .05).map(x => x.word).join(' ').trim(); return w.length > 42 ? w.slice(0, 40).replace(/\s+\S*$/, '') + '…' : w; };
const lineOf = (t0, i) => { const rx = new RegExp(`\\bt0\\s*:\\s*${String(+t0.toFixed(3)).replace('.', '\\.')}\\b`); for (let k = 0; k < srcLines.length; k++) if (rx.test(srcLines[k])) return k + 1; return i === 0 ? 1 : 0; };
function shotsOf() {
  const S = F?.info?.shots || [];
  return S.map((s, i) => { const t1 = s.t1 ?? (i + 1 < S.length ? S[i + 1].t0 : END);
    return { index: i, t0: s.t0, t1, file: FILM, line: lineOf(s.t0, i) || 1, name: wordsIn(s.t0, t1) || `Shot ${i + 1}${s.move && s.move !== 'park' ? ` (${s.move})` : ''}`,
      chapter: null, chapterFirst: false, cut: true, trans: null }; });
}
const shotIndexAt = time => { const S = F?.info?.shots || []; let k = 0; for (let i = 0; i < S.length; i++) if (S[i].t0 <= time + 1e-6) k = i; return k; };
const fmtT = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const whereAt = time => `shot ${shotIndexAt(time) + 1} at ${time.toFixed(2)}s: `;

// ---------- the plain picture when there is no film yet, or it does not load ----------
function card(lines, color = '#e8e8e8') {
  const wide = FW > FH, cx = wide ? 480 : 270, cy = wide ? 200 : 430, tw = wide ? 800 : 460;
  out.width = wide ? 960 : 540; out.height = wide ? 540 : 960; outG.fillStyle = '#16181d'; outG.fillRect(0, 0, out.width, out.height);
  outG.textAlign = 'center'; outG.textBaseline = 'middle';
  lines.forEach((l, i) => { outG.fillStyle = i ? '#9aa0aa' : color; outG.font = `${i ? 500 : 700} ${i ? 22 : 30}px "Segoe UI", Arial, sans-serif`;
    wrap(l, tw).forEach((w, k, a) => outG.fillText(w, cx, cy + i * 70 + (k - (a.length - 1) / 2) * 30)); });
}
function wrap(s, max) { const ws = String(s).split(/\s+/), out2 = []; let cur = ''; outG.save(); for (const w of ws) { const n = cur ? cur + ' ' + w : w; if (outG.measureText(n).width > max && cur) { out2.push(cur); cur = w; } else cur = n; } if (cur) out2.push(cur); outG.restore(); return out2.slice(0, 6); }

// ---------- Roblox story shorts, look Lightweight (style robloxlw: a charsys film with an `rbx` block, lib/rbx/filmkit.js) ----------
// The V4 films' finish, drawn here so the preview and the export are the same picture (docs/LIGHTWEIGHT_PORT.md): the export averages
// two sub-frames per frame (t and t + post.blur: the motion blur), every frame gets the V4 grade (ffmpeg's eq, engine/rbx/post.js),
// then the captions in the V4 look (Nunito 900, 2-4 words, one CAPS word, engine/rbx/captions.js). A film without `rbx` is untouched.
let RBX = null, RBXP = null, RBXC = null;
const rw = document.createElement('canvas'), rwG = rw.getContext('2d', { willReadFrequently: true });
async function rbxBoot(settings) {
  let C, Pm; try { C = await import('../engine/rbx/captions.js'); Pm = await import('../engine/rbx/post.js'); }
  catch (e) { logError('warn', `the Roblox captions and post could not load (an older engine copy: Update engine): ${e.message}`); RBX = null; return; }
  RBXP = Pm.postOf(RBX); RBXP.tables = Pm.gradeTables(RBXP.grade); RBXP.apply = Pm.gradePixels;
  if (settings.captions?.on !== false && RBX.captions) {
    try { const ff = new FontFace('CZ Nunito', `url(${C.fontUrl()})`, { weight: '900' }); document.fonts.add(ff); await ff.load(); } catch { logError('warn', 'the caption font (Nunito 900) did not load'); }
    const adv = await C.loadWidths().catch(() => null);
    RBXC = { C, adv, o: RBX.captions, caps: C.captionCards(F.info.words || [], RBX.captions) };
  }
}
/** the finished picture of a Lightweight frame: the engine's canvas (and a second sub-frame averaged in), graded, captioned */
function rbxFinish(tt, c, o = {}) {
  if (rw.width !== c.width || rw.height !== c.height) { rw.width = c.width; rw.height = c.height; }
  if (!o.keep) { rwG.globalAlpha = 1; rwG.drawImage(c, 0, 0); }
  if (RBXP?.tables && o.grade !== false) { const im = rwG.getImageData(0, 0, rw.width, rw.height); RBXP.apply(im.data, RBXP.tables); rwG.putImageData(im, 0, 0); }
  if (RBXC && o.caption !== false) RBXC.C.drawCaption(rwG, RBXC.caps, tt, RBXC.o, rw.width, rw.height, RBXC.adv, '"CZ Nunito", Nunito, sans-serif');
  return rw;
}
/** an export frame: sub-frames t and t + blur averaged (8-bit, as the V4 post's tmix), then graded and captioned */
async function rbxExportFrame(tt) {
  const a = await F.frame(tt);
  if (!RBXP?.blur) return rbxFinish(tt, a.canvas);
  if (rw.width !== a.canvas.width || rw.height !== a.canvas.height) { rw.width = a.canvas.width; rw.height = a.canvas.height; }
  rwG.globalAlpha = 1; rwG.drawImage(a.canvas, 0, 0);
  const b = await F.frame(Math.min(END, tt + RBXP.blur));
  rwG.globalAlpha = .5; rwG.drawImage(b.canvas, 0, 0); rwG.globalAlpha = 1;
  return rbxFinish(tt, rw, { keep: true });
}

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
      try { const r = await F.frame(tt); blit(RBX ? rbxFinish(tt, r.canvas) : r.canvas); } catch (e) { logError('error', whereAt(tt) + (e?.message || e)); } }
    busy = null;
  })();
  return busy;
}
/** one frame for a render worker (never queued, never coalesced): the canvas to capture */
async function frameAt(tt) { tt = Math.max(0, Math.min(END, tt)); if (RBX) return rbxFinish(tt, (await F.frame(tt)).canvas); const r = await F.frame(tt); return r.canvas; }

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

// ---------- picking: what is under the click (a character, a prop, a set part) ----------
async function pick(nx, ny, time) {
  await draw(time !== undefined ? time : t);
  const i = shotIndexAt(t), sh = shotsOf()[i] || null;
  const shot = sh ? { index: sh.index, t0: sh.t0, t1: sh.t1, file: sh.file, line: sh.line, name: sh.name } : null;
  try {
    const T = E.THREE, st = F.stage, cam = st.camera, scene = st.scene;
    const rc = new T.Raycaster(); rc.setFromCamera(new T.Vector2(nx * 2 - 1, -(ny * 2 - 1)), cam);
    const visible = o => { while (o) { if (!o.visible) return false; o = o.parent; } return true; };
    const hit = rc.intersectObjects(scene.children, true).find(h => h.object.isMesh && visible(h.object));
    if (!hit) return { kind: 'shot', time: t, shot };
    let kind = 'object', name = hit.object.name || null, root = hit.object;
    const chars = (st.chars || []).map(c => ({ id: c.id, root: c.ch?.root || c.ch?.group || c.root || c.ch }));
    const ch = chars.find(c => { for (let o = hit.object; o; o = o.parent) if (o === c.root) return true; return false; });
    if (ch) { kind = 'character'; name = ch.id; root = ch.root; }
    else for (let o = hit.object; o && !o.isScene; o = o.parent) { if (o.userData?.prop || o.userData?.kind) { kind = o.userData.prop ? 'prop' : String(o.userData.kind); name = String(o.userData.prop || o.name || o.userData.kind); root = o; break; } if (!name && o.name) name = o.name; }
    const box = new T.Box3().setFromObject(root), size = box.getSize(new T.Vector3()).toArray().map(v => +v.toFixed(2));
    const pts = []; for (let k = 0; k < 8; k++) pts.push(new T.Vector3(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(cam));
    const xs = pts.map(p => (p.x + 1) / 2), ys = pts.map(p => (1 - p.y) / 2), x0 = Math.max(0, Math.min(...xs)), y0 = Math.max(0, Math.min(...ys));
    const rect = { x: x0, y: y0, w: Math.min(1, Math.max(...xs)) - x0, h: Math.min(1, Math.max(...ys)) - y0 };
    return { kind: 'object', time: t, shot, element: { key: kind === 'character' ? name : null, kind, name, point: hit.point.toArray().map(v => +v.toFixed(2)), size, ramp: null }, rect };
  } catch (e) { return { kind: 'shot', time: t, shot }; }
}

function info() {
  const fi = F?.info;
  return { end: END, title: P?.title, settings: P?.settings || {}, art: [FW, FH], size: [FW, FH], kind: 'cartoon', rbx: RBX ? { captions: RBXC ? RBXC.caps.length : 0, blur: RBXP?.blur || 0, grade: RBXP?.grade || null } : null, errors: errors.slice(-50), cues: [],
    preview: { asked: 1, scale: RENDER ? 1 : .5, scalable: false, drawn: [out.width, out.height] }, graphics: {}, gpu: null, shots: shotsOf(),
    placeholder, voice: fi?.voice || null,
    film: fi ? { name: fi.name, dur: fi.dur, N: fi.N, fps: fi.fps, W: fi.W, H: fi.H, look: fi.look, gradedInFrames: fi.gradedInFrames, grade: fi.grade, gl: fi.gl, msaa: fi.msaa, chars: fi.chars, lines: (fi.lines || []).length, words: (fi.words || []).length } : null };
}

// ---------- Japanese, Korean and Chinese captions: the pieces of the bundled Noto Sans fonts (fonts/script, the ones host.js uses) that the
// film's words need, under "CZ Script" (the engine's caption stack names it first for those letters). Kana from the Japanese font, Hangul
// from the Korean one, Chinese characters in the shapes of the project's language. Loaded before the first frame; tests read __CZ_SCRIPT_FONTS.
const SCRIPT_FONTS = globalThis.__CZ_SCRIPT_FONTS = { faces: 0, pieces: 0, fonts: [] };
const cjkKind = c => c >= 0x1100 && c <= 0x11ff || c >= 0x3130 && c <= 0x318f || c >= 0xa960 && c <= 0xa97f || c >= 0xac00 && c <= 0xd7ff ? 'hangul'
  : c >= 0x3040 && c <= 0x30ff || c >= 0x31f0 && c <= 0x31ff ? 'kana' : c >= 0x2e80 && c <= 0x9fff || c >= 0xf900 && c <= 0xfaff || c >= 0xff00 && c <= 0xffef ? 'han' : null;
async function cjkFonts(text, lang) {
  const cps = new Set(); for (const ch of text) { const c = ch.codePointAt(0); if (c >= 0x1100 && cjkKind(c)) cps.add(c); }
  if (!cps.size) return;
  let man; try { man = await (await fetch('fonts/script/scripts.json')).json(); } catch { return; }
  const has = k => [...cps].some(c => cjkKind(c) === k);
  const hanBy = lang === 'ja' ? 'jp' : lang === 'ko' ? 'kr' : lang === 'zh' ? 'sc' : has('kana') ? 'jp' : has('hangul') && !has('han') ? 'kr' : 'sc';
  const by = { hangul: 'kr', kana: 'jp', han: hanBy }, want = new Map();
  for (const c of cps) { const id = by[cjkKind(c)]; if (!want.has(id)) want.set(id, []); want.get(id).push(c); }
  const faces = [];
  for (const id of [...want.keys()].sort((a, b) => (a === hanBy) - (b === hanBy))) {   // the Chinese characters' font last: it wins where pieces overlap
    const font = man.fonts.find(f => f.id === id); if (!font) continue;
    const need = new Set();
    font.slices.forEach((s, i) => { if (want.get(id).some(c => s.cps.some(([a, b]) => c >= a && c <= b))) need.add(i); });
    for (const i of need) {
      const s = font.slices[i], range = s.cps.map(([a, b]) => a === b ? `U+${a.toString(16)}` : `U+${a.toString(16)}-${b.toString(16)}`).join(',');
      faces.push(new FontFace('CZ Script', `url(fonts/${s.file})`, { weight: '100 900', unicodeRange: range })); SCRIPT_FONTS.pieces++;
    }
    SCRIPT_FONTS.fonts.push(font.family);
  }
  for (const f of faces) document.fonts.add(f);
  await Promise.all(faces.map(f => f.load().catch(() => { document.fonts.delete(f); logError('warn', `font failed ${f.family}`); })));
  SCRIPT_FONTS.faces = faces.length;
}

// ---------- boot ----------
async function boot() {
  P = await (await fetch('../project.json', { cache: 'no-store' })).json();
  let over = null; try { over = qs.get('settings') ? JSON.parse(qs.get('settings')) : null; } catch {}
  const settings = { ...(P.settings || {}), ...(over || {}) };
  const frameW = settings.format === 'landscape' ? 1920 : 1080, frameH = settings.format === 'landscape' ? 1080 : 1920;   // the project's frame
  FW = frameW; FH = frameH;
  // a new project before Build has no film yet: a plain card, never an error
  const has = await fetch('../' + FILM, { method: 'HEAD', cache: 'no-store' }).then(r => r.ok, () => false);
  if (!has) { placeholder = true; END = +P.end > 0 ? +P.end : 0; card(['No film yet', 'Press Build and Claude makes the film here: the characters, the acting, the camera and the set.']); return { sceneErrors: [] }; }
  try { srcLines = (await (await fetch('../' + FILM, { cache: 'no-store' })).text()).split(/\r?\n/); } catch {}
  E = await import('../engine.js');
  if (E.ENGINE_KIND !== 'cartoon') throw new Error(`this project's engine.js is not the 3D Cartoon Shorts engine (${E.ENGINE_KIND || 'unknown'})`);
  // lang: the project's language; the engine's captions draw Vietnamese, Russian, Thai and Hindi in its own bundled fonts (lib/fonts),
  // Japanese, Korean and Chinese in "CZ Script" (the Noto pieces below). An older engine copy ignores it.
  F = await E.initFilm({ projectBase: new URL('../', location.href).href, film: FILM, quality: RENDER ? 'full' : 'preview', size: [frameW, frameH], width: RENDER ? frameW : frameW / 2,
    canvas: gl, captions: settings.captions?.on !== false, lang: P.language || null, log: (...a) => console.log(...a) });
  await cjkFonts([...(F.info.lines || []).map(l => l.text || ''), ...(F.info.words || []).map(w => w.word || '')].join(' '), P.language);
  FW = F.info.W && RENDER ? F.info.W : frameW; FH = F.info.H && RENDER ? F.info.H : frameH;
  END = F.info.dur;
  // (Roblox Lightweight: the film's own rbx block, which the resolution leaves out; the film module is already loaded, so this is cheap)
  try { const raw = E.loadFilm ? await E.loadFilm(new URL('../' + FILM, location.href).href) : null; RBX = raw?.rbx && typeof raw.rbx === 'object' ? raw.rbx : null; } catch { RBX = null; }
  if (RBX) await rbxBoot(settings);
  window.F = F; window.E = E;
  return { sceneErrors: [] };
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
const NO_FILM = 'There is no film yet (scenes/film.js): press Build first.';
window.suite = {
  info,
  // o.captions === false: the frames without the burned-in captions (film_check calm / flicker measure the picture, not the words)
  async stills(times, scale = .5, o = {}) {
    const res = [];
    for (const tt of times) {
      try {
        if (!F) { res.push(null); continue; }
        const src = o?.captions === false ? (RBX ? rbxFinish(tt, (await F.frame(Math.max(0, Math.min(END, tt)))).canvas, { caption: false }) : (await F.frame(Math.max(0, Math.min(END, tt)), { caption: undefined })).canvas) : await frameAt(tt);
        if (Math.abs(scale - 1) < 1e-6 && src.width === FW && src.height === FH) res.push(src.toDataURL('image/png'));
        else { const c = document.createElement('canvas'); c.width = Math.round(FW * scale); c.height = Math.round(FH * scale); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); res.push(c.toDataURL('image/png')); }
      } catch (err) { logError('error', whereAt(tt) + (err?.message || err)); res.push(null); }
      await new Promise(r => setTimeout(r, 0));
    }
    return res;
  },
  async sweep(fps = 10) {
    const found = new Map(); let n = 0;
    if (!F) return { frames: 0, errors: [] };
    for (let f = 0; f <= END * fps; f++) {
      const tt = f / fps; try { await F.frame(tt); } catch (err) { const k = shotIndexAt(tt) + '|' + err.message; if (!found.has(k)) found.set(k, { t: +tt.toFixed(3), where: whereAt(tt).replace(/: $/, ''), message: err.message }); }
      if (++n % 20 === 0) await new Promise(r => setTimeout(r, 0));
    }
    return { frames: n, errors: [...found.values()] };
  },
  // the H.264 stream (out/<name>.h264 through the app's server). The frames are the full frame at 'full' quality with the
  // captions burned in; the film's grade: in the frames when its look pipeline drew them (gradedInFrames), else handed back
  // (`grade`) for the app to apply in ffmpeg, as charsys tools/film_encode.mjs does. CZKEY lines: where each key frame starts
  // in the file (render.ts goes on from there after a stop); swenc=1: the software encoder.
  async exportVideo({ name = 'video', fps = 30, from = 0, to, bitrate = 16e6 } = {}) {
    if (!F) throw new Error(NO_FILM);
    window.exporting = true;
    to = to ?? END;
    const base = location.pathname.replace(/\/cartoon\.html$/, '');
    const chunks = []; let bytes = 0, total = 0, first = true, err = null, encOut = 0;
    let colorSpace = null;   // (the matrix the encoder turned the RGB frames into YUV with: Roblox Lightweight's export tags the stream with it)
    const enc = new VideoEncoder({ output: (c, meta) => { const b = new Uint8Array(c.byteLength); c.copyTo(b); if (meta?.decoderConfig?.colorSpace) colorSpace = { ...meta.decoderConfig.colorSpace };
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
      let src; try { src = RBX ? await rbxExportFrame(Math.max(0, Math.min(END, tt))) : await frameAt(tt); } catch (e) { throw new Error(`The film throws an error at ${fmtT(tt)} (${whereAt(tt).replace(/: $/, '')}), so the video cannot be exported: ${e.message}. Ask Claude to fix it, then export again.`); }
      const vf = new VideoFrame(src, { timestamp: Math.round(f * 1e6 / fps), duration: Math.round(1e6 / fps) });
      enc.encode(vf, { keyFrame: f % (fps * 2) === 0 }); vf.close();
      while (enc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 1));
      if (f % 30 === 0) { await flush(false); console.log(`PROGRESS ${f} ${n} ${(f / Math.max((performance.now() - t0) / 1000, .001)).toFixed(1)}`); }
    }
    await enc.flush(); await flush(true); enc.close();
    const secs = (performance.now() - t0) / 1000;
    return { frames: n, seconds: +secs.toFixed(1), fps: +(n / secs).toFixed(1), realtime: +((to - from) / secs).toFixed(2), encIn: n, encOut,
      grade: RBX || F.info.gradedInFrames ? null : (F.info.grade || null), colorSpace, ...(RBX ? { rbx: { blur: RBXP?.blur || 0, grade: RBXP?.grade || null, captions: RBXC ? RBXC.caps.length : 0 } } : {}) };
  },
  // ---- what the cartoon suite tools read (src/main/cartoon/tools.ts: film_probe, film_check) ----
  // the resolved film (make_film's resolved.json), as plain JSON
  resolved() { return F ? JSON.parse(JSON.stringify(F.resolved)) : null; },
  // ---- Roblox Lightweight's checks (film_check coplanar / collide / zfight, src/main/cartoon/rbxcheck.ts; the lab's v4/tools) ----
  // coplanar: what the runtime safeguard (engine/rbx/safeguard.js, installed at stage init) fixed and every coplanar overlap still left,
  // after frame 0 is drawn (static props are placed then and scanned too)
  async rbxCoplanar() {
    if (!F) return null; await F.frame(0);
    return globalThis.__rbxSG ? JSON.parse(JSON.stringify(globalThis.__rbxSG.coplanar())) : { none: true };
  },
  // collide: every `step`-th frame of a..b, every rbx body part against bodies, props and the set (safeguard.js collide); rows as they
  // come (the grouping, allow-list and verdict are the app's), the heads in view per frame (zfight labels heads with them)
  async rbxCollide(a, b, step = 2, tol = .06) {
    if (!F) return null; if (!globalThis.__rbxSG) return { none: true };
    const fps = F.info.fps || 30, rows = [], views = {}; let uncovered = 0;
    for (let f = a; f <= b; f += step) {
      const r = await F.frame(f / fps);
      views[f] = (r.views || []).map(v => ({ id: v.id, cx: v.cx, cy: v.cy, d: v.d }));
      const c = globalThis.__rbxSG.collide({ tol }); uncovered = c.uncovered;
      for (const x of c.rows) rows.push({ f, ...x });
      if ((f - a) % (step * 20) === 0) await new Promise(res => setTimeout(res, 0));
    }
    return JSON.parse(JSON.stringify({ fps, rows, views, uncovered, W: FW, H: FH }));
  },
  // zfight: the V4 flicker detector (engine/rbx/zfight.js) on frames drawn here at `fps` (the sub-frame rate, never the 30 fps
  // delivery: blended frames hide a 1-frame flicker), no captions, no grade; crops = 4 frames (f-1 .. f+2) side by side per event
  async rbxZfight(t0, t1, fps = 60, th = 35, minPx = 500, top = 8) {
    if (!F) return null;
    const Z = await import('../engine/rbx/zfight.js');
    const w = Math.round(FW / 2), h = Math.round(FH / 2), sm = document.createElement('canvas'); sm.width = w; sm.height = h;
    const sg = sm.getContext('2d', { willReadFrequently: true }), det = Z.createZfight({ w, h, W: FW, H: FH, th, captionBand: [2, 2] });   // (these frames carry no captions: no caption band)
    const fa = Math.max(0, Math.round(t0 * fps)), fb = Math.min(Math.floor(END * fps), Math.round(t1 * fps));
    const draw1 = async f => { const r = await F.frame(f / fps); return r; };
    for (let f = fa; f <= fb; f++) {
      const r = await draw1(f); sg.drawImage(r.canvas, 0, 0, w, h);
      const d = sg.getImageData(0, 0, w, h).data, g = new Uint8Array(w * h);
      for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (66 * d[i] + 129 * d[i + 1] + 25 * d[i + 2] + 128 >> 8) + 16;
      const k = r.canvas.width / FW || 1;
      det.push(g, f, (r.views || []).map(v => ({ cx: v.cx / k, cy: v.cy / k, d: v.d / k })));
      if ((f - fa) % 30 === 29) await new Promise(res => setTimeout(res, 0));
    }
    const R = det.finish(), bad = R.events.filter(e => (e.label === 'scene' || e.label === 'wide') && e.n >= minPx);
    const crops = [];
    for (const e of [...bad.slice(0, top), ...R.events.filter(e => e.label === 'head' && e.n >= minPx).slice(0, 2)]) {
      const [hx, hy] = e.hot || [(e.box[0] + e.box[2]) / 2, (e.box[1] + e.box[3]) / 2];
      const bw = Math.min(480, Math.max(200, e.box[2] - e.box[0] + 80)), bh = Math.min(480, Math.max(200, e.box[3] - e.box[1] + 80));
      const x0 = Math.max(0, Math.min(FW - bw, Math.round(hx - bw / 2))), y0 = Math.max(0, Math.min(FH - bh, Math.round(hy - bh / 2)));
      const strip = document.createElement('canvas'); strip.width = bw * 4 + 12; strip.height = bh; const s2 = strip.getContext('2d'); s2.fillStyle = '#e01010'; s2.fillRect(0, 0, strip.width, bh);
      for (let k = 0; k < 4; k++) { const ff = Math.max(fa, Math.min(fb, e.f - 1 + k)), r = await draw1(ff), sc = r.canvas.width / FW || 1; s2.drawImage(r.canvas, x0 * sc, y0 * sc, bw * sc, bh * sc, k * (bw + 4), 0, bw, bh); }
      crops.push({ f: e.f, label: e.label, n: e.n, box: [x0, y0, bw, bh], png: strip.toDataURL('image/png') });
    }
    return { fps, from: fa, to: fb, frames: R.frames, th, minPx, events: R.events.slice(0, 60), crops };
  },
  // PROP GUARD over the whole film: every frame drawn once (no caption), each frame's prop track (make_film's stagePropTrack),
  // the prop ids in track order and the allowed snaps (make_film's guardSnaps; null = any size)
  async track() {
    if (!F) return null;
    const ids = F.propIds ? F.propIds() : [], snaps = F.snaps ? F.snaps() : {}, frames = {};
    if (!ids.length) return { ids, snaps, frames };
    const fps = F.info.fps || 30, N = F.info.N || Math.round(END * fps);
    for (let f = 0; f < N; f++) {
      await F.frame(f / fps, { caption: undefined }); frames[f] = F.propTrack();
      if (f % 20 === 19) await new Promise(r => setTimeout(r, 0));
    }
    return { ids, snaps, frames };
  },
  // the character shading numbers per frame (lab/shade_jumps.mjs reads the same dump): [{ f, ch: shading.dump() }]; [] when the
  // film has no character shading (its set's look / post pipeline has no shading pass)
  async shading(a = 0, b) {
    if (!F) return null;
    const fps = F.info.fps || 30, N = F.info.N || Math.round(END * fps), rows = [];
    b = Math.min(N - 1, b ?? N - 1);
    for (let f = Math.max(0, a); f <= b; f++) {
      await F.frame(f / fps, { caption: undefined });
      const L = globalThis.__czLook || globalThis.__czPost;
      if (!L?.shading) return [];
      rows.push({ f, ch: L.shading.dump() });
      if (f % 20 === 19) await new Promise(r => setTimeout(r, 0));
    }
    return rows;
  },
  // sound design: the shots (each one a cut) for audio/events.json -> the style's sound design
  async events() {
    return { shots: shotsOf().map(s => ({ t0: +s.t0.toFixed(3), chapter: false, cut: true, mode: 0, name: s.name })), hits: [], cards: [], sfx: [], style: 'cartoon' };
  },
  // check_layout (the same tool as every other engine; without this every call failed with "Script failed to execute"). This
  // engine has no layout rules of its own (framing, faces and props: film_sheet, film_probe, film_check and the eyes), so it
  // draws one steady frame of each shot (or the asked times) as the export does and lists what can't be right: a frame that
  // throws, a frame that is one flat colour, and a film where every frame is black. A black shot among others can be meant.
  async layout(times, range) {
    if (!F) return { times: [], issues: [{ t: 0, type: 'no film', what: 'the film', detail: window.bootError || NO_FILM }] };
    const inRange = tt => (range?.from == null || tt >= range.from) && (range?.to == null || tt <= range.to);
    let list = (times?.length ? times : shotsOf().map(s => (s.t0 + s.t1) / 2)).map(tt => +Math.max(0, Math.min(END, +tt || 0)).toFixed(3)).filter(inRange);
    if (!list.length && range) list = [+Math.max(0, Math.min(END, +(range.from ?? range.to) || 0)).toFixed(3)];   // a range inside one shot
    const issues = [], dark = [], c = document.createElement('canvas'); c.width = 36; c.height = 64;
    const g = c.getContext('2d', { willReadFrequently: true });
    for (const tt of list) {
      try {
        g.drawImage((await F.frame(tt, { caption: undefined })).canvas, 0, 0, c.width, c.height);
        const d = g.getImageData(0, 0, c.width, c.height).data; let lo = 255, hi = 0;
        for (let i = 0; i < d.length; i += 4) { const y = .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2]; if (y < lo) lo = y; if (y > hi) hi = y; }
        if (hi - lo < 3) { if (hi < 12) dark.push(tt); else issues.push({ t: tt, type: 'blank', what: whereAt(tt).replace(/: $/, ''), detail: 'the whole frame is one flat colour: nothing of the set or the characters was drawn here. Look at it with render_frames.' }); }
      } catch (err) { issues.push({ t: tt, type: 'error', what: whereAt(tt).replace(/: $/, ''), detail: String(err?.message || err) }); }
      await new Promise(r => setTimeout(r, 0));
    }
    if (list.length > 1 && dark.length === list.length) issues.push({ t: list[0], type: 'blank', what: 'the whole film', detail: `all ${list.length} checked frames are black: the set, the lights or the camera do not show anything.` });
    return { times: list, issues };
  },
  errors: () => errors.slice(),
};

// a sign of life while the page loads (the film, its world, the first shot): the editor gives a page 25 s from its last
// message before it calls it stuck, and a long film on a slower computer takes longer than that to load (2026-11-16: four
// members got "did not finish loading within 25 s" on finished Roblox films). A scene in an endless loop blocks the page, so
// these stop and the editor still says so; an async load that never ends stops beating after 5 minutes.
const beatAt0 = Date.now(), beat = setInterval(() => { if (Date.now() - beatAt0 > 300000) return clearInterval(beat); parentPost({ type: 'loading', done: 0, total: 0 }); }, 1000);
boot().then(async ({ sceneErrors }) => {
  ready = true;
  if (F) await draw(+(qs.get('t') || 0));
  window.ready = true; clearInterval(beat);
  parentPost({ type: 'ready', info: info(), sceneErrors });
}).catch(err => {
  clearInterval(beat);
  const msg = String(err?.message || err);
  logError('error', 'boot failed: ' + msg); window.bootError = msg; window.ready = true;
  card(['The film did not load', msg.slice(0, 400)], '#ff8a80');
  parentPost({ type: 'boot-error', message: window.bootError });
});
