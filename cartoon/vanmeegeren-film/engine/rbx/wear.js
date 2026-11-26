// engine/rbx/wear.js (Roblox V3, WP-C2): clothes on the R15 body (engine/rbx/body.js, WP-C1).
//   wearColours(spec) -> the `colours` buildBody() takes: { skin, torso, arms, forearms, hands, legs, shins, shoes, pants }
//   wearDetails(spec, L, material) -> [{ part: 'torsoU' | 'torsoL', mesh }]: meshes in that part's own frame (hem space, the body's
//   layout L in studs, front +z), to be added as children of the part (they ride its matrix): the painted front (a canvas texture on
//   a thin panel that follows the torso front), hood, collar, skirt. At most one busy pattern per character.
// Tops: tank tshirt shirt suit hoodie print_hoodie jacket varsity plaid labcoat police cardigan overalls dress sweater.
import * as THREE from '../three.js';
import { roundedBox } from './hair.js';

const STUD = 3.0 / 5.2;
const SLEEVES = { tank: 'none', dress: 'none', overalls: 'short', tshirt: 'short', print_hoodie: 'long', hoodie: 'long', suit: 'long', shirt: 'long',
  jacket: 'long', varsity: 'long', plaid: 'long', labcoat: 'long', police: 'short', cardigan: 'long', sweater: 'long' };

export function wearColours(spec = {}) {
  const w = spec.wear || {}, skin = spec.skin || '#e0b98f', top = w.topColor || '#3a6fd8', sleeve = w.sleeveColor || top;
  const kind = SLEEVES[w.top] || 'short';
  const pants = w.pants || '#1d1d24', shoes = w.shoes || '#1b1b20';
  const legsShort = w.pantsKind === 'shorts' || w.pantsKind === 'skirt' || w.top === 'dress';
  const overalls = w.top === 'overalls';
  return {
    skin, hands: skin,
    torso: overalls ? (w.shirtColor || '#f2f2f2') : top,
    arms: kind === 'none' ? skin : sleeve,
    forearms: kind === 'long' ? sleeve : skin,
    pants: w.top === 'dress' ? top : overalls ? top : pants,
    legs: w.top === 'dress' ? top : overalls ? top : pants,
    shins: legsShort ? skin : overalls ? top : pants,
    shoes,
  };
}

// ---------- the painted front ----------
function canvasTex(draw, W = 512, H = 512) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.clearRect(0, 0, W, H); draw(g, W, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; return t;
}
const shade = (hex, d) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, d); return '#' + c.getHexString(); };
const INK = '#1c1c22';
function star(g, x, y, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); } g.closePath(); g.fill(); }

// front of the upper torso: x 0..W across the chest, y 0 (neck) .. H (waist). Transparent = the part's own colour shows.
function frontPainter(spec) {
  const w = spec.wear || {}, top = w.topColor || '#3a6fd8', acc = w.accent || '#ffffff', shirt = w.shirtColor || '#f4f4f4', skin = spec.skin || '#e0b98f';
  return (g, W, H) => {
    const kind = w.top;
    const neck = (col, depth = .12, wid = .22) => { g.fillStyle = col; g.beginPath(); g.ellipse(W / 2, 0, W * wid, H * depth, 0, 0, Math.PI); g.fill(); };
    const hem = (col) => { g.fillStyle = col; g.fillRect(0, H * .94, W, H * .06); };
    if (kind === 'tank') { neck(skin, .2, .2); g.fillStyle = shade(top, -.08); g.fillRect(0, H * .95, W, H * .05); }
    else if (kind === 'tshirt' || kind === 'sweater') { neck(skin, .1, .18); g.strokeStyle = shade(top, -.12); g.lineWidth = 14; g.beginPath(); g.ellipse(W / 2, 0, W * .19, H * .11, 0, 0, Math.PI); g.stroke(); hem(shade(top, -.1)); if (kind === 'sweater') { g.fillStyle = acc; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(W * (.05 + i * .1), H * .45); g.lineTo(W * (.1 + i * .1), H * .38); g.lineTo(W * (.15 + i * .1), H * .45); g.lineTo(W * (.1 + i * .1), H * .52); g.fill(); } } }
    else if (kind === 'suit' || kind === 'labcoat' || kind === 'cardigan') {
      // shirt V, lapels, tie, buttons
      g.fillStyle = shirt; g.beginPath(); g.moveTo(W * .3, 0); g.lineTo(W * .7, 0); g.lineTo(W * .5, H * (kind === 'cardigan' ? .55 : .6)); g.closePath(); g.fill();
      if (kind === 'suit') { g.fillStyle = w.accent || '#c0202a'; g.beginPath(); g.moveTo(W * .46, H * .06); g.lineTo(W * .54, H * .06); g.lineTo(W * .56, H * .48); g.lineTo(W * .5, H * .56); g.lineTo(W * .44, H * .48); g.closePath(); g.fill(); g.fillStyle = shade(w.accent || '#c0202a', -.12); g.fillRect(W * .455, H * .05, W * .09, H * .05); }
      g.fillStyle = shade(top, kind === 'labcoat' ? -.1 : -.07); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(W / 2 + s * W * .2, 0); g.lineTo(W / 2 + s * W * .03, H * .6); g.lineTo(W / 2 + s * W * .1, H * .62); g.lineTo(W / 2 + s * W * .32, H * .1); g.closePath(); g.fill(); }
      g.fillStyle = kind === 'cardigan' ? shade(top, -.25) : INK; for (const y of [.68, .8]) { g.beginPath(); g.arc(W * .5, H * y, 10, 0, 7); g.fill(); }
      if (kind === 'labcoat') { g.fillStyle = shade(top, -.08); g.fillRect(W * .66, H * .3, W * .18, H * .12); g.fillStyle = '#3a70d0'; g.fillRect(W * .7, H * .27, 6, H * .1); }
      if (kind === 'suit') { g.fillStyle = '#ffffff'; g.fillRect(W * .7, H * .26, W * .1, H * .03); }
    }
    else if (kind === 'hoodie' || kind === 'print_hoodie') {
      neck(shade(top, -.18), .1, .2);
      g.strokeStyle = acc === top ? '#f2f2f2' : '#f2f2f2'; g.lineWidth = 9; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(W / 2 + s * W * .07, H * .06); g.lineTo(W / 2 + s * W * .08, H * .32); g.stroke(); g.fillStyle = '#f2f2f2'; g.beginPath(); g.arc(W / 2 + s * W * .08, H * .33, 9, 0, 7); g.fill(); }
      g.fillStyle = shade(top, -.08); g.beginPath(); g.moveTo(W * .25, H * .62); g.lineTo(W * .75, H * .62); g.lineTo(W * .8, H * .9); g.lineTo(W * .2, H * .9); g.closePath(); g.fill();
      if (w.print === 'bolt') { g.fillStyle = w.accent || '#ffd21a'; g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.moveTo(W * .56, H * .22); g.lineTo(W * .4, H * .47); g.lineTo(W * .5, H * .47); g.lineTo(W * .43, H * .62); g.lineTo(W * .62, H * .38); g.lineTo(W * .52, H * .38); g.closePath(); g.fill(); g.stroke(); }
      if (kind === 'print_hoodie' || w.print === 'text') { g.fillStyle = w.accent || '#ffffff'; g.font = `900 ${H * .1}px Arial Black, Arial, sans-serif`; g.textAlign = 'center'; const t = (w.printText || 'LOL').toUpperCase(); for (let r = 0; r < 4; r++) g.fillText(Array(4).fill(t).join(' '), W / 2 + (r % 2) * W * .1, H * (.42 + r * .12)); }
      hem(shade(top, -.12));
    }
    else if (kind === 'jacket' || kind === 'varsity') {
      g.fillStyle = shade(top, -.1); g.fillRect(W * .485, 0, W * .03, H); neck(w.shirtColor || '#f2f2f2', .1, .16);
      if (kind === 'varsity') { g.fillStyle = w.accent || '#ffffff'; g.font = `900 ${H * .26}px Georgia, serif`; g.textAlign = 'center'; g.fillText((w.printText || 'R').slice(0, 1), W * .3, H * .5); g.fillStyle = w.sleeveColor || '#ffffff'; g.fillRect(0, H * .93, W, H * .07); for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(W * .56, H * (.25 + i * .18), 9, 0, 7); g.fill(); } }
      else { g.fillStyle = shade(top, -.12); for (const s of [-1, 1]) g.fillRect(W / 2 + s * W * .22 - W * .08, H * .55, W * .16, H * .05); }
    }
    else if (kind === 'plaid') {
      g.globalAlpha = .55; g.fillStyle = w.accent || shade(top, -.25); for (let i = 0; i < 8; i++) { g.fillRect(i * W / 8, 0, W / 22, H); g.fillRect(0, i * H / 8, W, H / 22); } g.globalAlpha = .3; g.fillStyle = '#ffffff'; for (let i = 0; i < 8; i++) { g.fillRect(i * W / 8 + W / 14, 0, 4, H); g.fillRect(0, i * H / 8 + H / 14, W, 4); } g.globalAlpha = 1;
      g.fillStyle = shade(top, -.2); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(W / 2, H * .14); g.lineTo(W / 2 + s * W * .2, 0); g.lineTo(W / 2 + s * W * .06, 0); g.closePath(); g.fill(); }
      g.fillStyle = INK; for (const y of [.3, .48, .66, .84]) { g.beginPath(); g.arc(W / 2, H * y, 7, 0, 7); g.fill(); }
    }
    else if (kind === 'police') {
      g.fillStyle = shade(top, -.1); for (const s of [-1, 1]) g.fillRect(W / 2 + s * W * .24 - W * .1, H * .22, W * .2, H * .14);
      g.fillStyle = '#e8c040'; g.strokeStyle = INK; g.lineWidth = 5; star(g, W * .27, H * .16, W * .06); g.stroke();
      g.fillStyle = INK; for (const y of [.3, .5, .7]) { g.beginPath(); g.arc(W / 2, H * y, 8, 0, 7); g.fill(); }
      g.fillStyle = '#15151a'; g.fillRect(0, H * .9, W, H * .1); g.fillStyle = '#c9c9c9'; g.fillRect(W * .44, H * .9, W * .12, H * .1);
      neck(shade(top, -.15), .08, .17); g.fillStyle = '#15151a'; g.fillRect(W * .47, H * .02, W * .06, H * .2);
    }
    else if (kind === 'overalls') {
      g.fillStyle = top; g.fillRect(W * .22, H * .35, W * .56, H * .65); for (const s of [-1, 1]) g.fillRect(W / 2 + s * W * .2 - W * .05, 0, W * .1, H * .4);
      g.fillStyle = '#e8c040'; for (const s of [-1, 1]) { g.beginPath(); g.arc(W / 2 + s * W * .2, H * .38, 11, 0, 7); g.fill(); }
      g.fillStyle = shade(top, -.1); g.fillRect(W * .38, H * .5, W * .24, H * .16);
    }
    else if (kind === 'dress') { neck(skin, .14, .2); g.fillStyle = w.accent || shade(top, -.15); g.fillRect(0, H * .8, W, H * .07); }
    else if (kind === 'shirt') { g.fillStyle = shade(top, -.08); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(W / 2, H * .14); g.lineTo(W / 2 + s * W * .2, 0); g.lineTo(W / 2 + s * W * .06, 0); g.closePath(); g.fill(); } g.fillStyle = INK; for (const y of [.3, .48, .66, .84]) { g.beginPath(); g.arc(W / 2, H * y, 6, 0, 7); g.fill(); } }
    // patterns (stars / ribbons) over the top colour
    if (w.print === 'stars') { g.fillStyle = w.accent || '#ffffff'; for (let i = 0; i < 9; i++) star(g, W * ((i * .37) % 1 * .8 + .1), H * (.25 + ((i * .61) % 1) * .65), W * .045); }
    if (w.print === 'ribbons') { g.fillStyle = w.accent || '#ffffff'; for (const x of [.3, .7]) { g.beginPath(); g.moveTo(W * x, H * .2); g.lineTo(W * (x - .08), H * .12); g.lineTo(W * (x - .08), H * .28); g.closePath(); g.fill(); g.beginPath(); g.moveTo(W * x, H * .2); g.lineTo(W * (x + .08), H * .12); g.lineTo(W * (x + .08), H * .28); g.closePath(); g.fill(); g.beginPath(); g.arc(W * x, H * .2, 10, 0, 7); g.fill(); } }
  };
}

// back of the upper torso (seen from behind: x 0..W left to right on screen, y 0 neck .. H waist). V3 CF2: no back is an empty block.
function backPainter(spec) {
  const w = spec.wear || {}, top = w.topColor || '#3a6fd8', acc = w.accent || '#ffffff', skin = spec.skin || '#e0b98f';
  return (g, W, H) => {
    const kind = w.top, dk = d => shade(top, d);
    const hem = (col, h = .06) => { g.fillStyle = col; g.fillRect(0, H * (1 - h), W, H * h); };
    const seam = (col, x = .5, y0 = .12, y1 = 1) => { g.fillStyle = col; g.fillRect(W * x - 3, H * y0, 6, H * (y1 - y0)); };
    const neck = (col, depth = .06, wid = .2) => { g.fillStyle = col; g.beginPath(); g.ellipse(W / 2, 0, W * wid, H * depth, 0, 0, Math.PI); g.fill(); };
    const yoke = (col) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, H * .2); g.quadraticCurveTo(W / 2, H * .3, W, H * .2); g.lineTo(W, H * .24); g.quadraticCurveTo(W / 2, H * .34, 0, H * .24); g.closePath(); g.fill(); };
    const text = (t, col, y = .45, size = .16) => { g.fillStyle = col; g.font = `900 ${H * size}px Arial Black, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, W / 2, H * y); };
    if (kind === 'tank') { // racerback: skin shows between the straps, a hem
      g.fillStyle = skin; g.beginPath(); g.moveTo(W * .2, 0); g.lineTo(W * .8, 0); g.lineTo(W * .62, H * .34); g.lineTo(W * .38, H * .34); g.closePath(); g.fill();
      g.fillStyle = dk(-.1); g.fillRect(W * .37, H * .33, W * .26, H * .03); hem(dk(-.08), .05); seam(dk(-.06), .5, .36);
    } else if (kind === 'tshirt' || kind === 'sweater') {
      neck(dk(-.14), .06, .19); yoke(dk(-.06)); hem(dk(-.1));
      if (kind === 'sweater') { g.fillStyle = acc; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(W * (.05 + i * .1), H * .55); g.lineTo(W * (.1 + i * .1), H * .48); g.lineTo(W * (.15 + i * .1), H * .55); g.lineTo(W * (.1 + i * .1), H * .62); g.fill(); } }
      else { g.fillStyle = dk(-.12); g.fillRect(W * .46, H * .07, W * .08, H * .05); }
    } else if (kind === 'suit' || kind === 'labcoat' || kind === 'cardigan') {
      neck(kind === 'suit' ? (w.shirtColor || '#f4f4f4') : dk(-.1), .06, .16); g.fillStyle = dk(-.1); g.fillRect(W * .3, H * .04, W * .4, H * .05);
      seam(dk(-.12), .5, .1, kind === 'suit' ? .72 : 1); if (kind === 'suit') { g.fillStyle = dk(-.12); g.beginPath(); g.moveTo(W * .47, H * .72); g.lineTo(W * .53, H * .72); g.lineTo(W * .56, H); g.lineTo(W * .44, H); g.closePath(); g.fill(); }
      if (kind === 'labcoat') { g.fillStyle = dk(-.1); g.fillRect(W * .25, H * .62, W * .5, H * .06); for (const x of [.28, .72]) { g.fillStyle = '#c9c9c9'; g.beginPath(); g.arc(W * x, H * .65, 9, 0, 7); g.fill(); } }
      if (kind === 'cardigan') hem(dk(-.18), .08);
    } else if (kind === 'hoodie' || kind === 'print_hoodie') {
      seam(dk(-.1), .5, .35); hem(dk(-.12), .08); g.fillStyle = dk(-.1); for (const x of [.08, .92]) g.fillRect(W * x - 3, H * .1, 6, H * .85);
      if (kind === 'print_hoodie' || w.print === 'text') text((w.printText || 'LOL').toUpperCase(), acc, .55, .17);
    } else if (kind === 'jacket' || kind === 'varsity') {
      neck(dk(-.16), .07, .2); yoke(dk(-.08));
      if (kind === 'varsity') { text((w.printText || 'R').slice(0, 1), acc, .55, .34); g.fillStyle = w.sleeveColor || '#ffffff'; g.fillRect(0, H * .93, W, H * .07); }
      else { hem(dk(-.12), .08); seam(dk(-.1), .5, .3); }
    } else if (kind === 'plaid' || kind === 'shirt') {
      if (kind === 'plaid') { g.globalAlpha = .55; g.fillStyle = w.accent || dk(-.25); for (let i = 0; i < 8; i++) { g.fillRect(i * W / 8, 0, W / 22, H); g.fillRect(0, i * H / 8, W, H / 22); } g.globalAlpha = 1; }
      yoke(dk(-.1)); g.fillStyle = dk(-.12); g.fillRect(W * .47, H * .3, W * .06, H * .2); hem(dk(-.1));
    } else if (kind === 'police') {
      text('POLICE', '#f0f0f0', .4, .16); g.fillStyle = '#15151a'; g.fillRect(0, H * .9, W, H * .1); yoke(dk(-.12)); neck(dk(-.15), .06, .17);
    } else if (kind === 'overalls') { // straps cross on the back, bib patch low
      g.strokeStyle = top; g.lineWidth = W * .1; g.beginPath(); g.moveTo(W * .25, 0); g.lineTo(W * .72, H * .62); g.moveTo(W * .75, 0); g.lineTo(W * .28, H * .62); g.stroke();
      g.fillStyle = top; g.fillRect(W * .2, H * .58, W * .6, H * .42); g.fillStyle = '#e8c040'; g.beginPath(); g.arc(W / 2, H * .37, 10, 0, 7); g.fill();
      g.strokeStyle = dk(-.12); g.lineWidth = 6; g.strokeRect(W * .36, H * .7, W * .28, H * .18);
    } else if (kind === 'dress') { // zip + a bow at the waist
      neck(skin, .1, .18); seam('#c9c9c9', .5, .08, .76); g.fillStyle = w.accent || dk(-.15); g.fillRect(0, H * .8, W, H * .07);
      g.beginPath(); g.moveTo(W * .5, H * .83); g.lineTo(W * .38, H * .76); g.lineTo(W * .38, H * .9); g.closePath(); g.fill(); g.beginPath(); g.moveTo(W * .5, H * .83); g.lineTo(W * .62, H * .76); g.lineTo(W * .62, H * .9); g.closePath(); g.fill();
    } else { yoke(dk(-.08)); hem(dk(-.1)); seam(dk(-.08)); }
    if (w.print === 'stars') { g.fillStyle = acc; for (let i = 0; i < 5; i++) star(g, W * ((i * .37) % 1 * .8 + .1), H * (.35 + ((i * .61) % 1) * .5), W * .04); }
  };
}

// thighs: pockets (front slit, back patch) + a side seam, painted on the upper leg's front and back. Pants only (bare / skirt / dress: none).
function pocketPanel(L, s, front, col, material) {
  const pw = L.limbW * .52 * s, ph = .34 * s, R = L.limbD / 2 * s;
  const g = front ? roundedBox(pw, .045 * s, .02 * s, .008 * s) : roundedBox(pw, ph, .02 * s, .03 * s);
  g.setAttribute('ao', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(1), 1));
  const m = new THREE.Mesh(g, material(new THREE.Color(col).getHex(), 'cloth'));
  m.position.set(0, front ? -.16 * s : -.42 * s, (front ? 1 : -1) * (R + .004 * s)); if (front) m.rotation.z = .35; m.castShadow = false; m.name = 'rbx.wearPocket';
  return m;
}

// a thin panel that follows the torso's front (bevel included): the texture's front, wrapped a little round the bevel
function frontPanel(wid, y0, y1, z, bevel, tex, material) {
  const segX = 24, segY = 4, pos = [], uv = [], idx = [];
  for (let j = 0; j <= segY; j++) for (let i = 0; i <= segX; i++) {
    const u = i / segX, x = (u - .5) * wid, e = Math.max(0, Math.abs(x) - (wid / 2 - bevel)), zz = z - (bevel - Math.sqrt(Math.max(bevel * bevel - e * e, 0)));
    pos.push(x, y1 + (y0 - y1) * j / segY, zz + .002); uv.push(u, 1 - j / segY);
  }
  for (let j = 0; j < segY; j++) for (let i = 0; i < segX; i++) { const a = j * (segX + 1) + i, b = a + segX + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  g.setAttribute('ao', new THREE.BufferAttribute(new Float32Array(pos.length / 3).fill(1), 1));
  const m = new THREE.Mesh(g, material(0xffffff, 'print', { map: tex, polygonOffset: -1 })); m.name = 'rbx.wearFront'; return m;
}

export function wearDetails(spec = {}, L, material) {
  const w = spec.wear || {}, s = STUD, out = [];
  if (!L) return out;
  const top = (L.neckY - L.hipY) * s, wid = L.torsoW * s, z = L.torsoD * s / 2;
  const tex = canvasTex(frontPainter(spec));
  out.push({ part: 'torsoU', mesh: frontPanel(wid * .995, (L.lowerH + .08) * s, top - .03 * s, z, .1 * s, tex, material) });
  // V3 CF2: the back (its own painting, the same panel turned round), sleeve hems / cuffs, thigh pockets, shoe soles + toe caps
  const back = frontPanel(wid * .995, (L.lowerH + .08) * s, top - .03 * s, z, .1 * s, canvasTex(backPainter(spec)), material);
  back.rotation.y = Math.PI; back.name = 'rbx.wearBack'; out.push({ part: 'torsoU', mesh: back });
  const sleeve = SLEEVES[w.top] || 'short', sCol = shade(w.sleeveColor || w.topColor || '#3a6fd8', -.12), lw = L.limbW * s, ld = L.limbD * s;
  const band = (part, y, col, h = .1, bw = lw, bd = ld) => { const geo = roundedBox(bw * 1.04, h * s, bd * 1.04, Math.min(bw, bd) * .3); geo.setAttribute('ao', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(1), 1)); const m = new THREE.Mesh(geo, material(new THREE.Color(col).getHex(), 'cloth')); m.position.y = y; m.name = 'rbx.wearBand'; out.push({ part, mesh: m }); };
  for (const sd of ['R', 'L']) {
    if (sleeve === 'short' && w.top !== 'overalls') band('armU' + sd, -(L.armSeg - .12) * s, sCol, .1, (L.armW ?? L.limbW) * s, (L.armD ?? L.limbD) * s);
    if (sleeve === 'long') band('armL' + sd, (-L.armSeg + L.handH / 2 + .06) * s, sCol, .13, (L.armW ?? L.limbW) * (L.lowerK ?? 1) * s, (L.armD ?? L.limbD) * (L.lowerK ?? 1) * s);
    const bareLegs = w.pantsKind === 'shorts' || w.pantsKind === 'skirt' || w.top === 'dress';
    if (!bareLegs) {
      const pBase = w.top === 'overalls' ? (w.topColor || '#3a6fd8') : (w.pants || '#1d1d24'), pc = shade(pBase, new THREE.Color(pBase).getHSL({}).l < .22 ? .07 : -.08);
      out.push({ part: 'legU' + sd, mesh: pocketPanel(L, s, false, pc, material) }, { part: 'legU' + sd, mesh: pocketPanel(L, s, true, pc, material) });
    } else if (w.pantsKind === 'shorts') band('legU' + sd, -(L.legSeg - .1) * s, shade(w.pants || '#1d1d24', -.1));
    // shoes: a sole in a second colour + a toe cap
    const shoes = new THREE.Color(w.shoes || '#1b1b20'), dark = shoes.getHSL({}).l < .35, solCol = w.sole || (dark ? '#e9e6df' : '#2a2a30');
    const fw = L.limbW * .98 * s, fd = L.footD * s, y0 = -L.ankleY * s;
    const sole = roundedBox(fw * 1.03, .09 * s, fd * 1.03, .035 * s); sole.setAttribute('ao', new THREE.BufferAttribute(new Float32Array(sole.attributes.position.count).fill(1), 1));
    const sm = new THREE.Mesh(sole, material(new THREE.Color(solCol).getHex(), 'sole')); sm.position.set(0, y0 + .04 * s, .08 * s); sm.name = 'rbx.wearSole'; out.push({ part: 'foot' + sd, mesh: sm });
    const cap = roundedBox(fw * 1.02, .16 * s, .3 * s, .06 * s); cap.setAttribute('ao', new THREE.BufferAttribute(new Float32Array(cap.attributes.position.count).fill(1), 1));
    const cm = new THREE.Mesh(cap, material(new THREE.Color(shade('#' + shoes.getHexString(), dark ? .1 : -.12)).getHex(), 'shoes')); cm.position.set(0, y0 + .15 * s, .08 * s + fd / 2 - .14 * s); cm.name = 'rbx.wearToe'; out.push({ part: 'foot' + sd, mesh: cm });
  }
  // back: hood (hoodies), collar (police / shirt / jacket)
  const add = (part, geo, hex, x, y, zz, rx = 0) => { const m = new THREE.Mesh(geo, material(new THREE.Color(hex).getHex(), 'cloth')); m.position.set(x, y, zz); m.rotation.x = rx; m.castShadow = true; out.push({ part, mesh: m }); geo.setAttribute('ao', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(1), 1)); };
  const topCol = w.topColor || '#3a6fd8';
  if (w.top === 'hoodie' || w.top === 'print_hoodie') add('torsoU', roundedBox(wid * .62, .22 * s * 1.6, .36 * s, .12 * s), shade(topCol, -.06), 0, top - .18 * s, -z + .02 * s, -.25);
  if (w.top === 'police' || w.top === 'shirt' || w.top === 'plaid' || w.top === 'jacket') add('torsoU', roundedBox(wid * .42, .14 * s, L.torsoD * s * .78, .06 * s), shade(topCol, -.05), 0, top - .02 * s, -.02 * s);
  // belt line on the lower torso for trousers
  if (w.top !== 'dress' && w.pantsKind !== 'skirt') add('torsoL', roundedBox(wid * 1.004, .09 * s, L.torsoD * s * 1.004, .04 * s), shade(w.pants || '#1d1d24', -.12), 0, (L.lowerH + .02) * s, 0);
  // skirt / dress: a tapered block from the waist to mid thigh (it rides the lower torso)
  if (w.top === 'dress' || w.pantsKind === 'skirt') {
    const col = w.top === 'dress' ? topCol : (w.pants || '#1d1d24'), h = 1.25 * s;
    const geo = new THREE.CylinderGeometry(1.0, 1.22, h, 4, 3, true); geo.rotateY(Math.PI / 4); geo.scale(wid * .74, 1, L.torsoD * s * .78); geo.computeVertexNormals();
    add('torsoL', geo, col, 0, (L.lowerH + .05) * s - h / 2, 0);
  }
  return out;
}
