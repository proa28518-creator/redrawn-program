// engine/rbx/hair.js (Roblox V3, WP-C2): chunky Roblox hair, hats and glasses as real 3D on the head (engine/rbx/head.js).
// Hair = a cap shell that follows the head (hairline front / sides / nape per style) + bevelled chunks (rounded boxes, cones,
// balls), two-tone by height (base colour low, a lit top), no strands. Everything is built in code from the head's own surface,
// so it sits on the head with no gap at any size. Styles: swept spiky swoop bob long pigtails bun short buzz curly afro ponytail.
// Hats: fedora police_cap baseball_cap mailman_cap helmet beanie goggles. Glasses: round square.
// (Plan said Blender glbs; built in three instead tonight: same look, no export step, sits on any head shape. See RBX_API.md.)
import * as THREE from '../three.js';

export function roundedBox(w, h, d, r, seg = 5) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg), p = g.attributes.position, v = new THREE.Vector3();
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  const ix = w / 2 - r, iy = h / 2 - r, iz = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const c = new THREE.Vector3(Math.max(-ix, Math.min(ix, v.x)), Math.max(-iy, Math.min(iy, v.y)), Math.max(-iz, Math.min(iz, v.z)));
    const o = v.clone().sub(c); if (o.lengthSq() > 1e-12) o.setLength(r);
    p.setXYZ(i, c.x + o.x, c.y + o.y, c.z + o.z);
  }
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  const m = mergeVerts(g); m.computeVertexNormals(); return m;
}
// weld the box's split faces so normals are smooth across the bevel
function mergeVerts(g) {
  const p = g.attributes.position, map = new Map(), pos = [], remap = [];
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(5)},${p.getY(i).toFixed(5)},${p.getZ(i).toFixed(5)}`;
    if (!map.has(k)) { map.set(k, pos.length / 3); pos.push(p.getX(i), p.getY(i), p.getZ(i)); }
    remap.push(map.get(k));
  }
  const idx = (g.index ? Array.from(g.index.array) : remap.map((_, i) => i)).map(i => remap[i]);
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setIndex(idx); return out;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// two-tone by height in head space (geometry already placed): base -> top
function tone(geo, mesh, base, top, y0, y1) {
  geo = geo.index ? geo : geo; const p = geo.attributes.position, col = [], v = new THREE.Vector3(), A = new THREE.Color(base), B = new THREE.Color(top), C = new THREE.Color();
  mesh.updateMatrix();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrix); C.copy(A).lerp(B, smooth(y0, y1, v.y)); col.push(C.r, C.g, C.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
}

// the cap: the head's surface pushed out by t over the region above the hairline yb(th); rim strip back to the skin
function capShell(head, t, yb, rows = 22, segs = 72) {
  const pos = [], idx = [], top = head.H / 2;
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= segs; j++) {
    const th = j / segs * Math.PI * 2, y0 = yb(th), s = i / rows;
    // rows run from the hairline up over the crown (y via an eased ramp so the top edge stays round)
    const y = y0 + (top - y0) * (1 - Math.pow(1 - s, 1.6));
    const p = i === rows ? [0, top + t, 0] : head.surface(th, y, t * (0.55 + .45 * smooth(y0, y0 + .08, y)));
    pos.push(p[0], p[1], p[2]);
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j, b = a + segs + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  // rim: from the hairline on the skin (lift .002) to the shell's first row
  const base = pos.length / 3;
  for (let j = 0; j <= segs; j++) { const th = j / segs * Math.PI * 2, p = head.surface(th, yb(th) - .004, .002); pos.push(p[0], p[1], p[2]); }
  for (let j = 0; j < segs; j++) { const a = base + j, b = j; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// hairline per angle: front (th 0) / side (th pi/2) / back (pi) heights in units of H/2
const line3 = (H, front, side, back) => th => { const c = Math.cos(th); const w = c >= 0 ? [front, side, c] : [back, side, -c]; return H / 2 * (w[1] + (w[0] - w[1]) * Math.pow(w[2], 1.5)); };

function place(head, th, y, lift) { const p = head.surface(th, y, lift); return new THREE.Vector3(p[0], p[1], p[2]); }

export function buildHair(head, spec, material) {
  const out = new THREE.Group(); out.name = 'rbxHair';
  head.group.add(out);
  const H = head.H, R = head.R;
  const hm = () => material(0xffffff, 'hair', { vertexColors: true });
  const add = (geo, mat, pos, rot, scl, base, top) => {
    const m = new THREE.Mesh(geo, mat); if (pos) m.position.copy(pos); if (rot) m.rotation.set(...rot); if (scl) m.scale.set(...scl);
    if (base != null) tone(geo, m, base, top, head.eyeY, H / 2 + .15);
    m.castShadow = m.receiveShadow = true; out.add(m); return m;
  };
  const hr = spec.hair;
  if (hr && hr.style && hr.style !== 'bald') {
    const base = new THREE.Color(hr.color || '#3a2a20'), top = hr.color2 ? new THREE.Color(hr.color2) : base.clone().offsetHSL(0, -.02, .1);
    const mat = hm(0xffffff);
    const st = hr.style, T = .045;
    const lines = {
      swept: line3(H, .74, .3, -.25), spiky: line3(H, .72, .3, -.1), swoop: line3(H, .45, .2, -.3), bob: line3(H, .62, -.55, -.75),
      long: line3(H, .62, -.6, -1.0), pigtails: line3(H, .6, .1, -.4), bun: line3(H, .6, .15, -.45), short: line3(H, .72, .3, -.3),
      buzz: line3(H, .66, .35, -.2), curly: line3(H, .55, .1, -.45), afro: line3(H, .5, 0, -.5), ponytail: line3(H, .6, .15, -.4),
    };
    const yb = lines[st] || lines.short;
    add(capShell(head, st === 'buzz' ? .018 : st === 'afro' ? .06 : T, yb), mat, null, null, null, base, top);
    const chunk = (w, h, d, th, y, lift, rx, ry, rz, r = .04) => add(roundedBox(w, h, d, r), mat, place(head, th, y, lift), [rx, ry + th, rz], null, base, top);
    if (st === 'swept') {
      // chunky slabs sweeping up and over to the viewer's left, overhanging the forehead (the hero: white-grey swept hair)
      // V3 CF2: six clean bevelled chunks, all swept the same way (to his left, +X), two-tone: a front row of three that lifts off the
      // forehead, two long chunks over the crown, one at the back. Big bevels, aligned, no pile.
      const SW = .42;                                                       // the sweep (one yaw for every chunk)
      for (let i = 0; i < 3; i++) { const th = -.5 + i * .5; chunk(.31, .15, .27, th, H * .41 + (i === 1 ? .015 : 0), .075, -.62, -SW - th * .35, .22, .065); }
      for (const x of [-.12, .12]) add(roundedBox(.28, .12, .40, .06), mat, new THREE.Vector3(x, H / 2 + .005 + (x > 0 ? .008 : 0), .0), [-.12, -SW * .6, .1], null, base, top);
    } else if (st === 'spiky') {
      // V3 CF2: fewer, bigger spikes (5 front / side, 3 back), each a 6-sided cone with a soft tip
      const spike = (th, y, lift, len, rad, rx, rz) => add(new THREE.ConeGeometry(rad, len, 6, 1), mat, place(head, th, y, lift), [rx, th, rz], null, base, top);
      for (let i = 0; i < 5; i++) { const th = -1.0 + i * .5; spike(th, H * (.38 + (i === 2 ? .04 : 0)), .085, .34, .12, -.5 * Math.cos(th) - .3, .22 * Math.sin(th)); }
      for (let i = 0; i < 3; i++) { const th = Math.PI - .7 + i * .7; spike(th, H * .3, .08, .3, .12, .75, 0); }
      spike(0, H * .5, .05, .3, .13, -.25, 0);
    } else if (st === 'swoop') {
      chunk(.62, .1, .2, .05, H * .3, .07, -.25, 0, -.25, .05);
      chunk(.34, .32, .1, -.3, H * .14, .055, -.12, -.28, -.15, .05);   // the swoop over one eye
    } else if (st === 'bob' || st === 'long') {
      const len = st === 'long' ? .55 : .3;
      for (const s of [-1, 1]) chunk(.13, H * .5 + len, .34, s * 1.35, H * .06 - len / 2, .05, 0, 0, 0, .06);
      chunk(.5, H * .5 + len, .14, Math.PI, H * .06 - len / 2, .05, 0, 0, 0, .06);
      chunk(.62, .12, .18, 0, H * .36, .06, -.2, 0, 0, .05);   // bangs
    } else if (st === 'pigtails') {
      for (const s of [-1, 1]) { const b = add(new THREE.SphereGeometry(.13, 20, 14), mat, place(head, s * 1.75, H * .12, .12), null, [1, 1.25, 1], base, top); b.position.y -= .02; }
      chunk(.6, .1, .18, 0, H * .36, .06, -.2, 0, 0, .05);
    } else if (st === 'bun') {
      add(new THREE.SphereGeometry(.15, 22, 16), mat, new THREE.Vector3(0, H / 2 + .08, -R * .45), null, [1, .85, 1], base, top);

    } else if (st === 'ponytail') {
      add(new THREE.CylinderGeometry(.09, .04, .45, 16), mat, new THREE.Vector3(0, H * .05, -R - .1), [.35, 0, 0], null, base, top);

    } else if (st === 'curly' || st === 'afro') {
      const n = st === 'afro' ? 34 : 22, rr = st === 'afro' ? .13 : .085;
      for (let i = 0; i < n; i++) { const th = (i * 2.399) % (Math.PI * 2), y = yb(th) + (H / 2 - yb(th)) * ((i * .618) % 1); add(new THREE.SphereGeometry(rr, 14, 10), mat, place(head, th, Math.min(y, H * .46), rr * .45 + .02), null, null, base, top); }
    } else if (st === 'short') {
      chunk(.56, .08, .16, 0, H * .4, .05, -.25, 0, .05, .04);
    }
  }
  if (spec.hat?.style) buildHat(head, spec.hat, out, material);
  if (spec.glasses?.style) buildGlasses(head, spec.glasses, out, material);
  return out;
}

function buildHat(head, hat, out, material) {
  const H = head.H, R = head.R, c = new THREE.Color(hat.color || '#2a2a30').getHex(), c2 = new THREE.Color(hat.color2 || hat.color || '#2a2a30').offsetHSL(0, 0, hat.color2 ? 0 : -.08).getHex();
  const m = material(c, 'cloth'), m2 = material(c2, 'cloth');
  const add = (g, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const k = new THREE.Mesh(g, mat); k.position.set(x, y, z); k.rotation.set(rx, ry, rz); k.castShadow = k.receiveShadow = true; out.add(k); return k; };
  const top = H / 2, s = hat.style;
  // a lathe run from the axis outward and down winds inward (front faces culled from outside: the skin showed through the crown).
  // Wind it so its faces point away from the axis.
  const lathe = (pts, mat, y = 0) => {
    const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 64), P = g.attributes.position, ix = g.index.array;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(); let w = 0;
    for (let t = 0; t < ix.length; t += 3) { a.fromBufferAttribute(P, ix[t]); b.fromBufferAttribute(P, ix[t + 1]); c.fromBufferAttribute(P, ix[t + 2]);
      const n = b.clone().sub(a).cross(c.clone().sub(a)); w += n.x * a.x + n.z * a.z + n.y * Math.max(0, a.y - .1); }
    if (w < 0) { for (let t = 0; t < ix.length; t += 3) { const k = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = k; } g.index.needsUpdate = true; }
    g.computeVertexNormals();
    return add(g, mat, 0, y, 0);
  };
  if (s === 'fedora') {
    lathe([[0, .3], [R * .86, .3], [R * .95, .22], [R * .98, .02], [R * .99, 0]], m, top - .1);
    add(new THREE.CylinderGeometry(R * 1.0, head.radiusAt(0, top - .15) + .012, .09, 64), m2, 0, top - .105, 0);            // band (hugs the head)
    add(roundedBox(R * 3.1, .035, R * 3.0, .016, 4), m, 0, top - .11, 0, -.06, 0, 0);          // brim
  } else if (s === 'police_cap' || s === 'mailman_cap') {
    // V3 CF2: the band hugs the head (tapers to the skin at its lower edge) and reaches down over the visor's root: no skin strip
    // between crown, band and visor from any yaw or nod
    lathe([[0, .2], [R * 1.12, .2], [R * 1.14, .16], [R * 1.02, .02], [R * 1.0, -.02]], m, top - .1);
    const yb = top - .19, rb = head.radiusAt(0, yb) + .012;
    add(new THREE.CylinderGeometry(R * 1.015, rb, .11, 64), m2, 0, top - .135, 0);
    add(roundedBox(R * 1.5, .035, R * .75, .016, 4), material(0x15151a, 'plastic'), 0, top - .175, rb + R * .2, .22);
    if (s === 'police_cap') add(roundedBox(.08, .1, .02, .01, 3), material(0xe8c040, 'metal'), 0, top + .0, R * 1.12);
  } else if (s === 'baseball_cap') {
    lathe([[0, R * .62], [R * .55, R * .52], [R * .92, R * .22], [R * 1.03, 0]], m, top - R * .3);
    add(roundedBox(R * 1.4, .03, R * .9, .014, 4), m2, 0, top - R * .28, R * 1.05, .12);
    add(new THREE.SphereGeometry(.03, 10, 8), m2, 0, top + R * .32, 0);
  } else if (s === 'helmet') {
    add(new THREE.SphereGeometry(R * 1.13, 48, 24, 0, Math.PI * 2, 0, Math.PI * .55), m, 0, top - .18, 0);
    add(new THREE.TorusGeometry(R * 1.1, .03, 10, 64), m2, 0, top - .17, 0, Math.PI / 2);
  } else if (s === 'beanie') {
    add(new THREE.SphereGeometry(R * 1.08, 48, 24, 0, Math.PI * 2, 0, Math.PI * .52), m, 0, top - .16, 0);
    add(new THREE.CylinderGeometry(R * 1.1, R * 1.1, .1, 64), m2, 0, top - .17, 0);
  } else if (s === 'goggles') {
    add(new THREE.TorusGeometry(R * 1.01, .025, 8, 64), m2, 0, top - .14, 0, Math.PI / 2 - .25);
    for (const sg of [-1, 1]) { const p = head.surface(sg * .35, top - .14, .04); const k = add(new THREE.CylinderGeometry(.075, .075, .05, 24), material(0x7fd0f0, 'glass'), p[0], p[1], p[2], Math.PI / 2, 0, 0); k.lookAt(p[0] * 3, p[1] + .12, p[2] * 3); k.rotateX(Math.PI / 2); add(new THREE.TorusGeometry(.078, .02, 8, 24), m, p[0], p[1], p[2]).lookAt(p[0] * 3, p[1] + .12, p[2] * 3); }
  }
}

function buildGlasses(head, gl, out, material) {
  const mat = material(new THREE.Color(gl.color || '#15151a').getHex(), 'frame');
  const unit = head.R * 1.25, E = .227 * 1.34, th = E * unit / head.R, y = head.eyeY - .03 * unit, r = .16 * unit;
  const sq = gl.style === 'square';
  for (const s of [-1, 1]) {
    const p = head.surface(s * th, y, .035);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .016, 8, sq ? 4 : 40), mat);
    ring.position.set(p[0], p[1], p[2]); ring.lookAt(p[0] + p[3], p[1] + p[4], p[2] + p[5]); if (sq) ring.rotateZ(Math.PI / 4), ring.scale.set(1.25, 1, 1);
    out.add(ring);
    // arm back to the ear
    const q = head.surface(s * 1.5, y, .02), a = new THREE.Vector3(p[0] + s * r * .9, p[1], p[2] - .01), b = new THREE.Vector3(q[0], q[1], q[2]);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, a.distanceTo(b), 6), mat); arm.position.copy(a).add(b).multiplyScalar(.5); arm.lookAt(b); arm.rotateX(Math.PI / 2); out.add(arm);
  }
  const l = head.surface(-th + r / head.R, y + .01, .045), rr = head.surface(th - r / head.R, y + .01, .045);
  const a = new THREE.Vector3(l[0], l[1], l[2]), b = new THREE.Vector3(rr[0], rr[1], rr[2]);
  const br = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, a.distanceTo(b), 6), mat); br.position.copy(a).add(b).multiplyScalar(.5); br.lookAt(b); br.rotateX(Math.PI / 2); out.add(br);
}
