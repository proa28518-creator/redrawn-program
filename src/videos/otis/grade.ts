// Colour grade for "Quaker Guns" (post agent): the reference-style GradeEffect (reports/grade.md) with the
// preset system refitted for this story's four looks, selected per shot by the composition (gradeFor):
//   day   — S1-S5, S7, S9: standard house day (median Y' ~0.57, p5 ~0.23, zero crushed blacks, violet-blue
//           shadows, chroma held up so the royal-blue Virginia sky plays against the warm earthworks).
//   golden— the shipped low-sun preset, kept for any golden-lit shot the CAM plan marks.
//   dusk  — S6 (f713-778) ONLY: late golden dusk. Deeper S-curve and heavier vignette than golden, warm
//           highlights, shadows pushed further into violet-blue — but saturation stays UP in the mids
//           (chroma floor) so the dusk never collapses into flat brown; blacks are pressed, never crushed.
//   photo — S8 (f930-1038) ONLY: Barnard's 1862 Centreville photograph. Sepia split-tone (heavy desaturation,
//           warm brown tints in every zone), a stronger albumen vignette, and a subtle cream frame border
//           (gradeBorder) drawn inside the grade for this shot range only. It is a colour treatment, not a
//           freeze: the soldier's stick-tap, lens defocus and camera push all stay alive underneath it.
// GradeEffect: the fitted reference-style colour grade as a postprocessing 6.37 Effect.
// Put it LAST in the EffectComposer, after ToneMappingEffect. It works on display-referred values: the input
// (linear, already tone-mapped to 0..1) is encoded to sRGB, graded exactly like scripts/grade.py (validated
// on our stills), and decoded back to linear for the composer's output encoding.
//   1. RGB tone curve: monotone cubic Hermite through 7 knots at x = 0, .1, .25, .5, .75, .9, 1
//   2. saturation around luma Y' (Rec.709 weights on the encoded values), separately for shadows / mids / highlights
//   3. 3-way tint (split tone): zero-luma RGB offsets in shadows, mids, highlights
//   4. vignette: x (1 - k * smoothstep(r0, 1, r)), r = elliptical radius, corners = 1
//   5. optional photo border (photo preset only): mix toward albumen cream within `gradeBorder.x` of the
//      frame edge (aspect-corrected), strength gradeBorder.y; [0, 0] = off everywhere else.
// `amount` blends the whole grade (0 = bypass) so it can be dialled back once lighting/albedo work brightens the render.
import { Effect, BlendFunction } from "postprocessing";
import { Uniform, Vector3, Vector2 } from "three";

const frag = /* glsl */ `
uniform float gradeKy[7];
uniform float gradeKm[7];
uniform vec3 gradeSat;      // x = shadows, y = mids, z = highlights
uniform vec3 gradeTintS;    // zero-luma RGB offsets (sRGB-encoded units)
uniform vec3 gradeTintM;
uniform vec3 gradeTintH;
uniform vec2 gradeVig;      // x = strength k, y = start radius r0
uniform vec2 gradeBorder;   // x = border thickness (aspect-corrected uv units), y = strength; y = 0 = off
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
  if (gradeBorder.y > 0.0) {
    // albumen-print margin: distance to the nearest edge in aspect-corrected uv (y spans 1, x spans w/h),
    // feathered over the inner quarter of the border so the frame line sits softly on the picture.
    float ax = resolution.x / max(resolution.y, 1.0);
    float dEdge = min(min(uv.x * ax, (1.0 - uv.x) * ax), min(uv.y, 1.0 - uv.y));
    float bf = 1.0 - smoothstep(gradeBorder.x * 0.72, gradeBorder.x, dEdge);
    c = mix(c, vec3(0.93, 0.88, 0.78), bf * gradeBorder.y);
  }
  c = clamp(c, 0.0, 1.0);
  outputColor = vec4(gradeDecode(mix(src, c, gradeAmount)), inputColor.a);
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
  border?: [number, number];                     // photo frame border: thickness (aspect-corrected uv), strength; default off
};

// __GRADES__ (fitted by scripts/fit2.py, written by scripts/emit_ts.py — kept as the library the presets below
// were refitted from; the fitted pair is NOT applied directly, see GRADE_DAY2 / GRADE_GOLDEN2.)
export const GRADE_DAY: GradeParams = {
  ky: [0.0345, 0.1828, 0.3812, 0.6605, 0.8814, 0.9631, 1],   // tangents: [1.4831, 1.4038, 1.2198, 0.9867, 0.6608, 0.4346, 0.3693]
  sat: [0.9831, 1.2727, 1.4573],
  tintS: [-0.0291, 0.0411], tintM: [0.0376, -0.0104], tintH: [0.0144, -0.0047],
  vig: [0.1, 0.45],
};
//   shadows tint: hue 20 deg, RGB offset (+16.5, -3.5, -13.8)/255
//   mids tint: hue 230 deg, RGB offset (-4.2, -0.6, +17.8)/255
//   highlights tint: hue 228 deg, RGB offset (-1.9, -0.1, +6.8)/255
export const GRADE_GOLDEN: GradeParams = {
  ky: [0.0311, 0.1877, 0.4017, 0.6754, 0.875, 0.9582, 1],   // tangents: [1.5667, 1.498, 1.2526, 0.9235, 0.6445, 0.4724, 0.4183]
  sat: [0.8316, 0.8799, 1.7061],
  tintS: [0.0528, 0.0004], tintM: [0.0583, -0.0003], tintH: [0, 0],
  vig: [0.16, 0.4],
};
//   shadows tint: hue 246 deg, RGB offset (+0.2, -2.6, +25.0)/255
//   mids tint: hue 245 deg, RGB offset (-0.1, -2.7, +27.6)/255
//   highlights tint: hue 0 deg, RGB offset (+0.0, -0.0, +0.0)/255

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
        ["gradeBorder", new Uniform(new Vector2(...(p.border ?? [0, 0])))],
        ["gradeAmount", new Uniform(amount)],
      ]),
    });
  }
  /** switch preset per shot (day <-> golden <-> dusk <-> photo) or blend two presets during a crossfade */
  set(p: GradeParams, q?: GradeParams, t = 0) {
    const L = (a: number, b: number) => a + (b - a) * t;
    const pb = p.border ?? [0, 0], qb = q?.border ?? [0, 0];
    const r: GradeParams = q ? {
      ky: p.ky.map((v, i) => L(v, q.ky[i])),
      sat: [L(p.sat[0], q.sat[0]), L(p.sat[1], q.sat[1]), L(p.sat[2], q.sat[2])],
      tintS: [L(p.tintS[0], q.tintS[0]), L(p.tintS[1], q.tintS[1])], tintM: [L(p.tintM[0], q.tintM[0]), L(p.tintM[1], q.tintM[1])],
      tintH: [L(p.tintH[0], q.tintH[0]), L(p.tintH[1], q.tintH[1])], vig: [L(p.vig[0], q.vig[0]), L(p.vig[1], q.vig[1])],
      border: [L(pb[0], qb[0]), L(pb[1], qb[1])],
    } : p;
    const u = this.uniforms;
    u.get("gradeKy")!.value = r.ky.slice();
    u.get("gradeKm")!.value = monoTangents(r.ky);
    (u.get("gradeSat")!.value as Vector3).set(...r.sat);
    u.get("gradeTintS")!.value = tintRGB(...r.tintS);
    u.get("gradeTintM")!.value = tintRGB(...r.tintM);
    u.get("gradeTintH")!.value = tintRGB(...r.tintH);
    (u.get("gradeVig")!.value as Vector2).set(...r.vig);
    (u.get("gradeBorder")!.value as Vector2).set(...(r.border ?? [0, 0]));
  }
  get amount() { return this.uniforms.get("gradeAmount")!.value as number; }
  set amount(v: number) { this.uniforms.get("gradeAmount")!.value = v; }
}

/** Presets per light (plain objects: edit / re-fit freely). */
// Round-2 re-fit on the relit world (WORLD agent, 2026-10-31), carried into the Quaker build. The fitted
// presets above brighten (they were fitted to the old dark stills) and washed the new lighting out; these
// are gentle S-curves at full strength instead.
//   day: mid knot .60 for median Y' ~.57, darks pressed (.1 -> .085), a hint of violet in shadows.
//   golden: stronger S (darks .1 -> .09, mids .5 -> .54), blue-violet shadow tint, orange highlight tint, heavier vignette.
export const GRADE_DAY2: GradeParams = {
  ky: [0, 0.1, 0.28, 0.6, 0.835, 0.945, 1],
  sat: [1.0, 1.05, 1.0],
  tintS: [0.01, 0.002], tintM: [0, 0], tintH: [0.006, 0],
  vig: [0.12, 0.45],
};
export const GRADE_GOLDEN2: GradeParams = {
  ky: [0, 0.09, 0.245, 0.54, 0.8, 0.93, 1],
  sat: [1.0, 1.12, 1.15],
  tintS: [0.02, 0.002], tintM: [0, 0], tintH: [-0.012, 0.006],
  vig: [0.2, 0.4],
};
//   dusk (S6, f713-778): one step later than golden — the mid knot drops to .55, the vignette closes in a
//   little more, the shadow tint goes deeper violet-blue (Cb +0.028) while the highlights keep their warm
//   orange lean; crucially the mid saturation RISES to 1.18 so the trench line, grey coats and peach sky
//   keep their colour separation (chroma floor) instead of sinking into monochrome brown.
export const GRADE_DUSK: GradeParams = {
  ky: [0, 0.085, 0.25, 0.55, 0.81, 0.935, 1],
  sat: [1.05, 1.18, 1.12],
  tintS: [0.028, 0.002], tintM: [0.004, 0], tintH: [-0.016, 0.008],
  vig: [0.22, 0.38],
};
//   photo (S8, f930-1038): Barnard's albumen print. Saturation collapses to ~0.3 (a breath of the scene's
//   colour survives, like a hand-tinted plate), every zone tinted warm brown (Cb negative = blue pulled
//   out, Cr positive = red pushed in), blacks lifted a touch at the first knot (0.02 — aged paper, still
//   no crush), the vignette of a period lens, and the cream frame border at 0.022 of frame height (~42 px
//   at 1080x1920). The world underneath keeps moving: this preset only re-colours the living shot.
export const GRADE_PHOTO: GradeParams = {
  ky: [0.02, 0.13, 0.32, 0.58, 0.82, 0.93, 1],
  sat: [0.32, 0.3, 0.34],
  tintS: [-0.035, 0.012], tintM: [-0.03, 0.01], tintH: [-0.02, 0.006],
  vig: [0.38, 0.32],
  border: [0.022, 0.92],
};
/** The four looks the composition can ask for: the shot's own light, with shot 6 forced to dusk and
 *  shot 8 forced to photo by Quaker.tsx (gradeKeyFor). */
export type GradeLight = "day" | "golden" | "dusk" | "photo";
export const GRADES: Record<GradeLight, GradeParams> = { day: GRADE_DAY2, golden: GRADE_GOLDEN2, dusk: GRADE_DUSK, photo: GRADE_PHOTO };
/** One strength (0..1, the effect's `amount`) per preset, set against the NEW world (bridge_world, 2026-10-31):
 *  full-strength presets overshot on bridge (day median Y' .59-.67 vs target .571); the refitted curves above
 *  are already gentle, so all four run at full strength here — re-check on the Quaker contact sheet and
 *  lower a preset here if its median drifts off target (day .57, dusk a step under, photo is a print). */
export const GRADE_STRENGTH: Record<GradeLight, number> = { day: 1, golden: 1, dusk: 1, photo: 1 };
/** Apply the preset of a light to the effect (only touches uniforms when the light changes). */
export function gradeFor(fx: GradeEffect, light: GradeLight) {
  const tag = fx as unknown as { _light?: string };
  if (tag._light !== light) { fx.set(GRADES[light]); tag._light = light; }
  fx.amount = GRADE_STRENGTH[light];
}
