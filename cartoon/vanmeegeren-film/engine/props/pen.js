// props/pen.js (ENG8): a small ballpoint pen for `sign`. Origin = the grip (two thirds up the barrel); the nib points along local -Y
// and a little forward (+Z), so a hand at the chest writes DOWN onto a board held in front of it. opts: body '#2f5fa8', cap '#e9e2d4',
// len .26 (D), r .022. sockets: grip, nib
import { THREE, flat, part, finish } from './_kit.js';
export const free = true;

export function build(o = {}) {
  const g = new THREE.Group(); g.name = 'prop.pen';
  const L = o.len ?? .26, r = o.r ?? .022;
  const pen = new THREE.Group(); pen.rotation.x = .35;                     // nib tipped forward, toward the board
  const barrel = part(new THREE.CylinderGeometry(r, r, L * .78, 10), flat(o.body ?? '#2f5fa8'), .012);
  barrel.position.y = -L * .78 / 2 + L * .3; pen.add(barrel);
  const tip = part(new THREE.ConeGeometry(r, L * .16, 10), flat('#d9d2c4'), .01);
  tip.rotation.x = Math.PI; tip.position.y = barrel.position.y - L * .78 / 2 - L * .08; pen.add(tip);
  const cap = part(new THREE.CylinderGeometry(r * 1.08, r * 1.08, L * .14, 10), flat(o.cap ?? '#e9e2d4'), .012);
  cap.position.y = L * .3 + L * .07; pen.add(cap);
  g.add(pen);
  const nibY = tip.position.y - L * .08;
  return finish(g, { grip: [0, 0, 0], nib: [0, nibY * Math.cos(.35), nibY * Math.sin(.35) * -1] });
}
