// engine/clips.js - one function per clip: clip(rest, params) -> { dur, ch: { 'path': track }, release: [...], events: [...] }.
// Times are clip-local seconds (F(n) = n frames). Values are CONTRACT Pose channels. Everything is relative to `rest`
// ({ hipY, shoulderR, shoulderL, hipR, hipL, armLen, legLen, headY }, body space: origin at the hem, +Y up, +Z facing,
// +X the character's LEFT), so a clip fits a kid or a tall man.
// Key values: '@' = the value underneath at the clip's start, { '@': d } = that + d. A path ending in '+' is additive.
// After `dur` a clip HOLDS its last values (holds are dead still, law 5) until a later clip writes the channel, except the
// channels in `release` (they fall back to what is underneath; face.* always releases).
// Sign conventions = engine/rig.js: body.bend + = torso tips forward (toward +Z), body.lean + = sideways toward +X (his left), body.twist +
// = toward his left; head.yaw + = toward his left; head.pitch + = nose UP. Hands 'body' = the hem frame (moves with bend); feet 'root' = ground frame. Prop rot in degrees (x, y, z), the
// sledge/cane swing plane is the body's Y-Z plane, handle angle a (0 = level forward, 90 = up) -> rot.x = -a.
import { F, clamp, lerp, fastIn, careful, E, hash } from './ease.js';
import { K, S, FROM } from './track.js';

const sgn = side => side === 'L' ? 1 : -1;            // R = -X
const sh = (r, side) => side === 'L' ? r.shoulderL : r.shoulderR;
const hp = (r, side) => side === 'L' ? r.hipL : r.hipR;
const ank = r => r.ankleY ?? 0;                        // foot targets are ankles: ankleY above the ground (rig rest)
// head centre above the HEM: the rig's rest.headY may be the height above the ground (character.js) or above the hem (brief)
export const hh = r => r.headY > r.hipY + .3 ? r.headY - r.hipY : r.headY;

/** Hand / foot targets in body space, all from rest. */
export const at = {
  hang: (r, s) => { const o = sh(r, s); return [o[0] * 1.15, o[1] - r.armLen * .737, .03]; },                  // = rig.js restPose for armLen .95
  hip: (r, s) => { const h = hp(r, s); return [h[0] + sgn(s) * .2, .1, h[2] + .02]; },                       // akimbo knuckles on the hip
  chest: (r, s) => { const o = sh(r, s); return [sgn(s) * .1, o[1] - .18, o[2] + .3]; },
  forward: (r, s) => { const o = sh(r, s); return [o[0] * .8, o[1] - .02, o[2] + r.armLen * .9]; },              // point / flick, arm level
  side: (r, s) => { const o = sh(r, s); return [o[0] + sgn(s) * r.armLen * .38, o[1] - r.armLen * .55, o[2] + .22]; },   // shrug: hands out low and small, palms-up feel (M2: was a T)
  up: (r, s) => { const o = sh(r, s); return [o[0] + sgn(s) * r.armLen * .45, o[1] + r.armLen * .75, o[2] + .05]; }, // panic \ /
  brim: (r, s) => [sgn(s) * .64, hh(r) + .14, .3],                                                           // M2: out of the head (the far hand hid behind it)
  temple: (r, s) => [sgn(s) * .6, hh(r) + .04, .1],
  mouth: (r) => [0, hh(r) - .38, .5],
  face: (r, s) => [sgn(s) * .28, hh(r) - .1, .55],                                                           // brace: hand up before the face
  foot: (r, s) => { const h = hp(r, s); return [h[0], ank(r), h[2]]; },                                       // a foot on the ground, ROOT space
};
const elbowOut = (s, back = -.3) => [sgn(s), 0, back];
const hangBend = s => [sgn(s) * .45, 0, -1];         // = rig.js restPose
const elbowDown = (s, out = .7, fwd = .4) => [sgn(s) * out, -.8, fwd];   // M2: hand up at the head, elbow out and DOWN (no loop over the head)

/** Dense per-frame keys from a function f(frame) -> value, frames 0..n (linear between frames = exact on ones). */
const dense = (n, f) => K(Array.from({ length: n + 1 }, (_, i) => [F(i), f(i)]), 'lin');

// ---- holds and whole-body ----

/** hold: exact zero motion (section 9 `hold`). Writes nothing: what is underneath stays bit-identical. */
export const hold = (r, { frames = 30 } = {}) => ({ dur: F(frames), ch: {} });
export const idle = hold;

/** stop: the body catches its momentum after a walk: lean +3 in 2 f, back to 0 by f8 (law 7: tiny, no rubber). */
export const stop = (r, { deg = 3 } = {}) => ({ dur: F(8),
  ch: { 'body.bend+': K([[0, 0], [F(2), deg, 'gesture'], [F(8), 0, 'fastIn']]) } });

/** turn in place: root.ry by `by` deg over 10 f (body speed, law 3); the feet step it: R f0-6, L f4-10. */
export function turn(r, { by = 90, frames = 10 } = {}) {
  const n = frames, lift = .14 * r.legLen;
  const ryAt = i => by * fastIn(i / n);
  const footStep = (s, a, b) => i => {
    const u = clamp((i / n - a) / (b - a)), lagDeg = by * E.inOutSine(u) - ryAt(i);   // foot heading minus body heading
    const h = hp(r, s), c = Math.cos(lagDeg * Math.PI / 180), si = Math.sin(lagDeg * Math.PI / 180);
    return [h[0] * c + h[2] * si, ank(r) + lift * Math.sin(Math.PI * u), -h[0] * si + h[2] * c];
  };
  return { dur: F(n), release: ['legR.foot', 'legR.in', 'legL.foot', 'legL.in'],
    ch: { 'root.ry+': dense(n, ryAt), 'legR.in': S([[0, 'root']]), 'legL.in': S([[0, 'root']]),
      'legR.foot': dense(n, footStep('R', 0, .6)), 'legL.foot': dense(n, footStep('L', .4, 1)) } };
}

const kneelH = r => r.legLen * .5;
const seatH = r => r.legLen * .42;

/** kneel: appears already done (section 3 "Sit, kneel": no transition shown). frames > 0 animates it (body speed, careful weight). */
export function kneel(r, { frames = 0, bend = 30 } = {}) {
  const T = F(frames), e = frames ? 'careful' : 'snap', hY = kneelH(r);
  return { dur: T, ch: {
    'body.hipY': K([[0, FROM], [T, hY, e]]), 'body.kneel': K([[0, FROM], [T, 1, e]]), 'body.squash': K([[0, FROM], [T, .85, e]]),
    'body.bend': K([[0, FROM], [T, bend, e]]),
    'legR.in': S([[0, 'root']]), 'legL.in': S([[0, 'root']]),
    'legR.foot': K([[0, FROM], [T, [hp(r, 'R')[0], ank(r), -.45], e]]),            // knee down, foot behind
    'legL.foot': K([[0, FROM], [T, [hp(r, 'L')[0], ank(r), .42], e]]),             // front foot flat
    'legR.bend': K([[0, [0, 0, 1]]]), 'legL.bend': K([[0, [0, 0, 1]]]) } };
}

/** Seated feet (root space) for a seat height (D, the seat surface = the hem height): knees forward, shins down. M2: the feet
 *  go further forward on a low seat (thigh ~ .45 legLen forward, shin to the ground), a touch apart; a high seat (> standing
 *  hip height * .9) dangles them under the knees. */
// FIX-SEAT: thigh .45 -> .58 legLen: the knees used to end AT the front edge of a bench sat on at its centre mark, so the lap, the knee
// and the shins hid behind the seat's front face; now the knees overhang it and the shins come down in front of it
const seatFeet = (r, seat, s) => { const h = hp(r, s), thigh = .58 * r.legLen, shin = Math.max(0, seat - ank(r)), dangle = seat > r.hipY * .9;
  return [h[0] * 1.3, dangle ? Math.max(ank(r), seat - r.legLen * .55) : ank(r), h[2] + thigh + (dangle ? 0 : Math.max(0, r.legLen * .5 - shin) * .6)]; };

/** FIX-SEAT (2026-11-04, blind3 Nora: no legs, body sunk into the bench): `seat` is the seat SURFACE. The hem used to go exactly
 *  there, so the hip sockets (below the hem) and the whole thigh line ran INSIDE the seat slab: the slab hid the legs and the lap
 *  from every camera above seat height (and the skirt drape folded under the seat). The hem now rests where the thighs lie ON the
 *  surface: socket drop + the leg's half width + 1.5 cm. Exported so compose (seated reach) uses the same number. */
export const seatHem = (r, seat) => seat + Math.max(0, -hp(r, 'R')[1]) + Math.max(0, ank(r) - .005) + .015;

/** sit: appears seated (section 3). seat = seat height above ground (D) = where the hem rests. */
export function sit(r, { seat = seatH(r), frames = 0 } = {}) {
  const T = F(frames), e = frames ? 'careful' : 'snap';
  return { dur: T, ch: {
    'body.hipY': K([[0, FROM], [T, seatHem(r, seat), e]]), 'body.sit': K([[0, FROM], [T, 1, e]]), 'body.bend': K([[0, FROM], [T, 0, e]]),
    'legR.in': S([[0, 'root']]), 'legL.in': S([[0, 'root']]),
    'legR.foot': K([[0, FROM], [T, seatFeet(r, seat, 'R'), e]]), 'legL.foot': K([[0, FROM], [T, seatFeet(r, seat, 'L'), e]]),
    'legR.bend': K([[0, [-.1, .6, 1]]]), 'legL.bend': K([[0, [.1, .6, 1]]]) } };
}

/** sit_down: not in his video (section 10); built from the laws: lean in 4 f (body), hips down 14 f careful (weight), lean back by f16.
 *  seat = seat height (D); the feet step forward to seatFeet while the hips go down. */
export function sit_down(r, { seat = seatH(r) } = {}) {
  return { dur: F(16), ch: {
    'body.bend': K([[0, FROM], [F(4), 18, 'fastIn'], [F(10), 14, 'lin'], [F(16), 0, 'fastIn']]),
    'body.hipY': K([[0, FROM], [F(2), FROM], [F(14), seatHem(r, seat), 'careful']]), 'body.sit': S([[0, 0], [F(12), 1]]),
    'legR.in': S([[0, 'root']]), 'legL.in': S([[0, 'root']]),
    'legR.foot': K([[0, at.foot(r, 'R')], [F(4), at.foot(r, 'R')], [F(14), seatFeet(r, seat, 'R'), 'careful']]),
    'legL.foot': K([[0, at.foot(r, 'L')], [F(4), at.foot(r, 'L')], [F(14), seatFeet(r, seat, 'L'), 'careful']]),
    'legR.bend': K([[0, [-.1, .6, 1]]]), 'legL.bend': K([[0, [.1, .6, 1]]]) } };
}

/** sit_back (FX1, the last step of a timeline `sit_on`): standing just in front of a seat, facing away from it, he sits BACK onto it with
 *  the feet planted: the root slides back `back` D (default = how far seated feet sit in front of the hips, so the feet end exactly at
 *  seatFeet) while the root-space feet move forward by the same eased amount, so in the world they never move (no slide). Lean 4 f,
 *  hips + root back f4-14 careful, lean back by f16 (= sit_down's timing). `ry` = the facing (deg) the back move goes against.
 *  Its root move is permanent (compose keeps a seat clip's root channels after a stand_up ends the seat). */
export function sit_back(r, { seat = seatH(r), back = null, ry = 0, shift = null } = {}) {
  const fR = seatFeet(r, seat, 'R'), hR = hp(r, 'R'), hL = hp(r, 'L');
  const d = back ?? Math.max(0, fR[2] - hR[2]), a = ry * Math.PI / 180;
  // ENG10: `shift` [dx, dz] (world) = the root's whole move onto the seat (compose's sit_on: the hips land ON the seat point even when he
  // did not stand exactly in front of it); default = `back` D against the facing (the feet then stay planted)
  const bx = Array.isArray(shift) ? shift[0] : -Math.sin(a) * d, bz = Array.isArray(shift) ? shift[1] : -Math.cos(a) * d;
  const foot = s => { const h = hp(r, s); return K([[0, [h[0], ank(r), h[2]]], [F(4), [h[0], ank(r), h[2]]], [F(14), [h[0], ank(r), h[2] + d], 'careful']]); };
  return { dur: F(16), back: d, ch: {
    'body.bend': K([[0, FROM], [F(4), 18, 'fastIn'], [F(10), 14, 'lin'], [F(16), 0, 'fastIn']]),
    'body.hipY': K([[0, FROM], [F(4), FROM], [F(14), seatHem(r, seat), 'careful']]), 'body.sit': S([[0, 0], [F(12), 1]]),
    'root.x+': K([[0, 0], [F(4), 0], [F(14), bx, 'careful']]), 'root.z+': K([[0, 0], [F(4), 0], [F(14), bz, 'careful']]),
    'legR.in': S([[0, 'root']]), 'legL.in': S([[0, 'root']]),
    'legR.foot': foot('R'), 'legL.foot': foot('L'),
    'legR.bend': K([[0, [-.1, .6, 1]]]), 'legL.bend': K([[0, [.1, .6, 1]]]) } };
}
/** the distance sit_back moves the root back for a seat height (D): the seated feet's reach in front of the hips */
export const sitBackDist = (r, seat = seatH(r)) => Math.max(0, seatFeet(r, seat, 'R')[2] - hp(r, 'R')[2]);

/** stand_up from a kneel or a seat (section 3 "Stand up", section 9): anticipate DOWN +14 deg over 7 f, hold 2,
 *  rise slow 10 f (about 45 %), fast 6 f, settle 4 f with < 1 deg overshoot. Near (R) hand down f19-23, far (L) f21-28. */
// fix1 (Fable R1): from a seat the root steps FORWARD `fwd` D along the facing `ry` while the hips rise (the mirror of sit_back): the sit
// mark is the hip point .14 D behind the seat's front edge, so standing up in place put the legs behind the plank. The root-space feet go
// from the seated feet to under the hips with the same ease, so in the world they stay planted. compose fills ry + fwd (sitBackDist).
export function stand_up(r, { from = 'kneel', near = 'R', ry = 0, fwd = 0 } = {}) {
  const far = near === 'R' ? 'L' : 'R';
  const rise0 = F(9), slow = F(19), fast = F(25), end = F(29);
  const fa = ry * Math.PI / 180, mv = from === 'sit' && fwd > 0;
  const rootFwd = mv ? { 'root.x+': K([[0, 0], [rise0, 0], [fast, Math.sin(fa) * fwd, 'inOutSine']]), 'root.z+': K([[0, 0], [rise0, 0], [fast, Math.cos(fa) * fwd, 'inOutSine']]) } : {};
  // lean (+ = forward): +14 anticipation, slow phase covers ~45 % of the unfold (2.5 deg/f), fast 6 f to -.8 (past upright,
  // his +1.5 overshoot), settle 4 f. Hips rise mostly in the fast phase (the torso unfolds first).
  return { dur: end, release: ['legR.foot', 'legR.in', 'legL.foot', 'legL.in', 'legR.bend', 'legL.bend'], ch: {
    'body.bend': K([[0, FROM], [F(7), { '@': 14 }, 'outSine'], [rise0, { '@': 14 }], [slow, { '@': -6 }, 'lin'], [fast, -.8, 'outQuad'], [F(27), -1, 'outSine'], [end, 0, 'inOutSine']]),
    'body.hipY': K([[0, FROM], [rise0, FROM], [F(14), { '@': (r.hipY - (from === 'sit' ? seatHem(r, seatH(r)) : kneelH(r))) * .3 }, 'inQuad'], [fast, r.hipY, 'outQuad'], [end, r.hipY]]),
    'body.kneel': K([[0, FROM], [F(22), FROM], [F(24), 0, 'lin']]),
    'body.sit': mv ? K([[0, FROM], [rise0, FROM], [fast, 0, 'inOutSine']]) : K([[0, FROM], [F(14), 0, 'snap']]),
    'body.squash': K([[0, FROM], [rise0, FROM], [fast, 1, 'outQuad']]),
    ...rootFwd,
    'legR.in': S([[0, 'root']]), 'legL.in': S([[0, 'root']]),
    'legR.foot': K([[0, FROM], [rise0, FROM], [fast, at.foot(r, 'R'), 'inOutSine']]),
    'legL.foot': K([[0, FROM], [rise0, FROM], [fast, at.foot(r, 'L'), 'inOutSine']]),
    [`arm${near}.hand`]: K([[0, FROM], [F(19), FROM], [F(23), at.hang(r, near), 'gesture']]),
    [`arm${far}.hand`]: K([[0, FROM], [F(21), FROM], [F(28), at.hang(r, far), 'fastIn']]),
  } };
}

/** lean_over (boss f417-433): anticipate -3 deg over 3 f, face snaps f2, body goes f3: 10 f fastIn (60-70 % in the first 4). */
export function lean_over(r, { deg = 30, eyes = null } = {}) {
  const ch = { 'body.bend': K([[0, FROM], [F(3), { '@': -deg * .1 }, 'outSine'], [F(13), { '@': deg }, 'fastIn']]) };
  if (eyes) ch['face.eyes'] = S([[F(2), eyes]]);
  return { dur: F(13), ch };
}

/** lean_back (boss f463-477): 5 fast, 4 slow, overshoot -.5 deg, settled f11. */
export const lean_back = (r, { to = 0 } = {}) => ({ dur: F(11),
  ch: { 'body.bend': K([[0, FROM], [F(9), to - .5, 'fastIn'], [F(11), to, 'inOutSine']]) } });

/** hop_bounce (boss f1345-1370): crouch 4 f (-.09 D), then `count` bounces of 8 f, parabola .4 D high (rise decelerates,
 *  fall accelerates, lands fastest), landing squash 1 f, no hold. Feet stay planted: legs stretch. Park the camera. */
// his head y per frame f1345-1366 (px, R 103, parked camera) as a shape in units of the peak: crouch 4, bounce 8, bounce 8, settle 1.
// Rise decelerates (30 30 20 3 px/f), fall accelerates (14 26 50), lands below rest (squash .1 R) and rebounds at once.
const HOP_CROUCH = [0, -.094, -.214, -.282];
const HOP_BOUNCE = [[-.107, .295, .693, .961, 1, .812, .466, -.201], [-.094, .359, .718, .919, .893, .667, .294, -.188]];
export function hop_bounce(r, { height = .36, count = 2 } = {}) {
  const seq = [...HOP_CROUCH];
  for (let b = 0; b < count; b++) seq.push(...HOP_BOUNCE[Math.min(b, 1)]);
  seq.push(-.08, 0);
  const n = seq.length - 1;
  // Q3: body.stretch = 1 while hopping: the planted feet don't pull the hips back down (character.js pelvis drop off), the legs stretch
  // (up to 1.25 x legLen; a short-legged kid's toes leave the ground at the top). Without it the hop was eaten by the drop: no hop.
  return { dur: F(n), release: ['body.stretch'], ch: { 'body.hipY+': dense(n, i => seq[i] * height), 'body.squash+': dense(n, i => seq[i] < -.15 && i > 3 ? -.03 : 0),
    'body.stretch': S([[0, 1]]) } };
}

// ---- gestures (section 4) ----

/** point: arm to level in 4 f, then held (cane point f535-541; "arm stays small"). */
export const point = (r, { side = 'R', dir = null } = {}) => ({ dur: F(4), ch: {
  [`arm${side}.hand`]: K([[0, FROM], [F(4), dir ? (() => { const o = sh(r, side); const L = Math.hypot(...dir) || 1; return dir.map((d, i) => o[i] + d / L * r.armLen * .9); })() : at.forward(r, side), 'gesture']]),
  [`arm${side}.bend`]: K([[0, elbowOut(side, -.5)]]),
  [`arm${side}.clear`]: K([[0, 0], [F(4), 1, 'gesture']]) } });   // FX1: a raised point never crosses the drawn face (character.js)

/** wave (engineer f369-384): hip -> brim 3 f, hold 8, wave 4 (lift + slide), down 4. Eyes switch at start and end.
 *  M2: hand by the side of the cap brim, in front of the body plane (visible from 3/4), elbow out and down. hold = frames at
 *  the brim before the wave (8); down = false keeps the hand up at the brim after the wave (then compose `hold` / `out`). */
export function wave(r, { side = 'R', eyes = null, hold = 8, down = true } = {}) {
  const b = at.brim(r, side), lifted = [b[0] + sgn(side) * .12, b[1] + .12, b[2] - .04];
  const h = 3 + hold, end = h + 4 + (down ? 4 : 0);
  const ch = {
    [`arm${side}.hand`]: K([[0, FROM], [F(3), b, 'gesture'], [F(h), b], [F(h + 2), lifted, 'gesture'], [F(h + 4), b, 'gesture'], ...(down ? [[F(end), at.hang(r, side), 'gesture']] : [])]),
    [`arm${side}.bend`]: K([[0, FROM], [F(1), elbowDown(side, .8, .3), 'snap'], ...(down ? [[F(h + 5), FROM, 'snap']] : [])]),
    // FX1: the waving hand stays off the drawn face (character.js pushes it beside the head outline when it would cross it)
    [`arm${side}.clear`]: K([[0, 0], [F(3), 1, 'gesture'], ...(down ? [[F(h + 4), 1], [F(end), 0, 'gesture']] : [])]),
  };
  if (eyes) ch['face.eyes'] = S([[0, eyes], [F(h + 5), FROM]]);
  return { dur: F(end), ch };
}

/** akimbo: a resting pose, hand to the hip in 4 f (fastIn), then holds through everything (hops included). */
export function akimbo(r, { side = 'R', frames = 4 } = {}) {   // ENG7 timing audit: 4 f (MOTION_BIBLE gesture 2-4 f; was 7)
  const sides = side === 'both' ? ['R', 'L'] : [side], ch = {};
  for (const s of sides) { ch[`arm${s}.hand`] = K([[0, FROM], [F(frames), at.hip(r, s), 'fastIn']]); ch[`arm${s}.bend`] = K([[0, FROM], [F(2), elbowOut(s, -.1), 'snap']]); }
  return { dur: F(frames), ch };
}

/** shrug (worker f246-247): one-frame snap: arms out level, head up off the torso; holds 8 f, back in 4 ("leave soon"). */
export const shrug = (r, { hold = 8 } = {}) => ({ dur: F(hold + 4), ch: {
  'armR.hand': K([[0, FROM], [F(1), at.side(r, 'R'), 'snap'], [F(1 + hold), at.side(r, 'R')], [F(hold + 4), FROM, 'gesture']]),
  'armL.hand': K([[0, FROM], [F(1), at.side(r, 'L'), 'snap'], [F(1 + hold), at.side(r, 'L')], [F(hold + 4), FROM, 'gesture']]),
  'armR.bend': K([[0, FROM], [F(1), [-.5, -1, -.2], 'snap'], [F(hold + 4), FROM, 'snap']]),
  'armL.bend': K([[0, FROM], [F(1), [.5, -1, -.2], 'snap'], [F(hold + 4), FROM, 'snap']]),
  'body.squash+': K([[0, 0], [F(1), .07, 'snap'], [F(1 + hold), .07], [F(hold + 4), 0, 'gesture']]),
  'head.pitch+': K([[0, 0], [F(1), 8, 'snap'], [F(1 + hold), 8], [F(hold + 4), 0, 'gesture']]) } });

/** hand_to_temple (cloth to temple f1110-1133): up 3 f, park `hold` f (20+) while the face acts, down 4. */
// Q3: `armX.temple` (0..1, rides with the hand) tells character.js to put the hand BESIDE the drawn head, on that hand's side of the
// outline as the camera sees it, at temple height (the body-space temple point landed on the face whenever that side faced the camera).
export const hand_to_temple = (r, { side = 'R', hold = 24, down = true } = {}) => ({ dur: F(3 + hold + (down ? 4 : 0)), ch: {
  [`arm${side}.hand`]: K([[0, FROM], [F(3), at.temple(r, side), 'gesture'], [F(3 + hold), at.temple(r, side)], ...(down ? [[F(7 + hold), FROM, 'gesture']] : [])]),
  [`arm${side}.temple`]: K([[0, 0], [F(3), 1, 'gesture'], [F(3 + hold), 1], ...(down ? [[F(7 + hold), 0, 'gesture']] : [])]),
  [`arm${side}.bend`]: K([[0, FROM], [F(1), elbowDown(side), 'snap'], ...(down ? [[F(5 + hold), FROM, 'snap']] : [])]),
  [`arm${side}.over`]: S([[0, true], ...(down ? [[F(6 + hold), false]] : [])]) } }); // Q: the hand is meant to touch the head (checks skip it)

/** brace (wind f92-97): face snaps at 0 (optional), hand up 3 f from f2 (.27 D/f). */
export function brace(r, { side = 'L', eyes = 'wince' } = {}) {
  const ch = { [`arm${side}.hand`]: K([[0, FROM], [F(2), FROM], [F(5), at.face(r, side), 'lin']]),
    [`arm${side}.bend`]: K([[0, FROM], [F(2), elbowOut(side, .1), 'snap']]), 'body.bend+': K([[0, 0], [F(1), -2, 'snap']]) };
  if (eyes) ch['face.eyes'] = S([[0, eyes]]);
  return { dur: F(5), ch };
}

/** talk_hands: small gestures while talking (section 4 + 7: arms parked, one hand moves, no nods). Every 1-1.6 s (hashed),
 *  the hand goes to one of 3 chest poses in 3 f and parks. dur in seconds. */
export function talk_hands(r, { dur = 3, side = 'R', seed = 1 } = {}) {
  const keys = [[0, FROM]]; let t = F(4), i = 0;
  const c = at.chest(r, side), poses = [c, [c[0] + sgn(side) * .18, c[1] + .06, c[2] + .05], [c[0] + sgn(side) * .08, c[1] - .14, c[2] + .12]];
  while (t < dur - F(6)) { const p = poses[Math.floor(hash(i, seed) * 3)]; keys.push([t, keys[keys.length - 1][1]], [t + F(3), p, 'gesture']); t += 1 + .6 * hash(i + 17, seed); i++; }
  keys.push([dur - F(4), keys[keys.length - 1][1]], [dur, FROM, 'gesture']);
  return { dur, ch: { [`arm${side}.hand`]: K(keys), [`arm${side}.bend`]: K([[0, elbowOut(side, -.4)]]) } };
}

// ---- props (section 5): a prop is rigid, no lag of its own ----

/** carry: prop held at the chest in both hands or one (4 f gesture), held while walking. */
export function carry(r, { prop = 'box', side = 'both' } = {}) {
  const ch = {}, sides = side === 'both' ? ['R', 'L'] : [side];
  for (const s of sides) { const c = at.chest(r, s); ch[`arm${s}.hand`] = K([[0, FROM], [F(4), [c[0] + sgn(s) * .12, c[1] - .05, c[2] + .1], 'gesture']]); ch[`arm${s}.grip`] = S([[0, prop]]); }
  ch[`props.${prop}`] = S([[0, { in: `hand:${sides[0]}`, at: [0, 0, 0], rot: [0, 0, 0] }]]);
  return { dur: F(4), ch };
}

/** sledge_swing / use_prop (tycoon f755-784), handle angle per frame from the table (deg, 0 = level forward, 90 = up):
 *  windup -15 -> 70 in 3 (decel), -> 125 by f6, top held f6-10, strike 125 95 50 -30 (accelerating, stops dead), hit held 7,
 *  recoil -15, +5, lift to 75. Body counter-moves: back -12 deg over 7 f (f3-9), forward +6 over 4 (f10-13), stops. Face snaps
 *  on the hit (f13). Event 'sparks' at f15 (2-3 f after contact). */
const SLEDGE = [-15, 12, 38, 70, 75, 100, 125, 125, 125, 125, 125, 95, 50, -30, -30, -30, -30, -30, -30, -30, -33, -15, 5, 5, 5, 5, 5, 60, 68, 75];
export function sledge_swing(r, { prop = 'sledge', eyes = 'wince', mouth = 'grid' } = {}) {
  const n = SLEDGE.length - 1, piv = [0, sh(r, 'R')[1] - .1, .12];
  const hand = (rad, i) => { const a = SLEDGE[i] * Math.PI / 180; return [piv[0], piv[1] + rad * Math.sin(a), piv[2] + rad * Math.cos(a)]; };
  // back over f3-9 (decel), forward f10-13 (accel, stops dead on the hit), held through the hit, eases home with the recoil lift
  const lean = [0, 0, 0, 0, -3, -6, -8.5, -10, -11, -12, -12, -6, 0, 6, 6, 6, 6, 6, 6, 6, 6, 5, 3.5, 2.2, 1.2, .5, .15, 0];
  return { dur: F(n), events: [{ t: F(13), name: 'impact' }, { t: F(15), name: 'sparks' }], ch: {
    'armR.hand': dense(n, i => hand(r.armLen * .62, i)), 'armL.hand': dense(n, i => hand(r.armLen * .42, i)),
    'armR.grip': S([[0, prop]]), 'armL.grip': S([[0, prop]]),
    [`props.${prop}`]: S([[0, { in: 'hand:R' }]]),
    [`props.${prop}.rot`]: dense(n, i => [-SLEDGE[i], 0, 0]),
    'body.bend+': dense(n, i => lean[Math.min(i, lean.length - 1)]),
    'face.eyes': S([[F(13), eyes]]), 'face.mouth': S([[F(13), mouth]]) } };
}
export const swing = sledge_swing;
export const use_prop = sledge_swing;

/** sip (cup f828-845): carry 18 f careful (up 4, flat 6, down 8+), head still, both hands (saucer lower); eyes relax on arrival. */
// Q3: the face is the author's: sip writes face.eyes only when asked (`eyes: '<name>'` or `face: true` = 'half'); the timeline's face
// keys win anyway (compose.js), and the eyes go back to whatever the face is doing THEN (not the start value).
export function sip(r, { hold = 20, eyes = null, face = false, prop = null } = {}) {
  const m = at.mouth(r), saucer = [m[0] + .05, m[1] - .22, m[2] - .05];
  const n = 18 + hold + 18;
  const pc = prop ? { [`props.${prop}`]: S([[0, { in: 'hand:R', at: [0, 0, 0], rot: [0, 0, 0] }]]), 'armR.grip': S([[0, prop]]) } : {};   // M2: the cup rides the hand
  const ey = eyes || (face ? 'half' : null);
  return { dur: F(n), ch: { ...pc,
    'armR.hand': K([[0, FROM], [F(18), m, 'careful'], [F(18 + hold), m], [F(n), FROM, 'careful']]),
    'armL.hand': K([[0, FROM], [F(18), saucer, 'careful'], [F(18 + hold), saucer], [F(n), FROM, 'careful']]),
    'armR.bend': K([[0, elbowOut('R', -.2)]]), 'armL.bend': K([[0, elbowOut('L', -.2)]]),
    ...(ey ? { 'face.eyes': S([[F(18), ey], [F(18 + hold), FROM]]) } : {}), 'armR.over': S([[0, true], [F(n), false]]),
    // MO2 (item 11): while the cup is at the mouth the lips are shut (v_M, under the cup) and character.js puts the drinking hand
    // IN FRONT of the drawn mouth as the camera sees it (armR.drink 0..1 rides the hand), so the cup covers the mouth, not the reverse
    'face.mouth': S([[F(13), 'v_M'], [F(18 + hold + 5), FROM]]),
    'armR.drink': K([[0, 0], [F(8), 0], [F(18), 1, 'careful'], [F(18 + hold), 1], [F(n - 6), 0, 'careful']]) } }; // Q: cup at the mouth on purpose
}

/** flick_toss (clamp flick f618-628): chest -> full arm 3 f, no wind-up, release at full extension (f3), arm holds 11+ f. */
export function flick_toss(r, { side = 'R', prop = null, hold = 12 } = {}) {
  const ch = { [`arm${side}.hand`]: K([[0, FROM], [F(1), at.chest(r, side), 'gesture'], [F(4), at.forward(r, side), 'gesture'], [F(4 + hold), at.forward(r, side)]]) };
  const events = [{ t: F(4), name: 'release', prop }];
  if (prop) { ch[`props.${prop}`] = S([[0, { in: `hand:${side}` }], [F(4), { in: 'release', t: F(4) }]]); ch[`arm${side}.grip`] = S([[0, prop], [F(4), null]]); }
  return { dur: F(4 + hold), ch, events };
}

// ---- reactions (section 6) ----

/** shock_pop: eyes snap to rings at f0; optional body at +1 (lean back 4 deg over 3 f). */
export function shock_pop(r, { body = false, eyes = 'wide' } = {}) {
  const ch = { 'face.eyes': S([[0, eyes]]) };
  if (body) ch['body.bend+'] = K([[0, 0], [F(1), 0], [F(4), -4, 'fastIn']]);
  return { dur: body ? F(4) : F(1), ch };
}

/** react (MO2, FABLE_REVIEW2 item 4; his f420-431): the BODY half of a strong expression. The eyes snap on frame 0 (the face key /
 *  the clip's `eyes`), the head leads on +1, the body goes on +2 and gets ~85 % of the way by +5 (fastIn), a 1-2 deg overshoot,
 *  settled by +9, then dead still for `hold` frames, then back home in `back` frames (fastIn). kinds:
 *  recoil (shock: back -deg 18, head up + back), lean_in (anger: forward +12, chin down), slump (sad: forward +10, squash .96, head down),
 *  jolt (wince / pain: a 2 f flinch back -8 that springs to -3 and holds). Seated characters react from the seat (bend only, no hip move).
 *  hold = frames (default 40; Infinity = stays until a later clip writes the body), back = frames (10). */
export const REACT = { recoil: { bend: -18, pitch: 9, roll: 0 }, lean_in: { bend: 12, pitch: -6, roll: 0 }, slump: { bend: 10, pitch: -12, roll: 3, squash: -.04 },
  jolt: { bend: -8, pitch: 5, roll: 0, settle: .4 } };
export function react(r, { kind = 'recoil', deg = null, hold = 40, back = 10, eyes = null, mouth = null } = {}) {
  const K0 = REACT[kind] || REACT.recoil, s = deg == null ? 1 : deg / Math.abs(K0.bend || 1);
  const B = K0.bend * s, P = K0.pitch * s, end = K0.settle ? B * K0.settle : B;
  const tail = Number.isFinite(hold) ? [[F(9 + hold), end], [F(9 + hold + back), 0, 'fastIn']] : [];
  const bend = kind === 'jolt'
    ? K([[0, 0], [F(1), 0], [F(3), B, 'gesture'], [F(6), end * 1.15, 'fastIn'], [F(8), end, 'inOutSine'], ...tail])
    // ENG7 timing audit (b): his body speed: ~64 % by +4, ~75 % by +5 (fastIn over 8 f from +1), a 6 % overshoot at +9, settled +12 (was 100 % by +5)
    : K([[0, 0], [F(1), 0], [F(9), B * 1.06, 'fastIn'], [F(12), B, 'inOutSine'], ...(hold >= 3 ? tail : [])]);
  // head leads: starts on +1, at ~90 % by +3, its own little overshoot, then holds; goes home with the body
  const ph = K([[0, 0], [F(1), P * .35, 'snap'], [F(3), P * 1.1, 'gesture'], [F(6), P, 'inOutSine'], ...(Number.isFinite(hold) ? [[F(9 + hold), P], [F(9 + hold + back), 0, 'fastIn']] : [])]);
  const ch = { 'body.bend+': bend, 'head.pitch+': ph };
  if (K0.roll) ch['head.roll+'] = K([[0, 0], [F(1), 0], [F(6), K0.roll * s, 'fastIn'], ...(Number.isFinite(hold) ? [[F(9 + hold), K0.roll * s], [F(9 + hold + back), 0, 'fastIn']] : [])]);
  if (K0.squash) ch['body.squash+'] = K([[0, 0], [F(2), 0], [F(7), K0.squash * s, 'fastIn'], ...(Number.isFinite(hold) ? [[F(9 + hold), K0.squash * s], [F(9 + hold + back), 0, 'fastIn']] : [])]);
  if (eyes) ch['face.eyes'] = S([[0, eyes]]);
  if (mouth) ch['face.mouth'] = S([[0, mouth]]);
  return { dur: Number.isFinite(hold) ? F(9 + hold + back) : F(9), ch };
}
/** the default body reaction of a face key (compose.js: a `face` key with these eyes / mouth gets a `react` unless `react: false`) */
export const REACT_OF = { eyes: { wide: 'recoil', wince: 'jolt', angry: 'lean_in', sad: 'slump' }, mouth: { o: 'recoil', wide: 'recoil', grid: 'jolt' } };

/** raise_prop (MO2, item 5): a held prop travels on an ARC to a new place: anticipation `antic` f (the hand dips .08 D and pulls
 *  in), then `frames` f (4-8) fastIn along a curve that bulges out sideways + forward (never a straight pop), a 1-frame overshoot,
 *  then holds. to = 'up' (overhead, umbrella), 'chest', 'forward', 'mouth', 'side' or a body-space [x, y, z]. prop (optional) =
 *  the prop id riding hand:<side> (+ grip). Pair a prop opt key (`open: 1`, ease .1) at t0 + (antic + frames - 2) f (FILM_API). */
export function raise_prop(r, { side = 'R', to = 'up', frames = 6, antic = 2, prop = null, bulge = .25, rot = null, rotFrom = null } = {}) {
  const o = sh(r, side), tgt = Array.isArray(to) ? to
    : to === 'up' ? [o[0] + sgn(side) * .12, o[1] + r.armLen * .8, o[2] + .12]
    : to === 'chest' ? at.chest(r, side) : to === 'forward' ? at.forward(r, side) : to === 'mouth' ? at.mouth(r) : to === 'side' ? at.side(r, side) : at.forward(r, side);
  const n = antic + frames, ch = {};
  // the arc: a quadratic Bezier from where the hand is (FROM, read per frame by the track as '@') through a control point pushed out
  // sideways + forward; dense keys on ones so the arc is exact. The anticipation dips first.
  ch[`arm${side}.hand`] = { at(t, from) {
    const a = from || at.hang(r, side), i = Math.round(t * 30);
    if (i <= 0) return [...a];
    if (i <= antic) { const k = E.outQuad(i / antic); return [a[0] - sgn(side) * .03 * k, a[1] - .08 * k, a[2] - .04 * k]; }
    const d = [a[0] - sgn(side) * .03, a[1] - .08, a[2] - .04];
    if (i >= n + 2) return [...tgt];
    const u = i >= n ? 1 : fastIn((i - antic) / frames, 2);
    const ov = i === n ? 1.04 : i === n + 1 ? .99 : 1;               // a tiny overshoot past the end, back on the next frame
    const mid = [(d[0] + tgt[0]) / 2 + sgn(side) * bulge, (d[1] + tgt[1]) / 2, (d[2] + tgt[2]) / 2 + bulge * .8];
    const q = Math.min(1, u), p = [0, 1, 2].map(j => (1 - q) * (1 - q) * d[j] + 2 * (1 - q) * q * mid[j] + q * q * tgt[j]);
    return ov === 1 ? p : [0, 1, 2].map(j => d[j] + (p[j] - d[j]) * ov);
  } };
  ch[`arm${side}.bend`] = K([[0, FROM], [F(antic + 1), elbowDown(side, .8, .2), 'snap']]);
  if (prop) {
    // the prop turns with the arc (rotFrom -> rot, deg, same easing as the hand), e.g. an umbrella hanging tip-down swings up to overhead
    const r0 = rotFrom || rot || [0, 0, 0], r1 = rot || [0, 0, 0];
    ch[`props.${prop}`] = { at(t) { const i = Math.round(t * 30), u = i <= antic ? 0 : i >= n ? 1 : fastIn((i - antic) / frames, 2);
      return { in: `hand:${side}`, at: [0, 0, 0], rot: r0.map((a, j) => a + (r1[j] - a) * u) }; } };
    ch[`arm${side}.grip`] = S([[0, prop]]);
  }
  return { dur: F(n + 2), ch };
}
export const open_umbrella = (r, p = {}) => raise_prop(r, { to: 'up', ...p });

/** shock_jump (tycoon f1617-1620): head +.21 D over 4 f (9 16 21 11 px/f profile), arms up at +2 in 2 f, then frozen. */
export function shock_jump(r, { height = .21, arms = true, eyes = 'wide' } = {}) {
  const prof = [0, 9, 25, 46, 57].map(v => v / 57 * height);
  const ch = { 'face.eyes': S([[0, eyes]]), 'body.hipY+': K(prof.map((v, i) => [F(i), v]), 'lin') };
  if (arms) for (const s of ['R', 'L']) ch[`arm${s}.hand`] = K([[0, FROM], [F(2), FROM], [F(4), at.up(r, s), 'gesture']]);
  return { dur: F(4), ch };
}

/** wince (wind blast f92-93): pre-wince 1 f (eyes half), face snaps, torso shifts in one frame one frame later. */
export const wince = (r, { mouth = 'grid' } = {}) => ({ dur: F(2), ch: {
  'face.eyes': S([[0, 'half'], [F(1), 'wince']]), 'face.mouth': S([[F(1), mouth]]), 'face.brow': S([[F(1), 'knit']]),
  'body.bend+': K([[0, 0], [F(2), -3, 'snap']]) } });

// ---- head ----

/** head_turn (engineer f1419-1424): blink 2, smear 1 (no face), overshoot 1, settled. Everything on the head changes side. */
export function head_turn(r, { yaw = 40 } = {}) {
  return { dur: F(5), ch: {
    'face.eyes': S([[0, 'blink'], [F(2), FROM]]), 'face.on': S([[F(2), false], [F(3), true]]),
    'face.flip': S([[F(3), yaw > 0 ? 1 : -1]]),
    'head.yaw': K([[0, FROM], [F(1), FROM], [F(2), { '@': yaw * .6 }, 'snap'], [F(3), { '@': yaw * 1.12 }, 'snap'], [F(4), { '@': yaw }, 'snap']]) } };
}

/** look_at: head turns toward a world point; compose times it (4 f, fastIn) and tracks a moving target. */
export const look_at = (r, { at: p = null } = {}) => ({ dur: 0, ch: { 'look.at': S([[0, p]]) }, release: [] });

// ---- extra clips from section 9 (hats, saw, cane, release) ----

/** saw_stroke (engineer f0-38, s3 + s9): push 7 f (accelerating), sharp turn 2, pull 6 f; lean +8 deg in phase with the push,
 *  hand rises .2 D on the push. Repeat `count` (2-3 max). Hand moves in body space around `at` (default chest-low forward). */
export function saw_stroke(r, { side = 'R', count = 2, reach = .32, at: c0 = null } = {}) {
  const c = c0 || [sgn(side) * .1, sh(r, side)[1] - .55, .45];
  const back = [c[0], c[1], c[2] - reach / 2], fwd = [c[0] + sgn(side) * -.04, c[1] + .2, c[2] + reach / 2];
  const hk = [[0, FROM], [F(2), back, 'gesture']], lk = [[0, 0], [F(2), 0]];
  let f = 2;
  for (let i = 0; i < count; i++) {
    hk.push([F(f + 7), fwd, 'inQuad'], [F(f + 9), [fwd[0], fwd[1] - .03, fwd[2] - .03], 'lin'], [F(f + 15), back, 'outQuad']);
    lk.push([F(f + 7), 8, 'inQuad'], [F(f + 9), 7, 'lin'], [F(f + 15), 0, 'outQuad']);
    f += 15;
  }
  return { dur: F(f), ch: { [`arm${side}.hand`]: K(hk), 'body.bend+': K(lk), [`arm${side}.bend`]: K([[0, elbowOut(side, -.6)]]) } };
}

/** cap_lift (wind f96-102, s5): 7 f: tilt -20 -42 -59 -60 -47 -20 -9, shift .08 .29 .40 .39 .31 .11 .02 D, lift .02 .22 .26
 *  .28 .29 .13 .11 D, then back on the head. Hat channels are head space. Start it 3 f after the face snap. dir = +1 / -1 (x side). */
export function cap_lift(r, { dir = 1 } = {}) {
  const tilt = [0, -20, -42, -59, -60, -47, -20, -9, 0], sx = [0, .08, .29, .40, .39, .31, .11, .02, 0], ly = [0, .02, .22, .26, .28, .29, .13, .11, 0];
  return { dur: F(8), ch: { 'hat.tilt': dense(8, i => tilt[i] * dir), 'hat.lift': dense(8, i => [sx[i] * dir, ly[i], 0]) } };
}

/** hat_launch (tycoon f1617-1630, s5): -1 f tip 15 deg, lifted 2 f, then free: sideways .19 D/f, up .04-.1 D/f, spin 15 deg/f.
 *  It leaves sideways, not up (about .8 R of rise). hat.on false after `frames`. */
export function hat_launch(r, { dir = 1, frames = 24 } = {}) {
  const lift = i => i <= 0 ? [0, 0, 0] : i <= 2 ? [0, .08 * i, 0] : [dir * .19 * (i - 2), .16 + .05 * (i - 2) + .002 * (i - 2) ** 2, 0];
  return { dur: F(frames), ch: {
    'hat.tilt': dense(frames, i => i === 0 ? 15 * dir : 15 * dir + (i > 2 ? 15 * (i - 2) * dir : 0)),
    'hat.lift': dense(frames, lift), 'hat.on': S([[0, true], [F(frames), false]]) } };
}

/** cane_twirl (boss f1350-1368, s5): two turns in 11 f (25 -> 84 -> 25 deg/f), 75 deg past rest, back in 4. Pivot at the hand;
 *  writes props.<id>.rot = [tilt, 0, spin] (the rod spins about an axis tilted `tilt` deg to the body). Lock it to a hop's beat. */
const CANE = [0, 25, 62, 115, 180, 255, 340, 430, 515, 595, 660, 720, 755, 780, 795, 775, 750, 730, 720];
export function cane_twirl(r, { prop = 'cane', tilt = 25 } = {}) {
  const n = CANE.length - 1;
  return { dur: F(n), ch: { [`props.${prop}.rot`]: dense(n, i => [tilt, 0, CANE[i]]) } };
}

/** release_tool (pickaxe f221-222, s5): held, then the next frame it's detached; falls keeping its angle (no tumble), speed
 *  growing from about .12 D/f. The prop system flies it from props.<id> = { in: 'release', t, mode: 'drop', v0, g }. */
export function release_tool(r, { prop = 'tool', side = 'R' } = {}) {
  return { dur: F(1), events: [{ t: F(1), name: 'release', prop }], ch: {
    [`props.${prop}`]: S([[0, { in: `hand:${side}` }], [F(1), { in: 'release', t: F(1), mode: 'drop', v0: [0, -3.6, 0], g: -9, spin: 0 }]]),
    [`arm${side}.grip`]: S([[0, prop], [F(1), null]]) } };
}

// ---- ENG7 (overnight 2, blind4 stuck points 1 + 5): eating, picking a prop up from a world spot, putting it down on one ----
const bez2 = (a, m, b, q) => [0, 1, 2].map(j => (1 - q) * (1 - q) * a[j] + 2 * (1 - q) * q * m[j] + q * q * b[j]);
const D2R = Math.PI / 180;

/** eat timing in clip frames: the mouth opens at `open` (>= 6 f before the bite: the face limiter holds a mouth >= 6 f outside
 *  speech), the hand arrives at `up`, the mouth SNAPS shut on the prop at `bite`, the hand leaves at `lower`, is at the chest at
 *  `end`, chewing (v_M / v_E, 6 f each) ends at `chewEnd`. make_film uses `bite` for the prop's bitten-state key. */
export function eatTimes({ up = 5, hold = 3, down = 5, chew = 1 } = {}) {
  const bite = Math.max(up + 1, 6), open = Math.max(0, bite - 6), lower = bite + hold, end = lower + down;
  const chewEnd = bite + 6 + 12 * Math.max(0, chew);
  return { open, up, bite, lower, end, chewEnd, dur: Math.max(end, chewEnd) };
}

/** eat / bite (ENG7): a held small prop (cookie, sandwich, apple) goes to the mouth on an arc (`up` 4-6 f, fastIn, bulging out
 *  sideways + forward like raise_prop), the mouth opens ahead of it and SNAPS shut on it (bite frame = eatTimes().bite, event
 *  'bite'), a 3 deg nod on the bite, the hand stays `hold` f, then back down to the chest on an arc (`down` 4-6 f) and holds there
 *  while the mouth chews `chew` times (v_E / v_M, 6 f each). Either hand: `armX.drink` rides the hand (character.js puts the hand IN
 *  FRONT of the drawn mouth as the camera sees it, so the prop covers the mouth, never behind the head), `armX.clear` / `temple`
 *  are forced to 0 (an earlier point / wave can't push it aside). `prop` = the prop id riding hand:<side> (+ grip); `rot` = its
 *  rotation in the hand (omit = the film's). make_film adds the prop's bitten-state opt key (`biteKey`, default 'bite') on the bite
 *  frame: 1 on the first eat of that prop, 2 on the second ... (`biteTo` = a fixed value, `biteKey: false` = none). */
// ENG9 (W6 talk small / shout big): the bite opens the BIG mouth `v_A!` (the kit's full drawing); plain `v_A` is the small talk lens now
// and read as a nibble at film size. `open: 'v_A'` (or any mouth name) still overrides.
export function eat(r, { side = 'R', prop = null, up = 5, hold = 3, down = 5, chew = 1, to = 'chest', open = 'v_A!', nod = 3, rot = null } = {}) {
  const T = eatTimes({ up, hold, down, chew }), m0 = at.mouth(r), mouth = [m0[0] + sgn(side) * .05, m0[1], m0[2]];
  const tgt = Array.isArray(to) ? to : to === 'forward' ? at.forward(r, side) : at.chest(r, side);
  const bulge = .14;
  const ch = {};
  ch[`arm${side}.hand`] = { at(t, from) {
    const a = from || at.hang(r, side), i = Math.round(t * 30);
    if (i <= 0) return [...a];
    if (i < T.up) { const q = fastIn(i / T.up, 2), mid = [(a[0] + mouth[0]) / 2 + sgn(side) * bulge, (a[1] + mouth[1]) / 2, (a[2] + mouth[2]) / 2 + bulge];
      return bez2(a, mid, mouth, q); }
    if (i <= T.lower) return [...mouth];
    if (i < T.end) { const q = fastIn((i - T.lower) / down, 2), mid = [(mouth[0] + tgt[0]) / 2 + sgn(side) * bulge, (mouth[1] + tgt[1]) / 2, (mouth[2] + tgt[2]) / 2 + bulge];
      return bez2(mouth, mid, tgt, q); }
    return [...tgt];
  } };
  ch[`arm${side}.drink`] = { at(t) { const i = Math.round(t * 30);
    return i <= 0 ? 0 : i < T.up ? fastIn(i / T.up, 2) : i <= T.lower ? 1 : i < T.end ? 1 - fastIn((i - T.lower) / down, 2) : 0; } };
  ch[`arm${side}.bend`] = K([[0, FROM], [F(2), elbowDown(side, .7, .3), 'snap']]);
  ch[`arm${side}.clear`] = K([[0, 0]]); ch[`arm${side}.temple`] = K([[0, 0]]);
  ch[`arm${side}.over`] = S([[0, true], [F(T.end), false]]);
  // the nod: nose a touch up to meet the food, down 3 deg on the bite (snap), home by the time the hand leaves + 4 f
  ch['head.pitch+'] = K([[0, 0], [F(T.up), 1, 'gesture'], [F(T.bite), -nod, 'snap'], [F(T.lower + 4), 0, 'fastIn']]);
  const mk = [[F(T.open), open], [F(T.bite), 'v_M']];
  for (let k = 0; k < chew; k++) mk.push([F(T.bite + 6 + 12 * k), 'v_E'], [F(T.bite + 12 + 12 * k), 'v_M']);
  ch['face.mouth'] = S(T.open > 0 ? [[0, FROM], ...mk] : mk);
  if (prop) { ch[`props.${prop}`] = S([[0, { in: `hand:${side}`, at: [0, 0, 0], ...(rot ? { rot } : {}) }]]); ch[`arm${side}.grip`] = S([[0, prop]]); }
  return { dur: F(T.dur), ch, events: [{ t: F(T.bite), name: 'bite', prop }] };
}
export const bite = (r, p = {}) => eat(r, p);

const reachWarned = new Set();
// no spot and no prop (a bare reach, clip sheets): hip height, .6 armLen in front of him
const frontSpot = (r, root) => { const a = (root?.ry || 0) * D2R, d = .6 * r.armLen; return [(root?.x || 0) + Math.sin(a) * d, (root?.hipY ?? r.hipY) + (root?.y || 0), (root?.z || 0) + Math.cos(a) * d]; };
/** the bend (deg) that brings a shoulder within .85 armLen of a world spot (needs the root at the clip's start: compose fills _root;
 *  ENG10: `_root.hipY` = the seated / kneeling hem height when he is on a seat, so the shoulders are measured from where they really are) */
export function reachBend(r, spot, root, side = 'R', max = 40) {
  if (!root || !Array.isArray(spot)) return 0;
  const ry = (root.ry || 0) * D2R, co = Math.cos(ry), si = Math.sin(ry), dx = spot[0] - (root.x || 0), dz = spot[2] - (root.z || 0);
  const seated = typeof root.hipY === 'number', b = [dx * co - dz * si, spot[1] - (seated ? root.hipY : r.hipY) - (root.y || 0), dx * si + dz * co], s = sh(r, side);
  for (let d = 0; d <= max; d++) { const a = d * D2R, y = s[1] * Math.cos(a) - s[2] * Math.sin(a), z = s[2] * Math.cos(a) + s[1] * Math.sin(a);
    if (Math.hypot(b[0] - s[0], b[1] - y, b[2] - z) <= .85 * r.armLen) return d; }
  const k = `${side}:${spot.map(v => v.toFixed(2))}:${[root.x, root.z, root.ry].map(v => (v || 0).toFixed(2))}`;
  if (!reachWarned.has(k)) { reachWarned.add(k);
    console.warn(`COMPOSE WARNING: the ${side} hand can't reach the spot [${spot.map(v => v.toFixed(2))}] from where he ${seated ? 'sits' : 'stands'} (${(Math.hypot(b[0], b[2])).toFixed(2)} D away on the ground${seated ? `, measured from the seated hips at ${root.hipY.toFixed(2)} D` : ''}): the prop jumps at contact. ${seated ? 'Seat him' : 'Walk him'} closer (within ~${(.8 * r.armLen).toFixed(2)} D) or move the spot`); }
  return max;
}
const rotsOf = (rot, worldRot, root) => {
  const ry = root?.ry || 0;
  const wr = worldRot || (rot ? [rot[0], rot[1] + ry, rot[2]] : [0, 0, 0]);
  const hr = rot || [wr[0], wr[1] - ry, wr[2]];            // exact when the prop only turns about Y (cookies, cups, apples on a table)
  return { wr, hr };
};
// the reach weight: 0 -> 1 over `reach` f (fastIn), 1 for `stay` f (the contact), 1 -> 0 over `away` f
const reachW = (reach, stay, away) => i => i <= 0 ? 0 : i < reach ? fastIn(i / reach, 2) : i <= reach + stay ? 1 : i < reach + stay + away ? 1 - fastIn((i - reach - stay) / away, 2) : 0;

/** pick_up (ENG7): a prop travels from a WORLD spot (a table, a plate) into the hand ON SCREEN. `at` = the spot [x, y, z] (world;
 *  make_film fills it from the film's prop `at`), reach `reach` f (4-6, fastIn; `armX.reach` pulls the drawn hand onto the spot, the
 *  body bends forward when the spot is out of arm's reach: `bend` deg, default auto from the root at the clip's start), on the CONTACT
 *  frame (= reach) the prop switches from { in: 'world', at: spot } to hand:<side> (the hand is exactly on the spot then: no pop),
 *  holds `grab` f, then lifts to `to` ('chest' | 'forward' | body [x, y, z]) in `lift` f and holds there. `rot` = rotation in the hand
 *  (facing-relative), `worldRot` = on the spot (make_film: the prop's rot); give one, the other follows (exact for a yaw-only turn). */
export function pick_up(r, { prop = null, at: spot = null, side = 'R', reach = 5, grab = 2, lift = 5, to = 'chest', bend = null, rot = null, worldRot = null, _root = null } = {}) {
  if (!Array.isArray(spot) || spot.length < 3) { if (prop) throw new Error(`pick_up: params.at must be the world spot [x, y, z] (make_film fills it from prop "${prop}")`); spot = frontSpot(r, _root); }
  const tgt = Array.isArray(to) ? to : to === 'forward' ? at.forward(r, side) : at.chest(r, side);
  const B = bend ?? reachBend(r, spot, _root, side), n = reach + grab + lift, W = reachW(reach, grab, lift), { wr, hr } = rotsOf(rot, worldRot, _root);
  const ch = {
    [`arm${side}.reach`]: { at(t) { return { at: [...spot], w: W(Math.round(t * 30)) }; } },
    [`arm${side}.hand`]: K([[0, FROM], [F(reach + grab), FROM], [F(n), tgt, 'fastIn']]),
    [`arm${side}.clear`]: K([[0, 0]]), [`arm${side}.temple`]: K([[0, 0]]),
    [`arm${side}.grip`]: S([[F(reach), prop]]),
    'body.bend+': K([[0, 0], [F(reach), B, 'careful'], [F(reach + grab), B], [F(n + 4), 0, 'careful']]),   // body speed: the bend eases out over 4 f more than the arm
  };
  if (prop) ch[`props.${prop}`] = S([[0, { in: 'world', at: [...spot], rot: wr }], [F(reach), { in: `hand:${side}`, at: [0, 0, 0], rot: hr }]]);
  return { dur: F(n + 4), ch, events: [{ t: F(reach), name: 'grab', prop }] };
}

/** put_down (ENG7): the reverse: the held prop goes to a WORLD spot `at` [x, y, z] in `reach` f, on the contact frame it switches to
 *  { in: 'world', at: spot } (stays there: a later pick_up takes it again), the hand lets go (grip null), stays `release` f, then goes to
 *  `after` ('hang' | 'chest' | '@' = where it was | body [x, y, z]) in `back` f. Same bend / rot rules as pick_up. */
export function put_down(r, { prop = null, at: spot = null, side = 'R', reach = 5, release = 2, back = 5, after = 'hang', bend = null, rot = null, worldRot = null, _root = null } = {}) {
  if (!Array.isArray(spot) || spot.length < 3) { if (prop) throw new Error(`put_down: params.at must be the world spot [x, y, z] where prop "${prop}" goes`); spot = frontSpot(r, _root); }
  const tgt = Array.isArray(after) ? after : after === '@' ? FROM : after === 'chest' ? at.chest(r, side) : at.hang(r, side);
  const B = bend ?? reachBend(r, spot, _root, side), n = reach + release + back, W = reachW(reach, release, back), { wr, hr } = rotsOf(rot, worldRot, _root);
  const ch = {
    [`arm${side}.reach`]: { at(t) { return { at: [...spot], w: W(Math.round(t * 30)) }; } },
    [`arm${side}.hand`]: K([[0, FROM], [F(reach + release), FROM], [F(n), tgt, 'fastIn']]),
    [`arm${side}.clear`]: K([[0, 0]]), [`arm${side}.temple`]: K([[0, 0]]),
    [`arm${side}.grip`]: S([[0, prop], [F(reach), null]]),
    'body.bend+': K([[0, 0], [F(reach), B, 'careful'], [F(reach + release), B], [F(n + 4), 0, 'careful']]),
  };
  if (prop) ch[`props.${prop}`] = S([[0, { in: `hand:${side}`, at: [0, 0, 0], ...(rot || worldRot ? { rot: hr } : {}) }], [F(reach), { in: 'world', at: [...spot], rot: wr }]]);
  return { dur: F(n + 4), ch, events: [{ t: F(reach), name: 'put', prop }] };
}

// ---- ENG8 (blind5 stuck points 1, 5): shake, sign, glasses ----

/** shake (ENG8): a held prop shaken (the "something rattles" beat): `count` fast small oscillations, 1 f up + 1 f down each (2 f per
 *  oscillation, MOTION_BIBLE gesture speed, on ones), ADDITIVE on whatever the hand does (a raise_prop / carry / hand-over pose keeps
 *  its place and shakes there; holds are not ended). `side` 'R' | 'L' | 'both' (two-handed: both hands move together). amp = D up/down
 *  (alternating sideways .35 amp), the body twists +-1.5 deg with it; ends exactly where it started (dead still after). */
export function shake(r, { side = 'R', count = 4, amp = .1, sway = .35, twist = 1.5 } = {}) {
  const sides = side === 'both' ? ['R', 'L'] : [side], n = 2 * count + 1, ch = {};
  const off = i => i <= 0 || i >= n ? 0 : (i % 2 ? 1 : -.75) * (1 - .12 * Math.floor((i - 1) / 2));
  for (const s of sides) ch[`arm${s}.hand+`] = dense(n, i => [sgn(side === 'both' ? 'R' : s) * amp * sway * off(i), amp * off(i), 0]);
  ch['body.twist+'] = dense(n, i => twist * off(i));
  return { dur: F(n), ch };
}

/** sign (ENG8): writes on a held board / parcel. The BOARD hand (`board` side, default the other one) brings the board in front of the
 *  chest (4 f), the writing hand (`side`) comes to it (4 f), scribbles `frames` f (6-10, small moves on ones: 1-2 f each, drifting
 *  along a line), lifts off (3 f) and goes back down (4 f); the head looks down at it (-12 deg) and back. `board` = prop id held by the
 *  board hand (ridden + grip), `pen` = prop id ridden by the writing hand (engine/props/pen.js), both optional. The board hand stays
 *  where it is after the clip (it still holds the parcel); the writing hand is released to what is underneath. */
export function sign(r, { side = 'R', boardSide = null, board = null, pen = null, frames = 8, reach = 4, look = -12, rot = null, penRot = null } = {}) {
  const bs = boardSide || (side === 'R' ? 'L' : 'R'), c = at.chest(r, bs);
  const B = [sgn(bs) * .06, c[1] - .06, c[2] + .14];                         // the board in front of the chest, a touch to its own side
  const P0 = [B[0] + sgn(side) * .1, B[1] + .08, B[2] + .06];                // the pen on the board's near half, just above it
  const f0 = reach, f1 = f0 + 2 + frames, f2 = f1 + 3, f3 = f2 + 4;
  const scrib = i => { const k = i - f0 - 2, x = .035 * (k % 2 ? 1 : -1) + .012 * k * -sgn(side), y = (k % 3 === 0 ? .02 : -.012); return [P0[0] + x, P0[1] + y, P0[2]]; };
  const ch = {};
  ch[`arm${bs}.hand`] = K([[0, FROM], [F(reach), B, 'gesture']]);
  ch[`arm${bs}.bend`] = K([[0, FROM], [F(1), elbowOut(bs, -.6), 'snap']]);
  ch[`arm${side}.hand`] = { at(t, from) {
    const a = from || at.hang(r, side), i = Math.round(t * 30);
    if (i <= 0) return [...a];
    if (i < f0 + 2) { const q = fastIn(i / (f0 + 2), 2); return [0, 1, 2].map(j => a[j] + (P0[j] - a[j]) * q); }
    if (i < f1) return scrib(i);
    const e = scrib(f1 - 1), lift = [e[0], e[1] + .1, e[2] + .06];
    if (i < f2) { const q = fastIn((i - f1 + 1) / 3, 2); return [0, 1, 2].map(j => e[j] + (lift[j] - e[j]) * q); }
    if (i < f3) { const q = fastIn((i - f2 + 1) / 4, 2); return [0, 1, 2].map(j => lift[j] + (a[j] - lift[j]) * q); }
    return [...a];
  } };
  ch[`arm${side}.bend`] = K([[0, FROM], [F(1), elbowOut(side, -.4), 'snap'], [F(f3), FROM, 'snap']]);
  ch[`arm${side}.clear`] = K([[0, 0]]); ch[`arm${side}.temple`] = K([[0, 0]]);
  ch['head.pitch+'] = K([[0, 0], [F(reach + 1), look, 'gesture'], [F(f1), look], [F(f3), 0, 'gesture']]);
  ch['face.eyes'] = S([[F(reach + 1), 'half'], [F(f2), FROM]]);
  if (board) { ch[`props.${board}`] = S([[0, { in: `hand:${bs}`, at: [0, 0, 0], ...(rot ? { rot } : {}) }]]); ch[`arm${bs}.grip`] = S([[0, board]]); }
  if (pen) { ch[`props.${pen}`] = S([[0, { in: `hand:${side}`, at: [0, 0, 0], ...(penRot ? { rot: penRot } : {}) }]]); ch[`arm${side}.grip`] = S([[0, pen]]); }
  return { dur: F(f3), ch, release: [`arm${side}.hand`, `arm${side}.bend`, `arm${side}.clear`, `arm${side}.temple`, 'head.pitch'] };
}

/** Glasses (ENG8). Pose channel `glasses`: 'on' | 'lowered' (slid down the nose, the eyes show above the frames) | 'off' |
 *  'hand:R' | 'hand:L' (held in that hand, drawn front-on beside the hand: never over an eye). `glassesLow` 0..1 = how far down the
 *  nose (character.js; 'lowered' = 1). `armX.specs` 0..1 = the hand at the glasses' edge on its own side as the camera sees it, in front
 *  of the face (`armX.specsDy` D screen-up offset). Snap with a base / face key, or play these clips: */
const specsW = (n0, n1, n2, n3) => i => i <= n0 ? 0 : i < n1 ? fastIn((i - n0) / (n1 - n0), 2) : i <= n2 ? 1 : i < n3 ? 1 - fastIn((i - n2) / (n3 - n2), 2) : 0;
/** glasses_lower: the hand reaches the glasses (`reach` f, 2-4), slides them down the nose (`drop` f; they follow the hand on ones),
 *  lets go and goes back (`back` f). `up: true` = the reverse (pushes lowered glasses back up). */
export function glasses_lower(r, { side = 'R', reach = 3, drop = 3, back = 4, up = false, dy = .2 } = {}) {
  const n1 = reach, n2 = reach + drop, n3 = n2 + back, a = up ? 1 : 0, b = up ? 0 : 1;
  const low = i => i <= n1 ? a : i >= n2 ? b : a + (b - a) * (i - n1) / drop;
  const ch = {
    [`arm${side}.specs`]: dense(n3, specsW(0, n1, n2, n3)),
    [`arm${side}.specsDy`]: dense(n3, i => -dy * low(i)),
    [`arm${side}.bend`]: K([[0, FROM], [F(1), elbowDown(side, .75, .3), 'snap'], [F(n3), FROM, 'snap']]),
    [`arm${side}.clear`]: K([[0, 0]]), [`arm${side}.temple`]: K([[0, 0]]), [`arm${side}.drink`]: K([[0, 0]]),
    [`arm${side}.over`]: S([[0, true], [F(n3), false]]),
    glassesLow: dense(n3, low), glasses: S([[0, up ? 'lowered' : 'on'], [F(n2), up ? 'on' : 'lowered']]),
  };
  return { dur: F(n3), ch, release: [`arm${side}.specs`, `arm${side}.specsDy`, `arm${side}.bend`, `arm${side}.over`, `arm${side}.clear`, `arm${side}.temple`, `arm${side}.drink`] };
}
/** glasses_off: the hand reaches the glasses (`reach` f), takes them (they leave the face that frame and sit in the hand), brings them
 *  down to `to` ('chest' | 'hang' | [x,y,z] body space) over `down` f and holds them there (open-ended like carry: a later clip on that
 *  hand ends the hold; the glasses stay in the hand until a `glasses_on` or a base / face key). */
// FIX1: the glasses' pocket = the chest pocket on the hand's own side, just in front of the coat (body space)
// PROPS2: `pocket: 'hip'` = the coat's side pocket at the hip (when the chest is busy: a parcel / board held in front of it hides the
// chest pocket and everything going into it)
const pocketAt = (r, side, where = 'chest') => {
  if (where === 'hip') { const h = at.hang(r, side); return [h[0], h[1] + .14, h[2] + .12]; }
  const c = at.chest(r, side); return [c[0] + sgn(side) * .04, c[1] + .02, c[2] + .1];
};
/** FIX1: glasses_off ENDS with the glasses put away by default (`then: 'pocket'`): after `show` f in front of the chest the hand goes
 *  to the chest pocket (`stow` f), they go in on contact (glasses 'off': gone from the hand and the face for good), the hand rests
 *  `rest` f there and goes back to hang (`back` f). `then: 'hold'` = the old open-ended hold in the hand (only for a glasses_on soon
 *  after, or a film's own put_down). Glasses never vanish in mid-air and never come back by themselves. */
export function glasses_off(r, { side = 'R', reach = 3, down = 5, to = 'chest', then = 'pocket', pocket = 'chest', show = 8, stow = 5, rest = 2, back = 6 } = {}) {
  const n1 = reach, n2 = reach + down, c0 = at.chest(r, side), tgt = Array.isArray(to) ? to : to === 'hang' ? at.hang(r, side) : [c0[0] + sgn(side) * .1, c0[1] - .04, c0[2] + .18];   // in front of the chest on its own side (seen past the body)
  if (then === 'pocket') {
    const p = pocketAt(r, side, pocket), n3 = n2 + show, n4 = n3 + stow, n5 = n4 + rest, n6 = n5 + back;
    return { dur: F(n6), ch: {
      [`arm${side}.specs`]: dense(n2, specsW(0, n1, n1, n2)),
      [`arm${side}.hand`]: K([[0, FROM], [F(n1), FROM], [F(n2), tgt, 'gesture'], [F(n3), tgt], [F(n4), p, 'gesture'], [F(n5), p], [F(n6), at.hang(r, side), 'gesture']]),
      [`arm${side}.bend`]: K([[0, FROM], [F(1), elbowDown(side, .75, .3), 'snap'], [F(n1 + 2), hangBend(side), 'snap']]),
      [`arm${side}.clear`]: K([[0, 0]]), [`arm${side}.temple`]: K([[0, 0]]), [`arm${side}.drink`]: K([[0, 0]]),
      // PROPS2: the arm stays drawn over the body until the glasses are in the pocket (shown + stowed in front of the coat, never
      // swallowed by the torso), then lets go
      [`arm${side}.over`]: S([[0, true], [F(n5), false]]),
      glasses: S([[0, FROM], [F(n1), `hand:${side}`], [F(n4), 'off']]) },
      events: [{ t: F(n4), name: 'pocket' }],
      release: [`arm${side}.hand`, `arm${side}.bend`, `arm${side}.specs`, `arm${side}.over`, `arm${side}.clear`, `arm${side}.temple`, `arm${side}.drink`] };
  }
  return { dur: F(n2), ch: {
    [`arm${side}.specs`]: dense(n2, specsW(0, n1, n1, n2)),
    [`arm${side}.hand`]: K([[0, FROM], [F(n1), FROM], [F(n2), tgt, 'gesture']]),
    [`arm${side}.bend`]: K([[0, FROM], [F(1), elbowDown(side, .75, .3), 'snap'], [F(n1 + 2), hangBend(side), 'snap']]),
    [`arm${side}.clear`]: K([[0, 0]]), [`arm${side}.temple`]: K([[0, 0]]), [`arm${side}.drink`]: K([[0, 0]]),
    [`arm${side}.over`]: S([[0, true], [F(n2), false]]),
    glasses: S([[0, FROM], [F(n1), `hand:${side}`]]) },
    release: [`arm${side}.specs`, `arm${side}.over`, `arm${side}.clear`, `arm${side}.temple`, `arm${side}.drink`] };
}
/** glasses_on: the hand holding them (glasses 'hand:X') brings them up to the face (`up` f), they go on that frame, the hand goes back
 *  to where it was (`back` f). */
export function glasses_on(r, { side = 'R', up = 4, back = 4, from = 'pocket', pocket = 'chest', fetch = 4 } = {}) {
  // FIX1: glasses_off pockets them by default, so glasses_on first fetches them from that pocket (`fetch` f to the pocket, they come
  // into the hand on contact, then up to the face). `from: 'hand'` = they are already in the hand (glasses_off then: 'hold').
  if (from === 'pocket') {
    const p = pocketAt(r, side, pocket), n0 = fetch, n1 = n0 + 2, n2 = n1 + up, n3 = n2 + back;
    return { dur: F(n3), ch: {
      [`arm${side}.hand`]: K([[0, FROM], [F(n0), p, 'gesture'], [F(n1), p]]),
      [`arm${side}.specs`]: dense(n3, specsW(n1, n2, n2, n3)),
      [`arm${side}.bend`]: K([[0, FROM], [F(n1), elbowDown(side, .75, .3), 'snap'], [F(n3), FROM, 'snap']]),
      [`arm${side}.clear`]: K([[0, 0]]), [`arm${side}.temple`]: K([[0, 0]]), [`arm${side}.drink`]: K([[0, 0]]),
      [`arm${side}.over`]: S([[0, false], [F(n1), true], [F(n3), false]]),
      glassesLow: K([[0, 0]]), glasses: S([[0, FROM], [F(n0), `hand:${side}`], [F(n2), 'on']]) },
      release: [`arm${side}.hand`, `arm${side}.specs`, `arm${side}.bend`, `arm${side}.over`, `arm${side}.clear`, `arm${side}.temple`, `arm${side}.drink`] };
  }
  const n1 = up, n2 = up + back;
  return { dur: F(n2), ch: {
    [`arm${side}.specs`]: dense(n2, specsW(0, n1, n1, n2)),
    [`arm${side}.bend`]: K([[0, FROM], [F(1), elbowDown(side, .75, .3), 'snap'], [F(n2), FROM, 'snap']]),
    [`arm${side}.clear`]: K([[0, 0]]), [`arm${side}.temple`]: K([[0, 0]]), [`arm${side}.drink`]: K([[0, 0]]),
    [`arm${side}.over`]: S([[0, true], [F(n2), false]]),
    glassesLow: K([[0, 0]]), glasses: S([[0, FROM], [F(n1), 'on']]) },
    release: [`arm${side}.specs`, `arm${side}.bend`, `arm${side}.over`, `arm${side}.clear`, `arm${side}.temple`, `arm${side}.drink`] };
}

/** grab_collar (AGENT-A 2026-11-04): this hand goes to the TARGET character's collar (front of the neck / top of the torso, on the side
 *  facing the grabber) in `reach` f (fastIn) and STAYS on it every frame while the target turns, leans or steps: held until a later clip
 *  moves this arm (compose's armEnd) or, with `release` (frames), let go after that hold (back in 4 f). The point is not known here (one
 *  character's timeline can't see another's): make_film (collarTracks) evaluates the target's pose at every frame of the clip and passes
 *  `_track` = [[lt, [x, y, z] world], ...] one per frame from the clip's start; the arm's `reach` channel pulls the DRAWN hand onto it.
 *  Without `_track` (a lone timeline, a test) the hand only rises to the chest. */
export function grab_collar(r, { side = 'R', target = null, reach = 5, release = null, _track = null } = {}) {
  const tr = Array.isArray(_track) && _track.length ? _track : null;
  const n = release != null ? reach + release + 4 : Math.max(reach + 1, tr ? Math.round(tr[tr.length - 1][0] * 30) : reach + 1);
  const W = i => i <= 0 ? 0 : i < reach ? fastIn(i / reach, 2) : release == null || i <= reach + release ? 1 : i < reach + release + 4 ? 1 - fastIn((i - reach - release) / 4, 2) : 0;
  const pointAt = lt => { if (!tr) return null; const k = Math.max(0, Math.min(tr.length - 1, Math.round(lt * 30))); return tr[k][1]; };
  const ch = {
    [`arm${side}.hand`]: K([[0, FROM], [F(reach), at.chest(r, side), 'fastIn']].concat(release != null ? [[F(reach + release), at.chest(r, side)], [F(n), at.hang(r, side), 'careful']] : [])),
    [`arm${side}.clear`]: K([[0, 0]]), [`arm${side}.temple`]: K([[0, 0]]),
  };
  if (tr) ch[`arm${side}.reach`] = { at(t) { const p = pointAt(t); return p ? { at: [...p], w: W(Math.round(t * 30)) } : undefined; } };
  return { dur: F(n), ch, events: [{ t: F(reach), name: 'collar', target }] };
}

/** collar_jerk (AGENT-A): the grabbed character's reaction, added by make_film on the grab's contact frame: pulled (dx, dz) world D
 *  toward the grabber in 1 f with a 4 deg lean, eased back over 8 f. */
export const collar_jerk = (r, { dx = 0, dz = 0, deg = 4 } = {}) => ({ dur: F(10), ch: {
  'root.x+': K([[0, 0], [F(1), dx, 'fastIn'], [F(9), 0, 'careful']]), 'root.z+': K([[0, 0], [F(1), dz, 'fastIn'], [F(9), 0, 'careful']]),
  'body.bend+': K([[0, 0], [F(1), deg, 'fastIn'], [F(9), 0, 'careful']]) } });

/** knock (S-4 short, 2026-11-04): one blow with a held tool or a bare fist on something, the strike lands on clip frame `rise` (place the
 *  clip at the knock's time - rise/30: { "clip": "knock", "t0": T - 0.1, "params": { "side": "R", "to": [x,y,z], "prop": "hammer" } }).
 *  `to` = the hand on impact, body space. The hand goes from wherever it is to the ready pose (`to` + lift up, pull back toward the
 *  body), STOPS DEAD on `to` for `stay` frames (+ a small body and head jolt), returns to the ready pose and holds there, so the next
 *  knock starts from it. End a run with `hold` + `out` on the last entry, or a later arm clip. `rotUp` / `rotHit` = the tool's rot (deg). */
export function knock(r, { side = 'R', to = null, rise = 3, stay = 1, back = 3, lift = .24, pull = .1, prop = null, rotUp = [0, 0, 0], rotHit = [0, 0, 0], jolt = 1.6, elbow = null } = {}) {
  const hit = to || [sgn(side) * .5, sh(r, side)[1] - .1, .3], ready = [hit[0] + (hit[0] > 0 ? -pull : pull), hit[1] + lift, hit[2]];
  const n = rise + stay + back, ch = {};
  ch[`arm${side}.hand`] = { at(t, from) { const i = Math.round(t * 30), a = from || ready;
    if (i <= 0) return [...a];
    if (i < rise - 1) { const u = E.outQuad(i / Math.max(1, rise - 2)); return [0, 1, 2].map(j => a[j] + (ready[j] - a[j]) * u); }
    if (i === rise - 1) return [0, 1, 2].map(j => ready[j] + (hit[j] - ready[j]) * .5);
    if (i <= rise + stay) return [...hit];
    if (i >= n) return [...ready];
    const u = (i - rise - stay) / back; return [0, 1, 2].map(j => hit[j] + (ready[j] - hit[j]) * u);
  } };
  ch[`arm${side}.bend`] = K([[0, FROM], [F(1), elbow || elbowDown(side, .8, .2), 'snap']]);
  if (prop) {
    ch[`props.${prop}`] = { at(t) { const i = Math.round(t * 30), v = i >= rise && i <= rise + stay ? rotHit : rotUp; return { in: `hand:${side}`, at: [0, 0, 0], rot: v }; } };
    ch[`arm${side}.grip`] = S([[0, prop]]);
  }
  const off = i => i === rise ? 1 : i === rise + 1 ? -.5 : 0;
  ch['body.twist+'] = dense(n + 1, i => jolt * off(i) * (side === 'L' ? 1 : -1));
  ch['head.pitch+'] = dense(n + 1, i => -jolt * .9 * off(i));
  return { dur: F(n), ch, hitFrame: rise };
}

export const CLIPS = { knock, grab_collar, collar_jerk, shake, sign, glasses_lower, glasses_off, glasses_on, eat, bite, pick_up, put_down, react, sit_back, raise_prop, open_umbrella, saw_stroke, cap_lift, hat_launch, cane_twirl, release_tool, hold, idle, stop, turn, stand_up, sit, sit_down, kneel, lean_over, lean_back, hop_bounce, point, wave, akimbo,
  shrug, hand_to_temple, carry, use_prop, swing, sledge_swing, sip, flick_toss, shock_pop, shock_jump, wince, talk_hands, brace,
  head_turn, look_at };
