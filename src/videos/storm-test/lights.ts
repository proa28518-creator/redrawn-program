// Light presets for the STORM TEST (night storm, not day). The moon is CAMERA-RELATIVE and frozen per shot (world.ts update()):
// az = degrees from the shot camera's forward axis (0 = moon straight ahead = backlight, +90 = screen right,
// 180 = behind camera), el = elevation. lit/shade/lift are LINEAR RGB multipliers for shade.ts (may exceed 1).
// Field names follow lighting.md 9.1 exactly (the CHAR and POST agents read them); values are tuned on renders.
//
// Two keys only (spec target 16):
//   night = shots 1-5: deep blue-violet storm night, cool moonlight key #8a8fb8, warm lantern practical pools #ffb36b.
//   calm  = shot 6 (payoff): the same night, but the oil sheen has laid the sea flat — warmer horizon, golden water.
// The camera pass's story.ts MUST use Light = "night" | "calm" (its SHOTS[].light feeds gradeFor + world.ts);
// any other key name fails the merge typecheck by design, so the coordinator aligns it there, not here.
type C3 = [number, number, number];
// Interior fill standard (item 9): the sanctuary preset's proven values are the floors
// any interior preset must meet — fogNear no more than 2, fogFar no more than 45,
// lift no less than [0.07, 0.06, 0.10] per channel, charShade no less than 0.9,
// hemiI no less than 0.35. Enforced by the safe-profile audit (suggestion W).
export type LightPreset = {
  az: number; el: number;
  lit: C3; shade: C3; lift: C3; lambert: number; sideK: number; term: number;      // world two-tone (shade.ts)
  charTint: C3; charShade: number; charGrad: number; bodyGrad: number; sideTint: C3; // character cards (cast.ts)
  blob: C3; actorShadow: boolean;                                                    // contact blobs / card shadows
  top: string; hor: string; skyCurve: C3; fog: string; fogNear: number; fogFar: number; sunDisc: string; // depth.md 6.5
  sunCol: string; sunI: number; sky: string; ground: string; hemiI: number;         // three lights (unpatched mats only)
  bias: number; normalBias: number;
  interior: boolean;
};
/** Every light key any story in this program may use. Storm test: night + calm only. */
export type LightKey = "night" | "calm";
export const LIGHTS: Record<LightKey, LightPreset> = {
  night: {
    interior: false,
    // Storm night: moon high and slightly screen-right (az 25 / el 52) so faces get a cool key from the
    // front-side, not a dead backlight. lit is blue-leaning and capped so moonlit whitecaps stay UNDER the
    // bloom threshold 1.0 — only lantern emissives and oil-sheen glints may bloom (target 16/7).
    // shade/lift are blue-violet: shadows are deep blue-violet, never black or muddy
    // (spec: sky top #23235e-#3b3870, horizon #4a4a8a). v5 EVIDENCE (StormTest shaft):
    // the night lift [0.10,0.10,0.17] made shadows BRIGHTER than lit deck (inverted —
    // the starboard shroud shadows read as pale lavender bands, not shadows), because
    // shade.ts adds the lift unscaled by albedo. Reduced to [0.03,0.03,0.06] (2026-11-12):
    // keeps the violet-blue tint, removes the inversion. charShade 0.92 keeps lit faces
    // readable in close-ups (face luma >= 0.5, target 16) — the shaded side of a face is
    // 92% of its tint.
    az: 25, el: 52,
    lit: [0.95, 1.0, 1.35], shade: [0.42, 0.44, 0.66], lift: [0.03, 0.03, 0.06], lambert: 0.35, sideK: 0.84, term: 0.2,
    charTint: [0.98, 1.0, 1.12], charShade: 0.92, charGrad: 0.07, bodyGrad: 0.2, sideTint: [0.9, 0.9, 1.0],
    blob: [0.32, 0.33, 0.48], actorShadow: true,
    top: "#23235e", hor: "#4a4a8a", skyCurve: [0.0, 0.5, 0.6], fog: "#4a4a8a", fogNear: 40, fogFar: 480, sunDisc: "#e8ecff",
    sunCol: "#8a8fb8", sunI: 2.2, sky: "#2c2c60", ground: "#1b1b33", hemiI: 0.45,
    bias: -0.00025, normalBias: 0.015,
  },
  calm: {
    interior: false,
    // Shot 6 payoff: the same night after the oil lays the water flat. Warmer key (low golden moon + lantern
    // bounce off the sheen), gold-violet horizon, golden water. Faces stay at charShade 0.92 — the captain's
    // nod must read. Sky stays blue-violet at the top so the shot is still night, not sunset.
    az: 25, el: 45,
    lit: [1.3, 1.15, 0.95], shade: [0.45, 0.42, 0.55], lift: [0.11, 0.09, 0.13], lambert: 0.35, sideK: 0.84, term: 0.2,
    charTint: [1.0, 0.96, 0.88], charShade: 0.92, charGrad: 0.07, bodyGrad: 0.2, sideTint: [0.95, 0.9, 0.95],
    blob: [0.38, 0.35, 0.45], actorShadow: true,
    top: "#2e2a5e", hor: "#8a6a72", skyCurve: [0.0, 0.5, 0.6], fog: "#5a4a72", fogNear: 40, fogFar: 520, sunDisc: "#ffe2b0",
    sunCol: "#d8b48a", sunI: 2.0, sky: "#3a3468", ground: "#241f38", hemiI: 0.45,
    bias: -0.00025, normalBias: 0.015,
  },
};

/** world-only look per light (sky stops by elevation in degrees, water colours, cloud palette). All colours are
 *  ON-SCREEN targets under the current PBR-Neutral tone map; world.ts pre-inverts the tone map (shade.ts untone). */
export type WorldLook = {
  sky: { c: string[]; e: number[] };                         // 5 stops: c[i] at elevation e[i] (deg), smoothstep between
  water: { near: string; mid: string; far: string; crest: string; trough: string; glint: string; shade: C3 };
  bounce: C3;                                                 // shade.ts uBounce: albedo x bounce on shaded faces turned to the lens
  sat: number;                                                // shade.ts uSat: world albedo saturation (1 = as painted)
  cloud: { lit: string; mid: string; shade: string };
};
export const LOOK: Record<LightKey, WorldLook> = {
  night: {
    // Storm night (spec target 16): horizon #4a4a8a, deepening through #3b3870 to top #23235e/#1a1a4a.
    // Water is dark blue-violet with moonlit whitecaps (#8a96d8) and moon glints (#dfe4ff); the warm bounce
    // is the lantern light: shaded faces turned to the lens pick up #ffb36b warmth (bounce [0.10, 0.06, 0.02]).
    sky: { c: ["#4a4a8a", "#3b3870", "#2e2e66", "#23235e", "#1a1a4a"], e: [0, 3, 8, 16, 40] },
    water: { near: "#1a2048", mid: "#232a5e", far: "#2e2e66", crest: "#8a96d8", trough: "#0f1330", glint: "#dfe4ff", shade: [0.5, 0.52, 0.72] },
    cloud: { lit: "#9a9ec8", mid: "#5a5a8a", shade: "#2a2a52" },
    bounce: [0.10, 0.06, 0.02],
    sat: 1.05,
  },
  calm: {
    // Payoff: gold horizon band fading to the same blue-violet top; water runs gold (#8a6a3a near, #e8c078
    // crests, #ffd98a glints) — the oil sheen on flat water. The sheen glint is the bloom carrier here:
    // world.ts must drive the sheen emissive over 1.0 or it will not bloom (bloom thr 1.0, StormTest.tsx).
    sky: { c: ["#c49a6a", "#8a6a8a", "#5a4a7a", "#3b3870", "#23235e"], e: [0, 3, 8, 16, 40] },
    water: { near: "#8a6a3a", mid: "#6a5570", far: "#3b3870", crest: "#e8c078", trough: "#1c2438", glint: "#ffd98a", shade: [0.5, 0.48, 0.6] },
    cloud: { lit: "#d8b48a", mid: "#8a6a8a", shade: "#3a3458" },
    bounce: [0.12, 0.08, 0.03],
    sat: 1.05,
  },
};
