"""Author the LabSpace light-finish analytical instrumentation fidelity batch.

The geometry is original and logo-free. Representative dimensions and visible
anatomy are informed by official Shimadzu Nexera, Nexis GC-2030 and UV-1900i,
Thermo Scientific Multiskan FC, Eppendorf Centrifuge 5425, and IKA C-MAG HS 7
documentation. These remain editable planning assets, not certified replicas.

Run with Blender 4.5 LTS in background mode::

    blender --background --factory-startup \
      --python scripts/blender/lab_fidelity_batch7.py -- \
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
import lab_fidelity_batch6 as batch6  # noqa: E402
import lab_furniture as furniture  # noqa: E402


AssetSpec = furniture.AssetSpec

ASSETS = {
    "hplc-system": AssetSpec("hplc-system", 0.620, 0.640, 1.180),
    "gas-chromatograph": AssetSpec("gas-chromatograph", 0.515, 0.540, 0.440),
    "spectrophotometer": AssetSpec("spectrophotometer", 0.450, 0.501, 0.244),
    "plate-reader": AssetSpec("plate-reader", 0.290, 0.400, 0.220),
    "microcentrifuge": AssetSpec("microcentrifuge", 0.240, 0.390, 0.240),
    "hotplate-stirrer": AssetSpec("hotplate-stirrer", 0.220, 0.335, 0.105),
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
            "instrument_white": make(
                "Cool white instrument polymer",
                (0.82, 0.85, 0.84, 1.0),
                roughness=0.25,
                coat=0.25,
                coat_roughness=0.13,
            ),
            "instrument_gray": make(
                "Light instrument gray powder coat",
                (0.58, 0.63, 0.62, 1.0),
                metallic=0.10,
                roughness=0.28,
                coat=0.20,
                coat_roughness=0.16,
            ),
            "silver": make(
                "Brushed analytical silver",
                (0.62, 0.68, 0.67, 1.0),
                metallic=0.88,
                roughness=0.22,
                anisotropy=0.55,
            ),
            "light_aluminum": make(
                "Light bead-blasted aluminum",
                (0.70, 0.74, 0.73, 1.0),
                metallic=0.82,
                roughness=0.31,
                anisotropy=0.38,
            ),
            "display_glass": make(
                "Smoked control display",
                (0.012, 0.045, 0.055, 1.0),
                roughness=0.11,
                coat=0.42,
                coat_roughness=0.07,
            ),
            "display_teal": make(
                "Teal status display graphics",
                (0.02, 0.50, 0.55, 1.0),
                roughness=0.16,
                coat=0.18,
            ),
            "functional_glass": make(
                "Black glass ceramic work surface",
                (0.018, 0.026, 0.028, 1.0),
                roughness=0.12,
                coat=0.50,
                coat_roughness=0.06,
            ),
            "bottle_clear": casework.make_transmissive_material(
                "Clear solvent bottle glass", (0.76, 0.91, 0.94, 0.30), 0.88, 0.055
            ),
            "bottle_amber": casework.make_transmissive_material(
                "Amber solvent bottle glass", (0.31, 0.13, 0.035, 0.58), 0.47, 0.12
            ),
            "tube_clear": casework.make_transmissive_material(
                "Clear analytical tubing", (0.75, 0.92, 0.94, 0.34), 0.78, 0.10
            ),
            "cap_blue": make("Blue solvent cap", (0.025, 0.18, 0.52, 1.0), roughness=0.38),
            "status_green": make(
                "Status indicator green", (0.02, 0.48, 0.30, 1.0), roughness=0.24, coat=0.20
            ),
            "status_orange": make(
                "Status indicator amber", (0.88, 0.39, 0.035, 1.0), roughness=0.25, coat=0.16
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
    return batch6.add_box(
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
    return furniture.add_cylinder(
        name,
        location,
        radius,
        depth,
        material,
        axis=axis,
        vertices=vertices,
        bevel=min(radius * 0.16, 0.003),
        category=category,
    )


def add_feet(width: float, depth: float, *, radius: float = 0.010) -> None:
    inset_x = max(radius * 1.4, width / 2 - radius * 1.8)
    inset_y = max(radius * 1.4, depth / 2 - radius * 1.8)
    for x in (-inset_x, inset_x):
        for y in (-inset_y, inset_y):
            cylinder(
                f"Isolation foot {x:+.3f} {y:+.3f}",
                (x, y, radius * 0.48),
                radius,
                radius * 0.96,
                furniture.MATERIALS["rubber"],
                category="isolation foot",
            )


def add_vent_bank(
    prefix: str,
    x: float,
    y: float,
    z: float,
    *,
    count: int,
    direction: str = "front",
    spacing: float = 0.016,
) -> None:
    m = furniture.MATERIALS
    for index in range(count):
        offset = (index - (count - 1) / 2) * spacing
        if direction == "side":
            location = (x, y + offset, z)
            dimensions = (0.003, spacing * 0.62, 0.006)
        else:
            location = (x + offset, y, z)
            dimensions = (spacing * 0.62, 0.003, 0.006)
        box(
            f"{prefix} vent {index + 1:02d}",
            location,
            dimensions,
            m["shadow"],
            bevel=0.001,
            category="ventilation",
        )


def add_status_display(
    prefix: str,
    location: tuple[float, float, float],
    width: float,
    height: float,
    *,
    tilt: float = 0.0,
) -> None:
    m = furniture.MATERIALS
    rotation = (math.radians(tilt), 0.0, 0.0)
    box(
        f"{prefix} display bezel",
        location,
        (width, 0.008, height),
        m["display_glass"],
        bevel=0.005,
        rotation=rotation,
        category="display",
    )
    box(
        f"{prefix} display active area",
        (location[0], location[1] - 0.0046, location[2]),
        (width * 0.84, 0.002, height * 0.70),
        m["screen"],
        bevel=0.002,
        rotation=rotation,
        category="display",
    )
    for row in range(3):
        box(
            f"{prefix} readout line {row + 1}",
            (
                location[0] - width * 0.10,
                location[1] - 0.006,
                location[2] + height * (0.19 - row * 0.18),
            ),
            (width * (0.42 if row == 0 else 0.30), 0.0012, height * 0.055),
            m["display_teal"],
            bevel=0.0005,
            rotation=rotation,
            category="display graphics",
        )


def add_round_button(
    name: str,
    x: float,
    y: float,
    z: float,
    material: bpy.types.Material,
    *,
    radius: float = 0.008,
) -> None:
    cylinder(
        name,
        (x, y, z),
        radius,
        0.006,
        material,
        axis=(0.0, -1.0, 0.0),
        vertices=28,
        category="control",
    )


def add_rear_panel(width: float, depth: float, height: float, *, rows: int = 2) -> None:
    m = furniture.MATERIALS
    y = depth / 2 + 0.002
    box(
        "Rear removable service cover",
        (0.0, y, height * 0.46),
        (width * 0.68, 0.006, height * 0.56),
        m["instrument_gray"],
        bevel=0.004,
        category="rear service panel",
    )
    for row in range(rows):
        add_vent_bank(
            f"Rear row {row + 1}",
            -width * 0.12,
            y + 0.004,
            height * (0.36 + row * 0.13),
            count=6,
            spacing=max(0.012, width * 0.055),
        )
    for index, x in enumerate((-0.14, -0.045, 0.05, 0.145), 1):
        cylinder(
            f"Rear service connector {index}",
            (x * min(1.0, width / 0.32), y + 0.008, height * 0.20),
            0.009,
            0.010,
            m["silver"],
            axis=(0.0, 1.0, 0.0),
            vertices=24,
            category="rear connector",
        )


def add_module(
    prefix: str,
    center_x: float,
    center_z: float,
    width: float,
    depth: float,
    height: float,
    *,
    screen: bool = True,
    drawer: bool = False,
) -> None:
    m = furniture.MATERIALS
    front = -depth / 2 - 0.004
    box(
        f"{prefix} enclosure",
        (center_x, 0.0, center_z),
        (width, depth, height),
        m["instrument_white"],
        bevel=0.011,
        category="analytical module",
    )
    box(
        f"{prefix} silver fascia",
        (center_x, front, center_z),
        (width * 0.92, 0.010, height * 0.79),
        m["light_aluminum"],
        bevel=0.006,
        category="module fascia",
    )
    box(
        f"{prefix} identity strip",
        (center_x - width * 0.22, front - 0.006, center_z + height * 0.27),
        (width * 0.34, 0.002, height * 0.045),
        m["instrument_white"],
        bevel=0.001,
        category="identity strip",
    )
    if screen:
        add_status_display(
            prefix,
            (center_x + width * 0.20, front - 0.010, center_z),
            width * 0.26,
            height * 0.28,
        )
    if drawer:
        box(
            f"{prefix} sample drawer",
            (center_x - width * 0.08, front - 0.009, center_z - height * 0.15),
            (width * 0.58, 0.011, height * 0.18),
            m["instrument_gray"],
            bevel=0.004,
            category="sample drawer",
        )
    add_round_button(
        f"{prefix} status lamp",
        center_x - width * 0.39,
        front - 0.010,
        center_z - height * 0.27,
        m["status_green"],
        radius=min(0.007, height * 0.04),
    )
    for side in (-1.0, 1.0):
        add_vent_bank(
            f"{prefix} side {side:+.0f}",
            center_x + side * (width / 2 + 0.002),
            0.08,
            center_z - height * 0.08,
            count=5,
            direction="side",
            spacing=max(0.012, depth * 0.045),
        )


def add_solvent_bottle(
    prefix: str,
    x: float,
    y: float,
    z: float,
    *,
    amber: bool = False,
    scale: float = 1.0,
) -> None:
    m = furniture.MATERIALS
    body = m["bottle_amber" if amber else "bottle_clear"]
    cylinder(prefix + " body", (x, y, z + 0.050 * scale), 0.032 * scale, 0.100 * scale, body)
    cylinder(prefix + " shoulder", (x, y, z + 0.104 * scale), 0.022 * scale, 0.018 * scale, body)
    cylinder(prefix + " neck", (x, y, z + 0.124 * scale), 0.012 * scale, 0.024 * scale, body)
    cylinder(prefix + " cap", (x, y, z + 0.140 * scale), 0.015 * scale, 0.014 * scale, m["cap_blue"])
    for ridge in (-0.006, 0.0, 0.006):
        cylinder(
            f"{prefix} cap ridge {ridge:+.3f}",
            (x, y, z + 0.140 * scale + ridge * scale),
            0.0155 * scale,
            0.0015 * scale,
            m["instrument_white"],
            category="cap ridge",
        )


def build_hplc_system(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    width, depth, height = spec.width, spec.depth, spec.height
    box(
        "HPLC anti-vibration base",
        (0.0, 0.0, 0.028),
        (width * 0.96, depth * 0.92, 0.056),
        m["instrument_gray"],
        bevel=0.012,
        category="base",
    )
    module_width = 0.286
    module_depth = 0.505
    gap = 0.016
    left_x = -(module_width + gap) / 2
    right_x = (module_width + gap) / 2
    left_modules = [
        (0.130, True, False, "Pump module"),
        (0.138, True, False, "Detector module"),
        (0.205, True, True, "Autosampler module"),
        (0.165, False, False, "Column oven module"),
    ]
    right_modules = [
        (0.132, True, False, "Degasser module"),
        (0.140, True, False, "Controller module"),
        (0.220, True, True, "Secondary autosampler"),
    ]
    cursor = 0.063
    for module_height, screen, drawer, label in left_modules:
        add_module(label, left_x, cursor + module_height / 2, module_width, module_depth, module_height, screen=screen, drawer=drawer)
        cursor += module_height + 0.010
    left_top = cursor
    cursor = 0.063
    for module_height, screen, drawer, label in right_modules:
        add_module(label, right_x, cursor + module_height / 2, module_width, module_depth, module_height, screen=screen, drawer=drawer)
        cursor += module_height + 0.010
    right_top = cursor
    tray_z = max(left_top, right_top) + 0.032
    box(
        "Solvent containment tray",
        (0.0, 0.012, tray_z),
        (width * 0.94, depth * 0.86, 0.052),
        m["silver"],
        bevel=0.010,
        category="solvent tray",
    )
    box(
        "Solvent tray raised rear lip",
        (0.0, depth * 0.39, tray_z + 0.040),
        (width * 0.92, 0.022, 0.085),
        m["light_aluminum"],
        bevel=0.004,
        category="spill containment",
    )
    bottle_positions = [
        (-0.225, -0.105, False, 1.00),
        (-0.105, -0.090, True, 0.95),
        (0.020, -0.115, False, 1.05),
        (0.145, -0.090, True, 0.90),
        (0.245, -0.105, False, 0.82),
    ]
    for index, (x, y, amber, scale) in enumerate(bottle_positions, 1):
        add_solvent_bottle(
            f"Mobile phase bottle {index}", x, y, tray_z + 0.026, amber=amber, scale=scale
        )
        casework.add_curve_tube(
            f"Mobile phase line {index}",
            [
                (x, y, tray_z + 0.178 * scale),
                (x * 0.84, y + 0.08, tray_z + 0.22),
                (left_x if index < 4 else right_x, 0.22, left_top - 0.04),
            ],
            0.0032,
            m["tube_clear"],
            category="solvent tubing",
        )
    # Rear service spine, fan grilles, connectors and bundled analytical lines.
    box(
        "Rear communications spine",
        (0.0, depth * 0.455, height * 0.43),
        (width * 0.90, 0.025, height * 0.56),
        m["instrument_gray"],
        bevel=0.006,
        category="rear service spine",
    )
    for row in range(4):
        add_vent_bank(
            f"HPLC rear ventilation {row + 1}",
            -0.06,
            depth * 0.472,
            0.16 + row * 0.14,
            count=9,
            spacing=0.027,
        )
    for index, x in enumerate((-0.23, -0.13, -0.03, 0.07, 0.17, 0.25), 1):
        cylinder(
            f"HPLC rear connector {index}",
            (x, depth * 0.478, 0.12),
            0.010,
            0.012,
            m["silver"],
            axis=(0.0, 1.0, 0.0),
            vertices=24,
            category="rear connector",
        )
    add_feet(width * 0.94, depth * 0.88, radius=0.012)


def build_gas_chromatograph(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    width, depth, height = spec.width, spec.depth, spec.height
    box(
        "GC main oven enclosure",
        (0.0, 0.0, height * 0.50),
        (width, depth, height),
        m["instrument_white"],
        bevel=0.020,
        category="instrument chassis",
    )
    front = -depth / 2 - 0.006
    box(
        "GC removable oven door",
        (-width * 0.10, front, height * 0.45),
        (width * 0.72, 0.020, height * 0.68),
        m["light_aluminum"],
        bevel=0.012,
        category="oven door",
    )
    box(
        "GC oven door pull",
        (-width * 0.10, front - 0.014, height * 0.18),
        (width * 0.42, 0.018, 0.025),
        m["silver"],
        bevel=0.005,
        category="door pull",
    )
    add_status_display(
        "GC touchscreen",
        (width * 0.345, front - 0.018, height * 0.51),
        width * 0.22,
        height * 0.40,
    )
    for index, z in enumerate((0.115, 0.155, 0.195), 1):
        add_round_button(
            f"GC front control {index}",
            width * 0.345,
            front - 0.018,
            z,
            m["status_green" if index == 1 else "instrument_gray"],
            radius=0.010,
        )
    box(
        "GC silver top deck",
        (0.0, 0.0, height - 0.020),
        (width * 0.97, depth * 0.97, 0.040),
        m["silver"],
        bevel=0.010,
        category="top deck",
    )
    for index, x in enumerate((-0.15, 0.0, 0.15), 1):
        cylinder(
            f"GC injection port {index}",
            (x, -0.045, height + 0.035),
            0.020,
            0.070,
            m["light_aluminum"],
            category="injection port",
        )
        cylinder(
            f"GC injector cap {index}",
            (x, -0.045, height + 0.075),
            0.024,
            0.014,
            m["instrument_gray"],
            category="injector cap",
        )
    for side in (-1.0, 1.0):
        add_vent_bank(
            f"GC side {side:+.0f}",
            side * (width / 2 + 0.002),
            0.075,
            height * 0.28,
            count=10,
            direction="side",
            spacing=0.026,
        )
    add_rear_panel(width, depth, height, rows=3)
    add_feet(width, depth, radius=0.012)


def build_spectrophotometer(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    width, depth, height = spec.width, spec.depth, spec.height
    box(
        "UV-Vis lower chassis",
        (0.0, 0.005, height * 0.36),
        (width, depth * 0.97, height * 0.72),
        m["instrument_white"],
        bevel=0.025,
        category="instrument chassis",
    )
    box(
        "UV-Vis sculpted upper shell",
        (-width * 0.055, 0.035, height * 0.72),
        (width * 0.88, depth * 0.86, height * 0.42),
        m["instrument_gray"],
        bevel=0.028,
        rotation=(math.radians(-3.0), 0.0, 0.0),
        category="upper shell",
    )
    box(
        "UV-Vis sample compartment lid",
        (-width * 0.18, -0.005, height * 0.94),
        (width * 0.50, depth * 0.58, height * 0.085),
        m["light_aluminum"],
        bevel=0.018,
        rotation=(math.radians(-2.0), 0.0, 0.0),
        category="sample lid",
    )
    box(
        "Sample lid finger recess",
        (-width * 0.18, -depth * 0.305, height * 0.92),
        (width * 0.17, 0.018, height * 0.055),
        m["instrument_gray"],
        bevel=0.008,
        category="lid pull",
    )
    add_status_display(
        "UV-Vis touchscreen",
        (width * 0.255, -depth * 0.465, height * 0.62),
        width * 0.32,
        height * 0.38,
        tilt=-8.0,
    )
    for index, x in enumerate((width * 0.18, width * 0.27, width * 0.36), 1):
        add_round_button(
            f"UV-Vis tactile control {index}",
            x,
            -depth * 0.480,
            height * 0.24,
            m["status_green" if index == 1 else "silver"],
            radius=0.008,
        )
    for side in (-1.0, 1.0):
        add_vent_bank(
            f"UV-Vis side {side:+.0f}",
            side * (width / 2 + 0.002),
            depth * 0.08,
            height * 0.30,
            count=8,
            direction="side",
            spacing=0.026,
        )
    add_rear_panel(width, depth, height, rows=2)
    add_feet(width * 0.94, depth * 0.92, radius=0.011)


def build_plate_reader(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    width, depth, height = spec.width, spec.depth, spec.height
    box(
        "Plate reader main enclosure",
        (0.0, 0.0, height * 0.47),
        (width, depth, height * 0.94),
        m["instrument_white"],
        bevel=0.026,
        category="instrument chassis",
    )
    box(
        "Plate reader silver upper shell",
        (0.0, 0.028, height * 0.83),
        (width * 0.94, depth * 0.86, height * 0.29),
        m["light_aluminum"],
        bevel=0.020,
        rotation=(math.radians(-2.0), 0.0, 0.0),
        category="upper shell",
    )
    front = -depth / 2 - 0.006
    box(
        "Microplate loading slot",
        (-width * 0.12, front, height * 0.30),
        (width * 0.52, 0.012, height * 0.18),
        m["display_glass"],
        bevel=0.008,
        category="plate loading slot",
    )
    box(
        "Microplate tray lip",
        (-width * 0.12, front - 0.012, height * 0.24),
        (width * 0.46, 0.020, 0.018),
        m["silver"],
        bevel=0.004,
        category="plate tray",
    )
    add_status_display(
        "Plate reader display",
        (width * 0.27, front - 0.016, height * 0.58),
        width * 0.30,
        height * 0.34,
    )
    add_round_button(
        "Plate reader start button",
        width * 0.30,
        front - 0.016,
        height * 0.25,
        m["status_green"],
        radius=0.010,
    )
    for side in (-1.0, 1.0):
        add_vent_bank(
            f"Plate reader side {side:+.0f}",
            side * (width / 2 + 0.002),
            0.05,
            height * 0.35,
            count=7,
            direction="side",
            spacing=0.024,
        )
    add_rear_panel(width, depth, height, rows=2)
    add_feet(width * 0.93, depth * 0.92, radius=0.010)


def build_microcentrifuge(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    width, depth, height = spec.width, spec.depth, spec.height
    box(
        "Microcentrifuge lower chassis",
        (0.0, 0.018, height * 0.37),
        (width, depth * 0.94, height * 0.74),
        m["instrument_white"],
        bevel=0.030,
        category="instrument chassis",
    )
    box(
        "Microcentrifuge rotor lid",
        (0.0, 0.032, height * 0.80),
        (width * 0.91, depth * 0.78, height * 0.33),
        m["light_aluminum"],
        bevel=0.040,
        rotation=(math.radians(-2.5), 0.0, 0.0),
        category="rotor lid",
    )
    box(
        "Rotor lid release",
        (0.0, -depth * 0.395, height * 0.72),
        (width * 0.23, 0.024, height * 0.060),
        m["instrument_gray"],
        bevel=0.010,
        category="lid release",
    )
    front = -depth * 0.47 - 0.004
    box(
        "Sloped centrifuge control fascia",
        (0.0, front, height * 0.30),
        (width * 0.93, 0.048, height * 0.32),
        m["instrument_gray"],
        bevel=0.014,
        rotation=(math.radians(-12.0), 0.0, 0.0),
        category="control fascia",
    )
    add_status_display(
        "Microcentrifuge",
        (-width * 0.13, front - 0.032, height * 0.34),
        width * 0.36,
        height * 0.18,
        tilt=-12.0,
    )
    for index, x in enumerate((0.015, 0.060, 0.100), 1):
        add_round_button(
            f"Microcentrifuge keypad {index}",
            x,
            front - 0.034,
            height * 0.33,
            m["status_green" if index == 3 else "silver"],
            radius=0.009,
        )
    for side in (-1.0, 1.0):
        add_vent_bank(
            f"Microcentrifuge side {side:+.0f}",
            side * (width / 2 + 0.002),
            0.055,
            height * 0.27,
            count=8,
            direction="side",
            spacing=0.024,
        )
    add_rear_panel(width, depth, height, rows=2)
    add_feet(width * 0.92, depth * 0.90, radius=0.011)


def build_hotplate_stirrer(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    width, depth, height = spec.width, spec.depth, spec.height
    box(
        "Hotplate light instrument base",
        (0.0, 0.012, height * 0.38),
        (width, depth * 0.94, height * 0.76),
        m["instrument_white"],
        bevel=0.016,
        category="instrument chassis",
    )
    box(
        "Glass ceramic heating plate",
        (0.0, 0.028, height * 0.83),
        (0.182, 0.182, height * 0.17),
        m["functional_glass"],
        bevel=0.010,
        category="functional work surface",
    )
    # Fine silver perimeter makes the dark functional plate read as a component,
    # never as the main enclosure color.
    for x in (-0.096, 0.096):
        box(
            f"Heating plate side trim {x:+.3f}",
            (x, 0.028, height * 0.82),
            (0.006, 0.194, height * 0.18),
            m["silver"],
            bevel=0.002,
            category="plate trim",
        )
    for y in (-0.068, 0.124):
        box(
            f"Heating plate end trim {y:+.3f}",
            (0.0, y, height * 0.82),
            (0.198, 0.006, height * 0.18),
            m["silver"],
            bevel=0.002,
            category="plate trim",
        )
    front = -depth * 0.47 - 0.004
    box(
        "Hotplate sloped silver control fascia",
        (0.0, front, height * 0.37),
        (width * 0.94, 0.050, height * 0.54),
        m["light_aluminum"],
        bevel=0.010,
        rotation=(math.radians(-14.0), 0.0, 0.0),
        category="control fascia",
    )
    add_status_display(
        "Hotplate status",
        (0.0, front - 0.030, height * 0.48),
        width * 0.30,
        height * 0.23,
        tilt=-14.0,
    )
    for index, x in enumerate((-0.068, 0.068), 1):
        cylinder(
            f"Hotplate control dial {index}",
            (x, front - 0.032, height * 0.30),
            0.022,
            0.018,
            m["silver"],
            axis=(0.0, -1.0, 0.0),
            vertices=40,
            category="control dial",
        )
        add_round_button(
            f"Hotplate dial indicator {index}",
            x,
            front - 0.043,
            height * 0.32,
            m["status_orange" if index == 1 else "display_teal"],
            radius=0.004,
        )
    cylinder(
        "External probe socket",
        (width / 2 + 0.003, -0.065, height * 0.35),
        0.012,
        0.010,
        m["silver"],
        axis=(1.0, 0.0, 0.0),
        vertices=24,
        category="probe socket",
    )
    add_rear_panel(width, depth, height, rows=1)
    add_feet(width * 0.90, depth * 0.88, radius=0.009)


BUILDERS = {
    "hplc-system": build_hplc_system,
    "gas-chromatograph": build_gas_chromatograph,
    "spectrophotometer": build_spectrophotometer,
    "plate-reader": build_plate_reader,
    "microcentrifuge": build_microcentrifuge,
    "hotplate-stirrer": build_hotplate_stirrer,
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
    add_batch_materials()
    BUILDERS[spec.asset_id](spec)

    if furniture.ROOT is not None:
        furniture.ROOT["display_name"] = spec.asset_id.replace("-", " ").title()
        furniture.ROOT["revision"] = "fidelity-batch7-r1"
        furniture.ROOT["planning_model"] = True
        furniture.ROOT["manufacturer_certified"] = False
        furniture.ROOT["primary_finish_policy"] = (
            "Cool white, light instrument gray, brushed silver and stainless; "
            "dark materials limited to screens, seals, ports and functional surfaces."
        )
        furniture.ROOT["source_note"] = (
            "Original LabSpace geometry informed by supplied Digital Twin references and "
            "representative official manufacturer dimensions/anatomy; no logos or downloaded geometry."
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
    results = [
        build_one(spec, output_dir, save_blend_dir, preview_dir) for spec in selected
    ]
    print("LABSPACE_FIDELITY_BATCH7_BUILD " + json.dumps(results, sort_keys=True))


if __name__ == "__main__":
    main()
