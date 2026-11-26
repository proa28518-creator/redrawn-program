// limbs.js: rubber-hose arms and legs, ball hands, tab feet. Real 3D tubes rebuilt per frame from limbTrack.json.
//
//   build({ saw = true, front = {...} })  Group; update(frame, ctx) poses it from the track.
//   Pose: track.keys[frame] (Catmull-Rom control points in character space; first point = socket), interpolated between keys.
//   poseAt(frame) returns the interpolated pose, setPose(pose) applies any pose of the same shape, so later agents can key new ones.
//   front: per-limb depth offset in head diameters: draws as if that much nearer the camera without moving on screen. Use it to
//   settle draw order against the vest; 0 means real depth only. `frontRamp` fades it in along the limb (nearArm starts at the chin).
//
// Width is constant and all limbs share it (measured: arms = legs = .05 D, no taper). A tight bend stays a clean silhouette
// because the mesh is unlit and flat: the inside of a bend folds into itself, which can't show.
import * as THREE from './three.js';
import { loadTrack as loadTrackFrom } from './tracks.js';

// loadTrack(): the default track (src/limbTrack.json), cached here as the default of poseAt(frame) for tools. Each built limbs group keeps
// its own in root.userData.track (params.tracks / params.track, see tracks.js), so two characters never share one.
let TRACK = null;
const ink = '#3a2a33';
export async function loadTrack() {
  if (!TRACK) TRACK = await (await fetch(new URL('./limbTrack.json?x=' + Date.now(), import.meta.url))).json();
  return TRACK;
}

const VERT = `
attribute float aS;
uniform float uFront, uRamp;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec4 clip = projectionMatrix * mv;
  float f = uFront * smoothstep(0.0, max(uRamp, 1e-4), aS);
  if (f != 0.0) { vec4 c2 = projectionMatrix * vec4(mv.xy, mv.z + f, 1.0); clip.z = c2.z / c2.w * clip.w; }
  gl_Position = clip;
}`;
const FRAG = `
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, 1.0);
  #include <colorspace_fragment>
}`;
export function flatMat(color, front = 0, ramp = 0) {
  return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uFront: { value: front }, uRamp: { value: ramp } } });
}

// Centripetal Catmull-Rom, sampled into dst (Float64Array xyz) as `n` points evenly spaced by arc length.
const tmp = new Float64Array(3 * 600);
export function sampleSpline(P, n, dst) {
  const m = P.length, per = Math.max(6, Math.ceil(240 / (m - 1)));
  const G = i => (i < 0 ? [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1], 2 * P[0][2] - P[1][2]]
    : i >= m ? [2 * P[m - 1][0] - P[m - 2][0], 2 * P[m - 1][1] - P[m - 2][1], 2 * P[m - 1][2] - P[m - 2][2]] : P[i]);
  let c = 0;
  for (let i = 0; i < m - 1; i++) {
    const p0 = G(i - 1), p1 = G(i), p2 = G(i + 1), p3 = G(i + 2);
    const dist = (a, b) => Math.max(Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])), 1e-4);
    const d0 = dist(p0, p1), d1 = dist(p1, p2), d2 = dist(p2, p3);
    for (let s = 0; s < per; s++) {
      const u = s / per, u2 = u * u, u3 = u2 * u;
      const a = 2 * u3 - 3 * u2 + 1, b = u3 - 2 * u2 + u, e = -2 * u3 + 3 * u2, f = u3 - u2;
      for (let k = 0; k < 3; k++) {
        const t1 = ((p1[k] - p0[k]) / d0 - (p2[k] - p0[k]) / (d0 + d1) + (p2[k] - p1[k]) / d1) * d1;
        const t2 = ((p2[k] - p1[k]) / d1 - (p3[k] - p1[k]) / (d1 + d2) + (p3[k] - p2[k]) / d2) * d1;
        tmp[c * 3 + k] = a * p1[k] + b * t1 + e * p2[k] + f * t2;
      }
      c++;
    }
  }
  tmp[c * 3] = P[m - 1][0]; tmp[c * 3 + 1] = P[m - 1][1]; tmp[c * 3 + 2] = P[m - 1][2]; c++;
  let L = 0; const acc = new Float64Array(c);
  for (let i = 1; i < c; i++) { L += Math.hypot(tmp[i * 3] - tmp[i * 3 - 3], tmp[i * 3 + 1] - tmp[i * 3 - 2], tmp[i * 3 + 2] - tmp[i * 3 - 1]); acc[i] = L; }
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = L * i / (n - 1);
    while (j < c - 2 && acc[j + 1] < t) j++;
    const w = (t - acc[j]) / Math.max(acc[j + 1] - acc[j], 1e-9);
    for (let k = 0; k < 3; k++) dst[i * 3 + k] = tmp[j * 3 + k] * (1 - w) + tmp[(j + 1) * 3 + k] * w;
  }
  return L;
}

// A tube mesh with a fixed topology: `rings` along, `rad` around, plus a domed cap at each end unless that end is mitred.
export class Tube {
  constructor({ rings = 64, rad = 10, caps = 5, material }) {
    Object.assign(this, { rings, rad, caps });
    this.total = rings + caps * 2;
    this.pos = new Float32Array(this.total * rad * 3);
    const idx = [];
    for (let i = 0; i < this.total - 1; i++) for (let j = 0; j < rad; j++) {
      const a = i * rad + j, b = i * rad + (j + 1) % rad, c = a + rad, d = b + rad;
      idx.push(a, b, c, b, d, c);
    }
    const s = new Float32Array(this.total * rad);
    for (let i = 0; i < this.total; i++) for (let j = 0; j < rad; j++) s[i * rad + j] = Math.max(0, Math.min(1, (i - caps) / (rings - 1)));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.c = new Float64Array(rings * 3);
  }
  // radius: number or f(u). mitreStart/mitreEnd: unit normal of the cutting plane through that end point (a sharp corner) or null.
  setSpline(P, radius, { mitreStart = null, mitreEnd = null, maxMitre = 3 } = {}) {
    const { rings: n, rad, caps, c } = this;
    sampleSpline(P, n, c);
    const rf = typeof radius === 'function' ? radius : () => radius;
    // parallel transport: no twist, whatever the bend
    let tx = c[3] - c[0], ty = c[4] - c[1], tz = c[5] - c[2], l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
    let ux = Math.abs(ty) < .9 ? 0 : 1, uy = Math.abs(ty) < .9 ? 1 : 0, uz = 0;
    let dot = ux * tx + uy * ty + uz * tz; ux -= dot * tx; uy -= dot * ty; uz -= dot * tz; l = Math.hypot(ux, uy, uz); ux /= l; uy /= l; uz /= l;
    const ring = (ri, x, y, z, r, tx, ty, tz, ux, uy, uz, mx = null, my = 0, mz = 0) => {
      const vx = ty * uz - tz * uy, vy = tz * ux - tx * uz, vz = tx * uy - ty * ux;
      for (let j = 0; j < rad; j++) {
        const a = j / rad * Math.PI * 2, ca = Math.cos(a) * r, sa = Math.sin(a) * r;
        let dx = ux * ca + vx * sa, dy = uy * ca + vy * sa, dz = uz * ca + vz * sa, sh = 0;
        if (mx !== null) { // slide along the axis to the mitre plane
          const den = tx * mx + ty * my + tz * mz;
          if (Math.abs(den) > 1e-3) sh = Math.max(-maxMitre * r, Math.min(maxMitre * r, -(dx * mx + dy * my + dz * mz) / den));
        }
        const o = (ri * rad + j) * 3;
        this.pos[o] = x + dx + tx * sh; this.pos[o + 1] = y + dy + ty * sh; this.pos[o + 2] = z + dz + tz * sh;
      }
    };
    const r0 = rf(0);
    for (let i = 0; i < caps; i++) { // start cap, or collapsed onto the mitre
      const a = (1 - i / caps) * Math.PI / 2, rr = mitreStart ? r0 : Math.cos(a) * r0, b = mitreStart ? 0 : Math.sin(a) * r0;
      ring(i, c[0] - tx * b, c[1] - ty * b, c[2] - tz * b, rr, tx, ty, tz, ux, uy, uz, ...(mitreStart || [null]));
    }
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), a = Math.max(0, i - 1) * 3, b = Math.min(n - 1, i + 1) * 3;
      let nx = c[b] - c[a], ny = c[b + 1] - c[a + 1], nz = c[b + 2] - c[a + 2]; l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      dot = ux * nx + uy * ny + uz * nz; ux -= dot * nx; uy -= dot * ny; uz -= dot * nz; l = Math.hypot(ux, uy, uz) || 1; ux /= l; uy /= l; uz /= l;
      tx = nx; ty = ny; tz = nz;
      const m = i === 0 ? mitreStart : i === n - 1 ? mitreEnd : null;
      ring(caps + i, c[i * 3], c[i * 3 + 1], c[i * 3 + 2], rf(u), tx, ty, tz, ux, uy, uz, ...(m || [null]));
    }
    const e = (n - 1) * 3, r1 = rf(1);
    for (let i = 0; i < caps; i++) {
      const a = (i + 1) / caps * Math.PI / 2, rr = mitreEnd ? r1 : Math.cos(a) * r1, b = mitreEnd ? 0 : Math.sin(a) * r1;
      ring(caps + n + i, c[e] + tx * b, c[e + 1] + ty * b, c[e + 2] + tz * b, rr, tx, ty, tz, ux, uy, uz, ...(mitreEnd || [null]));
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}

// Ball hand: flat ink, and a pale crescent highlight fixed on screen near the middle of the ball (it shows up to f56, gone by f66).
const BALL_F = `
uniform vec3 uColor, uSpec; uniform float uOn, uSize, uN;
uniform vec4 uG[3]; uniform float uA[3];
varying vec3 vN;
void main() {
  vec3 n = normalize(vN);
  float s = 0.;
  if (uN > .5) {
    // keyed glints (track keys[f].glints): ellipses on the ball, in ball radii, x right, y up: cx, cy, rx, ry, angle in degrees
    for (int i = 0; i < 3; i++) {
      if (float(i) >= uN) break;
      vec2 q = n.xy - uG[i].xy;
      float ca = cos(uA[i]), sa = sin(uA[i]);
      q = vec2(ca * q.x + sa * q.y, -sa * q.x + ca * q.y) / uG[i].zw;
      s = max(s, 1. - smoothstep(.8, 1.15, length(q)));
    }
    s *= uOn;
  } else {
    // a banana on the ball, measured at f40 and f19: 14 x 6 px on a 22 px radius, a little left of centre, pointed to the left
    vec2 p = n.xy - vec2(-.20, .03);
    float ca = .98, sa = .17;
    p = vec2(ca * p.x + sa * p.y, -sa * p.x + ca * p.y) / uSize;
    float a = 1. - smoothstep(.85, 1.1, length(p / vec2(.33, .17)));
    float b = smoothstep(.85, 1.1, length((p - vec2(-.03, -.13)) / vec2(.34, .16)));
    s = a * b * uOn;
  }
  gl_FragColor = vec4(mix(uColor, uSpec, s), 1.0);
  #include <colorspace_fragment>
}`;
const BALL_V = `
uniform float uFront;
varying vec3 vN;
void main() {
  vN = normalMatrix * normal;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec4 clip = projectionMatrix * mv;
  if (uFront != 0.0) { vec4 c2 = projectionMatrix * vec4(mv.xy, mv.z + uFront, 1.0); clip.z = c2.z / c2.w * clip.w; }
  gl_Position = clip;
}`;

function lerpArr(a, b, t) { return a.map((v, i) => Array.isArray(v) ? lerpArr(v, b[i], t) : v + (b[i] - v) * t); }

export function poseAt(frame, track = TRACK) {
  const fs = Object.keys(track.keys).map(Number).sort((a, b) => a - b);
  let i = fs.findIndex(f => f >= frame);
  if (i < 0) i = fs.length - 1;
  const hi = fs[i], lo = fs[Math.max(0, i - (fs[i] === frame ? 0 : 1))];
  const A = track.keys[lo], B = track.keys[hi];
  if (lo === hi || frame <= lo) return A;
  // measured by tools/limb_greyleg.py: the far leg snaps between a grey folded pose and an ink X pose, it does not fade
  const grey = (track.farLegGreyRuns || []).some(r => frame >= r[0] && frame <= r[1]);
  const t = (frame - lo) / (hi - lo), out = { visible: {}, hands: {}, spec: t < .5 ? A.spec : B.spec, farLegGrey: grey };
  for (const k of ['nearArm', 'farArm', 'nearLeg', 'farLeg', 'nearFoot', 'farFoot']) {
    out.visible[k] = t < .5 ? A.visible[k] : B.visible[k];
    if (A[k] && B[k] && A[k].length === B[k].length) out[k] = lerpArr(A[k], B[k], t); else out[k] = A[k] || B[k];
  }
  for (const h of ['near', 'far']) out.hands[h] = A.hands[h] && B.hands[h] ? lerpArr(A.hands[h], B.hands[h], t) : (A.hands[h] || B.hands[h]);
  // the ink where arm, hand and thigh close up, the near hand's size and its glints
  if (A.mass && B.mass) out.mass = { p: lerpArr(A.mass.p, B.mass.p, t), r: A.mass.r + (B.mass.r - A.mass.r) * t };
  else out.mass = t < .5 ? A.mass : B.mass;
  const ra = A.handR ?? track.handR, rb = B.handR ?? track.handR;
  out.handR = ra + (rb - ra) * t;
  out.glints = t < .5 ? A.glints : B.glints;
  return out;
}

export async function build(params = {}) {
  const track = params.track || params.tracks ? await loadTrackFrom(params, 'limbs') : await loadTrack();
  const root = new THREE.Group();
  const W = (params.width ?? track.width) / 2;
  const front = Object.assign({ nearArm: 0, farArm: 0, nearLeg: 0, farLeg: 0 }, params.front);
  const mats = {}, tubes = {};
  for (const k of ['nearArm', 'farArm', 'nearLeg', 'farLeg', 'nearFoot', 'farFoot']) {
    const base = k.replace('Foot', 'Leg');
    mats[k] = flatMat(ink, front[base] ?? 0, k === 'nearArm' ? (params.frontRamp ?? .15) : 0);
    tubes[k] = new Tube({ rings: k.endsWith('Foot') ? 12 : 72, material: mats[k] });
    tubes[k].mesh.name = k;
    root.add(tubes[k].mesh);
  }
  const R = params.handR ?? track.handR;
  const ballGeo = new THREE.SphereGeometry(R, 32, 24);
  const hands = {};
  for (const h of ['near', 'far']) {
    const m = new THREE.ShaderMaterial({ vertexShader: BALL_V, fragmentShader: BALL_F, uniforms: {
      uColor: { value: new THREE.Color(ink) }, uSpec: { value: new THREE.Color(track.colours.spec) }, uOn: { value: 1 }, uSize: { value: h === 'near' ? 1 : .7 }, uFront: { value: front[h + 'Arm'] ?? 0 },
      uN: { value: 0 }, uG: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] }, uA: { value: [0, 0, 0] } } });
    hands[h] = new THREE.Mesh(ballGeo, m); hands[h].name = h + 'Hand'; root.add(hands[h]);
  }
  const massTube = new Tube({ rings: 24, material: flatMat(ink, front.nearArm ?? 0, 0) });
  massTube.mesh.name = 'nearMass'; root.add(massTube.mesh);
  root.userData = { tubes, hands, mats, track, W, massTube, handR: R };
  if (params.saw !== false) {
    const saw = await import('./saw.js');
    root.userData.saw = await saw.build({ ...(params.sawParams || {}), track });
    root.add(root.userData.saw);
    root.userData.sawMod = saw;
  }
  if (params.probeHead) { // draw-order test only: a stand-in head
    const head = new THREE.Mesh(new THREE.SphereGeometry(.5, 48, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    root.add(head);
  }
  if (params.withTorso) { // draw-order test only: the real torso, so the near arm's depth against the vest is checked for real
    const t = await import('./torso.js');
    root.userData.torso = await t.build({});
    root.userData.torsoMod = t;
    root.add(root.userData.torso);
  }
  return root;
}

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
// Mitre plane at a sharp corner between two limb directions (both pointing away from the corner).
function mitre(c, a, b) {
  v1.set(a[0] - c[0], a[1] - c[1], a[2] - c[2]).normalize();
  v2.set(b[0] - c[0], b[1] - c[1], b[2] - c[2]).normalize();
  v3.copy(v1).sub(v2);
  if (v3.lengthSq() < 1e-6) return null;
  v3.normalize();
  return [v3.x, v3.y, v3.z];
}

export function setPose(root, pose) {
  const { tubes, hands, mats, track, W } = root.userData;
  for (const k of ['nearArm', 'farArm']) {
    tubes[k].mesh.visible = !!pose.visible[k] && !!pose[k];
    if (tubes[k].mesh.visible) tubes[k].setSpline(pose[k], W);
  }
  for (const side of ['near', 'far']) {
    const leg = pose[side + 'Leg'], foot = pose[side + 'Foot'];
    const on = !!pose.visible[side + 'Leg'] && !!leg;
    tubes[side + 'Leg'].mesh.visible = on; tubes[side + 'Foot'].mesh.visible = on && !!foot;
    if (!on) continue;
    // the ankle: shin and tab meet at one point, with a sharp mitred heel
    const ankle = foot ? foot[0] : leg[leg.length - 1];
    const L = leg.slice(); if (foot) L[L.length - 1] = ankle;
    let m = null;
    if (foot) m = mitre(ankle, L[L.length - 2], foot[1]);
    tubes[side + 'Leg'].setSpline(L, W, { mitreEnd: m });
    if (foot) tubes[side + 'Foot'].setSpline(foot, u => W * (1 - .45 * u), { mitreStart: m });
    const grey = side === 'far' && pose.farLegGrey;
    const col = grey ? track.colours.farLegKneel : track.colours.ink;
    mats[side + 'Leg'].uniforms.uColor.value.set(col); mats[side + 'Foot'].uniforms.uColor.value.set(col);
  }
  for (const h of ['near', 'far']) {
    const p = pose.hands && pose.hands[h];
    hands[h].visible = !!p;
    if (p) { hands[h].position.set(p[0], p[1], p[2]); hands[h].material.uniforms.uOn.value = pose.spec ?? 0; }
  }
  const { massTube, handR } = root.userData;
  massTube.mesh.visible = !!pose.mass;
  if (pose.mass) massTube.setSpline(pose.mass.p, pose.mass.r);
  hands.near.scale.setScalar((pose.handR ?? handR) / track.handR);
  const u = hands.near.material.uniforms, G = pose.glints || [];
  u.uN.value = Math.min(G.length, 3);
  G.slice(0, 3).forEach((g, i) => { u.uG.value[i].set(g[0], g[1], g[2], g[3]); u.uA.value[i] = (g[4] || 0) * Math.PI / 180; });
}

export function update(frame, ctx) {
  const root = ctx.root;
  setPose(root, poseAt(frame, root.userData.track));
  if (root.userData.sawMod) root.userData.sawMod.setPose(root.userData.saw, root.userData.sawMod.poseAt(frame, root.userData.track));
  if (root.userData.torsoMod) root.userData.torsoMod.update(frame, { ...ctx, root: root.userData.torso });
}
