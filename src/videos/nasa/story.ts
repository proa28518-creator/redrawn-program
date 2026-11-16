// Binding timeline & camera choreography for "NasaOrbiter" (Mars Climate Orbiter, 1998–1999).
// 24 shots, 2027 frames @ 30 fps (67.57 s), SILENT composition.
// Shot boundaries strictly follow /home/hatch/workspace/bridge/nasa/frame_map.md.
// Every shot has a named continuous camera move with non-zero velocity across [0, 1].

export const FPS = 30;
export const TOTAL_FRAMES = 2027;

export type V3 = [number, number, number];
export type ShotId =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16
  | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24;

export type SetId =
  | "deep-space"
  | "launch-pad"
  | "jpl-control"
  | "lockheed-office"
  | "data-screen"
  | "mars-approach";

export type BeatId = "hook" | "setup" | "escalation" | "reveal";

export type LightMode =
  | "space"
  | "dawn"
  | "ops"
  | "office"
  | "screen"
  | "mars"
  | "dark-ops"
  | "screen-dark";

export type OrbitMove = {
  center: V3;
  radius0: number;
  radius1: number;
  azDeg0: number;
  azDeg1: number;
  elY0: number;
  elY1: number;
};

export type ShotSpec = {
  id: ShotId;
  startFrame: number;
  endFrame: number;
  midFrame: number;
  beat: BeatId;
  set: SetId;
  light: LightMode;
  moveName: string;
  pos0: V3;
  pos1: V3;
  look0: V3;
  look1: V3;
  fov0: number;
  fov1: number;
  roll0?: number;
  roll1?: number;
  orbit?: OrbitMove;
  shakeAmp?: number;
  dofFocusDist: number;
  dofCInf: number;
};

export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / Math.max(1e-6, e1 - e0));
  return t * t * (3 - 2 * t);
};

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const lerpVec3 = (a: V3, b: V3, t: number): V3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

/** Continuous curve with non-zero velocity at both shot edges (u=0 and u=1). */
export const moveCurve = (u: number): number => {
  const c = clamp01(u);
  const s = c * c * (3 - 2 * c);
  return 0.72 * c + 0.28 * s;
};

export const SHOTS: ShotSpec[] = [
  // ---- BEAT 1: HOOK (0–154) ----
  {
    id: 1,
    startFrame: 0,
    endFrame: 60,
    midFrame: 30,
    beat: "hook",
    set: "deep-space",
    light: "space",
    moveName: "Descent Push-in (falling hook + nominal telemetry)",
    pos0: [2.25, 2.75, 8.85],
    pos1: [1.35, 2.05, 6.95],
    look0: [-0.35, -0.35, -1.5],
    look1: [-0.28, -0.55, -2.0],
    fov0: 46,
    fov1: 44,
    roll0: -0.04,
    roll1: -0.09,
    dofFocusDist: 7.4,
    dofCInf: 4,
  },
  {
    id: 2,
    startFrame: 60,
    endFrame: 154,
    midFrame: 107,
    beat: "hook",
    set: "deep-space",
    light: "space",
    moveName: "Steep Descent Orbit (nominal irony + hairline glitch)",
    pos0: [1.55, 2.15, 6.7],
    pos1: [-2.15, 1.45, 5.95],
    look0: [-0.25, -0.50, -1.8],
    look1: [-0.15, -0.75, -2.2],
    fov0: 44,
    fov1: 42,
    roll0: -0.08,
    roll1: -0.03,
    orbit: {
      center: [-0.2, 0.2, -0.5],
      radius0: 7.4,
      radius1: 6.2,
      azDeg0: 14,
      azDeg1: -18,
      elY0: 2.15,
      elY1: 1.45,
    },
    dofFocusDist: 6.1,
    dofCInf: 4,
  },

  // ---- BEAT 2: SETUP (154–753) ----
  {
    id: 3,
    startFrame: 154,
    endFrame: 289,
    midFrame: 221,
    beat: "setup",
    set: "launch-pad",
    light: "dawn",
    moveName: "Low-Angle Tilt-up Chase",
    pos0: [3.2, 1.2, 9.4],
    pos1: [2.4, 2.9, 7.6],
    look0: [0.0, 2.8, 0.0],
    look1: [0.0, 10.6, 0.0],
    fov0: 48,
    fov1: 46,
    dofFocusDist: 9.5,
    dofCInf: 3,
  },
  {
    id: 4,
    startFrame: 289,
    endFrame: 394,
    midFrame: 341,
    beat: "setup",
    set: "jpl-control",
    light: "ops",
    moveName: "Interior Push-in (control room)",
    pos0: [0.0, 2.25, 6.2],
    pos1: [0.0, 1.95, 3.9],
    look0: [0.0, 1.75, -2.4],
    look1: [0.0, 1.95, -3.1],
    fov0: 44,
    fov1: 42,
    dofFocusDist: 5.5,
    dofCInf: 4,
  },
  {
    id: 5,
    startFrame: 394,
    endFrame: 488,
    midFrame: 441,
    beat: "setup",
    set: "jpl-control",
    light: "ops",
    moveName: "Component Montage (gold bus -> dish -> solar wing -> cost board)",
    pos0: [1.88, 1.52, 1.95],
    pos1: [1.52, 2.44, 1.65],
    look0: [1.24, 1.46, 0.90],
    look1: [1.55, 2.45, -3.72],
    fov0: 36,
    fov1: 38,
    dofFocusDist: 2.2,
    dofCInf: 4,
  },
  {
    id: 6,
    startFrame: 488,
    endFrame: 546,
    midFrame: 517,
    beat: "setup",
    set: "deep-space",
    light: "space",
    moveName: "Speed-Ramp Cruise Surge",
    pos0: [-2.35, 1.15, 7.6],
    pos1: [-0.85, 0.42, 2.45],
    look0: [-0.10, 0.05, -2.5],
    look1: [0.65, 0.15, -6.5],
    fov0: 42,
    fov1: 54,
    roll0: 0.02,
    roll1: -0.14,
    dofFocusDist: 6.2,
    dofCInf: 4,
  },
  {
    id: 7,
    startFrame: 546,
    endFrame: 614,
    midFrame: 580,
    beat: "setup",
    set: "jpl-control",
    light: "ops",
    moveName: "Lateral Dolly (two teams)",
    pos0: [-2.1, 1.82, 4.3],
    pos1: [2.1, 1.82, 4.3],
    look0: [-1.2, 1.32, 0.3],
    look1: [1.2, 1.32, 0.3],
    fov0: 44,
    fov1: 44,
    dofFocusDist: 4.2,
    dofCInf: 5,
  },
  {
    id: 8,
    startFrame: 614,
    endFrame: 682,
    midFrame: 648,
    beat: "setup",
    set: "lockheed-office",
    light: "office",
    moveName: "Medium Push-in (Lockheed office)",
    pos0: [0.0, 2.05, 4.4],
    pos1: [0.0, 1.72, 2.75],
    look0: [0.0, 1.15, 0.0],
    look1: [0.0, 1.10, -0.2],
    fov0: 43,
    fov1: 41,
    dofFocusDist: 3.4,
    dofCInf: 6,
  },
  {
    id: 9,
    startFrame: 682,
    endFrame: 753,
    midFrame: 717,
    beat: "setup",
    set: "jpl-control",
    light: "ops",
    moveName: "Medium Orbit (nav consoles)",
    pos0: [2.4, 1.82, 3.8],
    pos1: [-0.4, 1.65, 4.0],
    look0: [0.7, 1.42, -0.5],
    look1: [0.6, 1.44, -0.5],
    fov0: 43,
    fov1: 42,
    orbit: {
      center: [0.8, 1.4, 0.8],
      radius0: 3.3,
      radius1: 3.1,
      azDeg0: 32,
      azDeg1: -20,
      elY0: 1.85,
      elY1: 1.65,
    },
    dofFocusDist: 3.3,
    dofCInf: 5,
  },

  // ---- BEAT 3: ESCALATION (753–1508) ----
  {
    id: 10,
    startFrame: 753,
    endFrame: 800,
    midFrame: 776,
    beat: "escalation",
    set: "jpl-control",
    light: "ops",
    moveName: "Fast Push-in (the handoff)",
    pos0: [0.0, 1.78, 4.4],
    pos1: [0.0, 1.42, 1.95],
    look0: [0.0, 1.28, 0.0],
    look1: [0.0, 1.22, 0.0],
    fov0: 45,
    fov1: 38,
    dofFocusDist: 2.6,
    dofCInf: 8,
  },
  {
    id: 11,
    startFrame: 800,
    endFrame: 873,
    midFrame: 836,
    beat: "escalation",
    set: "data-screen",
    light: "screen",
    moveName: "Close Push-in (Lockheed screen)",
    pos0: [-0.30, 1.38, 3.60],
    pos1: [-0.05, 1.30, 2.95],
    look0: [0.0, 1.25, 0.0],
    look1: [0.0, 1.25, 0.0],
    fov0: 40,
    fov1: 38,
    dofFocusDist: 3.0,
    dofCInf: 9,
  },
  {
    id: 12,
    startFrame: 873,
    endFrame: 946,
    midFrame: 909,
    beat: "escalation",
    set: "data-screen",
    light: "screen",
    moveName: "Close Push-in (JPL screen)",
    pos0: [0.30, 1.38, 3.60],
    pos1: [0.05, 1.30, 2.95],
    look0: [0.0, 1.25, 0.0],
    look1: [0.0, 1.25, 0.0],
    fov0: 40,
    fov1: 38,
    dofFocusDist: 3.0,
    dofCInf: 9,
  },
  {
    id: 13,
    startFrame: 946,
    endFrame: 1021,
    midFrame: 983,
    beat: "escalation",
    set: "data-screen",
    light: "screen",
    moveName: "Kinetic Split-Screen Montage (1x vs 4.45x bars + fit-failure)",
    pos0: [-0.75, 1.28, 3.65],
    pos1: [0.0, 1.62, 3.62],
    look0: [0.0, 1.52, 0.05],
    look1: [0.0, 1.45, 0.05],
    fov0: 48,
    fov1: 47,
    dofFocusDist: 3.4,
    dofCInf: 5,
  },
  {
    id: 14,
    startFrame: 1021,
    endFrame: 1076,
    midFrame: 1048,
    beat: "escalation",
    set: "deep-space",
    light: "space",
    moveName: "Tracking Alongside (burn)",
    pos0: [2.25, -0.22, 2.6],
    pos1: [1.85, -0.14, 0.55],
    look0: [0.0, -0.14, 0.0],
    look1: [0.0, -0.10, -1.1],
    fov0: 42,
    fov1: 42,
    dofFocusDist: 2.5,
    dofCInf: 5,
  },
  {
    id: 15,
    startFrame: 1076,
    endFrame: 1180,
    midFrame: 1128,
    beat: "escalation",
    set: "jpl-control",
    light: "ops",
    moveName: "Slow Push-in (weak plot)",
    pos0: [0.0, 1.85, 3.7],
    pos1: [0.0, 1.82, 2.1],
    look0: [0.0, 1.85, -1.8],
    look1: [0.0, 1.88, -2.6],
    fov0: 40,
    fov1: 38,
    dofFocusDist: 3.6,
    dofCInf: 6,
  },
  {
    id: 16,
    startFrame: 1180,
    endFrame: 1269,
    midFrame: 1224,
    beat: "escalation",
    set: "deep-space",
    light: "space",
    moveName: "Slow Pull-back (diverging paths)",
    pos0: [0.4, 0.55, 3.1],
    pos1: [1.15, 1.75, 7.2],
    look0: [0.45, 0.0, -3.4],
    look1: [0.55, 0.0, -3.6],
    fov0: 44,
    fov1: 45,
    dofFocusDist: 5.5,
    dofCInf: 4,
  },
  {
    id: 17,
    startFrame: 1269,
    endFrame: 1409,
    midFrame: 1339,
    beat: "escalation",
    set: "mars-approach",
    light: "mars",
    moveName: "Descending Arc (planned gate)",
    pos0: [2.7, 3.7, 6.2],
    pos1: [1.5, 2.1, 3.7],
    look0: [0.0, 2.1, -2.0],
    look1: [0.0, 1.35, -3.0],
    fov0: 45,
    fov1: 44,
    dofFocusDist: 5.0,
    dofCInf: 4,
  },
  {
    id: 18,
    startFrame: 1409,
    endFrame: 1508,
    midFrame: 1458,
    beat: "escalation",
    set: "mars-approach",
    light: "mars",
    moveName: "Diving Push-in (actual path)",
    pos0: [1.4, 2.2, 5.1],
    pos1: [0.55, -0.4, 2.15],
    look0: [0.0, 0.75, -1.5],
    look1: [0.0, -0.80, -2.5],
    fov0: 46,
    fov1: 45,
    dofFocusDist: 3.8,
    dofCInf: 5,
  },

  // ---- BEAT 4: REVEAL (1508–2027) ----
  {
    id: 19,
    startFrame: 1508,
    endFrame: 1614,
    midFrame: 1556,
    beat: "reveal",
    set: "jpl-control",
    light: "ops",
    moveName: "Slow Push-in (the date)",
    pos0: [0.0, 1.95, 5.2],
    pos1: [0.0, 2.18, 3.0],
    look0: [0.0, 1.82, -1.8],
    look1: [0.0, 2.28, -2.6],
    fov0: 42,
    fov1: 40,
    dofFocusDist: 4.4,
    dofCInf: 5,
  },
  {
    id: 20,
    startFrame: 1614,
    endFrame: 1673,
    midFrame: 1643,
    beat: "reveal",
    set: "mars-approach",
    light: "mars",
    moveName: "Chase Alongside (entry)",
    pos0: [1.85, 0.35, 2.4],
    pos1: [1.35, 0.20, 1.4],
    look0: [0.0, 0.0, -0.3],
    look1: [0.0, 0.0, -0.3],
    fov0: 46,
    fov1: 45,
    shakeAmp: 0.015,
    dofFocusDist: 2.3,
    dofCInf: 5,
  },
  {
    id: 21,
    startFrame: 1673,
    endFrame: 1751,
    midFrame: 1712,
    beat: "reveal",
    set: "mars-approach",
    light: "mars",
    moveName: "Low Tracking (too low)",
    pos0: [-1.4, -0.55, 2.2],
    pos1: [-0.95, -0.40, 1.15],
    look0: [0.0, 0.05, -0.5],
    look1: [0.0, 0.08, -0.6],
    fov0: 48,
    fov1: 47,
    shakeAmp: 0.022,
    dofFocusDist: 2.0,
    dofCInf: 6,
  },
  {
    id: 22,
    startFrame: 1751,
    endFrame: 1857,
    midFrame: 1804,
    beat: "reveal",
    set: "mars-approach",
    light: "mars",
    moveName: "Pull-back (burn-up to room flatline)",
    pos0: [0.6, 0.30, 2.2],
    pos1: [1.2, 0.65, 5.4],
    look0: [0.0, 0.0, -0.3],
    look1: [0.0, 0.0, -0.6],
    fov0: 44,
    fov1: 44,
    shakeAmp: 0.012,
    dofFocusDist: 3.4,
    dofCInf: 4,
  },
  {
    id: 23,
    startFrame: 1857,
    endFrame: 1919,
    midFrame: 1888,
    beat: "reveal",
    set: "jpl-control",
    light: "dark-ops",
    moveName: "Slow Push-in (cost board)",
    pos0: [0.35, 1.90, 4.5],
    pos1: [0.85, 2.08, 2.6],
    look0: [1.15, 2.15, -2.4],
    look1: [1.15, 2.20, -2.6],
    fov0: 40,
    fov1: 38,
    dofFocusDist: 4.5,
    dofCInf: 5,
  },
  {
    id: 24,
    startFrame: 1919,
    endFrame: 2027,
    midFrame: 1973,
    beat: "reveal",
    set: "data-screen",
    light: "screen-dark",
    moveName: "ECU Slow Push-in (the file)",
    pos0: [0.0, 1.30, 3.45],
    pos1: [0.0, 1.25, 2.82],
    look0: [0.0, 1.25, 0.0],
    look1: [0.0, 1.25, 0.0],
    fov0: 40,
    fov1: 38,
    dofFocusDist: 3.00,
    dofCInf: 4,
  },
];

export const getShotAtFrame = (frame: number): { shot: ShotSpec; localFrame: number; u: number } => {
  const f = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.floor(frame)));
  const shot = SHOTS.find((s) => f >= s.startFrame && f < s.endFrame) ?? SHOTS[SHOTS.length - 1];
  const dur = Math.max(1, shot.endFrame - shot.startFrame);
  const localFrame = f - shot.startFrame;
  const u = clamp01(localFrame / Math.max(1, dur - 1));
  return { shot, localFrame, u };
};

export type EvaluatedCamera = {
  pos: V3;
  look: V3;
  fov: number;
  roll: number;
  focusDist?: number;
};

export const evaluateCamera = (shot: ShotSpec, u: number, frame: number): EvaluatedCamera => {
  const k = moveCurve(u);

  // Shot 5: 4-beat component montage synced to narration ("بتكلفة وصلت لـ 125 مليون دولار")
  // Cut A (0..0.234): Gold Bus | Cut B (0.234..0.457): HGA Dish | Cut C (0.457..0.713): Solar Wing | Cut D (0.713..1): $125M Cost Board
  if (shot.id === 5) {
    if (u < 0.234) {
      const sub = moveCurve(u / 0.234);
      return {
        pos: lerpVec3([1.88, 1.52, 1.95], [1.55, 1.44, 1.56], sub),
        look: lerpVec3([1.24, 1.46, 0.90], [1.26, 1.49, 0.90], sub),
        fov: lerp(36, 34, sub),
        roll: lerp(0.02, -0.02, sub),
        focusDist: 0.92,
      };
    }
    if (u < 0.457) {
      const sub = moveCurve((u - 0.234) / 0.223);
      return {
        pos: lerpVec3([0.74, 2.14, 1.78], [1.62, 2.02, 1.56], sub),
        look: lerpVec3([1.25, 1.76, 0.90], [1.25, 1.74, 0.90], sub),
        fov: lerp(35, 33, sub),
        roll: lerp(-0.02, 0.02, sub),
        focusDist: 1.0,
      };
    }
    if (u < 0.713) {
      const sub = moveCurve((u - 0.457) / 0.256);
      return {
        pos: lerpVec3([1.85, 1.88, 2.65], [1.45, 1.70, 2.15], sub),
        look: lerpVec3([0.84, 1.50, 0.78], [0.90, 1.50, 0.80], sub),
        fov: lerp(43, 40, sub),
        roll: lerp(0.02, -0.02, sub),
        focusDist: 2.05,
      };
    }
    const sub = moveCurve((u - 0.713) / 0.287);
    return {
      pos: lerpVec3([1.46, 2.58, 2.75], [1.54, 2.46, 1.72], sub),
      look: lerpVec3([1.55, 2.42, -3.72], [1.55, 2.45, -3.72], sub),
      fov: lerp(44, 41, sub),
      roll: 0,
      focusDist: 5.9,
    };
  }

  // Shot 6: Speed-ramp cruise surge with quadratic acceleration
  if (shot.id === 6) {
    const ramp = 0.35 * u + 0.65 * u * u;
    return {
      pos: lerpVec3(shot.pos0, shot.pos1, ramp),
      look: lerpVec3(shot.look0, shot.look1, ramp),
      fov: lerp(shot.fov0, shot.fov1, ramp),
      roll: lerp(shot.roll0 ?? 0, shot.roll1 ?? 0, ramp),
    };
  }

  // Shot 13: High-speed 3-beat kinetic montage synced to fit-failure collisions (impacts at u=0.22, 0.50, 0.78)
  if (shot.id === 13) {
    const impactPulse =
      Math.exp(-Math.pow((u - 0.22) * 28, 2)) +
      Math.exp(-Math.pow((u - 0.50) * 28, 2)) +
      Math.exp(-Math.pow((u - 0.78) * 28, 2));
    const jx = Math.sin(frame * 2.7) * 0.024 * impactPulse;
    const jy = Math.cos(frame * 3.1) * 0.022 * impactPulse;

    if (u < 0.34) {
      const sub = moveCurve(u / 0.34);
      const pos = lerpVec3([-0.72, 1.30, 3.65], [-0.36, 1.46, 3.34], sub);
      pos[0] += jx; pos[1] += jy;
      return {
        pos,
        look: lerpVec3([0.0, 1.50, 0.05], [0.0, 1.54, 0.05], sub),
        fov: lerp(48, 46, sub),
        roll: lerp(0.03, 0.01, sub),
        focusDist: 3.4,
      };
    }
    if (u < 0.68) {
      const sub = moveCurve((u - 0.34) / 0.34);
      const pos = lerpVec3([0.24, 1.46, 3.56], [-0.08, 1.56, 3.30], sub);
      pos[0] += jx; pos[1] += jy;
      return {
        pos,
        look: lerpVec3([0.0, 1.56, 0.05], [0.0, 1.54, 0.05], sub),
        fov: lerp(47, 45, sub),
        roll: lerp(-0.02, 0.0, sub),
        focusDist: 3.4,
      };
    }
    const sub = moveCurve((u - 0.68) / 0.32);
    const pos = lerpVec3([0.52, 1.82, 3.15], [0.0, 1.60, 3.62], sub);
    pos[0] += jx; pos[1] += jy;
    return {
      pos,
      look: lerpVec3([0.0, 1.54, 0.05], [0.0, 1.48, 0.05], sub),
      fov: lerp(45, 48, sub),
      roll: lerp(-0.03, 0.0, sub),
      focusDist: 3.4,
    };
  }

  // Special two-stage continuous pull-back for Shot 22:
  // u < 0.58: Mars breakup pull-back; u >= 0.58: JPL control room pull-back from flatline monitor
  if (shot.id === 22) {
    if (u < 0.58) {
      const ua = moveCurve(u / 0.58);
      const pos = lerpVec3([0.6, 0.30, 2.2], [1.2, 0.65, 5.4], ua);
      const look = lerpVec3([0.0, 0.0, -0.3], [0.0, 0.0, -0.6], ua);
      const shake = (shot.shakeAmp ?? 0) * (1 - ua * 0.5);
      pos[0] += Math.sin(frame * 1.9) * shake;
      pos[1] += Math.cos(frame * 2.7) * shake;
      return { pos, look, fov: 44, roll: 0 };
    }
    const ub = moveCurve((u - 0.58) / 0.42);
    const pos = lerpVec3([0.0, 1.82, 0.8], [0.0, 1.80, 3.7], ub);
    const look = lerpVec3([0.0, 1.85, -2.6], [0.0, 1.75, -2.6], ub);
    return { pos, look, fov: lerp(40, 44, ub), roll: 0 };
  }

  let pos: V3;
  if (shot.orbit) {
    const o = shot.orbit;
    const rad = lerp(o.radius0, o.radius1, k);
    const az = (lerp(o.azDeg0, o.azDeg1, k) * Math.PI) / 180;
    const y = lerp(o.elY0, o.elY1, k);
    pos = [
      o.center[0] + Math.sin(az) * rad,
      y,
      o.center[2] + Math.cos(az) * rad,
    ];
  } else {
    pos = lerpVec3(shot.pos0, shot.pos1, k);
  }

  if (shot.id === 17) {
    pos[0] += Math.sin(u * Math.PI) * 0.55;
  }

  if (shot.shakeAmp) {
    pos = [
      pos[0] + Math.sin(frame * 2.13) * shot.shakeAmp,
      pos[1] + Math.cos(frame * 2.87) * shot.shakeAmp,
      pos[2] + Math.sin(frame * 1.61) * shot.shakeAmp * 0.5,
    ];
  }

  const look = lerpVec3(shot.look0, shot.look1, k);
  const fov = lerp(shot.fov0, shot.fov1, k);
  const roll = lerp(shot.roll0 ?? 0, shot.roll1 ?? 0, k);
  return { pos, look, fov, roll };
};
