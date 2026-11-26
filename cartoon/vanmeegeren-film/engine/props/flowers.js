// props/flowers.js: a bouquet (paper cone wrap, green stems and leaves, round flower heads with a contrasting centre). Origin = the grip
// (the narrow waist of the wrap); flowers go up +Y. Seeded: the same seed gives the same bouquet.
// opts: n 7, colors ['#e8705a', '#f2c14e', '#e88fb4', '#f4f1ea'], wrap '#e9d8b4', seed 3
// sockets: grip, heads (centre of the flower heads: hold it out toward someone)
import { THREE, flat, part, finish, rng } from './_kit.js';
export const free = true;

export function build(o = {}) {
  const g = new THREE.Group(); g.name = 'prop.flowers';
  const n = o.n ?? 7, cols = o.colors ?? ['#e8705a', '#f2c14e', '#e88fb4', '#f4f1ea'], R = rng(o.seed ?? 3);
  const wrapM = flat(o.wrap ?? '#e9d8b4', '#b9a47c', { double: true });
  const wrap = part(new THREE.CylinderGeometry(.2, .035, .55, 12, 1, true), wrapM, .018); wrap.position.y = .12; g.add(wrap);
  const tie = part(new THREE.TorusGeometry(.05, .016, 6, 12), flat('#c8433a', '#8e2c24'), .01); tie.rotation.x = Math.PI / 2; tie.position.y = .02; g.add(tie);
  const stemM = flat('#5a9a4a', '#3a6a30'), leafM = flat('#6fb35a', '#457a38');
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + R() * .5, rr = i === 0 ? 0 : .07 + R() * .07, top = .55 + R() * .18 + (i === 0 ? .08 : 0);
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, top, 5), stemM); stem.position.set(x * .5, top / 2, z * .5); stem.lookAt(x, top, z); stem.rotateX(Math.PI / 2); g.add(stem);
    const c = cols[i % cols.length], head = new THREE.Group(); head.position.set(x, top, z); g.add(head);
    const petals = part(new THREE.SphereGeometry(.085, 12, 8), flat(c, new THREE.Color(c).multiplyScalar(.72).getStyle()), .016); petals.scale.set(1, .55, 1); head.add(petals);
    const mid = part(new THREE.SphereGeometry(.035, 8, 6), flat(c === '#f2c14e' ? '#c8433a' : '#f2c14e', undefined), .01); mid.position.y = .04; head.add(mid);
    head.rotation.set((z) * 2.2, 0, -(x) * 2.2);
    if (i % 2 === 0) { const leaf = part(new THREE.SphereGeometry(.07, 8, 6), leafM, .012); leaf.scale.set(.35, 1, .12); leaf.position.set(x * 1.6, .42, z * 1.6); leaf.rotation.z = -x * 4; leaf.rotation.x = z * 4; g.add(leaf); }
  }
  return finish(g, { heads: [0, .66, 0] });
}
