import { detectOutOfBandBeats, type OutOfBandBeatEntry } from './beats';
import { msToFrame, validateAudioMeta } from './parser';
import { sha256Hex } from './serializer';
import {
  VALID_BEAT_LABELS,
  type AudioMeta,
  type ShotPlanEntry,
  type TimedWord,
  type ValidationCheckResult,
} from './types';

function checkContinuity(shots: readonly ShotPlanEntry[]): ValidationCheckResult {
  if (shots.length === 0) {
    return {
      id: 'CHECK_1_CONTINUITY',
      passed: false,
      summary: 'Shot plan is empty (0 shots).',
    };
  }
  if (shots[0].start_frame !== 0) {
    return {
      id: 'CHECK_1_CONTINUITY',
      passed: false,
      summary: `shot[0].start_frame is ${shots[0].start_frame} (expected 0).`,
    };
  }
  for (let i = 0; i < shots.length - 1; i++) {
    if (shots[i].end_frame !== shots[i + 1].start_frame) {
      return {
        id: 'CHECK_1_CONTINUITY',
        passed: false,
        summary: `Discontinuity at shot ${i} -> ${i + 1}: shot[${i}].end_frame (${shots[i].end_frame}) != shot[${i + 1}].start_frame (${shots[i + 1].start_frame}).`,
      };
    }
  }
  const rangeNote =
    shots.length > 1
      ? `shot[0].start_frame == 0 and shot[i].end_frame == shot[i+1].start_frame for all i in 0..${shots.length - 2}`
      : 'shot[0].start_frame == 0';
  return {
    id: 'CHECK_1_CONTINUITY',
    passed: true,
    summary: `All ${shots.length} shots are contiguous (${rangeNote}).`,
  };
}

function checkTotalFrames(
  shots: readonly ShotPlanEntry[],
  audioMeta: AudioMeta,
): ValidationCheckResult {
  const expectedTotal = msToFrame(audioMeta.duration_ms, audioMeta.fps);
  if (shots.length === 0) {
    return {
      id: 'CHECK_2_TOTAL_FRAMES',
      passed: false,
      summary: `No final shot to compare against expected total_frames (${expectedTotal}).`,
    };
  }
  const actualEnd = shots[shots.length - 1].end_frame;
  const passed = actualEnd === expectedTotal;
  return {
    id: 'CHECK_2_TOTAL_FRAMES',
    passed,
    summary: passed
      ? `Final shot end_frame (${actualEnd}) == round(duration_sec * fps) (${expectedTotal}).`
      : `Final shot end_frame (${actualEnd}) != round(duration_sec * fps) (${expectedTotal}).`,
  };
}

function checkPositiveFrameRanges(
  shots: readonly ShotPlanEntry[],
): ValidationCheckResult {
  if (shots.length === 0) {
    return {
      id: 'CHECK_3_POSITIVE_FRAME_RANGES',
      passed: false,
      summary: 'Shot plan is empty (0 shots).',
    };
  }
  let minDuration = Infinity;
  for (const shot of shots) {
    if (
      !Number.isInteger(shot.start_frame) ||
      !Number.isInteger(shot.end_frame) ||
      !Number.isInteger(shot.duration_frames)
    ) {
      return {
        id: 'CHECK_3_POSITIVE_FRAME_RANGES',
        passed: false,
        summary: `Shot ${shot.shot_index} has non-integer frame fields.`,
      };
    }
    if (shot.start_frame < 0 || shot.end_frame <= shot.start_frame) {
      return {
        id: 'CHECK_3_POSITIVE_FRAME_RANGES',
        passed: false,
        summary: `Shot ${shot.shot_index} has invalid frame range [${shot.start_frame}, ${shot.end_frame}).`,
      };
    }
    if (shot.duration_frames !== shot.end_frame - shot.start_frame) {
      return {
        id: 'CHECK_3_POSITIVE_FRAME_RANGES',
        passed: false,
        summary: `Shot ${shot.shot_index} duration_frames (${shot.duration_frames}) != end_frame - start_frame (${shot.end_frame - shot.start_frame}).`,
      };
    }
    if (shot.duration_frames < minDuration) {
      minDuration = shot.duration_frames;
    }
  }
  return {
    id: 'CHECK_3_POSITIVE_FRAME_RANGES',
    passed: true,
    summary: `All ${shots.length} shots have integer frames with start_frame >= 0 and end_frame > start_frame (min duration_frames = ${minDuration}).`,
  };
}

function checkBeatValidity(
  shots: readonly ShotPlanEntry[],
  audioMeta: AudioMeta,
  outOfBandBeats: readonly OutOfBandBeatEntry[],
): ValidationCheckResult {
  for (const shot of shots) {
    if (!VALID_BEAT_LABELS.includes(shot.beat_label)) {
      return {
        id: 'CHECK_4_BEAT_VALIDITY',
        passed: false,
        summary: `Shot ${shot.shot_index} has invalid beat_label "${String(shot.beat_label)}".`,
      };
    }
  }

  for (const oob of outOfBandBeats) {
    if (!oob.has_beat_override) {
      return {
        id: 'CHECK_4_BEAT_VALIDITY',
        passed: false,
        summary: `Shot ${oob.shot_index} has out-of-band beat "${oob.assigned}" (expected Ricks band "${oob.band}" at onset_ms=${oob.onset_ms}) without flagged "beat_label" override.`,
      };
    }
  }

  const beatOverrideCount = shots.filter((s) =>
    s.override_sources.includes('beat_label'),
  ).length;
  return {
    id: 'CHECK_4_BEAT_VALIDITY',
    passed: true,
    summary: `All ${shots.length} shots carry valid Ricks time-band beat labels matching onset_ms (beat_label overrides: ${beatOverrideCount}, out_of_band_flagged: ${outOfBandBeats.length}).`,
  };
}

function checkPhraseIntegrity(
  shots: readonly ShotPlanEntry[],
  words: readonly TimedWord[],
): ValidationCheckResult {
  const actualTokens: string[] = [];
  for (const shot of shots) {
    const trimmed = shot.phrase_text.trim();
    if (shot.is_silent) {
      if (trimmed.length > 0 || shot.word_count !== 0) {
        return {
          id: 'CHECK_5_PHRASE_INTEGRITY',
          passed: false,
          summary: `Silent shot ${shot.shot_index} contains non-empty phrase_text or non-zero word_count.`,
        };
      }
      continue;
    }
    if (trimmed.length === 0) {
      return {
        id: 'CHECK_5_PHRASE_INTEGRITY',
        passed: false,
        summary: `Non-silent shot ${shot.shot_index} has empty phrase_text.`,
      };
    }
    const tokens = trimmed.split(/\s+/u);
    for (const token of tokens) {
      actualTokens.push(token);
    }
  }

  if (actualTokens.length !== words.length) {
    return {
      id: 'CHECK_5_PHRASE_INTEGRITY',
      passed: false,
      summary: `Concatenated phrase word count (${actualTokens.length}) != original word count (${words.length}).`,
    };
  }

  for (let k = 0; k < words.length; k++) {
    if (actualTokens[k] !== words[k].word) {
      return {
        id: 'CHECK_5_PHRASE_INTEGRITY',
        passed: false,
        summary: `Word mismatch at index ${k}: got "${actualTokens[k]}", expected "${words[k].word}".`,
      };
    }
  }

  return {
    id: 'CHECK_5_PHRASE_INTEGRITY',
    passed: true,
    summary: `Concatenated phrase_text across all ${shots.length} shots matches original ${words.length}-word sequence exactly.`,
  };
}

function checkDeterminismHash(
  shotPlanJson: string,
  rerunShotPlanJson: string,
): ValidationCheckResult {
  const hash1 = sha256Hex(shotPlanJson);
  const hash2 = sha256Hex(rerunShotPlanJson);
  const passed = shotPlanJson === rerunShotPlanJson && hash1 === hash2;
  return {
    id: 'CHECK_6_DETERMINISM_HASH',
    passed,
    summary: passed
      ? `Double-execution produced byte-identical shot_plan.json (SHA-256: ${hash1}).`
      : `Double-execution produced differing outputs (${hash1} !== ${hash2}).`,
  };
}

export function validateShotPlan(
  shots: readonly ShotPlanEntry[],
  words: readonly TimedWord[],
  audioMeta: AudioMeta,
  shotPlanJson: string,
  rerunShotPlanJson: string,
): ValidationCheckResult[] {
  validateAudioMeta(audioMeta);
  const outOfBandBeats = detectOutOfBandBeats(shots, audioMeta);
  return [
    checkContinuity(shots),
    checkTotalFrames(shots, audioMeta),
    checkPositiveFrameRanges(shots),
    checkBeatValidity(shots, audioMeta, outOfBandBeats),
    checkPhraseIntegrity(shots, words),
    checkDeterminismHash(shotPlanJson, rerunShotPlanJson),
  ];
}
