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
    run = w * 0.55
    box("corner bench long base", (-w * 0.19, d * 0.27, h * 0.44), (w * 0.62, d * 0.45, h * 0.76), m["powder"], bevel=0.012, category="casework")
    box("corner bench return base", (w * 0.275, -d * 0.17, h * 0.44), (w * 0.45, d * 0.58, h * 0.76), m["powder"], bevel=0.012, category="casework")
    box("corner phenolic long top", (-w * 0.19, d * 0.27, h * 0.96), (w * 0.62, d * 0.48, h * 0.06), m["phenolic"], bevel=0.012, category="worktop")
    box("corner phenolic return top", (w * 0.275, -d * 0.17, h * 0.96), (w * 0.48, d * 0.58, h * 0.06), m["phenolic"], bevel=0.012, category="worktop")
    add_casework_face("corner long", w * 0.56, d * 0.035, h * 0.70)
    for x in (-w * 0.41, w * 0.37):
        box("corner recessed plinth", (x, d * 0.31, 0.06), (run * 0.12, d * 0.31, 0.12), m["shadow"], bevel=0.006, category="plinth")


def build_mobile_bench(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    front = -d / 2
    box("mobile bench chassis", (0, 0, h * 0.48), (w * 0.92, d * 0.86, h * 0.72), m["powder"], bevel=0.016, category="mobile casework")
    box("mobile bench phenolic top", (0, 0, h * 0.95), (w * 0.98, d * 0.95, h * 0.07), m["phenolic"], bevel=0.013, category="worktop")
    add_casework_face("mobile bench", w * 0.86, front - 0.012, h * 0.68, z0=0.14)
    add_casters(w, d)
    tube("mobile bench push rail", [(-w * 0.44, d * 0.42, h * 0.68), (-w * 0.52, d * 0.48, h * 0.68), (-w * 0.52, d * 0.48, h * 0.82)], 0.014, m["stainless"], category="push handle")


def build_desk(spec: AssetSpec, *, office: bool) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    top_material = m["desk_surface"] if office else m["powder_light"]
    box("work surface", (0, 0, h * 0.96), (w * 0.98, d * 0.96, h * 0.08), top_material, bevel=0.018, category="work surface")
    box("underframe", (0, 0.05, h * 0.79), (w * 0.84, d * 0.72, 0.055), m["steel_visible"], bevel=0.010, category="frame")
    for x in (-w * 0.43, w * 0.43):
        for y in (-d * 0.36, d * 0.36):
            box("square tube leg", (x, y, h * 0.43), (0.055, 0.055, h * 0.80), m["steel_visible"], bevel=0.009, category="frame")
            cylinder("leveling foot", (x, y, 0.018), 0.040, 0.030, m["rubber"], vertices=28, category="foot")
    box("rear modesty panel", (0, d * 0.40, h * 0.50), (w * 0.78, 0.020, h * 0.44), m["powder_light"], bevel=0.008, category="modesty panel")
    cylinder("cable grommet", (w * 0.34, d * 0.24, h + 0.004), 0.040, 0.012, m["black"], vertices=40, category="cable management")
    if office:
        box("desk pencil drawer", (w * 0.23, -d * 0.12, h * 0.82), (w * 0.36, d * 0.42, h * 0.10), m["porcelain"], bevel=0.009, category="drawer")
        add_pull("desk drawer pull", w * 0.23, -d * 0.34, h * 0.82, w * 0.16)


def build_wall_cabinet(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    front = -d / 2
    box("wall cabinet carcass", (0, 0, h / 2), (w, d, h), m["powder"], bevel=0.014, category="cabinet carcass")
    for z in (h * 0.34, h * 0.66):
        box("wall cabinet shelf", (0, -0.01, z), (w * 0.90, d * 0.82, 0.020), m["stainless"], bevel=0.004, category="shelf")
    for side in (-1, 1):
        x = side * w * 0.245
        box("wall cabinet framed door", (x, front - 0.012, h * 0.51), (w * 0.47, 0.030, h * 0.90), m["porcelain"], bevel=0.010, category="cabinet door")
        box("wall cabinet glass insert", (x, front - 0.031, h * 0.56), (w * 0.36, 0.008, h * 0.64), m["glass"], bevel=0.009, category="door glazing")
        add_pull("wall cabinet pull", x - side * w * 0.17, front - 0.035, h * 0.46, h * 0.20)
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
    build_desk(AssetSpec(spec.asset_id, w, d, desk_h), office=True)
    box("workstation monitor", (0, d * 0.08, desk_h + 0.34), (w * 0.38, 0.045, h * 0.34), m["powder_dark"], bevel=0.018, rotation=(math.radians(-4), 0, 0), category="monitor")
    box("workstation display glass", (0, d * 0.052, desk_h + 0.34), (w * 0.34, 0.008, h * 0.28), m["screen"], bevel=0.012, rotation=(math.radians(-4), 0, 0), category="display")
    box("monitor stand", (0, d * 0.12, desk_h + 0.13), (0.055, 0.07, h * 0.20), m["aluminum"], bevel=0.009, category="monitor stand")
    box("monitor base", (0, d * 0.10, desk_h + 0.035), (w * 0.22, d * 0.22, 0.025), m["aluminum"], bevel=0.009, category="monitor stand")
    box("keyboard", (0, -d * 0.20, desk_h + 0.045), (w * 0.34, d * 0.20, 0.025), m["powder_dark"], bevel=0.008, rotation=(math.radians(3), 0, 0), category="keyboard")
    for col in range(10):
        for row in range(3):
            box("keyboard key", (-w * 0.13 + col * w * 0.029, -d * 0.23 + row * d * 0.040, desk_h + 0.063), (w * 0.022, d * 0.025, 0.006), m["powder_light"], bevel=0.002, category="keyboard")
    box("computer tower", (w * 0.34, d * 0.18, desk_h * 0.43), (w * 0.18, d * 0.52, desk_h * 0.66), m["porcelain"], bevel=0.015, category="computer chassis")
    add_vent_slots("computer tower", w * 0.34, -d * 0.085, desk_h * 0.30, w * 0.10, rows=6)


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
        furniture.ROOT["revision"] = "catalog-completion-batch12-r2"
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
