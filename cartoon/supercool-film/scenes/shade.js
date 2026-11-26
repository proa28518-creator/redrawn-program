// scenes/shade.js — what each place of the supercool-water film wants from
// world/look/rigshade.js (passed as world.setOpts.post.shade in film.js).
// Kitchen: a warm key from the window/pendant side, a cooler shadow side, a rim against
// the darker corners; faces keep a warm floor so they never go to mud. The freezer corner
// (played in the kitchen) reads colder via the rig's spill light. Inside the bottle there
// are no characters; its settings only tint the world if the camera is there.
export const makeShade = () => ({
  zones: { kitchen: [-2.4, 2.4], freezer: [400, 1.4], inside: [-400, 0] },
  places: {
    kitchen: {
      exposure: 1.0, sat: 1.14, keyTint: [1, .93, .8], fillTint: [.8, .87, 1.06], hard: .82, front: .03, rim: .9, rimFill: 1.0,
      low: .42, chest: .38, floor: [.15, .18, .27], keyMin: [.32, .37, .5],
      extra: [{ id: 'win', kind: 'sun', dir: [.85, .3, .35], color: [1, .82, .6], power: 4.5 }],
      aerial: { color: [.1, .085, .06], density: .008, max: .18 },
    },
    freezer: {
      exposure: .95, sat: .9, hard: .5, rim: .6, rimFill: .5,
      low: .44, chest: .36, floor: [.26, .32, .44], keyMin: [.6, .68, .84],
      aerial: { color: [.05, .08, .13], density: .014, max: .24 },
    },
    inside: {
      exposure: .95, sat: .9, hard: .4, rim: .4, rimFill: .5,
      low: .44, chest: .34, floor: [.28, .4, .48], keyMin: [.6, .74, .8],
      aerial: { color: [.02, .12, .15], density: .02, max: .4 },
    },
  },
  moods: [
    // the twist (lines 24-28): the light warms a touch as he understands — faces lift
    { t0: 56.2, t1: 66.37, in: .8, out: 0, place: 'kitchen', exposure: 1.07, hard: .5, tintK: [1.04, 1, .94] },
  ],
});
