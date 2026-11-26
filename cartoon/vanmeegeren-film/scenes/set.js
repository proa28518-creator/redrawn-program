// scenes/set.js — the film's own set (film.js: world: { set: 'own' }). Five places, 400 D apart
// (references/sets.md), so one place's light never leaks into another:
//   interrogation (origin)      — 1945 Dutch police room: table, hanging lamp, shuttered window,
//                                 and the open door onto a lit corridor = the place's far end.
//   collection    (x +400)      — Goring's looted-art salon: gilt frame rows receding, crates, sheets.
//   studio        (x -400)      — Van Meegeren's Amsterdam studio: tall north window, easel, canvas
//                                 stack and pigment shelves receding, a stove's glow.
//   lab           (x +400, z -400) — the analysis bench: microscope bench, bottle shelves, Bunsen.
//   courtroom     (x -400, z -400) — the 1947 court: high bench, panelling, tall windows, bench rows.
// Lights are data (PLACES, world/look/lights.js; positions are world, so each place's lights carry
// its offset). Previz geometry shades with the engine's flat(); practicals are visible emissive
// meshes. update(t) is pure in t: the interrogation lamp's sway, the studio timelapse light sweep.
import { createLightRig } from '../world/look/lights.js';
import { createPost } from '../world/look/post.js';
import { createRigShade } from '../world/look/rigshade.js';
import { flat } from '../lib/film/props.js';
import { outline } from '../engine/shade.js';

const PLACES = {
  interrogation: {
    sky: [.62, .66, .72], ground: [.3, .27, .24], fog: { color: '#4c4a44', density: .012 },
    lights: [
      { id: 'lamp', kind: 'point', color: [1, .78, .5], power: 1.15, pos: [0, 3.0, .2], fall: .07, range: 11 },
      { id: 'shutter', kind: 'spot', color: [.75, .82, .95], power: .8, pos: [-1.8, 2.6, -2.5], dir: [.25, -.35, 1], cone: [25, 55], fall: .05, range: 14 },
      { id: 'corridor', kind: 'point', color: [1, .85, .6], power: .7, pos: [2.3, 2.2, -6.5], fall: .05, range: 12 },
    ],
  },
  collection: {
    sky: [.4, .44, .38], ground: [.2, .18, .14], fog: { color: '#1e2a20', density: .016 },
    lights: [
      { id: 'chandelier', kind: 'point', color: [1, .8, .52], power: 1.0, pos: [400, 3.4, .4], fall: .06, range: 14 },
      { id: 'lamp', kind: 'point', color: [1, .72, .42], power: .8, pos: [396.7, 1.7, -0.7], fall: .08, range: 8 },
      { id: 'spill', kind: 'point', color: [.6, .72, .9], power: .5, pos: [405.5, 2, 2], fall: .06, range: 10 },
    ],
  },
  studio: {
    sky: [.85, .8, .68], ground: [.42, .34, .24], fog: { color: '#8a6f4a', density: .01 },
    lights: [
      { id: 'north', kind: 'spot', color: [.88, .92, 1], power: 1.1, pos: [-400.8, 3.6, -2.8], dir: [.2, -.4, 1], cone: [30, 60], fall: .04, range: 16 },
      { id: 'stove', kind: 'point', color: [1, .5, .2], power: .7, pos: [-397.2, .8, -1.8], fall: .09, range: 7 },
      { id: 'desk', kind: 'point', color: [1, .8, .55], power: .6, pos: [-402.2, 1.9, 1.2], fall: .08, range: 8 },
    ],
  },
  lab: {
    sky: [.8, .86, .88], ground: [.4, .44, .44], fog: { color: '#5d6a68', density: .01 },
    lights: [
      { id: 'benchlamp', kind: 'point', color: [1, .98, .92], power: 1.1, pos: [399.2, 2.6, -401.4], fall: .07, range: 10 },
      { id: 'window', kind: 'spot', color: [.85, .9, .95], power: .7, pos: [402.8, 2.8, -400], dir: [-1, -.3, 0], cone: [30, 60], fall: .05, range: 12 },
      { id: 'bunsen', kind: 'point', color: [.45, .6, 1], power: .55, pos: [400.9, 1.35, -401.5], fall: .12, range: 5 },
    ],
  },
  courtroom: {
    sky: [.78, .72, .6], ground: [.34, .28, .2], fog: { color: '#6a5a42', density: .011 },
    lights: [
      { id: 'windows', kind: 'spot', color: [.95, .9, .78], power: 1.0, pos: [-400, 3.8, -403.2], dir: [0, -.35, 1], cone: [35, 65], fall: .04, range: 18 },
      { id: 'brass', kind: 'point', color: [1, .8, .5], power: .65, pos: [-401.6, 2.6, -402.2], fall: .07, range: 10 },
      { id: 'brass2', kind: 'point', color: [1, .8, .5], power: .65, pos: [-398.4, 2.6, -402.2], fall: .07, range: 10 },
    ],
  },
};

function part(THREE, geo, mat, ink = .03) {
  const m = new THREE.Mesh(geo, mat);
  if (ink > 0) outline(m, { width: ink, color: 0x2c2422 });
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
function bulb(THREE, r, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), new THREE.MeshBasicMaterial({ color }));
  m.position.set(x, y, z); m.frustumCulled = false; return m;
}
// a gilt-framed old master (flat colour painting: a landscape/figure block composition)
function giltFrame(THREE, w, h, c1, c2, c3) {
  const g = new THREE.Group();
  g.add(box(THREE, w + .22, h + .22, .07, '#a87c2c', '#77571d', 0, 0, 0, 0, .02));
  const cv = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c1) }));
  cv.position.z = .045; g.add(cv);
  const band = new THREE.Mesh(new THREE.PlaneGeometry(w, h * .34), new THREE.MeshBasicMaterial({ color: new THREE.Color(c2) }));
  band.position.set(0, -h * .3, .05); g.add(band);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(h * .13, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(c3) }));
  sun.position.set(-w * .22, h * .18, .05); g.add(sun);
  return g;
}

export function buildSet(THREE, scene, opts = {}, kit) {
  const base = kit('plain', {});
  const g = base.group;
  const points = { ...(base.points || {}) };
  const dyn = {};   // materials/groups update(t) animates (pure in t)

  // ================= INTERROGATION (origin) =================
  const R = new THREE.Group(); g.add(R);
  R.add(box(THREE, 13, .08, 11, '#6b5138', '#4c3823', 0, -.01, .5, 0, .01));                  // floor (oversized)
  R.add(box(THREE, 6.4, 4.4, .12, '#5d6066', '#40434a', 0, 2.2, -2.66, 0, .015));              // back wall
  R.add(box(THREE, .12, 4.4, 3.4, '#55585e', '#3a3d42', -3.06, 2.2, -.9, 0, .015));            // left wall
  R.add(box(THREE, .12, 4.4, 3.4, '#55585e', '#3a3d42', 3.06, 2.2, -.9, 0, .015));             // right wall
  R.add(box(THREE, 13, .14, 11, '#4a4238', '#33291f', 0, 4.42, .5, 0, .01));                  // ceiling (oversized: no sky leak)
  // the table + two chairs
  R.add(box(THREE, 2.2, .09, 1.1, '#7a5a36', '#573f22', 0, 1.0, .2, 0, .02));
  [[-.95, -.25], [.95, -.25], [-.95, .65], [.95, .65]].forEach(([x, z]) => R.add(box(THREE, .09, 1.0, .09, '#5d4226', '#3f2c16', x, .5, z, 0, .012)));
  R.add(box(THREE, .62, .75, .07, '#6e4f2c', '#4c3519', -.7, .85, 1.28, 0, .015));             // hero's chair back
  R.add(box(THREE, .62, .07, .55, '#7a5a36', '#573f22', -.7, .55, 1.05, 0, .015));
  R.add(box(THREE, .62, .75, .07, '#6e4f2c', '#4c3519', .55, .85, -.78, 0, .015));              // officer's chair back
  R.add(box(THREE, .62, .07, .55, '#7a5a36', '#573f22', .55, .55, -.55, 0, .015));
  // the hanging lamp over the table (practical 1) — swings a fraction, settles on line 10
  const lamp = new THREE.Group();
  lamp.add(box(THREE, .03, .9, .03, '#2c2c30', '#17171a', 0, -.45, 0, 0, 0));
  const lshade = part(THREE, new THREE.CylinderGeometry(.13, .44, .36, 18, 1, true), flat('#37424a', '#232a30'), .02);
  lshade.position.y = -1.02; lamp.add(lshade);
  lamp.add(bulb(THREE, .16, 0xffd9a0, 0, -1.14, 0));
  lamp.position.set(0, 4.35, .2); R.add(lamp); dyn.lamp = lamp;
  // the shuttered window, back-left (practical 2): bright slats in a dark frame
  R.add(box(THREE, 1.5, 2.3, .08, '#3f444a', '#2a2e33', -1.9, 2.5, -2.58, 0, .02));
  for (let i = 0; i < 6; i++) R.add(glow(THREE, 1.3, .17, .03, 0xcfdce8, -1.9, 1.62 + i * .34, -2.53));
  // the map of the Netherlands on the back wall
  const mapCv = document.createElement('canvas'); mapCv.width = 256; mapCv.height = 320;
  { const x = mapCv.getContext('2d'); x.fillStyle = '#d8c9a3'; x.fillRect(0, 0, 256, 320);
    x.fillStyle = '#8aa06a'; x.beginPath(); x.moveTo(70, 40); x.bezierCurveTo(150, 20, 190, 90, 165, 150);
    x.bezierCurveTo(200, 210, 120, 260, 130, 300); x.bezierCurveTo(80, 290, 55, 220, 75, 160);
    x.bezierCurveTo(50, 100, 45, 60, 70, 40); x.fill();
    x.fillStyle = '#b03a30'; [[120, 110], [95, 190], [150, 230]].forEach(([px, py]) => { x.beginPath(); x.arc(px, py, 7, 0, 7); x.fill(); });
    x.fillStyle = '#4a4234'; x.font = '900 24px Arial'; x.fillText('NEDERLAND', 52, 308); }
  const mapTex = new THREE.CanvasTexture(mapCv); mapTex.colorSpace = THREE.SRGBColorSpace;
  const map = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.3), new THREE.MeshBasicMaterial({ map: mapTex }));
  map.position.set(.35, 2.6, -2.59); R.add(map);
  // the wall clock
  const clockF = new THREE.Mesh(new THREE.CircleGeometry(.3, 22), new THREE.MeshBasicMaterial({ color: 0xf2ead8 }));
  clockF.position.set(1.35, 3.1, -2.59); R.add(clockF);
  const clockR = part(THREE, new THREE.TorusGeometry(.3, .03, 8, 22), flat('#37424a', '#232a30'));
  clockR.position.set(1.35, 3.1, -2.59); R.add(clockR);
  R.add(box(THREE, .03, .2, .02, '#2c2c2c', '#1c1c1c', 1.35, 3.16, -2.58, 0, 0));
  R.add(box(THREE, .16, .03, .02, '#2c2c2c', '#1c1c1c', 1.42, 3.08, -2.58, 0, 0));
  // THE DOOR (back-right) open onto the lit corridor — the far end: corridor walls falling away,
  // a desk + a second officer silhouette + frosted glow at the end (depth 25 D class via the hall)
  R.add(box(THREE, 1.15, 3.3, .09, '#4c4f55', '#33363b', 2.35, 1.65, -2.6, 0, .02));
  const doorSlab = box(THREE, 1.05, 3.2, .06, '#6e5136', '#4c3823', 1.62, 1.6, -2.95, -.85, .02); R.add(doorSlab);
  const corr = new THREE.Group(); R.add(corr);
  corr.add(box(THREE, 2.2, .08, 9, '#5d4c36', '#40331f', 2.35, -.01, -7.1, 0, .01));
  corr.add(box(THREE, .1, 3.6, 9, '#6a6d72', '#484b4f', 1.3, 1.8, -7.1, 0, .01));
  corr.add(box(THREE, .1, 3.6, 9, '#62656a', '#42454a', 3.4, 1.8, -7.1, 0, .01));
  corr.add(box(THREE, 2.2, 3.6, .1, '#7a7d82', '#55585c', 2.35, 1.8, -11.6, 0, .01));
  corr.add(glow(THREE, 1.5, 2.2, .05, 0xffe2b0, 2.35, 1.9, -11.5));                            // frosted glow, corridor end
  corr.add(box(THREE, 1.3, .07, .6, '#6e5136', '#4c3823', 2.9, .95, -8.6, 0, .015));           // a desk in the corridor
  corr.add(box(THREE, .5, 1.05, .34, '#3c4450', '#272e38', 1.85, .55, -9.4, 0, .015));         // the second officer, a shape
  corr.add(bulb(THREE, .13, 0xffd9a0, 2.35, 3.1, -6.2));                                      // corridor ceiling bulb
  corr.add(bulb(THREE, .13, 0xffd9a0, 2.35, 3.1, -9.2));
  // a coat stand + a filing cabinet (dressing, camera side kept clear)
  R.add(box(THREE, .07, 2.2, .07, '#4c3823', '#33250f', -2.7, 1.1, -2.2, 0, .012));
  R.add(box(THREE, .8, .05, .5, '#7d8288', '#585d63', -2.55, .9, -2.3, 0, .015));
  R.add(box(THREE, .8, 1.7, .5, '#6a6e74', '#494d52', 2.8, .85, 1.6, 0, .015));

  // ================= COLLECTION (x +400) =================
  const C = 400, col = new THREE.Group(); col.position.set(C, 0, 0); g.add(col);
  col.add(box(THREE, 13, .08, 10, '#4c3a26', '#33250f', 0, -.01, .5, 0, .01));
  col.add(box(THREE, 10.4, 4.6, .12, '#274434', '#182a1e', 0, 2.3, -3.06, 0, .015));           // bottle-green back wall
  col.add(box(THREE, .12, 4.6, 6.4, '#223c2c', '#14241a', -5.06, 2.3, 0, 0, .015));
  col.add(box(THREE, .12, 4.6, 6.4, '#223c2c', '#14241a', 5.06, 2.3, 0, 0, .015));
  col.add(box(THREE, 12, .14, 9, '#22382a', '#14231a', 0, 4.72, .5, 0, .01));               // ceiling
  // the long wall of looted gilt frames receding both ways (the far end, 25 D class across the hall)
  [[-4.3, 1.05, 1.3, '#7d94b8', '#c8b088', '#e8d9a0'], [-2.9, 1.15, 1.45, '#8a6a4a', '#5d7a52', '#f0e2b0'],
   [.6, 1.0, 1.25, '#6a7d9b', '#b89a68', '#e8d9a0'], [2.1, 1.2, 1.5, '#94744e', '#66784f', '#f4e6b4'],
   [3.7, 1.05, 1.3, '#7d94b8', '#a8843c', '#e8d9a0']].forEach(([fx, fw, fh, c1, c2, c3]) => {
    const f = giltFrame(THREE, fw, fh, c1, c2, c3); f.position.set(fx, 2.45, -2.97); col.add(f);
  });
  [[-4.6, .8, 1.0], [4.5, .85, 1.05]].forEach(([fx, fw, fh]) => {
    const f = giltFrame(THREE, fw, fh, '#5d6e52', '#8a6a42', '#d9c88f'); f.position.set(fx > 0 ? 4.98 : -4.98, 2.3, -1.2);
    f.rotation.y = fx > 0 ? -Math.PI / 2 : Math.PI / 2; col.add(f);
  });
  // crates stacked to the back-right, sheeted frames leaning left
  [[3.6, .35, 1.6, .62, .5, .55], [3.65, .95, 1.7, .58, .48, .5], [4.35, .3, 1.2, .55, .45, .5], [3.6, 1.45, 1.65, .5, .42, .46]]
    .forEach(([x, y, z, w, h, d]) => col.add(box(THREE, w, h, d, '#8a6a42', '#5f4726', x, y, z, .1, .015)));
  [[-3.9, -1.4, .5], [-3.35, -1.1, .42]].forEach(([x, z, ry]) => {
    const sh = box(THREE, 1.15, 1.7, .06, '#cfc8b8', '#a39a86', x, .87, z, ry, .02); col.add(sh);
  });
  const statue = box(THREE, .7, 1.9, .7, '#c4bca8', '#98917c', -4.3, .95, .8, .3, .02); col.add(statue);  // the sheeted statue shape
  // the chandelier (practical 1) + the table lamp by the painting (practical 2)
  const chand = new THREE.Group();
  chand.add(box(THREE, .04, .7, .04, '#2c2c30', '#17171a', 0, -.35, 0, 0, 0));
  [-.5, 0, .5].forEach(dx => { chand.add(bulb(THREE, .11, 0xffd9a0, dx, -.78, 0)); });
  chand.add(box(THREE, 1.3, .05, .05, '#8a6f34', '#5f4c20', 0, -.72, 0, 0, .01));
  chand.position.set(0, 4.55, .4); col.add(chand);
  col.add(box(THREE, .5, .05, .5, '#5d4226', '#3f2c16', -3.3, .5, -0.7, 0, .012));             // lamp table
  col.add(box(THREE, .06, .5, .06, '#37424a', '#232a30', -3.3, .78, -0.7, 0, .01));
  const lampShadeC = part(THREE, new THREE.CylinderGeometry(.14, .26, .26, 14, 1, true), flat('#e8a34c', '#a86f2c'), .015);
  lampShadeC.position.set(-3.3, 1.12, -0.7); col.add(lampShadeC);
  col.add(bulb(THREE, .12, 0xffc98a, -3.3, 1.05, -0.7));
  // a small side table by the painting for the certificate (line 16's stamp table)
  col.add(box(THREE, .8, .05, .6, '#5d4226', '#3f2c16', -2.05, .5, -1.55, 0, .012));
  col.add(box(THREE, .07, .5, .07, '#4c3519', '#33230e', -2.35, .25, -1.75, 0, .01));
  col.add(box(THREE, .07, .5, .07, '#4c3519', '#33230e', -1.75, .25, -1.35, 0, .01));
  // the painting's draped stand (the painting prop stands on it in film.js)
  col.add(box(THREE, 2.0, .16, .9, '#5d1f1f', '#3d1212', -1.1, .08, -2.2, 0, .015));
  col.add(box(THREE, 2.0, .5, .14, '#6e2424', '#4a1414', -1.1, .25, -2.55, 0, .015));

  // ================= STUDIO (x -400) =================
  const S = -400, stu = new THREE.Group(); stu.position.set(S, 0, 0); g.add(stu);
  stu.add(box(THREE, 10.5, .08, 9.5, '#7a5c38', '#573f22', 0, -.01, .5, 0, .01));
  stu.add(box(THREE, 7.2, 4.8, .12, '#8a6f4a', '#5f4726', 0, 2.4, -3.06, 0, .015));
  stu.add(box(THREE, .12, 4.8, 6.4, '#7d6240', '#543e24', -3.56, 2.4, 0, 0, .015));
  stu.add(box(THREE, .12, 4.8, 6.4, '#7d6240', '#543e24', 3.56, 2.4, 0, 0, .015));
  stu.add(box(THREE, 9.5, .14, 9, '#6a5136', '#4c3823', 0, 4.92, .5, 0, .01));              // ceiling
  // the tall north window (practical 1): cool panes + Amsterdam rooftops falling away outside
  stu.add(box(THREE, 2.6, 3.6, .09, '#4c3a24', '#33250f', -.8, 2.7, -2.98, 0, .02));
  const roofTexCv = document.createElement('canvas'); roofTexCv.width = 256; roofTexCv.height = 352;
  { const x = roofTexCv.getContext('2d'); x.fillStyle = '#b8c4cc'; x.fillRect(0, 0, 256, 352);
    x.fillStyle = '#93a5b0'; x.fillRect(0, 0, 256, 130);
    x.fillStyle = '#5d5148'; [[0, 190, 90], [80, 165, 100], [170, 195, 86]].forEach(([rx, ry, rw]) => {
      x.beginPath(); x.moveTo(rx, ry); x.lineTo(rx + rw / 2, ry - 55); x.lineTo(rx + rw, ry); x.closePath(); x.fill();
      x.fillRect(rx, ry, rw, 162); });
    x.fillStyle = '#ffd9a0'; [[30, 230], [120, 215], [200, 245], [60, 285]].forEach(([px, py]) => x.fillRect(px, py, 13, 17));
    x.fillStyle = '#7d97a8'; x.fillRect(0, 322, 256, 30); }
  const roofTex = new THREE.CanvasTexture(roofTexCv); roofTex.colorSpace = THREE.SRGBColorSpace;
  const roofMat = new THREE.MeshBasicMaterial({ map: roofTex });
  const roofs = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.3), roofMat);
  roofs.position.set(-.8, 2.7, -2.92); stu.add(roofs); dyn.roofMat = roofMat;
  stu.add(box(THREE, .07, 3.3, .05, '#4c3a24', '#33250f', -.8, 2.7, -2.9, 0, 0));
  stu.add(box(THREE, 2.3, .07, .05, '#4c3a24', '#33250f', -.8, 2.7, -2.9, 0, 0));
  // THE EASEL (set piece; the fresh painting prop stands on it in film.js)
  const easel = new THREE.Group();
  easel.add(box(THREE, .09, 2.9, .09, '#6e4a26', '#4c3012', -.55, 1.45, 0, 0, .015));
  easel.add(box(THREE, .09, 2.9, .09, '#6e4a26', '#4c3012', .55, 1.45, 0, 0, .015));
  easel.add(box(THREE, 1.3, .08, .08, '#6e4a26', '#4c3012', 0, 2.82, 0, 0, .015));
  easel.add(box(THREE, 1.5, .09, .3, '#7a5a30', '#543e1a', 0, .72, .06, 0, .015));
  easel.add(box(THREE, .09, 2.2, .09, '#6e4a26', '#4c3012', 0, 1.0, -.5, 0, .015));
  easel.position.set(-.9, 0, -.9); easel.rotation.y = .18; stu.add(easel); points.easel = easel;
  // the canvas stack receding along the left wall (depth) + pigment shelves on the right
  for (let i = 0; i < 5; i++) {
    const cv = box(THREE, 1.15, 1.45, .06, ['#d8cdb2', '#c4b28a', '#e0d4ba', '#bfa87c', '#d0c098'][i], '#9a8a64', -3.25, .78, -1.9 + i * .95, .5 + i * .05, .015);
    stu.add(cv);
  }
  [.8, 1.5, 2.2].forEach(sy => stu.add(box(THREE, .34, .05, 2.6, '#6e4f2c', '#4c3519', 3.35, sy, -.6, 0, .012)));
  [['#c8922e', .95, -1.5], ['#274b8f', .95, -.8], ['#7d2f26', .95, -.1], ['#e8e2d2', 1.65, -1.3], ['#3f5a34', 1.65, -.6], ['#c8922e', 2.35, -1.1], ['#5d3a22', 2.35, -.3]]
    .forEach(([c, sy, sz]) => { const jar = part(THREE, new THREE.CylinderGeometry(.09, .09, .24, 10), flat(c, '#4c4438'), .01); jar.position.set(3.35, sy, sz); stu.add(jar); });
  // the stove with its orange glow (practical 2)
  stu.add(box(THREE, .7, .9, .7, '#2e2c2c', '#1a1818', 2.8, .45, -1.9, 0, .02));
  stu.add(glow(THREE, .3, .22, .03, 0xff7a30, 2.8, .42, -1.53));
  const pipe = part(THREE, new THREE.CylinderGeometry(.07, .07, 3.4, 10), flat('#3a3838', '#242222'), .01);
  pipe.position.set(2.8, 2.6, -1.9); stu.add(pipe);
  // the desk + shaded lamp for the evening passes (practical 3)
  stu.add(box(THREE, 1.3, .07, .7, '#6e4f2c', '#4c3519', -2.2, .95, 1.4, .3, .015));
  stu.add(box(THREE, .06, .45, .06, '#37424a', '#232a30', -2.35, 1.2, 1.3, 0, .01));
  const dshade = part(THREE, new THREE.CylinderGeometry(.11, .2, .2, 12, 1, true), flat('#37424a', '#232a30'), .012);
  dshade.position.set(-2.35, 1.5, 1.3); stu.add(dshade);
  stu.add(bulb(THREE, .09, 0xffd9a0, -2.35, 1.44, 1.3));
  // a stool + a draped table with tubes and a jug (dressing)
  stu.add(box(THREE, .5, .06, .5, '#7a5a36', '#573f22', .6, .55, .6, 0, .012));
  stu.add(box(THREE, .07, .55, .07, '#5d4226', '#3f2c16', .6, .27, .6, 0, .01));
  stu.add(box(THREE, .9, .5, .6, '#8a8074', '#5f574c', 1.9, .25, 1.5, -.2, .015));

  // ================= LAB (x +400, z -400) =================
  const L = new THREE.Group(); L.position.set(400, 0, -400); g.add(L);
  L.add(box(THREE, 9.5, .08, 9, '#7d8488', '#585e61', 0, -.01, .5, 0, .01));
  L.add(box(THREE, 6.4, 4.2, .12, '#aeb6b4', '#828a88', 0, 2.1, -2.66, 0, .015));
  L.add(box(THREE, .12, 4.2, 5.6, '#a2aaa8', '#767e7c', -3.06, 2.1, 0, 0, .015));
  L.add(box(THREE, .12, 4.2, 5.6, '#a2aaa8', '#767e7c', 3.06, 2.1, 0, 0, .015));
  L.add(box(THREE, 8.5, .14, 8, '#98a2a0', '#6e7674', 0, 4.32, .5, 0, .01));                 // ceiling
  // the bench run (the microscope + vials props stand on it in film.js)
  L.add(box(THREE, 3.6, .09, .8, '#5d5648', '#403a2e', 0, 1.02, -1.7, 0, .02));
  [[-1.7, -1.95], [1.7, -1.95], [-1.7, -1.45], [1.7, -1.45]].forEach(([x, z]) => L.add(box(THREE, .08, 1.0, .08, '#4c463a', '#332e24', x, .5, z, 0, .01)));
  L.add(box(THREE, 3.4, .5, .06, '#6a6e70', '#4a4e50', 0, .55, -2.05, 0, .012));
  // bottle shelves behind glass on the back wall (receding rows = the depth)
  [.95, 1.6, 2.25].forEach(sy => {
    L.add(box(THREE, 4.6, .05, .3, '#6a6e70', '#4a4e50', 0, sy, -2.45, 0, .012));
    for (let i = 0; i < 9; i++) {
      const bt = part(THREE, new THREE.CylinderGeometry(.07, .07, .26 + (i % 3) * .05, 8),
        flat(['#7fa8b8', '#a8b89a', '#c8b088', '#9a8ab0'][i % 4], '#5d6a70'), .008);
      bt.position.set(-2 + i * .5, sy + .16, -2.45); L.add(bt);
    }
  });
  // the bench lamp (practical 1, hard white) + the Bunsen flame (practical 2)
  L.add(box(THREE, .06, .7, .06, '#37424a', '#232a30', -1.15, 1.4, -1.75, 0, .01));
  const bshade = part(THREE, new THREE.CylinderGeometry(.1, .2, .2, 12, 1, true), flat('#37424a', '#232a30'), .012);
  bshade.position.set(-1.05, 1.82, -1.7); bshade.rotation.z = -.5; L.add(bshade);
  L.add(bulb(THREE, .09, 0xffffff, -.98, 1.76, -1.68));
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.05, .22, 10), new THREE.MeshBasicMaterial({ color: 0x6fa8ff }));
  flame.position.set(1.05, 1.18, -1.6); L.add(flame); dyn.flame = flame;
  L.add(box(THREE, .16, .1, .16, '#3a3a40', '#222226', 1.05, 1.07, -1.6, 0, .01));
  // the tall window at the far end (practical 3)
  L.add(box(THREE, .08, 2.6, 1.6, '#5d6468', '#40464a', 3.0, 2.2, -.6, 0, .02));
  L.add(glow(THREE, .03, 2.3, 1.35, 0xdce8ee, 2.94, 2.2, -.6));
  // a sample tray + jars on the bench (dressing near the props)
  L.add(box(THREE, .7, .04, .4, '#8b9094', '#62676b', .75, 1.08, -1.65, 0, .01));
  [[.55, '#c8922e'], [.75, '#8a4a6a'], [.95, '#4a6a8a']].forEach(([x, c]) => {
    const jar = part(THREE, new THREE.CylinderGeometry(.06, .06, .17, 10), flat(c, '#4c4438'), .008);
    jar.position.set(x, 1.19, -1.65); L.add(jar);
  });

  // ================= COURTROOM (x -400, z -400) =================
  const T = new THREE.Group(); T.position.set(-400, 0, -400); g.add(T);
  T.add(box(THREE, 12, .08, 10.5, '#6e5136', '#4c3823', 0, -.01, .5, 0, .01));
  T.add(box(THREE, 9.4, 5.2, .12, '#5d4226', '#3f2c16', 0, 2.6, -3.66, 0, .015));              // panelled back wall
  for (let i = 0; i < 7; i++) T.add(box(THREE, .14, 5.2, .05, '#4c3519', '#33230e', -4.2 + i * 1.4, 2.6, -3.58, 0, .008));
  T.add(box(THREE, .12, 5.2, 7.4, '#543e24', '#382812', -4.66, 2.6, 0, 0, .015));
  T.add(box(THREE, .12, 5.2, 7.4, '#543e24', '#382812', 4.66, 2.6, 0, 0, .015));
  T.add(box(THREE, 11.5, .14, 10, '#4c3519', '#33230e', 0, 5.32, .5, 0, .01));               // ceiling
  // tall windows on the back wall (practicals): pale shafts either side of the bench
  [-3.1, 3.1].forEach(wx => {
    T.add(box(THREE, 1.5, 3.6, .08, '#3f2c16', '#2a1d0a', wx, 3.1, -3.6, 0, .02));
    T.add(glow(THREE, 1.25, 3.35, .03, 0xf0e6cc, wx, 3.1, -3.55));
    T.add(box(THREE, .06, 3.35, .04, '#3f2c16', '#2a1d0a', wx, 3.1, -3.53, 0, 0));
  });
  // the high bench: platform + long desk (the judge stands on the platform behind it)
  T.add(box(THREE, 5.6, .55, 1.6, '#543e24', '#382812', 0, .275, -2.7, 0, .015));
  T.add(box(THREE, 5.6, 1.05, .5, '#6e4f2c', '#4c3519', 0, 1.07, -2.35, 0, .02));
  T.add(box(THREE, 5.7, .09, .7, '#7a5a36', '#573f22', 0, 1.64, -2.35, 0, .015));
  // brass lamps on the bench (practicals)
  [-1.9, 1.9].forEach(lx => {
    T.add(box(THREE, .05, .5, .05, '#8a6f34', '#5f4c20', lx, 1.9, -2.3, 0, .008));
    T.add(bulb(THREE, .1, 0xffd9a0, lx, 2.2, -2.3));
  });
  // the gavel's sound block on the desk
  const block = part(THREE, new THREE.CylinderGeometry(.16, .16, .05, 16), flat('#5d3a1a', '#3f2608'), .01);
  block.position.set(.7, 1.71, -2.3); T.add(block); points.gavelBlock = block;
  // rows of empty benches falling away behind the dock (the far end for reverse angles)
  [-.4, .9, 2.2].forEach((rz, i) => {
    T.add(box(THREE, 5.2, .09, .55, '#6e4f2c', '#4c3519', 0, .58, rz, 0, .015));
    T.add(box(THREE, 5.2, .75, .07, '#5d4226', '#3f2c16', 0, .95, rz - .3, 0, .015));
    T.add(box(THREE, 5.2, .5, .45, '#543e24', '#382812', 0, .25, rz, 0, .012));
  });
  // the dock: a railed box at centre where Han stands
  T.add(box(THREE, 1.7, .95, .07, '#6e4f2c', '#4c3519', 0, .48, -.95, 0, .015));
  T.add(box(THREE, .07, .95, 1.1, '#6e4f2c', '#4c3519', -.85, .48, -1.45, 0, .015));
  T.add(box(THREE, .07, .95, 1.1, '#6e4f2c', '#4c3519', .85, .48, -1.45, 0, .015));
  // the courtroom door with daylight beyond (line 31's exhale)
  T.add(box(THREE, 1.3, 3.3, .09, '#3f2c16', '#2a1d0a', 3.9, 1.65, -3.6, 0, .02));
  T.add(glow(THREE, 1.05, 3.05, .03, 0xfff2d4, 3.9, 1.6, -3.55));

  let rig; try { rig = createLightRig(THREE, PLACES, {}); } catch { rig = undefined; }
  const look = (rig && opts && opts.post) ? createPost(THREE, rig, opts.post) : undefined;
  if (look && opts && opts.post && opts.post.shade) { try { look.shading = createRigShade(THREE, rig, opts.post.shade); } catch (e) { /* shading optional */ } }
  return {
    ...base, group: g, rig, look,
    marks: { ...(base.marks || {}),
      interrogation: [0, .2], collection: [C, 0], studio: [S, 0], lab: [400, -400], courtroom: [-400, -400] },
    points,
    update(t) {
      base.update?.(t); rig?.update(t);
      // the interrogation lamp: a faint sway, a swing on the arrest beat, settling dead on line 10
      if (dyn.lamp) {
        let a = .012 * Math.sin(t * 1.6);
        if (t > 21 && t < 26) a += .05 * Math.sin((t - 21) * 5.2) * Math.exp(-(t - 21) * .9);
        dyn.lamp.rotation.z = a; dyn.lamp.rotation.x = a * .6;
      }
      // the studio timelapse (line 21, 48.61-50.23): daylight sweeps day -> evening -> day
      if (dyn.roofMat) {
        let k = 1;
        if (t > 48.61 && t < 50.23) { const u = (t - 48.61) / 1.62; k = 1 - .45 * Math.sin(u * Math.PI * 3); }
        dyn.roofMat.color.setScalar(k);
      }
      // the Bunsen flame breathes a fraction
      if (dyn.flame) dyn.flame.scale.y = 1 + .12 * Math.sin(t * 9.3) * Math.sin(t * 3.1);
    },
  };
}
