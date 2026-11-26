// hats/headband.js: a headband / sweatband / bandana tied round the head (FX2, 2026-11-04). A cloth band round the head at the forehead,
// tipped so the front sits above the brows and the back drops toward the nape; the hair shows above it. Flat two-tone fill with one hard
// shade edge and the ink outline (_kit.js crownMat + inked), optional stripe through the middle, optional knot + two short tails at the back.
// spec "hat": { kind: 'headband', crown: '#c8323a', stripe: '#f4eee6' | null, knot: true, width: .1, y: .22, back: 12, thick: .028, mount }
//   crown = band colour; width = band height (D); y = how high the band's ring sits on the head (D above the head centre, along its tipped
//   axis); back = degrees the ring tips (front up, back down); knot = the tied ends at the back (bandana), false = a plain sweatband.
import * as THREE from '../three.js';
import * as K from './_kit.js';
export { update } from './_kit.js';

export const DEF = {
  crown: '#c8323a', stripe: null, knot: true, width: .1, y: .22, back: 12, thick: .028, headR: .5,
  ink: '#3a2a33', inkW: .022,
  mount: { x: 0, y: .22, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 }, tilt: 0,
};

export async function build(params = {}) {
  const P = K.params(DEF, params), T = K.tones(P.crown);
  P.crownLit ??= T.lit; P.crownDark ??= T.dark; P.arc ??= T.arc;
  const { root, body } = K.makeRoot('headband', P);
  // the ring lives in a group at the head centre, tipped about X (front up); the pivot is at mount.y on the head axis
  const G = new THREE.Group(); G.position.set(0, -P.mount.y, 0); G.rotation.x = -P.back * Math.PI / 180; body.add(G);
  const yc = P.y, h = P.width, t = P.thick, r0 = Math.sqrt(Math.max(.01, P.headR * P.headR - yc * yc)) + .006, r1 = r0 + t;
  // closed rounded cross-section (inner bottom -> outer bottom -> outer top -> inner top), turned round the head
  const sec = [];
  const arc = (cx, cy, rr, a0, a1, n = 6) => { for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; sec.push(new THREE.Vector2(cx + rr * Math.cos(a), cy + rr * Math.sin(a))); } };
  const rr = Math.min(t * .5, h * .3);
  sec.push(new THREE.Vector2(r0, yc + h / 2));
  sec.push(new THREE.Vector2(r0, yc - h / 2));
  arc(r1 - rr, yc - h / 2 + rr, rr, -Math.PI / 2, 0);
  arc(r1 - rr, yc + h / 2 - rr, rr, 0, Math.PI / 2);
  sec.push(new THREE.Vector2(r0, yc + h / 2));
  const g = new THREE.LatheGeometry(sec, 160); g.computeVertexNormals();
  const band = K.inked(g, K.crownMat(P, { arcOn: .5, arcR: [.86, .95], ...(P.stripe ? { band: P.stripe, bandDark: K.tones(P.stripe).dark, b0: yc - h * .14, b1: yc + h * .14 } : {}) }), 'headband.band', P);
  G.add(band);
  if (P.knot) {
    // the tied ends at the back: a small knot on the band and two short tails hanging down and out (ring space: -Z is the back)
    const plain = K.crownMat(P, { arcOn: 0 });
    const kn = K.inked(new THREE.SphereGeometry(.055, 20, 14), plain, 'headband.knot', P, .02);
    kn.position.set(0, yc, -r1 - .015); kn.scale.set(1.2, .9, .75); G.add(kn);
    for (const s of [-1, 1]) {
      const tail = K.inked(new THREE.ConeGeometry(.055, .22, 20, 1), plain, 'headband.tail', P, .02);
      tail.position.set(s * .06, yc - .11, -r1 - .03); tail.rotation.set(Math.PI - .35, 0, s * .45); tail.scale.z = .45; G.add(tail);
    }
  }
  return root;
}
export default { build, update: K.update };
