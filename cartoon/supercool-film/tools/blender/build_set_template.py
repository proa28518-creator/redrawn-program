# build_set_template.py: a small, working starting point for a film's set, built from nothing in a hidden Blender.
# Copy it to <project>/blender/build_set.py and change the parts marked CHANGE THIS FOR YOUR FILM. Leave the parts marked KEEP.
#
# How the app runs it:
#   blender -b --factory-startup -P <project>/blender/build_set.py -- <project>/assets/set [place ...] [--blend]
#     <project>/assets/set   where everything is written (required, the first thing after --)
#     place ...              only build these places (the other places' data in scatter.json is kept)
#     --blend                also save set.blend there, to open and look at by hand (not needed by the renderer)
#
# Writes into the out folder:
#   <place>.glb      the architecture of one place: one mesh per material name, place-local (the place's own origin)
#   kit.glb          small assets, one named root per asset at the origin, local +y out of the surface it sits on
#                    (wall assets: local -z points up the wall)
#   scatter.json     { "meta": {...}, "<place>": { "instances": { asset: [[px,py,pz, qx,qy,qz,qw, sx,sy,sz], ...] },
#                                                  "decals": [ { cell, pos, normal, spin, size, surface, alpha } ] } }
# Check it with check_set_template.py (keep-clear zones, height limit, camera rays, clay pictures).
#
# Rules this script keeps (the renderer depends on them):
#  - Units D (one head). Everything is authored in THREE.JS axes (x, y up, z); to_blender() converts once and the glTF
#    exporter converts back, so the glb is in three.js axes again.
#  - UVs in world units: 1 UV = 1 D. Floors and ceilings u = x, v = z; walls u = along the wall, v = height.
#  - Blender materials are only names. The renderer gives each name its own look and texture.
#  - Seeded: the same bytes every run. Never use time, never use an unseeded random.
#  - The scatter is real geometry nodes, read back from the evaluated instances, never realized into one mesh.
#  - Decals: a plane with basis u, v, normal. Spin 0: floor u = +x, v = -z; ceiling u = +x, v = +z; wall u = up x normal,
#    v = up. Spin turns counter-clockwise around the normal; size = [along u, along v]; alpha 0..1.
#
# Blender 5.2, bundled modules only (bpy, mathutils, json, math, random, pathlib). No PIL, no scipy.
import bpy, json, math, os, random, sys
from pathlib import Path
from mathutils import Matrix, Vector

# ======================================================================================================== KEEP: arguments
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if not ARGS or ARGS[0].startswith('-'):
    print('ERROR: say where to write the set: blender -b --factory-startup -P build_set.py -- <project>/assets/set [place ...]', flush=True)
    sys.exit(2)
OUT = Path(ARGS[0]).resolve()
WANT = [a for a in ARGS[1:] if not a.startswith('-')]
FLAGS = [a for a in ARGS[1:] if a.startswith('-')]

# ======================================================================================================== CHANGE THIS FOR YOUR FILM
SEED = 20261104                     # change it to get a different but still repeatable set

# material name -> colour (linear rgb, only used in Blender itself) and emission (lamps). The renderer maps names to looks.
MATERIALS = dict(
    floor=dict(rgb=(.42, .38, .30)),
    wall=dict(rgb=(.70, .66, .52)),
    trim=dict(rgb=(.36, .30, .22)),        # skirting and door casings
    ceiling=dict(rgb=(.82, .80, .74)),
    fitting=dict(rgb=(.75, .75, .72)),     # the light fitting's housing
    lamp=dict(rgb=(.95, .95, .88), emit=(1, .97, .88)),
    kit_wood=dict(rgb=(.45, .32, .18)),
    kit_metal=dict(rgb=(.35, .36, .38)),
)

# decal sheet cells (a 6 x 6 sheet: decals.png). Keep these ranges in step with whoever makes the sheet.
DECAL_CELLS = dict(floor=range(0, 12), wall=range(12, 24))

# the demo place: a room 10 x 10 D, ceiling at 4.6 D, one door in the back wall
ROOM = dict(x0=-5.0, x1=5.0, z0=-5.0, z1=5.0, ceil=4.6, door_x=1.5, door_w=1.8, door_h=3.6, wall_t=.2)

# Keep-clear zones the scatter must not put anything into (place -> boxes in three axes). If the project has
# blender/keep_clear.json (the file the check reads), its boxes are used as well, so build and check agree.
KEEP_CLEAR = dict(room=[dict(name='walk lane', min=[-2.5, .25, -5.2], max=[2.8, 4.3, 2.5])])

# ======================================================================================================== KEEP: noise, vectors
def _h(i, j, s):
    n = (i * 374761393 + j * 668265263 + s * 1274126177) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffffffff) / 4294967295.0

def vnoise(x, y, scale, s=0):
    """Smooth value noise in 0..1, pure: the same input always gives the same output."""
    x, y = x / scale, y / scale
    i, j = math.floor(x), math.floor(y)
    fx, fy = x - i, y - j
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b, c, d = _h(i, j, s), _h(i + 1, j, s), _h(i, j + 1, s), _h(i + 1, j + 1, s)
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy

def sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def norm(a):
    l = math.sqrt(dot(a, a)) or 1
    return (a[0] / l, a[1] / l, a[2] / l)
def to_blender(p): return (p[0], -p[2], p[1])          # three (x, y up, z) -> blender (x, -z, y)
def lines(a, b, step):
    n = max(1, round((b - a) / step))
    return [a + (b - a) * i / n for i in range(n + 1)]

# ======================================================================================================== KEEP: mesh builder
class MB:
    """Collects polygons for ONE material. Each polygon gets world-unit UVs unless given."""
    def __init__(self):
        self.v, self.f, self.uv, self.smooth = [], [], [], []

    def poly(self, pts, ref=None, uv=None, smooth=False):
        """One flat polygon. ref: the direction it should face (the winding flips to match)."""
        pts = list(pts)
        n = (0, 0, 0)
        for i in range(1, len(pts) - 1):
            c = cross(sub(pts[i], pts[0]), sub(pts[i + 1], pts[0]))
            n = (n[0] + c[0], n[1] + c[1], n[2] + c[2])
        if ref is not None and dot(n, ref) < 0:
            pts = pts[::-1]
            if uv: uv = uv[::-1]
        if uv is None:                                  # project on the plane it faces most: 1 UV = 1 D
            ax, ay, az = abs(n[0]), abs(n[1]), abs(n[2])
            if ay >= ax and ay >= az: uv = [(p[0], p[2]) for p in pts]
            elif ax >= az: uv = [(p[2], p[1]) for p in pts]
            else: uv = [(p[0], p[1]) for p in pts]
        base = len(self.v)
        self.v.extend(pts)
        self.f.append(list(range(base, base + len(pts))))
        self.uv.extend(uv)
        self.smooth.append(smooth)

    def grid(self, fn, us, vs, ref, uvfn=None):
        """A flat grid of quads; fn(u, v) -> point. Enough faces for the scatter to spread over evenly."""
        for i in range(len(us) - 1):
            for j in range(len(vs) - 1):
                q = [(us[i], vs[j]), (us[i + 1], vs[j]), (us[i + 1], vs[j + 1]), (us[i], vs[j + 1])]
                self.poly([fn(u, v) for u, v in q], ref=ref, uv=[uvfn(u, v) for u, v in q] if uvfn else None)

    def tris(self): return sum(len(f) - 2 for f in self.f)

    def to_mesh(self, name):
        me = bpy.data.meshes.new(name)
        me.from_pydata([to_blender(p) for p in self.v], [], self.f)
        me.update()
        layer = me.uv_layers.new(name='UVMap')
        flat = []
        for u, v in self.uv: flat += (u, 1 - v)       # the exporter flips v, so the glb holds v as written here
        layer.uv.foreach_set('vector', flat)
        me.polygons.foreach_set('use_smooth', self.smooth)
        me.update()
        return me

def material(name):
    spec = MATERIALS[name]
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if m.node_tree is None or not any(n.type == 'BSDF_PRINCIPLED' for n in m.node_tree.nodes):
        m.use_nodes = True                               # older Blender only; 5.x materials come with their nodes
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*spec['rgb'], 1)
    b.inputs['Roughness'].default_value = .85
    if spec.get('emit'):
        b.inputs['Emission Color'].default_value = (*spec['emit'], 1)
        b.inputs['Emission Strength'].default_value = 4
    return m

def add_object(name, mb, mat_name, coll):
    me = mb.to_mesh(name)
    me.materials.append(material(mat_name))
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob

def bbox(m, x0, x1, y0, y1, z0, z1, b=.02, skip=()):
    """A box with chamfered edges and corners (b = bevel width), so its edges catch the light. skip: faces to leave out, e.g. (1, -1) = bottom."""
    c = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    h = ((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2)
    b = min(b, h[0] * .9, h[1] * .9, h[2] * .9)
    def pt(o): return (c[0] + o[0], c[1] + o[1], c[2] + o[2])
    for ax in range(3):                                  # the six faces, shrunk by the bevel
        a1, a2 = (ax + 1) % 3, (ax + 2) % 3
        for s in (-1, 1):
            if (ax, s) in skip: continue
            q = []
            for t1, t2 in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                v = [0, 0, 0]; v[ax] = s * h[ax]; v[a1] = t1 * (h[a1] - b); v[a2] = t2 * (h[a2] - b)
                q.append(pt(v))
            r = [0, 0, 0]; r[ax] = s
            m.poly(q, ref=tuple(r))
    for a in range(3):                                   # the twelve edge strips
        for bb in range(a + 1, 3):
            cc = 3 - a - bb
            for sa in (-1, 1):
                for sb in (-1, 1):
                    q = []
                    for sc, first in ((-1, True), (1, True), (1, False), (-1, False)):
                        v = [0, 0, 0]
                        v[a] = sa * (h[a] - (0 if first else b)); v[bb] = sb * (h[bb] - (b if first else 0)); v[cc] = sc * (h[cc] - b)
                        q.append(pt(v))
                    r = [0, 0, 0]; r[a] = sa; r[bb] = sb
                    m.poly(q, ref=tuple(r))
    for sx in (-1, 1):                                   # the eight corner triangles
        for sy in (-1, 1):
            for sz in (-1, 1):
                q = [pt((sx * h[0], sy * (h[1] - b), sz * (h[2] - b))), pt((sx * (h[0] - b), sy * h[1], sz * (h[2] - b))), pt((sx * (h[0] - b), sy * (h[1] - b), sz * h[2]))]
                m.poly(q, ref=(sx, sy, sz))

def tube(m, path, r, sides=8, caps=True):
    """A round section along a path of points (smooth shaded)."""
    pts = [Vector(p) for p in path]
    rings = []
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        a = d.cross(Vector((0, 1, 0)))
        if a.length < .15: a = d.cross(Vector((1, 0, 0)))
        a.normalize(); b = a.cross(d).normalized()
        rings.append([tuple(p + a * (r * math.cos(k * math.tau / sides)) + b * (r * math.sin(k * math.tau / sides))) for k in range(sides)])
    for i in range(len(rings) - 1):
        mid = (pts[i] + pts[i + 1]) / 2
        for k in range(sides):
            k2 = (k + 1) % sides
            q = [rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]]
            out = (Vector(q[0]) + Vector(q[2])) / 2 - mid
            m.poly(q, ref=tuple(out), smooth=True, uv=[(k / sides * math.tau * r, i), (k2 / sides * math.tau * r, i), (k2 / sides * math.tau * r, i + 1), (k / sides * math.tau * r, i + 1)])
    if caps:
        m.poly(rings[0], ref=tuple(pts[0] - pts[1]))
        m.poly(rings[-1], ref=tuple(pts[-1] - pts[-2]))

# ======================================================================================================== CHANGE THIS FOR YOUR FILM: the places
# A place builder fills one MB per material and returns the layout the scatter needs:
#   meshes: {material name: MB}, faces: the wall faces, floor: (x0, x1, z0, z1), hot: points where dirt gathers,
#   doors: [(x, z, half width)] to keep clear of the scatter.
# A wall face: axis 'x' = the plane x = c (u runs along z), axis 'z' = the plane z = c (u runs along x); s = which way it faces.

def face_rects(F, R):
    """The rectangles of a wall face, split around its doors: (u0, u1, y0, y1, kind) with kind 'solid' or 'over_door'."""
    out, u = [], F['u0']
    for d in sorted(F['doors']):
        a, b = d - R['door_w'] / 2, d + R['door_w'] / 2
        if a > u: out.append((u, a, 0, R['ceil'], 'solid'))
        out.append((a, b, R['door_h'], R['ceil'], 'over_door'))
        u = b
    if u < F['u1']: out.append((u, F['u1'], 0, R['ceil'], 'solid'))
    return out

def wall_point(F, u, y, off=0):
    """A point on a wall face, off = distance out of the wall into the room."""
    c = F['c'] + F['s'] * off
    return (c, y, u) if F['axis'] == 'x' else (u, y, c)

def face_normal(F): return (F['s'], 0, 0) if F['axis'] == 'x' else (0, 0, F['s'])

def build_room():
    R = ROOM
    x0, x1, z0, z1, H = R['x0'], R['x1'], R['z0'], R['z1'], R['ceil']
    M = {k: MB() for k in ('floor', 'wall', 'trim', 'ceiling', 'fitting', 'lamp')}
    faces = [dict(axis='z', c=z0, s=1, u0=x0, u1=x1, doors=[R['door_x']]),     # back wall, with the door
             dict(axis='z', c=z1, s=-1, u0=x0, u1=x1, doors=[]),
             dict(axis='x', c=x0, s=1, u0=z0, u1=z1, doors=[]),
             dict(axis='x', c=x1, s=-1, u0=z0, u1=z1, doors=[])]

    # floor and ceiling: grids, so the scatter and the renderer's lights get enough vertices
    M['floor'].grid(lambda x, z: (x, 0, z), lines(x0, x1, 1), lines(z0, z1, 1), (0, 1, 0))
    M['ceiling'].grid(lambda x, z: (x, H, z), lines(x0, x1, 1), lines(z0, z1, 1), (0, -1, 0))

    # walls: the room side of each face, UV (u, height); the door's reveal goes back through the wall's thickness
    for F in faces:
        n = face_normal(F)
        for u0, u1, y0, y1, k in face_rects(F, R):
            M['wall'].grid(lambda u, y: wall_point(F, u, y), lines(u0, u1, 1), lines(y0, y1, 1), n, uvfn=lambda u, y: (u, y))
        for d in F['doors']:
            a, b, t = d - R['door_w'] / 2, d + R['door_w'] / 2, R['wall_t']
            for u, side in ((a, 1), (b, -1)):            # the two jambs face into the opening
                q = [wall_point(F, u, 0), wall_point(F, u, R['door_h']), wall_point(F, u, R['door_h'], -t), wall_point(F, u, 0, -t)]
                ref = (side, 0, 0) if F['axis'] == 'z' else (0, 0, side)
                M['wall'].poly(q, ref=ref)
            q = [wall_point(F, a, R['door_h']), wall_point(F, b, R['door_h']), wall_point(F, b, R['door_h'], -t), wall_point(F, a, R['door_h'], -t)]
            M['wall'].poly(q, ref=(0, -1, 0))             # the head of the opening faces down

    # skirting along every solid stretch, door casings around every opening
    for F in faces:
        for u0, u1, y0, y1, k in face_rects(F, R):
            if k != 'solid': continue
            p0, p1 = wall_point(F, u0, 0, 0), wall_point(F, u1, 0, .045)
            bbox(M['trim'], min(p0[0], p1[0]), max(p0[0], p1[0]), 0, .18, min(p0[2], p1[2]), max(p0[2], p1[2]), b=.008, skip=((1, -1),))
        for d in F['doors']:
            a, b, w = d - R['door_w'] / 2, d + R['door_w'] / 2, .14
            for ua, ub, ya, yb in ((a - w, a, 0, R['door_h'] + w), (b, b + w, 0, R['door_h'] + w), (a - w, b + w, R['door_h'], R['door_h'] + w)):
                p0, p1 = wall_point(F, ua, ya, 0), wall_point(F, ub, yb, .03)
                bbox(M['trim'], min(p0[0], p1[0]), max(p0[0], p1[0]), ya, yb, min(p0[2], p1[2]), max(p0[2], p1[2]), b=.008, skip=((1, -1),))

    # the light fitting: a bevelled housing on the ceiling and an emissive lens just under it
    hx, hz, hh = .7, .35, .12
    bbox(M['fitting'], -hx, hx, H - hh, H + .01, -hz, hz, b=.02)
    M['lamp'].poly([(-hx + .06, H - hh - .003, -hz + .06), (hx - .06, H - hh - .003, -hz + .06), (hx - .06, H - hh - .003, hz - .06), (-hx + .06, H - hh - .003, hz - .06)],
                   ref=(0, -1, 0), uv=[(0, 0), (1, 0), (1, 1), (0, 1)])

    # where dirt gathers: either side of every door and the four corners
    hot = [(x0, 0, z0), (x1, 0, z0), (x1, 0, z1), (x0, 0, z1)]
    for F in faces:
        for d in F['doors']:
            for s in (-1, 1): hot.append(wall_point(F, d + s * (R['door_w'] / 2 + .25), 0))
    doors = [(*wall_point(F, d, 0)[::2], R['door_w'] / 2 + .3) for F in faces for d in F['doors']]
    return dict(meshes=M, faces=faces, floor=(x0, x1, z0, z1), hot=hot, doors=doors, rects=lambda F: face_rects(F, R))

PLACES = dict(room=build_room)        # add your places here: name -> builder

# ======================================================================================================== CHANGE THIS FOR YOUR FILM: the kit
# One root object per asset, at the origin, sitting on y 0 (floor assets) or on its mounting face (wall assets:
# local +y out of the wall, local -z up the wall). One material per asset keeps it to one draw call per instance batch.
# FOOT is each floor asset's footprint radius, used to keep it inside the room and out of the keep-clear zones.
FOOT = dict(crate=.55)
WALL_HALF = dict(pipe_bracket=.12)     # wall assets: half their width along the wall
WALL_OUT = dict(pipe_bracket=.3)       # wall assets: how far they stick out of the wall

def build_kit(coll):
    kit = {}
    m = MB()                                         # a wooden crate, 0.9 D, planks as proud bands
    s = .45
    bbox(m, -s, s, 0, .9, -s, s, b=.03)
    for y0 in (.08, .72):                            # two bands round the crate
        bbox(m, -s - .015, s + .015, y0, y0 + .1, -s - .015, s + .015, b=.012)
    for cx in (-1, 1):                               # corner posts
        for cz in (-1, 1):
            bbox(m, cx * s - .07 if cx > 0 else -s - .015, cx * s + .015 if cx > 0 else -s + .07, 0, .9, cz * s - .07 if cz > 0 else -s - .015, cz * s + .015 if cz > 0 else -s + .07, b=.01)
    kit['crate'] = add_object('crate', m, 'kit_wood', coll)

    m = MB()                                         # a pipe bracket: wall plate, stem, ring holding a pipe that runs along local x
    bbox(m, -.08, .08, 0, .025, -.12, .12, b=.006)
    tube(m, [(0, .02, 0), (0, .13, 0)], .02, sides=8)
    ring = [(0, .21 + .08 * math.cos(a), .08 * math.sin(a)) for a in [i * math.tau / 16 for i in range(17)]]
    tube(m, ring, .014, sides=6, caps=False)
    kit['pipe_bracket'] = add_object('pipe_bracket', m, 'kit_metal', coll)
    return kit

# ======================================================================================================== CHANGE THIS FOR YOUR FILM: scatter layers
# Each layer is one geometry-nodes setup. density = base x max(seam falloff, hot point falloff) + amb, x large noise x medium noise.
#   surface: 'floor' or 'wall' (solid wall stretches only), kind: 'decal' (cells from DECAL_CELLS[cells]) or 'kit' (asset)
#   seamFall / hotFall: how far (D) the falloff reaches; nL = (scale, from, to): large noise, clear stretches and bad ones;
#   nM = (scale, from, to, floor): medium noise; w: size range; aspect: decal h / w; alpha: decal strength;
#   upright: on walls, keep local up = world up; spin: random turn (radians) around the normal;
#   poisson: minimum spacing (D) instead of free density; fixZ: put every point at this height; band: (y0 in, y0 full, y1 full, y1 out)
LOUD = (.12, .38, .62)
LAYERS = [
    dict(name='floor_dirt', surface='floor', kind='decal', cells='floor', base=3.0, seamW=1, seamFall=1.6, hot=True, hotFall=1.8, amb=.02,
         nL=LOUD, nM=(.8, .35, .65, .25), seed=11, w=(.35, 1.2), aspect=(.7, 1.3), alpha=(.45, 1)),
    dict(name='wall_damp', surface='wall', kind='decal', cells='wall', base=2.0, seamW=1, seamFall=1.0, seamPow=1, hot=True, hotFall=1.4, amb=0,
         nL=(.1, .36, .56), seed=23, w=(.6, 1.5), aspect=(.55, 1.0), alpha=(.5, 1), upright=True, spin=.1, band=(0, .01, 1.0, 1.6)),
    dict(name='k_crate', surface='floor', kind='kit', asset='crate', base=.6, seamW=1, seamFall=1.2, hot=True, hotFall=1.5, amb=0,
         nL=(.15, .35, .55), seed=31, w=(.8, 1.15)),
    dict(name='k_bracket', surface='wall', kind='kit', asset='pipe_bracket', base=1.0, poisson=1.6, amb=1, seed=37, w=(1, 1),
         upright=True, spin=0, fixZ=3.4, band=(3.0, 3.1, 3.7, 3.8)),
]

# ======================================================================================================== KEEP: geometry nodes scatter
def helper_mesh(name, coll, verts, edges=()):
    """Points or edges the proximity nodes measure distance to (seams, hot points). Never exported."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([to_blender(v) for v in verts], list(edges), [])
    me.update()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob

def make_scatter_group(name, cfg, helpers, decal_coll, kit):
    ng = bpy.data.node_groups.new(name, 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N, L = ng.nodes.new, ng.links.new
    gi, go = N('NodeGroupInput'), N('NodeGroupOutput')
    seed = cfg['seed']

    def val(v):
        n = N('ShaderNodeValue'); n.outputs[0].default_value = v; return n.outputs[0]
    def math_op(op, a, b):
        n = N('ShaderNodeMath'); n.operation = op
        for i, x in enumerate((a, b)):
            if isinstance(x, (int, float)): n.inputs[i].default_value = x
            else: L(x, n.inputs[i])
        return n.outputs[0]
    def map_range(v, a, b, c, d, smooth=False):
        n = N('ShaderNodeMapRange'); n.clamp = True
        if smooth: n.interpolation_type = 'SMOOTHSTEP'
        L(v, n.inputs[0])
        n.inputs[1].default_value, n.inputs[2].default_value, n.inputs[3].default_value, n.inputs[4].default_value = a, b, c, d
        return n.outputs[0]
    def rand(lo, hi, sd):
        n = N('FunctionNodeRandomValue'); n.data_type = 'FLOAT'
        n.inputs['Min'].default_value, n.inputs['Max'].default_value = lo, hi
        n.inputs['Seed'].default_value = sd
        return n.outputs['Value']
    def noise(scale, w):
        n = N('ShaderNodeTexNoise'); n.noise_dimensions = '4D'
        n.inputs['W'].default_value = w; n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = 2.0
        return n.outputs[0]
    def proximity(ob, mode):
        info = N('GeometryNodeObjectInfo'); info.transform_space = 'RELATIVE'
        info.inputs['Object'].default_value = ob
        p = N('GeometryNodeProximity'); p.target_element = mode
        L(info.outputs['Geometry'], p.inputs[0])
        return p.outputs['Distance']

    # the density: base x (amb + the strongest of: near the seam, near a hot point) x large noise x medium noise
    terms = []
    if cfg.get('seamW', 0) > 0:
        d = proximity(helpers['seam'], 'EDGES')
        terms.append(math_op('MULTIPLY', math_op('POWER', map_range(d, 0, cfg['seamFall'], 1, 0), cfg.get('seamPow', 2)), cfg['seamW']))
    if cfg.get('hot'):
        d = proximity(helpers['hot'], 'POINTS')
        terms.append(math_op('MULTIPLY', math_op('POWER', map_range(d, 0, cfg['hotFall'], 1, 0), cfg.get('hotPow', 1.5)), cfg.get('hotW', 1)))
    mask = terms[0] if terms else val(0)
    for t in terms[1:]: mask = math_op('MAXIMUM', mask, t)
    mask = math_op('ADD', mask, cfg.get('amb', 0))
    if cfg.get('nL'):
        s, a, b = cfg['nL']; mask = math_op('MULTIPLY', mask, map_range(noise(s, seed * 1.37), a, b, 0, 1, True))
    if cfg.get('nM'):
        s, a, b, lo = cfg['nM']; mask = math_op('MULTIPLY', mask, map_range(noise(s, seed * 2.11), a, b, lo, 1, True))
    if cfg.get('band'):                                  # height band on walls (blender Z = three y)
        pos = N('GeometryNodeInputPosition'); sep = N('ShaderNodeSeparateXYZ'); L(pos.outputs[0], sep.inputs[0])
        y0, y1, y2, y3 = cfg['band']
        mask = math_op('MULTIPLY', mask, map_range(sep.outputs['Z'], y0, y1, 0, 1))
        mask = math_op('MULTIPLY', mask, map_range(sep.outputs['Z'], y2, y3, 1, 0))
    dist = N('GeometryNodeDistributePointsOnFaces')
    L(gi.outputs[0], dist.inputs['Mesh'])
    dist.inputs['Seed'].default_value = seed
    if cfg.get('poisson'):
        dist.distribute_method = 'POISSON'
        dist.inputs['Distance Min'].default_value = cfg['poisson']
        dist.inputs['Density Max'].default_value = cfg['base']
        L(mask, dist.inputs['Density Factor'])
    else:
        L(math_op('MULTIPLY', mask, cfg['base']), dist.inputs['Density'])
    points = dist.outputs['Points']
    if cfg.get('fixZ') is not None:
        pos = N('GeometryNodeInputPosition'); sep = N('ShaderNodeSeparateXYZ'); L(pos.outputs[0], sep.inputs[0])
        com = N('ShaderNodeCombineXYZ'); L(sep.outputs['X'], com.inputs['X']); L(sep.outputs['Y'], com.inputs['Y']); com.inputs['Z'].default_value = cfg['fixZ']
        sp = N('GeometryNodeSetPosition'); L(points, sp.inputs['Geometry']); L(com.outputs[0], sp.inputs['Position'])
        points = sp.outputs[0]

    # rotation: local Z along the surface normal (= three local +y), on walls local Y up, then the random turn
    al = N('FunctionNodeAlignRotationToVector'); al.axis = 'Z'
    L(dist.outputs['Normal'], al.inputs['Vector'])
    rot = al.outputs[0]
    if cfg.get('upright'):
        al2 = N('FunctionNodeAlignRotationToVector'); al2.axis = 'Y'; al2.pivot_axis = 'Z'
        L(rot, al2.inputs['Rotation']); al2.inputs['Vector'].default_value = (0, 0, 1)
        rot = al2.outputs[0]
    spin = cfg.get('spin', math.pi)
    if spin:
        com = N('ShaderNodeCombineXYZ'); L(rand(-spin, spin, seed + 5), com.inputs['Z'])
        e2r = N('FunctionNodeEulerToRotation'); L(com.outputs[0], e2r.inputs[0])
        rr = N('FunctionNodeRotateRotation'); rr.rotation_space = 'LOCAL'
        L(rot, rr.inputs['Rotation']); L(e2r.outputs[0], rr.inputs['Rotate By'])
        rot = rr.outputs[0]

    # scale: decals carry w, h and hide their alpha in the unused z; kit assets scale evenly
    com = N('ShaderNodeCombineXYZ')
    w = rand(cfg['w'][0], cfg['w'][1], seed + 7)
    if cfg['kind'] == 'decal':
        L(w, com.inputs['X'])
        L(math_op('MULTIPLY', w, rand(cfg['aspect'][0], cfg['aspect'][1], seed + 11)), com.inputs['Y'])
        L(rand(cfg['alpha'][0], cfg['alpha'][1], seed + 13), com.inputs['Z'])
    else:
        L(w, com.inputs['X']); L(w, com.inputs['Y']); L(w, com.inputs['Z'])

    inst = N('GeometryNodeInstanceOnPoints')
    L(points, inst.inputs['Points']); L(rot, inst.inputs['Rotation']); L(com.outputs[0], inst.inputs['Scale'])
    if cfg['kind'] == 'decal':                           # one stand-in quad per sheet cell: the instance's name says the cell
        ci = N('GeometryNodeCollectionInfo'); ci.transform_space = 'ORIGINAL'
        ci.inputs['Collection'].default_value = decal_coll
        ci.inputs['Separate Children'].default_value = True
        ci.inputs['Reset Children'].default_value = True
        L(ci.outputs[0], inst.inputs['Instance'])
        inst.inputs['Pick Instance'].default_value = True
        ri = N('FunctionNodeRandomValue'); ri.data_type = 'INT'
        ri.inputs['Min'].default_value, ri.inputs['Max'].default_value = 0, len(decal_coll.objects) - 1
        ri.inputs['Seed'].default_value = seed + 3
        L(ri.outputs['Value'], inst.inputs['Instance Index'])
    else:
        info = N('GeometryNodeObjectInfo'); info.transform_space = 'ORIGINAL'
        info.inputs['Object'].default_value = kit[cfg['asset']]
        info.inputs['As Instance'].default_value = True
        L(info.outputs['Geometry'], inst.inputs['Instance'])
    L(inst.outputs[0], go.inputs[0])
    return ng

def surface_mesh(name, place, kind):
    """What a layer scatters over: the floor, or the solid stretches of the walls (never over a door)."""
    m = MB()
    if kind == 'floor':
        x0, x1, z0, z1 = place['floor']
        m.grid(lambda x, z: (x, 0, z), lines(x0, x1, .25), lines(z0, z1, .25), (0, 1, 0))
    else:
        for F in place['faces']:
            for u0, u1, y0, y1, k in place['rects'](F):
                if k == 'solid':
                    m.grid(lambda u, y: wall_point(F, u, y), lines(u0, u1, .33), lines(y0, y1 - .05, .33), face_normal(F))
    return m.to_mesh(name)

def build_scatter(pname, place, kit, coll_scatter, coll_help):
    pre = pname + '__'
    verts, edges = [], []                                # the floor seam as edges along the bottom of every solid stretch
    for F in place['faces']:
        for u0, u1, y0, y1, k in place['rects'](F):
            if k != 'solid': continue
            verts += [wall_point(F, u0, 0), wall_point(F, u1, 0)]
            edges.append((len(verts) - 2, len(verts) - 1))
    helpers = dict(seam=helper_mesh(pre + 'h_seam', coll_help, verts, edges), hot=helper_mesh(pre + 'h_hot', coll_help, place['hot']))
    decal_colls = {}
    for key, cells in DECAL_CELLS.items():
        c = bpy.data.collections.new(pre + 'decals_' + key)
        coll_help.children.link(c)
        decal_colls[key] = c
        for i in cells:
            me = bpy.data.meshes.new('dc_%02d' % i)
            me.from_pydata([(-.5, -.5, 0), (.5, -.5, 0), (.5, .5, 0), (-.5, .5, 0)], [], [(0, 1, 2, 3)])
            ob = bpy.data.objects.new(pre + 'dc_%02d' % i, me)
            c.objects.link(ob)
    surf = {k: surface_mesh(pre + 'surf_' + k, place, k) for k in ('floor', 'wall')}
    layers = {}
    for cfg in LAYERS:
        ng = make_scatter_group(pre + 'gn_' + cfg['name'], cfg, helpers, decal_colls.get(cfg.get('cells')), kit)
        ob = bpy.data.objects.new(pre + 'scatter_' + cfg['name'], surf[cfg['surface']])
        coll_scatter.objects.link(ob)
        ob.modifiers.new('scatter', 'NODES').node_group = ng
        layers[ob.name] = cfg
    return layers

# ======================================================================================================== KEEP: reading the evaluated instances back
R3 = Matrix(((1, 0, 0), (0, 0, 1), (0, -1, 0)))          # blender -> three: (x, y, z) -> (x, z, -y)
R3T = R3.transposed()

def to_three_transform(mw):
    loc, rot, sca = mw.decompose()
    p = R3 @ loc
    rm = R3 @ rot.to_matrix() @ R3T
    q = rm.to_quaternion()
    return (p.x, p.y, p.z), (q.x, q.y, q.z, q.w), (sca.x, sca.z, sca.y), rm

def in_box(p, b, r=0):
    return all(b['min'][i] - r <= p[i] <= b['max'][i] + r for i in (0, 2)) and p[1] <= b['max'][1] + r

def blocked(pname, place, x, z, r):
    """True when a floor thing of radius r at (x, z) would stand in a doorway or a keep-clear box (boxes from y min up)."""
    for dx, dz, hw in place['doors']:
        if abs(x - dx) < hw + r and abs(z - dz) < hw + r: return True
    for b in KEEP_CLEAR.get(pname, []):
        if b['min'][0] - r < x < b['max'][0] + r and b['min'][2] - r < z < b['max'][2] + r: return True
    return False

def wall_face_at(place, n, p):
    axis = 'x' if abs(n[0]) > abs(n[2]) else 'z'
    s = 1 if (n[0] if axis == 'x' else n[2]) > 0 else -1
    c, u = (p[0], p[2]) if axis == 'x' else (p[2], p[0])
    for F in place['faces']:
        if F['axis'] == axis and F['s'] == s and abs(F['c'] - c) < .05 and F['u0'] - .01 <= u <= F['u1'] + .01: return F
    return None

def kit_entry(pname, place, cfg, name, p, q, s, nr):
    x, y, z = p
    if cfg['surface'] == 'floor':
        r = FOOT[name] * s[0]
        x0, x1, z0, z1 = place['floor']
        x = max(x0 + r + .05, min(x1 - r - .05, x))       # fully inside the room, a little off the skirting
        z = max(z0 + r + .05, min(z1 - r - .05, z))
        if blocked(pname, place, x, z, r): return None
        y = 0.0
    else:
        F = wall_face_at(place, (round(nr[0]), 0, round(nr[2])), p)
        if not F: return None
        u = p[2] if F['axis'] == 'x' else p[0]
        half = WALL_HALF[name]
        if any(abs(u - d) < ROOM['door_w'] / 2 + .2 + half for d in F['doors']): return None
        if u - half < F['u0'] + .05 or u + half > F['u1'] - .05: return None
        tip = wall_point(F, u, y, WALL_OUT[name])            # how far it sticks out into the room
        if any(all(b['min'][i] - half < tip[i] < b['max'][i] + half for i in range(3)) for b in KEEP_CLEAR.get(pname, [])): return None
        x, y, z = wall_point(F, u, y, .001)
    return [round(v, 4) for v in (x, y, z, *q, *s)]

def decal_entry(place, cfg, name, p, s, rm, nr, idx):
    cell = int(name.rsplit('_', 1)[1])
    w, h, alpha = s[0], s[2], s[1]                         # blender local (x, y, z) -> three (x, z, y)
    ux = (rm[0][0], rm[1][0], rm[2][0])
    x, y, z = p
    if cfg['surface'] == 'floor':
        normal, bu = (0, 1, 0), (1, 0, 0)
    else:
        normal = (round(nr[0]), 0, round(nr[2]))
        bu = norm(cross((0, 1, 0), normal))
    bv = cross(normal, bu)
    spin = math.atan2(dot(ux, bv), dot(ux, bu))
    ca, sa = abs(math.cos(spin)), abs(math.sin(spin))
    eu, ev = (w * ca + h * sa) / 2, (w * sa + h * ca) / 2
    if cfg['surface'] == 'floor':
        x0, x1, z0, z1 = place['floor']
        over = .08                                         # may run under the skirting, never out the far side
        if eu * 2 > x1 - x0 or ev * 2 > z1 - z0: return None
        x = max(x0 - over + eu, min(x1 + over - eu, x))
        z = max(z0 - over + ev, min(z1 + over - ev, z))
        y = .003 + (idx % 9) * .0006                       # a tiny stack order, so overlapping decals never fight
        surf = 'floor'
    else:
        F = wall_face_at(place, normal, p)
        if not F: return None
        u = p[2] if F['axis'] == 'x' else p[0]
        rect = next((r for r in place['rects'](F) if r[4] == 'solid' and r[0] - .01 <= u <= r[1] + .01), None)
        if not rect or eu * 2 > rect[1] - rect[0] - .02: return None
        u = max(rect[0] + eu, min(rect[1] - eu, u))
        y = max(ev + .1, min(ROOM['ceil'] - .08 - ev, y))
        x, _, z = wall_point(F, u, y, .004 + (idx % 7) * .0005)
        surf = 'wall'
    return dict(cell=cell, pos=[round(x, 4), round(y, 4), round(z, 4)], normal=list(normal), spin=round(spin, 3),
                size=[round(w, 3), round(h, 3)], surface=surf, alpha=round(alpha, 3))

def read_instances(pname, place, layers):
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    raw = []
    for inst in dg.object_instances:
        if not inst.is_instance or inst.parent is None: continue
        if inst.parent.name not in layers: continue
        raw.append((inst.parent.name, inst.instance_object.name, inst.matrix_world.copy()))
    raw.sort(key=lambda r: (r[0], r[1], tuple(round(v, 5) for v in r[2].translation)))   # a fixed order: same bytes each run
    instances, decals, idx = {}, [], 0
    for pn, name, mw in raw:
        cfg = layers[pn]
        p, q, s, rm = to_three_transform(mw)
        nr = (rm[0][1], rm[1][1], rm[2][1])                # three local +y = the surface normal
        if cfg['kind'] == 'decal':
            idx += 1
            d = decal_entry(place, cfg, name, p, s, rm, nr, idx)
            if d: decals.append(d)
        else:
            e = kit_entry(pname, place, cfg, name, p, q, s, nr)
            if e and not any(math.dist(e[:3], o[:3]) < FOOT.get(name, WALL_HALF.get(name, .2)) * 2 for o in instances.get(name, [])):
                instances.setdefault(name, []).append(e)     # no two of the same asset inside each other
    per = {}
    for pn, _, _ in raw: per[pn[len(pname) + 2:]] = per.get(pn[len(pname) + 2:], 0) + 1
    print(f'{pname}: evaluated per layer', per, flush=True)
    print(f'{pname}: {len(raw)} evaluated instances -> kit', {k: len(v) for k, v in instances.items()}, 'decals', len(decals), flush=True)
    return instances, decals

# ======================================================================================================== KEEP: export
def export_glb(path, objs):
    tmp = str(path) + '.tmp.glb'                         # write to a temp name, then rename: a reader never sees half a file
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objs: ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=tmp, export_format='GLB', use_selection=True, export_apply=False, export_yup=True,
                              export_texcoords=True, export_normals=True, export_tangents=False, export_materials='EXPORT',
                              export_vertex_color='NONE', export_animations=False, export_skins=False, export_morph=False,
                              export_cameras=False, export_lights=False, export_extras=False, export_gn_mesh=False,
                              export_gpu_instances=False, export_image_format='NONE')
    os.replace(tmp, path)

def atomic_json(path, data):
    tmp = str(path) + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f: json.dump(data, f, separators=(',', ':'))
    os.replace(tmp, path)

def load_project_keep_clear():
    """blender/keep_clear.json of the project (OUT = <project>/assets/set), if there: its boxes are added to KEEP_CLEAR."""
    p = OUT.parent.parent / 'blender' / 'keep_clear.json'
    if not p.exists(): return
    try:
        data = json.loads(p.read_text(encoding='utf-8'))
    except Exception as e:
        print('WARNING: blender/keep_clear.json could not be read, using the boxes in this script only:', e, flush=True)
        return
    for pname, spec in data.items():
        if isinstance(spec, dict):
            KEEP_CLEAR.setdefault(pname, []).extend(b for b in spec.get('boxes', []) if 'min' in b and 'max' in b)

# ======================================================================================================== KEEP: main
def main():
    unknown = [p for p in WANT if p not in PLACES]
    if unknown:
        print('ERROR: no such place:', ', '.join(unknown), '- the places are:', ', '.join(PLACES), flush=True)
        sys.exit(2)
    names = WANT or list(PLACES)
    random.seed(SEED)
    load_project_keep_clear()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    OUT.mkdir(parents=True, exist_ok=True)
    root = bpy.context.scene.collection
    col_kit, col_scatter, col_help = (bpy.data.collections.new(n) for n in ('kit', 'scatter', 'helpers'))
    for c in (col_kit, col_scatter, col_help): root.children.link(c)

    kit = build_kit(col_kit)
    export_glb(OUT / 'kit.glb', list(kit.values()))
    print('WROTE kit.glb', {n: len(o.data.polygons) for n, o in kit.items()}, flush=True)

    built = {}
    for pname in names:
        place = PLACES[pname]()
        coll = bpy.data.collections.new('place_' + pname)
        root.children.link(coll)
        objs = [add_object(mat, mb, mat, coll) for mat, mb in place['meshes'].items() if mb.f]
        export_glb(OUT / f'{pname}.glb', objs)
        print(f'WROTE {pname}.glb', {mat: mb.tris() for mat, mb in place['meshes'].items()}, flush=True)
        coll.hide_render = True                          # out of the way of the next place (places share the origin)
        built[pname] = (place, build_scatter(pname, place, kit, col_scatter, col_help))

    vl = bpy.context.view_layer
    vl.layer_collection.children['helpers'].exclude = True
    vl.layer_collection.children['kit'].exclude = True
    vl.update()

    path = OUT / 'scatter.json'
    data = {}
    if path.exists() and WANT:                           # building some places: keep the others' data
        try: data = json.loads(path.read_text(encoding='utf-8'))
        except Exception: data = {}
    for pname, (place, layers) in built.items():
        instances, decals = read_instances(pname, place, layers)
        data[pname] = dict(instances=instances, decals=decals)
    data['meta'] = dict(tool='blender/build_set.py', seed=SEED, units='D', axes='three.js, y up',
                        decalCells={k: [v.start, v.stop - 1] for k, v in DECAL_CELLS.items()},
                        decalSpin='spin 0: floor u=+x v=-z, ceiling u=+x v=+z, wall u=up x normal v=up; counter-clockwise around the normal; size=[along u, along v]',
                        kitAxes='local +y out of the surface it sits on; on walls local -z points up')
    data = {k: data[k] for k in sorted(data)}
    atomic_json(path, data)
    print('WROTE scatter.json', round(path.stat().st_size / 1e3, 1), 'KB', flush=True)

    if '--blend' in FLAGS:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'set.blend'), compress=True)
        print('WROTE set.blend', flush=True)
    print('BUILD OK', flush=True)

try:
    main()
except SystemExit:
    raise
except Exception:
    import traceback
    traceback.print_exc()
    print('BUILD FAILED: see the error above', flush=True)
    sys.exit(1)
