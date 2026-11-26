// world/rbx/crowd.js: background Roblox people in one line (WP-K2, V3_REF WP-K 5, 2026-11-12). Pure data for a film.mjs (filmkit build):
//   import { crowd } from '../../world/rbx/crowd.js';
//   const C = crowd(12, 'walk', { kit: 'hallway', origin: [1600, 0], t1: DURATION, seed: 3 });
//   Object.assign(CAST, C.cast); Object.assign(ACTS, C.acts);
// n: 6..20 people. action: 'stand' (stand and look around), 'walk' (stroll up and down the lane), 'run', 'crawl' (no crawl clip in charsys
// yet: walks slowly with 'careful' gait, said in C.note). Specs are inline rbx specs in the same form as rbx_levitate's EXTRA (varied skin,
// hair, tops, pants, faces), ids `<prefix>1..n`. Places come from the kit's own lanes (KIT_AREAS, kit coordinates, + origin) and stay out
// of `clear` boxes ([x0, x1, z0, z1] in kit coordinates; the hallway's ryan_locker strip and the middle lane are clear by default).
const SKIN = ['#f2d2b6', '#8d5a3b', '#f7e0cc', '#c98e62', '#5e3b26', '#e8c09a', '#ffd9b0', '#a86b45'];
const HAIR = ['long', 'bun', 'curly', 'short', 'spiky'];
const HAIRC = ['#6b3d1f', '#1b1b1b', '#d9a441', '#2a1a10', '#3a2a20', '#f0d070', '#141414', '#c0502a'];
const TOP = ['#f2c933', '#6a3fc9', '#1f9fd1', '#ff9a2e', '#f4f4f4', '#ff7aa8', '#27c0b0', '#e8413a', '#3fbf5a', '#7fc4ee', '#f4a6c0', '#a8e0c0'];
const PANTS = ['#3b5a8f', '#2b2b33', '#e8e2d0', '#4a4f5a', '#2f6b4a', '#5a6fa8', '#1c2a5a', '#6a4a32'];
const FACE = ['classic_smile', 'happy_derp', 'classic_smile', 'happy_derp'];
export const KIT_AREAS = {
  hallway: { x: [-2.3, 2.3], z: [-30, 6], along: 'z', clear: [[-2.7, -1.3, -9.2, -5.8], [-.9, .9, -40, 12]] },
  town: { x: [-25, 25], z: [-2.4, 2.2], along: 'x', clear: [[-1.5, 1.5, -3, 3]] },          // relative to the zone place: the back sidewalk
  classroom: { x: [-6, 6], z: [-6, 4], along: 'x', clear: [] },
  home: { x: [-3, 3], z: [-3, 3], along: 'x', clear: [] },
};
export function crowd(n = 10, action = 'stand', o = {}) {
  const A = { ...(KIT_AREAS[o.kit] || KIT_AREAS.hallway), ...(o.area || {}) }, clear = o.clear || A.clear || [], [ox, oz] = o.origin || [0, 0];
  const prefix = o.prefix || 'cr', t0 = o.t0 ?? 0, t1 = o.t1 ?? 60, film = o.film || 'v3';
  let s = (o.seed ?? 1) * 7919 >>> 0; const R = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296), pick = a => a[Math.floor(R() * a.length)];
  const free = (x, z, placed) => !clear.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1) && placed.every(([px, pz]) => Math.hypot(px - x, pz - z) > 1.25);
  const cast = {}, acts = {}, placed = [], N = Math.max(1, Math.min(20, n));
  for (let i = 0; i < N; i++) {
    let x = 0, z = 0; for (let k = 0; k < 60; k++) { x = A.x[0] + R() * (A.x[1] - A.x[0]); z = A.z[0] + R() * (A.z[1] - A.z[0]); if (free(x, z, placed)) break; }
    placed.push([x, z]); const id = prefix + (i + 1);
    const spec = { kind: 'rbx', id, film, name: 'Extra ' + id, role: 'background crowd', skin: pick(SKIN), build: { scale: .94 + R() * .12, width: .95 + R() * .1 },
      head: { shape: 'classic' }, face: { default: pick(FACE) }, hair: { style: pick(HAIR), color: pick(HAIRC) }, hat: null, glasses: null, facial: null,
      wear: { top: 'tshirt', topColor: pick(TOP), accent: '#f4f4f4', print: null, pants: pick(PANTS), pantsKind: 'long', shoes: R() < .5 ? '#f2f2f2' : '#2b2b33' } };
    const ry = Math.round((R() - .5) * 140 + (A.along === 'z' ? (x < 0 ? 90 : -90) : 0));
    cast[id] = { spec, at: [ox + x, oz + z], ry };
    const a = {};
    if (action === 'stand') {   // look around: a new target every 2..4 s (people, the lane, up)
      const look = [{ t: t0, at: null }]; for (let t = t0 + R() * 2; t < t1; t += 2 + R() * 2) look.push({ t, at: R() < .25 ? null : [ox + x + (R() - .5) * 6, 2.2 + R() * 1.5, oz + z + (R() - .5) * 6] });
      a.look = look;
    } else {                    // walk / run / crawl: there and back along the lane, start offset so they never move in step
      const sp = action === 'run' ? 4.5 : action === 'crawl' ? .6 : 1.0 + R() * .4, len = 3 + R() * 4, dir = R() < .5 ? -1 : 1, walk = [];
      const P = k => A.along === 'z' ? [ox + x, oz + Math.max(A.z[0], Math.min(A.z[1], z + dir * (k % 2 ? len : 0)))] : [ox + Math.max(A.x[0], Math.min(A.x[1], x + dir * (k % 2 ? len : 0))), oz + z];
      for (let t = t0 + R() * 1.5, k = 1; t < t1; k++) { walk.push({ t0: +t.toFixed(2), path: [P(k)], speed: sp, ...(action === 'run' ? { gait: 'run' } : action === 'crawl' ? { gait: 'careful' } : {}) }); t += len / sp + .8 + R() * 1.2; }
      cast[id].walks = walk;
    }
    acts[id] = a;
  }
  return { cast, acts, note: action === 'crawl' ? 'crawl: charsys has no crawl clip; these walk slowly (gait careful)' : '' };
}
export default { crowd, KIT_AREAS };
