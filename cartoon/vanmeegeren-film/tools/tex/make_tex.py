# make_tex.py: seamless tiles, skies and a 6 x 6 multiply decal sheet from raw pictures (Google Flow or any other), for any project.
#
#   python make_tex.py --dir <project>/assets/tex [--raw <dir>] [--recipes <json>] [--preview <dir>] [steps...]
#     --dir      where the finished files go (tiles <name>.jpg, decals.png, tex.json, cells.json)
#     --raw      the raw pictures, <name>.png (default <dir>/raw)
#     --recipes  the recipes (default <dir>/recipes.json; worked example: recipes.s4.json next to this script)
#     --preview  previews to look at: <name>_3x3.jpg, <name>_seam.jpg, <sky>_x2.jpg, decal preview (default <dir>/preview)
#     steps      any of: a base name, a sky name, decals, json, previews. None = every base and sky, then decals, json, previews.
#     --names    the same steps as one comma list (how the app's tex_job tool passes them)
# Every output is written atomically (temp file, then rename), because a running renderer may load files as soon as they appear.
# A raw picture that is missing is skipped with a note (its file is simply not made); make it with make_picture first.
#
# recipes.json (lists where the old scripts had tuples):
#   "tile_size": 2048                 side of a finished tile and of the decal sheet
#   "preview_size": 400               side of one repeat in the 3 x 3 previews (the seam preview is 2 x this)
#   "note": "..."                     goes into tex.json
#   "bases": { "<name>": {             one seamless tile <name>.jpg
#      "raw": "<picture>"              raw picture name (default: the base name)
#      "fallback": "<picture>"         used when raw is missing (graded to this base's colour), optional
#      "trim": 0.015                   share of the picture cut off each side first (Flow's outer rows are often off)
#      "flat": [div, keep]             large-scale light flattened: sigma = picture height / div, keep = share that survives
#      "calm": [sigma, keep] or null   mid-size blotches (what a 3 x 3 tiling reads as a repeat) pulled down
#      "square": true                  rivets / plates: tone taken out with a median, same overlap on both axes
#      "fade": 0.22                    soft ripples: long crossfade of this share of the width on both axes instead of a cut
#      "periodic": true                otherwise: quilting cut; true = search wide for the pattern's period, false = narrow band
#      "post": [sigma, keep]           tone left after wrapping (default [40, 0.2])
#      "mean": [r, g, b]               exact mean colour of the result, 0..1
#      "detail": 0.05                  detail contrast (std of luminance)
#      "chroma": 0.5                   share of the picture's own colour drift that stays
#      "tile": [u, v]                  world units one repeat covers (goes to tex.json)
#      "quality": 90 }                 jpg quality
#   "skies": { "<name>": {             wraps in x only, 2048 x 1024; the bottom edge stays the horizon
#      "raw", "trim": 0.012, "quality": 92,
#      "mode": "cut" | "crossfade"      cut = quilting cut with an overlap between width/8 and width/4; crossfade = long fade
#      "crossfade_part": 3              crossfade overlap = width / this
#      "note": "..." }                 goes to tex.json
#   "decals": {
#      "grid": 6, "floor_rgb": 0.22, "zero": 36, "fade": 34   cells per side, darkest rgb, px of exact zero at a cell border, px of fade-in
#      "kinds": { "<kind>": {"colour": .65, "dark": .34, "soft": 3, "streak": false} }
#             colour = share of the picture's hue kept, dark = darkest multiply, soft = px of soft edge, streak = heavy at the cell top
#      "groups": [ {"raw": "<picture>", "first": 0, "kind": "<kind>", "names": [6 names],
#                   "stand_in": {"from": "<picture>", "mirror": true, "gamma": [r, g, b]}} ]   stand_in used while raw is missing
#      "notes": {"<key>": "..."}       extra lines for tex.json's decals.png entry
#      "preview_base": [r, g, b], "preview_name": "decals_on_base.jpg" }
#   "sprites": {...}                   read by make_sprites.py
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_tex2 import (MissingPicture, best_overlap, blobs, border_check, calm, cell_edges, crossfade_wrap, finish_tile,  # noqa: E402
                       finish_wrap_x, fit_cell, flatten, grade, have, load, paint, raw_meta, resize, seamless, split_grid, square_crop, tile_x, to8,
                       to_multiply, write, write_text)


class RecipeError(Exception):
    pass


def need(d, key, where, kind=None):
    if key not in d:
        raise RecipeError('recipe %s is missing the field "%s"' % (where, key))
    v = d[key]
    if kind == 'pair' and not (isinstance(v, list) and len(v) == 2 and all(isinstance(x, (int, float)) for x in v)):
        raise RecipeError('recipe %s field "%s" must be a list of two numbers, got %r' % (where, key, v))
    if kind == 'rgb' and not (isinstance(v, list) and len(v) == 3 and all(isinstance(x, (int, float)) for x in v)):
        raise RecipeError('recipe %s field "%s" must be a list of three numbers 0..1, got %r' % (where, key, v))
    if kind == 'num' and not isinstance(v, (int, float)):
        raise RecipeError('recipe %s field "%s" must be a number, got %r' % (where, key, v))
    return v


class Job:
    def __init__(self, args):
        self.dir = Path(args.dir).resolve()
        self.raw = Path(args.raw).resolve() if args.raw else self.dir / 'raw'
        rec = Path(args.recipes).resolve() if args.recipes else self.dir / 'recipes.json'
        self.preview = Path(args.preview).resolve() if args.preview else self.dir / 'preview'
        if not rec.exists():
            raise RecipeError('no recipes file at %s (pass --recipes, or copy recipes.s4.json there as a start)' % rec)
        try:
            with open(rec, encoding='utf8') as f:
                self.r = json.load(f)
        except json.JSONDecodeError as e:
            raise RecipeError('the recipes file %s is not valid json: %s' % (rec, e))
        self.bases = self.r.get('bases', {})
        self.skies = self.r.get('skies', {})
        self.decals = self.r.get('decals')
        self.size = int(self.r.get('tile_size', 2048))
        self.dir.mkdir(parents=True, exist_ok=True)

    def have(self, name):
        return have(self.raw, name)


# ---------- base textures ----------
def make_base(job, name):
    b = job.bases[name]
    where = 'bases.' + name
    raw = b.get('raw', name)
    if not job.have(raw) and b.get('fallback') and job.have(b['fallback']):
        raw = b['fallback']                    # no own picture (yet): the same plain surface in this one's colour, so the name exists
        print(name, 'from', raw)
    if not job.have(raw):
        print(name, 'no raw picture yet (%s): make it with make_picture (Flow), web_image (a free photo) or tex_job procedural first' % (job.raw / (raw + '.png')))
        return
    flat = need(b, 'flat', where, 'pair')
    cm = b.get('calm')
    if cm is not None:
        need(b, 'calm', where, 'pair')
    a = load(raw, job.raw)
    meta = raw_meta(job.raw, raw)
    wraps = bool(b.get('wraps', meta.get('wraps', False)))
    if wraps:
        # drawn in code (procedural.py): it already tiles, so no trim and no cut; the tone steps run with wrap-around blurs
        a = flatten(a, a.shape[0] / flat[0], flat[1])
        if cm:
            low = ndi.gaussian_filter(a, (cm[0], cm[0], 0), mode='wrap')
            a = a - (low - a.mean((0, 1), keepdims=True)) * (1 - cm[1])
        if b.get('paint'):
            a = paint(a, b["paint"], mode="wrap")
        ov = 0
        print(name, 'drawn in code, already tiles', a.shape)
    else:
        a = square_crop(a)                         # photos are rarely square; a tile must not be stretched (square Flow pictures: unchanged)
        if meta.get('source') == 'photo' and a.shape[0] > job.size:
            a = resize(a, job.size, job.size)      # a 4000 px photo is no better as a tile and takes minutes in the median and the cut
        m = int(a.shape[0] * b.get('trim', .015))  # Flow's outer rows are often a touch off
        if m:
            a = a[m:-m, m:-m]
        a = flatten(a, a.shape[0] / flat[0], flat[1])
        if cm:
            a = calm(a, cm[0], cm[1])
        if b.get('paint'):
            a = paint(a, b['paint'])               # photos: painted a little, before the cut so the seam search sees the final picture
    if wraps:
        pass
    elif b.get('square'):
        # plain metal between the rivets: take its tone out, so the cut has no step to show. A median ignores rivets and seams, which a blur would smear
        h, w = a.shape[:2]
        small = np.stack([ndi.median_filter(a[::8, ::8, i], size=13, mode='reflect') for i in range(3)], -1)
        low = ndi.gaussian_filter(resize(small, w, h), (14, 14, 0), mode='reflect')
        a = a - (low - a.mean((0, 1), keepdims=True)) * .9
        # plates: the same overlap on both axes, so rivets stay round and the plate square
        ov = best_overlap(a, 1, a.shape[1] // 10, a.shape[1] // 4)
        a = tile_x(a, ov, closed=False)
        a = np.transpose(tile_x(np.transpose(a, (1, 0, 2)), ov, closed=True), (1, 0, 2))
    elif b.get('fade'):
        # soft ripples: a cut leaves a jog in every ripple it crosses. A long crossfade on both axes has none
        ov = int(a.shape[1] * need(b, 'fade', where, 'num'))
        a = crossfade_wrap(a, ov, axes=(1, 0))
    else:
        a, ov = seamless(a, periodic=bool(b.get('periodic', False)))
    print(name, 'overlap', ov, a.shape)
    # the cut joins two tones: take the mid-size tone out now the picture wraps, or the cut shows as a cloudy edge
    s, keep = b.get('post', [40, .2])
    low = ndi.gaussian_filter(a, (s, s, 0), mode='wrap')
    a = a - (low - a.mean((0, 1), keepdims=True)) * (1 - keep)
    a = grade(a, need(b, 'mean', where, 'rgb'), need(b, 'detail', where, 'num'), chroma=b.get('chroma', .5))
    finish_tile(a, job.dir / (name + '.jpg'), size=job.size, q=int(b.get('quality', 90)))


# ---------- skies ----------
def make_sky(job, name):
    """wraps in x only: the bottom edge stays the horizon haze"""
    s = job.skies[name]
    raw = s.get('raw', name)
    if not job.have(raw):
        print(name, 'no raw picture yet (%s): make it with make_picture (Flow), web_image (a free photo) or tex_job procedural first' % (job.raw / (raw + '.png')))
        return
    a = load(raw, job.raw)
    m = int(a.shape[0] * s.get('trim', .012))
    if m:
        a = a[m:-m, m:-m]
    out = job.dir / (name + '.jpg')
    q = int(s.get('quality', 92))
    mode = s.get('mode', 'cut')
    if mode == 'crossfade':
        # long thin cloud bands don't line up across a quilting cut: a long crossfade of two soft skies has no edge at all
        ov = a.shape[1] // int(s.get('crossfade_part', 3))
        a = crossfade_wrap(a, ov, axes=(1,))
        print(name, 'crossfade', ov, a.shape)
    elif mode == 'cut':
        ov = best_overlap(a, 1, a.shape[1] // 8, a.shape[1] // 4)
        a = tile_x(a, ov, closed=False)
        print(name, 'overlap', ov, a.shape)
    else:
        raise RecipeError('recipe skies.%s field "mode" must be "cut" or "crossfade", got %r' % (name, mode))
    finish_wrap_x(a, out, w=job.size, h=job.size // 2, q=q)


# ---------- decals ----------
def make_decals(job):
    d = job.decals
    if not d:
        print('no "decals" section in the recipes: skipped')
        return
    cells = int(d.get('grid', 6))
    floor_rgb, zero, fade = d.get('floor_rgb', .22), int(d.get('zero', 36)), int(d.get('fade', 34))
    kinds = need(d, 'kinds', 'decals')
    size = job.size
    edges = cell_edges(size, cells)
    sheet = np.zeros((size, size, 4), np.float32)
    sheet[..., :3] = .4
    meta = []
    for gi, g in enumerate(need(d, 'groups', 'decals')):
        where = 'decals.groups[%d]' % gi
        raw, first, kind, names = need(g, 'raw', where), need(g, 'first', where), need(g, 'kind', where), need(g, 'names', where)
        if kind not in kinds:
            raise RecipeError('recipe %s kind "%s" is not in decals.kinds' % (where, kind))
        kp = kinds[kind]
        for f in ('colour', 'dark', 'soft'):
            need(kp, f, 'decals.kinds.' + kind, 'num')
        si = g.get('stand_in')
        stand_in = bool(si) and not job.have(raw) and job.have(si['from'])
        if not job.have(raw) and not stand_in:      # not made yet: its cells stay empty (alpha 0), harmless to the renderer
            print(raw, 'not made yet, cells empty (make it with make_picture first)')
            meta += [{'cell': first + i, 'name': names[i], 'kind': kind} for i in range(len(names))]
            continue
        if stand_in:
            # no own picture: another sheet's marks (mirrored) recoloured, so marks placed in these cells still show
            print(raw, 'stand-in from', si['from'])
            m = to_multiply(load(si['from'], job.raw), 0)
            if si.get('mirror', True):
                m = m[:, ::-1]
            lum = m.mean(2, keepdims=True)
            m = np.clip(lum ** np.array(si.get('gamma', [1, 1, 1]), np.float32), 0, 1)
        else:
            m = to_multiply(load(raw, job.raw), kp['colour'])
        got = blobs(m, len(names))
        how = 'marks'
        if got is None:
            got = split_grid(m)
            how = 'grid'
        lab, keep = got
        print(raw, 'split by', how)
        for i, k in enumerate(keep):
            c = first + i
            cx, cy = c % cells, c // cells
            x0, x1, y0, y1 = edges[cx], edges[cx + 1], edges[cy], edges[cy + 1]
            cell = fit_cell(m, lab == k, min(x1 - x0, y1 - y0), kp, 1000 + c, floor_rgb=floor_rgb, zero=zero, fade=fade)
            sheet[y0:y0 + cell.shape[0], x0:x0 + cell.shape[1]] = cell
            meta.append({'cell': c, 'name': names[i], 'kind': kind})
    border_check(sheet, edges, cells)
    write(Image.fromarray(to8(sheet), 'RGBA'), job.dir / 'decals.png', optimize=True)
    write_text(json.dumps(meta, indent=1), job.dir / 'cells.json')


# ---------- metadata + previews ----------
def make_json(job):
    files = {}
    for n, b in job.bases.items():
        if (job.dir / (n + '.jpg')).exists():
            files[n + '.jpg'] = {'tile': b['tile'], 'seamless': True, 'source': b.get('source', 'flow')}
    for n, s in job.skies.items():
        if (job.dir / (n + '.jpg')).exists():
            files[n + '.jpg'] = {'wraps': 'x only', 'source': s.get('source', 'flow'),
                                 'note': s.get('note', 'bottom edge = horizon haze, top edge = high sky')}
    cells = []
    if job.decals and (job.dir / 'decals.png').exists():
        d = job.decals
        n = int(d.get('grid', 6))
        entry = {'grid': [n, n], 'cellOrder': 'row by row, top-left first: cell c is at column c %% %d, row floor(c / %d)' % (n, n),
                 'blend': 'multiply', 'source': d.get('source', 'flow')}
        entry.update(d.get('notes', {}))
        entry['made'] = sorted(g['kind'] for g in d['groups'] if job.have(g['raw']))
        files['decals.png'] = entry
        cj = job.dir / 'cells.json'
        if not cj.exists():
            raise RecipeError('decals.png exists but cells.json does not: run the decals step first')
        with open(cj, encoding='utf8') as f:
            cells = json.load(f)
    data = {'note': job.r.get('note', 'tile = world units covered by one repeat of the texture. Decals multiply: surface * mix(1, rgb, a * instance alpha).'),
            'files': files, 'decals': cells}
    write_text(json.dumps(data, indent=1), job.dir / 'tex.json')
    print('wrote tex.json', sorted(files))


def make_previews(job):
    pv = job.preview
    pv.mkdir(parents=True, exist_ok=True)
    s = int(job.r.get('preview_size', 400))
    for n in job.bases:
        p = job.dir / (n + '.jpg')
        if not p.exists():
            continue
        im = Image.open(p).convert('RGB')
        t = im.resize((s, s), Image.LANCZOS)
        sheet = Image.new('RGB', (s * 3, s * 3))
        for y in range(3):
            for x in range(3):
                sheet.paste(t, (x * s, y * s))
        sheet.save(pv / (n + '_3x3.jpg'), quality=88)
        # the seam cross at full resolution
        w, h = im.size
        a = np.asarray(im)
        rolled = np.roll(np.roll(a, w // 2, 1), h // 2, 0)
        c = min(s, w // 2, h // 2)
        Image.fromarray(rolled[h // 2 - c:h // 2 + c, w // 2 - c:w // 2 + c]).save(pv / (n + '_seam.jpg'), quality=90)
    for n in job.skies:
        p = job.dir / (n + '.jpg')
        if p.exists():
            a = np.asarray(Image.open(p).convert('RGB'))
            Image.fromarray(np.concatenate([a, a], 1)).resize((2048, 512), Image.LANCZOS).save(pv / (n + '_x2.jpg'), quality=88)
    p = job.dir / 'decals.png'
    if p.exists() and job.decals:
        cells = int(job.decals.get('grid', 6))
        d = np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) / 255
        base = np.array(job.decals.get('preview_base', [.5, .5, .5]), np.float32)
        comp = base * (1 - d[..., 3:]) + base * d[..., :3] * d[..., 3:]
        comp = comp.copy()
        size = d.shape[0]
        for i in range(1, cells):                 # thin guides to read the cell borders
            e = round(i * size / cells)
            comp[e - 1:e + 1, :] = comp[e - 1:e + 1, :] * .92
            comp[:, e - 1:e + 1] = comp[:, e - 1:e + 1] * .92
        Image.fromarray(to8(comp)).resize((1536, 1536), Image.LANCZOS).save(pv / job.decals.get('preview_name', 'decals_on_base.jpg'), quality=90)
    print('previews in', pv)


def main(argv=None):
    ap = argparse.ArgumentParser(description='seamless tiles, skies and a decal sheet from raw pictures')
    ap.add_argument('--dir', required=True, help='where the finished textures go')
    ap.add_argument('--raw', help='raw pictures folder (default <dir>/raw)')
    ap.add_argument('--recipes', help='recipes json (default <dir>/recipes.json)')
    ap.add_argument('--preview', help='preview folder (default <dir>/preview)')
    ap.add_argument('steps', nargs='*', help='base or sky names, decals, json, previews (default all)')
    ap.add_argument('--names', help='comma list, the same as the steps (the app\'s tex_job passes its names this way)')
    args = ap.parse_args(argv)
    args.steps = list(args.steps) + [s.strip() for s in (args.names or '').split(',') if s.strip()]
    try:
        job = Job(args)
        steps = args.steps or list(job.bases) + list(job.skies) + ['decals', 'json', 'previews']
        for step in steps:                      # every name checked before any work starts
            if step not in job.bases and step not in job.skies and step not in ('decals', 'json', 'previews'):
                raise RecipeError('unknown step "%s": use a name from bases or skies in the recipes, or decals, json, previews' % step)
        for step in steps:
            if step in job.bases:
                make_base(job, step)
            elif step in job.skies:
                make_sky(job, step)
            elif step == 'decals':
                make_decals(job)
            elif step == 'json':
                make_json(job)
            elif step == 'previews':
                make_previews(job)
            else:
                raise RecipeError('unknown step "%s": use a name from bases or skies in the recipes, or decals, json, previews' % step)
    except (RecipeError, MissingPicture) as e:
        print('ERROR:', e, file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
