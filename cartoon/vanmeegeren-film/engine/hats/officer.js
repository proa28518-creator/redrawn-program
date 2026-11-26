// hats/officer.js: the Rival Inspector's officer's cap (STYLE_BIBLE 3 card, research/cast/inspector.png, s07 f700 f706 f712 f718).
// A black glossy band (a short cylinder) under a wide blue crown that flares out over it with a near-flat top, a black glossy visor at the
// front with a white highlight arc, ONE gold piping line round the band running into a gold winged badge at the front.
// Measured on s07 (d ~400 px, high close, el ~ +20..+30): crown ~.88-.92 D across, band ~.75 D across and ~.13 D tall, visor ~.17 D deep.
// Pose: exactly bowler.js (mount on the head, or a cap.json `pose` / `follow` / `lift` / `tilt` per frame: the same track fields).
// params (spec "hat", every key optional): see DEF. Track: <tracks>/cap.json { shape: {..same keys..}, pose, follow, lift, tilt } (optional).
import * as THREE from '../three.js';
import { loadTrack } from '../tracks.js';
import { outline } from '../shade.js';

export const DEF = {
  bandR: .375, bandH: .135, bandTaper: .015,              // band radius at its foot, height, foot-to-top widening
  crownR: .46, crownH: .135, crownTop: .02, crownTilt: 0,  // crown's widest radius, height of its rim above the band top, top dome, back-to-front tilt
  crownFwd: .03,                                          // crown centre pushed toward the front (+Z), D
  visorR: .19, visorAng: 78, visorDrop: .32, visorT: .016, // visor depth beyond the band at the front, half angle (deg), slope (down per out), thickness
  pipeY: .80, pipeW: .022,                                // gold piping: height in band units (0 foot .. 1 top), width D
  badgeR: .042, wingW: .075, wingH: .022, badgeY: .80,
  mount: { x: 0, y: .17, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 },
  crownLit: '#4f6aa6', crownMid: '#415a91', crownDark: '#2a3a68', term: .15, termSoft: .45,
  arc: '#b9c8e8', arcOn: .85, arcR: [.86, .95], arcAng: [95, 175],
  topLit: '#4a64a0',
  band: '#1b1720', bandGloss: '#55505d', glossOn: .7,
  visor: '#1d1922', visorGloss: '#e9e6ee', visorGlossOn: .9, visorArcR: [.38, .62], visorArcA: [-.45, -.22], // glint: depth range (0 band .. 1 edge), angle range (rad, - = viewer left)
  gold: '#e6bf3c', goldDark: '#a77f1d', badgeInk: '#3a2a33',
  ink: '#3a2a33', inkW: .024, inkBand: .02, inkVisor: .02,
};

const hex = c => new THREE.Color(c);
const VERT = `varying vec3 vN; varying vec3 vP;
void main() { vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const CROWN_FRAG = `varying vec3 vN; varying vec3 vP;
uniform vec3 uLit, uMid, uDark, uArc; uniform float uTerm, uSoft, uArcOn; uniform vec2 uArcR, uArcA;
void main() {
  vec3 n = normalize(vN);
  vec3 col = mix(uLit, uMid, smoothstep(-.6, uTerm, n.x));
  col = mix(col, uDark, smoothstep(uTerm, uTerm + uSoft, n.x));
  float r = length(n.xy), a = degrees(atan(n.y, n.x));
  float arc = smoothstep(uArcR.x - .02, uArcR.x + .01, r) * (1. - smoothstep(uArcR.y - .01, uArcR.y + .02, r)) * smoothstep(uArcA.x, uArcA.x + 12., a) * (1. - smoothstep(uArcA.y - 12., uArcA.y, a));
  col = mix(col, uArc, uArcOn * arc);
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;
const BAND_FRAG = `varying vec3 vN; varying vec3 vP;
uniform vec3 uBand, uGloss, uGold, uGoldDark, uInk; uniform float uGlossOn, uH, uR, uPipeY, uPipeW, uBadgeR, uWingW, uWingH, uBadgeY;
float px() { return fwidth(vP.y) * 1.2 + 1e-5; }
float fillD(float d) { return clamp(.5 - d / px(), 0., 1.); }
void main() {
  vec3 n = normalize(vN);
  vec3 col = uBand;
  // gloss: a soft pale streak on the lit (viewer-left) side, upper half of the band
  col = mix(col, uGloss, uGlossOn * smoothstep(-.2, -.6, n.x) * smoothstep(.35, .7, vP.y / uH));
  float s = atan(vP.x, vP.z) * uR;          // arc length from the front, D (+ toward +X)
  float y = vP.y;
  // the closed top/bottom discs carry no piping or badge (on the top disc atan() drew the badge as a radial spike)
  if (length(vP.xz) < uR * .97) { gl_FragColor = vec4(uBand, 1.);
    #include <colorspace_fragment>
    return; }
  // the piping line
  float py = uPipeY * uH;
  col = mix(col, uGold, fillD(abs(y - py) - uPipeW * .5));
  // the winged badge at the front
  float by = uBadgeY * uH;
  vec2 q = vec2(s, y - by);
  // wings: horizontal tapered blades from the disc out along the band, the outer tips swept up (his s07 f700-716 badge)
  // (his are leaves: from under the disc, swept ~30 deg up and out, about 2 disc radii long)
  vec2 p = vec2(abs(q.x) - uBadgeR * .55, q.y + uBadgeR * .25);
  float ca = .87, sa = .5, al = p.x * ca + p.y * sa, ac = -p.x * sa + p.y * ca, tl = clamp(al / uWingW, 0., 1.);
  float wing = max(abs(ac) - uWingH * sin(3.1416 * tl), max(-al, al - uWingW));
  col = mix(col, uGold, fillD(wing));
  float disc = length(q) - uBadgeR;
  col = mix(col, uInk, fillD(disc));
  col = mix(col, uGold, fillD(disc + .007));
  col = mix(col, uGoldDark, fillD(abs(length(q) - uBadgeR * .45) - .004) * .8);
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;
const VISOR_FRAG = `varying vec3 vN; varying vec3 vP;
uniform vec3 uVisor, uGloss; uniform float uGlossOn, uR0, uR1; uniform vec2 uArcR, uArcA;
void main() {
  vec3 n = normalize(vN);
  vec3 col = uVisor;
  float r = (length(vP.xz) - uR0) / (uR1 - uR0);
  float a = atan(vP.x, vP.z);
  // a thin white arc a little in from the front edge, strongest centre-left
  // his s07 visor: a broad white glint on the viewer-left half (character right, -X), mid-depth, fading toward the centre
  float arc = smoothstep(uArcR.x - .06, uArcR.x, r) * (1. - smoothstep(uArcR.y, uArcR.y + .06, r)) * smoothstep(uArcA.x - .06, uArcA.x, a) * (1. - smoothstep(uArcA.y, uArcA.y + .1, a));
  col = mix(col, uGloss, uGlossOn * arc);
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;

function bandGeometry(P) {
  const pts = [];
  pts.push(new THREE.Vector2(1e-4, 0)); // closed (bottom + top discs): drawn on top without depth, an open tube would show its inner far wall
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(P.bandR + P.bandTaper * t, P.bandH * t)); }
  pts.push(new THREE.Vector2(1e-4, P.bandH));
  return new THREE.LatheGeometry(pts, 160);
}
function crownGeometry(P) {
  // profile from the band top out to the rim (a rounded bead) and in over a near-flat top
  const b = P.bandR + P.bandTaper, y0 = P.bandH - .01, R = P.crownR, H = P.crownH, pts = [];
  const prof = [[b - .005, y0], [b + (R - b) * .35, y0 + H * .30], [b + (R - b) * .75, y0 + H * .62], [R, y0 + H * .86], [R - .006, y0 + H * .97],
                [R - .03, y0 + H * 1.0], [R * .7, y0 + H + P.crownTop * .6], [R * .35, y0 + H + P.crownTop * .9], [0, y0 + H + P.crownTop]];
  for (let i = 0; i < prof.length - 1; i++) for (let k = 0; k < 6; k++) {
    const t = k / 6, a = prof[i], c = prof[i + 1];
    pts.push(new THREE.Vector2(a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t));
  }
  pts.push(new THREE.Vector2(0, y0 + H + P.crownTop));
  const g = new THREE.LatheGeometry(pts, 160);
  // widen toward the front: the crown overhangs the visor more than the back
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), k = Math.max(0, (y - y0) / H); pos.setZ(i, pos.getZ(i) + P.crownFwd * Math.min(1, k)); }
  g.computeVertexNormals();
  return g;
}
function visorGeometry(P) {
  const r0 = P.bandR - .01, r1 = P.bandR + P.visorR, A = P.visorAng * Math.PI / 180, na = 64, nr = 10, pos = [], idx = [];
  for (const face of [0, 1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= nr; i++) for (let j = 0; j <= na; j++) {
      const a = -A + 2 * A * j / na, depth = Math.cos(a * Math.PI / 2 / A * .999); // full depth at the front, none at the ends
      const r = r0 + (r1 - r0) * depth * i / nr;
      const out = r - r0;
      pos.push(r * Math.sin(a), -out * P.visorDrop + (face ? 0 : -P.visorT) + .004, r * Math.cos(a));
    }
    for (let i = 0; i < nr; i++) for (let j = 0; j < na; j++) {
      const a = base + i * (na + 1) + j, b = a + 1, c = a + na + 1, d = c + 1;
      if (face) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

const eul = new THREE.Euler();
function applyMount(pivot, M) {
  pivot.position.set(M.x || 0, M.y ?? .17, M.z || 0);
  pivot.quaternion.setFromEuler(eul.set(M.rx || 0, M.ry || 0, M.rz || 0, 'ZXY'));
  pivot.scale.setScalar(M.scale ?? 1);
}

export async function build(params = {}) {
  const { tracks, track: inline, lookFrame, kind, ...own } = params;
  const TRACK = (params.track || params.tracks?.length) ? await loadTrack(params, 'cap') : {};
  const P = { ...DEF, ...(TRACK.shape || {}), ...own };
  P.mount = { ...DEF.mount, ...(TRACK.shape?.mount || {}), ...(own.mount || {}) };
  const root = new THREE.Group(); root.name = 'hat.officer';
  const pivot = new THREE.Group(); applyMount(pivot, P.mount); root.add(pivot);
  const tilt = new THREE.Group(); tilt.rotation.x = -(P.crownTilt || 0); pivot.add(tilt);

  const bandU = {
    uBand: { value: hex(P.band) }, uGloss: { value: hex(P.bandGloss) }, uGold: { value: hex(P.gold) }, uGoldDark: { value: hex(P.goldDark) }, uInk: { value: hex(P.badgeInk) },
    uGlossOn: { value: P.glossOn }, uH: { value: P.bandH }, uR: { value: P.bandR }, uPipeY: { value: P.pipeY }, uPipeW: { value: P.pipeW },
    uBadgeR: { value: P.badgeR }, uWingW: { value: P.wingW }, uWingH: { value: P.wingH }, uBadgeY: { value: P.badgeY },
  };
  const band = new THREE.Mesh(bandGeometry(P), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: BAND_FRAG, uniforms: bandU, extensions: { derivatives: true } }));
  band.name = 'officer.band';
  outline(band, { width: P.inkBand, color: P.ink, zBias: 1 });
  pivot.add(band);

  const crownU = {
    uLit: { value: hex(P.crownLit) }, uMid: { value: hex(P.crownMid) }, uDark: { value: hex(P.crownDark) }, uArc: { value: hex(P.arc) },
    uTerm: { value: P.term }, uSoft: { value: P.termSoft }, uArcOn: { value: P.arcOn }, uArcR: { value: new THREE.Vector2(...P.arcR) }, uArcA: { value: new THREE.Vector2(...P.arcAng) },
  };
  const crown = new THREE.Mesh(crownGeometry(P), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: CROWN_FRAG, uniforms: crownU }));
  crown.name = 'officer.crown';
  outline(crown, { width: P.inkW, color: P.ink, zBias: 2 });
  tilt.add(crown);

  const visorU = { uVisor: { value: hex(P.visor) }, uGloss: { value: hex(P.visorGloss) }, uGlossOn: { value: P.visorGlossOn }, uR0: { value: P.bandR - .01 }, uR1: { value: P.bandR + P.visorR },
    uArcR: { value: new THREE.Vector2(...P.visorArcR) }, uArcA: { value: new THREE.Vector2(...P.visorArcA) } };
  const visor = new THREE.Mesh(visorGeometry(P), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: VISOR_FRAG, uniforms: visorU, side: THREE.DoubleSide }));
  visor.name = 'officer.visor';
  outline(visor, { width: P.inkVisor, color: P.ink, zBias: 1 });
  pivot.add(visor);

  // his cap is its own 2.5D layer over the head: drawn on top of the head and face whatever the depth (onTop, default on), band < visor < crown,
  // each part's ink hull first. Otherwise the band and crown sink into the head sphere (the head's white shows through them).
  if (P.onTop !== false) [[band, 100], [visor, 110], [crown, 120]].forEach(([m, o]) => m.traverse(x => { if (!x.isMesh) return; x.material.depthTest = false; x.material.depthWrite = false; x.renderOrder = x === m ? o + 1 : o; }));
  root.userData = { pivot, track: TRACK, params: P, lookFrame };
  return root;
}

// 2.5D pose against the camera: bowler.js poseHat, copied (az el roll deg, u v head diameters from the head centre, s against d)
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
  const FL = Array.isArray(T.follow) ? T.follow : (T.follow ? [T.follow] : []);
  const F = FL.find(r => (r.from === undefined || f >= r.from) && (r.to === undefined || f <= r.to));
  if (!pose && F && ctx.cam) {
    const r = ((ctx.cam.roll || 0) + (F.roll || 0)) * DEG, Ly = (F.y ?? P.mount.y) * Math.cos(F.el * DEG);
    pose = { az: (ctx.cam.az || 0) + (F.az || 0), el: F.el, roll: (ctx.cam.roll || 0) + (F.roll || 0), u: Ly * Math.sin(r) + (F.u || 0), v: -Ly * Math.cos(r) + (F.v || 0), s: F.s ?? 1 };
  }
  if (L) {
    pivot.position.set(P.mount.x + (L.x || 0), P.mount.y + (L.y || 0), P.mount.z + (L.z || 0));
    pivot.quaternion.setFromEuler(eul.set(L.rx || 0, L.ry || 0, L.rz || 0, 'ZXY'));
  } else if (pose && ctx.cam && ctx.camera) poseHat(pivot, root, pose, ctx, P.mount.y);
  const t = nearest(T.tilt, f);
  if (t && !L && !pose) { pivot.position.y = t.y ?? P.mount.y; pivot.quaternion.setFromEuler(eul.set(t.rx ?? P.mount.rx, P.mount.ry || 0, t.rz ?? P.mount.rz, 'ZXY')); }
}

export default { build, update };
