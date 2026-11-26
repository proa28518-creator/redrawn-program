// props/casefile.js — THE CASE FILE + CHARGE SHEET (BIBLE.md): a buff folder with a typed
// charge sheet on top — print, never a blank slab: typed lines and the words VERMEER / VERRAAD.
// Origin at the folder's centre bottom; the sheet faces +z/up. 0.75 x 0.55 D.
import { THREE, flat, basic, part, canvasTex, finish } from '../../engine/props/_kit.js';

export function build(o = {}) {
  const g = new THREE.Group();
  const folder = part(new THREE.BoxGeometry(.75, .03, .55), flat('#c2a06a', '#97793f'), .01);
  folder.position.y = .015; g.add(folder);
  const sheetTex = canvasTex(512, 384, (x, W, H) => {
    x.fillStyle = '#efe9da'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#333a40'; x.font = '900 44px Arial'; x.textAlign = 'left';
    x.fillText('VERRAAD', 36, 66);
    x.font = '700 30px Arial'; x.fillStyle = '#5d5648';
    x.fillText('zaak: J. Vermeer — schilderij', 36, 118);
    x.strokeStyle = 'rgba(60,60,66,.65)'; x.lineWidth = 4;
    for (let i = 0; i < 6; i++) { const y = 168 + i * 32; x.beginPath(); x.moveTo(36, y); x.lineTo(36 + 380 - (i % 3) * 60, y); x.stroke(); }
    x.fillStyle = '#b03024'; x.font = '900 34px Arial'; x.fillText('1945', 392, 66);
  });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(.66, .48), basic(0xffffff, { map: sheetTex }));
  sheet.rotation.x = -Math.PI / 2; sheet.rotation.z = .04; sheet.position.y = .033; g.add(sheet);
  return finish(g);
}
