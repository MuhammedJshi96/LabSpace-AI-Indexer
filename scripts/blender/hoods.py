"""Author all-sided fume-hood and biosafety-cabinet hero GLBs.

The models are original, dimension-driven planning assets.  Their visible
casework language follows the Kyushu University Room 809 photographs.  Hidden
construction is conservatively informed by common Shimadzu Rika fume-hood and
Thermo Scientific 1300-series Class II A2 cabinet anatomy.  They are not
manufacturer-certified replicas.

Run from the repository root with the bundled portable Blender::

    .tools/blender-4.5.11-windows-x64/blender.exe --background \
      --factory-startup --python scripts/blender/hoods.py -- \
      --output-dir public/models/hero --preview-dir tmp/hood-previews
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT: bpy.types.Object | None = None
MATERIALS: dict[str, bpy.types.Material] = {}


ASSETS = {
    "fume-hood": {
        "filename": "fume-hood.glb",
        "dimensions": (1.50, 0.85, 2.40),
        "reference": (
            "Kyushu University Room 809 black-fascia fume hood; conservative "
            "Shimadzu Rika draft-chamber anatomy"
        ),
    },
    "biosafety-cabinet": {
        "filename": "biosafety-cabinet.glb",
        "dimensions": (1.50, 0.80, 2.25),
        "reference": (
            "Kyushu University Room 809 steel casework; conservative Thermo "
            "Scientific 1300-series Class II A2 anatomy"
        ),
    },
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--asset",
        choices=("all", *ASSETS.keys()),
        default="all",
        help="Build both assets or only one named asset.",
    )
    parser.add_argument(
        "--output-dir",
        default="public/models/hero",
        help="Destination directory for the two GLB files.",
    )
    parser.add_argument(
        "--preview-dir",
        default="",
        help="Optional directory for front and rear QA renders after re-import.",
    )
    parser.add_argument(
        "--save-blend-dir",
        default="",
        help="Optional directory for editable Blender snapshots.",
    )
    return parser.parse_args(argv)


def reset_scene(asset_id: str) -> None:
    global ROOT, MATERIALS
    ROOT = None
    MATERIALS = {}
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

    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.world.color = (0.025, 0.030, 0.038)
    scene["asset_id"] = asset_id
    scene["authoring_units"] = "meters"
    scene["design_reference"] = ASSETS[asset_id]["reference"]
    scene["planning_model"] = True
    scene["manufacturer_certified"] = False


def set_socket(bsdf: bpy.types.Node, name: str, value) -> None:
    socket = bsdf.inputs.get(name)
    if socket is not None:
        socket.default_value = value


def make_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    metallic: float = 0.0,
    roughness: float = 0.35,
    transmission: float = 0.0,
    ior: float = 1.45,
    coat: float = 0.0,
    coat_roughness: float = 0.16,
    anisotropy: float = 0.0,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
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
    set_socket(bsdf, "IOR", ior)
    set_socket(bsdf, "Alpha", color[3])
    set_socket(bsdf, "Transmission Weight", transmission)
    set_socket(bsdf, "Coat Weight", coat)
    set_socket(bsdf, "Coat Roughness", coat_roughness)
    set_socket(bsdf, "Anisotropic IOR Level", anisotropy)
    if emission is not None:
        set_socket(bsdf, "Emission Color", emission)
        set_socket(bsdf, "Emission Strength", emission_strength)
    if color[3] < 1.0 or transmission > 0.0:
        try:
            material.surface_render_method = "DITHERED"
            material.use_transparency_overlap = False
        except (AttributeError, TypeError):
            pass
    material["pbr_role"] = name
    return material


def build_materials() -> None:
    global MATERIALS
    MATERIALS = {
        "powder": make_material(
            "Room 809 light gray powder coat",
            (0.60, 0.62, 0.61, 1.0),
            metallic=0.06,
            roughness=0.30,
            coat=0.16,
        ),
        "powder_light": make_material(
            "Warm white powder coat",
            (0.82, 0.84, 0.82, 1.0),
            metallic=0.03,
            roughness=0.27,
            coat=0.18,
        ),
        "powder_dark": make_material(
            "Graphite powder coat",
            (0.055, 0.065, 0.068, 1.0),
            metallic=0.12,
            roughness=0.26,
            coat=0.20,
        ),
        "interior": make_material(
            "Chemical-resistant interior enamel",
            (0.70, 0.72, 0.69, 1.0),
            roughness=0.34,
            coat=0.12,
        ),
        "stainless": make_material(
            "Brushed 304 stainless steel",
            (0.58, 0.62, 0.64, 1.0),
            metallic=0.97,
            roughness=0.19,
            anisotropy=0.76,
        ),
        "steel_polished": make_material(
            "Polished stainless hardware",
            (0.74, 0.78, 0.80, 1.0),
            metallic=1.0,
            roughness=0.10,
            coat=0.16,
        ),
        "aluminum": make_material(
            "Satin anodized aluminum",
            (0.49, 0.53, 0.55, 1.0),
            metallic=0.90,
            roughness=0.23,
            anisotropy=0.40,
        ),
        "glass": make_material(
            "Clear laminated safety glass",
            (0.72, 0.90, 0.91, 0.22),
            roughness=0.045,
            transmission=0.92,
            ior=1.52,
            coat=0.08,
        ),
        "glass_edge": make_material(
            "Safety-glass green edge",
            (0.08, 0.42, 0.38, 0.68),
            roughness=0.10,
            transmission=0.34,
            ior=1.50,
        ),
        "black": make_material(
            "Black engineering polymer",
            (0.010, 0.014, 0.016, 1.0),
            roughness=0.35,
            coat=0.10,
        ),
        "rubber": make_material(
            "Black EPDM rubber", (0.006, 0.009, 0.010, 1.0), roughness=0.82
        ),
        "shadow": make_material(
            "Vent and seam shadow", (0.018, 0.024, 0.026, 1.0), roughness=0.60
        ),
        "screen": make_material(
            "Controller smoked glass",
            (0.004, 0.018, 0.024, 1.0),
            roughness=0.08,
            coat=0.52,
        ),
        "display": make_material(
            "Cyan controller pixels",
            (0.01, 0.52, 0.72, 1.0),
            roughness=0.13,
            emission=(0.01, 0.50, 0.74, 1.0),
            emission_strength=2.8,
        ),
        "red": make_material(
            "Safety red", (0.68, 0.025, 0.016, 1.0), roughness=0.25, coat=0.22
        ),
        "blue": make_material(
            "Laboratory service blue",
            (0.018, 0.17, 0.55, 1.0),
            roughness=0.25,
            coat=0.24,
        ),
        "green": make_material(
            "Status green",
            (0.02, 0.46, 0.13, 1.0),
            roughness=0.20,
            emission=(0.01, 0.42, 0.10, 1.0),
            emission_strength=1.2,
        ),
        "amber": make_material(
            "Service amber", (0.95, 0.48, 0.020, 1.0), roughness=0.27, coat=0.16
        ),
        "brass": make_material(
            "Nickel-plated service brass",
            (0.52, 0.44, 0.22, 1.0),
            metallic=0.88,
            roughness=0.20,
        ),
        "paper": make_material(
            "Matte safety label stock", (0.89, 0.89, 0.82, 1.0), roughness=0.70
        ),
    }


def create_root(asset_id: str) -> None:
    global ROOT
    ROOT = bpy.data.objects.new(f"{asset_id}__ROOT", None)
    bpy.context.collection.objects.link(ROOT)
    ROOT["asset_id"] = asset_id
    ROOT["anchor"] = "footprint-center-ground"
    ROOT["front_axis"] = "-Y"
    ROOT["up_axis_authoring"] = "+Z"
    ROOT["nominal_dimensions_m"] = ASSETS[asset_id]["dimensions"]
    ROOT["planning_model"] = True
    ROOT["manufacturer_certified"] = False


def parent_to_root(obj: bpy.types.Object) -> bpy.types.Object:
    if ROOT is not None:
        obj.parent = ROOT
    return obj


def assign_material(obj: bpy.types.Object, material: bpy.types.Material) -> None:
    if hasattr(obj.data, "materials"):
        obj.data.materials.append(material)


def smooth(obj: bpy.types.Object) -> None:
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True


def rounded_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    bevel: float = 0.008,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign_material(obj, material)
    if bevel > 0.0:
        modifier = obj.modifiers.new(name="Soft product edge", type="BEVEL")
        modifier.width = min(bevel, min(dimensions) * 0.22)
        modifier.segments = 3
        modifier.limit_method = "ANGLE"
        modifier.harden_normals = True
    return parent_to_root(obj)


def cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    material: bpy.types.Material,
    *,
    vertices: int = 40,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    bevel: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    assign_material(obj, material)
    smooth(obj)
    if bevel > 0.0:
        modifier = obj.modifiers.new(name="Rounded cylinder edge", type="BEVEL")
        modifier.width = min(bevel, radius * 0.25, depth * 0.20)
        modifier.segments = 2
        modifier.harden_normals = True
    return parent_to_root(obj)


def cylinder_between(
    name: str,
    start: tuple[float, float, float] | Vector,
    end: tuple[float, float, float] | Vector,
    radius: float,
    material: bpy.types.Material,
    *,
    vertices: int = 32,
    bevel: float = 0.0,
) -> bpy.types.Object:
    start_v, end_v = Vector(start), Vector(end)
    direction = end_v - start_v
    obj = cylinder(
        name,
        tuple((start_v + end_v) * 0.5),
        radius,
        direction.length,
        material,
        vertices=vertices,
        bevel=bevel,
    )
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0.0, 0.0, 1.0)).rotation_difference(
        direction.normalized()
    )
    return obj


def torus(
    name: str,
    location: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    material: bpy.types.Material,
    *,
    axis: tuple[float, float, float] = (0.0, 0.0, 1.0),
    major_segments: int = 48,
    minor_segments: int = 10,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=major_segments,
        minor_segments=minor_segments,
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
    return parent_to_root(obj)


def curve_tube(
    name: str,
    points: list[tuple[float, float, float] | Vector],
    radius: float,
    material: bpy.types.Material,
    *,
    bevel_resolution: int = 2,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(name=f"{name}_curve", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 3
    curve.bevel_depth = radius
    curve.bevel_resolution = bevel_resolution
    spline = curve.splines.new(type="BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = Vector(coordinate)
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    assign_material(obj, material)
    parent_to_root(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.name = name
    smooth(obj)
    obj.select_set(False)
    return obj


def text_mesh(
    name: str,
    body: str,
    location: tuple[float, float, float],
    size: float,
    material: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (math.pi / 2.0, 0.0, 0.0),
    align: str = "CENTER",
) -> bpy.types.Object:
    curve = bpy.data.curves.new(type="FONT", name=f"{name}_font")
    curve.body = body
    curve.align_x = align
    curve.align_y = "CENTER"
    curve.size = size
    curve.extrude = 0.00035
    curve.bevel_depth = 0.00008
    curve.bevel_resolution = 1
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = rotation
    assign_material(obj, material)
    parent_to_root(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.name = name
    obj.select_set(False)
    return obj


def front_fastener(name: str, x: float, y: float, z: float, radius: float = 0.004) -> None:
    cylinder_between(
        name,
        (x, y + 0.002, z),
        (x, y - 0.004, z),
        radius,
        MATERIALS["steel_polished"],
        vertices=18,
        bevel=0.0005,
    )


def side_fastener(
    name: str, x: float, y: float, z: float, normal_x: float, radius: float = 0.004
) -> None:
    cylinder_between(
        name,
        (x - normal_x * 0.002, y, z),
        (x + normal_x * 0.004, y, z),
        radius,
        MATERIALS["steel_polished"],
        vertices=18,
        bevel=0.0005,
    )


def add_front_handle(name: str, x: float, y: float, z: float, width: float) -> None:
    cylinder_between(
        f"{name}_bar",
        (x - width * 0.5, y - 0.030, z),
        (x + width * 0.5, y - 0.030, z),
        0.010,
        MATERIALS["aluminum"],
        vertices=30,
        bevel=0.001,
    )
    for side in (-1.0, 1.0):
        cylinder_between(
            f"{name}_standoff_{side:+.0f}",
            (x + side * width * 0.44, y + 0.002, z),
            (x + side * width * 0.44, y - 0.030, z),
            0.008,
            MATERIALS["steel_polished"],
            vertices=24,
            bevel=0.001,
        )


def add_rear_vent_bank(
    prefix: str,
    center: tuple[float, float, float],
    *,
    columns: int,
    rows: int,
    width: float,
    height: float,
) -> None:
    cx, cy, cz = center
    for row in range(rows):
        z = cz + (row - (rows - 1) / 2.0) * height / max(rows - 1, 1)
        for column in range(columns):
            x = cx + (column - (columns - 1) / 2.0) * width / max(columns - 1, 1)
            rounded_box(
                f"{prefix}_{row:02d}_{column:02d}",
                (x, cy, z),
                (0.055, 0.006, 0.010),
                MATERIALS["shadow"],
                bevel=0.003,
            )


def add_outlet_plate(name: str, x: float, y: float, z: float) -> None:
    rounded_box(
        f"{name}_plate",
        (x, y, z),
        (0.115, 0.014, 0.120),
        MATERIALS["powder_light"],
        bevel=0.006,
    )
    for socket_x in (-0.027, 0.027):
        for socket_z in (-0.027, 0.027):
            cylinder_between(
                f"{name}_socket_{socket_x:+.3f}_{socket_z:+.3f}",
                (x + socket_x, y - 0.007, z + socket_z),
                (x + socket_x, y - 0.017, z + socket_z),
                0.008,
                MATERIALS["shadow"],
                vertices=20,
            )
    for fx in (-0.045, 0.045):
        for fz in (-0.046, 0.046):
            front_fastener(f"{name}_screw_{fx:+.2f}_{fz:+.2f}", x + fx, y - 0.010, z + fz, 0.003)


def add_service_valve(
    name: str,
    x: float,
    y: float,
    z: float,
    accent: str,
    *,
    direction: float = -1.0,
) -> None:
    cylinder_between(
        f"{name}_stem",
        (x, y, z),
        (x, y + direction * 0.085, z),
        0.012,
        MATERIALS["brass"],
        vertices=28,
        bevel=0.002,
    )
    cylinder_between(
        f"{name}_spout",
        (x, y + direction * 0.078, z),
        (x, y + direction * 0.078, z - 0.070),
        0.009,
        MATERIALS["steel_polished"],
        vertices=24,
        bevel=0.001,
    )
    torus(
        f"{name}_knob",
        (x, y + direction * 0.040, z + 0.040),
        0.028,
        0.008,
        MATERIALS[accent],
        axis=(0.0, 1.0, 0.0),
        major_segments=32,
        minor_segments=8,
    )
    cylinder_between(
        f"{name}_knob_hub",
        (x, y + direction * 0.029, z + 0.040),
        (x, y + direction * 0.054, z + 0.040),
        0.012,
        MATERIALS["brass"],
        vertices=24,
    )


def add_base_casework(
    prefix: str,
    *,
    width: float,
    depth: float,
    height: float,
    front_y: float,
    rear_y: float,
    door_material: str = "powder",
) -> None:
    powder = MATERIALS[door_material]
    rounded_box(
        f"{prefix}_base_back",
        (0.0, rear_y - 0.020, height * 0.51),
        (width - 0.055, 0.040, height - 0.055),
        MATERIALS["powder_dark"],
        bevel=0.008,
    )
    rounded_box(
        f"{prefix}_base_left_side",
        (-width * 0.5 + 0.025, 0.0, height * 0.51),
        (0.050, depth - 0.055, height - 0.055),
        powder,
        bevel=0.010,
    )
    rounded_box(
        f"{prefix}_base_right_side",
        (width * 0.5 - 0.025, 0.0, height * 0.51),
        (0.050, depth - 0.055, height - 0.055),
        powder,
        bevel=0.010,
    )
    rounded_box(
        f"{prefix}_toe_kick",
        (0.0, front_y + 0.055, 0.095),
        (width - 0.16, 0.115, 0.19),
        MATERIALS["powder_dark"],
        bevel=0.008,
    )
    rounded_box(
        f"{prefix}_cabinet_floor",
        (0.0, 0.02, 0.17),
        (width - 0.11, depth - 0.12, 0.035),
        MATERIALS["interior"],
        bevel=0.005,
    )
    gap = 0.016
    door_width = (width - 0.14 - gap) * 0.5
    for side in (-1.0, 1.0):
        x = side * (door_width * 0.5 + gap * 0.25)
        rounded_box(
            f"{prefix}_{'left' if side < 0 else 'right'}_door",
            (x, front_y - 0.008, height * 0.52),
            (door_width, 0.032, height - 0.25),
            powder,
            bevel=0.010,
        )
        rounded_box(
            f"{prefix}_{'left' if side < 0 else 'right'}_door_seam",
            (x, front_y - 0.026, height * 0.52),
            (door_width - 0.020, 0.004, height - 0.27),
            MATERIALS["shadow"],
            bevel=0.002,
        )
        rounded_box(
            f"{prefix}_{'left' if side < 0 else 'right'}_door_face",
            (x, front_y - 0.030, height * 0.52),
            (door_width - 0.030, 0.007, height - 0.28),
            powder,
            bevel=0.007,
        )
        handle_x = side * 0.085
        add_front_handle(
            f"{prefix}_{'left' if side < 0 else 'right'}_handle",
            handle_x,
            front_y - 0.030,
            height * 0.73,
            0.18,
        )
        for z in (0.25, height - 0.12):
            front_fastener(
                f"{prefix}_{'left' if side < 0 else 'right'}_hinge_{z:.2f}",
                side * (width * 0.5 - 0.105),
                front_y - 0.032,
                z,
            )

    rounded_box(
        f"{prefix}_rear_access_upper",
        (0.0, rear_y + 0.006, height * 0.66),
        (width - 0.17, 0.025, height * 0.40),
        MATERIALS["powder"],
        bevel=0.007,
    )
    rounded_box(
        f"{prefix}_rear_access_lower",
        (0.0, rear_y + 0.008, height * 0.28),
        (width - 0.17, 0.025, height * 0.27),
        MATERIALS["powder"],
        bevel=0.007,
    )
    for x in (-width * 0.5 + 0.12, width * 0.5 - 0.12):
        for z in (0.22, height - 0.10):
            front_fastener(
                f"{prefix}_rear_fastener_{x:+.2f}_{z:.2f}", x, -(rear_y + 0.020), z
            )

    # Four credible adjustable leveling feet visible from every orbit angle.
    for corner, x, y in (
        ("front_left", -width * 0.5 + 0.10, front_y + 0.07),
        ("front_right", width * 0.5 - 0.10, front_y + 0.07),
        ("rear_left", -width * 0.5 + 0.10, rear_y - 0.07),
        ("rear_right", width * 0.5 - 0.10, rear_y - 0.07),
    ):
        cylinder(f"{prefix}_{corner}_stem", (x, y, 0.073), 0.011, 0.075, MATERIALS["steel_polished"], bevel=0.002)
        cylinder(f"{prefix}_{corner}_pad", (x, y, 0.026), 0.042, 0.030, MATERIALS["rubber"], bevel=0.004)


def build_fume_hood() -> None:
    width, depth, _height = ASSETS["fume-hood"]["dimensions"]
    front_y = -depth * 0.5
    rear_y = depth * 0.5
    add_base_casework(
        "fume_hood",
        width=width,
        depth=depth,
        height=0.90,
        front_y=front_y,
        rear_y=rear_y,
    )

    # Chemical-resistant work deck, spill lip, and cup sink.
    rounded_box("Hood worktop", (0.0, 0.0, 0.920), (1.50, 0.85, 0.060), MATERIALS["stainless"], bevel=0.014)
    rounded_box("Hood front spill lip", (0.0, front_y - 0.006, 0.958), (1.48, 0.025, 0.045), MATERIALS["steel_polished"], bevel=0.006)
    rounded_box("Hood work recess", (0.0, 0.02, 0.955), (1.28, 0.62, 0.020), MATERIALS["interior"], bevel=0.012)
    cylinder("Hood cup sink", (0.48, 0.18, 0.963), 0.105, 0.025, MATERIALS["shadow"], vertices=56, bevel=0.004)
    cylinder("Hood cup sink rim", (0.48, 0.18, 0.981), 0.120, 0.016, MATERIALS["steel_polished"], vertices=56, bevel=0.003)
    cylinder("Hood cup sink opening", (0.48, 0.18, 0.991), 0.092, 0.010, MATERIALS["black"], vertices=56)

    # Full chamber shell: solid liners and removable rear baffles.
    rounded_box("Hood left liner", (-0.705, 0.015, 1.515), (0.055, 0.72, 1.13), MATERIALS["interior"], bevel=0.010)
    rounded_box("Hood right liner", (0.705, 0.015, 1.515), (0.055, 0.72, 1.13), MATERIALS["interior"], bevel=0.010)
    rounded_box("Hood chamber ceiling", (0.0, 0.020, 2.050), (1.42, 0.71, 0.060), MATERIALS["interior"], bevel=0.010)
    rounded_box("Hood rear liner", (0.0, 0.365, 1.515), (1.40, 0.045, 1.13), MATERIALS["powder_dark"], bevel=0.008)
    for index, z in enumerate((1.205, 1.515, 1.825)):
        rounded_box(
            f"Hood removable rear baffle {index + 1}",
            (0.0, 0.330, z),
            (1.27, 0.025, 0.285),
            MATERIALS["interior"],
            bevel=0.008,
        )
        for x in (-0.57, -0.38, -0.19, 0.0, 0.19, 0.38, 0.57):
            rounded_box(
                f"Hood baffle slot {index + 1} {x:+.2f}",
                (x, 0.315, z - 0.095),
                (0.115, 0.007, 0.018),
                MATERIALS["shadow"],
                bevel=0.006,
            )
    rounded_box("Hood lower baffle intake", (0.0, 0.305, 1.045), (1.25, 0.010, 0.030), MATERIALS["shadow"], bevel=0.006)

    # Black architectural frame and thick tracked sash.
    for side in (-1.0, 1.0):
        rounded_box(
            f"Hood front frame {'left' if side < 0 else 'right'}",
            (side * 0.720, front_y + 0.018, 1.545),
            (0.060, 0.070, 1.20),
            MATERIALS["powder_dark"],
            bevel=0.010,
        )
        rounded_box(
            f"Hood sash track {'left' if side < 0 else 'right'}",
            (side * 0.665, front_y - 0.010, 1.535),
            (0.025, 0.028, 1.04),
            MATERIALS["aluminum"],
            bevel=0.005,
        )
        for z in (1.08, 1.95):
            side_fastener(
                f"Hood side frame screw {side:+.0f} {z:.2f}",
                side * 0.750,
                -0.15,
                z,
                side,
            )
    rounded_box("Hood sash safety glass", (0.0, front_y - 0.002, 1.545), (1.31, 0.014, 0.96), MATERIALS["glass"], bevel=0.004)
    for x in (-0.650, 0.650):
        rounded_box(f"Hood sash glass edge {x:+.2f}", (x, front_y - 0.010, 1.545), (0.014, 0.020, 0.96), MATERIALS["glass_edge"], bevel=0.003)
    rounded_box("Hood sash lower glass edge", (0.0, front_y - 0.010, 1.072), (1.31, 0.020, 0.018), MATERIALS["glass_edge"], bevel=0.004)
    rounded_box("Hood red sash handle", (0.0, front_y - 0.052, 1.075), (1.32, 0.070, 0.045), MATERIALS["red"], bevel=0.014)
    rounded_box("Hood top front rail", (0.0, front_y + 0.010, 2.055), (1.50, 0.095, 0.110), MATERIALS["powder_dark"], bevel=0.012)

    # Interior lighting, taps, outlets, and service fittings.
    rounded_box("Hood LED housing", (0.0, -0.020, 2.012), (0.92, 0.090, 0.040), MATERIALS["aluminum"], bevel=0.012)
    rounded_box("Hood LED diffuser", (0.0, -0.072, 2.005), (0.86, 0.010, 0.022), MATERIALS["paper"], bevel=0.006)
    add_service_valve("Hood water valve", -0.47, 0.315, 1.090, "blue")
    add_service_valve("Hood gas valve", -0.24, 0.315, 1.090, "amber")
    add_service_valve("Hood vacuum valve", 0.00, 0.315, 1.090, "red")
    add_outlet_plate("Hood duplex outlet", 0.43, 0.305, 1.22)

    # Large black service plenum, front controls, and top exhaust collar.
    rounded_box("Hood upper plenum", (0.0, 0.015, 2.225), (1.50, 0.82, 0.35), MATERIALS["powder_dark"], bevel=0.018)
    rounded_box("Hood upper fascia inset", (0.0, front_y - 0.006, 2.225), (1.37, 0.028, 0.250), MATERIALS["black"], bevel=0.012)
    text_mesh("Hood fascia title", "FUME HOOD", (-0.43, front_y - 0.023, 2.245), 0.050, MATERIALS["paper"])
    rounded_box("Hood controller bezel", (0.50, front_y - 0.025, 2.225), (0.285, 0.040, 0.160), MATERIALS["black"], bevel=0.014)
    rounded_box("Hood controller display", (0.475, front_y - 0.048, 2.250), (0.165, 0.009, 0.065), MATERIALS["screen"], bevel=0.007)
    for line, width_pixels in enumerate((0.125, 0.092, 0.112)):
        rounded_box(f"Hood display line {line}", (0.475, front_y - 0.054, 2.268 - line * 0.018), (width_pixels, 0.003, 0.005), MATERIALS["display"], bevel=0.001)
    for x, material in ((0.405, "green"), (0.475, "amber"), (0.545, "red")):
        cylinder_between(
            f"Hood control button {material}",
            (x, front_y - 0.046, 2.183),
            (x, front_y - 0.065, 2.183),
            0.018,
            MATERIALS[material],
            vertices=32,
            bevel=0.003,
        )
    cylinder("Hood exhaust collar", (0.0, 0.145, 2.445), 0.170, 0.220, MATERIALS["aluminum"], vertices=64, bevel=0.008)
    torus("Hood exhaust collar rim", (0.0, 0.145, 2.555), 0.170, 0.012, MATERIALS["steel_polished"], major_segments=64, minor_segments=12)

    # Detailed serviceable rear and sides, including junction box and cabling.
    rounded_box("Hood rear plenum panel", (0.0, rear_y + 0.004, 2.225), (1.34, 0.030, 0.275), MATERIALS["powder"], bevel=0.009)
    add_rear_vent_bank("Hood rear plenum vent", (0.0, rear_y + 0.022, 2.235), columns=9, rows=3, width=0.78, height=0.095)
    rounded_box("Hood rear junction box", (0.47, rear_y + 0.045, 1.80), (0.31, 0.090, 0.32), MATERIALS["powder_dark"], bevel=0.012)
    rounded_box("Hood rear junction cover", (0.47, rear_y + 0.096, 1.80), (0.25, 0.018, 0.25), MATERIALS["powder"], bevel=0.007)
    add_rear_vent_bank("Hood base rear vent", (0.0, rear_y + 0.025, 0.52), columns=8, rows=3, width=0.70, height=0.09)
    curve_tube("Hood rear power cable", [(0.57, rear_y + 0.09, 1.73), (0.70, rear_y + 0.10, 1.20), (0.68, rear_y + 0.11, 0.42), (0.58, rear_y + 0.13, 0.12)], 0.012, MATERIALS["rubber"])
    rounded_box("Hood rear plug", (0.58, rear_y + 0.135, 0.12), (0.070, 0.040, 0.105), MATERIALS["black"], bevel=0.010)
    for side in (-1.0, 1.0):
        rounded_box(
            f"Hood side plenum access {'left' if side < 0 else 'right'}",
            (side * 0.752, 0.05, 2.225),
            (0.025, 0.62, 0.260),
            MATERIALS["powder_dark"],
            bevel=0.007,
        )
        for y in (-0.22, 0.26):
            for z in (2.14, 2.31):
                side_fastener(
                    f"Hood side plenum fastener {side:+.0f} {y:+.2f} {z:.2f}",
                    side * 0.760,
                    y,
                    z,
                    side,
                )


def add_bsc_service_port(name: str, side: float, y: float, z: float) -> None:
    x = side * 0.723
    cylinder_between(
        f"{name}_plug",
        (x - side * 0.012, y, z),
        (x + side * 0.018, y, z),
        0.055,
        MATERIALS["black"],
        vertices=48,
        bevel=0.004,
    )
    torus(
        f"{name}_rim",
        (x + side * 0.020, y, z),
        0.060,
        0.008,
        MATERIALS["aluminum"],
        axis=(1.0, 0.0, 0.0),
        major_segments=48,
        minor_segments=10,
    )


def add_bsc_intake_grille() -> None:
    rounded_box("BSC front intake rail", (0.0, -0.375, 0.935), (1.34, 0.085, 0.045), MATERIALS["stainless"], bevel=0.008)
    for index in range(36):
        x = -0.625 + index * (1.25 / 35)
        rounded_box(
            f"BSC intake slot {index:02d}",
            (x, -0.422, 0.941),
            (0.018, 0.012, 0.016),
            MATERIALS["shadow"],
            bevel=0.007,
        )


def build_biosafety_cabinet() -> None:
    width, depth, _height = ASSETS["biosafety-cabinet"]["dimensions"]
    front_y = -depth * 0.5
    rear_y = depth * 0.5
    add_base_casework(
        "bsc",
        width=width,
        depth=depth,
        height=0.86,
        front_y=front_y,
        rear_y=rear_y,
        door_material="powder_light",
    )

    # Worktray, intake, and lower chamber sill.
    rounded_box("BSC casework top", (0.0, 0.0, 0.875), (1.50, 0.80, 0.055), MATERIALS["powder_light"], bevel=0.015)
    rounded_box("BSC removable worktray", (0.0, 0.005, 0.917), (1.30, 0.62, 0.040), MATERIALS["stainless"], bevel=0.010)
    for seam_x in (-0.43, 0.0, 0.43):
        rounded_box(f"BSC worktray seam {seam_x:+.2f}", (seam_x, 0.005, 0.940), (0.006, 0.58, 0.004), MATERIALS["shadow"], bevel=0.001)
    add_bsc_intake_grille()

    # Chamber shell, stainless baffle, and recessed side safety glass.
    rounded_box("BSC rear structural shell", (0.0, 0.355, 1.430), (1.43, 0.070, 1.08), MATERIALS["powder_light"], bevel=0.012)
    rounded_box("BSC stainless rear liner", (0.0, 0.300, 1.390), (1.31, 0.035, 0.82), MATERIALS["stainless"], bevel=0.010)
    rounded_box("BSC rear baffle", (0.0, 0.272, 1.390), (1.20, 0.025, 0.71), MATERIALS["interior"], bevel=0.009)
    for row, z in enumerate((1.085, 1.315, 1.545, 1.690)):
        for column, x in enumerate((-0.52, -0.35, -0.18, 0.0, 0.18, 0.35, 0.52)):
            rounded_box(
                f"BSC baffle slot {row:02d} {column:02d}",
                (x, 0.257, z),
                (0.105, 0.007, 0.016),
                MATERIALS["shadow"],
                bevel=0.005,
            )
    rounded_box("BSC chamber ceiling", (0.0, 0.005, 1.785), (1.35, 0.67, 0.060), MATERIALS["stainless"], bevel=0.010)
    for side in (-1.0, 1.0):
        x = side * 0.705
        rounded_box(
            f"BSC side frame {'left' if side < 0 else 'right'}",
            (x, 0.0, 1.390),
            (0.065, 0.72, 0.99),
            MATERIALS["powder_light"],
            bevel=0.012,
        )
        rounded_box(
            f"BSC side safety glass {'left' if side < 0 else 'right'}",
            (side * 0.719, -0.005, 1.410),
            (0.014, 0.50, 0.64),
            MATERIALS["glass"],
            bevel=0.004,
        )
        for y in (-0.245, 0.235):
            rounded_box(
                f"BSC side glass edge {side:+.0f} {y:+.2f}",
                (side * 0.726, y, 1.410),
                (0.018, 0.018, 0.66),
                MATERIALS["glass_edge"],
                bevel=0.003,
            )
        add_bsc_service_port(f"BSC smart port {side:+.0f}", side, 0.245, 1.270)

    # Front sash leaves a true 250 mm working aperture over the intake grille.
    rounded_box("BSC front sash safety glass", (0.0, front_y - 0.002, 1.485), (1.30, 0.014, 0.66), MATERIALS["glass"], bevel=0.004)
    for x in (-0.645, 0.645):
        rounded_box(f"BSC front sash edge {x:+.2f}", (x, front_y - 0.010, 1.485), (0.015, 0.020, 0.66), MATERIALS["glass_edge"], bevel=0.003)
    rounded_box("BSC sash lower rail", (0.0, front_y - 0.050, 1.160), (1.34, 0.075, 0.050), MATERIALS["aluminum"], bevel=0.014)
    cylinder_between("BSC sash hand rail", (-0.50, front_y - 0.100, 1.158), (0.50, front_y - 0.100, 1.158), 0.017, MATERIALS["black"], vertices=36, bevel=0.002)
    rounded_box("BSC sash upper rail", (0.0, front_y - 0.012, 1.812), (1.38, 0.060, 0.065), MATERIALS["powder_light"], bevel=0.012)

    # Interior utilities, GFI-style outlets, UV tube, and task illumination.
    add_service_valve("BSC vacuum valve", -0.52, 0.260, 1.050, "red")
    add_service_valve("BSC gas valve", 0.52, 0.260, 1.050, "amber")
    add_outlet_plate("BSC left outlet", -0.46, 0.260, 1.300)
    add_outlet_plate("BSC right outlet", 0.46, 0.260, 1.300)
    cylinder_between("BSC LED tube", (-0.50, -0.01, 1.742), (0.50, -0.01, 1.742), 0.020, MATERIALS["paper"], vertices=32, bevel=0.002)
    cylinder_between("BSC UV tube", (-0.48, 0.240, 1.655), (0.48, 0.240, 1.655), 0.013, MATERIALS["glass"], vertices=30, bevel=0.001)
    for x in (-0.53, 0.53):
        rounded_box(f"BSC UV tube socket {x:+.2f}", (x, 0.240, 1.655), (0.055, 0.045, 0.060), MATERIALS["black"], bevel=0.008)

    # Front filter/plenum housing and a legible seated-height controller.
    rounded_box("BSC upper filter housing", (0.0, 0.005, 2.005), (1.50, 0.78, 0.39), MATERIALS["powder_light"], bevel=0.020)
    rounded_box("BSC front control brow", (0.0, front_y - 0.010, 1.990), (1.43, 0.090, 0.275), MATERIALS["powder"], bevel=0.018)
    rounded_box("BSC blue identity bar", (-0.45, front_y - 0.061, 2.045), (0.36, 0.025, 0.055), MATERIALS["blue"], bevel=0.010)
    text_mesh("BSC identity text", "CLASS II  A2", (-0.45, front_y - 0.077, 2.045), 0.030, MATERIALS["paper"])
    rounded_box("BSC controller bezel", (0.31, front_y - 0.058, 2.015), (0.44, 0.035, 0.160), MATERIALS["black"], bevel=0.016)
    rounded_box("BSC controller screen", (0.255, front_y - 0.080, 2.035), (0.225, 0.008, 0.075), MATERIALS["screen"], bevel=0.008)
    for line, width_pixels in enumerate((0.180, 0.130, 0.160)):
        rounded_box(f"BSC display line {line}", (0.255, front_y - 0.086, 2.056 - line * 0.021), (width_pixels, 0.003, 0.005), MATERIALS["display"], bevel=0.001)
    for index, (x, material) in enumerate(((0.420, "green"), (0.475, "amber"), (0.530, "red"))):
        cylinder_between(
            f"BSC control key {index}",
            (x, front_y - 0.072, 1.985),
            (x, front_y - 0.092, 1.985),
            0.014,
            MATERIALS[material],
            vertices=28,
            bevel=0.003,
        )

    # Top exhaust grille/collar and rear fan-service anatomy.
    rounded_box("BSC top cap", (0.0, 0.0, 2.210), (1.50, 0.80, 0.080), MATERIALS["powder_light"], bevel=0.016)
    for row in range(5):
        for column in range(13):
            rounded_box(
                f"BSC top exhaust slot {row:02d} {column:02d}",
                (-0.48 + column * 0.08, -0.02 + row * 0.045, 2.254),
                (0.052, 0.022, 0.006),
                MATERIALS["shadow"],
                bevel=0.008,
            )
    cylinder("BSC optional exhaust collar", (0.0, 0.175, 2.278), 0.135, 0.115, MATERIALS["aluminum"], vertices=64, bevel=0.006)
    torus("BSC optional exhaust rim", (0.0, 0.175, 2.336), 0.135, 0.010, MATERIALS["steel_polished"], major_segments=64, minor_segments=10)
    rounded_box("BSC rear upper service panel", (0.0, rear_y + 0.002, 1.985), (1.34, 0.032, 0.36), MATERIALS["powder"], bevel=0.010)
    add_rear_vent_bank("BSC rear fan vent", (0.0, rear_y + 0.022, 2.005), columns=11, rows=4, width=0.90, height=0.14)
    rounded_box("BSC rear electrical panel", (0.46, rear_y + 0.040, 1.465), (0.30, 0.085, 0.34), MATERIALS["powder_dark"], bevel=0.012)
    rounded_box("BSC rear electrical cover", (0.46, rear_y + 0.089, 1.465), (0.24, 0.018, 0.27), MATERIALS["powder"], bevel=0.007)
    curve_tube("BSC rear power cable", [(0.55, rear_y + 0.085, 1.37), (0.68, rear_y + 0.10, 1.06), (0.65, rear_y + 0.11, 0.46), (0.56, rear_y + 0.13, 0.13)], 0.012, MATERIALS["rubber"])
    rounded_box("BSC rear plug", (0.56, rear_y + 0.135, 0.13), (0.070, 0.042, 0.105), MATERIALS["black"], bevel=0.010)
    add_rear_vent_bank("BSC base rear vent", (0.0, rear_y + 0.025, 0.51), columns=8, rows=3, width=0.70, height=0.09)

    # Service-panel seams and fasteners on both exterior sides.
    for side in (-1.0, 1.0):
        rounded_box(
            f"BSC side upper service panel {side:+.0f}",
            (side * 0.752, 0.055, 2.000),
            (0.025, 0.55, 0.29),
            MATERIALS["powder"],
            bevel=0.007,
        )
        for y in (-0.20, 0.28):
            for z in (1.90, 2.10):
                side_fastener(
                    f"BSC side service screw {side:+.0f} {y:+.2f} {z:.2f}",
                    side * 0.760,
                    y,
                    z,
                    side,
                )


def apply_modifiers() -> None:
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH" or not obj.modifiers:
            continue
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        for modifier in list(obj.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=modifier.name)
            except RuntimeError:
                pass
        obj.select_set(False)
    bpy.context.view_layer.update()


def consolidate_static_meshes_by_material() -> None:
    """Collapse authored static parts to one runtime mesh per PBR material."""
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    grouped: dict[str, list[bpy.types.Object]] = {}
    for obj in meshes:
        material = obj.data.materials[0] if obj.data.materials else None
        key = material.name if material is not None else "Unmaterialed"
        grouped.setdefault(key, []).append(obj)
    for material_name, objects in grouped.items():
        bpy.ops.object.select_all(action="DESELECT")
        active = objects[0]
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = active
        if len(objects) > 1:
            bpy.ops.object.join()
        safe_name = "".join(character if character.isalnum() else "_" for character in material_name)
        active.name = f"Runtime_{safe_name}"
        active.data.name = f"Runtime_{safe_name}_mesh"
        active.select_set(False)
    bpy.context.view_layer.objects.active = None
    bpy.context.view_layer.update()


def mesh_bounds() -> tuple[Vector, Vector]:
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = Vector(tuple(min(point[index] for point in points) for index in range(3)))
    maximum = Vector(tuple(max(point[index] for point in points) for index in range(3)))
    return minimum, maximum


def fit_to_dimensions(target: tuple[float, float, float]) -> dict[str, list[float]]:
    assert ROOT is not None
    apply_modifiers()
    consolidate_static_meshes_by_material()
    minimum, maximum = mesh_bounds()
    dimensions = maximum - minimum
    ROOT.scale = tuple(target[index] / dimensions[index] for index in range(3))
    bpy.context.view_layer.update()
    minimum, maximum = mesh_bounds()
    ROOT.location += Vector((-(minimum.x + maximum.x) * 0.5, -(minimum.y + maximum.y) * 0.5, -minimum.z))
    bpy.context.view_layer.update()
    minimum, maximum = mesh_bounds()
    dimensions = maximum - minimum
    return {
        "min": [round(value, 6) for value in minimum],
        "max": [round(value, 6) for value in maximum],
        "dimensions": [round(value, 6) for value in dimensions],
    }


def triangle_count(mesh: bpy.types.Mesh) -> int:
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def scene_report(asset_id: str, path: Path | None = None) -> dict[str, object]:
    minimum, maximum = mesh_bounds()
    dimensions = maximum - minimum
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    materials = {
        slot.material.name
        for obj in meshes
        for slot in obj.material_slots
        if slot.material is not None
    }
    report: dict[str, object] = {
        "asset": asset_id,
        "mesh_objects": len(meshes),
        "materials": len(materials),
        "cameras": len([obj for obj in bpy.context.scene.objects if obj.type == "CAMERA"]),
        "lights": len([obj for obj in bpy.context.scene.objects if obj.type == "LIGHT"]),
        "vertices": sum(len(obj.data.vertices) for obj in meshes),
        "triangles": sum(triangle_count(obj.data) for obj in meshes),
        "bounds_m": {
            "min": [round(value, 6) for value in minimum],
            "max": [round(value, 6) for value in maximum],
            "dimensions": [round(value, 6) for value in dimensions],
        },
    }
    if path is not None:
        report["file"] = str(path.resolve())
        report["bytes"] = path.stat().st_size
    return report


def validate_report(asset_id: str, report: dict[str, object], *, imported: bool) -> None:
    target = Vector(ASSETS[asset_id]["dimensions"])
    dimensions = Vector(report["bounds_m"]["dimensions"])
    minimum = Vector(report["bounds_m"]["min"])
    tolerance = 0.008 if imported else 0.002
    errors: list[str] = []
    for axis, actual, expected in zip("xyz", dimensions, target):
        if abs(actual - expected) > tolerance:
            errors.append(f"{axis} dimension {actual:.4f} m != {expected:.4f} m")
    if abs(minimum.z) > tolerance:
        errors.append(f"minimum z {minimum.z:.5f} m is not grounded")
    mesh_objects = int(report["mesh_objects"])
    triangles = int(report["triangles"])
    if not 12 <= mesh_objects <= 25:
        errors.append(f"runtime mesh count {mesh_objects} is outside 12-25")
    if int(report["materials"]) < 12:
        errors.append(f"only {report['materials']} materials")
    if triangles < 15_000:
        errors.append(f"only {triangles} triangles")
    if triangles > 180_000:
        errors.append(f"triangle count {triangles} exceeds 180000")
    if int(report["cameras"]) or int(report["lights"]):
        errors.append("asset contains a camera or light")
    if imported:
        size = int(report.get("bytes", 0))
        if size < 100_000:
            errors.append(f"GLB is unexpectedly small ({size} bytes)")
        if size > 12 * 1024 * 1024:
            errors.append(f"GLB exceeds 12 MB ({size} bytes)")
    if errors:
        stage = "imported GLB" if imported else "authored scene"
        raise RuntimeError(f"{asset_id} {stage} validation failed: {'; '.join(errors)}")


def export_glb(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    result = bpy.ops.export_scene.gltf(
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
        export_draco_mesh_compression_enable=False,
        export_loglevel=-1,
    )
    if "FINISHED" not in result:
        raise RuntimeError(f"GLB export failed: {result}")


def render_imported_preview(asset_id: str, preview_dir: Path) -> list[str]:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.050, 0.060, 0.075)

    # QA-only floor, camera, and lights are created after export/re-import.
    qa_floor = make_material("QA charcoal studio floor", (0.12, 0.14, 0.16, 1.0), roughness=0.64)
    rounded_box("QA floor", (0.0, 0.0, -0.035), (5.0, 5.0, 0.060), qa_floor, bevel=0.012)
    height = ASSETS[asset_id]["dimensions"][2]
    target = Vector((0.0, 0.0, height * 0.50))
    bpy.ops.object.camera_add(location=(2.65, -3.25, height * 0.82))
    camera = bpy.context.object
    camera.name = "QA camera"
    camera.data.lens = 58
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    for name, location, energy, size, color in (
        ("QA key", (-2.3, -2.7, 3.5), 1250.0, 2.4, (1.0, 0.92, 0.83)),
        ("QA fill", (2.7, -0.6, 2.6), 820.0, 2.0, (0.75, 0.86, 1.0)),
        ("QA rim", (-0.5, 2.5, 3.2), 1120.0, 1.6, (0.70, 0.82, 1.0)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        light.rotation_euler = (target - light.location).to_track_quat("-Z", "Y").to_euler()

    preview_dir.mkdir(parents=True, exist_ok=True)
    outputs: list[str] = []
    for view, location in (
        ("front", (2.65, -3.25, height * 0.82)),
        ("rear", (-2.65, 3.25, height * 0.80)),
    ):
        camera.location = location
        camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
        output = (preview_dir / f"{asset_id}-{view}-qa.png").resolve()
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        outputs.append(str(output))
    return outputs


def inspect_export(asset_id: str, path: Path, preview_dir: Path | None) -> dict[str, object]:
    reset_scene(asset_id)
    result = bpy.ops.import_scene.gltf(filepath=str(path.resolve()))
    if "FINISHED" not in result:
        raise RuntimeError(f"Could not import generated GLB: {path}")
    bpy.context.view_layer.update()
    report = scene_report(asset_id, path)
    validate_report(asset_id, report, imported=True)
    if preview_dir is not None:
        report["previews"] = render_imported_preview(asset_id, preview_dir)
    return report


def build_one(
    asset_id: str,
    output_dir: Path,
    preview_dir: Path | None,
    save_blend_dir: Path | None,
) -> dict[str, object]:
    reset_scene(asset_id)
    build_materials()
    create_root(asset_id)
    if asset_id == "fume-hood":
        build_fume_hood()
    else:
        build_biosafety_cabinet()
    fit_to_dimensions(ASSETS[asset_id]["dimensions"])
    authored_report = scene_report(asset_id)
    validate_report(asset_id, authored_report, imported=False)
    if save_blend_dir is not None:
        save_blend_dir.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str((save_blend_dir / f"{asset_id}.blend").resolve()))
    output_path = output_dir / ASSETS[asset_id]["filename"]
    export_glb(output_path)
    report = inspect_export(asset_id, output_path, preview_dir)
    print("LABSPACE_HOOD_GLTF_INSPECT " + json.dumps(report, sort_keys=True))
    return report


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    preview_dir = Path(args.preview_dir) if args.preview_dir else None
    save_blend_dir = Path(args.save_blend_dir) if args.save_blend_dir else None
    selected = tuple(ASSETS) if args.asset == "all" else (args.asset,)
    reports = [
        build_one(asset_id, output_dir, preview_dir, save_blend_dir)
        for asset_id in selected
    ]
    print("LABSPACE_HOODS_COMPLETE " + json.dumps(reports, sort_keys=True))


if __name__ == "__main__":
    main()
