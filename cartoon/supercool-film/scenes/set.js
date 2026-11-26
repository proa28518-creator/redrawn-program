// scenes/set.js — the film's own set (film.js: world: { set: 'own' }). Three places, 400 D apart
// (references/sets.md), so one place's light and clutter never leaks into another:
//   kitchen  (origin)   — the kit 'kitchen' base (world/sets.js) + this film's upright freezer in the
//                         corner with its door ajar (from line 8), a ceiling pendant, counter dressing.
//   freezer  (x +400)   — the INSIDE of that freezer: shelves of frozen packs under its own lamp,
//                         framed by the open door; beat 3's reveal (line 16).
//   inside   (x -400)   — INSIDE THE BOTTLE, macro: a glass water column 9 D across, 30 D tall. The
//                         white front and the crystal growth are driven by world.setOpts.frontKeys =
//                         [[t, heightInD], ...] passed from film.js, interpolated in update() (pure in t).
// Lights are data (PLACES, world/look/lights.js — positions are world, so each place's lights carry its
// 400 D offset): the rig is returned on the set object for the post/shading passes to read; previz
// geometry shades with the engine's flat() and the practicals below are visible emissive meshes.
import { createLightRig } from '../world/look/lights.js';
import { createPost } from '../world/look/post.js';
import { createRigShade } from '../world/look/rigshade.js';
import { flat } from '../lib/film/props.js';
import { outline } from '../engine/shade.js';

const PLACES = {
  kitchen: {
    sky: [.95, .9, .8], ground: [.45, .4, .34], fog: { color: '#e8dcc6', density: .012 },
    lights: [
      { id: 'sun', kind: 'sun', color: [1, .93, .8], power: 1.1, dir: [-.45, .8, .4], wrap: .25 },
      { id: 'pendant', kind: 'point', color: [1, .8, .55], power: .8, pos: [.2, 3.2, 1.2], fall: .08, range: 12 },
      { id: 'spill', kind: 'point', color: [.62, .8, 1], power: .7, pos: [-5.4, 1.6, -1.6], fall: .1, range: 7 },
    ],
  },
  freezer: {
    sky: [.75, .85, 1], ground: [.4, .5, .62], fog: { color: '#cfe2f2', density: .05 },
    lights: [
      { id: 'lamp', kind: 'point', color: [.9, .97, 1], power: 1, pos: [400, 3, 0], fall: .06, range: 9 },
      { id: 'glow', kind: 'point', color: [.45, .65, 1], power: .8, pos: [400, 2.2, -1.2], fall: .08, range: 8 },
      { id: 'door', kind: 'point', color: [1, .85, .6], power: .6, pos: [400, 1.8, 3.5], fall: .06, range: 10 },
    ],
  },
  inside: {
    sky: [.1, .3, .42], ground: [.02, .08, .12], fog: { color: '#0a2e40', density: .028 },
    lights: [
      { id: 'shaft', kind: 'spot', color: [.85, .95, 1], power: 1.4, pos: [-401.5, 29, -1], dir: [.15, -1, .05], cone: [18, 42], fall: .02, range: 40 },
      { id: 'frontglow', kind: 'point', color: [.9, .97, 1], power: .5, pos: [-400, 6, 0], fall: .03, range: 16 },
    ],
  },
};

function part(THREE, geo, mat, ink = .03) {
  const m = new THREE.Mesh(geo, mat);
  if (ink > 0) outline(m, { width: ink, color: 0x3a2a33 });
  m.frustumCulled = false;
  return m;
}
function box(THREE, w, h, d, color, dark, x, y, z, ry = 0, ink = .03) {
  const m = part(THREE, new THREE.BoxGeometry(w, h, d), flat(color, dark), ink);
  m.position.set(x, y, z); m.rotation.y = ry; return m;
}
function glow(THREE, w, h, d, color, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color }));
  m.position.set(x, y, z); m.rotation.y = ry; m.frustumCulled = false; return m;
}

export function buildSet(THREE, scene, opts = {}, kit) {
  const base = kit('kitchen', {});
  const g = base.group;
  const points = { ...(base.points || {}) };

  // — the upright freezer, kitchen corner (x -5.6, z -2.35), door ajar from line 8 —
  const freezerUnit = new THREE.Group();
  freezerUnit.add(box(THREE, 1.15, 3.0, 1.05, '#e3ebee', '#b9c8ce', 0, 1.5, 0));
  freezerUnit.add(box(THREE, .95, 2.7, .05, '#cfe9f7', '#a9cade', 0, 1.5, .5));            // the cold inside face
  const doorPivot = new THREE.Group(); doorPivot.position.set(-.55, 0, .55); doorPivot.rotation.y = -1.15;
  const doorSlab = box(THREE, 1.08, 2.9, .07, '#e3ebee', '#b9c8ce', .54, 1.48, 0);
  doorPivot.add(doorSlab); freezerUnit.add(doorPivot);
  freezerUnit.add(glow(THREE, .07, .03, .02, 0x59ff8d, .32, 2.78, .54));                  // the green LED
  // — the open interior: a rim, three stocked shelves with frost-capped packs, a glow panel —
  [[-.5, 1.5], [.5, 1.5]].forEach(([x, y]) => freezerUnit.add(box(THREE, .07, 3.0, .3, '#b9c8ce', '#8fa5ae', x, y, .6)));
  freezerUnit.add(box(THREE, 1.05, .07, .3, '#b9c8ce', '#8fa5ae', 0, 2.98, .6));
  const fzGlow = new THREE.Mesh(new THREE.BoxGeometry(.8, .1, .04), new THREE.MeshBasicMaterial({ color: 0xcfeaff }));
  fzGlow.position.set(0, 2.8, .58); freezerUnit.add(fzGlow);
  [.75, 1.45, 2.15].forEach((sy, si) => {
    freezerUnit.add(box(THREE, .95, .04, .34, '#a9cade', '#7fa8c4', 0, sy, .6));
    for (let i = 0; i < 4; i++) {
      const pk = box(THREE, .18, .26 + (i % 2) * .08, .2, ['#7fb2d9', '#a8d8b9', '#e8e3d5', '#d98f7f'][(i + si) % 4], '#5d7d99', -.36 + i * .24, sy + .17, .6, (i % 3 - 1) * .08, .012);
      freezerUnit.add(pk);
      const frost = part(THREE, new THREE.SphereGeometry(.09, 8, 6), flat('#eef7fc', '#c8dde9'), .01);
      frost.scale.y = .45; frost.position.set(-.36 + i * .24, sy + .33 + (i % 2) * .08, .6); freezerUnit.add(frost);
    }
  });
  freezerUnit.position.set(-5.6, 0, -2.35); freezerUnit.name = 'freezer';
  g.add(freezerUnit); points.freezerUnit = freezerUnit;

  // — the ceiling pendant over the table end of the room (practical) —
  const pendant = new THREE.Group();
  pendant.add(box(THREE, .03, .8, .03, '#37424a', '#232a30', 0, -.4, 0, 0, 0));
  const shade = part(THREE, new THREE.CylinderGeometry(.12, .42, .35, 20, 1, true), flat('#37424a', '#232a30'), .02);
  shade.position.y = -.95; pendant.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.17, 14, 12), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  bulb.position.y = -1.06; pendant.add(bulb);
  pendant.position.set(.2, 3.75, 1.2); g.add(pendant);

  // — the pantry nook: a free-standing open cupboard on the left wall, its lit interior the far end
  //    behind the hero in the along-room shots (frame, 3 stocked shelves, a warm lamp, door slab open) —
  const nook = new THREE.Group();
  nook.add(box(THREE, .12, 3.4, 2.6, '#8a5a3a', '#5d3d24', -.85, 1.7, 0));
  nook.add(box(THREE, .12, 3.4, 2.6, '#8a5a3a', '#5d3d24', .85, 1.7, 0));
  nook.add(box(THREE, 1.82, .12, 2.6, '#8a5a3a', '#5d3d24', 0, 3.42, 0));
  nook.add(box(THREE, 1.7, 3.3, .08, '#6e4527', '#4c2f18', 0, 1.68, -1.28, 0, .015));
  [.75, 1.5, 2.25].forEach(sy => nook.add(box(THREE, 1.6, .05, 2.3, '#a8784c', '#77542f', 0, sy, -.1, 0, .012)));
  [['#d9a441', .88, -.6], ['#b5533c', .88, .1], ['#7d9b57', .88, .7], ['#a9b2b8', 1.63, -.4], ['#c23b2e', 1.63, .35], ['#7d9b57', 2.38, -.55], ['#d9a441', 2.38, .2], ['#b5533c', 2.38, .75]].forEach(([c, sy, sz]) => {
    const jar = part(THREE, new THREE.CylinderGeometry(.11, .11, .3, 10), flat(c, '#5d5142'), .012);
    jar.position.set(0, sy, sz); nook.add(jar);
  });
  const nookLamp = new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffc98a }));
  nookLamp.position.set(0, 3.05, .6); nook.add(nookLamp);
  nook.add(box(THREE, .07, 2.9, 1.05, '#8a5a3a', '#5d3d24', -1.15, 1.5, 1.05, -.7));
  nook.rotation.y = Math.PI / 2; nook.position.set(-6.55, 0, 2.4); g.add(nook);
  // — a second pendant over the counter —
  const pendant2 = new THREE.Group();
  pendant2.add(box(THREE, .03, .8, .03, '#37424a', '#232a30', 0, -.4, 0, 0, 0));
  const shade2 = part(THREE, new THREE.CylinderGeometry(.12, .42, .35, 20, 1, true), flat('#37424a', '#232a30'), .02);
  shade2.position.y = -.95; pendant2.add(shade2);
  const bulb2 = new THREE.Mesh(new THREE.SphereGeometry(.17, 14, 12), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  bulb2.position.y = -1.06; pendant2.add(bulb2);
  pendant2.position.set(3.6, 3.75, -1.6); g.add(pendant2);

  // — the window's outside, drawn on the glass: a dusk gradient card + distant lit windows + a street lamp —
  const winCard = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 2.1), new THREE.MeshBasicMaterial({ color: 0x39506e }));
  winCard.position.set(3.4, 2.32, -2.78); g.add(winCard);
  const winGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.1, .9), new THREE.MeshBasicMaterial({ color: 0xcf8a4e }));
  winGlow.position.set(3.4, 1.85, -2.77); g.add(winGlow);
  [[2.6, 2.75], [4.25, 2.6]].forEach(([x, y]) => { const lw = new THREE.Mesh(new THREE.PlaneGeometry(.34, .26), new THREE.MeshBasicMaterial({ color: 0xffd9a0 })); lw.position.set(x, y, -2.76); g.add(lw); });
  const streetLamp = new THREE.Mesh(new THREE.CircleGeometry(.11, 14), new THREE.MeshBasicMaterial({ color: 0xffe6b8 }));
  streetLamp.position.set(3.95, 2.2, -2.76); g.add(streetLamp);
  // — a lit counter lamp near the stove (the second practical) —
  const lampArm = box(THREE, .05, .5, .05, '#37424a', '#232a30', 5.9, 1.5, -2.5, 0, .015); g.add(lampArm);
  const lampGlow = new THREE.Mesh(new THREE.SphereGeometry(.11, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  lampGlow.position.set(5.9, 1.82, -2.5); g.add(lampGlow);
  // — a tall shelf on the left wall: layered dressing for the along-room shots —
  [[.9], [1.55], [2.2]].forEach(([sy]) => { const sh = box(THREE, .34, .05, 1.7, '#8a5a3a', '#5d3d24', -6.75, sy, .6, 0, .015); g.add(sh); });
  [['#d9a441', 1.02], ['#b5533c', 1.02], ['#7d9b57', 1.67], ['#a9b2b8', 1.67], ['#c23b2e', 2.32], ['#7d9b57', 2.32]].forEach(([c, sy], i) => {
    const jar = part(THREE, new THREE.CylinderGeometry(.09, .09, .26, 10), flat(c, '#5d5142'), .012);
    jar.position.set(-6.75, sy, .05 + (i % 3) * .5); g.add(jar);
  });

  // — the door-zone dressing (the front cameras' on-axis backdrop): a lit wall lantern by the door,
  //    a potted plant by the freezer, a bright poster in the fridge/door gap, a shelf over the fridge —
  const lantShade = part(THREE, new THREE.CylinderGeometry(.13, .24, .26, 14, 1, true), flat('#37424a', '#232a30'), .015);
  lantShade.position.set(-4.2, 2.72, -2.8); g.add(lantShade);
  const lantBulb = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  lantBulb.position.set(-4.2, 2.6, -2.78); g.add(lantBulb);
  const pot = part(THREE, new THREE.CylinderGeometry(.26, .19, .34, 12), flat('#b5533c', '#7c3826'));
  pot.position.set(-4.55, .17, -2.2); g.add(pot);
  [[-4.55, .78, -2.2, .5], [-4.75, .62, -2.05, .38], [-4.35, .66, -2.35, .4]].forEach(([x, y, z, r]) => {
    const leaf = part(THREE, new THREE.SphereGeometry(r, 10, 8), flat('#5d8a48', '#3c5c2e'), .015);
    leaf.position.set(x, y, z); g.add(leaf);
  });
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(.85, 1.15), new THREE.MeshBasicMaterial({ color: 0x3e6fb0 }));
  poster.position.set(-3.85, 2.5, -2.86); g.add(poster);
  const posterSun = new THREE.Mesh(new THREE.CircleGeometry(.2, 16), new THREE.MeshBasicMaterial({ color: 0xffd76a }));
  posterSun.position.set(-3.85, 2.72, -2.85); g.add(posterSun);
  const posterWave = new THREE.Mesh(new THREE.PlaneGeometry(.85, .3), new THREE.MeshBasicMaterial({ color: 0xe8f4fa }));
  posterWave.position.set(-3.85, 2.12, -2.85); g.add(posterWave);
  const topShelf = box(THREE, 1.7, .05, .6, '#8a5a3a', '#5d3d24', -2.6, 3.85, -2.5, 0, .015); g.add(topShelf);
  const topBox = box(THREE, .5, .34, .45, '#d9a441', '#a87c2c', -2.95, 4.05, -2.5, .1, .015); g.add(topBox);
  const topPlant = part(THREE, new THREE.SphereGeometry(.24, 10, 8), flat('#5d8a48', '#3c5c2e'), .015);
  topPlant.position.set(-2.2, 4.08, -2.5); g.add(topPlant);

  // — ENVIRONMENT PASS dressing: a rug under the table, ceiling beams, a wall clock on the
  //    left wall, framed pictures on the back wall, a utensil rail over the counter —
  [[.32, 0], [.78, .12]].forEach(([y, ry]) => { const crate = box(THREE, .62, .42, .5, '#8a5a3a', '#5d3d24', -4.15, y, -2.45, ry, .015); g.add(crate); });
  [-4.32, -4.12, -3.92].forEach((x, i) => { const jar = part(THREE, new THREE.CylinderGeometry(.07, .07, .22, 10), flat(['#c96f4a', '#7fae5c', '#d9a441'][i], '#5d666f'), .012); jar.position.set(x, 1.1, -2.45); g.add(jar); });
  const crateLampShade = part(THREE, new THREE.CylinderGeometry(.09, .17, .18, 12, 1, true), flat('#37424a', '#232a30'), .012);
  crateLampShade.position.set(-4.15, 1.32, -2.45); g.add(crateLampShade);
  const crateLampBulb = new THREE.Mesh(new THREE.SphereGeometry(.085, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  crateLampBulb.position.set(-4.15, 1.24, -2.45); g.add(crateLampBulb);
  [-4.55, -4.15, -3.75].forEach(x => {
    const potH = part(THREE, new THREE.CylinderGeometry(.09, .07, .14, 10), flat('#b5533c', '#7c3826'), .012);
    potH.position.set(x, 2.28, -2.8); g.add(potH);
    const herb = part(THREE, new THREE.SphereGeometry(.13, 8, 6), flat('#5d8a48', '#3c5c2e'), .012);
    herb.position.set(x, 2.42, -2.8); g.add(herb);
  });
  const rug = box(THREE, 3.6, .035, 2.8, '#a34a3a', '#7c3527', -2.4, .02, 3.6, 0, .01); g.add(rug);
  const rugIn = box(THREE, 2.9, .04, 2.1, '#d9a441', '#a87c2c', -2.4, .025, 3.6, 0, .01); g.add(rugIn);
  [-.5, 5.5].forEach(z => { const beam = box(THREE, 14, .28, .38, '#6b4a30', '#4a3018', 0, 4.32, z, 0, .015); g.add(beam); });
  const clockFace = new THREE.Mesh(new THREE.CircleGeometry(.34, 24), new THREE.MeshBasicMaterial({ color: 0xf2ead8 }));
  clockFace.rotation.y = Math.PI / 2; clockFace.position.set(-6.94, 2.95, 4.6); g.add(clockFace);
  const clockRim = part(THREE, new THREE.TorusGeometry(.34, .035, 8, 24), flat('#37424a', '#232a30'));
  clockRim.rotation.y = Math.PI / 2; clockRim.position.set(-6.94, 2.95, 4.6); g.add(clockRim);
  [[.16, 0], [-.1, .12]].forEach(([dx, dy]) => { const hand = box(THREE, .03, .2, .02, '#2c2c2c', '#1c1c1c', -6.92, 2.95 + dy, 4.6 + dx, 0, 0); g.add(hand); });
  [[5.5, '#7fae5c'], [6.45, '#c96f4a']].forEach(([x, col]) => {
    const fr = box(THREE, .78, .95, .05, '#5a3a2a', '#3c2617', x, 2.62, -2.88, 0, .015); g.add(fr);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(.64, .8), new THREE.MeshBasicMaterial({ color: new THREE.Color(col) }));
    pic.position.set(x, 2.62, -2.85); g.add(pic);
    const picSun = new THREE.Mesh(new THREE.CircleGeometry(.13, 14), new THREE.MeshBasicMaterial({ color: 0xf2ead8 }));
    picSun.position.set(x - .12, 2.82, -2.84); g.add(picSun);
  });
  const rail = part(THREE, new THREE.CylinderGeometry(.025, .025, 2.6, 8), flat('#8b95a1', '#5d666f'));
  rail.rotation.z = Math.PI / 2; rail.position.set(3.6, 2.28, -2.92); g.add(rail);
  [2.7, 3.3, 3.9, 4.5].forEach((x, i) => {
    const hook = box(THREE, .03, .16, .03, '#8b95a1', '#5d666f', x, 2.18, -2.92, 0, 0); g.add(hook);
    const ut = i % 2 ? box(THREE, .16, .3, .03, '#c7ccd4', '#8b95a1', x, 1.95, -2.92, .06, .01) : part(THREE, new THREE.ConeGeometry(.11, .3, 10), flat('#c7ccd4', '#8b95a1'));
    if (i % 2 === 0) ut.position.set(x, 1.95, -2.92); g.add(ut);
  });
  const board = box(THREE, .5, .7, .04, '#c9a06a', '#9a783f', 2.6, 1.62, -2.78, -.18, .012); g.add(board);
  // — decorative plates + a hanging plant on the back-wall segment the dive camera faces —
  [[.9, '#c96f4a'], [1.5, '#7fae5c'], [2.1, '#d9a441']].forEach(([x, col]) => {
    const plate = part(THREE, new THREE.CylinderGeometry(.21, .21, .03, 18), flat(col, '#5d666f'), .012);
    plate.rotation.x = Math.PI / 2; plate.position.set(x, 3.15, -2.88); g.add(plate);
  });
  const hangPot = part(THREE, new THREE.CylinderGeometry(.11, .08, .16, 10), flat('#b5533c', '#7c3826'), .012);
  hangPot.position.set(2.75, 3.3, -2.8); g.add(hangPot);
  const hangLeaf = part(THREE, new THREE.SphereGeometry(.2, 8, 6), flat('#5d8a48', '#3c5c2e'), .012);
  hangLeaf.position.set(2.75, 3.12, -2.8); g.add(hangLeaf);

  // — a second window centred behind the speaker's home spot: frame, dusk vista card, two lit
  //    panes, a street lamp — a far end and a light source on the front cameras' axis —
  const win2Frame = box(THREE, 2.5, 2.2, .1, '#5a3a2a', '#3c2617', 0.55, 2.35, -2.82, 0, .02); g.add(win2Frame);
  const win2Card = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.9), new THREE.MeshBasicMaterial({ color: 0x39506e }));
  win2Card.position.set(0.55, 2.35, -2.76); g.add(win2Card);
  const win2Glow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .8), new THREE.MeshBasicMaterial({ color: 0xcf8a4e }));
  win2Glow.position.set(0.55, 1.95, -2.755); g.add(win2Glow);
  [[0.0, 2.8], [1.1, 2.65]].forEach(([x, y]) => { const lw = new THREE.Mesh(new THREE.PlaneGeometry(.36, .28), new THREE.MeshBasicMaterial({ color: 0xffd9a0 })); lw.position.set(x, y, -2.75); g.add(lw); });
  const win2Lamp = new THREE.Mesh(new THREE.CircleGeometry(.1, 14), new THREE.MeshBasicMaterial({ color: 0xffe6b8 }));
  win2Lamp.position.set(0.7, 2.25, -2.75); g.add(win2Lamp);
  const win2BarV = box(THREE, .07, 1.9, .05, '#5a3a2a', '#3c2617', 0.55, 2.35, -2.745, 0, 0); g.add(win2BarV);
  const win2BarH = box(THREE, 2.2, .07, .05, '#5a3a2a', '#3c2617', 0.55, 2.35, -2.745, 0, 0); g.add(win2BarH);
  // — a floor lamp at the room's left end (a second source for the along-room shots) —
  const flPole = box(THREE, .06, 1.9, .06, '#37424a', '#232a30', -6.3, .95, 3.4, 0, .015); g.add(flPole);
  const flShade = part(THREE, new THREE.CylinderGeometry(.16, .26, .3, 14, 1, true), flat('#e8a34c', '#a86f2c'), .015);
  flShade.position.set(-6.3, 1.95, 3.4); g.add(flShade);
  const flBulb = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  flBulb.position.set(-6.3, 1.88, 3.4); g.add(flBulb);
  // — wall sconces on the back wall (lit sources at head height, inside the critic crop) + wall
  //    cabinets over the counter with an under-glow strip —
  [[-0.85], [1.95]].forEach(([x]) => {
    const sh = part(THREE, new THREE.CylinderGeometry(.09, .2, .22, 14, 1, true), flat('#37424a', '#232a30'), .015);
    sh.position.set(x, 2.72, -2.82); g.add(sh);
    const sb = new THREE.Mesh(new THREE.SphereGeometry(.11, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
    sb.position.set(x, 2.6, -2.8); g.add(sb);
  });
  [[2.5], [4.3]].forEach(([x]) => { const cab = box(THREE, 1.5, 1.05, .5, '#7a5c38', '#543e24', x, 3.05, -2.62, 0, .02); g.add(cab); });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(3.4, .05, .06), new THREE.MeshBasicMaterial({ color: 0xffe2b0 }));
  strip.position.set(3.4, 2.5, -2.4); g.add(strip);

  // — counter dressing: a kettle and jars along the run —
  const kettle = part(THREE, new THREE.CylinderGeometry(.15, .19, .3, 16), flat('#a9b2b8', '#78828a'));
  kettle.position.set(2.3, 1.4, -2.45); g.add(kettle);
  const spout = box(THREE, .16, .07, .07, '#a9b2b8', '#78828a', 2.48, 1.48, -2.45, 0, .015); g.add(spout);
  [[4.35, '#d9a441'], [4.62, '#b5533c'], [4.89, '#7d9b57']].forEach(([x, c]) => {
    const jar = part(THREE, new THREE.CylinderGeometry(.085, .085, .3, 12), flat(c, '#5d5142'));
    jar.position.set(x, 1.4, -2.5); g.add(jar);
  });
  const bowl = part(THREE, new THREE.CylinderGeometry(.3, .17, .13, 16), flat('#8a4b3a', '#5d3125'));
  bowl.position.set(-3.15, 1.22, .65); g.add(bowl);
  [[-3.28, '#e08a2e'], [-3.02, '#7d9b57'], [-3.15, '#c23b2e']].forEach(([x, c]) => {
    const fruit = part(THREE, new THREE.SphereGeometry(.075, 12, 10), flat(c, '#6b4a2f'), .015);
    fruit.position.set(x, 1.33, .65); g.add(fruit);
  });

  // — the freezer interior (x +400): shelves of frozen packs, its lamp, the open door framing the view —
  const F = 400, fz = new THREE.Group();
  fz.add(box(THREE, 3.6, .08, 3.6, '#d7e6ef', '#aec6d4', F, -.04, 0));
  fz.add(box(THREE, 3.6, 3.2, .1, '#e6f1f7', '#c3d9e6', F, 1.6, -1.75));
  fz.add(box(THREE, .1, 3.2, 3.6, '#dfeef6', '#bcd6e4', F - 1.75, 1.6, 0));
  fz.add(box(THREE, .1, 3.2, 3.6, '#dfeef6', '#bcd6e4', F + 1.75, 1.6, 0));
  fz.add(box(THREE, 3.6, .1, 3.6, '#e6f1f7', '#c3d9e6', F, 3.22, 0));
  fz.add(glow(THREE, .9, .07, .45, 0xf2fbff, F, 3.14, -.3));                              // practical 1: the lamp
  fz.add(glow(THREE, 1.4, .8, .05, 0x86bdf0, F, 2.2, -1.66));                             // practical 2: the back-panel glow
  const packCols = ['#9fd0e8', '#f2f7fa', '#a8d8b9', '#f0d9a0'];
  [.65, 1.3, 1.95].forEach((sy, si) => {
    fz.add(box(THREE, 3.2, .06, .85, '#cfe2ee', '#a9c6d8', F, sy, -1.25));
    for (let i = 0; i < 4; i++) {
      const px = F - 1.2 + i * .8, pw = .5 + (i % 2) * .12, ph = .34 + ((i + si) % 3) * .07;
      fz.add(box(THREE, pw, ph, .6, packCols[(i + si) % 4], '#7d97a8', px, sy + .03 + ph / 2, -1.25));
      fz.add(box(THREE, pw, .05, .6, '#f4fafd', '#d9e9f2', px, sy + .06 + ph, -1.25, 0, 0)); // the frost cap
    }
  });
  fz.add(box(THREE, 1.7, 3.1, .08, '#e3ebee', '#b9c8ce', F + 2.35, 1.55, .95, .9));         // the open door, front right
  g.add(fz);

  // — inside the bottle (x -400): the glass column, the water, the shaft of light, the front, the crystals —
  const B = -400, inside = new THREE.Group();
  const shellMat = flat('#122c42', '#071626'); shellMat.side = THREE.BackSide;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 44, 24, 1, true), shellMat);
  shell.position.set(B, 15, 0); shell.frustumCulled = false; inside.add(shell);
  const baseDisc = part(THREE, new THREE.CylinderGeometry(5.2, 5.6, .5, 36), flat('#0e3242', '#081e29'));
  baseDisc.position.set(B, .25, 0); inside.add(baseDisc);
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x9fd4e8, transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 30, 40, 1, true), glassMat);
  glass.position.set(B, 15.5, 0); glass.renderOrder = 5; glass.frustumCulled = false; inside.add(glass);
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 4.5, 3, 40, 1, true), glassMat);
  shoulder.position.set(B, 32, 0); shoulder.renderOrder = 5; shoulder.frustumCulled = false; inside.add(shoulder);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(4.15, 4.15, 27, 32), new THREE.MeshBasicMaterial({ color: 0x0a3252, transparent: true, opacity: .72, depthWrite: false }));
  water.position.set(B, 14, 0); water.frustumCulled = false; inside.add(water);
  const meniscus = new THREE.Mesh(new THREE.CircleGeometry(4.15, 32), new THREE.MeshBasicMaterial({ color: 0xcfeefb, transparent: true, opacity: .6, side: THREE.DoubleSide, depthWrite: false }));
  meniscus.rotation.x = -Math.PI / 2; meniscus.position.set(B, 27.5, 0); meniscus.renderOrder = 4; inside.add(meniscus);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 2.4, 26, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xd8f2ff, transparent: true, opacity: .17, side: THREE.DoubleSide, depthWrite: false }));
  shaft.position.set(B - 1.2, 15, -.8); shaft.rotation.z = .22; shaft.renderOrder = 3; shaft.frustumCulled = false; inside.add(shaft);
  const frontGeo = new THREE.CylinderGeometry(3.95, 3.95, 1, 32); frontGeo.translate(0, .5, 0);
  const bandCv = document.createElement('canvas'); bandCv.width = 512; bandCv.height = 256;
  { const bx = bandCv.getContext('2d'); bx.fillStyle = '#d9edf7'; bx.fillRect(0, 0, 512, 256);
    bx.strokeStyle = 'rgba(130,170,200,.55)';
    for (let i = 0; i < 46; i++) { bx.lineWidth = 1 + (i % 3); bx.beginPath();
      const x0 = (i * 37) % 512; bx.moveTo(x0, 256);
      bx.bezierCurveTo(x0 + 14, 170, x0 - 12, 90, x0 + 8, 0); bx.stroke(); }
    bx.fillStyle = 'rgba(240,249,253,.35)';
    for (let i = 0; i < 22; i++) bx.fillRect((i * 67) % 512, (i * 41) % 200, 26, 14); }
  const bandTex = new THREE.CanvasTexture(bandCv); bandTex.colorSpace = THREE.SRGBColorSpace;
  bandTex.wrapS = THREE.RepeatWrapping; bandTex.repeat.x = 3;
  const frontBand = new THREE.Mesh(frontGeo, new THREE.MeshBasicMaterial({ map: bandTex, transparent: true, opacity: .9 }));
  frontBand.position.set(B, .5, 0); frontBand.scale.y = .0001; frontBand.visible = false; frontBand.name = 'front';
  frontBand.frustumCulled = false; inside.add(frontBand); points.frontBand = frontBand;
  const capCv = document.createElement('canvas'); capCv.width = capCv.height = 512;
  { const cx = capCv.getContext('2d'); cx.fillStyle = '#e8f4fa'; cx.fillRect(0, 0, 512, 512);
    cx.strokeStyle = 'rgba(120,160,190,.85)'; cx.lineWidth = 3;
    for (let i = 0; i < 14; i++) { const a = i * 2.4; cx.beginPath(); cx.moveTo(256, 256);
      cx.lineTo(256 + Math.cos(a) * (120 + (i % 4) * 40), 256 + Math.sin(a) * (120 + (i % 4) * 40));
      cx.lineTo(256 + Math.cos(a + .3) * 250, 256 + Math.sin(a + .3) * 250); cx.stroke(); }
    cx.strokeStyle = 'rgba(150,185,210,.5)'; cx.lineWidth = 2;
    [90, 160, 225].forEach(r => { cx.beginPath(); cx.arc(256, 256, r, 0, Math.PI * 2); cx.stroke(); }); }
  const capTex = new THREE.CanvasTexture(capCv); capTex.colorSpace = THREE.SRGBColorSpace;
  const frontCap = new THREE.Mesh(new THREE.CircleGeometry(3.95, 32), new THREE.MeshBasicMaterial({ map: capTex, transparent: true, opacity: .92, side: THREE.DoubleSide, depthWrite: false }));
  frontCap.rotation.x = -Math.PI / 2; frontCap.position.set(B, .55, 0); frontCap.visible = false; frontCap.renderOrder = 2; frontCap.frustumCulled = false; inside.add(frontCap); points.frontCap = frontCap;
  const crystals = new THREE.Group(); crystals.name = 'crystals';
  let seed = 1234567; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const cryMat = flat('#bfe3f7', '#5e93b8');
  for (let i = 0; i < 70; i++) {
    const c = new THREE.Mesh(i % 3 ? new THREE.ConeGeometry(.42, 1.9, 6) : new THREE.IcosahedronGeometry(.68, 0), cryMat);
    const a = rnd() * Math.PI * 2, rr = rnd() * 3.4;
    c.position.set(B + Math.cos(a) * rr, .5 + rnd() * 26, Math.sin(a) * rr);
    c.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    c.userData.h = c.position.y; c.userData.s = .7 + rnd() * 1.1;
    c.scale.setScalar(.0001); c.frustumCulled = false; crystals.add(c);
  }
  const frontRim = new THREE.Mesh(new THREE.TorusGeometry(3.9, .1, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  frontRim.rotation.x = Math.PI / 2; frontRim.position.set(B, .55, 0); frontRim.visible = false; frontRim.frustumCulled = false; inside.add(frontRim); points.frontRim = frontRim;
  for (let i = 0; i < 14; i++) {                                                          // frost streaks on the glass
    const st = part(THREE, new THREE.BoxGeometry(.2, 2.5 + rnd() * 4.5, .03), flat('#cfe9f7', '#8fb8d4'), 0);
    const a = rnd() * Math.PI * 2;
    st.position.set(B + Math.cos(a) * 4.3, 3 + rnd() * 11, Math.sin(a) * 4.3);
    st.rotation.y = -a + Math.PI / 2; inside.add(st);
  }
  for (let i = 0; i < 30; i++) {                                                          // the bubble spiral
    const b = new THREE.Mesh(new THREE.SphereGeometry(.06 + rnd() * .07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xeaf7ff, transparent: true, opacity: .85 }));
    const a = i * .85, rr = .8 + (i % 5) * .55;
    b.position.set(B + Math.cos(a) * rr, 1.5 + i * .85, Math.sin(a) * rr); inside.add(b);
  }
  inside.add(crystals);
  for (let i = 0; i < 8; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(.85 + rnd() * .5, 0), cryMat);
    const a = (i / 8) * Math.PI * 2 + rnd() * .5, rr = 2.5 + rnd() * 1.1;
    c.position.set(B + Math.cos(a) * rr, 1 + rnd() * 23, Math.sin(a) * rr);
    c.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    c.userData.h = c.position.y; c.userData.s = 1.5 + rnd() * .9; c.userData.seedFloor = .45;
    outline(c, { width: .025, color: 0x2c4a5e }); c.scale.setScalar(.0001); c.frustumCulled = false; crystals.add(c);
  }
  for (let i = 0; i < 10; i++) {                                                          // the crystal garden (camera cluster)
    const c = new THREE.Mesh(i % 2 ? new THREE.IcosahedronGeometry(.8, 0) : new THREE.ConeGeometry(.45, 2.2, 6), cryMat);
    const a = -.5 + rnd() * 1.6, rr = 1.2 + rnd() * .8;
    c.position.set(B + Math.cos(a) * rr, 3.6 + rnd() * 5.2, Math.sin(a) * rr);
    c.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    c.userData.h = c.position.y - 2.5; c.userData.s = 1.3 + rnd() * .3; c.userData.seedFloor = .55;
    outline(c, { width: .03, color: 0x2c4a5e });
    c.scale.setScalar(.0001); c.frustumCulled = false; crystals.add(c);
  }
  for (let i = 0; i < 24; i++) {                                                          // frost fingers on the glass
    const c = new THREE.Mesh(new THREE.ConeGeometry(.3, 1.6, 6), cryMat);
    const a = rnd() * Math.PI * 2;
    c.position.set(B + Math.cos(a) * 3.55, 1 + rnd() * 25, Math.sin(a) * 3.55);
    c.rotation.set(Math.PI / 2 * Math.cos(a), 0, -Math.PI / 2 * Math.sin(a) + rnd() * .6);
    c.userData.h = c.position.y; c.userData.s = .8 + rnd() * .8; c.userData.seedFloor = .3;
    outline(c, { width: .025, color: 0x2c4a5e }); c.scale.setScalar(.0001); c.frustumCulled = false; crystals.add(c);
  }
  for (let i = 0; i < 16; i++) {                                                          // still bubbles, beat-3 dressing
    const b = new THREE.Mesh(new THREE.SphereGeometry(.25 + rnd() * .25, 10, 8), new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: .65 }));
    const a = rnd() * Math.PI * 2, rr = rnd() * 3.2;
    b.position.set(B + Math.cos(a) * rr, 2 + rnd() * 24, Math.sin(a) * rr); inside.add(b);
  }
  // — ENVIRONMENT PASS, inside the bottle: a wider crystal garden, suspended shards that the
  //    front swallows as it passes, far silhouettes against the glass, a second bubble spiral —
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Mesh(i % 2 ? new THREE.ConeGeometry(.5, 2.4, 6) : new THREE.IcosahedronGeometry(.85, 0), cryMat);
    const a = -1.2 + rnd() * 3.4, rr = .8 + rnd() * 1.8;
    c.position.set(B + Math.cos(a) * rr, 2.5 + rnd() * 8.5, Math.sin(a) * rr);
    c.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    c.userData.h = c.position.y - 2.5; c.userData.s = 1.2 + rnd() * .5; c.userData.seedFloor = .5;
    outline(c, { width: .03, color: 0x2c4a5e });
    c.scale.setScalar(.0001); c.frustumCulled = false; crystals.add(c);
  }
  for (let i = 0; i < 18; i++) {                                                          // suspended shards
    const c = new THREE.Mesh(new THREE.TetrahedronGeometry(.5 + rnd() * .45), cryMat);
    const a = rnd() * Math.PI * 2, rr = .6 + rnd() * 2.6;
    c.position.set(B + Math.cos(a) * rr, 4 + rnd() * 20, Math.sin(a) * rr);
    c.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    c.userData.h = c.position.y; c.userData.s = .55 + rnd() * .4; c.userData.seedFloor = .35;
    c.scale.setScalar(.0001); c.frustumCulled = false; crystals.add(c);
  }
  for (let i = 0; i < 6; i++) {                                                           // far silhouettes on the glass
    const c = new THREE.Mesh(new THREE.ConeGeometry(1.1 + rnd() * .7, 5 + rnd() * 4, 7), flat('#2c5a7d', '#1a3c56'));
    const a = rnd() * Math.PI * 2;
    c.position.set(B + Math.cos(a) * 3.95, 3 + rnd() * 9, Math.sin(a) * 3.95);
    c.rotation.set(rnd() * .6, rnd() * 3, rnd() * .6); c.frustumCulled = false; inside.add(c);
  }
  for (let i = 0; i < 12; i++) {                                                          // the spark-sector cluster (faces the beat-4 cameras)
    const c = new THREE.Mesh(i % 2 ? new THREE.IcosahedronGeometry(.7 + rnd() * .4, 0) : new THREE.ConeGeometry(.45, 2 + rnd(), 6), cryMat);
    const a = .2 + rnd() * 1.0, rr = 1 + rnd() * 2;
    c.position.set(B + Math.cos(a) * rr, 6 + rnd() * 10, Math.sin(a) * rr);
    c.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    c.userData.h = c.position.y; c.userData.s = .9 + rnd() * .7; c.userData.seedFloor = .3;
    outline(c, { width: .025, color: 0x2c4a5e });
    c.scale.setScalar(.0001); c.frustumCulled = false; crystals.add(c);
    const bb = new THREE.Mesh(new THREE.SphereGeometry(.22 + rnd() * .18, 10, 8), new THREE.MeshBasicMaterial({ color: 0xeaf7ff, transparent: true, opacity: .8 }));
    bb.position.set(B + Math.cos(a + .4) * (rr + .5), c.position.y + 1 + rnd() * 3, Math.sin(a + .4) * (rr + .5)); inside.add(bb);
  }
  for (let i = 0; i < 10; i++) {                                                          // spark-sector bubble cluster + far crystals
    const a = .3 + rnd() * .9, rr = 1.5 + rnd() * 1.5;
    const bb = new THREE.Mesh(new THREE.SphereGeometry(.3 + rnd() * .25, 10, 8), new THREE.MeshBasicMaterial({ color: 0xeaf7ff, transparent: true, opacity: .8 }));
    bb.position.set(B + Math.cos(a) * rr, 5 + rnd() * 9, Math.sin(a) * rr); inside.add(bb);
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(.5 + rnd() * .3, 0), cryMat);
    const a2 = .2 + rnd() * 1.1, rr2 = 3 + rnd() * .8;
    c.position.set(B + Math.cos(a2) * rr2, 5 + rnd() * 12, Math.sin(a2) * rr2);
    c.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    c.userData.h = c.position.y; c.userData.s = .5 + rnd() * .3; c.userData.seedFloor = .2;
    c.scale.setScalar(.0001); c.frustumCulled = false; crystals.add(c);
  }
  for (let i = 0; i < 26; i++) {                                                          // second bubble spiral, counter-wound
    const b = new THREE.Mesh(new THREE.SphereGeometry(.05 + rnd() * .06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xeaf7ff, transparent: true, opacity: .8 }));
    const a = -i * .7, rr = 1 + (i % 4) * .6;
    b.position.set(B + Math.cos(a) * rr, 3 + i * .95, Math.sin(a) * rr); inside.add(b);
  }
  g.add(inside);

  let rig; try { rig = createLightRig(THREE, PLACES, {}); } catch { rig = undefined; }
  const look = (rig && opts && opts.post) ? createPost(THREE, rig, opts.post) : undefined;
  if (look && opts && opts.post && opts.post.shade) { try { look.shading = createRigShade(THREE, rig, opts.post.shade); } catch (e) { /* shading optional */ } }
  const frontAt = t => {
    const keys = (opts.frontKeys && opts.frontKeys.length) ? opts.frontKeys : [[0, 0]];
    let v = keys[0][1];
    for (let i = 0; i < keys.length; i++) {
      if (t < keys[i][0]) break;
      const [t0, v0] = keys[i], nx = keys[i + 1];
      v = nx ? v0 + (nx[1] - v0) * Math.min(1, (t - t0) / Math.max(nx[0] - t0, .0001)) : v0;
    }
    return v;
  };
  return {
    ...base, group: g, rig, look,
    marks: { ...(base.marks || {}), freezer: [-5.6, -1.2], freezer_in: [F, 1.4], inside: [B, 2] },
    points,
    update(t) {
      base.update?.(t); rig?.update(t);
      const v = frontAt(t);
      frontBand.visible = v > .05; frontBand.scale.y = Math.max(v, .0001);
      points.frontCap.visible = v > .05; points.frontCap.position.y = .5 + v;
      points.frontRim.visible = v > .05; points.frontRim.position.y = .5 + v;
      for (const c of crystals.children) {
        const k = Math.max(0, Math.min(1, (v - c.userData.h + 1.2) / 2.4));
        c.scale.setScalar(Math.max(Math.max(k, c.userData.seedFloor || 0) * c.userData.s, .0001));
      }
    },
  };
}
