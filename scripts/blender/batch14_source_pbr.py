"""Attach shared LabSpace micro-surface maps to editable Blender sources.

This module changes material node graphs only.  It never changes albedo,
metalness, alpha/transmission, object geometry, transforms, or export state.
The maps are the small shared files in ``public/materials/pbr``; each image is
loaded once, marked Non-Color, given a repository-relative source path, and
packed by default so an editable ``.blend`` remains truthful and portable.

Typical caller usage::

    import batch14_source_pbr
    pbr_report = batch14_source_pbr.apply(lab_furniture)

``apply`` accepts a module/object with ``MATERIALS``, a material mapping or
iterable, or ``None`` to inspect ``bpy.data.materials`` directly.
"""
from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
import re
from typing import Any, Iterable, Mapping

import bpy


REVISION = "batch14-source-pbr-r1"
NODE_PREFIX = "LabSpace Source PBR / "
REPO_ROOT = Path(__file__).resolve().parents[2]
MAP_ROOT = REPO_ROOT / "public" / "materials" / "pbr"
DEFAULT_SOURCE_BLEND_DIR = REPO_ROOT / "assets" / "blender" / "batch14"


@dataclass(frozen=True)
class Recipe:
    key: str
    normal_map: str
    roughness_map: str
    mapping_scale: tuple[float, float, float]
    normal_strength: float
    roughness_influence: float


RECIPES: dict[str, Recipe] = {
    "enamel": Recipe(
        "enamel",
        "enamel-surface-r4-normal.png",
        "enamel-surface-r4-roughness.png",
        (28.0, 28.0, 28.0),
        0.060,
        0.060,
    ),
    "micrograin": Recipe(
        "micrograin",
        "micrograin-surface-r5-normal.png",
        "micrograin-surface-r5-roughness.png",
        (42.0, 42.0, 42.0),
        0.080,
        0.080,
    ),
    "polymer": Recipe(
        "polymer",
        "polymer-surface-r4-normal.png",
        "polymer-surface-r4-roughness.png",
        (22.0, 22.0, 22.0),
        0.100,
        0.080,
    ),
    "brushed": Recipe(
        "brushed",
        "brushed-surface-r4-normal.png",
        "brushed-surface-r4-roughness.png",
        (4.0, 32.0, 4.0),
        0.120,
        0.100,
    ),
    "woodgrain": Recipe(
        "woodgrain",
        "woodgrain-surface-r6-normal.png",
        "woodgrain-surface-r6-roughness.png",
        (2.5, 8.0, 2.5),
        0.130,
        0.120,
    ),
    "phenolic": Recipe(
        "phenolic",
        "phenolic-surface-r4-normal.png",
        "phenolic-surface-r4-roughness.png",
        (18.0, 18.0, 18.0),
        0.075,
        0.080,
    ),
}


LAST_REPORT: dict[str, Any] = {}


def _material_list(source: Any = None) -> list[bpy.types.Material]:
    if source is None:
        candidates: Iterable[Any] = bpy.data.materials
    elif isinstance(source, Mapping):
        candidates = source.values()
    elif hasattr(source, "MATERIALS"):
        registered = getattr(source, "MATERIALS")
        candidates = registered.values() if isinstance(registered, Mapping) else registered
    elif isinstance(source, bpy.types.Material):
        candidates = (source,)
    else:
        candidates = source

    result: list[bpy.types.Material] = []
    seen: set[str] = set()
    for candidate in candidates:
        if not isinstance(candidate, bpy.types.Material):
            continue
        identity = candidate.name_full
        if identity in seen:
            continue
        seen.add(identity)
        result.append(candidate)
    return sorted(result, key=lambda material: material.name_full.casefold())


def _principled(material: bpy.types.Material) -> bpy.types.Node | None:
    if not material.use_nodes or material.node_tree is None:
        return None
    return material.node_tree.nodes.get("Principled BSDF")


def _socket_value(bsdf: bpy.types.Node, names: tuple[str, ...], default: float) -> float:
    for name in names:
        socket = bsdf.inputs.get(name)
        if socket is not None and not socket.is_linked:
            return float(socket.default_value)
    return default


def _opaque(material: bpy.types.Material, bsdf: bpy.types.Node) -> bool:
    diffuse_alpha = float(material.diffuse_color[3]) if len(material.diffuse_color) > 3 else 1.0
    alpha_socket = bsdf.inputs.get("Alpha")
    transmission_socket = (
        bsdf.inputs.get("Transmission Weight") or bsdf.inputs.get("Transmission")
    )
    # A linked optical socket is not statically provable opaque.  Refuse it
    # instead of accidentally decorating glass or an alpha-masked material.
    if (alpha_socket is not None and alpha_socket.is_linked) or (
        transmission_socket is not None and transmission_socket.is_linked
    ):
        return False
    alpha = _socket_value(bsdf, ("Alpha",), diffuse_alpha)
    transmission = _socket_value(bsdf, ("Transmission Weight", "Transmission"), 0.0)
    return min(alpha, diffuse_alpha) >= 0.999 and transmission <= 0.001


def _foreign_input_link(bsdf: bpy.types.Node, socket_name: str) -> bool:
    socket = bsdf.inputs.get(socket_name)
    if socket is None or not socket.is_linked:
        return False
    return any(not link.from_node.name.startswith(NODE_PREFIX) for link in socket.links)


def _recipe_key(material: bpy.types.Material) -> tuple[str | None, str]:
    """Classify visible finish without using or changing its base color."""
    name = material.name.casefold()
    surface = str(material.get("labspace_surface", "")).casefold()
    visible_finish = str(material.get("labspace_visible_finish", "")).casefold()
    role = str(material.get("pbr_role", "")).casefold()
    evidence = " ".join((name, surface, visible_finish, role))

    # Never infer microtexture for optical, emissive, liquid or soft-rubber
    # materials.  These roles need their own purpose-built shading.
    excluded = re.search(
        r"glass|glaz|screen|display|liquid|water|sample|ink reservoir|"
        r"gasket|rubber|seal|shadow|paper|label|emission|led|status",
        evidence,
    )
    if excluded:
        return None, f"excluded optical/soft/graphic role ({excluded.group(0)})"

    if "phenolic" in evidence or ("charcoal" in evidence and "laminate" in evidence):
        return "phenolic", "phenolic role/name"
    if surface in {"wood", "woodgrain"} or re.search(r"walnut|maple|woodgrain|wood laminate", evidence):
        return "woodgrain", "woodgrain role/name"
    if surface == "brushed" or visible_finish == "studio-stainless" or "brushed stainless" in evidence:
        return "brushed", "brushed-metal role/name"
    if surface == "micrograin" or re.search(r"powder.?coat|warm white powder", evidence):
        return "micrograin", "powder-coat/micrograin role/name"
    if surface == "enamel" or re.search(r"enamel|porcelain|laboratory laminate", evidence):
        return "enamel", "enamel/laminate role/name"
    if surface == "polymer" or re.search(
        r"polymer|polypropylene|polystyrene|polyamide|molded control|control-key",
        evidence,
    ):
        return "polymer", "polymer role/name"
    return None, "no matching visible-surface recipe"


def _relative_image_path(path: Path) -> str:
    # During procedural authoring the source file is commonly unsaved.  Use the
    # standard batch-14 source directory in that case; packing still guarantees
    # portability if the caller chooses another destination later.
    base = Path(bpy.data.filepath).resolve().parent if bpy.data.filepath else DEFAULT_SOURCE_BLEND_DIR
    relative = os.path.relpath(path, base).replace("\\", "/")
    return "//" + relative


def _load_map(path: Path, *, pack_images: bool) -> bpy.types.Image:
    if not path.is_file():
        raise FileNotFoundError(f"Missing shared LabSpace PBR map: {path}")
    image = bpy.data.images.load(str(path), check_existing=True)
    image.colorspace_settings.name = "Non-Color"
    image["labspace_repo_relative_path"] = path.relative_to(REPO_ROOT).as_posix()
    image["labspace_source_pbr_revision"] = REVISION
    # Pack from the verified absolute source first.  Setting ``//`` before the
    # pack operation makes an unsaved background scene resolve against the
    # process drive root (for example ``C:\\public``) instead of this repo.
    image.filepath_raw = str(path)
    if pack_images and image.packed_file is None:
        image.pack()
    image.filepath_raw = _relative_image_path(path)
    return image


def _owned_nodes(material: bpy.types.Material) -> list[bpy.types.Node]:
    if material.node_tree is None:
        return []
    return [node for node in material.node_tree.nodes if node.name.startswith(NODE_PREFIX)]


def _remove_owned_nodes(material: bpy.types.Material) -> None:
    if material.node_tree is None:
        return
    for node in _owned_nodes(material):
        material.node_tree.nodes.remove(node)


def _new_node(
    material: bpy.types.Material,
    node_type: str,
    suffix: str,
    location: tuple[float, float],
) -> bpy.types.Node:
    assert material.node_tree is not None
    node = material.node_tree.nodes.new(node_type)
    node.name = NODE_PREFIX + suffix
    node.label = NODE_PREFIX + suffix
    node.location = location
    return node


def _attach(material: bpy.types.Material, recipe: Recipe, *, pack_images: bool) -> dict[str, Any]:
    bsdf = _principled(material)
    if bsdf is None:
        raise RuntimeError(f"Material has no Principled BSDF: {material.name}")
    if _foreign_input_link(bsdf, "Roughness") or _foreign_input_link(bsdf, "Normal"):
        raise RuntimeError("existing non-LabSpace Roughness/Normal link")

    base_roughness = _socket_value(bsdf, ("Roughness",), 0.4)
    normal_path = MAP_ROOT / recipe.normal_map
    roughness_path = MAP_ROOT / recipe.roughness_map
    normal_image = _load_map(normal_path, pack_images=pack_images)
    roughness_image = _load_map(roughness_path, pack_images=pack_images)

    _remove_owned_nodes(material)
    assert material.node_tree is not None
    nodes = material.node_tree.nodes
    links = material.node_tree.links

    texcoord = _new_node(material, "ShaderNodeTexCoord", "Coordinates", (-900.0, 80.0))
    mapping = _new_node(material, "ShaderNodeMapping", "Physical tiling", (-700.0, 80.0))
    mapping.vector_type = "POINT"
    mapping.inputs["Scale"].default_value = recipe.mapping_scale
    links.new(texcoord.outputs["UV"], mapping.inputs["Vector"])

    normal_texture = _new_node(material, "ShaderNodeTexImage", "Normal texture", (-500.0, 180.0))
    normal_texture.image = normal_image
    normal_texture.interpolation = "Linear"
    normal_texture.extension = "REPEAT"
    links.new(mapping.outputs["Vector"], normal_texture.inputs["Vector"])
    normal_map = _new_node(material, "ShaderNodeNormalMap", "Normal strength", (-260.0, 180.0))
    normal_map.space = "TANGENT"
    normal_map.inputs["Strength"].default_value = recipe.normal_strength
    links.new(normal_texture.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])

    roughness_texture = _new_node(material, "ShaderNodeTexImage", "Roughness texture", (-500.0, -170.0))
    roughness_texture.image = roughness_image
    roughness_texture.interpolation = "Linear"
    roughness_texture.extension = "REPEAT"
    links.new(mapping.outputs["Vector"], roughness_texture.inputs["Vector"])

    subtract = _new_node(material, "ShaderNodeMath", "Center roughness", (-280.0, -170.0))
    subtract.operation = "SUBTRACT"
    subtract.inputs[1].default_value = 0.5
    links.new(roughness_texture.outputs["Color"], subtract.inputs[0])
    influence = _new_node(material, "ShaderNodeMath", "Roughness influence", (-80.0, -170.0))
    influence.operation = "MULTIPLY"
    influence.inputs[1].default_value = recipe.roughness_influence
    links.new(subtract.outputs[0], influence.inputs[0])
    add_base = _new_node(material, "ShaderNodeMath", "Authored roughness", (120.0, -170.0))
    add_base.operation = "ADD"
    add_base.use_clamp = True
    add_base.inputs[1].default_value = base_roughness
    links.new(influence.outputs[0], add_base.inputs[0])
    links.new(add_base.outputs[0], bsdf.inputs["Roughness"])

    material["labspace_source_pbr_revision"] = REVISION
    material["labspace_source_pbr_recipe"] = recipe.key
    material["labspace_source_pbr_maps"] = [recipe.normal_map, recipe.roughness_map]
    material["labspace_source_pbr_mapping_scale"] = list(recipe.mapping_scale)
    material["labspace_source_pbr_normal_strength"] = recipe.normal_strength
    material["labspace_source_pbr_roughness_influence"] = recipe.roughness_influence

    return {
        "material": material.name,
        "recipe": recipe.key,
        "baseRoughness": round(base_roughness, 6),
        "normalStrength": recipe.normal_strength,
        "roughnessInfluence": recipe.roughness_influence,
        "mappingScale": list(recipe.mapping_scale),
        "maps": [recipe.normal_map, recipe.roughness_map],
        "packed": bool(normal_image.packed_file and roughness_image.packed_file),
    }


def report(source: Any = None) -> dict[str, Any]:
    """Return a dry classification report without loading images or adding nodes."""
    records: list[dict[str, str]] = []
    for material in _material_list(source):
        bsdf = _principled(material)
        if bsdf is None:
            records.append({"material": material.name, "status": "skip", "reason": "no Principled BSDF"})
            continue
        if not _opaque(material, bsdf):
            records.append({"material": material.name, "status": "skip", "reason": "transparent/transmissive"})
            continue
        recipe_key, reason = _recipe_key(material)
        records.append(
            {
                "material": material.name,
                "status": "match" if recipe_key else "skip",
                "recipe": recipe_key or "",
                "reason": reason,
            }
        )
    return {
        "revision": REVISION,
        "mapRoot": MAP_ROOT.relative_to(REPO_ROOT).as_posix(),
        "materials": records,
        "matched": sum(record["status"] == "match" for record in records),
        "skipped": sum(record["status"] == "skip" for record in records),
    }


def apply(source: Any = None, *, pack_images: bool = True) -> dict[str, Any]:
    """Apply shared source PBR maps and return a serializable audit report."""
    global LAST_REPORT
    applied: list[dict[str, Any]] = []
    skipped: list[dict[str, str]] = []
    for material in _material_list(source):
        bsdf = _principled(material)
        if bsdf is None:
            skipped.append({"material": material.name, "reason": "no Principled BSDF"})
            continue
        if not _opaque(material, bsdf):
            skipped.append({"material": material.name, "reason": "transparent/transmissive"})
            continue
        recipe_key, reason = _recipe_key(material)
        if recipe_key is None:
            skipped.append({"material": material.name, "reason": reason})
            continue
        try:
            applied.append(_attach(material, RECIPES[recipe_key], pack_images=pack_images))
        except RuntimeError as error:
            skipped.append({"material": material.name, "reason": str(error)})

    LAST_REPORT = {
        "revision": REVISION,
        "mapRoot": MAP_ROOT.relative_to(REPO_ROOT).as_posix(),
        "packImages": pack_images,
        "applied": applied,
        "skipped": skipped,
        "appliedCount": len(applied),
        "skippedCount": len(skipped),
        "baseColorChanged": False,
        "alphaOrTransmissionChanged": False,
        "geometryChanged": False,
    }
    return LAST_REPORT


__all__ = ["LAST_REPORT", "MAP_ROOT", "RECIPES", "REVISION", "apply", "report"]
