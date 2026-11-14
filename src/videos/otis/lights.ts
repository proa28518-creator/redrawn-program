// Light presets per time of day for "Otis" (1854 New York Crystal Palace & Manhattan skyline).
// The sun is CAMERA-RELATIVE and frozen per shot (world.ts update()): az = degrees from the shot camera's
// forward axis (0 = sun straight ahead = backlight, +90 = screen right, 180 = behind camera), el = elevation.
// lit/shade/lift are LINEAR RGB multipliers for shade.ts (may exceed 1).

type C3 = [number, number, number];

export type LightPreset = {
  az: number; el: number;
  lit: C3; shade: C3; lift: C3; lambert: number; sideK: number; term: number;      // world two-tone (shade.ts)
  charTint: C3; charShade: number; charGrad: number; bodyGrad: number; sideTint: C3; // character cards (cast.ts)
  blob: C3; actorShadow: boolean;                                                    // contact blobs / card shadows
  top: string; hor: string; skyCurve: C3; fog: string; fogNear: number; fogFar: number; sunDisc: string;
  sunCol: string; sunI: number; sky: string; ground: string; hemiI: number;         // three lights
  bias: number; normalBias: number;
};

export const LIGHTS: Record<"day" | "golden" | "dusk", LightPreset> = {
  day: {
    az: 75, el: 48,
    lit: [1.58, 1.5, 1.33], shade: [0.3, 0.29, 0.36], lift: [0.05, 0.06, 0.11], lambert: 0.35, sideK: 0.84, term: 0.2,
    charTint: [1.0, 0.94, 0.92], charShade: 0.86, charGrad: 0.07, bodyGrad: 0.2, sideTint: [0.92, 0.90, 0.96],
    blob: [0.62, 0.58, 0.58], actorShadow: false,
    top: "#3e7fd2", hor: "#b8d0ec", skyCurve: [0.0, 0.5, 0.6], fog: "#b8d0ec", fogNear: 35, fogFar: 340, sunDisc: "#000000",
    sunCol: "#fff3e0", sunI: 2.8, sky: "#dcecff", ground: "#b49a78", hemiI: 0.55,
    bias: -0.00025, normalBias: 0.015,
  },
  golden: {
    az: 12, el: 9,
    lit: [1.5, 0.72, 0.28], shade: [0.16, 0.16, 0.31], lift: [0.04, 0.06, 0.17], lambert: 0.35, sideK: 0.82, term: 0.08,
    charTint: [1.0, 0.8, 0.58], charShade: 0.88, charGrad: 0.1, bodyGrad: 0.25, sideTint: [0.85, 0.80, 0.95],
    blob: [0.75, 0.74, 0.9], actorShadow: true,
    top: "#6a4f8c", hor: "#ffd08a", skyCurve: [0.05, 0.6, 1.0], fog: "#efb489", fogNear: 45, fogFar: 380, sunDisc: "#ffcf9e",
    sunCol: "#ffab5e", sunI: 5.2, sky: "#d8b0b8", ground: "#8a6a60", hemiI: 0.5,
    bias: -0.0006, normalBias: 0.03,
  },
  dusk: {
    az: 25, el: 32,
    lit: [1.25, 1.35, 1.55], shade: [0.18, 0.22, 0.38], lift: [0.06, 0.09, 0.20], lambert: 0.35, sideK: 0.82, term: 0.12,
    charTint: [0.92, 0.95, 1.0], charShade: 0.86, charGrad: 0.09, bodyGrad: 0.22, sideTint: [0.84, 0.88, 0.98],
    blob: [0.70, 0.74, 0.92], actorShadow: false,
    top: "#1d2c4f", hor: "#3a5688", skyCurve: [0.05, 0.5, 0.9], fog: "#2b4270", fogNear: 35, fogFar: 320, sunDisc: "#000000",
    sunCol: "#bfe0ff", sunI: 3.2, sky: "#9cc0eb", ground: "#4a5a78", hemiI: 0.55,
    bias: -0.0003, normalBias: 0.02,
  },
};

export type WorldLook = {
  sky: { c: string[]; e: number[] };
  water: { near: string; mid: string; far: string; crest: string; trough: string; glint: string; shade: C3 };
  bounce: C3;
  sat: number;
  cloud: { lit: string; mid: string; shade: string };
};

export const LOOK: Record<"day" | "golden" | "dusk", WorldLook> = {
  day: {
    sky: { c: ["#b8d0ec", "#9cbfea", "#6a9fe0", "#4f8cdb", "#3373cc"], e: [0, 3, 8, 16, 40] },
    water: { near: "#22a7b6", mid: "#167fb2", far: "#1a5596", crest: "#7ddfe8", trough: "#0e4a80", glint: "#ffffff", shade: [0.5, 0.56, 0.72] },
    cloud: { lit: "#fbf8f1", mid: "#e1e5f3", shade: "#c3cbe9" },
    bounce: [0, 0, 0],
    sat: 1.08,
  },
  golden: {
    sky: { c: ["#ffc47c", "#f7ae78", "#e8967c", "#c4848e", "#8a6f8a"], e: [0, 4, 10, 20, 40] },
    water: { near: "#1e3a6e", mid: "#355f96", far: "#d4a48e", crest: "#d9a088", trough: "#16294f", glint: "#ffe2b0", shade: [0.42, 0.46, 0.72] },
    cloud: { lit: "#ffd2a8", mid: "#f2a08f", shade: "#a98fc4" },
    bounce: [0.04, 0.02, 0.0],
    sat: 1.1,
  },
  dusk: {
    sky: { c: ["#2e4674", "#273c66", "#203258", "#192848", "#121d36"], e: [0, 4, 10, 20, 40] },
    water: { near: "#1e3a6e", mid: "#2c4f80", far: "#1a2f52", crest: "#7ddfe8", trough: "#101e38", glint: "#bfe0ff", shade: [0.42, 0.48, 0.74] },
    cloud: { lit: "#c3d4f0", mid: "#8ea6d0", shade: "#5c73a0" },
    bounce: [0.02, 0.04, 0.08],
    sat: 1.12,
  },
};
