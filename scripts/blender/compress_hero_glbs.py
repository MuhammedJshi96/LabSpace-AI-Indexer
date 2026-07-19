"""Compress delivered LabSpace hero GLBs for fast, fully offline room loading.

The authored Blender generators intentionally produce inspectable, uncompressed
GLBs. This delivery pass re-imports those files and replaces them atomically with
Draco-compressed equivalents. LabSpace serves the decoder from ``public/draco``;
no CDN or network connection is required at runtime.

Run from the repository root:

    .tools/blender-4.5.11-windows-x64/blender.exe --background \
        --factory-startup --python scripts/blender/compress_hero_glbs.py
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL_DIRECTORY = PROJECT_ROOT / "public" / "models" / "hero"


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir", type=Path, default=DEFAULT_MODEL_DIRECTORY)
    parser.add_argument(
        "--asset",
        action="append",
        default=[],
        help="Compress only this asset id. Repeat to select multiple assets.",
    )
    return parser.parse_args(argv)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.images,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def mesh_bounds() -> tuple[tuple[float, float, float], tuple[float, float, float]]:
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("Imported GLB contains no mesh objects")
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = tuple(min(point[index] for point in points) for index in range(3))
    maximum = tuple(max(point[index] for point in points) for index in range(3))
    return minimum, maximum


def nearly_equal_bounds(
    before: tuple[tuple[float, float, float], tuple[float, float, float]],
    after: tuple[tuple[float, float, float], tuple[float, float, float]],
    tolerance: float = 0.002,
) -> bool:
    return all(
        abs(before[side][axis] - after[side][axis]) <= tolerance
        for side in range(2)
        for axis in range(3)
    )


def import_glb(path: Path) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
    result = bpy.ops.import_scene.gltf(filepath=str(path.resolve()))
    if "FINISHED" not in result:
        raise RuntimeError(f"Could not import {path}")
    for obj in list(bpy.context.scene.objects):
        if obj.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.update()
    return mesh_bounds()


def export_compressed(path: Path) -> None:
    result = bpy.ops.export_scene.gltf(
        filepath=str(path.resolve()),
        check_existing=False,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_materials="EXPORT",
        export_normals=True,
        export_tangents=False,
        export_texcoords=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_shared_accessors=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_loglevel=-1,
    )
    if "FINISHED" not in result:
        raise RuntimeError(f"Could not export compressed GLB to {path}")


def compress_model(path: Path) -> tuple[int, int]:
    original_bytes = path.stat().st_size
    reset_scene()
    before_bounds = import_glb(path)
    temporary = path.with_name(f".{path.stem}.compressed.glb")
    if temporary.exists():
        temporary.unlink()
    export_compressed(temporary)

    reset_scene()
    after_bounds = import_glb(temporary)
    if not nearly_equal_bounds(before_bounds, after_bounds):
        temporary.unlink(missing_ok=True)
        raise RuntimeError(f"Compression changed the authored bounds for {path.stem}")

    compressed_bytes = temporary.stat().st_size
    if compressed_bytes >= original_bytes:
        temporary.unlink(missing_ok=True)
        print(
            f"LABSPACE_HERO_COMPRESSION_SKIPPED {path.stem} "
            f"original={original_bytes} compressed={compressed_bytes}"
        )
        return original_bytes, original_bytes

    temporary.replace(path)
    print(
        f"LABSPACE_HERO_COMPRESSED {path.stem} "
        f"original={original_bytes} compressed={compressed_bytes} "
        f"saved={original_bytes - compressed_bytes}"
    )
    return original_bytes, compressed_bytes


def main() -> None:
    args = parse_args()
    model_directory = args.model_dir.resolve()
    models = sorted(model_directory.glob("*.glb"), key=lambda path: path.name)
    if args.asset:
        requested = set(args.asset)
        models = [path for path in models if path.stem in requested]
        missing = requested - {path.stem for path in models}
        if missing:
            raise RuntimeError(f"Unknown hero asset ids: {', '.join(sorted(missing))}")
    if not models:
        raise RuntimeError(f"No hero GLBs found in {model_directory}")

    original_total = 0
    compressed_total = 0
    for model in models:
        original, compressed = compress_model(model)
        original_total += original
        compressed_total += compressed

    reduction = 100.0 * (original_total - compressed_total) / max(original_total, 1)
    print(
        f"LABSPACE_HERO_COMPRESSION_COMPLETE models={len(models)} "
        f"original={original_total} compressed={compressed_total} reduction={reduction:.1f}%"
    )


if __name__ == "__main__":
    main()
