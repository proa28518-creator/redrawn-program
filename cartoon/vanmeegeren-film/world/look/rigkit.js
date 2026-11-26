// world/look/rigkit.js: the parts of a set that read lights from data (world/look/lights.js): surface material, water, sky dome, decals, placed sprites. No set is known here.
// Everything writes plain display numbers, like the characters (no look pipeline). Lighting is done in linear inside the shader, so pools of light fall off the way light does.
import { LIGHTS_GLSL } from './lights.js';

const hex = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const VERT = /* glsl */`varying vec3 vW; varying vec3 vN; varying vec2 vUv;
void main() { vec4 lp = vec4(position, 1.); vec3 ln = normal;
#ifdef USE_INSTANCING
  lp = instanceMatrix * lp; ln = mat3(instanceMatrix) * ln;
#endif
  vec4 w = modelMatrix * lp; vW = w.xyz; vN = normalize(mat3(modelMatrix) * ln); vUv = uv; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SHADOW = /* glsl */`uniform sampler2D uShadowMap; uniform mat4 uShadowMatrix; uniform float uShadowOn, uShadowTexel, uShadowSoft, uShadowBias;
float shadowAt(vec3 p, vec3 n) { if (uShadowOn < .5) return 0.;
  vec4 c = uShadowMatrix * vec4(p + n * .04, 1.); vec3 s = c.xyz / c.w * .5 + .5;
  if (s.x < 0. || s.x > 1. || s.y < 0. || s.y > 1. || s.z > 1.) return 0.; float sh = 0.;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) { float d = texture2D(uShadowMap, s.xy + vec2(float(i), float(j)) * uShadowTexel * uShadowSoft).r; sh += s.z - uShadowBias > d ? 1. : 0.; }
  return sh / 9.; }`;
// a soft shoulder, so a hot spot rolls off instead of clipping to flat white
const OUT = /* glsl */`vec3 rigOut(vec3 c) { vec3 x = max(c - .7, 0.); c = min(c, vec3(.7)) + .3 * (1. - exp(-x / .3)); return pow(max(c, 0.), vec3(1. / 2.2)); }`;
// uUvMode 0 mesh uv * tile (the previz), 1 world xz / tile, 2 world zy / tile, 3 world xy / tile, 4 mesh uv / tile (Blender's: 1 UV = 1 D)
const SURF_F = /* glsl */`uniform vec3 uColor; uniform sampler2D uMap; uniform float uHasMap, uUvMode, uBump, uGloss, uSpec, uWet, uGrime, uEmit, uAo, uNear; uniform vec2 uTile, uScroll;
${LIGHTS_GLSL}
${SHADOW}
${OUT}
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
vec3 bumped(vec3 n, float h) { vec3 sx = dFdx(vW), sy = dFdy(vW), r1 = cross(sy, n), r2 = cross(n, sx); float det = dot(sx, r1);
  vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2); return normalize(abs(det) * n - g); }
void main() { if (uNear > 0.) { float dn = length(cameraPosition - vW), dd = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))); if (dn < uNear * (.55 + .45 * dd)) discard; }   // small things a flying camera passes: they dissolve rather than fill the frame
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec2 uv = uUvMode < .5 ? vUv * uTile : uUvMode < 1.5 ? (vW.xz + uScroll) / uTile : uUvMode < 2.5 ? vec2(vW.z, vW.y) / uTile : uUvMode < 3.5 ? vec2(vW.x, vW.y) / uTile : vUv / uTile;
  vec3 tx = uHasMap > .5 ? texture2D(uMap, uv).rgb : vec3(1.); float lum = dot(tx, vec3(.3, .5, .2));
  // large slow stains in the shader, so no two stretches match and the tile never shows. q: a coordinate along the surface, whatever its direction
  vec2 q = abs(n.y) > .7 ? vW.xz : vec2(vW.x + vW.z, vW.y * 1.6);
  float big = rigN(q * .31 + 3.7) * .6 + rigN(q * .93 + 11.3) * .28 + rigN(q * 3.1) * .12;
  vec3 base = uColor * tx * (1. - uGrime + uGrime * 1.5 * smoothstep(.25, .72, big));
  vec3 lin = pow(base, vec3(2.2));
  vec3 v = normalize(cameraPosition - vW);
  float bd = uBump / (1. + .012 * dot(cameraPosition - vW, cameraPosition - vW));
  vec3 nb = bd > .002 ? bumped(n, lum * bd) : n;
  // wet and oily: a mask that says where it shines; the shine itself is tinted a little by the stain under it
  float wet = smoothstep(.42, .66, rigN(q * .55 + 21.) * .7 + rigN(q * 2.3 + 5.) * .3);
  vec3 diff, spec; rigLight(vW, nb, v, uGloss, diff, spec);
  float ao = 1. - uAo * (1. - rigAo(vW));
  vec3 c = lin * diff * ao * (1. - .62 * shadowAt(vW, n)) + spec * uSpec * mix(1. - uWet, 1. + uWet, wet) * (.45 + .55 * lum) * mix(vec3(1.), vec3(.85, .95, 1.15), wet * uWet);
  c += lin * uEmit;
  gl_FragColor = vec4(rigFog(rigOut(c), vW), 1.); }`;
// water: normals from a few moving waves + fine noise, fresnel between the deep colour and the sky it reflects, the lights' glints on top, foam where the crests break
const WATER_F = /* glsl */`uniform vec3 uDeep, uSkyA, uSkyB; uniform float uChop, uFoam, uScale; uniform sampler2D uMap;
${LIGHTS_GLSL}
${OUT}
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
float h(vec2 p, float t) { return sin(p.x * .31 + p.y * .13 + t * 1.1) * .5 + sin(p.x * -.17 + p.y * .41 + t * .9) * .5 + sin(p.x * .71 + p.y * .37 - t * 1.7) * .22 + sin(p.x * -.53 + p.y * .97 + t * 2.1) * .14 + (rigN(p * 1.3 + t * .6) - .5) * .5 + (rigN(p * 3.7 - t * .9) - .5) * .22; }
void main() { vec2 p = vW.xz * uScale; float t = uRTime, e = .12, h0 = h(p, t);
  vec3 n = normalize(vec3(-(h(p + vec2(e, 0.), t) - h0) / e * uChop, 1., -(h(p + vec2(0., e), t) - h0) / e * uChop));
  vec3 v = normalize(cameraPosition - vW); float d = length(cameraPosition - vW);
  n = normalize(mix(n, vec3(0., 1., 0.), smoothstep(30., 150., d) * .7));
  float fr = .03 + .97 * pow(1. - max(dot(n, v), 0.), 5.);
  vec3 r = reflect(-v, n), sky = mix(uSkyB, uSkyA, clamp(r.y * 1.6, 0., 1.));
  vec3 diff, spec; rigLight(vW, n, v, 180., diff, spec);
  vec3 c = mix(uDeep * (.5 + .9 * smoothstep(-1., 1.2, h0)) * diff, sky, fr) + spec * .7;
  float foam = smoothstep(1. - uFoam, 1.25, h0 * .55 + rigN(p * .9 + t * .3) * .5 + .1) * texture2D(uMap, vW.xz * .07).r;
  c = mix(c, vec3(.8, .86, .9) * (diff * .75 + .05), clamp(foam, 0., 1.) * .75);
  gl_FragColor = vec4(rigFog(rigOut(c), vW), 1.); }`;
const SKY_V = /* glsl */`varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
// the sky: a gradient, fbm clouds lit from the sun's side, a glow where the sun sits, lightning from behind the clouds. All data
const SKY_F = /* glsl */`uniform vec3 uTop, uHor, uLow, uCloudA, uCloudB, uSunDir, uSunC; uniform float uCover, uCloudScale, uFlash, uT, uSunGlow, uHasMap, uMapGain; uniform sampler2D uMap;
varying vec3 vD;
float H(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float N(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(H(i), H(i + vec2(1., 0.)), f.x), mix(H(i + vec2(0., 1.)), H(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p) { float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * N(p); p = p * 2.03 + 17.; a *= .5; } return s; }
void main() { vec3 d = normalize(vD); float y = d.y;
  vec3 c = y > 0. ? mix(uHor, uTop, pow(clamp(y * 1.8, 0., 1.), .7)) : mix(uHor, uLow, clamp(-y * 6., 0., 1.));
  if (uHasMap > .5 && y > -.02) { vec3 m = texture2D(uMap, vec2(atan(d.x, d.z) / 3.14159265 + uT * .0006, clamp(y / .62, .0, .995))).rgb * uMapGain; c = mix(c, m, smoothstep(.98, .72, y / .62) * smoothstep(-.02, .015, y)); c += vec3(.75, .8, 1.) * uFlash * m * 2.2; }
  float sun = max(dot(d, uSunDir), 0.); c += uSunC * (pow(sun, 6.) * .35 + pow(sun, 60.) * .5) * uSunGlow;
  if (uCover > 0. && y > -.05) { vec2 q = d.xz / (max(y, 0.) + .22) * uCloudScale + vec2(uT * .03, uT * .012);
    float f = fbm(q), g = fbm(q + vec2(.22, .1) * normalize(uSunDir.xz + .001)), m = smoothstep(1. - uCover, 1.02 - uCover * .6, f);
    vec3 cl = mix(uCloudB, uCloudA, clamp((f - g) * 4. + .5, 0., 1.));
    c = mix(c, cl, m * smoothstep(-.05, .1, y));
    c += vec3(.75, .8, 1.) * uFlash * (m * .6 + .1) * (.5 + .9 * fbm(q * .4 + 40.)); }
  gl_FragColor = vec4(c, 1.); }`;
const DECAL_V = /* glsl */`attribute vec2 aCell; attribute float aAlpha; uniform float uGrid; uniform vec4 uBend; varying vec2 vUv; varying float vA; varying vec3 vW;
void main() { vUv = (uv * .96 + .02 + aCell) / uGrid; vA = aAlpha;
  vec4 lp = instanceMatrix * vec4(position, 1.);
  if (uBend.z > 0.) { vec2 d = lp.xy - uBend.xy; lp.xy = uBend.xy + normalize(d) * (uBend.z + uBend.w); }   // a cylinder along z: the quad follows the curve instead of cutting through it
  vec4 w = modelMatrix * lp; vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const DECAL_F = /* glsl */`uniform sampler2D uMap; uniform float uGain, uRFog; varying vec2 vUv; varying float vA; varying vec3 vW;
void main() { vec4 t = texture2D(uMap, vUv); float a = t.a * vA; if (a < .004) discard; float f = exp(-pow(length(cameraPosition - vW) * uRFog, 1.4));
  gl_FragColor = vec4(mix(vec3(1.), t.rgb, min(a * uGain, 1.) * f), 1.); }`;   // darkens only: surface * mix(1, rgb, a)
const SPRITE_V = /* glsl */`attribute vec3 aPos; attribute vec4 aS; attribute vec3 aFace; varying vec3 vW; varying vec2 vUv; varying vec3 vR; varying vec3 vF; varying float vFade; uniform float uTs;
void main() { vec3 tc = cameraPosition - aPos; tc.y = 0.; vec3 f = normalize(tc + vec3(.0001, 0., 0.));
  if (aFace.z > 0.) { vec3 n = vec3(aFace.x, 0., aFace.y); float c = dot(f, n); if (c < aFace.z) { vec3 side = normalize(f - n * c + vec3(.0001, 0., .0001)); f = n * aFace.z + side * sqrt(1. - aFace.z * aFace.z); } }
  vec3 r = vec3(f.z, 0., -f.x); float y = aS.w > .5 ? position.y - .5 : position.y + .5;
  float sway = aS.w > .5 ? (1. - uv.y) * (1. - uv.y) * sin(uTs * .7 + aPos.x * 3.1 + aPos.z * 1.7) * .05 : 0.;
  vec3 w = aPos + r * (position.x * aS.x * aS.z + sway) + vec3(0., y * aS.y, 0.);
  vW = w; vR = r; vF = f; vUv = uv; vFade = smoothstep(1.1, 2.4, length(cameraPosition - aPos)); gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.); }`;
const SPRITE_F = /* glsl */`uniform sampler2D uMap; uniform vec3 uTint; uniform float uDesat;
${LIGHTS_GLSL}
${OUT}
varying vec3 vW; varying vec2 vUv; varying vec3 vR; varying vec3 vF; varying float vFade;
void main() { vec4 t = texture2D(uMap, vUv); float dith = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))); if (t.a < .5 || vFade < dith) discard;
  vec3 rgb = t.rgb / max(t.a, .03); rgb *= mix(.5, 1., smoothstep(.5, .95, t.a)); rgb = mix(rgb, vec3(dot(rgb, vec3(.3, .5, .2))), uDesat);
  vec3 n = normalize(vR * (vUv.x - .5) * 1.3 + vec3(0., .45 + .5 * (vUv.y - .5), 0.) + vF * .8); vec3 d, s; rigLight(vW, n, vF, 0., d, s);
  gl_FragColor = vec4(rigFog(rigOut(pow(rgb * uTint, vec3(2.2)) * d), vW), 1.); }`;

export function createKit(THREE, rig, { shadow = {}, group }) {
  const fragOf = (fs, name) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: fs, side: THREE.DoubleSide, uniforms: { ...shadow, ...rig.uniforms(name) } });
  // o: { map, tile [u,v], uv (mode), bump, gloss, spec, wet, grime, emit, ao, scroll (uniform) }
  const surface = (place, color, o = {}) => { const m = fragOf(SURF_F, place);
    Object.assign(m.uniforms, { uColor: { value: new THREE.Vector3(...(Array.isArray(color) ? color : hex(color))) }, uMap: { value: o.map || null }, uHasMap: { value: o.map ? 1 : 0 }, uUvMode: { value: o.uv ?? 0 }, uTile: { value: new THREE.Vector2(...(o.tile || [1, 1])) }, uScroll: o.scroll || { value: new THREE.Vector2() },
      uBump: { value: o.bump ?? 0 }, uGloss: { value: o.gloss ?? 0 }, uSpec: { value: o.spec ?? 0 }, uWet: { value: o.wet ?? 0 }, uGrime: { value: o.grime ?? 0 }, uEmit: { value: o.emit ?? 0 }, uAo: { value: o.ao ?? 1 }, uNear: { value: o.near ?? 0 } });
    return m; };
  const water = (place, o) => { const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: WATER_F, side: THREE.DoubleSide, uniforms: { ...rig.uniforms(place), uDeep: { value: new THREE.Vector3(...o.deep) }, uSkyA: { value: new THREE.Vector3(...o.skyTop) }, uSkyB: { value: new THREE.Vector3(...o.skyHor) }, uChop: { value: o.chop ?? .4 }, uFoam: { value: o.foam ?? .2 }, uScale: { value: o.scale ?? 1 }, uMap: { value: o.map } } }); return m; };
  const sky = (x, z, r, o) => { const u = { uTop: { value: new THREE.Vector3() }, uHor: { value: new THREE.Vector3() }, uLow: { value: new THREE.Vector3() }, uCloudA: { value: new THREE.Vector3() }, uCloudB: { value: new THREE.Vector3() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunC: { value: new THREE.Vector3() }, uCover: { value: 0 }, uCloudScale: { value: 1 }, uFlash: { value: 0 }, uT: { value: 0 }, uSunGlow: { value: 1 }, uMap: { value: null }, uHasMap: { value: 0 }, uMapGain: { value: 1 } };
    const set = s => { u.uTop.value.set(...hex(s.top)); u.uHor.value.set(...hex(s.hor)); u.uLow.value.set(...hex(s.low || s.hor)); u.uCloudA.value.set(...hex(s.cloudLit || s.hor)); u.uCloudB.value.set(...hex(s.cloudDark || s.top)); u.uSunDir.value.set(...(s.sun || [0, 1, 0])).normalize(); u.uSunC.value.set(...(s.sunColor || [0, 0, 0])); u.uCover.value = s.cover ?? 0; u.uCloudScale.value = s.scale ?? 1; u.uMap.value = s.map || null; u.uHasMap.value = s.map ? 1 : 0; u.uMapGain.value = s.mapGain ?? 1; if (s.map) u.uCover.value = 0; };
    set(o); const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), new THREE.ShaderMaterial({ vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, uniforms: u })); m.position.set(x, 0, z); m.renderOrder = -10; m.frustumCulled = false; group.add(m);
    return { mesh: m, u, set }; };

  // decals: [{ cell, pos, normal, spin, size, alpha }], multiply. bend: { center: [x, y], r, lift } when they sit on a cylinder along z (coordinates of `parent`)
  const decals = (place, list, tex, { grid = 6, parent = group, bend = null, gain = 1 } = {}) => { if (!list?.length || !tex) return null;
    const g = new THREE.PlaneGeometry(1, 1, bend ? 8 : 1, bend ? 8 : 1), cell = new Float32Array(list.length * 2), al = new Float32Array(list.length);
    const m = new THREE.ShaderMaterial({ vertexShader: DECAL_V, fragmentShader: DECAL_F, uniforms: { uMap: { value: tex }, uGrid: { value: grid }, uGain: { value: gain }, uBend: { value: bend ? new THREE.Vector4(bend.center[0], bend.center[1], bend.r, bend.lift ?? 0) : new THREE.Vector4() }, uRFog: rig.uniforms(place).uRFog },
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
    const im = new THREE.InstancedMesh(g, m, list.length); im.name = 'decals.' + place; im.frustumCulled = false; im.renderOrder = -1.5;
    const zAxis = new THREE.Vector3(0, 0, 1), n = new THREE.Vector3(), q = new THREE.Quaternion(), qs = new THREE.Quaternion(), u = new THREE.Vector3(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), B = new THREE.Matrix4(), P = new THREE.Vector3(), S = new THREE.Vector3(), M = new THREE.Matrix4();
    list.forEach((d, i) => { n.set(...d.normal).normalize(); if (Math.abs(n.y) > .7) u.set(1, 0, 0); else u.crossVectors(up, n).normalize();
      v.crossVectors(n, u).normalize(); B.makeBasis(u, v, n); q.setFromRotationMatrix(B); qs.setFromAxisAngle(zAxis, d.spin || 0); q.multiply(qs);
      P.set(...d.pos).addScaledVector(n, .012); S.set(d.size[0], d.size[1], 1); im.setMatrixAt(i, M.compose(P, q, S));
      const c = d.cell | 0; cell[i * 2] = c % grid; cell[i * 2 + 1] = grid - 1 - Math.floor(c / grid); al[i] = d.alpha ?? 1; });
    im.instanceMatrix.needsUpdate = true; g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2)); g.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(al, 1)); parent.add(im); return im; };

  // sprites: defs = [{ name, tex, h, w, kind }], items = [{ name, p: [x,y,z], s, anchor (0 feet at p, 1 top at p), face: [nx, nz, cos], flip }]. One instanced draw per picture
  const uTs = { value: 0 };
  const sprites = (place, defs, items, { tint = [.84, .82, .82], desat = .3, parent = group, log = () => {} } = {}) => { let n = 0; const plane = new THREE.PlaneGeometry(1, 1);
    for (const d of defs) { const list = items.filter(i => i.name === d.name); if (!list.length) continue;
      const g = new THREE.InstancedBufferGeometry(); g.index = plane.index; g.setAttribute('position', plane.attributes.position); g.setAttribute('uv', plane.attributes.uv); g.instanceCount = list.length;
      const P = new Float32Array(list.length * 3), S = new Float32Array(list.length * 4), F = new Float32Array(list.length * 3);
      list.forEach((it, i) => { const s = it.s ?? (it.maxH ? Math.min(1, it.maxH / d.h) : 1); P.set(it.p, i * 3); S.set([d.w * s, d.h * s, it.flip ?? 1, it.anchor ?? (d.kind === 'hang' ? 1 : 0)], i * 4); if (it.face) F.set(it.face, i * 3); });
      g.setAttribute('aPos', new THREE.InstancedBufferAttribute(P, 3)); g.setAttribute('aS', new THREE.InstancedBufferAttribute(S, 4)); g.setAttribute('aFace', new THREE.InstancedBufferAttribute(F, 3));
      const m = new THREE.ShaderMaterial({ vertexShader: SPRITE_V, fragmentShader: SPRITE_F, side: THREE.DoubleSide, uniforms: { ...rig.uniforms(place), uMap: { value: d.tex }, uTs, uDesat: { value: d.kind === 'hang' ? .6 : desat }, uTint: { value: new THREE.Vector3(...tint) } } });
      const o = new THREE.Mesh(g, m); o.frustumCulled = false; o.name = 'sprite.' + d.name; parent.add(o); n += list.length; }
    log(`sprites ${place}: ${n}`); return n; };
  const update = t => { uTs.value = t; };
  return { surface, water, sky, decals, sprites, update };
}

// sprites.json -> loaded pictures: [{ name, tex, h, w, kind }]
export async function loadSpriteDefs(THREE, dir, log = () => {}) {
  const list = await fetch(new URL('sprites.json', dir).href).then(r => r.ok ? r.json() : null).catch(() => null);
  const defs = list ? (Array.isArray(list) ? list : list.sprites || list.items || []) : [];
  const loader = new THREE.TextureLoader();
  const out = (await Promise.all(defs.map(async d => { try { const t = await loader.loadAsync(new URL(d.file || d.name + '.png', dir).href); t.colorSpace = THREE.NoColorSpace; t.premultiplyAlpha = true; t.anisotropy = 8; t.needsUpdate = true;
    const h = d.height ?? d.h ?? 1, ar = d.aspect ?? t.image.width / t.image.height, k = d.kind || 'floor'; return { ...d, tex: t, h, w: h * ar, kind: /hang|ceil/.test(k) ? 'hang' : /wall/.test(k) ? 'wall' : 'floor' }; } catch { return null; } }))).filter(Boolean);
  log(`sprites: ${out.length} pictures`); return out;
}
