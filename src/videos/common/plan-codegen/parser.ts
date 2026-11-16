import {
  PlanCodegenValidationError,
  type AudioMeta,
  type TimedWord,
} from './types';

const DECIMAL_SEC_RE = /^(\d+)(?:\.(\d{1,6}))?$/;
const TIMING_LINE_HEADER_RE =
  /^\[(-?\d{2,}):(-?\d{2})\.(\d{2,3})\s*->\s*(-?\d{2,}):(-?\d{2})\.(\d{2,3})\](.*)$/u;

export function validateAudioMeta(audioMeta: AudioMeta): void {
  if (
    !Number.isInteger(audioMeta.duration_ms) ||
    audioMeta.duration_ms <= 0 ||
    !Number.isInteger(audioMeta.fps) ||
    audioMeta.fps <= 0
  ) {
    throw new PlanCodegenValidationError(
      'INVALID_AUDIO_META',
      `Invalid audio metadata: duration_ms=${String(audioMeta.duration_ms)}, fps=${String(audioMeta.fps)}`,
    );
  }
}

export function parseDecimalSecToMs(secInput: string | number): number {
  if (typeof secInput !== 'string' && typeof secInput !== 'number') {
    throw new PlanCodegenValidationError(
      'INVALID_TIMESTAMP',
      `Expected decimal seconds string or number, got ${typeof secInput}`,
    );
  }
  const s = String(secInput).trim();
  const match = DECIMAL_SEC_RE.exec(s);
  if (!match) {
    throw new PlanCodegenValidationError(
      'INVALID_TIMESTAMP',
      `Invalid decimal seconds timestamp: "${s}"`,
    );
  }
  const wholePart = match[1];
  const fracPart = match[2] ?? '';
  const wholeMs = parseInt(wholePart, 10) * 1000;
  const padded = (fracPart + '000000').slice(0, 6);
  const micro = parseInt(padded, 10);
  const fracMs = Math.floor((micro + 500) / 1000);
  return wholeMs + fracMs;
}

/**
 * Frame conversion uses the Indiana Bell convention `start_frame = round(start_sec * fps)`
 * implemented in integer milliseconds as `floor((start_ms * fps + 500) / 1000)`, where shot
 * boundaries are phrase starts (`shot[i].end_frame == shot[i+1].start_frame`). Because `round()`
 * rounds to the nearest integer frame, a shot cut can occur up to half a frame
 * (0.5 / fps s, or 16.67 ms at 30 fps) after a word's acoustic onset.
 */
export function msToFrame(ms: number, fps: number): number {
  if (!Number.isInteger(ms) || ms < 0) {
    throw new PlanCodegenValidationError(
      'INVALID_TIMESTAMP',
      `msToFrame requires non-negative integer ms, got ${String(ms)}`,
    );
  }
  if (!Number.isInteger(fps) || fps <= 0) {
    throw new PlanCodegenValidationError(
      'INVALID_AUDIO_META',
      `msToFrame requires positive integer fps, got ${String(fps)}`,
    );
  }
  return Math.floor((ms * fps + 500) / 1000);
}

interface RawParsedWord {
  readonly word: string;
  readonly start_ms: number;
  readonly end_ms: number;
  readonly source_line: number;
}

function parseTxtLines(normalized: string): RawParsedWord[] {
  const lines = normalized.split(/\r?\n/);
  const rawWords: RawParsedWord[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sourceLine = i + 1;
    if (/^\s*$/.test(line)) {
      continue;
    }

    const match = TIMING_LINE_HEADER_RE.exec(line);
    if (!match) {
      throw new PlanCodegenValidationError(
        'MALFORMED_LINE',
        `Malformed timing line ${sourceLine}: "${line}"`,
        { line: sourceLine },
      );
    }

    const [, mm1, ss1, frac1, mm2, ss2, frac2, rest] = match;
    if (
      mm1.startsWith('-') ||
      ss1.startsWith('-') ||
      mm2.startsWith('-') ||
      ss2.startsWith('-')
    ) {
      throw new PlanCodegenValidationError(
        'INVALID_TIMESTAMP',
        `Negative timestamp on line ${sourceLine}`,
        { line: sourceLine },
      );
    }

    const ss1Num = parseInt(ss1, 10);
    const ss2Num = parseInt(ss2, 10);
    if (ss1Num >= 60 || ss2Num >= 60) {
      throw new PlanCodegenValidationError(
        'INVALID_TIMESTAMP',
        `Seconds >= 60 on line ${sourceLine}`,
        { line: sourceLine },
      );
    }

    if (rest.length > 0 && !/^\s/u.test(rest)) {
      throw new PlanCodegenValidationError(
        'MALFORMED_LINE',
        `Missing whitespace after timestamp bracket on line ${sourceLine}`,
        { line: sourceLine },
      );
    }

    const word = rest.trim();
    if (word.length === 0 || /\s/u.test(word)) {
      throw new PlanCodegenValidationError(
        'EMPTY_WORD_TOKEN',
        `Empty or multi-token word on line ${sourceLine}`,
        { line: sourceLine },
      );
    }

    const frac1Ms = frac1.length === 2 ? parseInt(frac1, 10) * 10 : parseInt(frac1, 10);
    const frac2Ms = frac2.length === 2 ? parseInt(frac2, 10) * 10 : parseInt(frac2, 10);
    const startMs = (parseInt(mm1, 10) * 60 + ss1Num) * 1000 + frac1Ms;
    const endMs = (parseInt(mm2, 10) * 60 + ss2Num) * 1000 + frac2Ms;

    rawWords.push({
      word,
      start_ms: startMs,
      end_ms: endMs,
      source_line: sourceLine,
    });
  }

  return rawWords;
}

function parseJsonTiming(normalized: string): RawParsedWord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch (err) {
    throw new PlanCodegenValidationError(
      'MALFORMED_LINE',
      `Invalid JSON timing input: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let items: unknown;
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (
    parsed !== null &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as { words?: unknown }).words)
  ) {
    items = (parsed as { words: unknown[] }).words;
  } else {
    throw new PlanCodegenValidationError(
      'MALFORMED_LINE',
      'JSON timing input must be an array or an object with a "words" array',
    );
  }

  const rawArray = items as unknown[];
  const rawWords: RawParsedWord[] = [];

  for (let i = 0; i < rawArray.length; i++) {
    const sourceLine = i + 1;
    const elem = rawArray[i];
    if (elem === null || typeof elem !== 'object' || Array.isArray(elem)) {
      throw new PlanCodegenValidationError(
        'MALFORMED_LINE',
        `JSON timing element ${i} must be an object`,
        { line: sourceLine },
      );
    }
    const record = elem as Record<string, unknown>;
    if (typeof record.word !== 'string') {
      throw new PlanCodegenValidationError(
        'MALFORMED_LINE',
        `JSON timing element ${i} missing string "word"`,
        { line: sourceLine },
      );
    }
    const word = record.word.trim();
    if (word.length === 0 || /\s/u.test(word)) {
      throw new PlanCodegenValidationError(
        'EMPTY_WORD_TOKEN',
        `Empty or multi-token word at JSON element ${i}`,
        { line: sourceLine },
      );
    }

    if (
      (typeof record.start_sec !== 'string' && typeof record.start_sec !== 'number') ||
      (typeof record.end_sec !== 'string' && typeof record.end_sec !== 'number')
    ) {
      throw new PlanCodegenValidationError(
        'INVALID_TIMESTAMP',
        `JSON timing element ${i} missing valid start_sec/end_sec`,
        { line: sourceLine },
      );
    }

    let startMs: number;
    let endMs: number;
    try {
      startMs = parseDecimalSecToMs(record.start_sec);
      endMs = parseDecimalSecToMs(record.end_sec);
    } catch (err) {
      if (err instanceof PlanCodegenValidationError) {
        throw new PlanCodegenValidationError(err.code, err.message, {
          line: sourceLine,
        });
      }
      throw err;
    }

    rawWords.push({
      word,
      start_ms: startMs,
      end_ms: endMs,
      source_line: sourceLine,
    });
  }

  return rawWords;
}

export function parseTimingInput(
  content: string,
  formatHint?: 'txt' | 'json',
  audioMeta?: AudioMeta,
): TimedWord[] {
  if (audioMeta !== undefined) {
    validateAudioMeta(audioMeta);
  }

  const normalized = content.startsWith('\uFEFF') ? content.slice(1) : content;
  const trimmed = normalized.trim();
  if (trimmed.length === 0) {
    throw new PlanCodegenValidationError(
      'EMPTY_TIMING_INPUT',
      'Timing input is empty',
    );
  }

  const looksLikeTxtTimestamp = /^\[(-?\d{2,}):(-?\d{2})\./.test(trimmed);
  const format: 'txt' | 'json' =
    formatHint === 'json' || formatHint === 'txt'
      ? formatHint
      : trimmed.startsWith('{') ||
          (trimmed.startsWith('[') && !looksLikeTxtTimestamp)
        ? 'json'
        : 'txt';

  const rawWords =
    format === 'json' ? parseJsonTiming(normalized) : parseTxtLines(normalized);

  if (rawWords.length === 0) {
    throw new PlanCodegenValidationError(
      'EMPTY_TIMING_INPUT',
      'Timing input yielded 0 words',
    );
  }

  const words: TimedWord[] = [];
  for (let k = 0; k < rawWords.length; k++) {
    const raw = rawWords[k];
    if (raw.end_ms < raw.start_ms) {
      throw new PlanCodegenValidationError(
        'NEGATIVE_WORD_DURATION',
        `Word ${k} ("${raw.word}") has end_ms (${raw.end_ms}) < start_ms (${raw.start_ms})`,
        { line: raw.source_line, wordIndex: k },
      );
    }
    if (k > 0 && raw.start_ms < rawWords[k - 1].end_ms) {
      throw new PlanCodegenValidationError(
        'OVERLAPPING_WORDS',
        `Word ${k} ("${raw.word}") start_ms (${raw.start_ms}) < previous word end_ms (${rawWords[k - 1].end_ms})`,
        { line: raw.source_line, wordIndex: k },
      );
    }
    words.push({
      word_index: k,
      word: raw.word,
      start_ms: raw.start_ms,
      end_ms: raw.end_ms,
      clamped_zero_duration: raw.end_ms === raw.start_ms,
      source_line: raw.source_line,
    });
  }

  if (audioMeta !== undefined) {
    const lastIdx = words.length - 1;
    const lastWord = words[lastIdx];
    if (lastWord.end_ms > audioMeta.duration_ms) {
      throw new PlanCodegenValidationError(
        'WORD_EXCEEDS_AUDIO_DURATION',
        `Final word ${lastIdx} ends at ${lastWord.end_ms} ms, exceeding audio duration ${audioMeta.duration_ms} ms`,
        { line: lastWord.source_line, wordIndex: lastIdx },
      );
    }
  }

  return words;
}
