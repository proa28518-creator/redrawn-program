// world/rbx/home.js: the Roblox V3 homes kit (WP-S2, 2026-11-12). Rooms: bedroom_bunk (levitate), bedroom_sister (levitate's second
// bedroom: shelves, blue trim, beanbag window corner), bedroom_whistle (nightstand, white door, chandelier), bedroom_parents (love, night),
// house_hall (levitate: dark wood, brown doors), living (love: TV over the fireplace, armchairs), kitchen (whistle: dark brick, plates),
// cafeteria (sneeze: serving line, tables), bakery (sneeze: French bakery).
// Geometry from Blender (blender/rbx/build_home.py -> world/assets/rbx/home/<room>.glb + layout.json); painted details (posters, menus,
// TV, calendar) drawn here on canvases. Light is data (world/look/lights.js form, max 8), read by rigkit's surface shader: pure in t.
// Use from a film's own set.js:  import { buildHome } from '../../world/rbx/home.js';
//                                export function buildSet(THREE, scene, opts) { return buildHome(THREE, scene, opts); }
// opts: { room: '<room>', look: 'day' | 'evening' | 'night', clay: false, capsules: [[x, z, '#hex'?], ...], post: {...}, place: [x, z] offset }
// Places, marks and keep-clear lanes: world/rbx/home.PLACES.md. Walls never move.
import { createLightRig } from '../look/lights.js';
import { createKit } from '../look/rigkit.js';
import { readGlb } from '../look/glb.js';
import { createPost } from '../look/post.js';
import LAYOUT from '../assets/rbx/home/layout.js';
import { createGround } from './ground.js';
import { createDress, PRESETS } from './dress.js';   // V4-ENV: sprites, decals, textures, AO, form/rim shading (opts.dress: false = V3 look)

const ASSETS = new URL('../assets/rbx/home/', import.meta.url);
const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };

// ---- rooms: box [W2, ZB, ZF, CEIL], fixtures (ceiling lights), lamps (table / floor lamps), sun = direction TO the sun through the main
//      window, default look, colours, marks (same numbers as build_home.py's layout.json)
const ROOMS = {
  bedroom_bunk: { box: [8, -6, 14, 6.4], fixtures: [[0, 5.3, 0]], lamps: [[-2.9, 2.0, -5.3], [6.8, 2.2, -5.2]], sun: [.35, .55, -.75], look: 'day',
    col: { wall: '#9fdc86', carpet: '#e8dcc4', trim: '#f4f1e6', skirting: '#f4f1e6', window_frame: '#ffffff', sill: '#ffffff', rug_a: '#3f7fe0', rug_a_edge: '#f2c230' },
    marks: { center: [0, 0], bunk: [-3.6, -3.8], desk: [5.2, -2.6], window: [3.4, -3.6], door: [-6.6, 6.0], toys: [-2.4, 2.0] } },
  bedroom_sister: { box: [8, -6, 14, 6.4], fixtures: [[0, 5.0, 0]], lamps: [[-2.9, 2.0, -5.3], [6.9, 3.6, -4.6]], sun: [.35, .55, -.75], look: 'day',
    col: { wall: '#f6eadf', carpet: '#e6d8c8', trim: '#3f86e8', skirting: '#3f86e8', window_frame: '#3f86e8', sill: '#3f86e8', beanbag: '#4ec24a', beanbag_dent: '#45b042', door: '#3f86e8', door_panel: '#5a98ee' },
    marks: { center: [0, 0], bed: [-3.6, -3.9], shelves: [-1.0, -3.8], beanbag: [5.0, -1.2], window: [3.4, -3.6], door: [-6.6, 6.0] } },
  bedroom_whistle: { box: [8, -6, 14, 6.4], fixtures: [[0, 5.0, 0]], lamps: [[6.1, 2.0, -5.4], [-6.9, 3.4, -4.8]], sun: [.35, .55, -.75], look: 'day',
    col: { wall: '#cfe3f2', carpet: '#d9cdb8', trim: '#ffffff', skirting: '#ffffff', rug_b: '#c84a3c', rug_b_edge: '#f0dcb0' },
    marks: { center: [0, 0], bed: [1.6, -3.9], nightstand: [5.9, -4.4], white_door: [-4.6, -4.2], window: [3.4, -3.6], door: [-6.6, 6.0] } },
  bedroom_parents: { box: [8, -6, 14, 6.4], fixtures: [[0, 5.3, 0]], lamps: [[-3.0, 2.2, -5.3], [3.0, 2.2, -5.3]], sun: [.35, .55, -.75], look: 'night',
    col: { wall: '#d8c8e8', trim: '#f4eef8', skirting: '#f4eef8', floor_wood: '#a8754a' },
    marks: { center: [0, 0], bed: [0, -2.4], bed_l: [-1.2, -2.4], bed_r: [1.2, -2.4], window: [3.4, -3.6], door: [-6.6, 6.0] } },
  house_hall: { box: [3.6, -26, 10, 6.0], fixtures: [[0, 4.9, 4], [0, 4.9, -6], [0, 4.9, -15], [0, 4.9, -22]], lamps: [[3.1, 2.6, -9.8]], sun: [.1, .5, -.9], look: 'day',
    col: { wall: '#efe2c6', floor_wood: '#5a3a26', wainscot: '#6b4430', trim: '#4a2e1e', skirting: '#3a2418', door: '#7a4a2c', door_panel: '#6a3e24', door_frame: '#4a2e1e', runner: '#a8343a', runner_edge: '#e0b84a', window_frame: '#4a2e1e', sill: '#4a2e1e' },
    marks: { hall_mid: [0, -4], front: [0, 6], door_l1: [-1.6, 2], door_r1: [1.6, -5], door_l2: [-1.6, -12], door_r2: [1.6, -16], window: [0, -22.5], console: [1.6, -9] } },
  living: { box: [9, -7, 14, 6.6], fixtures: [[0, 5.2, 1]], lamps: [[-8.3, 3.6, -3.8], [8.2, 3.6, 3.0], [0, .8, -6.0]], sun: [.85, .5, -.15], look: 'day',
    col: { wall: '#f2ece2', chimney: '#e6ddd0', floor_wood: '#c08a5a', tv_body: '#1a1c22', 'q_curt_Couch_Blue': '#e8b830', q_rug_DarkRed: '#3c5a8a', q_rug_LightOrange: '#e8dcc4' },
    marks: { center: [0, 0], fireplace: [0, -4.6], sofa: [-6.6, .8], arm_r: [5.4, -3.6], arm_l: [-5.2, -3.9], window: [6.6, -1.0], door: [-7.4, 7.0] } },
  kitchen: { box: [8, -6, 13, 6.4], fixtures: [[0, 4.6, -1], [4.5, 4.6, 3]], lamps: [], sun: [-.2, .55, -.8], look: 'evening',
    col: { brick: '#7a3a2e', floor_tile: '#e8e4dc', cabinet: '#3a4458', cabinet_door: '#46526a', counter_top: '#d8d4cc', kick: '#1c1f26', hood: '#9aa0a8', trim_dark: '#2a2420', skirting: '#2a2420', window_frame: '#2a2420', sill: '#d8d4cc' },
    marks: { center: [0, 0], counter: [-2.6, -3.6], sink: [.8, -3.6], table: [4.5, 3.0], fridge: [-6.6, -3.4], door: [6.6, 6.0] } },
  cafeteria: { box: [12, -10, 14, 7.0], fixtures: [[-6, 6.7, -5], [0, 6.7, -5], [6, 6.7, -5], [-6, 6.7, 3], [0, 6.7, 3], [6, 6.7, 3]], lamps: [], sun: [-.85, .5, .1], look: 'day',
    col: { wall: '#f4ecd8', wainscot: '#4a8ad8', trim: '#2f63d6', skirting: '#2f63d6', floor_tile: '#ffffff', table_top: '#f2d06a', bench: '#e85a40', wall_tile: '#e8eef2' },
    marks: { center: [0, 0], line: [0, -5.6], line_l: [-4, -5.6], line_r: [4, -5.6], table_l: [-7.5, .4], table_r: [7.5, .4], under_table: [-7.5, 2.0], door: [10.4, 7.0] } },
  bakery: { box: [7, -6, 12, 6.4], fixtures: [[-3.5, 4.9, -2.6], [1.0, 4.9, -2.6], [5.0, 4.9, 6.0]], lamps: [], sun: [-.3, .55, .8], look: 'day',
    col: { wall: '#fbeee0', wainscot: '#f2c4c8', trim: '#c8606a', skirting: '#c8606a', floor_tile: '#ffffff', wood: '#c88a52', wood_dark: '#8a5432', shelf_wood: '#b07a48', awning_a: '#e84a5a', awning_b: '#ffffff' },
    marks: { center: [0, 1], counter_front: [-1, -.6], behind_counter: [-1, -4.6], till: [4.6, -.8], table_a: [-4, 6.5], table_b: [2, 7.5] } },
};

// ---- lights per look, built from the room's fixtures / lamps / window
function lightsOf(R, look) {
  const sun = norm(R.sun), L = [];
  const day = look === 'day', eve = look === 'evening', night = look === 'night';
  const fx = R.fixtures.slice(0, night ? 3 : 4), lp = R.lamps.slice(0, 2);
  // WP-K: one clear key per look. Day / evening: the sun through the main window is the key, fill ~40 % of it from the opposite side,
  // ceiling fixtures lowered so they no longer flatten the room. Night: the lamps are the key, moon + fill stay low.
  fx.forEach((p, i) => L.push({ id: 'fx' + i, kind: 'point', pos: p, color: night ? [1.0, .78, .52] : [1.0, .95, .86], power: night ? .55 : day ? .58 : .7, fall: .06, range: 18, wrap: .45 }));
  lp.forEach((p, i) => L.push({ id: 'lamp' + i, kind: 'point', pos: p, color: [1.0, .72, .42], power: night ? 1.1 : .35, fall: .5, range: 8, wrap: .5 }));
  if (day) { L.push({ id: 'sun', kind: 'sun', dir: sun, color: [1.0, .93, .8], power: .9, wrap: .25 }); L.push({ id: 'fill', kind: 'sun', dir: norm([-sun[0] * .5, .8, .6]), color: [.78, .85, 1.0], power: .36, wrap: .65 }); }
  if (eve) { L.push({ id: 'sun', kind: 'sun', dir: norm([sun[0], .25, sun[2]]), color: [1.0, .66, .38], power: .8, wrap: .25 }); L.push({ id: 'fill', kind: 'sun', dir: norm([.2, .8, .6]), color: [.7, .72, .95], power: .32, wrap: .65 }); }
  if (night) { L.push({ id: 'moon', kind: 'sun', dir: norm([sun[0], .5, sun[2]]), color: [.35, .45, .95], power: .3, wrap: .4 }); L.push({ id: 'fill', kind: 'sun', dir: norm([.2, .8, .6]), color: [.35, .38, .7], power: .14, wrap: .7 }); }
  return L.slice(0, 8);
}
const AMB = {
  day: { sky: [.52, .54, .58], ground: [.38, .34, .3], fog: { color: '#eef3f8', density: .003 },
    sky3: { top: '#5fa8ea', hor: '#d6ecfb', low: '#9fc7e4', cloudLit: '#ffffff', cloudDark: '#b9cde0', sunColor: [.4, .36, .3], cover: .35, scale: 1 } },
  evening: { sky: [.42, .38, .4], ground: [.3, .24, .2], fog: { color: '#f2dcc8', density: .003 },
    sky3: { top: '#4a6ab8', hor: '#ffb27a', low: '#e88a6a', cloudLit: '#ffd0a0', cloudDark: '#9a7090', sunColor: [.5, .3, .15], cover: .35, scale: 1 } },
  night: { sky: [.13, .13, .22], ground: [.08, .07, .1], fog: { color: '#1a1830', density: .006 },
    sky3: { top: '#0b0f2e', hor: '#2c2a5e', low: '#1a1840', cloudLit: '#47457e', cloudDark: '#0e0e26', sunColor: [.1, .12, .2], cover: .3, scale: 1 } },
};

// ---- colours (sRGB hex). Keys = Blender material names; imported models (q_*, k_*, kf_*) keep their own colour unless named here
const BASE = {
  ceiling: '#f6f4ee', trim: '#f4f1e6', skirting: '#e8e2d4', wall: '#f2ead8', wall_next: '#e8dcc4', floor_next: '#c08a5a', carpet: '#e4d8c0', floor_wood: '#b47a4a', floor_tile: '#f2f0ea',
  window_frame: '#ffffff', sill: '#ffffff', door: '#a86f42', door_panel: '#9a6238', door_white: '#f6f4f0', door_white_panel: '#ecebe6', door_frame: '#f4f1e8', door_glass: '#cfe6f2', door_glass_panel: '#bcd8e8',
  brass: '#e0b048', chrome: '#cfd4da', steel: '#c4c9cf', steel_dark: '#5a606a', glass: '#dff0f8', frame_dark: '#3a2a20', frame_white: '#f8f8f4', frame_gold: '#d8a838',
  grass: '#5fb24a', fence: '#f6f2e8', house_far: '#e8c89a', roof_far: '#b8463a', window_far: '#9fc6e0', sidewalk: '#d8d2c8',
  book_r: '#e8413a', book_g: '#3fbf5a', book_b: '#3478e0', book_y: '#f5c22a', book_p: '#c05ae0', shelf_wood: '#c08a52', wood: '#b07a48', wood_dark: '#6a4028',
  pillow_a: '#ffffff', pillow_b: '#ffd6e4', pillow_c: '#ffd75a', ball_r: '#e8413a', toy_b: '#3a78ea', toy_y: '#ffd23a', toy_g: '#3fbf5a', toy_p: '#d05ae8',
  rug_a: '#3f7fe0', rug_a_edge: '#f2c230', rug_b: '#c84a3c', rug_b_edge: '#f0dcb0', runner: '#a8343a', runner_edge: '#e0b84a', beanbag: '#4ec24a', beanbag_dent: '#45b042',
  shoe_r: '#d83a30', shoe_b: '#2a4a9a', chimney: '#e6ddd0', fire_glow: '#ff9a3a', log: '#6a4026', tv_body: '#1a1c22', hood: '#9aa0a8', kick: '#2a2a2a',
  cabinet: '#f4f0e6', cabinet_door: '#ffffff', counter_top: '#d8d4cc', brick: '#b5553f', trim_dark: '#3a2a20', wainscot: '#e8e0cc',
  tray_r: '#e8413a', tray_g: '#3fbf5a', tray_b: '#3478e0', tray_y: '#f5c22a', tray_rail: '#c4c9cf', table_top: '#f2d06a', bench: '#e85a40', wall_tile: '#e8eef2', pass_dark: '#2a2e36',
  panel: '#ffffff', panel_frame: '#dcdad4', awning_a: '#e84a5a', awning_b: '#ffffff', curtain: '#f2c84a', curtain_tie: '#c8962a', cork: '#b98a55',
  bag_b: '#3366d6', bag_p: '#e85aa8', bag_strap: '#22305a', cloth_a: '#e8413a', cloth_b: '#f2f2f2', cloth_c: '#3fbf5a', q_fire_Marble: '#f0e8da',
  paper_w: '#fbfaf5', paper_y: '#fff07a', paper_b: '#8fd0ff', paper_p: '#ff9ccf', paper_g: '#9ce87c',
  k_leafsGreen: '#4fae3c', k_grass: '#5cba44', k_plant: '#3f9a3a', k_woodBark: '#7a5236',
};
const LOOK_COL = {
  night: { grass: '#2d5a40', k_leafsGreen: '#2d6a48', k_grass: '#2d6a40', window_far: '#ffc46a', house_far: '#5a5070', roof_far: '#4a2a3a', fence: '#8a88a8', sidewalk: '#4a4858' },
  evening: { window_far: '#ffd08a' },
};
// how each surface answers light (rigkit surface options)
const FIN = {
  floor_wood: { gloss: 40, spec: .18, bump: .02, grime: .08 }, floor_tile: { gloss: 50, spec: .2, wet: .08, grime: .06 }, carpet: { bump: .05, grime: .05 },
  wall: { bump: .02, grime: .02 }, ceiling: { emit: .08 }, brick: { bump: .08, grime: .15 }, door: { gloss: 25, spec: .15, bump: .03 }, door_white: { gloss: 30, spec: .15 },
  chrome: { gloss: 70, spec: .8 }, brass: { gloss: 70, spec: .9 }, steel: { gloss: 55, spec: .5 }, glass: { gloss: 90, spec: 1.0 }, frame_gold: { gloss: 60, spec: .8 },
  cabinet_door: { gloss: 35, spec: .2 }, counter_top: { gloss: 50, spec: .35 }, tv_body: { gloss: 60, spec: .5 }, table_top: { gloss: 40, spec: .25 },
  window_far: { emit: .25 }, panel: { emit: 1.1 }, pic_tv: { emit: .8 }, fire_glow: { emit: 1.4 }, q_Light: { emit: 1.0 }, 'q_fire_Marble': { gloss: 40, spec: .3 },
  pic_mirror: { gloss: 90, spec: 1.0 },
};
const NIGHT_EMIT = { window_far: .8, q_Light: 1.2 };

// ---- canvas pictures
function cv(THREE, w, h, draw, wrap = false) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; /* V4: renderer max (three clamps), mipmaps on (CanvasTexture default) */ t.colorSpace = THREE.NoColorSpace; return t; }
const rng = s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
// V4 flicker fix (2026-11-12): the Kenney rugs in living / bedroom_parents / bedroom_sister lie 0-1 mm on the floor and their border
// stripe 0-1 mm on the rug (love f634: a wood sliver along the rug's border). Rug 2 cm up, border stripe 1.5 cm above the rug, like the
// rug_a / rug_b / runner layers (edge .025, rug .04). Feet still read as on the rug (3.5 cm at most).
const RUG_LIFT = { q_rug_DarkRed: .02, q_rug_LightOrange: .035 };
function speckle(g, S, n, a, r0, r1, seed, cols) { const R = rng(seed); for (let i = 0; i < n; i++) { g.globalAlpha = a * R(); g.fillStyle = cols[Math.floor(R() * cols.length)]; const r = r0 + R() * (r1 - r0); g.beginPath(); g.ellipse(R() * S, R() * S, r, r * (.5 + R() * .5), R() * 3, 0, 7); g.fill(); } g.globalAlpha = 1; }
const TEX = {
  carpet: (g, S) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S); speckle(g, S, 9000, .22, .6, 1.8, 3, ['#7a6a5a', '#ffffff', '#a89070', '#5a6a8a']); },
  wood: (g, S) => { const n = 6; for (let i = 0; i < n; i++) { const R = rng(40 + i); g.fillStyle = `rgb(${232 + R() * 23},${232 + R() * 23},${232 + R() * 23})`; g.fillRect(0, i * S / n, S, S / n);
      g.strokeStyle = 'rgba(80,50,30,.10)'; g.lineWidth = 1.5; for (let k = 0; k < 6; k++) { g.beginPath(); const y = i * S / n + R() * S / n; g.moveTo(0, y); g.bezierCurveTo(S * .3, y + 4, S * .6, y - 4, S, y + 2); g.stroke(); }
      g.fillStyle = 'rgba(60,35,20,.45)'; g.fillRect(0, i * S / n, S, 2); const off = R() * S; g.fillRect(off, i * S / n, 2, S / n); } },
  tile: (g, S) => { const n = 4; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? '#d8dde4' : '#ffffff'; g.fillRect(i * S / n, j * S / n, S / n, S / n); }
    speckle(g, S, 1200, .05, 1, 3, 5, ['#888', '#fff']); g.strokeStyle = 'rgba(120,125,135,.4)'; g.lineWidth = 3; for (let k = 0; k <= n; k++) { g.beginPath(); g.moveTo(k * S / n, 0); g.lineTo(k * S / n, S); g.moveTo(0, k * S / n); g.lineTo(S, k * S / n); g.stroke(); } },
  plaster: (g, S) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S); speckle(g, S, 2200, .05, 1, 6, 11, ['#b8b0a0', '#ffffff']); speckle(g, S, 40, .02, 30, 90, 12, ['#d8d0c0']); },
  brick: (g, S) => { g.fillStyle = '#c8c0b8'; g.fillRect(0, 0, S, S); const rows = 8, bw = S / 4, bh = S / rows; for (let r = 0; r < rows; r++) for (let c = -1; c < 5; c++) { const R = rng(r * 13 + c + 50); const v = 205 + R() * 50; g.fillStyle = `rgb(${v},${v * .97},${v * .95})`; g.fillRect(c * bw + (r % 2) * bw / 2 + 3, r * bh + 3, bw - 6, bh - 6); } speckle(g, S, 1500, .08, 1, 3, 7, ['#555', '#fff']); },
  ceil: (g, S) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S); speckle(g, S, 3000, .08, 1, 3, 13, ['#9a9690']); },
};
const fontB = px => `900 ${px}px "Arial Black", Arial, sans-serif`;
const text = (g, s, x, y, px, col, stroke) => { g.font = fontB(px); g.textAlign = 'center'; g.textBaseline = 'middle'; if (stroke) { g.lineWidth = px * .14; g.strokeStyle = stroke; g.strokeText(s, x, y); } g.fillStyle = col; g.fillText(s, x, y); };
const hills = (g, w, h, sky, cols) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  cols.forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.moveTo(0, h); const y0 = h * (.45 + i * .14); for (let x = 0; x <= w; x += w / 8) g.lineTo(x, y0 + Math.sin(x / w * 6 + i * 2) * h * .07); g.lineTo(w, h); g.fill(); }); };
const PICS = {
  pic_land: (g, w, h) => { hills(g, w, h, ['#7ac4f4', '#e4f4ff'], ['#7ab84a', '#4a9a3a', '#2f7a30']); g.fillStyle = '#fff3a0'; g.beginPath(); g.arc(w * .75, h * .25, h * .1, 0, 7); g.fill(); },
  pic_flower: (g, w, h) => { g.fillStyle = '#f4ead8'; g.fillRect(0, 0, w, h); const R = rng(8); for (let i = 0; i < 7; i++) { const x = w * (.2 + R() * .6), y = h * (.25 + R() * .4); g.strokeStyle = '#3a8a3a'; g.lineWidth = 5; g.beginPath(); g.moveTo(x, y); g.lineTo(w / 2, h * .85); g.stroke(); g.fillStyle = ['#e8413a', '#f5c22a', '#c05ae0', '#ff8fb8'][i % 4]; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.26) * 12, y + Math.sin(k * 1.26) * 12, 9, 0, 7); g.fill(); } } g.fillStyle = '#3a78ea'; g.fillRect(w * .38, h * .8, w * .24, h * .2); },
  pic_family: (g, w, h) => { hills(g, w, h, ['#9ad4ff', '#e8f6ff'], ['#7ac85a']); [[.3, '#f2c230', '#e8413a'], [.5, '#f2c230', '#3478e0'], [.7, '#f2c230', '#3fbf5a']].forEach(([x, hd, bd], i) => { const s = i === 1 ? 1.2 : 1; g.fillStyle = bd; g.fillRect(w * x - 22 * s, h * .52, 44 * s, 70 * s); g.fillStyle = hd; g.fillRect(w * x - 17 * s, h * .52 - 36 * s, 34 * s, 34 * s); g.fillStyle = '#222'; g.fillRect(w * x - 9 * s, h * .52 - 24 * s, 5, 6); g.fillRect(w * x + 4 * s, h * .52 - 24 * s, 5, 6); }); },
  pic_poster_game: (g, w, h) => { g.fillStyle = '#1f2a8a'; g.fillRect(0, 0, w, h); const R = rng(3); for (let i = 0; i < 60; i++) { g.fillStyle = '#ffffff'; g.fillRect(R() * w, R() * h, 3, 3); } g.fillStyle = '#e8413a'; g.fillRect(w * .1, h * .55, w * .2, h * .3); g.fillStyle = '#3fbf5a'; g.fillRect(w * .7, h * .5, w * .2, h * .35); text(g, 'BLOCK', w / 2, h * .25, h * .2, '#ffe14d', '#000'); text(g, 'QUEST', w / 2, h * .45, h * .2, '#ffffff', '#000'); },
  pic_poster_space: (g, w, h) => { g.fillStyle = '#0c0c2a'; g.fillRect(0, 0, w, h); const R = rng(9); for (let i = 0; i < 80; i++) { g.fillStyle = '#fff'; g.fillRect(R() * w, R() * h, 2, 2); } g.fillStyle = '#e8a040'; g.beginPath(); g.arc(w * .5, h * .45, w * .26, 0, 7); g.fill(); g.strokeStyle = '#f4d090'; g.lineWidth = 8; g.beginPath(); g.ellipse(w * .5, h * .45, w * .42, w * .1, -.3, 0, 7); g.stroke(); text(g, 'SPACE', w / 2, h * .85, w * .2, '#ffffff'); },
  pic_poster_car: (g, w, h) => { g.fillStyle = '#ffcc1c'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8213a'; g.fillRect(w * .15, h * .45, w * .7, h * .22); g.fillRect(w * .3, h * .3, w * .38, h * .18); g.fillStyle = '#222'; g.beginPath(); g.arc(w * .3, h * .7, h * .09, 0, 7); g.arc(w * .7, h * .7, h * .09, 0, 7); g.fill(); text(g, 'TURBO', w / 2, h * .15, h * .18, '#1c1c22'); },
  pic_poster_heart: (g, w, h) => { g.fillStyle = '#ff8fb8'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8213a'; g.beginPath(); const x = w * .5, y = h * .5, s = h * .25; g.moveTo(x, y + s); g.bezierCurveTo(x - s * 1.6, y - s * .2, x - s * .5, y - s * 1.3, x, y - s * .4); g.bezierCurveTo(x + s * .5, y - s * 1.3, x + s * 1.6, y - s * .2, x, y + s); g.fill(); text(g, 'LOVE', w / 2, h * .88, h * .14, '#ffffff', '#b0143a'); },
  pic_poster_star: (g, w, h) => { g.fillStyle = '#7b4fd6'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffe14d'; g.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? w * .14 : w * .34, a = k * Math.PI / 5 - Math.PI / 2; g.lineTo(w / 2 + Math.cos(a) * r, h * .42 + Math.sin(a) * r); } g.fill(); text(g, 'STAR', w / 2, h * .82, w * .22, '#ffffff'); },
  pic_poster_food: (g, w, h) => { g.fillStyle = '#3fbf5a'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8413a'; g.beginPath(); g.arc(w * .5, h * .42, w * .25, 0, 7); g.fill(); g.fillStyle = '#5a3a20'; g.fillRect(w * .48, h * .1, w * .04, h * .1); text(g, 'EAT', w / 2, h * .75, w * .22, '#ffffff'); text(g, 'GREEN!', w / 2, h * .9, w * .16, '#ffe14d'); },
  pic_poster_paris: (g, w, h) => { g.fillStyle = '#f4d8c8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a3040'; g.lineWidth = 6; g.beginPath(); g.moveTo(w * .3, h * .85); g.lineTo(w * .5, h * .12); g.lineTo(w * .7, h * .85); g.moveTo(w * .36, h * .62); g.lineTo(w * .64, h * .62); g.moveTo(w * .42, h * .4); g.lineTo(w * .58, h * .4); g.stroke(); text(g, 'PARIS', w / 2, h * .94, w * .16, '#c8304a'); },
  pic_tv: (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2a6ae8'); gr.addColorStop(1, '#7ad0ff'); g.fillStyle = gr; g.fillRect(0, 0, w, h); hills(g, w, h * 1, ['rgba(0,0,0,0)', 'rgba(0,0,0,0)'], ['#5ac85a', '#3a9a4a']); text(g, 'NEWS 24', w * .2, h * .12, h * .08, '#ffffff'); g.fillStyle = '#e8213a'; g.fillRect(0, h * .84, w, h * .1); text(g, 'BREAKING', w * .15, h * .89, h * .06, '#ffffff'); },
  pic_mirror: (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#dfeef6'); gr.addColorStop(.5, '#a8c4d4'); gr.addColorStop(1, '#e8f4fa'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(w * .1, h); g.lineTo(w * .35, 0); g.lineTo(w * .45, 0); g.lineTo(w * .2, h); g.fill(); },
  pic_calendar: (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8413a'; g.fillRect(0, 0, w, h * .22); text(g, 'JUNE', w / 2, h * .11, h * .12, '#ffffff'); g.fillStyle = '#444'; for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) g.fillRect(w * (.08 + c * .125), h * (.3 + r * .13), w * .08, h * .07); g.strokeStyle = '#e8413a'; g.lineWidth = 5; g.beginPath(); g.arc(w * .5, h * .56, w * .08, 0, 7); g.stroke(); },
  pic_clock: (g, w, h) => { const c = w / 2; g.fillStyle = '#25262b'; g.beginPath(); g.arc(c, c, c, 0, 7); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(c, c, c * .88, 0, 7); g.fill(); g.fillStyle = '#222'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.save(); g.translate(c + Math.sin(a) * c * .72, c - Math.cos(a) * c * .72); g.rotate(a); g.fillRect(-4, -12, 8, i % 3 ? 14 : 24); g.restore(); }
    g.lineCap = 'round'; g.strokeStyle = '#222'; g.lineWidth = 12; g.beginPath(); g.moveTo(c, c); g.lineTo(c + c * .3, c - c * .28); g.stroke(); g.lineWidth = 7; g.beginPath(); g.moveTo(c, c); g.lineTo(c - c * .1, c - c * .6); g.stroke(); },
  pic_menu_a: (g, w, h) => { g.fillStyle = '#1f2a3a'; g.fillRect(0, 0, w, h); text(g, 'PIZZA  $2', w / 2, h * .3, h * .2, '#ffe14d'); text(g, 'FRIES  $1', w / 2, h * .7, h * .2, '#ffffff'); },
  pic_menu_b: (g, w, h) => { g.fillStyle = '#e8413a'; g.fillRect(0, 0, w, h); text(g, 'LUNCH', w / 2, h * .5, h * .5, '#ffffff', '#8a1a1a'); },
  pic_menu_c: (g, w, h) => { g.fillStyle = '#1f2a3a'; g.fillRect(0, 0, w, h); text(g, 'BURGER $3', w / 2, h * .3, h * .2, '#7ce0ff'); text(g, 'MILK  50c', w / 2, h * .7, h * .2, '#ffffff'); },
  pic_menu_bakery: (g, w, h) => { g.fillStyle = '#2a2a2e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f4ead8'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); text(g, 'BOULANGERIE', w / 2, h * .5, h * .38, '#f4ead8'); },
  pic_till: (g, w, h) => { g.fillStyle = '#1a3a2a'; g.fillRect(0, 0, w, h); text(g, '3.50', w / 2, h / 2, h * .5, '#6aff9a'); },
  pic_tv_game: (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6ac8ff'); gr.addColorStop(1, '#c8f0ff'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#4ab84a'; g.fillRect(0, h * .7, w, h * .3);
    for (let i = 0; i < 6; i++) { g.fillStyle = ['#e8413a', '#f5c22a', '#3478e0'][i % 3]; g.fillRect(w * (.08 + i * .15), h * (.5 - (i % 3) * .08), w * .1, h * (.2 + (i % 3) * .08)); } g.fillStyle = '#f2c230'; g.fillRect(w * .45, h * .55, w * .06, h * .15); text(g, 'LVL 99', w * .82, h * .1, h * .08, '#ffffff', '#000'); },
  pic_kitchen_back: (g, w, h) => { g.fillStyle = '#c8ccd2'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8ecf0'; g.fillRect(0, h * .55, w, h * .45); g.fillStyle = '#9aa0a8';
    for (let k = 0; k < 2; k++) g.fillRect(0, h * (.2 + k * .25), w, h * .03); const R = rng(77); for (let i = 0; i < 22; i++) { const x = R() * w, y = h * (.2 + (i % 2) * .25); g.fillStyle = ['#b8bec6', '#e8413a', '#f5c22a', '#ffffff', '#7a8088'][i % 5]; const s = 14 + R() * 18; g.fillRect(x, y - s, s * 1.2, s); }
    g.fillStyle = '#8a9098'; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(w * (.15 + i * .23), h * .78, w * .05, h * .08, 0, 0, 7); g.fill(); } },
};
const PIC_SIZE = { pic_land: [768, 480], pic_flower: [512, 384], pic_family: [512, 600], pic_poster_game: [768, 540], pic_poster_space: [512, 680], pic_poster_car: [768, 500], pic_poster_heart: [512, 512],
  pic_poster_star: [512, 660], pic_poster_food: [512, 640], pic_poster_paris: [512, 700], pic_tv: [1024, 576], pic_mirror: [512, 400], pic_calendar: [400, 520], pic_clock: [512, 512],
  pic_menu_a: [1024, 448], pic_menu_b: [1024, 448], pic_menu_c: [1024, 448], pic_menu_bakery: [1024, 300], pic_till: [256, 146],
  pic_tv_game: [768, 460], pic_kitchen_back: [2048, 330] };
// contact shadows + skirting AO: a 2x2 decal atlas (soft round, soft box), darkens only
const SHADOW_TEX = (g, S) => { g.clearRect(0, 0, S, S); const h = S / 2;
  const rg = g.createRadialGradient(h / 2, h / 2, 0, h / 2, h / 2, h / 2); rg.addColorStop(0, 'rgba(20,16,24,.85)'); rg.addColorStop(.55, 'rgba(20,16,24,.5)'); rg.addColorStop(1, 'rgba(20,16,24,0)'); g.fillStyle = rg; g.fillRect(0, 0, h, h);
  g.filter = 'blur(' + Math.round(h * .09) + 'px)'; g.fillStyle = 'rgba(20,16,24,.75)'; g.fillRect(h + h * .2, h * .2, h * .6, h * .6); g.filter = 'none';
  const lg = g.createLinearGradient(0, h, 0, S); lg.addColorStop(0, 'rgba(20,16,24,.7)'); lg.addColorStop(1, 'rgba(20,16,24,0)'); g.fillStyle = lg; g.fillRect(0, h, h, h); };

// WP-K: ceilings and upper walls, so tilted-up shots are not bare: beams (or ducts in the cafeteria), vents, a smoke alarm, a high shelf
// with books, boxes and a plant, framed pictures. Only above y CEIL - 2.1 and never across a window or door (layout.json openings).
const VENT_TEX = (g, w, h) => { g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, w, h); g.fillStyle = '#8a8c90'; for (let k = 1; k < 9; k++) g.fillRect(w * .08, k * h / 9 - 3, w * .84, 6); g.strokeStyle = '#c8c8c4'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); };
PICS.__vent = VENT_TEX; PIC_SIZE.__vent = [256, 160];
function dressUpper(THREE, kit, group, R, roomName, info, lookName, picOf) {
  const [W2, ZB, ZF, CEIL] = R.box, n = { items: 0 }, night = lookName === 'night';
  const S = (c, o = {}) => kit.surface('home', c, { gloss: o.gloss ?? 20, spec: o.spec ?? .12, map: o.map, uv: o.map ? 0 : 4, emit: o.emit });
  const box = (m, x, y, z, w, h, d, ry = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry; o.name = 'set.upper'; o.frustumCulled = false; group.add(o); n.items++; return o; };
  const cyl = (m, x, y, z, r, h, seg = 16) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); o.position.set(x, y, z); o.name = 'set.upper'; o.frustumCulled = false; group.add(o); n.items++; return o; };
  const open = (side, a, b, y0, y1) => [...(info.windows || []), ...(info.doors || []).map(d => [d[0], d[1], d[2], 0, d[3]])]
    .some(([s, c, w, oy0, oy1]) => s === side && a < c + w / 2 + .3 && b > c - w / 2 - .3 && y0 < oy1 + .15 && y1 > oy0);
  const hall = roomName === 'house_hall', cafe = roomName === 'cafeteria';
  const woodC = hall || roomName === 'bakery' ? '#7a4a2c' : roomName === 'kitchen' ? '#5a3a26' : '#c89a64';
  // beams across the room (x), clear of the ceiling fixtures; the cafeteria gets two silver ducts along z with hangers instead
  if (cafe) { const duct = S('#c4c9cf', { gloss: 55, spec: .5 }), hang = S('#5a606a');
    for (const x of [-W2 * .36, W2 * .36]) { const o = cyl(duct, x, CEIL - .42, (ZB + ZF) / 2, .26, ZF - ZB - .4, 20); o.rotation.x = Math.PI / 2;
      for (let z = ZB + 2; z < ZF - 1; z += 4) { box(hang, x, CEIL - .1, z, .05, .2, .05); box(duct, x, CEIL - .42, z, .6, .6, .1); } } }
  else { const beam = S(woodC, { gloss: 25, spec: .15 }), step = hall ? 4 : 4.2;
    for (let z = ZB + step * .75; z < ZF - 1; z += step) { if (R.fixtures.some(f => Math.abs(f[2] - z) < 1.1)) continue; box(beam, 0, CEIL - .2, z, 2 * W2, .4, .45); } }
  // vents (grille picture) and a smoke alarm
  const vent = S('#ffffff', { map: picOf('__vent'), gloss: 20 }), white = S('#f6f6f2', { gloss: 30, spec: .2 }), red = S('#e8413a', { emit: night ? 1.2 : .6 });
  for (const [u, v] of [[.55, .3], [-.5, .72]]) { const x = W2 * u, z = ZB + (ZF - ZB) * v; if (R.fixtures.some(f => Math.hypot(f[0] - x, f[2] - z) < 1.5)) continue;
    const o = box(vent, x, CEIL - .04, z, 1.3, .08, .7); o.rotation.y = 0; }
  cyl(white, -W2 * .3, CEIL - .07, ZB + (ZF - ZB) * .55, .2, .1, 20); cyl(red, -W2 * .3 + .08, CEIL - .13, ZB + (ZF - ZB) * .55, .025, .02, 8);
  // a high shelf with books, boxes and a plant on the first free wall span (not in the hall or the cafeteria)
  const yS = CEIL - 1.55;
  if (!hall && !cafe) { const plank = S(woodC, { gloss: 25, spec: .15 }), BK = ['#e8413a', '#3fbf5a', '#3478e0', '#f5c22a', '#c05ae0', '#ff8fb8'].map(c => S(c, { gloss: 30, spec: .15 }));
    const pot = S('#d8743a', { gloss: 20 }), leaf = S('#3f9a3a'), boxC = S('#e8d4a8');
    const cand = [['left', ZB + 1.5, ZB + 5.5], ['left', ZF - 6, ZF - 2], ['right', ZB + 1.5, ZB + 5.5], ['right', ZF - 6, ZF - 2], ['front', -W2 + 1.5, -W2 + 5.5]];
    const pick = cand.find(([s, a, b]) => !open(s, a, b, yS - .2, yS + 1.2));
    if (pick) { const [s, a, b] = pick, L = b - a, c = (a + b) / 2, side = s === 'left' ? -1 : 1;
      const at = (u, y, d = .3) => s === 'front' ? [a + u, y, ZF - d] : [side * (W2 - d), y, a + u];
      const ry = s === 'front' ? Math.PI : s === 'left' ? Math.PI / 2 : -Math.PI / 2;
      const p = at(L / 2, yS); box(plank, p[0], p[1], p[2], L, .1, .55, ry);
      for (const u of [.4, L - .4]) { const q = at(u, yS - .22, .12); box(plank, q[0], q[1], q[2], .08, .35, .25, ry); }
      let u = .25; const R0 = rng(roomName.length * 7 + 3);
      while (u < L * .55) { const w = .1 + R0() * .08, h = .42 + R0() * .22, q = at(u, yS + .05 + h / 2); box(BK[Math.floor(R0() * BK.length)], q[0], q[1], q[2], w, h, .38, ry); u += w + .015; }
      const q1 = at(L * .7, yS + .05 + .22); box(boxC, q1[0], q1[1], q1[2], .55, .44, .44, ry);
      const q2 = at(L * .9, yS + .05 + .16); cyl(pot, q2[0], q2[1], q2[2], .16, .32);
      for (let k = 0; k < 5; k++) { const lq = at(L * .9 + Math.cos(k * 1.3) * .14, yS + .5 + (k % 2) * .12, .3 + Math.sin(k * 1.3) * .14); const o = new THREE.Mesh(new THREE.SphereGeometry(.17, 10, 8), leaf); o.position.set(...lq); o.scale.set(1, .75, 1); o.name = 'set.upper'; group.add(o); n.items++; } } }
  // framed pictures high on the walls: two on the right, one on the front, one on the left, wherever the wall is free
  const frame = S(hall ? '#4a2e1e' : '#f8f8f4', { gloss: 30, spec: .2 }), PIC = ['pic_land', 'pic_flower', 'pic_poster_star', 'pic_family', 'pic_poster_space', 'pic_calendar'];
  const yP = CEIL - (hall ? 1.0 : 1.25), spots = hall ? [['left', -20, 0], ['right', -22, -10], ['left', -9, 0], ['right', 1, 0]] : [['right', ZB + 3.5, 0], ['right', ZF - 3.5, 0], ['front', W2 * .45, 0], ['left', (ZB + ZF) / 2 + 1, 0]];
  let k = 0;
  for (const [s, c] of spots) { const w = hall ? 1.0 : 1.3, h = hall ? .75 : .95; if (open(s, c - w / 2, c + w / 2, yP - h / 2, yP + h / 2) || yP + h / 2 > CEIL - .4) continue;
    const side = s === 'left' ? -1 : 1, ry = s === 'front' ? Math.PI : s === 'left' ? Math.PI / 2 : -Math.PI / 2;
    const pos = d => s === 'front' ? [c, yP, ZF - d] : [side * (W2 - d), yP, c];
    const f = pos(.05); box(frame, f[0], f[1], f[2], w + .14, h + .14, .07, ry);
    const pm = S('#ffffff', { map: picOf(PIC[k++ % PIC.length]), gloss: 30, spec: .2 }), pq = pos(.095), pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), pm);
    pl.position.set(...pq); pl.rotation.y = ry; pl.name = 'set.upper'; pl.frustumCulled = false; group.add(pl); n.items++; }
  return n.items;
}

export const HOME_ROOMS = Object.keys(ROOMS);
export function buildHome(THREE, scene, opts = {}) {
  const roomName = ROOMS[opts.room] ? opts.room : 'bedroom_bunk', R = ROOMS[roomName];
  const lookName = AMB[opts.look] ? opts.look : R.look, A = AMB[lookName];
  const COL = { ...BASE, ...R.col, ...(LOOK_COL[lookName] || {}) }, clay = !!opts.clay;
  const group = new THREE.Group(); group.name = 'set.rbx_home.' + roomName + '.' + lookName; scene.add(group);
  const [ox, oz] = opts.place || [0, 0]; group.position.set(ox, 0, oz);
  const lights = lightsOf(R, lookName).map(l => ({ ...l, pos: l.pos && [l.pos[0] + ox, l.pos[1], l.pos[2] + oz] }));
  const rig = createLightRig(THREE, { home: { sky: A.sky, ground: A.ground, fog: A.fog, ao: { floor: 0, h: 1.4, amt: .32 }, lights } }, {});
  const sunv = norm(R.sun), lightDir = norm([sunv[0], Math.max(1, sunv[1] * 2), sunv[2]]);
  const SH = { uShadowMap: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() }, uShadowOn: { value: 0 }, uShadowTexel: { value: 1 / 2048 }, uShadowSoft: { value: 1.4 }, uShadowBias: { value: .0006 }, uSunDir: { value: new THREE.Vector3(...lightDir) } };
  const kit = createKit(THREE, rig, { shadow: SH, group });
  const DM = {}, DR = createDress(THREE, { kit, rig, place: 'home', group, key: sunv, night: lookName === 'night', opts: clay ? false : (opts.dress ?? {}), marks: DM }); DR.wrap();
  const T = {}; for (const [k, f] of Object.entries(TEX)) T[k] = cv(THREE, 512, 512, f, true);
  const pics = {};
  const picOf = k => pics[k] || (PICS[k] ? (pics[k] = cv(THREE, ...(PIC_SIZE[k] || [512, 512]), PICS[k])) : null);
  const mats = {};
  const matOf = (key, glbColor) => { if (mats[key]) return mats[key];
    const emitKey = key === 'panel' || key === 'q_Light' || key === 'fire_glow' || key === 'pic_tv';
    if (clay) return (mats[key] = kit.surface('home', emitKey ? '#ffffff' : '#c9c9c9', { emit: emitKey ? .8 : 0 }));
    const fam = key.replace(/^q_[a-z]+_/, 'q_');
    const F = { ...(FIN[fam] || {}), ...(FIN[key] || {}) };
    if (lookName === 'night' && NIGHT_EMIT[fam] != null) F.emit = NIGHT_EMIT[fam];
    let color = COL[key] || (glbColor ? glbColor.map(v => Math.pow(v, 1 / 2.2)) : '#c0c0c0');
    let map = null, uv = 4, tile = [1, 1];
    if (key === 'carpet') { map = T.carpet; tile = [2.5, 2.5]; }
    else if (key === 'floor_wood' || key === 'floor_next') { map = T.wood; tile = [6, 6]; }
    else if (key === 'floor_tile') { map = T.tile; tile = [4, 4]; }
    else if (key === 'wall' || key === 'wall_next' || key === 'chimney') { map = T.plaster; tile = [3, 3]; }
    else if (key === 'brick') { map = T.brick; tile = [3.2, 3.2]; }
    else if (key === 'ceiling') { map = T.ceil; tile = [1.5, 1.5]; }
    else if (picOf(key)) { map = picOf(key); uv = 0; color = '#ffffff'; }
    return (mats[key] = kit.surface('home', color, { map, uv, tile, bump: F.bump, gloss: F.gloss, spec: F.spec, wet: F.wet, grime: F.grime, emit: F.emit })); };

  // sky dome for the windows, and the clay capsules for scale
  const [W2, ZB, ZF] = R.box;
  kit.sky(ox, oz + (ZB + ZF) / 2, 160, { ...A.sky3, sun: sunv });
  // WP-K grounding: blobs under capsules (people stand-ins), AO band where walls meet the ceiling, upper-wall + ceiling dressing
  const G = createGround(THREE, group, { night: lookName === 'night' });
  for (const [x, z, c] of opts.capsules || []) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(.62, 1.76, 8, 20), kit.surface('home', c || '#e8e2d6', { gloss: 10, spec: .1 })); m.position.set(x, 1.5, z); m.scale.set(1, 1, .7); m.name = 'capsule'; group.add(m); G.contactBlob([x + ox, z + oz], .8); }
  G.bands({ x: [-W2, W2], z: [ZB, ZF], ceil: R.box[3], h: .9, a: lookName === 'night' ? .45 : .34 });
  const upper = dressUpper(THREE, kit, group, R, roomName, LAYOUT.rooms?.[roomName] || {}, lookName, k => clay ? null : picOf(k));

  // picture cards (TV screens, posters, mirror, calendar, clock faces) lie a few mm on or in the body behind them: at a grazing camera
  // the depth test picks either surface per frame. A flat card (area-weighted normal mostly one way) moves PIC_LIFT D along that normal.
  const PIC_LIFT = .015;
  const picLift = o => { const g = o.geometry, P = g.attributes.position, idx = g.index, n = idx ? idx.count : P.count; if (!P) return;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), s = new THREE.Vector3(); let area = 0;
    for (let t = 0; t < n; t += 3) { a.fromBufferAttribute(P, idx ? idx.getX(t) : t); b.fromBufferAttribute(P, idx ? idx.getX(t + 1) : t + 1); c.fromBufferAttribute(P, idx ? idx.getX(t + 2) : t + 2);
      const f = b.sub(a).cross(c.sub(a)); area += f.length(); s.add(f); }
    if (!area || s.length() / area < .8) { console.log(`rbx home: pic lift skipped ${o.name} (flatness ${(s.length() / (area || 1)).toFixed(2)})`); return; }   // not a flat one-sided card (a box, a framed panel): leave it
    s.normalize().transformDirection(o.matrix); o.position.addScaledVector(s, PIC_LIFT); o.updateMatrix(); stats.picLift = (stats.picLift || 0) + 1; };
  const stats = { prims: 0, mats: 0, upper };
  const ready = (async () => {
    const glb = await readGlb(THREE, new URL(roomName + '.glb', ASSETS).href);
    if (!glb) { console.log('rbx home: ' + roomName + '.glb missing'); return stats; }
    const loaded = [];
    for (const root of glb.roots) for (const p of root.prims) { const key = (p.material || root.name).split('.')[0];
      const mat = key === 'glass' && !clay ? (mats.glass ||= new THREE.MeshBasicMaterial({ color: lookName === 'night' ? 0x4a5a8a : 0xcfe8f4, transparent: true, opacity: .16, depthWrite: false })) : matOf(key, p.color);
      const o = new THREE.Mesh(p.geometry, mat); o.applyMatrix4(root.matrix); if (RUG_LIFT[key]) o.position.y += RUG_LIFT[key]; o.name = 'set.' + key; o.frustumCulled = false;
      if (/^pic_/.test(key)) picLift(o);   // V4 z-fight fix (love f1843: the TV screen went dark for one frame against its body)
      if (/^(floor|carpet)/.test(key)) o.renderOrder = -2;   // under the contact-shadow decals (renderOrder -1.5)
      if (key === 'glass') o.renderOrder = 2;
      group.add(o); stats.prims++; loaded.push([o, key]); }
    // the lifted rugs: contact blobs and the furniture shadow planes over a rug sit on the rug's top, not under it (V4 flicker fix)
    const rugs = loaded.filter(([, k]) => RUG_LIFT[k]).map(([o]) => { o.updateMatrix(); o.geometry.computeBoundingBox(); return o.geometry.boundingBox.clone().applyMatrix4(o.matrix); });   // group space
    const rugTop = (x, z) => { let y = 0; for (const b of rugs) if (x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z) y = Math.max(y, b.max.y); return y; };
    for (const [o, key] of loaded) G.auto(o, key, { floorY: rugTop });
    if (rugs.length) group.traverse(o => { if (o.name !== 'set.shadow' || o.position.y > .01) return; const y = rugTop(o.position.x, o.position.z); if (y > 0) o.position.y = y + .008; });
    stats.blobs = G.flush(); stats.mats = Object.keys(mats).length; stats.dress = await DR.finish(PRESETS.home(R)); return stats;
  })();
  // contact shadows under furniture (footprints from build_home.py) and a soft dark band along every wall's foot
  if (!clay) try {
      const info = LAYOUT.rooms?.[roomName] || {};
      const list = (info.shadows || []).map(([x, z, w, d, ry]) => ({ pos: [x, .003, z], normal: [0, 1, 0], size: [w, d], spin: ry, cell: 1, alpha: .62 }));
      const band = 1.1;
      list.push({ pos: [0, .004, ZB + band / 2], size: [2 * W2, band], spin: 0, cell: 2, alpha: .5 }, { pos: [0, .004, ZF - band / 2], size: [2 * W2, band], spin: Math.PI, cell: 2, alpha: .5 },
        { pos: [-W2 + band / 2, .004, (ZB + ZF) / 2], size: [ZF - ZB, band], spin: Math.PI / 2, cell: 2, alpha: .5 }, { pos: [W2 - band / 2, .004, (ZB + ZF) / 2], size: [ZF - ZB, band], spin: -Math.PI / 2, cell: 2, alpha: .5 });
      // plain alpha-blended dark planes (rigkit's multiply decals did not show on these floors): soft box under furniture, gradient band at walls
      const shTex = [null, cv(THREE, 256, 256, (g, S) => { g.fillStyle = '#000'; g.fillRect(0, 0, S, S); g.filter = 'blur(' + Math.round(S * .07) + 'px)'; g.fillStyle = '#fff'; g.fillRect(S * .13, S * .13, S * .74, S * .74); g.filter = 'none'; }),   // alphaMap reads green
        cv(THREE, 64, 256, (g, S, H) => { const lg = g.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, '#ffffff'); lg.addColorStop(.35, '#737373'); lg.addColorStop(1, '#000000'); g.fillStyle = lg; g.fillRect(0, 0, S, H); })];
      const shMat = {}, plane = new THREE.PlaneGeometry(1, 1);
      for (const d of list) { const k = d.cell + ':' + d.alpha;
        const m = shMat[k] ||= new THREE.MeshBasicMaterial({ color: lookName === 'night' ? 0x06040c : 0x1a120c, alphaMap: shTex[d.cell], transparent: true, opacity: d.alpha, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -8 });   // V4: units only (a slope factor pulls a floor decal through a rug at grazing angles)
        const o = new THREE.Mesh(plane, m); o.rotation.order = 'YXZ'; o.rotation.set(-Math.PI / 2, d.spin || 0, 0); o.position.set(...d.pos); o.scale.set(d.size[0], d.size[1], 1); o.renderOrder = -1; o.name = 'set.shadow'; group.add(o); }
      stats.shadows = list.length;
    } catch (e) { console.log('rbx home: no contact shadows (' + e.message + ')'); }

  function update(t) { rig.update(t); kit.update(t); }
  update(0);
  const marks = Object.fromEntries(Object.entries(R.marks).map(([k, [x, z]]) => [k, [x + ox, z + oz]]));
  Object.assign(DM, marks);
  const look = opts.post ? createPost(THREE, rig, opts.post) : undefined;
  return { name: 'rbx_home_' + roomName, group, lightDir, skyColor: A.fog.color, marks, points: {}, bounds: { x: [-W2 + ox, W2 + ox], z: [ZB + oz, ZF + oz] }, casters: [], uniforms: SH, update, ready, rig, look, lookName, room: roomName, contactBlob: G.contactBlob };
}
export default { buildHome, HOME_ROOMS };
