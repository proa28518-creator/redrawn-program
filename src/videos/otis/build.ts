// Static and modular 3D geometry builders for "Otis" (1854 NY Crystal Palace & Manhattan skyline).
// Engine rules (AGY_BRIEF.md Rule 6):
//   - Primitives ONLY: BoxGeometry, CylinderGeometry (full sleeves only, NO thetaStart/thetaLength),
//     SphereGeometry, TorusGeometry, PlaneGeometry, BufferGeometry quads/tris.
//   - NO THREE.Shape / ExtrudeGeometry.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { D0, X_PALACE, X_STREET, X_APTS, X_SHOP, X_XRAY, X_BELT, X_CITY } from "./story";
import {
  brick, rng, ctex, rep, facadeHD, roofHD, stoneHD, planksHD, dirtHD, barkHD, canvasHD, asphaltHD,
} from "./paint";
import { twoTone } from "./shade";

export type Kit = Record<string, THREE.Object3D>;
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------- materials (shared, cached) ----------------
const mats = new Map<string, THREE.Material>();
export const lam = (key: string, make: () => THREE.MeshLambertMaterialParameters) => {
  let m = mats.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) {
    m = twoTone(new THREE.MeshLambertMaterial(make()));
    mats.set(key, m);
  }
  return m;
};

// ---------------- geometry primitives ----------------
const f32 = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return new THREE.Float32BufferAttribute(out, a.itemSize);
};

export const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u1 = 1, v1 = 1, u0 = 0, v0 = 0) => {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c, a, c, d].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 2, 3, 4, 5].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
  return g;
};

export const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 2].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
  return g;
};

export const boxGeo = (min: THREE.Vector3, max: THREE.Vector3, tile = 0, bottom = false) => {
  const [x0, y0, z0] = [min.x, min.y, min.z], [x1, y1, z1] = [max.x, max.y, max.z];
  const t = (a: number) => (tile ? a / tile : 1);
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const faces = [
    quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), t(w), t(h)),
    quad(V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), t(w), t(h)),
    quad(V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), t(d), t(h)),
    quad(V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), t(d), t(h)),
    quad(V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), V(x0, y1, z0), t(w), t(d)),
  ];
  if (bottom) faces.push(quad(V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), t(w), t(d)));
  return mergeGeometries(faces, false);
};

export class Batch {
  private g = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4) {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const x = new THREE.BufferGeometry();
    x.setAttribute("position", f32(src.attributes.position));
    if (src.attributes.normal) x.setAttribute("normal", f32(src.attributes.normal)); else x.computeVertexNormals();
    x.setAttribute("uv", src.attributes.uv ? f32(src.attributes.uv) : new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
    if (m) x.applyMatrix4(m);
    const l = this.g.get(mat);
    if (l) l.push(x); else this.g.set(mat, [x]);
  }
  build(parent: THREE.Object3D, cast = true) {
    for (const [mat, list] of this.g) {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
      mesh.castShadow = cast; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.g.clear();
  }
}

export type Ray = { o: THREE.Vector3; d: THREE.Vector3; len: number; core: boolean };

const UB = new THREE.BoxGeometry(1, 1, 1);
export const ub = (
  b: Batch,
  mat: THREE.Material,
  m: THREE.Matrix4,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
) =>
  b.add(
    UB,
    mat,
    m.clone().multiply(
      new THREE.Matrix4().compose(
        V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
        new THREE.Quaternion(),
        V(Math.max(0.005, x1 - x0), Math.max(0.005, y1 - y0), Math.max(0.005, z1 - z0)),
      ),
    ),
  );

// ---------------- 3D Numbers & 3D Price Tag Props (Rule 5) ----------------
// 7-segment 3D block digits built from BoxGeometry primitives
const SEG_MAP: Record<string, number[]> = {
  "0": [1, 1, 1, 0, 1, 1, 1],
  "1": [0, 0, 1, 0, 0, 1, 0],
  "2": [1, 0, 1, 1, 1, 0, 1],
  "3": [1, 0, 1, 1, 0, 1, 1],
  "4": [0, 1, 1, 1, 0, 1, 0],
  "5": [1, 1, 0, 1, 0, 1, 1],
  "6": [1, 1, 0, 1, 1, 1, 1],
};

export const addDigit3D = (
  b: Batch,
  digit: string,
  cx: number,
  cy: number,
  cz: number,
  w: number,
  h: number,
  depth: number,
  mat: THREE.Material,
) => {
  const segs = SEG_MAP[digit] ?? SEG_MAP["1"];
  const t = w * 0.24;
  const hw = w / 2, hh = h / 2, hd = depth / 2;
  const id = new THREE.Matrix4();
  if (digit === "1") {
    ub(b, mat, id, cx - t * 0.6, cx + t * 0.6, cy - hh, cy + hh, cz - hd, cz + hd);
    ub(b, mat, id, cx - hw * 0.7, cx + hw * 0.7, cy - hh, cy - hh + t, cz - hd, cz + hd);
    ub(b, mat, id, cx - hw * 0.6, cx + t * 0.5, cy + hh - t * 1.1, cy + hh, cz - hd, cz + hd);
    return;
  }
  // 0: top, 1: top-left, 2: top-right, 3: mid, 4: bot-left, 5: bot-right, 6: bot
  if (segs[0]) ub(b, mat, id, cx - hw, cx + hw, cy + hh - t, cy + hh, cz - hd, cz + hd);
  if (segs[1]) ub(b, mat, id, cx - hw, cx - hw + t, cy, cy + hh, cz - hd, cz + hd);
  if (segs[2]) ub(b, mat, id, cx + hw - t, cx + hw, cy, cy + hh, cz - hd, cz + hd);
  if (segs[3]) ub(b, mat, id, cx - hw, cx + hw, cy - t / 2, cy + t / 2, cz - hd, cz + hd);
  if (segs[4]) ub(b, mat, id, cx - hw, cx - hw + t, cy - hh, cy, cz - hd, cz + hd);
  if (segs[5]) ub(b, mat, id, cx + hw - t, cx + hw, cy - hh, cy, cz - hd, cz + hd);
  if (segs[6]) ub(b, mat, id, cx - hw, cx + hw, cy - hh, cy - hh + t, cz - hd, cz + hd);
};

export const addDollar3D = (
  b: Batch,
  cx: number,
  cy: number,
  cz: number,
  w: number,
  h: number,
  depth: number,
  mat: THREE.Material,
) => {
  // 'S' segments (0, 1, 3, 5, 6) + vertical bar through center
  addDigit3D(b, "5", cx, cy, cz, w, h, depth, mat);
  const t = w * 0.18, hh = h * 0.64, hd = depth * 0.62;
  ub(b, mat, new THREE.Matrix4(), cx - t / 2, cx + t / 2, cy - hh, cy + hh, cz - hd, cz + hd);
};

/** Build a 3D Floor Plaque with raised 3D digit (e.g. Floor 1, 2, 3) */
export const addFloorPlaque3D = (
  b: Batch,
  floorNum: string,
  cx: number,
  cy: number,
  cz: number,
  scale = 1,
  boardMat: THREE.Material,
  trimMat: THREE.Material,
  goldMat: THREE.Material,
) => {
  const id = new THREE.Matrix4();
  const pw = 0.95 * scale, ph = 1.15 * scale, pd = 0.12 * scale;
  ub(b, trimMat, id, cx - pw / 2 - 0.06 * scale, cx + pw / 2 + 0.06 * scale, cy - ph / 2 - 0.06 * scale, cy + ph / 2 + 0.06 * scale, cz - pd / 2, cz + pd / 2);
  ub(b, boardMat, id, cx - pw / 2, cx + pw / 2, cy - ph / 2, cy + ph / 2, cz - pd / 2 + 0.02 * scale, cz + pd / 2 + 0.02 * scale);
  addDigit3D(b, floorNum, cx, cy, cz + pd * 0.65, 0.52 * scale, 0.78 * scale, 0.14 * scale, goldMat);
};

/** Build a 3D Price Tag Prop with raised 3D '$' symbols (count = 1..4) */
export const addPriceTagProp3D = (
  b: Batch,
  count: number,
  cx: number,
  cy: number,
  cz: number,
  scale: number,
  boardMat: THREE.Material,
  trimMat: THREE.Material,
  goldMat: THREE.Material,
) => {
  const id = new THREE.Matrix4();
  const dw = 0.44 * scale, gap = 0.54 * scale;
  const totalW = count * gap + 0.45 * scale;
  const ph = 0.98 * scale, pd = 0.14 * scale;
  ub(b, trimMat, id, cx - totalW / 2 - 0.06 * scale, cx + totalW / 2 + 0.06 * scale, cy - ph / 2 - 0.06 * scale, cy + ph / 2 + 0.06 * scale, cz - pd / 2, cz + pd / 2);
  ub(b, boardMat, id, cx - totalW / 2, cx + totalW / 2, cy - ph / 2, cy + ph / 2, cz - pd / 2 + 0.02 * scale, cz + pd / 2 + 0.02 * scale);
  for (let i = 0; i < count; i++) {
    const dx = (i - (count - 1) / 2) * gap;
    addDollar3D(b, cx + dx, cy, cz + pd * 0.7, dw, 0.64 * scale, 0.16 * scale, goldMat);
  }
};

// ---------------- Blueprint Canvas Texture (Shot 9 Workshop) ----------------
const blueprintTex = () =>
  ctex("otisBlueprint", 512, 384, (g) => {
    g.fillStyle = "#1d4e89";
    g.fillRect(0, 0, 512, 384);
    g.strokeStyle = "rgba(180,225,255,0.22)";
    g.lineWidth = 1.5;
    for (let x = 0; x < 512; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 384); g.stroke(); }
    for (let y = 0; y < 384; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
    g.strokeStyle = "#e6f5ff";
    g.lineWidth = 4;
    g.strokeRect(20, 20, 472, 344);
    // Ratchet rails on left and right
    for (const rx of [90, 422]) {
      g.beginPath(); g.moveTo(rx, 50); g.lineTo(rx, 334); g.stroke();
      const dir = rx < 256 ? 1 : -1;
      for (let y = 70; y < 320; y += 28) {
        g.beginPath(); g.moveTo(rx, y); g.lineTo(rx + dir * 18, y + 10); g.lineTo(rx, y + 20); g.stroke();
      }
    }
    // Arched leaf spring & claws in center
    g.beginPath(); g.moveTo(130, 195); g.quadraticCurveTo(256, 130, 382, 195); g.stroke();
    g.beginPath(); g.moveTo(145, 205); g.quadraticCurveTo(256, 148, 367, 205); g.stroke();
    // Vertical rope & drawbar
    g.beginPath(); g.moveTo(256, 40); g.lineTo(256, 210); g.stroke();
    // Claw levers
    g.beginPath(); g.moveTo(256, 205); g.lineTo(106, 195); g.moveTo(256, 205); g.lineTo(406, 195); g.stroke();
  });

// ---------------- Houses & Vegetation Helpers ----------------
type Style = { wall: string; shutter: string; roof: string; timber?: boolean; brick?: boolean };
const STYLES: Style[] = [
  { wall: "#ecdab2", shutter: "#3f6fb5", roof: "#d27a62" },
  { wall: "#d8a95f", shutter: "#2f6a43", roof: "#b8644f" },
  { wall: "#c47a5c", shutter: "#2f5f6a", roof: "#8f97a8", brick: true },
  { wall: "#efdcb8", shutter: "#2f5f6a", roof: "#c9775a", timber: true },
  { wall: "#e3d2b8", shutter: "#2f6a43", roof: "#8f97a8", brick: true },
];
const roofMat = (col: string) => lam("roof" + col, () => ({ map: roofHD(col, col === "#8f97a8"), side: THREE.DoubleSide }));

export const house = (b: Batch, x: number, z: number, yaw: number, w: number, d: number, h: number, si: number, y = D0) => {
  const st = STYLES[si % STYLES.length];
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
  const front = lam(`hf${si}_${w}_${h}`, () => ({ map: facadeHD(`hf${si}_${w}_${h}`, w, h, { ...st, door: true }) }));
  const side = lam(`hs${si}_${h}`, () => ({ map: facadeHD(`hs${si}_${h}`, 8, h, st) }));
  const wall = lam("wall" + st.wall, () => ({ color: st.brick ? "#c8643f" : st.wall }));
  const hw = w / 2, hd = d / 2, rh = d * 0.35, o = 0.3;
  b.add(quad(V(-hw, 0, hd), V(hw, 0, hd), V(hw, h, hd), V(-hw, h, hd)), front, m);
  b.add(quad(V(hw, 0, -hd), V(-hw, 0, -hd), V(-hw, h, -hd), V(hw, h, -hd)), side, m);
  b.add(quad(V(-hw, 0, -hd), V(-hw, 0, hd), V(-hw, h, hd), V(-hw, h, -hd)), side, m);
  b.add(quad(V(hw, 0, hd), V(hw, 0, -hd), V(hw, h, -hd), V(hw, h, hd)), side, m);
  b.add(tri(V(-hw, h, -hd), V(-hw, h, hd), V(-hw, h + rh, 0)), wall, m);
  b.add(tri(V(hw, h, hd), V(hw, h, -hd), V(hw, h + rh, 0)), wall, m);
  const ru = (w + 2 * o) / 4, rv = Math.hypot(hd + o, rh) / 4, rm = roofMat(st.roof);
  b.add(quad(V(-hw - o, h - 0.2, hd + o), V(hw + o, h - 0.2, hd + o), V(hw + o, h + rh, 0), V(-hw - o, h + rh, 0), ru, rv), rm, m);
  b.add(quad(V(hw + o, h - 0.2, -hd - o), V(-hw - o, h - 0.2, -hd - o), V(-hw - o, h + rh, 0), V(hw + o, h + rh, 0), ru, rv), rm, m);
};

export const kitClone = (_kit: Kit, _name: string, _h: number): THREE.Object3D | null => null;
export const prop = (_b: Batch, _kit: Kit, _name: string, _x: number, _y: number, _z: number, _h: number, _yaw = 0) => {};

// ---------------- Build All Static Otis Sets ----------------
export const buildOtisSets = (root: THREE.Object3D, _kit: Kit, _sight: Ray[]) => {
  const b = new Batch();
  const id = new THREE.Matrix4();

  const M = {
    wood: lam("oWood", () => ({ map: planksHD(), color: "#c9935b" })),
    timber: lam("oTimber", () => ({ color: "#8a5e3b" })),
    timberDark: lam("oTimberDark", () => ({ color: "#5e3e24" })),
    iron: lam("oIron", () => ({ color: "#343a46" })),
    ironBlue: lam("oIronBlue", () => ({ color: "#4e6b8c" })),
    cream: lam("oCream", () => ({ color: "#efe4ce" })),
    stone: lam("oStone", () => ({ map: stoneHD("oStoneHD") })),
    brick: lam("oBrick", () => ({ map: rep(brick(), 4, 4) })),
    cobble: lam("oCobble", () => ({ map: rep(asphaltHD(), 8, 8), color: "#9c8b7a" })),
    carpet: lam("oCarpet", () => ({ color: "#a83238" })),
    gold: lam("oGold", () => ({ color: "#e5b842" })),
    plaqueDark: lam("oPlaqueDark", () => ({ color: "#1e2638" })),
    plaqueGreen: lam("oPlaqueGreen", () => ({ color: "#1f4d3a" })),
    glass: lam("oGlass", () => ({ color: "#a8d0f0" })),
    bannerRed: lam("oBannerRed", () => ({ color: "#b83b3e" })),
    bannerBlue: lam("oBannerBlue", () => ({ color: "#2e5b9a" })),
    blueprintBg: lam("oBpBg", () => ({ color: "#162644" })),
    blueprintGrid: lam("oBpGrid", () => ({ color: "#274978" })),
    xrayRail: lam("oXrayRail", () => ({ color: "#4a6688" })),
    xrayTooth: lam("oXrayTooth", () => ({ color: "#6a8ab0" })),
  };

  // =========================================================================
  // ZONE 1 (X_PALACE = 0): 1854 NY Crystal Palace Hall & 3-Story Open Tower
  // =========================================================================
  // Checkered / planked exhibition hall floor
  ub(b, M.wood, id, -34, 34, -0.2, 0.02, -30, 26);
  // Red velvet exhibition runner leading up to the tower
  ub(b, M.carpet, id, -2.6, 2.6, 0.02, 0.05, -20, 20);
  // Tower base platform pedestal
  ub(b, M.stone, id, -2.8, 2.8, 0.0, 0.32, -2.2, 2.2);

  // Brass stanchions around tower perimeter
  for (const [sx, sz] of [[-3.6, 3.2], [-1.8, 3.5], [1.8, 3.5], [3.6, 3.2], [-4.2, 0], [4.2, 0]]) {
    b.add(new THREE.CylinderGeometry(0.05, 0.07, 0.95, 10).translate(sx, 0.48, sz), M.gold);
    b.add(new THREE.SphereGeometry(0.09, 10, 8).translate(sx, 0.98, sz), M.gold);
  }

  // Crystal Palace iron-and-glass columns & multi-tier galleries around the hall
  for (const gx of [-18, -12, -7.5, 7.5, 12, 18]) {
    for (const gz of [-20, -14, -8, -2, 4, 10]) {
      if (Math.abs(gx) < 8 && gz > -4) continue; // keep front of tower completely clear for cameras
      b.add(new THREE.CylinderGeometry(0.18, 0.22, 18.0, 12).translate(gx, 9.0, gz), M.ironBlue);
      b.add(new THREE.CylinderGeometry(0.28, 0.30, 0.4, 12).translate(gx, 0.2, gz), M.cream);
    }
  }
  // Gallery horizontal floor bands at y = 4.0m (Floor 1), y = 8.0m (Floor 2), y = 12.0m (Floor 3) in background (z = -14..-8)
  for (const [fl, fy] of [[1, 4.0], [2, 8.0], [3, 12.0]] as const) {
    ub(b, M.ironBlue, id, -22, 22, fy - 0.22, fy, -15.5, -8.0);
    ub(b, M.cream, id, -22, 22, fy, fy + 0.12, -15.5, -8.0);
    // Gallery railing bar
    ub(b, M.gold, id, -22, 22, fy + 0.85, fy + 0.95, -8.15, -8.0);
    // Side wing galleries
    for (const s of [-1, 1]) {
      ub(b, M.ironBlue, id, s * 11.5, s * 20.5, fy - 0.22, fy, -8.0, 10.0);
      ub(b, M.gold, id, s * 11.5, s * 11.65, fy + 0.85, fy + 0.95, -8.0, 10.0);
    }
    // Exhibition banners hanging from the galleries
    for (const bx of [-14, -9, 9, 14]) {
      ub(b, (fl + bx) % 2 === 0 ? M.bannerRed : M.bannerBlue, id, bx - 0.55, bx + 0.55, fy - 2.3, fy - 0.2, -7.95, -7.85);
      ub(b, M.gold, id, bx - 0.62, bx + 0.62, fy - 0.22, fy - 0.12, -7.98, -7.82);
    }
  }
  // Crystal Palace vaulted glass roof trusses in background
  for (const rz of [-18, -13, -8, -3, 2]) {
    ub(b, M.ironBlue, id, -22, 22, 17.8, 18.15, rz - 0.15, rz + 0.15);
    ub(b, M.glass, id, -20, 20, 18.15, 18.25, rz - 2.2, rz + 2.2);
  }

  // ---- The Open Wooden Elevator Tower (x = 0, z = 0, y = 0..16.6m) ----
  // 4 corner timber posts
  for (const sx of [-1.85, 1.85]) {
    for (const sz of [-1.35, 1.35]) {
      ub(b, M.timber, id, sx - 0.14, sx + 0.14, 0.3, 16.5, sz - 0.14, sz + 0.14);
    }
  }
  // Tower horizontal floor rings at Floor 1 (4.0m), Floor 2 (8.0m), Floor 3 (12.0m), and Top Headframe (15.6m)
  for (const fy of [4.0, 8.0, 12.0, 15.6]) {
    // Left, right, back, and thin front tie-beam
    ub(b, M.timberDark, id, -2.0, 2.0, fy - 0.14, fy + 0.14, -1.48, -1.22);
    ub(b, M.timberDark, id, -2.0, 2.0, fy - 0.10, fy + 0.10, 1.24, 1.44);
    ub(b, M.timberDark, id, -2.0, -1.72, fy - 0.14, fy + 0.14, -1.48, 1.48);
    ub(b, M.timberDark, id, 1.72, 2.0, fy - 0.14, fy + 0.14, -1.48, 1.48);
  }
  // Back X-braces per story (only on back z = -1.35 so front view is 100% open)
  for (const y0 of [0.3, 4.0, 8.0, 12.0]) {
    const yc = y0 + 1.85;
    for (const s of [-1, 1]) {
      const m = new THREE.Matrix4().makeTranslation(0, yc, -1.35).multiply(new THREE.Matrix4().makeRotationZ(s * 0.78));
      ub(b, M.timber, m, -0.07, 0.07, -2.4, 2.4, -0.06, 0.06);
    }
  }

  // Vertical Iron Ratchet Guide Rails (x = ±1.62, z = 0) with 3D Ratchet Teeth!
  for (const sx of [-1, 1]) {
    const rx = sx * 1.66;
    ub(b, M.iron, id, rx - 0.09, rx + 0.09, 0.3, 15.6, -0.14, 0.14);
    // 3D Ratchet teeth facing inward toward the platform
    for (let ty = 0.8; ty < 15.2; ty += 0.24) {
      const tx0 = sx < 0 ? rx + 0.08 : rx - 0.19;
      const tx1 = sx < 0 ? rx + 0.19 : rx - 0.08;
      ub(b, M.iron, id, tx0, tx1, ty, ty + 0.13, -0.10, 0.10);
    }
  }

  // Top Hoist Headframe, Pulley Wheel, Chopping Block & Assistant Catwalk (y = 14.0..16.5m)
  ub(b, M.timberDark, id, -2.1, 2.1, 15.55, 15.9, -0.35, 0.35);
  // Spoked Iron Pulley Sheave at (0, 16.1, 0)
  b.add(new THREE.CylinderGeometry(0.55, 0.55, 0.16, 20).rotateX(Math.PI / 2).translate(0, 16.15, 0), M.iron);
  b.add(new THREE.CylinderGeometry(0.18, 0.18, 0.24, 12).rotateX(Math.PI / 2).translate(0, 16.15, 0), M.gold);
  // Assistant's Catwalk Deck at (1.05, 14.0, 0.1) & Chopping Block right beside the rope at (0, 14.65, 0)
  ub(b, M.wood, id, 0.35, 2.25, 13.88, 14.04, -0.75, 0.85);
  // Chopping block timber anvil where the rope gets cut at y = 14.75m
  ub(b, M.timberDark, id, -0.26, 0.28, 14.45, 14.82, -0.35, -0.04);

  // 3D Floor Number Props on the Tower ("1", "2", "3" — Rule 5, highlighted in Shot 2 Tilt Down)
  addFloorPlaque3D(b, "1", -2.35, 4.0, 1.48, 1.15, M.plaqueDark, M.cream, M.gold);
  addFloorPlaque3D(b, "2", -2.35, 8.0, 1.48, 1.15, M.plaqueDark, M.cream, M.gold);
  addFloorPlaque3D(b, "3", -2.35, 12.0, 1.48, 1.15, M.plaqueDark, M.cream, M.gold);

  // =========================================================================
  // ZONE 2 (X_STREET = -90): 1854 Street & Rickety Old Hoist Shaft (Shots 4–6)
  // =========================================================================
  ub(b, M.cobble, id, X_STREET - 24, X_STREET + 24, -0.2, 0.02, -20, 20);
  house(b, X_STREET - 10.5, -3.5, 0, 8, 7, 11.2, 2);
  house(b, X_STREET + 10.5, -3.5, 0, 8, 7, 11.2, 4);
  house(b, X_STREET - 17.5, -2.0, 0.15, 7, 6, 8.4, 1);
  house(b, X_STREET + 17.5, -2.0, -0.15, 7, 6, 8.4, 3);
  // Old Hoist Timber Shaft at X_STREET
  for (const sx of [-1.7, 1.7]) {
    for (const sz of [-1.2, 1.2]) {
      ub(b, M.timberDark, id, X_STREET + sx - 0.14, X_STREET + sx + 0.14, 0, 14.2, sz - 0.14, sz + 0.14);
    }
  }
  for (const fy of [3.5, 7.0, 10.5, 14.0]) {
    ub(b, M.timber, id, X_STREET - 1.85, X_STREET + 1.85, fy - 0.12, fy + 0.12, -1.3, -1.1);
    ub(b, M.timber, id, X_STREET - 1.85, X_STREET - 1.55, fy - 0.12, fy + 0.12, -1.3, 1.3);
    ub(b, M.timber, id, X_STREET + 1.55, X_STREET + 1.85, fy - 0.12, fy + 0.12, -1.3, 1.3);
  }
  ub(b, M.timberDark, id, X_STREET - 1.9, X_STREET + 1.9, 13.9, 14.25, -0.3, 0.3);
  b.add(new THREE.CylinderGeometry(0.48, 0.48, 0.16, 16).rotateX(Math.PI / 2).translate(X_STREET, 14.3, 0), M.iron);

  // =========================================================================
  // ZONE 3 (X_APTS = -180): Rich Ground Floor vs Poor Tall Staircase (Shots 7–8)
  // =========================================================================
  ub(b, M.cobble, id, X_APTS - 18, X_APTS + 24, -0.2, 0.02, -16, 16);
  // Grand 1854 Ground Floor Parlor Facade & Interior Cutaway (X_APTS - 8 .. X_APTS + 4)
  house(b, X_APTS - 2.0, -3.8, 0, 12, 6, 11.2, 0);
  // Red velvet carpet & marble/stone columns on the luxurious Ground Floor
  ub(b, M.carpet, id, X_APTS - 7.5, X_APTS + 3.5, 0.02, 0.08, -1.5, 3.2);
  ub(b, M.stone, id, X_APTS - 7.8, X_APTS + 3.8, 3.6, 4.1, -1.2, 1.6); // Ground floor cornice
  for (const cx of [X_APTS - 6.8, X_APTS - 3.6, X_APTS - 0.4, X_APTS + 2.8]) {
    b.add(new THREE.CylinderGeometry(0.18, 0.22, 3.6, 14).translate(cx, 1.8, 1.2), M.cream);
    ub(b, M.gold, id, cx - 0.28, cx + 0.28, 3.45, 3.65, 0.92, 1.48);
  }
  // 3D Price Tag Prop on Ground Floor (Shot 7: "الأغنياء سكنوا الدور الأرضي، بطاقة سعر")
  addPriceTagProp3D(b, 3, X_APTS - 2.0, 2.85, 1.55, 0.85, M.plaqueGreen, M.cream, M.gold);

  // Tall Steep Wooden Stairwell Cutaway at X_APTS + 10 = -170 (Shot 8: "والفقراء طلعوا السلم")
  ub(b, M.brick, id, X_APTS + 6.5, X_APTS + 13.5, 0, 15.0, -2.2, -1.6);
  for (const sx of [X_APTS + 6.6, X_APTS + 13.4]) {
    ub(b, M.timberDark, id, sx - 0.15, sx + 0.15, 0, 15.0, -1.6, 1.2);
  }
  // Zig-zagging flights of wooden stairs & landings up 4 stories (y = 0..13.5m)
  for (let fl = 0; fl < 4; fl++) {
    const yBase = fl * 3.2;
    const dir = fl % 2 === 0 ? 1 : -1;
    // Landing platform
    ub(b, M.wood, id, X_APTS + 6.7, X_APTS + 13.3, yBase - 0.12, yBase + 0.05, -1.5, 0.8);
    // 10 steps per flight
    for (let st = 0; st < 10; st++) {
      const u = (st + 0.5) / 10;
      const sx = X_APTS + 10.0 + dir * (u - 0.5) * 4.6;
      const sy = yBase + u * 3.2;
      ub(b, M.wood, id, sx - 0.28, sx + 0.28, sy - 0.12, sy, -0.9, 0.6);
    }
    // Slanted handrail beam
    const m = new THREE.Matrix4()
      .makeTranslation(X_APTS + 10.0, yBase + 1.6 + 0.75, 0.65)
      .multiply(new THREE.Matrix4().makeRotationZ(dir * 0.58));
    ub(b, M.timberDark, m, -2.8, 2.8, -0.05, 0.05, -0.05, 0.05);
    addFloorPlaque3D(b, String(fl + 1), X_APTS + 7.3, yBase + 1.2, -1.45, 0.65, M.plaqueDark, M.cream, M.gold);
  }

  // =========================================================================
  // ZONE 4 (X_SHOP = 90): Otis Workshop (90), Merchants (104), Thread Box (118)
  // =========================================================================
  ub(b, M.wood, id, X_SHOP - 12, X_SHOP + 38, -0.2, 0.02, -14, 14);
  // Shot 9 Workshop back wall, workbench, blueprint easel & prototype brake frame
  ub(b, M.brick, id, X_SHOP - 6.5, X_SHOP + 6.5, 0, 6.5, -2.8, -2.2);
  // Workbench
  ub(b, M.wood, id, X_SHOP - 3.2, X_SHOP + 3.2, 0.85, 1.0, -1.5, -0.3);
  for (const lx of [X_SHOP - 2.9, X_SHOP - 0.2, X_SHOP + 2.9]) {
    ub(b, M.timberDark, id, lx - 0.1, lx + 0.1, 0, 0.85, -1.4, -0.4);
  }
  // Prototype platform crosshead & leaf-spring on workbench
  ub(b, M.timber, id, X_SHOP - 1.2, X_SHOP + 0.8, 1.0, 1.85, -1.1, -0.5);
  ub(b, M.iron, id, X_SHOP - 0.95, X_SHOP + 0.55, 1.55, 1.68, -0.85, -0.45);
  ub(b, M.gold, id, X_SHOP - 0.28, X_SHOP - 0.12, 1.65, 2.15, -0.75, -0.55);
  // Blueprint Drawing Board on Easel at (X_SHOP + 1.85, 1.65, -0.6)
  const bpMat = lam("oBlueprintTex", () => ({ map: blueprintTex() }));
  ub(b, M.timberDark, id, X_SHOP + 1.05, X_SHOP + 2.75, 1.05, 2.35, -0.85, -0.72);
  b.add(quad(V(X_SHOP + 1.12, 1.12, -0.70), V(X_SHOP + 2.68, 1.12, -0.70), V(X_SHOP + 2.68, 2.28, -0.70), V(X_SHOP + 1.12, 2.28, -0.70)), bpMat);

  // Shot 10 Merchants backdrop at X_SHOP + 14 = 104
  house(b, X_SHOP + 14, -3.6, 0, 9, 6, 8.4, 0);

  // Shot 11 "Small Box Dangling on a Thin Thread" shaft frame at X_SHOP + 28 = 118
  ub(b, M.brick, id, X_SHOP + 24.5, X_SHOP + 31.5, 0, 10.5, -2.5, -2.0);
  ub(b, M.timberDark, id, X_SHOP + 26.0, X_SHOP + 30.0, 8.2, 8.5, -0.4, 0.4);

  // =========================================================================
  // ZONE 5 (X_XRAY = 180, y = 8): X-Ray / Cross-Section Chamber (Shots 23–29)
  // =========================================================================
  // Deep engineering blueprint chamber backdrop
  ub(b, M.blueprintBg, id, X_XRAY - 9.0, X_XRAY + 9.0, 1.0, 15.0, -2.4, -2.0);
  for (let gx = X_XRAY - 8; gx <= X_XRAY + 8; gx += 1.0) {
    ub(b, M.blueprintGrid, id, gx - 0.015, gx + 0.015, 2.0, 14.0, -1.99, -1.97);
  }
  for (let gy = 2.0; gy <= 14.0; gy += 1.0) {
    ub(b, M.blueprintGrid, id, X_XRAY - 8.0, X_XRAY + 8.0, gy - 0.015, gy + 0.015, -1.99, -1.97);
  }
  // Left & Right Vertical Ratchet Guide Rails in X-Ray Rig (x = X_XRAY ± 2.0)
  for (const sx of [-1, 1]) {
    const rx = X_XRAY + sx * 2.02;
    ub(b, M.xrayRail, id, rx - 0.14, rx + 0.14, 4.5, 11.5, -0.22, 0.22);
    // Crisp 3D Sawtooth Ratchet Teeth every 0.26m facing inward (x = X_XRAY ± 1.82)
    for (let ty = 5.2; ty < 10.8; ty += 0.26) {
      const tx0 = sx < 0 ? rx + 0.12 : rx - 0.30;
      const tx1 = sx < 0 ? rx + 0.30 : rx - 0.12;
      ub(b, M.xrayTooth, id, tx0, tx1, ty, ty + 0.15, -0.16, 0.16);
    }
  }

  // =========================================================================
  // ZONE 6 (X_BELT = 260, y = 2.5): Clean Studio Set for 3D Seatbelt Lock (Shot 30)
  // =========================================================================
  ub(b, M.cream, id, X_BELT - 8, X_BELT + 8, -0.2, 0.05, -8, 8);
  ub(b, M.stone, id, X_BELT - 7, X_BELT + 7, 0, 7.5, -2.8, -2.4);

  // =========================================================================
  // ZONE 7 (X_CITY = 340): High-Rise & Manhattan Skyscraper Grid Base (Shots 31–34)
  // =========================================================================
  ub(b, M.cobble, id, X_CITY - 45, X_CITY + 45, -0.2, 0.02, -45, 35);
  // Neighboring low-rise 1854 buildings at base of city so skyscrapers tower over them
  house(b, X_CITY - 9.5, 2.0, 0, 6, 5, 5.6, 2);
  house(b, X_CITY + 10.5, 2.0, 0, 6, 5, 5.6, 3);

  b.build(root);
};
