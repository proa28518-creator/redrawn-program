// engine/rbx/body.js: the Roblox body's parts (WP-C1, 2026-11-12). R15 layout, 1 stud = STUD D (5.2 studs = 3.0 D standing).
// Every part is a SLAB: a side profile (a rounded rectangle in the part's y-z plane) extruded along x with a bevel on its x edges.
// Limb profiles are stadiums (radius = half the depth) whose round ends are centred ON the joints: two parts that meet at a joint share a
// half-cylinder about the hinge axis, so a bent elbow / knee never opens a gap or shows a notch. Smooth normals everywhere (the bevel
// and the ends are real geometry, not normal tricks), a baked `ao` attribute (joint bands, under the head).
// Built in code (not Blender): no loading, deterministic, and the joint geometry is exactly what the IK assumes.
export const STUD = 3.0 / 5.2;

// slab(THREE, { w, d, y0, y1, rt, rb, b, seg, aoFn }) -> BufferGeometry. Profile: z in [-d/2, d/2], y in [y0, y1] (y1 > y0), top corners
// radius rt, bottom corners rb (each <= d/2), x in [-w/2, w/2] with bevel b. aoFn(x, y, z, nx, ny, nz) -> 0..1 (default 1).
export function slab(THREE, o) {
  const { w, d, y0, y1 } = o, h = d / 2, rt = Math.min(o.rt ?? .08, h), rb = Math.min(o.rb ?? .08, h), b = Math.min(o.b ?? .07, w / 2 - 1e-3, rt || 1, rb || 1);
  const seg = o.seg ?? 10, bs = o.bevelSeg ?? 3;
  // the profile, counter-clockwise seen from +x: points (y, z) and outward normals (ny, nz)
  const P = [];
  // CF1: each profile point also carries an EDGE weight (the shader's thin bevel highlight): small corner arcs peak mid-corner,
  // the big stadium ends of limbs (radius = half the depth) are surfaces, not edges (0)
  const arc = (cy, cz, r, a0, a1) => { const ew = r < h * .62 ? 1 : 0; for (let i = 0; i <= seg; i++) { const a = a0 + (a1 - a0) * i / seg; P.push([cy + r * Math.sin(a), cz + r * Math.cos(a), Math.sin(a), Math.cos(a), ew * Math.sin(Math.PI * i / seg)]); } };
  const line = (ya, za, yb, zb, ny, nz, n) => { for (let i = 1; i < n; i++) { const k = i / n; P.push([ya + (yb - ya) * k, za + (zb - za) * k, ny, nz, 0]); } };
  // top front corner -> top -> top back corner -> back -> bottom back -> bottom -> bottom front -> front
  arc(y1 - rt, h - rt, rt, 0, Math.PI / 2);                 // front-top corner, from facing +z to facing +y
  line(y1, h - rt, y1, -h + rt, 1, 0, Math.max(1, Math.round((d - 2 * rt) / .12)));
  arc(y1 - rt, -h + rt, rt, Math.PI / 2, Math.PI);           // top-back corner
  line(y1 - rt, -h, y0 + rb, -h, 0, -1, Math.max(2, Math.round((y1 - y0 - rt - rb) / .08)));
  arc(y0 + rb, -h + rb, rb, Math.PI, Math.PI * 1.5);         // bottom-back
  line(y0, -h + rb, y0, h - rb, -1, 0, Math.max(1, Math.round((d - 2 * rb) / .12)));
  arc(y0 + rb, h - rb, rb, Math.PI * 1.5, Math.PI * 2);      // bottom-front
  line(y0 + rb, h, y1 - rt, h, 0, 1, Math.max(2, Math.round((y1 - y0 - rt - rb) / .08)));
  const n = P.length;
  // rings across x: bevel arc on -x (phi 0 -> pi/2), bevel arc on +x (pi/2 -> 0)
  const ring = [];
  for (let i = 0; i <= bs; i++) { const f = Math.PI / 2 * i / bs; ring.push([-(w / 2 - b) - b * Math.cos(f), Math.sin(f), -Math.cos(f)]); }
  for (let i = bs; i >= 0; i--) { const f = Math.PI / 2 * i / bs; ring.push([(w / 2 - b) + b * Math.cos(f), Math.sin(f), Math.cos(f)]); }
  const pos = [], nor = [], ao = [], edge = [], idx = [];
  const aoFn = o.aoFn || (() => 1);
  const push = (x, y, z, nx, ny, nz, e = 0) => { pos.push(x, y, z); nor.push(nx, ny, nz); ao.push(aoFn(x, y, z, nx, ny, nz)); edge.push(e); return pos.length / 3 - 1; };
  for (const [x, s, nx] of ring) for (const [y, z, ny, nz, pe] of P) push(x, y - ny * b * (1 - s), z - nz * b * (1 - s), nx, ny * s, nz * s, Math.max(pe, 2 * s * Math.abs(nx)));   // x bevel: sin 2f, peaks mid-bevel
  for (let r = 0; r < ring.length - 1; r++) for (let i = 0; i < n; i++) {
    const a = r * n + i, bq = r * n + (i + 1) % n, c = (r + 1) * n + i, e = (r + 1) * n + (i + 1) % n;
    idx.push(a, c, bq, bq, c, e);
  }
  // caps: the inset profile at x = -w/2 and +w/2, a fan from the centre (the profile is convex)
  const cy = (y0 + y1) / 2;
  for (const side of [-1, 1]) {
    const x = side * w / 2, c0 = push(x, cy, 0, side, 0, 0), first = pos.length / 3;
    for (const [y, z, ny, nz] of P) push(x, y - ny * b, z - nz * b, side, 0, 0, 0);
    for (let i = 0; i < n; i++) { const a = first + i, bq = first + (i + 1) % n; if (side < 0) idx.push(c0, a, bq); else idx.push(c0, bq, a); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('ao', new THREE.Float32BufferAttribute(ao, 1));
  g.setAttribute('edge', new THREE.Float32BufferAttribute(edge, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// a short cylinder (the neck), ao darker at the bottom
export function neckGeo(THREE, r, y0, y1) {
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, 24, 2, true); g.translate(0, (y0 + y1) / 2, 0);
  const p = g.attributes.position, a = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) a[i] = .62 + .3 * Math.min(1, Math.max(0, (p.getY(i) - y0) / (y1 - y0)));
  g.setAttribute('ao', new THREE.BufferAttribute(a, 1));
  return g;
}

const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

// The R15 layout in studs (ground origin, +y up). Pivots: hip line y 2.0 (= the hem), shoulders y 3.5, neck y 4.0.
// Limbs hang along -y from their pivot; segment lengths so a standing leg is ~straight (the IK's soft angle keeps a hint of bend).
export function layout(o = {}) {
  const k = o.build || {};
  const L = {
    hipY: 2.0, hipX: .5, shoulderY: 3.5, shoulderX: 1.5, neckY: 4.0, ankleY: .16,
    torsoW: 2.0 * (k.torso ?? 1), torsoD: 1.0, lowerH: .4, upperH: 1.6,
    limbW: 1.0 * (k.limb ?? 1), limbD: 1.0 * (k.limb ?? 1),
    // CF1 (Review 1 fix 4): arms a little slimmer than the legs (they read thicker than R15 next to the 2-stud torso), the shoulder
    // socket pulled in so the arm touches the torso side; hands smaller than the forearm (the waving hand read head sized)
    armW: .86 * (k.limb ?? 1), armD: .86 * (k.limb ?? 1),
    legSeg: .93, armSeg: .93,           // thigh = shin, upper arm = forearm (shoulder -> hand centre = 1.86)
    handH: .34, footH: .32, footD: 1.12,
    // the lower part of a limb is this much narrower than the upper: their round joint ends overlap, and two side caps in ONE plane
    // z-fought (the "fan" pattern on forearms and shins in Review 1)
    lowerK: .955,
  };
  L.shoulderX = L.torsoW / 2 + L.armW / 2 + .01;
  L.legLen = L.legSeg * 2; L.armLen = L.armSeg * 2;
  return L;
}

// build every body part (geometry in the part's own frame: pivot at the origin, the limb along -y, its hinge axis x, its front +z).
// -> { meshes: { name: Mesh }, L }  names: torsoU torsoL neck armUR armLR handR armUL armLL handL legUR legLR footR legUL legLL footL
export function buildBody(THREE, colours, matFor, o = {}) {
  const L = layout(o), s = o.s ?? STUD, M = {};
  const C = colours;
  const mk = (name, geo, col) => { const m = new THREE.Mesh(geo, matFor(col, name)); m.name = 'rbx.' + name; m.matrixAutoUpdate = false; m.frustumCulled = false; M[name] = m; return m; };
  const R = L.limbD / 2;
  // joint AO: a soft band around each hinge end (the crease where two parts meet), stronger on the inside of the joint
  const jointAo = (yTop, yBot) => (x, y, z) => {
    const dT = Math.abs(y - yTop), dB = Math.abs(y - yBot);
    const a = 1 - .22 * (1 - sm(0, R * 1.15, Math.min(dT, dB) - R * .15));
    return Math.max(.66, a);
  };
  // limbs: stadium profile, round ends centred on both joints (y 0 and y -seg). CF1: bevel .11 stud (was .075: the edges barely
  // showed); AO between the legs (the inner side of each thigh, darker up at the crotch)
  const RA = L.armD / 2, lk = L.lowerK, BV = .11 * s;
  const innerAo = (sd, yTop) => (x, y) => 1 - .16 * sm(0, .5 * s, x * (sd === 'R' ? 1 : -1)) * (1 - sm(0, .7 * s, yTop - y));
  const limb = (seg, w, d, r, sd, crotch) => slab(THREE, { w: w * s, d: d * s, y0: (-seg - r) * s, y1: r * s, rt: r * s, rb: r * s, b: BV, seg: 12,
    aoFn: (x, y, z) => jointAo(0, -seg * s)(x, y, z) * (crotch ? innerAo(sd, 0)(x, y) : 1) });
  for (const sd of ['R', 'L']) {
    mk('armU' + sd, limb(L.armSeg, L.armW, L.armD, RA, sd, false), C.arms);
    // the forearm stops above the hand: its lower round end is centred on the wrist (hand top), the hand hangs below it
    // (rigid with the hand: its bottom ends just inside the hand, a small rounding, no hinge there)
    mk('armL' + sd, slab(THREE, { w: L.armW * lk * s, d: L.armD * lk * s, y0: (-L.armSeg + L.handH / 2 - .1) * s, y1: RA * lk * s, rt: RA * lk * s, rb: .2 * s, b: BV, seg: 12, aoFn: jointAo(0, 99) }), C.forearms || C.arms);
    mk('hand' + sd, slab(THREE, { w: L.armW * .86 * s, d: L.armD * .86 * s, y0: -L.handH / 2 * s - .02 * s, y1: (L.handH / 2 + .12) * s, rt: .12 * s, rb: .15 * s, b: .09 * s, seg: 6,
      aoFn: (x, y) => .78 + .22 * sm(L.handH / 2 * s + .06 * s, -L.handH / 2 * s * .2, y) }), C.hands || C.skin);
    mk('legU' + sd, limb(L.legSeg, L.limbW, L.limbD, R, sd, true), C.legs);
    // shin: round knee end; its bottom ends just under the ankle, inside the foot
    mk('legL' + sd, slab(THREE, { w: L.limbW * lk * s, d: L.limbD * lk * s, y0: (-L.legSeg - .06) * s, y1: R * lk * s, rt: R * lk * s, rb: .2 * s, b: BV, seg: 12, aoFn: jointAo(0, 99) }), C.shins || C.legs);
    // foot: pivot = the ankle; the block runs from just under the ankle to the sole, toe forward
    mk('foot' + sd, slab(THREE, { w: L.limbW * .98 * s, d: L.footD * s, y0: -(L.ankleY) * s, y1: (L.footH - L.ankleY + .12) * s, rt: .16 * s, rb: .07 * s, b: .09 * s, seg: 6,
      aoFn: (x, y) => .8 + .2 * sm(0, L.footH * .5 * s, y + L.ankleY * s) }), C.shoes || C.legs);
    M['foot' + sd].geometry.translate(0, 0, .08 * s);
  }
  // lower torso: hem space, y from the hip line - .02 to +lowerH; slightly rounded
  // (a touch wider and deeper than the upper torso, and tall enough that the waist bend's overlap stays inside it)
  mk('torsoL', slab(THREE, { w: (L.torsoW + .05) * s, d: (L.torsoD + .05) * s, y0: -.05 * s, y1: (L.lowerH + .22) * s, rt: .12 * s, rb: .22 * s, b: .12 * s, seg: 6,
    aoFn: (x, y) => .8 + .2 * sm(.0, .25 * s, y) }), C.pants || C.legs);
  // upper torso: hem space; its bottom (rounded) starts on the hip line inside the lower torso, so a waist bend never opens a gap.
  // CF1: a stronger, wider soft contact shadow under the chin (top centre)
  const top = (L.neckY - L.hipY) * s;
  mk('torsoU', slab(THREE, { w: L.torsoW * s, d: L.torsoD * s, y0: .06 * s, y1: top, rt: .16 * s, rb: .3 * s, b: .12 * s, seg: 12,
    aoFn: (x, y, z) => 1 - .38 * (1 - sm(0, .34 * s, top - y)) * (1 - sm(.35 * s, .95 * s, Math.hypot(x, z * 1.4)))
      - .1 * (1 - sm(0, .5 * s, y - (L.lowerH - .1) * s)) }), C.torso);
  // CF1 (Review 1 fix 3): the neck only fills the gap a tilted head opens; it stops well under the head's lower edge (it went through the chin)
  // V4-HF: taller (top .40 studs, well inside the head at rest): the head now rocks on its neck joint (character.js neckHead), and the gap
  // that opens under the raised back of the head on a nod must show this neck, never its open top or the sky
  mk('neck', neckGeo(THREE, .3 * s, -.25 * s, .40 * s), C.skin);
  return { meshes: M, L };
}

export default { STUD, slab, layout, buildBody };
