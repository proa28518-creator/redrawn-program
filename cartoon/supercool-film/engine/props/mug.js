// props/mug.js: the Boss's blue enamel coffee mug (s11 f863-936) and the coffee it spills on his vest. A straight cylinder, cobalt blue with
// white speckles, a pale rim, dark coffee inside, a loop handle on the far side, all inked at body weight. Measured on f880/f905/f925:
// about .36-.40 D across, .44-.48 D tall. The spill: a flat jagged brown splat with a dark ink edge and two pale spots (f896-936, his chest).
// Spec: { "kind": "mug", "r": .2, "h": .48 }
// Pose: tracks/<char>/props.json { "mug": { "<frame>": { p: [x,y,z] mug centre, q: [x,y,z,w] } },
//                                  "mugStain": { "<frame>": { p, q, s } } }  (character space; the stain shows from its first key on)
// Between keys p lerps, q slerps, outside the keys it holds the nearest; a key { "hide": true } hides it.
import * as THREE from '../three.js';
import { loadTrack } from '../tracks.js';
import { outline } from '../shade.js';

const VERT = /* glsl */`
varying vec3 vN; varying vec3 vP;
void main() { vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */`
precision highp float;
uniform vec3 cLit, cDark, cSpeck; uniform float uSpeck;
varying vec3 vN; varying vec3 vP;
float h(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main() {
  vec3 n = normalize(vN);
  float k = dot(n.xy, normalize(vec2(-1., .3)));
  vec3 c = mix(cDark, cLit, smoothstep(-.5, .4, k));
  vec3 g = floor(vP * 64.);
  float s = step(.95, h(g)) * uSpeck;
  c = mix(c, cSpeck, s);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;
const mat = (lit, dark, speck, s) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG,
  uniforms: { cLit: { value: new THREE.Color(lit) }, cDark: { value: new THREE.Color(dark) }, cSpeck: { value: new THREE.Color(speck) }, uSpeck: { value: s } } });

// the splat outline (unit size, x right, y up): a rough hexagon with notches, as on f898-f925
const SPLAT = [[-.5, .1], [-.36, .42], [-.12, .36], [.02, .5], [.3, .4], [.5, .46], [.44, .12], [.52, -.2], [.3, -.5], [0, -.42], [-.3, -.5], [-.46, -.24]];
function splatMesh(poly, scale, color, z) {
  const sh = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x * scale, y * scale)));
  const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color }));
  m.position.z = z; return m;
}

function keysOf(t) { return t ? Object.keys(t).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b) : []; }

export async function build(params = {}) {
  const { kind, tracks, limbsTrack, ...own } = params;
  const all = tracks?.props?.length ? await loadTrack({ tracks: tracks.props }, 'props') : null;
  const k = kind || 'mug';
  const track = all?.[k] || null, stainTrack = all?.[k + 'Stain'] || null;
  const r = own.r ?? .2, h = own.h ?? .48, ink = own.ink ?? 0x2d2228, w = own.inkWidth ?? .022;
  const root = new THREE.Group(); root.name = 'prop.mug';
  const cup = new THREE.Group(); cup.name = 'mug.cup'; root.add(cup);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * .97, h, 40, 1, true), mat(own.lit ?? '#3d7fe0', own.dark ?? '#16357e', '#e8f2ff', 1));
  body.material.side = THREE.DoubleSide; body.name = 'mug.body'; cup.add(body);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(r * .97, 40), mat('#1a3f8f', '#122c68', '#e8f2ff', 0));
  bottom.rotation.x = Math.PI / 2; bottom.position.y = -h / 2; cup.add(bottom);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(r * .92, 40), new THREE.MeshBasicMaterial({ color: own.coffee ?? 0x3b2418 }));
  coffee.rotation.x = -Math.PI / 2; coffee.position.y = h / 2 - .06; coffee.name = 'mug.coffee'; cup.add(coffee);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, .016, 8, 48), new THREE.MeshBasicMaterial({ color: own.rim ?? 0xc9d6ea }));
  rim.rotation.x = Math.PI / 2; rim.position.y = h / 2; cup.add(rim);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(h * .26, .03, 10, 24, Math.PI * 1.15), mat('#2f68c4', '#16357e', '#e8f2ff', 0));
  handle.rotation.z = -Math.PI / 2 - Math.PI * .075; handle.position.set(-r, 0, -.04); handle.name = 'mug.handle'; cup.add(handle);
  for (const m of [body, handle]) outline(m, { width: w, color: ink });
  const stain = new THREE.Group(); stain.name = 'mug.stain'; root.add(stain);
  stain.add(splatMesh(SPLAT, 1.06, own.stainInk ?? 0x4a2c1c, 0));
  stain.add(splatMesh(SPLAT, 1, own.stain ?? 0x8a5a34, .002));
  for (const [x, y, s] of [[-.12, -.08, .07], [.2, .16, .045]]) {
    const spot = new THREE.Mesh(new THREE.CircleGeometry(s, 20), new THREE.MeshBasicMaterial({ color: own.stainHi ?? 0xb58a62 }));
    spot.scale.y = .7; spot.position.set(x, y, .004); stain.add(spot);
  }
  stain.visible = false;
  root.userData = { cup, stain, track, keys: keysOf(track), stainTrack, stainKeys: keysOf(stainTrack), kind: k };
  return root;
}

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
function pose(obj, track, keys, frame, hideBefore) {
  if (!track || !keys.length || (hideBefore && frame < keys[0])) { obj.visible = false; return; }
  let a = keys[0], b = keys[keys.length - 1];
  for (const k of keys) { if (k <= frame) a = k; if (k >= frame) { b = k; break; } }
  const A = track[a], B = track[b];
  const K = frame <= a ? A : frame >= b ? B : A;
  if (K.hide || (A.hide && B.hide) || !A.p || !B.p) { obj.visible = false; return; }
  obj.visible = true;
  const t = a === b ? 0 : Math.min(1, Math.max(0, (frame - a) / (b - a)));
  obj.position.set(...A.p.map((v, i) => v + (B.p[i] - v) * t));
  qa.set(...A.q); qb.set(...B.q); obj.quaternion.copy(qa.slerp(qb, t));
  if (A.s !== undefined) obj.scale.setScalar(A.s + ((B.s ?? A.s) - A.s) * t);
}
export function update(frame, ctx) {
  const U = ctx.root.userData;
  pose(U.cup, U.track, U.keys, frame, false);
  pose(U.stain, U.stainTrack, U.stainKeys, frame, true);
}
