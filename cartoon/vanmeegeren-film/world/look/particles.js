// world/look/particles.js: particle layers for world/look/post.js. No set is known here: a layer is plain data on a place (`particles: [ layer ]`).
// Every layer is one instanced draw; positions come from a seed and t in the vertex shader (no state), the colour from the place's lights (rig.uniforms), so a dying lamp dims the dust and lightning lights the sleet by itself.
// Each is a capsule from where the particle was a shutter ago to where it is now, so speed reads as a streak. Out of focus it grows by its own circle of confusion and dims as it grows.
// A layer:
//   mode 'box' (fills a box round the camera, anchored in the world, wraps) | 'stream' (leaves `at` + `spread` for ever, each lives `life` s) | 'burst' (once, at time t0)
//   count, box [x,y,z], at [x,y,z], spread [x,y,z], vel [x,y,z], velVar [x,y,z] (+- per particle), speedVar (0..1), gravity (y accel), drag (burst), life, t0, stagger, window [a, b] (only then, soft edges)
//   size (radius, D), sizeVar, grow (D per s), minPx, shutter (s; 0 = round), shape 'soft' | 'puff' | 'bubble', color [r,g,b] (display), alpha, opaque (0 adds light, 1 covers), lit, ambient (linear), sway, swaySpeed, twinkle, nearFade [a, b], farFade, cocK (how much focus widens it: streaks stay thin), soft (D of fade where it meets a surface)
import { LIGHTS_GLSL } from './lights.js';

const VERT = /* glsl */`
attribute vec4 aSeed; attribute vec4 aSeed2;
uniform float uT, uMode, uLife, uT0, uStagger, uGravity, uDrag, uSpeedVar, uShutter, uSize, uSizeVar, uGrow, uMinPx, uSway, uSwaySpeed, uTwinkle, uAlpha, uLit, uAmbient, uFocus, uAp, uPxK, uMaxPx, uNear0, uNear1, uFarFade, uEdge, uCocK;
uniform vec3 uCenter, uBox, uAt, uSpread, uVel, uVelVar, uColor; uniform vec2 uRes, uWindow;
varying vec2 vQ; varying float vLen, vR, vBlur; varying vec4 vC; varying float vZ;
${LIGHTS_GLSL}
vec3 swayOf(float t, float a) { return vec3(sin(t * uSwaySpeed + a), sin(t * uSwaySpeed * .7 + a * 2.) * .6, cos(t * uSwaySpeed * .83 + a * 3.)) * uSway; }
void main() {
  float t = uT, a = aSeed.w * 6.283, fade = 1., age = 0.;
  vec3 v = (uVel + uVelVar * (aSeed2.xyz * 2. - 1.)) * (1. + uSpeedVar * (aSeed2.w - .5) * 2.), p1, p0;
  if (uMode < .5) {            // box round the camera
    p1 = aSeed.xyz * uBox + v * t + swayOf(t, a);
    p1 = mod(p1 - uCenter + uBox * .5, uBox) + uCenter - uBox * .5;
    vec3 e = uBox * .5 - abs(p1 - uCenter); fade = smoothstep(0., uEdge, min(e.x, min(e.y, e.z)));
    p0 = p1 - v * uShutter;
  } else if (uMode < 1.5) {    // stream
    float ph = fract(aSeed.w + t / uLife); age = ph * uLife;
    vec3 o = uAt + uSpread * (aSeed.xyz - .5);
    p1 = o + v * age + vec3(0., .5 * uGravity * age * age, 0.) + swayOf(t, a);
    float a0 = max(age - uShutter, 0.); p0 = o + v * a0 + vec3(0., .5 * uGravity * a0 * a0, 0.) + swayOf(t, a);
    fade = smoothstep(0., .08, ph) * smoothstep(1., .75, ph);
  } else {                     // burst
    age = t - uT0 - uStagger * aSeed2.x;
    if (age < 0. || age > uLife) { gl_Position = vec4(2., 2., 2., 1.); vC = vec4(0.); return; }
    vec3 o = uAt + uSpread * (aSeed.xyz - .5);
    float d = max(uDrag, .001), e1 = (1. - exp(-d * age)) / d, a0 = max(age - uShutter, 0.), e0 = (1. - exp(-d * a0)) / d;
    p1 = o + v * e1 + vec3(0., .5 * uGravity * age * age, 0.) + swayOf(t, a);
    p0 = o + v * e0 + vec3(0., .5 * uGravity * a0 * a0, 0.) + swayOf(t, a);
    float u = age / uLife; fade = (1. - u) * (1. - u) * smoothstep(0., .04, u);
  }
  if (uWindow.y > uWindow.x) fade *= smoothstep(uWindow.x, uWindow.x + .2, t) * smoothstep(uWindow.y, uWindow.y - .2, t);
  vec4 mv = viewMatrix * vec4(p1, 1.), c1 = projectionMatrix * mv, c0 = projectionMatrix * viewMatrix * vec4(p0, 1.);
  float z = -mv.z;
  if (z < .15 || c0.w < .1 || fade <= .001) { gl_Position = vec4(2., 2., 2., 1.); vC = vec4(0.); return; }
  vec2 s1 = c1.xy / c1.w * uRes * .5, s0 = c0.xy / c0.w * uRes * .5, d = s1 - s0; float len = length(d);
  vec2 ax = len > .001 ? d / len : vec2(1., 0.), sd = vec2(-ax.y, ax.x);
  float hl = len * .5, coc = min(uAp * abs(z - uFocus) / max(z, .5) * pow(8. / max(uFocus, 4.), .5), uMaxPx) * uCocK;
  float r0 = max((uSize * (1. + uSizeVar * aSeed2.y * aSeed2.y) + uGrow * age) * uPxK / max(z, .5), uMinPx), rr = r0 + coc;
  vec2 corner = position.xy * 2., off = ax * corner.x * (hl + rr) + sd * corner.y * rr, sc = (s0 + s1) * .5 + off;
  gl_Position = vec4(sc / (uRes * .5) * c1.w, c1.z, c1.w);
  vQ = vec2(corner.x * (hl + rr), corner.y * rr); vLen = hl; vR = rr; vBlur = 1. - r0 / rr; vZ = z;
  vec3 n = normalize(cameraPosition - p1), diff, spec; rigLight(p1, n, n, 0., diff, spec);
  vec3 lit = pow(max(pow(uColor, vec3(2.2)) * (diff * uLit + uAmbient), 0.), vec3(1. / 2.2));
  float k = r0 / rr, tw = 1. - uTwinkle * (.5 + .5 * sin(t * (1.1 + aSeed.z * 2.2) + a * 5.));
  vC = vec4(lit, uAlpha * fade * tw * k * k * (.35 + .65 * aSeed.x) * smoothstep(uNear0, uNear1, z) * exp(-z * uFarFade));
}`;
const FRAG = /* glsl */`
uniform sampler2D tDepth; uniform float uShape, uOpaque, uSoft, uNearZ, uFarZ; uniform vec2 uRes;
varying vec2 vQ; varying float vLen, vR, vBlur; varying vec4 vC; varying float vZ;
float H(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float N(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(H(i), H(i + vec2(1., 0.)), f.x), mix(H(i + vec2(0., 1.)), H(i + vec2(1., 1.)), f.x), f.y); }
void main() {
  float d = length(vec2(max(abs(vQ.x) - vLen, 0.), vQ.y)) / vR, a;
  if (d > 1.) discard;
  if (uShape < .5) a = smoothstep(1., .45, d);
  else if (uShape < 1.5) { float n = N(vQ / vR * 1.7 + vC.a * 40.) * .6 + N(vQ / vR * 3.9 + 7.) * .4; a = exp(-3.2 * d * d) * smoothstep(1., .75, d) * (.45 + 1.1 * n); }
  else { float rim = smoothstep(.62, .9, d) * smoothstep(1., .93, d); vec2 h = vQ / vR - vec2(-.34, .38); float spot = smoothstep(.26, .08, length(h)); a = mix(.1 + rim * .95 + spot * 1.1, smoothstep(1., .5, d) * .7, vBlur); }
  if (uSoft > 0.) { float n = texture2D(tDepth, gl_FragCoord.xy / uRes).r * 2. - 1., zs = 2. * uNearZ * uFarZ / (uFarZ + uNearZ - n * (uFarZ - uNearZ)); a *= clamp((zs - vZ) / uSoft, 0., 1.); }
  a *= vC.a; if (a < .0015) discard;
  gl_FragColor = vec4(vC.rgb * a, a * uOpaque);
}`;
const MODE = { box: 0, stream: 1, burst: 2 }, SHAPE = { soft: 0, puff: 1, bubble: 2 };

export function makeParticles(THREE, rig, places, { kCount = 1, depth, W, H, near = .1, far = 600 }) {
  const layers = []; let seed = 7;
  for (const [name, P] of Object.entries(places)) for (const L of P.particles || []) {
    const n = Math.max(1, Math.round((L.count ?? 100) * (L.minCount ? 1 : kCount))), R = (s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(seed += 101);
    const s1 = new Float32Array(n * 4), s2 = new Float32Array(n * 4); for (let i = 0; i < n * 4; i++) { s1[i] = R(); s2[i] = R(); }
    const plane = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry(); g.index = plane.index; g.setAttribute('position', plane.attributes.position); g.instanceCount = n;
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(s1, 4)); g.setAttribute('aSeed2', new THREE.InstancedBufferAttribute(s2, 4));
    const V3 = v => ({ value: new THREE.Vector3(...(v || [0, 0, 0])) }), F = v => ({ value: v });
    const U = { ...rig.uniforms(P.rig || name), tDepth: F(depth), uRes: F(new THREE.Vector2(W, H)), uNearZ: F(near), uFarZ: F(far), uT: F(0), uFocus: F(8), uAp: F(30), uPxK: F(4000), uMaxPx: F(26), uCenter: V3(),
      uMode: F(MODE[L.mode] ?? 0), uLife: F(L.life ?? 2), uT0: F(L.t0 ?? 0), uStagger: F(L.stagger ?? 0), uGravity: F(L.gravity ?? 0), uDrag: F(L.drag ?? 0), uSpeedVar: F(L.speedVar ?? 0), uShutter: F(L.shutter ?? 0), uSize: F(L.size ?? .02), uSizeVar: F(L.sizeVar ?? 0), uGrow: F(L.grow ?? 0), uMinPx: F((L.minPx ?? 1) * H / 1920),
      uSway: F(L.sway ?? 0), uSwaySpeed: F(L.swaySpeed ?? 1), uTwinkle: F(L.twinkle ?? 0), uAlpha: F(L.alpha ?? 1), uLit: F(L.lit ?? 1), uAmbient: F(L.ambient ?? 0), uNear0: F(L.nearFade?.[0] ?? .4), uNear1: F(L.nearFade?.[1] ?? 1.6), uFarFade: F(L.farFade ?? 0), uEdge: F(L.edge ?? 1.5), uCocK: F(L.cocK ?? 1),
      uBox: V3(L.box || [20, 10, 20]), uAt: V3(L.at), uSpread: V3(L.spread), uVel: V3(L.vel), uVelVar: V3(L.velVar), uColor: V3(L.color || [1, 1, 1]), uWindow: F(new THREE.Vector2(...(L.window || [0, 0]))), uShape: F(SHAPE[L.shape] ?? 0), uOpaque: F(L.opaque ?? 0), uSoft: F(L.soft ?? 0) };
    const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; const scene = new THREE.Scene(); scene.add(mesh);
    layers.push({ place: name, L, U, scene, a: L.alpha ?? 1, box: L.box || [20, 10, 20] });
  }
  const fwd = new THREE.Vector3();
  return { layers, render(renderer, camera, t, weights, focus, aperturePx, maxPx) {
    camera.getWorldDirection(fwd); const pxK = H / (2 * Math.tan(camera.fov * Math.PI / 360));
    for (const l of layers) { const w = weights[l.place] || 0; if (w <= .001) continue;
      if (l.L.mode === 'burst' && (t < (l.L.t0 ?? 0) || t > (l.L.t0 ?? 0) + (l.L.stagger ?? 0) + (l.L.life ?? 2))) continue;
      if (l.L.window && (t < l.L.window[0] || t > l.L.window[1])) continue;
      const U = l.U; U.uT.value = t; U.uFocus.value = focus; U.uAp.value = aperturePx; U.uMaxPx.value = maxPx; U.uPxK.value = pxK; U.uAlpha.value = l.a * w;
      U.uCenter.value.copy(camera.position).addScaledVector(fwd, l.box[2] * .36);
      renderer.render(l.scene, camera); }
  } };
}
