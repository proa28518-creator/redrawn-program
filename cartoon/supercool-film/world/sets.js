// world/sets.js: small, clean sets for the character films. buildSet(THREE, scene, name, opts) -> set (see WORLD_API.md).
// Units: 1 = D (head diameter). Ground y = 0. The cast is ~2.8 D tall (engineer headY 2.3, hipY 1.17), so the sets are scaled to THEM
// (a door ~4 D, a storey ~9 D), not to real metres. Light: the sun behind-left of a camera looking down -Z; lit surfaces warm,
// shadow cool blue (golden/NOTES.md). Every set surface uses one tiny lit shader that also reads the character shadow map (shadow.js).
// Colours are written as plain sRGB numbers and output as-is (no colour management), like the characters' own shaders.

// The four named sets below belong to the two example films (S-4, backrooms). The app leaves their modules out of a member's project,
// so each is optional: a missing one is skipped here, and a film that names it gets a plain error from buildSet (exampleSet below).
const backroomsMod = await import('./backrooms.js').catch(e => { console.log('backrooms not loaded: ' + e.message); return null; });
const backrooms2Mod = await import('./backrooms2.js').catch(e => { console.log('backrooms2 not loaded: ' + e.message); return null; });   // ENV2: a fault in it can never stop the other sets
const s4Mod = await import('./s4.js').catch(e => { console.log('s4 not loaded: ' + e.message); return null; });   // S-4 short: a fault in it can never stop the other sets
const s4EnvMod = await import('./s4_env.js').catch(e => { console.log('s4_env not loaded: ' + e.message); return null; });   // S-4 pass 3, same rule
// FIX-SEAT: bench seat depth and its centre's offset from the hip mark (front edge = mark + .14, back edge / backrest = mark - .42)
const SEAT_D = .56, SEAT_C = .14 - SEAT_D / 2;
const SUN_DIR = [-0.5, 0.74, 0.45];            // direction TO the sun: from behind (+Z) and left (-X) of a camera looking down -Z, ~47 deg up
const hex = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const rnd = s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };

const VERT = `varying vec3 vW; varying vec3 vN; varying vec2 vUv;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FRAG = `uniform vec3 uColor; uniform sampler2D uMap; uniform float uHasMap; uniform vec2 uRepeat;
uniform vec3 uSunDir, uLit, uShade; uniform sampler2D uShadowMap; uniform mat4 uShadowMatrix; uniform float uShadowOn, uShadowTexel, uShadowSoft, uShadowBias;
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
  vec3 base = uColor; if (uHasMap > .5) base *= texture2D(uMap, vUv * uRepeat).rgb;
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  float lit = smoothstep(-.02, .22, dot(n, normalize(uSunDir)));
  lit *= 1. - shadowAt(vW, n);
  gl_FragColor = vec4(base * mix(uShade, uLit, lit), 1.);
}`;
const SKY_V = `varying vec3 vD; void main() { vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }`;
const SKY_F = `uniform vec3 uTop, uHor, uLow; varying vec3 vD;
void main() { float y = vD.y; vec3 c = y > 0. ? mix(uHor, uTop, pow(clamp(y * 2.2, 0., 1.), .7)) : mix(uHor, uLow, clamp(-y * 6., 0., 1.)); gl_FragColor = vec4(c, 1.); }`;

function canvasTex(THREE, size, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// a filled circle drawn wrapped around the tile edges (seamless repeat)
const dots = (g, n, x, y, r) => { for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) { const cx = x + ox, cy = y + oy; if (cx + r < 0 || cx - r > n || cy + r < 0 || cy - r > n) continue; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); } };
// textures are multipliers around 1 (base colour comes from the material)
const TEX = {
  paving: (g, n) => { const R = rnd(7); g.fillStyle = '#fff'; g.fillRect(0, 0, n, n); const k = 4, s = n / k;
    for (let r = 0; r < k; r++) for (let c = -1; c <= k; c++) { const x = c * s + (r % 2) * s / 2, v = 225 + R() * 30 | 0; g.fillStyle = `rgb(${v},${v - 4},${v - 10})`; g.fillRect(x + 3, r * s + 3, s - 6, s - 6); }
    g.fillStyle = 'rgba(90,80,70,.55)'; for (let r = 0; r <= k; r++) g.fillRect(0, r * s - 2, n, 4); for (let r = 0; r < k; r++) for (let c = 0; c <= k; c++) g.fillRect(c * s + (r % 2) * s / 2 - 2, r * s, 4, s); },
  plaster: (g, n) => { const R = rnd(3); g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, n, n); for (let i = 0; i < 260; i++) { const v = 220 + R() * 35 | 0; g.fillStyle = `rgba(${v},${v},${v},.35)`; const r = 6 + R() * 30; dots(g, n, R() * n, R() * n, r); } },
  planks: (g, n) => { const R = rnd(5); const k = 8, s = n / k; for (let i = 0; i < k; i++) { const v = 215 + R() * 40 | 0; g.fillStyle = `rgb(${v},${v - 6},${v - 14})`; g.fillRect(i * s, 0, s, n);
    g.fillStyle = 'rgba(60,40,30,.12)'; for (let j = 0; j < 5; j++) g.fillRect(i * s + R() * s, 0, 2, n); g.fillStyle = 'rgba(50,32,24,.7)'; g.fillRect(i * s, 0, 3, n); } },
  dirt: (g, n) => { const R = rnd(9); g.fillStyle = '#ececec'; g.fillRect(0, 0, n, n); for (let i = 0; i < 900; i++) { const v = 205 + R() * 50 | 0; g.fillStyle = `rgba(${v},${v - 6},${v - 16},.5)`; dots(g, n, R() * n, R() * n, 2 + R() * 14); }
    g.fillStyle = 'rgba(120,100,80,.5)'; for (let i = 0; i < 160; i++) { dots(g, n, R() * n, R() * n, 1.5 + R() * 3); } },
  stripes: (g, n) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f3ead8' : '#c8443a'; g.fillRect(i * n / 8, 0, n / 8, n); } },
  cloth: (g, n) => { for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#f2efe6' : '#4a78b8'; g.fillRect(i * n / 10, 0, n / 10, n); } },
  boards: (g, n) => { const R = rnd(11); const k = 8, s = n / k; for (let i = 0; i < k; i++) { const v = 215 + R() * 40 | 0; g.fillStyle = `rgb(${v},${v - 6},${v - 14})`; g.fillRect(0, i * s, n, s);
    g.fillStyle = 'rgba(60,40,30,.12)'; for (let j = 0; j < 5; j++) g.fillRect(0, i * s + R() * s, n, 2); g.fillStyle = 'rgba(50,32,24,.7)'; g.fillRect(0, i * s, n, 3);
    const c = (i % 2) * n / 2 + R() * 40; g.fillRect(c, i * s, 3, s); } },
  grass: (g, n) => { const R = rnd(13); g.fillStyle = '#eeeeee'; g.fillRect(0, 0, n, n); for (let i = 0; i < 700; i++) { const v = 200 + R() * 55 | 0; g.fillStyle = `rgba(${v - 10},${v},${v - 20},.5)`; dots(g, n, R() * n, R() * n, 3 + R() * 16); }
    g.fillStyle = 'rgba(70,110,50,.35)'; for (let i = 0; i < 400; i++) g.fillRect(R() * n, R() * n, 2, 6 + R() * 6); },
  sand: (g, n) => { const R = rnd(17); g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, n, n); for (let i = 0; i < 900; i++) { const v = 220 + R() * 35 | 0; g.fillStyle = `rgba(${v},${v - 4},${v - 12},.45)`; dots(g, n, R() * n, R() * n, 1 + R() * 9); } },
  floor: (g, n) => { const R = rnd(19), k = 4, s = n / k; for (let r = 0; r < k; r++) for (let c = 0; c < k; c++) { const v = (r + c) % 2 ? 250 : 222 + R() * 8 | 0; g.fillStyle = `rgb(${v},${v - 3},${v - 8})`; g.fillRect(c * s, r * s, s, s); }
    g.fillStyle = 'rgba(80,70,60,.45)'; for (let r = 0; r <= k; r++) { g.fillRect(0, r * s - 2, n, 4); g.fillRect(r * s - 2, 0, 4, n); } },
  brick: (g, n) => { const R = rnd(23); g.fillStyle = 'rgb(150,140,130)'; g.fillRect(0, 0, n, n); const rows = 16, h = n / rows, w = n / 4;
    for (let r = 0; r < rows; r++) for (let c = -1; c <= 4; c++) { const v = 215 + R() * 40 | 0; g.fillStyle = `rgb(${v},${v - 8},${v - 12})`; g.fillRect(c * w + (r % 2) * w / 2 + 3, r * h + 3, w - 6, h - 6); } },
  ripple: (g, n) => { const R = rnd(29); g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, n, n); g.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 70; i++) { const x = R() * n, y = R() * n, w = 20 + R() * 70; g.fillRect(x, y, w, 3); if (x + w > n) g.fillRect(x - n, y, w, 3); }
    g.fillStyle = 'rgba(150,170,190,.35)'; for (let i = 0; i < 60; i++) g.fillRect(R() * n, R() * n, 30 + R() * 60, 2); },
  cabinet: (g, n) => { g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, n, n); g.strokeStyle = 'rgba(60,45,40,.6)'; g.lineWidth = 8; g.strokeRect(14, 14, n - 28, n - 28); g.fillStyle = 'rgba(60,45,40,.8)'; g.fillRect(n / 2 - 30, 40, 60, 12); },
  sign: (g, n) => { g.fillStyle = '#2f4a3e'; g.fillRect(0, 0, n, n); g.strokeStyle = '#d9b860'; g.lineWidth = 14; g.strokeRect(16, n * .3, n - 32, n * .4);
    g.fillStyle = '#f0d890'; g.font = `900 ${n * .22 | 0}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BAKERY', n / 2, n / 2 + 4); },
};

// ---- the description kit (WORLD_API.md "Describe a set"): a set any Claude can write by hand as JSON. Named kit sets are these too.
const deg = d => (d || 0) * Math.PI / 180;
const tint = (c, k = 1) => Array.isArray(c) ? c : hex(c).map(v => v * k);
const skyOf = s => typeof s === 'string' ? (SKIES[s] || { top: s, hor: s, low: s }) : s;
const SKIES = { day: { top: '#6fa3dc', hor: '#dcd9cc', low: '#b9b2a0' }, sea: { top: '#5f9bd8', hor: '#d8e2e2', low: '#9fb8c4' },
  dusk: { top: '#4a5f9a', hor: '#f0c49a', low: '#b48a78' }, overcast: { top: '#9aa8b4', hor: '#d8d8d2', low: '#b0aca0' }, indoor: { top: '#d9cdb6', hor: '#e8dcc6', low: '#cbbfa8' } };
const KIT = {
  harbour_pier: {
    sky: 'sea',
    // W5 2026-11-04: the pier runs on toward the camera to z 40 (it ended at z 8: wides from z 17-22 showed its end face + water as a
    // brown and a blue band across the bottom of the frame); water still both sides past x +-16
    ground: [{ kind: 'boards', color: '#c09a6c', x: [-16, 16], z: [-3.5, 40], thick: 1.4, tile: 4 }],
    water: { z0: 200, z1: -200, y: -1.1, color: '#5d93b4' },
    boxes: [{ size: [32, .3, .3], at: [0, -.32, -3.6], color: '#6e4e32', ink: .03 },                      // the pier's edge beam
      { size: [4.2, 1.1, 1.6], at: [5.5, -1.3, -8.5], color: '#d65a42' }, { size: [1.4, 1.0, 1.1], at: [6.3, -.2, -8.5], color: '#f2ece0' },  // a moored boat
      { size: [1.1, .8, .9], at: [-3.0, 0, -2.6], color: '#9a7048', tex: 'planks' }, { size: [.8, .55, .7], at: [-3.1, .8, -2.45], color: '#a87c52', tex: 'planks', ry: 20 },
      { size: [.9, .5, .9], at: [8.6, 0, -2.5], color: '#4a6a8a', shape: 'cyl' }],                       // crates + a rope drum
    posts: [{ x: 1.6, z: -3.0, h: .6, r: .32, color: '#3c3f48', cap: true }, { x: 5.6, z: -3.0, h: .6, r: .32, color: '#3c3f48', cap: true }, { x: 10.5, z: -3.0, h: .6, r: .32, color: '#3c3f48', cap: true }],
    fences: [{ from: [-15, -3.25], to: [-.8, -3.25], h: 1.35, gap: 2.4, rails: 2, color: '#e9e2d2', post: .16 }],
    huts: [{ x: -6.4, z: .6, w: 4.2, d: 3.4, h: 4.2, color: '#6f97b0', tex: 'planks', roof: '#b84a3a', door: { x: .7 }, window: { x: -1.1 } }],
    signs: [{ text: 'PIER 3', x: -6.4, y: 3.4, z: .74, w: 2.4, h: .6, bg: '#f0e6cc', fg: '#2f4a5e' }],
    lamps: [{ x: 4.2, z: 6.2, h: 6.5 }],
    marks: { center: [0, 1], a: [-1.5, 1], b: [1.5, 1], edge: [3.4, -2.4], bollard: [5.6, -2.55], hut_door: [-5.7, 1.9], enter_l: [-14, 2], enter_r: [14, 2] },
    points: { seatY: .6, edgeZ: -3.5, waterY: -1.1, bollards: [[1.6, -3], [5.6, -3], [10.5, -3]] },
  },
  park: {
    sky: 'day',
    ground: { kind: 'grass', color: '#8fbf6a', tile: 5 },
    stripes: [{ at: [0, 1.3], size: [60, 2.8], color: '#d8c49a', tex: 'sand' }, { at: [6, -6], size: [2.4, 12], color: '#d8c49a', tex: 'sand' }],
    benches: [{ x: -2.5, z: -1.6, w: 4.2, color: '#a8784c' }],
    trees: [{ x: 4.8, z: -4.2, h: 9 }, { x: -11, z: -9, h: 11 }, { x: 13, z: -12, h: 10 }],
    lamps: [{ x: -6.8, z: -.6, h: 6.5 }],
    boxes: [{ size: [.7, 1.0, .7], at: [-.2, 0, -1.4], color: '#4a6a4a', shape: 'cyl' }],                // bin
    bushes: [{ x: -8.5, z: -2.8, s: 2.2 }, { x: 8.5, z: -2.6, s: 2.6 }, { x: 1.8, z: -5, s: 1.8 }],
    fences: [{ from: [-30, -14], to: [30, -14], h: 1.4, gap: 2.2, rails: 2, color: '#e9e2d2' }],
    marks: { sit: [-3.4, -1.6], sit2: [-1.6, -1.6], bench_front: [-2.5, -.2], center: [0, 1.3], a: [-1.3, 1.3], b: [1.3, 1.3], tree: [3.6, -2.6], lamp: [-6, .2], enter_l: [-14, 1.3], enter_r: [14, 1.3] },
    points: { seatY: .55, benchZ: -1.6, pathZ: [-.1, 2.7] },
  },
  kitchen: {
    sky: 'indoor', sun: { dir: [-.45, .8, .4] },
    // W5 2026-11-04: the tiled floor runs to z 60 (it ended at z 9: a wide from z 17-22 showed the dark ground under it as a brown band
    // across the bottom), the ground past the room is a plain floor tone (was dark brown), the side walls run on to z 20 (new segments
    // from z 6, same colour/trim), so a 16:9 wide never looks past the room's sides into nothing.
    ground: [{ kind: 'floor', color: '#e8dcc6', x: [-7, 7], z: [-3, 60], tile: 2.4 }, { color: '#d6c8ae', y: -.01 }],
    walls: [{ x: 0, z: -3, w: 14.4, h: 7, color: '#e8d6a8', tex: 'plaster', windows: [{ x: 3.4, y: 2.3, w: 3.2, h: 2.2 }], door: { x: -5.2 }, trim: '#b88a5a', skirting: '#b88a5a' },
      { x: -7, z: 1.5, w: 9, h: 7, ry: 90, color: '#dfcc9c', tex: 'plaster', trim: '#b88a5a', skirting: '#b88a5a' },
      { x: 7, z: 1.5, w: 9, h: 7, ry: -90, color: '#dfcc9c', tex: 'plaster', windows: [{ x: 0, y: 2.3, w: 2.4, h: 2.2 }], trim: '#b88a5a', skirting: '#b88a5a' },
      { x: -7, z: 13, w: 14, h: 7, ry: 90, color: '#dfcc9c', tex: 'plaster', trim: '#b88a5a', skirting: '#b88a5a', windows: 0 },
      { x: 7, z: 13, w: 14, h: 7, ry: -90, color: '#dfcc9c', tex: 'plaster', trim: '#b88a5a', skirting: '#b88a5a', windows: 0 }],
    counters: [{ x: 3.6, z: -2.35, w: 6.4, d: 1.3, color: '#7a9a8a', top: '#efe8dc' }],
    boxes: [{ size: [1.5, 3.7, 1.3], at: [-2.6, 0, -2.3], color: '#e8ecee' }, { size: [.05, 1.2, .05], at: [-2.0, 1.9, -1.62], color: '#888', ink: .01, cast: false },   // fridge
      { size: [1.2, .2, .8], at: [3.6, 1.25, -2.4], color: '#9aa4aa' },                                     // sink
      // W5: the stove at the right end of the back counter (mark `stove`): a dark hob plate with four burner rings, the red pot (was
      // standing on the bare top) + a steel saucepan with a handle on it, an oven door with a window and a bar handle on the counter front
      { size: [1.6, .04, 1.0], at: [5.6, 1.25, -2.4], color: '#3b3a40', ink: .015, cast: false },                                  // hob plate
      { size: [.44, .02, .44], at: [5.2, 1.29, -2.15], color: '#24232a', shape: 'cyl', ink: .012, cast: false },                    // burners
      { size: [.44, .02, .44], at: [6.0, 1.29, -2.15], color: '#24232a', shape: 'cyl', ink: .012, cast: false },
      { size: [.36, .02, .36], at: [5.2, 1.29, -2.65], color: '#24232a', shape: 'cyl', ink: .012, cast: false },
      { size: [.36, .02, .36], at: [6.0, 1.29, -2.65], color: '#24232a', shape: 'cyl', ink: .012, cast: false },
      { size: [.5, .5, .5], at: [6.0, 1.29, -2.55], color: '#c84a3a', shape: 'cyl' },                                             // the red pot
      { size: [.56, .05, .56], at: [6.0, 1.79, -2.55], color: '#a83a2c', shape: 'cyl', ink: .015 },                               // its lid
      { size: [.46, .28, .46], at: [5.2, 1.29, -2.15], color: '#a9b2b8', shape: 'cyl' },                                           // saucepan
      { size: [.4, .05, .07], at: [4.8, 1.47, -2.15], color: '#3a3438', ink: .015 },                                                               // its handle
      { size: [1.3, .84, .04], at: [5.6, .14, -1.68], color: '#4b4e57', ink: .02, cast: false },                                   // oven door
      { size: [.86, .3, .02], at: [5.6, .38, -1.655], color: '#26252c', ink: .01, cast: false },                                   // oven window
      { size: [.9, .05, .05], at: [5.6, .86, -1.62], color: '#c9c9cf', ink: .012, cast: false }],                                  // bar handle
    tables: [{ x: -2.4, z: .9, w: 2.6, d: 1.7, h: 1.15, color: '#b88a5a' }],
    stools: [{ x: -4.2, z: .9, h: .55 }, { x: -.6, z: .9, h: .55 }],
    marks: { counter: [3.6, -.95], counter2: [1.4, -.95], stove: [5.6, -.95], fridge: [-2.6, -.8], stool_l: [-4.2, .9], stool_r: [-.6, .9], table_front: [-2.4, 2.4], door: [-5.2, -2.3],
      center: [0, 2.2], a: [-1.3, 2.4], b: [1.5, 2.4], enter_l: [-6, 4.5], enter_r: [6, 4.5] },
    points: { counterH: 1.25, tableH: 1.15, seatY: .55, wallZ: -3 },
    bounds: { x: [-7.5, 7.5], z: [-3, 8] },
  },
  city_street: {
    sky: 'day',
    ground: [{ kind: 'paving', color: '#cfc4b0', x: [-40, 40], z: [-3, 6], tile: 4 }, { color: '#8f8c88', x: [-60, 60], z: [6.5, 60], y: -.3 }],
    boxes: [{ size: [80, .3, .5], at: [0, -.3, 6.25], color: '#a9a296', cast: false }, { size: [.5, 1.1, .5], at: [3.2, 0, 5.4], color: '#3a4a5a', shape: 'cyl' }],
    walls: [{ x: -6.6, z: -3, w: 13, h: 9.5, th: 8, color: '#e6c49a', tex: 'plaster', door: { x: -3.2, h: 3.4, color: '#2f5a4a' },
        windows: [{ x: 2.0, y: .9, w: 5.0, h: 2.8, shop: true }, { x: -3.2, y: 5.8, w: 1.7, h: 2 }, { x: 2.0, y: 5.8, w: 1.7, h: 2 }], sign: { text: 'CAFE', x: 0, y: 4.35, w: 9, h: 1.1, bg: '#2f5a4a', fg: '#f0d890' },
        awning: { x: 2.0, w: 5.8 } },
      { x: 6.6, z: -3, w: 13, h: 11, th: 8, color: '#9fb4bf', tex: 'brick', door: { x: 3.4, h: 3.4, color: '#6b3f2a' },
        windows: [{ x: -2.0, y: .9, w: 5.0, h: 2.8, shop: true }, { x: -2, y: 5.8, w: 1.7, h: 2 }, { x: 3.4, y: 5.8, w: 1.7, h: 2 }, { x: -2, y: 8.4, w: 1.7, h: 1.8 }, { x: 3.4, y: 8.4, w: 1.7, h: 1.8 }],
        sign: { text: 'BOOKS', x: 0, y: 4.35, w: 9, h: 1.1, bg: '#7a2e2e', fg: '#f4ead2' } },
      { x: 0, z: -14, w: 60, h: 16, color: '#b8c4c8', tex: 'plaster', windows: 0 }],
    lamps: [{ x: 8.2, z: 5.2, h: 6.8 }],
    marks: { door1: [-9.8, -2.2], door2: [9.8, -2.2], window1: [-4.6, -1.4], window2: [4.6, -1.4], center: [0, 1.2], a: [-1.4, 1.2], b: [1.4, 1.2],
      kerb: [0, 5.4], lamp: [7.4, 4.4], enter_l: [-14, 2], enter_r: [14, 2] },
    points: { wallZ: -3, kerbZ: 6.25, roadY: -.3 },
  },
};
export const KIT_SETS = Object.keys(KIT);
// tools/make_film.mjs setOf() recognises a world set by the text "name === '<set>'" in this file: keep every kit set listed here
export const isKitSet = name => name === 'harbour_pier' || name === 'park' || name === 'kitchen' || name === 'city_street' || !!KIT[name];
const shadeHex = (h, k) => '#' + hex(h).map(v => Math.round(Math.min(1, v * k) * 255).toString(16).padStart(2, '0')).join('');

// A film's own set: films/<film>/set.js, `export function buildSet(THREE, scene, opts, kit)` (may be async, may import anything by relative path, e.g. '../../world/look/lights.js').
// `opts` = the film's world.setOpts, `kit(nameOrDesc, opts)` = this file's buildSet, to start from a shared set or a boxes list. It returns the set or just { group }: what it leaves
// out is filled here so the stage and the sun shadows work (a set that doesn't read the shadow uniforms simply gets no sun shadow on itself). FILM_API.md "A film's own set".
export async function buildFilmSet(THREE, scene, label, opts, url) {
  let mod;
  try { mod = await import(url); } catch (e) { throw new Error(`STAGE FAILED: film set ${label}: ${e.message}`); }
  if (typeof mod.buildSet !== 'function') throw new Error(`STAGE FAILED: film set ${label} must export function buildSet(THREE, scene, opts, kit)`);
  const set = await mod.buildSet(THREE, scene, opts, (n, o) => buildSet(THREE, scene, n, o));
  if (!set || typeof set !== 'object') throw new Error(`STAGE FAILED: film set ${label}: buildSet must return the set (at least { group })`);
  if (set.group && !set.group.parent) scene.add(set.group);
  return { name: 'film', lightDir: norm(opts.lightDir || SUN_DIR), marks: {}, points: {}, casters: [], update() {},
    uniforms: { uShadowMap: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() }, uShadowOn: { value: 0 }, uShadowTexel: { value: 0 }, uShadowSoft: { value: 1 }, uShadowBias: { value: 0 } }, ...set };
}

// an example film's named set whose module is not here (a member's project): a plain error, never a silent fallback set
function exampleSet(name, mod) {
  if (mod) return mod;
  throw new Error(`The set "${name}" belongs to an example film: build this film's own set in scenes/set.js (world: { set: 'own' }).`);
}

export function buildSet(THREE, scene, name = 'plain', opts = {}) {
  // a description object (ad-hoc film set) or a named kit set -> the kit builder; a non-object, non-string -> null (host falls back)
  opts = Object.fromEntries(Object.entries(opts || {}).filter(([, v]) => v !== undefined && v !== null));
  const desc = name && typeof name === 'object' ? name : KIT[name] || null;
  if (name != null && typeof name !== 'string' && !desc) return null;
  // BACKROOMS (agent D, 2026-11-04): Level 0, its own lit + fogged shader and file textures (world/backrooms.js; `ready` = textures in)
  if (name === 'backrooms') return exampleSet(name, backroomsMod).buildBackrooms(THREE, scene, opts);
  if (name === 'backrooms2') return exampleSet(name, backrooms2Mod).buildBackrooms2(THREE, scene, opts);
  if (name === 's4') return exampleSet(name, s4Mod).buildS4(THREE, scene, opts);
  if (name === 's4_env') return exampleSet(name, s4EnvMod).buildS4Env(THREE, scene, opts);
  if (desc) {
    const sun = desc.sun || {};
    opts = { ...(sun.dir && { lightDir: sun.dir }), ...(sun.warm && { lit: tint(sun.warm, 1.05) }), ...(sun.cool && { shade: tint(sun.cool) }),
      ...(desc.sky && { sky: skyOf(desc.sky) }), ...(desc.ink && { ink: desc.ink }), ...(desc.bounds && { bounds: desc.bounds }), ...opts };
    if (typeof opts.sky === 'string') opts.sky = skyOf(opts.sky);
    // an ad-hoc object without its own sky: keep the host's background colour (lab/stage.html sets it from scene.sky) as a flat sky
    if (typeof name === 'object' && !opts.sky && scene.background?.isColor) { const c = '#' + scene.background.getHexString(); opts.sky = { top: shadeHex(c, .86), hor: c, low: c }; }
    if (typeof name === 'object') name = desc.name || 'custom';
  }
  const group = new THREE.Group(); group.name = `set.${name}`; scene.add(group);
  const lightDir = norm(opts.lightDir || SUN_DIR);
  // shared uniforms: shadow.js fills the shadow map into these; every set material references the same objects
  const U = { uSunDir: { value: new THREE.Vector3(...lightDir) }, uLit: { value: new THREE.Vector3(...(opts.lit || [1.04, .99, .9])) },
    uShade: { value: new THREE.Vector3(...(opts.shade || [.6, .64, .84])) }, uShadowMap: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() },
    uShadowOn: { value: 0 }, uShadowTexel: { value: 1 / 2048 }, uShadowSoft: { value: 1.2 }, uShadowBias: { value: .0006 } };
  const texCache = {};
  const tex = k => texCache[k] || (texCache[k] = canvasTex(THREE, k === 'sign' ? 512 : 512, TEX[k]));
  const mat = (color, map = null, repeat = [1, 1]) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
    uniforms: { ...U, uColor: { value: new THREE.Vector3(...hex(color)) }, uMap: { value: map ? tex(map) : null }, uHasMap: { value: map ? 1 : 0 }, uRepeat: { value: new THREE.Vector2(...repeat) } } });
  const INK = new THREE.MeshBasicMaterial({ color: opts.ink || '#2b2026', side: THREE.BackSide });
  const casters = [];
  // box centred at [x, y0 + h/2, z], sitting on y0; o: { map, rep, ink (D), cast, ry, parent }
  const box = (w, h, d, color, [x, y0, z], o = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, o.map, o.rep || [1, 1]));
    m.position.set(x, y0 + h / 2, z); if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz; if (o.rx) m.rotation.x = o.rx;
    const ink = o.ink ?? .035;
    if (ink) { const e = new THREE.Mesh(m.geometry, INK); e.scale.set(1 + 2 * ink / w, 1 + 2 * ink / h, 1 + 2 * ink / d); m.add(e); }
    (o.parent || group).add(m); if (o.cast !== false) casters.push(m); return m;
  };
  const cyl = (r0, r1, h, color, [x, y0, z], o = {}) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, o.seg || 16), mat(color)); m.position.set(x, y0 + h / 2, z);
    const ink = o.ink ?? .03; if (ink) { const e = new THREE.Mesh(m.geometry, INK); e.scale.set(1 + ink / Math.max(r0, r1), 1 + 2 * ink / h, 1 + ink / Math.max(r0, r1)); m.add(e); }
    group.add(m); if (o.cast !== false) casters.push(m); return m;
  };
  const blobby = (sx, sy, sz, color, [x, y, z], o = {}) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(.5, 20, 12), mat(color)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry;
    const e = new THREE.Mesh(m.geometry, INK); e.scale.setScalar(1 + .06 / Math.min(sx, sy, sz)); m.add(e); group.add(m); casters.push(m); return m;
  };
  const floor = (x0, x1, z0, z1, color, map, tile = 4, y = 0) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat(color, map, [(x1 - x0) / tile, (z1 - z0) / tile])); m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.renderOrder = -2; group.add(m); return m;
  };
  // sky dome (one draw, behind everything)
  const sky = opts.sky || { top: '#6fa3dc', hor: '#dcd9cc', low: '#b9b2a0' };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 12), new THREE.ShaderMaterial({ vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false,
    uniforms: { uTop: { value: new THREE.Vector3(...hex(sky.top)) }, uHor: { value: new THREE.Vector3(...hex(sky.hor)) }, uLow: { value: new THREE.Vector3(...hex(sky.low)) } } }));
  dome.renderOrder = -10; dome.frustumCulled = false; dome.onBeforeRender = (r, s, cam) => dome.position.copy(cam.position); group.add(dome);
  if (opts.background !== false) scene.background = new THREE.Color(sky.hor);

  const marks = {}, points = {};
  let bounds;
  if (desc) {
    const D = desc, arr = v => v == null || v === false ? [] : Array.isArray(v) ? v : [v];
    const signTex = (s) => { const c = document.createElement('canvas'), ar = (s.w || 3) / (s.h || 1); c.width = 512; c.height = Math.max(64, Math.round(512 / ar));
      const g = c.getContext('2d'); g.fillStyle = s.bg || '#2f4a3e'; g.fillRect(0, 0, c.width, c.height); g.strokeStyle = s.fg || '#f0d890'; g.lineWidth = Math.max(4, c.height * .06);
      g.strokeRect(g.lineWidth, g.lineWidth, c.width - 2 * g.lineWidth, c.height - 2 * g.lineWidth);
      g.fillStyle = s.fg || '#f0d890'; let fs = c.height * .62; g.font = `900 ${fs | 0}px Georgia, serif`; const tw = g.measureText(s.text || '').width; if (tw > c.width * .86) { fs *= c.width * .86 / tw; g.font = `900 ${fs | 0}px Georgia, serif`; }
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.text || '', c.width / 2, c.height / 2 + fs * .05);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; return t; };
    const texMat = (color, t) => { const m = mat(color); m.uniforms.uMap.value = t; m.uniforms.uHasMap.value = 1; return m; };
    // grounds: one or many { kind, color, x:[a,b], z:[a,b], y, thick, tile }; the default one is huge
    for (const G of arr(D.ground || {})) {
      const x = G.x || [-200, 200], z = G.z || [-200, 200], k = G.kind === 'boards' ? 'boards' : G.kind && TEX[G.kind] ? G.kind : null;
      const col = G.color || ({ paving: '#cfc4b0', boards: '#c09a6c', grass: '#8fbf6a', sand: '#e2cc9a', floor: '#e8dcc6', dirt: '#d4b48a' }[G.kind]) || opts.ground || '#cdb98f';
      if (G.thick) { box(x[1] - x[0], G.thick, z[1] - z[0], G.edge || shadeHex(col, .72), [(x[0] + x[1]) / 2, (G.y || 0) - G.thick, (z[0] + z[1]) / 2], { cast: false, map: null });
        floor(x[0], x[1], z[0], z[1], col, k, G.tile || 4, (G.y || 0) + .002); }
      else floor(x[0], x[1], z[0], z[1], col, k, G.tile || 4, G.y || 0);
    }
    if (D.water) { const Wt = D.water, x = Wt.x || [-200, 200], z0 = Wt.z0 ?? 0, z1 = Wt.z1 ?? -200;
      floor(x[0], x[1], Math.min(z0, z1), Math.max(z0, z1), Wt.color || '#5d93b4', 'ripple', Wt.tile || 6, Wt.y ?? -1); }
    for (const s of arr(D.stripes)) {                                       // flat ground paint (paths, lines, rugs): lit, shadowed
      const g = new THREE.PlaneGeometry(s.size[0], s.size[1]); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, mat(s.color || '#d8c49a', s.tex || null, [s.size[0] / (s.tile || 4), s.size[1] / (s.tile || 4)]));
      m.material.polygonOffset = true; m.material.polygonOffsetFactor = -1; m.material.polygonOffsetUnits = -2;
      m.position.set(s.at[0], (s.y || 0) + .003, s.at[1]); m.rotation.y = -deg(s.ry); m.renderOrder = -1.5; group.add(m);
    }
    // boxes, the lab/stage.html ad-hoc format: { size:[w,h,d], at:[x,y,z] (sits ON y unless base:false), color, shape:'cyl', ry deg, ink, tex, cast }
    for (const b of arr(D.boxes)) {
      const [w, h, d] = b.size, y0 = b.base === false ? b.at[1] - h / 2 : b.at[1], ink = b.ink === false ? 0 : b.ink ?? .035;
      if (b.shape === 'cyl') { const m = cyl(w / 2, w / 2, h, b.color || '#9a7b5a', [b.at[0], y0, b.at[2]], { ink, cast: b.cast, seg: 20 }); if (d && d !== w) m.scale.z = d / w; }
      else box(w, h, d, b.color || '#9a7b5a', [b.at[0], y0, b.at[2]], { ink, cast: b.cast, ry: deg(b.ry), map: b.tex || null, rep: [Math.max(.3, w / 3), Math.max(.3, h / 3)] });
    }
    // walls: { x, z, w, h, ry, th, color, tex, trim, skirting, door: {x, w 1.6, h 3.2, color} | [..] | true, windows: n | [{x, y, w, h, shop}], sign, awning }
    // x, z = the middle of the FRONT face; ry 0 faces +Z (the camera side); 90 faces +X; local x runs along the wall
    for (const Wl of arr(D.walls)) {
      const g = new THREE.Group(); g.position.set(Wl.x || 0, Wl.y || 0, Wl.z || 0); g.rotation.y = deg(Wl.ry); group.add(g);
      const w = Wl.w || 12, h = Wl.h || 7, th = Wl.th || .4, P = { parent: g, cast: Wl.cast ?? false };
      box(w, h, th, Wl.color || '#e6c49a', [0, 0, -th / 2], { ...P, map: Wl.tex === undefined ? 'plaster' : Wl.tex, rep: [w / 6, h / 6] });
      if (Wl.trim !== false) box(w + .2, .4, th + .25, Wl.trim || '#8a5a44', [0, h, -th / 2], P);
      if (Wl.skirting) box(w, .35, .08, Wl.skirting, [0, 0, .04], { ...P, ink: .015 });
      const doors = Wl.door === true ? [{}] : arr(Wl.door).concat(arr(Wl.doors));
      for (const dr of doors) { const dw = dr.w || 1.6, dh = dr.h || 3.2, x = dr.x || 0;
        box(dw + .36, dh + .18, .12, dr.frame || '#4a3226', [x, 0, .06], P);
        box(dw, dh, .1, dr.color || '#6b3f2a', [x, 0, .14], P);
        if (dr.glass !== false) box(dw * .56, dh * .3, .04, '#8fa9bc', [x, dh * .56, .2], { ...P, ink: .015 });
        box(.14, .14, .1, '#d9b860', [x + dw / 2 - .25, dh * .45, .22], { ...P, ink: .012 }); }
      let wins = Wl.windows ?? 0;
      if (typeof wins === 'number') { const n = wins, s = w / Math.max(1, n); wins = Array.from({ length: n }, (_, i) => ({ x: -w / 2 + s * (i + .5), y: 1.6, w: Math.min(2.2, s * .6), h: 2 }))
        .filter(o => !doors.some(dr => Math.abs((dr.x || 0) - o.x) < ((dr.w || 1.6) + o.w) / 2 + .3)); }
      for (const o of wins) { const ww = o.w || 2.2, wh = o.h || 2, x = o.x || 0, y = o.y ?? 1.6;
        box(ww + .3, wh + .3, .12, o.frame || '#5a3a2a', [x, y - .15, .06], P);
        box(ww, wh, .06, o.glass || '#93aec2', [x, y, .13], { ...P, ink: 0 });
        if (!o.shop) box(.06, wh, .08, o.frame || '#5a3a2a', [x, y, .16], { ...P, ink: 0 }), box(ww, .06, .08, o.frame || '#5a3a2a', [x, y + wh / 2 - .03, .16], { ...P, ink: 0 });
        box(ww + .5, .14, .34, o.sill || '#d8d0c0', [x, y - .3, .17], P); }
      if (Wl.sign) { const s = Wl.sign, m = new THREE.Mesh(new THREE.BoxGeometry(s.w || 6, s.h || 1, .2), texMat('#ffffff', signTex(s)));
        m.position.set(s.x || 0, (s.y ?? h * .5) + (s.h || 1) / 2, .12); const e = new THREE.Mesh(m.geometry, INK); e.scale.set(1 + .07 / (s.w || 6), 1 + .07 / (s.h || 1), 1.3); m.add(e); g.add(m); }
      if (Wl.awning) { const a = Wl.awning, aw = box(a.w || 5, .1, a.d || 1.9, '#ffffff', [0, 0, 0], { ...P, cast: true, map: 'stripes', rep: [(a.w || 5) / 2, 1] });
        aw.position.set(a.x || 0, a.y ?? 4.05, (a.d || 1.9) / 2 * Math.cos(.38) + .1); aw.rotation.x = .38; }
    }
    // posts / bollards { x, z, h, r, color, cap }
    for (const p of arr(D.posts)) { const r = p.r || .3, h = p.h || .9; cyl(r * .9, r, h, p.color || '#3c3f48', [p.x, p.y || 0, p.z]); if (p.cap) cyl(r * 1.15, r * 1.15, .12, p.color || '#3c3f48', [p.x, (p.y || 0) + h, p.z]); }
    // fences / rails { from:[x,z], to:[x,z], h 1.4, gap 1.9, rails 2, color, post (thickness) }
    for (const f of arr(D.fences).concat(arr(D.rails))) {
      const [x0, z0] = f.from, [x1, z1] = f.to, L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / (f.gap || 1.9))), h = f.h || 1.4, pt = f.post || .2, c = f.color || '#9a7a56';
      const ang = Math.atan2(-(z1 - z0), x1 - x0);
      for (let i = 0; i <= n; i++) box(pt, h, pt, c, [x0 + (x1 - x0) * i / n, 0, z0 + (z1 - z0) * i / n], { ink: .025 });
      for (let r = 0; r < (f.rails ?? 2); r++) box(L, .14, .1, c, [(x0 + x1) / 2, h - .2 - r * (h - .3) / Math.max(1, (f.rails ?? 2)), (z0 + z1) / 2], { ry: ang, ink: .02 });
    }
    // trees { x, z, h 9, color } / bushes { x, z, s, color }
    for (const t of arr(D.trees)) { const h = t.h || 9, k = h / 9; cyl(.32 * k, .45 * k, h * .5, t.trunk || '#6a4a32', [t.x, 0, t.z]);
      blobby(4.6 * k, 3.9 * k, 4.6 * k, t.color || '#6f9a52', [t.x, h * .68, t.z]); blobby(3.2 * k, 2.7 * k, 3.2 * k, t.color2 || '#7aa85a', [t.x - 1.3 * k, h * .58, t.z + 1.2 * k]); }
    for (const b of arr(D.bushes)) { const s = b.s || 2; blobby(s * 1.4, s * .9, s, b.color || '#6a9a50', [b.x, s * .4, b.z]); }
    // benches { x, z, ry, w 4.2, seat .55 (the sit clip's hipY), back true }: seat centre at (x, z), back toward -Z when ry 0
    for (const b of arr(D.benches)) { const g = new THREE.Group(); g.position.set(b.x, 0, b.z); g.rotation.y = deg(b.ry); group.add(g);
      const w = b.w || 4.2, s = b.seat ?? opts.seatH ?? .55, c = b.color || '#a8784c', P = { parent: g };
      // FIX-SEAT (2026-11-04): (x, z) = the HIP point of a seated character (the sit marks). The seat is .56 deep and its front edge
      // is .14 in front of that point, the backrest just behind the torso: the thighs lie on it and the knees + shins come out over
      // the front edge (a 1.0 deep seat centred on the mark put the knees ON the seat and hid the legs and the skirt behind its front)
      box(w, .16, SEAT_D, c, [0, s - .16, SEAT_C], { ...P, map: 'planks', rep: [1, .3] });
      for (const sx of [-1, 1]) box(.16, s - .16, SEAT_D - .1, b.legs || '#5a4a40', [sx * (w / 2 - .4), 0, SEAT_C], P);
      if (b.back !== false) { box(w, .7, .12, c, [0, s + .45, SEAT_C - SEAT_D / 2], { ...P, map: 'planks', rep: [1, .3] }); for (const sx of [-1, 1]) box(.14, .9, .14, b.legs || '#5a4a40', [sx * (w / 2 - .4), s - .1, SEAT_C - SEAT_D / 2 + .02], P); }
    }
    // counters { x, z, w, d 1.3, h 1.25 (the cast's waist), ry, color, top } / tables { x, z, w, d, h 1.15, color } / stools { x, z, h .55 }
    for (const c of arr(D.counters)) { const g = new THREE.Group(); g.position.set(c.x, 0, c.z); g.rotation.y = deg(c.ry); group.add(g);
      const w = c.w || 4, d = c.d || 1.3, h = c.h || opts.standH || 1.25, P = { parent: g };
      box(w, h - .12, d, c.color || '#7a9a8a', [0, 0, 0], { ...P, map: 'cabinet', rep: [Math.max(1, Math.round(w / 1.4)), 1] });
      box(w + .14, .12, d + .14, c.top || '#efe8dc', [0, h - .12, .04], P); }
    for (const t of arr(D.tables)) { const w = t.w || 2.4, d = t.d || 1.5, h = t.h || 1.15, c = t.color || '#b88a5a';
      box(w, .14, d, c, [t.x, h - .14, t.z], { map: 'planks', rep: [1, .5] });
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(.14, h - .14, .14, t.legs || '#6a4a32', [t.x + sx * (w / 2 - .2), 0, t.z + sz * (d / 2 - .2)]); }
    for (const s of arr(D.stools)) { const h = s.h || .55; cyl(.42, .42, .12, s.color || '#c8443a', [s.x, h - .12, s.z]); cyl(.08, .14, h - .12, s.legs || '#5a4a40', [s.x, 0, s.z], { ink: .02 }); cyl(.3, .32, .06, s.legs || '#5a4a40', [s.x, 0, s.z], { ink: .02 }); }
    // lamps { x, z, h 6.5, color }
    for (const l of arr(D.lamps)) { const h = l.h || 6.5, c = l.color || '#2f4a3e';
      cyl(.3, .36, .6, c, [l.x, 0, l.z]); cyl(.09, .11, h - 1.4, c, [l.x, .6, l.z]); box(.62, .72, .62, l.glow || '#f3e6b0', [l.x, h - .8, l.z]); box(.86, .16, .86, c, [l.x, h - .08, l.z]); }
    // huts / sheds { x, z, w, d, h, ry, color, tex, roof, door {x}, window {x} }: (x, z) = the middle of the front face
    for (const u of arr(D.huts)) { const g = new THREE.Group(); g.position.set(u.x, 0, u.z); g.rotation.y = deg(u.ry); group.add(g);
      const w = u.w || 4, d = u.d || 3.4, h = u.h || 4.2, P = { parent: g, cast: true };
      box(w, h, d, u.color || '#6f97b0', [0, 0, -d / 2], { ...P, map: u.tex || 'planks', rep: [w / 3, h / 3] });
      box(w + .6, .28, d + .8, u.roof || '#b84a3a', [0, h, -d / 2], P);
      if (u.door !== false) { const dx = u.door?.x || 0; box(1.5, 3.2, .1, '#4a3226', [dx, 0, .05], P); box(1.3, 3.05, .08, u.doorColor || '#f2ece0', [dx, 0, .1], P); box(.12, .12, .08, '#d9b860', [dx + .45, 1.4, .16], { ...P, ink: .012 }); }
      if (u.window) { const wx = u.window.x || 0; box(1.3, 1.1, .1, '#4a3226', [wx, 1.7, .05], P); box(1.05, .85, .06, '#93aec2', [wx, 1.82, .1], { ...P, ink: 0 }); }
    }
    // signs { text, x, y (bottom), z, w, h, bg, fg, ry, post: true = on its own post(s) from the ground }
    for (const s of arr(D.signs)) { const w = s.w || 3, h = s.h || .9, y = s.y ?? 3;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, .14), texMat('#ffffff', signTex(s))); m.position.set(s.x || 0, y + h / 2, s.z || 0); m.rotation.y = deg(s.ry);
      const e = new THREE.Mesh(m.geometry, INK); e.scale.set(1 + .07 / w, 1 + .07 / h, 1.4); m.add(e); group.add(m); casters.push(m);
      if (s.post) for (const sx of w > 2 ? [-1, 1] : [0]) box(.14, y, .14, s.postColor || '#5a4a40', [(s.x || 0) + sx * (w / 2 - .3) * Math.cos(deg(s.ry)), 0, (s.z || 0) - sx * (w / 2 - .3) * Math.sin(deg(s.ry)) - .1], { ink: .02 }); }
    Object.assign(marks, { center: [0, 1] }, D.marks || {});
    Object.assign(points, D.points || {});
    bounds = D.bounds || { x: [-14, 14], z: [-3.5, 7] };
  } else if (name === 'bread_corner') {
    const H = opts.standH ?? 1.25;                                           // stand top: waist of the CAST (hipY 1.17-1.29), see WORLD_API.md
    floor(-18, 18, -3, 6, '#cfc4b0', 'paving', 4);                           // the pavement
    floor(7, 20, -26, -3, '#cfc4b0', 'paving', 4);                           // the side street's pavement
    box(36, .3, .5, '#a9a296', [0, -.3, 6.25], { map: null, cast: false });   // kerb
    floor(-40, 40, 6.5, 40, '#8f8c88', null, 4, -.3);                        // road
    // the shop: one block, front face z = -3, corner at x = 7
    box(25, 9.5, 9, '#e6c49a', [-5.5, 0, -7.5], { map: 'plaster', rep: [4, 2], cast: false });
    box(25.2, .55, 9.2, '#8a5a44', [-5.5, 9.5, -7.5], { cast: false });       // cornice
    box(25.1, .75, .2, '#8a6656', [-5.5, 0, -2.98], { cast: false });         // plinth
    box(2.1, 4.1, .16, '#6b3f2a', [-3.6, 0, -2.95], { cast: false });         // door
    box(1.2, 1.4, .05, '#8fa9bc', [-3.6, 2.2, -2.85], { cast: false, ink: .02 });  // door glass
    box(.16, .16, .1, '#d9b860', [-2.95, 1.85, -2.83], { cast: false, ink: .015 }); // knob
    box(4.4, 2.9, .14, '#5a3a2a', [2.8, 1.25, -2.95], { cast: false });       // shop window frame
    box(4.0, 2.5, .06, '#93aec2', [2.8, 1.45, -2.86], { cast: false, ink: 0 });   // glass
    box(10, 1.1, .22, '#ffffff', [.3, 4.75, -2.9], { map: 'sign', rep: [1, 1], cast: false });   // sign board
    const aw = box(6.2, .1, 2.0, '#ffffff', [2.8, 0, 0], { map: 'stripes', rep: [3, 1] });       // awning, sloped out over the stand
    aw.position.set(2.8, 4.1, -2.1); aw.rotation.x = .38;
    // the corner's side face gets a window too (x = 7, facing +X)
    box(.14, 2.4, 3.2, '#5a3a2a', [7.02, 2.0, -7], { cast: false }); box(.06, 2.0, 2.8, '#93aec2', [7.08, 2.2, -7], { cast: false, ink: 0 });
    // the building across the side street
    box(10, 13, 16, '#b8c4c8', [16, 0, -16], { map: 'plaster', rep: [2, 3], cast: false });
    // the bread stand
    const sx = .6, sz = -.45, sw = 3.4, sd = 1.3;
    box(sw, .14, sd, '#a87a4c', [sx, H - .14, sz], { map: 'planks', rep: [1, .4] });
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(.13, H - .14, .13, '#7a5232', [sx + dx * (sw / 2 - .12), 0, sz + dz * (sd / 2 - .12)]);
    box(sw, H * .62, .04, '#ffffff', [sx, H * .3, sz + sd / 2 + .03], { map: 'cloth', rep: [1, 1] });  // front cloth
    const loaves = [[-1.1, .15], [-.45, -.2], [.25, .2], [1.0, -.1]];
    loaves.forEach(([dx, dz], i) => blobby(.62, .3, .34, i === 3 ? '#c98a42' : '#b8783c', [sx + dx, H + .14, sz + dz], { ry: .3 * i }));
    box(.9, .35, .6, '#9a6a3c', [sx - 1.15, H, sz - .35], { map: 'planks', rep: [.5, .3] });           // basket/tray
    // lamp post (left, near the kerb) + two flower pots by the door
    cyl(.32, .38, .7, '#2f4a3e', [-7.2, 0, 4.6]); cyl(.1, .12, 7.2, '#2f4a3e', [-7.2, .7, 4.6]);
    box(.7, .8, .7, '#f3e6b0', [-7.2, 7.9, 4.6]); box(.95, .18, .95, '#2f4a3e', [-7.2, 8.7, 4.6]);
    for (const x of [-5.4, -1.8]) { cyl(.38, .3, .8, '#b0583a', [x, 0, -2.45]); blobby(.95, .8, .95, '#5f8a4a', [x, 1.05, -2.45]); }
    Object.assign(marks, { baker: [sx, -1.85], customer: [-.4, 1.35], customer2: [1.7, 1.5], center: [.5, .9], door: [-3.6, -2.3],
      enter_l: [-13, 1.8], enter_r: [13, 1.8], exit_l: [-13, 2.2], exit_r: [13, 2.2], lamp: [-6.3, 4.0] });
    Object.assign(points, { standTop: H, loaf: [sx + 1.0, H + .14, sz - .1], standFront: sz + sd / 2, standBack: sz - sd / 2, wallZ: -3 });
    bounds = { x: [-14, 14], z: [-3, 7] };
  } else if (name === 'workshop_yard') {
    const seat = opts.seatH ?? .55;                                           // seat top: the motion sit clip's hipY (legLen * .42), see WORLD_API.md
    floor(-30, 30, -3.4, 30, '#d4b48a', 'dirt', 6);
    // shed: a front wall with a real doorway (walk-off), dark interior, body behind
    // compact on purpose: bench, door and crates fit one 9:16 wide shot
    const wz = -3.2, dx = 2.8, dw = 2.3, dh = 4.4, top = 7.4, x0 = -9, x1 = 6.5, xm = (x0 + x1) / 2, wl = x1 - x0;
    box(dx - dw / 2 - x0, top, .4, '#a2724a', [(x0 + dx - dw / 2) / 2, 0, wz], { map: 'planks', rep: [3, 1.2], cast: false });
    box(x1 - dx - dw / 2, top, .4, '#a2724a', [(dx + dw / 2 + x1) / 2, 0, wz], { map: 'planks', rep: [.75, 1.2], cast: false });
    box(dw, top - dh, .4, '#a2724a', [dx, dh, wz], { map: 'planks', rep: [.5, .5], cast: false });
    box(wl, top, 6, '#9a6a42', [xm, 0, -12.45], { map: 'planks', rep: [3, 1.2], cast: false });   // body behind
    box(.4, top, 12.2, '#9a6a42', [x0 + .2, 0, -9.3], { cast: false }); box(.4, top, 12.2, '#9a6a42', [x1 - .2, 0, -9.3], { map: 'planks', rep: [1.6, 1.2], cast: false });
    const inside = new THREE.Mesh(new THREE.BoxGeometry(wl - .8, top - .1, 6), new THREE.MeshBasicMaterial({ color: '#241a16', side: THREE.BackSide }));
    inside.position.set(xm, top / 2, -6.25); group.add(inside);
    const inFloor = new THREE.Mesh(new THREE.PlaneGeometry(wl - .8, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#4a3628' }));
    inFloor.position.set(xm, .08, -6.25); group.add(inFloor);                                   // the floor you see through the doorway
    // a dim veil just inside the doorway: a character who walks in goes dark (the characters are unlit, they can't darken themselves)
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), new THREE.MeshBasicMaterial({ color: '#120c0a', transparent: true, opacity: .6, depthWrite: false }));
    veil.position.set(dx, dh / 2, wz - .45); group.add(veil);
    box(wl + 1, .35, 2.4, '#5a3a2e', [xm, top, -3.0], { cast: false, rx: -.12 });                // roof edge
    box(wl + .2, .28, .3, '#7a5232', [xm, 5.3, wz + .1], { cast: false });                          // trim board
    box(dw + .5, .3, .5, '#7a5232', [dx, dh, wz + .05], { cast: false });                          // lintel
    const hinge = new THREE.Group(); hinge.position.set(dx + dw / 2, 0, wz + .25); hinge.rotation.y = 1.9; group.add(hinge);   // open door leaf, swung out
    box(dw - .1, dh - .1, .14, '#86603c', [-(dw - .1) / 2, 0, 0], { map: 'planks', rep: [.3, .5], parent: hinge });
    // bench under the window
    const bx = -2.2, bz = -2.15;
    box(2.6, 1.9, .14, '#5a3a2a', [bx, 2.4, wz + .22], { cast: false }); box(2.2, 1.5, .06, '#33404c', [bx, 2.6, wz + .3], { cast: false, ink: 0 });   // window
    // FIX-SEAT: a .56 deep seat whose front edge is .14 in front of the hip mark (was 1.0 deep, centred on it: the knees ended on it)
    box(4.2, .16, SEAT_D, '#b08050', [bx, seat - .16, bz + SEAT_C], { map: 'planks', rep: [1, .3] });
    for (const s of [-1, 1]) box(.16, seat - .16, SEAT_D - .1, '#7a5232', [bx + s * 1.7, 0, bz + SEAT_C]);
    // crates + barrel left, a fence and a tree past the shed's right corner
    box(1.3, 1.3, 1.3, '#b48a58', [-5.6, 0, -2.0], { map: 'planks', rep: [.4, .4] }); box(.9, .9, .9, '#a87e4e', [-5.5, 1.3, -2.05], { map: 'planks', rep: [.3, .3], ry: .4 });
    cyl(.6, .55, 1.5, '#8a5a36', [-7.3, 0, -2.2]);
    for (let x = 7.4; x <= 17; x += 1.9) box(.22, 2.4, .22, '#9a7a56', [x, 0, -3.4]);
    box(10, .2, .12, '#a8865e', [12.2, 1.0, -3.4]); box(10, .2, .12, '#a8865e', [12.2, 1.9, -3.4]);
    cyl(.35, .45, 4.5, '#6a4a32', [10.5, 0, -8]); blobby(5, 4.2, 5, '#6f9a52', [10.5, 6.5, -8]); blobby(3.6, 3, 3.6, '#7aa85a', [9.0, 5.4, -6.6]);
    Object.assign(marks, { sit: [bx - 1.1, bz], sit2: [bx + 1.1, bz], bench_front: [bx, -.6], stand: [.9, .5], center: [0, .6],
      door: [dx, -2.6], door_in: [dx, -5.0], enter_l: [-14, 1.5], enter_r: [14, 1.5] });
    Object.assign(points, { seatY: seat, benchZ: bz, wallZ: wz + .2, doorX: dx });
    bounds = { x: [-14, 14], z: [-3, 7] };
  } else {
    floor(-200, 200, -200, 200, opts.ground || '#cdb98f', null, 4);
    marks.center = [0, 0];
    bounds = { x: [-8, 8], z: [-6, 6] };
  }
  if (opts.bounds) bounds = opts.bounds;
  return { name, group, lightDir, skyColor: sky.hor, marks, points, bounds, casters, uniforms: U, update(t) { /* static sets; animated bits go here */ } };
}

export default { buildSet };
