// hats/tophat.js: the top hat of the Rival Tycoon (black, gold band, gold brim trim) and the Passenger (same hat; band / trim switchable,
// colours in params). Built from bowler.js (same mount / pose / follow / lift / tilt track fields, so a cap.json written for the bowler works).
// Measured on the Tycoon (STYLE_BIBLE 4 + tools/tycoon_*.py on f343 f760 f768 f1605 f1610 f1615): brim 1.13 D wide, crown .80 D at the band,
// straight sides flaring a little to the top, crown .60 D above the brim, gold band about .07 D just over the brim, brim rolled up at the
// sides (both tips rise), a gold edge all round the brim, a thin pale line along the top rim, the brim plane about .30 D over the head centre.
// Look: crown near-black with a soft lighter upright band left of centre in VIEW space (his reflection), the flat top a little lighter grey,
// the band gold #d3ac3a lit to a darker gold on the right, ink outline all round.
// params (spec "hat", every key optional): see DEF. Track: <tracks>/cap.json { shape: {..same keys..}, follow, pose, lift, tilt } (optional).
import * as THREE from '../three.js';
import { loadTrack } from '../tracks.js';
import { outline } from '../shade.js';

export const DEF = {
  brimR: .565, brimT: .026, curl: .085, curlStart: .62, // brim radius, thickness, side roll height at the tips (rises toward +-X), from r/brimR
  frontDip: .0,                                          // the brim's front/back dropping a little (D) where the sides roll up
  crownR: .40, crownRTop: .415, crownH: .60, topRound: .025, // radius at the band, at the top, height above the brim, rounding of the top edge
  bandOn: 1, bandH: .075, bandLift: .004,
  trimOn: 1, trimW: .05,                               // gold edge of the brim: the outer fraction of the brim radius
  mount: { x: 0, y: .30, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 },
  // colours (Tycoon)
  crownLit: '#3d3742', crownDark: '#1d1922', term: -.05, termSoft: .45,
  stripe: '#5a5462', stripeOn: .65, stripeX: [-.62, -.30],  // the lighter upright reflection band on the viewer's left
  top: '#423b48', topEdge: '#9a93a0', topEdgeOn: .8, topEdgeW: .03,
  band: '#d3ac3a', bandDark: '#8f6d1c', bandHi: '#f0d77a',
  brimLit: '#2c2632', brimDark: '#18141c', trim: '#d9b440', trimDark: '#9a7420',
  ink: '#3a2a33', inkW: .024, inkBrim: .020,
};

const hex = c => new THREE.Color(c);
const VERT = `varying vec3 vN; varying vec3 vP;
void main() { vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const CROWN_FRAG = `varying vec3 vN; varying vec3 vP;
uniform vec3 uLit, uDark, uStripe, uTop, uTopEdge, uBand, uBandDark, uBandHi; uniform float uTerm, uSoft, uStripeOn, uBandH, uBandOn, uH, uTopEdgeOn, uTopEdgeW, uRTop;
uniform vec2 uStripeX;
void main() {
  vec3 n = normalize(vN);
  vec3 col = mix(uLit, uDark, smoothstep(uTerm - uSoft, uTerm + uSoft, n.x));
  col = mix(col, uStripe, uStripeOn * smoothstep(uStripeX.x - .08, uStripeX.x + .04, n.x) * (1. - smoothstep(uStripeX.y - .04, uStripeX.y + .08, n.x)));
  // flat top (object-space height), a thin pale line along its rim
  float topness = smoothstep(uH - .02, uH - .004, vP.y);
  col = mix(col, uTop, topness);
  float rr = length(vP.xz);
  col = mix(col, uTopEdge, uTopEdgeOn * smoothstep(uH - uTopEdgeW - .01, uH - uTopEdgeW, vP.y) * smoothstep(uRTop - .05, uRTop - .02, rr));
  // gold band
  float b = uBandOn * (1. - smoothstep(uBandH - .003, uBandH + .003, vP.y));
  vec3 g = mix(uBand, uBandDark, smoothstep(-.1, .75, n.x));
  g = mix(g, uBandHi, .6 * (1. - smoothstep(-.75, -.45, n.x)) * smoothstep(-.98, -.8, n.x));
  col = mix(col, g, b);
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;
const BRIM_VERT = `varying vec3 vN; varying vec3 vP; varying float vSide;
void main() { vN = normalize(normalMatrix * normal); vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.); vSide = mv.x - (modelViewMatrix * vec4(0., 0., 0., 1.)).x; gl_Position = projectionMatrix * mv; }`;
const BRIM_FRAG = `varying vec3 vN; varying vec3 vP; varying float vSide;
uniform vec3 uLit, uDark, uTrim, uTrimDark; uniform float uTrimOn, uR, uTrimW;
void main() {
  float side = smoothstep(-.4, .4, vSide);
  vec3 col = mix(uLit, uDark, side);
  float rr = length(vP.xz) / uR;
  vec3 g = mix(uTrim, uTrimDark, side * .8);
  col = mix(col, g, uTrimOn * smoothstep(1. - uTrimW - .015, 1. - uTrimW + .01, rr));
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;

function crownGeometry(P) {
  // straight walls from the band (r crownR) to the top (r crownRTop), a small rounded top edge, flat top
  const pts = [], N = 40;
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push(new THREE.Vector2(P.crownR + (P.crownRTop - P.crownR) * t, (P.crownH - P.topRound) * t)); }
  for (let i = 1; i <= 8; i++) { const a = i / 8 * Math.PI / 2; pts.push(new THREE.Vector2(P.crownRTop - P.topRound + P.topRound * Math.cos(a), P.crownH - P.topRound + P.topRound * Math.sin(a))); }
  for (let i = 1; i <= 6; i++) pts.push(new THREE.Vector2((P.crownRTop - P.topRound) * (1 - i / 6), P.crownH));
  pts[pts.length - 1].x = 1e-4;
  return new THREE.LatheGeometry(pts, 192);
}

function brimGeometry(P) {
  // an annulus from inside the crown to brimR, top and bottom faces, the outer part rolling up toward the sides (+-X)
  const nr = 24, na = 192, inner = P.crownR * .7, pos = [], idx = [];
  const lift = (x, z, r) => {
    const k = Math.max(0, (r / P.brimR - P.curlStart) / (1 - P.curlStart)); const s = x / Math.max(r, 1e-6), c = z / Math.max(r, 1e-6);
    return P.curl * k * k * s * s - P.frontDip * k * c * c;
  };
  for (const face of [0, 1]) {
    for (let i = 0; i <= nr; i++) {
      const r = inner + (P.brimR - inner) * i / nr;
      for (let j = 0; j < na; j++) {
        const a = j / na * Math.PI * 2, x = r * Math.cos(a), z = r * Math.sin(a);
        pos.push(x, lift(x, z, r) + (face ? 0 : -P.brimT), z);
      }
    }
    const base = face * (nr + 1) * na;
    for (let i = 0; i < nr; i++) for (let j = 0; j < na; j++) {
      const a = base + i * na + j, b = base + i * na + (j + 1) % na, c = a + na, d = b + na;
      if (face) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  }
  const outerTop = (nr + 1) * na + nr * na, outerBot = nr * na;
  for (let j = 0; j < na; j++) { const a = outerBot + j, b = outerBot + (j + 1) % na, c = outerTop + j, d = outerTop + (j + 1) % na; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

const eul = new THREE.Euler();
function applyMount(pivot, M) {
  pivot.position.set(M.x || 0, M.y ?? .30, M.z || 0);
  pivot.quaternion.setFromEuler(eul.set(M.rx || 0, M.ry || 0, M.rz || 0, 'ZXY'));
  pivot.scale.setScalar(M.scale ?? 1);
}

export async function build(params = {}) {
  const { tracks, track: inline, lookFrame, kind, ...own } = params;
  const TRACK = (params.track || params.tracks?.length) ? await loadTrack(params, 'cap') : {};
  const P = { ...DEF, ...(TRACK.shape || {}), ...own };
  P.mount = { ...DEF.mount, ...(TRACK.shape?.mount || {}), ...(own.mount || {}) };
  const root = new THREE.Group(); root.name = 'hat.tophat';
  const pivot = new THREE.Group(); applyMount(pivot, P.mount); root.add(pivot);

  const crownU = {
    uLit: { value: hex(P.crownLit) }, uDark: { value: hex(P.crownDark) }, uStripe: { value: hex(P.stripe) }, uTop: { value: hex(P.top) }, uTopEdge: { value: hex(P.topEdge) },
    uBand: { value: hex(P.band) }, uBandDark: { value: hex(P.bandDark) }, uBandHi: { value: hex(P.bandHi) },
    uTerm: { value: P.term }, uSoft: { value: P.termSoft }, uStripeOn: { value: P.stripeOn }, uBandH: { value: P.bandH + P.bandLift }, uBandOn: { value: P.bandOn },
    uH: { value: P.crownH }, uTopEdgeOn: { value: P.topEdgeOn }, uTopEdgeW: { value: P.topEdgeW }, uRTop: { value: P.crownRTop },
    uStripeX: { value: new THREE.Vector2(...P.stripeX) },
  };
  const crown = new THREE.Mesh(crownGeometry(P), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: CROWN_FRAG, uniforms: crownU }));
  crown.name = 'tophat.crown'; crown.position.y = -.004;
  outline(crown, { width: P.inkW, color: P.ink, zBias: 2 });
  pivot.add(crown);

  const brimU = { uLit: { value: hex(P.brimLit) }, uDark: { value: hex(P.brimDark) }, uTrim: { value: hex(P.trim) }, uTrimDark: { value: hex(P.trimDark) },
    uTrimOn: { value: P.trimOn }, uR: { value: P.brimR }, uTrimW: { value: P.trimW } };
  const brim = new THREE.Mesh(brimGeometry(P), new THREE.ShaderMaterial({ vertexShader: BRIM_VERT, fragmentShader: BRIM_FRAG, uniforms: brimU, side: THREE.DoubleSide }));
  brim.name = 'tophat.brim';
  outline(brim, { width: P.inkBrim, color: P.ink, zBias: 1 });
  pivot.add(brim);

  root.userData = { pivot, track: TRACK, params: P, lookFrame };
  return root;
}

// 2.5D pose against the camera, as bowler.js / cap.js poseCap (az el roll deg, u v head diameters from the head centre, s against d)
const DEG = Math.PI / 180;
const _dir = new THREE.Vector3(), _ray = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _near = new THREE.Vector3(), _m = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _qq = new THREE.Quaternion(), _o = new THREE.Vector3(), _ref = new THREE.Vector3(), _axis = new THREE.Vector3(0, 0, -1), _wp = new THREE.Vector3(), _wq = new THREE.Quaternion(), _ws = new THREE.Vector3();
function poseHat(pivot, root, P, ctx, yRef) {
  const { cam, camera, focal: F, width: W, height: H } = ctx;
  const x = cam.cx + P.u * cam.d, y = cam.cy + P.v * cam.d, ds = (P.s ?? 1) * cam.d;
  _dir.set(Math.sin(P.az * DEG) * Math.cos(P.el * DEG), Math.sin(P.el * DEG), Math.cos(P.az * DEG) * Math.cos(P.el * DEG));
  _ray.set((x - W / 2) / F, -(y - H / 2) / F, -1).normalize();
  const D = Math.hypot(F / (ds * Math.pow(-_ray.z, 1.5)), .5);
  _near.set(0, 1, 0);
  _x.crossVectors(_near, _dir).normalize(); _y.crossVectors(_dir, _x);
  _x.applyAxisAngle(_dir, (P.roll || 0) * DEG); _y.applyAxisAngle(_dir, (P.roll || 0) * DEG);
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
  pivot.visible = true;
  const f = Math.round(frame);
  // hide { "<from>": <to> }: frames the hat is gone (off frame after the launch)
  if (T.hide) for (const k in T.hide) if (f >= +k && f <= T.hide[k]) { pivot.visible = false; return; }
  const L = nearest(T.lift, f);
  let pose = nearest(T.pose, f);
  // follow: one rule { el, from?, to?, azK?, y? } or a list of them (first match wins): per shot el and brim height y (D over the centre)
  const rules = Array.isArray(T.follow) ? T.follow : T.follow ? [T.follow] : [];
  const F = rules.find(R => (R.from === undefined || f >= R.from) && (R.to === undefined || f <= R.to));
  if (!pose && F && ctx.cam) {
    const r = (ctx.cam.roll || 0) * DEG, Lm = (F.y ?? P.mount.y) * Math.cos(F.el * DEG);
    pose = { az: (ctx.cam.az || 0) * (F.azK ?? 1), el: F.el, roll: ctx.cam.roll || 0, u: Lm * Math.sin(r), v: -Lm * Math.cos(r), s: 1 };
  }
  if (L) {
    pivot.position.set(P.mount.x + (L.x || 0), P.mount.y + (L.y || 0), P.mount.z + (L.z || 0));
    pivot.quaternion.setFromEuler(eul.set(L.rx || 0, L.ry || 0, L.rz || 0, 'ZXY'));
  } else if (pose && ctx.cam && ctx.camera) poseHat(pivot, root, pose, ctx, P.mount.y);
  const t = nearest(T.tilt, f);
  if (t && !L && !pose) { pivot.position.y = t.y ?? P.mount.y; pivot.quaternion.setFromEuler(eul.set(t.rx ?? P.mount.rx, P.mount.ry || 0, t.rz ?? P.mount.rz, 'ZXY')); }
}

export default { build, update };
