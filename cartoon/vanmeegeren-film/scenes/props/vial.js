// props/vial.js — a reagent vial (BIBLE.md): glass tube, cork, and a liquid whose colour is a
// timed state — state via userData.update: liquid 0 = pale straw, 1 = the changed deep violet
// (line 25's reveal). Origin at the tube's base (the grip). ~0.25 D high.
import { THREE, flat, basic, part, finish } from '../../engine/props/_kit.js';

export function build(o = {}) {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .22, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xd8ecef, transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.y = .11; g.add(glass);
  const bottom = part(new THREE.CylinderGeometry(.045, .04, .015, 14), flat('#c8dde2', '#9db8be'), .004);
  bottom.position.y = .008; g.add(bottom);
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(.038, .038, .13, 12),
    new THREE.MeshBasicMaterial({ color: 0xd8b84a }));
  liquid.position.y = .075; g.add(liquid);
  const cork = part(new THREE.CylinderGeometry(.04, .034, .05, 12), flat('#c2a06a', '#97793f'), .005);
  cork.position.y = .245; g.add(cork);
  g.userData.update = (obj, q) => {
    const v = q.liquid || 0;
    liquid.material.color.setHex(0xd8b84a).lerp(new THREE.Color(0x5a2e8c), v);
  };
  g.userData.update(g, o);
  return finish(g);
}
