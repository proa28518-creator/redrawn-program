#!/usr/bin/env python3
"""Environment richness measurement script for P2 Workstream C.

Implements sections 1, 3, 4, 5, and 6 of plan_p2c.md deterministically using
only numpy and PIL.

Gating correction (desk-adopted from GLM's Phase 2 confirmation pass,
2026-11-16): F2 is gated on the RAW texture_energy floor 0.45 ONLY — the
relative tex_ratio basis is a reported measurement, never a gate. The
automated props proxy is DISCARDED for per-shot F1 gating (measured mean
bias +20.0 vs hand counts); per-shot F1 verdicts are issued only for
hand-audited shots, from the hand counts. Measurement code and measured
values are unchanged by this correction.
"""

import os

os.environ["PYTHONHASHSEED"] = "0"

import argparse
from collections import deque
import csv
import json
import math
from pathlib import Path
import platform
import sys

import numpy as np
from PIL import Image

np.random.seed(0)

# Pre-registered hand counts and itemized inventories from coordinator visual
# inspection (executor_p2c.md / plan_p2c.md §2.2).
HAND_COUNTS = {
    "shot-02": 1,
    "shot-13": 5,
    "shot-22": 4,
}

HAND_INVENTORIES = {
    "shot-02": [
        "faceted round hanging object (bell/knob-like, centre frame)",
    ],
    "shot-13": [
        "falling timber beam 1 (of 5 visible, capped at 3 under identical-class cap)",
        "falling timber beam 2 (of 5 visible, capped at 3 under identical-class cap)",
        "falling timber beam 3 (of 5 visible, capped at 3 under identical-class cap)",
        "stacked wooden crate 1 (bottom-left)",
        "stacked wooden crate 2 (bottom-left)",
    ],
    "shot-22": [
        "large blue rectangular block",
        "hexagonal-ended horizontal peg/cylinder",
        "two-tone yellow/grey bar (left)",
        "two-tone yellow/grey bar (right)",
    ],
}

HAND_NOTES = {
    "shot-02": "rest is plank/brick wall + beam = structural shell (0).",
    "shot-13": (
        "5 falling timber beams visible, counted as 3 under the identical-class cap of 3; "
        "plus 2 stacked wooden crates bottom-left = 2. Brick wall/sky/roof/dust puff = 0 per rules."
    ),
    "shot-22": "blue surround = background (0).",
}

# Fixed pre-registered thresholds and constants (plan_p2c.md).
# F1 gate: hand-counted props >= F1_FLOOR, hand-audited shots only.
# F2 gate: raw texture_energy >= F2_RAW_REF (the ONLY texture gate since the
# 2026-11-16 correction; the former relative tex_ratio floor 2.3684 is
# retired as a gate — tex_ratio remains a reported measurement only).
F1_FLOOR = 12.0
F2_RAW_REF = 0.4500

EDGE_LUMA_THRESHOLD = 28.0
MIN_AREA_D = 104
BG1_MAX_AREA_D = 10368
BG2_AREA_D = 3888
BG34_AREA_D = 1944
BG5_AREA_D = 1555
BG5_BORDER_PX = 40
M1_RGB_DIST = 45.0
M1_GAP_D = 2
M2_OVERLAP_RATIO = 0.60
M2_SMALL_AREA_D = 648
TEX_C_CAP = 0.056

CSV_COLUMNS = [
    "shot_id",
    "proxy_props",
    "hand_props",
    "prop_bias",
    "corrected_props",
    "f1_pass",
    "raw_linear_grad",
    "texture_energy",
    "tex_ratio",
    "f2_pass",
    "overall_pass",
]


class _UnionFind:
    """Deterministic disjoint-set structure for candidate component merging."""

    def __init__(self, n: int) -> None:
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra = self.find(a)
        rb = self.find(b)
        if ra == rb:
            return
        if self.rank[ra] < self.rank[rb]:
            ra, rb = rb, ra
        self.parent[rb] = ra
        if self.rank[ra] == self.rank[rb]:
            self.rank[ra] += 1


def generate_synthetics(height: int, width: int) -> dict:
    """Generate in-memory synthetic calibration frames (plan_p2c.md §4.1)."""
    syn_a = np.full((height, width, 3), 128, dtype=np.uint8)

    idx_y = np.arange(height, dtype=np.float64)[:, None]
    idx_x = np.arange(width, dtype=np.float64)[None, :]
    if height >= width:
        idx_long = idx_y
        idx_short = idx_x
        denom_long = float(max(height - 1, 1))
        denom_short = float(max(width - 1, 1))
    else:
        idx_long = idx_x
        idx_short = idx_y
        denom_long = float(max(width - 1, 1))
        denom_short = float(max(height - 1, 1))

    v = np.rint(
        32.0 + 160.0 * (idx_long / denom_long) + 63.0 * (idx_short / denom_short)
    ).astype(np.uint8)
    syn_b = np.repeat(v[..., None], 3, axis=2)

    return {
        "synthetic_flat_rgb": syn_a,
        "synthetic_flat_drift": syn_b,
    }


def compute_proxy_props(rgb_uint8: np.ndarray) -> dict:
    """Compute props-per-framing proxy count per plan_p2c.md §1.1 steps 1-7."""
    h_full, w_full, _ = rgb_uint8.shape
    w_d = w_full // 4
    h_d = h_full // 4
    n_d = h_d * w_d

    # Step 1: 4x bilinear downscaling via PIL.
    pil_img = Image.fromarray(rgb_uint8, mode="RGB")
    pil_d = pil_img.resize((w_d, h_d), resample=Image.Resampling.BILINEAR)
    img_d = np.asarray(pil_d, dtype=np.uint8)

    # Step 2: Fixed uniform 6x6x6 RGB quantization.
    img_d_int = img_d.astype(np.int32)
    q = (img_d_int * 6) // 256
    color_id = 36 * q[..., 0] + 6 * q[..., 1] + q[..., 2]

    # Step 3: Rec. 601 luminance & forward finite-difference edge barrier mask.
    img_f = img_d.astype(np.float64)
    luma = 0.299 * img_f[..., 0] + 0.587 * img_f[..., 1] + 0.114 * img_f[..., 2]
    gx = np.zeros((h_d, w_d), dtype=np.float64)
    gy = np.zeros((h_d, w_d), dtype=np.float64)
    gx[:, :-1] = np.abs(luma[:, 1:] - luma[:, :-1])
    gy[:-1, :] = np.abs(luma[1:, :] - luma[:-1, :])
    g_mag = np.sqrt(gx * gx + gy * gy)
    is_edge = g_mag > EDGE_LUMA_THRESHOLD

    # Step 4: 4-connectivity BFS in row-major order.
    color_list = color_id.ravel().tolist()
    edge_list = is_edge.ravel().tolist()
    r_list = img_d[..., 0].ravel().tolist()
    g_list = img_d[..., 1].ravel().tolist()
    b_list = img_d[..., 2].ravel().tolist()

    visited = bytearray(n_d)
    raw_components = []
    h_minus_1 = h_d - 1
    w_minus_1 = w_d - 1

    for start_idx in range(n_d):
        if visited[start_idx] or edge_list[start_idx]:
            continue

        target_color = color_list[start_idx]
        visited[start_idx] = 1
        queue = deque([start_idx])

        area_d = 0
        ymin = h_d
        xmin = w_d
        ymax = -1
        xmax = -1
        sum_y = 0
        sum_x = 0
        sum_r = 0
        sum_g = 0
        sum_b = 0
        border_px_count = 0

        while queue:
            cur = queue.popleft()
            cy_px, cx_px = divmod(cur, w_d)

            area_d += 1
            if cy_px < ymin:
                ymin = cy_px
            if cy_px > ymax:
                ymax = cy_px
            if cx_px < xmin:
                xmin = cx_px
            if cx_px > xmax:
                xmax = cx_px

            sum_y += cy_px
            sum_x += cx_px
            sum_r += r_list[cur]
            sum_g += g_list[cur]
            sum_b += b_list[cur]

            if cy_px == 0 or cy_px == h_minus_1 or cx_px == 0 or cx_px == w_minus_1:
                border_px_count += 1

            if cy_px > 0:
                n_idx = cur - w_d
                if not visited[n_idx] and not edge_list[n_idx] and color_list[n_idx] == target_color:
                    visited[n_idx] = 1
                    queue.append(n_idx)
            if cy_px < h_minus_1:
                n_idx = cur + w_d
                if not visited[n_idx] and not edge_list[n_idx] and color_list[n_idx] == target_color:
                    visited[n_idx] = 1
                    queue.append(n_idx)
            if cx_px > 0:
                n_idx = cur - 1
                if not visited[n_idx] and not edge_list[n_idx] and color_list[n_idx] == target_color:
                    visited[n_idx] = 1
                    queue.append(n_idx)
            if cx_px < w_minus_1:
                n_idx = cur + 1
                if not visited[n_idx] and not edge_list[n_idx] and color_list[n_idx] == target_color:
                    visited[n_idx] = 1
                    queue.append(n_idx)

        raw_components.append(
            {
                "area_d": area_d,
                "area_full": area_d * 16,
                "area_pct": 100.0 * area_d / float(n_d),
                "ymin": ymin,
                "xmin": xmin,
                "ymax": ymax,
                "xmax": xmax,
                "cy": sum_y / float(area_d),
                "cx": sum_x / float(area_d),
                "mean_r": sum_r / float(area_d),
                "mean_g": sum_g / float(area_d),
                "mean_b": sum_b / float(area_d),
                "touches_top": ymin == 0,
                "touches_bottom": ymax == h_minus_1,
                "touches_left": xmin == 0,
                "touches_right": xmax == w_minus_1,
                "border_px_count": border_px_count,
            }
        )

    # Step 5: Minimum component area filter.
    surviving = [c for c in raw_components if c["area_d"] >= MIN_AREA_D]

    # Sort surviving components deterministically by (-area_d, ymin, xmin) for BG-2 rank check.
    surviving.sort(key=lambda c: (-c["area_d"], c["ymin"], c["xmin"]))

    # Step 6: Maximum component area & background exclusion rules BG-1 .. BG-5.
    candidates = []
    for rank_idx, comp in enumerate(surviving):
        area_d = comp["area_d"]
        num_borders = (
            int(comp["touches_top"])
            + int(comp["touches_bottom"])
            + int(comp["touches_left"])
            + int(comp["touches_right"])
        )
        bbox_w = comp["xmax"] - comp["xmin"] + 1

        is_bg1 = area_d > BG1_MAX_AREA_D
        is_bg2 = rank_idx < 2 and area_d > BG2_AREA_D and num_borders >= 1
        is_bg3 = (
            (comp["touches_top"] or comp["cy"] < 0.20 * h_d)
            and area_d > BG34_AREA_D
            and bbox_w > 0.25 * w_d
        )
        is_bg4 = (
            (comp["touches_bottom"] or comp["cy"] > 0.80 * h_d)
            and area_d > BG34_AREA_D
            and bbox_w > 0.25 * w_d
        )
        is_bg5 = num_borders >= 2 and (
            area_d > BG5_AREA_D or comp["border_px_count"] >= BG5_BORDER_PX
        )

        if not (is_bg1 or is_bg2 or is_bg3 or is_bg4 or is_bg5):
            candidates.append(comp)

    # Step 7: Deterministic sort and Union-Find merging under M1 & M2.
    candidates.sort(key=lambda c: (-c["area_d"], c["ymin"], c["xmin"]))
    num_cand = len(candidates)
    uf = _UnionFind(num_cand)

    for i in range(num_cand):
        ci = candidates[i]
        area_bi = (ci["xmax"] - ci["xmin"] + 1) * (ci["ymax"] - ci["ymin"] + 1)
        for j in range(i + 1, num_cand):
            cj = candidates[j]

            # M1: Multi-Facet Shading Merge
            gap_x = max(0, ci["xmin"] - cj["xmax"], cj["xmin"] - ci["xmax"])
            gap_y = max(0, ci["ymin"] - cj["ymax"], cj["ymin"] - ci["ymax"])
            m1_merge = False
            if gap_x <= M1_GAP_D and gap_y <= M1_GAP_D:
                dr = ci["mean_r"] - cj["mean_r"]
                dg = ci["mean_g"] - cj["mean_g"]
                db = ci["mean_b"] - cj["mean_b"]
                rgb_dist = math.sqrt(dr * dr + dg * dg + db * db)
                if rgb_dist <= M1_RGB_DIST:
                    m1_merge = True

            # M2: Sub-Part Containment Merge
            m2_merge = False
            if min(ci["area_d"], cj["area_d"]) < M2_SMALL_AREA_D:
                inter_w = max(0, min(ci["xmax"], cj["xmax"]) - max(ci["xmin"], cj["xmin"]) + 1)
                inter_h = max(0, min(ci["ymax"], cj["ymax"]) - max(ci["ymin"], cj["ymin"]) + 1)
                if inter_w > 0 and inter_h > 0:
                    inter_area = inter_w * inter_h
                    area_bj = (cj["xmax"] - cj["xmin"] + 1) * (cj["ymax"] - cj["ymin"] + 1)
                    overlap_ratio = inter_area / float(min(area_bi, area_bj))
                    if overlap_ratio >= M2_OVERLAP_RATIO:
                        m2_merge = True

            if m1_merge or m2_merge:
                uf.union(i, j)

    clusters = {uf.find(i) for i in range(num_cand)}
    return {
        "proxy_props": len(clusters),
        "num_raw_components": len(raw_components),
        "num_after_min_area": len(surviving),
        "num_after_bg_exclusion": num_cand,
    }


def compute_texture_energy(rgb_uint8: np.ndarray) -> dict:
    """Compute full-res texture energy per plan_p2c.md §3.2 verbatim."""
    arr = rgb_uint8.astype(np.float64)
    luma = (0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]) / 255.0

    dx = np.abs(np.diff(luma, n=1, axis=1))[:-1, :]
    dy = np.abs(np.diff(luma, n=1, axis=0))[:, :-1]
    grad = np.sqrt(dx * dx + dy * dy) / np.sqrt(2.0)

    raw_linear = float(np.mean(grad))
    g_tex = np.minimum(grad / TEX_C_CAP, 1.0)

    row_strips = np.array_split(g_tex, 8, axis=0)
    region_scores = []
    for strip in row_strips:
        blocks = np.array_split(strip, 8, axis=1)
        for blk in blocks:
            m = float(np.mean(blk))
            region_scores.append(m ** (1.0 / 3.0) if m > 0.0 else 0.0)

    e_tex = float(np.mean(region_scores))
    return {"texture_energy": e_tex, "raw_linear_grad": raw_linear}


def run_self_tests(height: int, width: int) -> dict:
    """Run synthetic self-test gate (plan_p2c.md §8 step 4) before loading stills."""
    synthetics = generate_synthetics(height, width)

    syn_a_rgb = synthetics["synthetic_flat_rgb"]
    syn_a_tex = compute_texture_energy(syn_a_rgb)
    syn_a_props = compute_proxy_props(syn_a_rgb)

    syn_b_rgb = synthetics["synthetic_flat_drift"]
    syn_b_tex = compute_texture_energy(syn_b_rgb)
    syn_b_props = compute_proxy_props(syn_b_rgb)

    assert abs(syn_a_tex["texture_energy"] - 0.0) < 1e-9, (
        f"syn_a texture_energy failed: {syn_a_tex['texture_energy']}"
    )
    assert syn_a_props["proxy_props"] == 0, (
        f"syn_a proxy_props failed: {syn_a_props['proxy_props']}"
    )
    # Coordinator ruling (Option B erratum to plan_p2c.md §4.1 / §8 Step 4):
    # The plan's analytic prediction (raw_linear=0.0003852, E_tex=0.1902) assumed
    # independent x/y rounding steps, whereas for the deterministic planar ramp the
    # steps coincide along integer-level contours (P(both) = P(dx) = 0.05839), yielding
    # raw_linear=0.00029826 and E_tex=0.174638. Keep the ramp, TEX_C_CAP, and all
    # scoring rules unchanged, and gate on the true deterministic values.
    # (Calibration values only; F2 shot gating was corrected 2026-11-16 to the
    # raw texture_energy >= 0.45 floor — see module docstring.)
    assert 0.170 <= syn_b_tex["texture_energy"] <= 0.180, (
        f"syn_b texture_energy out of [0.170, 0.180]: {syn_b_tex['texture_energy']}"
    )
    assert 0.00029 <= syn_b_tex["raw_linear_grad"] <= 0.00031, (
        f"syn_b raw_linear_grad out of [0.00029, 0.00031]: {syn_b_tex['raw_linear_grad']}"
    )

    return {
        "synthetic_flat_rgb": {
            "texture_energy": syn_a_tex["texture_energy"],
            "raw_linear_grad": syn_a_tex["raw_linear_grad"],
            "proxy_props": syn_a_props["proxy_props"],
        },
        "synthetic_flat_drift": {
            "texture_energy": syn_b_tex["texture_energy"],
            "raw_linear_grad": syn_b_tex["raw_linear_grad"],
            "proxy_props": syn_b_props["proxy_props"],
            "flat_ours": syn_b_tex["texture_energy"],
        },
    }


def _compute_stats(values: list) -> dict:
    """Compute min, median, mean, std, max using float64."""
    arr = np.asarray(values, dtype=np.float64)
    return {
        "min": float(np.min(arr)),
        "median": float(np.median(arr)),
        "mean": float(np.mean(arr)),
        "std": float(np.std(arr, ddof=0)),
        "max": float(np.max(arr)),
    }


def _write_csv(out_path: Path, shot_records: list) -> None:
    """Write deterministic 12-column CSV report (plan_p2c.md §5.3)."""
    with out_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(CSV_COLUMNS)
        for rec in shot_records:
            writer.writerow(
                [
                    rec["shot_id"],
                    rec["proxy_props"],
                    "" if rec["hand_props"] is None else rec["hand_props"],
                    "" if rec["prop_bias"] is None else rec["prop_bias"],
                    f"{rec['corrected_props']:.2f}",
                    rec["f1_pass"],
                    f"{rec['raw_linear_grad']:.6f}",
                    f"{rec['texture_energy']:.4f}",
                    f"{rec['tex_ratio']:.4f}",
                    rec["f2_pass"],
                    rec["overall_pass"],
                ]
            )


def _write_markdown(
    out_path: Path,
    calibration: dict,
    hand_cal: dict,
    shot_records: list,
    agg_stats: dict,
    pass_counts: dict,
    num_shots: int,
) -> None:
    """Write human-readable markdown summary report (plan_p2c.md §§5.2, 5.3, 6.3, 7)."""
    syn_a = calibration["synthetic_flat_rgb"]
    syn_b = calibration["synthetic_flat_drift"]

    lines = [
        "# Environment Richness Measurement Summary (P2 Workstream C)",
        "",
        "**Specification:** `plan_p2c.md` (pre-registered, deterministic, numpy + PIL only)  ",
        f"**Stills Measured:** {num_shots} (`shot-01` .. `shot-{num_shots:02d}`)  ",
        "**Fixed Floors:** F1 (hand-counted props `>= 12.0`, hand-audited shots only), F2 (`texture_energy >= 0.4500`, raw)",
        "",
        "> **Scale Disclaimer (§4.2):** Absolute scale equating between `texture_energy` and inkbeat's unrecovered script is **NOT claimed**. "
        "Per the 2026-11-16 gating correction, F2 is gated on raw `texture_energy >= 0.4500` ONLY; `tex_ratio` (relative to `flat_ours` = `synthetic_flat_drift`) and unclamped `raw_linear_grad` are reported as measurements, never as gates. "
        "The automated props proxy (`proxy_props`, and the bias-corrected estimate `corrected_props`) is likewise informational only — per-shot F1 verdicts come solely from hand counts.",
        "",
        "---",
        "",
        "## 1. Synthetic Calibration Results",
        "",
        "| Synthetic Reference | `raw_linear_grad` | `texture_energy` | `proxy_props` | Role |",
        "| --- | ---: | ---: | ---: | --- |",
        f"| `synthetic_flat_rgb` (a) | {syn_a['raw_linear_grad']:.6f} | {syn_a['texture_energy']:.4f} | {syn_a['proxy_props']} | Zero-gradient sanity gate |",
        f"| `synthetic_flat_drift` (b, `flat_ours`) | {syn_b['raw_linear_grad']:.6f} | {syn_b['texture_energy']:.4f} | {syn_b['proxy_props']} | Untextured drift baseline (`flat_ours`) |",
        "",
        "> **Self-Test Gate Erratum (Coordinator Ruling, Option B):** `plan_p2c.md` §4.1/§8 Step 4 predicted `raw_linear_grad = 0.0003852` and `texture_energy = 0.1902` (gate `[0.185, 0.195]` / `[0.00035, 0.00042]`) under an independence assumption for x/y rounding steps. On the deterministic planar ramp, x and y rounding steps coincide along integer-level contours (`P(both) = P(dx) = 0.05839`), yielding `raw_linear_grad = 0.00029826` and `texture_energy = 0.174638`. Per coordinator ruling, the Step 4 gate bounds were updated to `E_tex in [0.170, 0.180]` and `raw_linear_grad in [0.00029, 0.00031]` while keeping the ramp, `c_cap = 0.056`, and all scoring thresholds unchanged at that time. (F2 shot gating was later corrected, 2026-11-16: raw `texture_energy >= 0.45` only; `tex_ratio` is a measurement, not a gate.)",
        "",
        "---",
        "",
        "## 2. Hand-Count Audit Calibration (`shot-02`, `shot-13`, `shot-22`)",
        "",
        "| Shot | `proxy_props` | `hand_props` | `prop_bias` (`proxy - hand`) | Formula Estimate `max(0, proxy - mean_bias)` |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]

    for shot_id in ("shot-02", "shot-13", "shot-22"):
        entry = hand_cal["per_audited_shot"][shot_id]
        lines.append(
            f"| `{shot_id}` | {entry['proxy_props']} | {entry['hand_props']} | {entry['prop_bias']:+d} | {entry['formula_corrected_props']:.2f} |"
        )

    lines.extend(
        [
            "",
            f"- **Mean Additive Bias (`mean_bias`):** `{hand_cal['mean_bias']:.4f}`",
            f"- **Median Additive Bias (`median_bias`):** `{hand_cal['median_bias']:.4f}`",
            f"- **Mean Ratio (`mean_ratio = mean(hand / max(proxy, 1))`):** `{hand_cal['mean_ratio']:.4f}`",
            "",
            "### Itemized Hand-Count Inventories (§2.2)",
            "",
        ]
    )

    for shot_id in ("shot-02", "shot-13", "shot-22"):
        items_str = "; ".join(HAND_INVENTORIES[shot_id])
        lines.append(
            f"- **`{shot_id}` (`hand_props = {HAND_COUNTS[shot_id]}`):** {items_str} — *{HAND_NOTES[shot_id]}*"
        )

    lines.extend(
        [
            "",
            "---",
            "",
            "## 3. Per-Shot Measurements (All 26 Stills)",
            "",
            "| shot_id | proxy_props | hand_props | prop_bias | corrected_props | f1_pass | raw_linear_grad | texture_energy | tex_ratio | f2_pass | overall_pass |",
            "| --- | ---: | ---: | ---: | ---: | :---: | ---: | ---: | ---: | :---: | :---: |",
        ]
    )

    for rec in shot_records:
        hand_str = "—" if rec["hand_props"] is None else str(rec["hand_props"])
        bias_str = "—" if rec["prop_bias"] is None else f"{rec['prop_bias']:+d}"
        lines.append(
            f"| {rec['shot_id']} | {rec['proxy_props']} | {hand_str} | {bias_str} | "
            f"{rec['corrected_props']:.2f} | {rec['f1_pass']} | "
            f"{rec['raw_linear_grad']:.6f} | {rec['texture_energy']:.4f} | {rec['tex_ratio']:.4f} | "
            f"{rec['f2_pass']} | {rec['overall_pass']} |"
        )

    lines.extend(
        [
            "",
            "---",
            "",
            "## 4. Aggregate Statistics & Pass Rates",
            "",
            "| Metric | Min | Median | Mean | Std | Max |",
            "| --- | ---: | ---: | ---: | ---: | ---: |",
        ]
    )

    fmt_specs = [
        ("proxy_props", 2),
        ("corrected_props", 2),
        ("raw_linear_grad", 6),
        ("texture_energy", 4),
        ("tex_ratio", 4),
    ]
    for metric, dec in fmt_specs:
        st = agg_stats[metric]
        lines.append(
            f"| `{metric}` | {st['min']:.{dec}f} | {st['median']:.{dec}f} | {st['mean']:.{dec}f} | {st['std']:.{dec}f} | {st['max']:.{dec}f} |"
        )

    lines.extend(
        [
            "",
            f"- **F1 Pass (hand counts `>= 12.0`, hand-audited shots only):** `{pass_counts['f1_pass_count']}/{pass_counts['f1_audited_count']}` (`{pass_counts['f1_pass_pct']:.1f}%` of audited)",
            f"- **F2 Pass (`texture_energy >= 0.4500`, raw — the only texture gate):** `{pass_counts['f2_pass_count']}/{num_shots}` (`{pass_counts['f2_pass_pct']:.1f}%`)",
            f"- **Overall Pass (`f1_pass` AND `f2_pass`, hand-audited shots only):** `{pass_counts['overall_pass_count']}/{pass_counts['f1_audited_count']}` (`{pass_counts['overall_pass_pct']:.1f}%` of audited)",
            "",
            "---",
            "",
            "## 5. Known Limits (§7)",
            "",
            "1. **Semantic Blindness of `proxy_props`:** The numpy+PIL segmenter cannot distinguish human characters, architectural trim (mullions, baseboards), or sharp cast shadow patches from physical set-dressing props.",
            "2. **Multi-Material Prop Fragmentation vs. Over-Merging:** Props with high-contrast internal patterns (`> 45` RGB distance across an edge `> 28` luma) split into multiple clusters, while adjacent small props of similar color within 2 downscaled pixels (8 full-res pixels) merge under Rule M1.",
            "3. **Low-Key / Fog Under-Segmentation:** In dark or heavily fogged shots, small props with boundary gradients `<= 28.0` luma and matching `6x6x6` color bins merge into background walls/floors and are missed.",
            "4. **Edge-vs-Texture Conflation in `texture_energy`:** First-order spatial finite differences (`np.diff`) cannot separate dense geometric silhouette edges from true material micro-texture, even with `c_cap = 0.056`.",
            "5. **8-Bit PNG Quantization Floor:** Very subtle shader roughness or lighting gradients with `< 1/255` per-pixel amplitude are quantized into step functions by 8-bit PNG encoding.",
            "6. **Small Hand-Count Calibration Sample (`n = 3`):** Estimating a single global additive offset `mean_bias` from 3 shots (`02`, `13`, `22`) assumes segmentation bias is approximately stationary across all 26 shots.",
            "",
        ]
    )

    out_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Measure environment richness across stills per plan_p2c.md."
    )
    parser.add_argument(
        "--stills-dir",
        type=Path,
        default=Path("~/workspace/bridge/indiana-bell/stills"),
        help="Directory containing shot-01.png .. shot-26.png",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("~/workspace/bridge/p2-env"),
        help="Directory for env_richness.{json,csv,_summary.md}",
    )
    args = parser.parse_args()

    stills_dir = args.stills_dir.expanduser().resolve()
    out_dir = args.out_dir.expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    still_paths = sorted(stills_dir.glob("shot-*.png"))
    if len(still_paths) != 26:
        raise RuntimeError(f"Expected 26 shot-*.png files in {stills_dir}, found {len(still_paths)}")

    # Inspect shot-01.png dimensions to size synthetic reference frames identically.
    with Image.open(still_paths[0]) as im0:
        width, height = im0.size

    # Step 4 gate: run synthetic self-tests BEFORE measuring any still.
    calibration = run_self_tests(height, width)
    flat_ours = calibration["synthetic_flat_drift"]["flat_ours"]
    print(
        f"[SELF-TEST PASS] syn_a E_tex={calibration['synthetic_flat_rgb']['texture_energy']:.6f}, "
        f"proxy_props={calibration['synthetic_flat_rgb']['proxy_props']}; "
        f"syn_b E_tex={flat_ours:.6f}, "
        f"raw_linear={calibration['synthetic_flat_drift']['raw_linear_grad']:.7f}"
    )

    # Measure all 26 stills in strict lexicographical order.
    raw_results = []
    for path in still_paths:
        shot_id = path.stem
        with Image.open(path) as im:
            rgb_uint8 = np.asarray(im.convert("RGB"), dtype=np.uint8)
        if rgb_uint8.shape != (height, width, 3):
            raise RuntimeError(
                f"Unexpected shape for {path}: {rgb_uint8.shape} vs {(height, width, 3)}"
            )

        prop_res = compute_proxy_props(rgb_uint8)
        tex_res = compute_texture_energy(rgb_uint8)
        raw_results.append(
            {
                "shot_id": shot_id,
                "proxy_props": int(prop_res["proxy_props"]),
                "num_raw_components": int(prop_res["num_raw_components"]),
                "num_after_min_area": int(prop_res["num_after_min_area"]),
                "num_after_bg_exclusion": int(prop_res["num_after_bg_exclusion"]),
                "raw_linear_grad": float(tex_res["raw_linear_grad"]),
                "texture_energy": float(tex_res["texture_energy"]),
            }
        )

    # Hand-count bias calibration across audited shots 02, 13, 22.
    by_id = {r["shot_id"]: r for r in raw_results}
    audited_ids = ("shot-02", "shot-13", "shot-22")
    biases = [by_id[sid]["proxy_props"] - HAND_COUNTS[sid] for sid in audited_ids]
    mean_bias = float(sum(biases) / 3.0)
    median_bias = float(np.median(np.asarray(biases, dtype=np.float64)))
    mean_ratio = float(
        sum(HAND_COUNTS[sid] / float(max(by_id[sid]["proxy_props"], 1)) for sid in audited_ids)
        / 3.0
    )

    per_audited_shot = {}
    for sid in audited_ids:
        proxy_val = by_id[sid]["proxy_props"]
        hand_val = HAND_COUNTS[sid]
        per_audited_shot[sid] = {
            "proxy_props": proxy_val,
            "hand_props": hand_val,
            "prop_bias": proxy_val - hand_val,
            "formula_corrected_props": max(0.0, round(proxy_val - mean_bias, 2)),
        }

    hand_cal = {
        "hand_counts": dict(HAND_COUNTS),
        "hand_inventories": dict(HAND_INVENTORIES),
        "per_audited_shot": per_audited_shot,
        "mean_bias": mean_bias,
        "median_bias": median_bias,
        "mean_ratio": mean_ratio,
    }

    # Apply pre-registered scoring rules (§5.1).
    shot_records = []
    for r in raw_results:
        sid = r["shot_id"]
        proxy_val = r["proxy_props"]
        is_audited = sid in HAND_COUNTS
        hand_val = HAND_COUNTS[sid] if is_audited else None
        bias_val = (proxy_val - hand_val) if is_audited else None
        formula_corr = max(0.0, round(proxy_val - mean_bias, 2))
        corrected_val = float(hand_val) if is_audited else formula_corr

        # F1 gate (corrected 2026-11-16): hand counts ONLY. The proxy and its
        # bias-corrected estimate are informational measurements, never a
        # gate; non-audited shots earn no per-shot F1 verdict.
        if is_audited:
            f1_pass = "PASS" if float(hand_val) >= F1_FLOOR else "FAIL"
        else:
            f1_pass = "N/A"

        e_tex = r["texture_energy"]
        tex_ratio = e_tex / flat_ours
        # F2 gate (corrected 2026-11-16): raw texture_energy >= 0.45 ONLY.
        # tex_ratio stays a reported measurement; it is not a gate.
        f2_pass = "PASS" if e_tex >= F2_RAW_REF else "FAIL"
        if f1_pass == "N/A":
            overall_pass = "N/A"
        else:
            overall_pass = "PASS" if (f1_pass == "PASS" and f2_pass == "PASS") else "FAIL"

        rec = {
            "shot_id": sid,
            "proxy_props": proxy_val,
            "hand_props": hand_val,
            "prop_bias": bias_val,
            "corrected_props": round(corrected_val, 2),
            "formula_corrected_props": formula_corr,
            "f1_pass": f1_pass,
            "raw_linear_grad": round(r["raw_linear_grad"], 6),
            "texture_energy": round(e_tex, 4),
            "tex_ratio": round(tex_ratio, 4),
            "raw_linear_grad_full": r["raw_linear_grad"],
            "texture_energy_full": e_tex,
            "tex_ratio_full": tex_ratio,
            "f2_pass": f2_pass,
            "overall_pass": overall_pass,
            "num_raw_components": r["num_raw_components"],
            "num_after_min_area": r["num_after_min_area"],
            "num_after_bg_exclusion": r["num_after_bg_exclusion"],
        }
        shot_records.append(rec)

    num_shots = len(shot_records)
    agg_stats = {
        "proxy_props": _compute_stats([r["proxy_props"] for r in shot_records]),
        "corrected_props": _compute_stats([r["corrected_props"] for r in shot_records]),
        "raw_linear_grad": _compute_stats([r["raw_linear_grad_full"] for r in shot_records]),
        "texture_energy": _compute_stats([r["texture_energy_full"] for r in shot_records]),
        "tex_ratio": _compute_stats([r["tex_ratio_full"] for r in shot_records]),
    }

    f1_audited_count = sum(1 for r in shot_records if r["f1_pass"] != "N/A")
    f1_pass_count = sum(1 for r in shot_records if r["f1_pass"] == "PASS")
    f2_pass_count = sum(1 for r in shot_records if r["f2_pass"] == "PASS")
    overall_pass_count = sum(1 for r in shot_records if r["overall_pass"] == "PASS")

    pass_counts = {
        "f1_audited_count": f1_audited_count,
        "f1_pass_count": f1_pass_count,
        "f1_pass_pct": 100.0 * f1_pass_count / float(f1_audited_count),
        "f2_pass_count": f2_pass_count,
        "f2_pass_pct": 100.0 * f2_pass_count / float(num_shots),
        "overall_pass_count": overall_pass_count,
        "overall_pass_pct": 100.0 * overall_pass_count / float(f1_audited_count),
    }

    import PIL

    payload = {
        "metadata": {
            "script": "scripts/qa/env_richness.py",
            "plan": "plan_p2c.md",
            "python_version": platform.python_version(),
            "numpy_version": np.__version__,
            "pil_version": PIL.__version__,
            "seed": 0,
            "image_dimensions": {"height": height, "width": width},
            "num_shots": num_shots,
            "floors": {
                "f1_hand_props_min": F1_FLOOR,
                "f2_texture_energy_raw_min": F2_RAW_REF,
            },
        },
        "synthetic_calibration": calibration,
        "hand_count_calibration": hand_cal,
        "shots": shot_records,
        "aggregate_statistics": {
            "metrics": agg_stats,
            "pass_counts": pass_counts,
        },
    }

    json_path = out_dir / "env_richness.json"
    csv_path = out_dir / "env_richness.csv"
    md_path = out_dir / "env_richness_summary.md"

    json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    _write_csv(csv_path, shot_records)
    _write_markdown(
        md_path,
        calibration=calibration,
        hand_cal=hand_cal,
        shot_records=shot_records,
        agg_stats=agg_stats,
        pass_counts=pass_counts,
        num_shots=num_shots,
    )

    print(
        f"[DONE] Wrote {json_path}, {csv_path}, {md_path} | "
        f"F1={f1_pass_count}/{f1_audited_count} audited, F2={f2_pass_count}/{num_shots}, "
        f"Overall={overall_pass_count}/{f1_audited_count} audited"
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        sys.exit(1)
