// The face rig: lines, eyes and mouth as curves, drawn on the head's surface. No textures, no sprites, no canvas: every
// shape is geometry computed from parameters, so it is crisp at any size and holds when the head turns. Usable for any character.
//
// Decal coordinates: u to the viewer's right, v down, in units of R (half the head diameter), origin between the eyes.
// State (one frame of faceTrack.json, or your own):
//   pose  [yaw, pitch, roll] deg: where the decal's centre sits on the head. yaw + toward +X, pitch + down, roll + clockwise.
//   flip  1 or -1: mirrors the decal in u (his f66 -> f67 snap).
//   lid   [left, right]: stroke, 8 cubic control coordinates + 5 full widths at evenly spaced t. A blink bar, a ^ arc, a wince
//         slit and a smug lid are all this one stroke with different numbers.
//   dome  [left, right] or null: cu cv rx ry tilt egg. A black egg below the lid, cut off at the lid's centreline.
//   brow  [left, right] or null: stroke like a lid.
//   ms    'D' | 'Dtongue' | 'smirk' | 'crescent' | 'grid'.
//   mouth stroke: 8 cubic + 7 widths (a smirk, a crescent and the open D are the same stroke, thin or fat). grid: cu cv hw hh
//         tilt ex ol hy x1 x2 x3 lw skew (rounded box, inner white, 1 + 3 lines).
//   tongue cu cv rx ry tilt. cells teeth as [t0, t1, d0, d1] in the mouth stroke's own coordinates (d -1 top edge, +1 bottom).
//   extras [{ ell: [cu, cv, rx, ry, tilt], color: 'ink'|'white'|'maroon'|hex }]: for the guide's other eye and mouth states.
// API: build(params) -> Group; update(frame, ctx) draws the track's frame, or with ctx.face = { eyes, brow, mouth } the composed state
// (engine/faceset.js, specs/faces/kit.json) at the frame's pose/flip; root.setFace(state); lerpFace(a, b, t); guideState(name).
import * as THREE from './three.js';
import { loadTrack as loadTrackFrom } from './tracks.js';
import { faceState, kitReady, kit } from './faceset.js';

const S = 48;                // ribbon samples; the shapes stay curves at any zoom because this and CAP are small steps of a cubic
const CAP = 20;
const MAX_EDGE = .05;        // R: longer triangle edges are split so fills follow the sphere
const PAL = { ink: 0x2d2228, maroon: 0x3a1f26, tongue: 0xd0707c, white: 0xfbf6f3 };

const lerp = (a, b, t) => a + (b - a) * t;
function cubicAt(P, t) {
  const m = 1 - t, a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
  return [a * P[0] + b * P[2] + c * P[4] + d * P[6], a * P[1] + b * P[3] + c * P[5] + d * P[7]];
}
function tanAt(P, t) {
  const m = 1 - t, a = -3 * m * m, b = 3 * m * m - 6 * m * t, c = 6 * m * t - 3 * t * t, d = 3 * t * t;
  const x = a * P[0] + b * P[2] + c * P[4] + d * P[6], y = a * P[1] + b * P[3] + c * P[5] + d * P[7], l = Math.hypot(x, y) || 1e-6;
  return [x / l, y / l];
}
function widthAt(W, t) {
  // Catmull-Rom through the knots: no kink in the edge at any zoom (differs from the fit's straight segments by far under a pixel)
  const f = t * (W.length - 1), i = Math.min(W.length - 2, Math.floor(f)), u = f - i;
  const a = W[Math.max(i - 1, 0)], b = W[i], c = W[i + 1], d = W[Math.min(i + 2, W.length - 1)];
  const v = b + .5 * u * (c - a + u * (2 * a - 5 * b + 4 * c - d + u * (3 * (b - c) + d - a)));
  return Math.max(Math.min(v, Math.max(b, c) * 1.05), Math.min(b, c) * .95, 1e-4);
}
const normalOf = T => [-T[1], T[0]]; // points to +v (down) for a left-to-right stroke

// ---------- shapes -> triangles in decal space ----------
function tri(out, a, b, c, col) { out.push(a, b, c, col); }
function fan(out, poly, col) {
  let cx = 0, cy = 0; for (const p of poly) { cx += p[0]; cy += p[1]; } cx /= poly.length; cy /= poly.length;
  for (let i = 0; i < poly.length; i++) tri(out, [cx, cy], poly[i], poly[(i + 1) % poly.length], col);
}
function stroke(out, x, col, wmul = 0) {
  const P = x.slice(0, 8), W = x.slice(8), L = [], R = [];
  for (let i = 0; i <= S; i++) {
    const t = i / S, c = cubicAt(P, t), n = normalOf(tanAt(P, t)), w = Math.max(widthAt(W, t) - wmul, 0) / 2;
    L.push([c[0] + n[0] * w, c[1] + n[1] * w]); R.push([c[0] - n[0] * w, c[1] - n[1] * w]);
  }
  for (let i = 0; i < S; i++) { tri(out, L[i], L[i + 1], R[i + 1], col); tri(out, L[i], R[i + 1], R[i], col); }
  for (const t of [0, 1]) {
    const c = cubicAt(P, t), r = Math.max(widthAt(W, t) - wmul, 0) / 2, poly = [];
    if (r <= 1e-4) continue;
    for (let i = 0; i < CAP; i++) { const a = i / CAP * Math.PI * 2; poly.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
    fan(out, poly, col);
  }
}
function dome(out, d, lidP, col) {
  const [cu, cv, rx, ry, tilt, egg] = d, ct = Math.cos(tilt), st = Math.sin(tilt);
  const ax = lidP[6] - lidP[0], ay = lidP[7] - lidP[1], len = Math.hypot(ax, ay) || 1e-6, a = [ax / len, ay / len], n = [-a[1], a[0]];
  const mid = cubicAt(lidP, .5), bulge = (mid[0] - (lidP[0] + lidP[6]) / 2) * n[0] + (mid[1] - (lidP[1] + lidP[7]) / 2) * n[1];
  const poly = [];
  for (let i = 0; i < 64; i++) {
    const th = i / 64 * Math.PI * 2, s0 = Math.sin(th), x = rx * Math.cos(th) * (1 - egg * s0), y = ry * s0;
    const px = cu + x * ct - y * st, py = cv + x * st + y * ct, dx = px - lidP[0], dy = py - lidP[1];
    const s = dx * a[0] + dy * a[1], xi = Math.min(1.25, Math.max(-.25, s / len)), h = Math.max(dx * n[0] + dy * n[1], bulge * 4 * xi * (1 - xi));
    poly.push([lidP[0] + a[0] * s + n[0] * h, lidP[1] + a[1] * s + n[1] * h]);
  }
  fan(out, poly, col);
}
function ellipse(out, e, col) {
  const [cu, cv, rx, ry, tilt = 0] = e, ct = Math.cos(tilt), st = Math.sin(tilt), poly = [];
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, x = rx * Math.cos(a), y = ry * Math.sin(a); poly.push([cu + x * ct - y * st, cv + x * st + y * ct]); }
  fan(out, poly, col);
}
function cell(out, x, c, col) {
  const P = x.slice(0, 8), W = x.slice(8), [t0, t1, d0, d1] = c, A = [], B = [];
  for (let i = 0; i <= 8; i++) {
    const t = lerp(t0, t1, i / 8), p = cubicAt(P, t), n = normalOf(tanAt(P, t)), w = widthAt(W, t) / 2;
    A.push([p[0] + n[0] * w * d0, p[1] + n[1] * w * d0]); B.push([p[0] + n[0] * w * d1, p[1] + n[1] * w * d1]);
  }
  for (let i = 0; i < 8; i++) { tri(out, A[i], A[i + 1], B[i + 1], col); tri(out, A[i], B[i + 1], B[i], col); }
}
function superPoly(cu, cv, hw, hh, tilt, ex) {
  const ct = Math.cos(tilt), st = Math.sin(tilt), poly = [];
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const x = hw * Math.sign(c) * Math.abs(c) ** (2 / ex), y = hh * Math.sign(s) * Math.abs(s) ** (2 / ex);
    poly.push([cu + x * ct - y * st, cv + x * st + y * ct]);
  }
  return poly;
}
function grid(out, g, pal) {
  const [cu, cv, hw, hh, tilt, ex, ol, hy, x1, x2, x3, lw, skew] = g, ct = Math.cos(tilt), st = Math.sin(tilt);
  const Q = (x, y) => { x += skew * y; return [cu + x * ct - y * st, cv + x * st + y * ct]; };
  fan(out, superPoly(cu, cv, hw, hh, tilt, ex), pal.ink);
  fan(out, superPoly(cu, cv, Math.max(hw - ol, .002), Math.max(hh - ol, .002), tilt, ex), pal.white);
  const bar = (a, b, c, d) => { tri(out, a, b, c, pal.ink); tri(out, a, c, d, pal.ink); };
  const hx = hw - ol / 2;
  bar(Q(-hx, hy - lw / 2), Q(hx, hy - lw / 2), Q(hx, hy + lw / 2), Q(-hx, hy + lw / 2));
  for (const x of [x1, x2, x3]) {
    const yl = (hh - ol / 2) * Math.pow(Math.max(1 - Math.pow(Math.abs(x) / hw, ex), .02), 1 / ex);
    bar(Q(x - lw / 2, -yl), Q(x + lw / 2, -yl), Q(x + lw / 2, yl), Q(x - lw / 2, yl));
  }
}
export function faceTriangles(state, pal = PAL) {
  const out = [];
  for (const i of [0, 1]) {
    const lid = state.lid?.[i];
    const eye = pal.eye ?? pal.ink;
    if (state.dome?.[i] && lid) dome(out, state.dome[i], lid.slice(0, 8), eye);
    if (lid) stroke(out, lid, eye);
    if (state.brow?.[i]) stroke(out, state.brow[i], pal.ink);
  }
  const m = state.mouth;
  if (m) {
    if (state.ms === 'grid') grid(out, m, pal);
    else {
      stroke(out, m, pal.ink);
      if (state.ms === 'D' || state.ms === 'Dtongue') stroke(out, m, pal.maroon, state.inset ?? pal.inset ?? .03);
      for (const c of state.cells || []) cell(out, m, c, pal.white);
      if (state.tongue) ellipse(out, state.tongue, pal.tongue);
    }
  }
  const colOf = c => typeof c === 'number' || (typeof c === 'string' && c[0] === '#') ? c : c === 'eye' ? (pal.eye ?? pal.ink) : (pal[c || 'ink'] ?? pal.ink);
  for (const e of state.extras || []) ellipse(out, e.ell, colOf(e.color));
  return out;
}

// ---------- the surface ----------
function poseMatrix([yaw, pitch, roll]) {
  const D = Math.PI / 180, y = yaw * D, p = pitch * D, r = roll * D;
  const a = Math.cos(y), b = Math.sin(y), c = Math.cos(p), d = Math.sin(p), e = Math.cos(r), f = Math.sin(r);
  return mul3(mul3([[a, 0, b], [0, 1, 0], [-b, 0, a]], [[1, 0, 0], [0, c, -d], [0, d, c]]), [[e, f, 0], [-f, e, 0], [0, 0, 1]]); // Ry Rx Rz
}
function mul3(A, B) { return A.map(row => [0, 1, 2].map(j => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j])); }

function subdivide(tris, maxEdge) {
  const m2 = maxEdge * maxEdge, long = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 > m2, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const out = [], stack = [];
  for (let i = tris.length - 4; i >= 0; i -= 4) stack.push([tris[i], tris[i + 1], tris[i + 2], tris[i + 3]]);
  while (stack.length) {
    const [a, b, c, col] = stack.pop(), ab = long(a, b), bc = long(b, c), ca = long(c, a);
    // the same edge splits the same way from both sides, so no cracks
    if (!ab && !bc && !ca) { out.push(a, b, c, col); continue; }
    const mab = ab && mid(a, b), mbc = bc && mid(b, c), mca = ca && mid(c, a), n = ab + bc + ca;
    let parts;
    if (n === 3) parts = [[a, mab, mca], [mab, b, mbc], [mca, mbc, c], [mab, mbc, mca]];
    else if (n === 1) parts = ab ? [[a, mab, c], [mab, b, c]] : bc ? [[a, b, mbc], [a, mbc, c]] : [[a, b, mca], [mca, b, c]];
    else if (!ab) parts = [[a, b, mbc], [a, mbc, mca], [mca, mbc, c]];
    else if (!bc) parts = [[mab, b, c], [a, mab, mca], [mab, c, mca]];
    else parts = [[a, mab, mbc], [mab, b, mbc], [a, mbc, c]];
    for (let i = parts.length - 1; i >= 0; i--) stack.push([...parts[i], col]);
  }
  return out;
}

// ---------- the part ----------
// loadTrack(): the default track (src/faceTrack.json), cached here for tools only. Each built face keeps its own in root.userData.track
// (params.tracks / params.track, see tracks.js), so two faces in one page never share a track.
let DEFAULT_TRACK = null;
export async function loadTrack() {
  if (!DEFAULT_TRACK) DEFAULT_TRACK = await (await fetch(new URL('./faceTrack.json', import.meta.url))).json();
  return DEFAULT_TRACK;
}
export function build(params = {}) {
  const { surfR, palette } = params;
  let TRACK = null;
  const root = new THREE.Group(); root.name = 'face';
  root.userData.stale = new Set();
  // the last frame the track draws; past it the face holds that frame (engineer: f101, then the caption covers him and he drops out)
  root.userData.holdAfter = params.holdAfter;
  const geo = new THREE.BufferGeometry();
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, forceSinglePass: true, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 20; mesh.frustumCulled = false; mesh.userData.noOutline = true;
  root.add(mesh);
  const pal = { ...PAL };
  // SPEED (2026-11-04, speed/REPORT.md): the drawing on the sphere (triangles, subdivision, the point on the sphere) depends on the state
  // without its pose, so it is cached by that; a frame only turns it by the pose (the same float64 sums as before: the same vertices).
  // A character is updated up to 3 times a frame (main, sun shadow, main): the 2nd and 3rd call, and every frame a face holds still,
  // cost the turn only. Buffers are reused when the count holds (no new GPU buffer per call). Bounding sphere: lazy (frustumCulled is off).
  const cache = new Map();
  let lastEntry = null;
  root.setFace = (state, opts = {}) => {
    const r = opts.surfR ?? surfR ?? TRACK?.surfR ?? .4625, flip = state.flip ?? 1, M = poseMatrix(state.pose || [0, 0, 0]);
    Object.assign(pal, TRACK?.palette || {}, palette || {});
    pal.eye = state.eyeColor ?? params.eyeColor ?? palette?.eye ?? TRACK?.palette?.eye ?? pal.ink;
    const { pose: _pose, ...rest } = state, key = JSON.stringify([rest, flip, r, pal]);
    let E = cache.get(key);
    if (!E) {
      const tris = subdivide(faceTriangles(state, pal), MAX_EDGE), n = tris.length / 4 * 3;
      const loc = new Float64Array(n * 3), col = new Float32Array(n * 3), c = new THREE.Color();
      const lim = (r * .995) ** 2;
      let k = 0;
      for (let i = 0; i < tris.length; i += 4) {
        c.set(tris[i + 3]);
        for (let j = 0; j < 3; j++) {
          let x = flip * tris[i + j][0] * .5, y = -tris[i + j][1] * .5;
          const rho = x * x + y * y; if (rho > lim) { const s = Math.sqrt(lim / rho); x *= s; y *= s; }
          loc[k * 3] = x; loc[k * 3 + 1] = y; loc[k * 3 + 2] = Math.sqrt(Math.max(r * r - x * x - y * y, 1e-9));
          col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
          k++;
        }
      }
      E = { n, loc, col };
      if (cache.size >= 24) cache.delete(cache.keys().next().value);
      cache.set(key, E);
    }
    const n = E.n, loc = E.loc;
    let pa = geo.attributes.position;
    if (!pa || pa.count !== n) { pa = new THREE.BufferAttribute(new Float32Array(n * 3), 3); geo.setAttribute('position', pa); }
    const pos = pa.array;
    for (let k = 0; k < n * 3; k += 3) {
      const x = loc[k], y = loc[k + 1], z = loc[k + 2];
      pos[k] = M[0][0] * x + M[0][1] * y + M[0][2] * z;
      pos[k + 1] = M[1][0] * x + M[1][1] * y + M[1][2] * z;
      pos[k + 2] = M[2][0] * x + M[2][1] * y + M[2][2] * z;
    }
    pa.needsUpdate = true;
    if (lastEntry !== E || !geo.attributes.color || geo.attributes.color.count !== n) {
      let ca = geo.attributes.color;
      if (!ca || ca.count !== n) { ca = new THREE.BufferAttribute(new Float32Array(n * 3), 3); geo.setAttribute('color', ca); }
      ca.array.set(E.col); ca.needsUpdate = true; lastEntry = E;
    }
    geo.boundingSphere = null; geo.boundingBox = null;
  };
  const { track: _t, tracks: _ts, holdAfter: _h, surfR: _s, palette: _p, ...faceSpec } = params;
  root.userData.faceSpec = faceSpec; // spec.face (+ id): per-character face params for faceset.js
  const ready = Promise.all([params.track || params.tracks ? loadTrackFrom(params, 'face') : loadTrack(), kitReady]).then(a => a[0]);
  return ready.then(t => {
    TRACK = t; root.userData.track = t;
    const keys = Object.keys(t.frames).map(Number);
    if (root.userData.holdAfter === undefined) root.userData.holdAfter = Math.max(...keys); // f101 for the engineer's track
    root.setFace(t.frames[String(Math.min(...keys))]); // f0 for the engineer
    return root;
  });
}
export function update(frame, ctx) {
  const root = ctx.root, TRACK = root.userData.track, hold = root.userData.holdAfter;
  const f = TRACK.frames[String(Math.min(frame, hold))]; // engineer f102-108 (caption over the head, then he drops out): he keeps the wince of f101
  root.visible = !!f;
  if (!f) return;
  // ctx.face = the Pose face channel { eyes, brow, mouth } (state names, engine/faceset.js): draw the composed drawing at the record's pose/flip
  const nm = ctx.face;
  if (nm && (nm.eyes || nm.brow || nm.mouth) && kit()) root.setFace({ ...faceState(nm, root.userData.faceSpec), pose: f.pose, flip: f.flip });
  else root.setFace(f);
  // The decal was fitted through one camera. If the head's camera changed since, say so: rerun tools/face_fit.py.
  const c = ctx.cam, w = f.cam, STALE = root.userData.stale;
  if (frame <= hold && w && (Math.abs(c.cx - w[0]) > .7 || Math.abs(c.cy - w[1]) > .7 || Math.abs(c.d - w[2]) > 1 || Math.abs(c.az - w[4]) > .5 || Math.abs(c.el - w[5]) > .5 || Math.abs(c.roll - w[3]) > .5) && !STALE.has(frame) && !ctx.freeCamera) { STALE.add(frame); console.log(`face f${frame}: camera changed since the fit (track az ${w[4]} el ${w[5]} roll ${w[3]}), rerun tools/face_fit.py`); }
}

// ---------- states moving into each other ----------
const lerpArr = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
function closed(lid) { const P = lid.slice(0, 8); const m = cubicAt(P, .5); return [m[0], m[1], .01, .0005, 0, 0]; }
export function lerpFace(a, b, t) {
  const out = { ...(t < .5 ? a : b), pose: lerpArr(a.pose, b.pose, t), flip: t < .5 ? a.flip : b.flip };
  out.lid = [0, 1].map(i => lerpArr(a.lid[i], b.lid[i], t));
  out.dome = [0, 1].map(i => { const A = a.dome?.[i], B = b.dome?.[i]; if (!A && !B) return null; return lerpArr(A || closed(a.lid[i]), B || closed(b.lid[i]), t); });
  out.brow = [0, 1].map(i => { const A = a.brow?.[i], B = b.brow?.[i]; return A && B ? lerpArr(A, B, t) : (t < .5 ? A : B) || null; });
  if (a.ms !== 'grid' && b.ms !== 'grid' && a.mouth && b.mouth) out.mouth = lerpArr(a.mouth, b.mouth, t);
  return out;
}

// ---------- the guide's other states (Part 4), from the Scene 1 proportions; hypotheses until a frame checks them ----------
const flatStroke = (u0, v0, u1, v1, w, b = 0) => [u0, v0, lerp(u0, u1, 1 / 3), lerp(v0, v1, 1 / 3) + b, lerp(u0, u1, 2 / 3), lerp(v0, v1, 2 / 3) + b, u1, v1, w * .7, w, w, w, w * .7];
const EX = .23, EV = 0;
export function guideState(name) {
  const base = { pose: [0, 0, 0], flip: 1, lid: [null, null], dome: [null, null], brow: [null, null], mouth: null, cells: [], tongue: null, ms: 'smirk', extras: [] };
  const eye = (fn) => [-EX, EX].flatMap(fn);
  if (name === 'buttonOval') base.extras = eye(u => [{ ell: [u, EV + .02, .095, .13, 0], color: 'ink' }]);
  if (name === 'manicRinged') base.extras = eye(u => [{ ell: [u, EV, .2, .2, 0], color: 'ink' }, { ell: [u, EV, .165, .165, 0], color: 'white' }, { ell: [u, EV, .065, .065, 0], color: 'ink' }]);
  if (name === 'shockPinpoint') base.extras = eye(u => [{ ell: [u, EV, .23, .23, 0], color: 'ink' }, { ell: [u, EV, .195, .195, 0], color: 'white' }, { ell: [u, EV, .03, .03, 0], color: 'ink' }]);
  if (name === 'downArc') base.lid = [flatStroke(-EX - .15, EV - .03, -EX + .15, EV - .03, .045, .09), flatStroke(EX - .15, EV - .03, EX + .15, EV - .03, .045, .09)];
  if (name === 'scowl') { base.lid = [flatStroke(-EX - .14, EV - .02, -EX + .14, EV + .03, .05), flatStroke(EX - .14, EV + .03, EX + .14, EV - .02, .05)]; base.dome = [[-EX, EV + .07, .085, .1, 0, 0], [EX, EV + .07, .085, .1, 0, 0]]; base.brow = [flatStroke(-EX - .17, EV - .2, -EX + .13, EV - .08, .075), flatStroke(EX - .13, EV - .08, EX + .17, EV - .2, .075)]; }
  if (name === 'gaspO') base.extras.push({ ell: [0, .42, .13, .115, 0], color: 'maroon' });
  if (name === 'aweU') { base.mouth = flatStroke(-.08, .4, .08, .4, .05, .06).concat([]); base.mouth = [...base.mouth.slice(0, 8), .02, .05, .07, .08, .07, .05, .02]; }
  return base;
}
