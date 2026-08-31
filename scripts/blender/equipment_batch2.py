"""Build four original, all-sided Room 809 equipment hero assets.

The models are dimension-driven planning representations informed by the
user-supplied Room 809 photographs.  The vacuum pump and oven additionally use
the documented envelopes and construction cues of the ULVAC GCD-051X and
Yamato DKN602 as representative anatomy references.  No manufacturer mesh,
logo, label, or texture is copied.

Run from the repository root with Blender 4.5 LTS::

    .tools/blender-4.5.11-windows-x64/blender.exe --background \
      --factory-startup --python scripts/blender/equipment_batch2.py -- \
      --output-dir public/models/hero

Use ``--preview-dir docs/screenshots/authored-batch2`` to render front, rear,
left, and right QA views from the exported-and-reimported GLBs.
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
    "vacuum-pump": {
        "filename": "vacuum-pump.glb",
        "dimensions": (0.1655, 0.4190, 0.2227),
        "reference": (
            "Room 809 yellow oil rotary pumps; ULVAC GCD-051X representative "
            "envelope, oil-gauge side, inlet, motor, and service anatomy"
        ),
    },
    "forced-air-lab-oven": {
        "filename": "forced-air-lab-oven.glb",
        "dimensions": (0.710, 0.651, 0.870),
        "reference": (
            "Room 809 windowed laboratory oven; Yamato DKN602 representative "
            "envelope, chamber, top exhaust, cable port, and forced-air anatomy"
        ),
    },
    "multi-position-heating-bath": {
        "filename": "multi-position-heating-bath.glb",
        "dimensions": (1.200, 0.500, 0.350),
        "reference": (
            "Room 809 long turquoise multi-position bath with cream-yellow top, "
            "individual controls, vessel wells, rear services, and bench feet"
        ),
    },
    "vacuum-cold-trap-system": {
        "filename": "vacuum-cold-trap-system.glb",
        "dimensions": (0.500, 0.550, 1.150),
        "reference": (
            "Room 809 stacked cold-trap station with chiller, trap vessel, gauges, "
            "yellow companion pump, flexible hoses, service rear, and casters"
        ),
    },
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", default="public/models/hero")
    parser.add_argument("--asset", choices=("all", *ASSETS.keys()), default="all")
    parser.add_argument("--preview-dir", default="")
    parser.add_argument("--save-blend-dir", default="")
    parser.add_argument("--draco", action="store_true")
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
    scene["reference_status"] = "representative"
    scene["planning_model"] = True
    scene["front_axis"] = "-Y"


def set_socket(bsdf: bpy.types.Node, name: str, value) -> None:
    socket = bsdf.inputs.get(name)
    if socket is not None:
        socket.default_value = value


def material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    metallic: float = 0.0,
    roughness: float = 0.35,
    transmission: float = 0.0,
    ior: float = 1.45,
    coat: float = 0.0,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
    anisotropy: float = 0.0,
) -> bpy.types.Material:
    result = bpy.data.materials.new(name=name)
    result.use_nodes = True
    result.diffuse_color = color
    result.metallic = metallic
    result.roughness = roughness
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    assert bsdf is not None
    set_socket(bsdf, "Base Color", color)
    set_socket(bsdf, "Metallic", metallic)
    set_socket(bsdf, "Roughness", roughness)
    set_socket(bsdf, "IOR", ior)
    set_socket(bsdf, "Alpha", color[3])
    set_socket(bsdf, "Transmission Weight", transmission)
    set_socket(bsdf, "Coat Weight", coat)
    set_socket(bsdf, "Coat Roughness", 0.14)
    set_socket(bsdf, "Anisotropic IOR Level", anisotropy)
    if emission is not None:
        set_socket(bsdf, "Emission Color", emission)
        set_socket(bsdf, "Emission Strength", emission_strength)
    if color[3] < 1.0 or transmission > 0.0:
        try:
            result.surface_render_method = "DITHERED"
            result.use_transparency_overlap = False
        except (AttributeError, TypeError):
            pass
    result["pbr_role"] = name
    return result


def build_materials() -> None:
    global MATERIALS
    MATERIALS = {
        "yellow": material(
            "Room 809 aged yellow powder coat",
            (0.68, 0.43, 0.035, 1.0),
            metallic=0.18,
            roughness=0.31,
            coat=0.18,
        ),
        "yellow_edge": material(
            "Warm ochre edge and knob",
            (0.91, 0.66, 0.11, 1.0),
            roughness=0.26,
            coat=0.24,
        ),
        "teal": material(
            "Room 809 turquoise enamel",
            (0.035, 0.34, 0.39, 1.0),
            metallic=0.16,
            roughness=0.29,
            coat=0.22,
        ),
        "cream": material(
            "Warm laboratory baked enamel",
            (0.78, 0.78, 0.70, 1.0),
            roughness=0.31,
            coat=0.15,
        ),
        "white": material(
            "Cool white equipment powder coat",
            (0.79, 0.82, 0.82, 1.0),
            roughness=0.26,
            coat=0.20,
        ),
        "steel": material(
            "Brushed SUS304 stainless steel",
            (0.60, 0.64, 0.66, 1.0),
            metallic=0.96,
            roughness=0.19,
            anisotropy=0.72,
        ),
        "polished": material(
            "Polished stainless hardware",
            (0.77, 0.80, 0.82, 1.0),
            metallic=1.0,
            roughness=0.09,
            coat=0.18,
        ),
        "aluminum": material(
            "Satin cast aluminum",
            (0.44, 0.49, 0.50, 1.0),
            metallic=0.84,
            roughness=0.28,
            anisotropy=0.30,
        ),
        "dark_metal": material(
            "Dark phosphated service metal",
            (0.075, 0.085, 0.088, 1.0),
            metallic=0.55,
            roughness=0.34,
        ),
        "black": material(
            "Black engineering polymer",
            (0.010, 0.014, 0.016, 1.0),
            roughness=0.29,
            coat=0.15,
        ),
        "rubber": material(
            "Black EPDM isolation rubber",
            (0.006, 0.008, 0.009, 1.0),
            roughness=0.80,
        ),
        "screen": material(
            "Smoked controller glass",
            (0.005, 0.015, 0.022, 1.0),
            roughness=0.08,
            coat=0.55,
        ),
        "display": material(
            "Cyan controller display",
            (0.01, 0.44, 0.61, 1.0),
            roughness=0.11,
            emission=(0.01, 0.42, 0.67, 1.0),
            emission_strength=2.8,
        ),
        "glass": material(
            "Borosilicate equipment glass",
            (0.31, 0.62, 0.66, 0.30),
            roughness=0.055,
            transmission=0.70,
            ior=1.47,
            coat=0.42,
        ),
        "dark_glass": material(
            "Chemically strengthened observation glass",
            (0.045, 0.095, 0.105, 0.64),
            roughness=0.07,
            transmission=0.38,
            ior=1.51,
            coat=0.48,
        ),
        "amber": material(
            "Translucent amber oil and bath fluid",
            (0.56, 0.22, 0.018, 0.62),
            roughness=0.13,
            transmission=0.33,
            ior=1.45,
            coat=0.18,
        ),
        "copper": material(
            "Aged copper service tubing",
            (0.49, 0.18, 0.055, 1.0),
            metallic=0.88,
            roughness=0.25,
        ),
        "brass": material(
            "Machined brass fittings",
            (0.62, 0.39, 0.08, 1.0),
            metallic=0.90,
            roughness=0.20,
        ),
        "red": material(
            "Safety red control",
            (0.67, 0.018, 0.012, 1.0),
            roughness=0.24,
            coat=0.20,
        ),
        "green": material(
            "Status green indicator",
            (0.015, 0.47, 0.13, 1.0),
            roughness=0.18,
            emission=(0.01, 0.42, 0.10, 1.0),
            emission_strength=1.6,
        ),
        "blue": material(
            "Coolant blue hose",
            (0.025, 0.18, 0.55, 1.0),
            roughness=0.43,
            coat=0.08,
        ),
        "paper": material(
            "Generic equipment label stock",
            (0.88, 0.87, 0.75, 1.0),
            roughness=0.72,
        ),
        "graphite": material(
            "Generic label graphite",
            (0.025, 0.030, 0.032, 1.0),
            roughness=0.54,
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
    ROOT["reference_status"] = "representative"


def attach(obj: bpy.types.Object) -> bpy.types.Object:
    if ROOT is not None:
        obj.parent = ROOT
    return obj


def assign(obj: bpy.types.Object, mat: bpy.types.Material) -> None:
    if hasattr(obj.data, "materials"):
        obj.data.materials.append(mat)


def smooth(obj: bpy.types.Object) -> None:
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True


def rounded_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    mat: bpy.types.Material,
    *,
    bevel: float = 0.006,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    if bevel > 0.0:
        modifier = obj.modifiers.new(name="Soft manufactured edge", type="BEVEL")
        modifier.width = min(bevel, min(dimensions) * 0.22)
        modifier.segments = 3
        modifier.limit_method = "ANGLE"
        modifier.harden_normals = True
    return attach(obj)


def cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    mat: bpy.types.Material,
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
    assign(obj, mat)
    smooth(obj)
    if bevel > 0.0:
        modifier = obj.modifiers.new(name="Rounded cylinder edge", type="BEVEL")
        modifier.width = min(bevel, radius * 0.24, depth * 0.20)
        modifier.segments = 2
        modifier.harden_normals = True
    return attach(obj)


def cylinder_between(
    name: str,
    start: tuple[float, float, float] | Vector,
    end: tuple[float, float, float] | Vector,
    radius: float,
    mat: bpy.types.Material,
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
        mat,
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
    mat: bpy.types.Material,
    *,
    axis: tuple[float, float, float] = (0.0, 0.0, 1.0),
    major_segments: int = 40,
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
    assign(obj, mat)
    smooth(obj)
    return attach(obj)


def sphere(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    *,
    segments: int = 40,
    rings: int = 20,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    smooth(obj)
    return attach(obj)


def curve_tube(
    name: str,
    points: list[tuple[float, float, float]],
    radius: float,
    mat: bpy.types.Material,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(name=f"{name}_curve", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 3
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new(type="BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = Vector(coordinate)
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    assign(obj, mat)
    attach(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.name = name
    smooth(obj)
    obj.select_set(False)
    return obj


def bolt(
    name: str,
    location: tuple[float, float, float],
    *,
    axis: tuple[float, float, float] = (0.0, -1.0, 0.0),
    radius: float = 0.004,
) -> bpy.types.Object:
    start = Vector(location)
    end = start + Vector(axis).normalized() * 0.005
    return cylinder_between(name, start, end, radius, MATERIALS["polished"], vertices=16, bevel=0.0005)


def text_mesh(
    name: str,
    body: str,
    location: tuple[float, float, float],
    size: float,
    mat: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (math.pi / 2.0, 0.0, 0.0),
    align: str = "CENTER",
) -> bpy.types.Object:
    curve = bpy.data.curves.new(type="FONT", name=f"{name}_font")
    curve.body = body
    curve.align_x = align
    curve.align_y = "CENTER"
    curve.size = size
    curve.extrude = max(size * 0.012, 0.0002)
    curve.bevel_depth = max(size * 0.002, 0.00004)
    curve.bevel_resolution = 1
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = rotation
    assign(obj, mat)
    attach(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.name = name
    obj.select_set(False)
    return obj


def vent_bank(
    prefix: str,
    origin: tuple[float, float, float],
    *,
    rows: int,
    columns: int,
    spacing_x: float,
    spacing_z: float,
    slot: tuple[float, float, float],
    mat: bpy.types.Material | None = None,
) -> None:
    ox, oy, oz = origin
    use_material = mat or MATERIALS["dark_metal"]
    for row in range(rows):
        for column in range(columns):
            rounded_box(
                f"{prefix}_{row + 1}_{column + 1}",
                (ox + column * spacing_x, oy, oz + row * spacing_z),
                slot,
                use_material,
                bevel=min(slot) * 0.34,
            )


def build_vacuum_pump() -> None:
    yellow = MATERIALS["yellow"]
    yellow_edge = MATERIALS["yellow_edge"]
    aluminum = MATERIALS["aluminum"]
    dark = MATERIALS["dark_metal"]
    black = MATERIALS["black"]
    rubber = MATERIALS["rubber"]
    steel = MATERIALS["polished"]

    # Independent anti-vibration feet and rails keep the pump readable from below.
    for prefix, x, y in (
        ("front_left", -0.060, -0.145),
        ("front_right", 0.060, -0.145),
        ("rear_left", -0.060, 0.145),
        ("rear_right", 0.060, 0.145),
    ):
        cylinder(f"{prefix}_foot", (x, y, 0.012), 0.019, 0.024, rubber, vertices=24, bevel=0.003)
        cylinder(f"{prefix}_mount", (x, y, 0.029), 0.011, 0.012, steel, vertices=20, bevel=0.0015)
    rounded_box("Pump base rail left", (-0.050, 0.005, 0.041), (0.028, 0.330, 0.024), dark, bevel=0.004)
    rounded_box("Pump base rail right", (0.050, 0.005, 0.041), (0.028, 0.330, 0.024), dark, bevel=0.004)

    # Yellow two-stage pump block at the oil-gauge/front side.
    rounded_box("Pump cast crankcase", (0.0, -0.120, 0.100), (0.138, 0.130, 0.112), yellow, bevel=0.016)
    rounded_box("Pump stage cap", (0.0, -0.068, 0.143), (0.116, 0.055, 0.084), yellow_edge, bevel=0.012)
    for x in (-0.052, 0.052):
        for z in (0.074, 0.128):
            bolt(f"Crankcase fastener {x}_{z}", (x, -0.188, z), radius=0.005)

    # Oil level window, amber fill, drain plug, and readable front datum.
    cylinder("Oil gauge bezel", (0.0, -0.188, 0.095), 0.028, 0.010, black, vertices=40, rotation=(math.pi / 2, 0.0, 0.0), bevel=0.002)
    cylinder("Oil gauge glass", (0.0, -0.194, 0.095), 0.021, 0.004, MATERIALS["glass"], vertices=40, rotation=(math.pi / 2, 0.0, 0.0))
    cylinder("Visible amber oil", (0.0, -0.197, 0.089), 0.015, 0.002, MATERIALS["amber"], vertices=40, rotation=(math.pi / 2, 0.0, 0.0))
    cylinder_between("Oil drain plug", (-0.050, -0.192, 0.061), (-0.050, -0.207, 0.061), 0.010, MATERIALS["brass"], vertices=24, bevel=0.001)
    rounded_box("Pump datum label", (0.048, -0.194, 0.142), (0.039, 0.003, 0.023), MATERIALS["paper"], bevel=0.001)
    text_mesh("Pump generic VAC mark", "VAC", (0.048, -0.196, 0.142), 0.009, MATERIALS["graphite"])

    # Long ventilated motor body, cooling fins, and rear fan guard.
    cylinder_between("Motor stator body", (0.0, -0.045, 0.105), (0.0, 0.145, 0.105), 0.061, aluminum, vertices=56, bevel=0.004)
    cylinder_between("Motor front collar", (0.0, -0.050, 0.105), (0.0, -0.022, 0.105), 0.066, dark, vertices=48, bevel=0.003)
    for index, y in enumerate((-0.005, 0.020, 0.045, 0.070, 0.095, 0.120)):
        torus(f"Motor cooling fin {index + 1}", (0.0, y, 0.105), 0.062, 0.0030, dark, axis=(0.0, 1.0, 0.0), major_segments=44, minor_segments=8)
    cylinder_between("Rear fan housing", (0.0, 0.142, 0.105), (0.0, 0.188, 0.105), 0.064, black, vertices=56, bevel=0.004)
    torus("Rear fan guard ring", (0.0, 0.193, 0.105), 0.050, 0.003, steel, axis=(0.0, 1.0, 0.0), major_segments=44, minor_segments=8)
    for index in range(8):
        angle = index * math.tau / 8.0
        end = (math.cos(angle) * 0.046, 0.197, 0.105 + math.sin(angle) * 0.046)
        cylinder_between(f"Fan guard spoke {index + 1}", (0.0, 0.196, 0.105), end, 0.0017, steel, vertices=12)
    cylinder_between("Motor earth stud", (0.046, 0.188, 0.145), (0.057, 0.198, 0.151), 0.0045, MATERIALS["brass"], vertices=18, bevel=0.001)

    # Upright KF inlet, exhaust/oil fill, carry handle, switch, and power lead.
    cylinder("KF25 inlet neck", (-0.037, -0.105, 0.175), 0.016, 0.047, steel, vertices=40, bevel=0.002)
    cylinder("KF25 inlet flange", (-0.037, -0.105, 0.201), 0.027, 0.008, steel, vertices=48, bevel=0.002)
    torus("KF25 centering ring", (-0.037, -0.105, 0.205), 0.021, 0.0023, MATERIALS["rubber"], major_segments=40, minor_segments=8)
    cylinder("Outlet fill neck", (0.040, -0.090, 0.174), 0.012, 0.036, MATERIALS["brass"], vertices=32, bevel=0.002)
    cylinder("Outlet cap", (0.040, -0.090, 0.194), 0.019, 0.010, black, vertices=32, bevel=0.002)
    curve_tube(
        "Tubular carry handle",
        [(-0.062, -0.065, 0.128), (-0.064, 0.025, 0.202), (0.064, 0.025, 0.202), (0.062, -0.065, 0.128)],
        0.006,
        dark,
    )
    rounded_box("Motor switch enclosure", (0.050, 0.075, 0.166), (0.052, 0.066, 0.036), black, bevel=0.006)
    rounded_box("Motor rocker switch", (0.050, 0.040, 0.166), (0.022, 0.006, 0.016), MATERIALS["red"], bevel=0.002)
    curve_tube(
        "Rear power lead",
        [(0.045, 0.176, 0.077), (0.074, 0.185, 0.050), (0.074, 0.125, 0.028), (0.050, 0.095, 0.022)],
        0.004,
        rubber,
    )


def build_oven() -> None:
    white = MATERIALS["white"]
    cream = MATERIALS["cream"]
    steel = MATERIALS["steel"]
    polished = MATERIALS["polished"]
    black = MATERIALS["black"]
    rubber = MATERIALS["rubber"]
    dark = MATERIALS["dark_metal"]

    for prefix, x, y in (
        ("front_left", -0.300, -0.250),
        ("front_right", 0.300, -0.250),
        ("rear_left", -0.300, 0.250),
        ("rear_right", 0.300, 0.250),
    ):
        cylinder(f"Oven {prefix} foot", (x, y, 0.020), 0.026, 0.040, rubber, vertices=24, bevel=0.004)
        cylinder(f"Oven {prefix} leveller", (x, y, 0.049), 0.012, 0.018, polished, vertices=20, bevel=0.002)

    # Structural shell with a deep rear machinery volume and distinct seams.
    rounded_box("Oven main cabinet", (0.0, 0.018, 0.430), (0.690, 0.590, 0.790), white, bevel=0.018)
    rounded_box("Oven lower plinth", (0.0, 0.010, 0.083), (0.682, 0.584, 0.078), dark, bevel=0.010)
    rounded_box("Oven front gasket", (-0.070, -0.292, 0.455), (0.520, 0.016, 0.590), rubber, bevel=0.018)
    rounded_box("Insulated oven door", (-0.070, -0.316, 0.455), (0.535, 0.055, 0.605), cream, bevel=0.020)
    rounded_box("Door inner graphite frame", (-0.070, -0.347, 0.455), (0.355, 0.012, 0.405), black, bevel=0.019)
    rounded_box("Observation glass", (-0.070, -0.354, 0.455), (0.310, 0.010, 0.350), MATERIALS["dark_glass"], bevel=0.015)
    rounded_box("Visible chamber back", (-0.070, -0.270, 0.455), (0.292, 0.008, 0.330), steel, bevel=0.008)
    for z in (0.370, 0.495):
        rounded_box(f"Visible stainless shelf {z}", (-0.070, -0.318, z), (0.285, 0.075, 0.008), steel, bevel=0.002)
        for x in (-0.195, 0.055):
            rounded_box(f"Shelf rail {x}_{z}", (x, -0.315, z + 0.018), (0.008, 0.070, 0.038), polished, bevel=0.002)

    # Door hinges, insulated pull, and original unbranded warning marker.
    for z in (0.245, 0.665):
        rounded_box(f"Door hinge body {z}", (-0.345, -0.319, z), (0.035, 0.055, 0.078), dark, bevel=0.007)
        cylinder(f"Door hinge pin {z}", (-0.348, -0.351, z), 0.010, 0.084, polished, vertices=24, bevel=0.0015)
    cylinder_between("Oven door pull", (0.235, -0.375, 0.330), (0.235, -0.375, 0.590), 0.014, black, vertices=32, bevel=0.003)
    for z in (0.330, 0.590):
        cylinder_between(f"Door pull standoff {z}", (0.235, -0.345, z), (0.235, -0.375, z), 0.012, polished, vertices=24, bevel=0.002)
    rounded_box("Oven generic caution label", (-0.213, -0.351, 0.705), (0.095, 0.005, 0.052), MATERIALS["paper"], bevel=0.002)

    # Right-side PID controller: display, key matrix, status, and overtemp dial.
    rounded_box("Controller fascia", (0.252, -0.329, 0.575), (0.130, 0.030, 0.310), dark, bevel=0.012)
    rounded_box("PID display glass", (0.252, -0.348, 0.665), (0.095, 0.007, 0.055), MATERIALS["screen"], bevel=0.004)
    rounded_box("PID cyan readout", (0.252, -0.353, 0.667), (0.068, 0.003, 0.021), MATERIALS["display"], bevel=0.002)
    text_mesh("Oven temperature readout", "085", (0.252, -0.355, 0.667), 0.015, MATERIALS["paper"])
    for row in range(3):
        for column in range(3):
            rounded_box(
                f"Oven keypad {row}_{column}",
                (0.218 + column * 0.034, -0.350, 0.584 - row * 0.033),
                (0.022, 0.006, 0.020),
                MATERIALS["cream"],
                bevel=0.004,
            )
    cylinder("Overtemperature dial", (0.252, -0.350, 0.475), 0.025, 0.014, black, vertices=32, rotation=(math.pi / 2, 0.0, 0.0), bevel=0.003)
    cylinder("Green run lamp", (0.220, -0.354, 0.430), 0.008, 0.006, MATERIALS["green"], vertices=24, rotation=(math.pi / 2, 0.0, 0.0))
    cylinder("Red alarm lamp", (0.275, -0.354, 0.430), 0.008, 0.006, MATERIALS["red"], vertices=24, rotation=(math.pi / 2, 0.0, 0.0))

    # Two documented top exhaust collars and right-side cable port.
    for index, x in enumerate((-0.105, 0.105)):
        cylinder(f"Top exhaust collar {index + 1}", (x, 0.085, 0.835), 0.024, 0.050, steel, vertices=40, bevel=0.002)
        torus(f"Top exhaust rim {index + 1}", (x, 0.085, 0.860), 0.021, 0.0025, polished, major_segments=40, minor_segments=8)
    cylinder_between("Right cable port", (0.345, 0.055, 0.530), (0.359, 0.055, 0.530), 0.024, black, vertices=40, bevel=0.002)
    torus("Right cable gland", (0.360, 0.055, 0.530), 0.021, 0.003, polished, axis=(1.0, 0.0, 0.0), major_segments=40, minor_segments=8)

    # Rear forced-air service anatomy and mains connection.
    rounded_box("Oven rear service panel", (0.0, 0.316, 0.430), (0.565, 0.018, 0.605), cream, bevel=0.009)
    torus("Rear sirocco service grille", (0.0, 0.328, 0.500), 0.118, 0.006, dark, axis=(0.0, 1.0, 0.0), major_segments=56, minor_segments=10)
    for radius in (0.040, 0.073, 0.100):
        torus(f"Rear fan concentric guard {radius}", (0.0, 0.330, 0.500), radius, 0.003, dark, axis=(0.0, 1.0, 0.0), major_segments=48, minor_segments=8)
    for index in range(10):
        angle = index * math.tau / 10
        end = (math.cos(angle) * 0.115, 0.332, 0.500 + math.sin(angle) * 0.115)
        cylinder_between(f"Rear fan spoke {index + 1}", (0.0, 0.332, 0.500), end, 0.0023, dark, vertices=12)
    rounded_box("Rear mains inlet", (0.242, 0.329, 0.180), (0.075, 0.020, 0.055), black, bevel=0.006)
    curve_tube(
        "Oven rear power cord",
        [(0.242, 0.340, 0.180), (0.300, 0.355, 0.130), (0.315, 0.300, 0.075), (0.290, 0.255, 0.052)],
        0.007,
        rubber,
    )
    vent_bank(
        "Oven left cooling slot",
        (-0.351, -0.060, 0.160),
        rows=4,
        columns=1,
        spacing_x=0.0,
        spacing_z=0.030,
        slot=(0.006, 0.120, 0.011),
    )
    vent_bank(
        "Oven right cooling slot",
        (0.351, -0.060, 0.160),
        rows=4,
        columns=1,
        spacing_x=0.0,
        spacing_z=0.030,
        slot=(0.006, 0.120, 0.011),
    )


def build_heating_bath() -> None:
    teal = MATERIALS["teal"]
    cream = MATERIALS["cream"]
    yellow = MATERIALS["yellow_edge"]
    steel = MATERIALS["steel"]
    polished = MATERIALS["polished"]
    black = MATERIALS["black"]
    rubber = MATERIALS["rubber"]

    for prefix, x, y in (
        ("front_left", -0.530, -0.185),
        ("front_right", 0.530, -0.185),
        ("rear_left", -0.530, 0.185),
        ("rear_right", 0.530, 0.185),
    ):
        cylinder(f"Bath {prefix} foot", (x, y, 0.014), 0.026, 0.028, rubber, vertices=24, bevel=0.004)
        cylinder(f"Bath {prefix} stud", (x, y, 0.036), 0.012, 0.017, polished, vertices=18, bevel=0.002)

    rounded_box("Bath lower chassis", (0.0, 0.0, 0.085), (1.145, 0.440, 0.130), teal, bevel=0.020)
    rounded_box("Bath cream top band", (0.0, -0.005, 0.164), (1.170, 0.455, 0.050), cream, bevel=0.015)
    rounded_box("Bath stainless deck", (0.0, 0.015, 0.194), (1.125, 0.405, 0.018), steel, bevel=0.007)
    rounded_box("Bath yellow front index rail", (0.0, -0.232, 0.168), (1.145, 0.022, 0.050), yellow, bevel=0.007)

    positions = (-0.455, -0.275, -0.095, 0.095, 0.275, 0.455)
    for index, x in enumerate(positions):
        # Independent thermal well, vessel, liquid, retainer, and cap variation.
        cylinder(f"Bath well {index + 1}", (x, 0.050, 0.202), 0.067, 0.020, black, vertices=48, bevel=0.003)
        torus(f"Bath well stainless rim {index + 1}", (x, 0.050, 0.214), 0.061, 0.0045, polished, major_segments=48, minor_segments=10)
        cylinder(f"Glass vessel {index + 1}", (x, 0.050, 0.266), 0.050, 0.112, MATERIALS["glass"], vertices=48, bevel=0.002)
        cylinder(f"Amber bath fluid {index + 1}", (x, 0.050, 0.242), 0.043, 0.060, MATERIALS["amber"], vertices=48, bevel=0.002)
        torus(f"Glass lip {index + 1}", (x, 0.050, 0.322), 0.048, 0.003, polished, major_segments=48, minor_segments=8)
        if index in (1, 4):
            cylinder(f"Vessel lid {index + 1}", (x, 0.050, 0.328), 0.052, 0.012, cream, vertices=48, bevel=0.003)
            cylinder(f"Vessel lid knob {index + 1}", (x, 0.050, 0.340), 0.013, 0.015, black, vertices=28, bevel=0.002)

        # One analog dial, one status lamp, and one guarded switch per station.
        cylinder(f"Station knob bezel {index + 1}", (x, -0.239, 0.114), 0.025, 0.010, steel, vertices=32, rotation=(math.pi / 2, 0.0, 0.0), bevel=0.002)
        cylinder(f"Station control knob {index + 1}", (x, -0.247, 0.114), 0.019, 0.018, black, vertices=32, rotation=(math.pi / 2, 0.0, 0.0), bevel=0.003)
        cylinder(f"Station lamp {index + 1}", (x - 0.038, -0.246, 0.157), 0.0065, 0.007, MATERIALS["green"], vertices=20, rotation=(math.pi / 2, 0.0, 0.0))
        rounded_box(f"Station switch {index + 1}", (x + 0.037, -0.244, 0.157), (0.022, 0.007, 0.015), MATERIALS["red"], bevel=0.002)
        text_mesh(f"Station index {index + 1}", str(index + 1), (x, -0.248, 0.075), 0.017, MATERIALS["paper"])

    # Rear manifold and per-position copper service drops.
    cylinder_between("Bath rear service manifold", (-0.500, 0.222, 0.151), (0.500, 0.222, 0.151), 0.009, MATERIALS["copper"], vertices=28, bevel=0.0015)
    for index, x in enumerate(positions):
        cylinder_between(f"Bath service riser {index + 1}", (x, 0.219, 0.151), (x, 0.219, 0.212), 0.005, MATERIALS["copper"], vertices=20, bevel=0.001)
        cylinder(f"Bath rear valve {index + 1}", (x, 0.232, 0.155), 0.011, 0.015, MATERIALS["brass"], vertices=24, rotation=(math.pi / 2, 0.0, 0.0), bevel=0.002)
    rounded_box("Bath rear mains inlet", (0.485, 0.225, 0.092), (0.090, 0.022, 0.055), black, bevel=0.006)
    curve_tube(
        "Bath power cable",
        [(0.515, 0.232, 0.092), (0.565, 0.245, 0.068), (0.565, 0.185, 0.035), (0.530, 0.135, 0.022)],
        0.006,
        rubber,
    )
    vent_bank(
        "Bath left ventilation",
        (-0.574, -0.090, 0.080),
        rows=3,
        columns=1,
        spacing_x=0.0,
        spacing_z=0.027,
        slot=(0.006, 0.150, 0.011),
    )
    vent_bank(
        "Bath right ventilation",
        (0.574, -0.090, 0.080),
        rows=3,
        columns=1,
        spacing_x=0.0,
        spacing_z=0.027,
        slot=(0.006, 0.150, 0.011),
    )


def build_cold_trap_system() -> None:
    white = MATERIALS["white"]
    cream = MATERIALS["cream"]
    yellow = MATERIALS["yellow"]
    steel = MATERIALS["steel"]
    polished = MATERIALS["polished"]
    black = MATERIALS["black"]
    rubber = MATERIALS["rubber"]
    dark = MATERIALS["dark_metal"]

    # Mobile lower frame and detailed casters.
    for prefix, x, y in (
        ("front_left", -0.190, -0.205),
        ("front_right", 0.190, -0.205),
        ("rear_left", -0.190, 0.205),
        ("rear_right", 0.190, 0.205),
    ):
        cylinder(f"Trap {prefix} caster wheel", (x, y, 0.035), 0.035, 0.030, rubber, vertices=28, rotation=(0.0, math.pi / 2.0, 0.0), bevel=0.004)
        rounded_box(f"Trap {prefix} caster fork", (x, y, 0.067), (0.050, 0.045, 0.055), dark, bevel=0.007)
        cylinder(f"Trap {prefix} swivel", (x, y, 0.095), 0.018, 0.025, polished, vertices=24, bevel=0.002)
    rounded_box("Cold trap mobile plinth", (0.0, 0.0, 0.115), (0.455, 0.500, 0.065), dark, bevel=0.012)

    # Refrigerated chiller base with front controls and all-sided service panels.
    rounded_box("Cold trap chiller cabinet", (0.0, 0.020, 0.335), (0.440, 0.470, 0.390), white, bevel=0.022)
    rounded_box("Chiller lower compressor plinth", (0.0, 0.025, 0.185), (0.426, 0.456, 0.090), dark, bevel=0.012)
    rounded_box("Chiller controller fascia", (0.0, -0.228, 0.385), (0.305, 0.032, 0.175), cream, bevel=0.013)
    rounded_box("Chiller display glass", (-0.055, -0.249, 0.423), (0.118, 0.008, 0.052), MATERIALS["screen"], bevel=0.004)
    rounded_box("Chiller cyan readout", (-0.055, -0.254, 0.424), (0.083, 0.003, 0.020), MATERIALS["display"], bevel=0.002)
    text_mesh("Cold trap temperature", "-40", (-0.055, -0.256, 0.424), 0.015, MATERIALS["paper"])
    cylinder("Chiller set knob", (0.082, -0.250, 0.420), 0.024, 0.016, black, vertices=32, rotation=(math.pi / 2, 0.0, 0.0), bevel=0.003)
    rounded_box("Chiller main switch", (0.080, -0.250, 0.355), (0.038, 0.008, 0.025), MATERIALS["red"], bevel=0.004)
    cylinder("Chiller status lamp", (-0.092, -0.253, 0.355), 0.009, 0.007, MATERIALS["green"], vertices=24, rotation=(math.pi / 2, 0.0, 0.0))

    # Rear condenser grille, service ports, and power lead.
    rounded_box("Chiller rear service plate", (0.0, 0.260, 0.350), (0.360, 0.018, 0.270), cream, bevel=0.010)
    for radius in (0.050, 0.085, 0.115):
        torus(f"Chiller rear fan guard {radius}", (0.0, 0.273, 0.375), radius, 0.0035, dark, axis=(0.0, 1.0, 0.0), major_segments=44, minor_segments=8)
    for index in range(8):
        angle = index * math.tau / 8
        end = (math.cos(angle) * 0.115, 0.276, 0.375 + math.sin(angle) * 0.115)
        cylinder_between(f"Chiller fan spoke {index + 1}", (0.0, 0.276, 0.375), end, 0.0025, dark, vertices=12)
    rounded_box("Cold trap rear mains inlet", (0.150, 0.274, 0.235), (0.072, 0.020, 0.052), black, bevel=0.006)
    curve_tube(
        "Cold trap rear power lead",
        [(0.150, 0.280, 0.235), (0.210, 0.286, 0.190), (0.225, 0.235, 0.135), (0.195, 0.185, 0.105)],
        0.0065,
        rubber,
    )
    cylinder_between("Chiller drain port", (-0.165, 0.270, 0.245), (-0.165, 0.292, 0.245), 0.014, MATERIALS["brass"], vertices=24, bevel=0.002)
    curve_tube(
        "Chiller drain hose",
        [(-0.165, 0.292, 0.245), (-0.208, 0.283, 0.205), (-0.220, 0.240, 0.140), (-0.205, 0.200, 0.105)],
        0.006,
        MATERIALS["blue"],
    )

    # Upper support frame makes the stacked appliance mechanically believable.
    for x in (-0.185, 0.185):
        cylinder_between(f"Trap frame rear upright {x}", (x, 0.175, 0.515), (x, 0.175, 1.030), 0.012, polished, vertices=28, bevel=0.002)
        cylinder_between(f"Trap frame front upright {x}", (x, -0.175, 0.515), (x, -0.175, 1.030), 0.012, polished, vertices=28, bevel=0.002)
    for z in (0.560, 0.820, 1.020):
        rounded_box(f"Trap support shelf {z}", (0.0, 0.0, z), (0.420, 0.400, 0.025), steel, bevel=0.006)
    cylinder_between("Trap left push handle", (-0.225, 0.120, 0.730), (-0.225, 0.120, 0.960), 0.014, black, vertices=28, bevel=0.003)
    cylinder_between("Trap left handle upper", (-0.225, 0.120, 0.960), (-0.225, -0.085, 0.960), 0.014, black, vertices=28, bevel=0.003)

    # Refrigerated trap head, insulated vessel, KF ports, and lid clamp.
    rounded_box("Cold trap upper refrigeration head", (0.055, 0.070, 0.740), (0.300, 0.270, 0.175), cream, bevel=0.020)
    cylinder("Insulated trap well", (0.035, 0.020, 0.842), 0.118, 0.090, steel, vertices=56, bevel=0.004)
    cylinder("Borosilicate trap vessel", (0.035, 0.020, 0.925), 0.092, 0.165, MATERIALS["glass"], vertices=56, bevel=0.003)
    cylinder("Trap condensate", (0.035, 0.020, 0.885), 0.078, 0.070, MATERIALS["amber"], vertices=56, bevel=0.003)
    torus("Trap vessel lower flange", (0.035, 0.020, 0.850), 0.098, 0.006, polished, major_segments=56, minor_segments=10)
    cylinder("Trap stainless lid", (0.035, 0.020, 1.020), 0.105, 0.034, polished, vertices=56, bevel=0.005)
    torus("Trap lid clamp", (0.035, 0.020, 1.006), 0.103, 0.006, MATERIALS["yellow_edge"], major_segments=56, minor_segments=10)
    cylinder("Trap lid knob", (0.035, 0.020, 1.050), 0.025, 0.032, black, vertices=32, bevel=0.004)
    for prefix, x in (("inlet", -0.030), ("outlet", 0.100)):
        cylinder_between(f"Trap {prefix} port neck", (x, 0.020, 1.025), (x, -0.090, 1.025), 0.016, polished, vertices=36, bevel=0.002)
        torus(f"Trap {prefix} KF flange", (x, -0.092, 1.025), 0.025, 0.004, polished, axis=(0.0, 1.0, 0.0), major_segments=40, minor_segments=8)

    # Twin front gauges and documented-looking service separation.
    for index, x in enumerate((-0.105, 0.105)):
        cylinder(f"Trap gauge bezel {index + 1}", (x, -0.190, 0.736), 0.046, 0.020, black, vertices=48, rotation=(math.pi / 2, 0.0, 0.0), bevel=0.003)
        cylinder(f"Trap gauge face {index + 1}", (x, -0.202, 0.736), 0.038, 0.005, MATERIALS["paper"], vertices=48, rotation=(math.pi / 2, 0.0, 0.0))
        cylinder_between(f"Trap gauge needle {index + 1}", (x, -0.206, 0.736), (x + 0.018, -0.207, 0.752), 0.0018, MATERIALS["red"], vertices=12)
    rounded_box("Trap station generic label", (0.0, -0.190, 0.642), (0.168, 0.004, 0.042), MATERIALS["paper"], bevel=0.002)
    text_mesh("Trap station VAC label", "COLD TRAP", (0.0, -0.193, 0.642), 0.015, MATERIALS["graphite"])

    # Compact yellow companion pump on the lowest service shelf.
    rounded_box("Companion pump crankcase", (-0.080, -0.075, 0.580), (0.155, 0.145, 0.105), yellow, bevel=0.015)
    cylinder_between("Companion pump motor", (0.010, -0.075, 0.595), (0.155, -0.075, 0.595), 0.050, MATERIALS["aluminum"], vertices=48, bevel=0.003)
    for index, x in enumerate((0.040, 0.070, 0.100, 0.130)):
        torus(f"Companion motor fin {index + 1}", (x, -0.075, 0.595), 0.050, 0.003, dark, axis=(1.0, 0.0, 0.0), major_segments=40, minor_segments=8)
    cylinder("Companion inlet", (-0.100, -0.075, 0.645), 0.018, 0.040, polished, vertices=36, bevel=0.002)
    torus("Companion inlet flange", (-0.100, -0.075, 0.666), 0.024, 0.004, polished, major_segments=40, minor_segments=8)

    # Flexible vacuum and coolant routing is visible from front, rear, and sides.
    curve_tube(
        "Trap vacuum hose",
        [(-0.030, -0.094, 1.025), (-0.205, -0.185, 0.965), (-0.205, -0.195, 0.750), (-0.145, -0.135, 0.680), (-0.100, -0.075, 0.666)],
        0.011,
        rubber,
    )
    curve_tube(
        "Trap coolant hose blue",
        [(0.100, -0.094, 1.025), (0.210, -0.150, 0.940), (0.215, 0.080, 0.760), (0.150, 0.180, 0.705), (0.100, 0.160, 0.645)],
        0.008,
        MATERIALS["blue"],
    )
    curve_tube(
        "Trap copper return",
        [(0.080, 0.145, 0.650), (0.160, 0.180, 0.720), (0.155, 0.185, 0.900), (0.105, 0.120, 0.985)],
        0.006,
        MATERIALS["copper"],
    )


def mesh_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def apply_modifiers() -> None:
    for obj in list(mesh_objects()):
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)


def consolidate_by_material() -> None:
    """Join static parts sharing a PBR material into one runtime mesh group."""
    apply_modifiers()
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import reference_finishes
    reference_finishes.apply(sys.modules[__name__])
    groups: dict[str, list[bpy.types.Object]] = {}
    for obj in mesh_objects():
        key = obj.material_slots[0].material.name if obj.material_slots else "unassigned"
        groups.setdefault(key, []).append(obj)
    for material_name, objects in groups.items():
        if len(objects) == 1:
            objects[0].name = f"PBR {material_name}"
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        joined = bpy.context.object
        joined.name = f"PBR {material_name}"
        joined.select_set(False)


def bounds() -> tuple[Vector, Vector]:
    meshes = mesh_objects()
    if not meshes:
        raise RuntimeError("No mesh objects in authored scene")
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = Vector(tuple(min(point[index] for point in points) for index in range(3)))
    maximum = Vector(tuple(max(point[index] for point in points) for index in range(3)))
    return minimum, maximum


def fit_to_dimensions(target_dimensions: tuple[float, float, float]) -> None:
    if ROOT is None:
        raise RuntimeError("Missing asset root")
    minimum, maximum = bounds()
    current = maximum - minimum
    target = Vector(target_dimensions)
    scale = Vector((target.x / current.x, target.y / current.y, target.z / current.z))
    ROOT.scale = scale
    ROOT.location = Vector(
        (
            -((minimum.x + maximum.x) * 0.5) * scale.x,
            -((minimum.y + maximum.y) * 0.5) * scale.y,
            -minimum.z * scale.z,
        )
    )
    bpy.context.view_layer.update()


def triangle_count(obj: bpy.types.Object) -> int:
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def scene_report(asset_id: str, path: Path | None = None) -> dict[str, object]:
    minimum, maximum = bounds()
    meshes = mesh_objects()
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
        "vertices": sum(len(obj.data.vertices) for obj in meshes),
        "triangles": sum(triangle_count(obj) for obj in meshes),
        "cameras": sum(obj.type == "CAMERA" for obj in bpy.context.scene.objects),
        "lights": sum(obj.type == "LIGHT" for obj in bpy.context.scene.objects),
        "bounds_m": {
            "min": [round(value, 6) for value in minimum],
            "max": [round(value, 6) for value in maximum],
            "dimensions": [round(value, 6) for value in maximum - minimum],
        },
    }
    if path is not None:
        report["file"] = str(path.resolve())
        report["bytes"] = path.stat().st_size
    return report


def validate_report(asset_id: str, report: dict[str, object], *, imported: bool) -> None:
    expected = Vector(ASSETS[asset_id]["dimensions"])
    actual = Vector(report["bounds_m"]["dimensions"])
    minimum = Vector(report["bounds_m"]["min"])
    errors: list[str] = []
    for axis, value, target in zip("xyz", actual, expected):
        if abs(value - target) > (0.008 if imported else 0.002):
            errors.append(f"{axis} dimension {value:.4f} m != {target:.4f} m")
    if abs(minimum.z) > (0.006 if imported else 0.001):
        errors.append(f"minimum z {minimum.z:.5f} m is not grounded")
    if not 8 <= int(report["mesh_objects"]) <= 24:
        errors.append(f"mesh groups {report['mesh_objects']} outside 8-24")
    if int(report["materials"]) < 8:
        errors.append(f"only {report['materials']} PBR materials")
    if int(report["triangles"]) < 8_000:
        errors.append(f"only {report['triangles']} triangles")
    if int(report["cameras"]) or int(report["lights"]):
        errors.append("production scene contains a camera or light")
    if imported and int(report.get("bytes", 0)) < 100_000:
        errors.append("GLB is unexpectedly smaller than 100 KB")
    if imported and int(report.get("bytes", 0)) > 12 * 1024 * 1024:
        errors.append("GLB exceeds the 12 MB authored-model budget")
    if errors:
        phase = "imported GLB" if imported else "authored scene"
        raise RuntimeError(f"{asset_id} {phase} validation failed: {'; '.join(errors)}")


def export_glb(path: Path, *, draco: bool) -> None:
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
        export_draco_mesh_compression_enable=draco,
        export_draco_mesh_compression_level=6,
        export_loglevel=-1,
    )
    if "FINISHED" not in result:
        raise RuntimeError(f"GLB export failed: {result}")


def reimport_and_inspect(asset_id: str, path: Path) -> dict[str, object]:
    reset_scene(asset_id)
    result = bpy.ops.import_scene.gltf(filepath=str(path.resolve()))
    if "FINISHED" not in result:
        raise RuntimeError(f"Could not re-import generated GLB: {path}")
    bpy.context.view_layer.update()
    report = scene_report(asset_id, path)
    validate_report(asset_id, report, imported=True)
    return report


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area_light(
    name: str,
    target: Vector,
    offset: tuple[float, float, float],
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
    obj.location = target + Vector(offset)
    look_at(obj, target)


def render_orbit_previews(asset_id: str, output_dir: Path) -> list[str]:
    """Render four QA views after GLB re-import; never modifies the delivered file."""
    minimum, maximum = bounds()
    dimensions = maximum - minimum
    target = (minimum + maximum) * 0.5
    scale = max(dimensions.x, dimensions.y, dimensions.z, 0.1)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 560
    scene.render.resolution_y = 560
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 28
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.film_transparent = False
    world = bpy.data.worlds.new(f"{asset_id} QA world")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.040, 0.052, 0.067, 1.0)
    background.inputs["Strength"].default_value = 0.30
    scene.world = world

    floor_mat = material(f"{asset_id} QA floor", (0.12, 0.14, 0.17, 1.0), roughness=0.58)
    rounded_box(
        f"{asset_id} QA studio floor",
        (0.0, 0.0, -0.030 * scale),
        (5.0 * scale, 5.0 * scale, 0.050 * scale),
        floor_mat,
        bevel=0.010 * scale,
    )
    add_area_light("QA key", target, (-1.6 * scale, -1.7 * scale, 2.2 * scale), 460 * scale * scale, 1.3 * scale, (1.0, 0.92, 0.84))
    add_area_light("QA fill", target, (1.8 * scale, -0.3 * scale, 1.4 * scale), 280 * scale * scale, 1.1 * scale, (0.78, 0.88, 1.0))
    add_area_light("QA rim", target, (0.2 * scale, 1.7 * scale, 2.0 * scale), 360 * scale * scale, 0.9 * scale, (0.78, 0.88, 1.0))

    camera_data = bpy.data.cameras.new(f"{asset_id} QA camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = max(dimensions.z * 1.18, max(dimensions.x, dimensions.y) * 1.28)
    camera_data.clip_start = 0.01
    camera_data.clip_end = 20 * scale
    camera = bpy.data.objects.new(f"{asset_id} QA camera", camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera
    output_dir.mkdir(parents=True, exist_ok=True)
    views = {
        "front": Vector((0.0, -1.0, 0.26)),
        "rear": Vector((0.0, 1.0, 0.26)),
        "left": Vector((-1.0, 0.0, 0.26)),
        "right": Vector((1.0, 0.0, 0.26)),
    }
    outputs: list[str] = []
    for name, direction in views.items():
        camera.location = target + direction.normalized() * (4.5 * scale)
        look_at(camera, target)
        output = (output_dir / f"{asset_id}-{name}-qa.png").resolve()
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        outputs.append(str(output))
    return outputs


def build_one(
    asset_id: str,
    output_dir: Path,
    *,
    draco: bool,
    preview_dir: Path | None,
    save_blend_dir: Path | None,
) -> dict[str, object]:
    reset_scene(asset_id)
    build_materials()
    create_root(asset_id)
    builders = {
        "vacuum-pump": build_vacuum_pump,
        "forced-air-lab-oven": build_oven,
        "multi-position-heating-bath": build_heating_bath,
        "vacuum-cold-trap-system": build_cold_trap_system,
    }
    builders[asset_id]()
    consolidate_by_material()
    fit_to_dimensions(ASSETS[asset_id]["dimensions"])
    authored_report = scene_report(asset_id)
    validate_report(asset_id, authored_report, imported=False)
    if save_blend_dir is not None:
        save_blend_dir.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str((save_blend_dir / f"{asset_id}.blend").resolve()))
    output_path = output_dir / ASSETS[asset_id]["filename"]
    export_glb(output_path, draco=draco)
    imported_report = reimport_and_inspect(asset_id, output_path)
    if preview_dir is not None:
        imported_report["previews"] = render_orbit_previews(asset_id, preview_dir)
    print("LABSPACE_GLTF_INSPECT " + json.dumps(imported_report, sort_keys=True))
    return imported_report


def main() -> None:
    args = parse_args()
    selected = tuple(ASSETS) if args.asset == "all" else (args.asset,)
    output_dir = Path(args.output_dir)
    preview_dir = Path(args.preview_dir) if args.preview_dir else None
    save_blend_dir = Path(args.save_blend_dir) if args.save_blend_dir else None
    reports = [
        build_one(
            asset_id,
            output_dir,
            draco=args.draco,
            preview_dir=preview_dir,
            save_blend_dir=save_blend_dir,
        )
        for asset_id in selected
    ]
    print("LABSPACE_EQUIPMENT_BATCH2_COMPLETE " + json.dumps(reports, sort_keys=True))


if __name__ == "__main__":
    main()
