// props/broom.js: a straw broom (long wooden handle, flared straw head with two red bindings). Origin = the grip on the handle; the handle
// runs down -Y to the head (like the cane), so a broom held at the side stands on its bristles. Sweeping: two hands on the handle,
// the other hand at sockets.grip2; rot [30, 0, 0] leans it forward.
// opts: length 1.9 (handle below the grip + above), grip .35 (handle above the grip), color '#8a5a32', straw '#d9b45a', band '#c8433a'
// sockets: grip, grip2 (.5 D lower on the handle), top, bristles (the sweeping end)
import { THREE, flat, part, finish } from './_kit.js';
export const free = true;

export function build(o = {}) {
  const g = new THREE.Group(); g.name = 'prop.broom';
  const L = o.length ?? 1.9, up = o.grip ?? .35, wood = flat(o.color ?? '#8a5a32', '#5e3b1f');
  const h = part(new THREE.CylinderGeometry(.028, .028, L, 8), wood, .02); h.position.y = up - L / 2; g.add(h);
  const y0 = up - L; // bottom of the handle = top of the head
  const straw = flat(o.straw ?? '#d9b45a', '#a8843a');
  const neck = part(new THREE.CylinderGeometry(.06, .09, .16, 10), straw, .018); neck.position.y = y0 - .06; g.add(neck);
  const headGeo = new THREE.CylinderGeometry(.09, .26, .42, 12, 1); headGeo.scale(1, 1, .38);
  const head = part(headGeo, straw, .022); head.position.y = y0 - .34; g.add(head);
  for (const [y, r] of [[y0 - .02, .07], [y0 - .2, .135]]) {
    const b = part(new THREE.CylinderGeometry(r, r, .04, 12), flat(o.band ?? '#c8433a', '#8e2c24'), .01); b.scale.z = y < y0 - .1 ? .45 : 1; b.position.y = y; g.add(b);
  }
  return finish(g, { grip2: [0, -.5, 0], top: [0, up, 0], bristles: [0, y0 - .55, 0] });
}
