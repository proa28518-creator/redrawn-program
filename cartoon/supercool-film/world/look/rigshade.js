// world/look/rigshade.js: the shading pass on characters and props for any set that offers its lights as data (rig = world/look/lights.js). First used by films/s4_shade, 2026-11-04.
// charshade.js is the same idea on the backrooms' panel grid, and stays as it is so that film stays pixel-identical. This one knows no set: new set = new settings (JSON, the film's shade.mjs).
// The characters are 2.5D, so form comes from the drawing: every material of a character gets one small function at the end of its fragment shader that works in SCREEN space, from the
// head disc and body axis (known each frame). It only multiplies what the character drew and adds thin light on top, so every line, colour and expression stays theirs.
// What a frame does for one character (per character, pure in t, no frame ever looks at the frame before):
//   1 sample the rig's lights (rig.sample(place, t)) at his head, over a window along his own timeline, so walking under a light turns the shadow instead of snapping it.
//   2 split them: the KEY (the direction all light agrees on, steady power only, flicker can never steer it: that was the flicker gruss caught) and the FILL (what comes from elsewhere).
//   3 three colours in display numbers: czK lit side, czS shadow side (never under the place's `floor`: faces stay faces), czF what the fill adds on its side.
// Settings: { zones: { place: [x, z] }, states: [{ from, zone, use }], steps: [t] (hard cuts where the light may step: windows never read across them), window, levWin, dirWin, flickShare,
//   places: { name: { exposure, sat, keyTint, fillTint, floor: [r,g,b], keyMin: [r,g,b], hard, rim, rimFill, low, chest, hood, front (the key never comes from further behind the face than this), caustic, causticScale, causticSpeed,
//     noSteer: [light ids], extra: [ lights in the rig's format, for characters only ], aerial: { color (display), density, max }, metal: { spec, env, keep, sky, ground } } },
//   moods: [{ t0, t1, in, out, place, exposure, hard, rim, low, floorK, fillK, tintK, tintS, who: { id: k, '*': k } }] }: in / out are ease widths inside t0..t1, 0 = a step, for a mood that starts on a cut }
const GLSL = /* glsl */`
uniform vec4 czHead, czAxis, czKey, czFill, czPar, czPar2, czFog, czCaus, czMat; uniform vec3 czK, czS, czF, czRim, czRimK, czEnvT, czEnvB; uniform vec2 czFeet;
float czH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float czN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(czH(i), czH(i + vec2(1., 0.)), f.x), mix(czH(i + vec2(0., 1.)), czH(i + vec2(1., 1.)), f.x), f.y); }
// light through moving water: two layers of cells whose edges meet in thin lines, anchored on the character so a camera move never swims through it
float czCaustic(vec2 q) { float t = czCaus.w, a = czN(q + vec2(t, t * .7)), b = czN(q * 1.7 - vec2(t * .8, -t * .5) + 9.), c = max(1. - abs(a - b) * 3.2, 0.); return c * c * c; }
vec3 czShade(vec3 c) {
  vec2 px = gl_FragCoord.xy; float r = max(czHead.z, 1.);
  vec2 p = (px - czHead.xy) / r; float d = length(p);
  vec2 kd = normalize(czKey.xy + vec2(0., .001)), fd = normalize(czFill.xy + vec2(0., .001));
  float lum = dot(c, vec3(.3, .5, .2));
  // the brass of a diver's helmet: a real sphere of metal round the head
  if (czMat.x > .5) {
    vec2 q = p / czMat.y; float dq = min(dot(q, q), 1.); vec3 n = vec3(q, sqrt(1. - dq));
    float ndl = dot(n, czKey.xyz), L = mix(smoothstep(-.5, .5, ndl), smoothstep(-.22, .02, ndl), czPar.x);
    vec3 mm = mix(czS, czK, L) + czF * smoothstep(-.1, .8, dot(n, czFill.xyz));
    mm = mix(mm, vec3(dot(mm, vec3(.3, .5, .2))), czFill.w);                  // metal.keep: brass stays brass in coloured light, it doesn't go the colour of the water
    vec3 base = c * mm;
    float ink = smoothstep(.2, .34, lum), ndh = max(dot(n, normalize(czKey.xyz + vec3(0., 0., 1.))), 0.), nfh = max(dot(n, normalize(czFill.xyz + vec3(0., 0., 1.))), 0.);
    vec3 env = mix(czEnvB, czEnvT, smoothstep(-.14, .24, n.y));          // a bright world above, a dark one below, with a horizon line: what makes a ball read as polished
    env = mix(env, vec3(dot(env, vec3(.3, .5, .2))), czFill.w);
    float fres = pow(1. - n.z, 2.5);
    vec3 o = base + c * env * czPar2.z * (.45 + .8 * fres) * ink + (czK * (pow(ndh, 44.) * 1.15 + pow(ndh, 8.) * .2) + (czF + czRim * .12) * pow(nfh, 22.) * .8) * czPar2.y * ink;
    if (czCaus.x > 0.) o *= 1. + czCaus.x * (czCaustic(q * czCaus.y + czMat.zw) * 2.2 - .4) * smoothstep(-.1, .55, n.y) * ink;
    return mix(o, czFog.rgb, czFog.w);
  }
  // head: a sphere over the head disc
  float z = sqrt(max(1. - min(d * d, 1.), 0.)), ndl = dot(vec3(p, z), czKey.xyz);
  float headL = mix(smoothstep(-.62, .34, ndl), smoothstep(-.3, -.14, ndl), czPar.x);
  float top = smoothstep(-.1, .75, p.y);
  vec3 headM = mix(czS, czK, headL) * (1. + .06 * top) + czF * smoothstep(-.25, .75, dot(vec3(p, z), czFill.xyz));
  if (czPar.w > 0.) headM *= 1. - czPar.w * smoothstep(.3, .98, dot(p, kd));     // a face inside a helmet: the rim of the port shades its light side
  // body: a cylinder round the axis hem -> head, lit from the same key
  vec2 A = czAxis.xy, B = czHead.xy, ab = B - A; float len = max(length(ab), 1.); vec2 ax = ab / len, nx = vec2(ax.y, -ax.x);
  float q = clamp(dot(px - A, nx) / (r * 1.28), -1., 1.), bz = sqrt(1. - q * q * .92);
  vec3 bn = vec3(nx * q, bz * .75);
  float bodyL = smoothstep(-.42, .62, dot(bn, czKey.xyz) + .28 * czKey.y);
  float hT = clamp((px.y - czFeet.x) / max(czFeet.y - czFeet.x, 1.), 0., 1.);       // 0 feet .. 1 head centre
  float low = mix(czPar.z, 1., smoothstep(.06, .56, hT));
  vec2 sc = p + czKey.xy + vec2(0., .28); float csh = smoothstep(1.24, .92, length(sc * vec2(.92, 1.)));   // the head's shadow on the chest: the disc moved away from the light
  vec3 bodyM = (mix(czS * .94, czK, bodyL) + czF * smoothstep(-.3, .7, dot(bn, czFill.xyz))) * low * (1. - czPar2.x * csh);
  float inHead = czMat.x > .25 ? 1. : smoothstep(1.06, .98, d);          // a hat goes with the head: no line where the head's disc ends
  vec3 m = mix(bodyM, headM, inHead);
  vec3 o = c * m;
  // water light on what faces up: head, shoulders. The shade only: never brighter than a bright line
  if (czCaus.x > 0. && lum > .14) { float up = mix(smoothstep(.1, .9, hT) * .55, smoothstep(-.3, .55, p.y), inHead); o *= 1. + czCaus.x * (czCaustic(p * czCaus.y + czMat.zw) * 2.2 - .4) * up; }
  // thin catches of light on the head's edge: the key's side and the fill's side, never on ink, not on a head inside a helmet
  if (czPar.w <= 0. && czMat.x < .25) { float edge = smoothstep(.885, .94, d) * smoothstep(.985, .955, d); vec2 dir = d > .001 ? p / d : vec2(0., 1.);
    float rk = edge * smoothstep(.45, .92, dot(dir, kd)) * czPar.y * smoothstep(.07, .22, lum), rf = edge * smoothstep(.35, .9, dot(dir, fd)) * czPar2.w * smoothstep(.07, .22, lum);
    o += czRimK * rk * mix(.3, .7, lum) + czRim * rf * mix(.3, .8, lum); }
  return mix(o, czFog.rgb, czFog.w);
}`;
const PROP_F = /* glsl */`
uniform vec4 czKey, czFill, czPar2, czFog, czMat; uniform vec3 czK, czS, czF, czRim; varying vec3 vCzN; varying float vCzD;
vec3 czShadeP(vec3 c) {
  if (czMat.w > .5) c = pow(max(c, vec3(0.)), vec3(1. / 2.2));     // a loose prop in post's world pass: its material wrote linear numbers, the pass reads display numbers
  vec3 n = normalize(vCzN); if (!gl_FrontFacing) n = -n;
  float L = smoothstep(-.3, .4, dot(n, czKey.xyz)), lum = dot(c, vec3(.3, .5, .2)), ink = smoothstep(.2, .34, lum);
  vec3 o = c * (mix(czS, czK, L) + czF * smoothstep(-.2, .7, dot(n, czFill.xyz)));
  float ndh = max(dot(n, normalize(czKey.xyz + vec3(0., 0., 1.))), 0.), fres = pow(1. - abs(n.z), 4.);
  o += (czK * pow(ndh, 40.) * .55 * czPar2.y + (czRim * .5 + czF) * fres * max(dot(n.xy, normalize(czFill.xy + vec2(0., .001))), 0.) * czPar2.w * .5) * ink;
  float f = min(1. - exp(-pow(vCzD * czFog.a, 1.4)), czMat.z);     // far along a long hose the murk takes it
  o = mix(o, czFog.rgb, f);
  return o;
}`;

const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const LUM = v => v[0] * .3 + v[1] * .5 + v[2] * .2;
const DEF = { exposure: 1, sat: 1, keyTint: [1, 1, 1], fillTint: [1, 1, 1], floor: [.3, .3, .3], keyMin: [0, 0, 0], hard: .55, rim: .6, rimFill: .6, low: .5, chest: .36, hood: 0, front: -.5, caustic: 0, causticScale: .5, causticSpeed: .35, noSteer: [], extra: [],
  aerial: { color: [0, 0, 0], density: 0, max: 0 }, metal: { spec: 1, env: .5, keep: 0, sky: [.6, .6, .6], ground: [.1, .1, .1] }, flickShare: .5 };

export function createRigShade(THREE, rig, opts = {}) {
  const O = { zones: {}, states: [], steps: [], places: {}, moods: [], window: [[-.24, 1], [-.12, 2], [0, 3], [.12, 2], [.24, 1]], levWin: .1, dirWin: .4, ...opts };
  const actors = new Map(), propsU = new Map(), roots = new Map(), patchedCh = new Set(), viewR = new THREE.Matrix3(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
  let shared = 0, logged = false, cur = new Map(), steady = new Map(), curT = -1;

  // ---- where: the zone a point stands in (zones hold the places), and what that zone wears at t
  const zoneOf = (x, z) => { let best = null, bd = 1e12; for (const [n, [a, b]] of Object.entries(O.zones)) { const d = (x - a) ** 2 + (z - b) ** 2; if (d < bd) { bd = d; best = n; } } return best; };
  const placeOf = (zone, t) => { let use = zone; for (const s of O.states) if (s.zone === zone && t >= s.from - 1e-4) use = s.use; return use; };
  const settings = name => { const P = O.places[name] || {}; return { ...DEF, ...P, aerial: { ...DEF.aerial, ...P.aerial }, metal: { ...DEF.metal, ...P.metal } }; };
  const cached = new Map(); const settingsOf = n => { let s = cached.get(n); if (!s) { s = settings(n); cached.set(n, s); } return s; };
  // a window never reads across a hard step: the frame after a cut is not a blend of the world before it
  const inStep = (t, tt) => { for (const s of O.steps) { if (t >= s && tt < s) return s; if (t < s && tt >= s) return s - .001; } return tt; };
  // the place's lights at time tt: the rig's + the place's own extra ones. One sample per (zone, tt) per frame
  function sample(zone, place, S, tt) { const key = zone + '|' + place + '|' + tt.toFixed(4); let r = cur.get(key); if (!r) { const a = rig.sample(zone, tt); r = { sky: a.sky, ground: a.ground, lights: S.extra.length ? a.lights.concat(S.extra.map(extraLight)) : a.lights }; cur.set(key, r); } return r; }
  const extraLight = l => ({ ...l, power: l.power ?? 1, dir: l.dir ? (h => l.dir.map(v => v / h))(Math.hypot(...l.dir)) : [0, 1, 0], pos: l.pos || [0, 0, 0] });
  // how much of the light's power reaches a point; direction left in _w
  function reach(l, x, y, z) {
    if (l.kind === 'sun') { _w.set(l.dir[0], l.dir[1], l.dir[2]); return 1; }
    _w.set(l.pos[0] - x, l.pos[1] - y, l.pos[2] - z); const r2 = _w.lengthSq() + .02, rg = l.range ?? 1e3, rr = r2 / (rg * rg); _w.multiplyScalar(1 / Math.sqrt(r2));
    let a = 1 / (1 + r2 * (l.fall ?? .05)) * Math.min(1, Math.max(0, 1 - rr * rr));
    if (l.kind === 'spot') { const co = Math.cos((l.cone?.[1] ?? 180) * Math.PI / 180), ci = Math.cos((l.cone?.[0] ?? 170) * Math.PI / 180), c = -(_w.x * l.dir[0] + _w.y * l.dir[1] + _w.z * l.dir[2]); a *= smooth(co, ci, c); }
    return a; }
  // a light's power as characters feel it. `base`: over the wide window, what steers the direction. `lev`: the flicker softened and only a share of it
  function powers(zone, place, S, t) { const key = zone + '|' + place; let r = steady.get(key); if (r) return r;
    const n = sample(zone, place, S, t).lights.length, base = new Array(n).fill(0), lev = new Array(n).fill(0), pick = (w, N, out) => { for (let i = -N; i <= N; i++) { const L = sample(zone, place, S, inStep(t, t + i * w / N)).lights; for (let j = 0; j < n; j++) out[j] += (L[j]?.power ?? 0) / (2 * N + 1); } };
    pick(O.dirWin, 8, base); pick(O.levWin, 3, lev);
    r = { base, lev: lev.map((v, j) => base[j] + (v - base[j]) * S.flickShare) }; steady.set(key, r); return r; }
  // what a place's mood is at t, for this character
  function moodAt(place, S, t, id) { const P = { exposure: S.exposure, hard: S.hard, rim: S.rim, rimFill: S.rimFill, low: S.low, floor: S.floor, keyTint: S.keyTint, fillTint: S.fillTint, sat: S.sat, tintS: [1, 1, 1], lift: 1 };
    for (const M of O.moods) { if (M.place && M.place !== place) continue; const a = M.in ?? .15, b = M.out ?? .15, k = (a > 0 ? smooth(M.t0, M.t0 + a, t) : (t >= M.t0 ? 1 : 0)) * (b > 0 ? 1 - smooth(M.t1 - b, M.t1, t) : (t < M.t1 ? 1 : 0)); if (k <= 0) continue;
      for (const f of ['hard', 'rim', 'rimFill', 'low', 'sat']) if (M[f] != null) P[f] += (M[f] - P[f]) * k;
      if (M.exposure != null) P.exposure *= 1 + (M.exposure - 1) * k;
      if (M.floorK != null) P.floor = P.floor.map(v => v * (1 + (M.floorK - 1) * k));
      if (M.tintK) P.keyTint = P.keyTint.map((v, i) => v * (1 + (M.tintK[i] - 1) * k));
      if (M.tintS) P.tintS = P.tintS.map((v, i) => v * (1 + (M.tintS[i] - 1) * k));
      if (M.who) { const w = M.who[id] ?? M.who['*']; if (w != null) P.lift *= 1 + (w - 1) * k; } }
    return P; }
  const D = x => Math.pow(Math.max(1 - Math.exp(-x), 0), 1 / 2.2);    // light on a white surface -> the display number that surface shows
  const desat = (c, s) => { const l = LUM(c); return [l + (c[0] - l) * s, l + (c[1] - l) * s, l + (c[2] - l) * s]; };

  // the light at a point, read over `win`. Out: view-space key and fill, colours in display numbers
  function solve(out, zone, place, S, t, id, at) {
    const M = moodAt(place, S, t, id), pw = powers(zone, place, S, t), Lk = [0, 0, 0], E = [];
    const nL = pw.base.length; for (let j = 0; j < nL; j++) E.push({ s: 0, rgb: [0, 0, 0], dir: [0, 0, 0] });
    let wsum = 0;
    for (const [dt, wt] of O.window) { const tt = inStep(t, t + dt), L = sample(zone, place, S, tt).lights, [x, y, z] = at(tt); wsum += wt;
      for (let j = 0; j < nL; j++) { const l = L[j], a = reach(l, x, y, z), e = E[j]; e.s += a * pw.base[j] * LUM(l.color) * wt; e.dir[0] += _w.x * wt; e.dir[1] += _w.y * wt; e.dir[2] += _w.z * wt; const v = a * pw.lev[j] * wt; e.rgb[0] += l.color[0] * v; e.rgb[1] += l.color[1] * v; e.rgb[2] += l.color[2] * v; } }
    const L0 = sample(zone, place, S, t).lights;
    for (let j = 0; j < nL; j++) { const e = E[j]; e.s /= wsum; e.rgb = e.rgb.map(v => v / wsum); const h = Math.hypot(...e.dir) || 1; e.dir = e.dir.map(v => v / h); if (!S.noSteer.includes(L0[j].id)) { Lk[0] += e.dir[0] * e.s; Lk[1] += e.dir[1] * e.s; Lk[2] += e.dir[2] * e.s; } }
    let h = Math.hypot(...Lk); if (h < 1e-5) { Lk[0] = 0; Lk[1] = 1; Lk[2] = 0; h = 1; } const K = Lk.map(v => v / h);
    // key = what agrees with that direction, fill = the rest, and where the rest comes from
    const Ek = [0, 0, 0], Ef = [0, 0, 0], Fd = [0, 0, 0];
    for (const e of E) { const c = Math.max(e.dir[0] * K[0] + e.dir[1] * K[1] + e.dir[2] * K[2], 0), kk = c * c; for (let i = 0; i < 3; i++) { Ek[i] += e.rgb[i] * kk; Ef[i] += e.rgb[i] * (1 - kk); } const wf = e.s * (1 - kk); for (let i = 0; i < 3; i++) Fd[i] += e.dir[i] * wf; }
    const env = sample(zone, place, S, t), A = [0, 1, 2].map(i => env.ground[i] + (env.sky[i] - env.ground[i]) * .55);
    const Ek2 = desat(Ek, M.sat), Ef2 = desat(Ef, M.sat), x = M.exposure * M.lift;
    const Kc = [0, 1, 2].map(i => Math.max(D((A[i] + Ek2[i] + Ef2[i] * .3) * x) * M.keyTint[i], S.keyMin[i] * M.lift));
    const Sc = [0, 1, 2].map(i => Math.max(D((A[i] + Ef2[i] * .2) * x), M.floor[i]) * M.tintS[i]);
    let Fc = [0, 1, 2].map(i => Math.max(D((A[i] + Ef2[i]) * x) - D(A[i] * x), 0) * M.fillTint[i]);
    // the fill never out-shines the key: a dim key with a bright fill turns the drawn shadow shape inside out
    { const room = Math.max(LUM(Kc) * .86 - LUM(Sc), 0), lf = LUM(Fc); if (lf > room) Fc = Fc.map(v => v * room / Math.max(lf, 1e-4)); }
    let fh = Math.hypot(...Fd); if (fh < 1e-5) { Fd[0] = -K[0]; Fd[1] = K[1] * .2; Fd[2] = K[2]; fh = Math.hypot(...Fd) || 1; }
    _v.set(K[0], K[1], K[2]).applyMatrix3(viewR).normalize(); out.key = (a => a.map(v => v / Math.hypot(...a)))([_v.x, _v.y, Math.max(_v.z, S.front)]);
    _v.set(Fd[0] / fh, Fd[1] / fh, Fd[2] / fh).applyMatrix3(viewR).normalize(); out.fill = [_v.x, _v.y, _v.z];
    const fc = Math.max(...Ef2, 1e-4), rimC = Ef2.map(v => v / fc);
    const kc = Math.max(...Ek2, 1e-4), rimK = Ek2.map(v => v / kc);
    Object.assign(out, { K: Kc, S: Sc, F: Fc, rimC, rimK, M, rimFill: M.rimFill * Math.min(1, LUM(Ef2) * x * 2.5), rim: M.rim * (1 + Math.max(-out.key[2], 0) * 1.6) });
    return out; }

  const newU = () => ({ czHead: { value: new THREE.Vector4() }, czAxis: { value: new THREE.Vector4() }, czKey: { value: new THREE.Vector4(0, 1, 0, 1) }, czFill: { value: new THREE.Vector4(0, 0, 1, 0) }, czPar: { value: new THREE.Vector4() }, czPar2: { value: new THREE.Vector4() }, czFog: { value: new THREE.Vector4() }, czCaus: { value: new THREE.Vector4() },
    czK: { value: new THREE.Vector3(1, 1, 1) }, czS: { value: new THREE.Vector3(1, 1, 1) }, czF: { value: new THREE.Vector3() }, czRim: { value: new THREE.Vector3() }, czRimK: { value: new THREE.Vector3() }, czEnvT: { value: new THREE.Vector3() }, czEnvB: { value: new THREE.Vector3() }, czFeet: { value: new THREE.Vector2() } });
  const isMetal = o => { for (let p = o, i = 0; p && i < 2; p = p.parent, i++) if (/^diver\./.test(p.name || '')) return true; return false; };
  // the material kind for the shader: 1 metal (a helmet: a sphere of its own), .4 a hat (shaded with the head, no rim), 0 everything else
  const kindOf = (o, hat) => isMetal(o) ? 1 : hat.has(o) ? .4 : 0;
  function patchChar(m, U, metal, seed) {
    if (!m || m.userData.czU === U) return; if (m.userData.czU) { shared++; return; } m.userData.czU = U;
    const u = { ...U, czMat: { value: new THREE.Vector4(metal, metal === 1 ? 1.38 : 1, seed[0], seed[1]) } };
    const inject = src => GLSL + src.replace(/\}\s*$/, '  gl_FragColor.rgb = czShade(gl_FragColor.rgb);\n}');
    if (m.isShaderMaterial || m.isRawShaderMaterial) { m.fragmentShader = inject(m.fragmentShader); Object.assign(m.uniforms, u); m.needsUpdate = true; return; }
    const prev = m.onBeforeCompile, key = prev.toString();
    m.onBeforeCompile = (s, r) => { prev.call(m, s, r); s.fragmentShader = inject(s.fragmentShader); Object.assign(s.uniforms, u); };
    m.customProgramCacheKey = () => key + '|czr'; m.needsUpdate = true;
  }
  function patchProp(m, U, loose) {
    if (!m || m.userData.czU === U) return; if (m.userData.czU) { shared++; return; } m.userData.czU = U;
    const u = { ...U, czMat: { value: new THREE.Vector4(0, 0, .85, loose ? 1 : 0) } };
    const f = src => PROP_F + src.replace(/\}\s*$/, '  gl_FragColor.rgb = czShadeP(gl_FragColor.rgb);\n}'), v = src => 'varying vec3 vCzN; varying float vCzD;\n' + src.replace(/\}\s*$/, '  vCzN = normalize(normalMatrix * normal); vCzD = length((modelViewMatrix * vec4(position, 1.)).xyz);\n}');
    if (m.isShaderMaterial) { m.fragmentShader = f(m.fragmentShader); m.vertexShader = v(m.vertexShader); Object.assign(m.uniforms, u); m.needsUpdate = true; return; }
    const prev = m.onBeforeCompile, key = prev.toString();
    m.onBeforeCompile = (s, r) => { prev.call(m, s, r); s.fragmentShader = f(s.fragmentShader); s.vertexShader = v(s.vertexShader); Object.assign(s.uniforms, u); };
    m.customProgramCacheKey = () => key + '|czrp'; m.needsUpdate = true;
  }
  const put = (U, R, S, hood, fogK) => {
    U.czKey.value.set(R.key[0], R.key[1], R.key[2], 1); U.czFill.value.set(R.fill[0], R.fill[1], R.fill[2], S.metal.keep);
    U.czK.value.set(...R.K); U.czS.value.set(...R.S); U.czF.value.set(...R.F); U.czRim.value.set(...R.rimC); U.czRimK.value.set(...R.rimK);
    U.czPar.value.set(R.M.hard, R.rim, R.M.low, hood); U.czPar2.value.set(S.chest, S.metal.spec, S.metal.env, R.rimFill);
    U.czFog.value.set(S.aerial.color[0], S.aerial.color[1], S.aerial.color[2], fogK);
    U.czEnvT.value.set(...S.metal.sky); U.czEnvB.value.set(...S.metal.ground); };
  const px = (W, H, cam, p) => { _v.copy(p).project(cam); return [(_v.x + 1) / 2 * W, (_v.y + 1) / 2 * H]; };
  const rootAt = (ctx, def, tt) => { const key = def.name + '|' + Math.round(tt * 240); let r = roots.get(key); if (!r) { r = ctx.rootOf(def.name, tt); roots.set(key, r); } return r; };

  function update(ctx, camera, t) {
    const { chars, props, W, H } = ctx;
    if (t !== curT) { cur = new Map(); steady = new Map(); curT = t; }
    camera.updateMatrixWorld(); viewR.setFromMatrix4(camera.matrixWorldInverse);
    const byId = new Map();
    for (const { ch, def } of chars) {
      let U = actors.get(ch); if (!U) { U = newU(); actors.set(ch, U); }
      const rNow = rootAt(ctx, def, t), zone = zoneOf(rNow[0], rNow[2]), place = placeOf(zone, t), S = settingsOf(place);
      const helmet = ch.root.getObjectByName?.('diver.shell') ? 1 : 0;
      if (!patchedCh.has(ch)) { patchedCh.add(ch); const seed = [(rNow[0] * 1.3) % 7, (rNow[2] * 1.7) % 7]; const hat = new Set(); ch.parts?.hat?.traverse?.(o => hat.add(o)); ch.root.traverse(o => { if (!o.isMesh) return; const met = kindOf(o, hat); if (Array.isArray(o.material)) o.material.forEach(m => patchChar(m, U, met, seed)); else patchChar(o.material, U, met, seed); }); }
      if (!ch.root.visible) continue;   // SPEED: culled by the stage this frame (not updated, not drawn): patched as before, nothing to shade
      const w = ch.where(), hd = [w.head.x - rNow[0], w.head.y, w.head.z - rNow[2]];
      const R = solve({}, zone, place, S, t, def.name, tt => { const r0 = rootAt(ctx, def, tt), r = Math.hypot(r0[0] - rNow[0], r0[2] - rNow[2]) > 4 ? rNow : r0; return [r[0] + hd[0], hd[1] + r[1] - rNow[1], r[2] + hd[2]]; });   // the read window never crosses a place key (a jump > 4 D); height moves the point too
      const [hx, hy] = px(W, H, camera, w.head), [ax, ay] = px(W, H, camera, w.hem), fy = Math.min(...w.feet.map(f => px(W, H, camera, _w.set(f.x, Math.min(f.y, w.root.y + .05), f.z))[1]));
      const dist = camera.position.distanceTo(w.head), fog = Math.min(1 - Math.exp(-Math.pow(dist * S.aerial.density, 1.4)), S.aerial.max);
      put(U, R, S, helmet * S.hood, fog);
      U.czHead.value.set(hx, hy, Math.max(ch.V.d / 2, 1), 1); U.czAxis.value.set(ax, ay, 0, 0); U.czFeet.value.set(fy, hy);
      U.czCaus.value.set(S.caustic, S.causticScale, 0, t * S.causticSpeed);
      byId.set(def.name, U);
    }
    for (const p of props) {
      if (p.def.kind === 'knockfx') continue;                  // the rings on the knocks are light, not things
      let U = propsU.get(p); if (!U) { U = newU(); propsU.set(p, U); const owner = p.o.userData.holder || p.def.owner, loose = !owner; p.o.traverse(o => { if (!o.isMesh) return; if (Array.isArray(o.material)) o.material.forEach(m => patchProp(m, U, loose)); else patchProp(o.material, U, loose); }); }
      const own = byId.get(p.def.owner) || (p.o.userData.holder && byId.get(p.o.userData.holder?.id || p.o.userData.holder));
      if (own) { for (const k of ['czKey', 'czFill', 'czK', 'czS', 'czF', 'czRim', 'czRimK', 'czPar', 'czPar2']) U[k].value.copy(own[k].value); }
      p.o.getWorldPosition(_v); const px0 = _v.x, py0 = _v.y, pz0 = _v.z, zone = zoneOf(px0, pz0), place = placeOf(zone, t), S = settingsOf(place);
      if (!own) { const R = solve({}, zone, place, S, t, p.def.id, () => [px0, py0 + .8, pz0]); put(U, R, S, 0, 0); }
      U.czFog.value.set(S.aerial.color[0], S.aerial.color[1], S.aerial.color[2], S.aerial.density);
    }
    if (!logged) { logged = true; console.log(`rigshade: ${actors.size} characters, ${propsU.size} props, ${shared} materials shared`); }
    return shared;
  }
  // the shader's multiplier (its luminance) at points on the head and chest, for the numeric check lab/shade_jumps.mjs
  const PTS = [['face', 0, 0], ['brow', 0, .35], ['chin', 0, -.6], ['cheekL', -.55, -.15], ['cheekR', .55, -.15]];
  function headM(U, x, y) { const k = U.czKey.value, f = U.czFill.value, hard = U.czPar.value.x, d2 = x * x + y * y, z = Math.sqrt(Math.max(1 - Math.min(d2, 1), 0)), ndl = x * k.x + y * k.y + z * k.z;
    const L = (1 - hard) * smooth(-.62, .34, ndl) + hard * smooth(-.3, -.14, ndl), fl = smooth(-.25, .75, x * f.x + y * f.y + z * f.z), top = 1 + .06 * smooth(-.1, .75, y);
    const K = U.czK.value, S = U.czS.value, F = U.czF.value; return LUM([0, 1, 2].map(i => (['x', 'y', 'z'].map(c => S[c] + (K[c] - S[c]) * L)[i]) * top + ['x', 'y', 'z'].map(c => F[c] * fl)[i])); }
  function chestM(U) { const h = U.czHead.value, a = U.czAxis.value, k = U.czKey.value, K = U.czK.value, S = U.czS.value, F = U.czF.value, f = U.czFill.value, r = Math.max(h.z, 1), low0 = U.czPar.value.z, ft = U.czFeet.value;
    const x = h.x * .35 + a.x * .65, y = h.y * .35 + a.y * .65, px = (x - h.x) / r, py = (y - h.y) / r, abx = h.x - a.x, aby = h.y - a.y, len = Math.max(Math.hypot(abx, aby), 1), nx = aby / len, ny = -abx / len, q = Math.min(1, Math.max(-1, ((x - a.x) * nx + (y - a.y) * ny) / (r * 1.28))), bz = Math.sqrt(1 - q * q * .92) * .75;
    const bL = smooth(-.42, .62, nx * q * k.x + ny * q * k.y + bz * k.z + .28 * k.y), hT = Math.min(1, Math.max(0, (y - ft.x) / Math.max(ft.y - ft.x, 1))), low = low0 + (1 - low0) * smooth(.06, .56, hT), csh = smooth(1.24, .92, Math.hypot((px + k.x) * .92, py + k.y + .28)), fl = smooth(-.3, .7, nx * q * f.x + ny * q * f.y + bz * f.z);
    return LUM(['x', 'y', 'z'].map(c => (S[c] * .94 + (K[c] - S[c] * .94) * bL + F[c] * fl) * low * (1 - U.czPar2.value.x * csh))); }
  const dump = () => [...actors].map(([ch, U]) => ({ id: ch.id, head: U.czHead.value.toArray(), axis: U.czAxis.value.toArray(), key: U.czKey.value.toArray(), par: U.czPar.value.toArray(), feet: U.czFeet.value.toArray(), K: U.czK.value.toArray(), S: U.czS.value.toArray(), fog: U.czFog.value.w,
    pts: { ...Object.fromEntries(PTS.map(([n, x, y]) => [n, headM(U, x, y)])), chest: chestM(U) } }));
  return { update, dump, shared: () => shared };
}
