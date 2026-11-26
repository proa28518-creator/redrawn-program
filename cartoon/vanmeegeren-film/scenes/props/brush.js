// props/brush.js — the painter's brush (BIBLE.md): wooden handle, brass ferrule, bristles with
// an ochre paint tip. Origin at the grip (lower third of the handle). Length ~0.42 D.
import { THREE, flat, part, finish } from '../../engine/props/_kit.js';

export function build(o = {}) {
  const g = new THREE.Group();
  const handle = part(new THREE.CylinderGeometry(.016, .02, .26, 10), flat('#8a5a30', '#5f3d1f'), .006);
  handle.position.y = .1; g.add(handle);
  const ferrule = part(new THREE.CylinderGeometry(.02, .018, .05, 10), flat('#c8b06a', '#97803f'), .005);
  ferrule.position.y = .255; g.add(ferrule);
  const bristle = part(new THREE.ConeGeometry(.017, .09, 10), flat('#4a3826', '#2e2115'), .005);
  bristle.position.y = .325; g.add(bristle);
  const tip = part(new THREE.ConeGeometry(.011, .04, 10), flat('#c8922e', '#9a6c1d'), .004);
  tip.position.y = .345; g.add(tip);
  return finish(g);
}
