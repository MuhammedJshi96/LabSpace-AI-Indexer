"""Reference-led GPU workstation product builder for batch 14.

This is an isolated geometry module.  The caller owns scene reset, root
creation, shared material registration, source saving, and runtime export.
The source of truth is the September 2 product sheet: a 1200 x 600 x 750 mm
light-wood desk on a welded 25 mm square-tube frame, with an under-desk tower
shelf, rear modesty panel, mounted power strip, and deliberate cable routing.

The model is original and logo-free.  Every enclosure is opaque; the tower is
a complete serviceable chassis rather than an open display shell.  Names are
manufacturing roles so source-scene and continuity audits remain legible.
"""
from __future__ import annotations

import math
from collections.abc import Iterable

import bpy
from mathutils import Vector

import lab_furniture as f


ASSET_ID = "gpu-analysis-workstation"
DESK_WIDTH_M = 1.200
DESK_DEPTH_M = 0.600
DESK_HEIGHT_M = 0.750
TOP_THICKNESS_M = 0.025
FRAME_SECTION_M = 0.025
TARGET_OVERALL_HEIGHT_M = 1.250


# Fixed load-bearing or panel-closing interfaces.  Each pair is intended to
# touch or overlap; the smoke test applies the authored 2 mm continuity gate.
CONTACT_PAIRS: dict[str, tuple[tuple[str, str], ...]] = {
    ASSET_ID: (
        ("Light wood worktop", "Front welded top rail"),
        ("Light wood worktop", "Rear welded top rail"),
        ("Light wood worktop", "Left welded top rail"),
        ("Light wood worktop", "Right welded top rail"),
        ("Front left square-tube leg", "Front welded top rail"),
        ("Front right square-tube leg", "Front welded top rail"),
        ("Rear left square-tube leg", "Rear welded top rail"),
        ("Rear right square-tube leg", "Rear welded top rail"),
        ("Tower shelf board", "Tower shelf front rail"),
        ("Tower shelf board", "Tower shelf rear rail"),
        ("Tower shelf front rail", "Tower bay front inner post"),
        ("Tower shelf rear rail", "Tower bay rear inner post"),
        ("Tower chassis floor", "Tower left tempered side panel"),
        ("Tower chassis floor", "Tower right side panel"),
        ("Tower chassis roof", "Tower left tempered side panel"),
        ("Tower chassis roof", "Tower right side panel"),
        ("Monitor base", "Monitor stand neck"),
        ("Monitor stand neck", "Monitor rear enclosure"),
        ("Rear modesty panel", "Rear modesty left mounting return"),
        ("Rear modesty panel", "Rear modesty right mounting return"),
    )
}


def _material(*keys: str) -> bpy.types.Material:
    """Return the first registered material and enforce an opaque contract."""
    material = next((f.MATERIALS[key] for key in keys if key in f.MATERIALS), None)
    if material is None:
        raise RuntimeError(
            "GPU workstation requires caller-registered material: "
            + " or ".join(keys)
        )
    alpha = float(material.diffuse_color[3]) if len(material.diffuse_color) > 3 else 1.0
    transmission = 0.0
    if material.use_nodes and material.node_tree:
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if bsdf is not None:
            alpha_socket = bsdf.inputs.get("Alpha")
            transmission_socket = bsdf.inputs.get("Transmission Weight")
            if alpha_socket is not None:
                alpha = min(alpha, float(alpha_socket.default_value))
            if transmission_socket is not None:
                transmission = float(transmission_socket.default_value)
    if alpha < 0.999 or transmission > 0.001:
        raise RuntimeError(
            f"Workstation material must be opaque: {material.name} "
            f"(alpha={alpha:.4f}, transmission={transmission:.4f})"
        )
    return material


def _validate_context(spec: f.AssetSpec) -> None:
    if f.ROOT is None:
        raise RuntimeError("Caller must create lab_furniture.ROOT before build(spec)")
    if not f.MATERIALS:
        raise RuntimeError("Caller must register shared lab_furniture materials")
    tolerance = 0.005
    if abs(spec.width - DESK_WIDTH_M) > tolerance:
        raise ValueError(f"Reference width is 1.200 m, received {spec.width:.4f} m")
    if abs(spec.depth - DESK_DEPTH_M) > tolerance:
        raise ValueError(f"Reference depth is 0.600 m, received {spec.depth:.4f} m")
    if abs(spec.height - TARGET_OVERALL_HEIGHT_M) > tolerance:
        raise ValueError(
            "For this product builder AssetSpec.height is the complete monitor "
            f"envelope (1.250 m), received {spec.height:.4f} m"
        )


def _box(
    name: str,
    xyz: tuple[float, float, float],
    size: tuple[float, float, float],
    materials: str | tuple[str, ...],
    *,
    bevel: float = 0.002,
    category: str,
) -> bpy.types.Object:
    keys = (materials,) if isinstance(materials, str) else materials
    return f.add_box(
        name,
        xyz,
        size,
        _material(*keys),
        bevel=min(bevel, 0.012),
        category=category,
    )


def _transparent_box(
    name: str,
    xyz: tuple[float, float, float],
    size: tuple[float, float, float],
    material_key: str,
    *,
    bevel: float = 0.002,
    category: str,
) -> bpy.types.Object:
    """Create the one explicitly allowed transparent workstation component."""
    material = f.MATERIALS.get(material_key)
    if material is None:
        raise RuntimeError(f"Missing workstation glass material: {material_key}")
    return f.add_box(
        name,
        xyz,
        size,
        material,
        bevel=min(bevel, 0.012),
        category=category,
    )


def _cylinder(
    name: str,
    xyz: tuple[float, float, float],
    radius: float,
    depth: float,
    materials: str | tuple[str, ...],
    *,
    axis: tuple[float, float, float] = (0.0, 0.0, 1.0),
    vertices: int = 24,
    bevel: float = 0.001,
    category: str,
) -> bpy.types.Object:
    keys = (materials,) if isinstance(materials, str) else materials
    return f.add_cylinder(
        name,
        xyz,
        radius,
        depth,
        _material(*keys),
        axis=axis,
        vertices=vertices,
        bevel=bevel,
        category=category,
    )


def _torus(
    name: str,
    xyz: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    materials: str | tuple[str, ...],
    *,
    axis: tuple[float, float, float] = (0.0, 0.0, 1.0),
    category: str,
) -> bpy.types.Object:
    keys = (materials,) if isinstance(materials, str) else materials
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=24,
        minor_segments=6,
        location=xyz,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(
        Vector(axis).normalized()
    )
    f.assign_material(obj, _material(*keys))
    f.smooth(obj)
    return f.parent_to_root(obj, category)


def _sphere(
    name: str,
    xyz: tuple[float, float, float],
    scale: tuple[float, float, float],
    materials: str | tuple[str, ...],
    *,
    category: str,
) -> bpy.types.Object:
    keys = (materials,) if isinstance(materials, str) else materials
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=24,
        ring_count=12,
        location=xyz,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    f.assign_material(obj, _material(*keys))
    f.smooth(obj)
    return f.parent_to_root(obj, category)


def _curve_tube(
    name: str,
    points: Iterable[tuple[float, float, float]],
    radius: float,
    materials: str | tuple[str, ...] = ("rubber", "seal", "graphite"),
    *,
    category: str = "cable",
) -> bpy.types.Object:
    coordinates = list(points)
    if len(coordinates) < 2:
        raise ValueError("Cable curve requires at least two points")
    keys = (materials,) if isinstance(materials, str) else materials
    curve = bpy.data.curves.new(name=name + " path", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new(type="BEZIER")
    spline.bezier_points.add(len(coordinates) - 1)
    for point, coordinate in zip(spline.bezier_points, coordinates):
        point.co = Vector(coordinate)
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    f.assign_material(obj, _material(*keys))
    f.parent_to_root(obj, category)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.name = name
    f.smooth(obj)
    return obj


def _directional_wood_uv(obj: bpy.types.Object) -> None:
    """Apply dimension-led UVs with the dominant grain running along desk X."""
    mesh = obj.data
    uv_layer = mesh.uv_layers.active or mesh.uv_layers.new(name="Directional wood UV")
    for polygon in mesh.polygons:
        normal = polygon.normal
        for loop_index in polygon.loop_indices:
            vertex = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            if abs(normal.z) > 0.70:
                uv = (vertex.x / 0.36, vertex.y / 0.12)
            elif abs(normal.y) > 0.70:
                uv = (vertex.x / 0.36, vertex.z / 0.08)
            else:
                uv = (vertex.y / 0.12, vertex.z / 0.08)
            uv_layer.data[loop_index].uv = uv
    obj["labspace_uv_role"] = "directional-light-wood"
    obj["labspace_grain_axis"] = "local-x"
    obj["labspace_texture_scale_m"] = [0.36, 0.12]


def _curved_monitor_solid(
    name: str,
    *,
    center_x: float,
    center_y: float,
    center_z: float,
    width: float,
    height: float,
    depth: float,
    curvature: float,
    materials: str | tuple[str, ...],
    category: str,
    segments: int = 36,
) -> bpy.types.Object:
    """Create a watertight curved display shell with real front/back depth."""
    vertices: list[tuple[float, float, float]] = []
    for side in (0, 1):
        for row_z in (-height / 2, height / 2):
            for index in range(segments + 1):
                local_x = -width / 2 + width * index / segments
                normalized = local_x / (width / 2)
                # Viewer is on -Y: the centre recedes toward +Y while both
                # outer edges wrap forward, producing a genuinely concave
                # ultrawide display instead of the rejected convex bow.
                front_y = center_y + curvature * (1.0 - normalized * normalized)
                vertices.append(
                    (center_x + local_x, front_y + side * depth, center_z + row_z)
                )
    row = segments + 1
    front_bottom = 0
    front_top = row
    rear_bottom = row * 2
    rear_top = row * 3
    faces: list[tuple[int, int, int, int]] = []
    for index in range(segments):
        n = index + 1
        faces.extend(
            (
                (front_bottom + index, front_bottom + n, front_top + n, front_top + index),
                (rear_bottom + n, rear_bottom + index, rear_top + index, rear_top + n),
                (front_bottom + index, rear_bottom + index, rear_bottom + n, front_bottom + n),
                (front_top + n, rear_top + n, rear_top + index, front_top + index),
            )
        )
    faces.extend(
        (
            (front_bottom, front_top, rear_top, rear_bottom),
            (
                front_bottom + segments,
                rear_bottom + segments,
                rear_top + segments,
                front_top + segments,
            ),
        )
    )
    mesh = bpy.data.meshes.new(name + " curved manufactured mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    keys = (materials,) if isinstance(materials, str) else materials
    f.assign_material(obj, _material(*keys))
    modifier = obj.modifiers.new(name="Manufactured edge", type="BEVEL")
    modifier.width = min(.004, depth * .20)
    modifier.segments = 3
    modifier.limit_method = "ANGLE"
    modifier.harden_normals = True
    return f.parent_to_root(obj, category)


def _levelling_foot(name: str, x: float, y: float) -> None:
    _cylinder(
        name + " rubber glide",
        (x, y, 0.007),
        0.016,
        0.014,
        ("rubber", "seal", "graphite"),
        vertices=24,
        category="levelling foot",
    )
    _cylinder(
        name + " threaded stem",
        (x, y, 0.021),
        0.006,
        0.020,
        ("stainless", "zinc", "mid_grey"),
        vertices=16,
        category="levelling foot",
    )


def _frame() -> None:
    tube = FRAME_SECTION_M
    leg_x = DESK_WIDTH_M / 2 - 0.045
    leg_y = DESK_DEPTH_M / 2 - 0.045
    rail_z = DESK_HEIGHT_M - TOP_THICKNESS_M - tube / 2
    leg_bottom = 0.024
    leg_top = rail_z + tube / 2
    leg_height = leg_top - leg_bottom
    leg_center = (leg_top + leg_bottom) / 2
    frame_material = ("black_powder", "powder_dark", "graphite")

    _box(
        "Front welded top rail",
        (0, -leg_y, rail_z),
        (leg_x * 2 + tube, tube, tube),
        frame_material,
        bevel=0.002,
        category="welded square-tube frame",
    )
    _box(
        "Rear welded top rail",
        (0, leg_y, rail_z),
        (leg_x * 2 + tube, tube, tube),
        frame_material,
        bevel=0.002,
        category="welded square-tube frame",
    )
    _box(
        "Left welded top rail",
        (-leg_x, 0, rail_z),
        (tube, leg_y * 2 + tube, tube),
        frame_material,
        bevel=0.002,
        category="welded square-tube frame",
    )
    _box(
        "Right welded top rail",
        (leg_x, 0, rail_z),
        (tube, leg_y * 2 + tube, tube),
        frame_material,
        bevel=0.002,
        category="welded square-tube frame",
    )

    for name, x, y in (
        ("Front left square-tube leg", -leg_x, -leg_y),
        ("Front right square-tube leg", leg_x, -leg_y),
        ("Rear left square-tube leg", -leg_x, leg_y),
        ("Rear right square-tube leg", leg_x, leg_y),
    ):
        obj = _box(
            name,
            (x, y, leg_center),
            (tube, tube, leg_height),
            frame_material,
            bevel=0.002,
            category="welded square-tube frame",
        )
        obj["joinery"] = "positive-bearing welded mitre"
        _levelling_foot(name, x, y)

    # The left low stretcher and the right shelf bay reproduce the actual
    # reference frame rather than a generic four-leg table.
    _box(
        "Left lower side stretcher",
        (-leg_x, 0, 0.135),
        (tube, leg_y * 2 + tube, tube),
        frame_material,
        bevel=0.002,
        category="welded square-tube frame",
    )

    inner_x = 0.285
    for name, y in (
        ("Tower bay front inner post", -leg_y),
        ("Tower bay rear inner post", leg_y),
    ):
        _box(
            name,
            (inner_x, y, leg_center),
            (tube, tube, leg_height),
            frame_material,
            bevel=0.002,
            category="tower shelf frame",
        )
        _levelling_foot(name, inner_x, y)

    shelf_center_x = (inner_x + leg_x) / 2
    shelf_width = leg_x - inner_x + tube
    # The shelf frame reaches the front/rear posts with a small welded overlap;
    # the earlier 455 mm draft stopped 15 mm short at both ends.
    shelf_depth = 0.505
    shelf_rail_z = 0.082
    for name, y in (
        ("Tower shelf front rail", -shelf_depth / 2 + tube / 2),
        ("Tower shelf rear rail", shelf_depth / 2 - tube / 2),
    ):
        _box(
            name,
            (shelf_center_x, y, shelf_rail_z),
            (shelf_width, tube, tube),
            frame_material,
            bevel=0.002,
            category="tower shelf frame",
        )
    for name, x in (
        ("Tower shelf inner side rail", inner_x),
        ("Tower shelf outer side rail", leg_x),
    ):
        _box(
            name,
            (x, 0, shelf_rail_z),
            (tube, shelf_depth, tube),
            frame_material,
            bevel=0.002,
            category="tower shelf frame",
        )

    shelf = _box(
        "Tower shelf board",
        (shelf_center_x, 0, 0.105),
        (shelf_width - 0.018, shelf_depth - 0.018, 0.021),
        ("maple", "warm_white", "powder_light"),
        bevel=0.005,
        category="tower shelf",
    )
    _directional_wood_uv(shelf)


def _worktop() -> None:
    top_center_z = DESK_HEIGHT_M - TOP_THICKNESS_M / 2
    top = _box(
        "Light wood worktop",
        (0, 0, top_center_z),
        (DESK_WIDTH_M - 0.016, DESK_DEPTH_M - 0.016, TOP_THICKNESS_M),
        ("maple", "warm_white", "powder_light"),
        bevel=0.010,
        category="directional wood worktop",
    )
    _directional_wood_uv(top)
    top["reference_thickness_mm"] = 25
    for name, xyz, size in (
        (
            "Front wood edge band",
            (0, -DESK_DEPTH_M / 2 + 0.004, top_center_z),
            (DESK_WIDTH_M - 0.016, 0.008, TOP_THICKNESS_M - 0.002),
        ),
        (
            "Rear wood edge band",
            (0, DESK_DEPTH_M / 2 - 0.004, top_center_z),
            (DESK_WIDTH_M - 0.016, 0.008, TOP_THICKNESS_M - 0.002),
        ),
        (
            "Left wood edge band",
            (-DESK_WIDTH_M / 2 + 0.004, 0, top_center_z),
            (0.008, DESK_DEPTH_M, TOP_THICKNESS_M - 0.002),
        ),
        (
            "Right wood edge band",
            (DESK_WIDTH_M / 2 - 0.004, 0, top_center_z),
            (0.008, DESK_DEPTH_M, TOP_THICKNESS_M - 0.002),
        ),
    ):
        edge = _box(
            name,
            xyz,
            size,
            ("maple_edge", "maple", "warm_white"),
            bevel=0.002,
            category="worktop edge band",
        )
        _directional_wood_uv(edge)

    # The source sheet explicitly requires a 60 mm grommet.  This restrained
    # collar plus recessed core is the only circular service fitting on the top.
    gx, gy = 0.245, 0.115
    _cylinder(
        "Sixty millimetre cable grommet recess",
        (gx, gy, DESK_HEIGHT_M - 0.003),
        0.025,
        0.005,
        ("graphite", "black_powder", "seal"),
        vertices=32,
        category="cable grommet",
    )
    _torus(
        "Sixty millimetre cable grommet collar",
        (gx, gy, DESK_HEIGHT_M + 0.0015),
        0.026,
        0.0035,
        ("graphite", "black_powder", "seal"),
        category="cable grommet",
    )
    _box(
        "Cable grommet split flap",
        (gx + 0.008, gy, DESK_HEIGHT_M + 0.002),
        (0.025, 0.005, 0.003),
        ("seal", "graphite", "black_powder"),
        bevel=0.001,
        category="cable grommet",
    )


def _rear_service() -> None:
    # Panel closes the user-facing rear zone and terminates positively at the
    # rear left leg and the inner tower-bay post through folded side returns.
    panel_left = -0.542
    panel_right = 0.297
    panel_center_x = (panel_left + panel_right) / 2
    panel_width = panel_right - panel_left
    _box(
        "Rear modesty panel",
        (panel_center_x, 0.245, 0.505),
        (panel_width, 0.012, 0.315),
        ("black_powder", "powder_dark", "graphite"),
        bevel=0.002,
        category="rear modesty panel",
    )
    _box(
        "Rear modesty left mounting return",
        (panel_left - 0.006, 0.237, 0.505),
        (0.012, 0.030, 0.315),
        ("black_powder", "powder_dark", "graphite"),
        bevel=0.001,
        category="rear modesty panel",
    )
    _box(
        "Rear modesty right mounting return",
        (panel_right + 0.006, 0.237, 0.505),
        (0.012, 0.030, 0.315),
        ("black_powder", "powder_dark", "graphite"),
        bevel=0.001,
        category="rear modesty panel",
    )
    strip_x, strip_y, strip_z = -0.085, 0.229, 0.658
    _box(
        "Under-desk power strip body",
        (strip_x, strip_y, strip_z),
        (0.395, 0.038, 0.060),
        ("graphite", "black_powder", "powder_dark"),
        bevel=0.006,
        category="power distribution",
    )
    for index, x in enumerate((-0.230, -0.162, -0.094, -0.026, 0.042), start=1):
        _torus(
            f"Power strip socket {index} rim",
            (x, strip_y - 0.021, strip_z),
            0.0105,
            0.0022,
            ("cool_grey", "mid_grey", "powder_light"),
            axis=(0, 1, 0),
            category="power distribution",
        )
        _cylinder(
            f"Power strip socket {index} well",
            (x, strip_y - 0.022, strip_z),
            0.008,
            0.004,
            ("shadow", "seal", "graphite"),
            axis=(0, 1, 0),
            vertices=20,
            bevel=0,
            category="power distribution",
        )
    _box(
        "Power strip guarded switch",
        (0.078, strip_y - 0.022, strip_z),
        (0.027, 0.005, 0.020),
        ("red", "teal", "screen_ui"),
        bevel=0.003,
        category="power distribution",
    )
    _box(
        "Power strip inlet and breaker",
        (0.104, strip_y - 0.022, strip_z),
        (0.018, 0.005, 0.022),
        ("shadow", "seal", "graphite"),
        bevel=0.002,
        category="power distribution",
    )


def _monitor() -> None:
    x, y = -0.145, 0.102
    # The user-facing side is -Y. Keep the broad foot centred beneath the
    # display, but place the upright, pivot and VESA connection entirely on
    # the +Y service side so no stand hardware crosses the visible pixels.
    stand_rear_y = y + 0.080
    monitor_bottom = 0.905
    monitor_top = TARGET_OVERALL_HEIGHT_M
    monitor_height = monitor_top - monitor_bottom
    monitor_center = (monitor_top + monitor_bottom) / 2
    _box(
        "Monitor base",
        (x, y, 0.759),
        (0.240, 0.165, 0.018),
        ("graphite", "black_powder", "powder_dark"),
        bevel=0.009,
        category="monitor stand",
    )
    _box(
        "Monitor stand neck",
        (x, stand_rear_y, 0.837),
        (0.056, 0.050, 0.156),
        ("graphite", "black_powder", "powder_dark"),
        bevel=0.006,
        category="monitor stand",
    )
    _cylinder(
        "Monitor tilt pivot",
        (x, y + 0.068, 0.906),
        0.025,
        0.064,
        ("graphite", "black_powder", "powder_dark"),
        axis=(0, 1, 0),
        vertices=24,
        category="monitor stand",
    )
    _curved_monitor_solid(
        "Monitor rear enclosure",
        center_x=x,
        center_y=y,
        center_z=monitor_center,
        width=.690,
        height=monitor_height,
        depth=.030,
        curvature=.038,
        materials=("graphite", "black_powder", "powder_dark"),
        category="monitor enclosure",
    )
    _curved_monitor_solid(
        "Monitor front bezel",
        center_x=x,
        center_y=y - .004,
        center_z=monitor_center,
        width=.700,
        height=monitor_height,
        depth=.009,
        curvature=.038,
        materials=("graphite", "black_powder", "powder_dark"),
        category="monitor enclosure",
    )
    _curved_monitor_solid(
        "Monitor opaque display",
        center_x=x,
        center_y=y - .010,
        center_z=monitor_center + .002,
        width=.666,
        height=monitor_height - .032,
        depth=.003,
        curvature=.038,
        materials=("screen", "shadow", "graphite"),
        category="display",
    )
    # Original abstract starfield content echoes the supplied workstation sheet
    # without embedding a copyrighted wallpaper or turning the screen into an
    # unexplained flat color. Points follow the same physical display curve.
    for index in range(38):
        normalized_x = ((index * 29) % 101) / 100 * 2 - 1
        normalized_z = ((index * 47 + 13) % 97) / 96 * 2 - 1
        star_x = x + normalized_x * .315
        star_z = monitor_center + normalized_z * (monitor_height - .055) * .45
        star_y = y - .010 + .038 * (1 - normalized_x * normalized_x) - .0022
        size = .0016 + (index % 4) * .00035
        _box(
            f"Curved display star {index + 1:02}",
            (star_x, star_y, star_z),
            (size, .0008, size),
            ("screen_ui", "teal", "blue_accent"),
            bevel=.0003,
            category="display graphics",
        )
    for index in range(11):
        normalized_x = -0.75 + index * .15
        band_x = x + normalized_x * .315
        band_z = monitor_center + normalized_x * .055
        band_y = y - .010 + .038 * (1 - normalized_x * normalized_x) - .0024
        _box(
            f"Curved display nebula band {index + 1:02}",
            (band_x, band_y, band_z),
            (.040, .0009, .004 + (index % 3) * .002),
            ("blue_accent", "screen_ui", "teal"),
            bevel=.001,
            category="display graphics",
        ).rotation_euler[1] = math.radians(-9)
    _box(
        "Monitor rear VESA boss",
        (x, y + 0.075, monitor_center - 0.020),
        (0.112, 0.015, 0.112),
        ("mid_grey", "cool_grey", "powder_dark"),
        bevel=0.004,
        category="rear service",
    )
    for index, slot_x in enumerate((-0.100, -0.067, -0.034, 0.0, 0.034, 0.067, 0.100), start=1):
        _box(
            f"Monitor rear cooling slot {index}",
            (x + slot_x, y + 0.069, monitor_center + 0.105),
            (0.020, 0.004, 0.004),
            ("shadow", "seal", "graphite"),
            bevel=0.001,
            category="rear ventilation",
        )
    _box(
        "Monitor rear signal ports",
        (x + 0.058, y + 0.070, monitor_center - 0.070),
        (0.092, 0.005, 0.026),
        ("shadow", "seal", "graphite"),
        bevel=0.002,
        category="rear service",
    )


def _keyboard_and_mouse() -> None:
    keyboard_x, keyboard_y = -0.190, -0.135
    _box(
        "Keyboard lower shell",
        (keyboard_x, keyboard_y, 0.760),
        (0.430, 0.165, 0.017),
        ("graphite", "black_powder", "powder_dark"),
        bevel=0.008,
        category="keyboard",
    )
    row_counts = (15, 15, 14, 13, 10)
    row_y = (-0.190, -0.160, -0.130, -0.100, -0.070)
    key_pitch = 0.026
    for row, (count, y) in enumerate(zip(row_counts, row_y), start=1):
        start_x = keyboard_x - (count - 1) * key_pitch / 2
        for column in range(count):
            _box(
                f"Keyboard key r{row:02} c{column + 1:02}",
                (start_x + column * key_pitch, y, 0.773),
                (0.021, 0.022, 0.009),
                ("graphite", "control_polymer", "black_powder"),
                bevel=0.003,
                category="keyboard key",
            )
    _box(
        "Keyboard space bar",
        (keyboard_x - 0.020, -0.070, 0.774),
        (0.125, 0.022, 0.010),
        ("graphite", "control_polymer", "black_powder"),
        bevel=0.003,
        category="keyboard key",
    )

    mouse_x, mouse_y = 0.205, -0.135
    mouse = _sphere(
        "Ergonomic mouse shell",
        (mouse_x, mouse_y, 0.772),
        (0.032, 0.052, 0.020),
        ("graphite", "black_powder", "powder_dark"),
        category="mouse",
    )
    mouse.rotation_euler[2] = math.radians(-8)
    _box(
        "Mouse center split seam",
        (mouse_x, mouse_y - 0.014, 0.790),
        (0.003, 0.052, 0.003),
        ("shadow", "seal", "graphite"),
        bevel=0.001,
        category="mouse",
    )
    _cylinder(
        "Mouse scroll wheel",
        (mouse_x, mouse_y - 0.016, 0.793),
        0.006,
        0.010,
        ("rubber", "seal", "graphite"),
        axis=(1, 0, 0),
        vertices=20,
        category="mouse",
    )


def _tower_fan(name: str, xyz: tuple[float, float, float], radius: float) -> None:
    x, y, z = xyz
    _torus(
        name + " guard",
        xyz,
        radius,
        0.003,
        ("mid_grey", "cool_grey", "graphite"),
        axis=(0, 1, 0),
        category="rear ventilation",
    )
    _cylinder(
        name + " hub",
        xyz,
        radius * 0.20,
        0.006,
        ("graphite", "black_powder", "powder_dark"),
        axis=(0, 1, 0),
        vertices=20,
        category="rear ventilation",
    )
    for index in range(6):
        angle = index * math.tau / 6
        _box(
            name + f" blade {index + 1}",
            (
                x + math.sin(angle) * radius * 0.48,
                y,
                z + math.cos(angle) * radius * 0.48,
            ),
            (radius * 0.18, 0.005, radius * 0.58),
            ("graphite", "black_powder", "powder_dark"),
            bevel=0.002,
            category="rear ventilation",
        ).rotation_euler[1] = angle


def _computer_tower() -> None:
    cx, cy = 0.420, 0.000
    width, depth = 0.205, 0.405
    bottom, top = 0.126, 0.620
    center_z = (bottom + top) / 2
    height = top - bottom
    dark = ("black_powder", "powder_dark", "graphite")

    _box(
        "Tower chassis floor",
        (cx, cy, bottom + 0.012),
        (width, depth - 0.020, 0.024),
        dark,
        bevel=0.004,
        category="computer chassis",
    )
    _box(
        "Tower chassis roof",
        (cx, cy, top - 0.012),
        (width, depth - 0.020, 0.024),
        dark,
        bevel=0.005,
        category="computer chassis",
    )
    # The supplied tower visibly uses a tempered side window.  This is the one
    # physically transparent batch-14 part: a bounded glass panel captured by
    # a real perimeter frame, never a generic translucent equipment shell.
    glass_x = cx - width / 2 + 0.005
    _transparent_box(
        "Tower left tempered side panel",
        (glass_x, cy, center_z),
        (0.008, depth - 0.040, height - 0.048),
        "smoked_tempered",
        bevel=0.004,
        category="tempered side glass",
    )
    for name, y, z, size in (
        ("Tower glass front frame", cy - depth / 2 + 0.018, center_z,
         (0.016, 0.020, height - 0.030)),
        ("Tower glass rear frame", cy + depth / 2 - 0.018, center_z,
         (0.016, 0.020, height - 0.030)),
        ("Tower glass lower frame", cy, bottom + 0.020,
         (0.016, depth - 0.020, 0.020)),
        ("Tower glass upper frame", cy, top - 0.020,
         (0.016, depth - 0.020, 0.020)),
    ):
        _box(
            name,
            (glass_x - 0.003, y, z),
            size,
            dark,
            bevel=0.002,
            category="tempered side glass frame",
        )
    for y in (cy - depth * .39, cy + depth * .39):
        for z in (bottom + .045, top - .045):
            _cylinder(
                "Tower glass captive fixing",
                (glass_x - .008, y, z),
                .004,
                .003,
                ("stainless", "zinc", "mid_grey"),
                axis=(1, 0, 0),
                vertices=16,
                category="tempered side glass fixing",
            )
    _box(
        "Tower right side panel",
        (cx + width / 2 - 0.009, cy, center_z),
        (0.018, depth - 0.020, height - 0.028),
        dark,
        bevel=0.004,
        category="computer chassis",
    )

    # Abstract but mechanically plausible internals sit behind the glass. They
    # communicate a GPU workstation without copying a commercial board layout.
    internal_x = glass_x + .020
    _box(
        "Tower internal motherboard",
        (internal_x, cy + .025, center_z + .030),
        (.008, depth * .58, height * .48),
        ("blue_accent", "mid_grey"),
        bevel=.003,
        category="computer internal motherboard",
    )
    _box(
        "Tower internal graphics card",
        (internal_x - .006, cy - .015, center_z - .065),
        (.020, depth * .56, .072),
        ("graphite", "black_powder"),
        bevel=.006,
        category="computer internal graphics card",
    )
    for y in (-.105, .035):
        _torus(
            "Tower internal graphics fan",
            (internal_x - .018, y, center_z - .065),
            .027,
            .003,
            ("cool_grey", "mid_grey"),
            axis=(1, 0, 0),
            category="computer internal cooling",
        )
        _cylinder(
            "Tower internal graphics fan hub",
            (internal_x - .020, y, center_z - .065),
            .006,
            .004,
            ("teal", "screen_ui", "blue_accent"),
            axis=(1, 0, 0),
            vertices=20,
            category="computer internal cooling",
        )
    _cylinder(
        "Tower internal CPU cooler",
        (internal_x - .012, cy + .070, center_z + .110),
        .038,
        .022,
        ("graphite", "black_powder"),
        axis=(1, 0, 0),
        vertices=32,
        category="computer internal cooling",
    )
    for y in (cy + .005, cy + .025, cy + .045, cy + .065):
        _box(
            "Tower internal memory module",
            (internal_x - .010, y, center_z + .025),
            (.016, .008, .120),
            ("teal", "screen_ui", "blue_accent"),
            bevel=.002,
            category="computer internal memory",
        )
    front_y = cy - depth / 2 + 0.009
    rear_y = cy + depth / 2 - 0.009
    _box(
        "Tower formed front panel",
        (cx, front_y, center_z),
        (width - 0.010, 0.018, height - 0.030),
        ("graphite", "black_powder", "powder_dark"),
        bevel=0.008,
        category="computer front service",
    )
    _box(
        "Tower closed rear service panel",
        (cx, rear_y, center_z),
        (width - 0.010, 0.018, height - 0.030),
        ("mid_grey", "cool_grey", "powder_dark"),
        bevel=0.003,
        category="rear service",
    )
    for offset_x in (-0.073, 0.073):
        for offset_y in (-0.162, 0.162):
            _cylinder(
                "Tower rubber foot",
                (cx + offset_x, cy + offset_y, bottom - 0.006),
                0.010,
                0.012,
                ("rubber", "seal", "graphite"),
                vertices=20,
                category="computer foot",
            )

    # Front: drive seams, controls and a bounded lower intake rather than an
    # unexplained black box or decorative plaque.
    for index, z in enumerate((0.548, 0.507, 0.466), start=1):
        _box(
            f"Tower front service bay seam {index}",
            (cx, front_y - 0.010, z),
            (0.163, 0.004, 0.006),
            ("shadow", "seal", "graphite"),
            bevel=0.001,
            category="computer front service",
        )
    _box(
        "Tower front I-O recess",
        (cx, front_y - 0.011, 0.424),
        (0.130, 0.005, 0.040),
        ("shadow", "seal", "graphite"),
        bevel=0.004,
        category="computer front service",
    )
    _cylinder(
        "Tower front power button",
        (cx + 0.061, front_y - 0.015, 0.424),
        0.010,
        0.005,
        ("control_polymer", "cool_grey", "mid_grey"),
        axis=(0, 1, 0),
        vertices=24,
        category="computer front service",
    )
    for index, x in enumerate((cx - 0.050, cx - 0.020, cx + 0.010), start=1):
        _box(
            f"Tower front data port {index}",
            (x, front_y - 0.015, 0.424),
            (0.019, 0.005, 0.010),
            ("screen_ui", "teal", "mid_grey") if index == 2 else ("graphite", "seal"),
            bevel=0.002,
            category="computer front service",
        )
    _box(
        "Tower front lower intake field",
        (cx, front_y - 0.011, 0.272),
        (0.163, 0.005, 0.215),
        ("shadow", "seal", "graphite"),
        bevel=0.005,
        category="front ventilation",
    )
    for row in range(9):
        for column in range(7):
            _box(
                f"Tower intake perforation r{row + 1:02} c{column + 1:02}",
                (
                    cx + (column - 3) * 0.020,
                    front_y - 0.015,
                    0.195 + row * 0.019,
                ),
                (0.010, 0.004, 0.005),
                ("mid_grey", "cool_grey", "powder_dark"),
                bevel=0.001,
                category="front ventilation",
            )

    # Rear service anatomy remains readable from orbit.
    _tower_fan("Tower rear exhaust fan", (cx - 0.030, rear_y + 0.011, 0.514), 0.048)
    _box(
        "Tower rear motherboard I-O panel",
        (cx + 0.055, rear_y + 0.012, 0.458),
        (0.060, 0.005, 0.116),
        ("cool_grey", "mid_grey", "powder_light"),
        bevel=0.002,
        category="rear service",
    )
    for index, z in enumerate((0.408, 0.430, 0.452, 0.474), start=1):
        _box(
            f"Tower rear I-O port {index}",
            (cx + 0.055, rear_y + 0.016, z),
            (0.038, 0.004, 0.011),
            ("graphite", "seal", "shadow") if index != 3 else ("screen_ui", "teal"),
            bevel=0.001,
            category="rear service",
        )
    for index, z in enumerate((0.330, 0.310, 0.290, 0.270), start=1):
        _box(
            f"Tower rear expansion slot {index}",
            (cx, rear_y + 0.013, z),
            (0.132, 0.004, 0.011),
            ("cool_grey", "mid_grey", "powder_light"),
            bevel=0.001,
            category="rear service",
        )
    _box(
        "Tower rear power-supply module",
        (cx, rear_y + 0.012, 0.196),
        (0.155, 0.005, 0.100),
        ("cool_grey", "mid_grey", "powder_light"),
        bevel=0.003,
        category="rear service",
    )
    _torus(
        "Tower rear power-supply fan guard",
        (cx - 0.030, rear_y + 0.016, 0.205),
        0.028,
        0.0025,
        ("graphite", "seal", "shadow"),
        axis=(0, 1, 0),
        category="rear service",
    )
    _box(
        "Tower rear mains inlet",
        (cx + 0.053, rear_y + 0.017, 0.181),
        (0.036, 0.004, 0.027),
        ("shadow", "seal", "graphite"),
        bevel=0.002,
        category="rear service",
    )


def _cable_routes() -> None:
    gx, gy = 0.245, 0.115
    # Desktop peripherals converge on the actual 60 mm grommet.
    _curve_tube(
        "Mouse data cable",
        (
            (0.205, -0.092, 0.779),
            (0.225, -0.025, 0.754),
            (0.235, 0.045, 0.753),
            (gx, gy, 0.754),
        ),
        0.0025,
    )
    _curve_tube(
        "Keyboard data cable",
        (
            (0.010, -0.052, 0.768),
            (0.080, 0.010, 0.753),
            (0.160, 0.075, 0.753),
            (gx, gy, 0.754),
        ),
        0.0025,
    )
    _curve_tube(
        "Monitor signal and power loom",
        (
            (-0.175, 0.154, 0.930),
            (-0.175, 0.175, 0.825),
            (-0.105, 0.175, 0.756),
            (0.105, 0.155, 0.753),
            (gx, gy, 0.754),
        ),
        0.0032,
    )
    # The route drops behind the top into the under-desk power strip and stays
    # inside the 600 mm desk envelope.
    _curve_tube(
        "Grommet to power-strip cable loom",
        ((gx, gy, 0.748), (0.245, 0.245, 0.700), (0.105, 0.248, 0.658)),
        0.0040,
    )
    _curve_tube(
        "Tower mains cable",
        ((0.473, 0.213, 0.181), (0.420, 0.255, 0.260), (0.120, 0.250, 0.640)),
        0.0038,
    )
    _curve_tube(
        "Tower display cable",
        ((0.475, 0.213, 0.452), (0.360, 0.265, 0.520), (0.245, 0.245, 0.690)),
        0.0032,
    )
    _curve_tube(
        "Power-strip supply lead",
        ((-0.280, 0.248, 0.658), (-0.500, 0.270, 0.450), (-0.540, 0.270, 0.080)),
        0.0042,
    )


def build(spec: f.AssetSpec) -> None:
    """Build the reference-faithful opaque GPU workstation product."""
    _validate_context(spec)
    f.ROOT["asset_class"] = "computer workstation"
    f.ROOT["design_reference"] = "September 2, 2026 GPU workstation product sheet"
    f.ROOT["desk_dimensions_m"] = [DESK_WIDTH_M, DESK_DEPTH_M, DESK_HEIGHT_M]
    f.ROOT["overall_target_dimensions_m"] = [
        DESK_WIDTH_M,
        DESK_DEPTH_M,
        TARGET_OVERALL_HEIGHT_M,
    ]
    f.ROOT["product_revision"] = "batch14-gpu-workstation-r11-rear-mounted-stand"
    f.ROOT["monitor_geometry"] = "690 mm curved ultrawide, physical front/rear shell"
    f.ROOT["all_materials_opaque"] = False
    f.ROOT["tempered_side_transmission"] = True
    f.ROOT["reference_requires_cable_grommet"] = True

    _frame()
    _worktop()
    _rear_service()
    _monitor()
    _keyboard_and_mouse()
    _computer_tower()
    _cable_routes()


def _world_bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        Vector(tuple(min(point[index] for point in points) for index in range(3))),
        Vector(tuple(max(point[index] for point in points) for index in range(3))),
    )


def _pair_gap(a: bpy.types.Object, b: bpy.types.Object) -> float:
    a_min, a_max = _world_bounds(a)
    b_min, b_max = _world_bounds(b)
    axis_gaps = []
    for axis in range(3):
        if a_max[axis] < b_min[axis]:
            axis_gaps.append(b_min[axis] - a_max[axis])
        elif b_max[axis] < a_min[axis]:
            axis_gaps.append(a_min[axis] - b_max[axis])
        else:
            axis_gaps.append(0.0)
    return math.sqrt(sum(value * value for value in axis_gaps))


def _evaluated_triangle_count() -> int:
    dependency_graph = bpy.context.evaluated_depsgraph_get()
    triangles = 0
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj is f.ROOT:
            continue
        evaluated = obj.evaluated_get(dependency_graph)
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            triangles += len(mesh.loop_triangles)
        finally:
            evaluated.to_mesh_clear()
    return triangles


def smoke_test() -> dict[str, object]:
    """Audit the already-built scene in memory; never save or export anything."""
    if f.ROOT is None:
        raise RuntimeError("No workstation root exists for smoke_test()")
    children = [obj for obj in bpy.context.scene.objects if obj.parent is f.ROOT]
    if not children:
        raise RuntimeError("Workstation root has no authored children")

    mins: list[Vector] = []
    maxs: list[Vector] = []
    for obj in children:
        if obj.type in {"MESH", "CURVE", "SURFACE", "FONT"}:
            lower, upper = _world_bounds(obj)
            mins.append(lower)
            maxs.append(upper)
    raw_min = Vector(tuple(min(value[axis] for value in mins) for axis in range(3)))
    raw_max = Vector(tuple(max(value[axis] for value in maxs) for axis in range(3)))
    envelope = raw_max - raw_min

    object_by_name = {obj.name: obj for obj in children}
    contact_report: list[dict[str, object]] = []
    for left_name, right_name in CONTACT_PAIRS[ASSET_ID]:
        left = object_by_name.get(left_name)
        right = object_by_name.get(right_name)
        if left is None or right is None:
            contact_report.append(
                {"left": left_name, "right": right_name, "missing": True, "pass": False}
            )
            continue
        gap = _pair_gap(left, right)
        contact_report.append(
            {
                "left": left_name,
                "right": right_name,
                "gap_m": round(gap, 6),
                "pass": gap <= 0.002,
            }
        )

    material_report: list[dict[str, object]] = []
    seen: set[str] = set()
    for obj in children:
        if not hasattr(obj.data, "materials"):
            continue
        for material in obj.data.materials:
            if material is None or material.name in seen:
                continue
            seen.add(material.name)
            alpha = float(material.diffuse_color[3]) if len(material.diffuse_color) > 3 else 1.0
            transmission = 0.0
            if material.use_nodes and material.node_tree:
                bsdf = material.node_tree.nodes.get("Principled BSDF")
                if bsdf is not None:
                    alpha_socket = bsdf.inputs.get("Alpha")
                    transmission_socket = bsdf.inputs.get("Transmission Weight")
                    if alpha_socket is not None:
                        alpha = min(alpha, float(alpha_socket.default_value))
                    if transmission_socket is not None:
                        transmission = float(transmission_socket.default_value)
            material_report.append(
                {
                    "name": material.name,
                    "alpha": round(alpha, 6),
                    "transmission": round(transmission, 6),
                    "opaque": alpha >= 0.999 and transmission <= 0.001,
                }
            )

    triangles = _evaluated_triangle_count()
    expected = Vector((DESK_WIDTH_M, DESK_DEPTH_M, TARGET_OVERALL_HEIGHT_M))
    dimension_delta = envelope - expected
    report: dict[str, object] = {
        "asset_id": ASSET_ID,
        "root_scale": [round(value, 6) for value in f.ROOT.scale],
        "object_count": len(children),
        "raw_min_m": [round(value, 6) for value in raw_min],
        "raw_max_m": [round(value, 6) for value in raw_max],
        "raw_envelope_m": [round(value, 6) for value in envelope],
        "target_envelope_m": [DESK_WIDTH_M, DESK_DEPTH_M, TARGET_OVERALL_HEIGHT_M],
        "dimension_delta_m": [round(value, 6) for value in dimension_delta],
        "dimensions_within_half_percent": all(
            abs(dimension_delta[index]) <= expected[index] * 0.005
            for index in range(3)
        ),
        "evaluated_triangles": triangles,
        "runtime_triangle_budget": 70000,
        "triangle_budget_pass": triangles <= 70000,
        "all_materials_opaque": all(item["opaque"] for item in material_report),
        "materials": material_report,
        "contact_pairs": contact_report,
        "contact_gate_pass": all(bool(item["pass"]) for item in contact_report),
    }
    return report


def contact_pairs(asset_id: str = ASSET_ID) -> tuple[tuple[str, str], ...]:
    return CONTACT_PAIRS.get(asset_id, ())


__all__ = ["ASSET_ID", "CONTACT_PAIRS", "build", "contact_pairs", "smoke_test"]
