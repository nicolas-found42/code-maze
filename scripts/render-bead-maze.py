"""Photoreal bead-maze render in Blender Cycles.

Run:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/render-bead-maze.py

The scene is a classic 3-wire, 18-bead wooden toy: a beveled hardwood base,
a red conical spiral, a blue twin-arch wire and a low green S-wire, with
painted wooden beads that have real through-bores.
"""

import math
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENDOR = os.path.join(ROOT, "docs", "vendor")
OUT = os.path.join(ROOT, "docs", "bead-maze-render.png")

BASE_TOP = 0.022
WIRE_R = 0.0042
PALETTE = [
    (0.78, 0.13, 0.10, 1),
    (0.93, 0.55, 0.04, 1),
    (0.13, 0.48, 0.16, 1),
    (0.07, 0.24, 0.72, 1),
    (0.38, 0.16, 0.66, 1),
    (0.62, 0.40, 0.22, 1),
]


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb(c):
    return tuple((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c[:3]) + (1,)


def material(name, color, roughness=0.35, coat=0.0, metal=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = srgb(color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metal
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = 0.12
    return mat


def wood_material():
    mat = bpy.data.materials.new("Hardwood")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.50
    bsdf.inputs["Coat Weight"].default_value = 0.16

    diff = nt.nodes.new("ShaderNodeTexImage")
    diff.image = bpy.data.images.load(os.path.join(VENDOR, "ash_veneer_diff_1k.jpg"))
    diff.projection = "BOX"
    diff.projection_blend = 0.2
    diff.location = (-700, 300)

    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (2.2, 2.2, 2.2)
    mapping.location = (-900, 300)
    uv = nt.nodes.new("ShaderNodeTexCoord")
    uv.location = (-1100, 300)
    nt.links.new(uv.outputs["Object"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], diff.inputs["Vector"])
    hs = nt.nodes.new("ShaderNodeHueSaturation")
    hs.inputs["Value"].default_value = 0.96
    hs.inputs["Saturation"].default_value = 1.0
    nt.links.new(diff.outputs["Color"], hs.inputs["Color"])
    warm = nt.nodes.new("ShaderNodeMixRGB")
    warm.blend_type = "MULTIPLY"
    warm.inputs[0].default_value = 0.18
    warm.inputs[2].default_value = (0.98, 0.88, 0.72, 1)
    nt.links.new(hs.outputs["Color"], warm.inputs[1])
    scratch = nt.nodes.new("ShaderNodeTexImage")
    scratch.image = bpy.data.images.load(os.path.join(VENDOR, "scratches_color.jpg"))
    scratch.projection = "BOX"
    scratch.projection_blend = 0.25
    smap = nt.nodes.new("ShaderNodeMapping")
    smap.inputs["Scale"].default_value = (3.4, 3.4, 3.4)
    sco = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(sco.outputs["Object"], smap.inputs["Vector"])
    nt.links.new(smap.outputs["Vector"], scratch.inputs["Vector"])
    scrmix = nt.nodes.new("ShaderNodeMixRGB")
    scrmix.blend_type = "MULTIPLY"
    scrmix.inputs[0].default_value = 0.0
    nt.links.new(warm.outputs["Color"], scrmix.inputs[1])
    nt.links.new(scratch.outputs["Color"], scrmix.inputs[2])
    nt.links.new(scrmix.outputs["Color"], bsdf.inputs["Base Color"])

    nor = nt.nodes.new("ShaderNodeTexImage")
    nor.image = bpy.data.images.load(os.path.join(VENDOR, "ash_veneer_nor_gl_1k.jpg"))
    nor.image.colorspace_settings.name = "Non-Color"
    nor.projection = "BOX"
    nor.projection_blend = 0.2
    nor.location = (-700, -100)
    nt.links.new(mapping.outputs["Vector"], nor.inputs["Vector"])
    nmap = nt.nodes.new("ShaderNodeNormalMap")
    nmap.inputs["Strength"].default_value = 0.60
    nmap.location = (-450, -100)
    nt.links.new(nor.outputs["Color"], nmap.inputs["Color"])
    snor = nt.nodes.new("ShaderNodeTexImage")
    snor.image = bpy.data.images.load(os.path.join(VENDOR, "scratches_normal.jpg"))
    snor.image.colorspace_settings.name = "Non-Color"
    snor.projection = "BOX"
    snor.projection_blend = 0.25
    nt.links.new(smap.outputs["Vector"], snor.inputs["Vector"])
    snmap = nt.nodes.new("ShaderNodeNormalMap")
    snmap.inputs["Strength"].default_value = 0.12
    nt.links.new(snor.outputs["Color"], snmap.inputs["Color"])
    nadd = nt.nodes.new("ShaderNodeVectorMath")
    nadd.operation = "ADD"
    nt.links.new(nmap.outputs["Normal"], nadd.inputs[0])
    nt.links.new(snmap.outputs["Normal"], nadd.inputs[1])
    nnorm = nt.nodes.new("ShaderNodeVectorMath")
    nnorm.operation = "NORMALIZE"
    nt.links.new(nadd.outputs["Vector"], nnorm.inputs[0])
    nt.links.new(nnorm.outputs["Vector"], bsdf.inputs["Normal"])

    rough = nt.nodes.new("ShaderNodeTexImage")
    rough.image = bpy.data.images.load(os.path.join(VENDOR, "ash_veneer_rough_1k.jpg"))
    rough.image.colorspace_settings.name = "Non-Color"
    rough.projection = "BOX"
    rough.projection_blend = 0.2
    rough.location = (-700, -500)
    nt.links.new(mapping.outputs["Vector"], rough.inputs["Vector"])
    sheen = nt.nodes.new("ShaderNodeTexNoise")
    sheen.inputs["Scale"].default_value = 7
    sheen.inputs["Detail"].default_value = 5
    sheen.inputs["Roughness"].default_value = 0.6
    sramp = nt.nodes.new("ShaderNodeValToRGB")
    sramp.color_ramp.elements[0].position = 0.35
    sramp.color_ramp.elements[0].color = (0.42, 0.42, 0.42, 1)
    sramp.color_ramp.elements[1].position = 0.70
    sramp.color_ramp.elements[1].color = (0.72, 0.72, 0.72, 1)
    rmix = nt.nodes.new("ShaderNodeMixRGB")
    rmix.blend_type = "MULTIPLY"
    rmix.inputs[0].default_value = 0.55
    nt.links.new(rough.outputs["Color"], rmix.inputs[1])
    nt.links.new(sramp.outputs["Color"], rmix.inputs[2])
    nt.links.new(sheen.outputs["Fac"], sramp.inputs["Fac"])
    fp = nt.nodes.new("ShaderNodeTexImage")
    fp.image = bpy.data.images.load(os.path.join(VENDOR, "fingerprints_rough.jpg"))
    fp.image.colorspace_settings.name = "Non-Color"
    fp.projection = "BOX"
    fp.projection_blend = 0.3
    fmap = nt.nodes.new("ShaderNodeMapping")
    fmap.inputs["Scale"].default_value = (1.6, 1.6, 1.6)
    nt.links.new(sco.outputs["Object"], fmap.inputs["Vector"])
    nt.links.new(fmap.outputs["Vector"], fp.inputs["Vector"])
    fmix = nt.nodes.new("ShaderNodeMixRGB")
    fmix.blend_type = "MULTIPLY"
    fmix.inputs[0].default_value = 0.0
    nt.links.new(rmix.outputs["Color"], fmix.inputs[1])
    nt.links.new(fp.outputs["Color"], fmix.inputs[2])
    nt.links.new(fmix.outputs["Color"], bsdf.inputs["Roughness"])
    return mat


def plywood_edge_material():
    mat = bpy.data.materials.new("PlywoodEdge")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.52
    bsdf.inputs["Coat Weight"].default_value = 0.03

    co = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(co.outputs["Object"], sep.inputs["Vector"])
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "Z"
    wave.inputs["Scale"].default_value = 300
    wave.inputs["Distortion"].default_value = 1.2
    wave.inputs["Detail"].default_value = 2
    nt.links.new(sep.outputs["Z"], wave.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.15
    ramp.color_ramp.elements[0].color = (0.40, 0.26, 0.14, 1)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (0.88, 0.72, 0.52, 1)
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])

    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 180
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.12
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def painted_wood(name, color):
    mat = material(name, color, roughness=0.42, coat=0.10)
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 260
    noise.inputs["Detail"].default_value = 4
    noise.inputs["Roughness"].default_value = 0.65
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.12
    bump.inputs["Distance"].default_value = 0.0010
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    grain = nt.nodes.new("ShaderNodeTexImage")
    grain.image = bpy.data.images.load(
        os.path.join(VENDOR, "ash_veneer_diff_1k.jpg")
    )
    grain.projection = "BOX"
    grain.projection_blend = 0.3
    gmap = nt.nodes.new("ShaderNodeMapping")
    gmap.inputs["Scale"].default_value = (26, 26, 26)
    gco = nt.nodes.new("ShaderNodeTexCoord")
    gmix = nt.nodes.new("ShaderNodeMixRGB")
    gmix.blend_type = "MULTIPLY"
    gmix.inputs[0].default_value = 0.14
    gmix.inputs[1].default_value = srgb(color)
    nt.links.new(gco.outputs["Object"], gmap.inputs["Vector"])
    nt.links.new(gmap.outputs["Vector"], grain.inputs["Vector"])
    nt.links.new(grain.outputs["Color"], gmix.inputs[2])

    seamco = nt.nodes.new("ShaderNodeTexCoord")
    seamsplit = nt.nodes.new("ShaderNodeSeparateXYZ")
    seamabs = nt.nodes.new("ShaderNodeMath")
    seamabs.operation = "ABSOLUTE"
    seamless = nt.nodes.new("ShaderNodeMath")
    seamless.operation = "LESS_THAN"
    seamless.inputs[1].default_value = 0.0007
    seammix = nt.nodes.new("ShaderNodeMixRGB")
    seammix.blend_type = "MULTIPLY"
    seammix.inputs[2].default_value = (0.55, 0.45, 0.32, 1)
    seammulfac = nt.nodes.new("ShaderNodeMath")
    seammulfac.operation = "MULTIPLY"
    seammulfac.inputs[1].default_value = 0.35
    nt.links.new(seamco.outputs["Object"], seamsplit.inputs["Vector"])
    nt.links.new(seamsplit.outputs["Z"], seamabs.inputs[0])
    nt.links.new(seamabs.outputs[0], seamless.inputs[0])
    nt.links.new(seamless.outputs[0], seammulfac.inputs[0])
    nt.links.new(seammulfac.outputs[0], seammix.inputs[0])
    nt.links.new(gmix.outputs["Color"], seammix.inputs[1])
    bsat = nt.nodes.new("ShaderNodeHueSaturation")
    bsat.inputs["Saturation"].default_value = 1.30
    bsat.inputs["Value"].default_value = 0.92
    nt.links.new(seammix.outputs["Color"], bsat.inputs["Color"])
    nt.links.new(bsat.outputs["Color"], bsdf.inputs["Base Color"])

    rnoise = nt.nodes.new("ShaderNodeTexNoise")
    rnoise.inputs["Scale"].default_value = 90
    rnoise.inputs["Detail"].default_value = 3
    ramp2 = nt.nodes.new("ShaderNodeValToRGB")
    ramp2.color_ramp.elements[0].position = 0.30
    ramp2.color_ramp.elements[0].color = (0.30, 0.30, 0.30, 1)
    ramp2.color_ramp.elements[1].position = 0.70
    ramp2.color_ramp.elements[1].color = (0.52, 0.52, 0.52, 1)
    nt.links.new(rnoise.outputs["Fac"], ramp2.inputs["Fac"])
    nt.links.new(ramp2.outputs["Color"], bsdf.inputs["Roughness"])
    return mat


def wire_material(name, color):
    mat = material(name, color, 0.30, 0.35)
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 900
    noise.inputs["Detail"].default_value = 4
    noise.inputs["Roughness"].default_value = 0.7
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.045
    bump.inputs["Distance"].default_value = 0.0002
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    rnoise = nt.nodes.new("ShaderNodeTexNoise")
    rnoise.inputs["Scale"].default_value = 300
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.24, 0.24, 0.24, 1)
    ramp.color_ramp.elements[1].color = (0.40, 0.40, 0.40, 1)
    nt.links.new(rnoise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Roughness"])
    return mat


def smooth(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = True


def anchor_offset(point, distance=0.014):
    v = Vector((point.x, point.y, 0))
    if v.length > 1e-6:
        v.normalize()
    return v * distance


def star_slab(outer=0.145, inner=0.112, thickness=BASE_TOP):
    import bmesh

    mesh = bpy.data.meshes.new("StarBase")
    bm = bmesh.new()
    n = 6
    bottom, top = [], []
    for i in range(2 * n):
        ang = i * math.pi / n
        r = outer if i % 2 == 0 else inner
        bottom.append(bm.verts.new((math.cos(ang) * r, math.sin(ang) * r, 0)))
        top.append(bm.verts.new((math.cos(ang) * r, math.sin(ang) * r, thickness)))
    bm.faces.new(bottom[::-1])
    bm.faces.new(top)
    for i in range(2 * n):
        bm.faces.new([bottom[i], bottom[(i + 1) % (2 * n)], top[(i + 1) % (2 * n)], top[i]])
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("StarBase", mesh)
    bpy.context.collection.objects.link(obj)
    return obj


PAD_COLORS = [
    (0.86, 0.20, 0.14, 1),
    (0.16, 0.30, 0.75, 1),
    (0.95, 0.60, 0.05, 1),
    (0.20, 0.55, 0.22, 1),
    (0.45, 0.22, 0.67, 1),
    (0.92, 0.45, 0.10, 1),
]


def pad_points(radius=0.145):
    return [
        Vector((math.cos(i * math.pi / 3) * radius, math.sin(i * math.pi / 3) * radius, 0))
        for i in range(6)
    ]


def base():
    obj = star_slab()
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bev = obj.modifiers.new("Bevel", "BEVEL")
    bev.width = 0.0045
    bev.segments = 5
    bpy.ops.object.modifier_apply(modifier=bev.name)
    obj.data.materials.append(wood_material())
    obj.data.materials.append(plywood_edge_material())
    for poly in obj.data.polygons:
        if abs(poly.normal.z) < 0.65:
            poly.material_index = 1

    for idx, point in enumerate(pad_points()):
        x, y = point.x, point.y
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.027, depth=0.0028, vertices=48, location=(x, y, BASE_TOP + 0.0014)
        )
        pad = bpy.context.object
        pad.name = "AnchorPad"
        smooth(pad)
        pad.data.materials.append(material(f"Pad{idx}", PAD_COLORS[idx], 0.42, 0.15))
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.0050, depth=0.004, vertices=32, location=(x, y, BASE_TOP + 0.0048)
        )
        g = bpy.context.object
        g.name = "Grommet"
        smooth(g)
        g.data.materials.append(material("Grommet", (0.02, 0.02, 0.02), 0.35, 0.2))


def smooth_lead(point, reverse=False):
    base = Vector((point.x, point.y, BASE_TOP - 0.010))
    pts = [base, Vector((point.x, point.y, (base.z + point.z) / 2)), point]
    return pts[::-1] if reverse else pts


def drop(points):
    start, end = points[0], points[-1]
    return smooth_lead(start) + points + smooth_lead(end, reverse=True)


def curve_mesh(name, points, mat, radius=WIRE_R):
    points = drop(points)
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 16
    data.bevel_depth = radius
    data.bevel_resolution = 10
    data.use_fill_caps = True
    spline = data.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for i, p in enumerate(points):
        spline.points[i].co = (p.x, p.y, p.z, 1)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def spiral(t):
    # red wire: pad 2 (back-left) to pad 5 (front-right)
    x = -0.0725 + 0.145 * t
    y = 0.1256 - 0.2511 * t + 0.055 * math.sin(t * math.pi * 2)
    z = BASE_TOP + 0.055 + 0.175 * math.sin(t * math.pi) + 0.045 * math.sin(t * math.pi * 3)
    return Vector((x, y, z))


def blue(t):
    # blue wire: pad 4 (front-left) to pad 1 (back-right)
    x = -0.0725 + 0.145 * t
    y = -0.1256 + 0.2511 * t + 0.030 * math.sin(t * math.pi * 2)
    z = BASE_TOP + 0.090 + 0.110 * (0.5 - 0.5 * math.cos(t * math.pi * 4))
    return Vector((x, y, z))


def green(t):
    # yellow wire: pad 3 (left) to pad 0 (right)
    x = -0.145 + 0.290 * t
    y = 0.055 * math.sin(t * math.pi * 2)
    z = BASE_TOP + 0.030 + 0.060 * math.sin(t * math.pi) + 0.020 * math.sin(t * math.pi * 4)
    return Vector((x, y, z))


def sampled(fn, n=180):
    return [fn(i / n) for i in range(n + 1)]


def bore(obj, hole_radius=0.0042, bevel=0.0007):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.mesh.primitive_cylinder_add(radius=hole_radius, depth=0.09, vertices=48)
    hole = bpy.context.object
    mod = obj.modifiers.new("bore", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = hole
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(hole, do_unlink=True)
    bev = obj.modifiers.new("rim", "BEVEL")
    bev.width = bevel
    bev.segments = 2
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bev.name)
    return obj


def star_mesh(outer=0.020, inner=0.0090, height=0.015):
    import bmesh

    mesh = bpy.data.meshes.new("StarBead")
    bm = bmesh.new()
    bottom, top = [], []
    for i in range(10):
        ang = math.pi / 2 + i * math.pi / 5
        r = outer if i % 2 == 0 else inner
        bottom.append(bm.verts.new((math.cos(ang) * r, math.sin(ang) * r, -height / 2)))
        top.append(bm.verts.new((math.cos(ang) * r, math.sin(ang) * r, height / 2)))
    bm.faces.new(bottom[::-1])
    bm.faces.new(top)
    for i in range(10):
        bm.faces.new([bottom[i], bottom[(i + 1) % 10], top[(i + 1) % 10], top[i]])
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("StarBead", mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    return obj


def bead(kind, mat):
    if kind == "ring":
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.0118, minor_radius=0.0050, major_segments=64, minor_segments=24
        )
        obj = bpy.context.object
    else:
        if kind == "cube":
            bpy.ops.mesh.primitive_cube_add(size=0.028)
            obj = bpy.context.object
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            pre = obj.modifiers.new("soft", "BEVEL")
            pre.width = 0.0035
            pre.segments = 4
            bpy.ops.object.modifier_apply(modifier=pre.name)
        elif kind == "prism":
            bpy.ops.mesh.primitive_cylinder_add(
                vertices=3, radius=0.0215, depth=0.024, end_fill_type="NGON"
            )
            obj = bpy.context.object
            pre = obj.modifiers.new("soft", "BEVEL")
            pre.width = 0.0022
            pre.segments = 3
            bpy.ops.object.modifier_apply(modifier=pre.name)
        elif kind == "star":
            obj = star_mesh()
            pre = obj.modifiers.new("soft", "BEVEL")
            pre.width = 0.0012
            pre.segments = 3
            bpy.ops.object.modifier_apply(modifier=pre.name)
        else:
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0148, segments=64, ring_count=32)
            obj = bpy.context.object
        bore(obj)
    smooth(obj)
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.material_index = 0
    return obj


def add_beads(fn, count, kinds):
    for i in range(count):
        t = 0.08 + 0.84 * (i / (count - 1))
        p = fn(t)
        p.z -= 0.0012  # the bore rides on top of the wire
        tan = (fn(min(0.999, t + 0.002)) - fn(max(0.001, t - 0.002))).normalized()
        obj = bead(kinds[i % len(kinds)], painted_wood(f"Bead{i}", PALETTE[i % len(PALETTE)]))
        obj.location = p
        obj.rotation_mode = "QUATERNION"
        obj.rotation_quaternion = tan.to_track_quat("Z", "Y")
        obj.rotation_quaternion = obj.rotation_quaternion @ __import__("mathutils").Quaternion(
            (0, 0, 1), math.radians((i * 37) % 17 - 8)
        )
        jitter = 1.0 + 0.025 * math.sin(i * 2.1)
        obj.scale = (jitter, jitter, 1.0 + 0.02 * math.cos(i * 1.7))
        obj.name = f"Bead_{i:02d}"


def camera_and_lights():
    import math as _m
    angle = _m.radians(float(os.environ.get("BEAD_ANGLE", "0")))
    zoom = float(os.environ.get("BEAD_ZOOM", "1.0"))
    dist = 0.95 * zoom
    bpy.ops.object.camera_add(
        location=(
            _m.sin(angle) * dist * 0.62,
            -_m.cos(angle) * dist,
            0.40 * zoom,
        )
    )
    cam = bpy.context.object
    cam.data.lens = 54
    cam.data.sensor_width = 36
    cam.data.dof.use_dof = True
    cam.data.dof.aperture_fstop = 3.5

    target = bpy.data.objects.new("Focus", None)
    bpy.context.collection.objects.link(target)
    target.location = (0, -0.04, 0.10)
    track = cam.constraints.new("TRACK_TO")
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    cam.data.dof.focus_object = target
    bpy.context.scene.camera = cam

    def area(name, loc, size, power, color=(1, 1, 1)):
        bpy.ops.object.light_add(type="AREA", location=loc)
        light = bpy.context.object
        light.name = name
        light.data.shape = "DISK"
        light.data.size = size
        light.data.energy = power
        light.data.color = color
        c = light.constraints.new("TRACK_TO")
        c.target = target
        c.track_axis = "TRACK_NEGATIVE_Z"
        c.up_axis = "UP_Y"

    area("Key", (-0.55, -0.55, 0.85), 0.9, 30, (1.0, 0.97, 0.92))
    area("Fill", (0.75, -0.35, 0.45), 0.8, 8, (0.92, 0.96, 1.0))
    area("Rim", (0.10, 0.70, 0.62), 0.7, 15, (1.0, 0.98, 0.94))
    area("Top", (0.0, -0.05, 1.15), 1.4, 32, (1.0, 0.99, 0.96))


def world():
    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new("World")
    scene.world.use_nodes = True
    nt = scene.world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    mix = nt.nodes.new("ShaderNodeMixShader")
    lp = nt.nodes.new("ShaderNodeLightPath")
    bg_hdri = nt.nodes.new("ShaderNodeBackground")
    bg_cream = nt.nodes.new("ShaderNodeBackground")
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(os.path.join(VENDOR, "studio.jpg"))
    env.image.colorspace_settings.name = "sRGB"
    bg_hdri.inputs["Strength"].default_value = 0.7
    bg_cream.inputs["Color"].default_value = (0.975, 0.968, 0.955, 1)
    bg_cream.inputs["Strength"].default_value = 0.85
    nt.links.new(env.outputs["Color"], bg_hdri.inputs["Color"])
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
    nt.links.new(bg_hdri.outputs["Background"], mix.inputs[1])
    nt.links.new(bg_cream.outputs["Background"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])


def ground():
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = "Ground"
    obj.data.materials.append(material("Cyclorama", (0.955, 0.945, 0.925), 0.62))


def configure_render():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = int(os.environ.get("BEAD_SAMPLES", "768"))
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.max_bounces = 12
    scene.cycles.diffuse_bounces = 5
    scene.cycles.glossy_bounces = 5
    scene.render.resolution_x = int(os.environ.get("BEAD_W", "1800"))
    scene.render.resolution_y = int(os.environ.get("BEAD_H", "1350"))
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Punchy"
    scene.view_settings.exposure = -0.1
    scene.render.filepath = os.environ.get("BEAD_OUT", OUT)
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        scene.cycles.device = "GPU"
        print("CYCLES DEVICES:", [(d.name, d.type, d.use) for d in prefs.devices])
    except Exception as exc:  # pragma: no cover - hardware dependent
        print(f"GPU setup failed, using CPU: {exc}")
        scene.cycles.device = "CPU"


def main():
    clear()
    ground()
    base()

    red = wire_material("WireRed", PALETTE[0])
    blue_m = wire_material("WireBlue", PALETTE[3])
    green_m = wire_material("WireYellow", PALETTE[1])

    curve_mesh("RedSpiral", sampled(spiral), red)
    curve_mesh("BlueArches", sampled(blue), blue_m)
    curve_mesh("GreenWave", sampled(green), green_m)

    add_beads(spiral, 6, ["sphere", "ring", "cube", "cylinder", "star", "prism"])
    add_beads(blue, 6, ["prism", "sphere", "ring", "cube", "sphere", "star"])
    add_beads(green, 6, ["ring", "cube", "sphere", "prism", "star", "cylinder"])

    camera_and_lights()
    world()
    configure_render()
    bpy.ops.render.render(write_still=True)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
