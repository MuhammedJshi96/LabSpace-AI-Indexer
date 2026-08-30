"""Build the LabSpace reference-driven casework and wash-station batch.

The models are original, logo-free planning assets authored from the user's
laboratory photographs and supplied product-category references.  Dimensions
are representative, editable envelopes rather than manufacturer-certified
measurements.  Every exported face is real geometry so the same GLB can drive
the 3D room, the 2D top render, and the Asset Library isometric render.

Run with Blender 4.5 LTS from the repository root::

    blender --background --factory-startup \
      --python scripts/blender/lab_casework_batch3.py -- \
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

import lab_furniture as furniture  # noqa: E402


AssetSpec = furniture.AssetSpec

ASSETS = {
    "lab-bench-sink": AssetSpec("lab-bench-sink", 1.80, 0.75, 1.20),
    "lab-bench-overhead": AssetSpec("lab-bench-overhead", 2.40, 0.75, 2.10),
    "stainless-wash-basin": AssetSpec("stainless-wash-basin", 1.80, 0.70, 1.30),
    "stainless-enclosed-basin": AssetSpec("stainless-enclosed-basin", 1.20, 0.70, 1.20),
    "island-bench-service-bridge": AssetSpec(
        "island-bench-service-bridge", 3.60, 1.20, 2.10
    ),
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", choices=("all", *ASSETS.keys()), default="all")
    parser.add_argument("--output-dir", default="public/models/hero")
    parser.add_argument("--save-blend-dir", default="")
    parser.add_argument("--preview-dir", default="")
    return parser.parse_args(argv)


def add_reference_materials() -> None:
    """Extend the shared casework palette with glass, water, and steel grades."""

    make = furniture.make_material
    furniture.MATERIALS.update(
        {
            "stainless_bright": make(
                "Bright brushed stainless steel",
                (0.70, 0.73, 0.74, 1.0),
                metallic=0.98,
                roughness=0.16,
                anisotropy=0.82,
            ),
            "stainless_dark": make(
                "Shadowed brushed stainless steel",
                (0.30, 0.34, 0.35, 1.0),
                metallic=0.94,
                roughness=0.26,
                anisotropy=0.68,
            ),
            "glass": make_transmissive_material(
                "Low-iron cabinet glass", (0.70, 0.90, 0.93, 0.30), 0.88, 0.07
            ),
            "water": make_transmissive_material(
                "Clean basin water", (0.18, 0.55, 0.64, 0.34), 0.78, 0.12
            ),
            "frosted": make_transmissive_material(
                "Frosted safety glass", (0.68, 0.79, 0.80, 0.55), 0.46, 0.30
            ),
        }
    )


def make_transmissive_material(
    name: str,
    color: tuple[float, float, float, float],
    transmission: float,
    roughness: float,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    material.diffuse_color = color
    material.roughness = roughness
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    assert bsdf is not None
    furniture.set_socket(bsdf, "Base Color", color)
    furniture.set_socket(bsdf, "Roughness", roughness)
    furniture.set_socket(bsdf, "Alpha", color[3])
    furniture.set_socket(bsdf, "Transmission Weight", transmission)
    furniture.set_socket(bsdf, "IOR", 1.45 if name.startswith("Clean") else 1.52)
    furniture.set_socket(bsdf, "Coat Weight", 0.18)
    try:
        material.surface_render_method = "DITHERED"
        material.use_transparency_overlap = False
        material.use_screen_refraction = True
    except (AttributeError, TypeError):
        pass
    material["pbr_role"] = name
    return material


def add_torus(
    name: str,
    location: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    material: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    category: str = "hardware",
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
    furniture.assign_material(obj, material)
    furniture.smooth(obj)
    return furniture.parent_to_root(obj, category)


def add_curve_tube(
    name: str,
    points: list[tuple[float, float, float]],
    radius: float,
    material: bpy.types.Material,
    *,
    category: str = "plumbing",
) -> bpy.types.Object:
    curve = bpy.data.curves.new(name=f"{name} curve", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    curve.resolution_u = 12
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    furniture.assign_material(obj, material)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    furniture.smooth(obj)
    return furniture.parent_to_root(obj, category)


def add_material_witnesses(width: float, depth: float) -> None:
    """Add believable tiny service details while exercising the complete PBR set."""

    y = depth / 2.0 - 0.012
    materials = (
        ("blue", -0.19),
        ("red", -0.13),
        ("green", -0.07),
        ("yellow", -0.01),
        ("black", 0.05),
        ("zinc", 0.11),
        ("label", 0.17),
    )
    for key, x in materials:
        furniture.add_cylinder(
            f"Rear service witness {key}",
            (x, y, 0.765),
            0.010,
            0.008,
            furniture.MATERIALS[key],
            axis=(0.0, 1.0, 0.0),
            vertices=20,
            category="service detail",
        )


def add_base_casework(width: float, depth: float, *, sink_clearance: bool = False) -> None:
    """Build orbitable folded-steel base cabinetry with credible rear access."""

    m = furniture.MATERIALS
    front_y = -depth / 2.0 + 0.032
    rear_y = depth / 2.0 - 0.022
    furniture.add_box(
        "Continuous recessed plinth",
        (0.0, 0.018, 0.055),
        (width, depth - 0.11, 0.11),
        m["powder_dark"],
        bevel=0.006,
        category="plinth",
    )
    furniture.add_box(
        "Carcass lower pan",
        (0.0, 0.0, 0.125),
        (width - 0.06, depth - 0.075, 0.036),
        m["interior"],
        bevel=0.004,
        category="carcass",
    )
    furniture.add_box(
        "Carcass upper rail",
        (0.0, 0.0, 0.795),
        (width - 0.06, depth - 0.075, 0.045),
        m["aluminum"],
        bevel=0.004,
        category="carcass",
    )
    module_width = (width - 0.08) / 4.0
    for index in range(4):
        x = -width / 2.0 + 0.04 + module_width * (index + 0.5)
        if sink_clearance and index in (1, 2):
            furniture.add_door_pair(
                f"Sink service cabinet {index}", x, front_y, module_width, -1.0, one_door=True
            )
        elif index in (0, 3):
            furniture.add_drawer_bank(
                f"Drawer bank {index + 1}",
                x,
                front_y,
                module_width,
                -1.0,
                (0.14, 0.18, 0.22, 0.25),
            )
        else:
            furniture.add_door_pair(
                f"Base cabinet {index + 1}", x, front_y, module_width, -1.0, one_door=True
            )
        furniture.add_rear_access_panel(
            f"Rear access {index + 1}",
            x,
            rear_y,
            module_width,
            0.55,
            1.0,
            vented=index in (0, 3),
        )
    for x in (-width / 2.0 + 0.04, width / 2.0 - 0.04):
        furniture.add_box(
            f"Folded end gable {x:+.2f}",
            (x, 0.0, 0.46),
            (0.028, depth - 0.06, 0.70),
            m["powder"],
            bevel=0.005,
            category="end gable",
        )
    for index, x in enumerate((-width * 0.42, -width * 0.14, width * 0.14, width * 0.42), 1):
        for y_sign in (-1.0, 1.0):
            furniture.add_leveler(
                f"Casework leveler {index} {y_sign:+.0f}", x, y_sign * (depth / 2.0 - 0.10)
            )
    add_material_witnesses(width, depth)


def add_rectangular_basin(
    name: str,
    center: tuple[float, float],
    size: tuple[float, float],
    rim_z: float,
    *,
    depth: float = 0.24,
    water: bool = False,
) -> None:
    """Create a real open stainless sink shell rather than a dark decal."""

    m = furniture.MATERIALS
    x, y = center
    width, length = size
    wall = 0.026
    floor_z = rim_z - depth
    furniture.add_box(
        f"{name} bowl floor",
        (x, y, floor_z + 0.012),
        (width - wall * 2.0, length - wall * 2.0, 0.024),
        m["stainless_dark"],
        bevel=0.018,
        category="sink bowl",
    )
    for sx in (-1.0, 1.0):
        furniture.add_box(
            f"{name} side wall {sx:+.0f}",
            (x + sx * (width / 2.0 - wall / 2.0), y, rim_z - depth / 2.0),
            (wall, length, depth),
            m["stainless_bright"],
            bevel=0.012,
            category="sink bowl",
        )
    for sy in (-1.0, 1.0):
        furniture.add_box(
            f"{name} end wall {sy:+.0f}",
            (x, y + sy * (length / 2.0 - wall / 2.0), rim_z - depth / 2.0),
            (width - wall * 2.0, wall, depth),
            m["stainless_bright"],
            bevel=0.012,
            category="sink bowl",
        )
    for sx in (-1.0, 1.0):
        furniture.add_box(
            f"{name} rolled side rim {sx:+.0f}",
            (
                x + sx * (width / 2.0 - 0.012),
                y,
                rim_z - 0.006,
            ),
            (0.038, length + 0.038, 0.012),
            m["stainless"],
            bevel=0.006,
            category="sink rim",
        )
    for sy in (-1.0, 1.0):
        furniture.add_box(
            f"{name} rolled end rim {sy:+.0f}",
            (x, y + sy * (length / 2.0 - 0.012), rim_z - 0.006),
            (width - 0.038, 0.038, 0.012),
            m["stainless"],
            bevel=0.006,
            category="sink rim",
        )
    furniture.add_cylinder(
        f"{name} drain",
        (x, y, floor_z + 0.027),
        0.042,
        0.008,
        m["black"],
        vertices=48,
        category="drain",
    )
    add_torus(
        f"{name} drain ring",
        (x, y, floor_z + 0.032),
        0.034,
        0.004,
        m["stainless"],
        category="drain",
    )
    if water:
        furniture.add_box(
            f"{name} clean water surface",
            (x, y, floor_z + 0.06),
            (width - 0.075, length - 0.075, 0.007),
            m["water"],
            bevel=0.016,
            category="water",
        )


def add_faucet(
    name: str,
    x: float,
    y: float,
    base_z: float,
    *,
    height: float = 0.32,
    reach: float = 0.18,
    direction: float = -1.0,
) -> None:
    m = furniture.MATERIALS
    furniture.add_cylinder(
        f"{name} pedestal",
        (x, y, base_z + 0.035),
        0.027,
        0.070,
        m["stainless"],
        vertices=40,
        bevel=0.004,
        category="faucet",
    )
    add_curve_tube(
        f"{name} gooseneck",
        [
            (x, y, base_z + 0.065),
            (x, y, base_z + height * 0.86),
            (x, y + direction * reach * 0.38, base_z + height),
            (x, y + direction * reach, base_z + height * 0.73),
        ],
        0.014,
        m["stainless_bright"],
        category="faucet",
    )
    furniture.add_cylinder(
        f"{name} aerator",
        (x, y + direction * reach, base_z + height * 0.70),
        0.022,
        0.060,
        m["black"],
        axis=(0.0, 0.0, 1.0),
        vertices=32,
        bevel=0.004,
        category="faucet",
    )
    for side, key in ((-1.0, "blue"), (1.0, "red")):
        furniture.add_cylinder(
            f"{name} {key} valve",
            (x + side * 0.060, y, base_z + 0.035),
            0.018,
            0.052,
            m[key],
            vertices=28,
            bevel=0.003,
            category="faucet control",
        )


def add_worktop_with_sink(
    width: float,
    depth: float,
    *,
    stainless_top: bool = False,
    sink_center_x: float = 0.0,
) -> None:
    m = furniture.MATERIALS
    top_material = m["stainless_bright"] if stainless_top else m["phenolic"]
    edge_material = m["stainless"] if stainless_top else m["phenolic_edge"]
    sink_width = 0.54
    sink_length = 0.43
    sink_y = -0.035
    sink_left = sink_center_x - sink_width / 2.0
    sink_right = sink_center_x + sink_width / 2.0
    sink_front = sink_y - sink_length / 2.0
    sink_back = sink_y + sink_length / 2.0
    left_width = sink_left + width / 2.0
    right_width = width / 2.0 - sink_right
    if left_width > 0.0:
        furniture.add_box(
            "Worktop slab left of sink",
            (-width / 2.0 + left_width / 2.0, 0.0, 0.855),
            (left_width, depth, 0.055),
            top_material,
            bevel=0.010,
            category="worktop",
        )
    if right_width > 0.0:
        furniture.add_box(
            "Worktop slab right of sink",
            (sink_right + right_width / 2.0, 0.0, 0.855),
            (right_width, depth, 0.055),
            top_material,
            bevel=0.010,
            category="worktop",
        )
    front_depth = sink_front + depth / 2.0
    rear_depth = depth / 2.0 - sink_back
    furniture.add_box(
        "Worktop slab in front of sink",
        (sink_center_x, -depth / 2.0 + front_depth / 2.0, 0.855),
        (sink_width, front_depth, 0.055),
        top_material,
        bevel=0.008,
        category="worktop",
    )
    furniture.add_box(
        "Worktop slab behind sink",
        (sink_center_x, sink_back + rear_depth / 2.0, 0.855),
        (sink_width, rear_depth, 0.055),
        top_material,
        bevel=0.008,
        category="worktop",
    )
    furniture.add_box(
        "Worktop exposed front edge",
        (0.0, -depth / 2.0 + 0.009, 0.855),
        (width, 0.018, 0.055),
        edge_material,
        bevel=0.005,
        category="worktop",
    )
    add_rectangular_basin(
        "Integrated laboratory sink",
        (sink_center_x, sink_y),
        (sink_width, sink_length),
        0.884,
        depth=0.23,
        water=True,
    )
    furniture.add_box(
        "Rear splash upstand",
        (0.0, depth / 2.0 - 0.018, 0.872),
        (width, 0.036, 0.056),
        edge_material,
        bevel=0.006,
        category="splashback",
    )
    add_faucet(
        "Laboratory mixer",
        sink_center_x + 0.20,
        depth / 2.0 - 0.075,
        0.86,
        height=0.33,
        reach=0.18,
    )


def build_lab_bench_sink(spec: AssetSpec) -> None:
    add_base_casework(spec.width, spec.depth, sink_clearance=True)
    add_worktop_with_sink(spec.width, spec.depth)
    if furniture.ROOT is not None:
        furniture.ROOT["worktop_height_m"] = 0.90
        furniture.ROOT["reference_anatomy"] = (
            "enclosed laboratory sink bench, integral basin, mixer, service casework"
        )


def add_overhead_cabinet_bank(width: float, depth: float) -> None:
    m = furniture.MATERIALS
    cabinet_depth = 0.36
    cabinet_y = depth / 2.0 - cabinet_depth / 2.0
    bottom = 1.42
    top = 2.10
    cabinet_height = top - bottom
    for x in (-width / 2.0 + 0.045, width / 2.0 - 0.045):
        furniture.add_box(
            f"Overhead end tower {x:+.2f}",
            (x, cabinet_y, (0.90 + top) / 2.0),
            (0.09, cabinet_depth, top - 0.90),
            m["powder"],
            bevel=0.006,
            category="overhead support",
        )
    furniture.add_box(
        "Overhead cabinet top cap",
        (0.0, cabinet_y, top - 0.027),
        (width, cabinet_depth, 0.054),
        m["powder_light"],
        bevel=0.006,
        category="overhead cabinet",
    )
    furniture.add_box(
        "Overhead cabinet lower pan",
        (0.0, cabinet_y, bottom + 0.027),
        (width - 0.10, cabinet_depth, 0.054),
        m["interior"],
        bevel=0.005,
        category="overhead cabinet",
    )
    module_width = (width - 0.12) / 4.0
    face_y = cabinet_y - cabinet_depth / 2.0 - 0.010
    for index in range(4):
        x = -width / 2.0 + 0.06 + module_width * (index + 0.5)
        furniture.add_box(
            f"Overhead module {index + 1} back",
            (x, cabinet_y + cabinet_depth / 2.0 - 0.018, (bottom + top) / 2.0),
            (module_width - 0.018, 0.030, cabinet_height - 0.09),
            m["powder"],
            bevel=0.004,
            category="overhead cabinet",
        )
        for shelf_z in (bottom + 0.22, bottom + 0.43):
            furniture.add_box(
                f"Overhead module {index + 1} shelf {shelf_z:.2f}",
                (x, cabinet_y, shelf_z),
                (module_width - 0.04, cabinet_depth - 0.05, 0.022),
                m["frosted"],
                bevel=0.003,
                category="glass shelf",
            )
        furniture.add_box(
            f"Overhead module {index + 1} glass door",
            (x, face_y, (bottom + top) / 2.0),
            (module_width - 0.025, 0.018, cabinet_height - 0.10),
            m["glass"],
            bevel=0.010,
            category="glass door",
        )
        for frame_x in (-1.0, 1.0):
            furniture.add_box(
                f"Overhead module {index + 1} door stile {frame_x:+.0f}",
                (
                    x + frame_x * (module_width / 2.0 - 0.025),
                    face_y - 0.004,
                    (bottom + top) / 2.0,
                ),
                (0.032, 0.024, cabinet_height - 0.08),
                m["aluminum"],
                bevel=0.004,
                category="door frame",
            )
        furniture.add_recessed_pull(
            f"Overhead module {index + 1}",
            x,
            face_y - 0.008,
            bottom + 0.09,
            module_width,
            -1.0,
        )
    furniture.add_box(
        "Rear service upstand panel",
        (0.0, depth / 2.0 - 0.035, 1.16),
        (width - 0.12, 0.045, 0.40),
        m["powder_light"],
        bevel=0.006,
        category="service upstand",
    )
    for index, x in enumerate((-0.78, -0.26, 0.26, 0.78), 1):
        furniture.add_socket_plate(
            f"Overhead service socket {index}", x, depth / 2.0 - 0.058, 1.08, -1.0
        )


def build_lab_bench_overhead(spec: AssetSpec) -> None:
    add_base_casework(spec.width, spec.depth)
    furniture.add_box(
        "Full-width phenolic worktop",
        (0.0, 0.0, 0.872),
        (spec.width, spec.depth, 0.056),
        furniture.MATERIALS["phenolic"],
        bevel=0.010,
        category="worktop",
    )
    furniture.add_box(
        "Phenolic front edge",
        (0.0, -spec.depth / 2.0 + 0.008, 0.872),
        (spec.width, 0.016, 0.056),
        furniture.MATERIALS["phenolic_edge"],
        bevel=0.004,
        category="worktop",
    )
    add_overhead_cabinet_bank(spec.width, spec.depth)
    if furniture.ROOT is not None:
        furniture.ROOT["worktop_height_m"] = 0.90
        furniture.ROOT["reference_anatomy"] = (
            "full-height laboratory casework with glazed overhead cabinets"
        )


def add_open_wash_frame(width: float, depth: float) -> None:
    m = furniture.MATERIALS
    for index, (x, y) in enumerate(
        (
            (-width / 2.0 + 0.055, -depth / 2.0 + 0.055),
            (width / 2.0 - 0.055, -depth / 2.0 + 0.055),
            (-width / 2.0 + 0.055, depth / 2.0 - 0.055),
            (width / 2.0 - 0.055, depth / 2.0 - 0.055),
        ),
        1,
    ):
        furniture.add_box(
            f"Wash frame leg {index}",
            (x, y, 0.4325),
            (0.055, 0.055, 0.815),
            m["stainless"],
            bevel=0.009,
            category="frame",
        )
        furniture.add_cylinder(
            f"Wash frame foot {index}",
            (x, y, 0.010),
            0.032,
            0.020,
            m["rubber"],
            vertices=32,
            bevel=0.003,
            category="leveling foot",
        )
        furniture.add_cylinder(
            f"Wash frame adjuster {index}",
            (x, y, 0.035),
            0.013,
            0.050,
            m["zinc"],
            vertices=20,
            category="leveling foot",
        )
    furniture.add_box(
        "Wash station lower shelf",
        (0.0, 0.0, 0.17),
        (width - 0.11, depth - 0.11, 0.035),
        m["stainless"],
        bevel=0.010,
        category="lower shelf",
    )
    for y in (-depth / 2.0 + 0.055, depth / 2.0 - 0.055):
        furniture.add_box(
            f"Wash frame lower rail {y:+.2f}",
            (0.0, y, 0.145),
            (width - 0.11, 0.040, 0.040),
            m["aluminum"],
            bevel=0.006,
            category="frame",
        )
        furniture.add_box(
            "Wash frame upper longitudinal rail", (0, y, 0.812),
            (width - 0.11, 0.040, 0.042), m["stainless"],
            bevel=0.004, category="worktop support",
        )
    for x in (-width / 2 + 0.055, width / 2 - 0.055):
        furniture.add_box(
            "Wash frame upper end rail", (x, 0, 0.812),
            (0.040, depth - 0.11, 0.042), m["stainless"],
            bevel=0.004, category="worktop support",
        )


def build_stainless_wash_basin(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    # Local to this requested asset. Never retune shared runtime metal finishes.
    for key, color, metal, rough in (
        ("stainless", (0.62, 0.69, 0.68, 1), 0.34, 0.32),
        ("stainless_bright", (0.74, 0.80, 0.79, 1), 0.42, 0.27),
    ):
        finish = "body" if key == "stainless" else "surface"
        m[key] = furniture.make_material(f"Open wash satin alloy {finish}", color, metallic=metal, roughness=rough, coat=0.12)
    add_open_wash_frame(spec.width, spec.depth)
    sink_x = -0.23
    sink_y = -0.015
    sink_width = 0.88
    sink_length = 0.52
    sink_left = sink_x - sink_width / 2.0
    sink_right = sink_x + sink_width / 2.0
    sink_front = sink_y - sink_length / 2.0
    sink_back = sink_y + sink_length / 2.0
    left_width = sink_left + spec.width / 2.0
    right_width = spec.width / 2.0 - sink_right
    for name, x, piece_width in (
        ("left", -spec.width / 2.0 + left_width / 2.0, left_width),
        ("right", sink_right + right_width / 2.0, right_width),
    ):
        furniture.add_box(
            f"Open wash station top {name}",
            (x, 0.0, 0.866),
            (piece_width, spec.depth, 0.068),
            m["stainless_bright"],
            bevel=0.012,
            category="wash top",
        )
    front_depth = sink_front + spec.depth / 2.0
    rear_depth = spec.depth / 2.0 - sink_back
    for name, y, piece_depth in (
        ("front", -spec.depth / 2.0 + front_depth / 2.0, front_depth),
        ("rear", sink_back + rear_depth / 2.0, rear_depth),
    ):
        furniture.add_box(
            f"Open wash station top {name}",
            (sink_x, y, 0.866),
            (sink_width, piece_depth, 0.068),
            m["stainless_bright"],
            bevel=0.009,
            category="wash top",
        )
    add_rectangular_basin(
        "Deep wash basin",
        (sink_x, sink_y),
        (sink_width, sink_length),
        0.894,
        depth=0.30,
        water=False,
    )
    for index in range(8):
        x = 0.39 + index * 0.065
        furniture.add_box(
            f"Drainboard ridge {index + 1}",
            (x, -0.02, 0.896),
            (0.012, 0.48, 0.008),
            m["stainless"],
            bevel=0.003,
            category="drainboard",
        )
    furniture.add_box(
        "Wash station rear splashback",
        (0.0, spec.depth / 2.0 - 0.018, 0.965),
        (spec.width, 0.036, 0.17),
        m["stainless"],
        bevel=0.006,
        category="splashback",
    )
    add_faucet("Pre-rinse mixer", -0.40, spec.depth / 2.0 - 0.075, 0.87, height=0.42)
    add_faucet(
        "Secondary laboratory tap",
        0.52,
        spec.depth / 2.0 - 0.075,
        0.87,
        height=0.24,
        reach=0.12,
    )
    add_curve_tube(
        "Flexible pre-rinse hose",
        [
            (-0.40, 0.25, 0.91),
            (-0.52, 0.22, 1.16),
            (-0.45, 0.05, 1.27),
            (-0.30, -0.02, 1.11),
        ],
        0.010,
        m["black"],
        category="hose",
    )
    # The pre-rinse fixture is included in the 1300 mm overall planning envelope.
    for key, x in (("blue", 0.64), ("red", 0.70), ("green", 0.76), ("yellow", 0.82)):
        furniture.add_cylinder(
            f"Service marker {key}",
            (x, spec.depth / 2.0 - 0.055, 0.875),
            0.011,
            0.022,
            m[key],
            vertices=20,
            category="service marker",
        )
    furniture.add_box(
        "Wash station information label",
        (spec.width / 2.0 - 0.15, -spec.depth / 2.0 + 0.012, 0.74),
        (0.16, 0.008, 0.07),
        m["label"],
        bevel=0.004,
        category="label",
    )
    add_curve_tube("Basin drain and P-trap", [(-0.23, 0, 0.605), (-0.23, 0, 0.45),
        (-0.23, 0.07, 0.40), (-0.23, 0.14, 0.45), (-0.23, 0.14, 0.51),
        (-0.23, 0.30, 0.51)], 0.022, m["stainless"], category="plumbing")
    furniture.add_box("Rear service box mounting bracket", (0.55, 0.235, 0.52),
        (0.22, 0.13, 0.026), m["stainless"], bevel=0.004, category="service mounting")
    furniture.add_box(
        "Wash station powder-coated service box",
        (0.55, 0.245, 0.42),
        (0.18, 0.12, 0.18),
        m["powder_light"],
        bevel=0.012,
        category="service box",
    )
    furniture.add_box(
        "Wash station interior service panel",
        (0.55, 0.310, 0.42),
        (0.15, 0.015, 0.14),
        m["interior"],
        bevel=0.004,
        category="service box",
    )
    furniture.add_box(
        "Wash station shadow reveal",
        (0.55, 0.179, 0.42),
        (0.15, 0.012, 0.025),
        m["shadow"],
        bevel=0.003,
        category="service box",
    )
    if furniture.ROOT is not None:
        furniture.ROOT["worktop_height_m"] = 0.90
        furniture.ROOT["reference_anatomy"] = (
            "open stainless wash station, lower shelf, deep basin, folded pre-rinse fixture"
        )


def build_stainless_enclosed_basin(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    furniture.add_box(
        "Enclosed basin plinth",
        (0.0, 0.02, 0.055),
        (spec.width, spec.depth - 0.08, 0.11),
        m["stainless_dark"],
        bevel=0.006,
        category="plinth",
    )
    furniture.add_box(
        "Enclosed stainless cabinet shell",
        (0.0, 0.01, 0.45),
        (spec.width - 0.04, spec.depth - 0.06, 0.70),
        m["stainless"],
        bevel=0.010,
        category="cabinet",
    )
    front_y = -spec.depth / 2.0 + 0.018
    for leaf in (-1.0, 1.0):
        x = leaf * spec.width * 0.245
        furniture.add_box(
            f"Enclosed basin door {leaf:+.0f}",
            (x, front_y, 0.47),
            (spec.width * 0.47, 0.022, 0.60),
            m["stainless_bright"],
            bevel=0.008,
            category="cabinet door",
        )
        furniture.add_recessed_pull(
            f"Enclosed basin door {leaf:+.0f}",
            x - leaf * 0.11,
            front_y,
            0.70,
            spec.width * 0.47,
            -1.0,
        )
    furniture.add_rear_access_panel(
        "Enclosed basin rear service", 0.0, spec.depth / 2.0 - 0.018, spec.width - 0.08, 0.54, 1.0, vented=True
    )
    add_worktop_with_sink(spec.width, spec.depth, stainless_top=True)
    furniture.add_box(
        "Enclosed basin green inspection marker",
        (0.42, front_y - 0.012, 0.25),
        (0.025, 0.005, 0.05),
        m["green"],
        bevel=0.002,
        category="inspection marker",
    )
    furniture.add_box(
        "Enclosed basin yellow safety label",
        (-0.42, front_y - 0.012, 0.25),
        (0.06, 0.005, 0.04),
        m["yellow"],
        bevel=0.003,
        category="safety label",
    )
    furniture.add_box(
        "Enclosed basin blue service tag",
        (-0.33, front_y - 0.012, 0.25),
        (0.025, 0.005, 0.05),
        m["blue"],
        bevel=0.002,
        category="service tag",
    )
    furniture.add_box(
        "Enclosed basin red service tag",
        (-0.28, front_y - 0.012, 0.25),
        (0.025, 0.005, 0.05),
        m["red"],
        bevel=0.002,
        category="service tag",
    )
    furniture.add_box(
        "Enclosed basin information field",
        (0.0, front_y - 0.012, 0.18),
        (0.14, 0.005, 0.05),
        m["label"],
        bevel=0.003,
        category="label",
    )
    for x in (-0.48, 0.48):
        for y in (-0.24, 0.24):
            furniture.add_leveler(f"Enclosed basin leveler {x:+.2f} {y:+.2f}", x, y)
    if furniture.ROOT is not None:
        furniture.ROOT["worktop_height_m"] = 0.90
        furniture.ROOT["reference_anatomy"] = (
            "enclosed stainless laboratory basin with service cabinet"
        )


def add_service_bridge(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    # Shimadzu Ref2 composition: a raised, enclosed three-bay glazed hutch
    # above genuinely double-sided casework.  The cabinet is accessible and
    # detailed from both long sides; it is not a flat facade or mirrored card.
    hutch_width = spec.width - 0.18
    hutch_depth = 0.46
    hutch_bottom = 1.34
    hutch_top = 2.06
    hutch_center_z = (hutch_bottom + hutch_top) / 2.0
    hutch_height = hutch_top - hutch_bottom
    post_x = hutch_width / 2.0 - 0.035

    # Three supports leave two generous work zones and a central service bay.
    for x in (-post_x, 0.0, post_x):
        furniture.add_box(
            f"Shimadzu hutch support {x:+.2f}",
            (x, 0.0, 1.12),
            (0.065, 0.20, 0.44),
            m["stainless_bright"],
            bevel=0.008,
            category="hutch support",
        )

    # Light metallic cabinet shell and side construction.
    for z, height in ((hutch_bottom + 0.035, 0.07), (hutch_top - 0.035, 0.07)):
        furniture.add_box(
            f"Shimadzu hutch horizontal frame {z:.2f}",
            (0.0, 0.0, z),
            (hutch_width, hutch_depth, height),
            m["stainless_bright"],
            bevel=0.008,
            category="glazed hutch frame",
        )
    for x in (-hutch_width / 2.0 + 0.035, hutch_width / 2.0 - 0.035):
        furniture.add_box(
            f"Shimadzu hutch end panel {x:+.2f}",
            (x, 0.0, hutch_center_z),
            (0.07, hutch_depth, hutch_height),
            m["powder_light"],
            bevel=0.008,
            category="glazed hutch end panel",
        )

    bay_width = (hutch_width - 0.14) / 3.0
    divider_xs = (-bay_width / 2.0, bay_width / 2.0)
    for x in divider_xs:
        furniture.add_box(
            f"Shimadzu hutch bay divider {x:+.2f}",
            (x, 0.0, hutch_center_z),
            (0.055, hutch_depth, hutch_height - 0.08),
            m["stainless_bright"],
            bevel=0.006,
            category="glazed hutch divider",
        )

    # Two clear shelves span all bays while divider frames preserve the three
    # equal compartments seen in the supplied Shimadzu reference.
    for shelf_index, z in enumerate((1.59, 1.82), 1):
        furniture.add_box(
            f"Shimadzu hutch glass shelf {shelf_index}",
            (0.0, 0.0, z),
            (hutch_width - 0.12, hutch_depth - 0.08, 0.018),
            m["glass"],
            bevel=0.005,
            category="glass shelf",
        )
        furniture.add_box(
            f"Shimadzu hutch shelf edge {shelf_index}",
            (0.0, 0.0, z - 0.012),
            (hutch_width - 0.12, 0.025, 0.025),
            m["stainless_bright"],
            bevel=0.004,
            category="shelf edge",
        )

    # Six sliding door pairs: two panes per bay on both working faces.
    bay_centers = (-bay_width, 0.0, bay_width)
    pane_width = bay_width / 2.0 - 0.035
    pane_height = hutch_height - 0.13
    for normal_y in (-1.0, 1.0):
        face_y = normal_y * (hutch_depth / 2.0 + 0.012)
        for bay_index, bay_x in enumerate(bay_centers, 1):
            for pane_index, offset in enumerate((-pane_width / 2.0, pane_width / 2.0), 1):
                x = bay_x + offset
                furniture.add_box(
                    f"Shimadzu hutch {normal_y:+.0f} bay {bay_index} sliding glass {pane_index}",
                    (x, face_y + normal_y * pane_index * 0.003, hutch_center_z),
                    (pane_width, 0.018, pane_height),
                    m["glass"],
                    bevel=0.004,
                    category="sliding glass door",
                )
                # Perimeter stiles make each pane readable in 2D thumbnails.
                for edge_x in (-pane_width / 2.0, pane_width / 2.0):
                    furniture.add_box(
                        f"Shimadzu hutch pane stile {normal_y:+.0f} {bay_index} {pane_index} {edge_x:+.2f}",
                        (x + edge_x, face_y + normal_y * 0.014, hutch_center_z),
                        (0.018, 0.022, pane_height),
                        m["aluminum"],
                        bevel=0.003,
                        category="sliding door frame",
                    )
            furniture.add_box(
                f"Shimadzu hutch recessed pull {normal_y:+.0f} bay {bay_index}",
                (bay_x, face_y + normal_y * 0.026, hutch_center_z),
                (0.020, 0.018, 0.13),
                m["stainless_dark"],
                bevel=0.004,
                category="recessed pull",
            )

    furniture.add_box(
        "Shimadzu hutch top cap",
        (0.0, 0.0, 2.075),
        (hutch_width + 0.05, hutch_depth + 0.04, 0.05),
        m["powder_light"],
        bevel=0.009,
        category="hutch top cap",
    )
    furniture.add_box(
        "Central service spine",
        (0.0, 0.0, 1.17),
        (hutch_width - 0.04, 0.14, 0.26),
        m["powder_light"],
        bevel=0.008,
        category="service spine",
    )
    socket_xs = tuple(
        -hutch_width * 0.30 + index * (hutch_width * 0.60 / 3.0)
        for index in range(4)
    )
    for side in (-1.0, 1.0):
        y = side * 0.068
        for index, x in enumerate(socket_xs, 1):
            furniture.add_socket_plate(
                f"Island bridge socket {side:+.0f} {index}", x, y, 1.12, side
            )
    for index, (x, key) in enumerate(((-0.11, "blue"), (0.0, "red"), (0.11, "green")), 1):
        furniture.add_cylinder(
            f"Island bridge service port {index}",
            (x, -0.072, 1.27),
            0.020,
            0.010,
            m[key],
            axis=(0.0, -1.0, 0.0),
            vertices=28,
            bevel=0.002,
            category="utility",
        )
    furniture.add_box(
        "Island bridge caution marker",
        (0.0, 0.072, 1.27),
        (0.065, 0.006, 0.045),
        m["yellow"],
        bevel=0.004,
        category="label",
    )
    furniture.add_box(
        "Island bridge equipment label",
        (0.20, 0.072, 1.27),
        (0.12, 0.006, 0.05),
        m["label"],
        bevel=0.004,
        category="label",
    )
    furniture.add_box(
        "Island bridge silver cable raceway",
        (0.0, 0.0, 1.02),
        (spec.width - 0.20, 0.09, 0.045),
        m["stainless_bright"],
        bevel=0.006,
        category="cable raceway",
    )


def build_island_service_bridge(spec: AssetSpec) -> None:
    shimadzu_ref2_casework = (
        "drawers-low",
        "double-door-with-drawers",
        "double-door-with-drawers",
        "drawers-low",
    )
    furniture.add_center_island(
        spec,
        north_pattern=shimadzu_ref2_casework,
        south_pattern=shimadzu_ref2_casework,
    )
    add_service_bridge(spec)
    if furniture.ROOT is not None:
        furniture.ROOT["worktop_height_m"] = 0.90
        furniture.ROOT["reference_anatomy"] = (
            "Shimadzu Ref2 double-sided island casework: three-drawer end banks, two central double-door cabinets with two adjacent top drawers each, and three-bay glazed utility hutch"
        )


BUILDERS = {
    "lab-bench-sink": build_lab_bench_sink,
    "lab-bench-overhead": build_lab_bench_overhead,
    "stainless-wash-basin": build_stainless_wash_basin,
    "stainless-enclosed-basin": build_stainless_enclosed_basin,
    "island-bench-service-bridge": build_island_service_bridge,
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
    add_reference_materials()
    BUILDERS[spec.asset_id](spec)

    if furniture.ROOT is not None:
        furniture.ROOT["display_name"] = spec.asset_id.replace("-", " ").title()
        furniture.ROOT["planning_model"] = True
        furniture.ROOT["manufacturer_certified"] = False
        furniture.ROOT["source_note"] = (
            "Original LabSpace geometry informed by supplied laboratory photographs and "
            "category references; no manufacturer logos or downloaded geometry."
        )

    batching = furniture.consolidate_static_meshes_by_material()
    authored = furniture.authored_statistics(spec)
    furniture.validate_statistics(spec, authored, imported=False)
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
    imported = furniture.inspect_export(spec, output_path)
    if preview_dir is not None:
        furniture.render_qa_preview(spec, preview_dir / f"{spec.asset_id}.png")
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
    print("LABSPACE_CASEWORK_BATCH3_BUILD " + json.dumps(results, sort_keys=True))


if __name__ == "__main__":
    main()
