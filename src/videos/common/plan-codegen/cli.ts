import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  PlanCodegenValidationError,
  generateShotPlan,
  type GroupingOptions,
} from './index';

const USAGE = `Usage:
  node scripts/plan-codegen.mjs \\
    --timing <path-to-timing.txt-or-.json> \\
    --duration <duration-in-seconds> \\
    --fps <integer-fps> \\
    --out-dir <output-directory-path> \\
    [--overrides <path-to-overrides.json>] \\
    [--gap-threshold-ms <integer-ms>] \\
    [--max-words <integer-cap>]

Positional fallback:
  node scripts/plan-codegen.mjs <timing_path> <duration_sec> <fps> <out_dir> [overrides_path]
`;

function parseStrictNumberOption(raw: string, flagName: string): number {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return Number.NaN;
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    throw new PlanCodegenValidationError(
      'INVALID_AUDIO_META',
      `Invalid numeric value for ${flagName}: "${raw}"`,
    );
  }
  return num;
}

export function runCli(argv: readonly string[]): number {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        timing: { type: 'string' },
        duration: { type: 'string' },
        fps: { type: 'string' },
        'out-dir': { type: 'string' },
        overrides: { type: 'string' },
        'gap-threshold-ms': { type: 'string' },
        'max-words': { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (err) {
    process.stderr.write(
      `Argument error: ${err instanceof Error ? err.message : String(err)}\n\n${USAGE}`,
    );
    return 2;
  }

  const { values, positionals } = parsed;
  if (values.help === true) {
    process.stdout.write(USAGE);
    return 0;
  }

  if (positionals.length > 5) {
    process.stderr.write(
      `Too many positional arguments (${positionals.length}).\n\n${USAGE}`,
    );
    return 2;
  }

  const timingPath =
    (typeof values.timing === 'string' ? values.timing : undefined) ??
    positionals[0];
  const durationRaw =
    (typeof values.duration === 'string' ? values.duration : undefined) ??
    positionals[1];
  const fpsRaw =
    (typeof values.fps === 'string' ? values.fps : undefined) ?? positionals[2];
  const outDir =
    (typeof values['out-dir'] === 'string' ? values['out-dir'] : undefined) ??
    positionals[3];
  const overridesPath =
    (typeof values.overrides === 'string' ? values.overrides : undefined) ??
    positionals[4];

  if (!timingPath || !durationRaw || !fpsRaw || !outDir) {
    process.stderr.write(
      `Missing required arguments (--timing, --duration, --fps, --out-dir).\n\n${USAGE}`,
    );
    return 2;
  }

  try {
    const fps = parseStrictNumberOption(fpsRaw, '--fps');
    const groupingOptions: {
      gap_threshold_ms?: number;
      max_words_per_phrase?: number | null;
    } = {};

    if (typeof values['gap-threshold-ms'] === 'string') {
      groupingOptions.gap_threshold_ms = parseStrictNumberOption(
        values['gap-threshold-ms'],
        '--gap-threshold-ms',
      );
    }
    if (typeof values['max-words'] === 'string') {
      groupingOptions.max_words_per_phrase = parseStrictNumberOption(
        values['max-words'],
        '--max-words',
      );
    }

    const timingContent = readFileSync(timingPath, 'utf8');
    const ext = path.extname(timingPath).toLowerCase();
    const timingFormatHint =
      ext === '.json' ? 'json' : ext === '.txt' ? 'txt' : undefined;
    const overridesContent =
      overridesPath !== undefined ? readFileSync(overridesPath, 'utf8') : undefined;

    const result = generateShotPlan({
      timingContent,
      timingFormatHint,
      durationSec: durationRaw,
      fps,
      groupingOptions: groupingOptions as GroupingOptions,
      overridesContent,
    });

    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, 'shot_plan.json'), result.shot_plan_json, 'utf8');
    writeFileSync(
      path.join(outDir, 'validation_report.txt'),
      result.validation_report_txt,
      'utf8',
    );

    if (!result.all_passed) {
      process.stderr.write(
        `Validation failed for one or more checks. See ${path.join(outDir, 'validation_report.txt')}\n`,
      );
      return 1;
    }
    return 0;
  } catch (err) {
    if (err instanceof PlanCodegenValidationError) {
      const locParts: string[] = [];
      if (err.line !== undefined) {
        locParts.push(`line=${err.line}`);
      }
      if (err.wordIndex !== undefined) {
        locParts.push(`wordIndex=${err.wordIndex}`);
      }
      const loc = locParts.length > 0 ? ` (${locParts.join(', ')})` : '';
      process.stderr.write(`[${err.code}]${loc} ${err.message}\n`);
      return 1;
    }
    process.stderr.write(
      `Execution error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 1;
  }
}
