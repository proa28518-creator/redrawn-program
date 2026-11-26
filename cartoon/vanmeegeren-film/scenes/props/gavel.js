// props/gavel.js — THE GAVEL (BIBLE.md): turned-wood head and handle, ~0.5 D long.
// Origin at the grip (the handle's lower third). The sound block is set dressing in set.js.
import { THREE, flat, part, finish } from '../../engine/props/_kit.js';

export function build(o = {}) {
  const g = new THREE.Group();
  const handle = part(new THREE.CylinderGeometry(.02, .024, .34, 10), flat('#7a4a26', '#54300f'), .006);
  handle.position.y = .1; handle.rotation.z = Math.PI / 2 - .12; handle.position.x = .02; g.add(handle);
  const head = part(new THREE.CylinderGeometry(.05, .05, .17, 12), flat('#8a5a30', '#5f3d1f'), .008);
  head.rotation.x = Math.PI / 2; head.position.set(.19, .13, 0); g.add(head);
  [-0.085, 0.085].forEach(dz => {
    const band = part(new THREE.CylinderGeometry(.053, .053, .02, 12), flat('#c8b06a', '#97803f'), .004);
    band.rotation.x = Math.PI / 2; band.position.set(.19, .13, dz); g.add(band);
  });
  return finish(g);
}
