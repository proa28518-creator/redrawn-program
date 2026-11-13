# Motion check (Layla's office report, suggestion D): flicker + drift on a motion
# test video. Opus 5.5 authored; one correction by رورو: mad[k] is the change INTO
# video frame k+1, so the flicker report prints frame i+1, not i (off by one).
# "motion:check": "python3 scripts/motion-check.py out/bridge/test-30f.mp4"
import sys
import os
import subprocess
import tempfile
import shutil
import numpy as np
from PIL import Image

def main():
    video = sys.argv[1] if len(sys.argv) > 1 else "out/bridge/test-30f.mp4"
    if not os.path.exists(video):
        print(f"MOTION CHECK: video not found: {video}")
        sys.exit(1)

    tmp_dir = tempfile.mkdtemp()
    try:
        cmd = ["ffmpeg", "-y", "-v", "error", "-i", video, os.path.join(tmp_dir, "f_%04d.png")]
        if subprocess.run(cmd).returncode != 0:
            print("MOTION CHECK: ffmpeg extraction failed")
            sys.exit(1)

        files = sorted([os.path.join(tmp_dir, f) for f in os.listdir(tmp_dir) if f.endswith(".png")])
        if len(files) < 3:
            print(f"MOTION CHECK: too few frames ({len(files)})")
            sys.exit(1)

        frames = []
        for f in files:
            img = Image.open(f).convert('L')
            frames.append(np.array(img, dtype=np.float32) / 255.0)

        mad = []
        for i in range(1, len(frames)):
            diff = np.abs(frames[i] - frames[i-1])
            mad.append(np.mean(diff))

        print("MAD:", " ".join(f"{v:.4f}" for v in mad))

        failed = False
        # Flicker — a one-frame flash produces TWO equal spikes (in and out), so the
        # immediate neighbours cannot be the baseline: each spike's neighbour includes
        # the paired spike and the 3x test never fires (measured: two 0.8784 spikes,
        # neighbour mean 0.4392, 0.8784 < 3*0.4392). The baseline is therefore the
        # median of the four values at distance 2 (i-2, i-1, i+2, i+3), which excludes
        # the paired return spike at i+1; after a flag the return spike is skipped so
        # one flash is one report. The local-max test uses only the PREVIOUS neighbour
        # for the same reason.
        i = 1
        while i < len(mad) - 1:
            neigh_vals = [mad[j] for j in (i - 2, i - 1, i + 2, i + 3) if 0 <= j < len(mad)]
            if len(neigh_vals) >= 2:
                neigh = float(np.median(neigh_vals))
                if mad[i] > 3 * neigh and mad[i] > 0.02 and mad[i] >= mad[i - 1]:
                    print(f"FLICKER: frame {i + 1} mad {mad[i]:.4f} (neighbours {neigh:.4f})")
                    failed = True
                    i += 2
                    continue
            i += 1

        # Drift
        if len(mad) >= 20:
            window_means = [np.mean(mad[i:i+10]) for i in range(len(mad) - 9)]
            run_start = None
            for i in range(1, len(window_means)):
                if window_means[i] > window_means[i-1]:
                    if run_start is None: run_start = i - 1
                    if i - run_start >= 9:
                        if window_means[i] >= 2 * window_means[run_start]:
                            print(f"DRIFT: frames {run_start}-{i+9} window-mean rose {window_means[run_start]:.4f} -> {window_means[i]:.4f}")
                            failed = True
                            run_start = None
                else:
                    run_start = None

        if failed:
            print("MOTION CHECK: FAIL")
            sys.exit(1)
        else:
            print("MOTION CHECK: PASS")
            sys.exit(0)

    finally:
        shutil.rmtree(tmp_dir)

if __name__ == "__main__":
    main()