// Indiana Bell cast as lit flat cartoon sprites in the 3D world (house style, matching otis/cast.ts).
// Characters are yaw-only billboards shaded by cardShade(), with contact blobs on the ground.

import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, townsfolk,
  fxBurst, fxPuff, fxSplash, fxShadow, fxContact,
  Outfit, Expr, FrontOpts, SideOpts, INK,
} from "./toon";
import {
  FPS, SHOTS, clamp01, BuildingState,
  X_OFFICE, X_SWITCH, X_MEET, X_IMAGINE, X_DOOR,
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

// ---------------- Outfits (1930 Indianapolis) ----------------
/** The hero engineer: charcoal suit, brown slouch (fedora) hat, moustache, calm confidence */
export const HERO_OUTFIT: Outfit = {
  jacket: "#2b3444",
  pants: "#23262e",
  boots: INK,
  hat: "slouch",
  cap: "#4a3426",
  buttons: "#d4b26a",
  moustache: "#3a2618",
  skin: "#ffe2c2",
};

/** Sceptical senior engineers who want the building demolished */
export const SCEPTIC_A: Outfit = {
  jacket: "#4a2e2e",
  pants: "#2e2624",
  boots: INK,
  hat: "slouch",
  cap: "#2e2a26",
  buttons: "#c9b98a",
  moustache: "#57453a",
  skin: "#f5c9a0",
  build: "stout",
};
export const SCEPTIC_B: Outfit = {
  jacket: "#26343e",
  pants: "#232a30",
  boots: INK,
  hat: "tophat",
  buttons: "#d4b26a",
  skin: "#ecd0b6",
  build: "stout",
};

/** Workmen in caps and work shirts who crank the jacks and mind the rollers */
export const WORKERS: Outfit[] = [
  { jacket: "#7a5234", pants: "#3a404d", boots: "#2e241d", hat: "cap", cap: "#3b2d22", buttons: "#d4b26a", skin: "#f5c9a0" },
  { jacket: "#5d6870", pants: "#33383e", boots: "#2e241d", hat: "cap", cap: "#52463a", buttons: "#c9b98a", skin: "#ffe2c2" },
  { jacket: "#6e6254", pants: "#40382e", boots: "#2e241d", hat: "cap", cap: "#46382c", buttons: "#d4b26a", skin: "#ecd0b6" },
  { jacket: "#54604f", pants: "#2f362e", boots: "#2e241d", hat: "cap", cap: "#2e2a24", buttons: "#c9b98a", skin: "#f5c9a0" },
];

/** Switchboard operators: 1930 dresses, hair, headset drawn as an extra */
export const OPERATORS: Outfit[] = [
  { jacket: "#7a4a56", pants: "#3d3546", boots: "#2e241d", hat: "hair", hair: "#4a3426", dress: "#c25a7a", skin: "#ffe2c2" },
  { jacket: "#44586e", pants: "#3d3546", boots: "#2e241d", hat: "hair", hair: "#2e2019", dress: "#5a8fc2", skin: "#f5c9a0" },
  { jacket: "#6e5a35", pants: "#3d3546", boots: "#2e241d", hat: "hair", hair: "#6b4a2a", dress: "#d9a441", skin: "#ffe2c2" },
  { jacket: "#4a5d43", pants: "#3d3546", boots: "#2e241d", hat: "hair", hair: "#3a2618", dress: "#7a9e6a", skin: "#ecd0b6" },
];

/** Office clerks (mixed townsfolk-based) for the exchange hall */
const clerkOutfit = (i: number): Outfit => {
  const base = townsfolk(i);
  return { ...base, hat: i % 3 === 0 ? "cap" : base.hat, cap: "#3b2d22" };
};

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
/** Telephone handset held to the ear (right hand up) */
const drawPhone = (p: Pen) => {
  p.line([[385, 490], [430, 360], [415, 268]], "#2b3444", 22, true);
  p.poly([[392, 205], [438, 218], [428, 292], [384, 278]], "#1c1e24", 8);
  p.dot(411, 212, 11, "#343a46");
  p.dot(406, 284, 11, "#343a46");
};

/** Switchboard headset: band over the head, earpiece, mic boom */
const drawHeadset = (p: Pen) => {
  p.band([[212, 190], [300, 128], [388, 190]], "#1c1e24", 13, 4);
  p.dot(398, 232, 17, "#1c1e24");
  p.line([[398, 244], [368, 300], [338, 318]], "#1c1e24", 7, true);
  p.dot(334, 320, 8, "#343a46");
};

/** Coffee cup in the left hand, still full */
const drawCoffee = (p: Pen) => {
  p.line([[215, 490], [168, 420], [196, 356]], "#2b3444", 22, true);
  p.poly([[168, 318], [228, 318], [220, 372], [176, 372]], "#f4f1ea", 7);
  p.ell(198, 318, 29, 8, "#4a2c14", 3);
  p.ell(232, 345, 10, 13, "rgba(0,0,0,0)", 5);
};

/** Hero wiping the red X off the board: right arm raised high with an eraser block */
const drawWipe = (p: Pen) => {
  p.line([[385, 480], [452, 350], [470, 218]], "#2b3444", 24, true);
  p.poly([[448, 178], [496, 190], [490, 232], [442, 220]], "#efe4ce", 7);
};

/** Foreman's pointing arm (shot 1 & 15 supervision) */
const drawPoint = (p: Pen) => {
  p.line([[385, 485], [462, 428], [520, 402]], "#2b3444", 22, true);
  p.dot(524, 400, 13, "#ffe2c2");
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
export const stage = (id: number, t: number, _b: BuildingState, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1] ?? SHOTS[0];
  LNAME = s.light;
  const f = Math.round(t * FPS);

  // =========================================================================
  // SHOT 1: workmen cranking the jacks under the raised building + foreman
  // =========================================================================
  if (id === 1 || id === 15) {
    const crank = q(0.5 + 0.5 * Math.sin(t * 7), 20);
    // Kept near the camera axis (9:16 hfov is narrow) so the crew reads in frame
    const spots: [number, number, number][] = [
      [4.2, 0, 6.7], [2.2, 0, 6.0], [0.2, 0, 5.2], [5.4, 0, 5.6],
    ];
    spots.forEach(([x, y, z], idx) => {
      out.places.push(
        person(cam, { i: 10 + idx, o: WORKERS[idx % WORKERS.length], okey: `jack${idx}` },
          x, y, z, { mode: "stand", expr: "stern", facing: x < 0 ? 1 : -1, prop: ["hammer", crank] }, 1.0),
      );
      blob(out, x, y, z, 1.0);
    });
    // Foreman pointing at the rollers
    out.places.push(
      person(cam, { i: 5, o: WORKERS[1], okey: "foreman" },
        3.2, 0, 8.8, { mode: "stand", expr: "stern", facing: -1, noArms: true }, 1.02, drawPoint, "point"),
    );
    blob(out, 3.2, 0, 8.8, 1.0);
    return out;
  }

  // =========================================================================
  // SHOT 3: workmen watching the great mass creep along
  // =========================================================================
  if (id === 3) {
    [-8.2, -4.6, -1.2, 2.4, 5.8, 8.6].forEach((x, idx) => {
      out.places.push(
        person(cam, { i: 20 + idx, o: WORKERS[idx % WORKERS.length], okey: `watch${idx}` },
          x, 0, 9.2, { mode: "stand", expr: idx % 2 ? "nervous" : "neutral", facing: x < 0 ? 1 : -1 }, 1.0),
      );
      blob(out, x, 0, 9.2, 1.0);
    });
    return out;
  }

  // =========================================================================
  // SHOT 5: the exchange hall — clerks at their desks (the 600 inside)
  // =========================================================================
  if (id === 5) {
    const spots: [number, number, boolean][] = [
      [-6.5, -4.3, true], [1.5, -4.3, false], [-2.5, -0.8, true], [5.5, -0.8, false],
      [-10.5, -4.3, false], [9.5, -4.3, true], [-6.5, -0.8, false], [1.5, 2.7, true],
    ];
    spots.forEach(([dx, dz, phone], idx) => {
      out.places.push(
        person(cam, { i: 30 + idx, o: clerkOutfit(idx), okey: `clerk${idx}` },
          X_OFFICE + dx, 0.02, dz, { mode: "stand", expr: idx % 3 === 0 ? "smile" : "neutral", noArms: phone },
          0.98, phone ? drawPhone : undefined, phone ? "phone" : ""),
      );
      blob(out, X_OFFICE + dx, 0.02, dz, 0.95);
    });
    return out;
  }

  // =========================================================================
  // SHOT 6: switchboard operators in a long row, headsets on
  // =========================================================================
  if (id === 6) {
    for (let i = 0; i < 6; i++) {
      const x = X_SWITCH - 7.5 + i * 3.0;
      out.places.push(
        person(cam, { i: 40 + i, o: OPERATORS[i % OPERATORS.length], okey: `op${i}` },
          x, 0.02, -2.55, { mode: "stand", expr: i % 2 ? "smile" : "neutral", noArms: true }, 0.98, drawHeadset, "headset"),
      );
      blob(out, x, 0.02, -2.55, 0.95);
    }
    return out;
  }

  // =========================================================================
  // SHOT 7: the two demolition engineers face off
  // =========================================================================
  if (id === 7) {
    out.places.push(
      person(cam, { i: 51, o: SCEPTIC_A, okey: "sceptA" },
        X_MEET - 1.25, 0, 0.7, { mode: "stand", expr: "stern", facing: 1 }, 1.06),
    );
    blob(out, X_MEET - 1.25, 0, 0.7, 1.05);
    out.places.push(
      person(cam, { i: 52, o: SCEPTIC_B, okey: "sceptB" },
        X_MEET + 1.45, 0, 0.7, { mode: "stand", expr: "stern", facing: -1 }, 1.06),
    );
    blob(out, X_MEET + 1.45, 0, 0.7, 1.05);
    return out;
  }

  // =========================================================================
  // SHOT 8: the hero, close — wiping the red X away
  // =========================================================================
  if (id === 8) {
    out.places.push(
      person(cam, { i: 1, o: HERO_OUTFIT, okey: "hero" },
        X_MEET + 0.3, 0, -0.5, { mode: "stand", expr: "smug", noArms: true }, 1.28, drawWipe, "wipe"),
    );
    blob(out, X_MEET + 0.3, 0, -0.5, 1.25);
    return out;
  }

  // =========================================================================
  // SHOT 10: one clerk on the phone, desk clock spinning beside him
  // =========================================================================
  if (id === 10) {
    out.places.push(
      person(cam, { i: 61, o: clerkOutfit(2), okey: "clerkPhone" },
        X_OFFICE - 4.6, 0.02, 0.55, { mode: "stand", expr: "smile", noArms: true }, 1.02, drawPhone, "phone"),
    );
    blob(out, X_OFFICE - 4.6, 0.02, 0.55, 1.0);
    return out;
  }

  // =========================================================================
  // SHOT 11: the rest of the engineers burst out laughing
  // =========================================================================
  if (id === 11) {
    const spots: [number, Outfit, string][] = [
      [-2.6, SCEPTIC_A, "sceptA"], [-0.85, SCEPTIC_B, "sceptB"],
      [0.95, clerkOutfit(4), "engC"], [2.7, clerkOutfit(5), "engD"],
    ];
    spots.forEach(([dx, o, key], idx) => {
      const tilt = q(2.5 * Math.sin(t * 8 + idx * 1.3), 15);
      out.places.push(
        person(cam, { i: 70 + idx, o, okey: key },
          X_MEET + dx, 0, 0.5, { mode: "stand", expr: "laugh", facing: idx % 2 ? -1 : 1, tilt, headTilt: idx % 2 ? 3 : -3 }, 1.05),
      );
      blob(out, X_MEET + dx, 0, 0.5, 1.05);
    });
    return out;
  }

  // =========================================================================
  // SHOT 12 FX: the imagined pipe burst (2D spray over the 3D droplets)
  // =========================================================================
  if (id === 12) {
    if (f >= 762) {
      const u = q(clamp01((f - 762) / 40), 25);
      out.fx.push({
        key: `pipeBurst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, 0.2 + u * 0.4, "#bfe6ff", 12, 55, 240),
        x: X_IMAGINE - 2.2, y: 1.5, z: 3.1, w: 2.2, h: 2.2,
      });
      out.fx.push({
        key: `pipeSplash${u}`, cw: 400, ch: 300, draw: (p) => fxSplash(p, u),
        x: X_IMAGINE - 2.2, y: 0.7, z: 3.3, w: 2.6, h: 1.4,
      });
    }
    return out;
  }

  // =========================================================================
  // SHOT 13 FX: dust puffs at the cracking wall's feet
  // =========================================================================
  if (id === 13) {
    if (f >= 828) {
      const u = q(clamp01((f - 828) / 42) * 0.6, 20);
      for (const [dx, dy, sc] of [[7.6, 0.7, 1.5], [10.0, 0.6, 1.8], [12.3, 0.7, 1.4]]) {
        out.fx.push({
          key: `wallDust${u}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, u),
          x: X_IMAGINE + dx, y: dy, z: 0.2, w: sc, h: sc, soft: true,
        });
      }
    }
    return out;
  }

  // =========================================================================
  // SHOT 14: the 18 workmen in a line around the base (brief prop: counter in world)
  // =========================================================================
  if (id === 14) {
    for (let i = 0; i < 18; i++) {
      const x = -8.5 + i * 1.0;
      out.places.push(
        person(cam, { i: 80 + i, o: WORKERS[i % WORKERS.length], okey: `line${i % 4}` },
          x, 0, 7.4, { mode: "stand", expr: i % 3 === 0 ? "proud" : "stern", facing: x < 0 ? 1 : -1 }, 0.97),
      );
      blob(out, x, 0, 7.4, 0.95);
    }
    return out;
  }

  // =========================================================================
  // SHOT 18: coffee in one hand, phone in the other, world sliding past the window
  // =========================================================================
  if (id === 18) {
    out.places.push(
      person(cam, { i: 91, o: clerkOutfit(1), okey: "coffeeClerk" },
        X_OFFICE + 2.6, 0.02, -0.15, { mode: "stand", expr: "smile", noArms: true }, 1.02,
        (p) => { drawPhone(p); drawCoffee(p); }, "phoneCoffee"),
    );
    blob(out, X_OFFICE + 2.6, 0.02, -0.15, 1.0);
    out.places.push(
      person(cam, { i: 92, o: clerkOutfit(3), okey: "clerkBg1" },
        X_OFFICE - 2.5, 0.02, -0.8, { mode: "stand", expr: "neutral", noArms: true }, 0.96, drawPhone, "phone"),
    );
    blob(out, X_OFFICE - 2.5, 0.02, -0.8, 0.95);
    return out;
  }

  // =========================================================================
  // SHOT 23: staff crossing the moving entrance bridge, front-march
  // =========================================================================
  if (id === 23) {
    const walkers: [number, number, number, Outfit, string][] = [
      [-0.35, 2.45, 0.0, clerkOutfit(0), "crossA"],
      [0.3, 1.65, 0.35, OPERATORS[1], "crossB"],
      [-0.2, 0.85, 0.7, clerkOutfit(6), "crossC"],
    ];
    walkers.forEach(([dx, z, ph, o, key], idx) => {
      const phase = q((t * 1.6 + ph) % 1, 20);
      out.places.push(
        person(cam, { i: 100 + idx, o, okey: key },
          X_DOOR + dx, 0.66, z, { mode: "march", phase, expr: "smile" }, 0.97),
      );
      blob(out, X_DOOR + dx, 0.66, z, 0.95);
    });
    return out;
  }

  return out;
};
