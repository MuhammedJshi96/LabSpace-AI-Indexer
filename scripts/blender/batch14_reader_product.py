"""Coherent product-model authoring for the batch-14 microplate reader.

The caller owns scene reset, root creation, material registration, fitting,
source persistence, runtime batching, and export.  This module contributes only
original, logo-free manufacturing geometry.  Its reference-led priorities are:

* one closed molded wedge shell with a real boolean-cut sample pocket;
* a sealed recessed aperture liner and a carriage that emerges from the pocket;
* an integrated sloped control fascia rather than floating decorative plaques;
* restrained all-sided service construction; and
* opaque product plastics and assay inserts throughout.

Raw authored envelope: 520 x 500 x 330 mm (X, Y, Z).
"""
from __future__ import annotations

import math

import bmesh
import bpy
from mathutils import Vector

import lab_furniture as f


MODULE_REVISION = "batch14-reader-reference-product-r5"

# Pairs are named explicitly for the root generator's continuity integration.
# The parts touch or overlap in the raw product scene; functional carriage and
# aperture movement reveals remain deliberate.
CONTACT_PAIRS: tuple[tuple[str, str, str], ...] = (
    ("shell-to-aperture-liner", "Reader molded outer shell", "Reader aperture back liner"),
    ("carriage-to-aperture-floor", "Reader sample carriage", "Reader aperture floor liner"),
    ("fascia-to-shell", "Reader integrated fascia carrier", "Reader molded outer shell"),
    ("left-side-skin-to-shell", "Reader molded side insert -1", "Reader molded outer shell"),
    ("right-side-skin-to-shell", "Reader molded side insert +1", "Reader molded outer shell"),
    ("rear-service-to-shell", "Reader recessed rear service panel", "Reader molded outer shell"),
    ("tray-fascia-to-carriage", "Reader sample tray front fascia", "Reader sample carriage"),
    ("left-lower-band-to-side-skin", "Reader lower side chassis band -1", "Reader molded side insert -1"),
    ("right-lower-band-to-side-skin", "Reader lower side chassis band +1", "Reader molded side insert +1"),
)


def _material(key: str):
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
    rotation: tuple[float, float, float] | None = None,
):
    obj = f.add_box(
        name, xyz, size, _material(material), bevel=bevel, category=category,
    )
    if rotation is not None:
        obj.rotation_euler = rotation
    return obj


def _cylinder(
    name: str,
    xyz: tuple[float, float, float],
    radius: float,
    length: float,
    material: str,
    *,
    axis: tuple[float, float, float] = (0, 0, 1),
    vertices: int = 20,
    bevel: float = .0006,
    category: str,
):
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


def _extruded_side_profile(
    name: str,
    width: float,
    profile: tuple[tuple[float, float], ...],
    material: str,
    *,
    x: float = 0.0,
    bevel: float = .0,
    category: str,
):
    """Extrude a closed Y/Z product profile symmetrically along X."""
    half = width * .5
    vertices = [(-half + x, y, z) for y, z in profile]
    vertices.extend((half + x, y, z) for y, z in profile)
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
    f.assign_material(obj, _material(material))
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.02)
    bpy.ops.object.mode_set(mode="OBJECT")
    if bevel:
        modifier = obj.modifiers.new("Manufactured molded edge radii", "BEVEL")
        modifier.width = bevel
        modifier.segments = 4
        modifier.limit_method = "ANGLE"
        modifier.harden_normals = True
    f.smooth(obj)
    return f.parent_to_root(obj, category)


def _rounded_cutter(
    name: str,
    xyz: tuple[float, float, float],
    size: tuple[float, float, float],
    radius: float,
):
    bpy.ops.mesh.primitive_cube_add(location=xyz)
    cutter = bpy.context.object
    cutter.name = name
    cutter.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = cutter.modifiers.new("Pocket corner radii", "BEVEL")
    bevel.width = radius
    bevel.segments = 4
    bevel.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = cutter
    cutter.select_set(True)
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return cutter


def _cut_pocket(target, cutter) -> None:
    """Apply one deterministic exact boolean and discard the construction tool."""
    bpy.ops.object.select_all(action="DESELECT")
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    modifier = target.modifiers.new("Recessed sample aperture", "BOOLEAN")
    modifier.operation = "DIFFERENCE"
    modifier.solver = "EXACT"
    modifier.object = cutter
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def _smart_uv(obj) -> None:
    """Give the molded shell stable UVs for the caller's shared PBR maps."""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.02)
    bpy.ops.object.mode_set(mode="OBJECT")


def _build_closed_shell():
    profile = (
        (-.130, .018),
        (-.130, .142),
        (-.122, .188),
        (-.100, .244),
        (-.035, .323),
        (.178, .330),
        (.225, .292),
        (.240, .205),
        (.240, .040),
        (.220, .018),
    )
    shell = _extruded_side_profile(
        "Reader molded outer shell",
        .506,
        profile,
        "porcelain",
        bevel=0,
        category="molded enclosure",
    )
    # The cutter enters from outside the front face but stops inside the closed
    # solid, producing an actual pocket rather than a dark card laid on top.
    cutter = _rounded_cutter(
        "Reader aperture construction cutter",
        (0, -.137, .104),
        (.344, .112, .108),
        .012,
    )
    _cut_pocket(shell, cutter)
    _smart_uv(shell)
    edge = shell.modifiers.new("Molded enclosure edge radii", "BEVEL")
    edge.width = .007
    edge.segments = 4
    edge.limit_method = "ANGLE"
    edge.harden_normals = True
    return shell


def _build_aperture_and_carriage() -> None:
    # Every liner overlaps its neighbor and the boolean pocket; the cavity is
    # dark and fully sealed from front, side, top, and rear orbit angles.
    _box(
        "Reader aperture back liner", (0, -.083, .105), (.322, .012, .094),
        "graphite", bevel=.003, category="sample aperture liner",
    )
    _box(
        "Reader aperture floor liner", (0, -.130, .052), (.334, .112, .014),
        "graphite", bevel=.003, category="sample aperture liner",
    )
    _box(
        "Reader aperture ceiling liner", (0, -.130, .159), (.334, .112, .014),
        "graphite", bevel=.003, category="sample aperture liner",
    )
    for side in (-1, 1):
        _box(
            f"Reader aperture side liner {side:+d}",
            (side * .166, -.130, .105),
            (.014, .112, .104),
            "graphite",
            bevel=.003,
            category="sample aperture liner",
        )
        _box(
            f"Reader carriage rail {side:+d}",
            (side * .151, -.161, .063),
            (.014, .174, .014),
            "aluminum",
            bevel=.002,
            category="sample carriage",
        )
    # The body is deliberately rear-biased inside the 500 mm envelope.  The
    # carriage therefore projects 120 mm beyond the molded front, matching the
    # supplied product sheet instead of disappearing beneath the fascia.
    _box(
        "Reader sample carriage", (0, -.165, .058), (.348, .170, .022),
        "graphite", bevel=.004, category="sample carriage",
    )
    _box(
        "Reader carriage bed", (0, -.166, .071), (.316, .154, .010),
        "mid_grey", bevel=.002, category="sample carriage",
    )
    # The reference tray is operated by a substantial molded front fascia, not
    # by the thin edge of a graphite carriage.  It overlaps the carriage while
    # retaining the deliberate pocket/tray movement reveal behind it.
    _box(
        "Reader sample tray front fascia", (0, -.2435, .074),
        (.372, .011, .058), "warm_white", bevel=.008,
        category="sample tray fascia",
    )
    _box(
        "Reader tray fascia finger recess", (0, -.2495, .082),
        (.070, .001, .018), "graphite", bevel=.0002,
        category="sample tray recess",
    )
    _cylinder(
        "Reader carriage drive roller", (0, -.091, .061), .007, .280,
        "rubber", axis=(1, 0, 0), vertices=20, category="sample drive",
    )

    # Logo-free 8 x 12 presentation plate.  The supplied sheet shows an empty,
    # clear/white plate, so the performant runtime proxy uses restrained milky
    # polypropylene instead of bright assay colours that made the tray toy-like.
    _box(
        "Reader microplate body", (0, -.174, .081), (.230, .112, .010),
        "warm_white", bevel=.002, category="sample plate",
    )
    for row in range(8):
        for column in range(12):
            x = (column - 5.5) * .0164
            y = -.220 + row * .0131
            _cylinder(
                "Reader microplate well collar", (x, y, .089), .0046, .007,
                "warm_white", vertices=12, bevel=.00035,
                category="sample well",
            )
            if (row + column * 2) % 4 != 0:
                _cylinder(
                    "Reader milky well insert", (x, y, .093), .0035, .002,
                    "milky_polypropylene", vertices=12, bevel=.0002,
                    category="sample well insert",
                )


def _build_integrated_controls() -> None:
    rotation = (math.radians(12), 0, 0)
    # The carrier penetrates the sloped shell by 5 mm and has real side/underside
    # depth; it is an integrated fascia, not a floating front plaque.
    _box(
        "Reader integrated fascia carrier", (0, -.105, .236),
        (.374, .045, .132), "warm_white", bevel=.010,
        category="integrated control fascia", rotation=rotation,
    )
    _box(
        "Reader display bezel", (-.074, -.130, .252),
        (.202, .015, .074), "graphite", bevel=.005,
        category="display bezel", rotation=rotation,
    )
    _box(
        "Reader opaque display cover", (-.074, -.139, .253),
        (.174, .004, .054), "screen", bevel=.002,
        category="display", rotation=rotation,
    )
    # Restrained abstract UI: the reference has a dark menu screen with one
    # narrow blue selection row and four physical soft keys beneath it.
    _box(
        "Reader display assay field", (-.074, -.142, .261),
        (.136, .002, .010), "screen_active", bevel=.0008,
        category="display", rotation=rotation,
    )
    _box(
        "Reader display graph field", (-.074, -.142, .244),
        (.108, .002, .005), "label", bevel=.0006,
        category="display", rotation=rotation,
    )
    for index, x in enumerate((-.137, -.095, -.053, -.011), start=1):
        _box(
            f"Reader display soft key {index}", (x, -.142, .216),
            (.024, .006, .009), "control_polymer", bevel=.002,
            category="control", rotation=rotation,
        )
    for index, (x, z) in enumerate((
        (.070, .266), (.112, .266), (.154, .266),
        (.091, .230), (.133, .230), (.112, .197),
    ), start=1):
        _cylinder(
            f"Reader tactile key {index}", (x, -.142, z), .010, .006,
            "control_polymer" if index < 6 else "teal",
            axis=(0, 1, 0), vertices=20, bevel=.001,
            category="control",
        )


def _build_side_and_rear_construction() -> None:
    side_profile = (
        (-.126, .032),
        (-.126, .142),
        (-.116, .188),
        (-.094, .240),
        (-.030, .302),
        (.172, .305),
        (.219, .270),
        (.231, .196),
        (.231, .032),
    )
    for side in (-1, 1):
        _extruded_side_profile(
            f"Reader molded side insert {side:+d}",
            .006,
            side_profile,
            "blue_accent",
            x=side * .2555,
            bevel=.0018,
            category="molded side skin",
        )
        _box(
            f"Reader side shell seam {side:+d}",
            (side * .255, .015, .073),
            (.006, .330, .005),
            "cool_grey",
            bevel=.001,
            category="manufactured seam",
        )
        _box(
            f"Reader lower side chassis band {side:+d}",
            (side * .2595, .020, .052),
            (.001, .360, .060),
            "cool_grey",
            bevel=.0002,
            category="structural chassis band",
        )

    # Recessed rear service tray penetrates the shell and seals the back orbit.
    _box(
        "Reader recessed rear service panel", (0, .240, .116),
        (.340, .016, .166), "mid_grey", bevel=.004,
        category="rear service",
    )
    # A gasket is a perimeter seal, not a black card covering the service
    # panel. Four narrow returns retain the grey rear panel and keep its vents
    # and connectors readable from the rear orbit.
    gasket_width, gasket_height, gasket_thickness = .306, .136, .007
    for x in (-gasket_width * .5 + gasket_thickness * .5,
              gasket_width * .5 - gasket_thickness * .5):
        _box(
            "Reader rear service gasket vertical", (x, .2485, .116),
            (gasket_thickness, .001, gasket_height), "seal", bevel=.0002,
            category="rear service seal",
        )
    for z in (.116 - gasket_height * .5 + gasket_thickness * .5,
              .116 + gasket_height * .5 - gasket_thickness * .5):
        _box(
            "Reader rear service gasket horizontal", (0, .2485, z),
            (gasket_width, .001, gasket_thickness), "seal", bevel=.0002,
            category="rear service seal",
        )
    for row in range(4):
        for column in range(10):
            _box(
                "Reader rear exhaust slot",
                ((column - 4.5) * .024, .2495, .139 + row * .014),
                (.017, .001, .006), "graphite", bevel=0,
                category="ventilation",
            )
    _box(
        "Reader rear mains inlet", (.110, .2495, .078),
        (.044, .001, .032), "graphite", bevel=.0004,
        category="rear service",
    )
    for index, x in enumerate((-.085, -.045), start=1):
        _box(
            f"Reader rear data port {index}", (x, .2495, .078),
            (.028, .001, .018), "graphite", bevel=.0004,
            category="rear service",
        )
    for x in (-.145, .145):
        _cylinder(
            "Reader rear service fastener", (x, .2495, .180), .004, .001,
            "zinc", axis=(0, 1, 0), vertices=16, bevel=.0003,
            category="fastener",
        )

    # Reference-defined right-side ventilation grille.
    for row in range(5):
        for column in range(5):
            _box(
                "Reader right-side ventilation slot",
                (.259, .055 + column * .018, .120 + row * .013),
                (.002, .012, .006), "graphite", bevel=0,
                category="ventilation",
            )


def _build_base_and_feet() -> None:
    # A single recessed chassis band supports the molded shell; it is mostly
    # concealed but remains readable at the lower side/rear edges.
    _box(
        "Reader lower structural pan", (0, .012, .030),
        (.486, .425, .030), "cool_grey", bevel=.005,
        category="structural chassis",
    )
    for x in (-.218, .218):
        for y in (-.172, .190):
            _cylinder(
                "Reader isolation foot", (x, y, .006), .012, .012,
                "rubber", vertices=20, bevel=.0005, category="foot",
            )
            _cylinder(
                "Reader foot fixing washer", (x, y, .013), .007, .003,
                "zinc", vertices=18, bevel=.0003, category="fastener",
            )


def build(spec: f.AssetSpec):
    """Build one raw 520 x 500 x 330 mm closed reader product scene."""
    if any(abs(actual - expected) > 1e-6 for actual, expected in zip(
        (spec.width, spec.depth, spec.height), (.52, .50, .33),
    )):
        raise ValueError(
            f"{MODULE_REVISION} requires a .52 x .50 x .33 m AssetSpec; "
            f"received {(spec.width, spec.depth, spec.height)}"
        )
    _build_base_and_feet()
    shell = _build_closed_shell()
    _build_aperture_and_carriage()
    # Register the unrotated blue side skins before the sloped fascia.  The
    # runtime material batcher keeps the first object as its transform basis;
    # this order preserves exact bounds when the blue parts are consolidated.
    _build_side_and_rear_construction()
    _build_integrated_controls()
    if f.ROOT is not None:
        f.ROOT["product_module_revision"] = MODULE_REVISION
        f.ROOT["all_product_materials_opaque"] = True
        f.ROOT["raw_authored_dimensions_m"] = [.52, .50, .33]
        f.ROOT["reference_side_cheeks"] = "restrained molded blue polymer"
        f.ROOT["contact_pairs"] = [list(pair) for pair in CONTACT_PAIRS]
        f.ROOT["sample_aperture"] = "boolean-cut sealed pocket"
    bpy.context.view_layer.update()
    return shell
