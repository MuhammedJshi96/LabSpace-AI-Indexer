"""Render deterministic transparent catalog views for every authored hero GLB.

Run from the repository root with the project-local Blender runtime:

    .tools/blender-4.5.11-windows-x64/blender.exe --background \
        --factory-startup --python scripts/blender/render_hero_catalog.py

The script intentionally discovers only ``*.glb`` files directly inside
``public/models/hero``. Nested QA or support files are not treated as assets.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
import uuid
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODEL_DIRECTORY = PROJECT_ROOT / "public" / "models" / "hero"
OUTPUT_DIRECTORY = MODEL_DIRECTORY / "renders"

ISO_RESOLUTION = (384, 256)
TOP_RESOLUTION = (384, 384)
FRAME_MARGIN = 1.16


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--asset",
        action="append",
        default=[],
        help="Render only this asset ID. Repeat the option for multiple assets.",
    )
    parser.add_argument(
        "--view",
        choices=("all", "isometric", "top", "rear"),
        default="all",
        help="Render both catalog views or only the selected derived view.",
    )
    parser.add_argument("--output-dir", default=str(OUTPUT_DIRECTORY))
    parser.add_argument("--resume", action="store_true", help="Skip views already newer than their source GLB.")
    return parser.parse_args(argv)


def reset_scene() -> None:
    """Remove all imported and render-only objects from the active scene."""

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def mesh_bounds() -> tuple[Vector, Vector]:
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
    return minimum, maximum


def aabb_corners(minimum: Vector, maximum: Vector) -> list[Vector]:
    return [
        Vector((x, y, z))
        for x in (minimum.x, maximum.x)
        for y in (minimum.y, maximum.y)
        for z in (minimum.z, maximum.z)
    ]


def remove_embedded_cameras_and_lights() -> None:
    """Discard cameras and lights carried by a source GLB, if any."""

    embedded = [
        obj
        for obj in bpy.context.scene.objects
        if obj.type in {"CAMERA", "LIGHT"}
    ]
    for obj in embedded:
        bpy.data.objects.remove(obj, do_unlink=True)


def prepare_catalog_materials(view="isometric") -> None:
    """Keep reference-critical finishes legible in the transparent card rig.

    Preserve authored albedo. In the orthographic plan, suppress the overhead
    softbox's specular image instead of repainting a black resin top grey/white.
    This adjustment belongs to the derived evidence image, not the room GLB.
    """

    for material in bpy.data.materials:
        if not material.use_nodes or "phenolic" not in material.name.lower():
            continue
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if bsdf is None:
            continue
        bsdf.inputs["Roughness"].default_value = .62 if view == "top" else .44
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = .015 if view == "top" else .22
        if "Coat Weight" in bsdf.inputs:
            bsdf.inputs["Coat Weight"].default_value = 0.0
        if "Coat Roughness" in bsdf.inputs:
            bsdf.inputs["Coat Roughness"].default_value = 0.32


def configure_scene() -> bpy.types.Scene:
    scene = bpy.context.scene
    # Offline ray-traced reflections/transmission avoid Eevee's visible stipple
    # on glazing. This adds no runtime GPU cost: the app still loads static PNGs.
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.cycles.seed = 0
    scene.cycles.transparent_max_bounces = 12
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 35
    scene.render.film_transparent = True
    scene.render.use_file_extension = True
    scene.render.resolution_percentage = 100
    scene.render.pixel_aspect_x = 1.0
    scene.render.pixel_aspect_y = 1.0
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -1.4

    world = bpy.data.worlds.new("Hero catalog studio world")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.55, 0.58, 0.63, 1.0)
    background.inputs["Strength"].default_value = 0.38
    scene.world = world
    return scene


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


def add_studio_lighting(target: Vector, scale: float) -> None:
    """Create a scale-independent neutral three-point studio rig."""

    squared_scale = scale * scale
    add_area_light(
        "Catalog key softbox",
        target,
        (-1.55 * scale, -1.75 * scale, 2.45 * scale),
        430.0 * squared_scale,
        1.25 * scale,
        (1.0, 0.96, 0.91),
    )
    add_area_light(
        "Catalog fill softbox",
        target,
        (1.75 * scale, -0.30 * scale, 1.35 * scale),
        250.0 * squared_scale,
        1.05 * scale,
        (0.88, 0.94, 1.0),
    )
    add_area_light(
        "Catalog rim strip",
        target,
        (0.20 * scale, 1.65 * scale, 2.00 * scale),
        330.0 * squared_scale,
        0.90 * scale,
        (0.93, 0.97, 1.0),
    )
    add_area_light(
        "Catalog overhead bounce",
        target,
        (0.0, 0.10 * scale, 2.80 * scale),
        180.0 * squared_scale,
        1.40 * scale,
        (1.0, 1.0, 1.0),
    )


def create_orthographic_camera(
    target: Vector,
    dimensions: Vector,
    view: str,
) -> bpy.types.Object:
    camera_data = bpy.data.cameras.new(f"Catalog {view} camera")
    camera_data.type = "ORTHO"
    camera = bpy.data.objects.new(f"Catalog {view} camera", camera_data)
    bpy.context.collection.objects.link(camera)

    scale = max(dimensions.x, dimensions.y, dimensions.z, 0.1)
    distance = max(4.0 * scale, 2.0)
    if view in {"isometric", "rear"}:
        direction = Vector((1.35, -1.55, 1.10) if view == "isometric" else (-1.35, 1.55, 0.85)).normalized()
        camera.location = target + direction * distance
        look_at(camera, target)
    elif view == "top":
        camera.location = target + Vector((0.0, 0.0, distance))
        # Blender cameras look down their local -Z axis and local +Y is image up.
        camera.rotation_euler = (0.0, 0.0, 0.0)
    else:
        raise ValueError(f"Unknown catalog view: {view}")

    camera_data.clip_start = max(0.001, distance - 2.5 * scale)
    camera_data.clip_end = distance + 2.5 * scale
    bpy.context.view_layer.update()
    return camera


def frame_camera(
    camera: bpy.types.Object,
    points: list[Vector],
    resolution: tuple[int, int],
) -> None:
    """Fit an orthographic camera to the supplied world-space points."""

    inverse = camera.matrix_world.inverted()
    projected = [inverse @ point for point in points]
    width = max(point.x for point in projected) - min(
        point.x for point in projected
    )
    height = max(point.y for point in projected) - min(
        point.y for point in projected
    )
    aspect = resolution[0] / resolution[1]
    # Blender's orthographic scale describes the horizontal camera span. The
    # earlier vertical-span formula compressed 3:2 isometric captures by their
    # aspect ratio, clipping tall doors and wide benches at the image edges.
    camera.data.ortho_scale = max(width, height * aspect, 0.02) * FRAME_MARGIN


def render_view(
    scene: bpy.types.Scene,
    output_path: Path,
    view: str,
    resolution: tuple[int, int],
    minimum: Vector,
    maximum: Vector,
) -> None:
    prepare_catalog_materials(view)
    # Plan evidence has no grazing camera angle: the entire work surface faces
    # the key. A lower exposure preserves dark resin instead of tone-mapping it
    # into a grey highlight. Side views keep the product-studio exposure.
    scene.view_settings.exposure = -2.0 if view == "top" else -1.4
    dimensions = maximum - minimum
    target = (minimum + maximum) * 0.5
    camera = create_orthographic_camera(target, dimensions, view)
    frame_camera(camera, aabb_corners(minimum, maximum), resolution)

    scene.camera = camera
    scene.render.resolution_x = resolution[0]
    scene.render.resolution_y = resolution[1]
    # Render beside the destination then replace atomically. A dev-server read
    # must never see half a PNG, and Windows may briefly hold the previous file.
    temporary = output_path.with_name(f".{output_path.stem}-{uuid.uuid4().hex}.png")
    scene.render.filepath = str(temporary)
    bpy.ops.render.render(write_still=True)
    for attempt in range(8):
        try:
            os.replace(temporary, output_path)
            break
        except OSError:
            if attempt == 7:
                raise
            time.sleep(.25)

    bpy.data.objects.remove(camera, do_unlink=True)
    print(f"LABSPACE_HERO_RENDER {view} {output_path}")


def render_model(glb_path: Path, views: tuple[str, ...]) -> None:
    reset_scene()
    result = bpy.ops.import_scene.gltf(filepath=str(glb_path))
    if "FINISHED" not in result:
        raise RuntimeError(f"Could not import {glb_path}")
    remove_embedded_cameras_and_lights()
    prepare_catalog_materials()
    bpy.context.view_layer.update()

    minimum, maximum = mesh_bounds()
    dimensions = maximum - minimum
    target = (minimum + maximum) * 0.5
    scale = max(dimensions.x, dimensions.y, dimensions.z, 0.1)
    add_studio_lighting(target, scale)

    if "isometric" in views:
        render_view(
            bpy.context.scene,
            OUTPUT_DIRECTORY / f"{glb_path.stem}-isometric.png",
            "isometric",
            ISO_RESOLUTION,
            minimum,
            maximum,
        )
    if "top" in views:
        render_view(
            bpy.context.scene,
            OUTPUT_DIRECTORY / f"{glb_path.stem}-top.png",
            "top",
            TOP_RESOLUTION,
            minimum,
            maximum,
        )
    if "rear" in views:
        render_view(bpy.context.scene, OUTPUT_DIRECTORY / f"{glb_path.stem}-rear.png",
                    "rear", ISO_RESOLUTION, minimum, maximum)


def main() -> None:
    global OUTPUT_DIRECTORY
    args = parse_args()
    OUTPUT_DIRECTORY = (PROJECT_ROOT / args.output_dir).resolve()
    if not MODEL_DIRECTORY.exists():
        raise FileNotFoundError(MODEL_DIRECTORY)

    models = sorted(MODEL_DIRECTORY.glob("*.glb"), key=lambda path: path.name)
    if args.asset:
        requested = set(args.asset)
        models = [path for path in models if path.stem in requested]
        missing = requested - {path.stem for path in models}
        if missing:
            raise RuntimeError(f"Unknown hero asset IDs: {', '.join(sorted(missing))}")
    if not models:
        raise RuntimeError(f"No hero GLBs found in {MODEL_DIRECTORY}")

    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    configure_scene()
    views = ("isometric", "top") if args.view == "all" else (args.view,)
    rendered = 0
    for glb_path in models:
        if args.resume and all((OUTPUT_DIRECTORY / f"{glb_path.stem}-{view}.png").exists()
                               and (OUTPUT_DIRECTORY / f"{glb_path.stem}-{view}.png").stat().st_mtime >= max(glb_path.stat().st_mtime, Path(__file__).stat().st_mtime)
                               for view in views):
            continue
        render_model(glb_path, views)
        rendered += 1

    print(
        f"LABSPACE_HERO_CATALOG_COMPLETE models={len(models)} "
        f"renders={rendered * len(views)} current={len(models)} output={OUTPUT_DIRECTORY}"
    )


if __name__ == "__main__":
    main()
