// films/backrooms/props/almond_water.js: a plastic bottle of almond water (agent D, 2026-11-04). Origin = the grip (body middle).
// opts: h .42 (body), liquid '#efe8d6' (milky), cap '#4a78b8', label '#f6f2e6', text 'ALMOND WATER'
// sockets: mouth (top of the cap: to the lips), base
import { THREE, flat, basic, part, finish, canvasTex } from '../../../engine/props/_kit.js';
export const free = true;

export function build(o = {}) {
  const g = new THREE.Group(); g.name = 'prop.almond_water';
  const r = .052, h = o.h ?? .27;
  const prof = [[0, -h / 2], [r, -h / 2], [r, h / 2 - .05], [r * .85, h / 2 + .015], [.024, h / 2 + .06], [.024, h / 2 + .085], [0, h / 2 + .085]].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(part(new THREE.LatheGeometry(prof, 20), flat(o.liquid ?? '#efe8d6', '#c9bfa6'), .018));
  const cap = part(new THREE.CylinderGeometry(.028, .028, .035, 14), flat(o.cap ?? '#4a78b8', '#2f5486'), .012); cap.position.y = h / 2 + .1; g.add(cap);
  // label: printed text on a band (canvas texture), facing +Z
  let labMat;
  try {
    const tex = canvasTex(256, 96, (c, w, hh) => { c.fillStyle = o.label ?? '#f6f2e6'; c.fillRect(0, 0, w, hh); c.fillStyle = '#3a2a33'; c.font = '900 30px Arial Black, Arial';
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ALMOND', w / 2, hh * .33); c.fillText('WATER', w / 2, hh * .72); });
    labMat = new THREE.MeshBasicMaterial({ map: tex });
  } catch (e) { labMat = basic(o.label ?? '#f6f2e6'); }
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(r + .004, r + .004, h * .42, 24, 1, true, -Math.PI / 2, Math.PI), labMat); lab.position.y = -h * .04; g.add(lab);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(r + .003, r + .003, h * .42, 24, 1, true, Math.PI / 2, Math.PI), basic(o.label ?? '#f6f2e6')); back.position.y = -h * .04; g.add(back);
  return finish(g, { mouth: [0, h / 2 + .12, 0], base: [0, -h / 2, 0] });
}
