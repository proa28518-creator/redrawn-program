# check_set_template.py: checks what build_set.py exported (the glbs and scatter.json), not the .blend. Reads them the way the
# renderer does, in three.js axes, and tests them against the film: keep-clear zones, a height limit, thin things ending near a
# head, camera rays. Optional clay pictures (geometry only, never the final look; red capsules stand in for the people).
# Copy it to <project>/blender/check_set.py.
#
#   blender -b --factory-startup -P <project>/blender/check_set.py -- <project>/assets/set [options]
#     --keep <json>       keep-clear file (default <project>/blender/keep_clear.json)
#     --wide              a wide (16:9) film: the camera samples and the clay pictures use the 16:9 frame
#     --cams <json>       camera samples [{ "t": 1.0, "pos": [x,y,z], "target": [x,y,z], "fov": 50, "place": "room" }, ...]
#     --place <name>      the place the cameras and pictures are in (default: the first in keep_clear.json, else the first glb)
#     --render t t ...    clay pictures at these times (needs --cams; without it one overview picture)
#     --clay-out <dir>    where the pictures go (default <project>/.suite/clay), named clay_<t>.png
#     --engine workbench  faster flat pictures (default eevee)
# Prints OK / FAIL lines, then CHECK OK or CHECK FAIL: <how many>. Exit code 0 when everything passed, 1 otherwise.
#
# keep_clear.json, per place, all in D, three.js axes, place-local (every key is optional):
#   { "room": {
#       "boxes":    [ { "name": "walk lane", "min": [x,y,z], "max": [x,y,z] } ],          nothing of the set may enter a box
#       "capsules": [ { "name": "Lena", "a": [x,y,z], "b": [x,y,z], "r": 0.35 } ],         nor a capsule (a body, a walk)
#       "hang_limit": 4.3, "hang_region": [x0, x1, z0, z1],    nothing hanging from above reaches below this y in the region
#       "heads": [ { "name": "Lena", "pos": [x, y, z], "r": 0.6 } ],   head centres: no thin thing (pipe, rod, cable) ends near one
#       "decal_far": 0.12 } }                                   a decal centre may sit at most this far from a surface
#
# Blender 5.2, bundled modules only (bpy, mathutils, numpy, json, math, struct, pathlib).
import bpy, json, math, struct, sys
from pathlib import Path
import numpy as np
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if not ARGS or ARGS[0].startswith('-'):
    print('ERROR: say which set to check: blender -b --factory-startup -P check_set.py -- <project>/assets/set [--keep j] [--cams j] [--render t ...]', flush=True)
    sys.exit(2)
OUT = Path(ARGS[0]).resolve()
PROJECT = OUT.parent.parent

def opt(name, default=None):
    return ARGS[ARGS.index(name) + 1] if name in ARGS and ARGS.index(name) + 1 < len(ARGS) else default
def opt_list(name):
    if name not in ARGS: return None
    out = []
    for a in ARGS[ARGS.index(name) + 1:]:
        if a.startswith('--'): break
        out.append(a)
    return out

fails = []
def check(ok, msg):
    print(('OK   ' if ok else 'FAIL ') + msg, flush=True)
    if not ok: fails.append(msg)

# ---------------------------------------------------------------------------------------------------------------- reading a glb (three axes)
def quat_mat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])

def node_matrix(nd):
    if 'matrix' in nd: return np.array(nd['matrix'], float).reshape(4, 4).T
    M = np.eye(4)
    M[:3, :3] = quat_mat(nd.get('rotation', [0, 0, 0, 1])) * np.array(nd.get('scale', [1, 1, 1]))
    M[:3, 3] = nd.get('translation', [0, 0, 0])
    return M

def read_glb(path):
    """-> {root node name: [dict(pos, tris, mat, emissive)]}, every primitive in the root's frame (roots in the place's frame)."""
    raw = path.read_bytes()
    n = struct.unpack('<I', raw[12:16])[0]
    j = json.loads(raw[20:20 + n])
    bin_ = raw[20 + n + 8:]
    def acc(i):
        a = j['accessors'][i]; v = j['bufferViews'][a['bufferView']]
        comp = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}[a['componentType']]
        k = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
        off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        arr = np.frombuffer(bin_, comp, a['count'] * k, off)
        return arr.reshape(-1, k) if k > 1 else arr
    out = {}
    def walk(i, M, root):
        nd = j['nodes'][i]
        M = M @ node_matrix(nd)
        if 'mesh' in nd:
            for prim in j['meshes'][nd['mesh']]['primitives']:
                pos = np.array(acc(prim['attributes']['POSITION']), float)
                pos = pos @ M[:3, :3].T + M[:3, 3]
                idx = np.array(acc(prim['indices']), np.int64) if 'indices' in prim else np.arange(len(pos))
                mat = j['materials'][prim['material']] if 'material' in prim else {}
                out.setdefault(root, []).append(dict(pos=pos, tris=idx.reshape(-1, 3), mat=mat.get('name', ''),
                                                     emissive=max(mat.get('emissiveFactor', [0, 0, 0])) > 0))
        for c in nd.get('children', []): walk(c, M, root)
    for r in j['scenes'][j.get('scene', 0)]['nodes']:
        walk(r, np.eye(4), j['nodes'][r].get('name', 'node%d' % r))
    return out

# ---------------------------------------------------------------------------------------------------------------- load
if not OUT.exists():
    print('ERROR: the set folder does not exist:', OUT, flush=True); sys.exit(2)
glbs = sorted(p for p in OUT.glob('*.glb') if p.name != 'kit.glb' and not p.name.endswith('.tmp.glb'))
if not glbs:
    print('ERROR: no <place>.glb in', OUT, '- run build_set.py first', flush=True); sys.exit(2)
KIT = read_glb(OUT / 'kit.glb') if (OUT / 'kit.glb').exists() else {}
SC = json.loads((OUT / 'scatter.json').read_text(encoding='utf-8')) if (OUT / 'scatter.json').exists() else {}
keep_path = Path(opt('--keep')) if opt('--keep') else PROJECT / 'blender' / 'keep_clear.json'
KEEP = json.loads(keep_path.read_text(encoding='utf-8')) if keep_path.exists() else {}
print('keep-clear file:', keep_path if keep_path.exists() else 'none (keep-clear, height and head checks skipped)', flush=True)
check(bool(KIT), 'kit.glb is there and has assets: ' + ', '.join(KIT))

PLACES = {}                                            # place -> list of parts dict(pos, tris, mat, emissive, what)
for g in glbs:
    pname = g.stem
    parts = []
    for root, prims in read_glb(g).items():
        for pr in prims: parts.append(dict(pr, what=root))
    for name, arr in SC.get(pname, {}).get('instances', {}).items():
        if name not in KIT:
            check(False, f'{pname}: scatter.json uses {name}, which kit.glb does not have'); continue
        for e in arr:
            R = quat_mat(e[3:7]) * np.array(e[7:10])
            for pr in KIT[name]:
                parts.append(dict(pos=pr['pos'] @ R.T + np.array(e[:3]), tris=pr['tris'], mat=pr['mat'], emissive=pr['emissive'], what='kit ' + name))
    PLACES[pname] = parts
    tris = sum(len(p['tris']) for p in parts)
    mats = sorted({p['mat'] for p in parts if not p['what'].startswith('kit')})
    print(f'{pname}: {tris} triangles with the kit, materials {mats}, kit instances',
          {k: len(v) for k, v in SC.get(pname, {}).get('instances', {}).items()}, 'decals', len(SC.get(pname, {}).get('decals', [])), flush=True)
    check(pname in SC, f'{pname}: scatter.json has this place')

def tri_boxes(p):
    t = p['pos'][p['tris']]
    return t.min(axis=1), t.max(axis=1)

def bvh_of(parts):
    V, P = [], []
    for p in parts:
        n = len(V)
        V.extend(Vector(v) for v in p['pos'].tolist())
        P.extend(tuple(int(i) + n for i in t) for t in p['tris'])
    return BVHTree.FromPolygons(V, P, epsilon=0) if P else None
BVH = {k: bvh_of(v) for k, v in PLACES.items()}

# ---------------------------------------------------------------------------------------------------------------- keep-clear boxes and capsules
for pname, spec in KEEP.items():
    if pname not in PLACES:
        check(False, f'keep_clear.json names place {pname}, but there is no {pname}.glb'); continue
    parts = PLACES[pname]
    for b in spec.get('boxes', []):
        lo, hi = np.array(b['min']), np.array(b['max'])
        hits = {}
        for p in parts:
            a, c = tri_boxes(p)
            m = np.all(c > lo, axis=1) & np.all(a < hi, axis=1)
            if m.any(): hits[p['what']] = hits.get(p['what'], 0) + int(m.sum())
        check(not hits, f'{pname}: keep clear "{b.get("name", "box")}"' + (f': in it {hits}' if hits else ''))
    for c in spec.get('capsules', []):
        A, B, r = Vector(c['a']), Vector(c['b']), c['r']
        worst, k = 99.0, 0
        while k <= 20:                                  # sample the axis; nearest surface to each sample
            P = A.lerp(B, k / 20)
            hit = BVH[pname].find_nearest(P)
            if hit[0] is not None: worst = min(worst, hit[3])
            k += 1
        check(worst >= r, f'{pname}: capsule "{c.get("name", "capsule")}" r {r}: nearest surface {worst:.3f} D from its axis')
    if 'hang_limit' in spec:
        y = spec['hang_limit']
        x0, x1, z0, z1 = spec.get('hang_region', [-1e9, 1e9, -1e9, 1e9])
        bad = {}
        for p in parts:
            a, c = tri_boxes(p)
            # hanging = a triangle that does not stand on the floor (its lowest point above 1 D) and reaches below the limit
            m = (a[:, 1] > 1.0) & (a[:, 1] < y) & (c[:, 0] > x0) & (a[:, 0] < x1) & (c[:, 2] > z0) & (a[:, 2] < z1)
            if m.any(): bad[p['what']] = round(float(a[m, 1].min()), 3)
        check(not bad, f'{pname}: nothing hangs below y {y} in the region' + (f': lowest {bad}' if bad else ''))

# ---------------------------------------------------------------------------------------------------------------- thin things ending near a head
def components(pos, tris):
    """Connected pieces of a mesh, joined where vertices share a position. -> list of vertex index arrays."""
    key = np.round(pos / 1e-4).astype(np.int64)
    _, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    parent = list(range(int(inv.max()) + 1))
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    for t in inv[tris].tolist():
        ra, rb, rc = find(t[0]), find(t[1]), find(t[2])
        if rb != ra: parent[rb] = ra
        if rc != ra and find(rc) != ra: parent[find(rc)] = ra
    groups = {}
    for v, u in enumerate(inv.tolist()): groups.setdefault(find(u), []).append(v)
    return [np.array(g) for g in groups.values()]

THIN, LONG = .12, .4                                    # thinner than this across, longer than this along = a rod
for pname, spec in KEEP.items():
    if pname not in PLACES or not spec.get('heads'): continue
    near = []
    for p in PLACES[pname]:
        for g in components(p['pos'], p['tris']):
            pts = p['pos'][g]
            c = pts.mean(axis=0)
            if len(pts) < 3: continue
            _, s, vt = np.linalg.svd(pts - c, full_matrices=False)
            proj = (pts - c) @ vt.T
            ext = proj.max(axis=0) - proj.min(axis=0)
            if ext[0] < LONG or ext[1] > THIN: continue
            ends = [pts[np.argmin(proj[:, 0])], pts[np.argmax(proj[:, 0])]]
            for h in spec['heads']:
                for e in ends:
                    d = float(np.linalg.norm(e - np.array(h['pos'])))
                    if d < h.get('r', .6): near.append(f'{p["what"]} ends {d:.2f} D from {h.get("name", "a head")}')
    check(not near, f'{pname}: no thin thing ends near a head mark' + (': ' + '; '.join(near[:6]) if near else ''))

# ---------------------------------------------------------------------------------------------------------------- decals sit on a surface
for pname in PLACES:
    dec = SC.get(pname, {}).get('decals', [])
    if not dec or not BVH[pname]: continue
    lim = KEEP.get(pname, {}).get('decal_far', .12)
    far = [d for d in dec if BVH[pname].find_nearest(Vector(d['pos']))[3] > lim]
    check(len(far) <= len(dec) * .05, f'{pname}: {len(far)} of {len(dec)} decals more than {lim} D off a surface')
    bad = [d for d in dec if not (0 <= d.get('alpha', 1) <= 1) or min(d['size']) <= 0 or d['surface'] not in ('floor', 'wall', 'ceiling')]
    check(not bad, f'{pname}: decal fields in range ({len(bad)} bad)')

# ---------------------------------------------------------------------------------------------------------------- cameras
CAMS = []
default_place = opt('--place') or next((k for k in KEEP if k in PLACES), None) or next(iter(PLACES))
if opt('--cams'):
    CAMS = json.loads(Path(opt('--cams')).read_text(encoding='utf-8'))
    close, hidden, faces = [], [], []
    for c in CAMS:
        pn = c.get('place', default_place)
        bv = BVH.get(pn)
        if not bv: continue
        P, T = Vector(c['pos']), Vector(c['target'])
        hit = bv.find_nearest(P)
        if hit[0] is not None and hit[3] < .08: close.append(f't {c["t"]}: {hit[3]:.3f} D')
        d = T - P
        if d.length > .5:
            r = bv.ray_cast(P, d.normalized(), d.length - .35)
            if r[0] is not None: hidden.append(f't {c["t"]} (hit at {r[3]:.2f} D)')
            fw = d.normalized(); right = fw.cross(Vector((0, 1, 0))).normalized(); up = right.cross(fw)
            hv = math.tan(math.radians(c.get('fov', 50)) / 2); hh = hv * c.get('aspect', 16 / 9 if '--wide' in ARGS else 9 / 16)
            for h in KEEP.get(pn, {}).get('heads', []):
                H = Vector(h['pos']); v = H - P; dz = v.dot(fw)
                if dz < .4 or abs(v.dot(right)) / dz > hh or abs(v.dot(up)) / dz > hv: continue
                r = bv.ray_cast(P, v.normalized(), v.length - .25)
                if r[0] is not None: faces.append(f't {c["t"]} {h.get("name", "head")}')
    check(not close, f'camera never within .08 D of a surface ({len(CAMS)} samples)' + (': ' + ', '.join(close[:8]) if close else ''))
    check(not hidden, 'camera target never hidden by the set' + (': ' + ', '.join(hidden[:8]) if hidden else ''))
    check(not faces, 'no head in view hidden by the set' + (': ' + ', '.join(faces[:8]) if faces else ''))

# ---------------------------------------------------------------------------------------------------------------- clay pictures
def to_b(p): return (p[0], -p[2], p[1])

def cam_at(t):
    """The camera at time t: straight between the two nearest samples."""
    S = sorted(CAMS, key=lambda c: c['t'])
    if not S: return None
    if t <= S[0]['t']: return S[0]
    for a, b in zip(S, S[1:]):
        if a['t'] <= t <= b['t']:
            u = 0 if b['t'] == a['t'] else (t - a['t']) / (b['t'] - a['t'])
            mix = lambda x, y: [x[i] + (y[i] - x[i]) * u for i in range(3)]
            return dict(t=t, pos=mix(a['pos'], b['pos']), target=mix(a['target'], b['target']), fov=a.get('fov', 50), place=a.get('place', default_place))
    return S[-1]

if '--render' in ARGS:
    times = [float(x) for x in (opt_list('--render') or [])]
    clay_dir = Path(opt('--clay-out')) if opt('--clay-out') else PROJECT / '.suite' / 'clay'
    clay_dir.mkdir(parents=True, exist_ok=True)
    pn = default_place
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    def mat(name, rgb, alpha=1.0):
        m = bpy.data.materials.new(name)
        if m.node_tree is None: m.use_nodes = True
        b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = .75
        m.diffuse_color = (*rgb, alpha)                  # what workbench shows
        if alpha < 1:
            b.inputs['Alpha'].default_value = alpha
            m.surface_render_method = 'BLENDED'
        return m
    clay, red, dark, glow = mat('clay', (.5, .5, .5)), mat('stand', (.9, .15, .1)), mat('decal', (.03, .02, .015), .55), mat('glow', (1, 1, .9))
    bg = next(n for n in glow.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bg.inputs['Emission Color'].default_value = (1, .97, .9, 1); bg.inputs['Emission Strength'].default_value = 3
    def add_mesh(name, verts, polys, m):
        me = bpy.data.meshes.new(name); me.from_pydata(verts, [], polys); me.update(); me.materials.append(m)
        ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob); return ob
    lamps = []
    for i, p in enumerate(PLACES[pn]):
        add_mesh('part%d' % i, [to_b(v) for v in p['pos'].tolist()], [tuple(int(k) for k in t) for t in p['tris']], glow if p['emissive'] else clay)
        if p['emissive']:
            for g in components(p['pos'], p['tris']): lamps.append(p['pos'][g].mean(axis=0))
    verts, polys = [], []                               # decals as dark see-through quads, to judge their spread
    for d in SC.get(pn, {}).get('decals', []):
        n = Vector(d['normal'])
        u = Vector((1, 0, 0)) if d['surface'] in ('floor', 'ceiling') else Vector((0, 1, 0)).cross(n).normalized()
        v = n.cross(u)
        c, s = math.cos(d['spin']), math.sin(d['spin'])
        uu, vv = u * c + v * s, v * c - u * s
        P = Vector(d['pos']) + n * .006
        b0 = len(verts)
        for a, e in ((-.5, -.5), (.5, -.5), (.5, .5), (-.5, .5)):
            verts.append(to_b(P + uu * (a * d['size'][0]) + vv * (e * d['size'][1])))
        polys.append((b0, b0 + 1, b0 + 2, b0 + 3))
    if verts: add_mesh('decals', verts, polys, dark)
    for h in KEEP.get(pn, {}).get('heads', []):         # a red stand-in per person: body cylinder from the floor, a head ball
        x, y, z = h['pos']
        bpy.ops.mesh.primitive_cylinder_add(radius=.3, depth=max(.2, y - .3), location=to_b((x, (y - .3) / 2, z))); bpy.context.object.data.materials.append(red)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=h.get('r', .6) * .9, location=to_b((x, y, z))); bpy.context.object.data.materials.append(red)
    for i, L in enumerate(lamps[:16]):
        l = bpy.data.lights.new('lamp%d' % i, 'POINT'); l.energy = 400; l.shadow_soft_size = .4
        o = bpy.data.objects.new('lamp%d' % i, l); o.location = to_b((L[0], L[1] - .4, L[2])); scene.collection.objects.link(o)
    w = bpy.data.worlds.new('w'); scene.world = w
    if w.node_tree is None: w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (.5, .55, .6, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = .25
    eng = (opt('--engine') or 'eevee').lower()
    scene.render.engine = 'BLENDER_WORKBENCH' if eng == 'workbench' else 'BLENDER_EEVEE'
    if eng != 'workbench': scene.eevee.taa_render_samples = 16
    else: scene.display.shading.color_type = 'MATERIAL'   # so the red stand-ins and dark decals show
    scene.render.resolution_x, scene.render.resolution_y = (768, 432) if '--wide' in ARGS else (432, 768)
    scene.render.image_settings.file_format = 'PNG'
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
    cam.data.sensor_fit = 'VERTICAL'; cam.data.clip_start = .03; cam.data.clip_end = 900
    allp = np.concatenate([p['pos'] for p in PLACES[pn]])
    lo, hi = allp.min(axis=0), allp.max(axis=0)
    shots = [cam_at(t) for t in times] if CAMS and times else [dict(t=0, pos=[lo[0] + (hi[0] - lo[0]) * .85, (lo[1] + hi[1]) * .55, lo[2] + (hi[2] - lo[2]) * .9],
                                                                     target=[(lo[0] + hi[0]) / 2, hi[1] * .25, (lo[2] + hi[2]) / 2], fov=70)]
    if times and not CAMS: print('NOTE: no --cams given, so one overview picture instead of the asked times', flush=True)
    for s in shots:
        P, T = Vector(to_b(s['pos'])), Vector(to_b(s['target']))
        cam.location = P
        cam.rotation_mode = 'QUATERNION'; cam.rotation_quaternion = (T - P).to_track_quat('-Z', 'Y')
        cam.data.angle_y = math.radians(s.get('fov', 50))
        scene.render.filepath = str(clay_dir / f'clay_{s["t"]:05.2f}.png')
        bpy.ops.render.render(write_still=True)
        print('WROTE', scene.render.filepath, flush=True)

print(('CHECK OK' if not fails else f'CHECK FAIL: {len(fails)} problems: ' + ' | '.join(fails[:6])), flush=True)
sys.exit(0 if not fails else 1)
