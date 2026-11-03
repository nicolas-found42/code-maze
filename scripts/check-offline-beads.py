"""Geometry regressions: run with Blender -b -P scripts/check-offline-beads.py."""
import importlib.util
import os

import bpy
from mathutils import Vector

path = os.path.join(os.path.dirname(__file__), "render-bead-maze.py")
spec = importlib.util.spec_from_file_location("bead_render", path)
toy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(toy)
toy.clear()
paint = toy.material("Test paint", (0.8, 0.1, 0.1))
counts = {}
for kind in ["sphere", "ring", "cube", "cylinder", "star", "prism"]:
    obj = toy.bead(kind, paint)
    counts[kind] = len(obj.data.vertices)
    assert not obj.ray_cast(Vector((0, 0, -0.1)), Vector((0, 0, 1)))[0], f"{kind}: bore is blocked"
    timber_faces = [p for p in obj.data.polygons if p.material_index == 1]
    assert timber_faces, f"{kind}: no bare timber bore"
    assert any(p.material_index == 0 for p in obj.data.polygons), f"{kind}: no paint"
    # Include the worst authored radial scale and the explicit resting offset.
    minimum_radius = min((v.co.x ** 2 + v.co.y ** 2) ** 0.5 for v in obj.data.vertices)
    assert minimum_radius * 0.975 > toy.WIRE_R + 0.0012, f"{kind}: rail clips the eccentric bore"
    print(kind, "vertices", counts[kind], "timber faces", len(timber_faces), "minimum radial clearance", minimum_radius * 0.975 - toy.WIRE_R - 0.0012)
assert counts["cylinder"] != counts["sphere"], "cylinder silently fell through to sphere"
print("Offline bead checks passed: six distinct kinds, open bores, paint/timber partition, positive eccentric drill clearance.")
