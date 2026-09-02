"""Validate editable batch-14 Blender product sources before release."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
if str(SCRIPT_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIRECTORY))

import lab_diversity_batch14 as batch14  # noqa: E402


ROOT_SCALE_TOLERANCE = 0.005
OPAQUE_TOLERANCE = 1.0e-4
METALLIC_TOLERANCE = 0.01
TRANSMISSION_ALLOWLIST = {
    (
        "gpu-analysis-workstation",
        "Smoked tempered computer side panel",
    ),
}
METALLIC_CONTROL_ALLOWLIST = {
    # The supplied stainless-cleaner sheet deliberately uses a formed metal
    # fascia surround, a metal power-button bezel and a machined rotary knob.
    # The display face, push keys, carry grip and drain lever remain dielectric.
    ("ultrasonic-cleaner", "Cleaner continuous fascia surround"),
    ("ultrasonic-cleaner", "Cleaner power button surround"),
    ("ultrasonic-cleaner", "Cleaner rotary control knob"),
}
FORBIDDEN_GENERIC_GLASS = "Low-iron cabinet glass"
CONTROL_DISPLAY_TERMS = (
    "control",
    "controller",
    "display",
    "indicator",
    "interface",
    "keypad",
    "screen",
    "touch",
)


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=Path("assets/blender/batch14"))
    parser.add_argument("--asset", action="append", choices=list(batch14.ASSETS), default=[])
    return parser.parse_args(argv)


def bounds(meshes: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    return (
        Vector(tuple(min(point[axis] for point in points) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in points) for axis in range(3))),
    )


def descends_from(obj: bpy.types.Object, ancestor: bpy.types.Object) -> bool:
    parent = obj.parent
    while parent is not None:
        if parent is ancestor:
            return True
        parent = parent.parent
    return False


def material_socket_value(
    material: bpy.types.Material,
    *names: str,
    default: float = 0.0,
    linked_value: float | None = None,
) -> float:
    """Read a scalar Principled value across supported Blender socket names."""

    if not material.use_nodes or material.node_tree is None:
        return default
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf is None:
        return default
    for name in names:
        socket = bsdf.inputs.get(name)
        if socket is None:
            continue
        if socket.is_linked:
            if linked_value is not None:
                return linked_value
            continue
        value = socket.default_value
        if isinstance(value, (int, float)):
            return float(value)
    return default


def used_materials(meshes: list[bpy.types.Object]) -> list[bpy.types.Material]:
    """Return only materials assigned to this source product's mesh parts."""

    materials: dict[str, bpy.types.Material] = {}
    for obj in meshes:
        for slot in obj.material_slots:
            if slot.material is not None:
                materials[slot.material.name] = slot.material
    return [materials[name] for name in sorted(materials)]


def material_alpha(material: bpy.types.Material) -> float:
    # An alpha texture is not statically provable opaque, so treat a linked
    # Alpha input as transparent and require the same explicit whitelist.
    node_alpha = material_socket_value(material, "Alpha", default=1.0, linked_value=0.0)
    diffuse_alpha = float(material.diffuse_color[3]) if len(material.diffuse_color) > 3 else 1.0
    return min(node_alpha, diffuse_alpha)


def material_transmission(material: bpy.types.Material) -> float:
    return material_socket_value(
        material,
        "Transmission Weight",
        "Transmission",
        default=0.0,
        linked_value=1.0,
    )


def material_metallic(material: bpy.types.Material) -> float:
    return material_socket_value(
        material,
        "Metallic",
        default=float(getattr(material, "metallic", 0.0)),
        linked_value=1.0,
    )


def material_is_nonopaque(material: bpy.types.Material) -> bool:
    return (
        material_alpha(material) < 1.0 - OPAQUE_TOLERANCE
        or material_transmission(material) > OPAQUE_TOLERANCE
    )


def is_control_or_display_part(obj: bpy.types.Object) -> bool:
    label = f"{obj.name} {obj.get('part_category', '')}".lower()
    return any(term in label for term in CONTROL_DISPLAY_TERMS)


def inspect(asset_id: str, source_dir: Path) -> dict[str, object]:
    spec = batch14.ASSETS[asset_id]
    path = (source_dir / f"{asset_id}.blend").resolve()
    if not path.exists() or path.stat().st_size < 25_000:
        raise RuntimeError(f"{asset_id}: missing or unexpectedly small source {path}")
    result = bpy.ops.wm.open_mainfile(filepath=str(path), load_ui=False)
    if "FINISHED" not in result:
        raise RuntimeError(f"{asset_id}: Blender could not open {path}")

    roots = [obj for obj in bpy.context.scene.objects if obj.get("asset_id") == asset_id]
    if len(roots) != 1:
        raise RuntimeError(f"{asset_id}: expected one canonical root, found {len(roots)}")
    root = roots[0]
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    errors: list[str] = []
    if any(obj.name.startswith("Runtime batch -") for obj in meshes):
        raise RuntimeError(f"{asset_id}: source contains destructive runtime batches")
    detached = [obj.name for obj in meshes if not descends_from(obj, root)]
    if detached:
        raise RuntimeError(f"{asset_id}: parts outside product hierarchy: {detached[:4]}")

    minimum, maximum = bounds(meshes)
    dimensions = maximum - minimum
    expected = (spec.width, spec.depth, spec.height)
    for label, actual, target in zip(("width", "depth", "height"), dimensions, expected):
        if abs(actual - target) > .006:
            raise RuntimeError(f"{asset_id}: source {label} {actual:.4f} != {target:.4f} m")
    if abs(minimum.z) > .002:
        raise RuntimeError(f"{asset_id}: source is not grounded ({minimum.z:.5f} m)")

    root_scale = tuple(float(value) for value in root.scale)
    root_scale_deviation = max(abs(value - 1.0) for value in root_scale)
    if root_scale_deviation > ROOT_SCALE_TOLERANCE:
        errors.append(
            "non-unit root scale "
            f"{tuple(round(value, 6) for value in root_scale)} exceeds the "
            f"{ROOT_SCALE_TOLERANCE * 100:.1f}% manufactured-geometry tolerance"
        )

    materials = used_materials(meshes)
    forbidden_glass = [
        material.name for material in materials
        if material.name.casefold() == FORBIDDEN_GENERIC_GLASS.casefold()
    ]
    if forbidden_glass:
        errors.append(
            f"forbidden generic architectural glass material: {', '.join(forbidden_glass)}"
        )

    nonopaque_materials = []
    for material in materials:
        if not material_is_nonopaque(material):
            continue
        record = {
            "material": material.name,
            "alpha": round(material_alpha(material), 6),
            "transmission": round(material_transmission(material), 6),
        }
        nonopaque_materials.append(record)
        if (asset_id, material.name) not in TRANSMISSION_ALLOWLIST:
            errors.append(
                "unapproved transparent material "
                f"{material.name!r} (alpha={record['alpha']}, "
                f"transmission={record['transmission']})"
            )

    metallic_control_materials = []
    for obj in meshes:
        if not is_control_or_display_part(obj):
            continue
        if (asset_id, obj.name) in METALLIC_CONTROL_ALLOWLIST:
            continue
        for slot in obj.material_slots:
            material = slot.material
            if material is None:
                continue
            metallic = material_metallic(material)
            if metallic <= METALLIC_TOLERANCE:
                continue
            metallic_control_materials.append(
                {
                    "part": obj.name,
                    "material": material.name,
                    "metallic": round(metallic, 6),
                }
            )
    if metallic_control_materials:
        preview = "; ".join(
            f"{record['part']} -> {record['material']} ({record['metallic']})"
            for record in metallic_control_materials[:6]
        )
        errors.append(f"metallic control/display finishes: {preview}")

    cleaner_low_metal_enclosures = []
    if asset_id == "ultrasonic-cleaner":
        for obj in meshes:
            category = str(obj.get("part_category", "")).lower()
            if "enclosure" not in category:
                continue
            for slot in obj.material_slots:
                material = slot.material
                if material is None:
                    continue
                metallic = material_metallic(material)
                if metallic >= 0.8:
                    continue
                cleaner_low_metal_enclosures.append(
                    {
                        "part": obj.name,
                        "material": material.name,
                        "metallic": round(metallic, 6),
                    }
                )
        if cleaner_low_metal_enclosures:
            preview = "; ".join(
                f"{record['part']} -> {record['material']} ({record['metallic']})"
                for record in cleaner_low_metal_enclosures[:6]
            )
            errors.append(f"ultrasonic-cleaner enclosure metalness below 0.8: {preview}")

    modifiers = [modifier for obj in meshes for modifier in obj.modifiers]
    bevels = [modifier for modifier in modifiers if modifier.type == "BEVEL"]
    if len(bevels) < max(4, len(meshes) // 5):
        raise RuntimeError(f"{asset_id}: too few editable manufactured-edge modifiers")
    categories = sorted({str(obj.get("part_category", "")) for obj in meshes if obj.get("part_category")})
    collections = sorted(
        collection.name for collection in bpy.data.collections
        if collection.name == "PRODUCT_PARTS" or collection.name.startswith("PRODUCT - ")
    )
    if len(collections) < 3 or len(categories) < 2:
        raise RuntimeError(f"{asset_id}: product source is not organized by part role")

    mechanisms = [
        obj for obj in bpy.context.scene.objects
        if obj.type == "EMPTY" and obj.get("storageMechanism")
    ]
    if asset_id in batch14.STORAGE_ASSETS and len(mechanisms) != 3:
        raise RuntimeError(f"{asset_id}: expected three functional drawer rigs")
    if root.get("source_revision") != batch14.SOURCE_REVISION:
        raise RuntimeError(f"{asset_id}: incorrect source revision")
    if root.get("source_mesh_parts") != len(meshes):
        raise RuntimeError(f"{asset_id}: recorded and actual source part counts differ")
    if any(not material.use_nodes for material in materials):
        raise RuntimeError(f"{asset_id}: source includes a non-PBR material")

    if errors:
        raise RuntimeError(f"{asset_id}: r7 release gate failed: " + " | ".join(errors))

    return {
        "asset": asset_id,
        "bytes": path.stat().st_size,
        "meshParts": len(meshes),
        "bevelModifiers": len(bevels),
        "materials": len(materials),
        "partRoles": len(categories),
        "sourceCollections": len(collections),
        "storageMechanisms": len(mechanisms),
        "dimensionsM": [round(value, 6) for value in dimensions],
        "rootScale": [round(value, 6) for value in root_scale],
        "rootScaleMaxDeviationPercent": round(root_scale_deviation * 100, 6),
        "transparentMaterials": nonopaque_materials,
        "metallicControlDisplayParts": metallic_control_materials,
        "cleanerLowMetalEnclosures": cleaner_low_metal_enclosures,
    }


def main() -> None:
    options = parse_args()
    source_dir = options.source_dir.resolve()
    selected = options.asset or list(batch14.ASSETS)
    records = [inspect(asset_id, source_dir) for asset_id in selected]
    print("LABSPACE_BATCH14_SOURCE_QA " + json.dumps(records, sort_keys=True))


if __name__ == "__main__":
    main()
