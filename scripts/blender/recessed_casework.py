"""Scoped stepped cabinet construction, before storage articulation/batching.

The supplied Shimadzu photo establishes the depth hierarchy, not a dimension.
75 mm is an original planning choice. Existing materials and moving-part names
are preserved so saved inventory bindings remain valid.
"""
import bpy
from mathutils import Vector

IDS = {"asymmetric-lab-bench", "lab-bench", "center-island-bench", "island-bench-service-bridge"}
SETBACK = .075
REVISION = "recessed-casework-r1"


def apply(f):
    root = f.ROOT
    if root is None or root.get("asset_id") not in IDS or root.get("cabinet_setback_m"):
        return
    aid = root["asset_id"]
    root["cabinet_setback_m"] = SETBACK
    root["revision"] = REVISION
    bpy.context.view_layer.update()

    def bounds(obj):
        points = [obj.matrix_world @ Vector(p) for p in obj.bound_box]
        return (Vector(tuple(min(p[a] for p in points) for a in range(3))),
                Vector(tuple(max(p[a] for p in points) for a in range(3))))

    faces = [o for o in bpy.context.scene.objects
             if o.type == "MESH" and o.get("part_category") == "cabinet door"]
    bays = {}
    for face in faces:
        # Storage anatomy uses this exact prefix as its canonical bay identifier.
        prefix = face.name.rsplit(" door ", 1)[0].removesuffix(" lower")
        bays.setdefault(prefix, []).append(face)
    records = []
    for name, leaves in bays.items():
        extents = [bounds(o) for o in leaves]
        x0 = min(lo.x for lo, hi in extents) - .006
        x1 = max(hi.x for lo, hi in extents) + .006
        bottom = min(lo.z for lo, hi in extents)
        top = max(hi.z for lo, hi in extents)
        old_y = sum(o.location.y for o in leaves) / len(leaves)
        normal = -1 if old_y < 0 else 1
        new_y = old_y - normal * SETBACK
        for face in leaves:
            # Front, handle, hinge barrels and fasteners remain one assembly.
            for obj in list(bpy.context.scene.objects):
                if obj == face or obj.name.startswith(face.name + " "):
                    obj.location.y -= normal * SETBACK
            face["cabinet_setback_m"] = SETBACK
        records.append((name, x0, x1, bottom, top, old_y, new_y, normal))

    # The newly inset plinth must still conceal and support its leveling feet.
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.get("part_category") != "leveling hardware":
            continue
        if any(x0 < obj.location.x < x1 and normal * obj.location.y > .1
               for _, x0, x1, _, _, _, _, normal in records):
            obj.location.y -= (1 if obj.location.y > 0 else -1) * SETBACK

    def box(name, lo, hi, material, category="recessed cabinet construction"):
        if min(hi - lo) <= .0001:
            return
        return f.add_box(name, (lo + hi) / 2, hi - lo, material,
                         bevel=.002, category=category)

    def trim_front(lo, hi, front, normal):
        lo, hi = lo.copy(), hi.copy()
        # Thin toe faces translate; structural floors/plinths retain their back.
        if hi.y - lo.y < .05:
            shift = front - (lo.y if normal < 0 else hi.y)
            lo.y += shift
            hi.y += shift
        elif normal < 0:
            lo.y = max(lo.y, front)
        else:
            hi.y = min(hi.y, front)
        return lo, hi

    # Fixed rails used to stop 4–15 mm short of the worktop underside. Add
    # manufactured bearing strips with a 2 mm overlap instead of a floating top.
    joints = []
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH" or obj.name not in {
                "Bench upper carcass rail", "Island north upper folded rail",
                "Island south upper folded rail"}:
            continue
        lo, hi = bounds(obj)
        top_base = .856
        if hi.z < top_base:
            a, b = lo.copy(), hi.copy()
            a.z, b.z = hi.z - .002, top_base + .002
            box(obj.name + " worktop bearing", a, b, f.MATERIALS["interior"])
            joints.append({"id": obj.name, "supportTop": hi.z,
                           "bearingBottom": a.z, "bearingTop": b.z,
                           "worktopBottom": top_base})
    # Positive bearing at both ends of the bridge posts makes the mounting
    # construction legible while retaining the approved post metal finish.
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH" or obj.get("part_category") != "hutch support":
            continue
        lo, hi = bounds(obj)
        for label, z in (("lower", lo.z), ("upper", hi.z)):
            a, b = lo.copy(), hi.copy()
            a.x -= .012; b.x += .012
            a.y -= .012; b.y += .012
            a.z, b.z = z - .005, z + .005
            box(obj.name + " " + label + " mounting plate", a, b,
                obj.data.materials[0])
    root["fixed_worktop_joints"] = joints

    # Cut full-width floor/plinth panels into bay-sized structural pieces.
    # This is intentionally not a translation of just the visible door facade.
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            continue
        name = obj.name
        relevant = (
            name in {"Bench lower carcass floor", "Bench recessed toe plinth",
                     "Bench continuous front toe shadow", "Bench front toe-kick face",
                     "Mixed bench recessed plinth", "Mixed bench horizontal rail"}
            or name.startswith("Island ") and any(word in name for word in
                ("recessed plinth", "toe shadow", "toe-kick face", "carcass shell pan"))
        )
        if not relevant:
            continue
        lo, hi = bounds(obj)
        if hi.z > .18:  # upper rail/pan remains full depth beneath the drawers
            continue
        affected = [r for r in records if r[1] < hi.x and r[2] > lo.x
                    and ("Island " not in name or r[7] * obj.location.y > 0)]
        if not affected:
            continue
        material = obj.data.materials[0]
        category = obj.get("part_category", "carcass")
        bpy.data.objects.remove(obj, do_unlink=True)
        cuts = sorted({lo.x, hi.x, *(max(lo.x, min(hi.x, x))
                      for r in affected for x in (r[1], r[2]))})
        for i, (left, right) in enumerate(zip(cuts, cuts[1:])):
            a, b = lo.copy(), hi.copy()
            a.x, b.x = left, right
            record = next((r for r in affected if r[1] < (left + right) / 2 < r[2]), None)
            if record:
                normal, face_y = record[7], record[6]
                clearance = .050 if hi.z < .15 and "floor" not in name and "pan" not in name and "rail" not in name else .014
                a, b = trim_front(a, b, face_y - normal * clearance, normal)
            box(f"{name} step {i+1}", a, b, material, category)

    for name, x0, x1, bottom, top, old_y, new_y, normal in records:
        rear = .25 if normal < 0 else .055
        if "Island " in name:
            rear = normal * .055
        front = new_y - normal * .024
        y0, y1 = sorted((front, rear))
        # Shelf support liners and a roof under the forward upper drawer bank.
        for side, x in (("left", x0 + .013), ("right", x1 - .013)):
            box(f"{name} recessed {side} liner",
                Vector((x - .007, y0, bottom)), Vector((x + .007, y1, top)),
                f.MATERIALS["interior"])
        # Shelf-to-liner bearing is explicit; a shelf is never suspended in a gap.
        roof_front = old_y - normal * .013
        roof_y0, roof_y1 = sorted((roof_front, rear))
        box(f"{name} stepped drawer soffit",
            Vector((x0 + .004, roof_y0, top - .002)),
            Vector((x1 - .004, roof_y1, top + .009)), f.MATERIALS["interior"])
        if aid == "asymmetric-lab-bench":
            # Keep existing shelf names/IDs; shorten them at the front only.
            for shelf_name in ("Mixed cabinet adjustable shelf", "Mixed cabinet base shelf"):
                obj = bpy.data.objects.get(shelf_name)
                lo, hi = bounds(obj)
                lo.y = max(lo.y, front)
                material = obj.data.materials[0]
                bpy.data.objects.remove(obj, do_unlink=True)
                box(shelf_name, lo, hi, material, "interior shelf")
            # The exposed left cabinet gable follows the recess below the drawers.
            obj = next(o for o in bpy.context.scene.objects
                       if o.name.startswith("Mixed bench side panel") and o.location.x < 0)
            lo, hi = bounds(obj)
            material = obj.data.materials[0]
            bpy.data.objects.remove(obj, do_unlink=True)
            upper_lo = lo.copy(); upper_lo.z = top + .009
            lower_hi = hi.copy(); lower_hi.z = top + .009
            lower_lo = lo.copy(); lower_lo.y = new_y + .011
            box("Mixed bench left upper gable", upper_lo, hi, material)
            box("Mixed bench left recessed gable", lower_lo, lower_hi, material)
        else:
            for i, z in enumerate((bottom + .018, bottom + (top - bottom) * .52), 1):
                box(f"{name} recessed shelf {i}",
                    Vector((x0 + .018, y0, z)), Vector((x1 - .018, y1, z + .018)),
                    f.MATERIALS["interior"], "interior shelf")
    bpy.context.view_layer.update()
