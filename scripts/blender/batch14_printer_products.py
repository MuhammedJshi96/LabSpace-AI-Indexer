"""Reference-led product builders for the two batch-14 printer families.

This module intentionally contains geometry only.  The caller owns scene
reset/root creation, registers the shared :mod:`lab_furniture` materials, and
handles export.  Both builders create closed, all-sided molded chassis.  The
only deliberate void is the bounded front paper-output path, which has a real
back, roof, floor, and side returns.

The models are original and logo-free.  Object names describe manufacturing
roles so source-scene QA can audit fixed contact and material assignments.
"""
from __future__ import annotations

from collections.abc import Iterable
import math

import bmesh
import bpy

import lab_furniture as f


# Pairs are fixed construction interfaces.  They are deliberately small and
# stable so a caller can run its ordinary 2 mm continuity/contact gate without
# depending on implementation order or anonymous primitive names.
CONTACT_PAIRS: dict[str, tuple[tuple[str, str], ...]] = {
    "high-volume-multifunction-printer": (
        ("High-volume molded wraparound shell", "High-volume scanner deck"),
        ("High-volume scanner deck", "High-volume scanner lid"),
        ("High-volume scanner lid", "High-volume offset ADF body"),
        ("High-volume offset ADF body", "High-volume ADF input tray"),
        ("High-volume output cavity floor", "High-volume output left return"),
        ("High-volume output cavity floor", "High-volume output right return"),
        ("High-volume output cavity roof", "High-volume output left return"),
        ("High-volume output cavity roof", "High-volume output right return"),
    ),
    "compact-ink-tank-printer": (
        ("Compact molded wraparound shell", "Compact scanner deck"),
        ("Compact scanner deck", "Compact scanner lid"),
        ("Compact molded wraparound shell", "Compact control bridge"),
        ("Compact output cavity floor", "Compact output left return"),
        ("Compact output cavity floor", "Compact output right return"),
        ("Compact output cavity roof", "Compact output left return"),
        ("Compact output cavity roof", "Compact output right return"),
    ),
}


def _material(*keys: str) -> bpy.types.Material:
    """Return the first registered, fully opaque shared material."""
    material = next((f.MATERIALS[key] for key in keys if key in f.MATERIALS), None)
    if material is None:
        raise RuntimeError(
            "Printer product builders require caller-registered material: "
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
            f"Printer material must be opaque: {material.name} "
            f"(alpha={alpha:.4f}, transmission={transmission:.4f})"
        )
    return material


def _validate_context() -> None:
    if f.ROOT is None:
        raise RuntimeError("Caller must create lab_furniture.ROOT before building a printer")
    if not f.MATERIALS:
        raise RuntimeError("Caller must register lab_furniture materials before building a printer")


def _box(
    name: str,
    xyz: tuple[float, float, float],
    size: tuple[float, float, float],
    material_keys: str | tuple[str, ...],
    *,
    bevel: float = 0.002,
    category: str,
    rotation: tuple[float, float, float] | None = None,
) -> bpy.types.Object:
    keys = (material_keys,) if isinstance(material_keys, str) else material_keys
    obj = f.add_box(
        name,
        xyz,
        size,
        _material(*keys),
        bevel=min(bevel, 0.012),
        category=category,
    )
    if rotation is not None:
        obj.rotation_euler = rotation
    return obj


def _extruded_side_profile(
    name: str,
    width: float,
    profile: tuple[tuple[float, float], ...],
    material_keys: str | tuple[str, ...],
    *,
    x: float = 0.0,
    bevel: float,
    category: str,
) -> bpy.types.Object:
    """Extrude one closed Y/Z appliance profile across X.

    This is used for formed control/feeder housings where a rectangular box
    stack would lose the reference silhouette and create implausible seams.
    """

    keys = (material_keys,) if isinstance(material_keys, str) else material_keys
    half_width = width * 0.5
    vertices = [(x - half_width, y, z) for y, z in profile]
    vertices.extend((x + half_width, y, z) for y, z in profile)
    count = len(profile)
    faces: list[tuple[int, ...]] = [
        tuple(range(count - 1, -1, -1)),
        tuple(range(count, count * 2)),
    ]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, nxt + count, index + count))
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
    f.assign_material(obj, _material(*keys))
    if bevel > 0:
        modifier = obj.modifiers.new("Formed appliance edge radii", "BEVEL")
        modifier.width = min(bevel, 0.012)
        modifier.segments = 4
        modifier.limit_method = "ANGLE"
        modifier.harden_normals = True
    return f.parent_to_root(obj, category)


def _cut_rounded_recess(
    target: bpy.types.Object,
    name: str,
    xyz: tuple[float, float, float],
    size: tuple[float, float, float],
    *,
    radius: float,
) -> None:
    """Cut a real bounded product recess into a closed molded enclosure."""
    bpy.ops.mesh.primitive_cube_add(location=xyz)
    cutter = bpy.context.object
    cutter.name = name
    cutter.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if radius > 0:
        bevel = cutter.modifiers.new("Recess corner tooling radius", "BEVEL")
        bevel.width = min(radius, min(size) * 0.22)
        bevel.segments = 4
        bevel.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = cutter
        bpy.ops.object.modifier_apply(modifier=bevel.name)
    boolean = target.modifiers.new(name, "BOOLEAN")
    boolean.operation = "DIFFERENCE"
    boolean.solver = "EXACT"
    boolean.object = cutter
    bpy.context.view_layer.objects.active = target
    target.select_set(True)
    result = bpy.ops.object.modifier_apply(modifier=boolean.name)
    if "FINISHED" not in result:
        raise RuntimeError(f"Could not form printer recess {name}")
    bpy.data.objects.remove(cutter, do_unlink=True)


def _manufactured_bevel(
    target: bpy.types.Object,
    width: float,
    *,
    segments: int = 4,
) -> None:
    modifier = target.modifiers.new("Injection-molded enclosure radii", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    modifier.harden_normals = True


def _front_recess_backer(
    target: bpy.types.Object,
    tooling_name: str,
    part_name: str,
    x: float,
    surface_y: float,
    z: float,
    opening_width: float,
    opening_height: float,
    material_keys: str | tuple[str, ...],
    *,
    inset: float = 0.0012,
    backer_depth: float = 0.004,
    radius: float = 0.003,
    category: str,
) -> bpy.types.Object:
    """Cut a bounded front recess and seat one overlapping backer behind it."""

    _cut_rounded_recess(
        target,
        tooling_name,
        (x, surface_y + 0.003, z),
        (opening_width, 0.010, opening_height),
        radius=radius,
    )
    return _box(
        part_name,
        (x, surface_y + inset + backer_depth * 0.5, z),
        (opening_width + 0.006, backer_depth, opening_height + 0.006),
        material_keys,
        bevel=min(radius, 0.002),
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
    category: str,
    vertices: int = 24,
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


def _feet(prefix: str, width: float, depth: float) -> None:
    for index, x in enumerate((-width * 0.38, width * 0.38), start=1):
        for side, y in enumerate((-depth * 0.34, depth * 0.34), start=1):
            _cylinder(
                f"{prefix} rubber foot {index}-{side}",
                (x, y, 0.009),
                0.015,
                0.018,
                ("rubber", "seal"),
                category="foot",
            )
            _cylinder(
                f"{prefix} foot washer {index}-{side}",
                (x, y, 0.019),
                0.009,
                0.003,
                ("zinc", "stainless"),
                category="fastener",
            )


def _front_screen(
    prefix: str,
    backing: bpy.types.Object,
    x: float,
    front_y: float,
    z: float,
    width: float,
    height: float,
) -> None:
    # One real opening in the scanner deck carries a closed graphite ring and
    # a screen panel behind it.  The three visible depths are deliberately
    # separated so the GPU never resolves coplanar decorative overlays.
    _cut_rounded_recess(
        backing,
        f"{prefix} formed display recess",
        (x, front_y + 0.004, z),
        (width + 0.010, 0.012, height + 0.010),
        radius=0.004,
    )
    bezel = _box(
        f"{prefix} integrated display bezel",
        (x, front_y + 0.004, z),
        (width, 0.006, height),
        "graphite",
        bevel=0,
        category="display bezel",
    )
    visible_width = width * 0.78
    visible_height = height * 0.68
    _cut_rounded_recess(
        bezel,
        f"{prefix} display bezel opening",
        (x, front_y + 0.004, z),
        (visible_width, 0.010, visible_height),
        radius=0.002,
    )
    _manufactured_bevel(bezel, 0.002, segments=3)
    _box(
        f"{prefix} opaque display face",
        (x, front_y + 0.007, z),
        (visible_width + 0.006, 0.002, visible_height + 0.006),
        ("screen", "screen_active"),
        bevel=0.001,
        category="display",
    )
    _box(
        f"{prefix} display status field",
        (x - width * 0.18, front_y + 0.0054, z + height * 0.10),
        (width * 0.18, 0.0008, height * 0.10),
        ("screen_ui", "teal"),
        bevel=0.0005,
        category="display",
    )


def _rear_service_anatomy(
    prefix: str,
    rear_y: float,
    width: float,
    body_bottom: float,
    body_top: float,
) -> None:
    panel_width = width * 0.66
    panel_height = (body_top - body_bottom) * 0.54
    panel_z = body_bottom + (body_top - body_bottom) * 0.53
    _box(
        f"{prefix} rear service hatch",
        (0.0, rear_y - 0.0035, panel_z),
        (panel_width, 0.003, panel_height),
        ("mid_grey", "cool_grey"),
        bevel=0.0015,
        category="rear service hatch",
    )
    # Vent slots terminate on the hatch plane; they are not holes through an
    # otherwise open shell.
    for index in range(7):
        _box(
            f"{prefix} rear exhaust slot {index + 1:02}",
            (-panel_width * 0.31 + index * panel_width * 0.085,
             rear_y - 0.0015,
             panel_z + panel_height * 0.24),
            (panel_width * 0.052, 0.001, 0.009),
            ("graphite", "seal"),
            bevel=0,
            category="ventilation",
        )
    _box(
        f"{prefix} rear mains inlet",
        (width * 0.22, rear_y - 0.0015, body_bottom + 0.060),
        (0.038, 0.001, 0.032),
        "graphite",
        bevel=0.001,
        category="rear service port",
    )
    _box(
        f"{prefix} rear data port",
        (width * 0.12, rear_y - 0.0015, body_bottom + 0.074),
        (0.025, 0.001, 0.017),
        "graphite",
        bevel=0.0008,
        category="rear service port",
    )
    for x in (-panel_width * 0.45, panel_width * 0.45):
        for z in (panel_z - panel_height * 0.38, panel_z + panel_height * 0.38):
            _cylinder(
                f"{prefix} rear hatch fastener",
                (x, rear_y - 0.0013, z),
                0.004,
                0.001,
                ("zinc", "stainless"),
                axis=(0.0, 1.0, 0.0),
                category="fastener",
                vertices=20,
            )


def _output_path(
    prefix: str,
    front_y: float,
    center_x: float,
    bottom_z: float,
    width: float,
    height: float,
    depth: float,
    *,
    include_reference_sheet: bool = False,
) -> None:
    """Create one bounded, front-facing paper path with closed returns."""
    back_y = front_y + depth
    wall = 0.012
    # Stop the four returns on the *front* of the back wall.  Previously they
    # extended through the wall to ``back_y``, leaving large same-facing rear
    # end faces exactly coincident with the wall's rear face in the runtime
    # depth buffer.  This is now a true opposite-facing butt/bearing joint.
    return_depth = depth - wall
    return_center_y = front_y + return_depth * 0.5
    _box(
        f"{prefix} output cavity back",
        (center_x, back_y - wall * 0.5, bottom_z + height * 0.5),
        (width, wall, height),
        "graphite",
        bevel=0.0015,
        category="paper path",
    )
    _box(
        f"{prefix} output cavity floor",
        (center_x, return_center_y, bottom_z + wall * 0.5),
        (width, return_depth, wall),
        ("cool_grey", "mid_grey"),
        bevel=0.0015,
        category="paper path return",
    )
    _box(
        f"{prefix} output cavity roof",
        (center_x, return_center_y, bottom_z + height - wall * 0.5),
        (width, return_depth, wall),
        ("cool_grey", "mid_grey"),
        bevel=0.0015,
        category="paper path return",
    )
    for side, x in (("left", center_x - width * 0.5 + wall * 0.5),
                    ("right", center_x + width * 0.5 - wall * 0.5)):
        _box(
            f"{prefix} output {side} return",
            (x, return_center_y, bottom_z + height * 0.5),
            (wall, return_depth, height),
            ("cool_grey", "mid_grey"),
            bevel=0.0015,
            category="paper path return",
        )
    _cylinder(
        f"{prefix} output pinch roller",
        (center_x, back_y - wall - 0.008, bottom_z + height * 0.68),
        0.008,
        width * 0.68,
        ("rubber", "seal"),
        axis=(1.0, 0.0, 0.0),
        category="paper path",
    )
    if include_reference_sheet:
        _box(
            f"{prefix} output reference sheet",
            (center_x, front_y + depth * 0.52, bottom_z + wall + 0.0015),
            (width * 0.76, depth * 0.60, 0.003),
            ("label", "powder_light", "porcelain"),
            bevel=0.0008,
            category="paper",
        )


def _ink_bay(
    prefix: str,
    target: bpy.types.Object,
    center_x: float,
    surface_y: float,
    center_z: float,
    width: float,
    height: float,
) -> None:
    _front_recess_backer(
        target,
        f"{prefix} formed ink-bay recess",
        f"{prefix} integrated ink-bay bezel",
        center_x,
        surface_y,
        center_z,
        width,
        height,
        "graphite",
        inset=0.0018,
        backer_depth=0.004,
        radius=0.002,
        category="ink service bay",
    )
    materials = ("ink_cyan", "ink_magenta", "ink_yellow", "graphite")
    spacing = width * 0.18
    for index, (material, offset) in enumerate(
        zip(materials, (-1.5 * spacing, -0.5 * spacing, 0.5 * spacing, 1.5 * spacing)),
        start=1,
    ):
        _box(
            f"{prefix} ink reservoir indicator {index}",
            (center_x + offset, surface_y + 0.0015, center_z),
            (width * 0.11, 0.001, height * 0.66),
            material,
            bevel=0.0005,
            category="ink indicator",
        )


def _assert_positive_dimensions(spec: f.AssetSpec) -> None:
    if min(spec.width, spec.depth, spec.height) <= 0:
        raise ValueError(f"Printer dimensions must be positive: {spec}")


def build_high_volume(spec: f.AssetSpec) -> None:
    """Build the wide, two-cassette MFP with a left-offset ADF."""
    _validate_context()
    _assert_positive_dimensions(spec)
    w, d, h = spec.width, spec.depth, spec.height
    front_y, rear_y = -d * 0.5, d * 0.5
    body_bottom = 0.020
    body_top = h * 0.640
    side = max(0.016, min(0.020, w * 0.034))

    _feet("High-volume", w, d)
    # One real wraparound enclosure replaces the old stack of separate side,
    # rear, floor and roof boxes.  Rounded boolean tooling forms the paper path
    # and cassette seams while leaving the back and both sides genuinely closed.
    shell = _box(
        "High-volume molded wraparound shell",
        (0.0, 0.0, (body_bottom + body_top) * 0.5),
        (w, d, body_top - body_bottom),
        ("warm_white", "porcelain"),
        bevel=0.0,
        category="molded chassis",
    )

    cassette_center_x = -w * 0.075
    cassette_width = w * 0.64
    cassette_height = h * 0.135
    cassette_face_front = front_y + 0.002
    cassette_face_depth = 0.010
    cassette_carrier_front = front_y + 0.011
    cassette_carrier_depth = d * 0.24
    for index, center_z in enumerate((h * 0.145, h * 0.285), start=1):
        _box(
            f"High-volume cassette {index} carrier",
            (cassette_center_x,
             cassette_carrier_front + cassette_carrier_depth * 0.5,
             center_z),
            (cassette_width, cassette_carrier_depth, cassette_height),
            ("cool_grey", "mid_grey"),
            bevel=0.002,
            category="paper cassette carrier",
        )
        cassette_face = _box(
            f"High-volume cassette {index} face",
            (cassette_center_x,
             cassette_face_front + cassette_face_depth * 0.5,
             center_z),
            (cassette_width, cassette_face_depth, cassette_height - 0.008),
            ("powder_light", "porcelain"),
            bevel=0,
            category="paper cassette",
        )
        _front_recess_backer(
            cassette_face,
            f"High-volume cassette {index} formed pull recess",
            f"High-volume cassette {index} recessed pull",
            cassette_center_x,
            cassette_face_front,
            center_z,
            cassette_width * 0.30,
            0.025,
            "graphite",
            inset=0.0012,
            backer_depth=0.004,
            radius=0.002,
            category="recessed cassette pull",
        )
        _manufactured_bevel(cassette_face, 0.003, segments=3)

    cavity_center_x = -w * 0.075
    cavity_width = w * 0.64
    cavity_bottom = h * 0.420
    cavity_height = h * 0.165
    _cut_rounded_recess(
        shell,
        "High-volume formed output aperture",
        (cavity_center_x, front_y + d * 0.095,
         cavity_bottom + cavity_height * 0.5),
        (cavity_width + 0.010, d * 0.22, cavity_height + 0.010),
        radius=0.009,
    )
    for index, center_z in enumerate((h * 0.145, h * 0.285), start=1):
        _cut_rounded_recess(
            shell,
            f"High-volume cassette {index} formed recess",
            (cassette_center_x, front_y + 0.010, center_z),
            (cassette_width + 0.008, 0.028, cassette_height + 0.008),
            radius=0.005,
        )
    service_width = w * 0.205
    service_x = w * 0.5 - side - service_width * 0.5
    service_door_front = front_y + 0.002
    _cut_rounded_recess(
        shell,
        "High-volume formed service-door recess",
        (service_x, front_y + 0.003, h * 0.340),
        (service_width + 0.006, 0.010, h * 0.49 + 0.006),
        radius=0.004,
    )
    rear_panel_width = w * 0.66
    rear_panel_height = (body_top - body_bottom) * 0.54
    rear_panel_z = body_bottom + (body_top - body_bottom) * 0.53
    _cut_rounded_recess(
        shell,
        "High-volume formed rear service recess",
        (0.0, rear_y - 0.003, rear_panel_z),
        (rear_panel_width + 0.008, 0.010, rear_panel_height + 0.008),
        radius=0.004,
    )
    _manufactured_bevel(shell, 0.014, segments=5)
    _output_path(
        "High-volume",
        front_y,
        cavity_center_x,
        cavity_bottom,
        cavity_width,
        cavity_height,
        d * 0.19,
    )
    # Connected front rails close every region outside the paper opening.
    _box(
        "High-volume output lower bearing rail",
        (cavity_center_x, front_y + 0.007, cavity_bottom - 0.010),
        (cavity_width, 0.010, 0.020),
        ("warm_white", "porcelain"),
        bevel=0.002,
        category="front chassis return",
    )
    _box(
        "High-volume output upper bearing rail",
        (cavity_center_x, front_y + 0.007, cavity_bottom + cavity_height + 0.010),
        (cavity_width, 0.010, 0.020),
        ("warm_white", "porcelain"),
        bevel=0.002,
        category="front chassis return",
    )
    service_door = _box(
        "High-volume right service column",
        (service_x, service_door_front + 0.005, h * 0.340),
        (service_width, 0.010, h * 0.49),
        ("powder_light", "porcelain"),
        bevel=0,
        category="ink service door",
    )
    _ink_bay(
        "High-volume",
        service_door,
        service_x,
        service_door_front,
        h * 0.330,
        service_width * 0.58,
        h * 0.135,
    )
    _manufactured_bevel(service_door, 0.003, segments=3)

    # Scanner deck overlaps the chassis roof by 10 mm and retains continuous
    # full-depth side surfaces.
    deck_bottom = body_top - 0.010
    deck_top = h * 0.760
    deck = _box(
        "High-volume scanner deck",
        (0.0, 0.0, (deck_bottom + deck_top) * 0.5),
        # One-millimetre perimeter reveal removes the shell/deck coplanar
        # exterior faces while preserving their 10 mm vertical bearing joint.
        (w - 0.002, d - 0.002, deck_top - deck_bottom),
        ("porcelain", "warm_white"),
        bevel=0,
        category="scanner deck",
    )
    _front_screen(
        "High-volume",
        deck,
        -w * 0.335,
        front_y,
        h * 0.675,
        w * 0.22,
        h * 0.105,
    )
    _manufactured_bevel(deck, 0.010, segments=4)
    _box(
        "High-volume scanner gasket",
        (0.0, 0.0, deck_top - 0.002),
        (w * 0.90, d * 0.82, 0.006),
        "seal",
        bevel=0.0015,
        category="scanner gasket",
    )
    lid_bottom = deck_top - 0.003
    lid_top = h * 0.830
    _box(
        "High-volume scanner lid",
        (-w * 0.025, 0.0, (lid_bottom + lid_top) * 0.5),
        (w * 0.91, d * 0.82, lid_top - lid_bottom),
        ("cool_grey", "mid_grey"),
        bevel=0.008,
        category="scanner lid",
    )
    for x in (-w * 0.31, w * 0.25):
        _cylinder(
            "High-volume scanner hinge",
            (x, d * 0.36, lid_bottom + 0.006),
            0.010,
            w * 0.095,
            ("zinc", "stainless"),
            axis=(1.0, 0.0, 0.0),
            category="scanner hinge",
        )

    adf_x = -w * 0.15
    adf_bottom = lid_top
    adf_top = h - 0.020
    _extruded_side_profile(
        "High-volume offset ADF body",
        w * 0.58,
        (
            (-d * 0.16, adf_bottom),
            (-d * 0.16, adf_top - 0.012),
            (-d * 0.08, adf_top),
            (d * 0.18, adf_top),
            (d * 0.23, adf_top - 0.014),
            (d * 0.23, adf_bottom + 0.004),
        ),
        ("mid_grey", "cool_grey"),
        x=adf_x,
        bevel=0.007,
        category="automatic document feeder",
    )
    _box(
        "High-volume ADF feed throat",
        (adf_x, -d * 0.18, adf_bottom + 0.021),
        (w * 0.38, 0.012, 0.030),
        "graphite",
        bevel=0.0015,
        category="automatic document feeder",
    )
    _cylinder(
        "High-volume ADF pickup roller",
        (adf_x, -d * 0.15, adf_bottom + 0.032),
        0.009,
        w * 0.34,
        ("rubber", "seal"),
        axis=(1.0, 0.0, 0.0),
        category="automatic document feeder",
    )
    _box(
        "High-volume ADF input tray",
        (adf_x - w * 0.015, d * 0.19, h - 0.010),
        (w * 0.50, d * 0.28, 0.020),
        ("mid_grey", "cool_grey"),
        bevel=0.006,
        category="automatic document feeder",
    )
    for side_sign in (-1.0, 1.0):
        _box(
            "High-volume ADF paper guide",
            (adf_x + side_sign * w * 0.18, d * 0.19, h - 0.019),
            (0.013, d * 0.18, 0.014),
            ("cool_grey", "mid_grey"),
            bevel=0.001,
            category="automatic document feeder",
        )

    _rear_service_anatomy("High-volume", rear_y, w, body_bottom, body_top)


def build_compact(spec: f.AssetSpec) -> None:
    """Build the low, single-cassette compact MFP from the supplied view sheet.

    The reference is a broad, low product with one continuous white enclosure,
    a full-width dark control bridge, a bounded paper-output aperture and a
    single large lower cassette plus the reference's right ink/service bay.
    It intentionally has no unrelated upright rear paper support.
    """
    _validate_context()
    _assert_positive_dimensions(spec)
    w, d, h = spec.width, spec.depth, spec.height
    front_y, rear_y = -d * 0.5, d * 0.5
    body_bottom = 0.018
    body_top = h * 0.690

    _feet("Compact", w, d)
    shell = _box(
        "Compact molded wraparound shell",
        # Recess the molded front datum 4 mm while retaining the authored rear
        # envelope. This lets the reference-defining fascia, cassette and
        # paper-path returns sit visibly proud instead of z-fighting a white
        # coplanar shell in the real-time renderer.
        (0.0, 0.002, (body_bottom + body_top) * 0.5),
        (w, d - 0.004, body_top - body_bottom),
        ("warm_white", "porcelain"),
        bevel=0.0,
        category="molded chassis",
    )

    cassette_center_x = 0.0
    cassette_width = w * 0.76
    cassette_height = h * 0.255
    cassette_z = h * 0.165
    cassette_face_front = front_y + 0.001
    cassette_face_depth = 0.010
    cassette_carrier_front = front_y + 0.010
    cassette_carrier_depth = d * 0.24
    _box(
        "Compact main cassette carrier",
        (cassette_center_x,
         cassette_carrier_front + cassette_carrier_depth * 0.5,
         cassette_z),
        (cassette_width, cassette_carrier_depth, cassette_height),
        ("cool_grey", "mid_grey"),
        bevel=0.002,
        category="paper cassette carrier",
    )
    cassette_face = _box(
        "Compact main cassette face",
        (cassette_center_x,
         cassette_face_front + cassette_face_depth * 0.5,
         cassette_z),
        (cassette_width, cassette_face_depth, cassette_height - 0.009),
        ("powder_light", "porcelain"),
        bevel=0,
        category="paper cassette",
    )
    _front_recess_backer(
        cassette_face,
        "Compact cassette formed pull recess",
        "Compact cassette recessed pull",
        cassette_center_x,
        cassette_face_front,
        cassette_z + cassette_height * 0.16,
        cassette_width * 0.22,
        0.021,
        ("mid_grey", "cool_grey"),
        inset=0.0012,
        backer_depth=0.004,
        radius=0.002,
        category="recessed cassette pull",
    )
    _manufactured_bevel(cassette_face, 0.003, segments=3)

    cavity_center_x = 0.0
    cavity_width = w * 0.76
    cavity_bottom = h * 0.405
    cavity_height = h * 0.205
    _cut_rounded_recess(
        shell,
        "Compact formed output aperture",
        (cavity_center_x, front_y + d * 0.085,
         cavity_bottom + cavity_height * 0.5),
        (cavity_width + 0.010, d * 0.20, cavity_height + 0.010),
        radius=0.007,
    )
    _cut_rounded_recess(
        shell,
        "Compact cassette formed recess",
        (cassette_center_x, front_y + 0.010, cassette_z),
        (cassette_width + 0.008, 0.028, cassette_height + 0.008),
        radius=0.005,
    )
    rear_panel_z = h * 0.330
    rear_panel_h = h * 0.395
    _cut_rounded_recess(
        shell,
        "Compact formed rear service recess",
        (0.0, rear_y - 0.003, rear_panel_z),
        (w * 0.82 + 0.008, 0.010, rear_panel_h + 0.008),
        radius=0.004,
    )
    side_vent_y = d * 0.060
    side_vent_z = h * 0.465
    _cut_rounded_recess(
        shell,
        "Compact formed side ventilation recess",
        (w * 0.5 - 0.001, side_vent_y, side_vent_z),
        (0.004, d * 0.30, h * 0.23),
        radius=0.002,
    )
    _manufactured_bevel(shell, 0.014, segments=5)
    _output_path(
        "Compact",
        front_y,
        cavity_center_x,
        cavity_bottom,
        cavity_width,
        cavity_height,
        d * 0.17,
    )
    _box(
        "Compact output lower bearing rail",
        (cavity_center_x, front_y + 0.007, cavity_bottom - 0.009),
        (cavity_width, 0.010, 0.018),
        ("warm_white", "porcelain"),
        bevel=0.002,
        category="front chassis return",
    )
    _box(
        "Compact output upper bearing rail",
        (cavity_center_x, front_y + 0.007, cavity_bottom + cavity_height + 0.009),
        (cavity_width, 0.010, 0.018),
        ("warm_white", "porcelain"),
        bevel=0.002,
        category="front chassis return",
    )
    deck_bottom = body_top - 0.009
    deck_top = h * 0.825
    _box(
        "Compact scanner deck",
        (0.0, 0.003, (deck_bottom + deck_top) * 0.5),
        # Inset all four outer deck planes by one millimetre relative to the
        # shell while retaining the authored 9 mm vertical bearing overlap.
        (w - 0.002, d - 0.008, deck_top - deck_bottom),
        ("porcelain", "warm_white"),
        bevel=0.010,
        category="scanner deck",
    )
    # The reference's control surface is one structural bridge spanning the
    # front, not a small display plaque floating on the enclosure.  Its upper
    # face rises gently toward the scanner so the controls remain legible from
    # the user's standing viewpoint.
    bridge_bottom = h * 0.635
    bridge_top = h * 0.810
    bridge_depth = d * 0.14
    bridge_front_top = h * 0.760
    _extruded_side_profile(
        "Compact control bridge",
        w * 0.96,
        (
            (front_y, bridge_bottom),
            (front_y, bridge_front_top),
            (front_y + bridge_depth, bridge_top),
            (front_y + bridge_depth, bridge_bottom + 0.006),
        ),
        ("graphite", "mid_grey", "cool_grey"),
        bevel=0.007,
        category="integrated control bridge",
    )
    control_angle = math.atan2(bridge_top - bridge_front_top, bridge_depth)
    control_y = front_y + bridge_depth * 0.48
    control_surface_z = (
        bridge_front_top + (bridge_top - bridge_front_top) * 0.48
    )
    control_rotation = (control_angle, 0.0, 0.0)
    control_normal = (0.0, -math.sin(control_angle), math.cos(control_angle))
    display_offset = 0.0005
    _box(
        "Compact control display",
        (-w * 0.12,
         control_y + control_normal[1] * display_offset,
         control_surface_z + control_normal[2] * display_offset),
        (w * 0.150, d * 0.040, 0.003),
        ("screen", "graphite"),
        bevel=0.001,
        category="display",
        rotation=control_rotation,
    )
    _box(
        "Compact control display status line",
        (-w * 0.12,
         control_y + control_normal[1] * 0.0024,
         control_surface_z + control_normal[2] * 0.0024),
        (w * 0.090, d * 0.010, 0.001),
        ("screen_ui", "teal"),
        bevel=0.0002,
        category="display",
        rotation=control_rotation,
    )
    # A restrained, reference-led navigation cluster.  The shallow cylinders
    # sit into the bridge datum and therefore cannot read as floating dots.
    for index, x in enumerate((
        -w * 0.305,
        w * 0.055,
        w * 0.090,
        w * 0.125,
        w * 0.255,
        w * 0.300,
    ), start=1):
        key_material = (
            "teal" if index == 5 else
            "amber" if index == 6 else
            "blue_accent" if index == 4 else
            "cool_grey"
        )
        _cylinder(
            f"Compact inset control key {index:02}",
            (x,
             control_y + control_normal[1] * 0.001,
             control_surface_z + control_normal[2] * 0.001),
            0.006 if index != 3 else 0.008,
            0.003,
            (key_material, "mid_grey"),
            axis=control_normal,
            category="control key",
            vertices=24,
        )
    _box(
        "Compact scanner gasket",
        (0.0, 0.0, deck_top - 0.002),
        (w * 0.90, d * 0.82, 0.005),
        "seal",
        bevel=0.001,
        category="scanner gasket",
    )
    lid_bottom = deck_top - 0.002
    lid_top = h
    _box(
        "Compact scanner lid",
        (0.0, -d * 0.005, (lid_bottom + lid_top) * 0.5),
        (w * 0.92, d * 0.88, lid_top - lid_bottom),
        ("powder_light", "porcelain"),
        bevel=0.010,
        category="scanner lid",
    )
    for x in (-w * 0.29, w * 0.24):
        _cylinder(
            "Compact scanner hinge",
            (x, d * 0.35, lid_bottom + 0.005),
            0.008,
            w * 0.085,
            ("zinc", "stainless"),
            axis=(1.0, 0.0, 0.0),
            category="scanner hinge",
        )

    # Right-side louvres sit on a real shallow formed pocket.  The cool-grey
    # backer touches the pocket floor; black slot inserts sit another millimetre
    # outward while remaining one millimetre behind the white side datum.
    _box(
        "Compact side ventilation backing",
        (w * 0.5 - 0.0025, side_vent_y, side_vent_z),
        (0.001, d * 0.28, h * 0.21),
        ("cool_grey", "mid_grey"),
        bevel=0.001,
        category="side ventilation backing",
    )
    for row in range(5):
        for column in range(8):
            _box(
                f"Compact side vent {row + 1:02}-{column + 1:02}",
                (w * 0.5 - 0.0015,
                 d * 0.06 + (column - 3.5) * 0.014,
                 h * 0.465 + (row - 2) * 0.010),
                (0.001, 0.009, 0.004),
                ("seal", "graphite"),
                bevel=0,
                category="side ventilation",
            )

    # The rear is a deliberately dark, serviceable machine panel rather than
    # a duplicate white facade.  It seats two millimetres inside a bounded
    # recess; vents and ports step forward by one millimetre without reaching
    # the outer body plane.
    _box(
        "Compact rear service panel",
        (0.0, rear_y - 0.0035, rear_panel_z),
        (w * 0.82, 0.003, rear_panel_h),
        ("graphite", "screen"),
        bevel=0.003,
        category="rear service panel",
    )
    for row in range(3):
        for column in range(10):
            _box(
                f"Compact rear exhaust slot {row + 1:02}-{column + 1:02}",
                (-w * 0.24 + column * w * 0.035,
                 rear_y - 0.0015,
                 rear_panel_z + rear_panel_h * 0.24 + row * 0.009),
                (w * 0.022, 0.001, 0.004),
                ("seal", "rubber"),
                bevel=0,
                category="rear ventilation",
            )
    for index, (x, width) in enumerate(((w * 0.235, 0.035),
                                        (w * 0.105, 0.022),
                                        (w * 0.170, 0.025)), start=1):
        _box(
            f"Compact rear service port {index:02}",
            (x, rear_y - 0.0015, h * 0.205),
            (width, 0.001, 0.027 if index == 1 else 0.018),
            ("rubber", "seal"),
            bevel=0.001,
            category="rear service port",
        )


def contact_pairs(asset_id: str) -> Iterable[tuple[str, str]]:
    """Expose the fixed-contact contract without leaking mutable internals."""
    return CONTACT_PAIRS.get(asset_id, ())


__all__ = ["CONTACT_PAIRS", "build_high_volume", "build_compact", "contact_pairs"]
