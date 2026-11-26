// world/backrooms2.js: the `backrooms2` set (2026-11-04, env/CONTRACT.md): the same Level 0 as world/backrooms.js, with Blender's geometry and scatter and Flow's
// textures when they exist, and live per-pixel cinematic light. No baked light. Same marks, points, update(t), ready.
// Data (all optional, world/assets/backrooms2/): set.glb (wall, carpet, ceiling_tile, tbar, trim, panel, panel_frame, lintel), kit.glb + scatter.json (instanced props, decals),
// tex/ (wallpaper, carpet, ceiling_tile, panel, decals.png, tex.json, optional *_normal). Missing files fall back: geometry = the layout of backrooms.js built here,
// textures = films/backrooms/tex.
// Light: every surface is lit by the panels (world/look/light.glsl.js brPanels): an area light with soft falloff, pools under panels, dark between them, the wall texture
// answers at a grazing angle through a small bump taken from its own brightness. The surfaces write linear HDR; world/look/look.js does haze, glow, depth of field and the display curve.
// set.look: the post pipeline lab/stage.html hands the frame to. Characters are never touched by it. Settings: world.setOpts.look { quality: 'full'|'preview', aperture, density, ... }.
import { LIGHT_GLSL, panelList } from './look/light.glsl.js';
import { readGlb } from './look/glb.js';
import { createLook } from './look/look.js';

export const CEIL = 5.0;
const ASSETS = new URL('./assets/backrooms2/', import.meta.url), OLD = new URL('./assets/backrooms_tex/', import.meta.url);
const hex = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

const VERT = /* glsl */`varying vec3 vW; varying vec3 vN; varying vec2 vUv; varying vec3 vTone; attribute vec4 aTone; uniform float uUseTone;
void main() { vTone = uUseTone > .5 ? aTone.rgb : vec3(1.); vec4 lp = vec4(position, 1.); vec3 ln = normal;
#ifdef USE_INSTANCING
  lp = instanceMatrix * lp; ln = mat3(instanceMatrix) * ln;
#endif
  vec4 w = modelMatrix * lp; vW = w.xyz; vN = normalize(mat3(modelMatrix) * ln); vUv = uv; gl_Position = projectionMatrix * viewMatrix * w; }`;
// uMode: 0 wall, 1 floor, 2 ceiling, 3 plain (trim, kit). uUvMode 1: the mesh's UVs (1 UV = 1 D) / uTile; 0: world projected (the fallback geometry)
const FRAG = /* glsl */`uniform vec3 uColor; uniform sampler2D uMap; uniform float uHasMap, uMode, uUvMode, uBump, uSpec, uCeil, uTGrid, uFlatN, uUseTone; uniform vec2 uTile;
uniform vec3 uLightCol, uAmb;
uniform sampler2D uShadowMap; uniform mat4 uShadowMatrix; uniform float uShadowOn, uShadowTexel, uShadowSoft, uShadowBias;
${LIGHT_GLSL}
varying vec3 vW; varying vec3 vN; varying vec2 vUv; varying vec3 vTone;
float shadowAt(vec3 p, vec3 n) {
  if (uShadowOn < .5) return 0.;
  vec4 c = uShadowMatrix * vec4(p + n * .04, 1.); vec3 s = c.xyz / c.w * .5 + .5;
  if (s.x < 0. || s.x > 1. || s.y < 0. || s.y > 1. || s.z > 1.) return 0.;
  float sh = 0.;
  for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) {
    float d = texture2D(uShadowMap, s.xy + vec2(float(i), float(j)) * uShadowTexel * uShadowSoft).r;
    sh += s.z - uShadowBias > d ? 1. : 0.;
  }
  return sh / 25.;
}
float vhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(vhash(i), vhash(i + vec2(1., 0.)), f.x), mix(vhash(i + vec2(0., 1.)), vhash(i + vec2(1., 1.)), f.x), f.y); }
// Mikkelsen's bump from a height's screen derivatives: the texture's own brightness catches a grazing light. Needs no tangents, works on any mesh.
vec3 bumped(vec3 n, float h) {
  vec3 sx = dFdx(vW), sy = dFdy(vW), r1 = cross(sy, n), r2 = cross(n, sx); float det = dot(sx, r1);
  vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * n - g);
}
void main() {
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec2 uv;
  if (uUvMode > .5) uv = vUv / uTile;
  else if (uMode < .5) uv = vec2((abs(n.x) > .5 ? vW.z : vW.x) / uTile.x, vW.y / uTile.y);
  else if (uMode < 2.5) uv = vW.xz / uTile;
  else uv = vUv;
  vec4 tx = uHasMap > .5 ? texture2D(uMap, uv) : vec4(1.);
  vec3 base = uColor * tx.rgb * (uUseTone > .5 && uMode > 1.5 && uMode < 2.5 ? vec3(1.) : vTone);
  float tileFace = 1.;
  if (uMode > 1.5 && uMode < 2.5) {
    tileFace = smoothstep(.55, .85, -n.y);          // a tile's real side (a sagged tile's edge) is not a lit face
    if (uUseTone > .5) {
      // COLOR_0 only says WHICH tile and how stained: r, g, b = t (1 - .30 s), t (1 - .38 s), t (1 - .58 s). A tile is never tinted whole: almost no tone, and the stain gets a shape
      float q = vTone.b / max(vTone.r, .01), st = clamp((1. - q) / max(.58 - .3 * q, .05), 0., 1.), tn = vTone.r / max(1. - .3 * st, .1);
      base *= .98 + .2 * clamp(tn - .9, 0., .1);
      if (st > .12) {
        vec2 qs = vW.xz; float seed = fract(tn * 91.7 + st * 53.3);
        float f = vnoise(qs * 1.55 + seed * 41.) * .62 + vnoise(qs * 4.1 + seed * 83.) * .27 + vnoise(qs * 11.3 + seed * 17.) * .11;
        float th = mix(.71, .54, st), inside = smoothstep(th, th + .14, f), tide = 1. - smoothstep(.0, .017, abs(f - th));
        base *= mix(vec3(1.), vec3(.88, .79, .62), inside * (.2 + .32 * st));                    // the damp inside
        base *= mix(vec3(1.), vec3(.62, .5, .32), tide * (.42 + .4 * st));                      // the dry tide line round it
      }
    }
  }
  if (uTGrid > .5) {   // no set.glb yet: the ceiling grid drawn here, 1.2 D tiles lined up with the panels
    vec2 g = abs(fract((vW.xz - vec2(.6, 14.2)) / 1.2 + .5) - .5) * 1.2; float line = min(g.x, g.y);
    base = mix(vec3(.42, .38, .24), base * (.84 + .16 * smoothstep(.03, .14, line)), smoothstep(.014, .026, line));
  }
  // large slow damp and grime, in the shader so no two stretches match: carpet blotches, walls darker in long uneven bands, never tiling with the texture
  if (uMode < 1.5 && uHasMap > .5) {
    vec2 q = uMode > .5 ? vW.xz : vec2(abs(n.x) > .5 ? vW.z : vW.x, vW.y * 1.8);
    float big = vnoise(q * .23 + 3.7) * .6 + vnoise(q * .71 + 11.3) * .28 + vnoise(q * 2.3) * .12;
    base *= uMode > .5 ? .6 + .72 * smoothstep(.28, .68, big) : .8 + .32 * smoothstep(.3, .7, big);
  }
  float lum = dot(tx.rgb, vec3(.3, .5, .2));
  float bd = uBump / (1. + .012 * dot(cameraPosition - vW, cameraPosition - vW));
  vec3 nb = bd > .002 ? bumped(n, lum * bd) : n;
  if (uMode > 1.5 && uMode < 2.5) { nb = normalize(mix(vec3(0., -1., 0.), nb, .3 * tileFace)); base *= mix(.6, 1., tileFace); }   // edges and sagged tiles stay with their tile, no bright rim
  if (uFlatN > .5) { nb = vec3(0., -1., 0.); base = mix(base, vec3(.56, .55, .38), smoothstep(7., 26., length(cameraPosition - vW))); }
  float L = brPanels(vW, nb) * (uMode > 1.5 && uMode < 2.5 ? 2.05 : 1.);
  if (uMode > 2.5) L = min(L, .62);
  float sh = shadowAt(vW, n);
  // contact darkening at the seams, no bake: floor + ceiling near a wall, wall near the floor and ceiling
  float wd = brWallDist(vW, uMode < 1.5 ? 1. : 0.), ao = 1.;
  if (uMode > .5 && uMode < 2.5) ao = .55 + .45 * smoothstep(0., .9, wd);
  else if (uMode < .5) ao = (.5 + .5 * smoothstep(0., 1.6, vW.y)) * (.72 + .28 * smoothstep(0., .5, uCeil - vW.y));
  else ao = .62 + .38 * smoothstep(0., 1.8, vW.y);
  vec3 col = base * (uAmb * ao + uLightCol * L * mix(.75, 1., ao)) * (1. - .58 * sh);
  // a little wet sheen from the nearest panel (moist carpet, greasy wallpaper)
  if (uSpec > 0.) {
    float kc = clamp(floor((13. - vW.z) / 6. + .5), 0., 14.), zr = 13. - 6. * kc, x = zr > -4. ? sign(vW.x + .001) * 3.6 : (abs(vW.x) < 2. ? 0. : sign(vW.x) * 4.5);
    vec3 q = vec3(clamp(vW.x, x - .6, x + .6), 4.97, clamp(vW.z, zr - 1.2, zr + 1.2)), l = normalize(q - vW), v = normalize(cameraPosition - vW), h = normalize(l + v);
    float I = (zr == 1. && x > 0.) ? uFlick : 1.;
    col += uLightCol * I * uSpec * lum * pow(max(dot(nb, h), 0.), 22.) * max(dot(n, l), 0.);
  }
  gl_FragColor = vec4(pow(max(col, 0.), vec3(2.2)), 1.);
}`;
// the panel face: HDR, so it blooms. Its own picture by world position (one panel.jpg per panel whatever the mesh's UVs are), the one flickering panel, a slow per-panel unevenness
const PANEL_F = /* glsl */`uniform sampler2D uMap; uniform float uHasMap, uHDR, uFlick, uUvMode; uniform vec3 uTint; varying vec3 vW; varying vec3 vN; varying vec2 vUv;
void main() {
  float k = floor((13. - vW.z) / 6. + .5), zr = 13. - 6. * k, x = zr > -4. ? sign(vW.x) * 3.6 : (abs(vW.x) < 2.25 ? 0. : sign(vW.x) * 4.5);
  vec2 uv = uUvMode > .5 ? vUv / vec2(1.2, 2.4) : (vW.xz - vec2(x, zr)) / vec2(1.2, 2.4) + .5;
  float I = (zr == 1. && x > 0.) ? uFlick : 1.;
  float var = .86 + .14 * fract(sin(k * 12.9 + x * 7.1) * 43758.5);
  vec3 c = (uHasMap > .5 ? texture2D(uMap, uv).rgb : vec3(1.)) * uTint;
  gl_FragColor = vec4(pow(c, vec3(2.2)) * (.02 + uHDR * I * var), 1.);
}`;
// a decal multiplies what is under it (custom blend: dst * src): it only ever darkens and is lit by the surface it sits on, so it can never glow in the dark
const DECAL_V = /* glsl */`attribute vec2 aCell; attribute float aAlpha; varying vec2 vUv; varying float vA;
void main() { vUv = (uv * .96 + .02 + aCell) / uGrid; vA = aAlpha;
  vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.);
  gl_Position = projectionMatrix * mv; }`;
const DECAL_F = /* glsl */`uniform sampler2D uMap; uniform float uGain; varying vec2 vUv; varying float vA;
void main() { vec4 t = texture2D(uMap, vUv); float a = t.a * vA; if (a < .004) discard;
  vec3 m = mix(vec3(1.), t.rgb, min(a * uGain, 1.)); gl_FragColor = vec4(pow(m, vec3(2.2)), 1.); }`;   // tex.json: surface * mix(1, rgb, a * alpha), in display numbers; this target is linear

export function buildBackrooms2(THREE, scene, opts = {}) {
  const group = new THREE.Group(); group.name = 'set.backrooms2'; scene.add(group);
  const murk = opts.murk || '#2c2911', lightDir = (v => { const l = Math.hypot(...v); return v.map(x => x / l); })(opts.lightDir || [.12, 1, .22]);
  if (opts.background !== false) scene.background = new THREE.Color(murk);
  const panels = panelList(), FLICK = panels.findIndex(p => p.x === 3.6 && p.z === 1);
  const U = { uSunDir: { value: new THREE.Vector3(...lightDir) }, uShadowMap: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() },
    uShadowOn: { value: 0 }, uShadowTexel: { value: 1 / 2048 }, uShadowSoft: { value: 1.6 }, uShadowBias: { value: .0006 },
    uLightCol: { value: new THREE.Vector3(...(opts.light || [1.75, 1.82, .84])) }, uAmb: { value: new THREE.Vector3(...(opts.amb || [.17, .17, .09])) },
    uCeil: { value: CEIL }, uFlick: { value: 1 }, uWrap: { value: new THREE.Vector2(...(opts.wrap || [.8, .2])) }, uFall: { value: opts.fall ?? .1 }, uLeak: { value: opts.leak ?? .16 } };
  const mats = [];
  const mat = (color, mode, o = {}) => { const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
    uniforms: { ...U, uColor: { value: new THREE.Vector3(...hex(color)) }, uMap: { value: null }, uHasMap: { value: 0 }, uMode: { value: mode }, uUvMode: { value: 0 }, uTile: { value: new THREE.Vector2(...(o.tile || [1, 1])) }, uBump: { value: o.bump ?? 0 }, uUseTone: { value: 0 }, uFlatN: { value: o.flatN ? 1 : 0 }, uSpec: { value: o.spec ?? 0 }, uTGrid: { value: 0 } } });
    mats.push(m); return m; };
  const WALL = mat(opts.wall || '#ffffff', 0, { tile: [5, CEIL], bump: .055, spec: .05 }), FLOOR = mat(opts.carpet || '#92916f', 1, { tile: [4.5, 4.5], bump: .05, spec: .1 }),
    CEILM = mat(opts.ceiling || '#dfe6ae', 2, { tile: [2.4, 2.4], bump: .012 }), TRIM = mat('#6a5a2c', 3), TBAR = mat('#b5ad86', 2, { flatN: true }), LINTEL = mat('#ffffff', 0, { tile: [5, CEIL], bump: .055 }), PFRAME = mat('#bdb492', 2, { flatN: true });
  const PANEL = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: PANEL_F, side: THREE.DoubleSide,
    uniforms: { uMap: { value: null }, uHasMap: { value: 0 }, uHDR: { value: opts.panelHDR ?? 1.8 }, uFlick: U.uFlick, uUvMode: { value: 0 }, uUseTone: { value: 0 }, uTint: { value: new THREE.Vector3(1, .97, .74) } } });
  const VOID = mat('#0b0a06', 3);       // the dark plenum above the ceiling (seen through missing tiles)
  const BY_NAME = { wall: WALL, carpet: FLOOR, ceiling_tile: CEILM, tbar: TBAR, trim: TRIM, panel: PANEL, panel_frame: PFRAME, lintel: LINTEL, void: VOID };
  const look = opts.look === false ? null : createLook(THREE, { ...(opts.look || {}), flickAt: t => flickK(t) });

  // ---- textures: Flow's when there, the current look's otherwise
  const loader = new THREE.TextureLoader();
  const exists = async u => { try { const r = await fetch(u, { method: 'HEAD' }); return r.ok; } catch { return false; } };
  const loadTex = async (file, oldFile, wrap = true) => { const a = new URL('tex/' + file, ASSETS).href, isNew = await exists(a), u = isNew ? a : oldFile ? new URL(oldFile, OLD).href : null; if (!u) return null;
    try { const t = await loader.loadAsync(u); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.userData = { isNew }; return t; } catch { return null; } };
  const setMap = (m, t) => { if (t) { m.uniforms.uMap.value = t; m.uniforms.uHasMap.value = 1; } };
  const tileOf = (texJson, name) => { const e = texJson?.[name] || texJson?.files?.[name] || texJson?.textures?.[name] || texJson?.[name + '.jpg'] || texJson?.files?.[name + '.jpg'] || texJson?.textures?.[name + '.jpg']; if (e == null) return null;
    const v = typeof e === 'number' ? e : e.tile ?? e.tile_d ?? e.tileD ?? e.size ?? e.d; return v == null ? null : Array.isArray(v) ? v : [v, v]; };

  // ---- the fallback geometry: the layout of backrooms.js
  function fallbackGeometry() {
    const plane = (w, d, m, [x, y, z], rx) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); o.rotation.x = rx; o.position.set(x, y, z); group.add(o); return o; };
    const X0 = -7, X1 = 7, Z0 = -72, Z1 = 18, TH = .2, DW = 2.0, DH = 3.7;
    plane(X1 - X0 + 2, Z1 - Z0 + 2, FLOOR, [0, 0, (Z0 + Z1) / 2], -Math.PI / 2).renderOrder = -2;
    plane(X1 - X0 + 2, Z1 - Z0 + 2, CEILM, [0, CEIL, (Z0 + Z1) / 2], Math.PI / 2); CEILM.uniforms.uTGrid.value = 1;
    const slab = (w, h, d, [x, y0, z], m = WALL) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y0 + h / 2, z); group.add(o); return o; };
    const runX = (z, x0, x1, doors = [], dw = DW) => { let a = x0; for (const c of [...doors].sort((p, q) => p - q)) { const l = c - dw / 2, r = c + dw / 2;
        if (l > a) slab(l - a, CEIL, TH, [(a + l) / 2, 0, z]); slab(dw, CEIL - DH, TH, [c, DH, z]);
        for (const s of [l, r]) slab(.12, DH, TH + .06, [s, 0, z], TRIM); slab(dw + .12, .12, TH + .06, [c, DH - .12, z], TRIM); a = r; }
      if (x1 > a) slab(x1 - a, CEIL, TH, [(a + x1) / 2, 0, z]); };
    const runZ = (x, z0, z1, doors = [], dw = DW) => { let a = z0; for (const c of [...doors].sort((p, q) => p - q)) { const l = c - dw / 2, r = c + dw / 2;
        if (l > a) slab(TH, CEIL, l - a, [x, 0, (a + l) / 2]); slab(TH, CEIL - DH, dw, [x, DH, c]);
        for (const s of [l, r]) slab(TH + .06, DH, .12, [x, 0, s], TRIM); slab(TH + .06, .12, dw + .12, [x, DH - .12, c], TRIM); a = r; }
      if (z1 > a) slab(TH, CEIL, z1 - a, [x, 0, (a + z1) / 2]); };
    const HALLD = []; for (let z = -10; z >= -64; z -= 6) HALLD.push(z);
    runX(-4, X0, -2, [-4.8]); runX(-4, 2, X1, [4.8]);
    slab(4, CEIL - 4.3, TH, [0, 4.3, -4]); slab(4.12, .14, TH + .06, [0, 4.3 - .14, -4], TRIM);
    runZ(-2, Z0, -4, HALLD); runZ(2, Z0, -4, HALLD); runZ(X0, Z0, Z1, []); runZ(X1, Z0, Z1, []); runX(Z0, X0, X1, []); runX(Z1, X0, X1, []);
    for (const [w, x, z, r] of [[14, 0, -3.87, 0], [22, -6.87, 7, 1], [22, 6.87, 7, 1]]) slab(r ? .06 : w, .22, r ? w : .06, [x, 0, z], TRIM);
    for (const p of panels) plane(1.2, 2.4, PANEL, [p.x, CEIL - .01, p.z], Math.PI / 2);
  }
  // ---- Blender's set: one mesh per material
  function fromGlb(glb) {
    for (const root of glb.roots) for (const p of root.prims) {
      const key = p.material || root.name, m = BY_NAME[key] || BY_NAME[key.toLowerCase().split('.')[0]] || TRIM;
      const o = new THREE.Mesh(p.geometry, m); o.applyMatrix4(root.matrix); o.name = 'set.' + key; o.frustumCulled = false; if (m === FLOOR) o.renderOrder = -2; group.add(o);
      if (p.geometry.attributes.aTone && m.uniforms.uUseTone) m.uniforms.uUseTone.value = 1;
    }
    for (const m of [WALL, FLOOR, CEILM, LINTEL, PANEL]) m.uniforms.uUvMode.value = 1;
  }
  // ---- kit + scatter: one InstancedMesh per asset primitive
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
  let kitStats = { draws: 0, instances: 0, decals: 0 };
  function fromScatter(kit, sc) {
    const kitMats = new Map(), kmat = (prim) => { const tone = !!prim.geometry.attributes.aTone, k = (prim.material || '') + '|' + (prim.color || []).join(',') + '|' + tone; if (kitMats.has(k)) return kitMats.get(k);
      if (/tile_missing/.test(prim.material || '') && CEILM.uniforms.uMap.value) { const c = mat(opts.ceiling || '#dfe6ae', 2, { tile: [CEILM.uniforms.uTile.value.x, CEILM.uniforms.uTile.value.y] }); c.uniforms.uMap.value = CEILM.uniforms.uMap.value; c.uniforms.uHasMap.value = 1; kitMats.set(k, c); return c; }   // hanging tiles are the same tile, not a flat brown card
      const m = mat('#ffffff', 3); if (prim.color) m.uniforms.uColor.value.set(...prim.color.map(v => Math.pow(v, 1 / 2.2) * .74)); m.uniforms.uUseTone.value = tone ? 1 : 0; kitMats.set(k, m); return m; };
    for (const [name, list] of Object.entries(sc.instances || {})) {
      const root = kit?.roots.find(r => r.name === name); if (!root || !list.length) continue;
      for (const prim of root.prims) {
        const im = new THREE.InstancedMesh(prim.geometry, kmat(prim), list.length); im.name = 'kit.' + name; im.frustumCulled = false;
        list.forEach((v, i) => { _p.set(v[0], v[1], v[2]); _q.set(v[3], v[4], v[5], v[6]); _s.set(v[7], v[8], v[9]); im.setMatrixAt(i, _m.compose(_p, _q, _s)); });
        im.instanceMatrix.needsUpdate = true; group.add(im); kitStats.draws++; kitStats.instances += list.length;
      }
    }
  }
  function decals(list, tex, grid = 6) {
    if (!list?.length || !tex) return;
    const g = new THREE.PlaneGeometry(1, 1), cell = new Float32Array(list.length * 2), al = new Float32Array(list.length);
    const m = new THREE.ShaderMaterial({ vertexShader: `uniform float uGrid;\n` + DECAL_V, fragmentShader: DECAL_F, uniforms: { uMap: { value: tex }, uGrid: { value: grid }, uGain: { value: opts.decalGain ?? 1 } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
    const im = new THREE.InstancedMesh(g, m, list.length); im.name = 'decals'; im.frustumCulled = false; im.renderOrder = -1.5;
    const zAxis = new THREE.Vector3(0, 0, 1), n = new THREE.Vector3(), qs = new THREE.Quaternion(), u = new THREE.Vector3(), v = new THREE.Vector3(), upY = new THREE.Vector3(0, 1, 0), B = new THREE.Matrix4();
    list.forEach((d, i) => { n.set(...d.normal).normalize();
      // the spin-0 basis Blender used: walls u = up x n, v = n x u (image top = world up); floors u = +x, v = -z; ceilings u = +x, v = +z
      if (Math.abs(n.y) > .7) u.set(1, 0, 0); else u.crossVectors(upY, n).normalize();
      v.crossVectors(n, u).normalize(); B.makeBasis(u, v, n); _q.setFromRotationMatrix(B); qs.setFromAxisAngle(zAxis, d.spin || 0); _q.multiply(qs);
      // lifted off the surface: .008 D + polygon offset; the cells are never coplanar with each other in depth terms because nothing here writes depth
      _p.set(...d.pos).addScaledVector(n, .008); _s.set(d.size[0], d.size[1], 1); im.setMatrixAt(i, _m.compose(_p, _q, _s));
      const c = d.cell | 0; cell[i * 2] = c % grid; cell[i * 2 + 1] = grid - 1 - Math.floor(c / grid); al[i] = d.alpha ?? 1; });
    im.instanceMatrix.needsUpdate = true;
    g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2)); g.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(al, 1));
    group.add(im); kitStats.decals = list.length;
  }
  const getJson = async u => { try { const r = await fetch(u); return r.ok ? await r.json() : null; } catch { return null; } };

  const ready = (async () => {
    const [glb, kit, sc, texJson] = await Promise.all([readGlb(THREE, new URL('set.glb', ASSETS).href), readGlb(THREE, new URL('kit.glb', ASSETS).href), getJson(new URL('scatter.json', ASSETS).href), getJson(new URL('tex/tex.json', ASSETS).href)]);
    const [w, c, ce, p, dec, st] = await Promise.all([loadTex('wallpaper.jpg', 'wallpaper.jpg'), loadTex('carpet.jpg', 'carpet.jpg'), loadTex('ceiling_tile.jpg', 'ceiling.jpg'), loadTex('panel.jpg', 'panel.jpg', false), loadTex('decals.png', null, false), glb && false ? null : loadTex('__none', 'stain.png', false)]);
    setMap(WALL, w); setMap(LINTEL, w); setMap(FLOOR, c); setMap(CEILM, ce); if (p) { PANEL.uniforms.uMap.value = p; PANEL.uniforms.uHasMap.value = 1; }
    for (const [m, name] of [[WALL, 'wallpaper'], [LINTEL, 'wallpaper'], [FLOOR, 'carpet'], [CEILM, 'ceiling_tile']]) { const t = tileOf(texJson, name); if (t) m.uniforms.uTile.value.set(t[0], t[1]); }
    if (glb) fromGlb(glb); else fallbackGeometry();
    if (sc) { fromScatter(kit, sc); decals(sc.decals, dec); }
    else if (st) { // no scatter yet: the current set's stains, as one-cell decals
      const R = (s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(17);
      decals([[-3.4, 1.8, 2.6], [4.2, -1.6, 3.2], [1.2, 6.5, 2.2], [-.6, -12, 3], [.8, -27, 2.6], [-5.2, 9, 2.4]].map(([x, z, s]) => ({ cell: 0, pos: [x, 0, z], normal: [0, 1, 0], spin: R() * 6, size: [s, s * (.7 + R() * .5)], alpha: 1 })), st, 1);
    }
    if (opts.look?.shade && look) { const CS = await import('./look/charshade.js'); look.shading = CS.createCharShade(THREE, opts.look.shade); }   // only a film that asks
    if (opts.sprites) { const S = await import('./look/sprites.js'); const r = await S.addSprites(THREE, group, { ...U, uT: uTime }, { dir: new URL(opts.sprites.dir || 'tex/sprites/', ASSETS), opts: opts.sprites, scatter: sc, log: m => console.log(m) }); Object.assign(kitStats, r); }   // only a film that asks
    return { glb: !!glb, kit: !!kit, scatter: !!sc, texJson: !!texJson, ...kitStats };
  })();

  // flicker: pure in t, the same rhythm as backrooms.js
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const flick = t => { const b = Math.floor(t * 12), h = hash(b), slow = hash(Math.floor(t * 1.3) + 50);
    if (slow < .18) return h < .5 ? .08 : .45;
    if (h < .14) return .05;
    return .92 + .08 * Math.sin(t * 120); };
  function flickK(t) { return opts.flicker === false ? 1 : flick(t); }
  const uTime = { value: 0 };
  function update(t) { U.uFlick.value = flickK(t); uTime.value = t; }

  const HALLD = []; for (let z = -10; z >= -64; z -= 6) HALLD.push(z);
  const marks = { center: [0, 1], a: [-1.4, 1], b: [1.4, 1], front: [0, 2.6], hall: [0, -40], hall_mouth: [0, -5], hall_near: [0, -12],
    door_l: [-2.6, -10], door_r: [2.6, -10], corner_l: [-5.2, -2.6], corner_r: [5.2, -2.6], back_l: [-4.8, -3.2], back_r: [4.8, -3.2],
    enter_l: [-6, 3], enter_r: [6, 3] };
  const points = { ceilH: CEIL, wallZ: -4, hallX: [-2, 2], hallEnd: -72, hallDoorsZ: HALLD, flickerPanel: [panels[FLICK].x, CEIL, panels[FLICK].z], panels: panels.map(p => [p.x, p.z]) };
  return { name: 'backrooms2', group, lightDir, skyColor: murk, marks, points, bounds: opts.bounds || { x: [-7, 7], z: [-24, 8] }, casters: [], uniforms: U, update, ready, look };
}
export default { buildBackrooms2 };
