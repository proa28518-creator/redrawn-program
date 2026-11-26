// scenes/post.js — POST PASS: per-place post processing (world/look/post.js settings as data).
// Five places, five looks (BIBLE colour script): the camera cuts between places, so there are
// no `moves` and no `states` — every change of place is a hard cut and wears its own look whole.
// Numbers start from references/quality-bar.md's dark-interior row (density ~.03, aperture
// 26-30, bloom ~.3 over .75, 1,000+ dust, gamma .84 / contrast 1.12 / vignette), halved air and
// a gentler aperture only where a place is genuinely brighter (studio window light, lab).
// Characters are never in a filter: the pipeline draws them on top, untouched, after DOF —
// faces stay the sharpest thing in every frame. Pure in t: particles are seed + t only.
export const makePost = (A = {}) => ({
  quality: 'auto', maxBlur: 26, blend: .14,
  zones: {
    interrogation: [0, 0],
    collection: [400, 0],
    studio: [-400, 0],
    lab: [400, -400],
    courtroom: [-400, -400],
  },
  places: {
    // Cold dread: desaturated blue-grey, cigarette-smoke haze thickening down the 28 D
    // corridor, one hard warm lamp pool the only warm thing. The far end must melt away.
    interrogation: {
      air: { density: .03, start: [.4, 6], far: 42, color: [.010, .012, .016], lights: .30, g: .24, noise: .35, noiseScale: .35, noiseSpeed: .05 },
      dof: { aperture: 28, nearK: .55, dead: .4 },
      bloom: { k: .3, thr: .75 },
      grade: { gamma: .84, contrast: 1.14, saturation: .92, gr: .96, gg: 1.0, gb: 1.10, vignette: Math.PI / 4.4 },
      particles: [
        { mode: 'box', count: 1250, box: [16, 6.5, 26], vel: [.03, -.010, .02], size: .0052, color: [.82, .86, .95], lit: 1.8, sway: .12, swaySpeed: .25, nearFade: [.4, 1.6] },
        { mode: 'box', count: 450, box: [7, 4.5, 9], vel: [.05, -.02, .03], size: .0038, color: [1, .88, .68], lit: 2.2, sway: .08, swaySpeed: .4, nearFade: [.4, 1.4] },
      ],
    },
    // Treasure gloom: bottle-green murk, gold chandelier light hanging in it, the painting
    // the warmest glow in the room. Bloom a touch stronger so gilt and canvas bloom.
    collection: {
      air: { density: .032, start: [.4, 6], far: 44, color: [.008, .014, .009], lights: .30, g: .30, noise: .22, noiseScale: .3, noiseSpeed: .03 },
      dof: { aperture: 28, nearK: .55, dead: .4 },
      bloom: { k: .34, thr: .72 },
      grade: { gamma: .85, contrast: 1.13, saturation: 1.02, gr: 1.03, gg: 1.0, gb: .93, vignette: Math.PI / 4.5 },
      particles: [
        { mode: 'box', count: 1150, box: [18, 7, 28], vel: [.02, -.008, .015], size: .005, color: [1, .9, .7], lit: 2.0, sway: .1, swaySpeed: .2, nearFade: [.4, 1.6] },
      ],
    },
    // The warmest place: Vermeer's golden-ochre palette, north-window daylight. Air halved
    // against the dark-interior row so the window light stays golden, not a grey veil;
    // dust motes bright in the window light, paint flecks near the easel.
    studio: {
      air: { density: .016, start: [1, 7], far: 46, color: [.016, .012, .007], lights: .26, g: .34, noise: .18, noiseScale: .3, noiseSpeed: .03 },
      dof: { aperture: 20, nearK: .5, dead: .4 },
      bloom: { k: .26, thr: .78 },
      grade: { gamma: .95, contrast: 1.08, saturation: 1.12, gr: 1.05, gg: 1.0, gb: .92, vignette: Math.PI / 4.8 },
      particles: [
        { mode: 'box', count: 1350, box: [17, 7, 26], vel: [.04, -.012, .02], size: .0055, color: [1, .93, .76], lit: 2.1, sway: .14, swaySpeed: .3, nearFade: [.4, 1.6] },
        { mode: 'box', count: 350, box: [6, 4, 7], vel: [.02, .015, .02], size: .0032, color: [1, .85, .55], lit: 1.7, sway: .2, swaySpeed: .5, nearFade: [.4, 1.2] },
      ],
    },
    // Clinical: cold white and glass-green, the only modern look. Clean air — density low,
    // dust sparse — with one breath of vapour rising off the heated sample at the bench.
    lab: {
      air: { density: .014, start: [.5, 6], far: 42, color: [.012, .016, .015], lights: .20, g: .15, noise: .12, noiseScale: .4, noiseSpeed: .04 },
      dof: { aperture: 24, nearK: .55, dead: .4 },
      bloom: { k: .2, thr: .92 },
      grade: { gamma: .92, contrast: 1.10, saturation: .88, gr: .97, gg: 1.0, gb: 1.06, vignette: Math.PI / 4.8 },
      particles: [
        { mode: 'box', count: 520, box: [15, 6, 26], vel: [.02, -.008, .015], size: .0042, color: [.9, .97, .95], lit: 1.7, sway: .08, swaySpeed: .2, nearFade: [.4, 1.6] },
        { mode: 'stream', count: 260, at: [400.9, 1.45, -401.5], spread: [.3, .1, .3], vel: [.02, .22, .01], velVar: [.03, .05, .03], life: 2.6, size: .012, sizeVar: .6, grow: .05, shape: 'puff', color: [.88, .94, .96], alpha: .26, lit: .75, sway: .06, swaySpeed: .6, nearFade: [.3, 1] },
      ],
    },
    // Solemn oak and pale gold: dust hanging in the tall-window shafts, held stillness.
    // Cold-dread's sibling, not its copy — warmer murk, same deep vignette.
    courtroom: {
      air: { density: .024, start: [.4, 6], far: 46, color: [.015, .012, .008], lights: .28, g: .30, noise: .2, noiseScale: .3, noiseSpeed: .025 },
      dof: { aperture: 26, nearK: .55, dead: .4 },
      bloom: { k: .3, thr: .75 },
      grade: { gamma: .86, contrast: 1.12, saturation: .96, gr: 1.03, gg: 1.0, gb: .97, vignette: Math.PI / 4.5 },
      particles: [
        { mode: 'box', count: 1200, box: [18, 8, 28], vel: [.015, -.007, .012], size: .0052, color: [1, .94, .8], lit: 1.9, sway: .09, swaySpeed: .18, nearFade: [.4, 1.6] },
      ],
    },
  },
});
