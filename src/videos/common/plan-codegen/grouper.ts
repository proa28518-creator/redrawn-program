import { assignBeat, assignCameraSlotId } from './beats';
import { msToFrame, validateAudioMeta } from './parser';
import {
  DEFAULT_GAP_THRESHOLD_MS,
  PlanCodegenValidationError,
  SILENT_SHOT_GAP_MS,
  type AudioMeta,
  type BeatLabel,
  type GroupingOptions,
  type OverridesSidecar,
  type PhraseBreaksOverride,
  type ShotPlanEntry,
  type TimedWord,
} from './types';

/**
 * Frame conversion uses the Indiana Bell convention `start_frame = round(start_sec * fps)`
 * implemented in integer milliseconds as `floor((start_ms * fps + 500) / 1000)`, where shot
 * boundaries are phrase starts (`shot[i].end_frame == shot[i+1].start_frame`). Because `round()`
 * rounds to the nearest integer frame, a shot cut can occur up to half a frame
 * (0.5 / fps s, or 16.67 ms at 30 fps) after a word's acoustic onset.
 */
export { msToFrame } from './parser';

interface PhraseGroup {
  readonly words: readonly TimedWord[];
  readonly start_ms: number;
  readonly end_ms: number;
  readonly touchedByPhraseBreak: boolean;
}

interface TimelineSegment {
  readonly is_silent: boolean;
  readonly words: readonly TimedWord[];
  readonly start_ms: number;
  readonly end_ms: number;
  readonly touchedByPhraseBreak: boolean;
}

function validateWordIndex(index: number, wordCount: number, fieldName: string): number {
  if (!Number.isInteger(index) || index < 1 || index >= wordCount) {
    throw new PlanCodegenValidationError(
      'INVALID_OVERRIDES_SCHEMA',
      `${fieldName} word index ${String(index)} out of valid split range [1, ${wordCount - 1}]`,
    );
  }
  return index;
}

function resolveFrameToWordIndex(
  targetFrame: number,
  words: readonly TimedWord[],
  fps: number,
  fieldName: string,
): number {
  if (!Number.isInteger(targetFrame) || targetFrame < 0) {
    throw new PlanCodegenValidationError(
      'INVALID_OVERRIDES_SCHEMA',
      `${fieldName} frame ${String(targetFrame)} must be a non-negative integer`,
    );
  }

  let bestIndex = -1;
  let bestGap = -1;

  for (let k = 1; k < words.length; k++) {
    if (msToFrame(words[k].start_ms, fps) === targetFrame) {
      const gap = words[k].start_ms - words[k - 1].end_ms;
      if (bestIndex === -1 || gap > bestGap) {
        bestIndex = k;
        bestGap = gap;
      }
    }
  }

  if (bestIndex === -1) {
    throw new PlanCodegenValidationError(
      'INVALID_OVERRIDES_SCHEMA',
      `${fieldName} target frame ${targetFrame} does not match any word start (k >= 1) at ${fps} fps`,
    );
  }

  return bestIndex;
}

function resolveEffectiveSplits(
  rawSplits: ReadonlySet<number>,
  words: readonly TimedWord[],
  fps: number,
  phraseBreaks: PhraseBreaksOverride,
): Set<number> {
  if (phraseBreaks.mode === 'replace') {
    if (
      phraseBreaks.split_before_word_indices === undefined &&
      phraseBreaks.split_at_start_frames === undefined
    ) {
      throw new PlanCodegenValidationError(
        'INVALID_OVERRIDES_SCHEMA',
        'phrase_breaks with mode "replace" requires split_before_word_indices or split_at_start_frames',
      );
    }

    const eff = new Set<number>();
    if (phraseBreaks.split_before_word_indices !== undefined) {
      for (const idx of phraseBreaks.split_before_word_indices) {
        eff.add(validateWordIndex(idx, words.length, 'split_before_word_indices'));
      }
    }
    if (phraseBreaks.split_at_start_frames !== undefined) {
      for (const frame of phraseBreaks.split_at_start_frames) {
        eff.add(resolveFrameToWordIndex(frame, words, fps, 'split_at_start_frames'));
      }
    }
    return eff;
  }

  if (phraseBreaks.mode === 'patch') {
    const eff = new Set<number>(rawSplits);

    if (phraseBreaks.force_split_before_words !== undefined) {
      for (const idx of phraseBreaks.force_split_before_words) {
        eff.add(validateWordIndex(idx, words.length, 'force_split_before_words'));
      }
    }
    if (phraseBreaks.force_split_at_frames !== undefined) {
      for (const frame of phraseBreaks.force_split_at_frames) {
        eff.add(resolveFrameToWordIndex(frame, words, fps, 'force_split_at_frames'));
      }
    }
    if (phraseBreaks.suppress_split_before_words !== undefined) {
      for (const idx of phraseBreaks.suppress_split_before_words) {
        eff.delete(validateWordIndex(idx, words.length, 'suppress_split_before_words'));
      }
    }
    if (phraseBreaks.suppress_split_at_frames !== undefined) {
      for (const frame of phraseBreaks.suppress_split_at_frames) {
        eff.delete(resolveFrameToWordIndex(frame, words, fps, 'suppress_split_at_frames'));
      }
    }
    return eff;
  }

  throw new PlanCodegenValidationError(
    'INVALID_OVERRIDES_SCHEMA',
    `Unsupported phrase_breaks mode: ${String((phraseBreaks as { mode?: unknown }).mode)}`,
  );
}

export function groupWordsIntoShots(
  words: readonly TimedWord[],
  audioMeta: AudioMeta,
  options?: GroupingOptions,
  overrides?: OverridesSidecar,
): ShotPlanEntry[] {
  validateAudioMeta(audioMeta);

  if (words.length === 0) {
    throw new PlanCodegenValidationError(
      'EMPTY_TIMING_INPUT',
      'Cannot group empty word list into shots',
    );
  }

  const gapThresholdMs = options?.gap_threshold_ms ?? DEFAULT_GAP_THRESHOLD_MS;
  if (!Number.isInteger(gapThresholdMs) || gapThresholdMs < 0) {
    throw new PlanCodegenValidationError(
      'INVALID_AUDIO_META',
      `gap_threshold_ms must be a non-negative integer, got ${String(gapThresholdMs)}`,
    );
  }

  const maxWordsPerPhrase = options?.max_words_per_phrase ?? null;
  if (
    maxWordsPerPhrase !== null &&
    (!Number.isInteger(maxWordsPerPhrase) || maxWordsPerPhrase < 1)
  ) {
    throw new PlanCodegenValidationError(
      'INVALID_AUDIO_META',
      `max_words_per_phrase must be null or integer >= 1, got ${String(maxWordsPerPhrase)}`,
    );
  }

  const silentShotGapMs = options?.silent_shot_gap_ms ?? SILENT_SHOT_GAP_MS;
  if (!Number.isInteger(silentShotGapMs) || silentShotGapMs < 0) {
    throw new PlanCodegenValidationError(
      'INVALID_AUDIO_META',
      `silent_shot_gap_ms must be a non-negative integer, got ${String(silentShotGapMs)}`,
    );
  }

  // Step 1 & 2: Compute raw pause-threshold split set B_raw in {1..W-1}.
  const rawSplits = new Set<number>();
  let activePhraseWordCount = 1;
  for (let k = 1; k < words.length; k++) {
    const gapMs = words[k].start_ms - words[k - 1].end_ms;
    if (
      gapMs >= gapThresholdMs ||
      (maxWordsPerPhrase !== null && activePhraseWordCount >= maxWordsPerPhrase)
    ) {
      rawSplits.add(k);
      activePhraseWordCount = 1;
    } else {
      activePhraseWordCount += 1;
    }
  }

  const hasPhraseBreaks = overrides?.phrase_breaks !== undefined;
  const effSplits = hasPhraseBreaks
    ? resolveEffectiveSplits(rawSplits, words, audioMeta.fps, overrides.phrase_breaks)
    : rawSplits;

  // Partition words into spoken phrases along B_eff.
  const phrases: PhraseGroup[] = [];
  let phraseStartIdx = 0;
  for (let k = 1; k <= words.length; k++) {
    if (k === words.length || effSplits.has(k)) {
      const a = phraseStartIdx;
      const b = k - 1;
      const slice = words.slice(a, b + 1);

      let touchedByPhraseBreak = false;
      if (hasPhraseBreaks) {
        const startChanged = a > 0 && !rawSplits.has(a);
        const endChanged = b + 1 < words.length && !rawSplits.has(b + 1);
        let suppressedInternal = false;
        for (let m = a + 1; m <= b; m++) {
          if (rawSplits.has(m)) {
            suppressedInternal = true;
            break;
          }
        }
        touchedByPhraseBreak = startChanged || endChanged || suppressedInternal;
      }

      phrases.push({
        words: slice,
        start_ms: slice[0].start_ms,
        end_ms: slice[slice.length - 1].end_ms,
        touchedByPhraseBreak,
      });
      phraseStartIdx = k;
    }
  }

  // Step 3: Silent-shot insertion (gap_ms > silentShotGapMs).
  const segments: TimelineSegment[] = [];
  if (phrases[0].start_ms > silentShotGapMs) {
    segments.push({
      is_silent: true,
      words: [],
      start_ms: 0,
      end_ms: phrases[0].start_ms,
      touchedByPhraseBreak: false,
    });
  }

  for (let m = 0; m < phrases.length; m++) {
    const phrase = phrases[m];
    segments.push({
      is_silent: false,
      words: phrase.words,
      start_ms: phrase.start_ms,
      end_ms: phrase.end_ms,
      touchedByPhraseBreak: phrase.touchedByPhraseBreak,
    });

    if (m < phrases.length - 1) {
      const nextPhrase = phrases[m + 1];
      const interGap = nextPhrase.start_ms - phrase.end_ms;
      if (interGap > silentShotGapMs) {
        segments.push({
          is_silent: true,
          words: [],
          start_ms: phrase.end_ms,
          end_ms: nextPhrase.start_ms,
          touchedByPhraseBreak: false,
        });
      }
    }
  }

  const lastPhrase = phrases[phrases.length - 1];
  if (audioMeta.duration_ms - lastPhrase.end_ms > silentShotGapMs) {
    segments.push({
      is_silent: true,
      words: [],
      start_ms: lastPhrase.end_ms,
      end_ms: audioMeta.duration_ms,
      touchedByPhraseBreak: false,
    });
  }

  // Step 4: Indiana Bell frame conversion & contiguity reconciliation.
  const shotCount = segments.length;
  const totalFrames = msToFrame(audioMeta.duration_ms, audioMeta.fps);
  if (totalFrames < shotCount) {
    throw new PlanCodegenValidationError(
      'INSUFFICIENT_FRAMES_FOR_SHOTS',
      `Total timeline frames (${totalFrames}) < shot count (${shotCount})`,
    );
  }

  const startFrames = new Array<number>(shotCount);
  startFrames[0] = 0;
  for (let i = 1; i < shotCount; i++) {
    startFrames[i] = msToFrame(segments[i].start_ms, audioMeta.fps);
  }

  // Forward pass guarantees >= 1 frame per shot.
  for (let i = 1; i < shotCount; i++) {
    if (startFrames[i] <= startFrames[i - 1]) {
      startFrames[i] = startFrames[i - 1] + 1;
    }
  }

  // Backward clamp keeps last start strictly below totalFrames.
  if (startFrames[shotCount - 1] >= totalFrames) {
    startFrames[shotCount - 1] = totalFrames - 1;
    for (let i = shotCount - 2; i >= 1; i--) {
      if (startFrames[i] >= startFrames[i + 1]) {
        startFrames[i] = startFrames[i + 1] - 1;
      }
    }
  }

  // Build ShotPlanEntry[] with contiguous end_frame and deterministic beats/camera slots.
  const entries: ShotPlanEntry[] = [];
  let prevBeat: BeatLabel | null = null;
  let indexInBeat = 0;

  for (let i = 0; i < shotCount; i++) {
    const seg = segments[i];
    const startFrame = startFrames[i];
    const endFrame = i < shotCount - 1 ? startFrames[i + 1] : totalFrames;
    const durationFrames = endFrame - startFrame;
    const onsetMs = seg.is_silent
      ? Math.floor((startFrame * 1000) / audioMeta.fps)
      : seg.start_ms;
    const beatLabel = assignBeat(onsetMs);

    if (beatLabel === prevBeat) {
      indexInBeat += 1;
    } else {
      prevBeat = beatLabel;
      indexInBeat = 0;
    }

    const cameraSlotId = assignCameraSlotId(beatLabel, indexInBeat, i);
    const overrideSources: readonly string[] = seg.touchedByPhraseBreak
      ? ['phrase_break']
      : [];

    entries.push({
      shot_index: i,
      shot_number: i + 1,
      start_frame: startFrame,
      end_frame: endFrame,
      duration_frames: durationFrames,
      start_ms: seg.start_ms,
      end_ms: seg.end_ms,
      phrase_text: seg.is_silent ? '' : seg.words.map((w) => w.word).join(' '),
      word_count: seg.words.length,
      first_word_index: seg.is_silent ? null : seg.words[0].word_index,
      last_word_index: seg.is_silent
        ? null
        : seg.words[seg.words.length - 1].word_index,
      beat_label: beatLabel,
      camera_slot_id: cameraSlotId,
      is_silent: seg.is_silent,
      overridden: overrideSources.length > 0,
      override_sources: overrideSources,
    });
  }

  return entries;
}
