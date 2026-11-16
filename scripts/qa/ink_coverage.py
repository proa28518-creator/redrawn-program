#!/usr/bin/env python3
"""Ink pixel coverage and A/B contrast measurement for Phase 6 (Bars d & e).

Implements the exact pre-registered ink-pixel predicate from plan_p6.md Section 6(d):
For 8-bit sRGB channels (R, G, B) in [0, 255]:
  1. Y = 0.2126 * R + 0.7152 * G + 0.0722 * B <= 45.0
  2. max(R, G, B) <= 62
  3. G <= B + 4

Verifies each input PNG is 1080x1920, prints per-frame ink pixel count, coverage %,
and mean CIE L*, and (when --raw-dir is given) compares against matching raw frames
for Bar (e) (absolute drop >= 1.50 pp AND raw <= 0.45 * with).
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

EXPECTED_WIDTH = 1080
EXPECTED_HEIGHT = 1920
TOTAL_PIXELS = EXPECTED_WIDTH * EXPECTED_HEIGHT


def natural_frame_key(path: Path) -> tuple[int, str]:
    """Sort frame files numerically by embedded frame index when present."""
    match = re.search(r"(\d+)", path.stem)
    return (int(match.group(1)) if match else 10**9, path.name)


def collect_pngs(inputs: list[str]) -> list[Path]:
    """Expand file and directory inputs into a sorted list of PNG paths."""
    paths: list[Path] = []
    for raw in inputs:
        p = Path(raw)
        if p.is_dir():
            paths.extend(sorted(p.glob("*.png"), key=natural_frame_key))
        elif p.is_file():
            paths.append(p)
        else:
            raise FileNotFoundError(f"Input path not found: {raw}")
    return paths


def compute_mean_lstar(rgb_u8: np.ndarray) -> float:
    """Compute mean D65 CIE L* from uint8 RGB image array."""
    srgb = rgb_u8.astype(np.float64) / 255.0
    lin = np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)
    y = lin @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float64)
    eps = 216.0 / 24389.0
    f = np.where(y > eps, np.cbrt(y), (24389.0 / 27.0 * y + 16.0) / 116.0)
    lstar = 116.0 * f - 16.0
    return float(np.mean(lstar))


def measure_png(path: Path) -> tuple[int, float, float]:
    """Verify 1080x1920 and return (ink_px, coverage_pct, mean_lstar)."""
    with Image.open(path) as img:
        if img.size != (EXPECTED_WIDTH, EXPECTED_HEIGHT):
            raise ValueError(
                f"{path}: expected {EXPECTED_WIDTH}x{EXPECTED_HEIGHT}, got {img.size[0]}x{img.size[1]}"
            )
        rgb = np.asarray(img.convert("RGB"), dtype=np.uint8)

    r = rgb[:, :, 0].astype(np.float64)
    g = rgb[:, :, 1].astype(np.float64)
    b = rgb[:, :, 2].astype(np.float64)

    y_srgb = 0.2126 * r + 0.7152 * g + 0.0722 * b
    max_rgb = np.maximum(np.maximum(rgb[:, :, 0], rgb[:, :, 1]), rgb[:, :, 2])
    ink_mask = (y_srgb <= 45.0) & (max_rgb <= 62) & (rgb[:, :, 1].astype(np.int16) <= rgb[:, :, 2].astype(np.int16) + 4)

    ink_px = int(np.count_nonzero(ink_mask))
    coverage_pct = 100.0 * ink_px / TOTAL_PIXELS
    mean_lstar = compute_mean_lstar(rgb)
    return ink_px, coverage_pct, mean_lstar


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse CLI arguments."""
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("inputs", nargs="+", help="PNG file(s) or directory of PNG stills (with ink)")
    parser.add_argument("--raw-dir", default=None, help="Directory of matching raw PNG stills for Bar (e)")
    parser.add_argument("--min-coverage", type=float, default=2.50, help="Minimum ink coverage %% per frame (default: 2.50)")
    parser.add_argument("--min-drop", type=float, default=1.50, help="Minimum A/B absolute drop in pp (default: 1.50)")
    parser.add_argument("--max-ratio", type=float, default=0.45, help="Maximum raw/with coverage ratio (default: 0.45)")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint."""
    args = parse_args(argv)
    try:
        files = collect_pngs(args.inputs)
    except FileNotFoundError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    if not files:
        print("ERROR: no PNG files found in inputs", file=sys.stderr)
        return 2

    raw_dir = Path(args.raw_dir) if args.raw_dir else None
    if raw_dir is not None and not raw_dir.is_dir():
        print(f"ERROR: --raw-dir is not a directory: {raw_dir}", file=sys.stderr)
        return 2

    all_pass = True

    if raw_dir is None:
        print("| Frame | Ink px | Coverage % | Mean L* | Bar (d) |")
        print("| :--- | ---: | ---: | ---: | :---: |")
    else:
        print("| Frame | With px | With % | With L* | Raw px | Raw % | Raw L* | Drop (pp) | Raw/With | Status |")
        print("| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :---: |")

    for path in files:
        try:
            with_px, with_cov, with_l = measure_png(path)
        except Exception as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 2

        d_pass = with_cov >= args.min_coverage

        if raw_dir is None:
            status = "PASS" if d_pass else "FAIL"
            if not d_pass:
                all_pass = False
            print(f"| {path.name} | {with_px} | {with_cov:.3f}% | {with_l:.2f} | {status} |")
        else:
            raw_path = raw_dir / path.name
            if not raw_path.is_file():
                print(f"ERROR: missing matching raw still {raw_path}", file=sys.stderr)
                return 2
            try:
                raw_px, raw_cov, raw_l = measure_png(raw_path)
            except Exception as exc:
                print(f"ERROR: {exc}", file=sys.stderr)
                return 2

            drop_pp = with_cov - raw_cov
            ratio = (raw_cov / with_cov) if with_cov > 0.0 else float("inf")
            e_pass = (drop_pp >= args.min_drop) and (raw_cov <= args.max_ratio * with_cov)
            row_pass = d_pass and e_pass
            if not row_pass:
                all_pass = False
            status = "PASS" if row_pass else "FAIL"
            print(
                f"| {path.name} | {with_px} | {with_cov:.3f}% | {with_l:.2f} | "
                f"{raw_px} | {raw_cov:.3f}% | {raw_l:.2f} | {drop_pp:.3f} | {ratio:.4f} | {status} |"
            )

    print(f"\nOVERALL: {'PASS' if all_pass else 'FAIL'} ({len(files)} frame(s) checked)")
    return 0 if all_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())
