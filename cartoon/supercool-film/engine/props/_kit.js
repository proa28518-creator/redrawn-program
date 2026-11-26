// props/_kit.js: shared helpers for free-pose props (engine/props/<kind>.js loaded by lab/film/props.js makeProp). Not a kind.
// His look: flat fills, one hard shade (lit / dark split on the sun side), the engine's ink outline (shade.js outline), units D (head = 1).
//   flat(lit, dark?)           ShaderMaterial, two tones, hard edge; dark defaults to lit * .72. opts.side for DoubleSide.
//   basic(color)               unlit fill (labels, glass glints, print)
//   part(geo, mat, w = .025)   mesh + ink outline (width in D)
//   canvasTex(w, h, draw)      CanvasTexture from draw(ctx, w, h) (sRGB)
//   sideOf(o)                  'R' | 'L' from o.side or o.in ('hand:L' -> 'L'); props mirror their grip for the left hand
//   finish(g, sockets)         userData.sockets + no frustum culling; returns g
//   hangDown(obj)              keeps obj's local -Y pointing at world -Y whatever the prop's rotation (fishing line, plumb things)
import * as THREE from '../three.js';
import { outline } from '../shade.js';

export { THREE };
export const INK = 0x3a2a33;
const VERT = `varying vec3 vN; void main() { vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `uniform vec3 cLit, cDark; varying vec3 vN;
void main() { vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n; float k = dot(n, normalize(vec3(-.55, .7, .45)));
  gl_FragColor = vec4(mix(cDark, cLit, smoothstep(-.04, .04, k)), 1.0);
#include <colorspace_fragment>
}`;
export function flat(lit, dark, o = {}) {
  const a = new THREE.Color(lit), b = dark != null ? new THREE.Color(dark) : a.clone().multiplyScalar(.72);
  return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: o.double ? THREE.DoubleSide : THREE.FrontSide,
    uniforms: { cLit: { value: a }, cDark: { value: b } } });
}
export const basic = (color, o = {}) => new THREE.MeshBasicMaterial({ color, side: o.double ? THREE.DoubleSide : THREE.FrontSide, ...(o.map ? { map: o.map } : {}) });
export function part(geo, mat, w = .025) { const m = new THREE.Mesh(geo, mat); if (w > 0) outline(m, { width: w, color: INK }); return m; }
export function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
export const sideOf = o => (o.side || (String(o.in || '').endsWith(':L') ? 'L' : 'R')).toUpperCase();
export function finish(g, sockets = {}) {
  g.userData.sockets = { grip: [0, 0, 0], ...sockets };
  g.traverse(m => { m.frustumCulled = false; });
  return g;
}
const _q = new THREE.Quaternion();
export function hangDown(obj) {
  obj.updateMatrixWorld = function (force) {
    if (this.parent) { this.parent.getWorldQuaternion(_q); this.quaternion.copy(_q).invert(); }
    THREE.Object3D.prototype.updateMatrixWorld.call(this, true);
  };
  return obj;
}
// a seeded random (props are pure: same opts -> same prop)
export function rng(seed = 1) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
