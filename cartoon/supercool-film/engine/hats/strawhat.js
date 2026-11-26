// hats/strawhat.js: a straw boater (default) or a sun hat from words (agent W2; STYLE_BIBLE "Boater": brim about 1.5 D, crown .87 D wide,
// .33 D tall, flat straw top #ddc279, dark band, wide flat brim). sun: true = a round soft crown and a wider brim that droops at the edge.
// spec "hat": { kind: 'strawhat', crown: '#ddc279', band: '#3d2f45', sun: false, brimR, mount }.
import * as K from './_kit.js';
export { update } from './_kit.js';

export const DEF = {
  crown: '#ddc279', band: '#3d2f45', sun: false, crownR: .43, crownH: .3, brimR: .74, brimT: .02, bandH: .085, droop: .0,
  ink: '#3a2a33', inkW: .026,
  mount: { x: 0, y: .27, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 }, tilt: 0,
};

export async function build(params = {}) {
  const P = K.params(DEF, params), T = K.tones(P.crown, { dark: .72 });
  if (P.sun) { P.brimR = params.brimR ?? .8; P.droop = params.droop ?? .1; P.crownH = params.crownH ?? .3; }
  P.crownLit ??= T.lit; P.crownDark ??= T.dark; P.arc ??= T.arc; P.bandY = [-.05, P.bandH];
  const B = K.tones(P.band);
  const { root, body } = K.makeRoot('strawhat', P);
  // crown: straight sides and a flat top (boater) or a soft dome (sun hat)
  const R = P.crownR, Hh = P.crownH;
  const prof = P.sun ? K.domeProfile(R, Hh, { bulge: .02, flat: .5 }) : [[R, -.04], [R - .006, Hh * .5], [R - .015, Hh - .02], [R - .04, Hh], [.001, Hh]];
  body.add(K.inked(K.lathe(prof), K.crownMat(P, { band: B.lit, bandDark: B.dark, lines: 26, lineOn: .18, pat: '#7a6440', arcR: [.82, .93], arcAng: [95, 160] }), 'strawhat.crown', P));
  // brim: a flat ring (sun: drooping toward its edge), straw lines are too fine at this size: two tones only
  const r0 = R * .8;
  const brim = (u, v) => { const a = v * Math.PI * 2, r = r0 + (P.brimR - r0) * u; return [Math.sin(a) * r, -P.droop * Math.pow(Math.max(0, (r - R) / (P.brimR - R)), 2), Math.cos(a) * r]; };
  body.add(K.inked(K.sheet(brim, P.brimT, 12, 160, true), K.brimMat(P, { lit: T.lit, dark: T.dark, under: K.tones(P.crown, { dark: .55 }).dark }), 'strawhat.brim', P, .022));
  return root;
}
export default { build, update: K.update };
