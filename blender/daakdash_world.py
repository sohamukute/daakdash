"""DaakDash low-poly world.

Builds five service scenes (depot, truck lanes, rail, city delivery, tracking HQ) along one
strip of land, animates the vehicles on loops that are seamless over each scene's hold
segment, flies the camera between scenes, and renders the hero film or isolated tiles.

    blender -b -P blender/daakdash_world.py -- --mode stills --out /tmp/dd
    blender -b -P blender/daakdash_world.py -- --mode anim   --out /tmp/dd
    blender -b -P blender/daakdash_world.py -- --mode tiles  --out /tmp/dd

Timeline (24 fps): hold k = [k*(LOOP+TRANS), +LOOP), flight into k+1 = next TRANS frames.
Every motion inside a scene has a period that divides LOOP, so jumping from the end of a
hold back to its start is invisible. The frontend reads the same numbers (see HERO_FILM in
frontend/src/components/landing/heroFilm.ts).
"""

import argparse
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--mode", default="stills", choices=["stills", "anim", "tiles", "save", "hotspots"])
ap.add_argument("--out", default="/tmp/daakdash_render")
ap.add_argument("--scale", type=int, default=100, help="resolution percentage")
ap.add_argument("--samples", type=int, default=32)
ap.add_argument("--frames", default="", help="a-b subset for anim, or comma list for stills")
ap.add_argument("--engine", default="cycles", choices=["cycles", "eevee"])
ap.add_argument("--view", default="AgX")
ap.add_argument("--look", default="AgX - Punchy")
ap.add_argument("--exposure", type=float, default=0.0)
ap.add_argument("--fstop", type=float, default=1.2, help="camera aperture; low = stronger miniature blur")
ap.add_argument("--only", type=int, default=-1, help="render only this scene index in stills")
args = ap.parse_args(argv)

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_PATH = os.path.join(HERE, "fonts", "Montserrat-ExtraBoldItalic.otf")

FPS = 24
LOOP = 192
TRANS = 60
SCENES = ["depot", "highway", "rail", "city", "tower"]
# One connected landscape: depot -> serpentine truck road over the hills -> railhead ->
# city -> HQ tower by the sea. Self-contained scenes are built in local coordinates under a
# root empty placed here; the highway is built directly in world coordinates.
SCENE_POS = [(0.0, 0.0), (240.0, 70.0), (490.0, 212.0), (770.0, 60.0), (905.0, 252.0)]
TOTAL = len(SCENES) * LOOP + (len(SCENES) - 1) * TRANS


def hold(k):
    s = k * (LOOP + TRANS)
    return s, s + LOOP


# ----------------------------------------------------------------------------- palette

PAL = {
    "red": "#E63B2E", "red_deep": "#B82A1F", "navy": "#16233B", "ink": "#1E2533",
    "ground": "#EFEEEA", "pad": "#F6F5F1", "pad2": "#E2E0DA", "asphalt": "#CFCFCB",
    "line": "#FFFFFF", "wall": "#FAFAF8", "wall2": "#E8E7E3", "wall3": "#E2DDD2",
    "roof": "#40454D", "roof2": "#5A5F68", "glass": "#1F2733", "amber": "#FFC46B",
    "leaf": "#1E9E7E", "leaf2": "#178A6D", "leaf3": "#35B190", "trunk": "#5E4A3C",
    "grass": "#D3EBD9", "hill": "#B3DFC1", "hill2": "#9DD3AF", "hill3": "#C7E8D0",
    "rock": "#DADDD8", "snow": "#F7F8F7", "cardboard": "#D2A56C", "steel": "#6B7280",
    "water": "#9CCDEB", "water2": "#8DC2E4", "panel": "#2B3442",
    "rack": "#3A3F48", "beam": "#D9DCE0", "cardboard2": "#C4925A", "machine": "#C9CDD3",
    "tyre": "#262930", "white": "#FFFFFF", "skin": "#B9825E", "c_navy": "#2C3E5E",
    "c_grey": "#C3C8CE", "c_white": "#F1F1EC", "c_amber": "#F0A93C", "gravel": "#B3AA9C",
    "rail": "#5B5F66", "sleeper": "#8A7563", "terracotta": "#C9694B", "sage_wall": "#DCE5D8",
    "sand_wall": "#EFE1C8", "wheat": "#E6D3A3",
}


def lin(hexstr):
    h = hexstr.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


MATS = {}


def mat(key, rough=0.75, emit=0.0, metal=0.0):
    name = f"{key}_{rough}_{emit}_{metal}"
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = lin(PAL[key])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.25
    if emit:
        bsdf.inputs["Emission Color"].default_value = lin(PAL[key])
        bsdf.inputs["Emission Strength"].default_value = emit
    MATS[name] = m
    return m


# ----------------------------------------------------------------------------- primitives

COL = None
MESH_CACHE = {}


def set_collection(name):
    global COL
    COL = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(COL)
    return COL


ROOT = None  # scene root empty; parent-less objects created while it is set hang under it


def link(ob, parent=None):
    COL.objects.link(ob)
    if parent is None:
        parent = ROOT
    if parent is not None:
        ob.parent = parent
    return ob


def empty(name, loc=(0, 0, 0), rz=0.0, parent=None):
    ob = bpy.data.objects.new(name, None)
    ob.location = loc
    ob.rotation_euler.z = rz
    return link(ob, parent)


def _mesh(key, build, material):
    ck = (key, material.name)
    if ck in MESH_CACHE:
        return MESH_CACHE[ck]
    me = bpy.data.meshes.new(f"m_{len(MESH_CACHE)}")
    bm = bmesh.new()
    build(bm)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    MESH_CACHE[ck] = me
    return me


def box(sx, sy, sz, loc, m, rz=0.0, parent=None, name="box", bevel=None, rx=0.0, ry=0.0):
    """Axis box with its origin at the centre of the bottom face. Edges are rounded by default:
    rounded edges catch the light, the toy-model look of the reference film."""
    b = min(0.14, 0.12 * min(sx, sy, sz)) if bevel is None else min(bevel, 0.49 * min(sx, sy, sz))

    def build(bm):
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
        bmesh.ops.translate(bm, vec=(0, 0, sz / 2), verts=bm.verts)
        if b > 0.012:
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=b, segments=3 if b > 0.15 else 2, affect="EDGES", profile=0.5)
    me = _mesh(("box", round(sx, 3), round(sy, 3), round(sz, 3), round(b, 3)), build, m)
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    ob.rotation_euler = (rx, ry, rz)
    return link(ob, parent)


def cyl(r, h, loc, m, segs=10, axis="Z", parent=None, r2=None, name="cyl"):
    r2 = r if r2 is None else r2

    def build(bm):
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r2, depth=h)
        bmesh.ops.translate(bm, vec=(0, 0, h / 2), verts=bm.verts)
    me = _mesh(("cyl", r, r2, h, segs), build, m)
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    if axis == "Y":
        ob.rotation_euler.x = math.pi / 2
    elif axis == "X":
        ob.rotation_euler.y = math.pi / 2
    return link(ob, parent)


def ico(r, loc, m, variant=0, squash=1.0, parent=None, name="ico"):
    def build(bm):
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r)
        rnd = random.Random(variant)
        for v in bm.verts:
            v.co *= 1 + rnd.uniform(-0.12, 0.12)
            v.co.z *= squash
    me = _mesh(("ico", r, variant, squash), build, m)
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    return link(ob, parent)


def prism(sx, sy, h, loc, m, rz=0.0, parent=None):
    """Gable roof: ridge along local X."""
    def build(bm):
        a, b = sx / 2, sy / 2
        vs = [bm.verts.new(p) for p in [(-a, -b, 0), (a, -b, 0), (a, b, 0), (-a, b, 0), (-a, 0, h), (a, 0, h)]]
        for f in [(0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)]:
            bm.faces.new([vs[i] for i in f])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = _mesh(("prism", sx, sy, h), build, m)
    ob = bpy.data.objects.new("roof", me)
    ob.location = loc
    ob.rotation_euler.z = rz
    return link(ob, parent)


FONT = None


def text(body, size, loc, rot, m, parent=None, extrude=0.03, align="CENTER"):
    global FONT
    if FONT is None:
        FONT = bpy.data.fonts.load(FONT_PATH) if os.path.exists(FONT_PATH) else None
    cu = bpy.data.curves.new("txt", "FONT")
    cu.body = body
    if FONT:
        cu.font = FONT
    cu.size = size
    cu.extrude = extrude
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.materials.append(m)
    ob = bpy.data.objects.new("txt", cu)
    ob.location = loc
    ob.rotation_euler = rot
    return link(ob, parent)


def wall_text(body, size, x, y, z, facing, m, parent=None):
    """Text standing on a wall. facing: '-Y', '+Y', '-X', '+X'."""
    rz = {"-Y": 0.0, "+Y": math.pi, "-X": -math.pi / 2, "+X": math.pi / 2}[facing]
    return text(body, size, (x, y, z), (math.pi / 2, 0, rz), m, parent)


def strip_mesh(name, pts, width, z, m, dash=0.0):
    """Flat ribbon along a polyline. dash>0 keeps only every other dash-length piece."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    acc = 0.0
    prev = None
    for i in range(len(pts) - 1):
        p0, p1 = pts[i], pts[i + 1]
        d = (p1 - p0)
        seg_len = d.length
        if seg_len < 1e-6:
            continue
        n = Vector((-d.y, d.x, 0)).normalized() * (width / 2)
        keep = True if dash <= 0 else (int(acc // dash) % 2 == 0)
        acc += seg_len
        if not keep:
            prev = None
            continue
        if prev is None:
            prev = (bm.verts.new((p0.x - n.x, p0.y - n.y, z)), bm.verts.new((p0.x + n.x, p0.y + n.y, z)))
        cur = (bm.verts.new((p1.x - n.x, p1.y - n.y, z)), bm.verts.new((p1.x + n.x, p1.y + n.y, z)))
        bm.faces.new((prev[0], cur[0], cur[1], prev[1]))
        prev = cur if dash <= 0 else None
    bm.to_mesh(me)
    bm.free()
    me.materials.append(m)
    return link(bpy.data.objects.new(name, me))


# ----------------------------------------------------------------------------- paths

def catmull(ctrl, samples_per_seg=24, closed=False):
    pts = [Vector((p[0], p[1], 0)) for p in ctrl]
    if closed:
        pts = [pts[-1]] + pts + [pts[0], pts[1]]
    else:
        pts = [pts[0]] + pts + [pts[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for s in range(samples_per_seg):
            t = s / samples_per_seg
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(pts[-2].copy())
    return out


def rounded_rect(cx, cy, w, h, r, n=6):
    """Closed rectangle with rounded corners as a point list (counter-clockwise)."""
    pts = []
    corners = [(cx + w / 2 - r, cy - h / 2 + r, -90), (cx + w / 2 - r, cy + h / 2 - r, 0),
               (cx - w / 2 + r, cy + h / 2 - r, 90), (cx - w / 2 + r, cy - h / 2 + r, 180)]
    for (x, y, a0) in corners:
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append(Vector((x + r * math.cos(a), y + r * math.sin(a), 0)))
    pts.append(pts[0].copy())
    return pts


class Path:
    def __init__(self, pts):
        self.pts = pts
        self.cum = [0.0]
        for i in range(1, len(pts)):
            self.cum.append(self.cum[-1] + (pts[i] - pts[i - 1]).length)
        self.length = self.cum[-1]

    def at(self, s):
        s = max(0.0, min(self.length, s))
        lo, hi = 0, len(self.cum) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if self.cum[mid] <= s:
                lo = mid
            else:
                hi = mid
        seg = self.cum[hi] - self.cum[lo]
        t = 0 if seg == 0 else (s - self.cum[lo]) / seg
        p = self.pts[lo].lerp(self.pts[hi], t)
        d = self.pts[hi] - self.pts[lo]
        return p, math.atan2(d.y, d.x)


# ----------------------------------------------------------------------------- animation

ANIM = []  # (object, k, fn(frame)->(loc, rz))


def animate(ob, k, fn):
    ANIM.append((ob, k, fn))


def bake_animation():
    for ob, k, fn in ANIM:
        s, e = hold(k)
        f0, f1 = max(0, s - TRANS - 2), min(TOTAL, e + TRANS + 2)
        last = None
        for f in range(f0, f1 + 1):
            loc, rz = fn(f)
            if rz is not None:
                if last is not None:
                    while rz - last > math.pi:
                        rz -= 2 * math.pi
                    while rz - last < -math.pi:
                        rz += 2 * math.pi
                last = rz
                ob.rotation_euler.z = rz
                ob.keyframe_insert("rotation_euler", index=2, frame=f)
            ob.location = loc
            ob.keyframe_insert("location", frame=f)


def convoy(k, path, n, build, lane=0.0, reverse=False, z=0.0, slots=1):
    """n identical vehicles evenly spaced along an open or closed path. Each hold moves every
    vehicle forward by `slots` spacings, so the picture at the end of a hold equals its start
    while the speed stays at a believable path_length * slots / (n * hold)."""
    for i in range(n):
        ob = build(i)

        def fn(f, i=i):
            u = ((i + slots * (f % LOOP) / LOOP) / n) % 1.0
            s = (1 - u if reverse else u) * path.length
            p, h = path.at(s)
            nrm = Vector((math.sin(h), -math.cos(h), 0))
            q = p + nrm * lane
            return (q.x, q.y, z), h + (math.pi if reverse else 0)
        animate(ob, k, fn)


# ----------------------------------------------------------------------------- props

def tree(x, y, s=1.0, variant=0, parent=None, z=0.0):
    rnd = random.Random(variant * 7919 + int(x * 13 + y * 7))
    root = empty("tree", (x, y, z), parent=parent)
    cyl(0.16 * s, 1.8 * s, (0, 0, 0), mat("trunk"), segs=5, parent=root)
    leaf = ("leaf", "leaf2", "leaf3")[variant % 3]
    ico(1.25 * s, (0, 0, 3.0 * s), mat(leaf, rough=0.85), variant=variant % 5, squash=1.55, parent=root)
    root.rotation_euler.z = rnd.uniform(0, math.tau)
    return root


def conifer(x, y, s=1.0, z=0.0, variant=0):
    root = empty("pine", (x, y, z))
    cyl(0.2 * s, 1.2 * s, (0, 0, 0), mat("trunk"), segs=5, parent=root)
    leaf = ("leaf2", "leaf", "leaf2")[variant % 3]
    cyl(1.7 * s, 3.2 * s, (0, 0, 1.0 * s), mat(leaf, rough=0.9), segs=6, r2=0.6 * s, parent=root)
    cyl(1.2 * s, 2.6 * s, (0, 0, 3.0 * s), mat(leaf, rough=0.9), segs=6, r2=0.0, parent=root)
    root.rotation_euler.z = variant * 0.7
    return root


def person(x, y, rz=0.0, vest="red", parent=None):
    root = empty("person", (x, y, 0), rz, parent)
    cyl(0.2, 0.85, (0, 0, 0), mat("ink"), segs=6, parent=root)
    cyl(0.25, 0.65, (0, 0, 0.85), mat(vest), segs=6, r2=0.2, parent=root)
    ico(0.17, (0, 0, 1.7), mat("skin"), parent=root)
    return root


def parcel_stack(x, y, n=6, parent=None, seed=0):
    rnd = random.Random(seed)
    root = empty("parcels", (x, y, 0), parent=parent)
    box(1.2, 1.0, 0.15, (0, 0, 0), mat("sleeper"), parent=root)
    for i in range(n):
        sx = rnd.choice((0.5, 0.6, 0.45))
        box(sx, sx * 0.8, sx * 0.7, (rnd.uniform(-0.3, 0.3), rnd.uniform(-0.25, 0.25), 0.15 + (i // 3) * 0.5),
            mat("cardboard"), rz=rnd.uniform(-0.2, 0.2), parent=root)
    return root


def car(x, y, rz=0.0, color="wall", parent=None):
    """Rounded sedan, forward = +X."""
    root = empty("car", (x, y, 0), rz, parent)
    box(4.4, 1.85, 0.75, (0, 0, 0.28), mat(color, rough=0.3), parent=root, bevel=0.3)
    box(2.4, 1.65, 0.72, (-0.25, 0, 0.82), mat(color, rough=0.3), parent=root, bevel=0.32)
    box(2.2, 1.69, 0.42, (-0.25, 0, 0.98), mat("glass", rough=0.15), parent=root, bevel=0.18)
    for wx in (-1.35, 1.35):
        for wy in (-0.8, 0.8):
            cyl(0.34, 0.24, (wx, wy - 0.12 if wy > 0 else wy + 0.12, 0.34), mat("tyre"), segs=12, axis="Y", parent=root)
    return root


def wheel(x, y, r, parent):
    side = 1 if y > 0 else -1
    cyl(r, 0.36, (x, y - side * 0.18, r), mat("tyre", rough=0.8), segs=14, axis="Y", parent=parent)
    cyl(r * 0.55, 0.04, (x, y + side * 0.2, r), mat("steel", rough=0.35, metal=0.6), segs=12, axis="Y", parent=parent)


def truck(name="truck", trailer_color="red", label=True, parent=None):
    """Cab-over tractor with box trailer, forward = +X, ~15 m long, origin at ground centre."""
    root = empty(name, parent=parent)
    # chassis, wheels, fuel tank, steps
    box(14.4, 1.9, 0.35, (0.2, 0, 0.6), mat("tyre"), parent=root, bevel=0.05)
    for wx in (-5.9, -4.7, 3.6, 6.0):
        for wy in (-1.08, 1.08):
            wheel(wx, wy, 0.52, root)
    for side in (-1, 1):
        cyl(0.3, 1.1, (4.6, side * 1.0, 0.75), mat("steel", rough=0.3, metal=0.7), segs=12, axis="X", parent=root)
        box(1.0, 0.08, 0.32, (-1.0, side * 1.22, 0.55), mat("steel", rough=0.4), parent=root, bevel=0.02)  # underrun bar
    # cab: rounded block, sloped windscreen, roof fairing, grille, lamps, mirrors
    box(2.5, 2.5, 2.75, (6.0, 0, 0.85), mat("red", rough=0.35), parent=root, bevel=0.28)
    box(1.9, 2.36, 1.05, (5.75, 0, 3.45), mat("red", rough=0.35), parent=root, bevel=0.35)
    box(0.1, 2.2, 1.2, (7.22, 0, 2.05), mat("glass", rough=0.08), parent=root, bevel=0.04, ry=-0.12)
    box(0.1, 2.0, 0.55, (7.27, 0, 1.15), mat("ink", rough=0.5), parent=root, bevel=0.03)
    box(0.06, 0.9, 0.1, (7.31, 0, 1.45), mat("white"), parent=root, bevel=0.02)
    box(0.24, 2.52, 0.42, (7.12, 0, 0.62), mat("ink", rough=0.6), parent=root, bevel=0.08)
    for side in (-1, 1):
        box(0.06, 0.42, 0.18, (7.3, side * 0.92, 0.92), mat("white", emit=2.5), parent=root, bevel=0.03)
        box(0.9, 0.05, 0.75, (6.55, side * 1.26, 2.35), mat("glass", rough=0.08), parent=root, bevel=0.03)
        box(0.08, 0.05, 0.5, (7.25, side * 1.42, 2.3), mat("ink"), parent=root, bevel=0.02)          # mirror
        box(0.5, 0.25, 0.06, (7.1, side * 1.32, 2.55), mat("ink"), parent=root, bevel=0.02)          # mirror arm
        box(0.5, 0.18, 0.08, (6.6, side * 1.25, 0.95), mat("steel"), parent=root, bevel=0.02)       # step
    # trailer: box with white roof strip, rails, rear frame
    box(11.2, 2.55, 3.15, (-1.45, 0, 1.0), mat(trailer_color, rough=0.4), parent=root, bevel=0.07)
    box(11.24, 2.59, 0.14, (-1.45, 0, 4.06), mat("white"), parent=root, bevel=0.04)
    box(11.24, 2.59, 0.14, (-1.45, 0, 1.0), mat("wall2"), parent=root, bevel=0.04)
    box(0.08, 2.4, 2.95, (-7.06, 0, 1.1), mat("red_deep", rough=0.5), parent=root, bevel=0.02)
    box(0.1, 0.1, 2.95, (-7.08, 0, 1.1), mat("steel"), parent=root, bevel=0.02)
    if label:
        wall_text("DaakDash", 1.7, -1.2, -1.3, 2.55, "-Y", mat("white"), root)
        wall_text("DaakDash", 1.7, -1.7, 1.3, 2.55, "+Y", mat("white"), root)
    return root


def van(name="van", parent=None):
    root = empty(name, parent=parent)
    box(5.2, 2.0, 2.0, (0, 0, 0.45), mat("red"), parent=root)
    box(1.2, 1.9, 0.9, (2.15, 0, 1.35), mat("glass", rough=0.2), parent=root)
    box(5.25, 2.05, 0.15, (0, 0, 2.45), mat("white"), parent=root)
    wall_text("DaakDash", 0.62, -0.6, -1.02, 1.45, "-Y", mat("white"), root)
    wall_text("DaakDash", 0.62, -0.6, 1.02, 1.45, "+Y", mat("white"), root)
    for wx in (-1.7, 1.7):
        for wy in (-0.9, 0.9):
            cyl(0.4, 0.3, (wx, wy + (0.15 if wy < 0 else -0.15), 0.4), mat("tyre"), segs=8, axis="Y", parent=root)
    return root


def scooter(name="scooter", parent=None, rider=True):
    """Delivery scooter with top box, forward = +X, ~2 m long."""
    root = empty(name, parent=parent)
    cyl(0.32, 0.16, (0.75, 0.08, 0.32), mat("tyre"), segs=8, axis="Y", parent=root)
    cyl(0.32, 0.16, (-0.7, 0.08, 0.32), mat("tyre"), segs=8, axis="Y", parent=root)
    box(1.55, 0.5, 0.42, (0, 0, 0.35), mat("red"), parent=root)
    box(0.25, 0.5, 0.9, (0.65, 0, 0.5), mat("red"), parent=root)
    box(0.1, 0.7, 0.08, (0.72, 0, 1.38), mat("ink"), parent=root)
    box(0.72, 0.66, 0.6, (-0.62, 0, 0.82), mat("red_deep"), parent=root)
    box(0.74, 0.68, 0.1, (-0.62, 0, 1.12), mat("white"), parent=root)
    if rider:
        cyl(0.2, 0.55, (0.0, 0, 0.75), mat("ink"), segs=6, parent=root)
        cyl(0.24, 0.62, (0.05, 0, 1.25), mat("red"), segs=6, r2=0.2, parent=root)
        ico(0.2, (0.08, 0, 2.05), mat("red"), parent=root)
    return root


def locomotive(name="loco", parent=None):
    root = empty(name, parent=parent)
    box(19.0, 2.9, 0.6, (0, 0, 0.75), mat("tyre"), parent=root)
    box(18.6, 3.0, 3.5, (0, 0, 1.35), mat("red"), parent=root)
    box(18.65, 3.05, 0.45, (0, 0, 2.3), mat("navy"), parent=root)
    box(0.12, 2.6, 1.0, (9.32, 0, 3.4), mat("glass", rough=0.2), parent=root)
    box(0.12, 2.6, 1.0, (-9.32, 0, 3.4), mat("glass", rough=0.2), parent=root)
    box(17.0, 2.2, 0.3, (0, 0, 4.85), mat("steel"), parent=root)
    wall_text("DaakDash", 1.1, 0, -1.53, 3.5, "-Y", mat("white"), root)
    wall_text("DaakDash", 1.1, 0, 1.53, 3.5, "+Y", mat("white"), root)
    for bx in (-6.5, 6.5):
        box(4.0, 2.4, 0.7, (bx, 0, 0.1), mat("ink"), parent=root)
    return root


CONTAINER_COLORS = ["red", "c_white", "c_navy", "red", "c_grey", "c_amber"]


def wagon(color="red", parent=None, label=None):
    root = empty("wagon", parent=parent)
    box(14.0, 2.8, 0.45, (0, 0, 0.85), mat("ink"), parent=root)
    for bx in (-4.8, 4.8):
        box(2.6, 2.3, 0.75, (bx, 0, 0.1), mat("tyre"), parent=root)
    container(12.2, color, (0, 0, 1.3), parent=root, label=label)
    return root


def container(length, color, loc, parent=None, label=None, rz=0.0):
    root = empty("container", loc, rz, parent)
    box(length, 2.45, 2.6, (0, 0, 0), mat(color), parent=root)
    for i in range(int(length // 2.4)):
        x = -length / 2 + 1.2 + i * 2.4
        box(0.12, 2.5, 2.5, (x, 0, 0.05), mat(color, rough=0.6), parent=root)
    if label is None:
        label = color == "red"
    if label:
        wall_text("DaakDash", 0.95, 0, -1.29, 1.3, "-Y", mat("white"), root)
        wall_text("DaakDash", 0.95, 0, 1.29, 1.3, "+Y", mat("white"), root)
    return root


def windows_band(sx, sy, z, h, loc, m, parent=None, rz=0.0):
    return box(sx + 0.12, sy + 0.12, h, (loc[0], loc[1], loc[2] + z), m, rz=rz, parent=parent)


def office_block(x, y, sx, sy, floors, wall="wall", glass="glass", parent=None, roof_props=True, lit=False):
    fh = 3.4
    h = floors * fh + 0.6
    root = empty("block", (x, y, 0), parent=parent)
    box(sx, sy, h, (0, 0, 0), mat(wall), parent=root)
    gm = mat("amber", emit=1.4) if lit else mat(glass, rough=0.2)
    for f in range(floors):
        windows_band(sx, sy, 1.1 + f * fh, 1.6, (0, 0, 0), gm if (lit and f % 2 == 0) else mat(glass, rough=0.2), root)
    box(sx + 0.3, sy + 0.3, 0.35, (0, 0, h), mat("wall2"), parent=root)
    if roof_props:
        box(sx * 0.3, sy * 0.25, 1.4, (sx * 0.15, -sy * 0.1, h + 0.35), mat("pad2"), parent=root)
        box(1.6, 1.6, 0.9, (-sx * 0.25, sy * 0.2, h + 0.35), mat("steel"), parent=root)
    return root


def house(x, y, rz=0.0, wall="wall", roof="terracotta", parent=None, s=1.0):
    root = empty("house", (x, y, 0), rz, parent)
    hx, hy, hz = 8 * s, 7 * s, 4.2 * s
    box(hx + 0.4, hy + 0.4, 0.35, (0, 0, 0), mat("wall2"), parent=root, bevel=0.06)       # plinth
    box(hx, hy, hz, (0, 0, 0.3), mat(wall), parent=root)
    prism(hx + 0.8, hy + 0.8, 2.6 * s, (0, 0, hz + 0.3), mat(roof, rough=0.6), parent=root)
    box(0.7, 0.7, 1.8, (hx * 0.25, hy * 0.18, hz + 1.2), mat("wall2"), parent=root)      # chimney
    box(1.1, 0.12, 2.2, (hx * 0.2, -hy / 2 - 0.04, 0.3), mat("navy", rough=0.4), parent=root, bevel=0.03)
    box(1.7, 0.9, 0.12, (hx * 0.2, -hy / 2 - 0.45, 2.6), mat("wall2"), parent=root, bevel=0.03)  # canopy
    for face in (-1, 1):
        for wx in (-hx * 0.3, hx * 0.33):
            if face == -1 and abs(wx - hx * 0.2) < 1.2:
                continue
            box(1.3, 0.1, 1.2, (wx, face * (hy / 2 + 0.03), 1.6), mat("glass", rough=0.1), parent=root, bevel=0.03)
            box(1.5, 0.16, 0.1, (wx, face * (hy / 2 + 0.05), 1.5), mat("wall2"), parent=root, bevel=0.02)
        for wy in (-hy * 0.2, hy * 0.2):
            box(0.1, 1.2, 1.2, (face * (hx / 2 + 0.03), wy, 1.6), mat("glass", rough=0.1), parent=root, bevel=0.03)
    return root


# ----------------------------------------------------------------------------- world

def build_ground():
    box(2600, 1700, 0.1, (450, 200, -0.1), mat("ground", rough=0.95), name="ground")
    # faceted sea north-east of the city, behind the HQ tower
    me = bpy.data.meshes.new("sea")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=60, y_segments=24, size=1.0)
    rnd = random.Random(8)
    for v in bm.verts:
        v.co = Vector((800 + v.co.x * 520, 470 + v.co.y * 120, 0.05 + rnd.uniform(-0.05, 0.05)))
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat("water", rough=0.65))
    link(bpy.data.objects.new("sea", me))
    box(1040, 6, 1.2, (800, 348, 0), mat("pad2"), name="quay")
    # mountain range: west of the hills and beyond the sea
    rnd = random.Random(4)
    ranges = [(-260 + i * 34, 330 + rnd.uniform(-20, 40)) for i in range(16)]
    ranges += [(300 + i * 40, 640 + rnd.uniform(0, 80)) for i in range(26)]
    ranges += [(-300 + rnd.uniform(-30, 30), -100 + i * 40) for i in range(11)]
    for i, (x, y) in enumerate(ranges):
        s = rnd.uniform(34, 70)
        mtn = ico(s, (x, y, -s * 0.3), mat("rock", rough=0.95), variant=i % 5, squash=0.8, name="mtn")
        mtn.scale = (1.35, 1.0, 1.0)
        green = ico(s * 0.9, (x, y - s * 0.25, -s * 0.45), mat("hill2", rough=0.95), variant=(i + 1) % 5, squash=0.55, name="mtn_foot")
        green.scale = (1.4, 1.0, 1.0)
        if s > 52:
            cap = ico(s * 0.38, (x, y, s * 0.36), mat("snow", rough=0.9), variant=(i + 2) % 5, squash=0.7, name="snow")
            cap.scale = (1.35, 1.0, 1.0)


# keep-out boxes in world space (x0, x1, y0, y1): filler never lands here
KEEP_OUT = [
    (-112, 100, -50, 92),      # depot
    (105, 335, -55, 195),      # hills + serpentine
    (315, 665, 168, 258),      # railhead footprint
    (650, 890, -40, 160),      # city
    (790, 1010, 160, 345),     # HQ
    (555, 668, 60, 156),       # cross-dock park
    (-170, 170, -36, -16),     # depot road
]


def mound(x, y, r):
    """Forested hill over a tunnel mouth: overlapping low-poly lumps with pines on the slopes."""
    rnd = random.Random(int(x * 3 + y))
    ico(r, (x, y, -r * 0.18), mat("hill2", rough=0.95), variant=int(x) % 5, squash=0.42, name="mound")
    for i in range(4):
        a = i / 4 * math.tau + rnd.uniform(-0.4, 0.4)
        rr = r * rnd.uniform(0.45, 0.65)
        ico(rr, (x + math.cos(a) * r * 0.55, y + math.sin(a) * r * 0.55, -rr * 0.2), mat(rnd.choice(["hill", "hill3"]), rough=0.95),
            variant=i, squash=0.5, name="lump")
    for i in range(22):
        a, d = rnd.uniform(0, math.tau), rnd.uniform(0.15, 0.85) * r
        h = max(0.0, (1 - (d / r) ** 2)) * r * 0.42 - r * 0.18
        conifer(x + math.cos(a) * d, y + math.sin(a) * d, s=rnd.uniform(0.9, 1.4), z=h - 0.6, variant=i)


def build_business_park():
    """DaakDash cross-dock park between the railhead and the city, so the dive between them
    flies over work, not empty ground."""
    rnd = random.Random(61)
    box(110, 92, 0.04, (612, 108, 0), mat("pad", rough=0.95), name="park_pad")
    for i, (x, y, w, d) in enumerate([(590, 132, 44, 22), (636, 128, 30, 20), (596, 84, 34, 20)]):
        box(w, d, 9, (x, y, 0), mat("wall"))
        box(w + 0.8, d + 0.8, 0.5, (x, y, 9), mat("roof", rough=0.9))
        box(w + 0.3, 0.7, 3.4, (x, y - d / 2 - 0.2, 5.6), mat("red"))
        wall_text("DaakDash", 2.2, x, y - d / 2 - 0.62, 7.3, "-Y", mat("white"))
        for j in range(int(w // 7)):
            dx = x - w / 2 + 4 + j * 7
            box(3.6, 0.3, 4.0, (dx, y - d / 2 - 0.05, 0), mat("roof2"))
            if rnd.random() < 0.6:
                t = truck(f"park_truck_{i}_{j}")
                t.location = (dx, y - d / 2 - 7.6, 0)
                t.rotation_euler.z = -math.pi / 2
    for i in range(16):
        tree(560 + i * 7, 64 + (i % 2) * 2, s=1.0, variant=i)
    for i in range(6):
        car(640 + i * 3, 86, math.pi / 2, color=("wall", "c_grey", "wall", "navy", "wall", "c_grey")[i])


def build_filler(links):
    rnd = random.Random(101)

    def free(x, y, pad=6.0):
        for (x0, x1, y0, y1) in KEEP_OUT:
            if x0 - pad < x < x1 + pad and y0 - pad < y < y1 + pad:
                return False
        if y > 340:  # sea and quay
            return False
        for pts in links:
            for p in pts[::4]:
                if (p.x - x) ** 2 + (p.y - y) ** 2 < 12 ** 2:
                    return False
        return True
    for gx in range(-260, 1120, 42):
        for gy in range(-200, 340, 34):
            if rnd.random() < 0.35:
                continue
            w, h = rnd.uniform(26, 40), rnd.uniform(20, 32)
            x, y = gx + rnd.uniform(-3, 3), gy + rnd.uniform(-3, 3)
            if free(x, y, pad=max(w, h) / 2):
                box(w, h, 0.03, (x, y, 0), mat(rnd.choice(["hill3", "grass", "hill", "grass"]), rough=0.95), name="field")
    for _ in range(1000):
        x, y = rnd.uniform(-260, 1120), rnd.uniform(-200, 335)
        if not free(x, y, pad=6):
            continue
        for j in range(rnd.randint(4, 12)):
            tx, ty = x + rnd.uniform(-11, 11), y + rnd.uniform(-11, 11)
            if free(tx, ty, pad=2):
                tree(tx, ty, s=rnd.uniform(0.85, 1.3), variant=j + int(x) % 7)
    for _ in range(30):
        x, y = rnd.uniform(-240, 1100), rnd.uniform(-190, 330)
        if free(x, y, pad=10):
            house(x, y, rz=rnd.choice((0, math.pi / 2)), wall=rnd.choice(["wall", "wall2"]),
                  roof=rnd.choice(["red_deep", "roof2", "roof"]), s=0.9)


def road_straight(x0, x1, y, width=10.0, dash=True):
    pts = [Vector((x0, y, 0)), Vector((x1, y, 0))]
    box(abs(x1 - x0), width, 0.05, ((x0 + x1) / 2, y, 0), mat("asphalt", rough=0.9), name="road")
    if dash:
        n = int(abs(x1 - x0) // 8)
        for i in range(n):
            box(3.5, 0.25, 0.02, (x0 + 4 + i * 8, y, 0.05), mat("line"))
    return Path(pts)


def lit_office(x, y, sx, sy, floors, parent=None, seed=0):
    """White office with a grid of warm-lit windows on every face (reference: lit facades)."""
    rnd = random.Random(seed)
    fh = 3.6
    h = floors * fh + 0.8
    root = empty("office", (x, y, 0), parent=parent)
    box(sx, sy, h, (0, 0, 0), mat("wall"), parent=root)
    box(sx + 0.4, sy + 0.4, 0.5, (0, 0, h), mat("wall2"), parent=root)
    for f in range(floors):
        z = 1.0 + f * fh
        for face, length in (("y", sx), ("x", sy)):
            n = max(2, int(length // 3.2))
            for i in range(n):
                t = -length / 2 + (i + 0.5) * length / n
                m = mat("amber", emit=1.5) if rnd.random() < 0.75 else mat("glass", rough=0.2)
                for side in (-1, 1):
                    if face == "y":
                        box(length / n - 0.9, 0.12, 2.0, (t, side * (sy / 2 + 0.02), z), m, parent=root)
                    else:
                        box(0.12, length / n - 0.9, 2.0, (side * (sx / 2 + 0.02), t, z), m, parent=root)
    return root


def rack_row(x, y0, bays, levels=4, bay=2.7, depth=2.3, lvl=1.65, seed=0):
    """Back-to-back pallet racking running along +Y: uprights, X-bracing, beams, decks, cartons."""
    rnd = random.Random(seed)
    top = levels * lvl + 0.45
    up = mat("rack", rough=0.45, metal=0.4)
    for i in range(bays + 1):
        y = y0 + i * bay
        for sx in (-1, 1):
            box(0.12, 0.12, top, (x + sx * depth / 2, y, 0), up, bevel=0.02)
        brace = math.hypot(depth, lvl)
        for j in range(levels):
            ang = math.atan2(lvl, depth) * (1 if j % 2 == 0 else -1)
            box(brace, 0.05, 0.05, (x, y, 0.3 + j * lvl + lvl / 2), up, ry=ang, bevel=0.01)
    for i in range(bays):
        yc = y0 + (i + 0.5) * bay
        for j in range(levels):
            z = 0.25 + j * lvl
            for sx in (-1, 1):
                box(0.08, bay - 0.12, 0.14, (x + sx * depth / 2, yc, z), mat("beam", rough=0.4), bevel=0.02)
            box(depth - 0.1, bay - 0.14, 0.04, (x, yc, z + 0.14), mat("wall2"), bevel=0.0)
            yy = yc - bay / 2 + 0.12
            while True:
                w = rnd.choice((0.55, 0.7, 0.85, 1.0))
                if yy + w > yc + bay / 2 - 0.1:
                    break
                if rnd.random() < 0.96:
                    h = min(rnd.choice((0.6, 0.8, 1.0, 1.2, 1.25)), lvl - 0.3)
                    d = rnd.choice((0.9, 1.2, 1.6, depth - 0.3))
                    box(d, w, h, (x + rnd.uniform(-0.12, 0.12), yy + w / 2, z + 0.18),
                        mat(rnd.choice(("cardboard", "cardboard2", "cardboard"))), rz=rnd.uniform(-0.04, 0.04), bevel=0.025)
                yy += w + 0.06


def forklift(name):
    root = empty(name)
    for wx in (-0.6, 0.65):
        for wy in (-0.5, 0.5):
            cyl(0.26, 0.2, (wx, wy - 0.1 if wy > 0 else wy + 0.1, 0.26), mat("tyre"), segs=10, axis="Y", parent=root)
    box(1.9, 1.1, 0.75, (0, 0, 0.22), mat("red", rough=0.35), parent=root, bevel=0.14)
    box(0.55, 1.08, 0.95, (-0.72, 0, 0.3), mat("ink", rough=0.5), parent=root, bevel=0.12)
    for px in (-0.45, 0.45):
        for py in (-0.48, 0.48):
            box(0.06, 0.06, 1.25, (px, py, 0.95), mat("ink"), parent=root, bevel=0.01)
    box(1.05, 1.1, 0.06, (0, 0, 2.2), mat("ink"), parent=root, bevel=0.02)
    cyl(0.18, 0.5, (-0.1, 0, 0.95), mat("navy"), segs=6, parent=root)
    ico(0.15, (-0.1, 0, 1.6), mat("amber"), parent=root)
    box(0.12, 0.95, 2.5, (1.02, 0, 0.12), mat("ink", rough=0.5), parent=root, bevel=0.02)
    for py in (-0.3, 0.3):
        box(1.0, 0.12, 0.05, (1.55, py, 0.3), mat("steel"), parent=root, bevel=0.01)
    box(0.95, 0.8, 0.7, (1.55, 0, 0.36), mat("cardboard"), parent=root, bevel=0.03)
    return root


def scene_depot(k):
    """DaakDash sorting depot: a cutaway hall (racks, conveyor loop, forklifts) beside the
    red-banded dock building where the trucks load. Local coordinates."""
    rnd = random.Random(7)
    box(220, 150, 0.04, (-10, 14, 0), mat("pad", rough=0.95), name="yard")
    # ---- cutaway hall: x -10..60, y 0..44
    x0, x1, y0, y1, H = -10.0, 60.0, 0.0, 44.0, 13.0
    W, D = x1 - x0, y1 - y0
    cxh, cyh = (x0 + x1) / 2, (y0 + y1) / 2
    box(W, D, 0.35, (cxh, cyh, 0), mat("pad2", rough=0.8), bevel=0.12, name="hall_floor")
    box(W - 2, D - 2, 0.02, (cxh, cyh, 0.35), mat("wall", rough=0.6), bevel=0.0)
    wall = mat("wall", rough=0.6)
    box(W, 0.7, H, (cxh, y1 - 0.35, 0.35), wall)                       # north
    box(0.7, D, H, (x0 + 0.35, cyh, 0.35), wall)                       # west
    box(0.7, D, H, (x1 - 0.35, cyh, 0.35), wall)                       # east
    box(9, 0.7, H, (x0 + 4.5, y0 + 0.35, 0.35), wall)                   # south, west stub
    box(8, 0.7, H, (x1 - 4, y0 + 0.35, 0.35), wall)                     # south, east stub
    box(2.4, 0.8, H * 0.78, (x0 + 8.0, y0 + 0.35, 0.35 + H * 0.11), mat("red"))    # red edge stripe
    box(8.1, 0.8, 4.6, (x1 - 4, y0 + 0.35, H - 4.6 + 0.35), mat("red"))
    for i in range(3):                                                   # facade panel seams
        box(0.08, 0.76, H - 0.6, (x0 + 1.6 + i * 2.2, y0 + 0.33, 0.6), mat("wall2"), bevel=0.0)
    for (rx0, rx1) in ((x0, x0 + 9), (x1 - 8, x1)):
        box(0.3, 0.3, H, (rx0 + 0.15, y0, 0.35), mat("wall2"))
    # roof: L over the west stub and the north band; black cap on every cut edge
    box(9.6, D + 0.6, 0.6, (x0 + 4.5, cyh, H + 0.35), mat("roof", rough=0.85))
    box(W + 0.6, 13, 0.6, (cxh, y1 - 6.5, H + 0.35), mat("roof", rough=0.85))
    box(W - 9, 0.5, 0.9, (cxh + 4.5, y1 - 13, H + 0.2), mat("ink"))
    box(0.5, D - 13, 0.9, (x0 + 9, cyh - 6.5, H + 0.2), mat("ink"))
    for i in range(3):                                                    # solar rows
        box(W - 22, 1.9, 0.08, (cxh + 7, y1 - 10.5 + i * 3.3, H + 1.2), mat("panel", rough=0.3), rx=0.42, bevel=0.01)
        box(W - 22, 0.12, 0.7, (cxh + 7, y1 - 10.0 + i * 3.3, H + 0.95), mat("steel"), bevel=0.01)
    for i in range(6):                                                    # antennas on the cut edge
        ax = x0 + 18 + i * 8.2
        cyl(0.07, 5.5, (ax, y1 - 13, H + 0.65), mat("ink"), segs=6)
        box(0.25, 0.25, 0.9, (ax, y1 - 13, H + 3.0), mat("ink"), bevel=0.03)
    # racks
    for i, rx in enumerate((26.0, 33.5, 41.0, 48.5, 55.8)):
        rack_row(rx, 5.5, 13, seed=i + 1)
    for (lx, ly, lw, lh) in ((23.3, 23, 0.18, 38), (13.5, 31.5, 19, 0.18), (13.5, 2.6, 19, 0.18)):
        box(lw, lh, 0.02, (lx, ly, 0.37), mat("c_amber", rough=0.6), bevel=0.0)
    for i in range(6):
        box(1.2, 1.0, 0.14, (1.5 + (i % 3) * 1.5, 34 + (i // 3) * 1.4, 0.35), mat("sleeper"), bevel=0.02)
        parcel_stack(1.5 + (i % 3) * 1.5, 37.5 + (i // 3) * 1.4, n=6, seed=40 + i).location.z = 0.35
    # conveyor loop with moving parcels, scanner arches and sorting cabinets
    loop = rounded_rect(13.5, 14.0, 11.0, 17.0, 2.4, n=8)
    strip_mesh("belt_frame", loop, 1.5, 0.82, mat("steel", rough=0.35, metal=0.5))
    strip_mesh("belt", loop, 1.05, 0.9, mat("ink", rough=0.7))
    for p in loop[::3]:
        box(0.12, 0.9, 0.48, (p.x, p.y, 0.35), mat("steel"), bevel=0.01)
    convoy(k, Path(loop), 24, lambda i: box(rnd.choice((0.55, 0.7)), rnd.choice((0.5, 0.6)), rnd.choice((0.35, 0.45, 0.55)),
                                            (0, 0, 0), mat(rnd.choice(("cardboard", "cardboard2"))), bevel=0.03), z=0.92)
    for (ax, ay, rz) in ((8.0, 14.0, 0.0), (19.0, 10.0, 0.0)):
        root = empty("scanner", (ax, ay, 0.35), rz)
        for sy in (-1.1, 1.1):
            box(0.35, 0.3, 2.4, (0, sy, 0), mat("machine", rough=0.4), parent=root, bevel=0.06)
        box(0.5, 2.6, 0.45, (0, 0, 2.4), mat("machine", rough=0.4), parent=root, bevel=0.08)
        box(0.06, 1.0, 0.14, (0.26, 0, 2.55), mat("red", emit=1.5), parent=root, bevel=0.02)
    for (mx, my) in ((7.5, 3.4), (19.5, 3.4), (19.5, 25.0)):
        box(2.4, 1.8, 2.0, (mx, my, 0.35), mat("machine", rough=0.4), bevel=0.12)
        box(0.9, 0.06, 0.6, (mx, my - 0.92, 1.4), mat("glass", rough=0.1), bevel=0.02)
    for i, (px, py) in enumerate(((3.5, 9.0), (3.5, 13.5), (3.5, 18.0), (22.5, 15.0), (22.5, 19.5), (11.0, 28.5), (15.5, 28.5))):
        parcel_stack(px, py, n=6 + i % 4, seed=i + 20).location.z = 0.35
    for i, (px, py, rz) in enumerate(((6.4, 10.0, 0.0), (6.4, 17.5, 0.2), (20.6, 16.0, 3.1), (12.0, 23.8, 1.6), (30.0, 6.0, 2.0))):
        person(px, py, rz=rz, vest=("red", "c_amber")[i % 2]).location.z = 0.35
    for j, (ax, phase) in enumerate(((29.75, 0.0), (44.75, 0.5))):
        fl = forklift(f"forklift_{j}")

        def fork_fn(f, ax=ax, phase=phase):
            u = ((f % LOOP) / LOOP + phase) % 1.0
            w = 0.5 - 0.5 * math.cos(u * math.tau)
            heading = math.pi / 2 if u < 0.5 else -math.pi / 2
            return (ax, 11 + w * 24, 0.35), heading
        animate(fl, k, fork_fn)
    # ---- dock building (north-west) with the big wordmark and trucks backed in
    bx0, bx1, by0, bh = -84.0, -6.0, 56.0, 12.0
    bw, bd = bx1 - bx0, 32.0
    bcx = (bx0 + bx1) / 2
    box(bw, bd, bh, (bcx, by0 + bd / 2, 0), wall)
    box(bw + 1.0, bd + 1.0, 0.6, (bcx, by0 + bd / 2, bh), mat("roof", rough=0.85))
    box(bw + 0.4, 1.0, 6.4, (bcx, by0 - 0.3, bh - 6.4), mat("red"))
    for i in range(int(bw // 2.6)):
        box(0.07, 1.04, 6.3, (bx0 + 1.3 + i * 2.6, by0 - 0.32, bh - 6.35), mat("red_deep"), bevel=0.0)
    wall_text("DaakDash", 5.6, bx1 - 16, by0 - 0.85, bh - 3.3, "-Y", mat("white"))
    for i in range(3):
        box(bw * 0.7, 2.0, 0.35, (bcx + 4, by0 + 6 + i * 6, bh + 0.6), mat("panel", rough=0.3), rx=0.35)
    for i in range(3):
        box(3, 2.4, 1.6, (bx0 + 12 + i * 22, by0 + bd - 6, bh + 0.6), mat("steel"))
    box(bw - 4, 3.0, 1.2, (bcx, by0 - 1.5, 0), mat("pad2"), bevel=0.08)
    docks = []
    for i in range(11):
        dx = bx0 + 5 + i * 6.8
        box(4.4, 0.4, 4.8, (dx, by0 - 0.1, 1.0), mat("ink", rough=0.6), bevel=0.05)        # seal
        box(3.6, 0.42, 4.2, (dx, by0 - 0.12, 1.2), mat("roof2", rough=0.5), bevel=0.02)    # shutter
        for s in range(6):
            box(3.5, 0.44, 0.04, (dx, by0 - 0.13, 1.6 + s * 0.6), mat("roof"), bevel=0.0)
        docks.append(dx)
    for i, dx in enumerate(docks):
        if i in (1, 5, 8):
            continue
        t = truck(f"dock_truck_{i}")
        t.location = (dx, by0 - 1.5 - 7.3, 0)
        t.rotation_euler.z = -math.pi / 2
    for dx in docks[::2]:
        box(0.22, 22, 0.02, (dx + 3.4, by0 - 13, 0.05), mat("line"), bevel=0.0)
    for i in range(5):
        person(docks[i * 2] + 2.8, by0 - 4 - (i % 2) * 2, rz=i, vest="c_amber")
    lit_office(80, 20, 18, 26, 4, seed=3)
    box(5.0, 3.0, 5.0, (76, 5.5, 0), mat("red"), name="portal", bevel=0.1)
    box(3.4, 3.2, 3.6, (76, 5.4, 0), mat("glass", rough=0.1), bevel=0.05)
    # ---- parking, lawns with curbs, trees, road
    box(54, 15, 0.06, (30, -10, 0), mat("asphalt", rough=0.85), bevel=0.0)
    for i in range(20):
        box(0.15, 5.2, 0.02, (4 + i * 2.75, -11.6, 0.07), mat("line"), bevel=0.0)
    for i in range(19):
        if rnd.random() < 0.7:
            car(5.4 + i * 2.75, -11.6, math.pi / 2 + rnd.choice((0, math.pi)), color=rnd.choice(("wall", "wall", "c_grey", "wall")))
    for (lx, ly, lw, lh) in ((30, -19.6, 56, 4.2), (-6, -9, 12, 16), (-40, 6, 44, 10), (66, -8, 12, 14)):
        box(lw + 0.6, lh + 0.6, 0.14, (lx, ly, 0), mat("wall", rough=0.6), bevel=0.06)
        box(lw, lh, 0.18, (lx, ly, 0), mat("grass", rough=0.95), bevel=0.06)
        n = max(2, int(lw * lh // 38))
        for t_i in range(n):
            tree(lx + rnd.uniform(-lw / 2 + 1.5, lw / 2 - 1.5), ly + rnd.uniform(-lh / 2 + 1.2, lh / 2 - 1.2),
                 s=rnd.uniform(0.95, 1.25), variant=t_i + int(lx), z=0.18)
    path = road_straight(-150, 150, -26, width=11)  # both ends vanish into tunnel mounds
    box(300, 0.4, 0.2, (0, -26 + 5.7, 0), mat("wall"), bevel=0.05)
    box(300, 0.4, 0.2, (0, -26 - 5.7, 0), mat("wall"), bevel=0.05)
    convoy(k, path, 3, lambda i: truck(f"road_truck_e{i}"), lane=2.6)
    convoy(k, path, 3, lambda i: truck(f"road_truck_w{i}"), lane=-2.6, reverse=True)
    box(170, 9, 0.12, (0, -36.5, 0), mat("grass", rough=0.95), bevel=0.04)
    for i in range(26):
        tree(-80 + i * 6.3 + rnd.uniform(-1, 1), -36.5 + rnd.uniform(-2.5, 2.5), s=rnd.uniform(1.0, 1.3), variant=i, z=0.12)
    return dict(target=Vector((6, 24, 2)), az=-110, el=34, dist=182, lens=60,
                spots=[Vector((41, 20, 7)), Vector((-28, by0, 4))])


SERPENTINE = [(150, -26), (190, -22), (215, 0), (200, 25), (170, 38), (160, 58), (185, 72), (240, 70),
              (280, 80), (290, 105), (265, 122), (225, 128), (215, 150), (240, 168), (285, 172), (322, 200)]


def scene_highway(k):
    """Serpentine truck road climbing through the hills between the depot and the railhead.
    Built in world coordinates; both ends run into tunnel mounds."""
    pts = catmull(SERPENTINE, 26)
    road = Path(pts)
    sample = pts[::2]
    gx0, gx1, gy0, gy1 = 105, 335, -55, 195

    def dist_road(x, y):
        return math.sqrt(min((p.x - x) ** 2 + (p.y - y) ** 2 for p in sample))

    def height(x, y):
        d = dist_road(x, y)
        mask = max(0.0, min(1.0, (d - 12) / 22))
        mask = mask * mask * (3 - 2 * mask)
        edge = min(x - gx0, gx1 - x, y - gy0, gy1 - y)
        ex = max(0.0, min(1.0, edge / 30))
        p = Vector((x * 0.02, y * 0.02, 0.0))
        h = noise.noise(p) * 0.6 + noise.noise(p * 2.3) * 0.3 + noise.noise(p * 4.7) * 0.12
        return max(0.0, h + 0.45) * 26 * mask * ex
    me = bpy.data.meshes.new("terrain")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=84, y_segments=86, size=1.0)
    cxg, cyg, hx, hy = (gx0 + gx1) / 2, (gy0 + gy1) / 2, (gx1 - gx0) / 2, (gy1 - gy0) / 2
    for v in bm.verts:
        x, y = cxg + v.co.x * hx, cyg + v.co.y * hy
        v.co = Vector((x, y, height(x, y)))
    rnd = random.Random(9)
    for f in bm.faces:
        zc = sum(v.co.z for v in f.verts) / len(f.verts)
        if zc < 0.15:
            f.material_index = 3
        elif zc > 15:
            f.material_index = 2
        else:
            f.material_index = 0 if rnd.random() < 0.55 else 1
    bm.to_mesh(me)
    bm.free()
    for key in ("hill", "hill2", "rock", "grass"):
        me.materials.append(mat(key, rough=0.95))
    link(bpy.data.objects.new("terrain", me))
    strip_mesh("hw_curb", pts, 13.0, 0.13, mat("wall"))
    strip_mesh("hw", pts, 10.5, 0.16, mat("asphalt", rough=0.9))
    strip_mesh("hw_dash", pts, 0.26, 0.18, mat("line"), dash=4.0)
    for i in range(420):
        x, y = rnd.uniform(gx0 + 4, gx1 - 4), rnd.uniform(gy0 + 4, gy1 - 4)
        if dist_road(x, y) < 11:
            continue
        z = height(x, y)
        if z > 17:
            continue
        if rnd.random() < 0.55:
            conifer(x, y, s=rnd.uniform(0.8, 1.3), z=z - 0.3, variant=i)
        else:
            tree(x, y, s=rnd.uniform(0.8, 1.2), z=z - 0.3, variant=i)
    convoy(k, road, 6, lambda i: truck(f"hw_truck_up{i}"), lane=2.6, z=0.16)
    convoy(k, road, 5, lambda i: truck(f"hw_truck_dn{i}"), lane=-2.6, z=0.16, reverse=True)
    return dict(target=Vector((236, 84, 4)), az=-128, el=44, dist=300, lens=60,
                spots=[Vector((240, 70, 1)), Vector((265, 122, 1))])


def scene_rail(k):
    cx = 0.0
    track_y = [-18, -9, 0, 9]
    box(350, 46, 0.05, (cx, -4.5, 0), mat("gravel", rough=0.95), name="ballast")
    for ty in track_y:
        for ry in (-0.75, 0.75):
            box(350, 0.16, 0.2, (cx, ty + ry, 0.25), mat("rail", rough=0.4, metal=0.5))
        sl = box(0.35, 2.6, 0.12, (cx - 175, ty, 0.08), mat("sleeper"), name="sleepers")
        arr = sl.modifiers.new("arr", "ARRAY")
        arr.count = 350
        arr.relative_offset_displace = (0, 0, 0)
        arr.use_relative_offset = False
        arr.use_constant_offset = True
        arr.constant_offset_displace = (1.0, 0, 0)
    # endless container train on the front track: shifts 6 wagons per hold, pattern period 6
    pitch = 14.6
    n = 24  # multiple of the colour pattern so the wrap keeps the pattern; wraps inside the tunnels
    span_len = n * pitch
    shift = 6 * pitch
    for i in range(n):
        color = CONTAINER_COLORS[i % 6]
        w = wagon(color)
        off0 = i * pitch

        def wf(f, off0=off0):
            u = (f % LOOP) / LOOP
            off = (off0 + u * shift) % span_len
            return (cx - span_len / 2 + off, track_y[0], 0.3), 0.0
        animate(w, k, wf)
    # parked train with locomotive under the gantry
    lo = locomotive()
    lo.location = (cx + 26, track_y[2], 0.3)
    for i in range(6):
        w = wagon(CONTAINER_COLORS[(i + 2) % 6])
        w.location = (cx + 26 - 17 - i * pitch, track_y[2], 0.3)
    # second static train on the far track
    for i in range(10):
        w = wagon(CONTAINER_COLORS[(i + 4) % 6], label=False)
        w.location = (cx - 60 + i * pitch, track_y[3], 0.3)
    # gantry crane spanning tracks
    gx, gy0, gy1 = cx + 2, -14, 30
    span = gy1 - gy0
    g = empty("gantry", (gx, (gy0 + gy1) / 2, 0))
    for lx in (-7, 7):
        for ly in (-span / 2, span / 2):
            box(1.2, 1.2, 17, (lx, ly, 0), mat("red"), parent=g)
            box(2.4, 2.0, 1.2, (lx, ly, 0), mat("red_deep"), parent=g)
        box(1.6, span + 6, 1.8, (lx, 0, 17), mat("red"), parent=g)
    for ly in (-span / 2, span / 2):
        box(15.6, 1.6, 1.6, (0, ly, 17.6), mat("red"), parent=g)
    trolley = empty("trolley", parent=g)
    box(16, 4, 1.6, (0, 0, 18.8), mat("red_deep"), parent=trolley)
    box(4, 3.6, 2.6, (5, 0, 20.4), mat("white"), parent=trolley)
    hook = empty("hook", parent=trolley)
    box(0.12, 0.12, 10, (-3, 0, 0), mat("ink"), parent=hook)
    box(0.12, 0.12, 10, (3, 0, 0), mat("ink"), parent=hook)
    box(12.4, 2.6, 0.4, (0, 0, -0.4), mat("ink"), parent=hook)
    container(12.2, "red", (0, 0, -3.0), parent=hook)
    hook.location = (0, 0, 9)

    def trolley_fn(f):
        u = (f % LOOP) / LOOP
        w = 0.5 - 0.5 * math.cos(u * math.tau)
        return (0, -span / 2 + 9 + w * (span - 18), 0), None
    animate(trolley, k, trolley_fn)

    def hook_fn(f):
        u = (f % (LOOP // 2)) / (LOOP // 2)
        w = 0.5 - 0.5 * math.cos(u * math.tau)
        return (0, 0, 6.5 + w * 7.5), None
    animate(hook, k, hook_fn)
    # container yard behind the tracks
    rnd = random.Random(21)
    for r in range(4):
        for c in range(7):
            stack = rnd.randint(1, 3)
            for s in range(stack):
                container(12.2, rnd.choice(CONTAINER_COLORS), (cx - 30 + c * 13.2 + 40, 24 + r * 3.2, s * 2.6), rz=0)
    # rail depot shed
    sx = cx - 45
    box(40, 22, 10, (sx, 30, 0), mat("wall"), name="shed")
    box(41, 23, 0.6, (sx, 30, 10), mat("roof"))
    box(40.4, 0.8, 3.6, (sx, 30 - 11.3, 6.4), mat("red"))
    wall_text("DaakDash Rail", 2.2, sx, 30 - 11.75, 8.2, "-Y", mat("white"))
    for i in range(4):
        box(5, 0.3, 5.6, (sx - 14 + i * 9.3, 30 - 11.1, 0), mat("roof2"))
    # service road with a truck shuttling containers
    sp = road_straight(cx - 165, cx + 165, -34, width=9, dash=False)
    convoy(k, sp, 3, lambda i: truck(f"rail_truck_e{i}"), lane=2.2)
    convoy(k, sp, 3, lambda i: truck(f"rail_truck_w{i}"), lane=-2.2, reverse=True)
    for i in range(14):
        tree(cx - 70 + i * 10, -44 + (i % 2) * 2, s=1.0, variant=i)
    for i in range(6):
        person(gx - 9 + i * 1.8, -24 - (i % 2), rz=i, vest="c_amber")
    return dict(target=Vector((cx + 6, 6, 4)), az=-140, el=33, dist=180, lens=60,
                spots=[Vector((gx, (gy0 + gy1) / 2 - 8, 19)), Vector((cx + 26, track_y[2], 5))])


def scene_city(k):
    cx = 0.0
    block = 30.0
    street = 9.0
    pitch = block + street
    box(220, 180, 0.04, (cx, 4, 0), mat("asphalt", rough=0.9), name="streets")
    rnd = random.Random(33)
    walls = ["wall", "wall2", "sand_wall", "sage_wall", "wall3"]
    roofs = ["terracotta", "roof2", "terracotta", "red_deep"]
    depot_block = (0, -1)
    for bi in range(-2, 3):
        for bj in range(-2, 3):
            bx, by = cx + bi * pitch, bj * pitch
            box(block, block, 0.18, (bx, by, 0), mat("pad", rough=0.95))  # pavement
            box(block - 4, block - 4, 0.2, (bx, by, 0.01), mat("grass", rough=0.95))
            if (bi, bj) == depot_block:
                # DaakDash city depot storefront
                box(24, 14, 7, (bx, by - 4, 0.2), mat("wall"))
                box(24.4, 1.0, 2.6, (bx, by - 11.2, 4.4), mat("red"))
                wall_text("DaakDash", 1.7, bx, by - 11.75, 5.7, "-Y", mat("white"))
                box(16, 0.2, 3.2, (bx, by - 11.1, 0.2), mat("glass", rough=0.2))
                box(24.4, 14.4, 0.4, (bx, by - 4, 7.2), mat("wall2"))
                box(6, 4, 1.4, (bx - 5, by - 2, 7.6), mat("steel"))
                box(3, 3, 1.0, (bx + 6, by - 1, 7.6), mat("pad2"))
                for i in range(3):
                    box(14, 1.4, 0.3, (bx + 2, by - 9 + i * 2.6, 7.6), mat("wall3"))
                for i in range(5):
                    s = scooter(f"parked_{i}", rider=False)
                    s.location = (bx - 8 + i * 2.2, by - 14.5, 0.2)
                    s.rotation_euler.z = math.pi / 2
                v = van("depot_van")
                v.location = (bx + 9, by - 14.6, 0.2)
                for i in range(4):
                    tree(bx - 13 + i * 9, by + 10, s=0.9, variant=i)
                continue
            kind = rnd.random()
            if (bi, bj) in ((0, 0), (-1, -1), (1, -1)):
                kind = 0.1  # keep low houses around the depot so it stays the focus
            if kind < 0.5:
                for hx in (-7.5, 7.5):
                    for hy in (-7.5, 7.5):
                        house(bx + hx, by + hy, rz=rnd.choice((0, math.pi / 2, math.pi, -math.pi / 2)),
                              wall=rnd.choice(walls), roof=rnd.choice(roofs), parent=None, s=0.85)
                for i in range(3):
                    tree(bx + rnd.uniform(-12, 12), by + rnd.choice((-1, 1)) * 13, s=0.8, variant=i + bj)
            elif kind < 0.8:
                office_block(bx + rnd.uniform(-3, 3), by + rnd.uniform(-3, 3), rnd.uniform(16, 22), rnd.uniform(14, 20),
                             rnd.randint(3, 6), wall=rnd.choice(walls))
            else:
                for i in range(6):
                    tree(bx + rnd.uniform(-12, 12), by + rnd.uniform(-12, 12), s=rnd.uniform(0.9, 1.3), variant=i + bi * 3)
                box(10, 0.6, 0.5, (bx, by, 0.2), mat("sleeper"))
    # street centre lines
    for bi in range(-2, 4):
        x = cx + bi * pitch - pitch / 2
        for i in range(24):
            box(0.2, 2.4, 0.02, (x, -110 + i * 9, 0.05), mat("line"))
            box(2.4, 0.2, 0.02, (cx - 110 + i * 9, x - cx, 0.05), mat("line"))
    # scooters looping around blocks (closed rounded routes on the streets)
    routes = [
        rounded_rect(cx, -pitch / 2 + 0.0, 2 * pitch, pitch * 1.0, 6),
        rounded_rect(cx + pitch / 2, 0, pitch, 2 * pitch, 6),
        rounded_rect(cx - pitch / 2, pitch / 2, pitch, pitch, 5),
        rounded_rect(cx, pitch / 2, 2 * pitch, 2 * pitch, 7),
    ]
    def rider(name):
        s = scooter(name)
        s.scale = (1.5, 1.5, 1.5)
        return s
    for ri, rp in enumerate(routes):
        convoy(k, Path(rp), 4, lambda i, ri=ri: rider(f"scooter_{ri}_{i}"), lane=2.2, z=0.04)
    vr = Path(rounded_rect(cx, 0, 4 * pitch, 2 * pitch, 8))
    convoy(k, vr, 5, lambda i: van(f"city_van_{i}"), lane=2.4, z=0.04)
    # doorstep handover: partner with parcel at a house door, receiver opposite
    hx, hy = cx - pitch + 7.5, -pitch - 7.5 - 3.5 * 0.85 - 1.2
    person(hx + 1.0, hy, rz=math.pi / 2, vest="red")
    box(0.5, 0.4, 0.35, (hx + 1.0, hy + 0.35, 1.05), mat("cardboard"))
    person(hx + 1.0, hy + 1.1, rz=-math.pi / 2, vest="c_navy")
    s = scooter("doorstep_scooter", rider=False)
    s.location = (hx - 1.5, hy - 2.6, 0.04)
    # street trees
    for bi in range(-2, 3):
        for side in (-1, 1):
            for i in range(3):
                tree(cx + bi * pitch - 10 + i * 10, side * (pitch / 2 - street / 2 - 1.6), s=0.85, variant=bi + i + side)
    return dict(target=Vector((cx + 2, -26, 1)), az=-118, el=36, dist=150, lens=60,
                spots=[Vector((cx, -pitch - 4, 7.5)), Vector((cx + pitch, -pitch / 2, 1))])


def scene_tower(k):
    cx = 0.0
    box(200, 150, 0.04, (cx, 10, 0), mat("pad", rough=0.95), name="plaza_ground")
    tx, ty = cx + 6, 14
    # HQ tower
    fl = 16
    fh = 3.6
    h = fl * fh
    t = empty("tower", (tx, ty, 0))
    box(20, 20, h, (0, 0, 0), mat("glass", rough=0.25), parent=t)
    rnd_l = random.Random(77)
    for f in range(fl):
        lit = rnd_l.random() < 0.7
        box(20.15, 20.15, 2.2, (0, 0, 0.9 + f * fh), mat("amber", emit=1.2) if lit else mat("glass", rough=0.2), parent=t)
        box(20.3, 20.3, 0.45, (0, 0, f * fh), mat("ink"), parent=t)
    for i in range(9):  # vertical mullions on the two faces the camera sees
        v = -10 + 1.25 + i * 2.25
        box(0.28, 0.3, h, (v, -10.15, 0), mat("ink"), parent=t)
        box(0.3, 0.28, h, (-10.15, v, 0), mat("ink"), parent=t)
    box(6, 6, h + 7, (7.5, -7.5, 0), mat("red"), parent=t)          # red corner slab
    box(20.6, 20.6, 5.2, (0, 0, h), mat("red"), parent=t)          # crown
    wall_text("DaakDash", 2.9, -2.2, -10.45, h + 2.6, "-Y", mat("white"), t)
    wall_text("DaakDash", 2.9, -10.45, 2.2, h + 2.6, "-X", mat("white"), t)
    box(12, 12, 2.4, (-2, 2, h + 5.2), mat("roof"), parent=t)
    cyl(0.35, 16, (-4, 4, h + 7.6), mat("steel"), segs=6, parent=t)
    cyl(1.0, 1.0, (-4, 4, h + 23.6), mat("red", emit=3.0), segs=8, parent=t)
    for (dx, dy) in ((2, -1), (-6, -2)):
        ico(1.6, (dx, dy, h + 8.2), mat("white", rough=0.4), squash=0.6, parent=t)
    # podium
    box(42, 34, 6, (tx - 6, ty + 4, 0), mat("wall"))
    for f in range(1):
        windows_band(42, 34, 1.6, 2.4, (tx - 6, ty + 4, 0), mat("glass", rough=0.2))
    box(42.4, 34.4, 0.4, (tx - 6, ty + 4, 6), mat("wall2"))
    # network plaza: 12 depots ringed around the hub
    px, py, pr = cx - 30, -18, 15
    cyl(pr + 2, 0.12, (px, py, 0), mat("wall", rough=0.9), segs=48)
    cyl(1.8, 0.8, (px, py, 0), mat("red"), segs=16)
    for i in range(12):
        a = i / 12 * math.tau
        x, y = px + pr * math.cos(a), py + pr * math.sin(a)
        cyl(0.7, 0.5, (x, y, 0.1), mat("amber", emit=2.5), segs=10)
        seg = box(pr - 2.2, 0.22, 0.06, (px + (pr / 2) * math.cos(a), py + (pr / 2) * math.sin(a), 0.12), mat("red"))
        seg.rotation_euler.z = a
    # neighbouring blocks
    rnd = random.Random(55)
    spots = [(-60, 30), (-40, 42), (38, 42), (50, -10), (52, 26), (-62, -4), (30, -36), (6, -40),            # inside ring
             (10, 74), (-20, 88), (36, 94), (86, 72), (96, 30), (100, -20), (-104, 20), (-98, 72), (64, -72),
             (-52, -74), (-30, -82), (20, -78)]
    for i, (dx, dy) in enumerate(spots):
        if rnd.random() < 0.55:
            lit_office(cx + dx, dy, rnd.uniform(14, 20), rnd.uniform(12, 18), rnd.randint(2, 6), seed=i)
        else:
            office_block(cx + dx, dy, rnd.uniform(14, 20), rnd.uniform(12, 18), rnd.randint(2, 6), wall="wall")
    # ring road with cars
    rr = Path(rounded_rect(cx - 6, 4, 150, 110, 18))
    strip_mesh("ring", rr.pts, 9, 0.05, mat("asphalt", rough=0.9))
    convoy(k, rr, 6, lambda i: car(0, 0, 0, color="wall"), lane=2.2, z=0.05)
    convoy(k, rr, 2, lambda i: van(f"hq_van_{i}"), lane=-2.2, z=0.05, reverse=True)
    # park
    for i in range(40):
        x = px + rnd.uniform(-28, 28)
        y = py + rnd.uniform(-26, 22)
        if (Vector((x - px, y - py, 0))).length < pr + 4:
            continue
        tree(x, y, s=rnd.uniform(0.8, 1.3), variant=i)
    for i in range(10):
        a = rnd.uniform(0, math.tau)
        person(px + (pr + 3) * math.cos(a), py + (pr + 3) * math.sin(a), rz=a, vest=rnd.choice(["red", "c_navy", "c_amber"]))
    return dict(target=Vector((cx - 4, 10, 32)), az=-116, el=17, dist=280, lens=60,
                spots=[Vector((tx, ty, h + 3)), Vector((tx - 6, ty - 13, 6))])


# ----------------------------------------------------------------------------- camera

def cam_pose(p):
    az, el = math.radians(p["az"]), math.radians(p["el"])
    d = p["dist"]
    off = Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el))) * d
    return p["target"] + off, p["target"]


# Per-flight character, after the reference film: (pull-back, extra pitch at mid-flight).
# 0 depot->hills: rise and reveal the serpentine; 1 hills->rail: glide; 2 rail->city: dive
# steeply over the yard; 3 city->HQ: pull up, then push in low towards the tower.
FLIGHTS = [(0.45, 12.0), (0.22, 5.0), (0.12, 16.0), (0.5, 4.0)]


def setup_camera(poses):
    cd = bpy.data.cameras.new("cam")
    cd.lens = poses[0]["lens"]
    cd.clip_end = 4000
    cd.sensor_width = 36
    cam = bpy.data.objects.new("cam", cd)
    bpy.context.scene.collection.objects.link(cam)
    tgt = bpy.data.objects.new("cam_target", None)
    bpy.context.scene.collection.objects.link(tgt)
    c = cam.constraints.new("TRACK_TO")
    c.target = tgt
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"
    bpy.context.scene.camera = cam
    # miniature look: shallow focus locked on the scene target
    cd.dof.use_dof = True
    cd.dof.focus_object = tgt
    cd.dof.aperture_fstop = args.fstop

    def ease(t):
        return t * t * t * (t * (6 * t - 15) + 10)

    def key(f, p, fstop=args.fstop):
        pos, tg = cam_pose(p)
        cam.location = pos
        tgt.location = tg
        cd.lens = p["lens"]
        cd.dof.aperture_fstop = fstop
        cam.keyframe_insert("location", frame=f)
        tgt.keyframe_insert("location", frame=f)
        cd.keyframe_insert("lens", frame=f)
        cd.keyframe_insert("dof.aperture_fstop", frame=f)

    for k, p in enumerate(poses):
        s, e = hold(k)
        key(s, p)
        key(e - 1, p)
        if k + 1 == len(poses):
            continue
        q = poses[k + 1]
        lift, bump = FLIGHTS[k]
        daz = (q["az"] - p["az"] + 180) % 360 - 180
        for i in range(1, TRANS + 1):
            t = ease(i / (TRANS + 1))
            arc = math.sin(math.pi * t)
            mix = {name: p[name] + (q[name] - p[name]) * t for name in ("el", "dist", "lens")}
            mix["az"] = p["az"] + daz * t
            mix["dist"] *= 1 + lift * arc
            mix["el"] = min(72.0, mix["el"] + bump * arc)
            mix["target"] = p["target"].lerp(q["target"], t)
            # deepen focus mid-flight: the camera climbs, and a miniature-shallow focus would smear everything
            key(e - 1 + i, mix, fstop=args.fstop + (5.6 - args.fstop) * arc)
    for ob in (cam, tgt, cd):
        ad = ob.animation_data
        if ad and ad.action:
            for fc in _fcurves(ad.action):
                for kp in fc.keyframe_points:
                    kp.interpolation = "LINEAR"
    return cam


def _fcurves(action):
    try:
        return list(action.fcurves)
    except Exception:
        out = []
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    out.extend(bag.fcurves)
        return out


# ----------------------------------------------------------------------------- render setup

def safe(obj, attr, value):
    try:
        setattr(obj, attr, value)
    except Exception:
        pass


def setup_cycles(sc):
    """Path tracing on the RTX via OptiX: soft bounce light and contact shadows are what make the
    reference film read as real rather than as a viewport preview."""
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == "OPTIX"
    sc.render.engine = "CYCLES"
    cy = sc.cycles
    cy.device = "GPU"
    cy.samples = args.samples
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.03
    cy.use_denoising = True
    safe(cy, "denoiser", "OPTIX")
    cy.max_bounces = 6
    cy.diffuse_bounces = 3
    cy.glossy_bounces = 2
    cy.transmission_bounces = 2
    cy.transparent_max_bounces = 4
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    safe(cy, "use_light_tree", True)
    sc.render.use_persistent_data = True


def setup_render(transparent=False):
    sc = bpy.context.scene
    if args.engine == "cycles":
        setup_cycles(sc)
    else:
        for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
            try:
                sc.render.engine = eng
                break
            except TypeError:
                continue
    sc.render.fps = FPS
    sc.render.resolution_x = 1920
    sc.render.resolution_y = 1080
    sc.render.resolution_percentage = args.scale
    sc.render.film_transparent = transparent
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
    sc.render.image_settings.compression = 30
    ee = sc.eevee
    safe(ee, "taa_render_samples", args.samples)
    safe(ee, "use_shadows", True)
    safe(ee, "shadow_ray_count", 2)
    safe(ee, "shadow_step_count", 8)
    safe(ee, "use_raytracing", True)
    safe(ee, "use_fast_gi", True)
    safe(ee, "fast_gi_distance", 6.0)
    safe(ee, "use_gtao", True)
    safe(ee, "gtao_distance", 3.0)
    sc.render.use_motion_blur = not transparent
    safe(sc.render, "motion_blur_shutter", 0.35)
    safe(sc.view_settings, "view_transform", args.view)
    safe(sc.view_settings, "look", args.look)
    sc.view_settings.exposure = args.exposure
    # world: bright, slightly cool sky fill; crisp warm sun
    w = bpy.data.worlds.new("sky")
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = lin("#E6EDF5")
    bg.inputs["Strength"].default_value = 1.0
    sd = bpy.data.lights.new("sun", "SUN")
    sd.energy = 5.2
    sd.color = lin("#FFE6C7")[:3]
    sd.angle = math.radians(2.0)
    safe(sd, "use_shadow", True)
    sun = bpy.data.objects.new("sun", sd)
    sun.rotation_euler = (math.radians(44), math.radians(8), math.radians(-28))
    sc.collection.objects.link(sun)


# ----------------------------------------------------------------------------- tiles

def render_tiles(out):
    os.makedirs(out, exist_ok=True)
    sc = bpy.context.scene
    setup_render(transparent=True)
    sc.render.resolution_x = 1200
    sc.render.resolution_y = 900
    cd = bpy.data.cameras.new("tilecam")
    cd.type = "ORTHO"
    cam = bpy.data.objects.new("tilecam", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    builders = {
        "depot": (lambda: _tile_depot(), 34, (0, 0, 4)),
        "truck": (lambda: truck("t"), 17, (0, 0, 2)),
        "rail": (lambda: _tile_train(), 30, (0, 0, 2)),
        "delivery": (lambda: _tile_delivery(), 9, (0, 0, 1)),
        "tracking": (lambda: _tile_tower(), 40, (0, 0, 14)),
        "parcels": (lambda: _tile_parcels(), 6.5, (0, 0, 0.8)),
    }
    for name, (build, scale, focus) in builders.items():
        coll = set_collection(f"tile_{name}")
        build()
        for lc in sc.view_layers[0].layer_collection.children:
            lc.exclude = lc.name != coll.name
        az, el = math.radians(-120), math.radians(30)
        fwd = -Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
        right = fwd.cross(Vector((0, 0, 1))).normalized()
        up = right.cross(fwd).normalized()
        bpy.context.view_layer.update()
        corners = [ob.matrix_world @ Vector(c) for ob in coll.all_objects if ob.type in ("MESH", "FONT") for c in ob.bound_box]
        xs = [c.dot(right) for c in corners]
        ys = [c.dot(up) for c in corners]
        mid_r, mid_u = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        depth = sum(c.dot(fwd) for c in corners) / len(corners)
        aspect = sc.render.resolution_x / sc.render.resolution_y
        cd.ortho_scale = max(max(xs) - min(xs), (max(ys) - min(ys)) * aspect) * 1.14
        f = right * mid_r + up * mid_u + fwd * depth
        cam.location = f - fwd * 200
        cd.clip_end = 1000
        cam.rotation_euler = fwd.to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = os.path.join(out, f"tile-{name}.png")
        bpy.ops.render.render(write_still=True)


def _tile_depot():
    box(30, 16, 7, (0, 2, 0), mat("wall"))
    box(31, 17, 0.5, (0, 2, 7), mat("roof"))
    box(30.4, 0.8, 2.8, (0, 2 - 8.3, 4.2), mat("red"))
    wall_text("DaakDash", 2.0, 0, 2 - 8.75, 5.6, "-Y", mat("white"))
    for i in range(4):
        box(3.2, 0.3, 3.6, (-10 + i * 6.6, 2 - 8.1, 0), mat("roof2"))
    t = truck("tt")
    t.location = (-6.7, -13.6, 0)
    t.rotation_euler.z = -math.pi / 2
    for i in range(2):
        parcel_stack(4 + i * 2.2, -8.2, n=5, seed=i)


def _tile_train():
    lo = locomotive()
    lo.location = (8, 0, 0)
    w = wagon("red")
    w.location = (-9.2, 0, 0)


def _tile_delivery():
    scooter("s")
    p = person(-2.6, -1.6, rz=0.4)
    box(0.5, 0.4, 0.35, (-2.6, -1.25, 1.05), mat("cardboard"))
    return p


def _tile_tower():
    t = empty("tower")
    fl, fh = 10, 3.4
    h = fl * fh
    box(14, 14, h, (0, 0, 0), mat("glass", rough=0.25), parent=t)
    for f in range(fl):
        box(14.2, 14.2, 1.4, (0, 0, 1.2 + f * fh), mat("amber", emit=1.6) if f % 3 else mat("glass"), parent=t)
    box(4, 14.6, h + 4, (5.9, 0, 0), mat("red"), parent=t)
    wall_text("DaakDash", 1.8, 0, -7.4, h - 2.0, "-Y", mat("white"), t)
    cyl(0.25, 10, (-2, 2, h), mat("steel"), segs=6, parent=t)
    cyl(0.8, 0.8, (-2, 2, h + 10), mat("red", emit=3.0), segs=8, parent=t)


def _tile_parcels():
    layout = [((-1.1, 0, 0), 1.0), ((0.0, 0.1, 0), 1.0), ((1.1, -0.05, 0), 1.0),
              ((-0.55, 0.05, 0.7), 0.95), ((0.55, 0.0, 0.7), 0.95), ((0.0, 0.05, 1.37), 0.85)]
    for i, ((x, y, z), s) in enumerate(layout):
        box(s, s * 0.8, 0.7 if s == 1.0 else s * 0.7, (x, y, z), mat("cardboard"), rz=(i % 3 - 1) * 0.06)
    box(0.86, 0.04, 0.14, (0.0, -0.31, 1.62), mat("red"))
    box(0.9, 0.04, 0.14, (0.0, -0.32, 0.28), mat("red"))


# ----------------------------------------------------------------------------- main

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def main():
    clear()
    if args.mode == "tiles":
        render_tiles(args.out)
        return
    global ROOT
    set_collection("world")
    build_ground()
    builders = [scene_depot, scene_highway, scene_rail, scene_city, scene_tower]
    poses = []
    for k, build in enumerate(builders):
        if build is scene_highway:
            poses.append(build(k))
            continue
        ox, oy = SCENE_POS[k]
        ROOT = empty(f"scene_{SCENES[k]}", (ox, oy, 0))
        pose = build(k)
        ROOT = None
        offset = Vector((ox, oy, 0))
        pose["target"] = pose["target"] + offset
        pose["spots"] = [v + offset for v in pose.get("spots", [])]
        poses.append(pose)
    # roads joining the scenes; every vehicle path ends inside one of the tunnel mounds
    links = []
    for i, ctrl in enumerate([
        [(655, 178), (664, 168), (672.5, 157.5)],
        [(867.5, 150), (870, 176), (872, 202)],
    ]):
        pts = catmull(ctrl, 12)
        strip_mesh(f"link_{i}", pts, 9, 0.05, mat("asphalt", rough=0.9))
        links.append(pts)
    links.append(catmull(SERPENTINE, 8))
    for x, y, r in [(-150, -26, 24), (150, -26, 26), (322, 200, 38), (658, 200, 38)]:
        mound(x, y, r)
    build_business_park()
    build_filler(links)
    bake_animation()
    setup_camera(poses)
    setup_render()
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 0, TOTAL - 1
    os.makedirs(args.out, exist_ok=True)
    print(f"[daakdash] objects={len(bpy.data.objects)} frames={TOTAL}")
    if args.mode == "hotspots":
        import json
        from bpy_extras.object_utils import world_to_camera_view
        out = []
        for k, p in enumerate(poses):
            sc.frame_set(hold(k)[0] + 10)
            pts = []
            for v in p.get("spots", []):
                c = world_to_camera_view(sc, sc.camera, v)
                pts.append([round(c.x, 4), round(1 - c.y, 4)])
            out.append(pts)
        with open(os.path.join(args.out, "hotspots.json"), "w") as fh:
            json.dump(out, fh)
        print("[daakdash] hotspots", out)
        return
    if args.mode == "save":
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(args.out, "daakdash_world.blend"))
    elif args.mode == "stills":
        frames = [int(x) for x in args.frames.split(",")] if args.frames else [hold(k)[0] + 40 for k in range(len(SCENES))]
        if args.only >= 0:
            frames = [hold(args.only)[0] + 40]
        for f in frames:
            sc.frame_set(f)
            sc.render.filepath = os.path.join(args.out, f"still-{f:04d}.png")
            bpy.ops.render.render(write_still=True)
    else:
        if args.frames:
            a, b = args.frames.split("-")
            sc.frame_start, sc.frame_end = int(a), int(b)
        sc.render.filepath = os.path.join(args.out, "frames", "")
        sc.render.use_overwrite = False
        sc.render.use_placeholder = True
        bpy.ops.render.render(animation=True)


main()
