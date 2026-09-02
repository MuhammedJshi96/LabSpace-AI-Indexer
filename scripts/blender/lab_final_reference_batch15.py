"""Author and export the final Blender reference trio.

The hotplate and analytical balance are created here.  The GPU workstation is
rebuilt through the established batch-14 product pipeline because its editable
source and validated joined construction already live there.

Usage::

    .tools/blender-4.5.11-windows-x64/blender.exe --background --factory-startup \
      --python scripts/blender/lab_final_reference_batch15.py -- \
      --output-dir artifacts/staging/final-reference-r13/models \
      --save-blend-dir assets/blender/final-reference-r13
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import batch14_source_pbr as source_pbr
import lab_casework_batch3 as casework
import lab_diversity_batch14 as product_pipeline
import lab_furniture as f
import final_reference_products as products


ASSETS = {
    "hotplate-stirrer": f.AssetSpec("hotplate-stirrer", .200, .260, .420),
    "analytical-balance": f.AssetSpec("analytical-balance", .210, .320, .310),
}
SOURCE_REVISION = "final-reference-product-source-r1"
RUNTIME_REVISION = "final-reference-r13"


def add_materials() -> None:
    product_pipeline.add_materials()
    make = f.make_material
    f.MATERIALS.update({
        "hotplate_navy": make(
            "Hotplate deep blue-grey powder coat", (.055, .075, .100, 1),
            metallic=.04, roughness=.31, coat=.16, coat_roughness=.14,
        ),
        "hotplate_panel": make(
            "Recessed graphite control fascia", (.060, .071, .085, 1),
            metallic=.02, roughness=.30, coat=.13,
        ),
        "ceramic_white": make(
            "White ceramic coated aluminium plate", (.78, .80, .78, 1),
            metallic=.02, roughness=.25, coat=.22, coat_roughness=.11,
        ),
        "balance_white": make(
            "Analytical balance pearl-white enclosure", (.70, .72, .70, 1),
            metallic=.01, roughness=.31, coat=.19, coat_roughness=.12,
        ),
        "balance_graphite": make(
            "Analytical balance graphite plinth", (.070, .080, .083, 1),
            metallic=.01, roughness=.43,
        ),
        "balance_tare": make(
            "Analytical balance blue tare key", (.025, .18, .48, 1),
            metallic=0, roughness=.28, coat=.16,
        ),
        "display_red": make(
            "Hotplate red LED phosphor", (.92, .025, .012, 1),
            metallic=0, roughness=.19, coat=.08,
        ),
        "display_white": make(
            "Balance white LCD phosphor", (.82, .92, .91, 1),
            metallic=0, roughness=.20, coat=.08,
        ),
        "status_green": make(
            "Green status indicator", (.16, .68, .04, 1),
            metallic=0, roughness=.20, coat=.20,
        ),
        "status_amber": make(
            "Amber status indicator", (.86, .16, .025, 1),
            metallic=0, roughness=.20, coat=.20,
        ),
    })
    for key in ("display_red", "display_white", "status_green", "status_amber"):
        material = f.MATERIALS[key]
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if bsdf is not None:
            color = material.diffuse_color
            f.set_socket(bsdf, "Emission Color", color)
            f.set_socket(bsdf, "Emission Strength", .75 if "display" in key else .35)
    f.MATERIALS["balance_glass"] = casework.make_transmissive_material(
        "Analytical balance low-iron blue-edge glass", (.72, .90, .92, 1), .92, .035
    )
    for material in f.MATERIALS.values():
        material.use_backface_culling = True


def save_source(spec: f.AssetSpec, directory: Path) -> Path:
    assert f.ROOT is not None
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{spec.asset_id}.blend"
    f.ROOT["source_format"] = "blend"
    f.ROOT["source_revision"] = SOURCE_REVISION
    f.ROOT["source_authoring_tool"] = "Blender 4.5 LTS"
    f.ROOT["source_preserves_part_hierarchy"] = True
    f.ROOT["source_preserves_unapplied_bevels"] = True
    f.ROOT["runtime_artifact"] = f"public/models/hero/{spec.asset_id}.glb"
    bpy.context.scene["source_revision"] = SOURCE_REVISION
    bpy.context.scene["runtime_revision"] = RUNTIME_REVISION
    bpy.context.scene["reference_policy"] = (
        "User-supplied multi-view sheet defines visible form, proportions and finish; "
        "hidden service construction is conservative, original and logo-free."
    )
    bpy.context.preferences.filepaths.save_version = 0
    result = bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    if "FINISHED" not in result or not path.exists():
        raise RuntimeError(f"Failed to save editable Blender source: {path}")
    return path


def build_one(spec: f.AssetSpec, output_dir: Path, source_dir: Path) -> dict[str, object]:
    f.reset_scene(spec.asset_id)
    f.create_root(spec)
    add_materials()
    products.BUILDERS[spec.asset_id](spec)
    source_pbr_report = source_pbr.apply(f)
    assert f.ROOT is not None
    f.ROOT["display_name"] = spec.asset_id.replace("-", " ").title()
    f.ROOT["revision"] = RUNTIME_REVISION
    f.ROOT["authored_form_revision"] = "final-reference-sheet-product-r1"
    f.ROOT["source_pbr_revision"] = source_pbr.REVISION
    f.ROOT["source_pbr_materials"] = source_pbr_report["appliedCount"]
    f.ROOT["planning_model"] = True
    f.ROOT["manufacturer_certified"] = False
    f.ROOT["all_sided_product_model"] = True
    f.ROOT["source_note"] = (
        "Original logo-free LabSpace Blender geometry authored from the user-supplied "
        "September 2, 2026 reference sheet; no downloaded product mesh."
    )
    source_stats = product_pipeline.fit_authored_source(spec)
    f.ROOT["authored_bounds_m"] = source_stats["bounds_m"]["dimensions"]
    f.ROOT["source_mesh_parts"] = source_stats["mesh_objects"]
    f.ROOT["pbr_materials"] = source_stats["materials"]
    product_pipeline.organize_source_scene()
    source_path = save_source(spec, source_dir)

    batches = f.consolidate_static_meshes_by_material()
    runtime_stats = f.authored_statistics(spec)
    f.validate_statistics(spec, runtime_stats, imported=False)
    f.ROOT["mesh_parts"] = runtime_stats["mesh_objects"]
    f.ROOT["source_part_count"] = batches["source_parts"]
    f.ROOT["runtime_material_batches"] = batches["runtime_batches"]
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / f"{spec.asset_id}.glb"
    f.export_glb(path)
    imported = f.inspect_export(spec, path)
    imported["editable_source"] = str(source_path)
    imported["source_scene"] = source_stats
    imported["runtime_scene"] = runtime_stats
    imported["batching"] = batches
    return imported


def main() -> None:
    raw = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", action="append", choices=sorted(ASSETS), default=[])
    parser.add_argument("--output-dir", type=Path, default=Path("public/models/hero"))
    parser.add_argument(
        "--save-blend-dir", type=Path,
        default=Path("assets/blender/final-reference-r13"),
    )
    options = parser.parse_args(raw)
    selected = options.asset or list(ASSETS)
    results = [
        build_one(
            ASSETS[asset_id], options.output_dir.resolve(), options.save_blend_dir.resolve()
        )
        for asset_id in selected
    ]
    print("LABSPACE_FINAL_REFERENCE_BATCH15 " + json.dumps(results, sort_keys=True))


if __name__ == "__main__":
    main()
