// Storm-test cast — Character & Acting pass.
// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so identical drawings share canvases. Characters are yaw-only
// billboards shaded by cardShade() (scene tint, bright floor, side gradient toward the moon, painted crescent in the
// drawing); standing ones get a soft multiply contact blob + a moon tail + a warm lantern pool where they stand in
// lantern light. Effects are unlit cards. Cards, effects and blobs live on the NOINK layer so the world ink pass
// never outlines their quads.
//
// TIMING BASIS (EXACT, from storm_test/words.json — real word times, not estimates): 78 words, 6 shots, 23.28 s
// at 3.35 wps, 30 fps, 700 frames. Shot starts (s): 1:0.00, 2:2.39, 3:7.76, 4:10.75, 5:15.52, 6:20.30.
// Word frames below are round(start_s * 30) from words.json — re-time only if the voice file changes.
// EVERY expression changes in exactly 1 frame, 1 frame BEFORE its word; every body-pose change lands ON its word
// frame with snap-and-settle physics (65% in the first 5 frames, settled by 15). Mouths cycle every 2 frames while
// a character is speaking (sailor S3, cook S5); nobody blinks while speaking.
//
// STAGING (world metres, merged 2026-11-12: anchors = story.ts — the wheel is aft at z +10, the rail is the
// starboard side at x +4, z +2; the camera pass frames these anchors — world/cam passes conform to WHEEL_PT / RAIL_PT from story.ts,
// do not move the characters): S1 has no people (wide ship at sea). S2 captain at the wheel + cook with the can.
// S3 laughing sailor close in front, calm captain behind. S4 cook alone at the rail, pouring (side view).
// S5 cook at the rail, pouring a thin thread of oil into a wooden bowl on a crate (bowl [3.8, 0.9, 1.4],
// crate [3.8, 0, 1.4] — World builds them, Cam frames them; this pass only poses his hands toward them)
// while he explains, calm face for the analogy close-up. S6 captain at the wheel, nodding on "sailed".
//
// CAST (silhouette/colour read at a glance, sound off): THE CAPTAIN — blue bicorne + red cockade + blue coat +
// gold epaulettes + moustache, stern then calm, never raises his voice; THE COOK (hero) — tall white toque +
// white uniform + apron, determined pouring, explaining, proud; THE SAILOR — orange striped shirt + blue
// polka-dot bandana, the only laughing face, then doubtful, then quiet when the captain says nothing. The laugh/silence contrast is the whole S3 beat
// and must read with the sound off.
//
// INTERFACE (kept from Abu Simbel so world.ts typechecks): Pool, Actor, Fx, stage(id, t, b, cam), snapFx,
// splashFx, creakFx, SIGN_AT, SU, SU_SWING, Place, FxPlace, CamInfo, Stage, FPS re-export. stage() takes its
// state as `unknown` and ignores it on purpose. This file imports only FPS from story.ts — the storm story.ts
// (Cam pass) owns shots/cameras, and this file must not break when its anchors change.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, CAPTAIN, COOK, SAILOR,
  fxContact, fxShadow, fxWarmPool, fxBurst, fxSplash, fxCreak,
  Outfit, Expr, FrontOpts, SideOpts, MouthK,
} from "./toon";
import { FPS, WHEEL_PT, COOK_PT, SAILOR_PT, RAIL_PT, CAPTAIN_S3_PT } from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";
import { cardMaterial, cardDepthMaterial, fxHardMaterial, fxSoftMaterial } from "../common/cardMaterial";

// ---------------- shared types & helpers ----------------
export type V3 = [number, number, number];
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
export const SU_SWING = 2.3 / 1830; // swing canvas: rope of 1830 units = 2.3 m (retained for interface compat)
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's moon when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(cardMaterial(blank));
    this.dmat = cardDepthMaterial(blank);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist, lantern pools) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = fxHardMaterial(blank);
    this.soft = fxSoftMaterial(blank);
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** moon = world direction TOWARD the moon (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
/** head-shape seed: 7 shapes, so identical outfits still share canvases where the drawing matches */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// Staging anchors live in story.ts (single source) — imported above. Character spots below use them.

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize(); // the moon direction once findSun() runs (world's shadow light)
const tmp = new THREE.Vector3();
type StormLight = "night" | "golden"; // S1–S5 night storm, S6 calm golden sea
let LNAME: StormLight = "night";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the moon of the world that is calling: the attached root whose shadow light's target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the moon comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks, speech mouths and reaction timing ----------------
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap). Nobody blinks while speaking. */
const LID = [0.5, 1, 1, 0.5];
const lidAt = (f: number, i: number, swaps: number[] = [], speaking = false) => {
  if (speaking) return 0;
  for (const sf of swaps) { const k = f - (sf - 1); if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's moon */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing card, multiply, blue-violet at night: a TIGHT contact pool right under the feet
 *  (~.5 on screen at the core) so nobody floats, plus a softer tail stretched AWAY from the moon, length
 *  ~1.6 m / tan(moon elevation), capped (night moon high: cap 1.6 m; golden low sun: cap 2.4 m).
 *  In lantern light (S2, S4) a warm pool is laid under the character as well — see pool(). */
const CONTACT: Record<StormLight, [number, number, number]> = {
  night: [0.16, 0.17, 0.3], golden: [0.24, 0.2, 0.33],
};
const TAIL: Record<StormLight, [number, number, number]> = {
  night: [0.38, 0.4, 0.6], golden: [0.42, 0.44, 0.62],
};
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
  const cap = LNAME === "night" ? 1.6 : 2.4;
  const len = Math.min(cap, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
  const tc = hexOf(TAIL[LNAME], k);
  out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
    w: 0.72 * sc, h, flat: true, rot });
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};
/** warm lantern pool under a character standing in lantern light (soft amber glow, drawn over the deck) */
const pool = (out: Stage, x: number, y: number, z: number, sc = 1) => {
  out.fx.push({ key: "pool|warm", cw: 256, ch: 256, draw: (p) => fxWarmPool(p), x, y: y + 0.015, z,
    w: 2.2 * sc, h: 1.6 * sc, flat: true, soft: true });
};

// ---------------- storm timing (words.json, exact) ----------------
export const STORM_TOTAL = 700;
export type StormShot = { id: number; a: number; b: number; light: StormLight; words: number };
export const STORM_SHOTS: StormShot[] = [
  { id: 1, a: 0, b: 72, light: "night", words: 8 },
  { id: 2, a: 72, b: 233, light: "night", words: 18 },
  { id: 3, a: 233, b: 322, light: "night", words: 10 },
  { id: 4, a: 322, b: 466, light: "night", words: 16 },
  { id: 5, a: 466, b: 609, light: "night", words: 16 },
  { id: 6, a: 609, b: 700, light: "golden", words: 10 },
];
/** word-start frames per shot, round(start_s * 30) from words.json (kept beside the steps that use them) */
export const WORD_FRAMES: number[][] = [
  [0, 9, 18, 27, 36, 45, 54, 63], // S1: The sea was trying to eat the ship.
  [72, 81, 90, 99, 107, 116, 125, 134, 143, 152, 161, 170, 179, 188, 197, 206, 215, 224], // S2
  [233, 242, 251, 260, 269, 278, 287, 296, 304, 313], // S3: One sailor laughed. 'Oil? Against THAT?' The captain said nothing.
  [322, 331, 340, 349, 358, 367, 376, 385, 394, 403, 412, 421, 430, 439, 448, 457], // S4
  [466, 475, 484, 493, 501, 510, 522, 528, 537, 546, 555, 564, 573, 582, 591, 600], // S5
  [609, 618, 627, 636, 645, 654, 663, 672, 681, 690], // S6: So the sea went quiet, and the ship sailed on.
];
/** frame of each shot's first word = its cut frame */
export const CUT_FRAMES: number[] = STORM_SHOTS.map((s) => s.a);
/** word frame helper: wf(shotId, wordIndex) — e.g. wf(3, 2) = 251 ("laughed.") */
export const wf = (shot: number, idx: number) => WORD_FRAMES[shot - 1][idx];

// ---------------- expression & pose steps ----------------
/** an expression step: the face changes in exactly 1 frame, on f = (its word's frame) - 1 */
type Step = { f: number; expr: Expr };
const exprAt = (steps: Step[], f: number): Expr => {
  let e = steps[0].expr;
  for (const s of steps) if (f >= s.f) e = s.expr;
  return e;
};
/** swap frames of a character's expression changes, for the swap-blink in lidAt */
const swapFrames = (steps: Step[]): number[] => steps.slice(1).map((s) => s.f);
/** snap-and-settle: fraction of a pose change complete n frames after its change frame — 65% in the first 5
 *  frames, then a slow settle to 100% by frame 15. No floaty easing, and a stopped character goes dead still. */
const settle = (n: number): number => (n <= 0 ? 0 : n < 5 ? (0.65 * n) / 5 : 0.65 + 0.35 * smooth((n - 5) / 10));
/** pose value at frame f from [change frame, value] pairs; each change lands ON its frame (1 f after the face) */
const poseAt = (changes: [number, number][], f: number): number => {
  let v = changes[0][1];
  for (let i = 1; i < changes.length; i++) {
    const [cf, tv] = changes[i], n = f - cf;
    if (n < 0) break;
    v = v + (tv - v) * settle(n);
  }
  return v;
};

// ---------------- speech mouths ----------------
/** who is actually speaking, frame spans (the narrator carries the rest): the sailor's mock question (S3) and
 *  the cook explaining (S5). While speaking, the mouth cycles every 2 frames and the character never blinks. */
const SPEAK: { who: "sailor" | "cook"; a: number; b: number }[] = [
  { who: "sailor", a: 260, b: 287 }, // "'Oil? Against THAT?'" — f260 ('Oil?) to f287 ("The")
  { who: "cook", a: 466, b: 537 }, // "You see, the oil lays the water flat." — f466 to f537 ("The" of the next line)
];
const MOUTHS: MouthK[] = ["o", "smile", "grin", "smile", "dash", "smile"];
const speaking = (who: "sailor" | "cook", f: number) => SPEAK.some((s) => s.who === who && f >= s.a && f < s.b);
const mouthAt = (who: "sailor" | "cook", f: number): MouthK | undefined => {
  const s = SPEAK.find((x) => x.who === who && f >= x.a && f < x.b);
  return s ? MOUTHS[Math.floor((f - s.a) / 2) % MOUTHS.length] : undefined;
};

// ---------------- the shots ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };

/** shot 2 — deck medium, lantern light. The captain holds the wheel, stern, all shot; the cook holds the can,
 *  neutral until the can is named, then determined. Words: w1 captain (f81) · w12 cook (f179). */
const CAP_S2: Step[] = [{ f: 72, expr: "stern" }];
const COOK_S2: Step[] = [
  { f: 72, expr: "neutral" },
  { f: 178, expr: "determined" }, // 1 f before "cook": he already knows what the can is for
];
const shot2 = (cam: CamInfo, f: number, out: Stage) => {
  out.places.push(person(cam, { i: 1, o: CAPTAIN, okey: "captain" }, WHEEL_PT[0], 0, WHEEL_PT[2], { side: false, mirror: false },
    { mode: "stand", expr: exprAt(CAP_S2, f), prop: "wheel", blink: lidAt(f, 1, swapFrames(CAP_S2)) }, {}));
  blob(out, WHEEL_PT[0], 0, WHEEL_PT[2]); pool(out, WHEEL_PT[0], 0, WHEEL_PT[2]);
  out.places.push(person(cam, { i: 2, o: COOK, okey: "cook" }, COOK_PT[0], 0, COOK_PT[2], { side: false, mirror: false },
    { mode: "stand", expr: exprAt(COOK_S2, f), prop: "oilcan", blink: lidAt(f, 2, swapFrames(COOK_S2)), facing: -1 }, {}));
  blob(out, COOK_PT[0], 0, COOK_PT[2]); pool(out, COOK_PT[0], 0, COOK_PT[2]);
};

/** shot 3 — close-up, the mocker. The sailor laughs on "laughed.", keeps grinning through the mock question,
 *  doubts on "THAT?'", and goes quiet when the captain is named. The captain stays stern, then calm on "said".
 *  Words: w2 laughed. (f251) · w3 'Oil? (f260) · w4 Against (f269) · w5 THAT?' (f278) · w7 captain (f296) · w8 said (f304). */
const SAILOR_S3: Step[] = [
  { f: 233, expr: "neutral" },
  { f: 250, expr: "laugh" }, // 1 f before "laughed.": open mouth, squeezed eyes, head cocked back
  { f: 268, expr: "grin" }, // 1 f before "Against": the laugh narrows into the mock
  { f: 277, expr: "doubtful" }, // 1 f before "THAT?'": the doubt creeps in mid-question
  { f: 295, expr: "quiet" }, // 1 f before "captain": the silence quiets him
];
const SAILOR_S3_HEAD: [number, number][] = [[233, 0], [251, 7], [269, 3], [296, 0]];
const SAILOR_S3_TILT: [number, number][] = [[233, 0], [251, 2], [296, 0]];
const CAP_S3: Step[] = [
  { f: 233, expr: "stern" },
  { f: 303, expr: "calm" }, // 1 f before "said": he says nothing, calmly — the whole answer
];
const shot3 = (cam: CamInfo, f: number, out: Stage) => {
  const spk = speaking("sailor", f);
  out.places.push(person(cam, { i: 3, o: SAILOR, okey: "sailor" }, SAILOR_PT[0], 0, SAILOR_PT[2], { side: false, mirror: false },
    { mode: "stand", expr: exprAt(SAILOR_S3, f), mouth: mouthAt("sailor", f), blink: lidAt(f, 3, swapFrames(SAILOR_S3), spk),
      headTilt: poseAt(SAILOR_S3_HEAD, f), tilt: poseAt(SAILOR_S3_TILT, f) }, {}, 1.3));
  blob(out, SAILOR_PT[0], 0, SAILOR_PT[2], 1.3);
  out.places.push(person(cam, { i: 1, o: CAPTAIN, okey: "captain" }, CAPTAIN_S3_PT[0], 0, CAPTAIN_S3_PT[2], { side: false, mirror: false },
    { mode: "stand", expr: exprAt(CAP_S3, f), blink: lidAt(f, 1, swapFrames(CAP_S3)), facing: 1 }, {}));
  blob(out, CAPTAIN_S3_PT[0], 0, CAPTAIN_S3_PT[2]);
};

/** shot 4 — the pour, side view at the rail. The cook is determined from the shot open; the pour lands ON
 *  "poured" (f349, snap-and-settle tilt + gold stream); he is proud on "gold" (f421) as the oil shines.
 *  Words: w3 poured (f349) · w11 gold (f421). */
const COOK_S4: Step[] = [
  { f: 322, expr: "determined" }, // set to pour before the shot even opens on him
  { f: 420, expr: "proud" }, // 1 f before "gold": it shines, and he knows it
];
const COOK_S4_TILT: [number, number][] = [[322, 0], [349, 2]]; // leans over the rail as he pours
const pourK = (f: number) => q(poseAt([[348, 0], [349, 1]], f), 30); // 0 upright .. 1 full tilt, from the "poured" frame
const shot4 = (cam: CamInfo, f: number, out: Stage) => {
  const view = viewOf(cam, RAIL_PT[0], RAIL_PT[2], 1, 0);
  out.places.push(person(cam, { i: 2, o: COOK, okey: "cook" }, RAIL_PT[0], 0, RAIL_PT[2], view,
    { mode: "stand", expr: exprAt(COOK_S4, f), blink: lidAt(f, 2, swapFrames(COOK_S4)), tilt: poseAt(COOK_S4_TILT, f) },
    { mode: "stand", expr: exprAt(COOK_S4, f), prop: ["pour", pourK(f)], blink: lidAt(f, 2, swapFrames(COOK_S4)) }));
  blob(out, RAIL_PT[0], 0, RAIL_PT[2]); pool(out, RAIL_PT[0], 0, RAIL_PT[2]);
};

/** shot 5 — the explanation (v3: the bowl analogy). The cook at the rail pours a thin thread of oil from the
 *  can into the wooden bowl on its crate (bowl centre [3.8, 0.9, 1.4] — his hands reach down toward it) while
 *  he explains: CALM EXPLAINING face from "You see" (the analogy close-up, still f469), proud as the wave
 *  sinks on "wave". The pour tips ON "You" (f466, snap-and-settle to full tilt by f481), holds through "wave"
 *  (f546), and the can lowers again by "like" (f573) as the analogy lands. S2/S4 rail poses are untouched.
 *  Words: w0 You (f466) · w9 wave (f546) · w12 like (f573).
 *  v4 (defect 1a): the cook is hidden ENTIRELY during the S5b top-down macro (f510–537) — see
 *  COOK_HIDDEN_S5B below. The macro contract is bowl + spreading gold ONLY, no characters. */
const COOK_S5: Step[] = [
  { f: 466, expr: "calmExplain" }, // on the shot open: "You see" is his line, face calm for the close-up
  { f: 545, expr: "proud" }, // 1 f before "wave": the wave is sinking, as he said it would
];
/** pour tilt 0 upright .. 1 full tip, thin thread running; each change lands ON its frame (1 f after the face).
 *  v5 TIMING FIX (2026-11-12, coordinator): this table was [[466,0],[481,1],...] in v3/v4 — but poseAt()
 *  only STARTS a change at its frame (settle(n)=0 at n=0, 100% by n=15), so that table held k=0 through
 *  f481 and the thread NEVER rendered in any version (f469 and f481 stills identical, can ~8 deg, no
 *  thread — verified by pixel scan). The char/cam agents' v5 projections assumed k=0.39 at f469; with
 *  the table as written k was 0. The ramp entry must sit AT f466 for the tip to run f466-481: k=0.39 at
 *  f469 (settle(3)=0.39), k=1 at f481, holds through "wave" f546, lowers by "like" f573. */
const COOK_S5_POUR: [number, number][] = [[466, 0], [466, 1], [555, 1], [573, 0]];
/** v5: same fix — the lean must accompany the pour (was [[466,0],[481,3],...], lean 0 until f481). */
const COOK_S5_TILT: [number, number][] = [[466, 0], [466, 3], [555, 3], [573, 0]]; // leans over the bowl while pouring
const pourBowlK = (f: number) => q(poseAt(COOK_S5_POUR, f), 30);
/** S5b top-down macro frame gate (v4 fix, defect 1a): the cook MUST NOT render for f in [510, 537) —
 *  the macro contract is bowl + spreading gold ONLY, no characters. Staged at the rail [4, 0, 2] his
 *  face projects to (+0.31,−0.51) and his toque to (+0.39,−0.61) inside the macro frame (story.ts S5b
 *  contract), and the red card-drawn can in his hands (toon.ts pourBowl) intrudes at the left edge too.
 *  The gate is a hard 1-frame cut, never a fade (target 9 / ghost ban): visible at f509, gone at f510,
 *  back at f537 — S5c starts at f537 and the cook is fully in frame there (v3 still f537, verified).
 *  Exported so the merge/post side can assert the same window; nothing outside cast.ts needs to change:
 *  world.ts hides every actor/fx not returned by stage() each frame, so an empty Stage here renders nothing. */
export const COOK_HIDDEN_S5B: [number, number] = [510, 537];
const shot5 = (cam: CamInfo, f: number, out: Stage) => {
  // S5b macro gate (defect 1a): no cook AT ALL for f in [510, 537) — no card, no contact blob, no warm
  // pool (all three are emitted below, so the early return kills them together). The bowl + film are
  // world-built and unaffected; the cook returns exactly at f537 for S5c.
  if (f >= COOK_HIDDEN_S5B[0] && f < COOK_HIDDEN_S5B[1]) return;
  const spk = speaking("cook", f);
  out.places.push(person(cam, { i: 2, o: COOK, okey: "cook" }, RAIL_PT[0], 0, RAIL_PT[2], { side: false, mirror: false },
    { mode: "stand", expr: exprAt(COOK_S5, f), prop: ["pourBowl", pourBowlK(f)], mouth: mouthAt("cook", f),
      blink: lidAt(f, 2, swapFrames(COOK_S5), spk), tilt: poseAt(COOK_S5_TILT, f), facing: 0 }, {}));
  blob(out, RAIL_PT[0], 0, RAIL_PT[2]); pool(out, RAIL_PT[0], 0, RAIL_PT[2]);
};

/** shot 6 — payoff wide, calm golden sea. The captain at the wheel, calm; he nods ON "sailed" (f681) — one dip
 *  of the head, settled by f693 — and the ship sails on. Words: w8 sailed (f681). */
const CAP_S6: Step[] = [{ f: 609, expr: "calm" }];
const CAP_S6_HEAD: [number, number][] = [[609, 0], [681, 5], [687, -2], [693, 0]]; // the nod: dip one way, settle back
const CAP_S6_TILT: [number, number][] = [[609, 0], [682, 2], [692, 0]];
const shot6 = (cam: CamInfo, f: number, out: Stage) => {
  out.places.push(person(cam, { i: 1, o: CAPTAIN, okey: "captain" }, WHEEL_PT[0], 0, WHEEL_PT[2], { side: false, mirror: false },
    { mode: "stand", expr: exprAt(CAP_S6, f), prop: "wheel", blink: lidAt(f, 1, swapFrames(CAP_S6)),
      headTilt: poseAt(CAP_S6_HEAD, f), tilt: poseAt(CAP_S6_TILT, f) }, {}));
  blob(out, WHEEL_PT[0], 0, WHEEL_PT[2]);
};

/** everything with a face in shot `id` at time t. Shot 1 has no people by the script. */
export const stage = (id: number, t: number, _b: unknown, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const sh = STORM_SHOTS[id - 1];
  if (!sh) return out;
  LNAME = sh.light;
  findSun(cam, SUN);
  const f = Math.round(t * FPS);
  if (id === 2) shot2(cam, f, out);
  else if (id === 3) shot3(cam, f, out);
  else if (id === 4) shot4(cam, f, out);
  else if (id === 5) shot5(cam, f, out);
  else if (id === 6) shot6(cam, f, out);
  return out;
};

// ---------------- one-off effects (bridge signatures, retained for interface compatibility) ----------------
export const snapFx = (tau: number, at: V3, out: Stage) => {
  if (tau >= 0 && tau < 0.45) {
    const u = tau / 0.45;
    out.fx.push({ key: `bigburst${q(u, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 30)), x: at[0], y: at[1] + 0.12, z: at[2] - 0.15, w: 1.5, h: 1.5 });
  }
};
export const splashFx = (tau: number, out: Stage) => {
  const u = tau / 1.1;
  if (u < 0 || u >= 1) return;
  for (const [x, z, s] of [[-2.9, -24, 1], [2.9, -21, 0.9], [0, -27.5, 1.2]] as const)
    out.fx.push({ key: `splash${q(u, 30)}`, cw: 800, ch: 800, draw: (p) => fxSplash(p, q(u, 30)), x, y: 2.6 * s, z, w: 7 * s, h: 7 * s }); // base of the drawing on the water line
};
export const creakFx = (t: number, pts: V3[], out: Stage, size = 0.8) =>
  pts.forEach(([x, y, z], i) => {
    const u = q((t * 1.3 + i * 0.37) % 1, 30);
    out.fx.push({ key: `creak${u}`, cw: 300, ch: 300, draw: (p) => fxCreak(p, u), x, y, z, w: size, h: size, rot: i * 0.6 - 0.6 });
  });
/** retained for interface compatibility (the bridge world puts a sign here); the storm test has no sign — unused. */
export const SIGN_AT: V3 = [320, 0, -2];
export { FPS };
