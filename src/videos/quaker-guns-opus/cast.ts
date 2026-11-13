// Quaker Guns cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a
// draw call); the pool keeps one canvas per distinct drawing, so identical soldiers share canvases (7 head shapes x
// outfit variants). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient
// toward the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit
// cards. Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
//
// STAGING MAP (world metres, ground = D0; the trench line / enemy works sit toward -z):
//   origin field  - S1/S9 Union army formation (files x = FILES*1.45, rows from z=-8 toward +z), S2 Mocker at
//                   (0.3, -6.5), S3 McClellan (-0.6, -5.2) + staff, S7 discovery party in the works (z ~ -11).
//   x ~ 40        - S5 Confederate work crew around (39..42, -4..-6); SIGN_AT sign board at (40.5, -7.8);
//                   S6 escape line marches +x along z ~ -4.6 from x ~ 34.
//   x ~ 80        - S4 analogy: the thief at (80, 0).
//   x ~ 120       - S8 photo payoff: the Tapper at (120.4, -2.2) + two companions.
// EXPRESSION BEATS: every step lands 1 frame BEFORE its trigger word / body move (house micro-timing rule); the
// blink-across-swap in lidAt() hides each swap. Word frames come from timing.json (30 fps).
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, unionSoldier, confedSoldier, UNION_OFFICER, MCCLELLAN, THIEF,
  fxBurst, fxStars, fxCreak, fxShadow, fxContact,
  Outfit, Expr, FrontOpts, SideOpts,
} from "./toon";
import {
  FPS, D0, FILES, ROW_GAP, SHOTS, SNAP, V3, marchPhase, smooth, clamp01, BridgeState,
} from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

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
export const SU_SWING = 2.3 / 1830; // kept for contract compatibility (no swing in this story)
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
const USOL = [0, 1, 2, 3].map((v) => unionSoldier(v));
const CSOL = [0, 1, 2, 3].map((v) => confedSoldier(v));
const vOf = (i: number) => (i * 7 + (i >> 2)) % 4;
/** head-shape seed: 7 shapes, so identical soldiers still share canvases */
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

/** ground shadow under a standing / sitting card, multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
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

// ---------------- beat helpers ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };
/** expression timeline for one character: [frame, expression from that frame on] — steps sit 1 f before their word */
type Beat = [number, Expr];
const exprAt = (beats: Beat[], f: number): Expr => {
  let e = beats[0][1];
  for (const [bf, be] of beats) if (f >= bf) e = be;
  return e;
};
/** blink-cover swap times (seconds) for lidAt(), from every beat after the first */
const swapsOf = (beats: Beat[]) => beats.slice(1).map(([bf]) => bf / FPS);
/** fast-in slow-settle jolt: full amplitude on frame f0, easing out over dur frames */
const settle = (f: number, f0: number, amp: number, dur = 9) => (f < f0 ? 0 : amp * (1 - smooth((f - f0) / dur)));

// ---------------- S1 / S9: the Union army, frozen mid-advance ----------------
const army = (cam: CamInfo, t: number, out: Stage, reprise: boolean) => {
  const f = Math.round(t * FPS);
  const swaps = reprise ? [1072 / FPS] : [48 / FPS, 72 / FPS];
  for (let i = 0; i < 40; i++) {
    const row = i >> 2, file = i & 3;
    const x = FILES[file] * 1.45 + (hh(i) - 0.5) * 0.16, z = -18.5 + row * ROW_GAP + (hh(i, 2) - 0.5) * 0.16;
    const who: Who = { i, o: USOL[vOf(i)], okey: `u${vOf(i)}` };
    const front3 = row > 6, base: Expr = i % 3 === 0 ? "stern" : "neutral";
    let expr: Expr, mode: "march" | "stand", tilt = 0;
    if (!reprise) {
      // advancing until "وقف" (f49): the freeze step lands at f48, the terror step at "مرعوب" f73 (beat f72)
      expr = f < 48 ? base : f < 72 ? (front3 || i % 2 ? "nervous" : "stern") : i % 4 === 0 ? "shock" : "nervous";
      mode = f < 49 ? "march" : "stand";
      tilt = settle(f, 49, -1.6, 9) + (front3 ? 1 : 0.4) * settle(f, 73, -1.2, 9);
    } else {
      // callback wide: the same frozen men; on "وقفت" (f1073, beat f1072) the absurdity lands — laughs and daze
      expr = f < 1072 ? "shock" : i % 3 === 0 ? "laugh" : i % 3 === 1 ? "dazed" : "nervous";
      mode = "stand";
      tilt = settle(f, 1073, -1.5, 10);
    }
    const view = viewOf(cam, x, z, 0, -1);
    const blink = lidAt(t, i, swaps);
    const ph = marchPhase(t);
    const fo: FrontOpts = { phase: mode === "march" ? ph : 0, expr, mode, blink, lift: 55, tilt: q(tilt, 20) };
    const so: SideOpts = { phase: mode === "march" ? ph : 0, expr, mode: mode === "march" ? "march" : "stand", blink, stomp: 1, stride: view.fs };
    out.places.push(person(cam, who, x, D0, z, view, fo, so));
    blob(out, x, D0, z);
  }
};

// ---------------- S2: the Mocker's close-up ----------------
const MOCKER_BEATS: Beat[] = [
  [150, "smile"],
  [168, "grin"],
  [180, "smug"],
  [200, "grin"],
  [212, "smile"],
  [229, "grin"],
  [245, "smug"],
  [261, "grin"],
  [268, "laugh"] // step-change lands 1 frame before trigger f269
];
const mocker = (cam: CamInfo, t: number, out: Stage) => {
  const f = Math.round(t * FPS);
  const expr = exprAt(MOCKER_BEATS, f);
  // he speaks the whole quoted line (f169-304): head works with the words, then tips back on "خشبة؟" (f269)
  const fo: FrontOpts = { mode: "stand", expr, facing: 1, blink: lidAt(t, 301, swapsOf(MOCKER_BEATS)),
    headTilt: q(2.2 * Math.sin(f * 0.13), 12), tilt: q(1 + settle(f, 269, -3, 12), 20) };
  out.places.push(person(cam, { i: 301, o: UNION_OFFICER, okey: "mocker" }, 0.55, D0, -6.2, { side: false, mirror: false }, fo, {}));
  blob(out, 0.55, D0, -6.2, 1.05);
  // his mate at his shoulder, half a step behind: grins along, bursts out with him on the punch word
  const CB: Beat[] = [[150, "grin"], [212, "smile_closed"], [268, "laugh"], [286, "grin"]];
  const cfo: FrontOpts = { mode: "stand", expr: exprAt(CB, f), look: -1, blink: lidAt(t, 302, swapsOf(CB)) };
  out.places.push(person(cam, { i: 302, o: USOL[1], okey: "u1" }, 2.05, D0, -5.8, { side: false, mirror: false }, cfo, {}, 0.94));
  blob(out, 2.05, D0, -5.8, 0.95);
};

// ---------------- S3: McClellan at the spyglass ----------------
const MAC_BEATS: Beat[] = [[303, "stern"], [339, "nervous"], [377, "squint"], [413, "shock"], [440, "nervous"]];
const mcclellan = (cam: CamInfo, t: number, out: Stage) => {
  const f = Math.round(t * FPS);
  const fo: FrontOpts = { mode: "stand", expr: exprAt(MAC_BEATS, f), facing: -1, prop: "spyglass",
    blink: lidAt(t, 303, swapsOf(MAC_BEATS)), headTilt: -2, tilt: q(2 + settle(f, 413, -2.5, 8), 20) };
  const view = viewOf(cam, 11, -14, 0, -1);
  out.places.push(person(cam, { i: 303, o: MCCLELLAN, okey: "mac" }, 11, D0, -14, view, fo, { expr: exprAt(MAC_BEATS, f), blink: lidAt(t, 303, swapsOf(MAC_BEATS)) }));
  blob(out, 11, D0, -14, 1.05);
  // staff officers flanking him: their faces follow his beats half a step later
  const SA: Beat[] = [[303, "neutral"], [339, "nervous"], [413, "shock"], [440, "nervous"]];
  const SB: Beat[] = [[303, "stern"], [356, "neutral"], [413, "nervous"], [448, "stern"]];
  const a: FrontOpts = { mode: "stand", expr: exprAt(SA, f), blink: lidAt(t, 304, swapsOf(SA)) };
  out.places.push(person(cam, { i: 304, o: UNION_OFFICER, okey: "staffa" }, 9.2, D0, -15.3, { side: false, mirror: false }, a, {}, 0.97));
  blob(out, 9.2, D0, -15.3);
  const bfo: FrontOpts = { mode: "stand", expr: exprAt(SB, f), blink: lidAt(t, 305, swapsOf(SB)) };
  out.places.push(person(cam, { i: 305, o: USOL[2], okey: "u2" }, 12.9, D0, -15.5, { side: false, mirror: false }, bfo, {}, 0.95));
  blob(out, 12.9, D0, -15.5, 0.95);
};

// ---------------- S4: the analogy — a fake camera scares the thief ----------------
const THIEF_BEATS: Beat[] = [[465, "sneak"], [505, "smug"], [535, "nervous"], [554, "shock"], [568, "panic"]];
const thief = (cam: CamInfo, t: number, out: Stage) => {
  const f = Math.round(t * FPS);
  const expr = exprAt(THIEF_BEATS, f);
  const flee = f >= 568, frozen = f >= 554 && !flee;
  const mode = frozen ? "stand" : "march";
  const phase = flee ? marchPhase(t * 1.9) : marchPhase(t * 0.8);
  const tilt = frozen ? settle(f, 554, -3, 8) : flee ? 10 : 7;
  const view = viewOf(cam, 163.5, 3.5, flee ? 1 : -1, 0);
  const fo: FrontOpts = { mode, phase: frozen ? 0 : phase, expr, blink: lidAt(t, 306, swapsOf(THIEF_BEATS)), lift: flee ? 72 : 24, tilt: q(tilt, 20) };
  const so: SideOpts = { mode: mode === "march" ? "march" : "stand", phase: frozen ? 0 : phase, expr, blink: lidAt(t, 306, swapsOf(THIEF_BEATS)), stomp: flee ? 1.2 : 0.6, stride: view.fs };
  out.places.push(person(cam, { i: 306, o: THIEF, okey: "thief" }, 163.5, D0, 3.5, view, fo, so));
  if (!flee) blob(out, 163.5, D0, 3.5);
};

// ---------------- S5: the Confederate work crew ----------------
export const SIGN_AT: V3 = [240, D0, 15.5];
const crew = (cam: CamInfo, t: number, out: Stage) => {
  const f = Math.round(t * FPS);
  // sawyer: two hands on the frame saw, stroke sliding ~0.9 Hz; face warms as the joke lands
  const SAW: Beat[] = [[588, "neutral"], [631, "grin"], [663, "smile_closed"], [675, "laugh"], [700, "grin"]];
  const sawK = q(0.5 + 0.5 * Math.sin(f * 0.32), 24);
  const sfo: FrontOpts = { mode: "stand", expr: exprAt(SAW, f), facing: 1, prop: ["saw", sawK], blink: lidAt(t, 401, swapsOf(SAW)) };
  out.places.push(person(cam, { i: 401, o: CSOL[0], okey: "c0" }, 233.1, D0, 4.7, { side: false, mirror: false }, sfo, {}));
  blob(out, 233.1, D0, 4.7);
  // painter: brush stroking black onto a log, dip-and-grin on "وساموها" (f643), gloating on "مدافع" (f663)
  const PA: Beat[] = [[588, "smile_closed"], [643, "grin"], [663, "gloat"], [691, "laugh"]];
  const brushK = q(0.5 + 0.5 * Math.sin(f * 0.42 + 1.3), 24);
  const pfo: FrontOpts = { mode: "stand", expr: exprAt(PA, f), facing: -1, prop: ["brush", brushK], blink: lidAt(t, 402, swapsOf(PA)) };
  out.places.push(person(cam, { i: 402, o: CSOL[1], okey: "c1" }, 241.1, D0, 5.9, { side: false, mirror: false }, pfo, {}));
  blob(out, 241.1, D0, 5.9);
  // helper steadying the log, watching the sawyer
  const HE: Beat[] = [[588, "neutral"], [631, "smile"], [675, "grin"]];
  const hfo: FrontOpts = { mode: "stand", expr: exprAt(HE, f), look: -1, blink: lidAt(t, 403, swapsOf(HE)) };
  out.places.push(person(cam, { i: 403, o: CSOL[2], okey: "c2" }, 235.6, D0, 4.7, { side: false, mirror: false }, hfo, {}, 0.97));
  blob(out, 235.6, D0, 4.7, 0.97);
  // fourth man seated on a finished log, painting its muzzle end
  const SE: Beat[] = [[588, "grin"], [663, "laugh"], [691, "smile_closed"]];
  const efo: FrontOpts = { mode: "sit", expr: exprAt(SE, f), blink: lidAt(t, 404, swapsOf(SE)) };
  out.places.push(person(cam, { i: 404, o: CSOL[3], okey: "c3" }, 238, D0, 9.4, { side: false, mirror: false }, efo, {}));
  blob(out, 238, D0, 9.4, 0.95, 0.85);
};

// ---------------- S6: dusk — the line slips away behind its wooden guns ----------------
const escape = (cam: CamInfo, t: number, out: Stage) => {
  const f = Math.round(t * FPS);
  const prog = ((f - 713) / 65) * 10; // the line covers ~7 m across the shot, quiet and unhurried
  for (let i = 0; i < 6; i++) {
    const x = -24 + i * 1.7 + prog, z = 11.5 + (hh(i, 3) - 0.5) * 0.8;
    const last = i === 5;
    const LB: Beat[] = [[713, "grin"], [745, "smug"]];
    const expr: Expr = last ? exprAt(LB, f) : i % 2 ? "stern" : "neutral";
    const view = viewOf(cam, x, z, 1, 0);
    const blink = lidAt(t, 410 + i, last ? swapsOf(LB) : []);
    const ph = marchPhase(t * 0.85 + i * 0.37);
    const fo: FrontOpts = { mode: "march", phase: ph, expr, blink, lift: 40, look: last ? -1 : 0 };
    const so: SideOpts = { mode: "march", phase: ph, expr, blink, stomp: 0.8, stride: view.fs };
    out.places.push(person(cam, { i: 410 + i, o: CSOL[vOf(i + 1)], okey: `c${vOf(i + 1)}` }, x, D0, z, view, fo, so, 1 - i * 0.025));
    blob(out, x, D0, z, 1 - i * 0.025, 0.8);
  }
  // rear pair by the last placed log: one gives it a final brush stroke on "وحطوها" (f715), then both fall in
  const brushK = q(0.5 + 0.5 * Math.sin(f * 0.42), 24);
  const RB: Beat[] = [[713, "grin"], [730, "neutral"]];
  for (let j = 0; j < 2; j++) {
    const joining = f >= 745; // rear pair joining beat trigger
    const x = (j ? -1.7 : -3.4) + (joining ? ((f - 745) / 33) * 2.2 : 0), z = j ? 4.7 : 5.3;
    const view = viewOf(cam, x, z, 1, 0);
    const ph = marchPhase(t * 0.85 + j * 0.5);
    const fo: FrontOpts = joining
      ? { mode: "march", phase: ph, expr: "neutral", blink: lidAt(t, 420 + j), lift: 40 }
      : { mode: "stand", expr: exprAt(RB, f), blink: lidAt(t, 420 + j, swapsOf(RB)), prop: j === 0 ? ["brush", brushK] : null, facing: 1 };
    const so: SideOpts = joining ? { mode: "march", phase: ph, expr: "neutral", blink: lidAt(t, 420 + j), stomp: 0.8, stride: view.fs } : { expr: "neutral", blink: lidAt(t, 420 + j) };
    out.places.push(person(cam, { i: 420 + j, o: CSOL[(j + 2) % 4], okey: `c${(j + 2) % 4}` }, x, D0, z, view, fo, so, 0.98));
    blob(out, x, D0, z, 0.98, 0.8);
  }
};

// ---------------- S7: the discovery — confidence flips to shock ----------------
/** the hollow knock lands on "لقوا" (f870): fist wound up from f852, a 1-frame strike at f870, then the let-down */
export const KNOCK_F = 870;
const knockK = (f: number) => (f < KNOCK_F ? 0 : f === KNOCK_F ? 1 : Math.max(0.25, 1 - (f - KNOCK_F) / 12));
const KNOCK_BEATS: Beat[] = [[778, "smile"], [812, "stern"], [840, "shock"], [866, "nervous"], [884, "dazed"], [905, "pained"]];
const discovery = (cam: CamInfo, t: number, out: Stage) => {
  const f = Math.round(t * FPS);
  // the knocker: marches in sure of himself, stops dead with everyone at "اتصدموا" (f841, beat f840),
  // steps up and knocks on the "cannon" — hollow. Stars circle as it sinks in.
  const marching = f < 841;
  const kfo: FrontOpts = { mode: marching ? "march" : "stand", phase: marching ? marchPhase(t) : 0,
    expr: exprAt(KNOCK_BEATS, f), blink: lidAt(t, 501, swapsOf(KNOCK_BEATS)), lift: 55,
    prop: f >= 852 && f < 886 ? ["knock", q(knockK(f), 20)] : null, tilt: q(settle(f, 841, -2, 9), 20) };
  out.places.push(person(cam, { i: 501, o: USOL[0], okey: "u0" }, 13.1, D0, -4.7, viewOf(cam, 13.1, -4.7, 0, -1), kfo,
    { mode: marching ? "march" : "stand", phase: marching ? marchPhase(t) : 0, expr: exprAt(KNOCK_BEATS, f), blink: lidAt(t, 501, swapsOf(KNOCK_BEATS)) }));
  blob(out, 13.1, D0, -4.7);
  if (f >= KNOCK_F && f < KNOCK_F + 5) {
    const u = (f - KNOCK_F) / 5;
    out.fx.push({ key: `burst${q(u, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 30)), x: 14.55, y: D0 + 1.3, z: -3.6, w: 0.55, h: 0.55 });
  }
  if (f >= 888 && f < 930) {
    const u = ((f - 888) / 42) % 1;
    out.fx.push({ key: `stars${q(u, 30)}`, cw: 420, ch: 210, draw: (p) => fxStars(p, q(u, 30)), x: 13.1, y: D0 + 1.5, z: -4.7, w: 0.75, h: 0.375 });
  }
  // the rest of the party: five men spread through the empty works
  const spots: [number, number][] = [[10.8, -6.9], [12.0, -1.6], [16.9, -1.9], [17.8, -6.6], [10.2, -2.2]];
  const tail: Expr[] = ["dazed", "pained", "shock", "nervous", "dazed"];
  spots.forEach(([x, z], i) => {
    const PB: Beat[] = [[778, i % 2 ? "stern" : "smile"], [840, "shock"], [870, "nervous"], [899, tail[i]]];
    const sits = i === 3 && f >= 905;
    const fo: FrontOpts = { mode: sits ? "sit" : marching ? "march" : "stand", phase: marching ? marchPhase(t) : 0,
      expr: exprAt(PB, f), blink: lidAt(t, 510 + i, swapsOf(PB)), lift: 55 };
    out.places.push(person(cam, { i: 510 + i, o: USOL[vOf(i + 2)], okey: `u${vOf(i + 2)}` }, x, D0, z, viewOf(cam, x, z, 0, -1), fo,
      { mode: marching ? "march" : "stand", phase: marching ? marchPhase(t) : 0, expr: exprAt(PB, f), blink: lidAt(t, 510 + i, swapsOf(PB)) }, 0.97));
    blob(out, x, D0, z, 0.97);
  });
};

// ---------------- S8: the photo payoff — Barnard's tapper ----------------
const TAPS = [987, 1017]; // stick strikes on "بيضرب" (f987) and "بعصايا" (f1017)
const tapK = (f: number) => {
  let k = 0.15;
  for (const T of TAPS) {
    const n = f - T;
    if (n >= -8 && n < 0) k = 0;
    else if (n === 0) k = 1;
    else if (n > 0 && n < 12) k = Math.max(0.15, 1 - n / 10);
  }
  return q(k, 20);
};
const TAPPER_BEATS: Beat[] = [[930, "grin"], [960, "smile_closed"], [967, "gloat"], [987, "laugh"], [1002, "grin"], [1017, "laugh"]];
const tapper = (cam: CamInfo, t: number, out: Stage) => {
  const f = Math.round(t * FPS);
  const fo: FrontOpts = { mode: "stand", expr: exprAt(TAPPER_BEATS, f), facing: 1, prop: ["tapstick", tapK(f)],
    blink: lidAt(t, 601, swapsOf(TAPPER_BEATS)), headTilt: q(2 * Math.sin(f * 0.09), 12),
    tilt: q(settle(f, 987, 1.6, 8) + settle(f, 1017, 1.6, 8), 20) };
  out.places.push(person(cam, { i: 601, o: USOL[3], okey: "u3" }, 12.85, D0, -2.35, { side: false, mirror: false }, fo, {}));
  blob(out, 12.85, D0, -2.35, 1.05);
  for (const T of TAPS) if (f >= T && f < T + 5) {
    const u = (f - T) / 5;
    out.fx.push({ key: `burst${q(u, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 30)), x: 13.95, y: D0 + 1.0, z: -3.4, w: 0.5, h: 0.5 });
  }
  const AB: Beat[] = [[930, "grin"], [987, "laugh"], [1017, "grin"]];
  const afo: FrontOpts = { mode: "stand", expr: exprAt(AB, f), look: 1, blink: lidAt(t, 602, swapsOf(AB)) };
  out.places.push(person(cam, { i: 602, o: USOL[1], okey: "u1" }, 16.6, D0, -2.0, { side: false, mirror: false }, afo, {}, 0.95));
  blob(out, 16.6, D0, -2.0, 0.95);
  const BB: Beat[] = [[930, "smile_closed"], [967, "grin"], [1002, "laugh"]];
  const bfo: FrontOpts = { mode: "stand", expr: exprAt(BB, f), look: -1, blink: lidAt(t, 603, swapsOf(BB)),
    wave: f >= 1002 && f < 1032 ? q(Math.sin(f * 0.5), 20) : undefined };
  out.places.push(person(cam, { i: 603, o: USOL[2], okey: "u2" }, 11.3, D0, -1.3, { side: false, mirror: false }, bfo, {}, 0.97));
  blob(out, 11.3, D0, -1.3, 0.97);
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, b: BridgeState, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  void b; // Quaker staging is ground-flat (D0); no deck physics to consume
  switch (id) {
    case 1: army(cam, t, out, false); break;
    case 2: mocker(cam, t, out); break;
    case 3: mcclellan(cam, t, out); break;
    case 4: thief(cam, t, out); break;
    case 5: crew(cam, t, out); break;
    case 6: escape(cam, t, out); break;
    case 7: discovery(cam, t, out); break;
    case 8: tapper(cam, t, out); break;
    case 9: army(cam, t, out, true); break;
    default: break;
  }
  return out;
};

// ---------------- one-off effects (contract kept with world.ts) ----------------
/** impact burst at the knock moment (29.0 s) wherever world.ts points it */
export const HITS = [KNOCK_F / FPS];
export const snapFx = (tau: number, at: V3, out: Stage) => {
  if (tau >= HITS[0] && tau < HITS[0] + 0.45) {
    const u = (tau - HITS[0]) / 0.45;
    out.fx.push({ key: `bigburst${q(u, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 30)), x: at[0], y: at[1] + 0.12, z: at[2] - 0.15, w: 1.1, h: 1.1 });
  }
};
/** no water in this story: kept as a no-op so world.ts calls stay valid */
export const splashFx = (tau: number, out: Stage) => { void tau; void out; };
export const creakFx = (t: number, pts: V3[], out: Stage, size = 0.8) =>
  pts.forEach(([x, y, z], i) => {
    const u = q((t * 1.3 + i * 0.37) % 1, 30);
    out.fx.push({ key: `creak${u}`, cw: 300, ch: 300, draw: (p) => fxCreak(p, u), x, y, z, w: size, h: size, rot: i * 0.6 - 0.6 });
  });
export { FPS, SNAP };
