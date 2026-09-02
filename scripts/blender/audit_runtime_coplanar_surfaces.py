r"""Headless runtime-GLB audit for same-facing coplanar surfaces.

This gate imports the shipped Draco GLBs with Blender's glTF decoder, then checks
world-space triangles for overlapping, same-facing surfaces on the same plane.
Those surfaces compete for the depth buffer in Three.js and typically appear as
orbit-dependent streaking or flicker. Opposite-facing bearing/contact surfaces
are ignored. The default gate fails only cross-material overlaps that an
orbit-like visibility probe can reach as its first surface hit; same-material
and fully occluded construction are reported separately. Pass ``--strict`` to
restore the exhaustive all-overlap gate.

Run from the repository root:

    .\.tools\blender-4.5.11-windows-x64\blender.exe --background --python-exit-code 1 --python scripts\blender\audit_runtime_coplanar_surfaces.py --

The process is deliberately sequential: one asset is imported, audited, and
discarded before the next asset is loaded.
"""

from __future__ import annotations

import argparse
import gc
from collections import defaultdict
from pathlib import Path
import sys
from typing import DefaultDict, NamedTuple, Sequence

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ASSETS = (
    "public/models/hero/high-volume-multifunction-printer.glb",
    "public/models/hero/compact-ink-tank-printer.glb",
    "public/models/hero/ultrasonic-cleaner.glb",
)


class Triangle(NamedTuple):
    object_name: str
    material_name: str
    source_part_count: int
    facing: int
    normal: tuple[float, float, float]
    plane_offset: float
    projection_axis: int
    uv: tuple[tuple[float, float], tuple[float, float], tuple[float, float]]
    bounds: tuple[float, float, float, float]


class Finding(NamedTuple):
    object_a: str
    material_a: str
    source_parts_a: int
    object_b: str
    material_b: str
    source_parts_b: int
    plane: tuple[int, int, int, int]
    overlap_area_m2: float
    exposed_area_m2: float


def _signed_area(points: Sequence[tuple[float, float]]) -> float:
    return 0.5 * sum(
        points[index][0] * points[(index + 1) % len(points)][1]
        - points[(index + 1) % len(points)][0] * points[index][1]
        for index in range(len(points))
    )


def _intersection_polygon(
    subject: Sequence[tuple[float, float]],
    clipping_triangle: Sequence[tuple[float, float]],
) -> list[tuple[float, float]]:
    """Return the convex intersection polygon of two 2D triangles."""

    clip = list(clipping_triangle)
    if _signed_area(clip) < 0:
        clip.reverse()
    output = list(subject)
    inside_epsilon = 1e-11

    for index, edge_start in enumerate(clip):
        edge_end = clip[(index + 1) % len(clip)]
        input_points = output
        output = []
        if not input_points:
            break

        def side(point: tuple[float, float]) -> float:
            return (
                (edge_end[0] - edge_start[0]) * (point[1] - edge_start[1])
                - (edge_end[1] - edge_start[1]) * (point[0] - edge_start[0])
            )

        segment_start = input_points[-1]
        start_side = side(segment_start)
        for segment_end in input_points:
            end_side = side(segment_end)
            start_inside = start_side >= -inside_epsilon
            end_inside = end_side >= -inside_epsilon

            if start_inside != end_inside:
                segment_x = segment_end[0] - segment_start[0]
                segment_y = segment_end[1] - segment_start[1]
                edge_x = edge_end[0] - edge_start[0]
                edge_y = edge_end[1] - edge_start[1]
                denominator = segment_x * edge_y - segment_y * edge_x
                if abs(denominator) > 1e-15:
                    distance = (
                        (edge_start[0] - segment_start[0]) * edge_y
                        - (edge_start[1] - segment_start[1]) * edge_x
                    ) / denominator
                    output.append(
                        (
                            segment_start[0] + distance * segment_x,
                            segment_start[1] + distance * segment_y,
                        )
                    )
            if end_inside:
                output.append(segment_end)

            segment_start = segment_end
            start_side = end_side

    return output


def _intersection_area(points: Sequence[tuple[float, float]]) -> float:
    return abs(_signed_area(points)) if len(points) >= 3 else 0.0


def _canonical_plane(
    normal: Vector,
    point: Vector,
    normal_quantum: float,
    plane_quantum_m: float,
) -> tuple[tuple[int, int, int, int], int, int]:
    """Return plane bucket, original facing sign, and projection axis."""

    canonical = normal.copy()
    facing = 1
    for component in canonical:
        if abs(component) <= 1e-8:
            continue
        if component < 0:
            canonical.negate()
            facing = -1
        break

    offset = canonical.dot(point)
    plane = (
        round(canonical.x / normal_quantum),
        round(canonical.y / normal_quantum),
        round(canonical.z / normal_quantum),
        round(offset / plane_quantum_m),
    )
    projection_axis = max(range(3), key=lambda axis: abs(canonical[axis]))
    return plane, facing, projection_axis


def _material_name(obj: bpy.types.Object, polygon_index: int) -> str:
    polygon = obj.data.polygons[polygon_index]
    material_index = polygon.material_index
    if material_index < len(obj.material_slots):
        material = obj.material_slots[material_index].material
        if material is not None:
            return material.name
    return "<unassigned>"


def _collect_triangles(
    *, normal_quantum: float, plane_quantum_m: float
) -> tuple[DefaultDict[tuple[int, int, int, int], list[Triangle]], int]:
    groups: DefaultDict[tuple[int, int, int, int], list[Triangle]] = defaultdict(list)
    triangle_count = 0

    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        mesh = obj.data
        mesh.calc_loop_triangles()
        world = obj.matrix_world
        source_part_count = int(obj.get("source_part_count", 1))

        for triangle in mesh.loop_triangles:
            points = tuple(world @ mesh.vertices[index].co for index in triangle.vertices)
            normal = (points[1] - points[0]).cross(points[2] - points[0])
            if normal.length_squared <= 1e-20:
                continue
            normal.normalize()
            plane, facing, projection_axis = _canonical_plane(
                normal,
                points[0],
                normal_quantum,
                plane_quantum_m,
            )
            first_axis = (projection_axis + 1) % 3
            second_axis = (projection_axis + 2) % 3
            uv = tuple((point[first_axis], point[second_axis]) for point in points)
            bounds = (
                min(point[0] for point in uv),
                max(point[0] for point in uv),
                min(point[1] for point in uv),
                max(point[1] for point in uv),
            )
            groups[plane].append(
                Triangle(
                    obj.name,
                    _material_name(obj, triangle.polygon_index),
                    source_part_count,
                    facing,
                    (normal.x, normal.y, normal.z),
                    normal.dot(points[0]),
                    projection_axis,
                    uv,
                    bounds,
                )
            )
            triangle_count += 1

    return groups, triangle_count


def _asset_ray_distance() -> float:
    minimum = Vector((float("inf"), float("inf"), float("inf")))
    maximum = Vector((float("-inf"), float("-inf"), float("-inf")))
    found = False
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            for axis in range(3):
                minimum[axis] = min(minimum[axis], point[axis])
                maximum[axis] = max(maximum[axis], point[axis])
            found = True
    return max(1.0, (maximum - minimum).length * 2.0) if found else 2.0


def _point_from_uv(triangle: Triangle, uv: tuple[float, float]) -> Vector:
    normal = Vector(triangle.normal)
    projection_axis = triangle.projection_axis
    first_axis = (projection_axis + 1) % 3
    second_axis = (projection_axis + 2) % 3
    point = Vector((0.0, 0.0, 0.0))
    point[first_axis] = uv[0]
    point[second_axis] = uv[1]
    point[projection_axis] = (
        triangle.plane_offset
        - normal[first_axis] * uv[0]
        - normal[second_axis] * uv[1]
    ) / normal[projection_axis]
    return point


def _view_directions(normal: Vector) -> tuple[Vector, ...]:
    """Deterministic orbit-like rays over the outward-facing hemisphere."""

    helper = Vector((1.0, 0.0, 0.0)) if abs(normal.x) < 0.8 else Vector((0.0, 1.0, 0.0))
    tangent = normal.cross(helper).normalized()
    bitangent = normal.cross(tangent).normalized()
    slope = 0.8
    diagonal = 0.55
    return tuple(
        direction.normalized()
        for direction in (
            normal,
            normal + tangent * slope,
            normal - tangent * slope,
            normal + bitangent * slope,
            normal - bitangent * slope,
            normal + tangent * diagonal + bitangent * diagonal,
            normal + tangent * diagonal - bitangent * diagonal,
            normal - tangent * diagonal + bitangent * diagonal,
            normal - tangent * diagonal - bitangent * diagonal,
        )
    )


def _intersection_is_exposed(
    polygon: Sequence[tuple[float, float]],
    triangle: Triangle,
    *,
    depsgraph: bpy.types.Depsgraph,
    ray_distance: float,
    hit_tolerance_m: float,
) -> bool:
    """Return true when an orbit-like ray reaches the overlap as its first hit.

    A far-to-surface visibility probe is deterministic and avoids misclassifying
    nested bearing boxes: if an enclosure, return, or outer skin is in front of
    the candidate, that geometry is hit before the coplanar sample.
    """

    center = (
        sum(point[0] for point in polygon) / len(polygon),
        sum(point[1] for point in polygon) / len(polygon),
    )
    # The center catches broad overlaps; inset vertex samples catch partially
    # exposed edges without probing numerical seam endpoints directly.
    samples = [center]
    samples.extend(
        (
            center[0] * 0.65 + vertex[0] * 0.35,
            center[1] * 0.65 + vertex[1] * 0.35,
        )
        for vertex in polygon[:6]
    )
    normal = Vector(triangle.normal)
    scene = bpy.context.scene

    for sample in samples:
        surface_point = _point_from_uv(triangle, sample)
        for view_direction in _view_directions(normal):
            origin = surface_point + view_direction * ray_distance
            hit, location, _normal, _face, _object, _matrix = scene.ray_cast(
                depsgraph,
                origin,
                -view_direction,
                distance=ray_distance * 1.5,
            )
            if hit and (location - surface_point).length <= hit_tolerance_m:
                return True
    return False


def _audit_loaded_asset(
    *,
    normal_quantum: float,
    plane_quantum_m: float,
    overlap_epsilon_m2: float,
    area_tolerance_m2: float,
    hit_tolerance_m: float,
    strict: bool,
) -> tuple[list[Finding], int, int]:
    groups, triangle_count = _collect_triangles(
        normal_quantum=normal_quantum,
        plane_quantum_m=plane_quantum_m,
    )
    aggregate: DefaultDict[
        tuple[str, str, int, str, str, int, tuple[int, int, int, int]], list[float]
    ] = defaultdict(lambda: [0.0, 0.0])
    candidate_count = 0
    depsgraph = bpy.context.evaluated_depsgraph_get()
    ray_distance = _asset_ray_distance()

    for plane, records in groups.items():
        if len(records) < 2:
            continue
        # Sweep on the first projected axis to avoid an all-triangle O(n^2) scan.
        records.sort(key=lambda record: record.bounds[0])
        for index, first in enumerate(records):
            for second in records[index + 1 :]:
                if second.bounds[0] >= first.bounds[1] - 1e-10:
                    break
                if first.facing != second.facing:
                    # Opposite-facing coincident surfaces are bearing/contact
                    # interfaces, not two front faces competing in the renderer.
                    continue
                if min(first.bounds[3], second.bounds[3]) <= max(
                    first.bounds[2], second.bounds[2]
                ) + 1e-10:
                    continue
                candidate_count += 1
                polygon = _intersection_polygon(first.uv, second.uv)
                overlap = _intersection_area(polygon)
                if overlap <= overlap_epsilon_m2:
                    continue

                first_identity = (
                    first.object_name,
                    first.material_name,
                    first.source_part_count,
                )
                second_identity = (
                    second.object_name,
                    second.material_name,
                    second.source_part_count,
                )
                if second_identity < first_identity:
                    first_identity, second_identity = second_identity, first_identity
                key = (*first_identity, *second_identity, plane)
                aggregate[key][0] += overlap
                # Strict mode intentionally retains the old all-overlap gate.
                # In the normal render-risk mode, visibility probing is needed
                # only for cross-material surfaces; same-material overlap stays
                # available as a separately reported diagnostic.
                if strict or first.material_name == second.material_name:
                    continue
                if _intersection_is_exposed(
                    polygon,
                    first,
                    depsgraph=depsgraph,
                    ray_distance=ray_distance,
                    hit_tolerance_m=hit_tolerance_m,
                ):
                    aggregate[key][1] += overlap

    findings = [
        Finding(*key[:-1], key[-1], areas[0], areas[1])
        for key, areas in aggregate.items()
        if areas[0] > area_tolerance_m2
    ]
    findings.sort(key=lambda finding: finding.overlap_area_m2, reverse=True)
    return findings, triangle_count, candidate_count


def _format_plane(
    plane: tuple[int, int, int, int], normal_quantum: float, plane_quantum_m: float
) -> str:
    normal = tuple(component * normal_quantum for component in plane[:3])
    return (
        f"normal=({normal[0]:+.4f},{normal[1]:+.4f},{normal[2]:+.4f}) "
        f"offset={plane[3] * plane_quantum_m:+.6f}m"
    )


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "assets",
        nargs="*",
        default=list(DEFAULT_ASSETS),
        help="GLB paths relative to the repository root (defaults to the three batch-14 gates).",
    )
    parser.add_argument(
        "--area-tolerance-mm2",
        type=float,
        default=4.0,
        help="Fail when one named/material/plane pair exceeds this same-facing overlap area.",
    )
    parser.add_argument(
        "--plane-tolerance-mm",
        type=float,
        default=0.02,
        help="Plane-distance bucket used after Draco decoding.",
    )
    parser.add_argument(
        "--normal-quantum",
        type=float,
        default=1e-4,
        help="Unit-normal bucket size.",
    )
    parser.add_argument(
        "--overlap-epsilon-mm2",
        type=float,
        default=0.01,
        help="Numerical triangle-intersection noise floor.",
    )
    parser.add_argument(
        "--visibility-hit-tolerance-mm",
        type=float,
        default=0.25,
        help="Maximum first-hit distance from a candidate plane that still counts as exposed.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Fail on every overlap above tolerance, including same-material and occluded internals.",
    )
    parser.add_argument(
        "--max-reports",
        type=int,
        default=80,
        help="Maximum findings printed per asset (all findings still affect pass/fail).",
    )
    raw = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(raw)


def main() -> None:
    args = _arguments()
    if args.area_tolerance_mm2 <= 0 or args.plane_tolerance_mm <= 0:
        raise ValueError("Area and plane tolerances must be positive.")
    if (
        args.normal_quantum <= 0
        or args.overlap_epsilon_mm2 < 0
        or args.visibility_hit_tolerance_mm <= 0
    ):
        raise ValueError("Normal quantum must be positive and overlap epsilon non-negative.")

    plane_quantum_m = args.plane_tolerance_mm / 1000.0
    area_tolerance_m2 = args.area_tolerance_mm2 / 1_000_000.0
    overlap_epsilon_m2 = args.overlap_epsilon_mm2 / 1_000_000.0
    hit_tolerance_m = args.visibility_hit_tolerance_mm / 1000.0
    failed_assets = 0

    print(
        "COPLANAR_AUDIT_CONFIG "
        f"plane_tolerance_mm={args.plane_tolerance_mm:g} "
        f"area_tolerance_mm2={args.area_tolerance_mm2:g} "
        f"normal_quantum={args.normal_quantum:g} "
        f"mode={'strict' if args.strict else 'render-risk'}"
    )

    for requested_path in args.assets:
        asset_path = Path(requested_path)
        if not asset_path.is_absolute():
            asset_path = PROJECT_ROOT / asset_path
        asset_path = asset_path.resolve()
        if not asset_path.is_file():
            print(f"FAIL asset={asset_path} reason=missing-file")
            failed_assets += 1
            continue

        # Drop the previous asset before decoding the next one.  This keeps the
        # peak footprint close to one decoded GLB plus its triangle buckets.
        bpy.ops.wm.read_factory_settings(use_empty=True)
        gc.collect()
        bpy.ops.import_scene.gltf(filepath=str(asset_path))
        findings, triangle_count, candidate_count = _audit_loaded_asset(
            normal_quantum=args.normal_quantum,
            plane_quantum_m=plane_quantum_m,
            overlap_epsilon_m2=overlap_epsilon_m2,
            area_tolerance_m2=area_tolerance_m2,
            hit_tolerance_m=hit_tolerance_m,
            strict=args.strict,
        )

        cross_material = [
            finding for finding in findings if finding.material_a != finding.material_b
        ]
        same_material = [
            finding for finding in findings if finding.material_a == finding.material_b
        ]
        if args.strict:
            actionable = findings
            internal_cross_material: list[Finding] = []
        else:
            actionable = [
                finding
                for finding in cross_material
                if finding.exposed_area_m2 > area_tolerance_m2
            ]
            internal_cross_material = [
                finding
                for finding in cross_material
                if finding.exposed_area_m2 <= area_tolerance_m2
            ]

        if actionable:
            failed_assets += 1
            print(
                f"FAIL asset={asset_path.name} triangles={triangle_count} "
                f"same_plane_candidates={candidate_count} "
                f"actionable={len(actionable)} cross_material={len(cross_material)} "
                f"same_material={len(same_material)} "
                f"suppressed_internal_cross_material={len(internal_cross_material)}"
            )
            for finding in actionable[: args.max_reports]:
                reported_area = (
                    finding.overlap_area_m2 if args.strict else finding.exposed_area_m2
                )
                print(
                    f"  {'STRICT_OVERLAP' if args.strict else 'EXPOSED_CROSS_MATERIAL'} "
                    f"area_mm2={reported_area * 1_000_000.0:.3f} "
                    f"total_overlap_mm2={finding.overlap_area_m2 * 1_000_000.0:.3f} "
                    f"{_format_plane(finding.plane, args.normal_quantum, plane_quantum_m)} "
                    f"A={finding.object_a!r} material={finding.material_a!r} "
                    f"source_parts={finding.source_parts_a} "
                    f"B={finding.object_b!r} material={finding.material_b!r} "
                    f"source_parts={finding.source_parts_b}"
                )
            if len(actionable) > args.max_reports:
                print(f"  ... {len(actionable) - args.max_reports} actionable findings omitted")
        else:
            print(
                f"PASS asset={asset_path.name} triangles={triangle_count} "
                f"same_plane_candidates={candidate_count} actionable=0 "
                f"cross_material={len(cross_material)} same_material={len(same_material)} "
                f"suppressed_internal_cross_material={len(internal_cross_material)}"
            )

        if not args.strict and same_material:
            largest = max(same_material, key=lambda finding: finding.overlap_area_m2)
            print(
                "  INFO_SAME_MATERIAL_STRICT_ONLY "
                f"findings={len(same_material)} "
                f"largest_area_mm2={largest.overlap_area_m2 * 1_000_000.0:.3f} "
                f"material={largest.material_a!r} "
                f"{_format_plane(largest.plane, args.normal_quantum, plane_quantum_m)}"
            )
        if not args.strict and internal_cross_material:
            largest = max(
                internal_cross_material,
                key=lambda finding: finding.overlap_area_m2,
            )
            print(
                "  INFO_OCCLUDED_CROSS_MATERIAL "
                f"findings={len(internal_cross_material)} "
                f"largest_total_overlap_mm2={largest.overlap_area_m2 * 1_000_000.0:.3f} "
                f"A={largest.material_a!r} B={largest.material_b!r} "
                f"{_format_plane(largest.plane, args.normal_quantum, plane_quantum_m)}"
            )

        # Explicitly release the large buckets before the next factory reset.
        del findings
        gc.collect()

    if failed_assets:
        raise RuntimeError(
            f"same-facing coplanar surface audit ({'strict' if args.strict else 'render-risk'}) "
            f"failed for {failed_assets} asset(s)"
        )
    print(f"PASS all_assets={len(args.assets)}")


if __name__ == "__main__":
    main()
