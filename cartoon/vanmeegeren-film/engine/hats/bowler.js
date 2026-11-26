// hats/bowler.js: the bowler of the Boss (black), the Townsperson (grey) and Worker 3 (brown): one module, colours and shape in params.
// Measured on the Boss, f430 f466 f494 f512 f1395 f1430 (tools/boss_*.py, 2026-11-03): brim 1.11-1.15 D wide, crown .82-.85 D at its foot,
// crown .42-.45 D above the brim, the brim plane ~.33 D above the head centre (covers the head's top ~.2 D). Rigid with the head
// (STYLE_BIBLE 4): it sits on the mount and turns with the camera; a cap.json `pose` frame (az el roll u v s, as cap.js) makes it its own
// 2.5D layer on that frame instead, `lift` frames move it against the head (rx ry rz rad, x y z D).
// Look (Boss): crown lit #776c7a on the viewer's left to #28212f dark on the right, a soft upright terminator in VIEW space (it stays
// upright on screen whatever the head does), a thin pale arc along the upper left of the crown, a thin dark band, a dark brim with a
// pale top edge, ink outline all round.
// params (spec "hat", every key optional): see DEF. Track: <tracks>/cap.json { shape: {..same keys..}, pose: {}, lift: {} } (optional).
import * as THREE from '../three.js';
import { loadTrack } from '../tracks.js';
import { outline } from '../shade.js';

export const DEF = {
  // shape, D (head diameter 1), y up from the brim plane
  brimR: .565, brimT: .022, curl: .045, curlStart: .80, // brim radius, thickness, side curl height at the tips (rises toward +-X), from r/brimR
  crownR: .41, crownH: .43, crownBulge: .035, crownTop: .62, // foot radius, height, extra radius at mid height, flatness of the top (0 point .. 1 flat)
  bandH: .045,
  mount: { x: 0, y: .33, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 }, // on the head; rx + tips the front down, rz + rolls toward -X
  // colours (Boss)
  crownLit: '#776c7a', crownDark: '#28212f', term: .05, termSoft: .30, // terminator: view-normal x where lit meets dark, its softness
  arc: '#d9d2dc', arcOn: .85, arcR: [.80, .90], arcAng: [100, 165],     // pale arc: view-normal radius band and screen angle band (deg, ccw from right)
  stripe: '#4a4250', stripeOn: .55, stripeX: [.22, .42],                // the soft lighter upright band right of the terminator (his reflection)
  band: '#1e1823',
  brimLit: '#3d3543', brimDark: '#1f1925', brimEdge: '#8d8494', brimEdgeOn: .7,
  ink: '#3a2a33', inkW: .026, inkBrim: .022,
};

const hex = c => new THREE.Color(c);
const VERT = `varying vec3 vN; varying vec3 vP;
void main() { vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const CROWN_FRAG = `varying vec3 vN; varying vec3 vP;
uniform vec3 uLit, uDark, uArc, uStripe, uBand; uniform float uTerm, uSoft, uArcOn, uStripeOn, uBandH; uniform vec2 uArcR, uArcA, uStripeX;
void main() {
  vec3 n = normalize(vN);
  vec3 col = mix(uLit, uDark, smoothstep(uTerm - uSoft, uTerm + uSoft, n.x));
  col = mix(col, uStripe, uStripeOn * smoothstep(uStripeX.x - .06, uStripeX.x + .04, n.x) * (1. - smoothstep(uStripeX.y - .04, uStripeX.y + .06, n.x)) * smoothstep(-.1, .3, n.y));
  float r = length(n.xy), a = degrees(atan(n.y, n.x));
  float arc = smoothstep(uArcR.x - .02, uArcR.x + .01, r) * (1. - smoothstep(uArcR.y - .01, uArcR.y + .02, r)) * smoothstep(uArcA.x, uArcA.x + 12., a) * (1. - smoothstep(uArcA.y - 12., uArcA.y, a));
  col = mix(col, uArc, uArcOn * arc);
  col = mix(col, uBand, step(vP.y, uBandH));
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;
const BRIM_VERT = `varying vec3 vN; varying vec3 vP; varying float vSide;
void main() { vN = normalize(normalMatrix * normal); vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.); vSide = mv.x - (modelViewMatrix * vec4(0., 0., 0., 1.)).x; gl_Position = projectionMatrix * mv; }`;
const BRIM_FRAG = `varying vec3 vN; varying vec3 vP; varying float vSide;
uniform vec3 uLit, uDark, uEdge; uniform float uEdgeOn, uR;
void main() {
  vec3 n = normalize(vN);
  float side = smoothstep(-.35, .35, vSide);
  vec3 col = mix(uLit, uDark, side);
  float rr = length(vP.xz) / uR;
  col = mix(col, uEdge, uEdgeOn * smoothstep(.90, .955, rr) * step(0., n.y) * (1. - side * .7));
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;

function crownGeometry(P) {
  const pts = [], N = 48;
  for (let i = 0; i <= N; i++) {
    const t = i / N; // 0 foot .. 1 top centre
    const a = t * Math.PI / 2;
    // superellipse-ish dome: radius falls as cos, height rises as sin, flattened toward the top by crownTop
    const r = P.crownR * Math.pow(Math.cos(a), P.crownTop) + P.crownBulge * Math.sin(Math.PI * Math.min(1, t * 1.4)) * (1 - t);
    const y = P.crownH * Math.pow(Math.sin(a), .85);
    pts.push(new THREE.Vector2(Math.max(r, 1e-4), y));
  }
  pts[pts.length - 1].x = 0;
  return new THREE.LatheGeometry(pts, 192);
}

function brimGeometry(P) {
  // an annulus from inside the crown to brimR, top and bottom faces, the outer part rising toward the sides (+-X): the bowler's curl
  const nr = 24, na = 192, inner = P.crownR * .7, pos = [], idx = [];
  const lift = (x, r) => { const k = Math.max(0, (r / P.brimR - P.curlStart) / (1 - P.curlStart)); const s = x / Math.max(r, 1e-6); return P.curl * k * k * s * s; };
  for (const face of [0, 1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= nr; i++) {
      const r = inner + (P.brimR - inner) * i / nr;
      for (let j = 0; j < na; j++) {
        const a = j / na * Math.PI * 2, x = r * Math.cos(a), z = r * Math.sin(a);
        const y = lift(x, r) + (face ? 0 : -P.brimT) + (r > P.brimR * .97 ? -P.brimT * .5 * (1 - face) : 0);
        pos.push(x, y, z);
      }
    }
    for (let i = 0; i < nr; i++) for (let j = 0; j < na; j++) {
      const a = base + i * na + j, b = base + i * na + (j + 1) % na, c = a + na, d = b + na;
      if (face) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  }
  // the rim wall joining top and bottom
  const top = pos.length / 3 / 2 + nr * na - (nr * na + na) + na * nr; // index of the outer ring of the top face
  const outerTop = (nr + 1) * na + nr * na, outerBot = nr * na;
  for (let j = 0; j < na; j++) { const a = outerBot + j, b = outerBot + (j + 1) % na, c = outerTop + j, d = outerTop + (j + 1) % na; idx.push(a, c, b, b, c, d); }
  void top;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

const eul = new THREE.Euler();
function applyMount(pivot, M) {
  pivot.position.set(M.x || 0, M.y ?? .33, M.z || 0);
  pivot.quaternion.setFromEuler(eul.set(M.rx || 0, M.ry || 0, M.rz || 0, 'ZXY'));
  pivot.scale.setScalar(M.scale ?? 1);
}

export async function build(params = {}) {
  const { tracks, track: inline, lookFrame, kind, ...own } = params;
  const TRACK = (params.track || params.tracks?.length) ? await loadTrack(params, 'cap') : {};
  const P = { ...DEF, ...(TRACK.shape || {}), ...own };
  P.mount = { ...DEF.mount, ...(TRACK.shape?.mount || {}), ...(own.mount || {}) };
  const root = new THREE.Group(); root.name = 'hat.bowler';
  const pivot = new THREE.Group(); applyMount(pivot, P.mount); root.add(pivot);

  const crownU = {
    uLit: { value: hex(P.crownLit) }, uDark: { value: hex(P.crownDark) }, uArc: { value: hex(P.arc) }, uStripe: { value: hex(P.stripe) }, uBand: { value: hex(P.band) },
    uTerm: { value: P.term }, uSoft: { value: P.termSoft }, uArcOn: { value: P.arcOn }, uStripeOn: { value: P.stripeOn }, uBandH: { value: P.bandH },
    uArcR: { value: new THREE.Vector2(...P.arcR) }, uArcA: { value: new THREE.Vector2(...P.arcAng) }, uStripeX: { value: new THREE.Vector2(...P.stripeX) },
  };
  const crown = new THREE.Mesh(crownGeometry(P), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: CROWN_FRAG, uniforms: crownU }));
  crown.name = 'bowler.crown'; crown.position.y = -.005;
  outline(crown, { width: P.inkW, color: P.ink, zBias: 2 });
  pivot.add(crown);

  const brimU = { uLit: { value: hex(P.brimLit) }, uDark: { value: hex(P.brimDark) }, uEdge: { value: hex(P.brimEdge) }, uEdgeOn: { value: P.brimEdgeOn }, uR: { value: P.brimR } };
  const brim = new THREE.Mesh(brimGeometry(P), new THREE.ShaderMaterial({ vertexShader: BRIM_VERT, fragmentShader: BRIM_FRAG, uniforms: brimU, side: THREE.DoubleSide }));
  brim.name = 'bowler.brim';
  outline(brim, { width: P.inkBrim, color: P.ink, zBias: 1 });
  pivot.add(brim);

  root.userData = { pivot, track: TRACK, params: P, lookFrame };
  return root;
}

// 2.5D pose against the camera, as cap.js poseCap (same fields: az el roll deg, u v head diameters from the head centre, s against d)
const DEG = Math.PI / 180;
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
  pivot.scale.setScalar(k / _ws.x);
}

const nearest = (m, f) => { if (!m) return null; if (m[String(f)]) return m[String(f)]; return null; };
export function update(frame, ctx) {
  const root = ctx.root, { pivot, track: T, params: P } = root.userData;
  applyMount(pivot, P.mount);
  const f = Math.round(frame);
  const L = nearest(T.lift, f);
  let pose = nearest(T.pose, f);
  // follow: { el, from?, to? } = his rule when the cameras' el is an estimate: the hat takes the camera's az and roll, its own el,
  // and sits rigid on the rolled head axis (brim centre mount.y cos(el) up it). A `pose` frame overrides it.
  const F = T.follow;
  if (!pose && F && ctx.cam && (F.from === undefined || f >= F.from) && (F.to === undefined || f <= F.to)) {
    const r = (ctx.cam.roll || 0) * DEG, L = P.mount.y * Math.cos(F.el * DEG);
    pose = { az: ctx.cam.az || 0, el: F.el, roll: ctx.cam.roll || 0, u: L * Math.sin(r), v: -L * Math.cos(r), s: 1 };
  }
  if (L) {
    pivot.position.set(P.mount.x + (L.x || 0), P.mount.y + (L.y || 0), P.mount.z + (L.z || 0));
    pivot.quaternion.setFromEuler(eul.set(L.rx || 0, L.ry || 0, L.rz || 0, 'ZXY'));
  } else if (pose && ctx.cam && ctx.camera) poseHat(pivot, root, pose, ctx, P.mount.y);
  // per-frame mount tweaks (rx rz y) without leaving the head: cap.json tilt { "<frame>": { rx, rz, y } }
  const t = nearest(T.tilt, f);
  if (t && !L && !pose) { pivot.position.y = t.y ?? P.mount.y; pivot.quaternion.setFromEuler(eul.set(t.rx ?? P.mount.rx, P.mount.ry || 0, t.rz ?? P.mount.rz, 'ZXY')); }
}

export default { build, update };
