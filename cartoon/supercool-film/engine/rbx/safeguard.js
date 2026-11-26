// engine/rbx/safeguard.js (Roblox V4, V4-Z, 2026-11-12). Two systems for gruss's V3 items 3 and 5:
//  A. COPLANAR SAFEGUARD (runtime): after an rbx film's scene is built, every pair of surfaces that lie in the same plane (within
//     EPS) AND overlap in extent (z-fight candidates) is fixed: the smaller one is nudged NUDGE along the shared face's normal (toward
//     the side it is seen from), once; a piece that cannot move (InstancedMesh) or was already nudged gets a units-only polygonOffset
//     on its own copy of its material (never a slope factor: it pulls floor decals through rugs at grazing angles). Deterministic (scene
//     order, no randomness), every fix logged ("SAFEGUARD coplanar ..." in the page log). Scanned: what is visible at init (a set
//     piece shown only later by set.update is not); static props (no keys, no owner) on the first rendered frame.
//  B. COLLISION PROBE: globalThis.__rbxSG.collide() lists, for the frame just drawn, every rbx body part that goes deeper than TOL into
//     another character, a prop or a set piece (oriented boxes, SAT depth). Used by experiments/roblox-style/v4/tools/collide.mjs.
// Installed by ONE line in lab/stage.js init, only for rbx films (film name rbx_* or an rbx character); other films never import it.
// Docs: experiments/roblox-style/v4/DOCS_CHECKS.md.

export const EPS = .004;      // D: two parallel faces closer than this are "the same plane" (24-bit depth at 30 D away resolves ~.0005 D)
export const NUDGE = .01;     // D: how far a piece is moved off the plane it shared
export const TOL = .06;       // D: collisions shallower than this are contact, not interpenetration

const MAXTRI = 20000;         // meshes with more triangles are left out of the plane scan (imported models; their own faces never coincide)

export async function install(THREE, scene, ctx = {}) {
  const log = ctx.log || ((...a) => console.log(...a));
  const chars = ctx.chars || [], props = ctx.props || [];
  const charRoots = new Set(chars.map(c => c.ch.root)), propRoots = new Set(props.map(p => p.o));
  scene.updateMatrixWorld(true);
  const setMeshes = [];
  collect(scene, setMeshes, o => charRoots.has(o) || propRoots.has(o));
  const SG = { film: ctx.film, fixes: [], remaining: [], skipped: 0, propsDone: false, setBoxes: null };
  const run = (meshes, tag) => {
    for (let round = 0; round < 8; round++) {
      const pairs = findCoplanar(THREE, meshes, SG);
      if (!pairs.length) break;
      const fixedNow = new Set();
      for (const p of pairs) {
        if (fixedNow.has(p.mover.mesh) || fixedNow.has(p.other.mesh)) continue;   // one fix per mesh per round, then look again
        fixPair(THREE, p, SG, log, tag);
        fixedNow.add(p.mover.mesh);
      }
    }
    SG.remaining = findCoplanar(THREE, meshes, SG).map(describePair);
  };
  const T0 = Date.now();
  run(setMeshes, 'set');
  SG.ms = Date.now() - T0;
  log(`SAFEGUARD coplanar (set): ${SG.ms} ms, ${SG.fixes.length} fixes, ${SG.remaining.length} left, ${setMeshes.length} meshes scanned, ${SG.skipped} skipped (> ${MAXTRI} triangles)`);
  // static props: placed by the first frame; then set + props are scanned together (set pairs are already fixed)
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (...a) {
    if (prev) prev.apply(this, a);
    if (SG.propsDone) return;
    SG.propsDone = true;
    const stat = props.filter(p => !(p.def.keys || []).length && !p.def.owner && !String(p.def.in || '').startsWith('hand'));
    if (!stat.length) return;
    scene.updateMatrixWorld(true);
    const pm = []; for (const p of stat) collect(p.o, pm, () => false);
    const n0 = SG.fixes.length;
    run([...setMeshes, ...pm], 'prop');
    log(`SAFEGUARD coplanar (static props): ${SG.fixes.length - n0} fixes, ${SG.remaining.length} left`);
  };
  SG.coplanar = () => ({ fixes: SG.fixes, remaining: SG.remaining, skipped: SG.skipped, scanned: setMeshes.length });
  SG.collide = (opts = {}) => collideFrame(THREE, scene, chars, props, setMeshes, SG, opts, ctx.camera);
  globalThis.__rbxSG = SG;
  return SG;
}

// ---- helpers ------------------------------------------------------------------------------------------------------------------
function visibleChain(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }
function matOf(m) { return Array.isArray(m.material) ? m.material[0] : m.material; }
function collect(root, out, stop) {
  const walk = o => {
    if (o !== root && stop(o)) return;
    // left out: skinned meshes, and camera-facing sprite cards (InstancedBufferGeometry: their shader turns them to the camera every
    // frame, so their build-time planes mean nothing; their order is the sprite system's own alpha test / depth sort)
    if (o.isMesh && !o.isSkinnedMesh && !o.geometry?.isInstancedBufferGeometry && o.geometry?.attributes?.position && visibleChain(o)) {
      const mt = matOf(o);
      const sky = o.renderOrder <= -5 || mt?.depthTest === false || (o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere)).radius > 150;
      if (!sky && mt && mt.visible !== false && mt.colorWrite !== false) out.push(o);
    }
    for (const c of o.children) walk(c);
  };
  walk(root);
}
export function nameOf(o) {
  const bits = [];
  for (let p = o, i = 0; p && i < 4; p = p.parent, i++) if (p.name) bits.push(p.name);
  return (bits.join(' < ') || 'unnamed') + ` [${o.geometry?.type || 'mesh'}${o.isInstancedMesh ? ' x' + o.count : ''}]`;
}

// world matrices of a mesh (an InstancedMesh gives one per instance, capped)
function worldMats(THREE, m) {
  if (!m.isInstancedMesh) return [m.matrixWorld];
  const out = [], im = new THREE.Matrix4(), n = Math.min(m.count, 400);
  for (let i = 0; i < n; i++) { m.getMatrixAt(i, im); out.push(new THREE.Matrix4().multiplyMatrices(m.matrixWorld, im)); }
  return out;
}

// planar patches of one mesh: Map key -> { n (canonical unit), sign, d, area, tris (world, 9 numbers each) }
function patchesOf(THREE, m, SG) {
  const g = m.geometry, pos = g.attributes.position, idx = g.index;
  const triN = (idx ? idx.count : pos.count) / 3;
  const mats = worldMats(THREE, m);
  if (triN * mats.length > MAXTRI) { SG.skipped++; return null; }
  const P = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3();
  for (const M of mats) for (let t = 0; t < triN; t++) {
    const i0 = idx ? idx.getX(3 * t) : 3 * t, i1 = idx ? idx.getX(3 * t + 1) : 3 * t + 1, i2 = idx ? idx.getX(3 * t + 2) : 3 * t + 2;
    a.fromBufferAttribute(pos, i0).applyMatrix4(M); b.fromBufferAttribute(pos, i1).applyMatrix4(M); c.fromBufferAttribute(pos, i2).applyMatrix4(M);
    n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
    const area = n.length() / 2; if (area < 1e-6) continue;
    n.normalize();
    // canonical direction: the largest component positive
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z), big = ax >= ay && ax >= az ? n.x : ay >= az ? n.y : n.z, sign = big < 0 ? -1 : 1;
    const cx = n.x * sign, cy = n.y * sign, cz = n.z * sign, d = cx * a.x + cy * a.y + cz * a.z;
    const nk = `${Math.round(cx * 500)},${Math.round(cy * 500)},${Math.round(cz * 500)}`;
    const key = `${nk}|${sign}|${Math.round(d / EPS)}`;
    let p = P.get(key);
    if (!p) { p = { nk, n: [cx, cy, cz], sign, d, area: 0, tris: [] }; P.set(key, p); }
    p.area += area; p.tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  return P;
}

// 2D (in-plane) triangles + box of a patch
function flat2d(p) {
  const [nx, ny, nz] = p.n, ref = Math.abs(ny) < .9 ? [0, 1, 0] : [1, 0, 0];
  let ux = ref[1] * nz - ref[2] * ny, uy = ref[2] * nx - ref[0] * nz, uz = ref[0] * ny - ref[1] * nx; const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
  const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;
  const T = new Float64Array(p.tris.length / 3 * 2); const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0, j = 0; i < p.tris.length; i += 3, j += 2) {
    const x = p.tris[i], y = p.tris[i + 1], z = p.tris[i + 2], u = x * ux + y * uy + z * uz, v = x * vx + y * vy + z * vz;
    T[j] = u; T[j + 1] = v; box[0] = Math.min(box[0], u); box[1] = Math.min(box[1], v); box[2] = Math.max(box[2], u); box[3] = Math.max(box[3], v);
  }
  return { T, box };
}
// two 2D triangles overlap with positive area (separating axis, `m` = how far they must go into each other)
function triOverlap(A, i, B, j, m) {
  const ta = [A[i], A[i + 1], A[i + 2], A[i + 3], A[i + 4], A[i + 5]], tb = [B[j], B[j + 1], B[j + 2], B[j + 3], B[j + 4], B[j + 5]];
  for (const t of [ta, tb]) for (let e = 0; e < 3; e++) {
    const x0 = t[2 * e], y0 = t[2 * e + 1], x1 = t[(2 * e + 2) % 6], y1 = t[(2 * e + 3) % 6];
    let nx = y0 - y1, ny = x1 - x0; const l = Math.hypot(nx, ny); if (l < 1e-9) continue; nx /= l; ny /= l;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (let k = 0; k < 3; k++) { const pa = ta[2 * k] * nx + ta[2 * k + 1] * ny, pb = tb[2 * k] * nx + tb[2 * k + 1] * ny; a0 = Math.min(a0, pa); a1 = Math.max(a1, pa); b0 = Math.min(b0, pb); b1 = Math.max(b1, pb); }
    if (Math.min(a1, b1) - Math.max(a0, b0) < m) return false;
  }
  return true;
}
function patchesOverlap(fa, fb, m = .003) {
  const [a, b] = [fa.box, fb.box];
  const ow = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), oh = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  if (ow < m || oh < m) return 0;
  const na = fa.T.length / 6, nb = fb.T.length / 6;
  if (na * nb <= 40000) {
    let hit = false;
    outer: for (let i = 0; i < fa.T.length; i += 6) for (let j = 0; j < fb.T.length; j += 6) if (triOverlap(fa.T, i, fb.T, j, m)) { hit = true; break outer; }
    if (!hit) return 0;
  }
  return ow * oh;
}
const offOf = mt => mt && mt.polygonOffset ? [mt.polygonOffsetFactor || 0, mt.polygonOffsetUnits || 0] : [0, 0];
const offKey = m => offOf(matOf(m)).join(',');

export function findCoplanar(THREE, meshes, SG = { skipped: 0 }) {
  const buckets = new Map();
  meshes.forEach((m, mi) => {
    if (!visibleChain(m)) return;
    m.updateMatrixWorld(true);
    const mk = m.matrixWorld.elements.join(',');
    if (m.userData.sgP?.mk !== mk) m.userData.sgP = { mk, P: patchesOf(THREE, m, SG) };   // cached until the mesh moves
    const P = m.userData.sgP.P; if (!P) return;
    for (const p of P.values()) {
      if (p.area < 1e-4) continue;
      const e = { mesh: m, mi, ...p, src: p };
      const k = `${p.nk}|${Math.round(p.d / EPS)}`;
      (buckets.get(k) || buckets.set(k, []).get(k)).push(e);
    }
  });
  const pairs = [];
  for (const [k, list] of buckets) {
    const [nk, dq] = k.split('|');
    // the bucket itself + the next d bucket (two faces EPS apart can straddle a bucket edge); pairs inside the next bucket alone are
    // that bucket's own job
    const nb = buckets.get(`${nk}|${+dq + 1}`) || [];
    if (list.length + nb.length < 2 || (!nb.length && list.length < 2)) continue;
    const all = [...list.map(e => (e.nb = false, e)), ...nb.map(e => ({ ...e, nb: true }))];
    // every patch of one plane bucket in the same 2D basis (cached on the patch), then sweep and prune on the in-plane u range
    for (const e of all) e.src.f ||= flat2d(e.src);
    all.sort((a, b) => a.src.f.box[0] - b.src.f.box[0] || a.mi - b.mi);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length && all[j].src.f.box[0] <= all[i].src.f.box[2]; j++) {
      const A = all[i], B = all[j];
      if (A.nb && B.nb) continue;
      if (A.mesh === B.mesh) continue;
      if (Math.abs(A.d - B.d) > EPS) continue;
      const fa = A.src.f.box, fb = B.src.f.box; if (fa[1] > fb[3] || fb[1] > fa[3]) continue;
      const ma = matOf(A.mesh), mb = matOf(B.mesh);
      if (A.sign !== B.sign && ma.side !== THREE.DoubleSide && mb.side !== THREE.DoubleSide) continue;   // back to back: never both seen
      if (ma.depthWrite === false && mb.depthWrite === false) continue;                                     // neither writes depth: blended, no fight
      if (offKey(A.mesh) !== offKey(B.mesh)) continue;                                                       // different depth offsets: one always wins
      const oc = A.src.ov || (A.src.ov = new Map());   // overlap remembered per patch pair (both patches are rebuilt when a mesh moves)
      let ov = oc.get(B.src); if (ov === undefined) { ov = patchesOverlap(A.src.f, B.src.f); oc.set(B.src, ov); }
      if (!ov) continue;
      // the mover: the smaller patch (ties: later in the scene)
      const [mover, other] = A.area < B.area || (A.area === B.area && A.mi > B.mi) ? [A, B] : [B, A];
      pairs.push({ mover, other, overlap: ov });
    }
  }
  pairs.sort((a, b) => a.mover.mi - b.mover.mi || a.other.mi - b.other.mi);
  return pairs;
}

function describePair(p) {
  return { mover: nameOf(p.mover.mesh), other: nameOf(p.other.mesh), n: p.mover.n.map(v => +(v * p.mover.sign).toFixed(3)), d: +p.mover.d.toFixed(3), overlap: +p.overlap.toFixed(4) };
}

function fixPair(THREE, p, SG, log, tag) {
  const m = p.mover.mesh, n = p.mover.n.map(v => v * p.mover.sign);
  // Every piece (solid or a thin decal / card) is NUDGED off the plane, once. polygonOffset only for what cannot move (an instanced
  // mesh) or a piece already nudged (a second nudge on another face could undo the first). polygonOffset is units-only (factor 0): a
  // slope factor pulls a floor decal through a rug lying a few mm above it at grazing camera angles (seen in rbx_whistle f626, V4-Z).
  const cantMove = m.isInstancedMesh || m.userData.sgNudged;
  let how;
  if (cantMove) {
    // its own material copy, depth-offset 4 units more than the surface it shared a plane with (pulled toward the camera)
    if (!m.userData.sgOwnMat) { m.material = Array.isArray(m.material) ? m.material.map(x => x.clone()) : m.material.clone(); m.userData.sgOwnMat = true; }
    const [of, ou] = offOf(matOf(p.other.mesh));
    for (const mt of Array.isArray(m.material) ? m.material : [m.material]) { const [f0, u0] = offOf(mt); mt.polygonOffset = true; mt.polygonOffsetFactor = Math.min(f0, of); mt.polygonOffsetUnits = Math.min(u0, ou - 4); mt.needsUpdate = true; }
    how = 'polygonOffset';
  } else {
    m.userData.sgNudged = true;
    // a solid piece: moved NUDGE toward where the shared face points (in world), converted into the parent's space
    const w0 = new THREE.Vector3().setFromMatrixPosition(m.matrixWorld), w1 = w0.clone().add(new THREE.Vector3(...n).multiplyScalar(NUDGE));
    if (m.parent) { m.parent.updateMatrixWorld(true); m.parent.worldToLocal(w0); m.parent.worldToLocal(w1); }
    m.position.add(w1.sub(w0));
    m.updateMatrix(); m.updateMatrixWorld(true);
    how = `nudged ${NUDGE} D`;
  }
  const row = { tag, how, ...describePair(p) };
  SG.fixes.push(row);
  if (SG.fixes.length <= 60) log(`SAFEGUARD coplanar fix (${tag}): ${how}: ${row.mover} over ${row.other} n(${row.n.join(',')}) d ${row.d} overlap ${row.overlap} D2`);
}

// ---- B. collisions (oriented boxes, separating axis with depth) ----------------------------------------------------------------
function obbOf(THREE, m, M, bb) {
  const c = new THREE.Vector3(), ax = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], h = [0, 0, 0];
  const e = M.elements;
  for (let i = 0; i < 3; i++) { ax[i].set(e[4 * i], e[4 * i + 1], e[4 * i + 2]); const s = ax[i].length() || 1; ax[i].divideScalar(s); h[i] = (bb.max.getComponent(i) - bb.min.getComponent(i)) / 2 * s; }
  c.set((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2).applyMatrix4(M);
  return { c, ax, h, m };
}
function aabbOf(o) { let r = [0, 0, 0]; for (let i = 0; i < 3; i++) r[i] = Math.abs(o.ax[0].getComponent(i)) * o.h[0] + Math.abs(o.ax[1].getComponent(i)) * o.h[1] + Math.abs(o.ax[2].getComponent(i)) * o.h[2];
  return [o.c.x - r[0], o.c.y - r[1], o.c.z - r[2], o.c.x + r[0], o.c.y + r[1], o.c.z + r[2]]; }
const boxHit = (a, b) => a[0] <= b[3] && b[0] <= a[3] && a[1] <= b[4] && b[1] <= a[4] && a[2] <= b[5] && b[2] <= a[5];
function sat(THREE, A, B) {
  const T = new THREE.Vector3().subVectors(B.c, A.c), axes = [...A.ax, ...B.ax];
  for (const a of A.ax) for (const b of B.ax) { const x = new THREE.Vector3().crossVectors(a, b); if (x.lengthSq() > 1e-6) axes.push(x.normalize()); }
  let best = Infinity, bestAx = null;
  for (const L of axes) {
    const ra = A.h[0] * Math.abs(A.ax[0].dot(L)) + A.h[1] * Math.abs(A.ax[1].dot(L)) + A.h[2] * Math.abs(A.ax[2].dot(L));
    const rb = B.h[0] * Math.abs(B.ax[0].dot(L)) + B.h[1] * Math.abs(B.ax[1].dot(L)) + B.h[2] * Math.abs(B.ax[2].dot(L));
    const o = ra + rb - Math.abs(T.dot(L));
    if (o <= 0) return null;
    if (o < best) { best = o; bestAx = L; }
  }
  return { depth: best, axis: bestAx };
}
function localBox(THREE, o) {
  // a group (the rbx head): its meshes' boxes in the group's space (cached), thin decals left out
  if (o.userData.sgBox) return o.userData.sgBox;
  const bb = new THREE.Box3(), inv = new THREE.Matrix4().copy(o.matrixWorld).invert(), tmp = new THREE.Box3();
  o.updateMatrixWorld(true);
  o.traverse(m => { if (!m.isMesh || !m.geometry?.attributes?.position) return; if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const s = m.geometry.boundingBox.getSize(new THREE.Vector3()); if (Math.min(s.x, s.y, s.z) < .01 && m !== o) return;
    tmp.copy(m.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); bb.union(tmp); });
  o.userData.sgBox = bb.isEmpty() ? null : bb; return o.userData.sgBox;
}
const SKIP_PART = /^(headApi|neck)$/;
function partBoxes(THREE, ch) {
  const out = [];
  if (!visibleChain(ch.root)) return out;
  const entries = ch.parts ? Object.entries(ch.parts) : [];
  for (const [k, o] of entries) {
    if (!o || !o.isObject3D || SKIP_PART.test(k) || !visibleChain(o)) continue;
    o.updateMatrixWorld(true);
    let bb;
    if (o.isMesh) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); bb = o.geometry.boundingBox; } else bb = localBox(THREE, o);
    if (!bb) continue;
    const b = obbOf(THREE, o, o.matrixWorld, bb); b.part = k; out.push(b);
  }
  if (!out.length) {   // a card body or anything without parts: its whole bounds
    const bb = new THREE.Box3().setFromObject(ch.root); if (!bb.isEmpty()) { const b = obbOf(THREE, ch.root, new THREE.Matrix4(), bb); b.part = 'body'; out.push(b); }
  }
  return out;
}
function setBoxes(THREE, setMeshes, SG) {
  if (SG.setBoxes) return SG.setBoxes;
  const list = [], grid = new Map(), cell = 2, uncovered = [];
  for (const m of setMeshes) {
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox; if (bb.isEmpty()) continue;
    const nv = m.geometry.attributes.position.count;
    for (const M of worldMats(THREE, m)) {
      const o = obbOf(THREE, m, M, bb), mx = Math.max(...o.h) * 2, mn = Math.min(...o.h) * 2;
      if (mn < .02) continue;                         // decal / card / painted plane: allowed
      if (mx < .12) continue;                         // a small corner detail: allowed
      if (!isBox(m.geometry)) {   // not a box: its box is not its shape (a sofa, a car, a room shell): tested triangle by triangle
        const tm = triMesh(THREE, m, M); if (!tm) { uncovered.push(nameOf(m)); continue; }
        Object.assign(o, tm);
      }
      o.name = nameOf(m); o.aabb = o.tri ? o.taabb : aabbOf(o); list.push(o);
      const a = o.aabb;
      for (let x = Math.floor(a[0] / cell); x <= Math.floor(a[3] / cell); x++) for (let z = Math.floor(a[2] / cell); z <= Math.floor(a[5] / cell); z++) {
        const k = x + ',' + z; (grid.get(k) || grid.set(k, []).get(k)).push(o);
      }
    }
  }
  SG.setBoxes = { list, grid, cell, uncovered: [...new Set(uncovered)] };
  return SG.setBoxes;
}
// a geometry is a plain box when every vertex sits on a corner of its bounding box (merged cards / quads spread over a room are not)
function isBox(g) {
  if (g.userData?.sgIsBox !== undefined) return g.userData.sgIsBox;
  const p = g.attributes.position, bb = g.boundingBox; let ok = p.count <= 24;
  const near = (v, a, b) => Math.abs(v - a) < 1e-4 || Math.abs(v - b) < 1e-4;
  for (let i = 0; ok && i < p.count; i++) ok = near(p.getX(i), bb.min.x, bb.max.x) && near(p.getY(i), bb.min.y, bb.max.y) && near(p.getZ(i), bb.min.z, bb.max.z);
  g.userData = g.userData || {}; g.userData.sgIsBox = ok; return ok;
}
// a non-box mesh as world triangles (+ each triangle's box), up to 30000 triangles
function triMesh(THREE, m, M) {
  const g = m.geometry, pos = g.attributes.position, idx = g.index, n = (idx ? idx.count : pos.count) / 3;
  if (n > 30000) return null;
  const tri = new Float32Array(n * 9), tb = new Float32Array(n * 6), v = new THREE.Vector3(), all = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) {
    v.fromBufferAttribute(pos, idx ? idx.getX(3 * t + k) : 3 * t + k).applyMatrix4(M);
    tri.set([v.x, v.y, v.z], t * 9 + k * 3);
    for (let i = 0; i < 3; i++) { const x = v.getComponent(i);
      if (k === 0 || x < tb[t * 6 + i]) tb[t * 6 + i] = x; if (k === 0 || x > tb[t * 6 + 3 + i]) tb[t * 6 + 3 + i] = x;
      all[i] = Math.min(all[i], x); all[3 + i] = Math.max(all[3 + i], x); }
  }
  return { tri, tb, taabb: all };
}
// a part box against a triangle mesh: the deepest crossing of the box through one of its triangles (r - |s| along the triangle's
// normal, the shallower side), with that normal; null if the box touches no triangle
function triDepth(THREE, A, o) {
  const a = A.aabb, T = o.tri, B = o.tb, ax = A.ax, h = A.h, c = A.c;
  let best = null;
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), e0 = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nn = new THREE.Vector3(), L = new THREE.Vector3();
  // overlap of box and triangle along L (<= 0: separated); the smallest over all 13 axes = how far the box must move to come free
  let mo, mAx = new THREE.Vector3(), mSide = 1;
  const ovl = (L) => { const l = L.length(); if (l < 1e-6) return Infinity; L.divideScalar(l);
    const r = h[0] * Math.abs(ax[0].dot(L)) + h[1] * Math.abs(ax[1].dot(L)) + h[2] * Math.abs(ax[2].dot(L)), cc = c.dot(L);
    const q0 = p0.dot(L), q1 = p1.dot(L), q2 = p2.dot(L), lo = Math.min(q0, q1, q2), hi = Math.max(q0, q1, q2);
    const up = hi - (cc - r), dn = (cc + r) - lo, o = Math.min(up, dn);   // up: push the box toward +L
    if (o < mo) { mo = o; mAx.copy(L); mSide = up < dn ? 1 : -1; }
    return o; };
  for (let t = 0, nT = T.length / 9; t < nT; t++) {
    const j = t * 6; if (B[j] > a[3] || B[j + 3] < a[0] || B[j + 1] > a[4] || B[j + 4] < a[1] || B[j + 2] > a[5] || B[j + 5] < a[2]) continue;
    p0.fromArray(T, t * 9); p1.fromArray(T, t * 9 + 3); p2.fromArray(T, t * 9 + 6);
    e0.subVectors(p1, p0); e1.subVectors(p2, p1); e2.subVectors(p0, p2); nn.crossVectors(e0, e1);
    if (nn.lengthSq() < 1e-12) continue;
    mo = Infinity;
    if (ovl(nn.clone()) <= 0 || ovl(ax[0].clone()) <= 0 || ovl(ax[1].clone()) <= 0 || ovl(ax[2].clone()) <= 0) continue;
    let out = false;
    for (const e of [e0, e1, e2]) { for (const u of ax) if (ovl(L.crossVectors(e, u)) <= 0) { out = true; break; } if (out) break; }
    if (out) continue;
    if (!best || mo > best.depth) best = { depth: mo, axis: mAx.clone().multiplyScalar(mSide) };
  }
  return best;
}
function propBoxes(THREE, p) {
  const out = []; if (!visibleChain(p.o)) return out;
  p.o.updateMatrixWorld(true);
  const ms = []; p.o.traverse(m => { if (m.isMesh && m.geometry?.attributes?.position && visibleChain(m)) ms.push(m); });
  const use = ms.length > 40 ? [p.o] : ms;
  for (const m of use) {
    let bb, M;
    if (m.isMesh) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); bb = m.geometry.boundingBox; M = m.matrixWorld; }
    else { bb = new THREE.Box3().setFromObject(m); M = new THREE.Matrix4(); }
    if (bb.isEmpty()) continue;
    const o = obbOf(THREE, m, M, bb); if (Math.min(...o.h) * 2 < .02 && use !== ms) continue;
    if (Math.min(...o.h) * 2 < .015) continue;
    if (m.isMesh && !isBox(m.geometry)) { const tm = triMesh(THREE, m, M); if (tm) Object.assign(o, tm); }
    o.name =(p.def.id || p.def.kind) + (m.name ? ':' + m.name : ''); out.push(o);
  }
  return out;
}

function collideFrame(THREE, scene, chars, props, setMeshes, SG, opts, camera) {
  const tol = opts.tol ?? TOL, rows = [];
  scene.updateMatrixWorld(true);
  const S = setBoxes(THREE, setMeshes, SG);
  const C = chars.map(c => { const bx = partBoxes(THREE, c.ch); bx.forEach(b => b.aabb = aabbOf(b)); const all = bx.length ? bx.map(b => b.aabb).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[3], b[3]), Math.max(a[4], b[4]), Math.max(a[5], b[5])]) : null;
    return { name: c.def.name || c.ch.id, id: c.ch.id, bx, all }; });
  const P = props.map(p => { const bx = propBoxes(THREE, p); bx.forEach(b => b.aabb = b.tri ? b.taabb : aabbOf(b)); return { p, bx, holder: p.o.userData.holder }; });
  const screen = v => { if (!camera) return null; const s = v.clone().project(camera); if (s.z > 1 || Math.abs(s.x) > 1.1 || Math.abs(s.y) > 1.1) return null; return [+((s.x + 1) / 2).toFixed(3), +((1 - s.y) / 2).toFixed(3)]; };
  const push = (who, b, kind, other, o, h) => {
    if (h.depth < tol) return;
    // standing / sitting / leaning on something: a near-vertical push with the part above the other, not deep
    const vert = Math.abs(h.axis.y) > .8, above = o.tri ? h.axis.y > 0 : b.c.y > o.c.y;
    const rest = vert && above && h.depth < .18;
    const mid = o.tri ? b.c.clone() : b.c.clone().add(o.c).multiplyScalar(.5);
    rows.push({ who, part: b.part, kind, other, depth: +h.depth.toFixed(3), rest, at: mid.toArray().map(v => +v.toFixed(2)), scr: screen(mid) });
  };
  for (let i = 0; i < C.length; i++) {
    const A = C[i]; if (!A.all) continue;
    for (let j = i + 1; j < C.length; j++) { const B = C[j]; if (!B.all || !boxHit(A.all, B.all)) continue;
      for (const a of A.bx) for (const b of B.bx) if (boxHit(a.aabb, b.aabb)) { const h = sat(THREE, a, b); if (h) push(A.name, a, 'char', B.name + '.' + b.part, b, h); } }
    for (const q of P) { if (q.holder && (q.holder === A.name || q.holder === A.id)) continue;
      for (const pb of q.bx) { if (!boxHit(A.all, pb.aabb)) continue; for (const a of A.bx) if (boxHit(a.aabb, pb.aabb)) { const h = pb.tri ? triDepth(THREE, a, pb) : sat(THREE, a, pb); if (h) push(A.name, a, 'prop', pb.name, pb, h); } } }
    const cand = new Set(), a0 = A.all;
    for (let x = Math.floor(a0[0] / S.cell); x <= Math.floor(a0[3] / S.cell); x++) for (let z = Math.floor(a0[2] / S.cell); z <= Math.floor(a0[5] / S.cell); z++) for (const o of S.grid.get(x + ',' + z) || []) cand.add(o);
    for (const o of cand) { if (!boxHit(a0, o.aabb) || !visibleChain(o.m)) continue; for (const a of A.bx) if (boxHit(a.aabb, o.aabb)) { const h = o.tri ? triDepth(THREE, a, o) : sat(THREE, a, o); if (h) push(A.name, a, 'set', o.name, o, h); } }
  }
  return { rows, uncovered: S.uncovered.length };
}
