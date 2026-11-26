// Characters as camera-facing cards in the 3D world, driven by a timeline.
// Everything is a pure function of t. Walks use planted feet: the foot positions come from the
// distance walked, so feet never slide, even when the walk speeds up or slows down.
import * as THREE from "three";
import { CW, CH, BASE, T, drawFigure } from "./toon.js";
import { LAYER_NOINK, cardPrepassMaterial } from "../core/post.js";
import { clamp, smooth, smoother, rng } from "../core/util.js";

let shadowTex = null;
function contactTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, "rgba(30,20,50,0.55)"); grd.addColorStop(0.55, "rgba(30,20,50,0.3)"); grd.addColorStop(1, "rgba(30,20,50,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

// polyline helpers on the ground plane
function polyLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
function pointAt(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= seg || i === pts.length - 1) {
      const k = seg > 0 ? clamp(d / seg) : 0;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
    }
    d -= seg;
  }
  return pts[pts.length - 1];
}

export class Character {
  // def: { name, look, h (metres), pos: [x, z], seed }
  constructor(def, scene) {
    this.name = def.name; this.look = def.look; this.h = def.h ?? (def.look.role === "child" ? 1.2 : 1.72);
    this.seed = def.seed ?? 1;
    this.inkPx = def.inkPx ?? 8; this.frameH = def.H ?? 1920;
    this.k = T / this.h; // design px per metre
    this.canvas = document.createElement("canvas"); this.canvas.width = CW; this.canvas.height = CH;
    this.g = this.canvas.getContext("2d");
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    const w = CW / this.k, hgt = CH / this.k;
    const geo = new THREE.PlaneGeometry(w, hgt).translate(0, hgt / 2 - (CH - BASE) / this.k, 0);
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, fog: true });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.layers.set(LAYER_NOINK);
    this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.tex, alphaTest: 0.5 });
    this.mesh.userData.ink = "card";
    this.mesh.userData.prepassMat = cardPrepassMaterial(this.tex);
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: contactTexture(), transparent: true, depthWrite: false, fog: false }));
    this.blob.layers.set(LAYER_NOINK); this.blob.userData.ink = "none"; this.blob.renderOrder = 1;
    scene.add(this.mesh, this.blob);
    // timeline
    this.start = def.pos || [0, 0];
    this.walks = []; this.faces = [[0, def.face || "neutral"]]; this.armsT = [[0, "idle"]]; this.looks = []; this.hops = []; this.talks = []; this.vis = [[0, def.visible ?? true]]; this.holds = [];
    this.blinks = this.makeBlinks();
    this.lastKey = "";
  }
  // ---- authoring API (times in seconds) ----
  walk(t0, t1, pts, { ease = 0.25 } = {}) {
    const from = this.posAt(t0);
    const L = polyLength([from, ...pts]), v = L / Math.max(t1 - t0, 1e-3);
    if (v > 1.8 * (this.h / 1.72)) console.error(`[rc] "${this.name}" walks at ${v.toFixed(1)} m/s at ${t0.toFixed(2)} s (reads as running; keep 1.1-1.5 m/s or use place())`);
    this.walks.push({ t0, t1, pts: [from, ...pts], ease }); this.walks.sort((a, b) => a.t0 - b.t0); return this;
  }
  // jump to a spot without walking (between shots)
  place(t, pt) { this.walks.push({ t0: t, t1: t, pts: [pt, pt], ease: 0.25, teleport: true }); this.walks.sort((a, b) => a.t0 - b.t0); return this; }
  face(t, expr) { this.faces.push([t, expr]); this.faces.sort((a, b) => a[0] - b[0]); return this; }
  arms(t, pose) { this.armsT.push([t, pose]); this.armsT.sort((a, b) => a[0] - b[0]); return this; }
  turn(t, dir) { this.looks.push([t, dir === "left" ? -1 : dir === "right" ? 1 : 0]); this.looks.sort((a, b) => a[0] - b[0]); return this; }
  hop(t, height = 0.25) { this.hops.push([t, height]); return this; }
  talk(t0, t1) { this.talks.push([t0, t1]); return this; }
  show(t) { this.vis.push([t, true]); this.vis.sort((a, b) => a[0] - b[0]); return this; }
  hide(t) { this.vis.push([t, false]); this.vis.sort((a, b) => a[0] - b[0]); return this; }
  hold(t0, t1, painter) { this.holds.push([t0, t1, painter]); return this; }

  makeBlinks() {
    const r = rng(this.seed * 977 + 13), out = [];
    let t = r.range(0.3, 1.5);
    while (t < 600) { out.push(t); t += r.range(0.5, 2.3); }
    return out;
  }
  lastBefore(list, t, def) { let v = def; for (const [tt, x] of list) if (tt <= t) v = x; return v; }
  // the value before the latest change, and how long ago that change was (for blends)
  change(list, t, def) {
    let cur = def, prev = def, since = 1e9;
    for (const [tt, x] of list) if (tt <= t) { if (x !== cur) { prev = cur; since = t - tt; } cur = x; }
    return { cur, prev, since };
  }

  // distance walked along the current walk + position
  posAt(t) {
    let p = this.start;
    for (const w of this.walks) {
      if (t < w.t0) break;
      if (w.teleport) { p = w.pts[0]; continue; }
      const L = polyLength(w.pts);
      const d = this.distIn(w, t, L);
      p = pointAt(w.pts, d);
      if (t < w.t1) break;
    }
    return p;
  }
  distIn(w, t, L) {
    const dur = w.t1 - w.t0, u = clamp((t - w.t0) / dur);
    // trapezoid speed profile with eased ends: accelerate over `ease` of the time, cruise, decelerate
    const e = Math.min(w.ease, 0.45);
    const vmax = 1 / (1 - e);
    let s;
    if (u < e) s = 0.5 * vmax * (u * u) / e;
    else if (u > 1 - e) { const q = 1 - u; s = 1 - 0.5 * vmax * (q * q) / e; }
    else s = 0.5 * vmax * e + vmax * (u - e);
    return clamp(s) * L;
  }
  // gait state: total distance walked so far (all walks), current speed and heading
  gait(t) {
    // total distance walked so far over all walks, the walk in progress (or the last finished one)
    let total = 0, last = null;
    for (const w of this.walks) {
      if (t < w.t0) break;
      if (w.teleport) { last = null; continue; }
      const L = polyLength(w.pts);
      if (t <= w.t1) {
        const d = this.distIn(w, t, L);
        const d2 = this.distIn(w, Math.min(t + 1 / 30, w.t1), L), d0 = this.distIn(w, Math.max(t - 1 / 30, w.t0), L);
        const a = pointAt(w.pts, Math.max(0, d - 0.05)), b = pointAt(w.pts, Math.min(L, d + 0.05));
        return { total: total + d, dIn: d, speed: (d2 - d0) * 15, heading: [b[0] - a[0], b[1] - a[1]], moving: true, walk: w, L, since: 0 };
      }
      total += L;
      last = { walk: w, L, since: t - w.t1 };
    }
    return last ? { total, dIn: last.L, speed: 0, heading: null, moving: false, ...last } : { total: 0, speed: 0, heading: null, moving: false };
  }

  update(t, camera, light) {
    const visible = this.lastBefore(this.vis, t, true);
    this.mesh.visible = this.blob.visible = visible;
    if (!visible) return;
    const [x, z] = this.posAt(t);
    const G = this.gait(t);
    const k = this.k;
    // camera-facing (around Y only)
    const camRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0); camRight.y = 0; camRight.normalize();
    const camFwd = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2).negate(); camFwd.y = 0; camFwd.normalize();
    // screen facing from walking direction, else from turn() keys
    let lookDir = this.lastBefore(this.looks, t, 0.35);
    if (G.heading && Math.hypot(...G.heading) > 1e-4) {
      const sx = G.heading[0] * camRight.x + G.heading[1] * camRight.z;
      if (Math.abs(sx) > 0.02) lookDir = Math.sign(sx) * 0.9;
    }
    // ---- planted feet ----
    const stride = 0.56 * (this.h / 1.72); // one step, metres (about 13 frames per step at 1.3 m/s)
    const phase = G.total / stride;
    const standX = (i) => (i ? 1 : -1) * 0.07 * this.h;
    const feet = [];
    for (let i = 0; i < 2; i++) {
      let lx = standX(i), lift = 0;
      if (G.walk) {
        // foot i lands at walked distances (2n + i) * stride; it stays planted while the body is
        // within 0.6 stride of that point, then swings 2 strides forward with a small lift
        const n = Math.round((phase - i) / 2);
        const c = (2 * n + i) * stride;
        const off = G.total - c;
        let footDist = c;
        if (off > 0.6 * stride) { const u = clamp((off - 0.6 * stride) / (0.8 * stride)); footDist = c + 2 * stride * smooth(u); lift = Math.sin(Math.PI * u) * 0.09 * this.h; }
        else if (off < -0.6 * stride) { const u = clamp((off + 1.4 * stride) / (0.8 * stride)); footDist = c - 2 * stride + 2 * stride * smooth(u); lift = Math.sin(Math.PI * u) * 0.09 * this.h; }
        const fw = pointAt(G.walk.pts, clamp(footDist - (G.total - G.dIn), -50, G.L + 50));
        const contact = (fw[0] - x) * camRight.x + (fw[1] - z) * camRight.z + standX(i) * 0.4;
        const settle = G.moving ? 0 : smooth(G.since / 0.25);
        lx = contact * (1 - settle) + standX(i) * settle;
        lift *= 1 - settle;
      }
      feet.push([CW / 2 + lx * k, BASE - lift * k]);
    }
    // ---- body bob + lean ----
    const speedN = clamp(Math.abs(G.speed) / (1.3 * this.h / 1.72));
    const f = phase - Math.floor(phase);
    // screen scale of this card: how many screen pixels one card pixel covers right now
    const dist = Math.max(0.3, camera.position.distanceTo(new THREE.Vector3(x, this.h * 0.55, z)));
    const pxPerMetre = (this.frameH / 2) / (Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * dist);
    const screenPerCard = pxPerMetre / k;
    const S = this.frameH / 1920;
    const q = (v) => Math.round(v * 10) / 10; // quantised, so the card is not redrawn for tiny changes
    const inkScale = q(clamp(this.inkPx * S / screenPerCard / 9, 0.5, 4.5));
    const limb = q(clamp(16 * S / screenPerCard, 9, 46));
    const idle = G.moving ? 0 : 1.5 * S / screenPerCard * Math.sin(t * 2 * Math.PI / 1.7 + this.seed); // 1-2 px breathing
    const bob = G.moving ? -0.025 * this.h * k * Math.cos(2 * Math.PI * f) * speedN - 0.012 * this.h * k * speedN : idle;
    const lean = G.moving ? lookDir * (0.017 + 0.10 * speedN) : 0; // ~1..7 degrees
    // ---- hop ----
    let hopY = 0;
    for (const [th, hh] of this.hops) { const u = (t - th) / 0.4; if (u > 0 && u < 1) hopY = Math.max(hopY, 4 * u * (1 - u) * hh); }
    // ---- face ----
    const blink = this.blinks.some((b) => t >= b && t < b + 4 / 30);
    let talk = 0;
    for (const [a, b] of this.talks) if (t >= a && t < b) talk = 0.5 + 0.5 * Math.sin((t - a) * 22);
    const holdP = this.holds.find(([a, b]) => t >= a && t < b);
    // face changes settle over 4 frames, arm poses blend over 9 frames (eased)
    const fc = this.change(this.faces, t, "neutral"), ac = this.change(this.armsT, t, "idle");
    const exprU = clamp(fc.since / (4 / 30)), armsU = smooth(clamp(ac.since / (9 / 30)));
    const pose = {
      expr: fc.cur, exprU: exprU >= 1 ? 1 : Math.round(exprU * 4) / 4, arms: ac.cur, armsPrev: ac.prev, armsU: armsU >= 1 ? 1 : armsU,
      blink, look: lookDir, lean, bob, feet, talk: Math.round(talk * 3) / 3, time: t, hold: holdP ? holdP[2] : null, inkScale, limb,
    };
    const key = JSON.stringify([pose.expr, pose.exprU, pose.arms, pose.armsU.toFixed(2), blink, lookDir.toFixed(2), lean.toFixed(3), bob.toFixed(1), feet.map((p) => p.map((v) => v.toFixed(1))), pose.talk, ["wave", "clap"].includes(pose.arms) ? t.toFixed(3) : 0, !!holdP, inkScale, limb]);
    if (key !== this.lastKey) { drawFigure(this.g, this.look, pose); this.tex.needsUpdate = true; this.lastKey = key; }
    this.feetWorld = feet.map(([fx, fy]) => [x + camRight.x * (fx - CW / 2) / k, z + camRight.z * (fx - CW / 2) / k, (BASE - fy) / k]); // for QA (foot-slide check)
    this.mesh.position.set(x, hopY, z);
    // cards face the camera around Y; seen from high above (aerials) they also tip back toward the lens
    const elev = Math.atan2(camera.position.y - this.h * 0.5, Math.hypot(camera.position.x - x, camera.position.z - z));
    const tip = clamp((elev - 0.55) * 1.4, 0, 1.25);
    this.mesh.rotation.set(-tip, Math.atan2(camera.position.x - x, camera.position.z - z), 0, "YXZ");
    const s = 0.55 * this.h * (1 - clamp(hopY / this.h));
    this.blob.position.set(x, 0.03, z); this.blob.scale.set(s, 1, s * 0.6);
    if (light) this.mat.color.setRGB(...light.card);
  }
  // a point between the eyes (focus target for the lens)
  eyes(t) { const [x, z] = this.posAt(t); return new THREE.Vector3(x, this.h * (1 - 0.5 / (this.look.heads || 3.5)), z); }
}

// Effect sprites: flat cards that pop in (burst, sweat, question, exclamation, notes, stars, dust).
export class Fx {
  constructor(scene) { this.scene = scene; this.items = []; this.emitters = []; }
  add(kind, t0, t1, pos, { size = 0.6, color = "#ffd84a" } = {}) {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    drawFx(c.getContext("2d"), kind, color);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide }));
    m.layers.set(LAYER_NOINK); m.userData.ink = "none";
    this.scene.add(m);
    this.items.push({ m, t0, t1, pos: new THREE.Vector3(...pos), kind });
    return this;
  }
  // Animated signature effects, chosen from the story: steam, smoke, dust, splash, sparkle, ring, crowd.
  //   fx.emit(kind, t0, t1, [x, y, z], { size, color, count, rise, spread, area: [w, d] (crowd), colors: [...] (crowd) })
  // Every particle is a pure function of t (seeded), drawn in the same flat inked style.
  emit(kind, t0, t1, pos, o = {}) {
    const D = { steam: [10, 0.5], smoke: [9, 0.9], dust: [8, 0.6], splash: [14, 0.18], sparkle: [10, 0.28], ring: [1, 1.6], crowd: [40, 0.32] }[kind];
    if (!D) throw new Error(`[rc] unknown effect "${kind}". Use one of: steam, smoke, dust, splash, sparkle, ring, crowd`);
    const count = o.count ?? D[0], size = o.size ?? D[1];
    const r = rng(Math.round(t0 * 1000) + count * 7 + kind.length);
    const tex = particleTexture(kind, o.color);
    const parts = [];
    for (let i = 0; i < count; i++) {
      const col = kind === "crowd" ? (o.colors || ["#e2574c", "#3d7bd9", "#f0b93a", "#4f9d5d", "#8a5bc4", "#ece4d4"])[i % (o.colors?.length || 6)] : null;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), kind === "ring"
        ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(...(o.glow || [2.2, 1.9, 1.2])), side: THREE.DoubleSide })
        : new THREE.MeshBasicMaterial({ map: kind === "crowd" ? particleTexture("crowd", col) : tex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide }));
      m.layers.set(LAYER_NOINK); m.userData.ink = "none"; m.visible = false;
      this.scene.add(m);
      parts.push({ m, seed: r.range(0, 1), a: r.range(0, Math.PI * 2), v: r.range(0.6, 1.0), dx: r.range(-1, 1), dz: r.range(-1, 1) });
    }
    this.emitters.push({ kind, t0, t1, pos: new THREE.Vector3(...pos), size, parts, o });
    return this;
  }
  update(t, camera) {
    for (const e of this.emitters) updateEmitter(e, t, camera);
    for (const it of this.items) {
      const on = t >= it.t0 && t < it.t1;
      it.m.visible = on;
      if (!on) continue;
      const f = Math.round((t - it.t0) * 30);
      const pop = f < 2 ? 0.6 + f * 0.35 : f < 4 ? 1.12 - (f - 2) * 0.06 : 1;
      const rise = it.kind === "notes" || it.kind === "sweat" ? (t - it.t0) * 0.25 : 0;
      it.m.position.copy(it.pos).y += rise * (it.kind === "sweat" ? -1 : 1);
      it.m.scale.setScalar(pop);
      it.m.quaternion.copy(camera.quaternion);
    }
  }
}
const INK = "#16121a";
const texCache = new Map();
function particleTexture(kind, color) {
  const key = kind + (color || "");
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"); g.lineJoin = "round"; g.strokeStyle = INK; g.lineWidth = 7;
  const puff = (fill) => { g.beginPath(); for (const [x, y, rr] of [[50, 74, 30], [78, 70, 32], [64, 50, 30]]) { g.moveTo(x + rr, y); g.arc(x, y, rr, 0, 7); } g.fillStyle = fill; g.fill(); g.stroke(); g.fill(); };
  switch (kind) {
    case "steam": puff(color || "#f4f1ec"); break;
    case "smoke": puff(color || "#8d8792"); break;
    case "dust": puff(color || "#e3d4b8"); break;
    case "splash": g.beginPath(); g.moveTo(64, 12); g.quadraticCurveTo(108, 78, 64, 112); g.quadraticCurveTo(20, 78, 64, 12); g.fillStyle = color || "#7cc7f2"; g.fill(); g.stroke(); break;
    case "sparkle": g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 16 : 56; g.lineTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr); } g.closePath(); g.fillStyle = color || "#ffe27a"; g.fill(); g.stroke(); break;
    case "ring": { const grd = g.createRadialGradient(64, 64, 34, 64, 64, 62); grd.addColorStop(0, "rgba(255,255,255,0)"); grd.addColorStop(0.45, "rgba(255,255,255,1)"); grd.addColorStop(0.6, "rgba(255,255,255,1)"); grd.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = grd; g.fillRect(0, 0, 128, 128); break; }
    case "crowd": g.beginPath(); g.arc(64, 40, 22, 0, 7); g.fillStyle = "#e9c6a4"; g.fill(); g.stroke(); g.beginPath(); g.ellipse(64, 96, 30, 30, 0, Math.PI, 0); g.lineTo(94, 124); g.lineTo(34, 124); g.closePath(); g.fillStyle = color || "#3d7bd9"; g.fill(); g.stroke(); break;
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}
function updateEmitter(e, t, camera) {
  const { kind, t0, t1, pos, size, parts, o } = e;
  const n = parts.length;
  parts.forEach((p, i) => {
    let vis = false, x = 0, y = 0, z = 0, sc = size;
    if (kind === "steam" || kind === "smoke" || kind === "dust") {
      const L = kind === "smoke" ? 2.2 : kind === "dust" ? 0.9 : 1.6;
      const born = t0 + (i / n) * L, age = t - born;
      if (age >= 0 && t < t1 + L) {
        const cyc = age % L, u = cyc / L, gen = Math.floor(age / L);
        if (born + gen * L < t1) {
          vis = true;
          const rise = (o.rise ?? (kind === "dust" ? 0.35 : 1.1)) * u, spread = o.spread ?? (kind === "dust" ? 0.9 : 0.25);
          x = p.dx * spread * u + Math.sin(u * 5 + p.a) * 0.05; y = rise; z = p.dz * spread * u * 0.4;
          sc = size * (0.45 + 1.1 * u) * (1 - smooth(clamp((u - 0.78) / 0.22)));
        }
      }
    } else if (kind === "splash") {
      const age = t - t0;
      if (age >= 0 && age < 0.8 && t < t1) {
        const sp = (o.spread ?? 2.2) * p.v, up = 3.2 * p.v;
        x = Math.cos(p.a) * sp * age; z = Math.sin(p.a) * sp * age * 0.5; y = up * age - 4.9 * age * age;
        vis = y > -0.05; sc = size * (1 - age * 0.6);
      }
    } else if (kind === "sparkle") {
      if (t >= t0 && t < t1) {
        const ph = (t - t0) * 3.2 + p.seed * 6.28;
        const tw = Math.max(0, Math.sin(ph));
        vis = tw > 0.08; const rr = (o.spread ?? 0.7) * Math.sqrt(p.seed);
        x = Math.cos(p.a) * rr; y = Math.sin(p.a) * rr * 0.9; z = 0; sc = size * (0.4 + 0.8 * tw);
      }
    } else if (kind === "ring") {
      const age = t - t0;
      if (age >= 0 && t < t1) { const u = clamp(age / 0.5); vis = true; sc = size * (0.15 + 0.85 * (1 - Math.pow(1 - u, 3))); }
    } else if (kind === "crowd") {
      if (t >= t0 && t < t1) {
        const [aw, ad] = o.area || [6, 3];
        const cols = Math.ceil(Math.sqrt(n * aw / ad)), row = Math.floor(i / cols), col = i % cols;
        x = (col / Math.max(1, cols - 1) - 0.5) * aw + p.dx * 0.12; z = (row / Math.max(1, Math.ceil(n / cols) - 1) - 0.5) * ad + p.dz * 0.1;
        y = size * 0.5 + Math.abs(Math.sin((t - t0) * (3 + p.v * 2) + p.a)) * size * 0.12; vis = true;
      }
    }
    p.m.visible = vis;
    if (!vis) return;
    p.m.position.set(pos.x + x, pos.y + y, pos.z + z);
    p.m.scale.setScalar(Math.max(0.001, sc));
    p.m.quaternion.copy(camera.quaternion);
  });
}
function drawFx(g, kind, color) {
  g.lineJoin = "round"; g.lineCap = "round"; g.strokeStyle = INK; g.lineWidth = 10;
  const star = (n, r1, r2) => { g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? r2 : r1; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.closePath(); };
  switch (kind) {
    case "burst": star(10, 118, 62); g.fillStyle = color; g.fill(); g.stroke(); break;
    case "stars": for (const [x, y, s] of [[70, 80, 40], [180, 110, 30], [120, 190, 26]]) { g.save(); g.translate(x - 128, y - 128); g.scale(s / 60, s / 60); g.translate(128 * (1 - 60 / s) * 0, 0); star(5, 60, 26); g.restore(); g.save(); g.translate(x, y); g.scale(s / 60, s / 60); g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 26 : 60; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fillStyle = color; g.fill(); g.lineWidth = 10 * 60 / s; g.stroke(); g.restore(); } break;
    case "sweat": g.beginPath(); g.moveTo(128, 30); g.quadraticCurveTo(200, 150, 128, 200); g.quadraticCurveTo(56, 150, 128, 30); g.fillStyle = "#8fd0ff"; g.fill(); g.stroke(); break;
    case "question": g.font = "900 210px Montserrat, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 16; g.strokeText("?", 128, 136); g.fillStyle = color; g.fillText("?", 128, 136); break;
    case "exclaim": g.font = "900 210px Montserrat, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 16; g.strokeText("!", 128, 136); g.fillStyle = color; g.fillText("!", 128, 136); break;
    case "notes": g.fillStyle = INK; for (const [x, y] of [[80, 170], [170, 140]]) { g.beginPath(); g.ellipse(x, y, 26, 20, -0.4, 0, 7); g.fill(); g.fillRect(x + 18, y - 110, 9, 110); } g.fillRect(105, 30, 92, 14); break;
    case "dust": for (const [x, y, r] of [[90, 160, 52], [160, 150, 60], [128, 110, 48]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = "#efe6d6"; g.fill(); g.stroke(); } break;
    case "heart": g.beginPath(); g.moveTo(128, 210); g.bezierCurveTo(20, 140, 40, 40, 128, 90); g.bezierCurveTo(216, 40, 236, 140, 128, 210); g.fillStyle = "#e8505b"; g.fill(); g.stroke(); break;
    default: star(8, 100, 50); g.fillStyle = color; g.fill(); g.stroke();
  }
}
export { smoother };
