// world/look/charshade.js: a shading pass on characters and props, only for a film that asks (world.setOpts.look.shade; world/backrooms2.js loads this file only then). 2026-11-04.
// The characters are 2.5D: their depth and normals are drawing tricks, so no normal comes from their geometry. The form comes from the drawing's own rule instead: every material of a
// character gets one small function at the end of its fragment shader that works in SCREEN space, from that character's head disc and body axis (known each frame):
//   head: a sphere over the head disc, lit by the panels: top lit, lower face in a soft shadow, a catch of light on the edge toward the light.
//   body: a cylinder over the body axis, darker toward the feet, and the big head's cast shadow on the chest.
// It only multiplies what the character already drew (plus a thin rim on what isn't ink), so every line, colour and expression is still theirs and the ink stays ink.
// The light is the set's: per frame each character sums the panels near it (same grid and flicker as the surfaces) into a direction in view space and a level, so walking under a panel, the
// flicker and the camera's side all change the shading. Pure in t: pose, camera and flicker only. `moods`: [{ t0, t1, ease, key, shadow, rim, low, tintL, tintS }] for the flashback, the freeze, the end.
import { panelList } from './light.glsl.js';

const HEAD = /* glsl */`
uniform vec4 czHead, czAxis, czKey, czPar; uniform vec3 czTintL, czTintS; uniform vec2 czFeet;
vec3 czShade(vec3 c) {
  vec2 px = gl_FragCoord.xy; float r = max(czHead.z, 1.);
  vec2 p = (px - czHead.xy) / r; float d = length(p);
  // key: the head as a sphere
  float z = sqrt(max(1. - min(d * d, 1.), 0.));
  float ndl = dot(vec3(p, z), czKey.xyz);
  float headL = mix(smoothstep(-.62, .34, ndl), smoothstep(-.3, -.14, ndl), .55);   // half soft form, half a clean drawn shadow shape
  // the eye line stays open: the face keeps a floor so expressions read
  float top = smoothstep(-.1, .75, p.y);
  float headS = mix(czPar.x, 1., headL) * (1. + .06 * top);
  // body: a cylinder round the axis hem -> head, lit from the same key
  vec2 A = czAxis.xy, B = czHead.xy, ab = B - A; float len = max(length(ab), 1.); vec2 ax = ab / len, nx = vec2(ax.y, -ax.x);
  float q = clamp(dot(px - A, nx) / (r * 1.28), -1., 1.), bz = sqrt(1. - q * q * .92);
  float bodyL = smoothstep(-.42, .62, dot(vec3(nx * q, bz * .75), czKey.xyz) + .28 * czKey.y);
  float hT = clamp((px.y - czFeet.x) / max(czFeet.y - czFeet.x, 1.), 0., 1.);      // 0 feet .. 1 head centre
  float low = mix(czPar.z, 1., smoothstep(.06, .56, hT));
  // the head's shadow on the chest: the disc moved away from the light
  vec2 sc = p + czKey.xy * 1.0 + vec2(0., .28); float csh = smoothstep(1.24, .92, length(sc * vec2(.92, 1.)));
  float bodyS = mix(czPar.x * .94, 1., bodyL) * low * (1. - .36 * csh);
  float inHead = smoothstep(1.06, .98, d);
  float s = mix(bodyS, headS, inHead) * mix(1., czKey.w, .85);
  vec3 m = mix(czTintS, czTintL, smoothstep(.45, 1., s)) * s;
  float lum = dot(c, vec3(.3, .5, .2));
  // a thin catch of light on the head's edge, on the side toward the light, never on ink
  float edge = smoothstep(.885, .94, d) * smoothstep(.985, .955, d);
  float rimD = dot(d > .001 ? p / d : vec2(0., 1.), normalize(czKey.xy + vec2(0., .001)));
  float rim = edge * smoothstep(.45, .92, rimD) * czPar.y * smoothstep(.07, .22, lum);
  vec3 o = c * m + vec3(1., .95, .68) * rim * mix(.3, .7, lum);
  return o;
}`;
// a loose prop in the world pass (linear target): a level from the panels, a gradient to the floor, and a rim from its own normals. The thing stays black with the light on its edge.
const PROPF = /* glsl */`
uniform vec4 czP; uniform vec3 czRimC; uniform vec2 czPy; varying vec3 vCzN;
vec3 czShadeP(vec3 c) {
  vec3 n = normalize(vCzN); if (!gl_FrontFacing) n = -n;
  float h = clamp((gl_FragCoord.y - czPy.x) / max(czPy.y - czPy.x, 1.), 0., 1.);
  float top = max(n.y * .75 + .25, 0.), fres = pow(1. - abs(n.z), 5.);
  return c * czP.x * mix(czP.y, 1., smoothstep(0., .8, h)) + czRimC * fres * top * czP.z * (.35 + .65 * h);
}`;

const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

export function createCharShade(THREE, opts = {}) {
  const O = { key: .92, shadow: .74, rim: .6, low: .48, tintL: [1, .99, .92], tintS: [.97, .95, .64], moods: [], ...opts };
  const panels = panelList(), L = new THREE.Vector3(), _v = new THREE.Vector3(), _a = new THREE.Vector3(), _sum = new THREE.Vector3(), _b = new THREE.Vector3(), actors = new Map(), propsU = new Map();
  let shared = 0, logged = false;
  const px = (W, H, cam, p) => { _v.copy(p).project(cam); return [(_v.x + 1) / 2 * W, (_v.y + 1) / 2 * H]; };
  // the panels' light at a point: direction (world, in _sum) and level. The flickering panel counts as steady here: a dropout must never swing the direction, or the drawn shadow on every face near it
  // strobes (that was the flicker gruss saw, with the hard switch below); the flicker reaches the level only, softened by flickSoft. Regions blend over a few D and far panels fade out, so walking
  // through the mouth of the hallway never switches the set of panels in one frame. Returns the level; lastF = the part of it from the flickering panel.
  let lastF = 0;
  function lightAt(p, flickUnused) {
    _sum.set(0, 0, 0); let lev = 0; lastF = 0;
    const ax = Math.abs(p.x), room = smooth(-5.6, -2.4, p.z), hall = (1 - room) * smooth(2.7, 1.3, ax), side = (1 - room) * (1 - smooth(2.7, 1.3, ax));
    for (const q of panels) { const dz = Math.abs(q.z - p.z); if (dz > 20) continue; const lr = q.z > -4 ? room : q.x === 0 ? hall : (q.x * p.x < 0 ? 0 : side); if (lr <= 0) continue;
      _a.set(q.x - p.x, 4.97 - p.y, q.z - p.z); const r2 = _a.lengthSq(), w = lr * (1 - smooth(11, 20, dz)) / (1 + r2 * .1); _a.normalize().multiplyScalar(w); _sum.add(_a); lev += w; if (q.z === 1 && q.x === 3.6) lastF = w; }
    return lev;
  }
  const moodAt = t => { const P = { key: O.key, shadow: O.shadow, rim: O.rim, low: O.low, tintL: O.tintL, tintS: O.tintS };
    for (const M of O.moods) { const e = M.ease ?? .15, k = smooth(M.t0 - e, M.t0 + e, t) * (1 - smooth(M.t1 - e, M.t1 + e, t)); if (k <= 0) continue;
      for (const f of ['key', 'shadow', 'rim', 'low']) if (M[f] != null) P[f] = P[f] + (M[f] - P[f]) * k;
      for (const f of ['tintL', 'tintS']) if (M[f]) P[f] = P[f].map((v, i) => v + (M[f][i] - v) * k); }
    return P; };
  function patchChar(m, U) {
    if (!m || m.userData.czU === U) return;
    if (m.userData.czU) { shared++; return; }           // reported; two characters never share one in this cast (checked at run time)
    m.userData.czU = U;
    const inject = src => HEAD + src.replace(/\}\s*$/, '  gl_FragColor.rgb = czShade(gl_FragColor.rgb);\n}');
    if (m.isShaderMaterial || m.isRawShaderMaterial) { m.fragmentShader = inject(m.fragmentShader); Object.assign(m.uniforms, U); m.needsUpdate = true; return; }
    const prev = m.onBeforeCompile, key = prev.toString();
    m.onBeforeCompile = (s, r) => { prev.call(m, s, r); s.fragmentShader = inject(s.fragmentShader); Object.assign(s.uniforms, U); };
    m.customProgramCacheKey = () => key + '|cz'; m.needsUpdate = true;
  }
  function patchProp(m, U) {
    if (!m || m.userData.czU === U) return; if (m.userData.czU) { shared++; return; } m.userData.czU = U;
    const f = src => PROPF + src.replace(/\}\s*$/, '  gl_FragColor.rgb = czShadeP(gl_FragColor.rgb);\n}'), v = src => 'varying vec3 vCzN;\n' + src.replace(/\}\s*$/, '  vCzN = normalize(normalMatrix * normal);\n}');
    if (m.isShaderMaterial) { m.fragmentShader = f(m.fragmentShader); m.vertexShader = v(m.vertexShader); Object.assign(m.uniforms, U); m.needsUpdate = true; return; }
    const prev = m.onBeforeCompile, key = prev.toString();
    m.onBeforeCompile = (s, r) => { prev.call(m, s, r); s.fragmentShader = f(s.fragmentShader); s.vertexShader = v(s.vertexShader); Object.assign(s.uniforms, U); };
    m.customProgramCacheKey = () => key + '|czp'; m.needsUpdate = true;
  }
  const newU = () => ({ czHead: { value: new THREE.Vector4() }, czAxis: { value: new THREE.Vector4() }, czKey: { value: new THREE.Vector4(0, 1, 0, 1) }, czPar: { value: new THREE.Vector4() }, czTintL: { value: new THREE.Vector3(1, 1, 1) }, czTintS: { value: new THREE.Vector3(1, 1, 1) }, czFeet: { value: new THREE.Vector2() } });
  const newP = () => ({ czP: { value: new THREE.Vector4(1, 1, 0, 0) }, czRimC: { value: new THREE.Vector3(1, .92, .5) }, czPy: { value: new THREE.Vector2() } });

  const WIN = [[-.24, 1], [-.12, 2], [0, 3], [.12, 2], [.24, 1]], _h = new THREE.Vector3(), roots = new Map();
  const rootAt = (ctx, def, tt) => { const key = def.name + '|' + Math.round(tt * 240); let r = roots.get(key); if (!r) { r = ctx.rootOf(def.name, tt); roots.set(key, r); } return r; };
  function update(ctx, camera, t, flick, flickAt) {
    const { chars, props, W, H } = ctx, P = moodAt(t);
    camera.updateMatrixWorld(); const viewR = new THREE.Matrix3().setFromMatrix4(camera.matrixWorldInverse);
    // the flicker as the characters feel it: a soft average of the panel over .2 s (the panel itself still snaps), and only half of it
    let fSoft = 0; if (flickAt) { for (let i = -3; i <= 3; i++) fSoft += flickAt(t + i * .033); fSoft = 1 - (1 - fSoft / 7) * (O.flickShare ?? .5); } else fSoft = 1;
    for (const { ch, def } of chars) {
      let U = actors.get(ch); if (!U) { U = newU(); actors.set(ch, U); }
      ch.root.traverse(o => { if (!o.isMesh) return; if (Array.isArray(o.material)) o.material.forEach(m => patchChar(m, U)); else patchChar(o.material, U); });
      if (!ch.root.visible) continue;   // SPEED: culled by the stage this frame (not updated, not drawn): patched as before, nothing to shade
      const w = ch.where(), rNow = rootAt(ctx, def, t), [hx, hy] = px(W, H, camera, w.head), [ax, ay] = px(W, H, camera, w.hem);
      const fy = Math.min(...w.feet.map(f => px(W, H, camera, _a.set(f.x, Math.min(f.y, w.root.y + .05), f.z))[1]));
      // the light is read over a window round t along the character's own path (pure in t: the timeline at t +- .24 s, never the frame before), so running under a panel turns the shadow, it doesn't snap
      let lev = 0, levF = 0, wsum = 0; L.set(0, 0, 0);
      for (const [dt, wt] of WIN) { const r0 = rootAt(ctx, def, t + dt), r = Math.hypot(r0[0] - rNow[0], r0[2] - rNow[2]) > 4 ? rNow : r0; _h.set(r[0] + w.head.x - rNow[0], w.head.y + r[1] - rNow[1], r[2] + w.head.z - rNow[2]); const l = lightAt(_h); L.addScaledVector(_sum, wt); lev += l * wt; levF += lastF * wt; wsum += wt; }
      lev /= wsum; levF /= wsum; if (L.lengthSq() < 1e-6) L.set(0, 1, 0); L.normalize().applyMatrix3(viewR).normalize();
      const k = Math.min(1.04, .64 + (lev - levF * (1 - fSoft)) * .36) * P.key;         // level: a character in a dark stretch is darker, never black
      U.czHead.value.set(hx, hy, Math.max(ch.V.d / 2, 1), 1); U.czAxis.value.set(ax, ay, 0, 0); U.czKey.value.set(L.x, L.y, Math.max(L.z, -.5), k);
      U.czPar.value.set(P.shadow, P.rim, P.low, 0); U.czTintL.value.set(...P.tintL); U.czTintS.value.set(...P.tintS); U.czFeet.value.set(fy, hy);
    }
    for (const p of props) {
      let U = propsU.get(p); if (!U) { U = newP(); propsU.set(p, U); }
      if (p.o.userData.holder) continue;                       // none in this film; a held prop is left as drawn
      p.o.traverse(o => { if (!o.isMesh) return; if (Array.isArray(o.material)) o.material.forEach(m => patchProp(m, U)); else patchProp(o.material, U); });
      const lev0 = lightAt(_b.copy(p.o.position).setY(1.2)), lev = lev0 - lastF * (1 - fSoft), fig = p.def.kind === 'figure', h = fig ? 4.1 : (p.o.userData.sockets?.top?.[1] ?? .8);
      const [, y0] = px(W, H, camera, _a.copy(p.o.position)), [, y1] = px(W, H, camera, _a.copy(p.o.position).setY(p.o.position.y + h));
      // loose props are in the linear world pass: levels here are linear
      U.czP.value.set(fig ? 1 : Math.min(1.1, .22 + lev * .9), fig ? 1 : .35, fig ? (O.thingRim ?? 2.2) * Math.min(1, .3 + lev) : .25 * Math.min(1, lev), 0); U.czPy.value.set(y0, y1);
    }
    if (!logged) { logged = true; console.log(`charshade: ${actors.size} characters, ${propsU.size} props, ${shared} materials shared between characters`); }
    return shared;
  }
  // for the numeric check (tools: shade_jumps): each character's shading inputs for the frame just drawn
  const dump = () => [...actors].map(([ch, U]) => ({ id: ch.id, head: U.czHead.value.toArray(), axis: U.czAxis.value.toArray(), key: U.czKey.value.toArray(), par: U.czPar.value.toArray(), feet: U.czFeet.value.toArray() }));
  return { update, dump, shared: () => shared };
}
