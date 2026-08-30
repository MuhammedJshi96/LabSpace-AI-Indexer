"""Build the final authored all-sided models for the visible LabSpace catalog.

These original, logo-free planning assets replace the last generic procedural
representations in the draggable catalog. Straight-wall and half-height-wall
remain dedicated wall-workflow primitives and are intentionally not included.

Run with Blender in background mode::

    blender --background --factory-startup \
      --python scripts/blender/lab_catalog_completion_batch12.py -- \
      --output-dir public/models/hero
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
if str(SCRIPT_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIRECTORY))

import lab_casework_batch3 as casework  # noqa: E402
import lab_fidelity_batch6 as fidelity  # noqa: E402
import lab_furniture as furniture  # noqa: E402
import lab_instruments_batch10 as instruments  # noqa: E402


AssetSpec = furniture.AssetSpec

ASSETS = {
    "structural-column": AssetSpec("structural-column", 0.450, 0.450, 3.000),
    "corner-lab-bench": AssetSpec("corner-lab-bench", 1.500, 1.500, 0.900),
    "mobile-bench": AssetSpec("mobile-bench", 1.200, 0.700, 0.900),
    "office-desk": AssetSpec("office-desk", 1.400, 0.700, 0.740),
    "rectangular-table": AssetSpec("rectangular-table", 1.600, 0.800, 0.740),
    "wall-cabinet": AssetSpec("wall-cabinet", 0.900, 0.350, 0.700),
    "chemical-cabinet": AssetSpec("chemical-cabinet", 0.900, 0.600, 1.900),
    "flammable-cabinet": AssetSpec("flammable-cabinet", 0.900, 0.600, 1.200),
    "mobile-drawer": AssetSpec("mobile-drawer", 0.500, 0.550, 0.650),
    "heavy-duty-rack": AssetSpec("heavy-duty-rack", 1.800, 0.600, 2.200),
    "locker": AssetSpec("locker", 0.900, 0.500, 1.900),
    "pegboard": AssetSpec("pegboard", 1.200, 0.080, 0.900),
    "refrigerator-storage": AssetSpec("refrigerator-storage", 0.750, 0.780, 1.950),
    "freezer-storage": AssetSpec("freezer-storage", 0.750, 0.780, 1.950),
    "plastic-basket-tower": AssetSpec("plastic-basket-tower", 0.450, 0.450, 1.750),
    "computer-workstation": AssetSpec("computer-workstation", 1.400, 0.700, 1.350),
    "printer": AssetSpec("printer", 0.500, 0.500, 0.350),
    "safety-shower": AssetSpec("safety-shower", 0.900, 0.900, 2.400),
    "waste-bin": AssetSpec("waste-bin", 0.450, 0.450, 0.700),
    "biological-waste-bin": AssetSpec("biological-waste-bin", 0.450, 0.450, 0.700),
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", choices=("all", *ASSETS.keys()), default="all")
    parser.add_argument("--output-dir", default="public/models/hero")
    parser.add_argument("--save-blend-dir", default="")
    return parser.parse_args(argv)


def add_catalog_materials() -> None:
    make = furniture.make_material
    furniture.MATERIALS.update(
        {
            "porcelain": make(
                "Porcelain white instrument enamel",
                (0.89, 0.93, 0.92, 1.0),
                metallic=0.04,
                roughness=0.25,
                coat=0.20,
            ),
            "teal": make(
                "LabSpace instrument teal",
                (0.0, 0.48, 0.40, 1.0),
                metallic=0.05,
                roughness=0.25,
                coat=0.18,
            ),
            "screen": make(
                "Low-glare instrument display",
                (0.012, 0.030, 0.035, 1.0),
                roughness=0.12,
                coat=0.42,
            ),
            "desk_surface": make(
                "Light laboratory laminate",
                (0.70, 0.74, 0.72, 1.0),
                metallic=0.02,
                roughness=0.30,
                coat=0.12,
            ),
            "steel_visible": make(
                "Studio-readable satin stainless steel",
                (0.70, 0.76, 0.75, 1.0),
                metallic=0.48,
                roughness=0.32,
                coat=0.10,
            ),
            "safety_yellow": make(
                "Safety cabinet yellow",
                (0.92, 0.66, 0.05, 1.0),
                metallic=0.03,
                roughness=0.29,
                coat=0.16,
            ),
            "bio_red": make(
                "Biological waste safety red",
                (0.67, 0.045, 0.035, 1.0),
                roughness=0.28,
                coat=0.17,
            ),
            "basket_blue": make(
                "Washable laboratory basket blue",
                (0.10, 0.38, 0.55, 1.0),
                roughness=0.34,
                coat=0.12,
            ),
            "glass": casework.make_transmissive_material(
                "Low-iron cabinet glass", (0.65, 0.88, 0.88, 0.23), 0.90, 0.05
            ),
        }
    )


box = instruments.box
cylinder = instruments.cylinder
tube = instruments.tube
torus = instruments.torus


def cone(
    name: str,
    location: tuple[float, float, float],
    radius1: float,
    radius2: float,
    depth: float,
    material: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    category: str = "detail",
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=48,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    furniture.assign_material(obj, material)
    furniture.smooth(obj)
    return furniture.parent_to_root(obj, category)


def add_pull(name: str, x: float, y: float, z: float, width: float) -> None:
    m = furniture.MATERIALS
    tube(
        name,
        [(x - width / 2, y + 0.012, z), (x - width / 2, y - 0.025, z),
         (x + width / 2, y - 0.025, z), (x + width / 2, y + 0.012, z)],
        0.008,
        m["aluminum"],
        category="handle",
    )


def add_casters(width: float, depth: float, z: float = 0.055) -> None:
    m = furniture.MATERIALS
    for x in (-width * 0.39, width * 0.39):
        for y in (-depth * 0.35, depth * 0.35):
            box("caster fork", (x, y, z + 0.035), (0.035, 0.050, 0.065), m["zinc"], bevel=0.008, category="caster")
            cylinder("caster wheel", (x, y, z), 0.048, 0.028, m["rubber"], axis=(1.0, 0.0, 0.0), vertices=32, category="caster")


def add_vent_slots(prefix: str, x: float, y: float, z: float, width: float, rows: int = 5) -> None:
    m = furniture.MATERIALS
    for row in range(rows):
        box(
            f"{prefix} vent {row + 1}",
            (x, y, z + (row - (rows - 1) / 2) * 0.028),
            (width, 0.006, 0.010),
            m["shadow"],
            bevel=0.002,
            category="ventilation",
        )


def build_structural_column(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    box("powder-coated structural column", (0, 0, h / 2), (w * 0.84, d * 0.84, h * 0.975), m["powder_light"], bevel=0.025, category="column")
    box("column base plate", (0, 0, 0.022), (w * 0.98, d * 0.98, 0.044), m["stainless"], bevel=0.010, category="base plate")
    box("column top cap", (0, 0, h - 0.018), (w * 0.91, d * 0.91, 0.036), m["aluminum"], bevel=0.009, category="top cap")
    for x in (-w * 0.35, w * 0.35):
        for y in (-d * 0.35, d * 0.35):
            cylinder("base anchor bolt", (x, y, 0.054), 0.018, 0.026, m["zinc"], vertices=28, category="anchor hardware")
    for z in (h * 0.33, h * 0.66):
        box("column access seam", (0, -d * 0.425, z), (w * 0.52, 0.006, 0.010), m["shadow"], bevel=0.001, category="manufacturing seam")


def add_casework_face(prefix: str, width: float, front: float, height: float, z0: float = 0.11) -> None:
    m = furniture.MATERIALS
    drawer_h = height * 0.18
    for index in range(2):
        z = z0 + height - drawer_h * (index + 0.65)
        box(f"{prefix} drawer {index + 1}", (0, front, z), (width * 0.92, 0.022, drawer_h * 0.88), m["porcelain"], bevel=0.007, category="drawer")
        add_pull(f"{prefix} drawer pull {index + 1}", 0, front - 0.018, z + drawer_h * 0.25, width * 0.42)
    door_h = height * 0.48
    for side in (-1, 1):
        x = side * width * 0.235
        z = z0 + door_h * 0.53
        box(f"{prefix} door {side:+d}", (x, front, z), (width * 0.45, 0.022, door_h), m["powder_light"], bevel=0.008, category="cabinet door")
        add_pull(f"{prefix} door pull {side:+d}", x - side * width * 0.13, front - 0.018, z + door_h * 0.32, width * 0.16)


def build_corner_bench(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    # One manufactured L slab, not two intersecting/floating rectangular tops.
    # Kewaunee steel-casework cues: folded gables, flush fronts, recessed toe space.
    outline = [(-w / 2, 0.10), (0.10, 0.10), (0.10, -d / 2),
               (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]
    vertices = [(x, y, z) for z in (h - 0.038, h) for x, y in outline]
    faces = [tuple(reversed(range(6))), tuple(range(6, 12))]
    faces += [(i, (i + 1) % 6, (i + 1) % 6 + 6, i + 6) for i in range(6)]
    mesh = bpy.data.meshes.new("continuous L phenolic slab")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    slab = bpy.data.objects.new("continuous L-shaped phenolic worktop", mesh)
    bpy.context.collection.objects.link(slab)
    furniture.assign_material(slab, m["phenolic"])
    furniture.parent_to_root(slab, "worktop")
    bevel = slab.modifiers.new("Soft manufactured slab edge", "BEVEL")
    bevel.width, bevel.segments = 0.004, 4
    bevel.harden_normals = True

    def cabinet_run(center: tuple[float, float], angle: float, drawers: bool) -> None:
        before = set(bpy.data.objects)
        bw, bd, base, top = 0.840, 0.570, 0.105, h - 0.038
        front = -bd / 2
        box("folded run bottom", (0, 0, base + 0.011), (bw, bd, 0.022), m["powder_light"], bevel=0.003)
        box("worktop bearing rail", (0, 0, top - 0.013), (bw, bd, 0.026), m["powder_light"], bevel=0.003)
        for side in (-1, 1):
            box("manufactured end gable", (side * (bw / 2 - 0.010), 0, (base + top) / 2),
                (0.020, bd, top - base), m["powder_light"], bevel=0.003)
        box("removable cabinet back", (0, bd / 2 - 0.009, (base + top) / 2),
            (bw - 0.040, 0.018, top - base - 0.008), m["powder"], bevel=0.003, category="rear service")
        box("recessed toe kick", (0, 0.038, base / 2), (bw - 0.025, bd - 0.076, base), m["powder"], bevel=0.003, category="plinth")
        if drawers:
            upper = top - 0.008
            for index, height in enumerate((0.172, 0.228, 0.309)):
                z = upper - height / 2
                box(f"corner run drawer {index + 1}", (0, front - 0.004, z), (bw - 0.036, 0.020, height), m["powder_light"], bevel=0.003, category="drawer")
                furniture.add_recessed_pull(f"corner drawer {index + 1}", 0, front - 0.014, z + height / 2 - 0.044, bw - 0.036, -1)
                upper -= height + 0.008
        else:
            drawer_z = top - 0.008 - 0.086
            box("return utility drawer", (0, front - 0.004, drawer_z), (bw - 0.036, 0.020, 0.172), m["powder_light"], bevel=0.003, category="drawer")
            furniture.add_recessed_pull("return drawer", 0, front - 0.014, drawer_z + 0.042, bw - 0.036, -1)
            door_top, door_bottom = top - 0.196, base + 0.012
            leaf_w = (bw - 0.044) / 2
            for side in (-1, 1):
                x = side * (leaf_w + 0.008) / 2
                box("return cabinet leaf", (x, front - 0.004, (door_top + door_bottom) / 2),
                    (leaf_w, 0.020, door_top - door_bottom), m["powder_light"], bevel=0.003, category="door")
                furniture.add_vertical_door_pull("return satin pull", side * 0.034, front - 0.014, door_top - 0.12, -1)
        for obj in set(bpy.data.objects) - before:
            x, y = obj.location.x, obj.location.y
            obj.location.x = center[0] + x * math.cos(angle) - y * math.sin(angle)
            obj.location.y = center[1] + x * math.sin(angle) + y * math.cos(angle)
            obj.rotation_euler.z += angle

    cabinet_run((-0.280, 0.425), 0, True)
    cabinet_run((0.425, -0.280), -math.pi / 2, False)
    # Enclosed blind corner joins the two runs beneath the shared work surface.
    box("blind-corner body", (0.425, 0.425, 0.4835), (0.570, 0.570, 0.757), m["powder"], bevel=0.004)
    box("blind-corner recessed plinth", (0.463, 0.463, 0.0525), (0.494, 0.494, 0.105), m["powder"], bevel=0.003, category="plinth")
    # Present the two functional inner faces in the catalog's standard orbit.
    for obj in furniture.ROOT.children:
        x, y = obj.location.x, obj.location.y
        obj.location.x, obj.location.y = -y, x
        obj.rotation_euler.z += math.pi / 2


def build_mobile_bench(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    bottom, top = 0.132, h - 0.038
    body_w, body_d = w - 0.10, d - 0.08
    front = -body_d / 2 - 0.008
    box("mobile phenolic worktop", (0, 0, h - 0.019), (w, d, 0.038), m["phenolic"], bevel=0.006, category="worktop")
    box("mobile chassis base", (0, 0, bottom + 0.012), (body_w, body_d, 0.024), m["powder"], bevel=0.004, category="chassis")
    box("worktop support frame", (0, 0, top - 0.018), (body_w, body_d, 0.036), m["powder"], bevel=0.004, category="worktop support")
    for side in (-1, 1):
        box("folded cabinet end", (side * (body_w / 2 - 0.010), 0, (bottom + top) / 2),
            (0.020, body_d, top - bottom), m["porcelain"], bevel=0.004, category="casework")
    box("removable rear panel", (0, body_d / 2 - 0.009, (bottom + top) / 2),
        (body_w - 0.044, 0.018, top - bottom - 0.012), m["powder_light"], bevel=0.004, category="rear service")
    face_w = body_w - 0.044
    drawer_h, gap = 0.140, 0.008
    for index in range(2):
        z = top - gap - drawer_h / 2 - index * (drawer_h + gap)
        box(f"mobile drawer {index + 1}", (0, front, z), (face_w, 0.022, drawer_h), m["porcelain"], bevel=0.003, category="drawer")
        furniture.add_recessed_pull(f"mobile drawer {index + 1}", 0, front - 0.008, z + 0.040, face_w, -1)
    door_top = top - gap - 2 * (drawer_h + gap)
    door_bottom = bottom + 0.010
    for side in (-1, 1):
        leaf_w = (face_w - gap) / 2
        x = side * (leaf_w + gap) / 2
        prefix = "mobile cabinet " + ("left" if side < 0 else "right") + " door"
        box(prefix, (x, front, (door_bottom + door_top) / 2),
            (leaf_w, 0.022, door_top - door_bottom), m["porcelain"], bevel=0.003, category="door")
        furniture.add_vertical_door_pull(prefix + " pull", side * 0.035, front - 0.008,
                                         door_top - 0.11, -1)
    for x in (-body_w * 0.40, body_w * 0.40):
        for y in (-body_d * 0.36, body_d * 0.36):
            box("caster mounting plate", (x, y, 0.125), (0.085, 0.072, 0.014), m["zinc"], bevel=0.003, category="caster")
            cylinder("swivel bearing", (x, y, 0.107), 0.030, 0.027, m["steel_visible"], vertices=32, category="caster")
            for side in (-1, 1):
                box("caster fork cheek", (x + side * 0.023, y, 0.075), (0.008, 0.045, 0.064), m["steel_visible"], bevel=0.004, category="caster")
            cylinder("rubber caster tire", (x, y, 0.048), 0.048, 0.034, m["rubber"], axis=(1, 0, 0), vertices=40, category="caster")
            cylinder("caster axle hub", (x, y, 0.048), 0.018, 0.052, m["zinc"], axis=(1, 0, 0), vertices=28, category="caster")
            if y < 0:
                box("caster brake pedal", (x, y - 0.032, 0.094), (0.052, 0.038, 0.009), m["steel_visible"], bevel=0.003, category="caster brake")
    rail_x = body_w / 2 + 0.026
    tube("continuous side push handle", [(body_w / 2, -0.20, top - 0.10), (rail_x, -0.20, top - 0.10),
        (rail_x, 0.20, top - 0.10), (body_w / 2, 0.20, top - 0.10)], 0.011, m["steel_visible"], category="push handle")
    assert abs((top + 0.038) - h) < 1e-8


def build_desk(spec: AssetSpec, *, office: bool) -> None:
    if not office:
        build_rectangular_table(spec)
        return
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    top_material = m["desk_surface"] if office else m["powder_light"]
    top_thickness, leg_bottom = 0.028, 0.025
    underside = h - top_thickness
    rail_height = 0.052
    leg_x, leg_y = w / 2 - 0.080, d / 2 - 0.080
    frame = m["powder_light"]
    box("continuous laminate desktop", (0, 0, h - top_thickness / 2), (w, d, top_thickness), top_material, bevel=0.006, category="work surface")
    # Legs, aprons and corner brackets share the same underside datum: no gaps.
    for y in (-leg_y, leg_y):
        box("desk apron rail", (0, y, underside - rail_height / 2), (2 * leg_x, 0.035, rail_height), frame, bevel=0.003, category="frame")
    for x in (-leg_x, leg_x):
        box("desk side rail", (x, 0, underside - rail_height / 2), (0.050, 2 * leg_y, rail_height), frame, bevel=0.003, category="frame")
        for y in (-leg_y, leg_y):
            box("square tube leg", (x, y, (underside + leg_bottom) / 2), (0.050, 0.050, underside - leg_bottom), frame, bevel=0.004, category="frame")
            box("leg mounting bracket", (x, y, underside - 0.005), (0.090, 0.080, 0.010), m["steel_visible"], bevel=0.003, category="joinery")
            cylinder("leveling foot", (x, y, leg_bottom / 2), 0.028, leg_bottom, m["rubber"], vertices=32, category="foot")
    panel_top, panel_bottom = underside - 0.045, h * 0.48
    box("rear modesty panel", (0, leg_y, (panel_top + panel_bottom) / 2), (2 * leg_x - 0.05, 0.018, panel_top - panel_bottom), frame, bevel=0.003, category="modesty panel")
    for x in (-leg_x + 0.055, leg_x - 0.055):
        box("modesty panel bracket", (x, leg_y - 0.012, panel_top), (0.065, 0.035, 0.065), m["steel_visible"], bevel=0.003, category="joinery")
    cylinder("flush cable grommet rim", (w * 0.34, d * 0.24, h - 0.002), 0.033, 0.004, m["steel_visible"], vertices=48, category="cable management")
    cylinder("cable grommet insert", (w * 0.34, d * 0.24, h - 0.0005), 0.027, 0.003, m["rubber"], vertices=48, category="cable management")
    if office:
        drawer_x, drawer_y = w * 0.30, -d * 0.08
        box("underslung pencil drawer", (drawer_x, drawer_y, underside - 0.043), (w * 0.24, d * 0.52, 0.048), m["porcelain"], bevel=0.003, category="drawer")
        for side in (-1, 1):
            box("pencil drawer runner", (drawer_x + side * w * 0.115, drawer_y, underside - 0.017), (0.014, d * 0.48, 0.034), m["steel_visible"], bevel=0.002, category="drawer runner")
        furniture.add_recessed_pull("pencil drawer", drawer_x, drawer_y - d * 0.26, underside - 0.041, w * 0.24, -1)
    assert abs(underside + top_thickness - h) < 1e-8


def build_rectangular_table(spec: AssetSpec) -> None:
    """Preserve the approved, unrelated table while named desks are revised."""
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    box("work surface", (0, 0, h * 0.96), (w * 0.98, d * 0.96, h * 0.08), m["powder_light"], bevel=0.018, category="work surface")
    for y in (-d * 0.35, d * 0.35):
        box("desk apron rail", (0, y, h * 0.90), (w * 0.86, 0.028, 0.036), m["steel_visible"], bevel=0.006, category="frame")
    for x in (-w * 0.42, w * 0.42):
        box("desk side rail", (x, 0, h * 0.90), (0.028, d * 0.70, 0.036), m["steel_visible"], bevel=0.006, category="frame")
    for x in (-w * 0.43, w * 0.43):
        for y in (-d * 0.36, d * 0.36):
            box("square tube leg", (x, y, h * 0.43), (0.055, 0.055, h * 0.80), m["steel_visible"], bevel=0.009, category="frame")
            cylinder("leveling foot", (x, y, 0.018), 0.040, 0.030, m["rubber"], vertices=28, category="foot")
    box("rear modesty panel", (0, d * 0.40, h * 0.50), (w * 0.78, 0.020, h * 0.44), m["powder_light"], bevel=0.008, category="modesty panel")
    cylinder("cable grommet", (w * 0.34, d * 0.24, h + 0.004), 0.040, 0.012, m["black"], vertices=40, category="cable management")


def build_wall_cabinet(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    front = -d / 2
    # A real hollow carcass, not an opaque block behind the glass and shelves.
    for side in (-1, 1):
        box("wall cabinet end gable", (side * (w / 2 - 0.009), 0, h / 2), (0.018, d, h), m["powder"], bevel=0.003, category="cabinet carcass")
    for z in (0.009, h - 0.009):
        box("wall cabinet top bottom", (0, 0, z), (w - 0.036, d, 0.018), m["powder"], bevel=0.003, category="cabinet carcass")
    box("wall cabinet back", (0, d / 2 - 0.009, h / 2), (w - 0.036, 0.018, h - 0.036), m["powder"], bevel=0.003, category="cabinet carcass")
    for z in (h * 0.34, h * 0.66):
        box("wall cabinet shelf", (0, -0.01, z), (w * 0.90, d * 0.82, 0.020), m["stainless"], bevel=0.004, category="shelf")
    for side in (-1, 1):
        x = side * w * 0.245
        prefix = "wall cabinet " + ("left" if side < 0 else "right") + " door"
        for edge in (-1, 1):
            box(prefix + " stile", (x + edge * w * 0.215, front - 0.012, h * 0.51), (w * 0.04, 0.030, h * 0.90), m["porcelain"], bevel=0.003, category="cabinet door")
        for z, label in ((h * 0.08, "lower"), (h * 0.94, "upper")):
            box(prefix + " " + label + " rail", (x, front - 0.012, z), (w * 0.47, 0.030, h * 0.04), m["porcelain"], bevel=0.003, category="cabinet door")
        box(prefix + " glass insert", (x, front - 0.013, h * 0.51), (w * 0.39, 0.008, h * 0.82), m["glass"], bevel=0.002, category="door glazing")
        add_pull(prefix + " pull", x - side * w * 0.17, front - 0.035, h * 0.46, h * 0.20)
    for x in (-w * 0.36, w * 0.36):
        box("wall mounting cleat", (x, d * 0.47, h * 0.52), (0.08, 0.025, h * 0.68), m["zinc"], bevel=0.004, category="wall mounting")


def build_safety_cabinet(spec: AssetSpec, *, flammable: bool) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    front = -d / 2
    body = m["safety_yellow"] if flammable else m["powder_light"]
    box("safety cabinet shell", (0, 0, h * 0.52), (w * 0.98, d * 0.96, h * 0.93), body, bevel=0.020, category="double-wall cabinet")
    box("safety cabinet recessed plinth", (0, 0.02, h * 0.055), (w * 0.88, d * 0.84, h * 0.11), m["shadow"], bevel=0.008, category="plinth")
    for side in (-1, 1):
        x = side * w * 0.245
        box("safety cabinet door", (x, front - 0.012, h * 0.53), (w * 0.47, 0.030, h * 0.80), body, bevel=0.012, category="cabinet door")
        add_pull("safety cabinet pull", x - side * w * 0.15, front - 0.035, h * 0.62, h * 0.22)
        add_vent_slots("safety cabinet", x, front - 0.032, h * 0.24, w * 0.20, rows=4)
    box("safety cabinet label plate", (0, front - 0.034, h * 0.84), (w * 0.34, 0.010, h * 0.10), m["label"], bevel=0.006, category="safety label")
    box("safety cabinet label stripe", (0, front - 0.041, h * 0.84), (w * 0.22, 0.003, h * 0.018), m["bio_red"] if flammable else m["teal"], bevel=0.001, category="safety label")
    for side in (-1, 1):
        cylinder("safety cabinet vent collar", (side * w * 0.34, d * 0.49, h * 0.28), 0.055, 0.030, m["aluminum"], axis=(0, 1, 0), vertices=36, category="vent connection")


def build_mobile_drawer(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    front = -d / 2
    box("mobile drawer carcass", (0, 0, h * 0.52), (w * 0.95, d * 0.92, h * 0.78), m["powder"], bevel=0.015, category="drawer carcass")
    for index in range(4):
        drawer_h = h * (0.135 if index < 3 else 0.19)
        z = h * (0.78 - index * 0.155)
        box(f"mobile drawer {index + 1}", (0, front - 0.012, z), (w * 0.88, 0.026, drawer_h), m["porcelain"], bevel=0.008, category="drawer")
        add_pull(f"mobile drawer pull {index + 1}", 0, front - 0.036, z + drawer_h * 0.22, w * 0.46)
    box("mobile drawer top", (0, 0, h * 0.96), (w, d * 0.96, h * 0.06), m["stainless"], bevel=0.010, category="top")
    add_casters(w, d, z=0.045)


def build_rack(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    for x in (-w * 0.47, w * 0.47):
        for y in (-d * 0.42, d * 0.42):
            box("rack perforated upright", (x, y, h * 0.50), (0.060, 0.060, h), m["aluminum"], bevel=0.008, category="rack frame")
            box("rack base plate", (x, y, 0.018), (0.12, 0.12, 0.036), m["zinc"], bevel=0.006, category="base plate")
    for tier, z in enumerate((h * 0.12, h * 0.34, h * 0.56, h * 0.78, h * 0.94), 1):
        box(f"rack shelf {tier}", (0, 0, z), (w * 0.94, d * 0.88, 0.045), m["stainless"], bevel=0.007, category="shelf")
        box(f"rack front beam {tier}", (0, -d * 0.44, z - 0.03), (w * 0.94, 0.055, 0.10), m["aluminum"], bevel=0.008, category="rack beam")
    tube("rack rear diagonal left", [(-w * 0.44, d * 0.45, h * 0.08), (w * 0.44, d * 0.45, h * 0.92)], 0.018, m["zinc"], category="cross brace")
    tube("rack rear diagonal right", [(w * 0.44, d * 0.45, h * 0.08), (-w * 0.44, d * 0.45, h * 0.92)], 0.018, m["zinc"], category="cross brace")


def build_locker(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    front = -d / 2
    box("locker carcass", (0, 0, h * 0.51), (w * 0.98, d * 0.96, h * 0.94), m["powder"], bevel=0.017, category="locker carcass")
    for index in range(3):
        x = -w * 0.32 + index * w * 0.32
        box(f"locker door {index + 1}", (x, front - 0.012, h * 0.53), (w * 0.305, 0.028, h * 0.84), m["porcelain"], bevel=0.010, category="locker door")
        add_vent_slots(f"locker {index + 1} upper", x, front - 0.031, h * 0.77, w * 0.16, rows=4)
        add_vent_slots(f"locker {index + 1} lower", x, front - 0.031, h * 0.26, w * 0.16, rows=3)
        cylinder(f"locker lock {index + 1}", (x + w * 0.09, front - 0.036, h * 0.53), 0.018, 0.010, m["zinc"], axis=(0, -1, 0), vertices=28, category="lock")
    box("locker recessed plinth", (0, 0.02, h * 0.045), (w * 0.90, d * 0.86, h * 0.09), m["shadow"], bevel=0.006, category="plinth")


def build_pegboard(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    front = -d / 2
    box("pegboard aluminium frame", (0, 0, h / 2), (w, d, h), m["aluminum"], bevel=0.012, category="frame")
    box("pegboard panel", (0, front - 0.004, h / 2), (w * 0.93, 0.025, h * 0.90), m["powder_light"], bevel=0.007, category="perforated panel")
    for row in range(7):
        for col in range(12):
            x = -w * 0.39 + col * w * 0.78 / 11
            z = h * 0.18 + row * h * 0.64 / 6
            cylinder("pegboard perforation", (x, front - 0.020, z), 0.010, 0.010, m["shadow"], axis=(0, -1, 0), vertices=20, category="perforation")
    for x, z in ((-w * 0.22, h * 0.65), (0, h * 0.48), (w * 0.24, h * 0.70)):
        tube("pegboard hook", [(x, front - 0.025, z), (x, front - 0.13, z), (x, front - 0.16, z - 0.04)], 0.008, m["stainless"], category="hook")
    box("pegboard lower tray", (0, front - 0.12, h * 0.09), (w * 0.70, d * 0.72, h * 0.055), m["stainless"], bevel=0.008, category="tool tray")


def build_cold_storage(spec: AssetSpec, *, frozen: bool) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    front = -d / 2
    box("cold-storage insulated chassis", (0, 0, h * 0.51), (w * 0.96, d * 0.95, h * 0.92), m["porcelain"], bevel=0.025, category="insulated chassis")
    box("cold-storage door", (0, front - 0.015, h * 0.57), (w * 0.88, 0.035, h * 0.70), m["powder_light"], bevel=0.018, category="insulated door")
    box("cold-storage gasket", (0, front - 0.036, h * 0.57), (w * 0.81, 0.008, h * 0.63), m["rubber"], bevel=0.012, category="door gasket")
    box("cold-storage inner door panel", (0, front - 0.044, h * 0.57), (w * 0.74, 0.008, h * 0.56), m["porcelain"], bevel=0.010, category="door face")
    tube("cold-storage vertical handle", [(w * 0.34, front - 0.055, h * 0.43), (w * 0.39, front - 0.085, h * 0.43), (w * 0.39, front - 0.085, h * 0.75), (w * 0.34, front - 0.055, h * 0.75)], 0.014, m["aluminum"], category="door handle")
    box("cold-storage control fascia", (0, front - 0.036, h * 0.92), (w * 0.78, 0.025, h * 0.10), m["powder_dark"], bevel=0.010, category="control fascia")
    box("cold-storage display", (-w * 0.18, front - 0.052, h * 0.92), (w * 0.26, 0.008, h * 0.055), m["screen"], bevel=0.006, category="display")
    for index in range(4):
        cylinder("cold-storage control", (w * (0.06 + index * 0.08), front - 0.054, h * 0.92), 0.012, 0.006, m["teal"] if index == 0 else m["zinc"], axis=(0, -1, 0), vertices=24, category="control")
    add_vent_slots("cold-storage compressor", 0, front - 0.032, h * 0.14, w * 0.62, rows=6)
    box("cold-storage rear condenser", (0, d * 0.485, h * 0.50), (w * 0.68, 0.025, h * 0.52), m["shadow"], bevel=0.008, category="rear condenser")
    for z in (h * 0.31, h * 0.42, h * 0.53, h * 0.64, h * 0.75):
        tube("cold-storage condenser coil", [(-w * 0.29, d * 0.505, z), (w * 0.29, d * 0.505, z)], 0.007, m["aluminum"], category="rear condenser")
    box("cold-storage class marker", (-w * 0.27, front - 0.052, h * 0.84), (w * 0.15, 0.006, h * 0.035), m["basket_blue"] if frozen else m["teal"], bevel=0.003, category="temperature marker")
    for x in (-w * 0.38, w * 0.38):
        cylinder("cold-storage leveling foot", (x, -d * 0.32, 0.030), 0.035, 0.050, m["rubber"], vertices=28, category="foot")


def build_basket_tower(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    for x in (-w * 0.40, w * 0.40):
        for y in (-d * 0.38, d * 0.38):
            box("basket tower upright", (x, y, h * 0.52), (0.035, 0.035, h * 0.88), m["aluminum"], bevel=0.006, category="tower frame")
    for tier in range(6):
        z = h * (0.17 + tier * 0.135)
        box("removable basket floor", (0, 0, z), (w * 0.82, d * 0.78, h * 0.035), m["basket_blue"], bevel=0.010, category="basket")
        for side in (-1, 1):
            box("basket side", (side * w * 0.39, 0, z + h * 0.055), (0.022, d * 0.76, h * 0.11), m["basket_blue"], bevel=0.008, category="basket")
        box("basket front lip", (0, -d * 0.37, z + h * 0.045), (w * 0.78, 0.022, h * 0.09), m["basket_blue"], bevel=0.008, category="basket")
        add_pull("basket label pull", 0, -d * 0.40, z + h * 0.045, w * 0.25)
    box("basket tower top", (0, 0, h * 0.96), (w * 0.92, d * 0.90, h * 0.045), m["powder_light"], bevel=0.010, category="top")
    add_casters(w, d, z=0.045)


def build_workstation(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    desk_h = 0.74
    # Original T-leg workstation; construction/cable routing informed by
    # Herman Miller Everywhere specifications, not downloaded product geometry.
    box("laminate desktop", (0, 0, 0.726), (w, d, 0.028), m["desk_surface"], bevel=0.006, category="work surface")
    for x in (-0.590, 0.590):
        box("formed T foot", (x, 0, 0.040), (0.082, 0.620, 0.050), m["powder_light"], bevel=0.010, category="frame")
        for y in (-0.260, 0.260):
            cylinder("adjustable desk glide", (x, y, 0.0075), 0.026, 0.015, m["rubber"], vertices=32, category="foot")
        box("upright steel column", (x, 0.095, 0.379), (0.065, 0.070, 0.628), m["powder_light"], bevel=0.005, category="frame")
        box("desktop support arm", (x, 0, 0.693), (0.065, 0.570, 0.038), m["powder_light"], bevel=0.004, category="frame")
        for y in (-0.210, 0.210):
            box("desktop fixing pad", (x, y, 0.709), (0.110, 0.065, 0.006), m["steel_visible"], bevel=0.002, category="joinery")
    box("frame cross member", (0, 0.095, 0.670), (1.180, 0.050, 0.055), m["powder_light"], bevel=0.004, category="frame")
    box("rear modesty panel", (0, 0.245, 0.500), (1.100, 0.018, 0.285), m["powder_light"], bevel=0.003, category="modesty panel")
    for x in (-0.505, 0.505):
        box("modesty panel fixing", (x, 0.230, 0.674), (0.025, 0.040, 0.080), m["steel_visible"], bevel=0.003, category="joinery")
    box("underdesk cable trough", (0, 0.245, 0.661), (0.880, 0.110, 0.035), m["powder_light"], bevel=0.003, category="cable management")
    cylinder("flush cable port", (0.440, 0.245, 0.740), 0.031, 0.003, m["rubber"], vertices=48, category="cable management")

    monitor_x, monitor_y = -0.090, 0.160
    box("slim monitor aluminum shell", (monitor_x, monitor_y, 1.165), (0.650, 0.024, 0.370), m["aluminum"], bevel=0.008, category="monitor")
    box("monitor perimeter gasket", (monitor_x, monitor_y - 0.014, 1.165), (0.636, 0.006, 0.356), m["rubber"], bevel=0.005, category="display bezel")
    box("low-glare display glass", (monitor_x, monitor_y - 0.018, 1.167), (0.620, 0.003, 0.336), m["screen"], bevel=0.004, category="display")
    box("monitor weighted base", (monitor_x, 0.130, 0.750), (0.270, 0.185, 0.020), m["steel_visible"], bevel=0.007, category="monitor stand")
    box("monitor height column", (monitor_x, 0.185, 0.932), (0.055, 0.036, 0.344), m["aluminum"], bevel=0.006, category="monitor stand")
    box("rear VESA cover", (monitor_x, 0.183, 1.106), (0.115, 0.025, 0.110), m["powder_light"], bevel=0.006, category="rear service")
    cylinder("monitor tilt hinge", (monitor_x, 0.201, 1.106), 0.025, 0.090, m["steel_visible"], axis=(1, 0, 0), vertices=40, category="monitor stand")
    for col in range(16):
        box("rear monitor cooling slot", (monitor_x - 0.235 + col * 0.031, 0.173, 1.278), (0.012, 0.003, 0.040), m["shadow"], bevel=0.002, category="rear service")
    cylinder("monitor power indicator", (monitor_x + 0.280, 0.140, 1.000), 0.002, 0.003, m["teal"], axis=(0, -1, 0), vertices=20, category="display")
    box("keyboard lower shell", (-0.090, -0.145, 0.746), (0.450, 0.142, 0.012), m["steel_visible"], bevel=0.005, category="keyboard")
    for row in range(5):
        for col in range(15):
            if row == 0 and 3 <= col <= 9:
                continue
            box("low-profile keycap", (-0.290 + col * 0.028, -0.199 + row * 0.025, 0.754), (0.023, 0.020, 0.005), m["porcelain"], bevel=0.002, category="keyboard")
    box("keyboard spacebar", (-0.122, -0.199, 0.754), (0.190, 0.020, 0.005), m["porcelain"], bevel=0.002, category="keyboard")
    box("mouse mat", (0.310, -0.140, 0.742), (0.220, 0.200, 0.004), m["powder_dark"], bevel=0.010, category="input devices")
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, location=(0.310, -0.140, 0.761))
    mouse = bpy.context.object
    mouse.name, mouse.scale = "sculpted wireless mouse", (0.030, 0.053, 0.017)
    furniture.assign_material(mouse, m["porcelain"])
    furniture.smooth(mouse)
    furniture.parent_to_root(mouse, "input devices")
    cylinder("mouse scroll wheel", (0.310, -0.158, 0.775), 0.008, 0.007, m["rubber"], axis=(1, 0, 0), vertices=32, category="input devices")

    # A genuine underdesk cradle supports the tower; no floating chassis.
    box("CPU support tray", (0.465, 0.045, 0.120), (0.254, 0.405, 0.020), m["steel_visible"], bevel=0.004, category="CPU cradle")
    for x in (0.344, 0.586):
        box("CPU suspension bracket", (x, 0.110, 0.421), (0.012, 0.065, 0.582), m["steel_visible"], bevel=0.002, category="CPU cradle")
    for x in (0.390, 0.540):
        for y in (-0.090, 0.170):
            cylinder("computer isolation foot", (x, y, 0.135), 0.012, 0.010, m["rubber"], vertices=24, category="computer chassis")
    box("computer enamel enclosure", (0.465, 0.045, 0.335), (0.220, 0.370, 0.390), m["porcelain"], bevel=0.009, category="computer chassis")
    box("tower front inset", (0.465, -0.142, 0.335), (0.201, 0.012, 0.365), m["powder_light"], bevel=0.005, category="computer chassis")
    for row in range(14):
        box("tower intake grille", (0.465, -0.149, 0.215 + row * 0.014), (0.164, 0.003, 0.005), m["shadow"], bevel=0.001, category="ventilation")
    for x in (0.420, 0.450):
        box("front USB port", (x, -0.149, 0.477), (0.015, 0.004, 0.006), m["shadow"], bevel=0.001, category="computer ports")
    cylinder("tower power button", (0.518, -0.150, 0.477), 0.008, 0.003, m["aluminum"], axis=(0, -1, 0), vertices=32, category="computer ports")
    box("rear I/O panel", (0.465, 0.232, 0.386), (0.174, 0.004, 0.150), m["steel_visible"], bevel=0.003, category="rear service")
    for row in range(4):
        box("rear connection socket", (0.420, 0.235, 0.343 + row * 0.023), (0.035, 0.004, 0.009), m["shadow"], bevel=0.001, category="rear service")
    tube("monitor cable harness", [(monitor_x, 0.181, 1.055), (monitor_x, 0.212, 0.940),
        (monitor_x, 0.225, 0.772), (0.120, 0.265, 0.750), (0.440, 0.245, 0.741)], 0.0035, m["rubber"], category="cable management")
    tube("CPU cable to trough", [(0.480, 0.235, 0.410), (0.500, 0.270, 0.470),
        (0.500, 0.270, 0.635), (0.420, 0.260, 0.660)], 0.0035, m["rubber"], category="cable management")


def build_printer(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    front = -d / 2
    box("printer lower chassis", (0, 0, h * 0.32), (w * 0.94, d * 0.90, h * 0.50), m["porcelain"], bevel=0.022, category="printer chassis")
    box("printer scanner body", (0, d * 0.04, h * 0.69), (w * 0.88, d * 0.76, h * 0.28), m["powder_light"], bevel=0.020, category="scanner")
    box("printer scanner lid", (0, d * 0.04, h * 0.87), (w * 0.84, d * 0.70, h * 0.07), m["powder_dark"], bevel=0.015, category="scanner lid")
    box("printer output bay", (0, front - 0.010, h * 0.38), (w * 0.60, 0.045, h * 0.17), m["shadow"], bevel=0.012, category="paper output")
    box("printer output tray", (0, front - d * 0.18, h * 0.28), (w * 0.58, d * 0.38, 0.025), m["powder_dark"], bevel=0.010, rotation=(math.radians(-8), 0, 0), category="paper tray")
    box("printer control panel", (w * 0.27, front - 0.055, h * 0.70), (w * 0.26, 0.025, h * 0.16), m["powder_dark"], bevel=0.010, rotation=(math.radians(-15), 0, 0), category="control panel")
    box("printer display", (w * 0.27, front - 0.071, h * 0.71), (w * 0.18, 0.006, h * 0.10), m["screen"], bevel=0.006, rotation=(math.radians(-15), 0, 0), category="display")
    add_vent_slots("printer rear ventilation", 0, d * 0.456, h * 0.30, w * 0.55, rows=5)


def build_safety_shower(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    cylinder("safety shower floor flange", (0, 0, 0.025), w * 0.12, 0.050, m["steel_visible"], vertices=48, category="floor flange")
    cylinder("safety shower riser", (0, d * 0.28, h * 0.48), 0.032, h * 0.90, m["steel_visible"], vertices=40, category="water riser")
    tube("safety shower overhead arm", [(0, d * 0.28, h * 0.86), (0, d * 0.28, h * 0.95), (0, 0, h * 0.95)], 0.032, m["steel_visible"], category="overhead pipe")
    cone("safety shower head", (0, 0, h * 0.88), w * 0.18, w * 0.07, h * 0.10, m["steel_visible"], category="shower head")
    cylinder("safety shower spray plate", (0, 0, h * 0.825), w * 0.16, 0.018, m["powder_dark"], vertices=48, category="shower head")
    tube("safety shower pull rod", [(w * 0.20, d * 0.22, h * 0.84), (w * 0.20, d * 0.22, h * 0.47)], 0.010, m["steel_visible"], category="activation pull")
    torus("safety shower pull ring", (w * 0.20, d * 0.22, h * 0.42), 0.065, 0.010, m["bio_red"], rotation=(math.pi / 2, 0, 0), category="activation pull")
    cone("eyewash bowl", (0, d * 0.12, h * 0.39), w * 0.18, w * 0.11, h * 0.07, m["steel_visible"], category="eyewash bowl")
    for side in (-1, 1):
        tube("eyewash nozzle stem", [(side * w * 0.07, d * 0.10, h * 0.40), (side * w * 0.07, d * 0.05, h * 0.45)], 0.012, m["steel_visible"], category="eyewash nozzle")
        cylinder("eyewash nozzle", (side * w * 0.07, d * 0.045, h * 0.46), 0.025, 0.032, m["teal"], axis=(0, -0.6, 0.8), vertices=32, category="eyewash nozzle")
    box("emergency identification panel", (0, d * 0.34, h * 0.66), (w * 0.30, 0.018, h * 0.18), m["teal"], bevel=0.012, category="safety sign")
    box("emergency sign cross horizontal", (0, d * 0.328, h * 0.66), (w * 0.17, 0.005, h * 0.035), m["porcelain"], bevel=0.003, category="safety sign")
    box("emergency sign cross vertical", (0, d * 0.328, h * 0.66), (w * 0.045, 0.005, h * 0.13), m["porcelain"], bevel=0.003, category="safety sign")


def build_waste_bin(spec: AssetSpec, *, biological: bool) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    body = m["bio_red"] if biological else m["steel_visible"]
    cone("waste bin tapered body", (0, 0, h * 0.43), w * 0.40, w * 0.46, h * 0.72, body, category="waste container")
    torus("waste bin upper rim", (0, 0, h * 0.80), w * 0.43, 0.018, m["aluminum"], category="lid rim")
    cylinder("waste bin lid", (0, 0, h * 0.83), w * 0.44, h * 0.06, m["powder_dark"] if biological else m["powder_light"], vertices=48, category="lid")
    box("waste bin pedal", (0, -d * 0.44, h * 0.055), (w * 0.26, d * 0.16, h * 0.06), m["rubber"], bevel=0.012, category="foot pedal")
    box("waste bin rear hinge", (0, d * 0.42, h * 0.78), (w * 0.28, d * 0.06, h * 0.09), m["zinc"], bevel=0.009, category="lid hinge")
    box("waste label plate", (0, -d * 0.405, h * 0.49), (w * 0.44, 0.008, h * 0.18), m["label"], bevel=0.010, category="waste label")
    if biological:
        torus("biological waste marker", (0, -d * 0.414, h * 0.49), w * 0.11, 0.015, m["bio_red"], rotation=(math.pi / 2, 0, 0), category="waste label")
        for angle in (0, 2 * math.pi / 3, 4 * math.pi / 3):
            x = math.cos(angle) * w * 0.08
            z = h * 0.49 + math.sin(angle) * w * 0.08
            cylinder("biological waste symbol", (x, -d * 0.420, z), w * 0.035, 0.008, m["bio_red"], axis=(0, -1, 0), vertices=28, category="waste label")
    else:
        box("general waste marker", (0, -d * 0.414, h * 0.49), (w * 0.26, 0.004, h * 0.035), m["teal"], bevel=0.003, category="waste label")


BUILDERS = {
    "structural-column": build_structural_column,
    "corner-lab-bench": build_corner_bench,
    "mobile-bench": build_mobile_bench,
    "office-desk": lambda spec: build_desk(spec, office=True),
    "rectangular-table": lambda spec: build_desk(spec, office=False),
    "wall-cabinet": build_wall_cabinet,
    "chemical-cabinet": lambda spec: build_safety_cabinet(spec, flammable=False),
    "flammable-cabinet": lambda spec: build_safety_cabinet(spec, flammable=True),
    "mobile-drawer": build_mobile_drawer,
    "heavy-duty-rack": build_rack,
    "locker": build_locker,
    "pegboard": build_pegboard,
    "refrigerator-storage": lambda spec: build_cold_storage(spec, frozen=False),
    "freezer-storage": lambda spec: build_cold_storage(spec, frozen=True),
    "plastic-basket-tower": build_basket_tower,
    "computer-workstation": build_workstation,
    "printer": build_printer,
    "safety-shower": build_safety_shower,
    "waste-bin": lambda spec: build_waste_bin(spec, biological=False),
    "biological-waste-bin": lambda spec: build_waste_bin(spec, biological=True),
}


def build_one(spec: AssetSpec, output_dir: Path, save_blend_dir: Path | None) -> dict[str, object]:
    furniture.reset_scene(spec.asset_id)
    furniture.create_root(spec)
    furniture.build_materials()
    casework.add_reference_materials()
    add_catalog_materials()
    BUILDERS[spec.asset_id](spec)

    if furniture.ROOT is not None:
        furniture.ROOT["display_name"] = spec.asset_id.replace("-", " ").title()
        furniture.ROOT["revision"] = "catalog-completion-batch12-r5" if spec.asset_id in {"mobile-bench", "office-desk", "corner-lab-bench", "computer-workstation"} else "catalog-completion-batch12-r2"
        furniture.ROOT["planning_model"] = True
        furniture.ROOT["manufacturer_certified"] = False
        furniture.ROOT["source_note"] = (
            "Original all-sided LabSpace planning geometry; designed from standard laboratory "
            "construction anatomy without logos or downloaded product geometry."
        )
        furniture.ROOT["finish_policy"] = (
            "Porcelain white, powder-coated light gray, satin aluminum and brushed stainless; "
            "dark finishes restricted to worktops, screens, seals, vents and hardware."
        )

    batching, authored = fidelity.fit_to_dimensions(spec)
    if furniture.ROOT is not None:
        furniture.ROOT["authored_bounds_m"] = authored["bounds_m"]["dimensions"]
        furniture.ROOT["mesh_parts"] = authored["mesh_objects"]
        furniture.ROOT["pbr_materials"] = authored["materials"]
        furniture.ROOT["source_part_count"] = batching["source_parts"]
        furniture.ROOT["runtime_material_batches"] = batching["runtime_batches"]

    if save_blend_dir is not None:
        save_blend_dir.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(save_blend_dir / f"{spec.asset_id}.blend"))

    output_path = output_dir / f"{spec.asset_id}.glb"
    furniture.export_glb(output_path)
    if not output_path.exists() or output_path.stat().st_size < 20_000:
        raise RuntimeError(f"GLB output is missing or unexpectedly small: {output_path}")
    imported = {
        "asset_id": spec.asset_id,
        "output": str(output_path),
        "bytes": output_path.stat().st_size,
        "bounds_m": authored["bounds_m"],
        "mesh_objects": authored["mesh_objects"],
        "materials": authored["materials"],
        "triangles": authored["triangles"],
    }
    imported["draco"] = False
    imported["batching"] = batching
    imported["source_scene"] = authored
    return imported


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    save_blend_dir = Path(args.save_blend_dir).resolve() if args.save_blend_dir else None
    selected = ASSETS.values() if args.asset == "all" else (ASSETS[args.asset],)
    results = [build_one(spec, output_dir, save_blend_dir) for spec in selected]
    print("LABSPACE_CATALOG_COMPLETION_BATCH12 " + json.dumps(results, sort_keys=True))


if __name__ == "__main__":
    main()
