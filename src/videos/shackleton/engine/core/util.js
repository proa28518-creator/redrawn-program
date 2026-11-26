// Small deterministic helpers. Nothing here reads a clock.
export const FPS = 30;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (k) => { k = clamp(k); return k * k * (3 - 2 * k); };
export const smoother = (k) => { k = clamp(k); return k * k * k * (k * (k * 6 - 15) + 10); };
export const easeOut = (k) => 1 - Math.pow(1 - clamp(k), 3);
export const easeIn = (k) => Math.pow(clamp(k), 3);
export const frameOf = (t) => Math.round(t * FPS);
export const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

// Seeded PRNG (sfc32 style mixing). Same seed -> same sequence on every machine.
export function rng(seed) {
  let a = 0x9e3779b9 ^ seed, b = 0x243f6a88 + seed * 7, c = 0xb7e15162 ^ (seed << 3), d = 1;
  const next = () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  const r = () => next();
  r.range = (lo, hi) => lo + (hi - lo) * next();
  r.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
  r.pick = (arr) => arr[Math.floor(next() * arr.length) % arr.length];
  r.chance = (p) => next() < p;
  r.fork = (salt) => rng((seed * 31 + salt * 7919) | 0);
  return r;
}

// Hash for value noise used by painted textures.
export function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Hex helpers for colour work in Canvas2D and three.js.
export function hexToRgb(hex) {
  const v = parseInt(hex.replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function rgbToHex([r, g, b]) {
  const c = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");
  return "#" + c(r) + c(g) + c(b);
}
export function shadeHex(hex, k) { // k < 0 darker, k > 0 lighter
  const [r, g, b] = hexToRgb(hex);
  return k < 0 ? rgbToHex([r * (1 + k), g * (1 + k), b * (1 + k)])
    : rgbToHex([r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k]);
}
export function mixHex(a, b, k) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex([lerp(x[0], y[0], k), lerp(x[1], y[1], k), lerp(x[2], y[2], k)]);
}
