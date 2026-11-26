// world/look/sprites.js: camera-facing painted cut-outs in the backrooms2 set, the old video game trick (2026-11-04, gruss's idea). Off unless a film asks:
// world.setOpts.sprites = { dir, seed, floor, hang, wall, ... } (world/backrooms2.js loads this file only then, so a film without it is untouched).
// Each sprite is one quad that turns round the vertical axis to face the camera, in the vertex shader, from the camera position alone (pure in t; nothing per frame on the CPU).
// One instanced draw per picture. They are ordinary opaque world geometry: they write depth, so the look's haze and depth of field treat them exactly like the set, characters
// test against them, and they are lit per pixel by the same panels. Edges: a hard alpha test (no blending, so nothing bright can show round them), mipmaps
// made on premultiplied colour (the transparent part's colour can never bleed in), and the outermost edge darkened a little. On the floor each one has a soft multiply contact.
// Pictures: <dir>/sprites.json: [{ name, file?, height, kind }] or { sprites: [...] }. kind: 'hang' / 'ceiling' hangs from the ceiling, 'wall' stands against a wall,
// anything else stands on the floor. Placement: seeded, from the layout (env/CONTRACT.md: never in the walking lanes, doorways or camera flights), grouped by a large noise so there are bad
// stretches and clear stretches; things hanging from the ceiling come out of the holes Blender's scatter left, and stop above y 4.3.
import { LIGHT_GLSL } from './light.glsl.js';

const VERT = /* glsl */`attribute vec3 aPos; attribute vec4 aS; attribute vec3 aFace; uniform float uT;
varying vec3 vW; varying vec2 vUv; varying vec3 vR; varying vec3 vF; varying float vFade;
// aS: width, height, flip +-1, anchor (0 feet at aPos, 1 top at aPos). aFace: wall normal xz + how far it may turn from it (cos), 0 0 0 = free
void main() {
  vec3 tc = cameraPosition - aPos; tc.y = 0.; vec3 f = normalize(tc + vec3(.0001, 0., 0.));
  if (aFace.z > 0.) {                                             // against a wall: turns toward the camera only so far, so it never swings through the wall
    vec3 n = vec3(aFace.x, 0., aFace.y); float c = dot(f, n);
    if (c < aFace.z) { vec3 side = normalize(f - n * c + vec3(.0001, 0., .0001)); f = n * aFace.z + side * sqrt(1. - aFace.z * aFace.z); }
  }
  vec3 r = vec3(f.z, 0., -f.x);
  float y = aS.w > .5 ? position.y - .5 : position.y + .5;        // PlaneGeometry -0.5..0.5
  float sway = aS.w > .5 ? (1. - uv.y) * (1. - uv.y) * sin(uT * .55 + aPos.x * 3.1 + aPos.z * 1.7) * .035 : 0.;   // what hangs moves a little in the air
  vec3 w = aPos + r * (position.x * aS.x * aS.z + sway) + vec3(0., y * aS.y, 0.);
  vW = w; vR = r; vF = f; vUv = uv; vFade = smoothstep(1.1, 2.4, length(cameraPosition - aPos));    // a camera flying close: it dissolves rather than filling the frame
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.);
}`;
const FRAG = /* glsl */`uniform sampler2D uMap; uniform vec3 uLightCol, uAmb, uTint; uniform float uCap, uDesat;
${LIGHT_GLSL}
varying vec3 vW; varying vec2 vUv; varying vec3 vR; varying vec3 vF; varying float vFade;
void main() {
  vec4 t = texture2D(uMap, vUv);                                  // premultiplied
  // a plain alpha test, as the old games did: colour and depth always agree at the edge, so the depth of field stays clean (alpha to coverage left a dotted edge: the resolved depth picks one sample)
  float dith = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))));
  if (t.a < .5 || vFade < dith) discard;
  vec3 rgb = t.rgb / max(t.a, .03);
  rgb *= mix(.5, 1., smoothstep(.5, .95, t.a));
  rgb = mix(rgb, vec3(dot(rgb, vec3(.3, .5, .2))), uDesat);     // the room's colour wins: a saturated red or blue would pull the eye off the faces
  // a rounded normal across the picture, so the panels model it as a body and not a flat card
  vec3 n = normalize(vR * (vUv.x - .5) * 1.3 + vec3(0., .45 + .5 * (vUv.y - .5), 0.) + vF * .8);
  float L = min(brPanels(vW, n), uCap);
  float ao = .55 + .45 * smoothstep(0., 1.5, vW.y);
  vec3 col = rgb * uTint * (uAmb * ao + uLightCol * L * mix(.7, 1., ao));
  gl_FragColor = vec4(pow(max(col, 0.), vec3(2.2)), 1.);
}`;
const CONTACT_V = /* glsl */`attribute vec4 aC; varying vec2 vUv; varying float vA;
void main() { vUv = uv; vA = aC.w; gl_Position = projectionMatrix * viewMatrix * vec4(aC.x + position.x * aC.y, .012, aC.z + position.y * aC.y * .62, 1.); }`;
const CONTACT_F = /* glsl */`varying vec2 vUv; varying float vA;
void main() { float r = length(vUv - .5) * 2.; float k = vA * pow(max(1. - r, 0.), 1.25); gl_FragColor = vec4(vec3(1. - k), 1.); }`;

const hashN = (x, s) => { const v = Math.sin(x * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v); };
const noise1 = (x, s) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hashN(i, s) * (1 - u) + hashN(i + 1, s) * u; };
const DOORS = []; for (let z = -10; z >= -64; z -= 6) DOORS.push(z);

// may something taller than .25 D stand here (half width hw)? env/CONTRACT.md + what this film does in the side spaces
function clear(x, z, hw, low = false) {
  const ax = Math.abs(x), R = hw + .08, W = R * .5;                       // lanes keep the whole width; a wall may cut a little of a picture (seen edge-on it turns away from it)
  if (z > -4) {
    if (z > -2.75 && z < 10 && ax - R < 5.25) return false;               // the room's action area
    if (ax + W > 6.98 || z > 17.85) return false;                         // walls
    if (z > 10 && ax < 2.6 && z < 17.1) return false;                     // the front of the room: cameras stand there
    if (z <= -2.75) { if ((z < -3.8 && !low) || ax - R < 2.15 || Math.abs(ax - 4.8) < 1.05 + R) return false; }   // the back wall: never in the mouth or the two doorways
    return true;
  }
  if (z > -4.2 || z < -71.8) return false;
  if (ax < 2) { if (ax < 1.72 || ax > 1.98) return false; return !DOORS.some(d => Math.abs(z - d) < 1.2 + hw); }   // the hallway: only the band at the wall
  if (ax - W < 2.1 || ax + W > 6.95) return false;
  if (ax < 3.4 && DOORS.some(d => Math.abs(z - d) < 1.2 + hw)) return false;      // never in front of a doorway
  if (Math.abs(ax - 4.8) < 1.3 + hw && z > -7) return false;                      // the camera's way through x 4.8, z -4
  if (ax < 4 && Math.abs(z + 46) < 2.6) return false;                             // and through x 2, z -46
  if (x > 3.3 && x < 5.9 && z > -63 && z < -44) return false;                     // Lena's stretch and the flashback's camera
  return true;
}

export async function addSprites(THREE, group, U, { dir, opts = {}, scatter = null, log = () => {} } = {}) {
  const list = await fetch(new URL('sprites.json', dir).href).then(r => r.ok ? r.json() : null).catch(() => null);
  const defs = list ? (Array.isArray(list) ? list : list.sprites || list.items || []) : [];
  if (!defs.length) { log('sprites: none found in ' + dir); return { sprites: 0, draws: 0 }; }
  const loader = new THREE.TextureLoader();
  const loaded = (await Promise.all(defs.map(async d => { const file = d.file || d.name + '.png';
    try { const t = await loader.loadAsync(new URL(file, dir).href); t.colorSpace = THREE.NoColorSpace; t.premultiplyAlpha = true; t.anisotropy = 8; t.needsUpdate = true;
      const h = d.height ?? d.h ?? 1, ar = t.image.width / t.image.height, kind = d.kind || 'floor'; return { ...d, tex: t, h, w: h * ar, kind: /hang|ceil/.test(kind) ? 'hang' : /wall/.test(kind) ? 'wall' : 'floor' }; } catch { return null; } }))).filter(Boolean);
  const R = (s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(opts.seed ?? 2026);
  const pick = a => a[Math.floor(R() * a.length)];
  const byKind = k => loaded.filter(d => d.kind === k);
  const placed = new Map(loaded.map(d => [d, []])), contacts = [];
  const spots = [];                                               // nothing stands inside another
  const free = (x, z, r) => !spots.some(s => Math.hypot(s[0] - x, s[1] - z) < (s[2] + r) * .72);
  const put = (d, x, y, z, s, anchor, face) => { placed.get(d).push({ p: [x, y, z], w: d.w * s, h: d.h * s, flip: R() < .5 ? -1 : 1, anchor, face }); };
  const floorSet = byKind('floor'), big = floorSet.filter(d => d.h >= 1.1), small = floorSet.filter(d => d.h < 1.1), walls = byKind('wall'), hang = byKind('hang');
  const stand = (d, x, z, s) => { const hw = d.w * s / 2;
    if (!clear(x, z, hw) || !free(x, z, hw)) return false;
    // in the hallway band: against the wall, turning only so far
    const inHall = z < -4 && Math.abs(x) < 2, face = inHall ? [-Math.sign(x), 0, .6] : null;
    if (inHall && hw > .305) return false;                       // x 1.84, turning at most ~53 deg off the wall: reaches x 1.6 and no further (the walking lane)
    put(d, x, 0, z, s, 0, face); spots.push([x, z, hw]); contacts.push([x, hw * 2.7 + .25, z, opts.contact ?? .55]); return true; };
  // film.json world.setOpts.sprites.place: [{ name, x, z, s }]: hand-placed for the shots, checked against the same rules
  const byName = n => loaded.find(d => d.name === n);
  for (const q of opts.place || []) { const d = byName(q.name); if (!d) continue; if (!stand(d, q.x, q.z, q.s ?? 1)) log(`sprites: place ${q.name} at ${q.x}, ${q.z} refused (lane, doorway, wall or another sprite)`); }
  // the clusters: seeds along the set, each kept or not by a large noise (bad stretches and clear stretches), with a big thing + what gathered round it
  const zones = [ { x: [5.3, 6.9], z: [-3.4, 17.5], n: 16, side: 2 }, { x: [2.3, 3.6], z: [-3.85, -2.7], n: 2, side: 2 }, { x: [2.7, 6.8], z: [10.2, 17.6], n: 6, side: 2 },
    { x: [2.4, 6.8], z: [-71.5, -4.4], n: opts.sideRooms ?? 80, side: 2 } ];
  for (const Z of zones) for (let i = 0; i < Z.n; i++) {
    const sx = R() < .5 ? -1 : 1, z = Z.z[0] + R() * (Z.z[1] - Z.z[0]);
    let x = Z.x[0] + R() * (Z.x[1] - Z.x[0]);
    // they gather at walls
    if (R() < .7) x = R() < .6 ? Z.x[1] - R() * .5 : Z.x[0] + R() * .5;
    const bad = noise1(z * .16 + sx * 9, 3) * .7 + noise1(z * .47, 7) * .3;
    if (bad < (opts.gather ?? .48)) continue;
    const X = sx * x;
    if (big.length) { const d = pick(big); if (stand(d, X, z, .85 + R() * .35)) { const n = Math.floor(R() * 3.5);
      for (let j = 0; j < n && small.length; j++) stand(pick(small), X + (R() - .5) * 1.5, z + (R() - .5) * 1.8, .8 + R() * .5); } }
    else if (small.length) stand(pick(small), X, z, .8 + R() * .5);
  }
  // the hallway band: small things against the wall, far apart, by the same noise
  const thin = floorSet.filter(d => d.w <= .85 && d.h < 1.05);
  if (thin.length) for (let z = -7; z > -70; z -= 1.1) { const sx = hashN(z, 11) < .5 ? -1 : 1;
    if (noise1(z * .13 + sx * 4, 5) < (opts.hallGather ?? .6) || R() < .6) continue;
    const d = pick(thin); stand(d, sx * 1.84, z + R() * .6, Math.min(.8 + R() * .15, .6 / d.w)); }
  // growth at the foot of the walls: it comes up where Blender's scatter put the damp and mould (wall decal cells 18-23), so it follows the same organic pattern
  if (walls.length) { const damp = (scatter?.decals || []).filter(d => d.surface === 'wall' && d.cell >= 18 && d.cell <= 23);
    for (const d0 of damp) { if (R() > (opts.growth ?? .8)) continue;
      const d = pick(walls), inH = Math.abs(d0.pos[0]) < 2.1 && d0.pos[2] < -4, s = inH ? Math.min(.7 + R() * .4, .6 / d.w) : .7 + R() * .4, nx = d0.normal[0], nz = d0.normal[2], hw = d.w * s / 2, x = d0.pos[0] + nx * .05, z = d0.pos[2] + nz * .05;
      if (!clear(x, z, Math.abs(x) < 2.1 ? Math.min(hw, .3) : hw * .4, true)) continue;
      put(d, x, 0, z, s, 0, [nx, nz, inH ? .6 : .36]); contacts.push([x, hw * 1.9 + .15, z, (opts.contact ?? .55) * .8]); } }
  // what hangs: out of the holes in the ceiling (Blender's own scatter), then a few from the grid in the worst stretches. Stops above y 4.3.
  if (hang.length) {
    const hOf = d => Math.min(d.h, 4.96 - 4.32);
    const drop = (hx, hz, y) => { const d = pick(hang), s = hOf(d) / d.h * (.72 + R() * .28); put(d, hx, y, hz, s, 1, null); };
    const holes = (scatter?.instances?.tile_missing_frame || []).map(v => [v[0], v[2]]);
    for (const [hx, hz] of holes) { const n = 1 + Math.floor(R() * (opts.hangPerHole ?? 3.5)); for (let j = 0; j < n; j++) drop(hx + (R() - .5) * .9, hz + (R() - .5) * .9, 5.02); }
    for (let z = 17; z > -71; z -= 1.2) for (const x0 of [-5.4, -1.2, 1.2, 5.4]) {
      if (noise1(z * .2 + x0, 9) < (opts.hangGather ?? .66) || R() < .55) continue;
      const x = Math.round(x0 / 1.2) * 1.2 + (R() - .5) * .1; if (z > -4.3 && z < -3.7) continue; if (z < -4 && (Math.abs(x) > 1.85 && Math.abs(x) < 2.15)) continue;
      drop(x, z, 4.97); }
  }
  // film.json world.setOpts.sprites.keepClean: [{ x: [a, b], z: [a, b], maxTop, hang }]: art direction after the scatter (so nothing else moves): in that box nothing taller than maxTop stands, and nothing hangs
  const removed = [];
  for (const K of opts.keepClean || []) for (const [d, items] of placed) { const keep = items.filter(it => { const [x, , z] = it.p, inside = x >= K.x[0] && x <= K.x[1] && z >= K.z[0] && z <= K.z[1];
      if (!inside) return true; const out = it.anchor > .5 ? K.hang !== false : it.h > (K.maxTop ?? 0); if (out) { removed.push(`${d.name} ${x.toFixed(1)},${z.toFixed(1)}`); const c = contacts.findIndex(c => c[0] === x && c[2] === z); if (c >= 0) contacts.splice(c, 1); } return !out; });
    placed.set(d, keep); }
  // film.json world.setOpts.sprites.clearPath: { r, rSmall, rHang, keys: [[x, y, z], ...] }: a camera that flies: nothing stays within r of its line on the ground, so nothing crosses the lens
  const CP = opts.clearPath;
  if (CP) { const distTo = (x, z) => { let m = 1e9; for (let i = 0; i < CP.keys.length - 1; i++) { const a = CP.keys[i], b = CP.keys[i + 1], dx = b[0] - a[0], dz = b[2] - a[2], k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / Math.max(dx * dx + dz * dz, 1e-6))); m = Math.min(m, Math.hypot(x - a[0] - dx * k, z - a[2] - dz * k)); } return m; };
    for (const [d, items] of placed) placed.set(d, items.filter(it => { const [x, , z] = it.p, R = it.anchor > .5 ? (CP.rHang ?? 1.2) : it.h > 1.1 ? (CP.r ?? 3.2) : (CP.rSmall ?? 1.5); if (distTo(x, z) >= R) return true; removed.push(`${d.name} ${x.toFixed(1)},${z.toFixed(1)}`); const c = contacts.findIndex(c => c[0] === x && c[2] === z); if (c >= 0) contacts.splice(c, 1); return false; })); }
  if (removed.length) log('sprites: kept clean, removed ' + removed.join('; '));
  // ---- one instanced draw per picture + one for the contacts
  let count = 0, draws = 0;
  const plane = new THREE.PlaneGeometry(1, 1);
  for (const [d, items] of placed) { if (!items.length) continue;
    const g = new THREE.InstancedBufferGeometry(); g.index = plane.index; g.setAttribute('position', plane.attributes.position); g.setAttribute('uv', plane.attributes.uv); g.instanceCount = items.length;
    const P = new Float32Array(items.length * 3), S = new Float32Array(items.length * 4), F = new Float32Array(items.length * 3);
    items.forEach((it, i) => { P.set(it.p, i * 3); S.set([it.w, it.h, it.flip, it.anchor], i * 4); if (it.face) F.set(it.face, i * 3); });
    g.setAttribute('aPos', new THREE.InstancedBufferAttribute(P, 3)); g.setAttribute('aS', new THREE.InstancedBufferAttribute(S, 4)); g.setAttribute('aFace', new THREE.InstancedBufferAttribute(F, 3));
    const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
      uniforms: { uMap: { value: d.tex }, uT: U.uT, uLightCol: U.uLightCol, uAmb: U.uAmb, uFlick: U.uFlick, uWrap: U.uWrap, uFall: U.uFall, uLeak: U.uLeak, uCap: { value: opts.cap ?? .55 }, uDesat: { value: d.kind === 'hang' ? (opts.desatHang ?? .7) : (opts.desat ?? .3) }, uTint: { value: new THREE.Vector3(...(opts.tint || [.84, .82, .82])) } } });
    const o = new THREE.Mesh(g, m); o.frustumCulled = false; o.name = 'sprite.' + (d.name || ''); group.add(o); count += items.length; draws++;
  }
  if (contacts.length) {
    const g = new THREE.InstancedBufferGeometry(); g.index = plane.index; g.setAttribute('position', plane.attributes.position); g.setAttribute('uv', plane.attributes.uv); g.instanceCount = contacts.length;
    g.setAttribute('aC', new THREE.InstancedBufferAttribute(new Float32Array(contacts.flat()), 4));
    const m = new THREE.ShaderMaterial({ vertexShader: CONTACT_V, fragmentShader: CONTACT_F, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
    const o = new THREE.Mesh(g, m); o.frustumCulled = false; o.renderOrder = -1.4; o.name = 'sprite.contacts'; group.add(o); draws++;
  }
  log(`sprites: ${count} from ${loaded.length} pictures, ${draws} draws, ${contacts.length} contacts`);
  return { sprites: count, draws, contacts: contacts.length };
}
