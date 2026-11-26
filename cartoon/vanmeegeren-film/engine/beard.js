// beard.js: facial hair as vector shapes on the FACE layer (no textures). It rides the face exactly: the same decal space as face.js
// (u viewer right, v down, R = half the head diameter, origin between the eyes) and the same pose matrix, so when the face slides on
// the head (rules), the beard slides with it. Past the face disc (the chin, a beard over the chest) the shape leaves the sphere as an
// apron bent back from the rim, so a full beard can hang over the jaw and the chest (STYLE_BIBLE: Worker 3).
//   buildFacialHair({ kind, colour, seed, scale, pull }) -> Object3D (head space) with .update(faceRecord)
//     kind  'full' | 'goatee' | 'stubble' | 'moustache' | 'walrus' | 'handlebar' | 'mutton'
//     faceRecord = the face state face.js draws ({ pose:[yaw,pitch,roll], flip, on }) or { state, surfR }. on === false hides it.
// Also exports the decal kit glasses.js uses: decalLayer, fill, strokeLine, ring, twoTone, spline2.
import * as THREE from './three.js';

const INK = 0x3a2a33;
export const BEARD_COLOURS = { brown: 0x563727, dark: 0x2e2429, black: 0x262027, grey: 0xd7cec6, white: 0xf2ece5, blond: 0xd5b979, red: 0x7c4628, ginger: 0xb0582c };

// ---------- 2D kit (decal space) ----------
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function spline2(P, closed = false, k = 10) {
  const n = P.length, out = [], at = i => closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(c => .5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  if (!closed) out.push(P[n - 1].slice());
  return out;
}
const tri = (out, a, b, c, col) => out.push(a, b, c, col);
export function fill(out, poly, col) {
  const idx = THREE.ShapeUtils.triangulateShape(poly.map(p => new THREE.Vector2(p[0], p[1])), []);
  for (const [a, b, c] of idx) tri(out, poly[a], poly[b], poly[c], col);
}
// a brush stroke: width w(t) (R units) along a polyline, round tips; brushy = his ink (thicker in the middle, thin ends)
export function strokeLine(out, pts, w, col, { closed = false, caps = true } = {}) {
  const n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1e-6; tx /= l; ty /= l;
    const h = (typeof w === 'function' ? w(i / (closed ? n : n - 1)) : w) / 2;
    L.push([pts[i][0] - ty * h, pts[i][1] + tx * h]); R.push([pts[i][0] + ty * h, pts[i][1] - tx * h]);
  }
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) { const j = (i + 1) % n; tri(out, L[i], L[j], R[j], col); tri(out, L[i], R[j], R[i], col); }
  if (caps && !closed) for (const i of [0, n - 1]) {
    const r = (typeof w === 'function' ? w(i / (n - 1)) : w) / 2, c = pts[i], poly = [];
    if (r < 1e-4) continue;
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; poly.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
    fill(out, poly, col);
  }
}
// brushy width: a base width that swells and thins along the stroke, hashed so it doesn't shimmer
export const brush = (w, seed = 1, taper = true) => { const R = rng(seed), ph = R() * 6.28, f = 2 + R() * 2; return t => w * (taper ? .35 + .65 * Math.sin(Math.PI * t) ** .6 : 1) * (1 + .22 * Math.sin(t * f * 6.28 + ph)); };
export const ring = (cu, cv, rx, ry, n = 48, a0 = 0, a1 = Math.PI * 2) => Array.from({ length: n + (a1 - a0 < 6.28 ? 1 : 0) }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cu + rx * Math.cos(a), cv + ry * Math.sin(a)]; });
// flat 2-tone: the whole shape dark, a lit copy shrunk and pushed to the viewer's left/up on top (a dark crescent stays right/down)
export function twoTone(out, poly, dark, lit, k = .86, du = -.06, dv = -.05) { // du dv: shift as a fraction of the shape's size
  let cu = 0, cv = 0; for (const p of poly) { cu += p[0]; cv += p[1]; } cu /= poly.length; cv /= poly.length;
  fill(out, poly, dark);
  const w = Math.max(...poly.map(p => p[0])) - Math.min(...poly.map(p => p[0])), h = Math.max(...poly.map(p => p[1])) - Math.min(...poly.map(p => p[1]));
  fill(out, poly.map(p => [cu + (p[0] - cu) * k + du * w, cv + (p[1] - cv) * k + dv * h]), lit);
}
function scallop(pts, amp, period, seed, sign = 1) {
  const R = rng(seed), out = []; let s = 0, next = period * (.8 + .4 * R()), from = 0, a = amp * (.7 + .6 * R());
  for (let i = 0; i < pts.length; i++) {
    if (i) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (s - from > next) { from = s; next = period * (.8 + .4 * R()); a = amp * (.7 + .6 * R()); }
    const u = (s - from) / next, b = a * Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2));
    const p = pts[Math.max(0, i - 1)], q = pts[Math.min(pts.length - 1, i + 1)]; let tx = q[0] - p[0], ty = q[1] - p[1]; const l = Math.hypot(tx, ty) || 1;
    out.push([pts[i][0] - ty / l * b * sign, pts[i][1] + tx / l * b * sign]);
  }
  return out;
}

// ---------- the surface: decal -> head space, exactly face.js's mapping, plus the apron past the rim ----------
function poseMatrix([yaw, pitch, roll]) {
  const D = Math.PI / 180, y = yaw * D, p = pitch * D, r = roll * D;
  const a = Math.cos(y), b = Math.sin(y), c = Math.cos(p), d = Math.sin(p), e = Math.cos(r), f = Math.sin(r);
  return mul3(mul3([[a, 0, b], [0, 1, 0], [-b, 0, a]], [[1, 0, 0], [0, c, -d], [0, d, c]]), [[e, f, 0], [-f, e, 0], [0, 0, 1]]);
}
function mul3(A, B) { return A.map(row => [0, 1, 2].map(j => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j])); }
function subdivide(tris, maxEdge) {
  const m2 = maxEdge * maxEdge, long = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 > m2, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const out = [], stack = [];
  for (let i = tris.length - 4; i >= 0; i -= 4) stack.push([tris[i], tris[i + 1], tris[i + 2], tris[i + 3]]);
  while (stack.length) {
    const [a, b, c, col] = stack.pop(), ab = long(a, b), bc = long(b, c), ca = long(c, a);
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
// one mesh on the face layer. make(flip) returns decal triangles [a, b, c, colour, ...] for that mirror (shading stays viewer-left).
// pull: depth toward the camera in D (face.js gets .05 in char.js); lift: how far above the face surface (D).
export function decalLayer(make, { name = 'decal', renderOrder = 21, pull = .06, lift = .002, apron = .35, opacity = 1 } = {}) {
  const geo = new THREE.BufferGeometry();
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  mat.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n{ vec4 _c = projectionMatrix * vec4(mvPosition.xy, mvPosition.z + ${pull.toFixed(4)}, 1.0); gl_Position.z = _c.z / _c.w * gl_Position.w; }`); };
  mat.customProgramCacheKey = () => 'czdecal' + pull.toFixed(4); // the pull is baked in the shader: one program per pull
  const mesh = new THREE.Mesh(geo, mat); mesh.name = name; mesh.renderOrder = renderOrder; mesh.frustumCulled = false; mesh.userData.noOutline = true;
  const cache = {};
  const trisFor = f => cache[f] ??= subdivide(make(f), .05);
  let lastKey = '', lastLocal = null;
  const local = {};
  mesh.update = (rec = {}) => {
    const st = rec.state || rec, on = st.on ?? rec.on;
    mesh.visible = on !== false && on !== 0;
    if (!mesh.visible) return;
    const flip = (st.flip ?? 1) < 0 ? -1 : 1, pose = st.pose || [0, 0, 0], r = (rec.surfR ?? st.surfR ?? .4625) + lift;
    const key = flip + ',' + pose.join(',') + ',' + r; if (key === lastKey) return; lastKey = key;
    // SPEED (2026-11-04): the decal on the sphere depends on (flip, r) only: cached; a call turns it by the pose with the same float64
    // sums as before, into the same buffers (no new GPU buffer per call); bounding sphere lazy (frustumCulled is off)
    const lk = flip + ',' + r;
    let E = local[lk];
    if (!E) {
      const tris = trisFor(flip), n = tris.length / 4 * 3, loc = new Float64Array(n * 3), col = new Float32Array(n * 3), c = new THREE.Color();
      const lim = r * .995, zr = Math.sqrt(r * r - lim * lim);
      let k = 0;
      for (let i = 0; i < tris.length; i += 4) {
        c.set(tris[i + 3]);
        for (let j = 0; j < 3; j++) {
          const x = tris[i + j][0] * .5, y = -tris[i + j][1] * .5, rho = Math.hypot(x, y);
          // on the sphere inside the disc; past it an apron that keeps going in the decal plane and bends back
          const z = rho <= lim ? Math.sqrt(Math.max(r * r - rho * rho, 1e-9)) : zr - (rho - lim) * apron;
          loc[k * 3] = x; loc[k * 3 + 1] = y; loc[k * 3 + 2] = z;
          col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; k++;
        }
      }
      E = local[lk] = { n, loc, col };
    }
    const M = poseMatrix(pose), n = E.n, loc = E.loc;
    let pa = geo.attributes.position;
    if (!pa || pa.count !== n) { pa = new THREE.BufferAttribute(new Float32Array(n * 3), 3); geo.setAttribute('position', pa); }
    const pos = pa.array;
    for (let k = 0; k < n * 3; k += 3) {
      const x = loc[k], y = loc[k + 1], z = loc[k + 2];
      pos[k] = M[0][0] * x + M[0][1] * y + M[0][2] * z; pos[k + 1] = M[1][0] * x + M[1][1] * y + M[1][2] * z; pos[k + 2] = M[2][0] * x + M[2][1] * y + M[2][2] * z;
    }
    pa.needsUpdate = true;
    if (lastLocal !== E) { let ca = geo.attributes.color; if (!ca || ca.count !== n) { ca = new THREE.BufferAttribute(new Float32Array(n * 3), 3); geo.setAttribute('color', ca); } ca.array.set(E.col); ca.needsUpdate = true; lastLocal = E; }
    geo.boundingSphere = null; geo.boundingBox = null;
  };
  return mesh;
}
export function shades(colour) {
  const c = new THREE.Color(typeof colour === 'string' && BEARD_COLOURS[colour] !== undefined ? BEARD_COLOURS[colour] : colour), h = {};
  c.getHSL(h, THREE.SRGBColorSpace);
  const dark = new THREE.Color().setHSL(h.h, h.s, h.l * (h.l > .7 ? .9 : .78), THREE.SRGBColorSpace).getHex();
  const lit = c.getHex(), strokeC = new THREE.Color().setHSL(h.h, h.s, h.l * (h.l > .7 ? .78 : .62), THREE.SRGBColorSpace).getHex();
  return { dark, lit, stroke: strokeC };
}

// ---------- the kinds ----------
const mir = (P, f) => P.map(([u, v]) => [u * f, v]);
const sym = half => [...half, ...half.slice().reverse().map(([u, v]) => [-u, v])]; // left half (u<0) top->bottom, mirrored
function shapeTris(kind, f, col, seed, s) {
  const out = [], S = P => P.map(([u, v]) => [u * s, v * s]);
  const W = (w, sd, taper = true) => brush(w * s, seed + sd, taper);
  // FC (overnight 2, FABLE_REVIEW2 item 2): his hand = ONE flat fill + ONE bold ink outline at the face's stroke weight (lids ~.05 R),
  // no inner hair strokes, no 2-tone crescent, no pencil texture. inkW args below are ignored: every outline is BOLD.
  // PR2 (FABLE_REVIEW3 item 10): at .05 R a moustache outline on the lower face (foreshortened by the sphere) read thinner than every
  // other line on the character at film head sizes (200-450 px); .078 R matches the brows and the frames (glasses.js FW) by eye.
  const BOLD = .078;
  const shape = (outline, inkW = BOLD, sd = 0) => { fill(out, outline, col.lit); strokeLine(out, outline, brush(BOLD, seed + sd, false), INK, { closed: true }); }; // weight does not shrink with scale
  const strokes = () => {}; // FC: hair strokes removed (they read as hatching / a second hand)
  const _strokesOld = (region, n, len, sd) => { // kept for reference only (Worker 3's vertical hair strokes), never called
    const R = rng(seed + sd), minU = Math.min(...region.map(p => p[0])), maxU = Math.max(...region.map(p => p[0])), minV = Math.min(...region.map(p => p[1])), maxV = Math.max(...region.map(p => p[1]));
    const inside = (u, v) => { let c = false; for (let i = 0, j = region.length - 1; i < region.length; j = i++) { const a = region[i], b = region[j]; if ((a[1] > v) !== (b[1] > v) && u < (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
    for (let i = 0, got = 0; i < n * 8 && got < n; i++) {
      const u = minU + (maxU - minU) * R(), v = minV + (maxV - minV) * R();
      if (!inside(u, v) || !inside(u, v + len) || !inside(u, v - len * .2)) continue;
      got++; strokeLine(out, [[u, v], [u + (R() - .5) * .03 * s, v + len * .5], [u + (R() - .5) * .04 * s, v + len]], W(.018, i), col.stroke);
    }
  };
  if (kind === 'full') {
    // P (overnight 2): the top U stays UNDER the mouth at any scale (scaling v too lifted it over the mouth: chef's lines played on black)
    // SP (overnight 2): a full beard is ONE solid mass over jaw, chin and cheeks BELOW the mouth. The old top U climbed to the eye line at
    // the ears (v -.06) and carried an extra thick ink U: with a pale beard (Gus) only the ink read, a chin-strap frame round the face.
    // Now the top edge is a shallow arc from the cheeks at mouth height (v .3 at the sides) to under the mouth, no second ink U.
    const top = [[-.86, .3], [-.68, .4], [-.48, .5], [-.25, .58], [0, .61]].map(([u, v]) => [u * s, v]);
    const outer = S([[-.92, .3], [-1.02, .5], [-1.04, .74], [-.94, 1.05], [-.72, 1.38], [-.4, 1.58], [0, 1.66]]);
    // outline: top arc left cheek -> centre -> right cheek, outer right cheek -> bottom -> left cheek (scalloped clumps)
    const topL = spline2(top, false, 8), topR = mir(topL, -1).reverse();
    const outR = scallop(mir(spline2(outer, false, 8), -1), .035 * s, .3 * s, seed, 1), outL = scallop(spline2(outer, false, 8).reverse(), .035 * s, .3 * s, seed + 3, 1);
    const poly = [...topL, ...topR.slice(1), ...outR, ...outL.slice(1, -1)];
    // a pale beard (grey/white, L > .75) would vanish into the skin and leave only its outline: fill it one step darker so the MASS reads
    const lh = new THREE.Color(col.lit).getHSL({}, THREE.SRGBColorSpace);
    const massCol = lh.l > .75 ? { ...col, lit: new THREE.Color().setHSL(lh.h, lh.s, .66, THREE.SRGBColorSpace).getHex() } : col;
    fill(out, mir(poly, f), massCol.lit); strokeLine(out, mir(poly, f), brush(BOLD, seed + 1, false), INK, { closed: true });
    strokes(mir(poly, f), 26, .11 * s, 5);
  }
  if (kind === 'goatee') {
    // W3: a real goatee = a thin moustache over the mouth joined at the corners to a chin tuft under it (the old lone blob under the
    // mouth read as a tooth). Mouth: centre v ~.4, corners u ~+-.2. One mass, dark crescent right/down, clumped pointed tip, hair strokes.
    const tuft = S([[-.06, .53], [-.17, .52], [-.24, .6], [-.21, .76], [-.12, .92], [-.03, 1.03], [0, 1.06]]);
    const chin = spline2([...tuft, ...mir(tuft, -1).reverse().slice(1)], true, 6);
    shape(mir(chin, f), .03, 1);
    strokes(mir(chin, f), 7, .1 * s, 3);
    // the moustache: two tapered wings from under the nose round the mouth corners down to the tuft's shoulders
    const half = S([[-.02, .27], [-.12, .25], [-.24, .3], [-.29, .42], [-.26, .52], [-.22, .44], [-.17, .34], [-.08, .33], [-.02, .34]]);
    shape(mir(spline2([...half, ...mir(half, -1).reverse()], true, 6), f), .026, 5);
  }
  if (kind === 'stubble') {
    // W3: stubble must not read as a pale beard: no filled patch any more. A dense field of tiny dark specks/ticks along the jaw, chin and
    // upper lip only (fading toward the cheeks), in the hair colour mixed a little toward the skin. Reads as a five-o'clock shadow at film size.
    const R = rng(seed), region = spline2(S([[-.74, .26], [-.66, .55], [-.4, .84], [0, .93], [.4, .84], [.66, .55], [.74, .26], [.5, .42], [.26, .5], [.3, .3], [0, .24], [-.3, .3], [-.26, .5], [-.5, .42]]), true, 6);
    const inside = (u, v) => { let c = false; for (let i = 0, j = region.length - 1; i < region.length; j = i++) { const a = region[i], b = region[j]; if ((a[1] > v) !== (b[1] > v) && u < (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
    const skin = new THREE.Color(0xf3ebe8), dark = new THREE.Color(col.lit).getHSL({}, THREE.SRGBColorSpace).l < .5;
    // specks stay > 40 RGB from the ink colour (#3a2a33): darker ones merged with the jaw's outline (checks turn_ink, a ragged ring)
    const tickC = (dark ? skin.clone().lerp(new THREE.Color(col.lit), .78) : new THREE.Color(col.stroke)).getHex();
    const tickC2 = (dark ? skin.clone().lerp(new THREE.Color(col.lit), .62) : new THREE.Color(col.dark)).getHex();
    // no fill at all: any flat tint (W2's 28 %, even 9 %) reads as a pale grey beard shape at film size
    const mouthClear = (u, v) => Math.hypot(u / (.22 * s), (v - .42 * s) / (.05 * s)) < 1; // keep the mouth line itself clean
    const speckC = (dark ? skin.clone().lerp(new THREE.Color(col.lit), .75) : new THREE.Color(col.stroke)).getHex(); // > 40 RGB off the ink
    // FC (FABLE_REVIEW2 item 2): stubble = a FEW BOLD specks in his stroke weight (the 260 hair ticks read as pencil texture / a second hand).
    // A U of specks along the jaw and chin, an inner row of 4 on the chin; hashed jitter so it isn't a dotted line. Never on the outline.
    {
      const U = [];
      for (let k = 0; k < 9; k++) { const a = Math.PI * (.14 + .72 * k / 8); U.push([-Math.cos(a) * .54, .42 + Math.sin(a) * .3 + (k % 2) * .06]); }
      for (const uu of [-.21, -.07, .07, .21]) U.push([uu, .64 + .02 * Math.abs(uu) * 3]);
      for (const [u0, v0] of U) {
        const u = (u0 + (R() - .5) * .08) * s, v = (v0 + (R() - .5) * .07) * s, a = (R() - .5) * .8, l = .022 * s;
        if (Math.hypot(u, v) > .8 || mouthClear(u, v)) continue;
        strokeLine(out, mir([[u, v], [u + Math.sin(a) * l, v + Math.cos(a) * l]], f), .036 * s, speckC);
      }
    }
    for (let i = 0, got = 0; i < 0 && got < 260; i++) { // FC: the old dense tick field, off
      const u = (R() - .5) * 1.6 * s, v = R() * .95 * s;
      if (!inside(u, v) || mouthClear(u, v)) continue;
      if (Math.hypot(u, v) > .8) continue; // never on the head's outline (rim ~ .92 in decal units): specks over the ring broke the ink
      // densest along the jaw and chin, thinning up the cheeks (no hard top edge)
      const up = Math.max(0, (.62 - v / s) / .4) * Math.min(1, Math.abs(u) / s / .3);
      if (R() < up * .85) continue;
      got++;
      const a = (R() - .5) * .7, l = (.016 + R() * .012) * s;
      strokeLine(out, mir([[u, v], [u + Math.sin(a) * l, v + Math.cos(a) * l]], f), (.011 + R() * .004) * s, R() < .6 ? tickC : tickC2, { caps: false });
    }
  }
  if (kind === 'moustache') {
    const half = S([[-.02, .22], [-.14, .16], [-.3, .18], [-.44, .3], [-.36, .36], [-.18, .31], [-.02, .32]]);
    const poly = spline2([...half, ...mir(half, -1).reverse()], true, 6);
    shape(mir(poly, f), .03, 1);
  }
  if (kind === 'walrus') {
    // P (overnight 2): the drop ends ABOVE the mouth's lower half (centre v .44, was .56 = the whole mouth hidden: FABLE_REVIEW 2);
    // the corners still droop past the mouth corners so it reads walrus, and the mouth draws over the lower edge (renderOrder 19)
    // W6 2026-11-04 (FABLE_REVIEW4 item 2: "a scribbled moustache ... collapses into one dark smudge at mid-shot"): the scalloped lower
    // edge (a cusp every .2 R) + the mouth line over it + a fill the colour of the skin read as a scribble. Now ONE clean solid shape in
    // his hand: a smooth arch under the nose, full cheeks, corners drooping past the mouth corners, a smooth lower edge with one shallow
    // notch in the middle (no clumps, no cusps), filled with a visible cool grey mass (pale hair = the hair's grey, like bald_sides) and
    // the bold ink outline. Reads as one shape at head 150 px. The lower edge (v .38 centre -> .465 at u .39) stays just above Walter's
    // mouth (kit cast.walter mouthV .1): the mouth peeks out under it instead of running along the edge.
    const half = S([[0, .2], [-.12, .16], [-.26, .17], [-.4, .24], [-.5, .36], [-.53, .48], [-.48, .55], [-.39, .465], [-.25, .41], [-.1, .385], [0, .38]]);
    const L = spline2(half, false, 8), poly = [...L, ...mir(L, -1).reverse().slice(1, -1)];
    const lh = new THREE.Color(col.lit).getHSL({}, THREE.SRGBColorSpace);
    const mass = lh.l > .75 ? new THREE.Color().setHSL(lh.h, Math.min(lh.s, .12), .8, THREE.SRGBColorSpace).getHex() : col.lit;
    fill(out, mir(poly, f), mass); strokeLine(out, mir(poly, f), BOLD * .9, INK, { closed: true });
  }
  if (kind === 'handlebar') {
    const half = S([[-.02, .28], [-.14, .25], [-.3, .28], [-.42, .26], [-.5, .17], [-.47, .1], [-.43, .16], [-.45, .22], [-.38, .32], [-.22, .35], [-.02, .35]]);
    const poly = spline2([...half, ...mir(half, -1).reverse()], true, 6);
    shape(mir(poly, f), .028, 1);
  }
  if (kind === 'mutton') {
    for (const side of [-1, 1]) {
      const p = mir(S([[-.72, -.1], [-.86, .1], [-.86, .42], [-.66, .66], [-.42, .62], [-.36, .46], [-.52, .36], [-.66, .1]]), side);
      const poly = spline2(side < 0 ? p : p.slice().reverse(), true, 6);
      shape(mir(poly, f), .03, side + 2); strokes(mir(poly, f), 6, .1 * s, side + 7);
    }
    const half = S([[-.02, .28], [-.16, .25], [-.36, .32], [-.42, .44], [-.3, .4], [-.15, .36], [-.02, .36]]);
    shape(mir(spline2([...half, ...mir(half, -1).reverse()], true, 6), f), .028, 9);
  }
  return out;
}
export const BEARD_KINDS = ['full', 'goatee', 'stubble', 'moustache', 'walrus', 'handlebar', 'mutton'];

export function buildFacialHair({ kind = 'full', colour = 'grey', color, seed = 7, scale = 1, pull } = {}) {
  if (!BEARD_KINDS.includes(kind)) throw new Error(`beard: unknown kind "${kind}" (${BEARD_KINDS.join(', ')})`);
  const col = shades(color ?? colour);
  // a full beard / mutton reaches past the chin: pulled further so it draws over the torso, as his does
  const big = kind === 'full' || kind === 'mutton' || kind === 'goatee';
  // moustaches draw UNDER the face layer (face.js renderOrder 20): the talking mouth always reads over the moustache's lower edge
  // W3: the goatee carries a moustache round the mouth, so it draws under the face layer too (the mouth reads over it); its chin tuft
  // keeps the big pull so it still draws over the collar
  const mesh = decalLayer(f => shapeTris(kind, f, col, seed, scale), { name: 'beard.' + kind, renderOrder: big && kind !== 'goatee' ? 21 : 19, pull: pull ?? (big ? .3 : .06) });
  mesh.update({ pose: [0, 0, 0], flip: 1 });
  return mesh;
}
