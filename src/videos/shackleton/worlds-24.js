// worlds-24.js — Hybrid worlds & quality library for RicksClips-Engine 3.0.1
// HYBRID: the RicksClips engine (characters, sets, lights, render) + the Creatorize
// "3D Cartoon Shorts (New)" quality bar (cartoon-shorts production file).
// Drop next to characters-52.js in a short's project/src/ and use it in build():
//   import { buildWorld, getWorld, QUALITY, checkQuality } from "./worlds-24.js";
//   const w = buildWorld({ W, kit, mat, glow, rand, makePalette, tintLight, buildSet, dress, lights, LIGHTS, THREE }, "glacier", [0, 0], 1);
//   // w.palette / w.lightName go into the camera shots: { t, pos, look, light: w.lightName }
// Every value below comes from the engine itself:
//   palettes: engine/world/palette.js FAMILIES (teal blue indigo violet pink red orange amber olive green mint)
//   lights: engine/world/sky.js LIGHTS (day golden night interior) + tintLight() customs
//   interiors: buildSet(W, {palette, rooms}) + dress(W, room, theme) — themes: office home kitchen shop lab classroom workshop hall
//   practicals: engine/world/lights.js — MAX_POINT = 4 real point lights per scene, fixtures always glow
//   numbers: engine/qa/thresholds.json (measured on reference shorts) + the cartoon-shorts bar

export const QUALITY = {
  // --- engine QA numbers (qa/thresholds.json, measured on reference shorts) ---
  brightnessYavg: { min: 100, max: 135 },
  saturationSatavg: { min: 22, max: 50 },
  shotMedianS: { min: 1.6, max: 10.0 },
  hardCutsPer10s: { min: 0.3, max: 2.9 },
  captionCentreFromTop: 0.706, captionCentreTolerance: 0.02,
  captionOutlinePx: { min: 6, max: 10 },
  lufs: { target: -14.5, min: -15.5, max: -13.5 },
  truePeakMaxDbtp: -1.0,
  voiceOverMusicMinDb: 6,
  syncMaxMs: 20, firstWordMaxS: 0.15, pauseMaxS: 1.25, longPausesMax: 4,
  blackLumaMax: 0.06, pureBlackFractionMax: 0.002,
  frozenDiffMax: 0.0006, frozenMinFrames: 300,
  hueSpreadMedianMax: 0.33,
  // --- cartoon-shorts bar (production file) ---
  setBarPerShot: { min: 22, target: 80 },   // 22%+ / 80% per shot
  setBarMedian: { min: 28, target: 78 },    // 28%+ / 78% median
  lightSourcesMin: 2,                        // 2+ visible light sources per place
  headTalkingPx: { min: 300, max: 430 },     // talking head height on screen
  headFirstFrameMinPx: 300,
  maxPointLights: 4,                         // engine light budget
  // --- known conflict, flagged honestly (do not hide it) ---
  // The engine's measured cut rhythm (0.3–2.9 hard cuts per 10 s, median shot 1.6–10 s)
  // and the cartoon-shorts law (a cut every 1.5–3 s) disagree: the reference style the
  // engine measured has almost NO hard cuts — the camera glides. checkQuality() uses the
  // engine numbers by default; pass { lawCuts: true } to enforce the 1.5–3 s law instead.
  cutLawSeconds: { min: 1.5, max: 3.0 },
};

// Check measured stats against the bar. stats keys are the QUALITY keys above in plain form:
// { yavg, satavg, shotMedian, cutsPer10s, captionCentre, captionOutline, lufs, truePeak,
//   blackLuma, pureBlack, frozenDiff, setBar, setMedian, lightSources, faceCut, headPx, cutSeconds }
// Returns { pass, failures: ["..."] }. Numbers only — it never judges a picture by opinion.
export function checkQuality(stats, opts = {}) {
  const f = [];
  const inR = (v, r) => v != null && v >= r.min && v <= r.max;
  if (!inR(stats.yavg, QUALITY.brightnessYavg)) f.push(`brightness YAVG ${stats.yavg} outside 100-135`);
  if (!inR(stats.satavg, QUALITY.saturationSatavg)) f.push(`saturation SATAVG ${stats.satavg} outside 22-50`);
  if (!inR(stats.shotMedian, QUALITY.shotMedianS)) f.push(`shot median ${stats.shotMedian}s outside 1.6-10s`);
  if (opts.lawCuts) {
    if (stats.cutSeconds != null && (stats.cutSeconds < 1.5 || stats.cutSeconds > 3.0)) f.push(`cut ${stats.cutSeconds}s outside the 1.5-3s law`);
  } else if (!inR(stats.cutsPer10s, QUALITY.hardCutsPer10s)) f.push(`hard cuts ${stats.cutsPer10s}/10s outside 0.3-2.9`);
  if (stats.captionCentre != null && Math.abs(stats.captionCentre - 0.706) > 0.02) f.push(`caption centre ${stats.captionCentre} off 0.706`);
  if (!inR(stats.captionOutline, QUALITY.captionOutlinePx)) f.push(`caption outline ${stats.captionOutline}px outside 6-10px`);
  if (!inR(stats.lufs, QUALITY.lufs)) f.push(`loudness ${stats.lufs} LUFS outside -15.5..-13.5`);
  if (stats.truePeak != null && stats.truePeak > -1.0) f.push(`true peak ${stats.truePeak} dBTP over -1.0`);
  if (stats.blackLuma != null && stats.blackLuma > 0.06) f.push(`black luma ${stats.blackLuma} over 0.06`);
  if (stats.pureBlack != null && stats.pureBlack > 0.002) f.push(`pure black ${stats.pureBlack} over 0.002`);
  if (stats.frozenDiff != null && stats.frozenDiff > 0.0006) f.push(`frozen diff ${stats.frozenDiff} over 0.0006`);
  if (stats.setBar != null && stats.setBar < 22) f.push(`set bar ${stats.setBar}% under 22%`);
  if (stats.setMedian != null && stats.setMedian < 28) f.push(`set median ${stats.setMedian}% under 28%`);
  if (stats.lightSources != null && stats.lightSources < 2) f.push(`only ${stats.lightSources} visible light source(s), need 2+`);
  if (stats.faceCut) f.push(`face cut by frame edge`);
  if (stats.headPx != null && (stats.headPx < 300 || stats.headPx > 430)) f.push(`talking head ${stats.headPx}px outside 300-430px`);
  return { pass: f.length === 0, failures: f };
}

export function getWorld(id) {
  return WORLDS.find((w) => w.id === id);
}

export const WORLDS = [
  // ---------- 12 interiors (buildSet + dress) ----------
  { id: "cabin", ar: "كوخ", en: "Cabin", kind: "interior",
    palette: { family: "amber", accent: "teal" }, light: "interior", dress: "home",
    rooms: [{ id: "cabin", w: 9.2, d: 7.4, h: 3.6, floor: { kind: "planks", color: "#7d5232" }, wall: { kind: "planks", color: "#c99660" }, ceiling: true, open: ["s"], openings: [{ side: "e", kind: "window", at: 0, w: 1.8, h: 1.5, sill: 1.0 }] }],
    practicals: [{ kind: "pendant", x: 0, y: 2.6, z: 0.2, color: "#ffd9a0", light: true, intensity: 6 }],
    props: ["mug", "table"], use: "اعترافات، حكايات، شتاء، نجاة" },
  { id: "lab", ar: "مختبر", en: "Laboratory", kind: "interior",
    palette: { family: "teal", accent: "amber" }, light: "interior", dress: "lab",
    rooms: [{ id: "lab", w: 10, d: 8, h: 3.6, floor: { kind: "planks", color: "#5a6a72" }, wall: { kind: "plaster", color: "#dfe8ea" }, ceiling: true, open: [], openings: [{ side: "n", kind: "window", at: 0, w: 2.4, h: 1.4, sill: 1.0 }] }],
    practicals: [{ kind: "panel", x: -2, y: 3.2, z: 0, color: "#e8f4ff", light: true, intensity: 7 }, { kind: "panel", x: 2, y: 3.2, z: 0, color: "#e8f4ff", light: true, intensity: 7 }],
    props: ["desk", "monitor"], use: "تجارب، علوم، اكتشافات، أوبئة" },
  { id: "classroom", ar: "فصل دراسي", en: "Classroom", kind: "interior",
    palette: { family: "amber", accent: "blue" }, light: "day", dress: "classroom",
    rooms: [{ id: "classroom", w: 11, d: 8, h: 3.8, floor: { kind: "planks", color: "#8a6a42" }, wall: { kind: "plaster", color: "#e8dcc0" }, ceiling: true, open: [], openings: [{ side: "n", kind: "window", at: -2, w: 2.0, h: 1.5, sill: 0.9 }, { side: "n", kind: "window", at: 2, w: 2.0, h: 1.5, sill: 0.9 }] }],
    practicals: [{ kind: "panel", x: 0, y: 3.4, z: 0, color: "#fff2d0", light: true, intensity: 6 }],
    props: ["desk", "frame"], use: "مدارس، دروس، طفولة" },
  { id: "office", ar: "مكتب", en: "Office", kind: "interior",
    palette: { family: "blue", accent: "amber" }, light: "interior", dress: "office",
    rooms: [{ id: "office", w: 10, d: 7.5, h: 3.4, floor: { kind: "planks", color: "#6b5a44" }, wall: { kind: "plaster", color: "#d8dce2" }, ceiling: true, open: [], openings: [{ side: "e", kind: "window", at: 0, w: 2.2, h: 1.5, sill: 0.9 }] }],
    practicals: [{ kind: "desk", x: -1.5, y: 1.0, z: -1, color: "#ffd9a0", light: true, intensity: 5 }, { kind: "panel", x: 1.5, y: 3.0, z: 0, color: "#fff2d0", light: true, intensity: 6 }],
    props: ["desk", "officeChair", "monitor"], use: "شركات، جرائم مكتبية، قرارات" },
  { id: "kitchen", ar: "مطبخ", en: "Kitchen", kind: "interior",
    palette: { family: "orange", accent: "teal" }, light: "interior", dress: "kitchen",
    rooms: [{ id: "kitchen", w: 8.5, d: 7, h: 3.2, floor: { kind: "planks", color: "#7a5a3a" }, wall: { kind: "plaster", color: "#f0e2c8" }, ceiling: true, open: [], openings: [{ side: "s", kind: "window", at: 0, w: 1.8, h: 1.2, sill: 1.0 }] }],
    practicals: [{ kind: "pendant", x: 0, y: 2.5, z: 0, color: "#ffd9a0", light: true, intensity: 6 }],
    props: ["mug", "stove", "sink"], use: "أكل، بيوت، عائلة" },
  { id: "shop", ar: "محل", en: "Shop", kind: "interior",
    palette: { family: "amber", accent: "red" }, light: "interior", dress: "shop",
    rooms: [{ id: "shop", w: 10, d: 8, h: 3.6, floor: { kind: "planks", color: "#8a6a42" }, wall: { kind: "plaster", color: "#e6d3a8" }, ceiling: true, open: ["s"], openings: [{ side: "e", kind: "window", at: 0, w: 2.4, h: 1.6, sill: 0.8 }] }],
    practicals: [{ kind: "neon", x: 0, y: 2.8, z: -2, color: "#ff9a5a", light: true, intensity: 5 }, { kind: "panel", x: 0, y: 3.2, z: 1, color: "#fff2d0", light: true, intensity: 6 }],
    props: ["counter", "shelf"], use: "تجارة، أسواق، سرقات" },
  { id: "workshop", ar: "ورشة", en: "Workshop", kind: "interior",
    palette: { family: "olive", accent: "amber" }, light: "interior", dress: "workshop",
    rooms: [{ id: "workshop", w: 11, d: 8, h: 3.8, floor: { kind: "planks", color: "#5a4a38" }, wall: { kind: "planks", color: "#9a7a52" }, ceiling: true, open: [], openings: [{ side: "w", kind: "window", at: 0, w: 2.0, h: 1.4, sill: 1.0 }] }],
    practicals: [{ kind: "pendant", x: -2, y: 2.8, z: 0, color: "#ffd9a0", light: true, intensity: 6 }, { kind: "desk", x: 2, y: 1.0, z: -1, color: "#ffe2b0", light: true, intensity: 5 }],
    props: ["desk", "shelf"], use: "اختراعات، حرف، صناعة" },
  { id: "hall", ar: "قاعة كبيرة", en: "Grand Hall", kind: "interior",
    palette: { family: "indigo", accent: "amber" }, light: "interior", dress: "hall",
    rooms: [{ id: "hall", w: 14, d: 10, h: 5.0, floor: { kind: "planks", color: "#6b4a2a" }, wall: { kind: "plaster", color: "#d8c8a8" }, ceiling: true, open: [], openings: [{ side: "n", kind: "window", at: -3, w: 2.0, h: 2.2, sill: 0.8 }, { side: "n", kind: "window", at: 3, w: 2.0, h: 2.2, sill: 0.8 }] }],
    practicals: [{ kind: "pendant", x: -3, y: 4.2, z: 0, color: "#ffd9a0", light: true, intensity: 7 }, { kind: "pendant", x: 3, y: 4.2, z: 0, color: "#ffd9a0", light: true, intensity: 7 }],
    props: ["frame", "sofa"], use: "قصور، محاكم، احتفالات" },
  { id: "hospital", ar: "غرفة مستشفى", en: "Hospital Room", kind: "interior",
    palette: { family: "teal", accent: "blue" }, light: "interior", dress: "lab",
    rooms: [{ id: "hospital", w: 8, d: 6.5, h: 3.2, floor: { kind: "planks", color: "#7a8a8a" }, wall: { kind: "plaster", color: "#e8f0f0" }, ceiling: true, open: [], openings: [{ side: "e", kind: "window", at: 0, w: 1.8, h: 1.4, sill: 1.0 }] }],
    practicals: [{ kind: "panel", x: 0, y: 3.0, z: 0, color: "#e8f4ff", light: true, intensity: 7 }],
    props: ["bed", "monitor"], use: "طب، مرضى، طوارئ" },
  { id: "palace_room", ar: "قاعة قصر", en: "Palace Room", kind: "interior",
    palette: { family: "violet", accent: "amber" }, light: "interior", dress: "hall",
    rooms: [{ id: "palace_room", w: 13, d: 9, h: 4.6, floor: { kind: "planks", color: "#7a5a34" }, wall: { kind: "plaster", color: "#e0c8e8" }, ceiling: true, open: [], openings: [{ side: "s", kind: "window", at: 0, w: 2.4, h: 2.0, sill: 0.8 }] }],
    practicals: [{ kind: "pendant", x: 0, y: 4.0, z: 0, color: "#ffd9a0", light: true, intensity: 7 }],
    props: ["sofa", "armchair", "frame"], use: "ملوك، تاريخ، قصور" },
  { id: "ship_cabin", ar: "كابينة سفينة", en: "Ship Cabin", kind: "interior",
    palette: { family: "blue", accent: "amber" }, light: "interior", dress: "home",
    rooms: [{ id: "ship_cabin", w: 7.5, d: 6, h: 3.0, floor: { kind: "planks", color: "#6b4a2a" }, wall: { kind: "planks", color: "#a87a48" }, ceiling: true, open: [], openings: [{ side: "n", kind: "window", at: 0, w: 1.2, h: 1.2, sill: 1.0 }] }],
    practicals: [{ kind: "wall", x: -2, y: 2.0, z: -2, color: "#ffd9a0", light: true, intensity: 5 }, { kind: "desk", x: 1.5, y: 1.0, z: 1, color: "#ffe2b0", light: true, intensity: 5 }],
    props: ["bed", "desk"], use: "بحر، سفن، قباطنة" },
  { id: "cell", ar: "زنزانة", en: "Prison Cell", kind: "interior",
    palette: { family: "indigo", accent: "red" }, light: "night", dress: "hall",
    rooms: [{ id: "cell", w: 6, d: 5, h: 3.2, floor: { kind: "planks", color: "#4a4a4a" }, wall: { kind: "plaster", color: "#8a8a8a" }, ceiling: true, open: [], openings: [{ side: "n", kind: "window", at: 0, w: 0.9, h: 0.9, sill: 1.6 }] }],
    practicals: [{ kind: "wall", x: 0, y: 2.2, z: -2, color: "#ffe2b0", light: true, intensity: 5 }],
    props: ["bed"], use: "سجون، هروب، جرائم" },
  // ---------- 12 outdoors (palette + light preset + kit landmarks) ----------
  { id: "glacier", ar: "جليد", en: "Glacier", kind: "outdoor",
    palette: { family: "blue", accent: "orange" }, light: "day",
    ground: { kind: "stone", color: "#eaf3fc" },
    landmarks: [{ type: "peaks", count: 5, spread: 14, h: 9 }, { type: "rocks", count: 6, spread: 10 }],
    use: "قطب، ثلج، بعثات، نجاة" },
  { id: "ocean_storm", ar: "محيط عاصف", en: "Storm Ocean", kind: "outdoor",
    palette: { family: "indigo", accent: "amber" }, light: "night",
    ground: { kind: "stone", color: "#1e3a5c" },
    landmarks: [{ type: "waves", count: 6, spread: 12 }, { type: "rocks", count: 3, spread: 12 }],
    use: "بحر، عواصف، سفن، غرق" },
  { id: "desert", ar: "صحراء", en: "Desert", kind: "outdoor",
    palette: { family: "amber", accent: "teal" }, light: "golden",
    ground: { kind: "stone", color: "#e8c88a" },
    landmarks: [{ type: "dunes", count: 6, spread: 14 }, { type: "rocks", count: 4, spread: 12 }],
    use: "صحارى، قوافل، كنوز، ضياع" },
  { id: "forest", ar: "غابة", en: "Forest", kind: "outdoor",
    palette: { family: "green", accent: "amber" }, light: "day",
    ground: { kind: "stone", color: "#5a7a42" },
    landmarks: [{ type: "trees", count: 12, kind: "round", color: "#4f8f3a", spread: 12 }, { type: "rocks", count: 4, spread: 10 }],
    use: "غابات، صيد، ضياع، وحوش" },
  { id: "mountain", ar: "جبل", en: "Mountain", kind: "outdoor",
    palette: { family: "blue", accent: "orange" }, light: "day",
    ground: { kind: "stone", color: "#8a8a7a" },
    landmarks: [{ type: "peaks", count: 6, spread: 16, h: 12 }, { type: "trees", count: 6, kind: "pine", color: "#3d6b5e", spread: 12 }],
    use: "جبال، تسلق، حدود، هروب" },
  { id: "city_street", ar: "شارع مدينة", en: "City Street", kind: "outdoor",
    palette: { family: "blue", accent: "amber" }, light: "day",
    ground: { kind: "stone", color: "#8a8a8a" },
    landmarks: [{ type: "buildings", count: 8, spread: 14, h: 9 }, { type: "trees", count: 4, kind: "round", color: "#4f8f3a", spread: 12 }],
    use: "مدن، مطاردات، جرائم، حياة" },
  { id: "village", ar: "قرية", en: "Village", kind: "outdoor",
    palette: { family: "olive", accent: "amber" }, light: "golden",
    ground: { kind: "stone", color: "#b8a06a" },
    landmarks: [{ type: "buildings", count: 6, spread: 12, h: 5 }, { type: "trees", count: 6, kind: "round", color: "#5a8f3a", spread: 10 }],
    use: "قرى، فلاحين، حكايات شعبية" },
  { id: "beach", ar: "شاطئ", en: "Beach", kind: "outdoor",
    palette: { family: "teal", accent: "amber" }, light: "day",
    ground: { kind: "stone", color: "#f0e0b0" },
    landmarks: [{ type: "dunes", count: 4, spread: 12 }, { type: "trees", count: 5, kind: "round", color: "#4f8f3a", spread: 10 }, { type: "waves", count: 4, spread: 14 }],
    use: "بحر، جزر، عطلات، كنوز" },
  { id: "observatory", ar: "مرصد ليلي", en: "Night Observatory", kind: "outdoor",
    palette: { family: "violet", accent: "amber" }, light: "night",
    ground: { kind: "stone", color: "#3a3a52" },
    landmarks: [{ type: "rocks", count: 5, spread: 12 }, { type: "peaks", count: 3, spread: 16, h: 7 }],
    use: "فضاء، نجوم، علماء، ليل" },
  { id: "island_camp", ar: "مخيم جزيرة", en: "Island Camp", kind: "outdoor",
    palette: { family: "teal", accent: "amber" }, light: "day",
    ground: { kind: "stone", color: "#c8b078" },
    landmarks: [{ type: "trees", count: 7, kind: "round", color: "#4f8f3a", spread: 10 }, { type: "rocks", count: 5, spread: 10 }, { type: "fire", x: 1.5, z: 1.0 }],
    use: "جزر، نجاة، مخيمات، نيران" },
  { id: "snow_village", ar: "قرية ثلجية", en: "Snow Village", kind: "outdoor",
    palette: { family: "blue", accent: "orange" }, light: "golden",
    ground: { kind: "stone", color: "#eef5fc" },
    landmarks: [{ type: "buildings", count: 6, spread: 12, h: 5 }, { type: "trees", count: 6, kind: "pine", color: "#355e54", spread: 10 }],
    use: "شتاء، ثلج، قرى شمالية" },
  { id: "jungle", ar: "أدغال", en: "Jungle", kind: "outdoor",
    palette: { family: "green", accent: "amber" }, light: "day",
    ground: { kind: "stone", color: "#4a6a32" },
    landmarks: [{ type: "trees", count: 16, kind: "round", color: "#3f7f2a", spread: 11 }, { type: "rocks", count: 5, spread: 10 }],
    use: "أدغال، استكشاف، حيوانات" },
];

// ---------- builder ----------
// a = the build() args object: { W, kit, mat, glow, rand, makePalette, tintLight, buildSet, dress, lights, LIGHTS, THREE }
// origin = [x, z] where the set sits (like the Shackleton sets: A at [0,0], B at [80,0] ...)
// Returns { def, palette, lightName, set } — camera shots use light: lightName.
export function buildWorld(a, id, origin = [0, 0], seed = 1) {
  const def = typeof id === "string" ? getWorld(id) : id;
  if (!def) throw new Error("Unknown world: " + id);
  const { W, kit, mat, glow, rand, makePalette, buildSet, dress, lights } = a;
  const pal = makePalette(rand.fork(seed), def.palette);
  const [ox, oz] = origin;
  let set = null;
  if (def.kind === "interior") {
    const rooms = def.rooms.map((r) => ({ ...r, x: ox + (r.x || 0), z: oz + (r.z || 0) }));
    set = buildSet(W, { palette: pal, rooms });
    dress(W, set.rooms[def.rooms[0].id], def.dress, { pal, set, keepClear: [[ox, oz, 2.5]] });
    // practical lights, relative to the room centre; engine budget = 4 point lights max
    for (const p of (def.practicals || []).slice(0, 4)) {
      lights.practical({ ...p, x: ox + (p.x || 0), z: oz + (p.z || 0) });
    }
  } else {
    const r = rand.fork(seed + 50);
    const place = (spread) => [ox + (r() - 0.5) * 2 * spread, oz + (r() - 0.5) * 2 * spread];
    const groundMat = (col) => mat(def.ground.kind || "stone", { color: col, seed });
    for (const lm of def.landmarks || []) {
      if (lm.type === "peaks") {
        for (let i = 0; i < lm.count; i++) {
          const [x, z] = place(lm.spread); const h = (lm.h || 9) * (0.7 + r() * 0.6), w = 3 + r() * 3;
          const g = new a.THREE.Group(); g.position.set(x, 0, z);
          g.add(kit.cyl(w * 0.14, w * 0.62, h, mat("stone", { color: "#4b5c74", seed: seed + i }), { y: h * 0.5, seg: 7 }));
          g.add(kit.cyl(w * 0.06, w * 0.44, h * 0.58, mat("stone", { color: "#eef5fc", seed: seed + 10 + i }), { y: h * 0.72, seg: 7 }));
          W.add(g, { collide: true, name: "peak" });
        }
      } else if (lm.type === "trees") {
        for (let i = 0; i < lm.count; i++) {
          const [x, z] = place(lm.spread);
          kit.tree(W, { x, z, s: 0.8 + r() * 0.7, kind: lm.kind || "round", color: lm.color || "#4f8f3a" });
        }
      } else if (lm.type === "dunes") {
        for (let i = 0; i < lm.count; i++) {
          const [x, z] = place(lm.spread); const w = 3 + r() * 4;
          W.add(kit.cyl(w, w * 1.25, 0.5, groundMat("#e8c88a"), { x, y: 0.25, z }), { collide: false, name: "dune" });
        }
      } else if (lm.type === "buildings") {
        for (let i = 0; i < lm.count; i++) {
          const [x, z] = place(lm.spread); const h = (lm.h || 6) * (0.8 + r() * 0.5), w = 3 + r() * 2;
          W.add(kit.box(w, h, w, mat("plaster", { color: "#c8b088", seed: seed + i }), { x, y: h / 2, z }), { collide: true, name: "building" });
        }
      } else if (lm.type === "rocks") {
        for (let i = 0; i < lm.count; i++) {
          const [x, z] = place(lm.spread); const h = 0.8 + r() * 1.6;
          W.add(kit.cyl(0.3, 0.9, h, mat("stone", { color: "#5a6a7a", seed: seed + i }), { x, y: h / 2, z, seg: 6 }), { collide: false, name: "rock" });
        }
      } else if (lm.type === "waves") {
        for (let i = 0; i < lm.count; i++) {
          const [x, z] = place(lm.spread);
          W.add(kit.box(6 + r() * 4, 0.4, 1.2, mat("stone", { color: "#3a7ab8", seed: seed + i }), { x, y: 0.2, z, ry: r() * 0.6 }), { collide: false, name: "wave" });
        }
      } else if (lm.type === "fire") {
        const fx = ox + (lm.x || 0), fz = oz + (lm.z || 0);
        W.add(kit.ball(0.35, glow([2.2, 1.1, 0.3]), { x: fx, y: 0.5, z: fz }), { collide: false, name: "camp_fire" });
        lights.practical({ kind: "pendant", x: fx, y: 0.6, z: fz, color: "#ff9a3a", light: true, intensity: 6 });
      }
    }
  }
  return { def, palette: pal, lightName: def.light, set };
}

// Build several worlds at once: buildWorlds(args, ["glacier", "cabin"], [[0,0],[80,0]], 1)
export function buildWorlds(a, ids, origins, seed = 1) {
  return ids.map((id, i) => buildWorld(a, id, origins[i] || [0, 0], seed + i * 10));
}
