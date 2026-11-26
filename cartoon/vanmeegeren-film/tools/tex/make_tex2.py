# make_tex2.py: the texture library behind make_tex.py and make_sprites.py. No folders are built in: every path comes from the caller.
#   from make_tex2 import load, flatten, calm, seamless, grade, finish_tile, ...
# Python 3.12, numpy + scipy + pillow only. Windows and Mac.
#
# Tiling: a min-error boundary cut (image quilting) on an overlap band chosen to line up with the pattern's own period, so the
# seam follows the picture instead of cross-fading it into ghosts. Large-scale blotches are flattened first, or they repeat.
# Decals: a picture of marks on white IS a multiply layer. It is split into rgb + alpha so that surface * mix(1, rgb, a) reproduces it.
# The maths is the same as the S-4 and backrooms2 scripts (world/assets/s4/tex/jobs), so the same pictures give the same files.
import os
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SIZE = 2048        # default output side of a tile and of the decal sheet
CELLS = 6          # default decal grid: CELLS x CELLS cells


class MissingPicture(Exception):
    pass


# ---------- io ----------
RAW_EXTS = ('.png', '.jpg', '.jpeg')


def raw_path(raw_dir, name):
    """<name>.png, else <name>.jpg / .jpeg (web photos arrive as jpg); the .png path when none exists, for the error text"""
    for ext in RAW_EXTS:
        p = Path(raw_dir) / (name + ext)
        if p.exists():
            return p
    return Path(raw_dir) / (name + '.png')


def have(raw_dir, name):
    return raw_path(raw_dir, name).exists()


def raw_meta(raw_dir, name):
    """the sidecar <picture file>.json (make_picture, web_image and procedural.py write one), {} when none or unreadable.
    procedural.py sets "wraps": true (the picture already tiles: no cut needed); web photos carry "source": "photo" + the credit"""
    import json
    p = raw_path(raw_dir, name)
    side = p.parent / (p.name + '.json')
    try:
        with open(side, encoding='utf8') as f:
            d = json.load(f)
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def load(name, raw_dir):
    """a raw picture as float rgb 0..1. A missing picture is a plain error that names the file"""
    path = raw_path(raw_dir, name)
    if not path.exists():
        raise MissingPicture('the raw picture %s does not exist. Make it with make_picture (Flow), web_image (a free photo) or tex_job procedural first (name: %s).' % (path, name))
    return np.asarray(Image.open(path).convert('RGB')).astype(np.float32) / 255


def square_crop(a, tol=.02):
    """the middle square of a picture that is not square (photos are 4:3 or 3:2; a tile is square and must not be stretched)"""
    h, w = a.shape[:2]
    if abs(w / h - 1) <= tol:
        return a
    s = min(h, w)
    y0, x0 = (h - s) // 2, (w - s) // 2
    return a[y0:y0 + s, x0:x0 + s]


def paint(a, size, mode='reflect'):
    """photo -> slightly painted: a median of `size` px flattens the photo grain and tiny hard specks into flat strokes, a quarter
    of the finer detail comes back so the surface still reads. Photo-sharp detail fights flat cartoon characters (env/WORKFLOW.md 6).
    mode 'wrap' for a picture that already tiles"""
    size = int(size)
    if size < 2:
        return a
    med = np.stack([ndi.median_filter(a[..., i], size=size, mode=mode) for i in range(3)], -1)
    fine = a - ndi.gaussian_filter(a, (size * .6, size * .6, 0), mode=mode)
    return np.clip(med + fine * .25, 0, 1)


def to8(a):
    return (np.clip(a, 0, 1) * 255 + .5).astype(np.uint8)


def write(img, path, **kw):
    """atomic: never a half-written file for the renderer to pick up"""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.parent / ('.tmp-' + path.name)
    img.save(tmp, format=_fmt(path), **kw)
    os.replace(tmp, path)
    print('wrote', path.name, path.stat().st_size // 1024, 'KB')


def write_text(text, path):
    """atomic text write (json files)"""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.parent / ('.tmp-' + path.name)
    with open(tmp, 'w', encoding='utf8') as f:
        f.write(text)
    os.replace(tmp, path)


def _fmt(path):
    ext = path.suffix.lower()
    return {'.jpg': 'JPEG', '.jpeg': 'JPEG', '.png': 'PNG', '.webp': 'WEBP'}.get(ext)


def resize(a, w, h):
    a = a.astype(np.float32)        # mode F reads the raw buffer: float64 would come out as garbage
    chans = [np.asarray(Image.fromarray(a[..., i], 'F').resize((w, h), Image.LANCZOS)) for i in range(a.shape[2])]
    return np.stack(chans, -1)


# ---------- tiling ----------
def flatten(a, sigma, keep):
    """pull the large-scale light and blotches towards the mean: `keep` of them survive"""
    low = ndi.gaussian_filter(a, (sigma, sigma, 0), mode='wrap')
    return a - low * (1 - keep) + a.mean((0, 1), keepdims=True) * (1 - keep)


def calm(a, sigma, keep):
    """the same for the mid-size blotches (what a 3 x 3 tiling reads as a repeat): detail finer than sigma stays whole"""
    low = ndi.gaussian_filter(a, (sigma, sigma, 0), mode='reflect')
    return a - (low - a.mean((0, 1), keepdims=True)) * (1 - keep)


def best_overlap(a, axis, lo, hi):
    """the overlap width where the two ends of the picture agree most (lines the band up with the pattern's period)"""
    g = a.mean(2)
    g = g - ndi.gaussian_filter(g, 24)
    if axis == 0:
        g = g.T
    best, err = lo, 1e9
    for ov in range(lo, hi):
        e = float(np.mean((g[:, :ov] - g[:, -ov:]) ** 2))
        if e < err:
            best, err = ov, e
    return best


def cut_path(err, closed):
    """cheapest top-to-bottom path through err (h x w). closed: the path ends in the column it started (keeps the other axis tiling)"""
    h, w = err.shape

    def solve(start):
        cost = np.full(w, 1e18)
        if start is None:
            cost = err[0].copy()
        else:
            cost[start] = err[0, start]
        back = np.zeros((h, w), np.int32)
        for y in range(1, h):
            left = np.r_[1e18, cost[:-1]]
            right = np.r_[cost[1:], 1e18]
            stack = np.stack([left, cost, right])
            pick = stack.argmin(0)
            back[y] = np.arange(w) + pick - 1
            cost = stack.min(0) + err[y]
        return cost, back

    if not closed:
        cost, back = solve(None)
        x = int(cost.argmin())
    else:
        best = None
        for s in range(w // 8, w, max(1, w // 8)):
            cost, back = solve(s)
            if best is None or cost[s] < best[0]:
                best = (cost[s], back, s)
        _, back, x = best
    path = np.zeros(h, np.int32)
    path[-1] = x
    for y in range(h - 1, 0, -1):
        path[y - 1] = back[y, path[y]]
    return path


def tile_x(a, ov, closed):
    """make `a` wrap in x: width shrinks by ov; the band mixes the right end into the left end along the cheapest cut"""
    h, w, _ = a.shape
    left, right = a[:, :ov], a[:, w - ov:]
    err = ((left - right) ** 2).sum(2)
    err = ndi.gaussian_filter(err, 1.5)
    # the cut must stay off the band's edges, or the band's own border becomes a straight seam
    edge = np.minimum(np.arange(ov), ov - 1 - np.arange(ov)) / (ov * .18)
    err = err + (1 - np.clip(edge, 0, 1))[None, :] * (err.mean() * 40 + 1e-3)
    path = cut_path(err, closed)
    xs = np.arange(ov)[None, :]
    feather = 5.0
    # left of the path keep `right` (it continues the picture's far end), right of it keep `left`
    m = np.clip((xs - path[:, None]) / feather + .5, 0, 1)[..., None]
    band = right * (1 - m) + left * m
    out = a[:, :w - ov].copy()
    out[:, :ov] = band
    return out


def seamless(a, periodic=True):
    """wrap in both axes; x first, then y with a closed path so x stays wrapped.
    periodic: search widely for the pattern's period. Otherwise a narrow band that keeps the resolution."""
    h, w, _ = a.shape
    lo, hi = (w // 10, w // 4) if periodic else (w // 12, w // 8)
    ovx = best_overlap(a, 1, lo, hi)
    a = tile_x(a, ovx, closed=False)
    a = np.transpose(a, (1, 0, 2))
    # near the x overlap, so the crop stays nearly square (the pattern is not stretched); the window is still wider than one period
    span = int(a.shape[1] * (.08 if periodic else .02))
    ovy = best_overlap(a, 1, max(lo, ovx - span), ovx + span)
    # a is wrapped along axis 0 here: the cut must be periodic so x stays wrapped
    a = tile_x(a, ovy, closed=True)
    return np.transpose(a, (1, 0, 2)), (ovx, ovy)


def crossfade_wrap(a, ov, axes=(1,)):
    """wrap by a long smoothstep crossfade instead of a cut: for soft pictures (ripples, cloud bands) where a cut leaves a jog.
    axis 1 = x, axis 0 = y; x first when both are asked"""
    t = np.linspace(0, 1, ov, dtype=np.float32)
    t = t * t * (3 - 2 * t)
    if 1 in axes:
        x = a[:, :-ov].copy()
        x[:, :ov] = a[:, -ov:] * (1 - t[None, :, None]) + a[:, :ov] * t[None, :, None]
        a = x
    if 0 in axes:
        y = a[:-ov].copy()
        y[:ov] = a[-ov:] * (1 - t[:, None, None]) + a[:ov] * t[:, None, None]
        a = y
    return a


def grade(a, mean_rgb, detail, chroma=.5):
    """steer the mean to a target colour and the detail to a target contrast; `chroma` keeps some of the picture's own colour drift"""
    lum = a.mean(2, keepdims=True)
    lm = lum.mean()
    tint = a / np.maximum(lum, 1e-3)
    tint = tint.mean((0, 1), keepdims=True) * (1 - chroma) + tint * chroma
    tint = tint / tint.mean((0, 1), keepdims=True)
    d = (lum - lm)
    d = d / max(1e-4, d.std()) * detail
    target = np.array(mean_rgb, np.float32)[None, None]
    out = target * tint * (1 + d / max(1e-3, sum(mean_rgb) / 3))
    return np.clip(out * target / out.mean((0, 1), keepdims=True), 0, 1)     # exactly the asked colour: a colour drift shows under the film's light


def wrap_seam_stats(a):
    """seam jump over the mean neighbour jump (about 1 = the wrap is as smooth as anywhere inside)"""
    dx = np.abs(np.diff(a, axis=1)).mean()
    dy = np.abs(np.diff(a, axis=0)).mean()
    wx = np.abs(a[:, 0] - a[:, -1]).mean()
    wy = np.abs(a[0] - a[-1]).mean()
    return round(float(wx / dx), 2), round(float(wy / dy), 2)


def finish_tile(a, path, size=SIZE, q=90):
    """resize a wrapping picture to size x size without breaking the wrap, write it as jpg"""
    # the resize filter does not wrap: resize a wrapped copy whose pad maps to a whole number of output pixels, then cut it off
    h, w = a.shape[:2]
    padh, padw = h // 8, w // 8
    wrapped = np.pad(a, ((padh, padh), (padw, padw), (0, 0)), mode='wrap')
    ph, pw = round(padh * size / h), round(padw * size / w)
    big = resize(wrapped, size + 2 * pw, size + 2 * ph)
    out = big[ph:ph + size, pw:pw + size]
    print(Path(path).stem, 'wrap seam ratio x,y', wrap_seam_stats(out))
    write(Image.fromarray(to8(out)), path, quality=q, subsampling=0)
    return out


def finish_wrap_x(a, path, w=2048, h=1024, q=92):
    """resize a picture that wraps in x only (a sky) without breaking the wrap, write it as jpg"""
    pad = a.shape[1] // 8
    wrapped = np.pad(a, ((0, 0), (pad, pad), (0, 0)), mode='wrap')
    pw = round(pad * w / a.shape[1])
    out = resize(wrapped, w + 2 * pw, h)[:, pw:pw + w]
    jump = np.abs(out[:, 0] - out[:, -1]).mean() / np.abs(np.diff(out, axis=1)).mean()
    print(Path(path).stem, 'wrap seam ratio x %.2f' % jump)
    write(Image.fromarray(to8(out)), path, quality=q, subsampling=0)
    return out


# ---------- decals ----------
def to_multiply(a, colour):
    """picture on white -> multiply layer in 0..1 (1 = no change), paper noise removed. colour = how much of the picture's own hue stays"""
    bg = np.percentile(a.reshape(-1, 3), 98, axis=0)
    m = np.clip(a / np.maximum(bg, 1e-3), 0, 1)
    # paper tone and scan noise are not marks: Flow's "white" drifts by a few percent, and that drift kept a whole square of the picture alive
    paper = ndi.gaussian_filter(m.min(2), 3) > .93
    m = np.where(paper[..., None], 1, m)
    m = 1 - np.clip((1 - m - .025) / .975, 0, 1)
    lum = m.mean(2, keepdims=True)
    warm = lum ** np.array([.92, 1.0, 1.14], np.float32)
    return np.clip(warm * (1 - colour) + m * colour, 0, 1)


def blobs(m, want):
    """the `want` biggest marks. Small specks join their nearest big mark. Returns one label image + labels in reading order, or None"""
    ink = 1 - m.min(2)
    soft = ndi.gaussian_filter(ink, 6)
    mask = soft > .035
    # marks made of pieces (footprints, drips) must stay one mark: grow the ink until exactly the wanted clusters remain, widest reach first
    gap = ndi.distance_transform_edt(~mask)
    lab = None
    for reach in (90, 70, 50, 35, 22, 12, 6, 2):
        cl, n = ndi.label(gap <= reach)
        if n >= want:
            lab = cl
            break
    if lab is None:
        return None
    areas = ndi.sum(mask, lab, range(1, n + 1))
    order = np.argsort(areas)[::-1]
    keep = [int(i) + 1 for i in order[:want]]
    if areas[order[want - 1]] < m.size / 3 * .002:
        return None
    near = lab * mask
    print('  clusters at reach', reach, 'found', n)
    cents = ndi.center_of_mass(mask, near, keep)
    # reading order: rows by y (Flow draws 3 x 2 or 2 x 3 as it likes: a new row starts at a big gap in y), then x
    by_y = sorted(zip(keep, cents), key=lambda kc: kc[1][0])
    rows, row = [], [by_y[0]]
    for kc in by_y[1:]:
        if kc[1][0] - row[-1][1][0] > m.shape[0] * .12:
            rows.append(row)
            row = []
        row.append(kc)
    rows.append(row)
    ordered = [kc for r in rows for kc in sorted(r, key=lambda kc: kc[1][1])]
    return near, [k for k, _ in ordered]


def split_grid(m, cols=3, rows=2):
    """fallback when the marks touch: the cols x rows grid the prompt asked for"""
    h, w, _ = m.shape
    lab = np.zeros((h, w), np.int32)
    keep = []
    for r in range(rows):
        for c in range(cols):
            k = r * cols + c + 1
            lab[h * r // rows:h * (r + 1) // rows, w * c // cols:w * (c + 1) // cols] = k
            keep.append(k)
    return lab, keep


def fit_cell(m, region, cell, kind, seed, floor_rgb=.22, zero=36, fade=34):
    """one mark, scaled into a cell. Returns rgba in 0..1 with alpha exactly 0 for `zero` px from the border.
    kind: dict(dark=darkest multiply, soft=px of soft outer edge, streak=True for marks heaviest at the cell top that run down)"""
    ys, xs = np.where(region)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    crop = m[y0:y1, x0:x1].copy()
    crop[~region[y0:y1, x0:x1]] = 1
    h, w, _ = crop.shape
    streak = bool(kind.get('streak'))
    room = cell - 2 * (zero + fade // 2)
    k = min(room / w, room / h)
    if streak:
        k = min(room / w, (cell - zero - fade // 2 - zero // 2) / h)    # as tall as the cell allows; the top is where it starts
    # streaks come out very thin at that scale: widen them, they stay streaks and use more of the cell
    nw, nh = max(8, int(w * k * (2.2 if streak else 1))), max(8, int(h * k))
    nw = min(nw, room)
    small = resize(crop.astype(np.float32), nw, nh)
    out = np.ones((cell, cell, 3), np.float32)
    px = (cell - nw) // 2
    py = (cell - nh) // 2
    if streak:
        py = zero // 2 + 8
    out[py:py + nh, px:px + nw] = small
    # irregular window: distance to the border plus large noise, so no straight edge can read
    r = np.random.default_rng(seed)
    noise = ndi.gaussian_filter(r.standard_normal((cell, cell)), 14)
    noise = noise / max(1e-5, noise.std())
    yy, xx = np.mgrid[0:cell, 0:cell].astype(np.float32)
    top = yy * 1.6 if streak else yy
    dist = np.minimum(np.minimum(np.minimum(xx, cell - 1 - xx), top), cell - 1 - yy)
    win = np.clip((dist - zero + noise * 6 * np.clip((dist - zero) / 20, 0, 1)) / fade, 0, 1)
    win = win * win * (3 - 2 * win)
    win[dist < zero] = 0
    ink = 1 - out.min(2)
    ink = ndi.gaussian_filter(ink, .7)
    if streak:                                  # always heaviest at the top, thinning away down the cell
        ink = ink * (1 - .55 * np.clip((yy - py) / max(nh, 1), 0, 1) ** 1.4)
    alpha = np.clip(ink / (1 - floor_rgb), 0, 1)
    peak = np.percentile(alpha[alpha > .02], 99.5) if np.any(alpha > .02) else 1
    limit = (1 - kind['dark']) / (1 - floor_rgb)
    alpha = alpha * min(limit / max(peak, 1e-3), 1.25)
    rgb = 1 - (1 - out) / np.maximum(np.clip(ink / (1 - floor_rgb), 1e-3, 1), .02)[..., None]
    rgb = np.clip(rgb, floor_rgb * .8, 1)
    # the outer edge of the mark goes soft and a little irregular (a drawn edge would read as a sticker)
    inside = ndi.distance_transform_edt(ndi.gaussian_filter(ink, 2) > .03)
    alpha = alpha * np.clip((inside + noise * 2) / kind['soft'], 0, 1)
    alpha = np.clip(alpha, 0, 1) * win
    alpha[alpha < 1.5 / 255] = 0
    # transparent pixels carry the cell's mean colour, so filtering never brings a white or black halo
    solid = alpha > .15
    mean = rgb[solid].mean(0) if solid.any() else np.array([.4, .35, .28])
    w8 = np.clip(alpha / .15, 0, 1)[..., None]
    rgb = rgb * w8 + mean * (1 - w8)
    return np.dstack([rgb, alpha])


def cell_edges(size=SIZE, cells=CELLS):
    return [round(i * size / cells) for i in range(cells + 1)]


def border_check(sheet, edges, cells=CELLS):
    """alpha must be exactly 0 on every cell border, or a neighbour's mark bleeds in under filtering"""
    a = sheet[..., 3]
    worst = 0.0
    inset = []
    for c in range(cells * cells):
        cx, cy = c % cells, c // cells
        cell = a[edges[cy]:edges[cy + 1], edges[cx]:edges[cx + 1]]
        border = max(cell[0].max(), cell[-1].max(), cell[:, 0].max(), cell[:, -1].max())
        worst = max(worst, float(border))
        ys, xs = np.where(cell > 0)
        inset.append(int(min(ys.min(), xs.min(), cell.shape[0] - 1 - ys.max(), cell.shape[1] - 1 - xs.max())) if len(ys) else -1)
    print('decals: max alpha on any cell border', worst, '| smallest inset of non-zero alpha per cell (px)', inset)
    if worst != 0:
        raise ValueError('a decal has alpha on a cell border (worst %.4f): raise decals.zero in the recipes' % worst)
