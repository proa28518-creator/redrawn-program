// hair.js: a character's hair from a few words of spec, no video.
//   buildHair({ style, colour, seed, ...hairline opts, extras: true }) -> { headParams, extras, line, colours }
//     headParams  merge into head.js build params: { track (inline hairline: hair hi axis e1 e2 + the light keys head.update reads),
//                 hairDark hairLit hairHi hairRim, hairlineInk (0 when bald), lookFrame 100 (the painted ramp + highlight on) }
//     extras      THREE.Group in HEAD space (origin = head centre, D = 1), rigid with the head: add it as a child of the head object.
//                 Volumes the shell can't carry: bun, ponytail, long (slab behind the neck), bob (short slab), pigtails, curly (bumps).
//                 Flat 2-tone painted like the hair ramp (lit toward head.js litDir, the viewer's left), ink by shade.outline.
//     colours     { dark, lit, hi, rim } as hex numbers, from ONE base colour (the colour you'd sample: his #563727 brown).
// Colour rules (STYLE_BIBLE 4 + head.js): base = the dark/main fill; lit = same hue, L + 21 % of the way to white; highlight L + 60 %;
// rim L + 32 %. White hair (L > .85) stays close to skin: the thin line does the work. Buzz: mixed 25 % toward the skin.
import * as THREE from './three.js';
import { outline } from './shade.js';
import { hairline } from './hairline.js';
import { RULES } from './rules.js';

const LIT_DIR = new THREE.Vector3(-.33, .35, .88).normalize(); // head.js DEF.litDir
const HAIR_AB = [-.2, .42];                                    // head.js uHairAB at lookFrame >= 96
const INK = 0x3a2a33;
export const COLOURS = { brown: 0x563727, dark: 0x2e2429, black: 0x262027, grey: 0x807872, silver: 0xa79a9c, white: 0xf2ece5,
  blond: 0xd5b979, red: 0x7c4628, ginger: 0xb0582c, auburn: 0x6e3226, boss: 0x493c44 };

export function hairColours(base, { buzz = false, skin = 0xfcf7f4 } = {}) {
  const c = new THREE.Color(typeof base === 'string' && COLOURS[base] !== undefined ? COLOURS[base] : base), hsl = {};
  if (buzz) c.lerp(new THREE.Color(skin), .25);
  c.getHSL(hsl, THREE.SRGBColorSpace);
  const at = k => new THREE.Color().setHSL(hsl.h, hsl.s * (1 - .15 * k), hsl.l + (1 - hsl.l) * k, THREE.SRGBColorSpace).getHex();
  // W3: white / near-skin hair is ONE flat white fill (the ramp made it a pale grey patch next to the skin); the thin line does the work
  // FC: white hair = a pale silver mass (dark L .80, lit L .88) + the normal hairline ink: flat-white-on-skin read as a blank head from behind
  // PR2 (FABLE_REVIEW3 item 10): the pale ramp + the .94 highlight read as a smeared blotch / a shine across the head (Walter, f20-29).
  // White hair is now ONE solid cool-grey shape (dark L .72, lit L .78: a hard 2-tone like every other fill, no highlight, no rim)
  // that clearly differs from the skin (L ~.97), with a BOLD ink edge (buildHair hairlineInk, below).
  if (hsl.l > .82 && !buzz) { const t = (l, k) => new THREE.Color().setHSL(hsl.h, hsl.s * k, l, THREE.SRGBColorSpace).getHex(); const lit = t(.78, .22); return { dark: t(.72, .25), lit, hi: lit, rim: lit }; }
  return { dark: c.getHex(), lit: at(.21), hi: at(.6), rim: at(.32) };
}

// ---------- painted material: the hair ramp on a volume ----------
// byPosition: the colour from the direction of the point from the head centre (= what the shell paints there), so a bump on the
// head blends into the shell and only its silhouette shows. Otherwise from the surface normal (a bun, a ponytail).
function painted(col, { byPosition = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uDark: { value: new THREE.Color(col.dark) }, uLit: { value: new THREE.Color(col.lit) }, uLitDir: { value: LIT_DIR }, uAB: { value: new THREE.Vector2(...HAIR_AB) } },
    vertexShader: `varying vec3 vN; void main() { vN = ${byPosition ? 'position' : 'normal'}; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform vec3 uDark, uLit, uLitDir; uniform vec2 uAB; varying vec3 vN;
void main() { float t = dot(normalize(vN), uLitDir); gl_FragColor = vec4(mix(uDark, uLit, smoothstep(uAB.x, uAB.y, t)), 1.);
#include <colorspace_fragment>
}`,
  });
}
// a mesh in head space; byPosition meshes must stay children of the extras group with no offset of their own (positions = head space)
function part(geo, mat, name, ink = .035) {
  const m = new THREE.Mesh(geo, mat); m.name = name; m.frustumCulled = false;
  outline(m, { width: ink, color: INK }).frustumCulled = false;
  return m;
}
// a tapered tube along points (head space): radius r0 at the root to r1 at the tip, closed tip
function taperTube(points, r0, r1, { seg = 28, rad = 14, bulge = 0 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, seg, 1, rad, false), pos = geo.attributes.position, c = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg; curve.getPointAt(t, c);
    const r = Math.max(.0005, (r0 + (r1 - r0) * t) * (1 + bulge * Math.sin(Math.PI * Math.min(1, t * 1.6))) * (t > .9 ? Math.sqrt(Math.max(0, (1 - t) / .1)) * .9 + .1 : 1));
    for (let j = 0; j <= rad; j++) { const k = i * (rad + 1) + j; p.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c); pos.setXYZ(k, p.x, p.y, p.z); }
  }
  geo.computeVertexNormals();
  return geo;
}
// a slab of hair behind the neck: a squashed sphere bent around the back, scalloped at the bottom
function slab({ len = .62, width = .56, top = .12, scallops = 7, amp = .05, depth = .13 } = {}) {
  const geo = new THREE.SphereGeometry(1, 64, 40), pos = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const X = v.x * width, low = Math.max(0, -v.y);
    let Y = top - len / 2 + v.y * len / 2;
    Y -= amp * Math.pow(low, 3) * Math.abs(Math.sin((X / width) * Math.PI * scallops / 2 + .5)); // clumps along the bottom
    const Z = -.36 + .6 * X * X + v.z * depth - .06 * (1 - (v.y + 1) / 2);                       // wraps forward at the sides
    pos.setXYZ(i, X, Y, Z);
  }
  geo.computeVertexNormals();
  return geo;
}
const dirOf = (yaw, pitch, r = 1) => { const a = yaw * Math.PI / 180, b = pitch * Math.PI / 180; return [Math.sin(a) * Math.cos(b) * r, Math.sin(b) * r, Math.cos(a) * Math.cos(b) * r]; };

// ---------- FC (overnight 2, FABLE_REVIEW2 item 3): the back of the head is never a blank egg ----------
// A material that draws only where its surface faces the camera (dot(N, toCam) > uMin): from the front every fragment of a back-of-head
// patch is on the far side and is discarded, so front views stay pixel-identical (no leak into the ink ring), from behind it draws.
function facingMat({ dark, lit, flat = false, offset = -2, fade = null }) {
  return new THREE.ShaderMaterial({
    uniforms: { uDark: { value: new THREE.Color(dark) }, uLit: { value: new THREE.Color(lit ?? dark) }, uLitDir: { value: LIT_DIR }, uAB: { value: new THREE.Vector2(...HAIR_AB) }, uMin: { value: .03 }, uFade: { value: new THREE.Vector2(...(fade || [2, 3])) }, uSide: { value: 0 },
      uFaceDir: { value: new THREE.Vector3(0, 0, 1) }, uFaceCos: { value: 2 } },
    vertexShader: `attribute float aU; varying float vU; varying vec3 vP; varying vec3 vW; varying vec3 vNw;
void main() { vU = aU; vP = position; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vNw = mat3(modelMatrix) * position; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uDark, uLit, uLitDir, uFaceDir; uniform vec2 uAB, uFade; uniform float uMin, uSide, uFaceCos; varying float vU; varying vec3 vP; varying vec3 vW; varying vec3 vNw;
void main() { if (dot(normalize(vNw), normalize(cameraPosition - vW)) < uMin || dot(normalize(vP), uFaceDir) > uFaceCos) discard;
  float al = 1. - smoothstep(uFade.x, uFade.y, uSide == 0. ? abs(vU) : max(0., vU * uSide)); if (al < .004) discard;
  ${flat ? 'gl_FragColor = vec4(uDark, al);' : 'float t = dot(normalize(vP), uLitDir); gl_FragColor = vec4(mix(uDark, uLit, smoothstep(uAB.x, uAB.y, t)), al);'}
#include <colorspace_fragment>
}`,
    transparent: !!fade, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset,
  });
}
// W7 (DIR13): the drawn face is a decal that SLIDES toward the camera (rules.js faceRecord: yaw = .68-.83 x the camera az, centre at the
// camera's elevation), while hair geometry is rigid in head space. So with the head turned 60 deg (camera in front) the face sat on the
// side of the skull, where the back hair already was. faceDirOf = where the face decal's centre is on the head (head space, unit), null
// when no face is drawn (|az| > offAz: the back view). faceZone(mesh, deg) keeps a ShaderMaterial with uFaceDir/uFaceCos (facingMat) out
// of a cone of `deg` around it, per render (onBeforeRender: whatever camera renders it). The hair stays rigid; only the part under the
// drawn face is not drawn. Front view (az ~0): the cone sits on the front of the face where the back hair is never drawn = identical.
export function faceDirOf(az, el, R = RULES.face) {
  if (Math.abs(az) > R.offAz) return null;
  const D = Math.PI / 180, fy = Math.max(-R.clamp, Math.min(R.clamp, (az < 0 ? R.yawNeg : R.yawPos) * az)) * D, fe = -(R.pitchBase + R.pitch * el) * D;
  return [Math.sin(fy) * Math.cos(fe), Math.sin(fe), Math.cos(fy) * Math.cos(fe)];
}
export const FACE_ZONE = 58; // deg round the face decal's centre: eyes, brows, mouth + the hairline floor (hairline.js BROW_P 31, |yaw| 48)
const _fz = new THREE.Vector3();
export function faceZone(mesh, deg = FACE_ZONE) {
  const U = mesh.material.uniforms, c = Math.cos(deg * Math.PI / 180);
  mesh.onBeforeRender = (renderer, scene, camera) => {
    _fz.setFromMatrixPosition(camera.matrixWorld); mesh.worldToLocal(_fz);
    const l = _fz.length() || 1, az = Math.atan2(_fz.x, _fz.z) * 180 / Math.PI, el = Math.asin(Math.max(-1, Math.min(1, _fz.y / l))) * 180 / Math.PI;
    const d = faceDirOf(az, el);
    if (!d) { U.uFaceCos.value = 2; return; }
    U.uFaceDir.value.set(...d); U.uFaceCos.value = c;
  };
  return mesh;
}
// maskFittedHair(headRoot, deg): the same rule for a FITTED head's hair (head.js 'head.ball' + 'head.hair', the polygon from
// tracks/<id>/headTrack.json; the Boss's jagged brown/grey patch is THAT, not the back hair). The hair's signed distance s (head.js FRAG,
// unit-sphere chord, + = hair) becomes min(s, angle to the face centre - zone): inside the zone it is skin, and its edge gets head.js's
// own hairline ink + AA, so the hair recedes from the drawn face with a normal hairline instead of being cut. Patches the two materials'
// fragment source once (guarded: if head.js's `float s = sdHair(p);` line is gone it does nothing and returns 0). Wire (character.js,
// owner MO2/ENG): `maskFittedHair(parts.head)` right after Head.build, for fitted specs (no spec.hair). Off = zone angle -10 rad.
// The zone opens with the slide: 0 deg with the face at the front of the head (az 0: the hair was fitted round that face, temples and
// sideburns stay, every front view pixel-identical), the full `deg` once the face has slid FITTED_OPEN deg of yaw (smoothstep: no pop).
export const FITTED_ZONE = 50, FITTED_OPEN = 14;
export function maskFittedHair(root, deg = FITTED_ZONE, open = FITTED_OPEN) {
  const ms = []; root.traverse(o => { if ((o.name === 'head.ball' || o.name === 'head.hair') && o.material?.isShaderMaterial && !o.userData.faceZone) ms.push(o); });
  const KEY = 'float s = sdHair(p);';
  if (!ms.length || !ms.every(m => m.material.fragmentShader.includes(KEY))) return 0;
  const zone = { uFaceDir: { value: new THREE.Vector3(0, 0, 1) }, uFaceAng: { value: -10 } }, ang = deg * Math.PI / 180;
  for (const m of ms) {
    const M = m.material;
    Object.assign(M.uniforms, zone);
    // + 2 uLine: a zone of 0 deg stays >= 2 uLine away from any hair pixel's ink band / AA, so it changes nothing
    M.fragmentShader = 'uniform vec3 uFaceDir; uniform float uFaceAng;\n' + M.fragmentShader.replace(KEY, KEY +
      ' s = min(s, acos(clamp(dot(p0, uFaceDir), -1., 1.)) - uFaceAng + 2. * uLine);');
    M.needsUpdate = true; m.userData.faceZone = true;
    m.onBeforeRender = (renderer, scene, camera) => {
      _fz.setFromMatrixPosition(camera.matrixWorld); m.worldToLocal(_fz);
      const l = _fz.length() || 1, el = Math.asin(Math.max(-1, Math.min(1, _fz.y / l))) * 180 / Math.PI, d = faceDirOf(Math.atan2(_fz.x, _fz.z) * 180 / Math.PI, el);
      if (!d) { zone.uFaceAng.value = -10; return; }
      const k = Math.min(1, Math.abs(Math.atan2(d[0], d[2])) * 180 / Math.PI / open);
      zone.uFaceDir.value.set(...d); zone.uFaceAng.value = ang * k * k * (3 - 2 * k);
    };
  }
  return ms.length;
}
// a patch of the sphere radius r over the back: yaw 180 +- span (deg, 0 = the face), from the crown down to theta(u) deg from the top.
// theta(u) = back at the centre, rising to the crown at the sides (no straight meridian edge), plus soft waves (his wavy lower edge).
function backPatch(r, { span = 84, back = 96, waves = 5, amp = 4, grow = 0, seed = 3, top = 14 } = {}) {
  const NU = 72, NT = 24, pos = [], us = [], idx = [], R = Math.PI / 180, ph = (seed * 1.37) % 6.28;
  const edge = u => { const w = Math.max(0, 1 - Math.abs(u) ** 6); return (back * Math.sqrt(w) + amp * (.5 - .5 * Math.cos(waves * Math.PI * (u + 1) + ph)) * w) + grow; };
  for (let i = 0; i <= NU; i++) {
    const u = -1 + 2 * i / NU, yaw = (180 + u * (span + grow)) * R, th = edge(u);
    for (let j = 0; j <= NT; j++) {
      const t0 = Math.min(top + 44 * Math.abs(u) ** 4, th * .9), t = (t0 + (j / NT) * (th - t0)) * R; // polar angle from the top (from `top`: the crown faces a front camera)
      pos.push(Math.sin(t) * Math.sin(yaw) * r, Math.cos(t) * r, Math.sin(t) * Math.cos(yaw) * r); us.push(u);
    }
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NT; j++) { const a = i * (NT + 1) + j, b = a + NT + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aU', new THREE.Float32BufferAttribute(us, 1)); geo.setIndex(idx);
  return geo;
}
/** buildBackHair({ colour, span, back, waves, amp, ink, r }) -> Group in head space: hair over the upper back of the head with a soft wavy
 *  lower edge in one ink line (his "one mass on the upper back of the head"), drawn only from behind/3/4 back. For characters whose hair
 *  has no back coverage (the Boss's fitted patch, bald-ish styles under hats). r .49 sits over head.js's hair shell (.484), inside the
 *  hull (.5): it covers a fitted patch's jagged back edge so nothing is "cut into" the hat line from behind. */
// SP (overnight 2): a FITTED head (spec.head colours, no spec.hair) is painted by head.js at RULES.look.frame 80, where its lit side is
// head.js's fixed brown #745238 on the ramp (-.15, .3), whatever spec.head.hairLit says. The back hair used the lighter tint of its own
// colour there, so the Boss at az 120 showed a brown patch meeting grey hair with a seam. `shell: 'look80'` paints the back hair with the
// SAME dark/lit/ramp as the fitted patch and fades its side ends into it (below), so where they meet they are one colour. `lit` / `ab` /
// `fade` keys win; `shell: 'own'` (the default) = the old look (its own colour's lit tint, ramp HAIR_AB, hard ends): right for a head
// with NO fitted hair under the back hair (the Passenger: a fade there shows skin through). The dark is the given hex as is.
// FITTED_BACK: defaults per back-hair colour for specs written before these keys (boss.json's #5e565c = the Boss). Move into the spec.
const SHELL80 = { lit: 0x745238, ab: [-.15, .3] };
export const BACK_NAPE = 156;
const FITTED_BACK = { 0x5e565c: { shell: 'look80', litDir: [-0.2, 0.3, 0.93], fadeSide: -1 } }; // the Boss: brown only on his left (+X = u < 0)
const asHex = c => typeof c === 'string' && COLOURS[c] !== undefined ? COLOURS[c] : new THREE.Color(c).getHex();
export function buildBackHair(o = {}) {
  const pre = FITTED_BACK[asHex(o.color ?? o.colour ?? 'boss')] || {};
  const { colour = "boss", color, span = 84, back: back0 = 96, waves = 5, amp = 4, ink = .02, r = .49, seed = 3, top = 14, shell = 'own', lit, ab, litDir, fade, fadeSide = 0, faceDeg = FACE_ZONE, maskHead = true, nape = BACK_NAPE } = { ...pre, ...o }; // fadeSide -1: only the +X (his left) end fades, 1: only -X
  // fix1 2026-11-04: the back hair runs down to the NAPE (polar BACK_NAPE deg from the top = pitch -44, where the head meets the neck), not to
  // the equator: from behind the old patch stopped mid-head and left a blank white half-disc under it that read as a face with no features.
  // A spec's smaller `back` is raised to it; `nape: false` keeps the spec's own `back`.
  const back = nape === false ? back0 : Math.max(back0, nape);
  const base = color ?? colour, own = shell === 'own', col = own ? hairColours(base) : { dark: asHex(base), lit: SHELL80.lit };
  if (lit !== undefined) col.lit = asHex(lit);
  const g = new THREE.Group(); g.name = 'hair.back';
  const inkDeg = ink / r * 180 / Math.PI;
  // fitted heads: the back hair's two side ends fade into the fitted patch under it (|u| .62 -> .95; its ink line sooner), so where the
  // two meet there is no seam or second ink edge, whatever colour the patch has there (the Boss's brown side). `fade: false` = hard ends.
  const fd = fade === false || (fade === undefined && own) ? null : (fade || [.62, .95]);
  const lineM = new THREE.Mesh(backPatch(r - .002, { span, back, waves, amp, grow: inkDeg, seed, top }), facingMat({ dark: INK, flat: true, offset: -2, fade: fd && [fd[0] - .14, fd[1] - .14] }));
  const fillMat = facingMat({ dark: col.dark, lit: col.lit, offset: -3, fade: fd });
  fillMat.uniforms.uAB.value.set(...(ab || (own ? HAIR_AB : SHELL80.ab)));
  if (litDir) fillMat.uniforms.uLitDir.value = new THREE.Vector3(...litDir).normalize(); // = the spec's head.litDir, so the ramp meets the shell's
  const fillM = new THREE.Mesh(backPatch(r, { span, back, waves, amp, seed, top }), fillMat);
  for (const m of [lineM, fillM]) { m.frustumCulled = false; m.userData.noOutline = true; m.name = 'hair.back.' + (m === lineM ? 'ink' : 'fill'); g.add(m); }
  lineM.renderOrder = 1; fillM.renderOrder = 2;
  lineM.material.uniforms.uSide.value = fillMat.uniforms.uSide.value = fadeSide;
  // W7: never under the drawn face; the ink's cone is smaller by the ink width, so the cut edge gets the same ink line as the wavy edge
  faceZone(fillM, faceDeg); faceZone(lineM, faceDeg - inkDeg);
  // W7: the fitted cast's back hair also keeps its head's FITTED hair (head.js polygon) off the drawn face: patched the moment the group
  // is added to the head (character.js `parts.head.add(buildBackHair(...))`, before any render). `maskHead: false` = leave the head
  // alone (buildExtras: hair specs, whose hairline.js line already keeps off the face).
  if (maskHead) g.addEventListener('added', () => { if (g.parent) maskFittedHair(g.parent, maskHead === true ? FITTED_ZONE : maskHead); });
  return g;
}
/** buildNape({ ink, r }) -> Group: a bald head from behind = the two neck tendons, short bold ink strokes running down into the collar
 *  low on the back of the head (a horizontal crease read as a frowning mouth on a blank face, so never that). Drawn only from behind. */
export function buildNape({ ink = .03, r = .468, from = -24, to = -56, yaw0 = 18, yaw1 = 11 } = {}) {
  const g = new THREE.Group(); g.name = 'hair.napeG';
  const mat = facingMat({ dark: INK, flat: true, offset: -3 });
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(...dirOf(180 + s * (yaw0 + (yaw1 - yaw0) * t), from + (to - from) * t, r))); }
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, ink / 2, 8, false), mat);
    m.name = 'hair.nape'; m.frustumCulled = false; m.userData.noOutline = true; m.renderOrder = 2;
    g.add(m);
  }
  return g;
}

// ---------- W5 2026-11-04: messy / spiky tufts ----------
// Short tapered cones rooted inside the head (r .40) poking out through the hull, painted by position (same ramp as the shell under
// them, so only the silhouette + its bold ink edge read). Hashed from the seed. Never on the front of the face: top tufts sit at pitch
// >= 52 and lean up / back, side tufts sit over the ears (|yaw| 95-125) and point out. `tufts` = count on top (messy 6, spiky 10),
// `sideTufts` per side (messy 1-2, spiky 1), `tuftLen` scales the length (1).
function tuftRng(seed) { let s = ((seed + 101) * 2246822519) >>> 0 || 7; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function buildTufts(style, col, opts = {}) {
  const g = new THREE.Group(); g.name = 'hair.tufts';
  const R = tuftRng(opts.seed ?? 1), pm = painted(col, { byPosition: true }), spiky = style === 'spiky', L = opts.tuftLen ?? 1;
  const tuft = (yaw, pitch, out, lean, leanDir, r0) => {
    // root deep inside, base on the hull, tip out along the normal bent by `lean` (deg) toward leanDir (deg of yaw/pitch tangent)
    const n = new THREE.Vector3(...dirOf(yaw, pitch)), up = Math.abs(n.y) > .95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const tE = new THREE.Vector3().crossVectors(up, n).normalize(), tN = new THREE.Vector3().crossVectors(n, tE).normalize();
    const side = tE.multiplyScalar(Math.cos(leanDir * Math.PI / 180)).add(tN.multiplyScalar(Math.sin(leanDir * Math.PI / 180)));
    const dir = n.clone().multiplyScalar(Math.cos(lean * Math.PI / 180)).add(side.clone().multiplyScalar(Math.sin(lean * Math.PI / 180))).normalize();
    const base = n.clone().multiplyScalar(.47), P = k => base.clone().add(dir.clone().multiplyScalar(k * out)).add(side.clone().multiplyScalar(spiky ? 0 : k * k * out * .35));
    const pts = [n.clone().multiplyScalar(.4), base, P(.5), P(1)].map(v => [v.x, v.y, v.z]);
    return part(taperTube(pts, r0, .004, { seg: 16, rad: 10 }), pm, 'hair.tuft', .03);
  };
  const nTop = opts.tufts ?? (spiky ? 10 : 6);
  for (let i = 0; i < nTop; i++) {
    // spread around the crown (golden angle), pitch 52-82; messy uneven lengths and leans, spiky even and nearly radial
    const yaw = ((i * 137.5 + R() * 40) % 360) - 180, pitch = 52 + (spiky ? 30 * ((i + .5) / nTop) : R() * 30);
    const len = (spiky ? .1 + R() * .03 : .055 + R() * .08) * L, lean = spiky ? 8 + R() * 10 : 20 + R() * 35;
    // lean up/back (+tN = toward the crown on the front half, so tufts never fall toward the face) with some sideways scatter
    const leanDir = 90 + (R() - .5) * (spiky ? 40 : 140);
    g.add(tuft(yaw, pitch, len, lean, leanDir,spiky ? .062 : .055 + R() * .02));
  }
  const nSide = opts.sideTufts ?? (spiky ? 1 : 1 + (R() > .4 ? 1 : 0));
  for (const s of [1, -1]) for (let i = 0; i < nSide; i++) {
    const yaw = s * (98 + R() * 26), pitch = 14 + R() * 16, len = (spiky ? .09 : .06 + R() * .05) * L;
    g.add(tuft(yaw, pitch, len, 30 + R() * 25, 60 + R() * 60, spiky ? .055 : .05));
  }
  return g;
}

export function buildExtras(style, col, line, opts = {}) {
  const g = new THREE.Group(); g.name = 'hair.extras';
  const mat = painted(col);
  if (style === 'bald' && opts.nape !== false) g.add(buildNape(opts.napeOpts || {}));
  if (opts.back) g.add(buildBackHair({ colour: opts.colour ?? opts.color ?? 'brown', shell: 'own', maskHead: false, ...(typeof opts.back === 'object' ? opts.back : {}) }));
  if (style === 'bun') {
    const [yaw, pitch] = opts.bunAt || [180, 40];
    const b = part(new THREE.SphereGeometry(opts.bunR ?? .15, 40, 28), mat, 'hair.bun');
    b.position.set(...dirOf(yaw, pitch, .5 + (opts.bunR ?? .15) * .55)); b.scale.set(1, .92, .9);
    g.add(b);
  }
  if (style === 'ponytail') {
    const L = opts.length ?? .7;
    // SP (overnight 2): from behind the old tail (r .085 -> .03, bulge .35) was an even-width strap with a round end on the head and its
    // tie hidden inside it. Now: gathered at the back of the head by a visible tie (bigger than the root), full in the upper third, tapering
    // to a point; the tip swings a little to the character's right so it reads as hair, not a strap, from straight behind.
    g.add(part(taperTube([dirOf(180, 18, .4), dirOf(180, 13, .6), [0, -.03, -.68], [-.02, -.05 - L * .45, -.7], [-.06, -.05 - L * .88, -.62]], .095, .006, { bulge: .55 }), mat, 'hair.ponytail'));
    const tie = part(new THREE.TorusGeometry(.088, .032, 12, 28), painted(hairColours(opts.tieColour ?? 0x8a3340)), 'hair.tie', .025);
    tie.position.set(...dirOf(180, 15, .55)); tie.lookAt(new THREE.Vector3(...dirOf(180, 15, 2))); g.add(tie);
  }
  if (style === 'pigtails') for (const s of [1, -1]) {
    // W2: short soft bunches tied low behind the ears, hanging close to the head (the old ones stuck out like handles)
    const L = opts.length ?? .22;
    g.add(part(taperTube([dirOf(s * 135, -22, .4), dirOf(s * 135, -26, .5), [s * .38, -.3, -.36], [s * .4, -.3 - L * .6, -.36], [s * .39, -.3 - L, -.34]], .065, .035, { bulge: .4 }), mat, 'hair.pigtail'));
    const tie = part(new THREE.TorusGeometry(.05, .018, 10, 20), painted(hairColours(opts.tieColour ?? 0x8a3340)), 'hair.tie', .02);
    tie.position.set(...dirOf(s * 135, -24, .49)); tie.lookAt(new THREE.Vector3(...dirOf(s * 135, -24, 2))); g.add(tie);
  }
  if (style === 'long') g.add(part(slab({ len: opts.length ?? .72, width: .56, top: .1, scallops: 7, amp: .06 }), mat, 'hair.long'));
  if (style === 'bob' && opts.slab) g.add(part(slab({ len: .42, width: .58, top: .12, scallops: 0, amp: 0, depth: .14 }), mat, 'hair.bob'));
  if (style === 'messy' || style === 'spiky') g.add(buildTufts(style, col, opts));
  if (style === 'curly') {
    // bumps over the hair, sunk so their ink ring hides behind the ball (radius .46) except where they cross the head's outline
    const r = opts.curlR ?? .085, c0 = .445, M = new THREE.Vector3(...line.axis), E1 = new THREE.Vector3(...line.e1), E2 = new THREE.Vector3(...line.e2);
    const map = p => { const rho = Math.acos(Math.max(-1, Math.min(1, p.dot(M)))), x = p.dot(E1), y = p.dot(E2), l = Math.hypot(x, y) || 1; return [x / l * rho, y / l * rho]; };
    const poly = line.hair.map(v => map(new THREE.Vector3(...v))), verts = line.hair.map(v => new THREE.Vector3(...v));
    const inside = m => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > m[1]) !== (b[1] > m[1]) && m[0] < (b[0] - a[0]) * (m[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
    const geo = new THREE.SphereGeometry(r, 20, 14), pm = painted(col, { byPosition: true }), N = 160, keep = Math.asin(r / c0) + .06;
    for (let i = 0; i < N; i++) {
      const y = 1 - 2 * (i + .5) / N, rr = Math.sqrt(1 - y * y), th = i * 2.39996, p = new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr);
      if (!inside(map(p)) || Math.min(...verts.map(v => v.angleTo(p))) < keep) continue;
      const b = part(geo.clone().translate(p.x * c0, p.y * c0, p.z * c0), pm, 'hair.curl', .03);
      g.add(b);
    }
  }
  return g;
}

export function buildHair(spec = {}) {
  const style = spec.style || 'short', bald = style === 'bald';
  const colours = hairColours(spec.colour ?? spec.color ?? 'brown', { buzz: style === 'buzz', skin: spec.skin });
  const line = hairline({ ...spec, style: style === 'pigtails' ? 'pigtails' : style });
  const track = { hair: line.hair, hi: line.hi, axis: line.axis, e1: line.e1, e2: line.e2, shadeAngle: [spec.shadeAngle ?? 64.3], hairTint: [[119, 78, 48]] };
  const headParams = { track, hairDark: colours.dark, hairLit: colours.lit, hairHi: colours.hi, hairRim: colours.rim, lookFrame: spec.lookFrame ?? 100 };
  if (bald) headParams.hairlineInk = 0;
  // PR2 (FABLE_REVIEW3 item 10): light hair (white / silver, L > .6) gets a BOLD hairline (.07 D in head.js units: on screen about the glasses frame and
  // the brows' weight): the old thin .011 line left a pale patch with no edge, which read as a highlight, not hair (reference: worker f0-54).
  else if (new THREE.Color(colours.dark).getHSL({}, THREE.SRGBColorSpace).l > .6) headParams.hairlineInk = spec.hairlineInk ?? .07;
  if (spec.hairlineInk !== undefined && !bald) headParams.hairlineInk = spec.hairlineInk;
  // W6 2026-11-04 (FABLE_REVIEW4 item 1, Walter new_cast f10-50, f436): head.js lets hair stand PROUD of the skin at the silhouette
  // (shell hairR .484 vs the ball's .46, so the hull's ink ring there is only .016 D). With a pale band (white / grey, or the horseshoe)
  // that thin ring vanished at film size and the grey lobe read as a comma hanging outside the head circle. His pale patches (the boss's
  // grey, f0500) sit INSIDE the full ink ring: for light hair and bald_sides the shell now coincides with the ball (hairR = ballR, same
  // offsets), so the band is always inside the circle with one clean edge. `inside: false` keeps the proud shell; `inside: true` forces it.
  const light = new THREE.Color(colours.dark).getHSL({}, THREE.SRGBColorSpace).l > .6;
  if (!bald && (spec.inside ?? (light || style === 'bald_sides'))) Object.assign(headParams, { hairR: .46, hairOffX: -.012, hairOffY: .04 });
  const extras = spec.extras === false ? new THREE.Group() : buildExtras(style, colours, line, spec);
  return { headParams, extras, line, colours };
}
