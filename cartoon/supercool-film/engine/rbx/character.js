// engine/rbx/character.js: the Roblox character on charsys (WP-C1, 2026-11-12). Same interface as engine/character.js createCharacter:
//   createRbxCharacter(spec) -> { id, root, rest, parts, update(pose, t, camera, W, H) -> state, where(), V, rig, light }
// The SAME pose machinery drives it (engine/rig.js: root, hem, neck, head matrices + hand / foot targets with bend poles; clips, walks,
// heights, places, look, say, blink from compose.js), drawn as 15 rigid bevelled parts (engine/rbx/body.js), solved with two-bone IK
// (engine/rbx/ik.js), lit by engine/rbx/shade.js from the set's light, with the Roblox head + charsys face from engine/rbx/head.js (WP-C2).
//  - lower torso: the hem position with 40 % of the body's twist / lean / bend (the waist takes the rest); upper torso: the full hem
//    matrix (so the rig's neck, head and body-space hands stay exactly where the clips put them).
//  - legs from the LOWER torso's hip sockets, arms from the upper torso's shoulders; a planted foot past reach lowers the hips (pelvis
//    drop, continuous, capped .3 D); feet flat on the floor when planted, following the shin in the air (blend by the ankle's height).
//  - hands inside the torso block (chest poses written for the charsys slab) are pushed out in front of it (continuous in the pose).
//  - state = { V, rig, pose, hands: { R, L } (the DRAWN hand centres: props follow these), feet } ; where() = the drawn feet.
// Pure in (pose, camera): nothing is carried between frames, so the shadow pass (world/shadow.js) and seeking work as for charsys.
import * as THREE from '../three.js';
import { rig, withRest } from '../rig.js';
import { viewOf } from '../view.js';
import { STUD, buildBody } from './body.js';
import { solve } from './ik.js';
import { makeLight, setLight, partMaterial } from './shade.js';

const SPECS = new URL('../../specs/rbx/', import.meta.url);
const DEG = Math.PI / 180;
const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

// part colours from a cast spec (WP-C2's specs/rbx/*.json: skin, wear { top, topColor, pants, shoes, sleeves }); spec.colors wins per part
export function coloursOf(spec) {
  const w = spec.wear || {}, skin = spec.skin || '#f2c99b', top = w.topColor || '#3a6fd8', pants = w.pants || '#2a2d3a';
  const bare = ['tank', 'vest', 'none', 'bikini', 'dress_strap'].includes(w.top) || w.sleeves === 'none';
  const short = w.sleeves === 'short' || ['tee', 'tshirt', 'polo'].includes(w.top);
  const shortsK = w.pantsKind === 'shorts' || w.pantsKind === 'skirt';
  return {
    skin, torso: top, arms: bare ? skin : top, forearms: bare || short ? skin : top, hands: skin,
    pants, legs: pants, shins: shortsK ? skin : pants, shoes: w.shoes || pants,
    ...(spec.colors || {}),
  };
}

export async function createRbxCharacter(specIn, opts = {}) {
  const spec = typeof specIn === 'string' ? { id: specIn, ...(await (await fetch(new URL(`${specIn}.json`, SPECS))).json()) } : { ...specIn };
  // WP-CR: creatures (beast, pale, totem) are painted AI Studio cards on the same rig and interface (engine/rbx/card.js)
  if (spec.body === 'card') return (await import('./card.js')).createCard(spec, opts);
  const id = spec.id || 'rbx';
  const root = new THREE.Group(); root.name = `character.${id}`;
  const scale = spec.build?.scale ?? 1, s = STUD * scale;
  const light = makeLight(THREE, spec.light || {});
  // CF1 + CF2 (ISSUES.md): part colours and clothes details come from wear.js (sleeves, collars, belts, prints, soles); coloursOf is the
  // fallback if wear.js fails to load
  let WEAR = null;
  try { WEAR = await import('./wear.js'); } catch (e) { (globalThis.__czWarn || console.warn)(`rbx character: wear.js failed (${e?.message || e})`); }
  const C = WEAR?.wearColours ? { ...WEAR.wearColours(spec), ...(spec.colors || {}) } : coloursOf(spec);
  // CF1: each part's material kind (mats.js KINDS: skin, cloth, plastic, hair): bare skin parts are skin, shoes plastic, the rest cloth
  const matFor = (hex, name) => partMaterial(THREE, hex, light, { name, kind: /^hand/.test(name) || /^neck/.test(name) || String(hex).toLowerCase() === String(C.skin).toLowerCase() ? 'skin' : /^foot/.test(name) ? 'plastic' : 'cloth' });
  const { meshes: M, L } = buildBody(THREE, C, matFor, { s, build: { torso: spec.build?.width ?? 1, limb: spec.build?.limb ?? 1 } });
  for (const m of Object.values(M)) root.add(m);
  // clothes details: meshes in each part's own frame, ridden by that part (no page = no canvas: skipped, the body math is the same)
  if (WEAR?.wearDetails && typeof document !== 'undefined') {
    try {
      const { matFactory } = await import('./mats.js'), rich = matFactory(light);
      for (const d of WEAR.wearDetails(spec, L, (hex, kind, o) => o?.map || o?.vertexColors || o?.polygonOffset ? rich(hex, kind, o) : partMaterial(THREE, hex, light, { kind, name: kind })))
        M[d.part]?.add(d.mesh);
    } catch (e) { (globalThis.__czWarn || console.warn)(`rbx character ${spec.id || ''}: wear details failed (${e?.message || e})`); }
  }

  // ---- the head (WP-C2): its own module; its standard materials are swapped for the body's shader so it is lit the same way
  let head = null;
  try {
    const H = await import('./head.js');
    head = await H.buildRbxHead(spec, { material: (hex, kind) => partMaterial(THREE, hex, light, { noAo: true, name: 'head.' + kind, kind }) });
    if (H.kitReady) await H.kitReady?.();
  } catch (e) { (globalThis.__czWarn || console.warn)(`rbx character ${id}: head.js failed (${e?.message || e}), plain head drawn`); }
  if (!head) {
    const g = new THREE.Group(), geo = new THREE.CylinderGeometry(.4, .4, .76, 40, 1); g.add(new THREE.Mesh(geo, partMaterial(THREE, C.skin, light, { noAo: true })));
    head = { group: g, H: .76, R: .4, update() {} };
  }
  // a closed head / hair mesh whose triangles wind inward (normals pointing in) is drawn from inside: whatever is behind its front
  // (the neck) showed through the face. Detected from the geometry (sum of normal . (p - centre) < 0) and turned outside in.
  head.group.traverse(o => {
    if (!o.isMesh || !o.geometry?.index || o.geometry.attributes.color || o.material?.name !== 'head.skin') return;
    const g = o.geometry, p = g.attributes.position, nA = g.attributes.normal; if (!nA) return;
    g.computeBoundingBox(); const c = new THREE.Vector3(); g.boundingBox.getCenter(c);
    let sdot = 0; for (let i = 0; i < p.count; i += 7) sdot += (p.getX(i) - c.x) * nA.getX(i) + (p.getY(i) - c.y) * nA.getY(i) + (p.getZ(i) - c.z) * nA.getZ(i);
    // winding: the first triangle's face normal against its vertex normals
    const ix = g.index.array, va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
    let wdot = 0; for (let t = 0; t < ix.length; t += 3 * 37) { va.fromBufferAttribute(p, ix[t]); vb.fromBufferAttribute(p, ix[t + 1]); vc.fromBufferAttribute(p, ix[t + 2]);
      const fn = vb.sub(va).cross(vc.sub(va)); wdot += (fn.x * (va.x - c.x) + fn.y * (va.y - c.y) + fn.z * (va.z - c.z)); }
    if (wdot < 0) { const a = g.index.array; for (let t = 0; t < a.length; t += 3) { const k = a[t + 1]; a[t + 1] = a[t + 2]; a[t + 2] = k; } g.index.needsUpdate = true; }
    if (sdot < 0 || wdot < 0) { g.computeVertexNormals(); }
  });
  head.group.traverse(o => {
    const m = o.isMesh && o.material;
    if (!m || !(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) return;
    const n = partMaterial(THREE, m.color ? '#' + m.color.getHexString() : '#ffffff', light, { noAo: true, vc: m.vertexColors, name: m.name, kind: m.name });
    if (m.polygonOffset) { n.polygonOffset = true; n.polygonOffsetFactor = m.polygonOffsetFactor; n.polygonOffsetUnits = m.polygonOffsetUnits; }
    n.transparent = m.transparent; n.opacity = m.opacity; n.side = m.vertexColors ? THREE.DoubleSide : m.side; n.depthWrite = m.depthWrite;
    o.material = n; m.dispose();
  });
  const headG = new THREE.Group(); headG.name = 'rbx.headSpace'; headG.matrixAutoUpdate = false; headG.add(head.group);
  if (scale !== 1) head.group.scale.setScalar(scale);
  root.add(headG);
  const headH = (head.H ?? .76) * scale;

  // ---- rest (body space: origin at the hem = the hip line, +X his left, +Z facing); the clips read these
  const S = {
    neck: [0, (L.neckY - L.hipY) * s, 0],
    shoulderR: [-L.shoulderX * s * (spec.build?.width ?? 1), (L.shoulderY - L.hipY) * s, 0], shoulderL: [L.shoulderX * s * (spec.build?.width ?? 1), (L.shoulderY - L.hipY) * s, 0],
    hipR: [-L.hipX * s, 0, 0], hipL: [L.hipX * s, 0, 0],
  };
  const legLen = L.legLen * s, armLen = L.armLen * s, ankleY = L.ankleY * s;
  const rest = { hipY: L.hipY * s, neckToHead: headH / 2 + .004 * scale, armLen, legLen, slack: .72, legSlack: .45, walkSlack: .22, footLen: .45 * s, ankleY,
    neck: S.neck, shoulderR: S.shoulderR, shoulderL: S.shoulderL, hipR: S.hipR, hipL: S.hipL, kind: 'rbx' };
  rest.headY = rest.hipY + S.neck[1] + rest.neckToHead;

  // ---- per frame
  const R = {}, V = {};
  const state = { V, rig: R, pose: null, hands: null, feet: null };
  const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), lowerM = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
  const W3 = (M4, p) => { _v.set(p[0], p[1], p[2]).applyMatrix4(M4); return [_v.x, _v.y, _v.z]; };
  const D3 = (M4, d) => { _v.set(d[0], d[1], d[2]).transformDirection(M4); return [_v.x, _v.y, _v.z]; };
  const place = (mesh, x, y, p) => {   // basis x, y (unit, perpendicular), z = x cross y; at p
    _x.set(...x); _y.set(...y); _z.crossVectors(_x, _y).normalize(); _y.crossVectors(_z, _x).normalize();
    mesh.matrix.makeBasis(_x, _y, _z).setPosition(p[0], p[1], p[2]); mesh.matrixWorldNeedsUpdate = true;
  };
  const noDrop = B => Math.max(0, 1 - Math.min(1, Math.max(B.sit || 0, B.kneel || 0, B.stretch || 0)));
  const DROP_AT = 1.0;          // a planted leg longer than 1.0 x legLen lowers the hips (the IK's soft angle keeps a hint of bend)

  function lowerOf(P) {   // the lower torso: hem position, root turn + 40 % of the body's twist / lean / bend
    const B = P.body;
    _v.setFromMatrixPosition(R.hem);
    lowerM.makeRotationY((P.root.ry || 0) * DEG).setPosition(_v)
      .multiply(_r.makeRotationY(.4 * (B.twist || 0) * DEG)).multiply(_r.makeRotationZ(-.4 * (B.lean || 0) * DEG)).multiply(_r.makeRotationX(.4 * (B.bend || 0) * DEG));
    return lowerM;
  }

  // ---- WP-M (2026-11-12): SMOOTH MOTION. The shared charsys clips are cartoon-snappy (a wave raises the arm 180 deg in 2 frames): fine
  // for bendy hoses, a jerk on rigid Roblox limbs. So each limb's JOINT rotations (upper segment in its parent frame: hem for arms, lower
  // torso for legs; lower segment relative to the upper) are filtered over time: the pose is solved at neighbouring frames (opts.poseAt,
  // the stage's own pose function, so props / hand-overs / walkK match) and averaged with a Hann window whose half-width grows with how fast
  // that limb turns there (0 = untouched below ~18 deg/frame, up to MW frames for snaps). Symmetric in time (no lag, gestures still peak
  // on their frame), pure in t (any frame renders the same alone), clips and every cartoon film untouched. Without opts.poseAt = as before.
  const MW = 8;                                       // the widest half-window (frames): a 180 deg snap is spread to ~22 deg/frame
  // V4-GAIT (2026-11-13): legs ease into / out of each plant (see filtered()); tau in frames; lab: globalThis.__rbxGaitV3 = true = off
  const GAIT_ANCHOR = !(typeof globalThis !== 'undefined' && globalThis.__rbxGaitV3), GAIT_TAU = 1.6, HBW = 4, GAIT_HIPS = !!globalThis.__rbxGaitHips, GAIT_END = !!globalThis.__rbxGaitEnd;   // both lab-only, off: tried 2026-11-13, made it worse
  const LIMBS = ['armR', 'armL', 'legR', 'legL'];
  const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _e = new THREE.Vector3();
  const qOfBasis = (x, y) => { _x.set(...x); _y.set(...y); _z.crossVectors(_x, _y).normalize(); _y.crossVectors(_z, _x).normalize(); return new THREE.Quaternion().setFromRotationMatrix(_r.makeBasis(_x, _y, _z)); };
  const qAng = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b)))) / DEG;
  const sm01 = (a, b, x) => sm(a, b, x);
  // one frame's raw limb solve, in local frames (for the filter): { armR: { qU (in parent), qL (in upper), vis } ... }
  function localLimbs(P) {
    const out = {};
    for (const [k, ik, par, , , qF] of solveLimbs(P)) {
      _qp.setFromRotationMatrix(_r.extractRotation(par));
      const qU = qOfBasis(ik.x, ik.yU), qL = qOfBasis(ik.x, ik.yL);
      // ct: how much this hand touches something placed in the world or on the face (a world hand, a reach, temple / drink / specs):
      // there the raw solve wins (the prop / face contact stays exact), faded over the window
      const A = P[k] || {}, c01 = v => Math.min(1, Math.max(0, +v || 0));
      const ct = k[0] === 'a' ? Math.max(A.in === 'world' ? 1 : 0, c01(A.reach?.w), c01(A.temple), c01(A.drink), c01(A.specs)) : 0;
      out[k] = { qU: _qp.clone().invert().multiply(qU), qL: qU.clone().invert().multiply(qL), ...(qF ? { qF: _qp.clone().invert().multiply(qF) } : {}), ct,
        ...(k[0] === 'l' ? { end: ik.end.slice(), h: ik.end[1] - (P.floorY ?? 0) - ankleY } : {}) };
    }
    return out;
  }
  // the filter: per limb { qU, qL } world-relative locals for the CENTER frame, or null when this limb needs no smoothing here
  function filtered(t, center) {
    if (typeof opts.poseAt !== 'function') return null;
    const taps = [];
    for (let k = -MW; k <= MW; k++) {
      if (k === 0) { taps.push(center); continue; }
      let Pk = null; try { Pk = opts.poseAt(Math.max(0, t + k / 30)); } catch { Pk = null; }
      taps.push(Pk ? localLimbs(withRest(Pk, rest)) : center);
    }
    const res = {};
    for (const L0 of LIMBS) {
      const c = center[L0]; if (!c) continue;
      // speed near t: the largest tap-to-tap turn (upper or lower), the far edge of the window faded out (continuous in t)
      const keys = c.qF ? ['qU', 'qL', 'qF'] : ['qU', 'qL'];
      let S = 0, C = 0;
      for (let i = 0; i < taps.length - 1; i++) {
        const a = taps[i][L0], b = taps[i + 1][L0]; if (!a || !b) continue;
        let v = 0; for (const q of keys) if (a[q] && b[q]) v = Math.max(v, qAng(a[q], b[q]));
        const fade = 1 - sm01(MW - 2, MW + .5, Math.abs(i + .5 - MW));
        S = Math.max(S, v * fade); C = Math.max(C, Math.max(a.ct || 0, b.ct || 0) * fade);
      }
      // half-width (frames): arms from ~14 deg/frame; legs only past a run's own stride speed (planted feet must not skate), so the
      // procedural walk / run cycles stay exact and only snaps (run starts, sit / stand) are spread
      const leg = L0[0] === 'l', h = MW * (leg ? sm01(18, 44, S) : sm01(14, 36, S)) * (1 - C);
      if (h < .02) continue;
      // Hann weights, quaternions sign-chained outward from the centre, then normalised sums
      const out = {};
      for (const q of keys) {
        const sum = new THREE.Quaternion(0, 0, 0, 0);
        for (const dir of [1, -1]) {
          let prev = c[q];
          for (let j = dir > 0 ? 0 : 1; j <= MW; j++) {
            const w = j < h + 1 ? .5 * (1 + Math.cos(Math.PI * j / (h + 1))) : 0; if (w <= 0) break;
            const T = taps[MW + dir * j][L0] || c;
            _qa.copy(T[q] || c[q]); if (_qa.dot(prev) < 0) _qa.set(-_qa.x, -_qa.y, -_qa.z, -_qa.w);
            sum.x += _qa.x * w; sum.y += _qa.y * w; sum.z += _qa.z * w; sum.w += _qa.w * w; prev = _qa.clone();
          }
        }
        out[q] = sum.normalize();
      }
      if (leg && GAIT_ANCHOR) {
        // V4-GAIT: a swinging leg next to a plant (lift-off, touch-down, walk start / stop, run end) is pulled toward the raw pose of the
        // nearest planted frame on each side (in its own local frame), critically damped in the frame distance: the knee eases out of
        // and into the plant instead of jumping between the raw planted solve and the filtered swing (planted frames stay raw)
        const pl = i => { const a = taps[i][L0]; if (!a || a.h == null) return false; if (a.h <= .03) return true;
          if (a.h > .11) return false; for (const j of [i - 1, i + 1]) { const b = taps[j]?.[L0]; if (b?.end && Math.hypot(a.end[0] - b.end[0], a.end[1] - b.end[1], a.end[2] - b.end[2]) < .002) return true; } return false; };
        if (pl(MW)) continue;   // the centre is planted: the raw solve (update() uses it)
        let A = -1, Bn = -1;
        for (let i = MW - 1; i >= 0; i--) if (pl(i)) { A = i; break; }
        for (let i = MW + 1; i < taps.length; i++) if (pl(i)) { Bn = i; break; }
        const g = d => (1 + d / GAIT_TAU) * Math.exp(-d / GAIT_TAU) * (1 - sm01(MW - 2.5, MW, d));
        const gA = A >= 0 ? g(MW - A) : 0, gB = Bn >= 0 ? g(Bn - MW) : 0, gw = Math.max(gA, gB);
        if (gw > 1e-4) {
          for (const q of keys) {
            const qa = A >= 0 ? taps[A][L0][q] : null, qb = Bn >= 0 ? taps[Bn][L0][q] : null; if (!qa && !qb) continue;
            const tq = qa && qb ? qa.clone().slerp(qb, gB / (gA + gB)) : (qa || qb).clone();
            out[q] = out[q].clone().slerp(tq, gw);
          }
          // the foot itself eases toward the plant spot (world): it leaves from and lands on the exact planted point
          const ea = A >= 0 ? taps[A][L0].end : null, eb = Bn >= 0 ? taps[Bn][L0].end : null, u = ea && eb ? gB / (gA + gB) : 0;
          out.aEnd = ea && eb ? ea.map((v, i) => v + (eb[i] - v) * u) : (ea || eb).slice();
          out.aW = gw; out.anchor = true;
        }
      }
      res[L0] = out;
    }
    return res;
  }

  function update(poseIn, t, camera, W, H) {
    if (typeof globalThis !== 'undefined') { const g = globalThis.__cz || (globalThis.__cz = { roots: new Set() }); g.roots.add(root); g.cam = camera; g.W = W; g.H = H; }
    // the neighbouring frames first (they overwrite the rig), the centre frame last
    let F = null;
    if (typeof opts.poseAt === 'function') { const c0 = localLimbs(withRest(poseIn, rest)); F = filtered(t, c0); }
    const P = withRest(poseIn, rest);
    // V4-GAIT: the walk's hip bob (a .3 legLen sawtooth that drops in 2.5 f, compose -> body.hipY) bends a planted rigid leg 30-40 deg
    // in one frame. Near a walk (any walkK in +-HBW frames) the hip height is Hann-averaged over +-HBW frames, weighted by that walkK:
    // planted feet stay on their world spot (the legs re-solve), standing / sitting poses away from a walk are untouched
    if (GAIT_HIPS && typeof opts.poseAt === 'function' && P.body) {
      let sw = 0, sy = 0, wk = 0;
      for (let k = -HBW; k <= HBW; k++) {
        let Pk = null; if (k === 0) Pk = P; else { try { Pk = withRest(opts.poseAt(Math.max(0, t + k / 30)), rest); } catch { Pk = null; } }
        if (!Pk?.body) continue;
        const w = .5 * (1 + Math.cos(Math.PI * k / (HBW + 1)));
        sw += w; sy += w * (Pk.body.hipY ?? rest.hipY); wk = Math.max(wk, (Pk.walkK || 0) * (1 - sm01(HBW - 1.5, HBW + .5, Math.abs(k))));
      }
      if (sw > 0 && wk > 0) P.body.hipY = (P.body.hipY ?? rest.hipY) + (sy / sw - (P.body.hipY ?? rest.hipY)) * Math.min(1, wk);
    }
    const SOL = solveLimbs(P);
    // torso, neck, head
    M.torsoL.matrix.copy(lowerM); M.torsoU.matrix.copy(R.hem); M.neck.matrix.copy(R.neck);
    headG.matrix.copy(R.head);
    for (const k of ['torsoL', 'torsoU', 'neck']) M[k].matrixWorldNeedsUpdate = true;
    headG.matrixWorldNeedsUpdate = true;
    viewOf(V, R.head, camera, W, H);
    // the face: the charsys channel (expressions, blinks, visemes from compose / facetime); a look target slides the eyes a little
    let gazeU = 0;
    const gz = (P.look && P.look.gaze) || P.listenGaze;
    if (gz) { _m.copy(R.head).invert(); const g = W3(_m, gz); const a = Math.atan2(g[0], Math.max(.2, g[2])); gazeU = Math.max(-.12, Math.min(.12, a * .12)); }
    head.update?.(P.face || {}, { gazeU, t, pose: P });

    // limbs: the raw solve, or (WP-M) the filtered joint rotations rebuilt from the same socket: rigid segments stay joined
    const hands = {}, feet = {}, floor = P.floorY ?? 0, fwd = R.facing;
    for (const [k, ikRaw, par, sock, seg, qFoot] of SOL) {
      const sd = k.slice(3), arm = k[0] === 'a', f = F && F[k];
      let ik = ikRaw, qU = null, qL = null;
      if (f) {
        _qp.setFromRotationMatrix(_r.extractRotation(par));
        qU = _qp.clone().multiply(f.qU); qL = qU.clone().multiply(f.qL);
        const x = _x.set(1, 0, 0).applyQuaternion(qU).toArray(), yU = _y.set(0, 1, 0).applyQuaternion(qU).toArray(), yL = _e.set(0, 1, 0).applyQuaternion(qL).toArray();
        const mid = [sock[0] - yU[0] * seg, sock[1] - yU[1] * seg, sock[2] - yU[2] * seg];
        ik = { x, yU, yL, mid, end: [mid[0] - yL[0] * seg, mid[1] - yL[1] * seg, mid[2] - yL[2] * seg] };
        if (!arm) {
          // a foot on the floor stays exactly where the raw solve puts it (no skating): the filtered end is pulled back onto the raw one by
          // how planted the raw foot is, and the leg re-solved with the filtered knee as its pole (the knee's swing stays smooth)
          // V4-GAIT: an anchored swing leg (eased toward its plants) skips the height pull (it brought the raw jerk back on the frame
          // before touch-down); its foot is only kept out of the floor
          if (f.anchor) {
            const end = ik.end.map((v, i) => v + (f.aEnd[i] - v) * (GAIT_END ? f.aW : 0)), pole = [ik.mid[0] - sock[0], ik.mid[1] - sock[1], ik.mid[2] - sock[2]];
            end[1] = Math.max(end[1], floor + ankleY);
            ik = solve(sock, end, seg, pole, ikRaw.q || pole); qU = null; qL = null;
          }
          const pw = f.anchor ? 0 : 1 - sm(.03, .3, ikRaw.end[1] - floor - ankleY);
          if (pw > 0) {
            const end = ik.end.map((v, i) => v + (ikRaw.end[i] - v) * pw), pole = [ik.mid[0] - sock[0], ik.mid[1] - sock[1], ik.mid[2] - sock[2]];
            ik = solve(sock, end, seg, pole, ikRaw.q || pole);   // solve() uses the pole's part perpendicular to the chord
            if (f.qF) { _qp.setFromRotationMatrix(_r.extractRotation(par)); f.qFw = _qp.clone().multiply(f.qF).slerp(qFoot, pw); }
            qU = null; qL = null;
          }
        }
      }
      const U = M[(arm ? 'armU' : 'legU') + sd], Lo = M[(arm ? 'armL' : 'legL') + sd];
      if (qU) { U.matrix.compose(_v.set(...sock), qU, _e.set(1, 1, 1)); U.matrixWorldNeedsUpdate = true; Lo.matrix.compose(_v.set(...ik.mid), qL, _e.set(1, 1, 1)); Lo.matrixWorldNeedsUpdate = true; }
      else { place(U, ik.x, ik.yU, sock); place(Lo, ik.x, ik.yL, ik.mid); }
      const vis = R.targets[k].vis !== false;
      if (arm) {
        if (qL) { M['hand' + sd].matrix.compose(_v.set(...ik.end), qL, _e.set(1, 1, 1)); M['hand' + sd].matrixWorldNeedsUpdate = true; }
        else place(M['hand' + sd], ik.x, ik.yL, ik.end);
        for (const p of ['armU', 'armL', 'hand']) M[p + sd].visible = vis;
        hands[sd] = ik.end;
        continue;
      }
      // foot (solveLimbs footQ), filtered with its leg
      if (f && f.qFw) _q.copy(f.qFw);
      else if (f && f.qF) { _qp.setFromRotationMatrix(_r.extractRotation(par)); _q.copy(_qp).multiply(f.qF); } else _q.copy(qFoot);
      M['foot' + sd].matrix.compose(_v.set(...ik.end), _q, _x.set(1, 1, 1)); M['foot' + sd].matrixWorldNeedsUpdate = true;
      for (const p of ['legU', 'legL', 'foot']) M[p + sd].visible = vis;
      feet[sd] = ik.end;
    }
    return finish(P, hands, feet);
  }

  // rig + pelvis drop + lower torso + the four limbs' IK for one pose: [[limb, ik, parent matrix (copy), socket, segment]] (R = this pose)
  // ---- V4-HF (gruss V3 item 1): the head turns on its NECK JOINT, not on its centre, and never sinks into the torso.
  // rig.js turns the head about its centre (right for the soft charsys heads). On a rigid Roblox head that swung the lower half (and the
  // old neck stub under it) out through the chest or the back on every nod, crouch and bend. Here the drawn head keeps rig.js's turn
  // (keyed yaw / pitch / roll + look.at) but pivots at the bottom centre of the head, on the torso top; the torso squash (kneel .85) no
  // longer pushes it down into the rigid torso; and if the turn would tip the head's rim into the torso top, the head rises by exactly
  // that much (it rocks on the shoulders' line like a real head on a neck). The lift is a smooth max over sample points, so it is
  // continuous in the pose and pure (no state between frames). R.neck / R.head are rewritten, so hands to the face, bubbles, gaze and
  // where() all follow the drawn head.
  // PH: the joint sits a quarter of the head up from its bottom (jaw level, like a real neck: the head's lower edge swings a little
  // instead of the whole head rocking on its rim); SINK: the rim may dip this far into the torso top, whose rounded edge hides it
  // (a bigger lift opened a gap that read as a stalk neck, V4-HF pose sheet run 1)
  const HB = headH / 2, PIV = .004 * scale, PH = headH * .25, SINK = .07 * scale;
  const tHW = L.torsoW / 2 * s * (spec.build?.width ?? 1), tHD = L.torsoD / 2 * s;
  const HPTS = [];
  {
    const hr = (th, y) => head.radiusAt ? head.radiusAt(th, y) : (head.R ?? .4), H0 = head.H ?? .76;
    for (const fy of [-.5, -.49, -.47, -.43, -.36, -.26, -.12]) for (let j = 0; j < 32; j++) {
      const th = j / 32 * Math.PI * 2, y = fy * H0, r = hr(th, y);
      HPTS.push(new THREE.Vector3(r * Math.sin(th) * scale, y * scale + HB, r * Math.cos(th) * scale));   // relative to the pivot
    }
  }
  const _hq = new THREE.Quaternion(), _hp = new THREE.Vector3(), _hs = new THREE.Vector3(), _hm = new THREE.Matrix4();
  function neckHead() {
    _hm.copy(R.neck).invert().multiply(R.head);
    _hm.decompose(_hp, _hq, _hs);
    R.neck.copy(R.hem).multiply(_m.makeTranslation(S.neck[0], S.neck[1], S.neck[2]));   // unsquashed: the rigid torso's top
    let lift = 0;
    for (const p of HPTS) {
      _v.copy(p); _v.y -= PH; _v.applyQuaternion(_hq);
      // how far this point would sit under the head's rest bottom, less what the torso top's rounded edge hides (SINK)
      const below = -(_v.y + PH) - SINK; if (below <= 0) continue;
      // weight 1 over the torso top, fading to 0 within .06 D outside it (continuous as a point crosses the edge)
      const ox = Math.max(0, Math.abs(_v.x) - tHW), oz = Math.max(0, Math.abs(_v.z) - tHD), w = 1 - sm(0, .06 * scale, Math.hypot(ox, oz));
      lift = Math.max(lift, below * w);
    }
    R.head.copy(R.neck).multiply(_m.makeTranslation(0, PIV + PH + lift, 0)).multiply(_r.makeRotationFromQuaternion(_hq)).multiply(_m.makeTranslation(0, HB - PH, 0));
    R.headLift = lift;
  }
  // ---- V4-SEAT (2026-11-13, gruss V3 item 5 "parts get into each other"): a seated rbx body rests ON the seat. The shared sit clips
  // (clips.js seatHem / seatFeet) were made for the thin cartoon legs: the hem goes to seat + ankleY + 1.5 cm and the feet .62 D ahead on
  // the floor. The rbx thigh is a .58 D block and the leg only 1.07 D long, so the thighs sank .3-.45 D into chairs and sofas and,
  // with the feet pulled to the floor, pointed steeply down through the seat (films raised `seat` to compensate, which only made the legs
  // dangle further down). Here, while body.sit is on (not kneeling): the seat TOP under the thighs is read from the set itself (vertical
  // rays, set meshes only, cached per spot: the set is static, so this is pure in the pose), the hem goes to seatTop + thigh half
  // thickness + 1.2 cm, the thighs lie level (pitched down only as far as a desk / table underside above the knees needs), the shins
  // hang down to the floor (angled forward when the floor is closer, dangling when it is further). No seat found under the thighs = the
  // clip's own seat height with the same rbx thickness. Blended by body.sit, so sit_down / stand_up ease in and out as before.
  // Lab switch: globalThis.__rbxSeatV3 = true = the old behaviour.
  const SEAT_FIT = !(typeof globalThis !== 'undefined' && globalThis.__rbxSeatV3);
  const THIGH = L.limbD / 2 * s * (spec.build?.limb ?? 1), SEAT_GAP = .012 * scale;
  const seatCache = new Map(), _ray = new THREE.Raycaster(), _ro = new THREE.Vector3(), _rd = new THREE.Vector3();
  let seatMeshes = null;
  const setMeshes = () => {
    if (seatMeshes && seatMeshes.length) return seatMeshes;
    let sc = root; while (sc.parent) sc = sc.parent;
    const out = [];
    sc.traverse(o => {
      if (!o.isMesh || o.isSprite || !o.geometry) return;
      for (let a = o; a; a = a.parent) { if (!a.visible || /^character\./.test(a.name || '')) return; }
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m && ((m.transparent && (m.opacity ?? 1) < .5) || m.depthWrite === false || m.visible === false)) return;
      out.push(o);
    });
    seatMeshes = out; return out;
  };
  const castY = (x, y, z, dirY, far) => {   // first set hit along +-Y from (x, y, z): its height, or null
    _ray.set(_ro.set(x, y, z), _rd.set(0, dirY, 0)); _ray.near = 0; _ray.far = far;
    // only faces turned toward the ray count (a seat top seen from above, a desk underside from below): a ray that starts inside a
    // box (a drawer the knees are already in) would otherwise read that box's far face as a seat / desk
    for (const hit of _ray.intersectObjects(setMeshes(), false)) {
      if (hit.face) { _e.copy(hit.face.normal).transformDirection(hit.object.matrixWorld); if (_e.y * dirY > -.2) continue; }
      return hit.point.y;
    }
    return null;
  };
  // the furniture at a seated spot: seat top under the thighs, desk underside above the knees, floor under the feet (cached per spot)
  function seatAt(hx, hy, hz, fw, floor0) {
    const key = `${Math.round(hx / .01)},${Math.round(hz / .01)},${Math.round(Math.atan2(fw[0], fw[2]) / DEG * 2)},${Math.round(hy / .05)}`;
    if (seatCache.has(key)) return seatCache.get(key);
    const sx = fw[2], sz = -fw[0], hw = L.hipX * s;
    let top = null, near = null;
    for (const side of [-1, 1]) for (const ahead of [.06, .16, .3]) {
      const x = hx + fw[0] * ahead * scale + sx * side * hw, z = hz + fw[2] * ahead * scale + sz * side * hw;
      const y = castY(x, hy + .25 * scale, z, -1, hy + .25 * scale - floor0 + .05);
      if (y == null || y >= hy + .2 * scale || y <= floor0 + .12 * scale) continue;
      if (ahead < .1) near = Math.max(near ?? -1e9, y); else top = Math.max(top ?? -1e9, y);
    }
    let ceil = null, floor = floor0;
    if (top != null) {
      for (const ahead of [.4, .55]) for (const side of [-1, 1]) {
        const x = hx + fw[0] * ahead * scale + sx * side * hw, z = hz + fw[2] * ahead * scale + sz * side * hw;
        const c = castY(x, top + .03, z, 1, 1.4 * scale); if (c != null) ceil = Math.min(ceil ?? 1e9, c);
      }
      const fx = hx + fw[0] * .62 * scale, fz = hz + fw[2] * .62 * scale, fy = castY(fx, top - .1 * scale, fz, -1, top - floor0 + .3);
      if (fy != null && fy < top - .15 * scale) floor = fy;
    }
    const r = { top, near, ceil, floor };
    seatCache.set(key, r); return r;
  }
  function seatW(P) { const B = P.body || {}; return SEAT_FIT ? Math.min(1, Math.max(0, (B.sit || 0) - (B.kneel || 0))) : 0; }
  // hips: before the pelvis drop (rig re-run with the new hipY); returns the furniture for seatLegs
  function seatHips(P) {
    const w = seatW(P); if (w < 1e-3) return null;
    _v.setFromMatrixPosition(R.hem); const hx = _v.x, hy = _v.y, hz = _v.z, fw = R.facing || [0, 0, 1];
    const floor0 = P.floorY ?? 0, F = seatAt(hx, hy, hz, fw, floor0);
    // the clip's hem is seatHem(seat) = seat + ankleY + .015 for this body: its seat when the set has none under the thighs
    // the set's seat is trusted (hips may go DOWN to it: films raised `seat` to fight the sinking) only when the surface right at the
    // hips and the one under the thighs agree (one cushion); otherwise (shallow seat: the thigh rays pass its front edge; or a backrest
    // under the hips) the hips only go UP: the higher of the set's top and the clip's seat
    const clipSeat = hy - ankleY - .015;
    const top = F.top != null && F.near != null && Math.abs(F.near - F.top) < .1 * scale ? F.top : Math.max(F.top ?? -1e9, clipSeat);
    const want = top + THIGH + SEAT_GAP, dy = (want - hy) * w;
    if (Math.abs(dy) > 1e-5) { P.body = { ...P.body, hipY: (P.body?.hipY ?? rest.hipY) + dy }; rig(P, rest, S, R); }
    return { w, top, ceil: F.ceil, floor: F.floor };
  }
  // legs: after lowerOf, the seated knee + ankle targets (level thighs, shins down), blended into the rig's leg targets by w
  function seatLegs(P, st) {
    if (!st) return;
    const fw = R.facing || [0, 0, 1], seg = L.legSeg * s, foot = st.floor + ankleY;
    for (const sd of ['R', 'L']) {
      const T = R.targets['leg' + sd]; if (!T || T.vis === false) continue;
      const sock = W3(lowerM, S['hip' + sd]);
      // thigh pitch: level, down only as far as a desk underside needs (knee top 2 cm under it), never more than 50 deg
      let kneeY = sock[1];
      if (st.ceil != null) kneeY = Math.min(kneeY, st.ceil - THIGH - .02 * scale);
      kneeY = Math.max(kneeY, sock[1] - seg * Math.sin(50 * DEG));
      const dyK = sock[1] - kneeY, fwdK = Math.sqrt(Math.max(0, seg * seg - dyK * dyK));
      const knee = [sock[0] + fw[0] * fwdK, kneeY, sock[2] + fw[2] * fwdK];
      // shin: straight down; when the floor is closer than a shin, the ankle stays on the floor and the shin leans forward
      // and never further back than the clip's own feet (a shin hanging straight down from a knee that is not yet past the front of a
      // bed / box seat went into its side: whistle f1832, tyler on the bed): the shin leans forward up to ~49 deg to reach that line
      const w = st.w, e = T.end, dClip = (e[0] - sock[0]) * fw[0] + (e[2] - sock[2]) * fw[2];
      let drop = Math.min(seg, kneeY - foot), aF = Math.sqrt(Math.max(0, seg * seg - drop * drop));
      const aWant = Math.min(seg * .75, dClip - fwdK);
      if (aWant > aF) { aF = aWant; drop = Math.min(drop, Math.sqrt(seg * seg - aF * aF)); }
      const ank = [knee[0] + fw[0] * aF, kneeY - Math.max(drop, 0), knee[2] + fw[2] * aF];
      T.end = [e[0] + (ank[0] - e[0]) * w, e[1] + (ank[1] - e[1]) * w, e[2] + (ank[2] - e[2]) * w];
      // pole: toward the wanted knee (solve() keeps its part perpendicular to the chord)
      const pk = [knee[0] - sock[0], knee[1] - sock[1], knee[2] - sock[2]], b = T.bend || fw;
      T.bend = [b[0] + (pk[0] - b[0]) * w, b[1] + (pk[1] - b[1]) * w, b[2] + (pk[2] - b[2]) * w];
    }
  }
  function solveLimbs(P, _unused) {
    rig(P, rest, S, R);
    const seatSt = seatHips(P);
    // pelvis drop: the farthest planted foot at most DROP_AT x legLen from its hip socket (hips move down, never the foot up)
    {
      let drop = 0;
      lowerOf(P);
      for (const [k, sk] of [['legR', 'hipR'], ['legL', 'hipL']]) {
        if (P[k]?.vis === false) continue;
        const h = W3(lowerM, S[sk]), e = R.targets[k].end, h2 = (h[0] - e[0]) ** 2 + (h[2] - e[2]) ** 2, v = h[1] - e[1], c = legLen * DROP_AT;
        if (v > 0 && h2 + v * v > c * c) drop = Math.max(drop, Math.min(.3, h2 < c * c ? v - Math.sqrt(c * c - h2) : v));
      }
      drop *= noDrop(P.body);
      if (drop > 1e-5) { P.body = { ...P.body, hipY: (P.body.hipY ?? rest.hipY) - drop }; rig(P, rest, S, R); }
    }
    neckHead();
    lowerOf(P);
    const out = [];
    // arms
    const hemInv = _m.copy(R.hem).invert(), hx = (L.torsoW / 2 + (L.armW ?? L.limbW) * .46) * s, hz = (L.torsoD / 2 + (L.armD ?? L.limbD) * .46) * s, yTop = (L.neckY - L.hipY + .1) * s;
    const clearTorso = e => {   // a hand inside the torso block goes out in front of it (or behind, if it is in the back half)
      const b = W3(hemInv, e);
      if (b[1] < -.2 * s || b[1] > yTop) return e;
      const k = 1 - sm(hx - .25 * s, hx, Math.abs(b[0]));
      if (k <= 0) return e;
      if (b[2] > -.3 * hz) b[2] += Math.max(0, hz - b[2]) * k; else b[2] -= Math.max(0, hz + b[2]) * k;
      return W3(R.hem, b);
    };
    const armSeg = L.armSeg * s, legSeg = L.legSeg * s;
    for (const sd of ['R', 'L']) {
      const k = 'arm' + sd, T = R.targets[k], A = P[k] || {};
      const sock = W3(R.hem, S['shoulder' + sd]);
      let e = T.end;
      // ARMS HANG (charsys clips key hands for .95 D hose arms that hang bowed and out): a body-space hand is re-read relative to the
      // shoulder: below the shoulder its outward offset shrinks (Roblox arms hang close to the body) and its distance is mapped onto
      // the longer rigid arm (r^.6: a hanging hand reaches near full length, a chest hand stays near). Monotonic and smooth, so clip
      // arcs keep their timing; world hands (rails, reach, hand-overs) are untouched.
      if ((A.in || 'body') === 'body' && !A.raw) {
        const sh = S['shoulder' + sd], hb = W3(_m.copy(R.hem).invert(), e);
        let o = [hb[0] - sh[0], hb[1] - sh[1], hb[2] - sh[2]];
        const down = sm(0, .35, -o[1]), out = o[0] * Math.sign(sh[0]);
        if (out > 0) o[0] -= Math.sign(sh[0]) * out * .97 * down;   // CF1: hanging arms close to the body (was .85: they splayed)
        // (a soft floor of .55 x armLen: a hand path that passes the shoulder swings round it instead of through it, no elbow flip)
        const r = Math.hypot(...o), rr = Math.min(1.25, r / .95), r1 = armLen * .985 * Math.pow(rr, .6), r2 = Math.min(armLen * .985, Math.hypot(r1, armLen * .55));
        if (r > 1e-4) o = o.map(v => v * r2 / r);
        e = W3(R.hem, [sh[0] + o[0], sh[1] + o[1], sh[2] + o[2]]);
      }
      const toward = (g, w) => { w = Math.min(1, w); e = [e[0] + (g[0] - e[0]) * w, e[1] + (g[1] - e[1]) * w, e[2] + (g[2] - e[2]) * w]; };
      if (A.reach && A.reach.w > 0) toward(A.reach.at, A.reach.w);
      const sgn = sd === 'L' ? 1 : -1, hr = (head.R ?? .4) * scale;
      if (A.temple > 0) toward(W3(R.head, [sgn * (hr + .1 * scale), .02, .12 * scale]), A.temple);
      if (A.drink > 0) toward(W3(R.head, [0, -.2 * scale, hr + .14 * scale]), A.drink);
      if (A.specs > 0) toward(W3(R.head, [sgn * .2 * scale, .08 * scale + (A.specsDy || 0), hr + .12 * scale]), A.specs);
      e = clearTorso(e);
      // ELBOW POLE: the clips' arm poles SNAP on a frame (wave, point: fine for a bendy hose, an elbow-plane flip on a rigid arm), so the
      // rigid arm uses its own continuous pole: elbow back, a little out and down in the hem frame (spec / pose arm `rbxPole` overrides)
      // CF1 (Review 1 fix 1): ONE pole field over every hand direction, pure in the pose: elbow back-and-out for low hands, out-and-down
      // for raised / forward hands (salute, brim, drink, point), blended by how far up-and-forward the hand is. The two references are
      // ~90 deg apart so the blend never cancels, and each fades by its own perpendicular length near its singular direction (the old
      // pole's fallback faded in exactly on the wave's path: the elbow plane flipped twice).
      let pole;
      if (A.rbxPole) pole = D3(R.hem, A.rbxPole);
      else {
        const sh = S['shoulder' + sd], hb = W3(_m.copy(R.hem).invert(), e);
        let d = [hb[0] - sh[0], hb[1] - sh[1], hb[2] - sh[2]]; const dl = Math.hypot(...d) || 1; d = d.map(v => v / dl);
        const perp = Q => { const k = Q[0] * d[0] + Q[1] * d[1] + Q[2] * d[2]; return [Q[0] - k * d[0], Q[1] - k * d[1], Q[2] - k * d[2]]; };
        const n = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
        const p1 = perp(n([sgn * .45, -.35, -1])), p2 = perp(n([sgn, -.3, -.15]));
        const w2 = sm(-.15, .55, d[1] * .6 + d[2] * .8);
        pole = D3(R.hem, [p1[0] * (1 - w2) + p2[0] * w2, p1[1] * (1 - w2) + p2[1] * w2, p1[2] * (1 - w2) + p2[2] * w2]);
      }
      const ik = solve(sock, e, armSeg, pole, D3(R.hem, [sgn, -.3, -.15]));
      out.push([k, ik, R.hem.clone(), sock, armSeg]);
    }
    // legs
    seatLegs(P, seatSt);
    for (const sd of ['R', 'L']) {
      const k = 'leg' + sd, T = R.targets[k];
      const sock = W3(lowerM, S['hip' + sd]);
      const front = D3(lowerM, [0, .15, 1]);
      const ik = solve(sock, T.end, legSeg, T.bend, front);
      out.push([k, ik, lowerM.clone(), sock, legSeg, footQ(ik, T, P.floorY ?? 0, R.facing)]);
    }
    return out;
  }
  // foot: flat on the floor (toe along the facing, pitched by the clip's toe angle) while planted, the shin's frame in the air
  function footQ(ik, T, floor, fwd) {
    const lift = ik.end[1] - floor - ankleY, kAir = sm(.03, .3, lift);
    const toe = (T.toe || 0) * DEG, q = new THREE.Quaternion();
    _z.set(fwd[0], 0, fwd[2]).normalize(); _y.set(0, 1, 0); _x.crossVectors(_y, _z).normalize();
    _m.makeBasis(_x, _y, _z).multiply(_r.makeRotationX(-toe)); q.setFromRotationMatrix(_m);
    if (kAir > 0) {
      _x.set(...ik.x); _y.set(...ik.yL); _z.crossVectors(_x, _y).normalize();
      _m.makeBasis(_x, _y, _z); _q2.setFromRotationMatrix(_m); q.slerp(_q2, kAir * .85);
    }
    return q;
  }

  function finish(P, hands, feet) {
    root.updateMatrixWorld(true);
    state.hands = hands; state.feet = feet; state.pose = P;
    // cane walk (as character.js): a world prop with a tip, its top on the drawn hand
    for (const pp of Object.values(P.props || {})) {
      if (!pp || pp.in !== 'world' || !pp.tip || !pp.caneHand) continue;
      const h = hands[pp.caneHand]; pp.at = [...h];
      const d = new THREE.Vector3(pp.tip[0] - h[0], pp.tip[1] - h[1], pp.tip[2] - h[2]);
      if (d.lengthSq() < 1e-8) continue;
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), d.normalize()), eu = new THREE.Euler().setFromQuaternion(q, 'XYZ');
      pp.rot = [eu.x / DEG, eu.y / DEG, eu.z / DEG];
    }
    // the set's light (world/sets.js lightDir) unless the spec or a shade pass set one
    if (!spec.light?.dir && !state.lightSet) { const ws = opts.set?.(); if (ws?.lightDir) { setLight(light, { dir: ws.lightDir }); state.lightSet = true; } }
    return state;
  }

  const where = () => {
    const hem = new THREE.Vector3().setFromMatrixPosition(R.hem), hd = new THREE.Vector3().setFromMatrixPosition(R.head);
    const feet = ['R', 'L'].map(sd => new THREE.Vector3(...(state.feet?.[sd] || R.targets['leg' + sd].end)));
    return { hem, head: hd, feet, root: new THREE.Vector3().setFromMatrixPosition(R.root), floor: state.pose?.floorY ?? 0 };
  };
  const parts = { ...M, head: head.group, headApi: head };
  return { id, root, rest, parts, update, where, V, rig: R, light, setLight: o => setLight(light, o), kind: 'rbx' };
}

export default { createRbxCharacter, coloursOf };
