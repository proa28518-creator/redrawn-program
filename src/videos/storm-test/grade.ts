// Colour grade for the STORM TEST (post agent): references/grade/GradeEffect.ts (reports/grade.md) verbatim,
// plus GRADES / GRADE_STRENGTH / gradeFor() so the lead can re-fit the presets after the lighting merge.
// Night presets are fitted to the storm night lighting (lights.ts): the grade must NEVER crush the night to
// black — the black floor is lifted to 0.02 and shadows carry a blue-violet tint (spec target 16).
// Each Inner (crossfade layer) grades with its own shot's light, so a crossfade cross-fades the presets as well.
// GradeEffect: the fitted reference-style colour grade as a postprocessing 6.37 Effect.
// Put it LAST in the EffectComposer, after ToneMappingEffect. It works on display-referred values: the input (linear,
// already tone-mapped to 0..1) is encoded to sRGB, graded exactly like scripts/grade.py (validated on our stills), and
// decoded back to linear for the composer's output encoding.
//   1. RGB tone curve: monotone cubic Hermite through 7 knots at x = 0, .1, .25, .5, .75, .9, 1
//   2. saturation around luma Y' (Rec.709 weights on the encoded values), separately for shadows / mids / highlights
//   3. 3-way tint (split tone): zero-luma RGB offsets in shadows, mids, highlights
//   4. vignette: x (1 - k * smoothstep(r0, 1, r)), r = elliptical radius, corners = 1
// `amount` blends the whole grade (0 = bypass) so it can be dialled back once lighting/albedo work brightens the render.
import { Effect, BlendFunction } from "postprocessing";
import { Uniform, Vector3, Vector2 } from "three";
import type { LightKey } from "./lights";

const frag = /* glsl */ `
uniform float gradeKy[7];
uniform float gradeKm[7];
uniform vec3 gradeSat;      // x = shadows, y = mids, z = highlights
uniform vec3 gradeTintS;    // zero-luma RGB offsets (sRGB-encoded units)
uniform vec3 gradeTintM;
uniform vec3 gradeTintH;
uniform vec2 gradeVig;      // x = strength k, y = start radius r0
uniform float gradeAmount;

vec3 gradeEncode(vec3 c) {   // linear -> sRGB
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
vec3 gradeDecode(vec3 c) {   // sRGB -> linear
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
float gradeHermite(float v, float x0, float x1, float y0, float y1, float m0, float m1) {
  float h = x1 - x0, t = (v - x0) / h, t2 = t * t, t3 = t2 * t;
  return (2.0 * t3 - 3.0 * t2 + 1.0) * y0 + (t3 - 2.0 * t2 + t) * h * m0 + (-2.0 * t3 + 3.0 * t2) * y1 + (t3 - t2) * h * m1;
}
float gradeCurve(float v) {
  v = clamp(v, 0.0, 1.0);
  if (v < 0.1)  return gradeHermite(v, 0.0, 0.1, gradeKy[0], gradeKy[1], gradeKm[0], gradeKm[1]);
  if (v < 0.25) return gradeHermite(v, 0.1, 0.25, gradeKy[1], gradeKy[2], gradeKm[1], gradeKm[2]);
  if (v < 0.5)  return gradeHermite(v, 0.25, 0.5, gradeKy[2], gradeKy[3], gradeKm[2], gradeKm[3]);
  if (v < 0.75) return gradeHermite(v, 0.5, 0.75, gradeKy[3], gradeKy[4], gradeKm[3], gradeKm[4]);
  if (v < 0.9)  return gradeHermite(v, 0.75, 0.9, gradeKy[4], gradeKy[5], gradeKm[4], gradeKm[5]);
  return gradeHermite(v, 0.9, 1.0, gradeKy[5], gradeKy[6], gradeKm[5], gradeKm[6]);
}

uniform float gradeGod;      // god-rays master strength (0..1): shot 6 only, set per frame

float godShaft(float x0, float w, float peak, vec2 uv) {
  float xc = x0 + 0.30 * (uv.y - 1.0); // shafts lean down-left from the top edge
  float d = (uv.x - xc) / w;
  float band = exp(-2.0 * d * d);
  float vfade = smoothstep(0.08, 0.55, uv.y) * (0.55 + 0.45 * uv.y); // brightest at the top, fading down
  return peak * band * vfade;
}
float godShafts(vec2 uv) { // 3 diagonal gold shafts across the upper frame (target 4, shot 6 only)
  return godShaft(0.20, 0.055, 0.16, uv) + godShaft(0.50, 0.075, 0.18, uv) + godShaft(0.80, 0.055, 0.12, uv);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 src = gradeEncode(inputColor.rgb);
  vec3 c = vec3(gradeCurve(src.r), gradeCurve(src.g), gradeCurve(src.b));
  const vec3 W = vec3(0.2126, 0.7152, 0.0722);
  float y = dot(c, W);
  float wS = 1.0 - smoothstep(0.0, 0.55, y);
  float wH = smoothstep(0.45, 1.0, y);
  float wM = 1.0 - wS - wH;
  float s = gradeSat.y + (gradeSat.x - gradeSat.y) * wS + (gradeSat.z - gradeSat.y) * wH;
  c = vec3(y) + s * (c - vec3(y));
  c += wS * gradeTintS + wM * gradeTintM + wH * gradeTintH;
  vec2 p = uv * 2.0 - 1.0;
  float r = length(p) * 0.70710678;
  c *= 1.0 - gradeVig.x * smoothstep(gradeVig.y, 1.0, r);
  c = clamp(c, 0.0, 1.0);
  vec3 outc = gradeDecode(mix(src, c, gradeAmount));
  // volumetric god-rays (target 4, shot 6 only): additive gold shafts in linear,
  // peak 0.12-0.18 per shaft, gated to 0 outside f609-700 by gradeGod (see godRaysAt).
  outc += gradeGod * godShafts(uv) * vec3(1.0, 0.72, 0.32);
  outputColor = vec4(clamp(outc, 0.0, 1.0), inputColor.a);
}`;

// BT.709 zero-luma chroma basis (sRGB-encoded units): unit Cb and unit Cr as RGB offsets with Y' unchanged
const E_CB: [number, number, number] = [0.0, -0.18733, 1.8556];
const E_CR: [number, number, number] = [1.5748, -0.46813, 0.0];
export const tintRGB = (cb: number, cr: number) =>
  new Vector3(cb * E_CB[0] + cr * E_CR[0], cb * E_CB[1] + cr * E_CR[1], cb * E_CB[2] + cr * E_CR[2]);

/** Fritsch-Carlson monotone tangents for the 7 fixed knots (same as scripts/grade.py `tangents`) */
export const KX = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
export function monoTangents(ky: number[]): number[] {
  const n = KX.length, h: number[] = [], d: number[] = [], m = new Array(n).fill(0);
  for (let k = 0; k < n - 1; k++) { h.push(KX[k + 1] - KX[k]); d.push((ky[k + 1] - ky[k]) / h[k]); }
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let k = 1; k < n - 1; k++) {
    if (d[k - 1] * d[k] <= 0) { m[k] = 0; continue; }
    const w1 = 2 * h[k] + h[k - 1], w2 = h[k] + 2 * h[k - 1];
    m[k] = (w1 + w2) / (w1 / d[k - 1] + w2 / d[k]);
  }
  return m;
}

export type GradeParams = {
  ky: number[];                                  // 7 curve values at KX
  sat: [number, number, number];                 // shadows, mids, highlights
  tintS: [number, number]; tintM: [number, number]; tintH: [number, number];   // (Cb, Cr) per zone
  vig: [number, number];                         // strength, start radius
};

export class GradeEffect extends Effect {
  constructor(p: GradeParams, amount = 1) {
    super("GradeEffect", frag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["gradeKy", new Uniform(p.ky.slice())],
        ["gradeKm", new Uniform(monoTangents(p.ky))],
        ["gradeSat", new Uniform(new Vector3(...p.sat))],
        ["gradeTintS", new Uniform(tintRGB(...p.tintS))],
        ["gradeTintM", new Uniform(tintRGB(...p.tintM))],
        ["gradeTintH", new Uniform(tintRGB(...p.tintH))],
        ["gradeVig", new Uniform(new Vector2(...p.vig))],
        ["gradeAmount", new Uniform(amount)],
        ["gradeGod", new Uniform(0)],
      ]),
    });
  }
  /** switch preset per shot (night <-> calm) or blend two presets during a crossfade/time-of-day change */
  set(p: GradeParams, q?: GradeParams, t = 0) {
    const L = (a: number, b: number) => a + (b - a) * t;
    const r: GradeParams = q ? {
      ky: p.ky.map((v, i) => L(v, q.ky[i])),
      sat: [L(p.sat[0], q.sat[0]), L(p.sat[1], q.sat[1]), L(p.sat[2], q.sat[2])],
      tintS: [L(p.tintS[0], q.tintS[0]), L(p.tintS[1], q.tintS[1])], tintM: [L(p.tintM[0], q.tintM[0]), L(p.tintM[1], q.tintM[1])],
      tintH: [L(p.tintH[0], q.tintH[0]), L(p.tintH[1], q.tintH[1])], vig: [L(p.vig[0], q.vig[0]), L(p.vig[1], q.vig[1])],
    } : p;
    const u = this.uniforms;
    u.get("gradeKy")!.value = r.ky.slice();
    u.get("gradeKm")!.value = monoTangents(r.ky);
    (u.get("gradeSat")!.value as Vector3).set(...r.sat);
    u.get("gradeTintS")!.value = tintRGB(...r.tintS);
    u.get("gradeTintM")!.value = tintRGB(...r.tintM);
    u.get("gradeTintH")!.value = tintRGB(...r.tintH);
    (u.get("gradeVig")!.value as Vector2).set(...r.vig);
  }
  get amount() { return this.uniforms.get("gradeAmount")!.value as number; }
  set amount(v: number) { this.uniforms.get("gradeAmount")!.value = v; }
  /** god-rays master strength (0..1): set per frame from godRaysAt() (shot 6 only). */
  get godRays() { return this.uniforms.get("gradeGod")!.value as number; }
  set godRays(v: number) { this.uniforms.get("gradeGod")!.value = v; }
}

/** Presets per light (plain objects: edit / re-fit freely). Storm test — night grade (target 16).
 *  The anti-crush grade: black floor lifted to 0.02 (no pixel may sit at pure black), mids held at 0.52
 *  so faces stay readable in close-ups (face luma >= 0.5), blue-violet tint in shadows, a touch of warm
 *  moonlight/gold in the highlights, vignette light (darkening the corners of an already dark frame would
 *  crush them). Re-fit after the first night stills (grade.md 5.C) if the median Y' lands off target. */
export const GRADE_NIGHT2: GradeParams = {
  ky: [0.02, 0.14, 0.30, 0.52, 0.78, 0.92, 1],
  sat: [1.0, 1.08, 1.05],
  tintS: [0.02, 0.0], tintM: [0.004, 0.0], tintH: [-0.01, 0.004],
  vig: [0.14, 0.45],
};
// Shot 6 payoff: same night, warmer — mids a touch higher (0.55) for the calm golden sea, gold highlight tint.
export const GRADE_CALM2: GradeParams = {
  ky: [0.02, 0.15, 0.31, 0.55, 0.80, 0.93, 1],
  sat: [1.0, 1.1, 1.12],
  tintS: [0.012, 0.002], tintM: [0.0, 0.004], tintH: [-0.014, 0.008],
  vig: [0.14, 0.45],
};
export const GRADES: Record<LightKey, GradeParams> = { night: GRADE_NIGHT2, calm: GRADE_CALM2 };
/** One strength (0..1, the effect's `amount`) per preset. Full strength: the night presets are gentle
 *  S-curves at full strength by design (fitted against the night lighting, not the old day stills). */
export const GRADE_STRENGTH: Record<LightKey, number> = { night: 1, calm: 1 };
/** Apply the preset of a light to the effect (only touches uniforms when the light changes). */
export function gradeFor(fx: GradeEffect, light: LightKey) {
  const tag = fx as unknown as { _light?: string };
  if (tag._light !== light) { fx.set(GRADES[light]); tag._light = light; }
  fx.amount = GRADE_STRENGTH[light];
}

// ---------------- volumetric god-rays (spec target 4, shot 6 only) ----------------
// GHOST DISSOLVE — REMOVED (2026-11-12, amended skill target 19, BANNED):
// GHOST_DISSOLVE / ghostOpacity() were deleted in the v3 rebuild. The S4->S5 cut at
// f466 is a plain 1-frame hard cut — no overlay, no fade, no translucent face anywhere.
// Nothing in this file may re-introduce a ghost; StormTest.tsx imports no ghost symbol.
// God-rays: shot 6 ONLY (frames 609-700) — three diagonal translucent gold shafts
// slicing from the top of the frame down onto the ship/sea, added inside GradeEffect
// (stage 6, after tone mapping) so the 6-stage composer order is unchanged.
// Per-shaft peak 0.12-0.18 additive in linear (see godShafts in the shader); the
// master strength ramps 0 -> 1 over f609-619 and 1 -> 0 over f690-700 so the cut at
// f609 never pops. godRaysAt() is exactly 0 outside 609-700: no other shot gets rays.
export function godRaysAt(f: number): number {
  if (f < 609 || f > 700) return 0;
  const sstep = (x: number) => { const u = Math.max(0, Math.min(1, x)); return u * u * (3 - 2 * u); };
  return Math.min(sstep((f - 609) / 10), sstep((700 - f) / 10));
}

// ---------------- in-frame captions (spec target 20) ----------------
// Burned into the frame as a render option (StormTest.tsx renders them; toggle via inputProps post.captions,
// ON by default — the stills are judged with captions ON). Bold white text, black outline, lower third
// (55-68% band), one phrase per word-group, synced to the word times in storm_test/words.json.
// Phrases are the script's sentences split at natural breaks into <= 3-word groups, timed by the underlying
// words (frame = round(t * 30)); the table is contiguous 0..700 with no gaps or overlaps. Shot 3 is a
// close-up, so its phrases sit lower in the band (top 68%, the band maximum) to stay clear of the laughing
// sailor's face; every other shot centres at 60%. QC must check legibility at 0.5 scale and that no caption
// covers a face.
// V4 FIX (2026-11-12): shot 3 was top 66% but on the v3 f278 still the caption "Against THAT?'"
// sat across the bottom of the mocker's chin (glyph cap-top 64.1% vs chin face-white bottom 65.6%,
// chin ink-outline band to 68.2% at frame centre, measured on x_0278.jpg). Raised to top 68% —
// the furthest the 55-68% band allows. Glyph cap-top moves to ~66.0%, clearing the white face
// with a ~0.4% gap; the glyph tops still kiss the bottom ~2% of the chin's ink-outline band,
// because a literal zero-overlap clear needs top ~70.4%, outside the band. If v4 still shows
// contact, the band (not the offset) is the constraint — escalate, do not push top past 68.
// V3 FIX (2026-11-12): shot 6's boundaries were one word early — "went" (starts f636) and "ship"
// (starts f672) were displayed by the PRECEDING phrase before being spoken, and were not in any caption
// while spoken (f636-644, f672-680). Boundaries re-fit to word ends (645 / 681), the same convention
// as the other 24 phrases; all 7 still frames' captions are unchanged by this fix.
export type CaptionPhrase = { text: string; a: number; b: number; shot: number; top?: number };
export const CAPTION_TOP_DEFAULT = 60;
export const CAPTIONS: CaptionPhrase[] = [
  { text: "The sea was", a: 0, b: 27, shot: 1 },
  { text: "trying to eat", a: 27, b: 54, shot: 1 },
  { text: "the ship.", a: 54, b: 72, shot: 1 },
  { text: "The captain held", a: 72, b: 99, shot: 2 },
  { text: "the wheel.", a: 99, b: 116, shot: 2 },
  { text: "The wind tore", a: 116, b: 143, shot: 2 },
  { text: "at the sails.", a: 143, b: 170, shot: 2 },
  { text: "The cook held", a: 170, b: 197, shot: 2 },
  { text: "a can of oil.", a: 197, b: 233, shot: 2 },
  { text: "One sailor laughed.", a: 233, b: 260, shot: 3, top: 68 },
  { text: "'Oil?", a: 260, b: 269, shot: 3, top: 68 },
  { text: "Against THAT?'", a: 269, b: 287, shot: 3, top: 68 },
  { text: "The captain said", a: 287, b: 313, shot: 3, top: 68 },
  { text: "nothing.", a: 313, b: 322, shot: 3, top: 68 },
  { text: "But the cook", a: 322, b: 349, shot: 4 },
  { text: "poured the oil", a: 349, b: 376, shot: 4 },
  { text: "over the side.", a: 376, b: 403, shot: 4 },
  { text: "It shone gold", a: 403, b: 430, shot: 4 },
  { text: "on the black water.", a: 430, b: 466, shot: 4 },
  { text: "You see, the oil", a: 466, b: 501, shot: 5 },
  { text: "lays the water flat.", a: 501, b: 537, shot: 5 },
  { text: "The wave sank", a: 537, b: 564, shot: 5 },
  { text: "down like a", a: 564, b: 591, shot: 5 },
  { text: "tired dog.", a: 591, b: 609, shot: 5 },
  { text: "So the sea went", a: 609, b: 645, shot: 6 },
  { text: "quiet, and the ship", a: 645, b: 681, shot: 6 },
  { text: "sailed on.", a: 681, b: 700, shot: 6 },
];
/** the caption phrase live at frame f, or null (there is none — the table covers 0..700). */
export function captionAt(f: number): CaptionPhrase | null {
  for (const c of CAPTIONS) if (f >= c.a && f < c.b) return c;
  return null;
}
