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
      { id: 'corr2', kind: 'point', color: [1, .85, .6], power: .6, pos: [2.35, 2.6, -17], fall: .05, range: 15 },
      { id: 'alcove', kind: 'point', color: [1, .85, .6], power: .85, pos: [0.05, 2.9, -5.5], fall: .05, range: 13 },
      { id: 'corr3', kind: 'point', color: [1, .85, .6], power: .75, pos: [0.05, 3.0, -16], fall: .05, range: 14 },
      { id: 'corr4', kind: 'point', color: [1, .85, .6], power: .7, pos: [0.05, 3.0, -26], fall: .05, range: 13 },
    ],
  },
  collection: {
    sky: [.4, .44, .38], ground: [.2, .18, .14], fog: { color: '#1e2a20', density: .016 },
    lights: [
      { id: 'chandelier', kind: 'point', color: [1, .8, .52], power: 1.0, pos: [400, 3.4, .4], fall: .06, range: 14 },
      { id: 'lamp', kind: 'point', color: [1, .72, .42], power: .8, pos: [396.7, 1.7, -0.7], fall: .08, range: 8 },
      { id: 'spill', kind: 'point', color: [.6, .72, .9], power: .5, pos: [405.5, 2, 2], fall: .06, range: 10 },
      { id: 'vista', kind: 'point', color: [1, .82, .55], power: 1.0, pos: [399.8, 3.2, -13], fall: .05, range: 16 },
      { id: 'vista2', kind: 'point', color: [1, .82, .55], power: .7, pos: [399.8, 3.2, -23], fall: .05, range: 14 },
    ],
  },
  studio: {
    sky: [.85, .8, .68], ground: [.42, .34, .24], fog: { color: '#8a6f4a', density: .01 },
    lights: [
      { id: 'north', kind: 'spot', color: [.88, .92, 1], power: 1.1, pos: [-400.8, 3.6, -2.8], dir: [.2, -.4, 1], cone: [30, 60], fall: .04, range: 16 },
      { id: 'stove', kind: 'point', color: [1, .5, .2], power: .7, pos: [-397.2, .8, -1.8], fall: .09, range: 7 },
      { id: 'desk', kind: 'point', color: [1, .8, .55], power: .6, pos: [-400.47, 1.9, 1.62], fall: .08, range: 8 },
      { id: 'alcove', kind: 'point', color: [.9, .93, 1], power: .6, pos: [-393.5, 3.2, -.25], fall: .05, range: 14 },
      { id: 'floorlamp', kind: 'point', color: [1, .8, .55], power: .5, pos: [-399.6, 3.0, -4.5], fall: .08, range: 7 },
      { id: 'bay', kind: 'point', color: [.88, .92, 1], power: .9, pos: [-400.8, 3.4, -11], fall: .04, range: 18 },
    ],
  },
  lab: {
    sky: [.8, .86, .88], ground: [.4, .44, .44], fog: { color: '#5d6a68', density: .01 },
    lights: [
      { id: 'benchlamp', kind: 'point', color: [1, .98, .92], power: 1.1, pos: [399.2, 2.6, -401.4], fall: .07, range: 10 },
      { id: 'window', kind: 'spot', color: [.85, .9, .95], power: .7, pos: [402.8, 2.8, -400], dir: [-1, -.3, 0], cone: [30, 60], fall: .05, range: 12 },
      { id: 'bunsen', kind: 'point', color: [.45, .6, 1], power: .55, pos: [400.9, 1.35, -401.5], fall: .12, range: 5 },
      { id: 'vista', kind: 'point', color: [.9, .95, 1], power: .55, pos: [402.2, 3, -413], fall: .05, range: 14 },
      { id: 'svc', kind: 'point', color: [.9, .95, 1], power: .65, pos: [400.75, 3, -410], fall: .05, range: 15 },
      { id: 'panels', kind: 'point', color: [.95, .98, 1], power: .5, pos: [400, 3.9, -401.2], fall: .05, range: 12 },
    ],
  },
  courtroom: {
    sky: [.78, .72, .6], ground: [.34, .28, .2], fog: { color: '#6a5a42', density: .011 },
    lights: [
      { id: 'windows', kind: 'spot', color: [.95, .9, .78], power: 1.0, pos: [-400, 3.8, -403.2], dir: [0, -.35, 1], cone: [35, 65], fall: .04, range: 18 },
      { id: 'brass', kind: 'point', color: [1, .8, .5], power: .65, pos: [-402.8, 2.6, -402.2], fall: .07, range: 10 },
      { id: 'brass2', kind: 'point', color: [1, .8, .5], power: .65, pos: [-398.4, 2.6, -402.2], fall: .07, range: 10 },
      { id: 'vista', kind: 'point', color: [1, .85, .6], power: .75, pos: [-401.7, 3.4, -414], fall: .05, range: 14 },
      { id: 'gallery', kind: 'point', color: [1, .85, .6], power: .85, pos: [-399.9, 4.7, -410], fall: .05, range: 16 },
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
// ENV round 4: a soft halo disc behind a vista bulb (faces +z, toward the room's
// cameras) — makes each bulb in a receding run read as a bright countable disc
function halo(THREE, r, x, y, z) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 18),
    new THREE.MeshBasicMaterial({ color: 0xffe9bb, transparent: true, opacity: .38, depthWrite: false }));
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

export async function buildSet(THREE, scene, opts = {}, kit) {
  const base = kit('plain', {});
  const g = base.group;
  const points = { ...(base.points || {}) };
  const dyn = {};   // materials/groups update(t) animates (pure in t)

  // ================= INTERROGATION (origin) =================
  const R = new THREE.Group(); g.add(R);
  R.add(box(THREE, 13, .08, 11, '#6b5138', '#4c3823', 0, -.01, .5, 0, .01));                  // floor (oversized)
  // ENV round 4 (fault 5): modelled foreground in the bottom third — floor plank
  // seams across the camera-side floor + a worn red rug under the desk's south side
  [2.3, 3.1, 3.9, 4.7].forEach(pz => R.add(box(THREE, 6.2, .014, .07, '#543e24', '#382812', 0, .042, pz, 0, .005)));
  R.add(box(THREE, 3.6, .02, 2.0, '#6e2a26', '#4a1a16', 0, .045, 3.6, 0, .008));
  R.add(box(THREE, 3.28, .022, 1.68, '#7d3a30', '#5a241c', 0, .058, 3.6, 0, .006));
  // ENV round 6 (fault 5, MINOR): the bottom ~18% of f_0 below the desk read as
  // a featureless flat slab — the foreground floor is now MODELLED to the
  // bottom edge: a gilt border + medallion ON the rug, plank seams continuing
  // south past it, and scattered papers on rug and floor (all above the rug's
  // .069 top, per the round-4/5 height lesson)
  R.add(box(THREE, 2.9, .012, .06, '#c8922e', '#8a5f1a', 0, .075, 2.98, 0, .004));
  R.add(box(THREE, 2.9, .012, .06, '#c8922e', '#8a5f1a', 0, .075, 4.22, 0, .004));
  [-1.45, 1.45].forEach(bx => R.add(box(THREE, .06, .012, 1.3, '#c8922e', '#8a5f1a', bx, .075, 3.6, 0, .004)));
  R.add(box(THREE, .72, .012, .72, '#5a1f1a', '#3d130e', 0, .075, 3.6, .78, .004));
  R.add(box(THREE, .4, .014, .4, '#c8922e', '#8a5f1a', 0, .077, 3.6, .78, .004));
  [5.05, 5.7].forEach(pz => R.add(box(THREE, 6.2, .014, .07, '#543e24', '#382812', 0, .042, pz, 0, .005)));
  R.add(box(THREE, .5, .012, .35, '#e8e2d2', '#c9c2ae', -1.25, .08, 4.3, .3, .004));
  R.add(box(THREE, .5, .012, .35, '#ded7c5', '#c0b9a4', 1.5, .08, 3.05, -.2, .004));
  R.add(box(THREE, .5, .012, .35, '#e8e2d2', '#c9c2ae', .95, .05, 5.25, .15, .004));
  R.add(box(THREE, .44, .012, .3, '#e2dccb', '#c4bda7', -.75, .05, 5.5, -.35, .004));
  // back wall in segments (BUILD-FIX): a real open doorway 1.2..3.2 wide, so the lit corridor
  // behind it is genuinely visible in shot instead of a solid slab hiding it
  R.add(box(THREE, 1.55, 4.4, .12, '#5d6066', '#40434a', -2.425, 2.2, -2.66, 0, .015));       // back wall, west of the alcove (ENV round 4: opening widened west, -0.95 -> -1.65)
  R.add(box(THREE, 2.75, .8, .12, '#5d6066', '#40434a', -0.325, 4.0, -2.66, 0, .015));         // lintel over the rear-office alcove (ENV round 4: wider + raised, opening top 3.3 -> 3.6)
  R.add(box(THREE, 2.0, 1.1, .12, '#5d6066', '#40434a', 2.2, 3.85, -2.66, 0, .015));           // lintel over the doorway
  // ENV round 2 (fix): a REAR OFFICE alcove opens in the back wall directly behind both
  // men's heads (x -0.95..1.05) and runs 5.8 D back to a lit window — the in-frame
  // backdrop of every interrogation shot is now layered space, not a wall 1-2 D away
  const alcR = new THREE.Group(); R.add(alcR);
  // ENV round 3 (critic-directed): the rear office is now a full CORRIDOR centred behind
  // both men's heads, running 28 D back from the back wall (z -2.66 -> -30.6): repeated
  // door frames + lit bulbs shrinking along it to a lit window at the far end
  alcR.add(box(THREE, 2.9, .08, 28, '#5d4c36', '#40331f', -0.325, -.01, -16.6, 0, .01));      // corridor floor (ENV round 4: run widened to match the opening)
  alcR.add(box(THREE, .1, 4.4, 28, '#7a7d84', '#565a60', -1.75, 2.2, -16.6, 0, .012));        // corridor west wall (ENV round 4: lightened so the run reads lit, not a dark slot)
  alcR.add(box(THREE, .1, 4.4, 28, '#7a7d84', '#565a60', 1.1, 2.2, -16.6, 0, .012));          // corridor east wall
  alcR.add(box(THREE, 3.0, .12, 28, '#4a4238', '#33291f', -0.325, 4.42, -16.6, 0, .01));      // corridor ceiling
  alcR.add(box(THREE, 3.0, 4.4, .12, '#5d6066', '#40434a', -0.325, 2.2, -30.6, 0, .012));     // corridor end wall (28 D behind the speakers)
  alcR.add(box(THREE, 1.44, 2.74, .08, '#3f444a', '#2a2e33', -0.3, 2.5, -30.52, 0, .02));     // lit window frame, far end (ENV round 4: enlarged)
  alcR.add(glow(THREE, 1.3, 2.6, .03, 0xeaf2f6, -0.3, 2.5, -30.47));
  // repeated door frames across the run — the shrinking rhythm the eye reads as depth
  // (ENV round 4: PALE unlit frames + a near frame at -7, so 4 frames count off in frame)
  [-7, -13, -19, -25].forEach(fz => {
    alcR.add(glow(THREE, .15, 3.3, .13, 0xddd6c2, -1.6, 1.65, fz));
    alcR.add(glow(THREE, .15, 3.3, .13, 0xddd6c2, 1.0, 1.65, fz));
    alcR.add(glow(THREE, 2.75, .2, .13, 0xddd6c2, -0.3, 3.39, fz));
  });
  // lit bulbs falling away along the ceiling (practicals inside the vista)
  // (ENV round 4: bigger bulbs + halos every ~5.5 D, the first just inside the mouth)
  [-5.5, -11, -17, -23, -28.5].forEach(bz => { alcR.add(halo(THREE, .32, -0.3, 3.55, bz + .18)); alcR.add(bulb(THREE, .17, 0xffe2b0, -0.3, 3.55, bz)); });
  // desks + file shelves along the run (the first bay keeps its rear-office dressing)
  alcR.add(box(THREE, 1.2, .07, .55, '#6e5136', '#4c3823', -0.25, .95, -7.55, 0, .015));       // a desk in the rear office
  alcR.add(box(THREE, .45, .9, .4, '#4c4f55', '#33363b', 0.55, .45, -7.3, 0, .012));           // a clerk's chair shape
  alcR.add(box(THREE, 1.2, .07, .55, '#6e5136', '#4c3823', -0.3, .95, -16.5, 0, .015));
  alcR.add(box(THREE, 1.2, .07, .55, '#6e5136', '#4c3823', 0.35, .95, -22.5, 0, .015));
  [.9, 1.5, 2.1].forEach(sy => alcR.add(box(THREE, .3, .05, 1.7, '#4c4f55', '#33363b', 0.92, sy, -5.6, 0, .01)));
  [.9, 1.5, 2.1].forEach((sy, si) => { for (let i = 0; i < 4; i++) alcR.add(box(THREE, .18, .3, .16, ['#7d2f26', '#274b8f', '#c8922e', '#3f5a34'][(i + si) % 4], '#4c4438', 0.92, sy + .18, -6.25 + i * .42, 0, .008)); });
  [-14, -20].forEach(sz => {
    alcR.add(box(THREE, .3, .05, 1.7, '#4c4f55', '#33363b', -1.55, 1.5, sz, 0, .01));
    for (let i = 0; i < 4; i++) alcR.add(box(THREE, .18, .3, .16, ['#274b8f', '#c8922e', '#7d2f26', '#3f5a34'][(i + 1) % 4], '#4c4438', -1.55, 1.68, sz - .62 + i * .42, 0, .008));
  });
  alcR.add(box(THREE, .06, 2.5, 1.1, '#4c4f55', '#33363b', -1.68, 1.25, -6.4, 0, .012));      // a doorway frame on the corridor's west wall (ENV round 4: moved with the widened wall)
  alcR.add(bulb(THREE, .15, 0xffd9a0, -0.3, 3.9, -4.6));
  alcR.add(bulb(THREE, .15, 0xffd9a0, -0.3, 3.9, -7.4));
  // ENV round 3 (fault 4): a lit PENDANT hanging in the corridor, centred in the arch
  // (0.05, -8) — the second VISIBLE practical in the southern interrogation frames.
  // (First attempt — sconces on the arch reveals — grazed the hero's ear in f_0 and
  // was removed; the pendant hangs in the gap between the two heads, clear of both
  // silhouettes, and its shade/bulb read inside the vista in f_0/f_39.)
  // (drop lengthened after the first env3 f_0 still + crop: at bulb y 2.66 the bulb
  // sat in the main pendant shade's eclipse cone and never read; at y 2.32 it hangs
  // in the dark gap between the two heads, clear of both silhouettes)
  alcR.add(box(THREE, .03, 1.85, .03, '#2c2c30', '#17171a', -0.1, 3.5, -6.5, 0, 0));
  const cshade = part(THREE, new THREE.CylinderGeometry(.18, .45, .36, 14, 1, true), flat('#37424a', '#232a30'), .015);
  cshade.position.set(-0.1, 2.5, -6.5); alcR.add(cshade);
  alcR.add(bulb(THREE, .2, 0xffe2b0, -0.1, 2.3, -6.5));
  R.add(box(THREE, .12, 4.4, 3.4, '#55585e', '#3a3d42', -3.06, 2.2, -.9, 0, .015));            // left wall
  // ENV round 6 (fault 4, critic-directed): the f_26 angle faces this WEST wall
  // and depth collapsed to ~3 D. The wall is extended south with a DOORWAY
  // RECESS (z 1.0..2.3) BESIDE the hero's head in that framing, opening west
  // onto a 25 D+ corridor in the interrogation corridor's own language: pale
  // frames, haloed pendant bulbs, a lit far end
  R.add(box(THREE, .12, 4.4, .2, '#55585e', '#3a3d42', -3.06, 2.2, .9, 0, .015));
  R.add(box(THREE, .12, 1.1, 1.3, '#55585e', '#3a3d42', -3.06, 3.85, 1.65, 0, .015));
  R.add(box(THREE, .12, 4.4, .7, '#55585e', '#3a3d42', -3.06, 2.2, 2.65, 0, .015));
  R.add(box(THREE, .09, 3.3, .09, '#4c4f55', '#33363b', -3.06, 1.65, 1.02, 0, .02));
  R.add(box(THREE, .09, 3.3, .09, '#4c4f55', '#33363b', -3.06, 1.65, 2.28, 0, .02));
  const corrW = new THREE.Group(); R.add(corrW);
  corrW.add(box(THREE, 25.5, .08, 1.3, '#5d4c36', '#40331f', -16.3, -.01, 1.65, 0, .01));
  corrW.add(box(THREE, 25.5, 3.6, .1, '#7a7d84', '#565a60', -16.3, 1.8, 1.04, 0, .012));
  corrW.add(box(THREE, 25.5, 3.6, .1, '#7a7d84', '#565a60', -16.3, 1.8, 2.26, 0, .012));
  corrW.add(box(THREE, 25.5, .12, 1.3, '#4a4238', '#33291f', -16.3, 3.66, 1.65, 0, .01));
  corrW.add(box(THREE, .12, 3.6, 1.3, '#5d6066', '#40434a', -29.0, 1.8, 1.65, 0, .012));
  corrW.add(glow(THREE, .05, 2.2, .95, 0xffe2b0, -28.9, 1.9, 1.65));
  [-8, -13, -18, -23].forEach(fx => {
    corrW.add(glow(THREE, .13, 3.3, .15, 0xddd6c2, fx, 1.65, 1.12));
    corrW.add(glow(THREE, .13, 3.3, .15, 0xddd6c2, fx, 1.65, 2.18));
    corrW.add(glow(THREE, .13, .2, 1.2, 0xddd6c2, fx, 3.39, 1.65));
  });
  [-6, -11, -16, -21, -26].forEach(bx => { corrW.add(halo(THREE, .3, bx, 3.0, 1.83)); corrW.add(bulb(THREE, .16, 0xffe2b0, bx, 3.0, 1.65)); });
  R.add(box(THREE, .12, 4.4, 3.4, '#55585e', '#3a3d42', 3.06, 2.2, -.9, 0, .015));             // right wall
  R.add(box(THREE, 13, .14, 11, '#4a4238', '#33291f', 0, 4.42, .5, 0, .01));                  // ceiling (oversized: no sky leak)
  // the table (ENV round 2, critic-directed): a SOLID desk — its top moved 0.6 D toward
  // the cameras (centre z 0.1 -> 0.7) and deepened to 1.98 so the casefile (z 0.3) and
  // cuffs (z -0.05) props still land on it, over a floor-to-top solid body with panelled
  // faces. Both men read on the far side of its top plane: the hero (z 1.05) stands
  // behind its front face (1.69), the officer (z -0.55) behind its back face (-0.29);
  // every leg is inside/behind the solid body and genuinely occluded — no open
  // under-space remains for legs to read through as piercing the top.
  R.add(box(THREE, 2.3, .09, 1.98, '#7a5a36', '#573f22', 0, 1.0, .7, 0, .02));
  R.add(box(THREE, 2.14, .93, 1.78, '#654626', '#473118', 0, .485, .7, 0, .015));
  R.add(box(THREE, 2.2, .09, 1.84, '#543e24', '#382812', 0, .045, .7, 0, .012));
  [-.55, .55].forEach(px => R.add(box(THREE, .88, .6, .045, '#6e4f2c', '#4c3519', px, .5, 1.6, 0, .01)));
  R.add(box(THREE, 2.14, .07, .045, '#7a5a36', '#573f22', 0, .87, 1.6, 0, .01));
  [-1.08, 1.08].forEach(px => R.add(box(THREE, .045, .6, 1.2, '#6e4f2c', '#4c3519', px, .5, .7, 0, .01)));
  // a raised rear ledge behind the hero's side of the desk (papers + inkwell on it):
  // it breaks the sightline to the tops of his legs where they meet the desktop, so
  // no leg stub reads as standing on the desk surface
  R.add(box(THREE, 2.3, .22, .06, '#6e4f2c', '#4c3519', 0, 1.13, 1.63, 0, .012));
  R.add(box(THREE, 1.1, .18, .25, '#6e4f2c', '#4c3519', -0.65, 1.13, -0.17, 0, .012));
  R.add(box(THREE, .5, .04, .3, '#e8e2d2', '#c9c2ae', -0.82, 1.24, -0.17, 0, .008));
  R.add(box(THREE, .09, .07, .09, '#2c2c30', '#17171a', -0.32, 1.25, -0.17, 0, .008));
  R.add(box(THREE, .62, .75, .07, '#6e4f2c', '#4c3519', -2.78, .85, .45, 1.35, .015));        // hero's chair — ENV round 2: against the WEST wall, 1.9 D from him; anywhere south of him it sat between the southern cameras and his legs (f_5/f_21/f_26)
  R.add(box(THREE, .62, .07, .55, '#7a5a36', '#573f22', -2.5, .55, .45, 1.35, .015));
  R.add(box(THREE, .62, .75, .07, '#6e4f2c', '#4c3519', 1.05, .85, -2.32, -.45, .015));        // officer's chair back — against the back wall
  R.add(box(THREE, .62, .07, .55, '#7a5a36', '#573f22', .97, .55, -2.08, -.45, .015));
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
  map.position.set(.88, 2.45, -30.53); map.scale.setScalar(.72); R.add(map);   // ENV round 3: on the corridor's far end wall, beside its lit window, seen through the arch (ENV round 4: shifted east of the enlarged window)
  // the wall clock — ENV round 2: moved to the west wall (its old spot is inside the alcove opening)
  // ENV round 5 (fault 5, critic-directed): clock AND west sconce moved 1.3 D SOUTH
  // along the west wall (clock z -0.9 -> 0.4, sconce z -1.75 -> -0.45) — at their old
  // spots the clock's rim crowned the hero's head and the sconce sat half-hidden
  // behind it across the line 11-13 shots (f_26/f_29_5)
  const clockG = new THREE.Group(); clockG.position.set(-2.99, 3.1, 0.4); clockG.rotation.y = Math.PI / 2; R.add(clockG);
  const clockF = new THREE.Mesh(new THREE.CircleGeometry(.3, 22), new THREE.MeshBasicMaterial({ color: 0xf2ead8 }));
  clockF.position.z = .01; clockG.add(clockF);
  const clockR = part(THREE, new THREE.TorusGeometry(.3, .03, 8, 22), flat('#37424a', '#232a30'));
  clockR.position.z = .01; clockG.add(clockR);
  clockG.add(box(THREE, .03, .2, .02, '#2c2c2c', '#1c1c1c', 0, .06, .03, 0, 0));
  clockG.add(box(THREE, .16, .03, .02, '#2c2c2c', '#1c1c1c', .07, -.02, .03, 0, 0));
  // THE DOOR (back-right) open onto the lit corridor — the far end: corridor walls falling away,
  // a desk + a second officer silhouette + frosted glow at the end (depth 25 D class via the hall)
  // door frame as posts + head only (BUILD-FIX): the opening itself stays open to the corridor
  R.add(box(THREE, .09, 3.3, .09, '#4c4f55', '#33363b', 1.24, 1.65, -2.6, 0, .02));
  R.add(box(THREE, .09, 3.3, .09, '#4c4f55', '#33363b', 3.16, 1.65, -2.6, 0, .02));
  R.add(box(THREE, 2.0, .1, .09, '#4c4f55', '#33363b', 2.2, 3.32, -2.6, 0, .02));
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
  // BUILD-FIX: the corridor now runs a full 28 D back from the doorway (the far end 25 D+
  // behind the speakers on the camera's main axis): floor/walls/ceiling extended, a bulb
  // every ~6 D falling away, desks and doorways along it, frosted glow at the far end
  corr.add(box(THREE, 2.2, .08, 19, '#5d4c36', '#40331f', 2.35, -.01, -21, 0, .01));
  corr.add(box(THREE, .1, 3.6, 19, '#6a6d72', '#484b4f', 1.3, 1.8, -21, 0, .01));
  corr.add(box(THREE, .1, 3.6, 19, '#62656a', '#42454a', 3.4, 1.8, -21, 0, .01));
  corr.add(box(THREE, 2.2, .12, 19, '#4a4238', '#33291f', 2.35, 3.66, -21, 0, .01));
  corr.add(box(THREE, 2.2, 3.6, .1, '#7a7d82', '#55585c', 2.35, 1.8, -30.4, 0, .01));
  corr.add(glow(THREE, 1.5, 2.2, .05, 0xffe2b0, 2.35, 1.9, -30.3));
  [-14, -20, -26].forEach(bz => corr.add(bulb(THREE, .13, 0xffd9a0, 2.35, 3.1, bz)));
  corr.add(box(THREE, 1.3, .07, .6, '#6e5136', '#4c3823', 2.9, .95, -16.5, 0, .015));
  corr.add(box(THREE, 1.3, .07, .6, '#6e5136', '#4c3823', 1.8, .95, -23.5, 0, .015));
  corr.add(box(THREE, .5, 1.05, .34, '#3c4450', '#272e38', 2.9, .55, -19.5, 0, .015));
  [-15, -22].forEach(bz => corr.add(box(THREE, .05, 2.4, 1.1, '#4c4f55', '#33363b', 1.37, 1.2, bz, 0, .012)));
  // a notice board — ENV round 2: on the rear office's east wall, seen through the arch
  R.add(box(THREE, .05, 1.3, 1.1, '#8a6f4d', '#6b543a', 1.03, 2.3, -5.2, 0, .012));
  R.add(box(THREE, .02, .44, .34, '#e8e2d2', '#c9c2ae', 0.99, 2.48, -5.45, 0, .01));
  R.add(box(THREE, .02, .44, .34, '#ded7c5', '#c0b9a4', 0.99, 2.42, -4.95, 0, .01));
  R.add(box(THREE, .02, .4, .34, '#e2dccb', '#c4bda7', 0.99, 1.95, -5.2, 0, .01));
  // ENV round 2: two wall panels on the east wall (the orbit shots' side backdrop)
  [-1.7, -0.3].forEach(pz => R.add(box(THREE, .05, 1.9, .7, '#5d6066', '#40434a', 3.0, 2.6, pz, 0, .012)));
  // ENV round 2: framed photos on the west wall + a bookcase at its north end (the west
  // cameras' background was a flat wall; both are 2+ D clear of the hero)
  [[-1.9, 2.9], [-0.9, 2.6]].forEach(([pz, py]) => {
    R.add(box(THREE, .05, .62, .5, '#4c3a24', '#33250f', -3.0, py, pz, 0, .012));
    R.add(box(THREE, .03, .48, .38, '#c8bfa8', '#9a917c', -2.97, py, pz, 0, 0));
  });
  R.add(box(THREE, .34, 2.0, 1.0, '#5d4226', '#3f2c16', -2.82, 1.0, -1.85, 0, .015));
  [.45, 1.0, 1.55].forEach(sy => { for (let i = 0; i < 4; i++) R.add(box(THREE, .2, .3, .07, ['#7d2f26', '#274b8f', '#3f5a34', '#c8922e'][(i + sy * 2) % 4], '#4c4438', -2.82, sy, -2.14 + i * .2, 0, .008)); });
  // ENV round 3 (fault 4): a lit wall sconce on the WEST wall — the second visible
  // practical in the orbit shots (f_5), whose backdrop is the west wall; high on the
  // wall, clear of the clock (z -0.9) and of every head silhouette
  R.add(box(THREE, .06, .46, .16, '#a87c2c', '#77571d', -2.98, 2.95, -0.45, 0, .01));
  const wsconce = part(THREE, new THREE.CylinderGeometry(.09, .19, .17, 12, 1, true), flat('#a87c2c', '#77571d'), .01);
  wsconce.position.set(-2.9, 3.13, -0.45); R.add(wsconce);
  R.add(bulb(THREE, .085, 0xffd9a0, -2.9, 3.05, -0.45));
  // a coat stand + a filing cabinet (dressing, camera side kept clear)
  R.add(box(THREE, .07, 2.2, .07, '#4c3823', '#33250f', -2.7, 1.1, -2.2, 0, .012));
  R.add(box(THREE, .8, .05, .5, '#7d8288', '#585d63', -2.55, .9, -2.3, 0, .015));
  R.add(box(THREE, .8, 1.7, .5, '#6a6e74', '#494d52', 2.8, .85, 1.6, 0, .015));

  // ================= COLLECTION (x +400) =================
  const C = 400, col = new THREE.Group(); col.position.set(C, 0, 0); g.add(col);
  col.add(box(THREE, 13, .08, 10, '#4c3a26', '#33250f', 0, -.01, .5, 0, .01));
  // ENV round 5 (fault 4, critic-directed): the gallery's camera-side floor was a
  // solid featureless brown slab for the bottom ~25% of f_34/f_16 — now MODELLED:
  // plank seams across the boards, a patterned rug (gilt border, green field,
  // centre medallion) centre-frame, and scattered boards + papers strewn over
  // the foreground boards. All dressing sits at y .042-.06, above the floor
  // slab's .03 surface (the round-4 height lesson), south of every standing
  // position (nearest figure: the hero at z 0.85, dressing starts z 2.2).
  [2.2, 3.0, 3.8, 4.6].forEach(pz => col.add(box(THREE, 10.0, .014, .07, '#33250f', '#201605', 0, .042, pz, 0, .005)));
  col.add(box(THREE, 4.4, .02, 2.6, '#a87c2c', '#77571d', 0.2, .045, 3.4, 0, .008));
  col.add(box(THREE, 4.05, .022, 2.25, '#5d2a24', '#401a14', 0.2, .052, 3.4, 0, .006));
  col.add(box(THREE, 3.5, .024, 1.75, '#274434', '#182a1e', 0.2, .058, 3.4, 0, .005));
  col.add(box(THREE, 1.5, .026, .85, '#a87c2c', '#77571d', 0.2, .06, 3.4, 0, .005));
  [[-2.9, 2.3, .4], [3.1, 2.6, -.3], [2.7, 4.3, .9], [-3.4, 4.1, -.6], [1.2, 1.9, .2], [-3.4, 2.9, .15]].forEach(([px, pz, ry]) =>
    col.add(box(THREE, .52, .014, .36, '#e8e2d2', '#c9c2ae', px, .048, pz, ry, .004)));
  col.add(box(THREE, .52, .014, .36, '#e8e2d2', '#c9c2ae', -0.9, .082, 3.9, .35, .004));   // one paper ON the rug (rug top y .073)
  [[-1.3, 4.35, .15, .082], [2.3, 3.65, -.2, .082], [-3.1, 3.5, .5, .05]].forEach(([px, pz, ry, py]) =>
    col.add(box(THREE, 1.45, .03, .19, '#8a6a42', '#5f4726', px, py, pz, ry, .006)));
  // back wall in segments (BUILD-FIX): a wide open archway -1.4..1.0 onto a gallery vista
  // running 28 D back, so the hall has a real far end behind the speakers, not a flat wall
  col.add(box(THREE, 3.3, 4.6, .12, '#274434', '#182a1e', -3.55, 2.3, -3.06, 0, .015));         // bottle-green back wall, west
  col.add(box(THREE, 3.7, 4.6, .12, '#274434', '#182a1e', 3.35, 2.3, -3.06, 0, .015));          // back wall, east
  col.add(box(THREE, 3.4, 1.2, .12, '#274434', '#182a1e', -0.2, 4.0, -3.06, 0, .015));           // lintel over the archway (ENV round 2: arch widened -1.9..1.5 so the vista enters more frames)
  const vistaC = new THREE.Group(); col.add(vistaC);
  vistaC.add(box(THREE, 3.4, .08, 28, '#4c3a26', '#33250f', -0.2, -.01, -17, 0, .01));
  vistaC.add(box(THREE, .12, 4.6, 28, '#3d6b4f', '#24452f', -1.9, 2.3, -17, 0, .012));
  vistaC.add(box(THREE, .12, 4.6, 28, '#3d6b4f', '#24452f', 1.5, 2.3, -17, 0, .012));
  vistaC.add(box(THREE, 3.4, .12, 28, '#356049', '#22402e', -0.2, 4.66, -17, 0, .01));
  vistaC.add(box(THREE, 3.4, 4.6, .12, '#274434', '#182a1e', -0.2, 2.3, -31, 0, .012));
  // ENV round 3 (fault 2): the vista must READ from the f_34 camera — a bigger lit far
  // end with a gilt surround, larger bulbs, cross-beams shrinking along the run, a
  // plinth silhouette mid-run and picture-light bars over the receding frames
  vistaC.add(box(THREE, 2.9, 3.9, .06, '#a87c2c', '#77571d', -0.2, 2.6, -30.94, 0, .01));
  vistaC.add(glow(THREE, 2.6, 3.6, .05, 0xffe9c0, -0.2, 2.6, -30.9));
  // ENV round 4: bigger haloed bulbs every ~5.5 D + PALE cross-frames spanning the
  // vista, so the run counts off 4+ repeated features from the f_34 camera
  [-5, -10.5, -16, -21.5, -27].forEach(bz => { vistaC.add(halo(THREE, .36, -0.2, 3.9, bz + .2)); vistaC.add(bulb(THREE, .2, 0xffe2b0, -0.2, 3.9, bz)); });
  [-8, -14, -20, -26].forEach(fz => {
    vistaC.add(glow(THREE, .14, 3.6, .13, 0xcbb27a, -1.8, 1.8, fz));
    vistaC.add(glow(THREE, .14, 3.6, .13, 0xcbb27a, 1.4, 1.8, fz));
    vistaC.add(glow(THREE, 3.34, .18, .13, 0xcbb27a, -0.2, 3.69, fz));
  });
  [-9, -15, -21, -27].forEach(bz => vistaC.add(box(THREE, 3.4, .16, .2, '#1c2b20', '#101a12', -0.2, 4.5, bz, 0, .01)));
  vistaC.add(box(THREE, .5, 1.05, .5, '#c4bca8', '#98917c', -1.25, .52, -16.5, 0, .015));
  vistaC.add(box(THREE, .3, .16, .3, '#c4bca8', '#98917c', -1.25, 1.12, -16.5, 0, .01));
  vistaC.add(box(THREE, 1.8, .09, .45, '#4c3519', '#33230e', -0.2, .5, -23, 0, .012));
  vistaC.add(box(THREE, 1.7, .45, .35, '#3f2c16', '#2a1d0a', -0.2, .22, -23, 0, .012));
  [[-10, 1], [-18, 1], [-26, 1], [-14, -1], [-22, -1]].forEach(([fz, side]) => {
    const f = giltFrame(THREE, .85, 1.05, '#7d94b8', '#a8843c', '#e8d9a0');
    f.position.set(side > 0 ? -1.82 : 1.42, 2.4, fz); f.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2; vistaC.add(f);
  });
  // ENV round 2: a lit side doorway mid-vista + picture-light bars over the main frames
  vistaC.add(box(THREE, .06, 2.5, 1.16, '#1c2b20', '#101a12', 1.44, 1.25, -18, 0, .012));
  vistaC.add(glow(THREE, .03, 2.3, 1.0, 0xffe2b0, 1.4, 1.9, -18));
  // ENV round 3: a matching lit doorway on the WEST wall mid-run + picture-light bars
  // over the vista's own receding frames, so both walls read modelled along the run
  vistaC.add(box(THREE, .06, 2.5, 1.16, '#1c2b20', '#101a12', -1.84, 1.25, -23, 0, .012));
  vistaC.add(glow(THREE, .03, 2.3, 1.0, 0xffe2b0, -1.8, 1.9, -23));
  [[-10, -1.8], [-18, -1.8], [-26, -1.8], [-14, 1.4], [-22, 1.4]].forEach(([fz, fx]) =>
    vistaC.add(box(THREE, .04, .05, .95, '#a87c2c', '#77571d', fx, 3.05, fz, 0, .008)));
  [[-2.9, 3.32], [2.1, 3.42]].forEach(([fx, fy]) => col.add(box(THREE, 1.0, .05, .05, '#a87c2c', '#77571d', fx, fy, -2.9, 0, .008)));
  vistaC.add(box(THREE, .62, .5, .55, '#8a6a42', '#5f4726', 0.65, .25, -11, .1, .015));
  vistaC.add(box(THREE, .58, .48, .5, '#8a6a42', '#5f4726', -0.95, .24, -19, -.08, .015));
  col.add(box(THREE, .12, 4.6, 6.4, '#223c2c', '#14241a', -5.06, 2.3, 0, 0, .015));
  col.add(box(THREE, .12, 4.6, 6.4, '#223c2c', '#14241a', 5.06, 2.3, 0, 0, .015));
  col.add(box(THREE, 12, .14, 9, '#22382a', '#14231a', 0, 4.72, .5, 0, .01));               // ceiling
  // ENV round 2: dark beams across the gallery ceiling + a wainscot line and a second,
  // smaller frame row on the back wall (the gallery frames were the flattest sampled)
  [-1.5, .8, 3.0].forEach(bz => col.add(box(THREE, 10.2, .16, .22, '#1c2b20', '#101a12', 0, 4.6, bz, 0, .01)));
  col.add(box(THREE, 10.2, .5, .06, '#1e3325', '#12211a', 0, .25, -2.98, 0, .01));
  [[-3.9, .62, .78], [-2.2, .58, .72], [2.9, .6, .75], [4.3, .55, .68]].forEach(([fx, fw, fh]) => {
    const f = giltFrame(THREE, fw, fh, '#8a7a5a', '#5d6e52', '#e8d9a0'); f.position.set(fx, 3.75, -2.97); col.add(f);
  });
  // the long wall of looted gilt frames receding both ways (the far end, 25 D class across the hall)
  [[-4.3, 1.05, 1.3, '#7d94b8', '#c8b088', '#e8d9a0'], [-2.9, 1.15, 1.45, '#8a6a4a', '#5d7a52', '#f0e2b0'],
   [2.1, 1.2, 1.5, '#94744e', '#66784f', '#f4e6b4'],
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
  // (ENV: slimmed + shifted south so the expert at (-2.4,-1.95) stands 0.3 D clear of its
  // north edge; the certificate prop at (-2.05,-1.55) still lands on its top)
  col.add(box(THREE, .8, .05, .4, '#5d4226', '#3f2c16', -2.05, .5, -1.45, 0, .012));
  col.add(box(THREE, .07, .5, .07, '#4c3519', '#33230e', -2.35, .25, -1.6, 0, .01));
  col.add(box(THREE, .07, .5, .07, '#4c3519', '#33230e', -1.75, .25, -1.3, 0, .01));
  // the painting's draped stand (the painting prop stands on it in film.js)
  // (ENV: narrowed/shifted east so its west end clears the expert's standing volume by 0.6 D)
  col.add(box(THREE, 1.7, .16, .9, '#5d1f1f', '#3d1212', -0.95, .08, -2.2, 0, .015));
  col.add(box(THREE, 1.7, .5, .14, '#6e2424', '#4a1414', -0.95, .25, -2.55, 0, .015));

  // ================= STUDIO (x -400) =================
  const S = -400, stu = new THREE.Group(); stu.position.set(S, 0, 0); g.add(stu);
  stu.add(box(THREE, 10.5, .08, 9.5, '#7a5c38', '#573f22', 0, -.01, .5, 0, .01));
  // ENV round 3 (fault 2): the north wall is segmented around the tall window bay
  // (x -2.1..0.5, y 0.9..4.5) — the bay is now a real receding GLAZED LOGGIA centred
  // behind the hero's face in the f_46 shot: side walls with lit window frames and
  // door frames shrinking 26 D north to a big lit end window (the rooftops plane
  // moved there), instead of a flat picture 0.06 behind the glass
  stu.add(box(THREE, 0.9, 4.8, .12, '#8a6f4a', '#5f4726', -3.15, 2.4, -3.06, 0, .015));      // north wall, west of the bay (ENV round 4: window widened 2.6 -> 3.8)
  stu.add(box(THREE, 2.5, 4.8, .12, '#8a6f4a', '#5f4726', 2.35, 2.4, -3.06, 0, .015));       // north wall, east of the bay
  stu.add(box(THREE, 3.8, .9, .12, '#8a6f4a', '#5f4726', -.8, .45, -3.06, 0, .015));         // sill under the bay
  stu.add(box(THREE, 3.8, .3, .12, '#8a6f4a', '#5f4726', -.8, 4.65, -3.06, 0, .015));        // lintel over the bay
  const bayS = new THREE.Group(); stu.add(bayS);
  bayS.add(box(THREE, 3.8, .08, 26, '#7a5c38', '#573f22', -.8, -.01, -16.06, 0, .01));
  bayS.add(box(THREE, .12, 4.5, 26, '#967950', '#6e5136', -2.76, 2.25, -16.06, 0, .012));
  bayS.add(box(THREE, .12, 4.5, 26, '#967950', '#6e5136', 1.16, 2.25, -16.06, 0, .012));
  bayS.add(box(THREE, 3.8, .12, 26, '#6a5136', '#4c3823', -.8, 4.56, -16.06, 0, .01));
  bayS.add(box(THREE, 3.8, 4.8, .12, '#8a6f4a', '#5f4726', -.8, 2.4, -29.06, 0, .012));      // loggia end wall, 26 D behind the window line
  bayS.add(box(THREE, 2.6, 3.4, .08, '#4c3a24', '#33250f', -.8, 2.6, -28.98, 0, .02));       // the far end window frame (ENV round 4: enlarged)
  bayS.add(glow(THREE, 2.5, 3.2, .03, 0xeaf2f6, -.8, 2.6, -28.93));
  // repeated lit window frames along the side walls, alternating, shrinking away
  [-9, -15, -21].forEach(wz => {
    bayS.add(box(THREE, .05, 2.3, 1.16, '#4c3a24', '#33250f', -2.68, 2.5, wz, 0, .012));
    bayS.add(glow(THREE, .03, 2.05, .95, 0xdce8ee, -2.65, 2.5, wz));
  });
  [-12, -18, -24].forEach(wz => {
    bayS.add(box(THREE, .05, 2.3, 1.16, '#4c3a24', '#33250f', 1.08, 2.5, wz, 0, .012));
    bayS.add(glow(THREE, .03, 2.05, .95, 0xffe2b0, 1.05, 2.5, wz));
  });
  // door frames across the loggia + bulbs falling away along its ceiling
  // (ENV round 4: frames PALE so they count off, bulbs bigger + haloed)
  // ENV round 6 (fault 3): frames now at FIVE stations (-6/-11/-16/-19/-24) so
  // the loggia's recession counts off inside the area f_46 actually shows, and
  // the haloed bulbs move to the bay's WEST side (x -0.8 -> -2.0): in f_46 the
  // old first bulb sat directly behind the top of the hero's head
  [-6, -11, -16, -19, -24].forEach(fz => {
    bayS.add(glow(THREE, .12, 3.4, .11, 0xe2d8bc, -2.62, 1.7, fz));
    bayS.add(glow(THREE, .12, 3.4, .11, 0xe2d8bc, 1.02, 1.7, fz));
    bayS.add(glow(THREE, 3.76, .18, .11, 0xe2d8bc, -.8, 3.48, fz));
  });
  [-8, -14, -20, -26].forEach(bz => { bayS.add(halo(THREE, .34, -2.0, 3.85, bz + .2)); bayS.add(bulb(THREE, .18, 0xfff2d4, -2.0, 3.85, bz)); });
  bayS.add(box(THREE, 1.15, 1.45, .06, '#c4b28a', '#9a8a64', -1.9, .78, -9.5, .2, .015));   // ENV round 6: extra boards inside the bay, shrinking with the run
  bayS.add(box(THREE, 1.15, 1.45, .06, '#d8cdb2', '#9a8a64', 0.3, .78, -17.5, -.2, .015));
  bayS.add(box(THREE, 1.15, 1.45, .06, '#d8cdb2', '#9a8a64', -1.75, .78, -6.5, .3, .015));   // canvases leaning in the bay
  bayS.add(box(THREE, 1.15, 1.45, .06, '#c4b28a', '#9a8a64', 0.15, .78, -13, -.25, .015));
  // west wall in segments (ENV round 2): a doorway z -0.9..0.5 opens west into a lit
  // hall running 6 D to a glowing end window — the backdrop of the east (line-22)
  // camera, behind the canvas stack; the glb shelf unit now stands on the south seg
  stu.add(box(THREE, .12, 4.8, 2.3, '#7d6240', '#543e24', -3.56, 2.4, -2.05, 0, .015));
  stu.add(box(THREE, .12, 4.8, 2.7, '#7d6240', '#543e24', -3.56, 2.4, 1.85, 0, .015));
  stu.add(box(THREE, .12, 1.4, 1.4, '#7d6240', '#543e24', -3.56, 4.1, -0.2, 0, .015));
  const hallS = new THREE.Group(); stu.add(hallS);
  // ENV round 3: the west hall now runs a full 26 D (x -3.56 -> -29.5) with door
  // frames across it and bulbs falling away to the lit end window
  hallS.add(box(THREE, 25.94, .08, 2.6, '#7a5c38', '#573f22', -16.53, -.01, -0.2, 0, .01));
  hallS.add(box(THREE, 25.94, 4.8, .12, '#7d6240', '#543e24', -16.53, 2.4, -1.44, 0, .012));
  hallS.add(box(THREE, 25.94, 4.8, .12, '#7d6240', '#543e24', -16.53, 2.4, 1.04, 0, .012));
  hallS.add(box(THREE, 25.94, .12, 2.6, '#6a5136', '#4c3823', -16.53, 4.86, -0.2, 0, .01));
  hallS.add(box(THREE, .12, 4.8, 2.6, '#8a6f4a', '#5f4726', -29.5, 2.4, -0.2, 0, .012));
  hallS.add(box(THREE, .08, 2.6, 1.5, '#4c3a24', '#33250f', -29.42, 2.5, -0.2, 0, .02));
  hallS.add(glow(THREE, .04, 2.3, 1.2, 0xdce8ee, -29.36, 2.5, -0.2));
  [-13, -19, -25].forEach(fx => {
    hallS.add(box(THREE, .1, 3.4, .1, '#4c3a24', '#33250f', fx, 1.7, -1.3, 0, .012));
    hallS.add(box(THREE, .1, 3.4, .1, '#4c3a24', '#33250f', fx, 1.7, 0.9, 0, .012));
    hallS.add(box(THREE, .1, .16, 2.3, '#4c3a24', '#33250f', fx, 3.48, -0.2, 0, .012));
  });
  [-12, -18, -24].forEach(bx => hallS.add(bulb(THREE, .11, 0xffd9a0, bx, 3.3, -0.2)));
  hallS.add(box(THREE, 1.15, 1.45, .06, '#d8cdb2', '#9a8a64', -7.4, .78, -1.28, .25, .015));
  hallS.add(box(THREE, 1.15, 1.45, .06, '#c4b28a', '#9a8a64', -8.3, .78, 0.88, -.2, .015));
  hallS.add(box(THREE, 1.15, 1.45, .06, '#d0c098', '#9a8a64', -15.5, .78, -1.28, .2, .015));
  hallS.add(box(THREE, 1.15, 1.45, .06, '#c4b28a', '#9a8a64', -21.5, .78, 0.88, -.15, .015));
  hallS.add(box(THREE, .58, .5, .5, '#8a6a42', '#5f4726', -8.7, .25, -0.9, .1, .015));
  hallS.add(bulb(THREE, .11, 0xffd9a0, -6.5, 3.3, -0.2));
  // east wall in segments (BUILD-FIX): a tall opening z -2.6..1.6 onto an east alcove running
  // 8.5 D out to a lit end window — the easel shots are taken from inside it, on the front
  // three-quarter side of the easel, and it gives the studio a second depth axis
  stu.add(box(THREE, .12, 4.8, .6, '#7d6240', '#543e24', 3.56, 2.4, -2.9, 0, .015));
  stu.add(box(THREE, .12, 4.8, 1.6, '#7d6240', '#543e24', 3.56, 2.4, 2.4, 0, .015));
  stu.add(box(THREE, .12, 1.4, 4.2, '#7d6240', '#543e24', 3.56, 4.1, -.5, 0, .015));
  const alc = new THREE.Group(); stu.add(alc);
  alc.add(box(THREE, 8.5, .08, 5.5, '#7a5c38', '#573f22', 7.8, -.01, -.25, 0, .01));
  alc.add(box(THREE, 8.5, 4.8, .12, '#7d6240', '#543e24', 7.8, 2.4, -3.0, 0, .015));
  alc.add(box(THREE, 8.5, 4.8, .12, '#7d6240', '#543e24', 7.8, 2.4, 2.5, 0, .015));
  alc.add(box(THREE, .12, 4.8, 5.5, '#8a6f4a', '#5f4726', 12.0, 2.4, -.25, 0, .015));
  alc.add(box(THREE, 8.5, .12, 5.5, '#6a5136', '#4c3823', 7.8, 4.86, -.25, 0, .01));
  alc.add(box(THREE, .08, 3.0, 2.0, '#4c3a24', '#33250f', 11.92, 2.5, -.25, 0, .02));
  alc.add(glow(THREE, .04, 2.7, 1.7, 0xdce8ee, 11.9, 2.5, -.25));
  alc.add(bulb(THREE, .11, 0xffd9a0, 6.0, 3.9, -.25));
  alc.add(bulb(THREE, .11, 0xffd9a0, 9.5, 3.9, -.25));
  alc.add(box(THREE, 1.15, 1.45, .06, '#d8cdb2', '#9a8a64', 6.4, .78, -2.8, .12, .015));
  alc.add(box(THREE, 1.15, 1.45, .06, '#c4b28a', '#9a8a64', 8.6, .78, -2.8, -.08, .015));
  stu.add(box(THREE, 9.5, .14, 9, '#6a5136', '#4c3823', 0, 4.92, .5, 0, .01));              // ceiling
  // the tall north window (practical 1): ENV round 3 — the old SOLID backing panel
  // (which sealed the new loggia shut and read as a dark slab in f_46) is replaced by
  // a frame border only: west/east stiles + head/sill rails, the mullions below stay,
  // and the glazed bay is genuinely open onto the 26 D loggia behind it
  stu.add(box(THREE, .18, 3.6, .09, '#4c3a24', '#33250f', -2.61, 2.7, -2.98, 0, .02));
  stu.add(box(THREE, .18, 3.6, .09, '#4c3a24', '#33250f', 1.01, 2.7, -2.98, 0, .02));
  stu.add(box(THREE, 3.8, .18, .09, '#4c3a24', '#33250f', -.8, 4.41, -2.98, 0, .02));
  stu.add(box(THREE, 3.8, .18, .09, '#4c3a24', '#33250f', -.8, 0.99, -2.98, 0, .02));
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
  const roofs = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.1), roofMat);
  roofs.position.set(-.8, 2.6, -28.9); stu.add(roofs); dyn.roofMat = roofMat;   // ENV round 3: the rooftops are now the loggia's far-end view, 26 D behind the window line
  stu.add(box(THREE, .07, 3.3, .05, '#4c3a24', '#33250f', -.8, 2.7, -2.9, 0, 0));
  stu.add(box(THREE, 3.5, .07, .05, '#4c3a24', '#33250f', -.8, 2.7, -2.9, 0, 0));
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
  // pigment shelves moved onto the north wall (BUILD-FIX): they stood across the new east
  // alcove opening; on the north wall they dress the background of the south cameras instead
  [.8, 1.5, 2.2].forEach(sy => stu.add(box(THREE, 2.2, .05, .34, '#6e4f2c', '#4c3519', 2.2, sy, -2.82, 0, .012)));
  [['#c8922e', .95, 1.35], ['#274b8f', .95, 1.95], ['#7d2f26', .95, 2.55], ['#e8e2d2', 1.65, 1.6], ['#3f5a34', 1.65, 2.3], ['#c8922e', 2.35, 1.8], ['#5d3a22', 2.35, 2.8]]
    .forEach(([c, sy, sx]) => { const jar = part(THREE, new THREE.CylinderGeometry(.09, .09, .24, 10), flat(c, '#4c4438'), .01); jar.position.set(sx, sy, -2.82); stu.add(jar); });
  // the stove with its orange glow (practical 2)
  stu.add(box(THREE, .7, .9, .7, '#2e2c2c', '#1a1818', 2.8, .45, -1.9, 0, .02));
  stu.add(glow(THREE, .3, .22, .03, 0xff7a30, 2.8, .42, -1.53));
  const pipe = part(THREE, new THREE.CylinderGeometry(.07, .07, 3.4, 10), flat('#3a3838', '#242222'), .01);
  pipe.position.set(2.8, 2.6, -1.9); stu.add(pipe);
  // the desk + shaded lamp for the evening passes (practical 3)
  // (ENV f_46: desk nudged south-east and the lamp moved to the desk's far east end —
  // stem/shade/bulb now 1.3 D from the hero's standing centre, clear of his torso and of
  // his reach to the brush/palette props, which still land on the desk top)
  // ENV round 5 (fault 3, critic-directed): the desk is moved a full body-width
  // EAST (top centre -2.05 -> -0.9, lamp with it, rig `desk` light with it) so in
  // f_46 its top edge no longer crosses the hero's near leg — his legs clear its
  // edge end to end. The brush/palette props rest at their LOCKED film.js anchor
  // (-2.5/-2.6, 0.99, 1.25), a body-width west of the moved desk, so a solid
  // work-stand now stands under that anchor (top y .985, exactly the old desk
  // top height): the props still land on a surface at his hand before the
  // line-19 pick-up, and the stand reads as the small cabinet he stands behind.
  stu.add(box(THREE, 1.3, .07, .7, '#6e4f2c', '#4c3519', -0.9, .95, 1.52, .3, .015));
  stu.add(box(THREE, .06, .45, .06, '#37424a', '#232a30', -0.47, 1.2, 1.62, 0, .01));
  const dshade = part(THREE, new THREE.CylinderGeometry(.11, .2, .2, 12, 1, true), flat('#37424a', '#232a30'), .012);
  dshade.position.set(-0.47, 1.5, 1.62); stu.add(dshade);
  stu.add(bulb(THREE, .09, 0xffd9a0, -0.47, 1.44, 1.62));
  stu.add(box(THREE, .86, .07, .68, '#6e4f2c', '#4c3519', -2.55, .95, 1.25, .3, .015));
  stu.add(box(THREE, .78, .92, .6, '#654626', '#473118', -2.55, .46, 1.25, .3, .015));
  // ENV round 3 (fault 4): the second VISIBLE practical for f_46 — a lit WALL SCONCE
  // inside the window bay, on its east wall (0.44, 2.9, -4.5): a window-side lamp
  // seen through the glass, in frame and clear of the hero's silhouette. (Three
  // floor-lamp placements failed the f_46 stills in turn: on-axis behind the hero's
  // torso at (0.95,-2.25), off the right edge at (1.35,-0.9) and at (-0.9,0.9).)
  stu.add(box(THREE, .05, .42, .16, '#a87c2c', '#77571d', 1.06, 2.9, -4.5, 0, .01));
  const baySconce = part(THREE, new THREE.CylinderGeometry(.09, .19, .17, 12, 1, true), flat('#a87c2c', '#77571d'), .01);
  baySconce.position.set(0.96, 3.08, -4.5); stu.add(baySconce);
  stu.add(bulb(THREE, .09, 0xffd9a0, 0.96, 3.0, -4.5));
  // ENV round 4 (fault 4): a lit PENDANT inside the studio proper, east of the
  // hero — the second clearly visible bulb IN the f_46 frame (the desk lamp is
  // the first), hung clear of his head zone; plus modelled detail on the walls
  // behind him: a gilt-framed canvas over the pigment shelves and two framed
  // sketches on the west wall segment
  stu.add(box(THREE, .03, 1.5, .03, '#2c2c30', '#17171a', 1.15, 4.15, -0.6, 0, 0));
  const pshade = part(THREE, new THREE.CylinderGeometry(.12, .3, .26, 14, 1, true), flat('#37424a', '#232a30'), .012);
  pshade.position.set(1.15, 3.38, -0.6); stu.add(pshade);
  stu.add(bulb(THREE, .13, 0xffe2b0, 1.15, 3.24, -0.6));
  { const cv = giltFrame(THREE, .95, 1.2, '#7d94b8', '#a8843c', '#e8d9a0'); cv.position.set(2.6, 3.35, -2.96); stu.add(cv); }
  [[3.25], [2.3]].forEach(([fy]) => {
    stu.add(box(THREE, .56, .72, .05, '#4c3a24', '#33250f', -3.15, fy, -2.97, 0, .012));
    stu.add(box(THREE, .44, .6, .03, '#d8cdb2', '#9a8a64', -3.15, fy, -2.95, 0, 0));
  });
  // a stool + a draped table with tubes and a jug (dressing)
  stu.add(box(THREE, .5, .06, .5, '#7a5a36', '#573f22', .6, .55, .6, 0, .012));
  stu.add(box(THREE, .07, .55, .07, '#5d4226', '#3f2c16', .6, .27, .6, 0, .01));
  stu.add(box(THREE, .9, .5, .6, '#8a8074', '#5f574c', 1.9, .25, 1.5, -.2, .015));

  // ================= LAB (x +400, z -400) =================
  const L = new THREE.Group(); L.position.set(400, 0, -400); g.add(L);
  L.add(box(THREE, 9.5, .08, 9, '#7d8488', '#585e61', 0, -.01, .5, 0, .01));
  // ENV round 4 (fault 5): floor tile seams + a pale lab mat in the camera-side foreground
  [.7, 1.5, 2.3].forEach(pz => L.add(box(THREE, 6.0, .014, .05, '#585e61', '#40464a', 0, .042, pz, 0, .005)));
  L.add(box(THREE, 2.6, .016, 1.1, '#98a2a0', '#767e7c', 0, .045, 1.55, 0, .006));
  // back wall in segments (BUILD-FIX): an open doorway 1.2..3.2 onto a service corridor
  // running 28 D back — the lab's far end behind the bench, not a flat wall
  L.add(box(THREE, .25, 4.2, .12, '#aeb6b4', '#828a88', -3.075, 2.1, -2.66, 0, .015));
  // ENV round 3 (fault 2): the centre back wall is split for a THIRD opening — a service
  // corridor centred behind both lab faces (x -1.3..0.1) running 26 D back, with door
  // frames + bulbs shrinking to a lit end window; the bottle shelves move east of it
  L.add(box(THREE, .15, 4.2, .12, '#aeb6b4', '#828a88', -1.675, 2.1, -2.66, 0, .015));
  // ENV round 5 (fault 2, critic-directed): the centre service corridor is SHIFTED
  // 1.5 D EAST — its mouth (was x -1.6..0.1, centred behind the hero's head) now
  // opens at x -0.1..1.6, BESIDE the two heads in the f_55 framing, with its pale
  // frames + haloed bulbs receding visibly past the expert. The old mouth is
  // filled with a full-height wall seg; a new east seg (to y 3.0, the top band
  // above it kept) closes the wall east of the new mouth.
  L.add(box(THREE, 1.5, 4.2, .12, '#aeb6b4', '#828a88', -0.85, 2.1, -2.66, 0, .015));
  // (round-5 fix iteration, after the first env5 f_55 still: the mouth is widened
  // further east, -0.1..2.05, and the run widened to match, so more of the run —
  // frames + bulbs — enters the f_55 frame beside the expert's head)
  // ENV round 6 (fault 2): mouth widened further east (-0.1..2.5) and the run
  // widened to match, so the bay opens BESIDE the heads in f_55, not behind them
  L.add(box(THREE, .55, 3.0, .12, '#aeb6b4', '#828a88', 2.8, 1.5, -2.66, 0, .015));
  L.add(box(THREE, 2.6, .7, .12, '#aeb6b4', '#828a88', 1.2, 3.85, -2.66, 0, .015));
  L.add(box(THREE, 1.2, 1.2, .12, '#aeb6b4', '#828a88', -2.35, 3.6, -2.66, 0, .015));
  L.add(box(THREE, .55, 1.2, .12, '#aeb6b4', '#828a88', 2.8, 3.6, -2.66, 0, .015));
  const vistaN = new THREE.Group(); vistaN.position.x = 1.5; L.add(vistaN);   // ENV round 5: the whole 26 D run shifts east with its mouth
  vistaN.add(box(THREE, 2.7, .08, 26, '#7d8488', '#585e61', -0.45, -.01, -15.66, 0, .01));
  vistaN.add(box(THREE, .1, 4.2, 26, '#c3cbca', '#9aa3a1', -1.8, 2.1, -15.66, 0, .012));
  vistaN.add(box(THREE, .1, 4.2, 26, '#c3cbca', '#9aa3a1', 0.9, 2.1, -15.66, 0, .012));
  // ENV round 6 (fault 2, cont.): pale pilaster strips ON both side walls' inner
  // faces at the bay stations — from the f_55 camera these are the repeated
  // verticals that shrink toward the far end and make the recession read
  [-6, -11, -16, -21].forEach(fz => {
    vistaN.add(glow(THREE, .05, 3.2, .34, 0xe8efec, -1.73, 1.6, fz));
    vistaN.add(glow(THREE, .05, 3.2, .34, 0xe8efec, 0.83, 1.6, fz));
  });
  vistaN.add(box(THREE, 2.7, .12, 26, '#98a2a0', '#6e7674', -0.45, 4.26, -15.66, 0, .01));
  vistaN.add(box(THREE, 2.7, 4.2, .12, '#aeb6b4', '#828a88', -0.45, 2.1, -28.66, 0, .012));
  vistaN.add(box(THREE, 1.3, 2.36, .08, '#5d6468', '#40464a', -0.45, 2.2, -28.58, 0, .02));
  vistaN.add(glow(THREE, 1.15, 2.2, .05, 0xeaf2f6, -0.45, 2.2, -28.53));
  // ENV round 4: PALE unlit frames + bigger haloed bulbs every ~5.5 D so the run counts off
  // ENV round 5: four frames (-7/-12/-17/-22) and bigger bulbs/halos for the widened mouth
  // ENV round 6 (fault 2): the run must read as RECEDING along the camera's view
  // axis in the f_55 frame itself — repeated DOOR POSTS protruding from BOTH
  // side walls, transverse floor bands and ceiling panels at the same stations,
  // so the eye counts shrinking bays toward the lit far end 25 D+ away
  [-7, -12, -17, -22].forEach(fz => {
    vistaN.add(glow(THREE, .12, 3.0, .11, 0xdfe6e2, -1.72, 1.5, fz));
    vistaN.add(glow(THREE, .12, 3.0, .11, 0xdfe6e2, 0.82, 1.5, fz));
    vistaN.add(glow(THREE, 2.7, .17, .11, 0xdfe6e2, -0.45, 3.08, fz));
  });
  [-6, -11, -16, -21].forEach(fz => {
    vistaN.add(glow(THREE, .24, 3.1, .26, 0xdfe6e2, -1.66, 1.55, fz));
    vistaN.add(glow(THREE, .24, 3.1, .26, 0xdfe6e2, 0.76, 1.55, fz));
    vistaN.add(box(THREE, 2.7, .03, .3, '#585e61', '#40464a', -0.45, .045, fz, 0, .005));
    vistaN.add(glow(THREE, 1.5, .04, .6, 0xf4f8f8, -0.45, 4.18, fz));
  });
  [-5, -11, -17, -23, -27].forEach(bz => { vistaN.add(halo(THREE, .45, -0.45, 3.5, bz + .18)); vistaN.add(bulb(THREE, .22, 0xffffff, -0.45, 3.5, bz)); });
  [-11, -18].forEach(sz => {
    vistaN.add(box(THREE, .28, .05, 1.6, '#6a6e70', '#4a4e50', -1.5, 1.5, sz, 0, .01));
    for (let i = 0; i < 4; i++) { const bt = part(THREE, new THREE.CylinderGeometry(.07, .07, .26, 8), flat(['#7fa8b8', '#a8b89a', '#c8b088', '#9a8ab0'][i % 4], '#5d6a70'), .008); bt.position.set(-1.5, 1.66, sz - .6 + i * .4); vistaN.add(bt); }
  });
  // ENV round 2: a STORE ROOM opens in the back wall west of the bench (x -2.95..-1.75,
  // behind the hero's head in every lab shot) and runs 9.3 D back: shelf boards with
  // bottles along it, bulbs falling away, a lit window at the far end
  const storeL = new THREE.Group(); L.add(storeL);
  storeL.add(box(THREE, 1.2, .08, 9.34, '#7d8488', '#585e61', -2.35, -.01, -7.33, 0, .01));
  storeL.add(box(THREE, .1, 4.2, 9.34, '#a2aaa8', '#767e7c', -2.97, 2.1, -7.33, 0, .012));
  storeL.add(box(THREE, .1, 4.2, 9.34, '#a2aaa8', '#767e7c', -1.73, 2.1, -7.33, 0, .012));
  storeL.add(box(THREE, 1.2, .12, 9.34, '#98a2a0', '#6e7674', -2.35, 4.26, -7.33, 0, .01));
  storeL.add(box(THREE, 1.2, 4.2, .12, '#aeb6b4', '#828a88', -2.35, 2.1, -12, 0, .012));
  storeL.add(glow(THREE, .8, 2.0, .05, 0xdce8ee, -2.35, 2.2, -11.93));
  [-5.5, -9.0].forEach(sz => {
    storeL.add(box(THREE, .28, .05, 1.6, '#6a6e70', '#4a4e50', -2.82, 1.5, sz, 0, .01));
    for (let i = 0; i < 4; i++) { const bt = part(THREE, new THREE.CylinderGeometry(.07, .07, .26, 8), flat(['#7fa8b8', '#a8b89a', '#c8b088', '#9a8ab0'][i % 4], '#5d6a70'), .008); bt.position.set(-2.82, 1.66, sz - .6 + i * .4); storeL.add(bt); }
  });
  storeL.add(bulb(THREE, .1, 0xffffff, -2.35, 3.5, -5.5));
  storeL.add(bulb(THREE, .1, 0xffffff, -2.35, 3.5, -9.5));
  const vistaL = new THREE.Group(); L.add(vistaL);
  vistaL.add(box(THREE, 2.0, .08, 28, '#7d8488', '#585e61', 2.2, -.01, -16.6, 0, .01));
  vistaL.add(box(THREE, .12, 4.2, 28, '#a2aaa8', '#767e7c', 1.2, 2.1, -16.6, 0, .012));
  vistaL.add(box(THREE, .12, 4.2, 28, '#a2aaa8', '#767e7c', 3.2, 2.1, -16.6, 0, .012));
  vistaL.add(box(THREE, 2.0, .12, 28, '#98a2a0', '#6e7674', 2.2, 4.26, -16.6, 0, .01));
  vistaL.add(box(THREE, 2.0, 4.2, .12, '#aeb6b4', '#828a88', 2.2, 2.1, -30.6, 0, .012));
  vistaL.add(glow(THREE, 1.2, 2.4, .05, 0xdce8ee, 2.2, 2.2, -30.5));
  [-9, -16, -23].forEach(bz => vistaL.add(bulb(THREE, .1, 0xffffff, 2.2, 3.6, bz)));
  [-12, -20].forEach(bz => {
    vistaL.add(box(THREE, .3, .05, 1.8, '#6a6e70', '#4a4e50', 1.32, 1.5, bz, 0, .01));
    vistaL.add(box(THREE, .3, .05, 1.8, '#6a6e70', '#4a4e50', 3.08, 1.5, bz, 0, .01));
  });
  L.add(box(THREE, .12, 4.2, 5.6, '#a2aaa8', '#767e7c', -3.06, 2.1, 0, 0, .015));
  L.add(box(THREE, .12, 4.2, 5.6, '#a2aaa8', '#767e7c', 3.06, 2.1, 0, 0, .015));
  L.add(box(THREE, 8.5, .14, 8, '#98a2a0', '#6e7674', 0, 4.32, .5, 0, .01));                 // ceiling
  // the bench run (ENV round 2, critic-directed): the counter BODY pushed 0.7 D back
  // (front face -1.48 -> -1.925, body centre z -2.3) as a SOLID block, so both figures'
  // legs (hero z -0.7, expertlab z -0.85) pass a full 1.1 D in FRONT of it on open
  // floor, never through it. The top slab cantilevers south from the body (front edge
  // -1.375) so the film.js props still land on it: microscope (-0.7,-1.7), vial
  // (0.05,-1.55); the bench lamp, Bunsen, tray and jars keep their places on the slab.
  // ENV round 3 (fault 1, critic-directed — the desk construction that closed the
  // interrogation fault): the counter is now a SOLID floor-to-top panelled block.
  // Its front panel reaches the floor at z -1.655 with NO under-gap and no recessed
  // rail; the whole block sits 0.8-0.95 D BEHIND both figures (hero z -0.7,
  // expertlab z -0.85), so torso+legs read continuous in front of it and nothing
  // crosses a body. The top slab (front edge -1.45, top y 1.065 as before) still
  // carries microscope (-0.7,-1.7), vial (0.05,-1.55), bench lamp, Bunsen, tray, jars.
  // ENV round 5 (fault 1, critic-directed): the counter BODY is pushed a further
  // 0.7 D back (front panel -1.655 -> -2.355), so a wide floor strip separates both
  // men's feet (z -0.7 / -0.85) from the panel, and the top slab is LOWERED to
  // y 0.9 (was 1.065) so its front line sits clearly BELOW both men's hem/hip
  // line — no body reads split by the counter. The slab keeps its front edge
  // (-1.45) and cantilevers over the recessed body; the film.js props keep
  // landing on it via set-built stands: a steel plinth under the microscope
  // (top 1.06 = its film.js base y) and a tray block under the vial (top 1.1).
  // ENV round 6 (fault 1, critic-directed): the counter moves BACK a further
  // 0.42 D (body centre z -2.88 -> -3.30, front panel -2.355 -> -2.775) and the
  // slab is LOWERED again (top y 0.9 -> 0.62) so in f_55 the counter-top line
  // projects well BELOW both men's hems with a continuous floor strip between
  // their feet and the front panel. Props keep landing via taller stands:
  // microscope plinth top still 1.06, vial tray top still 1.1.
  L.add(box(THREE, 3.6, .09, 1.3, '#5d5648', '#403a2e', 0, .575, -2.1, 0, .02));
  L.add(box(THREE, 3.5, .53, 1.05, '#6a6e70', '#4a4e50', 0, .265, -3.30, 0, .015));
  L.add(box(THREE, 3.56, .08, 1.1, '#585e61', '#40464a', 0, .04, -3.30, 0, .012));
  [-.85, .85].forEach(px => {
    L.add(box(THREE, 1.3, .4, .04, '#7d8488', '#585e61', px, .28, -2.765, 0, .01));
    L.add(box(THREE, 1.12, .28, .03, '#62676b', '#464b4f', px, .28, -2.75, 0, .008));
  });
  L.add(box(THREE, 3.5, .07, .04, '#7d8488', '#585e61', 0, .5, -2.765, 0, .01));
  L.add(box(THREE, .55, .44, .55, '#7d8488', '#585e61', -0.7, .84, -1.7, 0, .012));   // microscope plinth (top y 1.06)
  L.add(box(THREE, .34, .48, .34, '#8b9094', '#62676b', 0.05, .86, -1.55, 0, .012));  // vial tray block (top y 1.1)
  // bottle shelves on the back wall's EAST segment (ENV round 3: moved east of the
  // new centre corridor doorway; ENV round 5: moved further east, x 0.65 -> 2.35,
  // onto the new east wall seg — they stood in front of the shifted corridor mouth)
  // ENV round 6: shelves narrowed onto the remaining east wall seg (x 2.8) — the
  // widened corridor mouth now reaches x 2.5 and the old shelf span crossed it
  [.95, 1.6, 2.25].forEach(sy => {
    L.add(box(THREE, .5, .05, .3, '#6a6e70', '#4a4e50', 2.8, sy, -2.45, 0, .012));
    for (let i = 0; i < 2; i++) {
      const bt = part(THREE, new THREE.CylinderGeometry(.07, .07, .26 + (i % 3) * .05, 8),
        flat(['#7fa8b8', '#a8b89a', '#c8b088', '#9a8ab0'][i % 4], '#5d6a70'), .008);
      bt.position.set(2.68 + i * .26, sy + .16, -2.45); L.add(bt);
    }
  });
  // the bench lamp (practical 1, hard white) + the Bunsen flame (practical 2)
  // (ENV: lamp and Bunsen moved north with the bench top they stand on)
  // ENV round 4 (fault 3): the bench lamp moved to the bench's far EAST end
  // (x -1.15 -> 1.62, fully behind the counter line) — from the f_55 camera it no
  // longer stands behind either figure, so no shade can read as protruding from
  // a torso; microscope (-0.7) and vial (0.05) are untouched
  // ENV round 5: lamp, Bunsen, tray and jars all dropped 0.165 with the lowered slab (top y 0.9)
  // ENV round 6: lamp, Bunsen, tray and jars dropped a further 0.28 with the slab (top y 0.62)
  L.add(box(THREE, .06, .7, .06, '#37424a', '#232a30', 1.62, .97, -2.0, 0, .01));
  const bshade = part(THREE, new THREE.CylinderGeometry(.1, .2, .2, 12, 1, true), flat('#37424a', '#232a30'), .012);
  bshade.position.set(1.55, 1.375, -1.95); bshade.rotation.z = .5; L.add(bshade);
  L.add(bulb(THREE, .09, 0xffffff, 1.48, 1.315, -1.93));
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.05, .22, 10), new THREE.MeshBasicMaterial({ color: 0x6fa8ff }));
  flame.position.set(1.05, .735, -1.78); L.add(flame); dyn.flame = flame;
  L.add(box(THREE, .16, .1, .16, '#3a3a40', '#222226', 1.05, .67, -1.78, 0, .01));
  // ENV: two ceiling light panels (practicals 3+4 — the lab's second visible source class,
  // in frame on every lab shot) + a hanging lamp over the bench's east end (practical 5)
  [-0.3, -2.2].forEach(pz => L.add(glow(THREE, 1.6, .04, .7, 0xf4f8f8, 0, 4.22, pz)));
  L.add(box(THREE, .03, .8, .03, '#37424a', '#232a30', 1.45, 3.9, -1.9, 0, 0));
  L.add(bulb(THREE, .1, 0xffffff, 1.45, 3.42, -1.9));
  // the tall window at the far end (practical 3)
  L.add(box(THREE, .08, 2.6, 1.6, '#5d6468', '#40464a', 3.0, 2.2, -.6, 0, .02));
  L.add(glow(THREE, .03, 2.3, 1.35, 0xdce8ee, 2.94, 2.2, -.6));
  // a sample tray + jars on the bench (dressing near the props; moved north with the bench)
  L.add(box(THREE, .7, .04, .4, '#8b9094', '#62676b', .75, .635, -1.83, 0, .01));
  [[.55, '#c8922e'], [.75, '#8a4a6a'], [.95, '#4a6a8a']].forEach(([x, c]) => {
    const jar = part(THREE, new THREE.CylinderGeometry(.06, .06, .17, 10), flat(c, '#4c4438'), .008);
    jar.position.set(x, .745, -1.83); L.add(jar);
  });

  // ================= COURTROOM (x -400, z -400) =================
  const T = new THREE.Group(); T.position.set(-400, 0, -400); g.add(T);
  T.add(box(THREE, 12, .08, 10.5, '#6e5136', '#4c3823', 0, -.01, .5, 0, .01));
  // ENV round 4 (fault 5): foreground detail in the bottom third — floor plank
  // seams + a red runner down the centre aisle toward the bench rows
  [3.1, 3.9, 4.7].forEach(pz => T.add(box(THREE, 9.0, .014, .07, '#543e24', '#382812', 0, .042, pz, 0, .005)));
  T.add(box(THREE, 1.7, .018, 2.6, '#6e2a26', '#4a1a16', 0, .045, 3.9, 0, .008));
  // panelled back wall in segments (BUILD-FIX): an open doorway -2.5..-0.9 west of the bench
  // onto a panelled corridor running 27 D back — a far end behind the dock, not a flat wall
  T.add(box(THREE, 1.4, 5.2, .12, '#5d4226', '#3f2c16', -4.0, 2.6, -3.66, 0, .015));
  T.add(box(THREE, 0.8, 1.35, .12, '#5d4226', '#3f2c16', -2.9, 4.525, -3.66, 0, .015));   // ENV round 4: header over the widened corridor mouth (mouth -2.5 -> -3.3); the west sconce stands on it
  T.add(box(THREE, 5.6, 3.85, .12, '#5d4226', '#3f2c16', 1.9, 1.925, -3.66, 0, .015));
  T.add(box(THREE, 3.4, 1.35, .12, '#5d4226', '#3f2c16', 3.0, 4.525, -3.66, 0, .015));
  T.add(box(THREE, 2.4, .14, .12, '#5d4226', '#3f2c16', 0.1, 5.25, -3.66, 0, .015));
  T.add(box(THREE, 0.8, 1.6, .12, '#5d4226', '#3f2c16', -2.1, 4.4, -3.66, 0, .015));   // ENV round 4: gallery arch widened west (arch now -1.7..1.3)
  // ENV round 2 (critic-directed): a GALLERY ARCH opens in the back wall directly
  // behind/above the bench (x -1.1..1.3, y 3.85..5.2 — its sill clears the judge's
  // head, top ~3.77) onto an upper gallery running 8.8 D back: railing, column pairs,
  // a bench silhouette and a tall lit window at the far end — modelled receding
  // courtroom depth in the verdict frames' backdrop, ending ~21 D behind the dock
  const galT = new THREE.Group(); T.add(galT);
  // ENV round 3 (fault 2): the upper gallery now runs a full 27 D back from the arch
  // (z -3.66 -> -30.5): column pairs + bulbs shrinking along it to a big lit far
  // window — a real receding vista centred behind/above the bench in every verdict frame
  galT.add(box(THREE, 3.6, .1, 26.84, '#6e5136', '#4c3823', 0.0, 3.8, -17.08, 0, .01));
  galT.add(box(THREE, .12, 1.45, 26.84, '#77572f', '#543e24', -1.76, 4.57, -17.08, 0, .012));
  galT.add(box(THREE, .12, 1.45, 26.84, '#77572f', '#543e24', 1.76, 4.57, -17.08, 0, .012));
  galT.add(box(THREE, 3.6, .12, 26.84, '#4c3519', '#33230e', 0.0, 5.3, -17.08, 0, .01));
  galT.add(box(THREE, 3.6, 1.5, .12, '#5d4226', '#3f2c16', 0.0, 4.57, -30.5, 0, .012));
  galT.add(box(THREE, 2.4, 1.42, .08, '#3f2c16', '#2a1d0a', 0.0, 4.6, -30.42, 0, .02));
  galT.add(glow(THREE, 2.25, 1.32, .03, 0xf5ecd4, 0.0, 4.6, -30.37));
  galT.add(box(THREE, .05, 1.3, 1.8, '#3f2c16', '#2a1d0a', 1.72, 4.6, -9, 0, .02));
  galT.add(glow(THREE, .03, 1.1, 1.6, 0xf0e6cc, 1.68, 4.6, -9));
  galT.add(box(THREE, .05, 1.3, 1.8, '#3f2c16', '#2a1d0a', 1.72, 4.6, -20, 0, .02));
  galT.add(glow(THREE, .03, 1.1, 1.6, 0xf0e6cc, 1.68, 4.6, -20));
  [-6.5, -9.5, -14, -20, -26].forEach(cz => { galT.add(box(THREE, .16, 1.45, .16, '#6e5136', '#4c3823', -1.5, 4.57, cz, 0, .01)); galT.add(box(THREE, .16, 1.45, .16, '#6e5136', '#4c3823', 1.55, 4.57, cz, 0, .01)); });
  galT.add(box(THREE, 3.2, .06, .06, '#8a6a42', '#5f4726', 0.0, 4.75, -4.3, 0, .01));
  for (let i = 0; i < 9; i++) galT.add(box(THREE, .04, .85, .04, '#77572f', '#543e24', -1.4 + i * .35, 4.3, -4.3, 0, .008));
  galT.add(box(THREE, 3.2, .06, .06, '#8a6a42', '#5f4726', 0.0, 4.75, -16, 0, .01));
  for (let i = 0; i < 9; i++) galT.add(box(THREE, .04, .85, .04, '#77572f', '#543e24', -1.4 + i * .35, 4.3, -16, 0, .008));
  galT.add(box(THREE, 2.8, .5, .4, '#543e24', '#382812', 0.0, 4.1, -10.5, 0, .012));
  galT.add(box(THREE, 2.8, .5, .4, '#543e24', '#382812', 0.0, 4.1, -23, 0, .012));
  // ENV round 4: bigger haloed gallery bulbs every 5 D — the countable rhythm in the arch
  [-6, -11, -16, -21, -26].forEach(bz => { galT.add(halo(THREE, .3, 0.0, 5.0, bz + .18)); galT.add(bulb(THREE, .15, 0xffe2b0, 0.0, 5.0, bz)); });
  const vistaT = new THREE.Group(); T.add(vistaT);
  vistaT.add(box(THREE, 2.4, .08, 27, '#6e5136', '#4c3823', -2.1, -.01, -17, 0, .01));
  vistaT.add(box(THREE, .12, 5.2, 27, '#6e5136', '#4c3823', -3.3, 2.6, -17, 0, .012));
  vistaT.add(box(THREE, .12, 5.2, 27, '#6e5136', '#4c3823', -0.9, 2.6, -17, 0, .012));
  vistaT.add(box(THREE, 2.4, .12, 27, '#4c3519', '#33230e', -2.1, 5.26, -17, 0, .01));
  vistaT.add(box(THREE, 2.4, 5.2, .12, '#5d4226', '#3f2c16', -2.1, 2.6, -30.5, 0, .012));
  vistaT.add(glow(THREE, 1.9, 3.2, .05, 0xf5ecd4, -2.1, 2.8, -30.4));
  // ENV round 4: bigger haloed bulbs every ~6 D + PALE frames spanning the corridor
  [-11, -17, -23].forEach(bz => { vistaT.add(halo(THREE, .3, -2.1, 4.2, bz + .18)); vistaT.add(bulb(THREE, .16, 0xffe2b0, -2.1, 4.2, bz)); });
  [-8, -14, -20].forEach(fz => {
    vistaT.add(glow(THREE, .14, 3.6, .13, 0xd8c9a3, -3.2, 1.8, fz));
    vistaT.add(glow(THREE, .14, 3.6, .13, 0xd8c9a3, -1.0, 1.8, fz));
    vistaT.add(glow(THREE, 2.34, .18, .13, 0xd8c9a3, -2.1, 3.69, fz));
  });
  vistaT.add(box(THREE, .5, .9, .4, '#543e24', '#382812', -2.9, .45, -13, 0, .012));
  vistaT.add(box(THREE, .5, .9, .4, '#543e24', '#382812', -1.3, .45, -21, 0, .012));
  // ENV round 2: the corridor reads layered now — a near bulb lights its mouth,
  // pilaster pairs recede along it, a lit side doorway glows mid-run
  vistaT.add(halo(THREE, .3, -2.1, 3.0, -5.3)); vistaT.add(bulb(THREE, .16, 0xffe2b0, -2.1, 3.0, -5.5));
  vistaT.add(box(THREE, .05, 3.0, 1.4, '#6e5136', '#4c3823', -3.24, 1.8, -4.6, 0, .01));
  vistaT.add(box(THREE, .05, 3.0, 1.4, '#6e5136', '#4c3823', -0.96, 1.8, -4.6, 0, .01));
  [-8, -14].forEach(pz => { vistaT.add(box(THREE, .18, 5.2, .34, '#4c3519', '#33230e', -3.22, 2.6, pz, 0, .01)); vistaT.add(box(THREE, .18, 5.2, .34, '#4c3519', '#33230e', -0.98, 2.6, pz, 0, .01)); });
  vistaT.add(glow(THREE, .05, 2.4, 1.1, 0xf0e6cc, -0.93, 2.4, -12));
  for (let i = 0; i < 7; i++) { const px = -4.2 + i * 1.4; if (px > -2.6 && px < -0.8) continue; if (Math.abs(px) < .1) { T.add(box(THREE, .14, 3.85, .05, '#4c3519', '#33230e', px, 1.925, -3.58, 0, .008)); continue; } T.add(box(THREE, .14, 5.2, .05, '#4c3519', '#33230e', px, 2.6, -3.58, 0, .008)); }
  // panel moulding rails across the back wall (ENV round 2: the y 4.35 east rail is
  // shortened to x 1.3..4.7 so it never crosses the gallery arch) + a large framed
  // canvas and crest east of the bench
  T.add(box(THREE, 2.2, .09, .05, '#4c3519', '#33230e', -3.6, 1.15, -3.58, 0, .008));
  T.add(box(THREE, 5.6, .09, .05, '#4c3519', '#33230e', 1.9, 1.15, -3.58, 0, .008));
  T.add(box(THREE, 2.2, .09, .05, '#4c3519', '#33230e', -3.6, 4.35, -3.58, 0, .008));
  T.add(box(THREE, 3.4, .09, .05, '#4c3519', '#33230e', 3.0, 4.35, -3.58, 0, .008));
  { const cv = giltFrame(THREE, 1.5, 1.9, '#7d6a4a', '#4a5a6a', '#e8d9a0'); cv.position.set(2.6, 3.3, -3.56); T.add(cv); }
  T.add(box(THREE, .55, .55, .05, '#a87c2c', '#77571d', 4.15, 4.5, -3.58, 0, .01));
  T.add(box(THREE, .12, 5.2, 7.4, '#543e24', '#382812', -4.66, 2.6, 0, 0, .015));
  T.add(box(THREE, .12, 5.2, 7.4, '#543e24', '#382812', 4.66, 2.6, 0, 0, .015));
  T.add(box(THREE, 11.5, .14, 10, '#4c3519', '#33230e', 0, 5.32, .5, 0, .01));               // ceiling
  // tall windows on the back wall (practicals): pale shafts either side of the bench
  [-3.75, 3.1].forEach(wx => {
    T.add(box(THREE, 1.5, 3.6, .08, '#3f2c16', '#2a1d0a', wx, 3.1, -3.6, 0, .02));
    T.add(glow(THREE, 1.25, 3.35, .03, 0xf0e6cc, wx, 3.1, -3.55));
    T.add(box(THREE, .06, 3.35, .04, '#3f2c16', '#2a1d0a', wx, 3.1, -3.53, 0, 0));
  });
  // the high bench: platform + long desk (the judge stands on the platform behind it)
  T.add(box(THREE, 5.6, .55, 1.6, '#543e24', '#382812', 0, .275, -2.7, 0, .015));
  T.add(box(THREE, 5.6, 1.05, .5, '#6e4f2c', '#4c3519', 0, 1.07, -2.35, 0, .02));
  T.add(box(THREE, 5.7, .09, .7, '#7a5a36', '#573f22', 0, 1.64, -2.35, 0, .015));
  // brass lamps on the bench (practicals)
  // ENV round 4 (fault 2): the WEST lamp moved 0.92 D further west to the desk's
  // west corner (-1.9 -> -2.82, 2.1 D from the hero's head centre) — its thin stem
  // ended at the hero's face edge in every verdict frame; now nothing thin stands
  // within a head's width of him
  [-2.82, 1.9].forEach(lx => {
    T.add(box(THREE, .05, .5, .05, '#8a6f34', '#5f4c20', lx, 1.9, -2.3, 0, .008));
    T.add(bulb(THREE, .1, 0xffd9a0, lx, 2.2, -2.3));
  });
  // ENV round 2 (critic-directed): TWO WALL SCONCES on the back wall, inside every
  // court frame and clear of both head zones — west (-2.85, 3.95) upper-left of Han,
  // east (1.75, 4.5) above-right of the judge (his head tops out ~3.77 at x <= 0.87)
  [[-2.85, 3.95], [1.45, 4.5]].forEach(([sx, sy]) => {
    T.add(box(THREE, .16, .5, .06, '#a87c2c', '#77571d', sx, sy, -3.57, 0, .01));
    const ssh = part(THREE, new THREE.CylinderGeometry(.09, .2, .18, 12, 1, true), flat('#a87c2c', '#77571d'), .01);
    ssh.position.set(sx, sy + .18, -3.5); T.add(ssh);
    T.add(bulb(THREE, .085, 0xffd9a0, sx, sy + .1, -3.48));
  });
  // ENV round 3 (fault 3): modelled detail across the high bench FRONT — recessed
  // panel moulding on the desk front and the platform front, a brass rail along the
  // desk's top edge — so the verdict frames' lower centre is panelling, not flat slab
  [-1.8, 0, 1.8].forEach(px => {
    T.add(box(THREE, 1.3, .68, .04, '#543e24', '#382812', px, 1.07, -2.08, 0, .01));
    T.add(box(THREE, 1.1, .5, .03, '#6e4f2c', '#4c3519', px, 1.07, -2.06, 0, .008));
    T.add(box(THREE, 1.4, .36, .04, '#4c3519', '#33230e', px, .28, -1.88, 0, .01));
    T.add(box(THREE, 1.22, .24, .03, '#5d4226', '#3f2c16', px, .28, -1.86, 0, .008));
  });
  T.add(box(THREE, 5.6, .055, .05, '#a87c2c', '#77571d', 0, 1.56, -2.08, 0, .008));
  // ENV round 3 (fault 3): the rear wall in frame gets its architecture — pilasters
  // flanking the corridor mouth, a recessed panel above it, and a moulded surround
  // around the gallery arch
  [-3.38, -0.82].forEach(px => T.add(box(THREE, .16, 3.85, .06, '#4c3519', '#33230e', px, 1.925, -3.58, 0, .01)));
  T.add(box(THREE, 1.2, .9, .04, '#4c3519', '#33230e', -2.1, 4.4, -3.58, 0, .01));
  T.add(box(THREE, 1.0, .7, .03, '#5d4226', '#3f2c16', -2.1, 4.4, -3.56, 0, .008));
  [-0.97, 1.37].forEach(px => T.add(box(THREE, .14, 1.4, .05, '#4c3519', '#33230e', px, 4.52, -3.58, 0, .01)));
  T.add(box(THREE, 2.48, .14, .05, '#4c3519', '#33230e', 0.2, 5.24, -3.58, 0, .01));
  // the gavel's sound block on the desk
  const block = part(THREE, new THREE.CylinderGeometry(.16, .16, .05, 16), flat('#5d3a1a', '#3f2608'), .01);
  block.position.set(.7, 1.71, -2.3); T.add(block); points.gavelBlock = block;
  // rows of empty benches falling away behind the dock (the far end for reverse angles)
  [-.4, .9, 2.2].forEach((rz, i) => {
    T.add(box(THREE, 5.2, .09, .55, '#6e4f2c', '#4c3519', 0, .58, rz, 0, .015));
    T.add(box(THREE, 5.2, .75, .07, '#5d4226', '#3f2c16', 0, .95, rz - .3, 0, .015));
    T.add(box(THREE, 5.2, .5, .45, '#543e24', '#382812', 0, .25, rz, 0, .012));
  });
  // ENV round 4 (fault 5): papers + books left on the bench seats — small pale
  // modelled detail across the verdict frames' foreground rows
  [-.4, .9, 2.2].forEach(rz => {
    T.add(box(THREE, .34, .02, .24, '#e8e2d2', '#c9c2ae', -1.4, .66, rz, .15, .006));
    T.add(box(THREE, .3, .07, .22, '#6e2424', '#4a1414', 1.5, .68, rz, -.1, .008));
  });
  // ENV round 2: a balustrade rail in the near foreground (the verdict frames' lower
  // third was one flat brown slab) — top rail + balusters south of the last bench row
  T.add(box(THREE, 5.2, .07, .07, '#7a5a36', '#573f22', 0, 1.02, 2.62, 0, .012));
  for (let i = 0; i < 9; i++) T.add(box(THREE, .06, .95, .06, '#5d4226', '#3f2c16', -2.4 + i * .6, .5, 2.62, 0, .008));
  // ENV round 3 (fault 3): recessed panels on every bench-row BACK (the big flat
  // brown areas in the verdict frames' foreground) + a lighter cap rail per row
  [-.4, .9, 2.2].forEach(rz => {
    [-1.95, -0.65, 0.65, 1.95].forEach(px => {
      T.add(box(THREE, 1.0, .5, .03, '#543e24', '#382812', px, .95, rz - .25, 0, .008));
      T.add(box(THREE, .84, .36, .02, '#5d4226', '#3f2c16', px, .95, rz - .235, 0, .006));
    });
    T.add(box(THREE, 5.2, .06, .1, '#7a5a36', '#573f22', 0, 1.34, rz - .3, 0, .01));
  });
  // the dock: a railed box at centre where Han stands
  T.add(box(THREE, 1.7, .95, .07, '#6e4f2c', '#4c3519', 0, .48, -.95, 0, .015));
  T.add(box(THREE, .07, .95, 1.1, '#6e4f2c', '#4c3519', -.85, .48, -1.45, 0, .015));
  T.add(box(THREE, .07, .95, 1.1, '#6e4f2c', '#4c3519', .85, .48, -1.45, 0, .015));
  // ENV round 3 (fault 3): panel moulding + a brass top rail on the dock front
  [-0.42, 0.42].forEach(px => {
    T.add(box(THREE, .6, .6, .03, '#543e24', '#382812', px, .48, -.9, 0, .008));
    T.add(box(THREE, .46, .46, .02, '#5d4226', '#3f2c16', px, .48, -.885, 0, .006));
  });
  T.add(box(THREE, 1.7, .05, .05, '#a87c2c', '#77571d', 0, .99, -.93, 0, .008));
  // the courtroom door with daylight beyond (line 31's exhale)
  T.add(box(THREE, 1.3, 3.3, .09, '#3f2c16', '#2a1d0a', 3.9, 1.65, -3.6, 0, .02));
  T.add(glow(THREE, 1.05, 3.05, .03, 0xfff2d4, 3.9, 1.6, -3.55));
  // ENV round 2 (fix round): the Blender pendant lamps are REMOVED (build_set.py) —
  // at x +/-1.6 they projected onto the judge's forehead, at +/-3.4 the east shade
  // still clipped his head at the frame edge (critic fault, f_74). The courtroom's
  // in-frame practicals are the two wall sconces above, the bench brass lamps, the
  // tall windows and the corridor bulbs. No pendant bulbs remain.

  // ================= BLENDER DRESSING (Environment overhaul) =================
  // assets/set/<place>.glb, built by blender/build_set.py (Blender 5.2.5): modelled
  // dressing in the depth zones of each place (corridor shelving, plinths, shelf units,
  // pendants, panelling), place-local coords, flat palette by material name. Loaded with
  // the engine's readGlb; any missing/unreadable file simply leaves the procedural set
  // above standing, so the film always renders.
  const GLB_PALETTE = {
    wood_dark: ['#4c3519', '#33230e'], wood: ['#6e4f2c', '#4c3519'], wood_pale: ['#8a6a42', '#5f4726'],
    wall_grey: ['#5d6066', '#40434a'], wall_green: ['#274434', '#182a1e'], metal: ['#6a6e74', '#494d52'],
    brass: ['#a87c2c', '#77571d'], paper: ['#e8e2d2', '#c9c2ae'], canvas: ['#d8cdb2', '#9a8a64'],
    cloth_red: ['#6e2424', '#4a1414'], glass_blue: ['#7fa8b8', '#5d6a70'], glass_green: ['#a8b89a', '#5d6a52'],
    glass_amber: ['#c8b088', '#8a6a42'], stone: ['#c4bca8', '#98917c'], iron: ['#2e2c2c', '#1a1818'],
  };
  try {
    const { readGlb } = await import('../world/look/glb.js');
    const GLB_PLACES = [['interrogation', 0, 0], ['collection', 400, 0], ['studio', -400, 0], ['lab', 400, -400], ['courtroom', -400, -400]];
    for (const [place, ox, oz] of GLB_PLACES) {
      const data = await readGlb(THREE, new URL(`../assets/set/${place}.glb`, import.meta.url));
      if (!data || !data.roots) continue;
      for (const root of data.roots) {
        const grp = new THREE.Group();
        root.matrix.decompose(grp.position, grp.quaternion, grp.scale);
        for (const prim of root.prims) {
          const pal = GLB_PALETTE[prim.material] || ['#7a7d82', '#55585c'];
          const mesh = new THREE.Mesh(prim.geometry, flat(pal[0], pal[1]));
          mesh.frustumCulled = false;
          grp.add(mesh);
        }
        grp.position.x += ox; grp.position.z += oz;
        g.add(grp);
      }
    }
  } catch (e) { /* Blender dressing unavailable: the procedural set stands on its own */ }

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
