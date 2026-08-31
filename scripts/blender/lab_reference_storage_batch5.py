"""Author the LabSpace product-reference storage and cold-equipment batch.

The five original, logo-free planning assets are informed by the user's
2026-07-17 product references: steel sliding-door cabinets, a combined glazed
and solid tall cabinet, a stainless peg drying rack, a PHCbi MDF-U731M-class
single-door biomedical freezer, and a compact solvent cabinet.  Every asset is
dimension driven, orbitable, material aware, and includes conservative rear
construction rather than a presentation-only facade.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
if str(SCRIPT_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIRECTORY))

import lab_casework_batch3 as casework  # noqa: E402
import lab_furniture as furniture  # noqa: E402
import lab_storage_batch4 as storage  # noqa: E402


AssetSpec = furniture.AssetSpec

ASSETS = {
    "sliding-door-cabinet": AssetSpec("sliding-door-cabinet", 1.20, 0.50, 1.20),
    "glazed-sliding-cabinet": AssetSpec("glazed-sliding-cabinet", 0.90, 0.50, 2.00),
    "laboratory-drying-rack": AssetSpec("laboratory-drying-rack", 0.75, 0.32, 1.20),
    "lab-freezer": AssetSpec("lab-freezer", 0.75, 0.80, 2.00),
    "solvent-cabinet": AssetSpec("solvent-cabinet", 1.00, 0.50, 1.20),
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", choices=("all", *ASSETS.keys()), default="all")
    parser.add_argument("--output-dir", default="public/models/hero")
    parser.add_argument("--save-blend-dir", default="")
    parser.add_argument("--preview-dir", default="")
    return parser.parse_args(argv)


def add_rear_panel_fasteners(spec: AssetSpec, rows: int = 3) -> None:
    rear_y = spec.depth / 2.0 - 0.006
    for row in range(rows):
        z = 0.17 + row * (spec.height - 0.34) / max(rows - 1, 1)
        for side in (-1.0, 1.0):
            furniture.add_face_fastener(
                f"Rear access fastener {row + 1} {side:+.0f}",
                side * (spec.width / 2.0 - 0.055),
                rear_y,
                z,
                1.0,
                furniture.MATERIALS["zinc"],
            )


def add_sliding_shell(
    spec: AssetSpec,
    *,
    shell_material: bpy.types.Material,
    inner_material: bpy.types.Material,
) -> float:
    m = furniture.MATERIALS
    front_y = -spec.depth / 2.0 + 0.010
    furniture.add_box(
        "Full-width recessed plinth",
        (0.0, 0.020, 0.045),
        (spec.width, spec.depth - 0.040, 0.090),
        m["powder_dark"],
        bevel=0.006,
        category="plinth",
    )
    furniture.add_box(
        "Cabinet top cap",
        (0.0, 0.0, spec.height - 0.025),
        (spec.width, spec.depth, 0.050),
        shell_material,
        bevel=0.007,
        category="cabinet shell",
    )
    furniture.add_box(
        "Cabinet lower pan",
        (0.0, 0.0, 0.110),
        (spec.width - 0.050, spec.depth - 0.045, 0.040),
        inner_material,
        bevel=0.004,
        category="cabinet shell",
    )
    for side in (-1.0, 1.0):
        furniture.add_box(
            f"Folded cabinet end {side:+.0f}",
            (side * (spec.width / 2.0 - 0.017), 0.0, spec.height / 2.0),
            (0.034, spec.depth - 0.020, spec.height - 0.050),
            shell_material,
            bevel=0.005,
            category="cabinet shell",
        )
        furniture.add_box(
            f"Front folded jamb {side:+.0f}",
            (
                side * (spec.width / 2.0 - 0.025),
                -spec.depth / 2.0 + 0.024,
                spec.height / 2.0,
            ),
            (0.032, 0.034, spec.height - 0.105),
            shell_material,
            bevel=0.004,
            category="front frame",
        )
    furniture.add_box(
        "Folded cabinet rear skin",
        (0.0, spec.depth / 2.0 - 0.012, spec.height / 2.0),
        (spec.width - 0.050, 0.024, spec.height - 0.075),
        m["powder_dark"],
        bevel=0.004,
        category="rear service panel",
    )
    return front_y


def add_sliding_tracks(spec: AssetSpec, bottom_z: float, top_z: float) -> None:
    m = furniture.MATERIALS
    front_y = -spec.depth / 2.0 + 0.022
    for name, z in (("lower", bottom_z), ("upper", top_z)):
        furniture.add_box(
            f"{name.title()} twin sliding track",
            (0.0, front_y, z),
            (spec.width - 0.055, 0.030, 0.032),
            m["aluminum"],
            bevel=0.003,
            category="sliding hardware",
        )
        furniture.add_box(
            f"{name.title()} track shadow channel",
            (0.0, front_y - 0.017, z),
            (spec.width - 0.085, 0.006, 0.010),
            m["shadow"],
            bevel=0.001,
            category="sliding hardware",
        )


def add_steel_sliding_pair(
    spec: AssetSpec,
    prefix: str,
    bottom: float,
    top: float,
    material: bpy.types.Material,
) -> None:
    m = furniture.MATERIALS
    # Both overlapping leaves and their handles remain inside the declared
    # planning envelope so 2D footprints and collision bounds stay truthful.
    front_y = -spec.depth / 2.0 + 0.036
    height = top - bottom
    panel_width = spec.width * 0.545
    for index, x in enumerate((-spec.width * 0.225, spec.width * 0.225), 1):
        y = front_y - (index - 1) * 0.012
        furniture.add_box(
            f"{prefix} sliding panel {index}",
            (x, y, (bottom + top) / 2.0),
            (panel_width, 0.026, height),
            material,
            bevel=0.006,
            category="sliding door",
        )
        furniture.add_box(
            f"{prefix} panel {index} folded return",
            (x + (-1.0 if index == 1 else 1.0) * panel_width * 0.44, y + 0.016, (bottom + top) / 2.0),
            (0.022, 0.030, height - 0.045),
            m["aluminum"],
            bevel=0.003,
            category="door return",
        )
        pull_x = x + (-panel_width * 0.36 if index == 1 else panel_width * 0.36)
        furniture.add_box(
            f"{prefix} recessed vertical pull {index}",
            (pull_x, y - 0.016, (bottom + top) / 2.0),
            (0.030, 0.014, min(0.210, height * 0.32)),
            m["shadow"],
            bevel=0.006,
            category="pull",
        )
        furniture.add_box(
            f"{prefix} satin pull insert {index}",
            (pull_x, y - 0.018, (bottom + top) / 2.0),
            (0.010, 0.008, min(0.175, height * 0.27)),
            m["aluminum"],
            bevel=0.003,
            category="pull",
        )
    furniture.add_box(
        f"{prefix} central overlap seam",
        (0.0, front_y - 0.020, (bottom + top) / 2.0),
        (0.006, 0.006, height - 0.035),
        m["shadow"],
        bevel=0.001,
        category="door seam",
    )
    furniture.add_cylinder(
        f"{prefix} central lock barrel",
        (0.0, front_y - 0.024, top - 0.115),
        0.014,
        0.016,
        m["zinc"],
        axis=(0.0, -1.0, 0.0),
        vertices=32,
        bevel=0.002,
        category="lock",
    )
    furniture.add_box(
        f"{prefix} lock keyway",
        (0.0, front_y - 0.034, top - 0.115),
        (0.004, 0.003, 0.013),
        m["black"],
        bevel=0.001,
        category="lock",
    )


def build_sliding_door_cabinet(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    add_sliding_shell(spec, shell_material=m["powder_light"], inner_material=m["interior"])
    for z in (0.38, 0.69, 0.98):
        furniture.add_box(
            f"Adjustable internal shelf {z:.2f}",
            (0.0, 0.015, z),
            (spec.width - 0.075, spec.depth - 0.085, 0.024),
            m["interior"],
            bevel=0.004,
            category="shelf",
        )
    add_sliding_tracks(spec, 0.125, 1.145)
    add_steel_sliding_pair(spec, "Steel cabinet", 0.145, 1.125, m["powder_light"])
    add_rear_panel_fasteners(spec)
    furniture.ROOT["reference_anatomy"] = (
        "two-panel steel sliding cabinet, overlapping folded doors, recessed pulls, lock and adjustable shelves"
    )


def add_framed_glass_slider(
    name: str,
    x: float,
    y: float,
    width: float,
    bottom: float,
    top: float,
    pull_side: float,
) -> None:
    m = furniture.MATERIALS
    height = top - bottom
    furniture.add_box(
        f"{name} glass pane",
        (x, y, (bottom + top) / 2.0),
        (width - 0.038, 0.011, height - 0.045),
        m["glass"],
        bevel=0.002,
        category="glazing",
    )
    for side in (-1.0, 1.0):
        furniture.add_box(
            f"{name} vertical frame {side:+.0f}",
            (x + side * (width / 2.0 - 0.013), y - 0.002, (bottom + top) / 2.0),
            (0.026, 0.024, height),
            m["aluminum"],
            bevel=0.003,
            category="door frame",
        )
    for z in (bottom, top):
        furniture.add_box(
            f"{name} horizontal frame {z:.2f}",
            (x, y - 0.002, z),
            (width, 0.024, 0.026),
            m["aluminum"],
            bevel=0.003,
            category="door frame",
        )
    furniture.add_vertical_door_pull(
        name,
        x + pull_side * (width / 2.0 - 0.042),
        y + 0.004,
        (bottom + top) / 2.0,
        -1.0,
        projection=0.016,
    )


def build_glazed_sliding_cabinet(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    add_sliding_shell(spec, shell_material=m["powder_light"], inner_material=m["interior"])
    split = 1.045
    furniture.add_box(
        "Glazed cabinet structural division rail",
        (0.0, 0.0, split),
        (spec.width - 0.035, spec.depth - 0.025, 0.055),
        m["aluminum"],
        bevel=0.005,
        category="carcass rail",
    )
    for z in (0.35, 0.67, 1.30, 1.61):
        furniture.add_box(
            f"Tall cabinet adjustable shelf {z:.2f}",
            (0.0, 0.012, z),
            (spec.width - 0.072, spec.depth - 0.082, 0.022),
            m["interior" if z < split else "frosted"],
            bevel=0.004,
            category="shelf",
        )
    add_sliding_tracks(spec, 0.125, split - 0.035)
    add_steel_sliding_pair(spec, "Lower steel", 0.145, split - 0.055, m["powder_light"])
    add_sliding_tracks(spec, split + 0.035, 1.945)
    width = spec.width * 0.545
    front_y = -spec.depth / 2.0 + 0.036
    add_framed_glass_slider(
        "Upper glass left",
        -spec.width * 0.225,
        front_y,
        width,
        split + 0.055,
        1.925,
        1.0,
    )
    add_framed_glass_slider(
        "Upper glass right",
        spec.width * 0.225,
        front_y - 0.012,
        width,
        split + 0.055,
        1.925,
        -1.0,
    )
    for row, z in enumerate((0.35, 0.67, 1.30, 1.61), 1):
        for column, x in enumerate((-0.235, 0.0, 0.235), 1):
            furniture.add_box(
                f"Visible storage bin {row}-{column}",
                (x, -0.015, z + 0.060),
                (0.190, 0.275, 0.100),
                m["label" if (row + column) % 2 else "blue"],
                bevel=0.010,
                category="storage bin",
            )
    add_rear_panel_fasteners(spec, rows=4)
    furniture.ROOT["reference_anatomy"] = (
        "upper overlapping framed-glass sliders, lower overlapping steel sliders, visible shelves and removable bins"
    )


def build_laboratory_drying_rack(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    # Full-width back panel and trough establish exact bounds and a credible
    # stainless wall-hung construction with rear mounting clearance.
    furniture.add_box(
        "Drying rack stainless back plate",
        (0.0, 0.137, 0.635),
        (spec.width, 0.046, 1.130),
        m["stainless_bright"],
        bevel=0.008,
        category="back plate",
    )
    furniture.add_box(
        "Drying rack lower drain trough",
        (0.0, -0.035, 0.045),
        (spec.width, 0.250, 0.090),
        m["stainless"],
        bevel=0.007,
        category="drain trough",
    )
    furniture.add_box(
        "Drying rack trough front lip",
        (0.0, -0.150, 0.094),
        (spec.width - 0.020, 0.020, 0.105),
        m["stainless_bright"],
        bevel=0.004,
        category="drain trough",
    )
    furniture.add_cylinder(
        "Drying rack drain outlet",
        (0.275, 0.010, 0.014),
        0.018,
        0.030,
        m["stainless_dark"],
        vertices=40,
        bevel=0.002,
        category="drain",
    )
    for row in range(5):
        z = 0.240 + row * 0.195
        for column in range(3):
            x = -0.235 + column * 0.235 + (0.045 if row % 2 else 0.0)
            furniture.add_box(
                f"Peg mounting block {row + 1}-{column + 1}",
                (x, 0.108, z),
                (0.050, 0.038, 0.050),
                m["powder_light"],
                bevel=0.006,
                category="peg mount",
            )
            furniture.add_cylinder(
                f"Drying peg {row + 1}-{column + 1}",
                (x, -0.006, z + 0.086),
                0.012,
                0.286,
                m["powder_light"],
                axis=(0.0, -0.78, 0.63),
                vertices=32,
                bevel=0.002,
                category="drying peg",
            )
    for x in (-0.295, 0.295):
        for z in (0.160, 1.090):
            furniture.add_face_fastener(
                f"Wall fixing {x:+.3f} {z:.3f}", x, 0.155, z, 1.0, m["zinc"]
            )
    storage.add_material_witnesses(spec)
    furniture.ROOT["reference_anatomy"] = (
        "stainless wall drying rack, fifteen inclined polymer pegs, lower drain trough, outlet and rear wall fixings"
    )


def build_lab_freezer(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    # Casters and adjustable feet carry the insulated shell above floor level.
    for index, x in enumerate((-0.295, 0.295), 1):
        for y in (-0.315, 0.315):
            furniture.add_cylinder(
                f"Freezer caster wheel {index} {y:+.3f}",
                (x, y, 0.040),
                0.040,
                0.040,
                m["rubber"],
                axis=(1.0, 0.0, 0.0),
                vertices=36,
                bevel=0.003,
                category="caster",
            )
            furniture.add_box(
                f"Freezer caster yoke {index} {y:+.3f}",
                (x, y, 0.078),
                (0.060, 0.030, 0.060),
                m["zinc"],
                bevel=0.005,
                category="caster",
            )
    furniture.add_box(
        "Biomedical freezer insulated shell",
        (0.0, 0.030, 1.045),
        (spec.width, 0.740, 1.910),
        m["powder_light"],
        bevel=0.022,
        category="insulated cabinet",
    )
    furniture.add_box(
        "Freezer rear condenser service plane",
        (0.0, 0.390, 1.020),
        (spec.width - 0.075, 0.016, 1.650),
        m["powder_dark"],
        bevel=0.005,
        category="rear service panel",
    )
    for index in range(12):
        x = -0.285 + index * 0.052
        furniture.add_cylinder(
            f"Rear condenser tube {index + 1}",
            (x, 0.396, 1.050),
            0.004,
            1.480,
            m["stainless_dark"],
            vertices=18,
            category="rear condenser",
        )
    for z in (0.34, 0.60, 0.86, 1.12, 1.38, 1.64):
        furniture.add_box(
            f"Rear condenser cross rail {z:.2f}",
            (0.0, 0.396, z),
            (0.640, 0.008, 0.012),
            m["stainless_dark"],
            bevel=0.002,
            category="rear condenser",
        )

    # Single thick door, gasket, left latch, and top control fascia follow the
    # supplied MDF-U731M-class reference while remaining original and logo-free.
    furniture.add_box(
        "Freezer magnetic door gasket",
        (0.0, -0.347, 0.986),
        (0.682, 0.018, 1.555),
        m["black"],
        bevel=0.009,
        category="door gasket",
    )
    furniture.add_box(
        "Freezer insulated single door",
        (0.0, -0.359, 0.986),
        (0.704, 0.018, 1.535),
        m["powder_light"],
        bevel=0.016,
        category="insulated door",
    )
    furniture.add_box(
        "Freezer upper control fascia",
        (0.0, -0.359, 1.812),
        (0.650, 0.022, 0.235),
        m["powder"],
        bevel=0.015,
        category="control fascia",
    )
    furniture.add_box(
        "Freezer control display bezel",
        (-0.070, -0.375, 1.814),
        (0.260, 0.010, 0.105),
        m["powder_dark"],
        bevel=0.009,
        category="display",
    )
    furniture.add_box(
        "Freezer green temperature display",
        (-0.070, -0.382, 1.820),
        (0.125, 0.005, 0.046),
        m["green"],
        bevel=0.004,
        category="display",
    )
    for index in range(5):
        furniture.add_cylinder(
            f"Freezer fascia key {index + 1}",
            (-0.170 + index * 0.055, -0.385, 1.770),
            0.010,
            0.008,
            m["blue" if index == 2 else "black"],
            axis=(0.0, -1.0, 0.0),
            vertices=28,
            bevel=0.001,
            category="control key",
        )
    furniture.add_box(
        "Freezer original blue identity field",
        (-0.235, -0.375, 1.925),
        (0.170, 0.008, 0.052),
        m["blue"],
        bevel=0.005,
        category="identity",
    )
    furniture.add_box(
        "Freezer left latch body",
        (-0.336, -0.373, 0.995),
        (0.062, 0.050, 0.175),
        m["powder"],
        bevel=0.011,
        category="latch",
    )
    furniture.add_box(
        "Freezer latch grip",
        (-0.342, -0.391, 0.995),
        (0.036, 0.018, 0.100),
        m["powder_light"],
        bevel=0.008,
        category="latch",
    )
    furniture.add_cylinder(
        "Freezer latch lock barrel",
        (-0.342, -0.395, 0.960),
        0.010,
        0.009,
        m["zinc"],
        axis=(0.0, -1.0, 0.0),
        vertices=28,
        bevel=0.001,
        category="lock",
    )
    # Side compressor ventilation and rear power cable.
    for index in range(8):
        furniture.add_box(
            f"Freezer side compressor vent {index + 1}",
            (0.371, 0.200 - index * 0.050, 0.210),
            (0.006, 0.030, 0.075),
            m["shadow"],
            bevel=0.002,
            category="ventilation",
        )
    casework.add_curve_tube(
        "Freezer rear mains cable",
        [(0.250, 0.390, 0.215), (0.315, 0.394, 0.160), (0.345, 0.388, 0.085), (0.340, 0.350, 0.025)],
        0.006,
        m["rubber"],
        category="power cable",
    )
    storage.add_material_witnesses(spec)
    furniture.ROOT["reference_anatomy"] = (
        "PHCbi MDF-U731M-class single-door biomedical freezer, top controls, left latch, casters, side vents and rear condenser"
    )


def build_solvent_cabinet(spec: AssetSpec) -> None:
    m = furniture.MATERIALS
    add_sliding_shell(spec, shell_material=m["powder_dark"], inner_material=m["interior"])
    for z in (0.36, 0.68, 0.96):
        furniture.add_box(
            f"Solvent containment shelf {z:.2f}",
            (0.0, 0.012, z),
            (spec.width - 0.075, spec.depth - 0.085, 0.030),
            m["stainless"],
            bevel=0.005,
            category="containment shelf",
        )
        furniture.add_box(
            f"Solvent shelf spill lip {z:.2f}",
            (0.0, -spec.depth / 2.0 + 0.060, z + 0.024),
            (spec.width - 0.100, 0.022, 0.048),
            m["stainless_bright"],
            bevel=0.003,
            category="spill lip",
        )
    add_sliding_tracks(spec, 0.125, 1.145)
    add_steel_sliding_pair(spec, "Solvent", 0.145, 1.125, m["powder_light"])
    for side in (-1.0, 1.0):
        furniture.add_box(
            f"Solvent cabinet side vent {side:+.0f}",
            (side * (spec.width / 2.0 - 0.004), 0.115, 0.215),
            (0.008, 0.180, 0.090),
            m["shadow"],
            bevel=0.003,
            category="ventilation",
        )
    furniture.add_box(
        "Solvent warning label field",
        (0.0, -spec.depth / 2.0 + 0.004, 1.065),
        (0.250, 0.004, 0.072),
        m["label"],
        bevel=0.004,
        category="safety label",
    )
    furniture.add_box(
        "Solvent warning red stripe",
        (-0.105, -spec.depth / 2.0 + 0.001, 1.065),
        (0.018, 0.002, 0.054),
        m["red"],
        bevel=0.001,
        category="safety label",
    )
    add_rear_panel_fasteners(spec)
    furniture.ROOT["reference_anatomy"] = (
        "compact dark-side solvent cabinet, light sliding doors, lock, spill shelves, side vents and warning field"
    )


BUILDERS = {
    "sliding-door-cabinet": build_sliding_door_cabinet,
    "glazed-sliding-cabinet": build_glazed_sliding_cabinet,
    "laboratory-drying-rack": build_laboratory_drying_rack,
    "lab-freezer": build_lab_freezer,
    "solvent-cabinet": build_solvent_cabinet,
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
    if spec.asset_id not in {"laboratory-drying-rack", "lab-freezer"}:
        storage.add_material_witnesses(spec)

    if furniture.ROOT is not None:
        furniture.ROOT["display_name"] = spec.asset_id.replace("-", " ").title()
        furniture.ROOT["planning_model"] = True
        furniture.ROOT["manufacturer_certified"] = False
        furniture.ROOT["revision"] = "product-reference-r5"
        furniture.ROOT["source_note"] = (
            "Original LabSpace geometry informed by the supplied 2026-07-17 product "
            "references and conservative laboratory construction; no logos or downloaded geometry."
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
    print("LABSPACE_STORAGE_BATCH5_BUILD " + json.dumps(results, sort_keys=True))


if __name__ == "__main__":
    main()
