// world/rbx/hallway.js: the Roblox V3 school hallway kit set (WP-S1, 2026-11-12). Geometry from Blender (blender/rbx/build_hallway.py ->
// world/assets/rbx/hallway/set.glb, layout.json), painted details (posters, signs, clock, floor patterns) drawn here on canvases.
// Light is data (LOOKS below, world/look/lights.js form), read by rigkit's surface shader: no baked light, pure in t.
// Looks: blue_day (levitate: blue lockers, cream walls), night (monster: blue + red lockers, checker floor, purple-pink lights),
// pink_day (cantcry: pink walls, red lockers, cracked white floor). Same walls and marks in every look (CONTRACT.md next to the glb).
// Use from a film's own set.js:  import { buildHallway } from '../../world/rbx/hallway.js';
//                                export function buildSet(THREE, scene, opts) { return buildHallway(THREE, scene, opts); }
// opts: { look: 'blue_day' | 'night' | 'pink_day', clay: false, capsules: [[x, z, '#hex'?], ...], post: {...} (post pass), place: [x, z] offset }
import { createLightRig } from '../look/lights.js';
import { createKit } from '../look/rigkit.js';
import { readGlb } from '../look/glb.js';
import { createPost } from '../look/post.js';
import { createGround, dropParts, saturate } from './ground.js';
import { createDress, PRESETS } from './dress.js';   // V4-ENV: sprites, decals, textures, AO, form/rim shading (opts.dress: false = V3 look)
// WP-K2: ryan_locker gap materials; colours +15 % saturation (opts.sat, 0 = as before); night lifted to a readable moonlit blue
const GAP = { keys: /^(locker|lockerb|locker_door|lockerb_door|locker_dark|locker_shelf|chrome|sticker_\w+|skirting|bag_\w+|book_\w+|paper_w)$/ };

const ASSETS = new URL('../assets/rbx/hallway/', import.meta.url);
const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const PANEL_Z = [6, 0, -6, -12, -18, -24, -30];

// ---- lights per look. Colours linear. Panels are points just under the ceiling; the window gives a sun; a fill keeps it high key
const panels = (col, pw, fall, skip = []) => PANEL_Z.filter(z => !skip.includes(z)).slice(0, 6).map((z, i) => ({ id: 'p' + i, kind: 'point', pos: [0, 5.15, z], color: col, power: pw, fall, range: 16, wrap: .45 }));
const LOOKS = {
  blue_day: { sky: [.5, .53, .58], ground: [.36, .34, .3], fog: { color: '#e9eef5', density: .0035 }, ao: { floor: 0, h: 1.4, amt: .32 },
    // WP-K: the window sun (left wall bay, z -19) is the key; panels lowered; fill ~40 % of the key from the opposite side
    lights: [...panels([1.0, .98, .93], .8, .07, [6]), { id: 'sun', kind: 'sun', dir: norm([-.8, .55, .25]), color: [1.0, .93, .8], power: .88, wrap: .25 },
      { id: 'fill', kind: 'sun', dir: norm([.3, .7, 1]), color: [.75, .82, .95], power: .35, wrap: .6 }],
    sky3: { top: '#5fa8ea', hor: '#d6ecfb', low: '#9fc7e4', cloudLit: '#ffffff', cloudDark: '#b9cde0', sun: norm([-.8, .55, .25]), sunColor: [.4, .36, .3], cover: .35, scale: 1 } },
  // S1b night: not a wash. Low blue-purple ambient, a pink-violet POOL under each panel (spots straight down, soft edge, dark gaps
  // between), a cool moon spill through the window bay only (a spot from outside), the EXIT sign's green glow. Pool light is close
  // to white-pink so the lockers keep their own blue and red inside it.
  // WP-K2 (V3_REF E-monster a): lifted to a blue moonlit level, lockers / floor checks / posters readable between the pools
  night: { sky: [.17, .16, .33], ground: [.08, .07, .14], fog: { color: '#1a1838', density: .009 }, ao: { floor: 0, h: 1.6, amt: .42 },
    lights: [...[0, -6, -12, -18, -24, -30].map((z, i) => ({ id: 'p' + i, kind: 'spot', pos: [0, 5.45, z], dir: [0, -1, 0], cone: [8, 34], color: i % 2 ? [.86, .62, 1.0] : [1.0, .62, .88], power: 3.4, fall: .02, range: 10, wrap: .3 })),
      { id: 'moon', kind: 'spot', pos: [-8.5, 6.5, -19], dir: norm([1, -.62, .15]), cone: [22, 40], color: [.38, .55, 1.0], power: 2.1, fall: .004, range: 18, wrap: .2 },
      { id: 'exit', kind: 'point', pos: [0, 5.0, -20], color: [.25, 1, .4], power: .5, fall: .9, range: 4.5, wrap: .5 }],
    sky3: { top: '#0b0f2e', hor: '#2c2a5e', low: '#1a1840', cloudLit: '#47457e', cloudDark: '#0e0e26', sun: norm([-.8, .45, -.2]), sunColor: [.1, .12, .2], cover: .3, scale: 1 } },
  pink_day: { sky: [.54, .49, .53], ground: [.4, .33, .35], fog: { color: '#f6e6ee', density: .0035 }, ao: { floor: 0, h: 1.4, amt: .32 },
    lights: [...panels([1.0, .96, .94], .8, .07, [6]), { id: 'sun', kind: 'sun', dir: norm([-.8, .55, .25]), color: [1.0, .9, .78], power: .88, wrap: .25 },
      { id: 'fill', kind: 'sun', dir: norm([.3, .7, 1]), color: [.95, .8, .88], power: .35, wrap: .6 }],
    sky3: { top: '#6fb3ee', hor: '#f4e2ef', low: '#c8b8d8', cloudLit: '#ffffff', cloudDark: '#d8c4d8', sun: norm([-.8, .55, .25]), sunColor: [.4, .34, .3], cover: .3, scale: 1 } },
};

// S1b: the rooms behind the open doors (right classroom z -6, left classroom z -31, the library past z -38) light in their own
// place 'room' (r_* / rk_* materials): warm and a little brighter than the hall by day, so the doorways read as lit depth; at night
// a dim moonlit blue with one warm desk lamp in the library.
const ROOMS = {
  blue_day: { sky: [.62, .6, .56], ground: [.42, .36, .3], lights: [
    { id: 'c1', kind: 'point', pos: [7.6, 5.0, -6], color: [1.0, .9, .74], power: 1.5, fall: .05, range: 14, wrap: .45 },
    { id: 'c2', kind: 'point', pos: [-6.6, 5.0, -31], color: [1.0, .9, .74], power: 1.5, fall: .05, range: 14, wrap: .45 },
    { id: 'l1', kind: 'point', pos: [0, 5.0, -41.5], color: [1.0, .86, .66], power: 1.6, fall: .04, range: 16, wrap: .45 },
    { id: 'l2', kind: 'point', pos: [0, 5.0, -46], color: [1.0, .86, .66], power: 1.4, fall: .04, range: 16, wrap: .45 },
    { id: 'sun', kind: 'sun', dir: norm([.6, .7, .3]), color: [1.0, .94, .84], power: .35, wrap: .5 }] },
  night: { sky: [.05, .05, .11], ground: [.02, .02, .05], lights: [
    { id: 'c1', kind: 'point', pos: [10, 3.5, -6], color: [.35, .5, 1.0], power: .9, fall: .06, range: 10, wrap: .4 },
    { id: 'c2', kind: 'point', pos: [-8.6, 3.5, -31], color: [.35, .5, 1.0], power: .9, fall: .06, range: 10, wrap: .4 },
    { id: 'lamp', kind: 'point', pos: [1.4, 2.2, -45.5], color: [1.0, .7, .4], power: 1.6, fall: .4, range: 7, wrap: .4 },
    { id: 'l1', kind: 'point', pos: [0, 4.5, -42], color: [.5, .45, .95], power: .5, fall: .05, range: 12, wrap: .4 }] },
};
ROOMS.pink_day = ROOMS.blue_day;

// ---- colours per look (sRGB hex). Keys = Blender material names. Kenney's (k_*) keep their own colour unless named here
const BASE = {
  ceiling: '#f1efe8', tbar: '#e6e4de', panel_frame: '#dcdad4', trim: '#d9cfb6', skirting: '#5d5148', frame: '#c9c3b6', door: '#a86f42', door_glass: '#cfe6f2',
  locker_dark: '#1e2230', locker_shelf: '#59606e', chrome: '#cfd4da', steel: '#c4c9cf', steel_dark: '#4d535c', tile_wall: '#e8eef0', cork: '#b98a55', wood: '#b07a48',
  red: '#d8342c', yellow: '#ffcc1c', exit_box: '#f2f2f2', clock_rim: '#25262b', grass: '#5fb24a', path: '#cfc3a8', brick: '#b5553f', fence: '#f2efe6', window_far: '#9fc6e0',
  paper_w: '#fbfaf5', paper_y: '#fff07a', paper_b: '#8fd0ff', paper_p: '#ff9ccf', paper_g: '#9ce87c',
  book_r: '#e8413a', book_g: '#3fbf5a', book_b: '#3478e0', book_y: '#f5c22a', bag_r: '#e2453c', bag_g: '#3dae58', bag_b: '#3366d6', bag_y: '#f0b820',
  bag_rd: '#a32a24', bag_gd: '#2a7a3e', bag_bd: '#22449a', bag_yd: '#b88412',
  pen_r: '#e8413a', pen_y: '#ffd23a', pen_b: '#3a78ea', pen_g: '#3fbf5a', pen_w: '#ffffff', string: '#444', gold: '#e8b830',
  k_leafsGreen: '#4fae3c', k_grass: '#5cba44', k_plant: '#3f9a3a', k_woodBark: '#7a5236',
  // S1b scatter + rooms (r_* and rk_* draw in the 'room' light place)
  bin_blue: '#2f7fe0', bin_blued: '#1f5cb0', bin_green: '#3fae4e', bin_greend: '#2a8038', ball: '#e8742a',
  r_floor: '#c79a68', r_ceiling: '#f3f1ea', r_wall: '#f2e2b8', r_skirt: '#6a5240', r_frame: '#efe9dc', r_sky: '#cfe9ff', r_board: '#2f6a4a', r_chalk: '#f4f4ee', r_lamp: '#ffffff', r_rug: '#c8443c',
};
const LOOK_COL = {
  blue_day: { floor: '#ffffff', wall: '#f3e6c8', locker: '#2f63d6', lockerb: '#2856c2', locker_door: '#3a70e6', lockerb_door: '#3163d4', locker_trim: '#2a4fa8' },
  night: { panel_frame: '#3a3458', r_wall: '#8a86b8', r_sky: '#3a4a8a', r_floor: '#8a6a58', r_frame: '#a8a6c8', floor: '#ffffff', wall: '#3b3570', locker: '#2c4fd0', lockerb: '#c8303c', locker_door: '#3a62e6', lockerb_door: '#de3a46', locker_trim: '#262a5a', ceiling: '#6a6490', tbar: '#5a5480', trim: '#4a4380', door: '#7a4a35', frame: '#8a84a8', window_far: '#ffc46a', grass: '#2d5a40', k_leafsGreen: '#2d6a48', k_grass: '#2d6a40', brick: '#6a3040', fence: '#9a98b8' },
  pink_day: { floor: '#ffffff', wall: '#f7b9cf', locker: '#e0353f', lockerb: '#d22e3a', locker_door: '#ee4550', lockerb_door: '#e03844', locker_trim: '#b02a35', trim: '#f2d4df', frame: '#f4eef0' },
};
// how each surface answers light (rigkit surface options)
const FIN = {
  floor: { gloss: 40, spec: .1, wet: .1, bump: .02, grime: .1 }, wall: { bump: .03, grime: .12 }, locker: { gloss: 30, spec: .22, grime: .06 }, locker_door: { gloss: 34, spec: .25, grime: .05 },
  chrome: { gloss: 70, spec: .8 }, gold: { gloss: 70, spec: 1.0 }, steel: { gloss: 55, spec: .5 }, door_glass: { gloss: 80, spec: .9, emit: .25 }, window_far: { emit: .25 }, panel: { emit: 1.25 }, sign_exit: { emit: 1.1 },
  door: { gloss: 25, spec: .15, bump: .03 }, wood: { gloss: 25, spec: .15 }, red: { gloss: 40, spec: .35 }, yellow: { gloss: 30, spec: .2 },
  r_sky: { emit: .9 }, r_lamp: { emit: 1.1 }, r_floor: { gloss: 30, spec: .12 }, r_board: { gloss: 20, spec: .1 }, bin: { gloss: 30, spec: .2 }, ball: { gloss: 20, spec: .15 }, sticker: { gloss: 50, spec: .3 },
};

// ---- canvas pictures: quiet base textures + the loud painted details
function cv(THREE, w, h, draw, wrap = false) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; /* V4: renderer max (three clamps), mipmaps on (CanvasTexture default) */ t.colorSpace = THREE.NoColorSpace; return t; }
const rng = s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
function speckle(g, S, n, a, r0, r1, seed, cols) { const R = rng(seed); for (let i = 0; i < n; i++) { g.globalAlpha = a * R(); g.fillStyle = cols[Math.floor(R() * cols.length)]; const r = r0 + R() * (r1 - r0); g.beginPath(); g.ellipse(R() * S, R() * S, r, r * (.5 + R() * .5), R() * 3, 0, 7); g.fill(); } g.globalAlpha = 1; }
const FLOORS = {
  // blue_day: big cream / pale blue checker (V1 levitate), night: blue / white checker (V1 monster), pink_day: white tiles with cracks (V1 cantcry)
  blue_day: (g, S) => { const n = 2; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? '#c9dcf0' : '#f6f4ee'; g.fillRect(i * S / n, j * S / n, S / n, S / n); } speckle(g, S, 1400, .07, 1, 4, 3, ['#8a8a8a', '#ffffff']); g.strokeStyle = 'rgba(120,130,140,.35)'; g.lineWidth = 3; for (let k = 0; k <= n; k++) { g.beginPath(); g.moveTo(k * S / n, 0); g.lineTo(k * S / n, S); g.moveTo(0, k * S / n); g.lineTo(S, k * S / n); g.stroke(); } },
  night: (g, S) => { const n = 2; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? '#3a5ad8' : '#eef0fa'; g.fillRect(i * S / n, j * S / n, S / n, S / n); } speckle(g, S, 1200, .06, 1, 4, 5, ['#555', '#fff']); g.strokeStyle = 'rgba(40,40,70,.4)'; g.lineWidth = 3; for (let k = 0; k <= n; k++) { g.beginPath(); g.moveTo(k * S / n, 0); g.lineTo(k * S / n, S); g.moveTo(0, k * S / n); g.lineTo(S, k * S / n); g.stroke(); } },
  pink_day: (g, S) => { g.fillStyle = '#f8f6f4'; g.fillRect(0, 0, S, S); speckle(g, S, 1400, .06, 1, 4, 9, ['#999', '#fff']); g.strokeStyle = 'rgba(150,140,150,.45)'; g.lineWidth = 3; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * S / 4, 0); g.lineTo(k * S / 4, S); g.moveTo(0, k * S / 4); g.lineTo(S, k * S / 4); g.stroke(); }
    const R = rng(21); g.strokeStyle = 'rgba(70,60,70,.55)'; g.lineWidth = 2; for (let c = 0; c < 2; c++) { let x = R() * S, y = R() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 9; k++) { x += (R() - .5) * 70; y += (R() - .3) * 50; g.lineTo(x, y); } g.stroke(); } },
};
const plaster = (g, S) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S); speckle(g, S, 2200, .05, 1, 6, 11, ['#b8b0a0', '#ffffff']); speckle(g, S, 60, .04, 30, 90, 12, ['#d8d0c0']); };
const ceilT = (g, S) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S); speckle(g, S, 3000, .12, 1, 3, 13, ['#9a9690']); };
const fontB = px => `900 ${px}px "Arial Black", Arial, sans-serif`;
const text = (g, s, x, y, px, col, stroke) => { g.font = fontB(px); g.textAlign = 'center'; g.textBaseline = 'middle'; if (stroke) { g.lineWidth = px * .14; g.strokeStyle = stroke; g.strokeText(s, x, y); } g.fillStyle = col; g.fillText(s, x, y); };
const PICS = {
  sign_library: (g, w, h) => { g.fillStyle = '#1f3c8a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f5c22a'; g.lineWidth = 10; g.strokeRect(12, 12, w - 24, h - 24); text(g, 'LIBRARY', w / 2, h / 2 + 4, h * .5, '#ffffff'); },
  sign_exit: (g, w, h) => { g.fillStyle = '#0f2a16'; g.fillRect(0, 0, w, h); text(g, 'EXIT', w / 2, h / 2 + 3, h * .62, '#4dff7a'); },
  sign_room: (g, w, h) => { g.fillStyle = '#2b2d36'; g.fillRect(0, 0, w, h); text(g, 'ROOM 104', w / 2, h / 2 + 3, h * .42, '#f2f2f2'); },
  clock_face: (g, w, h) => { const c = w / 2; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(c, c, c, 0, 7); g.fill(); g.fillStyle = '#222'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.save(); g.translate(c + Math.sin(a) * c * .8, c - Math.cos(a) * c * .8); g.rotate(a); g.fillRect(-4, -14, 8, i % 3 ? 16 : 28); g.restore(); }
    g.lineCap = 'round'; g.strokeStyle = '#222'; g.lineWidth = 12; g.beginPath(); g.moveTo(c, c); g.lineTo(c + c * .32, c - c * .3); g.stroke(); g.lineWidth = 7; g.beginPath(); g.moveTo(c, c); g.lineTo(c - c * .1, c - c * .66); g.stroke(); g.strokeStyle = '#e8413a'; g.lineWidth = 3; g.beginPath(); g.moveTo(c, c); g.lineTo(c + c * .5, c + c * .45); g.stroke(); },
  poster_a: (g, w, h) => { g.fillStyle = '#ffe14d'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8413a'; g.fillRect(w * .18, h * .35, w * .3, h * .38); g.fillStyle = '#3478e0'; g.fillRect(w * .5, h * .35, w * .3, h * .38); g.fillStyle = '#fff'; g.fillRect(w * .47, h * .35, w * .06, h * .38); text(g, 'READ!', w / 2, h * .17, w * .24, '#1f2a6a'); text(g, 'every day', w / 2, h * .86, w * .1, '#1f2a6a'); },
  poster_b: (g, w, h) => { g.fillStyle = '#2b2f8f'; g.fillRect(0, 0, w, h); g.strokeStyle = '#7ce0ff'; g.lineWidth = 8; for (let k = 0; k < 3; k++) { g.save(); g.translate(w * .25, h * .5); g.rotate(k * 1.05); g.beginPath(); g.ellipse(0, 0, w * .16, h * .07, 0, 0, 7); g.stroke(); g.restore(); } g.fillStyle = '#ff6ab0'; g.beginPath(); g.arc(w * .25, h * .5, 12, 0, 7); g.fill(); text(g, 'SCIENCE', w * .66, h * .4, h * .2, '#ffffff'); text(g, 'FAIR', w * .66, h * .64, h * .2, '#ffe14d'); },
  poster_c: (g, w, h) => { g.fillStyle = '#ff8fb8'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8213a'; g.beginPath(); const x = w * .22, y = h * .5, s = h * .22; g.moveTo(x, y + s); g.bezierCurveTo(x - s * 1.6, y - s * .2, x - s * .5, y - s * 1.3, x, y - s * .4); g.bezierCurveTo(x + s * .5, y - s * 1.3, x + s * 1.6, y - s * .2, x, y + s); g.fill(); text(g, 'BE KIND', w * .64, h * .5, h * .26, '#ffffff', '#b0143a'); },
  poster_d: (g, w, h) => { g.fillStyle = '#ff8a1c'; g.fillRect(0, 0, w, h); g.fillStyle = '#1c1c22'; for (let k = 0; k < 5; k++) g.fillRect(w * .05 + k * w * .05, h * .15, w * .025, h * .7); text(g, 'GO', w * .55, h * .36, h * .3, '#1c1c22'); text(g, 'TIGERS!', w * .62, h * .68, h * .24, '#ffffff', '#1c1c22'); },
  poster_e: (g, w, h) => { g.fillStyle = '#7b4fd6'; g.fillRect(0, 0, w, h); const R = rng(4); for (let i = 0; i < 40; i++) { g.fillStyle = ['#ffe14d', '#7ce0ff', '#ff6ab0', '#ffffff'][i % 4]; g.beginPath(); g.arc(R() * w, R() * h * .55, 4 + R() * 9, 0, 7); g.fill(); } text(g, 'SPRING', w / 2, h * .66, w * .2, '#ffffff'); text(g, 'DANCE', w / 2, h * .8, w * .2, '#ffe14d'); text(g, 'FRI 7PM', w / 2, h * .92, w * .09, '#ffffff'); },
};
// S1b: more posters, door signs and locker stickers (stickers: transparent edges cut by the canvas shape, drawn on white so the door shows round them)
Object.assign(PICS, {
  sign_art: (g, w, h) => { g.fillStyle = '#2b2d36'; g.fillRect(0, 0, w, h); text(g, 'ART ROOM', w / 2, h / 2 + 3, h * .42, '#ffd23a'); },
  sign_nurse: (g, w, h) => { g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8213a'; g.fillRect(w * .07, h * .3, h * .4, h * .12); g.fillRect(w * .07 + h * .14, h * .16, h * .12, h * .4); text(g, 'NURSE', w * .58, h / 2 + 3, h * .44, '#c0142a'); },
  poster_f: (g, w, h) => { g.fillStyle = '#3fbf5a'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(w * .22, h * .5, h * .28, 0, 7); g.fill(); g.fillStyle = '#1c1c22'; g.beginPath(); g.arc(w * .22, h * .5, h * .1, 0, 7); g.fill(); text(g, 'CHESS', w * .64, h * .38, h * .22, '#ffffff'); text(g, 'CLUB', w * .64, h * .64, h * .22, '#1c3a1c'); },
  poster_g: (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8413a'; g.fillRect(0, 0, w, h * .18); g.fillStyle = '#3478e0'; g.fillRect(0, h * .82, w, h * .18); text(g, 'VOTE', w / 2, h * .42, h * .24, '#1f2a6a'); text(g, 'MAX 4 PREZ', w / 2, h * .64, h * .14, '#e8413a'); },
  poster_h: (g, w, h) => { g.fillStyle = '#18a8c8'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffe14d'; g.beginPath(); g.arc(w * .78, h * .3, h * .16, 0, 7); g.fill(); g.fillStyle = '#ffffff'; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(w * (.2 + k * .2), h * .82, w * .14, h * .06, 0, 0, 7); g.fill(); } text(g, 'SWIM', w * .38, h * .38, h * .26, '#ffffff', '#0b5a70'); text(g, 'TEAM', w * .38, h * .6, h * .18, '#ffe14d'); },
  sticker_star: (g, w, h) => { g.fillStyle = '#3a70e6'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd23a'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, r = k % 2 ? w * .2 : w * .46; g.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); } g.fill(); },
  sticker_smile: (g, w, h) => { g.fillStyle = '#ffd23a'; g.fillRect(0, 0, w, h); g.fillStyle = '#1c1c22'; g.beginPath(); g.arc(w * .35, h * .38, w * .06, 0, 7); g.arc(w * .65, h * .38, w * .06, 0, 7); g.fill(); g.lineWidth = w * .07; g.strokeStyle = '#1c1c22'; g.beginPath(); g.arc(w / 2, h * .5, w * .26, .3, Math.PI - .3); g.stroke(); },
  sticker_heart: (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff4a8a'; const x = w / 2, y = h * .5, s = h * .3; g.beginPath(); g.moveTo(x, y + s); g.bezierCurveTo(x - s * 1.6, y - s * .2, x - s * .5, y - s * 1.3, x, y - s * .4); g.bezierCurveTo(x + s * .5, y - s * 1.3, x + s * 1.6, y - s * .2, x, y + s); g.fill(); },
  sticker_bolt: (g, w, h) => { g.fillStyle = '#1c1c22'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffe14d'; g.beginPath(); [[.58, .06], [.24, .56], [.48, .56], [.38, .94], [.78, .4], [.52, .4], [.66, .06]].forEach(([u, v]) => g.lineTo(u * w, v * h)); g.fill(); },
  sticker_note: (g, w, h) => { g.fillStyle = '#fff07a'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(60,60,120,.6)'; g.lineWidth = 3; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(w * .14, h * (.3 + k * .15)); g.lineTo(w * (.6 + (k % 2) * .25), h * (.3 + k * .15)); g.stroke(); } },
});
const PIC_SIZE_S1B = ({ sign_art: [512, 186], sign_nurse: [512, 186], poster_f: [768, 512], poster_g: [768, 512], poster_h: [768, 576], sticker_star: [128, 128], sticker_smile: [128, 128], sticker_heart: [128, 128], sticker_bolt: [128, 128], sticker_note: [128, 166] });
// decal atlas (multiply, 4 x 4 cells): 0 soft blob (contact shadow), 1 strip dark at +u (skirting / locker base AO), 2 scuffs, 3 stain, 4 footprints, 5 gum + grit
function decalAtlas(g, S) { const C = S / 4; g.clearRect(0, 0, S, S);
  const cell = (i, f) => { g.save(); g.translate((i % 4) * C, Math.floor(i / 4) * C); f(); g.restore(); };
  cell(0, () => { const r = g.createRadialGradient(C / 2, C / 2, 0, C / 2, C / 2, C / 2); r.addColorStop(0, 'rgba(20,18,30,.85)'); r.addColorStop(.55, 'rgba(20,18,30,.45)'); r.addColorStop(1, 'rgba(20,18,30,0)'); g.fillStyle = r; g.fillRect(0, 0, C, C); });
  cell(1, () => { const r = g.createLinearGradient(0, 0, C, 0); r.addColorStop(0, 'rgba(20,18,30,0)'); r.addColorStop(.6, 'rgba(20,18,30,.3)'); r.addColorStop(1, 'rgba(20,18,30,.85)'); g.fillStyle = r; g.fillRect(0, 2, C, C - 4); });
  cell(2, () => { const R = rng(31); g.lineCap = 'round'; for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(40,36,40,${.25 + R() * .4})`; g.lineWidth = 2 + R() * 5; const x = C * (.15 + R() * .7), y = C * (.15 + R() * .7), a = R() * .8 - .4, l = C * (.08 + R() * .25); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l * .5, y + l * a * .3 + 4, x + l, y + l * a); g.stroke(); } });
  cell(3, () => { const R = rng(37); for (let k = 0; k < 7; k++) { const r = g.createRadialGradient(C * (.35 + R() * .3), C * (.35 + R() * .3), 0, C / 2, C / 2, C * (.2 + R() * .25)); r.addColorStop(0, 'rgba(120,100,70,.35)'); r.addColorStop(1, 'rgba(120,100,70,0)'); g.fillStyle = r; g.fillRect(0, 0, C, C); } });
  cell(4, () => { g.fillStyle = 'rgba(60,55,60,.35)'; for (let k = 0; k < 4; k++) { const x = C * (.3 + (k % 2) * .3), y = C * (.12 + k * .22); g.beginPath(); g.ellipse(x, y, C * .06, C * .1, .1, 0, 7); g.fill(); } });
  cell(5, () => { const R = rng(41); for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(50,45,50,${.2 + R() * .5})`; g.beginPath(); g.arc(C * R(), C * R(), 1.5 + R() * (k < 6 ? 9 : 3), 0, 7); g.fill(); } });
}
const PIC_SIZE = { ...PIC_SIZE_S1B, sign_library: [1024, 220], sign_exit: [512, 192], sign_room: [512, 186], clock_face: [512, 512], poster_a: [512, 666], poster_b: [768, 512], poster_c: [768, 512], poster_d: [768, 440], poster_e: [512, 680] };

export function buildHallway(THREE, scene, opts = {}) {
  const lookName = LOOKS[opts.look] ? opts.look : 'blue_day', L = LOOKS[lookName], COL = { ...BASE, ...LOOK_COL[lookName] }, clay = !!opts.clay;
  const group = new THREE.Group(); group.name = 'set.rbx_hallway.' + lookName; scene.add(group);
  const [ox, oz] = opts.place || [0, 0]; group.position.set(ox, 0, oz);
  const lights = L.lights.map(l => ({ ...l, pos: l.pos && [l.pos[0] + ox, l.pos[1], l.pos[2] + oz] }));
  const R0 = ROOMS[lookName], roomLights = R0.lights.map(l => ({ ...l, pos: l.pos && [l.pos[0] + ox, l.pos[1], l.pos[2] + oz] }));
  const rig = createLightRig(THREE, { hall: { sky: L.sky, ground: L.ground, fog: L.fog, ao: L.ao, lights }, room: { sky: R0.sky, ground: R0.ground, fog: L.fog, ao: L.ao, lights: roomLights } }, {});
  const lightDir = [-.35, 1, .3].map(v => v / Math.hypot(-.35, 1, .3));
  const SH = { uShadowMap: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() }, uShadowOn: { value: 0 }, uShadowTexel: { value: 1 / 2048 }, uShadowSoft: { value: 1.4 }, uShadowBias: { value: .0006 }, uSunDir: { value: new THREE.Vector3(...lightDir) } };
  const kit = createKit(THREE, rig, { shadow: SH, group });
  const DM = {}, DR = createDress(THREE, { kit, rig, place: 'hall', group, key: L.lights.find(l => l.id === 'sun')?.dir || [.2, 1, .1], night: lookName === 'night', opts: clay ? false : (opts.dress ?? {}), marks: DM }); DR.wrap();
  const floorT = cv(THREE, 512, 512, FLOORS[lookName], true), plasterT = cv(THREE, 512, 512, plaster, true), ceilTx = cv(THREE, 256, 256, ceilT, true);
  const pics = {}; for (const [k, f] of Object.entries(PICS)) pics[k] = cv(THREE, ...PIC_SIZE[k], f);
  const mats = {};
  const matOf = (key, glbColor) => { if (mats[key]) return mats[key];
    const plc = /^rk?_/.test(key) ? 'room' : 'hall';
    if (clay) return (mats[key] = kit.surface(plc, key === 'panel' ? '#ffffff' : '#c9c9c9', { emit: key === 'panel' ? 1 : 0 }));
    const fam = key.replace(/_door$/, '_door').replace(/^lockerb/, 'locker');
    const F = { ...(FIN[fam] || FIN[key.split('_')[0]] || {}), ...(FIN[key] || {}) };
    let color = COL[key] || COL[key.replace(/_door$/, '')] || (glbColor ? glbColor.map(v => Math.pow(v, 1 / 2.2)) : '#c0c0c0');
    color = saturate(color, opts.sat ?? .15);
    let map = null, uv = 4, tile = [1, 1];
    if (key === 'floor') { map = floorT; tile = lookName === 'pink_day' ? [5.2, 5.2] : [1.7, 1.7]; }
    else if (key === 'wall' || key === 'tile_wall') { map = plasterT; tile = [3, 3]; }
    else if (key === 'ceiling') { map = ceilTx; tile = [1.2, 1.2]; }
    else if (pics[key]) { map = pics[key]; uv = 0; color = '#ffffff'; }
    if (key === 'panel') color = opts.panel || (lookName === 'night' ? '#ff8fd8' : '#ffffff');   // opts.panel (V4 monster): a film's own panel colour
    let emit = F.emit; if (lookName === 'night' && (key === 'r_lamp' || key === 'r_sky')) emit = key === 'r_sky' ? .35 : 0;
    return (mats[key] = kit.surface(plc, color, { map, uv, tile, bump: F.bump, gloss: F.gloss, spec: F.spec, wet: F.wet, grime: F.grime, emit })); };

  // sky dome for the window, and the clay capsules for scale
  kit.sky(ox, oz - 19, 160, L.sky3);
  const G = createGround(THREE, group, { night: lookName === 'night' });   // WP-K grounding
  G.bands({ x: [-3.6, 3.6], z: [-38, 10], ceil: 5.6, h: .75, a: lookName === 'night' ? .5 : .34 });
  for (const [x, z, c] of opts.capsules || []) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(.62, 1.76, 8, 20), kit.surface('hall', c || '#e8e2d6', { gloss: 10, spec: .1 })); m.position.set(x, 1.5, z); m.scale.set(1, 1, .7); m.name = 'capsule'; group.add(m); G.contactBlob([x + ox, z + oz], .8);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(.5, 20, 14), m.material); hd.position.set(x, 3.0 - .35, z); hd.visible = false; group.add(hd); }

  // S1b: contact shadows / AO and floor wear as multiply decals: a dark band along every locker base and skirting, blobs under
  // benches, bins, the fountain, plants, bags and the trophy case; scuffs, stains, footprints and grit in the walking lane
  const atlas = cv(THREE, 1024, 1024, decalAtlas); atlas.colorSpace = THREE.NoColorSpace;
  const D = [], up = [0, 1, 0];
  for (let z = 9.4; z > -37.6; z -= 1.6) for (const s of [-1, 1]) {
    const inDoor = (s > 0 && (Math.abs(z + 6) < 1.1)) || (s < 0 && Math.abs(z + 31) < 1.1) || (s < 0 && Math.abs(z - .8 + 7.3) < 1.0);   // + ryan_locker gap
    if (!inDoor) D.push({ cell: 1, pos: [s * 2.36, .004, z - .8], normal: up, spin: s > 0 ? 0 : Math.PI, size: [.62, 1.75], alpha: .8 });
  }
  for (const x of [-3, -1, 1, 3]) D.push({ cell: 1, pos: [x * 1.05, .004, -37.7], normal: up, spin: -Math.PI / 2, size: [.5, 2.2], alpha: .6 });
  const blob = (x, z, w, d, a = .75) => D.push({ cell: 0, pos: [x, .005, z], normal: up, size: [w, d], alpha: a });
  blob(-2.5, -20, 1.4, 3.6); blob(2.35, -19.5, 1.4, 3.6); blob(-2.9, -11.5, 1.5, 1.8, .6); blob(3.15, -36, 1.3, 2.8, .7);
  blob(2.6, -7.35, 1.2, 1.2); blob(-2.35, -12.65, 1.2, 1.2); blob(2.65, -25.65, 1.2, 1.2); blob(-2.3, 6.9, 1.0, 1.7); blob(-2.3, -27.5, 1.0, 1.0);
  blob(2.25, -22.7, .95, .95); blob(-2.15, -28.3, .8, .8, .6); blob(-2.4, -29.75, 1.2, 1.2); blob(-2.25, -26.75, .9, .9); blob(2.25, 8.7, 1.0, 1.0);
  blob(2.6, -37.1, 1.0, 1.0); blob(-2.7, -37.0, 1.0, 1.0); blob(1.6, -24, 1.0, .8, .45);
  for (const [x, z] of [[2.35, -1], [2.25, -1.7], [-2.3, -29], [2.3, -21]]) blob(x, z, 1.0, 1.1, .6);   // WP-K2: (-2.35, -8.2) bag left out (ryan_locker strip)
  const R = rng(77);
  for (let k = 0; k < 26; k++) D.push({ cell: [3, 5, 3, 5, 3][k % 5], pos: [(R() - .5) * 3.4, .006, 9 - R() * 46], normal: up, spin: R() * 6.28, size: [.9 + R() * 1.2, .9 + R() * 1.2], alpha: .12 + R() * .12 });
  for (let k = 0; k < 12; k++) { const s = R() < .5 ? -1 : 1; D.push({ cell: 2, pos: [s * 2.61, .45 + R() * .4, 9 - R() * 46], normal: [-s, 0, 0], spin: R() * 6.28, size: [.6, .4], alpha: .35 }); }
  kit.decals('hall', D, atlas, { grid: 4 });

  const stats = { prims: 0, mats: 0 }; let gapCut = false;
  const ready = (async () => {
    const glb = await readGlb(THREE, new URL('set.glb', ASSETS).href);
    if (!glb) { console.log('rbx hallway: set.glb missing'); return stats; }
    for (const root of glb.roots) for (const p of root.prims) { const key = (p.material || root.name).split('.')[0];
      // WP-K night: nothing below y 5.2 over the lane (the beast is 4.5 D tall). Pennants squash up toward the ceiling, the EXIT sign
      // rises into it (bottom 5.22). Day looks keep the glb as built.
      const lift = lookName === 'night' && (/^pen_|^string$/.test(key) ? 'squash' : /^(exit_box|sign_exit)$/.test(key) ? 'raise' : null);
      let geo = p.geometry; if (lift) { geo = geo.clone(); geo.applyMatrix4(root.matrix); const P = geo.attributes.position;
        for (let i = 0; i < P.count; i++) P.setY(i, lift === 'raise' ? P.getY(i) + .62 : 5.6 - (5.6 - P.getY(i)) * .32); P.needsUpdate = true; geo.computeBoundingSphere(); }
      // WP-K2: ryan_locker's gap (rbx_monster ENV_CONTRACT): the two left lockers at z -6.52 .. -8.08 (+ handles, stickers, vents) and the
      // bag / book in front of them are left out, the run's skirting is cut there; the plaster wall at x -3.6 shows behind. Every look.
      if (!lift && GAP.keys.test(key)) { const w = p.geometry.clone(); w.applyMatrix4(root.matrix);
        const r = dropParts(THREE, w, b => { const cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2;
          if (key === 'skirting') return b[3] < -2 && b[0] > -3.58 && b[2] < -9 && b[2] > -10 && b[5] > 0 && b[5] < 1;
          return /^(bag|book|paper)/.test(key) ? cx > -2.8 && cx < -1.3 && cz > -9.2 && cz < -6 && b[4] < 1.2 : cx < -2 && cx > -3.6 && cz < -6.55 && cz > -8.05 && b[4] < 4; });
        if (r.dropped) { geo = r.geometry; gapCut = true;
          if (key === 'skirting') for (const [z0, z1] of [[.51, -6.52], [-8.08, -9.65]]) { const sk = new THREE.Mesh(new THREE.BoxGeometry(.92, .3, z0 - z1), matOf(key)); sk.position.set(-3.1, .15, (z0 + z1) / 2); sk.name = 'set.skirting'; group.add(sk); }
          const o = new THREE.Mesh(geo, matOf(key, p.color)); o.name = 'set.' + key; o.frustumCulled = false; group.add(o); stats.prims++; if (!/^locker/.test(key)) G.auto(o, key, { floorY: 0 }); continue; } }
      const o = new THREE.Mesh(geo, matOf(key, p.color)); if (!lift) o.applyMatrix4(root.matrix); o.name = 'set.' + key; o.frustumCulled = false; group.add(o); stats.prims++;
      if (!/^locker/.test(key)) G.auto(o, key, { floorY: 0 }); }
    stats.blobs = G.flush(); stats.mats = Object.keys(mats).length; stats.dress = await DR.finish(PRESETS.hallway()); return stats;
  })();

  function update(t) { rig.update(t); kit.update(t); }
  update(0);
  const layout = { marks: { hall_mid: [0, -4], by_lockers_r: [2.0, -3], by_lockers_l: [-2.0, -6], fountain: [-2.2, -11.5], window: [-1.8, -19], library: [0, -34.5], board: [-1.9, 2.5], door_r1: [2, -6], door_r2: [2, -27], door_l: [-2, -31] } };
  const marks = Object.fromEntries(Object.entries(layout.marks).map(([k, [x, z]]) => [k, [x + ox, z + oz]])); Object.assign(DM, marks);
  const look = opts.post ? createPost(THREE, rig, opts.post) : undefined;
  return { name: 'rbx_hallway', group, lightDir, skyColor: L.fog.color, marks, points: { library: [ox, 4.2, oz - 38] }, bounds: { x: [-3.6 + ox, 3.6 + ox], z: [-38 + oz, 10 + oz] }, casters: [], uniforms: SH, update, ready, rig, look, lookName, contactBlob: G.contactBlob };
}
export default { buildHallway };
