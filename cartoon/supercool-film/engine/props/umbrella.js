// props/umbrella.js: a classic umbrella, open or furled (opts.open 0..1). PR2 2026-11-04 (FABLE_REVIEW3 item 6: the old canopy was two
// flat triangles a panel and read as a collapsed kite): open = a SHALLOW DOME of `segments` panels in alternating colours, each panel's
// rim edge scalloped up between the rib tips, an ink rib line along every rib, ink along the scalloped rim, a ferrule tip on top, a
// runner + stretchers under the canopy (reads from below), a curved J handle. Two-tone flat shade (_kit flat: top lit, underside dark)
// + ink. One readable silhouette from below, side and above. `open` 0 = furled (panels wrapped round the shaft + a strap), in between
// = half open (the same ribs swing out), so a film can key it by rebuilding or via obj.userData.setOpen(v) (rebuilds in place).
// Origin = the grip (straight part just above the hook); the shaft goes up +Y.
// opts: open 1, colors ['#c8433a', '#f2ece0'] (panels alternate; one colour = plain), segments 8, radius 1.0 (rim radius when open),
//   depth .36 (dome depth / radius), shaft 1.4, height (= canopy top above the grip, the ferrule's base; overrides shaft: shaft =
//   height - .1). Over a head: the canopy's LOWEST point (socket rimLow, = height - depth*radius) must clear the head / hat top
//   above the holder's hand: raise `height`, not the hand. handle '#5b3a24', ink .016 (outline width D)
// sockets: grip, top (the ferrule tip), rim (one rib tip, open radius), rimLow (centre of the rim plane), runner
import { THREE, flat, basic, part, finish, INK } from './_kit.js';
export const free = true;

const clamp01 = v => Math.min(1, Math.max(0, v));
const ease = v => v * v * (3 - 2 * v);

function tube(pts, r, mat, seg = 24) {
  const c = new THREE.CatmullRomCurve3(pts.map(p => p.isVector3 ? p : new THREE.Vector3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, seg, r, 6, false), mat); m.userData.noOutline = true; return m;
}

function buildInto(g, o) {
  const open = clamp01(o.open ?? 1), E = ease(open), N = Math.max(3, Math.round(o.segments ?? 8)), R = o.radius ?? 1.0;
  const depth = (o.depth ?? .36) * R, L = o.height != null ? o.height - .1 : (o.shaft ?? 1.4), topY = L + .1, inkW = o.ink ?? .016;
  const cols = (o.colors ?? ['#c8433a', '#f2ece0']).map(c => new THREE.Color(c).getStyle());
  const wood = flat(o.handle ?? '#5b3a24', '#3a2416'), metal = flat('#4a4a52', '#2e2e34'), inkM = basic(INK);

  // ---- rib shape: s 0 (top) .. 1 (tip). Open = an arc of the dome's sphere; furled = hanging along the shaft (a slim bundle).
  const Rs = (R * R + depth * depth) / (2 * depth), thM = Math.asin(Math.min(1, R / Rs)), Lr = Rs * thM;
  const ribAt = s => {
    const th = s * thM, ox = Rs * Math.sin(th), oy = topY - Rs * (1 - Math.cos(th));
    const cx = .03 + .085 * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.15)), .8) * (1 - .55 * s), cy = topY - s * Lr * .93;
    return [cx + (ox - cx) * E, cy + (oy - cy) * E];   // [radial distance, height]
  };
  const ang = i => (i / N) * Math.PI * 2 + Math.PI / N;  // ribs off the X axis: a panel faces the viewer, a rib line runs up the middle
  const pt = (s, a) => { const [r, y] = ribAt(s); return new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r); };
  // a panel point: straight chord between its two ribs (flat panels = the faceted dome), the rim edge scalloped UP between the tips
  const scal = .16 * E + .02;
  const NS = 12, NU = 8;
  const panelPt = (i, s, u) => {
    const a0 = ang(i), a1 = ang(i + 1), sm = 1 - scal * Math.sin(Math.PI * u), ss = s * sm;
    const A = pt(ss, a0), B = pt(ss, a1);
    const P = A.lerp(B, u);
    // a little billow so the panel isn't a dead plane (outward, most at mid panel / mid rib)
    const b = .05 * E * R * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, ss * 1.1));
    const rad = new THREE.Vector3(P.x, 0, P.z); if (rad.lengthSq() > 1e-8) P.add(rad.normalize().multiplyScalar(b));
    return P;
  };
  const groups = cols.length > 1 ? cols.map(() => []) : [[]];
  for (let i = 0; i < N; i++) {
    const pos = [], idx = [];
    for (let j = 0; j <= NS; j++) for (let k = 0; k <= NU; k++) { const P = panelPt(i, j / NS, k / NU); pos.push(P.x, P.y, P.z); }
    for (let j = 0; j < NS; j++) for (let k = 0; k < NU; k++) {
      const a = j * (NU + 1) + k, b = a + NU + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b); // wound so the normal points out of the dome (checked below)
    }
    groups[i % groups.length].push({ pos, idx });
  }
  groups.forEach((list, gi) => {
    const pos = [], idx = []; let off = 0;
    for (const p of list) { pos.push(...p.pos); idx.push(...p.idx.map(v => v + off)); off += p.pos.length / 3; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
    geo.computeVertexNormals();
    // make sure the normals point outward/up (the lit side on top): flip the winding if the first panel's mid normal points down
    const nm = geo.attributes.normal, mid = Math.floor(NS / 2) * (NU + 1) + Math.floor(NU / 2);
    if (nm.getY(mid) < 0) { for (let t = 0; t < idx.length; t += 3) { const x = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = x; } geo.setIndex(idx); geo.computeVertexNormals(); }
    const lit = cols[gi % cols.length], c = new THREE.Color(lit);
    g.add(part(geo, flat(lit, c.clone().multiplyScalar(.62).getStyle(), { double: true }), inkW));
  });

  // ---- ink: a rib line on every rib (sits just proud of the fabric, top and bottom), the scalloped rim, rib tips
  const ribR = .011 * (R / 1) + .002;
  for (let i = 0; i < N; i++) {
    const a = ang(i), P = [];
    for (let j = 0; j <= 10; j++) P.push(pt(j / 10, a));
    g.add(tube(P, ribR, inkM, 20));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(ribR * 1.9, 8, 6), metal); tip.position.copy(P[10]); g.add(tip);
    if (E > .2) { // the rim: this panel's scalloped lower edge
      const rim = []; for (let k = 0; k <= NU; k++) rim.push(panelPt(i, 1, k / NU));
      g.add(tube(rim, ribR * .9, inkM, 16));
    }
  }
  // ---- shaft, ferrule tip on top, runner + stretchers (seen from below)
  const shaft = part(new THREE.CylinderGeometry(.017, .017, topY - .1, 8), metal, .012); shaft.position.y = (topY - .1) / 2 + .1; g.add(shaft);
  const fer = part(new THREE.ConeGeometry(.026, .16, 10), metal, .012); fer.position.y = topY + .08; g.add(fer);
  const cap = part(new THREE.SphereGeometry(.04, 12, 8), flat(cols[0]), .012); cap.position.y = topY + .005; g.add(cap);
  const [mr, my] = ribAt(.5), runY = my - .55 * mr - .04;
  const runner = part(new THREE.CylinderGeometry(.03, .03, .09, 10), metal, .012); runner.position.y = runY; g.add(runner);
  if (E > .05) for (let i = 0; i < N; i++) g.add(tube([new THREE.Vector3(0, runY + .03, 0), pt(.5, ang(i)).multiplyScalar(1)], .007, inkM, 2));
  if (E < .35) { // a furled umbrella gets a strap round its middle
    const [sr, sy] = ribAt(.45);
    const st = part(new THREE.CylinderGeometry(sr + .02, sr + .02, .06, 16), flat(cols[0]), .012); st.position.y = sy; g.add(st);
  }
  // ---- handle: straight grip at the origin + a J hook curling to the holder's front-outside
  const grip = part(new THREE.CylinderGeometry(.034, .03, .24, 10), wood, .016); grip.position.y = .03; g.add(grip);
  const hc = new THREE.CatmullRomCurve3([[0, -.08, 0], [0, -.15, 0], [-.025, -.215, 0], [-.085, -.24, 0], [-.14, -.205, 0], [-.155, -.14, 0], [-.145, -.1, 0]].map(p => new THREE.Vector3(...p)));
  g.add(part(new THREE.TubeGeometry(hc, 24, .03, 8, false), wood, .016));
  const sockets = { top: [0, topY + .16, 0], rim: [Math.sin(ang(0)) * ribAt(1)[0], ribAt(1)[1], Math.cos(ang(0)) * ribAt(1)[0]], rimLow: [0, ribAt(1)[1], 0], runner: [0, runY, 0] };
  return sockets;
}

export function build(o = {}) {
  const g = new THREE.Group(); g.name = 'prop.umbrella';
  const sockets = buildInto(g, o);
  const out = finish(g, sockets);
  // key `open` without a second prop: rebuild the children in place (same opts otherwise); returns the new sockets
  g.userData.setOpen = v => {
    for (const c of [...g.children]) { g.remove(c); c.traverse(m => { m.geometry?.dispose?.(); }); }
    const s = buildInto(g, { ...o, open: v });
    g.userData.sockets = { grip: [0, 0, 0], ...s }; g.traverse(m => { m.frustumCulled = false; });
    return g.userData.sockets;
  };
  return out;
}
