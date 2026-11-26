// engine/rbx/card.js (Roblox V3, WP-CR 2026-11-12, owner's call: "sprites and animations for monsters can be made in AI Studio and used as
// flat cards and animated like that"): a creature drawn as PAINTED CARDS. character.js hands a spec with `body: "card"` here.
//   createCard(spec, opts) -> the createRbxCharacter interface ({ id, root, rest, parts, update, where, V, rig, light, setLight, kind }).
// spec.card = the folder name under engine/rbx/cards/ (beast, pale, totem). Its card.json:
//   { height: D (the idle frame's full height), frames: { name: { file, w, h, ppd (pixels per D), foot: [fx, fy] (ground contact, 0..1 of
//     the picture, y down) } }, sets: { front: { idle, step, reach, roar, talk, shock }, side: { idle, walk: [4 frames], reach },
//     back: { idle }, crawlSide: [4 frames], crawlFront, stand }, sideFaces: 1 (side frames painted facing screen right) }
// It runs on the same rig and timeline as everyone (root place / turn / walk, clips, look, face), and picks the picture from the pose:
//  - the VIEW from the camera: facing it -> front, facing away -> back (side if the card has none), else side, mirrored to the way it faces;
//  - walking: the walk's own feet (root frame) give the step: side = a 4-frame cycle, front = step / mirrored step / idle;
//  - an arm in the world, a reach or a hand far forward -> reach; a scream / roar / shout face -> roar (talk / shock if the card has them);
//  - crawl (pose body.crawl or spec.crawl > .5) -> the crawl frames;
// and moves it in code: walk bob + hops (body.hipY), sway with the step, lean / bend tip the card about its feet, squash, idle breathing.
// The card is a camera-facing quad turned about the vertical axis (pure in the camera, like world/look/sprites.js), alpha tested (writes
// depth: haze, depth of field and the shadow pass treat it as geometry), lit by the rbx light record with a rounded fake normal.
// Pure in (pose, t, camera): nothing is carried between frames.
import * as THREE from '../three.js';
import { rig, withRest } from '../rig.js';
import { viewOf } from '../view.js';
import { STUD, layout } from './body.js';
import { makeLight, setLight } from './shade.js';

const DEG = Math.PI / 180;
const CARDS = new URL('./cards/', import.meta.url);
const OPEN = f => /scream|shout|yell|roar|rage|teeth/.test(`${f?.mouth || ''} ${f?.brow || ''}`);
const TALK = f => /^v_|talk/.test(`${f?.mouth || ''}`);
const SHOCK = f => /wide|^o$|shock|o_eyes|scared/.test(`${f?.eyes || ''} ${f?.mouth || ''} ${f?.brow || ''}`);

const VERT = /* glsl */`varying vec2 vUv; varying vec3 vW;
void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FRAG = /* glsl */`uniform sampler2D uMap; uniform float uFlip, uHas, uAirK; uniform vec3 uDir, uKey, uShadow, uSky, uGround, uR, uF, uTint, uAir;
varying vec2 vUv; varying vec3 vW;
void main() {
  vec2 uv = vec2(uFlip > .5 ? 1. - vUv.x : vUv.x, vUv.y);
  vec4 t = uHas > .5 ? texture2D(uMap, uv) : vec4(.1, .1, .12, 1.);
  if (t.a < .5) discard;
  // a rounded normal across the picture (a body, not a flat card), lit like the rbx parts: key / shadow with a soft line, sky / ground fill
  vec3 n = normalize(uR * (vUv.x - .5) * 1.2 + vec3(0., .25 + .4 * (vUv.y - .5), 0.) + uF);
  float lit = smoothstep(-.25, .35, dot(n, normalize(uDir)));
  vec3 fill = mix(uGround, uSky, n.y * .5 + .5);
  vec3 light = mix(uShadow * fill, uKey, lit);
  vec3 c = t.rgb * light * uTint * mix(.82, 1., smoothstep(.5, .95, t.a));
  c = mix(c, uAir, uAirK);                                         // far away: toward the sky colour, so it sits in the air
  gl_FragColor = vec4(min(c, vec3(.96)), 1.);
  #include <colorspace_fragment>
}`;

async function loadJson(url) {
  if (typeof fetch === 'function' && !/^file:/.test(String(url))) return (await fetch(url)).json();
  const fs = await import('node:fs'); return JSON.parse(fs.readFileSync(new URL(url), 'utf8'));
}

export async function createCard(specIn, opts = {}) {
  const spec = { ...specIn }, id = spec.id || 'card', name = spec.card || 'beast';
  const dir = new URL(`${name}/`, CARDS), C = await loadJson(new URL('card.json', dir));
  const root = new THREE.Group(); root.name = `character.${id}`;
  const light = makeLight(THREE, spec.light || {});
  // size: spec.cardHeight (D) or the card's own height (build.scale belongs to the rbx bodies and is ignored); spec.cardScale multiplies
  const height = (spec.cardHeight ?? C.height) * (spec.cardScale ?? 1);
  const k = height / C.height;                                // world D per card D
  // ---- textures (a page only; node tools run the motion without pictures)
  const tex = {};
  if (typeof document !== 'undefined') {
    const loader = new THREE.TextureLoader();
    await Promise.all(Object.entries(C.frames).map(async ([n, f]) => {
      try { const t = await loader.loadAsync(new URL(f.file, dir).href); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; tex[n] = t; }
      catch (e) { (globalThis.__czWarn || console.warn)(`rbx card ${name}: ${f.file} failed (${e?.message || e})`); }
    }));
  }
  const U = { uMap: { value: null }, uHas: { value: 0 }, uFlip: { value: 0 }, uR: { value: new THREE.Vector3(1, 0, 0) }, uF: { value: new THREE.Vector3(0, 0, 1) },
    uTint: { value: new THREE.Color(spec.tint || '#ffffff') }, uAir: { value: new THREE.Color(spec.air || '#9cc4ec') }, uAirK: { value: 0 }, ...light };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U, side: THREE.DoubleSide });
  mat.name = 'rbx.card';
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); quad.name = 'rbx.card.' + name; quad.frustumCulled = false; quad.castShadow = true;
  const tilt = new THREE.Group(), turn = new THREE.Group(); tilt.add(quad); turn.add(tilt); root.add(turn);
  turn.matrixAutoUpdate = true;
  // the eyes: a separate glow picture (on black) ADDED over the frame's eye point (make_cards.py finds it per frame); the only glow
  let eyesQ = null;
  if (C.eyesCard && typeof document !== 'undefined') {
    try {
      const t = await new THREE.TextureLoader().loadAsync(new URL(C.eyesCard.file, dir).href); t.colorSpace = THREE.SRGBColorSpace;
      eyesQ = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        opacity: spec.eyeGlow ?? .9 }));
      eyesQ.name = 'rbx.card.eyes'; eyesQ.renderOrder = 6; eyesQ.frustumCulled = false; tilt.add(eyesQ);
    } catch (e) { (globalThis.__czWarn || console.warn)(`rbx card ${name}: eyes card failed (${e?.message || e})`); }
  }

  // ---- rest: a person's layout scaled to the card's height (clips, looks, walks read it); the head near the top of the idle frame
  const sc = height / 3.0, s = STUD * sc, L = layout({ build: {} });
  const S = { neck: [0, (L.neckY - L.hipY) * s, 0], shoulderR: [-L.shoulderX * s, (L.shoulderY - L.hipY) * s, 0], shoulderL: [L.shoulderX * s, (L.shoulderY - L.hipY) * s, 0],
    hipR: [-L.hipX * s, 0, 0], hipL: [L.hipX * s, 0, 0] };
  const rest = { hipY: L.hipY * s, neckToHead: .38 * s / STUD * STUD, armLen: L.armLen * s, legLen: L.legLen * s, slack: .72, legSlack: .45, walkSlack: .22, footLen: .45 * s,
    ankleY: L.ankleY * s, neck: S.neck, shoulderR: S.shoulderR, shoulderL: S.shoulderL, hipR: S.hipR, hipL: S.hipL, kind: 'rbx', creature: name, card: true };
  rest.neckToHead = Math.max(.1, height * (C.headY ?? .88) - rest.hipY - S.neck[1]);
  rest.headY = rest.hipY + S.neck[1] + rest.neckToHead;

  const R = {}, V = {}, state = { V, rig: R, pose: null, hands: null, feet: null, frame: null };
  const _v = new THREE.Vector3(), HM = new THREE.Matrix4();
  const set = C.sets || {}, has = n => n && C.frames[n];
  const ch2 = cyc => (cyc & 1) === 1;                          // front walk: the step picture on the passing phases, idle on the contacts
  const pick = (list, i) => Array.isArray(list) ? list[((i % list.length) + list.length) % list.length] : list;

  function choose(P, t, camera) {
    const B = P.body, ry = (P.root.ry || 0) * DEG, c = Math.cos(ry), sn = Math.sin(ry), rx = P.root.x || 0, rz = P.root.z || 0, ry0 = P.root.y || 0;
    const tcx = camera.position.x - rx, tcz = camera.position.z - rz, tl = Math.hypot(tcx, tcz) || 1;
    const fx = sn, fz = c, a = (fx * tcx + fz * tcz) / tl;                       // facing . to-camera
    const right = (fx * tcz - fz * tcx) / tl;                                      // facing . screen-right (right = (tcz, 0, -tcx))
    // the walk's feet in the root frame (z forward)
    const loc = sd => { const l = P['leg' + sd]; if (!l?.foot) return [0, 0, 0]; const f = l.foot;
      if ((l.in || 'world') !== 'world') return [f[0], f[1] - rest.ankleY, f[2]];
      const dx = f[0] - rx, dz = f[2] - rz; return [c * dx - sn * dz, f[1] - ry0 - rest.ankleY, sn * dx + c * dz]; };
    const fR = loc('R'), fL = loc('L'), d = fR[2] - fL[2], lift = Math.max(fR[1], fL[1]);
    const walking = (P.walkK || 0) > .05 || lift > .02 || Math.abs(d) > .12 * rest.legLen;
    // 4-frame cycle from the stride phase: the angle of (which foot is ahead, which foot is up) runs once round per stride:
    // 0 right ahead (contact), 1 left passing, 2 left ahead, 3 right passing
    const ang = Math.atan2((fR[1] - fL[1]) / (.06 * rest.legLen), d / (.3 * rest.legLen));
    const cyc = ((Math.round(-ang / (Math.PI / 2)) % 4) + 4) % 4;
    const crawl = Math.max(0, Math.min(1, +(B.crawl ?? spec.crawl ?? 0) || 0)) > .5;
    const arm = sd => { const A = P['arm' + sd] || {}; return A.in === 'world' || (A.reach?.w || 0) > .3 || ((A.in || 'body') === 'body' && (A.hand?.[2] || 0) > .45 * rest.armLen); };
    const reach = arm('R') || arm('L'), face = P.face || {};
    // no side (or back) pictures yet: the front ones stand in (a card seen for a second, far away, reads either way)
    let view = a > .42 || (!set.side && !(crawl && set.crawlSide)) ? 'front' : a < -.55 && set.back ? 'back' : 'side';
    let frame = null, flip = false;
    if (crawl && (set.crawlSide || set.crawlFront)) {
      if (view === 'front' && set.crawlFront) frame = set.crawlFront;
      else { frame = pick(set.crawlSide, walking ? cyc : 0); view = 'side'; }
    } else if (view === 'front') {
      const F = set.front || {};
      frame = OPEN(face) && has(F.roar) ? F.roar : reach && has(F.reach) ? F.reach : TALK(face) && has(F.talk) ? F.talk : SHOCK(face) && has(F.shock) ? F.shock
        : walking && has(F.step) && (ch2(cyc)) ? F.step : F.idle;
      // (never mirrored: the front pictures are three-quarter, a mirror swaps the head's side and it jumps every step)
    } else if (view === 'back') frame = set.back.walk && walking ? pick(set.back.walk, cyc >> 1) : set.back.idle;
    else {
      const Sd = set.side || {};
      frame = reach && has(Sd.reach) ? Sd.reach : walking && Sd.walk ? pick(Sd.walk, cyc) : Sd.idle || pick(Sd.walk, 0);
    }
    if (!has(frame)) frame = (set.front || {}).idle || Object.keys(C.frames)[0];
    if (view === 'side') flip = (right > 0) !== ((C.sideFaces ?? 1) > 0);
    if (crawl && view === 'side') flip = (right > 0) !== ((C.crawlFaces ?? C.sideFaces ?? 1) > 0);
    return { frame, flip, view, walking, cyc, d, crawl };
  }

  // V4 (monster film pass, additive, off unless spec.cardHold > 0 s): a walking card keeps each walk picture at least cardHold seconds,
  // so the picture (and the bob / sway tied to it) cannot hop back and forth near a stride-phase edge. Only walk-cycle pictures are held
  // (roar / reach / talk / shock and any non-walking frame switch at once). Reset on a backward seek or a jump over .25 s (a new render pass).
  const walkSet = new Set([set.front?.idle, set.front?.step, set.side?.idle, ...[].concat(set.side?.walk || []), set.back?.idle, ...[].concat(set.back?.walk || []), ...[].concat(set.crawlSide || [])].filter(Boolean));
  const HL = { frame: null, flip: false, cyc: 0, view: '', walking: false, since: -1e9, last: -1e9 };
  function holdWalk(ch, t) {
    if (t < HL.last - 1e-6 || t - HL.last > .25) HL.frame = null;
    HL.last = t;
    if (ch.frame === HL.frame && ch.flip === HL.flip) return ch;
    const holdable = ch.walking && HL.walking && ch.view === HL.view && walkSet.has(ch.frame) && walkSet.has(HL.frame);
    if (HL.frame && holdable && t - HL.since < spec.cardHold) return { ...ch, frame: HL.frame, flip: HL.flip, cyc: HL.cyc };
    Object.assign(HL, { frame: ch.frame, flip: ch.flip, cyc: ch.cyc, view: ch.view, walking: ch.walking, since: t });
    return ch;
  }

  function update(poseIn, t, camera, W, H) {
    if (typeof globalThis !== 'undefined') { const g = globalThis.__cz || (globalThis.__cz = { roots: new Set() }); g.roots.add(root); g.cam = camera; g.W = W; g.H = H; }
    const P = withRest(poseIn, rest), B = P.body;
    rig(P, rest, S, R);
    let ch = choose(P, t, camera);
    if (spec.cardHold > 0) ch = holdWalk(ch, t);
    const f = C.frames[ch.frame];
    state.frame = ch.frame;
    U.uMap.value = tex[ch.frame] || null; U.uHas.value = tex[ch.frame] ? 1 : 0; U.uFlip.value = ch.flip ? 1 : 0;
    // size: the picture's pixels at its sheet's pixels-per-D; the feet point on the root
    const w = f.w / f.ppd * k, h = f.h / f.ppd * k, foot = f.foot || [.5, .98];
    const breathe = 1 + .012 * Math.sin(t * 1.9 + (id.length * 1.3));
    const sq = B.squash ?? 1, hop = (B.hipY ?? rest.hipY) - rest.hipY;
    // stride bob: up on the passing frames (1, 3), down on the contacts (2.5 % of its height)
    const bob = ch.walking && !ch.crawl ? (ch.cyc & 1 ? .025 : 0) * h : 0;
    const hh = h * breathe * sq;
    quad.scale.set(w * (1 + (1 - sq) * .5), hh, 1);
    const fx0 = ch.flip ? 1 - foot[0] : foot[0];
    quad.position.set((.5 - fx0) * w, (foot[1] - .5) * hh + bob, 0);   // the foot point on the origin
    if (eyesQ) {
      const e = f.eyes;
      eyesQ.visible = !!e && U.uHas.value > 0;
      if (e) {
        const ex = ch.flip ? 1 - e[0] : e[0], ew = e[2] * w / (C.eyesCard.core || .7);
        eyesQ.scale.set(ew, ew * C.eyesCard.h / C.eyesCard.w, 1);
        eyesQ.position.set((ex - fx0) * w, (foot[1] - e[1]) * hh + bob, .02);
      }
    }
    // turn to the camera about the vertical axis; tip about the feet: lean (sideways) + the step's sway; bend tips a side view forward
    const rx = P.root.x || 0, rz = P.root.z || 0, ry0 = P.root.y || 0;
    turn.position.set(rx, ry0 + Math.max(-.2, hop * .6), rz);
    turn.rotation.set(0, Math.atan2(camera.position.x - rx, camera.position.z - rz), 0);
    const sway = ch.walking ? Math.sin((ch.cyc / 4) * Math.PI * 2) * 2.2 : 0;
    const fwdSign = ch.view === 'side' ? (ch.flip ? 1 : -1) * ((C.sideFaces ?? 1) > 0 ? 1 : -1) : 0;
    tilt.rotation.set(0, 0, (-(B.lean || 0) * .5 + sway + fwdSign * ((B.bend || 0) * .35 + (ch.walking && !ch.crawl ? 3 : 0))) * DEG);   // + a 3 deg lean into the step
    // distance: 15 to 30 % toward the sky colour from 10 D to 40 D away (spec.airK scales it, 0 = off)
    const dist = Math.hypot(camera.position.x - rx, camera.position.z - rz);
    U.uAirK.value = (spec.airK ?? 1) * (.15 + .15 * Math.min(1, Math.max(0, (dist - 10) / 30))) * Math.min(1, Math.max(0, (dist - 6) / 4));
    root.updateMatrixWorld(true);
    // light: the card's own right / forward for the fake normal
    _v.set(1, 0, 0).applyQuaternion(turn.quaternion); U.uR.value.copy(_v); _v.set(0, 0, 1).applyQuaternion(turn.quaternion); U.uF.value.copy(_v);
    // the head (framing, look targets): the rig's head, at the card's head height
    HM.copy(R.head); viewOf(V, HM, camera, W, H);
    // hands (props / grabs follow these): in front of the body at chest height; feet: the root
    const fx = Math.sin((P.root.ry || 0) * DEG), fz = Math.cos((P.root.ry || 0) * DEG), hy = ry0 + height * (ch.crawl ? .2 : .5);
    state.hands = { R: [rx + fx * .35 * height - fz * .12 * height, hy, rz + fz * .35 * height + fx * .12 * height], L: [rx + fx * .35 * height + fz * .12 * height, hy, rz + fz * .35 * height - fx * .12 * height] };
    state.feet = { R: [rx, ry0, rz], L: [rx, ry0, rz] };
    state.pose = P; state.view = ch.view;
    if (!spec.light?.dir && !state.lightSet) { const ws = opts.set?.(); if (ws?.lightDir) { setLight(light, { dir: ws.lightDir }); state.lightSet = true; } }
    return state;
  }
  const where = () => {
    const hd = new THREE.Vector3().setFromMatrixPosition(R.head), base = new THREE.Vector3().setFromMatrixPosition(R.root || new THREE.Matrix4());
    return { hem: new THREE.Vector3().setFromMatrixPosition(R.hem), head: hd, feet: [base.clone(), base.clone()], root: base, floor: state.pose?.floorY ?? 0 };
  };
  const parts = { card: quad, head: quad, headApi: { update() {} } };
  return { id, root, rest, parts, update, where, V, rig: R, light, setLight: o => { setLight(light, o); if (o.tint) U.uTint.value.set(o.tint); if (o.air) U.uAir.value.set(o.air); }, kind: 'rbx', card: name };
}

export default { createCard };
