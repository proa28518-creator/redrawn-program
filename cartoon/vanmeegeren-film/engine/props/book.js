// props/book.js: a hardback book, closed or open (opts.open 0..1). Open, its pages face -Z (the holder) and the covers face +Z (the camera
// in front of him); the two halves make a shallow V with the spine away from the reader.
// Origin = the grip on the outer edge of the half on his RIGHT (-X), a little below the middle. Two hands: the other hand goes to
// sockets.grip2 (the outer edge of the left half), e.g. armL.hand = armR.hand + grip2 (both in body space, rot [0,0,0]).
// opts: open 1, color '#a8402f' (cover), pages '#f3ead6', w .36 (one page width), h .5, title true (a band on the front cover)
// sockets: grip, grip2, spine, pages (centre of the open spread, the reader looks here)
import { THREE, flat, basic, part, finish, canvasTex } from './_kit.js';
export const free = true;

let PAGE = null;
const pageTex = () => PAGE ||= canvasTex(128, 176, (c, W, H) => {
  c.fillStyle = '#f3ead6'; c.fillRect(0, 0, W, H); c.fillStyle = '#8a7c68';
  for (let y = 16, i = 0; y < H - 14; y += 9, i++) c.fillRect(12, y, (W - 24) * (i % 6 === 5 ? .55 : 1), 3);
});

export function build(o = {}) {
  const g = new THREE.Group(); g.name = 'prop.book';
  const open = Math.min(1, Math.max(0, o.open ?? 1)), w = o.w ?? .36, h = o.h ?? .5, t = .045;
  const alpha = (90 - (90 - 14) * open) * Math.PI / 180; // angle of each half from the spine plane: closed 90 (stacked), open 14 (shallow V)
  const cover = flat(o.color ?? '#a8402f', '#74281d'), paper = flat(o.pages ?? '#f3ead6', '#d8cdb4');
  const book = new THREE.Group(); g.add(book);
  for (const sgn of [-1, 1]) { // -1 = the half on his right (-X), +1 = his left
    const half = new THREE.Group(); book.add(half);
    half.rotation.y = sgn > 0 ? alpha : -alpha;
    const cv = part(new THREE.BoxGeometry(w, h, .014), cover, .018); cv.position.set(sgn * w / 2, 0, t - .007 + .003); half.add(cv);
    const blk = part(new THREE.BoxGeometry(w * .97, h * .96, t - .014), paper, .012); blk.position.set(sgn * w * .5, 0, (t - .014) / 2 + .003); half.add(blk);
    const pg = new THREE.Mesh(new THREE.PlaneGeometry(w * .9, h * .9), basic('#ffffff', { map: pageTex() })); pg.rotation.y = Math.PI; pg.position.set(sgn * w * .5, 0, .002); half.add(pg);
    if (sgn > 0 && (o.title ?? true)) { const band = new THREE.Mesh(new THREE.PlaneGeometry(w * .7, h * .14), basic('#f1d58a')); band.position.set(w * .5, h * .18, t + .004); half.add(band); }
  }
  const sp = part(new THREE.CylinderGeometry(.025, .025, h, 8), cover, .016); sp.position.z = .02; book.add(sp);
  // grip on the right half's outer edge, .12 h below the middle
  const edge = [-w * Math.cos(alpha), -h * .12, -w * Math.sin(alpha)];
  book.position.set(-edge[0], -edge[1], -edge[2]);
  const B = v => [v[0] - edge[0], v[1] - edge[1], v[2] - edge[2]];
  return finish(g, { grip2: B([w * Math.cos(alpha), -h * .12, -w * Math.sin(alpha)]), spine: B([0, 0, 0]), pages: B([0, 0, -w * Math.sin(alpha) * .5]) });
}
