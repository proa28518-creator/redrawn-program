# sheet.py: a labelled contact sheet of any pictures (clay renders, before / after pairs, texture previews, frames). PIL only.
#
#   python sheet.py --out <file.jpg|png> [--cols N] [--width W] [--label] [--bg #rrggbb] <images or folders...>
#     --out    the sheet to write (jpg or png; written atomically)
#     --cols   pictures per row (default: about square)
#     --width  width of the whole sheet in px (default 1800); every cell has the same width, height follows the first picture's shape
#     --label  write each file's name under its picture
#     --bg     background colour (default #202020)
# A folder adds every png / jpg / webp in it, sorted by name. Pictures keep their aspect inside their cell (letterboxed).
import argparse
import math
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

EXTS = {'.png', '.jpg', '.jpeg', '.webp', '.bmp'}


def collect(items):
    out = []
    for it in items:
        p = Path(it)
        if p.is_dir():
            out += sorted(q for q in p.iterdir() if q.suffix.lower() in EXTS and not q.name.startswith('.tmp-'))
        elif p.exists():
            out.append(p)
        else:
            raise FileNotFoundError('no such picture or folder: %s' % p)
    return out


def font(size):
    for name in ('DejaVuSans.ttf', 'arial.ttf', 'Arial.ttf', '/System/Library/Fonts/Helvetica.ttc', '/Library/Fonts/Arial.ttf'):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main(argv=None):
    ap = argparse.ArgumentParser(description='labelled contact sheet')
    ap.add_argument('--out', required=True)
    ap.add_argument('--cols', type=int)
    ap.add_argument('--width', type=int, default=1800)
    ap.add_argument('--label', action='store_true')
    ap.add_argument('--bg', default='#202020')
    ap.add_argument('images', nargs='+')
    args = ap.parse_args(argv)
    try:
        paths = collect(args.images)
    except FileNotFoundError as e:
        print('ERROR:', e, file=sys.stderr)
        return 2
    if not paths:
        print('ERROR: no pictures found in', args.images, file=sys.stderr)
        return 2
    n = len(paths)
    cols = max(1, min(n, args.cols or math.ceil(math.sqrt(n))))
    rows = math.ceil(n / cols)
    gap = 8
    cw = (args.width - gap * (cols + 1)) // cols
    with Image.open(paths[0]) as first:
        ch = max(1, round(cw * first.height / first.width))
    fs = max(12, cw // 22)
    f = font(fs)
    lh = fs + 8 if args.label else 0
    sheet = Image.new('RGB', (args.width, gap + rows * (ch + lh + gap)), args.bg)
    draw = ImageDraw.Draw(sheet)
    for i, p in enumerate(paths):
        r, c = divmod(i, cols)
        x0, y0 = gap + c * (cw + gap), gap + r * (ch + lh + gap)
        with Image.open(p) as im:
            im = im.convert('RGBA')
            k = min(cw / im.width, ch / im.height)
            t = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
            cell = Image.new('RGBA', t.size, args.bg)
            cell.alpha_composite(t)
            sheet.paste(cell.convert('RGB'), (x0 + (cw - t.width) // 2, y0 + (ch - t.height) // 2))
        if args.label:
            draw.text((x0 + 2, y0 + ch + 3), p.name, fill=(230, 230, 230), font=f)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.parent / ('.tmp-' + out.name)
    fmt = 'PNG' if out.suffix.lower() == '.png' else 'JPEG'
    sheet.save(tmp, format=fmt, **({'quality': 90} if fmt == 'JPEG' else {}))
    os.replace(tmp, out)
    print('wrote', out, sheet.width, 'x', sheet.height, '|', n, 'pictures')
    return 0


if __name__ == '__main__':
    sys.exit(main())
