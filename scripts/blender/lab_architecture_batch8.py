"""Build the authored LabSpace laboratory door and window family.

The models are original, dimension-driven planning representations informed by
the supplied Room 809 photographs and by common cleanroom construction:
flush hygienic leaves, sealed vision panels, anodized frames, concealed tracks,
and deep stainless pass-through liners.  They are not manufacturer-certified.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lab_furniture as lf


ASSETS = {
    "single-door": lf.AssetSpec("single-door", 0.90, 0.12, 2.10),
    "double-door": lf.AssetSpec("double-door", 1.80, 0.12, 2.10),
    "sliding-door": lf.AssetSpec("sliding-door", 1.20, 0.10, 2.10),
    "narrow-lite-door": lf.AssetSpec("narrow-lite-door", 0.90, 0.14, 2.10),
    "cleanroom-glazed-door": lf.AssetSpec("cleanroom-glazed-door", 1.00, 0.12, 2.10),
    "double-sliding-door": lf.AssetSpec("double-sliding-door", 1.80, 0.10, 2.10),
    "standard-window": lf.AssetSpec("standard-window", 1.20, 0.12, 1.20),
    "wide-window": lf.AssetSpec("wide-window", 2.40, 0.12, 1.20),
    "sliding-window": lf.AssetSpec("sliding-window", 1.60, 0.12, 1.20),
    "observation-window": lf.AssetSpec("observation-window", 2.00, 0.14, 1.00),
    "pass-through-window": lf.AssetSpec("pass-through-window", 0.90, 0.30, 0.90),
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", choices=("all", *ASSETS.keys()), default="all")
    parser.add_argument("--output-dir", default="public/models/hero")
    parser.add_argument("--save-blend-dir", default="")
    return parser.parse_args(argv)


def make_glass_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    opacity: float,
    roughness: float,
) -> bpy.types.Material:
    material = lf.make_material(name, color, roughness=roughness, coat=0.22, coat_roughness=0.06)
    material.surface_render_method = "DITHERED"
    material.diffuse_color = (*color[:3], opacity)
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    assert bsdf is not None
    lf.set_socket(bsdf, "Base Color", color)
    lf.set_socket(bsdf, "Alpha", opacity)
    lf.set_socket(bsdf, "Transmission Weight", 0.72)
    lf.set_socket(bsdf, "IOR", 1.46)
    return material


def build_architecture_materials() -> None:
    lf.build_materials()
    lf.MATERIALS.update(
        {
            "glass": make_glass_material(
                "Laminated laboratory safety glass",
                (0.70, 0.84, 0.84, 1.0),
                opacity=0.34,
                roughness=0.08,
            ),
            "glass_edge": make_glass_material(
                "Safety glass exposed edge",
                (0.28, 0.60, 0.61, 1.0),
                opacity=0.55,
                roughness=0.12,
            ),
            "seal": lf.make_material(
                "Laboratory perimeter gasket",
                (0.075, 0.092, 0.09, 1.0),
                roughness=0.68,
            ),
            "indicator": lf.make_material(
                "Cleanroom status indicator",
                (0.03, 0.58, 0.46, 1.0),
                metallic=0.04,
                roughness=0.28,
                coat=0.16,
            ),
        }
    )


def box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: str,
    *,
    bevel: float = 0.004,
    category: str = "architectural opening",
) -> bpy.types.Object:
    return lf.add_box(
        name,
        location,
        dimensions,
        lf.MATERIALS[material],
        bevel=bevel,
        category=category,
    )


def cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    material: str,
    *,
    axis: tuple[float, float, float] = (0.0, 0.0, 1.0),
    category: str = "door hardware",
) -> bpy.types.Object:
    return lf.add_cylinder(
        name,
        location,
        radius,
        depth,
        lf.MATERIALS[material],
        axis=axis,
        vertices=24,
        bevel=min(radius * 0.12, 0.0015),
        category=category,
    )


def add_perimeter_frame(
    spec: lf.AssetSpec,
    *,
    frame_width: float = 0.055,
    threshold_height: float = 0.032,
    material: str = "aluminum",
    include_threshold: bool = True,
) -> tuple[float, float]:
    side_depth = spec.depth
    box(
        "Left wraparound jamb",
        (-spec.width / 2 + frame_width / 2, 0, spec.height / 2),
        (frame_width, side_depth, spec.height),
        material,
        bevel=0.004,
        category="frame",
    )
    box(
        "Right wraparound jamb",
        (spec.width / 2 - frame_width / 2, 0, spec.height / 2),
        (frame_width, side_depth, spec.height),
        material,
        bevel=0.004,
        category="frame",
    )
    box(
        "Frame head",
        (0, 0, spec.height - frame_width / 2),
        (spec.width - frame_width * 2, side_depth, frame_width),
        material,
        bevel=0.004,
        category="frame",
    )
    if include_threshold:
        box(
            "Low laboratory threshold",
            (0, 0, threshold_height / 2),
            (spec.width - frame_width * 2, side_depth * 0.86, threshold_height),
            "stainless",
            bevel=0.003,
            category="threshold",
        )
    # Front and rear compression seals make the assembly credible from either room.
    for face_y, side in ((-side_depth / 2 + 0.006, "front"), (side_depth / 2 - 0.006, "rear")):
        for x, label in ((-spec.width / 2 + frame_width + 0.007, "left"), (spec.width / 2 - frame_width - 0.007, "right")):
            box(
                f"{side.title()} {label} neoprene seal",
                (x, face_y, spec.height / 2),
                (0.010, 0.008, spec.height - frame_width * 2),
                "seal",
                bevel=0.002,
                category="seal",
            )
        box(
            f"{side.title()} head neoprene seal",
            (0, face_y, spec.height - frame_width - 0.007),
            (spec.width - frame_width * 2.3, 0.008, 0.010),
            "seal",
            bevel=0.002,
            category="seal",
        )
    clear_width = spec.width - frame_width * 2 - 0.018
    clear_height = spec.height - frame_width - threshold_height - 0.018
    return clear_width, clear_height


def add_flush_vision_panel(
    name: str,
    *,
    x: float,
    width: float,
    bottom: float,
    height: float,
    depth: float,
) -> None:
    glass_depth = min(0.020, depth * 0.34)
    box(
        f"{name} vision glass",
        (x, 0, bottom + height / 2),
        (width, glass_depth, height),
        "glass",
        bevel=0.003,
        category="glazing",
    )
    frame = min(0.024, width * 0.14)
    for sx, label in ((-1, "left"), (1, "right")):
        box(
            f"{name} {label} flush glazing bead",
            (x + sx * (width / 2 + frame / 2), -depth * 0.34, bottom + height / 2),
            (frame, 0.012, height + frame * 2),
            "aluminum",
            bevel=0.002,
            category="glazing frame",
        )
        box(
            f"{name} {label} rear glazing bead",
            (x + sx * (width / 2 + frame / 2), depth * 0.34, bottom + height / 2),
            (frame, 0.012, height + frame * 2),
            "aluminum",
            bevel=0.002,
            category="glazing frame",
        )
    for z, label in ((bottom - frame / 2, "lower"), (bottom + height + frame / 2, "upper")):
        box(
            f"{name} {label} flush glazing bead",
            (x, -depth * 0.34, z),
            (width, 0.012, frame),
            "aluminum",
            bevel=0.002,
            category="glazing frame",
        )
        box(
            f"{name} {label} rear glazing bead",
            (x, depth * 0.34, z),
            (width, 0.012, frame),
            "aluminum",
            bevel=0.002,
            category="glazing frame",
        )


def add_lever_set(name: str, x: float, z: float, depth: float, *, both_faces: bool = True) -> None:
    faces = (-1, 1) if both_faces else (-1,)
    for face in faces:
        y = face * (depth / 2 - 0.016)
        cylinder(
            f"{name} {('front' if face < 0 else 'rear')} rose",
            (x, y, z),
            0.034,
            0.012,
            "stainless",
            axis=(0, 1, 0),
        )
        box(
            f"{name} {('front' if face < 0 else 'rear')} lever",
            (x + 0.055, y + face * 0.006, z),
            (0.11, 0.018, 0.022),
            "stainless",
            bevel=0.006,
            category="door hardware",
        )
        cylinder(
            f"{name} {('front' if face < 0 else 'rear')} lock cylinder",
            (x, y, z - 0.10),
            0.012,
            0.010,
            "zinc",
            axis=(0, 1, 0),
        )


def add_hinge_line(name: str, x: float, depth: float, height: float) -> None:
    for index, z in enumerate((0.28, height * 0.50, height - 0.30), 1):
        box(
            f"{name} hinge leaf {index}",
            (x, -depth / 2 + 0.010, z),
            (0.030, 0.012, 0.11),
            "stainless",
            bevel=0.002,
            category="door hardware",
        )
        cylinder(
            f"{name} hinge pin {index}",
            (x, -depth / 2 + 0.009, z),
            0.007,
            0.125,
            "zinc",
            axis=(0, 0, 1),
        )


def add_closer(name: str, x: float, z: float, depth: float) -> None:
    box(
        f"{name} concealed closer cover",
        (x, -depth / 2 + 0.020, z),
        (0.27, 0.030, 0.050),
        "powder_light",
        bevel=0.008,
        category="door closer",
    )
    box(
        f"{name} closer arm",
        (x + 0.09, -depth / 2 + 0.008, z - 0.055),
        (0.24, 0.012, 0.018),
        "stainless",
        bevel=0.004,
        category="door closer",
    )


def add_solid_leaf(
    name: str,
    *,
    x: float,
    width: float,
    depth: float,
    height: float,
    narrow_lite: bool,
    hinge_side: int,
) -> None:
    leaf_depth = depth * 0.52
    box(
        f"{name} hygienic leaf",
        (x, 0, height / 2),
        (width, leaf_depth, height),
        "powder_light",
        bevel=0.007,
        category="door leaf",
    )
    # Shallow rear skin and edge caps prevent a flat-facade appearance in orbit.
    box(
        f"{name} rear skin",
        (x, depth * 0.31, height / 2),
        (width - 0.018, 0.010, height - 0.020),
        "powder",
        bevel=0.004,
        category="door leaf rear",
    )
    for side in (-1, 1):
        box(
            f"{name} edge cap {side:+d}",
            (x + side * (width / 2 - 0.010), 0, height / 2),
            (0.020, leaf_depth + 0.010, height - 0.018),
            "aluminum",
            bevel=0.003,
            category="door leaf edge",
        )
    box(
        f"{name} front kick plate",
        (x, -depth * 0.31, 0.18),
        (width - 0.070, 0.010, 0.25),
        "stainless",
        bevel=0.003,
        category="door protection",
    )
    box(
        f"{name} automatic drop seal",
        (x, 0, 0.020),
        (width - 0.050, leaf_depth + 0.012, 0.022),
        "seal",
        bevel=0.002,
        category="seal",
    )
    if narrow_lite:
        add_flush_vision_panel(
            f"{name} narrow lite",
            x=x - hinge_side * width * 0.18,
            width=min(0.16, width * 0.22),
            bottom=0.70,
            height=min(0.88, height * 0.46),
            depth=depth,
        )
    handle_x = x - hinge_side * (width / 2 - 0.13)
    add_lever_set(name, handle_x, 1.00, depth)
    add_hinge_line(name, x + hinge_side * (width / 2 - 0.015), depth, height)
    add_closer(name, x + hinge_side * width * 0.17, height - 0.11, depth)


def build_single_door(spec: lf.AssetSpec, *, narrow_lite: bool = False) -> None:
    clear_width, clear_height = add_perimeter_frame(spec)
    add_solid_leaf(
        "Single door",
        x=0,
        width=clear_width,
        depth=spec.depth,
        height=clear_height,
        narrow_lite=narrow_lite,
        hinge_side=-1,
    )
    box(
        "Room identification plate",
        (spec.width / 2 - 0.12, -spec.depth / 2 + 0.006, 1.64),
        (0.11, 0.008, 0.052),
        "label",
        bevel=0.003,
        category="signage",
    )


def build_double_door(spec: lf.AssetSpec) -> None:
    clear_width, clear_height = add_perimeter_frame(spec)
    gap = 0.012
    leaf_width = (clear_width - gap) / 2
    for side, label in ((-1, "Left"), (1, "Right")):
        x = side * (leaf_width / 2 + gap / 2)
        add_solid_leaf(
            f"{label} door",
            x=x,
            width=leaf_width,
            depth=spec.depth,
            height=clear_height,
            narrow_lite=True,
            hinge_side=side,
        )
    box(
        "Meeting stile compression astragal",
        (0, 0, clear_height / 2),
        (0.025, spec.depth * 0.60, clear_height - 0.03),
        "seal",
        bevel=0.003,
        category="seal",
    )


def add_glazed_leaf(
    name: str,
    *,
    x: float,
    width: float,
    height: float,
    depth: float,
    lower_rail: float = 0.20,
    handle_side: int = 1,
) -> None:
    stile = min(0.045, width * 0.11)
    rail = min(0.055, height * 0.06)
    box(
        f"{name} glass",
        (x, 0, lower_rail + (height - lower_rail) / 2),
        (width - stile * 2, min(0.014, depth * 0.32), height - lower_rail - rail),
        "glass",
        bevel=0.002,
        category="glazing",
    )
    for side, label in ((-1, "left"), (1, "right")):
        box(
            f"{name} {label} stile",
            (x + side * (width / 2 - stile / 2), 0, height / 2),
            (stile, depth * 0.48, height),
            "aluminum",
            bevel=0.004,
            category="door leaf frame",
        )
    box(
        f"{name} head rail",
        (x, 0, height - rail / 2),
        (width - stile * 2, depth * 0.48, rail),
        "aluminum",
        bevel=0.004,
        category="door leaf frame",
    )
    box(
        f"{name} hygienic lower rail",
        (x, 0, lower_rail / 2),
        (width - stile * 2, depth * 0.48, lower_rail),
        "powder_light",
        bevel=0.005,
        category="door leaf frame",
    )
    handle_x = x + handle_side * (width / 2 - stile - 0.035)
    for face in (-1, 1):
        box(
            f"{name} {('front' if face < 0 else 'rear')} recessed pull",
            (handle_x, face * (depth * 0.28), 1.0),
            (0.025, 0.010, 0.21),
            "stainless",
            bevel=0.007,
            category="door hardware",
        )
    box(
        f"{name} safety marker",
        (x, -depth * 0.30, 1.18),
        (min(width * 0.28, 0.24), 0.008, 0.018),
        "indicator",
        bevel=0.002,
        category="safety marking",
    )


def build_cleanroom_glazed_door(spec: lf.AssetSpec) -> None:
    clear_width, clear_height = add_perimeter_frame(spec)
    add_glazed_leaf(
        "Cleanroom glazed swing leaf",
        x=0,
        width=clear_width,
        height=clear_height,
        depth=spec.depth,
        lower_rail=0.28,
    )
    add_hinge_line("Cleanroom glazed swing leaf", -clear_width / 2 + 0.015, spec.depth, clear_height)
    add_closer("Cleanroom glazed swing leaf", -clear_width * 0.17, clear_height - 0.11, spec.depth)


def add_sliding_header(spec: lf.AssetSpec) -> None:
    box(
        "Concealed sliding operator header",
        (0, 0, spec.height - 0.070),
        (spec.width - 0.110, spec.depth, 0.140),
        "powder_light",
        bevel=0.007,
        category="sliding operator",
    )
    box(
        "Operator access seam",
        (0, -spec.depth / 2 + 0.004, spec.height - 0.070),
        (spec.width - 0.150, 0.006, 0.006),
        "seal",
        bevel=0.001,
        category="sliding operator",
    )
    for x in (-spec.width * 0.24, spec.width * 0.24):
        cylinder(
            "Sliding carrier roller",
            (x, 0, spec.height - 0.115),
            0.024,
            spec.depth * 0.36,
            "zinc",
            axis=(0, 1, 0),
            category="sliding operator",
        )


def build_sliding_door(spec: lf.AssetSpec, *, double: bool = False) -> None:
    frame_width = 0.045
    clear_width, clear_height = add_perimeter_frame(
        spec,
        frame_width=frame_width,
        threshold_height=0.025,
    )
    add_sliding_header(spec)
    usable_height = clear_height - 0.095
    if double:
        gap = 0.012
        leaf_width = (clear_width - gap) / 2
        for side, label in ((-1, "Left"), (1, "Right")):
            add_glazed_leaf(
                f"{label} bi-parting leaf",
                x=side * (leaf_width / 2 + gap / 2),
                width=leaf_width,
                height=usable_height,
                depth=spec.depth,
                lower_rail=0.20,
                handle_side=-side,
            )
        box(
            "Bi-parting meeting gasket",
            (0, 0, usable_height / 2),
            (0.018, spec.depth * 0.42, usable_height - 0.05),
            "seal",
            bevel=0.002,
            category="seal",
        )
    else:
        # Two overlapping panels communicate the actual single-slide track logic.
        panel_width = clear_width * 0.56
        add_glazed_leaf(
            "Fixed glazed sidelite",
            x=clear_width * 0.21,
            width=panel_width,
            height=usable_height,
            depth=spec.depth * 0.92,
            lower_rail=0.20,
            handle_side=-1,
        )
        add_glazed_leaf(
            "Sliding glazed leaf",
            x=-clear_width * 0.21,
            width=panel_width,
            height=usable_height,
            depth=spec.depth,
            lower_rail=0.20,
            handle_side=1,
        )
    box(
        "Lower anti-derail guide",
        (0, 0, 0.036),
        (clear_width, spec.depth * 0.82, 0.018),
        "stainless",
        bevel=0.003,
        category="sliding operator",
    )


def add_window_frame(spec: lf.AssetSpec, *, frame: float = 0.050, depth: float | None = None) -> tuple[float, float]:
    actual_depth = depth if depth is not None else spec.depth
    for x, label in ((-spec.width / 2 + frame / 2, "left"), (spec.width / 2 - frame / 2, "right")):
        box(
            f"Window {label} jamb",
            (x, 0, spec.height / 2),
            (frame, actual_depth, spec.height),
            "aluminum",
            bevel=0.004,
            category="window frame",
        )
    for z, label in ((frame / 2, "sill"), (spec.height - frame / 2, "head")):
        box(
            f"Window {label}",
            (0, 0, z),
            (spec.width - frame * 2, actual_depth, frame),
            "aluminum" if label == "head" else "stainless",
            bevel=0.004,
            category="window frame",
        )
    for face_y, side in ((-actual_depth / 2 + 0.006, "front"), (actual_depth / 2 - 0.006, "rear")):
        box(
            f"Window {side} perimeter gasket top",
            (0, face_y, spec.height - frame - 0.006),
            (spec.width - frame * 2, 0.008, 0.010),
            "seal",
            bevel=0.002,
            category="window seal",
        )
        box(
            f"Window {side} perimeter gasket bottom",
            (0, face_y, frame + 0.006),
            (spec.width - frame * 2, 0.008, 0.010),
            "seal",
            bevel=0.002,
            category="window seal",
        )
    return spec.width - frame * 2, spec.height - frame * 2


def add_window_glass(
    name: str,
    *,
    x: float,
    width: float,
    bottom: float,
    height: float,
    depth: float,
) -> None:
    # Separated laminates provide real thickness and all-sided reflections.
    for y, face in ((-depth * 0.19, "front"), (depth * 0.19, "rear")):
        box(
            f"{name} {face} laminate",
            (x, y, bottom + height / 2),
            (width, min(0.010, depth * 0.11), height),
            "glass",
            bevel=0.002,
            category="glazing",
        )
    box(
        f"{name} spacer bar",
        (x, 0, bottom + 0.014),
        (width, depth * 0.30, 0.018),
        "aluminum",
        bevel=0.002,
        category="glazing spacer",
    )


def build_fixed_window(spec: lf.AssetSpec, panes: int) -> None:
    clear_width, clear_height = add_window_frame(spec)
    mullion = 0.045
    pane_width = (clear_width - mullion * (panes - 1)) / panes
    left = -clear_width / 2
    for index in range(panes):
        x = left + pane_width / 2 + index * (pane_width + mullion)
        add_window_glass(
            f"Observation pane {index + 1}",
            x=x,
            width=pane_width - 0.014,
            bottom=0.058,
            height=clear_height - 0.016,
            depth=spec.depth,
        )
        if index < panes - 1:
            divider_x = left + pane_width + index * (pane_width + mullion) + mullion / 2
            box(
                f"Structural mullion {index + 1}",
                (divider_x, 0, spec.height / 2),
                (mullion, spec.depth, clear_height),
                "aluminum",
                bevel=0.004,
                category="window mullion",
            )
    for x in (-spec.width * 0.31, spec.width * 0.31):
        box(
            "Sill drainage slot",
            (x, -spec.depth / 2 + 0.004, 0.022),
            (0.10, 0.006, 0.008),
            "seal",
            bevel=0.002,
            category="window drainage",
        )


def build_sliding_window(spec: lf.AssetSpec) -> None:
    clear_width, clear_height = add_window_frame(spec)
    panel_width = clear_width * 0.55
    for side, label in ((-1, "left sliding sash"), (1, "right fixed sash")):
        x = side * clear_width * 0.21
        sash_depth = spec.depth * 0.48
        y = -spec.depth * 0.13 if side < 0 else spec.depth * 0.13
        box(
            f"{label} glass",
            (x, y, spec.height / 2),
            (panel_width - 0.075, 0.010, clear_height - 0.075),
            "glass",
            bevel=0.002,
            category="glazing",
        )
        for sx in (-1, 1):
            box(
                f"{label} stile {sx:+d}",
                (x + sx * (panel_width / 2 - 0.018), y, spec.height / 2),
                (0.036, sash_depth, clear_height),
                "aluminum",
                bevel=0.003,
                category="window sash",
            )
        for sz in (-1, 1):
            box(
                f"{label} rail {sz:+d}",
                (x, y, spec.height / 2 + sz * (clear_height / 2 - 0.018)),
                (panel_width - 0.070, sash_depth, 0.036),
                "aluminum",
                bevel=0.003,
                category="window sash",
            )
    box(
        "Twin sliding sill track",
        (0, 0, 0.060),
        (clear_width, spec.depth * 0.78, 0.020),
        "stainless",
        bevel=0.002,
        category="window track",
    )
    box(
        "Sliding sash recessed latch",
        (-0.055, -spec.depth / 2 + 0.008, spec.height / 2),
        (0.026, 0.010, 0.12),
        "stainless",
        bevel=0.006,
        category="window hardware",
    )


def build_pass_through(spec: lf.AssetSpec) -> None:
    liner = 0.035
    # Deep stainless transfer liner uses the entire wall depth.
    for x, label in ((-spec.width / 2 + liner / 2, "left"), (spec.width / 2 - liner / 2, "right")):
        box(
            f"Pass-through {label} liner",
            (x, 0, spec.height / 2),
            (liner, spec.depth, spec.height),
            "stainless",
            bevel=0.004,
            category="transfer liner",
        )
    for z, label in ((liner / 2, "sill"), (spec.height - liner / 2, "head")):
        box(
            f"Pass-through {label} liner",
            (0, 0, z),
            (spec.width - liner * 2, spec.depth, liner),
            "stainless",
            bevel=0.004,
            category="transfer liner",
        )
    clear_width = spec.width - liner * 2
    clear_height = spec.height - liner * 2
    panel_width = clear_width * 0.55
    for face_y, face in ((-spec.depth / 2 + 0.030, "room A"), (spec.depth / 2 - 0.030, "room B")):
        for side, label in ((-1, "left"), (1, "right")):
            x = side * clear_width * 0.21
            box(
                f"{face} {label} sliding glass",
                (x, face_y, spec.height / 2),
                (panel_width - 0.055, 0.010, clear_height - 0.070),
                "glass",
                bevel=0.002,
                category="glazing",
            )
            for sx in (-1, 1):
                box(
                    f"{face} {label} sash stile {sx:+d}",
                    (x + sx * (panel_width / 2 - 0.014), face_y, spec.height / 2),
                    (0.028, 0.028, clear_height),
                    "aluminum",
                    bevel=0.003,
                    category="window sash",
                )
        box(
            f"{face} recessed pull",
            (-0.045, face_y + (-0.010 if face_y < 0 else 0.010), spec.height / 2),
            (0.024, 0.010, 0.12),
            "stainless",
            bevel=0.006,
            category="window hardware",
        )
    box(
        "Transfer work shelf",
        (0, 0, 0.055),
        (clear_width - 0.018, spec.depth - 0.018, 0.040),
        "stainless",
        bevel=0.006,
        category="transfer shelf",
    )
    box(
        "Pass-through status indicator",
        (spec.width / 2 - 0.09, -spec.depth / 2 + 0.008, spec.height - 0.075),
        (0.045, 0.010, 0.026),
        "indicator",
        bevel=0.004,
        category="interlock indicator",
    )


def build_geometry(spec: lf.AssetSpec) -> None:
    if spec.asset_id == "single-door":
        build_single_door(spec)
    elif spec.asset_id == "narrow-lite-door":
        build_single_door(spec, narrow_lite=True)
    elif spec.asset_id == "double-door":
        build_double_door(spec)
    elif spec.asset_id == "cleanroom-glazed-door":
        build_cleanroom_glazed_door(spec)
    elif spec.asset_id == "sliding-door":
        build_sliding_door(spec)
    elif spec.asset_id == "double-sliding-door":
        build_sliding_door(spec, double=True)
    elif spec.asset_id == "standard-window":
        build_fixed_window(spec, 1)
    elif spec.asset_id == "wide-window":
        build_fixed_window(spec, 3)
    elif spec.asset_id == "observation-window":
        build_fixed_window(spec, 2)
    elif spec.asset_id == "sliding-window":
        build_sliding_window(spec)
    elif spec.asset_id == "pass-through-window":
        build_pass_through(spec)
    else:
        raise KeyError(spec.asset_id)


def validate_architecture_statistics(
    spec: lf.AssetSpec,
    stats: dict[str, object],
    *,
    imported: bool,
) -> None:
    bounds = stats["bounds_m"]
    dimensions = bounds["dimensions"]
    minimum = bounds["min"]
    maximum = bounds["max"]
    errors: list[str] = []
    for label, actual, expected in zip(
        ("width", "depth", "height"),
        dimensions,
        (spec.width, spec.depth, spec.height),
    ):
        if abs(actual - expected) > 0.006:
            errors.append(f"{label} {actual:.4f} m differs from {expected:.4f} m")
    if abs(minimum[2]) > 0.002:
        errors.append(f"minimum z {minimum[2]:.6f} m is not grounded")
    center_x = (minimum[0] + maximum[0]) * 0.5
    center_y = (minimum[1] + maximum[1]) * 0.5
    if abs(center_x) > 0.002 or abs(center_y) > 0.002:
        errors.append(f"footprint center ({center_x:.6f}, {center_y:.6f}) is not at origin")
    if stats["mesh_objects"] > 25:
        errors.append(f"{stats['mesh_objects']} runtime batches exceeds the 25 draw-call target")
    if stats["mesh_objects"] < 4:
        errors.append(f"only {stats['mesh_objects']} material batches")
    if stats["materials"] < 4:
        errors.append(f"only {stats['materials']} exported PBR materials")
    if imported:
        disallowed = [
            obj.name for obj in bpy.context.scene.objects if obj.type in {"CAMERA", "LIGHT"}
        ]
        if disallowed:
            errors.append(f"export contains cameras/lights: {disallowed}")
    if errors:
        stage = "imported GLB" if imported else "authored scene"
        raise RuntimeError(f"{spec.asset_id} {stage} validation failed: " + "; ".join(errors))


def inspect_export(spec: lf.AssetSpec, path: Path) -> dict[str, object]:
    if not path.exists() or path.stat().st_size < 50_000:
        raise RuntimeError(f"GLB output is missing or unexpectedly small: {path}")
    lf.reset_scene()
    result = bpy.ops.import_scene.gltf(filepath=str(path))
    if "FINISHED" not in result:
        raise RuntimeError(f"Fresh GLB import failed: {result}")
    stats = lf.authored_statistics(spec)
    stats["bytes"] = path.stat().st_size
    stats["output"] = str(path)
    validate_architecture_statistics(spec, stats, imported=True)
    return stats


def build_one(spec: lf.AssetSpec, output_dir: Path, save_blend_dir: Path | None) -> dict[str, object]:
    lf.reset_scene(spec.asset_id)
    lf.create_root(spec)
    assert lf.ROOT is not None
    lf.ROOT["asset_class"] = "wall-hosted laboratory opening"
    lf.ROOT["reference_standard"] = (
        "Room 809 photographs; hygienic cleanroom doors; flush observation glazing"
    )
    build_architecture_materials()
    build_geometry(spec)
    batching = lf.consolidate_static_meshes_by_material()
    authored = lf.authored_statistics(spec)
    validate_architecture_statistics(spec, authored, imported=False)
    lf.ROOT["authored_bounds_m"] = authored["bounds_m"]["dimensions"]
    lf.ROOT["source_part_count"] = batching["source_parts"]
    lf.ROOT["runtime_batch_count"] = batching["runtime_batches"]

    if save_blend_dir:
        save_blend_dir.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(save_blend_dir / f"{spec.asset_id}.blend"))

    output_path = output_dir / f"{spec.asset_id}.glb"
    lf.export_glb(output_path)
    inspected = inspect_export(spec, output_path)
    print(
        "LABSPACE_ARCHITECTURE_ASSET "
        + json.dumps(
            {
                "asset": spec.asset_id,
                "source_parts": batching["source_parts"],
                "runtime_batches": batching["runtime_batches"],
                "vertices": inspected["vertices"],
                "triangles": inspected["triangles"],
                "bytes": inspected["bytes"],
                "bounds_m": inspected["bounds_m"],
                "output": inspected["output"],
            },
            sort_keys=True,
        )
    )
    return inspected


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    save_blend_dir = Path(args.save_blend_dir).resolve() if args.save_blend_dir else None
    requested = ASSETS.values() if args.asset == "all" else (ASSETS[args.asset],)
    summaries = [build_one(spec, output_dir, save_blend_dir) for spec in requested]
    print(
        f"LABSPACE_ARCHITECTURE_BATCH_COMPLETE models={len(summaries)} "
        f"bytes={sum(int(summary['bytes']) for summary in summaries)} output={output_dir}"
    )


if __name__ == "__main__":
    main()
