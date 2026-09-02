"""Blender product builders for the final September 2 reference trio.

These builders create original, logo-free, dimension-led product geometry in
Blender.  They deliberately keep manufacturing parts named and separate in the
editable source scene; runtime batching is owned by the calling build script.
"""
from __future__ import annotations

import math
from collections.abc import Iterable

import bpy
from mathutils import Vector

import lab_furniture as f


HOTPLATE_ID = "hotplate-stirrer"
BALANCE_ID = "analytical-balance"


def _mat(*keys: str) -> bpy.types.Material:
    material = next((f.MATERIALS[key] for key in keys if key in f.MATERIALS), None)
    if material is None:
        raise RuntimeError("Missing product material: " + " or ".join(keys))
    return material


def _box(name, xyz, size, materials, *, bevel=.003, category="detail"):
    keys = (materials,) if isinstance(materials, str) else materials
    return f.add_box(
        name, xyz, size, _mat(*keys), bevel=bevel, category=category,
    )


def _cyl(
    name,
    xyz,
    radius,
    depth,
    materials,
    *,
    axis=(0.0, 0.0, 1.0),
    vertices=32,
    bevel=.001,
    category="hardware",
):
    keys = (materials,) if isinstance(materials, str) else materials
    return f.add_cylinder(
        name,
        xyz,
        radius,
        depth,
        _mat(*keys),
        axis=axis,
        vertices=vertices,
        bevel=bevel,
        category=category,
    )


def _torus(
    name,
    xyz,
    major_radius,
    minor_radius,
    materials,
    *,
    axis=(0.0, 0.0, 1.0),
    major_segments=32,
    category="hardware",
):
    keys = (materials,) if isinstance(materials, str) else materials
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=major_segments,
        minor_segments=8,
        location=xyz,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(
        Vector(axis).normalized()
    )
    f.assign_material(obj, _mat(*keys))
    f.smooth(obj)
    return f.parent_to_root(obj, category)


def _wedge(
    name: str,
    *,
    width: float,
    depth: float,
    bottom: float,
    front_top: float,
    rear_top: float,
    y_center: float = 0.0,
    materials=("powder_light", "porcelain"),
    bevel=.004,
    category="formed enclosure",
) -> bpy.types.Object:
    """Create a watertight tapered enclosure without stacked-box silhouette."""
    x0, x1 = -width / 2, width / 2
    y0, y1 = y_center - depth / 2, y_center + depth / 2
    vertices = [
        (x0, y0, bottom), (x1, y0, bottom),
        (x1, y1, bottom), (x0, y1, bottom),
        (x0, y0, front_top), (x1, y0, front_top),
        (x1, y1, rear_top), (x0, y1, rear_top),
    ]
    faces = [
        (0, 3, 2, 1), (4, 5, 6, 7),
        (0, 1, 5, 4), (1, 2, 6, 5),
        (2, 3, 7, 6), (3, 0, 4, 7),
    ]
    mesh = bpy.data.meshes.new(name + " manufactured mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    keys = (materials,) if isinstance(materials, str) else materials
    f.assign_material(obj, _mat(*keys))
    if bevel:
        modifier = obj.modifiers.new("Manufactured edge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        modifier.limit_method = "ANGLE"
        modifier.harden_normals = True
    return f.parent_to_root(obj, category)


def _tube(
    name: str,
    points: Iterable[tuple[float, float, float]],
    radius: float,
    materials=("seal", "graphite"),
    *,
    category="cable",
) -> bpy.types.Object:
    coordinates = list(points)
    curve = bpy.data.curves.new(name + " path", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(coordinates) - 1)
    for point, coordinate in zip(spline.bezier_points, coordinates):
        point.co = Vector(coordinate)
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    keys = (materials,) if isinstance(materials, str) else materials
    f.assign_material(obj, _mat(*keys))
    f.parent_to_root(obj, category)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.name = name
    f.smooth(obj)
    return obj


SEGMENTS = {
    "0": "ab cdef".replace(" ", ""),
    "1": "bc",
    "2": "abdeg",
    "3": "abcdg",
    "4": "bcfg",
    "5": "acdfg",
    "6": "acdefg",
    "7": "abc",
    "8": "abcdefg",
    "9": "abcdfg",
}


def _seven_segment(
    prefix: str,
    value: str,
    *,
    center: tuple[float, float, float],
    digit_height: float,
    facing="front",
    materials=("display_red", "red"),
) -> None:
    """Model legible luminous digits as recessed screen geometry, not a decal."""
    x0, y0, z0 = center
    width = digit_height * .55
    stroke = digit_height * .095
    pitch = width * 1.22
    total = pitch * len(value)
    for index, character in enumerate(value):
        cx = x0 - total / 2 + pitch * (index + .5)
        if character == ".":
            _box(
                prefix + f" decimal {index + 1}",
                (cx, y0, z0 - digit_height * .36),
                (stroke, .0012, stroke),
                materials,
                bevel=stroke * .25,
                category="display graphics",
            )
            continue
        active = SEGMENTS.get(character, "")
        definitions = {
            "a": (cx, z0 + digit_height * .46, width, stroke),
            "b": (cx + width / 2, z0 + digit_height * .23, stroke, digit_height * .44),
            "c": (cx + width / 2, z0 - digit_height * .23, stroke, digit_height * .44),
            "d": (cx, z0 - digit_height * .46, width, stroke),
            "e": (cx - width / 2, z0 - digit_height * .23, stroke, digit_height * .44),
            "f": (cx - width / 2, z0 + digit_height * .23, stroke, digit_height * .44),
            "g": (cx, z0, width, stroke),
        }
        for segment in active:
            sx, sz, sw, sh = definitions[segment]
            _box(
                prefix + f" digit {index + 1} segment {segment}",
                (sx, y0, sz),
                (sw, .0012, sh),
                materials,
                bevel=min(stroke * .24, .0008),
                category="display graphics",
            )


def _foot(name: str, x: float, y: float, radius=.010, height=.010) -> None:
    _cyl(
        name,
        (x, y, height / 2),
        radius,
        height,
        ("seal", "rubber", "graphite"),
        vertices=28,
        bevel=.0015,
        category="isolation foot",
    )


def _knob(name: str, x: float, y: float, z: float) -> None:
    _cyl(
        name + " hub",
        (x, y, z),
        .023,
        .019,
        ("control_polymer", "graphite"),
        axis=(0, -1, 0),
        vertices=48,
        bevel=.0025,
        category="control knob",
    )
    _cyl(
        name + " silver index cap",
        (x, y - .0105, z),
        .018,
        .002,
        ("cool_grey", "aluminum"),
        axis=(0, -1, 0),
        vertices=48,
        bevel=.0006,
        category="control knob",
    )
    for index in range(16):
        angle = math.tau * index / 16
        _box(
            name + f" grip rib {index + 1:02}",
            (
                x + math.sin(angle) * .0215,
                y - .020,
                z + math.cos(angle) * .0215,
            ),
            (.0027, .003, .007),
            ("seal", "graphite"),
            bevel=.0007,
            category="control knob grip",
        ).rotation_euler[1] = angle


def build_hotplate(spec: f.AssetSpec) -> None:
    if abs(spec.width - .2) > .001 or abs(spec.depth - .26) > .001:
        raise ValueError("Hotplate reference body must be 200 x 260 mm")
    if abs(spec.height - .42) > .001:
        raise ValueError("Hotplate authored envelope includes the 420 mm support rod")
    assert f.ROOT is not None
    f.ROOT["asset_class"] = "magnetic stirrer hot plate"
    f.ROOT["reference_body_dimensions_mm"] = [200, 260, 120]
    f.ROOT["support_rod_is_accessory"] = True
    f.ROOT["product_revision"] = "final-reference-hotplate-r1"

    for x in (-.078, .078):
        for y in (-.104, .104):
            _foot(f"Hotplate isolation foot {x:+.3f} {y:+.3f}", x, y, .010, .012)
    _wedge(
        "Hotplate continuous navy formed enclosure",
        width=.2,
        depth=.235,
        bottom=.010,
        front_top=.082,
        rear_top=.104,
        y_center=.0125,
        materials=("hotplate_navy", "blue_accent"),
        bevel=.006,
        category="formed instrument enclosure",
    )
    _box(
        "Hotplate recessed front controller surround",
        (0, -.106, .055),
        (.174, .002, .060),
        ("hotplate_panel", "mid_grey"),
        bevel=.006,
        category="recessed controller",
    )
    _box(
        "Hotplate central display bezel",
        (0, -.108, .059),
        (.073, .0015, .027),
        ("screen", "graphite"),
        bevel=.003,
        category="recessed controller",
    )
    _seven_segment(
        "Temperature",
        "120",
        center=(-.017, -.1092, .060),
        digit_height=.016,
        materials=("display_red", "red"),
    )
    _seven_segment(
        "Speed",
        "1500",
        center=(.021, -.1092, .060),
        digit_height=.013,
        materials=("display_red", "red"),
    )
    _knob("Heat control", -.065, -.107, .049)
    _knob("Stir control", .065, -.107, .049)
    for name, x, color in (
        ("Heat status lamp", -.018, ("status_amber", "amber")),
        ("Stir status lamp", .018, ("status_green", "green")),
    ):
        _cyl(
            name,
            (x, -.1095, .033),
            .004,
            .0015,
            color,
            axis=(0, -1, 0),
            vertices=24,
            bevel=.0005,
            category="status indicator",
        )

    # Plate is supported on four ceramic spacers and a real stainless subframe.
    _box(
        "Hotplate stainless ceramic carrier",
        (0, -.006, .105),
        (.188, .188, .006),
        ("stainless_studio", "stainless"),
        bevel=.004,
        category="plate support",
    )
    for x in (-.072, .072):
        for y in (-.078, .066):
            _cyl(
                "Ceramic plate isolation bobbin",
                (x, y, .108),
                .008,
                .010,
                ("seal", "graphite"),
                vertices=24,
                bevel=.0015,
                category="plate support",
            )
    _box(
        "White ceramic coated heating plate",
        (0, -.006, .115),
        (.180, .180, .010),
        ("ceramic_white", "porcelain"),
        bevel=.008,
        category="ceramic heating surface",
    )

    # Reference-required rear support rod, bosshead and probe clamp.
    _box(
        "Support rod rear mounting block",
        (.078, .104, .072),
        (.038, .038, .070),
        ("hotplate_navy", "blue_accent"),
        bevel=.005,
        category="support rod mount",
    )
    _cyl(
        "Stainless support rod",
        (.078, .104, .255),
        .005,
        .330,
        ("stainless_studio", "stainless"),
        vertices=32,
        bevel=.0008,
        category="support rod",
    )
    _cyl(
        "Support rod bosshead collar",
        (.078, .104, .345),
        .011,
        .022,
        ("control_polymer", "graphite"),
        vertices=32,
        bevel=.002,
        category="support clamp",
    )
    _cyl(
        "Support clamp tightening grip knob",
        (.093, .104, .345),
        .008,
        .014,
        ("control_polymer", "graphite"),
        axis=(1, 0, 0),
        vertices=28,
        bevel=.0015,
        category="support clamp",
    )
    for index in range(10):
        angle = math.tau * index / 10
        _box(
            f"Clamp knob grip {index + 1:02}",
            (.099, .104 + math.sin(angle) * .007, .345 + math.cos(angle) * .007),
            (.002, .0025, .005),
            ("control_polymer", "graphite"),
            bevel=.0005,
            category="support clamp",
        ).rotation_euler[0] = angle

    # Rear service is functional and inset, not a decorative floating plaque.
    _box(
        "Rear IEC recessed well",
        (0, .129, .049),
        (.042, .002, .034),
        ("shadow", "graphite"),
        bevel=.004,
        category="rear service recess",
    )
    _box(
        "Rear IEC C14 inlet",
        (0, .1305, .049),
        (.028, .0015, .022),
        ("control_polymer", "graphite"),
        bevel=.002,
        category="power inlet",
    )
    for x in (-.006, .006):
        _box(
            "Rear IEC contact cavity",
            (x, .1315, .049),
            (.004, .001, .009),
            ("shadow", "seal"),
            bevel=.0005,
            category="power inlet",
        )
    _box(
        "Rear rating label recess",
        (-.052, .1310, .053),
        (.040, .001, .026),
        ("label", "cool_grey", "powder_light"),
        bevel=.001,
        category="equipment label",
    )
    for index, x in enumerate((-.073, -.063, -.053, -.043, -.033), start=1):
        _box(
            f"Rear rating label line {index}",
            (x, .1316, .053),
            (.0015, .0007, .016),
            ("shadow", "graphite"),
            bevel=.0002,
            category="equipment label",
        )


def _balance_key(name: str, x: float, y: float, z: float, *, blue=False) -> None:
    _cyl(
        name,
        (x, y, z),
        .010,
        .003,
        ("balance_tare", "blue_accent") if blue else ("control_polymer", "cool_grey"),
        axis=(0, -1, 0),
        vertices=32,
        bevel=.001,
        category="membrane control key",
    )


def build_balance(spec: f.AssetSpec) -> None:
    if any(abs(actual - expected) > .001 for actual, expected in zip(
        (spec.width, spec.depth, spec.height), (.210, .320, .310)
    )):
        raise ValueError("Analytical balance must match the 210 x 320 x 310 mm sheet")
    assert f.ROOT is not None
    f.ROOT["asset_class"] = "analytical laboratory balance"
    f.ROOT["product_revision"] = "final-reference-balance-r1"
    f.ROOT["weighing_pan_diameter_mm"] = 90
    f.ROOT["draft_shield_access"] = "three sliding glass doors"

    for x in (-.086, .086):
        for y in (-.132, .132):
            _foot(f"Balance adjustable foot {x:+.3f} {y:+.3f}", x, y, .010, .010)
            _cyl(
                "Balance foot knurled collar",
                (x, y, .014),
                .008,
                .010,
                ("control_polymer", "graphite"),
                vertices=24,
                bevel=.001,
                category="levelling foot",
            )
    _box(
        "Balance graphite structural plinth",
        (0, 0, .035),
        (.210, .316, .060),
        ("balance_graphite", "mid_grey"),
        bevel=.012,
        category="structural plinth",
    )
    _wedge(
        "Balance continuous porcelain upper base",
        width=.204,
        depth=.314,
        bottom=.042,
        front_top=.094,
        rear_top=.112,
        materials=("balance_white", "porcelain"),
        bevel=.010,
        category="formed balance enclosure",
    )
    _box(
        "Balance inset graphite fascia",
        (0, -.158, .071),
        (.176, .002, .050),
        ("hotplate_panel", "mid_grey"),
        bevel=.007,
        category="recessed controller",
    )
    _box(
        "Balance backlit LCD window",
        (.015, -.1578, .080),
        (.091, .0014, .025),
        ("screen", "graphite"),
        bevel=.003,
        category="display",
    )
    _seven_segment(
        "Balance mass",
        "0.0000",
        center=(.015, -.1594, .080),
        digit_height=.014,
        materials=("display_white", "porcelain"),
    )
    for index, (name, x, blue) in enumerate((
        ("Power key", -.069, False),
        ("Calibration key", -.043, False),
        ("Mode key", -.017, False),
        ("Print key", .043, False),
        ("Tare key", .071, True),
    ), start=1):
        _balance_key(name, x, -.1582, .055, blue=blue)

    _box(
        "Weighing chamber stainless floor",
        (0, .040, .101),
        (.188, .214, .012),
        ("stainless_studio", "stainless"),
        bevel=.005,
        category="weighing chamber floor",
    )
    _cyl(
        "Precision stainless weighing pan lower boss",
        (0, .015, .112),
        .037,
        .012,
        ("stainless", "aluminum"),
        vertices=64,
        bevel=.002,
        category="weighing pan",
    )
    _cyl(
        "Precision stainless ninety millimetre pan",
        (0, .015, .121),
        .045,
        .006,
        ("stainless_studio", "stainless"),
        vertices=72,
        bevel=.0015,
        category="weighing pan",
    )
    _cyl(
        "Pan concentric brushed inset",
        (0, .015, .1245),
        .037,
        .001,
        ("aluminum", "stainless"),
        vertices=72,
        bevel=.0004,
        category="weighing pan",
    )

    bottom, top = .105, .310
    front_y, rear_y = -.048, .145
    post_x = .094
    # Four structural corner posts and positive-bearing head rails close every
    # fixed joint while leaving the three door tracks physically readable.
    for x in (-post_x, post_x):
        for y in (front_y, rear_y):
            _box(
                f"Draft shield corner post {x:+.3f} {y:+.3f}",
                (x, y, (bottom + top) / 2),
                (.012, .012, top - bottom),
                ("aluminum", "stainless_studio"),
                bevel=.0025,
                category="draft shield frame",
            )
    for y, label in ((front_y, "front"), (rear_y, "rear")):
        _box(
            f"Draft shield {label} upper rail",
            (0, y, .302),
            (.176, .016, .016),
            ("aluminum", "stainless_studio"),
            bevel=.004,
            category="draft shield frame",
        )
        _box(
            f"Draft shield {label} lower track",
            (0, y, .111),
            (.176, .014, .012),
            ("aluminum", "stainless_studio"),
            bevel=.002,
            category="sliding door track",
        )
    for x, label in ((-post_x, "left"), (post_x, "right")):
        _box(
            f"Draft shield {label} upper return",
            (x, (front_y + rear_y) / 2, .302),
            (.016, rear_y - front_y, .016),
            ("aluminum", "stainless_studio"),
            bevel=.004,
            category="draft shield frame",
        )
    glass = ("balance_glass", "glass_clear")
    _box(
        "Draft shield captured clear glass roof",
        (0, (front_y + rear_y) / 2, .303),
        (.176, rear_y - front_y - .012, .006),
        glass,
        bevel=.0015,
        category="clear draft shield glass",
    )
    _box(
        "Draft shield roof sliding handle",
        (0, front_y + .035, .307),
        (.052, .018, .004),
        ("balance_white", "powder_light"),
        bevel=.003,
        category="draft shield handle",
    )

    # Rear fixed pane.
    _box(
        "Draft shield fixed rear glass",
        (0, rear_y - .007, .207),
        (.178, .004, .180),
        glass,
        bevel=.001,
        category="clear draft shield glass",
    )
    # Front sliding door, visibly split into two overlapping leaves.
    for side in (-1, 1):
        x = side * .043
        _box(
            "Front sliding glass door left" if side == -1 else "Front sliding glass door right",
            (x, front_y + (side + 1) * .002, .207),
            (.092, .004, .180),
            glass,
            bevel=.001,
            category="clear sliding draft shield door",
        )
        _box(
            "Front left glass pull" if side == -1 else "Front right glass pull",
            (x - side * .030, front_y - .005, .207),
            (.014, .010, .050),
            ("balance_white", "powder_light"),
            bevel=.003,
            category="draft shield handle",
        )
    # Two side sliding doors, each in a real upper/lower track.
    for side in (-1, 1):
        x = side * (post_x - .007)
        _box(
            "Left sliding glass door" if side == -1 else "Right sliding glass door",
            (x, .050, .207),
            (.004, .178, .180),
            glass,
            bevel=.001,
            category="clear sliding draft shield door",
        )
        _box(
            "Left side door pull" if side == -1 else "Right side door pull",
            (x - side * .005, -.005, .207),
            (.010, .014, .050),
            ("balance_white", "powder_light"),
            bevel=.003,
            category="draft shield handle",
        )

    # Bubble level and rear service anatomy are modelled as physical recesses.
    _cyl(
        "Balance spirit level bezel",
        (-.070, -.052, .116),
        .009,
        .004,
        ("graphite", "control_polymer"),
        vertices=32,
        category="levelling indicator",
    )
    _cyl(
        "Balance spirit level vial",
        (-.070, -.052, .1185),
        .006,
        .001,
        ("status_green", "green"),
        vertices=32,
        category="levelling indicator",
    )
    _box(
        "Balance rear service recess",
        (0, .159, .060),
        (.140, .002, .045),
        ("shadow", "graphite"),
        bevel=.005,
        category="rear service recess",
    )
    _box(
        "Balance rear IEC inlet",
        (-.038, .1588, .060),
        (.034, .0015, .026),
        ("control_polymer", "graphite"),
        bevel=.002,
        category="power inlet",
    )
    _box(
        "Balance rear RS232 connector",
        (.043, .1588, .060),
        (.035, .0015, .018),
        ("aluminum", "stainless"),
        bevel=.002,
        category="data connector",
    )
    for index, x in enumerate((.033, .038, .043, .048, .053), start=1):
        _cyl(
            f"RS232 pin {index}",
            (x, .1592, .060),
            .001,
            .001,
            ("graphite", "shadow"),
            axis=(0, 1, 0),
            vertices=12,
            bevel=0,
            category="data connector",
        )


BUILDERS = {
    HOTPLATE_ID: build_hotplate,
    BALANCE_ID: build_balance,
}
