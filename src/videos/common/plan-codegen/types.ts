export const PLAN_CODEGEN_SCHEMA_VERSION = '1.0.0';
export const DEFAULT_GAP_THRESHOLD_MS = 350;
export const SILENT_SHOT_GAP_MS = 2000;
export const RICKS_BEAT_BANDS_MS = {
  HOOK_END_MS: 4000,
  SETUP_END_MS: 25000,
  ESCALATION_END_MS: 45000,
} as const;

export type BeatLabel = 'hook' | 'setup' | 'escalation' | 'reveal';

export const VALID_BEAT_LABELS: readonly BeatLabel[] = [
  'hook',
  'setup',
  'escalation',
  'reveal',
] as const;

export type ValidationErrorCode =
  | 'EMPTY_TIMING_INPUT'
  | 'MALFORMED_LINE'
  | 'INVALID_TIMESTAMP'
  | 'EMPTY_WORD_TOKEN'
  | 'NEGATIVE_WORD_DURATION'
  | 'OVERLAPPING_WORDS'
  | 'WORD_EXCEEDS_AUDIO_DURATION'
  | 'INVALID_AUDIO_META'
  | 'INVALID_OVERRIDES_SCHEMA'
  | 'IMMUTABLE_SHOT_FIELD_WITHOUT_FORCE'
  | 'INVALID_FORCED_FRAME_RANGE'
  | 'TOTAL_FRAME_MISMATCH'
  | 'INSUFFICIENT_FRAMES_FOR_SHOTS';

export class PlanCodegenValidationError extends Error {
  readonly code: ValidationErrorCode;
  readonly line?: number;
  readonly wordIndex?: number;

  constructor(
    code: ValidationErrorCode,
    message: string,
    details?: { readonly line?: number; readonly wordIndex?: number },
  ) {
    super(message);
    this.name = 'PlanCodegenValidationError';
    this.code = code;
    this.line = details?.line;
    this.wordIndex = details?.wordIndex;
  }
}

export interface TimedWord {
  readonly word_index: number;
  readonly word: string;
  readonly start_ms: number;
  readonly end_ms: number;
  readonly clamped_zero_duration: boolean;
  readonly source_line: number;
}

export interface AudioMeta {
  readonly duration_ms: number;
  readonly fps: number;
}

export interface GroupingOptions {
  readonly gap_threshold_ms?: number;
  readonly max_words_per_phrase?: number | null;
  readonly silent_shot_gap_ms?: number;
}

export interface ShotPlanEntry {
  readonly shot_index: number;
  readonly shot_number: number;
  readonly start_frame: number;
  readonly end_frame: number;
  readonly duration_frames: number;
  readonly start_ms: number;
  readonly end_ms: number;
  readonly phrase_text: string;
  readonly word_count: number;
  readonly first_word_index: number | null;
  readonly last_word_index: number | null;
  readonly beat_label: BeatLabel;
  readonly camera_slot_id: string;
  readonly is_silent: boolean;
  readonly overridden: boolean;
  readonly override_sources: readonly string[];
  readonly notes?: string;
  readonly metadata?: Record<string, string | number | boolean | null>;
}

export type ValidationCheckId =
  | 'CHECK_1_CONTINUITY'
  | 'CHECK_2_TOTAL_FRAMES'
  | 'CHECK_3_POSITIVE_FRAME_RANGES'
  | 'CHECK_4_BEAT_VALIDITY'
  | 'CHECK_5_PHRASE_INTEGRITY'
  | 'CHECK_6_DETERMINISM_HASH';

export interface ValidationCheckResult {
  readonly id: ValidationCheckId;
  readonly passed: boolean;
  readonly summary: string;
}

export interface PlanCodegenResult {
  readonly shots: readonly ShotPlanEntry[];
  readonly shot_plan_json: string;
  readonly shot_plan_sha256: string;
  readonly validation_report_txt: string;
  readonly checks: readonly ValidationCheckResult[];
  readonly all_passed: boolean;
}

export interface PhraseBreaksOverride {
  readonly mode: 'replace' | 'patch';
  readonly split_before_word_indices?: readonly number[];
  readonly split_at_start_frames?: readonly number[];
  readonly force_split_before_words?: readonly number[];
  readonly suppress_split_before_words?: readonly number[];
  readonly force_split_at_frames?: readonly number[];
  readonly suppress_split_at_frames?: readonly number[];
}

export interface ShotEntryOverride {
  readonly beat_label?: BeatLabel;
  readonly camera_slot_id?: string;
  readonly notes?: string;
  readonly metadata?: Record<string, string | number | boolean | null>;
  readonly force_frames?: boolean;
  readonly start_frame?: number;
  readonly end_frame?: number;
  readonly phrase_text?: string;
}

export interface OverridesSidecar {
  readonly schema_version?: string;
  readonly description?: string;
  readonly phrase_breaks?: PhraseBreaksOverride;
  readonly shots?: Record<string, ShotEntryOverride>;
}

export interface GenerateShotPlanParams {
  readonly timingContent: string;
  readonly timingFormatHint?: 'txt' | 'json';
  readonly durationSec: string | number;
  readonly fps: number;
  readonly groupingOptions?: GroupingOptions;
  readonly overridesContent?: string;
}
