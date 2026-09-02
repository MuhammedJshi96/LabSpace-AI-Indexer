"""Audit batch-14 source shells for actual construction failures.

This is deliberately not another bounds/contact checker.  It evaluates the
editable Blender source after modifiers and reports defects that can produce
visible background leaks, broken manufactured joints, or false PBR claims:

* open boundary edges on parts explicitly authored as exterior shells;
* true BVH surface gaps in product-module functional-joint contracts;
* unintended alpha/transmission in products declared opaque;
* missing linked image textures on source PBR normal/roughness/color inputs;
* triangle intersections between independently modelled formed-rim members.

Run with Blender, for example::

    .tools/blender-4.5.11-windows-x64/blender.exe --background \
      --python scripts/blender/audit_batch14_shells.py -- \
      --source-dir assets/blender/batch14

The source files are opened read-only and are never saved.
"""

from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import dataclass
import importlib
import json
import sys
from pathlib import Path
from types import ModuleType

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
if str(SCRIPT_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIRECTORY))

import lab_diversity_batch14 as batch14  # noqa: E402


MAX_FUNCTIONAL_JOINT_GAP_M = 0.002
MAX_REPORTED_PARTS = 12

# New product modules are isolated from the batch orchestrator so they can be
# integrated or rolled back independently.  When a module is present, its own
# CONTACT_PAIRS are the continuity source of truth for the saved editable scene.
PRODUCT_MODULES: dict[str, str] = {
    "electronic-pipette-station": "batch14_pipette_product",
    "automated-microplate-reader": "batch14_reader_product",
    "gpu-analysis-workstation": "batch14_gpu_workstation_product",
    "compact-ink-tank-printer": "batch14_printer_products",
    "high-volume-multifunction-printer": "batch14_printer_products",
    "ultrasonic-cleaner": "batch14_cleaner_product",
}

# Physical transmission is exceptional and reference-scoped.  This allowlist
# prevents a generic glass material from leaking back onto opaque instruments
# while preserving the supplied GPU tower's one real tempered side window.
NONOPAQUE_MATERIAL_ALLOWLIST = {
    ("gpu-analysis-workstation", "Smoked tempered computer side panel"),
}

PBR_PRINCIPLED_INPUTS = {
    "Base Color",
    "Metallic",
    "Roughness",
    "Normal",
    "Coat Weight",
    "Coat Roughness",
    "Anisotropic IOR Level",
}

# Only semantic parts that are expected to be closed manufactured volumes are
# checked for boundary edges.  Decals, glass sheets, labels, open tanks, cables,
# screens and deliberately open working apertures are intentionally excluded.
SEALED_CATEGORY_TERMS = (
    "enclosure",
    "formed shell",
    "structural chassis",
    "molded chassis",
    "cabinet shell",
    "scanner deck",
    "scanner lid",
    "desktop",
    "worktop",
    "table top",
    "pipette body",
    "closed triangular a-frame end",
)
SEALED_NAME_TERMS = (
    "structural chassis",
    "formed upper shell",
    "freezer outer cabinet",
    "freezer lid shell",
    "printer main shell",
    "printer lower shell",
    "printer upper shell",
    "desktop core",
    "utility table top",
)


@dataclass
class EvaluatedMesh:
    name: str
    vertices: list[Vector]
    polygons: list[tuple[int, ...]]
    boundary_edges: int
    nonmanifold_edges: int
    bvh: BVHTree
    samples: list[Vector]


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=Path("assets/blender/batch14"),
        help="Directory containing the editable batch-14 .blend sources.",
    )
    parser.add_argument(
        "--asset",
        action="append",
        choices=list(batch14.ASSETS),
        default=[],
        help="Audit one asset; repeat to select several. Defaults to all.",
    )
    parser.add_argument(
        "--max-joint-gap-mm",
        type=float,
        default=MAX_FUNCTIONAL_JOINT_GAP_M * 1000.0,
        help="Maximum real surface gap for functional joint contracts.",
    )
    return parser.parse_args(argv)


def source_name(obj: bpy.types.Object) -> str:
    """Return an authored name without Blender's numeric duplicate suffix."""

    head, separator, tail = obj.name.rpartition(".")
    return head if separator and tail.isdigit() else obj.name


def is_sealed_exterior(obj: bpy.types.Object) -> bool:
    category = str(obj.get("part_category", "")).casefold()
    name = source_name(obj).casefold()
    return any(term in category for term in SEALED_CATEGORY_TERMS) or any(
        term in name for term in SEALED_NAME_TERMS
    )


def evaluated_mesh(obj: bpy.types.Object, depsgraph) -> EvaluatedMesh:
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh(preserve_all_data_layers=False, depsgraph=depsgraph)
    try:
        transform = evaluated.matrix_world
        vertices = [transform @ vertex.co for vertex in mesh.vertices]
        polygons = [tuple(polygon.vertices) for polygon in mesh.polygons]
        edge_use: Counter[tuple[int, int]] = Counter()
        samples = list(vertices)
        for polygon in polygons:
            for index, first in enumerate(polygon):
                second = polygon[(index + 1) % len(polygon)]
                edge_use[tuple(sorted((first, second)))] += 1
            center = Vector((0.0, 0.0, 0.0))
            for index in polygon:
                center += vertices[index]
            if polygon:
                samples.append(center / len(polygon))
        boundary_edges = sum(uses == 1 for uses in edge_use.values())
        nonmanifold_edges = sum(uses != 2 for uses in edge_use.values())
        bvh = BVHTree.FromPolygons(vertices, polygons, all_triangles=False)
        return EvaluatedMesh(
            name=obj.name,
            vertices=vertices,
            polygons=polygons,
            boundary_edges=boundary_edges,
            nonmanifold_edges=nonmanifold_edges,
            bvh=bvh,
            samples=samples,
        )
    finally:
        evaluated.to_mesh_clear()


def minimum_surface_distance(first: EvaluatedMesh, second: EvaluatedMesh) -> float:
    """Return a symmetric sampled surface distance, never an AABB distance."""

    distance = float("inf")
    for sample in first.samples:
        hit = second.bvh.find_nearest(sample)
        if hit is not None:
            distance = min(distance, float(hit[3]))
    for sample in second.samples:
        hit = first.bvh.find_nearest(sample)
        if hit is not None:
            distance = min(distance, float(hit[3]))
    return distance


def evaluated_bvh_gap(
    first: EvaluatedMesh,
    second: EvaluatedMesh,
) -> tuple[float, int]:
    """Return the real evaluated contact gap and triangle-overlap evidence.

    ``minimum_surface_distance`` samples actual evaluated surfaces, but a deep
    positive-bearing joint can intersect between those sample positions.  BVH
    triangle overlap is stronger evidence of contact, so an overlap is a zero
    gap; otherwise the symmetric evaluated-surface distance is returned.
    """

    overlaps = first.bvh.overlap(second.bvh)
    if overlaps:
        return 0.0, len(overlaps)
    return minimum_surface_distance(first, second), 0


def _optional_product_module(asset_id: str) -> ModuleType | None:
    module_name = PRODUCT_MODULES.get(asset_id)
    if module_name is None or not (SCRIPT_DIRECTORY / f"{module_name}.py").is_file():
        return None
    return importlib.import_module(module_name)


def module_joint_contracts(asset_id: str) -> tuple[str | None, list[tuple[str, str, str]]]:
    """Normalize an isolated product module's two- or three-field contracts."""

    module = _optional_product_module(asset_id)
    if module is None:
        return None, []
    raw = getattr(module, "CONTACT_PAIRS", ())
    if isinstance(raw, dict):
        entries = raw.get(asset_id, ())
    else:
        entries = raw
    normalized: list[tuple[str, str, str]] = []
    for index, entry in enumerate(entries, start=1):
        if len(entry) == 3:
            label, left_name, right_name = entry
        elif len(entry) == 2:
            left_name, right_name = entry
            label = f"module-contact-{index:03d}"
        else:
            raise RuntimeError(
                f"{module.__name__}.CONTACT_PAIRS entry {index} must contain "
                f"two or three strings, received {entry!r}"
            )
        normalized.append((str(label), str(left_name), str(right_name)))
    return module.__name__, normalized


def _principled(material: bpy.types.Material) -> bpy.types.Node | None:
    if not material.use_nodes or material.node_tree is None:
        return None
    return next(
        (node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"),
        None,
    )


def _material_opacity(material: bpy.types.Material) -> dict[str, object]:
    diffuse_alpha = (
        float(material.diffuse_color[3]) if len(material.diffuse_color) > 3 else 1.0
    )
    alpha = diffuse_alpha
    transmission = 0.0
    alpha_linked = False
    transmission_linked = False
    bsdf = _principled(material)
    if bsdf is not None:
        alpha_socket = bsdf.inputs.get("Alpha")
        transmission_socket = (
            bsdf.inputs.get("Transmission Weight")
            or bsdf.inputs.get("Transmission")
        )
        if alpha_socket is not None:
            alpha_linked = bool(alpha_socket.is_linked)
            if not alpha_linked:
                alpha = min(alpha, float(alpha_socket.default_value))
        if transmission_socket is not None:
            transmission_linked = bool(transmission_socket.is_linked)
            transmission = (
                1.0
                if transmission_linked
                else float(transmission_socket.default_value)
            )
    opaque = (
        diffuse_alpha >= 0.999
        and alpha >= 0.999
        and transmission <= 0.001
        and not alpha_linked
        and not transmission_linked
    )
    return {
        "material": material.name,
        "diffuseAlpha": round(diffuse_alpha, 6),
        "principledAlpha": round(alpha, 6),
        "transmission": round(transmission, 6),
        "alphaLinked": alpha_linked,
        "transmissionLinked": transmission_linked,
        "opaque": opaque,
    }


def used_materials(objects: list[bpy.types.Object]) -> list[bpy.types.Material]:
    by_name: dict[str, bpy.types.Material] = {}
    for obj in objects:
        if not hasattr(obj.data, "materials"):
            continue
        for material in obj.data.materials:
            if material is not None:
                by_name[material.name_full] = material
    return [by_name[name] for name in sorted(by_name, key=str.casefold)]


def _downstream_principled_inputs(
    material: bpy.types.Material,
    start: bpy.types.Node,
) -> set[str]:
    """Trace an image node to the Principled inputs it actually influences."""

    assert material.node_tree is not None
    queue = [start]
    visited: set[int] = set()
    targets: set[str] = set()
    while queue:
        node = queue.pop()
        identity = node.as_pointer()
        if identity in visited:
            continue
        visited.add(identity)
        for output in node.outputs:
            for link in output.links:
                destination = link.to_node
                if destination.type == "BSDF_PRINCIPLED":
                    targets.add(link.to_socket.name)
                else:
                    queue.append(destination)
    return targets


def _image_source_present(image: bpy.types.Image | None) -> bool:
    if image is None:
        return False
    if image.packed_file is not None or image.source == "GENERATED":
        return True
    path = Path(bpy.path.abspath(image.filepath_raw or image.filepath))
    return path.is_file()


def source_pbr_texture_report(
    materials: list[bpy.types.Material],
) -> dict[str, object]:
    """Report image textures that reach physical Principled shader inputs."""

    image_nodes: list[dict[str, object]] = []
    linked_pbr: list[dict[str, object]] = []
    missing_sources: list[dict[str, object]] = []
    for material in materials:
        if not material.use_nodes or material.node_tree is None:
            continue
        for node in material.node_tree.nodes:
            if node.type != "TEX_IMAGE":
                continue
            targets = sorted(_downstream_principled_inputs(material, node))
            source_present = _image_source_present(node.image)
            record = {
                "material": material.name,
                "node": node.name,
                "image": node.image.name if node.image is not None else None,
                "sourcePresent": source_present,
                "packed": bool(node.image and node.image.packed_file),
                "principledInputs": targets,
            }
            image_nodes.append(record)
            if not source_present:
                missing_sources.append(record)
            if source_present and PBR_PRINCIPLED_INPUTS.intersection(targets):
                linked_pbr.append(record)
    return {
        "imageTextureNodeCount": len(image_nodes),
        "linkedPbrImageTextureCount": len(linked_pbr),
        "missingImageSourceCount": len(missing_sources),
        "imageTextures": image_nodes,
        "linkedPbrImageTextures": linked_pbr,
        "missingImageSources": missing_sources,
        "passed": bool(linked_pbr) and not missing_sources,
    }


def pipette_joint_contracts(
    objects: list[bpy.types.Object],
) -> list[tuple[str, bpy.types.Object, bpy.types.Object | None]]:
    """Build attachment contracts for every top control on the pipette rack."""

    by_source = {source_name(obj): obj for obj in objects}
    contracts: list[tuple[str, bpy.types.Object, bpy.types.Object | None]] = []
    control_suffixes = (
        " plunger cap",
        " top control",
        " dose selector",
    )
    for authored_name, control in sorted(by_source.items()):
        suffix = next(
            (candidate for candidate in control_suffixes if authored_name.endswith(candidate)),
            None,
        )
        if suffix is None:
            continue
        prefix = authored_name[: -len(suffix)]
        partner_names: list[str]
        if suffix == " plunger cap" and f"{prefix} plunger stem" in by_source:
            partner_names = [f"{prefix} plunger stem"]
        elif "manual" in prefix:
            partner_names = [f"{prefix} contoured white body"]
        elif "electronic" in prefix:
            partner_names = [f"{prefix} electronic white body"]
        elif "repeater" in prefix:
            partner_names = [f"{prefix} repeater formed body"]
        else:
            partner_names = [f"{prefix} multichannel formed body"]
        partner = next((by_source[name] for name in partner_names if name in by_source), None)
        contracts.append((f"{authored_name} attachment", control, partner))
    return contracts


def audit(asset_id: str, source_dir: Path, max_joint_gap: float) -> dict[str, object]:
    path = (source_dir / f"{asset_id}.blend").resolve()
    if not path.exists():
        raise RuntimeError(f"{asset_id}: missing source {path}")
    result = bpy.ops.wm.open_mainfile(filepath=str(path), load_ui=False)
    if "FINISHED" not in result:
        raise RuntimeError(f"{asset_id}: Blender could not open {path}")

    depsgraph = bpy.context.evaluated_depsgraph_get()
    objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    cache: dict[str, EvaluatedMesh] = {}

    def geometry(obj: bpy.types.Object) -> EvaluatedMesh:
        if obj.name not in cache:
            cache[obj.name] = evaluated_mesh(obj, depsgraph)
        return cache[obj.name]

    errors: list[str] = []
    open_parts: list[dict[str, object]] = []
    for obj in objects:
        if not is_sealed_exterior(obj):
            continue
        surface = geometry(obj)
        if surface.boundary_edges == 0:
            continue
        open_parts.append(
            {
                "part": obj.name,
                "boundaryEdges": surface.boundary_edges,
                "nonmanifoldEdges": surface.nonmanifold_edges,
            }
        )
    if open_parts:
        preview = "; ".join(
            f"{record['part']} ({record['boundaryEdges']} boundary edges)"
            for record in open_parts[:MAX_REPORTED_PARTS]
        )
        errors.append(f"open exterior volumes: {preview}")

    disconnected_joints: list[dict[str, object]] = []
    missing_joint_parts: list[str] = []
    joint_records: list[dict[str, object]] = []
    module_name, declared_contracts = module_joint_contracts(asset_id)
    by_source: dict[str, list[bpy.types.Object]] = {}
    for obj in objects:
        by_source.setdefault(source_name(obj), []).append(obj)

    if declared_contracts:
        for label, left_name, right_name in declared_contracts:
            left_objects = by_source.get(left_name, [])
            right_objects = by_source.get(right_name, [])
            if not left_objects or not right_objects:
                missing = []
                if not left_objects:
                    missing.append(left_name)
                if not right_objects:
                    missing.append(right_name)
                missing_joint_parts.append(f"{label}: {', '.join(missing)}")
                joint_records.append(
                    {
                        "joint": label,
                        "left": left_name,
                        "right": right_name,
                        "missing": missing,
                        "passed": False,
                    }
                )
                continue

            # Validate every duplicated authored instance in both directions.
            # A long shared beam may legitimately bear several named parts; it
            # therefore only needs one real contact per instance.
            gaps: list[float] = []
            triangle_overlaps = 0
            for left in left_objects:
                candidates = [
                    evaluated_bvh_gap(geometry(left), geometry(right))
                    for right in right_objects
                    if right != left
                ]
                if candidates:
                    gap, overlaps = min(candidates, key=lambda item: item[0])
                    gaps.append(gap)
                    triangle_overlaps = max(triangle_overlaps, overlaps)
            for right in right_objects:
                candidates = [
                    evaluated_bvh_gap(geometry(right), geometry(left))
                    for left in left_objects
                    if left != right
                ]
                if candidates:
                    gap, overlaps = min(candidates, key=lambda item: item[0])
                    gaps.append(gap)
                    triangle_overlaps = max(triangle_overlaps, overlaps)
            maximum_gap = max(gaps, default=float("inf"))
            record = {
                "joint": label,
                "left": left_name,
                "right": right_name,
                "leftInstances": len(left_objects),
                "rightInstances": len(right_objects),
                "maximumGapMm": round(maximum_gap * 1000.0, 3),
                "triangleOverlapPairs": triangle_overlaps,
                "limitMm": round(max_joint_gap * 1000.0, 3),
                "passed": maximum_gap <= max_joint_gap,
            }
            joint_records.append(record)
            if not record["passed"]:
                disconnected_joints.append(record)
    else:
        # Legacy fallback remains for an older source that predates the
        # isolated pipette product module.
        fallback_contracts: list[
            tuple[str, bpy.types.Object, bpy.types.Object | None]
        ] = []
        if asset_id == "electronic-pipette-station":
            fallback_contracts.extend(pipette_joint_contracts(objects))
        for label, first, second in fallback_contracts:
            if second is None:
                missing_joint_parts.append(label)
                continue
            gap, overlaps = evaluated_bvh_gap(geometry(first), geometry(second))
            record = {
                "joint": label,
                "left": first.name,
                "right": second.name,
                "leftInstances": 1,
                "rightInstances": 1,
                "maximumGapMm": round(gap * 1000.0, 3),
                "triangleOverlapPairs": overlaps,
                "limitMm": round(max_joint_gap * 1000.0, 3),
                "passed": gap <= max_joint_gap,
            }
            joint_records.append(record)
            if not record["passed"]:
                disconnected_joints.append(record)
    if missing_joint_parts:
        errors.append("missing functional joint partners: " + "; ".join(missing_joint_parts))
    if disconnected_joints:
        preview = "; ".join(
            f"{record['joint']} ({record['maximumGapMm']:.3f} mm)"
            for record in disconnected_joints[:MAX_REPORTED_PARTS]
        )
        errors.append(f"disconnected functional joints: {preview}")

    materials = used_materials(objects)
    opacity_records = [_material_opacity(material) for material in materials]
    nonopaque_materials = [record for record in opacity_records if not record["opaque"]]
    unexpected_nonopaque = [
        record for record in nonopaque_materials
        if (asset_id, str(record["material"])) not in NONOPAQUE_MATERIAL_ALLOWLIST
    ]
    opacity_required = module_name is not None
    if opacity_required and unexpected_nonopaque:
        preview = "; ".join(
            f"{record['material']} (alpha={record['principledAlpha']:.3f}, "
            f"transmission={record['transmission']:.3f})"
            for record in unexpected_nonopaque[:MAX_REPORTED_PARTS]
        )
        errors.append(f"unintended non-opaque product materials: {preview}")

    pbr_report = source_pbr_texture_report(materials)
    pbr_required = module_name is not None
    if pbr_required and not pbr_report["passed"]:
        if not pbr_report["linkedPbrImageTextureCount"]:
            errors.append(
                "source PBR image textures missing: no present image node reaches "
                "a physical Principled input"
            )
        if pbr_report["missingImageSourceCount"]:
            errors.append(
                "source PBR image textures reference missing image data: "
                + "; ".join(
                    f"{record['material']}/{record['node']}"
                    for record in pbr_report["missingImageSources"][:MAX_REPORTED_PARTS]
                )
            )

    intersecting_formed_members: list[dict[str, object]] = []
    if asset_id == "ultrasonic-cleaner":
        long_members = [obj for obj in objects if source_name(obj) == "Cleaner rolled long rim"]
        end_members = [obj for obj in objects if source_name(obj) == "Cleaner rolled end rim"]
        for long_member in long_members:
            for end_member in end_members:
                overlaps = geometry(long_member).bvh.overlap(geometry(end_member).bvh)
                if not overlaps:
                    continue
                intersecting_formed_members.append(
                    {
                        "first": long_member.name,
                        "second": end_member.name,
                        "triangleIntersections": len(overlaps),
                    }
                )
    if intersecting_formed_members:
        preview = "; ".join(
            f"{record['first']} x {record['second']} "
            f"({record['triangleIntersections']} triangle intersections)"
            for record in intersecting_formed_members[:MAX_REPORTED_PARTS]
        )
        errors.append(
            "intersecting independent formed-rim members (causes corner seams/AO holes): "
            + preview
        )

    return {
        "asset": asset_id,
        "source": str(path),
        "productModule": module_name,
        "sealedExteriorPartsChecked": sum(is_sealed_exterior(obj) for obj in objects),
        "openExteriorParts": open_parts,
        "functionalJointsChecked": len(joint_records),
        "functionalJointRecords": joint_records,
        "disconnectedFunctionalJoints": disconnected_joints,
        "missingFunctionalJointPartners": missing_joint_parts,
        "opaqueMaterialsRequired": opacity_required,
        "opaqueMaterialsChecked": len(opacity_records),
        "nonOpaqueMaterials": nonopaque_materials,
        "unexpectedNonOpaqueMaterials": unexpected_nonopaque,
        "sourcePbrImageTexturesRequired": pbr_required,
        "sourcePbrImageTextures": pbr_report,
        "intersectingFormedMembers": intersecting_formed_members,
        "errors": errors,
        "passed": not errors,
    }


def main() -> None:
    options = parse_args()
    if options.max_joint_gap_mm < 0:
        raise SystemExit("--max-joint-gap-mm must be non-negative")
    source_dir = options.source_dir.resolve()
    selected = options.asset or list(batch14.ASSETS)
    records = [
        audit(asset_id, source_dir, options.max_joint_gap_mm / 1000.0)
        for asset_id in selected
    ]
    print("LABSPACE_BATCH14_SHELL_AUDIT " + json.dumps(records, sort_keys=True))
    failures = [record for record in records if not record["passed"]]
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
