// CONVERGED from src/videos/abu-simbel/ (2026-11-12) — do not edit here; edit the main video.
// Light presets per time of day. The sun is CAMERA-RELATIVE and frozen per shot (world.ts update()):
// az = degrees from the shot camera's forward axis (0 = sun straight ahead = backlight, +90 = screen right,
// 180 = behind camera), el = elevation. lit/shade/lift are LINEAR RGB multipliers for shade.ts (may exceed 1).
// Field names follow lighting.md 9.1 exactly (the CHAR and POST agents read them); values are tuned on renders.
type C3 = [number, number, number];
export type LightPreset = {
  az: number; el: number;
  lit: C3; shade: C3; lift: C3; lambert: number; sideK: number; term: number;      // world two-tone (shade.ts)
  charTint: C3; charShade: number; charGrad: number; bodyGrad: number; sideTint: C3; // character cards (cast.ts)
  blob: C3; actorShadow: boolean;                                                    // contact blobs / card shadows
  top: string; hor: string; skyCurve: C3; fog: string; fogNear: number; fogFar: number; sunDisc: string; // depth.md 6.5
  sunCol: string; sunI: number; sky: string; ground: string; hemiI: number;         // three lights (unpatched mats only)
  bias: number; normalBias: number;
};
// Abu Simbel light groups (locked script, 12 shots): dawn = shot 1 (0.00 s, low sun over the desert plain);
// day = shots 2-11 (full desert day, Nile bank to rebuilt temples); sanctuary = shot 12 (51.34 s, dark inner
// room lit by a single shaft of sunlight down the temple axis). "golden" is kept verbatim from the bridge so the
// reference world/story in this sandbox still typecheck; the merged Abu Simbel story uses dawn/day/sanctuary.
/** Every light key any story in this program may use. */
export type LightKey = "day" | "golden" | "dawn" | "sanctuary";
export const LIGHTS: Record<LightKey, LightPreset> = {
  day: {
    az: 75, el: 48,
    lit: [1.62, 1.48, 1.25], shade: [0.32, 0.29, 0.24], lift: [0.06, 0.05, 0.03], lambert: 0.35, sideK: 0.84, term: 0.2,
    charTint: [1.0, 0.94, 0.92], charShade: 0.86, charGrad: 0.07, bodyGrad: 0.2, sideTint: [0.92, 0.90, 0.96],
    blob: [0.62, 0.58, 0.58], actorShadow: false,
    top: "#3e7fd2", hor: "#b8d0ec", skyCurve: [0.0, 0.5, 0.6], fog: "#c6d2e2", fogNear: 40, fogFar: 480, sunDisc: "#000000",
    sunCol: "#fff3e0", sunI: 2.8, sky: "#dcecff", ground: "#b49a78", hemiI: 0.55,
    bias: -0.00025, normalBias: 0.015,
  },
  golden: {
    az: 6, el: 7,
    lit: [1.5, 0.68, 0.24], shade: [0.15, 0.15, 0.3], lift: [0.04, 0.06, 0.17], lambert: 0.35, sideK: 0.82, term: 0.07,
    charTint: [1.0, 0.78, 0.56], charShade: 0.88, charGrad: 0.1, bodyGrad: 0.25, sideTint: [0.85, 0.80, 0.95],
    blob: [0.75, 0.74, 0.9], actorShadow: true,
    top: "#6a4f8c", hor: "#ffd08a", skyCurve: [0.05, 0.6, 1.0], fog: "#efb489", fogNear: 50, fogFar: 380, sunDisc: "#ffcf9e",
    sunCol: "#ffab5e", sunI: 5.5, sky: "#d8b0b8", ground: "#8a6a60", hemiI: 0.5,
    bias: -0.0006, normalBias: 0.03,
  },
  dawn: {
    // Shot 1: desert dawn, low sun ahead (az 6 / el 7, backlit like golden hour) over the temple faces. Warm key,
    // slightly less red than sunset so the sandstone reads gold, not orange; violet-blue shadows (#444380 target).
    az: 6, el: 7,
    lit: [1.6, 0.95, 0.5], shade: [0.2, 0.16, 0.12], lift: [0.07, 0.05, 0.03], lambert: 0.35, sideK: 0.82, term: 0.07,
    charTint: [1.0, 0.82, 0.6], charShade: 0.88, charGrad: 0.1, bodyGrad: 0.25, sideTint: [0.85, 0.8, 0.95],
    blob: [0.75, 0.74, 0.9], actorShadow: true,
    top: "#6b4a5e", hor: "#ffd9a0", skyCurve: [0.05, 0.6, 1.0], fog: "#f0c49a", fogNear: 45, fogFar: 500, sunDisc: "#ffcf9e",
    sunCol: "#ffab5e", sunI: 5.0, sky: "#e8c0a8", ground: "#8a6a60", hemiI: 0.5,
    bias: -0.0006, normalBias: 0.03,
  },
  sanctuary: {
    // Shot 12: inside the dark sanctuary. One shaft of sunlight straight down the temple axis (az 0 = sun dead
    // ahead, el 10, backlight toward the lens) — the only bright source. Shade/lift are deliberately HIGH so the
    // interior stays readable and never crushes to pure black (p5 floor): shaded stone ~0.38-0.48 of lit, plus a
    // warm blue lift. The shaft-lit floor goes over 1.0, so the emissive-only bloom catches the shaft pool and
    // nothing else. Fog is short-range interior haze in warm stone colour, not sky haze.
    az: 0, el: 10,
    lit: [1.7, 1.35, 0.9], shade: [0.26, 0.24, 0.32], lift: [0.07, 0.06, 0.10], lambert: 0.35, sideK: 0.84, term: 0.2,
    charTint: [1.0, 0.9, 0.8], charShade: 0.9, charGrad: 0.07, bodyGrad: 0.2, sideTint: [0.9, 0.88, 0.98],
    blob: [0.5, 0.48, 0.55], actorShadow: true,
    top: "#2a2118", hor: "#6b543a", skyCurve: [0.0, 0.5, 0.6], fog: "#4a3a28", fogNear: 2, fogFar: 45, sunDisc: "#ffe6b0",
    sunCol: "#ffe9c0", sunI: 4.0, sky: "#7a5c40", ground: "#3a2c1e", hemiI: 0.35,
    bias: -0.00025, normalBias: 0.015,
  },
};

/** world-only look per light (sky stops by elevation in degrees, river colours, cloud palette). All colours are
 *  ON-SCREEN targets under the current PBR-Neutral tone map; world.ts pre-inverts the tone map (shade.ts untone). */
export type WorldLook = {
  sky: { c: string[]; e: number[] };                         // 5 stops: c[i] at elevation e[i] (deg), smoothstep between
  water: { near: string; mid: string; far: string; crest: string; trough: string; glint: string; shade: C3 };
  bounce: C3;                                                 // shade.ts uBounce: albedo x bounce on shaded faces turned to the lens
  sat: number;                                                // shade.ts uSat: world albedo saturation (1 = as painted)
  cloud: { lit: string; mid: string; shade: string };
};
export const LOOK: Record<LightKey, WorldLook> = {
  day: {
    // depth.md 2.2: horizon #9fb6e6 just above the skyline, upper sky #5e93d9 at ~20 deg (grade: frame top #5997e2)
    sky: { c: ["#b8d0ec", "#9cbfea", "#6a9fe0", "#4f8cdb", "#3373cc"], e: [0, 3, 8, 16, 40] },
    water: { near: "#1d8a99", mid: "#14648f", far: "#123f6e", crest: "#6fd4de", trough: "#0b3a66", glint: "#ffffff", shade: [0.45, 0.52, 0.66] },
    cloud: { lit: "#fbf8f1", mid: "#e1e5f3", shade: "#c3cbe9" },
    bounce: [0, 0, 0],
    sat: 1.0,
  },
  golden: {
    // sunset, not dusk: #ffd08a horizon, peach/orange through ~10 deg, warm rose at 20, muted warm mauve only near the top
    // (the golden grade adds ~+11/255 blue to shadows/mids, so these lean warm)
    sky: { c: ["#ffc47c", "#f7ae78", "#e8967c", "#c4848e", "#8a6f8a"], e: [0, 4, 10, 20, 40] },
    water: { near: "#1e3a6e", mid: "#355f96", far: "#d4a48e", crest: "#d9a088", trough: "#16294f", glint: "#ffe2b0", shade: [0.42, 0.46, 0.72] },
    cloud: { lit: "#ffd2a8", mid: "#f2a08f", shade: "#a98fc4" },
    bounce: [0.04, 0.02, 0.0],
    sat: 1.1,
  },
  dawn: {
    // Desert dawn: peach horizon fading to dusty violet-blue at the top; the Nile (shot 2 is day, so this water is
    // rarely seen) runs dark blue-violet with a warm dawn glint.
    sky: { c: ["#ffd9a0", "#f7b078", "#e8967c", "#a87a72", "#6b4a5e"], e: [0, 4, 10, 20, 40] },
    water: { near: "#2a3a6e", mid: "#3d5f96", far: "#d4a48e", crest: "#e8b088", trough: "#1a2c50", glint: "#ffe2b0", shade: [0.42, 0.46, 0.72] },
    cloud: { lit: "#ffd2a8", mid: "#f2a08f", shade: "#a98fc4" },
    bounce: [0.04, 0.02, 0.0],
    sat: 1.05,
  },
  sanctuary: {
    // No sky is visible inside; the "sky" stops are dark warm stone so any sliver of background reads as rock,
    // never as daylight. Warm floor bounce lifts shaded faces turned to the lens (readability, not a second sun).
    sky: { c: ["#4a3826", "#3a2c1e", "#2a2016", "#1e150e", "#120d08"], e: [0, 3, 8, 16, 40] },
    water: { near: "#241a12", mid: "#1c140d", far: "#120d08", crest: "#6b543a", trough: "#0e0906", glint: "#ffe6b0", shade: [0.5, 0.48, 0.55] },
    cloud: { lit: "#3a2c1e", mid: "#2a2016", shade: "#1a120a" },
    bounce: [0.08, 0.05, 0.02],
    sat: 1.0,
  },
};
