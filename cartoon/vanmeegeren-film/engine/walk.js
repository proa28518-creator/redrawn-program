// engine/walk.js - a walk / run along a ground path, closed form in t (MOTION_BIBLE section 3 "Walk", section 2 "Walk step").
// R1 (agent R, 2026-11-04, Fable review problems 1 + 15 "walks are glides"):
// - Cadence follows speed: `speed` (D/s) picks the step time (walk 12 f slow .. 8 f brisk, run 6 / 5 f) and stride = speed x step time,
//   so a slow walk is SHORT steps at a slower beat, never a glide. Without `speed`, `step` + `stride` work as before.
// - Phase p = (t - t0) / step; root arc length s(p): step 0 accelerates (S p^2 / 2), steps 1..N-1 constant S per step, step N decelerates.
// - Footholds: the foot landing at the end of step k (R on even k, L on odd) sits at arc length h_k = min((k+1) S, L), a pure
//   function of k: a planted foot is bit-identical for its whole plant. Swing of foothold k: p in [k - flight, k + 1]
//   (walk: flight 0, the foot leaves as the other lands; run: leaves `flight` of a step early = both feet in the air).
// - Bob: sawtooth, lowest just after each contact: drop over the last 1/5 + first 2/15 of a step (~3 f of 9), rise the remaining 6 f
//   with decaying speed. Arms swing opposite the legs, at their extremes on contact.
// - Stop: both feet planted side by side, a small settle (hips dip ~1/3 bob in 3 f, back in 6 f), then dead still.
// - Run (`gait:'run'`, or speed > 4.6 legLen/s, or step <= 6): flight frames, high heel kick, bigger bob, arms pump, lean forward.
// - Cane (`cane:'R'|'L'`): the cane tip swings with the OPPOSITE foot and plants with it; `out.cane` + a world hand target `out.arm<side>`.
//   ENG6: the cane starts from the stance (tip where the standing cane was, hand straight above it, heading = ryStart blended like
//   compose's root) and leans into the walk over the first step, back upright over the last: no jump into or out of a walk.
// MO3 (2026-11-04): his cadence by default (9 f steps, 1.25-1.5 legLen strides, bob .3 legLen, sawtooth timed in frames); `speed`
// on a normal walk is a pace on the R1 scale; the literal R1 cadence only for cane / slow / speedExact. See cadence() and MOTION_API.md.
// Channels the walk returns beyond legs/hipDY/armDZ (`bend`, `armR/armL`, `cane`) need compose.js to apply them (see MOTION_API.md).
import { F, clamp, lerp, fastIn, E } from './ease.js';

const STEP_F = 9;

function catmull(p0, p1, p2, p3, u) {
  const u2 = u * u, u3 = u2 * u;
  return [0, 1].map(i => .5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * u + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * u2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * u3));
}

/** Smooth path: Catmull-Rom through the points, sampled densely, arc-length table. */
export function pathOf(points, samplesPer = 48) {
  const P = points.map(p => [p[0], p[1]]);
  if (P.length === 1) P.push([P[0][0], P[0][1] + 1e-6]);
  const pts = [P[0]];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let j = 1; j <= samplesPer; j++) pts.push(catmull(p0, p1, p2, p3, j / samplesPer));
  }
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = s[s.length - 1];
  function find(d) {
    d = clamp(d, 0, L); let lo = 0, hi = s.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m] <= d) lo = m; else hi = m; }
    const k = (d - s[lo]) / ((s[hi] - s[lo]) || 1e-9); return [lo, hi, k];
  }
  return {
    L,
    at(d) { const [a, b, k] = find(d); return [lerp(pts[a][0], pts[b][0], k), lerp(pts[a][1], pts[b][1], k)]; },
    // heading (ry, degrees) from the tangent: ry = atan2(dx, dz), ry 0 faces +Z
    ry(d) { const [a, b] = find(d); const i0 = Math.max(0, Math.min(a, pts.length - 2)), i1 = i0 + 1;
      return Math.atan2(pts[i1][0] - pts[i0][0], pts[i1][1] - pts[i0][1]) * 180 / Math.PI; },
  };
}

const R = d => d * Math.PI / 180;
/** World position of a foot under the hips: root + Ry(ry) * hip offset (x = character's left, z = facing). */
export function footUnder(x, z, ry, hip, y = 0) {
  const c = Math.cos(R(ry)), s = Math.sin(R(ry));
  return [x + hip[0] * c + hip[2] * s, y, z - hip[0] * s + hip[2] * c];
}
const unwrap = (a, ref) => a + 360 * Math.round((ref - a) / 360);

// MO3 (2026-11-04, lab/timing audit: our steps .56-1.0 D at 11-12 f vs his 1.7 D at 9 f, 2-4x slow): HIS cadence by default.
// His walk (MOTION_BIBLE s3, passengers f1044-1080): step 9 f, ~4 R = ~1.7 D forward per step on an adult (legLen 1.2 -> 1.4 legLen),
// .13-.21 D/f constant, bob .7-1.1 R (.3-.45 D) as a sawtooth (drop 2-3 f, rise 6). Kids / tall people scale by legLen.
// `speed` (D/s) on a normal walk/run is read as a PACE on the R1 authoring scale every film so far was written in (1.3 stroll ..
// 2.6 normal .. 3.5+ brisk, x legLen/1.2): pace u 0..1 -> step 10/9/8 f, stride 1.25-1.5 legLen (ground speed ~4.5-6.8 D/s adult).
// The literal R1 cadence (speed = real D/s, 12 f shuffle .. 8 f brisk, stride = speed x step time) stays for the old-man gaits:
// `cane`, `slow: true`, or `speedExact: true`. Explicit `step` / `stride` always win.
export const HIS = { stepF: 7, stride: 1.075, bob: .3, runStride: 1.2, runStepF: 5 };   // stride / bob in legLen (adult legLen 1.2 D). AGENT-A 2026-11-04: shorter, quicker steps at the SAME ground speed (was 9 f / 1.4, run 6 f / 1.5: the trailing leg stretched into a long rubber curve)
export function paceOf(v, Lg) { return v == null ? .5 : clamp((v / Lg - 1.1) / 1.8); }  // R1 scale -> 0..1 (1.3 D/s adult ~0, 2.6 ~.65)
export function cadence(rest, opts = {}) {
  const Lg = rest.legLen;
  const v = opts.speed;                                         // D/s (pace, see above)
  const literal = !!(opts.cane || opts.slow || opts.speedExact);
  let gait = opts.gait;
  if (!gait) gait = (v != null && v > 4.6 * Lg) || (v == null && opts.step != null && opts.step <= 6) ? 'run' : 'walk';
  const run = gait === 'run';
  let stepF = opts.step;
  if (literal) {                                                // R1 cadence: old man, cane, or asked for the exact ground speed
    if (stepF == null) {
      if (v == null) stepF = run ? 6 : (opts.slow || opts.cane ? 11 : STEP_F);
      else if (run) stepF = v > 6.5 * Lg ? 5 : 6;
      else stepF = Math.round(clamp(12 - 4 * (v / Lg - 1.5) / 2, 8, 12));   // 1.5 legLen/s -> 12 f (shuffle), 3.5 -> 8 f (brisk)
    }
    const stride = opts.stride ?? (v != null ? v * F(stepF) : (run ? .95 : .7) * Lg);
    return { gait, run, stepF, stride, pace: null, literal };
  }
  const u = paceOf(v, Lg);
  if (stepF == null) stepF = run ? (v != null && v > 6.5 * Lg ? 4 : HIS.runStepF) : (u < .1 ? 8 : u > .9 ? 6 : HIS.stepF);
  const stride = opts.stride ?? (run ? HIS.runStride : lerp(1.0, 1.15, u)) * Lg;
  return { gait, run, stepF, stride, pace: u, literal };
}

/**
 * walk(path, rest, opts) -> { dur, walkDur, steps, S, gait, at(tl) } with tl = seconds since the walk started.
 * opts: { speed: D/s (picks step + stride), gait: 'walk'|'run', step: frames per step, stride: D per step, lift: foot lift D,
 *         bob: D, arms: arm swing D, lean: forward bend deg, cross, crouch, cane: 'R'|'L', caneLen: D (1.15),
 *         settle: true (stop settle), face: degrees | [x, z] point to turn toward at the end (feet step it in 10 f) }
 */
export function walk(points, rest, opts = {}) {
  const path = pathOf(points);
  const cd = cadence(rest, opts);
  const run = cd.run, stepT = F(cd.stepF), Lg = rest.legLen;
  const S0 = cd.stride;
  const N = Math.max(1, Math.round(path.L / S0));
  const S = path.L / N;
  // run: high heel kick, big bob, both feet off for `flight` of a step; walk: M2 lift, bob .2 legLen (MOTION_BIBLE .7-1.1 R on the
  // engineer is .35-.55 D; .2 legLen keeps the noodles from bowing on the short-legged cast)
  // MO3: his bob .7-1.1 R = .3-.45 D on an adult = .3 legLen at his stride (1.375 legLen); a shorter (old man, cane) stride bobs and
  // lifts less (x stride / his stride, min .45): shuffle, not bounce. The deep dip is also what lets a 1.4-legLen stride reach the ground.
  const slow = run ? 1 : clamp(S0 / (HIS.stride * Lg), .45, 1.1);
  // ENG8 (FABLE_REVIEW4 item 7): run bob .12 -> .06 legLen: the head stays level, the stride does the work (his f1020-1049)
  // FIX10: a cane walker leans on the cane instead of falling into each step: a third of the bob (Walter's .2 D dip bent his long noodle
  // legs into a knee bow that curled out from behind the torso in close-ups) and a lower shuffle lift
  const caneK = (opts.cane === 'R' || opts.cane === 'L') && !run;
  const lift = opts.lift ?? (run ? .35 : .11 * slow * (caneK ? .7 : 1)) * Lg, bob = opts.bob ?? (run ? .06 : HIS.bob * slow * (caneK ? .35 : 1)) * Lg;
  const swingA = opts.arms ?? (run ? .22 : .13 * Math.min(1, slow));
  // bob sawtooth timing in FRAMES (his: drop 2-3 f, rise 6 f at a 9-f step): drop 2.5 f (a third of a run step), starting 1.5 f before contact
  const dropV = Math.min(1 / 3, (run ? 1.6 : 2.5) / cd.stepF), preV = dropV * .6;   // run: drop 1.6 f of a 6-f step, rise 4
  const leanDeg = opts.lean ?? (run ? 12 : 5);   // MO2: 3 -> 5, his slight forward lean
  const flight = run ? (opts.flight ?? .35) : 0;
  const crouch = opts.crouch ?? (run ? .03 * Lg : 0);
  const cross = opts.cross ?? (run ? .3 : 1.15);
  const walkDur = (N + 1) * stepT;
  const endP = path.at(path.L);
  const ry0 = path.ry(0), ryEnd = path.ry(path.L), ryS = opts.ryStart ?? ry0;   // ryStart: the heading he stood with (feet start there)
  let ryFace = ryEnd;
  if (typeof opts.face === 'number') ryFace = unwrap(opts.face, ryEnd);
  else if (Array.isArray(opts.face)) ryFace = unwrap(Math.atan2(opts.face[0] - endP[0], opts.face[1] - endP[1]) * 180 / Math.PI, ryEnd);
  const turnT = Math.abs(ryFace - ryEnd) > .5 ? F(10) : 0;
  const settleT = opts.settle === false ? 0 : F(9);
  const hipR = rest.hipR, hipL = rest.hipL, ank = rest.ankleY ?? 0;   // foot targets are ankles
  const caneSide = opts.cane === 'R' || opts.cane === 'L' ? opts.cane : null;
  const caneLen = opts.caneLen ?? 1.15;
  // HEIGHT (engine/height.js): opts.ground(d) = the ground's height at arc length d (a path with heights). Footholds land on it, a swinging foot
  // clears a step up, the root (at().rootY) rises with the average ground over a stride. Without it every number below is what it always was.
  const ground = opts.ground || null, gAt = d => ground ? ground(d) : 0;
  const rootG = s => { if (!ground) return 0; const h = Math.min(S0 * .5, s, path.L - s); let m = 0; for (let i = -3; i <= 3; i++) m += ground(s + h * i / 3); return m / 7; };

  // root arc length at phase p (closed form, see header)
  // MO2 (item 13): with the settle on, the last step ARRIVES at the stop point at ARR of the step still moving (.67 x cruise speed,
  // fast in), and the momentum carries on as a 2-3 f overshoot (root + forward pitch) that comes back and stops dead (overshoot()).
  const settleOn = opts.settle !== false, ARR = .6, aDec = (.5 - ARR) * 2 / (ARR * ARR);
  const lastS = u => settleOn ? (u < ARR ? S * (N - .5 + u + aDec * u * u / 2) : path.L) : S * (N - .5 + u - u * u / 2);
  const sOf = p => p <= 0 ? 0 : p < 1 ? S * p * p / 2 : p < N ? S * (p - .5) : p < N + 1 ? lastS(p - N) : path.L;
  // xf = frames since the root arrived: root .03 legLen (run .06) past the stop point and the torso pitched forward 3 deg (run 6) at f2,
  // back by f5, a hair behind at f5, exactly 0 from f6 (dead still)
  const OV = [0, .6, 1, .55, .15, -.05, 0];
  function overshoot(out, xf) {
    const i = Math.floor(xf), u = xf - i, ov = i < 0 || i >= OV.length - 1 ? 0 : OV[i] + (OV[i + 1] - OV[i]) * u, g = run ? 2 : 1;
    if (!ov) return;
    const fx = Math.sin(R(ryEnd)), fz = Math.cos(R(ryEnd)), d = .03 * Lg * g * ov;
    out.root.x += fx * d; out.root.z += fz * d; out.bend = leanDeg * (1 - clamp(xf / 5)) ** 2 + (opts.settleDeg ?? 3) * g * ov;
  }
  const hold = k => k < 0 ? 0 : Math.min((k + 1) * S, path.L);
  const RUN_BACK = .3, RUN_REACH = 1.05;   // AGENT-A RUN2: see footAtHold and the reach clamp in at()
  // mid-walk footholds land crossed (x pulled past the centre line); the first and the two last holds stay under the hips
  const crossHip = (hip, k) => k >= 0 && k < N - 1 ? [hip[0] * (1 - cross), hip[1], hip[2]] : hip;
  const startFoot = hip => footUnder(path.at(0)[0], path.at(0)[1], ryS, hip, ank + gAt(0));
  function footAtHold(k, hip, crossed = true) {
    if (k < 0) return startFoot(hip);
    // AGENT-A RUN2: a running foot lands only RUN_BACK of a stride short of its walking hold (just ahead of the hips, not half a
    // stride ahead), so the planted span is centred under the hips: no stretched reach at touch-down or toe-off
    const d = run && k >= 0 && k < N ? Math.max(0, hold(k) - RUN_BACK * S * (k === N - 1 ? .5 : 1)) : hold(k), p = path.at(d);
    const ry = k >= N ? ryEnd : path.ry(d);
    return footUnder(p[0], p[1], ry, crossed ? crossHip(hip, k) : hip, ank + gAt(d));
  }
  // swing window of foothold k: [k - flight, k + 1]; no flight on the first step or the last two (he lands into a stop)
  // AGENT-A RUN2: the last two run steps leave half the flight early too (the trailing foot stayed planted while the root ran into the
  // stop and the leg stretched to 1.15 legLen)
  const swingStart = k => k <= 0 ? 0 : k >= N - 1 ? k - flight * .5 : k - flight;

  // which foothold this leg is heading for at phase p, and where it is
  function legPhase(par, p) {
    let k = Math.floor(p); if ((((k % 2) + 2) % 2) !== par) k++;
    // run: the next foothold of this leg may already be swinging (left early)
    if (k > N) return { planted: k - 2 };
    const st = swingStart(k);
    if (p < st) return { planted: k - 2 };
    return { k, u: clamp((p - st) / (k + 1 - st)) };
  }

  function legAt(leg, p) {
    const hip = leg === 'R' ? hipR : hipL, par = leg === 'R' ? 0 : 1;
    if (p >= N + 1) { const j = (N % 2 === par) ? N : N - 1; return { foot: footAtHold(j, hip), swing: 0 }; }
    const ph = legPhase(par, p);
    if (ph.planted != null) return { foot: footAtHold(ph.planted, hip), swing: 0 };
    const { k, u } = ph;
    const a = footAtHold(k - 2, hip), b = footAtHold(k, hip);
    // walk: inOutSine across; run: the foot stays back while the heel kicks up, then whips forward
    // AGENT-A: a walking foot leaves the back position fast (outQuad-weighted) instead of lingering behind on a long stretched leg
    // AGENT-A RUN2: run swing = inOutSine (the old inOutCubic(u^1.25) held the foot back then whipped it 2 strides in 2-3 f: legREnd pops)
    // HEIGHT: a step up: the foot must be up by the time it reaches the edge. xs = how far along this swing the edge is (0 = right in front of the
    // foot: lift first, travel after; far along: travel as normal and rise on the way, never a leg lifted high behind him)
    const up = ground && b[1] - a[1] > .05;
    let xs = 1; if (up) { const da = hold(k - 2), db = hold(k), gb = ground(db); for (let i = 0; i <= 12; i++) if (Math.abs(ground(lerp(da, db, i / 12)) - gb) < .01) { xs = i / 12; break; } }
    const lead = up ? clamp(.32 - xs * .8, 0, .32) : 0;
    const e = up ? E.inOutSine(clamp((u - lead) / (1 - lead))) : run ? E.inOutSine(u) : caneSide ? E.inOutSine(u) : lerp(E.inOutSine(u), E.outQuad(u), .6);
    // FIX10: a cane walker SHUFFLES: the trailing foot does not kick up behind him (that early lift + the -35 deg toe-off curled the
    // noodle leg out from behind the torso in close-ups); it stays low behind, lifts as it passes under the hips, toe nearly level
    const lu = run ? Math.sin(Math.PI * Math.pow(u, .5)) : Math.sin(Math.PI * Math.pow(u, caneSide ? 1.5 : .9));
    const toe = run ? Math.sin(Math.PI * u) * lerp(-55, 20, u) : Math.sin(Math.PI * u) * (caneSide ? lerp(-10, 12, u) : lerp(-35, 15, u));
    const gy = ground ? a[1] - ank + (b[1] - a[1]) * (up ? Math.max(lead ? E.inOutSine(clamp(u / lead)) : 0, E.inOutSine(clamp(e / Math.max(xs * .85, .01)))) : e) : 0;
    return { foot: [lerp(a[0], b[0], e), ank + gy + (u <= 0 ? 0 : lift * lu), lerp(a[2], b[2], e)], swing: u, toe };
  }

  // cane tip: rides with the OPPOSITE leg's footholds, a little outside and ahead of that foot, planted when it is planted
  // FIX10 (2026-11-04, last_loaf f12-24 "the tip floats in mid-air swept forward"): a REAL cane cycle. Before, the tip swung for the
  // whole swing of the opposite foot (half the cycle) .12 legLen up, so half of every walk the tip hung in the air up to .85 D ahead of
  // the body. Now the tip stays planted while the opposite foot lifts off (it is what he leans on), leaves at CANE_GO of that foot's
  // swing, travels low (CANE_LIFT legLen) and fast, and plants WITH the foot (same frame): planted ~65 % of the cycle, tip on y = 0 and
  // bit-identical while planted.
  const CANE_GO = .3, CANE_LIFT = .05;
  function caneAt(p) {
    const opp = caneSide === 'R' ? 1 : 0;                       // L leg for an R cane
    const side = caneSide === 'R' ? hipR : hipL;
    const tipHip = [side[0] * 2.6, side[1], side[2] + .22 * Lg];
    const tipAt = k => footAtHold(k, tipHip, false);
    let tip, planted = true;
    if (p >= N + 1) tip = tipAt((N % 2 === opp) ? N : N - 1);
    else {
      const ph = legPhase(opp, p);
      const cu = ph.planted != null ? 0 : clamp((ph.u - CANE_GO) / (1 - CANE_GO));
      if (ph.planted != null) tip = tipAt(ph.planted);
      else if (cu <= 0) { tip = tipAt(ph.k - 2); }
      else {
        const a = tipAt(ph.k - 2), b = tipAt(ph.k), e = E.inOutSine(cu);
        tip = [lerp(a[0], b[0], e), ank + CANE_LIFT * Lg * Math.sin(Math.PI * cu), lerp(a[2], b[2], e)]; planted = cu >= 1;
      }
    }
    const tp = [tip[0], ground ? tip[1] - ank : Math.max(0, tip[1] - ank), tip[2]];
    return { side: caneSide, tip: tp, hand: caneHand(tp, p), planted };
  }
  // MO2 (item 14): the hand rides WITH the body (beside the hip, a touch forward) and the cane pivots on its planted tip: the hand sits
  // caneLen from the tip toward that hold point. Before, the hand stayed above the planted tip while the body walked on, the arm ran out
  // of reach, the drawn hand was pulled along and the cane (hanging straight from it) slid with the body.
  // ENG6: the hold point turns with the body's REAL heading: compose.js blends the root from the standing heading (ryStart) into the
  // path's over the first 10 f, so the hand does too (before, it used the path heading from frame 0: with a 90 deg turn into the walk
  // the cane hand jumped to the new side on the first frame). And the cane leans in from / back to upright: over the first step the
  // hand's direction from the tip blends from straight up (the standing cane: the hand above the tip, what the stance before the walk
  // and the stop after it hold) into the walking lean, and over the last step back to straight up, always caneLen from the tip.
  const angD = (a, b) => ((a - b) % 360 + 540) % 360 - 180;
  const ryBody = (s, p) => { const r = path.ry(s), k = fastIn(clamp(p * stepT / F(10))); return r - angD(r, ryS) * (1 - k); };
  const stance = opts.caneStance !== false;                    // caneStance:false = the pre-ENG6 cane (before/after strips only)
  function caneHand(tp, p) {
    const pp = Math.min(N + 1, Math.max(0, p)), s = sOf(pp), xz = path.at(s), ry = stance ? ryBody(s, pp) : path.ry(s), side = caneSide === 'R' ? hipR : hipL;
    const h = footUnder(xz[0], xz[1], ry, [side[0] * 2.4, 0, .12 * Lg], 0); h[1] = caneLen * .97 + rootG(s);
    const d = [h[0] - tp[0], h[1] - tp[1], h[2] - tp[2]], L = Math.hypot(...d) || 1;
    const up = stance ? E.inOutSine(clamp(1 - pp)) + E.inOutSine(clamp(pp - N)) : 0;   // 1 = upright (stance), 0 = walking lean
    const w = clamp(up), v = [d[0] / L * (1 - w), d[1] / L * (1 - w) + w, d[2] / L * (1 - w)], M = Math.hypot(...v) || 1;
    return [tp[0] + v[0] / M * caneLen, tp[1] + v[1] / M * caneLen, tp[2] + v[2] / M * caneLen];
  }

  // hip settle after the stop: dip a third of the bob in 3 f, back up in 6 f, then exactly 0
  const settleDY = x => {
    if (!settleT || x <= 0 || x >= settleT) return 0;
    const u = x / settleT, d = bob * .35;
    return u < 1 / 3 ? -d * E.outQuad(u * 3) : -d * (1 - fastIn((u - 1 / 3) * 1.5, 2.5));
  };

  function at(tl) {
    tl = Math.max(0, tl);
    const p = Math.min(N + 1, tl / stepT);
    const s = sOf(p), xz = path.at(s);
    let ry = path.ry(s);
    const out = { root: { x: xz[0], z: xz[1], ry }, legR: { foot: null, in: 'world' }, legL: { foot: null, in: 'world' }, hipDY: 0, armDZ: 0, bend: 0,
      walking: tl < walkDur, gait: cd.gait };
    if (ground) out.rootY = rootG(s);
    if (tl < walkDur) {
      const lr = legAt('R', p), ll = legAt('L', p);
      out.legR.foot = lr.foot; out.legL.foot = ll.foot;
      // knees forward and a little out (body space, R = -X), so the crossed noodles bow apart instead of through each other
      out.legR.bend = [-.15, 0, 1]; out.legL.bend = [.15, 0, 1];
      out.legR.toe = lr.toe || 0; out.legL.toe = ll.toe || 0;
      out.swing = { R: lr.swing, L: ll.swing };
      // speed envelope: 0 -> 1 over the first step, 1 -> 0 over the last
      const env = p < 1 ? p : p > N ? Math.max(0, 1 - (p - N) / (settleOn ? ARR : 1)) : 1;
      // bob: contact at integer p; lowest 2/15 of a step after it. v = phase from the drop start (1/5 before contact)
      const v = ((p + preV) % 1 + 1) % 1;
      const shape = v < dropV ? E.outQuad(v / dropV) : 1 - fastIn((v - dropV) / (1 - dropV), 2.5);
      // dips on contacts 1..N (shape is 0 at each drop start, so switching it on/off there is continuous); the final feet-together
      // contact at N + 1 gets the settle instead
      const bobOn = p < 1 - preV || p > N + 1 - preV ? 0 : 1;
      out.hipDY = -crouch * E.inOutSine(Math.min(1, p, Math.max(0, N + 1 - p))) - bob * shape * bobOn;
      // arms opposite the legs, extreme at each contact: R arm back as the R foot lands (compose: R hand z - armDZ, L + armDZ)
      out.armDZ = -swingA * Math.cos(Math.PI * p) * env;
      out.bend = leanDeg * E.inOutSine(clamp(settleOn && p > N ? 1 : env));   // MO2: with the settle the lean rides into the overshoot
      if (run) {
        // pumping arms: hands come up with the bent elbow as they swing forward (body space offsets [x, y, z])
        const c = Math.cos(Math.PI * p) * env;
        out.armOff = { R: [0, .18 * Math.max(0, c) * Lg, 0], L: [0, .18 * Math.max(0, -c) * Lg, 0] };
      }
      if (run) {
        // AGENT-A RUN2: a running leg (hip socket to ankle) never exceeds RUN_REACH x legLen. A planted foot can't move, so the hips
        // drop a little (max .12 legLen) until it reaches; a foot in the air is pulled toward the hip along its line = the knee folds
        // and the heel kicks up instead of the hose stretching.
        const sock = (hip, dy) => { const s = footUnder(out.root.x, out.root.z, ry, [hip[0], 0, hip[2]], 0); s[1] = ank + .93 * Lg + dy + (out.rootY || 0); return s; };
        const maxL = RUN_REACH * Lg;
        let drop = 0;
        for (const [leg, hip] of [['legR', hipR], ['legL', hipL]]) {
          const sw = out.swing[leg === 'legR' ? 'R' : 'L'], f = out[leg].foot;
          if (sw > 0 && sw < 1) continue;
          const s = sock(hip, out.hipDY), h2 = (f[0] - s[0]) ** 2 + (f[2] - s[2]) ** 2;
          if (h2 + (s[1] - f[1]) ** 2 > maxL * maxL) drop = Math.max(drop, (s[1] - f[1]) - Math.sqrt(Math.max(0, maxL * maxL - h2)));
        }
        out.hipDY -= Math.min(drop, .12 * Lg);
        for (const [leg, hip] of [['legR', hipR], ['legL', hipL]]) {
          const sw = out.swing[leg === 'legR' ? 'R' : 'L'], f = out[leg].foot;
          if (!(sw > 0 && sw < 1)) continue;
          const s = sock(hip, out.hipDY), d = [f[0] - s[0], f[1] - s[1], f[2] - s[2]], L = Math.hypot(...d);
          if (L > maxL) { const k = maxL / L; out[leg].foot = [s[0] + d[0] * k, Math.max(ank + (ground ? Math.min(f[1] - ank, out.rootY) : 0), s[1] + d[1] * k), s[2] + d[2] * k]; }
        }
      }
      if (caneSide) { out.cane = caneAt(p); out[`arm${caneSide}`] = { hand: out.cane.hand, in: 'world' }; }
      if (settleOn && p > N + ARR) overshoot(out, (p - N - ARR) * cd.stepF);
      return out;
    }
    // stop: feet planted side by side; end turn = feet step it, R in the first half, L in the second (10 f, body speed); settle dip
    const x = tl - walkDur;
    const q = turnT ? clamp(x / turnT) : 1;
    ry = lerp(ryEnd, ryFace, fastIn(q));
    out.root = { x: endP[0], z: endP[1], ry };
    const stepLeg = (hip, a, b) => {
      const u = clamp((q - a) / (b - a));
      const f0 = footUnder(endP[0], endP[1], ryEnd, hip, ank), f1 = footUnder(endP[0], endP[1], ryFace, hip, ank);
      const e = E.inOutSine(Math.min(1, u / .75));   // across first, then straight down onto the ground (no landing skid)
      return [lerp(f0[0], f1[0], e), ank + gAt(path.L) + (u <= 0 || u >= 1 ? 0 : Math.max(lift, .15 * Lg) * .7 * Math.sqrt(Math.sin(Math.PI * u))), lerp(f0[2], f1[2], e)];
    };
    out.legR.foot = stepLeg(hipR, 0, .55); out.legL.foot = stepLeg(hipL, .45, 1);
    out.hipDY = settleDY(x);
    // MO2 (item 13): arrival settle: the body carries on 2 f (fast in, a tiny overshoot: the root .03 legLen past the stop point and
    // the torso pitches forward), comes back by f5, then dead still (exact 0 from f6). Run = double.
    if (settleOn) overshoot(out, x * 30 + (1 - ARR) * cd.stepF);
    if (caneSide) {
      const tipHip = (caneSide === 'R' ? hipR : hipL), th = [tipHip[0] * 2.6, 0, tipHip[2] + .22 * Lg];
      // FIX10: the end turn no longer drags the planted tip round in an arc on the ground (last_loaf f640-652: .7 D slide, through the
      // stall): it stays planted, then lifts, swings low to its spot for the new heading and plants there (between the two foot steps)
      const t0 = footUnder(endP[0], endP[1], ryEnd, th, 0), t1 = footUnder(endP[0], endP[1], ryFace, th, 0);
      const cu = turnT ? clamp((q - .2) / .6) : 1, e = E.inOutSine(cu);
      const t = [lerp(t0[0], t1[0], e), gAt(path.L) + CANE_LIFT * Lg * Math.sin(Math.PI * cu), lerp(t0[2], t1[2], e)];
      out.cane = { side: caneSide, tip: t, hand: [t[0], caneLen + t[1], t[2]], planted: cu <= 0 || cu >= 1 }; out[`arm${caneSide}`] = { hand: out.cane.hand, in: 'world' };
    }
    out.walking = x < Math.max(turnT, settleT);
    return out;
  }
  return { dur: walkDur + Math.max(turnT, settleT), walkDur, steps: N + 1, S, L: path.L, stepT, gait: cd.gait, stepF: cd.stepF, path, at, ryEnd: ryFace,
    end: { x: endP[0], z: endP[1], ry: ryFace } };
}
