// head.js: the ball, its ink hull and the hair, one rigid 3D object in character space (origin = hull centre, D = 1).
//   build(params) -> Group. userData.mount = { up, top, front, button, ballR, viewOffset, hairR } for the cap and the face.
//   update(frame, ctx): sets the measured per-frame shading (skin band direction, hair tint). Works without a frame too.
// Measured (tools/head_*.py, 2026-11-03):
//  - The hull is a sphere of radius .5, always round. The ball sits inside it, moved by offX/offY in the CAMERA's plane: his crescent
//    stays under the head on SCREEN through roll 29 -> 0 and az -40 -> 49, it does not follow the chin. Done in the vertex shader.
//  - The hair is a polygon on the sphere, evaluated per pixel as a signed distance: sharp at any size, no texture. It stands proud of the
//    skin only at the silhouette (ink about .012 D beside hair, .04-.08 D beside skin), so its shell widens toward the limb only.
//  - The skin's edge is the ball's circle plus three lobes in the camera plane (P_LOBE, tools/head_inkfit.py): a circle can't give his crescent, heaviest straight down and fuller down-left.
//  - Hairline polygon: tools/head_poly2.py (each stretch from the frames that see it face on, corners kept); highlight: tools/head_hiarc.py. Don't rerun head_poly.py / head_hi.py / head_track.py over them.
//  - The skin's dark band is a limb band about a direction near the view, fixed in the CAMERA per shot: f0-60 down-left, f64-101 down-right.
//  - Hair: f61+ painted ramp fixed in character space (dark toward the back, lit toward the front); f0-60 his grade flattens it to a tint.
import * as THREE from './three.js';
import { loadTrack } from './tracks.js';

const DEF = {
  ballR: .46, sx: 1, sy: 1, offX: -.012, offY: .04, hairR: .484, hairOffX: -.006, hairOffY: .012,
  ink: 0x3a2a33, hairlineInk: .015, // width of the line along the hairline, D
  skinLit: 0xfcf7f4, skinDark: 0xeadde7,
  hairDark: 0x553622, hairLit: 0x905f38, hairHi: 0xd7ae8d, hairRim: 0xa7764f,
  litDir: [-.33, .35, .88],
};

const P_LOBE = ['.021', '.008', '-.006']; // D: down-left 137 deg, down-right 33 deg, straight down 95 deg (his heaviest ink)
const VERT = (shell) => `
uniform vec2 uOff; uniform vec3 uScale;
${shell ? 'uniform vec2 uOff2; uniform float uR2; varying float vPast;' : ''}
varying vec3 vDir; varying vec3 vCam;
float lobe(float th, float c, float s, float a) { float d = mod(th - c + 3.14159265, 6.2831853) - 3.14159265; return a * exp(-d * d / (s * s)); }
void main() {
  vDir = normalize(position);
  vCam = normalize(normalMatrix * position);
  vec4 mv = modelViewMatrix * vec4(position * uScale, 1.0);
  mv.xy += uOff;
  // his skin's edge is not a circle: measured against the circle over all gate frames (tools/head_inkfit.py), the same on every shot. Screen angle, clockwise from right.
  float wEdge = dot(vCam.xy, vCam.xy); wEdge *= wEdge;
  float th = atan(-vCam.y, vCam.x);
  mv.xy += vCam.xy * wEdge * (lobe(th, 2.391, .384, ${P_LOBE[0]}) + lobe(th, .576, .384, ${P_LOBE[1]}) + lobe(th, 1.658, .21, ${P_LOBE[2]}));
  ${shell ? `
  float w = dot(vCam.xy, vCam.xy); w *= w;
  vec2 mv0 = mv.xy; // the ball's point here
  mv.xy += (uOff2 - uOff) * w + vCam.xy * (uR2 - uScale.x) * w;
  mv.z += .004;
  vPast = length(mv.xy - mv0 + vCam.xy * uScale.x) / uScale.x;` : ''}
  gl_Position = projectionMatrix * mv;
}`;

// a polygon: chord distance to the edges in 3D, inside by crossings in the azimuthal map about uAxis
const FRAG = (n, nHi, shell) => `
#define N ${n}
#define NH ${nHi}
uniform vec3 uHair[N];
uniform vec3 uHiP[NH];
uniform vec3 uAxis, uE1, uE2, uDark, uSkinLit, uSkinDark, uHairDark, uHairLit, uInk, uHi, uRim, uLitDir;
uniform vec2 uDarkAB, uHairAB; uniform float uLine, uHiOn, uRimOn, uOnly; uniform mat3 uHairRot;
varying vec3 vDir; varying vec3 vCam;
${shell ? 'varying float vPast;' : ''}
vec2 mapOf(vec3 p) {
  float rho = acos(clamp(dot(p, uAxis), -1., 1.));
  vec2 t = vec2(dot(p, uE1), dot(p, uE2));
  float l = length(t);
  return l < 1e-5 ? vec2(0.) : t / l * rho;
}
float edge(vec3 p, vec3 a, vec3 b) {
  vec3 ab = b - a, ap = p - a;
  vec3 q = ap - ab * clamp(dot(ap, ab) / max(dot(ab, ab), 1e-9), 0., 1.);
  return dot(q, q);
}
bool crosses(vec2 m, vec2 mi, vec2 mj) {
  return (mi.y > m.y) != (mj.y > m.y) && m.x < (mj.x - mi.x) * (m.y - mi.y) / (mj.y - mi.y) + mi.x;
}
float sdHair(vec3 p) {
  vec2 m = mapOf(p), mj = mapOf(uHair[N - 1]);
  float d2 = 1e9; bool inside = false;
  vec3 a = uHair[N - 1];
  for (int i = 0; i < N; i++) {
    vec3 b = uHair[i];
    d2 = min(d2, edge(p, a, b));
    vec2 mi = mapOf(b);
    if (crosses(m, mi, mj)) inside = !inside;
    mj = mi; a = b;
  }
  return (inside ? 1. : -1.) * sqrt(d2);
}
float sdHi(vec3 p) {
  vec2 m = mapOf(p), mj = mapOf(uHiP[NH - 1]);
  float d2 = 1e9; bool inside = false;
  vec3 a = uHiP[NH - 1];
  for (int i = 0; i < NH; i++) {
    vec3 b = uHiP[i];
    d2 = min(d2, edge(p, a, b));
    vec2 mi = mapOf(b);
    if (crosses(m, mi, mj)) inside = !inside;
    mj = mi; a = b;
  }
  return (inside ? 1. : -1.) * sqrt(d2);
}
void main() {
  // p0 = the point in head space; p = the same point in the HAIR's frame (uHairRot, fix1: the hair follows the face's pitch lock, see hairFrame)
  vec3 p0 = normalize(vDir), p = normalize(uHairRot * p0), nc = normalize(vCam);
  float s = sdHair(p);
  float aa = max(fwidth(s), 1e-4);
  // The shell only carries the hair from the ball's limb out to where it stands proud: inside the ball's disc the ball paints everything, hairline included,
  // so there is one hairline, never a second one or a sliver of skin beside it. Past the limb there is no skin at all: hair, then the hull's ink.
  ${shell ? 'if (vPast < .93 || (vPast < .97 && s < uLine) || s < -uLine - aa || vCam.z < 0.) discard;' : ''}
  if (uOnly > .5 && (uOnly < 1.5 ? s < uLine : s > -uLine)) discard;
  vec3 skin = mix(uSkinLit, uSkinDark, smoothstep(uDarkAB.x, uDarkAB.y, dot(nc, uDark)));
  ${shell ? 'skin = uInk;' : ''}
  float t = dot(p, uLitDir);
  vec3 hair = mix(uHairDark, uHairLit, smoothstep(uHairAB.x, uHairAB.y, t));
  hair = mix(hair, uRim, uRimOn * smoothstep(.4, .56, t));
  if (uHiOn > .001) {
    float h = sdHi(p);
    float ah = max(fwidth(h), 1e-4);
    hair = mix(hair, uHi, uHiOn * smoothstep(-ah - .002, ah + .002, h));
  }
  vec3 col = mix(skin, hair, smoothstep(-aa, aa, s));
  col = mix(col, uInk, 1. - smoothstep(uLine - aa, uLine + aa, abs(s)));
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;

const FRAG_HULL = `
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, 1.);
  #include <colorspace_fragment>
}`;

export async function build(params = {}) {
  const { tracks, track: inline, ...own } = params;
  const P = { ...DEF, ...own };
  const track = await loadTrack(params, 'head', new URL('./headTrack.json', import.meta.url));
  const root = new THREE.Group(); root.name = 'head';
  const col = c => new THREE.Color(c);
  const v3 = a => a.map(v => new THREE.Vector3(...v));
  const hairV = v3(track.hair), hiV = v3(track.hi);
  const U = {
    uOff: { value: new THREE.Vector2(P.offX, P.offY) }, uScale: { value: new THREE.Vector3(P.ballR * P.sx, P.ballR * P.sy, P.ballR * P.sx) },
    uOff2: { value: new THREE.Vector2(P.hairOffX, P.hairOffY) }, uR2: { value: P.hairR },
    uHair: { value: hairV }, uHiP: { value: hiV },
    uAxis: { value: new THREE.Vector3(...track.axis) }, uE1: { value: new THREE.Vector3(...track.e1) }, uE2: { value: new THREE.Vector3(...track.e2) },
    uDark: { value: new THREE.Vector3(-.21, -.18, -.96).normalize() }, uDarkAB: { value: new THREE.Vector2(-.44, -.22) },
    uSkinLit: { value: col(P.skinLit) }, uSkinDark: { value: col(P.skinDark) },
    uHairDark: { value: col(P.hairDark) }, uHairLit: { value: col(P.hairLit) }, uHi: { value: col(P.hairHi) }, uRim: { value: col(P.hairRim) },
    uInk: { value: col(P.ink) }, uLine: { value: P.hairlineInk / (2 * P.ballR) }, uLitDir: { value: new THREE.Vector3(...P.litDir).normalize() },
    uHairRot: { value: new THREE.Matrix3() },
    uHiOn: { value: 0 }, uRimOn: { value: 0 }, uHairAB: { value: new THREE.Vector2(-.2, .4) }, uOnly: { value: P.only === 'hair' ? 1 : P.only === 'skin' ? 2 : 0 },
  };
  const geo = new THREE.SphereGeometry(1, 192, 128);
  const mat = shell => new THREE.ShaderMaterial({ vertexShader: VERT(shell), fragmentShader: FRAG(hairV.length, hiV.length, shell), uniforms: U });
  const ball = new THREE.Mesh(geo, mat(false)); ball.name = 'head.ball';
  const shell = new THREE.Mesh(geo, mat(true)); shell.name = 'head.hair';
  const hull = new THREE.Mesh(new THREE.SphereGeometry(.5, 192, 128), new THREE.ShaderMaterial({
    vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: FRAG_HULL, uniforms: { uColor: { value: col(P.ink) } }, side: THREE.BackSide,
  }));
  hull.name = 'head.hull';
  for (const m of [ball, shell, hull]) { m.userData.noOutline = true; m.frustumCulled = false; }
  if (!P.only) root.add(hull);
  root.add(ball, shell);
  root.userData.uniforms = U; root.userData.track = track; root.userData.params = P;
  root.userData.mount = {
    up: new THREE.Vector3(0, 1, 0), front: new THREE.Vector3(0, 0, 1), top: new THREE.Vector3(0, P.ballR * P.sy, 0),
    button: new THREE.Vector3(0, .607, .097), // his cap's button as one rigid point under the solved cameras, f0-95: rms .054 D
    ballR: P.ballR, hairR: P.hairR, viewOffset: new THREE.Vector2(P.offX, P.offY), // anything painted on the skin adds viewOffset (D units, camera x right, y up)
  };
  return root;
}

const lerp = (a, b, t) => a + (b - a) * t;
const nearestKey = (m, f) => { let best = null, bd = Infinity; for (const k in m) { const d = Math.abs(+k - f); if (d < bd) { bd = d; best = m[k]; } } return best; };
const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));

// ---------- fix1 2026-11-04: the hair follows the face's PITCH lock ----------
// The drawn face is locked to the camera's elevation (rules.js face pitch = -1 x el: it always sits mid-head on screen), but the hair was
// rigid on the sphere. So a head pitched chin-up (el -20 .. -30 in the head's frame: the shock recoil, a look up) rotated the hair over
// the crown and out of sight while the face stayed put (Mara / Dotty "lost" their hair in the cast sheet's angry row); chin-down slid the
// front hairline toward the brows. Now the hair is seen from an elevation that stays with the camera inside a dead zone (|el| <= HAIR_EL.a:
// every normal shot and the el 8 turnaround are pixel-identical) and beyond it only follows by HAIR_EL.s (+ a soft knee K): the rest is
// rotated away about the head's horizontal axis across the view, for the shell (uHairRot) AND every hair volume on the head (bun,
// ponytail, tufts, curls, back hair: children named 'hair.*' get the same rotation), so they never come apart. params.hairEl false = rigid.
// fix1b (same day): the partial follow (slope .15 past +-9) still thinned Mara's / Dotty's band to a rim at the shock recoil (el -25..-30).
// Now the hair FOLLOWS THE FACE FULLY outside the band [lo, hi]: the hair is always seen from an elevation inside it, so at any head pitch
// it covers the same part of the head relative to the face as in a level shot. Asymmetric on purpose: chin-up / a camera below the
// head (el < 0) is what rolls the band over the crown, so lo = 0 (every level or high shot unchanged: the sheet's el 4, the turnaround's
// el 8); hi = 9 keeps the turnaround. Soft knee K (C1 continuous, so a pitch move never pops): the seen el tends to lo - K / hi + K.
// Kit hats (follow 1, rigid on the head) take the same rotation in character.js, so a hat stays seated on the hair it covers.
export const HAIR_EL = { lo: 0, hi: 9, K: 2 };
export function hairEl(el, R = HAIR_EL) {
  if (el > R.hi) return R.hi + R.K * (1 - Math.exp(-(el - R.hi) / R.K));
  if (el < R.lo) return R.lo - R.K * (1 - Math.exp(-(R.lo - el) / R.K));
  return el;
}
const _hc = new THREE.Vector3(), _hk = new THREE.Vector3(), _hq = new THREE.Quaternion(), _hm = new THREE.Matrix4();
function hairFrame(root, camera, U, P, up) {
  let d = 0;
  if (camera && P.hairEl !== false) {
    camera.updateMatrixWorld(); root.updateMatrixWorld(true);
    _hc.setFromMatrixPosition(camera.matrixWorld); root.worldToLocal(_hc);
    const l = _hc.length();
    if (l > 1e-6) {
      const asinD = s => Math.asin(Math.max(-1, Math.min(1, s))) * 180 / Math.PI;
      const el = asinD(_hc.y / l), az = Math.atan2(_hc.x, _hc.z);
      // the shot's own elevation (camera above the head centre against WORLD up, character.js ctx.upHead): the hair is seen from it,
      // softly kept inside HAIR_EL. So the head's own pitch (el - shotEl) is cancelled in full, like the face's; without upHead
      // (a bare head in a lab) the head frame stands in for the world.
      const shotEl = up ? asinD((_hc.x * up.x + _hc.y * up.y + _hc.z * up.z) / l) : el;
      d = (el - hairEl(shotEl, P.hairElRule || HAIR_EL)) * Math.PI / 180;   // > 0: camera above the band, the hair turns up toward it
      _hk.set(-Math.cos(az), 0, Math.sin(az));                           // h x up: rotating about it lifts the view direction
    }
  }
  _hq.setFromAxisAngle(d ? _hk : _hk.set(1, 0, 0), d);
  for (const c of root.children) if (c.name.startsWith('hair.')) c.quaternion.copy(_hq);
  (root.userData.hairQ || (root.userData.hairQ = new THREE.Quaternion())).copy(_hq); // head space; character.js turns kit hats by it
  U.uHairRot.value.setFromMatrix4(_hm.makeRotationFromQuaternion(_hq.invert()));
}

export function update(frame, ctx) {
  const root = ctx?.root || this;
  const U = root.userData.uniforms, tr = root.userData.track, P = root.userData.params;
  if (U.uHairRot) hairFrame(root, ctx?.camera, U, P, ctx?.upHead);
  // per-frame values: track.frames["N"] = { shadeAngle, hairTint } (other shots, global N; nearest key), else the f0-108 arrays indexed by frame
  const fr = tr.frames ? (tr.frames[String(Math.round(frame))] || nearestKey(tr.frames, frame)) : null;
  const f0 = Math.max(0, Math.min((tr.shadeAngle?.length ?? 1) - 1, Math.round(frame)));
  // the light schedule below is the engineer's f0-108 one, keyed by frame; params.lookFrame evaluates it at a chosen frame instead
  const f = P.lookFrame ?? (fr ? Math.round(frame) : f0);
  const shadeAngle = fr?.shadeAngle ?? tr.shadeAngle[f0], hairTint = fr?.hairTint ?? tr.hairTint[f0];
  // skin band: a limb band about a direction near the view, its side measured per frame, f60-64 is where his light swaps sides
  const a = shadeAngle * Math.PI / 180, k = ramp(f, 60, 64);
  const lean = lerp(.277, .475, k); // sine of the tilt off the view axis
  U.uDark.value.set(Math.cos(a) * lean, -Math.sin(a) * lean, -Math.sqrt(1 - lean * lean));
  U.uDarkAB.value.set(lerp(-.44, -.32, k), lerp(-.22, -.1, k));
  // hair: f0-60 a flat tint with a little lift to the front, f61+ the painted ramp
  // the ramp itself is measured per span: f61-75 hard and bright (only the far side's sliver reaches it), f76-93 soft and low, f96+ soft and full
  const lit = ramp(f, 58, 62), ti = hairTint, srgb = new THREE.Color().setRGB(ti[0] / 255, ti[1] / 255, ti[2] / 255, THREE.SRGBColorSpace);
  const k1 = ramp(f, 75, 78), k2 = ramp(f, 93, 96);
  U.uHairAB.value.set(lerp(lerp(.3, -.15, k1), -.2, k2), lerp(lerp(.48, .3, k1), .42, k2));
  const hairLit = new THREE.Color(0xa7764f).lerp(new THREE.Color(0x745238), k1).lerp(new THREE.Color(P.hairLit), k2);
  U.uHairDark.value.copy(new THREE.Color(P.hairDark).lerp(srgb, 1 - lit));
  U.uHairLit.value.copy(hairLit.lerp(srgb.clone().multiplyScalar(1.22), 1 - lit));
  U.uRimOn.value = 0;
  U.uHiOn.value = ramp(f, 94, 96);
}
