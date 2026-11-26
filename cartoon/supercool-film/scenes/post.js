// scenes/post.js — what each place of the supercool-water film gets from world/look/post.js.
// Plain data (makePost), passed as world.setOpts.post in film.js. Rows follow
// references/quality-bar.md: the kitchen is a bright interior by day (half the dark-interior
// density, far = the room's length), the freezer a cold interior, the bottle a water world
// (the S-4 'bed' row: shafts, silt, bubbles).
const VIG = Math.PI / 4.6;

export const makePost = () => ({
  quality: 'auto', maxBlur: 26, blend: .14,
  zones: { kitchen: [-2.4, 2.4], freezer: [400, 1.4], inside: [-400, 0] },
  moves: [],
  focus: [
    [1.7, 4.5, [-399.3, 9, 0.3]], [12.86, 14.81, [-399.3, 15, 0.3]],
    [28.9, 31.5, [-398.7, 5.5, 0.6]], [31.5, 34.6, [-399.5, 11, 0]],
    [43.48, 46.31, [-399.3, 7.5, 0.3]], [46.31, 48.89, [-399.5, 13, 0]],
    [38.34, 40.98, 'hero'],
  ],
  places: {
    kitchen: {
      air: { density: .012, start: [3, 10], far: 26, heightK: .3, heightFall: -.4, floor: 4.4, color: [.012, .010, .007], lights: .3, g: .2, noise: .25, noiseScale: .3, noiseSpeed: .06 },
      dof: { aperture: 26, nearK: .45, dead: .45 },
      bloom: { k: .38, thr: .7 },
      grade: { gamma: 1.02, contrast: 1.06, saturation: 1.12, gr: 1.03, gb: .95, vignette: Math.PI / 3.8 },
      particles: [
        { mode: 'box', count: 1100, box: [16, 5, 20], vel: [.02, -.008, .01], velVar: [.04, .02, .04], sway: .3, swaySpeed: .12, size: .0065, sizeVar: 1.4, color: [1, .92, .78], alpha: .95, lit: 1.9, ambient: .012, twinkle: .5, nearFade: [1.4, 3.2], farFade: .03 },
      ],
    },
    freezer: {
      air: { density: .03, start: [1, 5], far: 12, color: [.006, .010, .018], lights: .35, g: .15, noise: .3, noiseScale: .35, noiseSpeed: .05 },
      dof: { aperture: 20, nearK: .5, dead: .4 },
      bloom: { k: .35, thr: .7 },
      grade: { gamma: .95, contrast: 1.08, saturation: .95, gb: 1.08, vignette: VIG },
      particles: [
        { mode: 'box', count: 500, box: [10, 4.4, 10], vel: [.01, -.02, .01], velVar: [.02, .02, .02], sway: .2, swaySpeed: .1, size: .005, sizeVar: 1.2, color: [.85, .93, 1], alpha: .8, lit: 1.5, ambient: .008, twinkle: .5, nearFade: [1.2, 2.6], farFade: .03 },
      ],
    },
    inside: {
      air: { density: .02, start: [.5, 3], far: 40, color: [.003, .014, .019], lights: .2, g: .15, top: 30, absorb: .008, noise: .3, noiseScale: .12, noiseSpeed: .05, perLight: { shaft: .15, frontglow: .4 } },
      dof: { aperture: 3.5, nearK: .25, dead: .55 },
      bloom: { k: .12, thr: .85 }, gain: 1.2,
      grade: { gamma: 1.0, contrast: 1.12, saturation: 1.15, gr: .93, gg: .98, gb: 1.05, vignette: VIG },
      particles: [
        { mode: 'box', count: 900, box: [10, 28, 10], vel: [.02, -.02, .02], velVar: [.04, .03, .04], sway: .3, swaySpeed: .2, size: .013, sizeVar: 1.6, color: [.82, .95, 1], alpha: .95, lit: 2, ambient: .01, twinkle: .35, nearFade: [1.2, 3], farFade: .02 },
        { mode: 'stream', count: 260, at: [-400, .5, 0], spread: [6, 0, 6], vel: [0, 3.2, 0], speedVar: .45, life: 7, size: .034, sizeVar: 2.4, shape: 'bubble', sway: .22, swaySpeed: 2.2, color: [.9, 1, 1], alpha: .95, lit: 2.2, ambient: .05, nearFade: [1.6, 4] },
        { mode: 'stream', count: 140, at: [-399, .5, 1], spread: [3.5, 0, 3.5], vel: [0, 2.6, 0], speedVar: .4, life: 8, size: .03, sizeVar: 2.2, shape: 'bubble', sway: .2, swaySpeed: 2, color: [.9, 1, 1], alpha: .95, lit: 2.2, ambient: .05, nearFade: [1.6, 4] },
      ],
    },
  },
});
