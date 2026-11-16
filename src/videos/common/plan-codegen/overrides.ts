import { msToFrame, validateAudioMeta } from './parser';
import {
  PlanCodegenValidationError,
  VALID_BEAT_LABELS,
  type AudioMeta,
  type BeatLabel,
  type OverridesSidecar,
  type PhraseBreaksOverride,
  type ShotEntryOverride,
  type ShotPlanEntry,
  type TimedWord,
} from './types';

const NUMERIC_KEY_RE = /^\d+$/;
const ALLOWED_TOP_KEYS = new Set([
  'schema_version',
  'description',
  'phrase_breaks',
  'shots',
]);
const ALLOWED_PHRASE_BREAK_KEYS = new Set([
  'mode',
  'split_before_word_indices',
  'split_at_start_frames',
  'force_split_before_words',
  'suppress_split_before_words',
  'force_split_at_frames',
  'suppress_split_at_frames',
]);
const ALLOWED_SHOT_OVERRIDE_KEYS = new Set([
  'beat_label',
  'camera_slot_id',
  'notes',
  'metadata',
  'force_frames',
  'start_frame',
  'end_frame',
  'phrase_text',
]);

interface MutableShotPlanEntry {
  shot_index: number;
  shot_number: number;
  start_frame: number;
  end_frame: number;
  duration_frames: number;
  start_ms: number;
  end_ms: number;
  phrase_text: string;
  word_count: number;
  first_word_index: number | null;
  last_word_index: number | null;
  beat_label: BeatLabel;
  camera_slot_id: string;
  is_silent: boolean;
  overridden: boolean;
  override_sources: string[];
  notes?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function compareAscii(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortMetadata(
  meta: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> {
  const sorted: Record<string, string | number | boolean | null> = {};
  const keys = Object.keys(meta).sort(compareAscii);
  for (const key of keys) {
    sorted[key] = meta[key];
  }
  return sorted;
}

function validateIntArray(value: unknown, fieldName: string): readonly number[] {
  if (!Array.isArray(value)) {
    throw new PlanCodegenValidationError(
      'INVALID_OVERRIDES_SCHEMA',
      `${fieldName} must be an array of non-negative integers`,
    );
  }
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 0) {
      throw new PlanCodegenValidationError(
        'INVALID_OVERRIDES_SCHEMA',
        `${fieldName}[${i}] must be a non-negative integer, got ${String(item)}`,
      );
    }
  }
  return value as readonly number[];
}

function validatePhraseBreaks(raw: unknown): PhraseBreaksOverride {
  if (!isPlainObject(raw)) {
    throw new PlanCodegenValidationError(
      'INVALID_OVERRIDES_SCHEMA',
      'phrase_breaks must be a JSON object',
    );
  }
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_PHRASE_BREAK_KEYS.has(key)) {
      throw new PlanCodegenValidationError(
        'INVALID_OVERRIDES_SCHEMA',
        `Unknown phrase_breaks field: "${key}"`,
      );
    }
  }
  if (raw.mode !== 'replace' && raw.mode !== 'patch') {
    throw new PlanCodegenValidationError(
      'INVALID_OVERRIDES_SCHEMA',
      `phrase_breaks.mode must be "replace" or "patch", got ${String(raw.mode)}`,
    );
  }

  const out: {
    mode: 'replace' | 'patch';
    split_before_word_indices?: readonly number[];
    split_at_start_frames?: readonly number[];
    force_split_before_words?: readonly number[];
    suppress_split_before_words?: readonly number[];
    force_split_at_frames?: readonly number[];
    suppress_split_at_frames?: readonly number[];
  } = { mode: raw.mode };

  if (raw.split_before_word_indices !== undefined) {
    out.split_before_word_indices = validateIntArray(
      raw.split_before_word_indices,
      'phrase_breaks.split_before_word_indices',
    );
  }
  if (raw.split_at_start_frames !== undefined) {
    out.split_at_start_frames = validateIntArray(
      raw.split_at_start_frames,
      'phrase_breaks.split_at_start_frames',
    );
  }
  if (raw.force_split_before_words !== undefined) {
    out.force_split_before_words = validateIntArray(
      raw.force_split_before_words,
      'phrase_breaks.force_split_before_words',
    );
  }
  if (raw.suppress_split_before_words !== undefined) {
    out.suppress_split_before_words = validateIntArray(
      raw.suppress_split_before_words,
      'phrase_breaks.suppress_split_before_words',
    );
  }
  if (raw.force_split_at_frames !== undefined) {
    out.force_split_at_frames = validateIntArray(
      raw.force_split_at_frames,
      'phrase_breaks.force_split_at_frames',
    );
  }
  if (raw.suppress_split_at_frames !== undefined) {
    out.suppress_split_at_frames = validateIntArray(
      raw.suppress_split_at_frames,
      'phrase_breaks.suppress_split_at_frames',
    );
  }

  if (
    out.mode === 'replace' &&
    out.split_before_word_indices === undefined &&
    out.split_at_start_frames === undefined
  ) {
    throw new PlanCodegenValidationError(
      'INVALID_OVERRIDES_SCHEMA',
      'phrase_breaks with mode "replace" must provide split_before_word_indices or split_at_start_frames',
    );
  }

  return out;
}

function validateShotEntryOverride(
  raw: unknown,
  shotKey: string,
): ShotEntryOverride {
  if (!isPlainObject(raw)) {
    throw new PlanCodegenValidationError(
      'INVALID_OVERRIDES_SCHEMA',
      `shots["${shotKey}"] must be an object`,
    );
  }
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_SHOT_OVERRIDE_KEYS.has(key)) {
      throw new PlanCodegenValidationError(
        'INVALID_OVERRIDES_SCHEMA',
        `Unknown field "${key}" in shots["${shotKey}"]`,
      );
    }
  }

  const entry: {
    beat_label?: BeatLabel;
    camera_slot_id?: string;
    notes?: string;
    metadata?: Record<string, string | number | boolean | null>;
    force_frames?: boolean;
    start_frame?: number;
    end_frame?: number;
    phrase_text?: string;
  } = {};

  if (raw.beat_label !== undefined) {
    if (
      typeof raw.beat_label !== 'string' ||
      !VALID_BEAT_LABELS.includes(raw.beat_label as BeatLabel)
    ) {
      throw new PlanCodegenValidationError(
        'INVALID_OVERRIDES_SCHEMA',
        `Invalid beat_label "${String(raw.beat_label)}" in shots["${shotKey}"]`,
      );
    }
    entry.beat_label = raw.beat_label as BeatLabel;
  }

  if (raw.camera_slot_id !== undefined) {
    if (typeof raw.camera_slot_id !== 'string' || raw.camera_slot_id.trim().length === 0) {
      throw new PlanCodegenValidationError(
        'INVALID_OVERRIDES_SCHEMA',
        `camera_slot_id in shots["${shotKey}"] must be a non-empty string`,
      );
    }
    entry.camera_slot_id = raw.camera_slot_id;
  }

  if (raw.notes !== undefined) {
    if (typeof raw.notes !== 'string') {
      throw new PlanCodegenValidationError(
        'INVALID_OVERRIDES_SCHEMA',
        `notes in shots["${shotKey}"] must be a string`,
      );
    }
    entry.notes = raw.notes;
  }

  if (raw.metadata !== undefined) {
    if (!isPlainObject(raw.metadata)) {
      throw new PlanCodegenValidationError(
        'INVALID_OVERRIDES_SCHEMA',
        `metadata in shots["${shotKey}"] must be a plain object`,
      );
    }
    const metaOut: Record<string, string | number | boolean | null> = {};
    for (const mKey of Object.keys(raw.metadata).sort(compareAscii)) {
      const mVal = raw.metadata[mKey];
      const validPrimitive =
        mVal === null ||
        typeof mVal === 'string' ||
        typeof mVal === 'boolean' ||
        (typeof mVal === 'number' && Number.isFinite(mVal));
      if (!validPrimitive) {
        throw new PlanCodegenValidationError(
          'INVALID_OVERRIDES_SCHEMA',
          `metadata["${mKey}"] in shots["${shotKey}"] must be string, finite number, boolean, or null`,
        );
      }
      metaOut[mKey] = mVal as string | number | boolean | null;
    }
    entry.metadata = metaOut;
  }

  if (raw.force_frames !== undefined) {
    if (typeof raw.force_frames !== 'boolean') {
      throw new PlanCodegenValidationError(
        'INVALID_OVERRIDES_SCHEMA',
        `force_frames in shots["${shotKey}"] must be a boolean`,
      );
    }
    entry.force_frames = raw.force_frames;
  }

  if (raw.start_frame !== undefined) {
    if (typeof raw.start_frame !== 'number' || !Number.isInteger(raw.start_frame)) {
      throw new PlanCodegenValidationError(
        'INVALID_OVERRIDES_SCHEMA',
        `start_frame in shots["${shotKey}"] must be an integer`,
      );
    }
    entry.start_frame = raw.start_frame;
  }

  if (raw.end_frame !== undefined) {
    if (typeof raw.end_frame !== 'number' || !Number.isInteger(raw.end_frame)) {
      throw new PlanCodegenValidationError(
        'INVALID_OVERRIDES_SCHEMA',
        `end_frame in shots["${shotKey}"] must be an integer`,
      );
    }
    entry.end_frame = raw.end_frame;
  }

  if (raw.phrase_text !== undefined) {
    if (typeof raw.phrase_text !== 'string') {
      throw new PlanCodegenValidationError(
        'INVALID_OVERRIDES_SCHEMA',
        `phrase_text in shots["${shotKey}"] must be a string`,
      );
    }
    entry.phrase_text = raw.phrase_text;
  }

  return entry;
}

function validateShotsMap(raw: unknown): Record<string, ShotEntryOverride> {
  if (!isPlainObject(raw)) {
    throw new PlanCodegenValidationError(
      'INVALID_OVERRIDES_SCHEMA',
      'shots override container must be a JSON object',
    );
  }
  const shotsOut: Record<string, ShotEntryOverride> = {};
  const keys = Object.keys(raw).sort((a, b) => Number(a) - Number(b));
  for (const key of keys) {
    if (!NUMERIC_KEY_RE.test(key)) {
      throw new PlanCodegenValidationError(
        'INVALID_OVERRIDES_SCHEMA',
        `Shot override key "${key}" must be a non-negative integer string`,
      );
    }
    shotsOut[key] = validateShotEntryOverride(raw[key], key);
  }
  return shotsOut;
}

export function parseOverridesSidecar(jsonContent: string): OverridesSidecar {
  const normalized = jsonContent.startsWith('\uFEFF')
    ? jsonContent.slice(1)
    : jsonContent;

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch (err) {
    throw new PlanCodegenValidationError(
      'INVALID_OVERRIDES_SCHEMA',
      `Malformed overrides JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!isPlainObject(parsed)) {
    throw new PlanCodegenValidationError(
      'INVALID_OVERRIDES_SCHEMA',
      'Overrides sidecar root must be a JSON object',
    );
  }

  const topKeys = Object.keys(parsed);
  // Backward compatibility: legacy flat map keyed directly by numeric shot indices.
  if (topKeys.length > 0 && topKeys.every((k) => NUMERIC_KEY_RE.test(k))) {
    return { shots: validateShotsMap(parsed) };
  }

  for (const key of topKeys) {
    if (!ALLOWED_TOP_KEYS.has(key)) {
      throw new PlanCodegenValidationError(
        'INVALID_OVERRIDES_SCHEMA',
        `Unknown top-level overrides key: "${key}"`,
      );
    }
  }

  const out: {
    schema_version?: string;
    description?: string;
    phrase_breaks?: PhraseBreaksOverride;
    shots?: Record<string, ShotEntryOverride>;
  } = {};

  if (parsed.schema_version !== undefined) {
    if (
      typeof parsed.schema_version !== 'string' ||
      parsed.schema_version.trim().length === 0
    ) {
      throw new PlanCodegenValidationError(
        'INVALID_OVERRIDES_SCHEMA',
        'schema_version must be a non-empty string',
      );
    }
    out.schema_version = parsed.schema_version;
  }

  if (parsed.description !== undefined) {
    if (typeof parsed.description !== 'string') {
      throw new PlanCodegenValidationError(
        'INVALID_OVERRIDES_SCHEMA',
        'description must be a string',
      );
    }
    out.description = parsed.description;
  }

  if (parsed.phrase_breaks !== undefined) {
    out.phrase_breaks = validatePhraseBreaks(parsed.phrase_breaks);
  }

  if (parsed.shots !== undefined) {
    out.shots = validateShotsMap(parsed.shots);
  }

  return out;
}

export function applyShotOverrides(
  shots: readonly ShotPlanEntry[],
  _words: readonly TimedWord[],
  audioMeta: AudioMeta,
  overrides?: OverridesSidecar,
): ShotPlanEntry[] {
  validateAudioMeta(audioMeta);
  const totalFrames = msToFrame(audioMeta.duration_ms, audioMeta.fps);

  const working: MutableShotPlanEntry[] = shots.map((s) => ({
    shot_index: s.shot_index,
    shot_number: s.shot_number,
    start_frame: s.start_frame,
    end_frame: s.end_frame,
    duration_frames: s.duration_frames,
    start_ms: s.start_ms,
    end_ms: s.end_ms,
    phrase_text: s.phrase_text,
    word_count: s.word_count,
    first_word_index: s.first_word_index,
    last_word_index: s.last_word_index,
    beat_label: s.beat_label,
    camera_slot_id: s.camera_slot_id,
    is_silent: s.is_silent,
    overridden: s.overridden,
    override_sources: [...s.override_sources],
    ...(s.notes !== undefined ? { notes: s.notes } : {}),
    ...(s.metadata !== undefined ? { metadata: sortMetadata({ ...s.metadata }) } : {}),
  }));

  if (!overrides?.shots) {
    return working;
  }

  const shotCount = working.length;
  const sortedKeys = Object.keys(overrides.shots).sort(
    (a, b) => Number(a) - Number(b),
  );

  for (const idxStr of sortedKeys) {
    if (!NUMERIC_KEY_RE.test(idxStr)) {
      throw new PlanCodegenValidationError(
        'INVALID_OVERRIDES_SCHEMA',
        `Invalid shot index key "${idxStr}"`,
      );
    }
    const shotIndex = Number(idxStr);
    if (!Number.isInteger(shotIndex) || shotIndex < 0 || shotIndex >= shotCount) {
      throw new PlanCodegenValidationError(
        'INVALID_OVERRIDES_SCHEMA',
        `Override shot index ${idxStr} out of range [0, ${shotCount - 1}]`,
      );
    }

    const ov = overrides.shots[idxStr];
    const target = working[shotIndex];

    // Immutability guard: frame/text edits require force_frames === true.
    if (
      (ov.start_frame !== undefined ||
        ov.end_frame !== undefined ||
        ov.phrase_text !== undefined) &&
      ov.force_frames !== true
    ) {
      throw new PlanCodegenValidationError(
        'IMMUTABLE_SHOT_FIELD_WITHOUT_FORCE',
        `Shot ${shotIndex} attempts to override start_frame, end_frame, or phrase_text without force_frames: true`,
      );
    }

    const sources = new Set<string>(target.override_sources);

    if (ov.beat_label !== undefined) {
      if (!VALID_BEAT_LABELS.includes(ov.beat_label)) {
        throw new PlanCodegenValidationError(
          'INVALID_OVERRIDES_SCHEMA',
          `Invalid beat_label "${String(ov.beat_label)}" on shot ${shotIndex}`,
        );
      }
      target.beat_label = ov.beat_label;
      sources.add('beat_label');
    }

    if (ov.camera_slot_id !== undefined) {
      target.camera_slot_id = ov.camera_slot_id;
      sources.add('camera_slot_id');
    }

    if (ov.notes !== undefined) {
      target.notes = ov.notes;
      sources.add('notes');
    }

    if (ov.metadata !== undefined) {
      target.metadata = sortMetadata({
        ...(target.metadata ?? {}),
        ...ov.metadata,
      });
      sources.add('metadata');
    }

    if (ov.phrase_text !== undefined) {
      target.phrase_text = ov.phrase_text;
      sources.add('phrase_text');
    }

    if (ov.start_frame !== undefined) {
      if (
        !Number.isInteger(ov.start_frame) ||
        ov.start_frame < 0 ||
        ov.start_frame >= totalFrames
      ) {
        throw new PlanCodegenValidationError(
          'INVALID_FORCED_FRAME_RANGE',
          `Shot ${shotIndex} forced start_frame ${ov.start_frame} out of valid range [0, ${totalFrames - 1}]`,
        );
      }
      if (shotIndex === 0 && ov.start_frame !== 0) {
        throw new PlanCodegenValidationError(
          'INVALID_FORCED_FRAME_RANGE',
          `Shot 0 must start at frame 0, got forced start_frame ${ov.start_frame}`,
        );
      }
      target.start_frame = ov.start_frame;
      if (shotIndex > 0) {
        const prev = working[shotIndex - 1];
        prev.end_frame = ov.start_frame;
        if (prev.end_frame <= prev.start_frame) {
          throw new PlanCodegenValidationError(
            'INVALID_FORCED_FRAME_RANGE',
            `Forced start_frame ${ov.start_frame} on shot ${shotIndex} inverts shot ${shotIndex - 1} (${prev.start_frame}..${prev.end_frame})`,
          );
        }
        prev.duration_frames = prev.end_frame - prev.start_frame;
      }
      sources.add('force_frames');
    }

    if (ov.end_frame !== undefined) {
      if (!Number.isInteger(ov.end_frame)) {
        throw new PlanCodegenValidationError(
          'INVALID_FORCED_FRAME_RANGE',
          `Shot ${shotIndex} forced end_frame must be an integer`,
        );
      }
      if (shotIndex === shotCount - 1 && ov.end_frame !== totalFrames) {
        throw new PlanCodegenValidationError(
          'TOTAL_FRAME_MISMATCH',
          `Final shot ${shotIndex} forced end_frame (${ov.end_frame}) !== total_frames (${totalFrames})`,
        );
      }
      if (ov.end_frame <= 0 || ov.end_frame > totalFrames) {
        throw new PlanCodegenValidationError(
          'INVALID_FORCED_FRAME_RANGE',
          `Shot ${shotIndex} forced end_frame ${ov.end_frame} out of valid range [1, ${totalFrames}]`,
        );
      }
      target.end_frame = ov.end_frame;

      if (shotIndex < shotCount - 1) {
        working[shotIndex + 1].start_frame = ov.end_frame;
        for (let j = shotIndex + 1; j < shotCount - 1; j++) {
          if (working[j].start_frame >= working[j].end_frame) {
            working[j].end_frame = working[j].start_frame + 1;
            working[j + 1].start_frame = working[j].end_frame;
          }
          working[j].duration_frames =
            working[j].end_frame - working[j].start_frame;
        }
        const last = working[shotCount - 1];
        if (last.start_frame >= last.end_frame) {
          throw new PlanCodegenValidationError(
            'INVALID_FORCED_FRAME_RANGE',
            `Forward continuity cascade from shot ${shotIndex} pushed final shot start_frame (${last.start_frame}) >= end_frame (${last.end_frame})`,
          );
        }
        last.duration_frames = last.end_frame - last.start_frame;
      }
      sources.add('force_frames');
    }

    if (target.start_frame < 0 || target.end_frame <= target.start_frame) {
      throw new PlanCodegenValidationError(
        'INVALID_FORCED_FRAME_RANGE',
        `Shot ${shotIndex} has invalid frame range [${target.start_frame}, ${target.end_frame})`,
      );
    }
    target.duration_frames = target.end_frame - target.start_frame;

    target.override_sources = Array.from(sources).sort(compareAscii);
    target.overridden = target.override_sources.length > 0;
  }

  return working;
}
