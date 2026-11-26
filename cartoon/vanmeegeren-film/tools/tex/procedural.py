# procedural.py: raw pictures drawn in code, for a project with no picture service (no Google Flow) or a pattern code does better.
# numpy + scipy + pillow only. Windows and Mac.
#
#   python procedural.py --dir <project>/assets/tex [--raw <dir>] [--recipes <json>] [--names a,b] [names...]
#
# Reads "procedural" from recipes.json and writes each entry as a RAW picture, <raw>/<name>.png + <name>.png.json, so the usual
# make_tex.py (tex_job tiles / decals) turns it into the finished tile or decal cells exactly like a Flow picture or a web photo.
#   surfaces: drawn on a torus, so they ALREADY TILE (the sidecar says "wraps": true and make_tex.py skips its seam cut)
#   marks:    six marks on white in a 3 x 2 layout, the input the decals step expects (a decals group "raw": "<name>")
#
# recipes.json:
#   "procedural": { "<name>": { "kind": "<kind>", "seed": 1, "colors": [[r,g,b], [r,g,b]], "count": 6, "pattern": "...", "dirt": 0.4,
#                               "scale": 1.0, "size": 2048 } }
#   colors: base and accent, 0..1 (each kind has defaults). count: tiles / planks / bricks / panels / wallpaper repeats per side.
#   dirt: 0..1 grime gathered at seams and in blotches. scale: bigger = larger features. size: default the recipes' tile_size.
#   The final colour and contrast still come from the bases recipe (mean, detail, chroma): draw the structure here, grade there.
#
# Surface kinds: plaster, concrete, carpet, wallpaper (pattern: stripes | pinstripe | diamonds | damask | dots), tiles (pattern:
#   plain | perforated | fissured: ceiling tiles), floor_tiles, panels, planks, brick, metal, rust, ground, grass, bark, noise.
# Mark kinds (decals): stains, grime, scuffs, damp, cracks, splatter.
import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_tex2 import to8  # noqa: E402

SURFACES = ('plaster', 'concrete', 'carpet', 'wallpaper', 'tiles', 'floor_tiles', 'panels', 'planks', 'brick', 'metal', 'rust',
            'ground', 'grass', 'bark', 'noise')
MARKS = ('stains', 'grime', 'scuffs', 'damp', 'cracks', 'splatter')
DEFAULT_COLORS = {
    'plaster': [[.78, .75, .68], [.55, .5, .42]], 'concrete': [[.55, .55, .53], [.4, .39, .36]],
    'carpet': [[.62, .55, .38], [.45, .38, .24]], 'wallpaper': [[.8, .74, .5], [.66, .58, .34]],
    'tiles': [[.82, .8, .74], [.58, .55, .48]], 'floor_tiles': [[.72, .7, .66], [.45, .43, .4]],
    'panels': [[.5, .54, .55], [.3, .32, .32]], 'planks': [[.55, .4, .26], [.36, .24, .14]],
    'brick': [[.6, .32, .24], [.72, .7, .64]], 'metal': [[.52, .54, .56], [.36, .37, .38]],
    'rust': [[.45, .47, .48], [.5, .27, .14]], 'ground': [[.48, .4, .3], [.34, .3, .24]],
    'grass': [[.32, .48, .2], [.55, .58, .28]], 'bark': [[.4, .32, .25], [.22, .17, .13]],
    'noise': [[.5, .5, .5], [.35, .35, .35]],
    'stains': [[.55, .45, .3]], 'grime': [[.3, .27, .22]], 'scuffs': [[.25, .23, .22]], 'damp': [[.38, .4, .3]],
    'cracks': [[.15, .14, .13]], 'splatter': [[.35, .3, .24]],
}


class ProcError(Exception):
    pass


# ---------- tileable building blocks (everything periodic on the size x size torus) ----------
def spectral(n, rng, lo, hi, beta=2.0, aniso=(1.0, 1.0), angle=0.0):
    """band-limited noise with a 1/f^beta falloff between lo and hi cycles per tile; tiles by construction. aniso stretches it
    (aniso (1, 8) = streaks along x), angle turns that stretch. Mean 0, std 1."""
    w = rng.standard_normal((n, n))
    F = np.fft.rfft2(w)
    fy = np.fft.fftfreq(n)[:, None] * n
    fx = np.fft.rfftfreq(n)[None, :] * n
    c, s = np.cos(angle), np.sin(angle)
    u, v = fx * c + fy * s, -fx * s + fy * c
    f = np.sqrt((u * aniso[0]) ** 2 + (v * aniso[1]) ** 2)
    r = np.sqrt(fx ** 2 + fy ** 2)
    band = np.clip((r - lo * .7) / max(lo * .6, 1e-3), 0, 1) * np.clip((hi * 1.3 - r) / max(hi * .6, 1e-3), 0, 1)
    out = np.fft.irfft2(F * band / np.maximum(f, 1) ** (beta / 2), s=(n, n))
    return ((out - out.mean()) / (out.std() + 1e-9)).astype(np.float32)


def blur(a, s):
    return ndi.gaussian_filter(a, s, mode='wrap')


def sstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def grid(n):
    """u, v in 0..1 over the tile (pixel centres)"""
    t = (np.arange(n, dtype=np.float32) + .5) / n
    return np.meshgrid(t, t)


def cell_rand(ix, iy, seed, k=0):
    """a stable 0..1 random number per cell index (hash; periodic as long as the indices are taken mod the count)"""
    h = (ix.astype(np.int64) * 73856093) ^ (iy.astype(np.int64) * 19349663) ^ (seed * 83492791 + k * 2654435761)
    h = (h ^ (h >> 13)) * 1274126177
    return ((h ^ (h >> 16)) & 0xFFFF).astype(np.float32) / 65535


def colorize(lum, colors, rng, n, mix=None, drift=.04):
    """luminance 0..1 -> rgb between base and accent (mix = where the accent shows, default by luminance), with a slow hue drift"""
    base, acc = np.array(colors[0], np.float32), np.array(colors[1] if len(colors) > 1 else colors[0], np.float32)
    m = (1 - lum) if mix is None else mix
    rgb = base[None, None] * (1 - m[..., None]) + acc[None, None] * m[..., None]
    rgb = rgb * (.75 + .5 * lum[..., None])
    hue = np.stack([spectral(n, rng, 1, 4) for _ in range(3)], -1) * drift
    return np.clip(rgb + hue, 0, 1)


def grime(n, rng, near, amount, scale=1.0):
    """dirt that gathers: `near` (0..1, 1 at seams / corners) times large noise, so there are clean stretches and bad stretches"""
    big = sstep(-.3, 1.2, spectral(n, rng, 1, 5 / scale))
    mid = sstep(-.5, 1.5, spectral(n, rng, 4, 24 / scale))
    return np.clip(amount * (near * .7 + .3) * big * (.6 + .4 * mid), 0, 1)


# ---------- surfaces ----------
def k_plaster(n, rng, o):
    sc = o['scale']
    lum = .55 + .14 * spectral(n, rng, 2, 12 / sc) + .08 * spectral(n, rng, 12 / sc, 60 / sc) + .05 * spectral(n, rng, 60, n / 3, beta=.5)
    pits = sstep(2.6, 3.4, spectral(n, rng, n / 8, n / 3, beta=0))
    lum = lum - pits * .18
    g = grime(n, rng, np.zeros((n, n), np.float32), o['dirt'], sc)
    return colorize(np.clip(lum * (1 - .35 * g), 0, 1), o['colors'], rng, n)


def k_concrete(n, rng, o):
    sc = o['scale']
    lum = .55 + .12 * spectral(n, rng, 1, 8 / sc) + .1 * spectral(n, rng, 8 / sc, 50 / sc) + .09 * spectral(n, rng, 50, n / 2.5, beta=.3)
    pores = sstep(2.3, 3.0, spectral(n, rng, n / 10, n / 3, beta=0))
    agg = sstep(.8, 1.6, spectral(n, rng, 30 / sc, 90 / sc, beta=0))   # small stones showing through
    lum = lum - pores * .25 + agg * .05
    g = grime(n, rng, np.zeros((n, n), np.float32), o['dirt'], sc)
    return colorize(np.clip(lum * (1 - .4 * g), 0, 1), o['colors'], rng, n)


def k_carpet(n, rng, o):
    sc = o['scale']
    # tufts: fine noise in two crossing directions (the loops of the pile) plus specks of lighter and darker fibre
    a = spectral(n, rng, n / 9, n / 2.5, beta=0, aniso=(1, 2.2), angle=.7)
    b = spectral(n, rng, n / 9, n / 2.5, beta=0, aniso=(1, 2.2), angle=-.8)
    tuft = .5 * a + .5 * b
    speck = sstep(1.8, 2.6, spectral(n, rng, n / 6, n / 2, beta=0)) - sstep(1.8, 2.6, spectral(n, rng, n / 6, n / 2, beta=0))
    wear = spectral(n, rng, 1, 6 / sc)                                   # walked paths: broad lighter / darker areas
    lum = .5 + .1 * tuft + .1 * speck + .07 * wear
    pat = o.get('pattern')
    if pat in ('diamonds', 'stripes', 'dots', 'damask'):
        u, v = grid(n)
        lum = lum - .07 * motif(u, v, o['count'], pat)
    g = grime(n, rng, np.zeros((n, n), np.float32), o['dirt'], sc)
    return colorize(np.clip(lum * (1 - .35 * g), 0, 1), o['colors'], rng, n, drift=.03)


def motif(u, v, count, pat):
    """0..1 where the printed pattern is, `count` repeats per side (integer, so it tiles)"""
    c = max(1, int(count))
    x, y = u * c, v * c
    if pat == 'stripes':
        f = x % 1
        return np.maximum(sstep(.02, 0, np.abs(f - .25) - .09), .6 * sstep(.012, 0, np.abs(f - .62) - .012))
    if pat == 'pinstripe':
        f = (x * 2) % 1
        return sstep(.015, 0, np.abs(f - .5) - .01)
    if pat == 'diamonds':
        a, b = (x + y) % 1, (x - y) % 1
        line = np.minimum(np.abs(a - .5), np.abs(b - .5))
        dot = np.hypot((x % 1) - .5, (y % 1) - .5)
        return np.maximum(sstep(.03, 0, line - .012), sstep(.02, 0, dot - .06))
    if pat == 'dots':
        rowshift = (np.floor(y) % 2) * .5
        return sstep(.02, 0, np.hypot(((x + rowshift) % 1) - .5, (y % 1) - .5) - .11)
    if pat == 'damask':
        # a flower motif on a half-drop: rows of motifs shifted half a cell (count is made even, so it still tiles)
        c2 = c + (c % 2)
        x, y = u * c2, v * c2
        shift = (np.floor(x) % 2) * .5
        px, py = (x % 1) - .5, ((y + shift) % 1) - .5
        r, th = np.hypot(px, py * .8), np.arctan2(py, px)
        petal = sstep(.02, 0, r - (.17 + .09 * np.cos(6 * th)))
        ring = sstep(.012, 0, np.abs(r - .3) - .008) * (np.cos(12 * th) > 0)
        stem = sstep(.012, 0, np.abs(px) - .01) * (np.abs(py) > .32)
        hole = sstep(.012, 0, r - .05)
        return np.clip(petal - hole * .8 + ring * .7 + stem * .6, 0, 1)
    raise ProcError('pattern "%s" is not one of stripes, pinstripe, diamonds, dots, damask' % pat)


def k_wallpaper(n, rng, o):
    u, v = grid(n)
    pat = o.get('pattern') or 'damask'
    m = motif(u, v, o['count'], pat)
    # printed: a slightly soft, uneven print (ink not quite even), paper grain, faded areas
    m = blur(m, 1.2) * (.85 + .15 * spectral(n, rng, 6, 40))
    paper = .58 + .05 * spectral(n, rng, 40, n / 3, beta=.4) + .07 * spectral(n, rng, 1, 5)
    lum = paper - .12 * m
    g = grime(n, rng, np.zeros((n, n), np.float32), o['dirt'], o['scale'])
    return colorize(np.clip(lum * (1 - .3 * g), 0, 1), o['colors'], rng, n, mix=np.clip(m * .9, 0, 1), drift=.025)


def k_tiles(n, rng, o, floor=False):
    u, v = grid(n)
    c = max(1, int(o['count']))
    ix, iy = np.floor(u * c) % c, np.floor(v * c) % c
    fu, fv = (u * c) % 1, (v * c) % 1
    d = np.minimum(np.minimum(fu, 1 - fu), np.minimum(fv, 1 - fv))
    gw = .03 if floor else .018
    grout = sstep(gw, gw * .4, d)
    # a small bevel: lit from the top left, so each tile reads as a slab, not a printed grid
    bevel = (sstep(gw * 3, gw, fu) - sstep(gw * 3, gw, 1 - fu) + sstep(gw * 3, gw, fv) - sstep(gw * 3, gw, 1 - fv)) * .5
    tone = (cell_rand(ix, iy, o['seed']) - .5) * (.1 if floor else .06)
    surf = .05 * spectral(n, rng, 20, n / 3, beta=.6) + .05 * spectral(n, rng, 2, 10)
    lum = .58 + tone + surf + bevel * .06
    pat = o.get('pattern') or ('plain' if floor else 'perforated')
    if pat == 'perforated':            # the pin holes of an office ceiling tile
        holes = sstep(2.2, 2.9, spectral(n, rng, n / 7, n / 2.5, beta=0))
        lum = lum - holes * .22 * (d > gw * 2)
    elif pat == 'fissured':            # worm-like fissures
        f = np.abs(spectral(n, rng, n / 30, n / 8, beta=1))
        lum = lum - sstep(.12, .02, f) * .18 * (d > gw * 2)
    elif pat != 'plain':
        raise ProcError('tiles pattern "%s" is not one of plain, perforated, fissured' % pat)
    lum = lum * (1 - grout * (.45 if floor else .3))
    g = grime(n, rng, sstep(.12, 0, d), o['dirt'], o['scale'])
    return colorize(np.clip(lum * (1 - .4 * g), 0, 1), o['colors'], rng, n, mix=grout * .8 + g * .2, drift=.025)


def k_panels(n, rng, o):
    u, v = grid(n)
    c = max(1, int(o['count']))
    cu, cv = c, max(1, c // 2)                       # plates twice as wide as tall
    fu, fv = (u * cu) % 1, (v * cv) % 1
    du, dv = np.minimum(fu, 1 - fu) / cv, np.minimum(fv, 1 - fv) / cu
    d = np.minimum(du, dv)
    seam = sstep(.006, .002, d)
    brushed = spectral(n, rng, n / 12, n / 2.5, beta=.5, aniso=(1, 9))
    tone = (cell_rand(np.floor(u * cu) % cu, np.floor(v * cv) % cv, o['seed']) - .5) * .08
    lum = .56 + tone + .04 * brushed + .06 * spectral(n, rng, 2, 10)
    # rivets along every plate edge
    rv = max(4, int(8 / max(o['scale'], .3)))
    ru, rvv = (u * cu * rv) % 1, (v * cv * rv / 2) % 1
    near_v, near_u = (np.minimum(fv, 1 - fv) < .06), (np.minimum(fu, 1 - fu) < .03)
    riv = (sstep(.22, .12, np.hypot(ru - .5, (np.minimum(fv, 1 - fv) - .03) * cu * rv / cv)) * near_v
           + sstep(.22, .12, np.hypot((np.minimum(fu, 1 - fu) - .015) * cv * rv / 2 / cu * 2, rvv - .5)) * near_u)
    riv = np.clip(riv, 0, 1)
    lum = lum * (1 - seam * .55) + riv * .1 - blur(riv, 2) * .04
    g = grime(n, rng, sstep(.05, 0, d), o['dirt'], o['scale'])
    return colorize(np.clip(lum * (1 - .45 * g), 0, 1), o['colors'], rng, n, mix=seam * .6 + g * .5, drift=.02)


def k_planks(n, rng, o):
    u, v = grid(n)
    c = max(1, int(o['count']))
    row = np.floor(v * c) % c
    fv = (v * c) % 1
    # each board has its own end joint and grain offset
    joint = cell_rand(row, row * 0, o['seed'], 1)
    fu = (u - joint) % 1
    gap = np.maximum(sstep(.035, .01, np.minimum(fv, 1 - fv)), sstep(.006, .002, np.minimum(fu, 1 - fu)))
    grain = spectral(n, rng, n / 40, n / 4, beta=1, aniso=(1, 14))
    rings = np.sin((v * c * 9 + grain * .35 + cell_rand(row, row * 0, o['seed'], 2) * 6) * 2 * np.pi)
    tone = (cell_rand(row, row * 0, o['seed'], 3) - .5) * .14
    lum = .55 + tone + .07 * grain + .04 * rings + .05 * spectral(n, rng, 1, 6)
    knots = sstep(2.7, 3.2, spectral(n, rng, 8, 30, beta=0, aniso=(1, 3)))
    lum = lum - knots * .15 - gap * .35
    g = grime(n, rng, sstep(.15, 0, np.minimum(fv, 1 - fv)), o['dirt'], o['scale'])
    return colorize(np.clip(lum * (1 - .35 * g), 0, 1), o['colors'], rng, n, drift=.03)


def k_brick(n, rng, o):
    u, v = grid(n)
    rows = max(2, int(o['count']) * 2)
    rows += rows % 2
    per = max(1, rows // 3)
    y = v * rows
    r = np.floor(y) % rows
    x = u * per + (r % 2) * .5
    bx = np.floor(x) % per
    fu, fv = x % 1, y % 1
    d = np.minimum(np.minimum(fu, 1 - fu) * 2.4 / rows * per * 2, np.minimum(fv, 1 - fv))
    chip = .03 * spectral(n, rng, n / 20, n / 5, beta=0)
    mortar = sstep(.07, .04, d + chip)
    tone = (cell_rand(bx, r, o['seed']) - .5) * .18
    lum = .5 + tone + .06 * spectral(n, rng, 20, n / 3, beta=.5) + .04 * spectral(n, rng, 2, 8)
    g = grime(n, rng, np.zeros((n, n), np.float32), o['dirt'], o['scale'])
    out = colorize(np.clip(lum * (1 - .3 * g), 0, 1), o['colors'][:1] * 2, rng, n)
    mort = colorize(np.clip(.55 + .05 * spectral(n, rng, 30, n / 3), 0, 1), o['colors'][1:] * 2 if len(o['colors']) > 1 else o['colors'], rng, n)
    return out * (1 - mortar[..., None]) + mort * mortar[..., None]


def k_metal(n, rng, o, rust=False):
    sc = o['scale']
    lum = .55 + .08 * spectral(n, rng, 1, 8 / sc) + .04 * spectral(n, rng, n / 10, n / 2.5, beta=.4, aniso=(1, 6))
    mix = np.zeros((n, n), np.float32)
    if rust:
        r = spectral(n, rng, 2, 20 / sc) + .5 * spectral(n, rng, 20 / sc, 80 / sc)
        mix = sstep(.1, 1.0, r + o['dirt'] - .4)
        pits = sstep(2.2, 3.0, spectral(n, rng, n / 8, n / 3, beta=0)) * mix
        lum = lum - .1 * mix - pits * .15 + .05 * mix * spectral(n, rng, 40, n / 3)
    g = grime(n, rng, np.zeros((n, n), np.float32), o['dirt'] * (.5 if rust else 1), sc)
    return colorize(np.clip(lum * (1 - .35 * g), 0, 1), o['colors'], rng, n, mix=mix if rust else None, drift=.02)


def k_ground(n, rng, o):
    sc = o['scale']
    lum = .5 + .12 * spectral(n, rng, 1, 8 / sc) + .08 * spectral(n, rng, 8, 60 / sc) + .06 * spectral(n, rng, 60, n / 2.5, beta=.3)
    # pebbles: soft round bumps lit from the top left
    p = sstep(1.9, 2.6, blur(spectral(n, rng, 40 / sc, 120 / sc, beta=0), 1))
    lum = lum + .12 * (p - np.roll(np.roll(p, 2, 0), 2, 1))
    return colorize(np.clip(lum, 0, 1), o['colors'], rng, n, mix=sstep(.7, .3, lum), drift=.04)


def k_grass(n, rng, o):
    # blades: tall thin noise in a few leaning directions, darker at the roots between them
    blades = sum(spectral(n, rng, n / 8, n / 2.2, beta=0, aniso=(1, 6), angle=a) for a in (-.3, 0, .35)) / 3
    clumps = spectral(n, rng, 3, 20)
    lum = .5 + .2 * blades + .04 * clumps - .08 * sstep(.4, 1.6, -blades)
    return colorize(np.clip(lum, 0, 1), o['colors'], rng, n, mix=sstep(.2, .8, .5 + .12 * clumps + .3 * blades), drift=.03)


def k_bark(n, rng, o):
    ridge = np.abs(spectral(n, rng, 4, 40, beta=1.2, aniso=(1, 6)))
    cracks = sstep(.25, .05, ridge)
    lum = .55 + .1 * spectral(n, rng, n / 20, n / 4, beta=.6, aniso=(1, 4)) + .05 * spectral(n, rng, 1, 6) - cracks * .35
    return colorize(np.clip(lum, 0, 1), o['colors'], rng, n, mix=cracks, drift=.03)


def k_noise(n, rng, o):
    lum = .5 + .15 * spectral(n, rng, 1, 10 / o['scale']) + .07 * spectral(n, rng, 10, n / 3, beta=.5)
    return colorize(np.clip(lum, 0, 1), o['colors'], rng, n)


def surface(kind, n, rng, o):
    f = {'plaster': k_plaster, 'concrete': k_concrete, 'carpet': k_carpet, 'wallpaper': k_wallpaper, 'tiles': k_tiles,
         'floor_tiles': lambda n, r, o: k_tiles(n, r, o, floor=True), 'panels': k_panels, 'planks': k_planks, 'brick': k_brick,
         'metal': k_metal, 'rust': lambda n, r, o: k_metal(n, r, o, rust=True), 'ground': k_ground, 'grass': k_grass,
         'bark': k_bark, 'noise': k_noise}[kind]
    return f(n, rng, o)


# ---------- marks on white (decals) ----------
def local_noise(shape, rng, s):
    a = ndi.gaussian_filter(rng.standard_normal(shape), s)
    return a / (a.std() + 1e-9)


def stroke(canvas, pts, width):
    """a polyline stamped densely into canvas (later blurred to the width)"""
    h, w = canvas.shape
    for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
        k = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        xs, ys = np.linspace(x0, x1, k), np.linspace(y0, y1, k)
        ok = (xs >= 0) & (xs < w) & (ys >= 0) & (ys < h)
        canvas[ys[ok].astype(int), xs[ok].astype(int)] = np.maximum(canvas[ys[ok].astype(int), xs[ok].astype(int)], width)


def mark(kind, c, rng):
    """one mark in a c x c cell: ink 0..1 (0 = paper)"""
    yy, xx = np.mgrid[0:c, 0:c].astype(np.float32)
    cx, cy = c / 2 + rng.uniform(-.05, .05) * c, c / 2 + rng.uniform(-.05, .05) * c
    th = np.arctan2(yy - cy, xx - cx)
    rr = np.hypot(xx - cx, yy - cy) / c
    edge = local_noise((c, c), rng, c / 14) * .06 + local_noise((c, c), rng, c / 40) * .02
    R = rng.uniform(.22, .33)
    if kind == 'stains':                          # a water stain: pale fill, a darker tide line, a second ring sometimes
        r2 = rr * (1 + .12 * np.cos(3 * th + rng.uniform(0, 6))) + edge
        fill = sstep(R, R - .05, r2) * (.25 + .1 * local_noise((c, c), rng, c / 12))
        rim = np.exp(-((r2 - R + .01) / .012) ** 2) * .6
        ring2 = np.exp(-((r2 - R * rng.uniform(.55, .75)) / .01) ** 2) * .3 * (rng.random() < .6)
        return np.clip(fill + rim + ring2, 0, 1)
    if kind == 'grime':                           # a soft dirty patch, uneven, densest inside
        r2 = rr / R + edge * 2.5
        body = sstep(1.0, .3, r2)
        tex = sstep(-.6, 1.4, local_noise((c, c), rng, c / 30) + .5 * local_noise((c, c), rng, c / 80))
        return np.clip(body * (.25 + .5 * tex), 0, 1)
    if kind == 'scuffs':                          # short dark strokes in one main direction (shoes, furniture)
        cv = np.zeros((c, c), np.float32)
        base = rng.uniform(0, np.pi)
        for _ in range(int(rng.integers(5, 11))):
            a = base + rng.normal(0, .25)
            L = rng.uniform(.08, .3) * c
            x0, y0 = cx + rng.normal(0, .1) * c, cy + rng.normal(0, .1) * c
            pts = [(x0 + np.cos(a) * L * t + rng.normal(0, 1.5), y0 + np.sin(a) * L * t + rng.normal(0, 1.5)) for t in np.linspace(-.5, .5, 8)]
            stroke(cv, pts, rng.uniform(.4, 1))
        return np.clip(ndi.gaussian_filter(cv, rng.uniform(1.5, 3.5)) * 3.5, 0, .8)
    if kind == 'damp':                            # rising damp / streaks running down: heaviest at the top of the cell
        top = c * .12
        cols = local_noise((1, c), rng, c / 30)[0]
        length = (.45 + .35 * sstep(-1, 1.5, cols)) * c
        run = sstep(0, 1, 1 - (yy - top) / length[None, :]) * (yy > top)
        width = sstep(.42, .3, np.abs(xx - cx) / c + edge)
        streaks = sstep(-.6, 1.2, local_noise((c, c), rng, (c / 6, 2.5)))
        return np.clip(run * width * (.25 + .5 * streaks), 0, 1)
    if kind == 'cracks':                          # a branching crack, thin and dark
        cv = np.zeros((c, c), np.float32)
        todo = [(cx, cy, rng.uniform(0, 2 * np.pi), .9, 0)]
        while todo:
            x, y, a, w, depth = todo.pop()
            pts = [(x, y)]
            for _ in range(int(rng.integers(8, 16))):
                a += rng.normal(0, .35)
                x, y = x + np.cos(a) * c * .025, y + np.sin(a) * c * .025
                pts.append((x, y))
                if depth < 3 and rng.random() < .12:
                    todo.append((x, y, a + rng.choice([-1, 1]) * rng.uniform(.5, 1.1), w * .6, depth + 1))
            stroke(cv, pts, w)
        if not cv.any():
            return cv
        cv = ndi.gaussian_filter(cv, 1.1) * 4
        return np.clip(cv * sstep(.45, .3, rr), 0, .9)
    if kind == 'splatter':                        # drops around a main splash
        cv = np.zeros((c, c), np.float32)
        main = sstep(R * .6, R * .45, rr * (1 + .25 * np.cos(5 * th)) + edge)
        cv = np.maximum(cv, main * .7)
        for _ in range(int(rng.integers(15, 40))):
            a, d = rng.uniform(0, 2 * np.pi), rng.uniform(R * .5, .4) * c
            r = rng.uniform(.004, .02) * c * (1 - d / (.45 * c))
            px, py = cx + np.cos(a) * d, cy + np.sin(a) * d
            cv = np.maximum(cv, sstep(r, r * .5, np.hypot(xx - px, yy - py)) * .7)
        return np.clip(ndi.gaussian_filter(cv, .8), 0, 1)
    raise ProcError('mark kind "%s" is not one of %s' % (kind, ', '.join(MARKS)))


def marks_sheet(kind, rng, o, cell=512):
    """six marks on white, 3 across and 2 down, each well inside its own cell (the decals step finds them by their gaps)"""
    col = np.array(o['colors'][0], np.float32)
    sheet = np.ones((cell * 2, cell * 3, 3), np.float32)
    inner = int(cell * .8)
    pad = (cell - inner) // 2
    yy, xx = np.mgrid[0:inner, 0:inner].astype(np.float32)
    border = np.minimum(np.minimum(xx, inner - 1 - xx), np.minimum(yy, inner - 1 - yy))
    for i in range(6):
        ink = mark(kind, inner, rng) * sstep(0, .08 * inner, border)
        y0, x0 = (i // 3) * cell + pad, (i % 3) * cell + pad
        sheet[y0:y0 + inner, x0:x0 + inner] = 1 - ink[..., None] * (1 - col[None, None])
    return sheet


# ---------- the job ----------
def write_raw(img, meta, raw_dir, name):
    raw_dir.mkdir(parents=True, exist_ok=True)
    p = raw_dir / (name + '.png')
    tmp = raw_dir / ('.tmp-' + name + '.png')
    Image.fromarray(to8(img)).save(tmp, format='PNG')
    os.replace(tmp, p)
    with open(raw_dir / ('.tmp-' + name + '.png.json'), 'w', encoding='utf8') as f:
        f.write(json.dumps(meta, indent=1))
    os.replace(raw_dir / ('.tmp-' + name + '.png.json'), raw_dir / (name + '.png.json'))
    print('wrote raw/%s.png' % name, '(%s)' % meta['kind'], '%d KB' % (p.stat().st_size // 1024))


def make_one(name, spec, raw_dir, default_size):
    if not isinstance(spec, dict) or 'kind' not in spec:
        raise ProcError('procedural.%s needs a "kind" (one of %s)' % (name, ', '.join(SURFACES + MARKS)))
    kind = spec['kind']
    if kind not in SURFACES and kind not in MARKS:
        raise ProcError('procedural.%s kind "%s" is not one of %s' % (name, kind, ', '.join(SURFACES + MARKS)))
    o = {'seed': int(spec.get('seed', 1)), 'colors': spec.get('colors') or DEFAULT_COLORS[kind], 'count': spec.get('count', 6),
         'pattern': spec.get('pattern'), 'dirt': float(spec.get('dirt', .35)), 'scale': float(spec.get('scale', 1.0))}
    for c in o['colors']:
        if not (isinstance(c, list) and len(c) == 3 and all(isinstance(x, (int, float)) for x in c)):
            raise ProcError('procedural.%s colors must be lists of three numbers 0..1, got %r' % (name, o['colors']))
    rng = np.random.default_rng(o['seed'] * 7919 + sum(map(ord, name)))
    if kind in MARKS:
        img = marks_sheet(kind, rng, o)
        meta = {'source': 'procedural', 'kind': kind, 'marks': 6, 'layout': '3 x 2 on white', 'spec': spec}
    else:
        n = int(spec.get('size', default_size))
        n = max(256, min(4096, n - n % 2))
        img = surface(kind, n, rng, o)
        meta = {'source': 'procedural', 'kind': kind, 'wraps': True, 'spec': spec}
    write_raw(img, meta, raw_dir, name)


def main(argv=None):
    ap = argparse.ArgumentParser(description='raw pictures drawn in code (tileable surfaces, decal marks on white)')
    ap.add_argument('--dir', required=True, help='the texture folder (assets/tex)')
    ap.add_argument('--raw', help='raw pictures folder (default <dir>/raw)')
    ap.add_argument('--recipes', help='recipes json (default <dir>/recipes.json)')
    ap.add_argument('names', nargs='*', help='only these procedural entries (default all)')
    ap.add_argument('--names', dest='names_csv', help='the same as one comma list')
    args = ap.parse_args(argv)
    d = Path(args.dir).resolve()
    raw = Path(args.raw).resolve() if args.raw else d / 'raw'
    rec = Path(args.recipes).resolve() if args.recipes else d / 'recipes.json'
    try:
        if not rec.exists():
            raise ProcError('no recipes file at %s: add a "procedural" section (example: recipes.procedural.json next to this script)' % rec)
        try:
            with open(rec, encoding='utf8') as f:
                r = json.load(f)
        except json.JSONDecodeError as e:
            raise ProcError('the recipes file %s is not valid json: %s' % (rec, e))
        proc = r.get('procedural') or {}
        if not proc:
            raise ProcError('the recipes file has no "procedural" section (example: recipes.procedural.json next to this script)')
        want = list(args.names) + [s.strip() for s in (args.names_csv or '').split(',') if s.strip()]
        for w in want:
            if w not in proc:
                raise ProcError('"%s" is not in the procedural section (it has: %s)' % (w, ', '.join(proc)))
        for name in (want or list(proc)):
            make_one(name, proc[name], raw, int(r.get('tile_size', 2048)))
    except ProcError as e:
        print('ERROR:', e, file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
