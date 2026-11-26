// engine/rbx/head.js (Roblox V3, WP-C2): the Roblox head, true 3D, carrying the charsys face (engine/rbx/face.js), hair, hats and glasses
// (engine/rbx/hair.js). Head = a short rounded cylinder: round in top view, a superellipse profile (flat sides, soft top and bottom
// edge), never a ball. Units D (1 stud = .577 D). Origin = the head centre, +Y up, +Z = the face's forward.
// buildRbxHead(spec, { material }) -> { group, R, H, eyeY, neckY, surface(theta, y, out), face, hair, update(faceChannel, opts) }
//   spec.skin '#hex'; spec.head.shape 'classic' | 'monster'; spec.face / hair / hat / glasses / facial / mask (specs/rbx/*.json).
//   opts.light = the body's light record (engine/rbx/shade.js makeLight, WP-C1) so the head is lit like the body (mats.js);
//   default MeshStandardMaterial.
import * as THREE from '../three.js';
import { createRbxFace } from './face.js';
import { buildHair } from './hair.js';
import { matFactory, ensureAo } from './mats.js';

// R15 head 1.2 studs x 1.15 (plan: readable faces in 9:16) -> radius .40 D, height .76 D
export const HEAD = { R: .40, H: .76, N: 3.4 };          // N: the profile's superellipse exponent (2 = ellipse, high = box)
export const MONSTER = { R: .46, H: .70, N: 5, square: 4.2 };


export function headProfile(R, H, N) {
  // radius at height y (|y| <= H/2)
  return y => R * Math.pow(Math.max(1 - Math.pow(Math.abs(y) / (H / 2), N), 0), 1 / N);
}

export function buildRbxHead(spec = {}, opts = {}) {
  const shape = spec.head?.shape === 'monster' ? MONSTER : HEAD;
  const { R, H, N } = shape, sq = shape.square || 2;
  const prof = headProfile(R, H, N);
  // top-view section: circle (classic) or a rounded square (monster); s(theta) = radius factor
  const sect = th => sq === 2 ? 1 : 1 / Math.pow(Math.pow(Math.abs(Math.cos(th)), sq) + Math.pow(Math.abs(Math.sin(th)), sq), 1 / sq);
  // opts.light (preferred) or opts.material(hex, kind). A plain material factory cannot do vertex colours (face, two-tone hair) or
  // painted maps, so those go through mats.js with the light record read off the caller's own material (same uniforms = same light).
  let material = opts.material || matFactory(opts.light || null);
  if (opts.material && !opts.light) {
    const probe = opts.material(0xffffff, 'probe'), u = probe?.uniforms;
    const L = u?.uDir ? Object.fromEntries(Object.entries(u).filter(([k]) => k !== 'uCol')) : null;
    const rich = matFactory(L);
    material = (hex, kind, o = {}) => (o.vertexColors || o.map || o.polygonOffset || o.flat || o.side) ? rich(hex, kind, o) : opts.material(hex, kind, o);
  }
  const group = new THREE.Group(); group.name = 'rbxHead';

  // skin: a lathe of the profile, re-shaped by the section
  const rows = 40, segs = 72, pos = [], idx = [];
  for (let i = 0; i <= rows; i++) {
    const a = -Math.PI / 2 + Math.PI * i / rows, y = (H / 2) * Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 2 / N);
    const r = prof(y);
    for (let j = 0; j <= segs; j++) { const th = j / segs * Math.PI * 2, k = sect(th); pos.push(r * k * Math.sin(th), y, r * k * Math.cos(th)); }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j, b = a + segs + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  // the seam at theta 0/2pi: average its normals so no line shows
  const nrm = geo.attributes.normal;
  for (let i = 0; i <= rows; i++) { const a = i * (segs + 1), b = a + segs; for (let c = 0; c < 3; c++) { const m = (nrm.array[a * 3 + c] + nrm.array[b * 3 + c]) / 2; nrm.array[a * 3 + c] = nrm.array[b * 3 + c] = m; } }
  const skinHex = new THREE.Color(spec.skin || '#e0b98f').getHex();
  const skin = new THREE.Mesh(geo, material(skinHex, 'skin')); skin.name = 'rbxHeadSkin'; skin.castShadow = skin.receiveShadow = true;
  group.add(skin);
  // V4-HF: no neck stub on the head any more. It hung .17 D under the head and swung with every nod (the head turned on its centre),
  // so it poked out of the chest / back when a character bent, crouched or looked down (gruss V3 item 1). The body's own neck
  // (body.js, in the torso's frame) fills the gap now and the head turns on its neck joint (character.js neckHead). An empty
  // placeholder keeps `head.neck` for old callers.
  const neck = new THREE.Object3D(); neck.name = 'rbxNeck'; group.add(neck);

  const head = {
    group, R, H, shape, skin, neck,
    eyeY: H * .06,              // decal origin (between the eyes) a touch above the centre: Roblox eyes, mouth low
    neckY: -H / 2,
    topY: H / 2,
    radiusAt: (th, y) => prof(Math.max(-H / 2, Math.min(H / 2, y))) * sect(th),
    // skin point + outward normal at angle th (0 = face front, + toward +X) and height y, pushed out by `lift`
    surface(th, y, lift = 0) {
      const yc = Math.max(-H / 2 * .999, Math.min(H / 2 * .999, y)), r = prof(yc) * sect(th);
      // normal of the profile: d r / d y
      const e = 1e-3, dr = (prof(Math.min(H / 2 * .999, yc + e)) - prof(Math.max(-H / 2 * .999, yc - e))) / (2 * e) * sect(th);
      let nx = Math.sin(th), nz = Math.cos(th), ny = -dr; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      return [r * Math.sin(th) + nx * lift, yc + ny * lift, r * Math.cos(th) + nz * lift, nx, ny, nz];
    },
  };
  head.material = material;
  head.face = createRbxFace(head, spec);
  head.hair = buildHair(head, spec, material);
  // baked AO: darker under the chin and the head's underside, nothing on the face
  ensureAo(skin, (p, i) => { const y = p.getY(i); return y < -H * .3 ? .78 + .22 * Math.max(0, (y + H / 2) / (H * .2)) : 1; });
  ensureAo(group);
  // V4-HF draw order (face.js): skin (0) -> face decal (1, glow 2; no depth write, so its layers paint in order and never z-fight)
  // -> hair, hats, glasses, facial hair (3) so a fringe or a hat brim always covers the brows, never the other way round
  group.traverse(o => { if (o.isMesh && o !== skin && !/^rbxFace/.test(o.name) && !o.renderOrder) o.renderOrder = 3; });
  head.update = (ch, o) => head.face.update(ch, o);
  return head;
}
