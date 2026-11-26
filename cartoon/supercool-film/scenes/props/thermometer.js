// props/thermometer.js — THE THERMOMETER: a dial thermometer he holds against the bottle.
// The science made visible (BIBLE.md): the needle is a timed state — it sinks below 0 while
// the water is supercooled (line 11), holds there (line 16), and SNAPS back to exactly 0 on
// line 27 (recalescence: freezing throws heat out). Opt: needle -1..1 (-1 = -20 C stop,
// 0 = exactly 0 C at the top, red). Origin at the base of the stem (the grip / standing foot);
// the dial face looks +z, so a hero facing the camera shows the reading to the camera.
// userData.update(obj, opts) is called by the stage with the merged opts at t: no rebuilds.
import { THREE, flat, part, canvasTex } from '../../engine/props/_kit.js';

export function build(o = {}) {
  const g = new THREE.Group();
  // the little standing base + stem (origin at the base's foot)
  const base = part(new THREE.CylinderGeometry(.052, .058, .016, 18), flat('#8b959c', '#5f686e'), .008);
  base.position.y = .008; g.add(base);
  const stem = part(new THREE.CylinderGeometry(.011, .011, .1, 10), flat('#c8ced2', '#969ea4'), .006);
  stem.position.y = .066; g.add(stem);
  // the dial: rim + printed face + needle, face toward +z
  const dial = new THREE.Group(); dial.position.y = .185; g.add(dial);
  const rim = part(new THREE.CylinderGeometry(.082, .082, .026, 26), flat('#d8dde2', '#9aa4ac'), .01);
  rim.rotation.x = Math.PI / 2; dial.add(rim);
  const faceTex = canvasTex(256, 256, (x, W, H) => {
    const c = W / 2;
    x.fillStyle = '#f7f3e8'; x.beginPath(); x.arc(c, c, 126, 0, 7); x.fill();
    // scale arc: needle angle theta (rad, 0 = up, + = CCW = cold side) from +2.35 (-20 C) to -2.35 (+40 C)
    for (let i = 0; i <= 12; i++) {
      const th = 2.35 - i * (4.7 / 12), big = i % 3 === 0;
      const [x1, y1] = [c - Math.sin(th) * (big ? 88 : 98), c - Math.cos(th) * (big ? 88 : 98)];
      const [x2, y2] = [c - Math.sin(th) * 112, c - Math.cos(th) * 112];
      x.strokeStyle = '#333a40'; x.lineWidth = big ? 6 : 3;
      x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke();
    }
    x.fillStyle = '#333a40'; x.font = '900 30px Arial'; x.textAlign = 'center';
    x.fillText('-20', c - Math.sin(2.35) * 66, c - Math.cos(2.35) * 66 + 10);
    x.fillText('+40', c - Math.sin(-2.35) * 66, c - Math.cos(-2.35) * 66 + 10);
    x.fillStyle = '#c22e2e'; x.font = '900 40px Arial';
    x.fillText('0', c, c - 62);
    x.strokeStyle = '#c22e2e'; x.lineWidth = 7;
    x.beginPath(); x.moveTo(c, c - 84); x.lineTo(c, c - 114); x.stroke();
    x.fillStyle = '#7a7264'; x.font = '700 24px Arial';
    x.fillText('°C', c, c + 74);
  });
  const face = new THREE.Mesh(new THREE.CircleGeometry(.076, 26), new THREE.MeshBasicMaterial({ map: faceTex }));
  face.position.z = .0145; dial.add(face);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(.007, .062, .004), new THREE.MeshBasicMaterial({ color: 0xc22e2e }));
  needle.geometry.translate(0, .024, 0);
  needle.position.z = .019; dial.add(needle);
  const hub = part(new THREE.CylinderGeometry(.011, .011, .008, 12), flat('#333a40', '#1e2226'), .004);
  hub.rotation.x = Math.PI / 2; hub.position.z = .02; dial.add(hub);
  g.userData.update = (obj, q) => {
    const v = Math.max(-1, Math.min(1, q.needle || 0));
    needle.rotation.z = -v * 2.2;   // needle -0.72 -> deep in the blue zone left of the red 0; 0 -> exactly on 0
  };
  g.userData.update(g, { needle: -0.15 });
  return g;
}
