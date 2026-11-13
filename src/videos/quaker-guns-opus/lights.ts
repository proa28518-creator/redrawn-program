// Light presets per time of day for "Quaker Guns" (Virginia earthworks, March 1862). The sun is CAMERA-RELATIVE
// and frozen per shot (world.ts update()): az = degrees from the shot camera's forward axis (0 = sun straight
// ahead = backlight, +90 = screen right, 180 = behind camera), el = elevation. lit/shade/lift are LINEAR RGB
// multipliers for shade.ts (may exceed 1). Shot mapping: "day" = S1-S5, S7, S9 (rich royal-blue sky against warm
// earthworks, house day targets); "golden" = low warm sun; "dusk" = S6 (f713-778), the Confederates slip away
// behind the log guns at late golden dusk — the POST grade swaps shot 6 to the dedicated GRADE_DUSK preset, and
// these dusk light values give the world itself the matching low sun and violet-blue shade to grade on top of.
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

export const LIGHTS: Record<"day" | "golden" | "dusk", LightPreset> = {
  day: {
    az: 75, el: 48,
    lit: [1.58, 1.5, 1.33], shade: [0.3, 0.29, 0.36], lift: [0.05, 0.06, 0.11], lambert: 0.35, sideK: 0.84, term: 0.2,
    charTint: [1.0, 0.94, 0.92], charShade: 0.86, charGrad: 0.07, bodyGrad: 0.2, sideTint: [0.92, 0.90, 0.96],
    blob: [0.62, 0.58, 0.58], actorShadow: false,
    top: "#3e7fd2", hor: "#b8d0ec", skyCurve: [0.0, 0.5, 0.6], fog: "#b8d0ec", fogNear: 25, fogFar: 300, sunDisc: "#000000",
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
  dusk: {
    // S6: later than golden — sun almost gone (el 4), warm key thinned, shade sinks deeper into violet-blue
    // (#444380 family) but the cool lift keeps faces and the log guns readable; never black, never muddy brown.
    az: 10, el: 4,
    lit: [1.35, 0.56, 0.22], shade: [0.14, 0.15, 0.32], lift: [0.05, 0.07, 0.18], lambert: 0.35, sideK: 0.8, term: 0.06,
    charTint: [1.0, 0.74, 0.52], charShade: 0.86, charGrad: 0.11, bodyGrad: 0.26, sideTint: [0.84, 0.8, 0.97],
    blob: [0.78, 0.76, 0.92], actorShadow: true,
    top: "#4a3a72", hor: "#ffc47c", skyCurve: [0.05, 0.6, 1.0], fog: "#e8a87e", fogNear: 45, fogFar: 360, sunDisc: "#ffc98f",
    sunCol: "#ff9e50", sunI: 4.2, sky: "#c9a0a8", ground: "#7a5c50", hemiI: 0.45,
    bias: -0.0006, normalBias: 0.03,
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

export const LOOK: Record<"day" | "golden" | "dusk", WorldLook> = {
  day: {
    // depth.md 2.2: horizon #9fb6e6 just above the skyline, upper sky #5e93d9 at ~20 deg (grade: frame top #5997e2)
    sky: { c: ["#b8d0ec", "#9cbfea", "#6a9fe0", "#4f8cdb", "#3373cc"], e: [0, 3, 8, 16, 40] },
    water: { near: "#22a7b6", mid: "#167fb2", far: "#1a5596", crest: "#7ddfe8", trough: "#0e4a80", glint: "#ffffff", shade: [0.5, 0.56, 0.72] },
    cloud: { lit: "#fbf8f1", mid: "#e1e5f3", shade: "#c3cbe9" },
    bounce: [0, 0, 0],
    sat: 1.08,
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
  dusk: {
    // S6 sky: peach still burns at the horizon (#ffc47c family) but the top has already gone deep violet;
    // saturation stays UP (1.12) so the dusk never falls into a flat brown monochrome (chroma floor).
    sky: { c: ["#ffc47c", "#f2a878", "#d98a7c", "#9a6a94", "#5e4a78"], e: [0, 4, 10, 20, 40] },
    water: { near: "#274a72", mid: "#2c4f80", far: "#caa086", crest: "#d9a088", trough: "#14264a", glint: "#ffe2b0", shade: [0.42, 0.46, 0.74] },
    cloud: { lit: "#ffc9a0", mid: "#e89a8f", shade: "#8f7cc0" },
    bounce: [0.04, 0.02, 0.0],
    sat: 1.12,
  },
};
