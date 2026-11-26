// hats/beanie.js: a knit beanie from words (agent W2). A soft dome pulled low, knit ribs, a folded-up rim (cuff) with its own ribs,
// optional pompom. spec "hat": { kind: 'beanie', crown: '#d0a032', cuff: <colour, default crown>, pom: true, pomColour, slouch, mount }.
import * as THREE from '../three.js';
import * as K from './_kit.js';
export { update } from './_kit.js';

export const DEF = {
  crown: '#d0a032', crownR: .5, crownH: .42, ribs: 28, cuffH: .13, cuffOut: .022, pom: false, pomR: .1, slouch: 0,
  ink: '#3a2a33', inkW: .026,
  mount: { x: 0, y: .1, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 }, tilt: 0,
};

export async function build(params = {}) {
  const P = K.params(DEF, params), T = K.tones(P.crown), C = K.tones(P.cuff ?? P.crown);
  P.crownLit ??= T.lit; P.crownDark ??= T.dark; P.arc ??= T.arc;
  const { root, body } = K.makeRoot('beanie', P);
  // crown: a soft dome from inside the cuff, slouch = the top pushed back and down
  const g = K.lathe(K.domeProfile(P.crownR - .01, P.crownH, { bulge: .02, flat: .75, y0: P.cuffH * .5 }));
  if (P.slouch) { const pos = g.attributes.position; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), k = Math.max(0, (y - .2) / P.crownH); pos.setZ(i, pos.getZ(i) - P.slouch * k * k); } g.computeVertexNormals(); }
  body.add(K.inked(g, K.crownMat(P, { ribs: P.ribs, ribOn: .16, pat: '#6e5a52', arcR: [.82, .9] }), 'beanie.crown', P));
  // cuff: a thick rounded ring, slightly proud of the crown
  const r = P.crownR + P.cuffOut, h = P.cuffH;
  const cuff = K.lathe([[r - .03, -.02], [r, 0], [r + .008, h * .5], [r, h], [r - .04, h + .008], [.001, h + .008]]);
  body.add(K.inked(cuff, K.crownMat(P, { lit: C.lit, dark: C.dark, arc: C.arc, arcOn: .5, ribs: P.ribs, ribOn: .24, pat: '#6e5a52', arcR: [.86, .97] }), 'beanie.cuff', P, .024));
  if (P.pom) {
    const pc = K.tones(P.pomColour ?? '#f2ece5');
    const pom = K.inked(new THREE.IcosahedronGeometry(P.pomR, 3), K.crownMat(P, { lit: pc.lit, dark: pc.dark, arc: pc.arc, arcR: [.6, .85] }), 'beanie.pom', P, .022);
    pom.position.set(0, P.cuffH * .5 + P.crownH + P.pomR * .55, -P.slouch * .9); body.add(pom);
  }
  return root;
}
export default { build, update: K.update };
