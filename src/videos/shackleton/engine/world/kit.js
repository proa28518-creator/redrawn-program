// World kit: ground, paths, buildings and props built from simple shapes with painted textures.
// Rules baked in: closed, overlapping geometry (no cracks the sky can shine through), world-space UVs
// so seams keep a constant size, every solid object registers a collider for the camera guard.
import * as THREE from "three";
import { mat, glow, signMat } from "./shade.js";
import { shadeHex } from "../core/util.js";

// ---------- geometry helpers ----------
// Re-map UVs of any geometry to world units (planar projection on the dominant normal axis).
export function worldUV(geo, scale = 1) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / scale; uv[i * 2 + 1] = v / scale;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}

export function makeWorld(scene, rand) {
  const W = {
    scene, rand, colliders: [], pending: [], props: [],
    add(obj, { collide = true, name = obj.name || "prop", parent = scene, kind = "prop", foreground = false } = {}) {
      obj.traverse((o) => { if (o.isMesh) { o.castShadow = o.userData.noShadow ? false : true; o.receiveShadow = true; } });
      parent.add(obj);
      if (collide) {
        obj.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(obj);
        W.colliders.push({ name, box, obj, kind, foreground });
      }
      W.props.push(obj);
      return obj;
    },
  };
  return W;
}

function mesh(geo, material, { x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, ink } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  if (ink) m.userData.ink = ink;
  return m;
}
export const box = (w, h, d, material, opt = {}) =>
  mesh(worldUV(new THREE.BoxGeometry(w, h, d), opt.uv || 1), material, opt);
export const cyl = (rt, rb, h, material, opt = {}) =>
  mesh(worldUV(new THREE.CylinderGeometry(rt, rb, h, opt.seg || 14), opt.uv || 1), material, opt);
export const ball = (r, material, opt = {}) =>
  mesh(new THREE.IcosahedronGeometry(r, opt.detail ?? 2), material, opt);

// ---------- ground and paths ----------
export function ground(W, { kind = "grass", color = "#79a84a", size = 400, uv = 4, y = 0 } = {}) {
  const g = mesh(worldUV(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), uv), mat(kind, { color, seed: 11 }), { y, ink: "ground" });
  g.userData.noShadow = true;
  return W.add(g, { collide: false, name: "ground" });
}
// flat strip from a to b ([x,z]) on the ground: roads, paths, carpets
export function path(W, a, b, { width = 3, kind = "stone", color = "#b9a68a", uv = 2, y = 0.02 } = {}) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
  const geo = new THREE.PlaneGeometry(width, len).rotateX(-Math.PI / 2);
  const m = mesh(worldUV(geo, uv), mat(kind, { color, seed: 21 }), { x: (a[0] + b[0]) / 2, y, z: (a[1] + b[1]) / 2, ry: Math.atan2(dx, dz), ink: "ground" });
  m.userData.noShadow = true;
  return W.add(m, { collide: false, name: "path" });
}
export function water(W, { x = 0, z = 0, w = 40, d = 20, color = "#3f8fc9", y = -0.15 } = {}) {
  const m = mesh(worldUV(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), 3), mat("water", { color, seed: 5 }), { x, y, z, ink: "ground" });
  m.userData.noShadow = true;
  return W.add(m, { collide: false, name: "water" });
}
// low rolling hills far away for depth (soft silhouettes in the fog)
export function hills(W, { count = 7, dist = 140, color = "#6f9a52", seed = 3 } = {}) {
  const r = W.rand.fork(seed);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + r() * 0.4, R = dist * (0.9 + r() * 0.5);
    const h = ball(30 + r() * 30, mat("grass", { color: shadeHex(color, (r() - 0.5) * 0.2), seed: 30 + i }), { x: Math.sin(a) * R, y: -18, z: Math.cos(a) * R, detail: 3 });
    h.scale.y = 0.45 + r() * 0.25;
    W.add(h, { collide: false, name: "hill" });
  }
}

// ---------- buildings ----------
// house({ x, z, ry, w, d, h, wall, wallColor, roof, roofColor, trim, door, windows, chimney, sign })
export function house(W, o = {}) {
  const r = W.rand.fork(Math.round((o.x || 0) * 13 + (o.z || 0) * 7));
  const w = o.w ?? 6, d = o.d ?? 5, h = o.h ?? 4.2, rise = o.rise ?? w * 0.32, over = 0.35;
  const g = new THREE.Group();
  g.name = o.name || "house";
  const wallM = mat(o.wall || "plaster", { color: o.wallColor || "#e9d3ad", seed: r.int(1, 999) });
  const roofM = mat(o.roof || "tiles", { color: o.roofColor || "#b5523c", seed: r.int(1, 999) });
  const trimM = mat("wood", { color: o.trim || "#5b3b2a", seed: 3 });
  const darkM = mat("flat", { color: "#3b2a26", seed: 4 });
  const fasciaM = mat("flat", { color: shadeHex(o.roofColor || "#b5523c", -0.55), seed: 5 });
  // walls (one closed box) + gable prism; the gable overlaps the wall top by 5 cm so no crack can open
  g.add(box(w, h, d, wallM, { y: h / 2 }));
  const gable = new THREE.Shape([new THREE.Vector2(-w / 2, -0.05), new THREE.Vector2(w / 2, -0.05), new THREE.Vector2(0, rise)]);
  const gGeo = new THREE.ExtrudeGeometry(gable, { depth: d, bevelEnabled: false }).translate(0, h, -d / 2);
  g.add(mesh(worldUV(gGeo, 1), wallM));
  // plinth + cornice
  g.add(box(w + 0.12, 0.45, d + 0.12, mat("stone", { color: "#9c9286", seed: 8, count: 10 }), { y: 0.22 }));
  g.add(box(w + 0.16, 0.16, d + 0.16, trimM, { y: h - 0.02 }));
  // roof: two thick slabs that pass through each other at the ridge and hang over the walls
  const slope = Math.atan2(rise, w / 2), half = Math.hypot(w / 2, rise) + over, th = 0.18;
  for (const s of [-1, 1]) {
    // slab runs from 12 cm past the ridge down over the eave; its underside lies on the gable slope
    const L = half + 0.12;
    // thin faces of the slab get a dark fascia colour: a lit 18 cm edge would alias into bright dots
    const slab = box(L, th, d + over * 2, roofM, { uv: 1.4 });
    slab.material = [fasciaM, fasciaM, roofM, roofM, fasciaM, fasciaM];
    const dir = [s * Math.cos(slope), -Math.sin(slope)], nrm = [s * Math.sin(slope), Math.cos(slope)];
    const k = L / 2 - 0.12;
    slab.position.set(dir[0] * k + nrm[0] * th / 2, h + rise + dir[1] * k + nrm[1] * th / 2, 0);
    slab.rotation.z = -s * slope;
    g.add(slab);
  }
  g.add(box(0.3, 0.22, d + over * 2 + 0.05, mat("flat", { color: shadeHex(o.roofColor || "#b5523c", -0.3) }), { y: h + rise + 0.1 }));
  // door with frame and step
  const door = o.door ?? { x: 0, color: "#5a3424" };
  if (door) {
    const dx = door.x ?? 0;
    g.add(box(1.25, 2.25, 0.14, trimM, { x: dx, y: 1.17, z: d / 2 + 0.04 }));
    g.add(box(1.0, 2.05, 0.1, mat("planks", { color: door.color || "#6b3d2a", seed: 6, count: 5 }), { x: dx, y: 1.1, z: d / 2 + 0.1 }));
    g.add(ball(0.06, mat("flat", { color: "#d9b25a" }), { x: dx + 0.36, y: 1.1, z: d / 2 + 0.17, detail: 1 }));
    g.add(box(1.6, 0.18, 0.6, mat("stone", { color: "#a39a8e", seed: 9 }), { x: dx, y: 0.09, z: d / 2 + 0.3 }));
  }
  // windows: frame, sill, glass (night glows), shutters optional
  const glassDay = mat("flat", { color: "#3d5478", seed: 12, var: 0.12 }), glassNight = glow([3.0, 1.9, 0.85]);
  const glassM = o.glow ? glassNight : glassDay;
  const wins = o.windows ?? [{ x: -w * 0.28, y: 2.3 }, { x: w * 0.28, y: 2.3 }];
  for (const wi of wins) {
    const ww = wi.w ?? 0.95, wh = wi.h ?? 1.15, side = wi.side ?? "front";
    const wg = new THREE.Group();
    // depths are staggered by >= 1 cm so no two faces share a plane (shared planes flicker in the ink pass)
    wg.add(box(ww + 0.2, wh + 0.2, 0.12, trimM, { z: 0.03 }));            // frame front at 0.09
    const pane = box(ww - 0.02, wh - 0.02, 0.04, glassM, { z: 0.045 });   // glass recessed, front at 0.065
    pane.userData.nightSwap = { day: glassDay, night: glassNight, always: !!o.glow, lit: wi.lit ?? true };
    wg.add(pane);
    wg.add(box(0.07, wh, 0.05, trimM, { z: 0.08 }));    // mullions, front at 0.105
    wg.add(box(ww, 0.07, 0.04, trimM, { z: 0.08 }));    // front at 0.10
    wg.add(box(ww + 0.4, 0.12, 0.3, mat("stone", { color: "#b8afa2", seed: 13 }), { y: -wh / 2 - 0.12, z: 0.12 }));
    if (wi.shutters) for (const s of [-1, 1]) wg.add(box(ww * 0.55, wh + 0.1, 0.08, mat("planks", { color: wi.shutters, seed: 14, count: 6 }), { x: s * (ww * 0.5 + ww * 0.3 + 0.02), z: 0.06 }));
    if (side === "front") wg.position.set(wi.x, wi.y, d / 2);
    else if (side === "back") { wg.position.set(wi.x, wi.y, -d / 2); wg.rotation.y = Math.PI; }
    else if (side === "left") { wg.position.set(-w / 2, wi.y, wi.x); wg.rotation.y = -Math.PI / 2; }
    else { wg.position.set(w / 2, wi.y, wi.x); wg.rotation.y = Math.PI / 2; }
    g.add(wg);
  }
  if (o.chimney !== false) {
    const cx = (o.chimney?.x ?? w * 0.25), ch = rise * 0.9 + 1.0;
    g.add(box(0.7, ch, 0.7, mat("brick", { color: "#9a4c3a", seed: 15 }), { x: cx, y: h + ch / 2 + 0.2, z: -d * 0.15 }));
    g.add(box(0.85, 0.16, 0.85, darkM, { x: cx, y: h + ch + 0.25, z: -d * 0.15 }));
  }
  if (o.awning) { // shop awning with stripes painted as planks
    const aw = box(w * 0.8, 0.1, 1.4, mat("planks", { color: o.awning, seed: 16, count: 6 }), { y: 3.0, z: d / 2 + 0.6, rx: 0.35 });
    g.add(aw);
  }
  if (o.sign) g.add(signBoard(o.sign, { x: 0, y: h - 0.55, z: d / 2 + 0.12, w: Math.min(w * 0.7, 3.6) }));
  g.position.set(o.x || 0, 0, o.z || 0);
  g.rotation.y = o.ry || 0;
  return W.add(g, { name: g.name });
}

// readable unlit sign board: text painted on canvas
export function signBoard(text, { x = 0, y = 2, z = 0, w = 2.4, h = 0.6, bg = "#f2e4c4", fg = "#3a2420", ry = 0 } = {}) {
  const c = document.createElement("canvas"); c.width = 512; c.height = Math.round(512 * h / w);
  const g = c.getContext("2d");
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "#2a1a18"; g.lineWidth = 10; g.strokeRect(5, 5, c.width - 10, c.height - 10);
  g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `800 ${Math.round(c.height * 0.5)}px "Montserrat", sans-serif`;
  g.fillText(text, c.width / 2, c.height / 2 + 2, c.width * 0.9);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const grp = new THREE.Group(); grp.userData.sign = text;
  grp.add(box(w + 0.1, h + 0.1, 0.08, mat("wood", { color: "#4a2e22" }), {}));
  grp.add(mesh(new THREE.PlaneGeometry(w, h), signMat(t), { z: 0.05 }));
  grp.position.set(x, y, z); grp.rotation.y = ry;
  return grp;
}

// ---------- nature ----------
export function tree(W, { x = 0, z = 0, s = 1, kind = "round", color = "#4f8f3a", trunk = "#6b4429" } = {}) {
  const r = W.rand.fork(Math.round(x * 31 + z * 17));
  const g = new THREE.Group(); g.name = "tree";
  const trunkM = mat("wood", { color: trunk, seed: 22 });
  g.add(cyl(0.16 * s, 0.26 * s, 2.2 * s, trunkM, { y: 1.1 * s }));
  if (kind === "pine") {
    for (let i = 0; i < 3; i++) {
      const cone = mesh(new THREE.ConeGeometry((1.7 - i * 0.42) * s, 2.0 * s, 9), mat("grass", { color: shadeHex(color, -0.12 + i * 0.07), seed: 23 + i }), { y: (2.3 + i * 1.05) * s });
      g.add(cone);
    }
  } else {
    const n = 4 + r.int(0, 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r();
      const rr = (0.9 + r() * 0.5) * s;
      g.add(ball(rr, mat("grass", { color: shadeHex(color, (r() - 0.5) * 0.22), seed: 25 + i }), { x: Math.cos(a) * 0.75 * s, y: (2.9 + r() * 0.8) * s, z: Math.sin(a) * 0.75 * s, detail: 2 }));
    }
    g.add(ball(1.25 * s, mat("grass", { color: shadeHex(color, 0.06), seed: 29 }), { y: 3.7 * s, detail: 2 }));
  }
  g.position.set(x, 0, z);
  return W.add(g, { name: "tree" });
}
export function bush(W, { x = 0, z = 0, s = 1, color = "#5a9a40", flowers = null } = {}) {
  const r = W.rand.fork(Math.round(x * 19 + z * 23));
  const g = new THREE.Group(); g.name = "bush";
  for (let i = 0; i < 3; i++) g.add(ball((0.55 + r() * 0.3) * s, mat("grass", { color: shadeHex(color, (r() - 0.5) * 0.2), seed: 40 + i }), { x: (i - 1) * 0.55 * s, y: 0.45 * s, z: (r() - 0.5) * 0.4 * s, detail: 2 }));
  if (flowers) for (let i = 0; i < 6; i++) g.add(ball(0.09 * s, mat("flat", { color: flowers }), { x: (r() - 0.5) * 1.6 * s, y: (0.6 + r() * 0.4) * s, z: 0.35 * s + r() * 0.2, detail: 1 }));
  g.position.set(x, 0, z);
  return W.add(g, { name: "bush" });
}
export function rock(W, { x = 0, z = 0, s = 1, color = "#9a948a" } = {}) {
  const m = ball(0.6 * s, mat("stone", { color, seed: 50, count: 3 }), { x, y: 0.2 * s, z, detail: 0 });
  m.scale.y = 0.6;
  return W.add(m, { name: "rock" });
}

// ---------- street furniture and props ----------
export function fence(W, a, b, { color = "#f1e9d8", h = 1.0, gap = 0.32 } = {}) {
  const g = new THREE.Group(); g.name = "fence";
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), n = Math.max(2, Math.round(len / gap));
  const m = mat("wood", { color, seed: 60 });
  for (let i = 0; i <= n; i++) g.add(box(0.1, h, 0.06, m, { x: (i / n - 0.5) * len, y: h / 2 }));
  g.add(box(len, 0.08, 0.05, m, { y: h * 0.75, z: -0.05 }));
  g.add(box(len, 0.08, 0.05, m, { y: h * 0.3, z: -0.05 }));
  g.position.set((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2);
  g.rotation.y = -Math.atan2(dz, dx);
  return W.add(g, { name: "fence" });
}
export function lamp(W, { x = 0, z = 0, on = false, color = "#2e2a34" } = {}) {
  const g = new THREE.Group(); g.name = "lamp";
  const m = mat("flat", { color });
  g.add(cyl(0.07, 0.1, 3.2, m, { y: 1.6 }));
  g.add(box(0.5, 0.12, 0.5, m, { y: 3.25 }));
  const bulbDay = mat("flat", { color: "#f3e6b8" }), bulbNight = glow([4.0, 2.6, 1.2]);
  const bulb = box(0.36, 0.42, 0.36, on ? bulbNight : bulbDay, { y: 3.0 });
  bulb.userData.nightSwap = { day: bulbDay, night: bulbNight, always: on, lit: true };
  g.add(bulb);
  g.add(cyl(0.22, 0.28, 0.2, m, { y: 0.1 }));
  g.position.set(x, 0, z);
  return W.add(g, { name: "lamp" });
}
export function bench(W, { x = 0, z = 0, ry = 0, color = "#8a5a36" } = {}) {
  const g = new THREE.Group(); g.name = "bench";
  const m = mat("planks", { color, seed: 70, count: 3 }), iron = mat("flat", { color: "#2f2b30" });
  g.add(box(1.8, 0.08, 0.5, m, { y: 0.48 }));
  g.add(box(1.8, 0.4, 0.07, m, { y: 0.78, z: -0.24 }));
  for (const s of [-0.8, 0.8]) g.add(box(0.08, 0.5, 0.5, iron, { x: s, y: 0.25 }));
  g.position.set(x, 0, z); g.rotation.y = ry;
  return W.add(g, { name: "bench" });
}
export function table(W, { x = 0, z = 0, ry = 0, w = 1.6, d = 0.9, h = 0.78, color = "#9a6a42", cloth = null } = {}) {
  const g = new THREE.Group(); g.name = "table";
  const m = mat("planks", { color, seed: 71, count: 4 });
  g.add(box(w, 0.07, d, cloth ? mat("flat", { color: cloth }) : m, { y: h }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.07, h, 0.07, m, { x: sx * (w / 2 - 0.1), y: h / 2, z: sz * (d / 2 - 0.1) }));
  g.position.set(x, 0, z); g.rotation.y = ry;
  return W.add(g, { name: "table" });
}
export function chair(W, { x = 0, z = 0, ry = 0, color = "#8a5a36" } = {}) {
  const g = new THREE.Group(); g.name = "chair";
  const m = mat("wood", { color, seed: 72 });
  g.add(box(0.5, 0.06, 0.5, m, { y: 0.47 }));
  g.add(box(0.5, 0.55, 0.06, m, { y: 0.75, z: -0.22 }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.05, 0.47, 0.05, m, { x: sx * 0.21, y: 0.235, z: sz * 0.21 }));
  g.position.set(x, 0, z); g.rotation.y = ry;
  return W.add(g, { name: "chair" });
}
export function crate(W, { x = 0, z = 0, s = 0.7, ry = 0, color = "#b78a52" } = {}) {
  return W.add(box(s, s, s, mat("planks", { color, seed: 73, count: 4 }), { x, y: s / 2, z, ry }), { name: "crate" });
}
export function barrel(W, { x = 0, z = 0, s = 1, color = "#8a5a36" } = {}) {
  const g = new THREE.Group(); g.name = "barrel";
  g.add(cyl(0.36 * s, 0.32 * s, 1.0 * s, mat("wood", { color, seed: 74 }), { y: 0.5 * s, seg: 16 }));
  for (const y of [0.18, 0.82]) g.add(cyl(0.37 * s, 0.37 * s, 0.06 * s, mat("flat", { color: "#3a3436" }), { y: y * s, seg: 16 }));
  g.position.set(x, 0, z);
  return W.add(g, { name: "barrel" });
}
export function well(W, { x = 0, z = 0 } = {}) {
  const g = new THREE.Group(); g.name = "well";
  g.add(cyl(0.95, 1.0, 0.9, mat("stone", { color: "#a39c90", seed: 75, count: 6 }), { y: 0.45, seg: 18 }));
  g.add(cyl(0.75, 0.75, 0.05, mat("water", { color: "#2f5f8f" }), { y: 0.8, seg: 18 }));
  const wood = mat("wood", { color: "#6b4429" });
  for (const s of [-0.85, 0.85]) g.add(box(0.12, 1.7, 0.12, wood, { x: s, y: 1.6 }));
  g.add(box(2.2, 0.1, 1.4, mat("tiles", { color: "#9c4a34" }), { y: 2.55, rz: 0.0 }));
  g.add(cyl(0.06, 0.06, 1.7, wood, { y: 2.1, rz: Math.PI / 2 }));
  g.position.set(x, 0, z);
  return W.add(g, { name: "well" });
}
export function stall(W, { x = 0, z = 0, ry = 0, color = "#c94a3a", wood = "#8a5a36" } = {}) {
  const g = new THREE.Group(); g.name = "stall";
  const m = mat("planks", { color: wood, seed: 76, count: 4 });
  g.add(box(2.6, 1.0, 1.1, m, { y: 0.5 }));
  for (const sx of [-1.2, 1.2]) for (const sz of [-0.45, 0.45]) g.add(box(0.08, 2.4, 0.08, m, { x: sx, y: 1.2, z: sz }));
  g.add(box(2.9, 0.1, 1.6, mat("planks", { color, seed: 77, count: 6 }), { y: 2.45, rx: -0.12 }));
  g.position.set(x, 0, z); g.rotation.y = ry;
  return W.add(g, { name: "stall" });
}
// an interior: floor + three walls (open toward +z where the camera stands), optional window light
export function room(W, { x = 0, z = 0, w = 8, d = 6, h = 3.4, wall = "plaster", wallColor = "#e6cfa8", floor = "planks", floorColor = "#9a6a42", ry = 0 } = {}) {
  const g = new THREE.Group(); g.name = "room";
  const fl = mesh(worldUV(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), 1.5), mat(floor, { color: floorColor, seed: 80, count: 8 }), { y: 0.01, ink: "ground" });
  fl.userData.noShadow = true;
  g.add(fl);
  const wm = mat(wall, { color: wallColor, seed: 81 });
  g.add(box(w, h, 0.2, wm, { y: h / 2, z: -d / 2 }));
  g.add(box(0.2, h, d, wm, { x: -w / 2, y: h / 2 }));
  g.add(box(0.2, h, d, wm, { x: w / 2, y: h / 2 }));
  g.add(box(w, 0.25, 0.25, mat("wood", { color: "#6b4429" }), { y: 0.12, z: -d / 2 + 0.2 }));
  g.position.set(x, 0, z); g.rotation.y = ry;
  return W.add(g, { collide: false, name: "room" });
}
// flag on a pole. The story passes the flag's own canvas painter so flags are always correct for the place/time.
export function flag(W, { x = 0, z = 0, h = 6, paint = null, w = 1.6 } = {}) {
  const g = new THREE.Group(); g.name = "flag";
  g.add(cyl(0.05, 0.07, h, mat("flat", { color: "#d8d2c8" }), { y: h / 2 }));
  const c = document.createElement("canvas"); c.width = 300; c.height = 200;
  const cg = c.getContext("2d");
  if (paint) paint(cg, 300, 200); else { cg.fillStyle = "#f1ece0"; cg.fillRect(0, 0, 300, 200); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  g.add(mesh(new THREE.PlaneGeometry(w, w / 1.5, 8, 2), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }), { x: w / 2 + 0.05, y: h - w / 3 - 0.1 }));
  g.position.set(x, 0, z);
  return W.add(g, { name: "flag" });
}
