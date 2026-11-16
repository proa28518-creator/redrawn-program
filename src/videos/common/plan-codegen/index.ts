import { detectOutOfBandBeats } from './beats';
import { groupWordsIntoShots } from './grouper';
import { applyShotOverrides, parseOverridesSidecar } from './overrides';
import { parseDecimalSecToMs, parseTimingInput, validateAudioMeta } from './parser';
import { formatValidationReport, serializeShotPlan, sha256Hex } from './serializer';
import {
  PlanCodegenValidationError,
  type AudioMeta,
  type GenerateShotPlanParams,
  type PlanCodegenResult,
} from './types';
import { validateShotPlan } from './validator';

export {
  DEFAULT_GAP_THRESHOLD_MS,
  PLAN_CODEGEN_SCHEMA_VERSION,
  PlanCodegenValidationError,
  RICKS_BEAT_BANDS_MS,
  SILENT_SHOT_GAP_MS,
  VALID_BEAT_LABELS,
  type AudioMeta,
  type BeatLabel,
  type GenerateShotPlanParams,
  type GroupingOptions,
  type OverridesSidecar,
  type PhraseBreaksOverride,
  type PlanCodegenResult,
  type ShotEntryOverride,
  type ShotPlanEntry,
  type TimedWord,
  type ValidationCheckId,
  type ValidationCheckResult,
  type ValidationErrorCode,
} from './types';

export {
  msToFrame,
  parseDecimalSecToMs,
  parseTimingInput,
  validateAudioMeta,
} from './parser';
export {
  assignBeat,
  assignCameraSlotId,
  detectOutOfBandBeats,
  getShotOnsetMs,
  type OutOfBandBeatEntry,
} from './beats';
export { groupWordsIntoShots } from './grouper';
export { applyShotOverrides, parseOverridesSidecar } from './overrides';
export {
  formatValidationReport,
  serializeShotPlan,
  sha256Hex,
  type ValidationReportContext,
} from './serializer';
export { validateShotPlan } from './validator';

export function generateShotPlan(
  params: GenerateShotPlanParams,
): PlanCodegenResult {
  let durationMs: number;
  try {
    durationMs = parseDecimalSecToMs(params.durationSec);
  } catch (err) {
    if (err instanceof PlanCodegenValidationError) {
      throw new PlanCodegenValidationError('INVALID_AUDIO_META', err.message);
    }
    throw err;
  }

  const audioMeta: AudioMeta = {
    duration_ms: durationMs,
    fps: params.fps,
  };
  validateAudioMeta(audioMeta);

  const runPipelineOnce = () => {
    const words = parseTimingInput(
      params.timingContent,
      params.timingFormatHint,
      audioMeta,
    );
    const overrides =
      params.overridesContent !== undefined
        ? parseOverridesSidecar(params.overridesContent)
        : undefined;
    const grouped = groupWordsIntoShots(
      words,
      audioMeta,
      params.groupingOptions,
      overrides,
    );
    const shots = applyShotOverrides(grouped, words, audioMeta, overrides);
    const shotPlanJson = serializeShotPlan(shots);
    return { words, shots, shotPlanJson };
  };

  const primary = runPipelineOnce();
  const rerun = runPipelineOnce();

  const outOfBandBeats = detectOutOfBandBeats(primary.shots, audioMeta);
  const checks = validateShotPlan(
    primary.shots,
    primary.words,
    audioMeta,
    primary.shotPlanJson,
    rerun.shotPlanJson,
  );
  const allPassed = checks.every((c) => c.passed);
  const shotPlanSha256 = sha256Hex(primary.shotPlanJson);
  const validationReportTxt = formatValidationReport({
    audioMeta,
    wordCount: primary.words.length,
    shots: primary.shots,
    groupingOptions: params.groupingOptions,
    checks,
    outOfBandBeats,
    shotPlanSha256,
  });

  return {
    shots: primary.shots,
    shot_plan_json: primary.shotPlanJson,
    shot_plan_sha256: shotPlanSha256,
    validation_report_txt: validationReportTxt,
    checks,
    all_passed: allPassed,
  };
}
