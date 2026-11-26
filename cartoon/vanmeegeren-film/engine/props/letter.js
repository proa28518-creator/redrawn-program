// props/letter.js: an envelope. Front (+Z): address lines and a red stamp; back (-Z): the pointed flap with a wax seal. Origin = the grip at
// the short edge on the holding hand's side (his right end for hand:R, mirrored for hand:L), so the envelope sticks out of the fist.
// opts: paper '#f1e6cc', stamp '#c8433a', seal '#a8302a', w .5, h .32, side 'R'|'L'
// sockets: grip, centre
import { THREE, flat, basic, part, finish, canvasTex, sideOf } from './_kit.js';
export const free = true;

export function build(o = {}) {
  const g = new THREE.Group(); g.name = 'prop.letter';
  const s = sideOf(o) === 'L' ? -1 : 1, W = o.w ?? .5, H = o.h ?? .32, paper = o.paper ?? '#f1e6cc';
  const front = canvasTex(256, 164, (c, w, h) => {
    c.fillStyle = paper; c.fillRect(0, 0, w, h); c.fillStyle = '#6a5a48';
    [[.36, .5, .4], [.36, .62, .34], [.36, .74, .26]].forEach(([x, y, l]) => c.fillRect(w * x, h * y, w * l, h * .045));
    c.fillStyle = o.stamp ?? '#c8433a'; c.fillRect(w * .76, h * .1, w * .15, h * .26); c.strokeStyle = '#f1e6cc'; c.lineWidth = 3; c.strokeRect(w * .78, h * .13, w * .11, h * .2);
  });
  const back = canvasTex(256, 164, (c, w, h) => {
    c.fillStyle = paper; c.fillRect(0, 0, w, h); c.strokeStyle = '#a8977a'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, 2); c.lineTo(w / 2, h * .58); c.lineTo(w, 2); c.moveTo(0, h); c.lineTo(w * .42, h * .5); c.moveTo(w, h); c.lineTo(w * .58, h * .5); c.stroke();
    c.fillStyle = o.seal ?? '#a8302a'; c.beginPath(); c.arc(w / 2, h * .58, h * .09, 0, 7); c.fill();
  });
  const edge = flat(paper, '#c9bc9c');
  const env = new THREE.Mesh(new THREE.BoxGeometry(W, H, .012), [edge, edge, edge, edge, basic('#ffffff', { map: front }), basic('#ffffff', { map: back })]);
  outline(env); env.position.x = s * (W / 2 - .05); g.add(env);
  return finish(g, { centre: [env.position.x, 0, 0] });
}
import { outline as inkLine } from '../shade.js';
function outline(m) { inkLine(m, { width: .014, color: 0x3a2a33 }); }
