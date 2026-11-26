// films/s4_shade/shade.mjs: what each place of the S-4 short wants from world/look/rigshade.js. Plain data. Lights come from the set (rig.sample); `extra` are characters' own film lights.
const [SX, SZ] = [400, 0], [TX, TZ] = [400, 400], [UX, UZ] = [-400, 0];
const BRASS_W = { spec: 1.1, env: .42, keep: .62, sky: [.62, 1, .94], ground: [.03, .13, .14] };    // brass under water: a teal world above, the dark below

export const makeShade = A => ({
  zones: { torpedo: [0, 0], sea: [SX, SZ], boat: [400, -400], storm: [TX, TZ], bed: [UX, UZ] },
  states: [{ from: A.calm, zone: 'storm', use: 'dawn' }, { from: 36.02, zone: 'torpedo', use: 'dark' }],
  steps: [A.calm, 36.02],   // hard changes of light, both on a cut
  places: {
    // ---- one dying lamp: amber from above on the lamp's side, cold from the far side. The cold stays while the amber dies, so the room gets colder and more alone as the story goes on
    torpedo: { exposure: .95, sat: .95, keyTint: [1, .93, .8], hard: .62, front: .08, rim: .75, rimFill: 1.1, low: .46, chest: .4, floor: [.24, .27, .35], keyMin: [.64, .6, .56],
      extra: [{ id: 'cold', kind: 'sun', dir: [-.9, .2, .42], color: [.3, .44, .72], power: .3 }],
      aerial: { color: [.09, .068, .05], density: .012, max: .22 }, metal: { spec: 1.2, env: .3, sky: [.7, .55, .36], ground: [.05, .05, .06] } },
    // ---- the lamp is out. A cold nothing from one side, the last of the room on an edge. The grade after this is hard (gamma .62), so these numbers look high
    dark: { exposure: 1, sat: .9, hard: .5, rim: .55, rimFill: .3, low: .4, chest: .4, floor: [.3, .34, .46], keyMin: [.64, .68, .8],
      extra: [{ id: 'moon', kind: 'sun', dir: [-.55, .55, .5], color: [.35, .5, .85], power: .55 }],
      aerial: { color: [.03, .04, .07], density: .012, max: .22 } },
    // ---- 30 m of water: the only sky is straight up, teal. Under the brow is dark, water light moves on the crown, the helmets shine, and anything far away goes into the murk
    bed: { exposure: .9, sat: .62, hard: .42, rim: .35, rimFill: .5, low: .42, chest: .34, hood: .34, floor: [.3, .42, .45], keyMin: [.62, .76, .76], caustic: .22, causticScale: .75, causticSpeed: .4,
      aerial: { color: [.025, .15, .17], density: .024, max: .5 }, metal: BRASS_W },
    // ---- a cold grey noon: soft from everywhere, the sun only an edge
    sea: { exposure: 2, sat: .75, hard: .32, rim: .4, rimFill: .2, low: .66, chest: .22, floor: [.76, .8, .86], keyMin: [.94, .96, .98], aerial: { color: [.63, .68, .73], density: .005, max: .25 } },
    boat: { exposure: 2, sat: .75, hard: .32, rim: .4, rimFill: .2, low: .66, chest: .22, floor: [.76, .8, .86], keyMin: [.94, .96, .98], aerial: { color: [.63, .68, .73], density: .006, max: .25 } },
    // ---- the storm: a hard swinging deck lamp straight down, drained of its warmth, cold sky on everything else, and the lightning on the edges only (it never steers the shadow)
    storm: { exposure: 1, sat: .42, keyTint: [.94, .98, 1.06], hard: .78, front: .3, rim: .9, rimFill: 1.5, low: .42, chest: .46, hood: .3, floor: [.32, .38, .48], keyMin: [.76, .82, .9], noSteer: ['flash'],
      aerial: { color: [.16, .2, .25], density: .012, max: .28 }, metal: { spec: 1.2, env: .4, sky: [.56, .68, .84], ground: [.04, .05, .07] } },
    // ---- the dawn after it: the sun low behind them, faces in the soft warm light of the sky, gold on every edge
    dawn: { exposure: 1.05, sat: 1, hard: .22, rim: 1.25, rimFill: .4, low: .72, chest: .18, hood: .2, floor: [.88, .74, .62], keyMin: [.98, .86, .7],
      aerial: { color: [.78, .55, .38], density: .009, max: .2 }, metal: { spec: 1.5, env: .5, sky: [1, .78, .5], ground: [.28, .16, .1] } },
  },
  moods: [
    // the hook: the kid's face with the lamp close, as hard as it gets
    { t0: 0, t1: 2.3, in: 0, out: .3, place: 'torpedo', hard: .78, exposure: 1.08, who: { kid: 1.08 } },
    // the six knocks back: for a moment the room warms up
    { t0: 16.2, t1: 18.9, in: .5, out: .1, place: 'torpedo', exposure: 1.16, tintK: [1.03, 1, .95], hard: .5 },
    // "Air is very bad": the light goes sick, shadows hard, the chief can't breathe
    { t0: 21.3, t1: 24.3, in: 0, out: 0, place: 'torpedo', exposure: .82, hard: .8, tintK: [.98, 1.02, .86], tintS: [.9, 1.02, .86], low: .36 },
    { t0: 23.5, t1: 24.3, in: .1, out: 0, place: 'torpedo', exposure: .82, hard: .9 },
    // the second diver in trouble: colder, less of the sky reaches him
    { t0: 26, t1: 28.86, in: .6, out: 0, place: 'bed', exposure: .82, hard: .6 },
    // the question: the lamp has all but gone, it finds one man. The others fall away
    { t0: 28.86, t1: 30.8, in: 0, out: .2, place: 'torpedo', hard: .84, who: { kid: 1.22, '*': .72 }, floorK: .92 },
    // "There is hope": faces lift, a little warmth comes back
    { t0: 31.8, t1: 34.06, in: .4, out: 0, place: 'torpedo', exposure: 1.3, hard: .46, tintK: [1.05, 1, .92] },
    // the diver knocks and nothing answers: the water has gone cold
    { t0: 35.1, t1: 36.02, in: 0, out: 0, place: 'bed', exposure: .72, hard: .7, tintK: [.9, .98, 1.04] },
    // the last shot: nothing moves but the light going, slowly, over the whole hold
    { t0: 36.6, t1: 45, in: 2.4, out: 0, place: 'dark', floorK: .84, who: { '*': .84 }, rim: .3 },
  ],
});
