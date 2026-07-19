"""Author the LabSpace seating and compact bench-instrument fidelity batch.

The seating follows the black vinyl, five-caster laboratory stools and chairs
visible throughout the supplied Kyushu University Room 809 photographs. The
equipment anatomy is an original, logo-free interpretation of representative
official products: Shimadzu AP analytical and UW/UX top-loading balances,
Yamato BM water baths, Thermo Scientific digital dry baths, and the Scientific
Industries Vortex-Genie 2. Dimensions remain editable planning defaults and
are not manufacturer-certified geometry.

Run with Blender 4.5 LTS in background mode::

    blender --background --factory-startup \
      --python scripts/blender/lab_fidelity_batch6.py -- \
      --output-dir public/models/hero
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
if str(SCRIPT_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIRECTORY))

import lab_casework_batch3 as casework  # noqa: E402
import lab_furniture as furniture  # noqa: E402


AssetSpec = furniture.AssetSpec

ASSETS = {
    "round-stool": AssetSpec("round-stool", 0.440, 0.440, 0.520),
    "laboratory-chair": AssetSpec("laboratory-chair", 0.560, 0.560, 0.920),
    "office-chair": AssetSpec("office-chair", 0.620, 0.620, 0.980),
    "analytical-balance": AssetSpec("analytical-balance", 0.212, 0.411, 0.345),
    "top-loading-balance": AssetSpec("top-loading-balance", 0.190, 0.317, 0.078),
    "water-bath": AssetSpec("water-bath", 0.310, 0.360, 0.230),
    "dry-block-heater": AssetSpec("dry-block-heater", 0.318, 0.200, 0.100),
    "vortex-mixer": AssetSpec("vortex-mixer", 0.122, 0.165, 0.165),
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", choices=("all", *ASSETS.keys()), default="all")
    parser.add_argument("--output-dir", default="public/models/hero")
    parser.add_argument("--save-blend-dir", default="")
    parser.add_argument("--preview-dir", default="")
    return parser.parse_args(argv)


def add_batch_materials() -> None:
    make = furniture.make_material
    furniture.MATERIALS.update(
        {
            "vinyl_black": make(
                "Black laboratory vinyl",
                (0.012, 0.015, 0.016, 1.0),
                roughness=0.31,
                coat=0.23,
                coat_roughness=0.18,
            ),
            "vinyl_edge": make(
                "Worn vinyl seat edge",
                (0.038, 0.041, 0.040, 1.0),
                roughness=0.47,
                coat=0.10,
            ),
            "upholstery_blue": make(
                "Muted laboratory blue upholstery",
                (0.035, 0.125, 0.185, 1.0),
                roughness=0.50,
                coat=0.06,
            ),
            "warm_white": make(
                "Warm instrument polymer",
                (0.73, 0.75, 0.72, 1.0),
                roughness=0.30,
                coat=0.20,
                coat_roughness=0.16,
            ),
            "cool_white": make(
                "Cool instrument polymer",
                (0.82, 0.84, 0.82, 1.0),
                roughness=0.27,
                coat=0.22,
                coat_roughness=0.13,
            ),
            "screen": make(
                "Smoked instrument display glass",
                (0.008, 0.020, 0.026, 1.0),
                roughness=0.13,
                coat=0.42,
                coat_roughness=0.08,
            ),
            "screen_glow": make(
                "Instrument display phosphor",
                (0.025, 0.43, 0.56, 1.0),
                roughness=0.18,
                coat=0.18,
            ),
            "blue_shell": make(
                "Vortex mixer blue powder coat",
                (0.020, 0.20, 0.46, 1.0),
                metallic=0.08,
                roughness=0.27,
                coat=0.24,
                coat_roughness=0.14,
            ),
            "aluminum_block": make(
                "Machined aluminum heat block",
                (0.53, 0.57, 0.58, 1.0),
                metallic=0.92,
                roughness=0.19,
                anisotropy=0.46,
            ),
            "water_deep": casework.make_transmissive_material(
                "Water bath liquid", (0.08, 0.40, 0.48, 0.42), 0.72, 0.10
            ),
            "glass_clear": casework.make_transmissive_material(
                "Analytical balance low iron glass", (0.72, 0.91, 0.94, 0.24), 0.91, 0.045
            ),
        }
    )


def add_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    bevel: float = 0.004,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    category: str = "detail",
) -> bpy.types.Object:
    obj = furniture.add_box(
        name,
        location,
        dimensions,
        material,
        bevel=bevel,
        category=category,
    )
    obj.rotation_euler = rotation
    return obj


def add_sphere(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    category: str = "detail",
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=40,
        ring_count=24,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    furniture.assign_material(obj, material)
    furniture.smooth(obj)
    return furniture.parent_to_root(obj, category)


def add_cylinder_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    material: bpy.types.Material,
    *,
    vertices: int = 32,
    category: str = "hardware",
) -> bpy.types.Object:
    origin = Vector(start)
    target = Vector(end)
    direction = target - origin
    return furniture.add_cylinder(
        name,
        tuple((origin + target) * 0.5),
        radius,
        direction.length,
        material,
        axis=tuple(direction),
        vertices=vertices,
        bevel=min(radius * 0.18, 0.002),
        category=category,
    )


def add_knob(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    material: bpy.types.Material,
) -> None:
    furniture.add_cylinder(
        name,
        location,
        radius,
        depth,
        material,
        axis=(0.0, -1.0, 0.0),
        vertices=40,
        bevel=0.002,
        category="control",
    )
    for angle in range(0, 360, 45):
        theta = math.radians(angle)
        add_box(
            f"{name} grip {angle}",
            (
                location[0] + math.cos(theta) * radius * 0.88,
                location[1] - depth * 0.53,
                location[2] + math.sin(theta) * radius * 0.88,
            ),
            (0.0022, 0.0016, 0.0055),
            furniture.MATERIALS["rubber"],
            bevel=0.0004,
            rotation=(0.0, -theta, 0.0),
            category="control grip",
        )


def add_caster(name: str, x: float, y: float, angle: float, radius: float) -> None:
    m = furniture.MATERIALS
    wheel_width = radius * 0.52
    wheel = furniture.add_cylinder(
        f"{name} wheel",
        (x, y, radius),
        radius,
        wheel_width,
        m["rubber"],
        axis=(-math.sin(angle), math.cos(angle), 0.0),
        vertices=36,
        bevel=radius * 0.10,
        category="caster wheel",
    )
    wheel["caster"] = True
    add_cylinder_between(
        f"{name} axle",
        (
            x - math.sin(angle) * wheel_width * 0.62,
            y + math.cos(angle) * wheel_width * 0.62,
            radius,
        ),
        (
            x + math.sin(angle) * wheel_width * 0.62,
            y - math.cos(angle) * wheel_width * 0.62,
            radius,
        ),
        radius * 0.15,
        m["zinc"],
        vertices=24,
        category="caster axle",
    )
    add_box(
        f"{name} fork",
        (x, y, radius * 1.62),
        (radius * 0.55, radius * 0.75, radius * 0.90),
        m["powder_dark"],
        bevel=radius * 0.10,
        rotation=(0.0, 0.0, angle),
        category="caster fork",
    )


def add_five_star_base(radius: float, hub_z: float, wheel_radius: float) -> None:
    m = furniture.MATERIALS
    furniture.add_cylinder(
        "Five-star base hub",
        (0.0, 0.0, hub_z),
        0.050,
        0.055,
        m["black"],
        vertices=48,
        bevel=0.004,
        category="chair base",
    )
    for index in range(5):
        angle = math.radians(-90.0 + index * 72.0)
        end_radius = radius - wheel_radius * 0.58
        leg_length = end_radius - 0.020
        x = math.cos(angle) * end_radius
        y = math.sin(angle) * end_radius
        add_box(
            f"Star leg {index + 1}",
            (math.cos(angle) * (leg_length * 0.5 + 0.020), math.sin(angle) * (leg_length * 0.5 + 0.020), hub_z),
            (leg_length, 0.030, 0.028),
            m["powder_dark"],
            bevel=0.008,
            rotation=(0.0, 0.0, angle),
            category="chair base",
        )
        add_caster(f"Caster {index + 1}", x, y, angle, wheel_radius)


def add_gas_column(top: float) -> None:
    m = furniture.MATERIALS
    furniture.add_cylinder(
        "Gas-lift outer column",
        (0.0, 0.0, (0.12 + top) * 0.5),
        0.030,
        top - 0.12,
        m["powder_dark"],
        vertices=40,
        bevel=0.003,
        category="chair lift",
    )
    furniture.add_cylinder(
        "Chrome gas-lift ram",
        (0.0, 0.0, top - 0.055),
        0.018,
        0.15,
        m["stainless_bright"],
        vertices=40,
        bevel=0.002,
        category="chair lift",
    )
    add_box(
        "Seat-height lever",
        (0.072, -0.015, top - 0.055),
        (0.105, 0.012, 0.012),
        m["black"],
        bevel=0.004,
        rotation=(0.0, math.radians(-7.0), 0.0),
        category="chair control",
    )


def build_round_stool(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    add_five_star_base(0.205, 0.095, 0.026)
    add_gas_column(0.455)
    casework.add_torus(
        "Chrome circular foot ring",
        (0.0, 0.0, 0.285),
        0.132,
        0.009,
        m["stainless_bright"],
        category="foot ring",
    )
    for index in range(4):
        angle = math.radians(index * 90.0)
        add_cylinder_between(
            f"Foot ring brace {index + 1}",
            (math.cos(angle) * 0.030, math.sin(angle) * 0.030, 0.265),
            (math.cos(angle) * 0.125, math.sin(angle) * 0.125, 0.285),
            0.0045,
            m["stainless_bright"],
            category="foot ring",
        )
    furniture.add_cylinder(
        "Seat rigid underside",
        (0.0, 0.0, 0.465),
        0.170,
        0.030,
        m["black"],
        vertices=64,
        bevel=0.006,
        category="seat shell",
    )
    furniture.add_cylinder(
        "Black vinyl round cushion",
        (0.0, 0.0, 0.495),
        0.188,
        0.050,
        m["vinyl_black"],
        vertices=72,
        bevel=0.010,
        category="seat cushion",
    )
    casework.add_torus(
        "Seat stitched edge welt",
        (0.0, 0.0, 0.492),
        0.177,
        0.0032,
        m["vinyl_edge"],
        category="seat stitching",
    )


def add_chair_seat(width: float, depth: float, z: float, material: bpy.types.Material) -> None:
    m = furniture.MATERIALS
    add_box(
        "Seat pan",
        (0.0, -0.005, z - 0.035),
        (width * 0.92, depth * 0.90, 0.045),
        m["black"],
        bevel=0.014,
        category="seat shell",
    )
    add_box(
        "Upholstered seat cushion",
        (0.0, -0.020, z),
        (width, depth, 0.065),
        material,
        bevel=0.028,
        rotation=(math.radians(-2.5), 0.0, 0.0),
        category="seat cushion",
    )
    for x in (-width * 0.34, width * 0.34):
        add_box(
            f"Seat underside fastener {x:+.3f}",
            (x, 0.090, z - 0.060),
            (0.020, 0.020, 0.008),
            m["zinc"],
            bevel=0.003,
            category="seat hardware",
        )


def build_laboratory_chair(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    add_five_star_base(0.260, 0.100, 0.028)
    add_gas_column(0.535)
    add_chair_seat(0.410, 0.395, 0.570, m["vinyl_black"])
    add_cylinder_between(
        "Backrest lower support",
        (0.0, 0.135, 0.540),
        (0.0, 0.205, 0.735),
        0.014,
        m["stainless_bright"],
        category="back support",
    )
    add_cylinder_between(
        "Backrest upper support",
        (0.0, 0.205, 0.735),
        (0.0, 0.200, 0.790),
        0.017,
        m["black"],
        category="back support",
    )
    add_box(
        "Laboratory chair back shell",
        (0.0, 0.218, 0.805),
        (0.365, 0.050, 0.235),
        m["black"],
        bevel=0.026,
        rotation=(math.radians(-7.0), 0.0, 0.0),
        category="back shell",
    )
    add_box(
        "Laboratory chair back cushion",
        (0.0, 0.190, 0.807),
        (0.340, 0.040, 0.205),
        m["vinyl_black"],
        bevel=0.030,
        rotation=(math.radians(-7.0), 0.0, 0.0),
        category="back cushion",
    )
    add_box(
        "Backrest stitched center channel",
        (0.0, 0.166, 0.807),
        (0.004, 0.003, 0.165),
        m["vinyl_edge"],
        bevel=0.001,
        rotation=(math.radians(-7.0), 0.0, 0.0),
        category="back stitching",
    )


def add_armrest(side: float, z: float, blue: bool = False) -> None:
    m = furniture.MATERIALS
    x = side * 0.245
    add_cylinder_between(
        f"Arm upright {side:+.0f}",
        (side * 0.205, 0.035, z - 0.155),
        (x, 0.015, z - 0.025),
        0.010,
        m["powder_dark"],
        category="armrest frame",
    )
    add_box(
        f"Arm pad {side:+.0f}",
        (x, -0.015, z),
        (0.062, 0.205, 0.035),
        m["upholstery_blue" if blue else "vinyl_black"],
        bevel=0.014,
        category="armrest pad",
    )


def build_office_chair(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    add_five_star_base(0.285, 0.105, 0.030)
    add_gas_column(0.525)
    add_chair_seat(0.465, 0.445, 0.565, m["upholstery_blue"])
    for side in (-1.0, 1.0):
        add_armrest(side, 0.720, blue=True)
    add_cylinder_between(
        "Office back support",
        (0.0, 0.150, 0.525),
        (0.0, 0.235, 0.760),
        0.016,
        m["powder_dark"],
        category="back support",
    )
    add_box(
        "Office chair high-back shell",
        (0.0, 0.230, 0.790),
        (0.435, 0.060, 0.395),
        m["black"],
        bevel=0.035,
        rotation=(math.radians(-8.0), 0.0, 0.0),
        category="back shell",
    )
    add_box(
        "Office chair high-back upholstery",
        (0.0, 0.194, 0.790),
        (0.400, 0.045, 0.365),
        m["upholstery_blue"],
        bevel=0.040,
        rotation=(math.radians(-8.0), 0.0, 0.0),
        category="back cushion",
    )
    for z in (0.675, 0.775, 0.875):
        add_box(
            f"Back upholstery seam {z:.3f}",
            (0.0, 0.169, z),
            (0.330, 0.003, 0.004),
            m["vinyl_edge"],
            bevel=0.001,
            rotation=(math.radians(-8.0), 0.0, 0.0),
            category="back stitching",
        )


def add_instrument_foot(name: str, x: float, y: float, z: float = 0.006) -> None:
    furniture.add_cylinder(
        name,
        (x, y, z),
        0.010,
        z * 2.0,
        furniture.MATERIALS["rubber"],
        vertices=28,
        bevel=0.002,
        category="instrument foot",
    )


def add_display(
    prefix: str,
    center: tuple[float, float, float],
    width: float,
    height: float,
    *,
    accent: str = "screen_glow",
) -> None:
    m = furniture.MATERIALS
    add_box(
        f"{prefix} display bezel",
        center,
        (width, 0.006, height),
        m["black"],
        bevel=0.004,
        category="display",
    )
    add_box(
        f"{prefix} display glass",
        (center[0], center[1] - 0.0035, center[2]),
        (width * 0.82, 0.003, height * 0.62),
        m["screen"],
        bevel=0.002,
        category="display",
    )
    for index in range(4):
        add_box(
            f"{prefix} display segment {index + 1}",
            (
                center[0] - width * 0.25 + index * width * 0.17,
                center[1] - 0.0055,
                center[2],
            ),
            (width * 0.10, 0.0015, height * 0.10),
            m[accent],
            bevel=0.0005,
            category="display graphics",
        )


def add_rear_service_details(width: float, y: float, z: float) -> None:
    m = furniture.MATERIALS
    add_box(
        "Rear service cover",
        (0.0, y, z),
        (width * 0.55, 0.006, 0.045),
        m["powder_dark"],
        bevel=0.003,
        category="rear service panel",
    )
    for index, x in enumerate((-width * 0.18, -width * 0.06, width * 0.06, width * 0.18), 1):
        add_box(
            f"Rear ventilation slot {index}",
            (x, y + 0.0035, z + 0.004),
            (width * 0.065, 0.002, 0.005),
            m["shadow"],
            bevel=0.001,
            category="ventilation",
        )
    add_box(
        "Rear IEC power inlet",
        (width * 0.31, y + 0.0035, z - 0.010),
        (0.030, 0.003, 0.021),
        m["black"],
        bevel=0.002,
        category="power inlet",
    )


def build_analytical_balance(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    add_box(
        "Analytical balance lower chassis",
        (0.0, -0.015, 0.038),
        (0.202, 0.366, 0.076),
        m["warm_white"],
        bevel=0.016,
        category="instrument chassis",
    )
    add_box(
        "Sloped front control fascia",
        (0.0, -0.190, 0.067),
        (0.200, 0.055, 0.092),
        m["cool_white"],
        bevel=0.011,
        rotation=(math.radians(-11.0), 0.0, 0.0),
        category="control fascia",
    )
    add_display("Balance", (0.0, -0.221, 0.075), 0.102, 0.035)
    for index, x in enumerate((-0.071, -0.048, 0.048, 0.071), 1):
        furniture.add_cylinder(
            f"Balance membrane key {index}",
            (x, -0.224, 0.048),
            0.007,
            0.004,
            m["powder_dark" if index in {1, 4} else "blue"],
            axis=(0.0, -1.0, 0.0),
            vertices=28,
            bevel=0.0015,
            category="control key",
        )
    add_box(
        "Weighing chamber floor",
        (0.0, 0.047, 0.086),
        (0.190, 0.235, 0.020),
        m["stainless_dark"],
        bevel=0.006,
        category="weighing chamber",
    )
    furniture.add_cylinder(
        "Analytical weighing pan",
        (0.0, 0.020, 0.105),
        0.046,
        0.010,
        m["stainless_bright"],
        vertices=64,
        bevel=0.003,
        category="weighing pan",
    )
    chamber_bottom = 0.096
    chamber_top = 0.338
    chamber_y = 0.055
    chamber_depth = 0.238
    for x in (-0.094, 0.094):
        add_box(
            f"Glass side panel {x:+.3f}",
            (x, chamber_y, (chamber_bottom + chamber_top) * 0.5),
            (0.004, chamber_depth, chamber_top - chamber_bottom),
            m["glass_clear"],
            bevel=0.001,
            category="draft shield glass",
        )
    add_box(
        "Glass rear panel",
        (0.0, chamber_y + chamber_depth * 0.5, (chamber_bottom + chamber_top) * 0.5),
        (0.190, 0.004, chamber_top - chamber_bottom),
        m["glass_clear"],
        bevel=0.001,
        category="draft shield glass",
    )
    add_box(
        "Sliding front glass pair",
        (0.0, chamber_y - chamber_depth * 0.5, (chamber_bottom + chamber_top) * 0.5),
        (0.190, 0.005, chamber_top - chamber_bottom),
        m["glass_clear"],
        bevel=0.001,
        category="draft shield glass",
    )
    add_box(
        "Draft shield glass roof",
        (0.0, chamber_y, chamber_top),
        (0.194, chamber_depth + 0.006, 0.005),
        m["glass_clear"],
        bevel=0.001,
        category="draft shield glass",
    )
    for x in (-0.098, 0.098):
        for y in (chamber_y - chamber_depth * 0.5, chamber_y + chamber_depth * 0.5):
            add_box(
                f"Draft shield corner post {x:+.3f} {y:+.3f}",
                (x, y, (chamber_bottom + chamber_top) * 0.5),
                (0.007, 0.007, chamber_top - chamber_bottom + 0.005),
                m["aluminum"],
                bevel=0.002,
                category="draft shield frame",
            )
    add_box(
        "Front glass handle",
        (0.0, chamber_y - chamber_depth * 0.5 - 0.004, 0.205),
        (0.052, 0.008, 0.013),
        m["aluminum"],
        bevel=0.003,
        category="draft shield handle",
    )
    add_rear_service_details(0.190, 0.199, 0.060)
    for x in (-0.080, 0.080):
        for y in (-0.150, 0.150):
            add_instrument_foot(f"Analytical balance foot {x:+.2f} {y:+.2f}", x, y)


def build_top_loading_balance(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    add_box(
        "Top-loading balance lower shell",
        (0.0, -0.006, 0.032),
        (0.184, 0.300, 0.060),
        m["cool_white"],
        bevel=0.012,
        category="instrument chassis",
    )
    add_box(
        "Top-loading balance dark belt",
        (0.0, -0.010, 0.054),
        (0.188, 0.294, 0.012),
        m["powder_dark"],
        bevel=0.004,
        category="instrument chassis",
    )
    add_box(
        "Rectangular weighing pan",
        (0.0, 0.048, 0.070),
        (0.142, 0.135, 0.010),
        m["stainless_bright"],
        bevel=0.006,
        category="weighing pan",
    )
    add_box(
        "Front display brow",
        (0.0, -0.151, 0.050),
        (0.178, 0.020, 0.048),
        m["warm_white"],
        bevel=0.006,
        rotation=(math.radians(-16.0), 0.0, 0.0),
        category="control fascia",
    )
    add_display("Top load", (0.0, -0.164, 0.051), 0.082, 0.025)
    for index, x in enumerate((-0.068, -0.050, 0.050, 0.068), 1):
        furniture.add_cylinder(
            f"Top-load key {index}",
            (x, -0.165, 0.037),
            0.0055,
            0.003,
            m["blue" if index in {1, 4} else "black"],
            axis=(0.0, -1.0, 0.0),
            vertices=24,
            bevel=0.001,
            category="control key",
        )
    add_rear_service_details(0.180, 0.151, 0.034)
    for x in (-0.070, 0.070):
        for y in (-0.105, 0.105):
            add_instrument_foot(f"Top-load foot {x:+.2f} {y:+.2f}", x, y, 0.003)


def build_water_bath(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    add_box(
        "Water bath insulated lower shell",
        (0.0, 0.0, 0.092),
        (0.300, 0.348, 0.184),
        m["warm_white"],
        bevel=0.018,
        category="bath chassis",
    )
    add_box(
        "Water bath stainless top deck",
        (0.0, 0.018, 0.190),
        (0.302, 0.315, 0.016),
        m["stainless_bright"],
        bevel=0.008,
        category="bath deck",
    )
    furniture.add_cylinder(
        "Circular bath dark well",
        (0.0, 0.035, 0.196),
        0.119,
        0.020,
        m["stainless_dark"],
        vertices=72,
        bevel=0.003,
        category="bath well",
    )
    furniture.add_cylinder(
        "Visible bath water",
        (0.0, 0.035, 0.206),
        0.108,
        0.006,
        m["water_deep"],
        vertices=72,
        bevel=0.001,
        category="bath water",
    )
    casework.add_torus(
        "Rolled bath rim",
        (0.0, 0.035, 0.213),
        0.120,
        0.007,
        m["stainless_bright"],
        category="bath rim",
    )
    add_box(
        "Water bath front control plinth",
        (0.0, -0.168, 0.104),
        (0.294, 0.030, 0.100),
        m["cool_white"],
        bevel=0.010,
        rotation=(math.radians(-7.0), 0.0, 0.0),
        category="control fascia",
    )
    add_display("Bath", (-0.040, -0.185, 0.118), 0.090, 0.035)
    add_knob("Bath temperature knob", (0.090, -0.186, 0.118), 0.020, 0.011, m["black"])
    furniture.add_cylinder(
        "Bath drain valve",
        (-0.115, -0.184, 0.060),
        0.012,
        0.018,
        m["stainless_dark"],
        axis=(0.0, -1.0, 0.0),
        vertices=28,
        bevel=0.002,
        category="drain valve",
    )
    add_rear_service_details(0.245, 0.176, 0.085)
    for x in (-0.120, 0.120):
        for y in (-0.135, 0.135):
            add_instrument_foot(f"Water bath foot {x:+.2f} {y:+.2f}", x, y)


def add_block_holes(prefix: str, center_x: float, center_y: float) -> None:
    m = furniture.MATERIALS
    for row in range(4):
        for column in range(6):
            x = center_x + (column - 2.5) * 0.014
            y = center_y + (row - 1.5) * 0.014
            furniture.add_cylinder(
                f"{prefix} tube well {row + 1}-{column + 1}",
                (x, y, 0.094),
                0.0042,
                0.012,
                m["shadow"],
                vertices=24,
                category="heat block well",
            )
    for column, color in ((1, "blue"), (4, "green")):
        x = center_x + (column - 2.5) * 0.014
        y = center_y - 1.5 * 0.014
        furniture.add_cylinder(
            f"{prefix} sample tube {column}",
            (x, y, 0.104),
            0.0035,
            0.024,
            m[color],
            vertices=24,
            bevel=0.001,
            category="sample tube",
        )


def build_dry_block_heater(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    add_box(
        "Dry bath powder-coated body",
        (0.0, 0.0, 0.043),
        (0.308, 0.192, 0.086),
        m["cool_white"],
        bevel=0.012,
        category="instrument chassis",
    )
    for center_x, prefix in ((-0.081, "Left block"), (0.041, "Right block")):
        add_box(
            f"{prefix} machined insert",
            (center_x, 0.025, 0.087),
            (0.108, 0.112, 0.022),
            m["aluminum_block"],
            bevel=0.004,
            category="heat block",
        )
        add_block_holes(prefix, center_x, 0.025)
    add_box(
        "Dry bath front control fascia",
        (0.112, -0.095, 0.052),
        (0.082, 0.015, 0.060),
        m["powder_dark"],
        bevel=0.005,
        category="control fascia",
    )
    add_display("Dry bath", (0.112, -0.104, 0.062), 0.054, 0.020)
    for index, x in enumerate((0.090, 0.112, 0.134), 1):
        furniture.add_cylinder(
            f"Dry bath membrane key {index}",
            (x, -0.104, 0.036),
            0.005,
            0.003,
            m["blue" if index == 2 else "black"],
            axis=(0.0, -1.0, 0.0),
            vertices=24,
            bevel=0.001,
            category="control key",
        )
    add_rear_service_details(0.270, 0.097, 0.043)
    for x in (-0.130, 0.130):
        for y in (-0.070, 0.070):
            add_instrument_foot(f"Dry bath foot {x:+.2f} {y:+.2f}", x, y, 0.004)


def build_vortex_mixer(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    add_box(
        "Vortex mixer weighted base",
        (0.0, 0.0, 0.043),
        (0.118, 0.157, 0.086),
        m["blue_shell"],
        bevel=0.014,
        category="mixer chassis",
    )
    add_box(
        "Vortex mixer upper shoulder",
        (0.0, 0.018, 0.099),
        (0.103, 0.118, 0.046),
        m["blue_shell"],
        bevel=0.012,
        rotation=(math.radians(-4.0), 0.0, 0.0),
        category="mixer chassis",
    )
    furniture.add_cylinder(
        "Eccentric drive collar",
        (0.0, 0.020, 0.126),
        0.033,
        0.025,
        m["black"],
        vertices=48,
        bevel=0.004,
        category="mixer drive",
    )
    furniture.add_cylinder(
        "Pop-off rubber mixing cup",
        (0.0, 0.020, 0.151),
        0.028,
        0.030,
        m["rubber"],
        vertices=48,
        bevel=0.006,
        category="mixing cup",
    )
    casework.add_torus(
        "Mixing cup rolled lip",
        (0.0, 0.020, 0.164),
        0.022,
        0.004,
        m["vinyl_edge"],
        category="mixing cup",
    )
    add_knob("Variable speed control", (0.028, -0.081, 0.057), 0.017, 0.010, m["black"])
    add_box(
        "Three-position power switch",
        (-0.034, -0.082, 0.056),
        (0.020, 0.010, 0.034),
        m["black"],
        bevel=0.004,
        rotation=(math.radians(6.0), 0.0, 0.0),
        category="power switch",
    )
    add_box(
        "Power switch indicator",
        (-0.034, -0.088, 0.067),
        (0.008, 0.003, 0.010),
        m["green"],
        bevel=0.001,
        category="indicator",
    )
    for side in (-1.0, 1.0):
        for index in range(4):
            add_box(
                f"Vortex side vent {side:+.0f}-{index + 1}",
                (side * 0.0595, 0.025 + index * 0.018, 0.048),
                (0.003, 0.010, 0.004),
                m["shadow"],
                bevel=0.001,
                category="ventilation",
            )
    add_rear_service_details(0.090, 0.079, 0.044)
    for x in (-0.042, 0.042):
        for y in (-0.060, 0.060):
            add_instrument_foot(f"Vortex foot {x:+.2f} {y:+.2f}", x, y, 0.004)


BUILDERS = {
    "round-stool": build_round_stool,
    "laboratory-chair": build_laboratory_chair,
    "office-chair": build_office_chair,
    "analytical-balance": build_analytical_balance,
    "top-loading-balance": build_top_loading_balance,
    "water-bath": build_water_bath,
    "dry-block-heater": build_dry_block_heater,
    "vortex-mixer": build_vortex_mixer,
}


def fit_to_dimensions(spec: AssetSpec) -> tuple[dict[str, int], dict[str, object]]:
    assert furniture.ROOT is not None
    batching = furniture.consolidate_static_meshes_by_material()
    minimum, maximum = furniture.mesh_bounds()
    dimensions = maximum - minimum
    furniture.ROOT.scale = tuple(
        target / current
        for target, current in zip((spec.width, spec.depth, spec.height), dimensions)
    )
    bpy.context.view_layer.update()
    minimum, maximum = furniture.mesh_bounds()
    furniture.ROOT.location += Vector(
        (-(minimum.x + maximum.x) * 0.5, -(minimum.y + maximum.y) * 0.5, -minimum.z)
    )
    bpy.context.view_layer.update()
    return batching, furniture.authored_statistics(spec)


def validate_statistics(spec: AssetSpec, stats: dict[str, object], *, imported: bool) -> None:
    bounds = stats["bounds_m"]
    dimensions = bounds["dimensions"]
    minimum = bounds["min"]
    maximum = bounds["max"]
    errors: list[str] = []
    for label, actual, expected in zip(
        ("width", "depth", "height"),
        dimensions,
        (spec.width, spec.depth, spec.height),
    ):
        if abs(actual - expected) > 0.006:
            errors.append(f"{label} {actual:.4f} m differs from {expected:.4f} m")
    if abs(minimum[2]) > 0.002:
        errors.append(f"minimum z {minimum[2]:.6f} m is not grounded")
    if abs((minimum[0] + maximum[0]) * 0.5) > 0.002:
        errors.append("x footprint is not centered")
    if abs((minimum[1] + maximum[1]) * 0.5) > 0.002:
        errors.append("y footprint is not centered")
    if stats["mesh_objects"] > 24:
        errors.append(f"{stats['mesh_objects']} runtime meshes exceeds the 24-mesh target")
    if stats["mesh_objects"] < 6:
        errors.append(f"only {stats['mesh_objects']} runtime material batches")
    if stats["materials"] < 6:
        errors.append(f"only {stats['materials']} exported PBR materials")
    if stats["triangles"] < 1200:
        errors.append(f"only {stats['triangles']} triangles")
    if imported:
        disallowed = [
            obj.name for obj in bpy.context.scene.objects if obj.type in {"CAMERA", "LIGHT"}
        ]
        if disallowed:
            errors.append(f"export contains cameras/lights: {disallowed}")
    if errors:
        phase = "imported GLB" if imported else "authored scene"
        raise RuntimeError(f"{spec.asset_id} {phase} validation failed: {'; '.join(errors)}")


def inspect_export(spec: AssetSpec, path: Path) -> dict[str, object]:
    if not path.exists() or path.stat().st_size < 45_000:
        raise RuntimeError(f"GLB output is missing or unexpectedly small: {path}")
    furniture.reset_scene()
    result = bpy.ops.import_scene.gltf(filepath=str(path))
    if "FINISHED" not in result:
        raise RuntimeError(f"Fresh GLB import failed: {result}")
    stats = furniture.authored_statistics(spec)
    stats["bytes"] = path.stat().st_size
    stats["output"] = str(path)
    validate_statistics(spec, stats, imported=True)
    return stats


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_preview_light(
    name: str,
    target: Vector,
    offset: tuple[float, float, float],
    energy: float,
    size: float,
    color: tuple[float, float, float],
) -> None:
    data = bpy.data.lights.new(name=name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = target + Vector(offset)
    look_at(obj, target)


def render_qa_views(spec: AssetSpec, output_dir: Path) -> list[str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 720
    scene.render.resolution_y = 560
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.035, 0.040, 0.047)

    minimum, maximum = furniture.mesh_bounds()
    center = (minimum + maximum) * 0.5
    dimensions = maximum - minimum
    scale = max(dimensions.x, dimensions.y, dimensions.z)

    floor_material = furniture.make_material(
        "QA neutral studio floor", (0.11, 0.12, 0.13, 1.0), roughness=0.58
    )
    bpy.ops.mesh.primitive_plane_add(size=max(scale * 5.0, 1.0), location=(0.0, 0.0, -0.002))
    floor = bpy.context.object
    floor.name = "QA studio floor - not exported"
    furniture.assign_material(floor, floor_material)

    add_preview_light(
        "QA key", center, (-1.7 * scale, -1.9 * scale, 2.4 * scale), 520.0 * scale * scale, 1.5 * scale, (1.0, 0.93, 0.84)
    )
    add_preview_light(
        "QA fill", center, (1.7 * scale, -0.3 * scale, 1.4 * scale), 320.0 * scale * scale, 1.2 * scale, (0.78, 0.88, 1.0)
    )
    add_preview_light(
        "QA rim", center, (0.2 * scale, 1.8 * scale, 2.0 * scale), 420.0 * scale * scale, 1.0 * scale, (0.84, 0.94, 1.0)
    )

    directions = {
        "isometric": Vector((1.25, -1.50, 1.05)),
        "front": Vector((0.0, -1.0, 0.18)),
        "rear": Vector((0.0, 1.0, 0.18)),
        "left": Vector((-1.0, 0.0, 0.18)),
        "right": Vector((1.0, 0.0, 0.18)),
        "top": Vector((0.0, 0.0, 1.0)),
    }
    camera_data = bpy.data.cameras.new("QA orbit camera")
    camera_data.type = "ORTHO"
    camera = bpy.data.objects.new("QA orbit camera", camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera
    paths: list[str] = []
    for view, direction in directions.items():
        camera.location = center + direction.normalized() * max(scale * 4.5, 1.5)
        if view == "top":
            camera.rotation_euler = (0.0, 0.0, 0.0)
            camera_data.ortho_scale = max(dimensions.x, dimensions.y) * 1.38
        else:
            look_at(camera, center)
            # Isometric projections can be materially taller than any single model
            # axis because both depth and height contribute to the screen-space
            # extent. A scale-derived safe frame keeps all six QA views useful for
            # all-sided inspection instead of turning them into cropped beauty shots.
            horizontal = dimensions.x if view in {"front", "rear"} else dimensions.y
            camera_data.ortho_scale = max(
                scale * 1.65,
                dimensions.z * 1.34,
                horizontal / (720 / 560) * 1.34,
            )
        camera_data.clip_start = 0.001
        camera_data.clip_end = max(scale * 10.0, 10.0)
        output = output_dir / f"{spec.asset_id}-{view}.png"
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        paths.append(str(output))
    return paths


def build_one(
    spec: AssetSpec,
    output_dir: Path,
    save_blend_dir: Path | None,
    preview_dir: Path | None,
) -> dict[str, object]:
    furniture.reset_scene(spec.asset_id)
    furniture.create_root(spec)
    furniture.build_materials()
    casework.add_reference_materials()
    add_batch_materials()
    BUILDERS[spec.asset_id](spec)

    if furniture.ROOT is not None:
        furniture.ROOT["display_name"] = spec.asset_id.replace("-", " ").title()
        furniture.ROOT["revision"] = "fidelity-batch6-r1"
        furniture.ROOT["planning_model"] = True
        furniture.ROOT["manufacturer_certified"] = False
        furniture.ROOT["source_note"] = (
            "Original LabSpace geometry informed by supplied Room 809 photos and "
            "representative official manufacturer anatomy; no logos or downloaded geometry."
        )

    batching, authored = fit_to_dimensions(spec)
    validate_statistics(spec, authored, imported=False)
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
    imported = inspect_export(spec, output_path)
    if preview_dir is not None:
        imported["previews"] = render_qa_views(spec, preview_dir)
    imported["draco"] = False
    imported["batching"] = batching
    imported["source_scene"] = authored
    return imported


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    save_blend_dir = Path(args.save_blend_dir).resolve() if args.save_blend_dir else None
    preview_dir = Path(args.preview_dir).resolve() if args.preview_dir else None
    selected = ASSETS.values() if args.asset == "all" else (ASSETS[args.asset],)
    results = [
        build_one(spec, output_dir, save_blend_dir, preview_dir) for spec in selected
    ]
    print("LABSPACE_FIDELITY_BATCH6_BUILD " + json.dumps(results, sort_keys=True))


if __name__ == "__main__":
    main()
