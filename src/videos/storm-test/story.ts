// Storm Oil — Camera & Beat (Agent 3, Pass 3).
// Replaces the Abu Simbel skeleton copy: same export names and signatures
// (FPS, TOTAL, D0, SHOTS, CAMS, KICKS, FOREGROUND, dofAt, camAt, kickAt, keyEnd,
// shotAt, layersAt, focusAt, warpU) so the merge typechecks. Bridge/Abu Simbel
// story physics (marching column, deck bounce, collapse, swing, temple sites) is
// retained as inert legacy exports for import compatibility — the storm test has
// no marching column, no collapse, no swing and no temples.
// Timing is LOCKED to words.json (3.35 wps, even word spacing): every cut lands on
// the frame of its trigger word; every glide is centred on its trigger word;
// reactions land 0-3 frames BEFORE their word.
//
// Composition: StormTest, 1080x1920, 30 fps, 700 frames (23.28 s), 6 shots.
// ONE location: a ship at sea at night. World datum: deck y = 0 (D0); sea level
// y = SEA_Y (-1.6 m). The ship's long axis runs along z (bow z ≈ -14, tip -15.5,
// stern z = +14, beam x = -4..+4); mainmast at z = -1.5 (top ~18 m) — verified
// against world.ts buildStormShip (see MAST_PT below); NO foremast in the build
// (single mast; the jib runs forward to z ≈ -11.5). Cameras stand off the ship or
// on the deck looking toward -z (out to sea / up the deck) or toward +z (toward
// the stern / wheel). The "65 m higher" / temple geometry of the skeleton is gone:
// NOTHING in this file references a temple site.
export const FPS = 30;
export const TOTAL = 700;
export const D0 = 0.0; // deck datum (m); the deck plane is y = 0, the sea is below it
export const SEA_Y = -1.6; // sea level (m) — the ship rides 1.6 m above the water (world.ts STORM.waterY)
export const HALF = 27; // legacy bridge constant (tower half-span); retained, unused here
export const FILES = [-1.65, -0.55, 0.55, 1.65]; // legacy bridge constants; retained, unused here
export const ROW_GAP = 1.3; // legacy bridge constant; retained, unused here
export const COUNT = 74; // legacy bridge constant; retained, unused here
/** Ship centre (x, deck y, z). Bridge PARK was the park-swing pivot; the storm test
 *  has no swing — PARK now marks the ship centre. */
export const PARK: V3 = [0, D0, 0];
export type V3 = [number, number, number];

// Site / subject anchors — the single source of truth for framings.
// One site only (x = 0): the ship. The three Abu Simbel site offsets collapse to it.
export const SHIP_X = 0; // the ship (all 6 shots)
export const OLD_X = 0; // legacy: old temple site — the storm test has one site, the ship
export const NEW_X = 0; // legacy: rebuilt temple site — same single site
export const HOME_X = 0; // legacy: wardrobe room — same single site
export const CAPTAIN_PT: V3 = [0, 0, 10]; // captain at the wheel, stern (shots 2, 3)
export const WHEEL_PT: V3 = [0, 1.1, 10.5]; // ship's wheel
export const COOK_PT: V3 = [3.2, 0, 2]; // cook at the starboard rail (shots 2, 4)
export const RAIL_PT: V3 = [4, 0, 2]; // pour point on the starboard rail (shot 4)
export const SAILOR_PT: V3 = [0.5, 0, 4]; // laughing sailor, mid-deck (shot 3)
/** PASS 3 (2026-11-12): the mast is NOT at z = 0. buildStormShip builds the mast at
 *  ship-local (mastX 2.5, y, 0); world.ts rotates the ship group +90 deg about Y and
 *  shifts it +1 m in z, so local (2.5, y, 0) lands at world (0, y, -2.5 + 1) =
 *  (0, y, -1.5). Proof: the same transform lands the wheel exactly on WHEEL_PT
 *  (local -9.5 -> world z 9.5 + 1 = 10.5), and build.ts itself exports
 *  MAST_PT [0, 0, -1.5]. The v2 note's "-2.5" (and its sail corners) dropped the
 *  +1 m shift — the true mainsail corners are (0,3.7,-1.5)/(0,3.3,7.5)/(0,9.4,7.5)/
 *  (0,12.4,-1.5), belly (2,7.2,2) (the v2 belly z = 2 already carries the shift).
 *  The old story.ts value [0, 0, 0] was 1.5 m off; every S1/S6 mast-top NDC in the
 *  v2 plan was ~0.03-0.05 optimistic because of it. */
export const MAST_PT: V3 = [0, 0, -1.5]; // mainmast base (top ~[0, 18, -1.5])
export const SHEEN_PT: V3 = [7, -1.6, 0]; // golden oil sheen centre on the water (shot 4)
export const WAVE_PT: V3 = [2, -1.6, -8]; // flattening wave crest, off the bow (shot 5)
export const MOCKER: V3 = SAILOR_PT; // legacy name: the laughing man (shot 3)
export const SILENT_MAN: V3 = CAPTAIN_PT; // legacy name: the silent man — here the calm captain (shot 3)
export const BLOCK_PT: V3 = [3.2, 1.0, 2]; // legacy name: the marked block — here the oil can in the cook's hands
export const CAPTAIN_S3_PT: V3 = [-1.3, 0, 9]; // captain behind the sailor, saying nothing (S3) — moved here from cast.ts: single source for all anchors
export const WARDROBE: V3 = [0, 0, 0]; // legacy name (home room); unused in the storm test
export const DOOR_PT: V3 = [0, 1.2, -2]; // legacy name (room door); unused in the storm test
export const WORKERS_PT: V3 = [0, 1.6, 2]; // legacy name (terrace workers); unused in the storm test
export const STATUES_PT: V3 = [0, 2.4, -15]; // legacy name (sanctum statues); unused in the storm test
/** Face heights (world points the lens focuses on — see DOF table).
 *  PASS 3: derived from the built geometry, not estimated — toon.ts BUILD adult
 *  (a 118, torso 1.1, legs 1.4) puts the head centre at design y 975 - 6*H.b ≈ 309,
 *  i.e. (975-309)*SU = 1.44 m at scale 1 (SU 0.00216, cast.ts); head width
 *  2*118*SU = 0.51 m, crown 1.68 m, cook toque top ≈ 2.01 m (toque puffs reach
 *  design y ≈ 45). The v2 anchors (1.6/1.65/1.7) read 0.16-0.22 m high. The S3
 *  sailor is staged at 1.3x scale (cast.ts shot3), so his face is 1.44*1.3 = 1.87 m
 *  and his head is 0.66 m wide — the mocker-CU fractions below use 0.66 m. */
export const SAILOR_FACE: V3 = [0.5, 1.87, 4];
export const CAPTAIN_FACE: V3 = [0, 1.44, 10];
export const COOK_FACE: V3 = [3.2, 1.44, 2];
export const COOK_FACE_S5A: V3 = [4, 1.44, 2]; // Opus fix P2 (2026-11-12): S5a face is at x=4 (crate), S2d keeps the rail value
/** Rail cook (S4/S5): same heights, staged at RAIL_PT [4, 0, 2]. */
export const COOK_RAIL_FACE: V3 = [4, 1.44, 2];
/** S3 captain: cast.ts stages him at [-1.3, 0, 9], not at the wheel. */
export const CAPTAIN_S3_FACE: V3 = [-1.3, 1.44, 9];
/** S5 analogy props (fixed by the brief; the world pass builds them here). */
export const BOWL_PT: V3 = [3.8, 0.9, 1.4]; // wooden bowl centre, on the crate
export const CRATE_PT: V3 = [3.8, 0, 1.4]; // crate the bowl sits on
export const OIL_CAN: V3 = [3.2, 1.0, 2];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};

// ---------------- legacy bridge story physics (inert for the storm test) ----------------
// No marching column, no bounce, no collapse: front() is the fixed subject plane (z = 0),
// amp/stomp/marchPhase/dropU are retained verbatim for import compatibility, deckY is flat
// (DROP_H = 0), and bridgeState() always returns the intact state.
export const front = (_tau: number) => 0; // subject plane z = 0, all shots
export const marchPhase = (tau: number) => ((tau % 1) + 1) % 1; // legacy; unused here
/** Legacy bridge drop-scare frame (unused in the storm test — no drop exists here). */
export const SNAP = 913 / FPS, DROP0 = 913 / FPS, DROP1 = (913 + 18) / FPS;
export const amp = (tau: number) =>
  lin([[14.85, 0], [17.8, 0.07], [21.4, 0.13], [27.4, 0.26], [33.0, 0.46], [SNAP, 0.55], [SNAP + 0.35, 0.0]], tau);
export const stomp = (tau: number) => lin([[21.4, 1.0], [27.4, 1.35], [33, 1.5]], tau);
export const shapeZ = (z: number) => (Math.abs(z) < HALF ? Math.cos((Math.PI * z) / (2 * HALF)) : 0);
export const dropW = (z: number) => smooth((20 - z) / 26);
export const dropU = (tau: number) => (tau < DROP0 ? 0 : Math.min(1, ((tau - DROP0) / (DROP1 - DROP0)) ** 2));
export const DROP_H = 0; // no drop: the ship is never dropped, the sailor only mocks the oil

export type BridgeState = { bounce: number; drop: number; snap: number; collapsed: boolean };
export const deckY = (z: number, b: BridgeState) => D0 + b.bounce * shapeZ(z) - b.drop * DROP_H * dropW(z);

// ---------------- shots ----------------
export type Light = "night" | "calm"; // MERGE: post pass (lights.ts LightKey) only knows night + calm
// Bridge crowd members are retained so the bridge-copy cast.ts comparisons still
// typecheck; storm-test shots use only "none" (three characters, no crowd).
export type Crowd = "march" | "fall" | "water" | "bank" | "tourists" | "engineers" | "workers" | "crowd" | "none";
export type ShotDef = { id: number; a: number; b: number; light: Light; crowd: Crowd; tau: (t: number) => number; towns?: boolean };
// Shot bounds = round(start_s * 30) from storm_test/script.md + words.json (3.35 wps).
// Shots 1-5 are "night" (target 16: night storm lighting preset in lights.ts); shot 6 is "calm" (golden payoff).
// tau is identity everywhere: no flash-forward.
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 72, light: "night", crowd: "none", tau: (t) => t },
  { id: 2, a: 72, b: 233, light: "night", crowd: "none", tau: (t) => t },
  { id: 3, a: 233, b: 322, light: "night", crowd: "none", tau: (t) => t },
  { id: 4, a: 322, b: 466, light: "night", crowd: "none", tau: (t) => t },
  { id: 5, a: 466, b: 609, light: "night", crowd: "none", tau: (t) => t },
  { id: 6, a: 609, b: TOTAL, light: "calm", crowd: "none", tau: (t) => t },
];
/** No crossfades: every shot change is a hard cut on its trigger word. The S4->S5
 *  cut at f466 is a plain instant 1-frame hard cut. XFADE stays empty. */
export const XFADE: Record<number, number> = {};
/** No hook flash in the storm test (-1 = none). (Item 8: there is no local FLASH_AT
 *  in StormTest.tsx — the old Abu Simbel copy is gone; the story's -1 is the only source.) */
export const FLASH_AT = -1;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** layers to draw at frame f: base shot, plus the next shot fading in during a crossfade.
 *  XFADE is empty for the storm test, so this always returns the single current shot. */
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

/** The storm test never collapses: the intact state for every shot. */
export const bridgeState = (_id: number, _t: number): BridgeState =>
  ({ bounce: 0, drop: 0, snap: 0, collapsed: false });

// ---------------- word timing (LOCKED: storm_test/words.json, 3.35 wps) ----------------
// The locked script's words, one array per shot (78 words total). WORD_FRAMES[id-1][i] is
// the frame word i of shot id starts on: round(start_s * 30) from words.json (not the
// even-spacing estimate — these are the file's own timestamps). The char pass syncs
// expression steps to these frames; the camera pass cuts/glides on them.
export const WORDS: string[][] = [
  ["The", "sea", "was", "trying", "to", "eat", "the", "ship."],
  ["The", "captain", "held", "the", "wheel.", "The", "wind", "tore", "at", "the", "sails.", "The", "cook", "held", "a", "can", "of", "oil."],
  ["One", "sailor", "laughed.", "'Oil?", "Against", "THAT?'", "The", "captain", "said", "nothing."],
  ["But", "the", "cook", "poured", "the", "oil", "over", "the", "side.", "It", "shone", "gold", "on", "the", "black", "water."],
  ["You", "see,", "the", "oil", "lays", "the", "water", "flat.", "The", "wave", "sank", "down", "like", "a", "tired", "dog."],
  ["So", "the", "sea", "went", "quiet,", "and", "the", "ship", "sailed", "on."],
];
export const WORD_FRAMES: number[][] = [
  [0, 9, 18, 27, 36, 45, 54, 63],
  [72, 81, 90, 99, 107, 116, 125, 134, 143, 152, 161, 170, 179, 188, 197, 206, 215, 224],
  [233, 242, 251, 260, 269, 278, 287, 296, 304, 313],
  [322, 331, 340, 349, 358, 367, 376, 385, 394, 403, 412, 421, 430, 439, 448, 457],
  [466, 475, 484, 493, 501, 510, 519, 528, 537, 546, 555, 564, 573, 582, 591, 600],
  [609, 618, 627, 636, 645, 654, 663, 672, 681, 690],
];
/** frame of each shot's first word = its cut frame (6 cuts, one per shot) */
export const CUT_FRAMES: number[] = SHOTS.map((s) => s.a);
/** word frame helper: wf(shotId, wordIndex) — e.g. wf(3, 5) = 278 ("THAT?'") */
export const wf = (shot: number, idx: number) => WORD_FRAMES[shot - 1][idx];

/** monotone-cubic beat warp (skill): T = beat times per path key; returns path position 0..1.
 *  Zero speed at the first and last keys (m[0] = m[n-1] = 0). Used by the shot 6
 *  crane-up: the crane rides the word beats ("went" / "quiet," / "ship") instead of
 *  a fixed smootherstep, so the rise breathes with the narration. */
export function warpU(T: number[], t: number): number {
  const n = T.length; if (t <= T[0]) return 0; if (t >= T[n - 1]) return 1;
  const sec = []; for (let i = 0; i < n - 1; i++) sec.push((1 / (n - 1)) / (T[i + 1] - T[i]));
  const m = [0]; for (let i = 1; i < n - 1; i++) m.push(2 * sec[i - 1] * sec[i] / (sec[i - 1] + sec[i])); m.push(0);
  let i = 0; while (t > T[i + 1]) i++;
  const h = T[i + 1] - T[i], x = (t - T[i]) / h, x2 = x * x, x3 = x2 * x;
  return (2 * x3 - 3 * x2 + 1) * (i / (n - 1)) + (x3 - 2 * x2 + x) * h * m[i] + (-2 * x3 + 3 * x2) * ((i + 1) / (n - 1)) + (x3 - x2) * h * m[i + 1];
}

// ---------------- camera ----------------
// Grammar (motion.md, as in the bridge): every move is a symmetric smootherstep glide of
// 18-40 f (peak speed = 1.875 x distance / dur, so dur >= 0.075 x the move in 720p px keeps
// the peak near the reference 14-25 px/f); a reframe bigger than about half a frame width
// or 40 % zoom is a hard cut on its key frame. Glides are centred on their trigger word:
// a glide key starts dur/2 frames before the word frame. Holds push in (dolly toward the
// look point or a fov zoom near walls): 0.15-0.35 %/f, ~0.6 %/f for ~35 f on punch words.
// Rolls of 4-8 deg over >= 18 f on emphasis beats, held tilt <= 0.07 rad.
// Transition styles used (14): dolly push-in, fov zoom push, lateral track, crane-up
// (warpU beat crane, shot 6), low-angle tilt-up, orbit/arc, pull-back reveal, in-shot
// hard-cut reframe, Dutch roll glide, hard-cut tip-down (the pour, shot 4),
// punch-spike push, creep hold, 90 deg top-down macro insert (shot 5), crane-down
// (shot 5). The camera flies THROUGH the set within shots 2 and 4
// (low over the deck, then out over the rail and down to the water).
// PASS 3 (amended skill, target 8): Dutch rolls are 6-14 deg (0.10-0.24 rad) on
// conflict, pour and storm beats (S3 mocker, S4 pour, S1 storm punch) and 4-4.6 deg
// (0.07-0.08 rad) elsewhere. Two principled exceptions stay level (roll 0): the S5b
// top-down macro (a Dutch would rotate the bowl) and the S6 calm payoff + the S3e
// calm-captain close-up (level reads as calm). The v2 S3b/c rolls (-0.02/-0.05 rad)
// were far below the Dutch floor and are deepened to -0.14/-0.18/-0.22.
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
/** reference camera ease: symmetric smootherstep (attack = release, ~10 f each on a 23 f move) */
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const T = (f: number) => f / FPS;
/** push-in factor since f0: the subject grows ~rate per frame; `punch` raises it (with 8 f soft edges) for the first n frames */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
/** dolly push: camera slides toward the look point by factor k */
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
/** zoom push (camera stays put, for lenses next to walls): tan(fov/2) shrinks by k */
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });

// near-left anchor: the oil can in the cook's hands (shot 2/4); snapEnd is legacy bridge geometry
export const ANCHOR: V3 = [OIL_CAN[0], OIL_CAN[1], OIL_CAN[2]];
export const snapEnd = (snap: number): V3 => {
  const u = easeOut(snap);
  return [ANCHOR[0] - 0.6 * u, ANCHOR[1] + 5.5 * u - 2.0 * u * u, ANCHOR[2] + 4.5 * u];
};

// ---- framings (f -> camera); each pushes in from the frame its key starts ----
// shot 1 (wide, 0-72, night sea): the ship at sea in a storm, low over the water
// looking up at the hull. Wide -> lateral track + rise on "trying" (f27) -> push-in
// with a punch spike on "eat" (f45).
// PASS 2: the v1 cameras stood on the stern quarter ([30,3,58] -> [16,4,44]) — the ship read
// small and the bow taper was invisible (projected ship width 44% of frame at f36). The new
// keys rotate beam-on and pull closer/lower ([28,2.5,44] -> [23,3,39], look z +2..+3 so the
// near stern stays in frame): projected ship width 67% at f36, stern -0.70 / bow +0.63 / mast
// +0.45, all in frame through f63 (stern -0.89). Punch on "eat" kept, eased 0.006 -> 0.0045.
const S1a = (f: number) => dolly([28, 2.5, 44], [0, 7, 2], pushK(f, 0, 0.0025), { fov: 50, roll: 0.10 });
const S1b = (f: number) => dolly([25, 3.5, 42], [0, 8, 3], pushK(f, 11, 0.002), { fov: 48, roll: 0.10 });
const S1c = (f: number) => dolly([23, 3, 39], [0, 6, 3], pushK(f, 29, 0.002, 0.0045, 35), { fov: 46, roll: 0.12 });
// PASS 3 (new key): final push on "ship." (f63) — the ship grows to 81% of frame
// width by f71 (bow +0.79 / stern -0.84 / mast top +0.69, all in frame), Dutch 0.12.
const S1d = (f: number) => dolly([21, 2.5, 37], [0, 6, 3], pushK(f, 47, 0.002), { fov: 44, roll: 0.12 });
// shot 2 (deck medium, 72-233): low angle up the deck — captain at the wheel, then the
// camera cuts up the mast on "tore" (f134, roll), then cuts down to the cook on "cook"
// (f179), then a push on the oil can on "oil." (f224, punch).
const S2a = (f: number) => dolly([3.5, 1.1, 16], [-0.5, 2.2, 8], pushK(f, 72, 0.002), { fov: 46, roll: 0.07 });
const S2b = (f: number) => dolly([3.8, 1.3, 14.5], [0, 1.8, 9.5], pushK(f, 92, 0.002), { fov: 44, roll: 0.07 });
// PASS 3 (new key): captain close-up — the camera pushes in on the captain bracing
// at the wheel as "the wind tore at the sails" (glide centred on "wind", f125).
// Head 33% at f130, 36% at f133 (target 25-40%); the wheel stays centred behind him.
const S2cap = (f: number) => dolly([2.2, 1.6, 13.5], [0, 1.5, 10], pushK(f, 112, 0.002), { fov: 34, roll: 0.07 });
const S2c = (f: number) => dolly([4, 2.0, 14], [-1.6, 8.8, -2.5], pushK(f, 134, 0.002), { fov: 48, roll: 0.07 });
// PASS 3 (f150 toque fix): the v2 look [-1, 8.5, -2.5] left the cook's toque left
// edge at NDC x +0.98 at f150 — a ~2-5% peek into the bottom-right corner (the v2
// still). Panning the look left/up to [-1.6, 8.8, -2.5] pushes the toque's left edge
// to +1.14 (face left edge +1.20) — fully out with margin — and the whole mainsail
// now fits: belly (+0.62,+0.13), corners (+0.36,-0.61)/(-0.82,+0.99)/(+0.23,+0.50),
// pennant (+0.26,+0.84) in frame, mast top (+0.17,+1.03) rising out of the top edge
// as designed. Roll 0.04 -> 0.07 (the amended 4 deg floor). Sail geometry is the
// TRUE world geometry (mast z -1.5, belly (2,7.2,2) — see MAST_PT).
// PASS 3 CORRECTION to the PASS 2 note below: its sail corners and mast z (-2.5) drop
// world.ts's +1 m z shift — the true world corners are (0,3.7,-1.5)/(0,3.3,7.5)/
// (0,9.4,7.5)/(0,12.4,-1.5), belly (2,7.2,2), mast (0,0..18,-1.5) (see MAST_PT),
// and its f150 NDC values were computed from the wrong mast. The lens position
// (stern deck z = 14, 7.5 m from the sail's aft edge) and the "whole mainsail in
// frame" conclusion still hold; the PASS 3 numbers are in the note above.
// PASS 2 (corrected twice after the v2 stills): the first v2 S2c ([2,2,9] -> [-1,9,0], fov 46) and the
// second ([2,2,9] -> [-2.5,10.5,0], fov 52) both filled the frame with sail — the camera stood
// 2.5 m from the mainsail's aft edge, and the mirror had projected the sail from LOCAL build
// coords as if they were world coords (the ship is built hull-along-X and rotated +90 deg Y in
// world.ts: the mainsail's world corners are (0,3.7,-2.5) / (1,3.3,6.5) / (1,9.4,6.5) /
// (0,12.4,-2.5), belly (2,8,2); the mast is at world (0,0..18,-2.5)). The working lens stands
// back on the stern deck at z = 14, 7.5 m from the sail's aft edge, and looks up the mast:
// mast top (+0.14,+0.97) / pennant (+0.18,+0.85) / mast mid (+0.20,+0.20) / sail belly
// (+0.48,+0.26) / sail top-far (-0.33,+0.95) all in frame at f150 — the whole mainsail in
// frame with the mast rising out of the top edge, sky at the sides. Wheel rim nearest point
// (-3.54,-0.60), moved lantern (-6.81,-0.99), deck lantern (+1.45,-0.74): all out of frame
// (the deck lantern's 6 m light pool may kiss the bottom-right corner — that is lantern
// light on the deck, not the panel). The cabin lantern prop itself also moved to the port
// side (build.ts) so no S2 lens meets it.
// PASS 3 (tightened, target 6): cook MS — camera closer + fov 42 -> 34, so the head
// is 29% of frame width at f179, 30% at f195 (was ~19%). Feet stay in frame
// (cook fully visible); the rope-coil foreground moves with the lens (see FOREGROUND).
const S2d = (f: number) => dolly([4.0, 1.5, 7.0], [3.2, 1.3, 2], pushK(f, 179, 0.002), { fov: 34, roll: 0.07 });
// PASS 3 (new key): extra-tight oil-can CU on "can" (f197) — the 3D can at OIL_CAN
// [3.2, 1.0, 2] sits dead centre below the cook's face; head 38% at f197, 39% at
// f205; toque (+0.59 NDC) and chin clear the frame edges; feet crop at the knees,
// as a CU should. NOTE (cross-agent): this framing is aimed at the world pass's 3D
// can — dropping the card-drawn can in S2/S4 is the char pass's job (cast.ts
// prop "oilcan" / ["pour", k]); it is flagged for routing, not done here.
const S2can = (f: number) => dolly([4.6, 1.5, 5.6], [3.2, 1.35, 2], pushK(f, 197, 0.002), { fov: 34, roll: 0.07 });
// PASS 3: can push tightened (fov 38, look raised to [3.2, 1.1, 2]) — head 39% at the
// f222 punch peak (was 41%), true toque top [3.2, 2.01, 2] at NDC +0.68/+0.72,
// fully in frame. The can stays centre-bottom.
const S2e = (f: number) => dolly([4.0, 1.4, 5.5], [3.2, 1.1, 2], pushK(f, 212, 0.002, 0.006, 21), { fov: 38, roll: 0.07 });
// shot 3 (mocker CU, 233-322): MS of the laughing sailor, calm captain behind him ->
// push-in on the laugh (f251) -> hard-cut CU on "'Oil?" (f260, punch) -> Dutch roll
// deepens on "THAT?'" (f278, punch + kick) -> extra-tight CU cut on "THAT?'" itself
// (f278) -> HARD CUT to the calm captain on "captain" (f296) -> push-in CU on
// "nothing." (f313). PASS 3: the v2 S3d widen was a GLIDE from the tight CU — its
// look swings ~5 m in 24 f (43 px/f, over the 25 px/f cap) — so the rack is a cut
// on the word that names him, which is also the stronger beat.
// PASS 3 (tightened, target 6 — the S3 sailor is 1.3x scale, head 0.66 m wide):
// S3a fov 40 -> 36, head 35-37%; S3b re-aimed at the true face [0.5, 1.87, 4],
// head 58-60% (spec 45-65%); S3c loosened to 57% so the S3c2 cut reads; S3c2
// extra-tight at 62-63% at f278 (inside the 45-65% spec); S3d rack head 27%,
// S3e captain CU 32-37%.
const S3a = (f: number) => dolly([1.5, 1.8, -1], [0.5, 1.65, 6], pushK(f, 233, 0.002), { fov: 36, roll: 0.07 });
// PASS 3 (new key): push-in on the laugh — glide centred on "laughed." (f251).
// Head 42% mid-glide, ~46% settled; the captain stays soft behind him.
const S3a2 = (f: number) => dolly([1.3, 1.75, -0.2], [0.5, 1.75, 4], pushK(f, 242, 0.002), { fov: 33, roll: 0.07 });
const S3b = (f: number) => dolly([1.4, 1.7, 0.6], [0.5, 1.8, 4], pushK(f, 260, 0.0015, 0.006, 30), { fov: 32, roll: -0.14 });
const S3c = (f: number) => dolly([1.5, 1.7, 0.6], [0.5, 1.85, 4], pushK(f, 264, 0.002), { fov: 32, roll: -0.18 });
// PASS 3 (new key): extra-tight CU cut ON "THAT?'" (f278) — Dutch -0.22 rad (12.6 deg,
// the deepest in the short). Head 62% at f278, 63% at f285.
// PASS 4 (defect 4, f278 caption): look y 1.87 -> 1.82 — a fraction of tilt DOWN, so
// the chin ink-outline bottom clears the caption zone (post measured 68.2% down on
// the v3 still; the caption band top is 68%). Mirror: outline bottom 66.6% -> 63.9%
// down at f278 (63.9-64.3% across the key); head unchanged 62-64% (spec 45-65%).
const S3c2 = (f: number) => dolly([1.3, 1.75, 0.4], [0.5, 1.82, 4], pushK(f, 278, 0.002), { fov: 28, roll: -0.22 });
const S3d = (f: number) => dolly([1.8, 1.9, 4.5], [-1.3, 1.6, 9], pushK(f, 296, 0.002), { fov: 34, roll: -0.07 });
// PASS 3 (new key): captain CU on the last word — glide centred on "nothing." (f313),
// level roll (calm reads as level). Head 32% at f313, 37% at f321.
const S3e = (f: number) => dolly([1.4, 1.85, 5.6], [-1.3, 1.55, 9], pushK(f, 304, 0.002), { fov: 32, roll: 0 });
// shot 4 (the pour, 322-466): cook at the rail -> hard cut DOWN over the rail to the
// black water on "poured" (f349, punch) -> hard cut DOWN to the golden sheen on
// "side." (f394) -> push on the golden sheen on "gold" (f421, punch) -> pull back on
// "water." (f457). PASS 4: S4c was a 28 f glide centred on f394 — its mid-glide frame
// was the beam band (hull face across 61% of the frame, sheen centre out of frame),
// so it cuts on "side." instead (same precedent as the S4b tip-down cut).
// PASS 3 (tightened, target 6): S4a moves aft ([5.4, 2.3, 7.2], fov 34) — the v2
// tightening ([5.2, 2.2, 5.5]) sat 1.0 m from the rail segment, a giant-blob risk;
// the aft lens is 2.6 m+ from the rail and the rail still crosses the lower frame
// diagonally (z1 (+0.52,+0.02) -> z4 (-0.31,-0.55) at f335). Head 27-29%.
const S4a = (f: number) => dolly([5.4, 2.3, 7.2], [4, 1.3, 2], pushK(f, 322, 0.002), { fov: 34, roll: 0.07 });
const S4b = (f: number) => dolly([5.2, 3.2, 5.5], [5.5, -1.6, 3], pushK(f, 349, 0.002, 0.006, 35), { fov: 42, roll: 0.14 });
// PASS 3 (new key): oil-can CU on "oil" (f367), Dutch 0.14 — the frame is widened
// to cover BOTH can positions: the 3D can at the rail hands [4, 1.0, 2] reads at
// (+0.38,-0.22), and the OIL_CAN anchor [3.2, 1.0, 2] (where the world pass poses
// the S2/S4 can) at (-0.50,-0.28) — both in frame. Head 33-34%; toque (+0.29,+0.52).
// NOTE (cross-agent): in S4 the cook pours OVER THE SIDE, so the can belongs at the
// rail hands [4, 1.0, 2], not at the S2 mark [3.2, 1.0, 2] — flagged for the world
// pass; the camera covers either staging.
const S4can = (f: number) => dolly([5.6, 2.1, 5.8], [3.7, 1.35, 2], pushK(f, 367, 0.002), { fov: 36, roll: 0.14 });
// PASS 4 (defect 3, f394): pulled back/up to [8.0, 4.5, 4.0] looking at the sheen
// centre [7, -1.6, 0] — the hull face drops to a sliver at the left edge (beam
// fraction 0.61 -> 0.03, hull pts 452 -> 156, edge +0.23 -> -0.94) and the sheen
// centre comes in frame (-0.34,-0.69) with 27% sheen coverage (v3: 14%, centre out).
// The S4can CU now holds f367-394 (the pour "over the", then the cut lands on "side.").
const S4c = (f: number) => dolly([8.0, 4.5, 4.0], [7, -1.6, 0], pushK(f, 394, 0.002), { fov: 40, roll: 0.07 });
const S4d = (f: number) => dolly([4.8, 2.2, 1.5], [7, -1.6, 0], pushK(f, 407, 0.002, 0.006, 28), { fov: 36, roll: 0.10 });
const S4e = (f: number) => dolly([5.0, 2.6, 2.0], [6.8, -1.6, 0.2], pushK(f, 443, 0.002), { fov: 40, roll: 0.07 });
// shot 5 (the twist, 466-609) — PASS 3 RESTAGE (amended skill, beat 5: dedicated
// close-up analogy setup + 90 deg top-down macro insert). The v2 shot 5 (low over
// the water throughout) is gone, and the S4->S5 cut at f466 is a plain instant
// 1-frame hard cut.
// S5a 466-510: close-up analogy setup — the cook at the rail pouring oil from the
// can into a wooden bowl on a crate (bowl centre BOWL_PT [3.8, 0.9, 1.4], crate
// CRATE_PT [3.8, 0, 1.4] — fixed, built by the world pass; the bowl was NOT raised
// in v4 — the rim sits ~1.0 m (rim r 0.34 m at y 1.05 m, water r 0.325 m at y 1.03 m).
// The v4 rim NDC values (+0.61 above the rail, thread +0.16/-0.32, bowl 37% wide)
// assumed a raised rim (~1.5 m) and are VOID — see the v5 verified numbers below.
// The ray clearance (hands ray 1.20 m vs rail tube top 1.165 m) stands as computed.)
// Still f469 is rendered here.
// PASS 4 (defect 2, f469): the lens is RAISED to y 3.2 (was 2.0) and the look drops
// to y 1.2, fov 36 -> 35 — the brief's "lower the lens" is reversed by the geometry:
// at y 1.4-1.5 the sight-ray through the hands crosses the rail plane at 1.00-1.01 m,
// INSIDE the 0.09 m rail tube (top 1.165 m), so the can hid behind the rail bar;
// at y 3.2 the ray crosses at 1.20 m, 0.035 m clear of the tube top. Head 34-38%
// (spec 25-40%); face, toque and feet all in frame at f469, and the feet
// stay in frame through f509 (the key's end) — no knee-crop in v4 (v3 lost them ~f485).
// PASS 5 (v5 CAM verification, 2026-11-12 — lens FIXED, no numbers changed here):
// mirror-verified through this exact lens at f469 (cam_mirror.py V4 dict, sandbox
// story.ts S5a MATCH): head 34.7%; bowl rim frame x 34.6-73.7%, y 45.0-55.0%
// (39.1% wide), water x 35.5-72.8%, y 45.7-55.4%, centre (54%,54%); rail line
// crosses only the bowl's lower-right corner (x ~68-74%, y ~51-55%). The v4 thread
// is NOT in the bowl — grip (53%,63-65%), thread (62%,64-65%)->(62-63%,66-73%),
// 9-18% of frame height below the water ellipse (thread-in-bowl NO). The v5 fix is
// STAGING (char redraws pourBowl on the bowl's visible side — the crescent right of
// the cook, frame x ~63-74%, y ~45-55%): drawn canvas targets, verified in-water at
// f469 AND f481 after the 1.17 deg / 3 deg body lean — can grip (435,330), thread
// vertical at canvas x=435, y 360->395, drop (435,401), steadying hand (440,400);
// final thread frame (66%,50%)->(66%,52%) at f469 and (68%,50%)->(67%,53%) at f481,
// clear of the head by 25-47u. Full card-plane window inside the water ellipse:
// canvas x 235-485, y 360-425. Staging alone can work from this lens — no camera
// move. World option (not required): bowl +0.3 m outboard ([4.1,0.9,1.4]) moves the
// rim centre to (70%,55%); bow-ward shifts are banned (bowl lands behind the head).
// S5b 510-537: 90 deg TOP-DOWN MACRO, straight down at the bowl — gold film
// spreading across the black water. Still f515 is rendered here. Bowl 47% of frame
// width, crate corners in frame, a little deck at the edges, NO characters — the
// camera sits 2.3 deg off vertical (look z +0.15) so the projection stays defined.
// CONTRACT (char pass): the cook MUST step clear of the top-down footprint during
// f510-537 — staged at the rail [4, 0, 2] his face projects to (+0.31,-0.51) and
// his toque to (+0.39,-0.61), i.e. INSIDE the macro frame. He must be out of
// x 2.9-4.7, z -0.3-3.1 (deck level) for these 27 frames.
// S5c 537-564: low over the water, wave flattening, cook at the rail in frame
// (still f537). The v2 S5c lens is kept — cook face (-0.47,+0.36) / head
// (-0.48,+0.50) / feet (-0.44,+0.04) at f537, wave (+0.13,-0.03) centre — but its
// punch is retargeted from "flat." (f528, now inside S5b) to "sank" (f555).
// S5d 564-591: crane-down on the sinking wave (cut on "down", f564); the camera
// descends 0.7 -> 0.25 m across the key. Wave (+0.15,-0.02) centre; cook out of
// frame (-1.29,+0.81) as designed. S5e 591-609: settle low (cut on "tired", f591),
// wave (+0.28,-0.12) to (+0.29,-0.13).
// All five S5 cuts land on word frames: 466 "You", 510 "the", 537 "The", 564 "down",
// 591 "tired". The S5 FOREGROUND crest is DELETED (see FOREGROUND): the v2 crest
// sat behind the new S5a lens, and the S5c candidate crest lands mid-frame
// ((+0.46,+0.05)) instead of at the lower edge.
const S5a = (f: number) => dolly([6.0, 3.2, 5.2], [3.9, 1.2, 1.7], pushK(f, 466, 0.002), { fov: 35, roll: 0.07 });
const S5b = (f: number) => dolly([3.8, 4.6, 1.55], [3.8, 0.9, 1.4], pushK(f, 510, 0.002), { fov: 40, roll: 0 });
const S5c = (f: number) => dolly([9, 0.8, 12], [2.5, -1.0, -5], pushK(f, 537, 0.002, 0.006, 35), { fov: 44, roll: 0.07 });
// PASS 2: v1 S5c ([6.5,1,8] -> [2,-1.6,-6]) put the cook's head at NDC (-0.52,+1.30) at f537 —
// toque clipped, face at the top edge. The new lens pulls back (+x/+z) and tilts up (look y
// -1.6 -> -1.0): cook head (-0.54,+0.73) / face (-0.53,+0.53) / feet (-0.52,+0.08) at f537,
// head (-0.41,+0.68) at f528 (punch), wave (+0.14,-0.04) centre — cook fully in frame, wave
// still the subject. S5d unchanged: wave (+0.26,-0.04) at f555, cook exits up during the glide.
// (PASS 3: those v2 NDC values used the old face anchor y 1.6 / head 2.3; with the true
// geometry — face 1.44, toque top 2.01 — the same lens reads face (-0.47,+0.36) / head
// (-0.48,+0.50) / feet (-0.44,+0.04) at f537, and the punch now lands on "sank", f555.)
const S5d = (f: number) => {
  const k = smooth((f - 564) / 27); // crane-down: camera descends 0.7 -> 0.25 m over the key
  return dolly([6, 0.7 - 0.45 * k, 5], [1.5, -1.4, -8], pushK(f, 564, 0.002), { fov: 44, roll: 0.10 });
};
const S5e = (f: number) => dolly([4.5, 0.5, 2], [0, -1.6, -12], pushK(f, 591, 0.002), { fov: 46, roll: 0.07 });
// shot 6 (payoff wide, 609-700): calm golden sea, ship steady. ONE warpU beat crane:
// the crane rides the word beats (went f636 / quiet, f645 / ship f672 / end f700),
// zero speed at the first and last beats; a steady 0.25 %/f creep runs underneath so
// no frame is ever static, and a 0.6 %/f punch spike is centred on "quiet," (f645).
const S6_BEATS = [609, 636, 645, 672, 700].map((f) => f / FPS); // went / quiet, / ship / end
const S6_KEYS: Cam[] = [
  { pos: [32.4, 4.3, 51.8], look: [0, 3, 0], fov: 50, roll: 0 },
  { pos: [31.3, 6.5, 50.8], look: [0, 3.5, 0], fov: 49, roll: 0 },
  { pos: [30.2, 8.6, 49.7], look: [0, 4, 0], fov: 48, roll: 0 },
  { pos: [29.2, 10.8, 48.6], look: [0, 4, 0], fov: 47, roll: 0 },
  { pos: [31.3, 11.3, 51.8], look: [0, 3, 0], fov: 48, roll: 0 },
];
// PASS 2: v1 keys ([24,4,46] -> [18,11,44]) landed the ACTUAL f654 camera at [14.2,8.1,32.4] once
// the 0.25 %/f creep + 0.6 %/f "quiet," punch pulled it ~20 % toward the look point — stern at the
// frame edge (-0.97) at f654 and OUT (-1.1) by f672/f699, mast top grazing +0.90. The keys are scaled
// x1.08 outward (same beats, same rise 4.3 -> 11.3 m, same creep + punch): actuals f609 [32.4,4.3,51.8],
// f654 [23.2,8.3,38.3], f699 [21.3,8.6,35.2] — stern -0.87 / bow +0.51 / mast +0.71 at f654, stern
// -0.96 at f699, all in frame. The warpU beat crane itself is untouched.
const S6a = (f: number): Shot => {
  const u = warpU(S6_BEATS, T(f)); // 0..1, zero speed at first/last beat
  const x = u * (S6_KEYS.length - 1);
  const i = Math.min(S6_KEYS.length - 2, Math.floor(x));
  const k = x - i;
  const c = mix(S6_KEYS[i], S6_KEYS[i + 1], k);
  // nested dollies: steady 0.25 %/f creep from f609, plus a 0.6 %/f punch spike
  // centred on "quiet," (window f627-662, peak f644.5).
  const crept = dolly(c.pos, c.look, pushK(f, 609, 0.0025));
  return dolly(crept.pos, crept.look, pushK(f, 627, 0, 0.006, 35), { fov: c.fov, roll: c.roll });
};
// PASS 3 (new key): second S6 framing — a gentle push-in glide centred on "ship"
// (f672), riding on top of the warpU crane (worst 6.9 px/f). The ship stays in
// frame throughout: stern -0.89 at f672, -0.83 at f681, -0.88 at f699 (v2, crane
// alone, was -0.96 at f699); bow +0.47/+0.48, mast top +0.80/+0.83. Level roll:
// the calm payoff stays level.
const S6b = (f: number) => dolly([20, 9, 40], [0, 3.5, 0], pushK(f, 663, 0.002), { fov: 46, roll: 0 });

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: S1a }, // cut on "The"
    { f: 11, dur: 32, s: S1b }, // centred on 27 ("trying"), lateral track + rise
    { f: 29, dur: 32, s: S1c }, // centred on 45 ("eat"), punch on "eat"
    { f: 47, dur: 32, s: S1d }, // centred on 63 ("ship."), final push, Dutch 0.12
  ],
  2: [
    { f: 72, s: S2a }, // cut on "The", low angle up the deck
    { f: 92, dur: 28, s: S2b }, // centred on 106 ("wheel." 107), track to the wheel
    { f: 112, dur: 26, s: S2cap }, // centred on 125 ("wind"), push-in on the captain
    { f: 134, cut: true, s: S2c }, // cut on "tore": the mast tilt is a >40 deg reframe, so it cuts, roll 0.07
    { f: 179, cut: true, s: S2d }, // cut on "cook": the swing down to the cook is a big reframe, so it cuts
    { f: 197, cut: true, s: S2can }, // cut on "can": extra-tight can CU
    { f: 212, dur: 21, s: S2e }, // centred ~222 ("oil." 224, 2 f before = reaction), punch on the can
  ],
  3: [
    { f: 233, s: S3a }, // cut on "One"
    { f: 242, dur: 18, s: S3a2 }, // centred on 251 ("laughed."), push-in on the laugh
    { f: 260, cut: true, s: S3b }, // cut on "'Oil?", punch window covers "THAT?'"
    { f: 264, dur: 28, s: S3c }, // centred on 278 ("THAT?'"), Dutch roll deepens to -0.18
    { f: 278, cut: true, s: S3c2 }, // cut on "THAT?'": extra-tight CU, Dutch -0.22
    { f: 296, cut: true, s: S3d }, // cut on "captain": hard rack to the calm captain (was a 43 px/f glide)
    { f: 304, dur: 18, s: S3e }, // centred on 313 ("nothing."), push-in CU on the captain
  ],
  4: [
    { f: 322, s: S4a }, // cut on "But"
    { f: 349, cut: true, s: S4b }, // cut on "poured": the tip-down over the rail is a >50 deg reframe, so it cuts, punch
    { f: 367, cut: true, s: S4can }, // cut on "oil": oil-can CU, Dutch 0.14
    { f: 394, cut: true, s: S4c }, // cut on "side.": down-look, hull sliver at the left edge (was a 28 f glide)
    { f: 407, dur: 28, s: S4d }, // centred on 421 ("gold"), punch on the sheen
    { f: 443, dur: 23, s: S4e }, // centred ~454 ("water." 457, 3 f before), pull back
  ],
  5: [
    { f: 466, s: S5a }, // cut on "You": close-up analogy setup (cook + bowl + crate)
    { f: 510, cut: true, s: S5b }, // cut on "the": 90 deg top-down macro on the bowl
    { f: 537, cut: true, s: S5c }, // cut on "The": low over the water, cook at the rail
    { f: 564, cut: true, s: S5d }, // cut on "down": crane-down on the sinking wave
    { f: 591, cut: true, s: S5e }, // cut on "tired": settle low
  ],
  6: [
    { f: 609, s: S6a }, // cut on "So": one warpU beat crane for the whole shot (see S6a)
    { f: 663, dur: 18, s: S6b }, // centred on 672 ("ship"), gentle push-in on the crane
  ],
};

// impact kicks (reference v14): the image offset flips sign every frame (~3 px at 720p per unit), decays to 0 in
// 7 f, roll +-0.23 deg per unit; they start on the first frame at/after the event. No hand-held float.
// Kick times are word frames from WORD_FRAMES: "eat" (1,5) f45, "THAT?'" (3,5) f278,
// "poured" (4,3) f349, "flat." (5,7) f528, "quiet," (6,4) f645.
const KICKS: [number, number][] = [[wf(1, 5) / FPS, 1.0], [wf(3, 5) / FPS, 1.2], [wf(4, 3) / FPS, 1.0], [wf(5, 7) / FPS, 1.0], [wf(6, 4) / FPS, 0.5]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a; // metres at the look distance for 3 px x a
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
/** frame at which the current key's move has finished (for picking billboard views per key, not per frame) */
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens: depth of field + foreground framing ----------------
/** Lens blur per shot (thin lens). cInf = blur-disc radius in px at 1080x1920 for things at infinity; 0 = all sharp.
 *  Reference: DOF on in ~1/3 of shots; when on, background sigma720 CU 4.2, MS 4.0, FS 2.7, WS 1.9,
 *  foreground objects 4-8 (disc radius at 1080p = 3 x sigma720). Establishing/wide/most full shots stay sharp.
 *  Entries switch on cuts (no dur) or ramp with the camera glide they share f/dur with. focus = world point (else the
 *  camera look point). DOF-on frames (cInf > 0): S2 112-134 (22) + 179-212 (33), S3 233-322 (89),
 *  S4 322-394 (72) + 408-466 (58), S5a 466-510 (44) = 318 / 700 = 45.4% (see camera_plan.md). NOTE (merge):
 *  45.4% sits above the ~1/3 guide — the new S5a analogy CU needs eye focus per target 6, and the S2cap CU
 *  PASS 4: the S4 boundary moves 380 -> 394 with the S4c cut — the S4can CU keeps its
 *  cInf 10 focus through its hold to f394, then the down-look is sharp (cInf 0).
 *  adds 22; the share is flagged for the QC sheet, not trimmed by dropping a CU's focus. PASS 3: the S3 rack
 *  moves 290 -> 296 (the rack is now a cut on "captain"), focused on CAPTAIN_S3_FACE
 *  (the S3 captain stands at [-1.3, 0, 9], not at the wheel); S4a focuses on
 *  COOK_RAIL_FACE (the rail cook). Face anchors are the true geometry (see above). */
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 0 }, // S1 storm wide: ship + sea + sky all readable
  { f: 72, cInf: 0 }, // S2a/b deck + wheel + mast: the set must read
  { f: 112, cInf: 10, focus: () => CAPTAIN_FACE }, // S2cap captain CU: his eyes sharp
  { f: 134, cInf: 0 }, // S2c mast tilt: sail + sky must read
  { f: 179, cInf: 10, focus: () => COOK_FACE }, // S2d cook MS: his eyes sharp, rail soft behind
  { f: 212, cInf: 0 }, // S2e can push: the can + rail stay readable
  { f: 233, cInf: 12, focus: () => SAILOR_FACE }, // S3 mocker CU: his eyes sharp, captain soft behind
  { f: 296, cInf: 10, focus: () => CAPTAIN_S3_FACE }, // S3d cut to the calm captain
  { f: 322, cInf: 10, focus: () => COOK_RAIL_FACE }, // S4a cook at the rail MS
  { f: 394, cInf: 0 }, // S4c down-look from the f394 cut: rail + black water both readable
  { f: 407, dur: 20, cInf: 8, focus: () => SHEEN_PT }, // S4d sheen push (ramps with the glide)
  { f: 466, cInf: 12, focus: () => COOK_FACE_S5A }, // S5a analogy CU (merge, post spec): the cook's eyes sharp
  { f: 510, cInf: 0, focus: () => BOWL_PT }, // S5b top-down macro: kept SHARP — the bowl fills the frame at near-uniform depth, blur would only soften the mechanism
  { f: 537, cInf: 0, focus: () => WAVE_PT }, // S5c wave low: the flattening water must read whole
  { f: 609, cInf: 0 }, // S6 payoff wide: ship + calm sea both readable
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
/** what the lens focuses on (DOF): the DOF table's focus point, else the camera look point */
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};

/** near framing objects: visible while a <= f < b; kit = a GLB name accepted by build.ts prop().
 *  The world pass MUST provide these five kit names (spec section B prop kit): "wave_crest"
 *  (water-system crest mesh), "rope_coil", "rail" (rail segment, >= 4 m along the deck edge),
 *  "barrel", "life_ring".
 *  pos = base point (prop()'s x, y, z: the model's base sits on y), s = height in metres (prop()'s h), yaw in radians.
 *  They sit at 0.3-0.7 x the focus distance and cover 10-25 % of one frame edge, never a face; they are meant to be
 *  in front of the lens, so build them outside prop()'s sight-line test.
 *  Ranges stay inside one shot (world.ts shows an entry only inside its own shot, so crossfade layers never see it),
 *  and inside a single framing — a prop never survives a reframe it was not placed for.
 *  Every position below was verified by projecting it through camAt() at the range mid-frame
 *  AND both ends (see camera_plan.md): prop top in the lower-frame band (|ndc_x| 0.5-0.9,
 *  ndc_y -0.55..-0.9), base below the frame, 2.5-36 m from the lens, face clear by >= 0.5 NDC
 *  wherever a face is in frame (wides have no readable face, so clearance is N/A there).
 *  The S4 rail is verified as a SEGMENT (sampled every 0.5 m along the rail line): with the
 *  PASS 3 S4a lens it crosses the lower frame diagonally at f335, (0.52,0.02) to (-0.32,-0.57)
 *  for z 1-4 (the near part, z 5-6, sits 2.3-2.6 m from the lens and exits the bottom edge).
 *  Three framings take no foreground prop, by geometry not by omission: the S4b-S4e down-looks
 *  (the rail sits ~20 deg off the view axis, outside the 12 deg portrait half-FOV), the S5a
 *  close-up (the crate / bowl / can ARE the set dressing in frame) and the S5c-S5e low water
 *  close-ups (the camera looks toward -z, so near water is behind it; the S5c crest candidate
 *  lands mid-frame at (+0.46,+0.05), not at the lower edge). Their depth comes from the water
 *  system (crest / sheen / foam layers), not from a prop.
 *  Foreground in 5/6 shots (target 17 wants >= 2/3). */
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  // S1 (storm wide, focus ~65 m): a wave crest in the near sea between the lens and the
  // ship. PASS 2 (corrected after the v2 still): the first v2 crest (yaw 0.3, broadside to the
  // lens) read as a giant pale slab — the half-cylinder's 12.5 m flank, lit pale, is a wall
  // from the camera's angle. The ridge now points AT the lens (yaw -1.2, axis azimuth ~20° =
  // the S1 camera's bearing), so the camera sees the dome's curved profile with the white foam
  // cap on top, not the flank; the crest body is darkened in build.ts for the same reason.
  // Top NDC (+0.71,-0.22) f0 -> (+1.00,-0.33) f36, at the right edge and exiting ~f36-40
  // as the push-in completes (PASS 3: the 0.10 Dutch roll rotates it ~0.04 further right
  // than the v2 +0.96). Range ends at f49 so it never pops out mid-frame.
  { a: 0, b: 49, kit: "wave_crest", pos: [14, -1.6, 12], s: 2.5, yaw: -1.2 },
  // S2a (deck low angle, focus ~9 m): coiled rope on the deck, lower-right edge
  // (0.65,-0.56 at f72; 0.69,-0.59 at f82; 0.73,-0.62 at f91), 2.7-3.1 m from the
  // lens, 0.36x focus. Range ends at the f92 glide: the S2b lens moves toward this spot.
  { a: 72, b: 92, kit: "rope_coil", pos: [2.5, 0, 13.0], s: 0.7, yaw: 0.2 },
  // S2d (cook MS, focus ~5.1 m): coiled rope on the deck, lower-left edge.
  // PASS 3: the v2 coil [3.5, 0, 5.75] falls 37 deg off the tightened S2d lens axis
  // (NDC -3.06) — the lens moved closer and swung. The coil moves to [3.0, 0, 3.8]:
  // (-0.81,-0.73) at f188, 3.3 m from the lens, face clear (cook face ~(-0.1,+0.1)).
  // Range ends at the f197 can cut: the S2can lens lands near this spot.
  { a: 179, b: 197, kit: "rope_coil", pos: [3.0, 0, 3.8], s: 0.7, yaw: 0.2 },
  // S3a (mocker MS, focus ~5.1 m): a barrel at the lower-right edge (0.73,-0.64 at
  // f233; 0.77,-0.71 at f246), 2.6-2.8 m from the lens, face clear by 0.73 NDC.
  // PASS 3: range ends at f252, not f260 — by f259 the barrel is 1.9 m from the lens
  // and below the frame; at f252 it is still in the lower band (0.73,-0.91), 2.2 m out.
  { a: 233, b: 252, kit: "barrel", pos: [0.75, 0, 1.75], s: 1.1, yaw: 0.4 },
  // S4a (pour, focus ~5.5 m): the starboard rail crossing the lower frame diagonally
  // (segment z 1-4: (0.52,0.02) to (-0.32,-0.57) at f335), 3.5 m from the lens at its
  // closest visible point. Range ends at the f349 cut: the down-look cannot see the rail.
  { a: 322, b: 349, kit: "rail", pos: [4.0, 0, 4.5], s: 1.1, yaw: 0 },
  // S5 takes NO foreground entry (PASS 3): the v2 S5a crest [6.5, -1.6, 11.0] sits
  // BEHIND the restaged S5a lens (camera z 5.2 looking toward -z), and the S5c crest
  // candidate [5, -1.6, -3] lands mid-frame ((+0.46,+0.05) at f537) instead of at the
  // lower edge. The S5a CU carries the crate / bowl / can as set dressing; S5c-S5e
  // carry the water system. (The v2 S5 crest entry is deleted, not moved.)
  // S6 (payoff wide, focus ~52 m): a wave crest in the near sea between the lens and the
  // ship. PASS 2 (corrected after the v2 still): the first v2 crest (s 4, yaw 0.2, broadside)
  // was a 20 m pale slab covering the bottom half of f654 and hiding the sheen. Shrunk to
  // s 2.5 and turned end-on (yaw -0.9, axis azimuth ~40° = the S6 camera's bearing at f654).
  // Top (y = -1.6 + 2.5 = +0.9) NDC (-0.40,-0.13) f609 -> (-0.63,-0.41) f654 -> (-0.48,-0.49)
  // f699 (PASS 3: the S6b push-in shifts the f699 value from the v2 -0.71,-0.44; the crest
  // stays in the lower band). 26.9 m from the lens at f654.
  { a: 609, b: 700, kit: "wave_crest", pos: [6, -1.6, 18], s: 2.5, yaw: -0.9 },
];
