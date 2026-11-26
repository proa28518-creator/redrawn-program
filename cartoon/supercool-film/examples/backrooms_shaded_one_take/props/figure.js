// films/backrooms/props/figure.js: the copy-thing, previz: a tall thin dark humanoid silhouette (agent D, 2026-11-04).
// Origin = between its feet on the ground (place it `in: 'world'`, `at: [0, 0, -40]` = the set's `hall` mark). Faces +Z.
// opts: h 4.1 (taller than the cast's ~3.2), color '#16140c' (near black, a hair of the murk in it), lean 0 (deg, forward tilt),
//       arms 'hang' | 'wide' (a little away from the body), eyes false (two faint pale points)
import { THREE, basic, finish } from '../../../engine/props/_kit.js';
export const free = true;

export function build(o = {}) {
  const g = new THREE.Group(); g.name = 'prop.figure';
  const h = o.h ?? 4.1, k = h / 4.1, m = basic(o.color ?? '#16140c');
  const add = (geo, x, y, z, rz = 0) => { const s = new THREE.Mesh(geo, m); s.position.set(x * k, y * k, z * k); s.rotation.z = rz; g.add(s); return s; };
  // legs: long, thin, slightly apart
  for (const sx of [-1, 1]) add(new THREE.CapsuleGeometry(.075 * k, 1.75 * k, 4, 8), sx * .14, .95, 0, sx * .03);
  // torso: narrow, a little wider at the shoulders
  add(new THREE.CylinderGeometry(.27 * k, .17 * k, 1.4 * k, 12), 0, 2.45, 0);
  // neck + small head (too small for the body: the wrongness)
  add(new THREE.CylinderGeometry(.05 * k, .06 * k, .3 * k, 8), 0, 3.28, 0);
  add(new THREE.SphereGeometry(.24 * k, 16, 12), 0, 3.58, 0).scale.set(1, 1.18, 1);
  // arms: too long, hanging to the knees
  const wide = o.arms === 'wide' ? .22 : .06;
  for (const sx of [-1, 1]) add(new THREE.CapsuleGeometry(.05 * k, 1.85 * k, 4, 8), sx * (.33 + wide * .5), 2.12, 0, sx * wide);
  if (o.eyes) for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.CircleGeometry(.025 * k, 8), basic('#d8d2b0')); e.position.set(sx * .08 * k, 3.62 * k, .23 * k); g.add(e); }
  if (o.lean) g.rotation.x = (o.lean * Math.PI) / 180;
  return finish(g, { head: [0, 3.58 * k, 0], top: [0, h, 0] });
}
