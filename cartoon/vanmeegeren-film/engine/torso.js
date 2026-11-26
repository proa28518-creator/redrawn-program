// torso.js: the young engineer's torso, vest and pelvis. A real 3D body (rings of superellipse sections), every detail is an SDF
// in the body's own surface coordinates (s = arc length round the section from the front centre, y = height over the vest hem), so it
// wraps the form, foreshortens as the body turns and stays crisp at any size. Measured on f66/f67 (front), f80 (side), f3-f56 (three-quarter).
//
// Torso space: head diameter 1. Origin on the body axis at the vest hem, +Y up to the neck, +Z out of the chest, +X the character's left.
// exports: build(params), update(frame, ctx), SOCKETS (neck, shoulders, hips in torso space), DIMS.
// update() places the body relative to the camera, from torsoTrack.json: x, y = hem centre in frame px, D = px per torso unit, lean (deg, truth's
// vest.lean_deg), yaw (deg, the chest turned toward viewer right +), pitch (deg, seen from above +), sy (squash along the axis). tx ty s are the same place
// relative to the head (tx ty in head d from the head centre, +x viewer right, +y up; s = D / d), kept for reference.
// sy is a real pose, not a fudge: tools/torso_form.py with one free squash for the kneeling frames gives .845 and D / head d = .99-1.06 there (f66, f80: 1.01), near-round section;
// held at 1 it needs a squarer section (power 2.64), D / head d falls to .89 and it fits worse (rms 3.05 vs 2.66). A pitched body can't explain it: the hem stays a straight line.
// So a change of the head camera's az / el never moves the torso on screen. Use poseAt(frame) for the raw record, and
// torso.userData.body.matrixWorld to mount limbs on the sockets.
import * as THREE from './three.js';
import { loadTrack } from './tracks.js';
import { shapeOf, compileOutfit } from './outfit.js';

// Measured by tools/torso_form.py: one rigid layout + per-frame orientation on landmarks, hem and silhouette of f3 f19 f40 f56 f66 f80. See the head of update() for the squash.
export const DIMS = { hem: 0, top: .80, bottom: -.135, halfWidth: .279, taper: .174, taperDepth: .14, taperPow: 2.695, depthRatio: .974, power: 2.102, inkLeft: .020, inkRight: .053, inkBottom: .053 };

// Half width of the vest at height y over the hem: nearly straight from hem to shoulder, a small tuck at the hem corner, a quick cap (behind the head) at the top.
function vestWidth(y, taper = DIMS.taper) {
  const yy = Math.min(.66, Math.max(0, y));
  let a = DIMS.halfWidth * (1 - taper * Math.pow(yy / .66, DIMS.taperPow));
  a *= 1 - .055 * Math.exp(-Math.max(y, 0) / .035);
  if (y > .66) a *= Math.sqrt(Math.max(0, 1 - ((y - .66) / .14) ** 2));
  return a;
}

// The pelvis is its own form, tucked behind the vest: rounder and a little narrower, set back along z.
const PELVIS_W = [[.03, .255], [0, .255], [-.04, .245], [-.07, .222], [-.10, .185], [-.12, .14], [-.13, .10], [-.135, .0]];
export const PELVIS = { depthRatio: .95, power: 2, zOff: -.03 };
function pelvisWidth(y) {
  const P = PELVIS_W;
  if (y >= P[0][0]) return P[0][1];
  for (let i = 0; i < P.length - 1; i++) if (y <= P[i][0] && y >= P[i + 1][0]) return P[i][1] + (P[i + 1][1] - P[i][1]) * (P[i][0] - y) / (P[i][0] - P[i + 1][0]);
  return 0;
}

// ---- Outfit "boss" (params.outfit = 'boss'): the Boss's egg body + mustard vest. Additive: the engineer's path never reads any of this.
// Measured on f494 (front, d 313): outer width .94 D (inner half .435), widest in the lower third, hem to shoulder top about .9 D, a dark
// pelvis band about .09 D under the hem. Widths are inner (the hull's ink adds .03-.05 D outside).
const BOSS_W = [[0, .33], [.015, .362], [.04, .395], [.08, .42], [.15, .437], [.25, .446], [.36, .447], [.50, .44], [.62, .428], [.72, .415], [.80, .403], [.86, .388], [.90, .362], [.94, .318], [.97, .24], [.99, .12], [1.0, 0]];
const BOSS_PELVIS_W = [[.03, .34], [0, .335], [-.025, .315], [-.05, .275], [-.07, .21], [-.083, .13], [-.09, 0]];
const tableWidth = T => y => {
  const up = T[0][0] < T[T.length - 1][0];
  const P = up ? T : T.slice().reverse();
  if (y <= P[0][0]) return P[0][1];
  if (y >= P[P.length - 1][0]) return P[P.length - 1][1];
  for (let i = 0; i < P.length - 1; i++) if (y >= P[i][0] && y <= P[i + 1][0]) { const t = (y - P[i][0]) / (P[i + 1][0] - P[i][0]), s = t * t * (3 - 2 * t) * .35 + t * .65; return P[i][1] + (P[i + 1][1] - P[i][1]) * s; }
  return 0;
};
const bossWidth = tableWidth(BOSS_W), bossPelvisWidth = tableWidth(BOSS_PELVIS_W);
const BOSS_YS = () => {
  const ys = [];
  for (let i = 0; i <= 40; i++) ys.push(1.0 - .20 * (1 - Math.cos(i / 40 * Math.PI / 2)));
  for (let i = 1; i <= 60; i++) ys.push(.80 - .70 * i / 60);
  for (let i = 1; i <= 30; i++) ys.push(.10 - .10 * i / 30);
  return ys;
};
const BOSS_PELVIS_YS = () => {
  const ys = [];
  for (let i = 0; i <= 12; i++) ys.push(.03 - .03 * i / 12);
  for (let i = 1; i <= 48; i++) ys.push(-.12 * Math.sin(i / 48 * Math.PI / 2));
  return ys;
};
export const BOSS_SOCKETS = { neck: [0, .9, 0], shoulderR: [-.38, .74, .12], shoulderL: [.38, .74, .12], hipR: [-.17, -.07, .1], hipL: [.17, -.07, .1] };
const BOSS_PALETTE = {
  light: '#cfa62f', mid: '#b98d24', dark: '#99701a', rim: '#d9b443', speck: '#a8821f',
  pelvis: '#392734', pelvisDark: '#2e1f2b', pelvisKnee: '#392734', pelvisLow: '#392734', pelvisShade: '#392734',
  hemLine: '#3a2a33', ink: '#3a2a33', dash: '#ecd88a', white: '#f7f2f3', shirtLine: '#c9bfc6', strap: '#1c171d',
  gold: '#ecd17c', goldDark: '#b8963e', pocketLine: '#8e6918', button: '#ecd17c', buttonInk: '#3a2a33',
};

// ---- Outfit "tycoon" (params.outfit = 'tycoon'): the Rival Tycoon's tall pill + black frock coat. Additive: nobody else reads this.
// STYLE_BIBLE 2: f345 front level outer width .87 D, chin to bottom 1.00, widest low, no pelvis band (the coat runs to the rounded hem).
// One mesh from the top (y 1) to the rounded bottom (y -.10); inner half widths (the hull's ink adds .025-.04 D outside).
// gate f1610 f1625: the shoulders slope in well below the chin (the coat narrows to ~.6 of its width at the neck)
const TYC_W = [[-.10, 0], [-.095, .10], [-.08, .19], [-.055, .27], [-.02, .33], [.03, .365], [.10, .39], [.20, .398], [.32, .392], [.45, .378], [.58, .355], [.68, .33], [.76, .30], [.83, .265], [.89, .22], [.94, .16], [.98, .08], [1.0, 0]];
const tycWidth = tableWidth(TYC_W);
const TYC_YS = () => {
  const ys = [];
  for (let i = 0; i <= 40; i++) ys.push(1.0 - .20 * (1 - Math.cos(i / 40 * Math.PI / 2)));
  for (let i = 1; i <= 60; i++) ys.push(.80 - .74 * i / 60);
  for (let i = 1; i <= 40; i++) ys.push(.06 - .16 * Math.sin(i / 40 * Math.PI / 2));
  return ys;
};
export const TYCOON_SOCKETS = { neck: [0, .95, 0], shoulderR: [-.31, .70, .12], shoulderL: [.31, .70, .12], hipR: [-.13, -.05, .1], hipL: [.13, -.05, .1] };
const TYCOON_PALETTE = {
  light: '#302937', mid: '#28222f', dark: '#1c1823', rim: '#4a4352', sheen: '#5e5767', lapel: '#45404c',
  ink: '#3a2a33', hemLine: '#3a2a33', white: '#f7f2f3', red: '#b8303b', rose: '#c22f3a', navy: '#2d3a6e',
  gold: '#e3c25a', goldDark: '#a8822c', cream: '#efe6d0', vest: '#d3ac3a', vestDark: '#a07b22',
};

// ---- Outfit "jacket" (params.outfit = 'jacket'): the Townsperson's brown jacket (s12 f1006-1016, s13). Additive: nobody else reads this.
// STYLE_BIBLE 2/3: pill ~.75 D wide, ~.86 tall; brown jacket #7b5d4c lit / #523e36 shade, inked V lapels, white shirt V, dark tie with pale
// dots, 1 button, welt pocket, a strong pale rim streak on the lit (viewer-left) edge. Placement = updateBoss (x y D lean yaw pitch sy).
const JKT_W = TYC_W.map(([y, w]) => [y, w * (y > .75 ? .95 : 1)]);
const jktWidth = tableWidth(JKT_W);
export const JACKET_SOCKETS = { neck: [0, .95, 0], shoulderR: [-.30, .70, .12], shoulderL: [.30, .70, .12], hipR: [-.12, -.05, .1], hipL: [.12, -.05, .1] };
const JACKET_PALETTE = {
  light: '#7b5d4c', mid: '#665041', dark: '#523e36', rim: '#c9b4a6', lapel: '#5e4739', ink: '#3a2a33', white: '#f4eeec',
  tie: '#2e2530', tieDot: '#cfc6cc', button: '#3f2f2c', pocket: '#3a2a33',
};

// ---- Outfit "inspector" (params.outfit = 'inspector'): the Rival Inspector's navy coat (s06 f650-696, s07 f697-724). Additive: nobody else
// reads this. STYLE_BIBLE 2/3: pill ~.74 D wide (f702 f696, high close), coat runs to the rounded hem (no pelvis band); navy #2e3963 mid,
// #2b4374 lit, dark right, a pale blue rim streak upper left; 4 gold buttons down the centre + 2 small at the collar; a slightly lighter
// chest pocket (viewer right); black belt, gold buckle. Placement = updateBoss (x y D lean yaw pitch sy tz).
const INSP_W = [[-.10, 0], [-.095, .11], [-.08, .20], [-.055, .28], [-.02, .335], [.03, .37], [.10, .39], [.20, .397], [.32, .395], [.45, .388], [.58, .372], [.68, .35], [.76, .325], [.83, .29], [.89, .24], [.94, .175], [.98, .09], [1.0, 0]];
const inspWidth = tableWidth(INSP_W);
export const INSPECTOR_SOCKETS = { neck: [0, .95, 0], shoulderR: [-.32, .70, .12], shoulderL: [.32, .70, .12], hipR: [-.13, -.05, .1], hipL: [.13, -.05, .1] };
const INSPECTOR_PALETTE = {
  light: '#3a548c', mid: '#2e3963', dark: '#1f2747', rim: '#9fb6e0', ink: '#3a2a33', hemLine: '#3a2a33',
  belt: '#17131b', gold: '#e6c040', goldDark: '#9c7a1c', pocketI: '#3a4a7c', cream: '#f3e3a0',
};

const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

function section(y, u, depthRatio, power, widthAt = vestWidth, zOff = 0) { // u = 0 chest front, + toward +X
  // the chest tapers less front to back than side to side: his straps stay within 2-4 deg of square to the hem on a turned body
  const a = widthAt(y), b = (widthAt === vestWidth ? vestWidth(y, DIMS.taperDepth) : a) * depthRatio, e = 2 / power;
  return [a * sp(Math.sin(u), e), y, b * sp(Math.cos(u), e) + zOff];
}

const VEST_YS = () => {
  const ys = [];
  for (let i = 0; i <= 48; i++) ys.push(.80 - .14 * (1 - Math.cos(i / 48 * Math.PI / 2)));
  for (let i = 1; i <= 60; i++) ys.push(.66 - .56 * i / 60);
  for (let i = 1; i <= 40; i++) ys.push(.10 - .10 * i / 40); // dense toward the hem, which ends in a clean corner
  return ys;
};
const PELVIS_YS = () => {
  const ys = [];
  for (let i = 0; i <= 12; i++) ys.push(.03 - .03 * i / 12);
  for (let i = 1; i <= 48; i++) ys.push(-.135 * Math.sin(i / 48 * Math.PI / 2));
  return ys;
};

function buildGeometry({ depthRatio = DIMS.depthRatio, power = DIMS.power, ys = VEST_YS(), widthAt = vestWidth, zOff = 0 } = {}) {
  const NU = 256;
  const pos = [], nor = [], S = [], idx = [], E = 1e-3;
  const P = (y, u) => section(y, u, depthRatio, power, widthAt, zOff);
  ys.forEach(y => {
    // arc length from the front, per ring
    const arc = [0]; let prev = P(y, 0);
    for (let i = 1; i <= NU / 2; i++) { const c = P(y, i / (NU / 2) * Math.PI); arc.push(arc[i - 1] + Math.hypot(c[0] - prev[0], c[2] - prev[2])); prev = c; }
    for (let i = 0; i <= NU; i++) {
      const u = -Math.PI + i / NU * 2 * Math.PI, p = P(y, u);
      const su = P(y, u + .004), sd = P(y, u - .004), yu = P(y + E, u), yd = P(y - E, u);
      const tu = new THREE.Vector3(su[0] - sd[0], 0, su[2] - sd[2]);
      const tv = new THREE.Vector3(yu[0] - yd[0], yu[1] - yd[1], yu[2] - yd[2]);
      const n = new THREE.Vector3().crossVectors(tv, tu);
      if (n.lengthSq() < 1e-14) n.set(0, y > .3 ? 1 : -1, 0); n.normalize();
      if (n.dot(new THREE.Vector3(p[0], 0, p[2] - zOff)) < -1e-6) n.negate();
      pos.push(...p); nor.push(n.x, n.y, n.z);
      const k = Math.abs(i - NU / 2);
      S.push(Math.sign(i - NU / 2) * arc[k]);
    }
  });
  const R = ys.length, W = NU + 1;
  for (let j = 0; j < R - 1; j++) for (let i = 0; i < NU; i++) {
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, c, b, b, c, d); // outward (u grows toward +X seen from the front)
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(S, 1));
  g.setIndex(idx);
  return g;
}

// The bandana: a patch laid over the chest in (s, y), lifted off the surface toward the top so that its far corner stands out past the
// silhouette on a turned body, as on f3-f56.
function patchGeometry({ depthRatio = DIMS.depthRatio, power = DIMS.power } = {}, { s0, s1, y0, y1, lift, base = .004 }) {
  const NS = 72, NY = 48, pos = [], nor = [], S = [], idx = [];
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let j = 0; j <= NY; j++) {
    const y = y0 + j / NY * (y1 - y0);
    for (let i = 0; i <= NS; i++) {
      const s = s0 + i / NS * (s1 - s0), sg = Math.sign(s) || 1;
      let u = 0, arc = 0, a = section(y, 0, depthRatio, power), step = .004;
      while (arc < Math.abs(s) && u < 3) { u += step; const c = section(y, sg * u, depthRatio, power); arc += Math.hypot(c[0] - a[0], c[2] - a[2]); a = c; }
      const q = section(y, sg * (u + .004), depthRatio, power), o = section(y, sg * (u - .004), depthRatio, power);
      const tx = (q[0] - o[0]) * sg, tz = (q[2] - o[2]) * sg, l = Math.hypot(tx, tz) || 1;
      const nx = -tz / l, nz = tx / l; // outward in the section plane
      const h = base + lift * smooth(y0 + .025, y1 - .03, y);
      pos.push(a[0] + nx * h, y, a[2] + nz * h); nor.push(nx, 0, nz); S.push(s);
    }
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NS; i++) {
    const a = j * (NS + 1) + i, b = a + 1, c = a + NS + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(S, 1));
  g.setIndex(idx);
  return g;
}

const hex = c => new THREE.Color(c);
const PALETTE = {
  light: '#69dbd4', mid: '#2bafa8', dark: '#1e7b77', rim: '#8fe9e0',
  // pelvis, measured (tools/torso_pelvis_row.py): standing f66-f98 two tones; kneeling f3-f56 the same lit brown, a little darker low down and past the body's middle
  pelvis: '#634e46', pelvisDark: '#483735', pelvisKnee: '#644e45', pelvisLow: '#5a4846', pelvisShade: '#523f3f', hemLine: '#173a3b',
  // f66 stitches peak at #a59391 with blur; buckles a cream ring #f0d5b0 round a dull gold, dark core
  strap: '#33262c', strapEdge: '#261c23', dash: '#b9aca8', ink: '#2c2029',
  gold: '#a08a4e', goldDark: '#7d6a3c', buckleIn: '#6d551e', cream: '#f0d6b0',
  red: '#ad272b', redPale: '#bd2831', white: '#f7f0f4', button: '#f7f1f6', buttonInk: '#0f2a30', pocketLine: '#07605a',
  knot: '#6b2340', knotPale: '#924764',
};

// ---- Outfit "passenger" (params.outfit = 'passenger'): the Passenger's purple suit (s09 f780-862). Additive: nobody else reads this.
// STYLE_BIBLE 2/3: same tall pill as the Tycoon (f846 .86 D wide, 1.00 tall); purple #864a88 lit / #59305a shade, faint horizontal lined
// fabric, darker lapels with an inked V, white shirt sliver, dark tie with pale dots, 2 dark buttons, 2 welt pockets #5b305d.
export const PASSENGER_SOCKETS = { neck: [0, .95, 0], shoulderR: [-.31, .70, .12], shoulderL: [.31, .70, .12], hipR: [-.12, -.05, .1], hipL: [.12, -.05, .1] };
const PASSENGER_PALETTE = {
  light: '#864a88', mid: '#70406f', dark: '#59305a', rim: '#a874a6', lapel: '#62365f', ink: '#3a2a33', white: '#efe8ee',
  tie: '#2b2230', tieDot: '#cfc4d0', button: '#3a2a33', pocket: '#5b305d', line: '#6c3a6c',
};

const VERT = /* glsl */`
attribute float aS;
varying float vS, vY;
varying vec3 vN, vObjN;
void main() {
  vS = aS; vY = position.y;
  vN = normalize(normalMatrix * normalize(vec3(normal.x, 1e-4, normal.z)));
  vObjN = normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */`
precision highp float;
varying float vS, vY;
varying vec3 vN, vObjN;
uniform vec2 uL;          // screen direction toward the light, view space (lean frame)
uniform vec3 cLight, cMid, cDark, cRim, cPelvis, cPelvisDark, cPelvisKnee, cPelvisLow, cPelvisShade, cHem, cStrap, cStrapEdge, cDash, cInk, cGold, cGoldDark, cBuckleIn, cCream, cRed, cRedPale, cWhite, cButton, cButtonInk, cPocket, cKnot, cKnotPale;
uniform float k1, k0, soft1, soft0, rimAt, rimStr, uKneel, uNearBuckle;
#ifdef BOSS
uniform vec3 cSpeck, cShirtLine;
uniform vec2 uSag;
#endif
#ifdef TYCOON
uniform vec3 cLapel, cVest, cVestDark, cRose, cNavy, cSheen;
uniform vec2 uSag;
uniform float uBeach, uSash, uRose, uSheen;
#endif
#ifdef JACKET
uniform vec3 cLapel, cTie, cTieDot, cJRim;
uniform vec2 uSag;
uniform float uRimOn;
#endif
#ifdef PASSENGER
uniform vec3 cLapel, cTie, cTieDot, cPRim, cPPocket, cLine;
uniform vec2 uSag;
uniform float uRimOn, uLines;
#endif
#ifdef INSPECTOR
uniform vec3 cIRim, cBelt, cIPocket;
uniform vec2 uSag;
uniform float uIRimOn, uBeltY;
#endif

float px;
float fill(float d) { return clamp(.5 - d / px, 0., 1.); }
float box(vec2 p, vec2 c, vec2 h) { vec2 q = abs(p - c) - h; return length(max(q, 0.)) + min(max(q.x, q.y), 0.); }
float rbox(vec2 p, vec2 c, vec2 h, float r) { return box(p, c, h - r) - r; }
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.)); }
float tri(vec2 p, vec2 a, vec2 b, vec2 c) { // signed distance to a triangle
  vec2 e0 = b - a, e1 = c - b, e2 = a - c, v0 = p - a, v1 = p - b, v2 = p - c;
  vec2 q0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0., 1.), q1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0., 1.), q2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0., 1.);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(q0, q0), s * (v0.x * e0.y - v0.y * e0.x)), vec2(dot(q1, q1), s * (v1.x * e1.y - v1.y * e1.x))), vec2(dot(q2, q2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
void over(inout vec3 c, vec3 o, float a) { c = mix(c, o, a); }

float hash1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
void strap(inout vec3 c, vec2 p, float cx) {
  float top = .655;
  float d = box(p, vec2(cx, top * .5), vec2(.0375, top * .5));
  over(c, cHem, fill(d - .0075) * .8); // a dark teal fringe along both edges, 2-3 px on f19, f40, f66
  over(c, cStrap, fill(d));
  // white running stitch down the middle, brushy: every dash its own length, lean and weight, tapering at both ends
  float per = .050, yy = p.y - .006, id = floor(yy / per) + cx * 40., y = mod(yy, per) - per * .5;
  // measured on f66: lit for 67 % of the period, 2-3 px wide (D 282), blunt ends
  float len = .0105 + .0055 * hash1(id), wob = (hash1(id + 7.) - .5) * .0040, tilt = (hash1(id + 3.) - .5) * .24;
  float t = clamp(y / len, -1., 1.);
  float w = (.0030 + .0014 * hash1(id + 5.)) * (1. - t * t * .3);
  float dash = abs(p.x - cx - .002 - wob - y * tilt) - w;
  dash = max(dash, abs(y) - len);
  over(c, cDash, fill(dash) * (.82 + .18 * hash1(id + 9.)) * step(p.y, top - .02) * step(.075, p.y));
}
void buckleLow(inout vec3 c, vec2 p, float cx) {
  vec2 m = vec2(cx, .030);
  over(c, cInk, fill(rbox(p, m, vec2(.0315, .0295), .006)));
  over(c, cCream, fill(rbox(p, m, vec2(.0265, .0240), .004)));
  over(c, cGold, fill(rbox(p, m, vec2(.0195, .0170), .003)));
  over(c, cBuckleIn, fill(rbox(p, m, vec2(.0100, .0080), .002)));
}
void buckleUp(inout vec3 c, vec2 p, float cx) {
  vec2 m = vec2(cx, .574);
  over(c, cInk, fill(rbox(p, m, vec2(.0295, .0215), .005)));
  over(c, cCream, fill(rbox(p, m, vec2(.0245, .0165), .003)));
  over(c, cGold, fill(rbox(p, m, vec2(.0175, .0095), .002)));
  over(c, cBuckleIn, fill(rbox(p, m, vec2(.0090, .0040), .001)));
}
void button(inout vec3 c, vec2 p, vec2 m) {
  over(c, cButtonInk, fill(length(p - m) - .031));
  over(c, cButton, fill(length(p - m) - .0205));
  over(c, cInk, fill(length(p - m - vec2(-.0072, 0.)) - .0046));
  over(c, cInk, fill(length(p - m - vec2(.0072, 0.)) - .0046));
}
void pocket(inout vec3 c, vec2 p, vec2 m, vec2 h, float flapAt, float lighter) {
  float d = box(p, m, h);
  over(c, mix(c, cLight, lighter), fill(d));
  // the pale catch-light along the top edge
  over(c, cRim, fill(box(p, m + vec2(0., h.y - .012), vec2(h.x - .012, .0028))) * .55);
  if (flapAt > 0.) { over(c, mix(c, cDark, .8), fill(box(p, vec2(m.x, (flapAt + m.y + h.y) * .5), vec2(h.x + .002, (m.y + h.y - flapAt) * .5)))); }
  over(c, cPocket, fill(abs(d) - .0042));
  if (flapAt > 0.) over(c, cPocket, fill(box(p, vec2(m.x, flapAt), vec2(h.x, .0035))));
}

// The V, read off f66 in (s, y): not a plain triangle, both sides bow outward, and its upper left corner is the knot's tab lying over the strap's top
const vec2 V_TL = vec2(-.140, .690), V_TR = vec2(.118, .695), V_TIP = vec2(.014, .434), V_BL = vec2(-.092, .560), V_BR = vec2(.080, .540);
float vShape(vec2 p) { // signed distance to the polygon: a union of triangles would leave an inner seam that the inset draws as ink
  vec2 v[5]; v[0] = V_TL; v[1] = V_TR; v[2] = V_BR; v[3] = V_TIP; v[4] = V_BL;
  float d = dot(p - v[0], p - v[0]), s = 1.;
  for (int i = 0, j = 4; i < 5; j = i, i++) {
    vec2 e = v[j] - v[i], w = p - v[i], q = w - e * clamp(dot(w, e) / dot(e, e), 0., 1.);
    d = min(d, dot(q, q));
    bvec3 k = bvec3(p.y >= v[i].y, p.y < v[j].y, e.x * w.y > e.y * w.x);
    if (all(k) || all(not(k))) s = -s;
  }
  return s * sqrt(d);
}

void main() {
  vec2 p = vec2(vS, vY);
  px = max(max(length(vec2(dFdx(vS), dFdy(vS))), length(vec2(dFdx(vY), dFdy(vY)))), 1e-5);
#ifdef KNOT
  // the knot's tail on the viewer-left shoulder: rigid at s -.20..-.33 (it holds screen x -.25 from yaw +6 to -45 because that is the contour;
  // at yaw 47 the arm covers it), tapering, proud of the surface so it stands past the contour when he turns away.
  // f66: a dark-red inked tab about 14 px wide, not a pale dash: maroon fill (#682b40 measured) with one paler streak and a thick ink edge
  vec2 ka = vec2(-.20, .650), kb = vec2(-.335, .56);
  vec2 kd = kb - ka; float kt = clamp(dot(p - ka, kd) / dot(kd, kd), 0., 1.);
  vec2 kn = normalize(vec2(-kd.y, kd.x));
  float kq = length(p - ka - kd * kt) - mix(.031, .014, kt);
  vec3 kc = mix(cInk, cKnot, fill(kq + .010));
  kc = mix(kc, cKnotPale, fill(abs(dot(p - ka, kn) - .006) - .0035) * fill(kq + .012));
  kc = mix(kc, cWhite, .75 * fill(abs(dot(p - ka, kn) + .011) - .0028) * fill(kq + .012)); // a broken pale fold on its outer side
  kc = mix(kc, cKnot, step(.5, fract(kt * 3.4 + .1)) * fill(abs(dot(p - ka, kn) + .011) - .0036) * .7);
  gl_FragColor = vec4(kc, fill(kq));
  if (gl_FragColor.a < .01) discard;
  #include <colorspace_fragment>
  return;
#endif
#ifdef BANDANA
  float V = vShape(p);
  float Vn = V + .006;
  vec3 b = cRed;
  // small dots on a square grid, read off f66: rows y .633 .590 .547 .504, columns s .002 + n * .05, a little taller than wide, each slightly off and its own size
  vec2 gq = (p - vec2(.002, .590)) / vec2(.050, .043);
  vec2 gi = floor(gq + .5);
  float h0 = hash1(gi.x * 3.7 + gi.y * 17.3), h1 = hash1(gi.x * 11.1 + gi.y * 5.9), h2 = hash1(gi.x * 7.3 + gi.y * 29.7);
  vec2 dc = (gi + (vec2(h0, h1) - .5) * .16) * vec2(.050, .043) + vec2(.002, .590);
  vec2 dr = vec2(.0064, .0086) * (.86 + .28 * h2);
  float dd = (length((p - dc) / dr) - 1.) * dr.x;
  b = mix(b, cWhite, fill(dd) * .96);
  // three long white folds fanning out of the tip (f66, same place on f3-f56): each tapers, the longest runs to the V's right corner
  float s1 = clamp(dot(p - vec2(.103, .681), vec2(-.071, -.192)) / dot(vec2(-.071, -.192), vec2(-.071, -.192)), 0., 1.);
  float s2 = clamp(dot(p - vec2(-.060, .592), vec2(.059, -.110)) / dot(vec2(.059, -.110), vec2(.059, -.110)), 0., 1.);
  float s3 = clamp(dot(p - vec2(.064, .567), vec2(-.030, -.076)) / dot(vec2(-.030, -.076), vec2(-.030, -.076)), 0., 1.);
  vec2 wob = vec2(.0016 * sin(p.y * 95.), 0.);
  float jag = .0016 * sin(p.y * 170. + p.x * 60.); // the folds' edges are broken, not ruled
  float dA = seg(p + wob, vec2(.103, .681), vec2(.032, .489));
  b = mix(b, mix(cRed, cWhite, .45), fill(dA - .0075)); // the longest fold has a pink fringe
  b = mix(b, cWhite, fill(dA - .0048 - jag * .7));
  b = mix(b, cWhite, fill(seg(p + wob, vec2(-.060, .592), vec2(-.001, .482)) - mix(.0052, .0044, s2) - jag * .7));
  b = mix(b, cWhite, fill(seg(p + wob, vec2(.064, .567), vec2(.034, .491)) - mix(.0028, .0050, s3)));
  // and they meet in a white blob at the tip, two short ones fanning into it
  b = mix(b, cWhite, fill(length(p - V_TIP - vec2(-.001, .030)) - .0058));
  b = mix(b, cWhite, fill(seg(p, V_TIP + vec2(-.012, .068), V_TIP + vec2(-.001, .030)) - .0026));
  b = mix(b, cWhite, fill(seg(p, V_TIP + vec2(.010, .070), V_TIP + vec2(-.001, .030)) - .0026));
  // the knot's near end in the V's upper left: a brighter red tab cut off by a dark inked line (f66 x 569-582, f40 the tab with its ink outline)
  vec2 ta = vec2(-.103, .680), tb = vec2(-.050, .583);
  float tside = (tb.x - ta.x) * (p.y - ta.y) - (tb.y - ta.y) * (p.x - ta.x);
  b = mix(b, cRedPale, step(tside, 0.) * step(.583, p.y));
  float tt = clamp(dot(p - ta, tb - ta) / dot(tb - ta, tb - ta), 0., 1.);
  b = mix(b, cInk, fill(seg(p, ta, tb) - mix(.0036, .0072, tt))); // thickens into the dark foot the fold starts from (f19, f40, f56)
  vec3 cb = mix(cInk, b, fill(Vn));
  gl_FragColor = vec4(cb, fill(V - .010));
  if (gl_FragColor.a < .01) discard;
  #include <colorspace_fragment>
  return;
#endif
  vec3 N = normalize(vN);
#ifdef PELVIS_PART
  float kp = dot(N.xy, uL);
  // standing: two tones, the dark far side begins near the front (f66 u .09, f98 u .1). Kneeling: darker low down and past the body's middle; the rest of his darkness there is the limbs' ink, not the pelvis
  vec3 pc = mix(cPelvisDark, cPelvis, smoothstep(-.44, -.22, kp));
  vec3 pk = mix(cPelvisLow, cPelvisKnee, smoothstep(-.12, -.05, vY));
  float nb = normalize(vObjN.xz + vec2(1e-5, 0.)).x; // how far round the body, whatever the ring's size
  pk = mix(pk, cPelvisShade, smoothstep(-.8, -.55, nb)); // past the body's middle
  pc = mix(pc, pk, uKneel);
  pc = mix(pc, cInk, smoothstep(-.022, -.006, vY) * .8); // contact shadow under the hem (f66 v -.01: #3e3331)
  gl_FragColor = vec4(pc, 1.0);
  #include <colorspace_fragment>
  return;
#endif
#ifdef TYCOON
  {
    // the Rival Tycoon's black frock coat (outfit 'tycoon'), (s, y) torso units, + s = viewer right. Measured on f343 (standing, sash),
    // f1610 f1624 (seated, beach: gold waistcoat), f765: lit #302937 viewer left to #1c1823, a soft sheen on the lit side, charcoal lapels,
    // 4 gold buttons double-breasted, gold chain from the near-left upper button to a big round fob low right, red rose on the right lapel.
    float kb = dot(N.xy, uL);
    vec3 c = mix(cDark, cLight, smoothstep(-.55, .35, kb));
    // f1610 f1625: a pale gloss streak a little in from the lit edge, fading before the contour
    c = mix(c, cSheen, uSheen * smoothstep(.45, .75, kb) * (1. - .6 * smoothstep(.93, 1., kb)));
    float ax = abs(p.x);
    // the neck opening: a narrow V from y .58 to the top; lapels run beside it down to the upper buttons
    // f1625: the waistcoat V is ~.15 D wide at the chin, tip ~.66 over the hem; f343: the shirt V ~.24 D wide
    float vEdge = mix(.0, mix(.12, .075, uBeach), clamp((p.y - .62) / (.97 - .62), 0., 1.));
    float inV = ax - vEdge;
    float lapW = mix(.035, .085, clamp((p.y - .50) / (.90 - .50), 0., 1.));
    if (p.y > .50) {
      float lap = inV - lapW;  // < 0 inside the lapel band (or the V)
      over(c, cLapel, fill(lap) * smoothstep(.50, .56, p.y));
      over(c, cInk, fill(abs(lap) - .006) * smoothstep(.52, .58, p.y));
    }
    if (p.y > .62) {
      vec3 v = mix(cWhite, mix(cVestDark, cVest, smoothstep(-.4, .3, kb)), uBeach);
      over(c, v, fill(inV));
      // standing: a red cravat at the throat; beach: a red sliver over the waistcoat and two pale buttons
      over(c, cRose, fill(inV) * smoothstep(.86, .875, p.y) * (1. - uBeach * .35));
      if (uBeach > .5) for (int i = 0; i < 2; i++) { vec2 m = vec2(0., .70 + float(i) * .075); over(c, cInk, fill(length(p - m) - .016)); over(c, cCream, fill(length(p - m) - .010)); }
      over(c, cInk, fill(abs(inV) - .008));
    }
    // sash (f345 only): thin red / white / navy stripes from the right shoulder to the left hip, gold medallion at its end
    if (uSash > .5) {
      vec2 a = vec2(.20, .90), b = vec2(-.24, .20);
      vec2 ab = normalize(b - a), nn = vec2(-ab.y, ab.x);
      float along = dot(p - a, ab), across = dot(p - a, nn);
      float inS = step(0., along) * step(along, length(b - a));
      vec3 sc = across < -.016 ? cRed : across < -.005 ? cWhite : across < .005 ? cNavy : across < .016 ? cWhite : cRed;
      over(c, sc, fill(abs(across) - .024) * inS);
      over(c, cInk, fill(abs(abs(across) - .026) - .004) * inS);
      over(c, cInk, fill(length(p - b) - .055)); over(c, cGold, fill(length(p - b) - .043)); over(c, cGoldDark, fill(length(p - b) - .018));
    }
    // red rose on the viewer-right lapel
    if (uRose > .5) {
      vec2 rq = p - vec2(.165, .80);
      float petals = length(rq) - .030 - .006 * sin(atan(rq.y, rq.x) * 5.);
      over(c, cInk, fill(petals - .006)); over(c, cRose, fill(petals)); over(c, mix(cRose, cInk, .45), fill(length(rq - vec2(.004, .002)) - .009));
    }
    // four gold buttons, double-breasted
    for (int i = 0; i < 4; i++) {
      vec2 m = vec2(mod(float(i), 2.) < .5 ? -.105 : .105, i < 2 ? .48 : .24);
      over(c, cInk, fill(length(p - m) - .033));
      over(c, cGold, fill(length(p - m) - .023));
      over(c, cGoldDark, fill(length(p - m - vec2(.006, -.006)) - .010) * .6);
    }
    // gold chain from the upper left button, sagging, to the big round fob low right
    vec2 c0 = vec2(-.09, .48), c1 = vec2(.215, .35);
    for (int i = 0; i < 13; i++) {
      float t = (float(i) + .5) / 13.;
      vec2 m = mix(c0, c1, t) + uSag * sin(3.14159 * t);
      float r = length(p - m);
      over(c, cInk, fill(r - .021));
      over(c, cGold, fill(r - .0145));
      over(c, mix(cGold, cGoldDark, .8), fill(r - .005));
    }
    over(c, cInk, fill(length(p - c1 - vec2(.03, -.01)) - .050));
    over(c, cGold, fill(length(p - c1 - vec2(.03, -.01)) - .039));
    over(c, cGoldDark, fill(abs(length(p - c1 - vec2(.03, -.01)) - .022) - .004));
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
    return;
  }
#endif
#ifdef INSPECTOR
  {
    // the Rival Inspector's navy coat (outfit 'inspector'), (s, y) torso units, + s = viewer right. Read on s07 f700 f706 f712 + the cast crop.
    float kb = dot(N.xy, uL);
    vec3 c = mix(cDark, cMid, smoothstep(-.75, -.15, kb));
    c = mix(c, cLight, smoothstep(.05, .65, kb));
    // pale blue rim streak just inside the lit (upper left) edge
    c = mix(c, cIRim, uIRimOn * smoothstep(.78, .90, kb) * (1. - smoothstep(.955, .995, kb)) * smoothstep(.30, .62, p.y));
    float ax = abs(p.x);
    // chest pocket, viewer right: a slightly lighter rectangle
    over(c, cIPocket, fill(rbox(p, vec2(.24, .38), vec2(.05, .06), .008)) * .85);
    // the centre seam: a thin dark line from the collar to the hem
    over(c, cInk, fill(ax - .0045) * .65 * step(p.y, .93));
    // belt + buckle
    float bh = .042;
    over(c, cBelt, fill(abs(p.y - uBeltY) - bh));
    vec2 bm = vec2(0., uBeltY);
    over(c, cInk, fill(rbox(p, bm, vec2(.056, .044), .008)));
    over(c, cGold, fill(rbox(p, bm, vec2(.046, .034), .006)));
    over(c, cGoldDark, fill(rbox(p, bm, vec2(.026, .016), .003)));
    over(c, cBelt, fill(rbox(p, bm, vec2(.020, .011), .002)));
    // 4 gold buttons down the centre, 2 small at the collar
    for (int i = 0; i < 4; i++) {
      vec2 m = vec2(0., uBeltY + .14 + float(i) * .11);
      over(c, cInk, fill(length(p - m) - .026));
      over(c, cGold, fill(length(p - m) - .018));
      over(c, cCream, fill(length(p - m - vec2(-.005, .006)) - .006) * .8);
    }
    for (int i = 0; i < 2; i++) {
      vec2 m = vec2(float(i) * .40 - .20, .89);
      over(c, cInk, fill(length(p - m) - .019));
      over(c, cGold, fill(length(p - m) - .012));
    }
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
    return;
  }
#endif
#ifdef PASSENGER
  {
    // the Passenger's purple suit (outfit 'passenger'), (s, y) torso units, + s = viewer right. Read on s09 f816 f834 f846 f852 and the
    // cast crop: lit #864a88 viewer left to #59305a, faint horizontal fabric lines, an inked V from the collar to y .48 with darker lapels
    // beside a white shirt sliver and a dark tie with pale dots, 2 dark buttons on the centre line, 2 welt pockets.
    float kb = dot(N.xy, uL);
    vec3 c = mix(cDark, cLight, smoothstep(-.50, .35, kb));
    c = mix(c, cPRim, uRimOn * smoothstep(.80, .92, kb) * (1. - smoothstep(.96, .995, kb)) * .6);
    // faint lined fabric: thin horizontal darker lines every ~.035
    float ly = abs(mod(p.y, .036) - .018);
    over(c, mix(c, cLine, .55), uLines * fill(ly - .0035) * smoothstep(.02, .06, p.y));
    float ax = abs(p.x);
    // lapels: the inked V from the collar (+-.15 at y .82) to its tip at y .48, filled a little darker
    float lapEdge = mix(.0, .155, clamp((p.y - .48) / (.84 - .48), 0., 1.));
    float lap = ax - lapEdge;
    if (p.y > .46) {
      over(c, cLapel, fill(lap) * .85);
      // shirt sliver + tie in the middle of the V
      float vEdge = mix(.0, .07, clamp((p.y - .56) / (.84 - .56), 0., 1.));
      float inV = ax - vEdge;
      if (p.y > .56) {
        over(c, cWhite, fill(inV));
        float tw = .022 + .010 * clamp((.84 - p.y) / .28, 0., 1.);
        over(c, cTie, fill(ax - tw) * step(.57, p.y));
        vec2 dq = vec2(p.x, mod(p.y, .05) - .025);
        over(c, cTieDot, fill(length(dq) - .0065) * fill(ax - tw + .006) * step(.60, p.y));
        over(c, cInk, fill(abs(inV) - .0055));
      }
      over(c, cInk, fill(abs(lap) - .0065) * smoothstep(.46, .50, p.y));
    }
    // two dark buttons on the centre line
    for (int i = 0; i < 2; i++) { vec2 m = vec2(0., i == 0 ? .42 : .27); over(c, cInk, fill(length(p - m) - .024)); over(c, cButton, fill(length(p - m) - .016)); }
    // two welt pockets: a darker slot with an ink edge
    for (int i = 0; i < 2; i++) {
      vec2 m = vec2(i == 0 ? -.19 : .19, .33);
      float d = box(p, m, vec2(.085, .014));
      over(c, cPPocket, fill(d));
      over(c, cInk, fill(abs(d) - .004) * .8);
    }
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
    return;
  }
#endif
#ifdef JACKET
  {
    // the Townsperson's brown jacket (outfit 'jacket'), (s, y) torso units, + s = viewer right. Read on f1008 f1012 f1016 and the cast crop:
    // lit #7b5d4c viewer left to #523e36, a strong pale rim streak just inside the lit edge, a white shirt V with a dark dotted tie,
    // inked lapel lines from the collar down to the one button, a welt pocket on the viewer-right chest.
    float kb = dot(N.xy, uL);
    vec3 c = mix(cDark, cLight, smoothstep(-.45, .40, kb));
    c = mix(c, cJRim, uRimOn * smoothstep(.70, .86, kb) * (1. - smoothstep(.95, .995, kb)));
    float ax = abs(p.x);
    // shirt V: ~.20 wide at the top, tip at y .62
    float vEdge = mix(.0, .105, clamp((p.y - .60) / (.97 - .60), 0., 1.));
    float inV = ax - vEdge;
    if (p.y > .60) {
      over(c, cWhite, fill(inV));
      // tie: a dark band down the middle of the V, pale dots
      float tw = .030 + .010 * clamp((.92 - p.y) / .3, 0., 1.);
      float tie = ax - tw;
      over(c, cTie, fill(tie) * fill(-inV + .004));
      vec2 dq = vec2(p.x, mod(p.y, .055) - .0275);
      over(c, cTieDot, fill(length(dq) - .0075) * fill(tie + .006) * step(.62, p.y));
      over(c, cInk, fill(abs(inV) - .007));
    }
    // lapels: a band beside the V from the collar down to the button, outer edge inked
    float lapEdge = mix(.035, .19, clamp((p.y - .44) / (.92 - .44), 0., 1.));
    if (p.y > .44 && p.y < .95) {
      float lap = ax - lapEdge;
      over(c, cLapel, fill(lap) * step(0., inV) * .55);
      over(c, cInk, fill(abs(lap) - .0065) * smoothstep(.44, .48, p.y));
    }
    // one button
    vec2 bm = vec2(0., .42);
    over(c, cInk, fill(length(p - bm) - .028)); over(c, cButton, fill(length(p - bm) - .019));
    // welt pocket, viewer-right chest, and a short hip welt on each side
    over(c, cInk, fill(box(p, vec2(.20, .62), vec2(.055, .006))));
    over(c, cInk, fill(box(p, vec2(-.20, .24), vec2(.06, .005))) * .8);
    over(c, cInk, fill(box(p, vec2(.20, .24), vec2(.06, .005))) * .8);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
    return;
  }
#endif
#ifdef BOSS
  {
    // the Boss's mustard vest (outfit 'boss'), in (s, y) torso units measured on f494, f1395, f1430: lit viewer left, dark right edge
    float kb = dot(N.xy, uL);
    vec3 c = mix(cDark, cMid, smoothstep(-.80, -.35, kb));
    c = mix(c, cLight, smoothstep(-.45, .15, kb));
    // faint darker speckle, flat on the form
    vec2 sq = p / .034; vec2 si = floor(sq);
    float sh0 = hash1(si.x * 7.13 + si.y * 31.7), sh1 = hash1(si.x * 3.31 + si.y * 11.9), sh2 = hash1(si.x * 5.7 + si.y * 2.3);
    vec2 sc = (si + .2 + .6 * vec2(sh0, sh1)) * .034;
    over(c, mix(c, cSpeck, .55), fill(length(p - sc) - .0045 * (.6 + .8 * sh2)) * step(.35, sh2));
    // shirt V with the bow tie, lapel edges inked, pale running stitch on the vest side of each edge
    float ax = abs(p.x);
    float vEdge = mix(.0, .19, clamp((p.y - .43) / (.88 - .43), 0., 1.));   // half width of the opening at height y
    float inV = ax - vEdge;
    if (p.y > .43) {
      over(c, cWhite, fill(inV));
      over(c, cShirtLine, fill(abs(p.x) - .0035) * fill(inV + .02) * step(p.y, .80));
      over(c, cInk, fill(abs(inV) - .0115));
      float t = (p.y - .50) / .42, per = .030;
      float dy = mod(p.y, per) - per * .5;
      over(c, cDash, fill(abs(inV - .030) - .0032) * fill(abs(dy) - .0085) * step(.51, p.y) * step(p.y, .86));
    }
    // bow tie at the top of the V
    { vec2 q = p - vec2(0., .72); q.y *= 1.25;
      float wing = max(abs(q.y) - (.010 + .55 * abs(q.x)), abs(q.x) - .085);
      over(c, cStrap, fill(min(wing, length(q) - .022))); }
    // five round gold buttons with an ink ring
    for (int i = 0; i < 5; i++) {
      vec2 m = vec2(0., .39 - float(i) * .09);
      over(c, cInk, fill(length(p - m) - .034));
      over(c, cGold, fill(length(p - m) - .022));
    }
    // three welt pockets: darker mustard bars with ink
    float pk1 = box(p, vec2(-.25, .615), vec2(.075, .021)), pk2 = box(p, vec2(-.30, .255), vec2(.085, .022)), pk3 = box(p, vec2(.30, .255), vec2(.085, .022));
    float pk = min(pk1, min(pk2, pk3));
    over(c, cInk, fill(pk));
    over(c, cPocket, fill(pk + .008));
    // gold watch chain: outlined rings from the second button to the right pocket, sagging
    // f494: about 14 rings each about .045 D, sagging to the third button's height, ending in a gold ring at the right pocket's left end
    vec2 c0 = vec2(.01, .315), c1 = vec2(.235, .285);
    for (int i = 0; i < 14; i++) {
      float t = (float(i) + .5) / 14.;
      vec2 m = mix(c0, c1, t) + uSag * sin(3.14159 * pow(t, .85)) * (1. - .2 * t);
      float r = length(p - m);
      over(c, cInk, fill(r - .0235));
      over(c, cGold, fill(r - .0165));
      over(c, mix(cGold, cGoldDark, .8), fill(r - .0060));
    }
    over(c, cInk, fill(length(p - c1 - vec2(.012, .0)) - .030));
    over(c, cGold, fill(length(p - c1 - vec2(.012, .0)) - .021));
    over(c, cHem, fill(vY - .008));
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
    return;
  }
#endif
  // 1. three painted tones, soft steps, lit from the viewer's left whatever way the body turns: normal against a light fixed in the lean frame
  float k = dot(N.xy, uL);
  vec3 c = mix(cDark, mix(cMid * .93, cMid, smoothstep(k0, k0 + .5, k)), smoothstep(k0 - soft0, k0 + soft0, k));
  c = mix(c, cLight, smoothstep(k1 - soft1, k1 + soft1, k));
  // pale edge along the lit contour
  c = mix(c, cRim, rimStr * smoothstep(rimAt, 1., k));

  bool frontish = abs(vS) < .62;
  if (frontish) {
    // 2. patch pockets
    pocket(c, p, vec2(-.222, .241), vec2(.042, .074), -1., .32);
    pocket(c, p, vec2(.204, .504), vec2(.029, .079), .545, .06);
    // 3. placket line
    over(c, cPocket, fill(abs(p.x - .012) - .0028) * step(p.y, .44));
    // 4. the neck: the ink edge of the V on the vest; the bandana itself is its own patch, proud of the chest
    over(c, cInk, fill(vShape(p) - .010));
    // above the V the neck is all ink
    over(c, cInk, fill(box(p, vec2(-.007, .78), vec2(.135, .095))));
    // 5. suspenders, dashed, gold buckles
    strap(c, p, -.125);
    strap(c, p, .125);
    { vec3 cB = c, cI = c; buckleLow(cB, p, -.125); over(cI, cInk, fill(rbox(p, vec2(-.125, .030), vec2(.0315, .0295), .006))); c = mix(cI, cB, uNearBuckle); }
    buckleLow(c, p, .125);
    buckleUp(c, p, -.125);
    buckleUp(c, p, .125);
    // 6. buttons
    button(c, p, vec2(0., .371));
    button(c, p, vec2(0., .054));
  }
  // 7. the vest's hem, a dark teal line along its straight cut edge
  over(c, cHem, fill(vY - .009));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

// Crescent outline: thin on the lit side, heavy on the far side and below, as measured on f64-76.
const HULL_V = /* glsl */`
uniform float uW0, uW1, uFade;
uniform vec2 uDir;  // view space, toward the heavy side of the ink: the same side as the head's dark side
void main() {
  vec3 p = position;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // the vest's hem tuck tilts its normals down the body: its ink must not grow a skirt past the hem (a loose line across the gap on f19, f40), so near the hem only the sideways part counts
  float ny = uFade > .5 ? 1. : smoothstep(.0, .12, p.y);
  vec3 n = normalMatrix * normalize(vec3(normal.x, normal.y * ny, normal.z));
  float l = length(n.xy);
  vec2 d = l > 1e-5 ? n.xy / l : vec2(0.);
  float w = uW0 + uW1 * dot(d, uDir);
  // the pelvis's ink grows out from under the hem instead of standing past the vest's corner
  w *= 1. - uFade * smoothstep(-.07, .0, p.y);
  mv.xy += d * max(w, .004);
  float z = mv.z - .7;
  mv.xy *= z / mv.z; mv.z = z;
  gl_Position = projectionMatrix * mv;
}`;
const HULL_F = /* glsl */`
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, 1.0);
  #include <colorspace_fragment>
}`;

export const SOCKETS = { // torso space, on the surface; limbs attach here
  neck: [0, .78, 0],
  shoulderR: [-.243, .62, .13], // character's right, viewer left from the front
  shoulderL: [.243, .62, .13],
  hipR: [-.12, -.06, .06],
  hipL: [.12, -.06, .06],
};

let TRACK = null;
const LERP = ['x', 'y', 'D', 'tx', 'ty', 'lean', 'yaw', 'pitch', 's', 'sy'];
export function poseAt(f, track = TRACK) {
  if (track[f]) return track[f];
  const keys = Object.keys(track).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
  let a = keys[0], b = keys[keys.length - 1];
  for (const k of keys) { if (k <= f) a = k; if (k >= f) { b = k; break; } }
  if (a === b) return track[a];
  const t = (f - a) / (b - a), out = {};
  for (const k of LERP) out[k] = track[a][k] + (track[b][k] - track[a][k]) * t;
  return out;
}

// TRACK: only the default for poseAt(f) called from outside; each built torso keeps its own track and params in root.userData.
export async function build(params = {}) {
  const P = params;
  TRACK = await loadTrack(params, 'torso', new URL('./torsoTrack.json', import.meta.url));
  const ownTrack = TRACK;
  const root = new THREE.Group(); root.name = 'torso';
  const body = new THREE.Group(); body.name = 'torso.body';
  if (P.outfit === 'boss') return buildBoss(P, root, body, ownTrack);
  if (P.outfit === 'tycoon') return buildTycoon(P, root, body, ownTrack);
  if (P.outfit === 'jacket') return buildJacket(P, root, body, ownTrack);
  if (P.outfit === 'inspector') return buildInspector(P, root, body, ownTrack);
  if (P.outfit === 'passenger') return buildPassenger(P, root, body, ownTrack);
  if (P.body || (P.outfit && typeof P.outfit === 'object')) return buildCustom(P, root, body, ownTrack);
  const g = buildGeometry(params);
  const C = { ...PALETTE, ...(params.palette || {}) }; // params.palette: any PALETTE key, '#rrggbb' (an outfit's colours)
  const uniforms = {
    uL: { value: new THREE.Vector2(-1, 0) },
    cLight: { value: hex(C.light) }, cMid: { value: hex(C.mid) }, cDark: { value: hex(C.dark) }, cRim: { value: hex(C.rim) }, cPelvis: { value: hex(C.pelvis) }, cPelvisDark: { value: hex(C.pelvisDark) }, cHem: { value: hex(C.hemLine) },
    cStrap: { value: hex(C.strap) }, cStrapEdge: { value: hex(C.strapEdge) }, cDash: { value: hex(C.dash) }, cInk: { value: hex(C.ink) }, cGold: { value: hex(C.gold) }, cGoldDark: { value: hex(C.goldDark) }, cBuckleIn: { value: hex(C.buckleIn) }, cCream: { value: hex(C.cream) },
    cRed: { value: hex(C.red) }, cRedPale: { value: hex(C.redPale) }, cWhite: { value: hex(C.white) }, cButton: { value: hex(C.button) }, cButtonInk: { value: hex(C.buttonInk) }, cPocket: { value: hex(C.pocketLine) }, cKnot: { value: hex(C.knot) }, cKnotPale: { value: hex(C.knotPale) },
    cPelvisKnee: { value: hex(C.pelvisKnee) }, cPelvisLow: { value: hex(C.pelvisLow) }, cPelvisShade: { value: hex(C.pelvisShade) }, uKneel: { value: 0 }, uNearBuckle: { value: 1 },
    // soft0: the dark tone's edge ramps over about .1 D (f98 u .18-.28, g 177 -> 125; f72-f94 the same): its place holds in every span, it was the hard edge that read as a band
    k1: { value: params.k1 ?? .70 }, k0: { value: params.k0 ?? -.40 }, soft1: { value: params.soft1 ?? .10 }, soft0: { value: params.soft0 ?? .17 }, rimAt: { value: .955 }, rimStr: { value: .28 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, side: THREE.FrontSide });
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'torso.mesh';
  const hullU = { uW0: { value: .030 }, uW1: { value: .022 }, uFade: { value: 0 }, uDir: { value: new THREE.Vector2(.5, -.866) }, uColor: { value: hex('#31242d') } };
  const hull = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: HULL_V, fragmentShader: HULL_F, uniforms: hullU, side: THREE.BackSide }));
  hull.name = 'torso.outline'; hull.userData.noOutline = true;
  // the pelvis, its own form with its own heavier ink, tucked behind the vest
  const gp = buildGeometry({ depthRatio: PELVIS.depthRatio, power: PELVIS.power, ys: PELVIS_YS(), widthAt: pelvisWidth, zOff: PELVIS.zOff });
  const pelvis = new THREE.Mesh(gp, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, defines: { PELVIS_PART: 1 }, side: THREE.FrontSide }));
  pelvis.name = 'torso.pelvis';
  const pelvisHullU = { uW0: { value: .046 }, uW1: { value: .016 }, uFade: { value: 1 }, uDir: { value: new THREE.Vector2(-.64, -.77) }, uColor: { value: hex('#31242d') } };
  const pelvisHull = new THREE.Mesh(gp, new THREE.ShaderMaterial({ vertexShader: HULL_V, fragmentShader: HULL_F, uniforms: pelvisHullU, side: THREE.BackSide }));
  pelvisHull.name = 'torso.pelvis.outline'; pelvisHull.userData.noOutline = true;
  body.add(pelvis, pelvisHull);
  const knot = new THREE.Mesh(patchGeometry(params, { s0: -.37, s1: -.155, y0: .535, y1: .70, lift: .02, base: .012 }), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, defines: { KNOT: 1 }, side: THREE.DoubleSide, alphaToCoverage: true }));
  knot.name = 'torso.knot'; knot.userData.noOutline = true; body.add(knot);
  const bandana = new THREE.Mesh(patchGeometry(params, { s0: -.165, s1: .15, y0: .395, y1: .72, lift: .022 }), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, defines: { BANDANA: 1 }, side: THREE.DoubleSide, alphaToCoverage: true }));
  bandana.name = 'torso.bandana'; bandana.userData.noOutline = true;
  body.add(mesh, hull, bandana); root.add(body);
  root.userData = { body, mesh, hull, pelvis, pelvisHull, bandana, knot, uniforms, hullU, pelvisHullU, sockets: SOCKETS, track: ownTrack, params: P };
  return root;
}

// The Boss (params.outfit 'boss'): same parts as the engineer's (vest mesh + crescent hull, pelvis + its hull), egg-shaped, no bandana or knot.
// Params: depthRatio (.84) power (2.2) palette {BOSS_PALETTE keys}, hull { w0 w1 } ink widths (D), pelvisHull { w0 w1 }.
function buildBoss(P, root, body, ownTrack) {
  const g = buildGeometry({ depthRatio: P.depthRatio ?? .84, power: P.power ?? 2.2, ys: BOSS_YS(), widthAt: bossWidth });
  const C = { ...PALETTE, ...BOSS_PALETTE, ...(P.palette || {}) };
  const uniforms = {
    uL: { value: new THREE.Vector2(-1, 0) },
    cLight: { value: hex(C.light) }, cMid: { value: hex(C.mid) }, cDark: { value: hex(C.dark) }, cRim: { value: hex(C.rim) }, cPelvis: { value: hex(C.pelvis) }, cPelvisDark: { value: hex(C.pelvisDark) }, cHem: { value: hex(C.hemLine) },
    cStrap: { value: hex(C.strap) }, cStrapEdge: { value: hex(C.strapEdge) }, cDash: { value: hex(C.dash) }, cInk: { value: hex(C.ink) }, cGold: { value: hex(C.gold) }, cGoldDark: { value: hex(C.goldDark) }, cBuckleIn: { value: hex(C.buckleIn) }, cCream: { value: hex(C.cream) },
    cRed: { value: hex(C.red) }, cRedPale: { value: hex(C.redPale) }, cWhite: { value: hex(C.white) }, cButton: { value: hex(C.button) }, cButtonInk: { value: hex(C.buttonInk) }, cPocket: { value: hex(C.pocketLine) }, cKnot: { value: hex(C.knot) }, cKnotPale: { value: hex(C.knotPale) },
    cPelvisKnee: { value: hex(C.pelvisKnee) }, cPelvisLow: { value: hex(C.pelvisLow) }, cPelvisShade: { value: hex(C.pelvisShade) }, uKneel: { value: 0 }, uNearBuckle: { value: 1 },
    cSpeck: { value: hex(C.speck) }, cShirtLine: { value: hex(C.shirtLine) }, uSag: { value: new THREE.Vector2(0, -.105) },
    k1: { value: .7 }, k0: { value: -.4 }, soft1: { value: .1 }, soft0: { value: .17 }, rimAt: { value: .955 }, rimStr: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, defines: { BOSS: 1 }, side: THREE.FrontSide });
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'torso.mesh';
  const hw = P.hull || {}, pw = P.pelvisHull || {};
  const hullU = { uW0: { value: hw.w0 ?? .030 }, uW1: { value: hw.w1 ?? .016 }, uFade: { value: 0 }, uDir: { value: new THREE.Vector2(.5, -.866) }, uColor: { value: hex(C.ink) } };
  const hull = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: HULL_V, fragmentShader: HULL_F, uniforms: hullU, side: THREE.BackSide }));
  hull.name = 'torso.outline'; hull.userData.noOutline = true;
  const gp = buildGeometry({ depthRatio: P.depthRatio ?? .84, power: 2, ys: BOSS_PELVIS_YS(), widthAt: bossPelvisWidth, zOff: -.03 });
  const pelvis = new THREE.Mesh(gp, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, defines: { PELVIS_PART: 1 }, side: THREE.FrontSide }));
  pelvis.name = 'torso.pelvis';
  const pelvisHullU = { uW0: { value: pw.w0 ?? .034 }, uW1: { value: pw.w1 ?? .012 }, uFade: { value: 1 }, uDir: { value: new THREE.Vector2(0, -1) }, uColor: { value: hex(C.ink) } };
  const pelvisHull = new THREE.Mesh(gp, new THREE.ShaderMaterial({ vertexShader: HULL_V, fragmentShader: HULL_F, uniforms: pelvisHullU, side: THREE.BackSide }));
  pelvisHull.name = 'torso.pelvis.outline'; pelvisHull.userData.noOutline = true;
  body.add(pelvis, pelvisHull, mesh, hull); root.add(body);
  root.userData = { body, mesh, hull, pelvis, pelvisHull, uniforms, hullU, pelvisHullU, sockets: BOSS_SOCKETS, track: ownTrack, params: P, boss: true };
  return root;
}

// The Rival Tycoon (params.outfit 'tycoon'): one coat mesh (rounded hem, no pelvis band) + its crescent hull; placed by updateBoss.
// Params: depthRatio (.86) power (2.2) palette {TYCOON_PALETTE keys}, hull { w0 w1 }, beach (gold waistcoat, f1600+), sash (f345), rose,
// sheen. A torso track key may carry beach / sash / rose (0/1) per frame and chainSag [x, y].
function buildTycoon(P, root, body, ownTrack) {
  const g = buildGeometry({ depthRatio: P.depthRatio ?? .86, power: P.power ?? 2.2, ys: TYC_YS(), widthAt: tycWidth });
  const C = { ...PALETTE, ...TYCOON_PALETTE, ...(P.palette || {}) };
  const uniforms = {
    uL: { value: new THREE.Vector2(-1, 0) },
    cLight: { value: hex(C.light) }, cMid: { value: hex(C.mid) }, cDark: { value: hex(C.dark) }, cRim: { value: hex(C.rim) }, cPelvis: { value: hex(C.pelvis) }, cPelvisDark: { value: hex(C.pelvisDark) }, cHem: { value: hex(C.hemLine) },
    cStrap: { value: hex(C.strap) }, cStrapEdge: { value: hex(C.strapEdge) }, cDash: { value: hex(C.dash) }, cInk: { value: hex(C.ink) }, cGold: { value: hex(C.gold) }, cGoldDark: { value: hex(C.goldDark) }, cBuckleIn: { value: hex(C.buckleIn) }, cCream: { value: hex(C.cream) },
    cRed: { value: hex(C.red) }, cRedPale: { value: hex(C.redPale) }, cWhite: { value: hex(C.white) }, cButton: { value: hex(C.button) }, cButtonInk: { value: hex(C.buttonInk) }, cPocket: { value: hex(C.pocketLine) }, cKnot: { value: hex(C.knot) }, cKnotPale: { value: hex(C.knotPale) },
    cPelvisKnee: { value: hex(C.pelvisKnee) }, cPelvisLow: { value: hex(C.pelvisLow) }, cPelvisShade: { value: hex(C.pelvisShade) }, uKneel: { value: 0 }, uNearBuckle: { value: 1 },
    cLapel: { value: hex(C.lapel) }, cVest: { value: hex(C.vest) }, cVestDark: { value: hex(C.vestDark) }, cRose: { value: hex(C.rose) }, cNavy: { value: hex(C.navy) }, cSheen: { value: hex(C.sheen) },
    uSag: { value: new THREE.Vector2(0, -.06) }, uBeach: { value: P.beach ? 1 : 0 }, uSash: { value: P.sash ? 1 : 0 }, uRose: { value: P.rose === false ? 0 : 1 }, uSheen: { value: P.sheen ?? .55 },
    k1: { value: .7 }, k0: { value: -.4 }, soft1: { value: .1 }, soft0: { value: .17 }, rimAt: { value: .955 }, rimStr: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, defines: { TYCOON: 1 }, side: THREE.FrontSide });
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'torso.mesh';
  const hw = P.hull || {};
  const hullU = { uW0: { value: hw.w0 ?? .028 }, uW1: { value: hw.w1 ?? .016 }, uFade: { value: 0 }, uDir: { value: new THREE.Vector2(.5, -.866) }, uColor: { value: hex(C.ink) } };
  const hull = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: HULL_V, fragmentShader: HULL_F, uniforms: hullU, side: THREE.BackSide }));
  hull.name = 'torso.outline'; hull.userData.noOutline = true;
  body.add(mesh, hull); root.add(body);
  // updateBoss sets the pelvis hull's direction: a stand-in that is never drawn
  const pelvisHullU = { uW0: { value: 0 }, uW1: { value: 0 }, uFade: { value: 1 }, uDir: { value: new THREE.Vector2(0, -1) }, uColor: { value: hex(C.ink) } };
  root.userData = { body, mesh, hull, uniforms, hullU, pelvisHullU, sockets: TYCOON_SOCKETS, track: ownTrack, params: P, boss: true, tycoon: true };
  return root;
}
// The Townsperson (params.outfit 'jacket'): one jacket mesh (rounded hem, no pelvis band) + its crescent hull; placed by updateBoss.
// Params: depthRatio (.86) power (2.2) palette {JACKET_PALETTE keys}, hull { w0 w1 }, rimOn (1).
function buildJacket(P, root, body, ownTrack) {
  const g = buildGeometry({ depthRatio: P.depthRatio ?? .86, power: P.power ?? 2.2, ys: TYC_YS(), widthAt: jktWidth });
  const C = { ...PALETTE, ...JACKET_PALETTE, ...(P.palette || {}) };
  const uniforms = {
    uL: { value: new THREE.Vector2(-1, 0) },
    cLight: { value: hex(C.light) }, cMid: { value: hex(C.mid) }, cDark: { value: hex(C.dark) }, cRim: { value: hex(C.rim) }, cPelvis: { value: hex(C.pelvis) }, cPelvisDark: { value: hex(C.pelvisDark) }, cHem: { value: hex(C.hemLine) },
    cStrap: { value: hex(C.strap) }, cStrapEdge: { value: hex(C.strapEdge) }, cDash: { value: hex(C.dash) }, cInk: { value: hex(C.ink) }, cGold: { value: hex(C.gold) }, cGoldDark: { value: hex(C.goldDark) }, cBuckleIn: { value: hex(C.buckleIn) }, cCream: { value: hex(C.cream) },
    cRed: { value: hex(C.red) }, cRedPale: { value: hex(C.redPale) }, cWhite: { value: hex(C.white) }, cButton: { value: hex(C.button) }, cButtonInk: { value: hex(C.buttonInk) }, cPocket: { value: hex(C.pocket) }, cKnot: { value: hex(C.knot) }, cKnotPale: { value: hex(C.knotPale) },
    cPelvisKnee: { value: hex(C.pelvisKnee) }, cPelvisLow: { value: hex(C.pelvisLow) }, cPelvisShade: { value: hex(C.pelvisShade) }, uKneel: { value: 0 }, uNearBuckle: { value: 1 },
    cLapel: { value: hex(C.lapel) }, cTie: { value: hex(C.tie) }, cTieDot: { value: hex(C.tieDot) }, cJRim: { value: hex(C.rim) },
    uSag: { value: new THREE.Vector2(0, 0) }, uRimOn: { value: P.rimOn ?? 1 },
    k1: { value: .7 }, k0: { value: -.4 }, soft1: { value: .1 }, soft0: { value: .17 }, rimAt: { value: .955 }, rimStr: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, defines: { JACKET: 1 }, side: THREE.FrontSide });
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'torso.mesh';
  const hw = P.hull || {};
  const hullU = { uW0: { value: hw.w0 ?? .030 }, uW1: { value: hw.w1 ?? .018 }, uFade: { value: 0 }, uDir: { value: new THREE.Vector2(.5, -.866) }, uColor: { value: hex(C.ink) } };
  const hull = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: HULL_V, fragmentShader: HULL_F, uniforms: hullU, side: THREE.BackSide }));
  hull.name = 'torso.outline'; hull.userData.noOutline = true;
  body.add(mesh, hull); root.add(body);
  const pelvisHullU = { uW0: { value: 0 }, uW1: { value: 0 }, uFade: { value: 1 }, uDir: { value: new THREE.Vector2(0, -1) }, uColor: { value: hex(C.ink) } };
  root.userData = { body, mesh, hull, uniforms, hullU, pelvisHullU, sockets: JACKET_SOCKETS, track: ownTrack, params: P, boss: true, jacket: true };
  return root;
}
// The Rival Inspector (params.outfit 'inspector'): one coat mesh (rounded hem, no pelvis band) + its crescent hull; placed by updateBoss.
// Params: depthRatio (.88) power (2.2) palette {INSPECTOR_PALETTE keys}, hull { w0 w1 }, rimOn (1), beltY (.30, torso units over the hem).
function buildInspector(P, root, body, ownTrack) {
  const g = buildGeometry({ depthRatio: P.depthRatio ?? .88, power: P.power ?? 2.2, ys: TYC_YS(), widthAt: inspWidth });
  const C = { ...PALETTE, ...INSPECTOR_PALETTE, ...(P.palette || {}) };
  const uniforms = {
    uL: { value: new THREE.Vector2(-1, 0) },
    cLight: { value: hex(C.light) }, cMid: { value: hex(C.mid) }, cDark: { value: hex(C.dark) }, cRim: { value: hex(C.rim) }, cPelvis: { value: hex(C.pelvis) }, cPelvisDark: { value: hex(C.pelvisDark) }, cHem: { value: hex(C.hemLine) },
    cStrap: { value: hex(C.strap) }, cStrapEdge: { value: hex(C.strapEdge) }, cDash: { value: hex(C.dash) }, cInk: { value: hex(C.ink) }, cGold: { value: hex(C.gold) }, cGoldDark: { value: hex(C.goldDark) }, cBuckleIn: { value: hex(C.buckleIn) }, cCream: { value: hex(C.cream) },
    cRed: { value: hex(C.red) }, cRedPale: { value: hex(C.redPale) }, cWhite: { value: hex(C.white) }, cButton: { value: hex(C.button) }, cButtonInk: { value: hex(C.buttonInk) }, cPocket: { value: hex(C.pocketLine) }, cKnot: { value: hex(C.knot) }, cKnotPale: { value: hex(C.knotPale) },
    cPelvisKnee: { value: hex(C.pelvisKnee) }, cPelvisLow: { value: hex(C.pelvisLow) }, cPelvisShade: { value: hex(C.pelvisShade) }, uKneel: { value: 0 }, uNearBuckle: { value: 1 },
    cIRim: { value: hex(C.rim) }, cBelt: { value: hex(C.belt) }, cIPocket: { value: hex(C.pocketI) },
    uSag: { value: new THREE.Vector2(0, 0) }, uIRimOn: { value: P.rimOn ?? 1 }, uBeltY: { value: P.beltY ?? .30 },
    k1: { value: .7 }, k0: { value: -.4 }, soft1: { value: .1 }, soft0: { value: .17 }, rimAt: { value: .955 }, rimStr: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, defines: { INSPECTOR: 1 }, side: THREE.FrontSide });
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'torso.mesh';
  const hw = P.hull || {};
  const hullU = { uW0: { value: hw.w0 ?? .030 }, uW1: { value: hw.w1 ?? .018 }, uFade: { value: 0 }, uDir: { value: new THREE.Vector2(.5, -.866) }, uColor: { value: hex(C.ink) } };
  const hull = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: HULL_V, fragmentShader: HULL_F, uniforms: hullU, side: THREE.BackSide }));
  hull.name = 'torso.outline'; hull.userData.noOutline = true;
  body.add(mesh, hull); root.add(body);
  const pelvisHullU = { uW0: { value: 0 }, uW1: { value: 0 }, uFade: { value: 1 }, uDir: { value: new THREE.Vector2(0, -1) }, uColor: { value: hex(C.ink) } };
  root.userData = { body, mesh, hull, uniforms, hullU, pelvisHullU, sockets: INSPECTOR_SOCKETS, track: ownTrack, params: P, boss: true, inspector: true };
  return root;
}
// The Passenger (params.outfit 'passenger'): the Tycoon's pill as one suit mesh + its crescent hull; placed by updateBoss.
// Params: depthRatio (.86) power (2.2) palette {PASSENGER_PALETTE keys}, hull { w0 w1 }, rimOn (.5), lines (fabric lines strength, 1).
function buildPassenger(P, root, body, ownTrack) {
  const g = buildGeometry({ depthRatio: P.depthRatio ?? .86, power: P.power ?? 2.2, ys: TYC_YS(), widthAt: tycWidth });
  const C = { ...PALETTE, ...PASSENGER_PALETTE, ...(P.palette || {}) };
  const uniforms = {
    uL: { value: new THREE.Vector2(-1, 0) },
    cLight: { value: hex(C.light) }, cMid: { value: hex(C.mid) }, cDark: { value: hex(C.dark) }, cRim: { value: hex(C.rim) }, cPelvis: { value: hex(C.pelvis) }, cPelvisDark: { value: hex(C.pelvisDark) }, cHem: { value: hex(C.hemLine) },
    cStrap: { value: hex(C.strap) }, cStrapEdge: { value: hex(C.strapEdge) }, cDash: { value: hex(C.dash) }, cInk: { value: hex(C.ink) }, cGold: { value: hex(C.gold) }, cGoldDark: { value: hex(C.goldDark) }, cBuckleIn: { value: hex(C.buckleIn) }, cCream: { value: hex(C.cream) },
    cRed: { value: hex(C.red) }, cRedPale: { value: hex(C.redPale) }, cWhite: { value: hex(C.white) }, cButton: { value: hex(C.button) }, cButtonInk: { value: hex(C.buttonInk) }, cPocket: { value: hex(C.pocketLine) }, cKnot: { value: hex(C.knot) }, cKnotPale: { value: hex(C.knotPale) },
    cPelvisKnee: { value: hex(C.pelvisKnee) }, cPelvisLow: { value: hex(C.pelvisLow) }, cPelvisShade: { value: hex(C.pelvisShade) }, uKneel: { value: 0 }, uNearBuckle: { value: 1 },
    cLapel: { value: hex(C.lapel) }, cTie: { value: hex(C.tie) }, cTieDot: { value: hex(C.tieDot) }, cPRim: { value: hex(C.rim) }, cPPocket: { value: hex(C.pocket) }, cLine: { value: hex(C.line) },
    uSag: { value: new THREE.Vector2(0, 0) }, uRimOn: { value: P.rimOn ?? .5 }, uLines: { value: P.lines ?? 1 },
    k1: { value: .7 }, k0: { value: -.4 }, soft1: { value: .1 }, soft0: { value: .17 }, rimAt: { value: .955 }, rimStr: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, defines: { PASSENGER: 1 }, side: THREE.FrontSide });
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'torso.mesh';
  const hw = P.hull || {};
  const hullU = { uW0: { value: hw.w0 ?? .030 }, uW1: { value: hw.w1 ?? .018 }, uFade: { value: 0 }, uDir: { value: new THREE.Vector2(.5, -.866) }, uColor: { value: hex(C.ink) } };
  const hull = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: HULL_V, fragmentShader: HULL_F, uniforms: hullU, side: THREE.BackSide }));
  hull.name = 'torso.outline'; hull.userData.noOutline = true;
  body.add(mesh, hull); root.add(body);
  const pelvisHullU = { uW0: { value: 0 }, uW1: { value: 0 }, uFade: { value: 1 }, uDir: { value: new THREE.Vector2(0, -1) }, uColor: { value: hex(C.ink) } };
  root.userData = { body, mesh, hull, uniforms, hullU, pelvisHullU, sockets: PASSENGER_SOCKETS, track: ownTrack, params: P, boss: true, passenger: true };
  return root;
}
// ---- Any body + outfit from data (agent E, engine/outfit.js, engine/BODY_API.md): params.body (build class or profile) + params.outfit
// (object: colour, trousers, skirt, layers). The shader is torso.js's own FRAG with one CUSTOM block spliced in (the engineer's and the
// other outfits' shader strings are untouched). Placement = updateBoss. Meshes: torso (+ pelvis band in the trousers colour if the build
// has one) + an optional skirt, each with its crescent hull. A second surface coordinate b (arc from the back centre) drives the plain back.
function addBackArc(g, NU = 256) {
  const S = g.getAttribute('aS').array, B = new Float32Array(S.length), W = NU + 1;
  for (let r = 0; r < S.length / W; r++) {
    const half = Math.abs(S[r * W]);
    for (let i = 0; i < W; i++) { const s = S[r * W + i]; B[r * W + i] = -Math.sign(s) * (half - Math.abs(s)); }
  }
  g.setAttribute('aB', new THREE.Float32BufferAttribute(B, 1));
  return g;
}
const VERT_C = VERT.replace('attribute float aS;', 'attribute float aS;\nattribute float aB;\nvarying float vB;').replace('vS = aS;', 'vS = aS; vB = aB;');
function fragCustom(O) {
  const block = `#ifdef CUSTOM
  {
    float kb = dot(N.xy, uL);
    vec2 b = vec2(vB, vY);
    vec3 cl = vec3(1.);
#ifdef CSKIRT
    ${O.skirt || 'vec3 c = cl;'}
#else
    ${O.torso}
#endif
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
    return;
  }
#endif
`;
  return FRAG.replace('void main() {', `${O.decl}\nuniform float uCRim;\n#define RIMON uCRim\nvoid main() {`).replace('#ifdef BOSS\n  {', block + '#ifdef BOSS\n  {');
}
// ---- Seated / kneeling skirt drape (FX2, 2026-11-04). The skirt tube is bent in its vertex shaders along an axis path (body space, YZ
// plane) solved per frame from the DRAWN legs (limbs tube centrelines): down from the waist, forward along the thigh (the most forward leg)
// while it runs flatter than 55 deg, then straight down from the knee to just above the floor. Each ring is rotated with the path (front
// panel up over the lap, back panel under it on the seat) and flattened once the lap is horizontal. Standing / walking legs leave the
// knee at the hip: weight 0 -> uDrOn 0 -> the original vertex maths, unchanged.
const DRN = 40;
const DRAPE_GLSL = /* glsl */`
uniform float uDrOn, uDrTop, uDrLen, uDrZ;
uniform vec4 uDr[${DRN}];   // per sample along the skirt: axis y, axis z, angle from straight down (rad, + = forward), depth scale
vec3 drapeP(vec3 p, inout vec3 n) {
  if (uDrOn < .5) return p;
  float s = clamp((uDrTop - p.y) / uDrLen, 0., 1.) * ${DRN - 1}.;
  float fi = min(floor(s), ${DRN - 2}.);
  int i = int(fi);
  vec4 a = mix(uDr[i], uDr[i + 1], s - fi);
  float c = cos(a.z), sn = sin(a.z), dz = (p.z - uDrZ) * a.w;
  vec3 m = vec3(n.x, n.y, n.z / max(a.w, .2));
  n = vec3(m.x, m.y * c + m.z * sn, -m.y * sn + m.z * c);
  return vec3(p.x, a.x + dz * sn, a.y + dz * c);
}
`;
const must = (s, a, b) => { if (!s.includes(a)) throw new Error('torso.js drape: shader text not found: ' + a.slice(0, 40)); return s.replace(a, b); };
let VERT_S = null, HULL_S = null;
function drapeShaders() {
  if (VERT_S) return;
  VERT_S = must(must(VERT_C, 'void main() {', DRAPE_GLSL + 'void main() {'),
    'gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);', 'vec3 _n = normal; vec3 _p = drapeP(position, _n);\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(_p, 1.0);');
  HULL_S = must(must(must(HULL_V, 'void main() {', DRAPE_GLSL + 'void main() {'),
    'vec4 mv = modelViewMatrix * vec4(p, 1.0);', 'float _ny = uFade > .5 ? 1. : smoothstep(.0, .12, p.y);\n  vec3 _n = vec3(normal.x, normal.y * _ny, normal.z);\n  vec3 _p = drapeP(p, _n);\n  vec4 mv = modelViewMatrix * vec4(_p, 1.0);'),
    'vec3 n = normalMatrix * normalize(vec3(normal.x, normal.y * ny, normal.z));', 'vec3 n = normalMatrix * normalize(_n);');
}
const _dm = new THREE.Matrix4(), _dv = new THREE.Vector3();
const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// writes drU (uDrOn, uDr) for this frame from the drawn legs; K = the skirt definition; body = the torso's body object
function solveDrape(drU, K, body) {
  drU.uDrOn.value = 0;
  const hs = body.parent && body.parent.parent;
  const limbs = hs && hs.children.find(o => o.userData && o.userData.tubes);
  if (!limbs) return;
  _dm.copy(body.matrixWorld).invert().multiply(limbs.matrixWorld);
  let best = null, floorY = Infinity, minReach = Infinity;
  for (const k of ['nearLeg', 'farLeg']) {
    const tb = limbs.userData.tubes[k];
    if (!tb || !tb.mesh.visible) continue;
    const n = tb.rings, ys = [], zs = [];
    for (let i = 0; i < n; i++) { _dv.set(tb.c[i * 3], tb.c[i * 3 + 1], tb.c[i * 3 + 2]).applyMatrix4(_dm); ys.push(_dv.y); zs.push(_dv.z); }
    floorY = Math.min(floorY, ys[n - 1]);
    // the knee: the point that is furthest forward once the drop below the hip is charged (z - .5 x drop): continuous in the leg, so the
    // lap folds in smoothly (a "first segment steeper than 55 deg" rule jumped from 0 to the whole thigh in one frame of sit_down)
    let kn = 0, reach = 0;
    // FIX-SEAT: the knee is searched only in the upper 40 % of the hip-to-foot drop (the shin of a seated leg slants forward too, so the
    // "knee" used to land near the FOOT and the lap covered the whole leg down to the floor)
    const kMax = .4 * Math.max(.05, ys[0] - ys[n - 1]);
    for (let i = 1; i < n; i++) { if (ys[0] - ys[i] > kMax) break; const f = (zs[i] - zs[0]) - .5 * Math.max(0, ys[0] - ys[i]); if (f > reach) { reach = f; kn = i; } }
    let arc = 0; for (let i = 1; i < n; i++) arc += Math.hypot(ys[i] - ys[i - 1], zs[i] - zs[i - 1]);
    minReach = Math.min(minReach, reach);
    if (!best || reach > best.reach) best = { reach, kn, ys, zs, arc };
  }
  if (!best) return;
  // the floor = the world ground (y 0) under the body, in body space: a foot lifted mid-step (sit_down steps both feet) is not the floor
  _dv.setFromMatrixPosition(body.matrixWorld); _dv.y = 0; _dm.copy(body.matrixWorld).invert(); _dv.applyMatrix4(_dm);
  floorY = Math.min(floorY, _dv.y + .03);
  // only LOW hips drape (seated ~.5 x the leg, kneeling ~.5): a running stride throws a thigh forward too, with the hips at full height
  const hipH = (best.ys[0] - floorY) / Math.max(.3, best.arc);
  // fix1: a walking stride throws ONE thigh forward with the hips only a little low (deep bob + bent knees), which draped the skirt
  // over the stride leg like a seat. Seated = BOTH thighs forward; one leg forward drapes only with really low hips (kneeling).
  const both = minReach === Infinity ? 0 : smooth01(.06, .3, minReach);
  const kneel = 1 - smooth01(.42, .55, hipH);
  const w = smooth01(.06, .36, best.reach) * (1 - smooth01(.58, .82, hipH)) * Math.max(both, kneel);
  if (w < 1e-3) return;
  const len = K.yTop - K.yb, zc = K.zOff, lift = K.lift;
  // the path: waist, the thigh (lifted so the slab's back rests on the leg line), the knee, then down to just above the floor
  let pts = [[K.yTop, zc]];
  for (let i = 0; i <= best.kn; i++) pts.push([best.ys[i] + lift, best.zs[i] + K.kneeFwd * i / Math.max(1, best.kn)]);
  const kY = pts[pts.length - 1][0], kZ = pts[pts.length - 1][1];
  let pl = 0; for (let i = 1; i < pts.length; i++) pl += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  // FIX-SEAT: the hang below the knee covers only `K.hang` of the knee-to-floor drop (default .5), so a seated long skirt ends at
  // mid-shin and the shins + feet show under it (it used to reach the floor: no legs at all on an ankle skirt)
  // AGENT-A (2026-11-04, proof f420): a skirt whose length was used up by the lap ended AT the knee, its last rings still turned
  // forward, so the open hem faced the camera and its dark hull read as a disc with the legs coming out of it. The hem now always
  // hangs straight down for at least `minHang` (the whole length is spread over the path anyway), so its opening faces the floor.
  const room = kY - (floorY + K.hemUp);
  const hang = Math.max(Math.min(K.minHang ?? .16, Math.max(.02, room)), Math.min(len - pl, room, (kY - floorY) * K.hang));
  pts.push([kY - hang * .5, kZ], [kY - hang, kZ]);
  for (let it = 0; it < 3; it++) { // Chaikin: round the waist and knee corners (keeps both ends)
    const q = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; q.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); }
    q.push(pts[pts.length - 1]); pts = q;
  }
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const tot = cum[cum.length - 1] || 1, A = [];
  let j = 0;
  for (let i = 0; i < DRN; i++) { // resample evenly along the path (the whole skirt length spreads over it)
    const s = tot * i / (DRN - 1);
    while (j < pts.length - 2 && cum[j + 1] < s) j++;
    const f = Math.min(1, Math.max(0, (s - cum[j]) / ((cum[j + 1] - cum[j]) || 1)));
    A.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f]);
  }
  let flat = 0;
  for (let i = 0; i < DRN; i++) {
    const a = A[Math.max(0, i - 1)], b = A[Math.min(DRN - 1, i + 1)];
    let th = i === 0 ? 0 : Math.atan2(b[1] - a[1], -(b[0] - a[0]));
    if (i >= DRN - 2) th = Math.min(th, 0); // AGENT-A: the hem ring itself is level (its opening faces the floor, never the camera)
    flat = Math.max(flat, Math.max(0, Math.sin(th)));
    const q = 1 - (1 - K.flat) * flat;
    // blend with the standing skirt by w (sit_down / stand_up: the lap folds in as the thighs come forward)
    const y0 = K.yTop - len * i / (DRN - 1);
    drU.uDr.value[i].set(y0 + (A[i][0] - y0) * w, zc + (A[i][1] - zc) * w, th * w, 1 + (q - 1) * w);
  }
  drU.uDrOn.value = 1;
}

function buildCustom(P, root, body, ownTrack) {
  const S = shapeOf(P.body || {});
  const OUT = typeof P.outfit === 'object' && P.outfit ? P.outfit : {};
  const O = compileOutfit({ ...OUT, _legLen: P.legLen ?? S.legLen }, S);
  const C = { ...PALETTE, ink: O.ink, hemLine: O.ink, pelvis: O.trousers, pelvisDark: O.trousersDark, pelvisKnee: O.trousers, pelvisLow: O.trousers, pelvisShade: O.trousersDark };
  const uniforms = {
    uL: { value: new THREE.Vector2(-1, 0) }, uSag: { value: new THREE.Vector2(0, 0) }, uCRim: { value: O.rim }, uKneel: { value: 0 },
    cInk: { value: hex(C.ink) }, cHem: { value: hex(C.hemLine) }, cPelvis: { value: hex(C.pelvis) }, cPelvisDark: { value: hex(C.pelvisDark) },
    cPelvisKnee: { value: hex(C.pelvisKnee) }, cPelvisLow: { value: hex(C.pelvisLow) }, cPelvisShade: { value: hex(C.pelvisShade) },
  };
  const frag = fragCustom(O);
  const hw = P.hull || {};
  const hullU = { uW0: { value: hw.w0 ?? .030 }, uW1: { value: hw.w1 ?? .018 }, uFade: { value: 0 }, uDir: { value: new THREE.Vector2(.5, -.866) }, uColor: { value: hex(C.ink) } };
  const hullOf = (g, U, name) => { const h = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: HULL_V, fragmentShader: HULL_F, uniforms: U, side: THREE.BackSide })); h.name = name; h.userData.noOutline = true; return h; };
  const g = addBackArc(buildGeometry({ depthRatio: S.depthRatio, power: S.power, ys: S.ysTorso, widthAt: S.hw }));
  const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: VERT_C, fragmentShader: frag, uniforms, defines: { CUSTOM: 1 }, side: THREE.FrontSide }));
  mesh.name = 'torso.mesh';
  const hull = hullOf(g, hullU, 'torso.outline');
  const pelvisHullU = { uW0: { value: P.pelvisHull?.w0 ?? .034 }, uW1: { value: P.pelvisHull?.w1 ?? .012 }, uFade: { value: 1 }, uDir: { value: new THREE.Vector2(0, -1) }, uColor: { value: hex(C.ink) } };
  const ud = { body, mesh, hull, uniforms, hullU, pelvisHullU, sockets: S.sockets, track: ownTrack, params: P, boss: true, custom: true, shape: S,
    bodyInfo: { legLen: S.legLen, armLen: S.armLen, W: S.W, H: S.H, top: S.top, bottom: S.bottom, skirt: O.skirtDef } };
  if (S.pelvis) {
    const gp = buildGeometry({ depthRatio: S.depthRatio * .97, power: 2, ys: S.ysPelvis, widthAt: S.pelvis.hw, zOff: -.03 });
    const pelvis = new THREE.Mesh(gp, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, defines: { PELVIS_PART: 1 }, side: THREE.FrontSide }));
    pelvis.name = 'torso.pelvis';
    body.add(pelvis, hullOf(gp, pelvisHullU, 'torso.pelvis.outline'));
    ud.pelvis = pelvis;
  }
  body.add(mesh, hull);
  if (O.skirtDef) {
    const K = O.skirtDef, ys = [];
    for (let i = 0; i <= 90; i++) ys.push(K.yTop - (K.yTop - K.yb) * i / 90);
    const rAt = y => K.r0 + (K.r1 - K.r0) * Math.pow(Math.min(1, Math.max(0, (K.yTop - y) / (K.yTop - K.yb))), K.e);
    const gs = addBackArc(buildGeometry({ depthRatio: K.depthRatio, power: K.power, ys, widthAt: rAt, zOff: K.zOff }));
    // FX2: seated / kneeling drape (solveDrape above); params.skirtDrape: false turns it off, { lift, flat, kneeFwd, hemUp } tune it
    const DP = P.skirtDrape === false ? null : { lift: .05, flat: .32, kneeFwd: .04, hemUp: .05, hang: .5, ...(typeof P.skirtDrape === 'object' ? P.skirtDrape : {}) };
    drapeShaders();
    const drU = { uDrOn: { value: 0 }, uDrTop: { value: K.yTop }, uDrLen: { value: K.yTop - K.yb }, uDrZ: { value: K.zOff }, uDr: { value: Array.from({ length: DRN }, () => new THREE.Vector4(0, 0, 0, 1)) } };
    // the standing skirt keeps its original shaders (pixel-identical); a second pair with the drape shaders draws only while seated.
    // Which pair draws is decided at render time (the legs of this frame are posed by then): the other writes neither colour nor depth.
    const skirt = new THREE.Mesh(gs, new THREE.ShaderMaterial({ vertexShader: VERT_C, fragmentShader: frag, uniforms, defines: { CUSTOM: 1, CSKIRT: 1 }, side: THREE.FrontSide }));
    skirt.name = 'torso.skirt';
    const so = hullOf(gs, hullU, 'torso.skirt.outline');
    body.add(skirt, so);
    ud.skirt = skirt;
    if (DP) {
      const KD = { ...K, ...DP };
      const ds = new THREE.Mesh(gs, new THREE.ShaderMaterial({ vertexShader: VERT_S, fragmentShader: frag, uniforms: { ...uniforms, ...drU }, defines: { CUSTOM: 1, CSKIRT: 1 }, side: THREE.FrontSide }));
      ds.name = 'torso.skirt.drape';
      const dh = new THREE.Mesh(gs, new THREE.ShaderMaterial({ vertexShader: HULL_S, fragmentShader: HULL_F, uniforms: { ...hullU, ...drU }, side: THREE.BackSide }));
      dh.name = 'torso.skirt.drape.outline'; dh.userData.noOutline = true;
      ds.frustumCulled = false; dh.frustumCulled = false; // the bent skirt leaves the standing bounds
      const gate = (m, whenDraped) => { m.onBeforeRender = () => { solveDrape(drU, KD, body); const on = (drU.uDrOn.value > .5) === whenDraped; m.material.colorWrite = on; m.material.depthWrite = on; }; };
      gate(skirt, false); gate(so, false); gate(ds, true); gate(dh, true);
      body.add(ds, dh);
      ud.skirtDrape = drU;
    }
  }
  root.add(body);
  root.userData = ud;
  return root;
}

function updateTycoonLook(frame, ctx) {
  const { uniforms, track, params: P } = ctx.root.userData;
  let near = null;
  for (const k of Object.keys(track)) if (/^\d+$/.test(k) && (near === null || Math.abs(k - frame) < Math.abs(near - frame))) near = +k;
  const K = near !== null ? track[near] : {};
  uniforms.uBeach.value = (K.beach ?? P.beach) ? 1 : 0;
  uniforms.uSash.value = (K.sash ?? P.sash) ? 1 : 0;
  uniforms.uRose.value = (K.rose ?? P.rose ?? true) ? 1 : 0;
  const sag = K.chainSag ?? [0, -.06];
  uniforms.uSag.value.set(sag[0], sag[1]);
}

// Per shot, measured: how far the light tone reaches (k1, normal against the light) and where the ink is heavy (screen degrees, 90 = down;
// the head's dark side swings between the same shots: 132 f0-30, 122 f31-60, 60 f61-95).
const ramp = (f, a, b, x, y) => x + (y - x) * Math.min(1, Math.max(0, (f - a) / (b - a)));
export function lookAt(f) {
  return {
    k1: f <= 63 ? ramp(f, 58, 63, .76, .60) : f <= 76 ? .60 : ramp(f, 76, 77, .60, .78),
    inkDeg: 55, // the vest: thin along the lit upper left, heavy lower right, in every shot
    pelvisDeg: ramp(f, 58, 63, 130, 75), // the pelvis: heavy lower left on the kneeling frames, straight under him on the front ones
    kneel: 1 - ramp(f, 58, 63, 0, 1),    // the pelvis's kneeling shade (the near thigh lies over it only then)
    // ink past the pelvis, outer edge against his: kneeling ours stood .012-.02 D out on f40 and f56 (f3, f19 by eye), standing .008 on f66, f80, f98
    pelvisW0: ramp(f, 58, 63, .030, .038), pelvisW1: ramp(f, 58, 63, .014, .016),
  };
}

const _m = new THREE.Matrix4(), _b = new THREE.Matrix4(), _v = new THREE.Vector3();
// The Boss: the same placement as the engineer's (x y D lean yaw pitch sy from the track, light riding the lean); the ink is heavy lower
// right (P.inkDeg, default 55) and the pelvis ink straight down (P.pelvisDeg 90).
function updateBoss(frame, ctx) {
  const { body, uniforms, hullU, pelvisHullU, track, params: P } = ctx.root.userData;
  const T = poseAt(frame, track), DEG = Math.PI / 180;
  let near = null; // per-frame depth key tz from the nearest track key (bent-over frames sit the body deeper behind the head)
  for (const k of Object.keys(track)) if (/^\d+$/.test(k) && (near === null || Math.abs(k - frame) < Math.abs(near - frame))) near = +k;
  const tz = (near !== null ? track[near].tz : undefined) ?? P.tz ?? -.42;
  const headZ = -new THREE.Vector3().applyMatrix4(ctx.camera.matrixWorldInverse).z;
  const depth = headZ - tz;
  const { cx, cy, d } = ctx.cam, F = ctx.focal;
  const persp = depth * (T.D ?? T.s * d) / F;
  const e = ctx.camera.matrixWorld.elements;
  const B = new THREE.Matrix4().set(e[0], e[4], e[8], 0, e[1], e[5], e[9], 0, e[2], e[6], e[10], 0, 0, 0, 0, 1);
  const local = new THREE.Matrix4().makeRotationZ(T.lean * DEG)
    .multiply(new THREE.Matrix4().makeRotationX(T.pitch * DEG))
    .multiply(new THREE.Matrix4().makeRotationY(T.yaw * DEG))
    .multiply(new THREE.Matrix4().makeScale(persp, (T.sy ?? 1) * persp, persp));
  const M = B.clone().multiply(local);
  const sx = T.x ?? cx + T.tx * d, sy = T.y ?? cy - T.ty * d;
  const v = new THREE.Vector3((sx - ctx.width / 2) / F * depth, -(sy - ctx.height / 2) / F * depth, -depth).applyMatrix4(ctx.camera.matrixWorld);
  M.setPosition(v);
  body.matrixAutoUpdate = false;
  body.matrix.copy(M); body.matrixWorldNeedsUpdate = true;
  const a = (T.lean + (P.lightDeg ?? 0)) * DEG;
  uniforms.uL.value.set(-Math.cos(a), -Math.sin(a));
  const sag = (near !== null ? track[near].chainSag : undefined) ?? [0, -.105]; // the watch chain hangs this way (surface units): gravity on a bent body
  uniforms.uSag.value.set(sag[0], sag[1]);
  const ink = (T.inkDeg ?? P.inkDeg ?? 55) * DEG, pd = (P.pelvisDeg ?? 90) * DEG;
  hullU.uDir.value.set(Math.cos(ink), -Math.sin(ink));
  pelvisHullU.uDir.value.set(Math.cos(pd), -Math.sin(pd));
}

export function update(frame, ctx) {
  if (ctx.root.userData.tycoon) { updateBoss(frame, ctx); return updateTycoonLook(frame, ctx); }
  if (ctx.root.userData.boss) return updateBoss(frame, ctx);
  const { body, uniforms, hullU, pelvisHullU, knot, track, params: P } = ctx.root.userData;
  const T = poseAt(frame, track), DEG = Math.PI / 180;
  const tz = P.tz ?? -.42; // how far behind the head along the view, in head diameters; only depth order, the screen place stays exact
  const headZ = -new THREE.Vector3().applyMatrix4(ctx.camera.matrixWorldInverse).z;
  const depth = headZ - tz;
  const { cx, cy, d } = ctx.cam, F = ctx.focal;
  const persp = depth * (T.D ?? T.s * d) / F; // world size at the body's depth of one torso unit, T.D px on screen (s = 1 means one head d)
  const e = ctx.camera.matrixWorld.elements;
  _b.set(e[0], e[4], e[8], 0, e[1], e[5], e[9], 0, e[2], e[6], e[10], 0, 0, 0, 0, 1); // camera basis, no translation
  // body in the camera frame: lean about the view axis, pitch, then yaw about its own axis
  const local = new THREE.Matrix4().makeRotationZ(T.lean * DEG)
    .multiply(new THREE.Matrix4().makeRotationX(T.pitch * DEG))
    .multiply(new THREE.Matrix4().makeRotationY(T.yaw * DEG))
    .multiply(new THREE.Matrix4().makeScale(persp, (T.sy ?? 1) * persp, persp));
  _m.copy(_b).multiply(local);
  // the exact pixel: head centre + (tx, ty) head diameters on screen, at the body's depth (pinhole, so off-axis parallax can't shift it)
  const sx = T.x ?? cx + T.tx * d, sy = T.y ?? cy - T.ty * d; // x y D are absolute px, so a re-solved head camera can't move the torso
  _v.set((sx - ctx.width / 2) / F * depth, -(sy - ctx.height / 2) / F * depth, -depth).applyMatrix4(ctx.camera.matrixWorld);
  _m.setPosition(_v);
  body.matrixAutoUpdate = false;
  body.matrix.copy(_m); body.matrixWorldNeedsUpdate = true;
  // the light rides with the lean, not with the yaw: the bands stay on the viewer's left however the body turns
  const a = T.lean * DEG, lx = Math.cos(a), ly = Math.sin(a);
  uniforms.uL.value.set(-lx, -ly);
  // never seen on f0-56: when the body turns this side to the camera the near arm lies on it, so it stays off until the arm rig does that
  knot.visible = T.yaw < 20;
  const look = lookAt(P.lookFrame ?? frame); // the engineer's f0-108 light schedule; params.lookFrame picks the frame it is read at
  uniforms.k1.value = P.k1 ?? look.k1;
  hullU.uDir.value.set(Math.cos(look.inkDeg * DEG), -Math.sin(look.inkDeg * DEG));
  pelvisHullU.uDir.value.set(Math.cos(look.pelvisDeg * DEG), -Math.sin(look.pelvisDeg * DEG));
  pelvisHullU.uW0.value = look.pelvisW0; pelvisHullU.uW1.value = look.pelvisW1;
  uniforms.uKneel.value = look.kneel;
  // turned this far the near hem buckle is under the arm and thigh in his (f19 yaw 47, f40 yaw 49: at most a speck; f3 yaw 40, f56 yaw 42: shown): only its ink is left, so it can't poke out of the gap between them
  // a ramp over yaw 43-47, not a switch: it slides under the arm over several frames in his, an on/off popped at f15 and f53
  uniforms.uNearBuckle.value = look.kneel > .5 ? Math.min(1, Math.max(0, (47 - T.yaw) / 4)) : 1;
}

export default { build, update };
