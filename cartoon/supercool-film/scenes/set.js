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
  const doorPivot = new THREE.Group(); doorPivot.position.set(-.55, 0, .55); doorPivot.rotation.y = -.8;
  const doorSlab = box(THREE, 1.08, 2.9, .07, '#e3ebee', '#b9c8ce', .54, 1.48, 0);
  doorPivot.add(doorSlab); freezerUnit.add(doorPivot);
  freezerUnit.add(glow(THREE, .07, .03, .02, 0x59ff8d, .32, 2.78, .54));                  // the green LED
  freezerUnit.position.set(-5.6, 0, -2.35); freezerUnit.name = 'freezer';
  g.add(freezerUnit); points.freezerUnit = freezerUnit;

  // — the ceiling pendant over the table end of the room (practical) —
  const pendant = new THREE.Group();
  pendant.add(box(THREE, .03, .8, .03, '#37424a', '#232a30', 0, -.4, 0, 0, 0));
  const shade = part(THREE, new THREE.CylinderGeometry(.12, .42, .35, 20, 1, true), flat('#37424a', '#232a30'), .02);
  shade.position.y = -.95; pendant.add(shade);
  const bulb = new THREE.Mesh(new THREE.CircleGeometry(.2, 20), new THREE.MeshBasicMaterial({ color: 0xffd9a0, side: THREE.DoubleSide }));
  bulb.rotation.x = Math.PI / 2; bulb.position.y = -1.06; pendant.add(bulb);
  pendant.position.set(.2, 4.3, 1.2); g.add(pendant);

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
  const water = new THREE.Mesh(new THREE.CylinderGeometry(4.15, 4.15, 27, 32), new THREE.MeshBasicMaterial({ color: 0x14486b, transparent: true, opacity: .62, depthWrite: false }));
  water.position.set(B, 14, 0); water.frustumCulled = false; inside.add(water);
  const meniscus = new THREE.Mesh(new THREE.CircleGeometry(4.15, 32), new THREE.MeshBasicMaterial({ color: 0xcfeefb, transparent: true, opacity: .85, side: THREE.DoubleSide, depthWrite: false }));
  meniscus.rotation.x = -Math.PI / 2; meniscus.position.set(B, 27.5, 0); meniscus.renderOrder = 4; inside.add(meniscus);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 2.4, 26, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xd8f2ff, transparent: true, opacity: .1, side: THREE.DoubleSide, depthWrite: false }));
  shaft.position.set(B - 1.2, 15, -.8); shaft.rotation.z = .22; shaft.renderOrder = 3; shaft.frustumCulled = false; inside.add(shaft);
  const frontGeo = new THREE.CylinderGeometry(3.95, 3.95, 1, 32); frontGeo.translate(0, .5, 0);
  const frontBand = new THREE.Mesh(frontGeo, new THREE.MeshBasicMaterial({ color: 0xeef7fa, transparent: true, opacity: .96 }));
  frontBand.position.set(B, .5, 0); frontBand.scale.y = .0001; frontBand.visible = false; frontBand.name = 'front';
  frontBand.frustumCulled = false; inside.add(frontBand); points.frontBand = frontBand;
  const frontCap = new THREE.Mesh(new THREE.CircleGeometry(3.95, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .95, side: THREE.DoubleSide, depthWrite: false }));
  frontCap.rotation.x = -Math.PI / 2; frontCap.position.set(B, .55, 0); frontCap.visible = false; frontCap.renderOrder = 2; frontCap.frustumCulled = false; inside.add(frontCap); points.frontCap = frontCap;
  const crystals = new THREE.Group(); crystals.name = 'crystals';
  let seed = 1234567; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const cryMat = new THREE.MeshBasicMaterial({ color: 0x9fd0ee });
  for (let i = 0; i < 46; i++) {
    const c = new THREE.Mesh(i % 3 ? new THREE.ConeGeometry(.34, 1.5, 6) : new THREE.IcosahedronGeometry(.5, 0), cryMat);
    const a = rnd() * Math.PI * 2, rr = rnd() * 3.4;
    c.position.set(B + Math.cos(a) * rr, .5 + rnd() * 26, Math.sin(a) * rr);
    c.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    c.userData.h = c.position.y; c.userData.s = .5 + rnd() * .9;
    c.scale.setScalar(.0001); c.frustumCulled = false; crystals.add(c);
  }
  inside.add(crystals);
  for (let i = 0; i < 10; i++) {                                                          // still bubbles, beat-3 dressing
    const b = new THREE.Mesh(new THREE.SphereGeometry(.12 + rnd() * .15, 10, 8), new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: .5 }));
    const a = rnd() * Math.PI * 2, rr = rnd() * 3.2;
    b.position.set(B + Math.cos(a) * rr, 2 + rnd() * 24, Math.sin(a) * rr); inside.add(b);
  }
  g.add(inside);

  let rig; try { rig = createLightRig(THREE, PLACES, {}); } catch { rig = undefined; }
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
    ...base, group: g, rig,
    marks: { ...(base.marks || {}), freezer: [-5.6, -1.2], freezer_in: [F, 1.4], inside: [B, 2] },
    points,
    update(t) {
      base.update?.(t); rig?.update(t);
      const v = frontAt(t);
      frontBand.visible = v > .05; frontBand.scale.y = Math.max(v, .0001);
      points.frontCap.visible = v > .05; points.frontCap.position.y = .5 + v;
      for (const c of crystals.children) {
        const k = Math.max(0, Math.min(1, (v - c.userData.h + 1.2) / 2.4));
        c.scale.setScalar(Math.max(k * c.userData.s, .0001));
      }
    },
  };
}
