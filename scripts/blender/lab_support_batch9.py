"""Author high-visibility Room 809 support, process, and safety assets.

These original, logo-free planning models replace the last procedural objects
that remain visually prominent in the Room 809 Digital Twin: a stainless
process vessel, tall retort support assembly, emergency eyewash, portable fire
extinguisher, compressed-gas cylinder, and rolling bottle cart.  Anatomy and
proportions are informed by the supplied laboratory photographs and common
official laboratory/safety equipment construction.  The models are not
manufacturer-certified.
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
import lab_fidelity_batch6 as fidelity  # noqa: E402
import lab_furniture as furniture  # noqa: E402


AssetSpec = furniture.AssetSpec

ASSETS = {
    "rolling-bottle-cart": AssetSpec("rolling-bottle-cart", 0.650, 0.450, 1.000),
    "stainless-process-vessel": AssetSpec("stainless-process-vessel", 0.450, 0.450, 0.650),
    "retort-stand-assembly": AssetSpec("retort-stand-assembly", 0.600, 0.600, 1.800),
    "gas-cylinder": AssetSpec("gas-cylinder", 0.300, 0.300, 1.450),
    "eyewash": AssetSpec("eyewash", 0.450, 0.400, 1.050),
    "fire-extinguisher": AssetSpec("fire-extinguisher", 0.220, 0.220, 0.650),
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", choices=("all", *ASSETS.keys()), default="all")
    parser.add_argument("--output-dir", default="public/models/hero")
    parser.add_argument("--save-blend-dir", default="")
    parser.add_argument("--preview-dir", default="")
    return parser.parse_args(argv)


def add_materials() -> None:
    make = furniture.make_material
    furniture.MATERIALS.update(
        {
            "polished_stainless": make(
                "Polished process stainless steel",
                (0.88, 0.90, 0.91, 1.0),
                metallic=0.76,
                roughness=0.22,
                coat=0.24,
                coat_roughness=0.10,
                anisotropy=0.38,
            ),
            "safety_red": make(
                "Safety red powder coat",
                (0.73, 0.022, 0.014, 1.0),
                metallic=0.14,
                roughness=0.23,
                coat=0.34,
                coat_roughness=0.10,
            ),
            "safety_green": make(
                "Emergency equipment green",
                (0.015, 0.43, 0.25, 1.0),
                metallic=0.05,
                roughness=0.27,
                coat=0.23,
            ),
            "white_polymer": make(
                "Laboratory white polymer",
                (0.88, 0.91, 0.90, 1.0),
                roughness=0.28,
                coat=0.22,
                coat_roughness=0.14,
            ),
            "brass": make(
                "Valve brass",
                (0.49, 0.29, 0.075, 1.0),
                metallic=0.90,
                roughness=0.24,
            ),
            "blue_liquid": casework.make_transmissive_material(
                "Safety spray water", (0.08, 0.44, 0.64, 0.44), 0.68, 0.08
            ),
            "glass_clear": casework.make_transmissive_material(
                "Borosilicate process glass", (0.72, 0.91, 0.93, 0.24), 0.91, 0.045
            ),
            "label_blue": make(
                "Technical label blue",
                (0.025, 0.20, 0.48, 1.0),
                roughness=0.31,
                coat=0.08,
            ),
        }
    )


def box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: str,
    *,
    bevel: float = 0.004,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    category: str = "support detail",
) -> bpy.types.Object:
    return fidelity.add_box(
        name,
        location,
        dimensions,
        furniture.MATERIALS[material],
        bevel=bevel,
        rotation=rotation,
        category=category,
    )


def cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    material: str,
    *,
    axis: tuple[float, float, float] = (0.0, 0.0, 1.0),
    vertices: int = 40,
    bevel: float = 0.003,
    category: str = "support detail",
) -> bpy.types.Object:
    return furniture.add_cylinder(
        name,
        location,
        radius,
        depth,
        furniture.MATERIALS[material],
        axis=axis,
        vertices=vertices,
        bevel=bevel,
        category=category,
    )


def cylinder_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    material: str,
    *,
    vertices: int = 32,
    category: str = "support hardware",
) -> bpy.types.Object:
    return fidelity.add_cylinder_between(
        name,
        start,
        end,
        radius,
        furniture.MATERIALS[material],
        vertices=vertices,
        category=category,
    )


def sphere(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: str,
    *,
    category: str = "formed detail",
) -> bpy.types.Object:
    return fidelity.add_sphere(
        name,
        location,
        scale,
        furniture.MATERIALS[material],
        category=category,
    )


def torus(
    name: str,
    location: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    material: str,
    *,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    category: str = "formed detail",
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=48,
        minor_segments=12,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    furniture.assign_material(obj, furniture.MATERIALS[material])
    furniture.smooth(obj)
    return furniture.parent_to_root(obj, category)


def tube(
    name: str,
    points: list[tuple[float, float, float]],
    radius: float,
    material: str,
    *,
    cyclic: bool = False,
    category: str = "tube",
) -> bpy.types.Object:
    curve = bpy.data.curves.new(name=name, type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    curve.resolution_u = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for control, point in zip(spline.bezier_points, points):
        control.co = point
        control.handle_left_type = "AUTO"
        control.handle_right_type = "AUTO"
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    furniture.assign_material(obj, furniture.MATERIALS[material])
    return furniture.parent_to_root(obj, category)


def bottle(name: str, x: float, y: float, base_z: float, scale: float = 1.0) -> None:
    cylinder(
        f"{name} body",
        (x, y, base_z + 0.075 * scale),
        0.034 * scale,
        0.150 * scale,
        "white_polymer",
        bevel=0.004,
        category="reagent bottle",
    )
    cylinder(
        f"{name} shoulder",
        (x, y, base_z + 0.151 * scale),
        0.027 * scale,
        0.022 * scale,
        "powder_light",
        bevel=0.004,
        category="reagent bottle",
    )
    cylinder(
        f"{name} cap",
        (x, y, base_z + 0.174 * scale),
        0.024 * scale,
        0.028 * scale,
        "label_blue",
        bevel=0.002,
        category="bottle cap",
    )
    box(
        f"{name} label",
        (x, y - 0.034 * scale, base_z + 0.086 * scale),
        (0.044 * scale, 0.002 * scale, 0.055 * scale),
        "label",
        bevel=0.001,
        category="bottle label",
    )


def caster(name: str, x: float, y: float) -> None:
    cylinder(
        f"{name} wheel",
        (x, y, 0.040),
        0.038,
        0.026,
        "rubber",
        axis=(1.0, 0.0, 0.0),
        vertices=28,
        bevel=0.004,
        category="caster",
    )
    cylinder_between(
        f"{name} fork",
        (x, y, 0.064),
        (x, y, 0.096),
        0.009,
        "stainless",
        category="caster",
    )


def build_bottle_cart(_: AssetSpec) -> None:
    for index, z in enumerate((0.13, 0.43, 0.73)):
        box(
            f"Stainless tray {index + 1}",
            (0.0, 0.0, z),
            (0.56, 0.39, 0.035),
            "stainless",
            bevel=0.008,
            category="spill-containment shelf",
        )
        for y, side in ((-0.185, "front"), (0.185, "rear")):
            cylinder_between(
                f"Tray {index + 1} {side} bottle rail",
                (-0.255, y, z + 0.11),
                (0.255, y, z + 0.11),
                0.009,
                "stainless",
                category="bottle restraint",
            )
    for x in (-0.27, 0.27):
        for y in (-0.185, 0.185):
            cylinder_between(
                f"Cart post {x:+.2f} {y:+.2f}",
                (x, y, 0.10),
                (x, y, 0.84),
                0.012,
                "stainless",
                category="cart frame",
            )
            caster(f"Caster {x:+.2f} {y:+.2f}", x, y)
    tube(
        "Rear push handle",
        [(-0.25, 0.19, 0.80), (-0.25, 0.19, 0.95), (0.25, 0.19, 0.95), (0.25, 0.19, 0.80)],
        0.014,
        "stainless",
        category="push handle",
    )
    for shelf_z, count in ((0.15, 4), (0.45, 3), (0.75, 2)):
        for index in range(count):
            x = (index - (count - 1) / 2) * 0.115
            bottle(f"Cart bottle {shelf_z:.2f}-{index}", x, -0.02, shelf_z + 0.02, 0.78)


def build_process_vessel(_: AssetSpec) -> None:
    cylinder("Jacketed vessel body", (0, 0, 0.305), 0.195, 0.47, "polished_stainless", bevel=0.008, category="process vessel")
    sphere("Lower dished head", (0, 0, 0.082), (0.192, 0.192, 0.070), "polished_stainless", category="process vessel")
    torus("Lower jacket weld", (0, 0, 0.135), 0.190, 0.006, "stainless", category="weld seam")
    torus("Upper jacket weld", (0, 0, 0.510), 0.190, 0.006, "stainless", category="weld seam")
    cylinder("Removable lid", (0, 0, 0.555), 0.207, 0.046, "stainless", bevel=0.007, category="lid")
    torus("Lid rolled rim", (0, 0, 0.576), 0.202, 0.008, "polished_stainless", category="lid")
    tube("Lid bridge handle", [(-0.065, 0, 0.582), (-0.065, 0, 0.628), (0.065, 0, 0.628), (0.065, 0, 0.582)], 0.010, "stainless", category="lid handle")
    for side in (-1, 1):
        tube(
            f"Side lifting handle {side}",
            [(side * 0.190, -0.065, 0.35), (side * 0.225, -0.065, 0.35), (side * 0.225, 0.065, 0.35), (side * 0.190, 0.065, 0.35)],
            0.009,
            "stainless",
            category="lifting handle",
        )
    cylinder_between("Front drain neck", (0, -0.195, 0.155), (0, -0.225, 0.155), 0.014, "stainless", category="drain valve")
    cylinder("Drain valve body", (0, -0.238, 0.155), 0.027, 0.036, "brass", axis=(0, 1, 0), bevel=0.003, category="drain valve")
    box("Drain lever", (0.045, -0.240, 0.190), (0.090, 0.012, 0.014), "safety_green", bevel=0.004, rotation=(0, 0.35, 0), category="drain valve")
    box("Vessel capacity plate", (0, -0.198, 0.315), (0.11, 0.004, 0.075), "label", bevel=0.002, category="technical label")
    for x in (-0.11, 0.11):
        box(f"Capacity mark {x:+.2f}", (x, -0.201, 0.315), (0.006, 0.003, 0.052), "label_blue", bevel=0.001, category="technical label")


def add_boss_head(name: str, x: float, y: float, z: float) -> None:
    box(name, (x, y, z), (0.055, 0.052, 0.046), "aluminum", bevel=0.008, category="boss head")
    cylinder(f"{name} vertical screw", (x - 0.035, y, z), 0.010, 0.065, "black", axis=(1, 0, 0), bevel=0.002, category="boss head")
    cylinder(f"{name} clamp screw", (x, y - 0.036, z), 0.010, 0.065, "black", axis=(0, 1, 0), bevel=0.002, category="boss head")


def add_clamp(name: str, start: tuple[float, float, float], end: tuple[float, float, float]) -> None:
    cylinder_between(f"{name} shank", start, end, 0.007, "stainless", category="retort clamp")
    tip = Vector(end)
    direction = (tip - Vector(start)).normalized()
    normal = Vector((-direction.y, direction.x, 0))
    for side in (-1, 1):
        jaw_start = tip + normal * side * 0.010
        jaw_end = tip + normal * side * 0.042 + direction * 0.045
        cylinder_between(f"{name} jaw {side}", tuple(jaw_start), tuple(jaw_end), 0.005, "aluminum", category="retort clamp")
        sphere(f"{name} jaw pad {side}", tuple(jaw_end), (0.010, 0.010, 0.010), "white_polymer", category="clamp pad")


def add_glass_condenser() -> None:
    cylinder("Condenser glass jacket", (0.03, -0.045, 1.19), 0.052, 0.64, "glass_clear", bevel=0.002, category="condenser")
    cylinder("Condenser vapor tube", (0.03, -0.045, 1.19), 0.014, 0.61, "glass_clear", bevel=0.001, category="condenser")
    turns = 11
    points = []
    for step in range(turns * 18 + 1):
        theta = step / 18 * math.tau
        points.append((0.03 + math.cos(theta) * 0.030, -0.045 + math.sin(theta) * 0.030, 0.91 + step / (turns * 18) * 0.56))
    tube("Condenser coolant coil", points, 0.006, "blue_liquid", category="coolant coil")
    for z in (0.88, 1.50):
        cylinder(f"Condenser joint {z}", (0.03, -0.045, z), 0.026, 0.055, "glass_clear", bevel=0.002, category="ground glass joint")
    tube("Coolant inlet hose", [(0.075, -0.045, 0.96), (0.13, -0.08, 0.92), (0.19, -0.08, 0.88)], 0.008, "blue", category="coolant hose")
    tube("Coolant outlet hose", [(0.075, -0.045, 1.42), (0.13, -0.10, 1.48), (0.19, -0.10, 1.52)], 0.008, "blue", category="coolant hose")


def build_retort_assembly(_: AssetSpec) -> None:
    box("Heavy retort base", (0, 0, 0.034), (0.46, 0.36, 0.060), "powder_light", bevel=0.012, category="retort base")
    box("Base wear plate", (0, -0.01, 0.068), (0.42, 0.30, 0.012), "stainless", bevel=0.004, category="retort base")
    for x in (-0.20, 0.20):
        for y in (-0.15, 0.15):
            cylinder(f"Base foot {x:+.2f} {y:+.2f}", (x, y, 0.008), 0.025, 0.016, "rubber", bevel=0.003, category="retort foot")
    for x in (-0.18, 0.0, 0.18):
        cylinder_between(f"Vertical support rod {x:+.2f}", (x, 0.08, 0.07), (x, 0.08, 1.73), 0.010, "stainless", category="support rod")
    for z in (0.75, 1.16, 1.58):
        cylinder_between(f"Horizontal support rail {z}", (-0.25, 0.08, z), (0.25, 0.08, z), 0.009, "stainless", category="support rail")
    add_boss_head("Upper condenser boss", 0.0, 0.08, 1.44)
    add_boss_head("Lower condenser boss", 0.0, 0.08, 0.95)
    add_boss_head("Receiving flask boss", -0.18, 0.08, 0.70)
    add_clamp("Upper condenser clamp", (0.0, 0.04, 1.44), (0.03, -0.035, 1.44))
    add_clamp("Lower condenser clamp", (0.0, 0.04, 0.95), (0.03, -0.035, 0.95))
    add_clamp("Receiving flask clamp", (-0.18, 0.04, 0.70), (-0.10, -0.08, 0.68))
    add_glass_condenser()
    sphere("Receiving flask", (-0.11, -0.10, 0.54), (0.115, 0.115, 0.125), "glass_clear", category="receiving flask")
    cylinder("Receiving flask neck", (-0.11, -0.10, 0.675), 0.026, 0.12, "glass_clear", bevel=0.002, category="receiving flask")
    sphere("Process flask", (0.20, -0.09, 0.76), (0.105, 0.105, 0.115), "glass_clear", category="process flask")
    cylinder("Process flask neck", (0.20, -0.09, 0.88), 0.024, 0.11, "glass_clear", bevel=0.002, category="process flask")
    tube("Vacuum hose", [(0.03, -0.05, 1.50), (-0.08, -0.23, 1.57), (-0.25, -0.24, 1.38), (-0.25, -0.20, 0.95)], 0.010, "rubber", category="vacuum hose")


def build_gas_cylinder(_: AssetSpec) -> None:
    cylinder("Gas cylinder body", (0, 0, 0.64), 0.132, 1.12, "polished_stainless", bevel=0.010, category="pressure cylinder")
    sphere("Cylinder shoulder", (0, 0, 1.19), (0.132, 0.132, 0.13), "polished_stainless", category="pressure cylinder")
    cylinder("Cylinder base ring", (0, 0, 0.045), 0.142, 0.090, "powder_dark", bevel=0.006, category="cylinder foot ring")
    cylinder("Cylinder neck", (0, 0, 1.305), 0.048, 0.16, "safety_green", bevel=0.006, category="cylinder neck")
    torus("Shoulder identification band", (0, 0, 1.225), 0.118, 0.010, "safety_green", category="cylinder marking")
    cylinder("Valve body", (0, 0, 1.395), 0.030, 0.080, "brass", bevel=0.003, category="cylinder valve")
    cylinder("Valve handwheel", (0, 0, 1.435), 0.048, 0.012, "black", bevel=0.003, category="cylinder valve")
    for angle in range(0, 360, 45):
        theta = math.radians(angle)
        cylinder_between("Valve handwheel spoke", (0, 0, 1.435), (math.cos(theta) * 0.044, math.sin(theta) * 0.044, 1.435), 0.004, "black", category="cylinder valve")
    tube("Cylinder restraint chain", [(-0.14, -0.02, 0.88), (-0.08, -0.15, 0.90), (0.08, -0.15, 0.90), (0.14, -0.02, 0.88)], 0.006, "zinc", category="restraint chain")
    box("Gas identification label", (0, -0.133, 0.66), (0.11, 0.004, 0.16), "label", bevel=0.002, category="technical label")
    box("Gas label stripe", (0, -0.136, 0.70), (0.085, 0.003, 0.018), "label_blue", bevel=0.001, category="technical label")


def build_eyewash(_: AssetSpec) -> None:
    box("Eyewash base plate", (0, 0.04, 0.020), (0.29, 0.24, 0.040), "stainless", bevel=0.008, category="pedestal base")
    cylinder_between("Supply pedestal", (0, 0.08, 0.04), (0, 0.08, 0.73), 0.027, "stainless", category="water supply")
    cylinder("Stainless eyewash bowl", (0, -0.015, 0.745), 0.195, 0.105, "polished_stainless", bevel=0.009, category="eyewash bowl")
    torus("Eyewash bowl rolled rim", (0, -0.015, 0.795), 0.190, 0.011, "stainless", category="eyewash bowl")
    cylinder("Bowl interior", (0, -0.015, 0.803), 0.165, 0.010, "powder_dark", bevel=0.002, category="eyewash bowl")
    cylinder_between("Drain tail", (0, -0.015, 0.69), (0, 0.08, 0.55), 0.020, "stainless", category="drain")
    for side in (-1, 1):
        x = side * 0.075
        cylinder_between(f"Spray riser {side}", (x, -0.015, 0.79), (x, -0.015, 0.875), 0.012, "stainless", category="spray head")
        cylinder(f"Aerated spray head {side}", (x, -0.015, 0.892), 0.030, 0.034, "white_polymer", bevel=0.005, category="spray head")
        cylinder(f"Green dust cap {side}", (x, -0.015, 0.912), 0.027, 0.014, "safety_green", bevel=0.004, category="spray head")
        cylinder(f"Water plume {side}", (x, -0.015, 0.953), 0.010, 0.060, "blue_liquid", bevel=0.002, category="water spray")
    box("Stay-open push plate", (0, -0.155, 0.62), (0.16, 0.018, 0.085), "safety_green", bevel=0.010, rotation=(math.radians(-12), 0, 0), category="activation control")
    box("Eyewash symbol plate", (0, 0.075, 0.98), (0.25, 0.018, 0.12), "safety_green", bevel=0.005, category="safety sign")
    box("Eyewash sign insert", (0, 0.064, 0.98), (0.17, 0.004, 0.050), "label", bevel=0.002, category="safety sign")


def build_fire_extinguisher(_: AssetSpec) -> None:
    cylinder("Extinguisher cylinder", (0, 0, 0.286), 0.090, 0.480, "safety_red", bevel=0.010, category="pressure vessel")
    sphere("Extinguisher domed shoulder", (0, 0, 0.515), (0.090, 0.090, 0.070), "safety_red", category="pressure vessel")
    cylinder("Extinguisher foot ring", (0, 0, 0.030), 0.097, 0.060, "rubber", bevel=0.005, category="foot ring")
    cylinder("Valve neck", (0, 0, 0.575), 0.029, 0.080, "brass", bevel=0.003, category="valve")
    box("Carry handle", (-0.025, 0, 0.615), (0.120, 0.024, 0.026), "black", bevel=0.006, rotation=(0, 0, math.radians(10)), category="handle")
    box("Squeeze lever", (0.030, -0.006, 0.638), (0.115, 0.018, 0.016), "stainless", bevel=0.004, rotation=(0, 0, math.radians(-8)), category="handle")
    cylinder("Pressure gauge", (0.055, -0.025, 0.590), 0.026, 0.018, "label", axis=(0, -1, 0), bevel=0.003, category="pressure gauge")
    cylinder("Gauge bezel", (0.055, -0.036, 0.590), 0.030, 0.006, "black", axis=(0, -1, 0), bevel=0.002, category="pressure gauge")
    tube("Discharge hose", [(0.075, 0, 0.585), (0.105, -0.02, 0.50), (0.105, -0.03, 0.28), (0.085, -0.03, 0.16)], 0.010, "rubber", category="discharge hose")
    cylinder("Discharge nozzle", (0.082, -0.03, 0.125), 0.019, 0.100, "black", axis=(0, 0, 1), bevel=0.004, category="nozzle")
    box("Instruction label", (0, -0.092, 0.335), (0.105, 0.004, 0.175), "label", bevel=0.003, category="instruction label")
    for index, color in enumerate(("label_blue", "safety_red", "label_blue")):
        box(f"Instruction stripe {index}", (0, -0.095, 0.39 - index * 0.045), (0.080, 0.003, 0.014), color, bevel=0.001, category="instruction label")
    box("Wall bracket back", (0, 0.099, 0.31), (0.055, 0.012, 0.26), "zinc", bevel=0.003, category="mounting bracket")
    tube("Cylinder retention strap", [(-0.092, 0.01, 0.35), (-0.10, -0.075, 0.35), (0.10, -0.075, 0.35), (0.092, 0.01, 0.35)], 0.006, "black", category="mounting bracket")


BUILDERS = {
    "rolling-bottle-cart": build_bottle_cart,
    "stainless-process-vessel": build_process_vessel,
    "retort-stand-assembly": build_retort_assembly,
    "gas-cylinder": build_gas_cylinder,
    "eyewash": build_eyewash,
    "fire-extinguisher": build_fire_extinguisher,
}


def convert_curves_to_meshes() -> None:
    """Freeze tubes before envelope fitting and material batching.

    Blender's bounds helper intentionally measures meshes only. Converting the
    authored Bezier hoses and handles first keeps the fitted/exported envelope
    identical and lets the shared material batcher merge them efficiently.
    """

    for obj in list(bpy.context.scene.objects):
        if obj.type != "CURVE":
            continue
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target="MESH")
        obj.select_set(False)


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
    fidelity.validate_statistics(spec, stats, imported=True)
    return stats


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
    fidelity.add_batch_materials()
    add_materials()
    BUILDERS[spec.asset_id](spec)
    convert_curves_to_meshes()

    if furniture.ROOT is not None:
        furniture.ROOT["display_name"] = spec.asset_id.replace("-", " ").title()
        furniture.ROOT["revision"] = "support-batch9-r1"
        furniture.ROOT["asset_class"] = "laboratory support and safety equipment"
        furniture.ROOT["planning_model"] = True
        furniture.ROOT["manufacturer_certified"] = False
        furniture.ROOT["source_note"] = (
            "Original LabSpace geometry informed by Room 809 photographs and common "
            "official laboratory/safety equipment anatomy; no logos or downloaded geometry."
        )

    batching, authored = fidelity.fit_to_dimensions(spec)
    fidelity.validate_statistics(spec, authored, imported=False)
    if furniture.ROOT is not None:
        furniture.ROOT["authored_bounds_m"] = authored["bounds_m"]["dimensions"]
        furniture.ROOT["source_part_count"] = batching["source_parts"]
        furniture.ROOT["runtime_material_batches"] = batching["runtime_batches"]

    if save_blend_dir is not None:
        save_blend_dir.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(save_blend_dir / f"{spec.asset_id}.blend"))

    output_path = output_dir / f"{spec.asset_id}.glb"
    furniture.export_glb(output_path)
    imported = inspect_export(spec, output_path)
    if preview_dir is not None:
        imported["previews"] = fidelity.render_qa_views(spec, preview_dir)
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
    print("LABSPACE_SUPPORT_BATCH9_BUILD " + json.dumps(results, sort_keys=True))


if __name__ == "__main__":
    main()
