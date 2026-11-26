// props/bottle_ice.js — THE BOTTLE: a clear water bottle whose freeze state is data.
// The second actor of the film (BIBLE.md): the same prop in every beat, driven by three
// opts keys over time (film.js props keys): front 0..1 — the white ice front racing up the
// water from the base; frost 0..1 — frost creeping over the glass top to bottom; white 0..1 —
// the water going slush-white. Geometry mirrors engine/props/bottle.js (origin at the grip,
// the body middle; h .38 body + neck) so hands, sockets and put_down heights match the built-in.
// userData.update(obj, opts) is called by the stage with the merged opts at t: no rebuilds.
import { THREE, flat, basic, part, finish, canvasTex } from '../../engine/props/_kit.js';

export function build(o = {}) {
  const h = o.h || .38, r = .085, g = new THREE.Group();
  const waterMat = flat(o.water || '#6fb7d9', '#3f87ab');
  const labelTex = canvasTex(256, 128, (x, W, H) => {
    x.fillStyle = '#f4ecd8'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#2e6ea8'; x.fillRect(0, 14, W, 34);
    x.fillStyle = '#ffffff'; x.font = '900 26px Arial'; x.textAlign = 'center'; x.fillText('PURE WATER', W / 2, 41);
    x.strokeStyle = '#2e6ea8'; x.lineWidth = 4; x.beginPath();
    for (let i = 0; i <= W; i += 8) x.lineTo(i, 78 + Math.sin(i / 18) * 7); x.stroke();
    x.fillStyle = '#7a6a4d'; x.font = '700 15px Arial'; x.fillText('still · 500 ml', W / 2, 112);
  });
  // the water first (inside), then the glass over it
  const water = part(new THREE.CylinderGeometry(r * .86, r * .86, h * .94, 18), waterMat, .012);
  water.position.y = -h * .01; g.add(water);
  const body = part(new THREE.LatheGeometry([[0, -h / 2], [.052, -h / 2], [r, -h / 2 + .035], [r, h / 2 - .045], [.078, h / 2], [.036, h / 2 + .075], [.034, h / 2 + .155], [.038, h / 2 + .165], [.038, h / 2 + .235], [0, h / 2 + .235]].map(p => new THREE.Vector2(p[0], p[1])), 22), flat(o.color || '#dceef2', '#a8c8d4'), .02);
  g.add(body);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.015, r * 1.015, h * .44, 20, 1, true), new THREE.MeshBasicMaterial({ map: labelTex }));
  label.position.y = -h * .05; label.rotation.y = Math.PI; g.add(label);   // the printed side faces +z (the camera)
  const cap = part(new THREE.CylinderGeometry(.041, .041, .05, 14), flat(o.cap || '#7fb2d9', '#5d8cb3'), .012);
  cap.position.y = h / 2 + .235 + .02; g.add(cap);
  // the ice front: a white column growing from the base (geometry origin at its bottom)
  const frontGeo = new THREE.CylinderGeometry(r * .88, r * .88, 1, 18); frontGeo.translate(0, .5, 0);
  const front = new THREE.Mesh(frontGeo, flat('#f2f9ff', '#cfe4f2'));
  front.position.y = -h / 2 + .012; front.scale.y = .0001; front.visible = false; g.add(front);
  // the frost: a shell growing DOWN from the top (geometry origin at its top)
  const frostGeo = new THREE.CylinderGeometry(r * 1.04, r * 1.04, 1, 18, 1, true); frostGeo.translate(0, -.5, 0);
  const frost = new THREE.Mesh(frostGeo, flat('#eef7fc', '#d4e6f0'));
  frost.position.y = h / 2 - .01; frost.scale.y = .0001; frost.visible = false; g.add(frost);
  g.userData.update = (obj, q) => {
    const f = Math.max(0, Math.min(1, q.front || 0)), fr = Math.max(0, Math.min(1, q.frost || 0)), w = Math.max(0, Math.min(1, q.white || 0));
    front.visible = f > .003; front.scale.y = Math.max(f * h * .94, .0001);
    frost.visible = fr > .003; frost.scale.y = Math.max(fr * h * .98, .0001);
    waterMat.uniforms.cLit.value.set('#6fb7d9').lerp(new THREE.Color('#e8f4fa'), w);
    waterMat.uniforms.cDark.value.set('#3f87ab').lerp(new THREE.Color('#b9d6e4'), w);
  };
  return finish(g, { mouth: [0, h / 2 + .26, 0], base: [0, -h / 2, 0] });
}
