// Static and modular 3D geometry builders for "Indiana Bell" (1930 Indianapolis).
// Engine rules (AGY_BRIEF.md Rule 6):
//   - Primitives ONLY: BoxGeometry, CylinderGeometry (full sleeves only, NO thetaStart/thetaLength),
//     SphereGeometry, TorusGeometry, PlaneGeometry, BufferGeometry quads/tris.
//   - NO THREE.Shape / ExtrudeGeometry.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { D0, X_SITE, X_PLAN, X_OFFICE, X_SWITCH, X_MEET, X_IMAGINE, X_XRAY, X_DOOR } from "./story";
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

// ---------------- 3D Numbers (Rule 5 props: counters, signs, ruler marks) ----------------
// 7-segment 3D block digits built from BoxGeometry primitives
const SEG_MAP: Record<string, number[]> = {
  "0": [1, 1, 1, 0, 1, 1, 1],
  "1": [0, 0, 1, 0, 0, 1, 0],
  "2": [1, 0, 1, 1, 1, 0, 1],
  "3": [1, 0, 1, 1, 0, 1, 1],
  "4": [0, 1, 1, 1, 0, 1, 0],
  "5": [1, 1, 0, 1, 0, 1, 1],
  "6": [1, 1, 0, 1, 1, 1, 1],
  "7": [1, 0, 1, 0, 0, 1, 0],
  "8": [1, 1, 1, 1, 1, 1, 1],
  "9": [1, 1, 1, 1, 0, 1, 1],
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

/** Lay out a multi-digit 3D number centred on cx (digits face +z) */
export const addNumber3D = (
  b: Batch,
  text: string,
  cx: number,
  cy: number,
  cz: number,
  w: number,
  h: number,
  depth: number,
  mat: THREE.Material,
  gap = 0.18,
) => {
  const step = w + gap;
  const total = text.length * step - gap;
  [...text].forEach((ch, i) => {
    addDigit3D(b, ch, cx - total / 2 + w / 2 + i * step, cy, cz, w, h, depth, mat);
  });
};

/** A dark plaque board with a raised 3D number on it (signs & counters) */
export const addNumberPlaque3D = (
  b: Batch,
  text: string,
  cx: number,
  cy: number,
  cz: number,
  digitW: number,
  digitH: number,
  boardMat: THREE.Material,
  trimMat: THREE.Material,
  digitMat: THREE.Material,
) => {
  const id = new THREE.Matrix4();
  const total = text.length * (digitW + 0.18) - 0.18;
  const pw = total + 0.55, ph = digitH + 0.5, pd = 0.12;
  ub(b, trimMat, id, cx - pw / 2 - 0.06, cx + pw / 2 + 0.06, cy - ph / 2 - 0.06, cy + ph / 2 + 0.06, cz - pd / 2, cz + pd / 2);
  ub(b, boardMat, id, cx - pw / 2, cx + pw / 2, cy - ph / 2, cy + ph / 2, cz - pd / 2 + 0.02, cz + pd / 2 + 0.02);
  addNumber3D(b, text, cx, cy, cz + pd * 0.7, digitW, digitH, 0.14, digitMat);
};

// ---------------- Blueprint canvas textures ----------------
/** Site-plan sheet for the X_PLAN table: lot, old footprint, rotated footprint, arc arrow */
export const planTex = () =>
  ctex("indianaPlan", 1024, 768, (g) => {
    g.fillStyle = "#1d4e89";
    g.fillRect(0, 0, 1024, 768);
    g.strokeStyle = "rgba(180,225,255,0.20)";
    g.lineWidth = 1.5;
    for (let x = 0; x < 1024; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 768); g.stroke(); }
    for (let y = 0; y < 768; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
    g.strokeStyle = "#e6f5ff";
    g.lineWidth = 5;
    g.strokeRect(24, 24, 976, 720);
    // Street bands
    g.lineWidth = 3;
    g.strokeRect(90, 560, 844, 90);
    g.beginPath(); g.moveTo(90, 605); g.lineTo(934, 605); g.stroke();
    // Old footprint (dashed) and rotated footprint (solid), pivot at (430, 330)
    g.save();
    g.translate(430, 330);
    g.setLineDash([14, 10]);
    g.lineWidth = 4;
    g.strokeRect(-190, -130, 380, 260);
    g.setLineDash([]);
    g.rotate(Math.PI / 2);
    g.lineWidth = 6;
    g.strokeRect(-190, -130, 380, 260);
    g.restore();
    // Window ticks on the rotated footprint
    g.save();
    g.translate(430, 330);
    g.rotate(Math.PI / 2);
    g.lineWidth = 3;
    for (let x = -160; x <= 160; x += 40) { g.beginPath(); g.moveTo(x, -130); g.lineTo(x, -104); g.stroke(); }
    g.restore();
    // Rotation arc arrow (green)
    g.strokeStyle = "#52e88a";
    g.lineWidth = 9;
    g.beginPath(); g.arc(430, 330, 300, -0.5, 1.05); g.stroke();
    const ax = 430 + 300 * Math.cos(1.05), ay = 330 + 300 * Math.sin(1.05);
    g.fillStyle = "#52e88a";
    g.beginPath(); g.moveTo(ax + 34, ay + 6); g.lineTo(ax - 16, ay - 22); g.lineTo(ax - 10, ay + 30); g.closePath(); g.fill();
    // Pivot hub
    g.beginPath(); g.arc(430, 330, 16, 0, Math.PI * 2); g.fillStyle = "#e6f5ff"; g.fill();
  });

/** Elevation sheet for the X_MEET board: 8-storey building front with floor lines */
export const elevationTex = () =>
  ctex("indianaElevation", 768, 640, (g) => {
    g.fillStyle = "#1d4e89";
    g.fillRect(0, 0, 768, 640);
    g.strokeStyle = "rgba(180,225,255,0.20)";
    g.lineWidth = 1.5;
    for (let x = 0; x < 768; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 640); g.stroke(); }
    for (let y = 0; y < 640; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(768, y); g.stroke(); }
    g.strokeStyle = "#e6f5ff";
    g.lineWidth = 5;
    g.strokeRect(18, 18, 732, 604);
    // Building elevation: 8 floors
    const bx = 234, bw = 300, by = 70, fh = 62;
    g.lineWidth = 4;
    g.strokeRect(bx, by, bw, fh * 8);
    for (let fl = 1; fl < 8; fl++) { g.beginPath(); g.moveTo(bx, by + fl * fh); g.lineTo(bx + bw, by + fl * fh); g.stroke(); }
    g.lineWidth = 2.5;
    for (let fl = 0; fl < 8; fl++) {
      for (let wx = 0; wx < 4; wx++) g.strokeRect(bx + 28 + wx * 68, by + fl * fh + 14, 40, 34);
    }
    // Roller bed under the elevation
    g.lineWidth = 4;
    for (let rx = bx + 16; rx < bx + bw; rx += 36) { g.beginPath(); g.arc(rx, by + fh * 8 + 18, 11, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(bx - 30, by + fh * 8 + 34); g.lineTo(bx + bw + 30, by + fh * 8 + 34); g.stroke();
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

// Shared material palette for the Indiana sets
export const M = {
  wood: () => lam("iWood", () => ({ map: planksHD(), color: "#c9935b" })),
  timber: () => lam("iTimber", () => ({ color: "#8a5e3b" })),
  timberDark: () => lam("iTimberDark", () => ({ color: "#5e3e24" })),
  iron: () => lam("iIron", () => ({ color: "#343a46" })),
  steel: () => lam("iSteel", () => ({ color: "#9aa7b8" })),
  cream: () => lam("iCream", () => ({ color: "#efe4ce" })),
  stone: () => lam("iStone", () => ({ map: stoneHD("iStoneHD") })),
  brickWall: () => lam("iBrick", () => ({ map: rep(brick(), 5, 5) })),
  concrete: () => lam("iConcrete", () => ({ map: rep(asphaltHD(), 10, 10), color: "#b9b2a4" })),
  gold: () => lam("iGold", () => ({ color: "#e5b842" })),
  plaqueDark: () => lam("iPlaqueDark", () => ({ color: "#1e2638" })),
  red: () => lam("iRed", () => ({ color: "#c22e2e" })),
  green: () => lam("iGreen", () => ({ color: "#2e9e5b" })),
  earth: () => lam("iEarth", () => ({ map: rep(dirtHD(), 6, 3), color: "#8a6a4a" })),
  waterPipe: () => lam("iWaterPipe", () => ({ color: "#2e6fc2" })),
  gasPipe: () => lam("iGasPipe", () => ({ color: "#e0a91c" })),
};

// ---------------- Build All Static Indiana Sets ----------------
export const buildIndianaSets = (root: THREE.Object3D, _kit: Kit, _sight: Ray[]) => {
  const b = new Batch();
  const id = new THREE.Matrix4();
  const wood = M.wood(), timber = M.timber(), timberDark = M.timberDark(), iron = M.iron(),
    steel = M.steel(), cream = M.cream(), stone = M.stone(), brickWall = M.brickWall(),
    concrete = M.concrete(), gold = M.gold(), plaqueDark = M.plaqueDark(), red = M.red(),
    earth = M.earth();

  // =========================================================================
  // ZONE 1 (X_SITE = 0): the lot, roller bed, street & 1930 Indianapolis backdrop
  // =========================================================================
  // Concrete lot slab the building travels on
  ub(b, concrete, id, -30, 34, -0.2, 0.02, -24, 24);
  // Street in front (z > 13) and sidewalk strip
  ub(b, lam("iAsphalt", () => ({ map: rep(asphaltHD(), 12, 4), color: "#7d7a74" })), id, -34, 38, -0.18, 0.0, 15.5, 30);
  ub(b, stone, id, -34, 38, -0.05, 0.06, 13.2, 15.5);
  // Period houses across the street & behind
  house(b, -17, 21.5, Math.PI, 8, 7, 9.5, 1);
  house(b, -7.5, 22.5, Math.PI, 7, 6, 8.2, 3);
  house(b, 10.5, 22.0, Math.PI, 8, 7, 10.4, 0);
  house(b, 20.5, 21.5, Math.PI, 7, 6, 8.8, 4);
  house(b, -19, -14, 0.2, 8, 7, 9.0, 2);
  house(b, 22, -15, -0.2, 8, 7, 9.6, 1);
  // Lamp posts along the sidewalk
  for (const lx of [-14, -4, 6, 16, 26]) {
    b.add(new THREE.CylinderGeometry(0.06, 0.09, 4.6, 8).translate(lx, 2.3, 14.2), iron);
    b.add(new THREE.SphereGeometry(0.22, 10, 8).translate(lx, 4.75, 14.2), cream);
  }
  // --- Roller bed under the building (footprint 13 x 9, centred on origin) ---
  // Longitudinal timber beams (along z) on a concrete plinth
  ub(b, stone, id, -7.6, 7.6, 0.02, 0.14, -5.6, 5.6);
  for (const bx of [-5.4, -2.7, 0, 2.7, 5.4]) {
    ub(b, timberDark, id, bx - 0.32, bx + 0.32, 0.14, 0.5, -5.2, 5.2);
  }
  // Steel roller cylinders (axis along x) — the hero prop of shots 2 & 17
  for (const rz of [-3.4, -1.7, 0, 1.7, 3.4]) {
    b.add(new THREE.CylinderGeometry(0.21, 0.21, 12.6, 14).rotateZ(Math.PI / 2).translate(0, 0.35, rz), steel);
  }
  // Cross timbers above the rollers that the building frame rests on
  for (let cz = -4.8; cz <= 4.8; cz += 1.2) {
    ub(b, timber, id, -6.4, 6.4, 0.56, 0.78, cz - 0.26, cz + 0.26);
  }
  // Hydraulic jack props standing around the base (bodies; handles posed in world cast layer)
  for (const [jx, jz] of [[-7.3, 3.2], [-7.3, -1.5], [7.3, 1.8], [7.3, -3.4], [-3.5, 5.9], [4.2, 5.9], [-4.6, -5.9], [3.8, -5.9]]) {
    b.add(new THREE.CylinderGeometry(0.16, 0.2, 0.62, 10).translate(jx, 0.31, jz), red);
    b.add(new THREE.CylinderGeometry(0.07, 0.07, 0.34, 8).translate(jx, 0.79, jz), steel);
  }
  // New HQ foundation plot outline beside the building (empty in shot 24, built on in 26)
  ub(b, stone, id, 15.5, 29.5, 0.02, 0.1, -6.5, 6.5);
  for (const [fx0, fx1, fz0, fz1] of [[15.5, 29.5, -6.5, -6.1], [15.5, 29.5, 6.1, 6.5], [15.5, 15.9, -6.5, 6.5], [29.1, 29.5, -6.5, 6.5]]) {
    ub(b, timberDark, id, fx0, fx1, 0.1, 0.3, fz0, fz1);
  }
  // Ground blueprint alignment line the corner must meet (shot 25): chalk strip + steel rule
  ub(b, cream, id, 4.32, 4.68, 0.03, 0.07, 2.0, 11.5);

  // =========================================================================
  // ZONE 2 (X_PLAN = -90): giant blueprint table, 1930 sign, pencils & ruler
  // =========================================================================
  // Table top is the plan sheet itself
  const planMat = lam("iPlanTex", () => ({ map: planTex() }));
  ub(b, timberDark, id, X_PLAN - 19, X_PLAN + 19, -0.55, -0.06, -13, 13);
  b.add(quad(V(X_PLAN - 18.4, 0, 12.4), V(X_PLAN + 18.4, 0, 12.4), V(X_PLAN + 18.4, 0, -12.4), V(X_PLAN - 18.4, 0, -12.4)), planMat);
  // Table legs
  for (const [lx, lz] of [[-17, -11], [17, -11], [-17, 11], [17, 11]]) {
    ub(b, timberDark, id, X_PLAN + lx - 0.5, X_PLAN + lx + 0.5, -4.5, -0.55, lz - 0.5, lz + 0.5);
  }
  // "1930" standing sign at the back-left of the table (brief prop)
  ub(b, timberDark, id, X_PLAN - 15.4, X_PLAN - 15.1, 0, 2.5, -9.4, -9.1);
  ub(b, timberDark, id, X_PLAN - 10.2, X_PLAN - 9.9, 0, 2.5, -9.4, -9.1);
  addNumberPlaque3D(b, "1930", X_PLAN - 12.65, 2.1, -9.25, 0.62, 1.05, plaqueDark, cream, gold);
  // Pencils & a steel ruler lying on the sheet
  const pencilMat = lam("iPencil", () => ({ color: "#e8a13a" }));
  for (const [px, pz, ry] of [[8.5, 6.5, 0.5], [-7.5, 8.0, -0.9], [11.5, -5.0, 1.9]]) {
    const m = new THREE.Matrix4().makeTranslation(X_PLAN + px, 0.09, pz).multiply(new THREE.Matrix4().makeRotationY(ry));
    b.add(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6).rotateZ(Math.PI / 2), pencilMat, m);
  }
  ub(b, steel, id, X_PLAN + 5.5, X_PLAN + 12.5, 0.02, 0.1, -8.2, -7.7);

  // =========================================================================
  // ZONE 3 (X_OFFICE = -180): telephone exchange hall — desks, windows, lamps
  // =========================================================================
  ub(b, wood, id, X_OFFICE - 14, X_OFFICE + 14, -0.2, 0.02, -10, 10);
  // Back wall with tall window frames (z = -9)
  ub(b, brickWall, id, X_OFFICE - 14, X_OFFICE + 14, 0, 6.4, -9.4, -9.0);
  for (const wx of [-10.5, -6, -1.5, 3, 7.5, 12]) {
    ub(b, cream, id, X_OFFICE + wx - 1.15, X_OFFICE + wx + 1.15, 1.1, 4.9, -9.05, -8.9);
    ub(b, lam("iWinGlass", () => ({ color: "#bfe0f2" })), id, X_OFFICE + wx - 0.95, X_OFFICE + wx + 0.95, 1.3, 4.7, -9.02, -8.96);
    ub(b, cream, id, X_OFFICE + wx - 0.07, X_OFFICE + wx + 0.07, 1.1, 4.9, -9.03, -8.94);
  }
  // Side walls (partial, keep the hall open to camera)
  ub(b, brickWall, id, X_OFFICE - 14.4, X_OFFICE - 14.0, 0, 6.4, -9.4, 4);
  ub(b, brickWall, id, X_OFFICE + 14.0, X_OFFICE + 14.4, 0, 6.4, -9.4, 4);
  // Front colonnade at z = 8: columns + lintel the shot-5 camera passes between
  for (const cx of [-12, -6, 0, 6, 12]) {
    b.add(new THREE.CylinderGeometry(0.32, 0.38, 6.4, 12).translate(X_OFFICE + cx, 3.2, 8), cream);
  }
  ub(b, cream, id, X_OFFICE - 14, X_OFFICE + 14, 5.9, 6.5, 7.7, 8.3);
  // Rows of desks with typewriters & telephones
  const phoneMat = lam("iPhone", () => ({ color: "#1c1e24" }));
  for (const dz of [-5.5, -2.0, 1.5]) {
    for (const dx of [-10.5, -6.5, -2.5, 1.5, 5.5, 9.5]) {
      if (dz === 1.5 && dx > 0.5 && dx < 7.5) continue; // keep the window desk bay clear
      ub(b, timber, id, X_OFFICE + dx - 1.5, X_OFFICE + dx + 1.5, 0.72, 0.86, dz - 0.7, dz + 0.7);
      ub(b, timberDark, id, X_OFFICE + dx - 1.4, X_OFFICE + dx - 1.2, 0, 0.72, dz - 0.6, dz + 0.6);
      ub(b, timberDark, id, X_OFFICE + dx + 1.2, X_OFFICE + dx + 1.4, 0, 0.72, dz - 0.6, dz + 0.6);
      // Typewriter
      ub(b, phoneMat, id, X_OFFICE + dx - 0.42, X_OFFICE + dx + 0.1, 0.86, 1.06, dz - 0.25, dz + 0.3);
      ub(b, cream, id, X_OFFICE + dx - 0.38, X_OFFICE + dx + 0.06, 1.06, 1.34, dz + 0.18, dz + 0.3);
      // Telephone
      ub(b, phoneMat, id, X_OFFICE + dx + 0.55, X_OFFICE + dx + 1.05, 0.86, 1.12, dz - 0.3, dz + 0.15);
      b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 6).rotateZ(1.25).translate(X_OFFICE + dx + 0.8, 1.22, dz - 0.08), phoneMat);
    }
  }
  // Hanging lamps
  for (const [hx, hz] of [[-8, -4], [0, -4], [8, -4], [-8, 3], [0, 3], [8, 3]]) {
    b.add(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6).translate(X_OFFICE + hx, 5.6, hz), iron);
    b.add(new THREE.CylinderGeometry(0.55, 0.16, 0.4, 12).translate(X_OFFICE + hx, 4.75, hz), M.green());
    ub(b, cream, id, X_OFFICE + hx - 0.14, X_OFFICE + hx + 0.14, 4.42, 4.58, hz - 0.14, hz + 0.14);
  }
  // Window desk bay (shots 18-19): desk under a tall interior window at z = -0.8
  ub(b, timber, id, X_OFFICE + 1.7, X_OFFICE + 4.7, 0.72, 0.86, 0.2, 1.6);
  ub(b, timberDark, id, X_OFFICE + 1.8, X_OFFICE + 2.0, 0, 0.72, 0.3, 1.5);
  ub(b, timberDark, id, X_OFFICE + 4.4, X_OFFICE + 4.6, 0, 0.72, 0.3, 1.5);
  // Window frame behind the desk + sky panel beyond (silhouette tower is dynamic)
  ub(b, cream, id, X_OFFICE + 1.15, X_OFFICE + 5.25, 0.4, 0.62, -0.95, -0.8);
  ub(b, cream, id, X_OFFICE + 1.15, X_OFFICE + 5.25, 4.3, 4.52, -0.95, -0.8);
  ub(b, cream, id, X_OFFICE + 1.15, X_OFFICE + 1.37, 0.4, 4.52, -0.95, -0.8);
  ub(b, cream, id, X_OFFICE + 5.03, X_OFFICE + 5.25, 0.4, 4.52, -0.95, -0.8);
  ub(b, cream, id, X_OFFICE + 3.09, X_OFFICE + 3.31, 0.4, 4.52, -0.95, -0.8);
  ub(b, lam("iSkyPanel", () => ({ color: "#a8cdea" })), id, X_OFFICE + 0.6, X_OFFICE + 5.8, 0.2, 4.8, -3.4, -3.25);

  // =========================================================================
  // ZONE 4 (X_SWITCH = -270): switchboard room — long panel, sockets, cords
  // =========================================================================
  ub(b, wood, id, X_SWITCH - 13, X_SWITCH + 13, -0.2, 0.02, -8, 9);
  ub(b, brickWall, id, X_SWITCH - 13, X_SWITCH + 13, 0, 6.2, -5.6, -5.2);
  // The great switchboard panel (z = -4.6 face)
  ub(b, timberDark, id, X_SWITCH - 10.5, X_SWITCH + 10.5, 0.3, 4.6, -4.85, -4.45);
  ub(b, cream, id, X_SWITCH - 10.7, X_SWITCH + 10.7, 4.6, 4.85, -4.9, -4.4);
  // Socket grid (small dark jacks) — blinking lamps are dynamic in world.ts
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 26; col++) {
      const sx = X_SWITCH - 9.8 + col * 0.78;
      const sy = 0.85 + row * 0.72;
      ub(b, phoneMat, id, sx - 0.09, sx + 0.09, sy - 0.09, sy + 0.09, -4.44, -4.36);
    }
  }
  // Hanging patch cords in front of the panel (angled thin cylinders)
  for (let cxi = 0; cxi < 9; cxi++) {
    const cx0 = X_SWITCH - 8.6 + cxi * 2.1;
    const m = new THREE.Matrix4().makeTranslation(cx0 + 0.3, 1.9, -4.1).multiply(new THREE.Matrix4().makeRotationZ(0.22));
    b.add(new THREE.CylinderGeometry(0.035, 0.035, 1.9, 6), phoneMat, m);
    b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 6).translate(cx0 + 0.52, 1.0, -4.1), gold);
  }
  // Operator stools row
  for (let sxi = 0; sxi < 6; sxi++) {
    const sx = X_SWITCH - 7.5 + sxi * 3.0;
    b.add(new THREE.CylinderGeometry(0.42, 0.42, 0.09, 12).translate(sx, 0.78, -2.6), timber);
    b.add(new THREE.CylinderGeometry(0.07, 0.09, 0.78, 8).translate(sx, 0.39, -2.6), timberDark);
  }

  // =========================================================================
  // ZONE 5 (X_MEET = 90): engineers' room — table, elevation board, wrecking ball
  // =========================================================================
  ub(b, wood, id, X_MEET - 11, X_MEET + 11, -0.2, 0.02, -8, 9);
  // Back wall segments around a window opening (wrecking ball visible through it)
  ub(b, brickWall, id, X_MEET - 11, X_MEET - 3.4, 0, 6.2, -3.4, -3.0);
  ub(b, brickWall, id, X_MEET + 3.4, X_MEET + 11, 0, 6.2, -3.4, -3.0);
  ub(b, brickWall, id, X_MEET - 3.4, X_MEET + 3.4, 4.6, 6.2, -3.4, -3.0);
  ub(b, brickWall, id, X_MEET - 3.4, X_MEET + 3.4, 0, 1.0, -3.4, -3.0);
  ub(b, cream, id, X_MEET - 3.55, X_MEET - 3.25, 1.0, 4.6, -3.45, -2.95);
  ub(b, cream, id, X_MEET + 3.25, X_MEET + 3.55, 1.0, 4.6, -3.45, -2.95);
  // Crane arm + chain + wrecking ball outside the window (static backdrop prop)
  const craneMat = lam("iCrane", () => ({ color: "#6b4a2a" }));
  const mCrane = new THREE.Matrix4().makeTranslation(X_MEET + 1.5, 6.9, -8.5).multiply(new THREE.Matrix4().makeRotationZ(0.5));
  ub(b, craneMat, mCrane, -3.4, 3.4, -0.18, 0.18, -0.18, 0.18);
  b.add(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6).translate(X_MEET + 3.1, 5.2, -8.5), iron);
  b.add(new THREE.SphereGeometry(0.85, 16, 12).translate(X_MEET + 3.1, 3.6, -8.5), iron);
  // Meeting table + chairs
  ub(b, timber, id, X_MEET - 3.4, X_MEET + 3.4, 0.78, 0.94, -0.6, 2.2);
  for (const [tx, tz] of [[-3.1, -0.3], [3.1, -0.3], [-3.1, 1.9], [3.1, 1.9]]) {
    ub(b, timberDark, id, X_MEET + tx - 0.12, X_MEET + tx + 0.12, 0, 0.78, tz - 0.12, tz + 0.12);
  }
  for (const chx of [-2.2, 0, 2.2]) {
    ub(b, timberDark, id, X_MEET + chx - 0.45, X_MEET + chx + 0.45, 0.45, 0.58, 2.75, 3.0);
    ub(b, timberDark, id, X_MEET + chx - 0.45, X_MEET + chx + 0.45, 0.58, 1.25, 2.9, 3.05);
  }
  // Elevation blueprint board on an easel, right of the table (hero's board, shot 8)
  const elevMat = lam("iElevTex", () => ({ map: elevationTex() }));
  ub(b, timberDark, id, X_MEET - 0.2, X_MEET + 3.4, 0.55, 3.3, -1.55, -1.42);
  b.add(quad(V(X_MEET - 0.12, 0.63, -1.40), V(X_MEET + 3.32, 0.63, -1.40), V(X_MEET + 3.32, 3.22, -1.40), V(X_MEET - 0.12, 3.22, -1.40)), elevMat);
  for (const [ex, ez] of [[0.1, -1.2], [3.1, -1.2]]) {
    const m = new THREE.Matrix4().makeTranslation(X_MEET + ex, 0.3, ez).multiply(new THREE.Matrix4().makeRotationX(0.35));
    ub(b, timberDark, m, -0.07, 0.07, -0.35, 0.35, -0.07, 0.07);
  }
  // Rolled plans & a model brick on the table
  b.add(new THREE.CylinderGeometry(0.11, 0.11, 2.2, 8).rotateZ(Math.PI / 2).translate(X_MEET - 1.6, 1.06, 0.6), cream);
  ub(b, brickWall, id, X_MEET + 1.7, X_MEET + 2.5, 0.94, 1.28, 0.9, 1.35);

  // =========================================================================
  // ZONE 6 (X_IMAGINE = 180): giant scale & pipes (shot 12), cracking wall (shot 13)
  // =========================================================================
  ub(b, concrete, id, X_IMAGINE - 14, X_IMAGINE + 20, -0.2, 0.02, -10, 12);
  // Scale: central pillar + top beam + chains + pans
  ub(b, stone, id, X_IMAGINE - 0.7, X_IMAGINE + 0.7, 0, 7.4, -0.7, 0.7);
  ub(b, iron, id, X_IMAGINE - 6.4, X_IMAGINE + 6.4, 6.9, 7.35, -0.3, 0.3);
  b.add(new THREE.SphereGeometry(0.34, 12, 10).translate(X_IMAGINE, 7.55, 0), gold);
  // "11000" 3D number on a hanging plaque right of the pillar (brief prop: 11,000 TON
  // scale) — offset so the central pillar never crosses the numerals
  addNumberPlaque3D(b, "11000", X_IMAGINE + 3.3, 6.62, 0.39, 0.5, 0.9, plaqueDark, cream, gold);
  for (const px of [-4.6, 4.6]) {
    for (const chOff of [-0.8, 0, 0.8]) {
      const m = new THREE.Matrix4().makeTranslation(X_IMAGINE + px + chOff * 0.4, 5.6, chOff * 0.3).multiply(new THREE.Matrix4().makeRotationZ(chOff * 0.18));
      b.add(new THREE.CylinderGeometry(0.045, 0.045, 2.6, 6), iron, m);
    }
    b.add(new THREE.CylinderGeometry(1.55, 1.1, 0.42, 16).translate(X_IMAGINE + px, 4.15, 0), iron);
  }
  // Right pan: stacked iron weight blocks
  for (let wi = 0; wi < 3; wi++) {
    ub(b, iron, id, X_IMAGINE + 3.9, X_IMAGINE + 5.3, 4.36 + wi * 0.52, 4.84 + wi * 0.52, -0.62, 0.62);
  }
  // Left pan: the pipe cluster load + ground pipe run with valve wheel
  for (let pi = 0; pi < 3; pi++) {
    b.add(new THREE.CylinderGeometry(0.3, 0.3, 2.6, 12).rotateZ(Math.PI / 2).translate(X_IMAGINE - 4.6, 4.5 + pi * 0.62, -0.5 + pi * 0.5), M.waterPipe());
  }
  for (let pi = 0; pi < 4; pi++) {
    b.add(new THREE.CylinderGeometry(0.34, 0.34, 5.2, 12).rotateZ(Math.PI / 2).translate(X_IMAGINE - 2.2, 0.36 + (pi % 2) * 0.7, 2.6 + Math.floor(pi / 2) * 0.75), pi % 2 ? M.gasPipe() : M.waterPipe());
  }
  b.add(new THREE.TorusGeometry(0.55, 0.09, 8, 20).translate(X_IMAGINE - 0.6, 1.35, 2.9), red);
  b.add(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 8).translate(X_IMAGINE - 0.6, 0.95, 2.9), iron);
  // Cracking wall (shot 13): freestanding brick wall section at x +10
  ub(b, brickWall, id, X_IMAGINE + 6.6, X_IMAGINE + 13.4, 0, 6.2, -1.3, -0.9);
  ub(b, stone, id, X_IMAGINE + 6.4, X_IMAGINE + 13.6, 6.2, 6.55, -1.45, -0.75);
  ub(b, stone, id, X_IMAGINE + 6.4, X_IMAGINE + 13.6, -0.2, 0.25, -1.45, -0.75);
  // Rubble chunks at its feet
  const rngR = rng(1930);
  for (let ri = 0; ri < 7; ri++) {
    const rx = X_IMAGINE + 7.2 + rngR() * 5.4, rz = 0.4 + rngR() * 1.6, rs = 0.22 + rngR() * 0.3;
    ub(b, brickWall, id, rx - rs, rx + rs, 0.02, 0.02 + rs * 0.8, rz - rs * 0.6, rz + rs * 0.6);
  }

  // =========================================================================
  // ZONE 7 (X_XRAY = 270): open earth pit — cross-section set (SHOTS 20-22 ONLY)
  // =========================================================================
  // Ground surface slabs around the pit opening (pit: x -8..8, z -2.5..3.5)
  ub(b, concrete, id, X_XRAY - 16, X_XRAY - 8, -0.15, 0.05, -9, 9);
  ub(b, concrete, id, X_XRAY + 8, X_XRAY + 16, -0.15, 0.05, -9, 9);
  ub(b, concrete, id, X_XRAY - 8, X_XRAY + 8, -0.15, 0.05, -9, -2.5);
  ub(b, concrete, id, X_XRAY - 8, X_XRAY + 8, -0.15, 0.05, 3.5, 9);
  // Pit walls & floor (earth)
  ub(b, earth, id, X_XRAY - 8.3, X_XRAY + 8.3, -3.6, -3.3, -2.8, 3.8);
  ub(b, earth, id, X_XRAY - 8.3, X_XRAY - 8, -3.3, 0.05, -2.8, 3.8);
  ub(b, earth, id, X_XRAY + 8, X_XRAY + 8.3, -3.3, 0.05, -2.8, 3.8);
  ub(b, earth, id, X_XRAY - 8.3, X_XRAY + 8.3, -3.3, 0.05, -3.1, -2.8);
  // Two column footings descending into the pit with roller rows beneath (shot 21 hero)
  for (const cx of [-2.4, 2.4]) {
    ub(b, stone, id, X_XRAY + cx - 0.55, X_XRAY + cx + 0.55, -1.15, 0.6, -0.55, 0.55);
    ub(b, timberDark, id, X_XRAY + cx - 1.5, X_XRAY + cx + 1.5, -1.5, -1.18, -0.8, 0.8);
    for (let rx = -1.3; rx <= 1.3; rx += 0.52) {
      b.add(new THREE.CylinderGeometry(0.17, 0.17, 1.7, 12).rotateX(Math.PI / 2).translate(X_XRAY + cx + rx, -1.68, 0), steel);
    }
    ub(b, stone, id, X_XRAY + cx - 1.6, X_XRAY + cx + 1.6, -2.0, -1.86, -0.9, 0.9);
  }
  // Utility trench guides on the pit floor
  ub(b, timberDark, id, X_XRAY - 7.5, X_XRAY + 7.5, -3.3, -3.22, -1.15, -1.05);
  ub(b, timberDark, id, X_XRAY - 7.5, X_XRAY + 7.5, -3.3, -3.22, 1.05, 1.15);

  // =========================================================================
  // ZONE 8 (X_DOOR = 360): entrance frontage, gap trench & sidewalk (shot 23)
  // =========================================================================
  // Brick frontage with a central door opening (door 1.8 wide, 2.7 high)
  ub(b, brickWall, id, X_DOOR - 6.5, X_DOOR - 0.9, 0, 7.2, -0.5, 0);
  ub(b, brickWall, id, X_DOOR + 0.9, X_DOOR + 6.5, 0, 7.2, -0.5, 0);
  ub(b, brickWall, id, X_DOOR - 0.9, X_DOOR + 0.9, 2.7, 7.2, -0.5, 0);
  ub(b, cream, id, X_DOOR - 6.7, X_DOOR + 6.7, 7.2, 7.6, -0.6, 0.1);
  // Window frames flanking the door
  for (const wx of [-3.8, 3.8]) {
    ub(b, cream, id, X_DOOR + wx - 1.0, X_DOOR + wx + 1.0, 1.2, 4.6, -0.06, 0.06);
    ub(b, lam("iWinGlass", () => ({ color: "#bfe0f2" })), id, X_DOOR + wx - 0.82, X_DOOR + wx + 0.82, 1.38, 4.42, -0.03, 0.03);
  }
  // Door leaf itself, swung open
  const mDoor = new THREE.Matrix4().makeTranslation(X_DOOR - 0.85, 0, 0.35).multiply(new THREE.Matrix4().makeRotationY(-0.7));
  ub(b, timberDark, mDoor, 0, 1.7, 0, 2.7, -0.06, 0.06);
  // Stone threshold & the gap trench the moving bridge spans (z 0.3..3.1, depth 0.55)
  ub(b, stone, id, X_DOOR - 1.6, X_DOOR + 1.6, -0.1, 0.12, -0.4, 0.3);
  ub(b, earth, id, X_DOOR - 2.2, X_DOOR + 2.2, -0.6, -0.5, 0.3, 3.1);
  ub(b, stone, id, X_DOOR - 2.2, X_DOOR - 2.0, -0.55, 0.05, 0.3, 3.1);
  ub(b, stone, id, X_DOOR + 2.0, X_DOOR + 2.2, -0.55, 0.05, 0.3, 3.1);
  // Sidewalk & street beyond
  ub(b, stone, id, X_DOOR - 9, X_DOOR + 9, -0.08, 0.05, 3.1, 6.4);
  ub(b, lam("iAsphalt", () => ({ map: rep(asphaltHD(), 12, 4), color: "#7d7a74" })), id, X_DOOR - 12, X_DOOR + 12, -0.18, -0.02, 6.4, 14);
  house(b, X_DOOR - 10.5, 11.5, Math.PI, 7, 6, 8.6, 3);
  house(b, X_DOOR + 11, 11.5, Math.PI, 7, 6, 9.2, 0);

  b.build(root);
};
