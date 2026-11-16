#!/usr/bin/env python3
"""Pacing analyzer for inkbeat Phase 2 Workstream B (scripts/qa/pacing.py).

Computes frame-to-frame motion pacing metrics (change10, camera beats, still/fast
shares, longest consecutive still run), ffmpeg scene-score hard cuts, and D65
CIE L* luminance statistics from an input video.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np

SIZE_RE = re.compile(r"^(\d+)x(\d+)$")
SCENE_SCORE_RE = re.compile(r"lavfi\.scene_score=([0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)")


def parse_size(size_str: str) -> tuple[int, int]:
    """Parse a WxH string into (width, height) positive integers."""
    match = SIZE_RE.match(size_str.strip())
    if not match:
        raise argparse.ArgumentTypeError(f"Invalid --size '{size_str}'; expected WxH (e.g. 180x320)")
    width, height = int(match.group(1)), int(match.group(2))
    if width <= 0 or height <= 0:
        raise argparse.ArgumentTypeError(f"Invalid --size '{size_str}'; dimensions must be > 0")
    return width, height


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse and validate CLI arguments."""
    parser = argparse.ArgumentParser(
        description="Analyze video pacing, camera beats, hard cuts, and CIE L* luminance."
    )
    parser.add_argument("video", help="Path to input video file")
    parser.add_argument(
        "--json",
        dest="json_path",
        default=None,
        metavar="PATH",
        help="Write full JSON metrics report to PATH",
    )
    parser.add_argument(
        "--fps",
        type=float,
        default=30.0,
        help="Reference frame rate in frames/second (default: 30)",
    )
    parser.add_argument(
        "--size",
        type=str,
        default="180x320",
        help="Decode dimensions as WxH (default: 180x320)",
    )
    parser.add_argument(
        "--ffmpeg",
        type=str,
        default="ffmpeg",
        help="Path or binary name for ffmpeg (default: ffmpeg)",
    )
    args = parser.parse_args(argv)
    if args.fps <= 0:
        parser.error("--fps must be > 0")
    args.width, args.height = parse_size(args.size)
    return args


def resolve_ffmpeg(ffmpeg_bin: str) -> str | None:
    """Return resolved executable path for ffmpeg_bin, or None if unavailable."""
    if os.path.sep in ffmpeg_bin:
        return ffmpeg_bin if os.path.isfile(ffmpeg_bin) and os.access(ffmpeg_bin, os.X_OK) else None
    return shutil.which(ffmpeg_bin)


def decode_rgb_frames(video_path: str, width: int, height: int, ffmpeg_bin: str) -> np.ndarray:
    """Decode video to raw RGB24 frames of shape (N, height, width, 3) uint8."""
    cmd = [
        ffmpeg_bin,
        "-v",
        "error",
        "-i",
        video_path,
        "-vf",
        f"scale={width}:{height}",
        "-pix_fmt",
        "rgb24",
        "-f",
        "rawvideo",
        "-",
    ]
    proc = subprocess.run(cmd, capture_output=True, check=False)
    if proc.returncode != 0:
        stderr_text = proc.stderr.decode("utf-8", errors="replace").strip()
        print(f"ffmpeg decode error (exit {proc.returncode}): {stderr_text}", file=sys.stderr)
        raise SystemExit(3)

    frame_bytes = width * height * 3
    raw_len = len(proc.stdout)
    if raw_len == 0 or raw_len % frame_bytes != 0:
        print(
            f"Unexpected rawvideo byte count {raw_len} (not a positive multiple of {frame_bytes})",
            file=sys.stderr,
        )
        raise SystemExit(3)

    return np.frombuffer(proc.stdout, dtype=np.uint8).reshape(-1, height, width, 3)


def compute_change10_and_beats(frames: np.ndarray, fps: float) -> dict:
    """Compute smoothed change10, greedy beats, still/fast fractions, and longest still run."""
    n_frames = frames.shape[0]
    g = frames[:, ::4, ::4].astype(np.float32) @ np.array([0.299, 0.587, 0.114], dtype=np.float32)

    d = np.zeros(n_frames, dtype=np.float64)
    d[10:] = np.mean(np.abs(g[10:] - g[:-10]), axis=(1, 2))
    ds = np.convolve(d, np.ones(5, dtype=np.float64) / 5.0, mode="same")

    candidates = [
        i
        for i in range(1, n_frames - 1)
        if ds[i] >= ds[i - 1] and ds[i] > ds[i + 1] and ds[i] > 20.0
    ]
    candidates.sort(key=lambda i: (-ds[i], i))

    selected: list[int] = []
    for p in candidates:
        if all(abs(p - q) >= 12 for q in selected):
            selected.append(p)

    beat_frames = sorted(max(0, p - 5) for p in selected)
    beat_times_s = [round(b / fps, 3) for b in beat_frames]

    dur = n_frames / fps
    n_buckets = math.ceil(dur / 10.0)
    beats_per_10s = [
        sum(1 for b in beat_frames if k * 10.0 <= b / fps < (k + 1) * 10.0)
        for k in range(n_buckets)
    ]

    ds_valid = ds[10:]
    frac_still_raw = float((ds_valid < 8.0).mean())
    frac_fast_raw = float((ds_valid > 35.0).mean())

    best_len = 0
    best_start: int | None = None
    best_end: int | None = None
    cur_len = 0
    cur_start = 0

    for idx in range(10, n_frames):
        if ds[idx] < 8.0:
            if cur_len == 0:
                cur_start = idx
            cur_len += 1
            if cur_len > best_len:
                best_len = cur_len
                best_start = cur_start
                best_end = idx
        else:
            cur_len = 0

    return {
        "frames": int(n_frames),
        "duration_s": round(dur, 3),
        "beats": len(beat_frames),
        "beats_per_min": round(len(beat_frames) / (dur / 60.0), 2),
        "beats_per_10s": beats_per_10s,
        "frac_still": round(frac_still_raw, 4),
        "frac_fast": round(frac_fast_raw, 4),
        "pct_still": round(frac_still_raw * 100.0, 2),
        "pct_fast": round(frac_fast_raw * 100.0, 2),
        "beat_times_s": beat_times_s,
        "beat_frames": beat_frames,
        "longest_still_run_frames": int(best_len),
        "longest_still_run_s": round(best_len / fps, 3),
        "longest_still_run_start_frame": best_start,
        "longest_still_run_end_frame": best_end,
        "change10_note": (
            "ds computed over N frames with d[:10]=0; "
            "frac_still/frac_fast/longest_still_run evaluated over ds[10:]"
        ),
    }


def detect_hard_cuts(video_path: str, n_frames: int, fps: float, ffmpeg_bin: str) -> dict:
    """Extract lavfi.scene_score per frame via ffmpeg metadata=print and threshold > 0.3."""
    cmd = [
        ffmpeg_bin,
        "-nostats",
        "-i",
        video_path,
        "-vf",
        "select='gte(scene,0)',metadata=print",
        "-f",
        "null",
        "-",
    ]
    proc = subprocess.run(cmd, capture_output=True, check=False)
    if proc.returncode != 0:
        stderr_text = proc.stderr.decode("utf-8", errors="replace").strip()
        print(f"ffmpeg scene detection error (exit {proc.returncode}): {stderr_text}", file=sys.stderr)
        raise SystemExit(3)

    stderr_text = proc.stderr.decode("utf-8", errors="replace")
    parsed_scores = [float(m.group(1)) for m in SCENE_SCORE_RE.finditer(stderr_text)]

    scores = np.zeros(n_frames, dtype=np.float64)
    count = min(n_frames, len(parsed_scores))
    if count > 0:
        scores[:count] = parsed_scores[:count]

    cut_frames = [i for i in range(1, n_frames) if scores[i] > 0.3]
    cut_times_s = [round(c / fps, 3) for c in cut_frames]
    return {
        "hard_cuts": len(cut_frames),
        "cut_times_s": cut_times_s,
        "cut_frames": cut_frames,
    }


def lstar(rgb: np.ndarray) -> np.ndarray:
    """Compute CIE L* (D65, sRGB) for an uint8 RGB image array."""
    srgb = rgb.astype(np.float64) / 255.0
    lin = np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)
    y = lin @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float64)
    eps = 216.0 / 24389.0
    f = np.where(y > eps, np.cbrt(y), (24389.0 / 27.0 * y + 16.0) / 116.0)
    return 116.0 * f - 16.0


def compute_lstar_stats(frames: np.ndarray) -> dict:
    """Compute per-frame mean CIE L* over f[::2, ::2] and return mean, p5, p95."""
    frame_l = np.array([float(lstar(f[::2, ::2]).mean()) for f in frames], dtype=np.float64)
    return {
        "L_mean": round(float(np.mean(frame_l)), 2),
        "L_p5": round(float(np.percentile(frame_l, 5)), 2),
        "L_p95": round(float(np.percentile(frame_l, 95)), 2),
    }


def analyze_video(video_path: str, width: int, height: int, fps: float, ffmpeg_bin: str) -> dict:
    """Run full pacing, hard-cut, and CIE L* analysis on video_path."""
    frames = decode_rgb_frames(video_path, width, height, ffmpeg_bin)
    if frames.shape[0] < 15:
        print(
            f"Too few frames decoded ({frames.shape[0]} < 15 required for 10-frame lag + 5-frame smoothing)",
            file=sys.stderr,
        )
        raise SystemExit(4)

    pacing = compute_change10_and_beats(frames, fps)
    cuts = detect_hard_cuts(video_path, frames.shape[0], fps, ffmpeg_bin)
    lum = compute_lstar_stats(frames)

    return {
        "frames": pacing["frames"],
        "duration_s": pacing["duration_s"],
        "beats": pacing["beats"],
        "beats_per_min": pacing["beats_per_min"],
        "beats_per_10s": pacing["beats_per_10s"],
        "frac_still": pacing["frac_still"],
        "frac_fast": pacing["frac_fast"],
        "pct_still": pacing["pct_still"],
        "pct_fast": pacing["pct_fast"],
        "hard_cuts": cuts["hard_cuts"],
        "cut_times_s": cuts["cut_times_s"],
        "cut_frames": cuts["cut_frames"],
        "L_mean": lum["L_mean"],
        "L_p5": lum["L_p5"],
        "L_p95": lum["L_p95"],
        "beat_times_s": pacing["beat_times_s"],
        "beat_frames": pacing["beat_frames"],
        "longest_still_run_frames": pacing["longest_still_run_frames"],
        "longest_still_run_s": pacing["longest_still_run_s"],
        "longest_still_run_start_frame": pacing["longest_still_run_start_frame"],
        "longest_still_run_end_frame": pacing["longest_still_run_end_frame"],
        "change10_note": pacing["change10_note"],
    }


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint."""
    args = parse_args(argv)
    if not os.path.isfile(args.video):
        print(f"Input video not found: {args.video}", file=sys.stderr)
        return 2

    resolved_ffmpeg = resolve_ffmpeg(args.ffmpeg)
    if not resolved_ffmpeg:
        print(f"ffmpeg binary not found or not executable: {args.ffmpeg}", file=sys.stderr)
        return 2

    result = analyze_video(args.video, args.width, args.height, args.fps, resolved_ffmpeg)

    if args.json_path:
        out_path = Path(args.json_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")

    summary = {k: v for k, v in result.items() if k != "beat_times_s"}
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
