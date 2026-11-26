// world/look/dust.js: fine dust in the air. One Points draw, positions computed in the vertex shader from a seed and t (no state), wrapped in a box that
// follows the camera but is anchored in the world, so a particle stays where it is while the camera moves. Brightness from the panels (brAir): it catches
// light near them and is gone in the dark between. Out of focus it grows into a soft disc by its own circle of confusion, dimmer as it grows.
// Drawn last, over the characters too, with the real depth test (so walls and bodies hide what is behind them). Additive, in display space.
import { LIGHT_GLSL } from './light.glsl.js';

const VERT = /* glsl */`
attribute vec4 aSeed;
uniform float uT, uFocus, uAp, uPxK, uMaxPx, uSizeK;
uniform vec3 uCenter, uBox;
varying float vA;
${LIGHT_GLSL}
void main() {
  float t = uT, a = aSeed.w * 6.283;
  vec3 drift = vec3(sin(t * (.11 + aSeed.x * .1) + a) * .42 + t * (aSeed.y - .5) * .05,
                    sin(t * (.08 + aSeed.y * .08) + a * 2.) * .28 - t * (.015 + aSeed.z * .02),
                    cos(t * (.09 + aSeed.z * .09) + a * 3.) * .42 + t * (aSeed.x - .5) * .05);
  vec3 p = aSeed.xyz * uBox + drift;
  p.xz = mod(p.xz - uCenter.xz + uBox.xz * .5, uBox.xz) + uCenter.xz - uBox.xz * .5;
  p.y = mod(p.y, 4.96);
  vec2 e = uBox.xz * .5 - abs(p.xz - uCenter.xz);
  float edge = smoothstep(0., 2., e.x) * smoothstep(0., 2., e.y);
  vec4 mv = viewMatrix * vec4(p, 1.); float z = -mv.z;
  gl_Position = projectionMatrix * mv;
  float coc = uAp * abs(z - uFocus) / max(z, .5) * pow(8. / max(uFocus, 4.), .5);
  coc = min(coc, uMaxPx);
  float r0 = (.0045 + .006 * aSeed.y * aSeed.y) * uPxK / max(z, .5) * uSizeK;     // radius in px, in focus
  r0 = max(r0, 1.1);
  float rr = r0 + coc;
  gl_PointSize = rr * 2.;
  float tw = .55 + .45 * sin(t * (1.1 + aSeed.z * 2.2) + a * 5.);                  // a flake turning in the light
  float light = brAir(p);
  float k = r0 / rr;
  vA = edge * smoothstep(1.6, 3.4, z) * (.02 + light * 1.7) * tw * (.35 + .65 * aSeed.x) * k * k * exp(-z * .035);
}`;
const FRAG = /* glsl */`
uniform vec3 uColor; varying float vA;
void main() { float r = length(gl_PointCoord - .5) * 2.; float a = smoothstep(1., .55, r); gl_FragColor = vec4(uColor * vA * a, 1.); }`;

export function makeDust(THREE, { count = 2600, box = [15, 5, 30], color = [1, .97, .8], seed = 41 } = {}) {
  const R = (s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(seed);
  const seeds = new Float32Array(count * 4), pos = new Float32Array(count * 3);
  for (let i = 0; i < count * 4; i++) seeds[i] = R();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const U = { uT: { value: 0 }, uFocus: { value: 8 }, uAp: { value: 30 }, uPxK: { value: 4158 }, uMaxPx: { value: 26 }, uSizeK: { value: 1 }, uCenter: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(...box) },
    uFlick: { value: 1 }, uColor: { value: new THREE.Vector3(...color) }, uWrap: { value: new THREE.Vector2(1, 0) }, uFall: { value: 1 }, uLeak: { value: 0 } };
  const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U, transparent: true, depthWrite: false, depthTest: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
  const points = new THREE.Points(g, m); points.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(points);
  const fwd = new THREE.Vector3();
  return { scene, uniforms: U, update(t, camera, focus, aperturePx, H, flick, maxPx) {
    U.uT.value = t; U.uFocus.value = focus; U.uAp.value = aperturePx; U.uFlick.value = flick; U.uMaxPx.value = maxPx;
    U.uPxK.value = H / (2 * Math.tan(camera.fov * Math.PI / 360));
    camera.getWorldDirection(fwd); U.uCenter.value.copy(camera.position).addScaledVector(fwd, box[2] * .36); U.uCenter.value.y = 2.5;
  } };
}
