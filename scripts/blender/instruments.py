"""Author original all-sided LabSpace centrifuge and microscope hero GLBs.

These dimension-driven planning assets are informed by Kyushu University Room
809 photographs and the common construction of current Eppendorf benchtop
centrifuges and Evident/ZEISS upright biological microscopes.  They are original
geometry, not manufacturer-certified replicas.  The script has no network or
add-on dependency and exports plain, self-contained GLB files for offline use.

Run from the repository root with the bundled Blender 4.5 LTS::

    .tools/blender-4.5.11-windows-x64/blender.exe --background \
      --factory-startup --python scripts/blender/instruments.py -- \
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


ROOT: bpy.types.Object | None = None
MATERIALS: dict[str, bpy.types.Material] = {}


ASSETS = {
    "benchtop-centrifuge": {
        "filename": "benchtop-centrifuge.glb",
        "dimensions": (0.60, 0.65, 0.42),
        "reference": (
            "Kyushu University Room 809 white benchtop centrifuge; common "
            "Eppendorf 5804/5910-series construction"
        ),
    },
    "compound-microscope": {
        "filename": "compound-microscope.glb",
        "dimensions": (0.30, 0.42, 0.48),
        "reference": (
            "Kyushu University Room 809 upright microscopes; common "
            "Evident CX43 and ZEISS Primostar 3 construction"
        ),
    },
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        default="public/models/hero",
        help="Destination directory for the GLB files.",
    )
    parser.add_argument(
        "--asset",
        choices=("all", *ASSETS.keys()),
        default="all",
        help="Build both instruments or only one named asset.",
    )
    parser.add_argument(
        "--draco",
        action="store_true",
        help="Opt in to Draco compression; offline LabSpace leaves this disabled.",
    )
    parser.add_argument(
        "--save-blend-dir",
        default="",
        help="Optional directory for editable .blend authoring snapshots.",
    )
    parser.add_argument(
        "--preview-dir",
        default="",
        help="Optional directory for front and rear QA renders after GLB re-import.",
    )
    return parser.parse_args(argv)


def reset_scene(asset_id: str) -> None:
    global ROOT, MATERIALS
    ROOT = None
    MATERIALS = {}
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
    scene.world.color = (0.025, 0.030, 0.040)
    scene["asset_id"] = asset_id
    scene["authoring_units"] = "meters"
    scene["design_reference"] = ASSETS[asset_id]["reference"]
    scene["planning_model"] = True
    scene["front_axis"] = "-Y"


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
            material.use_transparency_overlap = False
        except (AttributeError, TypeError):
            pass
    material["pbr_role"] = name
    return material


def build_materials() -> None:
    global MATERIALS
    MATERIALS = {
        "warm_white": make_material(
            "Warm white molded housing",
            (0.79, 0.81, 0.79, 1.0),
            roughness=0.27,
            coat=0.18,
        ),
        "light_gray": make_material(
            "Cool gray molded trim",
            (0.47, 0.51, 0.52, 1.0),
            roughness=0.31,
            coat=0.11,
        ),
        "shadow_gray": make_material(
            "Graphite mechanism finish",
            (0.105, 0.125, 0.135, 1.0),
            metallic=0.12,
            roughness=0.31,
        ),
        "stainless": make_material(
            "Brushed stainless steel",
            (0.59, 0.63, 0.65, 1.0),
            metallic=0.96,
            roughness=0.18,
            anisotropy=0.72,
        ),
        "polished_steel": make_material(
            "Polished optical hardware",
            (0.76, 0.80, 0.82, 1.0),
            metallic=1.0,
            roughness=0.10,
            coat=0.16,
        ),
        "aluminum": make_material(
            "Satin anodized aluminum",
            (0.49, 0.54, 0.57, 1.0),
            metallic=0.89,
            roughness=0.23,
            anisotropy=0.34,
        ),
        "black": make_material(
            "Black engineering polymer",
            (0.010, 0.015, 0.018, 1.0),
            roughness=0.29,
            coat=0.12,
        ),
        "rubber": make_material(
            "Black EPDM rubber",
            (0.006, 0.009, 0.010, 1.0),
            roughness=0.78,
        ),
        "screen": make_material(
            "Controller glass",
            (0.004, 0.013, 0.020, 1.0),
            roughness=0.08,
            coat=0.52,
        ),
        "display": make_material(
            "Cyan display pixels",
            (0.01, 0.50, 0.70, 1.0),
            roughness=0.14,
            emission=(0.01, 0.48, 0.74, 1.0),
            emission_strength=2.8,
        ),
        "blue": make_material(
            "Laboratory blue accent",
            (0.025, 0.16, 0.48, 1.0),
            roughness=0.24,
            coat=0.28,
        ),
        "green": make_material(
            "Status green",
            (0.02, 0.44, 0.13, 1.0),
            roughness=0.22,
            emission=(0.01, 0.40, 0.10, 1.0),
            emission_strength=1.7,
        ),
        "red": make_material(
            "Safety red",
            (0.66, 0.025, 0.018, 1.0),
            roughness=0.27,
            coat=0.20,
        ),
        "amber": make_material(
            "Objective amber band",
            (0.90, 0.43, 0.025, 1.0),
            metallic=0.20,
            roughness=0.28,
        ),
        "brass": make_material(
            "Objective brass",
            (0.54, 0.35, 0.11, 1.0),
            metallic=0.88,
            roughness=0.21,
        ),
        "label": make_material(
            "Printed graphite",
            (0.035, 0.042, 0.046, 1.0),
            roughness=0.50,
        ),
        "paper": make_material(
            "Equipment label stock",
            (0.86, 0.87, 0.80, 1.0),
            roughness=0.70,
        ),
        "glass": make_material(
            "Smoked inspection glass",
            (0.12, 0.21, 0.25, 0.46),
            roughness=0.08,
            transmission=0.58,
            ior=1.51,
            coat=0.32,
        ),
        "optical_glass": make_material(
            "Coated optical glass",
            (0.05, 0.33, 0.39, 0.72),
            roughness=0.06,
            transmission=0.48,
            ior=1.52,
            coat=0.40,
        ),
    }


def create_root(asset_id: str) -> None:
    global ROOT
    ROOT = bpy.data.objects.new(f"{asset_id}_ROOT", None)
    bpy.context.collection.objects.link(ROOT)
    ROOT["asset_id"] = asset_id
    ROOT["real_scale"] = True
    ROOT["front_axis"] = "-Y"
    ROOT["up_axis_authoring"] = "+Z"
    ROOT["original_geometry"] = True


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


def sphere(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    segments: int = 48,
    rings: int = 24,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
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
    obj.select_set(False)
    return obj


def rounded_rect_loop(
    name: str,
    center: tuple[float, float, float],
    width: float,
    depth: float,
    corner_radius: float,
    tube_radius: float,
    material: bpy.types.Material,
    *,
    samples_per_corner: int = 8,
) -> bpy.types.Object:
    cx, cy, cz = center
    points: list[Vector] = []
    for corner_x, corner_y, start_angle in (
        (1.0, 1.0, 0.0),
        (-1.0, 1.0, math.pi / 2.0),
        (-1.0, -1.0, math.pi),
        (1.0, -1.0, math.pi * 1.5),
    ):
        ox = cx + corner_x * (width * 0.5 - corner_radius)
        oy = cy + corner_y * (depth * 0.5 - corner_radius)
        for step in range(samples_per_corner):
            angle = start_angle + step * (math.pi * 0.5 / samples_per_corner)
            points.append(
                Vector(
                    (
                        ox + math.cos(angle) * corner_radius,
                        oy + math.sin(angle) * corner_radius,
                        cz,
                    )
                )
            )
    curve = bpy.data.curves.new(name=f"{name}_curve", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 1
    curve.bevel_depth = tube_radius
    curve.bevel_resolution = 2
    spline = curve.splines.new(type="POLY")
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1.0)
    spline.use_cyclic_u = True
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
    curve.extrude = 0.00030
    curve.bevel_depth = 0.00006
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


def fastener(
    name: str,
    location: tuple[float, float, float],
    *,
    axis: tuple[float, float, float] = (0.0, -1.0, 0.0),
    radius: float = 0.0035,
) -> bpy.types.Object:
    start = Vector(location)
    end = start + Vector(axis).normalized() * 0.0035
    return cylinder_between(
        name,
        start,
        end,
        radius,
        MATERIALS["polished_steel"],
        vertices=16,
        bevel=0.0004,
    )


def add_side_vents(prefix: str, x: float, y_start: float, z_start: float) -> None:
    for row in range(4):
        for column in range(5):
            y = y_start + column * 0.050
            z = z_start + row * 0.022
            rounded_box(
                f"{prefix}_{row + 1}_{column + 1}",
                (x, y, z),
                (0.004, 0.030, 0.007),
                MATERIALS["shadow_gray"],
                bevel=0.0025,
            )


def add_rear_vent_bank(prefix: str, z_start: float) -> None:
    for row in range(5):
        for column in range(8):
            rounded_box(
                f"{prefix}_{row + 1}_{column + 1}",
                (-0.175 + column * 0.050, 0.323, z_start + row * 0.019),
                (0.030, 0.004, 0.006),
                MATERIALS["shadow_gray"],
                bevel=0.002,
            )


def build_centrifuge() -> None:
    white = MATERIALS["warm_white"]
    gray = MATERIALS["light_gray"]
    shadow = MATERIALS["shadow_gray"]
    black = MATERIALS["black"]
    rubber = MATERIALS["rubber"]
    steel = MATERIALS["polished_steel"]
    aluminum = MATERIALS["aluminum"]

    # Four independent isolation feet and the lower mechanical plinth make the
    # asset credible even from bench height and from the rear.
    for prefix, x, y in (
        ("front_left", -0.240, -0.245),
        ("front_right", 0.240, -0.245),
        ("rear_left", -0.240, 0.245),
        ("rear_right", 0.240, 0.245),
    ):
        cylinder(f"{prefix}_rubber_foot", (x, y, 0.014), 0.027, 0.028, rubber, bevel=0.004)
        cylinder(f"{prefix}_mount", (x, y, 0.032), 0.017, 0.018, steel, bevel=0.002)

    rounded_box("Centrifuge lower plinth", (0.0, 0.015, 0.070), (0.555, 0.590, 0.085), shadow, bevel=0.026)
    rounded_box("Centrifuge main housing", (0.0, 0.010, 0.205), (0.575, 0.610, 0.285), white, bevel=0.042)
    rounded_box("Front lower bumper", (0.0, -0.303, 0.105), (0.500, 0.038, 0.085), gray, bevel=0.020)
    rounded_box("Lower bumper insert", (0.0, -0.326, 0.105), (0.425, 0.014, 0.048), black, bevel=0.014)

    # Lid, deep gasket line, inspection glass, and the visible rotor hub.
    rounded_box("Lid shadow recess", (0.0, -0.005, 0.344), (0.540, 0.540, 0.038), black, bevel=0.036)
    rounded_box("Insulated centrifuge lid", (0.0, -0.020, 0.378), (0.535, 0.525, 0.074), gray, bevel=0.038)
    rounded_rect_loop("Lid perimeter gasket", (0.0, -0.020, 0.417), 0.480, 0.465, 0.075, 0.0055, rubber)
    rounded_box("Lid inspection glass", (0.0, -0.030, 0.420), (0.300, 0.275, 0.010), MATERIALS["glass"], bevel=0.045)
    cylinder("Rotor bowl shadow", (0.0, -0.025, 0.350), 0.126, 0.014, shadow, vertices=72, bevel=0.003)
    cylinder("Rotor carrier", (0.0, -0.025, 0.363), 0.112, 0.025, aluminum, vertices=72, bevel=0.004)
    cylinder("Rotor hub", (0.0, -0.025, 0.382), 0.026, 0.030, steel, vertices=44, bevel=0.004)
    for index in range(8):
        angle = index * math.tau / 8.0
        x = math.cos(angle) * 0.075
        y = -0.025 + math.sin(angle) * 0.075
        cylinder(f"Rotor bucket {index + 1}", (x, y, 0.382), 0.018, 0.025, black, vertices=28, bevel=0.003)
        cylinder(f"Rotor tube cap {index + 1}", (x, y, 0.398), 0.011, 0.009, MATERIALS["blue"], vertices=24, bevel=0.002)

    # Hinges use a real cross-pin and separate leaves rather than a facade.
    for side, x in (("left", -0.190), ("right", 0.190)):
        rounded_box(f"{side}_lid_hinge_body", (x, 0.284, 0.350), (0.105, 0.062, 0.060), shadow, bevel=0.013)
        rounded_box(f"{side}_lid_hinge_leaf", (x, 0.252, 0.390), (0.105, 0.075, 0.028), steel, bevel=0.008)
        cylinder(f"{side}_lid_hinge_pin", (x, 0.304, 0.371), 0.015, 0.120, steel, rotation=(0.0, math.pi / 2.0, 0.0), bevel=0.002)
        cylinder(f"{side}_hinge_cap_outer", (x + (-0.062 if x < 0 else 0.062), 0.304, 0.371), 0.020, 0.012, black, rotation=(0.0, math.pi / 2.0, 0.0), bevel=0.003)

    # Sloped front controller panel and physical controls.
    panel_rotation = (math.radians(-8.0), 0.0, 0.0)
    rounded_box("Front controller fascia", (0.0, -0.318, 0.253), (0.480, 0.060, 0.145), gray, bevel=0.024, rotation=panel_rotation)
    rounded_box("Display bezel", (-0.095, -0.354, 0.275), (0.205, 0.017, 0.078), black, bevel=0.011, rotation=panel_rotation)
    rounded_box("Display glass", (-0.095, -0.365, 0.280), (0.168, 0.008, 0.050), MATERIALS["screen"], bevel=0.006, rotation=panel_rotation)
    for row, width in enumerate((0.120, 0.145, 0.085)):
        rounded_box(f"Display line {row + 1}", (-0.095, -0.371, 0.294 - row * 0.014), (width, 0.002, 0.004), MATERIALS["display"], bevel=0.001, rotation=panel_rotation)
    cylinder("Controller selection knob", (0.118, -0.365, 0.272), 0.034, 0.029, black, vertices=48, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.004)
    cylinder("Controller knob ring", (0.118, -0.382, 0.272), 0.025, 0.009, aluminum, vertices=48, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.001)
    for index, (x, material) in enumerate(((-0.208, MATERIALS["green"]), (0.206, MATERIALS["blue"]), (0.205, MATERIALS["red"]))):
        z = 0.228 if index != 2 else 0.292
        cylinder(f"Control button {index + 1}", (x, -0.363, z), 0.014, 0.013, material, vertices=30, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.002)
    rounded_box("Lid release recess", (0.0, -0.343, 0.347), (0.160, 0.024, 0.032), black, bevel=0.012)
    rounded_box("Lid release paddle", (0.0, -0.358, 0.350), (0.105, 0.018, 0.019), steel, bevel=0.007)

    # Laboratory badge and warning stock are deliberately original and generic.
    rounded_box("Front identity badge", (-0.184, -0.350, 0.178), (0.122, 0.008, 0.040), MATERIALS["blue"], bevel=0.006)
    text_mesh("Front identity text", "LABSPACE", (-0.184, -0.356, 0.178), 0.018, MATERIALS["paper"])
    rounded_box("Lid warning label", (0.168, -0.070, 0.428), (0.105, 0.070, 0.004), MATERIALS["paper"], bevel=0.004)
    for row, width in enumerate((0.075, 0.084, 0.060)):
        rounded_box(f"Lid warning print {row + 1}", (0.168, -0.089 + row * 0.014, 0.431), (width, 0.004, 0.002), MATERIALS["label"], bevel=0.0005)

    # Perforated cooling on both sides plus a full rear service face.
    add_side_vents("left_side_vent", -0.291, -0.120, 0.105)
    add_side_vents("right_side_vent", 0.291, -0.120, 0.105)
    rounded_box("Left service seam", (-0.292, 0.090, 0.205), (0.005, 0.350, 0.205), gray, bevel=0.002)
    rounded_box("Right service seam", (0.292, 0.090, 0.205), (0.005, 0.350, 0.205), gray, bevel=0.002)
    rounded_box("Rear service panel", (0.0, 0.315, 0.190), (0.465, 0.020, 0.210), gray, bevel=0.010)
    add_rear_vent_bank("rear_motor_vent", 0.215)
    rounded_box("Rear mains inlet", (-0.165, 0.331, 0.105), (0.095, 0.020, 0.070), black, bevel=0.008)
    rounded_box("Rear rocker switch", (-0.220, 0.345, 0.105), (0.028, 0.012, 0.032), MATERIALS["red"], bevel=0.004)
    cylinder("Rear service port", (0.164, 0.339, 0.106), 0.021, 0.020, steel, vertices=30, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.003)
    cylinder("Rear service cap", (0.164, 0.355, 0.106), 0.025, 0.013, MATERIALS["blue"], vertices=30, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.003)
    for x in (-0.220, 0.220):
        for z in (0.100, 0.265):
            fastener(f"Rear panel fastener {x:.2f} {z:.2f}", (x, 0.330, z), axis=(0.0, 1.0, 0.0))
    torus("Rear fan grille outer", (0.055, 0.341, 0.120), 0.042, 0.004, steel, axis=(0.0, 1.0, 0.0), major_segments=40)
    torus("Rear fan grille inner", (0.055, 0.344, 0.120), 0.025, 0.003, steel, axis=(0.0, 1.0, 0.0), major_segments=36)
    for index in range(6):
        angle = index * math.tau / 6.0
        end = (0.055 + math.cos(angle) * 0.039, 0.348, 0.120 + math.sin(angle) * 0.039)
        cylinder_between(f"Rear fan spoke {index + 1}", (0.055, 0.348, 0.120), end, 0.0024, steel, vertices=12)

    # A modeled strain relief, coiled mains lead, and plug complete the rear.
    cylinder("Power strain relief", (-0.165, 0.347, 0.080), 0.014, 0.030, rubber, vertices=28, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.003)
    curve_tube(
        "Rear mains cable",
        [
            (-0.165, 0.360, 0.080),
            (-0.250, 0.385, 0.065),
            (-0.180, 0.420, 0.045),
            (-0.035, 0.375, 0.035),
            (0.085, 0.345, 0.038),
        ],
        0.007,
        rubber,
    )
    rounded_box("Centrifuge mains plug", (0.115, 0.325, 0.038), (0.070, 0.040, 0.050), black, bevel=0.009)
    cylinder_between("Mains plug pin left", (0.095, 0.300, 0.030), (0.095, 0.275, 0.030), 0.0032, steel, vertices=12)
    cylinder_between("Mains plug pin right", (0.130, 0.300, 0.030), (0.130, 0.275, 0.030), 0.0032, steel, vertices=12)


def add_focus_knob(side: str, x: float) -> None:
    sign = -1.0 if x < 0.0 else 1.0
    cylinder(f"{side}_focus_axle", (x, 0.085, 0.294), 0.016, 0.050, MATERIALS["polished_steel"], rotation=(0.0, math.pi / 2.0, 0.0), bevel=0.002)
    cylinder(f"{side}_coarse_focus", (x + sign * 0.032, 0.085, 0.294), 0.041, 0.030, MATERIALS["black"], vertices=56, rotation=(0.0, math.pi / 2.0, 0.0), bevel=0.005)
    cylinder(f"{side}_fine_focus", (x + sign * 0.051, 0.085, 0.294), 0.025, 0.016, MATERIALS["light_gray"], vertices=48, rotation=(0.0, math.pi / 2.0, 0.0), bevel=0.003)
    for ring in (-0.008, 0.008):
        torus(f"{side}_focus_grip_ring_{ring:+.3f}", (x + sign * 0.035, 0.085, 0.294), 0.038 + ring * 0.05, 0.0025, MATERIALS["rubber"], axis=(1.0, 0.0, 0.0), major_segments=44)


def build_microscope() -> None:
    white = MATERIALS["warm_white"]
    gray = MATERIALS["light_gray"]
    shadow = MATERIALS["shadow_gray"]
    black = MATERIALS["black"]
    rubber = MATERIALS["rubber"]
    steel = MATERIALS["polished_steel"]
    aluminum = MATERIALS["aluminum"]

    # Weighted cast base, bottom feet, and a top lamp deck.
    for prefix, x, y in (
        ("front_left", -0.105, -0.145),
        ("front_right", 0.105, -0.145),
        ("rear_left", -0.105, 0.135),
        ("rear_right", 0.105, 0.135),
    ):
        cylinder(f"{prefix}_microscope_foot", (x, y, 0.008), 0.018, 0.016, rubber, vertices=28, bevel=0.003)
    rounded_box("Microscope weighted base", (0.0, 0.008, 0.050), (0.275, 0.370, 0.090), white, bevel=0.035)
    rounded_box("Base lower shadow line", (0.0, 0.012, 0.021), (0.250, 0.340, 0.030), shadow, bevel=0.016)
    rounded_box("Base front nose", (0.0, -0.174, 0.073), (0.215, 0.055, 0.070), gray, bevel=0.022)
    sphere("Illuminator dome", (0.0, -0.035, 0.094), (0.065, 0.065, 0.023), gray, segments=48, rings=20)
    cylinder("Illuminator collector", (0.0, -0.035, 0.108), 0.044, 0.014, aluminum, vertices=52, bevel=0.003)
    cylinder("Illuminator field lens", (0.0, -0.035, 0.117), 0.037, 0.009, MATERIALS["optical_glass"], vertices=52, bevel=0.002)

    # Cast rear column and curved arm are solid three-dimensional construction.
    rounded_box("Rear cast column", (0.0, 0.118, 0.235), (0.145, 0.115, 0.295), white, bevel=0.040, rotation=(math.radians(-4.0), 0.0, 0.0))
    arm = curve_tube(
        "Curved optical stand arm",
        [
            (0.0, 0.120, 0.195),
            (0.0, 0.135, 0.325),
            (0.0, 0.085, 0.407),
            (0.0, -0.015, 0.430),
        ],
        0.052,
        white,
        bevel_resolution=4,
    )
    arm.scale.x = 1.22
    rounded_box("Arm rear service spine", (0.0, 0.178, 0.258), (0.082, 0.036, 0.205), gray, bevel=0.015)
    rounded_box("Head support bridge", (0.0, -0.010, 0.397), (0.155, 0.150, 0.080), white, bevel=0.030, rotation=(math.radians(-8.0), 0.0, 0.0))

    # Trinocular-style binocular head, paired optical tubes, and rubber eye cups.
    sphere("Binocular head casting", (0.0, -0.060, 0.405), (0.090, 0.082, 0.055), gray, segments=56, rings=28)
    rounded_box("Head front optical plate", (0.0, -0.120, 0.416), (0.145, 0.055, 0.056), shadow, bevel=0.018, rotation=(math.radians(-12.0), 0.0, 0.0))
    for side, x in (("left", -0.043), ("right", 0.043)):
        start = (x, -0.115, 0.420)
        end = (x * 1.18, -0.205, 0.470)
        cylinder_between(f"{side}_eyepiece_tube", start, end, 0.021, aluminum, vertices=44, bevel=0.003)
        mid = Vector(end) + (Vector(end) - Vector(start)).normalized() * 0.010
        tip = Vector(end) + (Vector(end) - Vector(start)).normalized() * 0.035
        cylinder_between(f"{side}_eyepiece_barrel", mid, tip, 0.024, black, vertices=44, bevel=0.004)
        cup_end = tip + (Vector(end) - Vector(start)).normalized() * 0.018
        cylinder_between(f"{side}_rubber_eye_cup", tip, cup_end, 0.030, rubber, vertices=44, bevel=0.006)
        cylinder_between(f"{side}_ocular_lens", cup_end, cup_end + (Vector(end) - Vector(start)).normalized() * 0.004, 0.019, MATERIALS["optical_glass"], vertices=44, bevel=0.001)
    cylinder("Interpupillary hinge", (0.0, -0.111, 0.420), 0.018, 0.115, steel, rotation=(0.0, math.pi / 2.0, 0.0), bevel=0.003)

    # Nosepiece, four objectives, colored magnification bands, and front lens.
    cylinder("Optical neck", (0.0, -0.064, 0.354), 0.045, 0.070, shadow, vertices=56, bevel=0.006)
    cylinder("Revolving objective turret", (0.0, -0.064, 0.325), 0.067, 0.035, aluminum, vertices=64, bevel=0.006)
    cylinder("Turret lower shadow", (0.0, -0.064, 0.306), 0.060, 0.015, black, vertices=64, bevel=0.003)
    objective_specs = (
        ("4x", -0.046, -0.064, MATERIALS["red"]),
        ("10x", 0.000, -0.105, MATERIALS["amber"]),
        ("40x", 0.046, -0.064, MATERIALS["blue"]),
        ("100x", 0.000, -0.022, MATERIALS["green"]),
    )
    for label, x, y, band_material in objective_specs:
        radial = Vector((x, y + 0.064, 0.0))
        if radial.length < 0.001:
            radial = Vector((0.0, -1.0, 0.0))
        radial.normalize()
        start = Vector((x * 0.72, -0.064 + (y + 0.064) * 0.72, 0.313))
        end = Vector((x * 1.04, -0.064 + (y + 0.064) * 1.04, 0.248))
        cylinder_between(f"{label}_objective_upper", start, start.lerp(end, 0.38), 0.0135, steel, vertices=36, bevel=0.002)
        cylinder_between(f"{label}_objective_body", start.lerp(end, 0.34), start.lerp(end, 0.82), 0.0175, MATERIALS["brass"], vertices=40, bevel=0.002)
        cylinder_between(f"{label}_objective_color_band", start.lerp(end, 0.60), start.lerp(end, 0.70), 0.0186, band_material, vertices=40, bevel=0.001)
        cylinder_between(f"{label}_objective_tip", start.lerp(end, 0.79), end, 0.012, black, vertices=36, bevel=0.002)
        tip_vector = (end - start).normalized()
        cylinder_between(f"{label}_front_lens", end, end + tip_vector * 0.004, 0.009, MATERIALS["optical_glass"], vertices=36, bevel=0.001)

    # Mechanical stage has separate rails, specimen holder, aperture, and controls.
    rounded_box("Stage support bracket", (0.0, 0.052, 0.236), (0.150, 0.105, 0.035), white, bevel=0.015)
    rounded_box("Mechanical stage plate", (0.0, -0.035, 0.244), (0.205, 0.185, 0.018), black, bevel=0.009)
    rounded_box("Stage left rail", (-0.093, -0.035, 0.255), (0.014, 0.160, 0.016), aluminum, bevel=0.004)
    rounded_box("Stage rear rail", (0.0, 0.045, 0.255), (0.182, 0.014, 0.016), aluminum, bevel=0.004)
    torus("Stage aperture rim", (0.0, -0.035, 0.255), 0.027, 0.004, steel, major_segments=44)
    cylinder("Stage aperture darkness", (0.0, -0.035, 0.253), 0.023, 0.008, shadow, vertices=44)
    rounded_box("Glass microscope slide", (0.015, -0.043, 0.260), (0.078, 0.026, 0.003), MATERIALS["glass"], bevel=0.002)
    rounded_box("Slide label", (0.047, -0.043, 0.263), (0.022, 0.022, 0.002), MATERIALS["paper"], bevel=0.001)
    rounded_box("Slide spring arm", (-0.018, -0.054, 0.267), (0.080, 0.008, 0.005), steel, bevel=0.002, rotation=(0.0, 0.0, math.radians(4.0)))
    cylinder("Slide spring pivot", (-0.055, -0.052, 0.267), 0.006, 0.010, steel, vertices=24, bevel=0.001)
    rounded_box("Stage vernier scale", (0.065, 0.052, 0.267), (0.060, 0.005, 0.018), MATERIALS["paper"], bevel=0.002)
    for index in range(8):
        rounded_box(f"Stage vernier tick {index + 1}", (0.042 + index * 0.007, 0.048, 0.268), (0.002, 0.003, 0.009 if index % 2 == 0 else 0.006), MATERIALS["label"], bevel=0.0004)

    for control, start, end, radius in (
        ("stage_x", (0.102, 0.020, 0.235), (0.148, 0.042, 0.215), 0.011),
        ("stage_y", (0.102, 0.006, 0.225), (0.142, 0.020, 0.190), 0.010),
    ):
        cylinder_between(f"{control}_shaft", start, end, 0.006, steel, vertices=24, bevel=0.001)
        direction = (Vector(end) - Vector(start)).normalized()
        cylinder_between(f"{control}_knob", Vector(end), Vector(end) + direction * 0.022, radius, black, vertices=36, bevel=0.003)

    # Condenser/iris stack and rack beneath the stage.
    cylinder("Condenser carrier", (0.0, -0.035, 0.205), 0.040, 0.040, shadow, vertices=48, bevel=0.004)
    cylinder("Abbe condenser", (0.0, -0.035, 0.184), 0.032, 0.050, aluminum, vertices=52, bevel=0.004)
    cylinder("Condenser top lens", (0.0, -0.035, 0.212), 0.024, 0.009, MATERIALS["optical_glass"], vertices=44, bevel=0.002)
    torus("Iris diaphragm ring", (0.0, -0.035, 0.172), 0.029, 0.004, black, major_segments=44)
    cylinder_between("Iris lever", (0.025, -0.035, 0.172), (0.060, -0.060, 0.168), 0.0035, steel, vertices=18, bevel=0.001)
    cylinder("Iris lever tip", (0.060, -0.060, 0.168), 0.006, 0.010, black, vertices=24, rotation=(0.0, math.pi / 2.0, 0.0), bevel=0.002)
    rounded_box("Condenser rack", (0.0, 0.035, 0.177), (0.024, 0.018, 0.096), steel, bevel=0.005)

    # Coaxial focus knobs on both sides and a tension collar.
    add_focus_knob("left", -0.075)
    add_focus_knob("right", 0.075)
    torus("Focus tension collar", (0.0, 0.085, 0.294), 0.029, 0.005, aluminum, axis=(1.0, 0.0, 0.0), major_segments=44)

    # Front illumination controls and original identity graphics.
    cylinder("Brightness control", (-0.065, -0.190, 0.073), 0.020, 0.018, black, vertices=40, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.004)
    cylinder("Brightness silver ring", (-0.065, -0.201, 0.073), 0.024, 0.007, aluminum, vertices=40, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.002)
    cylinder("Power status lamp", (0.066, -0.201, 0.073), 0.008, 0.007, MATERIALS["green"], vertices=24, rotation=(math.pi / 2.0, 0.0, 0.0))
    rounded_box("Microscope identity badge", (0.0, -0.205, 0.118), (0.110, 0.006, 0.029), MATERIALS["blue"], bevel=0.004)
    text_mesh("Microscope identity text", "LABSPACE OPTICS", (0.0, -0.210, 0.118), 0.010, MATERIALS["paper"])

    # Side carry grip, rear electronics, strain relief, lead, and plug.
    rounded_box("Rear carry grip recess", (0.0, 0.179, 0.330), (0.078, 0.015, 0.073), black, bevel=0.015)
    rounded_box("Rear carry grip", (0.0, 0.193, 0.330), (0.060, 0.018, 0.045), steel, bevel=0.012)
    rounded_box("Rear electrical service plate", (0.0, 0.194, 0.102), (0.125, 0.016, 0.090), gray, bevel=0.009)
    rounded_box("Rear IEC inlet", (-0.035, 0.206, 0.095), (0.050, 0.013, 0.040), black, bevel=0.006)
    rounded_box("Rear rocker switch", (0.040, 0.207, 0.095), (0.030, 0.012, 0.034), MATERIALS["red"], bevel=0.004)
    cylinder("Rear strain relief", (-0.035, 0.215, 0.075), 0.009, 0.024, rubber, vertices=24, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.002)
    for x in (-0.052, 0.052):
        for z in (0.075, 0.132):
            fastener(f"Microscope rear fastener {x:.2f} {z:.2f}", (x, 0.206, z), axis=(0.0, 1.0, 0.0), radius=0.0026)
    curve_tube(
        "Microscope mains cable",
        [
            (-0.035, 0.220, 0.075),
            (-0.095, 0.225, 0.055),
            (-0.125, 0.180, 0.032),
            (-0.025, 0.145, 0.024),
            (0.075, 0.175, 0.030),
        ],
        0.005,
        rubber,
    )
    rounded_box("Microscope mains plug", (0.100, 0.175, 0.030), (0.050, 0.034, 0.040), black, bevel=0.007)
    cylinder_between("Microscope plug pin left", (0.087, 0.154, 0.024), (0.087, 0.132, 0.024), 0.0025, steel, vertices=12)
    cylinder_between("Microscope plug pin right", (0.112, 0.154, 0.024), (0.112, 0.132, 0.024), 0.0025, steel, vertices=12)


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
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import reference_finishes
    reference_finishes.apply(sys.modules[__name__])
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
        safe_name = "".join(
            character if character.isalnum() else "_" for character in material_name
        )
        active.name = f"Runtime_{safe_name}"
        active.data.name = f"Runtime_{safe_name}_mesh"
        active.select_set(False)
    bpy.context.view_layer.objects.active = None
    bpy.context.view_layer.update()


def mesh_bounds() -> tuple[Vector, Vector]:
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    points = [
        obj.matrix_world @ Vector(corner)
        for obj in meshes
        for corner in obj.bound_box
    ]
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
    ROOT.location += Vector(
        (-(minimum.x + maximum.x) * 0.5, -(minimum.y + maximum.y) * 0.5, -minimum.z)
    )
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


def scene_statistics(asset_id: str, bounds: dict[str, list[float]]) -> dict[str, object]:
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    materials = {
        slot.material.name
        for obj in meshes
        for slot in obj.material_slots
        if slot.material is not None
    }
    return {
        "asset": asset_id,
        "mesh_objects": len(meshes),
        "materials": len(materials),
        "cameras": len([obj for obj in bpy.context.scene.objects if obj.type == "CAMERA"]),
        "lights": len([obj for obj in bpy.context.scene.objects if obj.type == "LIGHT"]),
        "vertices": sum(len(obj.data.vertices) for obj in meshes),
        "triangles": sum(triangle_count(obj.data) for obj in meshes),
        "bounds_m": bounds,
    }


def validate_scene(asset_id: str, stats: dict[str, object]) -> None:
    target = Vector(ASSETS[asset_id]["dimensions"])
    dimensions = Vector(stats["bounds_m"]["dimensions"])
    minimum = Vector(stats["bounds_m"]["min"])
    maximum = Vector(stats["bounds_m"]["max"])
    errors: list[str] = []
    for axis, actual, expected in zip("xyz", dimensions, target):
        if abs(actual - expected) > 0.002:
            errors.append(f"{axis} dimension {actual:.4f} m != {expected:.4f} m")
    if abs(minimum.z) > 0.001:
        errors.append(f"minimum z {minimum.z:.5f} m is not grounded")
    if abs(minimum.x + maximum.x) > 0.002 or abs(minimum.y + maximum.y) > 0.002:
        errors.append("footprint is not centered on x/y")
    if not 10 <= int(stats["mesh_objects"]) <= 25:
        errors.append(f"runtime mesh count {stats['mesh_objects']} is outside 10-25")
    if int(stats["materials"]) < 10:
        errors.append(f"only {stats['materials']} materials")
    if not 12_000 <= int(stats["triangles"]) <= 180_000:
        errors.append(f"triangle count {stats['triangles']} is outside 12k-180k")
    if int(stats["cameras"]) or int(stats["lights"]):
        errors.append("authoring scene contains a camera or light before export")
    if errors:
        raise RuntimeError(
            f"{asset_id} authored-scene validation failed: {'; '.join(errors)}"
        )


def export_glb(output_path: Path, *, draco: bool) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result = bpy.ops.export_scene.gltf(
        filepath=str(output_path.resolve()),
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
    if "FINISHED" not in result:
        raise RuntimeError(f"GLB export failed: {result}")


def render_imported_preview(asset_id: str, preview_dir: Path) -> list[Path]:
    """Render only after GLB re-import; QA lights never enter the delivered file."""
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 760
    scene.render.resolution_y = 760
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.055, 0.065, 0.078)

    ground = make_material("QA studio floor", (0.14, 0.16, 0.18, 1.0), roughness=0.64)
    rounded_box("QA ground", (0.0, 0.0, -0.018), (3.0, 3.0, 0.030), ground, bevel=0.009)
    width, depth, height = ASSETS[asset_id]["dimensions"]
    target = Vector((0.0, 0.0, height * 0.47))
    distance = max(width, depth) * 2.60
    camera_height = height * 1.35 + 0.18

    bpy.ops.object.camera_add(location=(distance * 0.78, -distance, camera_height))
    camera = bpy.context.object
    camera.name = "QA camera"
    camera.data.lens = 62
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera

    for name, location, energy, size, color in (
        ("QA key", (-1.2, -1.3, 1.8), 830.0, 1.45, (1.0, 0.93, 0.84)),
        ("QA fill", (1.35, -0.25, 1.15), 560.0, 1.10, (0.78, 0.88, 1.0)),
        ("QA rim", (-0.25, 1.15, 1.55), 700.0, 0.90, (0.72, 0.82, 1.0)),
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
    outputs: list[Path] = []
    for view, location in (
        ("front", (distance * 0.78, -distance, camera_height)),
        ("rear", (-distance * 0.78, distance, camera_height * 0.96)),
    ):
        camera.location = location
        camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
        output = (preview_dir / f"{asset_id}-{view}-blender-qa.png").resolve()
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        outputs.append(output)
    return outputs


def inspect_export(asset_id: str, path: Path, preview_dir: Path | None) -> dict[str, object]:
    target = Vector(ASSETS[asset_id]["dimensions"])
    reset_scene(asset_id)
    result = bpy.ops.import_scene.gltf(filepath=str(path.resolve()))
    if "FINISHED" not in result:
        raise RuntimeError(f"Could not import generated GLB: {path}")
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
    cameras = [obj for obj in bpy.context.scene.objects if obj.type == "CAMERA"]
    lights = [obj for obj in bpy.context.scene.objects if obj.type == "LIGHT"]
    triangles = sum(triangle_count(obj.data) for obj in meshes)
    errors: list[str] = []
    for axis, actual, expected in zip("xyz", dimensions, target):
        if abs(actual - expected) > 0.006:
            errors.append(f"{axis} dimension {actual:.4f} m != {expected:.4f} m")
    if abs(minimum.z) > 0.004:
        errors.append(f"minimum z {minimum.z:.5f} m is not grounded")
    if abs(minimum.x + maximum.x) > 0.006 or abs(minimum.y + maximum.y) > 0.006:
        errors.append("imported footprint is not centered on x/y")
    if not 10 <= len(meshes) <= 25:
        errors.append(f"imported runtime mesh count {len(meshes)} is outside 10-25")
    if len(materials) < 10:
        errors.append(f"only {len(materials)} imported materials")
    if not 12_000 <= triangles <= 180_000:
        errors.append(f"imported triangle count {triangles} is outside 12k-180k")
    if cameras or lights:
        errors.append("GLB unexpectedly contains cameras or lights")
    if path.stat().st_size < 100_000:
        errors.append("GLB is unexpectedly smaller than 100 KB")
    if path.stat().st_size > 12 * 1024 * 1024:
        errors.append("GLB exceeds the 12 MB runtime budget")

    report = {
        "asset": asset_id,
        "file": str(path.resolve()),
        "bytes": path.stat().st_size,
        "mesh_objects": len(meshes),
        "materials": len(materials),
        "cameras": len(cameras),
        "lights": len(lights),
        "vertices": sum(len(obj.data.vertices) for obj in meshes),
        "triangles": triangles,
        "bounds_m": {
            "min": [round(value, 6) for value in minimum],
            "max": [round(value, 6) for value in maximum],
            "dimensions": [round(value, 6) for value in dimensions],
        },
        "errors": errors,
    }
    if errors:
        raise RuntimeError(
            f"{asset_id} exported-GLB validation failed: {'; '.join(errors)}"
        )
    if preview_dir is not None:
        report["previews"] = [
            str(output) for output in render_imported_preview(asset_id, preview_dir)
        ]
    return report


def build_one(
    asset_id: str,
    output_dir: Path,
    *,
    draco: bool,
    save_blend_dir: Path | None,
    preview_dir: Path | None,
) -> dict[str, object]:
    reset_scene(asset_id)
    build_materials()
    create_root(asset_id)
    if asset_id == "benchtop-centrifuge":
        build_centrifuge()
    else:
        build_microscope()
    bounds = fit_to_dimensions(ASSETS[asset_id]["dimensions"])
    stats = scene_statistics(asset_id, bounds)
    validate_scene(asset_id, stats)
    if save_blend_dir is not None:
        save_blend_dir.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(
            filepath=str((save_blend_dir / f"{asset_id}.blend").resolve())
        )
    output_path = output_dir / ASSETS[asset_id]["filename"]
    export_glb(output_path, draco=draco)
    report = inspect_export(asset_id, output_path, preview_dir)
    print("LABSPACE_GLTF_INSPECT " + json.dumps(report, sort_keys=True))
    return report


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    save_blend_dir = Path(args.save_blend_dir) if args.save_blend_dir else None
    preview_dir = Path(args.preview_dir) if args.preview_dir else None
    selected = tuple(ASSETS) if args.asset == "all" else (args.asset,)
    reports = [
        build_one(
            asset_id,
            output_dir,
            draco=args.draco,
            save_blend_dir=save_blend_dir,
            preview_dir=preview_dir,
        )
        for asset_id in selected
    ]
    print("LABSPACE_INSTRUMENTS_COMPLETE " + json.dumps(reports, sort_keys=True))


if __name__ == "__main__":
    main()
