// Demo cast for the Phase 3 family demo.
// Variants 1–3 are the kit's own example cast (char/cast.ts), used verbatim.
// Variants 4–6 are composed ONLY from values exported by the ported family.ts /
// clothes.ts (SKIN / HAIR / CLOTH palettes, torso kinds, outfit & hair kinds,
// hat/glasses/face options) — no new palette constants, no changed kit numbers.
import { CAST } from "../common/inkbeat-char/char/cast";
import type { CharacterSpec } from "../common/inkbeat-char/char/Character3D";
import { CLOTH, HAIR, SKIN } from "../common/inkbeat-char/char/family";

export const DEMO_CAST = {
  /** kit cast, verbatim */
  adult: CAST.adult,
  /** kit cast, verbatim */
  kid: CAST.kid,
  /** kit cast, verbatim */
  elder: CAST.elder,
  /** barrel torso, tan skin, auburn crop, sweater */
  barrel: {
    height: 1.68,
    build: { torso: "barrel", torsoWidth: 1.1, torsoDepth: 1.05 },
    look: {
      skin: SKIN.tan,
      outfit: "sweater",
      colors: { top: CLOTH.brick, inner: CLOTH.cream, bottom: CLOTH.khaki, shoes: CLOTH.chestnut, accent: CLOTH.brass },
      hair: "crop",
      hairColor: HAIR.auburn,
      face: { nose: "button", blush: 0.15, brow: 1.15 },
      seed: 11,
    },
  },
  /** pear torso, deep skin, black bob, vest */
  pear: {
    height: 1.66,
    build: { torso: "pear", torsoWidth: 1.02 },
    look: {
      skin: SKIN.deep,
      outfit: "vest",
      colors: { top: CLOTH.sage, inner: CLOTH.cream, bottom: CLOTH.cocoa, shoes: CLOTH.graphite, accent: CLOTH.horn },
      hair: "bob",
      hairColor: HAIR.black,
      face: { nose: "button", blush: 0.4, lash: true, eyeColor: "#241a12" },
      seed: 14,
    },
  },
  /** tall block torso, light skin, honey sides hair, flat cap + glasses */
  tall: {
    height: 1.93,
    build: { torso: "block", torsoWidth: 0.98, limb: 0.95 },
    look: {
      skin: SKIN.light,
      outfit: "shirt",
      colors: { top: CLOTH.cobalt, inner: CLOTH.cream, bottom: CLOTH.charcoal, shoes: CLOTH.oxblood, accent: CLOTH.brass },
      hair: "sides",
      hairColor: HAIR.honey,
      hat: "flat",
      glasses: true,
      face: { nose: "hook", blush: 0.1, brow: 0.9 },
      seed: 21,
    },
  },
} satisfies Record<string, CharacterSpec>;

export type DemoCastKey = keyof typeof DEMO_CAST;
