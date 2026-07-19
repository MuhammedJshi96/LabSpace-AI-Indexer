"""Author six reference-driven all-sided LabSpace equipment assets.

The geometry is original and logo-free. Overall envelopes and visible anatomy
are informed by official Thermo Scientific Heraguard ECO, Evident SZX7,
Bio-Rad Sub-Cell GT and GelDoc Go, Hoshizaki IM-65NE, and Labconco
FlaskScrubber documentation. These are editable planning assets rather than
manufacturer-certified replicas.

Run with Blender in background mode::

    blender --background --factory-startup \
      --python scripts/blender/lab_remaining_equipment_batch11.py -- \
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
import lab_fidelity_batch7 as batch7  # noqa: E402
import lab_instruments_batch10 as instruments  # noqa: E402
import lab_furniture as furniture  # noqa: E402


AssetSpec = furniture.AssetSpec

ASSETS = {
    "laminar-flow": AssetSpec("laminar-flow", 1.500, 0.800, 2.100),
    "stereo-microscope": AssetSpec("stereo-microscope", 0.194, 0.253, 0.403),
    "electrophoresis-tank": AssetSpec("electrophoresis-tank", 0.405, 0.180, 0.094),
    "gel-doc": AssetSpec("gel-doc", 0.360, 0.448, 0.353),
    "ice-maker": AssetSpec("ice-maker", 0.633, 0.506, 0.930),
    "glassware-washer": AssetSpec("glassware-washer", 0.610, 0.686, 0.876),
}

SOURCE_NOTES = {
    "laminar-flow": "Thermo Scientific Heraguard ECO 1.5-class horizontal laminar-flow clean bench",
    "stereo-microscope": "Evident SZX7-class stereo microscope with universal transmitted-light stand",
    "electrophoresis-tank": "Bio-Rad Sub-Cell GT-class horizontal electrophoresis system",
    "gel-doc": "Bio-Rad GelDoc Go-class compact gel imaging system",
    "ice-maker": "Hoshizaki IM-65NE-class self-contained laboratory ice maker",
    "glassware-washer": "Labconco FlaskScrubber-class undercounter laboratory glassware washer",
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
            "clear_acrylic": casework.make_transmissive_material(
                "Clear molded laboratory acrylic", (0.72, 0.91, 0.95, 0.26), 0.90, 0.045
            ),
            "clear_glass": casework.make_transmissive_material(
                "Low iron safety glass", (0.70, 0.90, 0.93, 0.22), 0.92, 0.04
            ),
            "washer_glass": casework.make_transmissive_material(
                "Washer observation glass", (0.15, 0.31, 0.34, 0.46), 0.55, 0.095
            ),
            "buffer_liquid": casework.make_transmissive_material(
                "Electrophoresis buffer", (0.15, 0.48, 0.66, 0.34), 0.70, 0.09
            ),
            "ice_clear": casework.make_transmissive_material(
                "Translucent ice", (0.75, 0.91, 0.96, 0.40), 0.64, 0.12
            ),
            "optic_glass": casework.make_transmissive_material(
                "Coated microscope optic", (0.06, 0.20, 0.26, 0.52), 0.48, 0.055
            ),
            "work_light": make(
                "Neutral LED work light",
                (0.82, 0.94, 1.0, 1.0),
                roughness=0.16,
                coat=0.26,
            ),
            "soft_blue": make(
                "Restrained laboratory blue polymer",
                (0.025, 0.26, 0.55, 1.0),
                roughness=0.26,
                coat=0.22,
            ),
            "soft_red": make(
                "Restrained laboratory red polymer",
                (0.62, 0.035, 0.025, 1.0),
                roughness=0.28,
                coat=0.20,
            ),
            "gel_amber": make(
                "Gel imaging safety amber",
                (0.83, 0.45, 0.04, 1.0),
                roughness=0.25,
                coat=0.18,
            ),
        }
    )


box = instruments.box
cylinder = instruments.cylinder
tube = instruments.tube
torus = instruments.torus
add_feet = instruments.add_feet
add_front_display = instruments.add_front_display
add_vent_rows = instruments.add_vent_rows


def sphere(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    category: str = "detail",
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=36, ring_count=24, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    furniture.assign_material(obj, material)
    furniture.smooth(obj)
    return furniture.parent_to_root(obj, category)


def cone(
    name: str,
    location: tuple[float, float, float],
    radius1: float,
    radius2: float,
    depth: float,
    material: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    vertices: int = 36,
    category: str = "detail",
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
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


def build_laminar_flow(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    front = -d / 2
    rear = d / 2
    worktop_z = h * 0.435

    box("clean bench lower plinth", (0.0, 0.02, h * 0.055), (w * 0.95, d * 0.83, h * 0.09), m["light_aluminum"], bevel=0.016, category="base")
    box("clean bench lower cabinet carcass", (0.0, 0.03, h * 0.245), (w * 0.93, d * 0.79, h * 0.36), m["instrument_white"], bevel=0.014, category="base cabinet")
    for index, x in enumerate((-w * 0.23, w * 0.23), 1):
        box(f"clean bench cabinet door {index}", (x, front + 0.070, h * 0.255), (w * 0.445, 0.018, h * 0.315), m["instrument_white"], bevel=0.009, category="cabinet door")
        tube(f"clean bench door handle {index}", [(x - w * 0.055, front + 0.052, h * 0.30), (x, front + 0.040, h * 0.31), (x + w * 0.055, front + 0.052, h * 0.30)], 0.008, m["silver"], category="handle")
    box("clean bench stainless work surface", (0.0, -0.005, worktop_z), (w * 0.96, d * 0.86, h * 0.028), m["chamber_stainless"], bevel=0.008, category="work surface")
    box("clean bench front spill lip", (0.0, front + 0.025, worktop_z + h * 0.018), (w * 0.94, 0.026, h * 0.032), m["silver"], bevel=0.004, category="work surface")

    opening_bottom = worktop_z + h * 0.030
    opening_top = h * 0.805
    for side in (-1.0, 1.0):
        x = side * w * 0.455
        box(f"clean bench side column {side:+.0f}", (x, 0.0, h * 0.675), (w * 0.07, d * 0.86, h * 0.49), m["instrument_white"], bevel=0.012, category="upper frame")
        box(f"clean bench side vision panel {side:+.0f}", (x - side * w * 0.038, 0.0, (opening_bottom + opening_top) / 2), (0.010, d * 0.68, opening_top - opening_bottom), m["clear_glass"], bevel=0.004, category="side glass")
    box("clean bench rear HEPA diffuser", (0.0, rear - 0.045, (opening_bottom + opening_top) / 2), (w * 0.82, 0.034, opening_top - opening_bottom), m["light_aluminum"], bevel=0.008, category="HEPA diffuser")
    for row in range(9):
        z = opening_bottom + (row + 1) * (opening_top - opening_bottom) / 10
        for col in range(18):
            x = -w * 0.38 + col * w * 0.76 / 17
            cylinder(f"clean bench diffuser perforation {row:02d}-{col:02d}", (x, rear - 0.063, z), 0.006, 0.006, m["shadow"], axis=(0.0, -1.0, 0.0), vertices=16, category="HEPA diffuser")
    box("clean bench upper blower housing", (0.0, 0.0, h * 0.895), (w * 0.97, d * 0.90, h * 0.19), m["instrument_white"], bevel=0.024, category="blower housing")
    box("clean bench upper intake grille", (0.0, 0.03, h * 0.987), (w * 0.70, d * 0.52, h * 0.012), m["instrument_gray"], bevel=0.006, category="intake grille")
    for index in range(14):
        y = -d * 0.21 + index * d * 0.42 / 13
        box(f"clean bench intake slot {index + 1}", (0.0, y, h * 0.995), (w * 0.58, 0.008, 0.004), m["shadow"], bevel=0.001, category="intake grille")
    box("clean bench task light", (0.0, front + d * 0.15, opening_top - h * 0.018), (w * 0.70, 0.026, h * 0.018), m["work_light"], bevel=0.006, category="task light")
    box("clean bench eye-level control fascia", (w * 0.25, front + 0.014, h * 0.855), (w * 0.36, 0.022, h * 0.072), m["instrument_gray"], bevel=0.010, category="control fascia")
    add_front_display("clean bench", (w * 0.19, front + 0.001, h * 0.855), w * 0.20, h * 0.046, readout_rows=2, key_count=4)
    for x in (-w * 0.30, w * 0.32):
        for z in (worktop_z + h * 0.10, worktop_z + h * 0.18):
            box(f"clean bench service outlet {x:.2f}-{z:.2f}", (x, rear - 0.070, z), (w * 0.075, 0.012, h * 0.052), m["powder_light"], bevel=0.006, category="service outlet")
            for dx in (-w * 0.016, w * 0.016):
                cylinder(f"clean bench socket {x:.2f}-{z:.2f}-{dx:.2f}", (x + dx, rear - 0.078, z), 0.007, 0.004, m["shadow"], axis=(0.0, -1.0, 0.0), vertices=20, category="service outlet")
    add_vent_rows("clean bench left blower", (-w * 0.486, d * 0.08, h * 0.90), d * 0.52, 7, 9, face="right", slot_height=0.010)
    add_vent_rows("clean bench right blower", (w * 0.486, d * 0.08, h * 0.90), d * 0.52, 7, 9, face="right", slot_height=0.010)
    box("clean bench rear service cover", (0.0, rear + 0.003, h * 0.31), (w * 0.78, 0.008, h * 0.34), m["instrument_gray"], bevel=0.006, category="rear service panel")
    add_vent_rows("clean bench rear base", (0.0, rear + 0.009, h * 0.31), w * 0.54, 6, 12, slot_height=0.010)
    add_feet(w * 0.86, d * 0.72, radius=0.018)


def build_stereo_microscope(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    base_z = h * 0.075
    box("SZX7 universal LED base", (0.0, -d * 0.035, base_z), (w * 0.92, d * 0.80, h * 0.14), m["instrument_white"], bevel=0.016, category="stand base")
    box("SZX7 stage plate", (0.0, -d * 0.11, h * 0.165), (w * 0.64, d * 0.45, h * 0.025), m["instrument_gray"], bevel=0.009, category="stage")
    cylinder("SZX7 transmitted light window", (0.0, -d * 0.11, h * 0.182), w * 0.19, h * 0.012, m["clear_glass"], vertices=48, category="stage illumination")
    cylinder("SZX7 LED diffuser", (0.0, -d * 0.11, h * 0.187), w * 0.11, h * 0.004, m["work_light"], vertices=48, category="stage illumination")
    box("SZX7 rear focus column", (0.0, d * 0.28, h * 0.44), (w * 0.18, d * 0.18, h * 0.66), m["light_aluminum"], bevel=0.013, category="focus stand")
    box("SZX7 rear column cap", (0.0, d * 0.28, h * 0.79), (w * 0.24, d * 0.22, h * 0.055), m["instrument_white"], bevel=0.012, category="focus stand")
    tube("SZX7 horizontal carrier arm", [(0.0, d * 0.27, h * 0.62), (0.0, d * 0.03, h * 0.63), (0.0, -d * 0.07, h * 0.59)], w * 0.055, m["light_aluminum"], category="focus carrier")
    box("SZX7 focus carriage", (0.0, d * 0.045, h * 0.59), (w * 0.43, d * 0.24, h * 0.22), m["light_aluminum"], bevel=0.018, category="focus carriage")
    cylinder("SZX7 cylindrical zoom body", (0.0, -d * 0.07, h * 0.56), w * 0.19, h * 0.24, m["instrument_white"], vertices=48, category="zoom body")
    torus("SZX7 zoom scale collar", (0.0, -d * 0.07, h * 0.60), w * 0.20, w * 0.018, m["instrument_gray"], category="zoom scale")
    cone("SZX7 objective housing", (0.0, -d * 0.07, h * 0.42), w * 0.13, w * 0.095, h * 0.12, m["instrument_gray"], category="objective")
    cylinder("SZX7 objective front optic", (0.0, -d * 0.07, h * 0.355), w * 0.085, h * 0.018, m["optic_glass"], vertices=48, category="objective optic")
    for side in (-1.0, 1.0):
        cylinder(f"SZX7 focus knob {side:+.0f}", (side * w * 0.115, d * 0.18, h * 0.55), w * 0.065, w * 0.045, m["instrument_gray"], axis=(side, 0.0, 0.0), vertices=32, category="focus control")
        cylinder(f"SZX7 zoom knob {side:+.0f}", (side * w * 0.15, -d * 0.065, h * 0.57), w * 0.044, w * 0.035, m["silver"], axis=(side, 0.0, 0.0), vertices=32, category="zoom control")
    box("SZX7 binocular prism head", (0.0, -d * 0.025, h * 0.75), (w * 0.52, d * 0.31, h * 0.18), m["instrument_white"], bevel=0.025, category="binocular head")
    box("SZX7 binocular head lower band", (0.0, -d * 0.025, h * 0.69), (w * 0.48, d * 0.28, h * 0.045), m["instrument_gray"], bevel=0.010, category="binocular head")
    for side in (-1.0, 1.0):
        tube(f"SZX7 eyepiece tube {side:+.0f}", [(side * w * 0.07, -d * 0.02, h * 0.78), (side * w * 0.12, -d * 0.08, h * 0.88), (side * w * 0.13, -d * 0.11, h * 0.94)], w * 0.035, m["instrument_gray"], category="eyepiece tube")
        cylinder(f"SZX7 eyepiece {side:+.0f}", (side * w * 0.13, -d * 0.115, h * 0.955), w * 0.052, d * 0.075, m["shadow"], axis=(0.0, -0.65, 0.76), vertices=36, category="eyepiece")
        cylinder(f"SZX7 eyepiece optic {side:+.0f}", (side * w * 0.13, -d * 0.145, h * 0.982), w * 0.038, 0.008, m["optic_glass"], axis=(0.0, -0.65, 0.76), vertices=36, category="eyepiece optic")
    for side in (-1.0, 1.0):
        for y in (-d * 0.30, d * 0.22):
            cylinder(f"SZX7 rubber foot {side:+.0f}-{y:.3f}", (side * w * 0.34, y, h * 0.012), w * 0.035, h * 0.022, m["rubber"], vertices=28, category="foot")
    box("SZX7 rear power socket", (0.0, d * 0.405, h * 0.10), (w * 0.22, 0.008, h * 0.065), m["shadow"], bevel=0.004, category="rear service")


def build_electrophoresis_tank(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    wall = min(w, d) * 0.025
    box("Sub-Cell clear base", (0.0, 0.0, h * 0.11), (w * 0.94, d * 0.90, h * 0.16), m["clear_acrylic"], bevel=0.008, category="tank base")
    box("Sub-Cell left wall", (-w * 0.46, 0.0, h * 0.42), (wall, d * 0.88, h * 0.62), m["clear_acrylic"], bevel=0.004, category="buffer tank")
    box("Sub-Cell right wall", (w * 0.46, 0.0, h * 0.42), (wall, d * 0.88, h * 0.62), m["clear_acrylic"], bevel=0.004, category="buffer tank")
    box("Sub-Cell front wall", (0.0, -d * 0.44, h * 0.42), (w * 0.90, wall, h * 0.62), m["clear_acrylic"], bevel=0.004, category="buffer tank")
    box("Sub-Cell rear wall", (0.0, d * 0.44, h * 0.42), (w * 0.90, wall, h * 0.62), m["clear_acrylic"], bevel=0.004, category="buffer tank")
    box("Sub-Cell buffer liquid", (0.0, 0.0, h * 0.32), (w * 0.84, d * 0.78, h * 0.34), m["buffer_liquid"], bevel=0.010, category="buffer")
    box("Sub-Cell UV gel tray", (0.0, 0.0, h * 0.43), (w * 0.55, d * 0.60, h * 0.035), m["clear_acrylic"], bevel=0.004, category="gel tray")
    box("Sub-Cell agarose gel", (0.0, 0.0, h * 0.46), (w * 0.48, d * 0.50, h * 0.025), m["ice_clear"], bevel=0.004, category="gel")
    for row in range(2):
        y = -d * 0.12 + row * d * 0.22
        box(f"Sub-Cell comb rail {row + 1}", (0.0, y, h * 0.58), (w * 0.45, 0.010, h * 0.08), m["instrument_gray"], bevel=0.002, category="comb")
        for tooth in range(12):
            x = -w * 0.20 + tooth * w * 0.40 / 11
            box(f"Sub-Cell comb tooth {row + 1}-{tooth + 1}", (x, y, h * 0.515), (0.006, 0.010, h * 0.08), m["instrument_gray"], bevel=0.001, category="comb")
    for side, material in ((-1.0, m["soft_red"]), (1.0, m["soft_blue"])):
        x = side * w * 0.40
        cylinder(f"Sub-Cell terminal {side:+.0f}", (x, d * 0.33, h * 0.77), w * 0.035, h * 0.18, material, vertices=28, category="electrical terminal")
        cylinder(f"Sub-Cell electrode {side:+.0f}", (x, 0.0, h * 0.35), 0.004, d * 0.74, m["zinc"], axis=(0.0, 1.0, 0.0), vertices=16, category="electrode")
        tube(f"Sub-Cell lead {side:+.0f}", [(x, d * 0.33, h * 0.80), (x, d * 0.48, h * 0.90), (side * w * 0.46, d * 0.52, h * 0.94)], 0.006, material, category="electrical lead")
    box("Sub-Cell clear safety lid", (0.0, 0.0, h * 0.79), (w * 0.97, d * 0.95, h * 0.055), m["clear_acrylic"], bevel=0.012, category="safety lid")
    tube("Sub-Cell lid handle", [(-w * 0.10, -d * 0.02, h * 0.83), (-w * 0.10, -d * 0.02, h * 0.92), (w * 0.10, -d * 0.02, h * 0.92), (w * 0.10, -d * 0.02, h * 0.83)], 0.007, m["light_aluminum"], category="lid handle")


def build_gel_doc(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    front = -d / 2
    rear = d / 2
    box("GelDoc formed optical chassis", (0.0, 0.0, h * 0.43), (w * 0.94, d * 0.94, h * 0.80), m["instrument_white"], bevel=0.028, category="imager chassis")
    box("GelDoc lower silver base", (0.0, 0.015, h * 0.07), (w * 0.96, d * 0.92, h * 0.12), m["light_aluminum"], bevel=0.014, category="base")
    box("GelDoc front imaging chamber recess", (0.0, front - 0.006, h * 0.40), (w * 0.73, 0.026, h * 0.48), m["shadow"], bevel=0.016, category="imaging chamber")
    box("GelDoc amber chamber window", (0.0, front - 0.022, h * 0.44), (w * 0.60, 0.010, h * 0.30), m["washer_glass"], bevel=0.012, category="imaging window")
    box("GelDoc sample tray", (0.0, front - 0.052, h * 0.20), (w * 0.66, d * 0.12, h * 0.045), m["light_aluminum"], bevel=0.010, category="sample tray")
    tube("GelDoc tray handle", [(-w * 0.16, front - 0.075, h * 0.18), (-w * 0.16, front - 0.09, h * 0.16), (w * 0.16, front - 0.09, h * 0.16), (w * 0.16, front - 0.075, h * 0.18)], 0.008, m["silver"], category="tray handle")
    box("GelDoc camera tower", (0.0, d * 0.16, h * 0.71), (w * 0.62, d * 0.42, h * 0.34), m["instrument_white"], bevel=0.022, category="camera tower")
    cylinder("GelDoc camera optic", (0.0, d * 0.04, h * 0.63), w * 0.085, h * 0.055, m["optic_glass"], vertices=48, category="camera optic")
    box("GelDoc touch display pedestal", (w * 0.23, -d * 0.02, h * 0.78), (w * 0.07, d * 0.12, h * 0.24), m["light_aluminum"], bevel=0.008, rotation=(math.radians(-12), 0.0, 0.0), category="display mount")
    box("GelDoc touch display", (w * 0.23, -d * 0.10, h * 0.83), (w * 0.42, 0.025, h * 0.30), m["display_glass"], bevel=0.016, rotation=(math.radians(-12), 0.0, 0.0), category="touch display")
    box("GelDoc active screen", (w * 0.23, -d * 0.116, h * 0.83), (w * 0.34, 0.003, h * 0.22), m["screen"], bevel=0.006, rotation=(math.radians(-12), 0.0, 0.0), category="touch display")
    for index in range(4):
        box(f"GelDoc screen line {index + 1}", (w * 0.19, -d * 0.120, h * (0.89 - index * 0.045)), (w * (0.18 + index * 0.025), 0.002, h * 0.012), m["display_teal"], bevel=0.001, rotation=(math.radians(-12), 0.0, 0.0), category="screen graphics")
    add_vent_rows("GelDoc left ventilation", (-w * 0.472, d * 0.12, h * 0.34), d * 0.46, 5, 8, face="right", slot_height=0.007)
    add_vent_rows("GelDoc right ventilation", (w * 0.472, d * 0.12, h * 0.34), d * 0.46, 5, 8, face="right", slot_height=0.007)
    box("GelDoc rear service cover", (0.0, rear + 0.004, h * 0.38), (w * 0.72, 0.008, h * 0.48), m["instrument_gray"], bevel=0.006, category="rear service")
    for index, x in enumerate((-w * 0.24, -w * 0.08, w * 0.08, w * 0.24), 1):
        cylinder(f"GelDoc rear connector {index}", (x, rear + 0.011, h * 0.26), w * 0.026, 0.012, m["silver"], axis=(0.0, 1.0, 0.0), vertices=24, category="rear connector")
    add_feet(w * 0.74, d * 0.74, radius=0.010)


def build_ice_maker(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    front = -d / 2
    rear = d / 2
    body_bottom = h * 0.105
    box("ice maker stainless chassis", (0.0, 0.0, h * 0.52), (w * 0.96, d * 0.95, h * 0.82), m["chamber_stainless"], bevel=0.018, category="appliance chassis")
    box("ice maker top cap", (0.0, 0.0, h * 0.945), (w * 0.98, d * 0.97, h * 0.035), m["light_aluminum"], bevel=0.008, category="top")
    box("ice maker storage door", (0.0, front - 0.006, h * 0.62), (w * 0.88, 0.022, h * 0.49), m["instrument_white"], bevel=0.012, category="storage door")
    box("ice maker recessed handle", (0.0, front - 0.023, h * 0.84), (w * 0.44, 0.018, h * 0.055), m["instrument_gray"], bevel=0.012, category="door handle")
    box("ice maker control strip", (0.0, front - 0.026, h * 0.91), (w * 0.82, 0.012, h * 0.052), m["light_aluminum"], bevel=0.006, category="control strip")
    for index, x in enumerate((-w * 0.10, -w * 0.04, w * 0.02, w * 0.08), 1):
        cylinder(f"ice maker status light {index}", (x, front - 0.035, h * 0.91), w * 0.011, 0.005, m[("status_green", "display_teal", "silver", "soft_blue")[index - 1]], axis=(0.0, -1.0, 0.0), vertices=20, category="control")
    box("ice maker lower compressor grille", (0.0, front - 0.009, h * 0.25), (w * 0.82, 0.018, h * 0.22), m["instrument_gray"], bevel=0.009, category="compressor grille")
    add_vent_rows("ice maker compressor", (0.0, front - 0.021, h * 0.25), w * 0.66, 7, 13, slot_height=0.010)
    for side in (-1.0, 1.0):
        add_vent_rows(f"ice maker side ventilation {side:+.0f}", (side * w * 0.485, d * 0.08, h * 0.40), d * 0.56, 7, 8, face="right", slot_height=0.010)
    box("ice maker rear galvanized service panel", (0.0, rear + 0.003, h * 0.43), (w * 0.85, 0.008, h * 0.54), m["instrument_gray"], bevel=0.006, category="rear service")
    add_vent_rows("ice maker rear condenser", (0.0, rear + 0.009, h * 0.51), w * 0.64, 10, 13, slot_height=0.010)
    for x, z, material in ((-w * 0.20, h * 0.17, m["soft_blue"]), (0.0, h * 0.17, m["zinc"]), (w * 0.20, h * 0.17, m["rubber"])):
        cylinder(f"ice maker rear service {x:.2f}", (x, rear + 0.013, z), w * 0.026, 0.016, material, axis=(0.0, 1.0, 0.0), vertices=24, category="water and drain service")
    for x in (-w * 0.39, w * 0.39):
        for y in (-d * 0.35, d * 0.35):
            cylinder(f"ice maker leveling leg {x:.2f}-{y:.2f}", (x, y, h * 0.055), w * 0.025, h * 0.11, m["silver"], vertices=28, category="leveling leg")
            cylinder(f"ice maker rubber foot {x:.2f}-{y:.2f}", (x, y, h * 0.012), w * 0.038, h * 0.024, m["rubber"], vertices=28, category="foot")


def build_glassware_washer(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    w, d, h = spec.width, spec.depth, spec.height
    front = -d / 2
    rear = d / 2
    box("FlaskScrubber stainless chassis", (0.0, 0.0, h * 0.51), (w * 0.96, d * 0.95, h * 0.91), m["chamber_stainless"], bevel=0.017, category="washer chassis")
    box("FlaskScrubber top cap", (0.0, 0.0, h * 0.975), (w * 0.98, d * 0.97, h * 0.032), m["light_aluminum"], bevel=0.007, category="top")
    box("FlaskScrubber door frame", (0.0, front - 0.008, h * 0.48), (w * 0.88, 0.025, h * 0.72), m["instrument_white"], bevel=0.014, category="washer door")
    box("FlaskScrubber observation window", (0.0, front - 0.026, h * 0.50), (w * 0.68, 0.010, h * 0.52), m["washer_glass"], bevel=0.018, category="observation window")
    box("FlaskScrubber chamber back", (0.0, -d * 0.06, h * 0.50), (w * 0.65, 0.010, h * 0.48), m["chamber_stainless"], bevel=0.006, category="wash chamber")
    for tier, z in enumerate((h * 0.34, h * 0.57), 1):
        for rail in range(6):
            y = -d * 0.20 + rail * d * 0.33 / 5
            tube(f"FlaskScrubber rack rail {tier}-{rail + 1}", [(-w * 0.28, y, z), (w * 0.28, y, z)], 0.004, m["silver"], category="washer rack")
        for spindle_index in range(8):
            x = -w * 0.24 + spindle_index * w * 0.48 / 7
            tube(f"FlaskScrubber spindle {tier}-{spindle_index + 1}", [(x, -d * 0.03, z), (x, -d * 0.03, z + h * 0.12)], 0.004, m["silver"], category="washer spindle")
    tube("FlaskScrubber upper spray arm", [(-w * 0.22, -d * 0.03, h * 0.72), (w * 0.22, -d * 0.03, h * 0.72)], 0.010, m["light_aluminum"], category="spray arm")
    cylinder("FlaskScrubber spray hub", (0.0, -d * 0.03, h * 0.72), w * 0.035, h * 0.04, m["silver"], vertices=32, category="spray arm")
    box("FlaskScrubber upper control fascia", (0.0, front - 0.017, h * 0.90), (w * 0.88, 0.025, h * 0.12), m["instrument_gray"], bevel=0.010, category="control fascia")
    add_front_display("FlaskScrubber", (-w * 0.16, front - 0.034, h * 0.90), w * 0.38, h * 0.075, readout_rows=2, key_count=4)
    tube("FlaskScrubber full-width handle", [(-w * 0.34, front - 0.058, h * 0.82), (-w * 0.34, front - 0.082, h * 0.80), (w * 0.34, front - 0.082, h * 0.80), (w * 0.34, front - 0.058, h * 0.82)], 0.011, m["silver"], category="door handle")
    for side in (-1.0, 1.0):
        add_vent_rows(f"FlaskScrubber side drying vent {side:+.0f}", (side * w * 0.485, d * 0.15, h * 0.27), d * 0.44, 6, 7, face="right", slot_height=0.009)
    box("FlaskScrubber rear service panel", (0.0, rear + 0.004, h * 0.48), (w * 0.82, 0.008, h * 0.70), m["instrument_gray"], bevel=0.006, category="rear service panel")
    add_vent_rows("FlaskScrubber rear drying unit", (0.0, rear + 0.010, h * 0.70), w * 0.58, 7, 12, slot_height=0.010)
    for index, (x, material) in enumerate(((-w * 0.25, m["soft_blue"]), (-w * 0.08, m["soft_red"]), (w * 0.09, m["zinc"]), (w * 0.25, m["rubber"])), 1):
        cylinder(f"FlaskScrubber rear connection {index}", (x, rear + 0.014, h * 0.20), w * 0.026, 0.018, material, axis=(0.0, 1.0, 0.0), vertices=24, category="water drain electrical service")
    for x in (-w * 0.38, w * 0.38):
        for y in (-d * 0.36, d * 0.36):
            cylinder(f"FlaskScrubber leveling foot {x:.2f}-{y:.2f}", (x, y, h * 0.025), w * 0.030, h * 0.05, m["rubber"], vertices=28, category="foot")


BUILDERS = {
    "laminar-flow": build_laminar_flow,
    "stereo-microscope": build_stereo_microscope,
    "electrophoresis-tank": build_electrophoresis_tank,
    "gel-doc": build_gel_doc,
    "ice-maker": build_ice_maker,
    "glassware-washer": build_glassware_washer,
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
    instruments.add_batch_materials()
    add_batch_materials()
    BUILDERS[spec.asset_id](spec)

    if furniture.ROOT is not None:
        furniture.ROOT["display_name"] = spec.asset_id.replace("-", " ").title()
        furniture.ROOT["revision"] = "remaining-equipment-batch11-r1"
        furniture.ROOT["planning_model"] = True
        furniture.ROOT["manufacturer_certified"] = False
        furniture.ROOT["primary_finish_policy"] = (
            "Cool white, light metallic gray, brushed stainless and aluminum; "
            "dark materials limited to screens, seals, optics, vents and functional chambers."
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
    print("LABSPACE_REMAINING_EQUIPMENT_BATCH11_BUILD " + json.dumps(results, sort_keys=True))


if __name__ == "__main__":
    main()
