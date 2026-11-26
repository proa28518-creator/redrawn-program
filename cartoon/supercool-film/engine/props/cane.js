// props/cane.js: the Boss's walking cane. A thin dark-brown shaft with a pale streak, a gold ball pommel on top and a gold ferrule at the tip,
// all inked at body weight (shade.js outline). Measured on f494, f512, f1395, f1430: shaft about .036 D across, pommel about .12 D across
// (inner gold), cane length pommel centre to tip about 2.0 D.
// Spec: { "kind": "cane", "length": 2.0, "shaftR": .018, "pommelR": .058, "ferrule": .09 }
// Pose: tracks/<char>/props.json { "cane": { "<frame>": { p: [x,y,z] pommel centre, q: [x,y,z,w] rotating local -Y (pommel -> tip) } } },
// character space; frames between keys interpolate (p lerp, q slerp), outside the keys hold the nearest. A key { "hide": true } hides it.
// Without a track it hangs from the near hand.
import * as THREE from '../three.js';
import { loadTrack } from '../tracks.js';
import { outline } from '../shade.js';

const VERT = /* glsl */`
varying vec3 vN; varying vec2 vUv;
void main() { vN = normalize(normalMatrix * normal); vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */`
precision highp float;
uniform vec3 cLit, cDark, cHi; uniform float uHi;
varying vec3 vN; varying vec2 vUv;
void main() {
  vec3 n = normalize(vN);
  float k = dot(n.xy, normalize(vec2(-1., .35)));
  vec3 c = mix(cDark, cLit, smoothstep(-.35, .25, k));
  c = mix(c, cHi, uHi * smoothstep(.55, .8, k));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;
const mat = (lit, dark, hi, h) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG,
  uniforms: { cLit: { value: new THREE.Color(lit) }, cDark: { value: new THREE.Color(dark) }, cHi: { value: new THREE.Color(hi) }, uHi: { value: h } } });

export async function build(params = {}) {
  const { kind, tracks, limbsTrack, ...own } = params;
  const all = tracks?.props?.length ? await loadTrack({ tracks: tracks.props }, 'props') : null;
  const track = all?.[kind || 'cane'] || null;
  const L = own.length ?? 2.0, r = own.shaftR ?? .021, R = own.pommelR ?? .058, fl = own.ferrule ?? .09;
  const ink = own.ink ?? 0x3a2a33, w = own.inkWidth ?? .018;
  const root = new THREE.Group(); root.name = 'prop.cane';
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L - fl, 16, 1), mat(own.shaftLit ?? '#9a6c36', own.shaftDark ?? '#5c3b25', own.shaftHi ?? '#d9ae68', 1));
  shaft.position.y = -(L - fl) / 2; shaft.name = 'cane.shaft'; root.add(shaft);
  const gold = () => mat(own.goldLit ?? '#ecd17c', own.goldDark ?? '#b8933a', '#fff4c4', 1);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20), gold()); pommel.name = 'cane.pommel'; root.add(pommel);
  const fer = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * .8, fl, 16, 1), gold());
  fer.position.y = -L + fl / 2; fer.name = 'cane.ferrule'; root.add(fer);
  for (const m of [shaft, pommel, fer]) outline(m, { width: w, color: ink });
  root.userData = { track, limbsTrack, kind: kind || 'cane', keys: track ? Object.keys(track).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b) : [] };
  return root;
}

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
export function update(frame, ctx) {
  const { track, keys, limbsTrack } = ctx.root.userData;
  if (track && keys.length) {
    let a = keys[0], b = keys[keys.length - 1];
    for (const k of keys) { if (k <= frame) a = k; if (k >= frame) { b = k; break; } }
    const A = track[a], B = track[b];
    if ((frame <= a ? A : frame >= b ? B : A).hide && (A.hide || B.hide)) { ctx.root.visible = false; return; }
    ctx.root.visible = true;
    const t = a === b ? 0 : Math.min(1, Math.max(0, (frame - a) / (b - a)));
    ctx.root.position.set(...A.p.map((v, i) => v + (B.p[i] - v) * t));
    qa.set(...A.q); qb.set(...B.q); ctx.root.quaternion.copy(qa.slerp(qb, t));
    return;
  }
  const hand = limbsTrack?.keys?.[String(frame)]?.hands?.near;
  ctx.root.visible = !!hand;
  if (hand) ctx.root.position.set(hand[0], hand[1] + .05, hand[2]);
}
