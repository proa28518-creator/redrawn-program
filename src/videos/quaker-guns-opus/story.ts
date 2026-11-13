// Timeline of "Quaker Guns": shots timed to the locked voice words (timing.json, 93 words, 36.8 s, 1104 f @ 30 fps).
// Scene geography (metres, ground y = 0, Union army faces -z):
//   - Confederate earthworks: trench / parapet line along z = -18, crest y ~1.2; log "cannons" (painted black,
//     some on wagon-wheel carriages) sit in embrasures at x = -15, -9, -3, 3, 9, 15, muzzles pointing +z.
//   - The hero log (the one knocked in S7, tapped in S8) is ANCHOR at x = -3.
//   - Union front rank halts at z = front(tau) = 8; ranks stack behind it toward +z.
//   - McClellan watches from a rise at (12, ground 3.0, 28), eye ~y 4.6.
//   - The making yard (S5) is behind the works at z ~ -30; the fake-CCTV analogy set (S4) lives at PARK, x = 70.
// Camera grammar (house targets 8/9): continuous motion in ~97% of frames; every hold creeps in at
// 0.15-0.35 %/f, spiking to 0.6 %/f on punch words ("300" f414, the knock f870, "المسالمة" f690); big reframes
// are hard cuts on sentence boundaries; impacts are 7-frame sign-flipping kicks; no ghost crossfades over faces;
// the only dissolve is an 8 f time-passage fade into the dusk wide (S6). Rolls: 6-8 deg on the mocker's mockery,
// 2-4 deg elsewhere.
export const FPS = 30;
export const TOTAL = 1104;
export const D0 = 0; // ground plane of the Virginia field (the parapet crest is ~+1.2)
export const HALF = 27; // half-length of the trench line (embrasures span x -27..27 on the crest falloff)
export const FILES = [-1.65, -0.55, 0.55, 1.65];
export const ROW_GAP = 1.3;
export const COUNT = 74;
export const PARK: V3 = [70, D0, -75]; // base of the fake-CCTV pole (analogy set, shot 4)
export type V3 = [number, number, number];

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

// ---------------- story physics (tau = story time in seconds; story time = film time) ----------------
/** z of the Union front rank: advances from z = 20 and freezes at z = 8 on the word "وقف" (1.62 s) — the whole
 *  film's premise: the army stops there and never advances again. */
export const front = (tau: number) => lin([[0, -14], [1.62, -6.8], [36.8, -6.8]], tau);
export const marchPhase = (tau: number) => { const t = Math.min(tau, 1.62); return ((t % 1) + 1) % 1; }; // 2 steps/s, frozen at the halt
export const SNAP = 29.0, DROP0 = 29.35, DROP1 = 30.1; // the knock (f870), the hero log tips, the hero log hits the ground
/** micro-tremor amplitude: the march bob before the halt, then the gun line's tension shimmer in S3 (peak ~15 s) */
export const amp = (tau: number) =>
  lin([[0, 0.06], [1.62, 0], [11.3, 0], [15.0, 0.08], [19.6, 0.03], [25.9, 0.02], [29.0, 0], [36.8, 0]], tau);
export const stomp = (tau: number) => lin([[0, 1.0], [1.62, 1.0], [2.4, 0], [36.8, 0]], tau); // march weight dies at the halt
export const shapeZ = (z: number) => (Math.abs(z) < HALF ? Math.cos((Math.PI * z) / (2 * HALF)) : 0);
export const dropW = (z: number) => smooth((20 - z) / 26); // 1 on the near half, 0 at the far end
export const dropU = (tau: number) => (tau < DROP0 ? 0 : Math.min(1, ((tau - DROP0) / (DROP1 - DROP0)) ** 2));
export const DROP_H = 1.1; // the hero log falls ~1.1 m off its carriage

export type BridgeState = { bounce: number; drop: number; snap: number; collapsed: boolean };
/** ground / parapet-walk height: D0 plus the tremor, minus the knocked log's fall where dropW weighs in */
export const deckY = (z: number, b: BridgeState) => D0 + b.bounce * shapeZ(z) - b.drop * DROP_H * dropW(z);

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Crowd = "march" | "fall" | "water" | "bank" | "tourists" | "none";
export type ShotDef = { id: number; a: number; b: number; light: Light; crowd: Crowd; tau: (t: number) => number; towns?: boolean };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 150, light: "day", crowd: "march", tau: (t) => t }, // hook: the frozen army wide
  { id: 2, a: 150, b: 303, light: "day", crowd: "none", tau: (t) => t }, // the mocker's quoted line (CU)
  { id: 3, a: 303, b: 465, light: "day", crowd: "none", tau: (t) => t }, // McClellan, the spyglass, "300"
  { id: 4, a: 465, b: 588, light: "day", crowd: "none", tau: (t) => t }, // pivot: fake-CCTV analogy set
  { id: 5, a: 588, b: 713, light: "day", crowd: "none", tau: (t) => t }, // the making montage
  { id: 6, a: 713, b: 778, light: "golden", crowd: "none", tau: (t) => t }, // dusk: placed, and the line slips away
  { id: 7, a: 778, b: 930, light: "day", crowd: "march", tau: (t) => t }, // the discovery: shock, the knock, the roll
  { id: 8, a: 930, b: 1038, light: "golden", crowd: "none", tau: (t) => t }, // the photograph gag (sepia warmth)
  { id: 9, a: 1038, b: TOTAL, light: "day", crowd: "march", tau: (t) => t }, // callback wide, opposite side
];
/** one 8 f dissolve only: the dusk time-passage into shot 6's wide (never over a close-up). All other joins are cuts. */
export const XFADE: Record<number, number> = { 6: 8 };
export const FLASH_AT = 150; // 4-frame cream flash out of the hook, into the mocker's close-up

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** layers to draw at frame f: base shot, plus the next shot fading in during a crossfade */
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

export const bridgeState = (id: number, t: number): BridgeState => {
  const s = SHOTS[id - 1];
  const tau = s.tau(t);
  if (id === 7) return { bounce: 0, drop: dropU(tau), snap: clamp01((tau - SNAP) / 0.7), collapsed: tau >= DROP1 };
  if (id === 8 || id === 9) return { bounce: 0, drop: 0, snap: 1, collapsed: false }; // the hero log is back on its carriage, its secret out
  const bounce = -amp(tau) * Math.cos(4 * Math.PI * marchPhase(tau));
  return { bounce, drop: 0, snap: 0, collapsed: false };
};

// ---------------- camera ----------------
// Grammar (motion.md): every move is a symmetric smootherstep glide of 16-52 f (peak speed = 1.875 x distance / dur);
// a reframe bigger than about half a frame width or 40 % zoom is a hard cut on its key frame. Glides are centred on
// their trigger word. Holds push in (dolly toward the look point, or a fov zoom where the lens is boxed in):
// 0.15-0.35 %/f, ~0.6 %/f for ~30-35 f on the punch words. Rolls of 6-8 deg on the mockery beat, 2-4 deg elsewhere.
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
/** reference camera ease: symmetric smootherstep (attack = release) */
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
/** zoom push (camera stays put, for the spyglass POV and boxed-in lenses): tan(fov/2) shrinks by k */
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
/** a roll-only move on top of an existing framing */
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });

// the hero log-cannon's muzzle centre, and where its muzzle end travels as it is knocked off the carriage
export const ANCHOR: V3 = [14, D0 + 0.35, -3.5];
export const snapEnd = (snap: number): V3 => {
  const u = easeOut(snap);
  return [ANCHOR[0] + 0.4 * u, ANCHOR[1] + 0.5 * u - 1.5 * u * u, ANCHOR[2] + 3.2 * u];
};

// ---- framings (f -> camera); each pushes in from the frame its key starts ----
// shot 1 (hook): high wide behind the army -> flank 3/4 of the front rank -> faces from no-man's land -> along the guns
const S1a = (f: number) => dolly([15, 8.5, 24], [0, 1.2, -9], pushK(f, 0, 0.0025), { fov: 46 });
const S1b = (f: number) => dolly([9.5, 2.2, -0.5], [0, 1.5, -6.6], pushK(f, 52, 0.002), { fov: 40, roll: -0.03 });
const S1c = (f: number) => dolly([-8.6, 1.3, -4.2], [-0.5, 1.5, -6.9], pushK(f, 98, 0.003), { fov: 38, roll: 0.035 });
const S1d = (f: number) => dolly([6.8, 0.8, -13.5], [-8, 1.2, 2.6], pushK(f, 126, 0.0025), { fov: 42 });
// shot 2 (the mocker): CU on the scoffer at the front rank (x 0.55, z 8); Dutch roll through the mockery, punch on "خشبة؟" (f269)
const S2a = (f: number) => dolly([1.5, 1.7, -10.3], [0.55, 1.55, -6.2], pushK(f, 150, 0.003), { fov: 34 });
const S2b = (f: number) => dolly([1.25, 1.65, -9.9], [0.55, 1.56, -6.2], pushK(f, 206, 0.0025), { fov: 33, roll: -0.11 });
const S2cBase = (f: number) => dolly([1.05, 1.62, -9.55], [0.55, 1.56, -6.2], pushK(f, 258, 0.002, 0.006, 30), { fov: 33 });
const S2c = rolled(S2cBase, -0.02); // the roll releases through level as the line lands
// shot 3 (tension): McClellan MS -> over-shoulder CU as the glass rises -> spyglass POV (match cut) -> 0.6 %/f spike on "300" (f414)
const S3a = (f: number) => dolly([7.9, 2.6, -19.8], [11, 1.5, -14.2], pushK(f, 303, 0.0025), { fov: 38 });
const S3b = (f: number) => dolly([10.1, 1.9, -16.9], [11.4, 1.5, -13.9], pushK(f, 358, 0.0025), { fov: 34 });
const S3c = (f: number) => zoom([11.3, 1.62, -12.7], [0, 1.05, 2.6], 21, pushK(f, 394, 0.0018));
const S3d = (f: number) => zoom([11.3, 1.62, -12.7], [0, 1.05, 2.6], 19, pushK(f, 408, 0.002, 0.006, 35));
// shot 4 (pivot, "بص يا سيدي"): the fake-CCTV analogy set at PARK — corner MS -> camera-housing CU -> steep macro -> down on the thief
const S4a = (f: number) => dolly([156.2, 1.9, -3.8], [163, 2.2, 4.2], pushK(f, 465, 0.0025), { fov: 40 });
const S4b = (f: number) => dolly([156.6, 3.9, -2.4], [158.6, 4.3, 0.5], pushK(f, 520, 0.003), { fov: 33 });
const S4c = (f: number) => dolly([157.4, 5.7, -1.4], [158.6, 4.25, 0.5], pushK(f, 548, 0.002), { fov: 30 });
const S4d = (f: number) => dolly([166.2, 5.3, 8.2], [163.5, 0.9, 3.5], pushK(f, 566, 0.002), { fov: 36 });
// shot 5 (the making): yard wide -> sawyers CU (fast whip-glide) -> 90 deg top-down macro of the paint brush -> the painted sign, punch on "المسالمة" (f690)
const S5a = (f: number) => dolly([225.5, 3.4, -2.5], [239, 1.2, 7.5], pushK(f, 588, 0.002), { fov: 44 });
const S5b = (f: number) => dolly([231.2, 1.6, 1.0], [234.3, 1.1, 4.6], pushK(f, 622, 0.003), { fov: 36 });
const S5c = (f: number) => dolly([242, 6.8, 4.7], [242, 1.35, 4.8], pushK(f, 650, 0.0015), { fov: 33 });
const S5d = (f: number) => dolly([236.2, 1.8, 10.2], [240, 2.4, 15.5], pushK(f, 682, 0.002, 0.005, 30), { fov: 38 });
// shot 6 (dusk): last log in its embrasure -> side track on the grey backs slipping away -> crane pull-back as the works empty
const S6a = (f: number) => dolly([2.6, 1.8, -1.6], [0, 1.05, 2.6], pushK(f, 709, 0.002), { fov: 40 });
const S6b = (f: number) => dolly([-19.5, 2.1, 7.2], [-14, 1.2, 11.5], pushK(f, 730, 0.002), { fov: 40, roll: -0.025 });
/** crane pull-back: a curved path (quadratic Bezier up and away from the parapet) so the lens never clips the crest */
const CRANE6: V3[] = [[-2, 9.5, 15], [-11, 8.5, 21], [0, 1.0, 3.5]];
const S6c = (f: number): Shot => {
  const a = S6b(750), s = glide((f - 750) / 28), r = 1 - s, [C, B, L] = CRANE6;
  return { pos: [0, 1, 2].map((i) => r * r * a.pos[i] + 2 * s * r * C[i] + s * s * B[i]) as V3,
    look: [0, 1, 2].map((i) => a.look[i] + (L[i] - a.look[i]) * s) as V3, fov: (a.fov ?? 40) + (46 - (a.fov ?? 40)) * s, roll: 0 };
};
// shot 7 (the discovery): inside the empty works -> shock faces (key 2 f before "اتصدموا", f841) -> the knock CU (spike at f870) -> low angle as the log rolls
const S7a = (f: number) => dolly([19.6, 2.6, -10.8], [13, 1.0, -3.8], pushK(f, 778, 0.0022), { fov: 44 });
const S7b = (f: number) => dolly([15.9, 1.7, -7.7], [13.3, 1.5, -4.5], pushK(f, 836, 0.0028), { fov: 36 });
const S7c = (f: number) => dolly([10.4, 1.5, -8.6], [13.9, 0.8, -3.9], pushK(f, 860, 0.002, 0.006, 30), { fov: 33 });
const S7d = (f: number) => dolly([10.6, 0.7, -8.4], [13.4, 0.4, -4.7], pushK(f, 892, 0.002), { fov: 38, roll: 0.05 });
// shot 8 (the photograph): framed like Barnard's still — near-static at the 0.15 %/f creep floor, one small reframe for the tap
const S8a = (f: number) => dolly([17.9, 1.6, -8.8], [13.8, 0.6, -3.4], pushK(f, 930, 0.0015), { fov: 36 });
const S8b = (f: number) => dolly([17.0, 1.5, -8.1], ANCHOR, pushK(f, 984, 0.0015), { fov: 35, roll: 0.012 });
// shot 9 (callback): S1's wide mirrored — from behind the trench looking back at the army -> closer -> laughing faces by a log, still creeping at the last frame
const S9a = (f: number) => dolly([-13.5, 7.5, -31], [0, 1.3, -8], pushK(f, 1038, 0.0022), { fov: 46 });
const S9b = (f: number) => dolly([-5.5, 2.8, -23.5], [-0.5, 1.4, -7], pushK(f, 1066, 0.0025), { fov: 42 });
const S9c = (f: number) => dolly([1.9, 1.7, -11.6], [0.4, 1.5, -6.6], pushK(f, 1090, 0.003), { fov: 38 });

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: S1a },
    { f: 52, dur: 30, s: S1b }, // centred on 67 ("مرعوب"): descend to the flank of the frozen front rank
    { f: 98, dur: 26, s: S1c }, // centred on 111: faces from no-man's land
    { f: 126, dur: 18, s: S1d }, // low along the gun line toward the army it is fooling
  ],
  2: [
    { f: 150, s: S2a }, // flash cut to the mocker (the shot change lands on "يعني", f169)
    { f: 206, dur: 20, s: S2b }, // roll to -6.3 deg through the mockery
    { f: 258, dur: 16, s: S2c }, // punch push on "خشبة؟" (f269), roll releasing
  ],
  3: [
    { f: 303, s: S3a }, // cut on "الواقع" (f304)
    { f: 358, dur: 24, s: S3b }, // over-shoulder as the spyglass rises ("فاكر قدامه")
    { f: 394, cut: true, s: S3c }, // match cut into the glass: POV of the gun line
    { f: 408, dur: 10, s: S3d }, // the "300" spike (word at f414)
  ],
  4: [
    { f: 465, s: S4a }, // cut on "بص" (f466): the pivot lands on its own analogy set
    { f: 520, dur: 22, s: S4b }, // housing CU, centred on "الفيك" (f536-550 glide tail)
    { f: 548, dur: 20, s: S4c }, // steep macro down the pole at the fake lens
    { f: 566, dur: 16, s: S4d }, // down on the thief stepping back ("الحرمية" lands f561-573)
  ],
  5: [
    { f: 588, s: S5a }, // cut on "جابوا" (f589)
    { f: 622, dur: 16, s: S5b }, // fast whip-glide to the sawyers (montage energy)
    { f: 650, cut: true, s: S5c }, // cut to the 90 deg top-down paint macro ("سود", f631-643 tail)
    { f: 682, dur: 16, s: S5d }, // the painted sign; punch on "المسالمة" (f690-715)
  ],
  6: [
    { f: 709, s: S6a }, // starts inside the 8 f dusk dissolve from S5
    { f: 730, dur: 18, s: S6b }, // side track: grey backs slipping into the tree line
    { f: 750, cut: true, s: S6c }, // crane pull-back on its curved path, fastest ~f764
  ],
  7: [
    { f: 778, s: S7a }, // cut on "ولما" (f779)
    { f: 836, dur: 20, s: S7b }, // shock faces: the key lands 2 f before "اتصدموا" (f841)
    { f: 860, cut: true, s: S7c }, // cut to the hero log; spike + kick on the knock (f870)
    { f: 892, dur: 20, s: S7d }, // low angle: the log tips and rolls ("مدهنة سود", f907-931)
  ],
  8: [
    { f: 930, s: S8a }, // cut on "وفي صورة" (f931): the photograph framing
    { f: 984, dur: 18, s: S8b }, // the living tap ("وبيضرب المدفع ده بعصايا", f987-1027): kicks at 33.42 s / 33.95 s
  ],
  9: [
    { f: 1038, s: S9a }, // cut on "هي دي الخدع" (f1038): S1 mirrored from the trench side
    { f: 1066, dur: 22, s: S9b },
    { f: 1090, dur: 14, s: S9c }, // still creeping on the closing line — no frozen tail
  ],
};

// impact kicks (reference v14): the image offset flips sign every frame (~3 px at 720p per unit), decays to 0 in
// 7 f, roll +-0.23 deg per unit; they start on the first frame at/after the event. No hand-held float.
const KICKS: [number, number][] = [[29.0, 0.55], [29.35, 0.8], [30.1, 1.0], [33.42, 0.35], [33.95, 0.35]];
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
 *  Reference: DOF on in ~1/3 of shots; CU 12-16 px, MS 10-12 px, inserts 15-16 px; establishing/wide shots stay
 *  sharp. Entries switch on cuts (no dur) or ramp with the camera glide they share f/dur with. focus = world point
 *  (else the camera look point). */
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const frontEyes = (f: number): V3 => [0, D0 + 1.55, front(T(f))];
export const DOF: Dof[] = [
  { f: 0, cInf: 0 }, // S1 high wide: establishing, sharp
  { f: 52, dur: 30, cInf: 10, focus: frontEyes }, // flank MS of the front rank
  { f: 98, dur: 26, cInf: 13, focus: () => [-0.5, D0 + 1.5, -6.9] }, // faces from no-man's land
  { f: 126, dur: 18, cInf: 0 }, // along the guns: deep line, sharp
  { f: 150, cInf: 15, focus: () => [0.55, D0 + 1.56, -6.2] }, // the mocker CU
  { f: 206, dur: 20, cInf: 16, focus: () => [0.55, D0 + 1.56, -6.2] }, // tighter, rolled
  { f: 303, cInf: 10, focus: () => [11, D0 + 1.5, -14.2] }, // McClellan MS
  { f: 358, dur: 24, cInf: 14, focus: () => [11, D0 + 1.5, -14.2] }, // over-shoulder CU
  { f: 394, cInf: 5 }, // spyglass POV: mild, focus = look (the gun line)
  { f: 465, cInf: 12, focus: () => [158.6, D0 + 4.3, 0.5] }, // analogy set: the fake camera
  { f: 520, dur: 22, cInf: 15, focus: () => [158.6, D0 + 4.3, 0.5] }, // housing CU
  { f: 548, dur: 20, cInf: 15, focus: () => [158.6, D0 + 4.3, 0.5] }, // steep macro of the fake lens
  { f: 566, dur: 16, cInf: 10, focus: () => [163.5, D0 + 0.9, 3.5] }, // the thief below
  { f: 588, cInf: 0 }, // making yard wide: sharp
  { f: 622, dur: 16, cInf: 12, focus: () => [234.3, D0 + 1.1, 4.6] }, // sawyers CU
  { f: 650, cInf: 15, focus: () => [242, D0 + 1.35, 4.8] }, // top-down paint macro
  { f: 682, dur: 16, cInf: 10, focus: () => [240, D0 + 2.4, 15.5] }, // the painted sign
  { f: 709, cInf: 8, focus: () => ANCHOR }, // dusk: last log in its embrasure
  { f: 730, dur: 18, cInf: 0 }, // the slip-away track and crane: sharp
  { f: 778, cInf: 0 }, // discovery wide: sharp
  { f: 836, dur: 20, cInf: 13, focus: () => [13.3, D0 + 1.5, -4.5] }, // shock faces
  { f: 860, dur: 15, cInf: 14, focus: () => ANCHOR }, // the knock CU: focus = the hero log
  { f: 892, dur: 20, cInf: 10, focus: () => [13.4, D0 + 0.4, -4.7] }, // the rolling log, low
  { f: 930, cInf: 6, focus: () => ANCHOR }, // the photograph: gentle, like a period lens
  { f: 1038, cInf: 0 }, // callback wide + closer + faces: kept sharp to the last frame
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};
export const Dof = dofAt;

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  { a: 98, b: 150, kit: "plant_bushDetailed", pos: [-6.2, D0, -3.2], s: 1.15, yaw: 0.5 },
  { a: 465, b: 548, kit: "plant_bush", pos: [159.5, D0, 0.2], s: 1.0, yaw: 0.3 },
  { a: 588, b: 650, kit: "cart", pos: [230.5, D0, -0.5], s: 0.9, yaw: 0.7 },
  { a: 778, b: 836, kit: "hedge", pos: [17.5, D0, -8.6], s: 0.8, yaw: 0.2 },
  { a: 1038, b: 1104, kit: "plant_bushDetailed", pos: [-9.8, D0, -24.8], s: 1.2, yaw: 0.9 },
];
export const Fg = FOREGROUND;
