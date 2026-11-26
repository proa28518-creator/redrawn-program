// props/camera.js: a boxy film camera (black body, silver top plate, big lens, flash on top). Free-pose prop (PROPS_API.md).
// Origin = the grip at the body's outer end (his right end for hand:R; mirrored for hand:L). Lens looks along +Z (forward).
// opts: color '#2c2c34', plate '#c9c9cf', lens '#6f9fc7', flash 0..1 (a white burst in front of the flash), side 'R'|'L'
// sockets: grip, eye (the viewfinder at the back: put it at the eye to "hold it up to the eye"), lens (front of the lens), flash
import { THREE, flat, basic, part, finish, sideOf } from './_kit.js';
export const free = true;

export function build(o = {}) {
  const s = sideOf(o) === 'L' ? -1 : 1, g = new THREE.Group(), b = new THREE.Group(); g.name = 'prop.camera'; g.add(b);
  const W = .36, H = .22, D = .15, cx = s * (W / 2 - .02);
  b.position.x = cx;
  const body = flat(o.color ?? '#2c2c34', '#17171d');
  b.add(part(new THREE.BoxGeometry(W, H, D), body, .022));
  const plate = part(new THREE.BoxGeometry(W * 1.01, H * .3, D * 1.02), flat(o.plate ?? '#c9c9cf', '#8d8d96'), .018); plate.position.y = H * .36; b.add(plate);
  // lens: barrel + ring + glass
  const barrel = part(new THREE.CylinderGeometry(.085, .095, .12, 20), flat('#24242a', '#121216'), .02);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(-s * .02, -.015, D / 2 + .06); b.add(barrel);
  const ring = part(new THREE.TorusGeometry(.083, .012, 6, 24), flat('#b9b9c2', '#7a7a84'), .012); ring.position.set(-s * .02, -.015, D / 2 + .12); b.add(ring);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(.072, 24), basic(o.lens ?? '#5f8fbb')); glass.position.set(-s * .02, -.015, D / 2 + .121); b.add(glass);
  const glint = new THREE.Mesh(new THREE.CircleGeometry(.022, 12), basic('#e8f4ff')); glint.position.set(-s * .02 - .03, .015, D / 2 + .122); b.add(glint);
  // flash unit on the top, at the grip end
  const fx = s * (-W / 2 + .07);
  const fl = part(new THREE.BoxGeometry(.11, .08, .08), body, .018); fl.position.set(fx, H / 2 + .06, .0); b.add(fl);
  const fw = new THREE.Mesh(new THREE.PlaneGeometry(.09, .055), basic('#fffbe8')); fw.position.set(fx, H / 2 + .06, .041); b.add(fw);
  // viewfinder bump at the back + shutter button
  const vf = part(new THREE.BoxGeometry(.08, .05, .04), body, .014); vf.position.set(s * .08, .03, -D / 2 - .02); b.add(vf);
  const btn = part(new THREE.CylinderGeometry(.022, .022, .03, 10), flat('#c9c9cf'), .012); btn.position.set(s * (W / 2 - .06), H / 2 + .02, 0); b.add(btn);
  const flash = o.flash ?? 0;
  if (flash > 0) {
    const sh = new THREE.Shape(); const n = 8;
    for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, r = (i % 2 ? .12 : .3) * flash; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(r, 0); }
    const burst = new THREE.Mesh(new THREE.ShapeGeometry(sh), basic('#fffde0', { double: true })); burst.position.set(fx, H / 2 + .06, .1); b.add(burst);
  }
  const at = v => [v[0] + cx, v[1], v[2]];
  return finish(g, { eye: at([s * .08, .03, -D / 2 - .04]), lens: at([-s * .02, -.015, D / 2 + .12]), flash: at([fx, H / 2 + .06, .05]) });
}
