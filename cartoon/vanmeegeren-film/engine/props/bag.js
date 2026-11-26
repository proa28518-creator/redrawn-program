// props/bag.js: a leather satchel (body, darker flap, brass buckle). Two ways to carry it:
//   strap: 'hand' (default)   a short handle loop on top; origin = the grip at the top of the loop; use in: 'hand:R' | 'hand:L'
//   strap: 'shoulder'         a long strap from the bag up across the chest to the far shoulder; use in: 'body' (placeProp puts the
//                             origin on the hips, turned with the body; at = [x, y, z] body space, default the bag hangs at his left hip).
//                             The strap's top is opts.shoulder (body space relative to the origin: [-.32, 1.05, .02] = his right shoulder
//                             for an average adult; set it from the cast's size). opts.chest = how far in front of the hips the strap
//                             crosses the chest (.34: in front of the 2.5D torso slab).
// opts: color '#8a5a32', flap '#6b4223', buckle '#d9b45a', w .5, h .38, d .16
// sockets: grip (hand) / hip (shoulder), strapTop (shoulder mode), bottom
import { THREE, flat, part, finish, basic } from './_kit.js';
export const free = true;

export function build(o = {}) {
  const g = new THREE.Group(); g.name = 'prop.bag';
  const W = o.w ?? .5, H = o.h ?? .38, D = o.d ?? .16, shoulder = o.strap === 'shoulder';
  const leather = flat(o.color ?? '#8a5a32', '#5e3b1f'), flapM = flat(o.flap ?? '#6b4223', '#46291a'), strapM = flat(o.strapColor ?? '#5a3820', '#3c2414');
  const bag = new THREE.Group(); g.add(bag);
  const body = part(new THREE.BoxGeometry(W, H, D), leather, .022); bag.add(body);
  const flap = part(new THREE.BoxGeometry(W * 1.03, H * .55, .03), flapM, .016); flap.position.set(0, H * .24, D / 2 + .012); bag.add(flap);
  const top = part(new THREE.BoxGeometry(W * 1.03, .03, D + .04), flapM, .012); top.position.y = H / 2 + .01; bag.add(top);
  const buckle = part(new THREE.BoxGeometry(.07, .06, .02), flat(o.buckle ?? '#d9b45a', '#a8843a'), .01); buckle.position.set(0, H * .02, D / 2 + .03); bag.add(buckle);
  const stitch = new THREE.Mesh(new THREE.PlaneGeometry(W * .9, .008), basic('#c9a06a')); stitch.position.set(0, -H * .38, D / 2 + .001); bag.add(stitch);
  let sockets;
  if (!shoulder) {
    const loop = part(new THREE.TorusGeometry(.13, .022, 8, 18, Math.PI), strapM, .016); loop.position.y = H / 2 + .02; bag.add(loop);
    bag.position.y = -(H / 2 + .02 + .13); // grip = the top of the loop
    sockets = { bottom: [0, bag.position.y - H / 2, 0] };
  } else {
    // bag centred on the origin's left side; strap: bag's right top corner -> across the chest (in front) -> the shoulder -> over the back
    const sh = o.shoulder ?? [-.32, 1.05, .02], cz = o.chest ?? .34;
    const pts = [[-W * .38, H / 2, 0], [-W * .3, H / 2 + .25, cz * .6], [(sh[0] - W * .3) * .4, (H / 2 + sh[1]) * .55, cz], [sh[0] * .85, sh[1] - .08, cz * .75],
      [sh[0], sh[1] + .04, sh[2]], [sh[0] * .9, sh[1] - .1, -cz * .5]].map(p => new THREE.Vector3(...p));
    const strap = part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, .028, 6, false), strapM, .014); g.add(strap);
    sockets = { hip: [0, 0, 0], strapTop: sh, bottom: [0, -H / 2, 0] };
  }
  return finish(g, sockets);
}
