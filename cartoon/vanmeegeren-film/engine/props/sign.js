// props/sign.js: the Boss's "ALL ABOARD!" placard (s14, f1047-1084): a cream board in a thin wooden frame on a wooden stick, lettering drawn
// procedurally on a canvas texture (red serif "ALL ABOARD!", a small dark "RED CANYON SHORT LINE" under it, four nail heads), inked at body
// weight (shade.js outline). Measured on his f1060 / f1072: board about 1.5 x .6 D (head diameters), stick about .045 D across, board bottom
// about 1.25 D above the hand.
// Spec: { "kind": "sign", "w": 1.5, "h": .6, "t": .04, "poleR": .022, "up": 1.25, "down": .25, "text": "ALL ABOARD!", "sub": "RED CANYON SHORT LINE" }
// Pose: tracks/<char>/props.json { "sign": { "<frame>": { p: [x,y,z] the grip point (hand) on the stick, q: [x,y,z,w] rotating local +Y (grip ->
// board) and local +Z (board front) } } }, character space; between keys p lerps, q slerps, outside the keys holds the nearest; { "hide": true } hides.
import * as THREE from '../three.js';
import { loadTrack } from '../tracks.js';
import { outline } from '../shade.js';

const VERT = /* glsl */`
varying vec3 vN; varying vec2 vUv;
void main() { vN = normalize(normalMatrix * normal); vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */`
precision highp float;
uniform vec3 cLit, cDark, cHi; uniform float uHi;
varying vec3 vN; varying vec2 vUv;
void main() {
  vec3 n = normalize(vN);
  float k = dot(n.xy, normalize(vec2(-1., .35)));
  vec3 c = mix(cDark, cLit, smoothstep(-.35, .25, k));
  c = mix(c, cHi, uHi * smoothstep(.55, .8, k));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;
const wood = (lit, dark, hi, h) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG,
  uniforms: { cLit: { value: new THREE.Color(lit) }, cDark: { value: new THREE.Color(dark) }, cHi: { value: new THREE.Color(hi) }, uHi: { value: h } } });

function face(own, W, H) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  // board: cream, a little darker toward the edges (his board reads paper-on-wood, warm)
  const grd = g.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, own.boardLit ?? '#f1e4c2'); grd.addColorStop(.6, own.boardMid ?? '#e6d3a8'); grd.addColorStop(1, own.boardDark ?? '#cdb487');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  // grain streaks
  g.globalAlpha = .10; g.strokeStyle = '#8a6a3c'; g.lineWidth = 2;
  for (let i = 0; i < 9; i++) { const y = H * (.08 + i * .105); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * .3, y + 6, W * .6, y - 5, W, y + 3); g.stroke(); }
  g.globalAlpha = 1;
  // frame: thin dark-wood border
  const fb = Math.round(H * (own.frame ?? .055));
  g.strokeStyle = own.frameColor ?? '#7a5733'; g.lineWidth = fb; g.strokeRect(fb / 2, fb / 2, W - fb, H - fb);
  g.strokeStyle = 'rgba(60,35,25,.55)'; g.lineWidth = 2; g.strokeRect(fb, fb, W - 2 * fb, H - 2 * fb);
  // title: red serif caps, dark red outline, a slight upward arc like his hand-painted letters
  const text = own.text ?? 'ALL ABOARD!';
  const fs = Math.round(H * .34);
  g.font = `bold ${fs}px "Rockwell Extra Bold", Rockwell, "Bookman Old Style", Georgia, serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const tw = g.measureText(text).width, maxW = W * .84, sx = Math.min(1, maxW / tw);
  g.save(); g.translate(W / 2, H * .43); g.scale(sx, 1);
  g.lineJoin = 'round'; g.lineWidth = fs * .10; g.strokeStyle = own.titleInk ?? '#6e1d1a'; g.strokeText(text, 0, 0);
  g.fillStyle = own.titleColor ?? '#c23a2c'; g.fillText(text, 0, 0);
  g.restore();
  // subtitle
  const sub = own.sub ?? 'RED CANYON SHORT LINE';
  const fs2 = Math.round(H * .095);
  g.font = `bold ${fs2}px Georgia, "Times New Roman", serif`; g.fillStyle = own.subColor ?? '#5a3a2a';
  g.save(); g.translate(W / 2, H * .74); const sw = g.measureText(sub).width; g.scale(Math.min(1, W * .62 / sw), 1); g.fillText(sub, 0, 0); g.restore();
  // nail heads in the corners
  g.fillStyle = '#5b4a3e';
  for (const [x, y] of [[.04, .1], [.96, .1], [.04, .9], [.96, .9]]) { g.beginPath(); g.arc(W * x, H * y, H * .022, 0, 7); g.fill(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

export async function build(params = {}) {
  const { kind, tracks, limbsTrack, ...own } = params;
  const all = tracks?.props?.length ? await loadTrack({ tracks: tracks.props }, 'props') : null;
  const track = all?.[kind || 'sign'] || null;
  const w = own.w ?? 1.5, h = own.h ?? .6, t = own.t ?? .04, r = own.poleR ?? .022, up = own.up ?? 1.25, down = own.down ?? .25;
  const ink = own.ink ?? 0x3a2a33, iw = own.inkWidth ?? .016;
  const root = new THREE.Group(); root.name = 'prop.sign';
  // stick: from `down` below the grip up into the board's lower half
  const poleL = up + down + h * .45;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(r, r, poleL, 14, 1), wood(own.poleLit ?? '#b08048', own.poleDark ?? '#6a4526', own.poleHi ?? '#e0b878', .8));
  pole.position.y = -down + poleL / 2; pole.position.z = -t * .5 - r; pole.name = 'sign.pole';
  const pivot = new THREE.Group(); pivot.name = 'sign.pivot'; pivot.add(pole); root.add(pivot);
  // board: a thin box, canvas on the front face, plain wood on the rest
  const tex = face(own, 1024, Math.round(1024 * h / w));
  const side = new THREE.MeshBasicMaterial({ color: own.edgeColor ?? '#8d6a40' });
  const front = new THREE.MeshBasicMaterial({ map: tex });
  const back = new THREE.MeshBasicMaterial({ color: own.backColor ?? '#c8ad7e' });
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), [side, side, side, side, front, back]);
  board.position.y = up + h / 2; board.name = 'sign.board'; root.add(board);
  for (const m of [pole, board]) outline(m, { width: iw, color: ink });
  root.userData = { pivot, board, reach: up + h / 2, track, limbsTrack, kind: kind || 'sign', keys: track ? Object.keys(track).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b) : [] };
  return root;
}

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
export function update(frame, ctx) {
  const { track, keys, limbsTrack } = ctx.root.userData;
  if (track && keys.length) {
    let a = keys[0], b = keys[keys.length - 1];
    for (const k of keys) { if (k <= frame) a = k; if (k >= frame) { b = k; break; } }
    const A = track[a], B = track[b];
    if ((frame <= a ? A : frame >= b ? B : A).hide && (A.hide || B.hide)) { ctx.root.visible = false; return; }
    ctx.root.visible = true;
    const t = a === b ? 0 : Math.min(1, Math.max(0, (frame - a) / (b - a)));
    ctx.root.position.set(...A.p.map((v, i) => v + (B.p[i] - v) * t));
    qa.set(...A.q); qb.set(...B.q); ctx.root.quaternion.copy(qa.slerp(qb, t));
    // a: the stick's angle in the board plane (deg, + = the stick leans to the board's left going up); the board sits at its top
    const ang = ((A.a ?? 0) + ((B.a ?? 0) - (A.a ?? 0)) * t) * Math.PI / 180, { pivot, board, reach } = ctx.root.userData;
    pivot.rotation.z = ang; board.position.set(-Math.sin(ang) * reach, Math.cos(ang) * reach, 0);
    return;
  }
  const hand = limbsTrack?.keys?.[String(frame)]?.hands?.far;
  ctx.root.visible = !!hand;
  if (hand) ctx.root.position.set(hand[0], hand[1], hand[2]);
}
