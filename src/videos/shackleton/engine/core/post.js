// Post chain. Without lens blur: world-ink -> bloom -> tone map -> grade.
// With lens blur: lens blur (patched CoC with a sharp zone) -> world-ink after the blur (full strength in
// the sharp zone, faint outside it)
// -> bloom (HDR only) -> neutral tone map -> colour grade with vignette. MSAA 4.
// Pixel sizes are written for a 1920-high frame and multiplied by S = height / 1920.
import * as THREE from "three";
import {
  EffectComposer, RenderPass, EffectPass, Effect, EffectAttribute,
  DepthOfFieldEffect, BloomEffect, ToneMappingEffect, ToneMappingMode,
} from "postprocessing";

export const LAYER_NOINK = 1; // character cards and fx sprites live here: world ink never outlines them

// ---------- ink pre-pass: world-only normals + linear depth ----------
// rgb = view-space normal, a = linear depth (negative on surfaces that must not get creases, like the ground).
const inkVert = `
  varying vec3 vN; varying float vZ;
  void main() {
    vec3 n = normal; vec4 p = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
    #endif
    vec4 mv = modelViewMatrix * p;
    vN = normalize(normalMatrix * n); vZ = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const inkFrag = `
  uniform float sgn; varying vec3 vN; varying float vZ;
  void main() { gl_FragColor = vec4(normalize(vN) * 0.5 + 0.5, sgn * vZ); }`;
const makePrepassMat = (sgn, side) => new THREE.ShaderMaterial({
  vertexShader: inkVert, fragmentShader: inkFrag, side,
  uniforms: { sgn: { value: sgn } },
});

// character cards write rgb = 0 (no valid normal) + their depth, with the card's alpha cut-out
export function cardPrepassMaterial(map) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide, uniforms: { map: { value: map } },
    vertexShader: `varying vec2 vUv; varying float vZ; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vZ = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vZ; void main(){ if (texture2D(map, vUv).a < 0.5) discard; gl_FragColor = vec4(0.0, 0.0, 0.0, vZ); }`,
  });
}

export class InkPrepass {
  constructor(renderer, scene, camera, w, h) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true });
    this.rt.texture.minFilter = this.rt.texture.magFilter = THREE.NearestFilter;
    this.mats = {
      full: makePrepassMat(1, THREE.FrontSide), fullDouble: makePrepassMat(1, THREE.DoubleSide),
      ground: makePrepassMat(-1, THREE.FrontSide), groundDouble: makePrepassMat(-1, THREE.DoubleSide),
    };
  }
  render() {
    const { renderer, scene, camera } = this;
    const swapped = [];
    scene.traverse((o) => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      const ink = o.userData.ink || "full"; // "full" | "ground" | "card" | "none"
      swapped.push([o, o.material, o.visible]);
      if (ink === "none") { o.visible = false; return; }
      if (ink === "card") { o.material = o.userData.prepassMat; return; } // cards: masked out of world ink, still occlude
      const dbl = o.material && o.material.side === THREE.DoubleSide;
      o.material = this.mats[ink === "ground" ? (dbl ? "groundDouble" : "ground") : (dbl ? "fullDouble" : "full")];
    });
    const fog = scene.fog, bg = scene.background;
    scene.fog = null; scene.background = null;
    const mask = camera.layers.mask;
    camera.layers.enable(0); camera.layers.enable(LAYER_NOINK);
    renderer.setRenderTarget(this.rt);
    const prevColor = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor(new THREE.Color(0.5, 0.5, 1.0), 0); // alpha 0 marks "nothing here" (sky)
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.setClearColor(prevColor, prevAlpha);
    camera.layers.mask = mask;
    scene.fog = fog; scene.background = bg;
    swapped.forEach(([o, m, v]) => { o.material = m; o.visible = v; });
  }
}

// ---------- ink effect ----------
// mode 0: every world edge (runs before the blur, so far edges blur with the scene)
// mode 1: only edges whose near side is inside the sharp zone (runs after the blur, keeps in-focus lines crisp)
const inkShader = `
  uniform sampler2D tInk;
  uniform float radius;
  uniform vec3 inkColor;
  uniform float mode;
  uniform float focusDist;
  uniform float sharpZone;
  uniform float fogFar;
  uniform float camFar; // the sky writes no depth, so empty main depth reads as camera.far
  vec4 I(const in vec2 p) { return texture2D(tInk, p); }
  // one axis: returns edge strength, writes the nearer depth of the pair
  bool isCard(const in vec4 v) { return abs(v.a) > 0.01 && dot(v.rgb, vec3(1.0)) < 0.01; }
  float pairEdge(const in vec4 c, vec4 a, vec4 b, inout float nearZ) {
    // a card next to this world pixel is ignored (world ink never outlines a character)
    if (isCard(a)) a = c;
    if (isCard(b)) b = c;
    bool bgc = abs(c.a) < 0.01, bga = abs(a.a) < 0.01, bgb = abs(b.a) < 0.01;
    float zc = bgc ? 1e4 : abs(c.a), za = bga ? 1e4 : abs(a.a), zb = bgb ? 1e4 : abs(b.a);
    bool gnd = c.a < 0.0 || a.a < 0.0 || b.a < 0.0;
    if (bgc && bga && bgb) return 0.0;
    float e = 0.0;
    if (gnd) {
      // the ground never draws creases and never draws the horizon; only real occlusion edges
      if (!(bgc || bga || bgb)) {
        float rel = max(abs(za - zc), abs(zb - zc)) / max(zc, 1e-3);
        float onlyFromGround = (c.a < 0.0 && a.a < 0.0 && b.a < 0.0) ? 0.0 : 1.0;
        e = onlyFromGround * smoothstep(0.10, 0.20, rel);
      }
    } else {
      float wc = bgc ? 0.0 : 1.0 / zc, wa = bga ? 0.0 : 1.0 / za, wb = bgb ? 0.0 : 1.0 / zb;
      float lap = abs(wa + wb - 2.0 * wc) * (bgc ? min(za, zb) : zc);
      float de = smoothstep(0.03, 0.08, lap);
      vec3 nc = c.xyz * 2.0 - 1.0, na = a.xyz * 2.0 - 1.0, nb = b.xyz * 2.0 - 1.0;
      float nd = (bga || bgb || bgc) ? 0.0 : max(1.0 - dot(nc, na), 1.0 - dot(nc, nb));
      float ne = smoothstep(0.18, 0.30, nd);
      e = max(de, ne);
    }
    if (e > 0.0) nearZ = min(nearZ, min(bgc ? 1e4 : zc, min(bga ? 1e4 : za, bgb ? 1e4 : zb)));
    return e;
  }
  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    vec4 c = I(uv);
    float zc = abs(c.a) < 0.01 ? 1e4 : abs(c.a);
    // a character card covers this pixel: no world ink here
    if (isCard(c)) { outputColor = inputColor; return; }
    float edge = 0.0, nearZ = 1e4;
    for (int k = 0; k < 2; k++) {
      vec2 o = texelSize * radius * (k == 0 ? 1.0 : 0.5);
      edge = max(edge, pairEdge(c, I(uv - vec2(o.x, 0.0)), I(uv + vec2(o.x, 0.0)), nearZ));
      edge = max(edge, pairEdge(c, I(uv - vec2(0.0, o.y)), I(uv + vec2(0.0, o.y)), nearZ));
      edge = max(edge, pairEdge(c, I(uv - o * 0.7071), I(uv + o * 0.7071), nearZ));
      edge = max(edge, pairEdge(c, I(uv - vec2(o.x, -o.y) * 0.7071), I(uv + vec2(o.x, -o.y) * 0.7071), nearZ));
    }
    float fade = 1.0 - smoothstep(fogFar * 0.55, fogFar * 0.95, nearZ);
    if (mode > 0.5) {
      // sharp-zone mask: same rule as the patched CoC (distance from focus minus the sharp zone)
      float off = abs(nearZ - focusDist) - sharpZone;
      // in focus: full line; out of focus: a faint line (the library's sparse bokeh kernel turns
      // pre-blurred thin lines into dotted copies, so blurred areas get a soft line drawn after the blur)
      fade *= mix(0.3, 1.0, 1.0 - smoothstep(0.0, 0.8, off));
    }
    outputColor = vec4(mix(inputColor.rgb, inkColor, clamp(edge * fade, 0.0, 1.0)), inputColor.a);
  }`;

export class InkEffect extends Effect {
  constructor(inkTexture, { radius, mode, color }) {
    super(mode ? "InkSharp" : "Ink", inkShader, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map([
        ["tInk", new THREE.Uniform(inkTexture)],
        ["radius", new THREE.Uniform(radius)],
        ["inkColor", new THREE.Uniform(new THREE.Color(color))],
        ["mode", new THREE.Uniform(mode)],
        ["focusDist", new THREE.Uniform(10)],
        ["sharpZone", new THREE.Uniform(2)],
        ["fogFar", new THREE.Uniform(300)],
        ["camFar", new THREE.Uniform(1000)],
      ]),
    });
  }
}

// ---------- directional smear (whip transitions) ----------
const smearShader = `
  uniform vec2 dir;   // smear vector in uv units (full length)
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec4 acc = vec4(0.0);
    for (int i = 0; i < 16; i++) { float k = float(i) / 15.0 - 0.5; acc += texture2D(inputBuffer, uv + dir * k); }
    outputColor = acc / 16.0;
  }`;
export class SmearEffect extends Effect {
  constructor() { super("Smear", smearShader, { attributes: EffectAttribute.CONVOLUTION, uniforms: new Map([["dir", new THREE.Uniform(new THREE.Vector2())]]) }); }
}

// ---------- colour grade + vignette ----------
const gradeShader = `
  uniform vec3 lift;       // warm lifted blacks (no pure black)
  uniform vec3 shadowTint; // cool shadows
  uniform vec3 highTint;   // warm highlights
  uniform float sat;
  uniform float contrast;
  uniform float vignette;  // 0..1 darkening at the corners
  uniform float aspect;
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, sat);
    c = (c - 0.5) * contrast + 0.5;
    float sh = 1.0 - smoothstep(0.0, 0.55, l), hi = smoothstep(0.45, 1.0, l);
    c *= mix(vec3(1.0), shadowTint, sh) * mix(vec3(1.0), highTint, hi);
    vec2 d = (uv - 0.5) * 2.0;                        // -1..1 across the frame
    float v = 1.0 - vignette * smoothstep(0.35, 2.0, dot(d, d)); // corners (dot = 2) darkest
    c *= v;
    c = lift + c * (1.0 - lift);
    outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
  }`;
export class GradeEffect extends Effect {
  constructor(aspect) {
    super("Grade", gradeShader, {
      uniforms: new Map([
        ["lift", new THREE.Uniform(new THREE.Vector3(0.032, 0.028, 0.038))],
        ["shadowTint", new THREE.Uniform(new THREE.Vector3(0.93, 0.97, 1.08))],
        ["highTint", new THREE.Uniform(new THREE.Vector3(1.05, 1.01, 0.95))],
        ["sat", new THREE.Uniform(1.12)],
        ["contrast", new THREE.Uniform(1.04)],
        ["vignette", new THREE.Uniform(0.45)],
        ["aspect", new THREE.Uniform(aspect)],
      ]),
    });
  }
  set(g) {
    const u = this.uniforms;
    if (g.lift) u.get("lift").value.fromArray(g.lift);
    if (g.shadowTint) u.get("shadowTint").value.fromArray(g.shadowTint);
    if (g.highTint) u.get("highTint").value.fromArray(g.highTint);
    if (g.sat != null) u.get("sat").value = g.sat;
    if (g.contrast != null) u.get("contrast").value = g.contrast;
    if (g.vignette != null) u.get("vignette").value = g.vignette;
  }
}

// ---------- lens blur with a sharp zone ----------
// The library's CoC ramps up right from the focus point, so the whole subject gets a little soft.
// The patch adds a sharp zone (in world units) around the focus distance. It depends on the
// exact shader text of postprocessing 6.39.5/6.39.6, so it refuses to run when the text changes.
const COC_NEEDLE = "smoothstep(0.0,focusRange,abs(signedDistance))";
export function makeLens(camera, S) {
  const dof = new DepthOfFieldEffect(camera, { focusDistance: 8, focusRange: 6, bokehScale: 0, resolutionScale: 1.0 });
  const m = dof.cocMaterial;
  if (!m.fragmentShader.includes(COC_NEEDLE)) {
    throw new Error("[rc] postprocessing CoC shader text changed; the sharp-zone patch cannot be applied. Use the postprocessing version pinned by the setup.");
  }
  m.fragmentShader = "uniform float sharpZone;\n" + m.fragmentShader.replace(COC_NEEDLE, "smoothstep(sharpZone,sharpZone+focusRange,abs(signedDistance))");
  m.uniforms.sharpZone = new THREE.Uniform(2.0);
  m.needsUpdate = true;
  dof.target = new THREE.Vector3();
  return dof;
}

// ---------- composer ----------
// inkPx = world outline width in pixels at 1080x1920 (settings.ink_px). Measured on this shader: a sampling
// radius r draws a line of about 2.3 * r pixels (r 1.3 -> ~3 px, r 2.6 -> ~6 px).
export function inkRadius(inkPx, S) { return Math.max(0.6, inkPx / 2.3) * S; }
export function buildPost({ renderer, scene, camera, W, H, inkPx = 8 }) {
  const S = H / 1920;
  const prepass = new InkPrepass(renderer, scene, camera, W, H);
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
  composer.addPass(new RenderPass(scene, camera));
  const inkA = new InkEffect(prepass.rt.texture, { radius: inkRadius(inkPx, S), mode: 0, color: 0x0b0a0d });
  const inkPassA = new EffectPass(camera, inkA);
  composer.addPass(inkPassA);
  const lens = makeLens(camera, S);
  const lensPass = new EffectPass(camera, lens);
  composer.addPass(lensPass);
  const inkB = new InkEffect(prepass.rt.texture, { radius: inkRadius(inkPx, S), mode: 1, color: 0x0b0a0d });
  const inkPassB = new EffectPass(camera, inkB);
  composer.addPass(inkPassB);
  const smear = new SmearEffect();
  const smearPass = new EffectPass(camera, smear);
  smearPass.enabled = false;
  composer.addPass(smearPass);
  const bloom = new BloomEffect({ luminanceThreshold: 1.0, luminanceSmoothing: 0.12, intensity: 0.7, mipmapBlur: true, radius: 0.6, levels: 6 });
  const grade = new GradeEffect(W / H);
  composer.addPass(new EffectPass(camera, bloom, new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }), grade));
  composer.setSize(W, H, false);

  // per-frame state: lens { focus: Vector3 | null, px: blur size in px at 1920 high }
  function setLens(focusPoint, px, fogFar) {
    const on = !!focusPoint && px > 0.01;
    lensPass.enabled = on; inkPassB.enabled = on; inkPassA.enabled = !on;
    [inkA, inkB].forEach((e) => { e.uniforms.get("fogFar").value = fogFar; e.uniforms.get("camFar").value = camera.far; });
    if (!on) return;
    lens.target.copy(focusPoint);
    const d = camera.position.distanceTo(focusPoint);
    const sharp = Math.min(5.5, Math.max(0.5, d * 0.3));
    lens.cocMaterial.uniforms.sharpZone.value = sharp;
    lens.cocMaterial.uniforms.focusRange.value = Math.max(2.0, d * 0.9);
    lens.bokehScale = px * S * 0.5;
    inkB.uniforms.get("focusDist").value = d;
    inkB.uniforms.get("sharpZone").value = sharp;
  }
  // whip smear: length in pixels at 1920 high, horizontal
  function setSmear(px) {
    smearPass.enabled = px > 1.5;
    smear.uniforms.get("dir").value.set((px * S) / W, 0);
  }
  function render() {
    prepass.render();
    composer.render(1 / 30); // fixed delta; no clock is read
  }
  return { composer, prepass, lens, bloom, grade, setLens, setSmear, render, S };
}
