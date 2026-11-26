// hose.js: a limb is a hose, not a bone chain (ENGINE_DESIGN section 4). hose(start, end, opts, out) -> M control points on a circular arc in the
// plane of start, end and the bend (pole) direction, the arrays limbs.js setPose takes.
//   length rule (he is not length-preserving): L = max(chord, len * (slack + (1 - slack) * chord / len))
//   past maxStretch * len the end stops (the returned `stretched` says by how much it would have gone)
// Pure math on [x,y,z] arrays, no THREE: tested in node.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len3 = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len3(a) || 1; return mul(a, 1 / l); };

// theta / sin(theta) = k, theta in [0, pi): half the arc's central angle
function halfAngle(k) {
  if (k <= 1.000001) return 0;
  let t = Math.min(3.1, Math.sqrt(6 * (k - 1)));
  for (let i = 0; i < 30; i++) {
    const s = Math.sin(t), c = Math.cos(t), f = t / s - k, df = (s - t * c) / (s * s);
    const n = t - f / df;
    t = Math.min(3.13, Math.max(1e-4, n));
    if (Math.abs(f) < 1e-10) break;
  }
  return t;
}

// LEG (2026-11-04): his knees never lock, even at full stride. A walking leg (slack under STAND_SLACK: character.js blends legSlack .45 ->
// walkSlack .22 by walkK) keeps a bow floor: the arc's sagitta stays >= BOW * chord at full walk (scaled by how far the slack has dropped),
// so a leg at or past its reach is a soft noodle, never a straight rod. Only the drawn length grows (~3 %); both ends stay exactly where
// they were (planted feet do not move, limbs_reach measures the chord). Standing (.45), sitting / kneeling legs and arms (.72) are
// unchanged: the floor is 0 at slack >= STAND_SLACK, and their bow is above the floor anyway.
export const STAND_SLACK = .45, WALK_SLACK = .22, BOW = .18;
export function bowFloor(slack) {
  const w = Math.min(1, Math.max(0, (STAND_SLACK - slack) / (STAND_SLACK - WALK_SLACK)));
  if (w <= 0) return 1;
  const th = 2 * Math.atan(2 * BOW * w); // sagitta / chord = tan(th / 2) / 2
  return th / Math.sin(th);              // arc length / chord at that sagitta
}
export function hoseLength(chord, len, slack) { return Math.max(chord * bowFloor(slack), len * (slack + (1 - slack) * chord / len)); }

export function hose(start, end, { len = 1, slack = .72, bend = [0, 0, 1], M = 8, maxStretch = 1.25 } = {}, out = null) {
  let e = end, d = sub(end, start), c = len3(d);
  let stretched = 0;
  if (c > maxStretch * len) { stretched = c / len; e = add(start, mul(norm(d), maxStretch * len)); d = sub(e, start); c = len3(d); }
  const L = hoseLength(c, len, slack);
  const ch = norm(d);
  // bulge direction: the bend's part perpendicular to the chord (fallback: any perpendicular)
  let b = sub(bend, mul(ch, dot(bend, ch)));
  if (len3(b) < 1e-6) b = Math.abs(ch[1]) < .9 ? sub([0, 1, 0], mul(ch, ch[1])) : sub([1, 0, 0], mul(ch, ch[0]));
  b = norm(b);
  const pts = out || [];
  pts.length = M;
  const th = c > 1e-6 ? halfAngle(L / c) : 0;
  const m = mul(add(start, e), .5);
  if (th < 1e-4) {
    for (let i = 0; i < M; i++) pts[i] = add(start, mul(d, i / (M - 1)));
  } else {
    const r = c / (2 * Math.sin(th)), centre = sub(m, mul(b, r * Math.cos(th)));
    for (let i = 0; i < M; i++) {
      const phi = -th + 2 * th * i / (M - 1);
      pts[i] = add(centre, add(mul(ch, r * Math.sin(phi)), mul(b, r * Math.cos(phi))));
    }
  }
  pts[0] = start.slice(); pts[M - 1] = e.slice();
  return { pts, L, chord: c, stretched, end: e };
}

export default { hose, hoseLength };
