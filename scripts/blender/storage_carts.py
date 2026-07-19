"""Author Room 809 storage-rack and wire-trolley hero GLBs.

The assets are original planning models derived from the supplied Kyushu
University Room 809 photographs.  They intentionally include construction on
all sides: shelf supports, rear bracing, perforation cues, basket welding,
caster hardware, and the trolley underside.  They are not manufacturer-
certified models.

Run with Blender 4.5 LTS in background mode::

    blender --background --factory-startup \
      --python scripts/blender/storage_carts.py -- \
      --output-dir public/models/hero \
      --preview-dir public/models/hero/qa
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path

import bpy
from mathutils import Vector


@dataclass(frozen=True)
class AssetSpec:
    asset_id: str
    width: float
    depth: float
    height: float
    filename: str


ASSETS = {
    "slotted-angle-storage-rack": AssetSpec(
        "slotted-angle-storage-rack",
        1.20,
        0.50,
        2.10,
        "slotted-angle-storage-rack.glb",
    ),
    "wire-basket-trolley": AssetSpec(
        "wire-basket-trolley",
        1.05,
        0.65,
        1.05,
        "wire-basket-trolley.glb",
    ),
}

ROOT: bpy.types.Object | None = None
MATERIALS: dict[str, bpy.types.Material] = {}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", choices=("all", *ASSETS), default="all")
    parser.add_argument("--output-dir", default="public/models/hero")
    parser.add_argument("--preview-dir", default="")
    parser.add_argument("--save-blend-dir", default="")
    parser.add_argument(
        "--draco",
        action="store_true",
        help="Optionally apply Draco compression; plain GLB is the default.",
    )
    return parser.parse_args(argv)


def reset_scene(asset_id: str = "") -> None:
    global ROOT, MATERIALS
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for block in list(collection):
            collection.remove(block)
    ROOT = None
    MATERIALS = {}
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.world.color = (0.025, 0.030, 0.035)
    if asset_id:
        scene["asset_id"] = asset_id
        scene["authoring_units"] = "meters"
        scene["design_reference"] = "Kyushu University Room 809 photographs"


def set_socket(bsdf: bpy.types.Node, name: str, value) -> None:
    socket = bsdf.inputs.get(name)
    if socket is not None:
        socket.default_value = value


def make_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    metallic: float = 0.0,
    roughness: float = 0.42,
    coat: float = 0.0,
    coat_roughness: float = 0.18,
    anisotropy: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    material.diffuse_color = color
    material.metallic = metallic
    material.roughness = roughness
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    assert bsdf is not None
    set_socket(bsdf, "Base Color", color)
    set_socket(bsdf, "Metallic", metallic)
    set_socket(bsdf, "Roughness", roughness)
    set_socket(bsdf, "Coat Weight", coat)
    set_socket(bsdf, "Coat Roughness", coat_roughness)
    set_socket(bsdf, "Anisotropic IOR Level", anisotropy)
    material["pbr_role"] = name
    return material


def build_materials() -> None:
    global MATERIALS
    MATERIALS = {
        "beige": make_material(
            "Room 809 warm beige powder coat",
            (0.53, 0.48, 0.37, 1.0),
            metallic=0.18,
            roughness=0.32,
            coat=0.16,
        ),
        "beige_edge": make_material(
            "Powder coat worn edge",
            (0.32, 0.29, 0.23, 1.0),
            metallic=0.42,
            roughness=0.38,
        ),
        "slot": make_material(
            "Perforation shadow",
            (0.012, 0.014, 0.013, 1.0),
            roughness=0.70,
        ),
        "wood": make_material(
            "Sealed birch shelf face",
            (0.50, 0.32, 0.14, 1.0),
            roughness=0.38,
            coat=0.12,
            coat_roughness=0.24,
        ),
        "wood_edge": make_material(
            "Birch plywood laminated edge",
            (0.66, 0.49, 0.27, 1.0),
            roughness=0.46,
        ),
        "wood_grain": make_material(
            "Subtle shelf wood grain",
            (0.25, 0.13, 0.055, 1.0),
            roughness=0.52,
        ),
        "galvanized": make_material(
            "Galvanized welded steel",
            (0.48, 0.53, 0.54, 1.0),
            metallic=0.91,
            roughness=0.30,
            anisotropy=0.52,
        ),
        "zinc_dark": make_material(
            "Dark zinc caster hardware",
            (0.25, 0.29, 0.30, 1.0),
            metallic=0.89,
            roughness=0.34,
        ),
        "stainless": make_material(
            "Brushed stainless fasteners",
            (0.63, 0.68, 0.69, 1.0),
            metallic=0.97,
            roughness=0.18,
            anisotropy=0.68,
        ),
        "navy": make_material(
            "Room 809 navy trolley deck",
            (0.018, 0.075, 0.20, 1.0),
            roughness=0.28,
            coat=0.23,
            coat_roughness=0.16,
        ),
        "navy_edge": make_material(
            "Navy deck molded edge",
            (0.008, 0.028, 0.075, 1.0),
            roughness=0.35,
            coat=0.12,
        ),
        "rubber": make_material(
            "Black non-marking wheel rubber",
            (0.008, 0.010, 0.012, 1.0),
            roughness=0.76,
        ),
        "grip": make_material(
            "Textured black push grip",
            (0.010, 0.014, 0.018, 1.0),
            roughness=0.64,
        ),
        "label": make_material(
            "Matte inventory label",
            (0.82, 0.84, 0.79, 1.0),
            roughness=0.61,
        ),
        "green": make_material(
            "Room 809 inventory green",
            (0.018, 0.36, 0.17, 1.0),
            roughness=0.34,
            coat=0.10,
        ),
        "amber": make_material(
            "Caster safety reflector amber",
            (0.92, 0.35, 0.018, 1.0),
            roughness=0.26,
            coat=0.28,
        ),
        "red": make_material(
            "Load-rating label red",
            (0.60, 0.025, 0.018, 1.0),
            roughness=0.32,
            coat=0.10,
        ),
    }


def create_root(spec: AssetSpec) -> None:
    global ROOT
    ROOT = bpy.data.objects.new(f"{spec.asset_id}__ROOT", None)
    bpy.context.collection.objects.link(ROOT)
    ROOT["asset_id"] = spec.asset_id
    ROOT["anchor"] = "footprint-center-ground"
    ROOT["nominal_dimensions_m"] = [spec.width, spec.depth, spec.height]
    ROOT["planning_model"] = True
    ROOT["manufacturer_certified"] = False
    ROOT["all_sides_authored"] = True


def parent_to_root(obj: bpy.types.Object, category: str) -> bpy.types.Object:
    if ROOT is not None:
        obj.parent = ROOT
    obj["part_category"] = category
    return obj


def assign_material(obj: bpy.types.Object, material: bpy.types.Material) -> None:
    obj.data.materials.append(material)


def smooth(obj: bpy.types.Object) -> None:
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def add_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    bevel: float = 0.003,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    category: str = "structure",
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign_material(obj, material)
    if bevel > 0.0:
        modifier = obj.modifiers.new("Manufactured edge", "BEVEL")
        modifier.width = min(bevel, min(dimensions) * 0.22)
        modifier.segments = 2
        modifier.limit_method = "ANGLE"
        modifier.harden_normals = True
    return parent_to_root(obj, category)


def add_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    material: bpy.types.Material,
    *,
    axis: tuple[float, float, float] = (0.0, 0.0, 1.0),
    vertices: int = 16,
    bevel: float = 0.0,
    category: str = "hardware",
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=location
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0.0, 0.0, 1.0)).rotation_difference(
        Vector(axis).normalized()
    )
    assign_material(obj, material)
    smooth(obj)
    if bevel > 0.0:
        modifier = obj.modifiers.new("Rounded rim", "BEVEL")
        modifier.width = min(bevel, radius * 0.25, depth * 0.20)
        modifier.segments = 2
        modifier.harden_normals = True
    return parent_to_root(obj, category)


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
        align="WORLD",
        major_segments=24,
        minor_segments=10,
        location=location,
        rotation=rotation,
        major_radius=major_radius,
        minor_radius=minor_radius,
    )
    obj = bpy.context.object
    obj.name = name
    assign_material(obj, material)
    smooth(obj)
    return parent_to_root(obj, category)


def add_beam_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    width: float,
    depth: float,
    material: bpy.types.Material,
    *,
    category: str = "bracing",
) -> bpy.types.Object:
    start_v = Vector(start)
    end_v = Vector(end)
    direction = end_v - start_v
    bpy.ops.mesh.primitive_cube_add(location=(start_v + end_v) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (width, depth, direction.length)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0.0, 0.0, 1.0)).rotation_difference(
        direction.normalized()
    )
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign_material(obj, material)
    modifier = obj.modifiers.new("Pressed strap edge", "BEVEL")
    modifier.width = min(width, depth) * 0.16
    modifier.segments = 2
    modifier.harden_normals = True
    return parent_to_root(obj, category)


def add_disc_fastener(
    name: str,
    location: tuple[float, float, float],
    axis: tuple[float, float, float],
    *,
    radius: float = 0.006,
    material_key: str = "stainless",
) -> None:
    add_cylinder(
        name,
        location,
        radius,
        0.004,
        MATERIALS[material_key],
        axis=axis,
        vertices=16,
        bevel=0.0006,
        category="fastener",
    )


def add_slot(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    *,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> None:
    add_box(
        name,
        location,
        dimensions,
        MATERIALS["slot"],
        bevel=min(dimensions) * 0.30,
        rotation=rotation,
        category="perforation",
    )


def add_rack_post(name: str, x: float, y: float) -> None:
    # Two folded legs form a credible slotted L-angle from every orbit side.
    sign_x = 1.0 if x > 0.0 else -1.0
    sign_y = 1.0 if y > 0.0 else -1.0
    add_box(
        f"{name} x flange",
        (x - sign_x * 0.012, y, 1.065),
        (0.048, 0.020, 2.070),
        MATERIALS["beige"],
        bevel=0.0022,
        category="slotted upright",
    )
    add_box(
        f"{name} y flange",
        (x, y - sign_y * 0.012, 1.065),
        (0.020, 0.048, 2.070),
        MATERIALS["beige"],
        bevel=0.0022,
        category="slotted upright",
    )
    # Long pill-shaped dark recesses alternate with smaller circular fasteners.
    for index, z in enumerate(tuple(0.105 + i * 0.090 for i in range(22))):
        add_slot(
            f"{name} front slot {index + 1:02d}",
            (x - sign_x * 0.012, y - sign_y * 0.011, z),
            (0.012, 0.004, 0.036),
        )
        add_slot(
            f"{name} side slot {index + 1:02d}",
            (x - sign_x * 0.011, y - sign_y * 0.012, z),
            (0.004, 0.012, 0.036),
        )
        if index % 5 == 1:
            add_disc_fastener(
                f"{name} upright bolt {index + 1:02d}",
                (x - sign_x * 0.012, y - sign_y * 0.014, z + 0.026),
                (0.0, -sign_y, 0.0),
                radius=0.005,
            )


def add_rack_beam_slots(name: str, y: float, z: float) -> None:
    for index, x in enumerate((-0.48, -0.32, -0.16, 0.0, 0.16, 0.32, 0.48), 1):
        add_slot(
            f"{name} beam slot {index}",
            (x, y, z),
            (0.054, 0.004, 0.013),
        )


def add_rack_shelf(level: int, z: float, steel: bool = False) -> None:
    for y, face in ((-0.224, "front"), (0.224, "rear")):
        add_box(
            f"Shelf {level} {face} slotted crossmember",
            (0.0, y, z),
            (1.14, 0.034, 0.060),
            MATERIALS["beige"],
            bevel=0.003,
            category="shelf beam",
        )
        add_rack_beam_slots(f"Shelf {level} {face}", y + (-0.019 if y < 0 else 0.019), z)
    for x, side in ((-0.565, "left"), (0.565, "right")):
        add_box(
            f"Shelf {level} {side} side support",
            (x, 0.0, z),
            (0.034, 0.434, 0.060),
            MATERIALS["beige"],
            bevel=0.003,
            category="shelf beam",
        )
        for y in (-0.13, 0.0, 0.13):
            add_slot(
                f"Shelf {level} {side} side slot {y:+.2f}",
                (x + (-0.019 if x < 0 else 0.019), y, z),
                (0.004, 0.050, 0.013),
            )
    shelf_material = MATERIALS["galvanized"] if steel else MATERIALS["wood"]
    add_box(
        f"Shelf {level} {'galvanized tray' if steel else 'sealed plywood top'}",
        (0.0, 0.0, z + 0.045),
        (1.084, 0.398, 0.030),
        shelf_material,
        bevel=0.004,
        category="shelf surface",
    )
    if not steel:
        # Laminated plywood edges and restrained surface grain remain legible in
        # both plan thumbnails and orbit views without external texture files.
        for y, edge in ((-0.202, "front"), (0.202, "rear")):
            add_box(
                f"Shelf {level} {edge} laminated edge",
                (0.0, y, z + 0.045),
                (1.088, 0.006, 0.026),
                MATERIALS["wood_edge"],
                bevel=0.001,
                category="shelf edge",
            )
        for grain_index, y in enumerate((-0.15, -0.08, 0.015, 0.09, 0.155), 1):
            add_box(
                f"Shelf {level} wood grain {grain_index}",
                (0.0, y, z + 0.061),
                (0.94 - grain_index * 0.034, 0.003, 0.0014),
                MATERIALS["wood_grain"],
                bevel=0.0005,
                rotation=(0.0, 0.0, (grain_index - 3) * 0.008),
                category="surface detail",
            )
    else:
        for x in (-0.50, 0.50):
            add_box(
                f"Shelf {level} folded tray lip {x:+.2f}",
                (x, 0.0, z + 0.072),
                (0.024, 0.404, 0.055),
                MATERIALS["galvanized"],
                bevel=0.002,
                category="shelf edge",
            )
    for x in (-0.53, 0.53):
        for y in (-0.205, 0.205):
            add_disc_fastener(
                f"Shelf {level} corner bolt {x:+.2f} {y:+.2f}",
                (x, y, z),
                (0.0, -1.0 if y < 0 else 1.0, 0.0),
                radius=0.006,
            )


def build_rack() -> None:
    for x, x_name in ((-0.576, "left"), (0.576, "right")):
        for y, y_name in ((-0.226, "front"), (0.226, "rear")):
            name = f"Rack {x_name} {y_name}"
            add_rack_post(name, x, y)
            add_box(
                f"{name} foot plate",
                (x - (0.020 if x > 0 else -0.020), y - (0.020 if y > 0 else -0.020), 0.010),
                (0.088, 0.088, 0.020),
                MATERIALS["beige_edge"],
                bevel=0.003,
                category="foot plate",
            )
            for dx in (-0.026, 0.026):
                for dy in (-0.026, 0.026):
                    add_disc_fastener(
                        f"{name} anchor {dx:+.3f} {dy:+.3f}",
                        (x - (0.020 if x > 0 else -0.020) + dx, y - (0.020 if y > 0 else -0.020) + dy, 0.022),
                        (0.0, 0.0, 1.0),
                        radius=0.0045,
                        material_key="zinc_dark",
                    )

    for level, (z, steel) in enumerate(
        ((0.285, False), (0.745, False), (1.205, True), (1.665, False)), 1
    ):
        add_rack_shelf(level, z, steel)

    # Top rails close the frame while retaining the open utility-rack silhouette.
    for y, face in ((-0.226, "front"), (0.226, "rear")):
        add_box(
            f"Top {face} rail",
            (0.0, y, 2.065),
            (1.152, 0.040, 0.070),
            MATERIALS["beige"],
            bevel=0.003,
            category="top rail",
        )
        add_rack_beam_slots(f"Top {face}", y + (-0.022 if y < 0 else 0.022), 2.065)
    for x, side in ((-0.576, "left"), (0.576, "right")):
        add_box(
            f"Top {side} side rail",
            (x, 0.0, 2.065),
            (0.040, 0.452, 0.070),
            MATERIALS["beige"],
            bevel=0.003,
            category="top rail",
        )

    # Rear X bracing is intentionally visible from the aisle-side reverse view.
    rear_y = 0.249
    add_beam_between(
        "Rear diagonal brace rising right",
        (-0.548, rear_y, 0.18),
        (0.548, rear_y, 1.99),
        0.027,
        0.007,
        MATERIALS["beige_edge"],
    )
    add_beam_between(
        "Rear diagonal brace rising left",
        (0.548, rear_y - 0.008, 0.18),
        (-0.548, rear_y - 0.008, 1.99),
        0.027,
        0.007,
        MATERIALS["beige_edge"],
    )
    add_disc_fastener(
        "Rear brace center bolt",
        (0.0, rear_y + 0.006, 1.085),
        (0.0, 1.0, 0.0),
        radius=0.010,
        material_key="stainless",
    )

    # Small front capacity plate and colored audit marker mirror Room 809 usage.
    add_box(
        "Rack load label",
        (-0.34, -0.251, 1.694),
        (0.18, 0.004, 0.055),
        MATERIALS["label"],
        bevel=0.002,
        category="label",
    )
    add_box(
        "Rack load label red stripe",
        (-0.418, -0.254, 1.694),
        (0.012, 0.002, 0.042),
        MATERIALS["red"],
        bevel=0.0005,
        category="label",
    )


def add_wire(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float = 0.0042,
    material_key: str = "galvanized",
) -> None:
    start_v = Vector(start)
    end_v = Vector(end)
    direction = end_v - start_v
    add_cylinder(
        name,
        tuple((start_v + end_v) * 0.5),
        radius,
        direction.length,
        MATERIALS[material_key],
        axis=tuple(direction),
        vertices=12,
        category="welded wire",
    )


def add_caster(name: str, x: float, y: float, swivel_angle: float) -> None:
    # Mounting plate, swivel race, offset yoke, axle and wheel are modeled
    # separately so the underside reads mechanically from every orbit angle.
    add_box(
        f"{name} mounting plate",
        (x, y, 0.205),
        (0.112, 0.090, 0.012),
        MATERIALS["zinc_dark"],
        bevel=0.004,
        rotation=(0.0, 0.0, swivel_angle),
        category="caster",
    )
    for dx in (-0.038, 0.038):
        for dy in (-0.027, 0.027):
            c = math.cos(swivel_angle)
            s = math.sin(swivel_angle)
            rx = dx * c - dy * s
            ry = dx * s + dy * c
            add_disc_fastener(
                f"{name} plate bolt {dx:+.3f} {dy:+.3f}",
                (x + rx, y + ry, 0.214),
                (0.0, 0.0, 1.0),
                radius=0.0042,
            )
    add_cylinder(
        f"{name} kingpin",
        (x, y, 0.178),
        0.016,
        0.052,
        MATERIALS["stainless"],
        vertices=20,
        bevel=0.002,
        category="caster",
    )
    add_torus(
        f"{name} swivel bearing race",
        (x, y, 0.181),
        0.028,
        0.007,
        MATERIALS["zinc_dark"],
        category="caster",
    )
    offset = Vector((0.0, -0.025, 0.0))
    offset.rotate(mathutils_matrix_z(swivel_angle))
    wheel_center = Vector((x, y, 0.0825)) + offset
    # Fork cheeks straddle the wheel along its X-axis after swivel rotation.
    fork_axis = Vector((math.cos(swivel_angle), math.sin(swivel_angle), 0.0))
    side_axis = Vector((-math.sin(swivel_angle), math.cos(swivel_angle), 0.0))
    for side in (-1.0, 1.0):
        cheek_center = Vector((x, y, 0.140)) + side_axis * 0.028 + offset * 0.45
        add_beam_between(
            f"{name} fork cheek {side:+.0f}",
            tuple(Vector((x, y, 0.170)) + side_axis * 0.028),
            tuple(cheek_center + Vector((0.0, 0.0, -0.050))),
            0.020,
            0.009,
            MATERIALS["zinc_dark"],
            category="caster fork",
        )
    # Wheel lies in the vertical plane perpendicular to the fork axle.
    wheel_rotation = (math.pi / 2.0, 0.0, swivel_angle)
    add_torus(
        f"{name} non-marking tread",
        tuple(wheel_center),
        0.0545,
        0.0280,
        MATERIALS["rubber"],
        rotation=wheel_rotation,
        category="caster wheel",
    )
    add_cylinder(
        f"{name} wheel hub",
        tuple(wheel_center),
        0.040,
        0.055,
        MATERIALS["navy_edge"],
        axis=tuple(side_axis),
        vertices=24,
        bevel=0.002,
        category="caster wheel",
    )
    add_cylinder(
        f"{name} axle",
        tuple(wheel_center),
        0.009,
        0.072,
        MATERIALS["stainless"],
        axis=tuple(side_axis),
        vertices=16,
        bevel=0.001,
        category="caster axle",
    )
    add_box(
        f"{name} amber reflector",
        tuple(wheel_center + fork_axis * 0.058),
        (0.024, 0.006, 0.012),
        MATERIALS["amber"],
        bevel=0.002,
        rotation=(0.0, 0.0, swivel_angle),
        category="caster marker",
    )


def mathutils_matrix_z(angle: float):
    from mathutils import Matrix

    return Matrix.Rotation(angle, 4, "Z")


def add_basket_walls() -> None:
    x_min, x_max = -0.478, 0.478
    y_min, y_max = -0.246, 0.246
    z_bottom, z_top = 0.315, 0.812

    # Front and rear: vertical wires and six continuous horizontal courses.
    for y, face in ((y_min, "front"), (y_max, "rear")):
        for index, x in enumerate(tuple(-0.45 + i * 0.075 for i in range(13)), 1):
            add_wire(
                f"Basket {face} vertical {index:02d}",
                (x, y, z_bottom),
                (x, y, z_top),
            )
        for index, z in enumerate((0.335, 0.425, 0.515, 0.605, 0.695, 0.785), 1):
            add_wire(
                f"Basket {face} horizontal {index}",
                (x_min, y, z),
                (x_max, y, z),
            )

    # Side panels close the basket, with matched grid pitch around corners.
    for x, side in ((x_min, "left"), (x_max, "right")):
        for index, y in enumerate(tuple(-0.21 + i * 0.07 for i in range(7)), 1):
            add_wire(
                f"Basket {side} vertical {index:02d}",
                (x, y, z_bottom),
                (x, y, z_top),
            )
        for index, z in enumerate((0.335, 0.425, 0.515, 0.605, 0.695, 0.785), 1):
            add_wire(
                f"Basket {side} horizontal {index}",
                (x, y_min, z),
                (x, y_max, z),
            )

    # Heavier double top and lower perimeter rods carry the basket loads.
    for z, label, radius in (
        (0.315, "lower", 0.0060),
        (0.812, "top", 0.0075),
    ):
        for y, face in ((y_min, "front"), (y_max, "rear")):
            add_wire(
                f"Basket {label} {face} rim",
                (x_min, y, z),
                (x_max, y, z),
                radius,
            )
        for x, side in ((x_min, "left"), (x_max, "right")):
            add_wire(
                f"Basket {label} {side} rim",
                (x, y_min, z),
                (x, y_max, z),
                radius,
            )

    # Welded floor grid is visible above and from the detailed underside.
    for index, x in enumerate(tuple(-0.45 + i * 0.075 for i in range(13)), 1):
        add_wire(
            f"Basket floor longitudinal {index:02d}",
            (x, y_min, 0.314),
            (x, y_max, 0.314),
            0.0044,
        )
    for index, y in enumerate(tuple(-0.21 + i * 0.07 for i in range(7)), 1):
        add_wire(
            f"Basket floor transverse {index:02d}",
            (x_min, y, 0.314),
            (x_max, y, 0.314),
            0.0044,
        )
    # Every outer corner gets a small weld collar.
    for x in (x_min, x_max):
        for y in (y_min, y_max):
            for z in (0.315, 0.812):
                add_torus(
                    f"Basket weld collar {x:+.3f} {y:+.3f} {z:.3f}",
                    (x, y, z),
                    0.008,
                    0.0022,
                    MATERIALS["stainless"],
                    rotation=(math.pi / 2.0, 0.0, 0.0),
                    category="basket weld",
                )


def build_trolley() -> None:
    # Molded navy deck and galvanized perimeter are separated for realistic
    # edge reflections and a clear material-aware top render.
    add_box(
        "Trolley navy load deck",
        (0.0, 0.0, 0.270),
        (0.968, 0.542, 0.052),
        MATERIALS["navy"],
        bevel=0.018,
        category="deck",
    )
    for y, face in ((-0.286, "front"), (0.286, "rear")):
        add_box(
            f"Deck {face} bumper edge",
            (0.0, y, 0.270),
            (1.006, 0.040, 0.060),
            MATERIALS["navy_edge"],
            bevel=0.010,
            category="deck edge",
        )
    for x, side in ((-0.503, "left"), (0.503, "right")):
        add_box(
            f"Deck {side} bumper edge",
            (x, 0.0, 0.270),
            (0.040, 0.556, 0.060),
            MATERIALS["navy_edge"],
            bevel=0.010,
            category="deck edge",
        )

    # Structural underside: two rails and three crossmembers with visible bolts.
    for x, side in ((-0.365, "left"), (0.365, "right")):
        add_box(
            f"Underside {side} longitudinal rail",
            (x, 0.0, 0.225),
            (0.052, 0.490, 0.050),
            MATERIALS["zinc_dark"],
            bevel=0.004,
            category="underside frame",
        )
    for index, y in enumerate((-0.205, 0.0, 0.205), 1):
        add_box(
            f"Underside crossmember {index}",
            (0.0, y, 0.225),
            (0.810, 0.045, 0.045),
            MATERIALS["galvanized"],
            bevel=0.004,
            category="underside frame",
        )
        for x in (-0.365, 0.365):
            add_disc_fastener(
                f"Underside crossmember {index} bolt {x:+.3f}",
                (x, y, 0.198),
                (0.0, 0.0, -1.0),
                radius=0.005,
            )

    add_basket_walls()

    # Push handle projects behind the basket and reaches the nominal 1.05 m top.
    handle_y = 0.314
    for x, side in ((-0.420, "left"), (0.420, "right")):
        add_wire(
            f"Push handle {side} lower post",
            (x, handle_y, 0.248),
            (x, handle_y, 0.888),
            0.012,
            "stainless",
        )
        add_wire(
            f"Push handle {side} swept shoulder",
            (x, handle_y, 0.888),
            (x * 0.94, handle_y, 0.984),
            0.012,
            "stainless",
        )
        add_box(
            f"Push handle {side} deck gusset",
            (x, 0.298, 0.330),
            (0.058, 0.018, 0.145),
            MATERIALS["zinc_dark"],
            bevel=0.004,
            category="handle bracket",
        )
        for z in (0.292, 0.354):
            add_disc_fastener(
                f"Push handle {side} bracket bolt {z:.3f}",
                (x, 0.309, z),
                (0.0, 1.0, 0.0),
                radius=0.005,
            )
    add_wire(
        "Push handle stainless crossbar",
        (-0.395, handle_y, 0.984),
        (0.395, handle_y, 0.984),
        0.012,
        "stainless",
    )
    add_cylinder(
        "Push handle textured center grip",
        (0.0, handle_y, 0.984),
        0.022,
        0.475,
        MATERIALS["grip"],
        axis=(1.0, 0.0, 0.0),
        vertices=24,
        bevel=0.003,
        category="handle grip",
    )
    for x in (-0.215, 0.215):
        add_torus(
            f"Push grip collar {x:+.3f}",
            (x, handle_y, 0.984),
            0.022,
            0.004,
            MATERIALS["stainless"],
            rotation=(0.0, math.pi / 2.0, 0.0),
            category="handle grip",
        )

    # Front label plate is attached to two wires rather than floating.
    add_box(
        "Trolley inventory label plate",
        (0.0, -0.253, 0.585),
        (0.218, 0.012, 0.092),
        MATERIALS["label"],
        bevel=0.006,
        category="label",
    )
    add_box(
        "Trolley inventory green stripe",
        (-0.094, -0.260, 0.585),
        (0.014, 0.004, 0.072),
        MATERIALS["green"],
        bevel=0.001,
        category="label",
    )
    for x in (-0.082, 0.082):
        add_disc_fastener(
            f"Trolley label rivet {x:+.3f}",
            (x, -0.261, 0.585),
            (0.0, -1.0, 0.0),
            radius=0.004,
        )

    for index, (x, y, angle) in enumerate(
        (
            (-0.400, -0.210, -0.18),
            (0.400, -0.210, 0.12),
            (-0.400, 0.210, math.pi + 0.10),
            (0.400, 0.210, math.pi - 0.16),
        ),
        1,
    ):
        add_caster(f"Caster {index}", x, y, angle)


def apply_modifiers() -> None:
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            continue
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        for modifier in list(obj.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=modifier.name)
            except RuntimeError:
                pass
        obj.select_set(False)
    bpy.context.view_layer.objects.active = None


def consolidate_by_material() -> None:
    groups: dict[str, list[bpy.types.Object]] = {}
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        material = obj.active_material
        key = material.name if material else "Unassigned"
        groups.setdefault(key, []).append(obj)
    for material_name, objects in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        active = objects[0]
        bpy.context.view_layer.objects.active = active
        if len(objects) > 1:
            bpy.ops.object.join()
        safe = "".join(c if c.isalnum() else "_" for c in material_name)
        active.name = f"Runtime_{safe}"
        active.data.name = f"Runtime_{safe}_mesh"
        active.select_set(False)
    bpy.context.view_layer.objects.active = None
    bpy.context.view_layer.update()


def mesh_bounds() -> tuple[Vector, Vector]:
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = Vector(tuple(min(point[i] for point in points) for i in range(3)))
    maximum = Vector(tuple(max(point[i] for point in points) for i in range(3)))
    return minimum, maximum


def fit_to_dimensions(spec: AssetSpec) -> dict[str, list[float]]:
    assert ROOT is not None
    apply_modifiers()
    consolidate_by_material()
    minimum, maximum = mesh_bounds()
    actual = maximum - minimum
    ROOT.scale = (
        spec.width / actual.x,
        spec.depth / actual.y,
        spec.height / actual.z,
    )
    bpy.context.view_layer.update()
    minimum, maximum = mesh_bounds()
    ROOT.location += Vector(
        (-(minimum.x + maximum.x) * 0.5, -(minimum.y + maximum.y) * 0.5, -minimum.z)
    )
    bpy.context.view_layer.update()
    minimum, maximum = mesh_bounds()
    return {
        "min": [round(value, 6) for value in minimum],
        "max": [round(value, 6) for value in maximum],
        "dimensions": [round(value, 6) for value in maximum - minimum],
    }


def triangle_count(mesh: bpy.types.Mesh) -> int:
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def scene_stats(spec: AssetSpec, bounds: dict[str, list[float]]) -> dict[str, object]:
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    materials = {
        slot.material.name
        for obj in meshes
        for slot in obj.material_slots
        if slot.material is not None
    }
    return {
        "asset": spec.asset_id,
        "mesh_objects": len(meshes),
        "materials": len(materials),
        "vertices": sum(len(obj.data.vertices) for obj in meshes),
        "triangles": sum(triangle_count(obj.data) for obj in meshes),
        "cameras": len([obj for obj in bpy.context.scene.objects if obj.type == "CAMERA"]),
        "lights": len([obj for obj in bpy.context.scene.objects if obj.type == "LIGHT"]),
        "bounds_m": bounds,
    }


def validate_stats(spec: AssetSpec, stats: dict[str, object], *, imported: bool = False) -> None:
    dimensions = Vector(stats["bounds_m"]["dimensions"])
    minimum = Vector(stats["bounds_m"]["min"])
    errors: list[str] = []
    for axis, actual, expected in zip("xyz", dimensions, (spec.width, spec.depth, spec.height)):
        tolerance = 0.007 if imported else 0.0015
        if abs(actual - expected) > tolerance:
            errors.append(f"{axis} dimension {actual:.5f} != {expected:.5f}")
    if abs(minimum.z) > (0.005 if imported else 0.001):
        errors.append(f"minimum z {minimum.z:.6f} is not grounded")
    mesh_count = int(stats["mesh_objects"])
    triangles = int(stats["triangles"])
    if not 8 <= mesh_count <= 25:
        errors.append(f"mesh groups {mesh_count} outside 8-25")
    if triangles > 180_000:
        errors.append(f"triangle count {triangles} exceeds 180000")
    if triangles < 8_000:
        errors.append(f"triangle count {triangles} is unexpectedly low")
    if int(stats["cameras"]) or int(stats["lights"]):
        errors.append("asset contains camera or light")
    if errors:
        phase = "imported" if imported else "authored"
        raise RuntimeError(f"{spec.asset_id} {phase} validation failed: {'; '.join(errors)}")


def export_glb(path: Path, *, draco: bool) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    kwargs = dict(
        filepath=str(path.resolve()),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_materials="EXPORT",
        export_normals=True,
        export_tangents=False,
        export_texcoords=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_shared_accessors=True,
        export_draco_mesh_compression_enable=draco,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_loglevel=-1,
    )
    result = bpy.ops.export_scene.gltf(**kwargs)
    if "FINISHED" not in result:
        raise RuntimeError(f"GLB export failed: {result}")


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_qa_area(
    name: str,
    location: tuple[float, float, float],
    energy: float,
    size: float,
    color: tuple[float, float, float],
    target: Vector,
) -> None:
    data = bpy.data.lights.new(name=name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    look_at(obj, target)


def render_previews(spec: AssetSpec, preview_dir: Path) -> list[str]:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 760
    scene.render.resolution_y = 760
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.035, 0.043, 0.052)
    preview_dir.mkdir(parents=True, exist_ok=True)

    floor_mat = make_material("QA neutral floor", (0.13, 0.15, 0.17, 1.0), roughness=0.58)
    add_box(
        "QA studio floor",
        (0.0, 0.0, -0.025),
        (4.5, 4.5, 0.045),
        floor_mat,
        bevel=0.008,
        category="qa-only",
    )
    target = Vector((0.0, 0.0, spec.height * 0.48))
    camera_data = bpy.data.cameras.new("QA camera")
    camera_data.lens = 60
    camera = bpy.data.objects.new("QA camera", camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera
    add_qa_area("QA key", (-2.0, -2.2, 3.0), 930.0, 2.0, (1.0, 0.91, 0.82), target)
    add_qa_area("QA fill", (2.2, -0.5, 2.0), 590.0, 1.5, (0.75, 0.87, 1.0), target)
    add_qa_area("QA rim", (-0.4, 2.1, 2.7), 820.0, 1.3, (0.72, 0.84, 1.0), target)

    distance = 3.05 if spec.height > 1.5 else 2.15
    camera_height = 1.72 if spec.height > 1.5 else 1.20
    outputs: list[str] = []
    for view, location in (
        ("front", (distance * 0.58, -distance, camera_height)),
        ("rear", (-distance * 0.58, distance, camera_height * 1.04)),
    ):
        camera.location = location
        look_at(camera, target)
        output = (preview_dir / f"{spec.asset_id}-{view}-blender-qa.png").resolve()
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        outputs.append(str(output))
    return outputs


def inspect_export(spec: AssetSpec, path: Path, preview_dir: Path | None) -> dict[str, object]:
    reset_scene(spec.asset_id)
    result = bpy.ops.import_scene.gltf(filepath=str(path.resolve()))
    if "FINISHED" not in result:
        raise RuntimeError(f"Could not import generated GLB: {path}")
    bpy.context.view_layer.update()
    minimum, maximum = mesh_bounds()
    bounds = {
        "min": [round(value, 6) for value in minimum],
        "max": [round(value, 6) for value in maximum],
        "dimensions": [round(value, 6) for value in maximum - minimum],
    }
    stats = scene_stats(spec, bounds)
    stats["file"] = str(path.resolve())
    stats["bytes"] = path.stat().st_size
    validate_stats(spec, stats, imported=True)
    if path.stat().st_size > 12 * 1024 * 1024:
        raise RuntimeError(f"{spec.asset_id} GLB exceeds 12 MB")
    if path.stat().st_size < 100_000:
        raise RuntimeError(f"{spec.asset_id} GLB is unexpectedly smaller than 100 KB")
    if preview_dir is not None:
        build_materials()
        stats["previews"] = render_previews(spec, preview_dir)
    return stats


def build_one(
    spec: AssetSpec,
    output_dir: Path,
    *,
    preview_dir: Path | None,
    save_blend_dir: Path | None,
    draco: bool,
) -> dict[str, object]:
    reset_scene(spec.asset_id)
    build_materials()
    create_root(spec)
    if spec.asset_id == "slotted-angle-storage-rack":
        build_rack()
    else:
        build_trolley()
    bounds = fit_to_dimensions(spec)
    authored = scene_stats(spec, bounds)
    validate_stats(spec, authored)
    if save_blend_dir is not None:
        save_blend_dir.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(
            filepath=str((save_blend_dir / f"{spec.asset_id}.blend").resolve())
        )
    output = output_dir / spec.filename
    export_glb(output, draco=draco)
    report = inspect_export(spec, output, preview_dir)
    print("LABSPACE_GLTF_INSPECT " + json.dumps(report, sort_keys=True))
    return report


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    preview_dir = Path(args.preview_dir) if args.preview_dir else None
    save_blend_dir = Path(args.save_blend_dir) if args.save_blend_dir else None
    selected = tuple(ASSETS.values()) if args.asset == "all" else (ASSETS[args.asset],)
    reports = [
        build_one(
            spec,
            output_dir,
            preview_dir=preview_dir,
            save_blend_dir=save_blend_dir,
            draco=args.draco,
        )
        for spec in selected
    ]
    print("LABSPACE_STORAGE_CARTS_COMPLETE " + json.dumps(reports, sort_keys=True))


if __name__ == "__main__":
    main()
