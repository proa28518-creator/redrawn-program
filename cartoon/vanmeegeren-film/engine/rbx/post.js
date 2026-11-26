// engine/rbx/post.js: the Roblox Lightweight films' post (V4) in a page: what the films' post.mjs did in ffmpeg, for the Creatorize app's
// host (chost.js) to draw the same picture in its preview and its export. No imports, no DOM until called.
//   (1) motion blur: each output frame = the mean of two sub-frames (t and t + post.blur seconds; V4: 1/60 for the 60 fps films,
//       1/120 for levitate and cantcry), the films' `tmix=frames=2` + select. Cuts sit on the 30 fps grid, so no pair mixes two shots.
//   (2) grade: ffmpeg's eq filter exactly as vf_eq.c computes it with gamma 1 (its integer path, process_c), on the frame turned into
//       BT.601 limited-range YUV the way ffmpeg turns RGB into yuv420p, and back: luma = contrast + brightness, chroma = saturation.
//       V4: saturation 1.18, contrast 1.05 (levitate / cantcry 1.04, brightness .005, which eq's integer path rounds to 0).
// Captions are drawn after both (V4 burned them after the post): engine/rbx/captions.js.

/** vf_eq.c process_c as a 256-entry table: pel = ((v * c) >> 12) + b, clipped; c = contrast * 4096, b from brightness */
export function eqTable(contrast = 1, brightness = 0) {
  const c = Math.trunc(contrast * 256 * 16), b = Math.trunc((Math.trunc(100 * brightness + 100) * 511) / 200) - 128 - Math.trunc(c / 32);
  const t = new Uint8Array(256);
  for (let v = 0; v < 256; v++) { const p = ((v * c) >> 12) + b; t[v] = p < 0 ? 0 : p > 255 ? 255 : p; }
  return t;
}
/** the grade's tables (null: nothing to do) */
export function gradeTables(g) {
  if (!g) return null;
  const contrast = +(g.contrast ?? 1), brightness = +(g.brightness ?? 0), saturation = +(g.saturation ?? 1);
  if (contrast === 1 && brightness === 0 && saturation === 1) return null;
  return { y: contrast === 1 && brightness === 0 ? null : eqTable(contrast, brightness), c: saturation === 1 ? null : eqTable(saturation, 0) };
}
/** grade RGBA pixels in place (BT.601 limited range, the ffmpeg default for RGB -> yuv420p and back) */
export function gradePixels(d, T) {
  if (!T) return;
  const Y = T.y, C = T.c;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    let y = (66 * r + 129 * g + 25 * b + 128 >> 8) + 16, u = (-38 * r - 74 * g + 112 * b + 128 >> 8) + 128, v = (112 * r - 94 * g - 18 * b + 128 >> 8) + 128;
    if (Y) y = Y[y]; if (C) { u = C[u]; v = C[v]; }
    const c = y - 16, dd = u - 128, e = v - 128;
    const R = 298 * c + 409 * e + 128 >> 8, G = 298 * c - 100 * dd - 208 * e + 128 >> 8, B = 298 * c + 516 * dd + 128 >> 8;
    d[i] = R < 0 ? 0 : R > 255 ? 255 : R; d[i + 1] = G < 0 ? 0 : G > 255 ? 255 : G; d[i + 2] = B < 0 ? 0 : B > 255 ? 255 : B;
  }
}
/** the post of a film (film.rbx.post), normalised: { blur: seconds between the two sub-frames (0 = off), grade } */
export function postOf(rbx) {
  const p = rbx && typeof rbx.post === 'object' ? rbx.post : null;
  const blur = p && Number.isFinite(+p.blur) && +p.blur > 0 && +p.blur < .1 ? +p.blur : 0;
  const g = p && p.grade && typeof p.grade === 'object' ? p.grade : null;
  const num = (v, a, b, d) => Number.isFinite(+v) && +v >= a && +v <= b ? +v : d;
  return { blur, grade: g ? { saturation: num(g.saturation, 0, 3, 1), contrast: num(g.contrast, .2, 3, 1), brightness: num(g.brightness, -1, 1, 0) } : null };
}
