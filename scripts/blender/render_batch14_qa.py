"""Render focused, non-destructive batch-14 product QA evidence.

The renderer imports the optimized runtime GLBs into a temporary Blender scene
and writes neutral-studio evidence images. It never saves the scene or changes
the source GLB. Defaults intentionally favor visual inspection over throughput:
four 1024 px Cycles views with a matte floor and soft contact lighting.

Example::

    blender --background --factory-startup --python-exit-code 1 \
      --python scripts/blender/render_batch14_qa.py -- \
      --asset automated-microplate-reader \
      --output-dir artifacts/batch14-qa
"""
from __future__ import annotations

import argparse
import math
import os
import sys
import time
import uuid
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_DIRECTORY = Path(__file__).resolve().parent
MODEL_DIRECTORY = PROJECT_ROOT / "public" / "models" / "hero"
DEFAULT_OUTPUT_DIRECTORY = PROJECT_ROOT / "artifacts" / "batch14-qa"
RESOLUTION = 1024
SAMPLES = 128

if str(SCRIPT_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIRECTORY))

import lab_diversity_batch14 as batch14  # noqa: E402


VIEWS = {
    "front": Vector((0.0, -1.0, 0.24)),
    "three-quarter": Vector((1.25, -1.55, 0.88)),
    "rear": Vector((0.0, 1.0, 0.30)),
    "side": Vector((1.0, 0.0, 0.28)),
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--asset",
        action="append",
        choices=sorted(batch14.ASSETS),
        default=[],
        help="Render this batch-14 asset. Repeat for more than one; omit for all.",
    )
    parser.add_argument(
        "--model-dir",
        type=Path,
        default=MODEL_DIRECTORY,
        help="Directory containing runtime GLBs (defaults to public/models/hero).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIRECTORY,
        help="Destination for <asset>-<view>-qa.png images.",
    )
    return parser.parse_args(argv)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def remove_embedded_cameras_and_lights() -> None:
    for obj in list(bpy.context.scene.objects):
        if obj.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(obj, do_unlink=True)


def mesh_bounds() -> tuple[Vector, Vector]:
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("Imported GLB contains no mesh geometry")
    points = [
        obj.matrix_world @ Vector(corner)
        for obj in meshes
        for corner in obj.bound_box
    ]
    minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    return minimum, maximum


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def configure_scene() -> bpy.types.Scene:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = SAMPLES
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.015
    scene.cycles.use_denoising = True
    scene.cycles.seed = 0
    scene.cycles.transparent_max_bounces = 12
    scene.render.resolution_x = RESOLUTION
    scene.render.resolution_y = RESOLUTION
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 25
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.25

    world = bpy.data.worlds.get("Batch 14 QA world") or bpy.data.worlds.new(
        "Batch 14 QA world"
    )
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    assert background is not None
    background.inputs["Color"].default_value = (0.34, 0.36, 0.38, 1.0)
    background.inputs["Strength"].default_value = 0.32
    scene.world = world
    return scene


def add_matte_floor(minimum: Vector, maximum: Vector) -> None:
    dimensions = maximum - minimum
    span = max(dimensions.x, dimensions.y, dimensions.z, 0.25) * 5.0
    bpy.ops.mesh.primitive_plane_add(
        size=span,
        location=((minimum.x + maximum.x) * 0.5, (minimum.y + maximum.y) * 0.5, minimum.z - 0.002),
    )
    floor = bpy.context.object
    floor.name = "QA neutral matte floor"
    material = bpy.data.materials.get("QA neutral matte floor")
    if material is None:
        material = bpy.data.materials.new("QA neutral matte floor")
        material.use_nodes = True
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        assert bsdf is not None
        bsdf.inputs["Base Color"].default_value = (0.30, 0.315, 0.32, 1.0)
        bsdf.inputs["Metallic"].default_value = 0.0
        bsdf.inputs["Roughness"].default_value = 0.74
    floor.data.materials.append(material)


def add_area_light(
    name: str,
    target: Vector,
    offset: tuple[float, float, float],
    energy: float,
    size: float,
    color: tuple[float, float, float],
) -> None:
    data = bpy.data.lights.new(name=name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    light = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(light)
    light.location = target + Vector(offset)
    look_at(light, target)


def add_soft_contact_lighting(target: Vector, scale: float) -> None:
    squared_scale = scale * scale
    add_area_light(
        "QA key softbox",
        target,
        (-1.55 * scale, -1.90 * scale, 2.35 * scale),
        520.0 * squared_scale,
        1.45 * scale,
        (1.0, 0.96, 0.91),
    )
    add_area_light(
        "QA fill softbox",
        target,
        (1.75 * scale, -0.25 * scale, 1.30 * scale),
        260.0 * squared_scale,
        1.25 * scale,
        (0.88, 0.94, 1.0),
    )
    add_area_light(
        "QA rear edge strip",
        target,
        (0.20 * scale, 1.75 * scale, 1.90 * scale),
        330.0 * squared_scale,
        1.00 * scale,
        (0.93, 0.97, 1.0),
    )
    add_area_light(
        "QA overhead reflection card",
        target,
        (0.0, 0.10 * scale, 2.75 * scale),
        190.0 * squared_scale,
        1.60 * scale,
        (1.0, 1.0, 1.0),
    )


def create_camera(target: Vector, dimensions: Vector, direction: Vector, view: str) -> bpy.types.Object:
    data = bpy.data.cameras.new(f"Batch 14 QA {view} camera")
    data.type = "PERSP"
    data.lens = 72.0
    data.sensor_width = 36.0
    data.clip_start = 0.01
    diagonal = max(dimensions.length, 0.2)
    distance = diagonal * 2.45
    data.clip_end = distance + diagonal * 4.0
    camera = bpy.data.objects.new(data.name, data)
    bpy.context.collection.objects.link(camera)
    camera.location = target + direction.normalized() * distance
    look_at(camera, target)
    return camera


def write_render(scene: bpy.types.Scene, output: Path) -> None:
    temporary = output.with_name(f".{output.stem}-{uuid.uuid4().hex}.png")
    scene.render.filepath = str(temporary)
    bpy.ops.render.render(write_still=True)
    for attempt in range(8):
        try:
            os.replace(temporary, output)
            return
        except OSError:
            if attempt == 7:
                raise
            time.sleep(0.25)


def render_asset(asset_id: str, model_directory: Path, output_directory: Path) -> None:
    source = model_directory / f"{asset_id}.glb"
    if not source.exists():
        raise FileNotFoundError(source)

    reset_scene()
    result = bpy.ops.import_scene.gltf(filepath=str(source))
    if "FINISHED" not in result:
        raise RuntimeError(f"Could not import {source}")
    remove_embedded_cameras_and_lights()
    bpy.context.view_layer.update()

    minimum, maximum = mesh_bounds()
    dimensions = maximum - minimum
    target = Vector(
        (
            (minimum.x + maximum.x) * 0.5,
            (minimum.y + maximum.y) * 0.5,
            minimum.z + dimensions.z * 0.46,
        )
    )
    scale = max(dimensions.x, dimensions.y, dimensions.z, 0.25)
    add_matte_floor(minimum, maximum)
    add_soft_contact_lighting(target, scale)

    scene = bpy.context.scene
    for view, direction in VIEWS.items():
        camera = create_camera(target, dimensions, direction, view)
        scene.camera = camera
        output = output_directory / f"{asset_id}-{view}-qa.png"
        write_render(scene, output)
        bpy.data.objects.remove(camera, do_unlink=True)
        print(f"LABSPACE_BATCH14_QA_RENDER asset={asset_id} view={view} path={output}")


def main() -> None:
    options = parse_args()
    output_directory = options.output_dir
    if not output_directory.is_absolute():
        output_directory = PROJECT_ROOT / output_directory
    output_directory = output_directory.resolve()
    output_directory.mkdir(parents=True, exist_ok=True)
    model_directory = options.model_dir
    if not model_directory.is_absolute():
        model_directory = PROJECT_ROOT / model_directory
    model_directory = model_directory.resolve()
    selected = options.asset or list(batch14.ASSETS)
    configure_scene()
    for asset_id in selected:
        render_asset(asset_id, model_directory, output_directory)
    print(
        "LABSPACE_BATCH14_QA_COMPLETE "
        f"assets={len(selected)} views={len(selected) * len(VIEWS)} "
        f"resolution={RESOLUTION} samples={SAMPLES} output={output_directory}"
    )


if __name__ == "__main__":
    main()
