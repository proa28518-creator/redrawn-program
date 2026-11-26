// world/look/look.js: the post pipeline a set asks for by handing back `set.look` (lab/stage.html calls set.look.render instead of renderer.render).
// Order of one frame (W x H = the stage's size):
//   1 WORLD   everything but the characters and held props -> HDR target with a depth texture. MSAA at full quality. Linear light.
//   2 AIR     1/4 res: march the view ray to the depth: height + distance haze, panel light hanging in the air (cones, glow). rgb in-scatter, a transmittance.
//   3 HAZED   full res: world * T + S, alpha = signed circle of confusion from depth and focus.
//   4 DOF     1/2 res: down, disc gather (a sample counts only where its own CoC reaches this pixel; a sharp sample never bleeds into a blurred one).
//   5 BLOOM   bright parts of the blurred image, 1/4 and 1/8 res, soft glow.
//   6 SCREEN  blend sharp / blurred by CoC + bloom, to display colour, onto the canvas, writing gl_FragDepth from the WORLD depth texture.
//   7 ACTORS  characters + held props, on top, with the same depth test they always had: door frames hide them, their own depth tricks are untouched.
//   8 DUST    additive points with the depth test on.
// The characters are never in a target or a filter: their pixels are exactly what stage.html would have drawn.
// Everything is pure in t: the focus table, the flicker, the dust.
// Settings, film.json world.setOpts.look: quality 'auto' (full at 1200 px on the long side or more, preview below, so make_film --preview is cheap by itself) | 'full' | 'preview';
//   aperture 28 and maxBlur 26 (px at 1920 tall), dof false, focus (a fixed distance), nearK, dead, density, heightK, far, scatter, murk, glow (linear rgb), bloom, bloomThr, gain, dust false, thingClear .9 (how much of the haze a prop of kind figure drops).
// Per shot: `focus` on a shot (or its camera): a distance, a character or prop id, or [x, y, z]. Otherwise focus.js picks the subject.
import { LIGHT_GLSL } from './light.glsl.js';
import { makeFocus } from './focus.js';
import { makeDust } from './dust.js';

const QUALITY = {
  full:    { samples: 4, airScale: 4, airSteps: 18, gather: 48, dofScale: 2, dust: 2600 },
  preview: { samples: 0, airScale: 8, airSteps: 8,  gather: 14, dofScale: 4, dust: 900 },
};
const FS_V = /* glsl */`varying vec2 vUv; void main() { vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0., 1.); }`;

const AIR_F = q => /* glsl */`
varying vec2 vUv; uniform sampler2D tDepth; uniform mat4 uInvVP; uniform vec3 uCam, uMurk, uGlow; uniform float uDens, uFar, uHeightK, uScatter;
${LIGHT_GLSL}
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
void main() {
  float dz = texture2D(tDepth, vUv).r;
  vec4 w = uInvVP * vec4(vUv * 2. - 1., dz * 2. - 1., 1.); vec3 end = w.xyz / w.w, rd = end - uCam;
  float L = length(rd); rd /= L; L = min(L, uFar);
  float d = ign(gl_FragCoord.xy), T = 1., prev = 0.; vec3 S = vec3(0.);
  for (int i = 0; i < ${q.airSteps}; i++) {
    float u = (float(i) + 1.) / float(${q.airSteps}), ti = L * u * u, dt = ti - prev;
    float mid = prev + dt * d; prev = ti;
    vec3 p = uCam + rd * mid;
    float dens = uDens * (1. + uHeightK * exp(-p.y * 1.1)) * smoothstep(9., 46., mid);
    float a = exp(-dens * dt);
    S += T * (1. - a) * (uMurk + uGlow * brAir(p) * uScatter);
    T *= a;
  }
  gl_FragColor = vec4(S, T);
}`;

const HAZED_F = /* glsl */`
varying vec2 vUv; uniform sampler2D tWorld, tDepth, tAir; uniform float uNear, uFar2, uFocus, uAp, uMaxPx, uNearK, uDead, uThingK; uniform vec3 uThing; uniform mat4 uInvVP2;
float linZ(float d) { float n = d * 2. - 1.; return 2. * uNear * uFar2 / (uFar2 + uNear - n * (uFar2 - uNear)); }
void main() {
  vec3 c = texture2D(tWorld, vUv).rgb; vec4 a = texture2D(tAir, vUv);
  float dz = texture2D(tDepth, vUv).r, z = linZ(dz);
  // the thing keeps its black: the pixels ON it (a thin column around it, not the floor) lose most of the haze; the hallway around and behind it keeps all of its depth
  float clearK = 0.;
  if (uThingK > 0.) { vec4 w = uInvVP2 * vec4(vUv * 2. - 1., dz * 2. - 1., 1.); vec3 p = w.xyz / w.w; clearK = uThingK * step(length(p.xz - uThing.xy), .58) * step(.03, p.y) * step(p.y, uThing.z); }
  // thin lens: blur grows with |z - f| / z and tends to a limit far away. Longer focus distance = a smaller disc.
  float s = z - uFocus, g = max(abs(s) - uDead, 0.) / max(z, .3) * uAp * pow(8. / max(uFocus, 4.), .5);
  if (s < 0.) g *= uNearK;
  gl_FragColor = vec4(c * mix(a.a, 1., clearK) + a.rgb * (1. - clearK), clamp(sign(s) * g / uMaxPx, -1., 1.));
}`;
const DOWN_F = /* glsl */`
varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uPx;
void main() { vec2 o = uPx * .5; gl_FragColor = (texture2D(tSrc, vUv + vec2(-o.x, -o.y)) + texture2D(tSrc, vUv + vec2(o.x, -o.y)) + texture2D(tSrc, vUv + vec2(-o.x, o.y)) + texture2D(tSrc, vUv + vec2(o.x, o.y))) * .25; }`;
const GATHER_F = q => /* glsl */`
varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uPx; uniform float uR;
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
void main() {
  vec4 c = texture2D(tSrc, vUv); float cr = abs(c.a) * uR, rot = ign(gl_FragCoord.xy) * 6.283;
  vec3 sum = c.rgb; float sw = 1.;
  for (int i = 0; i < ${q.gather}; i++) {
    float fi = float(i) + .5, r = sqrt(fi / float(${q.gather})) * uR, an = fi * 2.39996 + rot;
    vec4 s = texture2D(tSrc, vUv + vec2(cos(an), sin(an)) * r * uPx);
    float sr = abs(s.a) * uR;
    float reach = s.a >= c.a ? min(sr, cr) : sr;
    float w = smoothstep(r - 1., r + 1., reach);
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
varying vec2 vUv; uniform sampler2D tSharp, tBlur, tDepth, tB0, tB1; uniform vec2 uPx; uniform float uMaxPx, uBloom, uGain, uDither;
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
vec3 toDisplay(vec3 c) { c = pow(max(c, 0.), vec3(1. / 2.2)); return mix(c, 1. - exp((.82 - c) / .18) * .18, step(.82, c)); }
void main() {
  vec4 sh = texture2D(tSharp, vUv); float px = abs(sh.a) * uMaxPx, k = smoothstep(.6, 2.6, px);
  vec3 c = sh.rgb;
  if (k > 0.) { vec2 o = uPx; vec3 b = (texture2D(tBlur, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tBlur, vUv + vec2(o.x, -o.y)).rgb + texture2D(tBlur, vUv + vec2(-o.x, o.y)).rgb + texture2D(tBlur, vUv + vec2(o.x, o.y)).rgb) * .25; c = mix(c, b, k); }
  c += (texture2D(tB0, vUv).rgb + texture2D(tB1, vUv).rgb * 1.3) * uBloom;
  c = toDisplay(c * uGain) + (ign(gl_FragCoord.xy) - .5) * uDither;
  gl_FragColor = vec4(c, 1.);
  gl_FragDepth = texture2D(tDepth, vUv).r;
}`;

// flat hall / room layout test: is the straight line a -> b cut by a wall? (focus only: a character behind a wall is not a subject)
export function brBlocked(a, b) {
  const cross = (x) => { if ((a[0] - x) * (b[0] - x) >= 0) return false; const k = (x - a[0]) / (b[0] - a[0]), z = a[2] + (b[2] - a[2]) * k; if (z > -4) return false; const door = Math.abs(((z + 13) % 6 + 6) % 6 - 3) < 1 && z < -9 && z > -65; return !door; };
  if (cross(2) || cross(-2)) return true;
  if ((a[2] + 4) * (b[2] + 4) < 0) { const k = (-4 - a[2]) / (b[2] - a[2]), x = Math.abs(a[0] + (b[0] - a[0]) * k); if (!(x < 2 || Math.abs(x - 4.8) < 1)) return true; }
  return false;
}

export function createLook(THREE, opts = {}) {
  const O = { quality: 'auto', aperture: 28, maxBlur: 26, nearK: .55, dead: .35, density: .05, heightK: .55, far: 70, scatter: .22,
    murk: [.0266, .0222, .0058], glow: [.95, .95, .42], bloom: .34, bloomThr: 1.15, gain: 1, dust: true, dof: true, thingClear: .9, ...opts };
  let W = 0, H = 0, R = null, q = null;       // targets + materials, built on the first frame (size known)
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsGeo = new THREE.BufferGeometry();
  fsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const fsMesh = new THREE.Mesh(fsGeo, null); fsMesh.frustumCulled = false;
  const fsScene = new THREE.Scene(); fsScene.add(fsMesh);
  const mat = (frag, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: FS_V, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...extra });
  const rtOpts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };

  function build(renderer, w, h) {
    W = w; H = h;
    q = { ...(QUALITY[O.quality] || (Math.max(W, H) >= 1200 ? QUALITY.full : QUALITY.preview)), ...(O.gather ? { gather: O.gather } : {}) };
    const depth = new THREE.DepthTexture(W, H); depth.type = THREE.UnsignedIntType; depth.minFilter = depth.magFilter = THREE.NearestFilter;
    const world = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, depthTexture: depth, samples: q.samples });
    const rt = (s) => new THREE.WebGLRenderTarget(Math.max(2, Math.round(W / s)), Math.max(2, Math.round(H / s)), rtOpts);
    const air = rt(q.airScale), hazed = rt(1), half = rt(q.dofScale), dof = rt(q.dofScale), b0a = rt(q.dofScale * 2), b0b = rt(q.dofScale * 2), b1a = rt(q.dofScale * 4), b1b = rt(q.dofScale * 4);
    const scale = H / 1920, maxPx = O.maxBlur * scale;
    const M = {
      air: mat(AIR_F(q), { tDepth: { value: depth }, uInvVP: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() }, uMurk: { value: new THREE.Vector3(...O.murk) }, uGlow: { value: new THREE.Vector3(...O.glow) },
        uDens: { value: O.density }, uFar: { value: O.far }, uHeightK: { value: O.heightK }, uScatter: { value: O.scatter }, uFlick: { value: 1 }, uWrap: { value: new THREE.Vector2(1, 0) }, uFall: { value: 1 }, uLeak: { value: 0 } }),
      hazed: mat(HAZED_F, { tWorld: { value: world.texture }, tDepth: { value: depth }, tAir: { value: air.texture }, uNear: { value: .1 }, uFar2: { value: 600 }, uFocus: { value: 8 }, uAp: { value: O.aperture * scale }, uMaxPx: { value: maxPx }, uNearK: { value: O.nearK }, uDead: { value: O.dead }, uThingK: { value: 0 }, uThing: { value: new THREE.Vector3() }, uInvVP2: { value: new THREE.Matrix4() } }),
      down: mat(DOWN_F, { tSrc: { value: hazed.texture }, uPx: { value: new THREE.Vector2(1 / W, 1 / H) } }),
      gather: mat(GATHER_F(q), { tSrc: { value: half.texture }, uPx: { value: new THREE.Vector2(1 / half.width, 1 / half.height) }, uR: { value: maxPx / q.dofScale } }),
      bright: mat(BRIGHT_F, { tSrc: { value: dof.texture }, uThr: { value: O.bloomThr }, uPx: { value: new THREE.Vector2(1 / dof.width, 1 / dof.height) } }),
      blur: mat(BLUR_F, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } }),
      down2: mat(DOWN_F, { tSrc: { value: b0a.texture }, uPx: { value: new THREE.Vector2(1 / b0a.width, 1 / b0a.height) } }),
      screen: mat(SCREEN_F, { tSharp: { value: hazed.texture }, tBlur: { value: dof.texture }, tDepth: { value: depth }, tB0: { value: b0a.texture }, tB1: { value: b1a.texture },
        uPx: { value: new THREE.Vector2(.5 / dof.width, .5 / dof.height) }, uMaxPx: { value: maxPx }, uBloom: { value: O.bloom }, uGain: { value: O.gain }, uDither: { value: 1 / 255 } },
        { depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth }),
    };
    const dust = O.dust === false ? null : makeDust(THREE, { count: q.dust });
    R = { world, depth, air, hazed, half, dof, b0a, b0b, b1a, b1b, M, dust, maxPx, scale };
  }
  const pass = (renderer, material, target) => { fsMesh.material = material; renderer.setRenderTarget(target); renderer.render(fsScene, fsCam); };
  const blur2 = (renderer, a, b) => { const B = R.M.blur.uniforms;
    B.tSrc.value = a.texture; B.uDir.value.set(1 / a.width, 0); pass(renderer, R.M.blur, b);
    B.tSrc.value = b.texture; B.uDir.value.set(0, 1 / a.height); pass(renderer, R.M.blur, a); };

  let focusAt = null, lastFocus = 0;
  const _vp = new THREE.Matrix4();
  function render(renderer, scene, camera, t, ctx) {
    if (!R || ctx.W !== W || ctx.H !== H) build(renderer, ctx.W, ctx.H);
    if (!focusAt) focusAt = ctx.shotFns ? makeFocus(THREE, ctx, { blocked: brBlocked }) : () => 8;
    const flick = opts.flickAt ? opts.flickAt(t) : 1;
    const focus = O.focus ?? focusAt(t); lastFocus = focus;
    // who is an actor: every character, and a prop while it sits in a hand. Everything else in the scene is world (set, decals, blobs, the thing, loose props).
    const actors = new Set(ctx.chars.map(c => c.ch.root)); for (const p of ctx.props) if (p.o.userData.holder) actors.add(p.o);
    const bg = scene.background, autoClear = renderer.autoClear, kids = scene.children, vis = kids.map(o => o.visible);
    if (api.shading) api.shading.update(ctx, camera, t, flick, opts.flickAt);   // charshade.js: only a film that asks
    // 1 world
    kids.forEach((o, i) => { if (actors.has(o)) o.visible = false; });
    renderer.setRenderTarget(R.world); renderer.autoClear = true; renderer.render(scene, camera);
    // 2-5 filters
    const M = R.M;
    camera.updateMatrixWorld(); _vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    M.air.uniforms.uInvVP.value.copy(_vp).invert(); M.air.uniforms.uCam.value.copy(camera.position); M.air.uniforms.uFlick.value = flick;
    pass(renderer, M.air, R.air);
    Object.assign(M.hazed.uniforms.uNear, { value: camera.near }); Object.assign(M.hazed.uniforms.uFar2, { value: camera.far }); M.hazed.uniforms.uFocus.value = focus;
    const fig = ctx.props.find(p => p.def.kind === 'figure' && p.o.visible && !actors.has(p.o));
    M.hazed.uniforms.uThingK.value = fig ? O.thingClear : 0;
    if (fig) { M.hazed.uniforms.uThing.value.set(fig.o.position.x, fig.o.position.z, (fig.def.h ?? 4.1) + .15); M.hazed.uniforms.uInvVP2.value.copy(M.air.uniforms.uInvVP.value); }
    M.hazed.uniforms.uAp.value = O.dof === false ? 0 : O.aperture * R.scale;
    pass(renderer, M.hazed, R.hazed);
    pass(renderer, M.down, R.half);
    pass(renderer, M.gather, R.dof);
    pass(renderer, M.bright, R.b0a);
    blur2(renderer, R.b0a, R.b0b);
    pass(renderer, M.down2, R.b1a);
    blur2(renderer, R.b1a, R.b1b); blur2(renderer, R.b1a, R.b1b);
    // 6 screen: sharp / blurred, depth from the world
    pass(renderer, M.screen, null);
    // 7 actors on top
    renderer.autoClear = false; scene.background = null;
    kids.forEach((o, i) => { o.visible = actors.has(o) ? vis[i] : (o === camera ? vis[i] : false); });
    if (O.hideNearPx) for (const c of ctx.chars) if (c.ch.V.d > O.hideNearPx) c.ch.root.visible = false;   // a flying camera right on top of someone: the 2.5D head explodes to the size of the frame (a solid dark frame); only a film that asks
    renderer.setRenderTarget(null); renderer.render(scene, camera);
    kids.forEach((o, i) => { o.visible = vis[i]; });
    // 8 dust
    if (R.dust) { R.dust.update(t, camera, focus, O.aperture * R.scale, H, flick, R.maxPx * .9); renderer.render(R.dust.scene, camera); }
    scene.background = bg; renderer.autoClear = autoClear;
  }
  const api = { render, options: O, focus: () => lastFocus }; globalThis.__czLook = api; return api;
}
