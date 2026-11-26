// props/newspaper.js: the Townsperson's newspaper "The Red Mesa Herald - THE CLICKETY CLACK LINE!" (s12 f943-1016, s13).
// A flat sheet (w x h in D, his f975: 1.06 x 1.35) with the printed page drawn procedurally on a canvas texture (masthead, rules,
// headline, sub-line, the engraved train in a box, small columns). The page is the only canvas-drawn thing; it's a prop, not the character.
// Track: props.json { "newspaper": { "<frame>": { p: [x,y,z] centre, q: [x,y,z,w], tint: '#rrggbb' (multiplies the paper), bend: 0..1 } } }
// character space; frames between keys interpolate (p lerp, q slerp, tint lerp); outside the keys the nearest key holds; hide: { "<from>": <to> }.
// params: w h (D), paper '#f4ecd6', ink '#4a3a30', edge '#c9bc9c'.
import * as THREE from '../three.js';
import { loadTrack } from '../tracks.js';

function drawPage(W, H, P) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = P.paper; g.fillRect(0, 0, W, H);
  g.strokeStyle = P.edge; g.lineWidth = W * .012; g.strokeRect(0, 0, W, H);
  // soft paper grade: a little darker toward the bottom right
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(1, 'rgba(120,90,50,0.10)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const ink = P.ink, mx = W * .055;
  g.fillStyle = ink; g.strokeStyle = ink; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  // top line: VOL / PRICE FIVE CENTS
  g.font = `${H * .012}px Georgia, serif`;
  g.textAlign = 'left'; g.fillText('VOL. II   No. 17', mx, H * .03);
  g.textAlign = 'right'; g.fillText('PRICE FIVE CENTS', W - mx, H * .03);
  g.textAlign = 'center';
  // masthead
  g.font = `${H * .066}px Georgia, 'Times New Roman', serif`;
  g.fillText('The Red Mesa Herald', W / 2, H * .105);
  g.lineWidth = H * .003; g.beginPath(); g.moveTo(mx, H * .128); g.lineTo(W - mx, H * .128); g.stroke();
  g.font = `${H * .011}px Georgia, serif`; g.globalAlpha = .55;
  g.fillText('RED MESA, TERRITORY OF ARIZONA  -  ALL THE NEWS OF THE LINE', W / 2, H * .145); g.globalAlpha = 1;
  g.lineWidth = H * .0018; g.beginPath(); g.moveTo(mx, H * .155); g.lineTo(W - mx, H * .155); g.stroke();
  // headline, two lines, bold condensed serif
  g.font = `bold ${H * .084}px Georgia, 'Times New Roman', serif`;
  g.save(); g.translate(W / 2, H * .245); g.scale(.80, 1); g.fillText('THE CLICKETY', 0, 0); g.restore();
  g.save(); g.translate(W / 2, H * .32); g.scale(.80, 1); g.fillText('CLACK LINE!', 0, 0); g.restore();
  // sub-line (italic, faint)
  g.font = `italic ${H * .016}px Georgia, serif`; g.globalAlpha = .6;
  g.fillText('Passengers Rattled the Whole Length of the Red Canyon Short Line', W / 2, H * .36); g.globalAlpha = 1;
  // engraving box with the locomotive
  const bx = W * .09, by = H * .385, bw = W * .82, bh = H * .23;
  g.lineWidth = H * .0022; g.strokeRect(bx, by, bw, bh);
  g.save(); g.beginPath(); g.rect(bx, by, bw, bh); g.clip();
  g.globalAlpha = .35; g.lineWidth = H * .0012;
  for (let i = 0; i < 26; i++) { const y = by + bh * (i + .5) / 26; g.beginPath(); g.moveTo(bx, y); g.lineTo(bx + bw, y + bh * .04 * Math.sin(i)); g.stroke(); }
  g.globalAlpha = 1; g.restore();
  // locomotive: cab, boiler, stack, cowcatcher, wheels
  g.lineWidth = H * .0028; g.fillStyle = P.paper;
  const L = (x, y) => [bx + bw * x, by + bh * y];
  const rect = (x, y, w, h) => { const [a, b] = L(x, y); g.fillRect(a, b, bw * w, bh * h); g.strokeRect(a, b, bw * w, bh * h); };
  rect(.17, .18, .16, .48);          // cab
  rect(.14, .12, .22, .07);          // cab roof
  rect(.20, .26, .08, .14);          // cab window
  rect(.33, .40, .36, .24);          // boiler
  rect(.55, .12, .045, .28);         // stack
  rect(.50, .06, .095, .07);         // stack top
  g.beginPath(); { const [a, b] = L(.69, .44); g.moveTo(a, b); const [c, d] = L(.79, .74); g.lineTo(c, d); const [e, f] = L(.69, .74); g.lineTo(e, f); g.closePath(); g.fill(); g.stroke(); }
  const wheel = (x, r) => { const [a, b] = L(x, .74); g.beginPath(); g.arc(a, b, bh * r, 0, Math.PI * 2); g.fill(); g.stroke();
    for (let k = 0; k < 6; k++) { const t = k * Math.PI / 3; g.beginPath(); g.moveTo(a, b); g.lineTo(a + Math.cos(t) * bh * r, b + Math.sin(t) * bh * r); g.stroke(); } };
  wheel(.25, .14); wheel(.39, .14); wheel(.52, .09); wheel(.60, .09); wheel(.67, .07);
  { const [a, b] = L(.04, .88); const [c] = L(.96, .88); g.beginPath(); g.moveTo(a, b); g.lineTo(c, b); g.stroke(); }
  g.fillStyle = ink;
  // caption under the box and small text columns
  g.font = `${H * .011}px Georgia, serif`; g.globalAlpha = .55;
  g.fillText('THE NEW LOCOMOTIVE OF THE LINE, DRAWN BY OUR ARTIST', W / 2, H * .64);
  g.globalAlpha = .28; g.lineWidth = H * .0016;
  const cols = 3, cw = (W - 2 * mx) / cols;
  for (let c = 0; c < cols; c++) for (let r = 0; r < 14; r++) {
    const x0 = mx + c * cw + cw * .06, x1 = mx + (c + 1) * cw - cw * .06 - (r % 5 === 4 ? cw * .35 : 0), y = H * (.67 + r * .021);
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
  }
  g.globalAlpha = 1;
  return cv;
}

export async function build(params = {}) {
  const { kind, tracks, limbsTrack, ...own } = params;
  const P = { w: 1.06, h: 1.35, paper: '#f4ecd6', ink: '#4a3a30', edge: '#b9ab8c', ...own };
  const track = tracks?.props?.length ? (await loadTrack({ tracks: tracks.props }, 'props'))[kind || 'newspaper'] || null : null;
  const root = new THREE.Group(); root.name = 'prop.newspaper';
  const tex = new THREE.CanvasTexture(drawPage(1024, Math.round(1024 * P.h / P.w), P));
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const geo = new THREE.PlaneGeometry(P.w, P.h, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, color: 0xffffff });
  const sheet = new THREE.Mesh(geo, mat); sheet.name = 'newspaper.sheet';
  // a thin darker edge (his paper has a soft grey-brown border, no heavy ink)
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(P.w + .012, P.h + .012), new THREE.MeshBasicMaterial({ color: P.edge, side: THREE.DoubleSide }));
  edge.position.z = -.002;
  root.add(sheet); // the edge plane is not drawn: the bent sheet would cut into it; the border is in the page texture
  root.userData = { track, P, mat, geo, base: geo.attributes.position.array.slice() };
  return root;
}

const _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion(), _c0 = new THREE.Color(), _c1 = new THREE.Color();
export function update(frame, ctx) {
  const { track, mat, geo, base, P } = ctx.root.userData;
  if (!track) { ctx.root.visible = false; return; }
  const f = Math.round(frame);
  if (track.hide) for (const [a, b] of Object.entries(track.hide)) if (f >= +a && f <= +b) { ctx.root.visible = false; return; }
  const ks = Object.keys(track).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
  if (!ks.length) { ctx.root.visible = false; return; }
  ctx.root.visible = true;
  let a = ks[0], b = ks[0];
  for (const k of ks) { if (k <= f) a = k; if (k >= f) { b = k; break; } }
  if (f > ks[ks.length - 1]) a = b = ks[ks.length - 1];
  const A = track[a], B = track[b], t = a === b ? 0 : (f - a) / (b - a);
  ctx.root.position.set(...A.p.map((v, i) => v + (B.p[i] - v) * t));
  _q0.set(...(A.q || [0, 0, 0, 1])); _q1.set(...(B.q || [0, 0, 0, 1])); ctx.root.quaternion.copy(_q0.slerp(_q1, t));
  ctx.root.scale.setScalar((A.s ?? 1) + ((B.s ?? 1) - (A.s ?? 1)) * t);
  _c0.set(A.tint || '#ffffff'); _c1.set(B.tint || '#ffffff'); mat.color.copy(_c0.lerp(_c1, t));
  // bend: the sheet sags back at its sides (a held page), z offset = -bend * x^2
  const bend = (A.bend ?? 0) + ((B.bend ?? 0) - (A.bend ?? 0)) * t, pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = base[i * 3] / (P.w / 2); pos.array[i * 3 + 2] = -bend * .12 * x * x; }
  pos.needsUpdate = true;
}

export default { build, update };
