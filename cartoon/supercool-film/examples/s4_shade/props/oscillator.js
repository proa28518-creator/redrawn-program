// films/s4/props/oscillator.js: the signal set on the rescue ship's deck: a heavy box on a stand with a brass key and a dial. Origin = on the
// deck under the middle of the box; the key's top is at [0, 1.42, .1].
import { THREE, flat, basic, part, finish } from '../../../engine/props/_kit.js';
export const free = true;
export function build(o = {}) {
  const g = new THREE.Group(); g.name = 'prop.oscillator';
  const D = flat('#3f4a44', '#262e2a'), B = flat('#d0a544', '#8a6a24'), W = flat('#5a4630', '#3b2d1e');
  const st = part(new THREE.BoxGeometry(.8, 1.05, .6), W, .018); st.position.y = .525; g.add(st);
  const bx = part(new THREE.BoxGeometry(.92, .3, .7), D, .018); bx.position.y = 1.2; g.add(bx);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(.09, 18), basic('#e8e0c6')); dial.position.set(-.26, 1.2, .352); g.add(dial);
  const lever = part(new THREE.BoxGeometry(.3, .03, .06), B, .01); lever.position.set(.02, 1.38, .1); g.add(lever);
  const knob = part(new THREE.CylinderGeometry(.045, .045, .03, 12), flat('#20242a', '#101216'), .008); knob.position.set(.16, 1.41, .1); g.add(knob);
  return finish(g, { key: [0.16, 1.42, .1] });
}
