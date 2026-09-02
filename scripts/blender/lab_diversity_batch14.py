"""Author the supplied laboratory and workplace diversity reference pack.

The eleven assets in this batch are original, logo-free Blender product models.
Each build saves an editable, unbatched ``.blend`` source scene before creating
the optimized runtime GLB.  The supplied photographs establish silhouette and
finish only; no downloaded mesh, brand mark, display screenshot, or
manufacturer claim is embedded in either artifact.

Run with Blender 4.5 LTS, for example::

    blender --background --factory-startup --python-exit-code 1 \
      --python scripts/blender/lab_diversity_batch14.py -- \
      --output-dir public/models/hero \
      --save-blend-dir assets/blender/batch14
"""
from __future__ import annotations

import argparse
import bmesh
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lab_furniture as f
import lab_casework_batch3 as casework
import lab_fidelity_batch6 as fidelity
import storage_anatomy
import fixed_casework_joints
import casework_edge_returns
import reference_finishes
import batch14_printer_products as printer_products
import batch14_reader_product as reader_product
import batch14_pipette_product as pipette_product
import batch14_gpu_workstation_product as gpu_workstation_product
import batch14_cleaner_product as cleaner_product
import batch14_source_pbr as source_pbr
import batch14_reference_rework as reference_rework


ASSETS = {
    "electronic-pipette-station": f.AssetSpec("electronic-pipette-station", .345, .150, .260),
    "automated-microplate-reader": f.AssetSpec("automated-microplate-reader", .52, .50, .33),
    "chest-ultra-low-freezer": f.AssetSpec("chest-ultra-low-freezer", .90, .76, .98),
    "gpu-analysis-workstation": f.AssetSpec("gpu-analysis-workstation", 1.20, .60, 1.25),
    "steel-pedestal-desk": f.AssetSpec("steel-pedestal-desk", 1.20, .70, .74),
    "wood-pedestal-desk": f.AssetSpec("wood-pedestal-desk", 1.20, .65, .75),
    "maple-steel-desk": f.AssetSpec("maple-steel-desk", 1.40, .70, .74),
    "black-utility-table": f.AssetSpec("black-utility-table", 1.60, .80, .74),
    "high-volume-multifunction-printer": f.AssetSpec(
        "high-volume-multifunction-printer", .58, .48, .38
    ),
    "compact-ink-tank-printer": f.AssetSpec("compact-ink-tank-printer", .48, .42, .25),
    "ultrasonic-cleaner": f.AssetSpec("ultrasonic-cleaner", .36, .33, .33),
}

STORAGE_ASSETS = {"steel-pedestal-desk", "wood-pedestal-desk", "maple-steel-desk"}

SOURCE_REVISION = "batch14-product-source-r7"
RUNTIME_REVISION = "diversity-batch14-r12"


def add_materials() -> None:
    """Shared, restrained materials with enough physical separation to read well."""
    f.build_materials()
    casework.add_reference_materials()
    make = f.make_material
    studio_stainless = make(
        "Satin formed stainless instrument enclosure", (.62, .67, .68, 1),
        metallic=.92, roughness=.29, anisotropy=.42,
    )
    studio_stainless["labspace_visible_finish"] = "studio-stainless"
    studio_stainless["labspace_surface"] = "brushed"
    active_display = make(
        "Active blue laboratory touchscreen", (.025, .22, .34, 1),
        metallic=0, roughness=.16, coat=.30,
    )
    active_bsdf = active_display.node_tree.nodes.get("Principled BSDF")
    if active_bsdf is not None:
        f.set_socket(active_bsdf, "Emission Color", (.015, .20, .34, 1))
        f.set_socket(active_bsdf, "Emission Strength", .45)
    f.MATERIALS.update(
        {
            "porcelain": make(
                "Porcelain white instrument enamel", (.59, .62, .61, 1),
                metallic=0, roughness=.39, coat=.08,
            ),
            "warm_white": make(
                "Warm white powder coat", (.54, .56, .53, 1),
                metallic=0, roughness=.44,
            ),
            "cool_grey": make(
                "Cool laboratory grey polymer", (.26, .30, .31, 1),
                metallic=0, roughness=.42,
            ),
            "mid_grey": make(
                "Medium instrument grey enamel", (.16, .19, .20, 1),
                metallic=0, roughness=.40,
            ),
            "stainless_studio": studio_stainless,
            "graphite": make(
                "Functional graphite polymer", (.025, .033, .035, 1),
                metallic=0, roughness=.42,
            ),
            "seal": make(
                "Black closed-cell gasket", (.006, .008, .009, 1),
                metallic=0, roughness=.72,
            ),
            "screen": make(
                "Inactive blue-black display glass", (.018, .050, .067, 1),
                metallic=0, roughness=.10, coat=.20,
            ),
            "screen_ui": make(
                "Abstract cyan display field", (.025, .48, .58, 1),
                metallic=0, roughness=.24, coat=.18,
            ),
            "screen_active": active_display,
            "teal": make(
                "LabSpace instrument teal", (.0, .40, .34, 1),
                metallic=0, roughness=.34, coat=.10,
            ),
            "blue_accent": make(
                "Restrained instrument blue", (.08, .22, .42, 1),
                metallic=0, roughness=.35, coat=.12,
            ),
            "control_polymer": make(
                "Molded control-key polymer", (.17, .20, .21, 1),
                metallic=0, roughness=.38,
            ),
            "milky_polypropylene": make(
                "Frosted polypropylene dispenser cartridge", (.55, .58, .56, 1),
                metallic=0, roughness=.34,
            ),
            "microplate_polymer": make(
                "Opaque laboratory microplate polymer", (.62, .64, .60, 1),
                metallic=0, roughness=.31,
            ),
            "charcoal_laminate": make(
                "Charcoal low-glare desktop laminate", (.045, .052, .052, 1),
                metallic=0, roughness=.36, coat=.07,
            ),
            "black_powder": make(
                "Fine black structural powder coat", (.014, .018, .019, 1),
                metallic=0, roughness=.46,
            ),
            "amber": make(
                "Status amber", (.82, .39, .035, 1), metallic=0, roughness=.32,
            ),
            "walnut": make(
                "Dark sealed walnut laminate", (.10, .055, .040, 1),
                metallic=0, roughness=.46, coat=.08,
            ),
            "walnut_edge": make(
                "Dark walnut laminate edge", (.045, .027, .024, 1),
                metallic=0, roughness=.52,
            ),
            "maple": make(
                "Sealed light maple laminate", (.66, .48, .28, 1),
                metallic=0, roughness=.44, coat=.08,
            ),
            "maple_edge": make(
                "Light maple edge band", (.44, .29, .16, 1),
                metallic=0, roughness=.50,
            ),
            "ink_cyan": make("Cyan ink reservoir", (.0, .42, .58, 1), roughness=.25),
            "ink_magenta": make("Magenta ink reservoir", (.58, .02, .22, 1), roughness=.25),
            "ink_yellow": make("Yellow ink reservoir", (.84, .56, .02, 1), roughness=.25),
            "sample_amber": make(
                "Opaque amber assay sample insert", (.62, .18, .018, 1),
                metallic=0, roughness=.24, coat=.10,
            ),
        }
    )
    # This is the only intentionally transmissive finish in batch 14.  It is a
    # thick smoked computer-case panel, not the generic cabinet-glass role that
    # the app presents as a nearly invisible 14% alpha pane.
    f.MATERIALS["smoked_tempered"] = casework.make_transmissive_material(
        "Smoked tempered computer side panel", (.055, .085, .095, 1), .42, .08
    )
    # Manufactured meshes are closed solids. Exporting every material as
    # double-sided wastes fill rate and exposes internal back faces at grazing
    # angles, which can look like accidental translucency.
    for material in f.MATERIALS.values():
        material.use_backface_culling = True


def box(
    name: str,
    xyz: tuple[float, float, float],
    size: tuple[float, float, float],
    material: str = "porcelain",
    bevel: float = .004,
    category: str = "construction",
    rotation: tuple[float, float, float] | None = None,
):
    obj = f.add_box(name, xyz, size, f.MATERIALS[material], bevel=bevel, category=category)
    if rotation is not None:
        obj.rotation_euler = rotation
    return obj


def cyl(
    name: str,
    xyz: tuple[float, float, float],
    radius: float,
    length: float,
    material: str = "stainless",
    axis: tuple[float, float, float] = (0, 0, 1),
    category: str = "hardware",
    vertices: int = 24,
):
    return f.add_cylinder(
        name, xyz, radius, length, f.MATERIALS[material], axis=axis,
        vertices=vertices, bevel=.001, category=category,
    )


def tube_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    material: str = "graphite",
    category: str = "cable",
):
    a, b = Vector(start), Vector(end)
    delta = b - a
    return cyl(name, tuple((a + b) * .5), radius, delta.length, material,
               tuple(delta), category, vertices=20)


def torus(
    name: str,
    xyz: tuple[float, float, float],
    major: float,
    minor: float,
    material: str,
    axis: tuple[float, float, float] = (0, 0, 1),
    category: str = "hardware",
):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=32,
        minor_segments=8,
        location=xyz,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(Vector(axis).normalized())
    f.assign_material(obj, f.MATERIALS[material])
    f.smooth(obj)
    return f.parent_to_root(obj, category)


def sphere(
    name: str,
    xyz: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: str,
    category: str = "detail",
):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=14, location=xyz)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    f.assign_material(obj, f.MATERIALS[material])
    f.smooth(obj)
    return f.parent_to_root(obj, category)


def smart_project_uv(obj) -> None:
    """Give small custom product meshes deterministic texture coordinates."""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.02)
    bpy.ops.object.mode_set(mode="OBJECT")


def extruded_yz_profile(
    name: str,
    width: float,
    profile: list[tuple[float, float]],
    material: str,
    *,
    x: float = 0.0,
    bevel: float = .008,
    category: str = "formed enclosure",
):
    """Create a closed, bevelled product shell from a side-elevation profile.

    A small authored profile communicates sloped/stepped industrial housings far
    better than piling up cubes, while remaining much cheaper than subdivision
    or a scan-derived mesh.  ``profile`` is an ordered list of world-space
    ``(y, z)`` points; the result is extruded symmetrically along X.
    """
    half = width * .5
    vertices = [(-half + x, y, z) for y, z in profile]
    vertices.extend((half + x, y, z) for y, z in profile)
    count = len(profile)
    faces: list[tuple[int, ...]] = [
        tuple(range(count - 1, -1, -1)),
        tuple(range(count, count * 2)),
    ]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, nxt + count, index + count))
    mesh = bpy.data.meshes.new(name + " mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=False)
    normal_mesh = bmesh.new()
    normal_mesh.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(normal_mesh, faces=list(normal_mesh.faces))
    normal_mesh.to_mesh(mesh)
    normal_mesh.free()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    f.assign_material(obj, f.MATERIALS[material])
    # Custom profile meshes need their own stable UVs; unlike primitives they
    # do not receive one automatically.  Smart projection is deterministic for
    # this tiny convex side-profile topology and keeps the shared 128 px finish
    # maps active after Draco compression.
    smart_project_uv(obj)
    if bevel > 0:
        modifier = obj.modifiers.new(name="Formed shell edge radii", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 4
        modifier.limit_method = "ANGLE"
        modifier.harden_normals = True
    return f.parent_to_root(obj, category)


def extruded_xz_profile(
    name: str,
    depth: float,
    profile: list[tuple[float, float]],
    material: str,
    *,
    y: float = 0.0,
    bevel: float = .008,
    category: str = "formed enclosure",
):
    """Extrude an authored front silhouette through depth.

    This is used for products whose identity is carried by a curved front
    outline (the passive pipette stand in particular), avoiding a stack of
    unrelated rectangular blocks.
    """
    half = depth * .5
    vertices = [(x, y - half, z) for x, z in profile]
    vertices.extend((x, y + half, z) for x, z in profile)
    count = len(profile)
    faces: list[tuple[int, ...]] = [
        tuple(range(count - 1, -1, -1)),
        tuple(range(count, count * 2)),
    ]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, nxt + count, index + count))
    mesh = bpy.data.meshes.new(name + " mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=False)
    normal_mesh = bmesh.new()
    normal_mesh.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(normal_mesh, faces=list(normal_mesh.faces))
    normal_mesh.to_mesh(mesh)
    normal_mesh.free()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    f.assign_material(obj, f.MATERIALS[material])
    smart_project_uv(obj)
    if bevel > 0:
        modifier = obj.modifiers.new(name="Manufactured edge radii", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 4
        modifier.limit_method = "ANGLE"
        modifier.harden_normals = True
    return f.parent_to_root(obj, category)


def lathe_profile(
    name: str,
    xyz: tuple[float, float, float],
    profile: list[tuple[float, float]],
    material: str,
    *,
    segments: int = 28,
    category: str = "formed component",
):
    """Create an economical smooth revolved product body from (radius, z)."""
    vertices: list[tuple[float, float, float]] = []
    for radius, z in profile:
        for step in range(segments):
            angle = math.tau * step / segments
            vertices.append((
                xyz[0] + radius * math.cos(angle),
                xyz[1] + radius * math.sin(angle),
                xyz[2] + z,
            ))
    rings = len(profile)
    faces: list[tuple[int, ...]] = []
    for ring in range(rings - 1):
        for step in range(segments):
            nxt = (step + 1) % segments
            a = ring * segments + step
            b = ring * segments + nxt
            c = (ring + 1) * segments + nxt
            d = (ring + 1) * segments + step
            faces.append((a, b, c, d))
    faces.append(tuple(range(segments - 1, -1, -1)))
    top = (rings - 1) * segments
    faces.append(tuple(top + step for step in range(segments)))
    mesh = bpy.data.meshes.new(name + " mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=False)
    normal_mesh = bmesh.new()
    normal_mesh.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(normal_mesh, faces=list(normal_mesh.faces))
    normal_mesh.to_mesh(mesh)
    normal_mesh.free()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    f.assign_material(obj, f.MATERIALS[material])
    smart_project_uv(obj)
    f.smooth(obj)
    return f.parent_to_root(obj, category)


def curve_tube(
    name: str,
    points: list[tuple[float, float, float]],
    radius: float,
    material: str,
    category: str = "hardware",
):
    """Make a smooth, economical bent tube for formed handles and guards."""
    curve = bpy.data.curves.new(name=name + " curve", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 3
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new(type="BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = Vector(coordinate)
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    f.assign_material(obj, f.MATERIALS[material])
    f.parent_to_root(obj, category)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    f.smooth(obj)
    return obj


def feet(width: float, depth: float, z: float = .014, inset: float = .045) -> None:
    for x in (-width / 2 + inset, width / 2 - inset):
        for y in (-depth / 2 + inset, depth / 2 - inset):
            cyl("Rubber isolation foot", (x, y, z), .018, z * 2, "rubber", category="foot")
            cyl("Foot fixing washer", (x, y, z * 1.85), .011, .004, "zinc", category="fastener")


def screen(name: str, xyz: tuple[float, float, float], size: tuple[float, float, float]) -> None:
    box(name + " bezel", xyz, size, "graphite", .006, "display bezel")
    face = (xyz[0], xyz[1] - size[1] / 2 - .002, xyz[2])
    box(name + " display glass", face, (size[0] * .82, .004, size[2] * .72),
        "screen", .003, "display")
    box(name + " abstract status field", (face[0] - size[0] * .16, face[1] - .003, face[2]),
        (size[0] * .18, .002, size[2] * .16), "screen_ui", .001, "display")
    box(name + " abstract data field", (face[0] + size[0] * .09, face[1] - .003, face[2] + size[2] * .1),
        (size[0] * .27, .002, size[2] * .08), "label", .001, "display")


def vent_bank(
    name: str,
    origin: tuple[float, float, float],
    count: int,
    spacing: float,
    slot: tuple[float, float, float],
    axis: str = "z",
    material: str = "shadow",
) -> None:
    for index in range(count):
        offset = (index - (count - 1) / 2) * spacing
        xyz = list(origin)
        xyz[2 if axis == "z" else 0] += offset
        box(f"{name} vent {index + 1:02}", tuple(xyz), slot, material, .0008, "ventilation")


def _batch14_opaque_consumable_materials() -> None:
    """Register opaque consumable plastics used by the r7 product rebuilds.

    The previous pipette and microplate geometry reused architectural cabinet
    glass.  Apart from being physically wrong, that introduced transmission
    sorting into two otherwise opaque instruments.  These restrained plastics
    preserve readable consumable detail without alpha or transmission.
    """
    if "milky_pp" not in f.MATERIALS:
        material = f.make_material(
            "Milky laboratory polypropylene", (.56, .60, .59, 1),
            metallic=0, roughness=.52, coat=.035,
        )
        material["labspace_visible_finish"] = "milky-polypropylene"
        material["labspace_requires_transmission"] = False
        f.MATERIALS["milky_pp"] = material
    if "well_resin" not in f.MATERIALS:
        material = f.make_material(
            "Opaque clear-well polystyrene proxy", (.68, .71, .69, 1),
            metallic=0, roughness=.38, coat=.08,
        )
        material["labspace_visible_finish"] = "laboratory-polystyrene"
        material["labspace_requires_transmission"] = False
        f.MATERIALS["well_resin"] = material


def build_pipette_station(spec: f.AssetSpec) -> None:
    w, d, h = spec.width, spec.depth, spec.height
    _batch14_opaque_consumable_materials()
    # Passive, non-powered linear holder.  A shallow, swept upright and thin
    # overhead blade reproduce the supplied weighted rack without charger bays,
    # status lamps, cables, or decorative service blocks.
    stand_profile = [
        (-w * .49, .010), (-w * .31, .010), (-w * .275, .024),
        (-w * .250, .055), (-w * .238, h * .70), (-w * .250, h * .78),
        (-w * .285, h * .842), (-w * .340, h * .885), (-w * .425, h * .902),
        (-w * .468, h * .878), (-w * .484, h * .82),
    ]
    extruded_xz_profile(
        "Pipette holder formed upright", d * .29, stand_profile,
        "porcelain", y=.050, bevel=.007, category="stand",
    )
    box("Pipette holder weighted base", (-w * .365, 0, .018),
        (w * .255, d, .036), "porcelain", .008, "stand")
    box("Pipette holder base wear pad", (-w * .365, 0, .0035),
        (w * .215, d * .88, .008), "rubber", .004, "stand foot")
    # The white shell overlaps the formed upright and the black contact rail is
    # recessed into its underside, so the rack reads as one manufactured part.
    box("Pipette holder overhead spine", (w * .030, .040, h * .872),
        (w * .850, .050, .040), "porcelain", .009, "stand")
    box("Pipette holder black hanger rail", (w * .038, .010, h * .846),
        (w * .815, .014, .025), "black", .004, "holder rail")
    # The reference rack is a true cantilever: the upper beam keys into the
    # shaped left standard.  A shallow black elastomer trim follows that joint
    # and visually proves the load path from base to hanger rail.
    curve_tube(
        "Pipette holder continuous inner trim",
        [
            (-w * .315, .004, .045), (-w * .275, .004, h * .20),
            (-w * .265, .004, h * .63), (-w * .285, .004, h * .79),
            (-w * .335, .004, h * .842), (-w * .385, .004, h * .846),
        ],
        .0045,
        "black",
        "stand trim",
    )

    pipette_types = (
        "manual-micro", "manual-micro", "manual-standard", "manual-standard",
        "electronic", "electronic", "repeater", "repeater",
        "multichannel", "multichannel",
    )
    for index, kind in enumerate(pipette_types):
        x = -w * .16 + index * w * .068
        prefix = f"Pipette {index + 1} {kind}"
        accent = ("teal", "blue_accent", "control_polymer", "teal")[index % 4]
        box(prefix + " upper hanger saddle", (x, -.012, h * .830),
            (.037, .036, .016), "black", .004, "holder contact")
        curve_tube(
            prefix + " hanger throat",
            [(x - .018, -.030, h * .835), (x, -.045, h * .821),
             (x + .018, -.030, h * .835)],
            .0035, "black", "holder contact",
        )
        box(prefix + " lower bumper", (x, .018, h * .505),
            (.027, .018, .011), "rubber", .003, "holder contact")

        if kind.startswith("manual"):
            micro = kind == "manual-micro"
            lathe_profile(prefix + " contoured white body", (x, -.030, 0), [
                (.010, h * .43), (.014, h * .53), (.020, h * .63),
                (.027 if not micro else .024, h * .71),
                (.030 if not micro else .026, h * .78),
                (.025 if not micro else .022, h * .83), (.016, h * .86),
            ], "warm_white", category="pipette body")
            sphere(prefix + " black palm grip", (x, -.050, h * .786),
                   (.018 if micro else .021, .013, .043), "graphite", "pipette grip")
            cyl(prefix + " plunger stem", (x, -.030, h * .885), .0065, .040,
                "control_polymer", category="pipette control")
            cyl(prefix + " plunger cap", (x, -.030, h - .011),
                .012 if micro else .014, .022, "graphite", category="pipette control")
            torus(prefix + " volume collar", (x, -.030, h * .858), .014, .003,
                  accent, category="pipette control")
            box(prefix + " finger hook", (x + .023, -.034, h * .802),
                (.034, .027, .012), "graphite", .004, "pipette grip")
            box(prefix + " volume window", (x, -.057, h * .692),
                (.015, .003, .030), "screen", .002, "volume display")
            for rib in range(3):
                box(prefix + f" side grip rib {rib + 1}",
                    (x + .021, -.046, h * (.748 - rib * .026)),
                    (.012, .005, .008), "graphite", .002, "pipette grip")
            cyl(prefix + " lower barrel", (x, -.030, h * .400),
                .010 if micro else .013, h * .215, "warm_white", category="pipette body")
            cyl(prefix + " nose cone", (x, -.030, h * .275),
                .0055 if micro else .007, h * .105, "aluminum", category="pipette nose")
            cyl(prefix + " disposable tip", (x, -.030, h * .175),
                .0028, h * .112, "milky_pp", category="pipette tip", vertices=18)
        elif kind == "electronic":
            lathe_profile(prefix + " electronic white body", (x, -.030, 0), [
                (.012, h * .43), (.018, h * .54), (.027, h * .66),
                (.034, h * .75), (.032, h * .82), (.021, h * .87),
            ], "warm_white", category="pipette body")
            sphere(prefix + " electronic black palm grip", (x, -.051, h * .796),
                   (.022, .014, .048), "graphite", "pipette grip")
            cyl(prefix + " top control", (x, -.030, h - .012), .014, .024,
                "graphite", category="pipette control")
            box(prefix + " display bezel", (x, -.060, h * .735),
                (.029, .005, .049), "graphite", .003, "display bezel")
            box(prefix + " display glass", (x, -.064, h * .738),
                (.021, .002, .033), "screen", .002, "display")
            box(prefix + " display value", (x, -.066, h * .741),
                (.013, .001, .009), "screen_ui", .001, "display")
            for key_index, key_z in enumerate((h * .690, h * .660), start=1):
                cyl(prefix + f" control key {key_index}", (x, -.061, key_z),
                    .005, .005, accent, axis=(0, 1, 0), category="pipette control")
            box(prefix + " trigger paddle", (x + .027, -.032, h * .805),
                (.017, .038, .052), "black", .004, "pipette grip")
            cyl(prefix + " lower barrel", (x, -.028, h * .445), .015, h * .315,
                "warm_white", category="pipette body")
            cyl(prefix + " nose cone", (x, -.028, h * .245), .009, h * .160,
                "aluminum", category="pipette nose")
            cyl(prefix + " disposable tip", (x, -.028, h * .132), .0038, h * .125,
                "milky_pp", category="pipette tip", vertices=18)
        elif kind == "repeater":
            lathe_profile(prefix + " repeater formed body", (x, -.030, 0), [
                (.018, h * .45), (.028, h * .55), (.034, h * .69),
                (.034, h * .81), (.024, h * .87),
            ], "porcelain", category="pipette body")
            cyl(prefix + " dose selector", (x, -.028, h - .015), .013, .030,
                "graphite", category="pipette control")
            box(prefix + " side dosing lever", (x + .034, -.040, h * .765),
                (.015, .032, h * .12), "black", .004, "pipette grip")
            box(prefix + " volume scale", (x, -.057, h * .705),
                (.022, .003, h * .11), accent, .002, "volume display")
            cyl(prefix + " syringe barrel", (x, -.028, h * .400), .018, h * .260,
                "milky_pp", category="pipette body")
            for mark in range(4):
                torus(prefix + f" barrel graduation {mark + 1}",
                      (x, -.028, h * (.325 + mark * .045)), .0182, .0012,
                      "mid_grey", category="pipette marking")
            cyl(prefix + " syringe plunger", (x, -.028, h * .245), .008, h * .120,
                "aluminum", category="pipette nose")
            cyl(prefix + " positive displacement tip", (x, -.028, h * .142), .004,
                h * .105, "milky_pp", category="pipette tip", vertices=18)
        else:
            lathe_profile(prefix + " multichannel formed body", (x, -.030, 0), [
                (.016, h * .46), (.025, h * .57), (.033, h * .71),
                (.032, h * .81), (.021, h * .87),
            ], "porcelain", category="pipette body")
            sphere(prefix + " multichannel black palm grip", (x, -.052, h * .80),
                   (.021, .014, .050), "graphite", "pipette grip")
            cyl(prefix + " plunger cap", (x, -.030, h - .013), .015, .026,
                "graphite", category="pipette control")
            box(prefix + " channel selector", (x, -.058, h * .720),
                (.025, .004, .046), accent, .003, "volume display")
            cyl(prefix + " lower barrel", (x, -.028, h * .480), .018, h * .260,
                "warm_white", category="pipette body")
            channel_count = 8 if index == 8 else 12
            manifold_width = .080 if channel_count == 8 else .105
            box(prefix + " multichannel manifold", (x, -.028, h * .300),
                (manifold_width, .050, .064), "porcelain", .006, "pipette manifold")
            box(prefix + " manifold lower seal", (x, -.030, h * .263),
                (manifold_width - .006, .046, .012), "cool_grey", .003,
                "pipette manifold")
            spacing = (manifold_width - .018) / max(channel_count - 1, 1)
            for tip_index in range(channel_count):
                tip_x = x + (tip_index - (channel_count - 1) / 2) * spacing
                cyl(prefix + f" channel tip {tip_index + 1}",
                    (tip_x, -.028, h * .165), .0027, h * .170,
                    "milky_pp", category="pipette tip", vertices=16)


def build_plate_reader(spec: f.AssetSpec) -> None:
    w, d, h = spec.width, spec.depth, spec.height
    _batch14_opaque_consumable_materials()
    feet(w * .74, d * .67, .012)
    # Low trapezoidal optical chassis with a sloped upper control hood.  The
    # profile is deliberately tight; molded corner radii are reserved for the
    # enclosure and not sprayed across every seam or inserted component.
    lower_profile = [
        (-d * .43, h * .075), (-d * .502, h * .18),
        (-d * .502, h * .49), (-d * .36, h * .55),
        (d * .405, h * .55), (d * .502, h * .12),
        (d * .38, h * .065),
    ]
    upper_profile = [
        (-d * .365, h * .48), (-d * .355, h * .66),
        (-d * .235, h * .84), (-d * .06, h * .945),
        (d * .31, h * .945), (d * .40, h * .85),
        (d * .40, h * .48),
    ]
    extruded_yz_profile("Reader lower structural chassis", w, lower_profile,
                        "cool_grey", bevel=.007, category="enclosure")
    extruded_yz_profile("Reader formed upper shell", w * .88, upper_profile,
                        "porcelain", bevel=.009, category="formed enclosure")
    # Full-height blue side skins carry the supplied identity and conceal the
    # optical chassis/shell junction from close oblique views.
    for side in (-1, 1):
        cheek = [
            (-d * .405, h * .15), (-d * .405, h * .49),
            (-d * .255, h * .74), (-d * .07, h * .87),
            (d * .335, h * .87), (d * .385, h * .79),
            (d * .385, h * .15),
        ]
        extruded_yz_profile(f"Reader blue side cheek {side:+d}", .014, cheek,
                            "blue_accent", x=side * w * .455, bevel=.003,
                            category="side panel")
    box("Reader lower front return", (0, -d * .400, h * .17),
        (w * .84, .025, h * .22), "warm_white", .005, "enclosure return")
    # Deep, shadowed aperture and a thin cantilevered carrier.  The carrier
    # physically overlaps the aperture, satisfying the 2 mm release gate while
    # still presenting a real movement reveal around the tray.
    box("Reader sample aperture", (0, -d * .420, h * .285),
        (w * .68, .032, h * .235), "graphite", .006, "sample aperture")
    box("Extended microplate carriage", (0, -d * .370, h * .205),
        (w * .72, d * .20, .026), "graphite", .004, "sample tray")
    box("Reader carriage inset", (0, -d * .375, h * .219),
        (w * .64, d * .17, .010), "mid_grey", .003, "sample tray")
    for side in (-1, 1):
        box(f"Reader carriage guide {side:+d}",
            (side * w * .325, -d * .370, h * .220),
            (.014, d * .18, .016), "aluminum", .0025, "sample tray")
        cyl(f"Reader tray detent {side:+d}",
            (side * w * .285, -d * .480, h * .231),
            .005, .014, "stainless", category="sample tray")
    box("Reader aperture safety shutter", (0, -d * .430, h * .36),
        (w * .60, .014, h * .052), "cool_grey", .004, "sample shutter")
    cyl("Reader carriage drive roller", (0, -d * .425, h * .205), .008, w * .52,
        "rubber", axis=(1, 0, 0), category="sample drive")
    box("Microplate body", (0, -d * .400, h * .238),
        (w * .57, d * .18, .026), "well_resin", .003, "sample plate")
    box("Microplate perimeter lip", (0, -d * .400, h * .254),
        (w * .59, d * .19, .010), "well_resin", .002, "sample plate")
    # 8 x 12 wells remain fully opaque in the runtime GLB.  Small amber sample
    # menisci preserve assay readability without transparent material sorting.
    for row in range(8):
        for col in range(12):
            x = (col - 5.5) * w * .0395
            y = -d * .480 + row * d * .018
            cyl("Microplate well collar", (x, y, h * .282), .0061, .012,
                "well_resin", category="sample well", vertices=18)
            if (row * 3 + col) % 4 != 0:
                cyl("Microplate assay meniscus", (x, y, h * .291), .0048, .004,
                    "sample_amber", category="sample", vertices=18)
    panel_rotation = (math.radians(16), 0, 0)
    box("Sloped reader control fascia", (0, -d * .385, h * .704),
        (w * .65, .026, h * .315), "blue_accent", .006,
        "control fascia", rotation=panel_rotation)
    box("Reader touch interface bezel", (0, -d * .407, h * .738),
        (w * .51, .012, h * .238), "graphite", .004, "display bezel",
        rotation=panel_rotation)
    box("Reader touch interface glass", (0, -d * .415, h * .740),
        (w * .458, .004, h * .194), "screen_active", .0025, "display",
        rotation=panel_rotation)
    box("Reader touch cyan assay field", (-w * .115, -d * .419, h * .773),
        (w * .125, .002, h * .032), "screen_ui", .001, "display",
        rotation=panel_rotation)
    box("Reader touch data field", (w * .073, -d * .419, h * .758),
        (w * .16, .002, h * .020), "label", .001, "display",
        rotation=panel_rotation)
    for column, material in enumerate(("screen_ui", "label", "blue_accent")):
        box(f"Reader touch menu column {column + 1}",
            (-w * .13 + column * w * .13, -d * .420, h * .690),
            (w * .095, .002, h * .040), material, .001, "display",
            rotation=panel_rotation)
    for index, x in enumerate((-w * .13, -w * .055, w * .020)):
        box(f"Reader tactile key {index + 1}",
            (x, -d * .423, h * .568), (.032, .007, .020),
            "control_polymer", .0025, "control")
    cyl("Reader confirm key", (w * .17, -d * .424, h * .573),
        .012, .007, "teal", axis=(0, 1, 0), category="control")
    box("Reader crown service seam", (0, d * .10, h * .944),
        (w * .56, d * .31, .006), "cool_grey", .002, "service lid")
    # Restrained side/rear service construction remains all-sided without
    # decorative vent ladders.
    for index, y in enumerate((d * .18, d * .26, d * .34), start=1):
        box(f"Reader right-side service socket {index}",
            (w * .466, y, h * .66), (.007, .030, .015),
            "graphite", .002, "side service")
    box("Reader rear service panel", (0, d * .405, h * .38),
        (w * .70, .012, h * .38), "mid_grey", .004, "rear service")
    box("Reader crown access lid", (0, d * .10, h - .003),
        (w * .54, d * .30, .006), "warm_white", .002, "service lid")
    for index, x in enumerate((-.12, -.06, 0), start=1):
        box(f"Reader rear data port {index}",
            (x, d * .413, h * .31), (.028, .009, .020),
            "graphite", .002, "rear service")
    for x in (-w * .30, w * .30):
        cyl("Reader rear service fastener", (x, d * .416, h * .48), .005, .006,
            "zinc", axis=(0, 1, 0), category="fastener")
    cyl("Reader wireless antenna", (w * .37, d * .37, h * .73), .005, h * .40,
        "graphite", category="antenna")


def build_chest_freezer(spec: f.AssetSpec) -> None:
    w, d, h = spec.width, spec.depth, spec.height
    for x in (-w * .42, w * .42):
        for y in (-d * .40, d * .40):
            cyl("Freezer leveling foot", (x, y, .014), .016, .028,
                "rubber", category="foot")
            cyl("Freezer foot stem", (x, y, .035), .007, .026,
                "zinc", category="fastener")
    # A broad, softly radiused insulated chest.  Horizontal trim and the long
    # front lock/controller bar counter the formerly tall appliance silhouette
    # while keeping the existing canonical dimensions and floor footprint.
    cabinet_profile = [
        (-d * .435, h * .055), (-d * .465, h * .11),
        (-d * .465, h * .845), (d * .465, h * .845),
        (d * .455, h * .12), (d * .39, h * .055),
    ]
    extruded_yz_profile("Chest ULT insulated cabinet", w * .94, cabinet_profile,
                        "warm_white", bevel=.010, category="insulated enclosure")
    box("Chest ULT lower service plinth", (0, .02, h * .085),
        (w * .89, d * .86, h * .10), "cool_grey", .006, "service plinth")
    box("Chest ULT lower shadow return", (0, -d * .445, h * .095),
        (w * .87, .018, h * .075), "mid_grey", .003, "service plinth")
    # The gasket is a real dark compressible band, captured between cabinet and
    # lid with overlap at both interfaces for the continuity release test.
    box("Chest ULT top gasket", (0, 0, h * .852),
        (w * .935, d * .915, h * .040), "seal", .004, "gasket")
    box("Chest ULT insulated lid", (0, 0, h * .935 - .002),
        (w, d, h * .130), "porcelain", .013, "lid")
    box("Chest ULT lid inset panel", (0, 0, h - .005),
        (w * .87, d * .84, .010), "warm_white", .004, "lid")
    box("Chest ULT lid perimeter cap", (0, -d * .455, h * .910),
        (w * .94, .027, h * .052), "cool_grey", .004, "lid trim")
    for x in (-w * .46, w * .46):
        box("Chest ULT lid side cap", (x, 0, h * .910),
            (.028, d * .87, h * .052), "cool_grey", .004, "lid trim")
    # One reference-led horizontal lock/controller assembly rather than a small
    # floating black block and unrelated screen.
    box("Chest ULT controller bridge", (0, -d * .450, h * .805),
        (w * .40, .036, h * .080), "cool_grey", .006, "controller housing")
    box("Chest ULT front latch handle", (0, -d * .475, h * .820),
        (w * .39, .032, h * .045), "black", .006, "handle")
    box("Chest ULT latch strike", (0, -d * .452, h * .770),
        (w * .12, .025, h * .038), "stainless", .004, "latch")
    screen("Chest ULT controller", (0, -d * .470, h * .805),
           (w * .16, .017, h * .047))
    for index, x in enumerate((-w * .105, w * .105), start=1):
        box(f"Chest ULT membrane key bank {index}",
            (x, -d * .492, h * .805), (w * .037, .005, h * .025),
            "control_polymer", .002, "control")
    cyl("Chest ULT alarm indicator", (w * .150, -d * .494, h * .805),
        .006, .005, "teal", axis=(0, 1, 0), category="indicator")
    # Subtle front panel datum and side insulation returns prevent the body from
    # reading as one uninterrupted white cube.
    box("Chest ULT front upper trim", (0, -d * .469, h * .735),
        (w * .89, .012, .014), "cool_grey", .002, "manufactured seam")
    for x in (-w * .28, w * .28):
        box("Chest ULT rear lid hinge", (x, d * .472, h * .856),
            (w * .12, .034, .052), "aluminum", .004, "hinge")
        cyl("Chest ULT hinge pin", (x, d * .480, h * .856), .008, w * .13,
            "zinc", axis=(1, 0, 0), category="hinge")
    for side in (-1, 1):
        tube_between(f"Chest ULT lid support cylinder {side:+d}",
                     (side * w * .425, d * .30, h * .69),
                     (side * w * .425, d * .445, h * .875), .010,
                     "aluminum", "lid support")
        tube_between(f"Chest ULT lid support piston {side:+d}",
                     (side * w * .425, d * .34, h * .74),
                     (side * w * .425, d * .43, h * .855), .005,
                     "stainless", "lid support")
        cyl(f"Chest ULT lid support pivot {side:+d}",
            (side * w * .425, d * .30, h * .69), .016, .014,
            "black", axis=(1, 0, 0), category="hinge")
    # Condenser detail is confined to the lower rear side, as on an insulated
    # appliance, instead of dominating the product silhouette.
    box("Chest ULT side condenser recess", (w * .472, d * .16, h * .215),
        (.010, d * .24, h * .21), "graphite", .003, "ventilation")
    vent_bank("Chest ULT side condenser", (w * .478, d * .16, h * .215),
              7, .025, (.008, d * .20, .008))
    box("Chest ULT rear compressor cover", (0, d * .460, h * .21),
        (w * .64, .018, h * .27), "mid_grey", .005, "rear service")
    vent_bank("Chest ULT rear exhaust", (0, d * .470, h * .23), 7, .042,
              (.020, .006, .012), axis="x")
    box("Chest ULT power inlet", (-w * .30, d * .470, h * .135),
        (.052, .010, .043), "graphite", .003, "rear service")
    cyl("Chest ULT pressure equalization port", (w * .37, -d * .460, h * .50),
        .015, .014,
        "aluminum", axis=(0, 1, 0), category="service port")
    for side in (-1, 1):
        box(f"Chest ULT side insulation seam {side:+d}",
            (side * w * .472, -.04, h * .48), (.005, d * .66, h * .56),
            "cool_grey", .0015, "service seam")


def add_square_leg(name: str, x: float, y: float, height: float, material: str) -> None:
    box(name, (x, y, height / 2), (.055, .055, height), material, .006, "frame")
    cyl(name + " glide", (x, y, .011), .023, .022, "rubber", category="foot")
    cyl(name + " stem", (x, y, .033), .008, .030, "zinc", category="fastener")


def add_keyboard(name: str, x: float, y: float, z: float, width: float = .44) -> None:
    box(name + " chassis", (x, y, z), (width, .155, .024), "warm_white", .009, "keyboard")
    for row in range(5):
        for col in range(14):
            box(name + " key", (x - width * .44 + col * width * .067, y - .052 + row * .025, z + .018),
                (width * .050, .018, .006), "porcelain", .0015, "keyboard")


def add_case_fan(name: str, xyz: tuple[float, float, float], radius: float) -> None:
    """A real recessed axial fan, not a luminous circle pasted on a tower."""
    x, y, z = xyz
    cyl(name + " recess", (x, y + .004, z), radius * .92, .010,
        "shadow", axis=(0, 1, 0), category="cooling fan", vertices=40)
    torus(name + " shroud", (x, y - .004, z), radius, radius * .105,
          "black_powder", (0, 1, 0), "cooling fan")
    cyl(name + " hub", (x, y - .010, z), radius * .22, .018,
        "mid_grey", axis=(0, 1, 0), category="cooling fan", vertices=32)
    for index in range(7):
        angle = index * math.tau / 7 + .18
        blade_radius = radius * .53
        box(
            name + f" blade {index + 1}",
            (x + math.sin(angle) * blade_radius, y - .012,
             z + math.cos(angle) * blade_radius),
            (radius * .18, .010, radius * .62),
            "cool_grey", .003, "cooling fan",
            rotation=(0, angle - .38, 0),
        )
    torus(name + " restrained accent", (x, y - .020, z), radius * .82,
          radius * .035, "screen_ui", (0, 1, 0), "cooling fan")


def build_gpu_workstation(spec: f.AssetSpec) -> None:
    w, d, h = spec.width, spec.depth, spec.height
    top_z = .735
    top_thickness = .045
    top_bottom = top_z - top_thickness / 2
    # The supplied workstation uses a dark, low-glare desk surface.  The frame
    # penetrates its underside by 4 mm so no studio or room light leaks through
    # an impossible unsupported joint.
    box("Analysis workstation top", (0, 0, top_z), (w, d, top_thickness),
        "charcoal_laminate", .008, "worktop")
    box("Analysis workstation graphite edge", (0, -d * .5 + .011, top_z), (w, .022, .046),
        "black_powder", .003, "worktop edge")
    for x in (-w * .46, w * .46):
        add_square_leg("Analysis workstation leg", x, 0, top_bottom + .004, "aluminum")
        box("Analysis workstation T foot", (x, 0, .045), (.12, d * .78, .045),
            "cool_grey", .008, "frame")
        box("Analysis workstation end head rail", (x, 0, top_bottom - .030),
            (.070, d * .78, .064), "aluminum", .006, "frame")
    box("Analysis workstation rear head rail", (0, d * .42, top_bottom - .030),
        (w * .88, .065, .064), "aluminum", .006, "frame")
    box("Analysis workstation cable trough", (0, d * .36, .61), (w * .72, .11, .10),
        "mid_grey", .008, "cable management")

    # Reference-scale 30-inch display with a complete rear housing and V stand.
    mx, my, mz = -.31, .18, 1.075
    box("Analysis monitor rear enclosure", (mx, my, mz), (.75, .050, .43),
        "mid_grey", .010, "monitor")
    box("Analysis monitor bezel", (mx, my - .030, mz), (.765, .022, .44),
        "graphite", .007, "monitor")
    box("Analysis monitor cover glass", (mx, my - .044, mz), (.715, .004, .392),
        "screen", .002, "display")
    # Restrained original scientific UI: hierarchy and plotted data, no copied screenshot.
    box("Analysis display header", (mx, my - .048, mz + .156), (.66, .002, .035),
        "blue_accent", .001, "display")
    box("Analysis display plot field", (mx - .13, my - .049, mz + .015), (.36, .002, .205),
        "screen_active", .001, "display")
    for index, z in enumerate((mz + .070, mz + .020, mz - .030, mz - .080), start=1):
        box(f"Analysis display plot trace {index}", (mx - .13 + index * .018,
            my - .052, z), (.27 - index * .018, .002, .006),
            "screen_ui", .001, "display")
    for index, z in enumerate((mz + .09, mz + .015, mz - .06), start=1):
        box(f"Analysis display result card {index}", (mx + .245, my - .049, z),
            (.13, .002, .050), "cool_grey" if index % 2 else "teal",
            .001, "display")
    box("Analysis monitor neck", (mx, my + .005, .865), (.052, .060, .205),
        "aluminum", .006, "monitor stand")
    cyl("Analysis monitor stand pivot", (mx, my - .005, .925), .027, .060,
        "graphite", axis=(0, 1, 0), category="monitor stand")
    tube_between("Analysis monitor left V foot", (mx, my, .772),
                 (mx - .205, my - .13, .758), .013, "mid_grey", "monitor stand")
    tube_between("Analysis monitor right V foot", (mx, my, .772),
                 (mx + .205, my - .13, .758), .013, "mid_grey", "monitor stand")
    vent_bank("Analysis monitor rear", (mx, my + .030, 1.00), 9, .050,
              (.026, .005, .006), axis="x")
    box("Analysis desk mat", (-.18, -.13, .763), (.92, .39, .008),
        "seal", .008, "desktop accessory")
    add_keyboard("Analysis keyboard", -.33, -.15, .775, width=.48)
    sphere("Analysis mouse", (.14, -.15, .79), (.036, .052, .024),
           "warm_white", "desktop accessory")
    box("Analysis keyboard wrist rest", (-.33, -.275, .776), (.39, .065, .018),
        "warm_white", .008, "desktop accessory")

    # Tempered-side compute tower built as a real frame, not an opaque box with
    # a transparent decal. All internal assemblies remain readable through the
    # one physically intentional smoked panel.
    cx, cy = .56, .08
    tw, td = .40, .48
    tower_bottom = top_z + top_thickness * .5
    th = h - tower_bottom
    tower_top = tower_bottom + th
    tower_mid = (tower_bottom + tower_top) * .5
    box("Compute tower floor", (cx, cy, tower_bottom + .015),
        (tw, td, .030), "black_powder", .005, "computer enclosure")
    box("Compute tower roof", (cx, cy, tower_top - .015),
        (tw, td, .030), "warm_white", .006, "computer enclosure")
    box("Compute tower opaque right side", (cx - tw * .5 + .012, cy, tower_mid),
        (.024, td, th - .05), "warm_white", .006, "computer enclosure")
    box("Compute tower rear service wall", (cx, cy + td * .5 - .012, tower_mid),
        (tw, .024, th - .05), "mid_grey", .004, "rear service")
    box("Compute tower front frame", (cx, cy - td * .5 + .010, tower_mid),
        (tw, .020, th - .045), "graphite", .005, "computer enclosure")
    for x in (cx - tw * .5 + .018, cx + tw * .5 - .018):
        for y in (cy - td * .5 + .020, cy + td * .5 - .020):
            box("Compute tower vertical chassis rail", (x, y, tower_mid),
                (.032, .032, th - .045), "aluminum", .004, "computer frame")
    glass_x = cx + tw * .5 + .003
    box("Compute tower smoked tempered side panel", (glass_x, cy, tower_mid),
        (.008, td * .91, th * .90), "smoked_tempered", .002, "tempered side glazing")
    for y in (cy - td * .39, cy + td * .39):
        for z in (tower_bottom + th * .10, tower_top - th * .10):
            cyl("Compute tower glass standoff", (glass_x + .008, y, z), .006, .010,
                "black", axis=(1, 0, 0), category="fastener", vertices=24)
    # Internals are offset toward the visible side and include real mounting depth.
    board_x = cx + tw * .31
    box("Compute tower motherboard tray", (board_x, cy + .035, tower_mid + .015),
        (.016, td * .67, th * .61), "teal", .003, "computer internals")
    for index, y in enumerate((cy - .075, cy - .025, cy + .025, cy + .075), start=1):
        box(f"Compute tower memory module {index}", (board_x + .014, y, tower_mid + .105),
            (.018, .018, .115), "blue_accent" if index % 2 else "screen_ui",
            .002, "computer internals")
    box("Compute tower graphics card", (board_x + .020, cy - .025, tower_mid - .055),
        (.032, td * .57, .075), "mid_grey", .005, "computer internals")
    box("Compute tower graphics card edge", (board_x + .041, cy - .025, tower_mid - .055),
        (.012, td * .53, .026), "blue_accent", .003, "computer internals")
    box("Compute tower power-supply shroud", (cx, cy + .035, tower_bottom + .085),
        (tw * .76, td * .73, .125), "warm_white", .006, "computer internals")
    box("Compute tower cable comb", (board_x + .025, cy + .13, tower_mid + .02),
        (.018, .045, .14), "graphite", .003, "computer internals")
    for index, z in enumerate((tower_bottom + .145, tower_bottom + .285, tower_bottom + .425), start=1):
        add_case_fan(f"Compute tower front fan {index}",
                     (cx, cy - td * .5 - .008, z), .052)
    add_case_fan("Compute tower processor cooler",
                 (cx + tw * .27, cy + .030, tower_mid + .090), .050)
    vent_bank("Compute tower rear exhaust", (cx, cy + td * .5 + .004, tower_mid + .13),
              7, .043, (.024, .006, .010), axis="x")
    box("Compute tower rear power inlet", (cx + .10, cy + td * .5 + .004,
        tower_bottom + .075), (.055, .010, .045), "black", .003, "rear service")
    box("Compute tower top I-O strip", (cx - .06, cy - .12, tower_top - .013),
        (.15, .055, .008), "graphite", .003, "computer control")
    cyl("Compute tower power key", (cx - .10, cy - .12, tower_top - .008),
        .010, .008, "control_polymer", category="computer control", vertices=24)
    for index, x in enumerate((cx - .04, cx, cx + .04), start=1):
        box(f"Compute tower top port {index}", (x, cy - .12, tower_top - .008),
            (.020, .012, .006), "screen_ui" if index == 2 else "graphite",
            .002, "computer control")
    tube_between("Workstation monitor cable", (mx, my + .040, .91),
                 (-.15, .34, .70), .004, "rubber", "cable")
    tube_between("Workstation tower cable", (cx + .10, cy + td * .5, tower_bottom + .075),
                 (.38, .36, .68), .004, "rubber", "cable")


def build_pedestal_desk(spec: f.AssetSpec, style: str) -> None:
    w, d, h = spec.width, spec.depth, spec.height
    name = {
        "steel": "Steel pedestal desk",
        "wood": "Walnut pedestal desk",
        "maple": "Maple steel desk",
    }[style]
    top_material = {"steel": "warm_white", "wood": "walnut", "maple": "maple"}[style]
    edge_material = {"steel": "cool_grey", "wood": "walnut_edge", "maple": "maple_edge"}[style]
    frame_material = "walnut" if style == "wood" else "powder"
    face_material = "walnut" if style == "wood" else "powder_light"
    top_thickness = .032
    box(name + " work surface", (0, 0, h - top_thickness * .5),
        (w, d, top_thickness), top_material, .008, "worktop")
    for y in (-d * .48, d * .48):
        box(name + " edge band", (0, y, h - top_thickness * .5),
            (w - .080, .020, top_thickness + .002), edge_material, .003, "worktop edge")

    pedestal_w = w * .33
    px = w * .5 - pedestal_w * .5 - .035
    left_x = -w * .5 + .055
    top_bottom = h - top_thickness
    support_top = top_bottom + .004
    support_bottom = .024
    support_height = support_top - support_bottom
    if style == "wood":
        box(name + " left slab", (left_x, .02, (support_top + support_bottom) * .5),
            (.055, d * .88, support_height),
            "walnut", .005, "frame")
        box(name + " rear modesty panel", (-w * .10, d * .42, h * .40),
            (w * .52, .035, h * .60),
            "walnut", .004, "modesty panel")
        box(name + " low modesty return", (w * .29, d * .43, h * .22), (w * .17, .030, h * .25),
            "walnut_edge", .003, "modesty panel")
        cyl(name + " left front glide", (left_x, -d * .38, .012), .020, .024, "rubber", category="foot")
        cyl(name + " left rear glide", (left_x, d * .38, .012), .020, .024, "rubber", category="foot")
    else:
        box(name + " left C-leg upright", (left_x, d * .25, (support_top + .050) * .5),
            (.052, .052, support_top - .050),
            frame_material, .006, "frame")
        box(name + " left C-leg foot", (left_x, -.01, .045), (.09, d * .86, .055),
            frame_material, .008, "frame")
        box(name + " left C-leg upper bearer", (left_x, -.01, top_bottom - .018),
            (.09, d * .86, .044), frame_material, .006, "frame")
        for y in (-d * .36, d * .36):
            box(name + " left C-leg weld collar", (left_x, y, .075),
                (.094, .018, .018), "powder_dark", .003, "weld")
        cyl(name + " left front glide", (left_x, -d * .39, .012), .020, .024, "rubber", category="foot")
        cyl(name + " left rear glide", (left_x, d * .39, .012), .020, .024, "rubber", category="foot")
        box(name + " rear modesty panel", (-w * .10, d * .43, h * .42), (w * .54, .028, h * .49),
            "powder", .004, "modesty panel")

    # Continuous pedestal carcass: its side gables and roof positively bear on
    # the work surface.  The previous percentage-height sides ended 160 mm low
    # and made the entire drawer pedestal appear to float.
    pedestal_y = .015
    pedestal_depth = d * .88
    carcass_center_z = (support_top + support_bottom) * .5
    box(name + " pedestal left side", (px - pedestal_w * .5 + .012, pedestal_y, carcass_center_z),
        (.024, pedestal_depth, support_height), frame_material, .004, "carcass")
    box(name + " pedestal right side", (px + pedestal_w * .5 - .012, pedestal_y, carcass_center_z),
        (.024, pedestal_depth, support_height), frame_material, .004, "carcass")
    box(name + " pedestal rear", (px, pedestal_y + pedestal_depth * .5 - .012,
        carcass_center_z), (pedestal_w - .04, .025, support_height),
        frame_material, .004, "carcass")
    box(name + " pedestal roof bearing", (px, pedestal_y, top_bottom - .006),
        (pedestal_w - .030, pedestal_depth - .020, .016), frame_material, .003, "carcass")
    box(name + " pedestal bottom", (px, pedestal_y, .045), (pedestal_w - .03, pedestal_depth - .02, .030),
        "interior", .003, "carcass")
    box(name + " drawer reveal backing", (px, -d * .421, support_height * .52),
        (pedestal_w - .034, .010, support_height - .040),
        "shadow", .001, "fixed face frame")
    # Exact 8 mm manufactured face reveals; no overlap between the lower two
    # fronts and no exposed empty channel at either outer gable.
    heights = (.120, .190, top_bottom - .012 - .070 - .120 - .190 - .016)
    top_cursor = top_bottom - .012
    centers = []
    for face_height in heights:
        centers.append(top_cursor - face_height * .5)
        top_cursor -= face_height + .008
    for index, (fh, z) in enumerate(zip(heights, centers), start=1):
        prefix = f"{name} drawer {index}"
        box(prefix + " front", (px, -d * .435, z), (pedestal_w - .025, .022, fh),
            face_material, .004, "drawer front")
        box(prefix + " handle", (px, -d * .458, z + fh * .17),
            (pedestal_w * .48, .018, .024), "black", .004, "drawer pull")
        if index == 1:
            cyl(prefix + " lock barrel", (px + pedestal_w * .32, -d * .455, z + fh * .18),
                .011, .012, "stainless", (0, 1, 0), "lock")
    box(name + " front inner return", (px - pedestal_w * .5 + .006, -d * .420,
        carcass_center_z),
        (.015, .060, support_height), frame_material, .002, "fixed face frame")
    box(name + " opposite inner return", (px + pedestal_w * .5 - .006, -d * .420,
        carcass_center_z), (.015, .060, support_height), frame_material, .002, "fixed face frame")
    # A concealed rear spine joins the C/slab support to the pedestal and
    # overlaps the underside of the top, producing a credible rigid desk frame.
    spine_left = left_x
    spine_right = px + pedestal_w * .5 - .012
    box(name + " under-top structural spine", ((spine_left + spine_right) * .5,
        d * .38, top_bottom - .026), (spine_right - spine_left, .052, .056),
        frame_material, .004, "frame")
    for x in (px - pedestal_w * .38, px + pedestal_w * .38):
        for y in (-d * .38, d * .38):
            cyl(name + " pedestal leveling glide", (x, y, .012), .018, .024,
                "rubber", category="foot")
    box(name + " pedestal toe guard", (px, -d * .420, .055), (pedestal_w - .05, .035, .065),
        "powder_dark", .004, "toe kick")


def build_utility_table(spec: f.AssetSpec) -> None:
    w, d, h = spec.width, spec.depth, spec.height
    top_thickness = .032
    top_center = h - top_thickness / 2
    top_bottom = h - top_thickness
    box("Utility table graphite work surface", (0, 0, top_center),
        (w - .032, d - .032, top_thickness),
        "charcoal_laminate", .005, "worktop")
    for y in (-d * .5 + .008, d * .5 - .008):
        box("Utility table sealed long edge", (0, y, top_center),
            (w - .016, .016, top_thickness), "graphite", .002, "worktop edge")
    for x in (-w * .5 + .008, w * .5 - .008):
        box("Utility table sealed end edge", (x, 0, top_center),
            (.016, d, top_thickness), "graphite", .002, "worktop edge")
    for x in (-w * .465, w * .465):
        for y in (-d * .44, d * .44):
            leg_bottom = .024
            leg_top = top_bottom + .004
            box("Utility table square tube leg", (x, y, (leg_top + leg_bottom) * .5),
                (.065, .065, leg_top - leg_bottom),
                "black_powder", .003, "frame")
            cyl("Utility table adjustable glide", (x, y, .012), .025, .024,
                "rubber", category="foot")
            cyl("Utility table threaded stem", (x, y, .037), .008, .030,
                "zinc", category="fastener")
    for y in (-d * .44, d * .44):
        box("Utility table long apron", (0, y, top_bottom - .039), (w * .88, .065, .082),
            "black_powder", .003, "frame")
    for x in (-w * .465, w * .465):
        box("Utility table end apron", (x, 0, top_bottom - .039), (.065, d * .80, .082),
            "black_powder", .003, "frame")
        for y in (-d * .34, d * .34):
            box("Utility table welded corner gusset", (x, y, top_bottom - .075),
                (.075, .10, .018), "black_powder", .002, "welded joint")
            cyl("Utility table weld bead", (x, y, top_bottom - .050), .006, .055,
                "powder_dark", axis=(0, 0, 1), category="weld", vertices=20)
    # The supplied reference is a deliberately plain four-leg table.  There is
    # no rear stretcher, grommet, inset panel or decorative service plate.


def add_printer_keys(prefix: str, x: float, y: float, z: float) -> None:
    for row in range(2):
        for col in range(3):
            box(prefix + " control key", (x + col * .022, y, z + row * .024),
                (.016, .006, .016), "aluminum" if col < 2 else "teal", .003, "control")


def _build_high_volume_printer_legacy(spec: f.AssetSpec) -> None:
    w, d, h = spec.width, spec.depth, spec.height
    feet(w * .78, d * .74, .012)
    scanner_center = h * .76
    scanner_height = h * .25
    scanner_bottom = scanner_center - scanner_height * .5
    chassis_bottom = .030
    chassis_top = scanner_bottom + .004
    high_base_profile = [
        (-d * .44, chassis_bottom), (-d * .465, h * .10),
        (-d * .465, chassis_top), (d * .44, chassis_top),
        (d * .45, h * .10), (d * .39, chassis_bottom),
    ]
    extruded_yz_profile("High-volume printer lower chassis", w * .94,
                        high_base_profile, "warm_white", bevel=.014,
                        category="enclosure")
    for index, z in enumerate((h * .13, h * .29), start=1):
        box(f"High-volume printer cassette {index}", (-w * .04, -d * .45, z),
            (w * .70, .030, h * .18), "powder_light", .006, "paper cassette")
        box(f"High-volume printer cassette {index} handle", (-w * .04, -d * .472, z + .01),
            (w * .22, .025, .035), "black", .008, "handle")
        for side in (-1, 1):
            box(f"High-volume printer cassette {index} runner {side:+d}",
                (-w * .04 + side * w * .335, -d * .462, z),
                (.012, .012, h * .155), "mid_grey", .002, "paper cassette runner")
    box("High-volume printer output aperture", (-w * .10, -d * .458, h * .47),
        (w * .61, .025, h * .20), "graphite", .010, "paper path")
    box("High-volume printer output shelf", (-w * .10, -d * .34, h * .39),
        (w * .58, d * .20, .025), "cool_grey", .006, "paper path")
    box("High-volume printer output sheet", (-w * .10, -d * .39, h * .405),
        (w * .46, d * .16, .004), "label", .003, "paper")
    for x in (-w * .24, w * .04):
        cyl("High-volume printer output roller", (x, -d * .465, h * .43),
            .012, w * .18, "rubber", axis=(1, 0, 0), category="paper path")
    scanner_profile = [
        (-d * .49, scanner_bottom), (-d * .49, h * .79),
        (-d * .42, h * .86), (d * .43, h * .86),
        (d * .48, h * .78), (d * .48, scanner_bottom),
    ]
    extruded_yz_profile("High-volume printer upper scanner body", w, scanner_profile,
                        "porcelain", x=-w * .03, bevel=.016, category="scanner")
    box("High-volume printer scanner seam", (-w * .03, -d * .02, h * .84),
        (w * .89, d * .84, .012), "seal", .003, "scanner gasket")
    box("High-volume printer scanner lid", (-w * .06, .015, h * .91),
        (w * .90, d * .82, h * .12), "cool_grey", .018, "scanner lid")
    adf_profile = [
        (-d * .08, h * .875), (-d * .05, h * .965),
        (d * .31, h * .985), (d * .37, h * .935),
        (d * .34, h * .875),
    ]
    extruded_yz_profile("High-volume printer ADF base", w * .59, adf_profile,
                        "mid_grey", x=-w * .18, bevel=.010,
                        category="document feeder")
    box("High-volume printer ADF input tray", (-w * .22, d * .28, h - .0125),
        (w * .54, d * .31, .025), "mid_grey", .007, "document feeder")
    box("High-volume printer ADF raised document support", (-w * .22, d * .42, h * .995),
        (w * .47, .022, h * .16), "cool_grey", .007, "document feeder")
    box("High-volume printer ADF reference sheet", (-w * .22, d * .30, h * 1.012),
        (w * .42, d * .25, .004), "label", .002, "paper")
    box("High-volume printer ADF paper guide", (-w * .22, d * .31, h - .006),
        (w * .18, d * .18, .020), "cool_grey", .005, "document feeder")
    box("High-volume printer ADF feed throat", (-w * .18, -d * .055, h * .925),
        (w * .39, .018, h * .055), "graphite", .006, "document feeder")
    box("High-volume printer ADF separator cover", (-w * .18, d * .075, h * .958),
        (w * .32, d * .14, h * .055), "cool_grey", .008, "document feeder")
    cyl("High-volume printer ADF pickup roller", (-w * .18, d * .08, h * .93),
        .014, w * .31, "rubber", axis=(1, 0, 0), category="document feeder")
    for x in (-w * .35, w * .25):
        cyl("High-volume printer scanner hinge", (x, d * .41, h * .865),
            .016, w * .12, "aluminum", axis=(1, 0, 0), category="scanner hinge")
    screen("High-volume printer touch panel", (-w * .30, -d * .49, h * .72),
           (w * .27, .030, h * .15))
    add_printer_keys("High-volume printer", -w * .19, -d * .51, h * .67)
    box("High-volume printer ink service door", (w * .36, -d * .46, h * .48),
        (w * .18, .025, h * .35), "powder_light", .006, "service door")
    box("High-volume printer front shoulder seam", (0, -d * .475, h * .62),
        (w * .93, .007, .010), "seal", .002, "manufactured seam")
    box("High-volume printer left electronics column", (-w * .43, -d * .455, h * .46),
        (w * .10, .026, h * .48), "cool_grey", .006, "control housing")
    for index, (x, material) in enumerate(zip((.16, .19, .22, .25),
        ("ink_cyan", "ink_magenta", "ink_yellow", "graphite")), start=1):
        box(f"High-volume printer ink level {index}", (x, -d * .478, h * .46),
            (.018, .010, h * .11), material, .003, "ink indicator")
    box("High-volume printer rear service panel", (0, d * .46, h * .46),
        (w * .78, .018, h * .52), "mid_grey", .008, "rear service")
    vent_bank("High-volume printer rear exhaust", (0, d * .473, h * .56), 8, .045,
              (.025, .006, .010), axis="x")
    box("High-volume printer rear mains inlet", (w * .28, d * .475, h * .28),
        (.065, .010, .050), "graphite", .004, "rear service")
    for index, x in enumerate((w * .15, w * .21), start=1):
        box(f"High-volume printer rear data socket {index}", (x, d * .475, h * .32),
            (.030, .010, .022), "graphite", .003, "rear service")
    for x in (-w * .34, w * .34):
        for z in (h * .24, h * .67):
            cyl("High-volume printer rear service fastener", (x, d * .476, z),
                .006, .008, "zinc", axis=(0, 1, 0), category="fastener")


def build_high_volume_printer(spec: f.AssetSpec) -> None:
    """Wide office/laboratory MFP with a left-offset ADF and service bay."""
    w, d, h = spec.width, spec.depth, spec.height
    feet(w * .80, d * .76, .010)

    # Broad asymmetrical chassis. The shell overlaps the scanner deck and all
    # front modules seat inside a continuous molded return.
    scanner_bottom = h * .635
    chassis_profile = [
        (-d * .455, .028), (-d * .492, h * .085),
        (-d * .492, h * .585), (-d * .445, scanner_bottom + .010),
        (d * .445, scanner_bottom + .010), (d * .470, h * .54),
        (d * .435, h * .08), (d * .36, .028),
    ]
    extruded_yz_profile(
        "High-volume printer lower chassis", w * .96, chassis_profile,
        "warm_white", bevel=.009, category="enclosure",
    )
    box("High-volume printer lower chassis front return", (0, -d * .478, h * .34),
        (w * .89, .018, h * .50), "porcelain", .004, "enclosure return")
    box("High-volume printer base shadow line", (0, -d * .455, h * .050),
        (w * .84, .018, .012), "seal", .002, "manufactured seam")

    # Two seated paper cassettes with narrow runner reveals and recessed pulls.
    cassette_x = -w * .045
    cassette_width = w * .665
    for index, (z, face_height) in enumerate(
        ((h * .135, h * .145), (h * .285, h * .135)), start=1,
    ):
        box(f"High-volume printer cassette {index} surround",
            (cassette_x, -d * .480, z),
            (cassette_width + .014, .010, face_height + .012),
            "mid_grey", .003, "paper cassette surround")
        box(f"High-volume printer cassette {index}",
            (cassette_x, -d * .490, z),
            (cassette_width, .018, face_height),
            "powder_light", .004, "paper cassette")
        box(f"High-volume printer cassette {index} recessed handle",
            (cassette_x, -d * .494, z + face_height * .12),
            (w * .195, .015, .025), "graphite", .005, "handle")
        for side in (-1, 1):
            box(f"High-volume printer cassette {index} runner {side:+d}",
                (cassette_x + side * (cassette_width * .5 + .006),
                 -d * .485, z),
                (.006, .012, face_height * .82), "cool_grey", .0015,
                "paper cassette runner")

    # Deep central output path with bearing roof/floor, rollers, and a sheet.
    output_x = -w * .075
    box("High-volume printer output aperture back",
        (output_x, -d * .495, h * .485),
        (w * .53, .006, h * .175), "graphite", .003, "paper path")
    box("High-volume printer output cavity roof",
        (output_x, -d * .435, h * .572),
        (w * .55, d * .105, .018), "cool_grey", .003, "paper path")
    box("High-volume printer output shelf",
        (output_x, -d * .397, h * .405),
        (w * .53, d * .17, .024), "cool_grey", .004, "paper path")
    box("High-volume printer output sheet",
        (output_x, -d * .423, h * .420),
        (w * .42, d * .13, .004), "label", .0015, "paper")
    for x in (output_x - w * .16, output_x + w * .16):
        cyl("High-volume printer output pinch roller",
            (x, -d * .488, h * .542), .009, w * .13,
            "rubber", axis=(1, 0, 0), category="paper path")

    # Layered scanner deck; the body overlaps the lower shell by 8 mm.
    scanner_profile = [
        (-d * .485, scanner_bottom), (-d * .485, h * .735),
        (-d * .435, h * .785), (d * .430, h * .785),
        (d * .475, h * .730), (d * .475, scanner_bottom),
    ]
    extruded_yz_profile(
        "High-volume printer upper scanner body", w, scanner_profile,
        "porcelain", x=-w * .012, bevel=.008, category="scanner",
    )
    box("High-volume printer scanner platen gasket",
        (-w * .012, .005, h * .782), (w * .88, d * .82, .008),
        "seal", .002, "scanner gasket")
    box("High-volume printer scanner lid",
        (-w * .040, .018, h * .825), (w * .89, d * .80, h * .080),
        "cool_grey", .009, "scanner lid")
    for x in (-w * .34, w * .26):
        cyl("High-volume printer scanner hinge",
            (x, d * .410, h * .805), .012, w * .105,
            "aluminum", axis=(1, 0, 0), category="scanner hinge")

    # Left-offset automatic document feeder with a real throat and guides.
    adf_x = -w * .175
    adf_profile = [
        (-d * .20, h * .852), (-d * .17, h * .920),
        (-d * .07, h * .955), (d * .25, h * .955),
        (d * .33, h * .925), (d * .31, h * .852),
    ]
    extruded_yz_profile(
        "High-volume printer offset ADF body", w * .57,
        adf_profile, "mid_grey", x=adf_x, bevel=.006,
        category="document feeder",
    )
    box("High-volume printer ADF feed throat",
        (adf_x, -d * .182, h * .885), (w * .38, .018, h * .050),
        "graphite", .003, "document feeder")
    cyl("High-volume printer ADF pickup roller",
        (adf_x, -d * .165, h * .902), .010, w * .34,
        "rubber", axis=(1, 0, 0), category="document feeder")
    box("High-volume printer ADF separator cover",
        (adf_x, d * .035, h * .948), (w * .43, d * .20, h * .035),
        "cool_grey", .005, "document feeder")
    box("High-volume printer ADF input tray",
        (adf_x - w * .02, d * .315, h * .965),
        (w * .49, d * .27, .018), "mid_grey", .004, "document feeder")
    for side in (-1, 1):
        box(f"High-volume printer ADF side guide {side:+d}",
            (adf_x + side * w * .18, d * .305, h * .978),
            (.014, d * .20, .022), "cool_grey", .003, "document feeder")
    box("High-volume printer ADF reference sheet",
        (adf_x - w * .015, d * .315, h * .979),
        (w * .37, d * .20, .003), "label", .001, "paper")

    # Opaque left control pod and touchscreen; no metallic control keys.
    control_x = -w * .355
    box("High-volume printer left control pod",
        (control_x, -d * .480, h * .665),
        (w * .22, .030, h * .165), "cool_grey", .006, "control housing")
    box("High-volume printer touchscreen bezel",
        (control_x, -d * .495, h * .675),
        (w * .165, .014, h * .115), "graphite", .004, "display bezel")
    box("High-volume printer opaque touchscreen",
        (control_x, -d * .504, h * .678),
        (w * .140, .004, h * .088), "screen_active", .002, "display")
    box("High-volume printer touch status field",
        (control_x - w * .030, -d * .505, h * .692),
        (w * .035, .002, h * .017), "screen_ui", .001, "display")
    for index, x in enumerate((control_x + w * .075,
                               control_x + w * .105), start=1):
        box(f"High-volume printer molded control key {index}",
            (x, -d * .502, h * .642), (.016, .006, .016),
            "mid_grey" if index == 1 else "teal", .003, "control")

    # Independent right service/CMYK bay.
    service_x = w * .365
    box("High-volume printer right service column",
        (service_x, -d * .478, h * .455),
        (w * .195, .026, h * .36), "powder_light", .005, "service door")
    box("High-volume printer ink bay recess",
        (service_x, -d * .489, h * .455),
        (w * .135, .018, h * .18), "graphite", .004, "ink bay")
    for index, (x, material) in enumerate(zip(
        (service_x - w * .040, service_x - w * .013,
         service_x + w * .014, service_x + w * .041),
        ("ink_cyan", "ink_magenta", "ink_yellow", "graphite"),
    ), start=1):
        box(f"High-volume printer ink level {index}",
            (x, -d * .503, h * .455), (.012, .005, h * .105),
            material, .002, "ink indicator")
    cyl("High-volume printer service-door release",
        (service_x + w * .070, -d * .503, h * .585),
        .007, .008, "graphite", axis=(0, 1, 0), category="control")

    # Credible all-sided construction for orbit views.
    box("High-volume printer rear service panel",
        (0, d * .459, h * .405), (w * .82, .018, h * .48),
        "mid_grey", .006, "rear service")
    box("High-volume printer rear paper-path hatch",
        (-w * .13, d * .472, h * .535), (w * .42, .012, h * .16),
        "cool_grey", .004, "rear service")
    vent_bank("High-volume printer rear exhaust",
              (w * .27, d * .473, h * .50), 7, .030,
              (.020, .006, .009), axis="x")
    box("High-volume printer rear mains inlet",
        (w * .30, d * .475, h * .245), (.055, .010, .043),
        "graphite", .003, "rear service")
    box("High-volume printer rear cable strain relief",
        (w * .30, d * .482, h * .208), (.025, .012, .022),
        "rubber", .004, "rear service")
    for index, x in enumerate((w * .15, w * .21), start=1):
        box(f"High-volume printer rear data socket {index}",
            (x, d * .475, h * .300), (.027, .010, .020),
            "graphite", .002, "rear service")
    for x in (-w * .34, w * .34):
        for z in (h * .24, h * .62):
            cyl("High-volume printer rear service fastener",
                (x, d * .476, z), .005, .007,
                "zinc", axis=(0, 1, 0), category="fastener")


def _build_compact_printer_legacy(spec: f.AssetSpec) -> None:
    w, d, h = spec.width, spec.depth, spec.height
    feet(w * .76, d * .68, .010)
    scanner_center = h * .70
    scanner_height = h * .28
    scanner_bottom = scanner_center - scanner_height * .5
    chassis_bottom = .025
    chassis_top = scanner_bottom + .004
    compact_base_profile = [
        (-d * .42, chassis_bottom), (-d * .45, h * .12),
        (-d * .45, chassis_top), (d * .42, chassis_top),
        (d * .43, h * .10), (d * .37, chassis_bottom),
    ]
    extruded_yz_profile("Compact printer structural base", w * .96,
                        compact_base_profile, "warm_white", bevel=.014,
                        category="enclosure")
    box("Compact printer paper cassette", (-w * .06, -d * .43, h * .15),
        (w * .67, .030, h * .22), "powder_light", .007, "paper cassette")
    box("Compact printer cassette handle", (-w * .06, -d * .455, h * .16),
        (w * .21, .024, .032), "black", .008, "handle")
    box("Compact printer output aperture", (-w * .08, -d * .447, h * .41),
        (w * .55, .024, h * .23), "graphite", .009, "paper path")
    box("Compact printer output tray", (-w * .08, -d * .34, h * .33),
        (w * .50, d * .21, .022), "cool_grey", .006, "paper path")
    box("Compact printer output sheet", (-w * .08, -d * .39, h * .343),
        (w * .40, d * .16, .004), "label", .003, "paper")
    cyl("Compact printer output roller", (-w * .08, -d * .455, h * .37),
        .011, w * .40, "rubber", axis=(1, 0, 0), category="paper path")
    compact_scanner_profile = [
        (-d * .48, scanner_bottom), (-d * .48, h * .72),
        (-d * .40, h * .82), (d * .42, h * .82),
        (d * .48, h * .73), (d * .48, scanner_bottom),
    ]
    extruded_yz_profile("Compact printer scanner body", w, compact_scanner_profile,
                        "porcelain", x=-w * .03, bevel=.015, category="scanner")
    box("Compact printer scanner gasket", (-w * .03, .015, h * .80),
        (w * .90, d * .82, .010), "seal", .002, "scanner gasket")
    box("Compact printer scanner lid", (-w * .04, .035, h * .88),
        (w * .92, d * .78, h * .15), "cool_grey", .016, "scanner lid")
    box("Compact printer rear paper support", (0, d * .40, h - .050),
        (w * .49, .035, h * .20), "mid_grey", .008, "paper support")
    box("Compact printer rear feed tray", (0, d * .32, h - .020),
        (w * .58, d * .20, .025), "powder_light", .006, "paper support")
    box("Compact printer loaded paper", (0, d * .35, h + .012),
        (w * .45, d * .18, .004), "label", .002, "paper")
    for side in (-1, 1):
        box(f"Compact printer paper guide {side:+d}",
            (side * w * .19, d * .35, h + .023),
            (.015, d * .15, .025), "cool_grey", .004, "paper support")
    for x in (-w * .30, w * .24):
        cyl("Compact printer scanner hinge", (x, d * .39, h * .825),
            .014, w * .10, "aluminum", axis=(1, 0, 0), category="scanner hinge")
    screen("Compact printer display", (-w * .24, -d * .48, h * .70),
           (w * .18, .025, h * .15))
    add_printer_keys("Compact printer", -w * .18, -d * .49, h * .65)
    box("Compact printer ink window bezel", (w * .34, -d * .455, h * .42),
        (w * .22, .024, h * .25), "graphite", .007, "ink bay")
    box("Compact printer left control shoulder", (-w * .37, -d * .455, h * .52),
        (w * .16, .025, h * .30), "cool_grey", .007, "control housing")
    for index, (x, material) in enumerate(zip((.115, .145, .175, .205),
        ("ink_cyan", "ink_magenta", "ink_yellow", "graphite")), start=1):
        box(f"Compact printer ink reservoir {index}", (x, -d * .472, h * .42),
            (.020, .010, h * .14), material, .003, "ink indicator")
    box("Compact printer rear service cover", (0, d * .458, h * .40),
        (w * .72, .018, h * .40), "mid_grey", .007, "rear service")
    vent_bank("Compact printer rear exhaust", (0, d * .468, h * .38), 7, .040,
              (.024, .006, .009), axis="x")
    box("Compact printer rear mains inlet", (w * .31, d * .470, h * .26),
        (.055, .010, .043), "graphite", .004, "rear service")
    for index, x in enumerate((w * .19, w * .25), start=1):
        box(f"Compact printer rear data socket {index}", (x, d * .470, h * .32),
            (.026, .010, .020), "graphite", .003, "rear service")


def build_compact_printer(spec: f.AssetSpec) -> None:
    """Low, wide ink-tank printer with flat scanner and rear sheet support."""
    w, d, h = spec.width, spec.depth, spec.height
    feet(w * .78, d * .70, .009)

    # Low horizontal body with a shallow front rake and broad flat shoulders.
    scanner_bottom = h * .625
    chassis_profile = [
        (-d * .445, .024), (-d * .485, h * .095),
        (-d * .485, h * .555), (-d * .425, scanner_bottom + .008),
        (d * .425, scanner_bottom + .008), (d * .465, h * .50),
        (d * .420, h * .08), (d * .34, .024),
    ]
    extruded_yz_profile(
        "Compact printer structural base", w * .97, chassis_profile,
        "warm_white", bevel=.008, category="enclosure",
    )
    box("Compact printer continuous front return", (0, -d * .469, h * .315),
        (w * .91, .018, h * .43), "porcelain", .004, "enclosure return")
    box("Compact printer base shadow seam", (0, -d * .445, h * .050),
        (w * .84, .016, .010), "seal", .002, "manufactured seam")

    # One wide main cassette, visibly captured by the body rather than floating.
    cassette_x = -w * .045
    cassette_width = w * .66
    cassette_height = h * .19
    box("Compact printer main cassette surround",
        (cassette_x, -d * .484, h * .145),
        (cassette_width + .012, .010, cassette_height + .012),
        "mid_grey", .003, "paper cassette surround")
    box("Compact printer main cassette",
        (cassette_x, -d * .493, h * .145),
        (cassette_width, .018, cassette_height),
        "powder_light", .004, "paper cassette")
    box("Compact printer cassette recessed handle",
        (cassette_x, -d * .506, h * .155),
        (w * .18, .014, .023), "graphite", .004, "handle")
    for side in (-1, 1):
        box(f"Compact printer cassette runner {side:+d}",
            (cassette_x + side * (cassette_width * .5 + .005),
             -d * .489, h * .145),
            (.005, .010, cassette_height * .80), "cool_grey", .0015,
            "paper cassette runner")

    # Central output cavity with molded lips, a visible roller and paper sheet.
    output_x = -w * .070
    box("Compact printer output aperture back",
        (output_x, -d * .495, h * .430),
        (w * .52, .006, h * .185), "graphite", .003, "paper path")
    box("Compact printer output upper guide",
        (output_x, -d * .435, h * .523),
        (w * .54, d * .085, .016), "cool_grey", .003, "paper path")
    box("Compact printer output tray",
        (output_x, -d * .395, h * .345),
        (w * .50, d * .16, .021), "cool_grey", .004, "paper path")
    box("Compact printer output sheet",
        (output_x, -d * .417, h * .358),
        (w * .39, d * .12, .003), "label", .0015, "paper")
    cyl("Compact printer output roller",
        (output_x, -d * .485, h * .492), .009, w * .38,
        "rubber", axis=(1, 0, 0), category="paper path")

    # Distinctly flat scanner deck and thin lid, unlike the tall ADF model.
    scanner_profile = [
        (-d * .470, scanner_bottom), (-d * .470, h * .740),
        (-d * .420, h * .785), (d * .420, h * .785),
        (d * .465, h * .735), (d * .465, scanner_bottom),
    ]
    extruded_yz_profile(
        "Compact printer scanner body", w, scanner_profile,
        "porcelain", x=-w * .010, bevel=.007, category="scanner",
    )
    box("Compact printer scanner gasket",
        (-w * .010, .008, h * .782),
        (w * .88, d * .80, .007), "seal", .002, "scanner gasket")
    box("Compact printer flat scanner lid",
        (-w * .018, .018, h * .825),
        (w * .90, d * .78, h * .080), "cool_grey", .008, "scanner lid")
    for x in (-w * .31, w * .25):
        cyl("Compact printer scanner hinge",
            (x, d * .395, h * .802), .010, w * .095,
            "aluminum", axis=(1, 0, 0), category="scanner hinge")

    # Rear manual-feed support rises behind the otherwise low scanner.
    box("Compact printer rear feed throat",
        (0, d * .420, h * .785), (w * .46, .022, h * .070),
        "graphite", .003, "paper support")
    box("Compact printer rear paper support",
        (0, d * .418, h * .875),
        (w * .48, .026, h * .25), "mid_grey", .006, "paper support",
        rotation=(math.radians(-5), 0, 0))
    box("Compact printer rear feed tray",
        (0, d * .315, h * .865),
        (w * .55, d * .17, .018), "powder_light", .004, "paper support",
        rotation=(math.radians(-5), 0, 0))
    box("Compact printer loaded paper",
        (0, d * .327, h * .878),
        (w * .42, d * .13, .003), "label", .001, "paper",
        rotation=(math.radians(-5), 0, 0))
    for side in (-1, 1):
        box(f"Compact printer rear paper guide {side:+d}",
            (side * w * .17, d * .326, h * .889),
            (.013, d * .12, .020), "cool_grey", .002, "paper support",
            rotation=(math.radians(-5), 0, 0))

    # Small left display/control shoulder; all controls are opaque polymer.
    control_x = -w * .335
    box("Compact printer left control shoulder",
        (control_x, -d * .482, h * .585),
        (w * .20, .027, h * .16), "cool_grey", .005, "control housing")
    box("Compact printer display bezel",
        (control_x, -d * .501, h * .600),
        (w * .125, .012, h * .090), "graphite", .003, "display bezel")
    box("Compact printer opaque display",
        (control_x, -d * .509, h * .603),
        (w * .103, .004, h * .066), "screen_active", .002, "display")
    box("Compact printer display status field",
        (control_x - w * .020, -d * .512, h * .612),
        (w * .028, .002, h * .014), "screen_ui", .001, "display")
    for index, x in enumerate((control_x + w * .065,
                               control_x + w * .092), start=1):
        box(f"Compact printer molded control key {index}",
            (x, -d * .510, h * .566), (.014, .006, .014),
            "mid_grey" if index == 1 else "teal", .003, "control")

    # Separate right CMYK reservoir window and service release.
    ink_x = w * .345
    box("Compact printer right ink service column",
        (ink_x, -d * .474, h * .405),
        (w * .205, .024, h * .31), "powder_light", .005, "ink bay")
    box("Compact printer ink window recess",
        (ink_x, -d * .498, h * .410),
        (w * .145, .006, h * .19), "graphite", .003, "ink bay")
    for index, (x, material) in enumerate(zip(
        (ink_x - w * .043, ink_x - w * .014,
         ink_x + w * .015, ink_x + w * .044),
        ("ink_cyan", "ink_magenta", "ink_yellow", "graphite"),
    ), start=1):
        box(f"Compact printer ink reservoir {index}",
            (x, -d * .505, h * .410), (.012, .005, h * .125),
            material, .002, "ink indicator")
    cyl("Compact printer ink-bay release",
        (ink_x + w * .073, -d * .508, h * .520),
        .006, .007, "graphite", axis=(0, 1, 0), category="control")

    # Rear service anatomy stays within the authored shell and reads in orbit.
    box("Compact printer rear service cover",
        (0, d * .452, h * .390),
        (w * .76, .017, h * .38), "mid_grey", .005, "rear service")
    box("Compact printer rear duplex hatch",
        (-w * .10, d * .463, h * .455),
        (w * .39, .011, h * .14), "cool_grey", .004, "rear service")
    vent_bank("Compact printer rear exhaust",
              (w * .28, d * .466, h * .42), 6, .026,
              (.018, .006, .008), axis="x")
    box("Compact printer rear mains inlet",
        (w * .29, d * .468, h * .235),
        (.048, .010, .038), "graphite", .003, "rear service")
    box("Compact printer rear USB socket",
        (w * .19, d * .468, h * .285),
        (.025, .010, .019), "graphite", .002, "rear service")
    for x in (-w * .32, w * .32):
        cyl("Compact printer rear service fastener",
            (x, d * .469, h * .300), .0045, .006,
            "zinc", axis=(0, 1, 0), category="fastener")


def build_ultrasonic_cleaner(spec: f.AssetSpec) -> None:
    w, d, h = spec.width, spec.depth, spec.height
    feet(w * .76, d * .72, .012)
    # Brushed enclosure and a genuinely deep open tank.  The basin floor is
    # deliberately low and dark enough to remain readable from the top; there
    # is no water plane, glass lid, or transparent fill.
    outer_bottom = h * .075
    # The formed outer skin rises into the underside of the rolled rim.  This
    # closes the previously visible 18 mm daylight slot around the basin while
    # keeping the working aperture open.
    outer_top = h * .96
    outer_center = (outer_bottom + outer_top) * .5
    outer_height = outer_top - outer_bottom
    box("Cleaner front stainless wall", (0, -d * .43, outer_center),
        (w, .033, outer_height), "stainless_studio", .006,
        "stainless enclosure")
    box("Cleaner rear stainless wall", (0, d * .43, outer_center),
        (w, .033, outer_height), "stainless_studio", .006,
        "stainless enclosure")
    for side in (-1, 1):
        box(f"Cleaner side stainless wall {side:+d}",
            (side * w * .44, 0, outer_center),
            (.033, d * .88, outer_height), "stainless_studio", .006,
            "stainless enclosure")
    box("Cleaner lower structural pan", (0, 0, h * .11),
        (w * .88, d * .82, h * .15), "stainless_studio", .006, "enclosure")
    box("Cleaner lower hygienic return", (0, -d * .415, h * .13),
        (w * .87, .016, h * .12), "stainless_bright", .003,
        "stainless enclosure")
    # Basin construction overlaps at the corners, so no background leaks are
    # visible between the formed sides.  A broad floor bevel creates the rolled
    # transition without an expensive boolean or subdivision shell.
    basin_floor_z = h * .235
    box("Cleaner basin floor", (0, 0, basin_floor_z),
        (w * .78, d * .70, h * .035), "stainless_dark", .016, "basin")
    basin_wall_bottom = basin_floor_z - h * .005
    basin_wall_top = h * .9775
    basin_wall_center = (basin_wall_bottom + basin_wall_top) * .5
    basin_wall_height = basin_wall_top - basin_wall_bottom
    for side in (-1, 1):
        box("Cleaner basin long wall", (0, side * d * .365, basin_wall_center),
            (w * .81, .023, basin_wall_height), "stainless_bright", .006,
            "basin")
        box("Cleaner basin end wall", (side * w * .405, 0, basin_wall_center),
            (.023, d * .72, basin_wall_height), "stainless_bright", .006,
            "basin")
        # Dark lower corner shadows add depth but remain opaque geometry.
        box(f"Cleaner basin lower shadow {side:+d}",
            (side * w * .37, 0, basin_floor_z + h * .030),
            (.012, d * .61, h * .055), "stainless_dark", .004, "basin")
    # Rolled rim overlaps both the outer enclosure and inner tank, making a
    # continuous hygienic assembly at every corner and satisfying the 2 mm
    # fixed-contact gate.
    for y in (-d * .40, d * .40):
        box("Cleaner rolled long rim", (0, y, h * .9775),
            (w, .052, h * .045), "stainless_bright", .011, "basin rim")
    for x in (-w * .42, w * .42):
        box("Cleaner rolled end rim", (x, 0, h * .9775),
            (.052, d * .79, h * .045), "stainless_bright", .011, "basin rim")
    # Flush blue fascia from the reference: the enamel panel is seated into a
    # shallow dark recess and does not float proud of the steel shell.
    box("Cleaner controller recess", (0, -d * .430, h * .40),
        (w * .45, .020, h * .51), "graphite", .005, "control recess")
    box("Cleaner blue controller fascia", (0, -d * .475, h * .40),
        (w * .415, .014, h * .48), "blue_accent", .006, "control fascia")
    screen("Cleaner digital controller", (0, -d * .458, h * .265),
           (w * .25, .015, h * .115))
    for index, x in enumerate((-w * .052, 0, w * .052)):
        box(f"Cleaner control key {index + 1}",
            (x, -d * .493, h * .265), (.021, .005, .015),
            "control_polymer" if index < 2 else "teal", .002, "control")
    box("Cleaner front compliance label", (0, -d * .495, h * .535),
        (w * .26, .002, h * .095), "label", .0015, "product label")
    for line in range(4):
        box(f"Cleaner compliance label line {line + 1}",
            (0, -d * .498, h * (.558 - line * .017)),
            (w * (.19 - line * .017), .001, .003), "mid_grey", .0008,
            "product label")
    curve_tube(
        "Cleaner side lifting handle",
        [
            (-w * .43, -d * .13, h * .43),
            (-w * .46, -d * .10, h * .49),
            (-w * .46, d * .10, h * .49),
            (-w * .43, d * .13, h * .43),
        ],
        .009,
        "black",
        "handle",
    )
    box("Cleaner handle backing plate", (-w * .44, 0, h * .46),
        (.012, d * .35, h * .12), "mid_grey", .003, "handle mount")
    box("Cleaner rear service cover", (0, d * .450, h * .31),
        (w * .53, .016, h * .28), "mid_grey", .004, "rear service")
    for x in (-w * .20, w * .20):
        cyl("Cleaner rear service fastener", (x, d * .460, h * .31),
            .004, .006, "zinc", axis=(0, 1, 0), category="fastener")
    cyl("Cleaner drain valve body", (w * .40, d * .29, h * .19), .016, .046,
        "stainless", axis=(1, 0, 0), category="drain")
    cyl("Cleaner drain valve grip", (w * .44, d * .29, h * .19), .020, .016,
        "black", axis=(1, 0, 0), category="handle")
    box("Cleaner rear power inlet", (-w * .24, d * .460, h * .21),
        (.050, .010, .040), "graphite", .003, "rear service")
    tube_between("Cleaner power lead", (-w * .24, d * .47, h * .21),
                 (-w * .40, d * .486, .03), .0045, "rubber", "cable")


def _world_bounds(obj) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        Vector(tuple(min(point[axis] for point in points) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in points) for axis in range(3))),
    )


def _aabb_gap(a, b) -> float:
    alo, ahi = _world_bounds(a)
    blo, bhi = _world_bounds(b)
    delta = Vector(tuple(max(0.0, alo[axis] - bhi[axis], blo[axis] - ahi[axis])
                         for axis in range(3)))
    return delta.length


def _source_name(obj) -> str:
    """Return Blender's authored name without its automatic .001 suffix."""
    head, separator, tail = obj.name.rpartition(".")
    return head if separator and tail.isdigit() else obj.name


def fit_authored_source(spec: f.AssetSpec) -> dict[str, object]:
    """Validate and ground editable source without distorting manufactured parts.

    Earlier batch revisions silently non-uniformly scaled the root to force every
    source into its declared catalogue envelope.  That warped round controls,
    bevel radii and product proportions.  The r7 pipeline instead rejects a raw
    authoring envelope that differs by more than 0.5% on any axis.  Small
    sub-percent construction tolerances remain in the source as authored; the
    root itself is always saved at unit scale.
    """
    assert f.ROOT is not None
    minimum, maximum = f.mesh_bounds()
    dimensions = maximum - minimum
    if min(dimensions) <= 0:
        raise RuntimeError(f"{spec.asset_id}: source scene has invalid bounds {dimensions}")
    ratios = tuple(
        target / current
        for target, current in zip((spec.width, spec.depth, spec.height), dimensions)
    )
    maximum_deviation = max(abs(ratio - 1.0) for ratio in ratios)
    if maximum_deviation > .005:
        meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
        extrema: list[str] = []
        for axis, label in enumerate(("x", "y", "z")):
            low_obj = min(meshes, key=lambda obj: _world_bounds(obj)[0][axis])
            high_obj = max(meshes, key=lambda obj: _world_bounds(obj)[1][axis])
            extrema.append(
                f"{label}[{low_obj.name}={_world_bounds(low_obj)[0][axis]:.6f}, "
                f"{high_obj.name}={_world_bounds(high_obj)[1][axis]:.6f}]"
            )
        raise RuntimeError(
            f"{spec.asset_id}: raw authored bounds "
            f"({dimensions.x:.6f}, {dimensions.y:.6f}, {dimensions.z:.6f}) m "
            f"require non-uniform fit {tuple(round(value, 6) for value in ratios)}; "
            "fix the product construction instead of scaling it; extrema "
            + ", ".join(extrema)
        )
    f.ROOT.scale = (1.0, 1.0, 1.0)
    f.ROOT.location += Vector(
        (-(minimum.x + maximum.x) * .5, -(minimum.y + maximum.y) * .5, -minimum.z)
    )
    bpy.context.view_layer.update()
    return f.authored_statistics(spec)


def organize_source_scene() -> None:
    """Group named product parts by authored role without changing hierarchy."""
    scene_root = bpy.context.scene.collection
    source_root = bpy.data.collections.get("PRODUCT_PARTS")
    if source_root is None:
        source_root = bpy.data.collections.new("PRODUCT_PARTS")
        scene_root.children.link(source_root)

    collections: dict[str, bpy.types.Collection] = {}
    for obj in list(bpy.context.scene.objects):
        if obj is f.ROOT or obj.type not in {"MESH", "CURVE"}:
            continue
        category = str(obj.get("part_category", "detail")).strip() or "detail"
        label = " ".join(word.capitalize() for word in category.replace("_", " ").split())
        target = collections.get(label)
        if target is None:
            target = bpy.data.collections.get(f"PRODUCT - {label}")
            if target is None:
                target = bpy.data.collections.new(f"PRODUCT - {label}")
                source_root.children.link(target)
            collections[label] = target
        if obj.name not in target.objects:
            target.objects.link(obj)
        for owner in list(obj.users_collection):
            if owner is not target:
                owner.objects.unlink(obj)


def save_editable_source(spec: f.AssetSpec, source_dir: Path) -> Path:
    """Persist the fitted, modifier-preserving scene as the rollback source."""
    assert f.ROOT is not None
    source_dir.mkdir(parents=True, exist_ok=True)
    path = source_dir / f"{spec.asset_id}.blend"
    f.ROOT["source_format"] = "blend"
    source_revision = (
        "batch14-product-source-r9" if spec.asset_id == "gpu-analysis-workstation"
        else SOURCE_REVISION
    )
    runtime_revision = (
        "diversity-batch14-r14" if spec.asset_id == "gpu-analysis-workstation"
        else RUNTIME_REVISION
    )
    f.ROOT["source_revision"] = source_revision
    f.ROOT["source_authoring_tool"] = "Blender 4.5 LTS"
    f.ROOT["source_preserves_part_hierarchy"] = True
    f.ROOT["source_preserves_unapplied_bevels"] = True
    f.ROOT["runtime_artifact"] = f"public/models/hero/{spec.asset_id}.glb"
    bpy.context.scene["source_revision"] = source_revision
    bpy.context.scene["runtime_revision"] = runtime_revision
    bpy.context.scene["reference_policy"] = (
        "Supplied photographs define visible form and finish; hidden sides use "
        "conservative original construction and no third-party geometry or logos."
    )
    # Sources are reproducible and versioned in the workspace; do not scatter
    # Blender's numbered backup siblings beside the canonical rollback files.
    bpy.context.preferences.filepaths.save_version = 0
    result = bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    if "FINISHED" not in result or not path.exists():
        raise RuntimeError(f"{spec.asset_id}: failed to save editable source at {path}")
    return path


def prepare_product_source() -> None:
    """Apply authored anatomy/finish passes before the source scene is saved.

    The runtime batcher also calls these hooks, but each hook is guarded by a
    root revision. Running them here ensures the editable `.blend` contains the
    actual drawer trays, hinges, returns, fixed joints and per-part visible
    finish assignments instead of adding those only to the delivery GLB.
    """
    fixed_casework_joints.apply(f)
    storage_anatomy.prepare(f)
    casework_edge_returns.apply(f)
    reference_finishes.apply(f)


def assert_release_connections(spec: f.AssetSpec) -> list[dict[str, object]]:
    """Fail authoring when reviewed fixed construction becomes visibly detached.

    This is deliberately scoped to structural/contact pairs; doors, drawers,
    vents, screens and presentation-state trays retain their functional reveals.
    Every matching source part must touch or overlap at least one named bearing
    part within 2 mm before the model is fitted, compressed or rendered.
    """
    aid = spec.asset_id
    desk_name = {
        "steel-pedestal-desk": "Steel pedestal desk",
        "wood-pedestal-desk": "Walnut pedestal desk",
        "maple-steel-desk": "Maple steel desk",
    }.get(aid)
    reviewed = {
        "electronic-pipette-station": list(pipette_product.CONTACT_PAIRS),
        "automated-microplate-reader": [
            ("chassis-to-shell", "Reader lower structural chassis", "Reader formed upper shell"),
            ("tray-to-aperture", "Extended microplate carriage", "Reader sample aperture"),
        ],
        "chest-ultra-low-freezer": [
            ("cabinet-to-gasket", "Chest ULT insulated cabinet", "Chest ULT top gasket"),
            ("gasket-to-lid", "Chest ULT top gasket", "Chest ULT insulated lid"),
        ],
        "gpu-analysis-workstation": [
            (f"gpu-workstation-contact-{index:02d}", source, bearing)
            for index, (source, bearing) in enumerate(
                gpu_workstation_product.contact_pairs(), start=1
            )
        ],
        "black-utility-table": [
            ("legs-to-top", "Utility table square tube leg", "Utility table graphite work surface"),
            ("aprons-to-top", "Utility table long apron", "Utility table graphite work surface"),
            ("end-aprons-to-top", "Utility table end apron", "Utility table graphite work surface"),
        ],
        "ultrasonic-cleaner": [
            (f"cleaner-contact-{index:02d}", source, bearing)
            for index, (source, bearing) in enumerate(
                cleaner_product.contact_pairs("ultrasonic-cleaner"), start=1
            )
        ],
    }
    if desk_name:
        support = "left slab" if aid == "wood-pedestal-desk" else "left C-leg upright"
        reviewed[aid] = [
            ("pedestal-to-top", desk_name + " pedestal left side", desk_name + " work surface"),
            ("left-support-to-top", desk_name + " " + support, desk_name + " work surface"),
            ("spine-to-top", desk_name + " under-top structural spine", desk_name + " work surface"),
        ]
    if aid in printer_products.CONTACT_PAIRS:
        reviewed[aid] = [
            (f"closed-printer-shell-{index:02d}", source, bearing)
            for index, (source, bearing) in enumerate(
                printer_products.contact_pairs(aid), start=1
            )
        ]
    if aid == "automated-microplate-reader":
        reviewed[aid] = list(reader_product.CONTACT_PAIRS)
    bpy.context.view_layer.update()
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    records: list[dict[str, object]] = []
    for label, source_prefix, bearing_prefix in reviewed.get(aid, []):
        sources = [obj for obj in meshes if _source_name(obj) == source_prefix]
        bearings = [obj for obj in meshes if _source_name(obj) == bearing_prefix
                    and obj not in sources]
        if not sources or not bearings:
            raise RuntimeError(f"{aid}/{label}: missing reviewed contact parts")
        gaps = []
        for source in sources:
            gap = min(_aabb_gap(source, bearing) for bearing in bearings)
            gaps.append(gap)
        maximum = max(gaps)
        if maximum > .002:
            raise RuntimeError(
                f"{aid}/{label}: fixed construction is detached by {maximum * 1000:.2f} mm"
            )
        records.append({"joint": label, "parts": len(sources),
                        "maximumGapM": round(maximum, 6)})
    return records


BUILDERS = {
    "electronic-pipette-station": pipette_product.build,
    "automated-microplate-reader": reader_product.build,
    "chest-ultra-low-freezer": build_chest_freezer,
    "gpu-analysis-workstation": gpu_workstation_product.build,
    "steel-pedestal-desk": lambda spec: build_pedestal_desk(spec, "steel"),
    "wood-pedestal-desk": lambda spec: build_pedestal_desk(spec, "wood"),
    "maple-steel-desk": lambda spec: build_pedestal_desk(spec, "maple"),
    "black-utility-table": build_utility_table,
    "high-volume-multifunction-printer": printer_products.build_high_volume,
    "compact-ink-tank-printer": printer_products.build_compact,
    "ultrasonic-cleaner": cleaner_product.build,
}


def build_one(
    spec: f.AssetSpec,
    output_dir: Path,
    save_blend_dir: Path,
) -> dict[str, object]:
    f.reset_scene(spec.asset_id)
    # A previous selective build may have left source-only role collections as
    # the active authoring collection. Remove those empty containers and return
    # Blender to the scene root so consecutive assets cannot inherit context.
    for collection in list(bpy.data.collections):
        if collection.name == "PRODUCT_PARTS" or collection.name.startswith("PRODUCT - "):
            bpy.data.collections.remove(collection)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection
    f.create_root(spec)
    add_materials()
    storage_anatomy.SUPPORTED.update(STORAGE_ASSETS)
    BUILDERS[spec.asset_id](spec)
    reference_rework.apply(spec)
    source_pbr_report = source_pbr.apply(f)
    assert f.ROOT is not None
    prepare_product_source()
    connection_records = assert_release_connections(spec)
    f.ROOT["display_name"] = (
        "Laboratory Pipette Holder"
        if spec.asset_id == "electronic-pipette-station"
        else spec.asset_id.replace("-", " ").title()
    )
    runtime_revision = (
        "diversity-batch14-r14" if spec.asset_id == "gpu-analysis-workstation"
        else RUNTIME_REVISION
    )
    f.ROOT["revision"] = runtime_revision
    f.ROOT["construction_continuity_revision"] = "formed-connected-construction-r7"
    f.ROOT["authored_form_revision"] = (
        "reference-product-model-r14"
        if spec.asset_id == "gpu-analysis-workstation"
        else "reference-product-model-r12"
    )
    f.ROOT["reference_rework_revision"] = reference_rework.REVISION
    f.ROOT["material_calibration_revision"] = "role-pbr-and-shared-microdetail-r3"
    f.ROOT["source_pbr_revision"] = source_pbr.REVISION
    f.ROOT["source_pbr_materials"] = source_pbr_report["appliedCount"]
    f.ROOT["reviewed_fixed_connections"] = connection_records
    if spec.asset_id == "electronic-pipette-station":
        f.ROOT["holder_type"] = "passive"
        f.ROOT["pipette_types"] = [
            "manual-micro", "manual-standard", "electronic", "repeater",
            "multichannel",
        ]
        f.ROOT["electrical_charging_hardware"] = False
    if spec.asset_id in {
        "gpu-analysis-workstation", "steel-pedestal-desk", "wood-pedestal-desk",
        "maple-steel-desk", "black-utility-table",
    }:
        f.ROOT["clean_work_surface"] = True
        f.ROOT["generic_surface_grommets"] = False
        f.ROOT["decorative_service_markers"] = False
    f.ROOT["planning_model"] = True
    f.ROOT["manufacturer_certified"] = False
    f.ROOT["source_note"] = (
        "Original logo-free LabSpace geometry informed by user-supplied product "
        "photographs; hidden-side construction is conservative planning anatomy."
    )
    source_stats = fit_authored_source(spec)
    f.ROOT["authored_bounds_m"] = source_stats["bounds_m"]["dimensions"]
    f.ROOT["source_mesh_parts"] = source_stats["mesh_objects"]
    f.ROOT["pbr_materials"] = source_stats["materials"]
    organize_source_scene()
    source_path = save_editable_source(spec, save_blend_dir)

    # Runtime optimization is deliberately destructive, and only happens after
    # the editable source above has been saved with named parts and modifiers.
    batches = f.consolidate_static_meshes_by_material()
    stats = f.authored_statistics(spec)
    f.validate_statistics(spec, stats, imported=False)
    f.ROOT["mesh_parts"] = stats["mesh_objects"]
    f.ROOT["source_part_count"] = batches["source_parts"]
    f.ROOT["runtime_material_batches"] = batches["runtime_batches"]
    path = output_dir / f"{spec.asset_id}.glb"
    f.export_glb(path)
    imported = f.inspect_export(spec, path)
    imported["editable_source"] = str(source_path)
    imported["source_scene"] = source_stats
    imported["runtime_scene"] = stats
    imported["batching"] = batches
    return imported


def main() -> None:
    raw = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", action="append", choices=list(ASSETS), default=[])
    parser.add_argument("--output-dir", type=Path, default=Path("public/models/hero"))
    parser.add_argument(
        "--save-blend-dir",
        type=Path,
        default=Path("assets/blender/batch14"),
        help="Editable unbatched Blender product-scene output directory.",
    )
    options = parser.parse_args(raw)
    output_dir = options.output_dir.resolve()
    save_blend_dir = options.save_blend_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    selected = options.asset or list(ASSETS)
    results = [
        build_one(ASSETS[asset_id], output_dir, save_blend_dir)
        for asset_id in selected
    ]
    print("LABSPACE_DIVERSITY_BATCH14 " + json.dumps(results, sort_keys=True))


if __name__ == "__main__":
    main()
