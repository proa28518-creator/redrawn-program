// hats/_kit.js: shared parts for the word-built hats (agent W2, 2026-11-04): ballcap flatcap beanie headscarf strawhat chef.
// Not a hat kind itself. His hat look (STYLE_BIBLE 4): puffy rounded crowns, ink outline at body weight, flat two-tone paint (lit on the
// viewer's left, ONE hard upright terminator held in VIEW space: W3, was a soft ramp that read 3D-lit), one thin pale arc on the lit upper
// side, a band; brims/visors two-tone by screen side (crisp) with a darker underside (chosen by camera above/below the brim plane).
// Pose (W3): rigid on the head at `mount` + the pose hat channels (follow 1, default); follow 0 = bowler.js's 2.5D layer path (his gains).
// Pivot space: y = 0 is the mount plane (the band's foot), y up, +Z the hat's front, D = 1.
import * as THREE from '../three.js';
import { outline } from '../shade.js';
import { hatRecord, RULES } from '../rules.js';

export const hex = c => new THREE.Color(c);
const VERT = `varying vec3 vN; varying vec3 vP; varying vec3 vD;
void main() { vN = normalize(normalMatrix * normal); vP = position; vD = normalize(position - vec3(0., .12, 0.)); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
// crown: two-tone + arc + band + optional pattern (vertical ribs / pleats, horizontal straw lines, dots)
const CROWN_FRAG = `varying vec3 vN; varying vec3 vP; varying vec3 vD;
uniform vec3 uLit, uDark, uArc, uBand, uBandDark, uPat;
uniform float uTerm, uSoft, uArcOn, uB0, uB1, uRibs, uRibOn, uLines, uLineOn, uDots, uDotOn;
uniform vec2 uArcR, uArcA;
void main() {
  vec3 n = normalize(vN);
  // W3: ONE hard painted shade edge (his hats are flat fills): the terminator is antialiased over a pixel, never a soft ramp
  float tw = max(fwidth(n.x), uSoft);
  float sh = smoothstep(uTerm - tw, uTerm + tw, n.x);
  vec3 col = mix(uLit, uDark, sh);
  float r = length(n.xy), a = degrees(atan(n.y, n.x)), rw = max(fwidth(r), .004);
  float arc = smoothstep(uArcR.x - rw, uArcR.x + rw, r) * (1. - smoothstep(uArcR.y - rw, uArcR.y + rw, r)) * smoothstep(uArcA.x, uArcA.x + 6., a) * (1. - smoothstep(uArcA.y - 6., uArcA.y, a)) * (1. - sh);
  float th = atan(vP.x, vP.z);
  // seams / ribs / straw lines: thin crisp painted lines, not soft shaded grooves
  if (uRibs > 0.) { float q = fract(th / 6.2832 * uRibs), k = abs(q - .5), kw = max(fwidth(q), .004); col = mix(col, col * uPat, uRibOn * (1. - smoothstep(.03, .03 + kw * 1.5, k))); }
  if (uLines > 0.) { float q = fract(vP.y * uLines), k = abs(q - .5), kw = max(fwidth(q), .01); col = mix(col, col * uPat, uLineOn * (1. - smoothstep(.06, .06 + kw * 1.5, k))); }
  if (uDots > 0.) { vec2 q = vec2(th * 1.4, vD.y * 3.2) * uDots; vec2 c = q + vec2(.5 * mod(floor(q.y), 2.), 0.); float d = length(fract(c) - .5); col = mix(col, uPat, uDotOn * (1. - smoothstep(.16, .2, d))); }
  col = mix(col, uArc, uArcOn * arc);
  if (vP.y >= uB0 && vP.y <= uB1) col = mix(uBand, uBandDark, sh);
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;
// W3: the brim's top / underside from where the camera is (above or below the brim plane, the hat's up axis), not from the triangle
// winding (the sheet's top faced away, so every brim drew its underside colour); the screen-side split is one crisp edge
const BRIM_VERT = `varying vec3 vN; varying float vSide; varying float vTop;
void main() { vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vec4 o = modelViewMatrix * vec4(0., 0., 0., 1.);
  vSide = mv.x - o.x; vec3 up = normalize((modelViewMatrix * vec4(0., 1., 0., 0.)).xyz); vTop = dot(up, -mv.xyz); gl_Position = projectionMatrix * mv; }`;
const BRIM_FRAG = `varying vec3 vN; varying float vSide; varying float vTop;
uniform vec3 uLit, uDark, uUnder; uniform float uLines, uLineOn;
void main() {
  float sw = max(fwidth(vSide), .002);
  vec3 col = mix(uLit, uDark, smoothstep(.04 - sw, .04 + sw, vSide));
  if (vTop < 0.) col = mix(uUnder, uDark, .35);
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;

export function crownMat(P, o = {}) {
  const u = {
    uLit: { value: hex(o.lit ?? P.crownLit) }, uDark: { value: hex(o.dark ?? P.crownDark) }, uArc: { value: hex(o.arc ?? P.arc) },
    uBand: { value: hex(o.band ?? P.band ?? P.crownLit) }, uBandDark: { value: hex(o.bandDark ?? P.bandDark ?? P.band ?? P.crownDark) }, uPat: { value: hex(o.pat ?? P.pat ?? '#ffffff') },
    uTerm: { value: o.term ?? P.term ?? .08 }, uSoft: { value: o.termSoft ?? P.termSoft ?? .006 }, uArcOn: { value: o.arcOn ?? P.arcOn ?? .85 },
    uB0: { value: o.b0 ?? P.bandY?.[0] ?? -9 }, uB1: { value: o.b1 ?? P.bandY?.[1] ?? -9 },
    uRibs: { value: o.ribs ?? 0 }, uRibOn: { value: o.ribOn ?? .5 }, uLines: { value: o.lines ?? 0 }, uLineOn: { value: o.lineOn ?? .25 },
    uDots: { value: o.dots ?? 0 }, uDotOn: { value: o.dotOn ?? .9 },
    uArcR: { value: new THREE.Vector2(...(o.arcR ?? P.arcR ?? [.80, .90])) }, uArcA: { value: new THREE.Vector2(...(o.arcAng ?? P.arcAng ?? [100, 165])) },
  };
  return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: CROWN_FRAG, uniforms: u });
}
export function brimMat(P, o = {}) {
  return new THREE.ShaderMaterial({ vertexShader: BRIM_VERT, fragmentShader: BRIM_FRAG, side: THREE.DoubleSide,
    uniforms: { uLit: { value: hex(o.lit ?? P.brimLit) }, uDark: { value: hex(o.dark ?? P.brimDark) }, uUnder: { value: hex(o.under ?? P.brimUnder ?? P.brimDark) }, uLines: { value: 0 }, uLineOn: { value: 0 } } });
}

// a lathe from [[r, y], ...] (foot first, top last at r 0)
export function lathe(pts, seg = 160) {
  const v = pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)); v[v.length - 1].x = 0;
  return new THREE.LatheGeometry(v, seg);
}
// a puffy dome profile: foot radius R at y 0, height Hh, bulge = extra radius at about 1/3 height, flat = flatness of the top (0 point .. 1 flat)
export function domeProfile(R, Hh, { bulge = .04, flat = .55, n = 40, y0 = 0 } = {}) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * Math.PI / 2;
    const r = R * Math.pow(Math.cos(a), flat) + bulge * Math.sin(Math.PI * Math.min(1, t * 1.5)) * (1 - t);
    pts.push([r, y0 + Hh * Math.pow(Math.sin(a), .8)]);
  }
  return pts;
}
// a thin sheet with thickness: f(u, v) -> [x, y, z] for u, v in [0, 1]; top surface, bottom surface t below (along -y), walls on all edges
export function sheet(f, t, nu = 24, nv = 96, closedV = false) {
  const pos = [], idx = [], NV = closedV ? nv : nv + 1;
  for (const face of [0, 1]) for (let i = 0; i <= nu; i++) for (let j = 0; j < NV; j++) {
    const p = f(i / nu, j / nv); pos.push(p[0], p[1] - (face ? t : 0), p[2]);
  }
  const at = (face, i, j) => face * (nu + 1) * NV + i * NV + (closedV ? j % nv : j);
  const quad = (a, b, c, d, flip) => flip ? idx.push(a, c, b, b, c, d) : idx.push(a, b, c, b, d, c);
  const J = closedV ? nv : nv;
  for (let i = 0; i < nu; i++) for (let j = 0; j < J; j++) {
    quad(at(0, i, j), at(0, i, j + 1), at(0, i + 1, j), at(0, i + 1, j + 1), false);
    quad(at(1, i, j), at(1, i, j + 1), at(1, i + 1, j), at(1, i + 1, j + 1), true);
  }
  for (let j = 0; j < J; j++) { for (const i of [0, nu]) quad(at(0, i, j), at(0, i, j + 1), at(1, i, j), at(1, i, j + 1), i === 0); }
  if (!closedV) for (let i = 0; i < nu; i++) for (const j of [0, nv]) quad(at(0, i, j), at(0, i + 1, j), at(1, i, j), at(1, i + 1, j), j !== 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
export function inked(geo, mat, name, P, w) {
  const m = new THREE.Mesh(geo, mat); m.name = name;
  outline(m, { width: w ?? P.inkW ?? .026, color: P.ink ?? '#3a2a33', zBias: 1.5 });
  return m;
}

// ---- pose: bowler.js's mount / track.pose (character.js hatRecord) / lift, unchanged
const DEG = Math.PI / 180, eul = new THREE.Euler();
export function applyMount(pivot, M) {
  pivot.position.set(M.x || 0, M.y ?? .2, M.z || 0);
  pivot.quaternion.setFromEuler(eul.set(M.rx || 0, M.ry || 0, M.rz || 0, 'ZXY'));
  pivot.scale.setScalar(M.scale ?? 1);
}
// root + pivot (+ inner `body` group: everything a hat builds goes there; tilt/backwards live on it, so the mount stays the head's)
export function makeRoot(name, P) {
  const root = new THREE.Group(); root.name = 'hat.' + name;
  const pivot = new THREE.Group(); applyMount(pivot, P.mount); root.add(pivot);
  const body = new THREE.Group(); body.name = name + '.body'; pivot.add(body);
  body.rotation.set((P.tilt || 0) * DEG, (P.backwards ? Math.PI : 0) + (P.turn || 0) * DEG, (P.cant || 0) * DEG, 'YXZ');
  // track WITHOUT shape: character.js reads the mount height from params.mount.y then (a spec's cap shape is another hat's)
  root.userData = { pivot, body, track: { pose: {} }, params: P };
  return { root, pivot, body };
}
const _dir = new THREE.Vector3(), _ray = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _near = new THREE.Vector3(), _m = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _qq = new THREE.Quaternion(), _o = new THREE.Vector3(), _ref = new THREE.Vector3(), _axis = new THREE.Vector3(0, 0, -1), _wp = new THREE.Vector3(), _wq = new THREE.Quaternion(), _ws = new THREE.Vector3();
function poseHat(pivot, root, P, ctx, yRef) {
  const { cam, camera, focal: F, width: W, height: H } = ctx;
  const x = cam.cx + P.u * cam.d, y = cam.cy + P.v * cam.d, ds = P.s * cam.d;
  _dir.set(Math.sin(P.az * DEG) * Math.cos(P.el * DEG), Math.sin(P.el * DEG), Math.cos(P.az * DEG) * Math.cos(P.el * DEG));
  _ray.set((x - W / 2) / F, -(y - H / 2) / F, -1).normalize();
  const D = Math.hypot(F / (ds * Math.pow(-_ray.z, 1.5)), .5);
  _near.set(0, 1, 0);
  _x.crossVectors(_near, _dir).normalize(); _y.crossVectors(_dir, _x);
  _x.applyAxisAngle(_dir, P.roll * DEG); _y.applyAxisAngle(_dir, P.roll * DEG);
  _m.makeBasis(_x, _y, _dir);
  _q.setFromRotationMatrix(_m).multiply(_qq.setFromUnitVectors(_ray, _axis));
  _qi.copy(_q).invert();
  _o.copy(_dir).multiplyScalar(-D).applyQuaternion(_qi);
  camera.updateMatrixWorld();
  _ref.set(0, yRef, 0); root.parent?.localToWorld?.(_ref); camera.worldToLocal(_ref);
  const k = _ref.z / _o.z;
  _wq.copy(camera.quaternion).multiply(_qi);
  _wp.copy(_o).multiplyScalar(k).applyQuaternion(camera.quaternion).add(camera.position);
  root.updateWorldMatrix(true, false);
  root.getWorldScale(_ws);
  pivot.position.copy(root.worldToLocal(_wp));
  pivot.quaternion.copy(root.getWorldQuaternion(_qq).invert().multiply(_wq));
  pivot.scale.setScalar(k / _ws.x * (P.scale ?? 1));
}
export function update(frame, ctx) {
  const root = ctx.root, { pivot, track: T, params: P } = root.userData;
  applyMount(pivot, P.mount);
  const f = String(Math.round(frame));
  const L = T.lift?.[f], pose = T.pose?.[f];
  if (L) {
    pivot.position.set(P.mount.x + (L.x || 0), P.mount.y + (L.y || 0), P.mount.z + (L.z || 0));
    pivot.quaternion.setFromEuler(eul.set(L.rx || 0, L.ry || 0, L.rz || 0, 'ZXY'));
  } else if (pose && ctx.cam && ctx.camera) {
    if ((P.follow ?? 1) && ctx.cam.az !== undefined) rigid(pivot, root, pose, ctx, P);
    else poseHat(pivot, root, { ...pose, scale: P.mount.scale ?? 1 }, ctx, P.mount.y);
  }
}
// W3 (hat_stays_on FAIL ~.05-.08 D, FABLE_REVIEW 12 "the cap slides down one side like a hood"): the 2.5D layer path above (poseHat)
// turns the hat by rules.js hatRecord, i.e. the fitted gains of HIS bowler/cap layer (az x .77/.93, el x .58, roll x 1.17) and re-places
// it on screen every frame from u v s. On a near-symmetric bowler that is invisible; a hat with a long one-sided part (Pip's backwards
// bill, a peak, a brim) swings and resizes against the head (under el -10 it tipped ~4 deg off the head, the centre moved .05-.08 D).
// follow = 1 (default for the word-built hats): the hat is RIGID on the head at its mount, like the hair painted under it, and only the
// pose hat channels character.js folded into the record ride on top (recovered as the record minus the plain rule):
// lift -> u v delta (D on the head's screen axes), tilt -> roll delta (about the view axis), spin -> az delta (about the head's up).
// follow = 0: the old layer path (his gains), for a hat that should behave like the bowler.
const _cr = new THREE.Vector3(), _cv = new THREE.Vector3(), _rq = new THREE.Quaternion(), _rq2 = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
function rigid(pivot, root, pose, ctx, P) {
  const V = ctx.cam, L = P.mount.y * .99, base = hatRecord(V, RULES.hat, L);
  const du = (pose.u ?? base.u) - base.u, dv = (pose.v ?? base.v) - base.v, r = (V.roll || 0) * DEG;
  const lx = du * Math.cos(r) + dv * Math.sin(r), ly = du * Math.sin(r) - dv * Math.cos(r);
  const droll = (pose.roll ?? base.roll) - base.roll, daz = (pose.az ?? base.az) - base.az;
  applyMount(pivot, P.mount);
  if (!lx && !ly && !droll && !daz) return;
  // camera right and view axis in the hat root's frame (= head space)
  root.updateWorldMatrix(true, false);
  root.getWorldQuaternion(_rq).invert();
  _cr.set(1, 0, 0).applyQuaternion(ctx.camera.quaternion).applyQuaternion(_rq).normalize();
  _cv.set(0, 0, 1).applyQuaternion(ctx.camera.quaternion).applyQuaternion(_rq).normalize();
  const cu = _cv.clone().cross(_cr).normalize(); // camera up in head space
  pivot.position.addScaledVector(_cr, lx).addScaledVector(cu, ly);
  if (daz) pivot.quaternion.premultiply(_rq2.setFromAxisAngle(_up, daz * DEG));
  if (droll) pivot.quaternion.premultiply(_rq2.setFromAxisAngle(_cv, -droll * DEG));
}
// merge spec params over defaults (mount merged key by key); ignores the track / lookFrame keys character.js passes
export function params(DEF, p = {}) {
  const { tracks, track, lookFrame, kind, ...own } = p;
  return { ...DEF, ...own, mount: { ...DEF.mount, ...(own.mount || {}) } };
}
// lit/dark/arc from ONE colour (crown: c), as hair.js does: lit = c, dark = L -38 %, arc = L +55 % toward white
export function tones(c, { dark = .62, arc = .55 } = {}) {
  const base = hex(c), hsl = {}; base.getHSL(hsl, THREE.SRGBColorSpace);
  const at = (l, s = 1) => '#' + new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * s), Math.max(0, Math.min(1, l)), THREE.SRGBColorSpace).getHexString();
  return { lit: '#' + base.getHexString(), dark: at(hsl.l * dark, 1.05), arc: at(hsl.l + (1 - hsl.l) * arc, .7), band: at(hsl.l * .45, 1.1) };
}
