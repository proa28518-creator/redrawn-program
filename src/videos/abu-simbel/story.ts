// MERGED TRUTH — the audited Abu Simbel version. Do not overwrite from a sandbox without audit.
// Abu Simbel — Camera & Beat (Agent 3).
// Adapted from the bridge reference (templates/bridge/story.ts): same export names and
// signatures (FPS, TOTAL, D0, SHOTS, CAMS, KICKS, FOREGROUND, dofAt, camAt, kickAt, keyEnd,
// shotAt, layersAt, focusAt, warpU) so the merge typechecks. Bridge-only physics
// (marching column, deck bounce, collapse, swing) is retained as inert legacy exports for
// import compatibility — Abu Simbel has no marching column, no collapse and no swing.
// Timing is ESTIMATED only (3.35 wps, no voice file yet): every cut lands on the frame of
// its trigger word under even word spacing inside each shot; re-time once audio exists.
//
// Composition: AbuSimbel, 1080x1920, 30 fps, 1674 frames (55.8 s), 12 shots.
// World datum: ground y = 0 (D0). Three sites at distinct x offsets (skill: one scene,
// distinct x per location): OLD temple site x = 0 (shots 1-6), HOME wardrobe room
// x = 240 (shot 7), NEW rebuilt site x = 120 (shots 8-11), SANCTUM interior x = 120,
// z = -12 inside the rebuilt cliff (shot 12). The "65 m higher" of the story is narrative:
// the new site is built on its own terrace at the same local datum 0 — the world pass
// must NOT offset it by a literal 65 m, or every camera height in shots 8-12 breaks.
// Temple facade plane is z = 0 at both sites; cameras stand at z > 0 looking toward -z.
// The Nile is at z ~ +38..+45 at the old site; the new site's river is far behind (z > 30).
export const FPS = 30;
export const TOTAL = 1674;
export const D0 = 0.0; // ground datum (m); bridge used 6.0 (deck height) — Abu Simbel ground is 0
export const HALF = 27; // legacy bridge constant (tower half-span); retained, unused here
export const FILES = [-1.65, -0.55, 0.55, 1.65]; // legacy bridge constants; retained, unused here
export const ROW_GAP = 1.3; // legacy bridge constant; retained, unused here
export const COUNT = 74; // legacy bridge constant; retained, unused here
/** Wardrobe-room anchor (x, ground y, z). Bridge PARK was the park-swing pivot; Abu Simbel
 *  has no swing — PARK now marks the home-room (shot 7) site centre. */
export const PARK: V3 = [240, D0, 0];
export type V3 = [number, number, number];

// Site centres (x offsets) and subject anchors — the single source of truth for framings.
export const OLD_X = 0; // old temple site (shots 1-6)
export const NEW_X = 120; // rebuilt temple site (shots 8-11)
export const HOME_X = 240; // wardrobe room (shot 7)
export const MOCKER: V3 = [0, 0, 3]; // laughing man, old site (shot 4, 6)
export const BLOCK_PT: V3 = [0.5, 7, 0]; // marked 30-ton block in the old facade (shot 3)
export const WARDROBE: V3 = [HOME_X, 0, 0]; // big wardrobe, home room (shot 7)
export const DOOR_PT: V3 = [HOME_X + 1, 1.2, -2]; // open door in the room's back wall (shot 7)
export const WORKERS_PT: V3 = [NEW_X, 1.6, 2]; // terrace workers, new site (shot 9)
export const SILENT_MAN: V3 = [133, 0, 2.5]; // laughing man, silent, new site (shot 11)
export const STATUES_PT: V3 = [NEW_X, 2.4, -15]; // inner-room statues, sanctum (shot 12)

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

// ---------------- legacy bridge story physics (inert for Abu Simbel) ----------------
// No marching column, no bounce, no collapse: front() is the fixed subject plane (z = 0),
// amp/stomp/marchPhase/dropU are retained verbatim for import compatibility, deckY is flat
// (DROP_H = 0), and bridgeState() always returns the intact state.
export const front = (_tau: number) => 0; // subject plane z = 0 (temple facade), all shots
export const marchPhase = (tau: number) => ((tau % 1) + 1) % 1; // legacy; unused here
/** The drop scare: "drop" (shot 6, word 17) lands at frame 913. SNAP/DROP0/DROP1 name it. */
export const SNAP = 913 / FPS, DROP0 = 913 / FPS, DROP1 = (913 + 18) / FPS;
export const amp = (tau: number) =>
  lin([[14.85, 0], [17.8, 0.07], [21.4, 0.13], [27.4, 0.26], [33.0, 0.46], [SNAP, 0.55], [SNAP + 0.35, 0.0]], tau);
export const stomp = (tau: number) => lin([[21.4, 1.0], [27.4, 1.35], [33, 1.5]], tau);
export const shapeZ = (z: number) => (Math.abs(z) < HALF ? Math.cos((Math.PI * z) / (2 * HALF)) : 0);
export const dropW = (z: number) => smooth((20 - z) / 26);
export const dropU = (tau: number) => (tau < DROP0 ? 0 : Math.min(1, ((tau - DROP0) / (DROP1 - DROP0)) ** 2));
export const DROP_H = 0; // no drop: the temples are never dropped, the man only fears it

export type BridgeState = { bounce: number; drop: number; snap: number; collapsed: boolean };
export const deckY = (z: number, b: BridgeState) => D0 + b.bounce * shapeZ(z) - b.drop * DROP_H * dropW(z);

// ---------------- shots ----------------
export type Light = "day" | "golden" | "dawn" | "sanctuary";
// Bridge crowd members ("march" | "fall" | "water" | "bank" | "tourists") are retained so the
// bridge-copy cast.ts comparisons still typecheck; Abu Simbel shots use only
// "engineers" | "workers" | "none". The char pass may narrow this union when it rewrites cast.ts.
export type Crowd = "march" | "fall" | "water" | "bank" | "tourists" | "engineers" | "workers" | "crowd" | "none";
export type ShotDef = { id: number; a: number; b: number; light: Light; crowd: Crowd; tau: (t: number) => number; towns?: boolean };
// Shot bounds = round(start_s * 30) from script.md (3.35 wps estimates). Shot 11's start
// 49.55 s = 1486.5 f rounds to 1487 (+0.5 f = +17 ms, inside the ~39 ms cut tolerance).
// light: shot 1 is dawn, shot 12 is the sanctuary shaft (their own presets in lights.ts);
// shot 7 (interior room) is day (window light). tau is identity everywhere: no flash-forward.
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 90, light: "dawn", crowd: "none", tau: (t) => t },
  { id: 2, a: 90, b: 215, light: "day", crowd: "none", tau: (t) => t },
  { id: 3, a: 215, b: 340, light: "day", crowd: "none", tau: (t) => t },
  { id: 4, a: 340, b: 582, light: "day", crowd: "engineers", tau: (t) => t },
  { id: 5, a: 582, b: 761, light: "day", crowd: "engineers", tau: (t) => t },
  { id: 6, a: 761, b: 940, light: "day", crowd: "engineers", tau: (t) => t },
  { id: 7, a: 940, b: 1110, light: "day", crowd: "none", tau: (t) => t },
  { id: 8, a: 1110, b: 1352, light: "day", crowd: "workers", tau: (t) => t },
  { id: 9, a: 1352, b: 1424, light: "day", crowd: "workers", tau: (t) => t },
  { id: 10, a: 1424, b: 1487, light: "day", crowd: "none", tau: (t) => t },
  { id: 11, a: 1487, b: 1540, light: "day", crowd: "none", tau: (t) => t },
  { id: 12, a: 1540, b: TOTAL, light: "sanctuary", crowd: "none", tau: (t) => t },
];
/** crossfades (frames) at the two biggest place jumps: into the wardrobe room (shot 7)
 *  and back out to the new site (shot 8). Every other shot change is a hard cut. */
export const XFADE: Record<number, number> = { 7: 6, 8: 6 };
/** a 4-frame cream flash after the hook (end of shot 1, start of shot 2) */
export const FLASH_AT = 90;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** layers to draw at frame f: base shot, plus the next shot fading in during a crossfade */
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

/** Abu Simbel never collapses: the intact state for every shot. */
export const bridgeState = (_id: number, _t: number): BridgeState =>
  ({ bounce: 0, drop: 0, snap: 0, collapsed: false });

// ---------------- word timing (estimated: even spacing inside each shot) ----------------
// The locked script's words, one array per shot (187 words total). WORD_FRAMES[id-1][i] is
// the frame word i of shot id starts on: a + round(i * (b - a) / n). The char pass syncs
// expression steps to these frames; the camera pass cuts/glides on them. Re-time from the
// real voice file (words.json) when it exists — these are 3.35 wps estimates.
export const WORDS: string[][] = [
  ["They", "cut", "two", "giant", "temples", "into", "pieces", "and", "moved", "them."],
  ["At", "Abu", "Simbel,", "UNESCO", "raced", "the", "rising", "Nile", "to", "save", "two", "giant", "rock", "temples."],
  ["The", "temples", "were", "solid", "stone,", "and", "one", "block", "alone", "weighed", "up", "to", "30", "tons."],
  ["One", "man", "laughed.", "'You", "cannot", "move", "a", "mountain!'", "The", "engineers", "said", "nothing.", "They", "kept", "measuring", "the", "stone,", "day", "after", "day,", "and", "quietly", "carried", "on", "with", "the", "work."],
  ["But", "the", "engineers", "cut", "the", "temples", "into", "more", "than", "a", "thousand", "blocks.", "Saws", "sang,", "and", "white", "dust", "filled", "the", "air."],
  ["Then,", "slowly,", "they", "lifted", "each", "block,", "one", "by", "one,", "and", "the", "man", "laughed", "again.", "'Now", "you", "will", "drop", "them", "all!'"],
  ["You", "see,", "it", "was", "like", "moving", "a", "wardrobe.", "You", "take", "it", "apart", "and", "carry", "each", "piece", "through", "the", "door."],
  ["Then", "you", "build", "it", "again", "in", "the", "new", "room.", "They", "built", "the", "temples", "again,", "stone", "by", "stone,", "65", "metres", "higher", "and", "200", "metres", "back", "from", "the", "river."],
  ["So", "fifty", "countries", "worked", "from", "1964", "to", "1968."],
  ["The", "move", "cost", "about", "forty", "million", "dollars."],
  ["So", "the", "laughing", "man", "stood", "silent."],
  ["So", "the", "sun", "still", "finds", "the", "same", "room", "on", "the", "same", "two", "days", "each", "year."],
];
export const WORD_FRAMES: number[][] = SHOTS.map((s, i) => {
  const ws = WORDS[i], n = ws.length;
  return ws.map((_, k) => s.a + Math.round((k * (s.b - s.a)) / n));
});
/** frame of each shot's first word = its cut frame (12 cuts, one per shot) */
export const CUT_FRAMES: number[] = SHOTS.map((s) => s.a);
/** word frame helper: wf(shotId, wordIndex) — e.g. wf(4, 7) = 403 ("mountain!'") */
export const wf = (shot: number, idx: number) => WORD_FRAMES[shot - 1][idx];

/** monotone-cubic beat warp (skill): T = beat times per path key; returns path position 0..1 */
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
// Transition styles used (12, skill wants 11+): dolly push-in, fov zoom push, lateral
// track, crane-up, low-angle tilt-up, orbit/arc, pull-back reveal, in-shot hard-cut
// reframe, Dutch roll glide, follow-crane (tracking the lift), punch-spike push, creep hold.
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
/** a roll-only move on top of an existing framing */
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });

// near-left anchor: the marked block in the old facade (shot 3); snapEnd is legacy bridge geometry
export const ANCHOR: V3 = [BLOCK_PT[0], BLOCK_PT[1], BLOCK_PT[2]];
export const snapEnd = (snap: number): V3 => {
  const u = easeOut(snap);
  return [ANCHOR[0] - 0.6 * u, ANCHOR[1] + 5.5 * u - 2.0 * u * u, ANCHOR[2] + 4.5 * u];
};

// ---- framings (f -> camera); each pushes in from the frame its key starts ----
// shot 1 (hook, 0-90, dawn wide): the strangest picture in the first 2 s — the two colossal
// temple faces cut into the cliff, whole frame. Wide -> closer on "temples" (f36, punch)
// -> low push on "moved" (f72).
const S1a = (f: number) => dolly([6, 10, 88], [-0.5, 11, 0], pushK(f, 0, 0.0025), { fov: 48 });
const S1b = (f: number) => dolly([4, 9, 84], [-0.5, 10, 0], pushK(f, 20, 0.002, 0.006, 35), { fov: 46 });
const S1c = (f: number) => dolly([2, 7, 80], [-0.5, 10, 0], pushK(f, 56, 0.003), { fov: 45, roll: 0.04 });
// shot 2 (Nile bank, 90-215): low at the water -> lateral track + rise on "rising" (f144)
// -> crane up to reveal the temples above the water on "rock" (f197).
const S2a = (f: number) => dolly([6, 1.2, 44], [0, 9, 0], pushK(f, 90, 0.002), { fov: 44 });
const S2b = (f: number) => dolly([-6, 3, 68], [-3, 10, 0], pushK(f, 132, 0.002), { fov: 44 });
const S2c = (f: number) => dolly([0, 9, 90], [-3, 13, 0], pushK(f, 185, 0.002), { fov: 44 });
// shot 3 (facade block, 215-340): MS of the facade -> insert on "block" (f277)
// -> hard-cut tighter zoom insert on "30" (f322, punch on "30 tons").
const S3a = (f: number) => dolly([3, 6, 14], [0, 7, 0], pushK(f, 215, 0.0025), { fov: 38 });
const S3b = (f: number) => dolly([3.0, 6.5, 11], [0.5, 7, 0], pushK(f, 263, 0.002), { fov: 36 });
const S3c = (f: number) => zoom([0.8, 7, 4.5], [0.5, 7, 0], 30, pushK(f, 322, 0.002, 0.006, 18));
// shot 4 (mocker, 340-582): MS of the laughing man, calm engineers behind -> hard-cut CU on
// "mountain!'" (f403, punch + kick + roll) -> widen to the measuring engineers on "measuring" (f465).
const S4a = (f: number) => dolly([2.6, 1.8, 14], [0.2, 1.5, 2.6], pushK(f, 340, 0.002), { fov: 42 });
const S4b = (f: number) => dolly([0.9, 1.7, 6.5], [0, 1.65, 3], pushK(f, 403, 0.0015, 0.006, 30), { fov: 32, roll: -0.035 });
const S4c = (f: number) => dolly([3.5, 2.4, 15], [0, 1.1, 1.8], pushK(f, 438, 0.002), { fov: 46 });
// shot 5 (cutting, 582-761): wide cutting line -> lateral track on "thousand" (f672)
// -> low angle into the dust on "white" (f716, roll).
const S5a = (f: number) => dolly([6, 2.5, 12], [0, 3, 1], pushK(f, 582, 0.002), { fov: 44 });
const S5b = (f: number) => dolly([-4, 2.5, 9.5], [0, 2.5, 2], pushK(f, 660, 0.002), { fov: 42 });
const S5c = (f: number) => dolly([-1.5, 1.5, 8.5], [0, 2.8, 2], pushK(f, 704, 0.002), { fov: 40, roll: 0.04 });
// shot 6 (lift, 761-940): MS of the block mid-lift -> follow-crane up on "lifted" (f788)
// -> hard-cut low angle on the man below on "drop" (f913, punch + kick).
const S6a = (f: number) => dolly([2.5, 3.2, 16.5], [0.3, 2.8, 4], pushK(f, 761, 0.0025), { fov: 46 });
const S6b = (f: number) => dolly([3.0, 4.2, 16.5], [0.3, 3.6, 4], pushK(f, 774, 0.002), { fov: 44 });
const S6c = (f: number) => dolly([-2, 1.2, 9], [0, 1.6, 3], pushK(f, 913, 0.0015, 0.006, 27), { fov: 36, roll: -0.03 });
// shot 7 (wardrobe room, 940-1110): wide room -> orbit/arc to the other side on "wardrobe" (f1003)
// -> zoom push toward the open door on "the door" (f1097).
const S7a = (f: number) => dolly([HOME_X + 5, 2.2, 7], [HOME_X, 1.5, 0], pushK(f, 940, 0.002), { fov: 44 });
const S7b = (f: number) => dolly([HOME_X - 4, 2, 6], [HOME_X, 1.4, 0], pushK(f, 989, 0.002), { fov: 40 });
const S7c = (f: number) => zoom([HOME_X + 2, 1.6, 4.5], [HOME_X + 0.5, 1.3, -1], 36, pushK(f, 1085, 0.002)); // look sits between wardrobe and door: both stay in frame
// shot 8 (rebuild, 1110-1352): wide new site -> crane up on "65" (f1262)
// -> pull-back revealing the river far behind on "200 metres" (f1302, roll).
const S8a = (f: number) => dolly([NEW_X + 6, 9, 100], [NEW_X - 0.5, 11, 0], pushK(f, 1110, 0.002), { fov: 48 });
const S8b = (f: number) => dolly([NEW_X + 4, 14, 98], [NEW_X - 0.5, 12, 0], pushK(f, 1247, 0.002), { fov: 46 });
const S8c = (f: number) => dolly([NEW_X - 8, 13, 102], [NEW_X - 0.5, 10, 0], pushK(f, 1287, 0.002), { fov: 44, roll: -0.03 });
// shot 9 (fifty countries, 1352-1424, 72 f): one MS push on the terrace workers, punch on "fifty" (f1361).
const S9a = (f: number) => dolly([NEW_X + 4, 2.2, 13.5], [NEW_X, 1.6, 2], pushK(f, 1352, 0.003, 0.006, 35), { fov: 38 });
// shot 10 (cost, 1424-1487, 63 f): one wide creep on the finished temples.
const S10a = (f: number) => dolly([NEW_X + 6, 8, 88], [NEW_X - 0.5, 11, 0], pushK(f, 1424, 0.0015), { fov: 48 });
// shot 11 (silent man, 1487-1540, 53 f): one slow zoom CU, no punch — the silence beat.
const S11a = (f: number) => zoom([133, 2.2, 11], [133, 2.6, 2.5], 38, pushK(f, 1487, 0.002));
// shot 12 (sun shaft, 1540-1674): down the shaft, punch on "sun" (f1558) -> push to the
// statues on "same room" (f1594) -> settle low on the statues on "two days" (f1643).
const S12a = (f: number) => dolly([NEW_X + 2, 2.6, -1], [NEW_X, 2.5, -14], pushK(f, 1540, 0.002, 0.006, 35), { fov: 40 });
const S12b = (f: number) => dolly([NEW_X + 1, 2.2, -3], [NEW_X, 2.2, -15], pushK(f, 1580, 0.0025), { fov: 38 });
const S12c = (f: number) => dolly([NEW_X, 2.4, -5], [NEW_X, 2.2, -15], pushK(f, 1629, 0.002), { fov: 44 });

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: S1a },
    { f: 20, dur: 32, s: S1b }, // centred on 36 ("temples"), punch on "giant temples"
    { f: 56, dur: 32, s: S1c }, // centred on 72 ("moved"), roll 0 -> +0.04
  ],
  2: [
    { f: 90, s: S2a }, // cut on "At"
    { f: 132, dur: 24, s: S2b }, // centred on 144 ("rising")
    { f: 185, dur: 24, s: S2c }, // centred on 197 ("rock")
  ],
  3: [
    { f: 215, s: S3a }, // cut on "The"
    { f: 263, dur: 28, s: S3b }, // centred on 277 ("block")
    { f: 322, cut: true, s: S3c }, // cut on "30", punch on "30 tons"
  ],
  4: [
    { f: 340, s: S4a }, // cut on "One"
    { f: 403, cut: true, s: S4b }, // cut on "mountain!'" (+ kick), roll -0.035
    { f: 438, dur: 30, s: S4c }, // centred ~453, lands on "measuring" (465); engineers in frame by f461 (was key 450, engineer entered f470)
  ],
  5: [
    { f: 582, s: S5a }, // cut on "But"
    { f: 660, dur: 24, s: S5b }, // centred on 672 ("thousand")
    { f: 704, dur: 24, s: S5c }, // centred on 716 ("white"), roll 0 -> +0.04
  ],
  6: [
    { f: 761, s: S6a }, // cut on "Then,"
    { f: 774, dur: 28, s: S6b }, // centred on 788 ("lifted"), follow-crane
    { f: 913, cut: true, s: S6c }, // cut on "drop" (+ kick), punch, roll -0.03
  ],
  7: [
    { f: 940, s: S7a }, // cut on "You" (6 f crossfade under the cut, see XFADE)
    { f: 989, dur: 28, s: S7b }, // centred on 1003 ("wardrobe"), orbit/arc
    { f: 1085, dur: 24, s: S7c }, // centred on 1097 ("the door"), zoom push
  ],
  8: [
    { f: 1110, s: S8a }, // cut on "Then" (6 f crossfade under the cut, see XFADE)
    { f: 1247, dur: 30, s: S8b }, // centred on 1262 ("65"), crane up
    { f: 1287, dur: 30, s: S8c }, // centred on 1302 ("200 metres"), pull-back, roll -0.03
  ],
  9: [
    { f: 1352, s: S9a }, // cut on "So", punch on "fifty" (f1361, inside the 35 f punch window)
  ],
  10: [
    { f: 1424, s: S10a }, // cut on "The", single creep hold
  ],
  11: [
    { f: 1487, s: S11a }, // cut on "So", single slow zoom — no punch (silence beat)
  ],
  12: [
    { f: 1540, s: S12a }, // cut on "So", punch on "sun" (f1558, inside the 35 f punch window)
    { f: 1580, dur: 28, s: S12b }, // centred on 1594 ("same")
    { f: 1629, dur: 28, s: S12c }, // centred on 1643 ("two days")
  ],
};

// impact kicks (reference v14): the image offset flips sign every frame (~3 px at 720p per unit), decays to 0 in
// 7 f, roll +-0.23 deg per unit; they start on the first frame at/after the event. No hand-held float.
// Kick times are word frames from WORD_FRAMES: "mountain!'" (4,7) f403, "drop" (6,17) f913,
// "fifty" (9,1) f1361, "sun" (12,2) f1558.
const KICKS: [number, number][] = [[wf(4, 7) / FPS, 1.0], [wf(6, 17) / FPS, 1.2], [wf(9, 1) / FPS, 0.5], [wf(12, 2) / FPS, 0.4]];
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
 *  camera look point). DOF-on frames (cInf > 0): S3 275-340, S4 340-460, S6 761-850, S7 1003-1110,
 *  S9 1352-1424, S11 1487-1540, S12 1600-1674 = 580 / 1674 = 34.6% (see camera_plan.md). */
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 0 }, // S1 hook wide: the whole cliff must read in the first 2 s
  { f: 90, cInf: 0 }, // S2 Nile wide: water + temples both readable
  { f: 275, dur: 20, cInf: 8, focus: () => [BLOCK_PT[0], BLOCK_PT[1], BLOCK_PT[2]] }, // S3 block insert (ramps with the glide)
  { f: 340, cInf: 12, focus: () => [0, 1.65, 3] }, // S4 mocker CU: his eyes sharp, engineers soft behind
  { f: 440, dur: 20, cInf: 0 }, // S4c widens to the engineers: ramp out before the glide lands
  { f: 582, cInf: 0 }, // S5 cutting line: saws + dust stay readable
  { f: 761, cInf: 12, focus: () => [0, 7, 0] }, // S6 block mid-lift CU, focus = the block
  { f: 830, dur: 20, cInf: 0 }, // S6 block rises out of CU: ramp out
  { f: 1003, dur: 20, cInf: 10, focus: () => [WARDROBE[0], 1.4, WARDROBE[2]] }, // S7 wardrobe MS, focus = wardrobe
  { f: 1110, cInf: 0 }, // S8 rebuild wide: new site + river both readable
  { f: 1352, cInf: 10, focus: () => [WORKERS_PT[0], WORKERS_PT[1], WORKERS_PT[2]] }, // S9 terrace workers MS
  { f: 1424, cInf: 0 }, // S10 finished temples wide
  { f: 1487, cInf: 14, focus: () => [133, 1.65, 2.5] }, // S11 silent man CU: his eyes sharp, temples soft behind
  { f: 1540, cInf: 0 }, // S12a sun shaft: the shaft itself must read
  { f: 1600, dur: 20, cInf: 12, focus: () => [STATUES_PT[0], STATUES_PT[1], STATUES_PT[2]] }, // S12 statues CU
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

/** near framing objects: visible while a <= f < b; kit = a GLB name accepted by build.ts prop() */
// pos = base point (prop()'s x, y, z: the model's base sits on y), s = height in metres (prop()'s h), yaw in radians.
// They sit at 0.3-0.5 x the focus distance and cover 10-25 % of one frame edge, never a face; they are meant to be
// in front of the lens, so build them outside prop()'s sight-line test.
// Ranges stay inside one shot (world.ts shows an entry only inside its own shot, so crossfade layers never see it),
// and inside a single framing — a prop never survives a reframe it was not placed for.
// Every position below was verified by projecting it through camAt() (see camera_plan.md):
// top of prop at |ndc_x| 0.5-0.75, ndc_y -0.55..-0.82 (lower edge), base below the frame,
// 2.9-13.3 m from the lens at 0.39-0.54x the focus distance, face clear by >= 0.5 NDC.
// Why only 4 shots: every exterior camera looks UP at 20 m faces, so a ground prop cannot
// enter the frame in shots 1, 2, 3, 5, 6, 8 (grid-searched, zero placements); shots 11-12 are
// too tight / interior. Kit names are bridge-proven only ("plant_bushDetailed", "tree_default").
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  // S4a (mocker MS, focus ~5.9 m): dry shrub at the lower-left edge, 3.2 m from the lens.
  // Range ends at the f403 cut: the S4b lens lands 0.35 m from this spot, so the prop must be gone.
  { a: 340, b: 403, kit: "plant_bushDetailed", pos: [1.3, 0, 5.8], s: 0.7, yaw: 0.2 },
  // S7a (room, focus ~8.3 m): tall potted plant at the lower-right edge, 4.0 m from the lens.
  { a: 940, b: 989, kit: "plant_bushDetailed", pos: [HOME_X + 3.3, 0, 3.7], s: 1.0, yaw: 0.2 },
  // S9 (terrace workers, focus ~7.7 m): dry shrub at the lower-right edge, 3.8 m from the lens.
  { a: 1352, b: 1424, kit: "plant_bushDetailed", pos: [NEW_X + 2.9, 0, 6.3], s: 0.7, yaw: 0.4 },
  // S10 (finished temples wide, focus ~34 m): one tree at the lower-right edge, 13.3 m from
  // the lens. QC FLAG: confirm on stills it reads as a site tree, not a misplaced cartoon oak —
  // if it fails, drop it (3 foreground shots is acceptable, see camera_plan.md).
  { a: 1424, b: 1487, kit: "tree_default", pos: [NEW_X + 10.5, 0, 22], s: 3, yaw: 0.4 },
];

// Burnt-in canvas texts — the ONLY texts drawn on canvas in this video (suggestion E).
// Every fillText literal and every signBoard call must match an entry here exactly;
// the check script (scripts/check-texts.mjs) enforces it. fxSign is text-free by design.
export const TEXTS: { key: string; lines: string[] }[] = [
  { key: "chalk", lines: ["30 t"] },
  { key: "tons", lines: ["30 TONS"] },
  { key: "higher", lines: ["65 M HIGHER", "200 M BACK"] },
  { key: "years", lines: ["1964 – 1968"] },
];
