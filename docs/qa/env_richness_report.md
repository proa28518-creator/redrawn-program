# Environment Richness — Measurement Report (inkbeat Phase 2, Workstream C)

**Type:** Measurement only. No scene/production code was changed; the only code added is the
measurement script `scripts/qa/env_richness.py` (numpy + PIL only).
**Inputs:** Indiana Bell shot stills `shot-01.png` … `shot-26.png` (1080×1920) from
`~/workspace/bridge/indiana-bell/stills/` — exactly the 26 shot stills in that folder
(the other 9 files there are render logs; no duplicate/fix-round still variants exist in it).
**Floors (inkbeat `sets-and-materials.md`, never moved):**
F1 ≥ 12 distinct props in view in every framing · F2 texture energy ≥ 0.45
(his flat-color first pass ≈ 0.19 on his scale → relative lift 0.45/0.19 = 2.3684).

## Gating correction (desk-adopted, GLM confirmation pass 2026-11-16)

This report's gating was corrected after GLM's Phase 2 confirmation pass; the script
`scripts/qa/env_richness.py` now implements the same rules. No measurement was re-taken
and no measured number changed — only the gating basis:

1. **Texture energy is gated on the RAW 0.45 floor ONLY: 13/26 shots pass.** The
   relative-basis variant previously used as the F2 gate (`tex_ratio ≥ 2.3684` against
   the calibrated flat-drift synthetic) silently lowered the effective floor to
   ≈ 0.4136 (see calibration erratum) and is **withdrawn as a gate**. `tex_ratio`
   remains in the table as a reported measurement (18/26 sit at or above 2.3684), but
   it decides nothing.
2. **The automated props proxy is DISCARDED for per-shot gating.** Validation against
   hand counts showed a mean bias of +20.0 props per shot — statistically
   indistinguishable from noise at the individual-shot level. Per-shot F1 verdicts are
   issued **only for the hand-audited shots, from the hand counts**: shot-02: 1,
   shot-13: 5, shot-22: 4, all against the floor of 12 — **0/3 pass**. The proxy and
   its bias-corrected estimate remain in the table as clearly-labeled informational
   measurements, never as a gate.
3. **The systemic conclusion stands unchanged:** Indiana Bell is materially sparser
   in prop density and borderline-to-flat in texture than the inkbeat floors,
   supported exclusively by the corrected raw texture gate and the verified hand
   counts. Removing the unreliable proxy clarifies the evidence base; it does not
   soften the finding.

| Metric | Method | Result | Floor | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| Texture Energy | Raw Gate (0.45) | 13/26 Shots Pass | 0.45 | Mixed / Partial Fail |
| Prop Density | Hand Count (Sampled) | 1, 5, 4 Props | 12 Props | **Fail** |
| Prop Density | Automated Proxy | Discarded | N/A | Invalid |

## Methods (pre-registered in the Argon plan before any still was measured)

- **Props proxy (informational only since the 2026-11-16 correction):** 4× bilinear
  downscale → fixed 6×6×6 RGB quantization → edge-barrier mask (luma gradient > 28) →
  4-connected components (BFS) → min area 104 downscaled px → background exclusion
  BG-1…BG-5 → facet merging M1/M2. One surviving cluster = 1 proxy-prop.
- **Hand-count cross-check (the F1 gate):** shots 02, 13, 22 hand-counted under the
  plan's counting rules (characters/structural shell/atmosphere = 0; contiguous
  clusters = 1; identical-class cap 3; ≥25% visible). Bias = proxy − hand. The
  bias-corrected per-shot estimates are reported for information only; they gate
  nothing.
- **Texture energy:** full-res Rec.601 luma, |diff| gradient magnitude /√2, per-pixel
  clamp cap 0.056, 8×8 regional cube-root means averaged → `texture_energy` ∈ [0,1].
  Also reports unclamped `raw_linear_grad`.
- **Calibration (same code):** synthetic flat (single RGB 128) → texture_energy 0.0000,
  proxy 0. Synthetic flat-with-large-drift (planar ramp 32→255) → texture_energy 0.1746
  (`flat_ours`), raw_linear_grad 0.000298, proxy 0.
- **Scale honesty:** our scale is **not** equated to inkbeat's (his operator is
  unrecovered). F2 is scored on the raw floor: `texture_energy` must be ≥ 0.45.
  `tex_ratio = texture_energy / flat_ours` is reported alongside as a measurement
  only (see Gating correction).

### Calibration erratum (recorded, not hidden)

The plan's analytic prediction for the drift synthetic (0.1902) assumed independent x/y
rounding steps. Verified numerically: on a planar ramp the steps coincide along
integer-level contours (P(both) = P(dx) = 0.05839), so the faithful implementation yields
0.1746. The self-test gate bands were corrected to the true deterministic values under a
coordinator ruling; the ramp, the cap, and **all scoring thresholds were not changed**.
Consequence (Argon verifier): because the denominator is 0.1746 rather than the intended
0.1902, `tex_ratio ≥ 2.3684` corresponds to raw texture_energy ≥ 0.4136, not 0.4500.
That consequence is exactly why the relative basis was later withdrawn as a gate
(GLM confirmation, 2026-11-16): **F2 is gated on raw ≥ 0.45 only — 13/26 pass.** The
relative tally (18/26 at or above 2.3684) is retained above as a measurement, and five
of those 18 relative passes sit in [0.4136, 0.4500) — they FAIL the raw gate.

## Per-shot results

`props proxy` and `corrected props` are informational measurements (proxy discarded
for gating). `F1` verdicts exist only for the hand-audited shots. `F2` is the raw gate.

| shot | props proxy | props hand | corrected props | F1 (hand, ≥12) | texture energy | tex_ratio | F2 (raw ≥ 0.45) |
|---|---|---|---|---|---|---|---|
| shot-01 | 52 | — | 32.00 | — | 0.5867 | 3.3598 | PASS |
| shot-02 | 22 | 1 | 1.00 | FAIL | 0.3249 | 1.8602 | FAIL |
| shot-03 | 23 | — | 3.00 | — | 0.6972 | 3.9923 | PASS |
| shot-04 | 16 | — | 0.00 | — | 0.4475 | 2.5626 | FAIL |
| shot-05 | 54 | — | 34.00 | — | 0.4935 | 2.8259 | PASS |
| shot-06 | 34 | — | 14.00 | — | 0.4374 | 2.5048 | FAIL |
| shot-07 | 35 | — | 15.00 | — | 0.5447 | 3.1188 | PASS |
| shot-08 | 17 | — | 0.00 | — | 0.3152 | 1.8049 | FAIL |
| shot-09 | 9 | — | 0.00 | — | 0.4043 | 2.3149 | FAIL |
| shot-10 | 16 | — | 0.00 | — | 0.3912 | 2.2400 | FAIL |
| shot-11 | 32 | — | 12.00 | — | 0.5444 | 3.1173 | PASS |
| shot-12 | 29 | — | 9.00 | — | 0.3974 | 2.2758 | FAIL |
| shot-13 | 34 | 5 | 5.00 | FAIL | 0.5715 | 3.2724 | PASS |
| shot-14 | 51 | — | 31.00 | — | 0.4677 | 2.6783 | PASS |
| shot-15 | 41 | — | 21.00 | — | 0.5040 | 2.8860 | PASS |
| shot-16 | 74 | — | 54.00 | — | 0.6792 | 3.8892 | PASS |
| shot-17 | 22 | — | 2.00 | — | 0.4427 | 2.5350 | FAIL |
| shot-18 | 47 | — | 27.00 | — | 0.4601 | 2.6343 | PASS |
| shot-19 | 15 | — | 0.00 | — | 0.3180 | 1.8207 | FAIL |
| shot-20 | 6 | — | 0.00 | — | 0.4349 | 2.4904 | FAIL |
| shot-21 | 5 | — | 0.00 | — | 0.3301 | 1.8902 | FAIL |
| shot-22 | 14 | 4 | 4.00 | FAIL | 0.2769 | 1.5855 | FAIL |
| shot-23 | 37 | — | 17.00 | — | 0.5675 | 3.2494 | PASS |
| shot-24 | 21 | — | 1.00 | — | 0.5857 | 3.3538 | PASS |
| shot-25 | 31 | — | 11.00 | — | 0.4373 | 2.5041 | FAIL |
| shot-26 | 28 | — | 8.00 | — | 0.5063 | 2.8993 | PASS |

Hand-count audit: shot-02 bias +21 (proxy 22 vs hand 1), shot-13 bias +29 (34 vs 5),
shot-22 bias +10 (14 vs 4); mean bias +20.0, median +21, mean hand/proxy ratio 0.159.
Full data: `env_richness.json` / `env_richness.csv` / `env_richness_summary.md`
(coordination folder `~/workspace/bridge/p2-env/`). Determinism: two runs, identical
CSV sha256 `f5334f37141001fdd270d9455654d709bdba2f6549db08d50b23d79a9966fe87`.

## Summary vs floors

- **F1 (props ≥ 12):** the only per-shot verdicts are the hand-audited ones —
  **0/3 pass** (true counts 1, 5, 4). Informational only: the bias-corrected proxy
  nominally passed 10/26 with median corrected 6.5, but per-shot F1 verdicts on
  non-audited shots are **not earned** (bias +10…+29 is non-stationary and larger
  than the floor itself), and the proxy is discarded as a gate. The aggregate
  negative claim survives: even with a proxy that over-counts ~6×, the corrected
  median is 6.5, far below 12.
- **F2 (texture):** **13/26 pass** the raw gate (texture_energy ≥ 0.45) — the only
  F2 gate. Median texture_energy 0.4538 — knife-edge at the floor. As a measurement,
  18/26 sit at or above tex_ratio 2.3684 on the relative basis; 8 shots fail even
  that relative reading (02, 08, 09, 10, 12, 19, 21, 22).
- **Both floors:** verdicts exist only where both gates exist — the audited shots:
  **0/3** (shot-13 passes F2 but fails F1; shots 02 and 22 fail both). Under the
  retired dual gating the nominal both-floors tally was 10/26; it is superseded.

## Unsoftened statement of shortfall

Indiana Bell's framings fall materially short of the inkbeat environment-richness floors.
Every hand-verified framing contains 1–5 real props against a floor of 12 — these are
extreme close-ups of near-empty geometry (a wall and one object; a brick wall with falling
beams and two crates; a mechanism macro with four blocks). The automated proxy flatters
the film by counting color facets, not props, and still — after subtracting its own large
measured bias — leaves a median framing at 6.5 props, roughly half the floor. On texture,
half the shots sit at or below the 0.45 line on our calibrated scale, and eight shots are
flat by any reading (ratios 1.59–2.31 against a 2.37 requirement), including the flattest
frame in the film (shot-22, 0.2769). There is no reading of these measurements — raw,
corrected, relative, or audited — under which this film meets the inkbeat richness floors.

## Argon interim verdict (substance)

- F1 per-shot PASS claims on the 23 non-audited shots: **REJECTED** (proxy counts facets;
  bias span 19 > floor 12; audited pair 02/22 even rank-inverts). Surviving F1 claims:
  the 3 audited FAILs, and the aggregate negative (systemic shortfall).
- F2: **conditionally sound** as a relative spatial-variation index. A FAIL is a hard
  negative (even counting every edge, the frame is flat); a PASS is necessary-but-not-
  sufficient (edges and micro-texture are conflated by a first-order operator).
- Erratum: **acceptable** (frozen spec, corrected arithmetic expectation only). The
  mandatory dual reporting Argon required at the time (18/26 relative / 13/26 raw
  ≥ 0.45) is superseded by the GLM confirmation below: the raw reading is the gate,
  the relative reading a measurement.
- Headline: Indiana Bell is materially sparser in prop density and borderline-to-flat in
  spatial texture across roughly half to two-thirds of its 26 framings vs the inkbeat floors.

## GLM confirmation pass (2026-11-16) — corrections adopted

- (A) Flicker detector: AGREE. (B) Pacing analyzer: AGREE.
- (C) Environment richness: DISAGREE on method — **desk corrections adopted (this
  report)**: gate texture energy on RAW 0.45 only (13/26); discard the F1 props
  proxy for per-shot gating (hand counts govern: 1, 5, 4 vs floor 12); the systemic
  shortfall stands on the hand counts.

## Corrective actions for future productions

1. Enforce a minimum prop density per framing, verified via manual hand counts prior
   to final render approval — automated proxy counts do not gate.
2. Ensure all painted textures meet or exceed the energy threshold of 0.45 on the
   raw scale, with no reliance on relative baselines.
3. Submit a comprehensive look-dev sheet for sign-off before any asset enters the
   render pipeline.

## Method limits (stated, not hidden)

1. The props proxy is semantically blind: characters, trim, and shadow patches fragment
   into counted clusters; bias is large and non-stationary (+10…+29, n=3, all close-ups).
2. The additive correction assumes stationary bias; with n=3 close-up audits it cannot
   certify wide/medium framings. True per-shot F1 requires hand-counting each shot.
3. Texture energy conflates geometric edges with surface micro-texture despite the clamp.
4. Absolute equivalence to inkbeat's own scorers is not claimed for either metric;
   the F2 gate is the raw 0.45 floor on our calibrated scale.
5. 8-bit PNG quantization floors out sub-1/255 gradients.
