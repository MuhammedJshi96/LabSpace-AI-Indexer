"""Compact A-frame passive pipette-holder product model.

This module follows the September 2 five-pipette reference sheet.  The caller
owns scene reset, root creation, material registration, dimensional fitting,
source persistence, batching, and export.  This file contributes only original,
logo-free, opaque geometry.

Construction priorities:

* a rigid perimeter base joining two closed triangular end frames;
* a horizontal hanger beam keyed into both end frames plus a rear stabilizer;
* five true fork saddles with physical shoulder-bearing contact;
* distinct micro, standard, electronic, repeater, and 8-channel tools; and
* continuous body/neck/control and body/barrel/tip load paths.

Raw authored envelope: 345 x 150 x 260 mm (X, Y, Z).
"""
from __future__ import annotations

import math

import bmesh
import bpy

import lab_furniture as f


MODULE_REVISION = "batch14-pipette-aframe-product-r4"

PIPETTE_LAYOUT: tuple[tuple[str, str, float, str], ...] = (
    ("manual-micro-2-20", "manual", -.100, "control_polymer"),
    ("manual-standard-20-200", "manual", -.050, "amber"),
    ("repeater-positive-displacement", "repeater", .000, "blue_accent"),
    ("electronic-single", "electronic", .050, "mid_grey"),
    ("multichannel-8", "multichannel", .100, "blue_accent"),
)


def _prefix(index: int, subtype: str) -> str:
    return f"Pipette {index:02d} {subtype}"


def _body_name(prefix: str, family: str) -> str:
    return {
        "manual": prefix + " contoured white body",
        "repeater": prefix + " repeater formed body",
        "electronic": prefix + " electronic white body",
        "multichannel": prefix + " multichannel formed body",
    }[family]


def _continuity_contracts() -> tuple[tuple[str, str, str], ...]:
    pairs: list[tuple[str, str, str]] = [
        (
            "left-end-frame-to-base",
            "Pipette holder left triangular end frame",
            "Pipette holder left base end bridge",
        ),
        (
            "right-end-frame-to-base",
            "Pipette holder right triangular end frame",
            "Pipette holder right base end bridge",
        ),
        (
            "front-rail-to-left-base",
            "Pipette holder front base rail",
            "Pipette holder left base end bridge",
        ),
        (
            "front-rail-to-right-base",
            "Pipette holder front base rail",
            "Pipette holder right base end bridge",
        ),
        (
            "rear-rail-to-left-base",
            "Pipette holder rear base rail",
            "Pipette holder left base end bridge",
        ),
        (
            "rear-rail-to-right-base",
            "Pipette holder rear base rail",
            "Pipette holder right base end bridge",
        ),
        (
            "hanger-beam-to-left-frame",
            "Pipette holder horizontal hanger beam",
            "Pipette holder left triangular end frame",
        ),
        (
            "hanger-beam-to-right-frame",
            "Pipette holder horizontal hanger beam",
            "Pipette holder right triangular end frame",
        ),
        (
            "rear-support-to-left-frame",
            "Pipette holder rear stabilizer beam",
            "Pipette holder left triangular end frame",
        ),
        (
            "rear-support-to-right-frame",
            "Pipette holder rear stabilizer beam",
            "Pipette holder right triangular end frame",
        ),
    ]
    for index, (subtype, family, _x, _accent) in enumerate(PIPETTE_LAYOUT, start=1):
        prefix = _prefix(index, subtype)
        body = _body_name(prefix, family)
        bridge = prefix + " hanger bridge"
        left = prefix + " hanger left finger"
        right = prefix + " hanger right finger"
        pairs.extend(
            (
                (f"{prefix}-bridge-to-beam", bridge, "Pipette holder horizontal hanger beam"),
                (f"{prefix}-left-finger-to-bridge", left, bridge),
                (f"{prefix}-right-finger-to-bridge", right, bridge),
                (f"{prefix}-body-to-left-hanger", body, left),
                (f"{prefix}-body-to-right-hanger", body, right),
            )
        )
        if family in {"manual", "multichannel"}:
            pairs.extend(
                (
                    (f"{prefix}-body-to-plunger-stem", body, prefix + " plunger stem"),
                    (
                        f"{prefix}-plunger-stem-to-cap",
                        prefix + " plunger stem",
                        prefix + " plunger cap",
                    ),
                )
            )
        else:
            pairs.append(
                (f"{prefix}-body-to-top-control", body, prefix + " top control")
            )
        pairs.append((f"{prefix}-body-to-barrel", body, prefix + " lower barrel"))
        if family == "multichannel":
            pairs.append(
                (
                    f"{prefix}-barrel-to-manifold",
                    prefix + " lower barrel",
                    prefix + " multichannel manifold",
                )
            )
            for channel in range(1, 9):
                pairs.append(
                    (
                        f"{prefix}-manifold-to-tip-{channel:02d}",
                        prefix + " multichannel manifold",
                        prefix + f" channel tip {channel:02d}",
                    )
                )
        else:
            pairs.extend(
                (
                    (
                        f"{prefix}-barrel-to-nose",
                        prefix + " lower barrel",
                        prefix + " nose cone",
                    ),
                    (
                        f"{prefix}-nose-to-tip",
                        prefix + " nose cone",
                        prefix + " disposable tip",
                    ),
                )
            )
    return tuple(pairs)


# Exact authored names make these contracts directly usable by an evaluated
# BVH surface-distance/intersection gate instead of a bounds-only check.
CONTACT_PAIRS: tuple[tuple[str, str, str], ...] = _continuity_contracts()


def _material(key: str) -> bpy.types.Material:
    try:
        return f.MATERIALS[key]
    except KeyError as error:
        raise RuntimeError(
            f"{MODULE_REVISION}: caller did not register required material {key!r}"
        ) from error


def _box(
    name: str,
    xyz: tuple[float, float, float],
    size: tuple[float, float, float],
    material: str,
    *,
    bevel: float = .002,
    category: str,
) -> bpy.types.Object:
    return f.add_box(
        name, xyz, size, _material(material), bevel=bevel, category=category,
    )


def _cylinder(
    name: str,
    xyz: tuple[float, float, float],
    radius: float,
    length: float,
    material: str,
    *,
    axis: tuple[float, float, float] = (0, 0, 1),
    vertices: int = 18,
    bevel: float = .00045,
    category: str,
) -> bpy.types.Object:
    return f.add_cylinder(
        name,
        xyz,
        radius,
        length,
        _material(material),
        axis=axis,
        vertices=vertices,
        bevel=bevel,
        category=category,
    )


def _ellipsoid(
    name: str,
    xyz: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: str,
    *,
    category: str,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=18, ring_count=9, location=xyz,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    f.assign_material(obj, _material(material))
    f.smooth(obj)
    return f.parent_to_root(obj, category)


def _recalculate_normals(mesh: bpy.types.Mesh) -> None:
    normal_mesh = bmesh.new()
    normal_mesh.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(normal_mesh, faces=list(normal_mesh.faces))
    normal_mesh.to_mesh(mesh)
    normal_mesh.free()
    mesh.update()


def _smart_uv(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.02)
    bpy.ops.object.mode_set(mode="OBJECT")


def _extruded_yz_profile(
    name: str,
    x: float,
    width: float,
    profile: tuple[tuple[float, float], ...],
    material: str,
    *,
    bevel: float,
    category: str,
) -> bpy.types.Object:
    half = width * .5
    vertices = [(x - half, y, z) for y, z in profile]
    vertices.extend((x + half, y, z) for y, z in profile)
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
    _recalculate_normals(mesh)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    f.assign_material(obj, _material(material))
    _smart_uv(obj)
    modifier = obj.modifiers.new("Formed A-frame edge radii", "BEVEL")
    modifier.width = bevel
    modifier.segments = 4
    modifier.limit_method = "ANGLE"
    modifier.harden_normals = True
    f.smooth(obj)
    return f.parent_to_root(obj, category)


def _lathe(
    name: str,
    x: float,
    y: float,
    profile: tuple[tuple[float, float], ...],
    material: str,
    *,
    segments: int = 20,
    category: str,
) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    for radius, z in profile:
        for step in range(segments):
            angle = math.tau * step / segments
            vertices.append((
                x + radius * math.cos(angle),
                y + radius * math.sin(angle),
                z,
            ))
    rings = len(profile)
    faces: list[tuple[int, ...]] = []
    for ring in range(rings - 1):
        for step in range(segments):
            nxt = (step + 1) % segments
            a = ring * segments + step
            b = ring * segments + nxt
            c = (ring + 1) * segments + nxt
            d = (ring + 1) * segments + step
            faces.append((a, b, c, d))
    faces.append(tuple(range(segments - 1, -1, -1)))
    top = (rings - 1) * segments
    faces.append(tuple(top + step for step in range(segments)))
    mesh = bpy.data.meshes.new(name + " mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=False)
    _recalculate_normals(mesh)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    f.assign_material(obj, _material(material))
    _smart_uv(obj)
    f.smooth(obj)
    return f.parent_to_root(obj, category)


def _build_frame() -> bpy.types.Object:
    # The two end bridges establish the exact 345 x 150 mm grounded envelope
    # and close the front/rear rails into one rigid perimeter base.
    for side, label in ((-1, "left"), (1, "right")):
        _box(
            f"Pipette holder {label} base end bridge",
            (side * .164, 0, .017),
            (.017, .150, .030),
            "cool_grey",
            bevel=.004,
            category="A-frame perimeter base",
        )
    _box(
        "Pipette holder front base rail",
        (0, -.062, .017),
        (.320, .024, .026),
        "cool_grey",
        bevel=.004,
        category="A-frame perimeter base",
    )
    _box(
        "Pipette holder rear base rail",
        (0, .062, .017),
        (.320, .024, .026),
        "cool_grey",
        bevel=.004,
        category="A-frame perimeter base",
    )
    side_profile = (
        (-.067, .020),
        (-.054, .030),
        (-.020, .214),
        (-.012, .239),
        (-.006, .245),
        (.006, .245),
        (.012, .239),
        (.020, .214),
        (.054, .030),
        (.067, .020),
    )
    for side, label in ((-1, "left"), (1, "right")):
        _extruded_yz_profile(
            f"Pipette holder {label} triangular end frame",
            side * .159,
            .018,
            side_profile,
            "porcelain",
            bevel=.004,
            category="closed triangular A-frame end",
        )
        _box(
            f"Pipette holder {label} rear foot pad",
            (side * .159, .058, .003),
            (.020, .026, .006),
            "rubber",
            bevel=.002,
            category="non-slip foot",
        )
        _box(
            f"Pipette holder {label} front foot pad",
            (side * .159, -.058, .003),
            (.020, .026, .006),
            "rubber",
            bevel=.002,
            category="non-slip foot",
        )
    hanger = _box(
        "Pipette holder horizontal hanger beam",
        (0, -.018, .217),
        (.310, .034, .030),
        "porcelain",
        bevel=.005,
        category="keyed hanger beam",
    )
    _box(
        "Pipette holder rear stabilizer beam",
        (0, .023, .190),
        (.310, .020, .024),
        "cool_grey",
        bevel=.004,
        category="rear A-frame support",
    )
    return hanger


def _build_hanger(prefix: str, x: float) -> None:
    # Each U-shaped saddle keys into the front of the main beam.  Both fork
    # fingers bear against the underside of the pipette's integral collar.
    _box(
        prefix + " hanger bridge",
        (x, -.041, .209),
        (.036, .020, .018),
        "rubber",
        bevel=.003,
        category="physical hanger saddle",
    )
    for side, label in ((-1, "left"), (1, "right")):
        _box(
            prefix + f" hanger {label} finger",
            (x + side * .0105, -.057, .197),
            (.006, .034, .012),
            "rubber",
            bevel=.002,
            category="physical hanger saddle",
        )


def _build_manual(
    prefix: str,
    x: float,
    accent: str,
    variant: int,
) -> None:
    y = -.050
    radii = (.0145, .0165, .0180)
    radius = radii[variant]
    body = _lathe(
        prefix + " contoured white body",
        x,
        y,
        (
            (.0055 + variant * .0007, .103),
            (.0080 + variant * .0008, .123),
            (.0115 + variant * .0010, .150),
            (radius, .172),
            (radius, .192),
            (radius * .82, .200),
            (.014, .202),
            (.014, .216),
            (.008, .222),
            (.006, .235),
        ),
        "warm_white",
        category="continuous manual pipette body",
    )
    _ellipsoid(
        prefix + " shaped palm overmold",
        (x, y - radius * .66, .183),
        (radius * .60, .0065, .021 + variant * .002),
        "graphite",
        category="integral pipette grip",
    )
    _box(
        prefix + " thumb trigger",
        (x, y - radius * .72, .209),
        (.012, .010, .008),
        accent,
        bevel=.002,
        category="integral volume control",
    )
    _cylinder(
        prefix + " plunger stem",
        (x, y, .241),
        .006,
        .018,
        "control_polymer",
        vertices=18,
        category="continuous top control",
    )
    _cylinder(
        prefix + " plunger cap",
        (x, y, .254),
        .010 + variant * .001,
        .012,
        accent,
        vertices=22,
        category="continuous top control",
    )
    _box(
        prefix + " volume display bezel",
        (x, y - radius + .0008, .162),
        (.010, .003, .026),
        "graphite",
        bevel=.0015,
        category="integrated volume display",
    )
    _box(
        prefix + " volume index",
        (x, y - radius - .001, .162),
        (.005, .001, .015),
        "screen",
        bevel=.0004,
        category="integrated volume display",
    )
    barrel_bottom = (.066, .071, .076)[variant]
    _cylinder(
        prefix + " lower barrel",
        (x, y, (.106 + barrel_bottom) * .5),
        .0055 + variant * .0008,
        .106 - barrel_bottom + .008,
        "warm_white",
        vertices=18,
        category="continuous pipette barrel",
    )
    nose_bottom = barrel_bottom - (.024, .021, .019)[variant]
    _cylinder(
        prefix + " nose cone",
        (x, y, (barrel_bottom + .004 + nose_bottom) * .5),
        .0032 + variant * .0005,
        barrel_bottom + .008 - nose_bottom,
        "warm_white",
        vertices=16,
        category="continuous pipette nose",
    )
    tip_bottom = (.018, .026, .034)[variant]
    _cylinder(
        prefix + " disposable tip",
        (x, y, (nose_bottom + .004 + tip_bottom) * .5),
        .0016 + variant * .00035,
        nose_bottom + .008 - tip_bottom,
        "milky_polypropylene",
        vertices=12,
        category="disposable pipette tip",
    )
    body["pipette_family"] = ("micro", "standard", "large-volume")[variant]


def _build_electronic(prefix: str, x: float, accent: str) -> None:
    y = -.050
    radius = .019
    body = _lathe(
        prefix + " electronic white body",
        x,
        y,
        (
            (.007, .105),
            (.010, .128),
            (.015, .154),
            (radius, .174),
            (radius, .193),
            (.015, .201),
            (.014, .202),
            (.014, .216),
            (.009, .222),
            (.007, .235),
        ),
        "porcelain",
        category="continuous electronic pipette body",
    )
    _ellipsoid(
        prefix + " shaped electronic palm overmold",
        (x, y - radius * .66, .184),
        (radius * .60, .007, .024),
        "graphite",
        category="integral pipette grip",
    )
    _cylinder(
        prefix + " top control",
        (x, y, .247),
        .010,
        .026,
        "mid_grey",
        vertices=22,
        category="continuous top control",
    )
    _box(
        prefix + " display bezel",
        (x, y - radius + .0008, .166),
        (.012, .003, .030),
        "graphite",
        bevel=.0015,
        category="integrated display",
    )
    _box(
        prefix + " opaque display",
        (x, y - radius - .001, .169),
        (.007, .001, .019),
        "screen",
        bevel=.0005,
        category="integrated display",
    )
    _box(
        prefix + " front trigger",
        (x, y - radius * .72, .208),
        (.013, .010, .009),
        accent,
        bevel=.002,
        category="integrated control",
    )
    _cylinder(
        prefix + " lower barrel",
        (x, y, .086),
        .0065,
        .046,
        "warm_white",
        vertices=18,
        category="continuous pipette barrel",
    )
    _cylinder(
        prefix + " nose cone",
        (x, y, .057),
        .0040,
        .024,
        "warm_white",
        vertices=16,
        category="continuous pipette nose",
    )
    _cylinder(
        prefix + " disposable tip",
        (x, y, .037),
        .0020,
        .024,
        "milky_polypropylene",
        vertices=12,
        category="disposable pipette tip",
    )
    body["pipette_family"] = "electronic"


def _build_repeater(prefix: str, x: float, accent: str) -> None:
    """Build a positive-displacement repeater with a physical dosing mechanism."""
    y = -.050
    radius = .019
    body = _lathe(
        prefix + " repeater formed body",
        x,
        y,
        (
            (.008, .105),
            (.012, .126),
            (.017, .151),
            (radius, .176),
            (radius, .196),
            (.016, .204),
            (.013, .216),
            (.008, .227),
            (.006, .236),
        ),
        "porcelain",
        category="continuous positive-displacement repeater body",
    )
    _ellipsoid(
        prefix + " shaped repeater palm overmold",
        (x, y - radius * .66, .184),
        (radius * .60, .007, .024),
        "graphite",
        category="integral repeater grip",
    )
    _cylinder(
        prefix + " top control",
        (x, y, .247),
        .010,
        .026,
        "control_polymer",
        vertices=22,
        category="continuous dose selector",
    )
    _box(
        prefix + " indexed dose scale bezel",
        (x, y - radius + .0008, .170),
        (.012, .003, .034),
        "graphite",
        bevel=.0015,
        category="integrated dose scale",
    )
    for mark in range(5):
        _box(
            prefix + f" dose scale tick {mark + 1:02d}",
            (x, y - radius - .001, .158 + mark * .006),
            (.006 + (mark % 2) * .002, .001, .0012),
            accent,
            bevel=.0003,
            category="integrated dose scale marking",
        )
    _box(
        prefix + " side dosing lever",
        (x + radius * .74, y - .001, .190),
        (.011, .022, .050),
        "graphite",
        bevel=.003,
        category="functional repeater dosing lever",
    )
    _cylinder(
        prefix + " dosing lever pivot",
        (x + radius * .78, y - .014, .209),
        .0045,
        .006,
        "mid_grey",
        axis=(0, 1, 0),
        vertices=18,
        category="functional repeater lever pivot",
    )
    _cylinder(
        prefix + " lower barrel",
        (x, y, .096),
        .010,
        .036,
        "milky_polypropylene",
        vertices=20,
        category="positive-displacement cartridge barrel",
    )
    for mark in range(3):
        _cylinder(
            prefix + f" cartridge graduation {mark + 1:02d}",
            (x, y, .087 + mark * .009),
            .01025,
            .0012,
            "mid_grey",
            vertices=20,
            category="cartridge graduation ring",
        )
    _cylinder(
        prefix + " nose cone",
        (x, y, .068),
        .0055,
        .024,
        "warm_white",
        vertices=18,
        category="continuous positive-displacement nose",
    )
    _cylinder(
        prefix + " disposable tip",
        (x, y, .042),
        .0022,
        .036,
        "milky_polypropylene",
        vertices=14,
        category="positive-displacement dispenser tip",
    )
    body["pipette_family"] = "repeater"


def _build_multichannel(prefix: str, x: float, accent: str) -> None:
    y = -.050
    radius = .020
    body = _lathe(
        prefix + " multichannel formed body",
        x,
        y,
        (
            (.010, .128),
            (.014, .145),
            (.019, .168),
            (radius, .193),
            (.016, .201),
            (.014, .202),
            (.014, .216),
            (.009, .222),
            (.006, .235),
        ),
        "porcelain",
        category="continuous multichannel pipette body",
    )
    _ellipsoid(
        prefix + " shaped multichannel palm overmold",
        (x, y - radius * .66, .184),
        (radius * .60, .007, .024),
        "graphite",
        category="integral pipette grip",
    )
    _cylinder(
        prefix + " plunger stem",
        (x, y, .241),
        .0065,
        .018,
        "control_polymer",
        vertices=18,
        category="continuous top control",
    )
    _cylinder(
        prefix + " plunger cap",
        (x, y, .254),
        .012,
        .012,
        accent,
        vertices=22,
        category="continuous top control",
    )
    _box(
        prefix + " channel trigger",
        (x, y - radius * .72, .208),
        (.014, .010, .009),
        accent,
        bevel=.002,
        category="integrated channel control",
    )
    _cylinder(
        prefix + " lower barrel",
        (x, y, .126),
        .008,
        .024,
        "warm_white",
        vertices=18,
        category="continuous pipette barrel",
    )
    _box(
        prefix + " multichannel manifold",
        (x, y, .095),
        (.060, .040, .058),
        "warm_white",
        bevel=.007,
        category="formed 8-channel manifold",
    )
    _box(
        prefix + " manifold lower seal",
        (x, y, .064),
        (.054, .035, .008),
        "cool_grey",
        bevel=.002,
        category="multichannel manifold seal",
    )
    spacing = .052 / 7
    for channel in range(8):
        tip_x = x + (channel - 3.5) * spacing
        _cylinder(
            prefix + f" channel tip {channel + 1:02d}",
            (tip_x, y, .041),
            .00145,
            .050,
            "milky_polypropylene",
            vertices=12,
            category="multichannel disposable tip",
        )
    body["pipette_family"] = "multichannel-8"


def build(spec: f.AssetSpec) -> bpy.types.Object:
    """Build one raw 345 x 150 x 260 mm passive A-frame holder."""
    if any(
        abs(actual - expected) > 1e-6
        for actual, expected in zip(
            (spec.width, spec.depth, spec.height), (.345, .150, .260),
        )
    ):
        raise ValueError(
            f"{MODULE_REVISION} requires a .345 x .150 x .260 m AssetSpec; "
            f"received {(spec.width, spec.depth, spec.height)}"
        )
    product_root = _build_frame()
    for index, (subtype, family, x, accent) in enumerate(PIPETTE_LAYOUT, start=1):
        prefix = _prefix(index, subtype)
        _build_hanger(prefix, x)
        if family == "manual":
            _build_manual(prefix, x, accent, index - 1)
        elif family == "repeater":
            _build_repeater(prefix, x, accent)
        elif family == "electronic":
            _build_electronic(prefix, x, accent)
        else:
            _build_multichannel(prefix, x, accent)
    if f.ROOT is not None:
        f.ROOT["product_module_revision"] = MODULE_REVISION
        f.ROOT["all_product_materials_opaque"] = True
        f.ROOT["passive_nonpowered_holder"] = True
        f.ROOT["pipette_count"] = 5
        f.ROOT["pipette_families"] = [entry[0] for entry in PIPETTE_LAYOUT]
        f.ROOT["slot_spacing_m"] = .050
        f.ROOT["raw_authored_dimensions_m"] = [.345, .150, .260]
        f.ROOT["contact_pairs"] = [list(pair) for pair in CONTACT_PAIRS]
    bpy.context.view_layer.update()
    return product_root
