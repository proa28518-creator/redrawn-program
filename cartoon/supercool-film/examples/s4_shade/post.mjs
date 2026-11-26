// films/s4_post/post.mjs: what each place of the S-4 short gets from world/look/post.js. Plain data. Times from film.mjs ANIM.
const [SX, SZ] = [400, 0], [TX, TZ] = [400, 400], [UX, UZ] = [-400, 0];
const VIG = Math.PI / 4.6;

export const makePost = A => ({
  quality: 'auto', maxBlur: 26, blend: .14,
  zones: { torpedo: [0, 0], sea: [SX, SZ], boat: [400, -400], storm: [TX, TZ], bed: [UX, UZ] },
  states: [{ from: A.calm, zone: 'storm', use: 'dawn' }, { from: 36.02, zone: 'torpedo', use: 'dark' }],
  // the flights (hidden seams). Everything else that changes place is a hard cut, and a hard cut may hit
  moves: [2.9, 3.62, 6.12, 7.04, 11.86, 15.1, 17.74, [30.8, .06], [30.94, .06], 31.8, 35.1, 36.02],
  // where the story looks, when the automatic pick (big and central) is not it
  focus: [[0, 2.15, 'kid'], [16.4, 17.5, 'kid'], [22.68, 23.4, 'lt'], [23.5, 24.3, 'chief'], [28.86, 30.62, 'kid'], [31.2, 31.66, 'navy'], [36.25, 99, 'kid']],
  places: {
    // ---- stale air and lamp glow in a dying sub. The air gets worse as the story does, the lamp hangs in it and the cage shadows its light
    torpedo: {
      air: { density: .03, start: [.4, 6], far: 40, heightK: .55, heightFall: -.55, floor: 5.4, color: [.011, .0085, .0055], lights: .28, g: .22, noise: .3, noiseScale: .28, noiseSpeed: .07,
        keys: [[0, .8], [21, 1], [29, 1.35], [35.5, 1.8]], perLight: { floor: 0, aft: .7 } },
      dof: { aperture: 30, nearK: .55, dead: .4 }, bloom: { k: .3, thr: .75 },
      grade: { gamma: .84, contrast: 1.12, saturation: 1, gr: .98, gb: 1.05, vignette: VIG },
      particles: [
        { mode: 'box', count: 1300, box: [15, 6.4, 24], vel: [.03, -.012, .02], velVar: [.05, .03, .05], sway: .32, swaySpeed: .13, size: .0052, sizeVar: 1.4, color: [1, .9, .74], alpha: .9, lit: 1.9, ambient: .012, twinkle: .55, nearFade: [1.4, 3.2], farFade: .03 },
        // what the jolt and the landing shake off the overhead: rust and paint, falling through the lamp light
        ...[A.jolt, A.land].map(h => ({ mode: 'burst', t0: h, stagger: .25, life: 1.5, count: 420, at: [0, 5.1, 3], spread: [11, .6, 15], vel: [0, -1.1, 0], velVar: [.35, .6, .35], gravity: -4.2, drag: .6, shutter: .03, size: .009, sizeVar: 2.2, sway: .09, swaySpeed: 3, color: [.86, .74, .6], alpha: 1, lit: 2.2, ambient: .02, nearFade: [1, 2.4] })),
        ...[A.jolt, A.land].map(h => ({ mode: 'burst', t0: h, stagger: .2, life: 1.9, count: 26, at: [0, 4.8, 3], spread: [10, .5, 14], vel: [0, -.55, 0], velVar: [.2, .2, .2], grow: .55, drag: .4, size: .3, sizeVar: 1, shape: 'puff', color: [.62, .54, .44], alpha: .2, lit: 1, ambient: .01, soft: .6, nearFade: [1.2, 3.5] })),
      ],
    },
    // ---- the lamp is out: almost nothing, but the dark room still has to read
    dark: {
      air: { density: .028, start: [.4, 6], far: 40, color: [.008, .012, .022], lights: .3, g: .1 }, gain: 5,
      dof: { aperture: 26, nearK: .55, dead: .4 }, bloom: { k: .2, thr: .8 },
      grade: { gamma: .62, contrast: 1.1, saturation: .75, gb: 1.1, vignette: VIG },
      particles: [ { mode: 'box', rig: 'torpedo', count: 420, box: [14, 6, 20], vel: [.01, -.03, .01], velVar: [.02, .02, .02], sway: .2, swaySpeed: .1, size: .006, sizeVar: 1, color: [.78, .86, 1], alpha: .7, lit: 1.4, ambient: .006, twinkle: .6, nearFade: [1.4, 3], farFade: .02 } ],
      rig: 'torpedo',
    },
    // ---- thirty metres of murky water: shafts from above that move, silt that drifts, bubbles that belong
    bed: {
      air: { density: .034, start: [.8, 7], far: 90, color: [.003, .015, .019], lights: 1.5, g: .25, top: 56, absorb: .035, noise: .45, noiseScale: .11, noiseSpeed: .05, keys: [[0, 1], [9.9, .34], [11.5, .34], [13.2, 1]],
        perLight: { pool: .1, side: .05 }, shafts: { surface: { scale: .065, speed: .1, depth: 1 } } },
      dof: { aperture: 28, nearK: .55, dead: .4 }, bloom: { k: .22, thr: .7 }, warp: .0011,
      grade: { gamma: .9, contrast: 1.06, saturation: .95, gg: 1.02, vignette: VIG },
      particles: [
        { mode: 'box', count: 1700, box: [24, 15, 34], vel: [.05, -.09, .03], velVar: [.07, .05, .07], sway: .34, swaySpeed: .22, size: .0065, sizeVar: 1.6, color: [.82, 1, .95], alpha: 1, lit: 2.1, ambient: .01, twinkle: .35, nearFade: [1.2, 3], farFade: .02 },
        // bubbles: thin bright rims that wobble as they rise, big ones slow to split up. From the falling men, and from the diver at the hull
        { mode: 'stream', count: 90, at: [UX + 12, -1, UZ + 3.4], spread: [5, 0, 4], vel: [0, 8, 0], speedVar: .45, life: 3.4, size: .02, sizeVar: 2.6, shape: 'bubble', sway: .24, swaySpeed: 2.3, color: [.9, 1, 1], alpha: .8, lit: 2.2, ambient: .06, nearFade: [1.6, 4] },
        { mode: 'stream', count: 90, at: [UX + 18, -1, UZ - 5.6], spread: [4.5, 0, 4], vel: [0, 8, 0], speedVar: .45, life: 3.4, size: .02, sizeVar: 2.6, shape: 'bubble', sway: .24, swaySpeed: 2.3, color: [.9, 1, 1], alpha: .8, lit: 2.2, ambient: .06, nearFade: [1.6, 4] },
        { mode: 'stream', count: 80, at: [UX - .4, -1, UZ - 1], spread: [4.5, 0, 2.6], vel: [0, 4.6, 0], speedVar: .4, life: 5.6, size: .018, sizeVar: 2.4, shape: 'bubble', sway: .22, swaySpeed: 2.3, color: [.9, 1, 1], alpha: .7, lit: 2.2, ambient: .06, nearFade: [1.6, 4] },
        // going down fast: they stream past
        ...[[A.descend[0], A.descend[1], UX + 12, UZ + 7], [A.descend[2], A.descend[3], UX + 17.4, UZ + 1]].map(([a, b, x, z]) => ({ mode: 'stream', window: [a - .1, b + .1], count: 110, at: [x, -2, z], spread: [7, 0, 7], vel: [0, 16, 0], speedVar: .4, life: 1.3, size: .02, sizeVar: 2.6, shape: 'bubble', sway: .2, swaySpeed: 3, color: [.9, 1, 1], alpha: .8, lit: 2.2, ambient: .06, nearFade: [1.6, 4] })),
        // she lands: the sand comes up in a slow wall along the hull, it covers instead of glowing
        { mode: 'burst', t0: A.land - .03, stagger: .22, life: 2.1, count: 70, at: [UX - 7.6, .4, UZ - 8], spread: [24, .6, 32], vel: [0, 1.1, 0], velVar: [3.2, 1.4, 3.2], drag: 1.3, grow: 1.5, size: 1.2, sizeVar: 1.6, shape: 'puff', color: [.62, .7, .6], alpha: .55, opaque: 1, lit: 1.05, ambient: .03, soft: 1.2, nearFade: [2, 7] },
      ],
    },
    // ---- the storm: sleet on the wind, sheets of spray over the rail, lightning hanging in the air
    storm: {
      air: { density: .017, start: [3, 26], far: 110, heightK: 1.2, heightFall: .12, floor: 0, color: [.016, .022, .03], lights: .24, g: .3, noise: .5, noiseScale: .07, noiseSpeed: 1.1, perLight: { flash: 1.5, work: 1, dawn: 0 } },
      dof: { aperture: 26, nearK: .55, dead: .4 }, bloom: { k: .26, thr: .8 },
      grade: { gamma: .86, contrast: 1.08, saturation: .85, gb: 1.06, vignette: VIG },
      particles: [
        { mode: 'box', count: 950, box: [24, 16, 30], vel: [-7.5, -17, 2.5], velVar: [1.4, 3, 1], speedVar: .25, shutter: .034, size: .0034, sizeVar: .7, minPx: .8, cocK: .12, color: [.86, .92, 1], alpha: .6, lit: 2.6, ambient: .05, nearFade: [1.5, 4], edge: 1, farFade: .012 },
        { mode: 'box', count: 240, box: [24, 12, 26], vel: [-11, -5, 2], velVar: [3, 3, 2], speedVar: .3, shutter: .02, size: .007, sizeVar: 1.4, cocK: .3, color: [.9, .95, 1], alpha: .5, lit: 2.1, ambient: .04, nearFade: [1.6, 4], edge: 1 },
        // spray blowing over the rail, all the time
        { mode: 'stream', count: 44, at: [TX + 10, .3, TZ + 3.2], spread: [40, 1.2, .5], vel: [-8, 3.2, 0], velVar: [2, 1.2, .2], gravity: -2.6, life: 1.5, grow: 1.5, size: .55, sizeVar: 1.2, shape: 'puff', color: [.78, .86, .92], alpha: .2, lit: 1.3, ambient: .06, soft: .8, nearFade: [2, 5] },
        // the storm hits: a sea breaks over the rail, droplets and a white wall of spray that hides the world behind the men and never their faces
        { mode: 'burst', t0: A.storm - .03, stagger: .12, life: 1.5, count: 420, at: [TX + 8.5, .8, TZ + 3.2], spread: [15, 1.4, .5], vel: [-3, 9.5, 0], velVar: [5.5, 4.5, .6], gravity: -13, drag: .35, shutter: .03, size: .0045, sizeVar: 2, cocK: .12, color: [.92, .96, 1], alpha: 1, lit: 2.2, ambient: .12, nearFade: [1.5, 3.5] },
        { mode: 'burst', t0: A.storm - .03, stagger: .1, life: 1.75, count: 42, at: [TX + 8.5, .4, TZ + 3.2], spread: [16, 1, .4], vel: [-2.2, 5.6, 0], velVar: [2.6, 2.4, .25], gravity: -3.2, drag: .9, grow: 2.2, size: .8, sizeVar: 1.2, shape: 'puff', color: [.84, .9, .95], alpha: .9, opaque: .85, lit: 1.5, ambient: .2, soft: .9, nearFade: [3, 6] },
      ],
    },
    // ---- the cold grey day: only distance on the air, and the ram's spray
    sea: {
      air: { density: .0028, start: [12, 90], far: 240, heightK: 1.6, heightFall: .05, floor: -8, color: [.36, .42, .47], lights: 0 },
      dof: { aperture: 24, nearK: .5, dead: .5 }, bloom: { k: .1, thr: 1.05 },
      grade: { gamma: .96, contrast: 1.05, saturation: .9, vignette: VIG },
      particles: [
        { mode: 'burst', t0: A.ram - .03, stagger: .1, life: 1.55, count: 620, at: [SX + 48, -2.6, SZ + 5], spread: [9, 3, 7], vel: [2, 21, 2], velVar: [13, 11, 12], gravity: -24, drag: .2, shutter: .016, size: .07, sizeVar: 2.4, color: [1, 1, 1], alpha: 1, opaque: .9, lit: 1.1, ambient: .1, nearFade: [2, 5] },
        { mode: 'burst', t0: A.ram - .02, stagger: .16, life: 2.2, count: 60, at: [SX + 48, -1.5, SZ + 5], spread: [7, 4, 6], vel: [1, 12.5, 1], velVar: [6.5, 6.5, 6.5], gravity: -6, drag: 1.2, grow: 2.6, size: 1.2, sizeVar: 1.1, shape: 'puff', color: [.96, .97, .98], alpha: .8, opaque: 1, lit: 1, ambient: .1, soft: 1, nearFade: [3, 8] },
      ],
    },
    boat: {
      air: { density: .0035, start: [10, 70], far: 240, heightK: 1.6, heightFall: .05, floor: -2, color: [.36, .42, .47], lights: 0 },
      dof: { aperture: 26, nearK: .5, dead: .4 }, bloom: { k: .1, thr: 1.05 },
      grade: { gamma: .96, contrast: 1.05, saturation: .9, vignette: VIG },
    },
    // ---- the low sun at dawn, right behind them: it hangs in the sea mist, the whole frame glows toward it, gold motes in the air
    dawn: {
      air: { density: .0026, start: [4, 42], far: 170, heightK: 2.2, heightFall: .16, floor: -2, color: [.2, .115, .06], lights: .1, g: .55, perLight: { work: 0, flash: 0, dawn: 1 } },
      dof: { aperture: 26, nearK: .55, dead: .4 }, bloom: { k: .22, thr: 1.1 },
      grade: { gamma: 1.02, contrast: 1.02, saturation: 1.08, gr: 1.04, gb: .96, vignette: VIG },
      rig: 'storm',
      particles: [ { mode: 'box', count: 340, box: [20, 8, 26], vel: [-.28, .05, .1], velVar: [.1, .05, .1], sway: .2, swaySpeed: .3, size: .0075, sizeVar: 1.5, color: [1, .86, .6], alpha: .75, lit: 1.3, ambient: .03, twinkle: .6, nearFade: [1.4, 3.5], farFade: .02 } ],
    },
  },
});
