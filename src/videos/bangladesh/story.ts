// Binding timeline & continuous multi-stage camera choreography for "BangladeshHeist" («غلطة واحدة»).
// 24 shots, 2158 frames @ 30 fps (71.93 s), SILENT picture-only composition.
// Shot boundaries strictly match /home/hatch/workspace/bridge/bangladesh/frame_map.md.
// Every shot > 75 frames uses explicit 1.2–2.1 s continuous sub-move reframes; zero static frames.

export const FPS = 30;
export const TOTAL_FRAMES = 2158;

export type V3 = [number, number, number];
export type ShotId =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16
  | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24;

export type SetId =
  | "swift-screen"
  | "central-bank"
  | "hacker-hideout"
  | "printer-room"
  | "dhaka-night"
  | "world-map"
  | "deutsche-office"
  | "fed-review";

export type BeatId = "hook" | "setup" | "escalation" | "reveal" | "punchline";

export type LightMode =
  | "swift-screen"
  | "central-bank"
  | "hacker-rig"
  | "printer-room"
  | "dhaka-night"
  | "world-map"
  | "deutsche-office"
  | "fed-review"
  | "swift-screen-finale";

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

const evalOrbit = (o: OrbitMove, k: number): V3 => {
  const rad = lerp(o.radius0, o.radius1, k);
  const az = (lerp(o.azDeg0, o.azDeg1, k) * Math.PI) / 180;
  const y = lerp(o.elY0, o.elY1, k);
  return [
    o.center[0] + Math.sin(az) * rad,
    y,
    o.center[2] + Math.cos(az) * rad,
  ];
};

export const SHOTS: ShotSpec[] = [
  // ---- BEAT 1: HOOK (0–225) ----
  {
    id: 1,
    startFrame: 0,
    endFrame: 112,
    midFrame: 56,
    beat: "hook",
    set: "swift-screen",
    light: "swift-screen",
    moveName: "Two-Stage Vertical Depth-Stack Push-in & Rack-Focus Crane Pull-Back",
    pos0: [0.32, 1.44, 2.95],
    pos1: [-0.45, 2.35, 4.15],
    look0: [0.0, 1.32, -0.10],
    look1: [0.0, 2.25, -2.80],
    fov0: 45,
    fov1: 46,
    dofFocusDist: 2.1,
    dofCInf: 2.5,
  },
  {
    id: 2,
    startFrame: 112,
    endFrame: 225,
    midFrame: 168,
    beat: "hook",
    set: "central-bank",
    light: "central-bank",
    moveName: "Two-Stage Wide Vault Orbit & High Crane Pull-Back",
    pos0: [-1.85, 1.45, 3.05],
    pos1: [-1.20, 3.25, 6.20],
    look0: [0.0, 2.10, -2.20],
    look1: [0.0, 2.35, -2.60],
    fov0: 45,
    fov1: 47,
    dofFocusDist: 5.5,
    dofCInf: 3.5,
  },

  // ---- BEAT 2: SETUP (225–655) ----
  {
    id: 3,
    startFrame: 225,
    endFrame: 272,
    midFrame: 248,
    beat: "setup",
    set: "central-bank",
    light: "central-bank",
    moveName: "Crisp Push-in & Tilt-Up to FEB 2016 Calendar",
    pos0: [-2.85, 1.85, 3.85],
    pos1: [-2.55, 2.18, 2.05],
    look0: [-2.60, 2.22, -2.35],
    look1: [-2.65, 2.30, -2.55],
    fov0: 43,
    fov1: 40,
    dofFocusDist: 4.1,
    dofCInf: 4.0,
  },
  {
    id: 4,
    startFrame: 272,
    endFrame: 376,
    midFrame: 324,
    beat: "setup",
    set: "hacker-hideout",
    light: "hacker-rig",
    moveName: "Two-Stage Intrusion Surge (Hacker Loft -> Bank Server Core)",
    pos0: [0.0, 1.95, 4.15],
    pos1: [1.35, 1.65, 1.65],
    look0: [0.0, 1.48, -1.20],
    look1: [2.05, 1.60, -1.50],
    fov0: 44,
    fov1: 42,
    dofFocusDist: 3.4,
    dofCInf: 4.0,
  },
  {
    id: 5,
    startFrame: 376,
    endFrame: 458,
    midFrame: 417,
    beat: "setup",
    set: "hacker-hideout",
    light: "hacker-rig",
    moveName: "Two-Stage Lateral Dolly & Month-Tracker Push-in",
    pos0: [-1.75, 1.78, 3.65],
    pos1: [0.85, 1.88, 2.15],
    look0: [-0.55, 1.48, -0.50],
    look1: [0.85, 1.88, -1.25],
    fov0: 43,
    fov1: 39,
    dofFocusDist: 3.2,
    dofCInf: 4.0,
  },
  {
    id: 6,
    startFrame: 458,
    endFrame: 512,
    midFrame: 485,
    beat: "setup",
    set: "hacker-hideout",
    light: "hacker-rig",
    moveName: "Dramatic Low-Angle Orbit Around Master Strike Board",
    pos0: [1.90, 1.55, 2.75],
    pos1: [-0.25, 1.70, 2.28],
    look0: [0.55, 1.65, -0.85],
    look1: [0.55, 1.70, -0.85],
    fov0: 44,
    fov1: 43,
    orbit: {
      center: [0.55, 1.55, -0.45],
      radius0: 3.4,
      radius1: 2.85,
      azDeg0: 22,
      azDeg1: -16,
      elY0: 1.55,
      elY1: 1.70,
    },
    dofFocusDist: 3.1,
    dofCInf: 4.0,
  },
  {
    id: 7,
    startFrame: 512,
    endFrame: 655,
    midFrame: 583,
    beat: "setup",
    set: "printer-room",
    light: "printer-room",
    moveName: "Three-Stage Printer Sabotage Sequence (Push -> Gear Orbit -> Spooler Tilt)",
    pos0: [-1.35, 1.82, 3.85],
    pos1: [0.15, 1.85, 2.35],
    look0: [0.0, 1.15, 0.0],
    look1: [0.0, 1.95, -1.20],
    fov0: 44,
    fov1: 42,
    dofFocusDist: 2.4,
    dofCInf: 4.0,
  },

  // ---- BEAT 3: ESCALATION (655–1331) ----
  {
    id: 8,
    startFrame: 655,
    endFrame: 723,
    midFrame: 689,
    beat: "escalation",
    set: "dhaka-night",
    light: "dhaka-night",
    moveName: "Aerial Night Glide Over Sleeping Dhaka to Thursday Clock & Bank Tower",
    pos0: [-2.10, 2.90, 8.20],
    pos1: [-0.55, 2.35, 5.20],
    look0: [0.0, 2.40, -2.50],
    look1: [0.15, 2.95, -3.50],
    fov0: 47,
    fov1: 44,
    dofFocusDist: 6.5,
    dofCInf: 3.0,
  },
  {
    id: 9,
    startFrame: 723,
    endFrame: 841,
    midFrame: 782,
    beat: "escalation",
    set: "hacker-hideout",
    light: "hacker-rig",
    moveName: "Two-Stage Rapid Dispatch Tracking & Counter Zoom-In (35 SWIFT Requests)",
    pos0: [-1.55, 1.62, 2.85],
    pos1: [0.0, 1.78, 1.65],
    look0: [-0.30, 1.48, -0.60],
    look1: [0.0, 1.75, -0.95],
    fov0: 44,
    fov1: 38,
    dofFocusDist: 2.7,
    dofCInf: 4.5,
  },
  {
    id: 10,
    startFrame: 841,
    endFrame: 954,
    midFrame: 897,
    beat: "escalation",
    set: "central-bank",
    light: "central-bank",
    moveName: "Two-Stage Crane Rise & Monumental Push-in on $951M Board",
    pos0: [-0.95, 1.15, 4.65],
    pos1: [0.0, 2.65, 2.75],
    look0: [0.0, 1.45, -1.80],
    look1: [0.0, 2.68, -2.60],
    fov0: 45,
    fov1: 41,
    dofFocusDist: 5.2,
    dofCInf: 4.0,
  },
  {
    id: 11,
    startFrame: 954,
    endFrame: 1050,
    midFrame: 1002,
    beat: "escalation",
    set: "world-map",
    light: "world-map",
    moveName: "Two-Stage Tactical Map Sweep (Dhaka Source -> PH & SL Nodes)",
    pos0: [-1.85, 3.45, 4.25],
    pos1: [0.45, 2.15, 2.65],
    look0: [-0.15, 1.15, 0.10],
    look1: [0.25, 1.28, -0.10],
    fov0: 46,
    fov1: 42,
    dofFocusDist: 3.1,
    dofCInf: 4.0,
  },
  {
    id: 12,
    startFrame: 1050,
    endFrame: 1158,
    midFrame: 1104,
    beat: "escalation",
    set: "world-map",
    light: "world-map",
    moveName: "Two-Stage Cleared-Conduit Chase & $101M Moved Board Push-in",
    pos0: [-1.05, 1.65, 2.85],
    pos1: [0.0, 2.28, 2.85],
    look0: [0.25, 1.35, -0.40],
    look1: [0.0, 2.28, -2.10],
    fov0: 44,
    fov1: 40,
    dofFocusDist: 4.5,
    dofCInf: 4.0,
  },
  {
    id: 13,
    startFrame: 1158,
    endFrame: 1265,
    midFrame: 1211,
    beat: "escalation",
    set: "world-map",
    light: "world-map",
    moveName: "Two-Stage 3D Split-Column Comparison ($81M PH + $20M SL)",
    pos0: [1.35, 1.85, 3.25],
    pos1: [0.10, 2.12, 2.65],
    look0: [0.20, 1.65, 0.0],
    look1: [0.10, 1.92, -1.10],
    fov0: 44,
    fov1: 40,
    dofFocusDist: 3.3,
    dofCInf: 4.0,
  },
  {
    id: 14,
    startFrame: 1265,
    endFrame: 1331,
    midFrame: 1298,
    beat: "escalation",
    set: "hacker-hideout",
    light: "hacker-rig",
    moveName: "Premature Victory Pull-Back in Hacker Loft",
    pos0: [0.0, 1.58, 2.25],
    pos1: [0.35, 1.85, 3.95],
    look0: [0.0, 1.52, -0.60],
    look1: [0.0, 1.55, -0.80],
    fov0: 41,
    fov1: 45,
    roll0: 0.0,
    roll1: -0.04,
    dofFocusDist: 3.4,
    dofCInf: 4.0,
  },

  // ---- BEAT 4: REVEAL (1331–1853) ----
  {
    id: 15,
    startFrame: 1331,
    endFrame: 1401,
    midFrame: 1366,
    beat: "reveal",
    set: "swift-screen",
    light: "swift-screen",
    moveName: "Snap Push-in onto Single Crimson Character Cell",
    pos0: [-0.50, 1.46, 2.85],
    pos1: [0.0, 1.28, 1.68],
    look0: [0.0, 1.25, 0.0],
    look1: [0.0, 1.25, 0.0],
    fov0: 44,
    fov1: 38,
    dofFocusDist: 2.2,
    dofCInf: 5.0,
  },
  {
    id: 16,
    startFrame: 1401,
    endFrame: 1485,
    midFrame: 1443,
    beat: "reveal",
    set: "swift-screen",
    light: "swift-screen",
    moveName: "Two-Stage Keyboard-to-Screen Tracking on Field 59 Beneficiary Entry",
    pos0: [-0.58, 1.04, 1.82],
    pos1: [0.08, 1.26, 1.58],
    look0: [-0.08, 1.06, 0.25],
    look1: [0.0, 1.25, 0.0],
    fov0: 42,
    fov1: 37,
    dofFocusDist: 1.65,
    dofCInf: 5.0,
  },
  {
    id: 17,
    startFrame: 1485,
    endFrame: 1573,
    midFrame: 1529,
    beat: "reveal",
    set: "swift-screen",
    light: "swift-screen",
    moveName: "Two-Stage ECU Push-in & Micro-Orbit on Fandation vs Foundation",
    pos0: [-0.18, 1.26, 1.88],
    pos1: [0.12, 1.24, 1.46],
    look0: [0.0, 1.25, 0.0],
    look1: [0.0, 1.25, 0.0],
    fov0: 39,
    fov1: 36,
    dofFocusDist: 1.5,
    dofCInf: 5.0,
  },
  {
    id: 18,
    startFrame: 1573,
    endFrame: 1656,
    midFrame: 1614,
    beat: "reveal",
    set: "deutsche-office",
    light: "deutsche-office",
    moveName: "Two-Stage Deutsche Bank Office Reveal & Analyst Discovery Push-in",
    pos0: [-0.12, 1.48, 3.30],
    pos1: [0.06, 1.42, 3.06],
    look0: [-0.05, 1.38, -0.45],
    look1: [-0.04, 1.36, -0.45],
    fov0: 47,
    fov1: 47,
    dofFocusDist: 3.1,
    dofCInf: 4.0,
  },
  {
    id: 19,
    startFrame: 1656,
    endFrame: 1721,
    midFrame: 1688,
    beat: "reveal",
    set: "deutsche-office",
    light: "deutsche-office",
    moveName: "Close Push-in as Deutsche Bank Clerk Queries & Stops THAT ONE Transfer",
    pos0: [0.20, 1.44, 3.18],
    pos1: [-0.02, 1.40, 3.06],
    look0: [-0.06, 1.36, -0.45],
    look1: [-0.06, 1.35, -0.45],
    fov0: 47,
    fov1: 47,
    dofFocusDist: 3.1,
    dofCInf: 4.0,
  },
  {
    id: 20,
    startFrame: 1721,
    endFrame: 1807,
    midFrame: 1764,
    beat: "reveal",
    set: "fed-review",
    light: "fed-review",
    moveName: "Two-Stage Federal Reserve Operations Pan & Review Matrix Push-in",
    pos0: [-1.65, 1.95, 4.55],
    pos1: [0.0, 2.05, 2.45],
    look0: [0.0, 1.85, -1.80],
    look1: [0.0, 2.05, -2.20],
    fov0: 44,
    fov1: 39,
    dofFocusDist: 4.5,
    dofCInf: 4.0,
  },
  {
    id: 21,
    startFrame: 1807,
    endFrame: 1853,
    midFrame: 1830,
    beat: "reveal",
    set: "fed-review",
    light: "fed-review",
    moveName: "Fast Lockdown Zoom as Fed Stops All Remaining Transfers (~$850M)",
    pos0: [0.0, 2.04, 2.85],
    pos1: [0.0, 2.08, 2.35],
    look0: [0.0, 2.08, -2.20],
    look1: [0.0, 2.08, -2.20],
    fov0: 41,
    fov1: 39,
    dofFocusDist: 4.5,
    dofCInf: 4.0,
  },

  // ---- BEAT 5: PUNCHLINE (1853–2158) ----
  {
    id: 22,
    startFrame: 1853,
    endFrame: 1882,
    midFrame: 1867,
    beat: "punchline",
    set: "swift-screen",
    light: "swift-screen",
    moveName: "Punchy Macro Whip-Push onto Hero Wrong Letter A",
    pos0: [0.42, 1.42, 2.35],
    pos1: [0.0, 1.26, 1.55],
    look0: [0.0, 1.25, 0.0],
    look1: [0.0, 1.25, 0.0],
    fov0: 43,
    fov1: 37,
    roll0: 0.03,
    roll1: 0.0,
    dofFocusDist: 1.9,
    dofCInf: 5.0,
  },
  {
    id: 23,
    startFrame: 1882,
    endFrame: 2038,
    midFrame: 1960,
    beat: "punchline",
    set: "central-bank",
    light: "central-bank",
    moveName: "Three-Stage Vault & Saved-Millions Shield Sequence",
    pos0: [-1.85, 1.55, 1.95],
    pos1: [-0.35, 2.15, 3.85],
    look0: [0.0, 1.75, -2.20],
    look1: [0.0, 2.15, -2.40],
    fov0: 43,
    fov1: 44,
    dofFocusDist: 4.8,
    dofCInf: 3.5,
  },
  {
    id: 24,
    startFrame: 2038,
    endFrame: 2158,
    midFrame: 2098,
    beat: "punchline",
    set: "swift-screen",
    light: "swift-screen-finale",
    moveName: "Two-Stage Finale Crane Arc & ECU Forensic Lock-in",
    pos0: [-0.85, 2.25, 3.55],
    pos1: [0.0, 1.25, 1.62],
    look0: [0.0, 1.95, -1.50],
    look1: [0.0, 1.25, 0.0],
    fov0: 45,
    fov1: 37,
    dofFocusDist: 1.85,
    dofCInf: 4.5,
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

  // Shot 1 (f0–112, split at f54 = 1.80s): Vertical 3-layer depth-stack push-in -> rack-focus crane tilt-up
  if (shot.id === 1) {
    if (frame < 54) {
      const sub = moveCurve(frame / 54);
      return {
        pos: lerpVec3([0.32, 1.44, 2.95], [0.04, 1.42, 2.02], sub),
        look: lerpVec3([0.0, 1.30, -0.10], [0.0, 1.48, -0.58], sub),
        fov: lerp(45, 42, sub),
        roll: 0,
        focusDist: 2.15,
      };
    }
    const sub = moveCurve((frame - 54) / 58);
    return {
      pos: lerpVec3([0.04, 1.42, 2.02], [-0.45, 2.35, 4.15], sub),
      look: lerpVec3([0.0, 1.48, -0.58], [0.0, 2.25, -2.80], sub),
      fov: lerp(42, 46, sub),
      roll: 0,
      focusDist: lerp(2.25, 5.20, sub),
    };
  }

  // Shot 2 (f112–225, split at f166 = 1.80s): Low-angle vault orbit -> high crane pull-back
  if (shot.id === 2) {
    if (frame < 166) {
      const sub = moveCurve((frame - 112) / 54);
      const pos = evalOrbit(
        {
          center: [0.0, 1.8, -1.2],
          radius0: 4.8,
          radius1: 5.5,
          azDeg0: -26,
          azDeg1: 12,
          elY0: 1.45,
          elY1: 2.15,
        },
        sub,
      );
      return {
        pos,
        look: [0.0, 2.15, -2.2],
        fov: 45,
        roll: 0,
        focusDist: 5.2,
      };
    }
    const sub = moveCurve((frame - 166) / 59);
    return {
      pos: lerpVec3([1.14, 2.15, 4.18], [-1.20, 3.25, 6.20], sub),
      look: lerpVec3([0.0, 2.15, -2.20], [0.0, 2.35, -2.60], sub),
      fov: lerp(45, 47, sub),
      roll: 0,
      focusDist: 6.4,
    };
  }

  // Shot 4 (f272–376, split at f320 = 1.60s): Stage A Hacker loft push -> Stage B Bank server core dolly
  if (shot.id === 4) {
    if (frame < 320) {
      const sub = moveCurve((frame - 272) / 48);
      return {
        pos: lerpVec3([0.0, 1.95, 4.15], [0.0, 1.62, 2.05], sub),
        look: [0.0, 1.48, -1.2],
        fov: lerp(44, 39, sub),
        roll: 0,
        focusDist: lerp(4.2, 2.8, sub),
      };
    }
    const sub = moveCurve((frame - 320) / 56);
    return {
      pos: lerpVec3([1.55, 1.85, 3.35], [1.15, 1.75, 1.55], sub),
      look: lerpVec3([1.85, 1.75, -1.85], [1.85, 1.72, -1.85], sub),
      fov: 43,
      roll: 0,
      focusDist: 3.4,
    };
  }

  // Shot 5 (f376–458, split at f415 = 1.30s): Lateral dolly across hackers -> month-tracker push-in
  if (shot.id === 5) {
    if (frame < 415) {
      const sub = moveCurve((frame - 376) / 39);
      return {
        pos: lerpVec3([-1.75, 1.78, 3.65], [0.45, 1.82, 3.25], sub),
        look: lerpVec3([-0.55, 1.48, -0.50], [0.50, 1.75, -0.80], sub),
        fov: 43,
        roll: 0,
        focusDist: 3.4,
      };
    }
    const sub = moveCurve((frame - 415) / 43);
    return {
      pos: lerpVec3([0.45, 1.82, 3.25], [0.65, 1.88, 2.55], sub),
      look: lerpVec3([0.50, 1.75, -0.80], [0.65, 1.88, -1.25], sub),
      fov: lerp(43, 42, sub),
      roll: 0,
      focusDist: 3.3,
    };
  }

  // Shot 7 (f512–655, 3 stages: f512–560, f560–608, f608–655)
  if (shot.id === 7) {
    if (frame < 560) {
      const sub = moveCurve((frame - 512) / 48);
      return {
        pos: lerpVec3([-1.35, 1.82, 3.85], [-0.45, 1.52, 2.35], sub),
        look: [0.0, 1.15, 0.0],
        fov: lerp(44, 40, sub),
        roll: 0,
        focusDist: 2.6,
      };
    }
    if (frame < 608) {
      const sub = moveCurve((frame - 560) / 48);
      const pos = evalOrbit(
        {
          center: [0.14, 1.35, -0.35],
          radius0: 2.70,
          radius1: 2.45,
          azDeg0: 18,
          azDeg1: 46,
          elY0: 1.62,
          elY1: 1.50,
        },
        sub,
      );
      return {
        pos,
        look: [0.14, 1.38, -0.35],
        fov: 45,
        roll: 0,
        focusDist: 2.5,
      };
    }
    const sub = moveCurve((frame - 608) / 47);
    return {
      pos: lerpVec3([0.35, 1.32, 1.75], [0.15, 1.85, 2.35], sub),
      look: lerpVec3([0.0, 1.18, 0.0], [0.0, 1.95, -1.20], sub),
      fov: lerp(41, 42, sub),
      roll: 0,
      focusDist: 2.8,
    };
  }

  // Shot 9 (f723–841, split at f780 = 1.90s): Over-shoulder tracking -> center 35-request counter push-in
  if (shot.id === 9) {
    if (frame < 780) {
      const sub = moveCurve((frame - 723) / 57);
      return {
        pos: lerpVec3([-1.55, 1.62, 2.85], [0.75, 1.72, 2.55], sub),
        look: lerpVec3([-0.30, 1.48, -0.60], [0.20, 1.58, -0.80], sub),
        fov: 44,
        roll: 0,
        focusDist: 2.9,
      };
    }
    const sub = moveCurve((frame - 780) / 61);
    return {
      pos: lerpVec3([0.75, 1.72, 2.55], [0.0, 1.78, 1.65], sub),
      look: lerpVec3([0.20, 1.58, -0.80], [0.0, 1.75, -0.95], sub),
      fov: lerp(42, 38, sub),
      roll: 0,
      focusDist: 2.5,
    };
  }

  // Shot 10 (f841–954, split at f895 = 1.80s): Vault crane rise -> $951M board push-in
  if (shot.id === 10) {
    if (frame < 895) {
      const sub = moveCurve((frame - 841) / 54);
      return {
        pos: lerpVec3([-0.95, 1.15, 4.65], [0.0, 2.35, 3.85], sub),
        look: lerpVec3([0.0, 1.45, -1.80], [0.0, 2.65, -2.50], sub),
        fov: 45,
        roll: 0,
        focusDist: 5.5,
      };
    }
    const sub = moveCurve((frame - 895) / 59);
    return {
      pos: lerpVec3([0.0, 2.35, 3.85], [0.0, 2.65, 2.75], sub),
      look: lerpVec3([0.0, 2.65, -2.50], [0.0, 2.68, -2.60], sub),
      fov: lerp(43, 41, sub),
      roll: 0,
      focusDist: 5.3,
    };
  }

  // Shot 11 (f954–1050, split at f998 = 1.47s): Descending map arc -> lateral tracking framing Manila & Colombo
  if (shot.id === 11) {
    if (frame < 998) {
      const sub = moveCurve((frame - 954) / 44);
      return {
        pos: lerpVec3([-1.85, 3.45, 4.25], [-0.25, 2.55, 3.55], sub),
        look: [-0.05, 1.48, -0.35],
        fov: 46,
        roll: 0,
        focusDist: 3.7,
      };
    }
    const sub = moveCurve((frame - 998) / 52);
    return {
      pos: lerpVec3([-0.25, 2.55, 3.55], [0.05, 2.45, 3.35], sub),
      look: lerpVec3([-0.05, 1.48, -0.35], [0.0, 1.52, -0.35], sub),
      fov: lerp(46, 45, sub),
      roll: 0,
      focusDist: 3.5,
    };
  }

  // Shot 12 (f1050–1158, split at f1100 = 1.67s): Conduit chase -> $101M board push-in
  if (shot.id === 12) {
    if (frame < 1100) {
      const sub = moveCurve((frame - 1050) / 50);
      return {
        pos: lerpVec3([-1.05, 1.65, 2.85], [0.25, 2.15, 3.15], sub),
        look: lerpVec3([0.25, 1.35, -0.40], [0.0, 2.15, -1.60], sub),
        fov: 44,
        roll: 0,
        focusDist: 3.6,
      };
    }
    const sub = moveCurve((frame - 1100) / 58);
    return {
      pos: lerpVec3([0.25, 2.15, 3.15], [0.0, 2.52, 2.95], sub),
      look: lerpVec3([0.0, 2.15, -1.60], [0.0, 2.55, -2.10], sub),
      fov: lerp(43, 41, sub),
      roll: 0,
      focusDist: 5.0,
    };
  }

  // Shot 13 (f1158–1265, split at f1208 = 1.67s): Lateral dolly past 3D columns -> center split-board framing
  if (shot.id === 13) {
    if (frame < 1208) {
      const sub = moveCurve((frame - 1158) / 50);
      return {
        pos: lerpVec3([1.35, 1.85, 3.35], [-0.15, 2.18, 3.35], sub),
        look: [0.05, 1.85, -0.60],
        fov: 44,
        roll: 0,
        focusDist: 3.5,
      };
    }
    const sub = moveCurve((frame - 1208) / 57);
    return {
      pos: lerpVec3([-0.15, 2.18, 3.35], [0.0, 2.25, 3.25], sub),
      look: lerpVec3([0.05, 1.85, -0.60], [0.0, 1.98, -0.95], sub),
      fov: lerp(44, 43, sub),
      roll: 0,
      focusDist: 3.6,
    };
  }

  // Shot 16 (f1401–1485, split at f1440 = 1.30s): Keyboard tracking -> Field 59 beneficiary entry push-in
  if (shot.id === 16) {
    if (frame < 1440) {
      const sub = moveCurve((frame - 1401) / 39);
      return {
        pos: lerpVec3([-0.58, 1.04, 1.82], [-0.18, 1.24, 1.72], sub),
        look: lerpVec3([-0.08, 1.06, 0.25], [0.0, 1.24, 0.0], sub),
        fov: lerp(42, 40, sub),
        roll: 0,
        focusDist: 1.6,
      };
    }
    const sub = moveCurve((frame - 1440) / 45);
    return {
      pos: lerpVec3([-0.18, 1.24, 1.72], [0.08, 1.26, 1.58], sub),
      look: [0.0, 1.25, 0.0],
      fov: lerp(40, 37, sub),
      roll: 0,
      focusDist: 1.65,
    };
  }

  // Shot 17 (f1485–1573, split at f1526 = 1.37s): Direct ECU push -> micro-orbit on Fandation vs Foundation
  if (shot.id === 17) {
    if (frame < 1526) {
      const sub = moveCurve((frame - 1485) / 41);
      return {
        pos: lerpVec3([-0.18, 1.26, 1.88], [0.0, 1.25, 1.56], sub),
        look: [0.0, 1.25, 0.0],
        fov: lerp(39, 37, sub),
        roll: 0,
        focusDist: 1.60,
      };
    }
    const sub = moveCurve((frame - 1526) / 47);
    return {
      pos: lerpVec3([0.0, 1.25, 1.56], [0.10, 1.24, 1.50], sub),
      look: [0.0, 1.25, 0.0],
      fov: lerp(37, 36, sub),
      roll: 0,
      focusDist: 1.52,
    };
  }

  // Shot 18 (f1573–1656, split at f1610 = 1.23s): Deutsche Bank office arc -> over-shoulder discovery push
  if (shot.id === 18) {
    if (frame < 1610) {
      const sub = moveCurve((frame - 1573) / 37);
      return {
        pos: lerpVec3([-0.12, 1.48, 3.30], [-0.02, 1.44, 3.16], sub),
        look: lerpVec3([-0.05, 1.38, -0.45], [-0.04, 1.37, -0.45], sub),
        fov: 47,
        roll: 0,
        focusDist: 3.2,
      };
    }
    const sub = moveCurve((frame - 1610) / 46);
    return {
      pos: lerpVec3([-0.02, 1.44, 3.16], [0.06, 1.42, 3.06], sub),
      look: lerpVec3([-0.04, 1.37, -0.45], [-0.04, 1.36, -0.45], sub),
      fov: 47,
      roll: 0,
      focusDist: 3.1,
    };
  }

  // Shot 20 (f1721–1807, split at f1760 = 1.30s): Wide Fed ops dolly -> 30-request matrix push-in
  if (shot.id === 20) {
    if (frame < 1760) {
      const sub = moveCurve((frame - 1721) / 39);
      return {
        pos: lerpVec3([-1.65, 1.95, 4.55], [-0.25, 1.98, 3.85], sub),
        look: [0.0, 1.92, -1.80],
        fov: 44,
        roll: 0,
        focusDist: 4.8,
      };
    }
    const sub = moveCurve((frame - 1760) / 47);
    return {
      pos: lerpVec3([-0.25, 1.98, 3.85], [0.0, 2.08, 2.75], sub),
      look: lerpVec3([0.0, 1.92, -1.80], [0.0, 2.08, -2.20], sub),
      fov: lerp(43, 41, sub),
      roll: 0,
      focusDist: 4.8,
    };
  }

  // Shot 23 (f1882–2038, 3 stages: f1882–1934, f1934–1986, f1986–2038)
  if (shot.id === 23) {
    if (frame < 1934) {
      const sub = moveCurve((frame - 1882) / 52);
      const pos = evalOrbit(
        {
          center: [0.0, 1.65, -1.80],
          radius0: 4.2,
          radius1: 3.6,
          azDeg0: -26,
          azDeg1: 8,
          elY0: 1.55,
          elY1: 1.85,
        },
        sub,
      );
      return {
        pos,
        look: [0.0, 1.75, -2.20],
        fov: 43,
        roll: 0,
        focusDist: 4.2,
      };
    }
    if (frame < 1986) {
      const sub = moveCurve((frame - 1934) / 52);
      return {
        pos: lerpVec3([0.45, 1.95, 2.85], [0.0, 2.25, 3.35], sub),
        look: lerpVec3([0.0, 1.95, -2.20], [0.0, 2.15, -2.20], sub),
        fov: lerp(44, 43, sub),
        roll: 0,
        focusDist: 5.2,
      };
    }
    const sub = moveCurve((frame - 1986) / 52);
    return {
      pos: lerpVec3([0.0, 2.25, 3.35], [-0.35, 2.15, 3.85], sub),
      look: lerpVec3([0.0, 2.15, -2.20], [0.0, 2.15, -2.40], sub),
      fov: lerp(43, 45, sub),
      roll: 0,
      focusDist: 5.6,
    };
  }

  // Shot 24 (f2038–2158, split at f2094 = 1.87s): Finale crane descent -> ECU forensic lock-in
  if (shot.id === 24) {
    if (frame < 2094) {
      const sub = moveCurve((frame - 2038) / 56);
      return {
        pos: lerpVec3([-0.85, 2.25, 3.55], [-0.12, 1.30, 1.88], sub),
        look: lerpVec3([0.0, 1.95, -1.50], [0.0, 1.25, 0.0], sub),
        fov: lerp(45, 38, sub),
        roll: 0,
        focusDist: lerp(3.4, 1.88, sub),
      };
    }
    const sub = moveCurve((frame - 2094) / 64);
    return {
      pos: lerpVec3([-0.12, 1.30, 1.88], [0.0, 1.25, 1.62], sub),
      look: [0.0, 1.25, 0.0],
      fov: lerp(38, 37, sub),
      roll: 0,
      focusDist: 1.75,
    };
  }

  // Single-stage continuous camera moves (Shots 3, 6, 8, 14, 15, 19, 21, 22)
  const pos = shot.orbit ? evalOrbit(shot.orbit, k) : lerpVec3(shot.pos0, shot.pos1, k);
  const look = lerpVec3(shot.look0, shot.look1, k);
  const fov = lerp(shot.fov0, shot.fov1, k);
  const roll = lerp(shot.roll0 ?? 0, shot.roll1 ?? 0, k);
  return { pos, look, fov, roll };
};
