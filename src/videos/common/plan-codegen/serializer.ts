import { createHash } from 'node:crypto';
import { detectOutOfBandBeats, type OutOfBandBeatEntry } from './beats';
import { msToFrame } from './parser';
import {
  PLAN_CODEGEN_SCHEMA_VERSION,
  type AudioMeta,
  type GroupingOptions,
  type ShotPlanEntry,
  type ValidationCheckResult,
} from './types';

const SHOT_ENTRY_KEY_ORDER: readonly (keyof ShotPlanEntry)[] = [
  'shot_index',
  'shot_number',
  'start_frame',
  'end_frame',
  'duration_frames',
  'start_ms',
  'end_ms',
  'phrase_text',
  'word_count',
  'first_word_index',
  'last_word_index',
  'beat_label',
  'camera_slot_id',
  'is_silent',
  'overridden',
  'override_sources',
  'notes',
  'metadata',
] as const;

function compareAscii(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function normalizeShotForSerialization(
  shot: ShotPlanEntry,
): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  for (const key of SHOT_ENTRY_KEY_ORDER) {
    const val = shot[key];
    if (val === undefined) {
      continue;
    }
    if (key === 'override_sources') {
      ordered[key] = [...(val as readonly string[])];
    } else if (key === 'metadata') {
      const meta = val as Record<string, string | number | boolean | null>;
      const sortedMeta: Record<string, string | number | boolean | null> = {};
      for (const mKey of Object.keys(meta).sort(compareAscii)) {
        sortedMeta[mKey] = meta[mKey];
      }
      ordered[key] = sortedMeta;
    } else {
      ordered[key] = val;
    }
  }
  return ordered;
}

export function serializeShotPlan(shots: readonly ShotPlanEntry[]): string {
  const normalized = shots.map(normalizeShotForSerialization);
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

export function sha256Hex(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export interface ValidationReportContext {
  readonly audioMeta: AudioMeta;
  readonly wordCount: number;
  readonly shots: readonly ShotPlanEntry[];
  readonly groupingOptions?: GroupingOptions;
  readonly checks: readonly ValidationCheckResult[];
  readonly outOfBandBeats?: readonly OutOfBandBeatEntry[];
  readonly shotPlanSha256: string;
}

export function formatValidationReport(ctx: ValidationReportContext): string {
  const {
    audioMeta,
    wordCount,
    shots,
    groupingOptions,
    checks,
    outOfBandBeats: providedOutOfBand,
    shotPlanSha256,
  } = ctx;
  const totalFrames = msToFrame(audioMeta.duration_ms, audioMeta.fps);
  const silentShotCount = shots.filter((s) => s.is_silent).length;
  const overriddenShots = shots.filter((s) => s.overridden);
  const outOfBandBeats =
    providedOutOfBand ?? detectOutOfBandBeats(shots, audioMeta);
  const gapThresholdMs = groupingOptions?.gap_threshold_ms ?? 350;
  const maxWords = groupingOptions?.max_words_per_phrase ?? null;
  const allPassed = checks.every((c) => c.passed);

  const lines: string[] = [
    '================================================================================',
    'PLAN CODEGEN VALIDATION REPORT',
    '================================================================================',
    `schema_version: ${PLAN_CODEGEN_SCHEMA_VERSION}`,
    `audio_duration_ms: ${audioMeta.duration_ms}`,
    `fps: ${audioMeta.fps}`,
    `total_frames: ${totalFrames}`,
    `word_count: ${wordCount}`,
    `shot_count: ${shots.length}`,
    `silent_shot_count: ${silentShotCount}`,
    `overridden_shot_count: ${overriddenShots.length}`,
    `grouping_gap_threshold_ms: ${gapThresholdMs}`,
    `max_words_per_phrase: ${maxWords === null ? 'none' : String(maxWords)}`,
    'rounding_rule: Indiana Bell convention — start_frame = round(start_sec * fps) = floor((start_ms * fps + 500) / 1000); boundaries are phrase starts; round() may place a cut up to 0.5 frames after word onset.',
    'beat_rule: Ricks time-position bands — hook [0ms, 4000ms), setup [4000ms, 25000ms), escalation [25000ms, 45000ms), reveal [45000ms, end].',
    '',
    '--------------------------------------------------------------------------------',
    'VERIFICATION CHECKLIST',
    '--------------------------------------------------------------------------------',
  ];

  for (const check of checks) {
    const tag = check.passed ? '[PASS]' : '[FAIL]';
    lines.push(`${tag} ${check.id}: ${check.summary}`);
  }

  lines.push(
    '',
    '--------------------------------------------------------------------------------',
    'OVERRIDDEN SHOTS SUMMARY',
    '--------------------------------------------------------------------------------',
  );

  if (overriddenShots.length === 0) {
    lines.push('none');
  } else {
    for (const shot of overriddenShots) {
      lines.push(
        `shot_index=${shot.shot_index} (shot_number=${shot.shot_number}): frames=[${shot.start_frame}..${shot.end_frame}] beat=${shot.beat_label} slot=${shot.camera_slot_id} sources=[${shot.override_sources.join(', ')}]`,
      );
    }
  }

  lines.push(
    '',
    '--------------------------------------------------------------------------------',
    'OUT-OF-BAND BEAT OVERRIDES',
    '--------------------------------------------------------------------------------',
    `OUT_OF_BAND_BEAT_OVERRIDES: ${outOfBandBeats.length}`,
  );

  for (const oob of outOfBandBeats) {
    lines.push(
      `shot_index=${oob.shot_index} (shot_number=${oob.shot_number}): band=${oob.band} assigned=${oob.assigned} onset_ms=${oob.onset_ms} sources=[${oob.override_sources.join(', ')}]`,
    );
  }

  lines.push(
    '',
    '--------------------------------------------------------------------------------',
    `OVERALL_STATUS: ${allPassed ? 'PASS' : 'FAIL'}`,
    `shot_plan_sha256: ${shotPlanSha256}`,
    '================================================================================',
  );

  return `${lines.join('\n')}\n`;
}
