// Static scenery: merged batches (one mesh per material), box-section strands rebuilt along a path every frame
// (rails, rigging), and the storm-test ship: hull, deck, mast, billowing striped sails, rigging, wheel,
// stern cabin and the deck prop kit (barrels, coiled rope, life-rings, lanterns, oil cans, crates, portholes).
// Kept from the Abu Simbel kit: Batch / quad / tri / boxGeo, Strand, the sight-line culler, the cartoon
// vegetation + Kenney prop helpers (the CAM pass's FOREGROUND framing objects still go through kitClone).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { D0 } from "./story";
import type { V3 } from "./story";
import { rng, ctex, beam, deckNight, sailStripe, ropeTex, hullWood, lifeRingTex } from "./paint";
import { twoTone } from "./shade";

export type Kit = Record<string, THREE.Object3D>;
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------- materials (shared, cached) ----------------
const mats = new Map<string, THREE.Material>();
/** materials whose Strands are built as real interlocking chain links (MAT pass) instead of a textured box tube */
const CHAIN_MATS = new WeakSet<THREE.Material>();
export const lam = (key: string, make: () => THREE.MeshLambertMaterialParameters) => {
  let m = mats.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) {
    if (key === "chainHD") {
      // MAT pass: the chain material (world.ts) becomes slate blue-grey iron with a soft painted-metal highlight;
      // its Strands switch to link geometry, so links read in close-ups (bank f1780, overhead f1650)
      const c = twoTone(new THREE.MeshPhongMaterial({ color: "#7a8490", specular: "#6c727b", shininess: 30 }));
      CHAIN_MATS.add(c);
      m = c as unknown as THREE.MeshLambertMaterial;
    } else m = twoTone(new THREE.MeshLambertMaterial(make()));
    mats.set(key, m);
  }
  return m;
};
const lamOf = new Map<string, THREE.MeshLambertMaterial>();
// the nature kit ships a teal palette; our valley wants storybook greens and browns
const GREENS = ["#62ae4c", "#56a447", "#72b853"];
const RECOLOR: Record<string, string> = { grass: "#6aab4f", leafsDark: "#4a9142", woodBark: "#8a5a3c", woodInner: "#e8cfa4", wood: "#a8724a",
  woodDark: "#7a4f33", dirt: "#8a6a4a", stone: "#b7b4ad" };
/** Kenney GLB materials -> Lambert, so the whole world shares one lighting model */
const toLambert = (m: THREE.Material) => {
  let l = lamOf.get(m.uuid);
  if (!l) {
    const s = m as THREE.MeshStandardMaterial;
    const col = m.name === "leafsGreen" ? GREENS[lamOf.size % 3] : RECOLOR[m.name];
    l = twoTone(new THREE.MeshLambertMaterial({ color: col ? new THREE.Color(col) : s.color?.clone() ?? new THREE.Color("#ffffff"), map: s.map ?? null, side: s.side, alphaTest: s.alphaTest }));
    lamOf.set(m.uuid, l);
  }
  return l;
};

// ---------------- geometry pieces ----------------
const f32 = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return new THREE.Float32BufferAttribute(out, a.itemSize);
};
/** quad a,b,c,d counter-clockwise seen from its front; uv (u0,v0) at a, (u1,v1) at c */
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
/** axis box from min to max, texture tiled every `tile` metres (0 = one image per face) */
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

/** collects pieces by material and merges them into one static mesh per material */
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
  addObject(o: THREE.Object3D, m: THREE.Matrix4) {
    o.updateMatrixWorld(true);
    o.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!mesh.isMesh) return;
      this.add(mesh.geometry, toLambert(Array.isArray(mesh.material) ? mesh.material[0] : mesh.material), new THREE.Matrix4().multiplyMatrices(m, mesh.matrixWorld));
    });
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

// ---------------- strands: box-section tube along a path, rebuilt in place ----------------
// chain-link template (MAT pass): a stadium-shaped ring tube in link space (x along the chain, y in the ring plane,
// z across), NS centre-line samples x NR tube sides, smooth normals (clean ink silhouettes, no facet creases)
const LNS = 16, LNR = 6;
type LinkT = { p: Float32Array; n: Float32Array; idx: number[]; pitch: number };
const linkTemplate = (h: number): LinkT => {
  const ow = h * 0.85, rb = ow * 0.14, ol = ow * 1.62, rc = ow / 2 - rb, hl = ol / 2 - rb - rc;
  const p = new Float32Array(LNS * LNR * 3), n = new Float32Array(LNS * LNR * 3), idx: number[] = [];
  for (let j = 0; j < LNS; j++) {
    const th = (2 * Math.PI * (j + 0.5)) / LNS, nx = Math.cos(th), ny = Math.sin(th);
    const cx = rc * nx + Math.sign(nx) * hl, cy = rc * ny;
    for (let k = 0; k < LNR; k++) {
      const ph = (2 * Math.PI * k) / LNR, cp = Math.cos(ph), sp = Math.sin(ph), o = (j * LNR + k) * 3;
      p[o] = cx + rb * cp * nx; p[o + 1] = cy + rb * cp * ny; p[o + 2] = rb * sp;
      n[o] = cp * nx; n[o + 1] = cp * ny; n[o + 2] = sp;
      const a = j * LNR + k, b = j * LNR + ((k + 1) % LNR), c = ((j + 1) % LNS) * LNR + ((k + 1) % LNR), d = ((j + 1) % LNS) * LNR + k;
      idx.push(a, d, c, a, c, b); // outward winding
    }
  }
  return { p, n, idx, pitch: ol - 4 * rb };
};

export class Strand {
  mesh: THREE.Mesh;
  private pos: Float32Array; private nor: Float32Array; private uv: Float32Array;
  private lt: LinkT | null = null; private maxLinks = 0;
  constructor(public n: number, public w: number, public h: number, mat: THREE.Material, public tile = 1, cast = true) {
    const g = new THREE.BufferGeometry();
    if (CHAIN_MATS.has(mat)) {
      // link mode: up to maxLinks interlocking links laid along the path every frame (draw range = links used)
      const lt = (this.lt = linkTemplate(h)), nv = LNS * LNR;
      this.maxLinks = 440;
      this.pos = new Float32Array(this.maxLinks * nv * 3); this.nor = new Float32Array(this.maxLinks * nv * 3); this.uv = new Float32Array(this.maxLinks * nv * 2);
      const idx = new Uint32Array(this.maxLinks * lt.idx.length);
      for (let l = 0; l < this.maxLinks; l++) for (let i = 0; i < lt.idx.length; i++) idx[l * lt.idx.length + i] = lt.idx[i] + l * nv;
      g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(this.nor, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(this.uv, 2));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.setDrawRange(0, 0);
    } else {
      this.pos = new Float32Array(n * 12); this.nor = new Float32Array(n * 12); this.uv = new Float32Array(n * 8);
      g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(this.nor, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(this.uv, 2));
      const idx: number[] = [];
      for (let i = 0; i < n - 1; i++) for (let k = 0; k < 4; k++) {
        const a = i * 4 + k, b = i * 4 + ((k + 1) % 4), c = (i + 1) * 4 + ((k + 1) % 4), d = (i + 1) * 4 + k;
        idx.push(a, b, c, a, c, d);
      }
      g.setIndex(idx);
    }
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false; this.mesh.castShadow = cast; this.mesh.receiveShadow = true;
  }
  private T = new THREE.Vector3(); private S = new THREE.Vector3(); private N = new THREE.Vector3();
  /** link mode: links every `pitch` along the polyline, centred, alternating ring plane (vertical / horizontal) */
  private setLinks(pts: THREE.Vector3[], lt: LinkT) {
    const { T, S, N } = this, nv = LNS * LNR;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = cum[cum.length - 1], count = Math.max(0, Math.min(this.maxLinks, Math.floor(total / lt.pitch)));
    const s0 = (total - (count - 1) * lt.pitch) / 2;
    let seg = 1;
    for (let l = 0; l < count; l++) {
      const s = s0 + l * lt.pitch;
      while (seg < pts.length - 1 && cum[seg] < s) seg++;
      const a = pts[seg - 1], b = pts[seg], u = (s - cum[seg - 1]) / Math.max(1e-6, cum[seg] - cum[seg - 1]);
      const px = a.x + (b.x - a.x) * u, py = a.y + (b.y - a.y) * u, pz = a.z + (b.z - a.z) * u;
      T.subVectors(b, a).normalize();
      S.set(-T.z, 0, T.x); // T x up
      if (S.lengthSq() < 1e-6) S.set(1, 0, 0);
      S.normalize(); N.crossVectors(S, T).normalize();
      const odd = l % 2 === 1;
      // ring plane: (T, N) for even links, (T, S) for odd links; z (thickness) across it
      const yx = odd ? S.x : N.x, yy = odd ? S.y : N.y, yz = odd ? S.z : N.z;
      const zx = odd ? -N.x : S.x, zy = odd ? -N.y : S.y, zz = odd ? -N.z : S.z;
      const base = l * nv * 3;
      for (let v = 0; v < nv * 3; v += 3) {
        const x = lt.p[v], y = lt.p[v + 1], z = lt.p[v + 2], o = base + v;
        this.pos[o] = px + T.x * x + yx * y + zx * z;
        this.pos[o + 1] = py + T.y * x + yy * y + zy * z;
        this.pos[o + 2] = pz + T.z * x + yz * y + zz * z;
        const nx = lt.n[v], ny = lt.n[v + 1], nz = lt.n[v + 2];
        this.nor[o] = T.x * nx + yx * ny + zx * nz;
        this.nor[o + 1] = T.y * nx + yy * ny + zy * nz;
        this.nor[o + 2] = T.z * nx + yz * ny + zz * nz;
      }
    }
    const g = this.mesh.geometry;
    g.setDrawRange(0, count * lt.idx.length);
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
  }
  set(pts: THREE.Vector3[]) {
    if (this.lt) { this.setLinks(pts, this.lt); return; }
    const { T, S, N } = this;
    let len = 0;
    for (let i = 0; i < this.n; i++) {
      const p = pts[Math.min(i, pts.length - 1)];
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      T.subVectors(b, a).normalize();
      S.crossVectors(T, V(0, 1, 0));
      if (S.lengthSq() < 1e-6) S.set(1, 0, 0);
      S.normalize(); N.crossVectors(S, T).normalize();
      if (i) len += p.distanceTo(pts[Math.min(i - 1, pts.length - 1)]);
      for (let k = 0; k < 4; k++) {
        const sx = k === 0 || k === 3 ? -1 : 1, sy = k < 2 ? -1 : 1, j = (i * 4 + k) * 3;
        this.pos[j] = p.x + S.x * sx * this.w / 2 + N.x * sy * this.h / 2;
        this.pos[j + 1] = p.y + S.y * sx * this.w / 2 + N.y * sy * this.h / 2;
        this.pos[j + 2] = p.z + S.z * sx * this.w / 2 + N.z * sy * this.h / 2;
        const nx = S.x * sx + N.x * sy, ny = S.y * sx + N.y * sy, nz = S.z * sx + N.z * sy, nl = Math.hypot(nx, ny, nz);
        this.nor[j] = nx / nl; this.nor[j + 1] = ny / nl; this.nor[j + 2] = nz / nl;
        this.uv[(i * 4 + k) * 2] = k / 4; this.uv[(i * 4 + k) * 2 + 1] = len / this.tile;
      }
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; g.attributes.uv.needsUpdate = true;
  }
}

// ---------------- set dressing around the lens ----------------
/** a sight line of the film: from the lens toward the shot's subject, `len` along d (d has unit forward component) */
export type Ray = { o: THREE.Vector3; d: THREE.Vector3; len: number; core: boolean };
let sight: Ray[] = [];
/** does any sight line pass through this box? (centre lines only for small props, so they can still frame a shot) */
const inTheWay = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, coreOnly = false) => {
  for (const { o, d, len, core } of sight) {
    if (coreOnly && !core) continue;
    let t0 = 0, t1 = len;
    for (const [oo, dd, a, b] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
      if (Math.abs(dd) < 1e-9) { if (oo < a || oo > b) t0 = Infinity; continue; }
      const ta = (a - oo) / dd, tb = (b - oo) / dd;
      t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
    }
    if (t0 <= t1) return true;
  }
  return false;
};

// ---------------- cartoon vegetation (MAT pass) ----------------
// Kenney's faceted low-poly trees and box hedges -> rounded storybook shapes: clustered smooth spheres for canopies
// (the two-tone sun term gives each lobe a lit cap and a cool belly), tapered trunks, rounded-box hedges. Smooth
// normals mean the world ink draws clean silhouettes and lobe-to-lobe folds instead of a crease on every facet.
type VegKind = "round" | "fat" | "tall" | "cone" | "bush" | "hedge" | "palm";
const VEG: Record<string, VegKind> = {
  tree_oak: "round", tree_default: "round", tree_detailed: "round", tree_fat: "fat", "tree-high-round": "tall", tree: "tall",
  tree_cone: "cone", plant_bushLarge: "bush", plant_bushDetailed: "bush", plant_bush: "bush", hedge: "hedge", palm: "palm",
};
const LEAF = ["#5aa83c", "#4c9a37", "#69b545", "#55a243", "#3f8f3c"];
/** canopy paint (equal px per metre on a unit sphere: 256 around x 128 pole to pole): light crown, darker belly,
 *  soft leaf-clump dabs (kept low contrast: the two-tone sun term does the main modelling) */
const leafTex = (i: number) => ctex("leafHD" + i, 256, 128, (g, r) => {
  const base = new THREE.Color(LEAF[i]), top = base.clone().offsetHSL(0.012, 0.03, 0.08), bot = base.clone().offsetHSL(-0.015, 0.0, -0.08);
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, "#" + top.getHexString()); gr.addColorStop(0.42, "#" + base.getHexString()); gr.addColorStop(1, "#" + bot.getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  for (let k = 0; k < 46; k++) {
    const x = r() * 256, y = 10 + r() * 108, rad = 5 + r() * 9, light = y < 64 ? r() < 0.7 : r() < 0.25;
    for (const ox of [-256, 0, 256]) {
      g.strokeStyle = light ? "rgba(225,255,170,0.22)" : "rgba(20,70,30,0.2)"; g.lineWidth = 2.5; g.lineCap = "round";
      g.beginPath(); g.arc(x + ox, y + rad * 0.6, rad, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
  }
});
const leafMat = (i: number) => lam("leafHD" + i, () => ({ map: leafTex(i) }));
const barkMat = () => lam("barkHD", () => ({ color: "#8f5d3b" }));
const vegGeo = new Map<string, THREE.BufferGeometry>();
const lobeGeo = (q: number) => {
  const k = "lobe" + q;
  let g = vegGeo.get(k);
  if (!g) { g = new THREE.SphereGeometry(1, [20, 14, 10][q], [14, 10, 7][q]); vegGeo.set(k, g); }
  return g;
};
const trunkGeo = () => {
  let g = vegGeo.get("trunk");
  if (!g) { g = new THREE.CylinderGeometry(0.6, 1, 1, 10, 1, true).translate(0, 0.5, 0); vegGeo.set("trunk", g); }
  return g;
};
/** rounded box (exact: inner box + radius), unit size along x, smooth normals; used for hedges */
const hedgeGeo = () => {
  let g = vegGeo.get("hedge");
  if (!g) {
    g = new THREE.BoxGeometry(1, 1, 1, 18, 10, 10);
    const p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute;
    // per-axis rounding radii in unit space (~0.35 m at the ends, ~0.45 m on top / sides at 3.3 x 1.56 x 1.17 m);
    // flat bottom (it sits on the lawn)
    const R = [0.106, 0.29, 0.385], v = new THREE.Vector3(), e = new THREE.Vector3(), q = [0, 0, 0];
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      for (let a = 0; a < 3; a++) {
        const c = v.getComponent(a), lim = a === 1 && c < 0 ? 0.5 : 0.5 - R[a];
        q[a] = THREE.MathUtils.clamp(c, -lim, lim); e.setComponent(a, (c - q[a]) / R[a]);
      }
      const L = e.length();
      if (L < 1e-6) continue;
      e.divideScalar(L);
      p.setXYZ(i, q[0] + e.x * R[0], q[1] + e.y * R[1], q[2] + e.z * R[2]);
      const nn = new THREE.Vector3(e.x / R[0], e.y / R[1], e.z / R[2]).normalize();
      n.setXYZ(i, nn.x, nn.y, nn.z);
    }
    g.translate(0, 0.5, 0);
    vegGeo.set("hedge", g);
  }
  return g;
};
/** palm frond: a long plane bent down toward its tip, tapered; base at y = 0, extends +y */
const frondGeo = () => {
  let g = vegGeo.get("frond");
  if (!g) {
    g = new THREE.PlaneGeometry(0.55, 2.8, 1, 6).translate(0, 1.4, 0);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), t = y / 2.8;
      p.setZ(i, -0.85 * t * t);
      p.setX(i, p.getX(i) * (1 - 0.55 * t));
    }
    g.computeVertexNormals();
    vegGeo.set("frond", g);
  }
  return g;
};
const yawQ = (a: number) => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a);
/** half-width of a cartoon plant of kind k and height h (for the sight-line test) */
const vegRad = (k: VegKind, h: number) => (k === "palm" ? 0.32 * h : k === "hedge" ? 1.7 : k === "bush" ? 0.85 * h : k === "tall" ? 0.2 * h : k === "cone" ? 0.27 * h : k === "fat" ? 0.44 * h : 0.39 * h);
/** add one cartoon plant to a batch: base at (x, y, z), height h, q = lobe detail (0 near .. 2 far) */
const addVeg = (b: Batch, k: VegKind, x: number, y: number, z: number, h: number, seed: number, q = 0) => {
  const r = rng(Math.abs(Math.floor(seed)) % 200000 + 7), U = (a: number, c: number) => a + (c - a) * r();
  const leaf = leafMat(k === "cone" ? 4 : k === "hedge" ? 1 : Math.floor(r() * 4)), lobe = lobeGeo(q), yaw = r() * 6.28;
  const put = (px: number, py: number, pz: number, rad: number, sy = 0.9) =>
    b.add(lobe, leaf, new THREE.Matrix4().compose(V(x + px, y + py, z + pz), yawQ(r() * 6.28), V(rad, rad * sy, rad)));
  const trunk = (th: number, tr: number) =>
    b.add(trunkGeo(), barkMat(), new THREE.Matrix4().compose(V(x, y - 0.15, z), yawQ(yaw), V(tr, th + 0.15, tr)));
  const ring = (n: number, dist: number, r0: number, r1: number, cy: number, dy: number) => {
    const a0 = r() * 6.28;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i * 6.28) / n + U(-0.35, 0.35), dd = dist * U(0.85, 1.12);
      put(Math.cos(a) * dd, cy + U(-dy, dy), Math.sin(a) * dd, U(r0, r1));
    }
  };
  if (k === "round" || k === "fat") {
    const f = k === "fat";
    trunk((f ? 0.4 : 0.48) * h, 0.055 * h);
    const cy = (f ? 0.58 : 0.64) * h;
    put(0, cy, 0, (f ? 0.29 : 0.26) * h);
    ring(f ? 5 : 4, (f ? 0.22 : 0.18) * h, (f ? 0.19 : 0.17) * h, (f ? 0.23 : 0.21) * h, cy - 0.05 * h, 0.04 * h);
    put(U(-0.05, 0.05) * h, cy + (f ? 0.15 : 0.17) * h, U(-0.05, 0.05) * h, (f ? 0.19 : 0.17) * h);
  } else if (k === "tall") {
    trunk(0.34 * h, 0.045 * h);
    put(0, 0.47 * h, 0, 0.17 * h, 1.3);
    put(U(-0.03, 0.03) * h, 0.65 * h, U(-0.03, 0.03) * h, 0.15 * h, 1.3);
    put(0, 0.82 * h, 0, 0.11 * h, 1.25);
    ring(3, 0.1 * h, 0.1 * h, 0.12 * h, 0.55 * h, 0.06 * h);
  } else if (k === "cone") {
    trunk(0.2 * h, 0.05 * h);
    put(0, 0.3 * h, 0, 0.26 * h, 0.62);
    put(0, 0.5 * h, 0, 0.2 * h, 0.66);
    put(0, 0.68 * h, 0, 0.14 * h, 0.75);
    put(0, 0.84 * h, 0, 0.08 * h, 1.0);
  } else if (k === "bush") {
    put(0, 0.46 * h, 0, 0.5 * h);
    ring(3, 0.42 * h, 0.32 * h, 0.38 * h, 0.32 * h, 0.04 * h);
  } else if (k === "palm") {
    // date palm: tapered trunk, a crown of drooping fronds, young upright fronds, date clusters
    trunk(0.72 * h, 0.05 * h);
    const frondM = lam("palmFrond", () => ({ map: leafTex(2), side: THREE.DoubleSide }));
    const top = y + 0.72 * h, fs = 0.16 * h;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + r() * 0.4;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.95 + r() * 0.25, a, 0, "YXZ"));
      b.add(frondGeo(), frondM, new THREE.Matrix4().compose(V(x, top, z), q, V(fs, fs, fs)));
    }
    for (let i = 0; i < 3; i++) { // young upright fronds
      const a = r() * Math.PI * 2;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25 + r() * 0.2, a, 0, "YXZ"));
      b.add(frondGeo(), frondM, new THREE.Matrix4().compose(V(x, top + 0.1, z), q, V(fs * 0.7, fs * 0.7, fs * 0.7)));
    }
    const dateM = lam("dates", () => ({ color: "#d88a2e" }));
    for (const s of [-1, 1])
      b.add(lobeGeo(2), dateM, new THREE.Matrix4().compose(V(x + s * 0.3, top - 0.25, z), yawQ(r() * 6.28), V(0.22, 0.3, 0.22)));
  } else { // hedge segment, 3.3 m along local x
    b.add(hedgeGeo(), leaf, new THREE.Matrix4().compose(V(x, y - 0.06, z), new THREE.Quaternion(), V(3.3, h + 0.06, Math.max(0.9, h * 0.78))));
  }
};

// ---------------- painted cloth banner (MAT round 3) ----------------
// The Kenney banner is one flat face of the saturated colour atlas: in golden light it kept a uniform, hot red and
// read as pasted on. Ours is a hanging cloth with real folds (smooth normals, so the two-tone light rolls across
// them), a swallow-tail hem, a muted crimson (sat ~-25 %) with an ochre border and a diamond like the tower flags.
const BANNER_COL: Record<string, string> = { "banner-red": "#b8553a", "banner-green": "#4f8a5a" }; // warm red: no purple in shade
const FOLD = 0.27, CLOTH_W = 1.1, CLOTH_H = 2.6; // fold period across the cloth, cloth size (m)
const bannerTex = (col: string) => ctex("bannerHD" + col, 256, 700, (g) => {
  const W = 256, H = 700, base = new THREE.Color(col);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, "#" + base.clone().offsetHSL(0, 0, 0.04).getHexString()); gr.addColorStop(1, "#" + base.clone().offsetHSL(0, 0, -0.06).getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x++) { // painted fold shading, in phase with the geometry folds
    const s = Math.sin((x / W) * (CLOTH_W / FOLD) * Math.PI * 2);
    g.fillStyle = s > 0 ? `rgba(255,235,215,${0.1 * s})` : `rgba(60,15,15,${-0.12 * s})`; g.fillRect(x, 0, 1, H);
  }
  g.fillStyle = "#" + base.clone().offsetHSL(0, -0.05, -0.12).getHexString(); g.fillRect(0, 0, W, 54); // top hem
  g.strokeStyle = "#d1aa5c"; g.lineWidth = 9; g.strokeRect(20, 66, W - 40, H - 86);                 // ochre border
  g.strokeStyle = "rgba(60,30,20,0.45)"; g.lineWidth = 2; g.strokeRect(14, 60, W - 28, H - 74); g.strokeRect(26, 72, W - 52, H - 98);
  g.fillStyle = "#d1aa5c"; g.fillRect(0, 46, W, 8);
  const cx = W / 2, cy = 250; // emblem: diamond (the tower flags' motif) on a light disc
  g.fillStyle = "#efe2c2"; g.beginPath(); g.arc(cx, cy, 62, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(60,30,20,0.55)"; g.lineWidth = 3; g.stroke();
  g.fillStyle = "#d1aa5c"; g.beginPath(); g.moveTo(cx, cy - 46); g.lineTo(cx + 34, cy); g.lineTo(cx, cy + 46); g.lineTo(cx - 34, cy); g.closePath(); g.fill();
  g.strokeStyle = "rgba(60,30,20,0.6)"; g.lineWidth = 2.5; g.stroke();
});
const bannerGeo = () => {
  let geo = vegGeo.get("banner");
  if (!geo) {
    const w = CLOTH_W, hh = CLOTH_H, notch = 0.42;
    geo = new THREE.PlaneGeometry(w, hh, 16, 20).translate(0, -hh / 2, 0); // top edge at y = 0
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), t = -y / hh; // 0 top .. 1 bottom
      p.setY(i, y + notch * (1 - Math.abs(x) / (w / 2)) * t * t);                              // swallow-tail hem
      p.setZ(i, (0.025 + 0.055 * t) * Math.sin((x / FOLD) * Math.PI * 2 + 0.6) + 0.04 * t * t); // folds deepen downwards
    }
    geo.computeVertexNormals();
    vegGeo.set("banner", geo);
  }
  return geo;
};
/** gonfalon on a pole where the Kenney banner plate stood: its plate hung 0.4 x scale beside the placement point,
 *  facing local +-x, so the pole goes there (same framing) and the cloth faces that way */
const bannerProp = (b: Batch, name: string, x0: number, y: number, z0: number, h: number, yaw0: number) => {
  const off = 0.4 * (h / 0.84), x = x0 + Math.cos(yaw0) * off, z = z0 - Math.sin(yaw0) * off, yaw = yaw0 + Math.PI / 2;
  if (inTheWay(x - 0.7, x + 0.7, y, y + h, z - 0.7, z + 0.7, true)) return;
  const col = BANNER_COL[name] ?? "#b4524b";
  const M = (px: number, py: number, pz: number) => new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z).multiply(new THREE.Matrix4().makeTranslation(px, py, pz));
  const pole = lam("bannerPole", () => ({ color: "#6e4b33" })), gold = lam("bannerGold", () => ({ color: "#c9a24e" }));
  b.add(new THREE.CylinderGeometry(0.045, 0.06, h, 10).translate(0, h / 2, 0), pole, M(0, 0, 0));
  b.add(new THREE.SphereGeometry(0.1, 14, 10), gold, M(0, h + 0.06, 0));
  b.add(new THREE.CylinderGeometry(0.03, 0.03, CLOTH_W + 0.2, 8).rotateZ(Math.PI / 2), pole, M(0, h - 0.18, 0.06));
  for (const s of [-1, 1]) b.add(new THREE.SphereGeometry(0.045, 10, 8), gold, M(s * (CLOTH_W / 2 + 0.12), h - 0.18, 0.06));
  b.add(bannerGeo(), lam("bannerHD" + col, () => ({ map: bannerTex(col), side: THREE.DoubleSide })), M(0, h - 0.2, 0.1));
};

// ---------------- Kenney props ----------------
const boxes = new Map<THREE.Object3D, THREE.Box3>();
/** place a Kenney model with its base on y, scaled to height h (left out when it would stand in front of the lens).
 *  Trees, bushes and hedges are drawn as cartoon vegetation, banners as painted cloth instead (MAT pass). */
export const prop = (b: Batch, kit: Kit, name: string, x: number, y: number, z: number, h: number, yaw = 0) => {
  if (name.startsWith("banner")) { bannerProp(b, name, x, y, z, h, yaw); return; }
  const vk = VEG[name];
  if (vk) {
    const rad = vegRad(vk, h);
    if (inTheWay(x - rad, x + rad, y, y + h, z - rad, z + rad, true)) return;
    const d = Math.hypot(x, z);
    addVeg(b, vk, x, y, z, h, x * 92.7 + z * 31.3 + yaw * 1000, d > 200 ? 2 : Math.abs(z) > 45 && d > 60 ? 1 : 0);
    return;
  }
  const o = kit[name];
  if (!o) return;
  let box = boxes.get(o);
  if (!box) { box = new THREE.Box3().setFromObject(o); boxes.set(o, box); }
  const s = h / Math.max(0.01, box.max.y - box.min.y), r = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * s * 0.5;
  if (inTheWay(x - r, x + r, y, y + h, z - r, z + r, true)) return;
  b.addObject(o, new THREE.Matrix4().compose(V(x, y - box.min.y * s, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(s, s, s)));
};

/** a Kenney model as its own object (two-tone materials), base at y = 0, scaled to height h (no sight-line test:
 *  used for the CAM agent's FOREGROUND framing objects, which are meant to stand in front of the lens) */
const MIN_READABLE = 0.1; // (item 10) smallest height (m) a kit piece is ever built at — below this a piece is under ~30 px at the program's camera distances and unreadable as a distinct piece
export const kitClone = (kit: Kit, name: string, h: number): THREE.Object3D | null => {
  if (h < MIN_READABLE) { console.warn(`[kitClone] WARNING: "${name}" requested height ${h} m is below the readable minimum ${MIN_READABLE} m — clamped to ${MIN_READABLE} m.`); h = MIN_READABLE; }
  // ---- storm foreground props (PASS 2): the spec's prop-kit contract (story.ts FOREGROUND) names five kits
  // that kitClone never built — "wave_crest" / "rope_coil" / "barrel" / "rail" / "life_ring" are neither
  // Kenney GLBs nor VEG kinds, so kitClone returned null for EVERY foreground entry and world.ts skipped
  // them all (`if (!o) continue`). No foreground prop ever rendered in v1 — the empty wides and the
  // missing near crests were this bug, not the camera plan. Each branch below builds its prop from
  // geometry (no kit dependency), base at y = 0, scaled so its height is h, and marks userData.noMute
  // so world.ts's grey-green foliage mute does not recolour it. ----
  if (name === "wave_crest" || name === "rope_coil" || name === "barrel" || name === "rail" || name === "life_ring") {
    const g = new THREE.Group();
    const crestM = () => lam("stormCrest", () => ({ color: "#4a5a8a" })); // PASS 2 (corrected after
    // the v2 still): was #7e93cc — a pale periwinkle that read as a white wall from the camera's
    // angle. A mid slate-blue reads as moonlit water; only the foam cap stays near-white.
    const foamM = () => lam("stormFoam", () => ({ color: "#e8eeff" }));
    if (name === "wave_crest") {
      // a breaking-wave ridge: a half-pipe dome (axis along X, flat side down) + a white foam cap
      // hugging its top. Natural size 2.5 long x 0.5 high (aspect 5:1); scaled uniformly to height h.
      // v4 (defect 5): the crown was a straight line — the half-cylinder's top edge read as a slab/wedge
      // in the S6 wide (f654). The dome now carries 8 length segments and a wobbled crown (incommensurate
      // sines, strongest at the crown, zero at the flat base) plus foam lumps on top, so the top silhouette
      // breaks like a wave crest. Body stays slate-blue #4a5a8a, foam near-white (v2 correction kept);
      // footprint, position, yaw and scale are untouched, so S6 framing is unchanged.
      const dome = new THREE.CylinderGeometry(0.5, 0.5, 2.5, 16, 8, true, 0, Math.PI);
      dome.rotateZ(Math.PI / 2); // axis Y -> X; the theta 0..PI half lands dome-up (y >= 0)
      // wobble the crown line: axial sines, faded to 0 at the flat base (y = 0) so the dome's footprint
      // and the crest's screen position never move — only the top edge breaks. Peak ~0.11 local.
      const dp = dome.attributes.position as THREE.BufferAttribute;
      const wob = (x: number) => 0.055 * Math.sin(3.1 * x + 0.7) + 0.035 * Math.sin(5.3 * x + 2.0) + 0.02 * Math.sin(8.7 * x + 4.1);
      for (let i = 0; i < dp.count; i++) {
        const x = dp.getX(i), y = dp.getY(i);
        const k = THREE.MathUtils.clamp(y / 0.5, 0, 1); // 0 at the flat base, 1 at the crown
        dp.setY(i, y + k * wob(x));
        dp.setZ(i, dp.getZ(i) + k * 0.4 * wob(x + 1.7));
      }
      dome.computeVertexNormals();
      const ridge = new THREE.Mesh(dome, crestM());
      ridge.castShadow = false; ridge.receiveShadow = true;
      const cap = new THREE.Mesh(dome.clone(), foamM());
      cap.scale.set(1, 0.5, 0.8); cap.position.set(0, 0.28, 0.05);
      cap.castShadow = false; cap.receiveShadow = true;
      g.add(ridge, cap);
      // foam lumps on the crown: a broken profile, not a smooth cap (v4 defect 5). Deterministic sizes
      // from the axial position so the crest is identical every render; embedded ~30% into the dome
      // so no gap opens at the seam. Spaced with gaps between them so the silhouette reads notched.
      for (const lx of [-0.95, -0.32, 0.32, 0.95]) {
        const s = 0.15 + 0.04 * Math.sin(lx * 4.7 + 0.9);
        const lump = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), foamM());
        lump.scale.set(1.25, 0.62, 1.05);
        lump.position.set(lx, 0.5 + wob(lx) * 0.85, 0.02);
        lump.castShadow = false; lump.receiveShadow = true;
        g.add(lump);
      }
      g.scale.setScalar(h / 0.5);
    } else if (name === "rope_coil") {
      for (const [rad, y] of [[0.5, 0.06], [0.42, 0.16], [0.33, 0.26]] as const) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.085, 8, 22).rotateX(Math.PI / 2), ropeM());
        t.position.y = y; t.castShadow = false; t.receiveShadow = true; g.add(t);
      }
      g.scale.setScalar(h / 0.35);
    } else if (name === "barrel") {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.42, 0.95, 14).translate(0, 0.475, 0), woodM());
      body.castShadow = false; body.receiveShadow = true; g.add(body);
      for (const hy of [0.2, 0.75]) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.025, 8, 20).rotateX(Math.PI / 2).translate(0, hy, 0), ironM());
        hoop.castShadow = false; g.add(hoop);
      }
      g.scale.setScalar(h / 0.95);
    } else if (name === "rail") {
      // a 4 m deck-edge rail segment running along Z (the plan verifies it as the x = 4 rail line):
      // 3 posts + top + mid bars. Natural height 1.1 m.
      for (const z of [-1.5, 0, 1.5]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.1, 0.09), woodDarkM());
        post.position.set(0, 0.55, z); post.castShadow = false; post.receiveShadow = true; g.add(post);
      }
      for (const y of [1.1, 0.6]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 4), woodDarkM());
        bar.position.set(0, y, 0); bar.castShadow = false; bar.receiveShadow = true; g.add(bar);
      }
      g.scale.setScalar(h / 1.1);
    } else { // life_ring: vertical ring facing +Z, off-white with muted-red segments
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.12, 10, 24), lifeRingM());
      ring.castShadow = false; ring.receiveShadow = true; g.add(ring);
      g.scale.setScalar(h / 1.14);
    }
    g.userData.noMute = true;
    return g;
  }
  const vk = VEG[name];
  if (vk) { // cartoon plant as its own object (MAT pass), base at y = 0
    const vb = new Batch(), grp = new THREE.Group();
    addVeg(vb, vk, 0, 0, 0, h, name.length * 977 + h * 131, 0);
    vb.build(grp, false);
    grp.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = true; } });
    return grp;
  }
  const o = kit[name];
  if (!o) return null;
  let box = boxes.get(o);
  if (!box) { box = new THREE.Box3().setFromObject(o); boxes.set(o, box); }
  const c = o.clone(true), s = h / Math.max(0.01, box.max.y - box.min.y);
  c.traverse((x) => {
    const m = x as THREE.Mesh;
    if (m.isMesh) { m.material = toLambert(Array.isArray(m.material) ? m.material[0] : m.material); m.castShadow = false; m.receiveShadow = true; }
  });
  const g = new THREE.Group();
  c.position.y = -box.min.y * s; c.scale.setScalar(s);
  g.add(c);
  return g;
};

// ---------------- storm ship (world pass, targets 16-18) ----------------
// One scene, one ship at the origin, built in LOCAL coords: long axis along X (bow +X, stern -X), deck top
// at D0, waterline at y = -1.6. world.ts rotates the ship group +90 deg about Y (+1 m z) so the ship lies
// on the story.ts Z axis (bow -Z, stern +Z); the starboard side, striped sails and pour rail face the
// +z cameras. STORM anchors below are WORLD-frame values (after that rotation) and match story.ts.
const UB = new THREE.BoxGeometry(1, 1, 1);
const ub = (b: Batch, mat: THREE.Material, m: THREE.Matrix4, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
  b.add(UB, mat, m.clone().multiply(new THREE.Matrix4().compose(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), new THREE.Quaternion(), V(x1 - x0, y1 - y0, z1 - z0))));
const IDENTITY = new THREE.Matrix4();
/** box-section spar between two world points (masts, yards, bowsprit, stem post) */
const spar = (b: Batch, mat: THREE.Material, a: THREE.Vector3, c: THREE.Vector3, th: number) => {
  const len = a.distanceTo(c);
  const mm = new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), c.clone().sub(a).normalize()), V(1, 1, 1));
  b.add(new THREE.BoxGeometry(th, len, th), mat, mm);
};
/** billowing sail: bilinear quad a (bottom, mast side) -> b (bottom, far side) -> c (top, far) -> d (top, mast),
 *  bowed toward +z (the camera side) by `bulge`. c == d gives a triangular (jib) sail. */
const billowQuad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, bulge: number, nu = 12, nv = 8) => {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv;
    const p = new THREE.Vector3()
      .addScaledVector(a, (1 - u) * (1 - v)).addScaledVector(b, u * (1 - v))
      .addScaledVector(c, u * v).addScaledVector(d, (1 - u) * v);
    p.z += bulge * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
    pos.push(p.x, p.y, p.z); uv.push(u, v);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const r0 = j * (nu + 1) + i, r1 = r0 + nu + 1;
    idx.push(r0, r1, r0 + 1, r0 + 1, r1, r1 + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};

const hullM = () => lam("stormHull", () => ({ map: hullWood() }));
const deckM = () => lam("stormDeck", () => ({ map: deckNight() }));
const woodM = () => lam("stormWood", () => ({ map: beam() }));
const woodDarkM = () => lam("stormWoodDark", () => ({ color: "#4a3220" }));
const sailM = () => lam("stormSail", () => ({ map: sailStripe(), side: THREE.DoubleSide }));
const ropeM = () => lam("stormRope", () => ({ map: ropeTex() }));
const brassM = () => lam("stormBrass", () => ({ color: "#b08a3e" }));
const ironM = () => lam("stormIron", () => ({ color: "#3a3f4a" }));
/** ochre sheer wale (PASS 2): a muted gold-ochre rubbing strake — the one warm line on the hull,
 *  it catches the moon and traces the sheer + bow taper so the hull stops reading as a flat grey wall. */
const ochreM = () => lam("stormOchre", () => ({ color: "#b08a3e" }));
const redM = () => lam("stormRed", () => ({ color: "#a83a30" }));
const glassDarkM = () => lam("stormGlass", () => ({ color: "#0e1420" }));
const lifeRingM = () => lam("stormLifeRing", () => ({ map: lifeRingTex() }));
/** lantern glass: HDR amber (2.6, 1.5, 0.55) so it reads over the bloom threshold 1.0 (target 16).
 *  Plain MeshBasicMaterial (unlit, NOT twoTone) so the value survives to the bloom pass. */
const lanternGlassM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.5, 0.55) });

/** The cook's HELD oil can (v3, target 2 — 2.5D rule): the can the cook holds in S2 and pours from
 *  in S4 is a real 3D toon-shaded mesh (Lambert + twoTone via lam()), NOT the flat pen drawing on
 *  his character card (toon.ts draws it as "oilcan" / ["pour", k] — the CHAR pass must drop that
 *  card prop when this mesh lands, or the stills will show two cans). Group origin = can centre,
 *  spout along +x (outboard, toward the rail / pour stream); world.ts tilts it about Z (spout
 *  dips down as he pours) and yaws it slightly. Body + spout carry a BackSide dark shell so the
 *  ink outline reads even where the world ink pass has no silhouette (the can is small at 2-6 m).
 *  Body 0.30 x 0.42 x 0.20 m, spout 0.36 m — the same size as the deck oil cans, so it reads as
 *  the same object he picked up. */
export const buildHeldOilCan = (): THREE.Group => {
  const g = new THREE.Group();
  const inkM = new THREE.MeshBasicMaterial({ color: "#0b0a0c", side: THREE.BackSide });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.2), redM());
  body.castShadow = false; body.receiveShadow = true;
  const bodyInk = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.2), inkM);
  bodyInk.scale.setScalar(1.07); // concentric shell: body is centred on the group origin
  // spout: angled cylinder from the top-front corner, tip toward +x and up (same pose as the deck cans)
  const spoutGeo = new THREE.CylinderGeometry(0.028, 0.045, 0.36, 10);
  spoutGeo.rotateZ(-0.7); spoutGeo.translate(0.24, 0.44, 0);
  const spout = new THREE.Mesh(spoutGeo, ironM());
  spout.castShadow = false; spout.receiveShadow = true;
  // spout ink shell: a concentric thicker cylinder with the SAME transform (a mesh scale about the
  // group origin would shift it off-axis, so the shell is built thicker instead of scaled)
  const spoutInkGeo = new THREE.CylinderGeometry(0.036, 0.054, 0.37, 10);
  spoutInkGeo.rotateZ(-0.7); spoutInkGeo.translate(0.24, 0.44, 0);
  const spoutInk = new THREE.Mesh(spoutInkGeo, inkM);
  // handle bar across the top + brass filler cap beside it
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.04), ironM());
  handle.position.set(0, 0.25, 0); handle.castShadow = false;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10), brassM());
  cap.position.set(-0.08, 0.235, 0); cap.castShadow = false;
  g.add(body, bodyInk, spout, spoutInk, handle, cap);
  g.userData.noMute = true;
  return g;
};

/** Ship anchors — the single source of truth for the CAM / CHAR passes (world frame, after the
 *  +90 deg Y rotation applied in world.ts; they match story.ts anchors exactly).
 *  Deck top is y = D0 = 0 everywhere (flat deck, no steps); waterline y = -1.6. */
export const STORM = {
  shipX: 0, deckY: D0, waterY: -1.6,
  bowX: 13, sternX: -13, beam: 4.5,
  mastX: 2.5, mastH: 15,
  wheel: [0, 0, 10.5] as V3,         // ship's wheel (stern); captain stands just aft of it
  cook: [3.2, 0, 2] as V3,           // cook's deck mark, by the starboard rail
  pour: [4, 0, 2] as V3,             // rail point the oil is poured over (starboard, camera side)
  mocker: [0.5, 0, 4] as V3,          // laughing sailor's mark (S3 close-up foreground)
  captain: [0, 0, 10] as V3,          // captain stands aft of the wheel, facing the bow (-z)
  lanterns: [[4, 2.3, 8], [-4, 2.3, -7], [-1.8, 2.5, 11.9]] as V3[], // lantern glass positions (PASS 2:
  // the cabin hanging lantern moved from [1.8, 2.5, 11.9] (starboard, 2.3 m from the S2c lens) to the
  // port side [-1.8, 2.5, 11.9]; the deck pool under it moves with it)
  sheen: [7, -1.35, 2] as V3,         // centre of the golden oil-sheen plane on the water
};
// (Item 5, Layla's office report 2026-11-13: the six *_PT exports that lived here were dead duplicates
// of story.ts anchors — WHEEL_PT drifted ([0,0,10.5] vs story [0,1.1,10.5]). Deleted; story.ts is the
// single source. Nothing in build.ts used them; nothing imported them.)

/** The ship, built into its own group under root (returned so a later pass can move it as one).
 *  Structural set (hull, deck, mast, sails, rigging, wheel, cabin, rails) is never sight-culled;
 *  loose props are dropped only when they sit on a shot's centre sight line (faces stay clear). */
export const buildStormShip = (root: THREE.Object3D, kit: Kit, rays: Ray[] = []) => {
  const b = new Batch(), r = rng(77);
  sight = rays;
  const ship = new THREE.Group();
  const hull = hullM(), deck = deckM(), wood = woodM(), woodDark = woodDarkM(), sail = sailM(), rope = ropeM();
  const brass = brassM(), iron = ironM(), red = redM(), glassDark = glassDarkM(), lifeRing = lifeRingM();
  const place = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, fn: () => void) => {
    if (!inTheWay(x0, x1, y0, y1, z0, z1, true)) fn();
  };

  // ---- hull: open-top box sides (no top face — the deck quad is the top), bow taper, stem post ----
  b.add(quad(V(-13, -3.4, 4.5), V(13, -3.4, 4.5), V(13, 0, 4.5), V(-13, 0, 4.5), 6.5, 1.7), hull); // starboard
  b.add(quad(V(13, -3.4, -4.5), V(-13, -3.4, -4.5), V(-13, 0, -4.5), V(13, 0, -4.5), 6.5, 1.7), hull); // port
  b.add(quad(V(-13, -3.4, -4.5), V(-13, -3.4, 4.5), V(-13, 0, 4.5), V(-13, 0, -4.5), 2.25, 1.7), hull); // transom
  b.add(quad(V(13, -3.4, 4.5), V(16.5, -2.6, 0), V(16.5, 0.15, 0), V(13, 0.15, 4.5), 1.2, 1.7), hull); // bow starboard
  b.add(quad(V(13, 0.15, -4.5), V(16.5, 0.15, 0), V(16.5, -2.6, 0), V(13, -3.4, -4.5), 1.2, 1.7), hull); // bow port
  b.add(tri(V(13, 0.15, -4.5), V(13, 0.15, 4.5), V(16.5, 0.15, 0)), deck); // bow deck
  spar(b, woodDark, V(16.5, -2.6, 0), V(16.5, 0.7, 0), 0.18); // stem post
  spar(b, wood, V(14.5, 0.6, 0), V(19.5, 2.8, 0), 0.16); // bowsprit
  // ---- hull relief (PASS 2): the v1 hull was a featureless grey wall — a proud ochre wale + a lower
  // strake + vertical ribs break the flat sides, and diagonal battens trace the bow taper so the bow
  // reads from the camera (starboard) side. All proud of the hull face (z = +/-4.5) by 0.08-0.16 m. ----
  const ochre = ochreM();
  ub(b, ochre, IDENTITY, -13, 13, -0.55, -0.2, 4.5, 4.66); // sheer wale, starboard
  ub(b, ochre, IDENTITY, -13, 13, -0.55, -0.2, -4.66, -4.5); // sheer wale, port
  ub(b, woodDark, IDENTITY, -13, 13, -1.95, -1.65, 4.5, 4.6); // lower strake, starboard
  ub(b, woodDark, IDENTITY, -13, 13, -1.95, -1.65, -4.6, -4.5); // lower strake, port
  for (const x of [-10, -5, 0, 5, 10]) { // vertical ribs, both sides
    ub(b, woodDark, IDENTITY, x - 0.09, x + 0.09, -3.2, 0, 4.5, 4.58);
    ub(b, woodDark, IDENTITY, x - 0.09, x + 0.09, -3.2, 0, -4.58, -4.5);
  }
  spar(b, ochre, V(13, -0.35, 4.5), V(16.2, -0.2, 0), 0.14); // bow taper batten, starboard
  spar(b, ochre, V(13, -0.35, -4.5), V(16.2, -0.2, 0), 0.14); // bow taper batten, port
  // gunwale cap strips
  ub(b, woodDark, IDENTITY, -13, 13, 0, 0.12, 4.38, 4.62);
  ub(b, woodDark, IDENTITY, -13, 13, 0, 0.12, -4.62, -4.38);
  ub(b, woodDark, IDENTITY, -13.12, -12.88, 0, 0.12, -4.5, 4.5);

  // ---- deck top (dark wet planks) ----
  b.add(quad(V(-13, 0.02, 4.5), V(13, 0.02, 4.5), V(13, 0.02, -4.5), V(-13, 0.02, -4.5), 13, 4.5), deck);

  // ---- rails: stanchions + two Strand rails per side (top + mid), stern rail, bow taper rails ----
  for (let x = -12; x <= 12.01; x += 2.2) for (const z of [-4.32, 4.32])
    ub(b, woodDark, IDENTITY, x - 0.045, x + 0.045, 0.1, 1.1, z - 0.045, z + 0.045);
  for (let z = -4; z <= 4.01; z += 2) ub(b, woodDark, IDENTITY, -12.95, -12.85, 0.1, 1.1, z - 0.045, z + 0.045);
  const railRun = (z: number, y: number, th: number) => {
    const pts = [V(-13, y, z), V(-6, y, z), V(0, y, z), V(6, y, z), V(13, y, z), V(14.6, y + 0.12, z * 0.5), V(16.2, y + 0.18, 0)];
    const s = new Strand(pts.length, th, th, woodDark, 1);
    s.set(pts); ship.add(s.mesh);
  };
  railRun(4.32, 1.12, 0.09); railRun(-4.32, 1.12, 0.09);
  railRun(4.32, 0.62, 0.06); railRun(-4.32, 0.62, 0.06);
  const sternRail = new Strand(3, 0.09, 0.09, woodDark, 1);
  sternRail.set([V(-13, 1.12, -4.32), V(-13, 1.12, 0), V(-13, 1.12, 4.32)]); ship.add(sternRail.mesh);

  // ---- mast, yards, crow's nest, pennant ----
  const MX = STORM.mastX;
  b.add(new THREE.CylinderGeometry(0.16, 0.26, 15, 10).translate(0, 7.5, 0), wood, new THREE.Matrix4().makeTranslation(MX, 0, 0));
  b.add(new THREE.CylinderGeometry(0.07, 0.12, 4, 8).translate(0, 2, 0), wood, new THREE.Matrix4().makeTranslation(MX, 14, 0));
  for (const [y, len] of [[12.8, 8], [9.5, 6.5]] as const)
    b.add(new THREE.CylinderGeometry(0.09, 0.09, len, 8).rotateX(Math.PI / 2), wood, new THREE.Matrix4().makeTranslation(MX, y, 0));
  b.add(new THREE.CylinderGeometry(0.55, 0.5, 0.5, 12).translate(0, 0.25, 0), woodDark, new THREE.Matrix4().makeTranslation(MX, 10.6, 0));
  b.add(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 12).translate(0, 0.04, 0), woodDark, new THREE.Matrix4().makeTranslation(MX, 10.35, 0));
  b.add(tri(V(MX, 17.8, 0.06), V(MX, 16.4, 0.06), V(MX + 1.5, 17.1, 0.06)),
    lam("stormPennant", () => ({ color: "#a83a30", side: THREE.DoubleSide })));

  // ---- sails: billowing gaff mainsail (aft of the mast) + triangular jib (forward), red-white stripes ----
  // PASS 2: bulge 1.1 -> 2.0 (mainsail) / 0.7 -> 1.3 (jib) — the v1 curve was invisible from the S2c low
  // angle looking up the mast; the belly must read from below. Bowed toward +z (the camera side). ----
  spar(b, wood, V(MX, 3.6, 0), V(-6.5, 3.2, 0), 0.14); // boom
  spar(b, wood, V(MX, 12.5, 0), V(-6.5, 9.5, 0), 0.12); // gaff
  b.add(billowQuad(V(MX, 3.7, 0), V(-6.5, 3.3, 0), V(-6.5, 9.4, 0), V(MX, 12.4, 0), 2.0), sail);
  b.add(billowQuad(V(MX, 3.4, 0), V(12.5, 1.2, 0), V(MX, 14.3, 0), V(MX, 14.3, 0), 1.3), sail);

  // ---- rigging: forestay, backstay, shrouds, mainsheets — ropes crossing the frame diagonally ----
  const ropeRun = (pts: THREE.Vector3[]) => {
    const s = new Strand(pts.length, 0.05, 0.05, rope, 2);
    s.set(pts); ship.add(s.mesh);
  };
  ropeRun([V(MX, 15, 0), V(9, 8, 0), V(15.5, 0.6, 0)]); // forestay (sags via the mid point)
  ropeRun([V(MX, 15, 0), V(-5, 8, 0), V(-13, 1.2, 0)]); // backstay
  for (const z of [-4.3, 4.3]) {
    ropeRun([V(MX, 13.5, 0), V(MX - 1, 7, z * 0.5), V(0.5, 1.1, z)]);
    ropeRun([V(MX, 13.5, 0), V(MX + 1, 7, z * 0.5), V(4.5, 1.1, z)]);
  }
  ropeRun([V(MX, 9.5, 0), V(-4, 5, 1.8), V(-10, 1.1, 3.5)]); // mainsheets
  ropeRun([V(MX, 9.5, 0), V(-4, 5, -1.8), V(-10, 1.1, -3.5)]);

  // ---- ship's wheel at the stern (yawed 0.6 so its face reads 3/4 from the +z cameras) ----
  ub(b, woodDark, IDENTITY, -9.85, -9.15, 0, 1.0, -0.3, 0.3); // pedestal
  const WM = new THREE.Matrix4().makeRotationY(0.6).setPosition(-9.5, 1.5, 0);
  b.add(new THREE.TorusGeometry(0.85, 0.07, 10, 28).rotateY(Math.PI / 2), wood, WM);
  for (let k = 0; k < 8; k++)
    b.add(new THREE.CylinderGeometry(0.045, 0.045, 1.9, 8).rotateX((k * Math.PI) / 4), wood, WM);
  b.add(new THREE.CylinderGeometry(0.12, 0.12, 0.25, 10).rotateZ(Math.PI / 2), woodDark, WM);

  // ---- stern cabin: backdrop behind the wheel, door + portholes on its +x face ----
  b.add(boxGeo(V(-13, 0, -3), V(-10.3, 2.4, 3), 2), wood);
  b.add(boxGeo(V(-13.2, 2.4, -3.2), V(-10.1, 2.55, 3.2), 2), woodDark);
  b.add(quad(V(-10.28, 0.1, 0.55), V(-10.28, 0.1, -0.55), V(-10.28, 1.9, -0.55), V(-10.28, 1.9, 0.55)), glassDark); // door recess
  ub(b, woodDark, IDENTITY, -10.32, -10.24, 0.1, 1.9, -0.62, -0.55);
  ub(b, woodDark, IDENTITY, -10.32, -10.24, 0.1, 1.9, 0.55, 0.62);
  ub(b, woodDark, IDENTITY, -10.32, -10.24, 1.9, 2.02, -0.62, 0.62);
  for (const z of [-1.6, 1.6]) {
    const pm = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(-10.28, 1.5, z);
    b.add(new THREE.TorusGeometry(0.32, 0.06, 8, 20), brass, pm);
    b.add(new THREE.CircleGeometry(0.26, 20), glassDark, pm);
  }

  // ---- hull portholes on both sides (brass ring + dark glass, real geometry, above the waterline) ----
  for (const x of [-6, 0, 6]) for (const s of [1, -1]) {
    const pm = s > 0 ? new THREE.Matrix4().makeTranslation(x, -0.8, 4.52)
      : new THREE.Matrix4().makeRotationY(Math.PI).setPosition(x, -0.8, -4.52);
    b.add(new THREE.TorusGeometry(0.32, 0.06, 8, 20), brass, pm);
    b.add(new THREE.CircleGeometry(0.26, 20), glassDark, pm);
  }

  // ---- deck prop kit (loose props: sight-culled, never on a centre sight line) ----
  const barrel = (x: number, z: number, yaw: number) => {
    const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, D0, z);
    b.add(new THREE.CylinderGeometry(0.46, 0.42, 0.95, 14).translate(0, 0.475, 0), wood, m);
    for (const hy of [0.2, 0.75]) b.add(new THREE.TorusGeometry(0.46, 0.025, 8, 20).rotateX(Math.PI / 2).translate(0, hy, 0), iron, m);
  };
  const coil = (x: number, z: number) => {
    const m = new THREE.Matrix4().makeTranslation(x, D0, z);
    for (const [rad, y] of [[0.5, 0.06], [0.42, 0.16], [0.33, 0.26]] as const)
      b.add(new THREE.TorusGeometry(rad, 0.085, 8, 22).rotateX(Math.PI / 2).translate(0, y, 0), rope, m);
  };
  const lantern = (x: number, y: number, z: number) => {
    const m = new THREE.Matrix4().makeTranslation(x, y, z);
    b.add(new THREE.BoxGeometry(0.26, 0.04, 0.26).translate(0, 0.02, 0), iron, m); // base plate
    b.add(new THREE.BoxGeometry(0.26, 0.04, 0.26).translate(0, 0.32, 0), iron, m); // top plate
    b.add(new THREE.BoxGeometry(0.18, 0.26, 0.18).translate(0, 0.17, 0), lanternGlassM, m); // HDR glass
    for (const sx of [-0.11, 0.11]) for (const sz of [-0.11, 0.11])
      b.add(new THREE.BoxGeometry(0.03, 0.3, 0.03).translate(sx, 0.17, sz), iron, m); // corner posts
    b.add(new THREE.ConeGeometry(0.18, 0.12, 4).translate(0, 0.4, 0).rotateY(Math.PI / 4), iron, m); // cap
  };
  const oilCan = (x: number, z: number, yaw: number) => {
    const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, D0, z);
    b.add(new THREE.BoxGeometry(0.3, 0.42, 0.2).translate(0, 0.21, 0), red, m);
    b.add(new THREE.CylinderGeometry(0.03, 0.045, 0.35, 8).rotateZ(-0.7).translate(0.22, 0.45, 0), iron, m); // spout
    b.add(new THREE.BoxGeometry(0.2, 0.04, 0.04).translate(0, 0.46, 0), iron, m); // handle
  };
  place(6.9, 8.1, 0, 1, -3.8, -2.6, () => barrel(7.5, -3.2, r() * 0.6));
  place(-6.6, -5.4, 0, 1, 2.8, 4.0, () => barrel(-6, 3.4, r() * 0.6));
  place(9.4, 10.6, 0, 1, 2.4, 3.6, () => barrel(10, 3.0, r() * 0.6));
  place(3.9, 5.1, 0, 0.4, 3.0, 4.2, () => coil(4.5, 3.6));
  place(-4.6, -3.4, 0, 0.4, -4.1, -2.9, () => coil(-4, -3.5));
  place(-0.6, 0.6, 0.8, 1.9, 3.8, 5.0, () => { // life-ring on the starboard rail
    b.add(new THREE.TorusGeometry(0.45, 0.12, 10, 24), lifeRing, new THREE.Matrix4().makeTranslation(0, 1.35, 4.42));
  });
  place(-10.9, -9.9, 1.0, 2.2, -0.6, 0.6, () => { // life-ring on the cabin face
    b.add(new THREE.TorusGeometry(0.45, 0.12, 10, 24), lifeRing,
      new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(-10.28, 1.6, 0));
  });
  place(-7.6, -6.4, 0, 2.7, 3.4, 4.6, () => { // lantern post, starboard aft
    b.add(new THREE.CylinderGeometry(0.06, 0.08, 2.3, 8).translate(0, 1.15, 0), iron, new THREE.Matrix4().makeTranslation(-7, 0, 4.0));
    lantern(-7, 2.3, 4.0);
  });
  place(7.4, 8.6, 0, 2.7, -4.6, -3.4, () => { // lantern post, port forward
    b.add(new THREE.CylinderGeometry(0.06, 0.08, 2.3, 8).translate(0, 1.15, 0), iron, new THREE.Matrix4().makeTranslation(8, 0, -4.0));
    lantern(8, 2.3, -4.0);
  });
  place(-11.0, -9.8, 2.0, 3.0, -2.4, -1.2, () => { // hanging lantern on the cabin, PORT side (PASS 2:
    // the starboard one hung 2.3 m from the S2c lens and filled the right third of f150 as a grey panel;
    // the port side is behind every S2 lens path — verified by projection through camAt())
    spar(b, iron, V(-10.3, 2.9, -1.8), V(-10.9, 2.9, -1.8), 0.05);
    lantern(-10.9, 2.5, -1.8);
  });
  place(-1.6, -0.4, 0, 0.5, 2.6, 3.8, () => oilCan(-2.3, 3.2, 0.4)); // the cook's oil can, by his mark — v4: moved 1.3 m aft so it stays out of the S5b macro frame (was -1.0, world (3.2,0,2.0), intruding at the macro left edge)
  place(-4.1, -2.9, 0, 0.5, 3.2, 4.4, () => oilCan(-3.5, 3.8, -0.3));
  place(-3.1, -1.9, 0, 1.0, -4.2, -3.0, () => { // crate + small crate on top
    const m = new THREE.Matrix4().makeRotationY(0.2).setPosition(-2.5, D0, -3.6);
    b.add(boxGeo(V(-0.45, 0, -0.45), V(0.45, 0.9, 0.45), 1), wood, m);
    b.add(boxGeo(V(-0.3, 0.9, -0.3), V(0.3, 1.4, 0.3), 1), woodDark,
      new THREE.Matrix4().makeRotationY(-0.15).setPosition(-2.5, D0, -3.6));
  });
  place(8.9, 10.1, 0, 1.0, -3.4, -2.2, () => {
    b.add(boxGeo(V(-0.45, 0, -0.45), V(0.45, 0.9, 0.45), 1), wood,
      new THREE.Matrix4().makeRotationY(-0.4).setPosition(9.5, D0, -2.8));
  });
  place(2.4, 3.6, 0, 0.4, -4.4, -3.2, () => { // bucket
    b.add(new THREE.CylinderGeometry(0.2, 0.16, 0.35, 12).translate(0, 0.175, 0), woodDark, new THREE.Matrix4().makeTranslation(3, D0, -3.8));
  });
  place(-2.2, 0.2, 0, 1.0, -3.3, -1.7, () => { // companionway hatch + sloped lid
    b.add(boxGeo(V(-1.1, 0, -0.7), V(1.1, 0.9, 0.7), 1), wood, new THREE.Matrix4().makeTranslation(-1, D0, -2.5));
    const lid = new THREE.Matrix4().compose(V(-1, 0.95, -2.5), new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -0.4), V(1, 1, 1));
    b.add(new THREE.BoxGeometry(2.3, 0.08, 0.8), woodDark, lid);
  });
  place(11.9, 13.1, -1.2, 0.1, 3.9, 5.1, () => { // anchor hung on the bow, starboard
    const m = new THREE.Matrix4().makeTranslation(12.5, -0.1, 4.55);
    b.add(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8).translate(0, -0.65, 0), iron, m);
    b.add(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8).rotateX(Math.PI / 2).translate(0, -0.1, 0), iron, m);
    for (const s of [-1, 1])
      b.add(new THREE.ConeGeometry(0.09, 0.3, 8).rotateZ(s * 0.5).translate(s * 0.25, -1.35, 0), iron, m);
  });

  void kit; // no Kenney props on the ship herself; kitClone() still serves the CAM pass's FOREGROUND objects
  b.build(ship);
  root.add(ship);
  sight = [];
  return ship;
};
