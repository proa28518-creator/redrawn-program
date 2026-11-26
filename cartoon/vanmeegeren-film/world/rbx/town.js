// world/rbx/town.js: the Roblox V3 town kit set (WP-S3, 2026-11-12). One street, five zones (school, houses, cinema, parking, park).
// Geometry from Blender (blender/rbx/build_town.py -> world/assets/rbx/town/set.glb, layout.json), painted details (signs, posters,
// billboard, bricks, paving) drawn here on canvases. Light is data (world/look/lights.js form), read by rigkit's surface shader:
// no baked light, pure in t. Places and marks: world/rbx/town.PLACES.md (they never move).
// Use from a film's own set.js:  import { buildTown } from '../../world/rbx/town.js';
//                                export function buildSet(THREE, scene, opts) { return buildTown(THREE, scene, opts); }
// opts: { zone: 'school' | 'houses' | 'cinema' | 'parking' | 'park', look: 'day' | 'sunset' | 'night' | 'pastel' | 'snow',
//         place: [x, z] (where the zone's anchor lands), clay: false, capsules: [[x, z, '#hex'?], ...] (relative to the anchor) }
import { createLightRig } from '../look/lights.js';
import { createKit } from '../look/rigkit.js';
import { readGlb } from '../look/glb.js';
import { createPost } from '../look/post.js';
import { createGround, saturate, skyPlate, bunting } from './ground.js';
import { createDress, PRESETS } from './dress.js';   // V4-ENV: sprites, decals, textures, AO, form/rim shading (opts.dress: false = V3 look)
// WP-K2 (V3_REF WP-K): painted sky plate per look (opts.sky = plate name, or false for the old procedural dome), bunting across the
// street (opts.bunting = false to leave it out), zebra crossings at every zone, asphalt / paving detail for a camera at 0.25,
// colours +18 % saturation (opts.sat to change, 0 = as before), a readable night. Marks, bounds, lanes and the return shape unchanged.
const SKY_OF = { day: 'day_cumulus', pastel: 'day_cumulus', sunset: 'sunset', night: 'night_moon', snow: 'sepia_overcast' };

const ASSETS = new URL('../assets/rbx/town/', import.meta.url);
const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
export const ZONES = { school: -80, houses: -35, cinema: 5, parking: 45, park: 95 };
const AZ = -8;
// marks relative to the zone anchor (town.PLACES.md)
export const MARKS = {
  school: { walk: [0, 0], door: [0, -12], steps: [0, -9], sign: [-11, -4], lawn_l: [-8, -8], lawn_r: [8, -8], curb: [0, 3] },
  houses: { walk: [0, 0], porch_a: [-10, -14], porch_b: [10, -14], driveway: [17, -6], garage: [17, -12], lawn: [-4, -7], mailbox: [-4, -1] },
  cinema: { walk: [0, 0], doors: [0, -4], booth: [-6, -4], poster: [6, -4], curb: [0, 3] },
  parking: { walk: [0, 0], lot: [0, -12], car: [-6, -12], between_cars: [3, -16], store: [0, -28] },
  park: { walk: [0, 0], plaza: [0, -16], fountain: [0, -20], bench: [-9, -14], billboard: [14, -30], bike: [9, -12], lawn: [-14, -24] },
};
// lamp light points (from layout.json, world coordinates of the kit); the night look takes the ones nearest the zone
const LAMPS = []; for (let x = -120; x <= 140; x += 20) { if (!Object.values(ZONES).some(a => Math.abs(x - a) < 8.5) && Math.abs(x + 18) >= 3.5) LAMPS.push([x, 7.2, -8.9]); LAMPS.push([x + 10, 7.2, 8.8]); }

// ---- lights per look. Colours linear
const LOOKS = {
  day: { sky: [.55, .6, .68], ground: [.34, .36, .28], fog: { color: '#cfe6f8', density: .0016 }, ao: { floor: 0, h: 1.2, amt: .3 },
    sun: { dir: norm([-.45, .8, .55]), color: [1.0, .95, .84], power: 1.0 }, fill: { dir: norm([.5, .5, -.6]), color: [.7, .8, 1.0], power: .4 },
    sky3: { top: '#3f8fe6', hor: '#cfe8fb', low: '#a6cde8', cloudLit: '#ffffff', cloudDark: '#c4d6e8', sunColor: [.5, .45, .35], cover: .32, scale: .8 }, night: false },
  sunset: { sky: [.48, .36, .4], ground: [.3, .2, .16], fog: { color: '#f2b48a', density: .0022 }, ao: { floor: 0, h: 1.2, amt: .32 },
    sun: { dir: norm([-.9, .22, .38]), color: [1.0, .62, .34], power: 1.15 }, fill: { dir: norm([.6, .45, -.4]), color: [.45, .45, .85], power: .46 },
    sky3: { top: '#3a4f9a', hor: '#ffb070', low: '#f08a6a', cloudLit: '#ffd0a0', cloudDark: '#9a6a9a', sunColor: [1.0, .55, .25], cover: .38, scale: .8 }, night: false },
  // WP-K2: night lifted to a readable moonlit blue (REF2: grass stays green, the set stays visible under a dark sky plate)
  night: { sky: [.17, .2, .36], ground: [.07, .08, .12], fog: { color: '#22305e', density: .0026 }, ao: { floor: 0, h: 1.2, amt: .36 },
    sun: { dir: norm([.4, .7, .5]), color: [.55, .66, 1.0], power: .5 }, fill: { dir: norm([-.5, .5, -.6]), color: [.4, .48, .9], power: .22 },
    sky3: { top: '#060a24', hor: '#26306a', low: '#141a40', cloudLit: '#3a4478', cloudDark: '#0a0e26', sunColor: [.15, .18, .3], cover: .25, scale: .8 }, night: true },
  pastel: { sky: [.6, .58, .66], ground: [.4, .34, .36], fog: { color: '#f6dcea', density: .0016 }, ao: { floor: 0, h: 1.2, amt: .28 },
    sun: { dir: norm([-.45, .8, .55]), color: [1.0, .94, .86], power: .95 }, fill: { dir: norm([.5, .5, -.6]), color: [.95, .78, .9], power: .38 },
    sky3: { top: '#5fa8f0', hor: '#f8dcee', low: '#e0c0dc', cloudLit: '#ffffff', cloudDark: '#e6cce0', sunColor: [.5, .42, .38], cover: .3, scale: .8 }, night: false },
  snow: { sky: [.62, .66, .74], ground: [.6, .62, .66], fog: { color: '#e4ecf4', density: .0028 }, ao: { floor: 0, h: 1.2, amt: .3 },
    sun: { dir: norm([-.4, .6, .65]), color: [1.0, .97, .92], power: .8 }, fill: { dir: norm([.5, .6, -.6]), color: [.75, .85, 1.0], power: .32 },
    sky3: { top: '#7aa6d8', hor: '#e8f0f8', low: '#d0dcea', cloudLit: '#ffffff', cloudDark: '#c8d2de', sunColor: [.3, .3, .3], cover: .6, scale: .8 }, night: false },
};

// ---- colours (sRGB hex). Keys = Blender material names. Kenney's atlas swatches 'kc_rrggbb' keep their own colour unless a look tints them
const BASE = {
  grass: '#62b84a', lawn: '#6cc452', hedge: '#3f9a3e', soil: '#6a4a32', asphalt: '#4a4d55', asphalt_lot: '#55585f', curb: '#c9c6bf', sidewalk: '#dcd8cf', sidewalk_joint: '#9f9a90',
  paint_w: '#f6f6f2', paint_y: '#ffc82a', steel: '#c4c9cf', steel_dark: '#4a5059', chrome: '#d5dae0', gold: '#e8b830', brass: '#d8a83a', red: '#e0362c', orange: '#ff7a1c',
  lamp_pole: '#3d4450', lamp_head: '#2f343c', lamp_glow: '#fff3cf', frame_w: '#f4f1ea', glass: '#9cc6e4', glass_school: '#8fbde0', glass_door: '#a8d4ee', glass_shop: '#a8d0e8',
  brick: '#b8503a', brick_dark: '#7a3528', stone: '#e2dccd', paving: '#d9cfbd', path: '#e3d4b0', door_alu: '#b9c0c8', foundation: '#9a958c',
  house_a: '#f2d27a', house_a_line: '#d9b85e', roof_a: '#c0463a', roof_a_ridge: '#9a3328', house_b: '#8fc4ec', house_b_line: '#76a9d2', roof_b: '#4a5568', roof_b_ridge: '#373f4e',
  trim_w: '#fbf8f2', door_red: '#c8322c', door_red_d: '#a8261f', door_blue: '#2f63d6', door_blue_d: '#2552b8', shutter_a: '#2f7a4a', shutter_a_d: '#22603a', shutter_b: '#f4f1ea', shutter_b_d: '#d8d4cc',
  porch_floor: '#a8784e', doormat: '#7a4a2a', garage_door: '#3a78e0', garage_door_d: '#2a5cb8', driveway: '#bdb8ae', fence_w: '#fbfaf4', mailbox: '#2a55c8', backboard: '#f8f8f8',
  cinema_wall: '#2fa6a0', cinema_trim: '#f4d03a', cinema_base: '#1f6e6a', marquee: '#d8302e', marquee_d: '#8a1c1c', bulb: '#fff2b0', booth: '#d8302e', booth_roof: '#f4d03a', rope: '#b0142a',
  planter: '#c9b48c', concrete: '#c6c2ba', store_wall: '#f3e2b4', store_trim: '#2f8a4a', awning_r: '#e0382e', awning_w: '#fbf6ee',
  bag_r: '#e2453c', bag_b: '#3366d6', bag_y: '#f0b820', board_deck: '#e8413a', wheel_w: '#f4f1ea', cardboard: '#c8945a',
  far_wall_0: '#f0a888', far_wall_1: '#9fcbea', far_wall_2: '#f2dc96', far_wall_3: '#b9dba8', far_wall_4: '#d8b8e8',
  // Kenney Nature Kit materials (their own base colours are a cyan palette): real foliage colours
  k_grass: '#5cba44', k_leafsGreen: '#4fae3c', k_leafsDark: '#2f8a3e', k_woodBark: '#7a5236', k_woodBarkDark: '#5e3e28', k_dirt: '#7a5a3a', k_woodInner: '#d8b888',
  k_colorWhite: '#f6f6f6', k__defaultMat: '#dddddd', k_colorRed: '#e8413a', k_colorYellow: '#ffcf3a', k_colorPurple: '#9a6ae8',
  water: '#4fb4e8', bench_wood: '#b8783e', bin: '#2f7a4a', bin_lid: '#24603a', tire: '#26282c', bike: '#2f8ae0', bike_r: '#e0362c', mountain: '#7a8fb0', mountain_snow: '#f4f7fb', flower_bed: '#7a5536',
};
const LOOK_COL = {
  day: {},
  sunset: {},
  night: { glass: '#ffcf7a', glass_school: '#ffd68a', glass_shop: '#ffd27a', glass_door: '#ffe0a0', grass: '#5cc84a', lawn: '#66d052', hedge: '#3faa48', k_grass: '#5cc84a', k_leafsGreen: '#4fbe46' },
  pastel: { house_a: '#ffc4dc', house_a_line: '#f0a8c4', house_b: '#b8ecd8', house_b_line: '#98d8be', roof_a: '#ff8fb0', roof_b: '#8fb8f0', cinema_wall: '#9fdcf0', cinema_base: '#6ab0d0',
    sidewalk: '#f6c8d6', sidewalk_joint: '#d898ac', curb: '#f2dce4', store_wall: '#fff2b8', trim_w: '#ffffff', brick: '#e88a7a', paving: '#f6dce4', path: '#f8e0c8', door_red: '#ff6a9a' },
  snow: { grass: '#f2f6fa', lawn: '#f4f8fb', hedge: '#d8e6ea', roof_a: '#f1f5f9', roof_b: '#eef3f8', roof_a_ridge: '#e2e8ee', roof_b_ridge: '#e2e8ee', soil: '#e8eef2', flower_bed: '#e8eef2',
    sidewalk: '#e6eaee', path: '#eef2f6', paving: '#e4e8ec', driveway: '#dfe4e8', water: '#bfe2f2', mountain: '#9fb2cc' },
};
// how each surface answers light (rigkit surface options)
const FIN = {
  glass: { gloss: 90, spec: .9 }, glass_school: { gloss: 90, spec: .9 }, glass_door: { gloss: 90, spec: .9 }, glass_shop: { gloss: 90, spec: .9 },
  chrome: { gloss: 70, spec: .8 }, gold: { gloss: 70, spec: 1.0 }, brass: { gloss: 60, spec: .8 }, steel: { gloss: 50, spec: .45 }, door_alu: { gloss: 45, spec: .4 },
  water: { gloss: 90, spec: 1.0 }, asphalt: { bump: .03, grime: .15 }, asphalt_lot: { bump: .03, grime: .15 }, sidewalk: { bump: .02, grime: .12 }, brick: { bump: .04, grime: .1 },
  marquee: { gloss: 40, spec: .3 }, mailbox: { gloss: 40, spec: .35 }, garage_door: { gloss: 30, spec: .2 }, roof_a: { grime: .08 }, roof_b: { grime: .08 },
  lamp_glow: { emit: .35 }, bulb: { emit: .5 },
};
const EMIT_NIGHT = { lamp_glow: 1.5, bulb: 1.3, glass: .55, glass_school: .5, glass_shop: .8, glass_door: .45, sign_comedy: .7, sign_cinema: .8, sign_cinema_front: .7, sign_pizza: .6, billboard_love: .45, sign_tickets: .5 };

// ---- canvas pictures
function cv(THREE, w, h, draw, wrap = false) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; /* V4: renderer max (three clamps), mipmaps on (CanvasTexture default) */ t.colorSpace = THREE.NoColorSpace; return t; }
const rng = s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
function speckle(g, S, n, a, r0, r1, seed, cols) { const R = rng(seed); for (let i = 0; i < n; i++) { g.globalAlpha = a * R(); g.fillStyle = cols[Math.floor(R() * cols.length)]; const r = r0 + R() * (r1 - r0); g.beginPath(); g.ellipse(R() * S, R() * S, r, r * (.5 + R() * .5), R() * 3, 0, 7); g.fill(); } g.globalAlpha = 1; }
const TEX = {
  // 512 px = 4 D. Bricks: Roblox-chunky courses (.4 D), white mortar
  brick: (g, S) => { g.fillStyle = '#e8e2d8'; g.fillRect(0, 0, S, S); const R = rng(3), rows = 10, bw = S / 4.5; for (let r = 0; r < rows; r++) { const off = r % 2 ? bw / 2 : 0; for (let c = -1; c < 6; c++) { const v = .86 + R() * .2; g.fillStyle = `rgb(${255 * v | 0},${255 * v * .97 | 0},${255 * v * .95 | 0})`; g.fillRect(c * bw + off + 3, r * S / rows + 3, bw - 6, S / rows - 6); } } },
  pave: (g, S) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S); speckle(g, S, 7000, .08, 1, 4, 5, ['#888', '#fff']); const n = 4, R = rng(19);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = .93 + R() * .1; g.fillStyle = `rgba(${v > 1 ? 255 : 120},${v > 1 ? 255 : 115},${v > 1 ? 255 : 105},${Math.abs(v - 1) * .9})`; g.fillRect(i * S / n, j * S / n, S / n, S / n); }
    g.strokeStyle = 'rgba(90,82,72,.55)'; g.lineWidth = 6; for (let k = 0; k <= n; k++) { g.beginPath(); g.moveTo(k * S / n, 0); g.lineTo(k * S / n, S); g.moveTo(0, k * S / n); g.lineTo(S, k * S / n); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; for (let k = 0; k <= n; k++) { g.beginPath(); g.moveTo(k * S / n + 5, 0); g.lineTo(k * S / n + 5, S); g.moveTo(0, k * S / n + 5); g.lineTo(S, k * S / n + 5); g.stroke(); }
    g.strokeStyle = 'rgba(60,55,50,.5)'; g.lineWidth = 2; for (let c = 0; c < 2; c++) { let x = R() * S, y = R() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (R() - .5) * 60; y += (R() - .5) * 60; g.lineTo(x, y); } g.stroke(); } },
  // WP-K2: asphalt that reads from a camera 0.25 above it: grain, tar-sealed cracks, patch squares, oil stains
  asphalt: (g, S) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S); speckle(g, S, 16000, .2, 1, 2.6, 7, ['#444', '#fff', '#888']); speckle(g, S, 60, .06, 20, 90, 8, ['#555']);
    const R = rng(17); g.fillStyle = 'rgba(70,70,76,.22)'; for (let i = 0; i < 3; i++) { const w = S * (.08 + R() * .12), h = S * (.06 + R() * .1); g.fillRect(R() * (S - w), R() * (S - h), w, h); }
    for (let i = 0; i < 4; i++) { const x = R() * S, y = R() * S, r = g.createRadialGradient(x, y, 0, x, y, S * .05); r.addColorStop(0, 'rgba(30,30,40,.28)'); r.addColorStop(1, 'rgba(30,30,40,0)'); g.fillStyle = r; g.fillRect(x - S * .05, y - S * .05, S * .1, S * .1); }
    g.lineCap = 'round'; g.lineJoin = 'round'; for (let c = 0; c < 6; c++) { let x = R() * S, y = R() * S, a = R() * 6.28; const pts = [[x, y]];
      for (let k = 0; k < 10; k++) { a += (R() - .5) * 1.2; x += Math.cos(a) * S * .03; y += Math.sin(a) * S * .03; pts.push([x, y]); }
      for (const [w, col] of [[S * .012, 'rgba(40,40,46,.35)'], [S * .003, 'rgba(20,20,24,.75)']]) { g.lineWidth = w; g.strokeStyle = col; g.beginPath(); pts.forEach(([u, v], i) => i ? g.lineTo(u, v) : g.moveTo(u, v)); g.stroke(); } } },
  grass: (g, S) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S); speckle(g, S, 260, .1, 18, 60, 9, ['#c8e8a0', '#8fb070']); const R = rng(10); g.strokeStyle = 'rgba(70,120,40,.35)'; g.lineWidth = 2; for (let i = 0; i < 900; i++) { const x = R() * S, y = R() * S; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * 6, y - 6 - R() * 6); g.stroke(); } },
  plain: (g, S) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S); speckle(g, S, 1600, .05, 1, 5, 11, ['#a0a0a0', '#ffffff']); speckle(g, S, 40, .04, 30, 90, 12, ['#d0d0d0']); },
  shingle: (g, S) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S); const R = rng(13), rows = 8, w = S / 6; for (let r = 0; r < rows; r++) { const off = r % 2 ? w / 2 : 0; for (let c = -1; c < 7; c++) { const v = .8 + R() * .22; g.fillStyle = `rgb(${255 * v | 0},${255 * v | 0},${255 * v | 0})`; g.fillRect(c * w + off + 2, r * S / rows + 2, w - 4, S / rows - 5); } g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, (r + 1) * S / rows - 5, S, 4); } },
};
const fontB = px => `900 ${px}px "Arial Black", Arial, sans-serif`;
const text = (g, s, x, y, px, col, stroke) => { g.font = fontB(px); g.textAlign = 'center'; g.textBaseline = 'middle'; if (stroke) { g.lineWidth = px * .14; g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(s, x, y); } g.fillStyle = col; g.fillText(s, x, y); };
const heart = (g, x, y, s, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x, y + s); g.bezierCurveTo(x - s * 1.6, y - s * .2, x - s * .5, y - s * 1.3, x, y - s * .4); g.bezierCurveTo(x + s * .5, y - s * 1.3, x + s * 1.6, y - s * .2, x, y + s); g.fill(); };
const PICS = {
  sign_school: (g, w, h) => { g.fillStyle = '#f1ebdc'; g.fillRect(0, 0, w, h); text(g, 'MAPLEBROOK SCHOOL', w / 2, h / 2 + 4, h * .5, '#7a2a1e'); },
  sign_monument: (g, w, h) => { g.fillStyle = '#1f3c8a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f5c22a'; g.lineWidth = 12; g.strokeRect(14, 14, w - 28, h - 28); text(g, 'MAPLEBROOK', w / 2, h * .32, h * .22, '#ffffff'); text(g, 'MIDDLE SCHOOL', w / 2, h * .55, h * .13, '#f5c22a'); text(g, 'Welcome back, students!', w / 2, h * .78, h * .09, '#ffffff'); },
  flag: (g, w, h) => { g.fillStyle = '#1f3c8a'; g.fillRect(0, 0, w, h); g.fillStyle = '#f5c22a'; g.fillRect(0, h * .4, w, h * .2); g.save(); g.translate(w * .3, h * .5); g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? h * .12 : h * .28, a = i * Math.PI / 5 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fillStyle = '#ffffff'; g.fill(); g.restore(); },
  sign_comedy: (g, w, h) => { g.fillStyle = '#fbf6e8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1c1c22'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16); text(g, 'NOW SHOWING', w / 2, h * .3, h * .2, '#d8302e'); text(g, 'Only Comedy', w / 2, h * .66, h * .34, '#1c1c22'); },
  sign_cinema: (g, w, h) => { g.fillStyle = '#d8302e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f4d03a'; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20); 'CINEMA'.split('').forEach((c, i) => text(g, c, w / 2, h * (.12 + i * .155), w * .62, '#fff6c8', '#8a1c1c')); },
  sign_cinema_front: (g, w, h) => { g.fillStyle = '#1f6e6a'; g.fillRect(0, 0, w, h); text(g, 'CINEMA', w / 2, h / 2 + 4, h * .66, '#f4d03a', '#0f3a38'); },
  sign_lost: (g, w, h) => { g.fillStyle = '#fbfaf5'; g.fillRect(0, 0, w, h); text(g, 'LOST + FOUND', w / 2, h / 2 + 2, h * .5, '#1c1c22'); },
  sign_tickets: (g, w, h) => { g.fillStyle = '#f4d03a'; g.fillRect(0, 0, w, h); text(g, 'TICKETS', w / 2, h / 2 + 3, h * .7, '#8a1c1c'); },
  sign_pizza: (g, w, h) => { g.fillStyle = '#2f8a4a'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd25a'; g.beginPath(); g.moveTo(w * .08, h * .2); g.lineTo(w * .2, h * .2); g.lineTo(w * .14, h * .85); g.fill(); g.fillStyle = '#e0382e'; for (const [x, y] of [[.12, .32], [.16, .4], [.14, .55]]) { g.beginPath(); g.arc(w * x, h * y, h * .05, 0, 7); g.fill(); } text(g, "TONY'S PIZZA", w * .58, h / 2 + 4, h * .46, '#ffffff', '#1a5a2e'); },
  billboard_love: (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ff7eb6'); gr.addColorStop(1, '#ffb0d0'); g.fillStyle = gr; g.fillRect(0, 0, w, h); heart(g, w * .17, h * .52, h * .26, '#e8143a'); heart(g, w * .17, h * .5, h * .19, '#ff4a6a'); text(g, 'Love = +1 Day', w * .6, h * .42, h * .2, '#ffffff', '#b0103a'); text(g, 'Spread it today!', w * .6, h * .7, h * .1, '#ffffff'); },
  poster_movie1: (g, w, h) => { g.fillStyle = '#1c2a6a'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(w * .5, h * .4, w * .28, 0, 7); g.fill(); g.fillStyle = '#1c1c22'; for (const sx of [-.1, .1]) { g.beginPath(); g.arc(w * (.5 + sx), h * .37, w * .04, 0, 7); g.fill(); } g.lineWidth = 8; g.strokeStyle = '#1c1c22'; g.beginPath(); g.arc(w * .5, h * .42, w * .14, .2, Math.PI - .2); g.stroke(); text(g, 'LOL', w / 2, h * .75, w * .3, '#ffffff'); text(g, 'THE MOVIE', w / 2, h * .88, w * .12, '#ffd23a'); },
  poster_movie2: (g, w, h) => { g.fillStyle = '#e84a2a'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.fillRect(w * .2, h * .2, w * .6, h * .35); g.fillStyle = '#1c1c22'; g.fillRect(w * .3, h * .3, w * .12, h * .1); g.fillRect(w * .58, h * .3, w * .12, h * .1); text(g, 'BOB', w / 2, h * .68, w * .3, '#ffffff', '#7a1a0a'); text(g, 'GOES BOING', w / 2, h * .82, w * .11, '#ffffff'); },
  poster_movie3: (g, w, h) => { g.fillStyle = '#3fbf5a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 5; i++) { g.fillStyle = ['#ffd23a', '#3a78ea', '#e8413a', '#ffffff', '#ff8fd8'][i]; g.fillRect(w * (.12 + i * .16), h * (.25 + (i % 2) * .08), w * .12, h * .3); } text(g, 'BLOCK', w / 2, h * .74, w * .26, '#ffffff', '#1a6a2e'); text(g, 'PARTY 2', w / 2, h * .87, w * .17, '#ffd23a'); },
};
const PIC_SIZE = { sign_lost: [512, 224], sign_school: [1536, 214], sign_monument: [1024, 400], flag: [384, 256], sign_comedy: [1024, 168], sign_cinema: [256, 1024], sign_cinema_front: [1024, 222], sign_tickets: [512, 92],
  sign_pizza: [1024, 205], billboard_love: [1280, 580], poster_movie1: [384, 640], poster_movie2: [384, 640], poster_movie3: [384, 640] };
// V4 flicker fix (2026-11-12): ground layers of set.glb that lie on another layer at the same height (plaza paving and paths at y .02 on
// the park lawn at .02, love f326) or 5-10 mm above one (joints on the sidewalk, driveway on lawn / sidewalk). Every ground layer is now
// at least 2 cm from the one under it (depth buffer near .1 / far 600: 2 cm is safe past 150 D, the fov-26 cameras' longest throws).
// Levels after the lift: asphalt -.30, paint -.27, soil -.08, grass -.05, lawn / sidewalk / curb 0, joints .02, lawn .02, driveway .04,
// paving / path .045, asphalt_lot .05 (another zone), paint on the lot .07.
const LIFT = { sidewalk_joint: .015, paving: .025, path: .025, driveway: .03 };
const MAPS = {brick: ['brick', 4], brick_dark: ['brick', 4], sidewalk: ['pave', 4], paving: ['pave', 3.2], path: ['plain', 3], driveway: ['pave', 5], asphalt: ['asphalt', 6], asphalt_lot: ['asphalt', 6], grass: ['grass', 6], lawn: ['grass', 5],
  roof_a: ['shingle', 3], roof_b: ['shingle', 3], stone: ['plain', 4], concrete: ['plain', 4], cinema_wall: ['plain', 5], store_wall: ['plain', 5], house_a: ['plain', 5], house_b: ['plain', 5], curb: ['plain', 3], foundation: ['plain', 3], porch_floor: ['plain', 2] };

const hexRgb = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const rgbHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => rgbHex(hexRgb(a).map((v, i) => v + (hexRgb(b)[i] - v) * t));

export function buildTown(THREE, scene, opts = {}) {
  const lookName = LOOKS[opts.look] ? opts.look : 'day', L = LOOKS[lookName], COL = { ...BASE, ...LOOK_COL[lookName] }, clay = !!opts.clay;
  const zone = ZONES[opts.zone] !== undefined ? opts.zone : 'school', ax = ZONES[zone];
  const [px, pz] = opts.place || [0, 0];
  const ox = px - ax, oz = pz - AZ;            // kit -> film offset: the zone anchor lands on opts.place
  const group = new THREE.Group(); group.name = 'set.rbx_town.' + zone + '.' + lookName; scene.add(group); group.position.set(ox, 0, oz);
  const lights = [{ id: 'sun', kind: 'sun', dir: L.sun.dir, color: L.sun.color, power: L.sun.power, wrap: .25 }];
  if (L.fill) lights.push({ id: 'fill', kind: 'sun', dir: L.fill.dir, color: L.fill.color, power: L.fill.power, wrap: .6 });
  if (L.night) LAMPS.map(p => [Math.hypot(p[0] - ax, p[2] - AZ), p]).sort((a, b) => a[0] - b[0]).slice(0, 6)
    .forEach(([, p], i) => lights.push({ id: 'lamp' + i, kind: 'point', pos: [p[0] + ox, p[1], p[2] + oz], color: [1.0, .78, .45], power: 3.4, fall: .2, range: 17, wrap: .3 }));
  const rig = createLightRig(THREE, { town: { sky: L.sky, ground: L.ground, fog: L.fog, ao: L.ao, lights } }, {});
  const lightDir = L.sun.dir.slice();
  const SH = { uShadowMap: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() }, uShadowOn: { value: 0 }, uShadowTexel: { value: 1 / 2048 }, uShadowSoft: { value: 1.4 }, uShadowBias: { value: .0006 }, uSunDir: { value: new THREE.Vector3(...lightDir) } };
  const kit = createKit(THREE, rig, { shadow: SH, group });
  const DM = {}, DR = createDress(THREE, { kit, rig, place: 'town', group, key: lightDir, night: !!L.night, opts: clay ? false : (opts.dress ?? {}), marks: DM }); DR.wrap();
  const SAT = opts.sat ?? (lookName === 'snow' ? .08 : .18);
  const texs = {}; for (const [k, f] of Object.entries(TEX)) { const S = /asphalt|pave/.test(k) ? 1024 : 512; texs[k] = cv(THREE, S, S, f, true); }
  const pics = {}; for (const [k, f] of Object.entries(PICS)) pics[k] = cv(THREE, ...PIC_SIZE[k], f);
  const mats = {};
  const tintKc = h => { // look tints for Kenney swatches
    if (lookName === 'snow') { const [r, g, b] = hexRgb(h); if (g > r * 1.08 && g > b) return mix(h, '#eef4f6', .62); }
    if (lookName === 'pastel') return mix(h, '#ffffff', .18);
    return h; };
  const matOf = (key, glbColor) => { if (mats[key]) return mats[key];
    const emitN = L.night ? (EMIT_NIGHT[key] ?? 0) : 0;
    if (clay) return (mats[key] = kit.surface('town', /glow|bulb/.test(key) ? '#ffffff' : '#c9c9c9', { emit: /glow|bulb/.test(key) ? .8 : 0 }));
    const F = { ...(FIN[key] || {}) };
    let color = COL[key] || COL[key.replace(/_(d|line|ridge)$/, '')];
    if (!color && key.startsWith('kc_')) color = tintKc('#' + key.slice(3));
    if (!color && glbColor) color = tintKc(rgbHex(glbColor.map(v => Math.pow(v, 1 / 2.2))));
    color = saturate(color || '#c0c0c0', SAT);
    let map = null, uv = 4, tile = [1, 1];
    if (MAPS[key]) { map = texs[MAPS[key][0]]; tile = [MAPS[key][1], MAPS[key][1]]; }
    else if (pics[key]) { map = pics[key]; uv = 0; color = '#ffffff'; }
    const emit = Math.max(F.emit || 0, emitN);
    return (mats[key] = kit.surface('town', color, { map, uv, tile, bump: F.bump, gloss: F.gloss, spec: F.spec, grime: F.grime, emit })); };

  // sky dome round the zone (mountains sit inside it), capsules for scale
  const skyName = opts.sky === false ? null : (opts.sky || SKY_OF[lookName]);
  const plate = skyName ? skyPlate(THREE, kit, px, pz, 470, { ...L.sky3, sun: L.sun.dir }, skyName, { base: new URL('../assets/rbx/sky/', import.meta.url).href }) : (kit.sky(px, pz, 470, { ...L.sky3, sun: L.sun.dir }), null);
  const G = createGround(THREE, group, { night: !!L.night });   // WP-K grounding: blobs under every prop that stands on the ground, and under people
  // WP-K2 bunting: zig-zag strings lamp to lamp across the street (lamp heads y 7.2), kit coordinates, all along the street
  if (opts.bunting !== false) { const lp = LAMPS.slice().sort((a, b) => a[0] - b[0]), spans = [];
    for (let i = 0; i + 1 < lp.length; i++) { const [a, b] = [lp[i], lp[i + 1]]; spans.push([a[0], 6.7, a[2] * .97, b[0], 6.7, b[2] * .97]); }
    bunting(THREE, kit, 'town', spans, { sag: 1.1, group }); }
  // WP-K2 zebra crossings at the zones that had none (school + park have the glb's own)
  { const zm = kit.surface('town', '#f6f6f2', { grime: .12 }); for (const zn of ['houses', 'cinema', 'parking']) for (let k = 0; k < 7; k++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(.8, .02, 8.4), zm); b.position.set(ZONES[zn] + 6 - 4.5 + k * 1.5, -.28, 0); b.name = 'set.paint_zebra'; group.add(b); } }
  for (const [x, z, c] of opts.capsules || []) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(.62, 1.76, 8, 20), kit.surface('town', c || '#e8e2d6', { gloss: 10, spec: .1 })); m.position.set(ax + x, 1.5, AZ + z); m.scale.set(1, 1, .7); m.name = 'capsule'; group.add(m); G.contactBlob([ax + x + ox, AZ + z + oz], .8); }

  const stats = { prims: 0, mats: 0 };
  const ready = (async () => {
    if (plate) await plate.ready;
    const glb = await readGlb(THREE, new URL('set.glb', ASSETS).href);
    if (!glb) { console.log('rbx town: set.glb missing'); return stats; }
    for (const root of glb.roots) for (const p of root.prims) { const key = (p.material || root.name).split('.')[0];
      const o = new THREE.Mesh(p.geometry, matOf(key, p.color)); o.applyMatrix4(root.matrix); if (LIFT[key]) o.position.y += LIFT[key]; o.name = 'set.' + key; o.frustumCulled = false; group.add(o); stats.prims++;
      G.auto(o, key, { floorY: 0, lift: .5, maxFoot: 5, raised: false }); }
    stats.blobs = G.flush(); stats.mats = Object.keys(mats).length; stats.dress = await DR.finish(PRESETS.town(ax, AZ)); return stats;
  })();

  function update(t) { rig.update(t); kit.update(t); }
  update(0);
  const marks = Object.fromEntries(Object.entries(MARKS[zone]).map(([k, [x, z]]) => [k, [px + x, pz + z]]));
  Object.assign(DM, marks);
  const look = opts.post ? createPost(THREE, rig, opts.post) : undefined;
  return { name: 'rbx_town', zone, group, lightDir, skyColor: L.fog.color, marks, bounds: { x: [px - 30, px + 30], z: [pz - 50, pz + 20] }, casters: [], uniforms: SH, update, ready, rig, look, lookName, contactBlob: G.contactBlob };
}
export default { buildTown };
