// world/look/post.js: the general post pipeline (S-4 pass 4, 2026-11-04). look.js is the backrooms' own (its haze reads that set's panel grid); this one knows no set.
// A set hands back `look: createPost(THREE, rig, settings)`. What it needs from the set is only `rig` (world/look/lights.js): rig.at(place) = this frame's lights, as data.
// Settings are JSON (film.json world.setOpts.post), so a film says what each place gets:
//   quality 'auto' (full at 1200 px on the long side or more, preview below) | 'full' | 'preview'
//   zones  { place: [x, z] }: where each place stands; the camera's nearest zone is where we are (a pure function of the camera). A zone name is also its rig place
//   states [{ from, zone, use }]: from time `from` that zone wears the settings of place `use` (the storm cleared: 'dawn')
//   moves  [t | [t, halfWidth]]: camera flights: the settings cross-fade over t +- halfWidth, and the air's lights go to nothing at t. Any other change of place is a cut: a hard switch
//   blend  .14: default half width of a move
//   focus  [[t0, t1, target]]: where the story looks (a character or prop id, a distance, or [x,y,z]); otherwise focus.js picks. maxBlur 26 (px at 1920 tall)
//   places { name: settings }, all optional, default = nothing added:
//     air: { density, start: [a, b] (no haze near the lens, full from b), far, heightK, heightFall, floor (density * (1 + heightK exp(-(y - floor) heightFall))), color (linear murk),
//            lights (how much of the place's light hangs in the air), g (forward scatter, -1..1), top, absorb (light fades going down from y = top), noise, noiseScale, noiseSpeed (clumps),
//            keys [[t, k]] (density over time), perLight { id: k }, shafts { id: { scale, speed, depth } } (a sun seen through moving gaps: god rays) }
//     dof: { aperture, nearK, dead }, bloom: { k, thr }, warp (screen wobble of the world, water), gain
//     grade: { gamma, contrast, saturation, gr, gg, gb, vignette }: the same maths as ffmpeg eq + vignette (see grade.py), on the whole frame, characters too
//     particles: [ layer ] (world/look/particles.js)
// One frame: 1 WORLD (no actors) -> 2 AIR -> 3 HAZED -> 4 DOF -> 5 BLOOM -> 6 SCREEN (canvas, depth from the world) -> 7 ACTORS (same draw as without post) -> 8 PARTICLES -> 9 GRADE.
// A set may write display numbers (`input: 'display'`, the default: rigkit's rigOut): the world is decoded on the way in and encoded the same way on the way out, so with everything off the pixels are the set's own.
// Pure in t: camera, lights, focus table and particle positions are all functions of t. Characters are never in a target or a filter; only the final grade touches them, as ffmpeg did.
import { makeFocus } from './focus.js';
import { makeParticles } from './particles.js';

const QUALITY = {
  full:    { samples: 4, airScale: 4, airSteps: 18, gather: 48, dofScale: 2, parts: 1 },
  preview: { samples: 0, airScale: 8, airSteps: 8,  gather: 14, dofScale: 4, parts: .35 },
};
const IGN = /* glsl */`float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }`;
const FS_V = /* glsl */`varying vec2 vUv; void main() { vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0., 1.); }`;
const CODEC = /* glsl */`
vec3 fromDisplay(vec3 c) { vec3 over = max(c - 1., 0.); c = pow(clamp(c, 0., 1.), vec3(2.2)); vec3 hi = .7 - .3 * log(clamp(1. - (c - .7) / .3, .015, 1.)); return mix(c, hi, step(.7, c)) + over; }
vec3 toDisplay(vec3 c) { vec3 x = max(c - .7, 0.); c = min(c, vec3(.7)) + .3 * (1. - exp(-x / .3)); return pow(max(c, 0.), vec3(1. / 2.2)); }`;

const AIR_F = q => /* glsl */`
varying vec2 vUv; uniform sampler2D tDepth; uniform mat4 uInvVP; uniform vec3 uCam, uMurk; uniform float uDens, uFar, uHeightK, uHeightFall, uFloor, uStart0, uStart1, uG, uTop, uAbsorb, uNoise, uNoiseScale, uNoiseSpeed, uTime;
uniform vec4 uLPos[8]; uniform vec4 uLCol[8]; uniform vec4 uLDir[8]; uniform vec4 uLPar[8]; uniform vec4 uLGob[8];
${IGN}
float H2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float N2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(H2(i), H2(i + vec2(1., 0.)), f.x), mix(H2(i + vec2(0., 1.)), H2(i + vec2(1., 1.)), f.x), f.y); }
float N3(vec3 p) { float z = floor(p.z), f = fract(p.z); f = f * f * (3. - 2. * f); return mix(N2(p.xy + z * 17.3), N2(p.xy + (z + 1.) * 17.3), f); }
float phase(float c) { float d = 1. + uG * uG - 2. * uG * c; return (1. - uG * uG) / (d * sqrt(d)); }
vec3 lightsAt(vec3 p, vec3 rd) { vec3 s = vec3(0.);
  for (int i = 0; i < 8; i++) { float kind = uLPos[i].w; if (kind < .5) continue;
    vec3 l; float a = 1.; vec4 g = uLGob[i];
    if (kind > 2.5) { l = uLDir[i].xyz;
      if (g.x > 1.5) { vec2 q = (p.xz - l.xz / max(l.y, .12) * p.y) * g.y; float t = uTime * g.z, n = N2(q + vec2(t, t * .7)) * .62 + N2(q * 2.3 - vec2(t * .8, -t * .5) + 9.) * .38; n = smoothstep(.36, .72, n); a = 1. - g.w + g.w * n * 1.7; }
      if (uTop > 0.) a *= exp(-max(uTop - p.y, 0.) * uAbsorb);
    } else { vec3 d = uLPos[i].xyz - p; float r2 = dot(d, d) + .02, rr = r2 / (uLPar[i].y * uLPar[i].y); l = d * inversesqrt(r2);
      a = clamp(1. - rr * rr, 0., 1.) / (1. + r2 * uLPar[i].x);
      if (kind > 1.5) a *= smoothstep(uLDir[i].w, uLPar[i].z, dot(-l, uLDir[i].xyz));
      if (g.x > .5 && g.x < 1.5) { float az = atan(-l.x, -l.z), el = asin(clamp(-l.y, -1., 1.)), bar = smoothstep(.02, .3, abs(sin(az * g.y * .5))), hoop = smoothstep(.02, .3, abs(sin(el * g.z + .6))); a *= 1. - g.w * (1. - bar * hoop); } }
    s += uLCol[i].rgb * a * phase(dot(rd, l)); }
  return s; }
void main() {
  float dz = texture2D(tDepth, vUv).r;
  vec4 w = uInvVP * vec4(vUv * 2. - 1., dz * 2. - 1., 1.); vec3 end = w.xyz / w.w, rd = end - uCam;
  float L = length(rd); rd /= max(L, 1e-4); L = min(L, uFar);
  float d = ign(gl_FragCoord.xy), T = 1., prev = 0.; vec3 S = vec3(0.);
  for (int i = 0; i < ${q.airSteps}; i++) {
    float u = (float(i) + 1.) / float(${q.airSteps}), ti = L * u * u, dt = ti - prev, mid = prev + dt * d; prev = ti;
    vec3 p = uCam + rd * mid;
    float dens = uDens * (1. + uHeightK * exp(-(p.y - uFloor) * uHeightFall)) * smoothstep(uStart0, uStart1, mid);
    if (uNoise > 0.) dens *= 1. + uNoise * (N3(p * uNoiseScale + vec3(uTime * uNoiseSpeed, uTime * uNoiseSpeed * .4, -uTime * uNoiseSpeed * .7)) * 2. - 1.);
    float a = exp(-max(dens, 0.) * dt);
    S += T * (1. - a) * (uMurk + lightsAt(p, rd));
    T *= a;
  }
  gl_FragColor = vec4(S, T);
}`;
const HAZED_F = /* glsl */`
varying vec2 vUv; uniform sampler2D tWorld, tDepth, tAir; uniform float uNear, uFar2, uFocus, uAp, uMaxPx, uNearK, uDead, uWarp, uTime, uDecode;
${CODEC}
float linZ(float d) { float n = d * 2. - 1.; return 2. * uNear * uFar2 / (uFar2 + uNear - n * (uFar2 - uNear)); }
void main() {
  vec2 uv = vUv; if (uWarp > 0.) uv += uWarp * vec2(sin(vUv.y * 31. + uTime * 1.3) + .5 * sin(vUv.y * 73. - uTime * 2.1), .6 * cos(vUv.x * 23. + uTime * 1.1));
  vec3 c = texture2D(tWorld, uv).rgb; if (uDecode > .5) c = fromDisplay(c);
  vec4 a = texture2D(tAir, vUv);
  float z = linZ(texture2D(tDepth, vUv).r), s = z - uFocus, g = max(abs(s) - uDead, 0.) / max(z, .3) * uAp * pow(8. / max(uFocus, 4.), .5);
  if (s < 0.) g *= uNearK;
  gl_FragColor = vec4(c * a.a + a.rgb, clamp(sign(s) * g / uMaxPx, -1., 1.));
}`;
const DOWN_F = /* glsl */`
varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uPx;
void main() { vec2 o = uPx * .5; gl_FragColor = (texture2D(tSrc, vUv + vec2(-o.x, -o.y)) + texture2D(tSrc, vUv + vec2(o.x, -o.y)) + texture2D(tSrc, vUv + vec2(-o.x, o.y)) + texture2D(tSrc, vUv + vec2(o.x, o.y))) * .25; }`;
const GATHER_F = q => /* glsl */`
varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uPx; uniform float uR;
${IGN}
void main() {
  vec4 c = texture2D(tSrc, vUv); float cr = abs(c.a) * uR, rot = ign(gl_FragCoord.xy) * 6.283;
  vec3 sum = c.rgb; float sw = 1.;
  for (int i = 0; i < ${q.gather}; i++) {
    float fi = float(i) + .5, r = sqrt(fi / float(${q.gather})) * uR, an = fi * 2.39996 + rot;
    vec4 s = texture2D(tSrc, vUv + vec2(cos(an), sin(an)) * r * uPx);
    float sr = abs(s.a) * uR, reach = s.a >= c.a ? min(sr, cr) : sr, w = smoothstep(r - 1., r + 1., reach);
    sum += s.rgb * w; sw += w;
  }
  gl_FragColor = vec4(sum / sw, c.a);
}`;
const BRIGHT_F = /* glsl */`
varying vec2 vUv; uniform sampler2D tSrc; uniform float uThr; uniform vec2 uPx;
void main() { vec2 o = uPx; vec3 c = (texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb) * .25;
  float m = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(uThr, uThr * 1.6, m), 1.); }`;
const BLUR_F = /* glsl */`
varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uDir;
void main() { vec3 s = texture2D(tSrc, vUv).rgb * .2270; s += (texture2D(tSrc, vUv + uDir * 1.385).rgb + texture2D(tSrc, vUv - uDir * 1.385).rgb) * .3162; s += (texture2D(tSrc, vUv + uDir * 3.231).rgb + texture2D(tSrc, vUv - uDir * 3.231).rgb) * .0703; gl_FragColor = vec4(s, 1.); }`;
const SCREEN_F = /* glsl */`
varying vec2 vUv; uniform sampler2D tSharp, tBlur, tDepth, tB0, tB1; uniform vec2 uPx; uniform float uMaxPx, uBloom, uGain;
${IGN}
${CODEC}
void main() {
  vec4 sh = texture2D(tSharp, vUv); float px = abs(sh.a) * uMaxPx, k = smoothstep(.6, 2.6, px);
  vec3 c = sh.rgb;
  if (k > 0.) { vec2 o = uPx; vec3 b = (texture2D(tBlur, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tBlur, vUv + vec2(o.x, -o.y)).rgb + texture2D(tBlur, vUv + vec2(-o.x, o.y)).rgb + texture2D(tBlur, vUv + vec2(o.x, o.y)).rgb) * .25; c = mix(c, b, k); }
  c += (texture2D(tB0, vUv).rgb + texture2D(tB1, vUv).rgb * 1.3) * uBloom;
  gl_FragColor = vec4(toDisplay(c * uGain) + (ign(gl_FragCoord.xy) - .5) / 255., 1.);
  gl_FragDepth = texture2D(tDepth, vUv).r;
}`;
// the final grade: ffmpeg eq (full range BT.601, contrast then gamma on luma; saturation then a small gamma on each chroma plane) and vignette (cos^4 of the distance), on the finished frame
const GRADE_F = /* glsl */`
varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uRes; uniform float uGamma, uContrast, uSat, uGr, uGg, uGb, uVig;
${IGN}
void main() { vec3 c = texture2D(tSrc, vUv).rgb;
  float y = dot(c, vec3(.299, .587, .114)), u = (c.b - y) / 1.772 + .5, v = (c.r - y) / 1.402 + .5;
  y = pow(max(uContrast * (y - .5) + .5, 0.), 1. / (uGamma * uGg));
  u = pow(max(uSat * (u - .5) + .5, 1e-4), 1. / sqrt(uGb / uGg)); v = pow(max(uSat * (v - .5) + .5, 1e-4), 1. / sqrt(uGr / uGg));
  c = vec3(y + 1.402 * (v - .5), y - .34414 * (u - .5) - .71414 * (v - .5), y + 1.772 * (u - .5));
  float d = length((vUv - .5) * uRes) / length(uRes * .5), f = cos(uVig * d); f *= f; c *= f * f;
  gl_FragColor = vec4(c + (ign(gl_FragCoord.xy) - .5) * .6 / 255., 1.); }`;

const DEF = { air: { density: 0, start: [0, 1], far: 120, heightK: 0, heightFall: 1, floor: 0, color: [0, 0, 0], lights: 0, g: 0, top: 0, absorb: 0, noise: 0, noiseScale: .2, noiseSpeed: .1 },
  dof: { aperture: 28, nearK: .55, dead: .35 }, bloom: { k: 0, thr: 1.15 }, warp: 0, gain: 1, grade: { gamma: 1, contrast: 1, saturation: 1, gr: 1, gg: 1, gb: 1, vignette: 0 } };
// a place's settings as one flat row of numbers, so two places can be mixed
const row = (P, t) => { const a = { ...DEF.air, ...P.air }, d = { ...DEF.dof, ...P.dof }, b = { ...DEF.bloom, ...P.bloom }, g = { ...DEF.grade, ...P.grade };
  let k = 1; const K = a.keys; if (K?.length) { k = K[K.length - 1][1]; if (t <= K[0][0]) k = K[0][1]; else for (let i = 0; i < K.length - 1; i++) if (t >= K[i][0] && t <= K[i + 1][0]) k = K[i][1] + (K[i + 1][1] - K[i][1]) * (t - K[i][0]) / Math.max(1e-3, K[i + 1][0] - K[i][0]); }
  return { uDens: a.density * k, uStart0: a.start[0], uStart1: a.start[1], uFar: a.far, uHeightK: a.heightK, uHeightFall: a.heightFall, uFloor: a.floor, mr: a.color[0], mg: a.color[1], mb: a.color[2], lights: a.lights, uG: a.g, uTop: a.top, uAbsorb: a.absorb, uNoise: a.noise, uNoiseScale: a.noiseScale, uNoiseSpeed: a.noiseSpeed,
    aperture: d.aperture, nearK: d.nearK, dead: d.dead, bloom: b.k, thr: b.thr, warp: P.warp ?? 0, gain: P.gain ?? 1, uGamma: g.gamma, uContrast: g.contrast, uSat: g.saturation, uGr: g.gr, uGg: g.gg, uGb: g.gb, uVig: g.vignette }; };
const KIND = { point: 1, spot: 2, sun: 3 };

export function createPost(THREE, rig, opts = {}) {
  const O = { quality: 'auto', maxBlur: 26, blend: .14, input: 'display', zones: {}, states: [], moves: [], focus: [], places: {}, ...opts };
  let W = 0, H = 0, R = null, q = null, focusAt = null, line = null, lastFocus = 0;
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsGeo = new THREE.BufferGeometry();
  fsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const fsMesh = new THREE.Mesh(fsGeo, null); fsMesh.frustumCulled = false;
  const fsScene = new THREE.Scene(); fsScene.add(fsMesh);
  const mat = (frag, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: FS_V, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...extra });
  const rtOpts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const arr = n => ({ value: Array.from({ length: n }, () => new THREE.Vector4()) });

  function build(w, h) {
    W = w; H = h;
    q = { ...(QUALITY[O.quality] || (Math.max(W, H) >= 1200 ? QUALITY.full : QUALITY.preview)) };
    const depth = new THREE.DepthTexture(W, H); depth.type = THREE.UnsignedIntType; depth.minFilter = depth.magFilter = THREE.NearestFilter;
    const world = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, depthTexture: depth, samples: q.samples });
    const rt = s => new THREE.WebGLRenderTarget(Math.max(2, Math.round(W / s)), Math.max(2, Math.round(H / s)), rtOpts);
    const air = rt(q.airScale), hazed = rt(1), half = rt(q.dofScale), dof = rt(q.dofScale), b0a = rt(q.dofScale * 2), b0b = rt(q.dofScale * 2), b1a = rt(q.dofScale * 4), b1b = rt(q.dofScale * 4);
    const scale = H / 1920, maxPx = O.maxBlur * scale, canvasTex = new THREE.FramebufferTexture(W, H); canvasTex.minFilter = canvasTex.magFilter = THREE.NearestFilter;
    const u = v => ({ value: v }), airU = { tDepth: u(depth), uInvVP: u(new THREE.Matrix4()), uCam: u(new THREE.Vector3()), uMurk: u(new THREE.Vector3()), uTime: u(0), uLPos: arr(8), uLCol: arr(8), uLDir: arr(8), uLPar: arr(8), uLGob: arr(8) };
    for (const k of ['uDens', 'uFar', 'uHeightK', 'uHeightFall', 'uFloor', 'uStart0', 'uStart1', 'uG', 'uTop', 'uAbsorb', 'uNoise', 'uNoiseScale', 'uNoiseSpeed']) airU[k] = u(0);
    const gradeU = { tSrc: u(canvasTex), uRes: u(new THREE.Vector2(W, H)) }; for (const k of ['uGamma', 'uContrast', 'uSat', 'uGr', 'uGg', 'uGb', 'uVig']) gradeU[k] = u(1);
    const M = {
      air: mat(AIR_F(q), airU),
      hazed: mat(HAZED_F, { tWorld: u(world.texture), tDepth: u(depth), tAir: u(air.texture), uNear: u(.1), uFar2: u(600), uFocus: u(8), uAp: u(0), uMaxPx: u(maxPx), uNearK: u(.55), uDead: u(.35), uWarp: u(0), uTime: u(0), uDecode: u(O.input === 'display' ? 1 : 0) }),
      down: mat(DOWN_F, { tSrc: u(hazed.texture), uPx: u(new THREE.Vector2(1 / W, 1 / H)) }),
      gather: mat(GATHER_F(q), { tSrc: u(half.texture), uPx: u(new THREE.Vector2(1 / half.width, 1 / half.height)), uR: u(maxPx / q.dofScale) }),
      bright: mat(BRIGHT_F, { tSrc: u(dof.texture), uThr: u(1.15), uPx: u(new THREE.Vector2(1 / dof.width, 1 / dof.height)) }),
      blur: mat(BLUR_F, { tSrc: u(null), uDir: u(new THREE.Vector2()) }),
      down2: mat(DOWN_F, { tSrc: u(b0a.texture), uPx: u(new THREE.Vector2(1 / b0a.width, 1 / b0a.height)) }),
      screen: mat(SCREEN_F, { tSharp: u(hazed.texture), tBlur: u(dof.texture), tDepth: u(depth), tB0: u(b0a.texture), tB1: u(b1a.texture), uPx: u(new THREE.Vector2(.5 / dof.width, .5 / dof.height)), uMaxPx: u(maxPx), uBloom: u(0), uGain: u(1) }, { depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth }),
      grade: mat(GRADE_F, gradeU),
    };
    const parts = makeParticles(THREE, rig, O.places, { kCount: q.parts, depth, W, H, near: .1, far: 600 });
    R = { world, depth, air, hazed, half, dof, b0a, b0b, b1a, b1b, M, parts, maxPx, scale, canvasTex };
  }
  const pass = (renderer, material, target) => { fsMesh.material = material; renderer.setRenderTarget(target); renderer.render(fsScene, fsCam); };
  const blur2 = (renderer, a, b) => { const B = R.M.blur.uniforms;
    B.tSrc.value = a.texture; B.uDir.value.set(1 / a.width, 0); pass(renderer, R.M.blur, b);
    B.tSrc.value = b.texture; B.uDir.value.set(0, 1 / a.height); pass(renderer, R.M.blur, a); };

  // ---- where the story is at time t: read once from the shots (camera position -> nearest zone), so it is pure in t
  const zoneNames = () => Object.keys(O.zones);
  const zoneOf = p => { let best = zoneNames()[0], bd = 1e12; for (const z of zoneNames()) { const [x, y] = O.zones[z], d = (p[0] - x) ** 2 + (p[2] - y) ** 2; if (d < bd) { bd = d; best = z; } } return best; };
  const placeOf = (zone, t) => { let use = zone; for (const s of O.states) if (s.zone === zone && t >= s.from - 1e-4) use = s.use; return use; };
  function buildLine(fns) {
    const halfOf = t => { for (const m of O.moves) { const [a, w] = Array.isArray(m) ? m : [m, O.blend]; if (Math.abs(a - t) < .002) return w; } return 0; };
    const cuts = []; const first = placeOf(zoneOf(fns[0].f(fns[0].t0).pos), fns[0].t0); let cur = first;
    for (let i = 1; i < fns.length; i++) { const t = fns[i].t0, to = placeOf(zoneOf(fns[i].f(t).pos), t); if (to !== cur) { cuts.push({ t, to, w: halfOf(t) }); cur = to; } }
    return { first, cuts };
  }
  const smooth = x => { const u = Math.min(1, Math.max(0, x)); return u * u * (3 - 2 * u); };
  function weights(t) { const W = { [line.first]: 1 };
    for (const c of line.cuts) { const k = c.w ? smooth((t - c.t + c.w) / (2 * c.w)) : (t >= c.t - 1e-4 ? 1 : 0); if (k <= 0) continue; for (const p of Object.keys(W)) W[p] *= 1 - k; W[c.to] = (W[c.to] || 0) + k; }
    return W; }
  function mixed(W, t) { let out = null; for (const [p, w] of Object.entries(W)) { if (w <= 0) continue; const r = row(O.places[p] || {}, t); if (!out) { out = {}; for (const k in r) out[k] = r[k] * w; } else for (const k in r) out[k] += r[k] * w; } return out; }
  // a set's own materials that three colour-manages write linear numbers into a target but display numbers onto the canvas: make them write display numbers in the target too
  const OETF = 'gl_FragColor.rgb = mix(pow(max(gl_FragColor.rgb, vec3(.0031308)), vec3(.41666)) * 1.055 - .055, gl_FragColor.rgb * 12.92, step(gl_FragColor.rgb, vec3(.0031308)));';
  const patched = new WeakSet();
  const toDisplayMats = o => o.traverse(c => { if (!c.material) return; for (const m of Array.isArray(c.material) ? c.material : [c.material]) { if (m.isShaderMaterial || patched.has(m)) continue; patched.add(m);
    m.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <colorspace_fragment>', OETF); }; m.customProgramCacheKey = () => 'post-display'; m.needsUpdate = true; } });

  const _vp = new THREE.Matrix4(), _inv = new THREE.Matrix4();
  function render(renderer, scene, camera, t, ctx) {
    if (!R || ctx.W !== W || ctx.H !== H) build(ctx.W, ctx.H);
    if (api.shading) api.shading.update(ctx, camera, t);    // world/look/rigshade.js: only a film that asks (setOpts.post.shade)
    if (!line) line = ctx.shotFns ? buildLine(ctx.shotFns) : { first: zoneOf([camera.position.x, 0, camera.position.z]), cuts: [] };
    if (!focusAt) focusAt = ctx.shotFns ? makeFocus(THREE, ctx, { blocked: (a, b) => zoneOf(a) !== zoneOf(b), pick: tt => { for (const [a, b, who] of O.focus) if (tt >= a && tt < b) return who; return null; } }) : () => 8;
    const focus = focusAt(t); lastFocus = focus;
    const We = weights(t), P = mixed(We, t), M = R.M;
    // who is an actor: every character and whatever belongs to one (tools, hoses, the rings on the knocks). Everything else in the scene is world
    const actors = new Set(ctx.chars.map(c => c.ch.root)); for (const p of ctx.props) if (p.o.userData.holder || p.def.owner || p.def.kind === 'knockfx') actors.add(p.o);
    const bg = scene.background, autoClear = renderer.autoClear, kids = scene.children, vis = kids.map(o => o.visible);
    kids.forEach(o => { if (!actors.has(o)) toDisplayMats(o); });
    // 1 world
    kids.forEach(o => { if (actors.has(o)) o.visible = false; });
    renderer.setRenderTarget(R.world); renderer.autoClear = true; renderer.render(scene, camera);
    // 2 air: the lights of the place the camera is in, from the rig, going to nothing right on a move's seam
    camera.updateMatrixWorld(); _vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _inv.copy(_vp).invert();
    const A = M.air.uniforms; A.uInvVP.value.copy(_inv); A.uCam.value.copy(camera.position); A.uTime.value = t; A.uMurk.value.set(P.mr, P.mg, P.mb);
    for (const k of ['uDens', 'uFar', 'uHeightK', 'uHeightFall', 'uFloor', 'uStart0', 'uStart1', 'uG', 'uTop', 'uAbsorb', 'uNoise', 'uNoiseScale', 'uNoiseSpeed']) A[k].value = P[k];
    const zone = zoneOf([camera.position.x, 0, camera.position.z]), pl = placeOf(zone, t), here = O.places[pl] || {}, lk = Math.min(1, Math.max(0, ((We[pl] || 0) - .5) * 2)) * P.lights, list = rig.at(zone) || [];
    for (let i = 0; i < 8; i++) { const l = list[i], airK = l ? (here.air?.perLight?.[l.id] ?? 1) * lk * l.power : 0;
      if (!l || airK <= 0) { A.uLPos.value[i].w = 0; continue; }
      A.uLPos.value[i].set(l.pos[0], l.pos[1], l.pos[2], KIND[l.kind] || 1); A.uLCol.value[i].set(l.color[0] * airK, l.color[1] * airK, l.color[2] * airK, 0);
      const out = (l.cone?.[1] ?? 180) * Math.PI / 180, inn = (l.cone?.[0] ?? 170) * Math.PI / 180;
      A.uLDir.value[i].set(l.dir[0], l.dir[1], l.dir[2], Math.cos(out)); A.uLPar.value[i].set(l.fall ?? .05, l.range ?? 1e3, Math.cos(inn), 0);
      const sh = here.air?.shafts?.[l.id], gb = l.gobo;
      if (sh) A.uLGob.value[i].set(2, sh.scale ?? .3, sh.speed ?? .3, sh.depth ?? .8); else if (gb?.kind === 'cage') A.uLGob.value[i].set(1, gb.bars ?? 8, gb.rings ?? 3, gb.depth ?? .7); else A.uLGob.value[i].set(0, 0, 0, 0); }
    pass(renderer, M.air, R.air);
    // 3-5
    const Hz = M.hazed.uniforms; Hz.uNear.value = camera.near; Hz.uFar2.value = camera.far; Hz.uFocus.value = focus; Hz.uAp.value = P.aperture * R.scale; Hz.uNearK.value = P.nearK; Hz.uDead.value = P.dead; Hz.uWarp.value = P.warp; Hz.uTime.value = t;
    pass(renderer, M.hazed, R.hazed);
    pass(renderer, M.down, R.half);
    pass(renderer, M.gather, R.dof);
    M.bright.uniforms.uThr.value = P.thr; pass(renderer, M.bright, R.b0a);
    blur2(renderer, R.b0a, R.b0b);
    pass(renderer, M.down2, R.b1a);
    blur2(renderer, R.b1a, R.b1b); blur2(renderer, R.b1a, R.b1b);
    // 6 screen: sharp / blurred, depth from the world
    M.screen.uniforms.uBloom.value = P.bloom; M.screen.uniforms.uGain.value = P.gain;
    pass(renderer, M.screen, null);
    // 7 actors on top, exactly as stage.html draws them
    renderer.autoClear = false; scene.background = null;
    kids.forEach((o, i) => { o.visible = actors.has(o) ? vis[i] : (o === camera ? vis[i] : false); });
    renderer.setRenderTarget(null); renderer.render(scene, camera);
    kids.forEach((o, i) => { o.visible = vis[i]; });
    // 8 particles of the places we are in, depth tested against the set and the actors
    R.parts.render(renderer, camera, t, We, focus, P.aperture * R.scale, R.maxPx * .9);
    // 9 the grade: on the whole finished frame
    renderer.setRenderTarget(null); renderer.copyFramebufferToTexture(R.canvasTex);
    const G = M.grade.uniforms; for (const k of ['uGamma', 'uContrast', 'uSat', 'uGr', 'uGg', 'uGb', 'uVig']) G[k].value = P[k];
    pass(renderer, M.grade, null);
    scene.background = bg; renderer.autoClear = autoClear;
  }
  const api = { render, options: O, focus: () => lastFocus, weights: t => weights(t) }; globalThis.__czPost = api; return api;
}
