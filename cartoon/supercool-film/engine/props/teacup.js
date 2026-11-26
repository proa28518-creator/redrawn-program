// props/teacup.js: the Passenger's teacup on its saucer (s09 f780-862), held with both hands. Read on f816 (at the chest), f834-852 (at the
// mouth) and the cast crop: a white porcelain cup flaring to the rim (~.30 D across, ~.15 D tall), a pale grey inside, a small loop handle on
// the viewer's right, a wide saucer (~.46 D) under it, everything inked at body weight. The far hand holds the handle with ONE oval thumb up
// (STYLE_BIBLE: "holding a small object, one oval thumb is added", f846): the thumb is part of this prop (key "thumb": 1).
// Spec: { "kind": "teacup", "r": .15, "h": .15, "saucerR": .23 }
// Pose: tracks/<char>/props.json { "teacup": { "<frame>": { p: [x,y,z] cup centre, q: [x,y,z,w], s?, sauc? (saucer width factor), thumb?: 0/1, hide?: true } } }
// Between keys p lerps, q slerps, s lerps; outside the keys it holds the nearest.
import * as THREE from '../three.js';
import { loadTrack } from '../tracks.js';
import { outline } from '../shade.js';

const VERT = /* glsl */`
varying vec3 vN; varying vec3 vP;
void main() { vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */`
precision highp float;
uniform vec3 cLit, cDark;
uniform float uA, uB;
varying vec3 vN; varying vec3 vP;
void main() {
  vec3 n = normalize(vN);
  float k = dot(n.xy, normalize(vec2(-1., .35)));
  vec3 c = mix(cDark, cLit, smoothstep(uA, uB, k));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;
const mat = (lit, dark, a = -.6, b = .3, side = THREE.FrontSide) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side,
  uniforms: { cLit: { value: new THREE.Color(lit) }, cDark: { value: new THREE.Color(dark) }, uA: { value: a }, uB: { value: b } } });

function keysOf(t) { return t ? Object.keys(t).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b) : []; }

export async function build(params = {}) {
  const { kind, tracks, limbsTrack, ...own } = params;
  const all = tracks?.props?.length ? await loadTrack({ tracks: tracks.props }, 'props') : null;
  const k = kind || 'teacup';
  const track = all?.[k] || null;
  const r = own.r ?? .15, h = own.h ?? .15, sr = own.saucerR ?? .23, ink = own.ink ?? 0x2d2228, w = own.inkWidth ?? .02;
  const root = new THREE.Group(); root.name = 'prop.teacup';
  const cup = new THREE.Group(); cup.name = 'teacup.cup'; root.add(cup);
  // the cup: a lathe from the foot to the flared rim
  const prof = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(r * (.48 + .52 * Math.sin(t * Math.PI / 2)), -h / 2 + h * t)); }
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), mat(own.lit ?? '#fbf8fb', own.dark ?? '#b9b2c0', -.7, .2, THREE.DoubleSide));
  body.name = 'teacup.body'; cup.add(body);
  const foot = new THREE.Mesh(new THREE.CircleGeometry(r * .48, 32), new THREE.MeshBasicMaterial({ color: own.dark ?? 0xb9b2c0 }));
  foot.rotation.x = Math.PI / 2; foot.position.y = -h / 2; cup.add(foot);
  const inside = new THREE.Mesh(new THREE.CircleGeometry(r * .94, 40), new THREE.MeshBasicMaterial({ color: own.inside ?? 0xd9d3dd }));
  inside.rotation.x = -Math.PI / 2; inside.position.y = h / 2 - .012; inside.name = 'teacup.inside'; cup.add(inside);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, .009, 6, 48), new THREE.MeshBasicMaterial({ color: ink }));
  rim.rotation.x = Math.PI / 2; rim.position.y = h / 2; cup.add(rim);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(h * .28, .018, 8, 20, Math.PI * 1.2), mat('#f4f0f5', '#b9b2c0'));
  handle.rotation.z = -Math.PI * .6; handle.position.set(r * .78, .0, 0); handle.name = 'teacup.handle'; cup.add(handle);
  // the saucer: a shallow disc under the foot
  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(sr, sr * .62, .03, 48), mat(own.saucerLit ?? '#e7e2ea', own.saucerDark ?? '#4f4856', -.25, .45));
  saucer.position.y = -h / 2 - .012; saucer.name = 'teacup.saucer'; root.add(saucer);
  const well = new THREE.Mesh(new THREE.RingGeometry(sr * .55, sr * .6, 40), new THREE.MeshBasicMaterial({ color: own.saucerLine ?? 0xa59dac }));
  well.rotation.x = -Math.PI / 2; well.position.y = -h / 2 + .004; root.add(well);
  // the far hand's oval thumb on the handle (ink, no outline: it is ink)
  const thumb = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: own.thumb ?? 0x3a2a33 }));
  thumb.scale.set(own.thumbW ?? .032, own.thumbH ?? .055, .032);
  thumb.position.set(...(own.thumbAt ?? [r + .06, .06, .03])); thumb.rotation.z = -.25; thumb.name = 'teacup.thumb'; root.add(thumb);
  for (const m of [body, handle, saucer]) outline(m, { width: w, color: ink });
  root.userData = { track, keys: keysOf(track), thumb, saucer, well, kind: k };
  return root;
}

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
export function update(frame, ctx) {
  const U = ctx.root.userData, obj = ctx.root, track = U.track, keys = U.keys;
  if (!track || !keys.length) { obj.visible = false; return; }
  let a = keys[0], b = keys[keys.length - 1];
  for (const k of keys) { if (k <= frame) a = k; if (k >= frame) { b = k; break; } }
  const A = track[a], B = track[b];
  if ((frame <= a ? A : frame >= b ? B : A).hide || !A.p || !B.p) { obj.visible = false; return; }
  obj.visible = true;
  const t = a === b ? 0 : Math.min(1, Math.max(0, (frame - a) / (b - a)));
  obj.position.set(...A.p.map((v, i) => v + (B.p[i] - v) * t));
  qa.set(...A.q); qb.set(...B.q); obj.quaternion.copy(qa.slerp(qb, t));
  obj.scale.setScalar((A.s ?? 1) + ((B.s ?? A.s ?? 1) - (A.s ?? 1)) * t);
  U.thumb.visible = !!((t < .5 ? A : B).thumb);
  const ss = (A.sauc ?? 1) + ((B.sauc ?? A.sauc ?? 1) - (A.sauc ?? 1)) * t; // key "sauc": the saucer's own width factor (his saucer grows less than the cup when it rises)
  U.saucer.scale.set(ss, 1, ss); U.well.scale.set(ss, ss, 1);
}

export default { build, update };
