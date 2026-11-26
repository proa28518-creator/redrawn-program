// The young engineer's cap, a real 3D object in character space (head diameter 1, head centre at the origin, +Y up, +Z front).
// Every number is measured from his frames: tools/cap_*.py write src/capTrack.json (profile, the one fixed mount, colours, light, lift track).
//   build(params)         async, returns the cap Group (children: pivot > crown, band, underside, visor, button)
//   update(frame, ctx)    the lift at f96-102 and the view-space light; the cap is rigid to the head on every other frame
// Everything is analytic, per pixel, from the object position: sharp at any size, no texture.
import * as THREE from './three.js';
import { outline } from './shade.js';

import { loadTrack } from './tracks.js';
// The track (src/capTrack.json, or params.tracks / params.track, see tracks.js) is loaded in build() and kept on root.userData.track: no module state.
const hex = c => new THREE.Color(c);

const COMMON_VERT = `
varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main() {
  vP = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const HASH = `float hash(float k) { return fract(sin(k*12.9898 + 4.1)*43758.5453); }`;

// Crown: hand-painted meridian stripes. Each stripe has its own width, slow kinks where it crosses a panel seam, uneven brushy edges, and the
// whole set sweeps toward the rim. Near the button and on the grazing far side they dissolve into fine lines over a pale wash.
const CROWN_FRAG = `
precision highp float;
#define TAU 6.28318530718
varying vec3 vP; varying vec3 vN; varying vec3 vV;
uniform float uN, uDuty, uYLow, uYHigh, uFres, uAO, uPhase, uCollarR, uRmax, uKink, uBrush, uSeams, uFineB, uFineF;
uniform vec3 uBlueLit, uBlueDark, uWhiteLit, uWhiteDark, uWash, uLight, uCollar, uNavy;
uniform vec2 uNavyY;
uniform vec3 uSweep;
uniform float uWarp[6];
uniform float uStripeW[28], uStripeC[28];
uniform float uFootK, uFootY, uFootW;
${HASH}
float kink(float k, float t) {
  float x = t*uSeams, i = floor(x), f = x - i;
  return mix(hash(k*3.1 + i*7.7), hash(k*3.1 + (i + 1.)*7.7), f) - .5;
}
void main() {
  vec3 n = normalize(vN);
  float r2 = max(dot(vP.xz, vP.xz), 1e-7), rr = sqrt(r2), t = rr/uRmax;
  float th = atan(vP.x, vP.z);
  // d theta on screen, without the seam atan has
  float dthx = (vP.z*dFdx(vP.x) - vP.x*dFdx(vP.z))/r2, dthy = (vP.z*dFdy(vP.x) - vP.x*dFdy(vP.z))/r2;
  float aa = max((abs(dthx) + abs(dthy))*uN/TAU, 1e-4);
  float warp = uWarp[0]*sin(th) + uWarp[1]*cos(th) + uWarp[2]*sin(2.*th) + uWarp[3]*cos(2.*th) + uWarp[4]*sin(3.*th) + uWarp[5]*cos(3.*th);
  float sweep = (uSweep.x + uSweep.y*cos(th - uSweep.z))*t*t*t;
  float ph0 = th*uN/TAU + uPhase + warp + sweep;
  float k = floor(ph0 + .5);
  float ph = ph0 + uKink*kink(k, t)*smoothstep(.12, .4, t);
  int si = int(mod(k, 28.));
  float d = ph - k - uStripeC[si];
  // own width, slightly different edge on each side
  float hk = hash(k*1.7), hk2 = hash(k*5.3 + 2.);
  float hw = uStripeW[si]*.5*(.92 + .16*hk);
  float e1 = uBrush*(sin(t*47. + hk*40.) + .6*sin(t*113. + hk2*90.)), e2 = uBrush*(sin(t*53. + hk2*50.) + .6*sin(t*127. + hk*70.));
  float sd = max(-d - hw - e1, d - hw - e2);
  float white = 1. - smoothstep(-aa*.6, aa*.6, sd);
  white = mix(white, uDuty, smoothstep(.45, 1., aa));
  float nv = clamp(dot(n, normalize(vV)), 0., 1.);
  // fine lines: near the button, and where the surface turns away
  float zb = (1. - smoothstep(.2, .42, t))*uFineB;
  float zf = smoothstep(.72, .96, 1. - nv)*uFineF;
  float z = max(zb, zf);
  float af = aa*2.5;
  float dl = abs(fract(ph*2.5 + .17 + .3*kink(k + 9., t)) - .5);
  float fine = 1. - smoothstep(.15 - af*.6, .15 + af*.6, dl);
  fine = mix(fine, .34, smoothstep(.55, 1.1, af));
  white = mix(white, max(white*.6, fine), z);
  float sh = clamp(.5 + .5*dot(n, uLight), 0., 1.);
  vec3 blue = mix(uBlueDark, uBlueLit, sh);
  vec3 wht = mix(uWhiteDark, uWhiteLit, sh);
  blue = mix(blue, uWash, z*.18);
  vec3 col = mix(blue, wht, white);
  // the wall under the rim falls into shade toward the band
  col *= mix(uAO, 1., smoothstep(uYLow, uYHigh, vP.y));
  // the crown's foot is a dark navy strip on every view: the stripes end above the band
  col = mix(uNavy, col, smoothstep(uNavyY.x, uNavyY.y, vP.y));
  // the thin bright line at the crown's foot, seen near level (f66, f80), gone from above
  float yaa = max(fwidth(vP.y), 1e-5);
  col = mix(col, uWhiteLit, uFootK*(1. - smoothstep(uFootW - yaa, uFootW + yaa, abs(vP.y - uFootY))));
  // grazing wash on the lit side only
  float gr = pow(1. - nv, 3.)*uFres*smoothstep(.35, .8, sh);
  col = mix(col, uWash, clamp(gr, 0., .85));
  // the ink dish round the button, on the dome itself: round against a square button, so it shows as crescents beside it
  float caa = max(fwidth(rr), 1e-5);
  col = mix(uCollar, col, smoothstep(uCollarR - caa, uCollarR + caa, rr));
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;

// Band: dark, with thin uneven pale lines at fixed heights.
const BAND_VERT = `
varying vec3 vP; varying float vOut;
void main() {
  vP = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vOut = dot(normalMatrix * vec3(position.x, 0., position.z), normalize(-mv.xyz));
  gl_Position = projectionMatrix * mv;
}`;
const BAND_FRAG = `
precision highp float;
varying vec3 vP; varying float vOut;
uniform vec3 uBase, uPin;
uniform vec4 uP1, uP2; // y centre, half width, strength
uniform float uPinArc, uPinK, uClean;
float line(vec4 p, float a, float aa, float s) {
  float w = p.y*(.65 + .6*sin(a*7. + s) *sin(a*3.1 + s*2.)) + .0002;
  float yc = p.x + .0016*sin(a*5.3 + s*1.7);
  float brk = smoothstep(-.5, .25, sin(a*11. + s*3.) + .7*sin(a*23. + s));
  return (1. - smoothstep(w - aa, w + aa, abs(vP.y - yc)))*p.z*mix(mix(.45, 1., brk), 1., uClean);
}
void main() {
  float aa = max(fwidth(vP.y), 1e-5), th = atan(vP.x, vP.z);
  float a = line(uP1, th, aa, 1.3), b = line(uP2, th, aa, 4.1);
  a *= step(0., vOut); b *= step(0., vOut);   // the trim is on the outside: the far wall seen through the opening stays dark
  float arc = 1. - smoothstep(uPinArc - .08, uPinArc + .08, abs(th));  // his pinstripe runs round the front, tip to tip
  gl_FragColor = vec4(mix(uBase, uPin, clamp(a + b, 0., 1.)*arc*uPinK), 1.);
  #include <colorspace_fragment>
}`;

// Visor: thin irregular bands parallel to the peak's edge, in the mesh's s coordinate (0 root, 1 edge). Top pale on mid; underside blue with pale lines.
const VISOR_VERT = `
attribute vec3 st; varying vec3 vST; varying vec3 vN;
void main() {
  vST = st;
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const VISOR_FRAG = `
precision highp float;
varying vec3 vST; varying vec3 vN;
uniform vec3 uMid, uPale, uDeep, uUnder, uUnderLine;
uniform float uBands, uDuty, uPhase;
${HASH}
void main() {
  float s = vST.y, u = vST.x;
  float front = step(.5, vST.z);
  float ph0 = s*uBands + uPhase;
  float k = floor(ph0 + .5);
  float ph = ph0 + .05*sin(u*31. + k*2.3) + .025*sin(u*83. + k*5.1);
  float d = abs(ph - k);
  float aa = max(fwidth(ph0), 1e-4);
  float hw = uDuty*.5*(.55 + .9*hash(k + 3.))*(.8 + .35*sin(u*17. + k*3.));
  float line = 1. - smoothstep(hw - aa*.7, hw + aa*.7, d);
  line = mix(line, uDuty, smoothstep(.25, .6, aa));
  vec3 top = mix(mix(uDeep, uMid, smoothstep(.05, .9, s)), uPale, line);
  float l2 = 1. - smoothstep(.02 - aa*.5, .02 + aa*.5, abs(fract(s*2.2 + .55) - .5));
  vec3 und = mix(uUnder, uUnderLine, l2*.85);
  gl_FragColor = vec4(mix(und, top, front), 1.);
  #include <colorspace_fragment>
}`;

function flatMat(c) { const m = new THREE.ShaderMaterial({ vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform vec3 uC;void main(){gl_FragColor=vec4(uC,1.);\n#include <colorspace_fragment>\n}', uniforms: { uC: { value: hex(c) } } }); return m; }

const jhash = k => { const x = Math.sin(k*12.9898 + 4.1)*43758.5453; return x - Math.floor(x); };

// Crown lathe whose rim is an irregular polygon: straight runs with corners where his panels meet, on the outer rows only.
function crownGeometry(prof, polyM, polyAmp, nth = 512) {
  const rows = prof.length, cols = nth + 1, pos = new Float32Array(rows*cols*3), idx = [];
  const Rmax = Math.max(...prof.map(p => p[0]));
  const vth = [], vr = [];
  for (let i = 0; i < polyM; i++) { vth.push((i + (jhash(i*3.3) - .5)*.55)/polyM*Math.PI*2); vr.push(1 + polyAmp*(jhash(i*7.1) - .35)); }
  const poly = th => {
    let a = polyM - 1;
    for (let i = 0; i < polyM; i++) if (th >= vth[i]) a = i;
    const b = (a + 1) % polyM; let t0 = vth[a], t1 = vth[b];
    if (t1 <= t0) t1 += Math.PI*2;
    let x = th; if (x < t0) x += Math.PI*2;
    const f = (x - t0)/(t1 - t0);
    // a straight chord between the two corners, not an arc
    const ax = vr[a]*Math.cos(t0), ay = vr[a]*Math.sin(t0), bx = vr[b]*Math.cos(t1), by = vr[b]*Math.sin(t1);
    const n = [by - ay, ax - bx], c = n[0]*ax + n[1]*ay, dn = n[0]*Math.cos(x) + n[1]*Math.sin(x);
    return Math.abs(dn) > 1e-6 ? c/dn : vr[a] + (vr[b] - vr[a])*f;
  };
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const th = (j % nth)/nth*Math.PI*2, [r0, y] = prof[i];
    const w = Math.pow(r0/Rmax, 8);
    const r = r0*(1 + (poly(th) - 1)*w);
    pos.set([r*Math.sin(th), y, r*Math.cos(th)], (i*cols + j)*3);
  }
  for (let i = 0; i < rows - 1; i++) for (let j = 0; j < nth; j++) {
    const a = i*cols + j, b = a + cols, c = b + 1, d = a + 1;
    idx.push(a, b, d, d, b, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  // close the seam's normals
  const n = g.attributes.normal;
  for (let i = 0; i < rows; i++) { const a = i*cols, b = a + nth, x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1; n.setXYZ(a, x/l, y/l, z/l); n.setXYZ(b, x/l, y/l, z/l); }
  return g;
}

function lathe(prof, seg = 192) {
  return new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(Math.max(p[0], 1e-4), p[1])), seg);
}

// The button: a stubby rounded block, square in plan, flat on top.
function buttonGeometry(w, h) {
  const g = new THREE.SphereGeometry(1, 48, 28), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), l = Math.hypot(x, z);
    if (l < 1e-5) { p.setXYZ(i, 0, y*h, 0); continue; }
    const c = x/l, s = z/l, k = l*Math.pow(Math.pow(Math.abs(c), 4.5) + Math.pow(Math.abs(s), 4.5), -1/4.5);
    const yy = Math.sign(y)*Math.pow(Math.abs(y), .55);
    p.setXYZ(i, c*k*w, yy*h, s*k*w*(1 + .05*c));   // not quite square, as his
  }
  g.computeVertexNormals();
  return g;
}

// The peak: root on the band, edge a curve from tip to tip, ending in a cut, not a point. x = rho sin phi, z = rho cos phi. Same formula as tools/cap_visor.py.
const visorEdge = (V, phi) => {
  const u = Math.max(0, Math.cos(Math.min(1, Math.abs(phi)/V.phim)*Math.PI/2));
  return (V.cut || 0) + (1 - (V.cut || 0))*Math.pow(u, V.k);
};
export function visorPoint(V, phi, s) {
  const edge = visorEdge(V, phi);
  const rho = V.rb + (V.zf - V.rb)*edge*s;
  const y = V.y0 - V.drop*edge*Math.pow(s, V.curl);
  return [rho*Math.sin(phi), y, rho*Math.cos(phi)];
}

// A closed thin solid (top, underside, outer edge, the two cut ends) so the inverted hull works from above and from below.
function visorGeometry(V, nphi = 180, ns = 24) {
  const pos = [], st = [], idx = [];
  const c = ns + 1, grid = nphi + 1;
  for (let side = 1; side >= 0; side--) for (let i = 0; i <= nphi; i++) for (let j = 0; j <= ns; j++) {
    const phi = -V.phim + 2*V.phim*i/nphi, s = j/ns, p = visorPoint(V, phi, s);
    if (!side) p[1] -= V.thick;
    pos.push(...p); st.push(i/nphi, s, side);
  }
  const bot = grid*c;
  for (let i = 0; i < nphi; i++) for (let j = 0; j < ns; j++) {
    const a = i*c + j, b = a + c;
    idx.push(a, a + 1, b, a + 1, b + 1, b);                                     // top, facing up
    idx.push(bot + a, bot + b, bot + a + 1, bot + a + 1, bot + b, bot + b + 1); // underside, facing down
  }
  for (let i = 0; i < nphi; i++) { const a = i*c + ns, b = a + c; idx.push(a, bot + a, b, b, bot + a, bot + b); }  // outer edge
  for (let j = 0; j < ns; j++) {                                                                                     // the cut ends
    const a = j, b = nphi*c + j;
    idx.push(a, bot + a, a + 1, a + 1, bot + a, bot + a + 1);
    idx.push(b, b + 1, bot + b, b + 1, bot + b + 1, bot + b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('st', new THREE.Float32BufferAttribute(st, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

const eul = new THREE.Euler();
function applyMount(pivot, S) {
  const M = S.mount;
  pivot.position.set(M.x, M.y, M.z);
  pivot.quaternion.setFromEuler(eul.set(M.rx, M.ry, M.rz, 'ZXY'));
  pivot.scale.setScalar(M.scale);
}

export async function build(params = {}) {
  const TRACK = await loadTrack(params, 'cap', new URL('./capTrack.json', import.meta.url));
  const { tracks, track, kind, lookFrame, ...own } = params;
  const S = { ...TRACK.shape, ...own };
  const root = new THREE.Group(); root.name = 'cap';
  root.userData.track = TRACK; root.userData.lookFrame = lookFrame;
  const pivot = new THREE.Group(); applyMount(pivot, S);
  root.add(pivot); root.userData.pivot = pivot;
  const INK = S.ink;

  // Crown
  const Rmax = Math.max(...S.profile.map(p => p[0]));
  const crownU = {
    uN: { value: S.N }, uPhase: { value: S.phase || 0 }, uDuty: { value: S.duty }, uYLow: { value: S.aoY[0] }, uYHigh: { value: S.aoY[1] }, uFres: { value: S.fres }, uAO: { value: S.ao },
    uBlueLit: { value: hex(S.blueLit) }, uBlueDark: { value: hex(S.blueDark) }, uWhiteLit: { value: hex(S.whiteLit) }, uWhiteDark: { value: hex(S.whiteDark) }, uWash: { value: hex(S.wash) },
    uLight: { value: new THREE.Vector3(.5, .4, .77) }, uCollar: { value: hex(S.ink) }, uCollarR: { value: S.collarR }, uNavy: { value: hex(S.navy) }, uNavyY: { value: new THREE.Vector2(...S.navyY) },
    uRmax: { value: Rmax }, uKink: { value: S.kink }, uBrush: { value: S.brush }, uSeams: { value: S.seams }, uFineB: { value: S.fineB }, uFineF: { value: S.fineF },
    uSweep: { value: new THREE.Vector3(...S.sweep) }, uWarp: { value: S.warp },
    uStripeW: { value: S.stripeW || new Array(28).fill(S.duty) }, uStripeC: { value: S.stripeC || new Array(28).fill(0) }, uFootK: { value: 0 }, uFootY: { value: S.footY }, uFootW: { value: S.footW },
  };
  const crownMat = new THREE.ShaderMaterial({ vertexShader: COMMON_VERT, fragmentShader: CROWN_FRAG, uniforms: crownU, side: THREE.FrontSide, extensions: { derivatives: true } });
  const crown = new THREE.Mesh(crownGeometry(S.profile, S.polyM, S.polyAmp), crownMat); crown.name = 'crown';
  outline(crown, { width: S.inkCrown, color: INK, zBias: 4 });  // deep: the hull's offset must not poke through the panels
  pivot.add(crown); root.userData.crownU = crownU;

  // Button
  const button = new THREE.Mesh(buttonGeometry(S.btnW, S.btnH), flatMat(S.btnColor));
  button.position.set(0, S.btnY, 0); button.rotation.y = S.btnYaw || 0; button.name = 'button';
  outline(button, { width: S.inkBtn, color: INK, zBias: .2 });
  pivot.add(button);

  // Band: wall from the crown's lower edge down, closed under the crown by the annulus
  const bandProf = [[S.rTuck, S.bandTop], [S.rb, S.bandTop - .004], [S.rb, -S.bandH], [S.rb - S.bandRim, -S.bandH - .002]];
  const bandMat = new THREE.ShaderMaterial({
    vertexShader: BAND_VERT, fragmentShader: BAND_FRAG, side: THREE.DoubleSide, extensions: { derivatives: true },
    uniforms: { uBase: { value: hex(S.bandColor) }, uPin: { value: hex(S.pinColor) }, uP1: { value: new THREE.Vector4(...S.pin1) }, uP2: { value: new THREE.Vector4(...S.pin2) }, uPinArc: { value: S.pinArc }, uPinK: { value: 1 }, uClean: { value: 0 } },
  });
  const band = new THREE.Mesh(lathe(bandProf), bandMat); band.name = 'band';
  pivot.add(band);

  // Underside, flat and recessed, seen at f98: a measured gradient (linear + radial) in the cap's own x, z
  const underMat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    // CircleGeometry lies in its own xy, its +y becomes the cap's front
    fragmentShader: 'varying vec3 vP;uniform vec3 uA,uB;uniform float uR;uniform vec4 uG;void main(){vec2 q=vP.xy/uR;float g=uG.x+uG.y*q.x+uG.z*q.y+uG.w*dot(q,q);gl_FragColor=vec4(mix(uA,uB,clamp(g,0.,1.)),1.);\n#include <colorspace_fragment>\n}',
    uniforms: { uA: { value: hex(S.underColor) }, uB: { value: hex(S.underLit) }, uR: { value: S.rb - S.bandRim }, uG: { value: new THREE.Vector4(...S.underG) } }, side: THREE.DoubleSide,
  });
  const under = new THREE.Mesh(new THREE.CircleGeometry(S.rb - S.bandRim, 128), underMat);
  under.rotation.x = Math.PI/2; under.position.y = -S.bandH + S.underRecess; under.name = 'underside';
  pivot.add(under);
  // The thick dark rim of the opening, seen from below, and the band's ink: an inverted lathe (far wall only) wider than the band.
  const underHull = new THREE.Mesh(lathe([[S.rb - S.bandRim, -S.bandH - .002], [S.rb + S.rimInk, -S.bandH - .002]]), flatMat(INK));
  underHull.material.side = THREE.DoubleSide; underHull.name = 'rim';
  pivot.add(underHull);
  const bandInk = new THREE.Mesh(lathe([[S.rb + S.rimInk, -S.bandH - .002], [S.rb + S.rimInk, S.bandTop + .01]]), flatMat(INK));
  bandInk.material.side = THREE.BackSide; bandInk.name = 'band.ink';
  pivot.add(bandInk);

  // Visor
  const V = S.visor;
  const visorMat = new THREE.ShaderMaterial({
    vertexShader: VISOR_VERT, fragmentShader: VISOR_FRAG, side: THREE.FrontSide, extensions: { derivatives: true },
    uniforms: { uMid: { value: hex(S.visorMid) }, uPale: { value: hex(S.visorPale) }, uDeep: { value: hex(S.visorDeep) }, uUnder: { value: hex(S.underColor) }, uUnderLine: { value: hex(S.visorUnderLine) }, uBands: { value: V.bands }, uDuty: { value: V.bandDuty }, uPhase: { value: V.bandPhase } },
  });
  const vg = visorGeometry(V);
  const visor = new THREE.Mesh(vg, visorMat); visor.name = 'visor';
  pivot.add(visor);
  // his ink is heavy under the peak and thin at its sides and tips: the hull drops along the cap's axis only where the peak has depth
  const vh = outline(visor, { width: S.inkVisor, color: INK, zBias: 2 });
  const hg = vg.clone(), hp = hg.attributes.position, hs = hg.attributes.st;
  for (let i = 0; i < hp.count; i++) { const phi = -V.phim + 2*V.phim*hs.getX(i); hp.setY(i, hp.getY(i) - S.inkVisorDrop*Math.pow(Math.max(0, Math.cos(Math.abs(phi)/V.phim*Math.PI/2)), .8)); }
  vh.geometry = hg;
  root.userData.bandU = bandMat.uniforms;
  return root;
}

// The cap is its own 2.5D layer, like the face and the torso: it has its own view (az el roll) relative to the camera and its own place on screen relative to the
// head (u v in head diameters, s against the head's d). Same pinhole as bench place(); then the whole cap is scaled about the camera so it sits at the head's depth,
// which leaves its picture unchanged and keeps it right against the head in a depth-tested scene.
const DEG = Math.PI/180;
const _dir = new THREE.Vector3(), _ray = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _near = new THREE.Vector3(), _m = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _qq = new THREE.Quaternion(), _o = new THREE.Vector3(), _ref = new THREE.Vector3(), _axis = new THREE.Vector3(0, 0, -1), _wp = new THREE.Vector3(), _wq = new THREE.Quaternion(), _ws = new THREE.Vector3();
function poseCap(pivot, root, P, ctx) {
  const { cam, camera, focal: F, width: W, height: H } = ctx;
  const x = cam.cx + P.u*cam.d, y = cam.cy + P.v*cam.d, ds = P.s*cam.d;
  _dir.set(Math.sin(P.az*DEG)*Math.cos(P.el*DEG), Math.sin(P.el*DEG), Math.cos(P.az*DEG)*Math.cos(P.el*DEG));
  _ray.set((x - W/2)/F, -(y - H/2)/F, -1).normalize();
  const D = Math.hypot(F/(ds*Math.pow(-_ray.z, 1.5)), .5);
  _near.set(0, 1, 0);
  _x.crossVectors(_near, _dir).normalize(); _y.crossVectors(_dir, _x);
  _x.applyAxisAngle(_dir, P.roll*DEG); _y.applyAxisAngle(_dir, P.roll*DEG);
  _m.makeBasis(_x, _y, _dir);
  _q.setFromRotationMatrix(_m).multiply(_qq.setFromUnitVectors(_ray, _axis));     // the cap's own camera -> cap
  _qi.copy(_q).invert();
  _o.copy(_dir).multiplyScalar(-D).applyQuaternion(_qi);                          // the cap's origin in camera space
  // to the depth of the head's top
  camera.updateMatrixWorld();
  _ref.set(0, .39, 0); root.parent?.localToWorld?.(_ref); camera.worldToLocal(_ref);
  const k = _ref.z/_o.z;
  _wq.copy(camera.quaternion).multiply(_qi);
  _wp.copy(_o).multiplyScalar(k).applyQuaternion(camera.quaternion).add(camera.position);
  // into the root's space, whatever it is parented to
  root.updateWorldMatrix(true, false);
  root.getWorldScale(_ws);
  pivot.position.copy(root.worldToLocal(_wp));
  pivot.quaternion.copy(root.getWorldQuaternion(_qq).invert().multiply(_wq));
  pivot.scale.setScalar(k/_ws.x);
}

const X = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
export function update(frame, ctx) {
  const root = ctx.root, pivot = root.userData.pivot, TRACK = root.userData.track, S = TRACK.shape, M = S.mount;
  // lift: pose against the head, f96-102, from the frames; every other frame is the cap's own pose against the camera
  const liftEnd = TRACK.lift ? Math.max(...Object.keys(TRACK.lift).map(Number)) : 0; // 102 for the engineer
  const L = TRACK.lift?.[String(Math.min(frame, liftEnd))]; // past f102 he falls out of frame with the cap back on: it holds its last pose against the head
  applyMount(pivot, S);
  const poses = TRACK.pose;
  if (poses && !L && ctx.cam && ctx.camera) {
    const keys = Object.keys(poses).map(Number); // 0-95 for the engineer: frames outside hold the nearest end
    const key = Math.max(Math.min(...keys), Math.min(Math.max(...keys), Math.round(frame)));
    let P = poses[String(key)];
    if (!P) { let bd = Infinity; for (const k of keys) if (Math.abs(k - key) < bd) { bd = Math.abs(k - key); P = poses[String(k)]; } }
    poseCap(pivot, root, P, ctx);
  }
  if (L) {
    pivot.position.set(L.x, M.y + L.y, M.z + L.z);
    pivot.quaternion.setFromEuler(eul.set(L.rx, L.ry || 0, L.rz, 'ZXY'));
  }
  // light and colours are fixed in view space per span, and swing with the camera between shots
  let l = TRACK.light.default, span = null;
  const lf = root.userData.lookFrame ?? frame; // params.lookFrame: pick the light span at a chosen frame instead of the render frame
  for (const s of TRACK.light.spans) if (lf >= s.from && lf <= s.to) { l = s.dir; span = s; }
  const U = root.userData.crownU;
  U.uLight.value.copy(X.set(...l).normalize());
  U.uBlueLit.value.set(span?.blueLit || S.blueLit); U.uBlueDark.value.set(span?.blueDark || S.blueDark);
  U.uWhiteLit.value.set(span?.whiteLit || S.whiteLit); U.uWhiteDark.value.set(span?.whiteDark || S.whiteDark);
  const B = root.userData.bandU;
  B.uPinArc.value = L ? S.pinArcLift : S.pinArc;
  B.uP1.value.y = L ? S.pinLift : S.pin1[1];  // from below the trim shows its broad face, whole and white
  B.uClean.value = L ? 1 : 0; B.uPin.value.set(L ? '#f4f8fd' : S.pinColor);
  // his pinstripe reads bright seen near level or from below (f66, f80, f98) and dim from above (f3, f19, f40): a thin trim, shaded by the view
  if (ctx.camera) {
    const axis = Y.clone().applyQuaternion(pivot.quaternion);
    const toCam = ctx.camera.position.clone().sub(pivot.position).normalize();
    const t = THREE.MathUtils.clamp((axis.dot(toCam) - .13)/.07, 0, 1);
    B.uPinK.value = 1 - .92*t*t*(3 - 2*t);
    U.uFootK.value = L ? 0 : B.uPinK.value;
  }
}
