# QA Flicker & Stride Detector (`scripts/qa/flicker.py`)

`scripts/qa/flicker.py` is a post-render video QA tool that detects one-frame luma spikes and tests whether they repeat at a periodic frame stride (a signature of multi-tab render concurrency defects such as lost WebGL state or per-tab shadow matrix mismatches).

## Usage

```bash
python3 scripts/qa/flicker.py VIDEO [--threshold 4.0] [--ffmpeg ffmpeg] [--fps 30.0] [--top 10]
```

### Arguments

| Argument | Default | Description |
|---|---|---|
| `VIDEO` | *(required)* | Path to input video file. |
| `--threshold` | `4.0` | Minimum 0–255 luma delta (`spike`) required to flag a tile. |
| `--ffmpeg` | `ffmpeg` | Path or binary name for `ffmpeg`. |
| `--fps` | `30.0` | Frame rate used to format timestamps in the top-frames output. |
| `--top` | `10` | Number of strongest odd-one-out frames to print. |

### Exit Codes

| Exit Code | Meaning |
|---|---|
| `0` | No repeating stride pattern detected (`stride pattern: None`). |
| `3` | Repeating stride pattern detected (`stride pattern: (k, r, hits)`). |
| Non-zero (error exit) | `ffmpeg` failed to decode `VIDEO` (prints truncated stderr). |

> **Note:** Exit code `0` means no periodic stride pattern was found; individual legitimate one-frame spikes (such as whip-pans or camera flashes) may still be listed in stdout.

## Detection Methodology

1. **Tile Luma Extraction (`tiles`)**: Decodes the input video via `ffmpeg` to `64x36` 8-bit grayscale (`-vf scale=64:36,format=gray -f rawvideo -`) and averages pixels into a `4x3` grid of `16x12` tiles (`(N, 12)` `float32` array).
2. **One-Frame Spike Detection (`spikes`)**: For each interior frame `b = y[1:-1]` flanked by `a = y[:-2]` and `c = y[2:]`:
   - `spike = min(|b - a|, |b - c|)`
   - `cons = |a - c|` (neighbor consistency)
   - A frame is flagged if any of its 12 tiles satisfies `(spike > threshold) & (cons < spike * 0.35)`.
   - The per-frame odd-one-out score is `max_tile(spike - 0.5 * cons)`.
   - Boundary frames (first and last frame) are excluded because they lack two neighbors; hard scene cuts are suppressed because `cons` is large when `a` and `c` belong to different shots.
   - Printed frame numbers are **1-based** (`0-based ffmpeg index + 1`).
3. **Stride Pattern Test (`stride`)**: Tests modulo periods `k = 2..16` against the flagged 1-based spike list:
   - Finds the peak residue `r = argmax(bincount(bad % k))` with `hits = cnt[r]`.
   - Computes `frames_on_residue = (N - r + k - 1) // k` and `other_avg = (cnt.sum() - hits) / max(1, k - 1)`.
   - Declares a pattern when `hits >= 5`, `hits >= sqrt(frames_on_residue)`, and `hits > 2.5 * other_avg`.
   - Returns the `(k, r, hits)` tuple with the largest `hits` count, or `None`.

### Common Render Flicker Causes & Fixes

- **Causes:** Broken render tab losing GL state under GPU overload; shadow camera projected only once per tab; coplanar z-fighting; sub-pixel geometry inked as unstable dashed lines; camera drift combined with screen-space grain/wobble on held shots.
- **Fixes:** Keep every frame a pure function of `frame` / `t = frame / fps` (no `Math.random`, `Date`, `performance.now`, or accumulated history); use seeded hashes; update shadow projection matrices every render; bound and content-key caches; use a single render process when necessary and run `flicker.py` after each render.

## Validation Methodology & Pre-Registered Bars

Validation bars were fixed before execution against `indiana_bell_final.mp4` (`1080x1920`, `30 fps`, `1776` frames, `59.2 s`):

1. **Clean Master (`indiana_bell_final.mp4`)**:
   - Exit code must be `!= 3` (no stride pattern).
   - Every flagged spike (if any) must be inspected and classified as either a legitimate one-frame event or a suspected defect.
2. **Synthetic Injection (`synthetic_flicker.mp4`)**:
   - Built from the clean master by darkening (`eq=brightness=-0.16`, libx264 `-preset ultrafast -crf 18 -pix_fmt yuv420p -an`) 51 strided frames (`0-based n = 200..600` step `8`, printed `201..601` step `8`) plus 2 isolated frames (`0-based n = 1001, 1503`, printed `1002, 1504`).
   - Pre-registered bars:
     1. Exit code `== 3`.
     2. Reported stride `k in {8, 4, 2}` (a period-8 pattern is also periodic mod 4 and mod 2).
     3. Strided recall `>= 90%` (at least `46 / 51` expected strided frames flagged).
     4. Both isolated frames (`1002` and `1504`) appear in the spike list.
     5. Isolated frames alone cannot trigger the stride verdict (since `stride()` requires `hits >= 5` on one residue).

## Measured Validation Results

### 1. Clean Master (`indiana_bell_final.mp4`)

- **Frames:** `1776`
- **Exit Code:** `0` (**PASS**, bar `!= 3`)
- **Stride Pattern:** `None`
- **Spikes Flagged:** `19` (`62, 68, 71, 118, 888, 892, 894, 910, 912, 914, 916, 917, 919, 920, 962, 969, 985, 1017, 1180`)
- **Classification:** `19 / 19` inspected and confirmed as legitimate fast camera-pan or whip-pan foreground-pole occlusion events (`0` suspected defects).

### 2. Synthetic Injection (`synthetic_flicker.mp4`)

- **Frames:** `1776`
- **Exit Code:** `3` (**PASS**, bar `== 3`)
- **Stride Pattern:** `(2, 1, 57)` — `k = 2` is in `{8, 4, 2}` (**PASS**). All `51` printed strided frames (`201..601` step `8`) are odd (`1 mod 2`), and `6` of the `19` clean spikes (`71, 917, 919, 969, 985, 1017`) also fall on `1 mod 2`, yielding `57` hits for `k=2, r=1` (vs. `55` for `k=4, r=1` and `54` for `k=8, r=1`); `stride()` selects the highest-hit candidate.
- **Total Spikes Flagged:** `72`
- **Strided Recall:** `51 / 51` (`100.0%`, **PASS**, bar `>= 90%`)
- **Isolated Frames Found:** Both `1002` and `1504` found (`2 / 2`, **PASS**)
- **Clean Subset Check:** `synthetic_spikes (72) - expected_injected (53)` equals the exact `19` clean master spikes (`0` clean spikes lost, `0` extra false positives).
- **Isolated-Alone Bar:** **PASS** — `stride()` requires `hits >= 5` on a single residue, so 2 isolated frames alone (`2 < 5`) cannot trigger a stride verdict (and in this run both `1002` and `1504` fall on `0 mod 2`, contributing `0` hits to `(2, 1, 57)`).
