// props/vermeer.js — THE PAINTING: the forged "Vermeer", the film's second actor (BIBLE.md).
// One dedicated painted texture reused in every place and state — a woman in blue and yellow
// at a window with a letter, golden light — in an ornate gilt frame. Timed states ride on
// userData.update (no rebuilds): cover 0..1 (the dust sheet over it), crack 0..1 (craquelure
// overlay: 1 = the aged original, 0 = the fresh proof canvas), stamp 0|1 (the red VALS mark).
// Origin at the frame's bottom centre; the canvas face looks +z. Canvas 1.5 x 1.8 D, frame to 1.9 x 2.2 D.
import { THREE, flat, basic, part, canvasTex, finish } from '../../engine/props/_kit.js';

function paintingTex() {
  return canvasTex(512, 640, (x, W, H) => {
    // the room: warm umber wall, a map hanging behind, golden window light from the left
    x.fillStyle = '#6e5136'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#8a6a42'; x.fillRect(0, 0, W, 300);
    x.fillStyle = '#d9b878'; x.fillRect(26, 30, 150, 470);                    // the window's light slab
    x.fillStyle = '#f4e2ac'; x.fillRect(40, 44, 122, 442);
    x.fillStyle = '#a8874f'; x.fillRect(196, 52, 210, 150);                   // the wall map
    x.fillStyle = '#c8ab72'; x.fillRect(208, 64, 186, 126);
    x.strokeStyle = '#7d5f36'; x.lineWidth = 4; x.beginPath();
    x.moveTo(208, 128); x.bezierCurveTo(280, 92, 330, 160, 394, 118); x.stroke();
    // the table with its carpet, lower right
    x.fillStyle = '#7d2f26'; x.fillRect(150, 470, 362, 170);
    x.fillStyle = '#a03c2c'; x.fillRect(150, 470, 362, 34);
    x.fillStyle = '#e8ddc2'; x.fillRect(330, 500, 92, 62);                    // the letter on the table
    // the woman: blue dress, yellow bodice light, white cap, reading — flat shapes, Vermeer's blocks
    x.fillStyle = '#274b8f'; x.beginPath();                                  // skirt
    x.moveTo(238, 640); x.lineTo(268, 400); x.lineTo(352, 400); x.lineTo(392, 640); x.closePath(); x.fill();
    x.fillStyle = '#2f5aa8'; x.fillRect(262, 330, 96, 84);                    // bodice
    x.fillStyle = '#e8c33c'; x.fillRect(262, 330, 96, 26);                    // the yellow band of light
    x.fillStyle = '#e9d9b8'; x.beginPath(); x.arc(310, 292, 34, 0, 7); x.fill();   // face in profile light
    x.fillStyle = '#f4eedd'; x.beginPath(); x.arc(302, 262, 36, 0, 7); x.fill();   // the white cap
    x.fillStyle = '#274b8f'; x.fillRect(288, 246, 62, 16);
    x.strokeStyle = '#e9d9b8'; x.lineWidth = 17; x.beginPath();               // her arm to the letter
    x.moveTo(300, 356); x.quadraticCurveTo(348, 420, 372, 492); x.stroke();
    x.fillStyle = '#f7efdb'; x.save(); x.translate(382, 512); x.rotate(-.16); x.fillRect(-26, -34, 52, 68); x.restore(); // the letter in her hand
    // the golden glow over everything
    const gr = x.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, 'rgba(255,214,120,.20)'); gr.addColorStop(.6, 'rgba(120,70,20,.05)'); gr.addColorStop(1, 'rgba(30,16,4,.34)');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
  });
}
function crackTex() {
  return canvasTex(512, 640, (x, W, H) => {
    x.clearRect(0, 0, W, H);
    x.strokeStyle = 'rgba(38,24,12,.34)'; x.lineWidth = 1.1;
    let s = 987654; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < 60; i++) {                                            // craquelure web
      let px = rnd() * W, py = rnd() * H; x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 4; k++) { px += (rnd() - .5) * 90; py += (rnd() - .5) * 90; x.lineTo(px, py); }
      x.stroke();
    }
    x.fillStyle = 'rgba(52,34,16,.08)';
    for (let i = 0; i < 26; i++) x.fillRect(rnd() * W, rnd() * H, 20 + rnd() * 60, 8 + rnd() * 22);  // age blotches
  });
}

export function build(o = {}) {
  const g = new THREE.Group();
  const frame = part(new THREE.BoxGeometry(1.9, 2.2, .09), flat('#a87c2c', '#77571d'), .03);
  frame.position.y = 1.1; g.add(frame);
  const inner = part(new THREE.BoxGeometry(1.62, 1.92, .1), flat('#5d4517', '#3f2f0e'), .015);
  inner.position.y = 1.1; g.add(inner);
  const cv = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.8), basic(0xffffff, { map: paintingTex() }));
  cv.position.set(0, 1.1, .056); g.add(cv);
  const crack = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.8),
    new THREE.MeshBasicMaterial({ map: crackTex(), transparent: true, opacity: .32, depthWrite: false }));
  crack.position.set(0, 1.1, .062); g.add(crack);
  // the red VALS stamp across the canvas corner (state: stamp)
  const stampTex = canvasTex(256, 128, (x, W, H) => {
    x.clearRect(0, 0, W, H); x.strokeStyle = '#b03024'; x.lineWidth = 7; x.strokeRect(8, 8, W - 16, H - 16);
    x.fillStyle = '#b03024'; x.font = '900 62px Arial'; x.textAlign = 'center'; x.fillText('VALS', W / 2, H / 2 + 24);
  });
  const stamp = new THREE.Mesh(new THREE.PlaneGeometry(.78, .39),
    new THREE.MeshBasicMaterial({ map: stampTex, transparent: true, depthWrite: false }));
  stamp.position.set(.3, .62, .07); stamp.rotation.z = -.22; stamp.visible = false; g.add(stamp);
  // the dust sheet (state: cover): a cloth slab hanging over the whole frame from its top
  const sheet = part(new THREE.BoxGeometry(1.78, 2.08, .05), flat('#a2987f', '#7d7460'), .02);
  sheet.position.set(0, 1.12, .1); g.add(sheet);
  const fold = part(new THREE.BoxGeometry(1.78, .16, .09), flat('#b0a68d', '#8a8069'), .015);
  fold.position.set(0, 2.24, .1); g.add(fold);
  g.userData.update = (obj, q) => {
    const cover = q.cover != null ? q.cover : 1;
    sheet.visible = fold.visible = cover > .02;
    sheet.scale.y = Math.max(cover, .0001);
    sheet.position.y = 2.22 - (2.08 * cover) / 2;
    fold.position.y = 2.22 - 2.08 * cover + .08;
    crack.material.opacity = .32 * (q.crack != null ? q.crack : 1);
    stamp.visible = !!q.stamp;
  };
  g.userData.update(g, o);
  return finish(g);
}
