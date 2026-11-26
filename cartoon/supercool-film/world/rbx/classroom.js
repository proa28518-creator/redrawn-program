// world/rbx/classroom.js: the Roblox V3 classroom kit set (WP-S3, 2026-11-12). Geometry from Blender (blender/rbx/build_classroom.py ->
// world/assets/rbx/classroom/set.glb, layout.json), painted details (chalkboard, alphabet, posters, map, clock) drawn here on canvases.
// Light is data (world/look/lights.js form), read by rigkit's surface shader: no baked light, pure in t. Marks: classroom.PLACES.md.
// Use from a film's own set.js:  import { buildClassroom } from '../../world/rbx/classroom.js';
//                                export function buildSet(THREE, scene, opts) { return buildClassroom(THREE, scene, opts); }
// opts: { look: 'day' | 'afternoon', place: [x, z] (room centre lands there), clay: false, capsules: [[x, z, '#hex'?], ...] }
import { createLightRig } from '../look/lights.js';
import { createKit } from '../look/rigkit.js';
import { readGlb } from '../look/glb.js';
import { createPost } from '../look/post.js';
import { createGround } from './ground.js';
import { createDress, PRESETS } from './dress.js';   // V4-ENV: sprites, decals, textures, AO, form/rim shading (opts.dress: false = V3 look)

const ASSETS = new URL('../assets/rbx/classroom/', import.meta.url);
const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const COLS_X = [-5.4, -1.8, 1.8, 5.4], ROWS_Z = { a: -2, b: 1, c: 4 };
export const MARKS = { teacher: [0, -5.5], board: [0, -7.2], aisle: [0, 2.5], window: [-7.5, 0], door: [8, 5] };
for (const [r, z] of Object.entries(ROWS_Z)) COLS_X.forEach((x, i) => { MARKS[`desk_${r}${i + 1}`] = [x, z]; });
export const SEAT_HEIGHT = 1.15;

// ---- lights per look (linear). Six ceiling panels are too many with the sun and the hall: four room panels + hall + sun + fill (8 max)
const pan = (col, pw) => [[-3.75, -5.25], [3.75, -5.25], [-3.75, 2.6], [3.75, 2.6]].map(([x, z], i) => ({ id: 'p' + i, kind: 'point', pos: [x, 5.2, z], color: col, power: pw, fall: .08, range: 16, wrap: .45 }));
const LOOKS = {
  day: { sky: [.52, .55, .6], ground: [.36, .33, .3], fog: { color: '#eef2f6', density: .002 }, ao: { floor: 0, h: 1.3, amt: .32 },
    // WP-K: the window wall's sun is the key, panels lowered, fill ~40 % of the key
    lights: [...pan([1.0, .98, .94], .7), { id: 'hall', kind: 'point', pos: [13, 5.1, 5], color: [1.0, .97, .9], power: .9, fall: .1, range: 10, wrap: .5 },
      { id: 'sun', kind: 'sun', dir: norm([-.85, .5, .2]), color: [1.0, .94, .82], power: .88, wrap: .25 }, { id: 'fill', kind: 'sun', dir: norm([.3, .7, .9]), color: [.78, .84, .96], power: .35, wrap: .6 }],
    sky3: { top: '#4f9ce8', hor: '#d6ecfb', low: '#a0c8e4', cloudLit: '#ffffff', cloudDark: '#bccfe2', sun: norm([-.85, .5, .2]), sunColor: [.4, .36, .3], cover: .35, scale: 1 } },
  afternoon: { sky: [.5, .4, .34], ground: [.42, .28, .2], fog: { color: '#f6e2cc', density: .002 }, ao: { floor: 0, h: 1.3, amt: .34 },
    lights: [...pan([1.0, .88, .72], .5), { id: 'hall', kind: 'point', pos: [13, 5.1, 5], color: [1.0, .92, .8], power: .8, fall: .1, range: 10, wrap: .5 },
      { id: 'sun', kind: 'sun', dir: norm([-.9, .3, .3]), color: [1.0, .66, .36], power: 1.4, wrap: .3 }, { id: 'fill', kind: 'sun', dir: norm([.4, .6, .7]), color: [.7, .66, .9], power: .5, wrap: .6 }],
    sky3: { top: '#5a7ac8', hor: '#ffd29a', low: '#f0a878', cloudLit: '#ffe6c0', cloudDark: '#b88a8a', sun: norm([-.9, .3, .3]), sunColor: [1.0, .6, .3], cover: .35, scale: 1 } },
};

const BASE = {
  floor: '#e9e4d8', ceiling: '#f3f1ea', tbar: '#e4e2dc', panel_frame: '#dcdad4', wall: '#f4e4bc', wall_front: '#bfe0c8', skirting: '#6a5848', frame: '#f1ede4', blind: '#e8e2d2',
  door: '#a86f42', door_glass: '#cfe6f2', hall_floor: '#dfe6f0', hall_wall: '#f3e6c8', hall_ceiling: '#f1efe8', locker: '#2f63d6', locker_door: '#3a70e6', locker_dark: '#1e2230',
  board_frame: '#9a6a3e', chalk_w: '#f8f8f4', chalk_y: '#fff07a', chalk_p: '#ff9ccf', eraser: '#3a3f4a', clock_rim: '#25262b', screen_roll: '#e8e8e8', steel: '#c4c9cf', steel_dark: '#4d535c',
  chrome: '#d0d5db', gold: '#e8b830', red: '#d8342c', speaker: '#ece9e2', desk_wood: '#b8814c', desk_wood_d: '#9a6a3c', chair_seat: '#2f7ae0', apple: '#e0302a', apple_stem: '#5a3a1e',
  mug: '#f2f2f2', globe_stand: '#5a4a3a', globe: '#3a8ae0', nameplate: '#e8c860', desk_top: '#e8c890', desk_edge: '#c89a60', desk_box: '#5d636c', pencil: '#ffcc1c', pencil_case: '#9a4ae0',
  paper_w: '#fbfaf5', paper_y: '#fff07a', paper_b: '#8fd0ff', paper_p: '#ff9ccf', paper_g: '#9ce87c', cork: '#b98a55',
  book_r: '#e8413a', book_g: '#3fbf5a', book_b: '#3478e0', book_y: '#f5c22a', book_w: '#f2efe6', bag_r: '#e2453c', bag_b: '#3366d6', bag_y: '#f0b820', bag_g: '#3dae58', bag_p: '#c050d8',
  cubby: '#d8b07a', cubby_dark: '#7a5a3a', bin_r: '#ff5a50', bin_b: '#4a8af0', bin_y: '#ffd23a', bin_g: '#4ccf6a', bin_p: '#c070f0', shelf_wood: '#c08a52', rug: '#e05a7a',
  beanbag_r: '#ff6a5a', beanbag_b: '#4ab0f0', grass: '#5fb24a', path: '#cfc3a8', brick: '#b5553f', far_wall: '#f2dcb0', fence: '#f2efe6', window_far: '#9fc6e0',
  k_leafsGreen: '#4fae3c', k_leafsDark: '#2f8a3e', k_grass: '#5cba44', k_plant: '#3f9a3a', k_woodBark: '#7a5236', k_woodBarkDark: '#5e3e28', k_wood: '#c08a52', k_woodDark: '#8a5a34',
  k_metal: '#c4c9cf', k_metalDark: '#4d535c', k_metalMedium: '#7a8088', k_fur: '#b07a48', k_lamp: '#fff2c0', k_carpetDarker: '#9a4a46', k_carpetWhite: '#f6f6f2', k_colorRed: '#e8413a', k_colorYellow: '#ffcf3a',
};
const LOOK_COL = { day: {}, afternoon: { window_far: '#f0c890' } };
const FIN = {
  floor: { gloss: 40, spec: .12, wet: .08, bump: .02, grime: .1 }, wall: { bump: .03, grime: .03 }, wall_front: { bump: .03, grime: .03 }, hall_wall: { grime: .03 }, chrome: { gloss: 70, spec: .8 }, gold: { gloss: 70, spec: 1 },
  steel: { gloss: 55, spec: .5 }, door_glass: { gloss: 80, spec: .9, emit: .2 }, window_far: { emit: .2 }, panel: { emit: 1.1 }, k_lamp: { emit: .6 }, desk_top: { gloss: 35, spec: .25 },
  chair_seat: { gloss: 40, spec: .3 }, locker: { gloss: 30, spec: .22 }, locker_door: { gloss: 34, spec: .25 }, apple: { gloss: 50, spec: .5 }, globe: { gloss: 50, spec: .4 }, desk_wood: { gloss: 25, spec: .15 },
};

function cv(THREE, w, h, draw, wrap = false) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; /* V4: renderer max (three clamps), mipmaps on (CanvasTexture default) */ t.colorSpace = THREE.NoColorSpace; return t; }
const rng = s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
function speckle(g, S, n, a, r0, r1, seed, cols) { const R = rng(seed); for (let i = 0; i < n; i++) { g.globalAlpha = a * R(); g.fillStyle = cols[Math.floor(R() * cols.length)]; const r = r0 + R() * (r1 - r0); g.beginPath(); g.ellipse(R() * S, R() * S, r, r * (.5 + R() * .5), R() * 3, 0, 7); g.fill(); } g.globalAlpha = 1; }
const floorT = (g, S) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S); speckle(g, S, 2200, .08, 1, 4, 3, ['#8a8a8a', '#ffffff', '#b0a890']); const n = 4; g.strokeStyle = 'rgba(120,115,100,.35)'; g.lineWidth = 3; for (let k = 0; k <= n; k++) { g.beginPath(); g.moveTo(k * S / n, 0); g.lineTo(k * S / n, S); g.moveTo(0, k * S / n); g.lineTo(S, k * S / n); g.stroke(); }
  const R = rng(7); for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(150,140,120,.18)'; g.fillRect(Math.floor(R() * n) * S / n + 2, Math.floor(R() * n) * S / n + 2, S / n - 4, S / n - 4); } };
const plaster = (g, S) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S); speckle(g, S, 2200, .05, 1, 6, 11, ['#b8b0a0', '#ffffff']); speckle(g, S, 60, .04, 30, 90, 12, ['#d8d0c0']); };
const ceilT = (g, S) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S); speckle(g, S, 3000, .12, 1, 3, 13, ['#9a9690']); };
const fontB = px => `900 ${px}px "Arial Black", Arial, sans-serif`;
const hand = px => `700 ${px}px "Comic Sans MS", "Segoe Print", Arial, sans-serif`;
const text = (g, s, x, y, px, col, stroke, font = fontB) => { g.font = font(px); g.textAlign = 'center'; g.textBaseline = 'middle'; if (stroke) { g.lineWidth = px * .14; g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(s, x, y); } g.fillStyle = col; g.fillText(s, x, y); };
const PICS = {
  board_chalk: (g, w, h) => { g.fillStyle = '#2f5a44'; g.fillRect(0, 0, w, h); speckle(g, w, 260, .06, 10, 60, 4, ['#cfe0d0', '#1f3a2c']); g.globalAlpha = .9;
    text(g, 'Today: Fractions!', w * .3, h * .16, h * .1, '#f6f4ea', null, hand); text(g, '1/2 + 1/4 = 3/4', w * .3, h * .36, h * .09, '#f6f4ea', null, hand); text(g, '2 + 2 = 4', w * .22, h * .55, h * .08, '#fff07a', null, hand);
    g.strokeStyle = '#f6f4ea'; g.lineWidth = 6; g.beginPath(); g.arc(w * .72, h * .45, h * .22, 0, 7); g.stroke(); g.beginPath(); g.moveTo(w * .72, h * .23); g.lineTo(w * .72, h * .67); g.moveTo(w * .72, h * .45); g.lineTo(w * .72 + h * .22, h * .45); g.stroke();
    g.fillStyle = 'rgba(255,156,207,.75)'; g.beginPath(); g.moveTo(w * .72, h * .45); g.arc(w * .72, h * .45, h * .21, -Math.PI / 2, 0); g.fill();
    text(g, 'Homework p. 42', w * .7, h * .84, h * .07, '#ff9ccf', null, hand); g.globalAlpha = .2; g.fillStyle = '#ffffff'; g.fillRect(w * .05, h * .7, w * .3, h * .14); g.globalAlpha = 1; },
  alphabet: (g, w, h) => { const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', cs = ['#e8413a', '#ff8a1c', '#f5c22a', '#3fbf5a', '#3478e0', '#9a4ae0']; const cw = w / L.length;
    for (let i = 0; i < L.length; i++) { g.fillStyle = cs[i % cs.length]; g.fillRect(i * cw + 2, 0, cw - 4, h); g.fillStyle = '#ffffff'; g.fillRect(i * cw + 8, 6, cw - 16, h - 12); text(g, L[i] + L[i].toLowerCase(), i * cw + cw / 2, h / 2 + 2, h * .52, cs[i % cs.length]); } },
  clock_face: (g, w) => { const c = w / 2; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(c, c, c, 0, 7); g.fill(); g.fillStyle = '#222'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.save(); g.translate(c + Math.sin(a) * c * .8, c - Math.cos(a) * c * .8); g.rotate(a); g.fillRect(-4, -14, 8, i % 3 ? 16 : 28); g.restore(); }
    g.lineCap = 'round'; g.strokeStyle = '#222'; g.lineWidth = 12; g.beginPath(); g.moveTo(c, c); g.lineTo(c + c * .4, c + c * .1); g.stroke(); g.lineWidth = 7; g.beginPath(); g.moveTo(c, c); g.lineTo(c - c * .05, c - c * .66); g.stroke(); },
  map_world: (g, w, h) => { g.fillStyle = '#8fd0f0'; g.fillRect(0, 0, w, h); g.fillStyle = '#7ccf6a'; const blobs = [[.2, .35, .14, .18], [.27, .7, .07, .16], [.5, .32, .08, .1], [.53, .62, .09, .17], [.72, .38, .17, .15], [.84, .76, .07, .06]];
    for (const [x, y, rx, ry] of blobs) { g.beginPath(); g.ellipse(x * w, y * h, rx * w, ry * h, .3, 0, 7); g.fill(); } g.strokeStyle = '#5a3a1e'; g.lineWidth = 10; g.strokeRect(0, 0, w, h); text(g, 'OUR WORLD', w / 2, h * .1, h * .08, '#1f3c8a'); },
  flag_us: (g, w, h) => { for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#c8302c'; g.fillRect(0, i * h / 13, w, h / 13 + 1); } g.fillStyle = '#2a3a7a'; g.fillRect(0, 0, w * .42, h * .54); g.fillStyle = '#ffffff'; for (let i = 0; i < 20; i++) { g.beginPath(); g.arc(w * (.04 + (i % 5) * .085), h * (.07 + Math.floor(i / 5) * .12), 3, 0, 7); g.fill(); } },
  poster_c1: (g, w, h) => { g.fillStyle = '#ffe14d'; g.fillRect(0, 0, w, h); text(g, 'READ', w / 2, h * .16, w * .26, '#1f2a6a'); for (let i = 0; i < 4; i++) { g.fillStyle = ['#e8413a', '#3478e0', '#3fbf5a', '#9a4ae0'][i]; g.fillRect(w * (.14 + i * .19), h * .32, w * .15, h * .45); } text(g, 'every day!', w / 2, h * .88, w * .12, '#1f2a6a'); },
  poster_c2: (g, w, h) => { g.fillStyle = '#7ce0ff'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(w * .5, h * .35, w * .22, 0, 7); g.fill(); g.fillStyle = '#3fbf5a'; g.fillRect(0, h * .62, w, h * .38); text(g, 'THE WATER', w / 2, h * .72, w * .12, '#ffffff', '#1a5a2e'); text(g, 'CYCLE', w / 2, h * .85, w * .16, '#ffffff', '#1a5a2e'); },
  poster_c3: (g, w, h) => { g.fillStyle = '#ff8fb8'; g.fillRect(0, 0, w, h); text(g, 'BE KIND', w / 2, h / 2, h * .32, '#ffffff', '#b0143a'); },
  poster_c4: (g, w, h) => { g.fillStyle = '#7b4fd6'; g.fillRect(0, 0, w, h); text(g, 'STAR STUDENTS', w / 2, h * .3, h * .16, '#ffe14d'); for (let i = 0; i < 6; i++) { g.save(); g.translate(w * (.12 + i * .155), h * .66); g.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? h * .07 : h * .16, a = k * Math.PI / 5 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fillStyle = '#ffe14d'; g.fill(); g.restore(); } },
};
const PIC_SIZE = { board_chalk: [1536, 506], alphabet: [2600, 96], clock_face: [512, 512], map_world: [768, 460], flag_us: [384, 250], poster_c1: [512, 666], poster_c2: [512, 658], poster_c3: [512, 330], poster_c4: [768, 432] };

export function buildClassroom(THREE, scene, opts = {}) {
  const lookName = LOOKS[opts.look] ? opts.look : 'day', L = LOOKS[lookName], COL = { ...BASE, ...LOOK_COL[lookName] }, clay = !!opts.clay;
  const group = new THREE.Group(); group.name = 'set.rbx_classroom.' + lookName; scene.add(group);
  const [ox, oz] = opts.place || [0, 0]; group.position.set(ox, 0, oz);
  const lights = L.lights.map(l => ({ ...l, pos: l.pos && [l.pos[0] + ox, l.pos[1], l.pos[2] + oz] }));
  const rig = createLightRig(THREE, { room: { sky: L.sky, ground: L.ground, fog: L.fog, ao: L.ao, lights } }, {});
  const sun = L.lights.find(l => l.id === 'sun'), lightDir = sun.dir.slice();
  const SH = { uShadowMap: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() }, uShadowOn: { value: 0 }, uShadowTexel: { value: 1 / 2048 }, uShadowSoft: { value: 1.4 }, uShadowBias: { value: .0006 }, uSunDir: { value: new THREE.Vector3(...lightDir) } };
  const kit = createKit(THREE, rig, { shadow: SH, group });
  const DM = {}, DR = createDress(THREE, { kit, rig, place: 'room', group, key: lightDir, night: lookName === 'night', opts: clay ? false : (opts.dress ?? {}), marks: DM }); DR.wrap();
  const fT = cv(THREE, 512, 512, floorT, true), pT = cv(THREE, 512, 512, plaster, true), cT = cv(THREE, 256, 256, ceilT, true);
  const pics = {}; for (const [k, f] of Object.entries(PICS)) pics[k] = cv(THREE, ...PIC_SIZE[k], f);
  const mats = {};
  const matOf = (key, glbColor) => { if (mats[key]) return mats[key];
    if (clay) return (mats[key] = kit.surface('room', key === 'panel' ? '#ffffff' : '#c9c9c9', { emit: key === 'panel' ? 1 : 0 }));
    const F = FIN[key] || {};
    let color = COL[key] || (glbColor ? '#' + glbColor.map(v => Math.round(Math.pow(v, 1 / 2.2) * 255).toString(16).padStart(2, '0')).join('') : '#c0c0c0');
    let map = null, uv = 4, tile = [1, 1];
    if (key === 'floor' || key === 'hall_floor') { map = fT; tile = [3, 3]; }
    else if (/^wall|hall_wall/.test(key)) { map = pT; tile = [3, 3]; }
    else if (/ceiling/.test(key)) { map = cT; tile = [1.5, 1.5]; }
    else if (pics[key]) { map = pics[key]; uv = 0; color = '#ffffff'; }
    if (key === 'panel') color = lookName === 'afternoon' ? '#fff0d8' : '#ffffff';
    return (mats[key] = kit.surface('room', color, { map, uv, tile, bump: F.bump, gloss: F.gloss, spec: F.spec, wet: F.wet, grime: F.grime, emit: F.emit })); };

  kit.sky(ox - 20, oz, 160, L.sky3);
  const G = createGround(THREE, group, {});   // WP-K grounding: AO at the ceiling and the wall foot, blobs under people and props
  G.bands({ x: [-9, 9], z: [-8, 8], ceil: 5.6, floor: true, h: .8, a: .34 });
  for (const [x, z, c] of opts.capsules || []) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(.62, 1.76, 8, 20), kit.surface('room', c || '#e8e2d6', { gloss: 10, spec: .1 })); m.position.set(x, 1.5, z); m.scale.set(1, 1, .7); m.name = 'capsule'; group.add(m); G.contactBlob([x + ox, z + oz], .8); }

  const stats = { prims: 0, mats: 0 };
  const ready = (async () => {
    const glb = await readGlb(THREE, new URL('set.glb', ASSETS).href);
    if (!glb) { console.log('rbx classroom: set.glb missing'); return stats; }
    for (const root of glb.roots) for (const p of root.prims) { const key = (p.material || root.name).split('.')[0];
      const o = new THREE.Mesh(p.geometry, matOf(key, p.color)); o.applyMatrix4(root.matrix); o.name = 'set.' + key; o.frustumCulled = false; group.add(o); stats.prims++;
      G.auto(o, key, { floorY: 0 }); }
    stats.blobs = G.flush(); stats.mats = Object.keys(mats).length; stats.dress = await DR.finish(PRESETS.classroom()); return stats;
  })();

  function update(t) { rig.update(t); kit.update(t); }
  update(0);
  const marks = Object.fromEntries(Object.entries(MARKS).map(([k, [x, z]]) => [k, [x + ox, z + oz]]));
  Object.assign(DM, marks);
  const look = opts.post ? createPost(THREE, rig, opts.post) : undefined;
  return { name: 'rbx_classroom', group, lightDir, skyColor: L.fog.color, marks, seatHeight: SEAT_HEIGHT, points: { board: [ox - 1, 3.0, oz - 8] }, bounds: { x: [-9 + ox, 9 + ox], z: [-8 + oz, 8 + oz] }, casters: [], uniforms: SH, update, ready, rig, look, lookName, contactBlob: G.contactBlob };
}
export default { buildClassroom };
