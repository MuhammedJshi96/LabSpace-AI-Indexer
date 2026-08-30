"""Verified moving assemblies; no changes to unrelated assets or materials.

GLB extras describe real panels, hinge pivots and drawer travel. Cabinet shells
and shelves stay fixed. The browser animates a private clone of these parts.
"""
from __future__ import annotations

import math
import re

import bpy
from mathutils import Vector


SUPPORTED = {"wall-cabinet", "base-cabinet", "base-drawer-cabinet", "lab-bench", "mobile-bench"}


def prepare(furniture) -> None:
    root = furniture.ROOT
    if root is None or root.get("asset_id") not in SUPPORTED or root.get("storage_rig_version"):
        return
    root["storage_rig_version"] = 1
    bpy.context.view_layer.update()
    minimum, maximum = furniture.mesh_bounds()
    size = maximum - minimum
    center = (minimum + maximum) / 2
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]

    def mechanism(prefix, face, kind, side=0, bay=""):
        parts = [o for o in meshes if o.name == prefix or o.name.startswith(prefix + " ")]
        points = [face.matrix_world @ Vector(p) for p in face.bound_box]
        low = Vector(tuple(min(p[a] for p in points) for a in range(3)))
        high = Vector(tuple(max(p[a] for p in points) for a in range(3)))
        if root["asset_id"] == "wall-cabinet":
            low.z, high.z = size.z * 0.06 + minimum.z, size.z * 0.96 + minimum.z
        mid = (low + high) / 2
        node = bpy.data.objects.new("Access - " + prefix, None)
        bpy.context.collection.objects.link(node)
        node.parent = root
        node.location = ((low.x if side < 0 else high.x) if kind == "hinge" else mid.x, mid.y, 0)
        node["storageMechanism"] = {
            "id": prefix, "kind": kind, "bay": bay,
            "angle": side * math.radians(100) if kind == "hinge" else 0.0,
            "travel": min(size.y * 0.62, 0.42) if kind == "drawer" else 0.0,
            "region": {"x": (mid.x - center.x) / size.x,
                       "y": (low.z - minimum.z) / size.z,
                       "z": -(mid.y - center.y) / size.y,
                       "width": (high.x - low.x) / size.x,
                       "height": (high.z - low.z) / size.z},
        }
        if kind == "drawer":
            before = set(bpy.data.objects)
            tray_depth = min(size.y * 0.72, 0.52)
            tray_width = high.x - low.x - 0.035
            tray_bottom = low.z + 0.018
            tray_height = max(0.045, (high.z - low.z) * 0.62)
            tray_y = mid.y + tray_depth / 2 + 0.012
            furniture.add_box(prefix + " tray floor", (mid.x, tray_y, tray_bottom),
                              (tray_width, tray_depth, 0.012), furniture.MATERIALS["interior"], bevel=0.002)
            for sign in (-1, 1):
                furniture.add_box(prefix + " tray side", (mid.x + sign * tray_width / 2, tray_y, tray_bottom + tray_height / 2),
                                  (0.012, tray_depth, tray_height), furniture.MATERIALS["interior"], bevel=0.002)
            furniture.add_box(prefix + " tray back", (mid.x, mid.y + tray_depth, tray_bottom + tray_height / 2),
                              (tray_width, 0.012, tray_height), furniture.MATERIALS["interior"], bevel=0.002)
            parts += list(set(bpy.data.objects) - before)
        bpy.context.view_layer.update()
        for part in parts:
            matrix = part.matrix_world.copy()
            part.parent = node
            part.matrix_world = matrix

    asset_id = root["asset_id"]
    if asset_id == "wall-cabinet":
        for side, label in ((-1, "left"), (1, "right")):
            prefix = "wall cabinet " + label + " door"
            face = next(o for o in meshes if o.name == prefix + " lower rail")
            # Use the full assembly envelope, not just one rail, for matching.
            mechanism(prefix, face, "hinge", side, "wall cabinet")
        root["storage_shelf_levels"] = [0.66, 0.34]
    else:
        for face in meshes:
            match = re.match(r"(.+ (?:drawer \d+|top drawer \d+)) front$", face.name)
            if match:
                mechanism(match[1], face, "drawer")
            match = re.match(r"(.+) lower door ([12])$", face.name)
            if match:
                mechanism(face.name, face, "hinge", -1 if match[2] == "1" else 1, match[1])
        if asset_id == "mobile-bench":
            for face in meshes:
                if re.match(r"mobile drawer [12]$", face.name):
                    mechanism(face.name, face, "drawer")
                if re.match(r"mobile cabinet (left|right) door$", face.name):
                    mechanism(face.name, face, "hinge", -1 if "left" in face.name else 1, "mobile cabinet")
        # These opaque reveal planes used to cover the entire opening. The
        # actual folded shell now provides the recess, so nothing masks it.
        for obj in meshes:
            if obj.get("part_category") == "casework reveal":
                bpy.data.objects.remove(obj, do_unlink=True)
    root["storage_mechanism_count"] = sum("storageMechanism" in o for o in root.children)
    assert root["storage_mechanism_count"] > 0, asset_id
