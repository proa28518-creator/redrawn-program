// PREVIZ ONLY (Build pass, step 2/3 checks): the hero facing camera, at 3/4, and one still per place.
// Replaced by the pilot film.js once the stills are checked; kept at harness/previz-film.js after that.
// NOTE (learned here): the engine's endFraming rule — the film's last frame must show a head of 150+ px,
// or the last head-framed shot runs to the end and the tail shot is dropped. Hence the closing button shot.
export default {
  fps: 30, size: [1080, 1920],
  world: { set: 'own', setOpts: { frontKeys: [[0, 16]] } },
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
      face: [{ t: 0, expr: 'fear' }, { t: 'line:2.start', brow: 'up', eyes: 'wide', mouth: 'open' }],
      place: [
        { t: 6, at: [400, 1.4], ry: 0 },
        { t: 8, at: [-2.4, 2.4], ry: 12 },
      ],
    },
  },
  shots: [
    { t0: 0, t1: 2, camera: { move: 'park', pos: [-2.2, 2.2, 13.2], target: [-2.4, 2.0, 2.4], fov: 26 } },
    { t0: 2, t1: 4, camera: { move: 'park', pos: [3.6, 2.3, 10.2], target: [-2.4, 2.0, 2.4], fov: 26 } },
    { t0: 4, t1: 6, camera: { move: 'park', pos: [1.5, 2.6, 7.5], target: [-5.4, 1.6, -2.2], fov: 28 } },
    { t0: 6, t1: 8, camera: { move: 'park', pos: [401.8, 2.6, 8.5], target: [400, 1.3, -0.5], fov: 28 } },
    { t0: 8, t1: 10, camera: { move: 'park', pos: [-386, 16, 6], target: [-400, 12.5, 0], fov: 26 } },
    { t0: 10, t1: 99, camera: { move: 'park', pos: [-2.2, 2.2, 13.2], target: [-2.4, 2.0, 2.4], fov: 26 } },
  ],
  captions: 'words',
};
