// 3D Sets and Hero Spacecraft/Rocket models for "NasaOrbiter".
// Reuses twoTone shading & NOINK layer contract from src/videos/indiana-bell/.
// Zero per-frame texture or geometry allocations; all animations are pure functions of frame & u.
import React, { useMemo } from "react";
import * as THREE from "three";
import { NOINK } from "../indiana-bell/ink";
import {
  basicMat,
  DeskConsoleUnit,
  getDiegeticTexture,
  h,
  MarsGlobe,
  mulberry32,
  RibbonLine,
  StarfieldDome,
  toonLam,
} from "./build";
import { clamp01, moveCurve, ShotId, smoothstep, V3 } from "./story";

const noInk = (s: THREE.Object3D) => s.layers.set(NOINK);

// ---------------- Deterministic Particle & Debris Tables ----------------
const EXHAUST_PUFFS = (() => {
  const r = mulberry32(19981212);
  return Array.from({ length: 28 }, (_, i) => ({
    angle: (i / 28) * Math.PI * 2 + r() * 0.3,
    speed: 1.5 + r() * 3.2,
    lift: 0.2 + r() * 0.8,
    baseScale: 0.45 + r() * 0.65,
    phase: r(),
  }));
})();

const ENTRY_CLOUDS = (() => {
  const r = mulberry32(19990924);
  return Array.from({ length: 35 }, () => ({
    x: (r() - 0.5) * 18,
    y: -1.45 - r() * 0.9,
    z: (r() - 0.5) * 28,
    sx: 1.6 + r() * 2.4,
    sz: 1.2 + r() * 2.0,
    opacity: 0.42 + r() * 0.28,
  }));
})();

const PLASMA_SPARKS = (() => {
  const r = mulberry32(19990925);
  return Array.from({ length: 42 }, () => ({
    ox: (r() - 0.5) * 0.9,
    oy: (r() - 0.5) * 0.7,
    oz: -0.2 - r() * 3.8,
    vx: (r() - 0.5) * 0.4,
    vy: (r() - 0.5) * 0.3,
    scale: 0.03 + r() * 0.055,
    phase: r() * 10,
  }));
})();

const DEBRIS_SHARDS = (() => {
  const r = mulberry32(19990926);
  return Array.from({ length: 24 }, () => ({
    dir: [(r() - 0.5) * 3.6, (r() - 0.3) * 2.8, (r() - 0.5) * 3.2] as V3,
    rotSpeed: [(r() - 0.5) * 8, (r() - 0.5) * 8, (r() - 0.5) * 8] as V3,
    scale: [0.09 + r() * 0.14, 0.04 + r() * 0.08, 0.10 + r() * 0.16] as V3,
    hot: r() > 0.35,
  }));
})();

const HOOK_STREAKS = (() => {
  const r = mulberry32(19981213);
  return Array.from({ length: 30 }, () => ({
    x: (r() - 0.5) * 6.8,
    y: (r() - 0.5) * 7.2,
    z: (r() - 0.5) * 14,
    phase: r(),
    thick: 0.014 + r() * 0.018,
    len: 0.55 + r() * 0.75,
  }));
})();

const IMPACT_SPARKS = (() => {
  const r = mulberry32(19990445);
  return Array.from({ length: 12 }, (_, i) => {
    const ang = (i / 12) * Math.PI * 2 + (r() - 0.5) * 0.25;
    return {
      dx: Math.cos(ang),
      dy: Math.sin(ang),
      dz: (r() - 0.2) * 0.4,
      speed: 0.16 + r() * 0.18,
      scale: 0.022 + r() * 0.018,
    };
  });
})();

// ---------------- 1. Hero Mars Climate Orbiter ----------------
export const MarsClimateOrbiter: React.FC<{
  position?: V3;
  rotation?: V3;
  scale?: number;
  heatLevel?: number;
  breakupProgress?: number;
  thrusterFiring?: boolean;
}> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  heatLevel = 0,
  breakupProgress = 0,
  thrusterFiring = false,
}) => {
  const foilMat = useMemo(
    () =>
      toonLam("mco_foil", () => ({
        map: getDiegeticTexture("kapton_foil"),
        color: "#f2c14e",
      })),
    [],
  );
  const solarMat = useMemo(
    () => toonLam("mco_solar", () => ({ map: getDiegeticTexture("solar_cells") })),
    [],
  );
  const dishMat = useMemo(() => toonLam("mco_dish", () => ({ color: "#f0eee9" })), []);
  const silverMat = useMemo(() => toonLam("mco_silver", () => ({ color: "#cfd6df" })), []);
  const darkMat = useMemo(() => toonLam("mco_dark", () => ({ color: "#28303b" })), []);

  const hotGlowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: heatLevel > 0.6 ? "#ffdf6e" : "#ff6b1c",
        transparent: true,
        opacity: clamp01(heatLevel * 0.92),
        toneMapped: false,
      }),
    [heatLevel],
  );
  const shockMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: heatLevel > 0.65 ? "#fff0a8" : "#ff8833",
        transparent: true,
        opacity: clamp01(heatLevel * 0.65),
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    [heatLevel],
  );
  const plumeMat = useMemo(
    () =>
      basicMat("rcs_plume", () => ({
        color: "#6ef3ff",
        transparent: true,
        opacity: 0.85,
        toneMapped: false,
      })),
    [],
  );
  const shardHotMat = useMemo(
    () => basicMat("debris_hot", () => ({ color: "#ff922e", toneMapped: false })),
    [],
  );

  const b = clamp01(breakupProgress);
  const wingBend = -heatLevel * 0.30;
  const wingSnap = b > 0.15 ? (b - 0.15) / 0.85 : 0;
  const dishSnap = b > 0.30 ? (b - 0.30) / 0.70 : 0;
  const busSplit = b > 0.45 ? (b - 0.45) / 0.55 : 0;

  return h(
    "group",
    { position, rotation, scale },
    // Gold Kapton MLI Bus
    h(
      "group",
      { position: [busSplit * 0.65, busSplit * 0.35, -busSplit * 0.5] },
      h("mesh", { material: foilMat, castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [1.15, 1.05, 1.25] })),
      h("mesh", { material: darkMat, position: [0.59, 0, 0], castShadow: true }, h("boxGeometry", { args: [0.04, 0.72, 0.86] })),
      h("mesh", { material: silverMat, position: [-0.22, -0.1, 0.68], castShadow: true }, h("boxGeometry", { args: [0.42, 0.38, 0.22] })),
      h("mesh", { material: darkMat, position: [0.25, 0.12, 0.68], rotation: [Math.PI / 2, 0, 0], castShadow: true }, h("cylinderGeometry", { args: [0.14, 0.16, 0.24, 14] })),
      h("mesh", { material: darkMat, position: [0, -0.68, 0], castShadow: true }, h("cylinderGeometry", { args: [0.14, 0.24, 0.34, 16] })),
      ...([[-0.55, 0.42, 0.55], [0.55, 0.42, 0.55], [-0.55, -0.42, -0.55], [0.55, -0.42, -0.55]] as V3[]).map(
        (p, i) => h("mesh", { key: `rcs-${i}`, material: silverMat, position: p, castShadow: true }, h("boxGeometry", { args: [0.12, 0.12, 0.12] })),
      ),
      thrusterFiring
        ? h(
            "group",
            { position: [0.66, -0.42, -0.55], rotation: [0, 0, -Math.PI / 2] },
            h("mesh", { material: plumeMat, position: [0, 0.52, 0], onUpdate: noInk }, h("coneGeometry", { args: [0.18, 1.05, 12] })),
          )
        : null,
      heatLevel > 0.05
        ? h("mesh", { material: hotGlowMat, scale: 1.04, onUpdate: noInk }, h("boxGeometry", { args: [1.15, 1.05, 1.25] }))
        : null,
    ),
    // High-Gain Dish Antenna
    h(
      "group",
      { position: [-dishSnap * 1.4, 0.88 + dishSnap * 1.5, dishSnap * 0.9], rotation: [dishSnap * 2.2, 0, dishSnap * 1.8] },
      h("mesh", { material: silverMat, position: [0, -0.22, 0], castShadow: true }, h("cylinderGeometry", { args: [0.08, 0.12, 0.35, 12] })),
      h("mesh", { material: dishMat, position: [0, 0.04, 0], scale: [1, 0.32, 1], castShadow: true }, h("sphereGeometry", { args: [0.72, 22, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5] })),
      h("mesh", { material: foilMat, position: [0, -0.02, 0] }, h("cylinderGeometry", { args: [0.42, 0.22, 0.08, 16] })),
      h("mesh", { material: silverMat, position: [0, 0.28, 0] }, h("cylinderGeometry", { args: [0.025, 0.025, 0.45, 8] })),
    ),
    // Asymmetric Single Solar Wing (-X)
    h(
      "group",
      { position: [-0.62 - wingSnap * 2.1, 0.22 + wingSnap * 1.1, -wingSnap * 1.3], rotation: [wingSnap * 1.6, wingBend - wingSnap * 1.4, 0.16 + wingSnap * 0.9] },
      h("mesh", { material: silverMat, position: [-0.28, 0, 0], rotation: [0, 0, Math.PI / 2], castShadow: true }, h("cylinderGeometry", { args: [0.04, 0.05, 0.56, 10] })),
      ...[0, 1, 2].map((pi) =>
        h(
          "group",
          { key: `sp-${pi}`, position: [-0.95 - pi * 1.02 - wingSnap * pi * 0.45, wingSnap * pi * 0.25, 0], rotation: [0, -heatLevel * 0.08 * pi, 0] },
          h("mesh", { material: solarMat, castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [0.96, 0.045, 1.32] })),
          h("mesh", { material: silverMat, position: [0.49, 0, 0] }, h("boxGeometry", { args: [0.04, 0.06, 1.34] })),
          heatLevel > 0.15
            ? h("mesh", { material: hotGlowMat, scale: [1.02, 1.3, 1.02], onUpdate: noInk }, h("boxGeometry", { args: [0.96, 0.045, 1.32] }))
            : null,
        ),
      ),
      h("mesh", { material: silverMat, position: [-3.55, 0, 0], rotation: [0, 0, Math.PI / 2] }, h("cylinderGeometry", { args: [0.02, 0.025, 0.35, 8] })),
    ),
    // Bow-Shock Cone
    heatLevel > 0.1 && b < 0.7
      ? h("mesh", { material: shockMat, position: [-0.3, 0, 0.65], rotation: [Math.PI / 2, 0, 0], onUpdate: noInk }, h("coneGeometry", { args: [1.65, 2.1, 24, 1, true] }))
      : null,
    // Breakup debris shards
    ...(b > 0.1
      ? DEBRIS_SHARDS.map((d, i) =>
          h("mesh", {
            key: `deb-${i}`,
            material: d.hot ? shardHotMat : foilMat,
            position: [d.dir[0] * b * 2.2, d.dir[1] * b * 2.2, d.dir[2] * b * 2.2],
            rotation: [d.rotSpeed[0] * b, d.rotSpeed[1] * b, d.rotSpeed[2] * b],
            scale: d.scale,
            onUpdate: (s: THREE.Mesh) => { if (d.hot) s.layers.set(NOINK); },
          }, h("boxGeometry", { args: [1, 1, 1] })),
        )
      : []),
  );
};

// ---------------- 2. Hero Delta II 7925 Rocket ----------------
export const DeltaIIRocket: React.FC<{
  liftoffProgress?: number;
  ignitionProgress?: number;
}> = ({ liftoffProgress = 0, ignitionProgress = 0 }) => {
  const coreMat = useMemo(() => toonLam("delta_core", () => ({ map: getDiegeticTexture("rocket_body") })), []);
  const whiteMat = useMemo(() => toonLam("delta_white", () => ({ color: "#f0f3f7" })), []);
  const darkMat = useMemo(() => toonLam("delta_dark", () => ({ color: "#222830" })), []);
  const silverMat = useMemo(() => toonLam("delta_silver", () => ({ color: "#bcc5d0" })), []);
  const plumeOuterMat = useMemo(() => basicMat("plume_outer", () => ({ color: "#ff5c1a", transparent: true, opacity: 0.82, toneMapped: false })), []);
  const plumeMidMat = useMemo(() => basicMat("plume_mid", () => ({ color: "#ffba33", transparent: true, opacity: 0.9, toneMapped: false })), []);
  const plumeCoreMat = useMemo(() => basicMat("plume_core", () => ({ color: "#fffbe0", toneMapped: false })), []);

  const rocketY = 14.5 * Math.pow(clamp01(liftoffProgress), 2.05);
  const plumeScale = 0.2 + clamp01(ignitionProgress) * 1.1;

  return h(
    "group",
    { position: [0, 0.4 + rocketY, 0] },
    h("mesh", { material: coreMat, position: [0, 3.7, 0], castShadow: true, receiveShadow: true }, h("cylinderGeometry", { args: [0.62, 0.62, 7.4, 24] })),
    h("mesh", { material: silverMat, position: [0, 7.65, 0], castShadow: true }, h("cylinderGeometry", { args: [0.63, 0.63, 0.5, 20] })),
    h("mesh", { material: whiteMat, position: [0, 8.6, 0], castShadow: true }, h("cylinderGeometry", { args: [0.60, 0.60, 1.4, 20] })),
    h("mesh", { material: whiteMat, position: [0, 10.1, 0], castShadow: true }, h("cylinderGeometry", { args: [0.74, 0.60, 1.6, 20] })),
    h("mesh", { material: whiteMat, position: [0, 11.5, 0], castShadow: true }, h("coneGeometry", { args: [0.74, 1.25, 20] })),
    h("mesh", { material: darkMat, position: [0, -0.22, 0], castShadow: true }, h("cylinderGeometry", { args: [0.25, 0.38, 0.52, 16] })),
    ...Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2;
      const r = 0.84;
      return h(
        "group",
        { key: `gem-${i}`, position: [Math.cos(a) * r, 1.75, Math.sin(a) * r] },
        h("mesh", { material: whiteMat, castShadow: true }, h("cylinderGeometry", { args: [0.19, 0.19, 3.3, 12] })),
        h("mesh", { material: darkMat, position: [0, 1.85, 0], castShadow: true }, h("coneGeometry", { args: [0.19, 0.42, 12] })),
        h("mesh", { material: darkMat, position: [0, -1.78, 0] }, h("cylinderGeometry", { args: [0.10, 0.15, 0.3, 10] })),
      );
    }),
    ignitionProgress > 0.02
      ? h(
          "group",
          { position: [0, -0.45, 0], scale: [1, plumeScale, 1] },
          h("mesh", { material: plumeOuterMat, position: [0, -2.1, 0], rotation: [Math.PI, 0, 0], onUpdate: noInk }, h("coneGeometry", { args: [1.45, 4.4, 18] })),
          h("mesh", { material: plumeMidMat, position: [0, -1.65, 0], rotation: [Math.PI, 0, 0], onUpdate: noInk }, h("coneGeometry", { args: [0.95, 3.4, 16] })),
          h("mesh", { material: plumeCoreMat, position: [0, -1.05, 0], rotation: [Math.PI, 0, 0], onUpdate: noInk }, h("coneGeometry", { args: [0.48, 2.2, 14] })),
        )
      : null,
  );
};

// ---------------- SET 1: DeepSpaceSet (Shots 1, 2, 6, 14, 16) ----------------
export const DeepSpaceSet: React.FC<{
  shotId: ShotId;
  u: number;
  frame: number;
}> = ({ shotId, u, frame }) => {
  const skyMat = useMemo(
    () => basicMat("deep_nebula_sky", () => ({ map: getDiegeticTexture("nebula_sky"), side: THREE.BackSide, depthWrite: false })),
    [],
  );
  const sunMat = useMemo(
    () => basicMat("deep_sun_halo", () => ({ map: getDiegeticTexture("sun_halo"), transparent: true, depthWrite: false, toneMapped: false })),
    [],
  );
  const tagPlannedMat = useMemo(
    () => basicMat("tag_planned", () => ({ map: getDiegeticTexture("tag_planned_path"), toneMapped: false })),
    [],
  );
  const tagActualMat = useMemo(
    () => basicMat("tag_actual", () => ({ map: getDiegeticTexture("tag_actual_path"), toneMapped: false })),
    [],
  );
  const tagCruiseMat = useMemo(
    () => basicMat("tag_cruise", () => ({ map: getDiegeticTexture("tag_cruise_95"), toneMapped: false })),
    [],
  );
  const hookHudMat = useMemo(
    () => basicMat("hook_hud", () => ({ map: getDiegeticTexture("hook_telemetry_hud"), toneMapped: false })),
    [],
  );
  const hookWarnMat = useMemo(
    () => basicMat("hook_warn", () => ({ map: getDiegeticTexture("hook_warn_badge"), toneMapped: false })),
    [],
  );
  const hudFrameMat = useMemo(() => toonLam("hook_hud_frame", () => ({ color: "#192a3d" })), []);
  const glitchOrangeMat = useMemo(
    () => basicMat("hook_glitch_o", () => ({ color: "#ff5a36", transparent: true, opacity: 0.68, toneMapped: false })),
    [],
  );
  const glitchCyanMat = useMemo(
    () => basicMat("hook_glitch_c", () => ({ color: "#38f5ff", transparent: true, opacity: 0.62, toneMapped: false })),
    [],
  );
  const descentStreakMat = useMemo(
    () => basicMat("desc_streak", () => ({ color: "#ffe0b2", transparent: true, opacity: 0.72, toneMapped: false })),
    [],
  );
  const warpStreakMat = useMemo(
    () => basicMat("warp_streak", () => ({ color: "#9eeeff", transparent: true, opacity: 0.80, toneMapped: false })),
    [],
  );
  const ringMat = useMemo(
    () => basicMat("milestone_ring", () => ({ color: "#66f7d6", transparent: true, opacity: 0.65, toneMapped: false })),
    [],
  );

  const isHook = shotId === 1 || shotId === 2;
  const hookT = clamp01(frame / 154);

  let orbiterPos: V3 = [0, 0, -0.3 * u];
  let orbiterRot: V3 = [0.12, -0.45 + u * 0.12, 0.05];
  let orbiterScale = 1.0;
  let marsScale = 1.0;
  let marsPos: V3 = [2.2, 0.7, -14.5];
  let streamZ = 0;
  let thrusterFiring = false;

  if (isHook) {
    orbiterPos = [-0.35 + 0.25 * hookT, 0.68 - 0.72 * hookT, 0.35 - 0.55 * hookT];
    orbiterRot = [0.44, -0.58, -0.52];
    orbiterScale = 0.62;
    marsScale = 0.85 + 0.55 * hookT;
    marsPos = [0.6 - 0.5 * hookT, -6.9 + 1.85 * hookT, -6.5 + 1.5 * hookT];
  } else if (shotId === 6) {
    const ramp = 0.35 * u + 0.65 * u * u;
    marsScale = 0.45 + 0.95 * (u * u);
    marsPos = [1.8, 0.2, -14.5];
    orbiterPos = [0, 0, -1.6 * ramp];
    orbiterRot = [0.16, -0.58 + u * 0.14, 0.10];
    orbiterScale = 0.78;
    streamZ = (frame - 488) * (0.75 + 1.8 * u);
  } else if (shotId === 14) {
    thrusterFiring = u >= 0.18 && u <= 0.72;
    const nudge = smoothstep(0.18, 0.75, u);
    orbiterPos = [0, 0, -0.9 * u];
    orbiterRot = [0.12 - nudge * 0.18, -0.52, 0.05 + nudge * 0.22];
    marsPos = [3.0, 0.8, -16.5];
  } else if (shotId === 16) {
    const drift = smoothstep(0.0, 1.0, u);
    orbiterPos = [0.15 + 1.55 * drift, -0.1 - 0.85 * drift, 0.8 - 3.6 * u];
    orbiterRot = [0.15, -0.35 - 0.25 * drift, -0.08];
    marsPos = [2.6, 0.4, -14.0];
  }

  // Hook trajectories: steep amber-orange descent path vs safe high green planned path + Shot 2 hairline deviation
  const hookDescentPts: V3[] = useMemo(
    () => [
      [-1.55, 1.85, 1.25],
      orbiterPos,
      [orbiterPos[0] + 0.45, orbiterPos[1] - 0.95, orbiterPos[2] - 0.65],
      [0.85, -2.15, -2.5],
    ],
    [orbiterPos[0], orbiterPos[1], orbiterPos[2]],
  );
  const hookPlannedPts: V3[] = useMemo(
    () => [
      [-1.65, 1.55, 1.05],
      [-0.35, 1.25, -0.45],
      [1.10, 1.05, -2.6],
      [2.45, 0.75, -5.0],
    ],
    [],
  );
  const hookHairlineDevPts: V3[] = useMemo(
    () => [
      [-0.35, 1.25, -0.45],
      [0.18, 0.35, -1.6],
      [0.65, -0.85, -3.1],
      [0.95, -2.25, -4.6],
    ],
    [],
  );
  const hookTetherPts: V3[] = useMemo(
    () => [
      [-0.08, 1.46, 0.95],
      [orbiterPos[0] - 0.05, orbiterPos[1] + 0.35, orbiterPos[2]],
    ],
    [orbiterPos[0], orbiterPos[1], orbiterPos[2]],
  );
  const hudMiniDevPts: V3[] = useMemo(
    () => [
      [0.12, -0.11, 0.008],
      [0.28, -0.09, 0.008],
      [0.42, -0.16, 0.008],
      [0.52, -0.24, 0.008],
    ],
    [],
  );

  // Shot 2 wrongness indicators: blinking warning badge + deterministic brief glitch flicker (both active at f107)
  const warnOn = shotId === 2 && ((frame - 60) % 14) < 10;
  const glitchCycle = shotId === 2 ? (frame - 60) % 19 : 0;
  const glitchOn = shotId === 2 && glitchCycle >= 7 && glitchCycle <= 9;

  const plannedPts: V3[] = useMemo(
    () => [[-0.4, -0.2, 4.5], [0.0, 0.0, 0.5], [0.7, 0.25, -4.5], [1.4, 0.45, -9.5]],
    [],
  );
  const actualPts: V3[] = useMemo(
    () => [[0.0, 0.0, 2.0], [0.35, -0.2, -1.0], [1.15, -0.65, -4.5], [2.15, -1.25, -8.5]],
    [],
  );

  return h(
    "group",
    null,
    h("mesh", { material: skyMat, onUpdate: noInk }, h("sphereGeometry", { args: [72, 32, 20] })),
    h(StarfieldDome, { streamZ }),
    h("mesh", { material: sunMat, position: [-16, 12, -32], onUpdate: noInk }, h("planeGeometry", { args: [12, 12] })),
    h(MarsGlobe, { position: marsPos, radius: 4.8, scale: marsScale, rotY: isHook ? hookT * 0.25 : u * 0.15 }),
    h(MarsClimateOrbiter, { position: orbiterPos, rotation: orbiterRot, scale: orbiterScale, thrusterFiring }),

    // HOOK (Shots 1 & 2): Plunging descent ribbon + safe green planned trajectory + diegetic nominal HUD (+ Shot 2 hairline/glitch/warning)
    isHook
      ? h(
          "group",
          null,
          h(RibbonLine, { points: hookDescentPts, width: 0.068, color: "#ff7a33" }),
          h(RibbonLine, { points: hookPlannedPts, width: 0.062, color: "#2ef2b8" }),
          h(RibbonLine, { points: hookTetherPts, width: 0.018, color: "#4af5d4", opacity: 0.85 }),
          ...([[0.25, 1.15, -1.35], [1.55, 0.92, -3.45]] as V3[]).map((mp, i) =>
            h("mesh", { key: `hmr-${i}`, material: ringMat, position: mp, onUpdate: noInk }, h("torusGeometry", { args: [0.32, 0.018, 8, 24] })),
          ),
          shotId === 2
            ? h(RibbonLine, { points: hookHairlineDevPts, width: 0.06, color: "#ff4726" })
            : null,
          // Upward-left descent speed streaks rushing past the falling orbiter (strictly behind HUD depth z <= -0.8)
          ...HOOK_STREAKS.map((st, i) => {
            const p = ((frame * 0.055 + st.phase) % 1 + 1) % 1;
            const sx = st.x * 0.55 - p * 1.15;
            const sy = -2.2 + p * 4.8 + (st.y * 0.25);
            const sz = -0.85 - Math.abs(st.z) * 0.22 - p * 0.65;
            return h("mesh", {
              key: `hst-${i}`,
              material: descentStreakMat,
              position: [sx, sy, sz],
              rotation: [0.18, 0, 0.34],
              scale: [st.thick, st.len * 0.72, st.thick],
              onUpdate: noInk,
            }, h("boxGeometry", { args: [1, 1, 1] }));
          }),
          // In-scene 3D Diegetic Telemetry HUD Panel
          h(
            "group",
            { position: [-0.08, 1.86, 0.95], rotation: [-0.14, 0.08, 0] },
            h("mesh", { material: hudFrameMat, position: [0, 0, -0.025], castShadow: true }, h("boxGeometry", { args: [1.62, 0.84, 0.04] })),
            h("mesh", { material: hookHudMat, position: [0, 0, 0.002], onUpdate: noInk }, h("planeGeometry", { args: [1.56, 0.78] })),
            shotId === 2 ? h(RibbonLine, { points: hudMiniDevPts, width: 0.03, color: "#ff4d2e" }) : null,
            warnOn
              ? h(
                  "group",
                  null,
                  h("mesh", { material: hookWarnMat, position: [0.42, -0.22, 0.014], onUpdate: noInk }, h("planeGeometry", { args: [0.75, 0.375] })),
                  h("mesh", { material: glitchOrangeMat, position: [0, 0.405, 0.012], onUpdate: noInk }, h("planeGeometry", { args: [1.58, 0.04] })),
                  h("mesh", { material: glitchOrangeMat, position: [0, -0.405, 0.012], onUpdate: noInk }, h("planeGeometry", { args: [1.58, 0.04] })),
                )
              : null,
            glitchOn
              ? h(
                  "group",
                  null,
                  h("mesh", { material: glitchCyanMat, position: [0.06, 0.14, 0.015], onUpdate: noInk }, h("planeGeometry", { args: [1.58, 0.024] })),
                  h("mesh", { material: glitchOrangeMat, position: [-0.07, -0.06, 0.015], onUpdate: noInk }, h("planeGeometry", { args: [1.52, 0.022] })),
                )
              : null,
          ),
        )
      : null,

    // Shot 6: Accelerating warp streaks + unobstructed CRUISE 9.5 MONTHS marker
    shotId === 6
      ? h(
          "group",
          null,
          ...HOOK_STREAKS.map((st, i) => {
            const z = (((st.z + streamZ * 0.45 + 7) % 14) + 14) % 14 - 7;
            const lenZ = 0.65 + u * u * 3.1;
            const radialPush = Math.abs(st.x) < 1.25 && Math.abs(st.y) < 1.35 ? (st.x >= 0 ? 1.45 : -1.45) : 0;
            const sy = st.y * 0.75;
            // Keep streaks clear of the CRUISE 9.5 MONTHS banner corridor
            const safeX = sy > 0.75 && sy < 2.85 && Math.abs(st.x + radialPush + 0.20) < 1.45 ? (st.x >= -0.2 ? 1.55 : -1.95) : st.x + radialPush;
            const safeZ = sy > 0.75 && z > -1.05 ? z - 5.5 : z;
            return h("mesh", {
              key: `wst-${i}`,
              material: warpStreakMat,
              position: [safeX, sy, safeZ],
              scale: [st.thick * 1.1, st.thick * 1.1, lenZ],
              onUpdate: noInk,
            }, h("boxGeometry", { args: [1, 1, 1] }));
          }),
          h(RibbonLine, { points: plannedPts, width: 0.075, color: "#38f2c2" }),
          ...[1.5, -2.0, -6.0].map((mz, i) =>
            h("mesh", { key: `mr-${i}`, material: ringMat, position: [mz * -0.1, mz * -0.03, mz], onUpdate: noInk }, h("torusGeometry", { args: [0.38, 0.02, 8, 24] })),
          ),
          h("mesh", { material: tagCruiseMat, position: [-0.20, 1.72, -0.85], onUpdate: noInk }, h("planeGeometry", { args: [1.8, 0.45] })),
        )
      : null,

    // Shot 16 (unchanged)
    shotId === 16
      ? h(
          "group",
          null,
          h(RibbonLine, { points: plannedPts, width: 0.075, color: "#38f2c2" }),
          ...[1.5, -2.0, -6.0].map((mz, i) =>
            h("mesh", { key: `mr-${i}`, material: ringMat, position: [mz * -0.1, mz * -0.03, mz], onUpdate: noInk }, h("torusGeometry", { args: [0.38, 0.02, 8, 24] })),
          ),
          h(RibbonLine, { points: actualPts, width: 0.085, color: "#ff5733" }),
          h("mesh", { material: tagPlannedMat, position: [-0.75, 0.72, -3.5], onUpdate: noInk }, h("planeGeometry", { args: [1.65, 0.42] })),
          h("mesh", { material: tagActualMat, position: [1.95, -1.25, -3.5], onUpdate: noInk }, h("planeGeometry", { args: [1.65, 0.42] })),
        )
      : null,
  );
};

// ---------------- SET 2: LaunchPadSet (Shot 3) ----------------
export const LaunchPadSet: React.FC<{ u: number }> = ({ u }) => {
  const skyMat = useMemo(
    () => basicMat("pad_dawn_sky", () => ({ map: getDiegeticTexture("dawn_sky"), side: THREE.BackSide, depthWrite: false })),
    [],
  );
  const padMat = useMemo(() => toonLam("pad_concrete", () => ({ map: getDiegeticTexture("concrete_pad") })), []);
  const steelRedMat = useMemo(() => toonLam("pad_tower_red", () => ({ color: "#c44536" })), []);
  const steelWhiteMat = useMemo(() => toonLam("pad_tower_white", () => ({ color: "#e9ecef" })), []);
  const tankMat = useMemo(() => toonLam("pad_lox_tank", () => ({ color: "#eef2f6" })), []);
  const darkMetalMat = useMemo(() => toonLam("pad_dark_metal", () => ({ color: "#3b424d" })), []);
  const brickMat = useMemo(() => toonLam("pad_refractory", () => ({ color: "#785341" })), []);
  const signMat = useMemo(() => basicMat("pad_sign", () => ({ map: getDiegeticTexture("pad_sign_lc17a"), toneMapped: false })), []);
  const steamMat = useMemo(() => basicMat("pad_steam", () => ({ color: "#f6efe4", transparent: true, opacity: 0.78, toneMapped: false })), []);

  const ignition = smoothstep(0.0, 0.22, u);
  const liftoff = u > 0.22 ? (u - 0.22) / 0.78 : 0;
  const armRetract = smoothstep(0.05, 0.24, u) * 0.65;

  return h(
    "group",
    null,
    h("mesh", { material: skyMat, onUpdate: noInk }, h("sphereGeometry", { args: [90, 28, 18] })),
    h("mesh", { material: padMat, position: [0, -0.25, 0], receiveShadow: true }, h("boxGeometry", { args: [28, 0.5, 28] })),
    h("mesh", { material: brickMat, position: [0, 0.12, 0], receiveShadow: true }, h("boxGeometry", { args: [3.4, 0.26, 5.2] })),
    h(
      "group",
      { position: [-2.2, 0, -0.5] },
      ...[0, 1, 2, 3, 4, 5].map((tier) =>
        h("mesh", { key: `tw-${tier}`, material: tier % 2 === 0 ? steelRedMat : steelWhiteMat, position: [0, 1.1 + tier * 2.1, 0], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [1.35, 2.05, 1.35] })),
      ),
      ...[3.2, 6.2, 9.2].map((ay, idx) =>
        h(
          "group",
          { key: `arm-${idx}`, position: [0.68, ay, 0.5], rotation: [0, armRetract, 0] },
          h("mesh", { material: steelWhiteMat, position: [0.85, 0, 0], castShadow: true }, h("boxGeometry", { args: [1.7, 0.16, 0.18] })),
        ),
      ),
    ),
    h("group", { position: [-5.2, 0, -2.4] }, h("mesh", { material: darkMetalMat, position: [0, 5.2, 0], castShadow: true }, h("boxGeometry", { args: [2.2, 10.4, 2.2] }))),
    ...[-6.5, 6.5].map((lx, i) =>
      h("mesh", { key: `lm-${i}`, material: steelWhiteMat, position: [lx, 7.5, -5.0], castShadow: true }, h("cylinderGeometry", { args: [0.12, 0.24, 15.0, 8] })),
    ),
    h(
      "group",
      { position: [4.8, 2.1, -1.8] },
      h("mesh", { material: tankMat, castShadow: true, receiveShadow: true }, h("sphereGeometry", { args: [1.65, 20, 16] })),
      ...[-1.0, 1.0].map((lx, i) => h("mesh", { key: `tl-${i}`, material: darkMetalMat, position: [lx, -1.1, 0] }, h("cylinderGeometry", { args: [0.1, 0.12, 2.2, 8] }))),
    ),
    ...([[-4.2, 4.2], [4.2, 4.2], [-4.2, -4.2], [4.2, -4.2]] as [number, number][]).map(([fx, fz], i) =>
      h("mesh", { key: `fl-${i}`, material: darkMetalMat, position: [fx, 1.6, fz], castShadow: true }, h("cylinderGeometry", { args: [0.08, 0.1, 3.2, 8] })),
    ),
    h(
      "group",
      { position: [2.8, 1.15, 4.5], rotation: [0, -0.35, 0] },
      h("mesh", { material: darkMetalMat, position: [-0.85, -0.55, 0] }, h("cylinderGeometry", { args: [0.06, 0.06, 1.2, 8] })),
      h("mesh", { material: darkMetalMat, position: [0.85, -0.55, 0] }, h("cylinderGeometry", { args: [0.06, 0.06, 1.2, 8] })),
      h("mesh", { material: darkMetalMat }, h("boxGeometry", { args: [2.1, 1.05, 0.1] })),
      h("mesh", { material: signMat, position: [0, 0, 0.055], onUpdate: noInk }, h("planeGeometry", { args: [1.95, 0.95] })),
    ),
    h(DeltaIIRocket, { liftoffProgress: liftoff, ignitionProgress: ignition }),
    ...(ignition > 0.04
      ? EXHAUST_PUFFS.map((p, i) => {
          const grow = ignition * (0.4 + liftoff * 1.4);
          const dist = p.speed * grow;
          return h(
            "mesh",
            {
              key: `ex-${i}`,
              material: steamMat,
              position: [Math.cos(p.angle) * dist, 0.35 + p.lift * grow, Math.sin(p.angle) * dist],
              scale: p.baseScale * (0.6 + grow * 1.2),
              onUpdate: noInk,
            },
            h("sphereGeometry", { args: [1, 12, 10] }),
          );
        })
      : []),
  );
};

// ---------------- SET 3: JplControlRoomSet (Shots 4, 5, 7, 9, 10, 15, 19, 22B, 23) ----------------
export const JplControlRoomSet: React.FC<{
  shotId: ShotId;
  u: number;
  frame: number;
}> = ({ shotId, u, frame }) => {
  const isDark = shotId === 23 || (shotId === 22 && u >= 0.58);
  const isSplit = shotId === 7 || shotId === 10;

  const wallMat = useMemo(
    () =>
      toonLam(isDark ? "jpl_wall_dark" : "jpl_wall_lit", () => ({
        map: getDiegeticTexture("jpl_wall"),
        color: isDark ? "#3b4758" : "#eae5da",
      })),
    [isDark],
  );
  const floorMat = useMemo(
    () =>
      toonLam(isDark ? "jpl_floor_dark" : "jpl_floor_lit", () => ({
        map: getDiegeticTexture("jpl_floor"),
        color: isDark ? "#38434f" : "#a3b0bd",
      })),
    [isDark],
  );
  const ceilingMat = useMemo(() => toonLam("jpl_ceil", () => ({ color: isDark ? "#232b36" : "#d0cac0" })), [isDark]);
  const trofferMat = useMemo(() => basicMat(isDark ? "troffer_dim" : "troffer_on", () => ({ color: isDark ? "#2f3d4d" : "#fff9ec", toneMapped: false })), [isDark]);
  const rackMat = useMemo(() => toonLam("jpl_rack", () => ({ color: "#2d3744" })), []);
  const chairMat = useMemo(() => toonLam("jpl_chair", () => ({ color: "#2c4666" })), []);
  const metalMat = useMemo(() => toonLam("jpl_metal", () => ({ color: "#687482" })), []);
  const glassMat = useMemo(() => basicMat("jpl_divider", () => ({ color: "#a8d4f0", transparent: true, opacity: 0.35 })), []);

  const bigScreenTexId =
    shotId === 15 ? "split_burn_plot" : shotId === 22 ? "flatline_trace" : "weather_big_screen";
  const bigScreenMat = useMemo(
    () =>
      shotId === 23
        ? basicMat("big_scr_off", () => ({ color: "#121822" }))
        : basicMat(`big_${bigScreenTexId}`, () => ({ map: getDiegeticTexture(bigScreenTexId), toneMapped: false })),
    [shotId, bigScreenTexId],
  );
  const navLeftMat = useMemo(
    () =>
      shotId === 23
        ? basicMat("nav_off", () => ({ color: "#101720" }))
        : basicMat("nav_left_scr", () => ({ map: getDiegeticTexture("jpl_nav_screen"), toneMapped: false })),
    [shotId],
  );
  const costBoardMat = useMemo(
    () =>
      basicMat(shotId === 23 ? "cost_lost" : "cost_125m", () => ({
        map: getDiegeticTexture(shotId === 23 ? "cost_board_lost" : "cost_board_125m"),
        toneMapped: false,
      })),
    [shotId],
  );
  const calendarMat = useMemo(() => basicMat("cal_23sep", () => ({ map: getDiegeticTexture("calendar_23sep1999"), toneMapped: false })), []);
  const plaqueMat = useMemo(() => basicMat("plaque_show", () => ({ map: getDiegeticTexture("plaque_showcase"), toneMapped: false })), []);
  const signLockMat = useMemo(() => basicMat("sign_lock", () => ({ map: getDiegeticTexture("team_sign_lockheed"), toneMapped: false })), []);
  const signJplMat = useMemo(() => basicMat("sign_jpl", () => ({ map: getDiegeticTexture("team_sign_jpl"), toneMapped: false })), []);
  const handoffMat = useMemo(() => basicMat("handoff_mon", () => ({ map: getDiegeticTexture("handoff_banner"), toneMapped: false })), []);

  const splitProg = shotId === 15 ? smoothstep(0.15, 0.85, u) : 0;
  const splitJplPts: V3[] = useMemo(
    () => [[-1.55, 1.85, -3.72], [-0.65, 2.02, -3.72], [0.35 + splitProg * 1.15, 2.20 + splitProg * 0.14, -3.72]],
    [splitProg],
  );
  const splitRealPts: V3[] = useMemo(
    () => [[-1.55, 1.85, -3.72], [-0.65, 1.62 - splitProg * 0.25, -3.72], [0.35 + splitProg * 1.15, 1.48 - splitProg * 0.55, -3.72]],
    [splitProg],
  );
  const flatPts: V3[] = useMemo(() => {
    const pts: V3[] = [];
    const flatStart = clamp01((u - 0.58) / 0.28);
    for (let i = 0; i <= 14; i++) {
      const x = -1.6 + (i / 14) * 3.2;
      const alive = i / 14 < 1 - flatStart ? Math.sin(i * 1.7 + frame * 0.35) * 0.32 : 0;
      pts.push([x, 1.92 + alive, -3.72]);
    }
    return pts;
  }, [u, frame]);

  return h(
    "group",
    null,
    h("mesh", { material: floorMat, rotation: [-Math.PI / 2, 0, 0], receiveShadow: true }, h("planeGeometry", { args: [14, 14] })),
    h("mesh", { material: wallMat, position: [0, 2.5, -4.1], receiveShadow: true }, h("boxGeometry", { args: [14, 5.2, 0.25] })),
    h("mesh", { material: wallMat, position: [-6.2, 2.5, 0], rotation: [0, Math.PI / 2, 0], receiveShadow: true }, h("boxGeometry", { args: [14, 5.2, 0.25] })),
    h("mesh", { material: wallMat, position: [6.2, 2.5, 0], rotation: [0, Math.PI / 2, 0], receiveShadow: true }, h("boxGeometry", { args: [14, 5.2, 0.25] })),
    h("mesh", { material: ceilingMat, position: [0, 4.9, 0], rotation: [Math.PI / 2, 0, 0] }, h("planeGeometry", { args: [14, 14] })),
    ...[-2.8, 0, 2.8].flatMap((tx) =>
      [-2.0, 1.2].map((tz) =>
        h("mesh", { key: `tr-${tx}-${tz}`, material: trofferMat, position: [tx, 4.86, tz], rotation: [Math.PI / 2, 0, 0], onUpdate: noInk }, h("planeGeometry", { args: [1.6, 0.55] })),
      ),
    ),
    // Center Big Projection Screen
    h(
      "group",
      { position: [0, 1.98, -3.88] },
      h("mesh", { material: rackMat, castShadow: true }, h("boxGeometry", { args: [3.9, 2.05, 0.18] })),
      h("mesh", { material: bigScreenMat, position: [0, 0, 0.1], onUpdate: noInk }, h("planeGeometry", { args: [3.68, 1.85] })),
    ),
    shotId === 15
      ? h("group", null, h(RibbonLine, { points: splitJplPts, width: 0.05, color: "#48f0d8" }), h(RibbonLine, { points: splitRealPts, width: 0.065, color: "#ff6238" }))
      : null,
    shotId === 22 && u >= 0.58 ? h(RibbonLine, { points: flatPts, width: 0.055, color: "#ff4a36" }) : null,
    // Wall Calendar Plaque ("23 SEP 1999")
    h(
      "group",
      { position: [0, 3.55, -3.9] },
      h("mesh", { material: rackMat, castShadow: true }, h("boxGeometry", { args: [2.1, 1.0, 0.12] })),
      h("mesh", { material: calendarMat, position: [0, 0, 0.07], onUpdate: noInk }, h("planeGeometry", { args: [1.95, 0.90] })),
    ),
    // Left Upper Telemetry Screen
    h(
      "group",
      { position: [-3.3, 2.45, -3.88] },
      h("mesh", { material: rackMat, castShadow: true }, h("boxGeometry", { args: [2.2, 1.2, 0.16] })),
      h("mesh", { material: navLeftMat, position: [0, 0, 0.09], onUpdate: noInk }, h("planeGeometry", { args: [2.02, 1.04] })),
    ),
    // Right Upper Cost Board ($125M)
    h(
      "group",
      { position: [shotId === 5 || shotId === 23 ? 1.55 : 3.3, 2.45, -3.72] },
      h("mesh", { material: rackMat, castShadow: true }, h("boxGeometry", { args: [2.3, 1.25, 0.18] })),
      h("mesh", { material: costBoardMat, position: [0, 0, 0.1], onUpdate: noInk }, h("planeGeometry", { args: [2.12, 1.08] })),
    ),
    // Server Racks
    ...[-5.1, 5.1].map((rx, idx) =>
      h(
        "group",
        { key: `rk-${idx}`, position: [rx, 1.35, -3.65] },
        h("mesh", { material: rackMat, castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [1.05, 2.7, 0.85] })),
        ...[0.8, 0.4, 0.0, -0.4].map((ly, li) => {
          const on = ((frame >> 3) + li + idx) % 2 === 0;
          return h(
            "mesh",
            { key: `led-${li}`, material: basicMat(`led_${on ? 1 : 0}`, () => ({ color: on ? "#4bf5a8" : "#ffb038", toneMapped: false })), position: [0.2, ly, 0.44], onUpdate: noInk },
            h("boxGeometry", { args: [0.18, 0.05, 0.02] }),
          );
        }),
      ),
    ),
    // Console Banks
    isSplit
      ? h(
          "group",
          null,
          h(DeskConsoleUnit, { position: [-1.75, 0, -0.35], rotationY: Math.PI, screenTex: "lockheed_lbfs", binderColor: "#d97b28" }),
          h(DeskConsoleUnit, { position: [1.75, 0, -0.35], rotationY: Math.PI, screenTex: "jpl_ns", binderColor: "#2288b8" }),
          h("mesh", { material: metalMat, position: [0, 0.55, -0.35], castShadow: true }, h("boxGeometry", { args: [0.12, 1.1, 1.35] })),
          h("mesh", { material: glassMat, position: [0, 1.45, -0.35], onUpdate: noInk }, h("boxGeometry", { args: [0.04, 0.75, 1.3] })),
          h("mesh", { material: signLockMat, position: [-1.75, 2.45, -1.2], onUpdate: noInk }, h("planeGeometry", { args: [2.0, 0.52] })),
          h("mesh", { material: signJplMat, position: [1.75, 2.45, -1.2], onUpdate: noInk }, h("planeGeometry", { args: [2.0, 0.52] })),
          shotId === 10
            ? h("mesh", { material: handoffMat, position: [0, 2.25, -1.1], onUpdate: noInk }, h("planeGeometry", { args: [2.4, 0.48] }))
            : null,
        )
      : h(
          "group",
          null,
          h(DeskConsoleUnit, { position: [-1.75, 0, -0.35], rotationY: Math.PI, screenTex: "jpl_nav_screen", screenDark: isDark, binderColor: "#c44536" }),
          h(DeskConsoleUnit, { position: [0.0, 0, -0.35], rotationY: Math.PI, screenTex: "weather_big_screen", screenDark: isDark, binderColor: "#2b6cb0" }),
          h(DeskConsoleUnit, { position: [1.75, 0, -0.35], rotationY: Math.PI, screenTex: "jpl_nav_screen", screenDark: isDark, binderColor: "#2f855a" }),
        ),
    h(DeskConsoleUnit, { position: [-3.7, 0.15, -1.65], rotationY: Math.PI - 0.35, screenTex: "jpl_nav_screen", screenDark: isDark }),
    h(DeskConsoleUnit, { position: [3.7, 0.15, -1.65], rotationY: Math.PI + 0.35, screenTex: "jpl_nav_screen", screenDark: isDark }),
    // Ergonomic Chairs
    ...[-3.15, -2.55, 2.55, 3.15].map((cx, i) =>
      h(
        "group",
        { key: `ch-${i}`, position: [cx, 0, 0.95], rotation: [0, cx < 0 ? 0.4 : -0.4, 0] },
        h("mesh", { material: metalMat, position: [0, 0.22, 0] }, h("cylinderGeometry", { args: [0.04, 0.22, 0.42, 10] })),
        h("mesh", { material: chairMat, position: [0, 0.45, 0], castShadow: true }, h("boxGeometry", { args: [0.44, 0.08, 0.44] })),
        h("mesh", { material: chairMat, position: [0, 0.72, 0.19], castShadow: true }, h("boxGeometry", { args: [0.40, 0.46, 0.07] })),
      ),
    ),
    // Showcase Pedestal (Shot 5)
    shotId === 5
      ? h(
          "group",
          { position: [1.25, 0, 0.9] },
          h("mesh", { material: rackMat, position: [0, 0.52, 0], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [0.86, 1.04, 0.86] })),
          h("mesh", { material: plaqueMat, position: [0, 0.75, 0.44], onUpdate: noInk }, h("planeGeometry", { args: [0.72, 0.28] })),
          h(MarsClimateOrbiter, { position: [0, 1.48, 0], rotation: [0.18, -0.5 + u * 0.45, 0.05], scale: 0.32 }),
        )
      : null,
  );
};

// ---------------- SET 4: LockheedOfficeSet (Shot 8) ----------------
export const LockheedOfficeSet: React.FC<{ u: number }> = ({ u }) => {
  const floorMat = useMemo(() => toonLam("off_parquet", () => ({ map: getDiegeticTexture("office_parquet") })), []);
  const wallMat = useMemo(() => toonLam("off_wall", () => ({ color: "#e8dfd0" })), []);
  const oakMat = useMemo(() => toonLam("off_oak", () => ({ color: "#c9975c" })), []);
  const steelMat = useMemo(() => toonLam("off_steel", () => ({ color: "#4e5966" })), []);
  const windowSkyMat = useMemo(() => basicMat("off_win_sky", () => ({ color: "#cbe6ff", toneMapped: false })), []);
  const blueprintMat = useMemo(() => basicMat("off_bp", () => ({ map: getDiegeticTexture("lockheed_blueprint"), toneMapped: false })), []);
  const whiteboardMat = useMemo(() => basicMat("off_wb", () => ({ map: getDiegeticTexture("lockheed_whiteboard"), toneMapped: false })), []);
  const plantMat = useMemo(() => toonLam("off_plant", () => ({ color: "#4c8a4f" })), []);
  const potMat = useMemo(() => toonLam("off_pot", () => ({ color: "#b8623d" })), []);
  const paperMat = useMemo(() => toonLam("off_paper", () => ({ color: "#f5f1e6" })), []);

  return h(
    "group",
    null,
    h("mesh", { material: floorMat, rotation: [-Math.PI / 2, 0, 0], receiveShadow: true }, h("planeGeometry", { args: [12, 12] })),
    h("mesh", { material: wallMat, position: [0, 2.4, -3.5], receiveShadow: true }, h("boxGeometry", { args: [12, 4.8, 0.25] })),
    h("mesh", { material: wallMat, position: [-4.8, 2.4, 0], rotation: [0, Math.PI / 2, 0], receiveShadow: true }, h("boxGeometry", { args: [12, 4.8, 0.25] })),
    h("mesh", { material: wallMat, position: [4.8, 2.4, 0], rotation: [0, Math.PI / 2, 0], receiveShadow: true }, h("boxGeometry", { args: [12, 4.8, 0.25] })),
    h(
      "group",
      { position: [-2.4, 2.15, -3.32] },
      h("mesh", { material: windowSkyMat, onUpdate: noInk }, h("planeGeometry", { args: [2.6, 1.8] })),
      ...[-0.6, -0.3, 0, 0.3, 0.6].map((sy, i) => h("mesh", { key: `sl-${i}`, material: wallMat, position: [0, sy, 0.04] }, h("boxGeometry", { args: [2.6, 0.06, 0.04] }))),
    ),
    h(
      "group",
      { position: [1.1, 2.15, -3.32] },
      h("mesh", { material: steelMat }, h("boxGeometry", { args: [2.5, 1.35, 0.08] })),
      h("mesh", { material: whiteboardMat, position: [0, 0, 0.05], onUpdate: noInk }, h("planeGeometry", { args: [2.35, 1.2] })),
    ),
    h(
      "group",
      { position: [0, 0, -0.25] },
      h("mesh", { material: oakMat, position: [0, 0.82, 0], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [2.6, 0.06, 1.25] })),
      ...([[-1.15, -0.5], [1.15, -0.5], [-1.15, 0.5], [1.15, 0.5]] as [number, number][]).map(([lx, lz], i) =>
        h("mesh", { key: `tl-${i}`, material: steelMat, position: [lx, 0.4, lz], castShadow: true }, h("boxGeometry", { args: [0.08, 0.8, 0.08] })),
      ),
      h("mesh", { material: blueprintMat, position: [-0.35, 0.855, 0.05], rotation: [-Math.PI / 2, 0, 0.06], onUpdate: noInk }, h("planeGeometry", { args: [1.45, 0.78] })),
      h(MarsClimateOrbiter, { position: [0.62, 1.15, -0.05], rotation: [0.12, -0.45 + u * 0.2, 0.05], scale: 0.23 }),
      h("mesh", { material: paperMat, position: [-0.95, 0.88, -0.35], castShadow: true }, h("boxGeometry", { args: [0.32, 0.07, 0.42] })),
      h("mesh", { material: steelMat, position: [0.15, 0.86, 0.35], rotation: [0, 0.25, 0] }, h("boxGeometry", { args: [0.42, 0.015, 0.05] })),
    ),
    h(DeskConsoleUnit, { position: [2.55, 0, -1.65], rotationY: -0.6, screenTex: "lockheed_lbfs", binderColor: "#d97b28" }),
    h(
      "group",
      { position: [-3.3, 0, -2.5] },
      ...[-0.12, 0, 0.12].map((tx, i) => h("mesh", { key: `tb-${i}`, material: paperMat, position: [tx, 0.5, i * 0.08], castShadow: true }, h("cylinderGeometry", { args: [0.055, 0.055, 1.0, 10] }))),
    ),
    h(
      "group",
      { position: [-3.6, 0, -1.4] },
      h("mesh", { material: potMat, position: [0, 0.24, 0], castShadow: true }, h("cylinderGeometry", { args: [0.24, 0.18, 0.48, 12] })),
      h("mesh", { material: plantMat, position: [0, 0.78, 0], castShadow: true }, h("sphereGeometry", { args: [0.42, 12, 10] })),
    ),
    ...[-1.5, 0, 1.5].map((px, i) => h("mesh", { key: `pd-${i}`, material: steelMat, position: [px, 3.6, -0.3], castShadow: true }, h("coneGeometry", { args: [0.24, 0.22, 12] }))),
    ...[-0.65, 0.65].map((sx, i) =>
      h(
        "group",
        { key: `st-${i}`, position: [sx, 0, 0.88] },
        h("mesh", { material: steelMat, position: [0, 0.28, 0] }, h("cylinderGeometry", { args: [0.04, 0.18, 0.56, 10] })),
        h("mesh", { material: oakMat, position: [0, 0.58, 0], castShadow: true }, h("cylinderGeometry", { args: [0.2, 0.2, 0.06, 14] })),
      ),
    ),
  );
};

// ---------------- SET 5: DataScreenCloseupSet (Shots 11, 12, 13, 24) ----------------
export const DataScreenCloseupSet: React.FC<{
  shotId: ShotId;
  u: number;
}> = ({ shotId, u }) => {
  const isForensic = shotId === 24;

  const deskMat = useMemo(() => toonLam(isForensic ? "ds_desk_dark" : "ds_desk", () => ({ color: isForensic ? "#3b434f" : "#c9baa3" })), [isForensic]);
  const bezelMat = useMemo(() => toonLam(isForensic ? "ds_bez_dark" : "ds_bez", () => ({ color: isForensic ? "#4b5563" : "#cfc7b8" })), [isForensic]);
  const backWallMat = useMemo(() => toonLam(isForensic ? "ds_wall_dark" : "ds_wall", () => ({ color: isForensic ? "#222b38" : "#627894" })), [isForensic]);
  const keyMat = useMemo(() => toonLam("ds_key", () => ({ color: "#e6e0d4" })), []);
  const accentMat = useMemo(() => toonLam("ds_acc", () => ({ color: "#d69438" })), []);
  const mugMat = useMemo(() => toonLam("ds_mug", () => ({ color: "#f0ece2" })), []);
  const paperMat = useMemo(() => toonLam("ds_paper", () => ({ color: "#f7f4eb" })), []);
  const stickyMat = useMemo(() => basicMat("ds_sticky", () => ({ map: getDiegeticTexture("sticky_note"), toneMapped: false })), []);

  const texId =
    shotId === 11
      ? "lockheed_lbfs"
      : shotId === 12
        ? "jpl_ns"
        : shotId === 13
          ? "conversion_bars"
          : "ecu_datafile_final";
  const screenMat = useMemo(
    () => basicMat(`ds_scr_${texId}`, () => ({ map: getDiegeticTexture(texId), toneMapped: false })),
    [texId],
  );
  const cyanBarMat = useMemo(() => basicMat("bar_cyan", () => ({ color: "#36e3f5", toneMapped: false })), []);
  const redBarMat = useMemo(() => basicMat("bar_red", () => ({ color: "#ff6633", toneMapped: false })), []);
  const splitLeftMat = useMemo(() => basicMat("s13_left", () => ({ map: getDiegeticTexture("split_left_jpl"), toneMapped: false })), []);
  const splitRightMat = useMemo(() => basicMat("s13_right", () => ({ map: getDiegeticTexture("split_right_lockheed"), toneMapped: false })), []);
  const tagLbfsMat = useMemo(() => basicMat("s13_lbfs", () => ({ map: getDiegeticTexture("tag_lbfs_plug"), toneMapped: false })), []);
  const tagNsMat = useMemo(() => basicMat("s13_ns", () => ({ map: getDiegeticTexture("tag_ns_socket"), toneMapped: false })), []);
  const tag1xMat = useMemo(() => basicMat("s13_1x", () => ({ map: getDiegeticTexture("tag_1x_cap"), toneMapped: false })), []);
  const tag445xMat = useMemo(() => basicMat("s13_445x", () => ({ map: getDiegeticTexture("tag_445x_cap"), toneMapped: false })), []);
  const socketSteelMat = useMemo(() => toonLam("s13_sock", () => ({ color: "#2d5d7b" })), []);
  const socketHoleMat = useMemo(() => basicMat("s13_hole", () => ({ color: "#081422", toneMapped: false })), []);
  const plugGoldMat = useMemo(() => toonLam("s13_plug", () => ({ color: "#f59d2a" })), []);
  const sparkMat = useMemo(() => basicMat("s13_spark", () => ({ color: "#ffe055", toneMapped: false })), []);
  const shockRingMat = useMemo(() => basicMat("s13_ring", () => ({ color: "#ff7236", transparent: true, opacity: 0.85, toneMapped: false })), []);
  const dividerMat = useMemo(() => toonLam("s13_div", () => ({ color: "#dfe8f2" })), []);
  const cursorMat = useMemo(
    () =>
      basicMat(`ds_cursor_${shotId}`, () => ({
        color: shotId === 11 ? "#ffcf54" : shotId === 12 ? "#ff6b52" : "#ff4d36",
        transparent: true,
        opacity: 0.38,
        toneMapped: false,
      })),
    [shotId],
  );

  // Shot 13 dedicated kinetic split-screen stage (bars + mismatched fit-failure collision beats)
  if (shotId === 13) {
    // 1x cyan bar grows rapidly and locks; 4.45x amber-red bar surges side-by-side to 4.45x height
    const unitPx = 0.195; // exact world height per 1x scale tick on the 0.74x1.56 split panel
    const multLeft = 0.15 + 0.85 * smoothstep(0.03, 0.24, u);
    const multRight = 0.18 + 4.27 * smoothstep(0.04, 0.78, u);
    const hL = multLeft * unitPx;
    const hR = multRight * unitPx;
    const baseY = 0.70;

    // 3 kinetic slam collisions peaking at u = 0.22, 0.50 (midFrame 983!), 0.78
    let slam = 0;
    for (const c of [0.22, 0.50, 0.78]) {
      const d = u - c;
      if (d >= -0.16 && d <= 0.13) {
        const val = d < 0 ? 1 - Math.pow(-d / 0.16, 1.55) : 1 - Math.pow(d / 0.13, 0.65);
        slam = Math.max(slam, clamp01(val));
      }
    }
    const impactFlash = clamp01((slam - 0.78) / 0.22);
    const plugX = 0.44 - slam * 0.47; // approaches from +0.44 and collides into socket mouth at -0.03
    const socketRecoil = -impactFlash * 0.032;

    return h(
      "group",
      null,
      h("mesh", { material: backWallMat, position: [0, 1.6, -1.4], receiveShadow: true }, h("boxGeometry", { args: [8, 5.5, 0.2] })),
      h("mesh", { material: deskMat, position: [0, 0.42, 0.2], receiveShadow: true }, h("boxGeometry", { args: [4.5, 0.24, 2.2] })),

      // Left Split Panel (JPL N·s, 1x)
      h(
        "group",
        { position: [-0.39, 1.32, 0] },
        h("mesh", { material: bezelMat, position: [0, 0, -0.08], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [0.76, 1.60, 0.14] })),
        h("mesh", { material: splitLeftMat, position: [0, 0, 0.002], onUpdate: noInk }, h("planeGeometry", { args: [0.74, 1.56] })),
      ),

      // Right Split Panel (Actual lbf·s, 4.45x)
      h(
        "group",
        { position: [0.39, 1.32, 0] },
        h("mesh", { material: bezelMat, position: [0, 0, -0.08], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [0.76, 1.60, 0.14] })),
        h("mesh", { material: splitRightMat, position: [0, 0, 0.002], onUpdate: noInk }, h("planeGeometry", { args: [0.74, 1.56] })),
      ),

      // Central Split Divider Pillar
      h("mesh", { material: dividerMat, position: [0, 1.32, 0.03], castShadow: true }, h("boxGeometry", { args: [0.032, 1.64, 0.10] })),

      // Growing 3D Bars Side-by-Side
      h("mesh", { material: cyanBarMat, position: [-0.39, baseY + hL * 0.5, 0.10], castShadow: true }, h("boxGeometry", { args: [0.22, hL, 0.14] })),
      h("mesh", { material: tag1xMat, position: [-0.39, baseY + hL + 0.065, 0.14], onUpdate: noInk }, h("planeGeometry", { args: [0.24, 0.09] })),

      h("mesh", { material: redBarMat, position: [0.39, baseY + hR * 0.5, 0.10], castShadow: true }, h("boxGeometry", { args: [0.22, hR, 0.14] })),
      h("mesh", { material: tag445xMat, position: [0.39, baseY + hR + 0.068, 0.14], onUpdate: noInk }, h("planeGeometry", { args: [0.26, 0.095] })),

      // Upper Kinetic Mismatched Coupler Rig (Oversized lbf·s Plug vs Undersized N·s Socket)
      h(
        "group",
        { position: [0, 2.38, 0.24] },
        // Small Cyan N·s Socket Block (left)
        h(
          "group",
          { position: [-0.34 + socketRecoil, 0, 0], rotation: [0, 0, impactFlash * 0.06] },
          h("mesh", { material: socketSteelMat, castShadow: true }, h("boxGeometry", { args: [0.34, 0.34, 0.26] })),
          h("mesh", { material: cyanBarMat, position: [0.17, 0, 0], rotation: [0, Math.PI / 2, 0], onUpdate: noInk }, h("torusGeometry", { args: [0.082, 0.016, 10, 24] })),
          h("mesh", { material: socketHoleMat, position: [0.172, 0, 0], rotation: [0, 0, Math.PI / 2], onUpdate: noInk }, h("cylinderGeometry", { args: [0.066, 0.066, 0.02, 18] })),
          h("mesh", { material: tagNsMat, position: [0, 0, 0.135], onUpdate: noInk }, h("planeGeometry", { args: [0.24, 0.12] })),
        ),
        // Oversized Amber lbf·s Hex Bolt / Key Plug (right -> slams left into socket)
        h(
          "group",
          { position: [plugX, 0, 0], rotation: [0, 0, -impactFlash * 0.04] },
          h("mesh", { material: plugGoldMat, position: [-0.04, 0, 0], rotation: [0, 0, Math.PI / 2], castShadow: true }, h("cylinderGeometry", { args: [0.135, 0.145, 0.22, 6] })),
          h("mesh", { material: plugGoldMat, position: [0.15, 0, 0], rotation: [0, 0, Math.PI / 2], castShadow: true }, h("cylinderGeometry", { args: [0.21, 0.21, 0.20, 6] })),
          h("mesh", { material: tagLbfsMat, position: [0.15, 0, 0.225], onUpdate: noInk }, h("planeGeometry", { args: [0.26, 0.13] })),
        ),
        // Collision Shock-Ring + Radial Sparks on impact (positioned behind front badges so text stays crisp)
        impactFlash > 0.05
          ? h(
              "group",
              { position: [-0.17, 0, -0.04] },
              h("mesh", { material: shockRingMat, rotation: [0, Math.PI / 2, 0], scale: 0.7 + impactFlash * 0.9, onUpdate: noInk }, h("torusGeometry", { args: [0.15, 0.016, 8, 24] })),
              ...IMPACT_SPARKS.map((sp, i) =>
                h("mesh", {
                  key: `ispk-${i}`,
                  material: sparkMat,
                  position: [sp.dx * sp.speed * impactFlash * 1.15, sp.dy * sp.speed * impactFlash * 1.15, -0.05 + sp.dz * impactFlash * 0.25],
                  scale: sp.scale * (0.55 + impactFlash * 0.65),
                  onUpdate: noInk,
                }, h("octahedronGeometry", { args: [1, 0] })),
              ),
            )
          : null,
      ),
    );
  }

  const sweepX = shotId === 11 ? -0.35 + smoothstep(0.1, 0.7, u) * 0.45 : 0.14;
  const bracketScale = shotId === 24 ? 1.26 - 0.26 * smoothstep(0.08, 0.44, u) : 1;

  return h(
    "group",
    null,
    h("mesh", { material: backWallMat, position: [0, 1.8, -1.6], receiveShadow: true }, h("boxGeometry", { args: [8, 5, 0.2] })),
    h("mesh", { material: bezelMat, position: [-1.4, 1.4, -0.95], rotation: [0, 0.25, 0], castShadow: true }, h("boxGeometry", { args: [0.9, 1.8, 0.5] })),
    h("mesh", { material: deskMat, position: [0, 0.62, 0.2], receiveShadow: true }, h("boxGeometry", { args: [4.5, 0.2, 2.2] })),
    h(
      "group",
      { position: [0, 1.25, 0] },
      h("mesh", { material: bezelMat, position: [0, 0, -0.18], castShadow: true, receiveShadow: true }, h("boxGeometry", { args: [1.18, 1.16, 0.34] })),
      h("mesh", { material: bezelMat, position: [0, -0.62, -0.15] }, h("cylinderGeometry", { args: [0.14, 0.22, 0.25, 14] })),
      h("mesh", { material: screenMat, position: [0, 0, 0.002], onUpdate: noInk }, h("planeGeometry", { args: [1.02, 1.02] })),
      shotId === 11 || shotId === 12
        ? h("mesh", { material: cursorMat, position: [sweepX, 0.07, 0.008], onUpdate: noInk }, h("planeGeometry", { args: [0.45, 0.16] }))
        : null,
      shotId === 24
        ? h(
            "group",
            { position: [0.237, 0.101, 0.008], scale: [bracketScale, bracketScale, 1] },
            h("mesh", { material: redBarMat, position: [0, 0.225, 0], onUpdate: noInk }, h("planeGeometry", { args: [0.45, 0.018] })),
            h("mesh", { material: redBarMat, position: [0, -0.225, 0], onUpdate: noInk }, h("planeGeometry", { args: [0.45, 0.018] })),
            h("mesh", { material: redBarMat, position: [-0.216, 0, 0], onUpdate: noInk }, h("planeGeometry", { args: [0.018, 0.468] })),
            h("mesh", { material: redBarMat, position: [0.216, 0, 0], onUpdate: noInk }, h("planeGeometry", { args: [0.018, 0.468] })),
          )
        : null,
      h("mesh", { material: stickyMat, position: [0.48, -0.45, 0.01], rotation: [0, 0, -0.08], onUpdate: noInk }, h("planeGeometry", { args: [0.16, 0.16] })),
    ),
    h(
      "group",
      { position: [0, 0.74, 0.42], rotation: [0.08, 0, 0] },
      h("mesh", { material: bezelMat, castShadow: true }, h("boxGeometry", { args: [0.92, 0.04, 0.28] })),
      ...[-0.06, 0.0, 0.06].map((kz, r) => h("mesh", { key: `kb-${r}`, material: keyMat, position: [0, 0.025, kz] }, h("boxGeometry", { args: [0.82, 0.02, 0.04] }))),
    ),
    h("mesh", { material: paperMat, position: [-0.65, 0.725, 0.36], rotation: [0, 0.15, 0] }, h("boxGeometry", { args: [0.28, 0.01, 0.36] })),
    h("mesh", { material: accentMat, position: [-0.58, 0.74, 0.42], rotation: [0, 0.6, Math.PI / 2] }, h("cylinderGeometry", { args: [0.012, 0.012, 0.18, 8] })),
    h("mesh", { material: mugMat, position: [0.62, 0.78, 0.38], castShadow: true }, h("cylinderGeometry", { args: [0.055, 0.05, 0.12, 14] })),
    h("mesh", { material: bezelMat, position: [0.62, 0.92, -0.15], rotation: [0, 0, 0.35] }, h("cylinderGeometry", { args: [0.018, 0.018, 0.55, 8] })),
  );
};

// ---------------- SET 6: MarsApproachBurnSet (Shots 17, 18, 20, 21, 22A) ----------------
export const MarsApproachBurnSet: React.FC<{
  shotId: ShotId;
  u: number;
  frame: number;
}> = ({ shotId, u, frame }) => {
  const skyMat = useMemo(
    () => basicMat("mars_app_sky", () => ({ map: getDiegeticTexture("nebula_sky"), side: THREE.BackSide, depthWrite: false })),
    [],
  );
  const marsHorizonMat = useMemo(() => toonLam("mars_horizon_mat", () => ({ map: getDiegeticTexture("mars_surface") })), []);
  const limbMat = useMemo(
    () => basicMat("mars_limb", () => ({ color: "#f2a45c", transparent: true, opacity: 0.34, side: THREE.BackSide, depthWrite: false })),
    [],
  );
  const cloudMat = useMemo(
    () => basicMat("mars_cloud_disc", () => ({ color: "#f6c997", transparent: true, opacity: 0.48, depthWrite: false })),
    [],
  );
  const gate226Mat = useMemo(() => basicMat("gate_226_mat", () => ({ map: getDiegeticTexture("gate_226km"), toneMapped: false })), []);
  const gate57Mat = useMemo(() => basicMat("gate_57_mat", () => ({ map: getDiegeticTexture("gate_57km"), toneMapped: false })), []);
  const sparkMat = useMemo(() => basicMat("plasma_spark", () => ({ color: "#ffcf54", toneMapped: false })), []);

  let orbiterPos: V3 = [0, 0.3, 0];
  let orbiterRot: V3 = [0.1, -0.35, 0.05];
  let heatLevel = 0;
  let breakupProgress = 0;
  const cloudShift = (frame - 1614) * 0.45;

  if (shotId === 17) {
    orbiterPos = [-1.4 + u * 2.8, 0.55 - u * 0.25, -0.6];
    orbiterRot = [0.08, -0.35, -0.05];
  } else if (shotId === 18) {
    orbiterPos = [-0.6 + u * 0.9, 0.55 - u * 1.4, -0.5];
    orbiterRot = [0.22, -0.3, -0.18];
    heatLevel = smoothstep(0.6, 1.0, u) * 0.16;
  } else if (shotId === 20) {
    heatLevel = 0.15 + u * 0.43;
    orbiterPos = [0, 0.05 * Math.sin(frame * 0.6), -0.3];
    orbiterRot = [0.15, -0.45, -0.12];
  } else if (shotId === 21) {
    heatLevel = 0.58 + u * 0.37;
    orbiterPos = [0, -0.12 + 0.06 * Math.sin(frame * 0.8), -0.4];
    orbiterRot = [0.18, -0.52, -0.16];
  } else if (shotId === 22) {
    const ua = clamp01(u / 0.58);
    heatLevel = 1.0;
    breakupProgress = ua;
    orbiterPos = [0, 0, -0.3];
    orbiterRot = [0.22 + ua * 0.4, -0.45, -0.15 - ua * 0.5];
  }

  const gate226Pts: V3[] = useMemo(
    () => [[-4.2, 2.35, -1.8], [-1.4, 2.55, -1.5], [1.4, 2.55, -1.5], [4.2, 2.35, -1.8]],
    [],
  );
  const gate57Pts: V3[] = useMemo(
    () => [[-4.2, -0.95, -1.5], [-1.4, -0.82, -1.2], [1.4, -0.82, -1.2], [4.2, -0.95, -1.5]],
    [],
  );
  const divePts: V3[] = useMemo(
    () => [[-1.2, 1.2, 0.2], [-0.4, 0.3, -0.3], [0.3, -0.85, -0.8], [1.2, -1.75, -1.4]],
    [],
  );

  return h(
    "group",
    null,
    h("mesh", { material: skyMat, onUpdate: noInk }, h("sphereGeometry", { args: [78, 28, 18] })),
    h(StarfieldDome, { streamZ: shotId >= 20 ? cloudShift * 0.25 : 0 }),
    h(
      "group",
      { position: [0, -27.2, -3.5], rotation: [0.1, u * 0.08, 0] },
      h("mesh", { material: marsHorizonMat, receiveShadow: true }, h("sphereGeometry", { args: [25.6, 48, 32] })),
      h("mesh", { material: limbMat, onUpdate: noInk }, h("sphereGeometry", { args: [26.2, 36, 24] })),
    ),
    ...ENTRY_CLOUDS.map((c, i) => {
      const z = shotId >= 20 ? (((c.z + cloudShift + 14) % 28 + 28) % 28) - 14 : c.z;
      return h(
        "mesh",
        { key: `cl-${i}`, material: cloudMat, position: [c.x, c.y, z], rotation: [-Math.PI / 2, 0, 0], scale: [c.sx, c.sz, 1], onUpdate: noInk },
        h("circleGeometry", { args: [1, 12] }),
      );
    }),
    shotId === 17 || shotId === 18
      ? h(
          "group",
          null,
          h(RibbonLine, { points: gate226Pts, width: 0.09, color: "#38f2c2" }),
          h("mesh", { material: gate226Mat, position: [0.1, 2.92, -1.5], onUpdate: noInk }, h("planeGeometry", { args: [2.1, 0.52] })),
        )
      : null,
    shotId === 18
      ? h(
          "group",
          null,
          h(RibbonLine, { points: gate57Pts, width: 0.095, color: "#ff5a36" }),
          h(RibbonLine, { points: divePts, width: 0.08, color: "#ff7338" }),
          (() => {
            // 57 KM tag rides the top strip, right of the antenna mast, shrinking as the
            // camera closes in: a fixed label is occluded by the diving craft for u > ~0.7
            // (proven by f1493 on v1/v2). lookY(u) = 0.75 - 1.55 * moveCurve(u) mirrors the
            // shot-18 camera look path in story.ts; x = 0.7 clears the mast (craftX + 0.72 max).
            const shrinkK = smoothstep(0.55, 0.95, u);
            const tagW = 1.4 - 0.7 * shrinkK;
            const tagY = 0.75 - 1.55 * moveCurve(u) + 1.18;
            return h("mesh", { material: gate57Mat, position: [0.62, tagY, -1.3], onUpdate: noInk }, h("planeGeometry", { args: [tagW, tagW / 4] }));
          })(),
        )
      : null,
    h(MarsClimateOrbiter, { position: orbiterPos, rotation: orbiterRot, heatLevel, breakupProgress }),
    ...(shotId >= 20
      ? PLASMA_SPARKS.map((sp, i) => {
          const drift = ((frame * 0.14 + sp.phase) % 4.0) / 4.0;
          return h(
            "mesh",
            {
              key: `spk-${i}`,
              material: sparkMat,
              position: [orbiterPos[0] + sp.ox + sp.vx * drift, orbiterPos[1] + sp.oy + sp.vy * drift, orbiterPos[2] + sp.oz - drift * 2.5],
              scale: sp.scale,
              onUpdate: noInk,
            },
            h("octahedronGeometry", { args: [1, 0] }),
          );
        })
      : []),
  );
};
