// props/microscope.js — THE MICROSCOPE (BIBLE.md): brass-and-black 1940s bench microscope,
// ~0.85 D high. Origin at the base's foot; the stage faces +z.
import { THREE, flat, part, finish } from '../../engine/props/_kit.js';

export function build(o = {}) {
  const g = new THREE.Group();
  const base = part(new THREE.BoxGeometry(.3, .05, .22), flat('#2c2c30', '#17171a'), .01);
  base.position.y = .025; g.add(base);
  const stage = part(new THREE.BoxGeometry(.26, .03, .2), flat('#3a3a40', '#222226'), .008);
  stage.position.set(0, .3, .02); g.add(stage);
  const slide = part(new THREE.BoxGeometry(.16, .012, .07), flat('#d9e4e8', '#a9bcc2'), .004);
  slide.position.set(0, .322, .02); g.add(slide);
  const flake = part(new THREE.BoxGeometry(.05, .014, .04), flat('#c8922e', '#8f6414'), .003);
  flake.position.set(0, .332, .02); g.add(flake);
  const arm = part(new THREE.BoxGeometry(.05, .5, .05), flat('#2c2c30', '#17171a'), .008);
  arm.position.set(0, .32, -.09); g.add(arm);
  const tube = part(new THREE.CylinderGeometry(.035, .04, .34, 12), flat('#8a6f34', '#5f4c20'), .008);
  tube.position.set(0, .52, -.02); tube.rotation.x = .18; g.add(tube);
  const eye = part(new THREE.CylinderGeometry(.042, .042, .05, 12), flat('#2c2c30', '#17171a'), .006);
  eye.position.set(0, .7, -.05); eye.rotation.x = .18; g.add(eye);
  const lens = part(new THREE.CylinderGeometry(.02, .026, .07, 10), flat('#c8b06a', '#97803f'), .005);
  lens.position.set(0, .37, .005); g.add(lens);
  const mirror = part(new THREE.CylinderGeometry(.05, .05, .012, 14), flat('#dfe7ea', '#aebac0'), .004);
  mirror.rotation.x = Math.PI / 3; mirror.position.set(0, .14, .03); g.add(mirror);
  return finish(g);
}
