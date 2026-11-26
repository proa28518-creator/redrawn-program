// films/s4/props/hammer.js: a small steel hammer or spanner. Origin = the grip, handle along +Y, the head at the top pointing +Z.
// opts: wrench 0|1 (a big spanner instead), color. socket: head
import { THREE, flat, part, finish } from '../../../engine/props/_kit.js';
export const free = true;
export function build(o = {}) {
  const g = new THREE.Group(); g.name = 'prop.hammer';
  const S = flat(o.color ?? '#b9bfc4', '#6f767c'), W = flat('#8a5e38', '#5e3f24');
  if (o.wrench) {
    const h = part(new THREE.BoxGeometry(.07, .62, .035), S, .014); h.position.y = .16; g.add(h);
    const a = part(new THREE.CylinderGeometry(.11, .11, .04, 14), S, .014); a.rotation.x = Math.PI / 2; a.position.y = .48; g.add(a);
  } else {
    const h = part(new THREE.CylinderGeometry(.022, .026, .5, 8), W, .012); h.position.y = .12; g.add(h);
    const b = part(new THREE.BoxGeometry(.08, .08, .26), S, .014); b.position.y = .38; g.add(b);
  }
  g.scale.setScalar(o.scale ?? 1.25); return finish(g, { head: [0, .5, 0] });
}
