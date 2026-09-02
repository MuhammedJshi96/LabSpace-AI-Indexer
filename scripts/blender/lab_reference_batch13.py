"""Additive reference pack: institutional openings, mixed casework and cooling.

Original logo-free planning geometry. See docs/reference-assets-batch13.md.
Run only this batch to preserve every previously approved model and finish.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lab_furniture as f
import lab_architecture_batch8 as architecture
import lab_fidelity_batch6 as fidelity
import storage_anatomy

ASSETS = {
    "wide-lite-door": f.AssetSpec("wide-lite-door", .95, .16, 2.15),
    "single-transom-door": f.AssetSpec("single-transom-door", 1., .16, 2.65),
    "double-transom-door": f.AssetSpec("double-transom-door", 1.8, .16, 2.65),
    "double-egress-door": f.AssetSpec("double-egress-door", 1.8, .18, 2.15),
    "integral-blind-window": f.AssetSpec("integral-blind-window", 1.8, .16, 1.2),
    "clerestory-window": f.AssetSpec("clerestory-window", 1.8, .14, .5),
    "asymmetric-lab-bench": f.AssetSpec("asymmetric-lab-bench", 1.8, .75, .9),
    "institutional-sink-cabinet": f.AssetSpec("institutional-sink-cabinet", 1.5, .7, 1.2),
    "computer-lab-bench": f.AssetSpec("computer-lab-bench", 1.6, .75, 1.35),
    "recirculating-chiller": f.AssetSpec("recirculating-chiller", .4, .55, .65),
}
STORAGE = {"asymmetric-lab-bench", "institutional-sink-cabinet", "computer-lab-bench"}


def box(name, xyz, size, material="powder_light", bevel=.003, category="construction"):
    return f.add_box(name, xyz, size, f.MATERIALS[material], bevel=bevel, category=category)


def cyl(name, xyz, radius, length, material="stainless", axis=(0, 0, 1)):
    return f.add_cylinder(name, xyz, radius, length, f.MATERIALS[material], axis=axis,
                          vertices=24, bevel=.001, category="hardware")


def tube(name, points, radius=.012, material="stainless"):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 16
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for p, xyz in zip(spline.bezier_points, points):
        p.co = xyz
        p.handle_left_type = p.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(f.MATERIALS[material])
    obj.parent = f.ROOT
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    return obj


def glazing(name, x, bottom, width, height, depth, y=0):
    """A real transparent pane in an empty aperture, with two-sided beads."""
    box(name + " glass", (x, y, bottom + height / 2), (width, .009, height), "glass", .002)
    for face in (-1, 1):
        yy = y + face * depth / 2
        for side in (-1, 1):
            xx = x + side * (width / 2 + .009)
            box(name + " gasket", (xx, yy, bottom + height / 2), (.008, .006, height + .02), "seal", .001)
            box(name + " vertical bead", (xx, yy + face * .004, bottom + height / 2),
                (.020, .012, height + .034), "aluminum", .002)
        for z in (bottom - .009, bottom + height + .009):
            box(name + " horizontal bead", (x, yy, z), (width + .016, .012, .020), "aluminum", .002)


def frame(spec, transom=False):
    w, d, h = spec.width, spec.depth, spec.height
    for side in (-1, 1):
        x = side * (w / 2 - .027)
        box("Folded steel jamb", (x, 0, h / 2), (.054, d, h), bevel=.004)
        for face in (-1, 1):
            box("Frame stop and seal", (x - side * .029, face * .029, h / 2),
                (.009, .012, h - .06), "seal", .002)
    box("Folded head", (0, 0, h - .027), (w - .108, d, .054), bevel=.004)
    box("Flush threshold", (0, 0, .006), (w - .108, d, .012), "stainless", .003)
    leaf_top = 2.1 if transom else h - .064
    if transom:
        box("Fixed transom cross rail", (0, 0, leaf_top + .026), (w - .108, d, .052))
        glazing("Fixed transom", 0, leaf_top + .062, w - .15, h - leaf_top - .134, .045)
    return w - .126, leaf_top


def door_leaf(name, x, w, top, wide=False, panic=False, side=-1):
    bottom, d = .014, .046
    h = top - bottom
    lite_w = .24 if wide else .125
    lite_x = x - side * w * .08
    lite_bottom, lite_top = .52, top - .26
    # Four panels around the lite; no opaque slab hiding the glazing.
    left, right = x - w / 2, x + w / 2
    for a, b, label in ((left, lite_x - lite_w / 2, "hinge stile"),
                        (lite_x + lite_w / 2, right, "lock stile")):
        box(name + " " + label, ((a + b) / 2, 0, bottom + h / 2), (b - a, d, h), bevel=.003)
    box(name + " lower panel", (lite_x, 0, (bottom + lite_bottom) / 2),
        (lite_w, d, lite_bottom - bottom), bevel=.001)
    box(name + " upper panel", (lite_x, 0, (top + lite_top) / 2),
        (lite_w, d, top - lite_top), bevel=.001)
    glazing(name + " vertical lite", lite_x, lite_bottom, lite_w, lite_top - lite_bottom, d)
    for face in (-1, 1):
        box(name + " kick plate", (x, face * .025, .145), (w - .055, .003, .23), "stainless", .002)
    hinge_x = x + side * (w / 2 - .008)
    for z in (.23, 1.04, top - .2):
        cyl(name + " hinge knuckle", (hinge_x, -.032, z), .008, .102)
        box(name + " hinge plate", (hinge_x - side * .016, -.026, z), (.035, .004, .1), "stainless", .001)
    handle_x = x - side * (w / 2 - .095)
    architecture.add_lever_set(name, handle_x - .035, 1.0, .12)
    if panic:
        for xx in (x - w * .32, x + w * .32):
            box(name + " panic chassis", (xx, -.046, 1.02), (.065, .043, .068), "aluminum", .008)
        box(name + " push bar", (x, -.075, 1.02), (w * .69, .035, .040), "stainless", .009)
    box(name + " overhead closer", (x + side * w * .21, -.047, top - .066), (.205, .037, .045), "aluminum", .007)
    tube(name + " articulated closer arm", [(x + side * w * .21, -.068, top - .041),
        (x, -.071, top - .026), (x - side * .12, -.04, top + .004)], .005)


def build_door(spec):
    transom = "transom" in spec.asset_id
    double = spec.asset_id.startswith("double-")
    clear, top = frame(spec, transom)
    if double:
        w = (clear - .008) / 2
        for side in (-1, 1):
            door_leaf("Left leaf" if side == -1 else "Right leaf", side * (w + .008) / 2,
                      w, top, panic="egress" in spec.asset_id, side=side)
        box("Meeting astragal", (0, .029, top / 2), (.016, .01, top - .035), "aluminum", .002)
    else:
        door_leaf("Single leaf", 0, clear, top, wide="wide-lite" in spec.asset_id)


def build_window(spec):
    w, d, h = spec.width, spec.depth, spec.height
    for side in (-1, 1):
        box("Extruded jamb", (side * (w / 2 - .03), 0, h / 2), (.06, d, h), "powder_light", .005)
        box("Extruded rail", (0, 0, .03 if side == -1 else h - .03), (w - .12, d, .06), "powder_light", .005)
    glazing("Observation glazing", 0, .078, w - .156, h - .156, .052)
    box("Folded internal sill", (0, -.036, .014), (w - .02, d - .014, .018), "aluminum", .004)
    if "blind" in spec.asset_id:
        box("Sealed blind head cassette", (0, -.037, h - .106), (w - .16, .042, .050), "aluminum", .005)
        bottom = h * .31
        count = int((h - .15 - bottom) / .025)
        for i in range(count):
            slat = box(f"Venetian slat {i+1:02}", (0, -.024, h - .14 - i * .025),
                       (w - .19, .028, .002), "blind", .0006)
            slat.rotation_euler.x = math.radians(-24)
        for x in (-w * .31, w * .31):
            for y in (-.039, -.008):
                cyl("Blind ladder cord", (x, y, (bottom + h - .15) / 2), .0014, h - .15 - bottom, "cord")
        box("Weighted blind bottom rail", (0, -.024, bottom), (w - .19, .032, .020), "aluminum", .004)
        cyl("Magnetic blind control", (w / 2 - .034, -.086, h * .4), .015, .012, "aluminum", (0, 1, 0))


def carcass(name, x, w, d, bottom, top, open_top=False):
    y = .006
    for side in (-1, 1):
        box(name + " side panel", (x + side * (w / 2 - .009), y, (bottom + top) / 2),
            (.018, d, top - bottom), "powder", .003)
    box(name + " rear panel", (x, d / 2, (bottom + top) / 2), (w - .036, .018, top - bottom), "powder", .003)
    for z in ((bottom + .009,) if open_top else (bottom + .009, top - .009)):
        box(name + " horizontal rail", (x, y, z), (w - .036, d, .018), "interior", .002)
    box(name + " recessed plinth", (x, .035, bottom / 2), (w - .045, d - .095, bottom), "powder_dark", .003)


def pull(name, x, y, z, width):
    box(name + " pull channel", (x, y - .012, z), (width, .004, .016), "aluminum", .001)
    box(name + " pull lip", (x, y - .017, z + .007), (width, .012, .003), "aluminum", .0008)
    box(name + " pull return", (x, y - .022, z + .003), (width, .003, .008), "aluminum", .0008)


def drawer(name, x, w, y, bottom, height):
    box(name + " front", (x, y, bottom + height / 2), (w, .021, height), "powder_light", .003, "drawer front")
    pull(name, x, y, bottom + height - .033, w - .06)
    # Geometry-derived storage preparation supplies the actual moving tray.


def cabinet_leaf(name, x, w, y, bottom, height, side):
    box(name, (x, y, bottom + height / 2), (w, .021, height), "powder_light", .003, "cabinet door")
    pull(name, x, y, bottom + height - .036, w - .065)
    for z in (bottom + .08, bottom + height - .08):
        cyl(name + " hinge", (x + side * (w / 2 - .012), y + .012, z), .006, .065)


def shelf(name, x, w, d, z):
    box(name, (x, .027, z), (w, d, .018), "interior", .002, "interior shelf")


def build_bench(spec):
    f.add_worktop(spec.width, spec.depth)
    carcass("Mixed bench", 0, 1.7, .64, .105, .856)
    # Two wide upper drawers + paired lower doors; three full-depth right drawers.
    split, left, right = .285, -.835, .835
    box("Drawer bank partition", (split, .01, .48), (.018, .64, .72), "interior")
    bayw = split - left
    mid = (split + left) / 2
    for i in range(2):
        x = left + (i + .5) * bayw / 2
        drawer(f"Mixed bench upper drawer {i+1}", x, bayw / 2 - .008, -.335, .700, .145)
        cabinet_leaf(f"Mixed bench cabinet door {i+1}", x, bayw / 2 - .008, -.335, .116, .576, -1 if i == 0 else 1)
    for i in range(3):
        drawer(f"Right bank drawer {i+1}", (split + right) / 2, right - split - .016,
               -.335, .116 + i * .245, .237)
    shelf("Mixed cabinet adjustable shelf", mid, bayw - .04, .53, .394)
    shelf("Mixed cabinet base shelf", mid, bayw - .04, .53, .14)
    for x in (-.70, .70):
        for y in (-.24, .25): f.add_leveler("Bench leveler", x, y)


def build_sink(spec):
    from reference_sink_construction import build_institutional
    build_institutional(spec)


def build_workstation(spec):
    box("Phenolic computer worktop", (0, 0, .78), (1.6, .75, .04), "phenolic", .007, "worktop")
    carcass("Computer pedestal", .50, .47, .62, .07, .76)
    for i, (bottom, height) in enumerate(((.081, .28), (.369, .188), (.565, .18)), 1):
        drawer(f"Computer pedestal drawer {i}", .50, .426, -.325, bottom, height)
    for y in (-.285, .285):
        box("Square tube left leg", (-.70, y, .407), (.045, .045, .706), "aluminum", .004)
        f.add_leveler("Desk adjustable foot", -.70, y)
    box("Left top frame", (-.70, 0, .738), (.05, .65, .045), "aluminum")
    box("Rear frame", (-.1, .285, .736), (1.25, .045, .048), "aluminum")
    box("Rear modesty panel", (-.23, .26, .59), (.94, .02, .25), "powder", .005)
    box("Cable tray", (-.22, .292, .708), (.88, .09, .032), "powder", .003)
    # Equipment has real rear housing, ports, stand and separated input devices.
    box("Monitor foot", (-.27, .12, .817), (.29, .18, .027), "aluminum", .010)
    box("Monitor column", (-.27, .173, .926), (.048, .055, .21), "aluminum", .009)
    box("Monitor rear enclosure", (-.27, .17, 1.16), (.59, .045, .38), "powder_dark", .012)
    box("Monitor bezel", (-.27, .14, 1.16), (.59, .018, .38), "graphite", .008)
    box("Unlit monitor glass", (-.27, .129, 1.16), (.555, .004, .344), "screen", .003)
    for i in range(9): box("Monitor rear vent", (-.40 + i * .033, .195, 1.16), (.020, .003, .004), "shadow", .001)
    box("Keyboard chassis", (-.28, -.185, .818), (.44, .16, .025), "graphite", .010)
    for row in range(5):
        for col in range(14):
            box("Keyboard key", (-.478 + col * .029, -.244 + row * .026, .835),
                (.023, .021, .006), "powder_dark", .002)
    box("Mouse", (.03, -.185, .831), (.062, .105, .036), "graphite", .016)
    box("Mouse seam", (.03, -.204, .851), (.002, .031, .002), "shadow", .001)
    box("Compact PC enclosure", (.55, .08, .987), (.205, .29, .37), "powder", .012)
    box("PC front fascia", (.55, -.071, .987), (.184, .012, .341), "powder_dark", .008)
    cyl("PC power key", (.603, -.079, 1.09), .010, .004, "aluminum", (0, 1, 0))
    for z in (.93, .95): box("PC USB port", (.535, -.079, z), (.025, .003, .008), "shadow", .001)
    for i in range(13): box("PC ventilation grille", (.55, -.079, .841 + i * .005), (.145, .003, .002), "shadow", .0005)
    tube("Monitor power cable", [(-.27, .195, 1.05), (-.27, .25, .89), (-.20, .29, .78), (-.18, .30, .72)], .003, "rubber")


def build_chiller(spec):
    w, d, h = spec.width, spec.depth, spec.height
    box("Folded cooler enclosure", (0, .006, .362), (w - .016, d - .06, .568), "powder", .012)
    box("Lid", (0, -.008, .626), (w, d - .035, .028), "powder_light", .006)
    box("Removable front bezel", (0, -.251, .358), (w - .034, .026, .55), "powder_light", .007)
    box("Recessed heat exchanger", (0, -.269, .277), (.30, .011, .302), "shadow", .005)
    for i in range(17):
        z = .14 + i * .016
        slat = box("Powder coated intake louvre", (0, -.279, z), (.304, .018, .009), "powder", .001)
        slat.rotation_euler.x = math.radians(20)
    box("Control bezel", (.026, -.273, .536), (.225, .014, .10), "graphite", .008)
    box("Controller glass", (-.02, -.282, .548), (.106, .003, .047), "screen", .004)
    # Inactive display, no invented running temperature or certification labels.
    for x in (.065, .097):
        for z in (.526, .557): box("Controller key", (x, -.282, z), (.022, .005, .021), "aluminum", .003)
    cyl("Reservoir filler cap", (0, .13, .645), .031, .010, "powder_dark")
    box("Fluid level window", (-.154, -.269, .524), (.018, .004, .076), "glass", .003)
    for side in (-1, 1):
        for i in range(10): box("Side ventilation slot", (side * .195, -.08 + i * .019, .28), (.002, .009, .085), "shadow", .002)
        box("Recessed lifting grip", (side * .195, .03, .5), (.003, .105, .025), "powder_dark", .005)
    box("Rear service panel", (0, .254, .32), (.33, .012, .43), "powder_light", .004)
    for x in (-.07, .07):
        cyl("Rear hose union", (x, .27, .50), .016, .037, "stainless", (0, 1, 0))
        cyl("Hose barb", (x, .29, .50), .009, .018, "stainless", (0, 1, 0))
    box("Rear power inlet", (.10, .264, .17), (.035, .012, .044), "graphite", .003)
    for x in (-.147, .147):
        for y in (-.185, .185):
            cyl("Caster swivel", (x, y, .06), .014, .045)
            cyl("Caster wheel", (x, y, .026), .026, .024, "rubber", (1, 0, 0))
            cyl("Caster hub", (x + .014, y, .026), .012, .005, "aluminum", (1, 0, 0))


def build_one(spec, output):
    f.reset_scene(spec.asset_id)
    f.create_root(spec)
    architecture.build_architecture_materials()
    f.MATERIALS.update({
        # Existing runtime recognizes this scoped satin finish and preserves
        # readable silver instead of near-black mirror reflections.
        "stainless": f.make_material("Studio-readable satin stainless steel - reference pack", (.68, .74, .72, 1), metallic=.22, roughness=.36),
        "aluminum": f.make_material("Reference satin aluminium hardware", (.64, .70, .68, 1), metallic=.38, roughness=.34),
        "blind": f.make_material("Satin white aluminium blind", (.78, .81, .79, 1), metallic=.35, roughness=.36),
        "cord": f.make_material("Pale blind ladder cord", (.63, .66, .64, 1), roughness=.8),
        "graphite": f.make_material("Functional graphite controls", (.038, .048, .046, 1), roughness=.38),
        "screen": f.make_material("Unlit instrument display glass", (.025, .058, .067, 1), metallic=.15, roughness=.18, coat=.25),
    })
    if spec.asset_id.endswith("door"): build_door(spec)
    elif spec.asset_id.endswith("window"): build_window(spec)
    elif spec.asset_id == "asymmetric-lab-bench": build_bench(spec)
    elif spec.asset_id == "institutional-sink-cabinet": build_sink(spec)
    elif spec.asset_id == "computer-lab-bench": build_workstation(spec)
    else: build_chiller(spec)
    # Only the new IDs participate in the existing geometry-derived rig builder.
    storage_anatomy.SUPPORTED.update(STORAGE)
    f.ROOT["revision"] = (
        "reference-batch13-r3"
        if spec.asset_id == "computer-lab-bench"
        else "reference-batch13-r2"
    )
    if spec.asset_id == "computer-lab-bench":
        f.ROOT["clean_work_surface"] = True
        f.ROOT["generic_surface_grommets"] = False
        f.ROOT["decorative_service_markers"] = False
    f.ROOT["planning_model"] = True
    f.ROOT["manufacturer_certified"] = False
    f.ROOT["source_note"] = "Original geometry from supplied July 18 reference sheets; see docs/reference-assets-batch13.md"
    batches, stats = fidelity.fit_to_dimensions(spec)
    f.ROOT["authored_bounds_m"] = stats["bounds_m"]["dimensions"]
    f.ROOT["mesh_parts"] = stats["mesh_objects"]
    f.ROOT["source_part_count"] = batches["source_parts"]
    path = output / (spec.asset_id + ".glb")
    f.export_glb(path)
    return {"id": spec.asset_id, "bytes": path.stat().st_size, **stats}


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", action="append", choices=list(ASSETS), default=[])
    parser.add_argument("--output-dir", type=Path, default=Path("public/models/hero"))
    options = parser.parse_args(args)
    options.output_dir.mkdir(parents=True, exist_ok=True)
    results = [build_one(ASSETS[aid], options.output_dir.resolve()) for aid in options.asset or ASSETS]
    print("LABSPACE_REFERENCE_BATCH13 " + json.dumps(results))


if __name__ == "__main__":
    main()
