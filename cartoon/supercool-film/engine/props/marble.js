// props/marble.js: the Rival Inspector's white marble (MOTION_BIBLE: rests in the hand f702-722 while the arm sits low; s07).
// A white ball with an ink ring and a faint lilac shade low right. Spec: { "kind": "marble", "r": .055 } (radius, D).
// Track: tracks/<char>/props*.json { "marble": { "<frame>": { p: [x,y,z] } , ... } } character space; frames between two keys
// interpolate (at most 6 apart), any other frame hides it.
import * as THREE from '../three.js';
import { loadTrack } from '../tracks.js';
import { outline } from '../shade.js';

const FRAG = `varying vec3 vN;
uniform vec3 uLit, uShade;
void main() {
  vec3 n = normalize(vN);
  float k = dot(n, normalize(vec3(-.45, .5, .75)));
  vec3 c = mix(uShade, uLit, smoothstep(-.1, .45, k));
  gl_FragColor = vec4(c, 1.);
  #include <colorspace_fragment>
}`;
const VERT = `varying vec3 vN; void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

export async function build(params = {}) {
  const { kind, tracks, limbsTrack, ...own } = params;
  const track = tracks?.props?.length ? (await loadTrack({ tracks: tracks.props }, 'props'))[kind] || null : null;
  const root = new THREE.Group(); root.name = 'prop.marble';
  const ball = new THREE.Mesh(new THREE.SphereGeometry(own.r ?? .055, 32, 20),
    new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uLit: { value: new THREE.Color(own.lit ?? '#fbf8f6') }, uShade: { value: new THREE.Color(own.shade ?? '#d9cfe0') } } }));
  outline(ball, { width: own.ink ?? .022, color: 0x3a2a33 });
  root.add(ball);
  root.userData = { track, kind };
  return root;
}

export function update(frame, ctx) {
  const { track } = ctx.root.userData;
  const keys = track ? Object.keys(track).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b) : [];
  let p = null;
  if (track?.[String(frame)]) p = track[String(frame)].p;
  else {
    const a = keys.filter(k => k < frame).pop(), b = keys.find(k => k > frame);
    if (a !== undefined && b !== undefined && b - a <= 6) {
      const t = (frame - a) / (b - a), A = track[a].p, B = track[b].p;
      p = A.map((v, i) => v + (B[i] - v) * t);
    }
  }
  ctx.root.visible = !!p;
  if (p) ctx.root.position.set(p[0], p[1], p[2]);
}

export default { build, update };
