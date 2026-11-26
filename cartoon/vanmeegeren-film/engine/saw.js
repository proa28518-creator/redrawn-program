// saw.js: his hacksaw as one rigid 3D object. Local space: origin at the near clamp on the blade, +X along the blade to the far clamp,
// +Y up the posts toward the bow bar, +Z the saw plane's normal. Model length 1 between the clamps, scaled by S (head diameters).
// Parts: orange D-handle plate with rivet and dark tang, dark bow bar (navy on its upper side, plum on the lower, brown down the posts), two clamp
// blocks, a thin blade with small teeth, tail past the far clamp. Pose per key frame: limbTrack.json keys[f].saw { p, q }.
// Colours change with the shot's light, so they are measured per key: keys[f].sawTint (tools/limb_saw_hand.json), interpolated like the pose.
import * as THREE from './three.js';
import { sampleSpline, loadTrack } from './limbs.js';
import { loadTrack as loadTrackFrom } from './tracks.js';

export const S = 1.05; // measured: 1.03-1.10 D between clamps across f3, f19, f56, f66
const C = { bladeTop: '#d27a5e', bladeBot: '#cc6848', tail: '#cc6848', tailY: '#b39a33', barTop: '#2d2d4d', barBot: '#331e28', post: '#4d2626', clamp0: '#5e281e', clamp1: '#5c261c', handle: '#bc481b', rivet: '#d9602c', core: '#a46a3b', tang: '#6e2c14' };

function mat(c) { return new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, toneMapped: false }); }

// Static tube; colours are repainted from the tint, by position along (u) and around (w: +1 toward the saw's +Y side on the bar).
function tube(P, radius, rings = 90, rad = 10) {
  const c = new Float64Array(rings * 3); sampleSpline(P, rings, c);
  const pos = [], uw = [], idx = [];
  const n = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1), v = new THREE.Vector3();
  for (let i = 0; i < rings; i++) {
    const a = Math.max(0, i - 1) * 3, b = Math.min(rings - 1, i + 1) * 3;
    n.set(c[b] - c[a], c[b + 1] - c[a + 1], c[b + 2] - c[a + 2]).normalize();
    v.crossVectors(up, n).normalize();
    const u = i / (rings - 1), r = radius(u);
    for (let j = 0; j < rad; j++) {
      const t = j / rad * Math.PI * 2, ca = Math.cos(t) * r, sa = Math.sin(t) * r * .66; // a flat bar: .045 D in the saw's plane (f40), .03 D edge on (f66)
      pos.push(c[i * 3] + v.x * ca + up.x * sa, c[i * 3 + 1] + v.y * ca + up.y * sa, c[i * 3 + 2] + v.z * ca + up.z * sa);
      uw.push(u, Math.cos(t));
    }
  }
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < rad; j++) {
    const p = i * rad + j, q = i * rad + (j + 1) % rad, s = p + rad, t = q + rad;
    idx.push(p, q, s, q, t, s);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }));
  m.userData.uw = uw;
  return m;
}

function plate(pts, depth, color) {
  const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -depth / 2);
  return new THREE.Mesh(g, mat(color));
}

const RIVET = [-.07, .232];

export async function build(params = {}) {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(params.scale ?? S);
  root.add(inner);
  // its pose lives in the limbs track (keys[f].saw): params.track (the limbs group's own, passed in) or params.tracks, else the default
  root.userData.track = params.track || (params.tracks ? await loadTrackFrom(params, 'limbs') : await loadTrack());

  // Bow bar: near post up, over the top, down the far post. Measured widths at f40: near post 9 px, bar 18 px, far post 12 px, D 399, L 384 px.
  const pts = [[.012, .03, 0], [.018, .12, 0], [.03, .22, 0], [.052, .285, 0], [.105, .312, 0], [.35, .305, 0], [.65, .295, 0], [.88, .283, 0], [.965, .262, 0], [1.008, .205, 0], [1.012, .12, 0], [1.0, .03, 0]];
  const rad = u => { const near = .012, bar = .0225, far = .0155; return u < .2 ? near + (bar - near) * THREE.MathUtils.smoothstep(u, .12, .2) : u < .78 ? bar : bar + (far - bar) * THREE.MathUtils.smoothstep(u, .78, .96); };
  const bar = tube(pts, rad); inner.add(bar);

  // Clamps: the chunky blocks where the posts meet the blade.
  const clamp = (x, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(.052, .085, .018), mat(c)); m.position.set(x, .018, .001); return m; };
  const clamp0 = clamp(.008, C.clamp0), clamp1 = clamp(1.0, C.clamp1);
  inner.add(clamp0, clamp1);

  // Blade: a thin ribbon, measured .033 high with its teeth (f19 10 px, f40 13 px, f56 11 px, f80 8 px), paler on the back than at the teeth.
  const y0 = -.004, y1 = .0255, x0 = .0, x1 = 1.0, toothH = .0035;
  const shape = [[x0, y1], [x1, y1]];
  const pitch = .0165;
  for (let x = x1; x > x0; x -= pitch) { shape.push([x, y0], [x - pitch * .5, y0 - toothH]); }
  shape.push([x0, y0]);
  const blade = plate(shape, .004, '#ffffff');
  blade.material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
  blade.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(blade.geometry.attributes.position.count * 3), 3));
  blade.position.z = -.002; inner.add(blade);
  const tail = plate([[1.0, y1 - .004], [1.085, y1 - .012], [1.085, y0 + .004], [1.0, y0]], .004, C.tail);
  inner.add(tail);
  const tailY = plate([[1.018, .008], [1.085, .008], [1.085, y0 + .004], [1.018, y0 + .002]], .005, C.tailY);
  tailY.position.z = .001; inner.add(tailY);

  // D-handle: plate measured off f40 (px -> local), rivet and dark tang toward the hand.
  const hp = [[-.205, .19], [-.176, .206], [-.125, .252], [-.071, .284], [.012, .294], [.03, .27], [.024, .243], [.008, .191], [-.081, .165], [-.153, .135]];
  const handle = plate(hp, .012, C.handle); inner.add(handle);
  const rivetMat = mat(C.rivet), coreMat = mat(C.core);
  const riv = new THREE.Group(); inner.add(riv);
  for (const z of [.0075, -.0075]) {
    const rv = new THREE.Mesh(new THREE.CircleGeometry(.0175, 20), rivetMat); rv.position.z = z; rv.scale.set(.85, 1, 1); riv.add(rv);
    const core = new THREE.Mesh(new THREE.CircleGeometry(.0085, 14), coreMat); core.position.set(.002, .007, z + Math.sign(z) * .001); riv.add(core);
  }
  riv.position.set(RIVET[0], RIVET[1], 0);
  const tang = plate([[-.078, .214], [-.062, .208], [-.13, .155], [-.15, .17]], .014, C.tang); inner.add(tang);
  root.userData.parts = { bar, blade, clamp0, clamp1, tail, tailY, handle, tang, riv, rivetMat, coreMat };
  paint(root, {});
  return root;
}

const a = new THREE.Color(), b = new THREE.Color(), d = new THREE.Color(), o = new THREE.Color();
const smooth = THREE.MathUtils.smoothstep;
function paint(root, tint) {
  const P = root.userData.parts, T = k => tint[k] ?? C[k];
  // the bar: across it upper side to lower side, along it into the posts, and an optional tint at the near end (f66's teal)
  a.set(T('barTop')); b.set(T('barBot')); d.set(T('post'));
  const near = tint.barNear ? new THREE.Color(tint.barNear) : null, postNear = tint.postNear ? new THREE.Color(tint.postNear) : null;
  const uw = P.bar.userData.uw, col = P.bar.geometry.attributes.color;
  for (let i = 0; i < col.count; i++) {
    const u = uw[i * 2], w = uw[i * 2 + 1];
    o.copy(b).lerp(a, smooth(w, -.2, .55));
    if (near) o.lerp(near, 1 - smooth(u, .14, .45));
    o.lerp(d, 1 - smooth(u, .13, .19) * (1 - smooth(u, .76, .86)));
    if (postNear) o.lerp(postNear, 1 - smooth(u, .1, .15));
    col.setXYZ(i, o.r, o.g, o.b);
  }
  col.needsUpdate = true;
  a.set(T('bladeTop')); b.set(T('bladeBot'));
  const pos = P.blade.geometry.attributes.position, cb = P.blade.geometry.attributes.color;
  for (let i = 0; i < pos.count; i++) { o.copy(b).lerp(a, smooth(pos.getY(i), .002, .022)); cb.setXYZ(i, o.r, o.g, o.b); }
  cb.needsUpdate = true;
  P.clamp0.material.color.set(T('clamp0')); P.clamp1.material.color.set(T('clamp1'));
  P.tail.material.color.set(T('tail')); P.tailY.material.color.set(T('tailY'));
  P.handle.material.color.set(T('handle')); P.tang.material.color.set(T('tang'));
  P.rivetMat.color.set(T('rivet')); P.coreMat.color.set(T('core'));
  const at = tint.rivetAt ?? RIVET;
  P.riv.position.set(at[0], at[1], 0);
  P.riv.scale.setScalar(tint.rivetS ?? 1);
}

function hexOf(c) { return '#' + c.getHexString(); }
function lerpTint(A, B, t) {
  if (!A || !B) return A || B || {};
  const out = {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (k === 'rivetAt') { const x = A[k] ?? RIVET, y = B[k] ?? RIVET; out[k] = [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t]; continue; }
    if (k === 'rivetS') { const x = A[k] ?? 1, y = B[k] ?? 1; out[k] = x + (y - x) * t; continue; }
    const of = T => T[k] ?? (k === 'barNear' ? T.barTop : k === 'postNear' ? T.post : undefined) ?? C[k];
    out[k] = hexOf(new THREE.Color(of(A)).lerp(new THREE.Color(of(B)), t));
  }
  return out;
}

export function poseAt(frame, track) {
  const fs = Object.keys(track.keys).map(Number).filter(f => track.keys[f].saw).sort((a, b) => a - b);
  if (!fs.length) return null;
  const withTint = f => ({ ...track.keys[f].saw, tint: track.keys[f].sawTint || {} });
  if (frame <= fs[0]) return withTint(fs[0]);
  if (frame >= fs[fs.length - 1]) return withTint(fs[fs.length - 1]);
  const i = fs.findIndex(f => f >= frame), hi = fs[i], lo = fs[i - 1], t = (frame - lo) / (hi - lo);
  const A = track.keys[lo].saw, B = track.keys[hi].saw;
  const qa = new THREE.Quaternion(...A.q), qb = new THREE.Quaternion(...B.q);
  const q = qa.slerp(qb, t);
  return { p: A.p.map((v, j) => v + (B.p[j] - v) * t), q: [q.x, q.y, q.z, q.w], tint: lerpTint(track.keys[lo].sawTint, track.keys[hi].sawTint, t) };
}

export function setPose(root, pose) {
  if (!pose) { root.visible = false; return; }
  root.visible = true;
  root.position.set(...pose.p);
  root.quaternion.set(...pose.q);
  if (pose.tint) paint(root, pose.tint);
}

export function update(frame, ctx) {
  const root = ctx.root;
  setPose(root, poseAt(frame, root.userData.track));
}
