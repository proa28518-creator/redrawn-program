// props/phone.js: a smartphone (dark slab, light-blue screen with a few app tiles on +Z). Origin = the grip (lower middle of the back).
// Held to look at: rot [-20, 180, 0] turns the screen to the holder. To the ear: hand at the ear, rot [0, 90, 0].
// opts: color '#2a2a32', screen '#8fc3e6', on true (screen lit; false = dark glass)
// sockets: grip, screen (centre of the screen face), top
import { THREE, flat, basic, part, finish } from './_kit.js';
export const free = true;

export function build(o = {}) {
  const g = new THREE.Group(); g.name = 'prop.phone';
  const W = .15, H = .3, D = .025, y0 = .07;
  const body = part(new THREE.BoxGeometry(W, H, D), flat(o.color ?? '#2a2a32', '#18181e'), .016); body.position.y = y0; g.add(body);
  const on = o.on ?? true;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(W * .84, H * .86), basic(on ? (o.screen ?? '#8fc3e6') : '#30343c')); scr.position.set(0, y0, D / 2 + .001); g.add(scr);
  if (on) for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(.03, .03), basic(['#f2c14e', '#e8705a', '#5ab88a', '#f4f4f4'][(r * 3 + c) % 4]));
    t.position.set((c - 1) * .042, y0 + .07 - r * .045, D / 2 + .002); g.add(t);
  }
  const cam = new THREE.Mesh(new THREE.CircleGeometry(.012, 10), basic('#111')); cam.position.set(0, y0 + H / 2 - .015, D / 2 + .002); g.add(cam);
  return finish(g, { screen: [0, y0, D / 2], top: [0, y0 + H / 2, 0] });
}
