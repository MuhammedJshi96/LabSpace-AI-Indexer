"""Assign visible finishes before material batching loses part identity.

Substrate is not surface: painted steel is a dielectric, as are laminate and
polyamide. See docs/reference-visible-finishes.md for sources and design choices.
This changes materials only, never geometry, transforms or storage mechanisms.
"""
import bpy
import re

LAMINATE_BENCHES = set("lab-bench lab-bench-sink lab-bench-overhead center-island-bench island-bench-service-bridge asymmetric-lab-bench corner-lab-bench".split())
COATED_CASEWORK = LAMINATE_BENCHES | set("mobile-bench computer-lab-bench base-cabinet base-drawer-cabinet sink-cabinet institutional-sink-cabinet wall-cabinet glass-wall-cabinet tall-cabinet sliding-door-cabinet glazed-sliding-cabinet solvent-cabinet mobile-drawer chemical-cabinet flammable-cabinet locker steel-pedestal-desk wood-pedestal-desk maple-steel-desk".split())
PAINTED_DOORS = set("single-door double-door narrow-lite-door wide-lite-door single-transom-door double-transom-door double-egress-door sliding-door double-sliding-door cleanroom-glazed-door".split())
PANEL_CATEGORIES = set("carcass|end gable|drawer front|drawer|door|cabinet door|overhead cabinet|glazed hutch end panel|glazed hutch divider|hutch top cap|recessed cabinet construction|recessed cabinet soffit|interior shelf|manufactured edge".split("|"))
PAINT_NAMES = {"Room 809 light gray powder coat", "Warm gray powder coat highlight", "Casework interior enamel", "Institutional porcelain door enamel", "Institutional warm grey casework"}


def apply(f):
    if f.ROOT is None:
        return
    asset_id = f.ROOT.get("asset_id", "")
    recipes = {
        "laminate": ("Soft grey laboratory laminate", (.43, .415, .435, 1), .46, "enamel", "user-bench-color-reference"),
        "coated-pull": ("Satin grey coated casework pull", (.37, .365, .385, 1), .42, "enamel", "kewaunee-painted-pull"),
        "bench-plinth": ("Recessed graphite bench plinth paint", (.022, .025, .028, 1), .52, "enamel", "user-bench-color-reference"),
        "door-paint": ("Eggshell institutional door paint", (.62, .615, .575, 1), .46, "enamel", "steelcraft-painted-door"),
        "polyamide-grip": ("Matt anthracite polyamide door grip", (.055, .064, .063, 1), .43, "polymer", "hewi-polyamide"),
        "black-handle": ("Matte black coated handle", (.008, .009, .011, 1), .44, "polymer", "user-black-handles"),
    }
    materials = {}
    counts = {}
    handle_parts = []
    for obj in list(bpy.context.scene.objects):
        if obj.type not in {"MESH", "CURVE"}:
            continue
        category = obj.get("part_category", "").lower()
        name = obj.name.lower()
        for index, original in enumerate(list(obj.data.materials)):
            if original is None:
                continue
            bsdf = original.node_tree.nodes.get("Principled BSDF") if original.use_nodes else None
            # Legacy reference-pack hardware used reduced metal factors for
            # studio readability, so a numeric threshold alone misses pulls.
            is_metal = (bsdf and bsdf.inputs["Metallic"].default_value > .5) or any(s in original.name.lower() for s in ("aluminum", "aluminium", "stainless", "polished hardware"))
            role = None
            if asset_id in COATED_CASEWORK:
                # Recessed pull shadows are not grips; faucets, hinges and drawer
                # runners retain their own material even beside a coated pull.
                if is_metal and ("pull" in category or "handle" in category or " pull " in name or "handle rail" in name or "handle standoff" in name):
                    role = "coated-pull"
                elif asset_id in LAMINATE_BENCHES and original.name in PAINT_NAMES:
                    if category in PANEL_CATEGORIES or (asset_id == "asymmetric-lab-bench" and category == "construction") or (asset_id == "corner-lab-bench" and category in {"detail", "enclosure", "rear service"}):
                        role = "laminate"
                if asset_id in LAMINATE_BENCHES and (category in {"plinth", "toe kick"} or "plinth" in name or "toe kick" in name):
                    role = "bench-plinth"
            if asset_id in PAINTED_DOORS:
                if original.name in PAINT_NAMES or category in {"frame", "glazing frame", "door leaf edge", "door leaf frame"} or (category == "construction" and any(s in name for s in (" bead", "astragal", "overhead closer"))):
                    role = "door-paint"
                # Visible lever/rose gets the selected polyamide option. Small
                # lock cylinders, hinges, closers and kickplates stay metal.
                if category == "door hardware" and any(s in name for s in (" lever", " rose", " pull handle")):
                    role = "polyamide-grip"
            words = (category + " " + name).replace("_", " ").replace("-", " ")
            handle = re.search(r"\b(handle|pull|grip|lever|handwheel)\b|push bar", words)
            # Keep attachment hardware, shafts and supporting cart posts metal.
            # Only the hand-contact assembly receives the user's black finish.
            excluded = re.search(r"\b(bolt|screw|hinge|bracket|gusset|spindle|rod|connector)\b|lower post|swept shoulder", words)
            if (role in {"coated-pull", "polyamide-grip"} or handle) and not excluded:
                role = "black-handle"
            if role is None:
                continue
            if role not in materials:
                label, color, roughness, surface, reference = recipes[role]
                mat = bpy.data.materials.new(label)
                mat.use_nodes = True
                mat.diffuse_color = color
                bsdf = mat.node_tree.nodes.get("Principled BSDF")
                bsdf.inputs["Base Color"].default_value = color
                bsdf.inputs["Metallic"].default_value = 0
                bsdf.inputs["Roughness"].default_value = roughness
                mat["labspace_visible_finish"] = role
                mat["labspace_surface"] = surface
                mat["labspace_finish_reference"] = reference
                materials[role] = mat
            obj.data.materials[index] = materials[role]
            counts[role] = counts.get(role, 0) + 1
            if role == "black-handle":
                handle_parts.append(obj.name)
    f.ROOT["visible_finish_revision"] = "reference-surfaces-r1"
    f.ROOT["visible_finish_part_counts"] = counts
    f.ROOT["handle_finish_revision"] = "black-handles-r1"
    f.ROOT["black_handle_parts"] = handle_parts
