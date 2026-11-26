// films/backrooms/props/backpack.js: a worn hiking backpack (agent D, 2026-11-04). Origin = the grip = the top carry loop.
// Hand-carried: `in: 'hand:R'` (hangs below the hand). On the back: `in: 'body'`, `at` ≈ [0, 1.05, -.42] (body space: up the back),
// `rot [0, 180, 0]` turns the pocket away from his back. On the floor: `in: 'world'`, `at: [x, .62, z]` (origin is the loop).
// opts: color '#5d6a3e' (olive), dark '#3e4828', pocket '#6c7a48', strap '#2e2a24', w .62, h .62, d .3
// sockets: bottom, back (the straps' side)
import { THREE, flat, part, finish } from '../../../engine/props/_kit.js';
export const free = true;

export function build(o = {}) {
  const g = new THREE.Group(); g.name = 'prop.backpack';
  const w = o.w ?? .62, h = o.h ?? .62, d = o.d ?? .3, C = flat(o.color ?? '#5d6a3e', o.dark ?? '#3e4828');
  const body = part(new THREE.BoxGeometry(w, h, d, 2, 2, 2), C, .02); body.position.y = -h / 2 - .06; g.add(body);
  const top = part(new THREE.CylinderGeometry(d / 2, d / 2, w, 14, 1, false, 0, Math.PI), C, .02); top.rotation.z = Math.PI / 2; top.rotation.x = -Math.PI / 2; top.position.y = -.06; g.add(top);
  const pocket = part(new THREE.BoxGeometry(w * .7, h * .42, .1), flat(o.pocket ?? '#6c7a48', '#475330'), .016); pocket.position.set(0, -h * .7 - .06, d / 2 + .05); g.add(pocket);
  const flap = part(new THREE.BoxGeometry(w * .72, .06, .13), flat(o.dark ?? '#3e4828', '#2a3218'), .012); flap.position.set(0, -h * .47 - .06, d / 2 + .06); g.add(flap);
  const S = flat(o.strap ?? '#2e2a24', '#1c1914');
  const loop = part(new THREE.TorusGeometry(.07, .016, 6, 14, Math.PI), S, .01); loop.position.y = -.01; g.add(loop);
  for (const sx of [-1, 1]) { const s = part(new THREE.BoxGeometry(.07, h * .95, .04), S, .01); s.position.set(sx * w * .27, -h / 2 - .06, -d / 2 - .03); g.add(s); }
  return finish(g, { bottom: [0, -h - .06, 0], back: [0, -h / 2 - .06, -d / 2] });
}
