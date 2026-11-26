// world/look/focus.js: where the lens focuses, a pure function of t.
// A shot's raw focus distance is sampled over the whole shot (10 samples per second, from the camera function and the characters' timelines, never
// from the frame being rendered), smoothed inside the shot, and read back by interpolation. So any frame rendered alone gets the same value, focus moves
// smoothly inside a shot and jumps on a cut. Tables are built the first time a shot is needed.
// Who it focuses on:
//   shot `focus` (or camera `focus`): a distance in D, a character or prop id, or a world point [x, y, z]. Overrides everything.
//   else the shot's camera subject (`who` / the nearest of `whos`) when it is in frame,
//   else the visible character with the best score (big and near the centre of the frame),
//   else the thing, else Lena (any prop or character in frame), else the camera target.
const STEP = .1, SIGMA = .28;

export function makeFocus(THREE, ctx, { blocked = () => false, headY = 2.6, pick: pickAt = null } = {}) {   // pick(t): an override by time inside a shot (post.js's `focus` list); no film before S-4 passes it
  const { S, shotFns, rootOf, chars, props } = ctx, tables = new Map(), _v = new THREE.Vector3();
  const cam = new THREE.PerspectiveCamera(26, S.width / S.height || 9 / 16, .1, 600);
  const setCam = C => { cam.fov = C.fov || 26; cam.aspect = (ctx.W / ctx.H); cam.updateProjectionMatrix(); cam.position.set(...C.pos); cam.up.set(0, 1, 0); cam.lookAt(...C.target); cam.updateMatrixWorld(true); cam.matrixWorldInverse.copy(cam.matrixWorld).invert(); };
  // view depth + ndc of a world point under the camera in `cam`
  const see = p => { _v.set(p[0], p[1], p[2]).applyMatrix4(cam.matrixWorldInverse); const z = -_v.z; _v.applyMatrix4(cam.projectionMatrix); return { z, x: _v.x, y: _v.y, on: z > .6 && Math.abs(_v.x) < 1.08 && Math.abs(_v.y) < 1.08 }; };
  const charHead = (c, t) => { const r = rootOf(c.def.name || c.ch.id, t); return [r[0], (c.ch.rest?.headY ?? headY) + (r[1] || 0), r[2]]; };
  const propAt = (p, t) => { let inn = p.def.in, at = p.def.at; for (const k of p.def.keys || []) if (t >= k.t) { if (k.in) inn = k.in; if (k.at) at = k.at; } if (inn !== 'world' || !at) return null; return [at[0], (p.def.focusY ?? 2.6), at[2]]; };
  const byName = (id, t) => { const c = chars.find(c => (c.def.name || c.ch.id) === id); if (c) return charHead(c, t); const p = props.find(p => p.def.id === id); return p ? propAt(p, t) : null; };
  function raw(i, t) {
    const sh = S.shots[i], C = shotFns[i].f(t); setCam(C);
    const pick = pickAt?.(t) ?? sh.focus ?? sh.camera?.focus;
    if (typeof pick === 'number') return pick;
    if (Array.isArray(pick)) return Math.max(.6, see(pick).z);
    if (typeof pick === 'string') { const p = byName(pick, t); if (p) return Math.max(.6, see(p).z); }
    const vis = (p, c) => { const s = see(p); return s.on && s.z > 1.6 && !blocked(C.pos, p) ? s : null; };
    const list = sh.camera?.who ? [sh.camera.who] : Array.isArray(sh.camera?.whos) ? sh.camera.whos : [];
    let best = null;
    for (const id of list) { const p = byName(id, t), s = p && vis(p); if (s && (!best || s.z < best.z)) best = s; }
    if (best) return best.z;
    let score = -1;
    for (const c of chars) { const s = vis(charHead(c, t)); if (!s) continue; const k = (1 - .55 * Math.min(1, Math.abs(s.x))) / s.z; if (k > score) { score = k; best = s; } }
    if (best) return best.z;
    for (const p of props) { if (p.def.kind !== 'figure') continue; const at = propAt(p, t), s = at && vis(at); if (s) return s.z; }
    for (const c of chars) { const s = see(charHead(c, t)); if (s.on && s.z > 1.6) return s.z; }
    return Math.hypot(C.target[0] - C.pos[0], C.target[1] - C.pos[1], C.target[2] - C.pos[2]);
  }
  function table(i) {
    if (tables.has(i)) return tables.get(i);
    const a = S.shots[i].t0 ?? 0, nx = shotFns[i + 1]?.t0, b = Math.min(S.shots[i].t1 ?? 1e9, nx ?? 1e9, a + (S.shots.length === 1 ? 90 : 15)), n = Math.max(1, Math.ceil((b - a) / STEP));
    const r = Array.from({ length: n + 1 }, (_, k) => raw(i, a + (b - a) * k / n)), dt = (b - a) / n;
    // smooth in 1/distance (the lens' own scale), inside this shot only
    const w = Math.ceil(2 * SIGMA / Math.max(dt, 1e-3)), out = r.map((_, k) => { let s = 0, sw = 0; for (let j = -w; j <= w; j++) { const q = r[Math.min(n, Math.max(0, k + j))], g = Math.exp(-.5 * (j * dt / SIGMA) ** 2); s += g / q; sw += g; } return sw / s; });
    const T = { a, dt, out }; tables.set(i, T); return T;
  }
  return function focusAt(t) {
    let i = 0; for (let k = 0; k < shotFns.length; k++) if (t >= shotFns[k].t0) i = k;
    const T = table(i), x = Math.max(0, (t - T.a) / T.dt), k = Math.min(T.out.length - 1, Math.floor(x)), f = x - k;
    return T.out[k] + (T.out[Math.min(T.out.length - 1, k + 1)] - T.out[k]) * f;
  };
}
