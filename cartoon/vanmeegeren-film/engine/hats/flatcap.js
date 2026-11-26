// hats/flatcap.js: a flat cap / newsboy cap from words (agent W2; STYLE_BIBLE "Peaked flat cap" of Worker 2 / Cap man: grey crown #6a6561
// with a pale rim highlight, dark band, low). A low puffy crown that leans forward over a short stiff peak, a thin dark band.
// spec "hat": { kind: 'flatcap', crown: '#6a6561', band: '#362b31', newsboy: true (rounder, fuller, a button), tilt, mount }.
import * as THREE from '../three.js';
import * as K from './_kit.js';
export { update } from './_kit.js';

export const DEF = {
  crown: '#6a6561', band: '#362b31', crownR: .48, crownH: .2, fwd: .09, stretch: 1.12, droop: .08, newsboy: false,
  peakR: .15, peakAng: 55, peakDrop: .35, peakT: .018, bandH: .05,
  ink: '#3a2a33', inkW: .026,
  mount: { x: 0, y: .24, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 }, tilt: 0,
};

export async function build(params = {}) {
  const P = K.params(DEF, params), T = K.tones(P.crown);
  P.crownLit ??= T.lit; P.crownDark ??= T.dark; P.arc ??= T.arc;
  const news = P.newsboy, R = P.crownR + (news ? .03 : 0), Hh = P.crownH + (news ? .06 : 0);
  const { root, body } = K.makeRoot('flatcap', P);
  // band: a short straight ring the crown sits on
  const band = K.inked(K.lathe([[P.crownR * .96, -.03], [P.crownR * .97, P.bandH], [.001, P.bandH]]), K.crownMat(P, { lit: P.band, dark: K.tones(P.band).dark, arcOn: 0 }), 'flatcap.band', P, .022);
  body.add(band);
  // crown: a flat puffy cushion, stretched and slid forward, its front edge drooping over the peak
  const g = K.lathe(K.domeProfile(R, Hh, { bulge: .05, flat: .35, y0: 0 }));
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const f = Math.max(0, z / R);
    z = z * P.stretch + P.fwd; y = y + P.bandH * .6 - P.droop * f * f * (1 - y / (Hh + .3));
    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  body.add(K.inked(g, K.crownMat(P, { arcR: [.80, .92] }), 'flatcap.crown', P));
  if (news) { const b = K.inked(new THREE.SphereGeometry(.03, 14, 8), K.crownMat(P), 'flatcap.button', P, .016); b.position.set(0, Hh + P.bandH * .6 - .01, P.fwd); b.scale.y = .6; body.add(b); }
  // the short stiff peak under the crown's front
  const a0 = P.peakAng * Math.PI / 180, r0 = P.crownR * .9;
  const peak = (u, v) => { const a = (v - .5) * 2 * a0, r = r0 + P.peakR * u * Math.cos((v - .5) * 2 * 1.2) ** .5; return [Math.sin(a) * r, .01 - P.peakDrop * P.peakR * u, Math.cos(a) * r + .02]; };
  body.add(K.inked(K.sheet(peak, P.peakT, 8, 48), K.brimMat(P, { lit: T.lit, dark: T.dark, under: T.band }), 'flatcap.peak', P, .02));
  return root;
}
export default { build, update: K.update };
