// engine/ease.js - eases for the motion layer. Pure, no imports.
// E + springStep copied from templates/toon/lib/core.js (2026-11-04); his curves (MOTION_BIBLE section 1) added below.
export const FPS = 30;
export const F = n => n / FPS;                       // frames -> seconds
export const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => clamp((t - a) / ((b - a) || 1e-9));
const PI = Math.PI;

export const E = {
  lin: k => k,
  inOut: k => k * k * (3 - 2 * k),
  inSine: k => 1 - Math.cos(k * PI / 2), outSine: k => Math.sin(k * PI / 2), inOutSine: k => -(Math.cos(PI * k) - 1) / 2,
  inQuad: k => k * k, outQuad: k => 1 - (1 - k) * (1 - k), inOutQuad: k => k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2,
  inCubic: k => k ** 3, outCubic: k => 1 - (1 - k) ** 3, inOutCubic: k => k < .5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2,
  inQuart: k => k ** 4, outQuart: k => 1 - (1 - k) ** 4, inOutQuart: k => k < .5 ? 8 * k ** 4 : 1 - (-2 * k + 2) ** 4 / 2,
  inQuint: k => k ** 5, outQuint: k => 1 - (1 - k) ** 5, inOutQuint: k => k < .5 ? 16 * k ** 5 : 1 - (-2 * k + 2) ** 5 / 2,
  inExpo: k => k <= 0 ? 0 : 2 ** (10 * k - 10), outExpo: k => k >= 1 ? 1 : 1 - 2 ** (-10 * k),
  inOutExpo: k => k <= 0 ? 0 : k >= 1 ? 1 : k < .5 ? 2 ** (20 * k - 10) / 2 : (2 - 2 ** (-20 * k + 10)) / 2,
  inBack: (k, s = 1.70158) => (s + 1) * k ** 3 - s * k * k,
  outBack: (k, s = 1.70158) => 1 + (s + 1) * (k - 1) ** 3 + s * (k - 1) ** 2,
  outElastic: k => k <= 0 ? 0 : k >= 1 ? 1 : 2 ** (-10 * k) * Math.sin((k * 10 - .75) * (2 * PI / 3)) + 1,
};

/** A damped spring's step response at x seconds after the change: 0 -> 1 with overshoot (core.js formula). */
export function springStep(x, freq = 3, damp = .45) {
  if (x <= 0) return 0;
  const w = 2 * PI * freq, z = Math.min(.999, damp), wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x));
}

// ---- his curves (MOTION_BIBLE section 1, laws 2-4, 8) ----
/** Body speed (law 3): exponential decay, 64 % at 40 % of the move (frame 4 of 10), 73 % at frame 5, no overshoot.
 *  a = decay strength; a = 2 is tuned to the boss lean f423-433 (.17/f for 4 frames, then .08, .04). */
export const fastIn = (k, a = 2) => k <= 0 ? 0 : k >= 1 ? 1 : (1 - Math.exp(-a * k)) / (1 - Math.exp(-a));
/** Snap (law 2): 0 in-betweens. Holds the old value until the key, then the new one. */
export const snap = k => k >= 1 ? 1 : 0;
/** Weight (law 4, cup f828-845): trapezoid speed, accelerate 4/18, cruise 6/18, decelerate 8/18 (long tail). */
export function careful(k, up = 4 / 18, down = 8 / 18) {
  k = clamp(k); const flat = 1 - up - down, vmax = 1 / (up / 2 + flat + down / 2);
  if (k < up) return vmax * k * k / (2 * up);
  if (k < up + flat) return vmax * (up / 2 + (k - up));
  const q = k - up - flat; return vmax * (up / 2 + flat + q - q * q / (2 * down));
}
/** Gesture (2-4 frames, "get there, then stop", no settle visible). */
export const gesture = k => 1 - (1 - k) * (1 - k);
/** Strike (law 8): acceleration all the way to the hit, zero after. */
export const strike = k => k * k;
/** Windup: fast then slowing into the top. */
export const windup = k => 1 - (1 - k) ** 2;
/** Whip-in (camera f1321-1328): ramp up for the first 30 %, then constant speed. Hard stop at 1. */
export function whipIn(k, r = .3) { k = clamp(k); const v = 1 / (1 - r / 2); return k < r ? v * k * k / (2 * r) : v * (r / 2 + k - r); }
/** Whip-out (camera f1340-1346): linear deceleration then a hard stop, no settle. */
export const whipOut = k => 1 - (1 - k) * (1 - k);
/** Orbit with a dwell at the front (f50-92): two humps of speed, under 1/4 of peak in the dwell. dwellAt = where the front lies (0..1). */
export function twoHump(k, dwellAt = .5, dwell = .2) {
  k = clamp(k); const a = Math.max(.05, dwellAt - dwell / 2), b = Math.min(.95, dwellAt + dwell / 2);
  const cover = .08; // fraction of travel spent inside the dwell
  const pa = dwellAt - cover / 2, pb = dwellAt + cover / 2;
  if (k < a) return pa * E.inOutSine(k / a);
  if (k < b) return lerp(pa, pb, (k - a) / (b - a));
  return lerp(pb, 1, E.inOutSine((k - b) / (1 - b)));
}

Object.assign(E, { fastIn, snap, step: snap, careful, gesture, strike, windup, whipIn, whipOut, twoHump,
  linear: E.lin, sine: E.inOutSine, cubic: E.inOutCubic, body: fastIn });
export const easeFn = f => typeof f === 'function' ? f : (E[f] || fastIn);

// ---- hashed noise (deterministic in t, no state) ----
export const hash = (n, seed = 0) => { const s = Math.sin((n + seed * 57.3) * 127.1 + seed * 13.7) * 43758.5453; return s - Math.floor(s); };
