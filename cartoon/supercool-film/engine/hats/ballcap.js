// hats/ballcap.js: a baseball cap from words (agent W2). Puffy six-panel crown (seams as faint ribs), a button on top, a curved bill.
// spec "hat": { kind: 'ballcap', crown: '#c8483a', bill: <colour, default the crown's dark>, backwards: true, tilt, turn, mount }.
// Every colour key optional: crownLit/crownDark/arc from `crown` (kit tones), billLit/billDark from `bill`.
import * as THREE from '../three.js';
import * as K from './_kit.js';
export { update } from './_kit.js';

export const DEF = {
  crown: '#c8483a', crownR: .47, crownH: .34, bulge: .035, flat: .62, seams: 6, front: .04, // front = crown pushed toward the face, D
  billR: .27, billAng: 60, billCurve: .06, billDrop: .09, billT: .02,                       // bill depth past the crown, half angle (deg), side curl down, slope
  button: .035, ink: '#3a2a33', inkW: .026,
  mount: { x: 0, y: .19, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 }, tilt: 0, backwards: false,
};

export async function build(params = {}) {
  const P = K.params(DEF, params), T = K.tones(P.crown), B = K.tones(P.bill ?? P.crown);
  P.crownLit ??= T.lit; P.crownDark ??= T.dark; P.arc ??= T.arc;
  const { root, body } = K.makeRoot('ballcap', P);
  const prof = K.domeProfile(P.crownR, P.crownH, { bulge: P.bulge, flat: P.flat });
  prof.unshift([P.crownR * .98, -.03]);
  const crown = K.inked(K.lathe(prof), K.crownMat(P, { ribs: P.seams, ribOn: .35, pat: '#7a6a70', arcR: [.84, .9] }), 'ballcap.crown', P);
  crown.position.z = P.front; body.add(crown);
  const btn = K.inked(new THREE.SphereGeometry(P.button, 16, 10), K.crownMat(P), 'ballcap.button', P, .018);
  btn.position.set(0, P.crownH - .005, P.front); btn.scale.y = .6; body.add(btn);
  // the bill: from just inside the crown's front foot out billR, curled down at its sides, sloping down
  const a0 = P.billAng * Math.PI / 180, r0 = P.crownR * .92;
  const bill = (u, v) => {
    const a = (v - .5) * 2 * a0, r = r0 + (P.billR * Math.cos((v - .5) * 2 * 1.1) ** .5) * u;
    const x = Math.sin(a) * r, z = Math.cos(a) * r + P.front;
    const side = Math.abs(v - .5) * 2;
    return [x, -P.billDrop * u * P.billR - P.billCurve * side * side * u - .005, z];
  };
  const billM = K.inked(K.sheet(bill, P.billT, 10, 64), K.brimMat(P, { lit: P.billLit ?? B.lit, dark: P.billDark ?? B.dark, under: B.band }), 'ballcap.bill', P, .022);
  body.add(billM);
  return root;
}
export default { build, update: K.update };
