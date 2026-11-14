// Otis cast as lit flat cartoon sprites in the 3D world (house style, matching quaker-guns-opus/cast.ts).
// Characters are yaw-only billboards shaded by cardShade(), with contact blobs on the ground.

import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, townsfolk, UNION_OFFICER, CONFED,
  fxBurst, fxPuff, fxCreak, fxShadow, fxContact, fxPlank,
  Outfit, Expr, FrontOpts, SideOpts, INK,
} from "./toon";
import {
  FPS, D0, SHOTS, V3, smooth, clamp01, BridgeState,
  X_PALACE, X_STREET, X_APTS, X_SHOP,
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
export const SU = 0.00216;
export const SU_SWING = 2.3 / 1830;
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
const ROOTS = new Set<THREE.Object3D>();

export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false;
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}

export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false;
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
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    } else {
      this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0;
    }
  }
}

export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };
export type Stage = { places: Place[]; fx: FxPlace[] };

// ---------------- Outfits (1854 New York Period Cast) ----------------
/** Elisha Otis: tall stovepipe top hat, 1854 dark navy-charcoal frock coat, brass waistcoat buttons, beard/moustache */
export const OTIS_OUTFIT: Outfit = {
  jacket: "#1e2738",
  pants: "#2b303c",
  boots: INK,
  hat: "tophat",
  buttons: "#e5b842",
  sash: "#8c353a",
  moustache: "#3a2618",
  skin: "#ffe2c2",
};

/** Otis's Assistant: work vest, rolled sleeves look, cap */
export const ASSISTANT_OUTFIT: Outfit = {
  ...CONFED,
  jacket: "#7a5234",
  pants: "#3a404d",
  hat: "cap",
  cap: "#3b2d22",
  buttons: "#d4b26a",
  rifle: false,
};

/** Wealthy 1854 Merchants (Shot 10 & Shot 7): stout build, top hat, rich coat & gold buttons */
export const MERCHANT_A: Outfit = {
  ...UNION_OFFICER,
  jacket: "#2b1d38",
  pants: "#3d3546",
  hat: "tophat",
  sash: "#c99b38",
  sword: false,
  rifle: false,
  build: "stout",
};
export const MERCHANT_B: Outfit = {
  ...UNION_OFFICER,
  jacket: "#1f3b34",
  pants: "#2f3d3a",
  hat: "tophat",
  sash: "#a83238",
  sword: false,
  rifle: false,
  build: "stout",
};

const POOR_CLIMBERS: Outfit[] = [
  { jacket: "#6e6254", pants: "#4a433b", boots: "#2e241d", hat: "cap", cap: "#52463a", skin: "#f5c9a0" },
  { jacket: "#5d6870", pants: "#3d4247", boots: "#2e241d", hat: "bonnet", dress: "#7a6855", skin: "#ffe2c2" },
  { jacket: "#785a46", pants: "#483c32", boots: "#2e241d", hat: "cap", cap: "#46382c", skin: "#ecd0b6" },
  { jacket: "#635a6b", pants: "#3f3b45", boots: "#2e241d", hat: "hair", hair: "#4a3426", skin: "#ffe2c2" },
];

const q = (v: number, n = 60) => Math.round(v * n) / n;
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
const tier = (d: number): [number, number, number] =>
  d < 3.5 ? [1440, 2400, 2.4] : d < 7.5 ? [900, 1500, 1.5] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" | "dusk" = "day";

const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
type ExtraDraw = (p: Pen) => void;

const person = (
  cam: CamInfo,
  who: Who,
  x: number,
  y: number,
  z: number,
  fo: FrontOpts,
  scale = 1,
  extra?: ExtraDraw,
  extraTag = "",
): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const light = light2D(cam, false), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed };
  const key = `F|${who.okey}|${fkey(f2)}|${extraTag}`;
  return {
    key,
    x,
    y,
    z,
    scale,
    mirror: false,
    draw: (p) => {
      bodyFront(p, who.o, f2);
      if (extra) extra(p);
    },
    size: [w, h, k],
  };
};

const personSide = (
  cam: CamInfo,
  who: Who,
  x: number,
  y: number,
  z: number,
  so: SideOpts,
  mirror = false,
  scale = 1,
  extra?: ExtraDraw,
  extraTag = "",
): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const light = light2D(cam, mirror), seed = seedOf(who.i);
  const s2: SideOpts = { ...so, light, seed };
  const key = `S|${who.okey}|${fkey(s2)}|${extraTag}`;
  return {
    key,
    x,
    y,
    z,
    scale,
    mirror,
    draw: (p) => {
      bodySide(p, who.o, s2);
      if (extra) extra(p);
    },
    size: [w, h, k],
  };
};

// Extra overlays drawn in the 600x1000 character design space:
/** Extra-tall 1854 stovepipe crown & optional hat-tip hand for Elisha Otis */
const drawOtisExtras = (p: Pen, mode: "normal" | "signal" | "hat_tip" | "all_safe") => {
  // Tall stovepipe top-hat extension above the standard hat crown
  p.poly([[218, 175], [382, 175], [392, 42], [208, 42]], "#23202b", 11);
  p.band([[214, 158], [386, 158]], "#d9b04a", 16, 4);
  if (mode === "hat_tip") {
    // Raised right hand calmly touching the brim of his tall top hat (Shot 21)
    p.line([[385, 480], [445, 345], [398, 210]], "#1e2738", 24, true);
    p.dot(394, 206, 16, "#ffe2c2");
  } else if (mode === "all_safe") {
    // Left arm also raised wide ("All safe, gentlemen, all safe!" Shot 22)
    p.line([[215, 480], [135, 390], [95, 310]], "#1e2738", 24, true);
    p.dot(92, 306, 15, "#ffe2c2");
  }
};

/** Panic hands raised to head for terrified crowd in Shot 19 */
const drawPanicHands = (p: Pen) => {
  p.line([[215, 490], [155, 360], [205, 265]], "#2b303c", 20, true);
  p.line([[385, 490], [445, 360], [395, 265]], "#2b303c", 20, true);
  p.dot(205, 262, 13, "#ffe2c2");
  p.dot(395, 262, 13, "#ffe2c2");
};

/** Flying sweat droplets for exhausted stair climbers in Shot 8 */
const drawSweatDrops = (p: Pen, phase: number) => {
  const dy = (phase % 1) * 35;
  p.ell(185 - dy * 0.5, 240 + dy, 9, 15, "#7dd4ff", 4);
  p.ell(420 + dy * 0.5, 255 + dy, 8, 14, "#7dd4ff", 4);
  p.ell(165 - dy * 0.4, 285 + dy, 7, 12, "#7dd4ff", 4);
};

/** Golden champagne/wine glass for rich Ground Floor residents in Shot 7 */
const drawWineGlass = (p: Pen) => {
  p.poly([[415, 515], [455, 515], [435, 550]], "#ffd86b", 5);
  p.stroke([[435, 550], [435, 585]], 5, INK);
  p.stroke([[420, 585], [450, 585]], 5, INK);
};

const CONTACT: Record<"day" | "golden" | "dusk", [number, number, number]> = {
  day: [0.2, 0.21, 0.33],
  golden: [0.24, 0.2, 0.33],
  dusk: [0.18, 0.2, 0.35],
};
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");

const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const tc = hexOf(TAIL, k);
    out.fx.push({
      key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc),
      x: x + ox * 0.45 * sc, y: y + 0.018, z: z + oz * 0.45 * sc, w: 0.72 * sc, h: 1.45 * sc, flat: true, rot,
    });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({
    key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc),
    x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc, w: 0.52 * sc, h: 0.4 * sc, flat: true, rot,
  });
};

// ---------------- Stage per Shot ----------------
export const stage = (id: number, t: number, b: BridgeState, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1] ?? SHOTS[0];
  LNAME = s.light;
  const f = Math.round(t * FPS);

  // Shots 23–29 (X-ray reveal) and 30–34 (Seatbelt & City skyline) have no 2D character cards
  if (id >= 23) return out;

  // =========================================================================
  // SHOTS 1, 2, 3, 12..22: Crystal Palace Demonstration (X_PALACE = 0)
  // =========================================================================
  if (id <= 3 || (id >= 12 && id <= 22)) {
    const py = b.platY;

    // 1. Elisha Otis standing on the open platform at (0, py + 0.12, 0)
    if (id !== 15 && id !== 16 && id !== 17 && id !== 19) {
      let expr: Expr = "proud";
      let wave: number | undefined;
      let tilt = 0;
      let otisMode: "normal" | "signal" | "hat_tip" | "all_safe" = "normal";

      if (id === 3) {
        // Shot 3: Otis signals to his assistant to cut the rope
        expr = "stern";
        wave = q(0.6 + 0.35 * Math.sin(t * 6), 20);
        otisMode = "signal";
      } else if (id === 18) {
        // Shot 18: Platform drops a few cm suddenly
        expr = f < 835 ? "shock" : "stern";
        tilt = f < 838 ? -3.5 : 0;
      } else if (id === 20) {
        // Shot 20: Platform locked in mid-air
        expr = "proud";
      } else if (id === 21) {
        // Shot 21: Otis adjusts his tall top hat calmly
        expr = "smug";
        otisMode = "hat_tip";
      } else if (id === 22) {
        // Shot 22: "All safe, gentlemen, all safe!"
        expr = "grin";
        wave = q(0.7 + 0.25 * Math.sin(t * 5), 20);
        otisMode = "all_safe";
      }

      out.places.push(
        person(
          cam,
          { i: 1, o: OTIS_OUTFIT, okey: "otis" },
          X_PALACE,
          py + 0.14,
          0.1,
          { mode: "stand", expr, wave, tilt, facing: 0 },
          1.05,
          (p) => drawOtisExtras(p, otisMode),
          otisMode,
        ),
      );
      blob(out, X_PALACE, py + 0.14, 0.1, 1.0);
    }

    // 2. Assistant on the upper catwalk (0.95, 14.04, 0.15) with axe
    if (id === 1 || id === 3 || id === 14 || id === 15 || id === 16 || id === 17) {
      const axeStrike = id === 15 ? smooth((f - 729) / 26) : id >= 16 ? 1 : 0.1;
      const aExpr: Expr = id >= 15 ? "stern" : "nervous";
      out.places.push(
        person(
          cam,
          { i: 2, o: ASSISTANT_OUTFIT, okey: "asst" },
          0.95,
          14.04,
          0.15,
          { mode: "stand", expr: aExpr, facing: -1, prop: ["hammer", q(axeStrike, 20)] },
          0.98,
        ),
      );
    }

    // 3. Crystal Palace Spectators Crowd around the tower base
    const crowdRing: [number, number][] = [
      [-3.2, 4.2], [-1.9, 4.5], [-0.6, 4.4], [0.7, 4.5], [2.0, 4.3], [3.3, 4.1],
      [-4.2, 5.8], [-2.7, 6.0], [-1.2, 5.9], [0.3, 6.1], [1.8, 5.9], [3.4, 5.7],
      [-4.8, 7.5], [-3.1, 7.6], [-1.5, 7.8], [0.2, 7.7], [1.9, 7.6], [3.8, 7.4],
      [-5.5, 2.2], [5.5, 2.2], [-6.2, -1.5], [6.2, -1.5],
    ];
    if (id === 1 || id === 2 || id === 12 || id === 13 || id === 14 || id === 19 || id === 20 || id === 22) {
      crowdRing.forEach(([cx, cz], idx) => {
        let cExpr: Expr = idx % 2 === 0 ? "neutral" : "smile";
        let wave: number | undefined;
        let extra: ExtraDraw | undefined;
        let extraTag = "";

        if (id === 14) {
          cExpr = idx % 2 === 0 ? "nervous" : "shock";
        } else if (id === 19) {
          // Shot 19: Crowd screams in terror, hands raised to heads!
          cExpr = idx % 3 === 0 ? "panic" : "shock";
          extra = drawPanicHands;
          extraTag = "panicHands";
        } else if (id === 20) {
          cExpr = "shock";
        } else if (id === 22) {
          cExpr = idx % 2 === 0 ? "laugh" : "grin";
          wave = q(Math.sin(t * 7 + idx), 15);
        }

        const who: Who = { i: 20 + idx, o: townsfolk(idx), okey: `tf${idx % 6}` };
        out.places.push(
          person(cam, who, cx, D0, cz, { mode: "stand", expr: cExpr, wave, facing: cx < 0 ? 1 : -1, noArms: extra !== undefined }, 0.96, extra, extraTag),
        );
        blob(out, cx, D0, cz, 0.92);
      });
    }

    // 4. Special 2D FX for Shot 16 (CHOP!), Shot 18 (Drop), Shot 20 (Ratchet Lock Sparks)
    if (id === 16) {
      const u = q(clamp01((f - 756) / 30), 25);
      out.fx.push({
        key: `chopBurst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u * 0.45, "#ffe88a", 12, 55, 240),
        x: 0, y: 14.85, z: 0.25, w: 1.35, h: 1.35,
      });
    }
    if (id === 18) {
      const u = q(clamp01((f - 822) / 35), 25);
      for (const sx of [-1.58, 1.58]) {
        out.fx.push({
          key: `dropBurst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u * 0.5, "#ffd27a", 10, 40, 210),
          x: sx, y: py + 2.35, z: 0.2, w: 0.95, h: 0.95,
        });
      }
    }
    if (id === 20) {
      // Sparks at both ratchet guide rails where the claws locked in mid-air
      const u = q(((t * 2.5) % 1) * 0.45, 25);
      for (const sx of [-1.58, 1.58]) {
        out.fx.push({
          key: `lockSpark${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u, "#ffcf66", 10, 35, 195),
          x: sx, y: py + 2.35, z: 0.25, w: 0.85, h: 0.85,
        });
      }
    }
    return out;
  }

  // =========================================================================
  // SHOTS 4, 5, 6: 1854 Flashback Hoist Box Snap & Crash (X_STREET = -90)
  // =========================================================================
  if (id === 4 || id === 5 || id === 6) {
    if (id === 4) {
      // Swaying wooden box at y = 8.2m with nervous passenger inside & creak ticks on rope
      const boxY = 8.2;
      out.places.push(
        person(cam, { i: 50, o: POOR_CLIMBERS[0], okey: "boxPass" }, X_STREET, boxY + 0.15, 0, { mode: "stand", expr: "nervous" }, 0.92),
      );
      const u = q((t * 1.8) % 1, 20);
      out.fx.push({ key: `creak4_${u}`, cw: 300, ch: 300, draw: (p) => fxCreak(p, u), x: X_STREET, y: boxY + 2.9, z: 0.3, w: 0.95, h: 0.95 });
    } else if (id === 5) {
      // Rope snaps at ~7.4s (f222) and box plunges!
      const snapU = clamp01((f - 222) / 38);
      const boxY = 8.2 - 5.8 * snapU * snapU;
      out.places.push(
        person(cam, { i: 50, o: POOR_CLIMBERS[0], okey: "boxPass" }, X_STREET, boxY + 0.15, 0, { mode: "stand", expr: "panic", noArms: true }, 0.92, drawPanicHands, "panic"),
      );
      if (f >= 220) {
        const bu = q(clamp01((f - 220) / 35) * 0.45, 25);
        out.fx.push({
          key: `snap5_${bu}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, bu, "#ffe28a", 10, 45, 220),
          x: X_STREET, y: 11.1, z: 0.3, w: 1.15, h: 1.15,
        });
      }
    } else if (id === 6) {
      // Shot 6: Box smashes at the bottom of the shaft! Dust clouds, flying planks & impact burst
      const u = q(clamp01((f - 260) / 48), 25);
      out.fx.push({
        key: `crashBurst_${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, 0.25 + u * 0.35, "#ffcf70", 12, 60, 240),
        x: X_STREET, y: 1.1, z: 0.8, w: 1.9, h: 1.9,
      });
      for (const [dx, dy, dz, sc] of [[-1.3, 0.9, 0.9, 1.8], [1.4, 1.0, 0.8, 1.7], [0, 1.4, 1.1, 2.1], [-0.7, 0.6, 1.3, 1.5]]) {
        out.fx.push({
          key: `crashPuff_${q(u * 0.6, 20)}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, q(u * 0.6, 20)),
          x: X_STREET + dx, y: dy, z: dz, w: sc, h: sc, soft: true,
        });
      }
      for (const [px, py, rot] of [[-1.5, 1.6, 0.6], [1.6, 1.8, -0.7], [-0.6, 2.3, 1.1], [0.9, 2.1, -0.4]]) {
        out.fx.push({
          key: "plankDebris", cw: 320, ch: 110, draw: (p) => fxPlank(p),
          x: X_STREET + px * (0.6 + 0.5 * u), y: py + Math.sin(u * Math.PI) * 0.6, z: 0.7, w: 1.1, h: 0.38, rot: rot + u * 1.4,
        });
      }
    }
    return out;
  }

  // =========================================================================
  // SHOT 7: Rich Ground Floor Aristocrats (X_APTS = -180)
  // =========================================================================
  if (id === 7) {
    const spots: [number, number, Outfit, Expr, boolean][] = [
      [X_APTS - 5.2, 0.6, MERCHANT_A, "proud", true],
      [X_APTS - 3.6, 0.8, townsfolk(1), "smile_closed", false],
      [X_APTS - 1.2, 0.7, MERCHANT_B, "smug", true],
      [X_APTS + 0.4, 0.9, townsfolk(3), "smile", false],
      [X_APTS + 2.0, 0.6, townsfolk(0), "grin", true],
    ];
    spots.forEach(([x, z, o, expr, glass], idx) => {
      out.places.push(
        person(
          cam,
          { i: 70 + idx, o, okey: `rich${idx}` },
          x,
          D0 + 0.08,
          z,
          { mode: "stand", expr, facing: idx % 2 === 0 ? 1 : -1 },
          1.0,
          glass ? drawWineGlass : undefined,
          glass ? "glass" : "",
        ),
      );
      blob(out, x, D0 + 0.08, z, 1.0);
    });
    return out;
  }

  // =========================================================================
  // SHOT 8: Poor Exhausted Stair-Climbers (X_APTS + 10 = -170)
  // =========================================================================
  if (id === 8) {
    const prog = (f - 360) / 39;
    for (let fl = 0; fl < 3; fl++) {
      for (let k = 0; k < 2; k++) {
        const idx = fl * 2 + k;
        const u = clamp01(0.22 + k * 0.42 + prog * 0.22);
        const dir = fl % 2 === 0 ? 1 : -1;
        const sx = X_APTS + 10.0 + dir * (u - 0.5) * 4.2;
        const sy = fl * 3.2 + u * 3.2;
        const ph = (t * 2.2 + idx * 0.3) % 1;
        out.places.push(
          personSide(
            cam,
            { i: 80 + idx, o: POOR_CLIMBERS[idx % POOR_CLIMBERS.length], okey: `poor${idx}` },
            sx,
            sy,
            0.1,
            { mode: "march", phase: q(ph, 20), expr: idx % 2 === 0 ? "pained" : "nervous", stomp: 1.3, stride: 0.85 },
            dir < 0,
            0.94,
            (p) => drawSweatDrops(p, q(ph, 12)),
            `sweat${q(ph, 12)}`,
          ),
        );
      }
    }
    return out;
  }

  // =========================================================================
  // SHOT 9: Otis in Workshop Inventing Safety Brake (X_SHOP = 90)
  // =========================================================================
  if (id === 9) {
    const hammerK = q(0.5 + 0.5 * Math.sin(t * 9), 20);
    out.places.push(
      person(
        cam,
        { i: 1, o: OTIS_OUTFIT, okey: "otisShop" },
        X_SHOP - 0.25,
        D0,
        0.25,
        { mode: "stand", expr: "proud", facing: 1, prop: ["hammer", hammerK] },
        1.04,
        (p) => drawOtisExtras(p, "normal"),
        "shop",
      ),
    );
    blob(out, X_SHOP - 0.25, D0, 0.25, 1.04);
    return out;
  }

  // =========================================================================
  // SHOT 10: Two Laughing Merchants (X_SHOP + 14 = 104)
  // =========================================================================
  if (id === 10) {
    const tilt = q(2.5 * Math.sin(t * 8), 15);
    out.places.push(
      person(
        cam,
        { i: 101, o: MERCHANT_A, okey: "merchA" },
        X_SHOP + 13.25,
        D0,
        0.2,
        { mode: "stand", expr: "laugh", facing: 1, tilt, headTilt: -3 },
        1.05,
      ),
    );
    blob(out, X_SHOP + 13.25, D0, 0.2, 1.05);
    out.places.push(
      person(
        cam,
        { i: 102, o: MERCHANT_B, okey: "merchB" },
        X_SHOP + 14.75,
        D0,
        0.2,
        { mode: "stand", expr: "laugh", facing: -1, tilt: -tilt, headTilt: 3 },
        1.05,
      ),
    );
    blob(out, X_SHOP + 14.75, D0, 0.2, 1.05);
    return out;
  }

  // =========================================================================
  // SHOT 11: Small Box Dangling on a Thin Thread (X_SHOP + 28 = 118)
  // =========================================================================
  if (id === 11) {
    const sway = Math.sin(t * 4.2) * 0.22;
    // QC fix (2026-11-14): no passenger inside the thread box — the brief is the box alone
    // dangling on its thread; the scale-0.52 figure clipped through the box on every side.
    const u = q((t * 2.0) % 1, 20);
    out.fx.push({
      key: `threadCreak_${u}`, cw: 300, ch: 300, draw: (p) => fxCreak(p, u),
      x: X_SHOP + 28 + sway * 0.5, y: 7.05, z: 0.2, w: 0.65, h: 0.65,
    });
    return out;
  }

  return out;
};
