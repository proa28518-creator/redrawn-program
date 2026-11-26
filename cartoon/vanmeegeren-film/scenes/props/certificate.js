// props/certificate.js — THE CERTIFICATE + STAMP (BIBLE.md): the experts' authenticity sheet.
// State via userData.update: stamp 0 = clean, 1 = the red ECHT stamp (line 16), 2 = the same
// sheet re-marked VALS (line 30). Origin at the sheet's centre bottom; print faces up/+z.
import { THREE, flat, basic, part, canvasTex, finish } from '../../engine/props/_kit.js';

function stampPlane(word) {
  const tex = canvasTex(256, 128, (x, W, H) => {
    x.clearRect(0, 0, W, H); x.strokeStyle = '#28418c'; x.lineWidth = 7; x.strokeRect(8, 8, W - 16, H - 16);
    x.fillStyle = '#28418c'; x.font = '900 58px Arial'; x.textAlign = 'center'; x.fillText(word, W / 2, H / 2 + 22);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(.4, .2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = -.18; m.position.set(.06, .045, .02); m.visible = false;
  return m;
}

export function build(o = {}) {
  const g = new THREE.Group();
  const sheetTex = canvasTex(512, 384, (x, W, H) => {
    x.fillStyle = '#f2eddd'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#8a7a4a'; x.lineWidth = 5; x.strokeRect(14, 14, W - 28, H - 28);
    x.fillStyle = '#33302a'; x.font = '900 36px Arial'; x.textAlign = 'center';
    x.fillText('CERTIFICAAT', W / 2, 72);
    x.font = '700 26px Arial'; x.fillStyle = '#5d5648';
    x.fillText('J. Vermeer — authentiek werk', W / 2, 122);
    x.strokeStyle = 'rgba(60,60,66,.6)'; x.lineWidth = 4;
    for (let i = 0; i < 4; i++) { const y = 172 + i * 34; x.beginPath(); x.moveTo(70, y); x.lineTo(W - 70 - (i % 2) * 70, y); x.stroke(); }
    x.font = 'italic 700 28px Georgia'; x.fillStyle = '#3a3630'; x.fillText('A. Bredius', W - 130, H - 42);
  });
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(.7, .015, .5), flat('#e8e2cd', '#c4bda2'));
  sheet.position.y = .008; g.add(sheet);
  const print = new THREE.Mesh(new THREE.PlaneGeometry(.68, .48), basic(0xffffff, { map: sheetTex }));
  print.rotation.x = -Math.PI / 2; print.position.y = .017; g.add(print);
  const echt = stampPlane('ECHT'); g.add(echt);
  const valsTex = canvasTex(256, 128, (x, W, H) => {
    x.clearRect(0, 0, W, H); x.strokeStyle = '#b03024'; x.lineWidth = 7; x.strokeRect(8, 8, W - 16, H - 16);
    x.fillStyle = '#b03024'; x.font = '900 58px Arial'; x.textAlign = 'center'; x.fillText('VALS', W / 2, H / 2 + 22);
  });
  const vals = new THREE.Mesh(new THREE.PlaneGeometry(.44, .22),
    new THREE.MeshBasicMaterial({ map: valsTex, transparent: true, depthWrite: false }));
  vals.rotation.x = -Math.PI / 2; vals.rotation.z = .14; vals.position.set(-.04, .046, -.02); vals.visible = false; g.add(vals);
  g.userData.update = (obj, q) => {
    const s = q.stamp || 0;
    echt.visible = s === 1; vals.visible = s === 2;
  };
  g.userData.update(g, o);
  return finish(g);
}
