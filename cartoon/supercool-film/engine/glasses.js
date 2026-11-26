// glasses.js: glasses as ink strokes on the FACE layer (rides the face like beard.js: same decal space, same pose matrix).
//   buildGlasses({ kind, colour, eyes, size, seed }) -> Object3D (head space) with .update(faceRecord)
//   buildGlasses({ ..., low }) slides them down the nose (ENG8, the `glasses: lowered` state); buildHeldGlasses(spec) = the same pair held in a hand (flat, front-on)
//     kind   'round' | 'square' | 'half' (half-moon readers, sit low) | 'sun' (dark lenses, one glint) | 'cateye' (ENG10: outer top corners
//            swept up to a point) | 'oval' (ENG10: a wide soft oval)
//     colour frame colour (default his ink); eyes [u, v] of the right-hand eye centre in decal R units (default [.23, .02], the
//            guide's EX; the engineer's fitted eyes sit about [.22, .06]); size scales the lenses.
// Frames are brush strokes like his: one bold weight (.058 R, = the face lines) with a hashed swell, arms thinning to ~half at the ear.
// Lenses empty except 'sun' (solid dark lens + one glint).
import * as THREE from './three.js';
import { decalLayer, strokeLine, fill, ring, brush, spline2 } from './beard.js';

const INK = 0x3a2a33;
export const GLASSES_KINDS = ['round', 'square', 'half', 'sun', 'cateye', 'oval'];
// ENG10: the lens half-widths where the arm leaves (outer) and the bridge meets (inner); kinds not listed use the round RR
const OV = [.172, .135], OUT_W = { square: .17, cateye: .2, oval: OV[0] }, IN_W = { square: .17, cateye: .17, oval: OV[0] };

function roundRect(cu, cv, hw, hh, r, n = 10) {
  const P = [], c = [[cu + hw - r, cv + hh - r, 0], [cu - hw + r, cv + hh - r, Math.PI / 2], [cu - hw + r, cv - hh + r, Math.PI], [cu + hw - r, cv - hh + r, 1.5 * Math.PI]];
  for (const [x, y, a0] of c) for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; P.push([x + r * Math.cos(a), y + r * Math.sin(a)]); }
  return P;
}
function glassesTris(kind, f, { frame, lens, eyes, size, seed, low = 0, arms = true }) {
  const out = [], [eu, ev0] = eyes, s = size, ev = ev0 + low;   // ENG8: low = how far down the nose (decal v, + = down)
  // FC (FABLE_REVIEW2 item 2): frames in the face's ONE bold weight (lids .05 R, brows .07+ R), his brushy swell, never thin wire
  // PR2 (FABLE_REVIEW3 item 10): .058 R read as wire next to the head's .06 D outline and the brows at film head sizes; .085 R = the brows.
  const FW = .085;
  // ENG8 (FABLE_REVIEW4 item 2): rims + bridge in ONE uniform stroke of brow weight (RIM .092 R), round lenses a touch bigger (RR .168)
  // so the eye's own outline sits clear inside the rim (no nested double ring), arms thinner (.8 -> .4 FW) so they don't clutter small heads
  const RIM = .092, RR = .168;
  const W = (w, sd, taper = false) => brush(w, seed + sd, taper);
  for (const side of [-1, 1]) {
    const cu = side * eu, cv = ev;
    let rim, top = null;
    if (kind === 'round') rim = ring(cu, cv, RR * s, RR * s, 56);
    if (kind === 'square') rim = roundRect(cu, cv, .17 * s, .125 * s, .04 * s);
    if (kind === 'sun') { // a soft aviator drop: wider at the top, fuller at the bottom outer corner
      rim = spline2([[cu - side * .17 * s, cv - .1 * s], [cu, cv - .13 * s], [cu + side * .18 * s, cv - .1 * s], [cu + side * .17 * s, cv + .06 * s], [cu + side * .06 * s, cv + .16 * s], [cu - side * .1 * s, cv + .12 * s], [cu - side * .17 * s, cv + .02 * s]], true, 8);
    }
    // ENG10: cat-eye: a soft lens whose OUTER top corner sweeps up into a point (the tip doubled so the spline keeps it sharp), inner side
    // rounder and lower; one clean rim stroke like the others
    if (kind === 'cateye') {
      const o = side, tip = [cu + o * .215 * s, cv - .165 * s];
      rim = spline2([[cu - o * .165 * s, cv - .08 * s], [cu + o * .03 * s, cv - .115 * s], tip, tip, [cu + o * .19 * s, cv - .02 * s],
        [cu + o * .1 * s, cv + .1 * s], [cu - o * .03 * s, cv + .12 * s], [cu - o * .15 * s, cv + .07 * s], [cu - o * .175 * s, cv - .005 * s]], true, 8);
    }
    if (kind === 'oval') rim = ring(cu, cv, OV[0] * s, OV[1] * s, 56);   // ENG10: a wide soft oval (wider than tall), one clean stroke
    if (kind === 'half') { // readers: the flat top crosses the eye's middle, the frame below it
      const v0 = cv + .03 * s;
      rim = [...ring(cu, v0, .17 * s, .14 * s, 28, 0, Math.PI)].reverse();
      rim = [[cu + .17 * s, v0], ...rim.slice(1, -1), [cu - .17 * s, v0]];
      top = [[cu - .17 * s, v0], [cu + .17 * s, v0]];
    }
    const poly = rim.map(([u, v]) => [u * f, v]);
    if (kind === 'sun') {
      fill(out, poly, lens);
      // one glint, upper left of the lens (viewer's left is lit)
      strokeLine(out, [[cu - .09 * s, cv - .02 * s], [cu - .05 * s, cv - .07 * s], [cu + .0 * s, cv - .09 * s]].map(([u, v]) => [u * f, v]), W(.03, 9, true), 0xfbf6f3);
    }
    strokeLine(out, poly, RIM, frame, { closed: kind !== 'half' });   // ENG8: ONE clean uniform stroke (the swell read as a wobbly double line at 150-250 px)
    if (top) strokeLine(out, top.map(([u, v]) => [u * f, v]), W(FW * .8, side + 4), frame);
    // the arm: from the outer edge toward the ear, thinning as it leaves (it curves away with the sphere by itself)
    if (!arms) continue;
    const ou = side * (eu + (OUT_W[kind] ?? RR) * s), av = kind === 'half' ? ev + .04 * s : kind === 'cateye' ? ev - .1 * s : ev - .03 * s, ear = (kind === 'half' ? ev0 + .04 * s : ev0 - .03 * s) - .25 * low;
    strokeLine(out, [[ou, av], [side * (eu + .3 * s), av + (ear - av) * .45 - .015], [side * .7, ear]].map(([u, v]) => [u * f, v]), t => FW * .8 * (1 - .5 * t), frame);
  }
  // the bridge: a small arch between the lenses
  const bi = eu - (IN_W[kind] ?? RR) * s, bv = ev - (kind === 'half' ? -.04 : .03) * s;
  strokeLine(out, spline2([[-bi, bv], [0, bv - .045 * s], [bi, bv]], false, 8).map(([u, v]) => [u * f, v]), RIM * .9, frame);
  return out;
}

// ENG8: `low` (decal R units, + = down) slides the frames down the nose; the arms still reach the ear (they slant up). LOWERED = the
// 'lowered' state's slide (scaled by size / 1.3): the lens tops sit under the eyes, so the eyes show above the frames.
export const LOWERED = .24;
export function buildGlasses({ kind = 'round', colour, color, eyes = [.23, .02], size = 1.3, seed = 3, pull = .08, low = 0 } = {}) {
  if (!GLASSES_KINDS.includes(kind)) throw new Error(`glasses: unknown kind "${kind}" (${GLASSES_KINDS.join(', ')})`);
  const frame = new THREE.Color(color ?? colour ?? INK).getHex(), lens = kind === 'sun' ? 0x2d2228 : 0;
  const mesh = decalLayer(f => glassesTris(kind, f, { frame, lens, eyes, size, seed, low }), { name: 'glasses.' + kind + (low ? '.low' : ''), renderOrder: 22, pull, lift: .004 });
  mesh.update({ pose: [0, 0, 0], flip: 1 });
  return mesh;
}

// ENG8: the same glasses HELD in a hand: a flat front-on drawing (both lenses side by side, arms folded = not drawn), its own plane.
// Local space: D units, +X right, +Y up, the bridge at the origin, facing +Z. character.js turns it to face the camera every frame and
// puts it beside the drawn hand, so it never sits over one eye like an eye patch. `scale` .85 of the worn size.
export function buildHeldGlasses({ kind = 'round', colour, color, eyes = [.23, .02], size = 1.3, seed = 3, scale = .85 } = {}) {
  if (!GLASSES_KINDS.includes(kind)) throw new Error(`glasses: unknown kind "${kind}" (${GLASSES_KINDS.join(', ')})`);
  const frame = new THREE.Color(color ?? colour ?? INK).getHex(), lens = kind === 'sun' ? 0x2d2228 : 0;
  const tris = glassesTris(kind, 1, { frame, lens, eyes, size, seed, arms: false });
  const n = tris.length / 4 * 3, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), c = new THREE.Color();
  let k = 0;
  for (let i = 0; i < tris.length; i += 4) {
    c.set(tris[i + 3]);
    for (let j = 0; j < 3; j++) {
      pos[k * 3] = tris[i + j][0] * .5 * scale; pos[k * 3 + 1] = -(tris[i + j][1] - eyes[1]) * .5 * scale; pos[k * 3 + 2] = 0;
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; k++;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeBoundingSphere();
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, depthWrite: false, toneMapped: false });
  // pulled .6 D toward the camera in depth only (like the hats): a pair held at the chest by the far hand still draws over the torso
  mat.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n{ vec4 _c = projectionMatrix * vec4(mvPosition.xy, mvPosition.z + 0.6, 1.0); gl_Position.z = _c.z / _c.w * gl_Position.w; }"); };
  mat.customProgramCacheKey = () => "czheldglasses";
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'glasses.held.' + kind; mesh.renderOrder = 24; mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false; mesh.userData.noOutline = true; mesh.userData.halfW = (eyes[0] + .2 * size) * .5 * scale;
  return mesh;
}
