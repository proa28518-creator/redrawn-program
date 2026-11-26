// Camera director. Keys say "at time t, arrive at this pose, gliding for `glide` frames".
// Default: a hard cut (glide 0) into a LOCKED shot. A shot can slowly push in (push > 0) or pull back
// (push < 0, or move: "push" | "pull"). Kicks are short impact shakes that flip sign every frame and decay
// over 7 frames. Transitions: "whip" (fast pan with smear), "flash" (white wipe), "dissolve".
import * as THREE from "three";
import { FPS, clamp, smoother, lerp } from "../core/util.js";

// key: { t, pos:[x,y,z], look:[x,y,z], fov=38, roll=0 (deg), glide=0 (frames; 0 = hard cut), push=0 (% per frame;
//        > 0 slow push-in, < 0 slow pull-back), move: "locked" | "push" | "pull" (push 0 / 0.22 / -0.22), aerial: true,
//        ease: "out" (fast start, long settle - default for glides <= 30 f) | "smooth" (default for longer) | "in" | "linear",
//        path: [[x,y,z], ...]   waypoints the glide passes through (smooth curve, e.g. through a doorway),
//        transition: "whip" | "flash" | "dissolve" (frames: tframes, default 8 for whip/dissolve, 6 for flash; whipDir: 1 | -1),
//        light, lens: { focus: "name" | [x,y,z], px } }
const EASE = {
  out: (x) => 0.85 * (1 - Math.pow(1 - clamp(x), 3)) + 0.15 * clamp(x), // fast start, and never fully stops before arriving
  in: (x) => Math.pow(clamp(x), 3),
  linear: (x) => clamp(x),
  smooth: (x) => smoother(x),
};
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return new THREE.Vector3(
    0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3));
}
// point at u (0..1) along a polyline smoothed with Catmull-Rom, parameterised by distance
function alongPath(pts, u) {
  if (pts.length === 2) return pts[0].clone().lerp(pts[1], u);
  const seg = []; let L = 0;
  for (let i = 0; i < pts.length - 1; i++) { const d = pts[i].distanceTo(pts[i + 1]); seg.push(d); L += d; }
  let d = u * L, i = 0;
  while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
  const t = seg[i] > 0 ? d / seg[i] : 0;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
  return catmull(p0, p1, p2, p3, t);
}
const yawOfKey = (k) => Math.atan2(k.look[0] - k.pos[0], k.look[2] - k.pos[2]);

export class Director {
  constructor(keys, { kicks = [] } = {}) {
    const MOVE = { locked: 0, push: 0.22, pull: -0.22 };
    const DEFAULT_PUSH = 0.22;
    // default: the camera keeps moving. A key without move/push gets a slow push-in (0.22 % per frame) when its shot lasts
    // at least one second and is not an aerial. move: "locked" (or push: 0) keeps a shot still.
    const sorted = [...keys].sort((a, b) => a.t - b.t);
    this.keys = sorted.map((k, i) => {
      const dur = (sorted[i + 1]?.t ?? Infinity) - k.t;
      const given = k.push !== undefined ? k.push : (k.move ? MOVE[k.move] ?? 0 : null);
      const push = given !== null ? given : (!k.aerial && dur >= 1.0 ? DEFAULT_PUSH : 0);
      return { fov: 38, roll: 0, glide: 0, ...k, push };
    });
    if (!this.keys.length) throw new Error("[rc] the story has no camera keys");
    this.keys.forEach((k, i) => {
      if (!k.light && i > 0) k.light = this.keys[i - 1].light; // light stays with the place until a key changes it
      if (!k.ease) k.ease = k.glide <= 30 ? "out" : "smooth";
      if (k.transition && k.glide) k.glide = 0; // a transition replaces the glide
      // sun direction is frozen per place: continuous moves keep the previous key's heading so light never pops
      k.sunYaw = i === 0 || k.glide === 0 ? yawOfKey(k) : this.keys[i - 1].sunYaw;
    });
    this.kicks = kicks;
  }
  index(t) {
    let i = 0;
    for (let j = 0; j < this.keys.length; j++) { const k = this.keys[j]; if (t >= k.t - k.glide / FPS) i = j; }
    return i;
  }
  state(t) {
    const i = this.index(t), k = this.keys[i], prev = this.keys[Math.max(0, i - 1)];
    const start = k.t - k.glide / FPS;
    let pos, look, fov, roll, u = 1;
    if (i > 0 && k.glide > 0 && t < k.t) {
      const x = (t - start) / (k.glide / FPS);
      u = EASE[k.ease](x);
      const from = this.holdPose(prev, start);
      const pts = [from.pos, ...(k.path || []).map((p) => new THREE.Vector3(...p)), new THREE.Vector3(...k.pos)];
      pos = alongPath(pts, u);
      look = from.look.clone().lerp(new THREE.Vector3(...k.look), u);
      fov = lerp(prev.fov, k.fov, u); roll = lerp(prev.roll, k.roll, u);
    } else {
      const h = this.holdPose(k, t);
      pos = h.pos; look = h.look; fov = k.fov; roll = k.roll;
    }
    let kx = 0, ky = 0;
    for (const kick of this.kicks) {
      const f = Math.round((t - kick.t) * FPS);
      if (f >= 0 && f < 7) { const a = (kick.amp ?? 0.06) * (1 - f / 7); kx += (f % 2 ? -1 : 1) * a; ky += (f % 2 ? 1 : -1) * a * 0.6; }
    }
    // transitions
    let mix = null, whip = 0;
    if (i > 0 && k.transition === "dissolve") {
      const n = k.tframes || 8, x = (t - k.t) * FPS / n;
      if (x >= 0 && x < 1) mix = { u: smoother(x), from: this.holdPose(prev, t), fromKey: prev };
    }
    const nk = this.keys[i + 1];
    if (nk && nk.transition === "whip") { const n = (nk.tframes || 8) / 2, a = (nk.t - t) * FPS; if (a > 0 && a <= n) { const x = 1 - a / n; whip = (nk.whipDir || 1) * 1.0 * x * x; } }
    if (i > 0 && k.transition === "whip") { const n = (k.tframes || 8) / 2, b = (t - k.t) * FPS; if (b >= 0 && b < n) { const x = b / n; whip = -(k.whipDir || 1) * 1.0 * (1 - x) * (1 - x); } }
    // flash wipe: a white band sweeps in over the old shot, the cut happens under full white, then it sweeps out
    let flash = null;
    if (nk && nk.transition === "flash") { const n = (nk.tframes || 6) / 2, a = (nk.t - t) * FPS; if (a > 0 && a <= n) flash = { phase: "in", u: 1 - a / n }; }
    if (i > 0 && k.transition === "flash") { const n = (k.tframes || 6) / 2, b = (t - k.t) * FPS; if (b >= 0 && b < n) flash = { phase: "out", u: b / n }; }
    return { pos, look, fov, roll, kx, ky, key: k, keyIndex: i, gliding: u < 1, glideU: u, prev, mix, whip, flash };
  }
  holdPose(k, t) {
    const pos = new THREE.Vector3(...k.pos), look = new THREE.Vector3(...k.look);
    let f = Math.max(0, (t - k.t) * FPS);
    // a push or pull stops once the distance has changed 2x, so a long hold never ends up inside the subject
    if (k.push) f = Math.min(f, Math.log(0.5) / Math.log(1 - Math.abs(k.push) / 100));
    if (k.push > 0) {
      // slow push-in: every frame covers push % of the remaining distance to the look point
      pos.lerp(look, 1 - Math.pow(1 - k.push / 100, f));
    } else if (k.push < 0) {
      // slow pull-back: the distance to the look point grows by |push| % per frame
      pos.sub(look).multiplyScalar(Math.pow(1 - k.push / 100, f)).add(look);
    }
    return { pos, look };
  }
  place(camera, pos, look, fov, roll, kx = 0, ky = 0, whip = 0) {
    camera.position.copy(pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
    if (whip) camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), whip);
    camera.rotateZ(THREE.MathUtils.degToRad(roll));
    if (kx || ky) { camera.translateX(kx); camera.translateY(ky); }
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  }
  apply(camera, t) {
    const s = this.state(t);
    this.place(camera, s.pos, s.look, s.fov, s.roll, s.kx, s.ky, s.whip);
    return s;
  }
}

// Sight-line guard: run over every frame once at load. Finds the camera inside a prop, props closer than
// 2 m to the lens in view, and solid props hiding the look target. Results go to console.error so
// the render output and the QA step see them.
export function guardCamera(director, colliders, duration, camera) {
  const warnings = [];
  const cam = camera.clone();
  const ray = new THREE.Ray(), hit = new THREE.Vector3();
  const frustum = new THREE.Frustum(), m = new THREE.Matrix4();
  const seen = new Set();
  for (let f = 0; f <= Math.round(duration * FPS); f += 2) {
    const t = f / FPS;
    const s = director.apply(cam, t);
    cam.aspect = camera.aspect; cam.updateProjectionMatrix();
    m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); frustum.setFromProjectionMatrix(m);
    for (const c of colliders) {
      if (s.key.aerial && c.name.startsWith("ceiling:")) continue; // hidden in aerial shots
      const grown = c.box.clone().expandByScalar(0.25);
      if (grown.containsPoint(cam.position)) push(`camera inside "${c.name}"`, f);
      const d = c.box.distanceToPoint(cam.position);
      if (d < 2 && frustum.intersectsBox(c.box) && !c.foreground && c.kind !== "wall") push(`"${c.name}" only ${d.toFixed(1)} m from the lens`, f);
      ray.origin.copy(cam.position); ray.direction.copy(s.look).sub(cam.position);
      const dist = ray.direction.length(); ray.direction.normalize();
      if (ray.intersectBox(c.box, hit) && hit.distanceTo(cam.position) < dist - 0.6 && !c.box.containsPoint(s.look) && !c.foreground) push(`"${c.name}" blocks the view of the subject`, f);
    }
  }
  function push(msg, f) {
    const key = msg + "@" + Math.floor(f / 30);
    if (seen.has(key)) return; seen.add(key);
    warnings.push({ frame: f, msg });
  }
  for (const w of warnings.slice(0, 40)) console.error(`[rc] camera check, frame ${w.frame}: ${w.msg}`);
  return warnings;
}

// Framing helper: aim([x, y, z], { dist, yaw (deg, 0 = camera on +z side), height, fov }) -> { pos, look, fov }
// In a 9:16 frame the visible width is only about 0.56 of the height, so keep subjects close to the centre line.
export function aim(target, { dist = 6, yaw = 0, height = null, fov = 36, lookUp = 0 } = {}) {
  const a = (yaw * Math.PI) / 180;
  const y = height ?? target[1];
  return { pos: [target[0] + Math.sin(a) * dist, y, target[2] + Math.cos(a) * dist], look: [target[0], target[1] + lookUp, target[2]], fov };
}

// Top-down / aerial framing: aerial([x, y, z], { height, fov, tilt }) -> { pos, look, fov, aerial: true }.
// tilt 0 looks straight down (a tiny offset keeps the camera's "up" stable), tilt 0.5 is a steep 3/4 view.
export function aerial(target, { height = 14, fov = 40, tilt = 0.08, yaw = 0 } = {}) {
  const a = (yaw * Math.PI) / 180, off = Math.max(0.02, tilt) * height;
  return { pos: [target[0] + Math.sin(a) * off, target[1] + height, target[2] + Math.cos(a) * off], look: [...target], fov, aerial: true };
}

// Shot plan summary from the keys (hard cuts, shot lengths, moves, transitions, aerials). The engine prints
// it as "[rc] plan check" lines against the rules in scene-direction.md.
export function planSummary(director, duration) {
  const ks = director.keys;
  const starts = [0], kinds = [];
  ks.forEach((k, i) => { if (i > 0 && k.glide === 0) { starts.push(k.t); kinds.push(k.transition || "cut"); } });
  const lens = starts.map((s, i) => (starts[i + 1] ?? duration) - s);
  const sorted = [...lens].sort((a, b) => a - b);
  const med = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const shotKeys = ks.filter((k, i) => i === 0 || k.glide === 0);
  const moving = shotKeys.filter((k) => k.push !== 0).length;
  return {
    shots: starts.length, cuts: starts.length - 1, median_shot_s: +med.toFixed(2), longest_shot_s: +(sorted.at(-1) || 0).toFixed(2),
    quick_shots_under_1s: lens.filter((x) => x < 1.0).length, holds_over_5s: lens.filter((x) => x >= 5).length,
    push_or_pull_share: +(moving / Math.max(1, shotKeys.length)).toFixed(2),
    whips_and_flashes: kinds.filter((x) => x === "whip" || x === "flash").length, aerials: shotKeys.filter((k) => k.aerial).length,
    glides: ks.filter((k, i) => i > 0 && k.glide > 0).length, scene_changes: Math.max(0, ks.length - 1),
  };
}
