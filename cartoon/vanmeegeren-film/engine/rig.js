// rig.js: Pose (overnight2/CONTRACT.md) -> world transforms. root (ground) -> hem (hipY, twist, lean, bend) -> neck (sockets.neck * squash)
// -> head centre (neckToHead along the neck's up, + head yaw/pitch/roll, + look.at). Plain Matrix4 chain, no bones. Also resolves the limb
// targets (hands in 'body' or 'world', feet in 'world' or 'body') and the bend (pole) directions into world space.
// Conventions: body space = origin at the hem point, +X the character's LEFT, +Y up, +Z facing. ry/lean/bend/twist/yaw/pitch/roll degrees.
//   twist about Y, lean = sideways (positive tips the top toward +X, the character's left), bend = forward (positive tips the top toward +Z).
//   head pitch positive = nose up, yaw positive = toward +X (his left), roll positive = top toward +X.
import * as THREE from './three.js';

const DEG = Math.PI / 180;
export const LEG_UP = 2.5; // walking front leg: up part of the knee pole per unit of forward reach (see the leg loop in rig())
const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

export function restPose(rest) {
  const fx = (s, k) => [s[0] * k, rest.ankleY, s[2]];
  return {
    root: { x: 0, z: 0, ry: 0 },
    body: { hipY: rest.hipY, lean: 0, bend: 0, twist: 0, squash: 1 },
    head: { yaw: 0, pitch: 0, roll: 0 },
    face: {}, hat: { on: true }, look: { at: null },
    armR: { hand: [rest.shoulderR[0] * 1.4, rest.shoulderR[1] - .7, .1], in: 'body', bend: [-.45, 0, -1] },
    armL: { hand: [rest.shoulderL[0] * 1.4, rest.shoulderL[1] - .7, .1], in: 'body', bend: [.45, 0, -1] },
    legR: { foot: fx(rest.hipR, 1.15), in: 'root', bend: [-.1, 0, 1] },
    legL: { foot: fx(rest.hipL, 1.15), in: 'root', bend: [.1, 0, 1] },
  };
}

// fill missing channels from the rest pose, one level deep
export function withRest(pose = {}, rest) {
  const R = restPose(rest), o = {};
  for (const k of new Set([...Object.keys(R), ...Object.keys(pose)])) {
    const a = R[k], b = pose[k];
    o[k] = a && b && typeof a === 'object' && !Array.isArray(a) && typeof b === 'object' ? { ...a, ...b } : (b ?? a);
  }
  return o;
}

// rig(pose, rest, sockets, out): every matrix in world space. `out` is reused when given.
export function rig(P, rest, S, out = {}) {
  const root = out.root || (out.root = new THREE.Matrix4());
  const hem = out.hem || (out.hem = new THREE.Matrix4());
  const head = out.head || (out.head = new THREE.Matrix4());
  const neck = out.neck || (out.neck = new THREE.Matrix4());
  const ry = (P.root.ry || 0) * DEG;
  root.makeRotationY(ry).setPosition(P.root.x || 0, P.root.y || 0, P.root.z || 0);
  const B = P.body;
  hem.copy(root).multiply(_m.makeTranslation(0, B.hipY ?? rest.hipY, 0))
    .multiply(_r.makeRotationY((B.twist || 0) * DEG))
    .multiply(_r.makeRotationZ(-(B.lean || 0) * DEG))
    .multiply(_r.makeRotationX((B.bend || 0) * DEG));
  const sq = B.squash ?? 1;
  neck.copy(hem).multiply(_m.makeTranslation(S.neck[0], S.neck[1] * sq, S.neck[2]));
  // head centre: neckToHead up the neck, then the head's own turn (+ look.at)
  let yaw = P.head.yaw || 0, pitch = P.head.pitch || 0, roll = P.head.roll || 0;
  head.copy(neck).multiply(_m.makeTranslation(0, rest.neckToHead, 0));
  if (P.look && P.look.at) {
    // the target in the neck frame: yaw/pitch to it, added to the keyed head turn, clamped to what a neck does
    _v.set(...P.look.at).applyMatrix4(_m.copy(head).invert());
    const ly = Math.atan2(_v.x, _v.z) / DEG, lp = Math.atan2(_v.y, Math.hypot(_v.x, _v.z)) / DEG;
    yaw += Math.max(-75, Math.min(75, ly)); pitch += Math.max(-35, Math.min(35, lp));
  }
  head.multiply(_r.makeRotationY(yaw * DEG)).multiply(_r.makeRotationX(-pitch * DEG)).multiply(_r.makeRotationZ(-roll * DEG));
  out.headYaw = yaw; out.headPitch = pitch;
  // limb targets in world
  const T = out.targets || (out.targets = {});
  const toWorld = (p, space) => {
    if (space === 'world') return [p[0], p[1], p[2]];
    if (space === 'root' || space === 'body-ground') { _v.set(p[0], p[1], p[2]).applyMatrix4(root); return [_v.x, space === 'body-ground' ? p[1] : _v.y, _v.z]; }
    _v.set(p[0], p[1], p[2]).applyMatrix4(hem); return [_v.x, _v.y, _v.z];
  };
  const dirW = (d, space) => { _v.set(d[0], d[1], d[2]); if (space !== 'world') _v.transformDirection(space === 'root' || space === 'body-ground' ? root : hem); return [_v.x, _v.y, _v.z]; };
  for (const k of ['armR', 'armL']) {
    const a = P[k];
    T[k] = { end: toWorld(a.hand, a.in || 'body'), bend: dirW(a.bend || [0, 0, -1], a.in === 'world' ? 'body' : (a.in || 'body')), vis: a.vis !== false };
  }
  // LEG (2026-11-04): walking (P.walkK > 0, stage.html's root speed) a leg reaching FORWARD gets an up part in its pole, so the knee of a
  // front leg at full stride bulges up/forward like his (a forward pole alone is parallel to a forward chord and the hose bowed sideways,
  // invisible side-on = a straight rod). Rear and under-the-body legs and every leg at walkK 0 (standing, sitting, kneeling) keep their pole.
  const walkK = Math.min(1, Math.max(0, P.walkK || 0));
  for (const k of ['legR', 'legL']) {
    const l = P[k], sp = l.in || 'world', end = toWorld(l.foot, sp);
    let bd = l.bend || [0, 0, 1];
    if (walkK > 0) {
      _v.set(end[0], end[1], end[2]).applyMatrix4(_m.copy(hem).invert()); // the foot in body space (hem origin, +Z facing)
      const fwd = _v.z / (Math.hypot(_v.x, _v.y, _v.z) || 1);
      if (fwd > 0) bd = [bd[0], bd[1] + LEG_UP * walkK * fwd, bd[2]];
    }
    T[k] = { end, bend: dirW(bd, 'body'), toe: l.toe || 0, vis: l.vis !== false };
  }
  // the toe direction: the body's facing projected on the ground
  _v.set(0, 0, 1).transformDirection(hem); _v.y = 0; _v.normalize();
  out.facing = [_v.x, 0, _v.z];
  return out;
}

export default { rig, restPose, withRest };
