// lab/stage.js: the world stage as a module (was the script of lab/stage.html, which is now a thin page over it). One stage per canvas:
//   const st = createStage({ canvas, setStyle })   st.init(scene) -> info, st.frame(t, opts) -> { png, ms, views }, st.propTrack(), st.dispose()
// lab/stage.mjs (node, puppeteer) drives it through stage.html's window.stageInit / stageFrame / stagePropTrack; the app's host page
// (templates/host/chost.js) imports it from the project's lib/stage.js. opts.canvasOut: the frame (caption burned in) comes back as a canvas.
import * as THREE from '../engine/three.js';
import { createCharacter } from '../engine/character.js';
import { evalPose, placeTimes } from '../engine/compose.js';
import * as CM from '../engine/camera_moves.js';
import { makeProp, placeProp, flat } from './film/props.js';
import { outline } from '../engine/shade.js';

// ---- caption letters of other languages (2026-11-09): the captions are Segoe UI Black / Arial Black, system fonts that have no Thai or
// Devanagari and differ per computer for Vietnamese and Cyrillic. A caption in those letters (or any caption of a film whose
// scene.lang is vi / ru / th / hi / ja / ko / zh) draws in the bundled fonts of ./fonts (Inter Black + Noto Sans, OFL; FONTS-LICENSE.txt),
// loaded once on first use; Chromium's canvas shapes Thai and Devanagari through them. Japanese, Korean and Chinese draw in "CZ Script"
// when the page provides it (the app's host page adds the Noto pieces under that name), else the system's font. Any other caption keeps
// the system stack exactly (English films stay pixel-identical).
const CAP_FILES = { 'CZ Latin': 'cz-latin.ttf', 'CZ Thai': 'cz-thai.ttf', 'CZ Devanagari': 'cz-deva.ttf' };
const RX_THAI = /[฀-๿]/, RX_DEVA = /[ऀ-ॿ꣠-ꣿ]/, RX_CJK = /[ᄀ-ᇿ぀-ヿ㄰-㆏㐀-鿿가-힯豈-﫿]/;
const RX_OWN = /[ƠơƯưẠ-ỹЀ-ӿ]/;   // Vietnamese ơ ư + stacked tone marks, Cyrillic
const RX_SPACELESS = /[฀-๿぀-ヿ㐀-鿿豈-﫿]/;   // written without spaces between words (Thai, Japanese, Chinese)
const capText = c => typeof c === 'object' && c ? String(c.text || '') : String(c || '');
/** the bundled families a caption draws in first (null = the system stack as ever) */
export function capFaces(text, lang) {
  const L = String(lang || '').toLowerCase().split(/[-_]/)[0];
  if (L === 'th' || RX_THAI.test(text)) return ['CZ Thai'];
  if (L === 'hi' || RX_DEVA.test(text)) return ['CZ Devanagari'];
  if (['ja', 'ko', 'zh'].includes(L) || RX_CJK.test(text)) return ['CZ Script', 'CZ Latin'];
  if (L === 'vi' || L === 'ru' || RX_OWN.test(text)) return ['CZ Latin'];
  return null;
}
const capLoads = new Map();
function capFontReady(fams) {
  return Promise.all(fams.filter(f => CAP_FILES[f]).map(f => {
    if (!capLoads.has(f)) capLoads.set(f, (async () => {
      try { const face = new FontFace(f, `url(${new URL('./fonts/' + CAP_FILES[f], import.meta.url).href})`, { weight: '100 900' }); await face.load(); document.fonts.add(face); }
      catch (e) { (globalThis.__czWarn || console.warn)(`caption font ${f} failed to load: ${e?.message || e}`); }
    })());
    return capLoads.get(f);
  }));
}
/** the bundled fonts a caption needs, loaded (tests: the app's asianlangs draws with them); -> the families, or null */
export async function captionFonts(text, lang) { const f = capFaces(String(text || ''), lang); if (f) await capFontReady(f); return f; }
const capStack = (fams, rest) => fams ? fams.map(f => `"${f}"`).join(', ') + ', ' + rest : rest;

export function createStage({ canvas, setStyle = true } = {}) {
  // The world stage: ground + set boxes + N characters + props + one free camera. Driven by lab/stage.mjs (stageInit(scene), stageFrame(t)).
  // World units: 1 = the head diameter D, ground y = 0, +Y up. Characters are unlit shaders; a soft blob under the feet and the body grounds them.
  // Film additions (agent F): characters[i].timeline -> engine/compose.js evalPose drives the rig; scene.shots -> engine/camera_moves.js;
  // scene.set.boxes -> flat-shaded inked boxes; scene.props -> lab/film/props.js following pose.props; opts.caption -> burned-in text.

  let W = 1080, H = 1920;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, W / H, .1, 600);
  scene.add(camera);
  let S = null, chars = [], blobs = [], props = [], shotFns = null, worldSet = null, shadows = null;
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = k => k * k * (3 - 2 * k);
  const cap2d = document.createElement('canvas');

  function blobTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(.45, 'rgba(0,0,0,.75)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  let BLOB = null;
  function blob(color, opacity) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: BLOB, color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = -1; scene.add(m); return m;
  }

  // camera at time t: { keys: [{t, pos, target, fov}] } (smoothstep between keys) or { orbit: { center, t:[t0,t1], az:[a0,a1], radius:[r0,r1], height:[h0,h1], fov } }
  function cameraAt(C, t) {
    if (C.orbit) {
      const O = C.orbit, [t0, t1] = O.t || [0, 1], k = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
      const az = lerp(O.az[0], O.az[1], k) * Math.PI / 180, r = lerp(O.radius[0], O.radius[1], (1 - Math.cos(k * Math.PI * 2)) / 2), h = lerp(O.height[0], O.height[1], (1 - Math.cos(k * Math.PI * 2)) / 2);
      const c = O.center || [0, 1.6, 0], ty = O.targetY !== undefined ? lerp(O.targetY[0], O.targetY[1], (1 - Math.cos(k * Math.PI * 2)) / 2) : c[1];
      return { pos: [c[0] + Math.sin(az) * r, h, c[2] + Math.cos(az) * r], target: [c[0], ty, c[2]], fov: O.fov || 26, roll: Array.isArray(O.roll) ? lerp(O.roll[0], O.roll[1], k) : O.roll || 0 };
    }
    const K = C.keys; if (K.length === 1 || t <= K[0].t) return K[0];
    for (let i = 0; i < K.length - 1; i++) if (t <= K[i + 1].t) {
      const k = smooth((t - K[i].t) / (K[i + 1].t - K[i].t)), a = K[i], b = K[i + 1];
      return { pos: a.pos.map((v, j) => lerp(v, b.pos[j], k)), target: a.target.map((v, j) => lerp(v, b.target[j], k)), fov: lerp(a.fov || 26, b.fov || 26, k),
        roll: lerp(a.roll || 0, b.roll || 0, k) };   // Q3: camera keys take `roll` too (Dutch tilt, degrees, + = clockwise)
    }
    return K[K.length - 1];
  }

  // ---- film shots: JSON -> camera_moves functions. A subject 'who' = that character's root (+ height) from its timeline, pure in t.
  const rootOf = (id, t) => { const c = chars.find(c => c.ch.id === id || c.def.name === id); if (!c) return [0, 0, 0];
    const p = c.def.timeline ? evalPose(c.def.timeline, t, c.ch.rest) : { root: c.def.root || {} }; return [p.root.x || 0, p.root.y || 0, p.root.z || 0]; };   // [x, height, z]: y 0 unless the film lifts him (engine/height.js)
  const facingOf = (id, t) => { const c = chars.find(c => c.ch.id === id || c.def.name === id); if (!c) return 0;
    const p = c.def.timeline ? evalPose(c.def.timeline, t, c.ch.rest) : { root: c.def.root || {} }; return p.root.ry || 0; };
  const subj = (J, dy = 0) => {
    if (J.who) return t => { const r = rootOf(J.who, t); return [r[0] + (J.offset?.[0] || 0), r[1] + dy + (J.offset?.[1] || 0), r[2] + (J.offset?.[2] || 0)]; };
    if (Array.isArray(J.whos)) return t => { const rs = J.whos.map(w => rootOf(w, t)); return [rs.reduce((s, r) => s + r[0], 0) / rs.length + (J.offset?.[0] || 0), rs.reduce((s, r) => s + r[1], 0) / rs.length + dy + (J.offset?.[1] || 0), rs.reduce((s, r) => s + r[2], 0) / rs.length + (J.offset?.[2] || 0)]; };
    return () => J.center || [0, dy, 0];
  };
  // a path key on a set object or a prop (FILM_API "move: path"): { object: name, offset, local: true } = set.points[name] (a function of t, a
  // point, or an Object3D) or scene.getObjectByName(name), read after set.update(t); { prop: id, offset } = where that prop is on this frame
  // (a first pass over the frame places it, see stageFrame). offset = world axes, local: true = the object's own axes. Pure in t.
  const _fq = new THREE.Quaternion(), _fp = new THREE.Vector3(), _fs = new THREE.Vector3();
  let PROPPOS = {};
  function followPoint(J) {
    const off = J.offset || [0, 0, 0], key = J.prop || J.object;
    if (J.prop && !props.some(p => p.def.id === J.prop)) throw new Error(`STAGE FAILED: a path key follows prop "${J.prop}", which the film does not have (props: ${props.map(p => p.def.id).join(', ') || 'none'})`);
    const P = worldSet?.points?.[key];
    if (J.object && P === undefined && !scene.getObjectByName(key)) throw new Error(`STAGE FAILED: a path key follows set object "${key}": no such name in the set's points or objects (points: ${Object.keys(worldSet?.points || {}).join(', ') || 'none'}; give the object .name = "${key}" or hand it in set.points)`);
    return t => {
      if (J.prop) { const w = PROPPOS[key] || [0, 1.2, 0]; return [w[0] + (off[0] || 0), w[1] + (off[1] || 0), w[2] + (off[2] || 0)]; }
      const o = P === undefined ? scene.getObjectByName(key) : P;
      if (o && o.isObject3D) { o.updateWorldMatrix(true, false); o.matrixWorld.decompose(_fp, _fq, _fs); const v = new THREE.Vector3(off[0] || 0, off[1] || 0, off[2] || 0); if (J.local) v.applyQuaternion(_fq); return [_fp.x + v.x, _fp.y + v.y, _fp.z + v.z]; }
      const w = typeof o === 'function' ? o(t) : o; return [w[0] + (off[0] || 0), w[1] + (off[1] || 0), w[2] + (off[2] || 0)];
    };
  }
  const followsOf = J => J?.move !== 'path' ? [] : J.keys.flatMap(k => [k.pos, k.target]).filter(v => v && !Array.isArray(v));
  function shotFn(J, t0, t1) {
    const m = J.move || 'park';
    if (m === 'park') return CM.park(J.pos, J.target, J.fov);
    if (m === 'push') return CM.push({ from: J.from, to: J.to, t0: J.t0 ?? t0, t1: J.t1 ?? t1, ease: J.ease || 'outCubic' });
    if (m === 'orbit') return CM.orbit(subj(J, J.height ?? 1.4), { az0: J.az0, az1: J.az1, el: J.el ?? 12, dist: J.dist ?? 7, t0: J.t0 ?? t0, t1: J.t1 ?? t1, facing: J.facing ?? (J.who ? facingOf(J.who, t0) : 0), fov: J.fov ?? 26, ease: J.ease });
    if (m === 'follow') { const fc = J.who && chars.find(c => c.ch.id === J.who || c.def.name === J.who); const f = CM.follow(subj(J, 0), { offset: J.camOffset || [0, 2, 9], lag: J.lag ?? .3, fov: J.fov ?? 26, lookOffset: J.look || [0, 1.4, 0], jumps: fc?.def.timeline ? placeTimes(fc.def.timeline, fc.ch.rest) : [] });
      if (J.parkAt == null) return f; const p = f(J.parkAt); return t => t < J.parkAt ? f(t) : p; }
    if (m === 'path') { const p = (v, dy = 0) => Array.isArray(v) ? v : (v.prop || v.object) ? followPoint(v) : subj(v, dy);   // a key's pos / target: [x, y, z], { who | whos, offset } or { object | prop, offset, local }
      return CM.path(J.keys.map(k => ({ ...k, pos: p(k.pos), target: p(k.target) }))); }
    throw new Error('stage: unknown camera move ' + m);
  }

  function buildSet(set = {}) {
    for (const b of set.boxes || []) {
      const [w, h, d] = b.size, geo = b.shape === 'cyl' ? new THREE.CylinderGeometry(w / 2, w / 2, h, 20) : new THREE.BoxGeometry(w, h, d);
      const m = new THREE.Mesh(geo, flat(b.color || '#9a7b5a', b.dark));
      if (b.ink !== false) outline(m, { width: b.ink ?? .04, color: 0x3a2a33 });
      m.position.set(b.at[0], b.at[1] + (b.base === false ? 0 : h / 2), b.at[2]); if (b.ry) m.rotation.y = b.ry * Math.PI / 180;
      m.traverse(o => { o.frustumCulled = false; });
      scene.add(m);
      if (b.shadow !== false && b.at[1] < .05) { const s = blob(set.shadow || S.shadow || '#5a4a38', .35); s.position.set(b.at[0], .001, b.at[2] + .1); s.scale.set(w * 1.3, (d || w) * 1.5, 1); }
    }
    for (const s of set.stripes || []) { // flat ground paint: paths, kerbs
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s.size[0], s.size[1]), new THREE.MeshBasicMaterial({ color: s.color, polygonOffset: true, polygonOffsetFactor: -.5, polygonOffsetUnits: -1 }));
      m.rotation.x = -Math.PI / 2; m.position.set(s.at[0], .0005, s.at[1]); if (s.ry) m.rotation.z = s.ry * Math.PI / 180; m.renderOrder = -1.5; scene.add(m);
    }
  }

  const init = async (sc) => {
    S = sc; W = sc.width || 1080; H = sc.height || 1920;
    renderer.setSize(W, H, false); if (setStyle) { canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; }
    camera.aspect = W / H; camera.updateProjectionMatrix();
    scene.background = new THREE.Color(sc.sky || '#a9c9e4');
    BLOB = blobTexture();
    // a named set = the world agent's world/sets.js (+ world/shadow.js sun shadows); an object = boxes/stripes built here
    // an ad-hoc set object goes to world/sets.js buildSet too (sun shadows); if that returns null (or throws) the boxes/stripes are built here
    let named = typeof sc.set === 'string';
    // a film's own set: films/<film>/set.js (make_film passes its path in setModule; world/sets.js buildFilmSet fills what a small set leaves out)
    if (sc.setModule) worldSet = await (await import('../world/sets.js')).buildFilmSet(THREE, scene, sc.setModule, sc.setOpts || {}, new URL(sc.setModule, import.meta.url).href);
    else if (named) worldSet = (await import('../world/sets.js')).buildSet(THREE, scene, sc.set, sc.setOpts || {});
    else if (sc.set && typeof sc.set === 'object' && Object.keys(sc.set).length) {
      try { worldSet = (await import('../world/sets.js')).buildSet(THREE, scene, sc.set, { ground: sc.ground, ...(sc.setOpts || {}) }) || null; } catch (e) { worldSet = null; }
      named = !!worldSet;
    }
    // ---- BACKROOMS LIGHTING BLOCK (agent D, 2026-11-04): a set with file textures (world/backrooms.js) hands back `ready`; wait for it so
    // frame 0 already has its textures. Its panel flicker runs in set.update(t) (called below with the shadows each frame).
    if (worldSet?.ready) await worldSet.ready;
    // ---- end BACKROOMS LIGHTING BLOCK
    if (!named) {
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: sc.ground || '#c8b48c' }));
      ground.rotation.x = -Math.PI / 2; ground.renderOrder = -2; scene.add(ground);
      if (sc.grid) { const g = new THREE.GridHelper(40, 40, 0x9a8866, 0xb09c78); g.position.y = .001; scene.add(g); }
      buildSet(sc.set);
    }
    for (const c of sc.characters || []) {
      const spec = typeof c.spec === 'string' ? c.spec : { ...c.spec, id: c.spec.id || c.name };
      // Roblox V3 (2026-11-12): a spec with kind 'rbx' is the Roblox body (engine/rbx, imported only then); every other spec exactly as before
      const ch = spec.kind === 'rbx' ? await (await import('../engine/rbx/character.js')).createRbxCharacter(spec, { set: () => worldSet, poseAt: tt => poseAt(c, ch, tt) }) : await createCharacter(spec);   // WP-M: poseAt = the rbx motion filter's neighbouring frames
      scene.add(ch.root);
      chars.push({ ch, def: c });
      { const bc = sc.shadow || (named ? '#2e2a24' : '#5a4a38'), k = named ? .8 : 1;   // FIX1: soft contact blobs in EVERY film (named sets too, under their sun shadows)
        blobs.push({ feet: [blob(bc, .55 * k), blob(bc, .55 * k)], body: blob(bc, .35 * k) }); }
    }
    for (const p of sc.props || []) { const o = await makeProp(p.kind, { ...p, film: sc.film, ...(sc.propsUrl ? { propsUrl: sc.propsUrl } : {}) }); scene.add(o); props.push({ o, def: p }); } // makeProp may be async (engine/props, films/<film>/props)
    handoverInit(sc.handovers);
    if (named) shadows = (await import('../world/shadow.js')).attachShadows(THREE, scene, renderer, chars.map(c => c.ch), worldSet.lightDir, { set: worldSet, casters: props.map(p => p.o) });
    if (sc.safeguard !== false && chars.some(c => c.ch.kind === 'rbx')) await (await import('../engine/rbx/safeguard.js')).install(THREE, scene, { chars, props, camera, film: sc.film });   // Roblox V4 (V4-Z): coplanar safeguard + collision probe, rbx films only (engine/rbx/safeguard.js)
    // shot camera `roll`: Dutch tilt in degrees (+ = clockwise on screen), a number or [r0, r1] eased over the shot (Q2)
    if (sc.shots) shotFns = sc.shots.map(s => { const f = shotFn(s.camera, s.t0, s.t1), R = s.camera.roll;
      if (R == null) return { t0: s.t0, t1: s.t1, f };
      return { t0: s.t0, t1: s.t1, f: t => { const C = f(t), k = smooth(Math.min(1, Math.max(0, (t - s.t0) / Math.max(.01, (s.t1 > 90 ? s.t0 + 4 : s.t1) - s.t0))));
        return { ...C, roll: Array.isArray(R) ? lerp(R[0], R[1], k) : R }; } }; });
    if (sc.shots) sc.shots.forEach((s, i) => { const F = followsOf(s.camera); shotFns[i].uProp = F.some(v => v.prop); shotFns[i].uSet = F.some(v => v.object); });
    const gl = renderer.getContext(), info = gl.getExtension('WEBGL_debug_renderer_info');
    return { gl: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown', msaa: gl.getParameter(gl.SAMPLES), chars: chars.map(c => ({ id: c.ch.id, rest: c.ch.rest })), look: !!worldSet?.look };
  };

  // ---- hand-overs (agent Q, FILM_API.md "handovers"): { prop, from, to, t, fromSide 'L', toSide 'R', at:[x,y,z] world (default: between
  // the two, at chest height), lead .4 s (both hands travel there), hold .2 s (they meet, the prop changes owner at t), back .35 s }.
  // Both arms get pose.armX.reach = { at, w } (character.js pulls the hand to the world point by w); the prop gets a key at t. Pure in t.
  let HANDOVERS = [];
  const smooth01 = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  function handoverInit(list) {
    HANDOVERS = (list || []).map(h => {
      const H = { lead: .4, hold: .2, back: .35, fromSide: 'L', toSide: 'R', ...h };
      if (!H.at) {
        // between the two handing SHOULDERS (root + the shoulder turned by ry, the seated hip height), a little under shoulder height
        const pts = [[H.from, H.fromSide], [H.to, H.toSide]].map(([id, sd]) => { const c = chars.find(c => c.ch.id === id || c.def.name === id); const r = rootOf(id, H.t);
          if (!c) return [r[0], 1.2, r[2]];
          const P = c.def.timeline ? evalPose(c.def.timeline, H.t, c.ch.rest) : null, ry = (P?.root?.ry ?? facingOf(id, H.t)) * Math.PI / 180;
          const s = c.ch.rest['shoulder' + sd] || [0, .6, 0], hy = P?.body?.hipY ?? c.ch.rest.hipY;
          return [r[0] + Math.cos(ry) * s[0] + Math.sin(ry) * s[2], r[1] + hy + s[1] - .3, r[2] - Math.sin(ry) * s[0] + Math.cos(ry) * s[2]]; });
        H.at = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2, (pts[0][2] + pts[1][2]) / 2];
      }
      const p = props.find(p => p.def.id === H.prop);
      if (p && !(p.def.keys || []).some(k => k.t === H.t && k.owner === H.to)) { p.def.keys = [...(p.def.keys || []), { t: H.t, owner: H.to, in: 'hand:' + H.toSide, rot: H.rot ?? p.def.rot, at: H.offset }].sort((a, b) => a.t - b.t); }
      return H;
    });
  }
  function handoverReach(name, P, t) {
    for (const H of HANDOVERS) {
      const side = name === H.from ? H.fromSide : name === H.to ? H.toSide : null;
      if (!side) continue;
      const w = smooth01(H.t - H.lead, H.t, t) * (1 - smooth01(H.t + H.hold, H.t + H.hold + H.back, t));
      if (w <= 0) continue;
      const k = 'arm' + side; P[k] = { ...(P[k] || {}), reach: { at: H.at, w } };
    }
    return P;
  }

  const poseAt = (def, ch, t) => {
    if (def.timeline) {
      // walkK: how much the root is travelling (0 standing .. 1 at >= .02 D/frame), pure in t; character.js straightens + greys legs on it
      const P = evalPose(def.timeline, t, ch.rest), a = evalPose(def.timeline, Math.max(0, t - 1 / 30), ch.rest).root, b = evalPose(def.timeline, t + 1 / 30, ch.rest).root;
      const v = Math.hypot((b.x || 0) - (a.x || 0), (b.z || 0) - (a.z || 0)) / 2;
      if (P.walkK == null) P.walkK = Math.min(1, v / .02);
      return HANDOVERS.length ? handoverReach(def.name || ch.id, P, t) : P;
    }
    const p = typeof def.pose === 'function' ? def.pose(t) : JSON.parse(JSON.stringify(def.pose || {}));
    p.root = { ...(def.root || {}), ...(p.root || {}) };
    return p;
  };

  function drawCaption(text) {
    cap2d.width = W; cap2d.height = H;
    const g = cap2d.getContext('2d'); g.drawImage(renderer.domElement, 0, 0);
    if (!text) return cap2d;
    const wide = W > H;   // a 16:9 film: sized on the frame height, lower in the frame (a 9:16 film is sized on its width, as ever)
    const fams = capFaces(capText(text), S?.lang);   // (null for an English caption: the stack below unchanged)
    if (typeof text === 'object') {
      // "words" (his style): one or two big bold words, mid-lower frame, popping in (3 f overshoot, no fade), thick ink stroke
      const a = Math.max(0, text.age || 0), f = a * 30, pop = f < 1 ? .72 : f < 2 ? 1.12 : f < 3 ? 1.04 : 1;
      const stack = capStack(fams, '"Segoe UI Black", "Arial Black", "Segoe UI", Arial, sans-serif');
      let fs = Math.round(wide ? H * .085 : W * .118); g.font = `900 ${fs}px ${stack}`;
      const tw = g.measureText(text.text).width; if (tw > W * .86) { fs = Math.floor(fs * W * .86 / tw); }
      g.save(); g.translate(W / 2, H * (wide ? .8 : .7)); g.scale(pop, pop);
      g.font = `900 ${fs}px ${stack}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.lineWidth = fs * .26; g.strokeStyle = '#1e161c'; g.strokeText(text.text, 0, 0);
      g.fillStyle = '#fffaf0'; g.fillText(text.text, 0, 0); g.restore();
      return cap2d;
    }
    const fs = Math.round(wide ? H * .05 : W * .056); g.font = `800 ${fs}px ${capStack(fams, '"Segoe UI", Arial, sans-serif')}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    // Thai, Japanese and Chinese have no spaces between words: the line breaks between the words the browser's word breaker finds
    const spaceless = RX_SPACELESS.test(text) && typeof Intl.Segmenter === 'function', sep = spaceless ? '' : ' ';
    const words = spaceless ? [...new Intl.Segmenter(S?.lang || undefined, { granularity: 'word' }).segment(text)].map(s => s.segment) : text.split(/\s+/), lines = []; let cur = '';
    for (const w of words) { if (spaceless && !cur && !w.trim()) continue; const n = cur ? cur + sep + w : w; if (g.measureText(n).width > W * (wide ? .7 : .84) && cur) { lines.push(spaceless ? cur.trim() : cur); cur = w.trim() ? w : ''; } else cur = n; }
    if (cur) lines.push(spaceless ? cur.trim() : cur);
    const y0 = H * (wide ? .86 : .76) - (lines.length - 1) * fs * .6;
    lines.forEach((l, i) => { const y = y0 + i * fs * 1.2; g.lineWidth = fs * .2; g.strokeStyle = 'rgba(30,22,28,.95)'; g.lineJoin = 'round'; g.strokeText(l, W / 2, y); g.fillStyle = '#fffaf0'; g.fillText(l, W / 2, y); });
    return cap2d;
  }

  // ---- prop opts over time (Q3, FILM_API "props"): a key's numeric fields other than t/in/owner/rot/at/ease/drop/optsOnly are the prop's
  // build opts (umbrella `open`, ...). Snap at the key, or `ease: s` = from the previous value over s seconds (smoothstep). A module
  // that exports update(obj, opts) or an object with userData.set(k, v) is updated in place; any other prop is rebuilt with the new opts
  // (cached per value at 1/40 steps, the placement object kept, so hands, keys and shadows carry on).
  const KEYF = new Set(['t', 'in', 'owner', 'rot', 'at', 'ease', 'drop', 'optsOnly', 'toSide', 'fromSide']);
  async function propOpts(o, def, t) {
    const ks = (def.keys || []).filter(k => Object.keys(k).some(f => !KEYF.has(f) && typeof k[f] === 'number'));
    if (!ks.length) return;
    const cur = {};
    for (const k of ks) for (const [f, v] of Object.entries(k)) {
      if (KEYF.has(f) || typeof v !== 'number' || t < k.t) continue;
      const prev = cur[f] ?? def[f] ?? v, e = k.ease ? smooth(Math.min(1, (t - k.t) / k.ease)) : 1;
      cur[f] = prev + (v - prev) * e;
    }
    for (const f of new Set(ks.flatMap(k => Object.keys(k).filter(x => !KEYF.has(x) && typeof k[x] === 'number')))) cur[f] ??= def[f];
    const q = Object.fromEntries(Object.entries(cur).filter(([, v]) => v !== undefined).map(([f, v]) => [f, Math.round(v * 40) / 40]));
    const sig = JSON.stringify(q);
    if (o.userData.optSig === sig) return;
    o.userData.optSig = sig;
    if (typeof o.userData.set === 'function') { for (const [f, v] of Object.entries(q)) o.userData.set(f, v); return; }
    if (typeof o.userData.update === 'function') { o.userData.update(o, q); return; }
    const cache = o.userData.optCache || (o.userData.optCache = new Map());
    let n = cache.get(sig);
    if (!n) { n = await makeProp(def.kind, { ...def, ...q, film: S.film, ...(S.propsUrl ? { propsUrl: S.propsUrl } : {}) }); n.position.set(0, 0, 0); n.quaternion.identity();
      const os = o.userData.s0 || o.scale;   // PROPS2: the prop's own scale, never a stow sink's shrunk one
      n.scale.set(n.scale.x / (os.x || 1), n.scale.y / (os.y || 1), n.scale.z / (os.z || 1)); cache.set(sig, n); }
    let mask = null; o.traverse(m => { if (mask === null && m.isMesh) mask = m.layers.mask; });
    if (!o.userData.optBase) o.userData.optBase = [...o.children];   // the original build stays for the def's own opts
    o.clear();
    const same = Object.entries(q).every(([f, v]) => v === Math.round((def[f] ?? v) * 40) / 40);
    if (same) for (const c of o.userData.optBase) o.add(c); else o.add(n);
    if (mask !== null) o.traverse(m => { if (m.isMesh) m.layers.mask = mask; });
    if (n.userData.sockets && !same) o.userData.sockets = { ...o.userData.sockets, ...n.userData.sockets };
  }
  // a prop key { t, drop: { from:[x,y,z] (default: where it is), v0:[x,y,z] D/s, g 9.8 D/s^2, ground 0, spin deg/s, hide true } }: a closed
  // form fall from t (pure in t, no state): p = from + v0 dt - g dt^2/2 until it reaches `ground`, then it lies there (or hides).
  function dropAt(o, k, t) {
    const d = k.drop === true ? {} : k.drop, dt = t - k.t, g = d.g ?? 9.8, v0 = d.v0 || [0, 0, 0];
    const mem = o.userData.dropFrom || (o.userData.dropFrom = {});
    const from = d.from || k.at || mem[k.t] || (mem[k.t] = o.userData.last || o.position.toArray());   // default: where it was when the drop began
    const gy = d.ground ?? 0, a = g / 2, b = v0[1], c = from[1] - gy;          // land when c + b T - a T^2 = 0
    const T = a > 0 ? (b + Math.sqrt(b * b + 4 * a * Math.max(0, c))) / (2 * a) : Infinity, u = Math.min(dt, T);
    if (dt > T && d.hide !== false) { o.visible = false; return true; }
    o.visible = true;
    o.position.set(from[0] + v0[0] * u, from[1] + b * u - a * u * u, from[2] + v0[2] * u);
    const rot = (k.rot || [0, 0, 0]).map(v => v * Math.PI / 180); o.rotation.set(rot[0], rot[1] + (d.spin || 0) * Math.PI / 180 * u, rot[2]);
    return true;
  }

  // --probe (Q3): a narrow set piece / prop right BEHIND a head (a post or lamp growing out of it). Three rays from the camera: through the
  // head centre and just past both sides of the head disc (.6 D out along the camera's right). The world thing hit within 8 D behind the
  // head on the centre ray, when the side rays hit something else (or nothing), is narrower than the head's surroundings: v.behind = its name.
  const _ray = new THREE.Raycaster();
  function behindProbe(views) {
    const notChar = o => { for (let p = o; p; p = p.parent) if (chars.some(c => c.ch.root === p) || props.some(q => q.o === p)) return false; return true; };
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), cam = camera.position.clone();
    const hit = (pt, dHead) => { _ray.set(cam, pt.clone().sub(cam).normalize()); _ray.far = dHead + 8;
      for (const h of _ray.intersectObjects(scene.children, true)) if (h.distance > dHead + .5 && h.object.visible && h.object.isMesh && notChar(h.object)) return h; return null; };
    for (const v of views) {
      const H = v.head, dH = cam.distanceTo(H), c = hit(H, dH); if (!c) continue;
      // narrow = both side rays pass it: they hit nothing or something at least .5 D deeper (a wall behind the post), never a flat wall
      const l = hit(H.clone().addScaledVector(right, -.6), dH), r = hit(H.clone().addScaledVector(right, .6), dH);
      const past = s => !s || s.distance > c.distance + .5;
      if (past(l) && past(r)) v.behind = c.object.name || c.object.parent?.name || c.object.geometry?.type || 'mesh';
    }
  }

  // FIX1 PROPS: the one placement of a prop under key k (null = the film default / the owner's pose.props from a clip). Remembers the
  // holder (o.userData.holder = character name when it sits in a hand) for inFront().
  function propPlace(o, def, k, states, t) {
    const owner = k?.owner ?? def.owner, own = owner ? states[owner] : null;
    const pp = k || own?.P.props?.[def.id], base = k ? {} : { in: def.in || 'world', at: def.at, rot: def.rot };
    const where = (pp && pp.in) || base.in || 'world';
    if ((where.startsWith('hand:') || where === 'body') && !own) throw new Error(`MAKE_FILM FAILED: prop "${def.id}" at t ${t.toFixed(2)} is in ${where} but has no owner in the cast (owner ${JSON.stringify(owner)})`);
    placeProp(o, own?.st, pp, base);
    o.userData.holder = where.startsWith('hand:') ? owner : null;
  }
  // a held prop stays drawn in front of its holder's body: if its origin is less than .3 D in front of the body's centre (along the view
  // ray to the camera), it moves toward the camera along that ray (the same point on screen, a hair bigger) until it is
  const _cv = new THREE.Vector3(), _bv = new THREE.Vector3(), _hv = new THREE.Vector3(), _sv = new THREE.Vector3(), _hq = new THREE.Quaternion();
  function inFront(o, def, keys, states, t) {
    const who = o.userData.holder; if (!who || !o.visible || def.behind === true) return;
    const st = states[who]?.st; if (!st?.rig?.hem) return;
    st.rig.hem.decompose(_bv, _hq, _sv); _bv.y = o.position.y;
    _cv.copy(camera.position).sub(o.position); const dist = _cv.length(); if (dist < 1e-3) return; _cv.divideScalar(dist);
    const d = _hv.copy(o.position).sub(_bv).dot(_cv), need = (def.front ?? .3) - d;
    if (need > 0) o.position.addScaledVector(_cv, Math.min(need, dist * .5));
  }
  // PROPS2: a stow key ({ in: 'hidden', stow: true }) never pops a prop out of existence: over the `sink` s (default .2) before the key
  // the prop shrinks into the hand / pocket and slides down a little, so putting it away reads as an action on screen.
  function sinkStow(o, keys, t) {
    if (!o.userData.s0) o.userData.s0 = o.scale.clone();
    o.scale.copy(o.userData.s0);
    if (!o.visible) return;
    const k = keys.find(x => x.in === 'hidden' && x.stow && t < x.t && t > x.t - (x.sink ?? .2)); if (!k) return;
    const w = smooth01(k.t - (k.sink ?? .2), k.t, t);
    o.scale.multiplyScalar(Math.max(.03, 1 - w)); o.position.y -= .08 * w;
  }
  // PROPS2: a SWAP (one prop goes 'hidden' and another comes out of 'hidden' into a hand at the same frame: a loaf breaks into halves)
  // never pops the new prop into its hand: for `pass` s (default .25) after the key it travels from where the old prop was (under the
  // old prop's last placement) to its own hand. Returns { def, k, x, pass } (the old prop's def + its key before the hide) or null.
  const PKEY = y => !y.optsOnly && ['in', 'owner', 'at', 'rot', 'drop'].some(f => f in y);
  function swapFrom(def, keys, t) {
    for (let i = 0; i < keys.length; i++) {
      const x = keys[i], pass = x.pass ?? .25;
      if (!/^hand:/.test(x.in || '') || t < x.t || t > x.t + pass) continue;
      if ((i ? keys[i - 1].in : def.in) !== 'hidden') continue;
      for (const q of props) {
        if (q.def === def) continue;
        const qk = (q.def.keys || []).filter(PKEY), j = qk.findIndex(y => y.in === 'hidden' && Math.abs(y.t - x.t) < 1.01 / 30);
        if (j >= 0) return { def: q.def, o: q.o, k: j ? qk[j - 1] : null, x, pass };
      }
    }
    return null;
  }

  const frame = async (t, opts = {}) => {
    const t0 = performance.now();
    let C;
    if (shotFns) { let s = shotFns[0]; for (const x of shotFns) if (t >= x.t0) s = x;
      // a camera that follows a prop: a first pass over this frame places the props (first guess: the prop's owner or spot), the real pass reads them. A set object: set.update(t) first.
      if (s.uProp && !opts._pre) { PROPPOS = Object.fromEntries(props.map(p => { const ow = p.def.owner ? rootOf(p.def.owner, t) : null; return [p.def.id, ow ? [ow[0], 1.2, ow[2]] : p.def.at || [0, 1.2, 0]]; })); await frame(t, { noDraw: true, noPng: true, _pre: true }); }
      if (s.uSet) worldSet.update?.(t);
      C = s.f(t); }
    else C = cameraAt(S.camera, t);
    camera.fov = C.fov || 26; camera.updateProjectionMatrix();
    camera.position.set(...C.pos); camera.up.set(0, 1, 0); camera.lookAt(...C.target);
    if (C.roll) camera.rotateZ(-C.roll * Math.PI / 180);
    camera.updateMatrixWorld(true);
    const views = [], states = {}, PR = opts.prof, tp = () => PR ? performance.now() : 0;
    let tq = tp();
    if (PR) { PR.camera = tq - t0; }
    // SPEED (2026-11-04, speed/REPORT.md): a character whose bounding sphere is outside the camera's frustum AND the sun shadow camera's is not
    // updated at all (hidden, blobs hidden): before, every character was updated 3 times a frame (main, sun, main again) wherever he was, and
    // a film with 4 places 400 D apart drew 3/4 of its cast for nothing. Outside the sun frustum only = no sun pass for him (shadow.js skip).
    // Pure in t: the test reads the pose at t only. A prop that needs a culled owner wakes him (states getter). Probe / guard passes never cull.
    const cull = !opts.noDraw && !opts.depth && !opts.behind && !opts.far && S.cull !== false;
    const culled = new Set(), noSun = new Set();
    if (cull) { _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _frMain.setFromProjectionMatrix(_pv);
      if (shadows) { const lc = shadows.camera; lc.updateMatrixWorld(); _pv.multiplyMatrices(lc.projectionMatrix, lc.matrixWorldInverse); _frSun.setFromProjectionMatrix(_pv); } }
    const placeBlobs = (P, w, b) => {
      if (b) { const fl = P.floorY ?? 0;   // height: the blobs lie on the floor he stands on / is over and fade as he rises from it (3 D = gone); older films: floor 0, untouched
        w.feet.forEach((f, j) => { b.feet[j].position.set(f.x, fl + .002, f.z + .03); b.feet[j].scale.set(.42, .3, 1); });
        b.body.position.set(w.hem.x, fl + .001, w.hem.z); b.body.scale.set(1.25, 1.0, 1);
        if (P.floorY != null) { const k = Math.max(0, 1 - Math.max(0, (P.root?.y || 0) - fl) / 3); for (const m of [...b.feet, b.body]) { m.userData.op0 ??= m.material.opacity; m.material.opacity = m.userData.op0 * k; m.visible = k > 0; } } }
    };
    const showBlobs = (b, on) => { if (b) for (const m of [...b.feet, b.body]) m.visible = on && (m.userData.op0 == null || m.material.opacity > 0); };
    chars.forEach(({ ch, def }, i) => {
      if (opts.far) { const r = rootOf(def.name || ch.id, t); if (Math.hypot(r[0] - camera.position.x, r[2] - camera.position.z) > opts.far) return; }   // --probe: another place of the film, left out
      const P = poseAt(def, ch, t), name = def.name || ch.id, b = blobs[i];
      if (cull) {
        const r = P.root || {}, hy = ch.rest.headY || 3;
        _sph.center.set(r.x || 0, (r.y || 0) + hy * .5, r.z || 0); _sph.radius = hy * .5 + 3;
        const inMain = _frMain.intersectsSphere(_sph), inSun = !!shadows && _frSun.intersectsSphere(_sph);
        if (!inSun) noSun.add(ch);
        if (!inMain && !inSun) {
          culled.add(ch); ch.root.visible = false; showBlobs(b, false);
          Object.defineProperty(states, name, { configurable: true, enumerable: true, get() {   // a prop's owner: update him after all, as before
            delete states[name]; culled.delete(ch); ch.root.visible = true; showBlobs(b, true);
            const st = ch.update(P, t, camera, W, H); states[name] = { st, P }; placeBlobs(P, ch.where(), b); return states[name]; } });
          return;
        }
        ch.root.visible = true; showBlobs(b, true);
      }
      const st = ch.update(P, t, camera, W, H);
      states[name] = { st, P };
      const w = ch.where();
      placeBlobs(P, w, b);
      views.push({ id: ch.id, az: +ch.V.az.toFixed(1), el: +ch.V.el.toFixed(1), d: +ch.V.d.toFixed(1), cx: Math.round(ch.V.cx), cy: Math.round(ch.V.cy), hy: +w.head.y.toFixed(2), head: w.head });
    });
    if (globalThis.__cz) { globalThis.__cz.cam = camera; globalThis.__cz.W = W; globalThis.__cz.H = H; }
    if (PR) { const x = tp(); PR.chars = x - tq; tq = x; PR.culled = culled.size; PR.noSun = noSun.size; }
    // --probe (make_film): how far each head is and whether it is in front of the camera, so what is behind it or in another place is left out, and rays only for what is left
    if (opts.depth) { const ci = camera.matrixWorldInverse; for (const v of views) { v.dist = +camera.position.distanceTo(v.head).toFixed(2); v.depth = +(-v.head.clone().applyMatrix4(ci).z).toFixed(2); } }
    if (opts.behind) behindProbe(opts.depth ? views.filter(v => v.depth > 0 && v.dist <= (opts.far ?? 100) && v.cx + v.d / 2 > 0 && v.cx - v.d / 2 < W && v.cy + v.d / 2 > 0 && v.cy - v.d / 2 < H) : views);
    for (const v of views) delete v.head;
    // props: the owner's pose.props[id] wins, else the film's default ({ in: 'hand:R' } / world placement)
    // FIX1 PROPS: ONE ownership mechanism for every prop action. At every t a prop has exactly one owner: a character's hand / body (the
    // owner's pose.props[id] from a clip, else the film's key / default) or a world spot. propPlace() resolves it for ANY time. When the
    // owner changes at a placement key (hand-over, film key, pick_up / put_down keys) the prop travels on a path from the old owner's
    // placement to the new one over `pass` s each side of the key (default .1; a hand-over's own `pass`), so it can never pop, vanish or
    // float between two owners. A prop held in a hand is kept in front of the holder's body as the camera sees it (shifted along its own
    // view ray: same spot on screen, never hidden behind the torso when the arm swings).
    for (const { o, def } of props) {
      o.userData.farOff = false;
      if (opts.far) { const os = [def.owner, ...(def.keys || []).map(k => k.owner)].filter(Boolean); if (os.length && !os.some(n => states[n])) { o.userData.farOff = true; continue; } }   // with its far-away owner
      // SPEED: a prop that only ever sits in its owners' hands / on their bodies / hidden, all of them culled this frame, is with them out of
      // every view: hidden, nothing placed (a prop that can lie in the world is placed as before and wakes its owner)
      if (culled.size && cullProp(def)) { o.visible = false; continue; }
      await propOpts(o, def, t);
      const keys = (def.keys || []).filter(x => !x.optsOnly && ['in', 'owner', 'at', 'rot', 'drop'].some(f => f in x));
      // the owner change nearest t whose pass window holds t (hidden / drop keys are not paths: a stow happens at a hand's contact)
      const sw = swapFrom(def, keys, t);
      if (sw) {
        // A = where the old prop was last SEEN (its own clip may already hide it at the swap frame), else its placement now
        propPlace(o, sw.def, sw.k, states, t);
        const seen = sw.o.userData.seen, A = (seen && t - seen.t < .5) ? seen.p.clone() : o.position.clone(), qa = (seen && t - seen.t < .5) ? seen.q.clone() : o.quaternion.clone();
        propPlace(o, def, sw.x, states, t);
        const w = smooth01(sw.x.t, sw.x.t + sw.pass, t); o.position.lerpVectors(A, o.position.clone(), w); o.quaternion.copy(qa.slerp(o.quaternion.clone(), w));
        inFront(o, def, keys, states, t); sinkStow(o, keys, t); continue;
      }
      let kc = null, kPrev = null, pass = .1;
      for (let i = 0; i < keys.length; i++) {
        const x = keys[i], HO = HANDOVERS.find(h => h.prop === def.id && Math.abs(h.t - x.t) < 1e-6), ps = HO?.pass ?? x.pass ?? .1;
        // PROPS2: also a prop that STARTS hidden (def.in 'hidden'): it must not show at its new hand `pass` s before its key
        if (x.drop || x.in === 'hidden' || (keys[i - 1] && (keys[i - 1].in === 'hidden' || keys[i - 1].drop)) || (!i && def.in === 'hidden')) continue;
        if (Math.abs(t - x.t) < ps) { kc = x; kPrev = i ? keys[i - 1] : null; pass = ps; }
      }
      if (kc) {
        // A = where the prop is under the previous owner (the key before, or the default), B = under the new key's owner, both at t
        propPlace(o, def, kPrev, states, t, true); const A = o.position.clone(), qa = o.quaternion.clone(), va = o.visible;
        propPlace(o, def, kc, states, t, false);
        if (va && o.visible) { const w = smooth01(kc.t - pass, kc.t + pass, t); o.position.lerpVectors(A, o.position.clone(), w); o.quaternion.copy(qa.slerp(o.quaternion.clone(), w)); }
      } else {
        let k = null; for (const x of keys) if (t >= x.t) k = x;
        if (k?.drop) { if (dropAt(o, k, t)) continue; }
        propPlace(o, def, k, states, t, false);
      }
      inFront(o, def, keys, states, t);
      sinkStow(o, keys, t);
      if (o.visible) o.userData.seen = { t, p: o.position.clone(), q: o.quaternion.clone() };
    }
    if (opts._pre) { for (const { o, def } of props) PROPPOS[def.id] = o.getWorldPosition(new THREE.Vector3()).toArray(); }
    if (opts.noDraw) return { png: null, ms: performance.now() - t0, views };   // --probe, the prop guard, a path camera's first pass: numbers only, nothing drawn
    if (PR) { const x = tp(); PR.props = x - tq; tq = x; }
    if (shadows) { shadows.update(cull ? { skip: noSun, hide: culled } : undefined); if (PR) { const x = tp(); PR.shadows = x - tq; tq = x; } worldSet.update(t); if (PR) { const x = tp(); PR.set = x - tq; tq = x; } }
    if (worldSet?.look) worldSet.look.render(renderer, scene, camera, t, { S, W, H, chars, props, shotFns, rootOf }); else   // ENV2: a set with a post pipeline (world/look/look.js) draws the frame itself
    renderer.render(scene, camera);
    if (PR) { const x = tp(); PR.render = x - tq; tq = x; }
    const ms = performance.now() - t0;
    let png = null;
    if (opts.caption) { const fams = capFaces(capText(opts.caption), S?.lang); if (fams) await capFontReady(fams); }   // (a bundled caption font, once)
    if (!opts.noPng) {
      const src = opts.caption !== undefined ? drawCaption(opts.caption) : renderer.domElement;
      png = opts.jpg ? src.toDataURL('image/jpeg', opts.jpg).split(',')[1] : src.toDataURL('image/png').split(',')[1];
    }
    if (opts.canvasOut) return { png, ms, views, prof: PR, canvas: opts.caption !== undefined ? drawCaption(opts.caption) : renderer.domElement };
    return { png, ms, views, prof: PR };
  };
  const _pv = new THREE.Matrix4(), _frMain = new THREE.Frustum(), _frSun = new THREE.Frustum(), _sph = new THREE.Sphere();
  const HELD = /^(hand:|body$|hidden$)/, _cullProp = new Map();
  // a prop that is never in the world: an owner, and every placement (def.in, each key's in) a hand, the body or hidden, no drop
  function cullProp(def) {
    if (!_cullProp.has(def)) { const ks = def.keys || [], os = [def.owner, ...ks.map(k => k.owner)].filter(Boolean);
      _cullProp.set(def, os.length ? { os: [...new Set(os)], held: HELD.test(def.in || '') && ks.filter(PKEY).every(k => !k.drop && HELD.test(k.in || '')) } : null); }
    const c = _cullProp.get(def); if (!c || !c.held) return false;
    return c.os.every(n => { const x = chars.find(x => x.ch.id === n || x.def.name === n); return x && !x.ch.root.visible; });
  }
  // the PROP GUARD's numbers for the frame just placed (tools/make_film.mjs): the camera (projection x view, position) and each prop's world grip + who holds it (null = not visible)
  const propTrack = () => {
    camera.updateMatrixWorld(true);
    const pv = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).elements, v = new THREE.Vector3();
    return { pv: [...pv], c: camera.position.toArray(), f: camera.getWorldDirection(new THREE.Vector3()).toArray(), W, H,
      w: props.map(({ o, def }) => { if (o.userData.farOff) return null; for (let p = o; p; p = p.parent) if (p.visible === false) return null; o.getWorldPosition(v); return { p: v.toArray(), h: o.userData.holder || (def.in === 'body' ? def.owner : null) }; }) };
  };
  const dispose = () => { try { renderer.dispose(); renderer.forceContextLoss(); } catch {} };
  return { init, frame, propTrack, dispose, renderer, scene, camera, canvas, rootOf, get set() { return worldSet; }, get chars() { return chars; }, get props() { return props; }, get shots() { return shotFns; } };

}
