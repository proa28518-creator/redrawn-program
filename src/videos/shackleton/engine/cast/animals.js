// Animals as flat inked cards, in the same style as the characters: flat shapes, one even near-black
// outline (settings.ink_px on screen), black stick legs, big round eyes. Never glossy 3D.
//   const dog = cast.animal({ name: "dog", species: "dog", pos: [x, z], h: 0.6, color: "#c98a4a", seed })
//   dog.walk(t0, t1, [[x, z], ...]).face(t, "surprised").act(t0, t1, "wag").turn(t, "left").hop(t).hide(t).show(t)
// Species: dog cat rat pig cow sheep horse bird chicken fish.  Faces: neutral happy surprised angry sleepy.
// Actions: wag (tail), peck (birds), sit (four-legged), swim (fish wiggle), eat (head down).
import * as THREE from "three";
import { LAYER_NOINK, cardPrepassMaterial } from "../core/post.js";
import { clamp, smooth } from "../core/util.js";

const AW = 512, AH = 512, ABASE = 488;
const INK = "#16121a";
let INKS = 1, LEG = 10;

// body plan per species (design px; the animal faces +x / right)
const PLAN = {
  dog:   { kind: "quad", body: [150, 70], legH: 70, head: 52, snout: [34, 22], ears: "flop", tail: "up", color: "#c98a4a", belly: "#efd8b4", h: 0.62 },
  cat:   { kind: "quad", body: [140, 56], legH: 64, head: 46, snout: [10, 8], ears: "point", tail: "curl", color: "#e0a050", belly: "#f6e2c4", h: 0.42, whiskers: true },
  rat:   { kind: "quad", body: [120, 46], legH: 26, head: 34, snout: [28, 14], ears: "round", tail: "long", color: "#9c938c", belly: "#d8cfc6", h: 0.16, whiskers: true },
  pig:   { kind: "quad", body: [160, 84], legH: 46, head: 52, snout: [20, 22], ears: "point", tail: "curl", color: "#f2a9b2", belly: "#f8c9cf", h: 0.75, nose: true },
  cow:   { kind: "quad", body: [200, 96], legH: 92, head: 56, snout: [30, 30], ears: "side", tail: "rope", color: "#f1ece2", belly: "#f1ece2", h: 1.45, spots: "#2c2628", horns: true },
  sheep: { kind: "quad", body: [160, 92], legH: 56, head: 42, snout: [20, 18], ears: "side", tail: "stub", color: "#f4f0e6", belly: "#f4f0e6", face: "#3a3236", h: 0.95, wool: true },
  horse: { kind: "quad", body: [210, 90], legH: 120, head: 52, snout: [56, 28], ears: "point", tail: "rope", color: "#8a5a36", belly: "#a87448", h: 1.65, mane: "#3a2620", neck: true },
  bird:  { kind: "bird", body: [96, 66], legH: 34, head: 40, beak: "short", color: "#9aa3b4", belly: "#c7cbd6", neckBand: "#6fae8f", h: 0.32 },
  chicken: { kind: "bird", body: [110, 84], legH: 40, head: 42, beak: "short", color: "#f3efe6", belly: "#f3efe6", comb: "#d9473a", h: 0.45 },
  fish:  { kind: "fish", body: [150, 74], color: "#f0973a", belly: "#f7c58a", fin: "#e0702a", h: 0.3 },
};
export const SPECIES = Object.keys(PLAN);

function inked(g, pathFn, fill, w = 9) {
  g.beginPath(); pathFn(g);
  if (fill) { g.fillStyle = fill; g.fill(); }
  g.lineWidth = w * INKS; g.strokeStyle = INK; g.lineJoin = "round"; g.lineCap = "round"; g.stroke();
}
function stick(g, pts, w = LEG) {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.lineWidth = w; g.strokeStyle = INK; g.lineCap = "round"; g.lineJoin = "round"; g.stroke();
}
function dot(g, x, y, r, c = INK) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = c; g.fill(); }
function eye(g, x, y, r, face, blink) {
  if (blink || face === "sleepy") { stick(g, [[x - r * 0.8, y], [x + r * 0.8, y]], 5 * INKS); return; }
  if (face === "happy") { g.beginPath(); g.arc(x, y + r * 0.4, r * 0.8, Math.PI * 1.1, Math.PI * 1.9); g.lineWidth = 5 * INKS; g.strokeStyle = INK; g.stroke(); return; }
  const rr = face === "surprised" ? r * 1.3 : r;
  inked(g, (p) => p.ellipse(x, y, rr * 0.9, rr, 0, 0, Math.PI * 2), "#fbf7f0", 4);
  dot(g, x + rr * 0.25, y, rr * (face === "surprised" ? 0.32 : 0.45));
  if (face === "angry") stick(g, [[x - rr, y - rr * 1.2], [x + rr, y - rr * 0.7]], 5 * INKS);
}

function drawQuad(g, P, st) {
  const [bw, bh] = P.body, legH = P.legH;
  const cx = AW / 2 - 10, by = ABASE - legH - bh / 2 + st.bob + (st.sit ? legH * 0.45 : 0);
  // legs: two pairs, diagonal pairs swing together
  const hipX = [cx - bw * 0.34, cx + bw * 0.32];
  for (const [i, hx] of hipX.entries()) for (const side of [0, 1]) {
    const ph = st.phase + (i ? 0.5 : 0) + side * 0.5;
    const sw = st.moving ? Math.sin(ph * Math.PI * 2) * 0.42 : 0;
    const top = [hx + (side ? 8 : -8), by + bh * 0.3];
    let foot = [top[0] + Math.sin(sw) * legH, ABASE - Math.max(0, Math.cos(ph * Math.PI * 2)) * (st.moving ? legH * 0.12 : 0)];
    if (st.sit && i === 0) foot = [top[0] + legH * 0.5, ABASE];
    stick(g, [top, [top[0] + (foot[0] - top[0]) * 0.5 + (i ? 4 : -4), (top[1] + foot[1]) / 2], foot]);
  }
  // tail
  const tx = cx - bw / 2, ty = by - bh * 0.1, wag = st.wag ? Math.sin(st.t * 18) * 0.5 : 0;
  if (P.tail === "up") stick(g, [[tx + 6, ty], [tx - 26, ty - 34 - 10 * wag], [tx - 30 + 12 * wag, ty - 62]], LEG * 1.1);
  else if (P.tail === "curl") { g.beginPath(); g.arc(tx - 16, ty - 18, 18, 0.3 + wag, Math.PI * 1.6 + wag); g.lineWidth = LEG; g.strokeStyle = INK; g.stroke(); }
  else if (P.tail === "long") stick(g, [[tx + 4, ty + 6], [tx - 40, ty + 20 + 10 * wag], [tx - 90, ty + 4]], LEG * 0.7);
  else if (P.tail === "rope") { stick(g, [[tx + 4, ty - 6], [tx - 14, ty + 40 + 6 * wag], [tx - 18, ty + 70]], LEG * 0.8); inked(g, (p) => p.ellipse(tx - 18, ty + 78, 9, 14, 0, 0, 7), P.mane || INK, 5); }
  else if (P.tail === "stub") inked(g, (p) => p.arc(tx + 2, ty - 6, 14, 0, 7), P.color, 7);
  // body
  if (P.wool) inked(g, (p) => { for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; p.moveTo(cx + Math.cos(a) * bw * 0.42 + 22, by + Math.sin(a) * bh * 0.42); p.arc(cx + Math.cos(a) * bw * 0.42, by + Math.sin(a) * bh * 0.42, 22, 0, 7); } p.ellipse(cx, by, bw * 0.45, bh * 0.45, 0, 0, 7); }, P.color, 7);
  else inked(g, (p) => p.ellipse(cx, by, bw / 2, bh / 2, 0, 0, Math.PI * 2), P.color);
  if (P.spots) for (const [sx, sy, sr] of [[-30, -10, 22], [26, 8, 18], [-2, 24, 12]]) { g.save(); g.beginPath(); g.ellipse(cx, by, bw / 2 - 4, bh / 2 - 4, 0, 0, 7); g.clip(); dot(g, cx + sx, by + sy, sr, P.spots); g.restore(); }
  // head (on a neck for horses)
  const down = st.eat ? bh * 0.9 : 0;
  const hx = cx + bw / 2 - 6 + (P.neck ? 24 : 0), hy = by - bh * (P.neck ? 0.85 : 0.35) + down;
  if (P.neck) { inked(g, (p) => { p.moveTo(cx + bw * 0.3, by - bh * 0.3); p.lineTo(hx - 10, hy - 18); p.lineTo(hx + 18, hy + 6); p.lineTo(cx + bw * 0.46, by + bh * 0.1); p.closePath(); }, P.color); if (P.mane) inked(g, (p) => { p.moveTo(cx + bw * 0.28, by - bh * 0.34); p.lineTo(hx - 14, hy - 24); p.lineTo(hx - 24, hy - 4); p.closePath(); }, P.mane, 6); }
  const hr = P.head;
  if (P.ears === "point") for (const s of [-1, 1]) inked(g, (p) => { p.moveTo(hx + s * hr * 0.5 - 8, hy - hr * 0.6); p.lineTo(hx + s * hr * 0.35, hy - hr * 1.35); p.lineTo(hx + s * hr * 0.1 + 6, hy - hr * 0.75); p.closePath(); }, P.color, 7);
  if (P.ears === "round") for (const s of [-1, 1]) inked(g, (p) => p.arc(hx + s * hr * 0.5, hy - hr * 0.75, hr * 0.42, 0, 7), P.belly, 6);
  if (P.horns) for (const s of [-1, 1]) inked(g, (p) => { p.moveTo(hx + s * hr * 0.3, hy - hr * 0.8); p.quadraticCurveTo(hx + s * hr * 0.9, hy - hr * 1.2, hx + s * hr * 0.7, hy - hr * 1.5); p.lineTo(hx + s * hr * 0.5, hy - hr * 0.85); p.closePath(); }, "#efe2c0", 5);
  inked(g, (p) => p.ellipse(hx, hy, hr, hr * 0.92, 0, 0, Math.PI * 2), P.face || P.color);
  if (P.ears === "flop" || P.ears === "side") for (const s of [-1, 1]) inked(g, (p) => p.ellipse(hx + s * hr * 0.85, hy - hr * 0.2, hr * 0.28, hr * 0.55, s * 0.4, 0, 7), P.ears === "flop" ? shade(P.color) : P.color, 6);
  const [snw, snh] = P.snout;
  if (snw) inked(g, (p) => p.ellipse(hx + hr * 0.78, hy + hr * 0.3, snw, snh, 0, 0, Math.PI * 2), P.belly, 7);
  dot(g, hx + hr * 0.78 + snw * 0.75, hy + hr * 0.3 - snh * 0.3, Math.max(5, snh * 0.32));
  if (P.nose) { dot(g, hx + hr * 0.78 + 4, hy + hr * 0.3, 4, "#7a3a44"); dot(g, hx + hr * 0.78 + 14, hy + hr * 0.3, 4, "#7a3a44"); }
  if (P.whiskers) for (const k of [-1, 1]) stick(g, [[hx + hr * 0.9, hy + hr * 0.35], [hx + hr * 1.5, hy + hr * 0.35 + k * 10]], 3 * INKS);
  eye(g, hx + hr * 0.28, hy - hr * 0.15, hr * 0.32, st.face, st.blink);
}
function shade(hex) { const n = parseInt(hex.slice(1), 16), k = 0.78; return "#" + [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k).toString(16).padStart(2, "0")).join(""); }

function drawBird(g, P, st) {
  const [bw, bh] = P.body, legH = P.legH;
  const cx = AW / 2 - 10, by = ABASE - legH - bh / 2 + st.bob;
  // legs
  for (const side of [0, 1]) {
    const ph = st.phase + side * 0.5, sw = st.moving ? Math.sin(ph * Math.PI * 2) * 0.5 : 0;
    const top = [cx + 6 + side * 10, by + bh * 0.38];
    const foot = [top[0] + Math.sin(sw) * legH, ABASE - (st.moving ? Math.max(0, Math.cos(ph * Math.PI * 2)) * legH * 0.25 : 0)];
    stick(g, [top, foot], LEG * 0.8);
    stick(g, [[foot[0] - 10, foot[1]], [foot[0] + 14, foot[1]]], LEG * 0.7);
  }
  // tail fan, body, wing
  inked(g, (p) => { p.moveTo(cx - bw * 0.3, by - 4); p.lineTo(cx - bw * 0.95, by - 22); p.lineTo(cx - bw * 0.9, by + 14); p.closePath(); }, shade(P.color), 7);
  inked(g, (p) => p.ellipse(cx, by, bw / 2, bh / 2, -0.12, 0, Math.PI * 2), P.color);
  inked(g, (p) => p.ellipse(cx - 10, by - 2, bw * 0.32, bh * 0.26, -0.25 + (st.flap ? Math.sin(st.t * 30) * 0.6 : 0), 0, Math.PI * 2), shade(P.color), 7);
  // head: walking birds bob the head forward and back with each step; peck drops it to the ground
  const bobX = st.moving ? Math.max(0, Math.sin(st.phase * Math.PI * 2)) * 18 - 6 : 0;
  const peck = st.peck ? Math.max(0, Math.sin(st.t * 10)) : 0;
  const hr = P.head, hx = cx + bw * 0.42 + bobX + peck * 20, hy = by - bh * 0.55 + peck * (bh * 0.9 + legH * 0.7);
  if (P.neckBand) inked(g, (p) => p.ellipse(cx + bw * 0.3 + bobX * 0.5, by - bh * 0.32 + peck * bh * 0.4, hr * 0.7, hr * 0.55, 0.4, 0, 7), P.neckBand, 6);
  inked(g, (p) => p.arc(hx, hy, hr, 0, Math.PI * 2), P.color);
  if (P.comb) inked(g, (p) => { for (let k = 0; k < 3; k++) { p.moveTo(hx - 14 + k * 14 + 9, hy - hr * 0.9); p.arc(hx - 14 + k * 14, hy - hr * 0.95, 9, 0, 7); } }, P.comb, 5);
  inked(g, (p) => { p.moveTo(hx + hr * 0.85, hy - 8); p.lineTo(hx + hr * 1.55, hy + 2); p.lineTo(hx + hr * 0.85, hy + 10); p.closePath(); }, "#f0c060", 6);
  eye(g, hx + hr * 0.3, hy - hr * 0.15, hr * 0.36, st.face, st.blink);
}

function drawFish(g, P, st) {
  const [bw, bh] = P.body;
  const cx = AW / 2, cy = AH / 2;
  const w = Math.sin(st.t * (st.swim ? 9 : 4)) * 0.18;
  inked(g, (p) => { p.moveTo(cx - bw * 0.42, cy); p.lineTo(cx - bw * 0.85, cy - bh * 0.5 + w * 40); p.lineTo(cx - bw * 0.82, cy + bh * 0.5 + w * 40); p.closePath(); }, P.fin);
  inked(g, (p) => p.ellipse(cx, cy, bw / 2, bh / 2, w * 0.3, 0, Math.PI * 2), P.color);
  inked(g, (p) => { p.moveTo(cx - 10, cy - bh * 0.42); p.quadraticCurveTo(cx + 10, cy - bh * 0.9, cx + 30, cy - bh * 0.44); p.closePath(); }, P.fin, 6);
  eye(g, cx + bw * 0.28, cy - bh * 0.1, bh * 0.2, st.face, st.blink);
  g.beginPath(); g.arc(cx + bw * 0.42, cy + bh * 0.12, 8, 0.2, Math.PI * 0.8); g.lineWidth = 4 * INKS; g.strokeStyle = INK; g.stroke();
}

function polyLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
function pointAt(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= seg || i === pts.length - 1) { const k = seg > 0 ? clamp(d / seg) : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]; }
    d -= seg;
  }
  return pts[pts.length - 1];
}

export class Animal {
  constructor(def, scene) {
    const P = PLAN[def.species];
    if (!P) throw new Error(`[rc] unknown animal "${def.species}". Use one of: ${SPECIES.join(", ")}`);
    this.name = def.name; this.species = def.species;
    this.plan = { ...P, ...(def.color ? { color: def.color } : {}), ...(def.belly ? { belly: def.belly } : {}), ...(def.colors || {}) };
    this.h = def.h ?? P.h; this.seed = def.seed ?? 1;
    this.inkPx = def.inkPx ?? 8; this.frameH = def.H ?? 1920;
    this.fly = def.y ?? (P.kind === "fish" ? 0.6 : 0); // height above the ground (fish swim)
    const designH = P.kind === "fish" ? P.body[1] * 1.6 : P.legH + P.body[1] + P.head * (P.neck ? 2.2 : 1.2);
    this.k = designH / this.h;
    this.canvas = document.createElement("canvas"); this.canvas.width = AW; this.canvas.height = AH;
    this.g = this.canvas.getContext("2d");
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    const w = AW / this.k, hgt = AH / this.k;
    const baseY = P.kind === "fish" ? hgt / 2 : hgt / 2 - (AH - ABASE) / this.k;
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, fog: true });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt).translate(0, baseY, 0), this.mat);
    this.mesh.layers.set(LAYER_NOINK); this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.tex, alphaTest: 0.5 });
    this.mesh.userData.ink = "card"; this.mesh.userData.prepassMat = cardPrepassMaterial(this.tex);
    scene.add(this.mesh);
    this.look = { heads: null };
    this.start = def.pos || [0, 0];
    this.walks = []; this.faces = [[0, def.face || "neutral"]]; this.acts = []; this.looks = []; this.hops = []; this.vis = [[0, def.visible ?? true]];
    this.blinks = []; let bt = 0.4 + (this.seed % 7) * 0.13; while (bt < 600) { this.blinks.push(bt); bt += 1.1 + ((bt * 7.3 + this.seed) % 1.6); }
    this.lastKey = "";
  }
  walk(t0, t1, pts) { const from = this.posAt(t0); this.walks.push({ t0, t1, pts: [from, ...pts] }); this.walks.sort((a, b) => a.t0 - b.t0); return this; }
  place(t, pt) { this.walks.push({ t0: t, t1: t, pts: [pt, pt], teleport: true }); this.walks.sort((a, b) => a.t0 - b.t0); return this; }
  face(t, f) { this.faces.push([t, f]); this.faces.sort((a, b) => a[0] - b[0]); return this; }
  act(t0, t1, kind) { this.acts.push([t0, t1, kind]); return this; }
  turn(t, dir) { this.looks.push([t, dir === "left" ? -1 : 1]); this.looks.sort((a, b) => a[0] - b[0]); return this; }
  hop(t, height = 0.15) { this.hops.push([t, height]); return this; }
  show(t) { this.vis.push([t, true]); this.vis.sort((a, b) => a[0] - b[0]); return this; }
  hide(t) { this.vis.push([t, false]); this.vis.sort((a, b) => a[0] - b[0]); return this; }
  lastBefore(list, t, def) { let v = def; for (const [tt, x] of list) if (tt <= t) v = x; return v; }
  posAt(t) {
    let p = this.start;
    for (const w of this.walks) {
      if (t < w.t0) break;
      if (w.teleport) { p = w.pts[0]; continue; }
      const u = smooth(clamp((t - w.t0) / Math.max(1e-3, w.t1 - w.t0)));
      p = pointAt(w.pts, u * polyLength(w.pts));
      if (t < w.t1) break;
    }
    return p;
  }
  // distance walked so far (drives the leg cycle) and current heading
  gait(t) {
    let total = 0;
    for (const w of this.walks) {
      if (t < w.t0) break;
      if (w.teleport) continue;
      const L = polyLength(w.pts);
      if (t < w.t1) {
        const u = smooth(clamp((t - w.t0) / Math.max(1e-3, w.t1 - w.t0)));
        const a = pointAt(w.pts, Math.max(0, u * L - 0.05)), b = pointAt(w.pts, Math.min(L, u * L + 0.05));
        return { total: total + u * L, moving: true, heading: [b[0] - a[0], b[1] - a[1]] };
      }
      total += L;
    }
    return { total, moving: false, heading: null };
  }
  update(t, camera, light) {
    const visible = this.lastBefore(this.vis, t, true);
    this.mesh.visible = visible;
    if (!visible) return;
    const [x, z] = this.posAt(t), G = this.gait(t), P = this.plan;
    const camRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0); camRight.y = 0; camRight.normalize();
    let dir = this.lastBefore(this.looks, t, 1);
    if (G.heading) { const sx = G.heading[0] * camRight.x + G.heading[1] * camRight.z; if (Math.abs(sx) > 0.01) dir = Math.sign(sx); }
    const dist = Math.max(0.3, camera.position.distanceTo(new THREE.Vector3(x, this.h * 0.5, z)));
    const pxPerMetre = (this.frameH / 2) / (Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * dist);
    const screenPerCard = pxPerMetre / this.k, S = this.frameH / 1920;
    const q = (v) => Math.round(v * 10) / 10;
    INKS = q(clamp(this.inkPx * S / screenPerCard / 9, 0.5, 4.5));
    LEG = q(clamp(12 * S / screenPerCard, 6, 30));
    const stepLen = 0.45 * this.h; // one leg cycle per this many metres
    const act = this.acts.find(([a, b]) => t >= a && t < b);
    const st = {
      t, phase: G.total / stepLen, moving: G.moving, face: this.lastBefore(this.faces, t, "neutral"),
      blink: this.blinks.some((b) => t >= b && t < b + 4 / 30),
      bob: G.moving ? -Math.abs(Math.sin(G.total / stepLen * Math.PI * 2)) * 6 : Math.sin(t * 3.6 + this.seed) * 1.5 * S / screenPerCard,
      wag: act?.[2] === "wag", peck: act?.[2] === "peck", sit: act?.[2] === "sit", eat: act?.[2] === "eat", swim: act?.[2] === "swim" || G.moving, flap: act?.[2] === "flap",
    };
    const key = JSON.stringify([st.phase.toFixed(2), st.moving, st.face, st.blink, st.bob.toFixed(1), act?.[2] || "", act ? t.toFixed(3) : 0, P.kind === "fish" ? t.toFixed(2) : 0, dir, INKS, LEG]);
    if (key !== this.lastKey) {
      const g = this.g; g.clearRect(0, 0, AW, AH);
      g.save(); if (dir < 0) { g.translate(AW, 0); g.scale(-1, 1); }
      (P.kind === "bird" ? drawBird : P.kind === "fish" ? drawFish : drawQuad)(g, P, st);
      g.restore(); this.tex.needsUpdate = true; this.lastKey = key;
    }
    let hopY = 0;
    for (const [th, hh] of this.hops) { const u = (t - th) / 0.35; if (u > 0 && u < 1) hopY = Math.max(hopY, 4 * u * (1 - u) * hh); }
    this.mesh.position.set(x, this.fly + hopY + (P.kind === "fish" ? Math.sin(t * 2 + this.seed) * 0.03 : 0), z);
    // cards face the camera around Y; seen from high above (aerials) they also tip back toward the lens
    const elev = Math.atan2(camera.position.y - this.h * 0.5, Math.hypot(camera.position.x - x, camera.position.z - z));
    const tip = clamp((elev - 0.55) * 1.4, 0, 1.25);
    this.mesh.rotation.set(-tip, Math.atan2(camera.position.x - x, camera.position.z - z), 0, "YXZ");
    if (light) this.mat.color.setRGB(...light.card);
  }
  eyes(t) { const [x, z] = this.posAt(t); return new THREE.Vector3(x, this.fly + this.h * 0.8, z); }
}
