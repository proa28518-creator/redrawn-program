#!/usr/bin/env python3
"""One-frame flicker and stride detector for rendered videos.

Usage:
    python3 scripts/qa/flicker.py VIDEO [--threshold 4.0] [--ffmpeg ffmpeg] [--fps 30.0] [--top 10]

Decodes the video to 64x36 grayscale frames, computes mean luma on a 4x3 tile grid
(12 tiles per frame), and flags frames whose luma spikes relative to both immediate
neighbors while those neighbors agree with each other. Reports 1-based frame numbers
(array index + 1) and tests modulo strides k=2..16 to detect repeating render-tab
defects (exiting with code 3 when a stride pattern is found, 0 otherwise).

Common Causes of Render Flicker:
    - A broken render tab losing GL state under GPU overload (frames drawn darker or
      unlit, repeating with the tab concurrency stride).
    - A shadow camera projected only once per tab (causing a region to appear brighter
      in one render tab only).
    - Coplanar surfaces and z-fighting between overlapping meshes or ground/wall planes.
    - Sub-pixel geometry inked as unstable dashed or dotted lines.
    - Camera drift combined with screen-space grain/wobble on held shots.

Preventive Fixes:
    - Make every frame a pure function of the frame number: avoid Math.random, Date,
      performance.now, history, or accumulated physics; derive all state from t = frame / fps.
    - Use seeded hashes instead of random numbers.
    - Update shadow projection matrices on every render.
    - Bound caches and key them by content rather than object ID.
    - Run a single render process when needed and run this stride check after each render.
"""

from __future__ import annotations

import argparse
import subprocess
import sys

import numpy as np

WIDTH = 64
HEIGHT = 36


def tiles(path: str, ff: str) -> np.ndarray:
    """Decode video to 64x36 grayscale via ffmpeg and return (N, 12) 4x3 tile lumas."""
    proc = subprocess.run(
        [ff, "-v", "error", "-i", path, "-vf", f"scale={WIDTH}:{HEIGHT},format=gray", "-f", "rawvideo", "-"],
        capture_output=True,
    )
    if proc.returncode != 0:
        err = proc.stderr.decode(errors="replace").strip()[-300:]
        sys.exit(f"ffmpeg could not read {path} (exit {proc.returncode}): {err}")
    frames = np.frombuffer(proc.stdout, dtype=np.uint8).reshape(-1, HEIGHT, WIDTH).astype(np.float32)
    n = len(frames)
    return frames.reshape(n, 3, HEIGHT // 3, 4, WIDTH // 4).mean(axis=(2, 4)).reshape(n, 12)


def spikes(y: np.ndarray, th: float) -> tuple[np.ndarray, np.ndarray]:
    """Detect one-frame luma spikes and return (1-based bad_indices, per-frame score)."""
    a = y[:-2]
    b = y[1:-1]
    c = y[2:]
    spike = np.minimum(np.abs(b - a), np.abs(b - c))
    cons = np.abs(a - c)
    hit = (spike > th) & (cons < spike * 0.35)
    score = (spike - 0.5 * cons).max(axis=1)
    # b starts at internal 0-based index 1, so printed 1-based frame number is hit_idx + 2.
    bad_indices = np.where(hit.any(axis=1))[0] + 2
    return bad_indices, score


def stride(bad: np.ndarray, n: int) -> tuple[int, int, int] | None:
    """Find strongest repeating stride (k, residue, hits) for k in 2..16, or None."""
    if len(bad) == 0:
        return None
    best: tuple[int, int, int] | None = None
    for k in range(2, 17):
        cnt = np.bincount(bad % k, minlength=k)
        r = int(np.argmax(cnt))
        hits = int(cnt[r])
        frames_on_residue = (n - r + k - 1) // k
        other_avg = (int(cnt.sum()) - hits) / max(1, k - 1)
        if hits >= 5 and hits >= np.sqrt(frames_on_residue) and hits > 2.5 * other_avg:
            if best is None or hits > best[2]:
                best = (k, r, hits)
    return best


def main() -> None:
    """CLI entry point for the flicker detector."""
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("video", help="Path to input video file")
    parser.add_argument("--threshold", type=float, default=4.0, help="Luma change (0-255) that counts as a spike")
    parser.add_argument("--ffmpeg", default="ffmpeg", help="Path or name of ffmpeg binary")
    parser.add_argument("--fps", type=float, default=30.0, help="Frame rate used to format timestamps")
    parser.add_argument("--top", type=int, default=10, help="How many strongest odd-one-out frames to list")
    args = parser.parse_args()

    y = tiles(args.video, args.ffmpeg)
    bad, score = spikes(y, args.threshold)
    st = stride(bad, len(y))

    print(f"{args.video}: {len(y)} frames, {len(bad)} spikes; stride pattern: {st}")
    if len(bad) > 0:
        shown = " ".join(str(int(f)) for f in bad[:200])
        suffix = " ..." if len(bad) > 200 else ""
        print(f"spike frames: {shown}{suffix}")

    order = np.argsort(-score)[: args.top]
    top_str = ", ".join(
        f"({int(idx) + 2}, {(int(idx) + 2) / args.fps:.2f}, {score[idx]:.1f})"
        for idx in order
    )
    print(f"strongest odd-one-out frames (frame, time s, score): {top_str}")
    sys.exit(3 if st else 0)


if __name__ == "__main__":
    main()
