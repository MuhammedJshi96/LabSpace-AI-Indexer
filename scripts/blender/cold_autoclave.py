"""Author the LabSpace ultra-low freezer and top-loading autoclave hero GLBs.

The assets are original, dimension-driven planning models.  Their construction
is informed by Kyushu University Room 809 photographs and the common anatomy of
PHCbi VIP ECO ultra-low freezers and Yamato SQ-series top-loading autoclaves,
but the geometry is not a manufacturer-certified replica.

Run with Blender 4.5 LTS from the repository root::

    .tools/blender-4.5.11-windows-x64/blender.exe --background \
      --factory-startup --python scripts/blender/cold_autoclave.py
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
    "ultra-low-freezer": {
        "filename": "ultra-low-freezer.glb",
        "dimensions": (0.95, 0.90, 2.00),
        "reference": "Room 809 PHCbi cabinet; PHCbi VIP ECO ULT construction",
    },
    "autoclave": {
        "filename": "autoclave.glb",
        "dimensions": (0.80, 0.90, 1.50),
        "reference": "Room 809 top-loading sterilizer; Yamato SQ-series anatomy",
    },
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        default="public/models/hero",
        help="Destination directory for the two GLB files.",
    )
    parser.add_argument(
        "--asset",
        choices=("all", *ASSETS.keys()),
        default="all",
        help="Build both assets or only one named asset.",
    )
    parser.add_argument(
        "--draco",
        action="store_true",
        help="Opt in to Draco compression. Offline LabSpace builds leave this disabled.",
    )
    parser.add_argument(
        "--save-blend-dir",
        default="",
        help="Optional directory for editable .blend snapshots.",
    )
    parser.add_argument(
        "--preview-dir",
        default="",
        help="Optional directory for square studio QA renders made after GLB import.",
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
    scene.world.color = (0.025, 0.03, 0.04)
    scene["asset_id"] = asset_id
    scene["authoring_units"] = "meters"
    scene["design_reference"] = ASSETS[asset_id]["reference"]
    scene["planning_model"] = True


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
        try:
            material.use_screen_refraction = True
        except AttributeError:
            pass
    material["pbr_role"] = name
    return material


def build_materials() -> None:
    global MATERIALS
    MATERIALS = {
        "warm_white": make_material(
            "Powder-coated warm white", (0.84, 0.86, 0.84, 1.0), roughness=0.28, coat=0.16
        ),
        "light_gray": make_material(
            "Powder-coated light gray", (0.57, 0.60, 0.60, 1.0), roughness=0.31, coat=0.10
        ),
        "shadow_gray": make_material(
            "Powder-coated shadow gray", (0.18, 0.21, 0.22, 1.0), metallic=0.08, roughness=0.31
        ),
        "stainless": make_material(
            "Brushed stainless steel", (0.60, 0.64, 0.66, 1.0), metallic=0.96, roughness=0.19, anisotropy=0.72
        ),
        "polished_steel": make_material(
            "Polished stainless hardware", (0.74, 0.78, 0.80, 1.0), metallic=1.0, roughness=0.11, coat=0.18
        ),
        "aluminum": make_material(
            "Satin anodized aluminum", (0.51, 0.55, 0.57, 1.0), metallic=0.88, roughness=0.24, anisotropy=0.34
        ),
        "black": make_material(
            "Black engineering polymer", (0.012, 0.018, 0.021, 1.0), roughness=0.32, coat=0.10
        ),
        "rubber": make_material(
            "Black EPDM rubber", (0.008, 0.011, 0.012, 1.0), roughness=0.78
        ),
        "screen": make_material(
            "Controller glass", (0.005, 0.018, 0.024, 1.0), roughness=0.09, coat=0.48
        ),
        "display": make_material(
            "Cyan display pixels", (0.01, 0.56, 0.74, 1.0), roughness=0.14,
            emission=(0.01, 0.55, 0.78, 1.0), emission_strength=3.0,
        ),
        "blue": make_material(
            "Deep laboratory blue", (0.025, 0.18, 0.47, 1.0), roughness=0.24, coat=0.28
        ),
        "aqua": make_material(
            "Sterilizer aqua accent", (0.02, 0.52, 0.56, 1.0), roughness=0.25, coat=0.22
        ),
        "green": make_material(
            "Status green", (0.02, 0.48, 0.15, 1.0), roughness=0.22,
            emission=(0.01, 0.42, 0.10, 1.0), emission_strength=1.5,
        ),
        "red": make_material(
            "Safety red", (0.65, 0.025, 0.018, 1.0), roughness=0.27, coat=0.20
        ),
        "amber": make_material(
            "Warning amber", (0.93, 0.49, 0.025, 1.0), roughness=0.32, coat=0.12
        ),
        "label": make_material(
            "Printed graphite", (0.045, 0.052, 0.055, 1.0), roughness=0.49
        ),
        "paper": make_material(
            "Safety label stock", (0.88, 0.88, 0.80, 1.0), roughness=0.72
        ),
        "clear_hose": make_material(
            "Translucent reinforced hose", (0.72, 0.84, 0.82, 0.58), roughness=0.22,
            transmission=0.42, ior=1.42,
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
        mod = obj.modifiers.new(name="Soft product edge", type="BEVEL")
        mod.width = min(bevel, min(dimensions) * 0.22)
        mod.segments = 3
        mod.limit_method = "ANGLE"
        mod.harden_normals = True
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
        mod = obj.modifiers.new(name="Rounded cylinder edge", type="BEVEL")
        mod.width = min(bevel, radius * 0.25, depth * 0.20)
        mod.segments = 2
        mod.harden_normals = True
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
    obj.rotation_quaternion = Vector((0.0, 0.0, 1.0)).rotation_difference(direction.normalized())
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
    obj.rotation_quaternion = Vector((0.0, 0.0, 1.0)).rotation_difference(Vector(axis).normalized())
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
    bpy.context.object.name = name
    return bpy.context.object


def fastener(
    name: str,
    location: tuple[float, float, float],
    *,
    axis: tuple[float, float, float] = (0.0, -1.0, 0.0),
    radius: float = 0.004,
) -> bpy.types.Object:
    start = Vector(location)
    end = start + Vector(axis).normalized() * 0.0035
    return cylinder_between(name, start, end, radius, MATERIALS["polished_steel"], vertices=18, bevel=0.0005)


def add_vent_bank(
    prefix: str,
    *,
    center: tuple[float, float, float],
    span: float,
    count: int,
    vertical: bool,
    plane: str = "front",
) -> None:
    cx, cy, cz = center
    for index in range(count):
        offset = (index - (count - 1) / 2.0) * span / max(count - 1, 1)
        if plane == "front":
            location = (cx + (0.0 if vertical else offset), cy, cz + (offset if vertical else 0.0))
            dimensions = (0.012 if vertical else 0.035, 0.005, 0.045 if vertical else 0.009)
        elif plane == "side":
            location = (cx, cy + (0.0 if vertical else offset), cz + (offset if vertical else 0.0))
            dimensions = (0.005, 0.035 if not vertical else 0.012, 0.009 if not vertical else 0.045)
        else:
            location = (cx + offset, cy, cz)
            dimensions = (0.032, 0.010, 0.005)
        rounded_box(f"{prefix}_{index + 1:02d}", location, dimensions, MATERIALS["shadow_gray"], bevel=0.002)


def add_caster(prefix: str, x: float, y: float, *, wheel_radius: float = 0.050) -> None:
    steel = MATERIALS["polished_steel"]
    rubber = MATERIALS["rubber"]
    cylinder(f"{prefix}_swivel", (x, y, 0.105), 0.027, 0.027, steel, bevel=0.003)
    cylinder(f"{prefix}_stem", (x, y, 0.132), 0.013, 0.045, steel, bevel=0.002)
    rounded_box(f"{prefix}_fork_left", (x - 0.032, y, 0.062), (0.012, 0.075, 0.078), steel, bevel=0.004)
    rounded_box(f"{prefix}_fork_right", (x + 0.032, y, 0.062), (0.012, 0.075, 0.078), steel, bevel=0.004)
    cylinder(
        f"{prefix}_wheel", (x, y, wheel_radius), wheel_radius, 0.050, rubber,
        vertices=36, rotation=(0.0, math.pi / 2.0, 0.0), bevel=0.004,
    )
    cylinder(
        f"{prefix}_hub", (x, y, wheel_radius), 0.014, 0.058, steel,
        vertices=24, rotation=(0.0, math.pi / 2.0, 0.0), bevel=0.001,
    )
    if "front" in prefix:
        rounded_box(f"{prefix}_brake", (x + 0.046, y - 0.015, 0.092), (0.054, 0.025, 0.012), MATERIALS["red"], bevel=0.004)


def add_leveling_foot(prefix: str, x: float, y: float) -> None:
    cylinder(f"{prefix}_thread", (x, y, 0.055), 0.010, 0.075, MATERIALS["polished_steel"], bevel=0.001)
    cylinder(f"{prefix}_pad", (x, y, 0.019), 0.037, 0.018, MATERIALS["rubber"], bevel=0.004)


def build_freezer() -> None:
    white = MATERIALS["warm_white"]
    gray = MATERIALS["light_gray"]
    shadow = MATERIALS["shadow_gray"]
    steel = MATERIALS["polished_steel"]
    rubber = MATERIALS["rubber"]
    black = MATERIALS["black"]

    # Insulated cabinet and recessed plinth.
    rounded_box("Insulated cabinet shell", (0.0, 0.025, 1.055), (0.855, 0.770, 1.750), white, bevel=0.028)
    rounded_box("Compressor plinth", (0.0, 0.055, 0.205), (0.795, 0.700, 0.160), shadow, bevel=0.022)
    rounded_box("Top cap", (0.0, 0.025, 1.934), (0.840, 0.754, 0.050), white, bevel=0.016)
    rounded_box("Rear compressor cover", (0.0, 0.411, 0.420), (0.740, 0.035, 0.430), gray, bevel=0.010)

    # The thick outer door, shadow gap, double gasket and thermal-break frame.
    rounded_box("Door shadow recess", (0.0, -0.377, 1.115), (0.788, 0.025, 1.550), black, bevel=0.020)
    rounded_box("Outer insulated door", (0.0, -0.417, 1.115), (0.775, 0.070, 1.525), gray, bevel=0.024)
    for name, width, height, y in (
        ("Outer magnetic gasket", 0.728, 1.465, -0.454),
        ("Inner thermal gasket", 0.690, 1.425, -0.459),
    ):
        xspan, zspan = width * 0.5, height * 0.5
        for side, x in (("left", -xspan), ("right", xspan)):
            rounded_box(f"{name} {side}", (x, y, 1.115), (0.014, 0.010, height), rubber, bevel=0.005)
        for side, z in (("top", 1.115 + zspan), ("bottom", 1.115 - zspan)):
            rounded_box(f"{name} {side}", (0.0, y, z), (width, 0.010, 0.014), rubber, bevel=0.005)
    rounded_box("Door lower armor", (0.0, -0.455, 0.392), (0.720, 0.012, 0.060), white, bevel=0.008)

    # Left-side compression handle and linkage, as seen on the Room 809 unit.
    rounded_box("Handle mounting rail", (-0.337, -0.464, 1.100), (0.055, 0.030, 0.380), white, bevel=0.011)
    cylinder("Handle upper pivot", (-0.355, -0.489, 1.245), 0.026, 0.045, steel, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.003)
    cylinder("Handle lower pivot", (-0.355, -0.489, 0.965), 0.026, 0.045, steel, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.003)
    rounded_box("Vertical compression handle", (-0.380, -0.515, 1.105), (0.052, 0.055, 0.335), white, bevel=0.017)
    rounded_box("Handle rubber grip", (-0.385, -0.548, 1.105), (0.040, 0.023, 0.210), rubber, bevel=0.010)
    for z in (0.965, 1.245):
        cylinder_between(f"Latch link {z:.3f}", (-0.355, -0.512, z), (-0.295, -0.465, z), 0.010, steel, bevel=0.001)
        rounded_box(f"Latch keeper {z:.3f}", (-0.277, -0.461, z), (0.045, 0.024, 0.060), steel, bevel=0.006)

    # Full-height hinges with leaves, knuckles and visible fasteners.
    for index, z in enumerate((0.610, 1.120, 1.610), start=1):
        rounded_box(f"Hinge {index} door leaf", (0.384, -0.458, z), (0.065, 0.018, 0.150), steel, bevel=0.005)
        rounded_box(f"Hinge {index} body leaf", (0.416, -0.385, z), (0.027, 0.095, 0.150), steel, bevel=0.005)
        cylinder(f"Hinge {index} pin", (0.410, -0.445, z), 0.012, 0.185, steel, bevel=0.002)
        for dz in (-0.045, 0.045):
            fastener(f"Hinge {index} screw {dz:+.2f}", (0.384, -0.470, z + dz))

    # Upper control fascia, glass display and tactile keypad.
    rounded_box("Control fascia recess", (0.0, -0.420, 1.815), (0.610, 0.030, 0.205), shadow, bevel=0.018)
    rounded_box("Control fascia bezel", (0.0, -0.444, 1.815), (0.565, 0.020, 0.166), black, bevel=0.012)
    rounded_box("Controller screen", (0.030, -0.459, 1.835), (0.255, 0.010, 0.073), MATERIALS["screen"], bevel=0.006)
    text_mesh("Temperature display", "-86 C", (0.030, -0.466, 1.837), 0.034, MATERIALS["display"])
    for row in range(2):
        for col in range(4):
            x = -0.196 + col * 0.036
            z = 1.842 - row * 0.035
            cylinder(
                f"Keypad button {row + 1}-{col + 1}", (x, -0.460, z), 0.009, 0.006,
                gray, vertices=20, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.001,
            )
    cylinder("Alarm status lamp", (0.214, -0.460, 1.870), 0.010, 0.007, MATERIALS["red"], vertices=24, rotation=(math.pi / 2.0, 0.0, 0.0))
    cylinder("Run status lamp", (0.214, -0.460, 1.835), 0.010, 0.007, MATERIALS["green"], vertices=24, rotation=(math.pi / 2.0, 0.0, 0.0))
    text_mesh("Controller legend", "ULT CONTROL", (0.0, -0.466, 1.765), 0.020, MATERIALS["paper"])
    text_mesh("Cabinet type label", "CRYO -86", (-0.245, -0.458, 1.925), 0.034, MATERIALS["blue"], align="LEFT")

    # Door labels and document clip add the dense, lived-in Room 809 read.
    rounded_box("Asset label plate", (0.190, -0.458, 1.510), (0.105, 0.006, 0.145), MATERIALS["blue"], bevel=0.006)
    rounded_box("Asset label paper", (0.190, -0.462, 1.510), (0.075, 0.004, 0.110), MATERIALS["paper"], bevel=0.002)
    text_mesh("Asset label text", "LAB 809", (0.190, -0.467, 1.515), 0.016, MATERIALS["label"])
    rounded_box("Document holder", (0.055, -0.462, 1.205), (0.265, 0.009, 0.205), MATERIALS["paper"], bevel=0.004)
    rounded_box("Document clip", (0.055, -0.472, 1.310), (0.060, 0.012, 0.024), steel, bevel=0.004)
    for row, width in enumerate((0.200, 0.220, 0.175, 0.210, 0.130)):
        rounded_box(f"Document line {row + 1}", (-0.015, -0.476, 1.260 - row * 0.027), (width, 0.002, 0.005), MATERIALS["label"], bevel=0.001)

    # Left and right side service construction, screws and removable panels.
    for side, x, axis in (("left", -0.433, (-1.0, 0.0, 0.0)), ("right", 0.433, (1.0, 0.0, 0.0))):
        rounded_box(f"{side.title()} service panel", (x, 0.075, 0.860), (0.012, 0.545, 0.720), gray, bevel=0.005)
        for z in (0.555, 1.165):
            for y in (-0.125, 0.275):
                fastener(f"{side} panel screw {z:.2f} {y:.2f}", (x + axis[0] * 0.009, y, z), axis=axis)
        add_vent_bank(f"{side}_lower_vent", center=(x + axis[0] * 0.009, 0.125, 0.430), span=0.330, count=11, vertical=False, plane="side")

    # Rear compressor access, condenser grille, electrical inlet and service plumbing.
    rounded_box("Rear upper service panel", (0.0, 0.421, 1.415), (0.700, 0.016, 0.620), gray, bevel=0.008)
    for row in range(7):
        for col in range(10):
            rounded_box(
                f"Rear condenser grille {row + 1}-{col + 1}",
                (-0.270 + col * 0.060, 0.434, 1.255 + row * 0.053),
                (0.043, 0.006, 0.012),
                shadow,
                bevel=0.003,
            )
    rounded_box("Rear electrical inlet", (-0.265, 0.439, 0.700), (0.150, 0.018, 0.125), black, bevel=0.008)
    cylinder("Rear data port", (-0.220, 0.451, 0.720), 0.018, 0.012, MATERIALS["blue"], vertices=28, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.002)
    cylinder("Rear drain fitting", (0.240, 0.448, 0.515), 0.026, 0.034, steel, vertices=30, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.003)
    cylinder("Rear drain cap", (0.240, 0.472, 0.515), 0.035, 0.023, MATERIALS["blue"], vertices=28, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.004)
    curve_tube(
        "Rear power cable",
        [(-0.315, 0.440, 0.680), (-0.420, 0.465, 0.520), (-0.430, 0.330, 0.215), (-0.360, 0.310, 0.100)],
        0.010,
        black,
    )
    rounded_box("Power plug body", (-0.350, 0.300, 0.075), (0.055, 0.035, 0.065), black, bevel=0.008)
    curve_tube(
        "Rear condensate hose",
        [(0.240, 0.478, 0.515), (0.330, 0.480, 0.440), (0.350, 0.435, 0.240), (0.285, 0.360, 0.130)],
        0.014,
        MATERIALS["clear_hose"],
    )

    # Caster base plus front stabilizing feet.
    for prefix, x, y in (
        ("front_left", -0.340, -0.285),
        ("front_right", 0.340, -0.285),
        ("rear_left", -0.340, 0.285),
        ("rear_right", 0.340, 0.285),
    ):
        add_caster(prefix, x, y, wheel_radius=0.052)
    add_leveling_foot("front_left_leveler", -0.420, -0.315)
    add_leveling_foot("front_right_leveler", 0.420, -0.315)


def build_autoclave() -> None:
    white = MATERIALS["warm_white"]
    gray = MATERIALS["light_gray"]
    shadow = MATERIALS["shadow_gray"]
    steel = MATERIALS["polished_steel"]
    stainless = MATERIALS["stainless"]
    black = MATERIALS["black"]
    rubber = MATERIALS["rubber"]

    # Floor-standing shell and recessed service base.
    rounded_box("Autoclave cabinet shell", (0.0, 0.015, 0.700), (0.705, 0.755, 1.095), white, bevel=0.028)
    rounded_box("Autoclave lower plinth", (0.0, 0.060, 0.185), (0.650, 0.670, 0.165), shadow, bevel=0.022)
    rounded_box("Front service door", (0.0, -0.374, 0.570), (0.625, 0.035, 0.675), gray, bevel=0.016)
    rounded_box("Service door shadow gap", (0.0, -0.394, 0.570), (0.650, 0.010, 0.700), black, bevel=0.010)
    rounded_box("Service door pull", (0.260, -0.421, 0.570), (0.025, 0.030, 0.165), black, bevel=0.009)
    for z in (0.310, 0.830):
        for x in (-0.260, 0.260):
            fastener(f"Front service screw {x:.2f} {z:.2f}", (x, -0.419, z))

    # Top deck with a brushed stainless spill surface and rolled front lip.
    rounded_box("Top deck substrate", (0.0, 0.000, 1.270), (0.740, 0.800, 0.105), gray, bevel=0.022)
    rounded_box("Brushed stainless top", (0.0, -0.005, 1.328), (0.738, 0.798, 0.028), stainless, bevel=0.012)
    cylinder("Front rolled top lip", (0.0, -0.405, 1.318), 0.020, 0.715, stainless, rotation=(0.0, math.pi / 2.0, 0.0), bevel=0.002)

    # Cylindrical chamber neck, thermal break and closed top-loading lid.
    cylinder("Chamber neck", (0.0, 0.080, 1.352), 0.238, 0.055, stainless, vertices=72, bevel=0.006)
    torus("Chamber outer gasket", (0.0, 0.080, 1.381), 0.223, 0.016, rubber, major_segments=72, minor_segments=14)
    cylinder("Chamber inner throat", (0.0, 0.080, 1.389), 0.191, 0.030, MATERIALS["shadow_gray"], vertices=72, bevel=0.003)
    torus("Chamber inner steel rim", (0.0, 0.080, 1.405), 0.191, 0.011, stainless, major_segments=72, minor_segments=12)
    cylinder("Insulated lid core", (0.0, 0.080, 1.424), 0.220, 0.070, gray, vertices=72, bevel=0.008)
    cylinder("Stainless lid cap", (0.0, 0.080, 1.463), 0.213, 0.030, stainless, vertices=72, bevel=0.006)
    torus("Lid perimeter grip", (0.0, 0.080, 1.477), 0.205, 0.012, black, major_segments=72, minor_segments=14)
    cylinder("Lid central boss", (0.0, 0.080, 1.482), 0.055, 0.018, steel, vertices=48, bevel=0.004)
    # Radial clamp dogs communicate pressure-vessel construction from every side.
    for index in range(8):
        angle = math.tau * index / 8.0
        x, y = 0.225 * math.cos(angle), 0.080 + 0.225 * math.sin(angle)
        rounded_box(
            f"Lid clamp dog {index + 1}",
            (x, y, 1.420),
            (0.055, 0.034, 0.032),
            steel,
            bevel=0.007,
            rotation=(0.0, 0.0, angle),
        )
        cylinder(f"Lid clamp bolt {index + 1}", (x, y, 1.449), 0.009, 0.034, steel, vertices=20, bevel=0.001)

    # Hinge bridge, counterbalance arms and insulated lifting handle.
    rounded_box("Rear lid hinge bridge", (0.0, 0.320, 1.404), (0.290, 0.075, 0.070), shadow, bevel=0.012)
    cylinder("Rear hinge pin", (0.0, 0.333, 1.428), 0.022, 0.330, steel, rotation=(0.0, math.pi / 2.0, 0.0), bevel=0.003)
    for side, x in (("left", -0.142), ("right", 0.142)):
        rounded_box(f"{side} hinge arm", (x, 0.225, 1.442), (0.032, 0.205, 0.040), steel, bevel=0.006, rotation=(0.0, 0.0, 0.0))
        cylinder(f"{side} hinge cap", (x, 0.334, 1.428), 0.030, 0.026, black, rotation=(0.0, math.pi / 2.0, 0.0), bevel=0.003)
    cylinder_between("Lid handle crossbar", (-0.165, -0.095, 1.482), (0.165, -0.095, 1.482), 0.020, black, bevel=0.003)
    for side, x in (("left", -0.165), ("right", 0.165)):
        cylinder_between(f"Lid handle {side} riser", (x, -0.095, 1.482), (x, -0.020, 1.455), 0.013, steel, bevel=0.002)

    # Front sloped controller pod and physical controls.
    rounded_box("Controller pod", (0.0, -0.403, 1.105), (0.540, 0.110, 0.225), gray, bevel=0.022, rotation=(math.radians(-7.0), 0.0, 0.0))
    rounded_box("Controller bezel", (-0.055, -0.468, 1.132), (0.265, 0.018, 0.112), black, bevel=0.011, rotation=(math.radians(-7.0), 0.0, 0.0))
    rounded_box("Controller screen", (-0.055, -0.481, 1.140), (0.220, 0.008, 0.072), MATERIALS["screen"], bevel=0.006, rotation=(math.radians(-7.0), 0.0, 0.0))
    text_mesh("Sterilizer display", "121 C   20 min", (-0.055, -0.490, 1.145), 0.021, MATERIALS["display"], rotation=(math.radians(97.0), 0.0, 0.0))
    for row in range(2):
        for col in range(3):
            x = 0.120 + col * 0.045
            z = 1.157 - row * 0.047
            cylinder(
                f"Autoclave keypad {row + 1}-{col + 1}", (x, -0.483, z), 0.012, 0.008,
                MATERIALS["aqua"] if col == 0 else white,
                vertices=24, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.002,
            )
    cylinder("Emergency stop bezel", (0.240, -0.482, 1.060), 0.027, 0.010, MATERIALS["amber"], vertices=30, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.003)
    cylinder("Emergency stop", (0.240, -0.495, 1.060), 0.019, 0.020, MATERIALS["red"], vertices=30, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.004)
    cylinder("Cycle status", (-0.220, -0.482, 1.060), 0.010, 0.008, MATERIALS["green"], vertices=24, rotation=(math.pi / 2.0, 0.0, 0.0))
    text_mesh("Controller title", "STEAM STERILIZER", (0.0, -0.476, 1.210), 0.022, MATERIALS["label"], rotation=(math.radians(97.0), 0.0, 0.0))

    # Pressure gauge and mechanical safety hardware on the rear deck.
    cylinder("Pressure gauge case", (0.270, 0.215, 1.407), 0.050, 0.030, steel, vertices=48, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.004)
    cylinder("Pressure gauge face", (0.270, 0.197, 1.407), 0.043, 0.008, MATERIALS["paper"], vertices=48, rotation=(math.pi / 2.0, 0.0, 0.0))
    cylinder_between("Gauge needle", (0.270, 0.191, 1.407), (0.290, 0.190, 1.430), 0.0025, MATERIALS["red"], vertices=12)
    for index in range(10):
        angle = math.radians(-140 + index * 28)
        x = 0.270 + math.cos(angle) * 0.035
        z = 1.407 + math.sin(angle) * 0.035
        cylinder_between(f"Gauge tick {index + 1}", (x, 0.190, z), (x, 0.187, z), 0.0018, MATERIALS["label"], vertices=10)
    cylinder("Safety relief valve body", (-0.270, 0.225, 1.400), 0.026, 0.085, steel, bevel=0.004)
    cylinder("Safety relief cap", (-0.270, 0.225, 1.452), 0.036, 0.025, MATERIALS["red"], bevel=0.004)
    cylinder_between("Relief elbow horizontal", (-0.270, 0.225, 1.415), (-0.330, 0.225, 1.415), 0.014, steel, bevel=0.002)

    # Side access panels, cooling slots, lifting grips and fasteners.
    for side, x, axis in (("left", -0.359, (-1.0, 0.0, 0.0)), ("right", 0.359, (1.0, 0.0, 0.0))):
        rounded_box(f"{side.title()} service panel", (x, 0.035, 0.625), (0.014, 0.545, 0.650), gray, bevel=0.005)
        rounded_box(f"{side.title()} lifting grip recess", (x + axis[0] * 0.010, -0.020, 0.900), (0.015, 0.160, 0.055), black, bevel=0.010)
        rounded_box(f"{side.title()} lifting grip", (x + axis[0] * 0.024, -0.020, 0.900), (0.014, 0.120, 0.025), steel, bevel=0.006)
        for z in (0.340, 0.900):
            for y in (-0.170, 0.235):
                fastener(f"{side} service screw {z:.2f} {y:.2f}", (x + axis[0] * 0.011, y, z), axis=axis)
        add_vent_bank(f"{side}_cooling_vent", center=(x + axis[0] * 0.010, 0.105, 0.310), span=0.360, count=12, vertical=False, plane="side")

    # Rear utility panel with steam exhaust, drain, water inlet and power cable.
    rounded_box("Rear utility panel", (0.0, 0.397, 0.665), (0.600, 0.018, 0.760), gray, bevel=0.008)
    add_vent_bank("Rear upper exhaust", center=(0.0, 0.410, 0.940), span=0.470, count=13, vertical=False, plane="front")
    for x, z, label in ((-0.210, 0.555, "DRAIN"), (0.000, 0.555, "WATER"), (0.210, 0.555, "STEAM")):
        cylinder(f"Rear {label.lower()} fitting", (x, 0.425, z), 0.030, 0.035, steel, vertices=32, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.004)
        cylinder(f"Rear {label.lower()} cap", (x, 0.452, z), 0.039, 0.024, MATERIALS["blue"] if label == "WATER" else black, vertices=30, rotation=(math.pi / 2.0, 0.0, 0.0), bevel=0.004)
        text_mesh(f"Rear {label.lower()} label", label, (x, 0.464, z + 0.065), 0.017, MATERIALS["label"], rotation=(math.pi / 2.0, 0.0, math.pi))
    curve_tube(
        "Steam exhaust hose",
        [(0.210, 0.465, 0.555), (0.300, 0.470, 0.680), (0.300, 0.445, 1.075), (0.255, 0.405, 1.240)],
        0.017,
        MATERIALS["clear_hose"],
    )
    curve_tube(
        "Rear drain hose",
        [(-0.210, 0.466, 0.555), (-0.300, 0.470, 0.440), (-0.295, 0.390, 0.190), (-0.235, 0.335, 0.110)],
        0.015,
        black,
    )
    rounded_box("Rear mains inlet", (0.145, 0.420, 0.310), (0.135, 0.020, 0.100), black, bevel=0.007)
    curve_tube(
        "Autoclave power cable",
        [(0.145, 0.436, 0.310), (0.270, 0.470, 0.275), (0.330, 0.390, 0.155), (0.280, 0.325, 0.080)],
        0.011,
        black,
    )
    rounded_box("Autoclave power plug", (0.260, 0.310, 0.060), (0.055, 0.035, 0.062), black, bevel=0.008)
    for x in (-0.260, 0.260):
        for z in (0.340, 0.990):
            fastener(f"Rear utility screw {x:.2f} {z:.2f}", (x, 0.416, z), axis=(0.0, 1.0, 0.0))

    # Product/safety plates and dense inspection details.
    # The upper badge straddles the removable service door: attach it to a
    # real backing boss, not to space in front of the taller cabinet shell.
    for name, x, z, w, h in (("Badge mounting boss", -.205, .905, .145, .073),
                              ("Warning mounting boss", .165, .880, .170, .115)):
        rounded_box(name, (x, -.385, z), (w, .054, h), gray, bevel=.002)
    rounded_box("Front model badge", (-0.205, -0.411, 0.905), (0.150, 0.014, 0.078), MATERIALS["aqua"], bevel=0.003)
    text_mesh("Front model badge text", "AUTOCLAVE", (-0.205, -0.421, 0.905), 0.018, MATERIALS["paper"])
    rounded_box("Warning plate", (0.165, -0.412, 0.880), (0.175, 0.016, 0.120), MATERIALS["paper"], bevel=0.003)
    text_mesh("Warning heading", "CAUTION", (0.165, -0.423, 0.914), 0.019, MATERIALS["red"])
    for row, width in enumerate((0.135, 0.145, 0.110)):
        rounded_box(f"Warning line {row + 1}", (0.165, -0.425, 0.880 - row * 0.022), (width, 0.002, 0.004), MATERIALS["label"], bevel=0.001)

    # Lockable swivel casters and front stabilizers.
    for prefix, x, y in (
        ("front_left", -0.275, -0.275),
        ("front_right", 0.275, -0.275),
        ("rear_left", -0.275, 0.275),
        ("rear_right", 0.275, 0.275),
    ):
        add_caster(prefix, x, y, wheel_radius=0.050)
    add_leveling_foot("front_left_leveler", -0.340, -0.315)
    add_leveling_foot("front_right_leveler", 0.340, -0.315)


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
    """Join static geometry into one runtime mesh per PBR material.

    All authored parts are static and have a single material slot.  Grouping by
    material preserves the separate screen, display, label, hose, rubber,
    painted-shell, and metal treatments while collapsing hundreds of repeated
    fasteners and vent parts into a draw-call-friendly asset.
    """
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


def scene_statistics(asset_id: str, bounds: dict[str, list[float]]) -> dict[str, object]:
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    materials = {
        slot.material.name
        for obj in meshes
        for slot in obj.material_slots
        if slot.material is not None
    }
    cameras = [obj for obj in bpy.context.scene.objects if obj.type == "CAMERA"]
    lights = [obj for obj in bpy.context.scene.objects if obj.type == "LIGHT"]
    return {
        "asset": asset_id,
        "mesh_objects": len(meshes),
        "materials": len(materials),
        "cameras": len(cameras),
        "lights": len(lights),
        "vertices": sum(len(obj.data.vertices) for obj in meshes),
        "triangles": sum(triangle_count(obj.data) for obj in meshes),
        "bounds_m": bounds,
    }


def validate_scene(asset_id: str, stats: dict[str, object]) -> None:
    target = Vector(ASSETS[asset_id]["dimensions"])
    dimensions = Vector(stats["bounds_m"]["dimensions"])
    minimum = Vector(stats["bounds_m"]["min"])
    errors: list[str] = []
    for axis, actual, expected in zip("xyz", dimensions, target):
        if abs(actual - expected) > 0.002:
            errors.append(f"{axis} dimension {actual:.4f} m != {expected:.4f} m")
    if abs(minimum.z) > 0.001:
        errors.append(f"minimum z {minimum.z:.5f} m is not grounded")
    if not 12 <= int(stats["mesh_objects"]) <= 25:
        errors.append(f"runtime mesh count {stats['mesh_objects']} is outside 12-25")
    if int(stats["materials"]) < 12:
        errors.append(f"only {stats['materials']} materials")
    if int(stats["triangles"]) < 18_000:
        errors.append(f"only {stats['triangles']} triangles")
    if int(stats["cameras"]) or int(stats["lights"]):
        errors.append("authoring scene contains a camera or light before export")
    if errors:
        raise RuntimeError(f"{asset_id} authored-scene validation failed: {'; '.join(errors)}")


def export_glb(output_path: Path, *, draco: bool) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    kwargs = dict(
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
    result = bpy.ops.export_scene.gltf(**kwargs)
    if "FINISHED" not in result:
        raise RuntimeError(f"GLB export failed: {result}")


def render_imported_preview(asset_id: str, preview_dir: Path) -> list[Path]:
    """Render the already re-imported GLB for visual QA; never alters the GLB."""
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 760
    scene.render.resolution_y = 760
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.055, 0.065, 0.078)

    ground_mat = make_material("QA studio floor", (0.15, 0.17, 0.18, 1.0), roughness=0.62)
    rounded_box("QA ground", (0.0, 0.0, -0.030), (4.8, 4.8, 0.050), ground_mat, bevel=0.012)
    target = Vector((0.0, 0.0, ASSETS[asset_id]["dimensions"][2] * 0.52))

    bpy.ops.object.camera_add(location=(2.25, -2.85, 2.12 if asset_id == "ultra-low-freezer" else 1.78))
    camera = bpy.context.object
    camera.name = "QA camera"
    camera.data.lens = 58
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera

    for name, location, energy, size, color in (
        ("QA key", (-2.1, -2.2, 3.2), 1080.0, 2.2, (1.0, 0.93, 0.84)),
        ("QA fill", (2.5, -0.7, 2.1), 760.0, 1.8, (0.78, 0.88, 1.0)),
        ("QA rim", (-0.4, 2.2, 2.8), 980.0, 1.4, (0.72, 0.82, 1.0)),
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
    front_output = (preview_dir / f"{asset_id}-blender-qa.png").resolve()
    scene.render.filepath = str(front_output)
    bpy.ops.render.render(write_still=True)
    camera.location = (-2.25, 2.85, 2.02 if asset_id == "ultra-low-freezer" else 1.68)
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    rear_output = (preview_dir / f"{asset_id}-rear-blender-qa.png").resolve()
    scene.render.filepath = str(rear_output)
    bpy.ops.render.render(write_still=True)
    return [front_output, rear_output]


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
    errors: list[str] = []
    for axis, actual, expected in zip("xyz", dimensions, target):
        if abs(actual - expected) > 0.008:
            errors.append(f"{axis} dimension {actual:.4f} m != {expected:.4f} m")
    if abs(minimum.z) > 0.006:
        errors.append(f"minimum z {minimum.z:.5f} m is not grounded")
    if not 12 <= len(meshes) <= 25:
        errors.append(f"imported runtime mesh count {len(meshes)} is outside 12-25")
    if len(materials) < 12:
        errors.append(f"only {len(materials)} imported materials")
    if cameras:
        errors.append(f"GLB unexpectedly contains {len(cameras)} cameras")
    if lights:
        errors.append(f"GLB unexpectedly contains {len(lights)} lights")
    report = {
        "asset": asset_id,
        "file": str(path.resolve()),
        "bytes": path.stat().st_size,
        "mesh_objects": len(meshes),
        "materials": len(materials),
        "cameras": len(cameras),
        "lights": len(lights),
        "vertices": sum(len(obj.data.vertices) for obj in meshes),
        "triangles": sum(triangle_count(obj.data) for obj in meshes),
        "bounds_m": {
            "min": [round(value, 6) for value in minimum],
            "max": [round(value, 6) for value in maximum],
            "dimensions": [round(value, 6) for value in dimensions],
        },
        "errors": errors,
    }
    if path.stat().st_size < 100_000:
        errors.append("GLB is unexpectedly smaller than 100 KB")
    if errors:
        raise RuntimeError(f"{asset_id} exported-GLB validation failed: {'; '.join(errors)}")
    if preview_dir is not None:
        report["previews"] = [str(path) for path in render_imported_preview(asset_id, preview_dir)]
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
    if asset_id == "ultra-low-freezer":
        build_freezer()
    else:
        build_autoclave()
    bounds = fit_to_dimensions(ASSETS[asset_id]["dimensions"])
    stats = scene_statistics(asset_id, bounds)
    validate_scene(asset_id, stats)
    if save_blend_dir is not None:
        save_blend_dir.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str((save_blend_dir / f"{asset_id}.blend").resolve()))
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
    print("LABSPACE_COLD_AUTOCLAVE_COMPLETE " + json.dumps(reports, sort_keys=True))


if __name__ == "__main__":
    main()
