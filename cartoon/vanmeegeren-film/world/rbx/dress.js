// world/rbx/dress.js: the Roblox V4 environment layers (V4-ENV, 2026-11-12), gruss's item 4: "so much more detail ... on the walls on the ground,
// PNGs and decals, imperfections ... always facing the camera like old games, exact same strategy as the 3D cartoon shorts ... better shading,
// lightweight ambient occlusion, and proper texturing". Every rbx kit (hallway, home, town, classroom) runs it; rbx-only, no other charsys file uses it.
// Layers, all pure in t (nothing moves per frame except what the camera does, so nothing can flicker):
//   (a) painted sprite cards: the 3D Cartoon Shorts trick (rigkit sprites(), camera-facing round y, lit by the set's own lights, alpha-tested,
//       dissolve when a camera flies close). Pictures: the prop library's painted props, copied to world/assets/rbx/sprites/ (sprites.json).
//       Placed by RAYCASTING the kit's own geometry: wall hits -> step back into the room -> cast down -> floor, grass or a furniture top,
//       then a clearance test (rays round the card), so a card never cuts into the set. Never near a mark (kit marks + opts.dress.avoid).
//   (b) decals: a painted atlas (grime, scuffs, stains, cracks, gum, footprints, leaves, puddles, papers, drips, wall-foot dirt, stickers,
//       dust, oil, moss, smudges), alpha-blended and LIT by the rig (so coloured things like leaves and papers work, unlike multiply), placed on
//       whatever surface a ray hits (floor, walls, lockers, furniture). Each one sits .012 + i * .0003 off its surface + polygon offset:
//       never coplanar with the surface or with another decal.
//   (c) textures on models: a triplanar painted detail map per material family (wood grain, brushed metal, fabric weave, foliage, stone,
//       plastic) modulates every plain-colour surface; mapped surfaces get a light touch of it.
//   (d) ambient occlusion: a baked occupancy VOLUME (Data3DTexture) of the kit's static geometry, blurred, sampled per pixel a little off the
//       surface along its normal: corners, wall feet, under shelves, between furniture go darker. Built once at load; no screen-space pass.
//   (e) shading that reads: key-side form term (faces turned from the key darker), downward faces a little darker, a thin fresnel rim in the
//       sky's colour on every edge (albedo-scaled, never a glow).
// Use (inside a kit):  const D = createDress(THREE, { kit, rig, place: 'hall', group, key: lightDir, night, opts: opts.dress, marks });
//                      D.wrap();            // before any kit.surface call: every surface material gets (c)(d)(e)
//                      ... await glb ...; stats.dress = await D.finish(PRESET);    // (a)(b)(d) from the loaded set
// opts.dress: false = off (V3 look exactly), or { avoid: [[x, z, r], ...] (film coordinates), sprites: n multiplier, decals: n multiplier, seed }
import { LIGHTS_GLSL } from '../look/lights.js';
import { loadSpriteDefs } from '../look/rigkit.js';

const SPRITE_DIR = new URL('../assets/rbx/sprites/', import.meta.url);
const OUT = /* glsl */`vec3 dOut(vec3 c) { vec3 x = max(c - .7, 0.); c = min(c, vec3(.7)) + .3 * (1. - exp(-x / .3)); return pow(max(c, 0.), vec3(1. / 2.2)); }`;
const rng = s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
function cv(THREE, w, h, draw, wrap = false) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; /* V4: renderer max (three clamps), mipmaps on (CanvasTexture default) */ t.colorSpace = THREE.NoColorSpace; return t; }

// ---- (c) detail maps: grey around .5, tileable (everything drawn wrapped)
const wrapDraw = (S, f) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) f(dx, dy); };
const DETAIL = {
  wood: (g, S) => { g.fillStyle = '#808080'; g.fillRect(0, 0, S, S); const R = rng(5);
    for (let k = 0; k < 70; k++) { const y = R() * S, a = .05 + R() * .12, w = 1 + R() * 3, c = R() < .5 ? '0,0,0' : '255,255,255', ph = R() * 6, am = 2 + R() * 6;
      wrapDraw(S, (dx, dy) => { g.strokeStyle = `rgba(${c},${a})`; g.lineWidth = w; g.beginPath(); for (let x = 0; x <= S; x += 8) g.lineTo(x + dx, y + dy + Math.sin(x / S * 6.283 * 2 + ph) * am); g.stroke(); }); }
    for (let k = 0; k < 5; k++) { const x = R() * S, y = R() * S; wrapDraw(S, (dx, dy) => { g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x + dx, y + dy, 9, 4, 0, 0, 7); g.stroke(); }); } },
  metal: (g, S) => { g.fillStyle = '#808080'; g.fillRect(0, 0, S, S); const R = rng(9);
    for (let k = 0; k < 260; k++) { const y = R() * S, x = R() * S, l = 20 + R() * 120, c = R() < .5 ? '0,0,0' : '255,255,255'; wrapDraw(S, (dx, dy) => { g.strokeStyle = `rgba(${c},${.04 + R() * .07})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + l, y + dy); g.stroke(); }); }
    for (let k = 0; k < 14; k++) { const x = R() * S, y = R() * S, r = 10 + R() * 30; wrapDraw(S, (dx, dy) => { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r); gr.addColorStop(0, 'rgba(0,0,0,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r); }); } },
  fabric: (g, S) => { g.fillStyle = '#808080'; g.fillRect(0, 0, S, S); for (let y = 0; y < S; y += 4) { g.fillStyle = y % 8 ? 'rgba(0,0,0,.09)' : 'rgba(255,255,255,.08)'; g.fillRect(0, y, S, 2); }
    for (let x = 0; x < S; x += 4) { g.fillStyle = x % 8 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.06)'; g.fillRect(x, 0, 2, S); } const R = rng(3);
    for (let k = 0; k < 30; k++) { const x = R() * S, y = R() * S, r = 14 + R() * 30; wrapDraw(S, (dx, dy) => { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r); gr.addColorStop(0, `rgba(${R() < .5 ? '0,0,0' : '255,255,255'},.08)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r); }); } },
  leaf: (g, S) => { g.fillStyle = '#808080'; g.fillRect(0, 0, S, S); const R = rng(17);
    for (let k = 0; k < 420; k++) { const x = R() * S, y = R() * S, r = 4 + R() * 9, a = R() * 6.28, c = R() < .55 ? '0,0,0' : '255,255,255', al = .08 + R() * .16;
      wrapDraw(S, (dx, dy) => { g.fillStyle = `rgba(${c},${al})`; g.beginPath(); g.ellipse(x + dx, y + dy, r, r * .45, a, 0, 7); g.fill(); }); } },
  stone: (g, S) => { g.fillStyle = '#808080'; g.fillRect(0, 0, S, S); const R = rng(23);
    for (let k = 0; k < 1600; k++) { const x = R() * S, y = R() * S, r = .6 + R() * 2.4; g.fillStyle = `rgba(${R() < .5 ? '0,0,0' : '255,255,255'},${.08 + R() * .2})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    for (let k = 0; k < 22; k++) { const x = R() * S, y = R() * S, r = 18 + R() * 40; wrapDraw(S, (dx, dy) => { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r); gr.addColorStop(0, `rgba(${R() < .6 ? '0,0,0' : '255,255,255'},.1)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r); }); } },
  plastic: (g, S) => { g.fillStyle = '#808080'; g.fillRect(0, 0, S, S); const R = rng(29);
    for (let k = 0; k < 40; k++) { const x = R() * S, y = R() * S, r = 20 + R() * 50; wrapDraw(S, (dx, dy) => { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r); gr.addColorStop(0, `rgba(${R() < .6 ? '0,0,0' : '255,255,255'},.07)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r); }); }
    for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(0,0,0,${R() * .06})`; g.fillRect(R() * S, R() * S, 1.5, 1.5); } },
};
// family of a material key -> [detail map, strength, scale (repeats per D)]
const FAMILY = [
  [/glass|sky|panel|emit|glow|light|lamp_on|screen|tv|pic_|poster|sign|sticker|paper|book|pen_|clock|chalk|board|string|cloud|water/, null],
  [/leaf|leafs|bush|hedge|grass|plant|tree|foliage|k_plant|ivy|flower/, 'leaf', .34, .9],
  [/wood|door|desk|table|shelf|bench|cabinet|drawer|bunk|chair|frame|cork|counter|floor_wood|plank|fence|trunk|bark|crate|stair|beam/, 'wood', .26, .8],
  [/locker|steel|chrome|metal|fridge|stove|oven|bin|pole|rail|car_|hydrant|gold|sink|tap|vent|radiator|trophy|fountain|knob|handle/, 'metal', .2, .7],
  [/sofa|couch|bed|pillow|blanket|curtain|rug|carpet|cushion|seat|towel|bag|cloth|duvet|sheet|mattress|beanbag/, 'fabric', .3, 1.6],
  [/brick|stone|concrete|sidewalk|road|asphalt|curb|path|rock|tile|plaster|wall|ceiling|chimney|step|pavement|ground|terrain/, 'stone', .12, .55],
];
const familyOf = key => { for (const [re, ...v] of FAMILY) if (re.test(key)) return v; return ['plastic', .12, .6]; };

// ---- (b) decal atlas, 5 x 5 cells (round 2: 4 x 4 + 9 new), painted with real colour + alpha (alpha-blended, lit)
export const DECAL = { grime: 0, scuff: 1, stain: 2, crack: 3, gum: 4, steps: 5, leaves: 6, puddle: 7, paper: 8, drips: 9, foot: 10, sticker: 11, dust: 12, oil: 13, moss: 14, smudge: 15,
  manhole: 16, chalk: 17, grate: 18, water: 19, petals: 20, litter: 21, bigcrack: 22, tyre: 23, scraps: 24 };
function decalAtlas(g, S) { const C = S / 5; g.clearRect(0, 0, S, S);
  const cell = (i, f) => { g.save(); g.translate((i % 5) * C, Math.floor(i / 5) * C); g.beginPath(); g.rect(0, 0, C, C); g.clip(); f(rng(100 + i)); g.restore(); };
  const blot = (x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(.6, `rgba(${col},${a * .5})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); };
  cell(0, R => { for (let k = 0; k < 14; k++) blot(C * (.3 + R() * .4), C * (.3 + R() * .4), C * (.12 + R() * .2), '62,50,38', .22); for (let k = 0; k < 120; k++) { g.fillStyle = `rgba(50,40,30,${R() * .35})`; g.beginPath(); g.arc(C * (.2 + R() * .6), C * (.2 + R() * .6), 1 + R() * 3, 0, 7); g.fill(); } });
  cell(1, R => { g.lineCap = 'round'; for (let k = 0; k < 18; k++) { g.strokeStyle = `rgba(35,30,32,${.25 + R() * .4})`; g.lineWidth = 2 + R() * 6; const x = C * (.15 + R() * .7), y = C * (.2 + R() * .6), l = C * (.08 + R() * .3), a = R() * .5 - .25; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l * .5, y + l * a + 5, x + l, y + l * a * 2); g.stroke(); } });
  cell(2, R => { for (let k = 0; k < 5; k++) blot(C * (.4 + R() * .2), C * (.4 + R() * .2), C * (.18 + R() * .2), '120,92,52', .2); g.strokeStyle = 'rgba(110,80,40,.35)'; g.lineWidth = 5; g.beginPath(); g.ellipse(C * .5, C * .52, C * .33, C * .28, .3, 0, 7); g.stroke(); });
  cell(3, R => { g.strokeStyle = 'rgba(40,36,40,.75)'; g.lineCap = 'round'; for (let b = 0; b < 3; b++) { let x = C * .5, y = C * .5; g.lineWidth = 5 - b; g.beginPath(); g.moveTo(x, y); const a0 = b * 2.1 + R(); for (let k = 0; k < 9; k++) { x += Math.cos(a0 + (R() - .5) * 1.2) * C * .05; y += Math.sin(a0 + (R() - .5) * 1.2) * C * .05; g.lineTo(x, y); } g.stroke(); } });
  cell(4, R => { for (let k = 0; k < 9; k++) { const x = C * (.15 + R() * .7), y = C * (.15 + R() * .7), r = 5 + R() * 9; g.fillStyle = ['rgba(240,110,170,.85)', 'rgba(110,200,240,.8)', 'rgba(70,64,70,.8)', 'rgba(235,235,225,.85)'][k % 4]; g.beginPath(); g.ellipse(x, y, r, r * .8, R(), 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(x + 2, y + 2, r * .5, 0, 7); g.fill(); }
    for (let k = 0; k < 90; k++) { g.fillStyle = `rgba(60,55,50,${R() * .5})`; g.fillRect(C * R(), C * R(), 2, 2); } });
  cell(5, R => { for (let k = 0; k < 6; k++) { const x = C * (.32 + (k % 2) * .3), y = C * (.1 + k * .15); g.fillStyle = 'rgba(70,58,50,.4)'; g.beginPath(); g.ellipse(x, y, C * .055, C * .085, .1, 0, 7); g.fill(); g.beginPath(); g.ellipse(x, y + C * .1, C * .045, C * .035, 0, 0, 7); g.fill(); } });
  cell(6, R => { const cols = ['232,140,40', '214,84,40', '240,196,60', '140,170,60', '150,96,52']; for (let k = 0; k < 14; k++) { const x = C * (.22 + R() * .56), y = C * (.22 + R() * .56), r = C * (.04 + R() * .04), a = R() * 6.28, c = cols[k % cols.length];
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = `rgba(${c},.95)`; g.beginPath(); g.moveTo(-r * 1.4, 0); g.quadraticCurveTo(0, -r * .9, r * 1.4, 0); g.quadraticCurveTo(0, r * .9, -r * 1.4, 0); g.fill(); g.strokeStyle = 'rgba(90,60,30,.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-r * 1.4, 0); g.lineTo(r * 1.4, 0); g.stroke(); g.restore(); } });
  cell(7, R => { g.fillStyle = 'rgba(120,150,190,.55)'; g.beginPath(); for (let k = 0; k <= 16; k++) { const a = k / 16 * 6.283, r = C * (.3 + R() * .12); g.lineTo(C * .5 + Math.cos(a) * r, C * .5 + Math.sin(a) * r * .7); } g.fill(); g.strokeStyle = 'rgba(235,245,255,.7)'; g.lineWidth = 6; g.beginPath(); g.moveTo(C * .32, C * .42); g.lineTo(C * .6, C * .36); g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(C * .42, C * .58); g.lineTo(C * .62, C * .54); g.stroke(); });
  cell(8, R => { for (let k = 0; k < 4; k++) { const x = C * (.36 + R() * .28), y = C * (.36 + R() * .28), w = C * (.14 + R() * .06), h = w * 1.3, a = R() * 6.28;
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(-w / 2 + 3, -h / 2 + 4, w, h); g.fillStyle = k % 3 === 2 ? 'rgba(255,240,130,1)' : 'rgba(250,250,244,1)'; g.fillRect(-w / 2, -h / 2, w, h);
    g.strokeStyle = 'rgba(90,130,210,.6)'; g.lineWidth = 1.5; for (let l = 1; l < 6; l++) { g.beginPath(); g.moveTo(-w / 2 + 4, -h / 2 + l * h / 6); g.lineTo(w / 2 - 4, -h / 2 + l * h / 6); g.stroke(); } g.restore(); } });
  cell(9, R => { for (let k = 0; k < 9; k++) { const x = C * (.12 + R() * .76), l = C * (.3 + R() * .6), w = 3 + R() * 7; const gr = g.createLinearGradient(0, 0, 0, l); gr.addColorStop(0, 'rgba(90,72,50,.4)'); gr.addColorStop(1, 'rgba(90,72,50,0)'); g.fillStyle = gr; g.fillRect(x - w / 2, 0, w, l); g.beginPath(); g.arc(x, l * .92, w * .6, 0, 7); g.fill(); } });
  cell(10, R => { const gr = g.createLinearGradient(0, C, 0, 0); gr.addColorStop(0, 'rgba(60,48,36,.6)'); gr.addColorStop(.35, 'rgba(60,48,36,.22)'); gr.addColorStop(1, 'rgba(60,48,36,0)'); g.fillStyle = gr; g.fillRect(0, 0, C, C); for (let k = 0; k < 10; k++) blot(C * R(), C * (.75 + R() * .25), C * (.08 + R() * .12), '60,48,36', .25); });
  cell(11, R => { const cols = ['#ff4a8a', '#3a8cff', '#ffd23a', '#3fd17a', '#a46cff']; for (let k = 0; k < 5; k++) { const x = C * (.2 + R() * .6), y = C * (.2 + R() * .6), r = C * (.06 + R() * .05); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, r * 1.2, 0, 7); g.fill(); g.fillStyle = cols[k]; if (k % 2) { g.beginPath(); for (let j = 0; j < 10; j++) { const a = j * Math.PI / 5 - Math.PI / 2, rr = j % 2 ? r * .45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); } else { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = '#1c1c22'; g.fillRect(x - r * .35, y - r * .25, r * .16, r * .2); g.fillRect(x + r * .2, y - r * .25, r * .16, r * .2); } } });
  cell(12, R => { for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(${R() < .5 ? '150,130,100' : '235,225,205'},${R() * .45})`; const x = C * (.5 + (R() - .5) * (R() * .9)), y = C * (.5 + (R() - .5) * (R() * .9)); g.fillRect(x, y, 1.5 + R() * 2, 1.5 + R() * 2); } });
  cell(13, R => { blot(C * .5, C * .5, C * .36, '24,22,30', .55); blot(C * .42, C * .55, C * .2, '24,22,30', .4); g.strokeStyle = 'rgba(160,120,220,.25)'; g.lineWidth = 4; g.beginPath(); g.arc(C * .5, C * .5, C * .22, 0, 7); g.stroke(); });
  cell(14, R => { for (let k = 0; k < 160; k++) { const x = C * (.5 + (R() - .5) * .8), y = C * (.6 + (R() - .5) * .7), l = 6 + R() * 22, a = -Math.PI / 2 + (R() - .5) * 1.2; g.strokeStyle = `rgba(${[ '70,140,50', '96,170,60', '50,110,40'][k % 3]},${.6 + R() * .4})`; g.lineWidth = 2 + R() * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } });
  cell(15, R => { for (let k = 0; k < 4; k++) { const x = C * (.25 + R() * .5), y = C * (.25 + R() * .5); g.fillStyle = 'rgba(70,60,60,.16)'; g.beginPath(); g.ellipse(x, y, C * .06, C * .075, 0, 0, 7); g.fill(); for (let f = 0; f < 4; f++) { g.beginPath(); g.ellipse(x - C * .045 + f * C * .03, y - C * .11, C * .013, C * .04, 0, 0, 7); g.fill(); } } blot(C * .5, C * .5, C * .4, '70,60,60', .08); });
  // round 2 cells: things that READ from a floor-level camera (strong shapes, real colour)
  cell(16, R => { const c = C * .5, r = C * .4; g.fillStyle = 'rgba(70,72,82,1)'; g.beginPath(); g.arc(c, c, r, 0, 7); g.fill(); g.strokeStyle = 'rgba(40,40,48,1)'; g.lineWidth = C * .035; g.stroke();
    g.strokeStyle = 'rgba(120,122,134,1)'; g.lineWidth = C * .02; g.beginPath(); g.arc(c, c, r * .82, 0, 7); g.stroke(); g.save(); g.beginPath(); g.arc(c, c, r * .76, 0, 7); g.clip();
    for (let k = -8; k <= 8; k++) { g.fillStyle = 'rgba(105,108,120,1)'; g.fillRect(c - r, c + k * r * .12 - r * .03, 2 * r, r * .06); } g.restore(); blot(c, c, r * 1.1, '40,36,40', .25); });
  cell(17, R => { const cols = ['255,140,190', '120,200,255', '255,230,120', '150,240,160', '200,160,255']; g.lineCap = 'round'; g.lineJoin = 'round';
    for (let k = 0; k < 3; k++) { g.strokeStyle = `rgba(${cols[k]},.85)`; g.lineWidth = 9; g.strokeRect(C * (.12 + k * .25), C * .1, C * .22, C * .22); }
    g.strokeStyle = `rgba(${cols[3]},.85)`; g.lineWidth = 9; g.strokeRect(C * .37, C * .36, C * .22, C * .22);
    g.strokeStyle = `rgba(${cols[2]},.9)`; g.beginPath(); g.arc(C * .25, C * .75, C * .1, 0, 7); g.stroke(); for (let k = 0; k < 8; k++) { const a = k * .785; g.beginPath(); g.moveTo(C * .25 + Math.cos(a) * C * .14, C * .75 + Math.sin(a) * C * .14); g.lineTo(C * .25 + Math.cos(a) * C * .2, C * .75 + Math.sin(a) * C * .2); g.stroke(); }
    g.strokeStyle = `rgba(${cols[4]},.9)`; g.beginPath(); for (let k = 0; k <= 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, rr = k % 2 ? C * .07 : C * .16; g.lineTo(C * .7 + Math.cos(a) * rr, C * .75 + Math.sin(a) * rr); } g.stroke(); });
  cell(18, R => { g.fillStyle = 'rgba(60,62,72,1)'; g.fillRect(C * .14, C * .26, C * .72, C * .48); g.fillStyle = 'rgba(28,28,34,1)'; for (let k = 0; k < 7; k++) g.fillRect(C * .19, C * (.31 + k * .06), C * .62, C * .03);
    g.strokeStyle = 'rgba(150,152,164,1)'; g.lineWidth = 6; g.strokeRect(C * .14, C * .26, C * .72, C * .48); });
  cell(19, R => { for (let k = 0; k < 3; k++) { g.strokeStyle = `rgba(150,110,50,${.35 - k * .08})`; g.lineWidth = 7; g.beginPath(); for (let j = 0; j <= 24; j++) { const a = j / 24 * 6.283, r = C * (.18 + k * .08) * (1 + .12 * Math.sin(a * 3 + k)); g.lineTo(C * .5 + Math.cos(a) * r, C * .5 + Math.sin(a) * r); } g.stroke(); }
    blot(C * .5, C * .5, C * .34, '170,130,60', .22); });
  cell(20, R => { const cols = ['255,170,200', '255,255,255', '255,200,220', '250,120,170']; for (let k = 0; k < 40; k++) { const x = C * (.1 + R() * .8), y = C * (.1 + R() * .8), r = C * (.018 + R() * .02); g.fillStyle = `rgba(${cols[k % 4]},.95)`; g.beginPath(); g.ellipse(x, y, r * 1.5, r, R() * 6.28, 0, 7); g.fill(); } });
  cell(21, R => { const cols = ['#ff4a5a', '#3a8cff', '#ffd23a', '#ffffff', '#3fd17a', '#ff8a2a']; for (let k = 0; k < 9; k++) { const x = C * (.15 + R() * .7), y = C * (.15 + R() * .7), w = C * (.05 + R() * .07), h = w * (.5 + R() * .6);
    g.save(); g.translate(x, y); g.rotate(R() * 6.28); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(-w / 2 + 3, -h / 2 + 3, w, h); g.fillStyle = cols[k % cols.length]; g.fillRect(-w / 2, -h / 2, w, h); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(-w / 2, -h / 2, w, h * .25); g.restore(); } });
  cell(22, R => { g.strokeStyle = 'rgba(30,28,34,.85)'; g.lineCap = 'round'; const br = (x, y, a, l, w, d) => { if (d > 4 || w < .8) return; let px = x, py = y; g.lineWidth = w; g.beginPath(); g.moveTo(px, py);
    for (let k = 0; k < 6; k++) { a += (R() - .5) * .9; px += Math.cos(a) * l / 6; py += Math.sin(a) * l / 6; g.lineTo(px, py); } g.stroke(); br(px, py, a - .6, l * .6, w * .65, d + 1); if (R() < .7) br(px, py, a + .7, l * .55, w * .6, d + 1); };
    br(C * .1, C * .5, 0, C * .35, 7, 0); br(C * .5, C * .5, 3.14, C * .2, 5, 2); });
  cell(23, R => { g.lineCap = 'round'; for (const o of [-.06, .06]) { g.strokeStyle = 'rgba(30,28,32,.45)'; g.lineWidth = C * .07; g.beginPath(); g.moveTo(C * (.08 + o), C * .9); g.bezierCurveTo(C * (.3 + o), C * .55, C * (.6 + o), C * .45, C * (.92 + o), C * .1); g.stroke(); } });
  cell(24, R => { const cols = ['250,250,244', '255,226,120', '140,200,255', '255,160,180']; for (let k = 0; k < 6; k++) { const x = C * (.2 + R() * .6), y = C * (.2 + R() * .6), w = C * (.12 + R() * .1), h = w * (1 + R() * .5);
    g.save(); g.translate(x, y); g.rotate((R() - .5) * .5); g.fillStyle = `rgba(${cols[k % 4]},1)`; g.beginPath(); g.moveTo(-w / 2, -h / 2); g.lineTo(w / 2, -h / 2 + R() * 8); g.lineTo(w / 2 - R() * 10, h / 2); g.lineTo(-w / 2 + R() * 14, h / 2 - R() * 10); g.closePath(); g.fill();
    g.fillStyle = 'rgba(180,180,190,1)'; g.beginPath(); g.arc(0, -h / 2 + 8, 4, 0, 7); g.fill(); g.restore(); } });
}

const DECAL_V = /* glsl */`attribute vec2 aCell; attribute float aAlpha; attribute vec3 aN; uniform float uGrid; varying vec2 vUv; varying float vA; varying vec3 vW; varying vec3 vN;
void main() { vUv = (uv + aCell) / uGrid; vA = aAlpha; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.); vW = w.xyz; vN = aN; gl_Position = projectionMatrix * viewMatrix * w; }`;
const DECAL_F = /* glsl */`uniform sampler2D uMap; uniform float uGain;
${LIGHTS_GLSL}
${OUT}
varying vec2 vUv; varying float vA; varying vec3 vW; varying vec3 vN;
void main() { vec4 t = texture2D(uMap, vUv); float a = t.a * vA * uGain; if (a < .004) discard;
  vec3 rgb = t.rgb / max(t.a, .004); vec3 d, s; rigLight(vW, normalize(vN), normalize(cameraPosition - vW), 0., d, s);
  gl_FragColor = vec4(rigFog(dOut(pow(rgb, vec3(2.2)) * d), vW), a); }`;

// ---- (c)(d)(e) the surface patch
const P_HEAD = /* glsl */`uniform highp sampler3D uDAoVol; uniform vec3 uDAoMin, uDAoInv, uDKey, uDRimCol; uniform float uDAoK, uDAoStep, uDForm, uDRim, uDDetK, uDDetS, uDCut, uDSat, uDGain; uniform sampler2D uDDet;
float dressAo(vec3 p, vec3 n) { if (uDAoK <= 0.) return 1.;
  float o = texture(uDAoVol, (p + n * uDAoStep - uDAoMin) * uDAoInv).r * .55 + texture(uDAoVol, (p + n * uDAoStep * 2.2 - uDAoMin) * uDAoInv).r * .45;
  return 1. - uDAoK * smoothstep(.2, .78, o); }   // round 2: contact only (onset .03 -> .2), no grey film over open surfaces
float dressDet(vec3 p, vec3 n) { vec3 a = abs(n); a /= (a.x + a.y + a.z + 1e-4);
  return texture2D(uDDet, p.zy * uDDetS).r * a.x + texture2D(uDDet, p.xz * uDDetS).r * a.y + texture2D(uDDet, p.xy * uDDetS).r * a.z; }
vec3 bumped(`;
const P_CUT = `float lum = dot(tx, vec3(.3, .5, .2)); if (uDCut > 0. && uHasMap > .5 && texture2D(uMap, uv).a < uDCut) discard;`;
const P_DET = `if (uDDetK > 0.) base *= 1. + uDDetK * 2. * (dressDet(vW, n) - .5);
  vec3 lin = pow(base, vec3(2.2));`;
// V4 flicker fix (cantcry f2984): the texture bump (dFdx of the map's luma) on a glossy floor seen at a grazing angle turns into
// one-pixel white specular sparkles that change every frame. The bump fades out at grazing angles and where one pixel covers a lot of
// surface (fwidth of the world position), so far / grazing floors are smooth and close ones keep their grain.
const B_ORIG = 'vec3 nb = bd > .002 ? bumped(n, lum * bd) : n;';
// V4 shimmer fix (2026-11-13, whistle brick f170, cantcry asphalt f2757, every floor-level move): the bump is dFdx of the map's luma,
// i.e. a texel-to-texel difference. Once one pixel covers more than ~1 texel (mip level > 0) that difference is high-frequency noise
// that changes with every sub-pixel camera move: shimmer on brick mortar, sparkle on asphalt. The bump now lives only where the map
// is magnified (close-ups keep their grain), fading out between .6 and 2.5 texels per pixel.
const P_BUMP = `bd *= smoothstep(.12, .5, abs(dot(n, v))) / (1. + 80. * length(fwidth(vW)));
  if (uHasMap > .5) bd *= 1. - smoothstep(.6, 2.5, length(fwidth(uv)) * float(textureSize(uMap, 0).x));
  vec3 nb = bd > .002 ? bumped(n, lum * bd) : n;`;
const P_BUMP_V1 = `bd *= smoothstep(.12, .5, abs(dot(n, v))) / (1. + 80. * length(fwidth(vW)));
  vec3 nb = bd > .002 ? bumped(n, lum * bd) : n;`;
// V4 speckle fix (cantcry f2668-3370 parking lot, love's desert band): rigkit's bumped() divides two tiny numbers near the camera
// (det = pixel footprint squared). Far from the world origin (the town kits sit hundreds of D out) dFdx(vW) is mostly float rounding,
// so the bumped normal flips or goes NaN: single dark pixels, a new pattern every frame. Same maths, made safe: no bump where the
// footprint is under ~60 float steps of the position, the tilt clamped to .6 (no flipped normal), never a zero-length normalize.
const BUMPED_ORIG = /* glsl */`vec3 bumped(vec3 n, float h) { vec3 sx = dFdx(vW), sy = dFdy(vW), r1 = cross(sy, n), r2 = cross(n, sx); float det = dot(sx, r1);
  vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2); return normalize(abs(det) * n - g); }`;
const BUMPED_SAFE = /* glsl */`vec3 bumped(vec3 n, float h) { vec3 sx = dFdx(vW), sy = dFdy(vW), r1 = cross(sy, n), r2 = cross(n, sx); float det = dot(sx, r1);
  if (abs(det) < 1e-20 || min(length(sx), length(sy)) < max(1., length(vW)) * 4e-6) return n;
  vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2) / abs(det); float gl = length(g); if (gl > .6) g *= .6 / gl; return normalize(n - g); }`;
// V4 shimmer fix: rigkit's stain / wet value noise has octaves at 3.1 and 2.3 per D. On a far floor seen from .25 D up one pixel covers
// metres, so those octaves are sampled below their frequency and crawl as the camera moves. Each octave fades to its mean (.5) as its
// cells get smaller than a pixel (fwidth of q), the near look is unchanged.
const NOISE_ORIG = 'float big = rigN(q * .31 + 3.7) * .6 + rigN(q * .93 + 11.3) * .28 + rigN(q * 3.1) * .12;';
const NOISE_SAFE = `float fq = length(fwidth(q)); float big = mix(rigN(q * .31 + 3.7), .5, smoothstep(1.2, 4., fq)) * .6 + mix(rigN(q * .93 + 11.3), .5, smoothstep(.4, 1.3, fq)) * .28 + mix(rigN(q * 3.1), .5, smoothstep(.12, .4, fq)) * .12;`;
const WET_ORIG = 'float wet = smoothstep(.42, .66, rigN(q * .55 + 21.) * .7 + rigN(q * 2.3 + 5.) * .3);';
const WET_SAFE = 'float wet = smoothstep(.42, .66, mix(rigN(q * .55 + 21.), .5, smoothstep(.7, 2.2, fq)) * .7 + mix(rigN(q * 2.3 + 5.), .5, smoothstep(.16, .55, fq)) * .3);';
// round 2: ceilings (faces looking down) take a third of the volume AO, so they stay high key
const P_AO = `float ao = (1. - uAo * (1. - rigAo(vW))) * mix(1., dressAo(vW, n), mix(.15, 1., smoothstep(-.9, -.4, n.y)));`;
// round 2: the form term is balanced (lit side up as much as the far side goes down, it no longer only darkens), then a small
// saturation + gain lift (uDSat, uDGain) so the dressed look is at least as bright and vibrant as V3
const P_FORM = `c += lin * uEmit;
  if (uEmit < .5) { float kd = dot(nb, uDKey); float side = 1. - abs(nb.y) * .75; c *= mix(1. - uDForm * .55 * side, 1. + uDForm * .5 * side, smoothstep(-.45, .85, kd)) * mix(.97, 1., smoothstep(-.7, .1, nb.y));
    float fr = pow(1. - clamp(dot(nb, v), 0., 1.), 3.2); c += lin * uDRimCol * fr * uDRim * ao;
    c = max(mix(vec3(dot(c, vec3(.2126, .7152, .0722))), c, uDSat), 0.) * uDGain; }`;

export function createDress(THREE, { kit, rig, place, group, key = [-.4, .8, .4], night = false, opts = {}, marks = {}, rim } = {}) {
  const off = opts === false || opts?.off;
  const O = opts && typeof opts === 'object' ? opts : {};
  const kv = new THREE.Vector3(...key).normalize();
  const vol = new THREE.Data3DTexture(new Uint8Array([0]), 1, 1, 1); vol.format = THREE.RedFormat; vol.needsUpdate = true;
  const U = { uDAoVol: { value: vol }, uDAoMin: { value: new THREE.Vector3() }, uDAoInv: { value: new THREE.Vector3(1, 1, 1) }, uDAoK: { value: 0 }, uDAoStep: { value: .3 },
    uDKey: { value: kv }, uDRimCol: { value: new THREE.Vector3(...(rim || (night ? [.45, .5, .9] : [1, .97, .9]))) },
    uDSat: { value: O.sat ?? (night ? 1.08 : 1.12) }, uDGain: { value: O.gain ?? (night ? 1.07 : 1.11) } };
  const det = {}; const detOf = k => det[k] ||= cv(THREE, 256, 256, DETAIL[k], true);
  const patched = new Set();
  // patch one rigkit surface material (any other material is returned untouched)
  const patch = (m, keyName = '', o = {}) => { if (off || !m?.fragmentShader || patched.has(m)) return m; const f = m.fragmentShader;
    if (!f.includes('vec3 bumped(') || !f.includes('vec3 lin = pow(base, vec3(2.2));') || !f.includes('c += lin * uEmit;')) return m;
    const sf = O.shimmerFix !== false;   // opts.dress.shimmerFix: false = the shader before the 2026-11-13 shimmer pass (before / after checks only)
    m.fragmentShader = (sf ? f.replace(BUMPED_ORIG, BUMPED_SAFE).replace(NOISE_ORIG, NOISE_SAFE).replace(WET_ORIG, WET_SAFE) : f).replace('vec3 bumped(', P_HEAD).replace('float lum = dot(tx, vec3(.3, .5, .2));', P_CUT).replace('vec3 lin = pow(base, vec3(2.2));', P_DET)
      .replace('float ao = 1. - uAo * (1. - rigAo(vW));', P_AO).replace('c += lin * uEmit;', P_FORM).replace(B_ORIG, sf ? P_BUMP : P_BUMP_V1);
    const [dk, ds, sc] = familyOf(keyName); const mapped = !!m.uniforms.uMap?.value;
    Object.assign(m.uniforms, U, { uDForm: { value: o.form ?? (night ? .2 : .32) }, uDRim: { value: o.rim ?? (night ? .3 : .45) }, uDCut: { value: o.cut ?? 0 },
      uDDet: { value: dk ? detOf(dk) : detOf('plastic') }, uDDetK: { value: dk ? (o.detail ?? (mapped ? ds * .35 : ds)) : 0 }, uDDetS: { value: sc ?? .6 } });
    m.needsUpdate = true; patched.add(m); return m; };
  // every kit.surface(place, colour, o) from now on is patched; o.dressKey names the material family (else guessed from the colour call site)
  const wrap = () => { if (off) return; const s0 = kit.surface; kit.surface = (plc, color, o = {}) => patch(s0(plc, color, o), o.dressKey || '', o.dress || {}); return kit; };
  // the kits name their glb meshes 'set.<key>': a pass over them gives each its family once the set is loaded
  const refamily = () => { group.traverse(o => { if (!o.isMesh || !patched.has(o.material)) return; const k = (o.name || '').replace(/^set\./, '');
    const [dk, ds, sc] = familyOf(k), m = o.material; if (m.userData.dressKey) return; m.userData.dressKey = k;
    m.uniforms.uDDet.value = dk ? detOf(dk) : detOf('plastic'); m.uniforms.uDDetK.value = dk ? (m.uniforms.uMap?.value ? ds * .35 : ds) : 0; m.uniforms.uDDetS.value = sc ?? .6; }); };

  // static meshes of the set (no decals, blobs, sprites, sky, glass, capsules)
  const statics = () => { const out = []; group.updateMatrixWorld(true);
    group.traverse(o => { if (!o.isMesh || o.isInstancedMesh || !o.visible) return; const m = o.material; if (!m || m.transparent || m.side === THREE.BackSide) return;
      if (/^(ground\.|decals|sprite|dress\.|capsule|set\.shadow|set\.glass|bunting)/.test(o.name || '')) return; out.push(o); });
    return out; };

  // (d) the AO volume
  const buildAo = (meshes, { cell, k = .5, pad = 1, clip = null } = {}) => {
    const box = new THREE.Box3(); for (const m of meshes) box.expandByObject(m);
    if (box.isEmpty()) return null; box.min.subScalar(pad); box.max.addScalar(pad);
    if (clip) { box.min.max(clip.min); box.max.min(clip.max); if (box.isEmpty()) return null; }
    const sz = box.getSize(new THREE.Vector3()); let c = cell || .2; while ((sz.x / c) * (sz.y / c) * (sz.z / c) > 2.6e6) c *= 1.15;
    const nx = Math.ceil(sz.x / c), ny = Math.ceil(sz.y / c), nz = Math.ceil(sz.z / c), N = nx * ny * nz, occ = new Float32Array(N);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), p = new THREE.Vector3();
    const mark = (x, y, z) => { const i = Math.floor((x - box.min.x) / c), j = Math.floor((y - box.min.y) / c), l = Math.floor((z - box.min.z) / c); if (i < 0 || j < 0 || l < 0 || i >= nx || j >= ny || l >= nz) return; occ[i + nx * (j + ny * l)] = 1; };
    let tris = 0;
    for (const m of meshes) { const g = m.geometry, P = g.attributes.position; if (!P) continue; const W = m.matrixWorld, idx = g.index, n = idx ? idx.count : P.count;
      for (let t = 0; t < n; t += 3) { const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
        a.fromBufferAttribute(P, i0).applyMatrix4(W); b.fromBufferAttribute(P, i1).applyMatrix4(W); d.fromBufferAttribute(P, i2).applyMatrix4(W); tris++;
        const L = Math.max(a.distanceTo(b), b.distanceTo(d), d.distanceTo(a)), s = Math.max(1, Math.ceil(L / (c * .6)));
        for (let u = 0; u <= s; u++) for (let v = 0; v <= s - u; v++) { const w = s - u - v; p.set((a.x * u + b.x * v + d.x * w) / s, (a.y * u + b.y * v + d.y * w) / s, (a.z * u + b.z * v + d.z * w) / s); mark(p.x, p.y, p.z); } } }
    // three box-blur passes along each axis (radius 1 cell): close to a gaussian of ~1.4 cells
    const tmp = new Float32Array(N), str = [1, nx, nx * ny], dims = [nx, ny, nz];
    for (let pass = 0; pass < 2; pass++) for (let ax = 0; ax < 3; ax++) { const st = str[ax], D = dims[ax];
      for (let i = 0; i < N; i++) { const q = Math.floor(i / st) % D; let s = occ[i], w = 1; if (q > 0) { s += occ[i - st]; w++; } if (q < D - 1) { s += occ[i + st]; w++; } tmp[i] = s / w; } occ.set(tmp); }
    const data = new Uint8Array(N); for (let i = 0; i < N; i++) data[i] = Math.min(255, Math.round(occ[i] * 255 * 1.6));
    const tex = new THREE.Data3DTexture(data, nx, ny, nz); tex.format = THREE.RedFormat; tex.type = THREE.UnsignedByteType; tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping; tex.unpackAlignment = 1; tex.needsUpdate = true;
    U.uDAoVol.value = tex; U.uDAoMin.value.copy(box.min); U.uDAoInv.value.set(1 / (nx * c), 1 / (ny * c), 1 / (nz * c)); U.uDAoK.value = k; U.uDAoStep.value = c * 1.6;
    return { cell: +c.toFixed(3), voxels: N, tris }; };

  // raycasting helpers over the static set
  const ray = new THREE.Raycaster(); let targets = [];
  const hit = (o, dir, far = 30) => { ray.set(new THREE.Vector3(...o), new THREE.Vector3(...dir).normalize()); ray.far = far; const h = ray.intersectObjects(targets, false)[0]; if (!h) return null;
    const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0); if (n.dot(ray.ray.direction) > 0) n.negate();
    return { p: h.point, n, key: (h.object.name || '').replace(/^set\./, ''), d: h.distance }; };
  const avoidList = () => [...Object.values(marks || {}).map(([x, z]) => [x, z, 1.25]), ...(O.avoid || [])];
  const nearMark = (x, z, extra = 0) => avoidList().some(([ax, az, r]) => Math.hypot(x - ax, z - az) < (r ?? 1.25) + extra);

  // (b) decals: list of { cell, pos (world), n, spin, size: [w, h], alpha } -> one instanced, lit, alpha-blended draw
  const atlas = cv(THREE, 2560, 2560, decalAtlas);
  const decals = list => { if (!list.length) return null; const geo = new THREE.PlaneGeometry(1, 1), grid = 5;
    const cells = new Float32Array(list.length * 2), al = new Float32Array(list.length), nn = new Float32Array(list.length * 3);
    const m = new THREE.ShaderMaterial({ vertexShader: DECAL_V, fragmentShader: DECAL_F, uniforms: { ...rig.uniforms(place), uMap: { value: atlas }, uGrid: { value: grid }, uGain: { value: night ? .8 : 1 } },
      transparent: true, depthWrite: false, side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -10 });   // V4 flicker fix: units only (a slope factor pulled floor decals through rugs / layers above at grazing angles)   // round 2: front side only (a camera under a surface never sees its decals)
    const im = new THREE.InstancedMesh(geo, m, list.length); im.name = 'dress.decals'; im.frustumCulled = false; im.renderOrder = -1.2;
    const up = new THREE.Vector3(0, 1, 0), u = new THREE.Vector3(), v = new THREE.Vector3(), n = new THREE.Vector3(), B = new THREE.Matrix4(), q = new THREE.Quaternion(), qs = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), P = new THREE.Vector3(), S = new THREE.Vector3(), M = new THREE.Matrix4();
    list.forEach((d, i) => { n.copy(d.n).normalize(); if (Math.abs(n.y) > .7) u.set(1, 0, 0); else u.crossVectors(up, n).normalize(); v.crossVectors(n, u).normalize(); B.makeBasis(u, v, n); q.setFromRotationMatrix(B); qs.setFromAxisAngle(Z, d.spin || 0); q.multiply(qs);
      P.copy(d.pos).addScaledVector(n, .015 + (i % 16) * .0005).sub(group.position); S.set(d.size[0], d.size[1], 1); im.setMatrixAt(i, M.compose(P, q, S));
      cells[i * 2] = d.cell % grid; cells[i * 2 + 1] = grid - 1 - Math.floor(d.cell / grid); al[i] = d.alpha ?? 1; nn.set([n.x, n.y, n.z], i * 3); });
    geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2)); geo.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(al, 1)); geo.setAttribute('aN', new THREE.InstancedBufferAttribute(nn, 3));
    im.instanceMatrix.needsUpdate = true; group.add(im); return im; };

  // finish: preset = { area: { x: [x0, x1], z: [z0, z1], y: eye height for wall rays, ceil }, ao: { cell, k }, decals: { floor, wall, floorCells, wallCells },
  //   sprites: { floor: [names], top: [names], wall: [names], grass: [names], n: { floor, top, wall, grass } }, lane: fn(x, z) -> true where nothing may stand }
  const finish = async (preset = {}) => { if (off) return { off: true };
    const t0 = performance.now(), st = {}; const meshes = statics(); targets = meshes; refamily();
    const R = rng((O.seed ?? preset.seed ?? 11) >>> 0), A = preset.area, gx = group.position.x, gz = group.position.z;
    const clip = A ? new THREE.Box3(new THREE.Vector3(A.x[0] + gx - 2, -1, A.z[0] + gz - 2), new THREE.Vector3(A.x[1] + gx + 2, (A.ceil ?? 8) + 1.5, A.z[1] + gz + 2)) : null;
    try { st.ao = buildAo(meshes, { clip, ...(preset.ao || {}) }); } catch (e) { st.ao = 'failed: ' + e.message; }
    if (!A) return st;
    const X = [A.x[0] + gx, A.x[1] + gx], Zr = [A.z[0] + gz, A.z[1] + gz], top = (A.ceil ?? 6) - .2, kD = O.decals ?? 1, kS = O.sprites ?? 1;
    const inArea = (x, z) => x > X[0] && x < X[1] && z > Zr[0] && z < Zr[1];
    const lane = (x, z) => preset.lane ? preset.lane(x - gx, z - gz) : false;
    // (b) floor decals: cast down from under the ceiling at random points
    const DL = [], dz = preset.decals || {};
    const fCells = dz.floorCells || [0, 1, 2, 4, 12, 0, 1, 3], wCells = dz.wallCells || [1, 10, 15, 9, 0], fMax = A.floorMax ?? 99, FZ = dz.band ? [dz.band[0] + gz, dz.band[1] + gz] : Zr, fz = () => FZ[0] + R() * (FZ[1] - FZ[0]);   // band: floor decals only in a z strip (the town street)
    for (let k = 0, tries = 0; k < Math.round((dz.floor ?? 40) * kD) && tries < Math.max(600, (dz.floor ?? 40) * kD * 5); tries++) { const x = X[0] + R() * (X[1] - X[0]), z = fz();
      const h = hit([x, top, z], [0, -1, 0], top + 2); if (!h || h.n.y < .8 || h.p.y > fMax) continue; const cell = fCells[Math.floor(R() * fCells.length)], s = (.9 + R() * 1.7) * (dz.floorSize ?? 1);
      // round 2: bigger (a y .25 camera sees floors at a grazing angle, small decals vanish) and stronger
      DL.push({ cell, pos: h.p, n: h.n, spin: R() * 6.28, size: [s, s], alpha: (cell === 0 || cell === 12 ? .6 : .9) * (.75 + R() * .25) }); k++; }
    // round 2: ceiling decals (water stains, vents, grime, dust), cast up from eye height
    for (let k = 0, tries = 0; k < Math.round((dz.ceil ?? 0) * kD) && tries < 600; tries++) { const x = X[0] + R() * (X[1] - X[0]), z = Zr[0] + R() * (Zr[1] - Zr[0]);
      const h = hit([x, A.y ?? 1.2, z], [0, 1, 0], top + 2); if (!h || h.n.y > -.8) continue; const cells = dz.ceilCells || [18, 19, 12, 18, 19], cell = cells[Math.floor(R() * cells.length)], s = .7 + R() * 1.4;
      DL.push({ cell, pos: h.p, n: h.n, spin: cell === 18 ? 0 : R() * 6.28, size: cell === 18 ? [s * .8, s * .55] : [s * .8, s * .8], alpha: cell === 18 ? 1 : .3 + R() * .25 }); k++; }
    // wall decals: horizontal rays from inside the room toward the sides; also the wall-foot dirt strip right at the floor
    const eye = A.y ?? 1.2, cx = (X[0] + X[1]) / 2, cz = (Zr[0] + Zr[1]) / 2, wallHits = [];
    for (let k = 0, tries = 0; k < Math.round((dz.wall ?? 30) * kD) && tries < Math.max(600, (dz.wall ?? 30) * kD * 8); tries++) { const ang = R() * 6.283, o = [X[0] + R() * (X[1] - X[0]), .25 + R() * (eye * 1.6), Zr[0] + R() * (Zr[1] - Zr[0])];
      const h = hit(o, [Math.cos(ang), 0, Math.sin(ang)], 14); if (!h || Math.abs(h.n.y) > .3 || h.d < .3) continue; wallHits.push(h);
      if (/chair|seat|desk|table|sofa|couch|bed|board|chalk|screen|tv|glass|window|cushion|pillow|book|fridge|stove|oven/.test(h.key) && h.p.y > .5) continue;   // round 2: no papers / stickers on furniture faces
      const cell = h.p.y < .5 ? 10 : wCells[Math.floor(R() * wCells.length)], s = cell === 10 ? .9 + R() * .8 : .6 + R() * 1.0;
      DL.push({ cell, pos: h.p.clone().setY(cell === 10 ? Math.max(h.p.y, s / 2) : h.p.y), n: h.n, spin: cell === 10 || cell === 9 ? 0 : (R() - .5) * .6, size: [s, cell === 9 ? s * 1.4 : s], alpha: .7 + R() * .3 }); k++; }
    for (const [cell, n, sz] of dz.extra || []) for (let k = 0, tries = 0; k < Math.round(n * kD) && tries < Math.max(300, n * kD * 8); tries++) { const x = X[0] + R() * (X[1] - X[0]), z = fz();
      const h = hit([x, top, z], [0, -1, 0], top + 2); if (!h || h.n.y < .8 || h.p.y > fMax || (dz.extraOn && !dz.extraOn.test(h.key))) continue; const s = sz * (.7 + R() * .6); DL.push({ cell, pos: h.p, n: h.n, spin: R() * 6.28, size: [s, s], alpha: .85 }); k++; }
    st.decals = DL.length; decals(DL);
    // (a) sprites
    const defs = await loadSpriteDefs(THREE, SPRITE_DIR); const byName = Object.fromEntries(defs.map(d => [d.name, d])); const items = [], S = preset.sprites || {};
    const clearAt = (p, w, h, face) => {   // nothing of the set inside the card's box (rays across it at three heights, both diagonals)
      for (const fy of [.25, .6, .92]) { const y = p.y + h * fy; for (const [dx, dz2] of [[1, 0], [0, 1], [.7, .7], [.7, -.7]]) { const o = [p.x - dx * w * .5, y, p.z - dz2 * w * .5]; const hh = hit(o, [dx, 0, dz2], w); if (hh) return false; } }
      const up = hit([p.x, p.y + .05, p.z], [0, 1, 0], h); return !up; };
    const pick = list => list[Math.floor(R() * list.length)];
    const place1 = (names, n, mode) => { let k = 0;
      for (let tries = 0; k < Math.round(n * kS) && tries < n * 40; tries++) {
        const name = pick(names), d = byName[name]; if (!d) continue;
        let base, face = null;
        let anchor, maxH;
        if (mode === 'wall') { const h = wallHits[Math.floor(R() * wallHits.length)] || hit([cx, eye, cz], [Math.cos(R() * 6.28), 0, Math.sin(R() * 6.28)], 14);
          // round 2: any flat vertical face takes a card (walls, lockers, cabinets, doors), not only the plaster: the probe below still asks for one flat face under the whole card
          if (!h || /glass|sky|window|floor|ceil|tbar|light|panel|lamp|emit|screen|tv|chair|seat|desk|table|sofa|couch|bed|cushion|pillow|board|chalk/.test(h.key)) continue;
          const y = (d.y ?? (d.h > 1.2 ? .05 : 1.0 + R() * 1.1)); const p = h.p.clone().addScaledVector(h.n, .06); p.y = y; if (p.y + d.h > top - .1) continue;
          let ok = true; for (const [a, b] of [[-.45, .1], [.45, .1], [-.45, .9], [.45, .9], [0, .5]]) { const s = new THREE.Vector3(-h.n.z, 0, h.n.x).multiplyScalar(a * d.w); const o = p.clone().add(s).addScaledVector(h.n, .4); o.y = y + b * d.h;
            const q = hit([o.x, o.y, o.z], [-h.n.x, 0, -h.n.z], .9); if (!q || q.n.dot(h.n) < .97 || Math.abs(q.d - .46) > .05) { ok = false; break; } }
          // opts.wallFlat (rbx love V4 polish, 2026-11-13, opt-in): a wall card may turn toward the camera only as far as its edge stays
          // in front of the wall (it sits .06 D off it): at .75 a 1 D card turned 41 deg and the wall cut it diagonally, or hid it whole
          // for a frame at grazing angles (love f989, the bedroom picture "popping in"). Default (no opt) = exactly as before.
          const wc = O.wallFlat ? Math.max(.75, Math.sqrt(1 - Math.min(1, .05 / (d.w * .5)) ** 2)) : .75;
          if (!ok || nearMark(p.x, p.z, .2)) continue; base = p; face = [h.n.x, h.n.z, wc];
        } else if (mode === 'grass' || mode === 'tree') { const x = X[0] + R() * (X[1] - X[0]), z = Zr[0] + R() * (Zr[1] - Zr[0]); const h = hit([x, top, z], [0, -1, 0], top + 2); if (!h || h.n.y < .8 || !/grass|k_grass|lawn|terrain|dirt|soil|bed/.test(h.key)) continue; base = h.p;
        } else if (mode === 'scatter') { // round 2: floor cards anywhere off the lanes (the camera's view lanes get clutter, not only the wall feet)
          const x = X[0] + R() * (X[1] - X[0]), z = Zr[0] + R() * (Zr[1] - Zr[0]); const h = hit([x, top, z], [0, -1, 0], top + 2); if (!h || h.n.y < .85 || h.p.y > (A.floorMax ?? .12) || /grass|road|asphalt/.test(h.key)) continue; base = h.p;
        } else if (mode === 'hang') { // round 2: hanging things under the ceiling (lamps, lanterns, plants, mobiles), top touching the ceiling, bottom above head height
          const x = X[0] + R() * (X[1] - X[0]), z = Zr[0] + R() * (Zr[1] - Zr[0]); const h = hit([x, eye, z], [0, 1, 0], top + 2); if (!h || h.n.y > -.8) continue;
          maxH = Math.min(d.h, h.p.y - .03 - (A.headroom ?? 3.3)); if (maxH < .5) continue; const sc = maxH / d.h;
          const bot = new THREE.Vector3(x, h.p.y - .03 - maxH, z); if (!inArea(x, z) || nearMark(x, z, -.6) || !clearAt(bot, d.w * sc, maxH - .08)) continue;
          if (items.some(it => Math.hypot(it.p[0] - x, it.p[2] - z) < (it.r + d.w * sc * .5 + .3))) continue;
          items.push({ name, p: [x, h.p.y - .03, z], anchor: 1, maxH, flip: R() < .5 ? 1 : -1, r: d.w * sc * .5, hang: true }); k++; continue;
        } else { // floor (against a wall) or top (a furniture top)
          const w0 = wallHits[Math.floor(R() * wallHits.length)]; if (!w0) continue; const back = mode === 'top' ? .3 + R() * .5 : d.w * .5 + .08 + R() * .25;
          const o = w0.p.clone().addScaledVector(w0.n, back); const h = hit([o.x, mode === 'top' ? Math.min(top, 1.6) : top, o.z], [0, -1, 0], top + 2); if (!h || h.n.y < .85) continue;
          if (mode === 'top' ? (h.p.y < .35 || h.p.y > 1.4 || /floor|carpet|rug|grass|road|sidewalk/.test(h.key)) : h.p.y > .12) continue;
          base = h.p; face = [w0.n.x, w0.n.z, .15]; }
        if (!inArea(base.x, base.z) || lane(base.x, base.z) || nearMark(base.x, base.z) || (mode !== 'wall' && !clearAt(base, d.w, d.h, face))) continue;
        if (items.some(it => Math.hypot(it.p[0] - base.x, it.p[2] - base.z) < (it.r + d.w * .5) && Math.abs(it.p[1] - base.y) < 1)) continue;
        items.push({ name, p: [base.x, base.y + (mode === 'wall' ? 0 : .004), base.z], face, flip: R() < .5 ? 1 : -1, r: d.w * .5 }); k++; }
      return k; };
    st.sprites = {}; for (const mode of ['tree', 'wall', 'hang', 'top', 'floor', 'scatter', 'grass']) if (S[mode]?.length) st.sprites[mode] = place1(S[mode], S.n?.[mode] ?? 8, mode);
    // hanging pictures are drawn like the rest (full colour; rigkit greys its 'hang' kind), their anchor is set per item
    const defs2 = defs.map(d => d.kind === 'hang' ? { ...d, kind: 'floor' } : d);
    if (items.length) { kit.sprites(place, defs2, items, { tint: night ? [.92, .92, 1] : [1.06, 1.05, 1.03], desat: 0 });
      // a soft contact blob under each standing card (floor / top), the cartoon films' trick
      const CB = items.filter(i => !i.hang && (!i.face || i.face[2] < .5)).map(i => ({ cell: 0, pos: new THREE.Vector3(...i.p), n: new THREE.Vector3(0, 1, 0), spin: 0, size: [byName[i.name].w * .9, byName[i.name].w * .5], alpha: .5 }));
      decals(CB); }
    st.ms = Math.round(performance.now() - t0); console.log('rbx dress: ' + JSON.stringify(st));
    // the item list for the sheet tool's per-camera count (roblox-style/v4/tools/envmeasure.py): [x, y, z, size, kind] in world D
    if (O.log !== false) { const r2 = v => Math.round(v * 100) / 100;
      console.log('rbx dress items: ' + JSON.stringify([...DL.map(d => [r2(d.pos.x), r2(d.pos.y), r2(d.pos.z), r2(Math.max(...d.size)), 'd']),
        ...items.map(i => { const b = byName[i.name], h = i.maxH ? Math.min(b.h, i.maxH) : b.h, w = b.w * h / b.h; return [r2(i.p[0]), r2(i.hang ? i.p[1] - h / 2 : i.p[1] + h / 2), r2(i.p[2]), r2(Math.max(w, h)), 's']; })])); }
    return st; };

  return { patch, wrap, finish, decals, statics, hit, U, off };
}
// ---- what each kit gets (kit-local coordinates). A new set: an area (floor rectangle + ceiling height), a lane test, picture lists.
const SCHOOL_FLOOR = ['school-backpack', 'school-stack-of-textbooks', 'school-basketball', 'office-a-paper-pile', 'office-a-trash-bin-office', 'home-small-cardboard-box-closed', 'office-a-office-plant', 'sports-football', 'street-c-crushed-can', 'kitchenware-bucket-metal'];
const SCHOOL_TOP = ['school-stack-of-textbooks', 'home-small-mug', 'office-b-stack-of-folders', 'school-globe-on-stand', 'home-small-alarm-clock', 'school-microscope', 'home-small-open-book', 'home-small-vase-with-flowers'];
const SCHOOL_WALL = ['build-wall-a-blank-poster-torn-edges', 'build-wall-a-cork-board-with-blank-notes', 'build-wall-b-fire-extinguisher-on-wall', 'build-wall-b-light-switch-and-outlet', 'build-wall-b-wall-vent-grille', 'build-wall-a-wall-calendar-blank', 'build-wall-b-world-map-poster-no-text', 'build-wall-a-abstract-poster-no-text', 'build-wall-b-electric-panel-box'];
const HOME_FLOOR = ['home-bedroom-pile-of-clothes', 'home-bedroom-teddy-bear', 'home-bedroom-laundry-basket', 'home-bedroom-toy-box', 'home-living-potted-house-plant-tall', 'sports-skateboard', 'sports-football', 'home-small-cardboard-box-closed', 'home-small-umbrella-stand', 'home-living-rug-rolled', 'home-kitchen-trash-bin-with-pedal'];
const HOME_TOP = ['home-small-vase-with-flowers', 'home-small-stack-of-books', 'home-small-mug', 'home-small-table-lamp', 'home-small-candle-holder', 'home-small-alarm-clock', 'kitchenware-stack-of-plates', 'kitchenware-spice-jars-group', 'kitchenware-teapot', 'food-apple-basket', 'home-small-open-book'];
const HOME_WALL = ['build-wall-a-small-framed-photo', 'build-wall-a-framed-landscape-painting', 'build-wall-a-wall-shelf-with-plants', 'build-wall-a-coat-hooks-with-coats', 'build-wall-b-light-switch-and-outlet', 'build-wall-a-wall-calendar-blank', 'build-wall-a-wooden-wall-shelf-with-books', 'build-wall-a-abstract-poster-no-text'];
const TOWN_FLOOR = ['street-a-traffic-cone', 'street-a-fire-hydrant', 'street-c-cardboard-boxes-pile', 'street-c-trash-bags-pile', 'street-c-overflowing-trash-can', 'fol-bushes-a-small-young-bush', 'fol-grass-grass-growing-through-crack', 'fol-grass-weeds-with-dandelions', 'street-c-crushed-can', 'fol-flowers-marigolds'];
const TOWN_GRASS = ['fol-bushes-a-round-leafy-bush', 'fol-bushes-a-small-young-bush', 'fol-flowers-tulip-cluster', 'fol-flowers-daisy-patch', 'fol-grass-weeds-with-dandelions', 'fol-grass-short-grass-tuft', 'fol-grass-tall-grass-tuft', 'fol-flowers-wildflower-patch-mixed-colours', 'fol-grass-clover-patch', 'fol-bushes-b-hydrangea-bush-with-blue-flowers', 'fol-grass-wide-grass-clump', 'fol-flowers-marigolds'];
// round 2 (2026-11-12): more pictures per family, hanging things, depth trees, wall plants
SCHOOL_FLOOR.push('office-b-boxes-of-files', 'sports-tennis-racket-and-balls', 'home-bath-small-bin', 'farm-b-flower-pot-terracotta', 'shop-a-shopping-basket');
SCHOOL_WALL.push('build-wall-a-round-wall-clock', 'build-wall-a-framed-portrait-painting', 'build-wall-a-small-framed-photo', 'build-wall-a-wall-shelf-with-plants');
HOME_FLOOR.push('home-living-floor-lamp', 'home-living-bean-bag', 'farm-b-big-plant-pot-with-shrub', 'home-bath-small-bin', 'shop-a-shopping-basket', 'office-b-boxes-of-files');
HOME_WALL.push('build-wall-a-round-wall-clock', 'build-wall-a-framed-portrait-painting', 'build-wall-a-wall-mirror', 'fol-wall-plants-small-ivy-sprig');
TOWN_FLOOR.push('street-a-mailbox-blue', 'street-a-park-bench', 'street-b-bike-rack-with-bike', 'street-a-newspaper-box-no-text', 'farm-b-flower-pot-terracotta', 'farm-b-big-plant-pot-with-shrub', 'shop-a-flower-stall-buckets', 'fol-bushes-a-boxwood-ball');
TOWN_GRASS.push('fol-bushes-a-flowering-bush-with-white-blossoms', 'fol-bushes-b-rhododendron-with-pink-flowers', 'fol-bushes-a-boxwood-ball', 'fol-bushes-b-gorse-bush-with-yellow-flowers',
  'fol-flowers-red-poppies', 'fol-flowers-lavender-bush', 'fol-flowers-rose-bush', 'fol-flowers-bluebells', 'fol-flowers-sunflower', 'fol-grass-grass-with-small-white-flowers');
const SCHOOL_HANG = ['home-hang-paper-lantern', 'home-hang-hanging-plant-in-macrame', 'home-hang-hanging-mobile-toy', 'outdoor-hang-bunting-flags', 'home-hang-string-lights'];
const HOME_HANG = ['home-hang-hanging-plant-in-macrame', 'home-hang-hanging-pendant-lamp', 'home-hang-paper-lantern', 'home-hang-string-lights', 'home-hang-hanging-mobile-toy'];
const TOWN_WALL = ['fol-wall-plants-ivy-patch-on-wall', 'fol-wall-plants-climbing-rose-on-wall', 'fol-wall-plants-wall-flowers-climbing', 'fol-wall-plants-moss-patch', 'fol-wall-plants-small-ivy-sprig',
  'build-parts-air-conditioner-unit', 'build-parts-wall-lamp', 'build-wall-a-blank-poster-torn-edges', 'build-wall-b-electric-panel-box', 'outdoor-hang-hanging-flower-basket'];
const TOWN_TREE = ['fol-trees-a-round-lollipop-street-tree', 'fol-trees-a-maple-tree', 'fol-trees-a-oak-tree', 'fol-trees-a-birch-tree', 'fol-trees-b-cherry-blossom-tree', 'fol-trees-a-apple-tree-with-apples',
  'fol-trees-a-cypress', 'fol-trees-b-small-fruit-tree'];
const SCHOOL_WALLCELLS = [1, 10, 15, 9, 0, 24, 11, 24, 8, 11];
export const PRESETS = {
  hallway: () => ({ seed: 41, area: { x: [-3.6, 3.6], z: [-38, 10], ceil: 5.6, y: 1.3, headroom: 3.4 }, lane: (x) => Math.abs(x) < 1.35, ao: { cell: .18, k: .6 },
    decals: { floor: 170, wall: 120, ceil: 40, wallCells: SCHOOL_WALLCELLS, floorCells: [0, 1, 2, 4, 12, 3, 22, 1, 5],
      extra: [[DECAL.paper, 16, .6], [DECAL.gum, 18, .55], [DECAL.crack, 8, 1.1], [DECAL.puddle, 3, 1.3], [DECAL.steps, 8, 1.0], [DECAL.litter, 14, .45], [DECAL.bigcrack, 6, 1.6]] },
    sprites: { floor: SCHOOL_FLOOR, scatter: SCHOOL_FLOOR, top: SCHOOL_TOP, wall: SCHOOL_WALL, hang: SCHOOL_HANG, n: { floor: 22, scatter: 6, top: 8, wall: 24, hang: 10 } } }),
  classroom: () => ({ seed: 43, area: { x: [-9, 9], z: [-8, 8], ceil: 5.6, y: 1.3, headroom: 3.4 }, lane: (x, z) => Math.abs(x) < 1.0 && z > -5, ao: { cell: .18, k: .6 },
    decals: { floor: 120, wall: 90, ceil: 30, wallCells: SCHOOL_WALLCELLS, floorCells: [0, 1, 2, 4, 12, 3, 5],
      extra: [[DECAL.paper, 14, .6], [DECAL.gum, 8, .55], [DECAL.crack, 4, 1.0], [DECAL.litter, 10, .45]] },
    sprites: { floor: SCHOOL_FLOOR, scatter: SCHOOL_FLOOR, top: SCHOOL_TOP, wall: SCHOOL_WALL, hang: SCHOOL_HANG, n: { floor: 16, scatter: 8, top: 16, wall: 18, hang: 8 } } }),
  home: (R) => { const [W2, ZB, ZF, CEIL] = R.box; return { seed: 47, area: { x: [-W2, W2], z: [ZB, ZF], ceil: CEIL ?? 5, y: 1.2, headroom: 3.2 }, ao: { cell: .16, k: .6 },
    decals: { floor: 80, wall: 70, ceil: 14, floorCells: [0, 2, 12, 1, 0, 15], wallCells: [1, 15, 10, 0, 24, 11], ceilCells: [19, 12, 19],
      extra: [[DECAL.paper, 6, .5], [DECAL.stain, 4, 1.0], [DECAL.litter, 6, .4]] },
    sprites: { floor: HOME_FLOOR, scatter: HOME_FLOOR, top: HOME_TOP, wall: HOME_WALL, hang: HOME_HANG, n: { floor: 14, scatter: 5, top: 16, wall: 16, hang: 4 } } }; },
  // the town strip runs along x past several zones: the dress covers the zone and its neighbours (+-95), cards stop at the sidewalks
  town: (ax, az) => ({ seed: 53, area: { x: [ax - 95, ax + 95], z: [az - 30, az + 14], ceil: 14, y: 1.3, floorMax: .6 }, ao: { cell: .3, k: .55 },
    decals: { floor: 1100, wall: 200, band: [az - 14, az + 12], floorCells: [0, 3, 13, 12, 6, 14, 1, 4, 16, 17, 22, 23, 7, 20, 21, 6], wallCells: [9, 10, 1, 15, 0, 24, 14],
      extra: [[DECAL.leaves, 60, .8], [DECAL.puddle, 16, 1.9], [DECAL.crack, 30, 1.4], [DECAL.moss, 20, 1.1], [DECAL.manhole, 16, 1.5], [DECAL.chalk, 14, 2.0], [DECAL.bigcrack, 24, 2.0], [DECAL.petals, 16, 1.2], [DECAL.litter, 20, 1.0]] },
    sprites: { tree: TOWN_TREE, wall: TOWN_WALL, floor: TOWN_FLOOR, scatter: TOWN_FLOOR, grass: TOWN_GRASS, n: { tree: 40, wall: 40, floor: 40, scatter: 30, grass: 170 } } }),
};
export default { createDress, DECAL, PRESETS };
