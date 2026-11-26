// engine/rbx/mats.js (WP-C2): materials for the head, face, hair, hats and clothes details, lit by the SAME light record as the body
// (engine/rbx/shade.js makeLight, WP-C1): key and shadow as two colours, hemisphere fill, small plastic spec, rim only from behind.
// matFactory(L) -> material(hex, kind, { vertexColors, map, flat }) ; L null = MeshStandardMaterial (lab without the body shader).
// Every geometry that uses these needs an `ao` attribute: ensureAo(object) adds ao = 1 where it is missing.
import * as THREE from '../three.js';
import { partMaterial } from './shade.js';

// MATERIAL KINDS (data, shared with engine/rbx/shade.js, WP-CF1 reads it by name): how each kind of surface takes the SAME light.
//   spec / pow   highlight strength and tightness (cloth none, plastic small + tight, hair soft sheen)
//   soft         x the light's terminator width (cloth wraps light softly, plastic a crisper line)
//   bounce / bK  a warm bounce added on the shadow side (skin only: soft, a little warm)
//   top          lifts the colour where the normal points up (hair: the lit top of a two-tone chunk)
//   edge         thin highlight where the surface turns away from the view on the lit side (bevel edges catch light)
// Names map onto kinds with kindOf(name): 'head.skin' -> skin, 'shoes' -> plastic, 'print' -> cloth, unknown -> cloth.
export const KINDS = {
  skin:    { spec: .06, pow: 14, soft: 1.35, bounce: '#ff9a70', bK: .10, top: 0,   edge: .10 },
  cloth:   { spec: 0,   pow: 8,  soft: 1.6,  bounce: '#000000', bK: 0,   top: 0,   edge: .06 },
  plastic: { spec: .32, pow: 56, soft: 1.0,  bounce: '#000000', bK: 0,   top: 0,   edge: .14 },
  hair:    { spec: .14, pow: 22, soft: 1.25, bounce: '#000000', bK: 0,   top: .08, edge: .10 },
};
const ALIAS = { skin: 'skin', face: 'skin', neck: 'skin', hands: 'skin', hand: 'skin', cloth: 'cloth', print: 'cloth', torso: 'cloth', pants: 'cloth',
  legs: 'cloth', shins: 'cloth', arms: 'cloth', forearms: 'cloth', hat: 'cloth', shoes: 'plastic', shoe: 'plastic', sole: 'plastic', foot: 'plastic',
  plastic: 'plastic', metal: 'plastic', frame: 'plastic', helmet: 'plastic', button: 'plastic', badge: 'plastic', visor: 'plastic', hair: 'hair', brim: 'cloth' };
export function kindOf(name = '') {
  const n = String(name).toLowerCase().split('.').pop();
  if (ALIAS[n]) return ALIAS[n];
  return /skin|hand|face|neck/.test(n) ? 'skin' : /shoe|foot|sole|helmet|metal|frame|button|badge|visor/.test(n) ? 'plastic' : /hair/.test(n) ? 'hair' : 'cloth';
}
export function kindUniforms(name, THREE_ = THREE) {
  const k = KINDS[kindOf(name)];
  return { uKSpec: { value: k.spec }, uKPow: { value: k.pow }, uKSoft: { value: k.soft }, uKBounce: { value: new THREE_.Color(k.bounce) }, uKBounceK: { value: k.bK },
    uKTop: { value: k.top }, uKEdge: { value: k.edge } };
}

const VERT = `
attribute float ao;
varying vec3 vN; varying vec3 vW; varying float vAo; varying vec3 vC; varying vec2 vUv;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vAo = ao;
  #ifdef USE_VC
  vC = color;
  #else
  vC = vec3(1.0);
  #endif
  #ifdef USE_TEX
  vUv = uv;
  #endif
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FRAG = `
uniform vec3 uCol; uniform vec3 uDir, uKey, uShadow, uSky, uGround, uRim; uniform float uRimK, uSoft, uSpec, uFlat;
uniform float uKSpec, uKPow, uKSoft, uKBounceK, uKTop, uKEdge; uniform vec3 uKBounce;
#ifdef USE_TEX
uniform sampler2D uMap;
#endif
varying vec3 vN; varying vec3 vW; varying float vAo; varying vec3 vC; varying vec2 vUv;
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vW), L = normalize(uDir);
  if (dot(N, V) < 0.0) N = -N;           // by the view, not the winding: the face decal's triangles wind either way (it was lit as its own back: grey-lilac whites)
  float nl = dot(N, L);
  float sw = uSoft * uKSoft;
  float lit = smoothstep(-sw, sw, nl);
  vec3 fill = mix(uGround, uSky, N.y * .5 + .5);
  vec3 light = mix(uShadow * fill, uKey, lit);
  light *= mix(.9, 1.0, smoothstep(0.0, 1.0, nl));
  light += uKBounce * uKBounceK * (1.0 - lit);
  light *= 1.0 + uKTop * smoothstep(.3, .9, N.y);
  vec3 base = uCol * vC;
  #ifdef USE_TEX
  vec4 t = texture2D(uMap, vUv);
  if (t.a < .5) discard;
  base *= t.rgb;
  #endif
  vec3 c = base * mix(light, vec3(1.0), uFlat) * vAo;
  vec3 H = normalize(L + V);
  c += uKey * uKSpec * pow(max(dot(N, H), 0.0), uKPow) * lit * (1.0 - uFlat);
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0), back = smoothstep(.1, .6, -dot(V, L));
  c += uKey * uKEdge * smoothstep(.55, .9, 1.0 - max(dot(N, V), 0.0)) * lit * (1.0 - uFlat);
  c = min(c, vec3(.96));
  c += uRim * uRimK * fr * back;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

export function matFactory(L) {
  return (hex, kind = 'cloth', o = {}) => {
    if (!L) {
      const m = new THREE.MeshStandardMaterial({ color: hex, roughness: kind === 'skin' ? .6 : .72, metalness: 0, vertexColors: !!o.vertexColors, map: o.map || null, alphaTest: o.map ? .5 : 0, side: o.side ?? THREE.FrontSide });
      if (o.polygonOffset) Object.assign(m, { polygonOffset: true, polygonOffsetFactor: o.polygonOffset, polygonOffsetUnits: o.polygonOffset });
      return m;
    }
    if (!o.vertexColors && !o.map && !o.polygonOffset && !o.flat) return partMaterial(THREE, hex, L, { name: kind });
    const defines = {}; if (o.vertexColors) defines.USE_VC = ''; if (o.map) defines.USE_TEX = '';
    const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, defines, vertexColors: !!o.vertexColors, side: o.side ?? THREE.FrontSide,
      uniforms: { uCol: { value: new THREE.Color(hex) }, uFlat: { value: o.flat ?? 0 }, ...(o.map ? { uMap: { value: o.map } } : {}), ...L, ...kindUniforms(kind) } });
    m.name = m.name || String(kind);
    if (o.polygonOffset) Object.assign(m, { polygonOffset: true, polygonOffsetFactor: o.polygonOffset, polygonOffsetUnits: o.polygonOffset });
    m.userData.setColour = h => m.uniforms.uCol.value.set(h);
    return m;
  };
}
export function ensureAo(obj, fn) {
  obj.traverse(o => {
    const g = o.geometry; if (!g || !g.attributes?.position || g.attributes.ao) return;
    const n = g.attributes.position.count, a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = fn ? fn(g.attributes.position, i, o) : 1;
    g.setAttribute('ao', new THREE.BufferAttribute(a, 1));
  });
}
