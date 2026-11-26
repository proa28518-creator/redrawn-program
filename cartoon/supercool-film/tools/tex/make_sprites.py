# make_sprites.py: painted cut-out billboard sprites from sprite sheets drawn on solid magenta (#FF00FF), for any project.
#
#   python make_sprites.py --dir <project>/assets/tex [--raw <dir>] [--recipes <json>] [--preview <dir>] [sheet names...]
#     --dir      the texture folder; sprites go to <dir>/sprites/<name>.png and <dir>/sprites/sprites.json (where the renderer reads them)
#     --raw      the sheets, <sheet name>.png (default <dir>/raw)
#     --recipes  the recipes (default <dir>/recipes.json), section "sprites"
#     --preview  sprites_on_yellow.jpg: every sprite at its height next to a character bar (default <dir>/preview)
#     sheet names: only these sheets (the others' sprites stay in sprites.json if their files exist). None = every sheet.
#     --names a,b  the same sheet names as one comma list (how the app's tex_job tool passes them)
# Magenta keys out holes too (chair legs, wire loops). Each sprite is written atomically. Floor sprites stand on the image's
# bottom edge, hanging ones hang from its top edge (anchor in sprites.json).
#
# recipes.json "sprites" section:
#   "max_side": 1024                 longest side of a finished sprite in px
#   "pad": 6                         px of empty margin on every side but the resting one
#   "ink": [r, g, b]                 the outline colour soft edge pixels lean on (no pink or white fringe)
#   "character_height": 3.2          world units of a character, for the preview bar and the note
#   "sheets": [ {
#      "name": "<sheet>"             raw picture name (also the sheet id in sprites.json)
#      "trim_bottom": 16             px cut off the bottom of every object (a drawn ground line), optional
#      "prompt", "aspect", "note"    for whoever makes the picture; ignored here
#      "sprites": [ {"name": "oil_drum", "height": 1.8, "kind": "floor" | "hanging", "skip": false} ]
#             in reading order (rows top to bottom, left to right); height = world units from the anchor edge to the other end;
#             skip = an object on the sheet that is not delivered (an older file of that name is removed)
#   } ]
import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_tex2 import write_text  # noqa: E402


class RecipeError(Exception):
    pass


def key(a, ink):
    """alpha + colour from a magenta background: magenta-ness is how far min(R, B) rises above G"""
    border = np.concatenate([a[:12].reshape(-1, 3), a[-12:].reshape(-1, 3), a[:, :12].reshape(-1, 3), a[:, -12:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    full = float(min(bg[0], bg[2]) - bg[1])
    if full < .4:
        raise ValueError('the sheet background is not magenta (border colour %s): ask for a plain solid #FF00FF background' % np.round(bg, 2))
    m = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
    alpha = 1 - np.clip((m - .06) / (full * .88 - .06), 0, 1)
    # the object's colour under a soft edge. The edge is the ink outline, so soft pixels lean on ink: no pink or white fringe can survive
    rgb = (a - (1 - alpha[..., None]) * bg) / np.maximum(alpha[..., None], .08)
    edge = np.clip((.96 - alpha) / .3, 0, 1)[..., None]
    rgb = np.clip(rgb, 0, 1) * (1 - edge) + ink * edge
    return rgb, alpha


def clusters(alpha, want):
    """the wanted separate objects: grow the solid pixels until exactly enough clusters remain, widest reach first (a chair's casters stay with it)"""
    mask = alpha > .5
    gap = ndi.distance_transform_edt(~mask)
    for reach in (80, 60, 45, 32, 22, 14, 8, 4):
        lab, n = ndi.label(gap <= reach)
        if n >= want:
            break
    else:
        raise ValueError('the sheet has fewer separate objects than the recipe lists: %d of %d (objects touching, or the list is too long)' % (n, want))
    areas = ndi.sum(mask, lab, range(1, n + 1))
    keep = [int(i) + 1 for i in np.argsort(areas)[::-1][:want]]
    cents = ndi.center_of_mass(mask, lab, keep)
    by_y = sorted(zip(keep, cents), key=lambda kc: kc[1][0])
    rows, row = [], [by_y[0]]
    for kc in by_y[1:]:
        if kc[1][0] - row[-1][1][0] > alpha.shape[0] * .15:
            rows.append(row)
            row = []
        row.append(kc)
    rows.append(row)
    return lab, [k for r in rows for k, _ in sorted(r, key=lambda kc: kc[1][1])], reach, n


def cut(rgb, alpha, region, hanging, pad):
    near = ndi.binary_dilation(region, iterations=3)
    al = alpha * near
    al[al < 2 / 255] = 0
    ys, xs = np.where(al > 0)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    # the resting edge is cut at the first solid row, so the object really touches it (no faint row that makes it float)
    solid = np.where((al > .5).any(1))[0]
    if hanging:
        y0 = solid.min()
    else:
        y1 = solid.max() + 1
    al, col = al[y0:y1, x0:x1], rgb[y0:y1, x0:x1]
    # empty margin on every side except the one the object rests on, so no box edge can show
    top, bottom = (0, pad) if hanging else (pad, 0)
    al = np.pad(al, ((top, bottom), (pad, pad)))
    col = np.pad(col, ((top, bottom), (pad, pad), (0, 0)), mode='edge')
    # colour under transparent pixels = the nearest solid colour, so filtering and mipmaps never bring a fringe
    idx = ndi.distance_transform_edt(al < .6, return_distances=False, return_indices=True)
    col = col[idx[0], idx[1]]
    return np.dstack([col, al])


def scaled(rgba, max_side):
    h, w = rgba.shape[:2]
    k = min(1, max_side / max(h, w))
    if k == 1:
        return rgba
    # premultiplied so the edge stays clean
    a = rgba[..., 3:]
    pm = np.dstack([rgba[..., :3] * a, a]).astype(np.float32)
    nw, nh = int(w * k), int(h * k)
    ch = [np.asarray(Image.fromarray(pm[..., i], 'F').resize((nw, nh), Image.LANCZOS)) for i in range(4)]
    al = np.clip(ch[3], 0, 1)
    col = np.clip(np.stack(ch[:3], -1) / np.maximum(al[..., None], .02), 0, 1)
    idx = ndi.distance_transform_edt(al < .6, return_distances=False, return_indices=True)
    return np.dstack([col[idx[0], idx[1]], al])


def write_png(rgba, path):
    path = Path(path)
    tmp = path.parent / ('.tmp-' + path.name)
    Image.fromarray((np.clip(rgba, 0, 1) * 255 + .5).astype(np.uint8), 'RGBA').save(tmp, format='PNG', optimize=True)
    os.replace(tmp, path)


def preview(entries, out_dir, preview_dir, char_h):
    """every sprite at its height on mid-yellow, with a bar the height of a character"""
    ppd, margin = 150, 30
    base = np.array([204, 179, 92], np.uint8)
    rows, row, x = [], [], margin + 40
    for e in entries:
        im = Image.open(out_dir / e['file'])
        w = max(1, int(ppd * e['height'] * im.width / im.height))
        if x + w + margin > 1800:
            rows.append(row)
            row, x = [], margin + 40
        row.append((e, im.resize((w, int(ppd * e['height'])), Image.LANCZOS)))
        x += w + margin
    if row:
        rows.append(row)
    heights = [max(int(char_h * ppd) if r is rows[0] else 0, max(i.height for _, i in r)) + 2 * margin for r in rows]
    sheet = Image.new('RGBA', (1800, sum(heights)), tuple(base.tolist()) + (255,))
    y = 0
    for r, h in zip(rows, heights):
        x = margin
        if r is rows[0]:                        # the character's height, for scale
            sheet.paste((70, 60, 45, 255), (x, y + h - margin - int(char_h * ppd), x + 10, y + h - margin))
        x += 40
        for e, im in r:
            top = y + margin if e['anchor'] == 'top' else y + h - margin - im.height
            sheet.alpha_composite(im, (x, top))
            x += im.width + margin
        y += h
    preview_dir.mkdir(parents=True, exist_ok=True)
    sheet.convert('RGB').save(preview_dir / 'sprites_on_yellow.jpg', quality=90)


def check_recipe(sec):
    sheets = sec.get('sheets')
    if not isinstance(sheets, list):
        raise RecipeError('recipe sprites is missing the list "sheets"')
    for i, job in enumerate(sheets):
        where = 'sprites.sheets[%d]' % i
        for f in ('name', 'sprites'):
            if f not in job:
                raise RecipeError('recipe %s is missing the field "%s"' % (where, f))
        for j, s in enumerate(job['sprites']):
            w2 = '%s.sprites[%d]' % (where, j)
            for f in ('name', 'height', 'kind'):
                if f not in s:
                    raise RecipeError('recipe %s is missing the field "%s"' % (w2, f))
            if s['kind'] not in ('floor', 'hanging'):
                raise RecipeError('recipe %s field "kind" must be "floor" or "hanging", got %r' % (w2, s['kind']))
            if not isinstance(s['height'], (int, float)) or s['height'] <= 0:
                raise RecipeError('recipe %s field "height" must be a positive number, got %r' % (w2, s['height']))
    return sheets


def main(argv=None):
    ap = argparse.ArgumentParser(description='cut-out billboard sprites from magenta sprite sheets')
    ap.add_argument('--dir', required=True)
    ap.add_argument('--raw')
    ap.add_argument('--recipes')
    ap.add_argument('--preview')
    ap.add_argument('sheets', nargs='*')
    ap.add_argument('--names', help='comma list of sheets, the same as the positional sheets (the app\'s tex_job passes its names this way)')
    args = ap.parse_args(argv)
    args.sheets = list(args.sheets) + [s.strip() for s in (args.names or '').split(',') if s.strip()]
    tex = Path(args.dir).resolve()
    raw_dir = Path(args.raw).resolve() if args.raw else tex / 'raw'
    rec = Path(args.recipes).resolve() if args.recipes else tex / 'recipes.json'
    preview_dir = Path(args.preview).resolve() if args.preview else tex / 'preview'
    out = tex / 'sprites'
    try:
        if not rec.exists():
            raise RecipeError('no recipes file at %s (pass --recipes)' % rec)
        with open(rec, encoding='utf8') as f:
            r = json.load(f)
        if 'sprites' not in r:
            raise RecipeError('the recipes file %s has no "sprites" section' % rec)
        sec = r['sprites']
        sheets = check_recipe(sec)
        unknown = [n for n in args.sheets if n not in [s['name'] for s in sheets]]
        if unknown:
            raise RecipeError('unknown sheet(s) %s: not in sprites.sheets' % unknown)
    except (RecipeError, json.JSONDecodeError) as e:
        print('ERROR:', e, file=sys.stderr)
        return 2
    max_side, pad = int(sec.get('max_side', 1024)), int(sec.get('pad', 6))
    ink = np.array(sec.get('ink', [.09, .07, .06]), np.float32)
    char_h = float(sec.get('character_height', 3.2))
    out.mkdir(parents=True, exist_ok=True)
    entries = []
    failed = []
    for job in sheets:
        raw = raw_dir / (job['name'] + '.png')
        redo = not args.sheets or job['name'] in args.sheets
        if not redo:                            # not asked for: keep what exists
            for s in job['sprites']:
                if not s.get('skip') and (out / (s['name'] + '.png')).exists():
                    im = Image.open(out / (s['name'] + '.png'))
                    entries.append({'name': s['name'], 'file': s['name'] + '.png', 'height': s['height'], 'kind': s['kind'],
                                    'anchor': 'top' if s['kind'] == 'hanging' else 'bottom', 'aspect': round(im.width / im.height, 4), 'sheet': job['name']})
            continue
        if not raw.exists():
            print(job['name'], 'not made yet (%s): make it with make_picture first' % raw)
            continue
        a = np.asarray(Image.open(raw).convert('RGB')).astype(np.float32) / 255
        try:
            rgb, alpha = key(a, ink)
            lab, order, reach, n = clusters(alpha, len(job['sprites']))
        except ValueError as e:
            print('ERROR in sheet', job['name'] + ':', e, file=sys.stderr)
            failed.append(job['name'])
            continue
        print(job['name'], 'objects at reach', reach, 'found', n)
        for k, s in zip(order, job['sprites']):
            path = out / (s['name'] + '.png')
            if s.get('skip'):
                if path.exists():
                    path.unlink()
                print(' ', s['name'], 'skipped')
                continue
            hanging = s['kind'] == 'hanging'
            region = lab == k
            if job.get('trim_bottom'):              # a drawn ground line under the object: cut it off, the object then rests on the ground
                rows = np.where((region & (alpha > .5)).any(1))[0]
                region = region.copy()
                region[rows.max() - job['trim_bottom'] + 1:] = False
            rgba = scaled(cut(rgb, alpha, region, hanging, pad), max_side)
            al = rgba[..., 3]
            sides = float(max(al[:, 0].max(), al[:, -1].max(), (al[-1] if hanging else al[0]).max()))
            mag = np.minimum(rgba[..., 0], rgba[..., 2]) - rgba[..., 1]
            pink = int(((mag > .12) & (al > .1)).sum())
            rest = float((al[0] if hanging else al[-1]).max())
            print(' ', s['name'], rgba.shape[1], 'x', rgba.shape[0], '| alpha on free edges', sides, '| on resting edge %.2f' % rest, '| pink px', pink)
            if sides != 0:
                print('ERROR: %s touches a free edge of its box (alpha %.3f): the object runs into the sheet border or a neighbour' % (s['name'], sides), file=sys.stderr)
                failed.append(s['name'])
                continue
            write_png(rgba, path)
            entries.append({'name': s['name'], 'file': s['name'] + '.png', 'height': s['height'], 'kind': s['kind'],
                            'anchor': 'top' if hanging else 'bottom', 'aspect': round(rgba.shape[1] / rgba.shape[0], 4), 'sheet': job['name']})
    # props taken from the app's prop library (prop_library use: "library" key) are not in the recipe: keep them, unless a
    # sprite made here now has the same name or their file is gone
    try:
        with open(out / 'sprites.json', encoding='utf8') as f:
            old = json.load(f)
        old = old if isinstance(old, list) else old.get('sprites') or old.get('items') or []
    except (OSError, ValueError, AttributeError):
        old = []
    made = {e['name'] for e in entries}
    kept = [e for e in old if isinstance(e, dict) and e.get('library') and e.get('file') and e.get('name') not in made and (out / str(e['file'])).is_file()]
    if kept:
        print(len(kept), 'props from the prop library kept')
    data = {'note': 'Flat cut-out billboards. height = D from anchor edge to the other end (a character is about %s D). width = height * aspect. '
                    'anchor bottom: stands on the bottom edge of the image. anchor top: hangs from the top edge at the ceiling.' % (('%g' % char_h)),
            'sprites': entries + kept}
    write_text(json.dumps(data, indent=1), out / 'sprites.json')
    if entries:
        preview(entries, out, preview_dir, char_h)
    print(len(entries), 'sprites')
    if failed:
        print('ERROR: not delivered:', failed, file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
