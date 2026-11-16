import type { CamLike } from '../applyCam';
import { aim, DEG2RAD, type Vec3 } from './rig';

export interface SubjectSpec {
  feet: Vec3;
  height: number;
  /** Subject facing yaw in radians (default 0, i.e. +Z) */
  facing?: number;
  /** Side angle offset in degrees (overrides preset default) */
  side?: number;
  /** Vertical FOV in degrees (overrides preset default) */
  fov?: number;
  /** Vertical fraction of height where subject head/eyes sit (default 0.85) */
  headAt?: number;
}

export interface FgSpot {
  pos: Vec3;
  side: -1 | 1;
  dist: number;
}

export interface ShotResult {
  cam: CamLike;
  focus: number;
  blur: number;
  fg: FgSpot[];
}

export type ShotPresetName = 'heroLow' | 'medium' | 'closeUp' | 'wide';

interface PresetCfg {
  fov: number;
  spanMult: number;
  fill: number;
  lensHeight: (height: number) => number;
  side: number;
  face: number;
  blur: number;
}

const PRESET_CFGS: Record<ShotPresetName, PresetCfg> = {
  heroLow: {
    fov: 56,
    spanMult: 1.0,
    fill: 0.4,
    lensHeight: (h) => h * 0.36,
    side: 30,
    face: 0.33,
    blur: 0.015,
  },
  medium: {
    fov: 48,
    spanMult: 0.75,
    fill: 0.62,
    lensHeight: (h) => h * 0.72,
    side: 28,
    face: 0.36,
    blur: 0.02,
  },
  closeUp: {
    fov: 42,
    spanMult: 0.55,
    fill: 0.5,
    lensHeight: (h) => h * 0.84,
    side: 25,
    face: 0.38,
    blur: 0.03,
  },
  wide: {
    fov: 62,
    spanMult: 1.0,
    fill: 0.18,
    lensHeight: (h) => Math.max(1.6, h * 1.1),
    side: 20,
    face: 0.5,
    blur: 0.008,
  },
};

/** Distance needed so `span` fills `fill` of vertical frame at `fov` degrees. */
export function distFor(span: number, fill: number, fov: number): number {
  return span / fill / (2 * Math.tan((fov * DEG2RAD) / 2));
}

function buildShot(cfg: PresetCfg, s: SubjectSpec): ShotResult {
  const fov = s.fov ?? cfg.fov;
  const span = s.height * cfg.spanMult;
  const d = distFor(span, cfg.fill, fov);
  const sideDeg = s.side ?? cfg.side;
  const yaw = (s.facing ?? 0) + sideDeg * DEG2RAD;
  const lensY = cfg.lensHeight(s.height);
  const from: Vec3 = [
    s.feet[0] + Math.sin(yaw) * d,
    s.feet[1] + lensY,
    s.feet[2] + Math.cos(yaw) * d,
  ];
  const subject: Vec3 = [
    s.feet[0],
    s.feet[1] + s.height * (s.headAt ?? 0.85),
    s.feet[2],
  ];
  const cam = aim(from, subject, fov, cfg.face, 0);
  const focus = Math.hypot(
    subject[0] - cam.pos[0],
    subject[1] - cam.pos[1],
    subject[2] - cam.pos[2],
  );
  const fgDist = d * 0.4;
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  const fg: FgSpot[] = ([-1, 1] as const).map((side) => ({
    pos: [
      s.feet[0] + Math.sin(yaw) * fgDist + rx * side * fgDist * 0.35,
      s.feet[1],
      s.feet[2] + Math.cos(yaw) * fgDist + rz * side * fgDist * 0.35,
    ],
    side,
    dist: fgDist,
  }));
  return { cam, focus, blur: cfg.blur, fg };
}

export function heroLow(s: SubjectSpec): ShotResult {
  return buildShot(PRESET_CFGS.heroLow, s);
}

export function medium(s: SubjectSpec): ShotResult {
  return buildShot(PRESET_CFGS.medium, s);
}

export function closeUp(s: SubjectSpec): ShotResult {
  return buildShot(PRESET_CFGS.closeUp, s);
}

export function wide(s: SubjectSpec): ShotResult {
  return buildShot(PRESET_CFGS.wide, s);
}

export const SHOT_PRESETS: Readonly<Record<ShotPresetName, (s: SubjectSpec) => ShotResult>> = {
  heroLow,
  medium,
  closeUp,
  wide,
};
