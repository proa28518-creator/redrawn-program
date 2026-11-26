// world/rbx/ground.js: grounding for the Roblox V3 kits (WP-K, 2026-11-12). Every kit (hallway, home, town, classroom) uses it, so every
// film that builds one of them gets: (1) soft contact blobs under every prop footprint and furniture leg, found from the set's own glb
// geometry (connected parts that stand on the floor), plus a faint wide blob on the floor under raised furniture (tables, seats, beds);
// (2) an ambient-occlusion band where walls meet the ceiling (on the wall and on the ceiling) and, where asked, where walls meet the floor;
// (3) contactBlob(at, radius) for films: one soft blob under a person or a placed prop. Returns the mesh so a film can move it with a walker.
// Everything is a darkening alpha plane (depthWrite off, polygon offset), pure in t, no light needed. rbx-only: no other charsys file uses it.
//   const G = createGround(THREE, group, { night });  G.auto(mesh, { floorY, maxY, skip });  G.bands(box);  G.contactBlob([x, z], r)
const BLOB_V = `attribute vec4 aBox; attribute float aAlpha; varying vec2 vP; varying vec4 vBox; varying float vA;
void main() { vBox = aBox; vA = aAlpha; vP = (uv - .5) * (aBox.xy + 2. * aBox.z);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.); }`;
// aBox: footprint w, d, soft margin, unused. Rounded-box distance: full dark inside the footprint, soft falloff over the margin.
const BLOB_F = `uniform vec3 uColor; uniform float uGain; varying vec2 vP; varying vec4 vBox; varying float vA;
void main() { vec2 h = vBox.xy * .5; vec2 q = abs(vP) - h; float sd = length(max(q, 0.)) + min(max(q.x, q.y), 0.);
  float m = vBox.z; float a = vA * uGain * (1. - smoothstep(-m * .45, m, sd)); a *= a > .004 ? 1. : 0.;
  gl_FragColor = vec4(uColor, a); }`;
const BAND_F = `uniform vec3 uColor; uniform float uA; uniform float uPow; varying vec2 vUv;
void main() { float a = uA * pow(clamp(vUv.y, 0., 1.), uPow); gl_FragColor = vec4(uColor, a); }`;
const BAND_V = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

const SKIP = /^(floor|carpet|rug|runner|wall|ceiling|crown|trim|skirting|wainscot|tile_wall|wall_tile|glass|door_glass|window|sky|panel|grass|road|asphalt|sidewalk|path|terrain|ground|water|mountain|hill|lane|line|parking|curb|cloud|decal|r_floor|r_wall|r_ceiling|r_sky|hall_floor|hall_wall|board|chalk|sign|poster|pic_|paper|sticker|string|pen_|k_grass)/;

export function createGround(THREE, group, { night = false, gain = 1 } = {}) {
  const col = night ? new THREE.Vector3(.02, .015, .05) : new THREE.Vector3(.09, .07, .06);
  const blobMat = () => new THREE.ShaderMaterial({ vertexShader: BLOB_V, fragmentShader: BLOB_F, uniforms: { uColor: { value: col }, uGain: { value: gain } },
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -8 });   // V4: units only, never a slope factor on floor decals
  const plane = new THREE.PlaneGeometry(1, 1); plane.rotateX(-Math.PI / 2);   // lies on y = 0, uv.y runs along -z
  // list: [{ x, y, z, w, d, m, a, ry }] -> one instanced draw
  const blobs = (list, name = 'ground.blobs') => { if (!list.length) return null;
    const g = plane.clone(), box = new Float32Array(list.length * 4), al = new Float32Array(list.length);
    const im = new THREE.InstancedMesh(g, blobMat(), list.length), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), S = new THREE.Vector3();
    list.forEach((b, i) => { const m = b.m ?? .3; Q.setFromAxisAngle(Y, b.ry || 0); P.set(b.x, b.y, b.z); S.set(b.w + 2 * m, 1, b.d + 2 * m); im.setMatrixAt(i, M.compose(P, Q, S));
      box.set([b.w, b.d, m, 0], i * 4); al[i] = b.a ?? .6; });
    g.setAttribute('aBox', new THREE.InstancedBufferAttribute(box, 4)); g.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(al, 1));
    im.instanceMatrix.needsUpdate = true; im.name = name; im.frustumCulled = false; im.renderOrder = -1; group.add(im); return im; };

  // connected parts of one mesh (vertices welded by position), each part's box in group space
  const parts = (mesh) => { const pos = mesh.geometry.attributes.position; if (!pos) return [];
    mesh.updateMatrix(); const n = pos.count, W = new Float32Array(n * 3), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrix); W[i * 3] = v.x; W[i * 3 + 1] = v.y; W[i * 3 + 2] = v.z; }
    const id = new Int32Array(n), key = new Map(); let k = 0;
    for (let i = 0; i < n; i++) { const h = Math.round(W[i * 3] * 500) + ',' + Math.round(W[i * 3 + 1] * 500) + ',' + Math.round(W[i * 3 + 2] * 500);
      let j = key.get(h); if (j === undefined) { j = k++; key.set(h, j); } id[i] = j; }
    const par = new Int32Array(k); for (let i = 0; i < k; i++) par[i] = i;
    const find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
    const idx = mesh.geometry.index;
    if (idx) for (let t = 0; t < idx.count; t += 3) { const a = id[idx.getX(t)]; uni(a, id[idx.getX(t + 1)]); uni(a, id[idx.getX(t + 2)]); }
    else for (let t = 0; t < n; t += 3) { uni(id[t], id[t + 1]); uni(id[t], id[t + 2]); }
    const B = new Map();
    for (let i = 0; i < n; i++) { const r = find(id[i]); let b = B.get(r); if (!b) B.set(r, b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]);
      const x = W[i * 3], y = W[i * 3 + 1], z = W[i * 3 + 2]; if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (z < b[2]) b[2] = z; if (x > b[3]) b[3] = x; if (y > b[4]) b[4] = y; if (z > b[5]) b[5] = z; }
    return [...B.values()]; };

  // auto contact shadows from the set's meshes. o: { floorY (number or fn(x, z) -> y), lift: max height above the floor that still counts as
  // standing on it, skip: RegExp of material keys to leave out, maxFoot: biggest footprint side, raised: also a faint floor blob under raised furniture }
  const pending = [];
  const auto = (mesh, key, o = {}) => { if ((o.skip || SKIP).test(key) || /emit|glow|bulb|light|lamp_shade|fire/.test(key)) return;
    const floorAt = typeof o.floorY === 'function' ? o.floorY : () => (o.floorY ?? 0), lift = o.lift ?? .18, maxFoot = o.maxFoot ?? 6;
    for (const b of parts(mesh)) { const w = b[3] - b[0], d = b[5] - b[2], h = b[4] - b[1], cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2, fy = floorAt(cx, cz);
      if (Math.max(w, d) > maxFoot || w * d > maxFoot * maxFoot * .5) continue;
      if (b[1] - fy < lift && h > .08) {   // standing on the floor: a tight dark blob, margin grows with size
        const s = Math.min(w, d), m = Math.min(.45, .12 + .35 * Math.max(s, .15)), thin = Math.max(w, d) / Math.max(s, .02) > 8;
        pending.push({ x: cx, y: Math.max(fy, b[1]) + .006, z: cz, w: w * .92, d: d * .92, m: thin ? m * .6 : m, a: Math.min(.78, .55 + h * .1) });
      } else if (o.raised !== false && b[1] - fy < 1.7 && h < 2.6 && Math.min(w, d) > .35 && w * d > .25 && w * d < 14 && b[1] > fy + lift) {   // raised furniture: wide faint blob
        pending.push({ x: cx, y: fy + .005, z: cz, w: w * .8, d: d * .8, m: .45 + .2 * Math.min(w, d), a: .42 * (1 - (b[1] - fy) / 2.4) });
      }
    } };
  const flush = () => { const im = blobs(pending.splice(0), 'ground.auto'); return im ? im.count : 0; };

  // AO bands. box: { x: [x0, x1], z: [z0, z1], ceil, floor (true = also a band on the wall's foot), h, a }. Walls are the box's four sides.
  const bandMat = (a, p) => new THREE.ShaderMaterial({ vertexShader: BAND_V, fragmentShader: BAND_F, uniforms: { uColor: { value: col }, uA: { value: a }, uPow: { value: p } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -8 });
  const bands = ({ x: [x0, x1], z: [z0, z1], ceil, floor = false, h = .9, a = .38, sides = ['back', 'front', 'left', 'right'] }) => {
    const top = bandMat(a, 1.8), cm = bandMat(a * .85, 1.8), foot = bandMat(a * .8, 2.2), e = .015, out = [];
    const W = { back: [(x0 + x1) / 2, z0 + e, x1 - x0, 0], front: [(x0 + x1) / 2, z1 - e, x1 - x0, Math.PI], left: [x0 + e, (z0 + z1) / 2, z1 - z0, Math.PI / 2], right: [x1 - e, (z0 + z1) / 2, z1 - z0, -Math.PI / 2] };
    for (const s of sides) { const [cx, cz, L, ry] = W[s];
      const wt = new THREE.Mesh(new THREE.PlaneGeometry(L, h), top); wt.position.set(cx, ceil - h / 2, cz); wt.rotation.y = ry; out.push(wt);          // wall, dark at the ceiling
      const ct = new THREE.Mesh(new THREE.PlaneGeometry(L, h * .8), cm); ct.rotation.order = 'YXZ'; ct.rotation.set(-Math.PI / 2, ry, 0);             // ceiling, dark at the wall
      const n = [Math.sin(ry), Math.cos(ry)]; ct.position.set(cx + n[0] * h * .4, ceil - e, cz + n[1] * h * .4); out.push(ct);
      if (floor) { const wf = new THREE.Mesh(new THREE.PlaneGeometry(L, h * .55), foot); wf.geometry.scale(1, -1, 1); wf.position.set(cx, h * .275, cz); wf.rotation.y = ry; out.push(wf); } }
    for (const m of out) { m.renderOrder = -1; m.name = 'ground.band'; m.frustumCulled = false; group.add(m); }
    return out.length; };

  // a film's own blob: at [x, z] or [x, y, z] in FILM (world) coordinates, radius, o: { alpha, w, d, ry }. A person: contactBlob([x, z], .75)
  const contactBlob = (at, radius = .7, o = {}) => { const [wx, y, wz] = at.length === 3 ? at : [at[0], 0, at[1]], x = wx - group.position.x, z = wz - group.position.z;
    const w = o.w ?? radius * 1.1, d = o.d ?? radius * .8;
    return blobs([{ x, y: y + .007, z, w, d, m: radius * .6, a: o.alpha ?? .78, ry: o.ry || 0 }], 'ground.blob'); };
  return { blobs, auto, flush, bands, contactBlob, parts };
}

// ---- WP-K2 (V3_REF WP-K delta, 2026-11-12) -------------------------------------------------------------------------------------------
// saturate(hex, k): the V3_REF palette lift (+15..20 %). HSL saturation * (1 + k), lightness kept. Kits run every colour through it.
export function saturate(hex, k = .18) {
  if (typeof hex !== 'string' || hex[0] !== '#' || !k) return hex;
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; if (mx - mn < .02) return hex;   // greys and whites stay
  const s0 = (mx - mn) / (1 - Math.abs(2 * l - 1)), s1 = Math.min(1, s0 * (1 + k)), f = s1 / s0;
  [r, g, b] = [r, g, b].map(v => Math.max(0, Math.min(1, l + (v - l) * f)));
  return '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

// dropParts(THREE, geometry, pred): a copy of the geometry without the connected parts (welded boxes) whose box pred([x0,y0,z0,x1,y1,z1])
// says to drop. Geometry must already be in group space. Used by the hallway for ryan_locker's gap.
export function dropParts(THREE, geo, pred) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone(), pos = g.attributes.position, n = pos.count;
  const id = new Int32Array(n), key = new Map(); let k = 0;
  for (let i = 0; i < n; i++) { const h = Math.round(pos.getX(i) * 500) + ',' + Math.round(pos.getY(i) * 500) + ',' + Math.round(pos.getZ(i) * 500);
    let j = key.get(h); if (j === undefined) { j = k++; key.set(h, j); } id[i] = j; }
  const par = new Int32Array(k); for (let i = 0; i < k; i++) par[i] = i;
  const find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  for (let t = 0; t < n; t += 3) for (const o of [1, 2]) { const a = find(id[t]), b = find(id[t + o]); if (a !== b) par[a] = b; }
  const B = new Map();
  for (let i = 0; i < n; i++) { const r = find(id[i]); let b = B.get(r); if (!b) B.set(r, b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]);
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.min(b[2], z); b[3] = Math.max(b[3], x); b[4] = Math.max(b[4], y); b[5] = Math.max(b[5], z); }
  const drop = new Set(); for (const [r, b] of B) if (pred(b)) drop.add(r);
  if (!drop.size) return { geometry: geo, dropped: 0 };
  const keep = []; for (let t = 0; t < n; t += 3) if (!drop.has(find(id[t]))) keep.push(t);
  const out = new THREE.BufferGeometry();
  for (const [name, at] of Object.entries(g.attributes)) { const s = at.itemSize, arr = new at.array.constructor(keep.length * 3 * s);
    keep.forEach((t, q) => { for (let v = 0; v < 3; v++) for (let c = 0; c < s; c++) arr[(q * 3 + v) * s + c] = at.array[(t + v) * s + c]; });
    out.setAttribute(name, new THREE.BufferAttribute(arr, s, at.normalized)); }
  out.computeBoundingSphere(); return { geometry: out, dropped: drop.size };
}

// ---- painted sky plates (V3_REF 1.3: the sky is a picture and a third of the frame). A canvas panorama for rigkit's sky `map`
// (u = 180 deg, repeated round the dome; v = horizon (bottom) .. 38 deg up (top), above that the dome's own top colour).
// Names: day_cumulus, sunset, night_moon, sepia_overcast. When the AI Studio plates land (v3/assets/aistudio/sky/), copy them to
// world/assets/rbx/sky/<name>.jpg and list the name in SKY_FILES: skyPlate() then loads the picture instead of painting.
export const SKY_FILES = [];
export const SKY_TOP = { day_cumulus: '#1f5fc8', sunset: '#3a3f8f', night_moon: '#0c1436', sepia_overcast: '#c8bca4' };
const SKY_PAINT = {
  day_cumulus: { top: '#2f73d4', hor: '#7fc0f2', lit: '#ffffff', mid: '#eaf2fb', dark: '#b4c8e2', n: 16, sun: null },
  sunset: { top: '#4a4a9e', hor: '#ffb07a', lit: '#ffd8b8', mid: '#f4a0a8', dark: '#8a5a8e', n: 13, sun: '#fff0b8' },
  night_moon: { top: '#0e1840', hor: '#2a3c78', lit: '#7a8ec8', mid: '#3a4a86', dark: '#1a2452', n: 10, moon: true },
  sepia_overcast: { top: '#cfc2a8', hor: '#efe4cc', lit: '#fbf4e4', mid: '#e8dcc4', dark: '#c4b498', n: 22, sun: null },
};
export function paintSky(THREE, name = 'day_cumulus', { seed = 7, W = 4096, H = 1024 } = {}) {
  const P = SKY_PAINT[name] || SKY_PAINT.day_cumulus, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  let s = seed >>> 0; const R = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, P.top); gr.addColorStop(1, P.hor); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (name === 'night_moon') for (let i = 0; i < 260; i++) { g.globalAlpha = .3 + R() * .7; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(R() * W, R() * H * .7, .8 + R() * 1.6, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  // wrap-around draw: anything near the seam is drawn twice so u = 0 / 1 meet
  const wrap = f => { f(0); f(-W); f(W); };
  if (P.moon) wrap(o => { const x = W * .78 + o, y = H * .3, r = H * .11; const gl = g.createRadialGradient(x, y, r * .8, x, y, r * 3.2); gl.addColorStop(0, 'rgba(200,215,255,.45)'); gl.addColorStop(1, 'rgba(200,215,255,0)'); g.fillStyle = gl; g.fillRect(x - r * 3.3, y - r * 3.3, r * 6.6, r * 6.6);
    g.fillStyle = '#f4f2e6'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = 'rgba(190,190,175,.5)'; for (const [dx, dy, rr] of [[-.3, -.2, .22], [.25, .15, .16], [.05, .4, .12], [-.1, .1, .1]]) { g.beginPath(); g.arc(x + dx * r, y + dy * r, rr * r, 0, 7); g.fill(); } });
  if (P.sun) wrap(o => { const x = W * .2 + o, y = H * .62, r = H * .5; const gl = g.createRadialGradient(x, y, 0, x, y, r); gl.addColorStop(0, P.sun); gl.addColorStop(.25, 'rgba(255,220,170,.5)'); gl.addColorStop(1, 'rgba(255,200,150,0)'); g.fillStyle = gl; g.fillRect(x - r, y - r, 2 * r, 2 * r); });
  // cumulus: each cloud = a flat-bottomed heap of puffs; shaded underside, lit top, crisp edge (painted, cartoon)
  const cloud = (cx, by, w, h) => wrap(o => { const x0 = cx + o, puffs = [];
    const m = 5 + Math.floor(R() * 6); for (let i = 0; i < m; i++) { const u = (i + .5) / m, rr = h * (.32 + .5 * Math.sin(Math.PI * u) * (.7 + R() * .5)); puffs.push([x0 - w / 2 + u * w, by - rr * (.55 + R() * .35), rr]); }
    for (let i = 0; i < 3; i++) { const u = .25 + R() * .5, rr = h * (.35 + R() * .3); puffs.push([x0 - w / 2 + u * w, by - h * (.6 + R() * .3), rr]); }
    const pass = (col, dy, sc) => { g.fillStyle = col; g.beginPath(); for (const [x, y, r] of puffs) { g.moveTo(x + r * sc, y + dy); g.arc(x, y + dy, r * sc, 0, 7); } g.fill(); };
    g.save(); g.beginPath(); g.rect(x0 - w, 0, 2 * w, by); g.clip();
    pass(P.dark, 0, 1); pass(P.mid, -h * .1, .93); pass(P.lit, -h * .2, .82); g.restore();
    g.fillStyle = P.dark; g.fillRect(x0 - w / 2 + h * .2, by - h * .12, w - h * .4, h * .12); });
  for (let i = 0; i < P.n; i++) { const by = H * (.45 + R() * .5), sc = .35 + (by / H) * .8, w = W * (.05 + R() * .08) * sc * 1.6, h = H * (.13 + R() * .1) * sc; cloud(R() * W, by, w, h); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 16; /* V4: renderer max (three clamps), mipmaps on (CanvasTexture default) */ t.colorSpace = THREE.NoColorSpace; return t;
}
// skyPlate(THREE, kit, x, z, r, sky3, name): the kit's sky dome with the painted (or AI Studio) plate. Returns { sky, ready }.
export function skyPlate(THREE, kit, x, z, r, sky3, name = 'day_cumulus', { base = '' } = {}) {
  const map = paintSky(THREE, name), sky = kit.sky(x, z, r, { ...sky3, top: SKY_TOP[name] || sky3.top, map, mapGain: 1 });
  let ready = Promise.resolve();
  if (SKY_FILES.includes(name) && base) ready = new Promise(res => new THREE.TextureLoader().load(new URL(name + '.jpg', base).href,
    tx => { tx.wrapS = THREE.RepeatWrapping; tx.colorSpace = THREE.NoColorSpace; sky.u.uMap.value = tx; res(); }, undefined, () => res()));
  return { sky, ready };
}

// bunting(THREE, kit, place, spans, o): flag strings. spans: [[x0, y0, z0, x1, y1, z1], ...]; o: { sag, colors, size, gap }.
// One mesh per colour (lit by the kit like everything else), a thin dark cord. Pure geometry, no animation.
export const BUNTING = ['#f4a6c0', '#a8e0c0', '#7fc4ee', '#f6dc8a', '#f26a2e', '#2ec4c8', '#ffffff'];
export function bunting(THREE, kit, place, spans, { sag = 1.0, colors = BUNTING, size = .55, gap = .72, group, sat = 0 } = {}) {
  const per = colors.map(() => []), cord = []; let k = 0;
  for (const [x0, y0, z0, x1, y1, z1] of spans) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.floor(L / gap)), dx = (x1 - x0) / L, dz = (z1 - z0) / L;
    const at = u => [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - sag * 4 * u * (1 - u), z0 + (z1 - z0) * u];
    for (let i = 0; i < 24; i++) { const a = at(i / 24), b = at((i + 1) / 24); cord.push(a, b); }
    for (let i = 1; i < n; i++) { const u = i / n, a = at(u - .45 / n), b = at(u + .45 / n), m = at(u), tip = [m[0], m[1] - size * 1.05, m[2]];
      per[k++ % colors.length].push(a, b, tip); }
  }
  const out = [];
  per.forEach((tris, i) => { if (!tris.length) return; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris.flat()), 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, kit.surface(place, sat ? saturate(colors[i], sat) : colors[i], { gloss: 8, spec: .05, near: 2.6 }));
    m.material.side = THREE.DoubleSide; m.name = 'bunting'; m.frustumCulled = false; out.push(m); });   // V4: a flag a camera passes dissolves (monster f2186 teal band)
  // cord: thin boxes along the curve
  const cg = []; for (let i = 0; i < cord.length; i += 2) { const [a, b] = [cord[i], cord[i + 1]]; const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), l = v.length();
    const bx = new THREE.BoxGeometry(.035, .035, l); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), v.normalize());
    bx.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new THREE.Vector3(1, 1, 1))); cg.push(bx); }
  if (cg.length) { const pos = []; for (const b of cg) { const nb = b.toNonIndexed(); pos.push(...nb.attributes.position.array); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, kit.surface(place, '#3a3440', { gloss: 5, spec: .02, near: 2.6 })); m.name = 'bunting.cord'; m.frustumCulled = false; out.push(m); }
  for (const m of out) (group || kit.group)?.add(m);
  return out;
}

export default { createGround, saturate, dropParts, paintSky, skyPlate, bunting, SKY_FILES, SKY_TOP, BUNTING };
