# check_tex.py: reads the delivered texture files back from disk and reports: sizes, wrap seams, blotches, decal cell borders,
# sprite alpha and fringe, and tex.json / sprites.json against the files.
#
#   python check_tex.py --dir <project>/assets/tex
#
# What it reads: the files listed in <dir>/tex.json (tiles and skies *.jpg, decals.png with its "grid") and in
# <dir>/sprites/sprites.json. A jpg in the folder that tex.json does not list is named as a warning.
# How to read the numbers:
#   wrap jump / inner jump    about 1 = the wrap seam is as smooth as any neighbour step inside (skies wrap in x only, y is not a seam)
#   blotch std                large-scale tone left; high = the 3 x 3 repeat shows
#   decals max alpha on a cell border must be 0; smallest inset = px of exact zero inside a cell
#   sprites free edges        must be 0 (a box edge would show); rest = alpha on the resting edge (should be near 1)
#   pink                      magenta pixels left in a sprite (should be 0); rim = brightness of the soft edge (a bright rim is a halo)
# Exit code 1 when a listed file is missing or a hard check fails.
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def main(argv=None):
    ap = argparse.ArgumentParser(description='report on delivered textures, decals and sprites')
    ap.add_argument('--dir', required=True)
    args = ap.parse_args(argv)
    tex = Path(args.dir).resolve()
    bad = []
    t = tex / 'tex.json'
    data = None
    if t.exists():
        with open(t, encoding='utf8') as f:
            data = json.load(f)
    else:
        print('no tex.json in', tex, '(run make_tex.py ... json)')
    files = data['files'] if data else {}

    listed = sorted(n for n in files if n.lower().endswith('.jpg'))
    for n in sorted(p.name for p in tex.glob('*.jpg')):
        if n not in files:
            print('WARNING:', n, 'is in the folder but not in tex.json')
    for n in listed:
        p = tex / n
        if not p.exists():
            print('MISSING:', n, 'is listed in tex.json')
            bad.append(n)
            continue
        a = np.asarray(Image.open(p).convert('RGB')).astype(np.float32) / 255
        dx, dy = np.abs(np.diff(a, axis=1)).mean(), np.abs(np.diff(a, axis=0)).mean()
        low = ndi.gaussian_filter(a.mean(2), a.shape[0] / 16, mode='wrap')
        print(n, a.shape[1], 'x', a.shape[0], p.stat().st_size // 1024, 'KB | wrap jump / inner jump x %.2f y %.2f' % (np.abs(a[:, 0] - a[:, -1]).mean() / dx, np.abs(a[0] - a[-1]).mean() / dy),
              '| mean', np.round(a.mean((0, 1)), 3), '| lum std %.3f' % a.mean(2).std(), '| blotch std %.4f' % low.std())

    p = tex / 'decals.png'
    if 'decals.png' in files or p.exists():
        if not p.exists():
            print('MISSING: decals.png is listed in tex.json')
            bad.append('decals.png')
        else:
            grid = int(files.get('decals.png', {}).get('grid', [6, 6])[0])
            d = np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) / 255
            size = d.shape[0]
            edges = [round(i * size / grid) for i in range(grid + 1)]
            worst, least, empty = 0.0, 999, []
            for c in range(grid * grid):
                x, y = c % grid, c // grid
                al = d[edges[y]:edges[y + 1], edges[x]:edges[x + 1], 3]
                worst = max(worst, float(al[0].max()), float(al[-1].max()), float(al[:, 0].max()), float(al[:, -1].max()))
                ys, xs = np.where(al > 0)
                if not len(ys):
                    empty.append(c)
                    continue
                least = min(least, int(ys.min()), int(xs.min()), int(al.shape[0] - 1 - ys.max()), int(al.shape[1] - 1 - xs.max()))
            print('decals: max alpha on a cell border', worst, '| smallest inset px', least, '| empty cells', empty)
            if worst > 0:
                bad.append('decals.png cell border')
            solid = d[..., 3] > .5
            if solid.any():
                print('decals: rgb under solid alpha min %.3f mean %s | max alpha %.3f' % (d[..., :3][solid].min(), np.round(d[..., :3][solid].mean(0), 3), d[..., 3].max()))
            # the most any cell darkens a surface
            dark = (1 - (1 - d[..., :3].mean(2)) * d[..., 3])
            print('decals: darkest multiply result %.3f' % dark.min())
            if data is not None:
                cells = [x['cell'] for x in data.get('decals', [])]
                print('tex.json: decal cells in order', cells == list(range(grid * grid)), '(%d listed)' % len(cells))

    j = tex / 'sprites' / 'sprites.json'
    if j.exists():
        with open(j, encoding='utf8') as f:
            sp = json.load(f)
        print('sprites:', len(sp['sprites']))
        for e in sp['sprites']:
            fp = tex / 'sprites' / e['file']
            if not fp.exists():
                print('MISSING: sprites/' + e['file'], 'is listed in sprites.json')
                bad.append(e['file'])
                continue
            a = np.asarray(Image.open(fp).convert('RGBA')).astype(np.float32) / 255
            al, rgb = a[..., 3], a[..., :3]
            hanging = e['anchor'] == 'top'
            free = max(float(al[:, 0].max()), float(al[:, -1].max()), float((al[-1] if hanging else al[0]).max()))
            rest = float((al[0] if hanging else al[-1]).max())
            mag = np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1]
            pink = int(((mag > .12) & (al > .1)).sum())
            # fringe: the brightness of the soft edge against the ink. A bright rim would show as a halo on a dark set
            ring = (al > .05) & (al < .9)
            rim = float(rgb[ring].mean()) if ring.any() else 0
            rim_max = float(np.percentile(rgb[ring].mean(1), 99)) if ring.any() else 0
            semi = float(((al > .05) & (al < .95)).sum() / max(1, (al > .05).sum()))
            print(' ', e['name'], al.shape[1], 'x', al.shape[0], 'h %.2f aspect %.3f %s' % (e['height'], e['aspect'], e['anchor']), '| free edges %.3f rest %.2f' % (free, rest), '| pink', pink,
                  '| rim mean %.3f p99 %.3f' % (rim, rim_max), '| soft px share %.3f' % semi)
            if free > 0 and e.get('library'):   # a prop from the app's library: looked at by hand when it was made
                print('  NOTE:', e['name'], 'from the prop library touches a free edge of its picture (alpha %.3f): check it in a frame' % free)
            elif free > 0:
                bad.append(e['file'] + ' free edge')

    if data is not None:
        print('tex.json: files', sorted(files))
        for f in files:
            if not (tex / f).exists():
                bad.append(f)
    if data is None and not j.exists() and not p.exists():
        print('NOTHING TO CHECK: no tex.json, decals.png or sprites/sprites.json in', tex)
        return 1
    if bad:
        print('PROBLEMS:', sorted(set(bad)))
        return 1
    print('OK')
    return 0


if __name__ == '__main__':
    sys.exit(main())
