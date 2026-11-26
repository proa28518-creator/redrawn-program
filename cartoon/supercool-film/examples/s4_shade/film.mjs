// films/s4_shade: the 1927 S-4 short, pass 5 (shading: world/look/rigshade.js, per-place settings in shade.mjs). Same film as films/s4_post. One narrator, nobody speaks on screen: every beat is faces, hands and knocks tied to the words.
// A .mjs so the knock schedule is one table: it drives the hands, the visible impact rings and (films/s4/sfx_events.mjs) the sound.
import { SHOTS, SEAMS } from "./shots.mjs";
import { makePost } from "./post.mjs";
import { makeShade } from "./shade.mjs";
const [SX, SZ] = [400, 0], [BX, BZ] = [400, -400], [TX, TZ] = [400, 400], [UX, UZ] = [-400, 0];

// body-space hand target from a world point (root at [x, z], facing ry, hem height hy)
const toBody = ([x, z], ry, hy, [wx, wy, wz]) => { const r = ry * Math.PI / 180, dx = wx - x, dz = wz - z;
  return [+(dx * Math.cos(r) - dz * Math.sin(r)).toFixed(3), +(wy - hy).toFixed(3), +(dx * Math.sin(r) + dz * Math.cos(r)).toFixed(3)]; };

// ---- who knocks where: root, facing, hem height, side, hand on impact (world), tool head on impact (world, where the ring shows)
const SPOT = {
  kid:   { at: [-1.1, .95],  ry: -20, hy: .55,  side: 'R', hand: [-1.56, 1.62, .95], head: [-1.88, 1.82, 1.06], rotHit: [0, 0, 62], rotUp: [0, 0, 24], ring: .55 },
  lt:    { at: [-3.25, .5],  ry: 30,  hy: 1.42, side: 'L', hand: [-2.58, 2.3, .85],  head: [-2.22, 2.5, .98],  rotHit: [0, 0, -62], rotUp: [0, 0, -24], ring: .5 },
  chief: { at: [1.55, .3],   ry: -15, hy: .55,  side: 'L', hand: [2.42, 1.18, .42],  head: [2.8, 1.4, .5],    rotHit: [0, 0, -62], rotUp: [0, 0, -24], ring: .5 },
  big:   { at: [.25, -2.7],  ry: -10, hy: 1.42, side: 'L', hand: [.82, 2.4, -2.6],   head: [1.13, 2.6, -2.6], rotHit: [0, 0, -62], rotUp: [0, 0, -24], ring: .45 },
  wire:  { at: [-2.8, -1.8], ry: 25,  hy: .55,  side: 'R', hand: [-3.38, 1.42, -1.7], head: [-3.73, 1.62, -1.7], rotHit: [0, 0, 62], rotUp: [0, 0, 24], ring: .4 },
  cook:  { at: [2.3, 3.3],  ry: 8,   hy: 1.06, side: 'L', hand: [2.55, 1.16, 3.42],  head: [2.86, 1.36, 3.48], rotHit: [0, 0, -62], rotUp: [0, 0, -24], ring: .5 },
  diver1:{ at: [UX - .95, UZ + 1.2], ry: -50, hy: 1.2, side: 'R', hand: [UX - 1.66, 2.0, UZ + 1.32], head: [UX - 2.02, 2.2, UZ + 1.4], rotHit: [0, 0, 62], rotUp: [0, 0, 24], ring: .8 },
  navy:  { at: [TX + 8, TZ + 2.6], ry: 150, hy: 1.26, side: 'L', hand: [TX + 7.16, 1.5, TZ + 2.5], head: [TX + 7.16, 1.5, TZ + 2.5], ring: .7, bare: true },
};
const run = (who, times, o = {}) => times.map((t, i) => ({ who, t, ...(typeof o === 'function' ? o(i) : o) }));
// every knock of the film. t = the strike. `rise` frames up to it. `ring: false` = no ring here (the listener side shows its own).
export const KNOCKS = [
  ...run('kid', [.72], { rise: 6, back: 3, label: 'first tap' }),
  ...run('kid', [1.08, 1.28, 1.5, 1.76], i => ({ rise: 3, back: 2, label: ['Is', 'there', 'any', 'hope'][i], out: i === 3 ? { hold: .35, out: 8 } : null })),
  ...run('diver1', [14.18, 14.5, 14.78], i => ({ rise: i ? 4 : 2, back: 3, label: 'diver knocks on the hull', out: i === 2 ? { hold: .6, out: 8 } : null })),
  ...run('kid', [16.46, 16.92, 17.38, 17.84, 18.3, 18.76], i => ({ rise: 8, back: 5, label: 'slow knock back ' + (i + 1), out: i === 5 ? { hold: .3, out: 8 } : null })),
  ...run('kid', [21.74, 21.98, 22.2, 22.44, 22.62], i => ({ rise: i ? 3 : 8, back: 2, soft: 1, label: 'tapping', out: i === 4 ? { hold: .2, out: 6 } : null })),
  ...run('lt', [21.82, 22.06, 22.3, 22.74, 22.88, 23.02, 23.24, 23.38], i => ({ rise: i ? 3 : 8, back: 2, soft: i < 3 ? 1 : 0, label: i < 3 ? 'tapping' : 'morse: hurry', out: i === 7 ? { hold: .3, out: 6 } : null })),
  ...run('chief', [21.9, 22.22, 22.5], i => ({ rise: i ? 3 : 8, back: 3, soft: 1, label: 'tapping', out: i === 2 ? { hold: .3, out: 8 } : null })),
  ...run('big', [21.78, 22.14, 22.54], i => ({ rise: i ? 4 : 8, back: 3, soft: 1, label: 'tapping', out: i === 2 ? { hold: .3, out: 8 } : null })),
  ...run('wire', [21.94, 22.28, 22.58], i => ({ rise: i ? 3 : 8, back: 3, soft: 1, label: 'tapping', out: i === 2 ? { hold: .3, out: 8 } : null })),
  ...run('cook', [22.0, 22.34, 22.66], i => ({ rise: i ? 3 : 8, back: 3, soft: 1, label: 'tapping', out: i === 2 ? { hold: .3, out: 8 } : null })),
  ...run('kid', [29.92, 30.1, 30.33, 30.6], i => ({ rise: i ? 4 : 10, back: 2, label: 'asked: ' + ['Is', 'there', 'any', 'hope'][i], out: i === 3 ? { hold: .5, out: 10 } : null })),
  ...run('navy', [31.34, 31.62], i => ({ rise: i ? 3 : 6, back: 3, ping: 1, label: 'the Navy key', out: i === 1 ? { hold: .4, out: 8 } : null })),
  ...run('diver1', [35.24, 35.6], i => ({ rise: i ? 5 : 8, back: 4, label: 'diver knocks: no answer', out: i === 1 ? { hold: 1, out: 8 } : null })),
];
// the answer heard from outside and the ping heard from inside: rings only, no hand (the sound comes from sfx_events.mjs)
const RING_EXTRA = [
  { id: 'r_hull', at: [UX - 2.0, 2.5, UZ + 1.3], size: 1.0, times: [17.84, 18.3, 18.76], color: '#fff6da' },
  { id: 'r_ping', at: [-.6, 3.6, -3.4], size: 2.0, times: [31.92, 32.12, 32.34], color: '#bfe8ff' },
];
export const ANIM = { cam: { surfaceY: 56, surface: SEAMS.surface, restUntil: 3.7 }, ram: 8.04, jolt: 8.72, sink: [10.04, 11.44], land: 11.44, storm: 19.46, stormFrom: 0, calm: 34.06, descend: [13.2, 14.1, 24.3, 25.7],
  lamp: [[0, .85], [8.7, .85], [11.46, .68], [21, .58], [23.5, .42], [29, .28], [33, .2], [36.0, .16], [36.02, .03], [60, .03]] };

// ---- knock clips per person
const knockClips = who => { const s = SPOT[who], out = [];
  for (const k of KNOCKS.filter(x => x.who === who)) {
    const inWorld = toBody(s.at, s.ry, s.hy, s.hand), rise = k.rise ?? 3;
    const e = { clip: 'knock', t0: +(k.t - rise / 30).toFixed(3), params: { side: s.side, to: inWorld, rise, back: k.back ?? 3, prop: s.bare ? null : 'tool_' + who, rotUp: s.rotUp, rotHit: s.rotHit, lift: s.bare ? .1 : .24 } };
    if (k.out) { e.hold = k.out.hold; e.out = k.out.out; }
    out.push(e);
  }
  return out; };
const tool = (who, o = {}) => ({ id: 'tool_' + who, kind: 'hammer', owner: who, in: 'hand:' + SPOT[who].side, rot: SPOT[who].rotUp, ...o });
const ringsOf = who => { const s = SPOT[who], ks = KNOCKS.filter(k => k.who === who && (k.t < 17.8 || k.t > 19) && k.ring !== false);
  const keys = []; for (const k of ks) keys.push({ t: k.t, a: 0 }, { t: +(k.t + .034).toFixed(3), a: 1, ease: k.soft ? .22 : .3 });
  return { id: 'r_' + who, kind: 'knockfx', in: 'world', at: s.head, size: s.ring, a: 1, keys }; };
const ringExtra = r => { const keys = []; for (const t of r.times) keys.push({ t, a: 0 }, { t: +(t + .034).toFixed(3), a: 1, ease: .32 }); return { id: r.id, kind: 'knockfx', in: 'world', at: r.at, size: r.size, color: r.color, a: 1, keys }; };

const F = (t, eyes, brow, mouth, react = false, x = {}) => ({ t, eyes, brow, mouth, react, ...x });
const sit = { clip: 'sit', t0: 0, params: { seat: .55 } };
const push = (a, b, ta, fov = 26, roll, tb = null) => ({ move: 'push', from: { pos: a, target: ta, fov }, to: { pos: b, target: tb || ta, fov }, roll });
const U = (x, y, z) => [UX + x, y, UZ + z], S = (x, y, z) => [SX + x, y, SZ + z], B = (x, y, z) => [BX + x, y, BZ + z], D = (x, y, z) => [TX + x, y, TZ + z];


export default {
  _doc: 'S-4 pass 1. Nobody speaks on screen: the narrator carries the words, the faces act them, the six men and the diver knock on the words.',
  fps: 30, size: [1080, 1920], duration: 39.4, endHold: 2.1, tail: 3.2,
  world: { set: 's4_env', setOpts: { anim: ANIM, post: { ...makePost(ANIM), shade: makeShade(ANIM) } } },
  cast: {
    kid:    { spec: 's4_kid',    at: SPOT.kid.at,   ry: SPOT.kid.ry },
    lt:     { spec: 's4_lt',     at: SPOT.lt.at,    ry: SPOT.lt.ry },
    chief:  { spec: 's4_chief',  at: SPOT.chief.at, ry: SPOT.chief.ry },
    big:    { spec: 's4_big',    at: SPOT.big.at,   ry: SPOT.big.ry },
    wire:   { spec: 's4_wire',   at: SPOT.wire.at,  ry: SPOT.wire.ry },
    cook:   { spec: 's4_cook',   at: SPOT.cook.at,  ry: SPOT.cook.ry },
    skipper:{ spec: 's4_skipper', at: [SX + 3, SZ + 3.4], ry: 15 },
    smug:   { spec: 's4_smuggler', at: [BX - 1, BZ + 1.2], ry: 12 },
    navy:   { spec: 's4_navy',   at: SPOT.navy.at,  ry: SPOT.navy.ry },
    dvdeck: { spec: 's4_diver1', at: [TX + 9.8, TZ + 2.2], ry: -150 },
    diver1: { spec: 's4_diver1', at: SPOT.diver1.at, ry: SPOT.diver1.ry },
    fall1:  { spec: 's4_diver1', at: [UX + 12, UZ + 3.4], ry: 18 },
    diver2: { spec: 's4_diver2', at: [UX + 6, UZ - 20], ry: -35 },
    fall2:  { spec: 's4_diver2', at: [UX + 18, UZ - 5.6], ry: -22 },
  },
  voice: { file: 'voice/vo_trimmed.wav', words: 'voice/words.json', lines: [
    { who: null, text: 'Six men tapped, "Is there any hope", from inside a sunken submarine.' },
    { who: null, text: "It's 1927, and a Coast Guard ship chasing whiskey smugglers off Cape Cod rams the S4 as she surfaces." },
    { who: null, text: 'She drops 30 meters to the seabed with 40 men aboard.' },
    { who: null, text: 'A diver goes down and knocks on the hull,' },
    { who: null, text: 'and from the torpedo room comes six slow knocks back.' },
    { who: null, text: "Then a winter storm hits, and the divers can't go back down." },
    { who: null, text: 'So the six start tapping.' },
    { who: null, text: '"Hurry. Air is very bad."' },
    { who: null, text: 'One diver fights its way down with an air hose, gets snagged in the wreck, and has to be rescued himself.' },
    { who: null, text: 'Then the question comes, "Is there any hope?"' },
    { who: null, text: 'And the Navy pings back, "There is hope. Everything possible is being done."' },
    { who: null, text: 'By the time the storm cleared, the knocking had stopped.' },
  ] },
  props: [
    tool('kid', { keys: [ { t: 36.0, in: 'world', at: [-1.45, .05, 2.1], rot: [90, 30, 70] } ] }),
    tool('lt'), tool('chief', { wrench: 1 }), tool('big', { wrench: 1 }), tool('wire'), tool('cook'),
    { id: 'tool_diver1', kind: 'hammer', wrench: 1, owner: 'diver1', in: 'hand:R', rot: SPOT.diver1.rotUp },
    { id: 'bottle', kind: 'bottle', owner: 'smug', in: 'hand:R', color: '#7a4a1e', label: '#e8dcc0', rot: [0, 0, 0] },
    { id: 'osc', kind: 'oscillator', in: 'world', at: [TX + 7.0, 0, TZ + 2.4], rot: [0, 150, 0] },
    { id: 'hose1', kind: 'airhose', owner: 'diver1', in: 'body', at: [0, 1.75, -.34] },
    { id: 'hoseF1', kind: 'airhose', owner: 'fall1', in: 'body', at: [0, 1.75, -.34] },
    { id: 'hoseF2', kind: 'airhose', owner: 'fall2', in: 'body', at: [0, 1.75, -.34] },
    { id: 'hose2', kind: 'airhose', owner: 'diver2', in: 'body', at: [0, 1.75, -.34], snag: 0, keys: [ { t: 'line:9.word:12', snag: 1 } ] },
    ...['kid', 'lt', 'chief', 'big', 'wire', 'cook', 'diver1', 'navy'].map(ringsOf), ...RING_EXTRA.map(ringExtra),
  ],
  acts: {
    kid: { blink: { busy: [[35.6, 40]] }, clips: [ sit, ...knockClips('kid'),
        { clip: 'react', t0: 8.74, params: { kind: 'jolt', deg: 9, hold: 18, back: 8 } },
        { clip: 'react', t0: 28.9, params: { kind: 'slump', deg: 9, hold: 60, back: 12 } },
        { clip: 'react', t0: 36.0, params: { kind: 'slump', deg: 16, hold: 300, back: 10, eyes: null }, settled: true } ],
      face: [ F(0, 'wide', 'worried', 'tight'),
        F('line:1.word:4', 'stare', 'worried', 'tight'),
        F('line:1.word:8', 'wide', 'worried', 'tight'),
        F(8.72, 'wide', 'up', 'grid'), F(10.1, 'wide', 'worried', 'o'),
        F(11.5, 'pinpoint', 'worried', 'grid'),
        F('line:5.word:1+0.06', 'wide', 'up', 'tight'), F('line:5.word:5', 'open', 'up', 'smile'),
        F('line:5.word:6+0.1', 'stare', 'knit', 'tight'),
        F('line:7.word:1', 'wide', 'knit', 'tight'), F(23.0, 'half', 'worried', 'frown'),
        F('line:10.word:1', 'half', 'worried', 'frown'), F('line:10.word:5', 'sad', 'worried', 'tight'),
        F(31.94, 'wide', 'up', 'o'), F('line:11.word:8', 'open', 'up', 'smile'), F(33.6, 'half', 'worried', 'smile'),
        F(36.0, 'blink', 'worried', 'rest') ],
      look: [ { t: 'line:1.word:8', at: [-.6, 3.2, 4.0] }, { t: 'line:3.word:8', at: [.2, 3.2, 4.2] }, { t: 'line:5.word:1+0.03', at: [-1.2, 3.4, 5.0] }, { t: 'line:5.word:6', at: [-2.8, 1.9, 5.0] },
        { t: 'line:10.word:1', at: [-3, 1.5, 5.0] }, { t: 31.9, at: [.2, 3.4, 4.0] }, { t: 32.7, at: [1.8, 2.2, 4.0] }, { t: 36.0, at: [-.6, 1.0, 4.0], gaze: false } ] },
    lt: { clips: [ ...knockClips('lt'), { clip: 'react', t0: 8.74, params: { kind: 'recoil', deg: 12, hold: 18, back: 8 } }, { clip: 'shock_pop', t0: 16.46, params: { eyes: 'wide' } } ],
      face: [ F(0, 'open', 'knit', 'flat'), F(8.72, 'wide', 'knit', 'grid'), F(11.5, 'open', 'knit', 'flat'),
        F('line:5.word:1+0.2', 'stare', 'up', 'tight'), F('line:7.word:1', 'angry', 'knit', 'flat'), F('line:8.word:1', 'angry', 'knit', 'grid'), F('line:8.word:2+0.3', 'half', 'worried', 'frown'),
        F(31.96, 'open', 'up', 'flat'), F(33.4, 'half', 'worried', 'flat') ],
      look: [ { t: 2.0, at: [-.8, 2.0, 5.0] }, { t: 11.5, at: [-.8, 3.4, 4.5] }, { t: 22.7, at: [-1.8, 2.9, 4.5] } ] },
    chief: { clips: [ sit, ...knockClips('chief'), { clip: 'react', t0: 8.76, params: { kind: 'jolt', deg: 10, hold: 18, back: 8 } },
        { clip: 'react', t0: 23.5, params: { kind: 'slump', deg: 14, hold: 22, back: 8 } }, { clip: 'raise_prop', t0: 23.48, params: { side: 'R', to: 'chest', frames: 3, antic: 1 }, hold: .55, out: 6 }, { clip: 'shake', t0: 23.6, params: { side: 'R', count: 5, amp: .07, twist: 3 } },
        { clip: 'stand_up', t0: 30.9, params: { from: 'sit', fwd: 0.3 } },
        { clip: 'grab_collar', at: 'line:11.word:9+0.04', params: { side: 'R', target: 'kid', reach: 7, jerk: false }, hold: 1.0, out: 8 } ],
      walk: [ { t0: 31.92, path: [[.28, 1.34]], speed: 2.6, speedExact: true, face: -55 }, { t0: 34.3, path: [[1.6, 1.8]], speed: 1.4, slow: true, face: -10 } ],
      face: [ F(0, 'half', 'down', 'frown'), F(2.2, 'open', 'worried', 'frown'), F(8.72, 'wide', 'worried', 'grid'), F(11.5, 'open', 'knit', 'frown'),
        F('line:5.word:1+0.1', 'wide', 'up', 'o'), F('line:5.word:5', 'arc', 'up', 'smile', false, { hold: true }), F('line:6.word:1', 'open', 'knit', 'flat'),
        F(23.44, 'half', 'worried', 'frown'), F(23.54, 'wince', 'knit', 'grid'), F(24.2, 'half', 'worried', 'frown'), F(31.96, 'open', 'up', 'flat'), F('line:11.word:9', 'sad', 'up', 'smile') ],
      look: [ { t: 2.0, at: [-.9, 2.2, 4.8] }, { t: 'line:5.word:1+0.04', at: [-.9, 3.4, 4.6] }, { t: 'line:11.word:8', at: [-1.2, 1.6, 4.2] } ] },
    big: { clips: [ ...knockClips('big'), { clip: 'react', t0: 8.73, params: { kind: 'recoil', deg: 14, hold: 18, back: 8 } } ],
      walk: [ { t0: 34.2, path: [[2.3, -3.3]], speed: 1.6, slow: true, face: -10 } ],
      face: [ F(0, 'open', 'knit', 'frown'), F(8.72, 'wide', 'worried', 'o'), F(11.5, 'open', 'worried', 'frown'), F('line:5.word:1+0.14', 'stare', 'up', 'tight'), F(23.5, 'half', 'worried', 'frown'), F(31.96, 'open', 'up', 'flat') ],
      look: [ { t: 2.0, at: [-.6, 2.4, 2.6] } ] },
    wire: { clips: [ ...[sit], ...knockClips('wire'), { clip: 'react', t0: 8.75, params: { kind: 'jolt', deg: 10, hold: 18, back: 8 } }, { clip: 'react', t0: 36.0, params: { kind: 'slump', deg: 14, hold: 300, back: 8 }, settled: true } ],
      face: [ F(0, 'open', 'worried', 'tight'), F(8.72, 'wide', 'up', 'grid'), F(11.5, 'pinpoint', 'worried', 'tight'), F('line:5.word:1+0.2', 'wide', 'up', 'o'), F(22.8, 'half', 'worried', 'tight'), F(31.96, 'open', 'up', 'flat'), F(36.0, 'blink', 'worried', 'rest') ], blink: { busy: [[35.6, 40]] },
      look: [ { t: 2.0, at: [-.8, 2.0, 3.6] } ] },
    cook: { clips: [ ...knockClips('cook'), { clip: 'react', t0: 8.74, params: { kind: 'recoil', deg: 12, hold: 18, back: 8 } } ],
      face: [ F(0, 'wide', 'worried', 'frown'), F(8.72, 'wide', 'up', 'o'), F(11.5, 'wide', 'worried', 'frown'), F('line:5.word:1+0.1', 'wide', 'up', 'o'), F(31.96, 'open', 'up', 'flat') ],
      look: [ { t: 2.0, at: [-.8, 2.2, 6.4] } ] },
    skipper: { clips: [ { clip: 'point', at: 'line:2.word:11+0.15', params: { side: 'R', dir: [.2, .15, 1] }, hold: .5, out: 6 } ],
      face: [ F(0, 'smug', 'on', 'smirk'), F('line:2.word:11+0.07', 'wide', 'up', 'o', 'recoil'), F('line:2.word:13', 'wide', 'knit', 'grid') ],
      look: [ { t: 3.6, at: [SX + 5.5, 2.6, SZ + 7] } ] },
    smug: { clips: [ { clip: 'raise_prop', at: 'line:2.word:9', params: { side: 'R', to: 'up', prop: 'bottle', rot: [0, 0, -6] } } ],
      face: [ F(0, 'arc', 'up', 'crescent', false, { hold: true }), F('line:2.word:10+0.2', 'look_l', 'up', 'o'), F(7.0, 'wide', 'up', 'o') ] },
    navy: { clips: [ ...knockClips('navy'), { clip: 'brace', t0: 19.5, params: { side: 'R', eyes: 'wince' } , hold: .5, out: 6 },
        { clip: 'point', at: 'line:6.word:9', params: { side: 'R', dir: [-.5, .1, .6] }, hold: .55, out: 5 } ],
      face: [ F(0, 'open', 'knit', 'tight'), F(19.48, 'wince', 'knit', 'grid'), F('line:6.word:9', 'angry', 'knit', 'flat'), F(30.84, 'open', 'knit', 'tight'), F('line:11.word:4', 'stare', 'knit', 'tight'), F(34.1, 'open', 'up', 'smile'), F(34.7, 'open', 'worried', 'flat') ],
      look: [ { t: 19.0, at: [TX + 9.8, 2.6, TZ - 3] } ] },
    dvdeck: { clips: [ { clip: 'react', at: 'line:6.word:10', params: { kind: 'slump', deg: 11, hold: 26, back: 10 } } ],
      face: [ F(0, 'angry', 'knit', 'flat'), F('line:6.word:10+0.0', 'sad', 'worried', 'frown'), F(34.06, 'open', 'up', 'rest') ],
      look: [ { t: 19.9, at: [TX + 8, 2.4, TZ - 2] } ] },
    fall1: { face: [ F(0, 'open', 'knit', 'flat') ], clips: [ { clip: 'lean_over', t0: 12, params: { deg: 4 } } ] },
    fall2: { face: [ F(0, 'angry', 'knit', 'grid') ], clips: [ { clip: 'lean_over', t0: 22, params: { deg: 8 } } ],
      base: { 'body.lean': [[24.3, -5, 'careful'], [24.8, 5, 'careful'], [25.3, -4, 'careful'], [25.7, 3, 'careful']] } },
    diver1: { clips: [ ...knockClips('diver1'), { clip: 'grab_collar', t0: 28.2, params: { side: 'L', target: 'diver2', reach: 4 }, hold: .55, out: 8 } ],
      walk: [ { t0: 19.6, path: [[UX + 9, UZ - 5]], speed: 2.2, speedExact: true, settle: false },
              { t0: 26.86, path: [[UX + 2.4, UZ - 8.7]], speed: 6.0, speedExact: true, face: -70 },
              { t0: 29.25, path: [SPOT.diver1.at], speed: 2.4, speedExact: true, face: SPOT.diver1.ry } ],
      face: [ F(0, 'open', 'knit', 'flat'), F('line:4.word:6', 'open', 'knit', 'tight'), F(16.0, 'half', 'down', 'flat'),
        F(17.86, 'wide', 'up', 'o'), F(18.32, 'wide', 'up', 'smile'), F(18.78, 'arc', 'up', 'crescent', false, { hold: true }),
        F(28.2, 'angry', 'knit', 'grid'), F(35.28, 'open', 'up', 'tight'), F(35.9, 'sad', 'worried', 'frown') ],
      look: [ { t: 14.0, at: [UX - 2.4, 2.4, UZ + 3.8] }, { t: 28.1, at: [UX + .6, 2.5, UZ - 3.6] }, { t: 35.0, at: [UX - 2.6, 2.6, UZ + 3.6] } ] },
    diver2: { clips: [ { clip: 'react', at: 'line:9.word:12+0.03', params: { kind: 'jolt', deg: 14, hold: 12, back: 6 } },
        { clip: 'point', at: 'line:9.word:12+0.2', params: { side: 'R', dir: [-.6, .5, .3] }, hold: .5, out: 5 },
        { clip: 'shake', at: 'line:9.word:15', params: { side: 'L', count: 4, amp: .1 } } ],
      walk: [ { t0: 24.3, path: [[UX + 4.2, UZ - 8.4]], speed: 9, speedExact: true, settle: false }, { t0: 25.64, path: [[UX + .5, UZ - 9.1]], speed: 3.7, speedExact: true, face: -35 }, { t0: 29.2, path: [[UX + 6, UZ - 20]], speed: 3, speedExact: true } ],
      face: [ F(0, 'angry', 'knit', 'flat'), F('line:9.word:12', 'wide', 'up', 'grid'), F('line:9.word:15', 'wince', 'knit', 'grid'), F(28.26, 'wide', 'up', 'o'), F(28.6, 'sad', 'up', 'smile') ],
      look: [ { t: 26.62, at: [UX - .6, 2.3, UZ - 3.5] }, { t: 28.2, at: [UX + 1.8, 2.5, UZ - 3.5] } ] },
  },
  shots: SHOTS,
  captions: 'words',
};
