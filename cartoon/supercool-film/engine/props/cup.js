// props/cup.js: a paper take-away cup (white, tapered, a coloured sleeve, a plastic lid with a sip slot). Origin = the grip (the sleeve's middle).
// opts: sleeve '#c9824a', color '#f4f1ea', lid '#e8e6e2', h .32
// sockets: grip, lip (the sip slot: bring it to the mouth for a sip)
import { THREE, flat, basic, part, finish } from './_kit.js';
export const free = true;

export function build(o = {}) {
  const g = new THREE.Group(); g.name = 'prop.cup';
  const h = o.h ?? .32, rt = .11, rb = .08, y0 = .02;
  const cup = part(new THREE.CylinderGeometry(rt, rb, h, 20), flat(o.color ?? '#f4f1ea', '#cfcac0'), .02); cup.position.y = y0; g.add(cup);
  const sl = part(new THREE.CylinderGeometry(rt * .93 + .012, rb * 1.05 + .012 + (rt - rb) * .3, h * .4, 20), flat(o.sleeve ?? '#c9824a', '#94592c'), .014); sl.position.y = y0 - h * .04; g.add(sl);
  const lid = part(new THREE.CylinderGeometry(rt * .92, rt + .012, .04, 20), flat(o.lid ?? '#e8e6e2', '#b9b6b0'), .014); lid.position.y = y0 + h / 2 + .02; g.add(lid);
  const dome = part(new THREE.CylinderGeometry(rt * .7, rt * .92, .025, 20), flat(o.lid ?? '#e8e6e2', '#b9b6b0'), .012); dome.position.y = y0 + h / 2 + .052; g.add(dome);
  const slot = new THREE.Mesh(new THREE.PlaneGeometry(.05, .014), basic('#3a2a33')); slot.rotation.x = -Math.PI / 2; slot.position.set(0, y0 + h / 2 + .066, rt * .5); g.add(slot);
  return finish(g, { lip: [0, y0 + h / 2 + .06, rt * .5] });
}
