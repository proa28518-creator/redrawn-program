// hats/headscarf.js: a tied kerchief / headscarf from words (agent W2). A cloth cap over the top and back of the head, its front edge
// across the upper forehead, tipped so the back comes down to the nape, a knot at the back with two short tails; polka dots optional.
// spec "hat": { kind: 'headscarf', crown: '#b8434e', dots: true, dotColour: '#f4ead8', knot: 'back' | 'chin' (chin = no knot behind), mount }.
import * as THREE from '../three.js';
import * as K from './_kit.js';
export { update } from './_kit.js';

export const DEF = {
  crown: '#b8434e', dots: true, dotColour: '#f4ead8', crownR: .52, crownH: .45, back: 16, knot: 'back',
  ink: '#3a2a33', inkW: .026,
  mount: { x: 0, y: .12, z: -.02, rx: 0, ry: 0, rz: 0, scale: 1 }, tilt: 0,
};

export async function build(params = {}) {
  const P = K.params(DEF, params), T = K.tones(P.crown);
  P.crownLit ??= T.lit; P.crownDark ??= T.dark; P.arc ??= T.arc;
  const { root, body } = K.makeRoot('headscarf', P);
  const cloth = new THREE.Group(); cloth.rotation.x = -P.back * Math.PI / 180; body.add(cloth); // tipped: front up, back down
  const mat = K.crownMat(P, { dots: P.dots ? 2.2 : 0, pat: P.dotColour, dotOn: .85, arcR: [.8, .92] });
  const prof = K.domeProfile(P.crownR, P.crownH, { bulge: .03, flat: .7 });
  prof.unshift([P.crownR - .015, -.04]);
  cloth.add(K.inked(K.lathe(prof), mat, 'headscarf.cloth', P));
  if (P.knot === 'back') {
    // knot + two tails at the back, under the cloth's back edge (cloth space: -Z is the back)
    const plain = K.crownMat(P, { arcOn: 0 });
    for (const s of [-1, 1]) {
      const tail = K.inked(new THREE.ConeGeometry(.07, .24, 20, 1), plain, 'headscarf.tail', P, .022);
      tail.position.set(s * .08, -.13, -P.crownR + .02); tail.rotation.set(Math.PI - .25, 0, s * .5); tail.scale.z = .5; cloth.add(tail);
    }
    const kn = K.inked(new THREE.SphereGeometry(.07, 20, 14), plain, 'headscarf.knot', P, .022);
    kn.position.set(0, -.02, -P.crownR + .01); kn.scale.set(1.25, .85, .8); cloth.add(kn);
  }
  return root;
}
export default { build, update: K.update };
