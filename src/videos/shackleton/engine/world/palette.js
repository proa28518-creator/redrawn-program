// Scene palette: one colour family + one accent per scene.
// Targets: hue spread per frame <= 0.33 (most saturated pixels inside one hue family); average frame
// saturation SATAVG about 22-42 (FFmpeg signalstats); opts.saturation scales all surface colours (default 1).
// Everything in a scene (walls, floor, props, clothes, light tints) takes its colour from here.
import { rgbToHex } from "../core/util.js";

export const FAMILIES = {
  teal: 180, blue: 212, indigo: 238, violet: 268, pink: 330, red: 6, orange: 24, amber: 40, olive: 68, green: 118, mint: 155,
};

function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}

// makePalette(rand, { family: "teal" | ... , accent: "amber" | hue number, warmth: -1..1 })
export function makePalette(rand, opts = {}) {
  const names = Object.keys(FAMILIES);
  const family = opts.family ?? names[Math.floor(rand() * names.length)];
  const H = typeof family === "number" ? family : FAMILIES[family];
  // accent: a contrasting hue (complement or split-complement) unless given
  const accH = opts.accent != null ? (typeof opts.accent === "number" ? opts.accent : FAMILIES[opts.accent]) : H + (rand() < 0.5 ? 180 : 150) + (rand() - 0.5) * 20;
  const j = () => (rand() - 0.5) * 16; // small hue jitter, stays inside the family
  const SAT = opts.saturation ?? 1.0;
  const hs = (h, sat, l) => hsl(h, sat * SAT, l);
  const P = {
    family, hue: H, accentHue: accH,
    // surfaces
    wall: hs(H + j(), 0.34, 0.66), wall2: hs(H + j(), 0.42, 0.52), wallDark: hs(H + j(), 0.38, 0.32),
    floor: hs(H + 14 + j(), 0.28, 0.44), floor2: hs(H + j(), 0.22, 0.62), ceiling: hs(H, 0.16, 0.8),
    trim: hs(H + j(), 0.35, 0.24), wood: hs(30 + (((H - 30 + 540) % 360) - 180) * 0.45, 0.32, 0.38), metal: hs(H, 0.12, 0.55), // wood leans toward the family
    // props: same family, different value/saturation
    prop: hs(H + j(), 0.55, 0.5), prop2: hs(H + j(), 0.45, 0.38), prop3: hs(H + j(), 0.6, 0.62), propLight: hs(H + j(), 0.3, 0.8),
    fabric: hs(H + j(), 0.5, 0.42), paper: hs(H, 0.12, 0.9), dark: hs(H, 0.3, 0.16),
    // the one accent (use on 1-3 things per frame: a door, a shirt, a sign)
    accent: hs(accH, 0.75, 0.54), accentDark: hs(accH, 0.7, 0.38),
    // light tints
    fill: hs(H, 0.55, 0.72), fillGround: hs(H + 20, 0.3, 0.4), practical: hs(38, 0.9, 0.7), screen: hs(H + 10, 0.7, 0.62),
    // outdoor sky kept softer so it does not fight the family
    skyTop: hs(H > 150 && H < 260 ? H : 212, 0.55, 0.55), skyHorizon: hs(H > 150 && H < 260 ? H : 205, 0.35, 0.82),
  };
  P.list = [P.prop, P.prop2, P.prop3, P.fabric, P.wall2];
  P.pick = (r = rand) => P.list[Math.floor(r() * P.list.length)];
  // clothes: mostly family tones; give the accent to ONE main character
  P.cloth = (i) => [hs(H + 8, 0.6, 0.48), hs(H - 10, 0.45, 0.32), hs(H + 18, 0.5, 0.62), hs(H, 0.15, 0.85), hs(H - 20, 0.55, 0.4)][i % 5];
  P.hsl = hsl;
  return P;
}

// Light preset tinted by the palette (fill and ground colours follow the family)
export function tintLight(base, pal, strength = 0.6) {
  const L = JSON.parse(JSON.stringify(base));
  L.hemi = { ...L.hemi, sky: pal.fill, ground: pal.fillGround };
  L.hemi.intensity = (base.hemi.intensity || 1) * (0.9 + 0.2 * strength);
  return L;
}
