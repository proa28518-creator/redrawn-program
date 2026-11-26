// scenes/film.js — PILOT: beat 1 only (lines 1–7, ~0–15.3 s), Build pass.
// Frame 0 is the bible's opening frame: the hero's shocked face big, the bottle already in his raised
// right hand with the first white line of ice in it. The knock is the put_down's guard snap on خبط.
// The bottle's freeze state (front/frost/white) and the inside place's front (world.setOpts.frontKeys)
// are driven by the same beats. The film ends on a face (the engine's endFraming rule + the bible's
// "the last frame is a face"). Voice words: scenes/pilot-words.json (lines 1–7 of audio/clean.json).
export default {
  fps: 30, size: [1080, 1920],
  world: { set: 'own', setOpts: { frontKeys: [[0, 3], [3.73, 15], [12.86, 15], [14.81, 27]] } },
  cast: { hero: { spec: 'cast/hero.json', at: [-2.4, 2.4], ry: 12 } },
  voice: {
    file: 'audio/clean.wav', words: 'scenes/pilot-words.json',
    lines: [
      { who: 'hero', text: 'خبط الإزازة على الترابيزة' },
      { who: 'hero', text: 'وفجأة خط أبيض جري جوه المية' },
      { who: 'hero', text: 'رفعها قدام عينه' },
      { who: 'hero', text: 'ولقى التلج بيزحف من فوق لتحت' },
      { who: 'hero', text: 'كأن حد داس على زرار التجميد' },
      { who: 'hero', text: 'من ثانية كانت المية بتتحرك عادي' },
      { who: 'hero', text: 'ودلوقتي الإزازة بتتملي بلورات تجميد' },
    ],
  },
  acts: {
    hero: {
      face: [
        { t: 0, brow: 'up', eyes: 'wide', mouth: 'o' },
        { t: 'line:1.word:2', brow: 'up', eyes: 'wide', mouth: 'open' },
        { t: 'line:2.start', brow: 'up', eyes: 'wide', mouth: 'open' },
        { t: 'line:3.start', brow: 'up', eyes: 'wide', mouth: 'open' },
        { t: 'line:4.start', brow: 'up', eyes: 'wide', mouth: 'flat' },
        { t: 'line:5.start', brow: 'up', eyes: 'wide', mouth: 'smile' },
        { t: 'line:6.start', brow: 'mid', eyes: 'round', mouth: 'flat' },
        { t: 'line:7.end', brow: 'up', eyes: 'wide', mouth: 'o' },
      ],
      look: [
        { t: 'line:1.word:1', at: [-2.4, 1.3, 0.95], dip: 0.5 },
        { t: 'line:3.start', at: [-2.1, 1.9, 2.85], dip: 0.35 },
        { t: 'line:5.start', at: [0, 2.2, 14] },
        { t: 'line:6.start', at: [-2.15, 1.75, 2.8], dip: 0.3 },
      ],
      clips: [
        { clip: 'carry', at: 0, params: { prop: 'bottle', side: 'R' } },
        { clip: 'put_down', at: 'line:1.word:1', params: { prop: 'bottle', side: 'R', at: [-2.4, 1.34, 0.95], reach: 5, release: 2, back: 8 } },
        { clip: 'pick_up', at: 'line:3.start', params: { prop: 'bottle', side: 'R', at: [-2.4, 1.34, 0.95], reach: 7, grab: 2, lift: 6 } },
        { clip: 'point', at: 'line:5.word:2', hold: 8, out: 6, params: { side: 'L', dir: [-0.2, -1, 0.55] } },
        { clip: 'shake', at: 'line:6.word:2', params: { side: 'R' } },
      ],
    },
  },
  props: [
    { id: 'bottle', kind: 'bottle_ice', owner: 'hero', in: 'hand:R', rot: [0, 0, 0.5], keys: [
      { t: 0, front: 0.22, frost: 0, white: 0 },
      { t: 'line:3.start', front: 0.55, frost: 0.15 },
      { t: 'line:4.end', front: 0.55, frost: 1 },
      { t: 'line:6.start', front: 0, frost: 0, white: 0 },
      { t: 'line:7.start', front: 0.55, frost: 1 },
    ] },
  ],
  shots: [
    { t0: 0, t1: 'line:2.start', camera: { move: 'push', from: { pos: [-1.85, 2.4, 11.2], target: [-2.4, 2.05, 2.4], fov: 26 }, to: { pos: [-1.95, 2.35, 10.1], target: [-2.4, 2.05, 2.4], fov: 26 } } },
    { t0: 'line:2.start', t1: 'line:3.start', camera: { move: 'park', pos: [-397.2, 17.5, 1.8], target: [-400.8, 8.5, -0.5], fov: 26 } },
    { t0: 'line:3.start', t1: 'line:5.start', camera: { move: 'push', from: { pos: [-0.9, 2.5, 9.6], target: [-2.35, 2.0, 2.45], fov: 26 }, to: { pos: [-1.1, 2.45, 8.8], target: [-2.35, 2.0, 2.45], fov: 26 } } },
    { t0: 'line:5.start', t1: 'line:6.start', camera: { move: 'park', pos: [0.8, 2.7, 12.8], target: [-2.5, 1.8, 1.6], fov: 28 } },
    { t0: 'line:6.start', t1: 'line:7.start', camera: { move: 'push', from: { pos: [-1.5, 2.2, 7.6], target: [-2.35, 1.95, 2.4], fov: 24 }, to: { pos: [-1.7, 2.15, 6.9], target: [-2.35, 1.95, 2.4], fov: 24 } } },
    { t0: 'line:7.start', t1: 'line:7.end', camera: { move: 'park', pos: [-397.3, 18, 1.6], target: [-400.6, 13, -0.3], fov: 26 } },
    { t0: 'line:7.end', t1: 99, camera: { move: 'park', pos: [-2.0, 2.3, 10.6], target: [-2.4, 2.05, 2.4], fov: 26 } },
  ],
  captions: 'words',
};
