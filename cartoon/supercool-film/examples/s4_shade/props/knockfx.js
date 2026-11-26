// films/s4/props/knockfx.js: what a knock looks like: a comic impact star + an expanding ink ring on the spot that was struck, so the audience
// SEES every knock. World prop, always faces +Z. opt `a`: 0 = the strike, 1 = gone. Keys: { t, a: 0 } then { t: t + .034, a: 1, ease: .3 }.
// opts: size (1), color
import { THREE, finish } from '../../../engine/props/_kit.js';
export const free = true;
export function build(o = {}) {
  const g = new THREE.Group(); g.name = 'prop.knockfx';
  const col = o.color ?? '#fff6da', M = () => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 1, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(.86, 1, 40), M()); ring.renderOrder = 30; g.add(ring);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 40), M()); ring2.renderOrder = 30; g.add(ring2);
  const spikes = new THREE.Group(); g.add(spikes);
  const n = 9, sm = M();
  const pos = [], idx = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + .3, b = a + .17, c = a - .17, r0 = .42, r1 = i % 2 ? 1 : .78;
    const v = pos.length / 3; pos.push(Math.cos(c) * r0, Math.sin(c) * r0, 0, Math.cos(b) * r0, Math.sin(b) * r0, 0, Math.cos(a) * r1, Math.sin(a) * r1, 0); idx.push(v, v + 1, v + 2); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setIndex(idx);
  const star = new THREE.Mesh(sg, sm); star.renderOrder = 31; spikes.add(star);
  const size = o.size ?? 1;
  const inner = new THREE.Group(); inner.add(ring, ring2, spikes); g.add(inner);   // the stage sets the prop's own visible each frame: hide the inside
  const apply = obj => { const a = Math.max(0, Math.min(1, obj.userData.a ?? 1)); const vis = a < .999; inner.visible = vis; if (!vis) return;
    const s = size * (.22 + 1.05 * Math.pow(a, .55)); ring.scale.setScalar(s); ring.material.opacity = Math.pow(1 - a, 1.3) * .95;
    const s2 = size * (.1 + .7 * Math.pow(a, .7)); ring2.scale.setScalar(s2); ring2.material.opacity = Math.pow(1 - a, 2) * .8;
    const k = a < .34 ? size * (.36 + .35 * a) : 0; spikes.visible = k > 0; if (k > 0) spikes.scale.setScalar(k); sm.opacity = 1; };
  g.userData.a = o.a ?? 1;
  g.userData.set = (key, v) => { if (key === 'a') { g.userData.a = v; apply(g); } };
  apply(g);
  return finish(g, {});
}
