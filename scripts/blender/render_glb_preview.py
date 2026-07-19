"""Render a deterministic studio QA preview for an exported GLB."""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("glb", help="GLB file to render")
    parser.add_argument("--output", required=True, help="PNG output path")
    parser.add_argument("--view", choices=("front", "rear"), default="front")
    return parser.parse_args(argv)


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_area_light(
    name: str,
    location: tuple[float, float, float],
    energy: float,
    size: float,
    color: tuple[float, float, float],
    target: Vector,
) -> None:
    data = bpy.data.lights.new(name=name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    look_at(obj, target)


def main() -> None:
    args = parse_args()
    glb_path = Path(args.glb).resolve()
    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    result = bpy.ops.import_scene.gltf(filepath=str(glb_path))
    if "FINISHED" not in result:
        raise RuntimeError(f"Could not import {glb_path}")

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.filepath = str(output_path)
    scene.render.resolution_percentage = 100
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 20
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.025, 0.032, 0.043)

    # Matte studio sweep.
    bpy.ops.mesh.primitive_plane_add(size=8.0, location=(0.0, 0.0, -0.002))
    floor = bpy.context.object
    floor.name = "QA studio floor"
    floor_material = bpy.data.materials.new("QA neutral floor")
    floor_material.use_nodes = True
    bsdf = floor_material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.10, 0.12, 0.15, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.42
    floor.data.materials.append(floor_material)

    target = Vector((0.0, 0.0, 0.54))
    camera_data = bpy.data.cameras.new("QA camera")
    camera_data.lens = 58
    camera_data.sensor_width = 36
    camera = bpy.data.objects.new("QA camera", camera_data)
    bpy.context.collection.objects.link(camera)
    if args.view == "front":
        camera.location = (1.28, -1.55, 1.14)
    else:
        camera.location = (-1.23, 1.50, 1.18)
    look_at(camera, target)
    scene.camera = camera

    add_area_light(
        "Key softbox",
        (-0.72, -0.90, 1.85),
        190.0,
        1.05,
        (1.0, 0.91, 0.82),
        target,
    )
    add_area_light(
        "Fill softbox",
        (1.10, -0.22, 1.20),
        115.0,
        0.82,
        (0.72, 0.86, 1.0),
        target,
    )
    add_area_light(
        "Glass rim strip",
        (0.16, 1.10, 1.62),
        225.0,
        0.72,
        (0.82, 0.92, 1.0),
        Vector((0.17, 0.07, 0.86)),
    )
    add_area_light(
        "Front bounce",
        (-0.15, -0.72, 0.32),
        52.0,
        0.55,
        (1.0, 0.77, 0.56),
        Vector((0.0, 0.0, 0.34)),
    )

    bpy.ops.render.render(write_still=True)
    print(f"LABSPACE_GLTF_PREVIEW {output_path}")


if __name__ == "__main__":
    main()
