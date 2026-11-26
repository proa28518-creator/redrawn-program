// engine/rbx/shade.js: the shader for the Roblox character's real 3D parts (WP-C1, 2026-11-12; WP-CF1 material kinds + edge light).
// The charsys shading pass (charshade.js / rigshade.js) shades 2.5D drawings in screen space; it cannot shade real parts. This keeps
// its rules: key and shadow are TWO colours (a soft terminator, no gradient mush), the light comes from the set (worldSet.lightDir),
// a hemisphere fill keeps the shadow side coloured (never black), a thin rim only when the key is behind, baked vertex AO (attribute
// `ao`) darkens joints and under the head. No time input: nothing here can flicker.
// CF1: every material takes a KIND (mats.js KINDS, read by name through kindUniforms: skin / cloth / plastic / hair):
//   spec + pow (highlight), soft (x terminator width), bounce (warm shadow-side bounce, skin), top (lit top, hair), edge (bevel light).
//   The body's slabs carry a baked `edge` attribute (1 mid-bevel and on small corners, 0 on faces): a thin highlight on every block
//   edge, strongest on the lit side. Geometry without it (head, hair) gets a narrow view-grazing term instead. Output is capped below
//   white (no clipping, no bloom).
//   const L = makeLight(THREE, opts)       one light record shared by every part of a character (uniform objects)
//   partMaterial(THREE, colour, L, opts)   -> ShaderMaterial; .userData.setColour(hex); opts.kind (or opts.name) picks the kind
//   setLight(L, { dir, key, shadow, sky, ground, rim, rimK })   change it later (shade passes per place)
import * as THREE0 from '../three.js';
import * as MATS from './mats.js';

export function makeLight(THREE = THREE0, o = {}) {
  const v = d => new THREE.Vector3(...d).normalize();
  return {
    uDir: { value: v(o.dir || [-.45, .8, .55]) },           // direction TO the key light, world
    uKey: { value: new THREE.Color(o.key || '#fff6ea') },     // light colour on the lit side (multiplies the part colour)
    uShadow: { value: new THREE.Color(o.shadow || '#8f93b8') }, // the shadow side's colour (cool, light: high key)
    uSky: { value: new THREE.Color(o.sky || '#ffffff') },     // fill from above
    uGround: { value: new THREE.Color(o.ground || '#d9c7b0') }, // bounce from below (warm)
    uRim: { value: new THREE.Color(o.rim || '#ffffff') },
    uRimK: { value: o.rimK ?? .35 },
    uSoft: { value: o.soft ?? .16 },                          // terminator width (in N.L)
    uSpec: { value: o.spec ?? .10 },                          // a small soft plastic highlight (x the kind's spec / .1)
  };
}
export function setLight(L, o = {}) {
  if (o.dir) L.uDir.value.set(...o.dir).normalize();
  for (const k of ['key', 'shadow', 'sky', 'ground', 'rim']) if (o[k]) L['u' + k[0].toUpperCase() + k.slice(1)].value.set(o[k]);
  if (o.rimK != null) L.uRimK.value = o.rimK;
  if (o.soft != null) L.uSoft.value = o.soft;
  if (o.spec != null) L.uSpec.value = o.spec;
}

// the kinds if mats.js is missing or older (same numbers as its KINDS)
const KINDS0 = {
  skin:    { spec: .06, pow: 14, soft: 1.35, bounce: '#ff9a70', bK: .10, top: 0,   edge: .10 },
  cloth:   { spec: 0,   pow: 8,  soft: 1.6,  bounce: '#000000', bK: 0,   top: 0,   edge: .06 },
  plastic: { spec: .32, pow: 56, soft: 1.0,  bounce: '#000000', bK: 0,   top: 0,   edge: .14 },
  hair:    { spec: .14, pow: 22, soft: 1.25, bounce: '#000000', bK: 0,   top: .08, edge: .10 },
};
function kindU(THREE, name) {
  try { if (typeof MATS.kindUniforms === 'function') return MATS.kindUniforms(name, THREE); } catch { /* fall through */ }
  const n = String(name || '').toLowerCase();
  const k = KINDS0[/skin|hand|face|neck/.test(n) ? 'skin' : /shoe|foot|sole|plastic/.test(n) ? 'plastic' : /hair/.test(n) ? 'hair' : 'cloth'];
  return { uKSpec: { value: k.spec }, uKPow: { value: k.pow }, uKSoft: { value: k.soft }, uKBounce: { value: new THREE.Color(k.bounce) }, uKBounceK: { value: k.bK },
    uKTop: { value: k.top }, uKEdge: { value: k.edge } };
}

const VERT = `
attribute float ao;
attribute float edge;
varying vec3 vN; varying vec3 vW; varying float vAo; varying vec3 vC; varying float vE;
void main() {
  vC = vec3(1.0);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  #ifdef NO_AO
  vAo = 1.0;
  #else
  vAo = ao;
  #endif
  #ifdef USE_EDGE
  vE = edge;
  #else
  vE = 0.0;
  #endif
  #ifdef USE_COLOR
  vC = color;
  #endif
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FRAG = `
uniform vec3 uCol; uniform vec3 uDir, uKey, uShadow, uSky, uGround, uRim; uniform float uRimK, uSoft, uSpec;
uniform float uKSpec, uKPow, uKSoft, uKBounceK, uKTop, uKEdge; uniform vec3 uKBounce;
varying vec3 vN; varying vec3 vW; varying float vAo; varying vec3 vC; varying float vE;
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vW), L = normalize(uDir);
  float nl = dot(N, L), sw = uSoft * uKSoft;
  float lit = smoothstep(-sw, sw, nl);                              // two colours, a soft line between (wider for cloth)
  vec3 fill = mix(uGround, uSky, N.y * .5 + .5);
  vec3 sh = uShadow * fill + uKBounce * uKBounceK * (1.0 - lit);     // skin: a little warm bounce in the shadow side
  vec3 light = mix(sh, uKey, lit);
  light *= mix(.9, 1.0, smoothstep(0.0, 1.0, nl));                    // a little form on the lit side, not a gradient
  light *= 1.0 + uKTop * smoothstep(.2, .9, N.y);                     // hair: the lit top of a chunk
  float ao = vAo;
  vec3 base = uCol * vC;
  vec3 c = base * light * ao;
  vec3 H = normalize(L + V);
  c += uKey * (uSpec * 10.0 * uKSpec) * pow(max(dot(N, H), 0.0), uKPow) * lit * ao;
  // edge light: the baked bevel band (body) or a narrow grazing band (head, hair), lit side strongest, a hint on the shadow side
  float nv = max(dot(N, V), 0.0);
  float e = max(vE, .55 * smoothstep(.62, .92, 1.0 - nv));
  c += mix(base, vec3(1.0), .55) * uKey * (uKEdge * 1.8) * e * (.3 + .7 * lit) * ao;
  float fr = pow(1.0 - nv, 3.0), back = smoothstep(.1, .6, -dot(V, L));
  c += uRim * uRimK * fr * back;
  c = min(c, vec3(.94));                                             // never clipped (skin luma stays under 235)
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

export function partMaterial(THREE = THREE0, colour, L, o = {}) {
  // o.noAo: geometry without an `ao` attribute (the head, hair); o.vc: vertex colours (the face decal); o.offset: polygon offset factor
  // o.kind: skin / cloth / plastic / hair or a part name (mats.js kindOf); o.noEdge: geometry without an `edge` attribute
  const defines = {}; if (o.noAo) defines.NO_AO = ''; if (!o.noAo && !o.noEdge) defines.USE_EDGE = '';
  const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, defines, vertexColors: !!o.vc,
    uniforms: { uCol: { value: new THREE.Color(colour) }, ...L, ...kindU(THREE, o.kind ?? o.name) } });
  if (o.offset) { m.polygonOffset = true; m.polygonOffsetFactor = o.offset; m.polygonOffsetUnits = o.offset; }
  m.userData.setColour = h => m.uniforms.uCol.value.set(h);
  if (o.name) m.name = o.name;
  return m;
}

export default { makeLight, setLight, partMaterial };
