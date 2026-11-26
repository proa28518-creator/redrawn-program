// props/steam.js: the Boss's steam (s05d-e, from f524 while he is purple). v2 (s05c fitter, 2026-11-03), from his f524-566 at full size:
// each side of the bowler = a WIDE FLAT cloud (~.45 D across, ~.2 D tall, 4-5 lobes in a row, white #fffdff, a light lilac shade only on
// the lower edge, thin grey outline) sitting at brim height and pulsing a little, plus a second smaller lump on top of it, and puffs that
// leave the cloud, rise ~.35 D and FADE out (translucent, no outline: his high puffs read pinkish because the wall shows through).
// The clouds hold screen left/right of the hat whatever the head does (camera axes), as before.
// Spec: "props": [{ "kind": "steam", "from": 524, "to": 599 }]. Params: from, to, clusters [{ at, puffs [[dx,dy,dz,rx,ry]], period, phase,
// fly: { from [x,y], rise, period, phase, r } }], lit, dark, ink, inkW, flyCol.
import * as THREE from '../three.js';
import { outline } from '../shade.js';

const DEF = {
  from: 524, to: 599, lit: '#fffdff', dark: '#e4dae6', ink: '#9b8f9e', inkW: .010, flyCol: '#fbeff0', grow: 3,
  clusters: [
    // two stacked rows per side (his f533 f545 f555): a lower row hugging the crown, an upper row offset outward
    { at: [-.57, .5, .3], period: 9, phase: 0,
      puffs: [[-.11, -.08, .01, .072, .058], [-.01, -.075, .02, .082, .064], [.09, -.09, .01, .066, .054], [-.17, -.02, 0, .055, .045],
              [-.1, .05, 0, .082, .068], [.0, .07, -.01, .088, .072], [.1, .04, 0, .068, .056], [-.04, .13, -.02, .06, .05]],
      fly: { from: [-.04, .16], rise: .34, drift: -.12, period: 12, phase: 3, r: [.075, .06] } },
    { at: [.6, .48, .3], period: 11, phase: 5,
      puffs: [[-.09, -.09, .01, .066, .054], [.01, -.075, .02, .082, .064], [.11, -.08, .01, .072, .058], [.17, -.02, 0, .055, .045],
              [-.08, .04, 0, .068, .056], [.02, .07, -.01, .088, .072], [.11, .05, 0, .082, .068], [.05, .14, -.02, .06, .05]],
      fly: { from: [.04, .17], rise: .32, drift: .1, period: 13, phase: 8, r: [.08, .065] } },
  ],
};
const VERT = `varying vec3 vN; void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const FRAG = `varying vec3 vN; uniform vec3 uLit, uDark; uniform float uOp;
void main() { vec3 n = normalize(vN); float k = smoothstep(.15, .85, dot(n, normalize(vec3(.35, -.9, .2))));
  gl_FragColor = vec4(mix(uLit, uDark, k), uOp);
  #include <colorspace_fragment>
}`;

export async function build(params = {}) {
  const { kind, tracks, limbsTrack, ...own } = params;
  const P = { ...DEF, ...own };
  const root = new THREE.Group(); root.name = 'prop.steam';
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uLit: { value: new THREE.Color(P.lit) }, uDark: { value: new THREE.Color(P.dark) }, uOp: { value: 1 } } });
  const geo = new THREE.SphereGeometry(1, 32, 24);
  const groups = [];
  for (const c of P.clusters) {
    const g = new THREE.Group(); g.position.set(...c.at); root.add(g);
    for (const [x, y, z, rx, ry] of c.puffs) {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(rx, ry ?? rx, rx);
      outline(m, { width: P.inkW, color: P.ink, zBias: .5 });
      g.add(m);
    }
    let fly = null;
    if (c.fly) {
      const fm = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
        uniforms: { uLit: { value: new THREE.Color(P.flyCol) }, uDark: { value: new THREE.Color(P.dark) }, uOp: { value: 1 } } });
      fly = new THREE.Group(); root.add(fly);
      for (const [dx, dy, s] of [[-.05, 0, 1], [.05, .01, .9], [0, .045, .8]]) {
        const m = new THREE.Mesh(geo, fm); m.position.set(dx, dy, 0); m.scale.set(c.fly.r[0] * s, c.fly.r[1] * s, c.fly.r[0] * s); m.renderOrder = 2; fly.add(m);
      }
      fly.userData.mat = fm;
    }
    groups.push([g, c, fly]);
  }
  root.userData = { P, groups };
  root.visible = false;
  return root;
}

export function update(frame, ctx) {
  const { P, groups } = ctx.root.userData;
  const on = frame >= P.from && frame <= P.to;
  ctx.root.visible = on;
  if (!on) return;
  // the cluster frame takes the camera's axes: .at is x screen right, y screen up (rolled with the head), z toward the camera
  if (ctx.camera) { ctx.root.parent?.updateWorldMatrix(true, false); const pq = new THREE.Quaternion(); ctx.root.parent?.getWorldQuaternion(pq); ctx.root.quaternion.copy(pq.invert().multiply(ctx.camera.quaternion)); }
  const n = frame - P.from;
  for (const [g, c, fly] of groups) {
    const t = ((n + c.phase) % c.period) / c.period;
    const grow = n < P.grow ? (n + 1) / (P.grow + 1) : 1;   // his clouds are full within ~3 frames (f524 small, f527 full)
    g.scale.setScalar(grow * (.94 + .08 * Math.sin(2 * Math.PI * t)));
    g.position.set(c.at[0], c.at[1] + .015 * Math.sin(2 * Math.PI * t), c.at[2]);
    if (fly) {
      const f = c.fly, u = ((n + f.phase) % f.period) / f.period;   // 0 = leaves the cloud, 1 = gone
      fly.position.set(c.at[0] + f.from[0] + f.drift * u, c.at[1] + f.from[1] + f.rise * u, c.at[2] - .05);
      fly.scale.setScalar((.8 + .45 * u) * (n < P.grow ? 0 : 1));
      fly.userData.mat.uniforms.uOp.value = .85 * (1 - u) * (1 - u * .3);
    }
  }
}

export default { build, update };
