"""Import and validate a generated LabSpace GLB in a fresh Blender scene."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("glb", help="GLB file to import and inspect")
    return parser.parse_args(argv)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def triangle_count(mesh: bpy.types.Mesh) -> int:
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def main() -> None:
    args = parse_args()
    path = Path(args.glb).resolve()
    if not path.exists():
        raise FileNotFoundError(path)
    if path.stat().st_size < 100_000:
        raise RuntimeError(f"GLB is unexpectedly small: {path.stat().st_size} bytes")

    reset_scene()
    result = bpy.ops.import_scene.gltf(filepath=str(path))
    if "FINISHED" not in result:
        raise RuntimeError(f"GLB import failed: {result}")
    bpy.context.view_layer.update()

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("Imported GLB contains no mesh objects")

    points = [
        obj.matrix_world @ Vector(corner)
        for obj in meshes
        for corner in obj.bound_box
    ]
    minimum = Vector(
        (
            min(point.x for point in points),
            min(point.y for point in points),
            min(point.z for point in points),
        )
    )
    maximum = Vector(
        (
            max(point.x for point in points),
            max(point.y for point in points),
            max(point.z for point in points),
        )
    )
    dimensions = maximum - minimum
    materials = {
        slot.material.name
        for obj in meshes
        for slot in obj.material_slots
        if slot.material is not None
    }
    extrema: dict[str, dict[str, object]] = {}
    for axis_index, axis_name in enumerate(("x", "y", "z")):
        candidates = [
            (float((obj.matrix_world @ Vector(corner))[axis_index]), obj.name)
            for obj in meshes
            for corner in obj.bound_box
        ]
        axis_min = min(candidates, key=lambda item: item[0])
        axis_max = max(candidates, key=lambda item: item[0])
        extrema[axis_name] = {
            "min": round(axis_min[0], 6),
            "min_object": axis_min[1],
            "max": round(axis_max[0], 6),
            "max_object": axis_max[1],
        }

    errors: list[str] = []
    if not 0.62 <= dimensions.x <= 0.76:
        errors.append(f"width {dimensions.x:.3f} m outside tolerance")
    if not 0.48 <= dimensions.y <= 0.66:
        errors.append(f"depth {dimensions.y:.3f} m outside tolerance")
    if not 1.06 <= dimensions.z <= 1.20:
        errors.append(f"height {dimensions.z:.3f} m outside tolerance")
    if abs(minimum.z) > 0.003:
        errors.append(f"model is not grounded; minimum z is {minimum.z:.6f} m")
    if abs((minimum.x + maximum.x) * 0.5) > 0.003:
        errors.append("model is not centered on x")
    if abs((minimum.y + maximum.y) * 0.5) > 0.003:
        errors.append("model is not centered on y")
    if not 14 <= len(meshes) <= 24:
        errors.append(
            f"runtime mesh groups {len(meshes)} outside expected 14-24"
        )
    if len(materials) < 12:
        errors.append(f"only {len(materials)} materials were imported")
    triangle_total = sum(triangle_count(obj.data) for obj in meshes)
    if triangle_total < 60_000:
        errors.append(f"only {triangle_total} triangles were imported")

    stats = {
        "file": str(path),
        "bytes": path.stat().st_size,
        "objects": len(bpy.context.scene.objects),
        "mesh_objects": len(meshes),
        "materials": len(materials),
        "vertices": sum(len(obj.data.vertices) for obj in meshes),
        "triangles": triangle_total,
        "bounds_m": {
            "min": [round(value, 6) for value in minimum],
            "max": [round(value, 6) for value in maximum],
            "dimensions": [round(value, 6) for value in dimensions],
        },
        "extrema": extrema,
        "errors": errors,
    }
    print("LABSPACE_GLTF_INSPECT " + json.dumps(stats, sort_keys=True))
    if errors:
        raise RuntimeError("; ".join(errors))


if __name__ == "__main__":
    main()
