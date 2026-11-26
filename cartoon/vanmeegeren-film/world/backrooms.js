// world/backrooms.js: the `backrooms` set (agent D, 2026-11-04): Backrooms Level 0 previz for a 9:16 film with a low, close, moving camera.
// Built by world/sets.js buildSet(THREE, scene, 'backrooms', opts) -> the usual set object (+ `ready`: a promise that resolves when the
// file textures are loaded; lab/stage.html awaits it in its marked BACKROOMS block).
// Layout (units D, ground y 0, camera side +Z, characters ~3.2 D tall):
//   room / junction x -7..7, z -4..18 (the action area x -6..6, z -2..3); low drop ceiling at y CEIL = 5.0 (~1.6x a standing character).
//   back wall z -4 with the HALLWAY mouth (x -2..2) and two doorways (x +-4.8) into the side spaces.
//   hallway x -2..2 running along -Z to z -64 (the end disappears in the murk); its walls have identical doorways every 6 D on both
//   sides (z -10, -16, ... -58) into lit side spaces (outer walls x +-7). Mark `hall` [0, -40] = where the copy-thing figure stands.
// Look: mono-yellow wallpaper walls, stained moist carpet (Google Flow picture, made seamless), drop-ceiling tile grid with 2x4
// fluorescent panels (emissive + a soft additive halo) every 6 D; every surface is lit by the panels themselves (sickly yellow-green,
// soft falloff) and fades into a murky dark-yellow haze with distance from the camera. ONE panel flickers (update(t), pure in t).
// Character sun shadows (world/shadow.js) come from an almost overhead light: they pool under the characters.
// Textures: films/backrooms/tex/ (make_tex.py). Characters stay unlit (their own two-tone shading): grading is done in ffmpeg.

export const CEIL = 5.0;
const TEXDIR = new URL('./assets/backrooms_tex/', import.meta.url);
const hex = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const NP = 64;     // panel slots in the shader

const VERT = `varying vec3 vW; varying vec3 vN; varying vec2 vUv;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv; gl_Position = projectionMatrix * viewMatrix * w; }`;
// uMode: 0 wall (u along the wall, v = height / CEIL), 1 floor, 2 ceiling (world xz / uTile), 3 decal (vUv, alpha from the map)
const FRAG = `uniform vec3 uColor; uniform sampler2D uMap; uniform float uHasMap, uMode; uniform vec2 uTile;
uniform vec4 uPanels[${NP}]; uniform float uNP; uniform vec3 uLightCol, uAmb, uMurk; uniform float uFog, uCeil;
uniform vec3 uSunDir; uniform sampler2D uShadowMap; uniform mat4 uShadowMatrix; uniform float uShadowOn, uShadowTexel, uShadowSoft, uShadowBias;
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
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
void main() {
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec2 uv;
  if (uMode < .5) uv = vec2((abs(n.x) > .5 ? vW.z : vW.x) / uTile.x, vW.y / uCeil);
  else if (uMode < 2.5) uv = vW.xz / uTile;
  else uv = vUv;
  vec4 tx = uHasMap > .5 ? texture2D(uMap, uv) : vec4(1.);
  vec3 base = uColor * tx.rgb;
  // the panels: wrapped lambert (so the ceiling and wall tops glow near a panel too), soft distance falloff
  float L = 0.;
  for (int i = 0; i < ${NP}; i++) {
    if (float(i) >= uNP) break;
    vec4 P = uPanels[i]; vec3 d = P.xyz - vW; float r2 = dot(d, d);
    float lam = max(dot(n, d * inversesqrt(r2)), 0.) * .75 + .25;
    L += P.w * lam / (1. + r2 * .055);
  }
  float sh = shadowAt(vW, n); float low = uMode > 1.5 && uMode < 2.5 ? 1. : .62 + .38 * smoothstep(0., 1.8, vW.y);
  vec3 col = base * (uAmb + uLightCol * L) * (1. - .55 * sh) * low;
  float dist = length(cameraPosition - vW);
  float f = 1. - exp(-pow(dist * uFog, 1.35));
  col = mix(col, uMurk, clamp(f, 0., .97));
  gl_FragColor = vec4(col, uMode > 2.5 ? tx.a : 1.);
}`;
// the emissive panel face + its halo (both fade into the murk too)
const PANEL_F = `uniform sampler2D uMap; uniform float uI, uFog; uniform vec3 uMurk, uTint; varying vec3 vW; varying vec2 vUv;
void main() { vec3 c = texture2D(uMap, vUv).rgb * uTint * (.18 + .95 * uI); float f = 1. - exp(-pow(length(cameraPosition - vW) * uFog * .8, 1.35));
  gl_FragColor = vec4(mix(c, uMurk * 1.6, clamp(f, 0., .9)), 1.); }`;
const HALO_F = `uniform float uI, uFog; uniform vec3 uTint; varying vec3 vW; varying vec2 vUv;
void main() { vec2 q = (vUv - .5) * 2.; float r = length(q); float a = exp(-r * r * 3.2) * .55 * uI;
  float f = exp(-pow(length(cameraPosition - vW) * uFog * .8, 1.35)); gl_FragColor = vec4(uTint * a * f, 1.); }`;

export function buildBackrooms(THREE, scene, opts = {}) {
  const group = new THREE.Group(); group.name = 'set.backrooms'; scene.add(group);
  const murk = opts.murk || '#2c2911', lightDir = (v => { const l = Math.hypot(...v); return v.map(x => x / l); })(opts.lightDir || [.12, 1, .22]);
  if (opts.background !== false) scene.background = new THREE.Color(murk);
  const fog = opts.fog ?? .042;
  // panels: room (z > -4) two columns at x +-3.6; past the back wall three columns (hallway x 0 + the side spaces x +-4.5)
  const panels = [];
  for (let z = 13; z > -72; z -= 6) for (const x of z > -4 ? [-3.6, 3.6] : [-4.5, 0, 4.5]) panels.push({ x, z, i: 1 });
  const FLICK = panels.findIndex(p => p.x === 3.6 && p.z === 1);      // the one flickering panel: room, right, above the action area
  const U = { uSunDir: { value: new THREE.Vector3(...lightDir) }, uShadowMap: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() },
    uShadowOn: { value: 0 }, uShadowTexel: { value: 1 / 2048 }, uShadowSoft: { value: 1.6 }, uShadowBias: { value: .0006 },
    uPanels: { value: Array.from({ length: NP }, (_, k) => new THREE.Vector4(...(panels[k] ? [panels[k].x, CEIL - .3, panels[k].z, 1] : [0, -999, 0, 0]))) },
    uNP: { value: Math.min(NP, panels.length) }, uLightCol: { value: new THREE.Vector3(...(opts.light || [.74, .8, .46])) },
    uAmb: { value: new THREE.Vector3(...(opts.amb || [.22, .23, .14])) }, uMurk: { value: new THREE.Vector3(...hex(murk)) }, uFog: { value: fog }, uCeil: { value: CEIL } };
  // textures (files): loaded async; `ready` resolves when all are in (a missing file keeps the plain colour)
  const loader = new THREE.TextureLoader(), maps = {};
  const load = (k, file, wrap = true) => loader.loadAsync(new URL(file, TEXDIR).href).then(t => { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8;
    if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping; maps[k] = t; for (const m of mats) if (m.userData.mapKey === k) { m.uniforms.uMap.value = t; m.uniforms.uHasMap.value = 1; } }).catch(() => {});
  const mats = [];
  const mat = (color, mode, mapKey, tile = [1, 1], o = {}) => { const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, transparent: !!o.transparent, depthWrite: !o.transparent,
    uniforms: { ...U, uColor: { value: new THREE.Vector3(...hex(color)) }, uMap: { value: null }, uHasMap: { value: 0 }, uMode: { value: mode }, uTile: { value: new THREE.Vector2(...tile) } } });
    if (o.transparent) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2; }
    m.userData.mapKey = mapKey; mats.push(m); return m; };
  const WALL = mat(opts.wall || '#ffffff', 0, 'wallpaper', [5, 1]), FLOOR = mat(opts.carpet || '#ffffff', 1, 'carpet', [4.5, 4.5]),
    CEILM = mat(opts.ceiling || '#ffffff', 2, 'ceiling', [2.4, 2.4]), TRIM = mat('#6a5a2c', 0, null), STAIN = mat('#ffffff', 3, 'stain', [1, 1], { transparent: true });
  const ready = Promise.all([load('wallpaper', 'wallpaper.jpg'), load('carpet', 'carpet.jpg'), load('ceiling', 'ceiling.jpg'), load('panel', 'panel.jpg', false), load('stain', 'stain.png', false)]);

  const plane = (w, d, m, [x, y, z], rx) => { const g = new THREE.PlaneGeometry(w, d); const o = new THREE.Mesh(g, m); o.rotation.x = rx; o.position.set(x, y, z); group.add(o); return o; };
  const X0 = -7, X1 = 7, Z0 = -72, Z1 = 18;
  const floorM = plane(X1 - X0 + 2, Z1 - Z0 + 2, FLOOR, [0, 0, (Z0 + Z1) / 2], -Math.PI / 2); floorM.renderOrder = -2;
  plane(X1 - X0 + 2, Z1 - Z0 + 2, CEILM, [0, CEIL, (Z0 + Z1) / 2], Math.PI / 2);
  // walls: thin boxes; an axis-aligned run with doorway gaps (+ a lintel over each gap up to the ceiling, a dark trim frame)
  const TH = .2, DW = 2.0, DH = 3.7;
  const slab = (w, h, d, [x, y0, z], m = WALL) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y0 + h / 2, z); group.add(o); return o; };
  // run along X at z (from x0 to x1), doors = x centres; run along Z at x (z0..z1), doors = z centres
  const runX = (z, x0, x1, doors = [], dw = DW) => { let a = x0; for (const c of [...doors].sort((p, q) => p - q)) { const l = c - dw / 2, r = c + dw / 2;
      if (l > a) slab(l - a, CEIL, TH, [(a + l) / 2, 0, z]); slab(dw, CEIL - DH, TH, [c, DH, z]);
      for (const s of [l, r]) slab(.12, DH, TH + .06, [s, 0, z], TRIM); slab(dw + .12, .12, TH + .06, [c, DH - .12, z], TRIM); a = r; }
    if (x1 > a) slab(x1 - a, CEIL, TH, [(a + x1) / 2, 0, z]); };
  const runZ = (x, z0, z1, doors = [], dw = DW) => { let a = z0; for (const c of [...doors].sort((p, q) => p - q)) { const l = c - dw / 2, r = c + dw / 2;
      if (l > a) slab(TH, CEIL, l - a, [x, 0, (a + l) / 2]); slab(TH, CEIL - DH, dw, [x, DH, c]);
      for (const s of [l, r]) slab(TH + .06, DH, .12, [x, 0, s], TRIM); slab(TH + .06, .12, dw + .12, [x, DH - .12, c], TRIM); a = r; }
    if (z1 > a) slab(TH, CEIL, z1 - a, [x, 0, (a + z1) / 2]); };
  const HALLD = []; for (let z = -10; z >= -64; z -= 6) HALLD.push(z);
  // back wall of the room: hallway mouth x -2..2 (a 4 wide gap, its own trim), doorways at x +-4.8
  runX(-4, X0, -2, [-4.8]); runX(-4, 2, X1, [4.8]);
  slab(4, CEIL - 4.3, TH, [0, 4.3, -4]); slab(4.12, .14, TH + .06, [0, 4.3 - .14, -4], TRIM);
  // hallway walls (x +-2) with the identical doorways, outer walls (x +-7) plain, the far end wall, room side + front walls
  runZ(-2, Z0, -4, HALLD); runZ(2, Z0, -4, HALLD);
  runZ(X0, Z0, Z1, []); runZ(X1, Z0, Z1, []);
  runX(Z0, X0, X1, []); runX(Z1, X0, X1, []);
  // skirting along the room's walls (reads the floor line in the low shots)
  for (const [w, x, z, r] of [[14, 0, -3.87, 0], [22, -6.87, 7, 1], [22, 6.87, 7, 1]]) { const o = slab(r ? .06 : w, .22, r ? w : .06, [x, 0, z], TRIM); }
  // panels: emissive face + halo under it
  const panelMat = () => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: PANEL_F, side: THREE.DoubleSide,
    uniforms: { uMap: { value: null }, uI: { value: 1 }, uFog: U.uFog, uMurk: U.uMurk, uTint: { value: new THREE.Vector3(1, 1, .92) } } });
  const haloMat = () => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: HALO_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uI: { value: 1 }, uFog: U.uFog, uTint: { value: new THREE.Vector3(1, .98, .7) } } });
  const pmeshes = panels.map(p => { const m = panelMat(); const o = plane(1.2, 2.4, m, [p.x, CEIL - .01, p.z], Math.PI / 2);
    const hm = haloMat(); const h = plane(4.2, 5.6, hm, [p.x, CEIL - .03, p.z], Math.PI / 2); h.renderOrder = 2; return { m, hm }; });
  ready.then(() => { for (const { m } of pmeshes) m.uniforms.uMap.value = maps.panel || null; });
  // a few stains on the carpet (decals)
  const R = (s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(17);
  for (const [x, z, s] of [[-3.4, 1.8, 2.6], [4.2, -1.6, 3.2], [1.2, 6.5, 2.2], [-.6, -12, 3], [.8, -27, 2.6], [-5.2, 9, 2.4]]) {
    const o = plane(s, s * (.7 + R() * .5), STAIN, [x, .004, z], -Math.PI / 2); o.rotation.z = R() * 6; o.renderOrder = -1; }

  // flicker: pure in t. Mostly on with a fast shimmer; short dropouts (a few frames) in a pseudo-random rhythm; now and then a long dim
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const flick = t => { const b = Math.floor(t * 12), h = hash(b), slow = hash(Math.floor(t * 1.3) + 50);
    if (slow < .18) return h < .5 ? .08 : .45;            // a stuttering dim stretch
    if (h < .14) return .05;                               // a dropout
    return .92 + .08 * Math.sin(t * 120); };
  function update(t) {
    if (FLICK < 0) return; const k = opts.flicker === false ? 1 : flick(t);
    U.uPanels.value[FLICK].w = k; pmeshes[FLICK].m.uniforms.uI.value = k; pmeshes[FLICK].hm.uniforms.uI.value = k;
  }
  const marks = { center: [0, 1], a: [-1.4, 1], b: [1.4, 1], front: [0, 2.6], hall: [0, -40], hall_mouth: [0, -5], hall_near: [0, -12],
    door_l: [-2.6, -10], door_r: [2.6, -10], corner_l: [-5.2, -2.6], corner_r: [5.2, -2.6], back_l: [-4.8, -3.2], back_r: [4.8, -3.2],
    enter_l: [-6, 3], enter_r: [6, 3] };
  const points = { ceilH: CEIL, wallZ: -4, hallX: [-2, 2], hallEnd: Z0, hallDoorsZ: HALLD, flickerPanel: [panels[FLICK].x, CEIL, panels[FLICK].z],
    panels: panels.map(p => [p.x, p.z]) };
  return { name: 'backrooms', group, lightDir, skyColor: murk, marks, points, bounds: opts.bounds || { x: [-7, 7], z: [-4, 6] }, casters: [], uniforms: U, update, ready };
}
export default { buildBackrooms };
