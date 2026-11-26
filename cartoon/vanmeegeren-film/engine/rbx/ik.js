// engine/rbx/ik.js: two-bone IK for rigid Roblox limbs (WP-C1, 2026-11-12). Equal segments (seg each, chain 2 seg). Pure: no state.
// Rigid limbs cannot stretch the way charsys hoses do, so:
//  - SOFT ANGLE: each segment's angle off the chord is phi' = sqrt(m^2 softplus(u / m^2)), u = acos(c / 2seg)^2 (u = 2(1 - c / 2seg) past
//    full reach, which continues it with the same slope). phi' ~ phi when bent; near and past full reach it eases to a small rest bend
//    and then to straight (exponentially), so the knee / elbow angle has no infinite-speed snap at full extension. The drawn end is at most
//    a few mm short of the target near full reach (L (cos phi - cos phi')), never past it.
//  - a target closer than .3 x chain is held at .3 x chain (no folding through itself).
//  - POLE: the bend direction is the rig's pole made perpendicular to the chord; when the pole runs nearly along the chord (where a plain
//    IK flips the elbow plane) a fallback pole (the body's back for arms, front for legs) fades in continuously, so the plane never flips.
// solve(s, e, seg, pole, fallback, m) -> { mid, end, x, yU, yL } world points / unit vectors: x = hinge axis, yU / yL = the segments'
// UP axes (from the far joint toward the near one), frames: (x, y, z = x cross y) with z the bend's front (the knee's / elbow's outside).
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const softplus = x => x > 30 ? x : Math.log1p(Math.exp(x));
export const V = { sub, add, mul, dot, cross, len, norm };

export function softAngle(c, L, m) {
  const r = c / L, u = r < 1 ? Math.acos(Math.max(-1, r)) ** 2 : 2 * (1 - r);
  return Math.sqrt(m * m * softplus(u / (m * m)));
}

export function solve(s, e, seg, pole, fallback, m = 5 * Math.PI / 180) {
  const L = 2 * seg;
  let d = sub(e, s), c = len(d);
  const dir = c > 1e-6 ? mul(d, 1 / c) : [0, -1, 0];
  c = Math.max(c, .3 * L);
  // pole perpendicular to the chord, with the fallback fading in when it gets short
  const perp = p => sub(p, mul(dir, dot(p, dir)));
  let q = perp(pole); const ql = len(q);
  const f = perp(fallback), fl = len(f);
  const w = Math.max(0, .45 - ql) / .45;                 // 0 while the pole is well off the chord, 1 when it runs along it
  q = add(mul(q, 1 / Math.max(ql, 1e-6) * (1 - w)), mul(f, w / Math.max(fl, 1e-6)));
  if (len(q) < 1e-6) q = Math.abs(dir[1]) < .9 ? perp([0, 1, 0]) : perp([0, 0, 1]);
  q = norm(q);
  const phi = softAngle(c, L, m);
  const reach = L * Math.cos(phi);                      // the chord the limb really draws
  const end = add(s, mul(dir, Math.min(reach, c)));
  const mid = add(add(s, mul(dir, reach / 2)), mul(q, seg * Math.sin(phi)));
  const x = norm(cross(q, dir));                        // hinge axis
  const yU = norm(sub(s, mid)), yL = norm(sub(mid, end));
  return { mid, end, x, yU, yL, q, phi, c };
}

export default { solve, softAngle, V };
