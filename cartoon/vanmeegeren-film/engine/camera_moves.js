// engine/camera_moves.js - his camera grammar (MOTION_BIBLE section 8, law 9) as pure functions of t.
// Every move is a function shot(t) -> { pos: [x, y, z], target: [x, y, z], fov }. World units D, fov degrees (26 his default).
// The camera rarely rests (still on 4.5 % of frames); it PARKS for a big body action (hop, hat pop, sip), and stops hard
// (no settle after a whip). Shots join by continuous moves or dissolves; hard cuts are rare.
import { F, clamp, lerp, seg, easeFn } from './ease.js';

const L3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const D2R = Math.PI / 180;
const call = (x, t) => typeof x === 'function' ? x(t) : x;

/** park(pos, target, fov): dead still. */
export const park = (pos, target, fov = 26) => () => ({ pos: [...pos], target: [...target], fov });

/** push({ from, to, t0, t1, ease }): from/to = { pos, target, fov } (or shot functions). Default ease 'outCubic' (push-in is
 *  his default move, f0-30 +190 %). 'whipIn' = ramp then constant; 'whipOut' = linear decel, hard stop. Holds outside [t0, t1]. */
export function push({ from, to, t0 = 0, t1 = 1, ease = 'outCubic' }) {
  const e = easeFn(ease);
  return t => { const a = call(from, t), b = call(to, t), k = e(seg(t, t0, t1));
    return { pos: L3(a.pos, b.pos, k), target: L3(a.target, b.target, k), fov: lerp(a.fov ?? 26, b.fov ?? 26, k) }; };
}

/** dolly toward the target by `factor` (2 = twice as close) over [t0, t1]. */
export const pushIn = (shot, { factor = 1.9, t0 = 0, t1 = 1, ease = 'outCubic' } = {}) => {
  const e = easeFn(ease);
  return t => { const s = call(shot, t), k = e(seg(t, t0, t1)), m = lerp(1, 1 / factor, k);
    return { pos: s.target.map((c, i) => c + (s.pos[i] - c) * m), target: s.target, fov: s.fov }; };
};

/** orbit(center, { az0, az1, el, dist, t0, t1, facing, fov, ease, height }): az relative to the subject's facing (deg, 0 = in
 *  front). Default ease 'twoHump' dwells where az crosses 0 (f50-92: two speed humps of 4.2-4.7 deg/f, < 1 deg/f in the
 *  dwell; range about 98 deg, el 13-22). center may be a function of t (a moving subject). */
export function orbit(center, { az0 = -44, az1 = 55, el = 17.5, dist = 6, t0 = 0, t1 = F(40), facing = 0, fov = 26, ease = null, height = 0 } = {}) {
  const dwellAt = az0 < 0 && az1 > 0 ? -az0 / (az1 - az0) : .5;
  const e = ease ? easeFn(ease) : k => easeFn('twoHump')(k, dwellAt);
  return t => {
    const c = call(center, t), k = e(seg(t, t0, t1)), az = (facing + lerp(az0, az1, k)) * D2R, ev = call(el, t) * D2R;
    const tg = [c[0], c[1] + height, c[2]];
    return { pos: [tg[0] + dist * Math.sin(az) * Math.cos(ev), tg[1] + dist * Math.sin(ev), tg[2] + dist * Math.cos(az) * Math.cos(ev)], target: tg, fov };
  };
}

/** follow(subjectFn, { offset, lag, fov, lookOffset }): the camera trails a moving subject by `lag` s: a box average of the
 *  subject over [t - 2 lag, t] (pure: 9 samples, no state). offset is world space; or { az, el, dist } relative to facing. */
export function follow(subject, { offset = [0, 2, 8], lag = .25, fov = 26, lookOffset = [0, 1.5, 0], samples = 9, jumps = [] } = {}) {
  // jumps: the times the subject changes place (a place key): the lag never reaches back across one, so the camera arrives with him, no slide
  const since = t => { let a = -Infinity; for (const j of jumps) if (j <= t + 1e-9) a = Math.max(a, j); return a; };
  const avg = t => { if (lag <= 0) return call(subject, t); const s = [0, 0, 0], a = since(t);
    for (let i = 0; i < samples; i++) { const p = call(subject, Math.max(a, t - 2 * lag * i / (samples - 1))); s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; }
    return s.map(v => v / samples); };
  return t => { const c = avg(t), aim = call(subject, Math.max(since(t), t - lag * .5));
    return { pos: [c[0] + offset[0], c[1] + offset[1], c[2] + offset[2]], target: [aim[0] + lookOffset[0], aim[1] + lookOffset[1], aim[2] + lookOffset[2]], fov }; };
}

/** cut([{ t, shot }]): hard cuts (rare). Each shot gets absolute t. dissolve info: { t, shot, dissolve: s } -> returns a
 *  `mix` field (0..1) so the renderer can cross-fade two frames; the camera itself never blends. */
export function cut(list) {
  const L = [...list].sort((a, b) => a.t - b.t);
  return t => { let i = 0; for (let j = 0; j < L.length; j++) if (L[j].t <= t) i = j;
    const s = call(L[i].shot, t), d = L[i].dissolve;
    if (d && i > 0 && t < L[i].t + d) return { ...s, prev: call(L[i - 1].shot, t), mix: clamp((t - L[i].t) / d) };
    return s; };
}

/** autoPark(shot, parks): law 9. parks = [[t0, t1], ...] big body actions; camera time stands still inside them and resumes
 *  after (camera time = t - parked time before t). Pure. */
export function autoPark(shot, parks = []) {
  const P = [...parks].sort((a, b) => a[0] - b[0]);
  return t => { let ct = t; for (const [a, b] of P) { if (t >= b) ct -= (b - a); else if (t > a) ct -= (t - a); } return call(shot, ct); };
}

/** chain([{ t, shot }]): continuous moves; each piece starts where the previous ended (piece shots get absolute t). */
export const chain = cut;

// handheld noise: smooth, pure in t, seeded per channel
const nz = (t, s) => Math.sin(t * 4.59 + s) * .5 + Math.sin(t * 8.61 + s * 2.1) * .3 + Math.sin(t * 18.2 + s * 3.7) * .15 + Math.sin(t * 38.3 + s * 5.3) * .05;

/** path(keys): ONE continuous camera through any number of keys (no cut, never stops at a key unless told). Key = { t, pos, target,
 *  fov, roll, shake, walk, stop }. pos / target = [x, y, z] or a function of t (a moving subject, re-read on every frame, so a key on a
 *  walker stays on him). Monotone cubic per channel: passes every key, no overshoot, into a wall or past a target. `stop: true` = the
 *  speed is zero at that key (an aim that lands: whips). `shake` = handheld strength (1 = a calm person, 3 = panic), `walk` = their
 *  footstep bob (0-1), both blended between keys. For a whip, keep the target far away and put one key aimed sideways half way:
 *  a target that passes through the camera has no direction. */
export function path(keys) {
  const K = [...keys].sort((a, b) => a.t - b.t), n = K.length;
  const val = (k, t) => [...call(k.pos, t), ...call(k.target, t), k.fov ?? 26, k.roll ?? 0, k.shake ?? 0, k.walk ?? 0];
  const slope = (i, j, V) => { const h0 = K[i].t - K[i - 1]?.t, h1 = K[i + 1]?.t - K[i].t;
    if (K[i].stop) return 0;
    if (i === 0) return (V[1][j] - V[0][j]) / h1;
    if (i === n - 1) return (V[n - 1][j] - V[n - 2][j]) / h0;
    const d0 = (V[i][j] - V[i - 1][j]) / h0, d1 = (V[i + 1][j] - V[i][j]) / h1;
    if (d0 * d1 <= 0) return 0;
    const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0; return (w1 + w2) / (w1 / d0 + w2 / d1); };
  return t => {
    let i = 0; while (i < n - 2 && t >= K[i + 1].t) i++;
    const lo = Math.max(0, i - 1), hi = Math.min(n - 1, i + 2), V = []; for (let q = lo; q <= hi; q++) V[q] = val(K[q], t);
    const h = K[i + 1].t - K[i].t, s = clamp((t - K[i].t) / h), s2 = s * s, s3 = s2 * s, a = V[i], b = V[i + 1];
    const c = a.map((_, j) => (2 * s3 - 3 * s2 + 1) * a[j] + (-2 * s3 + 3 * s2) * b[j]
      + h * ((s3 - 2 * s2 + s) * slope(i, j, V) + (s3 - s2) * slope(i + 1, j, V)));
    const sh = Math.max(0, c[8]), w = clamp(c[9]), bob = Math.abs(Math.sin(t * 5.97));
    const pos = [c[0] + sh * .05 * nz(t, 1) + w * .05 * Math.sin(t * 5.97), c[1] + sh * .04 * nz(t, 2) + w * .09 * bob, c[2] + sh * .05 * nz(t, 3)];
    const dist = Math.hypot(c[3] - c[0], c[4] - c[1], c[5] - c[2]), aim = dist * .011 * sh;
    return { pos, target: [c[3] + aim * nz(t, 4), c[4] + aim * nz(t, 5), c[5] + aim * nz(t, 6)], fov: c[6], roll: c[7] + sh * 1.1 * nz(t, 7) + w * .5 * Math.sin(t * 5.97) };
  };
}

/** frame(shot, t): helper, returns the camera fields (for renderers that want az/el/dist too). */
export function frameInfo(s) {
  const d = [s.pos[0] - s.target[0], s.pos[1] - s.target[1], s.pos[2] - s.target[2]], dist = Math.hypot(...d);
  return { ...s, dist, az: Math.atan2(d[0], d[2]) / D2R, el: Math.asin(d[1] / (dist || 1)) / D2R };
}
