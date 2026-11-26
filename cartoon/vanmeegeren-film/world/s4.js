// world/s4.js: the `s4` set for the 1927 S-4 short (2026-11-04, pass 1: previz, lit and textured with canvas textures, no files).
// Several places in one world, far apart, each inside its own dome and fog, so one film can cut between them:
//   TORPEDO room  at (0, 0)      the dark steel tube the six men are trapped in. Pipe to tap at marks.pipe, tube doors at the back (z -6).
//   BRIDGE/sea    at SEA         day, grey sea. Deck y 0 on the cutter's bridge. `ship` runs along X, bow at +X, S-4 surfaces at the bow.
//   BOAT          at BOAT        the rum runner's little boat, the cutter behind it.
//   STORM deck    at STORM       the rescue ship's deck, storm until anim.calm, then a clear dawn.
//   SEABED        at BED         murky teal water, sand, S-4's hull along Z on frame left (surface ~ x -2 at y 2), wreck spars at z -9.
//   WATER         at BED + (0,-200) open water for the sinking wide (uses the hull in the BED by moving it: anim.sink).
// Everything animated is pure in t, driven by world.setOpts.anim (numbers from the film): ram, surface, sink, land, lamp keys, calm, storm.
const hex = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
export const ZONES = { SEA: [400, 0], BOAT: [400, -400], STORM: [400, 400], BED: [-400, 0] };
const NL = 6;
const VERT = `varying vec3 vW; varying vec3 vN; varying vec2 vUv;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FRAG = `uniform vec3 uColor; uniform sampler2D uMap; uniform float uHasMap, uMode, uScroll; uniform vec2 uTile;
uniform vec4 uL[${NL}]; uniform vec3 uLC[${NL}]; uniform vec3 uAmb, uFogC; uniform float uFog, uFall;
uniform sampler2D uShadowMap; uniform mat4 uShadowMatrix; uniform float uShadowOn, uShadowTexel, uShadowSoft, uShadowBias;
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
float shadowAt(vec3 p, vec3 n) { if (uShadowOn < .5) return 0.;
  vec4 c = uShadowMatrix * vec4(p + n * .04, 1.); vec3 s = c.xyz / c.w * .5 + .5;
  if (s.x < 0. || s.x > 1. || s.y < 0. || s.y > 1. || s.z > 1.) return 0.; float sh = 0.;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) { float d = texture2D(uShadowMap, s.xy + vec2(float(i), float(j)) * uShadowTexel * uShadowSoft).r; sh += s.z - uShadowBias > d ? 1. : 0.; }
  return sh / 9.; }
void main() { vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec2 uv = uMode < .5 ? vUv * uTile : uMode < 1.5 ? (vW.xz + vec2(uScroll, uScroll * .4)) / uTile : uMode < 2.5 ? vec2(vW.z, vW.y) / uTile : vec2(vW.x, vW.y) / uTile;
  vec3 base = uColor * (uHasMap > .5 ? texture2D(uMap, uv).rgb : vec3(1.));
  vec3 L = uAmb;
  for (int i = 0; i < ${NL}; i++) { if (uL[i].w <= 0.) continue; vec3 d = uL[i].xyz - vW; float r2 = dot(d, d);
    float lam = max(dot(n, d * inversesqrt(r2)), 0.) * .8 + .2; L += uLC[i] * uL[i].w * lam / (1. + r2 * uFall); }
  vec3 col = base * L * (1. - .6 * shadowAt(vW, n));
  float f = 1. - exp(-pow(length(cameraPosition - vW) * uFog, 1.4));
  gl_FragColor = vec4(mix(col, uFogC, clamp(f, 0., 1.)), 1.); }`;

// ---- canvas textures: multipliers around white
function canvasTex(THREE, size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace; return t;
}
const rng = s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
function noise(g, S, n, a, r0, r1, seed, cols = ['#000', '#fff']) { const R = rng(seed); for (let i = 0; i < n; i++) { g.globalAlpha = a * R(); g.fillStyle = cols[Math.floor(R() * cols.length)]; const r = r0 + R() * (r1 - r0); g.beginPath(); g.ellipse(R() * S, R() * S, r, r * (.4 + R()), R() * 3, 0, 7); g.fill(); } g.globalAlpha = 1; }
const steel = g => { const S = 512; g.fillStyle = '#d9dcdf'; g.fillRect(0, 0, S, S); noise(g, S, 900, .05, 2, 26, 3);
  noise(g, S, 40, .28, 5, 34, 9, ['#7a4a26', '#5a3a22']);                        // rust
  g.strokeStyle = 'rgba(20,20,24,.75)'; g.lineWidth = 5; g.strokeRect(0, 0, S, S); g.beginPath(); g.moveTo(0, S / 2); g.lineTo(S, S / 2); g.stroke();
  g.fillStyle = 'rgba(16,16,20,.85)'; for (let i = 0; i < 16; i++) for (const y of [14, S / 2 - 14, S / 2 + 14, S - 14]) { g.beginPath(); g.arc((i + .5) * S / 16, y, 5, 0, 7); g.fill(); } };
const deck = g => { const S = 512; g.fillStyle = '#c6c7c6'; g.fillRect(0, 0, S, S); noise(g, S, 800, .06, 2, 22, 5);
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 4; g.strokeRect(0, 0, S, S); g.fillStyle = 'rgba(0,0,0,.3)'; for (let i = 0; i < 26; i++) for (let j = 0; j < 26; j++) { g.save(); g.translate((i + .5) * S / 26, (j + .5) * S / 26); g.rotate((i + j) % 2 ? .7 : -.7); g.fillRect(-7, -1.6, 14, 3.2); g.restore(); } };
const sand = g => { const S = 512; g.fillStyle = '#dcd8c6'; g.fillRect(0, 0, S, S); noise(g, S, 3000, .07, 1, 8, 7); noise(g, S, 60, .1, 20, 70, 8); g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 3; for (let y = 10; y < S; y += 42) { g.beginPath(); for (let x = 0; x <= S; x += 16) g.lineTo(x, y + 8 * Math.sin(x * Math.PI * 2 / S * 3 + y)); g.stroke(); } };
const waves = g => { const S = 512; g.fillStyle = '#c8d0d4'; g.fillRect(0, 0, S, S); noise(g, S, 500, .12, 8, 40, 11, ['#ffffff', '#6d7f8c']); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3; for (let y = 8; y < S; y += 32) { g.beginPath(); for (let x = 0; x <= S; x += 12) g.lineTo(x, y + 6 * Math.sin(x * Math.PI * 2 / S * 4 + y * .3) + 2 * Math.sin(x * Math.PI * 2 / S * 11)); g.stroke(); } };

export function buildS4(THREE, scene, opts = {}) {
  const group = new THREE.Group(); group.name = 'set.s4'; scene.add(group);
  const A = opts.anim || {};
  const lightDir = [.15, 1, .25].map(v => v / Math.hypot(.15, 1, .25));
  const TEX = { steel: canvasTex(THREE, 512, steel), deck: canvasTex(THREE, 512, deck), sand: canvasTex(THREE, 512, sand), waves: canvasTex(THREE, 512, waves) };
  const SH = { uShadowMap: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() }, uShadowOn: { value: 0 }, uShadowTexel: { value: 1 / 2048 }, uShadowSoft: { value: 1.4 }, uShadowBias: { value: .0006 }, uSunDir: { value: new THREE.Vector3(...lightDir) } };
  const zone = (amb, fogC, fog, fall, lights) => { const L = [], LC = []; for (let i = 0; i < NL; i++) { const l = lights[i]; L.push(l ? new THREE.Vector4(l[0], l[1], l[2], l[3]) : new THREE.Vector4(0, 0, 0, 0)); LC.push(new THREE.Vector3(...(l ? l[4] : [0, 0, 0]))); }
    return { uAmb: { value: new THREE.Vector3(...amb) }, uFogC: { value: new THREE.Vector3(...hex(fogC)) }, uFog: { value: fog }, uFall: { value: fall }, uL: { value: L }, uLC: { value: LC } }; };
  const mat = (Z, color, tex, tile = [1, 1], mode = 0, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
    uniforms: { ...SH, ...Z, uColor: { value: new THREE.Vector3(...hex(color)) }, uMap: { value: tex ? TEX[tex] : null }, uHasMap: { value: tex ? 1 : 0 }, uMode: { value: mode }, uTile: { value: new THREE.Vector2(...tile) }, uScroll: extra.scroll || { value: 0 } } });
  const add = (geo, m, x, y, z, parent = group, rot) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if (rot) o.rotation.set(...rot); parent.add(o); return o; };
  const box = (w, h, d, m, x, y0, z, parent, rot) => add(new THREE.BoxGeometry(w, h, d), m, x, y0 + h / 2, z, parent, rot);
  const cylZ = (r, len, m, x, y, z, parent) => add(new THREE.CylinderGeometry(r, r, len, 20), m, x, y, z, parent, [Math.PI / 2, 0, 0]);
  const dome = (x, z, top, low, r = 170) => { const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256; const g = cv.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, top); gr.addColorStop(.5, low); gr.addColorStop(1, low); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, depthWrite: true, fog: false, toneMapped: false })); m.position.set(x, 0, z); m.renderOrder = -10; group.add(m); return m; };
  const disc = (color, op = 1, add_ = false) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, blending: add_ ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide, toneMapped: false });

  // ---- particles: an instanced cloud with positions pure in t. fn(i, t) -> [x, y, z, scale]
  const clouds = [];
  const cloud = (n, color, op, fn, r = .12) => { const m = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 8, 6), disc(color, op), n); m.frustumCulled = false; const c = new THREE.Color(); for (let i = 0; i < n; i++) { const v = .7 + .3 * R1(i, 77); m.setColorAt(i, c.setRGB(v, v, v)); } group.add(m); clouds.push({ m, n, fn }); return m; };
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q = new THREE.Quaternion(), _S = new THREE.Vector3();
  const R1 = (k, s = 1) => { const h = Math.sin(k * 12.9898 + s * 78.233) * 43758.5453; return h - Math.floor(h); };
  const smooth = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

  // ======================================================== TORPEDO ROOM (0, 0)
  const lampKeys = A.lamp || [[0, 1]];
  const lamp = t => { let v = lampKeys[0][1]; for (let i = 0; i < lampKeys.length - 1; i++) { const [a, x] = lampKeys[i], [b, y] = lampKeys[i + 1]; if (t >= a && t <= b) v = x + (y - x) * (t - a) / Math.max(.001, b - a); } if (t > lampKeys[lampKeys.length - 1][0]) v = lampKeys[lampKeys.length - 1][1]; return v; };
  const LP = [0.9, 4.15, 1.4];
  const ZT = zone([.1, .11, .13], '#07080b', .03, .05, [[...LP, 2.6, [1.0, .78, .46]], [-2.6, 3.4, -3.5, .8, [.95, .62, .34]], [3.0, 3.6, 7, .7, [.5, .6, .8]]]);
  const HULL = mat(ZT, '#6e7a7a', 'steel', [5, 5], 2), DECK = mat(ZT, '#6c6a64', 'deck', [3, 3], 1), RIB = mat(ZT, '#4a5154'), PIPE = mat(ZT, '#9a7a4a'), PIPE2 = mat(ZT, '#6d7a70'), BRASS = mat(ZT, '#c79a3e'), DOOR = mat(ZT, '#5f6a68', 'steel', [3, 3], 3), TORP = mat(ZT, '#7a8878'), CRATE = mat(ZT, '#7a5a38'), RED = mat(ZT, '#a03328');
  const T = new THREE.Group(); T.name = 's4.torpedo'; group.add(T);
  dome(0, 0, '#050608', '#07080b', 90).renderOrder = -10;
  box(14, .2, 26, DECK, 0, -.2, 4, T);
  { const g = new THREE.CylinderGeometry(5.6, 5.6, 26, 40, 1, true, -Math.PI * .85, Math.PI * 1.7); const o = add(g, HULL, 0, 2.4, 4, T, [Math.PI / 2, 0, 0]); o.rotation.y = 0; }
  for (let z = -5; z < 16; z += 2.6) add(new THREE.TorusGeometry(5.42, .13, 8, 40), RIB, 0, 2.4, z, T);
  box(12, 8.4, .3, DOOR, 0, -.2, -6.1, T);
  for (const [x, y] of [[-1.5, 1.55], [1.5, 1.55], [-1.5, 3.95], [1.5, 3.95]]) { const d = cylZ(1.02, .35, DOOR, x, y, -5.85, T); add(new THREE.TorusGeometry(1.02, .1, 10, 36), BRASS, x, y, -5.66, T); add(new THREE.TorusGeometry(.34, .05, 8, 24), RED, x, y, -5.55, T); box(.12, .85, .08, RED, x, y - .425, -5.55, T); box(.85, .12, .08, RED, x - .425, y - .06, -5.55, T); }
  // overhead pipes, the pipe they tap (marks.pipe), a torpedo on its rack (right), crates to sit on, a bunk
  for (const [x, y, r, m] of [[-2.4, 4.9, .16, PIPE], [-1.7, 5.15, .1, PIPE2], [1.6, 5.2, .13, PIPE2], [2.6, 4.75, .18, PIPE], [-3.9, 3.9, .12, PIPE2], [4.1, 3.7, .1, PIPE]]) cylZ(r, 26, m, x, y, 4, T);
  add(new THREE.CylinderGeometry(.17, .17, 5.6, 16), PIPE, -2.05, 2.8, .95, T); add(new THREE.CylinderGeometry(.12, .12, 5.6, 12), PIPE2, 1.25, 2.8, -2.7, T); add(new THREE.CylinderGeometry(.12, .12, 5.6, 12), PIPE, -3.85, 2.8, -1.8, T);  // the tapping pipes
  add(new THREE.CylinderGeometry(.24, .24, .16, 16), BRASS, -2.05, 1.2, .95, T); add(new THREE.CylinderGeometry(.24, .24, .16, 16), BRASS, -2.05, 3.0, .95, T);
  cylZ(.62, 11, TORP, 3.5, 1.1, 1.2, T); add(new THREE.SphereGeometry(.62, 20, 12), BRASS, 3.5, 1.1, 6.7, T); box(1.5, .5, .4, RIB, 3.5, 0, -2, T); box(1.5, .5, .4, RIB, 3.5, 0, 4, T);
  box(1.0, .55, .9, CRATE, -1.1, 0, .95, T); box(1.0, .55, .9, CRATE, 1.55, 0, .3, T); box(1.1, .55, .9, CRATE, -2.8, 0, -1.8, T); box(1.1, 1.1, .9, CRATE, -3.6, 0, 3.2, T);
  // the lamp: cage + bulb + a soft halo
  const bulbM = disc('#ffd9a0'), haloM = disc('#ffb060', .35, true);
  const bulb = add(new THREE.SphereGeometry(.17, 12, 10), bulbM, LP[0], LP[1], LP[2], T); const halo = add(new THREE.CircleGeometry(1.6, 24), haloM, LP[0], LP[1], LP[2] + .02, T);
  add(new THREE.TorusGeometry(.21, .018, 6, 16), RIB, LP[0], LP[1], LP[2], T); add(new THREE.CylinderGeometry(.02, .02, 1.2, 6), RIB, LP[0], LP[1] + .7, LP[2], T);
  // dust that jumps off the ceiling on the ram, on the landing
  const hits = [A.jolt, A.land].filter(v => v != null);
  cloud(80, '#b8b0a0', .5, (i, t) => { let best = null; for (const h of hits) if (t >= h && t < h + 1.6) best = h; if (best == null) return null; const d = t - best;
    const x = -4 + 8 * R1(i, 1), z = -3 + 7 * R1(i, 2), y = 5.2 - .5 * 9.8 * .45 * d * d - 1.5 * R1(i, 3) * d; return [x, y, z, .35 + .5 * R1(i, 4)]; }, .08);

  // ======================================================== the cutter (a ship along X, bow +X, deck y 0)
  const ship = (Z, x0, z0, hullC = '#59616a') => {
    const G = new THREE.Group(); G.position.set(x0, 0, z0); group.add(G); const HM = mat(Z, hullC, 'steel', [8, 8], 3), WH = mat(Z, '#d8d6cc'), DK = mat(Z, '#8a8680', 'deck', [3, 3], 1), BK = mat(Z, '#26292e'), RS = mat(Z, '#b04a30');
    const s = new THREE.Shape(); s.moveTo(-40, -5); s.lineTo(22, -5); s.quadraticCurveTo(36, -3, 46, 0); s.quadraticCurveTo(36, 3, 22, 5); s.lineTo(-40, 5); s.closePath();
    const hg = new THREE.ExtrudeGeometry(s, { depth: 9, bevelEnabled: false }); hg.rotateX(Math.PI / 2); const hull = add(hg, HM, 0, -.02, 0, G); hull.position.y = -.02;
    const dg = new THREE.ShapeGeometry(s); dg.rotateX(Math.PI / 2); add(dg, DK, 0, 0, 0, G);
    box(90, 1.2, 10.5, RS, -8, -9.6, 0, G);                                     // waterline
    box(12, 5.4, 6, WH, 0, 0, -1.6, G); box(10, 3, 5, WH, 0, 5.4, -1.6, G); box(10.6, .3, 5.6, BK, 0, 8.4, -1.6, G);    // wheelhouse + bridge
    for (let i = -2; i <= 2; i++) box(1.1, 1.1, .1, BK, i * 2, 6.2, .95, G);
    add(new THREE.CylinderGeometry(1.1, 1.3, 6, 16), BK, -9, 5.5, -1, G); add(new THREE.CylinderGeometry(.14, .2, 13, 8), BK, 6.5, 6, -1, G);
    for (let x = -36; x < 20; x += 3) box(.09, 1.35, .09, BK, x, 0, 4.8, G); box(56, .07, .07, BK, -8, 1.3, 4.8, G); box(56, .07, .07, BK, -8, .75, 4.8, G);
    return G;
  };
  const sea = (Z, x0, z0, y, size = 340) => { const m = mat(Z, '#ffffff', 'waves', [26, 26], 1); const o = add(new THREE.PlaneGeometry(size, size), m, x0, y, z0, group, [-Math.PI / 2, 0, 0]); return o; };

  // the submarine (own frame: long axis Z, nose -Z, centre y 0)
  const sub = (Z, color = '#4a5155', scale = 1) => { const G = new THREE.Group(); group.add(G); const H = mat(Z, color, 'steel', [10, 7], 2), TW = mat(Z, '#3e4448', 'steel', [6, 6], 2), BK = mat(Z, '#1d2024'), FL = mat(Z, '#555d62');
    add(new THREE.CylinderGeometry(6, 6, 56, 32), H, 0, 0, 0, G, [Math.PI / 2, 0, 0]);
    const cap = (zz, sgn) => { const o = add(new THREE.SphereGeometry(6, 28, 18), H, 0, 0, zz, G); o.scale.z = 2.6 * sgn; };
    cap(-28, 1); cap(28, 1);
    box(5, .35, 58, FL, 0, 5.6, 0, G);                                          // deck
    for (let z = -26; z <= 26; z += 2) add(new THREE.CylinderGeometry(.07, .07, 1.5, 6), BK, 2.4, 6.6, z, G);
    box(4.4, 5.5, 11, TW, 0, 5.8, -2, G); box(3, 2, 6, TW, 0, 11.3, -2, G); add(new THREE.CylinderGeometry(.13, .13, 6, 6), BK, 0, 15, -3.2, G); add(new THREE.CylinderGeometry(.1, .1, 4.5, 6), BK, 0, 14.5, -.8, G);
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#3e4448'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#ece6d2'; g.font = '900 170px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('S-4', 256, 135);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.NoColorSpace; const lb = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false })); lb.rotation.y = Math.PI / 2; lb.position.set(2.24, 8.5, -2); G.add(lb); const lb2 = lb.clone(); lb2.rotation.y = 0; lb2.scale.set(.72, .72, 1); lb2.position.set(0, 8.5, 3.53); G.add(lb2);
    G.scale.setScalar(scale); return G; };

  // ======================================================== SEA zone: day, cutter, S-4 surfaces at the bow
  const [SX, SZ] = ZONES.SEA;
  const ZS = zone([1.02, 1.03, 1.05], '#aab7c1', .0035, .01, []);
  dome(SX, SZ, '#7f93a6', '#bcc8cf');
  const WS = mat(ZS, '#4f6e80', 'waves', [26, 26], 1), wsScroll = { value: 0 }; WS.uniforms.uScroll = wsScroll;
  add(new THREE.PlaneGeometry(340, 340), WS, SX, -8.2, SZ, group, [-Math.PI / 2, 0, 0]);
  const cutter = ship(ZS, SX, SZ);
  const subS = sub(ZS, '#454c50', 1); subS.position.set(SX + 52.5, -40, SZ - 2);
  const splashAt = [SX + 47, -4, SZ];
  cloud(240, '#ffffff', .9, (i, t) => { if (A.ram == null || t < A.ram - .03 || t > A.ram + 1.8) return null; const d = t - A.ram + .03, a = R1(i, 1) * 6.28, v = 4 + 14 * R1(i, 2);
    return [splashAt[0] + Math.cos(a) * v * d, splashAt[1] + (8 + 16 * R1(i, 3)) * d - 4.9 * d * d, splashAt[2] + Math.sin(a) * v * d, 1 + 2.6 * R1(i, 4)]; }, .25);
  // ======================================================== BOAT zone
  const [BX, BZ] = ZONES.BOAT;
  const ZB = zone([.98, 1.0, 1.04], '#aab7c1', .006, .01, []);
  dome(BX, BZ, '#7f93a6', '#bcc8cf');
  const WB = mat(ZB, '#4f6e80', 'waves', [20, 20], 1); WB.uniforms.uScroll = wsScroll; add(new THREE.PlaneGeometry(340, 340), WB, BX, -1.4, BZ, group, [-Math.PI / 2, 0, 0]);
  const BH = mat(ZB, '#6a4a2c', 'steel', [6, 6], 3), BD = mat(ZB, '#9a7a50', 'deck', [3, 3], 1), BC = mat(ZB, '#a67c44');
  box(16, 2.2, 6, BH, BX, -2.2, BZ, group); box(16.2, .1, 6.2, BD, BX, -.08, BZ, group);
  const ct = document.createElement('canvas'); ct.width = 256; ct.height = 256; { const g = ct.getContext('2d'); g.fillStyle = '#c29a5c'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#5a3e20'; g.lineWidth = 8; g.strokeRect(4, 4, 248, 248); g.beginPath(); g.moveTo(0, 86); g.lineTo(256, 86); g.moveTo(0, 170); g.lineTo(256, 170); g.stroke(); g.fillStyle = '#3a2410'; g.font = '900 50px Arial'; g.textAlign = 'center'; g.fillText('WHISKEY', 128, 145); }
  const ctT = new THREE.CanvasTexture(ct); ctT.colorSpace = THREE.NoColorSpace;
  for (const [x, y, z] of [[-2.9, 0, -1.1], [-2.9, 1.15, -1.1], [-1.75, 0, -1.3], [-4.05, 0, -1.2], [-3.3, 0, .2]]) { const o = add(new THREE.BoxGeometry(1.1, 1.1, 1.1), new THREE.MeshBasicMaterial({ map: ctT, toneMapped: false }), BX + x, y + .55, BZ + z); o.rotation.y = .1 * x; }
  const cutter2 = ship(ZB, BX + 8, BZ - 44, '#7c8690');
  // ======================================================== STORM deck: the rescue ship, storm then a clear dawn
  const [TX, TZ] = ZONES.STORM;
  const ZC = zone([.42, .47, .55], '#39434e', .012, .01, [[TX + 2, 7, TZ + 3, 2.2, [1, .85, .55]]]);
  const stormD = dome(TX, TZ, '#2b3440', '#3d4954');
  const calmD = dome(TX, TZ, '#b9c8cf', '#f4d8ae', 165); calmD.visible = false;
  const WC = mat(ZC, '#3f5866', 'waves', [24, 24], 1); WC.uniforms.uScroll = wsScroll; const waterC = add(new THREE.PlaneGeometry(340, 340), WC, TX, -7, TZ, group, [-Math.PI / 2, 0, 0]);
  const rescue = ship(ZC, TX - 4, TZ - 1, '#3e4650');
  // a big foam hit on "storm hits" and swell walls behind the rail
  const swell = []; for (let i = 0; i < 3; i++) { const o = add(new THREE.CylinderGeometry(9, 26, 16, 24), mat(ZC, '#3a5261', 'waves', [10, 6], 3), TX + 2 + i * 8, -6, TZ + 24 - i * 3, group); o.scale.z = .35; swell.push(o); }
  const HIT = A.storm;
  cloud(160, '#e8eef2', .9, (i, t) => { if (HIT == null || t < HIT - .05 || t > HIT + 1.8) return null; const d = t - HIT + .05, a = R1(i, 5) * 6.28, v = 3 + 9 * R1(i, 6);
    return [TX + 8 + Math.cos(a) * v * d * 1.4, .6 + (6 + 9 * R1(i, 7)) * d - 4.9 * d * d, TZ + 6 + Math.sin(a) * 2 * d, .8 + 2 * R1(i, 8)]; }, .22);
  // sleet: until the storm clears
  cloud(420, '#dfe7ec', .75, (i, t) => { if (t >= (A.calm ?? 99) || t < (A.stormFrom ?? 0)) return null; const sp = 14 + 8 * R1(i, 9), H = 20, y = H - ((R1(i, 10) * H + t * sp) % H) - 2, x = -16 + 32 * R1(i, 11) + (t * 12 * R1(i, 12)) % 6;
    return [TX + 8 + x, y, TZ - 7 + 18 * R1(i, 13), .6 + .5 * R1(i, 14)]; }, .045);

  // ======================================================== SEABED
  const [UX, UZ] = ZONES.BED;
  const ZU = zone([.34, .5, .52], '#0f3a44', .034, .012, [[UX + 3, 22, UZ + 4, 7.5, [.5, .85, .85]]]);
  dome(UX, UZ, '#1d5a66', '#0d333c', 150);
  add(new THREE.PlaneGeometry(300, 300), mat(ZU, '#9aa58c', 'sand', [8, 8], 1), UX, -.01, UZ, group, [-Math.PI / 2, 0, 0]);
  for (let i = 0; i < 14; i++) { const o = add(new THREE.SphereGeometry(1, 12, 8), mat(ZU, '#6a7a6c', 'sand', [6, 6], 1), UX + 2 + 22 * R1(i, 20), -.1, UZ - 16 + 26 * R1(i, 21)); o.scale.set(1 + 3 * R1(i, 22), .15 + .5 * R1(i, 23), 1 + 2 * R1(i, 24)); }
  const subU = sub(ZU, '#55645f', 1);
  const REST = [UX - 7.6, 4.6, UZ - 8];                                         // the wreck at rest, heeled a little
  // wreck spars and a loop of cable for the snag
  const WK = mat(ZU, '#3b4744', 'steel', [4, 4], 2);
  const spars = new THREE.Group(); group.add(spars);
  box(.3, 6, .3, WK, UX - 1.5, 0, UZ - 10.4, spars, [0, 0, .5]); box(.25, 5, .25, WK, UX - .4, 0, UZ - 11.4, spars, [.3, 0, .9]); box(3, .22, .22, WK, UX + .6, 2.6, UZ - 11, spars, [0, .4, .35]);
  add(new THREE.TorusGeometry(.8, .05, 6, 20), WK, UX + .9, 2.5, UZ - 10.9, spars, [.2, .5, 0]);
  // falling sub: dust cloud on landing
  cloud(180, '#b9b49a', .55, (i, t) => { if (A.land == null || t < A.land - .02 || t > A.land + 1.25) return null; const d = t - A.land + .02, a = R1(i, 30) * 6.28, v = 3 + 7 * R1(i, 31), e = 1 - Math.exp(-d * 1.6);
    return [REST[0] + 5 * Math.cos(a) + Math.cos(a) * v * e, .4 + 3 * R1(i, 32) * e, REST[2] + 22 * (R1(i, 33) - .5) + Math.sin(a) * v * e, 3 + 8 * e * R1(i, 34)]; }, .4);
  // marine snow + bubbles round the action area (a stream past the camera for the "goes down" shots)
  cloud(260, '#cfe8e0', .4, (i, t) => { const H = 22; return [UX - 4 + 18 * R1(i, 40) + .3 * Math.sin(t + i), H - (R1(i, 41) * H + t * .22) % H, UZ - 14 + 26 * R1(i, 42), .5 + .7 * R1(i, 43)]; }, .03);
  for (const [bx, bz] of [[12, 3.4], [18, -5.6]]) cloud(70, '#e8fbff', .75, (i, t) => { const H = 26, sp = 7 + 7 * R1(i, 60); return [UX + bx + 6 * (R1(i, 61) - .5) + .25 * Math.sin(t * 2.3 + i), (R1(i, 62) * H + t * sp) % H - 2, UZ + bz + 5 * (R1(i, 63) - .5), .5 + 1.6 * R1(i, 64)]; }, .085);
  cloud(90, '#e8fbff', .7, (i, t) => { const H = 26, sp = 3 + 3 * R1(i, 50), f = (A.descend && ((t > A.descend[0] && t < A.descend[1]) || (t > A.descend[2] && t < A.descend[3]))) ? 3.2 : 1; return [UX - .4 + 5.5 * (R1(i, 51) - .5) + .25 * Math.sin(t * 2.3 + i), (R1(i, 52) * H + t * sp * f) % H, UZ - 1 + 3 * (R1(i, 53) - .5), .4 + 1.3 * R1(i, 54)]; }, .085);

  // ---- pass 2, the camera (only with anim.cam, so older s4 films stay pixel-identical): a wall to fly through at the open end of the torpedo room,
  // and the water's surface over the seabed, for the flights from the sub up to the ships. Both exist only for the moves that need them.
  let surf = null, surfWin = [];
  if (A.cam) {
    box(14, 10, .3, DOOR, 0, -2, 16.1, T);
    const st = TEX.waves.clone(); st.needsUpdate = true; st.repeat.set(40, 40);
    surf = add(new THREE.PlaneGeometry(300, 300), new THREE.MeshBasicMaterial({ map: st, color: '#c8f0ee', side: THREE.DoubleSide, toneMapped: false }), UX, A.cam.surfaceY ?? 56, UZ, group, [-Math.PI / 2, 0, 0]);
    surfWin = A.cam.surface || []; surf.visible = false;
  }

  // ======================================================== update: pure in t
  function update(t) {
    if (surf) surf.visible = surfWin.some(([a, b]) => t >= a - .001 && t <= b + .001);
    wsScroll.value = t * 3.2;
    for (const c of clouds) { let k = 0; for (let i = 0; i < c.n; i++) { const p = c.fn(i, t); if (!p) { _M.makeScale(0, 0, 0); c.m.setMatrixAt(k++, _M); continue; } _P.set(p[0], p[1], p[2]); _S.setScalar(p[3]); _M.compose(_P, _Q, _S); c.m.setMatrixAt(k++, _M); } c.m.instanceMatrix.needsUpdate = true; }
    // lamp: dims over the film + a flicker that gets worse + the swing after the hit
    const base = lamp(t), hb = Math.floor(t * 14), fl = (Math.sin(hb * 91.7) * 43758.5) % 1, hitD = A.jolt != null && t > A.jolt && t < A.jolt + 1.0 ? (Math.floor(t * 20) % 2 ? .15 : 1) : 1;
    const flick = Math.abs(fl) < .07 * (1.4 - base) ? .55 : 1, I = base * flick * hitD;
    ZT.uL.value[0].w = 2.6 * I; ZT.uL.value[1].w = .8 * Math.max(0, base - .15); ZT.uL.value[2].w = .7 * base; bulbM.opacity = .25 + .75 * I; haloM.opacity = .35 * I;
    // the ram: the cutter charges in the wide's window, stops dead on the hit and pitches; the sub rises under the bow
    if (A.ram != null) { const w0 = A.ram - .75, r = A.ram; const a = t < r ? smooth(w0 - .6, r, t) : 1; cutter.position.x = SX - 14 * (1 - a); const d = t - r;
      cutter.rotation.z = t > r ? -.05 * Math.exp(-d * 1.2) * Math.sin(d * 5) : .004 * Math.sin(t * 1.5); cutter.rotation.x = t > r ? .05 * Math.exp(-d * 1.4) : .008 * Math.sin(t * 1.1);
      const up = smooth(r - .5, r - .02, t); subS.position.y = -30 + 26 * up - (t > r ? 8 * smooth(r, r + 1.5, t) : 0); subS.rotation.x = t > r ? .25 * smooth(r, r + 1.5, t) : 0; subS.rotation.z = t > r ? .35 * smooth(r, r + 1.2, t) : 0; }
    // cutter2 and the rescue ship rock
    cutter2.rotation.z = .01 * Math.sin(t * 1.2);
    const calm = A.calm != null && t >= A.calm; stormD.visible = !calm; calmD.visible = calm;
    const heave = calm ? .006 : .035; rescue.rotation.x = heave * Math.sin(t * 1.3); waterC.position.y = -7 + (calm ? .05 : .9) * Math.sin(t * 1.1);
    for (const [i, o] of swell.entries()) { o.visible = !calm; o.position.y = -6 + 4 * Math.sin(t * 1.4 + i * 1.7); }
    ZC.uAmb.value.set(...(calm ? [1.0, .96, .9] : [.42, .47, .55])); ZC.uFogC.value.set(...(calm ? hex('#f0d9b6') : hex('#39434e'))); ZC.uFog.value = calm ? .004 : .012; ZC.uL.value[0].w = calm ? 0 : 2.2;
    // S-4 sinks to the bottom, in the seabed's water, nose down, then rests heeled
    if (A.sink) { const [s0, s1] = A.sink, u = smooth(s0, s1, t), g = Math.min(1, Math.max(0, (t - s0) / (s1 - s0))), f = g * g; subU.position.set(REST[0], 44 - (44 - REST[1]) * f, REST[2]); subU.rotation.x = -.5 * (1 - f) ; subU.rotation.z = .1 * f; if (t >= s1) { const d = t - s1; subU.position.y = REST[1] - .25 * Math.exp(-d * 4) * Math.sin(d * 9); subU.rotation.x = -.03 * Math.exp(-d * 2) * Math.sin(d * 6); } } else { subU.position.set(...REST); subU.rotation.z = .1; }
    if (A.cam?.restUntil != null && t < A.cam.restUntil) { subU.position.set(...REST); subU.rotation.x = 0; subU.rotation.z = .1; }   // the hook's flight sees her on the bottom
  }
  update(0);
  const marks = { pipe: [-2.05, .95] };
  const points = { lamp: LP };
  return { name: 's4', group, lightDir, skyColor: '#07080b', marks, points, bounds: { x: [-7, 7], z: [-5, 7] }, casters: [], uniforms: SH, update };
}
export default { buildS4 };
