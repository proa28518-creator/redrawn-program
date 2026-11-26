// hairline.js: a hairline from PARAMETERS, no video. Output is exactly what head.js reads from its track
// ({ hair, hi, axis, e1, e2 }), so head.js draws it unchanged (pass it as head params `track`, see hair.js).
//
//   hairline({ style, seed, front, back, temple, ear, scallop, part, ... }) -> { verts, hair, hi, axis, e1, e2, style, n }
//
// Globe: anchors are [yaw, pitch] degrees in head space. yaw 0 pitch 0 = the front of the face (+Z), yaw + toward +X (the
// character's LEFT, viewer's right when he faces us), yaw 180 = the back, pitch 90 = the top, pitch + up.
// Anchor = { y, p, sharp, e, a }: sharp = a corner (the spline stops there), e = edge noise on the stretch to the next anchor
// ('scallop' round clumps with cusps, 'jag' pointed tufts, 'wave' soft, 'none'), a = its amplitude in degrees.
// The loop is a spline on the sphere, the edge noise is hashed from `seed` (same seed = same hair), then resampled under 120 verts.
// Style rules (STYLE_BIBLE section 4): one mass on the upper back, flush with the head, lower edge never straight, the back covers
// the upper 2/3 (back pitch about -10).

const D2R = Math.PI / 180;
const vec = (y, p) => [Math.sin(y * D2R) * Math.cos(p * D2R), Math.sin(p * D2R), Math.cos(y * D2R) * Math.cos(p * D2R)];
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
// hashed noise: same seed, same hair
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// ---------- the styles: anchor loops ----------
// A cap: front edge across the forehead, temples, sideburns in front of the ears, around the back. Mirrored unless `left` given.
function capLoop(o) {
  const { front = 42, temple = [62, 37], ear = [88, -2], back = -10, frontEdge = ['wave', 1.2], sideEdge = ['scallop', 2.6], backEdge = ['scallop', 3.2] } = o;
  const pts = [[0, front], [30, front - 1], [temple[0], temple[1], 1], [(temple[0] + ear[0]) / 2 + 4, (temple[1] + ear[1]) / 2], [ear[0], ear[1], 1],
    [128, back + 2], [180, back], [-128, back + 2], [-ear[0], ear[1], 1], [-(temple[0] + ear[0]) / 2 - 4, (temple[1] + ear[1]) / 2],
    [-temple[0], temple[1], 1], [-30, front - 1]];
  // the stretch from anchor i to i+1: front, front, side, side, back x4, side, side, front, front
  const kind = [frontEdge, frontEdge, sideEdge, sideEdge, backEdge, backEdge, backEdge, backEdge, sideEdge, sideEdge, frontEdge, frontEdge];
  return pts.map(([y, p, sh], i) => ({ y, p, sharp: !!sh, e: kind[i][0], a: kind[i][1] }));
}

const cov = o => o.coverage ?? 1;
// bun / ponytail: pulled back off the face, the line a soft curve: front pitch 50 -> 33, temples 38 -> 16 (about the brow), ear 2 -> -6
function tied(o, d = 0) {
  const k = cov(o), L = (a, b) => a + (b - a) * k;
  return capLoop({ front: L(50 + d, 33 + d), temple: [L(62, 66), L(38, 16)], ear: [L(84, 88), L(2, -6)], back: -10,
    frontEdge: ['wave', .8], sideEdge: ['wave', 1], backEdge: ['wave', 1.4], ...o });
}

export const STYLES = {
  bald: () => null,
  // the engineer's: a lobe under the cap, straight front (the cap hides it), scalloped sides and back
  lobe: o => capLoop({ front: 42, temple: [62, 37], ear: [90, -3], back: -7, frontEdge: ['wave', .8], sideEdge: ['scallop', 2], backEdge: ['jag', 1.8], ...o }),
  short: o => capLoop({ front: 44, temple: [60, 36], ear: [86, -1], back: -10, frontEdge: ['jag', 2], ...o }),
  buzz: o => capLoop({ front: 52, temple: [58, 42], ear: [84, 4], back: -8, frontEdge: ['wave', .6], sideEdge: ['wave', .5], backEdge: ['wave', .6], ...o }),
  curly: o => capLoop({ front: 40, temple: [62, 34], ear: [88, -4], back: -12, frontEdge: ['scallop', 4], sideEdge: ['scallop', 4.5], backEdge: ['scallop', 5], ...o }),
  fringe: o => {
    const f = o.front ?? 24; // the straight-cut bangs, low on the forehead
    return [{ y: 0, p: f, e: 'jag', a: 1.6 }, { y: 28, p: f, e: 'jag', a: 1.6 }, { y: 56, p: f + 1, sharp: true, e: 'scallop', a: 2.4 },
      { y: 72, p: 12, e: 'scallop', a: 2.4 }, { y: 86, p: -3, sharp: true, e: 'scallop', a: 3 }, { y: 128, p: -9, e: 'scallop', a: 3 },
      { y: 180, p: -11, e: 'scallop', a: 3 }, { y: -128, p: -9, e: 'scallop', a: 3 }, { y: -86, p: -3, sharp: true, e: 'scallop', a: 2.4 },
      { y: -72, p: 12, e: 'scallop', a: 2.4 }, { y: -56, p: f + 1, sharp: true, e: 'jag', a: 1.6 }, { y: -28, p: f, e: 'jag', a: 1.6 }];
  },
  side_part: o => {
    const ps = o.part ?? -1; // which side the part is on: -1 the character's right (-X), 1 his left
    const s = v => v * ps;   // anchor yaw on the part side when v > 0
    const L = [
      { y: s(24), p: 60, sharp: true, e: 'wave', a: 1.4 },               // the part: a notch
      { y: s(44), p: 47, e: 'scallop', a: 2 }, { y: s(60), p: 38, sharp: true, e: 'scallop', a: 2.4 },
      { y: s(88), p: -2, sharp: true, e: 'scallop', a: 3 }, { y: s(130), p: -9, e: 'scallop', a: 3 },
      { y: 180, p: -11, e: 'scallop', a: 3 }, { y: s(-130), p: -9, e: 'scallop', a: 3 }, { y: s(-88), p: -2, sharp: true, e: 'scallop', a: 2.4 },
      { y: s(-64), p: 30, sharp: true, e: 'jag', a: 2.2 },                 // the swept side comes low over the temple
      { y: s(-30), p: 34, e: 'jag', a: 2.2 }, { y: s(2), p: 44, e: 'wave', a: 1.4 },
    ];
    return L; // mirrored by ps; the loop's direction doesn't matter (hairline() votes which side is out)
  },
  receding: o => [
    { y: 0, p: o.front ?? 50, sharp: true, e: 'wave', a: 1 },                     // a small widow's peak
    { y: 22, p: 62, e: 'wave', a: 1 }, { y: 42, p: 68, sharp: true, e: 'wave', a: 1.2 },   // the recession
    { y: 62, p: 36, sharp: true, e: 'scallop', a: 2.2 }, { y: 88, p: -2, sharp: true, e: 'scallop', a: 3 }, { y: 130, p: -9, e: 'scallop', a: 3 },
    { y: 180, p: -11, e: 'scallop', a: 3 }, { y: -130, p: -9, e: 'scallop', a: 3 }, { y: -88, p: -2, sharp: true, e: 'scallop', a: 2.2 },
    { y: -62, p: 36, sharp: true, e: 'wave', a: 1.2 }, { y: -42, p: 68, sharp: true, e: 'wave', a: 1 }, { y: -22, p: 62, e: 'wave', a: 1 }],
  // horseshoe: bald top, a band from temple to temple around the back
  // W2 2026-11-04: low band (the dome stays clean skin), rounded front ends at the ear, a soft wavy top edge (his thin wavy line,
  // Worker 3 / old lady) and a lower edge that is straight with one jag per stretch ('one'), not scallops
  // W3 2026-11-04: the jags (one per stretch) and the wavy top read as cracks across the dome at film size (3/4 views): both edges are
  // now smooth gentle curves (edge 'wave' at a third of the old amplitude); `jag: true` brings the old one-jag lower edge back
  bald_sides: o => {
    // SP 2026-11-04: from behind the band floated mid-head with bald skin under it (a blindfold on an egg). A real horseshoe runs down to
    // the nape: the lower edge now drops from the ears (p -2) to p -38 at the back; ears and front unchanged. `nape: false` = the old band.
    // PR2 2026-11-04 (FABLE_REVIEW3 item 10): in 3/4 front views the front ends (yaw 80, p 15) reached the glasses' arms and the top
    // (p 26) climbed over the dome, so the patch read as a blotch across the forehead. The band now starts BEHIND the ear line
    // (`frontYaw`, default 88), its top edge is lower (`top` default 22) and rounded down into the front end: sides and back only.
    // W6 2026-11-04 (FABLE_REVIEW4 item 1): seen from az +-60 the lower edge fell from the ear (p -10 at yaw 106) to the nape anchor at
    // yaw 142 (p -40) right on the silhouette, so the band read as a teardrop / comma (fat top, a tail down the outline). The band now
    // runs EVEN (p -10 .. -13) to yaw 132 and only drops to the nape behind yaw 158 (from behind it is the same horseshoe).
    // `nape: 'old'` = the SP drop at yaw 142. The front end was a round loop (from az 60 it read as a "P" / "?" glyph): now a blunt,
    // nearly vertical front edge with a corner at the top (his boss's patch has corners); `front: 'round'` softens that corner.
    const top = o.top ?? 22, fy = o.frontYaw ?? 88, lo = o.jag ? 'one' : 'wave', la = o.jag ? 1 : .22, ta = o.jag ? 1 : .35, nb = o.nape === false ? [-15, -17] : [-40, -56];
    const ny = o.nape === 'old' || o.nape === false ? 142 : 158, mid = o.nape === 'old' || o.nape === false ? [] : [{ y: 132, p: -13, e: lo, a: 2.8 * la }];
    return [{ y: fy, p: top - 5, sharp: o.front !== 'round', e: 'wave', a: .5 * ta }, { y: fy - 1, p: 6, e: 'wave', a: .8 * ta }, { y: fy + 2, p: -4, e: lo, a: 2.6 * la }, { y: fy + 18, p: -10, e: lo, a: 2.8 * la }, ...mid,
      { y: ny, p: nb[0], e: lo, a: 3 * la }, { y: 180, p: nb[1], e: lo, a: 3 * la }, { y: -ny, p: nb[0], e: lo, a: 2.8 * la },
      ...mid.map(q => ({ ...q, y: -q.y })), { y: -fy - 18, p: -10, e: lo, a: 2.6 * la }, { y: -fy - 2, p: -4, e: 'wave', a: .8 * ta }, { y: -fy + 1, p: 6, e: 'wave', a: .5 * ta }, { y: -fy, p: top - 5, sharp: o.front !== 'round', e: 'wave', a: 1 * ta },
      { y: -fy - 10, p: top - 1, e: 'wave', a: 1.4 * ta }, { y: -138, p: top, e: 'wave', a: 1.4 * ta }, { y: 180, p: top + 1, e: 'wave', a: 1.4 * ta },
      { y: 138, p: top, e: 'wave', a: 1.4 * ta }, { y: fy + 10, p: top - 1, e: 'wave', a: 1 * ta }];
  },
  // long / bob / bun / ponytail: the part of the hair the shell can carry (the rest is extras in hair.js)
  // W3: centre part lower (52 -> 40) and the curtains down over the temples (coverage, as bun)
  long: o => { const k = cov(o), L = (a, b) => a + (b - a) * k; return [
    { y: 0, p: o.front ?? L(52, 40), sharp: true, e: 'wave', a: 1 },               // centre part
    { y: 26, p: L(45, 33), e: 'wave', a: 1.2 }, { y: 54, p: L(28, 16), e: 'wave', a: 1.4 }, { y: 70, p: 0, e: 'wave', a: 1.4 },
    { y: 80, p: -38, sharp: true, e: 'scallop', a: 3 }, { y: 120, p: -44, e: 'scallop', a: 3.5 }, { y: 180, p: -46, e: 'scallop', a: 3.5 },
    { y: -120, p: -44, e: 'scallop', a: 3 }, { y: -80, p: -38, sharp: true, e: 'wave', a: 1.4 },
    { y: -70, p: 0, e: 'wave', a: 1.4 }, { y: -54, p: L(28, 16), e: 'wave', a: 1.2 }, { y: -26, p: L(45, 33), e: 'wave', a: 1 }]; },
  bob: o => {
    const f = o.front ?? (26 - 4 * (cov(o) - 1)), b = o.bottom ?? -26; // W3: already low bangs; coverage > 1 lowers them further
    return [{ y: 0, p: f, e: 'jag', a: 1.2 }, { y: 30, p: f, e: 'jag', a: 1.2 }, { y: 56, p: f - 2, sharp: true, e: 'wave', a: 1 },
      { y: 68, p: 0, e: 'wave', a: 1 }, { y: 78, p: b, sharp: true, e: 'wave', a: 1.4 }, { y: 125, p: b + 3, e: 'wave', a: 1.4 },
      { y: 180, p: b + 4, e: 'wave', a: 1.4 }, { y: -125, p: b + 3, e: 'wave', a: 1.4 }, { y: -78, p: b, sharp: true, e: 'wave', a: 1 },
      { y: -68, p: 0, e: 'wave', a: 1 }, { y: -56, p: f - 2, sharp: true, e: 'jag', a: 1.2 }, { y: -30, p: f, e: 'jag', a: 1.2 }];
  },
  // W3: tied-back hair reads from LOW film cameras: the front comes forward/lower (it was pitch 48-50: from el -10 the head read bald
  // with a thin dark line on top) and the sides come down to about the brow line. `coverage` 0 = the old high line, 1 = default, >1 lower.
  // W5 2026-11-04: `messy` (tousled / scruffy): a short cap whose front, side and back edges are uneven pointed tufts (clump size from the
  // seed), front high enough that the tuft tips stay above the brows; the extras (hair.js) add a few tufts standing up on top and two-three
  // sticking out over the ears. `spiky`: an even jagged front + spikes all over the top (extras).
  messy: o => capLoop({ front: 42, temple: [58, 35], ear: [86, -2], back: -11, frontEdge: ['jag', 9], sideEdge: ['jag', 4.5], backEdge: ['jag', 4], ...o }),
  spiky: o => capLoop({ front: 40, temple: [58, 36], ear: [86, 0], back: -9, frontEdge: ['jag', 4.5], sideEdge: ['jag', 3.2], backEdge: ['jag', 3], ...o }),
  bun: o => tied(o, 0),
  ponytail: o => tied(o, -1),
  pigtails: o => [
    { y: 0, p: o.front ?? 50, sharp: true, e: 'wave', a: 1 }, { y: 30, p: 44, e: 'wave', a: 1 }, { y: 62, p: 34, sharp: true, e: 'wave', a: 1 },
    { y: 86, p: 0, sharp: true, e: 'wave', a: 1.4 }, { y: 130, p: -9, e: 'wave', a: 1.4 }, { y: 180, p: -11, e: 'wave', a: 1.4 },
    { y: -130, p: -9, e: 'wave', a: 1.4 }, { y: -86, p: 0, sharp: true, e: 'wave', a: 1 }, { y: -62, p: 34, sharp: true, e: 'wave', a: 1 }, { y: -30, p: 44, e: 'wave', a: 1 }],
};
export const STYLE_NAMES = Object.keys(STYLES);
// a point inside each style's hair [yaw, pitch] (the azimuthal map's centre); default [180, 45] = upper back
const INNER = { bald_sides: [180, 8], long: [180, 30], bob: [180, 35] };

// ---------- spline on the sphere ----------
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return [0, 1, 2].map(i => .5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3));
}
function densify(A, step) {
  const n = A.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = A[i], b = A[(i + 1) % n];
    const p1 = a.v, p2 = b.v, p0 = a.sharp ? p1 : A[(i - 1 + n) % n].v, p3 = b.sharp ? p2 : A[(i + 2) % n].v;
    const k = Math.max(2, Math.ceil(ang(p1, p2) / (step * D2R)));
    for (let j = 0; j < k; j++) out.push({ v: norm(catmull(p0, p1, p2, p3, j / k)), e: a.e || 'none', a: a.a || 0, seg: i, t: j / k, sharp: j === 0 && a.sharp });
  }
  return out;
}
// point in polygon in the azimuthal map about axis (the same test head.js runs per pixel)
function mapper(axis) {
  const e1 = norm(Math.abs(axis[1]) < .9 ? cross([0, 1, 0], axis) : cross([1, 0, 0], axis)), e2 = cross(axis, e1);
  const map = p => { const rho = ang(p, axis), t = [dot(p, e1), dot(p, e2)], l = Math.hypot(t[0], t[1]); return l < 1e-6 ? [0, 0] : [t[0] / l * rho, t[1] / l * rho]; };
  return { e1, e2, map };
}
function inside(m, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > m[1]) !== (b[1] > m[1]) && m[0] < (b[0] - a[0]) * (m[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
// resample a closed loop by arc length to n points, keeping corners
function resample(P, n) {
  const L = [0]; for (let i = 1; i <= P.length; i++) L.push(L[i - 1] + ang(P[i - 1], P[i % P.length]));
  const total = L[P.length], out = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const s = k / n * total;
    while (L[j + 1] < s) j++;
    const t = (s - L[j]) / Math.max(L[j + 1] - L[j], 1e-9), a = P[j], b = P[(j + 1) % P.length];
    out.push(norm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]));
  }
  return out;
}

export function hairline(opts = {}) {
  const { style = 'short', seed = 1, maxVerts = 116, edgeScale = 1, anchors } = opts;
  const make = STYLES[style];
  if (!make && !anchors) throw new Error(`hairline: unknown style "${style}" (${STYLE_NAMES.join(', ')})`);
  const loop = anchors || napeDrop(make(opts), style, opts);
  if (!loop) return { style, bald: true, verts: [vec(0, -90)], hair: [vec(0, -90)], hi: [vec(0, -90)], axis: [0, -1, 0], e1: [1, 0, 0], e2: [0, 0, 1], n: 0 };
  const A = loop.map(q => ({ ...q, v: vec(q.y, q.p) }));
  // 1. spline, dense (1.2 deg)
  const dense = densify(A, 1.2);
  // the map's centre must be a point INSIDE the hair (head.js fills the bounded side of the loop as seen from it): the mean of the
  // loop is not (long hair rings the face, so its mean sits in the face and the fill came out inverted)
  const inner = opts.inner || INNER[style] || [180, 45];
  const axis = opts.axis ? norm(opts.axis) : vec(inner[0], inner[1]);
  const M = mapper(axis);
  const poly = dense.map(d => M.map(d.v));
  // 2. outward normal (toward the skin): the side whose nudge leaves the polygon, voted over the loop
  let vote = 0;
  for (let i = 0; i < dense.length; i += 7) {
    const v = dense[i].v, t = norm(add(dense[(i + 1) % dense.length].v, v, -1)), n = norm(cross(t, v));
    vote += inside(M.map(norm(add(v, n, .02))), poly) ? -1 : 1;
  }
  const sgn = vote >= 0 ? 1 : -1;
  // 3. edge noise along each stretch: clumps whose size and length vary by the seed
  const R = rng(seed);
  const segLen = {}; dense.forEach((d, i) => { segLen[d.seg] = (segLen[d.seg] || 0) + ang(d.v, dense[(i + 1) % dense.length].v); });
  const plan = {}; // per stretch: clump boundaries in [0,1] and their sizes
  for (const s of Object.keys(segLen)) {
    const len = segLen[s] / D2R, period = 13 + R() * 6, k = Math.max(1, Math.round(len / period)), cuts = [0];
    for (let i = 1; i < k; i++) cuts.push((i + (R() - .5) * .5) / k);
    cuts.push(1);
    plan[s] = { cuts, amp: cuts.map(() => .65 + R() * .7), ph: R() * 6.28 };
  }
  const out = dense.map((d, i) => {
    const v = d.v, nx = dense[(i + 1) % dense.length].v, t = norm(add(nx, v, -1)), n = norm(cross(t, v));
    const P = plan[d.seg], c = P.cuts; let j = 0; while (j < c.length - 2 && d.t >= c[j + 1]) j++;
    const u = (d.t - c[j]) / Math.max(c[j + 1] - c[j], 1e-6), A0 = d.a * edgeScale * P.amp[j];
    let off = 0;
    if (d.e === 'scallop') off = A0 * Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2));   // round clumps, cusps between
    else if (d.e === 'jag') off = A0 * (1 - Math.abs(2 * u - 1)) ** 1.6;              // pointed tufts
    else if (d.e === 'wave') off = A0 * .5 * Math.sin(d.t * Math.PI * (c.length - 1) + P.ph);
    else if (d.e === 'one') off = d.a * edgeScale * Math.pow(Math.max(0, 1 - Math.abs(d.t - (.38 + P.ph / 6.28 * .24)) / .07), 1.4); // straight, one pointed jag
    // fade the noise to zero at the stretch's ends, so corners stay where the anchors put them
    const fade = Math.min(1, d.t * 6, (1 - d.t) * 6) * (c.length > 2 || d.e === 'wave' ? 1 : 1);
    return norm(add(v, n, sgn * off * fade * D2R));
  }).map(v => browClamp(v, opts));
  // 4. under the vert budget: resample the noisy loop by arc length (2.5-3 deg apart keeps every clump)
  const hair = out.length > maxVerts ? resample(out, maxVerts) : out;
  const hi = highlight(opts, style);
  return { style, verts: hair, hair, hi, axis, e1: M.e1, e2: M.e2, n: hair.length };
}

// ---------- fix1 2026-11-04: the hair covers the back of the head down to the nape ----------
// Every style's back stretch stopped near the equator (pitch -7 .. -12), so from behind the lower half of the head was a blank white
// half-disc with a wavy top edge: a face with no features. Hair that has a back covers it from the crown to the NAPE (pitch NAPE_P, where
// the head meets the neck/collar, neckToHead .35 -> asin(-.7) = -44): every lower-edge anchor behind the ears (|yaw| > 100, p <= 5) is
// lowered to at least napeAt(|yaw|), which eases from the ear's own pitch at yaw 100 to NAPE_P straight behind. The ears, sides and front
// are untouched (front views identical); the edge noise of the back stretch stays (a wavy nape line, mostly under the collar).
// bald_sides has its own nape drop (and bald no line). `nape: false` = the old line, `nape: <deg>` = another nape pitch.
export const NAPE_P = -68;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// fix1b: the ease ends at yaw 138 (was 168): with 168 the stretch at yaw 120-150 was still half way up, and from straight behind two
// white wedges of skin showed at the lower left / right of the head (Mara, Pip, Dotty, Chef in the v2 sheet's back row).
export function napeAt(absYaw, p0 = -6, nape = NAPE_P) { return p0 + (nape - p0) * smooth(100, 138, absYaw); }
function napeDrop(loop, style, opts) {
  if (!loop || style === 'bald_sides' || opts.nape === false) return loop;
  const nape = typeof opts.nape === 'number' ? opts.nape : NAPE_P;
  return loop.map(q => {
    const ay = Math.abs(((q.y + 540) % 360) - 180);
    if (ay <= 100 || q.p > 5) return q;
    return { ...q, p: Math.min(q.p, napeAt(ay, Math.min(q.p, -6), nape)) };
  });
}

// ---------- W5 2026-11-04: hair never covers the eyes ----------
// The face decal follows the camera (rules.js face pitch = -el), so on the head the brows sit at pitch ~ 18 + el (thick brows, the
// 'up' brow ~ +4): el 8 -> ~26-30, el -10 -> ~8-12. blind4 Sam (`short`, `front: .5` read as a fraction) had his hairline AT the eyes,
// Theo (`front: 1`) on the brows. Every loop vertex in the face's yaw range is pushed up to at least BROW_P (a smooth max, so tufts
// round off instead of being sliced flat); the floor falls off from |yaw| 48 to 72 (temples / curtains of long hair stay where they
// were) and is gone behind |yaw| 72. Above BROW_P + 5 nothing moves (every existing style's front is there, except fringe 24 / bob 26,
// whose bangs now stop at the clamp). Front views only: cameras above el ~12 can still see the brows meet a low front.
export const BROW_P = 31;
export function browFloor(yawDeg) {
  const a = Math.abs(yawDeg);
  if (a <= 48) return BROW_P;
  if (a >= 72) return -90;
  return BROW_P - (a - 48) / 24 * (BROW_P + 12); // 31 at 48 -> -12 at 72 (below every ear anchor: no change there)
}
function browClamp(v, opts) {
  if (opts.browClamp === false) return v;
  const yaw = Math.atan2(v[0], v[2]) / D2R, p = Math.asin(Math.max(-1, Math.min(1, v[1]))) / D2R, B = browFloor(yaw);
  if (B < -80 || p >= B + 5) return v;
  const k = 2.5, d = p - B, q = d >= 5 ? p : B + (d + Math.sqrt(d * d + k * k)) / 2 - (5 + Math.sqrt(25 + k * k)) / 2 + 5; // smooth max, = p at d 5
  return vec(yaw, q);
}

// the lit band head.js paints over the hair (a thin lens toward the top front, lit side), only seen where the hair is
function highlight(opts, style) {
  const path = opts.hiPath || ({
    bald_sides: [[0, 89], [10, 87], [20, 85]], // none: a bald top has no lit band on the hair
    long: [[40, 78], [30, 60], [44, 30]], bob: [[44, 78], [34, 58], [46, 30]],
    fringe: [[44, 80], [20, 62], [0, 34]], side_part: [[50, 80], [24, 70], [-2, 50]],
    receding: [[80, 76], [70, 64], [64, 44]],
  }[style]) || [[55, 79], [16, 67], [-10, 46]];
  const P = path.map(([y, p]) => vec(y, p)), dense = [];
  for (let i = 0; i < P.length - 1; i++) for (let j = 0; j < 8; j++) {
    const t = j / 8, a = P[i], b = P[i + 1]; dense.push(norm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]));
  }
  dense.push(P[P.length - 1]);
  const w = (opts.hiWidth ?? 3.2) * D2R, L = [], Rr = [];
  dense.forEach((v, i) => {
    const nx = dense[Math.min(i + 1, dense.length - 1)], pv = dense[Math.max(i - 1, 0)], t = norm(add(nx, pv, -1)), n = norm(cross(t, v));
    const s = i / (dense.length - 1), k = Math.sin(Math.PI * s) ** .7 * w;
    L.push(norm(add(v, n, k))); Rr.push(norm(add(v, n, -k * .35)));
  });
  return [...L, ...Rr.reverse()];
}
