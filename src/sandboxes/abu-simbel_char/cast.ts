// OWNER: abu-simbel_char agent branch — do NOT merge into src/videos/abu-simbel/ without audit. Merged truth lives in the main video.
// Abu Simbel cast — Character & Acting pass (Agent 2).
// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so identical workers share canvases. Characters are yaw-only
// billboards shaded by cardShade() (scene tint, bright floor, side gradient toward the sun, painted crescent in the
// drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
//
// TIMING BASIS (estimated, no voice file yet): 187 words, 12 shots, 55.8 s at 3.35 wps, 30 fps, 1674 frames.
// Shot starts (s): 1:0.00, 2:2.99, 3:7.16, 4:11.34, 5:19.40, 6:25.37, 7:31.34, 8:37.01, 9:45.07, 10:47.46,
// 11:49.55, 12:51.34. Word-level timing inside a shot divides the shot evenly by its word count
// (wordFrame() below). EVERY expression changes in exactly 1 frame, 1 frame BEFORE its word; every body-pose
// change lands ON its word frame with snap-and-settle physics (65% in the first 5 frames, settled by 15).
// All expression/pose frames below are computed from wordFrame(), not hand-counted — re-time them from words.json
// once the voice-over exists.
//
// PLACEMENT CONTRACT for the merge (world + camera passes): shot s is staged at x = (s-1)*40 on the acting line
// z = 0, standing ground y = 0. Characters appear only in shots 4, 5, 6, 7, 8, 9, 11 (shots 1-3, 10, 12 are
// empty of people by the script). The world pass must put walkable ground at y = 0 at the character spots,
// including the shot-9 terrace; the "65 m higher" of shot 8 is world geometry/backdrop, not character height.
// The camera pass frames x = STAGE_X(id) for the character shots.
//
// CAST (silhouette/colour read at a glance, sound off): THE MOCKER — stout, red jacket, flat cap, big moustache,
// the only laughing face; THE ENGINEERS — khaki + pith helmets, measuring rod / saw / hammer, calm throughout;
// THE WORKERS — 6 coats x 4 skins x 4 hats, terrace shot 9. The mocker laughs at shots 4 and 6 and stands
// SILENT (awe: wide eyes, small open mouth, head tipped back) looking up at shot 11 — the laugh/silence contrast
// is the whole payoff and must read with the sound off.
//
// INTERFACE (kept from the bridge so world.ts typechecks): Pool, Actor, Fx, stage(id, t, b, cam), snapFx,
// splashFx, creakFx, SIGN_AT, SU, SU_SWING, Place, FxPlace, CamInfo, Stage, FPS re-export. stage() takes its
// state as `unknown` and ignores it on purpose: the bridge's BridgeState (deck bounce/drop) does not exist for
// Abu Simbel, so this file must not import any story.ts name except FPS — Agent 3's story rewrite cannot break it.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, MOCKER, ENGINEER, MOVER, worker,
  fxPuff, fxCreak, fxContact, fxShadow, fxBurst, fxSplash,
  Outfit, Expr, FrontOpts, SideOpts,
} from "./toon";
import { FPS } from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

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
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
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
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
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
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
/** head-shape seed: 7 shapes, so identical outfits still share canvases where the drawing matches */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
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
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
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

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
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
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
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

/** ground shadow under a standing card, multiply, blue-violet: a TIGHT contact pool right under the feet (~.5 on
 *  screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail stretched
 *  AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- Abu Simbel timing ----------------
export type AbuLight = "day" | "golden";
export const ABU_TOTAL = 1674;
export const ABU_SHOTS: { id: number; a: number; b: number; light: AbuLight; words: number }[] = [
  { id: 1, a: 0, b: 90, light: "golden", words: 10 }, // dawn light over the desert plain
  { id: 2, a: 90, b: 215, light: "day", words: 14 },
  { id: 3, a: 215, b: 340, light: "day", words: 14 },
  { id: 4, a: 340, b: 582, light: "day", words: 27 },
  { id: 5, a: 582, b: 761, light: "day", words: 20 },
  { id: 6, a: 761, b: 940, light: "day", words: 20 },
  { id: 7, a: 940, b: 1110, light: "day", words: 19 },
  { id: 8, a: 1110, b: 1352, light: "day", words: 27 },
  { id: 9, a: 1352, b: 1424, light: "day", words: 8 },
  { id: 10, a: 1424, b: 1487, light: "day", words: 7 },
  { id: 11, a: 1487, b: 1540, light: "day", words: 6 },
  { id: 12, a: 1540, b: 1674, light: "day", words: 15 },
];
/** shot s is staged at x = (s-1)*40 on the acting line z = 0, standing ground y = 0 (see the placement contract above) */
export const STAGE_X = (id: number) => (id - 1) * 40;
export const STAGE_LINE_Z = 0;
/** frame of the w-th word (0-based) of shot id: the shot's duration divided evenly by its word count */
const wordFrame = (id: number, w: number): number => {
  const s = ABU_SHOTS[id - 1];
  return Math.round(s.a + (w * (s.b - s.a)) / s.words);
};

// ---------------- expression & pose steps ----------------
/** an expression step: the face changes in exactly 1 frame, on f = (its word's frame) - 1 */
type Step = { f: number; expr: Expr };
const exprAt = (steps: Step[], f: number): Expr => {
  let e = steps[0].expr;
  for (const s of steps) if (f >= s.f) e = s.expr;
  return e;
};
/** word times (seconds) of a character's expression changes, for the swap-blink in lidAt */
const swapTimes = (steps: Step[]): number[] => steps.slice(1).map((s) => (s.f + 1) / FPS);
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

// ---------------- the shots ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };

/** shot 4 — the mocker laughs ('You cannot move a mountain!'), the engineers say nothing and keep measuring.
 *  Words: w2 laughed (f358) · w8 The (f412) · w12 They (f448) · w14 measuring (f465) · w21 quietly (f528). */
const MOCKER_S4: Step[] = [
  { f: 340, expr: "grin" }, // smug before the laugh — he already knows what he thinks of this plan
  { f: 357, expr: "laugh" }, // 1 f before "laughed": open mouth, squeezed eyes, head cocked back
  { f: 411, expr: "grin" }, // 1 f before "The": the laugh dies as the engineers ignore him
  { f: 447, expr: "neutral" }, // 1 f before "They": watching, unimpressed — his laugh is spent
];
const MOCKER_S4_HEAD: [number, number][] = [[340, 3], [358, 8], [412, 3], [448, 0]];
const MOCKER_S4_TILT: [number, number][] = [[340, 0], [358, 2], [412, 1], [448, 0]];
const ENG1_S4: Step[] = [
  { f: 340, expr: "neutral" },
  { f: 464, expr: "squint" }, // 1 f before "measuring": eyes narrowed on the rod, saying nothing
  { f: 527, expr: "neutral" }, // 1 f before "quietly": back to calm work
];
const ENG2_S4: Step[] = [{ f: 340, expr: "neutral" }]; // the second engineer never reacts — calm is the point
const shot4 = (cam: CamInfo, t: number, f: number, out: Stage) => {
  const X = STAGE_X(4);
  out.places.push(person(cam, { i: 1, o: MOCKER, okey: "mocker" }, X, 0, 0, { side: false, mirror: false },
    { mode: "stand", expr: exprAt(MOCKER_S4, f), blink: lidAt(t, 1, swapTimes(MOCKER_S4)),
      headTilt: poseAt(MOCKER_S4_HEAD, f), tilt: poseAt(MOCKER_S4_TILT, f) }, {}));
  blob(out, X, 0, 0);
  out.places.push(person(cam, { i: 11, o: ENGINEER, okey: "eng" }, X - 1.4, 0, 0, { side: false, mirror: false },
    { mode: "stand", expr: exprAt(ENG1_S4, f), prop: "staff", blink: lidAt(t, 11, swapTimes(ENG1_S4)), facing: 1 }, {}));
  blob(out, X - 1.4, 0, 0);
  out.places.push(person(cam, { i: 12, o: ENGINEER, okey: "eng" }, X + 1.4, 0, 0, { side: false, mirror: false },
    { mode: "stand", expr: exprAt(ENG2_S4, f), prop: "staff", blink: lidAt(t, 12), facing: -1 }, {}));
  blob(out, X + 1.4, 0, 0);
};

/** shot 5 — the cutting line. Saws work at 2 Hz, white dust drifts; the cutters concentrate, then allow
 *  themselves a small satisfied smile as the saws sing. Words: w3 cut (f609) · w12 Saws (f689). */
const CUT_S5: Step[] = [
  { f: 582, expr: "neutral" },
  { f: 608, expr: "squint" }, // 1 f before "cut": narrowed eyes on the line
  { f: 688, expr: "smile_closed" }, // 1 f before "Saws": quiet satisfaction in the rhythm
];
const sawK = (t: number) => q(0.5 + 0.5 * Math.sin(2 * Math.PI * 2 * (t - 19.4)), 30);
const shot5 = (cam: CamInfo, t: number, f: number, out: Stage) => {
  const X = STAGE_X(5);
  for (const [i, dx] of [[0, -0.9], [1, 0.9]] as const) {
    out.places.push(person(cam, { i: 21 + i, o: ENGINEER, okey: "eng" }, X + dx, 0, 0, { side: false, mirror: false },
      { mode: "stand", expr: exprAt(CUT_S5, f), prop: ["saw", sawK(t)], blink: lidAt(t, 21 + i, swapTimes(CUT_S5)) }, {}));
    blob(out, X + dx, 0, 0);
  }
  for (let i = 0; i < 3; i++) {
    const age = ((t - 19.4 + i * 0.5) % 1.5) / 1.5;
    out.fx.push({ key: `puff${q(age, 30)}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, q(age, 30)),
      x: X + (i - 1) * 1.2, y: 1.1, z: 0.3, w: 0.9, h: 0.9, soft: true });
  }
};

/** shot 6 — the lift. Two workers heave the block up (strain → relief → calm); the mocker watches, smug, then
 *  laughs again. Words: w3 lifted (f788) · w8 one, (f833) · w10 the (f851) · w12 laughed (f868). */
const MOCKER_S6: Step[] = [
  { f: 761, expr: "neutral" }, // watching the lift, waiting for the drop
  { f: 787, expr: "grin" }, // 1 f before "lifted": smug — he is sure this ends badly
  { f: 867, expr: "laugh" }, // 1 f before "laughed": second laugh, cockier than the first
];
const MOCKER_S6_HEAD: [number, number][] = [[761, 0], [788, 4], [868, 8]];
const MOCKER_S6_TILT: [number, number][] = [[761, 0], [868, 2]];
const LIFT_S6: Step[] = [
  { f: 761, expr: "neutral" },
  { f: 787, expr: "pained" }, // 1 f before "lifted": teeth-gritted strain
  { f: 832, expr: "relief" }, // 1 f before the second "one": the block is up and held
  { f: 850, expr: "neutral" }, // 1 f before "the": calm again, ignoring the laughter
];
const LIFT_POSE: [number, number][] = [[761, 0], [788, 1], [851, 0.3]];
const shot6 = (cam: CamInfo, t: number, f: number, out: Stage) => {
  const X = STAGE_X(6);
  for (const [i, dx] of [[0, -0.8], [1, 0.3]] as const) {
    const x = X + dx, view = viewOf(cam, x, 0, 1, 0);
    out.places.push(person(cam, { i: 31 + i, o: worker(31 + i), okey: `w${31 + i}` }, x, 0, 0, view,
      { mode: "stand", expr: exprAt(LIFT_S6, f), blink: lidAt(t, 31 + i, swapTimes(LIFT_S6)) },
      { mode: "push", expr: exprAt(LIFT_S6, f), pose: q(poseAt(LIFT_POSE, f), 40), blink: lidAt(t, 31 + i, swapTimes(LIFT_S6)) }));
    blob(out, x, 0, 0);
  }
  // strain ticks by the block while it rises
  if (t >= 26.26 && t < 28.1) creakFx(t, [[X - 0.25, 2.3, 0]], out, 0.5);
  out.places.push(person(cam, { i: 1, o: MOCKER, okey: "mocker" }, X + 1.8, 0, 0, { side: false, mirror: false },
    { mode: "stand", expr: exprAt(MOCKER_S6, f), blink: lidAt(t, 1, swapTimes(MOCKER_S6)),
      headTilt: poseAt(MOCKER_S6_HEAD, f), tilt: poseAt(MOCKER_S6_TILT, f), facing: -1 }, {}));
  blob(out, X + 1.8, 0, 0);
};

/** shot 7 — the wardrobe analogy. No mocker. One mover carries a piece through the door: taking apart is
 *  concentration, carrying is easy. Words: w10 it (f1029) · w13 carry (f1056). */
const MOVER_S7: Step[] = [
  { f: 940, expr: "neutral" },
  { f: 1028, expr: "squint" }, // 1 f before "it" (take it apart): narrowed eyes on the piece
  { f: 1055, expr: "smile_closed" }, // 1 f before "carry": easy now, piece in hand
];
const MOVER_POSE: [number, number][] = [[940, 0.4], [1029, 0.7]];
const shot7 = (cam: CamInfo, t: number, f: number, out: Stage) => {
  const X = STAGE_X(7), view = viewOf(cam, X, 0, 1, 0);
  out.places.push(person(cam, { i: 41, o: MOVER, okey: "mover" }, X, 0, 0, view,
    { mode: "stand", expr: exprAt(MOVER_S7, f), blink: lidAt(t, 41, swapTimes(MOVER_S7)) },
    { mode: "push", expr: exprAt(MOVER_S7, f), pose: q(poseAt(MOVER_POSE, f), 40), blink: lidAt(t, 41, swapTimes(MOVER_S7)) }));
  blob(out, X, 0, 0);
};

/** shot 8 — the rebuild, stone by stone. A director with the rod, a hammerer tapping blocks home on the two
 *  "stone" words, a pusher heaving. Words: w10 built (f1200) · w14 stone (f1235) · w16 stone (f1253) · w19 higher (f1280). */
const DIR_S8: Step[] = [
  { f: 1110, expr: "neutral" },
  { f: 1199, expr: "grin" }, // 1 f before "built": pride — it is standing again
];
const PUSH_S8: Step[] = [
  { f: 1110, expr: "neutral" },
  { f: 1234, expr: "pained" }, // 1 f before the first "stone": heaving the block into place
  { f: 1279, expr: "smile" }, // 1 f before "higher": it sits, and it sits higher
];
const PUSH_S8_POSE: [number, number][] = [[1110, 0.2], [1235, 0.9], [1280, 0.5]];
/** hammer strikes land ON the two "stone" words (half a frame early so the struck frame is the word frame) */
export const HITS = [wordFrame(8, 14) / FPS - 1 / (2 * FPS), wordFrame(8, 16) / FPS - 1 / (2 * FPS)];
/** 0 = hammer up, 1 = struck. Reference action timing: 4 f wind-up, held ~7 f at the top, a 1-frame strike on the word */
const hammerK = (t: number) => {
  let k = 1;
  for (const th of HITS) {
    const n = (t - th) * FPS; // frames to contact
    if (n >= -11 && n < -7) k = Math.min(k, 1 - smooth((n + 11) / 4));
    else if (n >= -7 && n < 0) k = 0;
  }
  return k;
};
const shot8 = (cam: CamInfo, t: number, f: number, out: Stage) => {
  const X = STAGE_X(8);
  out.places.push(person(cam, { i: 51, o: ENGINEER, okey: "eng" }, X - 1.2, 0, 0, { side: false, mirror: false },
    { mode: "stand", expr: exprAt(DIR_S8, f), prop: "staff", blink: lidAt(t, 51, swapTimes(DIR_S8)) }, {}));
  blob(out, X - 1.2, 0, 0);
  out.places.push(person(cam, { i: 52, o: ENGINEER, okey: "eng" }, X + 1.2, 0, 0, { side: false, mirror: false },
    { mode: "stand", expr: exprAt(DIR_S8, f), prop: ["hammer", q(hammerK(t), 30)], blink: lidAt(t, 52, swapTimes(DIR_S8)) }, {}));
  blob(out, X + 1.2, 0, 0);
  const view = viewOf(cam, X, 0, 1, 0);
  out.places.push(person(cam, { i: 53, o: worker(53), okey: "w53" }, X, 0, 0, view,
    { mode: "stand", expr: exprAt(PUSH_S8, f), blink: lidAt(t, 53, swapTimes(PUSH_S8)) },
    { mode: "push", expr: exprAt(PUSH_S8, f), pose: q(poseAt(PUSH_S8_POSE, f), 40), blink: lidAt(t, 53, swapTimes(PUSH_S8)) }));
  blob(out, X, 0, 0);
};

/** shot 9 — fifty countries, one terrace. Ten workers from many lands, proud held smiles, every third one
 *  waving; faces hold for the whole 2.4 s shot (the wave is the movement). */
const CROWD9: Expr[] = ["smile", "grin", "smile_closed", "laugh", "smile", "grin", "smile_closed", "smile", "grin", "laugh"];
const shot9 = (cam: CamInfo, t: number, f: number, out: Stage) => {
  const X = STAGE_X(9);
  for (let i = 0; i < 10; i++) {
    const x = X - 3.6 + i * 0.8, z = (hh(i, 2) - 0.5) * 1.2;
    const wave = i % 3 === 1 ? q(Math.sin(t * 9 + i * 1.3), 30) : undefined;
    out.places.push(person(cam, { i: 60 + i, o: worker(60 + i), okey: `w${60 + i}` }, x, 0, z, { side: false, mirror: false },
      { mode: "stand", expr: CROWD9[i], wave, blink: lidAt(t, 60 + i) }, {}));
    blob(out, x, 0, z);
  }
};

/** shot 11 — the payoff. The laughing man, silent now, looking up at the temples. The face does it all: neutral
 *  quiet at the shot open, then awe (wide eyes, small open mouth, head tipped back) 1 f before "laughing" — the
 *  word is ironic now. He does not laugh, does not speak, does not move after the tip. Words: w2 laughing (f1505). */
const MOCKER_S11: Step[] = [
  { f: 1487, expr: "neutral" }, // silent already — the shot opens on a quiet man
  { f: 1504, expr: "awe" }, // 1 f before "laughing": he looks up, mouth slightly open, no sound
];
const MOCKER_S11_HEAD: [number, number][] = [[1487, 0], [1505, -5]];
const shot11 = (cam: CamInfo, t: number, f: number, out: Stage) => {
  const X = STAGE_X(11);
  out.places.push(person(cam, { i: 1, o: MOCKER, okey: "mocker" }, X, 0, 0, { side: false, mirror: false },
    { mode: "stand", expr: exprAt(MOCKER_S11, f), blink: lidAt(t, 1, swapTimes(MOCKER_S11)),
      headTilt: poseAt(MOCKER_S11_HEAD, f) }, {}, 1.15));
  blob(out, X, 0, 0, 1.15);
};

/** everything with a face in shot `id` at time t. Shots 1-3, 10, 12 have no people by the script. */
export const stage = (id: number, t: number, _b: unknown, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const sh = ABU_SHOTS[id - 1];
  if (!sh) return out;
  LNAME = sh.light;
  findSun(cam, SUN);
  const f = Math.round(t * FPS);
  if (id === 4) shot4(cam, t, f, out);
  else if (id === 5) shot5(cam, t, f, out);
  else if (id === 6) shot6(cam, t, f, out);
  else if (id === 7) shot7(cam, t, f, out);
  else if (id === 8) shot8(cam, t, f, out);
  else if (id === 9) shot9(cam, t, f, out);
  else if (id === 11) shot11(cam, t, f, out);
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
/** retained for interface compatibility (the bridge world puts a sign here); Abu Simbel has no sign — unused. */
export const SIGN_AT: V3 = [320, 0, -2];
export { FPS };
