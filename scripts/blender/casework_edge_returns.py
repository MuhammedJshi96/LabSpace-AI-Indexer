"""Close exposed drawer/gable channels, preserving overlay fronts and access.

The user's 2026-08-31 close-up shows a missing folded edge, not a detached
component. A fixed L-return conceals drawer-tray edges behind a 2 mm clearance.
This runs after recessing/articulation and never moves a door, drawer or shelf.
"""
import bpy
from mathutils import Vector

IDS = {"asymmetric-lab-bench", "lab-bench", "center-island-bench",
       "island-bench-service-bridge", "lab-bench-sink", "lab-bench-overhead",
       "base-cabinet", "base-drawer-cabinet", "sink-cabinet", "tall-cabinet",
       "mobile-bench", "wall-cabinet", "computer-lab-bench",
       "mobile-drawer", "chemical-cabinet", "flammable-cabinet", "locker",
       "refrigerator-storage", "freezer-storage", "stainless-enclosed-basin"}


def apply(f):
    root = f.ROOT
    if root is None or root.get("asset_id") not in IDS or root.get("gable_joint_revision"):
        return
    bpy.context.view_layer.update()

    def bounds(obj):
        points = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
        return (Vector(tuple(min(p[a] for p in points) for a in range(3))),
                Vector(tuple(max(p[a] for p in points) for a in range(3))))

    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    panels = [o for o in meshes if o.get("part_category") == "end gable" or
              o.name.startswith(("Mixed bench side panel", "Mixed bench left upper gable",
                                 "Mixed bench left recessed gable", "Tall cabinet side",
                                 "folded cabinet end", "wall cabinet end gable",
                                 "Computer pedestal side panel", "mobile drawer carcass side",
                                 "safety cabinet shell side", "locker carcass side",
                                 "cold-storage insulated chassis side", "Enclosed stainless cabinet shell side"))]
    faces = [o for o in meshes if o.get("part_category") in
             {"drawer front", "cabinet door", "drawer", "door", "locker door",
              "cold storage door", "insulated door"}]
    records = []
    panel_center_x = sum((bounds(p)[0].x + bounds(p)[1].x) / 2 for p in panels) / max(1, len(panels))
    for panel in panels:
        lo, hi = bounds(panel)
        side = -1 if (lo.x + hi.x) / 2 < panel_center_x else 1
        inside = hi.x if side < 0 else lo.x
        for normal in (-1, 1):
            nearby = []
            for face in faces:
                a, b = bounds(face)
                edge = a.x if side < 0 else b.x
                if (a.y + b.y) * normal <= 0:
                    continue
                if abs(edge - inside) > .05 or min(hi.z, b.z) - max(lo.z, a.z) < .015:
                    continue
                nearby.append((face, a, b))
            if not nearby:
                continue
            # An outer end belongs to a single overlay plane; stepped gables
            # are already split by recessed_casework into upper/lower panels.
            planes = [(a.y if normal < 0 else b.y) for _, a, b in nearby]
            if max(planes) - min(planes) > .025:
                raise RuntimeError(f"{root['asset_id']}/{panel.name}: mixed front planes")
            front = sum(planes) / len(planes)
            backs = [(b.y if normal < 0 else a.y) for _, a, b in nearby]
            back = sum(backs) / len(backs)
            edge = min(a.x for _, a, b in nearby) if side < 0 else max(b.x for _, a, b in nearby)
            original_front = lo.y if normal < 0 else hi.y
            leading = front - normal * .005
            material = panel.data.materials[0]
            tag = f"Fixed gable joint {panel.name} {'front' if normal < 0 else 'rear'}"

            def box(label, a, b):
                obj = f.add_box(tag + label, (a + b) / 2, b - a, material,
                                bevel=.0008, category="end gable")
                obj["fixed_gable_return"] = True
                return obj

            if normal * (leading - original_front) > .001:
                a, b = lo.copy(), hi.copy()
                a.y, b.y = sorted((leading, original_front - normal * .004))
                box(" continuous edge", a, b)
            # The return overlaps the gable's inner skin, sits 2 mm behind the
            # moving overlay, and reaches 6 mm behind its outside edge.
            a, b = lo.copy(), hi.copy()
            a.x, b.x = sorted((edge - side * .006, inside + side * .004))
            a.y, b.y = sorted((back - normal * .002, back - normal * .020))
            box(" inner closure", a, b)
            records.append({"panel": panel.name, "normal": normal,
                            "fronts": [o.name for o, _, _ in nearby],
                            "overlayClearance": .002, "faceSetback": .005,
                            "fixedPanelOverlap": .004, "frontEdgeOverlap": .006,
                            "lower": lo.z, "upper": hi.z})
    if not records:
        raise RuntimeError(f"No gable joints found for {root['asset_id']}")
    root["gable_joint_revision"] = "closed-gable-r1"
    root["gable_joint_records"] = records
    bpy.context.view_layer.update()
