// films/backrooms/props/flashlight.js: a black metal flashlight (agent D, 2026-11-04). Origin = the grip (middle of the barrel).
// Lens points +Z (forward, the body's facing with rot [0,0,0]); point it: rotate about Y / X. opts: color '#2c2c32', on 1 (lens
// glow + a faint beam cone, 0 = off), beam 2.4 (cone length, 0 = no cone), len .5
// sockets: lens, tail
import { THREE, flat, basic, part, finish } from '../../../engine/props/_kit.js';
export const free = true;

export function build(o = {}) {
  const g = new THREE.Group(); g.name = 'prop.flashlight';
  const L = o.len ?? .5, C = flat(o.color ?? '#2c2c32', '#16161a');
  const barrel = part(new THREE.CylinderGeometry(.045, .045, L * .7, 14), C, .012); barrel.rotation.x = Math.PI / 2; barrel.position.z = -L * .1; g.add(barrel);
  const head = part(new THREE.CylinderGeometry(.075, .05, L * .3, 16), C, .012); head.rotation.x = Math.PI / 2; head.position.z = L * .4; g.add(head);
  const on = o.on ?? 1;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(.064, 16), basic(on ? '#fff6c8' : '#8a8c90')); lens.position.z = L * .55 + .002; g.add(lens);
  const sw = part(new THREE.BoxGeometry(.03, .02, .06), flat('#b8443a', '#7a2a24'), .006); sw.position.set(0, .05, L * .05); g.add(sw);
  if (on && (o.beam ?? 2.4) > 0) {
    const bl = o.beam ?? 2.4, cone = new THREE.Mesh(new THREE.ConeGeometry(.55, bl, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: '#fff3c0', transparent: true, opacity: .14 * on, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    cone.rotation.x = -Math.PI / 2; cone.position.z = L * .55 + bl / 2; g.add(cone);
  }
  return finish(g, { lens: [0, 0, L * .55], tail: [0, 0, -L * .45] });
}
