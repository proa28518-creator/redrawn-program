// scenes/shade.js — SHADING PASS: characters and props lit by their place
// (world/look/rigshade.js settings as data; same zone names as scenes/post.js).
// The one big gain, per place: key and shadow as TWO colours — a warm key from the side the
// set's real light is on (the rig samples it), a coloured shadow side that is never the
// key's grey. Interrogation and court stay cold-dread, the studio is the film's warm home,
// the lab is clinical. A floor + keyMin per place keeps faces out of the mud; the shadow
// side carries warmth where a face is backlit (court). Pure in t; `steps` sit exactly on
// the place-change cuts so the smoothing never reads across a hard change of light.
export const makeShade = (A = {}) => ({
  zones: {
    interrogation: [0, 0],
    collection: [400, 0],
    studio: [-400, 0],
    lab: [400, -400],
    courtroom: [-400, -400],
  },
  // Hard light changes, all on cuts (line starts, BIBLE times): L5 collection 12.64,
  // L8 interrogation 19.94, L15 collection 33.05, L17 interrogation 38.29,
  // L19 studio 44.34, L23 lab 52.44, L27 courtroom 60.11.
  steps: [12.64, 19.94, 33.05, 38.29, 44.34, 52.44, 60.11],
  moods: [
    // Line 21's timelapse (48.61–51.90): the studio light sweeps day -> evening -> day
    // across the easel. The mood dips exposure and warms the key at its middle, then the
    // out-ease hands the place settings back — an ease, never a step, inside the shot.
    { t0: 48.61, t1: 51.90, in: 1.1, out: 1.1, place: 'studio', exposure: .84, tintK: [1.12, .84, .55], tintS: [.92, .86, .8] },
  ],
  places: {
    // Cold dread: hard warm key from the hanging lamp, cold blue shadow side, a cold
    // shutter-stripe fill so the shadow never goes neutral. Strong rim against the gloom.
    interrogation: {
      exposure: .95, sat: .92, keyTint: [1, .9, .72], fillTint: [.55, .65, .85],
      hard: .68, rim: .8, low: .44, floor: [.20, .23, .30], keyMin: [.55, .52, .48],
      extra: [{ id: 'shuttercold', kind: 'sun', dir: [-.6, .3, .75], color: [.35, .45, .7], power: .32 }],
    },
    // Treasure gloom: warm chandelier key, bottle-green shadow, gilt keeps its own colour
    // (metal.keep) so the frames read as gold, not as green glass.
    collection: {
      exposure: 1.0, sat: .95, keyTint: [1, .85, .6], fillTint: [.4, .55, .42],
      hard: .6, rim: .85, low: .42, floor: [.16, .20, .15], keyMin: [.5, .46, .4],
      metal: { spec: 1.3, env: .35, keep: .62 },
    },
    // The warm home: soft golden key, umber shadow, the highest floor in the film —
    // faces here sit in Vermeer's own light and never approach mud.
    studio: {
      exposure: 1.12, sat: 1.05, keyTint: [1, .88, .66], fillTint: [.6, .48, .35],
      hard: .45, rim: .6, low: .6, floor: [.30, .26, .20], keyMin: [.7, .64, .55],
    },
    // Clinical: hard near-white key from the bench lamp, glass-green shadow, brass of
    // the microscope keeps its colour under the cold light (metal.keep high).
    lab: {
      exposure: 1.05, sat: .85, keyTint: [1.07, .96, .82], fillTint: [.40, .62, .60],
      hard: .7, rim: .7, low: .5, floor: [.24, .28, .27], keyMin: [.44, .50, .48],
      metal: { spec: 1.4, env: .4, keep: .7 },
    },
    // Cold-dread in oak and pale gold: pale-gold window key, cool shadow, the strongest
    // rim in the film — Han and the judge are backlit by the tall windows, so the shadow
    // side and the rim carry the faces.
    courtroom: {
      exposure: 1.0, sat: .94, keyTint: [1, .92, .74], fillTint: [.55, .6, .72],
      hard: .58, rim: .9, low: .48, floor: [.22, .22, .26], keyMin: [.58, .56, .5],
    },
  },
});
