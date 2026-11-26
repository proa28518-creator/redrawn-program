// films/s4/props/airhose.js: a diver's air hose, from the helmet valve up into the water above. Body prop: at [0, ~2, -.3] (hem frame).
// opts: len 34, snag 0|1 (1 = it runs sideways to a wreck spar first and pulls taut), snagAt [x, y, z] (prop space), color
import { THREE, flat, part, finish } from '../../../engine/props/_kit.js';
export const free = true;
export function build(o = {}) {
  const g = new THREE.Group(); g.name = 'prop.airhose';
  const L = o.len ?? 34, k = o.snag ?? 0, sn = o.snagAt ?? [-2.2, .9, -1.6];
  const pts = k < .5
    ? [[0, 0, 0], [.12, .5, -.1], [-.18, 1.5, -.2], [.35, 3.2, -.3], [-.4, 6.5, -.6], [.5, 12, -1], [-1, L * .6, -1.5], [1.2, L, -2]]
    : [[0, 0, 0], [sn[0] * .34, sn[1] * .3 + .15, sn[2] * .34], [sn[0] * .68, sn[1] * .66 + .1, sn[2] * .68], sn, [sn[0] + .1, sn[1] + 1.4, sn[2]], [sn[0] + .9, 8, sn[2] - .4], [sn[0] + 1, L * .6, sn[2]], [sn[0] + 2, L, sn[2]]];
  const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  g.add(part(new THREE.TubeGeometry(c, 90, .035, 7, false), flat(o.color ?? '#e6dcc4', '#9a8e74'), .012));
  return finish(g, {});
}
