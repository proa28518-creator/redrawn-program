// world/s4_env.js: the `s4_env` set, pass 3 of the S-4 short (s4/ENV_BRIEF.md). The same places, coordinates, marks and animation as world/s4.js, in a world that says "these men are really trapped down there".
// Geometry from Blender (world/assets/s4/*.glb, scatter.json), textures, decals and sprites from Flow (world/assets/s4/tex/), each falling back to the previz until it lands.
// Light: PLACES below is the whole lighting of the film, as data. world/look/lights.js turns it into uniforms, world/look/rigkit.js's shaders read them. Add a set = write its own PLACES.
// No baked light, no haze, no depth of field, no bloom, no particles of its own, characters untouched: those are later passes. Everything is pure in t.
import { createLightRig } from './look/lights.js';
import { createKit, loadSpriteDefs } from './look/rigkit.js';
import { readGlb } from './look/glb.js';
import { createPost } from './look/post.js';
import { createRigShade } from './look/rigshade.js';

const hex = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
export const ZONES = { SEA: [400, 0], BOAT: [400, -400], STORM: [400, 400], BED: [-400, 0] };
const [SX, SZ] = ZONES.SEA, [BX, BZ] = ZONES.BOAT, [TX, TZ] = ZONES.STORM, [UX, UZ] = ZONES.BED;
const ASSETS = new URL('./assets/s4/', import.meta.url);
const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const LP = [0.9, 4.15, 1.4], LAMP_CORD = 1.5;   // the lamp, as in world/s4.js

// ---- the lights of every place. Colours are linear. `drive` and `move` name functions of t below (lamp timing = world/s4.js)
const SUN_SEA = norm([-.62, .34, -.5]), SUN_DAWN = norm([.3, .13, 1]);
const PLACES = {
  torpedo: { sky: [.012, .016, .022], ground: [.008, .007, .006], fog: { color: '#030405', density: .028 }, ao: { floor: 0, h: 1.3, amt: .55 },
    lights: [
      { id: 'lamp', kind: 'point', pos: LP, move: 'lampPos', color: [1.0, .6, .26], power: 4.2, fall: .13, range: 30, wrap: .06, drive: 'lamp', gobo: { kind: 'cage', bars: 8, rings: 7, depth: .8 } },
      { id: 'tubes', kind: 'point', pos: [-2.6, 3.72, -3.5], color: [.95, .52, .22], power: .55, fall: .22, range: 12, wrap: .1, drive: 'lampFar' },       // a second, weaker bulb at the tube doors
      { id: 'aft', kind: 'point', pos: [3.0, 3.9, 7], color: [.28, .4, .62], power: .34, fall: .05, range: 22, wrap: .35, drive: 'lampCold' },            // cold bounce from the aft: keeps the shapes when the lamp dips
      { id: 'floor', kind: 'point', pos: [.8, .25, 2.2], color: [.8, .46, .2], power: .16, fall: .2, range: 9, wrap: .5, drive: 'lamp' } ] },              // the lamp's bounce off the wet deck: lights the undersides of pipes and racks
  sea: { sky: [.46, .54, .64], ground: [.15, .2, .24], fog: { color: '#a7b4bd', density: .0035 },
    lights: [ { id: 'sun', kind: 'sun', dir: SUN_SEA, color: [1.0, 1.0, .98], power: .95, wrap: .25 } ] },
  boat: { sky: [.46, .54, .64], ground: [.16, .2, .23], fog: { color: '#a7b4bd', density: .006 },
    lights: [ { id: 'sun', kind: 'sun', dir: SUN_SEA, color: [1.0, 1.0, .98], power: .95, wrap: .25 } ] },
  storm: { sky: [.075, .1, .14], ground: [.025, .035, .05], fog: { color: '#27303a', density: .012 },
    lights: [
      { id: 'work', kind: 'spot', pos: [TX + 2, 8.5, TZ + 3], dir: [.22, -1, -.05], cone: [34, 72], color: [1, .78, .46], power: 2.6, fall: .035, range: 30, wrap: .1 },   // the deck lamp, swinging in the wind
      { id: 'flash', kind: 'sun', dir: norm([.35, .6, 1]), color: [.72, .82, 1], power: 1, wrap: .3, drive: 'lightning' },
      { id: 'dawn', kind: 'sun', dir: SUN_DAWN, color: [1.0, .72, .42], power: 0, wrap: .3 } ],
    states: [ { from: 'calm', sky: [.62, .55, .5], ground: [.3, .22, .16], fog: { color: '#eed4ae', density: .004 }, lights: { work: { power: 0 }, flash: { power: 0 }, dawn: { power: 1.15 } } } ] },
  bed: { sky: [.035, .115, .125], ground: [.012, .042, .045], fog: { color: '#082a33', density: .036 }, ao: { floor: 0, h: 2.2, amt: .4 },
    lights: [
      { id: 'surface', kind: 'sun', dir: norm([.28, 1, .22]), color: [.36, .72, .68], power: .85, wrap: .22, gobo: { kind: 'caustic', scale: .42, speed: .55, depth: .78 } },    // what is left of the day, through 30 m of water
      { id: 'pool', kind: 'spot', pos: [UX + 3, 30, UZ + 2], dir: [-.12, -1, -.06], cone: [12, 34], color: [.42, .82, .78], power: 2.1, fall: .0012, range: 80, wrap: .2 },    // a pool of it on the action
      { id: 'side', kind: 'sun', dir: norm([1, .35, .55]), color: [.2, .42, .42], power: .55, wrap: .3 } ] },     // the open water's glow on the wreck's side: rivets and rust read, she is still a shape in the murk
};
PLACES.storm.states[0].from = null;   // set from the film's anim.calm

// ---- how each surface answers light. Flow's textures: world/assets/s4/README.md (tile = D per repeat). uv 4 = Blender's mesh UVs, the previz uses world projections
const FINISH = {
  plate:   { file: 'plate_riveted.jpg', tile: 4, color: '#a7aaa0', bump: .06, gloss: 46, spec: .55, wet: .85, grime: .55 },    // torpedo room: oily painted plate
  door:    { file: 'plate_riveted.jpg', tile: 4, color: '#8e9490', bump: .06, gloss: 46, spec: .6, wet: .8, grime: .5 },
  deckT:   { file: 'deck_steel.jpg', tile: 2, color: '#8c8a84', bump: .09, gloss: 60, spec: 1.1, wet: 1, grime: .55 },       // the wet deck: where the lamp shows as a smear on the floor
  wreck:   { file: 'hull_riveted.jpg', tile: 4, color: '#a9b4ae', bump: .05, gloss: 22, spec: .16, wet: .6, grime: .55 },
  wreckB:  { file: 'hull_wreck.jpg', tile: 4, color: '#a9b4ae', bump: .05, gloss: 22, spec: .16, wet: .6, grime: .55 },
  spar:    { file: 'hull_wreck.jpg', tile: 4, color: '#8c9690', bump: .04, gloss: 18, spec: .1, wet: .4, grime: .5 },
  sand:    { file: 'sand.jpg', tile: 12, color: '#b4b8a0', bump: .1, grime: .35 },
  rock:    { file: 'rock.jpg', tile: 4, color: '#8f9a8e', bump: .08, grime: .4 },
  ship:    { file: 'ship_paint.jpg', tile: 4, color: '#59616a', bump: .025, gloss: 26, spec: .22, wet: .5, grime: .16 },
  white:   { file: 'ship_paint.jpg', tile: 4, color: '#d8d6cc', bump: .02, gloss: 22, spec: .16, wet: .4, grime: .12 },
  wood:    { file: 'deck_wood.jpg', tile: 4, color: '#a8a096', bump: .06, gloss: 30, spec: .35, wet: .8, grime: .4 },
  steel:   { file: 'steel_paint.jpg', tile: 3, color: '#8b9493', bump: .02, gloss: 40, spec: .5, wet: .6, grime: .3 },
  // Blender's material names (blender/build_s4.py MATS), those not above
  iron:    { color: '#3a3836', gloss: 40, spec: .5, wet: .6, grime: .3 },
  copper:  { file: 'steel_paint.jpg', tile: 3, color: '#b07a45', gloss: 62, spec: .95, wet: .4, grime: .35 },
  pipeS:   { file: 'steel_paint.jpg', tile: 3, color: '#7d8a80', gloss: 52, spec: .7, wet: .5, grime: .35 },
  torpedo: { file: 'steel_paint.jpg', tile: 3, color: '#8a9786', gloss: 74, spec: 1.1, wet: .6, grime: .3 },
  canvas:  { color: '#877f69', grime: .4 },
  crate:   { color: '#6d4f2e', gloss: 10, spec: .08, grime: .4 },
  glass:   { color: '#ffd9a0', gloss: 90, spec: 1, emit: 1 },
  dark:    { color: '#141416', gloss: 30, spec: .2 },
  rope:    { color: '#8c7a55', grime: .3 },
  label:   { color: '#a07f4c', grime: .3 },
  void:    { color: '#020203' },
  plain:   { color: '#ffffff', gloss: 30, spec: .3, wet: .5 },
  black:   { color: '#26292e', gloss: 30, spec: .25 },
  brass:   { color: '#c79a3e', gloss: 70, spec: 1.2, wet: .3, grime: .2 },
  red:     { color: '#a03328', gloss: 40, spec: .5, wet: .3 },
};

// ---- the cut-outs, per place, in place coordinates. Cameras in the room stay near x -3.5..1 at z 8-14 looking -z, so the side walls and the far corners read; the lane x -2..3, z -3.5..4 stays empty
const hangY = 5.05, S4_FLOOR = { tint: [1, .96, .9], desat: .25 };
const SPRITES = [
  ['torpedo', [0, 0], [
    // the frames are narrow (x about -3..2.5 at the back wall), so things have to stand in that strip, in the gaps between the men, low enough that no head ends on them
    { name: 'oil_drum', x: 2.75, z: -4.5 }, { name: 'sea_chest', x: -.75, z: -4.6 }, { name: 'valve_heap', x: -2.2, z: -4.7 }, { name: 'rag_bucket', x: 1.55, z: -2.6, s: .9 }, { name: 'hose_coil', x: -2.55, z: 2.9 }, { name: 'rag_bucket', x: .75, z: 4.9, s: .6 }, { name: 'valve_heap', x: 1, z: 5.2, s: .8 },
    { name: 'hammock_roll', x: -4.4, z: 6.4 }, { name: 'oil_drum', x: -3.95, z: -3.8 }, { name: 'sea_chest', x: 4.5, z: 10.5 }, { name: 'hose_coil', x: -4.3, z: 12 },
    { name: 'oilskin_coat', x: -2.35, y: 4.9, z: -3.3, maxH: 1.5 }, { name: 'tin_mugs', x: -.65, y: 5.05, z: -4, maxH: 1 }, { name: 'loose_wire', x: 1.7, y: 5.05, z: -3.2, maxH: 1.4 }, { name: 'hook_chain', x: 2.6, y: 4.8, z: -1.2, maxH: 1.3 },
    { name: 'cable_bundle', x: -3.7, y: 4.6, z: 2.4 }, { name: 'wet_rag', x: 2.9, y: hangY, z: 4.4 }, { name: 'oilskin_coat', x: 3.3, y: hangY, z: 8.6 }, { name: 'hook_chain', x: -3.1, y: hangY, z: 8.4 }, { name: 'loose_wire', x: -2.6, y: hangY, z: 11.2 }, { name: 'tin_mugs', x: 2.3, y: hangY, z: 12.3 } ], S4_FLOOR],
  ['bed', [UX, UZ], [
    { name: 'kelp_tall', x: 3.4, z: -3 }, { name: 'kelp_clump', x: 2.2, z: -1.2 }, { name: 'mussel_rock', x: 1.5, z: -.2 }, { name: 'weed_tuft', x: .9, z: 3.4 }, { name: 'bent_plate', x: -1, z: 6.2 }, { name: 'fish_skeleton', x: 1.4, z: 7 }, { name: 'sunk_bottle', x: 2.1, z: 5.2 },
    { name: 'kelp_tall', x: 7.2, z: -5.5, s: 1.2 }, { name: 'half_anchor', x: 6, z: -11.5 }, { name: 'torn_net', x: -.4, z: -12.6 }, { name: 'broken_spar', x: 3.4, z: -12.5 }, { name: 'twisted_pipe', x: 5.2, z: -6.6 }, { name: 'anemone_rock', x: 3.8, z: -7.8 }, { name: 'weed_tuft', x: 2.2, z: -6.2 }, { name: 'kelp_clump', x: -.7, z: -5.2 },
    { name: 'kelp_tall', x: 10.4, z: -7 }, { name: 'kelp_clump', x: 15.6, z: -6.8 }, { name: 'anemone_rock', x: 10.2, z: .4 }, { name: 'weed_tuft', x: 14.3, z: 3.4 }, { name: 'kelp_tall', x: 20.5, z: -9.8, s: 1.2 }, { name: 'kelp_clump', x: 15.3, z: -9 }, { name: 'mussel_rock', x: 16, z: -6.6 }, { name: 'fish_skeleton', x: 20, z: -3.8 } ], { tint: [.72, .8, .78], desat: .35 }],
  ['storm', [TX, TZ], [
    { name: 'air_pump', x: 11.4, z: 3.1 }, { name: 'rope_coil', x: 6.1, z: 3.2 }, { name: 'air_hose_coil', x: 10.6, z: 3.6, s: .9 }, { name: 'dive_helmet', x: 5.3, z: 2.6 }, { name: 'life_ring', x: 12.8, y: .1, z: 3.5 }, { name: 'rope_coil', x: 10.8, z: -3.8 }, { name: 'block_tackle', x: 6.5, y: 5.2, z: 1.2 } ], { tint: [.8, .8, .82], desat: .2 }],
  ['sea', [SX, SZ], [ { name: 'rope_coil', x: 1.2, z: 3.1 }, { name: 'life_ring', x: 5.2, y: .1, z: 3.5 }, { name: 'rope_coil', x: 7.4, z: 3.4, s: .8 } ], { tint: [.85, .85, .85], desat: .15 }],
  ['boat', [BX, BZ], [ { name: 'barrel', x: .55, z: -.9 }, { name: 'crate_stack', x: -2.95, z: -1.2 }, { name: 'tarp_heap', x: 3.1, z: .9 }, { name: 'crate_bottles', x: .45, z: 2.2 }, { name: 'whiskey_bottle', x: -.2, z: 3.1 }, { name: 'whiskey_crate', x: -2.35, z: 1.8 }, { name: 'barrel', x: -5.2, z: -.4, s: .9 } ], { tint: [.86, .85, .84], desat: .1 }],
];

// ---- canvas textures, the previz's, used until Flow's land
function canvasTex(THREE, size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace; return t; }
const rng = s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
function noise(g, S, n, a, r0, r1, seed, cols = ['#000', '#fff']) { const R = rng(seed); for (let i = 0; i < n; i++) { g.globalAlpha = a * R(); g.fillStyle = cols[Math.floor(R() * cols.length)]; const r = r0 + R() * (r1 - r0); g.beginPath(); g.ellipse(R() * S, R() * S, r, r * (.4 + R()), R() * 3, 0, 7); g.fill(); } g.globalAlpha = 1; }
const steelC = g => { const S = 512; g.fillStyle = '#d9dcdf'; g.fillRect(0, 0, S, S); noise(g, S, 900, .05, 2, 26, 3); noise(g, S, 40, .28, 5, 34, 9, ['#7a4a26', '#5a3a22']); g.strokeStyle = 'rgba(20,20,24,.75)'; g.lineWidth = 5; g.strokeRect(0, 0, S, S); g.beginPath(); g.moveTo(0, S / 2); g.lineTo(S, S / 2); g.stroke();
  g.fillStyle = 'rgba(16,16,20,.85)'; for (let i = 0; i < 16; i++) for (const y of [14, S / 2 - 14, S / 2 + 14, S - 14]) { g.beginPath(); g.arc((i + .5) * S / 16, y, 5, 0, 7); g.fill(); } };
const deckC = g => { const S = 512; g.fillStyle = '#c6c7c6'; g.fillRect(0, 0, S, S); noise(g, S, 800, .06, 2, 22, 5); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 4; g.strokeRect(0, 0, S, S); g.fillStyle = 'rgba(0,0,0,.3)'; for (let i = 0; i < 26; i++) for (let j = 0; j < 26; j++) { g.save(); g.translate((i + .5) * S / 26, (j + .5) * S / 26); g.rotate((i + j) % 2 ? .7 : -.7); g.fillRect(-7, -1.6, 14, 3.2); g.restore(); } };
const sandC = g => { const S = 512; g.fillStyle = '#dcd8c6'; g.fillRect(0, 0, S, S); noise(g, S, 3000, .07, 1, 8, 7); noise(g, S, 60, .1, 20, 70, 8); g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 3; for (let y = 10; y < S; y += 42) { g.beginPath(); for (let x = 0; x <= S; x += 16) g.lineTo(x, y + 8 * Math.sin(x * Math.PI * 2 / S * 3 + y)); g.stroke(); } };
const wavesC = g => { const S = 512; g.fillStyle = '#c8d0d4'; g.fillRect(0, 0, S, S); noise(g, S, 500, .12, 8, 40, 11, ['#ffffff', '#6d7f8c']); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3; for (let y = 8; y < S; y += 32) { g.beginPath(); for (let x = 0; x <= S; x += 12) g.lineTo(x, y + 6 * Math.sin(x * Math.PI * 2 / S * 4 + y * .3) + 2 * Math.sin(x * Math.PI * 2 / S * 11)); g.stroke(); } };

export function buildS4Env(THREE, scene, opts = {}) {
  const group = new THREE.Group(); group.name = 'set.s4_env'; scene.add(group);
  const A = opts.anim || {};
  const lightDir = [.15, 1, .25].map(v => v / Math.hypot(.15, 1, .25));     // the character shadow pass: same as world/s4.js, characters and their shadows do not change
  const SH = { uShadowMap: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() }, uShadowOn: { value: 0 }, uShadowTexel: { value: 1 / 2048 }, uShadowSoft: { value: 1.4 }, uShadowBias: { value: .0006 }, uSunDir: { value: new THREE.Vector3(...lightDir) } };
  const smooth = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const R1 = (k, s = 1) => { const h = Math.sin(k * 12.9898 + s * 78.233) * 43758.5453; return h - Math.floor(h); };

  // ---- what drives the lights: pure in t
  const lampKeys = A.lamp || [[0, 1]];
  const lampBase = t => { let v = lampKeys[0][1]; for (let i = 0; i < lampKeys.length - 1; i++) { const [a, x] = lampKeys[i], [b, y] = lampKeys[i + 1]; if (t >= a && t <= b) v = x + (y - x) * (t - a) / Math.max(.001, b - a); } if (t > lampKeys[lampKeys.length - 1][0]) v = lampKeys[lampKeys.length - 1][1]; return v; };
  const lampI = t => { const base = lampBase(t), hb = Math.floor(t * 14), fl = (Math.sin(hb * 91.7) * 43758.5) % 1, hitD = A.jolt != null && t > A.jolt && t < A.jolt + 1.0 ? (Math.floor(t * 20) % 2 ? .15 : 1) : 1; return base * (Math.abs(fl) < .07 * (1.4 - base) ? .55 : 1) * hitD; };   // world/s4.js's lamp, unchanged
  // the swing: a pendulum kicked by the jolt and the landing, and the slow list of a boat on the bottom. Only where the light comes from moves, never how bright
  const lampSwing = t => { let a = .03 * Math.sin(t * .85) + .018 * Math.sin(t * 1.9 + 1); for (const [h, k] of [[A.jolt, .4], [A.land, .34]]) if (h != null && t > h) { const d = t - h; a += k * Math.exp(-d * .55) * Math.sin(d * 3.1); } return a; };
  const lampPos = t => { const a = lampSwing(t), b = a * .45; return [LP[0] + Math.sin(a) * LAMP_CORD, LP[1] + LAMP_CORD - Math.cos(a) * Math.cos(b) * LAMP_CORD, LP[2] + Math.sin(b) * LAMP_CORD]; };
  // lightning behind the storm: on the hit, and pure in t after it. Two quick strokes, a slow fade
  const STRIKES = [A.storm ?? 19.46, 20.62, 30.98].filter(v => v != null);
  const lightning = t => { let v = 0; for (const s of STRIKES) { const d = t - s; if (d < 0 || d > .7) continue; v = Math.max(v, Math.exp(-d * 7) * (d < .05 || (d > .1 && d < .16) ? 1.25 : .55)); } return v; };
  const drivers = { lamp: lampI, lampFar: t => Math.max(0, lampBase(t) - .15) * 1.2, lampCold: lampBase, lampPos, lightning };
  if (A.calm == null) delete PLACES.storm.states; else PLACES.storm.states[0].from = A.calm;
  const rig = createLightRig(THREE, PLACES, drivers);
  const kit = createKit(THREE, rig, { shadow: SH, group });

  const canvas = { 'plate_riveted.jpg': canvasTex(THREE, 512, steelC), 'hull_riveted.jpg': null, 'hull_wreck.jpg': null, 'deck_steel.jpg': canvasTex(THREE, 512, deckC), 'deck_wood.jpg': null, 'sand.jpg': canvasTex(THREE, 512, sandC), 'sea.jpg': canvasTex(THREE, 512, wavesC) };
  canvas['hull_riveted.jpg'] = canvas['hull_wreck.jpg'] = canvas['plate_riveted.jpg']; canvas['deck_wood.jpg'] = canvas['deck_steel.jpg'];
  const allMats = [];
  // mat(place, finish name, { color, uv, tile, ...overrides }): remembers its finish, so Flow's picture and Blender's UVs can replace the previz's when they land
  const mat = (place, f, o = {}) => { const F = { ...FINISH[f], ...o }, previzTile = o.tile, map = F.file && F.uv !== 4 ? canvas[F.file] : null;
    const m = kit.surface(place, F.color, { map, uv: F.uv ?? 1, tile: Array.isArray(previzTile) ? previzTile : [F.tile ?? 4, F.tile ?? 4], bump: F.bump, gloss: F.gloss, spec: F.spec, wet: F.wet, grime: F.grime, emit: F.emit, ao: F.ao, near: F.near }); allMats.push({ m, F }); return m; };
  const add = (geo, m, x, y, z, parent = group, rot) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if (rot) o.rotation.set(...rot); parent.add(o); return o; };
  const box = (w, h, d, m, x, y0, z, parent, rot) => add(new THREE.BoxGeometry(w, h, d), m, x, y0 + h / 2, z, parent, rot);
  const cylZ = (r, len, m, x, y, z, parent) => add(new THREE.CylinderGeometry(r, r, len, 20), m, x, y, z, parent, [Math.PI / 2, 0, 0]);
  const disc = (color, op = 1, add_ = false) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, blending: add_ ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide, toneMapped: false });
  const previz = { torpedo: new THREE.Group(), seabed: new THREE.Group(), sea: new THREE.Group(), storm: new THREE.Group(), boat: new THREE.Group() };
  for (const [k, g] of Object.entries(previz)) { g.name = 'previz.' + k; group.add(g); }

  // ---- pass-1 particles, unchanged: spray, bubbles, dust. fn(i, t) -> [x, y, z, scale]
  const clouds = [];
  const cloud = (n, color, op, fn, r = .12) => { if (opts.post) return null;   /* setOpts.post: post's particles replace these */ const m = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 8, 6), disc(color, op), n); m.frustumCulled = false; const c = new THREE.Color(); for (let i = 0; i < n; i++) { const v = .7 + .3 * R1(i, 77); m.setColorAt(i, c.setRGB(v, v, v)); } group.add(m); clouds.push({ m, n, fn }); return m; };
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q = new THREE.Quaternion(), _S = new THREE.Vector3();

  // ======================================================== TORPEDO ROOM (0, 0)
  const T = previz.torpedo;
  const HULL = mat('torpedo', 'plate', { uv: 2 }), DECK = mat('torpedo', 'deckT', { uv: 1 }), RIB = mat('torpedo', 'plain', { color: '#4a5154' }), PIPE = mat('torpedo', 'plain', { color: '#9a7a4a', gloss: 50, spec: .7 }), PIPE2 = mat('torpedo', 'plain', { color: '#6d7a70', gloss: 50, spec: .6 }), BRASS = mat('torpedo', 'brass'), DOOR = mat('torpedo', 'door', { uv: 3 }), TORP = mat('torpedo', 'plain', { color: '#7a8878', gloss: 60, spec: .8 }), CRATE = mat('torpedo', 'plain', { color: '#7a5a38', gloss: 0, spec: 0 }), RED = mat('torpedo', 'red');
  { const m = new THREE.Mesh(new THREE.SphereGeometry(90, 16, 10), new THREE.MeshBasicMaterial({ color: '#030405', side: THREE.BackSide })); m.renderOrder = -10; group.add(m); }
  box(14, .2, 26, DECK, 0, -.2, 4, T);
  add(new THREE.CylinderGeometry(5.6, 5.6, 26, 40, 1, true, -Math.PI * .85, Math.PI * 1.7), HULL, 0, 2.4, 4, T, [Math.PI / 2, 0, 0]);
  for (let z = -5; z < 16; z += 2.6) add(new THREE.TorusGeometry(5.42, .13, 8, 40), RIB, 0, 2.4, z, T);
  box(12, 8.4, .3, DOOR, 0, -.2, -6.1, T);
  for (const [x, y] of [[-1.5, 1.55], [1.5, 1.55], [-1.5, 3.95], [1.5, 3.95]]) { cylZ(1.02, .35, DOOR, x, y, -5.85, T); add(new THREE.TorusGeometry(1.02, .1, 10, 36), BRASS, x, y, -5.66, T); add(new THREE.TorusGeometry(.34, .05, 8, 24), RED, x, y, -5.55, T); box(.12, .85, .08, RED, x, y - .425, -5.55, T); box(.85, .12, .08, RED, x - .425, y - .06, -5.55, T); }
  for (const [x, y, r, m] of [[-2.4, 4.9, .16, PIPE], [-1.7, 5.15, .1, PIPE2], [1.6, 5.2, .13, PIPE2], [2.6, 4.75, .18, PIPE], [-3.9, 3.9, .12, PIPE2], [4.1, 3.7, .1, PIPE]]) cylZ(r, 26, m, x, y, 4, T);
  add(new THREE.CylinderGeometry(.17, .17, 5.6, 16), PIPE, -2.05, 2.8, .95, T); add(new THREE.CylinderGeometry(.12, .12, 5.6, 12), PIPE2, 1.25, 2.8, -2.7, T); add(new THREE.CylinderGeometry(.12, .12, 5.6, 12), PIPE, -3.85, 2.8, -1.8, T);
  add(new THREE.CylinderGeometry(.24, .24, .16, 16), BRASS, -2.05, 1.2, .95, T); add(new THREE.CylinderGeometry(.24, .24, .16, 16), BRASS, -2.05, 3.0, .95, T);
  cylZ(.62, 11, TORP, 3.5, 1.1, 1.2, T); add(new THREE.SphereGeometry(.62, 20, 12), BRASS, 3.5, 1.1, 6.7, T); box(1.5, .5, .4, RIB, 3.5, 0, -2, T); box(1.5, .5, .4, RIB, 3.5, 0, 4, T);
  box(1.0, .55, .9, CRATE, -1.1, 0, .95, T); box(1.0, .55, .9, CRATE, 1.55, 0, .3, T); box(1.1, .55, .9, CRATE, -2.8, 0, -1.8, T); box(1.1, 1.1, .9, CRATE, -3.6, 0, 3.2, T);
  if (A.cam) box(14, 10, .3, DOOR, 0, -2, 16.1, T);                              // the wall the camera flies through (world/s4.js)

  // the lamp: it hangs, it swings, its cage shadow crawls over the steel. Pass 1's bulb and halo, on a soft edge
  const lampG = new THREE.Group(); group.add(lampG);
  const bulbM = disc('#ffd9a0'), haloT = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t; })();
  const haloM = disc('#ffb060', .35, true); haloM.map = haloT;
  add(new THREE.SphereGeometry(.17, 12, 10), bulbM, 0, -LAMP_CORD, 0, lampG); add(new THREE.CircleGeometry(1.6, 24), haloM, 0, -LAMP_CORD, .02, lampG);
  const CAGE = mat('torpedo', 'plain', { color: '#2c2a26', gloss: 50, spec: .6 }); add(new THREE.CylinderGeometry(.015, .015, LAMP_CORD - .25, 6), CAGE, 0, -LAMP_CORD / 2 + .12, 0, lampG);
  for (const dy of [-.17, 0, .17]) add(new THREE.TorusGeometry(dy ? .17 : .23, .014, 6, 18), CAGE, 0, -LAMP_CORD + dy, 0, lampG, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; add(new THREE.CylinderGeometry(.011, .011, .44, 5), CAGE, Math.sin(a) * .2, -LAMP_CORD, Math.cos(a) * .2, lampG); }
  lampG.position.set(LP[0], LP[1] + LAMP_CORD, LP[2]);
  const hits = [A.jolt, A.land].filter(v => v != null);
  cloud(80, '#b8b0a0', .5, (i, t) => { let best = null; for (const h of hits) if (t >= h && t < h + 1.6) best = h; if (best == null) return null; const d = t - best;
    const x = -4 + 8 * R1(i, 1), z = -3 + 7 * R1(i, 2), y = 5.2 - .5 * 9.8 * .45 * d * d - 1.5 * R1(i, 3) * d; return [x, y, z, .35 + .5 * R1(i, 4)]; }, .08);

  // ======================================================== ships: same shape and pivot as world/s4.js, parts in their own group so Blender's can replace them
  const ship = (place, parent, x0, z0, hullC = '#59616a') => { const G = new THREE.Group(); G.position.set(x0, 0, z0); parent.add(G); const HM = mat(place, 'ship', { color: hullC, uv: 3 }), WH = mat(place, 'white', { uv: 3 }), DK = mat(place, 'wood', { uv: 1, color: '#8a8680' }), BK = mat(place, 'black'), RS = mat(place, 'plain', { color: '#b04a30' });
    const s = new THREE.Shape(); s.moveTo(-40, -5); s.lineTo(22, -5); s.quadraticCurveTo(36, -3, 46, 0); s.quadraticCurveTo(36, 3, 22, 5); s.lineTo(-40, 5); s.closePath();
    const hg = new THREE.ExtrudeGeometry(s, { depth: 9, bevelEnabled: false }); hg.rotateX(Math.PI / 2); add(hg, HM, 0, -.02, 0, G);
    const dg = new THREE.ShapeGeometry(s); dg.rotateX(Math.PI / 2); add(dg, DK, 0, 0, 0, G);
    box(90, 1.2, 10.5, RS, -8, -9.6, 0, G);
    box(12, 5.4, 6, WH, 0, 0, -1.6, G); box(10, 3, 5, WH, 0, 5.4, -1.6, G); box(10.6, .3, 5.6, BK, 0, 8.4, -1.6, G);
    for (let i = -2; i <= 2; i++) box(1.1, 1.1, .1, BK, i * 2, 6.2, .95, G);
    add(new THREE.CylinderGeometry(1.1, 1.3, 6, 16), BK, -9, 5.5, -1, G); add(new THREE.CylinderGeometry(.14, .2, 13, 8), BK, 6.5, 6, -1, G);
    for (let x = -36; x < 20; x += 3) box(.09, 1.35, .09, BK, x, 0, 4.8, G); box(56, .07, .07, BK, -8, 1.3, 4.8, G); box(56, .07, .07, BK, -8, .75, 4.8, G);
    return G; };
  // the submarine (own frame: long axis Z, nose -Z, centre y 0). `parts` so Blender's hull can replace the previz's and keep this group's animation
  const sub = (place, color = '#4a5155') => { const G = new THREE.Group(); group.add(G); const parts = new THREE.Group(); G.add(parts); const H = mat(place, 'wreck', { color, uv: 2 }), TW = mat(place, 'wreck', { color: '#3e4448', uv: 2 }), BK = mat(place, 'black', { color: '#1d2024' }), FL = mat(place, 'spar', { color: '#555d62' });
    add(new THREE.CylinderGeometry(6, 6, 56, 32), H, 0, 0, 0, parts, [Math.PI / 2, 0, 0]);
    const cap = zz => { const o = add(new THREE.SphereGeometry(6, 28, 18), H, 0, 0, zz, parts); o.scale.z = 2.6; }; cap(-28); cap(28);
    box(5, .35, 58, FL, 0, 5.6, 0, parts);
    for (let z = -26; z <= 26; z += 2) add(new THREE.CylinderGeometry(.07, .07, 1.5, 6), BK, 2.4, 6.6, z, parts);
    box(4.4, 5.5, 11, TW, 0, 5.8, -2, parts); box(3, 2, 6, TW, 0, 11.3, -2, parts); add(new THREE.CylinderGeometry(.13, .13, 6, 6), BK, 0, 15, -3.2, parts); add(new THREE.CylinderGeometry(.1, .1, 4.5, 6), BK, 0, 14.5, -.8, parts);
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#3e4448'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#ece6d2'; g.font = '900 170px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('S-4', 256, 135);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.NoColorSpace; const lm = kit.surface(place, '#ffffff', { map: tx, uv: 0, grime: .15, emit: 1.1 }); const lb = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), lm); lb.rotation.y = Math.PI / 2; lb.position.set(2.24, 8.5, -2); G.add(lb); const lb2 = lb.clone(); lb2.rotation.y = 0; lb2.scale.set(.72, .72, 1); lb2.position.set(0, 8.5, 3.53); G.add(lb2);
    return { G, parts }; };

  // ======================================================== SEA zone: cold grey day, the cutter, S-4 surfaces at the bow
  const SKY_DAY = { top: '#62778c', hor: '#b4c1c9', low: '#8c9ba5', cloudLit: '#cfd6da', cloudDark: '#6a7784', sun: SUN_SEA, sunColor: [.32, .32, .3], cover: .66, scale: 1.0 };
  kit.sky(SX, SZ, 170, SKY_DAY);
  const waterDay = { deep: [.035, .085, .115], skyTop: [.25, .33, .42], skyHor: [.5, .58, .64], chop: .34, foam: .16 };
  const seaTex = canvas['sea.jpg'], waters = [];
  const W = (place, o, x, y, z) => { const m = kit.water(place, { ...o, map: seaTex }); waters.push(m); return add(new THREE.PlaneGeometry(340, 340), m, x, y, z, group, [-Math.PI / 2, 0, 0]); };
  W('sea', waterDay, SX, -8.2, SZ);
  const cutter = ship('sea', previz.sea, SX, SZ);
  const subSea = sub('sea', '#454c50'), subS = subSea.G; subS.position.set(SX + 52.5, -40, SZ - 2);
  const splashAt = [SX + 47, -4, SZ];
  cloud(240, '#ffffff', .9, (i, t) => { if (A.ram == null || t < A.ram - .03 || t > A.ram + 1.8) return null; const d = t - A.ram + .03, a = R1(i, 1) * 6.28, v = 4 + 14 * R1(i, 2);
    return [splashAt[0] + Math.cos(a) * v * d, splashAt[1] + (8 + 16 * R1(i, 3)) * d - 4.9 * d * d, splashAt[2] + Math.sin(a) * v * d, 1 + 2.6 * R1(i, 4)]; }, .25);
  // ======================================================== BOAT zone
  kit.sky(BX, BZ, 170, SKY_DAY);
  W('boat', waterDay, BX, -1.4, BZ);
  const PB = previz.boat, BH = mat('boat', 'plain', { color: '#6a4a2c', gloss: 20, spec: .2 }), BD = mat('boat', 'wood', { uv: 1, color: '#9a7a50' });
  box(16, 2.2, 6, BH, BX, -2.2, BZ, PB); box(16.2, .1, 6.2, BD, BX, -.08, BZ, PB);
  const ct = document.createElement('canvas'); ct.width = 256; ct.height = 256; { const g = ct.getContext('2d'); g.fillStyle = '#c29a5c'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#5a3e20'; g.lineWidth = 8; g.strokeRect(4, 4, 248, 248); g.beginPath(); g.moveTo(0, 86); g.lineTo(256, 86); g.moveTo(0, 170); g.lineTo(256, 170); g.stroke(); g.fillStyle = '#3a2410'; g.font = '900 50px Arial'; g.textAlign = 'center'; g.fillText('WHISKEY', 128, 145); }
  const ctT = new THREE.CanvasTexture(ct); ctT.colorSpace = THREE.NoColorSpace; const CRW = kit.surface('boat', '#ffffff', { map: ctT, uv: 0, grime: .2 });
  for (const [x, y, z] of [[-2.9, 0, -1.1], [-2.9, 1.15, -1.1], [-1.75, 0, -1.3], [-4.05, 0, -1.2], [-3.3, 0, .2]]) { const o = add(new THREE.BoxGeometry(1.1, 1.1, 1.1), CRW, BX + x, y + .55, BZ + z, PB); o.rotation.y = .1 * x; }
  const cutter2 = ship('boat', group, BX + 8, BZ - 44, '#7c8690');
  // ======================================================== STORM deck: the rescue ship, storm then a clear dawn
  const SKY_STORM = { top: '#12171e', hor: '#2a343e', low: '#1d252d', cloudLit: '#4c5864', cloudDark: '#0e1318', sun: norm([.35, .6, 1]), sunColor: [0, 0, 0], cover: .96, scale: 1.25, mapGain: .46 };
  const SKY_DAWN = { top: '#7b95a7', hor: '#f7d2a0', low: '#e7b98c', cloudLit: '#ffdcae', cloudDark: '#95868c', sun: SUN_DAWN, sunColor: [.62, .4, .18], cover: .48, scale: 1.1 };
  const stormSky = kit.sky(TX, TZ, 170, SKY_STORM);
  const waterStorm = { deep: [.012, .03, .042], skyTop: [.03, .045, .06], skyHor: [.1, .13, .16], chop: .95, foam: .46 }, waterDawn = { deep: [.06, .1, .12], skyTop: [.42, .5, .58], skyHor: [.98, .72, .46], chop: .2, foam: .06 };
  const waterC = W('storm', waterStorm, TX, -7, TZ);
  const rescue = ship('storm', previz.storm, TX - 4, TZ - 1, '#3e4650');
  const swell = []; const swellM = mat('storm', 'plain', { color: '#22333e', gloss: 90, spec: .8, wet: .6 }); for (let i = 0; i < 3; i++) { const o = add(new THREE.CylinderGeometry(9, 26, 16, 24), swellM, TX + 2 + i * 8, -6, TZ + 24 - i * 3); o.scale.z = .35; swell.push(o); }
  const HIT = A.storm;
  cloud(160, '#e8eef2', .9, (i, t) => { if (HIT == null || t < HIT - .05 || t > HIT + 1.8) return null; const d = t - HIT + .05, a = R1(i, 5) * 6.28, v = 3 + 9 * R1(i, 6);
    return [TX + 8 + Math.cos(a) * v * d * 1.4, .6 + (6 + 9 * R1(i, 7)) * d - 4.9 * d * d, TZ + 6 + Math.sin(a) * 2 * d, .8 + 2 * R1(i, 8)]; }, .22);
  cloud(420, '#dfe7ec', .75, (i, t) => { if (t >= (A.calm ?? 99) || t < (A.stormFrom ?? 0)) return null; const sp = 14 + 8 * R1(i, 9), H = 20, y = H - ((R1(i, 10) * H + t * sp) % H) - 2, x = -16 + 32 * R1(i, 11) + (t * 12 * R1(i, 12)) % 6;
    return [TX + 8 + x, y, TZ - 7 + 18 * R1(i, 13), .6 + .5 * R1(i, 14)]; }, .045);

  // ======================================================== SEABED
  const bedDome = kit.sky(UX, UZ, 150, { top: '#1c5a66', hor: '#0b2d36', low: '#072026', sun: [0, 1, 0], sunColor: [.1, .24, .24], cover: 0 });
  const PU = previz.seabed;
  add(new THREE.PlaneGeometry(300, 300), mat('bed', 'sand', { uv: 1 }), UX, -.01, UZ, PU, [-Math.PI / 2, 0, 0]);
  const ROCK = mat('bed', 'rock', { color: '#6a7a6c', uv: 1, file: 'sand.jpg', tile: 6 });
  for (let i = 0; i < 14; i++) { const o = add(new THREE.SphereGeometry(1, 12, 8), ROCK, UX + 2 + 22 * R1(i, 20), -.1, UZ - 16 + 26 * R1(i, 21), PU); o.scale.set(1 + 3 * R1(i, 22), .15 + .5 * R1(i, 23), 1 + 2 * R1(i, 24)); }
  const subBed = sub('bed', '#55645f'), subU = subBed.G;
  const REST = [UX - 7.6, 4.6, UZ - 8];
  const WK = mat('bed', 'spar', { color: '#3b4744', uv: 2 }), spars = new THREE.Group(); PU.add(spars);
  box(.3, 6, .3, WK, UX - 1.5, 0, UZ - 10.4, spars, [0, 0, .5]); box(.25, 5, .25, WK, UX - .4, 0, UZ - 11.4, spars, [.3, 0, .9]); box(3, .22, .22, WK, UX + .6, 2.6, UZ - 11, spars, [0, .4, .35]);
  add(new THREE.TorusGeometry(.8, .05, 6, 20), WK, UX + .9, 2.5, UZ - 10.9, spars, [.2, .5, 0]);
  cloud(180, '#b9b49a', .55, (i, t) => { if (A.land == null || t < A.land - .02 || t > A.land + 1.25) return null; const d = t - A.land + .02, a = R1(i, 30) * 6.28, v = 3 + 7 * R1(i, 31), e = 1 - Math.exp(-d * 1.6);
    return [REST[0] + 5 * Math.cos(a) + Math.cos(a) * v * e, .4 + 3 * R1(i, 32) * e, REST[2] + 22 * (R1(i, 33) - .5) + Math.sin(a) * v * e, 3 + 8 * e * R1(i, 34)]; }, .4);
  cloud(260, '#cfe8e0', .4, (i, t) => { const H = 22; return [UX - 4 + 18 * R1(i, 40) + .3 * Math.sin(t + i), H - (R1(i, 41) * H + t * .22) % H, UZ - 14 + 26 * R1(i, 42), .5 + .7 * R1(i, 43)]; }, .03);
  for (const [bx, bz] of [[12, 3.4], [18, -5.6]]) cloud(70, '#e8fbff', .75, (i, t) => { const H = 26, sp = 7 + 7 * R1(i, 60); return [UX + bx + 6 * (R1(i, 61) - .5) + .25 * Math.sin(t * 2.3 + i), (R1(i, 62) * H + t * sp) % H - 2, UZ + bz + 5 * (R1(i, 63) - .5), .5 + 1.6 * R1(i, 64)]; }, .085);
  cloud(90, '#e8fbff', .7, (i, t) => { const H = 26, sp = 3 + 3 * R1(i, 50), f = (A.descend && ((t > A.descend[0] && t < A.descend[1]) || (t > A.descend[2] && t < A.descend[3]))) ? 3.2 : 1; return [UX - .4 + 5.5 * (R1(i, 51) - .5) + .25 * Math.sin(t * 2.3 + i), (R1(i, 52) * H + t * sp * f) % H, UZ - 1 + 3 * (R1(i, 53) - .5), .4 + 1.3 * R1(i, 54)]; }, .085);

  // the water's surface over the seabed, for the flights (world/s4.js)
  let surf = null, surfWin = [];
  if (A.cam) { const st = canvas['sea.jpg'].clone(); st.needsUpdate = true; st.repeat.set(40, 40);
    surf = add(new THREE.PlaneGeometry(300, 300), new THREE.MeshBasicMaterial({ map: st, color: '#c8f0ee', side: THREE.DoubleSide, toneMapped: false }), UX, A.cam.surfaceY ?? 56, UZ, group, [-Math.PI / 2, 0, 0]); surfWin = A.cam.surface || []; surf.visible = false; }

  // ======================================================== what lands from the other two tracks
  const stats = { glbs: [], tex: 0, decals: 0, sprites: 0, kit: 0 };
  const loader = new THREE.TextureLoader();
  const exists = async u => { try { return (await fetch(u, { method: 'HEAD' })).ok; } catch { return false; } };
  const loadTex = async (file, wrap = true) => { const u = new URL('tex/' + file, ASSETS).href; if (!(await exists(u))) return null; try { const t = await loader.loadAsync(u); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; } catch { return null; } };
  // a place's glb: one mesh per material name, in the place's own coordinates. drop(prim) can take triangles out (the lamp is ours: it has to swing)
  const FROM_GLB = { plate_riveted: 'plate', steel_paint: 'steel', deck_steel: 'deckT', iron: 'iron', pipe_copper: 'copper', pipe_steel: 'pipeS', brass: 'brass', red_paint: 'red', torpedo: 'torpedo', canvas: 'canvas', wood: 'crate', glass: 'glass', hull_wreck: 'wreckB', sand: 'sand', rock: 'rock', ship_paint: 'ship', white_paint: 'white', deck_wood: 'wood', black: 'dark', boot_red: 'red', hull_wood: 'crate', crate_label: 'label', rope: 'rope', void: 'void', hull_riveted: 'wreck', plate: 'plate' };
  const glassMats = { torpedo: [] };
  const fromGlb = async (file, place, x0, z0, previzGroup, parent = group, { over = {}, drop = null, skip = [], hideOld = null } = {}) => { const glb = await readGlb(THREE, new URL(file, ASSETS).href); if (!glb) return false; for (const o of hideOld || []) o.visible = false;
    const mats = {}, G = new THREE.Group(); G.position.set(x0, 0, z0); G.name = 'glb.' + file; parent.add(G);
    for (const root of glb.roots) for (const p of root.prims) { const key = (p.material || root.name).split('.')[0]; if (skip.includes(key)) continue;
      if (drop) drop(p.geometry, key);
      const m = mats[key] || (mats[key] = mat(place, FROM_GLB[key] || 'plain', { uv: 4, ...(over[key] || {}), ...(FROM_GLB[key] ? {} : { color: p.color ? p.color.map(v => Math.pow(v, 1 / 2.2)) : '#808080' }) }));
      const o = new THREE.Mesh(p.geometry, m); o.applyMatrix4(root.matrix); o.name = 'set.' + key; o.frustumCulled = false; G.add(o); if (key === 'glass') glassMats[place]?.push(m); }
    if (previzGroup) previzGroup.visible = false; stats.glbs.push(file); return G; };
  // keep only the triangles away from the failing lamp and its cable: ours swings, Blender's can't
  const notTheLamp = geo => { const a = geo.attributes.position, ix = geo.index; if (!ix) return; const out = [], near = i => { const x = a.getX(i) - LP[0], y = a.getY(i) - LP[1], z = a.getZ(i) - LP[2]; return Math.hypot(x, y, z) < .5 || (Math.hypot(x + (y / 2.03) * .15, z) < .1 && y > 0 && y < 2.1); };
    for (let i = 0; i < ix.count; i += 3) { const A = ix.getX(i), B = ix.getX(i + 1), C = ix.getX(i + 2); if (near(A) && near(B) && near(C)) continue; out.push(A, B, C); } geo.setIndex(out); };
  // Blender's scatter for one place: instanced kit assets + decals. bendOf(surface) -> { center, r, lift } for decals on a cylinder
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
  const fromScatter = (S, kitGlb, decTex, place, parent, bendOf = () => null, gain = 1, shellR = 0) => { if (!S) return; const kmats = place === 'boat' ? { crate_whiskey: CRW } : {}, _v = new THREE.Vector3();
    for (const [name, list] of Object.entries(S.instances || {})) { const root = kitGlb?.roots.find(r => r.name === name); if (!root || !list.length) continue;
      for (const prim of root.prims) { const key = (prim.material || name).split('.')[0], m = kmats[key] || (kmats[key] = mat(place, FROM_GLB[key] || 'plain', { uv: 4, near: 1.7, ...(FROM_GLB[key] ? {} : { color: prim.color ? prim.color.map(v => Math.pow(v, 1 / 2.2) * .62) : '#808080', gloss: 0, spec: 0 }) }));
        const im = new THREE.InstancedMesh(prim.geometry, m, list.length); im.name = 'kit.' + name; im.frustumCulled = false;
        list.forEach((v, i) => { _p.set(v[0], v[1], v[2]); _q.set(v[3], v[4], v[5], v[6]); _s.set(v[7], v[8], v[9]); im.setMatrixAt(i, _m.compose(_p, _q, _s)); }); im.instanceMatrix.needsUpdate = true; parent.add(im); stats.kit += list.length;
        // a camera flying through the shell sees it from inside: what grows on the outside must not float there
        if (shellR) im.onBeforeRender = (r, s, cam) => { _v.copy(cam.position); parent.worldToLocal(_v); m.uniforms.uNear.value = Math.hypot(_v.x, _v.y) < shellR && Math.abs(_v.z) < 48 ? 1e6 : 1.7; m.uniformsNeedUpdate = true; }; } }
    const by = {}; for (const d of S.decals || []) (by[d.surface || ''] ||= []).push(d);
    for (const [surface, list] of Object.entries(by)) if (kit.decals(place, list, decTex, { parent, bend: bendOf(surface), gain })) stats.decals += list.length; };
  const ready = (async () => {
    const torpedoG = await fromGlb('torpedo.glb', 'torpedo', 0, 0, previz.torpedo, group, { skip: ['lamp_bulb'], drop: (g, key) => { if (key === 'iron' || key === 'brass' || key === 'black') notTheLamp(g); } });
    const seabedG = await fromGlb('seabed.glb', 'bed', UX, UZ, previz.seabed);
    const boatG = await fromGlb('boat.glb', 'boat', BX, BZ, previz.boat);
    // what moves keeps its group from the previz (the ram, the heave, the fall): the glb goes inside it, in that group's own frame, and the previz's parts in it go dark
    const inside = (file, place, G, over, drop) => { const old = [...G.children]; return fromGlb(file, place, 0, 0, null, G, { over, hideOld: old, drop }); };
    const subBedG = await inside('sub.glb', 'bed', subBed.parts, { hull_wreck: { color: '#a3aea6' }, iron: { near: .5 } });
    await inside('sub.glb', 'sea', subSea.parts, { hull_wreck: { color: '#7d868a', grime: .2 } });
    const seaG = await inside('sea.glb', 'sea', cutter);
    const stormG = await inside('storm.glb', 'storm', rescue, { ship_paint: { color: '#3e4650' } }, (g, key) => { if (key === 'rope') { const a = g.attributes.position, ix = g.index, out = []; for (let i = 0; i < ix.count; i += 3) { const A = ix.getX(i), B = ix.getX(i + 1), C = ix.getX(i + 2); if (a.getY(A) > 1.45 && a.getY(B) > 1.45 && a.getY(C) > 1.45) continue; out.push(A, B, C); } g.setIndex(out); } });   // the hose over the boom ends right behind the Navy man's head and reads as an aerial growing out of him
    await inside('sea.glb', 'boat', cutter2, { ship_paint: { color: '#7c8690' } });
    const [kitGlb, sc, decTex] = await Promise.all([readGlb(THREE, new URL('kit.glb', ASSETS).href), fetch(new URL('scatter.json', ASSETS).href).then(r => r.ok ? r.json() : null).catch(() => null), loadTex('decals.png', false)]);
    if (sc) { // Blender's scatter used its own decal order until told otherwise; Flow's README is the truth, so its cells are mapped by what they were meant to be
      const dc = sc.meta?.decalCells, FLOW = { rust: 0, patch: 6, oil: 12, barnacle: 18, growth: 24, wear: 30 }, remap = c => { if (!dc) return c; for (const [k, [a, b]] of Object.entries(dc)) if (c >= a && c <= b && FLOW[k] != null) return FLOW[k] + (c - a); return c; };
      for (const v of Object.values(sc)) for (const d of v?.decals || []) d.cell = remap(d.cell);
      const on = (S, place, G) => { if (G) fromScatter(S, kitGlb, decTex, place, G); };
      on(sc.torpedo, 'torpedo', torpedoG); on(sc.seabed, 'bed', seabedG); if (subBedG) fromScatter(sc.sub, kitGlb, decTex, 'bed', subBedG, undefined, 1, 6.25); on(sc.sea, 'sea', seaG); on(sc.storm, 'storm', stormG); on(sc.boat, 'boat', boatG); }
    const files = [...new Set(allMats.map(a => a.F.file).filter(Boolean))], loaded = {};
    await Promise.all([...files, 'sea.jpg'].map(async f => { loaded[f] = await loadTex(f); if (loaded[f]) stats.tex++; }));
    for (const { m, F } of allMats) if (F.file && loaded[F.file]) { m.uniforms.uMap.value = loaded[F.file]; m.uniforms.uTile.value.set(FINISH_TILE(F), FINISH_TILE(F)); }
    if (loaded['sea.jpg']) for (const w of waters) w.uniforms.uMap.value = loaded['sea.jpg'];
    const [skyS, skyD] = await Promise.all([loadTex('sky_storm.jpg'), loadTex('sky_dawn.jpg')]); if (skyS) SKY_STORM.map = skyS; if (skyD) SKY_DAWN.map = skyD;
    // sprites: hand-placed where the camera sees them (SPRITES below); nothing right behind a face
    const defs = await loadSpriteDefs(THREE, new URL('tex/sprites/', ASSETS));
    if (defs.length && opts.sprites !== false) for (const [place, zone, items, o] of SPRITES) stats.sprites += kit.sprites(place, defs, items.map(i => ({ ...i, p: [i.x + zone[0], i.y ?? 0, i.z + zone[1]] })), o);
    return stats;
  })();
  const FINISH_TILE = F => { for (const f of Object.values(FINISH)) if (f.file === F.file) return f.tile; return F.tile ?? 4; };

  // ======================================================== update: pure in t
  function update(t) {
    rig.update(t); kit.update(t);
    if (surf) surf.visible = surfWin.some(([a, b]) => t >= a - .001 && t <= b + .001);
    for (const c of clouds) { let k = 0; for (let i = 0; i < c.n; i++) { const p = c.fn(i, t); if (!p) { _M.makeScale(0, 0, 0); c.m.setMatrixAt(k++, _M); continue; } _P.set(p[0], p[1], p[2]); _S.setScalar(p[3]); _M.compose(_P, _Q, _S); c.m.setMatrixAt(k++, _M); } c.m.instanceMatrix.needsUpdate = true; }
    for (const m of glassMats.torpedo) m.uniforms.uEmit.value = drivers.lampFar(t) * .3;
    const I = lampI(t), sw = lampSwing(t); bulbM.opacity = .25 + .75 * I; haloM.opacity = .35 * I; lampG.rotation.z = sw; lampG.rotation.x = -sw * .45;
    if (A.ram != null) { const r = A.ram, w0 = r - .75, a = t < r ? smooth(w0 - .6, r, t) : 1, d = t - r; cutter.position.x = SX - 14 * (1 - a);
      cutter.rotation.z = t > r ? -.05 * Math.exp(-d * 1.2) * Math.sin(d * 5) : .004 * Math.sin(t * 1.5); cutter.rotation.x = t > r ? .05 * Math.exp(-d * 1.4) : .008 * Math.sin(t * 1.1);
      const up = smooth(r - .5, r - .02, t); subS.position.y = -30 + 26 * up - (t > r ? 8 * smooth(r, r + 1.5, t) : 0); subS.rotation.x = t > r ? .25 * smooth(r, r + 1.5, t) : 0; subS.rotation.z = t > r ? .35 * smooth(r, r + 1.2, t) : 0; }
    cutter2.rotation.z = .01 * Math.sin(t * 1.2);
    const calm = A.calm != null && t >= A.calm;
    stormSky.set(calm ? SKY_DAWN : SKY_STORM); stormSky.u.uT.value = t * (calm ? 1 : 9); stormSky.u.uFlash.value = calm ? 0 : lightning(t) * 1.4;
    const wc = waterC.material.uniforms, wd = calm ? waterDawn : waterStorm; wc.uDeep.value.set(...wd.deep); wc.uSkyA.value.set(...wd.skyTop); wc.uSkyB.value.set(...wd.skyHor); wc.uChop.value = wd.chop; wc.uFoam.value = wd.foam;
    const heave = calm ? .006 : .035; rescue.rotation.x = heave * Math.sin(t * 1.3); waterC.position.y = -7 + (calm ? .05 : .9) * Math.sin(t * 1.1);
    for (const [i, o] of swell.entries()) { o.visible = !calm; o.position.y = -6 + 4 * Math.sin(t * 1.4 + i * 1.7); }
    if (A.sink) { const [s0, s1] = A.sink, g = Math.min(1, Math.max(0, (t - s0) / (s1 - s0))), f = g * g; subU.position.set(REST[0], 44 - (44 - REST[1]) * f, REST[2]); subU.rotation.x = -.5 * (1 - f); subU.rotation.z = .1 * f; if (t >= s1) { const d = t - s1; subU.position.y = REST[1] - .25 * Math.exp(-d * 4) * Math.sin(d * 9); subU.rotation.x = -.03 * Math.exp(-d * 2) * Math.sin(d * 6); } } else { subU.position.set(...REST); subU.rotation.z = .1; }
    if (A.cam?.restUntil != null && t < A.cam.restUntil) { subU.position.set(...REST); subU.rotation.x = 0; subU.rotation.z = .1; }
  }
  update(0);
  const marks = { pipe: [-2.05, .95] };
  const points = { lamp: LP };
  const look = opts.post ? createPost(THREE, rig, opts.post) : undefined;
  if (look && opts.post.shade) look.shading = createRigShade(THREE, rig, opts.post.shade);   // S-4 pass 5: only a film that asks
  return { name: 's4_env', group, lightDir, skyColor: '#030405', marks, points, bounds: { x: [-7, 7], z: [-5, 7] }, casters: [], uniforms: SH, update, ready, rig, look };
}
export default { buildS4Env };
