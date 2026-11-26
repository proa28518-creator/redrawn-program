// The Third Man — Shackleton, South Georgia 1916 (Arabic narration; times are fixed seconds from the timed transcript)
// Companions: characters-52.js (cast), worlds-24.js (glacier / ocean_storm / island_camp), shots-24.js (camera patterns).
// NOTE: clock.at() cannot match Arabic words (its normaliser strips non-Latin), so all timing here uses fixed seconds from the timed transcript.
import words from "./words.js";
import { addCharacter } from "./characters-52.js";
import { buildWorld } from "./worlds-24.js";
import { shotAt, getShot } from "./shots-24.js";

// shots-24 patterns carry yaw in RADIANS and height as an OFFSET above the subject, but the engine's aim()
// reads yaw in DEGREES and height as an ABSOLUTE y — fed through shotAt() alone, every aim camera ends up at
// ankle height (y = 0.05-0.6) looking up, mostly into the characters' coats (the black frames in round 1).
// This wrapper keeps every other pattern field (fov, roll, move, transition, lens) and recomputes pos with
// the pattern's own units. Aerial and offset patterns were already correct and pass through untouched.
function shotList(helpers, plan) {
  return plan.map((s) => {
    const k = shotAt(helpers, s.shot, s.t, s.subject, s.opts || {});
    const p = getShot(s.shot);
    if (p && p.kind === "aim") {
      const dist = (s.opts && s.opts.dist) ?? p.dist;
      const yaw = (s.opts && s.opts.yaw) ?? p.yaw ?? 0;
      const hOff = (s.opts && s.opts.height) ?? p.height ?? 0.1;
      // cast.eyes() returns a THREE.Vector3, not an array: shotAt()/aim() index it as [0],[1],[2],
      // get undefined and produce NaN camera positions (the black frames). Normalise to a plain array.
      const raw = s.subject.pos;
      const sp = Array.isArray(raw) ? raw : [raw.x, raw.y, raw.z];
      k.pos = [sp[0] + Math.sin(yaw) * dist, sp[1] + hOff, sp[2] + Math.cos(yaw) * dist];
      k.look = [...sp];
    }
    return k;
  });
}

export default {
  seed: 16,
  words,
  light: "day",
  build(A) {
    const { W, kit, mat, glow, cast, fx, makeLook, rand, aim, aerial, THREE } = A;

    // ---- ground + seas ----
    kit.ground(W, { kind: "stone", color: "#eaf3fc" });
    kit.water(W, { x: 80, z: 0, w: 64, d: 44, color: "#2f6ba8", y: 0.02 });
    kit.water(W, { x: 160, z: 0, w: 64, d: 44, color: "#3a7cae", y: 0.02 });
    kit.hills(W, { color: "#b9cfe4", dist: 150 });

    // ---- worlds (companions) ----
    // Glacier/island landmark scatter is offset far north of the staging areas: the random peaks/trees
    // otherwise land on the actors and the camera (engine reported "camera inside peak"). They read as backdrop.
    const wg = buildWorld(A, "glacier", [0, -55], 1);
    buildWorld(A, "ocean_storm", [80, 0], 2);
    buildWorld(A, "island_camp", [160, -45], 3);

    // ---- lifeboat at [80,0] ----
    {
      const g = new THREE.Group(); g.position.set(80, 0, 0);
      g.add(kit.box(2.4, 0.8, 6.2, mat("wood", { color: "#7a4a26", seed: 4 }), { y: 0.35 }));
      g.add(kit.box(2.0, 0.18, 0.5, mat("wood", { color: "#9a6a3a", seed: 5 }), { y: 0.62, z: 1.2 }));
      g.add(kit.box(2.0, 0.18, 0.5, mat("wood", { color: "#9a6a3a", seed: 6 }), { y: 0.62, z: -1.2 }));
      g.add(kit.cyl(0.06, 0.09, 3.4, mat("wood", { color: "#5a3a20", seed: 7 }), { y: 1.7, z: -0.4 }));
      g.add(kit.box(0.06, 2.0, 1.6, mat("plaster", { color: "#f2ede2", seed: 8 }), { x: 0.5, y: 2.0, z: -0.4 }));
      W.add(g, { name: "lifeboat" });
    }
    // island camp clutter
    kit.rock(W, { x: 165, z: -5, s: 2.6 });
    kit.crate(W, { x: 157, z: 3 });
    kit.barrel(W, { x: 163, z: 3.4 });
    kit.crate(W, { x: 158.5, z: -3.4 });

    // ---- gear macro props at glacier camp [6,-13] (kit.cyl/box are pure builders: they must be W.add-ed) ----
    W.add(kit.cyl(0.45, 0.45, 0.14, mat("flat", { color: "#d9822b" }), { x: 6, y: 0.07, z: -13 }), { collide: false, name: "rope_coil" });
    W.add(kit.cyl(0.3, 0.3, 0.12, mat("flat", { color: "#b8641e" }), { x: 6.1, y: 0.2, z: -13 }), { collide: false, name: "rope_coil2" });
    {
      const g = new THREE.Group(); g.position.set(6.9, 0.45, -13.4); g.rotation.z = -0.6;
      g.add(kit.box(0.09, 1.1, 0.09, mat("wood", { color: "#8a5a30", seed: 9 }), {}));
      g.add(kit.box(0.5, 0.16, 0.06, mat("flat", { color: "#5a6a7a" }), { y: 0.5, x: 0.18 }));
      W.add(g, { name: "ice_axe" });
    }
    W.add(kit.cyl(0.05, 0.05, 0.12, mat("flat", { color: "#8a97a5" }), { x: 5.2, y: 0.06, z: -12.4 }), { collide: false, name: "screw" });
    W.add(kit.cyl(0.05, 0.05, 0.12, mat("flat", { color: "#8a97a5" }), { x: 5.45, y: 0.06, z: -12.2 }), { collide: false, name: "screw" });
    W.add(kit.cyl(0.05, 0.05, 0.12, mat("flat", { color: "#8a97a5" }), { x: 5.3, y: 0.06, z: -12.7 }), { collide: false, name: "screw" });

    // ---- cast ----
    const shack = addCharacter(cast, makeLook, rand, "captain", 100, [0, 6]);
    const wors = addCharacter(cast, makeLook, rand, "explorer", 101, [1.6, 8.5]);
    const crean = addCharacter(cast, makeLook, rand, "sailor", 102, [-1.6, 10.5]);
    const fourth = cast.add({
      name: "fourth",
      look: makeLook(rand.fork(9), "adult", { outfit: "coat", top: "#232330", accent: "#101018", hairStyle: "none", hat: "scarf", hatColor: "#15151d" }),
      pos: [2.4, -2], h: 1.78, face: "neutral",
    });
    // island stranded group + vignette figures
    addCharacter(cast, makeLook, rand, "soldier", 110, [158, 1]);
    addCharacter(cast, makeLook, rand, "farmer", 111, [162, -1]);
    addCharacter(cast, makeLook, rand, "merchant", 112, [159, -3]);
    addCharacter(cast, makeLook, rand, "engineer", 113, [161.5, 3]);
    const climber = addCharacter(cast, makeLook, rand, "athlete", 114, [-14, -16]);
    const fisher = addCharacter(cast, makeLook, rand, "fisherman", 115, [84.5, 4.5]);
    const journ = addCharacter(cast, makeLook, rand, "journalist", 116, [166, 4]);

    // ---- movement & acting ----
    shack.walk(0, 11.5, [[0.4, -8]]); wors.walk(0, 11.5, [[2, -5.5]]); crean.walk(0, 11.5, [[-1.2, -3.5]]);
    fourth.hide(0); fourth.show(7.16); fourth.place(7.16, [2.4, -2]); fourth.walk(7.16, 11.5, [[2.6, -7]]); fourth.hide(11.8);
    shack.place(11.8, [79, 0.5]); wors.place(11.8, [81, 0.9]); crean.place(11.8, [80, -1.9]);
    shack.arms(14.54, "point");
    shack.place(21.69, [6, -8]); shack.walk(21.69, 24.6, [[6.5, -11.5]]);
    wors.place(21.69, [7.8, -6.6]); wors.walk(21.69, 24.6, [[8.2, -10]]);
    crean.place(21.69, [4.2, -6.9]); crean.walk(21.69, 24.6, [[4.6, -10.3]]);
    wors.place(28.37, [5, -13.6]); crean.place(28.37, [7.2, -13.9]); shack.place(28.37, [6, -16.2]);
    wors.face(28.37, "sleepy"); crean.face(28.37, "sleepy");
    shack.arms(32.25, "cross"); shack.face(32.25, "thinking");
    wors.face(34.6, "surprised"); crean.face(34.6, "surprised"); shack.face(35.5, "smug"); shack.arms(35.5, "point");
    fourth.place(37.8, [8.2, -15.2]); fourth.show(37.8); shack.face(37.8, "worried"); fourth.hide(41.9);
    shack.face(7.16, "worried"); shack.face(9.26, "surprised"); shack.face(14.54, "determined"); shack.face(21.69, "worried");
    wors.face(41.97, "worried"); shack.face(42, "surprised");
    crean.face(45.06, "determined"); crean.arms(45.06, "cross"); crean.arms(46.5, "point");
    wors.place(46.98, [4.6, -15.6]); crean.place(46.98, [7.4, -15.8]);
    fourth.place(46.98, [6, -17.6]); fourth.show(46.98);
    climber.walk(51.2, 53.4, [[-13.2, -18.6]]);
    shack.walk(57.29, 60.4, [[6, -19.5]]); wors.walk(57.29, 60.4, [[4.6, -18.8]]); crean.walk(57.29, 60.4, [[7.4, -19.1]]);
    shack.face(57.29, "happy"); fourth.hide(58.6);

    // ---- effects ----
    fx.emit("dust", 1, 11, [0, 0.3, -2], { size: 0.8, count: 14, color: "#ffffff" });
    fx.emit("ring", 9.26, 10.6, [2.5, 1.2, -4.4], { size: 1.7, glow: [2.2, 2.6, 3.2] });
    fx.emit("crowd", 16.9, 21.6, [160, 0.4, 0], { area: [7, 5], count: 16, colors: ["#a33", "#36c", "#593", "#c73"] });
    fx.emit("sparkle", 57.3, 60.3, [6, 2, -17.5], { spread: 3, count: 16 });

    // ---- camera (shots-24 patterns) ----
    const helpers = { aim, aerial };
    const camera = shotList(helpers, [
      { shot: "hook_closeup", t: 0, subject: { pos: shack.eyes(0), name: "captain" }, opts: { light: wg.lightName } },
      { shot: "aerial_sweep", t: 4.59, subject: { pos: [0, 0, -30] }, opts: { light: "day" } },
      { shot: "tight_closeup", t: 7.16, subject: { pos: shack.eyes(7.16), name: "captain" }, opts: { light: "day" } },
      { shot: "silhouette", t: 9.26, subject: { pos: fourth.eyes(9.26), name: "fourth" }, opts: { light: "day" } },
      { shot: "whip_cut", t: 11.8, subject: { pos: shack.eyes(11.8), name: "captain" }, opts: { light: "day", dist: 5.2, height: 0.6 } },
      { shot: "group_reaction", t: 14.54, subject: { pos: [80, 1.3, 0], name: "captain" }, opts: { light: "day", dist: 5.4, height: 1.0 } },
      { shot: "aerial_sweep", t: 16.9, subject: { pos: [160, 0, 0] }, opts: { light: "day" } },
      { shot: "dissolve_cut", t: 21.69, subject: { pos: shack.eyes(21.69), name: "captain" }, opts: { light: "day", dist: 3.6, yaw: -0.62, height: -0.25 } },
      { shot: "macro_insert", t: 24.61, subject: { pos: [6, 0.25, -13] }, opts: { light: "day" } },
      { shot: "top_down", t: 28.37, subject: { pos: [6, 0, -14.6] }, opts: { light: "day" } },
      { shot: "tight_closeup", t: 32.25, subject: { pos: shack.eyes(32.25), name: "captain" }, opts: { light: "day" } },
      { shot: "dissolve_cut", t: 34.52, subject: { pos: [6, 1.25, -14.8], name: "explorer" }, opts: { light: "day", dist: 4.4, yaw: 0, height: 0.1 } },
      { shot: "side_profile", t: 37.8, subject: { pos: shack.eyes(37.8), name: "captain" }, opts: { light: "day" } },
      { shot: "dissolve_cut", t: 41.97, subject: { pos: wors.eyes(41.97), name: "explorer" }, opts: { light: "day", dist: 2.75, yaw: 0.22, height: 0.08 } },
      { shot: "dissolve_cut", t: 45.06, subject: { pos: crean.eyes(45.06), name: "sailor" }, opts: { light: "day", dist: 4.0, yaw: -0.2, height: 0.08 } },
      { shot: "group_reaction", t: 46.98, subject: { pos: [6, 1.3, -15.8], name: "captain" }, opts: { light: "day" } },
      { shot: "quick_cut", t: 51.91, subject: { pos: climber.eyes(51.91), name: "athlete" }, opts: { light: "day" } },
      { shot: "quick_cut", t: 52.67, subject: { pos: fisher.eyes(52.67), name: "fisherman" }, opts: { light: "day" } },
      { shot: "quick_cut", t: 53.23, subject: { pos: journ.eyes(53.23), name: "journalist" }, opts: { light: "day" } },
      { shot: "high_pullback", t: 53.95, subject: { pos: shack.eyes(53.95), name: "captain" }, opts: { light: "day" } },
      { shot: "godray_finale", t: 57.29, subject: { pos: shack.eyes(57.29), name: "captain" }, opts: { light: "golden" } },
    ]);

    return { camera, kicks: [] };
  },
};
