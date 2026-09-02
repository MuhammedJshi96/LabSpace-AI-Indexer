"""Reference-led, logo-free compact monochrome MFP for the legacy ``printer`` id.

The model is deliberately constructed as one manufactured appliance rather
than a pile of coincident boxes.  Its paper aperture has physical side, rear,
roof and floor returns; the scanner, cassette, controller and rear service
anatomy remain readable from every orbit angle.
"""
from __future__ import annotations

import bpy

import lab_furniture as f


REVISION = "catalog-printer-reference-r2"


def _mat(*keys: str) -> bpy.types.Material:
    for key in keys:
        material = f.MATERIALS.get(key)
        if material is not None:
            return material
    raise RuntimeError("Missing printer material: " + " / ".join(keys))


def _box(
    name: str,
    xyz: tuple[float, float, float],
    size: tuple[float, float, float],
    materials: tuple[str, ...],
    *,
    bevel: float,
    category: str,
) -> bpy.types.Object:
    return f.add_box(
        name,
        xyz,
        size,
        _mat(*materials),
        bevel=min(bevel, min(size) * .22),
        category=category,
    )


def _cylinder(
    name: str,
    xyz: tuple[float, float, float],
    radius: float,
    depth: float,
    materials: tuple[str, ...],
    *,
    axis: tuple[float, float, float] = (0, 0, 1),
    category: str,
    vertices: int = 24,
) -> bpy.types.Object:
    return f.add_cylinder(
        name,
        xyz,
        radius,
        depth,
        _mat(*materials),
        axis=axis,
        vertices=vertices,
        category=category,
    )


def _vent_bank(prefix: str, x: float, y: float, z: float, width: float) -> None:
    for row in range(5):
        for column in range(7):
            _box(
                f"{prefix} {row + 1}-{column + 1}",
                (x + (column - 3) * width / 7.4, y, z + (row - 2) * .010),
                (width / 9.2, .004, .004),
                ("shadow", "black"),
                bevel=.001,
                category="rear ventilation",
            )


def build(spec: f.AssetSpec) -> None:
    if f.ROOT is None:
        raise RuntimeError("Create the asset root before building the catalog printer")

    w, d, h = spec.width, spec.depth, spec.height
    front, rear = -d * .5, d * .5

    # Formed engine enclosure.  The front paper path is a deliberately bounded
    # opening; its internal surfaces overlap their structural neighbours by
    # 1–2 mm so orbiting cannot expose background through the appliance.
    _box("Printer formed lower enclosure", (0, .018, h * .315),
         (w * .94, d * .90, h * .52), ("porcelain", "powder_light"),
         bevel=.016, category="formed enclosure")
    cavity_x, cavity_z = -w * .070, h * .465
    cavity_w, cavity_h = w * .610, h * .225
    wall = .018
    _box("Printer output cavity rear", (cavity_x, front + d * .255, cavity_z),
         (cavity_w, .018, cavity_h), ("powder_dark", "interior"),
         bevel=.004, category="paper path")
    _box("Printer output cavity floor", (cavity_x, front + d * .145, cavity_z - cavity_h * .5),
         (cavity_w, d * .240, wall), ("powder_dark", "interior"),
         bevel=.004, category="paper path")
    _box("Printer output cavity roof", (cavity_x, front + d * .145, cavity_z + cavity_h * .5),
         (cavity_w, d * .240, wall), ("powder_dark", "interior"),
         bevel=.004, category="paper path")
    for side in (-1, 1):
        _box("Printer output cavity side return",
             (cavity_x + side * cavity_w * .5, front + d * .145, cavity_z),
             (wall, d * .240, cavity_h + wall), ("powder_dark", "interior"),
             bevel=.004, category="paper path")
        _cylinder("Printer exit pinch roller",
                  (cavity_x + side * cavity_w * .22, front + d * .055, cavity_z + cavity_h * .22),
                  .009, cavity_w * .18, ("rubber",), axis=(1, 0, 0),
                  vertices=20, category="paper path")

    # Paper cassette is inset from the enclosure face with a real carrier and
    # a separate finger pull, not a coplanar decorative rectangle.
    _box("Printer cassette carrier", (0, front + .040, h * .172),
         (w * .82, d * .115, h * .210), ("interior", "powder"),
         bevel=.006, category="paper cassette")
    _box("Printer cassette front", (0, front + .009, h * .160),
         (w * .86, .020, h * .205), ("powder_light", "porcelain"),
         bevel=.007, category="paper cassette")
    _box("Printer cassette finger well", (0, front + .0025, h * .225),
         (w * .205, .003, .024), ("powder_dark", "black"),
         bevel=.005, category="cassette pull")

    # Scanner deck/lid use continuous, softened shells and a dark perimeter
    # gasket that reads as a manufactured joint rather than an assembly gap.
    _box("Printer scanner deck", (0, .008, h * .735),
         (w * .98, d * .94, h * .145), ("powder_light", "porcelain"),
         bevel=.014, category="scanner")
    _box("Printer scanner gasket", (0, .008, h * .818),
         (w * .925, d * .865, .008), ("rubber", "shadow"),
         bevel=.004, category="scanner seal")
    _box("Printer scanner lid", (0, .012, h * .900),
         (w * .94, d * .88, h * .155), ("porcelain", "powder_light"),
         bevel=.014, category="scanner lid")
    _box("Printer lid inset", (0, .015, h * .981),
         (w * .82, d * .74, .006), ("powder_light", "porcelain"),
         bevel=.006, category="scanner lid")
    for x in (-w * .300, w * .300):
        _box("Printer scanner hinge", (x, rear - .030, h * .825),
             (.050, .055, .035), ("powder_dark", "aluminum"),
             bevel=.006, category="hinge")

    # Angled-looking integrated fascia achieved through a stepped depth
    # cascade, with a true recessed display and restrained functional keys.
    control_x = -w * .265
    _box("Printer integrated control brow", (control_x, front + .018, h * .690),
         (w * .350, .032, h * .145), ("powder_dark", "black"),
         bevel=.009, category="control fascia")
    _box("Printer controller bezel", (control_x - w * .025, front + .004, h * .695),
         (w * .215, .004, h * .080), ("black", "shadow"),
         bevel=.005, category="display bezel")
    _box("Printer controller screen", (control_x - w * .025, front + .0015, h * .695),
         (w * .165, .001, h * .050), ("screen", "shadow"),
         bevel=.003, category="display")
    for index, x in enumerate((control_x + w * .115, control_x + w * .165, control_x + w * .215)):
        _cylinder(f"Printer control key {index + 1}", (x, front + .0015, h * .695),
                  .008, .003, ("powder_light", "aluminum"), axis=(0, -1, 0),
                  vertices=24, category="control key")
    _cylinder("Printer status key", (control_x + w * .215, front + .0015, h * .650),
              .008, .003, ("teal",), axis=(0, -1, 0), vertices=24,
              category="control key")

    # All-sided service construction.
    _box("Printer rear service panel", (w * .080, rear - .008, h * .350),
         (w * .620, .012, h * .330), ("powder_dark", "interior"),
         bevel=.006, category="rear service")
    # The cover's exterior face is rear - .002.  Vent blades and ports straddle
    # that skin by 1 mm so they are mounted, visible, and never hover or hide
    # behind the cover when the product is inspected from the rear.
    _vent_bank("Printer rear vent", -w * .100, rear - .001, h * .410, w * .260)
    for index, (x, z) in enumerate(((w * .255, h * .315), (w * .255, h * .385))):
        _box(f"Printer rear service port {index + 1}", (x, rear - .001, z),
             (.040, .004, .025), ("shadow", "black"),
             bevel=.002, category="rear service")
    for side in (-1, 1):
        _box("Printer side service seam", (side * w * .470, .030, h * .425),
             (.003, d * .72, .006), ("powder_dark", "shadow"),
             bevel=.001, category="manufactured seam")
    for x in (-w * .360, w * .360):
        for y in (-d * .300, d * .330):
            _cylinder("Printer isolation foot", (x, y, h * .018), .018, h * .036,
                      ("rubber",), vertices=28, category="foot")

    f.ROOT["product_module_revision"] = REVISION
    f.ROOT["reference_class"] = "compact monochrome multifunction printer"
    f.ROOT["reference_packet"] = "September 2 compact MFP multi-view sheet"
    f.ROOT["reference_confidence"] = "B"
    f.ROOT["bounded_paper_path"] = True
    f.ROOT["all_materials_opaque"] = True
    f.ROOT["all_sided_service_anatomy"] = True
