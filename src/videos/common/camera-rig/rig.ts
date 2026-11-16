import type { CamLike } from '../applyCam';

export type Vec3 = [number, number, number];

export interface CamInput {
  pos: Vec3;
  look: Vec3;
  fov: number;
  /** Roll in RADIANS (default 0). Takes precedence unless rollDeg is provided. */
  roll?: number;
  /** Optional roll in DEGREES (converted to radians by normalizeCam). */
  rollDeg?: number;
}

export interface CamPose extends CamLike {
  pos: Vec3;
  look: Vec3;
  fov: number;
  /** Always in RADIANS; directly compatible with applyCam(cam, pose, frame). */
  roll: number;
  /** Shake scalar from active SHAKE beats (0 when inactive). */
  shake: number;
}

export type StandardMoveName =
  | 'PUSH'
  | 'MACRO'
  | 'PULL'
  | 'ORBIT_L'
  | 'ORBIT_R'
  | 'CRANE_UP'
  | 'CRANE_DOWN'
  | 'DOLLY_L'
  | 'DOLLY_R'
  | 'TILT_UP'
  | 'TILT_DOWN';

export type FastMoveName = 'PUNCH' | 'WHIP';
export type AuxMoveName = 'SHAKE' | 'SLOWPUSH' | 'RACK';
export type MoveName = StandardMoveName | FastMoveName | AuxMoveName;

export interface BeatPrm {
  frac?: number;
  deg?: number;
  up?: number;
  side?: number;
  pan?: number;
  tilt?: number;
  to?: CamInput;
  dur?: number;
}

export interface Beat {
  /** Start time in seconds */
  t: number;
  /** Move grammar token */
  move: MoveName | (string & {});
  /** Optional duration in seconds (defaults to prm?.dur ?? defaultMoveDur(move, beat.dur)) */
  dur?: number;
  /** Optional narration word anchor */
  word?: string;
  /** Optional inline move parameters */
  prm?: BeatPrm;
}

export interface SetupSpec {
  id: string;
  startFrame: number;
  endFrame: number;
  base: CamInput;
  beats: readonly Beat[];
  prms?: readonly (BeatPrm | undefined)[];
}

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
export const DRIFT_RATE = 0.03;        // 3%/s push toward look
export const DRIFT_MAX = 0.30;         // Max 30% push cap per drift interval
export const ARC_DEG_PER_SEC = 3;      // 3 deg/s horizontal orbit around look
export const ARC_MAX_DT = 4.0;         // 4 s cap on arc dt
export const GROUND_MIN_Y = 0.08;      // 0.08 m ground-safety floor
export const SHAKE_DECAY_SEC = 0.4;    // 0.4 s shake decay window
export const SHAKE_AMP_FRAC = 0.004;   // 0.004 * dist * shake amplitude
export const WORD_LEAD_FRAMES = 6;     // Moves lead word anchor by ~6 frames
export const DEFAULT_STD_DUR = 0.63;   // 0.63 s (~19 frames at 30 fps)

export const DOC_MOVE_DURS: Readonly<Record<string, number>> = {
  PUSH: 0.63,
  PULL: 0.66,
  MACRO: 0.60,
  ORBIT_L: 0.70,
  ORBIT_R: 0.70,
  CRANE_UP: 0.70,
  CRANE_DOWN: 0.70,
  DOLLY_L: 0.75,
  DOLLY_R: 0.75,
  TILT_UP: 0.63,
  TILT_DOWN: 0.63,
  PUNCH: 0.20,
  WHIP: 0.30,
  SHAKE: 0.40,
};

function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale3(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

/** Kit rotY: [x*cos(a) + z*sin(a), y, -x*sin(a) + z*cos(a)] */
export function rotY(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

function rotYAround(pt: Vec3, origin: Vec3, a: number): Vec3 {
  const rel: Vec3 = [pt[0] - origin[0], pt[1] - origin[1], pt[2] - origin[2]];
  const r = rotY(rel, a);
  return [origin[0] + r[0], origin[1] + r[1], origin[2] + r[2]];
}

/** Normalize a CamInput into CamLike with roll strictly in radians. */
export function normalizeCam(c: CamInput): CamLike {
  const roll = c.rollDeg !== undefined ? c.rollDeg * DEG2RAD : (c.roll ?? 0);
  return {
    pos: [c.pos[0], c.pos[1], c.pos[2]],
    look: [c.look[0], c.look[1], c.look[2]],
    fov: c.fov,
    roll,
  };
}

/** Enforce pos[1] >= GROUND_MIN_Y (0.08 m). */
export function clampGround<T extends CamLike>(c: T): T {
  return {
    ...c,
    pos: [c.pos[0], Math.max(GROUND_MIN_Y, c.pos[1]), c.pos[2]],
    look: [c.look[0], c.look[1], c.look[2]],
  };
}

export function easeInOutCubic(u: number): number {
  const x = Math.max(0, Math.min(1, u));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function easeOutCubic(u: number): number {
  const x = Math.max(0, Math.min(1, u));
  return 1 - Math.pow(1 - x, 3);
}

export function easeForMove(move: string, u: number): number {
  return move === 'PUNCH' ? easeOutCubic(u) : easeInOutCubic(u);
}

/** Default move duration: PUNCH 0.20 s, WHIP 0.30 s, else beatDur ?? 0.63 s. */
export function defaultMoveDur(move: string, beatDur?: number): number {
  if (move === 'PUNCH') return 0.2;
  if (move === 'WHIP') return 0.3;
  return beatDur ?? DEFAULT_STD_DUR;
}

/** Continuous inter-beat camera drift: push toward look + horizontal arc around look. */
export function drift(p: CamLike, dt: number): CamLike {
  if (dt <= 0) {
    return clampGround({
      pos: [p.pos[0], p.pos[1], p.pos[2]],
      look: [p.look[0], p.look[1], p.look[2]],
      fov: p.fov,
      roll: p.roll,
    });
  }
  const d: Vec3 = [p.look[0] - p.pos[0], p.look[1] - p.pos[1], p.look[2] - p.pos[2]];
  const dist = Math.hypot(d[0], d[1], d[2]);
  const k = Math.min(DRIFT_MAX, DRIFT_RATE * dt);
  const pushScale = (k * Math.min(dist, 30)) / Math.max(dist, 1e-3);
  const pushedPos: Vec3 = [
    p.pos[0] + d[0] * pushScale,
    p.pos[1] + d[1] * pushScale,
    p.pos[2] + d[2] * pushScale,
  ];
  const arcRad = ARC_DEG_PER_SEC * DEG2RAD * Math.min(dt, ARC_MAX_DT);
  const arcedPos = rotYAround(pushedPos, p.look, arcRad);
  return clampGround({
    pos: arcedPos,
    look: [p.look[0], p.look[1], p.look[2]],
    fov: p.fov,
    roll: p.roll,
  });
}

/** Evaluate a single camera move primitive at eased progress u in [0, 1]. */
export function moveAt(move: string, p: CamLike, easedU: number, prm: BeatPrm = {}): CamLike {
  if (prm.to !== undefined) {
    const tCam = normalizeCam(prm.to);
    return clampGround({
      pos: [
        p.pos[0] + (tCam.pos[0] - p.pos[0]) * easedU,
        p.pos[1] + (tCam.pos[1] - p.pos[1]) * easedU,
        p.pos[2] + (tCam.pos[2] - p.pos[2]) * easedU,
      ],
      look: [
        p.look[0] + (tCam.look[0] - p.look[0]) * easedU,
        p.look[1] + (tCam.look[1] - p.look[1]) * easedU,
        p.look[2] + (tCam.look[2] - p.look[2]) * easedU,
      ],
      fov: p.fov + (tCam.fov - p.fov) * easedU,
      roll: p.roll + (tCam.roll - p.roll) * easedU,
    });
  }

  const toLook: Vec3 = [p.look[0] - p.pos[0], p.look[1] - p.pos[1], p.look[2] - p.pos[2]];
  const dist = Math.max(1e-6, Math.hypot(toLook[0], toLook[1], toLook[2]));

  switch (move) {
    case 'PUSH': {
      const frac = prm.frac ?? 0.12;
      return clampGround({
        pos: add3(p.pos, scale3(toLook, frac * easedU)),
        look: [...p.look],
        fov: p.fov,
        roll: p.roll,
      });
    }
    case 'MACRO': {
      const frac = prm.frac ?? 0.3;
      return clampGround({
        pos: add3(p.pos, scale3(toLook, frac * easedU)),
        look: [...p.look],
        fov: p.fov,
        roll: p.roll,
      });
    }
    case 'PULL': {
      const frac = prm.frac ?? -0.16;
      return clampGround({
        pos: add3(p.pos, scale3(toLook, frac * easedU)),
        look: [...p.look],
        fov: p.fov,
        roll: p.roll,
      });
    }
    case 'PUNCH': {
      const frac = prm.frac ?? 0.08;
      return clampGround({
        pos: add3(p.pos, scale3(toLook, frac * easedU)),
        look: [...p.look],
        fov: p.fov,
        roll: p.roll,
      });
    }
    case 'ORBIT_L':
    case 'ORBIT_R': {
      const dir = move === 'ORBIT_L' ? 1 : -1;
      const a = (prm.deg ?? 18) * dir * easedU * DEG2RAD;
      const rollBump = -dir * 3 * DEG2RAD * Math.sin(Math.PI * easedU);
      return clampGround({
        pos: rotYAround(p.pos, p.look, a),
        look: [...p.look],
        fov: p.fov,
        roll: p.roll + rollBump,
      });
    }
    case 'CRANE_UP':
    case 'CRANE_DOWN': {
      const dir = move === 'CRANE_UP' ? 1 : -1;
      const dy = (prm.up ?? 0.25 * dist) * dir * easedU;
      const tiltFollow = prm.tilt ?? 0.55;
      return clampGround({
        pos: [p.pos[0], p.pos[1] + dy, p.pos[2]],
        look: [p.look[0], p.look[1] + dy * tiltFollow, p.look[2]],
        fov: p.fov,
        roll: p.roll,
      });
    }
    case 'DOLLY_L':
    case 'DOLLY_R': {
      const dir = move === 'DOLLY_L' ? -1 : 1;
      const rx = -toLook[2] / dist;
      const rz = toLook[0] / dist;
      const shift = (prm.side ?? 0.25 * dist) * dir * easedU;
      return clampGround({
        pos: [p.pos[0] + rx * shift, p.pos[1], p.pos[2] + rz * shift],
        look: [p.look[0] + rx * shift, p.look[1], p.look[2] + rz * shift],
        fov: p.fov,
        roll: p.roll,
      });
    }
    case 'TILT_UP':
    case 'TILT_DOWN': {
      const dir = move === 'TILT_UP' ? 1 : -1;
      const dElev = (prm.deg ?? 14) * dir * easedU * DEG2RAD;
      const horiz = Math.hypot(toLook[0], toLook[2]);
      const elev0 = Math.atan2(toLook[1], horiz);
      const elev1 = Math.max(-Math.PI * 0.48, Math.min(Math.PI * 0.48, elev0 + dElev));
      const yaw = Math.atan2(toLook[0], toLook[2]);
      const newHoriz = dist * Math.cos(elev1);
      return clampGround({
        pos: [...p.pos],
        look: [
          p.pos[0] + Math.sin(yaw) * newHoriz,
          p.pos[1] + dist * Math.sin(elev1),
          p.pos[2] + Math.cos(yaw) * newHoriz,
        ],
        fov: p.fov,
        roll: p.roll,
      });
    }
    case 'WHIP': {
      const panRad = -(prm.pan ?? 25) * easedU * DEG2RAD;
      return clampGround({
        pos: [...p.pos],
        look: rotYAround(p.look, p.pos, panRad),
        fov: p.fov,
        roll: p.roll,
      });
    }
    default:
      return clampGround({
        pos: [...p.pos],
        look: [...p.look],
        fov: p.fov,
        roll: p.roll,
      });
  }
}

/** Apply kit shake displacement to pos and look, then clamp ground. */
export function withShake<T extends CamLike>(c: T, shake: number, _t = 0): T {
  if (shake === 0) {
    return clampGround({
      ...c,
      pos: [c.pos[0], c.pos[1], c.pos[2]],
      look: [c.look[0], c.look[1], c.look[2]],
    });
  }
  const dist = Math.hypot(
    c.look[0] - c.pos[0],
    c.look[1] - c.pos[1],
    c.look[2] - c.pos[2],
  );
  const a = SHAKE_AMP_FRAC * dist * shake;
  return clampGround({
    ...c,
    pos: [c.pos[0] + 0.3 * a, c.pos[1] + 0.2 * a, c.pos[2]],
    look: [c.look[0] + a, c.look[1] + 0.6 * a, c.look[2]],
  });
}

/**
 * Fold beats chronologically starting from `base` at `t0`, advancing continuous
 * drift between beats and evaluating any active beat at time `t`.
 */
export function poseAt(
  base: CamInput,
  beats: readonly Beat[],
  t0: number,
  t: number,
  prms: readonly (BeatPrm | undefined)[] = [],
): CamPose {
  let p = clampGround(normalizeCam(base));
  let curT = t0;
  let shake = 0;

  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    if (b.move === 'SHAKE') {
      const s = t - b.t;
      if (s >= 0 && s < SHAKE_DECAY_SEC) {
        shake = Math.max(shake, (1 - s / SHAKE_DECAY_SEC) * Math.sin(s * 70));
      }
      continue;
    }
    if (b.move === 'SLOWPUSH' || b.move === 'RACK') {
      continue;
    }

    const prm = prms[i] ?? b.prm ?? {};
    const dur = prm.dur ?? defaultMoveDur(b.move, b.dur);

    if (t <= b.t) {
      if (t > curT) {
        p = drift(p, t - curT);
        curT = t;
      }
      break;
    }

    if (b.t > curT) {
      p = drift(p, b.t - curT);
      curT = b.t;
    }

    if (t < b.t + dur) {
      const u = dur > 0 ? (t - b.t) / dur : 1;
      p = moveAt(b.move, p, easeForMove(b.move, u), prm);
      curT = t;
      break;
    }

    p = moveAt(b.move, p, 1, prm);
    curT = b.t + dur;
  }

  if (t > curT) {
    p = drift(p, t - curT);
  }

  return { ...clampGround(p), shake };
}

/** Aim camera at `subject` placing it at vertical viewport fraction `face` (0=top, 1=bottom). */
export function aim(from: Vec3, subject: Vec3, fov: number, face = 0.4, roll = 0): CamLike {
  const dist = Math.hypot(
    subject[0] - from[0],
    subject[1] - from[1],
    subject[2] - from[2],
  );
  const drop = Math.tan((0.5 - face) * fov * DEG2RAD) * dist;
  return clampGround({
    pos: [from[0], from[1], from[2]],
    look: [subject[0], subject[1] - drop, subject[2]],
    fov,
    roll,
  });
}

/** Re-aim camera look point at exact distance `d` meters along its view ray. */
export function near(c: CamInput, d: number): CamLike {
  const n = normalizeCam(c);
  const dx = n.look[0] - n.pos[0];
  const dy = n.look[1] - n.pos[1];
  const dz = n.look[2] - n.pos[2];
  const dist = Math.max(1e-6, Math.hypot(dx, dy, dz));
  const s = d / dist;
  return clampGround({
    pos: [...n.pos],
    look: [n.pos[0] + dx * s, n.pos[1] + dy * s, n.pos[2] + dz * s],
    fov: n.fov,
    roll: n.roll,
  });
}

/** Yaw camera look point horizontally around pos by `deg` degrees. */
export function panned(c: CamInput, deg: number): CamLike {
  const n = normalizeCam(c);
  return clampGround({
    pos: [...n.pos],
    look: rotYAround(n.look, n.pos, deg * DEG2RAD),
    fov: n.fov,
    roll: n.roll,
  });
}

/** Select active setup by global frame and evaluate setup-local camera pose. */
export function camAtFrame(
  setups: readonly SetupSpec[],
  frame: number,
  fps = 30,
): CamPose {
  const setup =
    setups.find((s) => frame >= s.startFrame && frame <= s.endFrame) ??
    (frame < setups[0].startFrame ? setups[0] : setups[setups.length - 1]);
  const localT = (frame - setup.startFrame) / fps;
  const pose = poseAt(setup.base, setup.beats, 0, localT, setup.prms);
  return pose.shake !== 0 ? { ...withShake(pose, pose.shake, localT), shake: pose.shake } : pose;
}
