// Runtime checks of the story, run once after the world is built. They print "[rc] check, frame N: ..." lines
// (console.error) and return them. Nothing here stops the render: Claude reads the lines and fixes the story.
//   1. a character or animal passes through a wall or a tall solid prop (a gate, a door that is shut)
//   2. a character appears inside the frame with no cut, flash or camera move
//   3. the bottom of the frame shows ground outside the room the camera is in
//   4. a large sign is cut by the frame edge
export function runChecks({ THREE, cast, world, scene, camera, director, DURATION, FPS }) {
  const out = [];
  const warn = (frame, msg) => { out.push({ frame, msg }); console.error(`[rc] check, frame ${frame}: ${msg}`); };
  const N = Math.round(DURATION * FPS);
  const actors = Object.entries(cast).filter(([, c]) => typeof c.posAt === "function" && c.vis);

  // 1. pass-through
  const solids = world.colliders.filter((c) => {
    if (c.obj?.userData?.ceiling || /^(ceiling|floor)/.test(c.name || "")) return false;
    if (c.kind === "wall") return true;
    return (c.box.max.y - c.box.min.y) > 1.4 && (c.box.max.x - c.box.min.x) < 40 && (c.box.max.z - c.box.min.z) < 40;
  }).map((c) => ({ name: c.name || "prop", box: c.box.clone().expandByScalar(-0.06) })).filter((c) => !c.box.isEmpty());
  const inside = new Map();
  for (let f = 0; f <= N; f += 3) {
    const t = f / FPS;
    for (const [name, c] of actors) {
      if (!c.lastBefore(c.vis, t, true)) continue;
      const [x, z] = c.posAt(t);
      const p = new THREE.Vector3(x, Math.min(0.9, (c.h || 1.7) * 0.5), z);
      for (const s of solids) {
        const key = name + "|" + s.name;
        if (s.box.containsPoint(p)) {
          if (!inside.get(key)) { warn(f, `"${name}" passes through "${s.name}" (move the walk around it or through an opening)`); inside.set(key, true); }
        } else inside.set(key, false);
      }
    }
  }

  // 2. appearing in view
  for (const [name, c] of actors) {
    for (const [tt, on] of c.vis) {
      if (!on || tt <= 0) continue;
      const f = Math.round(tt * FPS);
      const near = director.keys.some((k) => Math.abs(k.t * FPS - f) <= 4 || (k.glide > 0 && tt >= k.t - k.glide / FPS - 0.1 && tt <= k.t + 0.1));
      director.apply(camera, tt);
      const p = c.eyes(tt).project(camera);
      if (!near && p.z < 1 && Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.95) warn(f, `"${name}" appears inside the frame with no cut, flash or camera move (show it while it is off screen, or on a cut)`);
    }
  }

  // 3 and 4. frame-edge checks at every key arrival and the middle of its hold
  const rooms = world.rooms || [];
  const signs = []; scene.traverse((o) => { if (o.userData?.sign) signs.push(o); });
  const seen = new Set();
  director.keys.forEach((k, idx) => {
    const end = director.keys[idx + 1]?.t ?? DURATION;
    for (const t of [k.t + 0.05, (k.t + end) / 2]) {
      if (t > DURATION) continue;
      const st = director.apply(camera, t); camera.updateMatrixWorld(true);
      const f = Math.round(t * FPS), cp = camera.position;
      const room = rooms.find((r) => cp.x > r.x0 && cp.x < r.x1 && cp.z > r.z0 && cp.z < r.z1 && cp.y < r.h);
      if (room && !st.key.aerial) {
        for (const nx of [-0.9, 0, 0.9]) {
          const dir = new THREE.Vector3(nx, -0.985, 0.5).unproject(camera).sub(cp).normalize();
          if (dir.y > -1e-3) continue;
          const s = -cp.y / dir.y, hx = cp.x + dir.x * s, hz = cp.z + dir.z * s;
          if (hx < room.x0 - 0.05 || hx > room.x1 + 0.05 || hz < room.z0 - 0.05 || hz > room.z1 + 0.05) {
            const key = "room" + room.id + idx; if (!seen.has(key)) { seen.add(key); warn(f, `the bottom of the frame shows ground outside the room "${room.id}" (move the camera back or make the room larger)`); }
            break;
          }
        }
      }
      for (const sg of signs) {
        if (!sg.visible) continue;
        const box = new THREE.Box3().setFromObject(sg);
        let x0 = 9, x1 = -9, behind = false;
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
          const v = new THREE.Vector3(x, y, z).project(camera); if (v.z > 1) behind = true; x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
        }
        if (behind) continue;
        const share = (Math.min(1, x1) - Math.max(-1, x0)) / 2, cut = x0 < -1.001 || x1 > 1.001;
        const key = "sign" + sg.userData.sign + idx;
        if (cut && share > 0.4 && !seen.has(key)) { seen.add(key); warn(f, `the sign "${sg.userData.sign}" is cut by the frame edge (frame it fully or move it)`); }
      }
    }
  });
  return out;
}
