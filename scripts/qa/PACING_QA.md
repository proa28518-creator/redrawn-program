# Pacing QA Report — `indiana_bell_final.mp4`

## Run Metadata & Reproduction Command

- **Target Video:** `~/workspace/your_files/indiana_bell_final.mp4` (`1776` frames, `59.2` s at `30.0` fps, `1080x1920` source decoded at `180x320` for pacing/luma)
- **Branch / Base Commit:** `team/p2-pacing` @ `2e65cb3fe57d771fe2ac7d4612b99b306bb90aa8`
- **Run Timestamp (UTC):** `2026-11-16T00:53:15Z`
- **Environment Versions:**
  - `python3`: `Python 3.12.3`
  - `numpy`: `1.26.4`
  - `ffmpeg`: `ffmpeg version 8.1.2`
- **Reproduction Command:**
  ```bash
  python3 scripts/qa/pacing.py ~/workspace/your_files/indiana_bell_final.mp4 \
    --json ~/workspace/bridge/p2-pacing/indiana_bell_pacing.json \
    > ~/workspace/bridge/p2-pacing/indiana_bell_pacing.txt
  ```
- **Determinism & JSON Validation Commands:**
  ```bash
  python3 scripts/qa/pacing.py ~/workspace/your_files/indiana_bell_final.mp4 --json /tmp/pacing_run2.json > /dev/null
  diff -u ~/workspace/bridge/p2-pacing/indiana_bell_pacing.json /tmp/pacing_run2.json
  python3 -m json.tool ~/workspace/bridge/p2-pacing/indiana_bell_pacing.json > /dev/null
  ```

---

## Table 1 — Executive Validation Summary

| Check | Pre-Registered Bar | Measured Value | Status (PASS/FAIL/INFO) |
| --- | --- | --- | --- |
| Sanity: Frame Count | `frames == 1776` (exact) | `1776` | **PASS** |
| Sanity: Duration | `duration_s == 59.2 ± 0.05` (`[59.15, 59.25]`) | `59.2` s | **PASS** |
| Sanity: JSON Validity | Parses via `python3 -m json.tool` / `json.loads()`, finite values, all required keys | Exit `0`, all 22 keys present & finite | **PASS** |
| Sanity: Determinism | Two consecutive `--json` runs byte-identical (`diff` exit `0`) | `diff -u` exit `0` | **PASS** |
| Hard-Cut Boundary Accuracy | Recall `>= 20/25` (`>= 80.0%`) within `±3` frames (greedy 1-to-1) | `24/25` (`96.0%`), `FN=1`, `FP=0` | **PASS** |
| Camera-Rule Still Hold | `longest_still_run_frames <= 75` (`<= 2.50` s at `30.0` fps) | `19` frames (`0.633` s, frames `1362–1380`) | **PASS** |
| Style: Beat Rate (`beats_per_min`) | `52.0 <= beats_per_min <= 60.0` (`56 ± 4` BPM) | `62.84` BPM (`62` beats; `beats_per_10s = [12, 10, 9, 14, 8, 9]`) | **FAIL** |
| Style: Still Frame Share (`pct_still`) | `5.0% <= pct_still <= 20.0%` (`change10 < 8`) | `1.76%` (`frac_still = 0.0176`) | **FAIL** |
| Style: Fast Frame Share (`pct_fast`) | `pct_fast <= 35.0%` (`change10 > 35`) | `30.24%` (`frac_fast = 0.3024`) | **PASS** |
| Style: Luminance (`L_mean`) | `L_mean >= 50.0` (CIE `L*` D65 video mean) | `46.74` (`L_p5 = 33.27`, `L_p95 = 59.0`) | **FAIL** |
| Style: Hard Cuts vs. `~0` Target | `~0` cuts (continuous inkbeat camera) | `24` detected (`25` GT boundaries in 26-shot montage) | **INFO** |

---

## Table 2 — Ground-Truth Boundary vs. Detected Hard-Cut Matching (25 Internal Boundaries)

Greedy one-to-one matching within `±3` frames yields **`TP = 24`**, **`FN = 1`**, **`FP = 0`**, **Recall = `24/25` (`96.0%`)**.

Anchor shots highlighted below: **`shot15 (930–989)`**, **`shot16 (990–1064)`**, **`shot22 (1410–1484)`**, **`shot26 (1725–1775)`**.

| Boundary # | Shot Transition | GT Frame | GT Time (s) | Nearest Detected Cut Frame | Delta (frames) | Matched (`\|Delta\| <= 3`) | Transition Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B01 | `shot01 -> shot02` | `60` | `2.000` | `58` | `-2` | **YES** | Early cut onset (`lavfi.scene_score[58] = 0.514736`) within `±3` frame window |
| B02 | `shot02 -> shot03` | `120` | `4.000` | `120` | `0` | **YES** | Exact frame hard cut |
| B03 | `shot03 -> shot04` | `180` | `6.000` | `180` | `0` | **YES** | Exact frame hard cut |
| B04 | `shot04 -> shot05` | `270` | `9.000` | `270` | `0` | **YES** | Exact frame hard cut |
| B05 | `shot05 -> shot06` | `345` | `11.500` | `345` | `0` | **YES** | Exact frame hard cut |
| B06 | `shot06 -> shot07` | `420` | `14.000` | `420` | `0` | **YES** | Exact frame hard cut |
| B07 | `shot07 -> shot08` | `480` | `16.000` | `480` | `0` | **YES** | Exact frame hard cut |
| B08 | `shot08 -> shot09` | `555` | `18.500` | `555` | `0` | **YES** | Exact frame hard cut |
| B09 | `shot09 -> shot10` | `630` | `21.000` | `630` | `0` | **YES** | Exact frame hard cut |
| B10 | `shot10 -> shot11` | `690` | `23.000` | `690` | `0` | **YES** | Exact frame hard cut |
| B11 | `shot11 -> shot12` | `735` | `24.500` | `735` | `0` | **YES** | Exact frame hard cut |
| B12 | `shot12 -> shot13` | `810` | `27.000` | `810` | `0` | **YES** | Exact frame hard cut |
| B13 | `shot13 -> shot14` | `870` | `29.000` | `870` | `0` | **YES** | Exact frame hard cut |
| **B14** | `shot14 ->` **`shot15 (anchor, 930–989)`** | `930` | `31.000` | `930` | `0` | **YES** | **Anchor shot15 entry:** exact frame hard cut |
| **B15** | **`shot15`** `->` **`shot16 (anchor, 990–1064)`** | `990` | `33.000` | `990` | `0` | **YES** | **Anchor shot16 entry:** exact frame hard cut |
| B16 | `shot16 -> shot17` | `1065` | `35.500` | `1065` | `0` | **YES** | Exact frame hard cut |
| B17 | `shot17 -> shot18` | `1140` | `38.000` | `1140` | `0` | **YES** | Exact frame hard cut |
| B18 | `shot18 -> shot19` | `1215` | `40.500` | `1215` | `0` | **YES** | Exact frame hard cut |
| B19 | `shot19 -> shot20` | `1290` | `43.000` | `1290` | `0` | **YES** | Exact frame hard cut |
| B20 | `shot20 -> shot21` | `1350` | `45.000` | `1350` | `0` | **YES** | Exact frame hard cut |
| **B21** | `shot21 ->` **`shot22 (anchor, 1410–1484)`** | `1410` | `47.000` | *None* | *N/A* | **NO (FN)** | **Anchor shot22 entry missed:** `lavfi.scene_score[1410] = 0.294745` (`<= 0.3` threshold by `0.005255`); same-palette/toned transition triggers `change10` beat at frame `1411` but stays just below `0.3` |
| B22 | `shot22 -> shot23` | `1485` | `49.500` | `1485` | `0` | **YES** | Exact frame hard cut |
| B23 | `shot23 -> shot24` | `1590` | `53.000` | `1590` | `0` | **YES** | Exact frame hard cut |
| B24 | `shot24 -> shot25` | `1665` | `55.500` | `1665` | `0` | **YES** | Exact frame hard cut |
| **B25** | `shot25 ->` **`shot26 (anchor, 1725–1775)`** | `1725` | `57.500` | `1725` | `0` | **YES** | **Anchor shot26 entry:** exact frame hard cut |

---

## Table 3 — Unmatched / False-Positive Hard Cuts

| Detected Cut Frame | Detected Time (s) | Nearest GT Boundary (Delta) | Cause Note |
| --- | --- | --- | --- |
| *None (`0` false positives)* | *—* | *—* | All `24` detected `lavfi.scene_score > 0.3` events matched a GT boundary within `±3` frames (`FP = 0`). |

---

## Table 4 — Style Comparison vs. Inkbeat Targets (Informational / Diagnostic)

| Metric | Inkbeat Reference Target | Measured (`indiana_bell_final.mp4`) | Delta / Status | Format Interpretation Note |
| --- | --- | --- | --- | --- |
| `beats_per_min` | `52.0 – 60.0` (`56 ± 4` BPM) | `62.84` BPM (`62` beats; `beats_per_10s = [12, 10, 9, 14, 8, 9]`) | `+2.84` BPM above upper bound (**FAIL**) | Unmasked `change10` counts cut-induced luma spikes: `24/62` beats fall within `±5` frames of detected `cut_frames` (`25/62` within `±5` frames of the `25` GT boundaries). Intra-shot camera motion alone accounts for `37` beats (`37.50` BPM). |
| `pct_still` (`frac_still`) | `5.0% – 20.0%` (`0.05 – 0.20`) | `1.76%` (`0.0176`) | `-3.24` pp below lower bound (**FAIL**) | Very low stillness (`change10 < 8` over `ds[10:]`): camera moves nearly continuously across almost every shot, leaving minimal static holds. |
| `pct_fast` (`frac_fast`) | `<= 35.0%` (`<= 0.35`) | `30.24%` (`0.3024`) | `-4.76` pp headroom (**PASS**) | Within threshold despite 25 shot boundaries contributing `change10 > 35` spikes across 10-frame lookback windows. |
| `L_mean` (CIE `L*` D65) | `>= 50.0` | `46.74` (`L_p5 = 33.27`, `L_p95 = 59.0`) | `-3.26` below target (**FAIL**) | Historical/period dark palette and shadow grading lower mean luminance below `50.0` (`OUT OF STYLE RANGE`). |
| `hard_cuts` | `~0` (continuous-camera inkbeat) | `24` detected (`25` GT boundaries) | **INFO** (Format Difference) | `indiana_bell_final.mp4` is an edited 26-shot montage with 25 intentional shot cuts by design, not a continuous-take animation; recorded as informational, not a defect. |

---

## Table 5 — Camera-Rule Still-Run Audit

| Metric | Camera-Rule Bar | Measured Value | Frame Range & Shot | Status |
| --- | --- | --- | --- | --- |
| `longest_still_run_frames` | `<= 75` frames | `19` frames | Frames `1362–1380` (`shot21`, spanning `1350–1409`) | **PASS** |
| `longest_still_run_s` | `<= 2.50` s (at `30.0` fps) | `0.633` s | Margin of `56` frames (`1.867` s) below the static-hold limit | **PASS** |
