"""checks.py: frame checks over rendered frame folders (jpg or png frames named like f00123.jpg). numpy + PIL only.

  python checks.py same <before dir> <after dir> [--boxes boxes.json] [--tol 0]
      pixel identity frame by frame (and inside each face box if given): max difference, share of pixels over 8 levels,
      worst frames. OK when no pixel differs by more than --tol levels (0 = identical).
  python checks.py calm <dir> [--cuts f,f,...] [--still a-b,a-b] [--boxes boxes.json] [--thresh 4] [--grid 4x6]
      light jumps while the camera is still: mean luma of each region (grid cells, or the face boxes) frame to frame,
      only inside the --still frame ranges (default: all frames), never across a cut. OK when the worst jump <= --thresh.
  python checks.py flicker <dir> [--cuts f,f,...] [--thresh 5]
      mean luma of each frame on a 54x96 thumbnail, jumps over --thresh levels that are not on a cut (a cut = the frame
      itself or one either side). Also the mean jump over the whole folder. OK when there is none.
  python checks.py face <dir> --boxes boxes.json [--ref <dir>] [--thresh 6] [--tol 8]
      per character, luma and contrast inside its face box per frame, jumps between neighbouring frames (not across a
      cut) over --thresh; with --ref, the same boxes in a reference folder: max pixel difference over --tol fails.

boxes.json: [ { "frame": 120, "who": "Lena", "box": [x0, y0, x1, y1] }, ... ] in pixels of the frame, y down.
Frame numbers are the digits in the file name. Luma = PIL's L (ITU-R 601). Levels are of 255.
Each command prints a short report and ends with a line "OK" or "FAIL: <why>"; the exit code is 0 or 1.
"""
import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def frames_of(d):
    """{frame number: path} for every jpg / png in a folder (or its frames/ subfolder)."""
    d = Path(d)
    if (d / 'frames').is_dir():
        d = d / 'frames'
    if not d.is_dir():
        sys.exit(f'FAIL: no such folder: {d}')
    out = {}
    for p in d.iterdir():
        if p.suffix.lower() in ('.jpg', '.jpeg', '.png'):
            m = re.findall(r'\d+', p.stem)
            if m:
                out[int(m[-1])] = p
    if not out:
        sys.exit(f'FAIL: no frames (jpg or png with a number in the name) in {d}')
    return dict(sorted(out.items()))


def cut_set(s):
    return {int(x) for x in s.split(',') if x.strip()} if s else set()


def ranges(s):
    out = []
    for part in (s or '').split(','):
        if '-' in part:
            a, b = part.split('-')
            out.append((int(a), int(b)))
    return out


def load_boxes(p):
    data = json.loads(Path(p).read_text(encoding='utf-8'))
    for b in data:
        if not {'frame', 'who', 'box'} <= set(b):
            sys.exit('FAIL: every box needs frame, who and box: ' + json.dumps(b))
    return data


def across_cut(a, b, cuts):
    """True when a cut lies between frame a and frame b (a cut at f means f is the first frame of the new shot)."""
    return any(a < c <= b for c in cuts)


def luma(p, size=None):
    im = Image.open(p).convert('L')
    if size:
        im = im.resize(size, Image.BILINEAR)
    return np.asarray(im, np.float32)


def rgb(p):
    return np.asarray(Image.open(p).convert('RGB'), np.int16)


def pct_line(name, vals, unit=''):
    if not vals:
        return f'{name}: nothing measured'
    v = sorted(vals, reverse=True)
    n = len(v)
    return f'{name}: worst {v[0][0]:.2f}{unit} at f{v[0][1]}' + (f' {v[0][2]}' if len(v[0]) > 2 else '') + \
        f', 99% {v[n // 100][0]:.2f}, 90% {v[n // 10][0]:.2f}, median {v[n // 2][0]:.2f}, n {n}'


def finish(problems):
    if problems:
        print('FAIL: ' + '; '.join(problems))
        sys.exit(1)
    print('OK')
    sys.exit(0)


# ------------------------------------------------------------------------------------------------ same
def cmd_same(a):
    A, B = frames_of(a.before), frames_of(a.after)
    common = sorted(set(A) & set(B))
    problems = []
    only_a, only_b = sorted(set(A) - set(B)), sorted(set(B) - set(A))
    if only_a or only_b:
        problems.append(f'frame lists differ ({len(only_a)} only before, {len(only_b)} only after, e.g. {(only_a + only_b)[:5]})')
    if not common:
        finish(problems + ['no frame in both folders'])
    rows = []
    for f in common:
        x, y = rgb(A[f]), rgb(B[f])
        if x.shape != y.shape:
            problems.append(f'f{f}: sizes differ {x.shape[1]}x{x.shape[0]} vs {y.shape[1]}x{y.shape[0]}')
            continue
        d = np.abs(x - y).max(axis=2)
        rows.append((int(d.max()), f, float((d > 8).mean() * 100)))
    rows.sort(reverse=True)
    worst = rows[0][0] if rows else 0
    print(f'{len(common)} frames compared; max difference {worst} levels; frames with any difference '
          f'{sum(1 for r in rows if r[0] > 0)}; most pixels over 8 levels in one frame {max((r[2] for r in rows), default=0):.3f} %')
    print('worst frames: ' + ', '.join(f'f{f} max {m} ({p:.3f} % over 8)' for m, f, p in rows[:6]))
    if worst > a.tol:
        problems.append(f'pixels differ by up to {worst} levels (allowed {a.tol}), worst f{rows[0][1]}')
    if a.boxes:
        boxes = load_boxes(a.boxes)
        per = {}
        for b in boxes:
            f = b['frame']
            if f not in A or f not in B:
                continue
            x0, y0, x1, y1 = [int(v) for v in b['box']]
            d = int(np.abs(rgb(A[f])[y0:y1, x0:x1] - rgb(B[f])[y0:y1, x0:x1]).max()) if x1 > x0 and y1 > y0 else 0
            w = per.get(b['who'])
            if w is None or d > w[0]:
                per[b['who']] = (d, f)
        for who, (d, f) in sorted(per.items()):
            print(f'face box {who}: max difference {d} levels (worst f{f})')
            if d > a.tol:
                problems.append(f'{who} face box differs by {d} levels at f{f}')
    finish(problems)


# ------------------------------------------------------------------------------------------------ calm
def cmd_calm(a):
    F = frames_of(a.dir)
    cuts = cut_set(a.cuts)
    still = ranges(a.still) or [(min(F), max(F))]
    gx, gy = [int(v) for v in a.grid.lower().split('x')]
    boxes = {}
    if a.boxes:
        for b in load_boxes(a.boxes):
            boxes.setdefault(b['frame'], {})[b['who']] = [int(v) for v in b['box']]

    def regions(f):
        im = luma(F[f])
        if boxes:
            return {k: float(im[y0:y1, x0:x1].mean()) for k, (x0, y0, x1, y1) in boxes.get(f, {}).items() if x1 > x0 and y1 > y0}
        h, w = im.shape
        return {f'cell {i},{j}': float(im[j * h // gy:(j + 1) * h // gy, i * w // gx:(i + 1) * w // gx].mean()) for i in range(gx) for j in range(gy)}

    jumps, memo = [], {}
    for a0, a1 in still:
        fs = [f for f in F if a0 <= f <= a1]
        for p, q in zip(fs, fs[1:]):
            if q - p != 1 or across_cut(p, q, cuts):
                continue
            rp = memo.get(p) or regions(p)
            rq = regions(q)
            memo = {q: rq}
            for k in rq:
                if k in rp:
                    jumps.append((abs(rq[k] - rp[k]), q, k))
    print(f'still ranges {still}, cuts {sorted(cuts)}, regions: ' + ('face boxes' if boxes else f'{gx}x{gy} grid'))
    print(pct_line('region luma jump frame to frame, levels', jumps))
    top = sorted(jumps, reverse=True)[:6]
    if top:
        print('top: ' + ', '.join(f'{v:.2f} f{f} {k}' for v, f, k in top))
    if not a.still:
        print('note: no --still ranges given, so camera and character movement count as light jumps too')
    finish([f'light jumps {top[0][0]:.2f} levels at f{top[0][1]} ({top[0][2]}), more than {a.thresh}'] if top and top[0][0] > a.thresh else [])


# ------------------------------------------------------------------------------------------------ flicker
def cmd_flicker(a):
    F = frames_of(a.dir)
    cuts = cut_set(a.cuts)
    first = Image.open(next(iter(F.values())))
    size = (54, 96) if first.height >= first.width else (96, 54)
    lum = {f: float(luma(p, size).mean()) for f, p in F.items()}
    fs = list(lum)
    near_cut = lambda f: any(abs(f - c) <= 1 for c in cuts)
    deltas, bad = [], []
    for p, q in zip(fs, fs[1:]):
        if q - p != 1:
            continue
        d = lum[q] - lum[p]
        deltas.append(abs(d))
        if abs(d) > a.thresh and not near_cut(q):
            bad.append((q, d))
    print(f'{len(fs)} frames, thumbnail {size[0]}x{size[1]}, mean luma {min(lum.values()):.1f}..{max(lum.values()):.1f}')
    print(f'mean |jump| {np.mean(deltas) if deltas else 0:.3f} levels, biggest {max(deltas) if deltas else 0:.2f}')
    print(f'jumps over {a.thresh} off the cuts: {len(bad)}' + (' -> ' + ', '.join(f'f{f} {d:+.1f}' for f, d in bad[:12]) if bad else ''))
    finish([f'{len(bad)} light jumps over {a.thresh} levels off the cuts, first at f{bad[0][0]}'] if bad else [])


# ------------------------------------------------------------------------------------------------ face
def cmd_face(a):
    F = frames_of(a.dir)
    R = frames_of(a.ref) if a.ref else None
    cuts = cut_set(a.cuts)
    by = {}
    for b in load_boxes(a.boxes):
        by.setdefault(b['who'], []).append(b)
    problems = []
    for who, L in sorted(by.items()):
        L.sort(key=lambda b: b['frame'])
        rows, ref_worst = [], (0, None, 0.0)
        for b in L:
            f = b['frame']
            if f not in F:
                continue
            x0, y0, x1, y1 = [int(v) for v in b['box']]
            if x1 <= x0 or y1 <= y0:
                continue
            crop = luma(F[f])[y0:y1, x0:x1]
            rows.append((f, float(crop.mean()), float(crop.std())))
            if R and f in R:
                d = int(np.abs(rgb(F[f])[y0:y1, x0:x1] - rgb(R[f])[y0:y1, x0:x1]).max())
                dm = float(crop.mean() - luma(R[f])[y0:y1, x0:x1].mean())
                if d > ref_worst[0]:
                    ref_worst = (d, f, dm)
        if not rows:
            print(f'{who}: no boxes on frames in the folder')
            continue
        jumps = [(abs(q[1] - p[1]), q[0], abs(q[2] - p[2])) for p, q in zip(rows, rows[1:]) if q[0] - p[0] == 1 and not across_cut(p[0], q[0], cuts)]
        jumps.sort(reverse=True)
        lm = [r[1] for r in rows]
        print(f'{who}: {len(rows)} frames, luma {min(lm):.1f}..{max(lm):.1f} (mean {np.mean(lm):.1f}), contrast mean {np.mean([r[2] for r in rows]):.1f}' +
              (f'; worst jump {jumps[0][0]:.2f} levels at f{jumps[0][1]} (contrast {jumps[0][2]:.2f})' if jumps else '; no neighbouring frames'))
        if jumps and jumps[0][0] > a.thresh:
            problems.append(f'{who} face luma jumps {jumps[0][0]:.1f} levels at f{jumps[0][1]}')
        if R:
            print(f'   vs reference: max difference {ref_worst[0]} levels' + (f' at f{ref_worst[1]}, mean luma {ref_worst[2]:+.2f}' if ref_worst[1] is not None else ''))
            if ref_worst[0] > a.tol:
                problems.append(f'{who} face differs from the reference by {ref_worst[0]} levels at f{ref_worst[1]}')
    finish(problems)


def main():
    ap = argparse.ArgumentParser(description='frame checks: same, calm, flicker, face')
    sp = ap.add_subparsers(dest='cmd', required=True)
    s = sp.add_parser('same'); s.add_argument('before'); s.add_argument('after'); s.add_argument('--boxes'); s.add_argument('--tol', type=int, default=0)
    s = sp.add_parser('calm'); s.add_argument('dir'); s.add_argument('--cuts'); s.add_argument('--still'); s.add_argument('--boxes')
    s.add_argument('--thresh', type=float, default=4); s.add_argument('--grid', default='4x6')
    s = sp.add_parser('flicker'); s.add_argument('dir'); s.add_argument('--cuts'); s.add_argument('--thresh', type=float, default=5)
    s = sp.add_parser('face'); s.add_argument('dir'); s.add_argument('--boxes', required=True); s.add_argument('--ref'); s.add_argument('--cuts')
    s.add_argument('--thresh', type=float, default=6); s.add_argument('--tol', type=int, default=8)
    a = ap.parse_args()
    dict(same=cmd_same, calm=cmd_calm, flicker=cmd_flicker, face=cmd_face)[a.cmd](a)


if __name__ == '__main__':
    main()
