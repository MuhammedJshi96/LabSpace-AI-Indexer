"""Build the LabSpace Buchi R-300-class rotary evaporator hero asset.

Run with Blender 4.5 LTS in background mode.  The model is intentionally
procedural and deterministic so it can be regenerated in CI or by a designer
without opening the Blender UI.

Example:
    blender --background --factory-startup \
      --python scripts/blender/build_rotary_evaporator.py -- \
      --output public/models/hero/rotary-evaporator.glb
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector


TAU = math.tau
ROOT: bpy.types.Object | None = None
MATERIALS: dict[str, bpy.types.Material] = {}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        default="public/models/hero/rotary-evaporator.glb",
        help="Output GLB path, relative to the current working directory.",
    )
    parser.add_argument(
        "--save-blend",
        default="",
        help="Optional path for an editable .blend snapshot.",
    )
    parser.add_argument(
        "--draco",
        action="store_true",
        help="Opt in to Draco compression. The LabSpace runtime uses plain GLB by default.",
    )
    return parser.parse_args(argv)


def reset_scene() -> None:
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

    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.world.color = (0.025, 0.03, 0.04)
    scene["asset_id"] = "rotary-evaporator"
    scene["authoring_units"] = "meters"
    scene["design_reference"] = (
        "Supplied Buchi Rotavapor R-300 product references and official R-300 "
        "vertical-condenser construction; original logo-free planning model"
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
    roughness: float = 0.35,
    transmission: float = 0.0,
    ior: float = 1.45,
    coat: float = 0.0,
    coat_roughness: float = 0.16,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
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
        except (AttributeError, TypeError):
            pass
        try:
            material.use_transparency_overlap = False
        except AttributeError:
            pass
        material.use_screen_refraction = True

    material["pbr_role"] = name
    return material


def build_materials() -> None:
    global MATERIALS
    MATERIALS = {
        "powder_white": make_material(
            "Powder-coated warm white",
            (0.83, 0.85, 0.83, 1.0),
            roughness=0.27,
            coat=0.12,
        ),
        "powder_shadow": make_material(
            "Powder-coated shadow gray",
            (0.23, 0.27, 0.28, 1.0),
            metallic=0.05,
            roughness=0.31,
        ),
        "aluminum": make_material(
            "Satin anodized aluminum",
            (0.55, 0.59, 0.61, 1.0),
            metallic=0.88,
            roughness=0.23,
            anisotropy=0.35,
        ),
        "stainless": make_material(
            "Brushed stainless steel",
            (0.62, 0.66, 0.68, 1.0),
            metallic=0.96,
            roughness=0.19,
            anisotropy=0.72,
        ),
        "black": make_material(
            "Soft-touch black polymer",
            (0.018, 0.024, 0.028, 1.0),
            roughness=0.34,
            coat=0.08,
        ),
        "rubber": make_material(
            "Black EPDM rubber",
            (0.012, 0.014, 0.015, 1.0),
            roughness=0.76,
        ),
        "blue": make_material(
            "LabSpace blue control accent",
            (0.025, 0.24, 0.54, 1.0),
            roughness=0.25,
            coat=0.28,
        ),
        "red": make_material(
            "Safety red control accent",
            (0.64, 0.035, 0.025, 1.0),
            roughness=0.28,
            coat=0.2,
        ),
        "green": make_material(
            "Status green",
            (0.025, 0.58, 0.19, 1.0),
            roughness=0.22,
            emission=(0.02, 0.45, 0.12, 1.0),
            emission_strength=1.4,
        ),
        "screen": make_material(
            "Controller glass display",
            (0.008, 0.026, 0.032, 1.0),
            roughness=0.11,
            coat=0.44,
        ),
        "display": make_material(
            "Cyan display segments",
            (0.018, 0.62, 0.78, 1.0),
            roughness=0.16,
            emission=(0.01, 0.55, 0.78, 1.0),
            emission_strength=3.0,
        ),
        "glass": make_material(
            "Borosilicate glass",
            (0.73, 0.93, 0.96, 0.27),
            roughness=0.055,
            transmission=0.94,
            ior=1.474,
            coat=0.18,
            coat_roughness=0.04,
        ),
        "ground_glass": make_material(
            "Ground glass joint",
            (0.70, 0.86, 0.88, 0.46),
            roughness=0.22,
            transmission=0.72,
            ior=1.474,
        ),
        "water": make_material(
            "Bath water",
            (0.04, 0.42, 0.52, 0.38),
            roughness=0.075,
            transmission=0.83,
            ior=1.333,
        ),
        "solvent": make_material(
            "Reference blue solvent",
            (0.015, 0.38, 0.92, 0.70),
            roughness=0.08,
            transmission=0.48,
            ior=1.37,
        ),
        "clear_hose": make_material(
            "Clear silicone hose",
            (0.82, 0.90, 0.86, 0.49),
            roughness=0.22,
            transmission=0.61,
            ior=1.41,
        ),
        "blue_hose": make_material(
            "Translucent coolant hose",
            (0.04, 0.30, 0.58, 0.67),
            roughness=0.2,
            transmission=0.34,
            ior=1.42,
        ),
        "label": make_material(
            "Printed graphite label",
            (0.055, 0.065, 0.07, 1.0),
            roughness=0.48,
        ),
    }


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


def add_rounded_box(
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
        modifier.width = min(bevel, min(dimensions) * 0.24)
        modifier.segments = 3
        modifier.limit_method = "ANGLE"
        modifier.harden_normals = True
    return parent_to_root(obj)


def add_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    material: bpy.types.Material,
    *,
    vertices: int = 48,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    bevel: float = 0.0,
    smooth_shading: bool = True,
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
    if smooth_shading:
        smooth(obj)
    if bevel > 0.0:
        modifier = obj.modifiers.new(name="Rounded cylinder edge", type="BEVEL")
        modifier.width = min(bevel, depth * 0.2, radius * 0.3)
        modifier.segments = 2
        modifier.harden_normals = True
    return parent_to_root(obj)


def add_cylinder_between(
    name: str,
    start: tuple[float, float, float] | Vector,
    end: tuple[float, float, float] | Vector,
    radius: float,
    material: bpy.types.Material,
    *,
    vertices: int = 40,
    bevel: float = 0.0,
) -> bpy.types.Object:
    start_v = Vector(start)
    end_v = Vector(end)
    direction = end_v - start_v
    obj = add_cylinder(
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


def add_torus(
    name: str,
    location: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    material: bpy.types.Material,
    *,
    axis: tuple[float, float, float] = (0.0, 0.0, 1.0),
    major_segments: int = 56,
    minor_segments: int = 12,
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


def add_uv_sphere(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=48,
        ring_count=24,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign_material(obj, material)
    smooth(obj)
    return parent_to_root(obj)


def add_curve_tube(
    name: str,
    points: list[tuple[float, float, float] | Vector],
    radius: float,
    material: bpy.types.Material,
    *,
    bevel_resolution: int = 3,
    resolution: int = 3,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(name=f"{name}_curve", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = resolution
    curve.bevel_depth = radius
    curve.bevel_resolution = bevel_resolution
    curve.resolution_u = resolution
    curve.twist_smooth = 8

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
    return obj


def add_poly_tube(
    name: str,
    points: list[tuple[float, float, float] | Vector],
    radius: float,
    material: bpy.types.Material,
    *,
    bevel_resolution: int = 2,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(name=f"{name}_curve", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 1
    curve.bevel_depth = radius
    curve.bevel_resolution = bevel_resolution
    spline = curve.splines.new(type="POLY")
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points):
        coordinate = Vector(coordinate)
        point.co = (coordinate.x, coordinate.y, coordinate.z, 1.0)

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
    return obj


def add_revolved_profile(
    name: str,
    location: tuple[float, float, float],
    profile: list[tuple[float, float]],
    material: bpy.types.Material,
    *,
    axis: tuple[float, float, float] = (0.0, 0.0, 1.0),
    segments: int = 64,
) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    ring_count = len(profile)
    for segment in range(segments):
        angle = TAU * segment / segments
        cos_angle = math.cos(angle)
        sin_angle = math.sin(angle)
        for radius, height in profile:
            vertices.append((radius * cos_angle, radius * sin_angle, height))

    for segment in range(segments):
        next_segment = (segment + 1) % segments
        for ring in range(ring_count - 1):
            a = segment * ring_count + ring
            b = next_segment * ring_count + ring
            c = next_segment * ring_count + ring + 1
            d = segment * ring_count + ring + 1
            faces.append((a, b, c, d))

    mesh = bpy.data.meshes.new(name=f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0.0, 0.0, 1.0)).rotation_difference(
        Vector(axis).normalized()
    )
    assign_material(obj, material)
    smooth(obj)
    return parent_to_root(obj)


def add_text(
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
    curve.extrude = 0.00045
    curve.bevel_depth = 0.00012
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
    return obj


def add_fastener(
    name: str,
    location: tuple[float, float, float],
    *,
    axis: tuple[float, float, float] = (0.0, -1.0, 0.0),
) -> None:
    start = Vector(location)
    end = start + Vector(axis).normalized() * 0.003
    add_cylinder_between(
        name,
        start,
        end,
        0.0042,
        MATERIALS["stainless"],
        vertices=20,
        bevel=0.0005,
    )


def build_base_and_controls() -> None:
    """Build the compact two-rail chassis used by the modern reference system."""

    powder = MATERIALS["powder_white"]
    shadow = MATERIALS["powder_shadow"]
    black = MATERIALS["black"]
    stainless = MATERIALS["stainless"]
    rubber = MATERIALS["rubber"]

    # The reference has a light, open chassis rather than the previous single
    # appliance-sized slab.  Twin front-to-back rails keep the bath and lift
    # visually independent while a rear bridge carries power and services.
    for index, x in enumerate((-0.205, 0.205), 1):
        add_rounded_box(
            f"Base longitudinal rail {index}",
            (x, 0.005, 0.047),
            (0.120, 0.365, 0.070),
            powder,
            bevel=0.018,
        )
    add_rounded_box(
        "Base rear structural bridge",
        (0.0, 0.142, 0.062),
        (0.480, 0.090, 0.100),
        powder,
        bevel=0.018,
    )
    add_rounded_box(
        "Base service spine",
        (-0.050, 0.126, 0.124),
        (0.210, 0.105, 0.070),
        shadow,
        bevel=0.014,
    )
    add_rounded_box(
        "Rear electronics service cover",
        (-0.050, 0.183, 0.126),
        (0.185, 0.012, 0.050),
        shadow,
        bevel=0.004,
    )

    # Four height-adjustable isolation feet, visible from every low orbit.
    for index, (x, y) in enumerate(
        ((-0.205, -0.145), (0.205, -0.145), (-0.205, 0.145), (0.205, 0.145))
    ):
        add_cylinder(
            f"Rubber isolation foot {index + 1}",
            (x, y, 0.013),
            0.026,
            0.026,
            rubber,
            vertices=40,
            bevel=0.004,
        )
        add_cylinder(
            f"Foot steel washer {index + 1}",
            (x, y, 0.029),
            0.021,
            0.006,
            stainless,
            vertices=40,
            bevel=0.001,
        )

    # Rear construction details keep the authored object credible from behind.
    for index in range(8):
        add_rounded_box(
            f"Rear ventilation slot {index + 1}",
            (-0.124 + index * 0.021, 0.190, 0.131),
            (0.012, 0.004, 0.028),
            black,
            bevel=0.002,
        )
    add_rounded_box(
        "Rear IEC power inlet",
        (0.066, 0.190, 0.108),
        (0.038, 0.008, 0.031),
        black,
        bevel=0.003,
    )
    add_curve_tube(
        "Rear mains cable",
        [
            (0.066, 0.196, 0.108),
            (0.130, 0.222, 0.084),
            (0.205, 0.220, 0.045),
            (0.257, 0.185, 0.018),
        ],
        0.006,
        rubber,
        bevel_resolution=3,
    )
    add_rounded_box(
        "Mains plug body",
        (0.268, 0.173, 0.021),
        (0.026, 0.035, 0.024),
        black,
        bevel=0.004,
        rotation=(0.0, 0.0, math.radians(7.0)),
    )
    for x in (-0.205, 0.205):
        for z in (0.050, 0.082):
            add_fastener(
                f"Front chassis screw {x:+.3f} {z:.3f}",
                (x, -0.179, z),
            )


def build_touch_controller() -> None:
    """Add the left-side I-300-Pro-class touch interface and real rear housing."""

    rotation = (-math.radians(8.0), 0.0, math.radians(-3.0))
    add_rounded_box(
        "Touch controller rear housing",
        (-0.205, -0.166, 0.365),
        (0.155, 0.050, 0.246),
        MATERIALS["powder_white"],
        bevel=0.016,
        rotation=rotation,
    )
    add_rounded_box(
        "Touch controller front bezel",
        (-0.205, -0.197, 0.368),
        (0.141, 0.016, 0.225),
        MATERIALS["powder_shadow"],
        bevel=0.013,
        rotation=rotation,
    )
    add_rounded_box(
        "Touch controller display glass",
        (-0.205, -0.208, 0.393),
        (0.122, 0.006, 0.148),
        MATERIALS["screen"],
        bevel=0.008,
        rotation=rotation,
    )
    # A deliberately abstract process UI: readable as a modern control screen
    # without reproducing a trademarked manufacturer interface.
    for row, width in enumerate((0.096, 0.082, 0.104, 0.068)):
        add_rounded_box(
            f"Touch controller cyan data row {row + 1}",
            (-0.212, -0.213 - row * 0.0004, 0.433 - row * 0.028),
            (width, 0.003, 0.007),
            MATERIALS["display"],
            bevel=0.002,
            rotation=rotation,
        )
    add_text(
        "Touch controller operating label",
        "RPM   C   mbar   AUTO",
        (-0.258, -0.215, 0.459),
        0.009,
        MATERIALS["display"],
        rotation=(math.radians(98.0), 0.0, math.radians(-3.0)),
    )
    add_cylinder_between(
        "Touch controller rotary encoder",
        (-0.241, -0.206, 0.278),
        (-0.241, -0.225, 0.278),
        0.020,
        MATERIALS["aluminum"],
        vertices=40,
        bevel=0.003,
    )
    for index, (x, material) in enumerate(
        ((-0.188, MATERIALS["green"]), (-0.151, MATERIALS["red"])), 1
    ):
        add_cylinder_between(
            f"Touch controller action key {index}",
            (x, -0.205, 0.278),
            (x, -0.222, 0.278),
            0.011,
            material,
            vertices=32,
            bevel=0.002,
        )
    add_rounded_box(
        "Touch controller cantilever bracket",
        (-0.123, -0.094, 0.327),
        (0.046, 0.155, 0.032),
        MATERIALS["aluminum"],
        bevel=0.008,
        rotation=(0.0, math.radians(-8.0), 0.0),
    )
    add_rounded_box(
        "Touch controller rear service hatch",
        (-0.205, -0.136, 0.372),
        (0.110, 0.006, 0.178),
        MATERIALS["powder_shadow"],
        bevel=0.005,
        rotation=rotation,
    )
    for z in (0.319, 0.365, 0.411):
        add_rounded_box(
            f"Touch controller rear vent {z:.3f}",
            (-0.205, -0.131, z),
            (0.073, 0.004, 0.008),
            MATERIALS["black"],
            bevel=0.002,
            rotation=rotation,
        )


def build_heating_bath() -> None:
    """Build the right-side B-300-class bath with a true bowl and controller."""

    powder = MATERIALS["powder_white"]
    stainless = MATERIALS["stainless"]
    black = MATERIALS["black"]

    center = (0.170, -0.016, 0.0)
    add_revolved_profile(
        "Heating bath insulated faceted housing",
        (center[0], center[1], 0.146),
        [
            (0.105, -0.078),
            (0.128, -0.064),
            (0.140, -0.030),
            (0.142, 0.035),
            (0.133, 0.071),
            (0.126, 0.088),
        ],
        powder,
        segments=72,
    )
    add_cylinder(
        "Heating bath stainless basin",
        (center[0], center[1], 0.207),
        0.120,
        0.088,
        stainless,
        vertices=72,
        bevel=0.006,
    )
    add_cylinder(
        "Heating bath water surface",
        (center[0], center[1], 0.253),
        0.112,
        0.006,
        MATERIALS["water"],
        vertices=72,
        bevel=0.002,
    )
    add_torus(
        "Heating bath rolled rim",
        (center[0], center[1], 0.256),
        0.128,
        0.007,
        stainless,
        major_segments=72,
        minor_segments=16,
    )
    # The real bath has its controls in a separate low nose module, not on the
    # circular vessel body.
    add_rounded_box(
        "Bath digital controller nose",
        (0.170, -0.155, 0.076),
        (0.190, 0.080, 0.078),
        powder,
        bevel=0.015,
        rotation=(math.radians(-3.0), 0.0, 0.0),
    )
    add_rounded_box(
        "Bath controller display",
        (0.170, -0.198, 0.087),
        (0.075, 0.008, 0.030),
        MATERIALS["screen"],
        bevel=0.005,
        rotation=(math.radians(-3.0), 0.0, 0.0),
    )
    add_text(
        "Bath temperature readout",
        "55 C",
        (0.145, -0.204, 0.089),
        0.010,
        MATERIALS["display"],
        rotation=(math.radians(93.0), 0.0, 0.0),
    )
    add_cylinder_between(
        "Bath control encoder",
        (0.222, -0.197, 0.087),
        (0.222, -0.214, 0.087),
        0.013,
        MATERIALS["aluminum"],
        vertices=36,
        bevel=0.002,
    )
    for index, (x, material) in enumerate(
        ((0.105, MATERIALS["green"]), (0.247, MATERIALS["blue"])), 1
    ):
        add_cylinder_between(
            f"Bath controller key {index}",
            (x, -0.197, 0.087),
            (x, -0.211, 0.087),
            0.009,
            material,
            vertices=32,
            bevel=0.002,
        )
    add_rounded_box(
        "Bath hot-surface warning plate",
        (0.170, -0.151, 0.170),
        (0.042, 0.005, 0.038),
        MATERIALS["label"],
        bevel=0.002,
    )
    add_text(
        "Bath hot-surface glyph",
        "HOT",
        (0.154, -0.155, 0.171),
        0.010,
        MATERIALS["red"],
    )
    add_curve_tube(
        "Bath temperature probe cable",
        [
            (0.282, 0.020, 0.255),
            (0.295, 0.090, 0.226),
            (0.256, 0.143, 0.155),
            (0.155, 0.154, 0.117),
        ],
        0.0035,
        black,
        bevel_resolution=2,
    )
    add_cylinder_between(
        "Bath rear drain stem",
        (0.270, 0.078, 0.132),
        (0.300, 0.100, 0.126),
        0.008,
        stainless,
        vertices=32,
    )
    add_cylinder_between(
        "Bath rear drain cap",
        (0.296, 0.097, 0.126),
        (0.309, 0.107, 0.126),
        0.013,
        MATERIALS["blue"],
        vertices=36,
        bevel=0.002,
    )


def build_lift_and_drive() -> None:
    """Build the central electric lift, drive head, joints, and hidden services."""

    aluminum = MATERIALS["aluminum"]
    stainless = MATERIALS["stainless"]
    shadow = MATERIALS["powder_shadow"]
    black = MATERIALS["black"]
    powder = MATERIALS["powder_white"]

    add_rounded_box(
        "Lift column pedestal",
        (-0.042, 0.110, 0.148),
        (0.120, 0.126, 0.088),
        shadow,
        bevel=0.013,
    )
    add_rounded_box(
        "Electric lift tower front shell",
        (-0.042, 0.105, 0.493),
        (0.105, 0.105, 0.690),
        powder,
        bevel=0.021,
    )
    add_rounded_box(
        "Electric lift rear service spine",
        (-0.042, 0.162, 0.493),
        (0.082, 0.018, 0.636),
        shadow,
        bevel=0.006,
    )
    for index in range(12):
        add_rounded_box(
            f"Lift rear ventilation slot {index + 1}",
            (-0.042, 0.173, 0.270 + index * 0.037),
            (0.050, 0.004, 0.013),
            black,
            bevel=0.002,
        )
    for index, x in enumerate((-0.066, -0.018), 1):
        add_cylinder(
            f"Internal lift guide rail {index}",
            (x, 0.047, 0.500),
            0.0075,
            0.548,
            stainless,
            vertices=32,
            bevel=0.0015,
        )
    add_rounded_box(
        "Lift crown",
        (-0.042, 0.104, 0.843),
        (0.114, 0.112, 0.055),
        aluminum,
        bevel=0.014,
    )
    add_rounded_box(
        "Motor lift carriage",
        (-0.041, 0.046, 0.557),
        (0.130, 0.118, 0.130),
        powder,
        bevel=0.019,
    )
    add_rounded_box(
        "Lift carriage rear plate",
        (-0.041, 0.109, 0.557),
        (0.108, 0.018, 0.106),
        shadow,
        bevel=0.006,
    )
    add_cylinder_between(
        "Lift locking knob shaft",
        (-0.103, 0.058, 0.576),
        (-0.137, 0.058, 0.576),
        0.008,
        stainless,
        vertices=28,
    )
    add_cylinder_between(
        "Lift locking knob",
        (-0.132, 0.058, 0.576),
        (-0.157, 0.058, 0.576),
        0.021,
        black,
        vertices=12,
        bevel=0.003,
    )

    # The motor axis slopes down and right into the bath, matching the supplied
    # R-300 reference rather than the old mirrored EYELA-like arrangement.
    drive_start = Vector((-0.050, 0.033, 0.566))
    drive_end = Vector((0.072, -0.004, 0.478))
    axis = (drive_end - drive_start).normalized()
    add_cylinder_between(
        "Rotary drive motor barrel",
        drive_start,
        drive_end,
        0.050,
        shadow,
        vertices=56,
        bevel=0.004,
    )
    add_cylinder_between(
        "Drive motor white shell",
        (-0.064, 0.037, 0.576),
        (-0.116, 0.053, 0.614),
        0.057,
        powder,
        vertices=56,
        bevel=0.005,
    )
    add_torus(
        "Drive head green operating ring",
        tuple(drive_end + axis * 0.012),
        0.049,
        0.007,
        MATERIALS["green"],
        axis=tuple(axis),
    )
    add_cylinder_between(
        "Vapor duct through drive",
        drive_end - axis * 0.045,
        drive_end + axis * 0.055,
        0.019,
        MATERIALS["ground_glass"],
        vertices=48,
    )
    add_torus(
        "Evaporation flask clamp",
        tuple(drive_end - axis * 0.034),
        0.030,
        0.0055,
        MATERIALS["aluminum"],
        axis=tuple(axis),
    )
    add_cylinder_between(
        "Combi clip release knob",
        tuple(drive_end + Vector((0.000, -0.022, 0.026))),
        tuple(drive_end + Vector((0.000, -0.046, 0.026))),
        0.010,
        MATERIALS["green"],
        vertices=32,
        bevel=0.002,
    )

    # Motor fan grille and center hub on the hidden rear side.
    fan_center = Vector((-0.123, 0.055, 0.619))
    add_torus(
        "Motor rear fan grille ring",
        tuple(fan_center),
        0.039,
        0.003,
        black,
        axis=tuple(axis),
    )
    add_cylinder_between(
        "Motor rear fan hub",
        fan_center - axis * 0.003,
        fan_center + axis * 0.008,
        0.010,
        black,
        vertices=28,
    )
    tangent = axis.cross(Vector((0.0, 0.0, 1.0))).normalized()
    bitangent = axis.cross(tangent).normalized()
    for index in range(8):
        angle = TAU * index / 8
        direction = tangent * math.cos(angle) + bitangent * math.sin(angle)
        add_cylinder_between(
            f"Motor fan spoke {index + 1}",
            fan_center + direction * 0.010,
            fan_center + direction * 0.037,
            0.0016,
            black,
            vertices=12,
        )

    # The lift lever is visible and mechanically tied to the carriage.
    add_cylinder_between(
        "Lift lever arm",
        (-0.095, 0.003, 0.522),
        (-0.157, -0.044, 0.470),
        0.007,
        stainless,
        vertices=28,
    )
    add_cylinder_between(
        "Lift lever grip",
        (-0.151, -0.040, 0.475),
        (-0.181, -0.062, 0.451),
        0.013,
        black,
        vertices=36,
        bevel=0.002,
    )
    add_rounded_box(
        "Lift height scale plate",
        (-0.096, 0.048, 0.700),
        (0.010, 0.008, 0.170),
        MATERIALS["label"],
        bevel=0.002,
    )
    for index in range(7):
        add_rounded_box(
            f"Lift scale tick {index + 1}",
            (-0.102, 0.042, 0.640 + index * 0.020),
            (0.010 if index % 2 else 0.015, 0.003, 0.002),
            MATERIALS["powder_white"],
            bevel=0.0005,
        )


def build_evaporating_flask() -> None:
    """Build the right-hand pear flask immersed in the bath, with blue charge."""

    axis = Vector((-0.72, 0.08, 0.69)).normalized()
    center = (0.181, -0.018, 0.337)
    profile = [
        (0.002, -0.096),
        (0.033, -0.091),
        (0.068, -0.066),
        (0.088, -0.018),
        (0.090, 0.022),
        (0.076, 0.062),
        (0.049, 0.094),
        (0.024, 0.116),
        (0.019, 0.156),
    ]
    add_revolved_profile(
        "Evaporating pear flask",
        center,
        profile,
        MATERIALS["glass"],
        axis=tuple(axis),
        segments=72,
    )
    add_uv_sphere(
        "Solvent charge inside evaporation flask",
        (0.190, -0.021, 0.304),
        (0.068, 0.068, 0.038),
        MATERIALS["solvent"],
        rotation=(0.0, math.radians(-32.0), 0.0),
    )
    neck_center = Vector(center) + axis * 0.154
    add_cylinder_between(
        "Evaporating flask ground neck",
        neck_center - axis * 0.020,
        neck_center + axis * 0.060,
        0.020,
        MATERIALS["ground_glass"],
        vertices=56,
    )
    add_torus(
        "Evaporating flask joint lip",
        tuple(neck_center + axis * 0.057),
        0.023,
        0.0035,
        MATERIALS["glass"],
        axis=tuple(axis),
    )


def build_condenser_and_receiver_legacy() -> None:
    glass = MATERIALS["glass"]
    ground_glass = MATERIALS["ground_glass"]
    stainless = MATERIALS["stainless"]
    aluminum = MATERIALS["aluminum"]

    x = 0.184
    y = 0.075
    receiver_x = 0.2815
    add_cylinder(
        "Condenser outer borosilicate jacket",
        (x, y, 0.865),
        0.052,
        0.388,
        glass,
        vertices=72,
    )
    add_torus(
        "Condenser lower rolled glass rim",
        (x, y, 0.671),
        0.051,
        0.0045,
        glass,
        major_segments=64,
        minor_segments=14,
    )
    add_torus(
        "Condenser upper rolled glass rim",
        (x, y, 1.059),
        0.051,
        0.0045,
        glass,
        major_segments=64,
        minor_segments=14,
    )
    add_cylinder(
        "Condenser central vapor tube",
        (x, y, 0.866),
        0.014,
        0.430,
        ground_glass,
        vertices=48,
    )

    coil_points: list[tuple[float, float, float]] = []
    turns = 6.25
    count = 220
    for index in range(count):
        ratio = index / (count - 1)
        angle = TAU * turns * ratio
        coil_points.append(
            (
                x + math.cos(angle) * 0.029,
                y + math.sin(angle) * 0.029,
                0.707 + ratio * 0.310,
            )
        )
    add_poly_tube(
        "Condenser internal helical coil",
        coil_points,
        0.0042,
        ground_glass,
        bevel_resolution=3,
    )
    add_curve_tube(
        "Condenser coil upper return",
        [(x + 0.029, y, 1.017), (x + 0.014, y, 1.040), (x, y, 1.064)],
        0.0042,
        ground_glass,
        bevel_resolution=3,
    )
    add_curve_tube(
        "Condenser coil lower return",
        [(x + 0.029, y, 0.707), (x + 0.012, y, 0.690), (x, y, 0.671)],
        0.0042,
        ground_glass,
        bevel_resolution=3,
    )

    # Glass coolant nipples and two translucent coolant hoses.
    for name, z in (("upper", 0.994), ("lower", 0.760)):
        add_cylinder_between(
            f"Condenser {name} coolant nipple",
            (x, y + 0.040, z),
            (x, y + 0.103, z),
            0.009,
            ground_glass,
            vertices=44,
        )
        add_torus(
            f"Condenser {name} nipple barb",
            (x, y + 0.100, z),
            0.010,
            0.0025,
            glass,
            axis=(0.0, 1.0, 0.0),
        )
    add_curve_tube(
        "Upper condenser coolant hose",
        [
            (x, y + 0.102, 0.994),
            (0.232, 0.214, 0.984),
            (0.259, 0.238, 0.873),
            (0.251, 0.222, 0.716),
            (0.218, 0.197, 0.593),
        ],
        0.0075,
        MATERIALS["blue_hose"],
        bevel_resolution=4,
    )
    add_curve_tube(
        "Lower condenser coolant hose",
        [
            (x, y + 0.102, 0.760),
            (0.135, 0.216, 0.745),
            (0.112, 0.240, 0.627),
            (0.120, 0.222, 0.484),
            (0.159, 0.205, 0.344),
        ],
        0.0075,
        MATERIALS["clear_hose"],
        bevel_resolution=4,
    )

    # Top vacuum adapter and a routed vacuum hose.
    add_revolved_profile(
        "Condenser vacuum takeoff adapter",
        (x, y, 1.086),
        [
            (0.018, -0.027),
            (0.023, -0.019),
            (0.023, 0.002),
            (0.016, 0.010),
            (0.013, 0.031),
        ],
        ground_glass,
        segments=56,
    )
    add_curve_tube(
        "Vacuum takeoff bent glass",
        [(x, y, 1.104), (0.222, 0.098, 1.138), (0.251, 0.133, 1.112)],
        0.012,
        ground_glass,
        bevel_resolution=4,
    )
    add_curve_tube(
        "Vacuum hose",
        [
            (0.251, 0.133, 1.112),
            (0.291, 0.276, 1.091),
            (0.306, 0.329, 0.976),
            (0.304, 0.326, 0.831),
            (0.291, 0.298, 0.693),
        ],
        0.008,
        MATERIALS["clear_hose"],
        bevel_resolution=4,
    )

    # Lower Y adapter: one branch returns vapor to the drive, the other drops
    # into the receiver. Curves keep the glass anatomy readable from all sides.
    add_curve_tube(
        "Condenser vapor bridge to rotary drive",
        [
            (x, y, 0.703),
            (0.143, 0.073, 0.695),
            (0.099, 0.060, 0.684),
            (0.046, 0.042, 0.665),
        ],
        0.020,
        ground_glass,
        bevel_resolution=5,
    )
    add_curve_tube(
        "Receiver glass drop adapter",
        [
            (x, y, 0.692),
            (0.2485, 0.068, 0.652),
            (0.2775, 0.053, 0.592),
            (receiver_x, 0.036, 0.531),
        ],
        0.017,
        ground_glass,
        bevel_resolution=5,
    )

    receiver_profile = [
        (0.003, -0.145),
        (0.040, -0.137),
        (0.074, -0.105),
        (0.091, -0.055),
        (0.090, 0.010),
        (0.068, 0.068),
        (0.034, 0.105),
        (0.020, 0.122),
        (0.018, 0.154),
    ]
    add_revolved_profile(
        "Receiving flask",
        (receiver_x, 0.035, 0.378),
        receiver_profile,
        glass,
        segments=72,
    )
    add_uv_sphere(
        "Condensate inside receiving flask",
        (receiver_x, 0.035, 0.303),
        (0.061, 0.061, 0.026),
        MATERIALS["solvent"],
    )
    add_torus(
        "Receiving flask clamp ring",
        (receiver_x, 0.035, 0.527),
        0.028,
        0.005,
        MATERIALS["blue"],
    )

    # Independent support frame for the condenser and receiver.
    add_cylinder_between(
        "Condenser horizontal support arm",
        (0.079, 0.144, 0.846),
        (0.184, 0.144, 0.846),
        0.008,
        stainless,
        vertices=32,
    )
    add_torus(
        "Condenser support clamp ring",
        (0.184, 0.075, 0.846),
        0.058,
        0.005,
        aluminum,
    )
    add_cylinder_between(
        "Condenser support clamp bridge",
        (0.184, 0.133, 0.846),
        (0.184, 0.144, 0.846),
        0.008,
        stainless,
        vertices=28,
    )
    add_cylinder_between(
        "Receiver support arm",
        (0.093, 0.144, 0.486),
        (receiver_x, 0.114, 0.486),
        0.007,
        stainless,
        vertices=28,
    )
    add_torus(
        "Receiver support cradle",
        (receiver_x, 0.035, 0.486),
        0.050,
        0.0045,
        aluminum,
    )
    add_curve_tube(
        "Receiver safety tether",
        [
            (receiver_x, 0.083, 0.487),
            (0.3145, 0.086, 0.453),
            (0.3115, 0.075, 0.407),
        ],
        0.0025,
        MATERIALS["blue"],
        bevel_resolution=2,
    )


def build_condenser_and_receiver() -> None:
    """Build the tall V condenser, blue cooling coil, and left receiver train."""

    glass = MATERIALS["glass"]
    ground_glass = MATERIALS["ground_glass"]
    stainless = MATERIALS["stainless"]
    aluminum = MATERIALS["aluminum"]
    x = -0.092
    y = 0.010

    add_cylinder(
        "Buchi-class condenser outer glass jacket",
        (x, y, 0.714),
        0.047,
        0.430,
        glass,
        vertices=80,
    )
    for name, z in (("lower", 0.499), ("upper", 0.929)):
        add_torus(
            f"Condenser {name} rolled glass rim",
            (x, y, z),
            0.046,
            0.0042,
            glass,
            major_segments=72,
            minor_segments=14,
        )
    add_cylinder(
        "Condenser central vapor riser",
        (x, y, 0.713),
        0.012,
        0.456,
        ground_glass,
        vertices=48,
    )

    # The saturated-blue coil is the most important recognition cue in the
    # supplied modern product image.  It is genuine helical geometry inside a
    # transmissive jacket, not a texture or front-facing decal.
    coil_points: list[tuple[float, float, float]] = []
    turns = 7.0
    count = 280
    for index in range(count):
        ratio = index / (count - 1)
        angle = TAU * turns * ratio
        coil_points.append(
            (
                x + math.cos(angle) * 0.026,
                y + math.sin(angle) * 0.026,
                0.535 + ratio * 0.350,
            )
        )
    add_poly_tube(
        "Condenser blue helical coolant coil",
        coil_points,
        0.0048,
        MATERIALS["blue"],
        bevel_resolution=4,
    )
    add_curve_tube(
        "Condenser coil upper glass return",
        [(x + 0.026, y, 0.885), (x + 0.013, y, 0.910), (x, y, 0.932)],
        0.0048,
        MATERIALS["blue"],
        bevel_resolution=4,
    )
    add_curve_tube(
        "Condenser coil lower glass return",
        [(x + 0.026, y, 0.535), (x + 0.012, y, 0.516), (x, y, 0.499)],
        0.0048,
        MATERIALS["blue"],
        bevel_resolution=4,
    )

    # Coolant ports and flexible service hoses run down the hidden rear side.
    for name, z in (("upper", 0.868), ("lower", 0.562)):
        add_cylinder_between(
            f"Condenser {name} coolant nipple",
            (x, y + 0.034, z),
            (x, y + 0.086, z),
            0.008,
            ground_glass,
            vertices=44,
        )
        add_torus(
            f"Condenser {name} coolant barb",
            (x, y + 0.083, z),
            0.009,
            0.0022,
            glass,
            axis=(0.0, 1.0, 0.0),
        )
    add_curve_tube(
        "Upper blue coolant hose",
        [
            (x, y + 0.084, 0.868),
            (-0.018, 0.176, 0.852),
            (0.005, 0.190, 0.718),
            (-0.010, 0.180, 0.595),
            (-0.024, 0.166, 0.470),
        ],
        0.0065,
        MATERIALS["blue_hose"],
        bevel_resolution=4,
    )
    add_curve_tube(
        "Lower clear coolant hose",
        [
            (x, y + 0.084, 0.562),
            (-0.118, 0.164, 0.548),
            (-0.132, 0.183, 0.438),
            (-0.111, 0.176, 0.326),
            (-0.085, 0.158, 0.218),
        ],
        0.0065,
        MATERIALS["clear_hose"],
        bevel_resolution=4,
    )

    # Black top cap, vacuum take-off, and small glass stopcock assembly.
    add_cylinder(
        "Condenser top protective cap",
        (x, y, 0.950),
        0.022,
        0.028,
        MATERIALS["black"],
        vertices=48,
        bevel=0.004,
    )
    add_curve_tube(
        "Condenser vacuum takeoff",
        [(x, y, 0.940), (-0.110, 0.054, 0.955), (-0.146, 0.042, 0.932)],
        0.010,
        ground_glass,
        bevel_resolution=4,
    )
    add_cylinder_between(
        "Vacuum takeoff valve stem",
        (-0.146, 0.042, 0.932),
        (-0.177, 0.028, 0.932),
        0.006,
        stainless,
        vertices=28,
    )
    add_cylinder_between(
        "Vacuum takeoff black knob",
        (-0.173, 0.030, 0.932),
        (-0.194, 0.020, 0.932),
        0.012,
        MATERIALS["black"],
        vertices=24,
        bevel=0.002,
    )

    # Short vapor bridge to the central drive head.
    add_curve_tube(
        "Condenser vapor bridge to rotary drive",
        [
            (x, y, 0.514),
            (-0.050, 0.044, 0.530),
            (-0.042, 0.037, 0.550),
        ],
        0.018,
        ground_glass,
        bevel_resolution=5,
    )

    # Left receiving flask and its three-way drop adapter.
    receiver_x = -0.165
    add_curve_tube(
        "Receiver three-way glass drop adapter",
        [
            (x, y, 0.515),
            (-0.102, 0.050, 0.476),
            (-0.142, 0.044, 0.445),
            (receiver_x, 0.036, 0.421),
        ],
        0.015,
        ground_glass,
        bevel_resolution=5,
    )
    receiver_profile = [
        (0.003, -0.098),
        (0.031, -0.094),
        (0.057, -0.073),
        (0.071, -0.035),
        (0.070, 0.008),
        (0.054, 0.050),
        (0.029, 0.078),
        (0.017, 0.092),
        (0.016, 0.118),
    ]
    add_revolved_profile(
        "Receiving flask",
        (receiver_x, 0.036, 0.303),
        receiver_profile,
        glass,
        segments=72,
    )
    add_uv_sphere(
        "Blue condensate inside receiving flask",
        (receiver_x, 0.036, 0.257),
        (0.047, 0.047, 0.019),
        MATERIALS["solvent"],
    )
    add_torus(
        "Receiving flask clamp ring",
        (receiver_x, 0.036, 0.418),
        0.024,
        0.0045,
        MATERIALS["aluminum"],
    )
    add_cylinder_between(
        "Receiver drain stopcock",
        (receiver_x, 0.036, 0.202),
        (receiver_x, 0.036, 0.176),
        0.006,
        ground_glass,
        vertices=32,
    )
    add_cylinder_between(
        "Receiver stopcock side key",
        (-0.165, 0.034, 0.191),
        (-0.205, 0.018, 0.191),
        0.005,
        stainless,
        vertices=24,
    )
    add_cylinder_between(
        "Receiver stopcock black handle",
        (-0.199, 0.020, 0.191),
        (-0.222, 0.010, 0.191),
        0.010,
        MATERIALS["black"],
        vertices=24,
        bevel=0.002,
    )

    # Brackets are visible from the back and side, grounding the glass train in
    # plausible hardware rather than allowing it to float.
    add_cylinder_between(
        "Condenser support arm",
        (-0.041, 0.136, 0.742),
        (x, 0.126, 0.742),
        0.007,
        stainless,
        vertices=32,
    )
    add_torus(
        "Condenser support clamp",
        (x, y, 0.742),
        0.052,
        0.0045,
        aluminum,
    )
    add_cylinder_between(
        "Condenser clamp bridge",
        (x, 0.106, 0.742),
        (x, 0.126, 0.742),
        0.007,
        stainless,
        vertices=28,
    )
    add_cylinder_between(
        "Receiver support arm",
        (-0.060, 0.135, 0.337),
        (receiver_x, 0.104, 0.337),
        0.006,
        stainless,
        vertices=28,
    )
    add_torus(
        "Receiver support cradle",
        (receiver_x, 0.036, 0.337),
        0.042,
        0.004,
        aluminum,
    )


def build_small_details_legacy() -> None:
    # Safety decals and equipment labels avoid blank generic faces.
    add_rounded_box(
        "Hot surface warning decal",
        (-0.165, -0.188, 0.258),
        (0.043, 0.003, 0.035),
        MATERIALS["label"],
        bevel=0.001,
    )
    add_text(
        "Hot surface warning glyph",
        "HOT",
        (-0.165, -0.191, 0.259),
        0.011,
        MATERIALS["red"],
    )
    add_rounded_box(
        "Condenser serial label",
        (0.176, 0.125, 0.923),
        (0.051, 0.003, 0.020),
        MATERIALS["powder_white"],
        bevel=0.001,
    )

    # Side service seam and fasteners.
    for z in (0.080, 0.165):
        for y in (-0.135, 0.125):
            start = Vector((-0.289, y, z))
            end = Vector((-0.293, y, z))
            add_cylinder_between(
                f"Left side fastener {y:+.3f} {z:.3f}",
                start,
                end,
                0.004,
                MATERIALS["stainless"],
                vertices=20,
            )

    # Cable loop from the motor into the lift column; visible from behind.
    add_curve_tube(
        "Rotary motor power and sensor loom",
        [
            (0.112, 0.119, 0.743),
            (0.151, 0.183, 0.735),
            (0.133, 0.210, 0.620),
            (0.093, 0.191, 0.482),
            (0.076, 0.153, 0.304),
            (0.109, 0.145, 0.211),
        ],
        0.005,
        MATERIALS["rubber"],
        bevel_resolution=3,
    )


def build_small_details() -> None:
    """Add original identity, seams, fasteners, and all-sided service detail."""

    add_rounded_box(
        "Original product identity plate",
        (-0.042, 0.048, 0.802),
        (0.074, 0.006, 0.027),
        MATERIALS["powder_shadow"],
        bevel=0.003,
    )
    add_text(
        "Original product identity",
        "LABSPACE RV-300",
        (-0.076, 0.044, 0.803),
        0.009,
        MATERIALS["powder_white"],
    )
    add_rounded_box(
        "Condenser serial plate",
        (-0.064, 0.104, 0.800),
        (0.045, 0.004, 0.019),
        MATERIALS["powder_white"],
        bevel=0.001,
    )

    # Lift tower seams and rear fasteners remain legible when orbiting around.
    for z in (0.215, 0.480, 0.758):
        for x in (-0.094, 0.010):
            add_cylinder_between(
                f"Lift tower service fastener {x:+.3f} {z:.3f}",
                (x, 0.174, z),
                (x, 0.178, z),
                0.0038,
                MATERIALS["stainless"],
                vertices=20,
            )
    add_curve_tube(
        "Rotary motor power and sensor loom",
        [
            (-0.116, 0.060, 0.616),
            (-0.128, 0.138, 0.604),
            (-0.112, 0.176, 0.536),
            (-0.078, 0.177, 0.421),
            (-0.058, 0.166, 0.272),
            (-0.052, 0.148, 0.165),
        ],
        0.005,
        MATERIALS["rubber"],
        bevel_resolution=3,
    )
    add_curve_tube(
        "Controller data cable",
        [
            (-0.205, -0.137, 0.286),
            (-0.172, -0.094, 0.236),
            (-0.116, 0.012, 0.188),
            (-0.070, 0.107, 0.156),
        ],
        0.0045,
        MATERIALS["rubber"],
        bevel_resolution=3,
    )
    add_rounded_box(
        "Rear compliance plate",
        (-0.042, 0.177, 0.620),
        (0.054, 0.004, 0.082),
        MATERIALS["label"],
        bevel=0.002,
    )
    for index in range(5):
        add_rounded_box(
            f"Rear compliance text line {index + 1}",
            (-0.042, 0.180, 0.648 - index * 0.014),
            (0.041 - index * 0.002, 0.002, 0.003),
            MATERIALS["powder_white"],
            bevel=0.0005,
        )


def create_root() -> None:
    global ROOT
    ROOT = bpy.data.objects.new("RotaryEvaporator_ROOT", None)
    bpy.context.collection.objects.link(ROOT)
    ROOT.empty_display_type = "PLAIN_AXES"
    ROOT.empty_display_size = 0.1
    ROOT["asset_id"] = "rotary-evaporator"
    ROOT["display_name"] = "Touchscreen Vertical-Condenser Rotary Evaporator"
    ROOT["units"] = "meters"
    ROOT["nominal_dimensions_m"] = [0.607, 0.429, 0.947]
    ROOT["reference_class"] = "Buchi Rotavapor R-300 vertical-condenser class"
    ROOT["revision"] = "buchi-reference-r4"
    ROOT["modeling_note"] = (
        "Original logo-free dimension-driven planning asset informed by the supplied "
        "Buchi reference and official R-300 documentation; not manufacturer certified."
    )


def consolidate_static_parts_by_material() -> None:
    """Bake modifiers and merge static geometry into one draw call per material.

    The individual authored objects retain useful semantic names in the source
    script, while the runtime GLB stays efficient enough to place repeatedly.
    Glass, ground glass, liquids, hoses, metals, and controls remain distinct
    because each uses a different material group.
    """

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import reference_finishes
    reference_finishes.apply(sys.modules[__name__])
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    for obj in mesh_objects:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)

    groups: dict[str, list[bpy.types.Object]] = {}
    for obj in mesh_objects:
        material = obj.data.materials[0] if obj.data.materials else None
        key = material.name if material is not None else "Unassigned"
        groups.setdefault(key, []).append(obj)

    for material_name in sorted(groups):
        objects = groups[material_name]
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        active = objects[0]
        bpy.context.view_layer.objects.active = active
        if len(objects) > 1:
            bpy.ops.object.join()

        active = bpy.context.object
        # Bake the surviving active object's transform as well. Without this,
        # a rotated cylinder or torus can leave the consolidated mesh with a
        # rotated local AABB that substantially overstates its world bounds.
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        safe_name = "".join(
            character if character.isalnum() else "_" for character in material_name
        ).strip("_")
        active.name = f"RotaryEvaporator__{safe_name}"
        active.data.name = f"{active.name}_mesh"
        active["material_group"] = material_name
        active.data.materials.clear()
        material = bpy.data.materials.get(material_name)
        if material is not None:
            active.data.materials.append(material)
        for polygon in active.data.polygons:
            polygon.material_index = 0

    bpy.ops.object.select_all(action="DESELECT")


def mesh_bounds() -> tuple[Vector, Vector]:
    bpy.context.view_layer.update()
    points: list[Vector] = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        raise RuntimeError("No mesh geometry was created")
    return (
        Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points))),
        Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points))),
    )


def center_and_ground() -> dict[str, list[float]]:
    assert ROOT is not None
    minimum, maximum = mesh_bounds()
    offset = Vector(
        (
            -(minimum.x + maximum.x) * 0.5,
            -(minimum.y + maximum.y) * 0.5,
            -minimum.z,
        )
    )
    ROOT.location += offset
    bpy.context.view_layer.update()
    minimum, maximum = mesh_bounds()
    dimensions = maximum - minimum
    ROOT["authored_bounds_m"] = [round(value, 6) for value in dimensions]
    ROOT["anchor"] = "footprint-center-ground"
    return {
        "min": [round(value, 6) for value in minimum],
        "max": [round(value, 6) for value in maximum],
        "dimensions": [round(value, 6) for value in dimensions],
    }


def scene_statistics(bounds: dict[str, list[float]]) -> dict[str, object]:
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    polygons = sum(len(obj.data.polygons) for obj in mesh_objects)
    vertices = sum(len(obj.data.vertices) for obj in mesh_objects)
    return {
        "asset_id": "rotary-evaporator",
        "objects": len(bpy.context.scene.objects),
        "mesh_objects": len(mesh_objects),
        "materials": len(bpy.data.materials),
        "vertices": vertices,
        "polygons": polygons,
        "bounds_m": bounds,
    }


def validate_authored_scene(stats: dict[str, object]) -> None:
    dimensions = stats["bounds_m"]["dimensions"]
    width, depth, height = dimensions
    warnings: list[str] = []
    if not 0.56 <= width <= 0.64:
        warnings.append(f"width {width:.3f} m outside expected 0.56-0.64 m")
    if not 0.40 <= depth <= 0.48:
        warnings.append(f"depth {depth:.3f} m outside expected 0.40-0.48 m")
    if not 0.91 <= height <= 0.99:
        warnings.append(f"height {height:.3f} m outside expected 0.91-0.99 m")
    if not 14 <= stats["mesh_objects"] <= 24:
        warnings.append(
            f"runtime mesh groups {stats['mesh_objects']} outside expected 14-24"
        )
    if stats["materials"] < 12:
        warnings.append("hero asset has fewer than 12 PBR materials")
    if stats["polygons"] < 25_000:
        warnings.append("hero silhouette lost too much authored geometry")
    if warnings:
        raise RuntimeError("Authored scene validation failed: " + "; ".join(warnings))


def export_glb(output_path: Path, draco: bool) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    kwargs = dict(
        filepath=str(output_path),
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
        export_draco_mesh_compression_enable=draco,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_loglevel=-1,
    )
    result = bpy.ops.export_scene.gltf(**kwargs)
    if "FINISHED" not in result:
        raise RuntimeError(f"GLB export failed: {result}")


def main() -> None:
    args = parse_args()
    output_path = Path(args.output).resolve()

    reset_scene()
    create_root()
    build_materials()
    build_base_and_controls()
    build_touch_controller()
    build_heating_bath()
    build_lift_and_drive()
    build_evaporating_flask()
    build_condenser_and_receiver()
    build_small_details()
    consolidate_static_parts_by_material()

    bounds = center_and_ground()
    stats = scene_statistics(bounds)
    print("LABSPACE_GLTF_PREVALIDATE " + json.dumps(stats, sort_keys=True))
    validate_authored_scene(stats)

    if args.save_blend:
        blend_path = Path(args.save_blend).resolve()
        blend_path.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    export_glb(output_path, draco=args.draco)
    if not output_path.exists() or output_path.stat().st_size < 100_000:
        raise RuntimeError(
            f"GLB output is missing or unexpectedly small: {output_path}"
        )

    stats["output"] = str(output_path)
    stats["bytes"] = output_path.stat().st_size
    stats["draco"] = args.draco
    print("LABSPACE_GLTF_BUILD " + json.dumps(stats, sort_keys=True))


if __name__ == "__main__":
    main()
