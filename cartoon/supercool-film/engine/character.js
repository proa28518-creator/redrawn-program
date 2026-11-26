// character.js: one character in a WORLD under any THREE camera. createCharacter(spec) -> { root, rest, update(pose, t, camera, W, H) }.
//   spec: the specs/<id>.json object (with `id`), or just the id string (fetched from ../specs/<id>.json).
//   root: add it to the scene. Its own transform stays identity: everything inside is placed in world space by update().
//   rest: { hipY, neckToHead, headY, armLen, legLen, ankleY, shoulderR, shoulderL, hipR, hipL, neck } in body space (origin at the hem
//         point, +X the character's left, +Z facing): the motion agent's clips are relative to it.
//   update(pose, t, camera, W, H): pose = CONTRACT Pose (missing channels = rest). Pure in (pose, camera): no state carried between frames.
// How: the parts (copies of src/) still live in head space under `headSpace`. Each frame the rig gives the head's world matrix, viewOf() gives
// V (= the old ctx.cam), rules.js writes each part's one-entry inline track ("tracks become rule output"), and the parts update with
// headSpace held at identity and the camera expressed in the head's frame, so every part's math (written for head-at-origin) is unchanged.
// Static fitted data (hair verts, hat shape, face drawing, palettes) is read once from the spec's track files; nothing per-frame is.
import * as THREE from './three.js';
import * as Head from './head.js';
import * as Face from './face.js';
import * as Torso from './torso.js';
import * as Limbs from './limbs.js';
import { viewOf, focalOf } from './view.js';
import { RULES, faceRecord, hatRecord, bodyRecord } from './rules.js';
import { rig, withRest } from './rig.js';
import { hose } from './hose.js';
import { buildHair, buildBackHair } from './hair.js';
import { buildFacialHair } from './beard.js';
import { buildGlasses, buildHeldGlasses, LOWERED } from './glasses.js';
// Wardrobe (agent W, engine/WARDROBE_API.md): spec.hair = buildHair spec (or a style word), spec.facialHair = { kind, colour } (or a kind word),
// spec.glasses = { kind, colour, eyes, size } (or a kind word). Hair line -> the head track, extras under the head, beard/glasses ride the
// face record. rest.headY = the head centre ABOVE THE GROUND (clips.js hh() converts it to above-the-hem).
const wordSpec = (v, key) => typeof v === 'string' ? { [key]: v } : v;
const SPECS = new URL('../specs/', import.meta.url), SRC = new URL('../src/', import.meta.url), TRACKS = new URL('../tracks/', import.meta.url);
const getJSON = async u => { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(`character: ${u} (${r.status})`); return r.json(); };
const tryJSON = async u => { try { return await getJSON(u); } catch { return null; } };
// build table (STYLE_BIBLE section 7 / ENGINE_DESIGN section 3): leg length in D per character, default 1.2
const _upH = new THREE.Vector3();
const _hm = new THREE.Matrix4(), _hs = new THREE.Matrix4(), _ht = new THREE.Matrix4(); // seated depth pull (update1)
const KIT_HATS =new Set(['ballcap', 'beanie', 'chef', 'flatcap', 'headband', 'headscarf', 'strawhat']); // hats/_kit.js, rigid on the head
const LEGS = { engineer: 1.16, boss: 1.27, tycoon: 1.44, townsperson: 1.1, inspector: 1.2, passenger: 1.2 };
const LOOK_FRAME = RULES.look.frame;

// the character's static fitted data, one file per part (engineer: src/<part>Track.json, others tracks/<id>/<part>.json)
async function staticOf(id, part) {
  const SRCN = { head: 'headTrack.json', face: 'faceTrack.json', cap: 'capTrack.json', limbs: 'limbTrack.json' };
  if (id === 'engineer') return getJSON(new URL(SRCN[part], SRC));
  return (await tryJSON(new URL(`${id}/${part}.json`, TRACKS))) || (part === 'cap' ? {} : getJSON(new URL(SRCN[part], SRC)));
}
const nearestOf = (m, f) => { if (!m) return null; let b = null, bd = Infinity; for (const k in m) { if (!/^\d+$/.test(k)) continue; const d = Math.abs(+k - f); if (d < bd) { bd = d; b = m[k]; } } return b; };

async function moduleOf(dir, kind) {
  if (!/^[a-z_][a-z0-9_-]*$/i.test(String(kind))) throw new Error(`${dir}: bad kind "${kind}"`);
  return import(`./${dir}/${kind}.js`);
}

export async function createCharacter(specIn, opts = {}) {
  const spec = typeof specIn === 'string' ? { id: specIn, ...(await getJSON(new URL(`${specIn}.json`, SPECS))) } : { ...specIn };
  const id = spec.id || 'engineer';
  const root = new THREE.Group(); root.name = `character.${id}`;
  const headSpace = new THREE.Group(); headSpace.name = 'headSpace'; headSpace.matrixAutoUpdate = false;
  root.add(headSpace);

  // ---- static data -> one-entry inline tracks the rules rewrite every frame
  const [headT, faceT, capT, limbT] = await Promise.all(['head', 'face', 'cap', 'limbs'].map(p => staticOf(id, p)));
  const look = Array.isArray(headT.shadeAngle) ? { shadeAngle: headT.shadeAngle[LOOK_FRAME] ?? headT.shadeAngle[0], hairTint: headT.hairTint[LOOK_FRAME] ?? headT.hairTint[0] }
    : (() => { const f = nearestOf(headT.frames, LOOK_FRAME) || {}; return { shadeAngle: f.shadeAngle ?? 55.9, hairTint: f.hairTint ?? [85, 54, 34] }; })();
  const headTrack = { hair: headT.hair, hi: headT.hi, axis: headT.axis, e1: headT.e1, e2: headT.e2, skin: headT.skin, frames: { 0: look } };
  // hair from words: its line replaces the fitted one, its colours go to the head params, lookFrame 100 = painted ramp in those colours
  let hairParams = {}, hairExtras = null;
  if (spec.hair) {
    const hs = wordSpec(spec.hair, 'style');
    const h = buildHair(hs);
    Object.assign(headTrack, { hair: h.line.hair, hi: h.line.hi, axis: h.line.axis, e1: h.line.e1, e2: h.line.e2 });
    headTrack.frames = { 0: { shadeAngle: hs.shadeAngle ?? 64.3, hairTint: [119, 78, 48] } };
    const { track: _ht, ...hp } = h.headParams;
    hairParams = hp; hairExtras = h.extras;
  }
  const faceBase = { ...(faceT.frames[String(LOOK_FRAME)] || nearestOf(faceT.frames, LOOK_FRAME)) };
  delete faceBase.cam;
  const faceState = { ...faceBase, pose: [0, 0, 0], flip: 1 };
  const faceTrack = { surfR: faceT.surfR, palette: faceT.palette, frames: { 0: faceState } };
  const torsoRec = { x: 540, y: 960, D: 200, lean: 0, pitch: 0, yaw: 0, sy: 1, tz: RULES.body.tz };
  const torsoTrack = { 0: torsoRec };
  const limbKey = { visible: {}, hands: {} };
  const limbTrack = { width: spec.limbs?.width ?? limbT.width ?? .05, handR: limbT.handR ?? .0575, colours: limbT.colours || { ink: '#3a2a33', farLegKneel: '#5f4f5e', spec: '#c4c2d6' }, keys: { 0: limbKey } };

  // ---- parts, build order torso, limbs, head, face, hat (char.js: it fixes three's draw-order tie-break)
  const parts = {};
  const tp = { ...(spec.torso || {}), track: torsoTrack, lookFrame: LOOK_FRAME };
  parts.torso = await Torso.build(tp);
  parts.limbs = await Limbs.build({ ...(spec.limbs || {}), track: limbTrack, saw: false });
  parts.head = await Head.build({ lookFrame: LOOK_FRAME, ...hairParams, ...(spec.head || {}), track: headTrack });
  if (hairExtras) parts.head.add(hairExtras);
  // back of the head (agent FC / ENG4): hair mass over the upper back so a fitted patch (Boss, Passenger) isn't a blank egg from behind
  // FX1 (for agent SP): a FITTED-hair spec (no spec.hair) with no backHair key gets back hair by itself, coloured from its head's
  // hairDark / hairLit / litDir (= the inspector / passenger pattern). Explicit keys win; `backHair: false` = none; the engineer has his
  // own fitted back and is skipped; a spec with no hairDark has nothing to derive it from and is left alone.
  const autoBack = spec.backHair === undefined && !spec.hair && id !== 'engineer' && spec.head?.hairDark
    ? { color: spec.head.hairDark, ...(spec.head.hairLit ? { lit: spec.head.hairLit } : {}), ...(spec.head.litDir ? { litDir: spec.head.litDir } : {}), back: 96 } : null;
  if (spec.backHair || autoBack) parts.head.add(buildBackHair(spec.backHair || autoBack));
  parts.face = await Face.build({ id, ...(spec.face || {}), track: faceTrack, holdAfter: 0 });
  const beard = spec.facialHair && spec.facialHair !== 'none' ? buildFacialHair(wordSpec(spec.facialHair, 'kind')) : null;
  const glasses = spec.glasses && spec.glasses !== 'none' ? buildGlasses(wordSpec(spec.glasses, 'kind')) : null;
  const hatSpec = spec.hat || { kind: 'hickory' };
  const { kind: hatKind = 'hickory', ...hatParams } = hatSpec;
  // FX1: brimmed hats limit how far a look nods the head (eyes do the rest); spec hat.pitchMin (deg) overrides, null = no limit
  const BRIMS = new Set(['hickory', 'ballcap', 'flatcap', 'tophat', 'strawhat', 'officer', 'bowler']);
  const brimPitch = hatSpec.pitchMin !== undefined ? hatSpec.pitchMin : BRIMS.has(hatKind) && !(spec.hide || []).includes('hat') ? 18 : null;
  let hatMod = null, hatRec = { az: 0, el: 0, roll: 0, u: 0, v: -.38, s: 1 };
  if (hatKind !== 'none') {
    hatMod = await moduleOf('hats', hatKind);
    const shape = capT.shape;
    let track;
    if (hatKind === 'hickory') {
      const span = (capT.light?.spans || []).find(s => LOOK_FRAME >= s.from && LOOK_FRAME <= s.to);
      track = { shape, light: { default: span?.dir || capT.light?.default || [-.95, -.05, -.3], spans: span ? [{ ...span, from: -1e9, to: 1e9 }] : [] }, pose: { 0: hatRec } };
    } else track = { shape, pose: { 0: hatRec } };
    parts.hat = await hatMod.build({ ...hatParams, track, lookFrame: LOOK_FRAME });
    parts.hat.userData.track.pose = { 0: hatRec }; // whatever build copied, the record is ours
    // a hat that draws "on top" with depthTest off (hats/officer.js onTop) also drew over every OTHER character in a film: give it its depth
    // test back, still pulled .6 D toward the camera (over its own head, under anyone standing nearer). Draw order inside the hat is kept.
    parts.hat.traverse(o => {
      const m = o.isMesh && o.material;
      if (!m || m.depthTest !== false) return;
      m.depthTest = true;
      const pull = '{ vec4 _c = projectionMatrix * vec4(0.0, 0.0, -gl_Position.w + 0.6, 1.0); gl_Position.z = _c.z / _c.w * gl_Position.w; }';
      if (m.isShaderMaterial) m.vertexShader = m.vertexShader.replace(/}\s*$/, `  ${pull}\n}`);
      else m.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n${pull}`); };
      m.needsUpdate = true;
    });
  }
  // the char.js depth joins: face pulled toward the camera, head hull flattened to the rim plane
  joinDepth(parts);
  const hide = new Set(spec.hide || []);
  for (const k of ['torso', 'limbs', 'head', 'face', 'hat']) if (parts[k] && !hide.has(k)) headSpace.add(parts[k]);
  if (beard) { parts.beard = beard; headSpace.add(beard); }
  if (glasses) { parts.glasses = glasses; headSpace.add(glasses); }
  // ENG8 glasses states (pose.glasses 'on' | 'lowered' | 'off' | 'hand:R' | 'hand:L', pose.glassesLow 0..1): lowered levels are built on
  // first use (4 steps on ones, so a lowering hand carries them down), the held pair once (flat, front-on, beside the hand)
  const gSpec = glasses ? wordSpec(spec.glasses, 'kind') : null, gLow = {}, gSize = (gSpec?.size ?? 1.3) / 1.3;
  const lowMesh = q => { if (!gLow[q]) { gLow[q] = buildGlasses({ ...gSpec, size: (gSpec.size ?? 1.3) * (1 - .1 * q / 4), low: LOWERED * gSize * q / 4 }); gLow[q].visible = false; headSpace.add(gLow[q]); } return gLow[q]; };
  const held = glasses ? buildHeldGlasses(gSpec) : null;
  if (held) { held.visible = false; headSpace.add(held); parts.glassesHeld = held; }

  // ---- rest pose (body space)
  const S = parts.torso.userData.sockets;
  const legLen = spec.limbs?.legLen ?? LEGS[id] ?? 1.2, armLen = spec.limbs?.armLen ?? .95;
  const ankleY = limbTrack.width / 2 + .005;
  const hipY = -S.hipR[1] + ankleY + legLen * .93;
  const rest = { hipY, neckToHead: spec.body?.neckToHead ?? .35, armLen, legLen, slack: spec.limbs?.slack ?? .72, legSlack: spec.limbs?.legSlack ?? .45, walkSlack: spec.limbs?.walkSlack ?? .22, footLen: spec.limbs?.footLen ?? .17, ankleY,
    neck: S.neck, shoulderR: S.shoulderR, shoulderL: S.shoulderL, hipR: S.hipR, hipL: S.hipL };
  rest.headY = hipY + S.neck[1] + rest.neckToHead;

  // ---- per-frame scratch (no allocation in the loop beyond what the parts do)
  const R = {}, V = {}, vcam = new THREE.PerspectiveCamera();
  const headW = new THREE.Matrix4(), headInv = new THREE.Matrix4(), hemH = new THREE.Matrix4(), I = new THREE.Matrix4(), tInvM = new THREE.Matrix4();
  const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const toHead = a => { _v.set(a[0], a[1], a[2]).applyMatrix4(headInv); return [_v.x, _v.y, _v.z]; };
  const dirHead = a => { _v.set(a[0], a[1], a[2]).transformDirection(headInv); return [_v.x, _v.y, _v.z]; };
  const state = { V, rig: R, pose: null };

  // two passes when needed (agent Q): the DRAWN hip socket can sit higher than the rig's (2.5D torso); a planted foot it can't reach
  // lowers the hem by the measured shortfall and the frame is drawn again (pure: the same pose + camera always gives the same drop)
  function update(poseIn, t, camera, W, H) {
    // ENG5 prop pop guard: tools/make_film.mjs reads the frame's camera + the character roots (to find the props after them in the scene)
    if (typeof globalThis !== 'undefined') { const g = globalThis.__cz || (globalThis.__cz = { roots: new Set() }); g.roots.add(root); g.cam = camera; g.W = W; g.H = H; }
    const st = update1(poseIn, t, camera, W, H, 0);
    const need = st.legNeed * noDrop(withRest(poseIn, rest).body);
    return need > 1e-4 ? update1(poseIn, t, camera, W, H, Math.min(.35, need)) : st;
  }
  // 1 = the pelvis drop works, 0 = off: seated / kneeling (sit, kneel 0..1) or stretching legs (body.stretch 0..1)
  function noDrop(B) { const k = Math.max(B.sit || 0, B.kneel || 0, B.stretch || 0); return Math.max(0, 1 - Math.min(1, k)); }
  // HIP (2026-11-04): how far the hem must drop for a leg from a socket (h2 = horizontal distance^2, v = height above the foot) to reach.
  // Standing / sitting / kneeling (walkK 0): the old rule exactly (the leg is held at .98 x legLen, a hard drop past it). Walking / running
  // (walkK 1): his noodle legs stretch first (he isn't length-preserving, ENGINE_DESIGN 4: .69-1.46): the chord may grow past WALK_A x
  // legLen and eases (tanh, slope 1 at WALK_A, so the drop eases in from 0, no kink) into WALK_M x legLen; only what's left drops the hips.
  // At his ~1.65 D stride on a 1.2 D leg that keeps the hips high (no near split) and the planted feet exactly where they are. Blended by walkK.
  const WALK_A = 1.0, WALK_M = 1.13;
  // ENG8 (FABLE_REVIEW4 item 7): RUNNING (pose.running, compose.js) stretches to RUN_M = 1.32 x legLen first: his runs keep the head
  // level and the stride does the work; at 1.13 a kid's 1.5-legLen run stride dipped the hips ~.25 D on every contact (the head bobbed + tilted)
  const RUN_M = 1.32;
  function legDrop(h2, v, wk, M = WALK_M) {
    if (v <= 0) return 0;
    const at = c => h2 < c * c ? v - Math.sqrt(c * c - h2) : v;   // the drop that makes the chord exactly c
    const L0 = rest.legLen * .98, c = Math.sqrt(h2 + v * v);
    const d0 = c > L0 ? at(L0) : 0;
    if (wk <= 0) return d0;
    const a = rest.legLen * WALK_A, w = rest.legLen * (M - WALK_A);
    const d1 = c > a ? Math.max(0, at(a + w * Math.tanh((c - a) / w))) : 0;
    return d0 + (d1 - d0) * wk;
  }
  function update1(poseIn, t, camera, W, H, extra) {
    const P = withRest(poseIn, rest); state.legNeed = 0;
    rig(P, rest, S, R);
    // FX1 (blind3 item 5): a BRIMMED hat looking at something well below eye level: the head pitches down at most `brimPitch` deg
    // (spec hat.pitchMin, default 18: a look at a kid's face stays as it was, a look at the ground is limited); the eyes do the rest (look.gaze keeps the real target). A deeper nod showed the camera the
    // cap's top (a grey disc) and hid the face under the brim. Only the look target's height changes; yaw and keyed head.pitch stay.
    if (brimPitch != null && P.look && Array.isArray(P.look.at)) {
      _v.setFromMatrixPosition(R.head);
      const at = P.look.at, dh = Math.hypot(at[0] - _v.x, at[2] - _v.z), lim = brimPitch * Math.PI / 180;
      if (dh > 1e-3 && Math.atan2(at[1] - _v.y, dh) < -lim) {
        P.look = { ...P.look, at: [at[0], _v.y - Math.tan(lim) * dh, at[2]] };
        rig(P, rest, S, R);
      }
    }
    // pelvis drop (agent Q): a planted foot farther than the leg reaches pulls the hips DOWN (never the foot up): the hem lowers by what
    // makes the farthest leg exactly .98 x legLen long, capped at .3 D. Continuous in the pose (0 until a leg runs out), so no pops.
    {
      let drop = 0;
      const wk = Math.min(1, Math.max(0, P.walkK || 0));
      for (const [k, sk] of [['legR', 'hipR'], ['legL', 'hipL']]) {
        if (P[k]?.vis === false) continue;
        _v.set(S[sk][0], S[sk][1], S[sk][2]).applyMatrix4(R.hem);
        const e = R.targets[k].end, h2 = (_v.x - e[0]) ** 2 + (_v.z - e[2]) ** 2, v = _v.y - e[1];
        drop = Math.max(drop, Math.min(.3, legDrop(h2, v, wk)));
      }
      drop += extra;
      // Q3: a SEATED / kneeling body rests on its seat (the seat holds the hips, the feet are placed by the clip): no drop, so a lean-back
      // clip (wince, shock_pop) can't sink him .34 D into the bench; body.stretch (hop_bounce) = legs stretch instead of the hips dropping
      drop *= noDrop(P.body);
      if (drop > 1e-5) { P.body = { ...P.body, hipY: (P.body.hipY ?? rest.hipY) - drop }; rig(P, rest, S, R); }
    }
    headW.copy(R.head); headInv.copy(headW).invert();
    viewOf(V, headW, camera, W, H);
    const F = focalOf(camera, H);
    // the camera in the head's frame; headSpace at identity while the parts update
    camera.updateMatrixWorld();
    vcam.fov = camera.fov; vcam.aspect = camera.aspect; vcam.near = camera.near; vcam.far = camera.far; vcam.updateProjectionMatrix();
    _p.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(headInv); vcam.position.copy(_p);
    camera.matrixWorld.decompose(_s, _q, _s); headW.decompose(_p, vcam.quaternion, _s); vcam.quaternion.invert().multiply(_q);
    vcam.position.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(headInv);
    vcam.updateMatrixWorld(true);
    headSpace.matrix.copy(I); root.updateMatrixWorld(true);
    const project = v => { const p = _v.copy(v).project(vcam); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H]; };
    const ctx = { frame: 0, cam: V, camera: vcam, THREE, project, focal: F, width: W, height: H, distance: V.distance, freeCamera: true, t };

    // torso: the rig's hem frame, seen by the camera, damped elevation
    hemH.copy(headInv).multiply(R.hem);
    Object.assign(torsoRec, bodyRecord(hemH, vcam, W, H, F, { sy: P.body.squash ?? 1 }));
    Torso.update(0, { ...ctx, root: parts.torso });
    // head, face, hat
    // fix1b: world up in head space, so head.js hairFrame can tell the head's own pitch (cancelled for the hair) from the shot's elevation
    Head.update(0, { ...ctx, root: parts.head, upHead: _upH.set(0, 1, 0).transformDirection(headInv) });
    const fr = faceRecord(V, P.face || {});
    faceState.pose = fr.pose; faceState.flip = fr.flip;
    // gaze (MO2, item 9): a look target off to one side of the head AS THE CAMERA SEES IT slides the pupils that way (look_l / look_r,
    // snapped, never tweened; flip mirrors the drawing so the side follows it). Only neutral eyes (open, smug) take it.
    let faceCh = P.face;
    // ENG4: listeners' pupils go to the speaker's head (pose.listenGaze, written by make_film through timeline.base) unless the film's
    // own look gives a gaze right now (look.gaze wins); the head does not turn for it
    const gz = (P.look && P.look.gaze) || P.listenGaze;
    if (gz && P.face && (P.face.eyes == null || P.face.eyes === 'open' || P.face.eyes === 'smug') && P.face.gaze !== false) {
      const g = toHead(gz), vl = Math.hypot(vcam.position.x, vcam.position.y, vcam.position.z) || 1;
      const v = [vcam.position.x / vl, vcam.position.y / vl, vcam.position.z / vl];
      let r = [v[2], 0, -v[0]]; const rl = Math.hypot(r[0], r[2]) || 1; r = [r[0] / rl, 0, r[2] / rl];
      const gl = Math.hypot(...g) || 1, sx = (g[0] * r[0] + g[2] * r[2]) / gl;            // + = screen right of the head
      if (Math.abs(sx) > .22) faceCh = { ...P.face, eyes: sx * (fr.flip || 1) > 0 ? 'look_r' : 'look_l' };
      state.gazeSide = Math.abs(sx) > .22 ? Math.sign(sx) : 0;
    } else state.gazeSide = 0;
    Face.update(0, { ...ctx, root: parts.face, face: faceCh });
    parts.face.visible = fr.on && !hide.has('face');
    if (beard) { beard.update(fr); beard.visible = fr.on; }
    // ENG8: which glasses draw on the face: 'on' (or no channel) = the worn pair, 'lowered' / glassesLow > 0 = slid down the nose,
    // 'off' / 'hand:X' = none on the face (the held pair is placed after the arms)
    const gState = typeof P.glasses === 'string' ? P.glasses : 'on';
    if (glasses) {
      const onFace = gState === 'on' || gState === 'lowered', lowK = Math.max(0, Math.min(1, P.glassesLow ?? (gState === 'lowered' ? 1 : 0)));
      const q = onFace ? Math.round(lowK * 4) : -1;
      for (const [k, m] of [[0, glasses], ...Object.entries(gLow).map(([k, m]) => [+k, m])]) m.visible = false;
      if (q >= 0) { const m = q === 0 ? glasses : lowMesh(q); m.update(fr); m.visible = fr.on; }
    }
    if (parts.hat) {
      const mountY = parts.hat.userData.track?.shape?.mount?.y ?? parts.hat.userData.params?.mount?.y;
      const L = hatKind === 'hickory' ? RULES.hat.L : (mountY ?? .33) * .99;
      Object.assign(hatRec, hatRecord(V, RULES.hat, L));
      if (hatKind !== 'hickory') hatRec.s = 1;
      // pose hat channels (cap_lift / hat_launch): lift [x, y, z] in D on the head's screen axes (x right, y up), tilt = roll (deg), spin = az
      const ph = P.hat || {};
      if (ph.lift) { const r = V.roll * Math.PI / 180, lx = ph.lift[0] || 0, ly = ph.lift[1] || 0;
        hatRec.u += lx * Math.cos(r) + ly * Math.sin(r); hatRec.v += lx * Math.sin(r) - ly * Math.cos(r); }
      if (ph.tilt) hatRec.roll += ph.tilt;
      if (ph.spin) hatRec.az += ph.spin;
      hatMod.update(0, { ...ctx, root: parts.hat });
      // fix1b: a kit hat (rigid on the head, follow 1) turns with the hair's pitch follow (head.js hairFrame; identity in level shots),
      // so under a steep head pitch it stays seated on the hair it covers. The 2.5D layer hats (hickory, bowler, tophat, officer, follow 0) keep their own el gain.
      const hq = parts.head.userData.hairQ, pv = parts.hat.userData.pivot;
      if (hq && pv && KIT_HATS.has(hatKind) && (parts.hat.userData.params?.follow ?? 1) && parts.hat.userData.params?.followHair !== false && Math.abs(hq.w) < 1 - 1e-9) {
        pv.position.applyQuaternion(hq); pv.quaternion.premultiply(hq);
      }
      parts.hat.visible = P.hat?.on !== false && !hide.has('hat');
    }
    // limbs: sockets on the DRAWN torso (so they stay attached to it), targets from the rig, hose between
    const body = parts.torso.userData.body;
    const sock = k => { _v.set(...S[k]).applyMatrix4(body.matrix); return [_v.x, _v.y, _v.z]; };
    const camH = [vcam.position.x, vcam.position.y, vcam.position.z];
    const dist2 = a => (a[0] - camH[0]) ** 2 + (a[1] - camH[1]) ** 2 + (a[2] - camH[2]) ** 2;
    const out = { visible: {}, hands: {}, spec: 0, handR: limbTrack.handR, farLegGrey: false };
    // a hand target inside the DRAWN torso (short-armed / wide builds: Pip's hanging hands vanished into his jumper) is pushed out sideways
    // to the slab's side + a hand radius; hands in front of or behind the slab are left alone (that is occlusion, not a clip)
    const tm = parts.torso.userData.mesh;
    let tInv = null, tBox = null;
    if (tm && tm.visible !== false) { tm.updateWorldMatrix(true, false); if (!tm.geometry.boundingBox) tm.geometry.computeBoundingBox(); tBox = tm.geometry.boundingBox; tInv = tInvM.copy(tm.matrixWorld).invert(); }
    const outOfTorso = (e, side) => {
      if (!tInv) return e;
      _p.set(e[0], e[1], e[2]).applyMatrix4(tInv);
      const cx = (tBox.min.x + tBox.max.x) / 2, cz = (tBox.min.z + tBox.max.z) / 2, hx = (tBox.max.x - tBox.min.x) / 2, hz = (tBox.max.z - tBox.min.z) / 2;
      // also hands hanging just under the hem: the forearm would run inside the body (Pip's arms hid in his jumper at rest)
      const y0 = tBox.min.y - .6 * (tBox.max.y - tBox.min.y), qz = (_p.z - cz) / hz, qx = (_p.x - cx) / hx;
      const want = Math.sqrt(Math.max(0, 1 - qz * qz)) + .3;
      if (_p.y < y0 || _p.y > tBox.max.y || Math.abs(qz) >= 1 || Math.abs(qx) >= want) return e;
      const sg = Math.abs(qx) > .05 ? Math.sign(qx) : (side === 'R' ? -1 : 1);
      _p.x = cx + sg * hx * want;
      _p.applyMatrix4(tm.matrixWorld); return [_p.x, _p.y, _p.z];
    };
    // ONE shoulder (agent Q): clips key hands against the rig's shoulder (rest.shoulderX through the hem matrix), but the arm is drawn
    // from the socket on the DRAWN 2.5D torso, which sits elsewhere (yaw/elevation damped, squash). A body-space hand is moved by the
    // same offset, so every clip's hand keeps its place relative to the shoulder that actually draws it. World hands (rails, hand-overs)
    // stay put. Then a smooth reach limit: past .9 x armLen the chord eases into 1.06 x armLen (tanh, no snap), so no arm over-stretches.
    const rigSock = sk => { _v.set(S[sk][0], S[sk][1] * (P.body.squash ?? 1), S[sk][2]).applyMatrix4(hemH); return [_v.x, _v.y, _v.z]; };
    const reachIn = (s, e, L, a = .9, m = 1.06) => {
      const d = [e[0] - s[0], e[1] - s[1], e[2] - s[2]], c = Math.hypot(d[0], d[1], d[2]);
      if (c <= a * L || c < 1e-9) return e;
      const c2 = a * L + (m - a) * L * Math.tanh((c - a * L) / ((m - a) * L));
      return [s[0] + d[0] * c2 / c, s[1] + d[1] * c2 / c, s[2] + d[2] * c2 / c];
    };
    // head space: head centre at the origin, radius .5; the camera at camH. Screen right = Y x view, screen up = view x right.
    const templeAt = (side, c) => {
      const vl = Math.hypot(c[0], c[1], c[2]) || 1, v = [c[0] / vl, c[1] / vl, c[2] / vl];
      let r = [v[2], 0, -v[0]]; const rl = Math.hypot(r[0], r[2]) || 1; r = [r[0] / rl, 0, r[2] / rl];
      const u = [v[1] * r[2] - v[2] * r[1], v[2] * r[0] - v[0] * r[2], v[0] * r[1] - v[1] * r[0]];
      const sx = (side === 'L' ? 1 : -1) * r[0], sg = Math.abs(sx) > 1e-3 ? Math.sign(sx) : -Math.sign(r[2] || 1); // side-on: the hair side
      return [0, 1, 2].map(i => r[i] * sg * .54 + u[i] * .05 + v[i] * .12);   // the hand just touches the outline (radius .5)
    };
    // ENG8: screen basis in head space (r right, u up, v toward the camera) and the hand's own side on screen (sg, like templeAt)
    const camBasis = (c, side) => {
      const vl = Math.hypot(c[0], c[1], c[2]) || 1, v = [c[0] / vl, c[1] / vl, c[2] / vl];
      let r = [v[2], 0, -v[0]]; const rl = Math.hypot(r[0], r[2]) || 1; r = [r[0] / rl, 0, r[2] / rl];
      const u = [v[1] * r[2] - v[2] * r[1], v[2] * r[0] - v[0] * r[2], v[0] * r[1] - v[1] * r[0]];
      const sx = (side === 'L' ? 1 : -1) * r[0], sg = Math.abs(sx) > 1e-3 ? Math.sign(sx) : -Math.sign(r[2] || 1);
      return { r, u, v, sg };
    };
    const specsAt = (side, c, dy) => { const { r, u, v, sg } = camBasis(c, side);
      return [0, 1, 2].map(i => r[i] * sg * .27 + u[i] * (-.03 + dy) + v[i] * .66); };
    const sstep = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
    const clearOfFace = (e, side, c, w) => {
      const vl = Math.hypot(c[0], c[1], c[2]) || 1, v = [c[0] / vl, c[1] / vl, c[2] / vl];
      let r = [v[2], 0, -v[0]]; const rl = Math.hypot(r[0], r[2]) || 1; r = [r[0] / rl, 0, r[2] / rl];
      const u = [v[1] * r[2] - v[2] * r[1], v[2] * r[0] - v[0] * r[2], v[0] * r[1] - v[1] * r[0]];
      const ex = e[0] * r[0] + e[1] * r[1] + e[2] * r[2], ey = e[0] * u[0] + e[1] * u[1] + e[2] * u[2], ez = e[0] * v[0] + e[1] * v[1] + e[2] * v[2];
      const sx = (side === 'L' ? 1 : -1) * r[0], sg = Math.abs(sx) > 1e-3 ? Math.sign(sx) : -Math.sign(r[2] || 1);
      const want = .5 + .14, deficit = Math.max(0, want - sg * ex) * sstep(-want, -want + .25, sg * ex);   // head radius .5 + a hand radius; a hand outside on the OTHER side stays
      const k = w * sstep(-.85, -.6, ey) * (1 - sstep(.35, .6, ey)) * sstep(-.35, 0, ez);
      if (deficit <= 0 || k <= 0) return e;
      const m = sg * deficit * k; return [e[0] + r[0] * m, e[1] + r[1] * m, e[2] + r[2] * m];
    };
    const arm = (k, sk) => {
      const T = R.targets[k], s = sock(sk), side = k === 'armR' ? 'R' : 'L', A = P[k] || {};
      let e = toHead(T.end);
      if ((A.in || 'body') === 'body') { const r = rigSock(sk); e = [e[0] + s[0] - r[0], e[1] + s[1] - r[1], e[2] + s[2] - r[2]]; }
      // reach (hand-overs, stage.html): { at: world point, w: 0..1 } pulls the hand to a world point
      if (A.reach && A.reach.w > 0) { const g = toHead(A.reach.at), w = Math.min(1, A.reach.w); e = [e[0] + (g[0] - e[0]) * w, e[1] + (g[1] - e[1]) * w, e[2] + (g[2] - e[2]) * w]; }
      // temple (Q3, hand_to_temple): the hand goes BESIDE the drawn head disc on this hand's side as the camera sees it, at temple
      // height, a touch toward the camera; weight A.temple (0..1) rides with the clip's hand move, so in/out stay smooth
      if (A.temple > 0) { const g = templeAt(side, camH), w = Math.min(1, A.temple); e = [e[0] + (g[0] - e[0]) * w, e[1] + (g[1] - e[1]) * w, e[2] + (g[2] - e[2]) * w]; }
      // drink (MO2, sip): the hand goes in front of the drawn mouth as the camera sees it (the face decal slides toward the camera),
      // .3 D out of the head toward the camera, so the cup it holds draws over the mouth
      if (A.drink > 0) { const vl = Math.hypot(...camH) || 1, v = camH.map(x => x / vl), w = Math.min(1, A.drink);
        const g = [v[0] * .78, v[1] * .78 - .3, v[2] * .78]; e = [e[0] + (g[0] - e[0]) * w, e[1] + (g[1] - e[1]) * w, e[2] + (g[2] - e[2]) * w]; }
      // clear (FX1, wave / raised point): a raised hand that would draw over the face as the camera sees it goes BESIDE the head
      // outline on its own side (screen), continuous in the pose (the push = how far it is inside the disc, faded by height and by depth:
      // a hand behind the head is hidden by it, a hand at the chest is under the face). Weight A.clear (0..1) rides with the clip.
      if (A.clear > 0) e = clearOfFace(e, side, camH, Math.min(1, A.clear));
      // specs (ENG8, glasses_lower / glasses_off / glasses_on): the hand at the OUTER edge of the glasses on its own side as the camera
      // sees it, in front of the face (like drink), A.specsDy D screen-up (lowering slides it down); weight A.specs rides the clip
      if (A.specs > 0) { const g = specsAt(side, camH, A.specsDy || 0), w = Math.min(1, A.specs); e = [e[0] + (g[0] - e[0]) * w, e[1] + (g[1] - e[1]) * w, e[2] + (g[2] - e[2]) * w]; }
      e = reachIn(s, outOfTorso(e, side), rest.armLen);
      const h = hose(s, e, { len: rest.armLen, slack: rest.slack, bend: dirHead(T.bend) });
      return { pts: h.pts, hand: h.end, vis: T.vis, s, over: A.over };
    };
    // walking (P.walkK 0..1, the host's root speed): legs straighter (slack .45 bowed short legs on the bob) and the far leg goes pale (his f1028-32)
    const walkK = Math.min(1, Math.max(0, P.walkK || 0));
    const legSlack = rest.legSlack + (rest.walkSlack - rest.legSlack) * walkK;
    const leg = (k, sk) => {
      // the same smooth reach limit as the arms (1.2 -> 1.25 x legLen, after the pelvis drop: planted feet beat the reach number): a seated/low hip with a far planted foot no longer stretches to
      // the hose's hard 1.25 stop; the tab moves with the ankle it hangs from
      const T = R.targets[k], s = sock(sk), a0 = toHead(T.end), ankle = reachIn(s, a0, rest.legLen, 1.2, 1.25);
      if (!extra && T.vis !== false) { // the drawn socket's shortfall in world (vertical solve, like the pelvis drop above)
        _v.set(s[0], s[1], s[2]).applyMatrix4(headW); const e = T.end, h2 = (_v.x - e[0]) ** 2 + (_v.z - e[2]) ** 2, v = _v.y - e[1];
        state.legNeed = Math.max(state.legNeed, legDrop(h2, v, walkK, P.running ? RUN_M : WALK_M));
      }
      const h = hose(s, ankle, { len: rest.legLen, slack: legSlack, bend: dirHead(T.bend) });
      const toe = R.facing, ty = Math.sin((T.toe || 0) * Math.PI / 180);
      const tipW = [T.end[0] + toe[0] * rest.footLen, T.end[1] + ty * rest.footLen, T.end[2] + toe[2] * rest.footLen];
      const tip = toHead(tipW), dv = [h.end[0] - a0[0], h.end[1] - a0[1], h.end[2] - a0[2]];
      return { pts: h.pts, foot: [h.end, [tip[0] + dv[0], tip[1] + dv[1], tip[2] + dv[2]]], vis: T.vis, s };
    };
    const aR = arm('armR', 'shoulderR'), aL = arm('armL', 'shoulderL'), lR = leg('legR', 'hipR'), lL = leg('legL', 'hipL');
    // ENG8: glasses in a hand: the flat front-on pair faces the camera, its outer edge in the drawn hand (the pair sits toward the body's
    // middle on screen), a touch up and toward the camera so it draws over the fist. Never on the face, never over one eye.
    if (held) {
      const hs = gState === 'hand:R' ? 'R' : gState === 'hand:L' ? 'L' : null, a = hs === 'R' ? aR : hs === 'L' ? aL : null;
      held.visible = !!a && a.vis !== false;
      if (held.visible) {
        const { r, u, v, sg } = camBasis(camH, hs), h = a.hand, hw0 = held.userData.halfW;
        const p = [0, 1, 2].map(i => h[i] - r[i] * sg * hw0 * .8 + u[i] * .05 + v[i] * .1);
        held.matrix.set(r[0], u[0], v[0], p[0], r[1], u[1], v[1], p[1], r[2], u[2], v[2], p[2], 0, 0, 0, 1);
        held.matrixWorldNeedsUpdate = true;
      }
    }
    // near = the side closer to the camera (limbs.js draws its near hand full size, the far one smaller)
    const rNear = dist2(aR.s) <= dist2(aL.s);
    const rLegNear = dist2(lR.s) <= dist2(lL.s);
    const [nA, fA] = rNear ? [aR, aL] : [aL, aR], [nL, fL] = rLegNear ? [lR, lL] : [lL, lR];
    const farLegPose = P[rLegNear ? 'legL' : 'legR'] || {};
    out.farLegGrey = P.farLegGrey === true || farLegPose.tone === 'far' || (P.farLegGrey !== false && spec.limbs?.farLegWalk !== false && walkK > .5);
    out.nearArm = nA.pts; out.farArm = fA.pts; out.visible.nearArm = nA.vis; out.visible.farArm = fA.vis;
    out.hands.near = nA.hand; out.hands.far = fA.hand;
    out.nearLeg = nL.pts; out.farLeg = fL.pts; out.nearFoot = nL.foot; out.farFoot = fL.foot;
    out.visible.nearLeg = nL.vis; out.visible.farLeg = fL.vis;
    Limbs.setPose(parts.limbs, out);
    // draw order (agent Q): an arm whose hand is in front of the torso's front surface, seen from the camera, draws over the torso
    // (the 2.5D torso is not where real depth puts it: a hand reaching toward the camera at ~60 deg fell behind the vest). The depth
    // nudge ramps in smoothly with how far in front the hand is and fades along the arm from the shoulder (uRamp), so nothing pops.
    if (tInv) {
      const lm = parts.limbs.userData;
      _p.set((tBox.min.x + tBox.max.x) / 2, (tBox.min.y + tBox.max.y) / 2, (tBox.min.z + tBox.max.z) / 2).applyMatrix4(tm.matrixWorld);
      const tc = [_p.x, _p.y, _p.z], cd = [camH[0] - tc[0], camH[1] - tc[1], camH[2] - tc[2]], cl = Math.hypot(...cd) || 1;
      // the slab's half depth along the view: its x/z half sizes (head space ~ torso space scale) weighted by the view direction
      _s.set(cd[0] / cl, 0, cd[2] / cl).transformDirection(tInv);
      const half = Math.hypot((tBox.max.x - tBox.min.x) / 2 * _s.x, (tBox.max.z - tBox.min.z) / 2 * _s.z) || .2;
      const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
      const frontOf = a => {
        const h = a.hand, dep = ((h[0] - tc[0]) * cd[0] + (h[1] - tc[1]) * cd[1] + (h[2] - tc[2]) * cd[2]) / cl - half * .25;
        return .45 * sm(-.04, .12, dep);
      };
      const base = { nearArm: spec.limbs?.front?.nearArm ?? 0, farArm: spec.limbs?.front?.farArm ?? 0 };
      for (const [mk, hk, a] of [['nearArm', 'near', nA], ['farArm', 'far', fA]]) {
        const f = Math.max(base[mk], frontOf(a));
        lm.mats[mk].uniforms.uFront.value = f;
        if (f > base[mk]) lm.mats[mk].uniforms.uRamp.value = .3;
        else lm.mats[mk].uniforms.uRamp.value = mk === 'nearArm' ? (spec.limbs?.frontRamp ?? .15) : 0;
        lm.hands[hk].material.uniforms.uFront.value = f;
      }
      if (lm.massTube) lm.massTube.mesh.material.uniforms.uFront.value = Math.max(base.nearArm, frontOf(nA));
    }
    // back to the world
    headSpace.matrix.copy(headW);
    // DEPTH (2026-11-04, blind3 f352-359): the 2.5D torso is drawn RULES.body.tz (.42 D) behind the head along the view, so the head
    // draws over it; for a SEATED body that put the torso + skirt ~.42 D behind the real hips, right in the bench's backrest and inside
    // the seat plank, and the depth test hid them (from a low close camera the plank and backrest won; a push-in flipped it). The
    // whole drawn character (head, torso, limbs, hat, together, so its own order is unchanged) is scaled about the camera so the DRAWN
    // torso lands at the rig's real torso depth (+ 6 cm toward the camera). Scaling about the eye leaves every pixel where it was: only
    // the depth against the world changes. Weighted by body.sit (sit_down / stand_up blend), standing bodies are untouched; a body
    // behind a bench or table is still hidden by it (it is pulled only onto its own real place), props stay at the real hands.
    const sitK = Math.min(1, Math.max(0, P.body.sit || 0));
    if (sitK > 0 && tInv) {
      camera.updateMatrixWorld();
      const ci = camera.matrixWorldInverse, depthOf = p => -p.applyMatrix4(ci).z;
      _p.set((tBox.min.x + tBox.max.x) / 2, (tBox.min.y + tBox.max.y) / 2, (tBox.min.z + tBox.max.z) / 2).applyMatrix4(tm.matrixWorld).applyMatrix4(headW);
      const dDrawn = depthOf(_p);
      _v.setFromMatrixPosition(R.hem); _s.set(S.neck[0], S.neck[1], S.neck[2]).applyMatrix4(R.hem); _v.add(_s).multiplyScalar(.5);
      const dTrue = depthOf(_v) - .06;
      const pull = sitK * Math.max(0, dDrawn - dTrue);
      if (pull > 1e-5 && dDrawn > pull + .05) {
        const k = (dDrawn - pull) / dDrawn;
        _p.setFromMatrixPosition(camera.matrixWorld);
        _hm.makeTranslation(-_p.x, -_p.y, -_p.z).premultiply(_hs.makeScale(k, k, k)).premultiply(_ht.makeTranslation(_p.x, _p.y, _p.z));
        headSpace.matrix.premultiply(_hm);
      }
    }
    root.updateMatrixWorld(true);
    // the drawn hands in world (props follow these, so the hand stays on its prop)
    const hw = a => { _v.set(a[0], a[1], a[2]).applyMatrix4(headW); return [_v.x, _v.y, _v.z]; };
    state.hands = { R: hw(aR.hand), L: hw(aL.hand) };
    // cane walk (MO2): a prop { in:'world', tip, caneHand } from compose: its top on the DRAWN hand, its axis (local -Y) aimed at the
    // planted tip, so the tip stays put while the body walks past it (the stage places world props from at + rot)
    for (const pp of Object.values(P.props || {})) {
      if (!pp || pp.in !== 'world' || !pp.tip || !pp.caneHand) continue;
      const h = state.hands[pp.caneHand]; pp.at = [...h];
      const d = new THREE.Vector3(pp.tip[0] - h[0], pp.tip[1] - h[1], pp.tip[2] - h[2]);
      if (d.lengthSq() < 1e-8) continue;
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), d.normalize()), eu = new THREE.Euler().setFromQuaternion(q, 'XYZ');
      pp.rot = [eu.x * 180 / Math.PI, eu.y * 180 / Math.PI, eu.z * 180 / Math.PI];
    }
    state.pose = P;
    return state;
  }

  // where things are, for hosts (shadows, framing): world points
  const where = () => {
    const hem = new THREE.Vector3().setFromMatrixPosition(R.hem), head = new THREE.Vector3().setFromMatrixPosition(R.head);
    const feet = ['legR', 'legL'].map(k => new THREE.Vector3(...R.targets[k].end));
    return { hem, head, feet, root: new THREE.Vector3().setFromMatrixPosition(R.root), floor: state.pose?.floorY ?? 0 };
  };
  return { id, root, rest, parts, update, where, V, rig: R };
}

const depthAt = z => `{ vec4 _c = projectionMatrix * vec4(mvPosition.xy, ${z}, 1.0); gl_Position.z = _c.z / _c.w * gl_Position.w; }`;
function joinDepth(parts) {
  const m = parts.face.children[0].material;
  m.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n${depthAt('mvPosition.z + 0.0500')}`); };
  m.needsUpdate = true;
  const hull = parts.head.getObjectByName('head.hull');
  if (hull) {
    hull.material.vertexShader = `void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  float z0 = (modelViewMatrix * vec4(0., 0., 0., 1.)).z + (-0.0120);
  ${depthAt('z0')}
}`;
    hull.material.needsUpdate = true;
  }
}

export default { createCharacter };
