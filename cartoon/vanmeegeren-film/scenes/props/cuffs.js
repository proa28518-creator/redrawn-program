// props/cuffs.js — THE HANDCUFFS (BIBLE.md): two steel rings on a short chain, ~0.3 D across.
// Origin at the chain's middle (the grip when carried / the resting point on the table).
import { THREE, flat, part, finish } from '../../engine/props/_kit.js';

export function build(o = {}) {
  const g = new THREE.Group();
  [-0.11, 0.11].forEach(dx => {
    const ring = part(new THREE.TorusGeometry(.075, .014, 8, 20), flat('#c8ced2', '#8f979e'), .005);
    ring.position.x = dx; g.add(ring);
  });
  for (let i = -1; i <= 1; i++) {
    const link = part(new THREE.TorusGeometry(.026, .008, 6, 12), flat('#aeb6bc', '#79828a'), .003);
    link.position.x = i * .045; link.rotation.y = i % 2 ? Math.PI / 2 : 0; g.add(link);
  }
  return finish(g);
}
