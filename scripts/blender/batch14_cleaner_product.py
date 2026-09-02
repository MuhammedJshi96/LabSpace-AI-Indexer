"""Reference-led ultrasonic-cleaner product geometry for batch 14.

The caller owns scene reset, root creation, material registration, source save,
and runtime export.  This module only authors the product.  The cleaner uses a
single closed enclosure, one watertight pressed basin, one continuous annular
rolled rim, and a mechanically connected formed lid; no side of the rim or lid
return is assembled from intersecting bars.

The geometry is original and logo-free.  Its raw authored envelope is exactly
``0.36 x 0.33 x 0.33 m`` before any fitting transform.
"""

from __future__ import annotations

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

import lab_furniture as f


ASSET_ID = "ultrasonic-cleaner"
AUTHORED_DIMENSIONS = (0.36, 0.33, 0.33)
RING_SEGMENTS_PER_CORNER = 10

# Stable fixed-construction interfaces for the caller's continuity gate.
CONTACT_PAIRS: dict[str, tuple[tuple[str, str], ...]] = {
    ASSET_ID: (
        ("Cleaner continuous satin enclosure", "Cleaner continuous annular rolled rim"),
        ("Cleaner pressed stainless basin", "Cleaner continuous annular rolled rim"),
        ("Cleaner pressed stainless basin", "Cleaner continuous satin enclosure"),
        ("Cleaner fascia recess", "Cleaner continuous satin enclosure"),
        ("Cleaner fascia recess", "Cleaner recessed blue fascia"),
        ("Cleaner continuous fascia surround", "Cleaner continuous satin enclosure"),
        ("Cleaner rear service cover", "Cleaner continuous satin enclosure"),
        ("Cleaner lid central formed skin", "Cleaner continuous lid perimeter return"),
        ("Cleaner lid inset inner panel", "Cleaner lid central formed skin"),
        ("Cleaner lid inset handle pocket", "Cleaner lid central formed skin"),
        ("Cleaner lid inset handle grip", "Cleaner lid inset handle pocket"),
        ("Cleaner lid moving hinge leaf", "Cleaner continuous lid perimeter return"),
        ("Cleaner lid moving hinge knuckle 3", "Cleaner full-width hinge pin"),
        ("Cleaner fixed hinge mounting rail", "Cleaner continuous satin enclosure"),
        ("Cleaner fixed hinge knuckle 2", "Cleaner full-width hinge pin"),
        ("Cleaner right drain boss", "Cleaner continuous satin enclosure"),
        ("Cleaner right drain blue valve actuator", "Cleaner right drain valve hub"),
    ),
}


def _material(*keys: str) -> bpy.types.Material:
    """Return the first registered material and prove that it is opaque."""

    material = next((f.MATERIALS[key] for key in keys if key in f.MATERIALS), None)
    if material is None:
        raise RuntimeError(
            "Ultrasonic-cleaner builder requires caller-registered material: "
            + " or ".join(keys)
        )
    alpha = float(material.diffuse_color[3]) if len(material.diffuse_color) > 3 else 1.0
    transmission = 0.0
    if material.use_nodes and material.node_tree is not None:
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if bsdf is not None:
            alpha_socket = bsdf.inputs.get("Alpha")
            transmission_socket = (
                bsdf.inputs.get("Transmission Weight")
                or bsdf.inputs.get("Transmission")
            )
            if alpha_socket is not None and not alpha_socket.is_linked:
                alpha = min(alpha, float(alpha_socket.default_value))
            if transmission_socket is not None:
                transmission = (
                    1.0
                    if transmission_socket.is_linked
                    else float(transmission_socket.default_value)
                )
    if alpha < 0.999 or transmission > 0.001:
        raise RuntimeError(
            f"Cleaner material must be opaque: {material.name} "
            f"(alpha={alpha:.4f}, transmission={transmission:.4f})"
        )
    return material


def _validate_context(spec: f.AssetSpec) -> None:
    if f.ROOT is None:
        raise RuntimeError("Caller must create lab_furniture.ROOT before building the cleaner")
    if not f.MATERIALS:
        raise RuntimeError("Caller must register lab_furniture materials before building the cleaner")
    actual = (float(spec.width), float(spec.depth), float(spec.height))
    if spec.asset_id != ASSET_ID or any(
        abs(value - expected) > 1.0e-9
        for value, expected in zip(actual, AUTHORED_DIMENSIONS)
    ):
        raise RuntimeError(
            f"{ASSET_ID} requires exact raw dimensions {AUTHORED_DIMENSIONS}; "
            f"received {spec.asset_id!r} {actual}"
        )


def _rounded_rectangle_loop(
    width: float,
    depth: float,
    radius: float,
    z: float,
    *,
    segments_per_corner: int = RING_SEGMENTS_PER_CORNER,
) -> list[tuple[float, float, float]]:
    """Return one counter-clockwise rounded-rectangle loop without duplicates."""

    if width <= 0 or depth <= 0:
        raise ValueError("Rounded-rectangle dimensions must be positive")
    radius = min(radius, width * 0.5, depth * 0.5)
    half_width = width * 0.5
    half_depth = depth * 0.5
    corners = (
        (half_width - radius, half_depth - radius, 0.0),
        (-half_width + radius, half_depth - radius, 90.0),
        (-half_width + radius, -half_depth + radius, 180.0),
        (half_width - radius, -half_depth + radius, 270.0),
    )
    points: list[tuple[float, float, float]] = []
    for center_x, center_y, start_degrees in corners:
        for segment in range(segments_per_corner):
            angle = math.radians(
                start_degrees + 90.0 * segment / segments_per_corner
            )
            points.append(
                (
                    center_x + radius * math.cos(angle),
                    center_y + radius * math.sin(angle),
                    z,
                )
            )
    return points


def _append_loop(
    vertices: list[tuple[float, float, float]],
    profile: tuple[float, float, float, float],
) -> list[int]:
    start = len(vertices)
    vertices.extend(_rounded_rectangle_loop(*profile))
    return list(range(start, len(vertices)))


def _connect_loops(
    faces: list[tuple[int, ...]],
    first: list[int],
    second: list[int],
    *,
    reverse: bool = False,
) -> None:
    if len(first) != len(second):
        raise ValueError("Connected loops must have matching topology")
    count = len(first)
    for index in range(count):
        nxt = (index + 1) % count
        face = (first[index], first[nxt], second[nxt], second[index])
        faces.append(tuple(reversed(face)) if reverse else face)


def _mesh_object(
    name: str,
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, ...]],
    material: bpy.types.Material,
    *,
    category: str,
    smooth_quads: bool,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(name + " mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=False)
    normal_mesh = bmesh.new()
    normal_mesh.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(normal_mesh, faces=list(normal_mesh.faces))
    normal_mesh.to_mesh(mesh)
    normal_mesh.free()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    f.assign_material(obj, material)
    if smooth_quads:
        for polygon in mesh.polygons:
            polygon.use_smooth = len(polygon.vertices) == 4
    return f.parent_to_root(obj, category)


def _closed_container(
    name: str,
    outer_profiles: tuple[tuple[float, float, float, float], ...],
    inner_profiles: tuple[tuple[float, float, float, float], ...],
    material: bpy.types.Material,
    *,
    category: str,
) -> bpy.types.Object:
    """Build one closed open-top container with a sealed inner cavity floor."""

    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    outer_loops = [_append_loop(vertices, profile) for profile in outer_profiles]
    inner_loops = [_append_loop(vertices, profile) for profile in inner_profiles]
    for first, second in zip(outer_loops, outer_loops[1:]):
        _connect_loops(faces, first, second)
    for first, second in zip(inner_loops, inner_loops[1:]):
        _connect_loops(faces, first, second, reverse=True)
    _connect_loops(faces, outer_loops[0], inner_loops[0])
    faces.append(tuple(reversed(outer_loops[-1])))
    faces.append(tuple(inner_loops[-1]))
    return _mesh_object(
        name,
        vertices,
        faces,
        material,
        category=category,
        smooth_quads=True,
    )


def _rounded_solid(
    name: str,
    width: float,
    depth: float,
    radius: float,
    z_min: float,
    z_max: float,
    material: bpy.types.Material,
    *,
    category: str,
) -> bpy.types.Object:
    """Build a closed rounded slab without depending on destructive booleans."""

    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    lower = _append_loop(vertices, (width, depth, radius, z_min))
    upper = _append_loop(vertices, (width, depth, radius, z_max))
    _connect_loops(faces, lower, upper)
    faces.append(tuple(reversed(lower)))
    faces.append(tuple(upper))
    return _mesh_object(
        name,
        vertices,
        faces,
        material,
        category=category,
        smooth_quads=True,
    )


def _continuous_annular_rim() -> bpy.types.Object:
    """Build one closed toroidal rim from nested rounded-rectangle loops."""

    # Ordered around the rolled cross-section: outer underside -> outer wall ->
    # crown -> inner crown -> inner wall -> inner underside.  Closing the final
    # loop back to the first creates one annular manifold without bar junctions.
    profiles = (
        (0.350, 0.310, 0.030, 0.198),
        (0.352, 0.312, 0.031, 0.207),
        (0.346, 0.306, 0.033, 0.217),
        (0.306, 0.260, 0.039, 0.220),
        (0.296, 0.248, 0.038, 0.209),
        (0.292, 0.244, 0.040, 0.199),
    )
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    loops = [_append_loop(vertices, profile) for profile in profiles]
    for first, second in zip(loops, loops[1:]):
        _connect_loops(faces, first, second)
    _connect_loops(faces, loops[-1], loops[0])
    return _mesh_object(
        "Cleaner continuous annular rolled rim",
        vertices,
        faces,
        _material("stainless_bright", "stainless", "stainless_studio"),
        category="continuous basin rim",
        smooth_quads=True,
    )


def _vertical_rounded_loop(
    width: float,
    height: float,
    radius: float,
    y: float,
    center_z: float,
) -> list[tuple[float, float, float]]:
    planar = _rounded_rectangle_loop(width, height, radius, 0.0)
    return [(x, y, center_z + planar_y) for x, planar_y, _z in planar]


def _continuous_fascia_surround() -> bpy.types.Object:
    """Create the reference's single broad, low stainless controller bezel."""

    vertices: list[tuple[float, float, float]] = []

    def append_vertical(
        width: float,
        height: float,
        radius: float,
        y: float,
    ) -> list[int]:
        start = len(vertices)
        vertices.extend(_vertical_rounded_loop(width, height, radius, y, 0.102))
        return list(range(start, len(vertices)))

    outer_front = append_vertical(0.292, 0.098, 0.011, -0.165)
    outer_back = append_vertical(0.292, 0.098, 0.011, -0.154)
    inner_front = append_vertical(0.276, 0.082, 0.007, -0.165)
    inner_back = append_vertical(0.276, 0.082, 0.007, -0.154)
    faces: list[tuple[int, ...]] = []
    _connect_loops(faces, outer_front, outer_back)
    _connect_loops(faces, outer_front, inner_front)
    _connect_loops(faces, inner_front, inner_back, reverse=True)
    _connect_loops(faces, inner_back, outer_back)
    return _mesh_object(
        "Cleaner continuous fascia surround",
        vertices,
        faces,
        _material("stainless_bright", "stainless", "stainless_studio"),
        category="control surround",
        smooth_quads=True,
    )


def _controller_bezel_ring() -> bpy.types.Object:
    """Build the display bezel as a true ring, not a coplanar plaque."""

    center_x = -0.026
    center_z = 0.117
    vertices: list[tuple[float, float, float]] = []

    def append_vertical(
        width: float,
        height: float,
        radius: float,
        y: float,
    ) -> list[int]:
        start = len(vertices)
        vertices.extend(
            (x + center_x, loop_y, z)
            for x, loop_y, z in _vertical_rounded_loop(
                width,
                height,
                radius,
                y,
                center_z,
            )
        )
        return list(range(start, len(vertices)))

    # The ring is 0.8 mm behind the overall front envelope.  Its screen sits
    # another millimetre behind the ring face and overlaps the hidden return.
    outer_front = append_vertical(0.136, 0.034, 0.003, -0.1642)
    outer_back = append_vertical(0.136, 0.034, 0.003, -0.1605)
    inner_front = append_vertical(0.126, 0.024, 0.002, -0.1642)
    inner_back = append_vertical(0.126, 0.024, 0.002, -0.1605)
    faces: list[tuple[int, ...]] = []
    _connect_loops(faces, outer_front, outer_back)
    _connect_loops(faces, outer_front, inner_front)
    _connect_loops(faces, inner_front, inner_back, reverse=True)
    _connect_loops(faces, inner_back, outer_back)
    return _mesh_object(
        "Cleaner controller bezel",
        vertices,
        faces,
        _material("graphite", "seal"),
        category="display bezel",
        smooth_quads=True,
    )


def _box(
    name: str,
    xyz: tuple[float, float, float],
    size: tuple[float, float, float],
    material_keys: str | tuple[str, ...],
    *,
    bevel: float,
    category: str,
) -> bpy.types.Object:
    keys = (material_keys,) if isinstance(material_keys, str) else material_keys
    return f.add_box(
        name,
        xyz,
        size,
        _material(*keys),
        bevel=bevel,
        category=category,
    )


def _cylinder(
    name: str,
    xyz: tuple[float, float, float],
    radius: float,
    depth: float,
    material_keys: str | tuple[str, ...],
    *,
    axis: tuple[float, float, float] = (0.0, 0.0, 1.0),
    vertices: int = 32,
    category: str,
) -> bpy.types.Object:
    keys = (material_keys,) if isinstance(material_keys, str) else material_keys
    return f.add_cylinder(
        name,
        xyz,
        radius,
        depth,
        _material(*keys),
        axis=axis,
        vertices=vertices,
        bevel=0.001,
        category=category,
    )


def _curve_tube(
    name: str,
    points: tuple[tuple[float, float, float], ...],
    radius: float,
    material_keys: str | tuple[str, ...],
    *,
    category: str,
) -> bpy.types.Object:
    keys = (material_keys,) if isinstance(material_keys, str) else material_keys
    curve = bpy.data.curves.new(name=name + " curve", type="CURVE")
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
    f.assign_material(obj, _material(*keys))
    f.parent_to_root(obj, category)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    f.smooth(obj)
    obj.select_set(False)
    return obj


def _attach_to_pivot(
    obj: bpy.types.Object,
    pivot: bpy.types.Object,
) -> bpy.types.Object:
    """Re-parent a manufactured part without changing its authored datum."""

    obj.parent = pivot
    obj.matrix_parent_inverse = pivot.matrix_world.inverted()
    return obj


def _continuous_lid_return() -> bpy.types.Object:
    """Build one manifold formed return around the lid's full perimeter."""

    profiles = (
        (0.330, 0.274, 0.018, 0.219),
        (0.334, 0.278, 0.020, 0.224),
        (0.332, 0.276, 0.021, 0.235),
        (0.308, 0.252, 0.018, 0.233),
        (0.304, 0.248, 0.016, 0.224),
        (0.306, 0.250, 0.016, 0.220),
    )
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    loops = [_append_loop(vertices, profile) for profile in profiles]
    for first, second in zip(loops, loops[1:]):
        _connect_loops(faces, first, second)
    _connect_loops(faces, loops[-1], loops[0])
    obj = _mesh_object(
        "Cleaner continuous lid perimeter return",
        vertices,
        faces,
        _material("stainless_bright", "stainless", "stainless_studio"),
        category="formed lid perimeter return",
        smooth_quads=True,
    )
    obj.location.y = 0.003
    return obj


def _lid_assembly() -> bpy.types.Object:
    """Create a connected, slightly open formed lid and full-width hinge."""

    pivot_y = 0.142
    pivot_z = 0.222
    pivot = bpy.data.objects.new("Cleaner lid hinge pivot", None)
    bpy.context.collection.objects.link(pivot)
    pivot.location = (0.0, pivot_y, pivot_z)
    f.parent_to_root(pivot, "lid kinematic datum")

    moving: list[bpy.types.Object] = []
    lid_return = _continuous_lid_return()
    moving.append(lid_return)

    skin = _rounded_solid(
        "Cleaner lid central formed skin",
        0.318,
        0.260,
        0.022,
        0.226,
        0.231,
        _material("stainless_studio", "stainless"),
        category="formed lid skin",
    )
    skin.location.y = 0.006
    moving.append(skin)

    inner_panel = _rounded_solid(
        "Cleaner lid inset inner panel",
        0.296,
        0.238,
        0.024,
        0.219,
        0.227,
        _material("stainless_bright", "stainless", "stainless_studio"),
        category="lid inner panel",
    )
    inner_panel.location.y = 0.006
    moving.append(inner_panel)

    pocket = _rounded_solid(
        "Cleaner lid inset handle pocket",
        0.078,
        0.045,
        0.018,
        0.229,
        0.232,
        _material("mid_grey", "cool_grey"),
        category="lid handle recess",
    )
    pocket.location.y = -0.010
    moving.append(pocket)
    grip = _rounded_solid(
        "Cleaner lid inset handle grip",
        0.048,
        0.016,
        0.007,
        0.230,
        0.236,
        _material("stainless_bright", "stainless"),
        category="lid handle",
    )
    grip.location.y = -0.014
    moving.append(grip)

    moving_leaf = _box(
        "Cleaner lid moving hinge leaf",
        (0.0, 0.137, 0.221),
        (0.310, 0.012, 0.010),
        ("stainless", "stainless_bright"),
        bevel=0.002,
        category="lid hinge leaf",
    )
    moving.append(moving_leaf)

    presentation_transform = (
        Matrix.Translation(Vector((0.0, pivot_y, pivot_z)))
        @ Matrix.Rotation(math.radians(-20.0), 4, "X")
        @ Matrix.Translation(Vector((0.0, -pivot_y, -pivot_z)))
    )
    for obj in moving:
        obj.matrix_world = presentation_transform @ obj.matrix_world
    bpy.context.view_layer.update()
    lid_max_z = max(
        (obj.matrix_world @ Vector(corner)).z
        for obj in moving
        for corner in obj.bound_box
    )
    height_adjustment = AUTHORED_DIMENSIONS[2] - lid_max_z
    lift = Matrix.Translation(Vector((0.0, 0.0, height_adjustment)))
    for obj in moving:
        obj.matrix_world = lift @ obj.matrix_world
    pivot.location.z += height_adjustment
    for obj in moving:
        _attach_to_pivot(obj, pivot)
    pivot["presentation_angle_degrees"] = 20.0
    bpy.context.view_layer.update()

    # Parenting preserves the editable manufacturing hierarchy.  Correct the
    # sub-millimetre decomposition tolerance once, before fixed hinge parts are
    # created, so the open lid owns the exact 330 mm authored height.
    parented_lid_max_z = max(
        (obj.matrix_world @ Vector(corner)).z
        for obj in moving
        for corner in obj.bound_box
    )
    pivot.location.z += AUTHORED_DIMENSIONS[2] - parented_lid_max_z
    bpy.context.view_layer.update()

    hinge_z = float(pivot.location.z)
    _box(
        "Cleaner fixed hinge mounting rail",
        (0.0, 0.146, hinge_z - 0.014),
        (0.318, 0.018, 0.028),
        ("stainless", "stainless_bright"),
        bevel=0.003,
        category="fixed hinge mounting rail",
    )
    _cylinder(
        "Cleaner full-width hinge pin",
        (0.0, pivot_y, hinge_z),
        0.0045,
        0.326,
        ("zinc", "stainless_bright", "stainless"),
        axis=(1.0, 0.0, 0.0),
        vertices=24,
        category="hinge pin",
    )
    knuckle_centers = (-0.128, -0.064, 0.0, 0.064, 0.128)
    for index, x in enumerate(knuckle_centers, start=1):
        fixed = index % 2 == 0
        _cylinder(
            f"Cleaner {'fixed' if fixed else 'lid moving'} hinge knuckle {index}",
            (x, pivot_y, hinge_z),
            0.006,
            0.054,
            ("stainless_bright", "stainless"),
            axis=(1.0, 0.0, 0.0),
            vertices=28,
            category="fixed hinge knuckle" if fixed else "moving hinge knuckle",
        )
    return pivot


def _front_controller() -> None:
    # The reference uses one wide horizontal control cassette: a light formed
    # surround, recessed blue field, dark dual-value display, three membrane
    # keys, a separate power key, and a large rotary time/power control.
    _continuous_fascia_surround()
    _box(
        "Cleaner fascia recess",
        # A 6.5 mm backplate overlaps the enclosure by 0.5 mm.  Its front is
        # deliberately 3 mm behind the stainless surround rather than sharing
        # either the surround's front or rear datum.
        (0.0, -0.15575, 0.102),
        (0.279, 0.0065, 0.085),
        ("graphite", "seal"),
        bevel=0.004,
        category="control recess",
    )
    _box(
        "Cleaner recessed blue fascia",
        # Front -162.0 mm; back -158.5 mm.  The half-millimetre overlap with
        # the graphite backplate is a bearing joint, not a coincident surface.
        (0.0, -0.16025, 0.102),
        (0.273, 0.0035, 0.079),
        "blue_accent",
        bevel=0.004,
        category="control fascia",
    )
    _controller_bezel_ring()
    _box(
        "Cleaner opaque controller display",
        # Visible face -163.2 mm: 1.0 mm behind the real bezel ring.  The
        # slightly oversized backplate is concealed by the ring return.
        (-0.026, -0.1612, 0.117),
        (0.128, 0.004, 0.026),
        ("screen_active", "screen"),
        bevel=0.001,
        category="display",
    )
    for index, x in enumerate((-0.073, -0.050, -0.012, 0.011), start=1):
        _box(
            f"Cleaner illuminated display segment {index}",
            # Front -164.0 mm, back -163.0 mm: 0.8 mm proud of the display
            # face with 0.2 mm of positive seating into the screen backplate.
            (x, -0.1635, 0.118),
            (0.012 if index != 3 else 0.003, 0.001, 0.003),
            ("screen_ui", "teal"),
            bevel=0.0002,
            category="display detail",
        )
    _cylinder(
        "Cleaner power button surround",
        (-0.121, -0.1612, 0.102),
        0.014,
        0.004,
        ("stainless_bright", "stainless"),
        axis=(0.0, 1.0, 0.0),
        vertices=28,
        category="power control",
    )
    _cylinder(
        "Cleaner power button",
        # Front -164.3 mm, 1.1 mm proud of the surround, while its rear still
        # overlaps that surround by 0.3 mm.
        (-0.121, -0.1636, 0.102),
        0.009,
        0.0014,
        ("control_polymer", "graphite"),
        axis=(0.0, 1.0, 0.0),
        vertices=28,
        category="power control",
    )
    for index, x in enumerate((-0.060, -0.023, 0.014), start=1):
        _box(
            f"Cleaner membrane function key {index}",
            (x, -0.1617, 0.083),
            (0.025, 0.003, 0.017),
            ("control_polymer", "graphite"),
            bevel=0.002,
            category="function control",
        )
        _box(
            f"Cleaner membrane key pictogram {index}",
            # Front -164.0 mm, 0.8 mm proud of the key face, with a 0.2 mm
            # embedded return so the marking is not a floating card.
            (x, -0.1635, 0.084),
            (0.009, 0.001, 0.003),
            ("label", "paper", "warm_white"),
            bevel=0.0002,
            category="control marking",
        )
    _cylinder(
        "Cleaner rotary control collar",
        (0.103, -0.1600, 0.102),
        0.026,
        0.006,
        ("graphite", "seal"),
        axis=(0.0, 1.0, 0.0),
        vertices=40,
        category="rotary control",
    )
    _cylinder(
        "Cleaner rotary control knob",
        # Front -164.0 mm, exactly 1.0 mm proud of the collar face.
        (0.103, -0.1629, 0.102),
        0.021,
        0.0022,
        ("stainless_bright", "stainless"),
        axis=(0.0, 1.0, 0.0),
        vertices=40,
        category="rotary control",
    )
    _box(
        "Cleaner rotary index mark",
        # Front -164.8 mm, 0.8 mm proud of the knob with positive seating.
        (0.103, -0.1643, 0.119),
        (0.002, 0.001, 0.008),
        ("graphite", "seal"),
        bevel=0.0002,
        category="control marking",
    )


def _side_handle() -> None:
    _box(
        "Cleaner side handle pocket",
        # The backing finishes at +177 mm; the formed tube becomes the visible
        # outer handle at roughly +179 mm instead of sharing the +180 mm shell
        # envelope with a large graphite plane.
        (0.1755, 0.0, 0.142),
        (0.003, 0.112, 0.054),
        ("graphite", "seal"),
        bevel=0.004,
        category="handle pocket",
    )
    _curve_tube(
        "Cleaner formed recessed side handle",
        (
            (0.1735, -0.043, 0.134),
            (0.1740, -0.032, 0.154),
            (0.1740, 0.032, 0.154),
            (0.1735, 0.043, 0.134),
        ),
        0.005,
        ("mid_grey", "graphite"),
        category="handle",
    )


def _rear_service() -> None:
    _box(
        "Cleaner rear service cover",
        # Inner +152.5 mm / outer +162.5 mm: the cover still overlaps the
        # enclosure but is no longer flush with the +165 mm rear envelope.
        (0.0, 0.1575, 0.118),
        (0.278, 0.010, 0.140),
        ("mid_grey", "cool_grey"),
        bevel=0.004,
        category="rear service cover",
    )
    louver_index = 0
    for bank_x in (-0.060, 0.026):
        for row in range(4):
            louver_index += 1
            _box(
                f"Cleaner rear louver {louver_index}",
                # Inner +162.3 / outer +163.5 mm: 1 mm proud of the cover
                # with a 0.2 mm bearing overlap.
                (bank_x, 0.1629, 0.118 + row * 0.012),
                (0.041, 0.0012, 0.004),
                ("graphite", "seal"),
                bevel=0.001,
                category="ventilation",
            )
    _box(
        "Cleaner rear mains inlet",
        (0.092, 0.1631, 0.091),
        (0.041, 0.0018, 0.034),
        "graphite",
        bevel=0.002,
        category="rear service inlet",
    )
    _box(
        "Cleaner rear data plate",
        (-0.101, 0.1629, 0.081),
        (0.032, 0.0012, 0.020),
        ("cool_grey", "mid_grey"),
        bevel=0.001,
        category="rear service inlet",
    )
    for x in (-0.118, 0.118):
        for z in (0.063, 0.174):
            _cylinder(
                "Cleaner rear cover fastener",
                # The four small fastener heads retain the exact +165 mm rear
                # envelope without restoring a broad coplanar service panel.
                (x, 0.1637, z),
                0.004,
                0.0026,
                ("zinc", "stainless"),
                axis=(0.0, 1.0, 0.0),
                vertices=20,
                category="fastener",
            )


def _right_drain_valve() -> None:
    _cylinder(
        "Cleaner right drain boss",
        (0.1720, -0.070, 0.067),
        0.014,
        0.009,
        ("stainless", "stainless_bright"),
        axis=(1.0, 0.0, 0.0),
        vertices=36,
        category="drain",
    )
    _cylinder(
        "Cleaner right drain valve collar",
        (0.1765, -0.070, 0.067),
        0.018,
        0.002,
        ("graphite", "rubber"),
        axis=(1.0, 0.0, 0.0),
        vertices=32,
        category="drain valve",
    )
    _cylinder(
        "Cleaner right drain valve hub",
        (0.1775, -0.070, 0.067),
        0.014,
        0.002,
        ("stainless_bright", "stainless"),
        axis=(1.0, 0.0, 0.0),
        vertices=32,
        category="drain valve",
    )
    _cylinder(
        "Cleaner right drain outlet",
        (0.1785, -0.070, 0.067),
        0.009,
        0.002,
        ("graphite", "seal"),
        axis=(1.0, 0.0, 0.0),
        vertices=28,
        category="drain outlet",
    )
    _box(
        "Cleaner right drain blue valve actuator",
        (0.1780, -0.061, 0.087),
        (0.002, 0.044, 0.012),
        "blue_accent",
        bevel=0.002,
        category="drain valve actuator",
    )


def _feet() -> None:
    for x in (-0.135, 0.135):
        for y in (-0.112, 0.112):
            _cylinder(
                "Cleaner rubber isolation foot",
                (x, y, 0.010),
                0.017,
                0.020,
                ("rubber", "seal"),
                vertices=28,
                category="foot",
            )
            _cylinder(
                "Cleaner foot fixing washer",
                (x, y, 0.0215),
                0.010,
                0.003,
                ("zinc", "stainless"),
                vertices=24,
                category="fastener",
            )


def build(spec: f.AssetSpec) -> None:
    """Author the complete ultrasonic cleaner in the caller's active scene."""

    _validate_context(spec)
    _feet()
    enclosure = _closed_container(
        "Cleaner continuous satin enclosure",
        (
            (0.360, 0.316, 0.022, 0.200),
            (0.356, 0.312, 0.020, 0.188),
            (0.348, 0.304, 0.018, 0.040),
            (0.344, 0.300, 0.016, 0.024),
        ),
        (
            (0.308, 0.258, 0.043, 0.200),
            (0.302, 0.252, 0.040, 0.120),
            (0.296, 0.246, 0.037, 0.082),
        ),
        _material("stainless_studio", "stainless"),
        category="stainless enclosure",
    )
    basin = _closed_container(
        "Cleaner pressed stainless basin",
        (
            (0.292, 0.244, 0.040, 0.199),
            (0.288, 0.240, 0.038, 0.128),
            (0.280, 0.232, 0.035, 0.098),
            (0.270, 0.222, 0.032, 0.082),
        ),
        (
            (0.286, 0.238, 0.038, 0.199),
            (0.282, 0.234, 0.036, 0.126),
            (0.274, 0.226, 0.033, 0.100),
            (0.264, 0.216, 0.029, 0.086),
        ),
        _material("stainless_bright", "stainless", "stainless_studio"),
        category="pressed basin",
    )
    rim = _continuous_annular_rim()
    lid_pivot = _lid_assembly()
    _front_controller()
    _side_handle()
    _right_drain_valve()
    _rear_service()

    # Persistent source-scene evidence without changing the caller's export or
    # optimization policy.
    assert f.ROOT is not None
    f.ROOT["cleaner_product_revision"] = "reference-formed-lid-cleaner-r3-stepped-panels"
    f.ROOT["cleaner_basin_object"] = basin.name
    f.ROOT["cleaner_rim_object"] = rim.name
    f.ROOT["cleaner_enclosure_object"] = enclosure.name
    f.ROOT["cleaner_lid_pivot_object"] = lid_pivot.name
    f.ROOT["cleaner_continuous_rim"] = True
    f.ROOT["cleaner_continuous_lid_return"] = True
    f.ROOT["cleaner_lid_open_degrees"] = 20.0
    f.ROOT["cleaner_opaque_materials"] = True
    f.ROOT["cleaner_raw_dimensions_m"] = list(AUTHORED_DIMENSIONS)


def contact_pairs(asset_id: str) -> tuple[tuple[str, str], ...]:
    return CONTACT_PAIRS.get(asset_id, ())


__all__ = ["AUTHORED_DIMENSIONS", "CONTACT_PAIRS", "build", "contact_pairs"]
