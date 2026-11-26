// Prop library (code-built). Every prop: prop.<name>(W, { x, z, y=0, ry=0, pal, s=1, ...opts }) -> Group added to the world.
// Props take colours from the scene palette (pal) so a scene keeps one colour family.
// group.userData.top = height of a usable top surface (for clutter), group.userData.wall = true for wall-mounted props.
import * as THREE from "three";
import { mat, glow } from "./shade.js";
import { box, cyl, ball } from "./kit.js";
import { shadeHex, mixHex } from "../core/util.js";

const P = (pal, k, d) => (pal && pal[k]) || d;
function place(W, g, o, name, opts = {}) {
  g.name = name;
  g.position.set(o.x || 0, o.y || 0, o.z || 0);
  g.rotation.y = o.ry || 0;
  if (o.s) g.scale.setScalar(o.s);
  return W.add(g, { name, collide: opts.collide ?? true, kind: opts.kind || "prop" });
}
const grp = () => new THREE.Group();
const M = (kind, color, extra = {}) => mat(kind, { color, ...extra });

// small items drawn on shelves/tables
function books(g, n, w, y, z, pal, r) {
  let x = -w / 2 + 0.04;
  for (let i = 0; i < n && x < w / 2 - 0.05; i++) {
    const bw = 0.04 + r() * 0.04, bh = 0.18 + r() * 0.12;
    const c = r() < 0.75 ? shadeHex(P(pal, "prop", "#8a3b30"), (r() - 0.5) * 0.5) : P(pal, "accent", "#e0a030");
    g.add(box(bw, bh, 0.18, M("flat", c), { x: x + bw / 2, y: y + bh / 2, z, rz: r() < 0.12 ? 0.25 : 0 }));
    x += bw + 0.005;
  }
}
function jars(g, n, w, y, z, pal, r) {
  for (let i = 0; i < n; i++) {
    const c = shadeHex(r() < 0.8 ? P(pal, "prop3", "#7fb0c0") : P(pal, "accent", "#e0a030"), (r() - 0.5) * 0.3);
    const h = 0.12 + r() * 0.14, rad = 0.04 + r() * 0.03;
    g.add(cyl(rad, rad, h, M("flat", c), { x: -w / 2 + (i + 0.5) * (w / n), y: y + h / 2, z, seg: 10 }));
  }
}

export const prop = {
  // ---------- furniture ----------
  desk(W, o = {}) { const g = grp(), w = o.w ?? 1.4, d = o.d ?? 0.7, h = 0.76, wood = M("wood", P(o.pal, "wood", "#8a5a36"));
    g.add(box(w, 0.05, d, wood, { y: h })); g.add(box(0.05, h, d - 0.05, wood, { x: -w / 2 + 0.03, y: h / 2 })); g.add(box(0.4, h - 0.05, d - 0.08, wood, { x: w / 2 - 0.23, y: h / 2 }));
    for (let i = 0; i < 3; i++) g.add(box(0.36, 0.02, 0.02, M("flat", P(o.pal, "metal", "#bbb")), { x: w / 2 - 0.23, y: 0.15 + i * 0.22, z: d / 2 - 0.03 }));
    g.userData.top = h + 0.025; return place(W, g, o, "desk"); },
  officeChair(W, o = {}) { const g = grp(), c = M("flat", P(o.pal, "prop2", "#333"));
    g.add(cyl(0.24, 0.24, 0.08, c, { y: 0.48 })); g.add(box(0.44, 0.5, 0.07, c, { y: 0.8, z: -0.2 })); g.add(cyl(0.03, 0.03, 0.4, M("flat", "#555"), { y: 0.25 }));
    for (let i = 0; i < 5; i++) { const a = i * 1.2566; g.add(box(0.3, 0.03, 0.04, M("flat", "#444"), { x: Math.cos(a) * 0.15, y: 0.05, z: Math.sin(a) * 0.15, ry: -a })); }
    return place(W, g, o, "office chair"); },
  sofa(W, o = {}) { const g = grp(), w = o.w ?? 2.0, f = M("flat", P(o.pal, "fabric", "#7a4a5a"));
    g.add(box(w, 0.4, 0.85, f, { y: 0.25 })); g.add(box(w, 0.5, 0.2, f, { y: 0.65, z: -0.33 }));
    for (const s of [-1, 1]) g.add(box(0.2, 0.55, 0.85, f, { x: s * (w / 2 - 0.1), y: 0.35 }));
    for (let i = 0; i < 2; i++) g.add(box(w / 2 - 0.25, 0.12, 0.62, M("flat", shadeHex(P(o.pal, "fabric", "#7a4a5a"), 0.12)), { x: (i - 0.5) * (w / 2 - 0.15), y: 0.5, z: 0.06 }));
    g.add(box(0.36, 0.3, 0.1, M("flat", P(o.pal, "accent", "#e0a030")), { x: -w / 2 + 0.45, y: 0.72, z: -0.18, rz: 0.15 }));
    return place(W, g, o, "sofa"); },
  armchair(W, o = {}) { const g = grp(), f = M("flat", P(o.pal, "prop", "#6a7a3a"));
    g.add(box(0.85, 0.42, 0.8, f, { y: 0.26 })); g.add(box(0.85, 0.55, 0.18, f, { y: 0.7, z: -0.32 }));
    for (const s of [-1, 1]) g.add(box(0.16, 0.6, 0.8, f, { x: s * 0.36, y: 0.38 }));
    return place(W, g, o, "armchair"); },
  bed(W, o = {}) { const g = grp(), wood = M("wood", P(o.pal, "wood", "#8a5a36"));
    g.add(box(1.5, 0.35, 2.0, wood, { y: 0.2 })); g.add(box(1.4, 0.2, 1.9, M("flat", P(o.pal, "paper", "#eee")), { y: 0.45 }));
    g.add(box(1.42, 0.22, 1.3, M("flat", P(o.pal, "fabric", "#4a6a9a")), { y: 0.48, z: 0.3 })); g.add(box(1.5, 0.9, 0.08, wood, { y: 0.5, z: -1.0 }));
    g.add(box(0.6, 0.14, 0.35, M("flat", "#f4f0e8"), { x: -0.33, y: 0.6, z: -0.72 })); g.add(box(0.6, 0.14, 0.35, M("flat", "#f4f0e8"), { x: 0.33, y: 0.6, z: -0.72 }));
    return place(W, g, o, "bed"); },
  table(W, o = {}) { const g = grp(), w = o.w ?? 1.2, d = o.d ?? 0.8, h = o.h ?? 0.76, wood = M("wood", P(o.pal, "wood", "#8a5a36"));
    g.add(box(w, 0.05, d, o.cloth ? M("flat", o.cloth) : wood, { y: h }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.06, h, 0.06, wood, { x: sx * (w / 2 - 0.08), y: h / 2, z: sz * (d / 2 - 0.08) }));
    g.userData.top = h + 0.025; return place(W, g, o, "table"); },
  roundTable(W, o = {}) { const g = grp(), wood = M("wood", P(o.pal, "wood", "#8a5a36"));
    g.add(cyl(0.55, 0.55, 0.05, wood, { y: 0.75, seg: 24 })); g.add(cyl(0.05, 0.05, 0.74, wood, { y: 0.37 })); g.add(cyl(0.3, 0.3, 0.04, wood, { y: 0.02, seg: 18 }));
    g.userData.top = 0.78; return place(W, g, o, "round table"); },
  chair(W, o = {}) { const g = grp(), m = M("wood", o.color || P(o.pal, "wood", "#8a5a36"));
    g.add(box(0.45, 0.05, 0.45, m, { y: 0.46 })); g.add(box(0.45, 0.5, 0.05, m, { y: 0.72, z: -0.2 }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.04, 0.46, 0.04, m, { x: sx * 0.19, y: 0.23, z: sz * 0.19 }));
    return place(W, g, o, "chair"); },
  stool(W, o = {}) { const g = grp(), m = M("flat", P(o.pal, "prop2", "#c94a3a"));
    g.add(cyl(0.2, 0.2, 0.08, m, { y: 0.72, seg: 16 })); g.add(cyl(0.035, 0.035, 0.7, M("flat", "#666"), { y: 0.36 })); g.add(cyl(0.2, 0.22, 0.03, M("flat", "#555"), { y: 0.02, seg: 16 }));
    return place(W, g, o, "stool"); },
  bench(W, o = {}) { const g = grp(), m = M("planks", P(o.pal, "wood", "#8a5a36"), { count: 3 });
    g.add(box(o.w ?? 1.8, 0.07, 0.4, m, { y: 0.46 })); for (const s of [-1, 1]) g.add(box(0.06, 0.46, 0.36, M("flat", P(o.pal, "metal", "#555")), { x: s * ((o.w ?? 1.8) / 2 - 0.15), y: 0.23 }));
    return place(W, g, o, "bench"); },
  // ---------- storage ----------
  bookshelf(W, o = {}) { const g = grp(), w = o.w ?? 1.0, h = o.h ?? 1.9, wood = M("wood", P(o.pal, "wood", "#7a4a2a")), r = W.rand.fork(Math.round((o.x || 0) * 17 + (o.z || 0) * 5));
    g.add(box(w, h, 0.04, wood, { y: h / 2, z: -0.16 })); for (const s of [-1, 1]) g.add(box(0.04, h, 0.34, wood, { x: s * (w / 2 - 0.02), y: h / 2 }));
    const n = Math.round(h / 0.42); for (let i = 0; i <= n; i++) g.add(box(w, 0.03, 0.34, wood, { y: 0.02 + (i * (h - 0.04)) / n }));
    for (let i = 0; i < n; i++) books(g, 14, w - 0.08, 0.04 + (i * (h - 0.04)) / n, 0.0, o.pal, r);
    return place(W, g, o, "bookshelf"); },
  shelf(W, o = {}) { // open shelving with jars/boxes, kitchens and shops
    const g = grp(), w = o.w ?? 1.2, h = o.h ?? 1.8, m = M("flat", P(o.pal, "metal", "#aab")), r = W.rand.fork(Math.round((o.x || 0) * 23 + (o.z || 0) * 7));
    for (const s of [-1, 1]) g.add(box(0.04, h, 0.04, m, { x: s * (w / 2 - 0.02), y: h / 2, z: 0.14 }), box(0.04, h, 0.04, m, { x: s * (w / 2 - 0.02), y: h / 2, z: -0.14 }));
    const n = 4; for (let i = 0; i < n; i++) { const y = 0.25 + i * ((h - 0.3) / (n - 1)); g.add(box(w, 0.03, 0.32, M("wood", P(o.pal, "wood", "#8a5a36")), { y }));
      if (r() < 0.5) jars(g, 5, w - 0.1, y + 0.015, 0, o.pal, r); else for (let k = 0; k < 3; k++) { const bw = 0.2 + r() * 0.12, bh = 0.14 + r() * 0.12; g.add(box(bw, bh, 0.24, M("planks", shadeHex(P(o.pal, "propLight", "#c9a46a"), (r() - 0.5) * 0.3), { count: 2 }), { x: -w / 2 + 0.15 + k * (w - 0.3) / 2, y: y + bh / 2 + 0.015 })); } }
    return place(W, g, o, "shelf"); },
  cabinet(W, o = {}) { const g = grp(), w = o.w ?? 0.9, h = o.h ?? 0.9, c = M("planks", P(o.pal, "prop2", "#5a7a8a"), { count: 3 });
    g.add(box(w, h, 0.5, c, { y: h / 2 })); g.add(box(w + 0.04, 0.04, 0.54, M("wood", P(o.pal, "wood", "#8a5a36")), { y: h + 0.02 }));
    for (const s of [-1, 1]) g.add(box(0.03, 0.14, 0.03, M("flat", "#d9c07a"), { x: s * 0.06, y: h * 0.6, z: 0.26 }));
    g.add(box(0.015, h - 0.1, 0.02, M("flat", shadeHex(P(o.pal, "prop2", "#5a7a8a"), -0.4)), { y: h / 2, z: 0.255 }));
    g.userData.top = h + 0.04; return place(W, g, o, "cabinet"); },
  filingCabinet(W, o = {}) { const g = grp(), c = M("flat", P(o.pal, "metal", "#8a9098"));
    g.add(box(0.5, 1.3, 0.6, c, { y: 0.65 })); for (let i = 0; i < 4; i++) { g.add(box(0.44, 0.27, 0.02, M("flat", shadeHex(P(o.pal, "metal", "#8a9098"), 0.12)), { y: 0.18 + i * 0.31, z: 0.305 })); g.add(box(0.14, 0.03, 0.03, M("flat", "#444"), { y: 0.24 + i * 0.31, z: 0.32 })); }
    g.userData.top = 1.3; return place(W, g, o, "filing cabinet"); },
  locker(W, o = {}) { const g = grp(), n = o.n ?? 3, c = M("flat", P(o.pal, "prop", "#4a7a9a"));
    for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * 0.42; g.add(box(0.4, 1.8, 0.45, c, { x, y: 0.9 })); for (let k = 0; k < 4; k++) g.add(box(0.22, 0.02, 0.02, M("flat", shadeHex(P(o.pal, "prop", "#4a7a9a"), -0.4)), { x, y: 1.55 - k * 0.05, z: 0.23 })); g.add(box(0.03, 0.12, 0.03, M("flat", "#ccc"), { x: x + 0.14, y: 1.0, z: 0.24 })); }
    return place(W, g, o, "lockers"); },
  crateStack(W, o = {}) { const g = grp(), r = W.rand.fork(Math.round((o.x || 0) * 31 + (o.z || 0) * 3));
    const n = o.n ?? 3; let y = 0; for (let i = 0; i < n; i++) { const s = 0.5 + r() * 0.2; g.add(box(s, s, s, M("planks", shadeHex(P(o.pal, "propLight", "#b78a52"), (r() - 0.5) * 0.25), { count: 4 }), { x: (r() - 0.5) * 0.15, y: y + s / 2, ry: (r() - 0.5) * 0.4 })); y += s; }
    return place(W, g, o, "crates"); },
  sacks(W, o = {}) { const g = grp(); for (let i = 0; i < 3; i++) { const b = ball(0.28, M("dirt", P(o.pal, "propLight", "#c9b48a")), { x: (i - 1) * 0.42, y: 0.22, detail: 2 }); b.scale.set(1, 0.8, 0.8); g.add(b); }
    return place(W, g, o, "sacks"); },
  // ---------- kitchen / shop ----------
  counter(W, o = {}) { const g = grp(), w = o.w ?? 2.0, base = M("planks", P(o.pal, "prop2", "#5a7a8a"), { count: 4 });
    g.add(box(w, 0.88, 0.6, base, { y: 0.44 })); g.add(box(w + 0.04, 0.05, 0.64, M("stone", P(o.pal, "propLight", "#d8d0c0"), { count: 5 }), { y: 0.905 }));
    for (let i = 0; i < Math.floor(w / 0.6); i++) g.add(box(0.12, 0.02, 0.02, M("flat", "#d0c08a"), { x: -w / 2 + 0.3 + i * 0.6, y: 0.75, z: 0.31 }));
    g.userData.top = 0.93; return place(W, g, o, "counter"); },
  fridge(W, o = {}) { const g = grp(), c = M("flat", P(o.pal, "propLight", "#e8eef0"));
    g.add(box(0.75, 1.8, 0.7, c, { y: 0.9 })); g.add(box(0.73, 0.02, 0.02, M("flat", "#999"), { y: 1.25, z: 0.36 })); g.add(box(0.04, 0.5, 0.05, M("flat", "#888"), { x: 0.3, y: 1.0, z: 0.37 })); g.add(box(0.04, 0.25, 0.05, M("flat", "#888"), { x: 0.3, y: 1.5, z: 0.37 }));
    for (let i = 0; i < 3; i++) g.add(box(0.1, 0.1, 0.01, M("flat", [P(o.pal, "accent", "#e05a3a"), "#f0d050", "#5ab0e0"][i]), { x: -0.2 + i * 0.12, y: 1.45 + (i % 2) * 0.1, z: 0.36 }));
    return place(W, g, o, "fridge"); },
  stove(W, o = {}) { const g = grp(); g.add(box(0.7, 0.9, 0.6, M("flat", P(o.pal, "metal", "#d0d0d0")), { y: 0.45 }));
    for (const [x, z] of [[-0.17, -0.12], [0.17, -0.12], [-0.17, 0.14], [0.17, 0.14]]) g.add(cyl(0.1, 0.1, 0.02, M("flat", "#2a2a2a"), { x, y: 0.91, z, seg: 14 }));
    g.add(box(0.6, 0.4, 0.02, M("flat", "#333"), { y: 0.45, z: 0.305 })); g.add(cyl(0.16, 0.14, 0.18, M("flat", P(o.pal, "accent", "#c94a3a")), { x: 0.17, y: 1.0, z: -0.12, seg: 14 }));
    return place(W, g, o, "stove"); },
  sink(W, o = {}) { const g = prop.counter(W, { ...o, w: o.w ?? 1.2 }); g.add(box(0.5, 0.04, 0.4, M("flat", "#9aa4ac"), { y: 0.92 })); g.add(cyl(0.02, 0.02, 0.3, M("flat", "#ccc"), { y: 1.05, z: -0.22 })); g.name = "sink"; return g; },
  vendingMachine(W, o = {}) { const g = grp(), c = M("flat", P(o.pal, "accent", "#c94a3a"));
    g.add(box(0.9, 1.9, 0.75, c, { y: 0.95 })); g.add(box(0.6, 1.1, 0.02, glow([1.6, 1.7, 1.8]), { x: -0.08, y: 1.2, z: 0.38 }));
    const r = W.rand.fork(7); for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) g.add(box(0.08, 0.16, 0.03, M("flat", shadeHex(P(o.pal, "prop3", "#5ab0e0"), (r() - 0.5) * 0.5)), { x: -0.3 + k * 0.15, y: 0.78 + i * 0.27, z: 0.395 }));
    g.add(box(0.14, 0.4, 0.02, M("flat", "#333"), { x: 0.33, y: 1.2, z: 0.38 }));
    return place(W, g, o, "vending machine"); },
  shopShelf(W, o = {}) { const g = prop.shelf(W, { ...o, h: o.h ?? 1.6 }); g.name = "shop shelf"; return g; },
  // ---------- office / lab ----------
  monitor(W, o = {}) { const g = grp(); g.add(box(0.55, 0.36, 0.04, M("flat", "#2a2a30"), { y: 0.3 }));
    g.add(box(0.5, 0.31, 0.01, glow(o.glow || [0.6, 1.1, 1.5]), { y: 0.3, z: 0.021 })); g.add(box(0.06, 0.12, 0.06, M("flat", "#333"), { y: 0.06 })); g.add(box(0.22, 0.02, 0.16, M("flat", "#333"), { y: 0.01 }));
    return place(W, g, o, "monitor", { collide: false }); },
  computer(W, o = {}) { const g = grp(); g.add(box(0.2, 0.42, 0.45, M("flat", "#d8d8d4"), { y: 0.21 })); g.add(box(0.02, 0.02, 0.01, glow([0.2, 2.0, 0.4]), { x: 0.05, y: 0.35, z: 0.226 })); return place(W, g, o, "computer", { collide: false }); },
  printer(W, o = {}) { const g = grp(); g.add(box(0.5, 0.25, 0.4, M("flat", "#dcdcd8"), { y: 0.125 })); g.add(box(0.36, 0.02, 0.2, M("flat", "#ffffff"), { y: 0.26, z: 0.1 })); return place(W, g, o, "printer", { collide: false }); },
  waterCooler(W, o = {}) { const g = grp(); g.add(box(0.36, 1.0, 0.36, M("flat", "#e4e8ea"), { y: 0.5 })); g.add(cyl(0.15, 0.15, 0.45, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.8, 1.2), transparent: true, opacity: 0.6 }), { y: 1.22, seg: 16 })); return place(W, g, o, "water cooler"); },
  labBench(W, o = {}) { const g = prop.counter(W, { ...o, w: o.w ?? 2.2 }); const r = W.rand.fork(13);
    for (let i = 0; i < 5; i++) { const fl = ball(0.07, new THREE.MeshBasicMaterial({ color: new THREE.Color(...[[0.4, 1.6, 0.6], [1.6, 0.5, 0.9], [0.5, 1.0, 1.7]][i % 3]) }), { x: -0.8 + i * 0.4, y: 1.0, z: (r() - 0.5) * 0.2, detail: 1 }); g.add(fl, cyl(0.02, 0.02, 0.12, M("flat", "#dfe"), { x: -0.8 + i * 0.4, y: 1.1, z: fl.position.z, seg: 8 })); }
    g.name = "lab bench"; return g; },
  whiteboard(W, o = {}) { const g = grp(); g.add(box(o.w ?? 1.8, 1.0, 0.04, M("flat", "#9aa0a8"), {})); g.add(box((o.w ?? 1.8) - 0.08, 0.92, 0.01, M("flat", o.dark ? "#2f4a3a" : "#f6f6f2", { var: 0.02 }), { z: 0.025 }));
    const r = W.rand.fork(19); for (let i = 0; i < 5; i++) g.add(box(0.3 + r() * 0.6, 0.025, 0.005, M("flat", o.dark ? "#e8e8e0" : P(o.pal, "prop2", "#3a5a9a")), { x: -0.5 + r() * 0.5, y: 0.3 - i * 0.14, z: 0.032 }));
    g.userData.wall = true; return place(W, g, { ...o, y: o.y ?? 1.5 }, "board", { collide: false }); },
  // ---------- wall decor ----------
  poster(W, o = {}) { const g = grp(), w = o.w ?? 0.6, h = o.h ?? 0.85, r = W.rand.fork(Math.round((o.x || 0) * 41 + (o.z || 0) * 13 + (o.y || 0) * 7));
    g.add(box(w, h, 0.015, M("flat", P(o.pal, "paper", "#f0ead8")), {}));
    g.add(box(w * 0.8, h * 0.45, 0.005, M("flat", r() < 0.5 ? P(o.pal, "prop", "#3a6a9a") : P(o.pal, "accent", "#e0a030")), { y: h * 0.12, z: 0.01 }));
    g.add(ball(Math.min(w, h) * 0.16, M("flat", P(o.pal, "propLight", "#f8f0d0")), { y: h * 0.14, z: 0.02, detail: 1 }));
    for (let i = 0; i < 3; i++) g.add(box(w * (0.7 - i * 0.15), 0.025, 0.005, M("flat", P(o.pal, "dark", "#333")), { y: -h * 0.22 - i * 0.06, z: 0.01 }));
    g.userData.wall = true; return place(W, g, { ...o, y: o.y ?? 1.65 }, "poster", { collide: false }); },
  frame(W, o = {}) { const g = grp(), w = o.w ?? 0.5, h = o.h ?? 0.4;
    g.add(box(w, h, 0.03, M("wood", P(o.pal, "trim", "#5b3b2a")), {})); g.add(box(w - 0.08, h - 0.08, 0.005, M("flat", o.picture || P(o.pal, "prop3", "#7aa0c0"), { var: 0.2 }), { z: 0.018 }));
    g.add(box(w - 0.08, (h - 0.08) * 0.35, 0.004, M("flat", P(o.pal, "prop", "#5a8a5a")), { y: -(h - 0.08) * 0.32, z: 0.021 }));
    g.userData.wall = true; return place(W, g, { ...o, y: o.y ?? 1.6 }, "frame", { collide: false }); },
  clock(W, o = {}) { const g = grp(); g.add(cyl(0.2, 0.2, 0.04, M("flat", P(o.pal, "dark", "#333")), { rx: Math.PI / 2, seg: 24 })); g.add(cyl(0.18, 0.18, 0.045, M("flat", "#f6f2e8"), { rx: Math.PI / 2, seg: 24, z: 0.003 }));
    g.add(box(0.015, 0.13, 0.01, M("flat", "#222"), { y: 0.05, z: 0.03, rz: 0.4 })); g.add(box(0.012, 0.09, 0.01, M("flat", "#222"), { x: 0.03, y: 0.02, z: 0.032, rz: -1.2 }));
    g.userData.wall = true; return place(W, g, { ...o, y: o.y ?? 2.1 }, "clock", { collide: false }); },
  noticeBoard(W, o = {}) { const g = grp(), r = W.rand.fork(29); g.add(box(1.0, 0.7, 0.03, M("dirt", "#b88a5a"), {}));
    for (let i = 0; i < 6; i++) g.add(box(0.16 + r() * 0.1, 0.2 + r() * 0.08, 0.005, M("flat", ["#f6f0d8", "#f4e070", "#9ad0f0", P(o.pal, "propLight", "#f0d0d0")][i % 4]), { x: -0.35 + (i % 3) * 0.35, y: i < 3 ? 0.15 : -0.15, z: 0.02, rz: (r() - 0.5) * 0.2 }));
    g.userData.wall = true; return place(W, g, { ...o, y: o.y ?? 1.5 }, "notice board", { collide: false }); },
  wallShelf(W, o = {}) { const g = grp(), w = o.w ?? 1.0, r = W.rand.fork(37); g.add(box(w, 0.03, 0.22, M("wood", P(o.pal, "wood", "#8a5a36")), {}));
    if (r() < 0.5) books(g, 8, w * 0.7, 0.015, 0, o.pal, r); else jars(g, 4, w * 0.8, 0.015, 0, o.pal, r);
    g.userData.wall = true; return place(W, g, { ...o, y: o.y ?? 1.55 }, "wall shelf", { collide: false }); },
  calendar(W, o = {}) { const g = grp(); g.add(box(0.3, 0.4, 0.01, M("flat", "#f4f0e6"), {})); g.add(box(0.3, 0.1, 0.012, M("flat", P(o.pal, "accent", "#c94a3a")), { y: 0.15 }));
    for (let i = 0; i < 4; i++) for (let k = 0; k < 5; k++) g.add(box(0.035, 0.03, 0.004, M("flat", "#999"), { x: -0.1 + k * 0.05, y: 0.05 - i * 0.06, z: 0.008 }));
    g.userData.wall = true; return place(W, g, { ...o, y: o.y ?? 1.6 }, "calendar", { collide: false }); },
  vent(W, o = {}) { const g = grp(); g.add(box(0.5, 0.3, 0.03, M("flat", P(o.pal, "metal", "#aab")), {})); for (let i = 0; i < 5; i++) g.add(box(0.44, 0.02, 0.02, M("flat", "#555"), { y: -0.1 + i * 0.05, z: 0.02 }));
    g.userData.wall = true; return place(W, g, { ...o, y: o.y ?? 2.6 }, "vent", { collide: false }); },
  pipe(W, o = {}) { const g = grp(), len = o.len ?? 3; g.add(cyl(0.05, 0.05, len, M("flat", P(o.pal, "metal", "#8a8f98")), { rz: Math.PI / 2, seg: 10 }));
    for (let i = 0; i <= Math.floor(len / 0.8); i++) g.add(box(0.06, 0.14, 0.04, M("flat", "#555"), { x: -len / 2 + i * 0.8, y: 0.06 }));
    return place(W, g, { ...o, y: o.y ?? 2.8 }, "pipe", { collide: false }); },
  radiator(W, o = {}) { const g = grp(); for (let i = 0; i < 9; i++) g.add(box(0.06, 0.6, 0.12, M("flat", P(o.pal, "propLight", "#e8e4dc")), { x: -0.32 + i * 0.08, y: 0.45 })); return place(W, g, o, "radiator", { collide: false }); },
  curtain(W, o = {}) { const g = grp(), w = o.w ?? 1.4, h = o.h ?? 1.7; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) g.add(cyl(0.07, 0.09, h, M("flat", shadeHex(P(o.pal, "fabric", "#a04a4a"), i * 0.05)), { x: s * (w / 2 + 0.05 + i * 0.1), y: -h / 2, seg: 8 }));
    g.add(cyl(0.02, 0.02, w + 0.8, M("flat", "#7a5a3a"), { rz: Math.PI / 2, y: 0.05 }));
    g.userData.wall = true; return place(W, g, { ...o, y: o.y ?? 2.2 }, "curtains", { collide: false }); },
  rug(W, o = {}) { const g = grp(), w = o.w ?? 2.4, d = o.d ?? 1.6;
    const r1 = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), M("slabs", P(o.pal, "accent", "#a04a3a"), { count: 3, check: P(o.pal, "accentDark", "#7a3020") }));
    const r2 = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, d * 0.7).rotateX(-Math.PI / 2), M("flat", P(o.pal, "propLight", "#e8d8b0")));
    r1.position.y = 0.02; r2.position.y = 0.026; r1.userData.ink = r2.userData.ink = "ground"; r1.userData.noShadow = r2.userData.noShadow = true; g.add(r1, r2);
    return place(W, g, o, "rug", { collide: false }); },
  // ---------- small things ----------
  plant(W, o = {}) { const g = grp(), s = o.s2 ?? 1, r = W.rand.fork(Math.round((o.x || 0) * 53 + (o.z || 0) * 11));
    g.add(cyl(0.18 * s, 0.13 * s, 0.32 * s, M("flat", P(o.pal, "accent", "#c0603a")), { y: 0.16 * s, seg: 14 }));
    for (let i = 0; i < 6; i++) { const a = r() * 6.28, l = (0.3 + r() * 0.35) * s; const leaf = ball(0.12 * s, M("grass", "#4f9a48"), { x: Math.cos(a) * 0.12 * s, y: (0.35 + l * 0.6) * s, z: Math.sin(a) * 0.12 * s, detail: 1 }); leaf.scale.set(0.6, 1.4, 0.6); leaf.rotation.z = Math.cos(a) * 0.6; g.add(leaf); }
    return place(W, g, o, "plant"); },
  floorLampShade(W, o = {}) { const g = grp(); g.add(cyl(0.03, 0.03, 1.5, M("flat", "#333"), { y: 0.75 })); g.add(cyl(0.18, 0.2, 0.03, M("flat", "#333"), { y: 0.015 }));
    g.add(cyl(0.16, 0.25, 0.3, glow([2.2, 1.7, 1.0]), { y: 1.55 })); return place(W, g, o, "floor lamp"); },
  mug(W, o = {}) { const g = grp(); g.add(cyl(0.045, 0.04, 0.1, M("flat", o.color || P(o.pal, "accent", "#e05a3a")), { y: 0.05, seg: 12 })); return place(W, g, o, "mug", { collide: false }); },
  bottle(W, o = {}) { const g = grp(); g.add(cyl(0.04, 0.04, 0.2, M("flat", o.color || P(o.pal, "prop3", "#4a9a5a")), { y: 0.1, seg: 10 })); g.add(cyl(0.015, 0.03, 0.08, M("flat", o.color || P(o.pal, "prop3", "#4a9a5a")), { y: 0.24, seg: 8 })); return place(W, g, o, "bottle", { collide: false }); },
  boxSmall(W, o = {}) { const g = grp(); g.add(box(o.w ?? 0.3, o.h ?? 0.2, o.d ?? 0.24, M("planks", P(o.pal, "propLight", "#c9a46a"), { count: 2 }), { y: (o.h ?? 0.2) / 2 })); return place(W, g, o, "box", { collide: false }); },
  bookPile(W, o = {}) { const g = grp(), r = W.rand.fork(61); let y = 0; for (let i = 0; i < 3 + Math.floor(r() * 3); i++) { const h = 0.04 + r() * 0.03; g.add(box(0.26 + r() * 0.08, h, 0.2, M("flat", shadeHex(P(o.pal, "prop", "#8a3b30"), (r() - 0.5) * 0.5)), { y: y + h / 2, ry: (r() - 0.5) * 0.5 })); y += h; } return place(W, g, o, "books", { collide: false }); },
  phone(W, o = {}) { const g = grp(); g.add(box(0.08, 0.01, 0.15, M("flat", "#222"), { y: 0.005 })); g.add(box(0.07, 0.005, 0.13, glow([0.8, 1.2, 1.6]), { y: 0.012 })); return place(W, g, o, "phone", { collide: false }); },
  bin(W, o = {}) { const g = grp(); g.add(cyl(0.18, 0.15, 0.4, M("flat", P(o.pal, "metal", "#8a9098")), { y: 0.2, seg: 14 })); return place(W, g, o, "bin"); },
  coatRack(W, o = {}) { const g = grp(); g.add(cyl(0.025, 0.025, 1.8, M("wood", P(o.pal, "wood", "#6b4429")), { y: 0.9 })); g.add(cyl(0.2, 0.22, 0.03, M("wood", "#6b4429"), { y: 0.015, seg: 14 }));
    g.add(box(0.35, 0.7, 0.12, M("flat", P(o.pal, "fabric", "#4a5a7a")), { x: 0.1, y: 1.35, rz: 0.1 })); return place(W, g, o, "coat rack"); },
  extinguisher(W, o = {}) { const g = grp(); g.add(cyl(0.08, 0.08, 0.45, M("flat", "#c8282a"), { y: 0.28, seg: 12 })); g.add(box(0.04, 0.1, 0.12, M("flat", "#222"), { y: 0.55 })); return place(W, g, o, "extinguisher", { collide: false }); },
  ladder(W, o = {}) { const g = grp(), h = o.h ?? 2.2, m = M("wood", P(o.pal, "wood", "#8a5a36")); for (const s of [-1, 1]) g.add(box(0.05, h, 0.05, m, { x: s * 0.22, y: h / 2 })); for (let i = 1; i < h / 0.3; i++) g.add(box(0.44, 0.03, 0.04, m, { y: i * 0.3 })); g.rotation.x = -0.25; return place(W, g, o, "ladder"); },
  workbench(W, o = {}) { const g = prop.table(W, { ...o, w: o.w ?? 2.0, d: 0.8, h: 0.9 }); const r = W.rand.fork(71);
    for (let i = 0; i < 4; i++) g.add(box(0.2 + r() * 0.2, 0.06, 0.08, M("flat", ["#888", "#c94a3a", "#d9b25a", "#555"][i]), { x: -0.7 + i * 0.45, y: 0.96, z: (r() - 0.5) * 0.4, ry: r() })); g.name = "workbench"; return g; },
  toolBoard(W, o = {}) { const g = grp(), r = W.rand.fork(73); g.add(box(1.4, 0.9, 0.03, M("dirt", "#c9a06a"), {}));
    for (let i = 0; i < 7; i++) g.add(box(0.04, 0.2 + r() * 0.2, 0.03, M("flat", ["#555", "#c94a3a", "#888", "#3a6a9a"][i % 4]), { x: -0.55 + i * 0.18, y: (r() - 0.5) * 0.3, z: 0.03, rz: (r() - 0.5) * 0.4 }));
    g.userData.wall = true; return place(W, g, { ...o, y: o.y ?? 1.5 }, "tool board", { collide: false }); },
  // ---------- street ----------
  streetLamp(W, o = {}) { const g = grp(), m = M("flat", P(o.pal, "dark", "#2e2a34")); g.add(cyl(0.07, 0.1, 3.6, m, { y: 1.8 })); g.add(box(0.8, 0.06, 0.06, m, { x: 0.35, y: 3.55 }));
    g.add(cyl(0.12, 0.22, 0.22, m, { x: 0.7, y: 3.45 })); g.add(ball(0.1, glow(o.on ? [4, 2.8, 1.4] : [1.3, 1.25, 1.1]), { x: 0.7, y: 3.34, detail: 1 })); return place(W, g, o, "street lamp"); },
  hydrant(W, o = {}) { const g = grp(), c = M("flat", P(o.pal, "accent", "#c8282a")); g.add(cyl(0.14, 0.16, 0.55, c, { y: 0.28 })); g.add(ball(0.15, c, { y: 0.58, detail: 1 })); g.add(cyl(0.06, 0.06, 0.32, c, { y: 0.4, rz: Math.PI / 2 })); return place(W, g, o, "hydrant"); },
  mailbox(W, o = {}) { const g = grp(); g.add(cyl(0.05, 0.05, 1.0, M("flat", "#444"), { y: 0.5 })); g.add(box(0.3, 0.3, 0.5, M("flat", P(o.pal, "accent", "#2a5aa0")), { y: 1.15 })); return place(W, g, o, "mailbox"); },
  trashCan(W, o = {}) { const g = grp(); g.add(cyl(0.3, 0.26, 0.85, M("flat", P(o.pal, "prop2", "#4a6a4a")), { y: 0.43, seg: 16 })); g.add(cyl(0.33, 0.33, 0.05, M("flat", "#333"), { y: 0.88, seg: 16 })); return place(W, g, o, "trash can"); },
  cone(W, o = {}) { const g = grp(); g.add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 14), M("flat", "#f07020"))); g.children[0].position.y = 0.3; g.add(box(0.36, 0.04, 0.36, M("flat", "#222"), { y: 0.02 })); return place(W, g, o, "cone", { collide: false }); },
  car(W, o = {}) { const g = grp(), c = M("flat", o.color || P(o.pal, "prop", "#3a6aa0"));
    g.add(box(1.8, 0.6, 4.0, c, { y: 0.55 })); g.add(box(1.6, 0.55, 2.0, c, { y: 1.1, z: -0.2 }));
    g.add(box(1.5, 0.45, 0.02, M("flat", "#3a4a5a"), { y: 1.12, z: 0.81 })); for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.32, 0.32, 0.22, M("flat", "#222"), { x: sx * 0.85, y: 0.32, z: sz * 1.3, rz: Math.PI / 2, seg: 16 }));
    for (const sx of [-1, 1]) g.add(box(0.3, 0.14, 0.02, glow([2.2, 2.0, 1.6]), { x: sx * 0.6, y: 0.65, z: 2.01 }));
    return place(W, g, o, "car"); },
  awningStall(W, o = {}) { const g = grp(); g.add(box(2.4, 0.9, 1.0, M("planks", P(o.pal, "wood", "#8a5a36"), { count: 4 }), { y: 0.45 }));
    for (const sx of [-1.1, 1.1]) g.add(box(0.07, 2.3, 0.07, M("flat", "#5a4636"), { x: sx, y: 1.15, z: 0.4 }));
    for (let i = 0; i < 6; i++) g.add(box(0.4, 0.05, 1.4, M("flat", i % 2 ? "#f4f0e6" : P(o.pal, "accent", "#c94a3a")), { x: -1.0 + i * 0.4, y: 2.3, z: 0.3, rx: -0.2 }));
    g.userData.top = 0.9; return place(W, g, o, "stall"); },
  bunting(W, o = {}) { const g = grp(), a = o.a || [-3, 3, 0], b = o.b || [3, 3, 0], n = o.n ?? 12;
    for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, sag = Math.sin(u * Math.PI) * 0.35; const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 3), M("flat", i % 3 === 0 ? P(o.pal, "accent", "#e0a030") : i % 3 === 1 ? P(o.pal, "prop3", "#5ab0e0") : "#f4f0e6"));
      f.rotation.x = Math.PI; f.position.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - sag - 0.12, a[2] + (b[2] - a[2]) * u); g.add(f); }
    return place(W, g, { x: 0, z: 0 }, "bunting", { collide: false }); },
};
export const PROP_NAMES = Object.keys(prop);
