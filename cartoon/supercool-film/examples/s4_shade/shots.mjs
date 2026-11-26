// films/s4_cam/shots.mjs: pass 2, the camera. The idea: the camera goes where the sound goes. A knock crosses the steel, so the camera crosses the steel.
// The question goes up 30 m of water, the answer comes back down. Places are 400 D apart, so each crossing is a seam hidden on a frame full of steel,
// a water surface or a swish over the sea. Hard cuts stay where a hit is stronger than a glide (the jolt, "She drops", the storm, the six, the question, the dawn).
const [SX, SZ] = [400, 0], [BX, BZ] = [400, -400], [TX, TZ] = [400, 400], [UX, UZ] = [-400, 0];
const U = (x, y, z) => [UX + x, y, UZ + z], S = (x, y, z) => [SX + x, y, SZ + z], B = (x, y, z) => [BX + x, y, BZ + z], D = (x, y, z) => [TX + x, y, TZ + z];
const k = (t, pos, target, fov = 26, roll = 0, shake = 0, x = {}) => ({ t, pos, target, fov, roll, shake, ...x });
const path = (t0, t1, keys) => ({ t0, t1, camera: { move: 'path', keys } });
const on = (who, y) => ({ who, offset: [0, y, 0] });

// the sub's fall (world/s4.js: y = 44 - 39.4 g^2 over A.sink), so a camera can ride it
const subY = t => { const g = Math.max(0, Math.min(1, (t - 10.04) / 1.4)); return 44 - 39.4 * g * g; };
const fallKeys = []; for (let t = 10.02; t < 11.44; t += .1) { const y = subY(t), u = (t - 10.02) / 1.42; fallKeys.push(k(+t.toFixed(2), U(22, y + 6, -9), U(-6, y + 3.6, -9), 46, 3 - 6 * u, .4 + u)); }

export const SEAMS = { // where the picture changes place: grade.py reads the same numbers
  T: [[0, 2.9], [8.7, 10.02], [11.86, 13.26], [15.1, 17.74], [21.3, 24.3], [28.86, 30.8], [31.8, 34.06]],
  U: [[2.9, 3.62], [10.02, 11.86], [13.26, 15.1], [17.74, 19], [24.3, 28.86], [30.8, 30.94], [35.1, 36.02]],
  STORM: [[19, 21.3], [30.94, 31.8]], CALM: [[34.06, 35.1]], SEA: [[3.62, 8.7]], END: [[36.02, 99]],
  surface: [[2.9, 3.62], [30.8, 30.94]],
};

export const SHOTS = [
  // ---- the hook: the face, the hammer, then straight back through the men and out through the steel, up 30 m of water, out into 1927
  path(0, 2.9, [
    k(0, [-.95, 1.62, 6.0], [-1.2, 1.74, .95], 26, 3), k(.7, [-1.05, 1.62, 5.8], [-1.3, 1.74, .95], 26, 3.5), k(1.85, [-1.15, 1.6, 5.5], [-1.38, 1.74, .95], 26, 4),
    k(2.15, [-1.0, 1.9, 8.9], [-.9, 1.9, .6], 30, 2), k(2.6, [-.2, 2.3, 13], [-.2, 2.2, -.5], 38, -1), k(2.9, [0, 2.5, 16.5], [-.1, 2.4, -.5], 40, -2) ]),
  path(2.9, 3.62, [
    k(2.9, U(-7.6, 5, 36), U(-7.6, 6, 0), 40, -2), k(3.15, U(-7.6, 12, 44), U(-7.6, 9, -4), 40, -1),
    k(3.4, U(-7, 30, 49), U(-7.6, 9, -4), 44, 0), k(3.62, U(-6, 57, 52), U(-7.4, 9, -4), 46, 2) ]),
  // the breach: daylight, the waves below, rise up the ship's side, over the rail, the skipper. Then fly out ahead of her so she reads as a ship
  path(3.62, 6.12, [
    k(3.62, S(4, -6.8, 24), S(3.6, -8.2, 18), 44, 4), k(3.85, S(4, -3, 21), S(3.3, -1, 8), 38, 3), k(4.15, S(3.6, 1.4, 16.5), S(3.1, 2.4, 3.4), 30, -1),
    k(4.85, S(3.3, 2.1, 14.2), S(3.2, 2.5, 3.4), 26, -3), k(5.0, S(5, 3, 15), S(2, 2.6, 2), 28, -2), k(5.15, S(10, 8, 22), S(-6, 3, 0), 30, -1), k(5.4, S(40, 10, 24), S(-6, 3, -1), 30, 0),
    k(5.7, S(75, 10, 18), S(2, 2, 0), 30, 2), k(6.02, S(88, 10, 13), S(0, 3, 0), 30, 3),
    k(6.12, S(88, 10, 13), S(88 - 17, 10, 13 + 98), 32, 3) ]),
  // the swish continues: same sky, same sea, another place. Lands on the smuggler
  path(6.12, 7.04, [
    k(6.12, B(-.3, 1.85, 13.8), B(-.3 + 17, 2, 13.8 + 98), 32, 3), k(6.18, B(-.3, 1.85, 13.8), B(99, 2.5, 13.8), 30, 3), k(6.25, B(-.3, 1.85, 13.8), B(-1.1, 2.3, 1.2), 26, 3, 0, { stop: true }),
    k(6.96, B(-.5, 1.85, 12.8), B(-1.1, 2.3, 1.2), 26, 2), k(7.04, B(-.5, 1.85, 12.8), B(99, 2.3, 12.8), 28, 2) ]),
  path(7.04, 7.7, [
    k(7.04, S(2.2, 2.1, 12.8), S(-97, 2.5, 12.8), 28, 4), k(7.14, S(2.2, 2.1, 12.7), S(3, 2.55, 3.4), 26, 4, 0, { stop: true }), k(7.7, S(2.3, 2.1, 11.6), S(3, 2.55, 3.4), 26, 5, .6) ]),
  // the ram, from dead ahead and above: the tower with S-4 rises across the frame, the bow comes from behind it, wheelhouse and mast stacked over it
  path(7.7, 8.7, [
    k(7.7, S(100, 14, 18), S(40, 4, 0), 28, 0), k(8.03, S(96, 14, 17), S(40, 4, 0), 28, 1), k(8.08, S(96, 14, 17), S(40, 4, 0), 28, 2, 3), k(8.7, S(92, 13, 16), S(42, 2, 0), 28, 4, 1) ]),
  // hard cut on the jolt: the room heels
  path(8.7, 10.02, [
    k(8.7, [0, 2, 12.8], [.1, 2.1, -.2], 30, -3, 3), k(9.2, [0, 2, 12.7], [.1, 2.1, -.2], 30, -7, 1.5), k(10.02, [-.2, 2, 11.6], [-.4, 2.1, -.2], 30, -10, .6) ]),
  // she drops: ride down with her, the tower dead centre, the sand comes up, the slam; then straight into her side through the dust
  path(10.02, 11.86, [ ...fallKeys,
    k(11.44, U(22, 10.6, -9), U(-6, 8.2, -9), 46, -3, 3.2), k(11.54, U(21.5, 10.7, -9), U(-6, 8, -9), 44, -2, 2.4),
    k(11.7, U(11, 8, -9), U(-8, 5.8, -9), 40, 0, 1), k(11.86, U(-1.2, 5.4, -9), U(-8, 5.4, -9), 36, 0, 0) ]),
  // out of the steel, among forty men: the aft bulkhead, in over the six
  path(11.86, 13.26, [
    k(11.86, [0, 2.4, 15.9], [-.4, 2.2, 0], 36, 1), k(12.12, [-.2, 2.2, 13], [-.5, 2.2, 0], 34, 2), k(13.0, [-1.2, 2, 11.7], [-1.7, 2.25, .6], 28, 4), k(13.26, [-1.7, 2, 11.2], [-2.1, 2.35, .7], 28, 5) ]),
  // the diver: close, sinking, bubbles past. Swish across the seabed, landing on the first knock. After the third, in past the wrench, into the hull
  path(13.26, 15.1, [
    k(13.26, U(12.5, 1.9, 13.4), U(12.05, 2.6, 3.4), 26, -4, 1), k(13.98, U(12.5, 1.9, 12.4), U(12.05, 2.6, 3.4), 26, -6, 1),
    k(14.06, U(8, 2, 12), U(5, 2.4, 3), 28, -2, .5), k(14.16, U(-.25, 1.8, 12), U(-1.45, 2.25, 1.3), 26, 2, 0, { stop: true }), k(14.8, U(-.35, 1.85, 11), U(-1.5, 2.25, 1.3), 26, 3),
    k(14.88, U(0, 2, 8), U(-2.02, 2.2, 1.4), 28, 2), k(14.96, U(.9, 2.2, 4.8), U(-2.02, 2.2, 1.6), 30, 0), k(15.04, U(-.2, 2.05, 3), U(-3, 2.1, 1.9), 32, 0), k(15.1, U(-2.0, 2.0, 2.3), U(-5, 2, 2), 34, 0) ]),
  // inside the same frame of steel: the room heard it. The sweep lands on the kid for the slow six. On the third, away to the wall: the sound leaves, and so do we
  path(15.1, 17.74, [
    k(15.1, [5.3, 2.2, 9], [1.2, 2.2, 1], 34, 0), k(15.4, [3.6, 2.2, 10.2], [.6, 2.1, .5], 32, -1), k(16, [.4, 1.9, 11.5], [-.6, 1.9, .5], 30, -2), k(16.4, [-1.4, 1.55, 10.6], [-1.38, 1.78, .95], 26, 2),
    k(17.38, [-1.6, 1.5, 8.8], [-1.38, 1.78, .95], 26, 3), k(17.52, [-2.2, 1.6, 7.5], [-2.8, 1.8, 2], 28, 1), k(17.64, [-3.2, 1.8, 4.5], [-6.5, 1.8, 2], 30, 0), k(17.74, [-5.35, 1.8, 2.7], [-8, 1.8, 2], 30, 0) ]),
  // out of the steel, right against his helmet as the fourth knock lands, sliding back along the hull while his face breaks into joy
  path(17.74, 19, [
    k(17.74, U(-1.55, 2.6, 3.0), U(-.95, 2.7, 1.2), 40, 0), k(18.3, U(-1.6, 2.55, 5.2), U(-1.1, 2.55, 1.2), 30, 1), k(19, U(-1.5, 2.5, 7.2), U(-1.2, 2.5, 1.2), 28, 2) ]),
  // hard cut: the storm throws the camera about; one take from the Navy man to the diver who can't go
  path(19, 21.3, [
    k(19, D(7.4, 1.9, -8.6), D(7.9, 2.55, 2.6), 26, 4, 1), k(19.44, D(7.4, 1.9, -8.3), D(7.9, 2.55, 2.6), 26, 5, 1), k(19.5, D(7.4, 1.9, -8.3), D(7.9, 2.55, 2.6), 26, 9, 3),
    k(19.75, D(8.6, 2.6, -10.4), D(8.6, 2.4, 2.4), 28, -7, 2.5), k(20.3, D(9.6, 2.2, -10.6), D(9.4, 2.45, 2.3), 26, 5, 2), k(21.28, D(9.4, 2.1, -9.6), D(9.5, 2.45, 2.3), 26, -5, 1.5) ]),
  // the six: the room, then swish to the Lieutenant's morse, swish to the chief who can't breathe
  path(21.3, 24.3, [
    k(21.3, [.1, 2.15, 14], [-.2, 2.2, -.8], 38, 2), k(22.52, [-.5, 2.1, 11.4], [-.8, 2.2, -.5], 36, 3),
    k(22.68, [-3.5, 2.35, 13], [-2.95, 2.65, .5], 26, -4, 0, { stop: true }), k(23.36, [-3.5, 2.35, 11.7], [-2.95, 2.65, .5], 26, -5),
    k(23.5, [-.55, 1.55, 9.9], [1.35, 1.85, .3], 26, 5, 0, { stop: true }), k(24.3, [-.55, 1.55, 9], [1.35, 1.85, .3], 26, 7) ]),
  // the second diver: thrown about on the way down, then one take: lead him in from the front so his face stays ours, the snag, pull out as help arrives
  path(24.3, 28.86, [
    k(24.3, U(17.4, 2.1, 5), U(18, 2.5, -5.6), 26, 7, 3), k(24.7, U(17.4, 2.1, 4.7), U(18, 2.5, -5.6), 26, -6, 3), k(25.14, U(17.4, 2.1, 4.4), U(18, 2.5, -5.6), 26, 6, 3),
    k(25.24, U(14, 2.2, -1), U(8, 2.4, -8), 28, 2, 1), k(25.4, U(4, 2.3, -2.5), on('diver2', 2.45), 26, 0, .5), k(25.7, U(-.6, 2.2, -6.4), on('diver2', 2.45), 32, -1, .5), k(26.1, U(-1.6, 2.2, -8.6), on('diver2', 2.45), 40, -2, .5), k(26.35, U(-1.75, 2.2, -9.6), on('diver2', 2.45), 46, -2, .5), k(26.56, U(-1.75, 2.2, -9.4), on('diver2', 2.45), 46, -2, .5), k(26.74, U(-1.5, 2.2, -5.2), on('diver2', 2.45), 34, -2, .5),
    k(26.95, U(-1.2, 2.2, -3.6), on('diver2', 2.45), 26, -2, .5), k(27.5, U(-.7, 2.25, -3.7), on('diver2', 2.45), 26, -3, .5),
    k(28.1, U(1.45, 2.4, 3.4), U(1.45, 2.55, -8.9), 28, -1), k(28.86, U(1.45, 2.4, 2.8), U(1.45, 2.55, -8.9), 28, 2) ]),
  // the question: hard cut, tight, the four knocks. Then the camera goes up with it: through the ceiling, up the water, out at the ship and the Navy man's key
  path(28.86, 30.8, [
    k(28.86, [-.8, 1.4, 11.2], [-1.25, 1.65, .95], 26, 3), k(29.84, [-1.15, 1.6, 9.6], [-1.34, 1.72, .95], 26, 0), k(30.62, [-1.2, 1.6, 8], [-1.34, 1.72, .95], 26, -3),
    k(30.68, [-1.1, 2.4, 6.5], [-1, 6, 2], 36, -1), k(30.75, [-.8, 6, 5], [-.6, 12, 4], 44, 0), k(30.8, [-.7, 7.85, 4.6], [-.6, 14, 4.4], 44, 0) ]),
  path(30.8, 30.94, [ k(30.8, U(3, 11, 6), U(3, 40, 5), 44, 0), k(30.88, U(3, 36, 6), U(3, 70, 5), 44, 0), k(30.94, U(3, 55.6, 6), U(3, 90, 5), 44, 0) ]),
  // up out of the water, up the ship's side, the key. Two pings: then over the side of the deck and straight down, the answer comes back
  path(30.94, 31.8, [
    k(30.94, D(7.6, -5.5, -11), D(7.6, 6, -6), 40, 0, 2), k(31.06, D(7.5, .5, -10), D(7.7, 3, 2), 30, -2, 2), k(31.2, D(7.5, 2, -8.7), D(7.7, 2.1, 2.6), 26, -3, 1.5), k(31.62, D(7.5, 2, -8.1), D(7.7, 2.1, 2.6), 26, -4, 1.5),
    k(31.68, D(7.5, 2, -7.5), D(7.4, -2, -3), 34, -2, 1), k(31.75, D(7.3, 1.2, -5.5), D(7.3, -6, -5), 40, 0), k(31.8, D(7.3, .08, -5.2), D(7.3, -6, -5), 40, 0) ]),
  // the ceiling: looking straight down on upturned faces as the ping rings, sinking to their level for "There is hope"
  path(31.8, 34.06, [
    k(31.8, [-.9, 7.75, 3.4], [-1, 1.9, .9], 46, 0), k(32.12, [-.9, 5.8, 6.6], [-.95, 2, .1], 44, 0), k(32.56, [-.45, 2.1, 12.2], [-.42, 2, 1], 30, -1), k(34.04, [-.45, 1.7, 10.9], [-.42, 2, 1], 28, -3) ]),
  // hard cut to the dawn. Over the side, down the water, the diver knocks and nothing answers; then in through the steel to what the storm left
  path(34.06, 35.1, [
    k(34.06, D(8.9, 2.1, -11.4), D(8.9, 2.45, 2.4), 26, 1), k(34.86, D(8.9, 2.1, -10.8), D(8.9, 2.45, 2.4), 26, 1), k(34.98, D(8.9, 1, -10.4), D(8.9, -3, -6), 32, 0), k(35.1, D(8.9, -6.5, -9.5), D(8.9, -9, -9), 40, 0) ]),
  path(35.1, 36.02, [
    k(35.1, U(-.5, 22, 16), U(-1.4, 3, 1.2), 34, 0), k(35.24, U(-.7, 3.2, 11.5), U(-1.4, 2.4, 1.2), 28, 0), k(35.72, U(-.75, 2, 10.2), U(-1.4, 2.4, 1.2), 26, 0),
    k(35.88, U(-.7, 2.2, 7), U(-1.6, 2.3, 1.6), 28, 0), k(35.96, U(-.9, 2.2, 4), U(-3, 2.2, 2.8), 32, 0), k(36.02, U(-2, 2.2, 3.1), U(-4.5, 2.2, 2.9), 34, 0) ]),
  // the dark: arrive through the aft wall on the lamp going out, one slow straight line to the kid
  path(36.02, 99, [
    k(36.02, [-.85, 1.55, 15.9], [-.82, 1.5, .95], 26, 0), k(36.25, [-.85, 1.55, 10.8], [-.82, 1.5, .95], 26, 0), k(39.4, [-.85, 1.55, 9], [-.82, 1.5, .95], 26, 0) ]),
];
