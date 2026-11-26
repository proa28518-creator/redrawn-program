// props/palette.js — the thumb palette (BIBLE.md): a kidney board with dabs of ochre, blue,
// white and umber. Origin at the thumb grip; the board faces +z/up when held. ~0.55 D wide.
import { THREE, flat, part, finish } from '../../engine/props/_kit.js';

export function build(o = {}) {
  const g = new THREE.Group();
  const board = part(new THREE.CylinderGeometry(.27, .27, .025, 22), flat('#9a6c3c', '#6e4a26'), .012);
  board.scale.z = .78; board.rotation.x = Math.PI / 2 - .5; g.add(board);
  const dabs = [['#c8922e', -.14, .05], ['#274b8f', .02, .1], ['#f0ead9', .15, .02], ['#5d3a22', -.04, -.09], ['#7d2f26', .12, -.08]];
  dabs.forEach(([c, dx, dy]) => {
    const d = part(new THREE.SphereGeometry(.038, 10, 8), flat(c, '#3a3230'), .004);
    d.scale.y = .45; d.position.set(dx, .028, dy); d.rotation.x = -.5; g.add(d);
  });
  return finish(g);
}
