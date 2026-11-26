// props/fishing_rod.js: a fishing rod (cork handle, reel, tapered rod, line + red/white bobber). Origin = the grip on the cork; the rod
// points up +Y (rot [-40, 0, 0] tips it forward over the water). The line always hangs straight down from the tip in the world
// (whatever rot the rod has), opts.line long.
// opts: length 2.8, line 1.4 (0 = no line), color '#4a3a2c' (rod), cork '#c99a62', bobber true
// sockets: grip, tip, reel
import { THREE, flat, basic, part, finish, hangDown } from './_kit.js';
export const free = true;

export function build(o = {}) {
  const g = new THREE.Group(); g.name = 'prop.fishing_rod';
  const L = o.length ?? 2.8, line = o.line ?? 1.4;
  const cork = part(new THREE.CylinderGeometry(.034, .04, .34, 10), flat(o.cork ?? '#c99a62', '#8f6a3e'), .016); cork.position.y = -.05; g.add(cork);
  const rodGeo = new THREE.CylinderGeometry(.008, .024, L, 8); rodGeo.translate(0, L / 2, 0);
  const rod = part(rodGeo, flat(o.color ?? '#4a3a2c', '#2e241a'), .012); rod.position.y = .12; g.add(rod);
  const reel = part(new THREE.CylinderGeometry(.06, .06, .05, 14), flat('#9aa0a8', '#61666e'), .012); reel.rotation.z = Math.PI / 2; reel.position.set(0, .2, .08); g.add(reel);
  const foot = part(new THREE.BoxGeometry(.02, .04, .06), flat('#9aa0a8'), 0); foot.position.set(0, .2, .04); g.add(foot);
  const tipY = .12 + L;
  if (line > 0) {
    const hang = hangDown(new THREE.Group()); hang.position.y = tipY; g.add(hang);
    const ln = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, line, 4), basic('#3a2a33')); ln.position.y = -line / 2; hang.add(ln);
    if (o.bobber ?? true) {
      const top = part(new THREE.SphereGeometry(.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), flat('#d8452f', '#9a2e20'), .012); top.position.y = -line + .02; hang.add(top);
      const bot = part(new THREE.SphereGeometry(.05, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), flat('#f2ece0', '#c9c3b6'), .012); bot.position.y = -line + .02; hang.add(bot);
    }
  }
  return finish(g, { tip: [0, tipY, 0], reel: [0, .2, .08] });
}
