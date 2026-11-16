import {
  RICKS_BEAT_BANDS_MS,
  type AudioMeta,
  type BeatLabel,
  type ShotPlanEntry,
} from './types';

const CAMERA_SLOTS_BY_BEAT: Record<BeatLabel, readonly [string, string]> = {
  hook: ['cam_hook_wide', 'cam_hook_push'],
  setup: ['cam_setup_a', 'cam_setup_b'],
  escalation: ['cam_esc_tight_a', 'cam_esc_tight_b'],
  reveal: ['cam_reveal_hero', 'cam_reveal_detail'],
};

export interface OutOfBandBeatEntry {
  readonly shot_index: number;
  readonly shot_number: number;
  readonly band: BeatLabel;
  readonly assigned: BeatLabel;
  readonly onset_ms: number;
  readonly override_sources: readonly string[];
  readonly has_beat_override: boolean;
}

/**
 * Assigns a Ricks time-position beat label from onset timestamp in integer milliseconds:
 * hook [0, 4000), setup [4000, 25000), escalation [25000, 45000), reveal [45000, end].
 */
export function assignBeat(onsetMs: number): BeatLabel {
  if (onsetMs < RICKS_BEAT_BANDS_MS.HOOK_END_MS) {
    return 'hook';
  }
  if (onsetMs < RICKS_BEAT_BANDS_MS.SETUP_END_MS) {
    return 'setup';
  }
  if (onsetMs < RICKS_BEAT_BANDS_MS.ESCALATION_END_MS) {
    return 'escalation';
  }
  return 'reveal';
}

/**
 * Deterministically assigns a camera slot ID from the shot's beat label and its
 * 0-based sequential index among shots in that beat band.
 */
export function assignCameraSlotId(
  beat: BeatLabel,
  indexInBeat: number,
  _shotIndex: number,
): string {
  const pair = CAMERA_SLOTS_BY_BEAT[beat];
  return pair[((indexInBeat % 2) + 2) % 2];
}

/**
 * Computes the onset timestamp in ms used for Ricks time-band beat classification.
 */
export function getShotOnsetMs(shot: ShotPlanEntry, fps: number): number {
  return shot.is_silent
    ? Math.floor((shot.start_frame * 1000) / fps)
    : shot.start_ms;
}

/**
 * Returns every shot whose final beat_label differs from assignBeat(onset_ms),
 * along with its band expectation and override provenance.
 */
export function detectOutOfBandBeats(
  shots: readonly ShotPlanEntry[],
  audioMeta: AudioMeta,
): OutOfBandBeatEntry[] {
  const flagged: OutOfBandBeatEntry[] = [];
  for (const shot of shots) {
    const onsetMs = getShotOnsetMs(shot, audioMeta.fps);
    const band = assignBeat(onsetMs);
    if (shot.beat_label !== band) {
      flagged.push({
        shot_index: shot.shot_index,
        shot_number: shot.shot_number,
        band,
        assigned: shot.beat_label,
        onset_ms: onsetMs,
        override_sources: [...shot.override_sources],
        has_beat_override:
          shot.overridden && shot.override_sources.includes('beat_label'),
      });
    }
  }
  return flagged;
}
