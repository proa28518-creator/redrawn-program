// props/ball.js: a beach ball in coloured gores with an ink line on every seam (or one colour: opts.colors = ['#d8452f']).
// Origin = the grip under the ball (it sits on the palm); in: 'world' at [x, r, z] rests it on the ground.
// opts: r .2, colors ['#d8452f', '#f2ece0', '#3f7fc8', '#f2c14e']
// sockets: grip, centre
import { THREE, flat, part, finish } from './_kit.js';
export const free = true;

export function build(o = {}) {
  const g = new THREE.Group(); g.name = 'prop.ball';
  const r = o.r ?? .2, cols = o.colors ?? ['#d8452f', '#f2ece0', '#3f7fc8', '#f2c14e'], n = cols.length === 1 ? 1 : 6;
  for (let i = 0; i < n; i++) {
    const c = cols[i % cols.length], geo = new THREE.SphereGeometry(r, 10, 14, i / n * Math.PI * 2, Math.PI * 2 / n);
    const m = part(geo, flat(c, new THREE.Color(c).multiplyScalar(.7).getStyle()), .018); m.position.y = r; g.add(m);
  }
  if (n > 1) for (const sy of [1, -1]) { const cap = part(new THREE.CircleGeometry(r * .18, 12), flat('#f2ece0'), .01); cap.rotation.x = -sy * Math.PI / 2; cap.position.y = r + sy * r * .995; g.add(cap); }
  return finish(g, { centre: [0, r, 0] });
}
