// engine/height.js - characters off the ground and characters changing place (FIX HEIGHT, 2026-11-04). Used by compose.js. Pure in t.
// A timeline may have:
//   root: { x, z, ry, y }                 y = the height he stands on from the start (a raised deck)
//   height: [{ t, y, over, ease, legs, floor }, { t, fall, up, to, g, land, antic }, ...]   or the short form [t, y, ease?]
//   place:  [{ t, at: [x, z], ry, y, legs, floor }]   a snap to another place + facing (nothing slides; walks, looks, props follow)
//   walk[i].path points may have a third number: [x, z, y] = the height of the ground at that point
// Everything here only runs for a timeline that uses one of these (c.air); any other timeline never comes here, so older films are untouched.
import { F, clamp, lerp, E, easeFn } from './ease.js';
import { pathOf, footUnder } from './walk.js';

export const G_FALL = 20;              // D/s^2: a body reads heavy at this (a prop's `drop` default is 9.8: a light thing)
export const uses = tl => !!(tl.height?.length || tl.place?.length || tl.root?.y != null || (tl.walk || []).some(w => (w.path || []).some(p => p.length > 2)));
const TWO_PI = Math.PI * 2, near = (a, b) => Math.abs(a - b) < 1e-6, sstep = k => k * k * (3 - 2 * k);
const LEGS = new Set(['stand', 'float', 'tread', 'hang', 'fall', 'climb']);
const legName = (k, where) => { const l = k.stand === true ? 'stand' : k.legs; if (l != null && !LEGS.has(l)) throw new Error(`${where}: legs "${l}" is not one of ${[...LEGS].join(', ')}`); return l; };
const isT = (v, where) => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${where}: t must be a time, got ${JSON.stringify(v)}`); return v; };

/** the timeline's height + place keys as compile steps, in time order with its walks (see compose.js compile) */
export function steps(tl) {
  const hk = (tl.height || []).map(k => Array.isArray(k) ? { t: k[0], y: k[1], ...(k[2] != null ? { ease: k[2] } : {}) } : k);
  hk.forEach((k, i) => isT(k.t, `height[${i}]`));
  hk.sort((a, b) => a.t - b.t);
  const out = [];
  (tl.place || []).forEach((p, i) => { isT(p.t, `place[${i}]`); if (!Array.isArray(p.at) && p.y == null && p.ry == null) throw new Error(`place[${i}]: needs at: [x, z] (or y / ry)`); out.push({ t0: p.t, o: -2, place: p }); });
  hk.forEach((h, i) => out.push({ t0: h.t, o: -1, h, first: i === 0 }));
  return out;
}

/** first state: the height before anything happens. root.y = standing on something; a first height key without `over` = where he is up to then. */
export function init(c) {
  const tl = c.tl, f0 = tl.floor ?? 0;
  const k0 = (tl.height || []).map(k => Array.isArray(k) ? { t: k[0], y: k[1] } : k).sort((a, b) => a.t - b.t)[0];
  let y = tl.root?.y ?? 0, legs = 'stand', floor = tl.root?.y != null ? (tl.floor ?? y) : f0;
  if (k0 && k0.over == null && k0.fall == null && k0.y != null) {
    y = k0.y; const L = legName(k0, 'height[0]');
    floor = k0.floor ?? (L === 'stand' ? y : floor);
    legs = L ?? (near(y, floor) ? 'stand' : 'float');
  }
  c.ys = [{ t0: -Infinity, t1: -Infinity, y0: y, y1: y, legs, after: legs, f0: floor, f1: floor }];
  c.legKeys = [[-Infinity, legs, 0]];
  c.placeTs = []; c.lands = []; c.antics = []; c.places = [];
}

function push(c, e, snap = false) {
  c.ys = c.ys.filter(x => x.t0 < e.t0 || x.t0 === -Infinity);
  c.ys.push(e);
  while (c.legKeys.length > 1 && c.legKeys[c.legKeys.length - 1][0] >= e.t0) c.legKeys.pop();
  if (e.t1 > e.t0) { c.legKeys.push([e.t0, e.legs, snap ? 0 : null]); c.legKeys.push([e.t1, e.after, e.ball ? 0 : null]); }
  else c.legKeys.push([e.t0, e.after, snap ? 0 : null]);
}

/** where he is in height at t: { y, legs (at t), floor, e } */
export function yAt(c, t) {
  let e = c.ys[0]; for (const x of c.ys) { if (x.t0 > t) break; e = x; }
  let y;
  if (e.wk) { const lt = t - e.t0; y = lt >= e.wk.w.dur ? e.y1 : e.wk.w.at(lt).rootY; }
  else if (t >= e.t1) y = e.y1;
  else if (e.ball) { const dt = t - e.t0; y = e.ball.y0 + e.ball.v * dt - e.ball.g * dt * dt / 2; }
  else y = lerp(e.y0, e.y1, e.ez(clamp((t - e.t0) / ((e.t1 - e.t0) || 1e-9))));
  const floor = e.wk || e.floorMoves ? y : (t < e.t1 ? e.f0 : e.f1);
  return { y, legs: t < e.t1 ? e.legs : e.after, floor, e };
}

/** one height key at compile time (the walks before it are already in) */
export function addHeight(c, h, first, rootAt) {
  const t = h.t, here = yAt(c, t - 1e-6), last = c.ys[c.ys.length - 1];
  if (h.fall != null) {
    const y0 = here.y, y1 = h.fall === true ? here.floor : h.fall, g = h.g ?? G_FALL, up = Math.max(0, h.up ?? 0), apex = Math.max(y0, y1) + up;
    const v = Math.sqrt(Math.max(0, 2 * g * (apex - y0))), T = Math.max(F(1), (v + Math.sqrt(Math.max(0, 2 * g * (apex - y1)))) / g), floor = h.floor ?? y1;
    const e = { t0: t, t1: t + T, y0, y1, legs: 'fall', after: 'stand', f0: here.floor, f1: floor, ball: { y0, v, g }, up };
    push(c, e);
    c.ys[c.ys.length - 1].landT = t + T;
    if (h.land !== false) { const L = typeof h.land === 'object' ? h.land : {}, dropH = apex - y1, Lg = c.rest.legLen;
      c.lands.push({ t: t + T, dip: L.dip ?? clamp(.06 + .035 * dropH, .08, .42) * Lg, hold: L.hold ?? 2, frames: L.frames ?? 10, bend: L.bend ?? clamp(5 + 2.2 * dropH, 6, 22), h: dropH }); }
    const antic = h.antic ?? (up > 0 ? 5 : 0);
    if (antic > 0) c.antics.push({ t, frames: antic, dip: .22 * c.rest.legLen * Math.min(1, .5 + up), bend: 8 });
    if (Array.isArray(h.to)) { const r = rootAt(t - 1e-6);
      c.walks.push({ t0: t, flight: { t1: t + T, x0: r.x, z0: r.z, x1: h.to[0], z1: h.to[1], ry: h.ry ?? r.ry } }); c.walkStarts.push(t); c.placeTs.push(t); }
    return;
  }
  const y1 = h.y ?? here.y, L = legName(h, `height key at t ${t}`);
  if (first && h.over == null) { c.keyEnd = t; return; }                 // already the first state (init)
  let a, b;
  if (h.over != null) { a = t; b = t + h.over; }
  else { const e0 = Math.max(c.keyEnd ?? -Infinity, last.t1); a = Number.isFinite(e0) ? Math.min(t, e0) : t; b = t; }   // no `over`: arrives at t, leaving when the last key ended
  c.keyEnd = b;
  const y0 = yAt(c, a - 1e-6).y, moves = !near(y0, y1), floor = h.floor ?? (L === 'stand' || L === 'climb' ? y1 : here.floor);
  const atFloor = near(y1, floor);
  const during = L ?? (moves ? 'float' : (atFloor ? 'stand' : 'float')), after = atFloor ? 'stand' : (L ?? 'float');
  const ez = L === 'climb' ? E.lin : easeFn(h.ease ?? 'inOutSine');
  push(c, { t0: a, t1: b, y0, y1, ez, legs: during, after, f0: here.floor, f1: floor, floorMoves: L === 'stand', climb: L === 'climb' });
}

/** one place key at compile time: a snap */
export function addPlace(c, p, rootAt) {
  const t = p.t, from = rootAt(t - 1e-6), L = legName(p, `place key at t ${t}`), y = p.y ?? 0;
  const end = { x: p.at ? p.at[0] : from.x, z: p.at ? p.at[1] : from.z, ry: p.ry ?? from.ry };
  c.walks.push({ t0: t, place: true, end });
  c.walkStarts.push(t); c.placeTs.push(t); c.places.push({ t, from: { ...from }, end: { ...end, y } });
  const legs = L ?? 'stand', floor = p.floor ?? (legs === 'stand' ? y : (c.tl.floor ?? 0));
  push(c, { t0: t, t1: t, y0: y, y1: y, legs, after: legs, f0: floor, f1: floor }, true);
}

/** a walk whose path has heights: the ground under the path as a function of arc length (+ the walk opts that use it) */
export function groundOf(points, y0) {
  const pts = points.map(p => [p[0], p[1]]), path = pathOf(pts);
  const ys = []; let cur = y0; for (const p of points) { if (p.length > 2 && typeof p[2] === 'number') cur = p[2]; ys.push(cur); }
  const ds = [0]; let from = 0;
  for (let i = 1; i < pts.length; i++) {
    let best = from, bd = Infinity;
    for (let n = 0; n <= 800; n++) { const d = from + (path.L - from) * n / 800, q = path.at(d), e = Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]); if (e < bd - 1e-9) { bd = e; best = d; } }
    ds.push(best); from = best;
  }
  ds[ds.length - 1] = path.L;
  return d => { d = clamp(d, 0, path.L); let i = 0; while (i < ds.length - 2 && d > ds[i + 1]) i++;
    const u = ds[i + 1] > ds[i] ? clamp((d - ds[i]) / (ds[i + 1] - ds[i])) : 1; return lerp(ys[i], ys[i + 1], u); };
}
export const pathHasY = path => path.some(p => p.length > 2);
export function addWalkGround(c, wk) {
  const lt = wk.w.dur, y1 = wk.w.at(lt).rootY;
  push(c, { t0: wk.t0, t1: wk.t0 + lt, y0: wk.w.at(0).rootY, y1, legs: 'stand', after: 'stand', f0: y1, f1: y1, wk });
}

// ---- legs and arms off the ground. Root space: x left, y up from his ground level, z forward. Pure in t.
function modeAt(c, t, arms = false) {
  const L = c.legKeys; let i = 0; for (let j = 0; j < L.length; j++) if (L[j][0] <= t + 1e-9) i = j;
  const cur = L[i][1], prev = i > 0 ? L[i - 1][1] : cur, tc = L[i][0];
  if (prev === cur || !Number.isFinite(tc)) return { cur, prev: cur, w: 1 };
  let fr = L[i][2] ?? (cur === 'fall' ? 3 : 6);
  if (arms && L[i][2] === 0 && prev === 'fall') fr = 8;                 // a landing: feet on the floor at once, the arms come down over 8 f
  const w = fr > 0 ? sstep(clamp((t - tc) / F(fr))) : 1;
  return { cur, prev, w };
}
function climbAt(c, t, e, side) {
  // alternating hands and feet on rungs `rung` D apart: a foot stays where it stepped (world height) while the root rises past it
  const rung = .45, y = yAt(c, t).y, u = (y - (e?.y0 ?? y)) / rung + (side === 'L' ? 1 : 0);
  const k = Math.floor(u / 2), fr = (u / 2 - k), hop = sstep(clamp((fr - .5) / .5));
  return (k + hop) * 2 * rung - (y - (e?.y0 ?? y)) - (side === 'L' ? rung : 0);
}
function legPose(c, t, mode, s) {
  const r = c.rest, hip = s === 'L' ? r.hipL : r.hipR, sg = s === 'L' ? 1 : -1, ph = s === 'L' ? Math.PI : 0, Lg = r.legLen, top = r.hipY + hip[1];
  if (mode === 'float') { const w = Math.sin(TWO_PI * t / 2.8 + ph), v = Math.cos(TWO_PI * t / 2.8 + ph);
    return { x: hip[0] * 1.35, y: top - (.84 - .025 * v) * Lg, z: hip[2] - .03 + .1 * Lg * w, toe: -30 + 6 * w, bend: [sg * .2, 0, 1] }; }
  if (mode === 'tread') { const w = Math.sin(TWO_PI * t / 1.3 + ph), v = Math.cos(TWO_PI * t / 1.3 + ph);
    return { x: hip[0] * 1.5, y: top - (.72 + .13 * v) * Lg, z: hip[2] + .2 * Lg * w, toe: -18, bend: [sg * .25, 0, 1] }; }
  if (mode === 'hang') return { x: hip[0] * 1.1, y: top - .94 * Lg, z: hip[2], toe: -35, bend: [sg * .1, 0, 1] };
  if (mode === 'fall') {
    const e = yAt(c, t).e, land = e?.landT, ready = land != null ? sstep(clamp((t - (land - F(5))) / F(5))) : 0;
    const w = Math.sin(TWO_PI * t / .55 + ph), v = Math.sin(TWO_PI * t / .5 + ph);
    const air = { x: hip[0] * 1.9, y: top - (.74 + .06 * v) * Lg, z: hip[2] - .05 + .22 * Lg * w, toe: -15 };
    return { x: lerp(air.x, hip[0] * 1.2, ready), y: lerp(air.y, r.ankleY + .03 * Lg, ready), z: lerp(air.z, hip[2], ready), toe: lerp(air.toe, 0, ready), bend: [sg * .35, 0, 1] };
  }
  if (mode === 'climb') { const e = yAt(c, t).e;
    return { x: hip[0] * 1.5, y: (r.ankleY ?? 0) + .42 * Lg + climbAt(c, t, e, s), z: hip[2] + .28, toe: 8, bend: [sg * .45, 0, 1] }; }
  return null;
}
function armPose(c, t, mode, s) {
  const r = c.rest, sh = s === 'L' ? r.shoulderL : r.shoulderR, sg = s === 'L' ? 1 : -1, ph = s === 'L' ? Math.PI : 0, hx = sh[0] * 1.15, hy = sh[1] - r.armLen * .737;
  if (mode === 'float') { const w = Math.sin(TWO_PI * t / 3.2 + ph * .5);
    return { hand: [hx + sg * .24, hy + .2 + .04 * w, .1 + .05 * w], bend: [sg * .6, 0, -1] }; }
  if (mode === 'tread') { const w = Math.sin(TWO_PI * t / 1.3 + ph);
    return { hand: [hx + sg * .34, hy + .36 + .05 * w, .16 + .12 * w], bend: [sg * .7, 0, -1] }; }
  if (mode === 'fall') { const w = Math.sin(TWO_PI * t / .45 + ph), v = Math.cos(TWO_PI * t / .5 + ph);
    const e = yAt(c, t).e, land = e?.landT, ready = land != null ? sstep(clamp((t - (land - F(5))) / F(5))) : 0;
    return { hand: [sh[0] * 1.2 + sg * (.32 - .12 * ready), lerp(sh[1] + .42 + .09 * w, hy + .3, ready), .05 + .08 * v * (1 - ready)], bend: [sg * .8, 0, -1] }; }
  if (mode === 'climb') { const e = yAt(c, t).e;
    return { hand: [sh[0] * .9, sh[1] + .32 + climbAt(c, t, e, s === 'L' ? 'R' : 'L'), .34], bend: [sg * .7, 0, -1] }; }
  return null;
}

/** 0 = on the ground .. 1 = fully off it */
export function airMode(c, t) { const m = modeAt(c, t); return m.cur === 'stand' ? (m.prev === 'stand' ? 0 : 1 - m.w) : m.prev === 'stand' ? m.w : 1; }

/** under the clips: arms and a little body while he is in the air (clips on an arm still win) */
export function airBody(c, t, pose) {
  const m = modeAt(c, t, true);
  if (m.cur === 'stand' && m.w >= 1) return;
  for (const s of ['R', 'L']) {
    const arm = pose[`arm${s}`]; if ((arm.in || 'body') !== 'body') continue;
    const A = m.cur === 'stand' ? null : armPose(c, t, m.cur, s), B = m.w < 1 && m.prev !== 'stand' ? armPose(c, t, m.prev, s) : null;
    const to = A?.hand ?? arm.hand, fr = B?.hand ?? arm.hand;
    arm.hand = m.w >= 1 ? [...to] : [0, 1, 2].map(i => lerp(fr[i], to[i], m.w));
    const bd = A?.bend ?? B?.bend; if (bd) arm.bend = [...bd];
  }
  const body = md => md === 'fall' ? { bend: -7 + 3 * Math.sin(TWO_PI * t / .9), twist: 4 * Math.sin(TWO_PI * t / .7) } : md === 'float' ? { bend: 3 * Math.sin(TWO_PI * t / 4.1), twist: 2 * Math.sin(TWO_PI * t / 5.3) } : md === 'tread' ? { bend: 5, twist: 3 * Math.sin(TWO_PI * t / 1.3) } : md === 'climb' ? { bend: 6, twist: 0 } : { bend: 0, twist: 0 };
  const a = body(m.cur), b = body(m.prev);
  pose.body.bend += lerp(b.bend, a.bend, m.w); pose.body.twist += lerp(b.twist, a.twist, m.w);
}

/** after the clips: landing and take-off bends (like the walk's bob, on top of everything) */
export function dips(c, t, pose) {
  for (const L of c.lands) { const x = (t - L.t) * 30; if (x < 0 || x >= 3 + L.hold + L.frames) continue;
    const k = x < 3 ? E.outQuad(x / 3) : x < 3 + L.hold ? 1 : 1 - E.inOutSine((x - 3 - L.hold) / L.frames);
    pose.body.hipY -= L.dip * k; pose.body.bend += L.bend * k; pose.body.squash = (pose.body.squash ?? 1) * (1 - .05 * k); }
  for (const A of c.antics) { const x = (t - A.t) * 30; if (x <= -A.frames || x >= 2) continue;
    const k = x < 0 ? E.inOutSine((x + A.frames) / A.frames) : 1 - x / 2;
    pose.body.hipY -= A.dip * k; pose.body.bend += A.bend * k; }
}

/** after the feet are placed: legs off the ground (world feet, so they blend with whatever the feet were doing) */
export function airLegs(c, t, pose) {
  const m = modeAt(c, t), st = yAt(c, t);
  pose.floorY = st.floor;
  if (m.cur === 'stand' && m.w >= 1) { pose.airK = 0; return 0; }
  const seated = (pose.body.sit || 0) > 0 || (pose.body.kneel || 0) > 0;
  const k = m.cur === 'stand' ? 1 - m.w : m.prev === 'stand' ? m.w : 1;
  pose.airK = k;
  if (seated) return k;
  const R = pose.root, y = R.y || 0, world = q => footUnder(R.x, R.z, R.ry, [q.x, 0, q.z], q.y + y);
  for (const s of ['R', 'L']) {
    const leg = pose[`leg${s}`];
    const here = leg.in === 'root' ? footUnder(R.x, R.z, R.ry, [leg.foot[0], 0, leg.foot[2]], leg.foot[1] + y) : leg.foot;
    const A = m.cur === 'stand' ? null : legPose(c, t, m.cur, s), B = m.prev === 'stand' || m.w >= 1 ? null : legPose(c, t, m.prev, s);
    const to = A ? world(A) : here, fr = B ? world(B) : here;
    leg.foot = [0, 1, 2].map(i => lerp(fr[i], to[i], m.w)); leg.in = 'world';
    const src = A ?? B; if (src) { leg.toe = lerp(B?.toe ?? 0, A?.toe ?? 0, m.w); leg.bend = [...src.bend]; }
    leg.tone = 'ink';
  }
  return k;
}

/** a look target held across a place moves with him: the same direction relative to his body. A key exactly on the place snaps. */
export function placeLooks(c, list, rootAt) {
  if (!c.places?.length) return list;
  let L = [...list];
  for (const p of c.places) {
    const on = L.find(k => Math.abs(k.t - p.t) < 1e-6);
    if (on) { on.instant = true; continue; }
    const prev = L.filter(k => k.t < p.t).pop();
    if (!prev || !Array.isArray(prev.at)) continue;
    const a = rootAt(p.t - 1e-6), b = rootAt(p.t + 1e-6), d = (b.ry - a.ry) * Math.PI / 180, co = Math.cos(d), si = Math.sin(d);
    const dx = prev.at[0] - a.x, dz = prev.at[2] - a.z, dy = prev.at[1] - (a.y || 0);
    L.push({ t: p.t, at: [b.x + dx * co + dz * si, (b.y || 0) + dy, b.z - dx * si + dz * co], instant: true, gaze: false, _place: true });
    L = L.sort((x, y) => x.t - y.t);
  }
  return L;
}
