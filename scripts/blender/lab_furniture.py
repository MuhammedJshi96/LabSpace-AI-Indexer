"""Author Room 809 laboratory furniture hero assets as deterministic GLBs.

The two assets in this file are original planning models.  Their proportions,
casework language, and black phenolic worktops follow the Kyushu University
Room 809 photographs, with conservative construction cues from modern
Shimadzu Rika and Kewaunee steel laboratory furniture.  They are not
manufacturer-certified models.

Run with Blender 4.5 LTS in background mode::

    blender --background --factory-startup \
      --python scripts/blender/lab_furniture.py -- \
      --output-dir public/models/hero
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


ROOT: bpy.types.Object | None = None
MATERIALS: dict[str, bpy.types.Material] = {}


@dataclass(frozen=True)
class AssetSpec:
    asset_id: str
    width: float
    depth: float
    height: float


ASSETS = {
    "lab-bench": AssetSpec("lab-bench", 1.8, 0.75, 0.9),
    "center-island-bench": AssetSpec("center-island-bench", 3.0, 1.2, 0.9),
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--asset",
        choices=("all", *ASSETS.keys()),
        default="all",
        help="Build both furniture assets or only one named asset.",
    )
    parser.add_argument(
        "--output-dir",
        default="public/models/hero",
        help="Directory that receives lab-bench.glb and center-island-bench.glb.",
    )
    parser.add_argument(
        "--save-blend-dir",
        default="",
        help="Optional directory for editable .blend snapshots.",
    )
    parser.add_argument(
        "--preview-dir",
        default="",
        help=(
            "Optional directory for studio QA renders. Cameras and lights are "
            "created only after GLB export and are never included in the asset."
        ),
    )
    return parser.parse_args(argv)


def reset_scene(asset_id: str = "") -> None:
    global ROOT, MATERIALS
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for data_collection in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for block in list(data_collection):
            data_collection.remove(block)

    ROOT = None
    MATERIALS = {}
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.world.color = (0.028, 0.032, 0.036)
    if asset_id:
        scene["asset_id"] = asset_id
        scene["authoring_units"] = "meters"
        scene["design_reference"] = (
            "Kyushu University Room 809; generic Shimadzu Rika and "
            "Kewaunee steel casework construction cues"
        )


def set_socket(bsdf: bpy.types.Node, name: str, value) -> None:
    socket = bsdf.inputs.get(name)
    if socket is not None:
        socket.default_value = value


def make_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    metallic: float = 0.0,
    roughness: float = 0.4,
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
        "phenolic": make_material(
            "Black phenolic worktop - satin",
            (0.018, 0.021, 0.021, 1.0),
            roughness=0.24,
            coat=0.18,
            coat_roughness=0.12,
        ),
        "phenolic_edge": make_material(
            "Black phenolic exposed edge",
            (0.007, 0.009, 0.009, 1.0),
            roughness=0.31,
            coat=0.08,
        ),
        "powder": make_material(
            "Room 809 light gray powder coat",
            (0.80, 0.83, 0.82, 1.0),
            metallic=0.08,
            roughness=0.29,
            coat=0.14,
        ),
        "powder_light": make_material(
            "Warm gray powder coat highlight",
            (0.90, 0.92, 0.91, 1.0),
            metallic=0.05,
            roughness=0.27,
            coat=0.16,
        ),
        "powder_dark": make_material(
            "Powder coat service gray",
            (0.30, 0.33, 0.33, 1.0),
            metallic=0.08,
            roughness=0.36,
        ),
        "shadow": make_material(
            "Casework seam shadow",
            (0.018, 0.022, 0.022, 1.0),
            roughness=0.58,
        ),
        "stainless": make_material(
            "Brushed stainless steel",
            (0.60, 0.64, 0.65, 1.0),
            metallic=0.96,
            roughness=0.20,
            anisotropy=0.72,
        ),
        "aluminum": make_material(
            "Satin anodized aluminum",
            (0.52, 0.56, 0.57, 1.0),
            metallic=0.88,
            roughness=0.23,
            anisotropy=0.42,
        ),
        "zinc": make_material(
            "Zinc plated hardware",
            (0.45, 0.49, 0.50, 1.0),
            metallic=0.91,
            roughness=0.30,
        ),
        "black": make_material(
            "Black engineering polymer",
            (0.012, 0.016, 0.018, 1.0),
            roughness=0.38,
            coat=0.08,
        ),
        "rubber": make_material(
            "Black leveling-foot rubber",
            (0.009, 0.011, 0.011, 1.0),
            roughness=0.78,
        ),
        "interior": make_material(
            "Casework interior enamel",
            (0.49, 0.52, 0.51, 1.0),
            metallic=0.04,
            roughness=0.48,
        ),
        "label": make_material(
            "Matte equipment label",
            (0.87, 0.88, 0.83, 1.0),
            roughness=0.64,
        ),
        "blue": make_material(
            "Cold service blue",
            (0.025, 0.20, 0.47, 1.0),
            roughness=0.27,
            coat=0.20,
        ),
        "red": make_material(
            "Hot service red",
            (0.60, 0.030, 0.020, 1.0),
            roughness=0.29,
            coat=0.18,
        ),
        "green": make_material(
            "Room 809 inventory green",
            (0.025, 0.40, 0.19, 1.0),
            roughness=0.31,
            coat=0.10,
        ),
        "yellow": make_material(
            "Electrical caution yellow",
            (0.86, 0.57, 0.025, 1.0),
            roughness=0.34,
        ),
    }


def create_root(spec: AssetSpec) -> None:
    global ROOT
    ROOT = bpy.data.objects.new(f"{spec.asset_id}__ROOT", None)
    bpy.context.collection.objects.link(ROOT)
    ROOT["asset_id"] = spec.asset_id
    ROOT["anchor"] = "footprint-center-ground"
    ROOT["nominal_dimensions_m"] = [spec.width, spec.depth, spec.height]
    ROOT["worktop_height_m"] = spec.height
    ROOT["asset_class"] = "laboratory steel casework"
    ROOT["planning_model"] = True
    ROOT["manufacturer_certified"] = False


def parent_to_root(obj: bpy.types.Object, category: str = "detail") -> bpy.types.Object:
    if ROOT is not None:
        obj.parent = ROOT
    obj["part_category"] = category
    return obj


def assign_material(obj: bpy.types.Object, material: bpy.types.Material) -> None:
    if hasattr(obj.data, "materials"):
        obj.data.materials.append(material)


def smooth(obj: bpy.types.Object) -> None:
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True


def add_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    bevel: float = 0.004,
    category: str = "casework",
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign_material(obj, material)
    if bevel > 0.0:
        modifier = obj.modifiers.new(name="Manufactured edge", type="BEVEL")
        modifier.width = min(bevel, min(dimensions) * 0.22)
        modifier.segments = 3
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
    vertices: int = 32,
    bevel: float = 0.0,
    category: str = "hardware",
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
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
        modifier = obj.modifiers.new(name="Rounded hardware edge", type="BEVEL")
        modifier.width = min(bevel, radius * 0.25, depth * 0.20)
        modifier.segments = 2
        modifier.harden_normals = True
    return parent_to_root(obj, category)


def add_worktop(width: float, depth: float) -> None:
    z = 0.878
    add_box(
        "Phenolic worktop core",
        (0.0, 0.0, z),
        (width - 0.012, depth - 0.012, 0.044),
        MATERIALS["phenolic"],
        bevel=0.009,
        category="worktop",
    )
    add_box(
        "Worktop front exposed edge",
        (0.0, -depth / 2.0 + 0.006, z),
        (width, 0.012, 0.044),
        MATERIALS["phenolic_edge"],
        bevel=0.004,
        category="worktop",
    )
    add_box(
        "Worktop rear exposed edge",
        (0.0, depth / 2.0 - 0.006, z),
        (width, 0.012, 0.044),
        MATERIALS["phenolic_edge"],
        bevel=0.004,
        category="worktop",
    )
    add_box(
        "Worktop left exposed edge",
        (-width / 2.0 + 0.006, 0.0, z),
        (0.012, depth - 0.024, 0.044),
        MATERIALS["phenolic_edge"],
        bevel=0.003,
        category="worktop",
    )
    add_box(
        "Worktop right exposed edge",
        (width / 2.0 - 0.006, 0.0, z),
        (0.012, depth - 0.024, 0.044),
        MATERIALS["phenolic_edge"],
        bevel=0.003,
        category="worktop",
    )


def add_leveler(name: str, x: float, y: float) -> None:
    add_cylinder(
        f"{name} threaded stem",
        (x, y, 0.050),
        0.009,
        0.076,
        MATERIALS["zinc"],
        vertices=24,
        category="leveling hardware",
    )
    add_cylinder(
        f"{name} lock nut",
        (x, y, 0.020),
        0.014,
        0.011,
        MATERIALS["zinc"],
        vertices=12,
        bevel=0.001,
        category="leveling hardware",
    )
    add_cylinder(
        f"{name} rubber pad",
        (x, y, 0.006),
        0.028,
        0.012,
        MATERIALS["rubber"],
        vertices=32,
        bevel=0.002,
        category="leveling hardware",
    )


def add_face_fastener(
    name: str,
    x: float,
    y: float,
    z: float,
    normal_y: float,
    material: bpy.types.Material | None = None,
) -> None:
    add_cylinder(
        name,
        (x, y + normal_y * 0.003, z),
        0.0042,
        0.004,
        material or MATERIALS["zinc"],
        axis=(0.0, normal_y, 0.0),
        vertices=20,
        bevel=0.0005,
        category="fastener",
    )


def add_label_plate(name: str, x: float, y: float, z: float, normal_y: float) -> None:
    add_box(
        f"{name} label field",
        (x, y + normal_y * 0.010, z),
        (0.082, 0.004, 0.028),
        MATERIALS["label"],
        bevel=0.002,
        category="label",
    )
    add_box(
        f"{name} inventory stripe",
        (x - 0.035, y + normal_y * 0.013, z),
        (0.006, 0.002, 0.020),
        MATERIALS["green"],
        bevel=0.0005,
        category="label",
    )


def add_recessed_pull(
    name: str,
    x: float,
    y: float,
    z: float,
    width: float,
    normal_y: float,
) -> None:
    # A shallow C-channel reads like a real folded laboratory pull. The dark
    # reveal is deliberately subordinate to the satin aluminum grip so the
    # face stays clean and light instead of becoming a stack of black slots.
    recess_width = min(max(width * 0.62, 0.14), 0.30)
    add_box(
        f"{name} recessed pocket",
        (x, y + normal_y * 0.011, z),
        (recess_width, 0.007, 0.024),
        MATERIALS["shadow"],
        bevel=0.005,
        category="pull",
    )
    add_box(
        f"{name} pull lip",
        (x, y + normal_y * 0.017, z + 0.007),
        (recess_width - 0.012, 0.009, 0.009),
        MATERIALS["aluminum"],
        bevel=0.002,
        category="pull",
    )
    add_box(
        f"{name} lower grip highlight",
        (x, y + normal_y * 0.018, z - 0.006),
        (recess_width - 0.018, 0.006, 0.0035),
        MATERIALS["stainless"],
        bevel=0.001,
        category="pull",
    )


def add_vertical_door_pull(
    name: str,
    x: float,
    y: float,
    z: float,
    normal_y: float,
) -> None:
    """Slim anodized pull with two standoffs for paired cabinet doors."""
    add_box(
        f"{name} handle rail",
        (x, y + normal_y * 0.014, z),
        (0.014, 0.011, 0.165),
        MATERIALS["aluminum"],
        bevel=0.005,
        category="door pull",
    )
    for offset in (-0.060, 0.060):
        add_box(
            f"{name} handle standoff {offset:+.3f}",
            (x, y + normal_y * 0.008, z + offset),
            (0.020, 0.012, 0.012),
            MATERIALS["aluminum"],
            bevel=0.002,
            category="door pull",
        )


def add_casework_reveal_backer(
    name: str,
    x: float,
    face_y: float,
    width: float,
    bottom: float,
    height: float,
    normal_y: float,
) -> None:
    """Dark recessed plane behind fronts so every reveal is even and legible."""
    add_box(
        f"{name} reveal backer",
        (x, face_y - normal_y * 0.014, bottom + height / 2.0),
        (width - 0.004, 0.010, height),
        MATERIALS["shadow"],
        bevel=0.002,
        category="casework reveal",
    )


def add_drawer_bank(
    name: str,
    x: float,
    face_y: float,
    width: float,
    normal_y: float,
    heights: tuple[float, ...],
    *,
    include_labels: bool = True,
) -> None:
    bottom = 0.125
    gap = 0.008
    add_casework_reveal_backer(
        name,
        x,
        face_y,
        width,
        bottom,
        sum(heights),
        normal_y,
    )
    for index, height in enumerate(heights, 1):
        panel_height = height - gap
        center_z = bottom + height / 2.0
        add_box(
            f"{name} drawer {index} front",
            (x, face_y, center_z),
            (width - 0.012, 0.022, panel_height),
            MATERIALS["powder_light"] if index == 1 else MATERIALS["powder"],
            bevel=0.004,
            category="drawer front",
        )
        add_recessed_pull(
            f"{name} drawer {index}",
            x,
            face_y,
            center_z + panel_height / 2.0 - 0.043,
            width,
            normal_y,
        )
        if index == 1 and include_labels:
            add_label_plate(
                f"{name} drawer {index}",
                x + width * 0.34,
                face_y,
                center_z,
                normal_y,
            )
        bottom += height


def add_door_pair(
    name: str,
    x: float,
    face_y: float,
    width: float,
    normal_y: float,
    *,
    one_door: bool = False,
) -> None:
    bottom = 0.126
    height = 0.668
    add_casework_reveal_backer(name, x, face_y, width, bottom, height, normal_y)
    count = 1 if one_door else 2
    leaf_width = width / count
    for leaf in range(count):
        leaf_x = x + (leaf - (count - 1) / 2.0) * leaf_width
        add_box(
            f"{name} door {leaf + 1}",
            (leaf_x, face_y, bottom + height / 2.0),
            (leaf_width - 0.012, 0.022, height - 0.008),
            MATERIALS["powder"],
            bevel=0.005,
            category="cabinet door",
        )
        pull_x = leaf_x
        if count == 2:
            pull_x += (-1.0 if leaf == 0 else 1.0) * leaf_width * 0.22
        add_recessed_pull(
            f"{name} door {leaf + 1}",
            pull_x,
            face_y,
            bottom + height - 0.058,
            leaf_width,
            normal_y,
        )
        hinge_x = leaf_x + (-1.0 if leaf == 0 else 1.0) * (leaf_width / 2.0 - 0.024)
        if count == 1:
            hinge_x = leaf_x - leaf_width / 2.0 + 0.024
        for hinge_z in (bottom + 0.15, bottom + height - 0.16):
            add_box(
                f"{name} door {leaf + 1} hinge {hinge_z:.2f}",
                (hinge_x, face_y + normal_y * 0.014, hinge_z),
                (0.016, 0.006, 0.050),
                MATERIALS["zinc"],
                bevel=0.002,
                category="hinge",
            )
    add_label_plate(name, x + width * 0.36, face_y, 0.42, normal_y)


def add_double_door_cabinet_with_top_drawers(
    name: str,
    x: float,
    face_y: float,
    width: float,
    normal_y: float,
) -> None:
    """Shimadzu-style module: two adjacent drawers above two hinged doors."""
    leaf_width = width / 2.0
    door_bottom = 0.126
    door_height = 0.474
    drawer_bottom = door_bottom + door_height + 0.008
    drawer_height = 0.186
    add_casework_reveal_backer(
        name,
        x,
        face_y,
        width,
        door_bottom,
        door_height + 0.008 + drawer_height,
        normal_y,
    )
    for leaf in range(2):
        leaf_x = x + (leaf - 0.5) * leaf_width
        add_box(
            f"{name} lower door {leaf + 1}",
            (leaf_x, face_y, door_bottom + door_height / 2.0),
            (leaf_width - 0.012, 0.022, door_height - 0.008),
            MATERIALS["powder"],
            bevel=0.005,
            category="cabinet door",
        )
        pull_x = leaf_x + (1.0 if leaf == 0 else -1.0) * (leaf_width / 2.0 - 0.045)
        add_vertical_door_pull(
            f"{name} lower door {leaf + 1}",
            pull_x,
            face_y,
            door_bottom + door_height * 0.56,
            normal_y,
        )
        hinge_x = leaf_x + (-1.0 if leaf == 0 else 1.0) * (leaf_width / 2.0 - 0.024)
        for hinge_z in (door_bottom + 0.13, door_bottom + door_height - 0.13):
            add_box(
                f"{name} lower door {leaf + 1} hinge {hinge_z:.2f}",
                (hinge_x, face_y + normal_y * 0.014, hinge_z),
                (0.016, 0.006, 0.050),
                MATERIALS["zinc"],
                bevel=0.002,
                category="hinge",
            )
        add_box(
            f"{name} top drawer {leaf + 1} front",
            (leaf_x, face_y, drawer_bottom + drawer_height / 2.0),
            (leaf_width - 0.012, 0.022, drawer_height - 0.008),
            MATERIALS["powder_light"],
            bevel=0.004,
            category="drawer front",
        )
        add_recessed_pull(
            f"{name} top drawer {leaf + 1}",
            leaf_x,
            face_y,
            drawer_bottom + drawer_height - 0.043,
            leaf_width,
            normal_y,
        )


def add_rear_access_panel(
    name: str,
    x: float,
    y: float,
    width: float,
    height: float,
    normal_y: float,
    *,
    vented: bool = False,
) -> None:
    center_z = 0.47
    add_box(
        f"{name} access panel",
        (x, y, center_z),
        (width - 0.012, 0.018, height),
        MATERIALS["powder_dark"],
        bevel=0.003,
        category="rear service panel",
    )
    for sx in (-1.0, 1.0):
        for sz in (-1.0, 1.0):
            add_face_fastener(
                f"{name} access fastener {sx:+.0f} {sz:+.0f}",
                x + sx * (width / 2.0 - 0.030),
                y,
                center_z + sz * (height / 2.0 - 0.030),
                normal_y,
            )
    if vented:
        for row in range(7):
            add_box(
                f"{name} ventilation slot {row + 1}",
                (x, y + normal_y * 0.012, center_z - 0.075 + row * 0.025),
                (min(width * 0.58, 0.34), 0.005, 0.007),
                MATERIALS["shadow"],
                bevel=0.002,
                category="ventilation",
            )


def add_socket_plate(name: str, x: float, y: float, z: float, normal_y: float) -> None:
    add_box(
        f"{name} power faceplate",
        (x, y + normal_y * 0.010, z),
        (0.102, 0.006, 0.062),
        MATERIALS["powder_light"],
        bevel=0.006,
        category="utility",
    )
    for socket_x in (-0.024, 0.024):
        add_cylinder(
            f"{name} socket {socket_x:+.3f}",
            (x + socket_x, y + normal_y * 0.015, z),
            0.013,
            0.005,
            MATERIALS["black"],
            axis=(0.0, normal_y, 0.0),
            vertices=24,
            bevel=0.001,
            category="utility",
        )
        for pin_x in (-0.004, 0.004):
            add_cylinder(
                f"{name} pin aperture {socket_x:+.3f} {pin_x:+.3f}",
                (x + socket_x + pin_x, y + normal_y * 0.018, z + 0.002),
                0.0022,
                0.002,
                MATERIALS["shadow"],
                axis=(0.0, normal_y, 0.0),
                vertices=12,
                category="utility",
            )
    add_box(
        f"{name} caution marker",
        (x + 0.042, y + normal_y * 0.015, z + 0.022),
        (0.010, 0.002, 0.009),
        MATERIALS["yellow"],
        bevel=0.001,
        category="label",
    )


def add_lab_bench(spec: AssetSpec) -> None:
    add_worktop(spec.width, spec.depth)

    # The steel carcass is deliberately built from individual folded panels so
    # the back, side, and underside remain credible from an orbit view.
    add_box(
        "Bench recessed toe plinth",
        (0.0, -0.008, 0.083),
        (1.68, 0.565, 0.122),
        MATERIALS["powder_dark"],
        bevel=0.006,
        category="plinth",
    )
    add_box(
        "Bench lower carcass floor",
        (0.0, -0.006, 0.116),
        (1.70, 0.642, 0.032),
        MATERIALS["interior"],
        bevel=0.003,
        category="carcass",
    )
    add_box(
        "Bench upper carcass rail",
        (0.0, -0.006, 0.824),
        (1.70, 0.642, 0.042),
        MATERIALS["powder_dark"],
        bevel=0.004,
        category="carcass",
    )
    for side_x, side_name in ((-0.845, "left"), (0.845, "right")):
        add_box(
            f"Bench {side_name} folded end gable",
            (side_x, -0.006, 0.466),
            (0.030, 0.642, 0.704),
            MATERIALS["powder"],
            bevel=0.005,
            category="end gable",
        )
        add_box(
            f"Bench {side_name} underside worktop bracket",
            (side_x, 0.0, 0.842),
            (0.055, 0.685, 0.020),
            MATERIALS["aluminum"],
            bevel=0.003,
            category="worktop support",
        )
        for side_y in (-0.280, 0.280):
            add_cylinder(
                f"Bench {side_name} side panel screw {side_y:+.2f}",
                (side_x + (-0.017 if side_x < 0 else 0.017), side_y, 0.67),
                0.004,
                0.004,
                MATERIALS["zinc"],
                axis=(-1.0 if side_x < 0 else 1.0, 0.0, 0.0),
                vertices=18,
                category="fastener",
            )

    # Vertical folded dividers are visible through the fine front reveals.
    for divider_x in (-0.375, 0.375):
        add_box(
            f"Bench internal divider {divider_x:+.3f}",
            (divider_x, -0.006, 0.465),
            (0.026, 0.610, 0.690),
            MATERIALS["interior"],
            bevel=0.003,
            category="carcass",
        )

    front_y = -0.336
    add_drawer_bank(
        "Bench left three-drawer bank",
        -0.610,
        front_y,
        0.450,
        -1.0,
        (0.180, 0.220, 0.268),
        include_labels=False,
    )
    add_double_door_cabinet_with_top_drawers(
        "Bench center paired-door cabinet", 0.0, front_y, 0.750, -1.0
    )
    add_drawer_bank(
        "Bench right three-drawer bank",
        0.610,
        front_y,
        0.450,
        -1.0,
        (0.180, 0.220, 0.268),
        include_labels=False,
    )

    # A recessed kick shadow makes the casework read as folded steel rather
    # than a monolithic box.
    add_box(
        "Bench continuous front toe shadow",
        (0.0, -0.326, 0.079),
        (1.655, 0.018, 0.072),
        MATERIALS["shadow"],
        bevel=0.004,
        category="toe kick",
    )
    add_box(
        "Bench front toe-kick face",
        (0.0, -0.316, 0.051),
        (1.615, 0.012, 0.053),
        MATERIALS["powder_dark"],
        bevel=0.003,
        category="toe kick",
    )

    # Rear service chase, removable panels, ventilation, and utilities.
    rear_y = 0.322
    add_box(
        "Bench rear service chase shell",
        (0.0, 0.288, 0.532),
        (1.69, 0.066, 0.588),
        MATERIALS["interior"],
        bevel=0.004,
        category="service chase",
    )
    add_rear_access_panel(
        "Bench left rear",
        -0.565,
        rear_y,
        0.555,
        0.530,
        1.0,
        vented=True,
    )
    add_rear_access_panel(
        "Bench center rear",
        0.0,
        rear_y,
        0.555,
        0.530,
        1.0,
        vented=False,
    )
    add_rear_access_panel(
        "Bench right rear",
        0.565,
        rear_y,
        0.555,
        0.530,
        1.0,
        vented=True,
    )
    add_box(
        "Bench rear under-top utility rail",
        (0.0, 0.321, 0.786),
        (1.655, 0.028, 0.075),
        MATERIALS["powder"],
        bevel=0.005,
        category="utility rail",
    )
    add_socket_plate("Bench rear power left", -0.46, 0.337, 0.786, 1.0)
    add_socket_plate("Bench rear power right", 0.46, 0.337, 0.786, 1.0)
    for service_x, material_key in ((-0.14, "blue"), (0.14, "red")):
        add_cylinder(
            f"Bench rear service port {material_key}",
            (service_x, 0.341, 0.785),
            0.021,
            0.009,
            MATERIALS[material_key],
            axis=(0.0, 1.0, 0.0),
            vertices=32,
            bevel=0.002,
            category="utility",
        )
        add_cylinder(
            f"Bench rear service port {material_key} center",
            (service_x, 0.347, 0.785),
            0.008,
            0.006,
            MATERIALS["stainless"],
            axis=(0.0, 1.0, 0.0),
            vertices=24,
            category="utility",
        )

    # Six hidden-but-orbitable levelers match fixed Room 809 casework.
    for index, (x, y) in enumerate(
        (
            (-0.78, -0.24),
            (0.0, -0.24),
            (0.78, -0.24),
            (-0.78, 0.24),
            (0.0, 0.24),
            (0.78, 0.24),
        ),
        1,
    ):
        add_leveler(f"Bench leveler {index}", x, y)


def add_island_side_casework(
    side_name: str,
    normal_y: float,
    pattern: tuple[str, str, str, str],
    casework_width: float,
) -> None:
    y_center = normal_y * 0.270
    face_y = normal_y * 0.527
    shell_width = casework_width - 0.108
    add_box(
        f"Island {side_name} carcass shell",
        (0.0, y_center, 0.466),
        (shell_width, 0.510, 0.704),
        MATERIALS["interior"],
        bevel=0.006,
        category="carcass",
    )
    add_box(
        f"Island {side_name} upper folded rail",
        (0.0, normal_y * 0.285, 0.821),
        (casework_width - 0.10, 0.510, 0.040),
        MATERIALS["powder_dark"],
        bevel=0.004,
        category="carcass",
    )
    add_box(
        f"Island {side_name} recessed plinth",
        (0.0, normal_y * 0.244, 0.078),
        (casework_width - 0.20, 0.405, 0.112),
        MATERIALS["powder_dark"],
        bevel=0.005,
        category="plinth",
    )
    add_box(
        f"Island {side_name} toe shadow",
        (0.0, normal_y * 0.512, 0.080),
        (casework_width - 0.21, 0.018, 0.075),
        MATERIALS["shadow"],
        bevel=0.004,
        category="toe kick",
    )
    add_box(
        f"Island {side_name} toe-kick face",
        (0.0, normal_y * 0.500, 0.051),
        (casework_width - 0.25, 0.014, 0.052),
        MATERIALS["powder_dark"],
        bevel=0.003,
        category="toe kick",
    )

    # Preserve believable component proportions instead of stretching an old
    # four-box grid. Shimadzu-style central cabinet bays need more width for
    # paired doors and adjacent drawers; the end drawer banks remain compact.
    usable_width = casework_width - 0.128
    width_weights = {
        "drawers-low": 0.78,
        "double-door-with-drawers": 1.25,
    }
    weights = tuple(width_weights.get(kind, 1.0) for kind in pattern)
    weight_total = sum(weights)
    module_widths = tuple(usable_width * weight / weight_total for weight in weights)
    left_edge = -usable_width / 2.0
    centers_list: list[float] = []
    divider_xs: list[float] = []
    cursor = left_edge
    for index, module_width in enumerate(module_widths):
        centers_list.append(cursor + module_width / 2.0)
        cursor += module_width
        if index < len(module_widths) - 1:
            divider_xs.append(cursor)
    centers = tuple(centers_list)

    for divider_x in divider_xs:
        add_box(
            f"Island {side_name} divider {divider_x:+.3f}",
            (divider_x, y_center, 0.466),
            (0.024, 0.475, 0.684),
            MATERIALS["powder_dark"],
            bevel=0.003,
            category="carcass",
        )
    for module, (center_x, kind, module_width) in enumerate(
        zip(centers, pattern, module_widths), 1
    ):
        if kind == "drawers-low":
            add_drawer_bank(
                f"Island {side_name} module {module}",
                center_x,
                face_y,
                module_width,
                normal_y,
                (0.155, 0.235, 0.285),
                include_labels="double-door-with-drawers" not in pattern,
            )
        elif kind == "drawers-even":
            add_drawer_bank(
                f"Island {side_name} module {module}",
                center_x,
                face_y,
                module_width,
                normal_y,
                (0.155, 0.165, 0.175, 0.180),
            )
        elif kind == "double-door-with-drawers":
            add_double_door_cabinet_with_top_drawers(
                f"Island {side_name} module {module}",
                center_x,
                face_y,
                module_width,
                normal_y,
            )
        else:
            add_door_pair(
                f"Island {side_name} module {module}",
                center_x,
                face_y,
                module_width,
                normal_y,
                one_door=True,
            )


def add_end_service_plate(name: str, x: float, normal_x: float) -> None:
    add_box(
        f"{name} end access panel",
        (x, 0.0, 0.480),
        (0.018, 0.770, 0.530),
        MATERIALS["powder_dark"],
        bevel=0.004,
        category="end service panel",
    )
    for y in (-0.335, 0.335):
        for z in (0.245, 0.715):
            add_cylinder(
                f"{name} end fastener {y:+.3f} {z:.3f}",
                (x + normal_x * 0.012, y, z),
                0.0042,
                0.004,
                MATERIALS["zinc"],
                axis=(normal_x, 0.0, 0.0),
                vertices=20,
                bevel=0.0005,
                category="fastener",
            )
    for row in range(8):
        add_box(
            f"{name} end ventilation {row + 1}",
            (x + normal_x * 0.012, 0.0, 0.385 + row * 0.026),
            (0.005, 0.310, 0.007),
            MATERIALS["shadow"],
            bevel=0.002,
            category="ventilation",
        )
    for y, key in ((-0.205, "blue"), (0.205, "red")):
        add_cylinder(
            f"{name} {key} end service port",
            (x + normal_x * 0.016, y, 0.738),
            0.022,
            0.012,
            MATERIALS[key],
            axis=(normal_x, 0.0, 0.0),
            vertices=32,
            bevel=0.002,
            category="utility",
        )
        add_cylinder(
            f"{name} {key} end service spindle",
            (x + normal_x * 0.023, y, 0.738),
            0.008,
            0.009,
            MATERIALS["stainless"],
            axis=(normal_x, 0.0, 0.0),
            vertices=24,
            category="utility",
        )


def add_center_island(
    spec: AssetSpec,
    *,
    north_pattern: tuple[str, str, str, str] = (
        "drawers-low",
        "double-door-with-drawers",
        "double-door-with-drawers",
        "drawers-low",
    ),
    south_pattern: tuple[str, str, str, str] = (
        "drawers-low",
        "double-door-with-drawers",
        "double-door-with-drawers",
        "drawers-low",
    ),
) -> None:
    add_worktop(spec.width, spec.depth)
    add_island_side_casework("north", 1.0, north_pattern, spec.width)
    add_island_side_casework("south", -1.0, south_pattern, spec.width)

    # The central service spine and end plates make the island credible from
    # both ends; utilities can be reached without removing front casework.
    add_box(
        "Island central service spine",
        (0.0, 0.0, 0.475),
        (spec.width - 0.11, 0.075, 0.690),
        MATERIALS["powder_dark"],
        bevel=0.005,
        category="service chase",
    )
    end_gable_x = spec.width / 2.0 - 0.042
    for end_x, name, normal in (
        (-end_gable_x, "Island west", -1.0),
        (end_gable_x, "Island east", 1.0),
    ):
        add_box(
            f"{name} folded end gable",
            (end_x, 0.0, 0.466),
            (0.028, 1.045, 0.704),
            MATERIALS["powder"],
            bevel=0.005,
            category="end gable",
        )
        add_box(
            f"{name} underside worktop support",
            (end_x, 0.0, 0.842),
            (0.058, 1.105, 0.020),
            MATERIALS["aluminum"],
            bevel=0.003,
            category="worktop support",
        )
        # Keep all fittings inside the catalog footprint; the worktop is
        # the outermost plan envelope even when the end panel is inspected.
        add_end_service_plate(name, end_x, normal)

    # Two flush cable/service grommets remain within the 900 mm catalog height.
    for index, x in enumerate((-spec.width * 0.258, spec.width * 0.258), 1):
        add_cylinder(
            f"Island worktop grommet {index} outer",
            (x, 0.0, 0.899),
            0.040,
            0.002,
            MATERIALS["black"],
            vertices=48,
            bevel=0.0006,
            category="worktop utility",
        )
        add_cylinder(
            f"Island worktop grommet {index} center",
            (x, 0.0, 0.8995),
            0.026,
            0.001,
            MATERIALS["powder_dark"],
            vertices=48,
            category="worktop utility",
        )
        add_box(
            f"Island worktop grommet {index} cable notch",
            (x + 0.025, 0.0, 0.8995),
            (0.018, 0.010, 0.001),
            MATERIALS["shadow"],
            bevel=0.001,
            category="worktop utility",
        )

    # Eight real leveling points support the two-sided steel carcass.
    outer_leveler_x = spec.width / 2.0 - 0.14
    inner_leveler_x = spec.width / 6.0
    leveler_positions = tuple(
        (x, y)
        for y in (-0.425, 0.425)
        for x in (-outer_leveler_x, -inner_leveler_x, inner_leveler_x, outer_leveler_x)
    )
    for index, (x, y) in enumerate(leveler_positions, 1):
        add_leveler(f"Island leveler {index}", x, y)


def mesh_bounds() -> tuple[Vector, Vector]:
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("Authored scene contains no mesh geometry")
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = Vector(
        (
            min(point.x for point in points),
            min(point.y for point in points),
            min(point.z for point in points),
        )
    )
    maximum = Vector(
        (
            max(point.x for point in points),
            max(point.y for point in points),
            max(point.z for point in points),
        )
    )
    return minimum, maximum


def consolidate_static_meshes_by_material() -> dict[str, int]:
    """Bake modifiers and batch static parts into one mesh per PBR material.

    The authored models intentionally start as many named manufacturing parts
    because that makes their construction understandable and maintainable.
    LabSpace places many benches in one room, though, so the exported runtime
    representation is consolidated to approximately one draw call per material
    without changing any evaluated geometry or shading.
    """
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    source_parts = len(meshes)

    # Apply all bevel modifiers before batching so the joined meshes are a
    # literal snapshot of the reviewed high-detail construction.
    for obj in meshes:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)

    groups: dict[str, list[bpy.types.Object]] = {}
    for obj in meshes:
        material = obj.data.materials[0] if obj.data.materials else None
        key = material.name if material is not None else "__unassigned__"
        groups.setdefault(key, []).append(obj)

    for material_name, objects in sorted(groups.items()):
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        active = objects[0]
        bpy.context.view_layer.objects.active = active
        if len(objects) > 1:
            bpy.ops.object.join()
        active = bpy.context.view_layer.objects.active
        assert active is not None
        active.name = f"Runtime batch - {material_name}"
        active["part_category"] = "static material batch"
        active["source_part_count"] = len(objects)
        active.parent = ROOT
        # Joining objects that reference the same material can leave redundant
        # slots in some Blender versions. Remove them to preserve one primitive.
        bpy.ops.object.material_slot_remove_unused()

    bpy.ops.object.select_all(action="DESELECT")
    return {
        "source_parts": source_parts,
        "runtime_batches": len(
            [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
        ),
    }


def triangle_count(obj: bpy.types.Object) -> int:
    if obj.type != "MESH":
        return 0
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def authored_statistics(spec: AssetSpec) -> dict[str, object]:
    bpy.context.view_layer.update()
    minimum, maximum = mesh_bounds()
    dimensions = maximum - minimum
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    materials = {
        slot.material.name
        for obj in meshes
        for slot in obj.material_slots
        if slot.material is not None
    }
    return {
        "asset_id": spec.asset_id,
        "objects": len(bpy.context.scene.objects),
        "mesh_objects": len(meshes),
        "materials": len(materials),
        "vertices": sum(len(obj.data.vertices) for obj in meshes),
        "triangles": sum(triangle_count(obj) for obj in meshes),
        "bounds_m": {
            "min": [round(value, 6) for value in minimum],
            "max": [round(value, 6) for value in maximum],
            "dimensions": [round(value, 6) for value in dimensions],
        },
    }


def validate_statistics(spec: AssetSpec, stats: dict[str, object], *, imported: bool) -> None:
    bounds = stats["bounds_m"]
    dimensions = bounds["dimensions"]
    minimum = bounds["min"]
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
    center_x = (bounds["min"][0] + bounds["max"][0]) * 0.5
    center_y = (bounds["min"][1] + bounds["max"][1]) * 0.5
    if abs(center_x) > 0.002 or abs(center_y) > 0.002:
        errors.append(
            f"footprint center ({center_x:.6f}, {center_y:.6f}) is not at origin"
        )
    if stats["mesh_objects"] > 25:
        errors.append(
            f"{stats['mesh_objects']} runtime mesh batches exceeds the 25 draw-call target"
        )
    if stats["mesh_objects"] < 12:
        errors.append(f"only {stats['mesh_objects']} material batches")
    if stats["materials"] < 14:
        errors.append(f"only {stats['materials']} exported PBR materials")
    if imported:
        disallowed = [
            obj.name
            for obj in bpy.context.scene.objects
            if obj.type in {"CAMERA", "LIGHT"}
        ]
        if disallowed:
            errors.append(f"export contains cameras/lights: {disallowed}")
    if errors:
        stage = "imported GLB" if imported else "authored scene"
        raise RuntimeError(f"{spec.asset_id} {stage} validation failed: " + "; ".join(errors))


def export_glb(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    result = bpy.ops.export_scene.gltf(
        filepath=str(path),
        check_existing=False,
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
        # LabSpace runs fully offline and intentionally does not install a
        # remote Draco decoder. Keep hero furniture as a self-contained GLB.
        export_draco_mesh_compression_enable=False,
        export_loglevel=-1,
    )
    if "FINISHED" not in result:
        raise RuntimeError(f"GLB export failed: {result}")


def inspect_export(spec: AssetSpec, path: Path) -> dict[str, object]:
    if not path.exists() or path.stat().st_size < 100_000:
        raise RuntimeError(f"GLB output is missing or unexpectedly small: {path}")
    reset_scene()
    result = bpy.ops.import_scene.gltf(filepath=str(path))
    if "FINISHED" not in result:
        raise RuntimeError(f"Fresh GLB import failed: {result}")
    stats = authored_statistics(spec)
    stats["bytes"] = path.stat().st_size
    stats["output"] = str(path)
    validate_statistics(spec, stats, imported=True)
    return stats


def render_qa_preview(spec: AssetSpec, path: Path) -> None:
    """Render the freshly re-imported GLB without mutating the exported file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = str(path)
    scene.world.color = (0.038, 0.043, 0.050)
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass

    ground_material = make_material(
        "QA neutral studio floor",
        (0.12, 0.13, 0.14, 1.0),
        roughness=0.62,
    )
    bpy.ops.mesh.primitive_plane_add(size=max(spec.width, spec.depth) * 4.0, location=(0.0, 0.0, -0.002))
    ground = bpy.context.object
    ground.name = "QA studio floor - not exported"
    assign_material(ground, ground_material)

    def add_area(
        name: str,
        location: tuple[float, float, float],
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
        obj.location = location
        obj.rotation_euler = (
            Vector((0.0, 0.0, 0.42)) - Vector(location)
        ).to_track_quat("-Z", "Y").to_euler()

    add_area("QA key softbox", (2.3, -2.5, 3.1), 1150.0, 2.4, (1.0, 0.91, 0.82))
    add_area("QA fill softbox", (-2.4, -1.1, 2.0), 780.0, 2.0, (0.76, 0.87, 1.0))
    add_area("QA rim strip", (0.6, 2.5, 2.7), 980.0, 1.6, (0.82, 0.90, 1.0))

    camera_data = bpy.data.cameras.new("QA orbit camera")
    camera = bpy.data.objects.new("QA orbit camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (
        (2.1, -2.35, 1.60)
        if spec.asset_id == "lab-bench"
        else (2.8, -3.15, 1.85)
    )
    camera.rotation_euler = (
        Vector((0.0, 0.0, 0.43)) - camera.location
    ).to_track_quat("-Z", "Y").to_euler()
    camera_data.lens = 58
    scene.camera = camera
    bpy.ops.render.render(write_still=True)

    rear_path = path.with_name(f"{path.stem}-rear{path.suffix}")
    scene.render.filepath = str(rear_path)
    camera.location = (
        (-2.1, 2.35, 1.60)
        if spec.asset_id == "lab-bench"
        else (-2.8, 3.15, 1.85)
    )
    camera.rotation_euler = (
        Vector((0.0, 0.0, 0.43)) - camera.location
    ).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.render.render(write_still=True)


def build_one(
    spec: AssetSpec,
    output_dir: Path,
    save_blend_dir: Path | None,
    preview_dir: Path | None,
) -> dict[str, object]:
    reset_scene(spec.asset_id)
    create_root(spec)
    build_materials()
    if spec.asset_id == "lab-bench":
        add_lab_bench(spec)
    elif spec.asset_id == "center-island-bench":
        add_center_island(spec)
    else:
        raise KeyError(spec.asset_id)

    batching = consolidate_static_meshes_by_material()
    authored = authored_statistics(spec)
    validate_statistics(spec, authored, imported=False)
    if ROOT is not None:
        ROOT["authored_bounds_m"] = authored["bounds_m"]["dimensions"]
        ROOT["mesh_parts"] = authored["mesh_objects"]
        ROOT["pbr_materials"] = authored["materials"]
        ROOT["source_part_count"] = batching["source_parts"]
        ROOT["runtime_material_batches"] = batching["runtime_batches"]

    if save_blend_dir is not None:
        save_blend_dir.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(save_blend_dir / f"{spec.asset_id}.blend"))

    output_path = output_dir / f"{spec.asset_id}.glb"
    export_glb(output_path)
    imported = inspect_export(spec, output_path)
    if preview_dir is not None:
        render_qa_preview(spec, preview_dir / f"{spec.asset_id}.png")
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
        build_one(spec, output_dir, save_blend_dir, preview_dir)
        for spec in selected
    ]
    print("LABSPACE_FURNITURE_BUILD " + json.dumps(results, sort_keys=True))


if __name__ == "__main__":
    main()
