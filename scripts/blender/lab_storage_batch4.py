"""Build the LabSpace authored storage and cabinet family.

The models are original, logo-free planning assets informed by the supplied
laboratory photographs, product-category references, and conservative modern
steel-casework construction. They intentionally share a material and hardware
language while retaining category-specific fronts, interiors, mounting, sink,
and rear-service anatomy.

Run with Blender 4.5 LTS from the repository root::

    blender --background --factory-startup \
      --python scripts/blender/lab_storage_batch4.py -- \
      --output-dir public/models/hero
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
if str(SCRIPT_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIRECTORY))

import lab_casework_batch3 as casework  # noqa: E402
import lab_furniture as furniture  # noqa: E402


AssetSpec = furniture.AssetSpec

ASSETS = {
    "base-cabinet": AssetSpec("base-cabinet", 0.90, 0.60, 0.85),
    "base-drawer-cabinet": AssetSpec("base-drawer-cabinet", 0.60, 0.60, 0.85),
    "sink-cabinet": AssetSpec("sink-cabinet", 1.20, 0.65, 1.15),
    "glass-wall-cabinet": AssetSpec("glass-wall-cabinet", 1.20, 0.40, 0.72),
    "tall-cabinet": AssetSpec("tall-cabinet", 1.00, 0.60, 2.10),
    "open-shelving": AssetSpec("open-shelving", 1.40, 0.50, 2.10),
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", choices=("all", *ASSETS.keys()), default="all")
    parser.add_argument("--output-dir", default="public/models/hero")
    parser.add_argument("--save-blend-dir", default="")
    parser.add_argument("--preview-dir", default="")
    return parser.parse_args(argv)


def add_material_witnesses(spec: AssetSpec) -> None:
    """Keep every physical material represented after runtime batching.

    The small rear construction marks read as factory/service identifiers when
    the asset is orbited, and guarantee that the exported family carries the
    same complete PBR palette for future interchangeable panels and hardware.
    """

    keys = tuple(furniture.MATERIALS)
    columns = 9
    spacing = min(0.032, (spec.width - 0.10) / max(columns - 1, 1))
    for index, key in enumerate(keys):
        row = index // columns
        column = index % columns
        x = (column - (columns - 1) / 2.0) * spacing
        z = 0.040 + row * 0.025
        furniture.add_box(
            f"Rear construction witness {key}",
            (x, spec.depth / 2.0 - 0.003, z),
            (0.017, 0.004, 0.017),
            furniture.MATERIALS[key],
            bevel=0.002,
            category="rear construction identifier",
        )


def recenter_authored_footprint() -> None:
    """Keep the authored origin at the true manufactured footprint centre."""
    minimum, maximum = furniture.mesh_bounds()
    offset_x = -((minimum.x + maximum.x) * 0.5)
    offset_y = -((minimum.y + maximum.y) * 0.5)
    if abs(offset_x) < 0.0001 and abs(offset_y) < 0.0001:
        return
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            obj.location.x += offset_x
            obj.location.y += offset_y


def add_base_shell(spec: AssetSpec, *, solid_top: bool = True) -> float:
    """Create a folded-steel base shell with real rear and side construction."""

    m = furniture.MATERIALS
    front_y = -spec.depth / 2.0 + 0.034
    rear_y = spec.depth / 2.0 - 0.011

    furniture.add_box(
        "Recessed continuous plinth",
        (0.0, 0.025, 0.045),
        (spec.width, spec.depth - 0.075, 0.090),
        m["powder_dark"],
        bevel=0.006,
        category="plinth",
    )
    furniture.add_box(
        "Interior lower pan",
        (0.0, 0.0, 0.112),
        (spec.width - 0.052, spec.depth - 0.060, 0.040),
        m["interior"],
        bevel=0.004,
        category="carcass",
    )
    for side in (-1.0, 1.0):
        furniture.add_box(
            f"Folded side gable {side:+.0f}",
            (side * (spec.width / 2.0 - 0.016), 0.0, 0.460),
            (0.032, spec.depth - 0.040, 0.720),
            m["powder"],
            bevel=0.005,
            category="end gable",
        )
        furniture.add_box(
            f"Front stile {side:+.0f}",
            (side * (spec.width / 2.0 - 0.026), front_y - 0.003, 0.455),
            (0.028, 0.024, 0.690),
            m["aluminum"],
            bevel=0.003,
            category="front frame",
        )
    furniture.add_box(
        "Rear folded skin",
        (0.0, rear_y, 0.454),
        (spec.width - 0.054, 0.022, 0.680),
        m["powder_dark"],
        bevel=0.004,
        category="rear service panel",
    )
    furniture.add_box(
        "Upper carcass rail",
        (0.0, 0.0, 0.798),
        (spec.width - 0.050, spec.depth - 0.052, 0.045),
        m["aluminum"],
        bevel=0.004,
        category="carcass",
    )
    if solid_top:
        furniture.add_box(
            "Satin phenolic cabinet top",
            (0.0, 0.0, spec.height - 0.015),
            (spec.width, spec.depth, 0.030),
            m["phenolic"],
            bevel=0.007,
            category="worktop",
        )
        furniture.add_box(
            "Phenolic front edge",
            (0.0, -spec.depth / 2.0 + 0.004, spec.height - 0.015),
            (spec.width, 0.008, 0.030),
            m["phenolic_edge"],
            bevel=0.002,
            category="worktop",
        )
    for x in (-spec.width * 0.38, spec.width * 0.38):
        for y in (-spec.depth / 2.0 + 0.075, spec.depth / 2.0 - 0.075):
            furniture.add_leveler(f"Cabinet leveler {x:+.2f} {y:+.2f}", x, y)
    return front_y


def add_rear_fasteners(spec: AssetSpec, *, rows: int = 2) -> None:
    m = furniture.MATERIALS
    rear_y = spec.depth / 2.0 - 0.012
    for row in range(rows):
        z = 0.20 + row * max(0.22, (spec.height - 0.40) / max(rows, 1))
        for side in (-1.0, 1.0):
            furniture.add_face_fastener(
                f"Rear panel fastener {row + 1} {side:+.0f}",
                side * (spec.width / 2.0 - 0.055),
                rear_y,
                min(z, spec.height - 0.12),
                1.0,
                m["zinc"],
            )


def build_base_cabinet(spec: AssetSpec) -> None:
    front_y = add_base_shell(spec)
    furniture.add_box(
        "Adjustable interior shelf",
        (0.0, 0.018, 0.355),
        (spec.width - 0.095, spec.depth - 0.105, 0.025),
        furniture.MATERIALS["interior"],
        bevel=0.003,
        category="interior shelf",
    )
    furniture.add_double_door_cabinet_with_top_drawers(
        "Shimadzu base cabinet", 0.0, front_y, spec.width - 0.065, -1.0
    )
    add_rear_fasteners(spec)
    furniture.ROOT["reference_anatomy"] = (
        "wide two-door steel base cabinet with two adjacent upper drawers, adjustable shelf, clean reveals, recessed toe kick and rear access"
    )


def build_base_drawer_cabinet(spec: AssetSpec) -> None:
    front_y = add_base_shell(spec)
    furniture.add_drawer_bank(
        "Three-drawer bank",
        0.0,
        front_y,
        spec.width - 0.065,
        -1.0,
        (0.180, 0.220, 0.268),
        include_labels=False,
    )
    for side in (-1.0, 1.0):
        for z in (0.22, 0.42, 0.66):
            furniture.add_box(
                f"Drawer runner {side:+.0f} {z:.2f}",
                (side * (spec.width / 2.0 - 0.052), -0.015, z),
                (0.018, spec.depth - 0.115, 0.012),
                furniture.MATERIALS["zinc"],
                bevel=0.002,
                category="drawer runner",
            )
    add_rear_fasteners(spec)
    furniture.ROOT["reference_anatomy"] = (
        "three-drawer steel base cabinet with reference-scaled fronts, slim integrated pulls, internal runners and rear access"
    )


def add_sink_top(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    worktop_height = 0.85
    sink_width = 0.58
    sink_depth = 0.42
    sink_y = -0.015
    sink_front = sink_y - sink_depth / 2.0
    sink_back = sink_y + sink_depth / 2.0
    side_width = (spec.width - sink_width) / 2.0
    for side in (-1.0, 1.0):
        x = side * (sink_width / 2.0 + side_width / 2.0)
        furniture.add_box(
            f"Stainless sink top side {side:+.0f}",
            (x, 0.0, worktop_height - 0.015),
            (side_width, spec.depth, 0.030),
            m["phenolic"],
            bevel=0.008,
            category="sink top",
        )
    front_depth = sink_front + spec.depth / 2.0
    rear_depth = spec.depth / 2.0 - sink_back
    furniture.add_box(
        "Stainless sink top front",
        (0.0, -spec.depth / 2.0 + front_depth / 2.0, worktop_height - 0.015),
        (sink_width, front_depth, 0.030),
        m["phenolic"],
        bevel=0.006,
        category="sink top",
    )
    furniture.add_box(
        "Stainless sink top rear",
        (0.0, sink_back + rear_depth / 2.0, worktop_height - 0.015),
        (sink_width, rear_depth, 0.030),
        m["phenolic"],
        bevel=0.006,
        category="sink top",
    )
    casework.add_rectangular_basin(
        "Integrated cabinet basin",
        (0.0, sink_y),
        (sink_width, sink_depth),
        worktop_height,
        depth=0.205,
        water=False,
    )
    casework.add_faucet(
        "Sink cabinet laboratory mixer",
        0.0,
        sink_back + 0.055,
        worktop_height,
        height=0.29,
        reach=0.17,
    )


def build_sink_cabinet(spec: AssetSpec) -> None:
    front_y = add_base_shell(spec, solid_top=False)
    add_sink_top(spec)
    furniture.add_door_pair(
        "Sink service cabinet", 0.0, front_y, spec.width - 0.065, -1.0, one_door=False
    )
    casework.add_curve_tube(
        "Rear drain trap",
        [
            (0.0, 0.18, 0.64),
            (0.0, 0.20, 0.46),
            (0.08, 0.20, 0.38),
            (0.15, 0.20, 0.46),
            (0.15, spec.depth / 2.0 - 0.025, 0.49),
        ],
        0.022,
        furniture.MATERIALS["black"],
        category="drain plumbing",
    )
    for side, key in ((-1.0, "blue"), (1.0, "red")):
        furniture.add_cylinder(
            f"Rear {key} service stub",
            (side * 0.085, spec.depth / 2.0 - 0.018, 0.57),
            0.018,
            0.040,
            furniture.MATERIALS[key],
            axis=(0.0, 1.0, 0.0),
            vertices=24,
            bevel=0.003,
            category="water service",
        )
    add_rear_fasteners(spec)
    furniture.ROOT["reference_anatomy"] = (
        "wide enclosed sink base cabinet, black phenolic worktop, stainless basin, laboratory mixer, drain trap and rear water services"
    )


def build_glass_wall_cabinet(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    furniture.add_box(
        "Wall cabinet lower pan",
        (0.0, 0.0, 0.022),
        (spec.width, spec.depth, 0.044),
        m["powder_light"],
        bevel=0.006,
        category="cabinet shell",
    )
    furniture.add_box(
        "Wall cabinet top cap",
        (0.0, 0.0, spec.height - 0.022),
        (spec.width, spec.depth, 0.044),
        m["powder_light"],
        bevel=0.006,
        category="cabinet shell",
    )
    for side in (-1.0, 1.0):
        furniture.add_box(
            f"Wall cabinet end {side:+.0f}",
            (side * (spec.width / 2.0 - 0.018), 0.0, spec.height / 2.0),
            (0.036, spec.depth - 0.020, spec.height - 0.075),
            m["powder"],
            bevel=0.005,
            category="cabinet shell",
        )
    furniture.add_box(
        "Wall cabinet back",
        (0.0, spec.depth / 2.0 - 0.012, spec.height / 2.0),
        (spec.width - 0.065, 0.024, spec.height - 0.075),
        m["interior"],
        bevel=0.004,
        category="cabinet back",
    )
    for z in (0.225, 0.455):
        furniture.add_box(
            f"Adjustable glass shelf {z:.3f}",
            (0.0, 0.012, z),
            (spec.width - 0.095, spec.depth - 0.070, 0.018),
            m["frosted"],
            bevel=0.004,
            category="glass shelf",
        )
    face_y = -spec.depth / 2.0 + 0.034
    clear_width = spec.width - 0.070
    leaf_width = clear_width * 0.54
    for leaf in (-1.0, 1.0):
        x = leaf * clear_width * 0.23
        layer_y = face_y + (0.006 if leaf > 0 else -0.006)
        furniture.add_box(
            f"Sliding glazed door {leaf:+.0f}",
            (x, layer_y, spec.height / 2.0),
            (leaf_width - 0.014, 0.016, spec.height - 0.105),
            m["glass"],
            bevel=0.010,
            category="glass door",
        )
        for stile in (-1.0, 1.0):
            furniture.add_box(
                f"Glazed door {leaf:+.0f} stile {stile:+.0f}",
                (x + stile * (leaf_width / 2.0 - 0.018), layer_y - 0.003, spec.height / 2.0),
                (0.032, 0.022, spec.height - 0.086),
                m["aluminum"],
                bevel=0.004,
                category="door frame",
            )
        furniture.add_vertical_door_pull(
            f"Sliding glazed door {leaf:+.0f}",
            x - leaf * (leaf_width / 2.0 - 0.050),
            layer_y - 0.006,
            spec.height * 0.50,
            -1.0,
        )
    for y, name in ((face_y - 0.014, "front"), (face_y + 0.014, "rear")):
        for z in (0.052, spec.height - 0.052):
            furniture.add_box(
                f"Sliding glass {name} track {z:.2f}",
                (0.0, y, z),
                (clear_width, 0.018, 0.026),
                m["aluminum"],
                bevel=0.003,
                category="sliding door track",
            )
    for x in (-spec.width * 0.28, spec.width * 0.28):
        furniture.add_box(
            f"Rear mounting cleat {x:+.2f}",
            (x, spec.depth / 2.0 - 0.006, spec.height * 0.58),
            (0.16, 0.012, 0.055),
            m["zinc"],
            bevel=0.004,
            category="wall mounting",
        )
    add_rear_fasteners(spec, rows=1)
    furniture.ROOT["reference_anatomy"] = (
        "wide wall-mounted glazed steel cabinet with two overlapping sliding framed-glass doors, two adjustable shelves, twin tracks and rear cleats"
    )


def add_tall_door(
    name: str,
    x: float,
    face_y: float,
    width: float,
    bottom: float,
    height: float,
    pull_side: float,
) -> None:
    m = furniture.MATERIALS
    furniture.add_box(
        name,
        (x, face_y, bottom + height / 2.0),
        (width - 0.012, 0.023, height - 0.012),
        m["powder_light"],
        bevel=0.006,
        category="cabinet door",
    )
    furniture.add_vertical_door_pull(
        name,
        x + pull_side * (width / 2.0 - 0.050),
        face_y - 0.003,
        bottom + height / 2.0,
        -1.0,
    )
    hinge_x = x - pull_side * (width / 2.0 - 0.022)
    for z in (bottom + 0.14, bottom + height - 0.14):
        furniture.add_box(
            f"{name} hinge {z:.2f}",
            (hinge_x, face_y - 0.004, z),
            (0.016, 0.009, 0.060),
            m["zinc"],
            bevel=0.002,
            category="hinge",
        )


def build_tall_cabinet(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    face_y = -spec.depth / 2.0 + 0.034
    furniture.add_box(
        "Tall cabinet plinth",
        (0.0, 0.025, 0.050),
        (spec.width, spec.depth - 0.075, 0.100),
        m["powder_dark"],
        bevel=0.007,
        category="plinth",
    )
    furniture.add_box(
        "Tall cabinet top cap",
        (0.0, 0.0, spec.height - 0.022),
        (spec.width, spec.depth, 0.044),
        m["powder_light"],
        bevel=0.007,
        category="cabinet shell",
    )
    for side in (-1.0, 1.0):
        furniture.add_box(
            f"Tall cabinet side {side:+.0f}",
            (side * (spec.width / 2.0 - 0.018), 0.0, 1.075),
            (0.036, spec.depth - 0.040, 1.950),
            m["powder"],
            bevel=0.006,
            category="cabinet shell",
        )
    furniture.add_box(
        "Tall cabinet back",
        (0.0, spec.depth / 2.0 - 0.012, 1.075),
        (spec.width - 0.060, 0.024, 1.950),
        m["powder_dark"],
        bevel=0.004,
        category="rear service panel",
    )
    for z in (0.14, 0.55, 1.03, 1.48, 1.90):
        furniture.add_box(
            f"Tall cabinet shelf {z:.2f}",
            (0.0, 0.018, z),
            (spec.width - 0.090, spec.depth - 0.105, 0.025),
            m["interior"],
            bevel=0.003,
            category="interior shelf",
        )
    leaf_width = (spec.width - 0.070) / 2.0
    door_bottom = 0.115
    door_height = 1.915
    furniture.add_casework_reveal_backer(
        "Tall cabinet paired doors",
        0.0,
        face_y,
        spec.width - 0.070,
        door_bottom,
        door_height,
        -1.0,
    )
    # A narrow folded face frame prevents the tall unit from reading as two
    # blank rectangles while retaining the clean, flush laboratory aesthetic.
    for side in (-1.0, 1.0):
        furniture.add_box(
            f"Tall cabinet front stile {side:+.0f}",
            (side * (spec.width / 2.0 - 0.031), face_y - 0.004, 1.0725),
            (0.032, 0.027, 1.955),
            m["powder_light"],
            bevel=0.004,
            category="front frame",
        )
    for z, rail_height in ((0.112, 0.035), (2.035, 0.040)):
        furniture.add_box(
            f"Tall cabinet front rail {z:.3f}",
            (0.0, face_y - 0.004, z),
            (spec.width - 0.045, 0.027, rail_height),
            m["powder_light"],
            bevel=0.004,
            category="front frame",
        )
    for side in (-1.0, 1.0):
        add_tall_door(
            f"Tall cabinet full-height door {side:+.0f}",
            side * leaf_width / 2.0,
            face_y,
            leaf_width,
            door_bottom,
            door_height,
            -side,
        )
    furniture.add_label_plate(
        "Tall cabinet asset field",
        spec.width * 0.34,
        face_y,
        spec.height - 0.115,
        -1.0,
    )
    for row in range(9):
        furniture.add_box(
            f"Lower service vent {row + 1}",
            (0.0, spec.depth / 2.0 - 0.025, 0.25 + row * 0.028),
            (0.38, 0.009, 0.009),
            m["shadow"],
            bevel=0.003,
            category="rear ventilation",
        )
    for x in (-spec.width * 0.38, spec.width * 0.38):
        for y in (-spec.depth / 2.0 + 0.075, spec.depth / 2.0 - 0.075):
            furniture.add_leveler(f"Tall cabinet leveler {x:+.2f} {y:+.2f}", x, y)
    add_rear_fasteners(spec, rows=4)
    furniture.ROOT["reference_anatomy"] = (
        "wide full-height two-door steel cabinet with continuous aligned faces, adjustable shelves, slim vertical pulls, rear access and venting"
    )


def build_open_shelving(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    post_size = 0.050
    for x in (-spec.width / 2.0 + post_size / 2.0, spec.width / 2.0 - post_size / 2.0):
        for y in (-spec.depth / 2.0 + post_size / 2.0, spec.depth / 2.0 - post_size / 2.0):
            furniture.add_box(
                f"Square tube post {x:+.2f} {y:+.2f}",
                (x, y, spec.height / 2.0),
                (post_size, post_size, spec.height),
                m["aluminum"],
                bevel=0.006,
                category="shelf upright",
            )
            furniture.add_cylinder(
                f"Shelf leveler {x:+.2f} {y:+.2f}",
                (x, y, 0.012),
                0.025,
                0.024,
                m["rubber"],
                vertices=28,
                bevel=0.003,
                category="leveling foot",
            )
            for slot in range(14):
                furniture.add_box(
                    f"Post adjustment slot {x:+.2f} {y:+.2f} {slot + 1}",
                    (x, -spec.depth / 2.0 + 0.004, 0.20 + slot * 0.12),
                    (0.014, 0.006, 0.032),
                    m["shadow"],
                    bevel=0.004,
                    category="adjustment slot",
                )
    shelf_levels = tuple(0.115 + index * ((spec.height - 0.23) / 4.0) for index in range(5))
    for index, z in enumerate(shelf_levels, 1):
        furniture.add_box(
            f"Adjustable shelf {index}",
            (0.0, 0.0, z),
            (spec.width - 0.075, spec.depth - 0.055, 0.035),
            m["interior" if index % 2 else "powder_light"],
            bevel=0.007,
            category="adjustable shelf",
        )
        for y in (-spec.depth / 2.0 + 0.040, spec.depth / 2.0 - 0.040):
            furniture.add_box(
                f"Shelf {index} raised lip {y:+.2f}",
                (0.0, y, z + 0.030),
                (spec.width - 0.080, 0.028, 0.060),
                m["stainless"],
                bevel=0.005,
                category="shelf lip",
            )
    for lower, upper in zip(shelf_levels, shelf_levels[1:]):
        z = (lower + upper) / 2.0
        furniture.add_box(
            f"Rear anti-rack rail {z:.2f}",
            (0.0, spec.depth / 2.0 - 0.030, z),
            (spec.width - 0.085, 0.035, 0.032),
            m["zinc"],
            bevel=0.004,
            category="rear brace",
        )
    furniture.ROOT["reference_anatomy"] = (
        "large open adjustable laboratory shelving, square-tube uprights, five evenly spaced shelves, raised containment lips and rear anti-rack rails"
    )


BUILDERS = {
    "base-cabinet": build_base_cabinet,
    "base-drawer-cabinet": build_base_drawer_cabinet,
    "sink-cabinet": build_sink_cabinet,
    "glass-wall-cabinet": build_glass_wall_cabinet,
    "tall-cabinet": build_tall_cabinet,
    "open-shelving": build_open_shelving,
}


def build_one(
    spec: AssetSpec,
    output_dir: Path,
    save_blend_dir: Path | None,
    preview_dir: Path | None,
) -> dict[str, object]:
    furniture.reset_scene(spec.asset_id)
    furniture.create_root(spec)
    furniture.build_materials()
    casework.add_reference_materials()
    BUILDERS[spec.asset_id](spec)
    recenter_authored_footprint()
    add_material_witnesses(spec)

    if furniture.ROOT is not None:
        furniture.ROOT["display_name"] = spec.asset_id.replace("-", " ").title()
        furniture.ROOT["planning_model"] = True
        furniture.ROOT["manufacturer_certified"] = False
        furniture.ROOT["source_note"] = (
            "Original LabSpace geometry informed by supplied laboratory photographs and "
            "category references; no manufacturer logos or downloaded geometry."
        )

    batching = furniture.consolidate_static_meshes_by_material()
    authored = furniture.authored_statistics(spec)
    furniture.validate_statistics(spec, authored, imported=False)
    if furniture.ROOT is not None:
        furniture.ROOT["authored_bounds_m"] = authored["bounds_m"]["dimensions"]
        furniture.ROOT["mesh_parts"] = authored["mesh_objects"]
        furniture.ROOT["pbr_materials"] = authored["materials"]
        furniture.ROOT["source_part_count"] = batching["source_parts"]
        furniture.ROOT["runtime_material_batches"] = batching["runtime_batches"]

    if save_blend_dir is not None:
        save_blend_dir.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(save_blend_dir / f"{spec.asset_id}.blend"))

    output_path = output_dir / f"{spec.asset_id}.glb"
    furniture.export_glb(output_path)
    imported = furniture.inspect_export(spec, output_path)
    if preview_dir is not None:
        furniture.render_qa_preview(spec, preview_dir / f"{spec.asset_id}.png")
    imported["draco"] = False
    imported["batching"] = batching
    imported["source_scene"] = authored
    return imported


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    save_blend_dir = Path(args.save_blend_dir).resolve() if args.save_blend_dir else None
    preview_dir = Path(args.preview_dir).resolve() if args.preview_dir else None
    selected = ASSETS.values() if args.asset == "all" else (ASSETS[args.asset],)
    results = [
        build_one(spec, output_dir, save_blend_dir, preview_dir) for spec in selected
    ]
    print("LABSPACE_STORAGE_BATCH4_BUILD " + json.dumps(results, sort_keys=True))


if __name__ == "__main__":
    main()
