// hats/chef.js: a chef's toque from words (agent W2). A tall pleated white band and a puffy top that mushrooms out wider than the band.
// spec "hat": { kind: 'chef', crown: '#f4f0ec', height: .5, puff: .1, pleats: 14, mount }.
import * as K from './_kit.js';
export { update } from './_kit.js';

export const DEF = {
  crown: '#f4f0ec', bandR: .47, bandH: .3, height: .5, puff: .1, pleats: 14,
  ink: '#3a2a33', inkW: .026,
  mount: { x: 0, y: .2, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 }, tilt: 0,
};

export async function build(params = {}) {
  const P = K.params(DEF, params), T = K.tones(P.crown, { dark: .84, arc: .9 });
  P.crownLit ??= T.lit; P.crownDark ??= params.crownDark ?? '#cfc6cc'; P.arc ??= '#ffffff';
  const { root, body } = K.makeRoot('chef', P);
  // the band: straight, slightly widening, pleats as soft upright lines
  const R = P.bandR, Hb = P.bandH;
  body.add(K.inked(K.lathe([[R, -.04], [R + .01, Hb * .5], [R + .02, Hb], [.001, Hb]]), K.crownMat(P, { ribs: P.pleats, ribOn: .5, pat: '#b9b0b8', arcOn: 0 }), 'chef.band', P));
  // the puff: a squashed bun sitting on the band, wider than it, with soft lobes round it (the pleats bunching up)
  const Rt = R + P.puff, Ht = P.height - Hb + .06, pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, a = -.35 + t * (Math.PI / 2 + .35);
    pts.push([Math.max(.001, Rt * Math.cos(a) * (t < .05 ? .9 + t * 2 : 1)), Hb - .06 + Ht * .45 + Ht * .55 * Math.sin(a)]);
  }
  pts.unshift([R * .95, Hb - .05]);
  const g = K.lathe(pts), pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), th = Math.atan2(x, z), r = Math.hypot(x, z);
    const k = 1 + .035 * Math.cos(th * P.pleats * .5) * Math.min(1, r / Rt) ** 4;
    pos.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  body.add(K.inked(g, K.crownMat(P, { arcR: [.8, .92] }), 'chef.puff', P));
  return root;
}
export default { build, update: K.update };
