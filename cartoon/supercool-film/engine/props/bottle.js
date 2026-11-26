// props/bottle.js: a glass bottle (body, round shoulder, neck, cap, a cream label). Origin = the grip (body middle).
// opts: color '#4f9a6a' (glass), label '#f1e6cc', cap '#c8433a', h .38 (body)
// sockets: grip, mouth (top of the neck: to the lips for a swig), base
import { THREE, flat, basic, part, finish } from './_kit.js';
export const free = true;

export function build(o = {}) {
  const g = new THREE.Group(); g.name = 'prop.bottle';
  const r = .085, h = o.h ?? .38, glass = flat(o.color ?? '#4f9a6a', '#2f6a46');
  const prof = [[0, -h / 2], [r, -h / 2], [r, h / 2 - .04], [r * .92, h / 2 + .03], [r * .6, h / 2 + .08], [.035, h / 2 + .12], [.035, h / 2 + .24], [0, h / 2 + .24]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  g.add(part(new THREE.LatheGeometry(prof, 20), glass, .02));
  const cap = part(new THREE.CylinderGeometry(.042, .042, .045, 14), flat(o.cap ?? '#c8433a', '#8e2c24'), .012); cap.position.y = h / 2 + .25; g.add(cap);
  const lab = part(new THREE.CylinderGeometry(r + .004, r + .004, h * .38, 20, 1, true), flat(o.label ?? '#f1e6cc', '#cbbd9c'), 0); lab.position.y = -h * .05; g.add(lab);
  const shine = new THREE.Mesh(new THREE.PlaneGeometry(.018, h * .5), basic('#cfe9d8')); shine.position.set(-r * .55, h * .12, r * .84); shine.rotation.y = -.6; g.add(shine);
  return finish(g, { mouth: [0, h / 2 + .27, 0], base: [0, -h / 2, 0] });
}
