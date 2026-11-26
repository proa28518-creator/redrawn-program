// hats/diver.js: a hard-hat diving helmet (S-4 short, 2026-11-04). A metal sphere round the whole head with a round open port the face
// looks out of, a thick port ring, two small side ports, a neck collar. spec "hat": { kind: 'diver', shell: '#c79a3e', trim: '#7e5d22', mount }.
// The face is the character's own: it draws on the head inside the port. Under it use hair "lobe".
import * as THREE from '../three.js';
import * as K from './_kit.js';
export { update } from './_kit.js';

export const DEF = {
  shell: '#c79a3e', trim: '#7e5d22', R: .69, port: .47, ink: '#3a2a33', inkW: .03,
  mount: { x: 0, y: -.02, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 }, tilt: 0,
};

const ring = (r, tube, m, name, P, pos, rot) => { const o = K.inked(new THREE.TorusGeometry(r, tube, 12, 64), m, name, P, .022); if (pos) o.position.set(...pos); if (rot) o.rotation.set(...rot); return o; };

export async function build(params = {}) {
  const P = K.params(DEF, params), T = K.tones(P.shell), U = K.tones(P.trim);
  P.crownLit ??= T.lit; P.crownDark ??= T.dark; P.arc ??= T.arc;
  const { root, body } = K.makeRoot('diver', P);
  // the shell: a sphere lathed round Z, open at +Z (angle a0 from the axis = the port)
  const a0 = Math.asin(P.port / P.R), pts = [];
  for (let i = 0; i <= 36; i++) { const a = a0 + (Math.PI - a0) * i / 36; pts.push([Math.max(.001, P.R * Math.sin(a)), P.R * Math.cos(a)]); }
  const shell = K.lathe(pts); shell.rotateX(Math.PI / 2);
  const mat = K.crownMat(P, { arcR: [.78, .9], arcOn: .8 });
  mat.side = THREE.DoubleSide;
  body.add(K.inked(shell, mat, 'diver.shell', P));
  const trim = K.crownMat(P, { lit: U.lit, dark: U.dark, arc: U.arc, arcOn: .4 });
  const z0 = P.R * Math.cos(a0);
  body.add(ring(P.port + .02, .055, trim, 'diver.port', P, [0, 0, z0]));
  body.add(ring(.15, .035, trim, 'diver.sideL', P, [.66, .05, -.02], [0, Math.PI / 2, 0]));
  body.add(ring(.15, .035, trim, 'diver.sideR', P, [-.66, .05, -.02], [0, Math.PI / 2, 0]));
  // neck collar
  body.add(ring(.56, .085, trim, 'diver.collar', P, [0, -.56, -.05], [Math.PI / 2, 0, 0]));
  // the air valve on the back
  const v = K.inked(new THREE.CylinderGeometry(.06, .08, .22, 12), trim, 'diver.valve', P, .018); v.position.set(0, .6, -.34); v.rotation.x = -.6; body.add(v);
  return root;
}
export default { build, update: K.update };
