"""Author six reference-driven, all-sided LabSpace laboratory instruments.

The geometry is original and logo-free. Overall envelopes and visible anatomy
are informed by official documentation for the Thermo Scientific Sorvall LYNX,
Yamato IN604, Eppendorf Innova S44i, Bio-Rad T100, Thermo Scientific
QuantStudio 5, and PHCbi MPR-722R. These are editable planning assets rather
than manufacturer-certified replicas.

Run with Blender 4.5 LTS in background mode::

    blender --background --factory-startup \
      --python scripts/blender/lab_instruments_batch10.py -- \
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
import lab_fidelity_batch6 as batch6  # noqa: E402
import lab_fidelity_batch7 as batch7  # noqa: E402
import lab_furniture as furniture  # noqa: E402


AssetSpec = furniture.AssetSpec

ASSETS = {
    "floor-centrifuge": AssetSpec("floor-centrifuge", 0.700, 0.805, 1.048),
    "incubator": AssetSpec("incubator", 0.710, 0.645, 0.913),
    "shaking-incubator": AssetSpec("shaking-incubator", 1.182, 0.958, 0.938),
    "pcr-machine": AssetSpec("pcr-machine", 0.260, 0.470, 0.230),
    "real-time-pcr": AssetSpec("real-time-pcr", 0.270, 0.500, 0.400),
    "lab-refrigerator": AssetSpec("lab-refrigerator", 0.770, 0.830, 1.955),
}

SOURCE_NOTES = {
    "floor-centrifuge": "Thermo Scientific Sorvall LYNX-class floor centrifuge anatomy and envelope",
    "incubator": "Yamato IN604-class forced-air incubator anatomy and envelope",
    "shaking-incubator": "Eppendorf Innova S44i-class incubator shaker with tall floor base",
    "pcr-machine": "Bio-Rad T100-class conventional thermal cycler anatomy and envelope",
    "real-time-pcr": "Thermo Scientific QuantStudio 5-class real-time PCR system anatomy and envelope",
    "lab-refrigerator": "PHCbi MPR-722R-class pharmaceutical refrigerator anatomy and envelope",
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
            "refrigerator_glass": casework.make_transmissive_material(
                "Low iron refrigerator glazing", (0.66, 0.86, 0.90, 0.22), 0.90, 0.055
            ),
            "incubator_glass": casework.make_transmissive_material(
                "Smoked incubator observation glazing", (0.16, 0.28, 0.31, 0.42), 0.62, 0.11
            ),
            "drawer_polymer": casework.make_transmissive_material(
                "Translucent refrigerator drawer polymer", (0.72, 0.86, 0.88, 0.34), 0.76, 0.17
            ),
            "chamber_stainless": make(
                "Clean brushed chamber stainless",
                (0.66, 0.70, 0.70, 1.0),
                metallic=0.94,
                roughness=0.24,
                anisotropy=0.66,
            ),
            "control_blue": make(
                "Restrained laboratory control blue",
                (0.03, 0.30, 0.54, 1.0),
                roughness=0.24,
                coat=0.18,
            ),
            "coolant_teal": make(
                "Cool process status teal",
                (0.02, 0.48, 0.53, 1.0),
                roughness=0.19,
                coat=0.20,
            ),
        }
    )


def box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    bevel: float = 0.005,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    category: str = "detail",
) -> bpy.types.Object:
    return batch7.box(
        name,
        location,
        dimensions,
        material,
        bevel=bevel,
        rotation=rotation,
        category=category,
    )


def cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    material: bpy.types.Material,
    *,
    axis: tuple[float, float, float] = (0.0, 0.0, 1.0),
    vertices: int = 36,
    category: str = "detail",
) -> bpy.types.Object:
    return batch7.cylinder(
        name,
        location,
        radius,
        depth,
        material,
        axis=axis,
        vertices=vertices,
        category=category,
    )


def tube(
    name: str,
    points: list[tuple[float, float, float]],
    radius: float,
    material: bpy.types.Material,
    *,
    category: str = "hardware",
) -> bpy.types.Object:
    return casework.add_curve_tube(name, points, radius, material, category=category)


def torus(
    name: str,
    location: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    material: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    category: str = "hardware",
) -> bpy.types.Object:
    return casework.add_torus(
        name,
        location,
        major_radius,
        minor_radius,
        material,
        rotation=rotation,
        category=category,
    )


def add_feet(width: float, depth: float, *, radius: float = 0.012) -> None:
    batch7.add_feet(width, depth, radius=radius)


def add_front_display(
    prefix: str,
    center: tuple[float, float, float],
    width: float,
    height: float,
    *,
    readout_rows: int = 3,
    key_count: int = 4,
) -> None:
    m = furniture.MATERIALS
    x, y, z = center
    box(
        f"{prefix} display bezel",
        center,
        (width, 0.011, height),
        m["display_glass"],
        bevel=min(0.012, height * 0.12),
        category="display",
    )
    box(
        f"{prefix} active display",
        (x - width * 0.08, y - 0.006, z + height * 0.03),
        (width * 0.66, 0.002, height * 0.66),
        m["screen"],
        bevel=0.002,
        category="display",
    )
    for row in range(readout_rows):
        box(
            f"{prefix} readout {row + 1}",
            (x - width * 0.12, y - 0.0075, z + height * (0.20 - row * 0.19)),
            (width * (0.30 if row == 0 else 0.22), 0.001, height * 0.045),
            m["display_teal"],
            bevel=0.0005,
            category="display graphics",
        )
    key_x = x + width * 0.36
    spacing = height * 0.72 / max(1, key_count - 1)
    for index in range(key_count):
        cylinder(
            f"{prefix} key {index + 1}",
            (key_x, y - 0.008, z + height * 0.36 - index * spacing),
            min(0.009, height * 0.065),
            0.004,
            m["light_aluminum"],
            axis=(0.0, -1.0, 0.0),
            vertices=24,
            category="control",
        )


def add_vent_rows(
    prefix: str,
    center: tuple[float, float, float],
    span: float,
    rows: int,
    columns: int,
    *,
    face: str = "front",
    slot_height: float = 0.009,
) -> None:
    m = furniture.MATERIALS
    cx, cy, cz = center
    x_step = span / max(columns, 1)
    for row in range(rows):
        for column in range(columns):
            x_offset = (column - (columns - 1) / 2) * x_step
            z_offset = (row - (rows - 1) / 2) * slot_height * 1.85
            if face in {"left", "right"}:
                location = (cx, cy + x_offset, cz + z_offset)
                dimensions = (0.003, x_step * 0.62, slot_height)
            else:
                location = (cx + x_offset, cy, cz + z_offset)
                dimensions = (x_step * 0.62, 0.003, slot_height)
            box(
                f"{prefix} vent r{row + 1:02d} c{column + 1:02d}",
                location,
                dimensions,
                m["shadow"],
                bevel=0.001,
                category="ventilation",
            )


def add_fasteners(
    prefix: str,
    coordinates: list[tuple[float, float, float]],
    *,
    axis: tuple[float, float, float] = (0.0, -1.0, 0.0),
    radius: float = 0.004,
) -> None:
    m = furniture.MATERIALS
    for index, coordinate in enumerate(coordinates, 1):
        cylinder(
            f"{prefix} fastener {index}",
            coordinate,
            radius,
            0.003,
            m["zinc"],
            axis=axis,
            vertices=20,
            category="fastener",
        )


def add_rear_service_cover(
    prefix: str,
    width: float,
    depth: float,
    center_z: float,
    height: float,
    *,
    vent_rows: int = 2,
) -> None:
    m = furniture.MATERIALS
    y = depth / 2 + 0.002
    box(
        f"{prefix} rear removable service cover",
        (0.0, y, center_z),
        (width * 0.72, 0.006, height),
        m["instrument_gray"],
        bevel=0.004,
        category="rear service panel",
    )
    add_vent_rows(
        f"{prefix} rear",
        (0.0, y + 0.004, center_z + height * 0.14),
        width * 0.50,
        vent_rows,
        8,
        slot_height=max(0.006, height * 0.035),
    )
    for index, x in enumerate((-0.12, -0.04, 0.04, 0.12), 1):
        cylinder(
            f"{prefix} rear service connector {index}",
            (x * min(1.0, width / 0.34), y + 0.008, center_z - height * 0.28),
            0.009,
            0.010,
            m["silver"],
            axis=(0.0, 1.0, 0.0),
            vertices=24,
            category="rear connector",
        )


def add_caster(name: str, x: float, y: float, radius: float, angle: float = 0.0) -> None:
    batch6.add_caster(name, x, y, angle, radius)


def build_floor_centrifuge(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    box(
        "LYNX formed lower chassis",
        (0.0, 0.010, h * 0.43),
        (w * 0.94, d * 0.94, h * 0.82),
        m["instrument_white"],
        bevel=0.038,
        category="refrigerated instrument chassis",
    )
    box(
        "LYNX lower silver plinth",
        (0.0, 0.020, h * 0.075),
        (w * 0.95, d * 0.92, h * 0.105),
        m["light_aluminum"],
        bevel=0.015,
        category="plinth",
    )
    box(
        "LYNX upper shoulder",
        (0.0, -0.012, h * 0.84),
        (w * 0.91, d * 0.89, h * 0.20),
        m["instrument_gray"],
        bevel=0.040,
        category="upper rotor housing",
    )
    box(
        "LYNX top deck",
        (0.0, -0.015, h * 0.952),
        (w * 0.90, d * 0.86, h * 0.072),
        m["instrument_white"],
        bevel=0.022,
        category="upper rotor housing",
    )
    lid_y = 0.015
    torus(
        "LYNX rotor lid stainless ring",
        (0.0, lid_y, h * 0.991),
        w * 0.285,
        0.014,
        m["silver"],
        category="rotor lid hardware",
    )
    cylinder(
        "LYNX insulated circular rotor lid",
        (0.0, lid_y, h * 0.994),
        w * 0.272,
        h * 0.050,
        m["instrument_white"],
        vertices=72,
        category="rotor lid",
    )
    tube(
        "LYNX lid lift handle",
        [(-0.100, -0.175, h * 1.011), (-0.100, -0.225, h * 1.032), (0.100, -0.225, h * 1.032), (0.100, -0.175, h * 1.011)],
        0.010,
        m["silver"],
        category="lid handle",
    )
    front = -d / 2 - 0.003
    box(
        "LYNX sloped control console",
        (0.0, front, h * 0.675),
        (w * 0.72, 0.054, h * 0.235),
        m["light_aluminum"],
        bevel=0.020,
        rotation=(math.radians(-6.0), 0.0, 0.0),
        category="control console",
    )
    add_front_display("LYNX", (0.0, front - 0.031, h * 0.700), w * 0.50, h * 0.145, key_count=5)
    cylinder(
        "LYNX primary selector",
        (w * 0.245, front - 0.035, h * 0.625),
        0.024,
        0.018,
        m["silver"],
        axis=(0.0, -1.0, 0.0),
        vertices=40,
        category="control",
    )
    box(
        "LYNX front refrigeration grille surround",
        (0.0, front - 0.004, h * 0.245),
        (w * 0.70, 0.012, h * 0.285),
        m["instrument_gray"],
        bevel=0.012,
        category="refrigeration grille",
    )
    add_vent_rows("LYNX front refrigeration", (0.0, front - 0.012, h * 0.245), w * 0.58, 7, 12, slot_height=0.011)
    for side in (-1.0, 1.0):
        x = side * (w / 2 + 0.002)
        box(
            f"LYNX side access panel {side:+.0f}",
            (x, 0.055, h * 0.49),
            (0.006, d * 0.46, h * 0.39),
            m["instrument_gray"],
            bevel=0.004,
            category="side service panel",
        )
        add_vent_rows(f"LYNX side {side:+.0f}", (x + side * 0.004, 0.06, h * 0.42), d * 0.30, 5, 7, face="right", slot_height=0.010)
        cylinder(
            f"LYNX emergency lid release {side:+.0f}",
            (x + side * 0.005, -d * 0.20, h * 0.67),
            0.012,
            0.008,
            m["silver"],
            axis=(side, 0.0, 0.0),
            vertices=24,
            category="safety release",
        )
    add_rear_service_cover("LYNX", w, d, h * 0.42, h * 0.54, vent_rows=4)
    add_feet(w * 0.88, d * 0.88, radius=0.026)


def build_incubator(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    box(
        "IN604 light powder outer cabinet",
        (0.0, 0.010, h * 0.49),
        (w * 0.97, d * 0.95, h * 0.94),
        m["instrument_white"],
        bevel=0.025,
        category="forced-air incubator cabinet",
    )
    front = -d / 2 - 0.003
    door_z = h * 0.475
    door_h = h * 0.72
    box(
        "IN604 insulated front door",
        (0.0, front, door_z),
        (w * 0.86, 0.036, door_h),
        m["instrument_gray"],
        bevel=0.018,
        category="insulated door",
    )
    # Fine perimeter reveal and substantial right-side pull make the door read as
    # a manufactured insulated assembly rather than a box pasted on the front.
    for x in (-w * 0.435, w * 0.435):
        box(f"IN604 door side seal {x:+.3f}", (x, front - 0.021, door_z), (0.010, 0.008, door_h * 0.94), m["rubber"], bevel=0.003, category="door gasket")
    for z in (door_z - door_h * 0.47, door_z + door_h * 0.47):
        box(f"IN604 door end seal {z:.3f}", (0.0, front - 0.021, z), (w * 0.86, 0.008, 0.010), m["rubber"], bevel=0.003, category="door gasket")
    tube(
        "IN604 vertical door pull",
        [(w * 0.345, front - 0.050, h * 0.31), (w * 0.390, front - 0.070, h * 0.34), (w * 0.390, front - 0.070, h * 0.67), (w * 0.345, front - 0.050, h * 0.70)],
        0.012,
        m["silver"],
        category="door handle",
    )
    for z in (h * .31, h * .70):
        box("IN604 handle mounting foot", (w * .345, front - .031, z),
            (.032, .034, .032), m["silver"], bevel=.003, category="door handle mount")
    for index, z in enumerate((h * 0.28, h * 0.68), 1):
        cylinder(f"IN604 left hinge {index}", (-w * 0.44, front - 0.016, z), 0.018, 0.060, m["silver"], axis=(0.0, 0.0, 1.0), vertices=30, category="door hinge")
    box(
        "IN604 upper control fascia",
        (0.0, front - 0.006, h * 0.878),
        (w * 0.90, 0.026, h * 0.105),
        m["light_aluminum"],
        bevel=0.010,
        category="control fascia",
    )
    add_front_display("IN604", (-w * 0.12, front - 0.024, h * 0.882), w * 0.38, h * 0.063, readout_rows=2, key_count=4)
    for index, x in enumerate((w * 0.16, w * 0.22, w * 0.28), 1):
        batch7.add_round_button(f"IN604 status button {index}", x, front - 0.030, h * 0.881, m[("status_green", "display_teal", "status_orange")[index - 1]], radius=0.010)
    box(
        "IN604 lower air intake surround",
        (0.0, front - 0.008, h * 0.075),
        (w * 0.72, 0.018, h * 0.085),
        m["instrument_gray"],
        bevel=0.008,
        category="air intake",
    )
    add_vent_rows("IN604 lower air intake", (0.0, front - 0.019, h * 0.075), w * 0.59, 3, 12, slot_height=0.008)
    # Official right-side cable port.
    side_x = w / 2 + 0.003
    torus("IN604 32 mm cable port bezel", (side_x, 0.030, h * 0.56), 0.023, 0.005, m["silver"], rotation=(0.0, math.pi / 2, 0.0), category="side cable port")
    cylinder("IN604 cable port plug", (side_x + 0.004, 0.030, h * 0.56), 0.018, 0.007, m["rubber"], axis=(1.0, 0.0, 0.0), vertices=32, category="side cable port")
    add_vent_rows("IN604 right circulation", (side_x + 0.004, d * 0.15, h * 0.29), d * 0.32, 5, 7, face="right", slot_height=0.009)
    add_rear_service_cover("IN604", w, d, h * 0.42, h * 0.66, vent_rows=4)
    box("IN604 top exhaust plenum", (0.0, d * 0.12, h * 0.974), (w * 0.42, d * 0.24, h * 0.032), m["light_aluminum"], bevel=0.009, category="airflow plenum")
    add_vent_rows("IN604 top exhaust", (0.0, d * 0.12, h * 0.991), w * 0.30, 1, 10, slot_height=0.009)
    add_feet(w * 0.90, d * 0.88, radius=0.018)


def build_shaking_incubator(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    base_h = h * 0.325
    box(
        "S44i tall floor base",
        (0.0, 0.035, base_h / 2),
        (w * 0.94, d * 0.88, base_h),
        m["instrument_gray"],
        bevel=0.026,
        category="floor base",
    )
    box(
        "S44i vibration isolation plinth",
        (0.0, 0.030, h * 0.055),
        (w * 0.96, d * 0.90, h * 0.080),
        m["light_aluminum"],
        bevel=0.015,
        category="isolation plinth",
    )
    box(
        "S44i incubation chamber chassis",
        (0.0, 0.015, base_h + (h - base_h) * 0.50),
        (w * 0.98, d * 0.95, h - base_h),
        m["instrument_white"],
        bevel=0.052,
        category="incubation chamber",
    )
    front = -d / 2 - 0.004
    door_z = h * 0.655
    door_h = h * 0.50
    box(
        "S44i upward glide door frame",
        (-w * 0.035, front, door_z),
        (w * 0.77, 0.042, door_h),
        m["light_aluminum"],
        bevel=0.028,
        category="upward glide door",
    )
    box(
        "S44i large observation window",
        (-w * 0.035, front - 0.023, door_z + h * 0.018),
        (w * 0.67, 0.008, door_h * 0.72),
        m["incubator_glass"],
        bevel=0.028,
        category="observation glazing",
    )
    # Visible inner shaker platform and rails behind the observation window.
    box("S44i stainless shaker platform", (-w * 0.035, -d * 0.17, h * 0.52), (w * 0.59, d * 0.48, h * 0.035), m["chamber_stainless"], bevel=0.010, category="shaker platform")
    for x in (-w * 0.27, w * 0.20):
        for y in (-d * 0.29, -d * 0.11, d * 0.07):
            cylinder(f"S44i platform clamp {x:+.3f} {y:+.3f}", (x, y, h * 0.548), 0.015, 0.035, m["silver"], vertices=24, category="platform clamp")
    tube(
        "S44i full-width door lift handle",
        [(-w * 0.31, front - 0.047, h * 0.445), (-w * 0.31, front - 0.069, h * 0.420), (w * 0.24, front - 0.069, h * 0.420), (w * 0.24, front - 0.047, h * 0.445)],
        0.014,
        m["silver"],
        category="door handle",
    )
    for x in (-w * .31, w * .24):
        box("S44i handle mounting foot", (x, front - .032, h * .445),
            (.036, .032, .040), m["silver"], bevel=.003, category="door handle mount")
    control_x = w * 0.385
    box("S44i right control pod", (control_x, front - 0.004, h * 0.590), (w * 0.175, 0.055, h * 0.315), m["instrument_gray"], bevel=0.020, category="control pod")
    add_front_display("S44i", (control_x, front - 0.034, h * 0.625), w * 0.125, h * 0.150, readout_rows=3, key_count=4)
    cylinder("S44i selector dial", (control_x, front - 0.038, h * 0.500), 0.025, 0.018, m["silver"], axis=(0.0, -1.0, 0.0), vertices=40, category="control")
    for side in (-1.0, 1.0):
        x = side * (w / 2 + 0.002)
        box(f"S44i side service panel {side:+.0f}", (x, d * 0.05, h * 0.55), (0.006, d * 0.55, h * 0.46), m["instrument_gray"], bevel=0.005, category="side service panel")
        add_vent_rows(f"S44i side ventilation {side:+.0f}", (x + side * 0.004, d * 0.16, h * 0.50), d * 0.34, 7, 8, face="right", slot_height=0.010)
    rear = d / 2 + 0.003
    box("S44i rear refrigeration service cover", (0.0, rear, h * 0.51), (w * 0.73, 0.008, h * 0.48), m["instrument_gray"], bevel=0.008, category="rear service panel")
    for x in (-w * 0.22, w * 0.22):
        torus(f"S44i rear fan grille {x:+.3f}", (x, rear + 0.006, h * 0.59), h * 0.080, 0.006, m["silver"], rotation=(math.pi / 2, 0.0, 0.0), category="rear fan grille")
        for angle in range(0, 180, 30):
            theta = math.radians(angle)
            length = h * 0.145
            tube(f"S44i fan grille spoke {x:+.3f} {angle}", [(x - math.cos(theta) * length / 2, rear + 0.008, h * 0.59 - math.sin(theta) * length / 2), (x + math.cos(theta) * length / 2, rear + 0.008, h * 0.59 + math.sin(theta) * length / 2)], 0.0025, m["zinc"], category="rear fan grille")
    for index, x in enumerate((-0.16, -0.05, 0.06, 0.17), 1):
        cylinder(f"S44i rear service connector {index}", (x, rear + 0.010, h * 0.31), 0.010, 0.011, m["silver"], axis=(0.0, 1.0, 0.0), vertices=24, category="rear connector")
    add_feet(w * 0.88, d * 0.84, radius=0.025)


def build_pcr_machine(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    box("T100 softly formed lower chassis", (0.0, 0.015, h * 0.41), (w, d * 0.94, h * 0.75), m["instrument_white"], bevel=0.026, category="thermal cycler chassis")
    box("T100 raised heated-lid housing", (0.0, d * 0.030, h * 0.79), (w * 0.90, d * 0.64, h * 0.34), m["instrument_gray"], bevel=0.024, category="heated lid")
    box("T100 heated-lid top insert", (0.0, d * 0.020, h * 0.925), (w * 0.72, d * 0.47, h * 0.065), m["light_aluminum"], bevel=0.014, category="heated lid")
    tube("T100 heated-lid handle", [(-w * 0.24, -d * 0.065, h * 0.93), (-w * 0.24, -d * 0.125, h * 1.01), (w * 0.24, -d * 0.125, h * 1.01), (w * 0.24, -d * 0.065, h * 0.93)], 0.010, m["silver"], category="heated lid handle")
    front = -d / 2 - 0.003
    box("T100 sloped front control deck", (0.0, front, h * 0.34), (w * 0.92, 0.060, h * 0.43), m["light_aluminum"], bevel=0.018, rotation=(math.radians(-12.0), 0.0, 0.0), category="control console")
    add_front_display("T100", (-w * 0.05, front - 0.034, h * 0.39), w * 0.58, h * 0.25, readout_rows=3, key_count=4)
    cylinder("T100 start control", (w * 0.34, front - 0.038, h * 0.27), 0.014, 0.007, m["status_green"], axis=(0.0, -1.0, 0.0), vertices=28, category="control")
    for side in (-1.0, 1.0):
        add_vent_rows(f"T100 side {side:+.0f}", (side * (w / 2 + 0.002), d * 0.12, h * 0.39), d * 0.36, 5, 6, face="right", slot_height=0.006)
    add_rear_service_cover("T100", w, d, h * 0.37, h * 0.42, vent_rows=2)
    box("T100 rear power inlet", (-w * 0.28, d / 2 + 0.011, h * 0.18), (w * 0.12, 0.010, h * 0.12), m["shadow"], bevel=0.004, category="rear power")
    add_feet(w * 0.86, d * 0.86, radius=0.010)


def build_real_time_pcr(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    box("QuantStudio formed vertical chassis", (0.0, 0.012, h * 0.48), (w * 0.98, d * 0.95, h * 0.94), m["instrument_white"], bevel=0.035, category="real-time PCR chassis")
    box("QuantStudio upper optical housing", (0.0, d * 0.035, h * 0.78), (w * 0.92, d * 0.80, h * 0.32), m["instrument_gray"], bevel=0.026, category="optical housing")
    front = -d / 2 - 0.003
    box("QuantStudio angled touch interface pod", (0.0, front, h * 0.655), (w * 0.86, 0.060, h * 0.30), m["light_aluminum"], bevel=0.024, rotation=(math.radians(-9.0), 0.0, 0.0), category="touch interface")
    add_front_display("QuantStudio", (0.0, front - 0.035, h * 0.68), w * 0.66, h * 0.185, readout_rows=4, key_count=3)
    box("QuantStudio motorized block drawer", (0.0, front - 0.010, h * 0.355), (w * 0.77, 0.047, h * 0.155), m["instrument_gray"], bevel=0.013, category="sample block drawer")
    box("QuantStudio plate slot", (0.0, front - 0.036, h * 0.377), (w * 0.55, 0.008, h * 0.056), m["shadow"], bevel=0.007, category="sample block drawer")
    box("QuantStudio drawer grip", (0.0, front - 0.043, h * 0.324), (w * 0.34, 0.012, h * 0.022), m["silver"], bevel=0.005, category="sample drawer handle")
    box("QuantStudio lower status fascia", (0.0, front - 0.004, h * 0.165), (w * 0.84, 0.030, h * 0.13), m["instrument_white"], bevel=0.018, category="lower fascia")
    for index, x in enumerate((-0.055, 0.0, 0.055), 1):
        cylinder(f"QuantStudio status indicator {index}", (x, front - 0.022, h * 0.166), 0.008, 0.005, m[("status_green", "display_teal", "status_orange")[index - 1]], axis=(0.0, -1.0, 0.0), vertices=24, category="status indicator")
    for side in (-1.0, 1.0):
        add_vent_rows(f"QuantStudio side {side:+.0f}", (side * (w / 2 + 0.002), d * 0.12, h * 0.34), d * 0.42, 8, 6, face="right", slot_height=0.006)
    add_rear_service_cover("QuantStudio", w, d, h * 0.44, h * 0.62, vent_rows=5)
    rear = d / 2 + 0.012
    box("QuantStudio rear power/data bank", (0.0, rear, h * 0.13), (w * 0.56, 0.012, h * 0.12), m["shadow"], bevel=0.005, category="rear service")
    for index, x in enumerate((-0.070, -0.025, 0.025, 0.070), 1):
        cylinder(f"QuantStudio rear data port {index}", (x, rear + 0.007, h * 0.13), 0.009, 0.006, m["silver"], axis=(0.0, 1.0, 0.0), vertices=20, category="rear data port")
    add_feet(w * 0.84, d * 0.86, radius=0.012)


def build_lab_refrigerator(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    caster_r = h * 0.018
    cabinet_bottom = caster_r * 2.0
    box("MPR-722R insulated light powder cabinet", (0.0, 0.012, cabinet_bottom + (h - cabinet_bottom) * 0.50), (w * 0.97, d * 0.95, h - cabinet_bottom), m["instrument_white"], bevel=0.030, category="pharmaceutical refrigerator cabinet")
    front = -d / 2 - 0.004
    # Recessed stainless interior remains visible through the full-height glass.
    box("MPR-722R stainless interior back", (0.0, -d * 0.05, h * 0.51), (w * 0.79, 0.018, h * 0.73), m["chamber_stainless"], bevel=0.008, category="refrigerated chamber")
    box("MPR-722R glass door perimeter frame", (0.0, front, h * 0.51), (w * 0.89, 0.050, h * 0.79), m["light_aluminum"], bevel=0.020, category="glazed refrigerator door")
    box("MPR-722R low iron glass door", (0.0, front - 0.028, h * 0.51), (w * 0.76, 0.008, h * 0.72), m["refrigerator_glass"], bevel=0.014, category="door glazing")
    for x in (-w * 0.39, w * 0.39):
        box(f"MPR-722R vertical door frame {x:+.3f}", (x, front - 0.030, h * 0.51), (w * 0.055, 0.012, h * 0.76), m["silver"], bevel=0.006, category="door frame")
    for z in (h * 0.125, h * 0.895):
        box(f"MPR-722R horizontal door frame {z:.3f}", (0.0, front - 0.030, z), (w * 0.84, 0.012, h * 0.045), m["silver"], bevel=0.006, category="door frame")
    # Five drawer racks follow the photographed/official MPR-722R configuration.
    rack_zs = [h * (0.22 + index * 0.145) for index in range(5)]
    for index, z in enumerate(rack_zs, 1):
        box(f"MPR-722R drawer shelf {index}", (0.0, -d * 0.07, z), (w * 0.69, d * 0.62, h * 0.020), m["chamber_stainless"], bevel=0.004, category="drawer rack")
        box(f"MPR-722R translucent drawer front {index}", (0.0, front - 0.036, z + h * 0.052), (w * 0.67, 0.010, h * 0.090), m["drawer_polymer"], bevel=0.008, category="drawer rack")
        for x in (-w * 0.27, 0.0, w * 0.27):
            box(f"MPR-722R drawer divider {index} {x:+.3f}", (x, -d * 0.07, z + h * 0.045), (0.006, d * 0.54, h * 0.075), m["drawer_polymer"], bevel=0.002, category="drawer rack")
    tube("MPR-722R vertical door handle", [(w * 0.32, front - 0.055, h * 0.36), (w * 0.37, front - 0.078, h * 0.38), (w * 0.37, front - 0.078, h * 0.70), (w * 0.32, front - 0.055, h * 0.72)], 0.015, m["silver"], category="door handle")
    cylinder("MPR-722R door lock", (w * 0.31, front - 0.058, h * 0.79), 0.018, 0.010, m["zinc"], axis=(0.0, -1.0, 0.0), vertices=28, category="door lock")
    box("MPR-722R upper control fascia", (0.0, front - 0.003, h * 0.945), (w * 0.91, 0.038, h * 0.070), m["instrument_gray"], bevel=0.015, category="control fascia")
    add_front_display("MPR-722R", (-w * 0.10, front - 0.026, h * 0.947), w * 0.38, h * 0.042, readout_rows=2, key_count=5)
    for index, x in enumerate((w * 0.12, w * 0.18, w * 0.24, w * 0.30), 1):
        cylinder(f"MPR-722R alarm key {index}", (x, front - 0.029, h * 0.947), 0.011, 0.006, m[("status_green", "display_teal", "status_orange", "silver")[index - 1]], axis=(0.0, -1.0, 0.0), vertices=24, category="control")
    box("MPR-722R lower compressor grille", (0.0, front - 0.005, h * 0.125), (w * 0.72, 0.024, h * 0.13), m["instrument_gray"], bevel=0.010, category="compressor grille")
    add_vent_rows("MPR-722R compressor", (0.0, front - 0.020, h * 0.125), w * 0.58, 4, 12, slot_height=0.010)
    # Side access ports and rear condenser/service anatomy make every orbit useful.
    for side in (-1.0, 1.0):
        x = side * (w / 2 + 0.003)
        torus(f"MPR-722R side access port {side:+.0f}", (x, d * 0.08, h * 0.55), 0.030, 0.006, m["silver"], rotation=(0.0, math.pi / 2, 0.0), category="side access port")
        cylinder(f"MPR-722R side access plug {side:+.0f}", (x + side * 0.005, d * 0.08, h * 0.55), 0.023, 0.008, m["rubber"], axis=(side, 0.0, 0.0), vertices=32, category="side access port")
        add_vent_rows(f"MPR-722R side lower ventilation {side:+.0f}", (x + side * 0.004, d * 0.18, h * 0.19), d * 0.30, 5, 7, face="right", slot_height=0.010)
    rear = d / 2 + 0.003
    box("MPR-722R rear refrigeration service panel", (0.0, rear, h * 0.29), (w * 0.84, 0.016, h * 0.38), m["instrument_gray"], bevel=0.003, category="rear service panel")
    for x in (-w * 0.32, w * 0.32):
        box(f"MPR-722R rear condenser rail {x:+.3f}", (x, rear + 0.010, h * 0.69), (0.012, 0.014, h * 0.40), m["zinc"], bevel=0.003, category="rear condenser")
    for index in range(11):
        z = h * (0.50 + index * 0.038)
        tube(f"MPR-722R condenser cross tube {index + 1}", [(-w * 0.32, rear + 0.012, z), (w * 0.32, rear + 0.012, z)], 0.004, m["zinc"], category="rear condenser")
    add_vent_rows("MPR-722R rear compressor", (0.0, rear + 0.008, h * 0.36), w * 0.60, 8, 12, slot_height=0.012)
    for x in (-w * 0.37, w * 0.37):
        for y in (-d * 0.38, d * 0.38):
            add_caster(f"MPR-722R caster {x:+.3f} {y:+.3f}", x, y, caster_r, angle=0.0 if y < 0 else math.pi / 2)


BUILDERS = {
    "floor-centrifuge": build_floor_centrifuge,
    "incubator": build_incubator,
    "shaking-incubator": build_shaking_incubator,
    "pcr-machine": build_pcr_machine,
    "real-time-pcr": build_real_time_pcr,
    "lab-refrigerator": build_lab_refrigerator,
}


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
    batch6.add_batch_materials()
    batch7.add_batch_materials()
    add_batch_materials()
    BUILDERS[spec.asset_id](spec)

    if furniture.ROOT is not None:
        furniture.ROOT["display_name"] = spec.asset_id.replace("-", " ").title()
        furniture.ROOT["revision"] = "instruments-batch10-r1"
        furniture.ROOT["planning_model"] = True
        furniture.ROOT["manufacturer_certified"] = False
        furniture.ROOT["primary_finish_policy"] = (
            "Cool white, light metallic gray, brushed stainless and aluminum; "
            "dark materials limited to screens, glazing seals, vents and functional interfaces."
        )
        furniture.ROOT["reference_class"] = SOURCE_NOTES[spec.asset_id]
        furniture.ROOT["source_note"] = (
            "Original LabSpace geometry informed by official manufacturer dimensions and "
            "visible equipment anatomy; no logos or downloaded product geometry."
        )

    batching, authored = batch6.fit_to_dimensions(spec)
    batch6.validate_statistics(spec, authored, imported=False)
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
    imported = batch6.inspect_export(spec, output_path)
    if preview_dir is not None:
        imported["previews"] = batch6.render_qa_views(spec, preview_dir)
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
    results = [build_one(spec, output_dir, save_blend_dir, preview_dir) for spec in selected]
    print("LABSPACE_INSTRUMENTS_BATCH10_BUILD " + json.dumps(results, sort_keys=True))


if __name__ == "__main__":
    main()
