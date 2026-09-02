"""Reference-specific manufactured-detail pass for batch-14 product sources.

This module is deliberately not a generic detail scatterer.  Each function maps
to the September 2 reference packet and adds only construction that explains the
asset: bearing plates, formed trim, nested controls, sealed service panels,
mechanical fasteners, and readable moving-part anatomy.  It runs in Blender
before the editable source is saved and before runtime batching.

The approved ultrasonic cleaner is intentionally excluded.
"""
from __future__ import annotations

import math

import bpy

import lab_furniture as f


REVISION = "batch14-reference-rework-r1"
LOCKED_ASSET = "ultrasonic-cleaner"


def _material(*keys: str) -> bpy.types.Material:
    for key in keys:
        material = f.MATERIALS.get(key)
        if material is not None:
            return material
    raise RuntimeError(f"{REVISION}: missing material candidates {keys}")


def _box(
    name: str,
    xyz: tuple[float, float, float],
    size: tuple[float, float, float],
    materials: tuple[str, ...] | str,
    *,
    bevel: float = .0015,
    category: str,
) -> bpy.types.Object:
    keys = (materials,) if isinstance(materials, str) else materials
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
    length: float,
    materials: tuple[str, ...] | str,
    *,
    axis: tuple[float, float, float] = (0, 0, 1),
    vertices: int = 20,
    bevel: float = .0005,
    category: str,
) -> bpy.types.Object:
    keys = (materials,) if isinstance(materials, str) else materials
    return f.add_cylinder(
        name,
        xyz,
        radius,
        length,
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
    materials: tuple[str, ...] | str,
    *,
    rotation: tuple[float, float, float] = (0, 0, 0),
    category: str,
) -> bpy.types.Object:
    keys = (materials,) if isinstance(materials, str) else materials
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=28,
        minor_segments=8,
        location=xyz,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    f.assign_material(obj, _material(*keys))
    f.smooth(obj)
    return f.parent_to_root(obj, category)


def _pipette_holder() -> None:
    # The real rack has a shallow continuous spill/parking tray rather than an
    # empty rectangle between four oversized rails.
    _box(
        "Pipette holder continuous lower tray",
        (0, 0, .009),
        (.310, .104, .010),
        ("cool_grey", "powder_light"),
        bevel=.003,
        category="formed parking tray",
    )
    _box(
        "Pipette holder tray rear upstand",
        (0, .045, .027),
        (.304, .010, .030),
        ("cool_grey", "powder_light"),
        bevel=.002,
        category="formed parking tray",
    )
    for x in (-.120, -.060, 0, .060, .120):
        # Separate anti-rotation collars make the hanger/pipette contact read
        # mechanically instead of as bodies floating against the rail.
        _cylinder(
            "Pipette holder anti-rotation collar",
            (x, -.050, .201),
            .016,
            .006,
            ("rubber", "seal", "graphite"),
            axis=(0, 1, 0),
            vertices=24,
            category="physical hanger saddle",
        )
        for tick, z in enumerate((.145, .152, .159), start=1):
            _box(
                f"Pipette calibrated volume tick {tick}",
                (x, -.0685, z),
                (.006 + tick * .0015, .001, .0012),
                ("mid_grey", "graphite"),
                bevel=.0002,
                category="pipette scale marking",
            )
    for x in (-.145, .145):
        _cylinder(
            "Pipette holder beam fixing",
            (x, -.036, .217),
            .0035,
            .002,
            ("zinc", "stainless"),
            axis=(0, 1, 0),
            vertices=16,
            category="frame fastener",
        )


def _microplate_reader() -> None:
    # A gasketed top service hatch is present in the supplied multi-view sheet.
    # It is a three-level assembly (seal, cover, fixing) rather than a coplanar
    # graphic rectangle.
    _box(
        "Reader top service hatch seal",
        (0, .070, .3185),
        (.310, .220, .004),
        ("seal", "graphite"),
        bevel=.006,
        category="top service hatch",
    )
    _box(
        "Reader top service hatch cover",
        (0, .070, .324),
        (.298, .208, .008),
        ("warm_white", "porcelain"),
        bevel=.006,
        category="top service hatch",
    )
    for x in (-.135, .135):
        for y in (-.015, .150):
            _cylinder(
                "Reader top hatch captive fastener",
                (x, y, .3285),
                .003,
                .001,
                ("zinc", "stainless"),
                vertices=16,
                category="fastener",
            )
    for side in (-1, 1):
        _box(
            f"Reader carriage stop block {side:+d}",
            (side * .157, -.224, .072),
            (.014, .022, .020),
            ("control_polymer", "graphite"),
            bevel=.003,
            category="sample carriage detent",
        )
        _cylinder(
            f"Reader carriage detent pin {side:+d}",
            (side * .157, -.235, .078),
            .003,
            .010,
            ("stainless", "zinc"),
            axis=(0, 1, 0),
            vertices=16,
            category="sample carriage detent",
        )
    _box(
        "Reader fascia lower transition rail",
        (0, -.132, .184),
        (.350, .016, .018),
        ("blue_accent", "cool_grey"),
        bevel=.004,
        category="integrated control fascia",
    )


def _chest_freezer() -> None:
    # The front controller/latch is a load-bearing bridge with pivot hardware,
    # not an isolated dark card.
    for x in (-.145, .145):
        _cylinder(
            "Chest ULT latch bridge pivot",
            (x, -.370, .804),
            .010,
            .020,
            ("zinc", "stainless"),
            axis=(0, 1, 0),
            vertices=20,
            category="latch mechanism",
        )
    _box(
        "Chest ULT controller protective brow",
        (0, -.368, .846),
        (.330, .024, .018),
        ("cool_grey", "mid_grey"),
        bevel=.005,
        category="controller housing",
    )
    _torus(
        "Chest ULT pressure port bezel",
        (.330, -.357, .500),
        .018,
        .003,
        ("stainless", "zinc"),
        rotation=(math.pi / 2, 0, 0),
        category="service port",
    )
    # A quiet lower service datum and recessed rear access fasteners preserve
    # the clean insulated mass while preventing it from reading as one cube.
    _box(
        "Chest ULT lower front service rail",
        (0, -.359, .120),
        (.760, .012, .024),
        ("cool_grey", "powder_light"),
        bevel=.003,
        category="service plinth",
    )
    for x in (-.275, .275):
        _cylinder(
            "Chest ULT rear compressor-cover fastener",
            (x, .371, .250),
            .004,
            .003,
            ("zinc", "stainless"),
            axis=(0, 1, 0),
            vertices=16,
            category="rear service fastener",
        )


def _desk(spec: f.AssetSpec) -> None:
    style_name = {
        "steel-pedestal-desk": "Steel pedestal desk",
        "wood-pedestal-desk": "Walnut pedestal desk",
        "maple-steel-desk": "Maple steel desk",
    }[spec.asset_id]
    w, d, h = spec.width, spec.depth, spec.height
    pedestal_w = w * .33
    px = w * .5 - pedestal_w * .5 - .035
    # Four real under-top bearing plates explain how the pedestal and opposite
    # support carry the thin worktop. They are hidden at ordinary eye level but
    # remain convincing from a low orbit.
    for x in (-w * .5 + .055, px - pedestal_w * .34, px + pedestal_w * .34):
        _box(
            f"{style_name} under-top mounting plate",
            (x, 0, h - .037),
            (.105, d * .62, .012),
            ("powder_dark", "walnut_edge", "mid_grey"),
            bevel=.002,
            category="structural mounting plate",
        )
    # Handle bosses remove the appearance of bars floating off the drawer face.
    face_y = -d * .458
    for drawer, z in enumerate((h * .855, h * .640, h * .355), start=1):
        for x in (px - pedestal_w * .18, px + pedestal_w * .18):
            _box(
                f"{style_name} drawer {drawer} pull mounting boss",
                (x, face_y + .002, z),
                (.022, .016, .022),
                ("black", "graphite"),
                bevel=.004,
                category="drawer pull mounting",
            )
    # Rear carcass fasteners and folded side returns are subtle, functional
    # all-sided detail—not decorative plaques.
    for x in (px - pedestal_w * .38, px + pedestal_w * .38):
        for z in (.130, h * .62):
            _cylinder(
                f"{style_name} rear carcass fixing",
                (x, d * .448, z),
                .004,
                .002,
                ("zinc", "stainless"),
                axis=(0, 1, 0),
                vertices=16,
                category="rear carcass fastener",
            )


def _utility_table(spec: f.AssetSpec) -> None:
    w, d, h = spec.width, spec.depth, spec.height
    # Two concealed transverse bearers distribute the clean top load without
    # adding any visible service fixture to the reference-defined surface.
    for x in (-w * .28, w * .28):
        _box(
            "Utility table concealed transverse bearer",
            (x, 0, h - .054),
            (.050, d * .78, .046),
            ("black_powder", "graphite"),
            bevel=.002,
            category="welded square-tube frame",
        )
    for x in (-w * .465, w * .465):
        for y in (-d * .44, d * .44):
            _box(
                "Utility table welded corner backing",
                (x, y, h - .094),
                (.072, .072, .028),
                ("black_powder", "graphite"),
                bevel=.004,
                category="welded corner joint",
            )


def _printer(spec: f.AssetSpec) -> None:
    w, d, h = spec.width, spec.depth, spec.height
    front_y = -d * .5
    if spec.asset_id == "high-volume-multifunction-printer":
        # Front shoulder returns visually tie the scanner deck to the asymmetric
        # control/service columns and make the reference silhouette readable.
        for x in (-w * .445, w * .445):
            _box(
                "High-volume scanner shoulder return",
                (x, front_y + .018, h * .685),
                (.040, .036, h * .125),
                ("cool_grey", "mid_grey"),
                bevel=.007,
                category="formed scanner shoulder",
            )
        _box(
            "High-volume control pod lower support",
            (-w * .335, front_y + .016, h * .615),
            (w * .250, .030, h * .050),
            ("cool_grey", "mid_grey"),
            bevel=.005,
            category="integrated control support",
        )
        for x in (-w * .245, w * .105):
            _cylinder(
                "High-volume cassette guide roller",
                (x, front_y + .052, h * .350),
                .007,
                .020,
                ("rubber", "seal"),
                axis=(0, 1, 0),
                vertices=18,
                category="paper path",
            )
    elif spec.asset_id == "compact-ink-tank-printer":
        # The supplied compact ink-tank reference has a real right service bay.
        # Use nested depth so the four indicators cannot z-fight the enclosure.
        bay_x = w * .355
        _box(
            "Compact right ink-service bezel",
            (bay_x, front_y + .0045, h * .385),
            (w * .205, .008, h * .245),
            ("mid_grey", "cool_grey"),
            bevel=.006,
            category="ink service bezel",
        )
        _box(
            "Compact right ink-service recess",
            (bay_x, front_y + .0045, h * .385),
            (w * .150, .004, h * .150),
            ("graphite", "seal"),
            bevel=.004,
            category="ink service recess",
        )
        colors = ("ink_cyan", "ink_magenta", "ink_yellow", "graphite")
        for index, (offset, color) in enumerate(zip((-.045, -.015, .015, .045), colors), start=1):
            _box(
                f"Compact ink level indicator {index}",
                (bay_x + offset, front_y + .0015, h * .385),
                (.018, .001, h * .095),
                (color,),
                bevel=.002,
                category="ink level indicator",
            )
        _box(
            "Compact output guide lip",
            (0, front_y + .0065, h * .370),
            (w * .62, .008, .022),
            ("cool_grey", "mid_grey"),
            bevel=.003,
            category="paper path",
        )


APPLIERS = {
    "electronic-pipette-station": _pipette_holder,
    "automated-microplate-reader": _microplate_reader,
    "chest-ultra-low-freezer": _chest_freezer,
    "steel-pedestal-desk": None,
    "wood-pedestal-desk": None,
    "maple-steel-desk": None,
    "black-utility-table": None,
    "high-volume-multifunction-printer": None,
    "compact-ink-tank-printer": None,
}


def apply(spec: f.AssetSpec) -> dict[str, object]:
    """Apply the named reference pass; never alter the locked sonicator."""
    if spec.asset_id == LOCKED_ASSET:
        return {"revision": REVISION, "locked": True, "applied": False}
    if spec.asset_id not in APPLIERS and spec.asset_id != "gpu-analysis-workstation":
        raise RuntimeError(f"{REVISION}: unsupported asset {spec.asset_id}")

    if spec.asset_id in {
        "steel-pedestal-desk", "wood-pedestal-desk", "maple-steel-desk",
    }:
        _desk(spec)
    elif spec.asset_id == "black-utility-table":
        _utility_table(spec)
    elif spec.asset_id in {
        "high-volume-multifunction-printer", "compact-ink-tank-printer",
    }:
        _printer(spec)
    elif spec.asset_id != "gpu-analysis-workstation":
        APPLIERS[spec.asset_id]()

    if f.ROOT is not None:
        f.ROOT["reference_rework_revision"] = REVISION
        f.ROOT["reference_spec"] = "docs/3d/BATCH14_REFERENCE_REWORK.md"
        f.ROOT["reference_rework_locked_benchmark"] = LOCKED_ASSET
    return {"revision": REVISION, "locked": False, "applied": True}


__all__ = ["LOCKED_ASSET", "REVISION", "apply"]
