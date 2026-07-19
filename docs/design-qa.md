# Design QA — photoreal Room 809 target

## Evidence

- Photoreal target: the two supplied Lab 809 Index / Digital Twin reference
  images in the active task attachments.
- Room evidence: the supplied Kyushu University Room 809 photographs.
- Spatial composition evidence: the five supplied 2026-07-15 Floorplanner top/orbit views.
- Current editor: `screenshots/editor-1920x1080.png`.
- Current Digital Twin index: `screenshots/digital-twin-3004.png` and
  `screenshots/digital-twin-exact-location-3004.png`.
- Current authored room: `screenshots/room809-authored-3d-1440x900.png`.
- Combined target comparison: `screenshots/photoreal-target-comparison.png`.
- Authored object evidence: the Asset Studio screenshots in `screenshots/`.

## What passes

- Large-screen typography is readable: 14 px controls/body, 13 px labels, and a
  12 px visible metadata minimum.
- 2D, Split, and 3D presentations remain usable without a disappearing work area
  or page-level blank state.
- Authored heroes are recognizable, orbitable from every side, real-scale, and
  floor-grounded.
- The room, Asset Studio, 2D plan, and Asset Library derive their authored visuals
  from the same GLB source.
- The authored hero materials and silhouettes are substantially more specific
  than the earlier modular-box representation.
- Continuous walls, stable item dragging, Asset Studio access, and resizable split
  panes match the requested interactions.
- The reference-style Digital Twin interaction contract now works: unified search,
  selected result, exact hierarchy, nested storage trace, QR identity, camera focus,
  2D fallback, and editor deep link share canonical data.
- The Room 809 demonstration now follows the reference footprint and major zoning:
  eight concave wall segments, recessed entrance, hosted openings, two long islands,
  six rotary evaporators, perimeter casework/washing/storage, and retained circulation.

## Visible gap to the target

The target reads as a complete photoreal digital twin, with detailed geometry on
almost every visible object, dense small-scale laboratory context, convincing
surface variation, realistic indirect light, and scan-like room integration. The
current build is still a planning visualization with 45 authored heroes among 96
catalog definitions.

- 51 catalog assets still use procedural geometry; the 11 professional hosted door/window entries remain parametric by design.
- The authored set has separated physical materials but not complete UV-authored
  base-color/normal/roughness/metallic maps for every close-up surface.
- The room needs more glassware, bottles, tubing, cables, labels, containers,
  paper, overhead services, and incidental wear.
- Lighting needs calibrated indirect illumination, exposure, reflections, and
  depth cues to match the reference.
- Room proportions and objects are now Floorplanner-reconciled planning
  approximations, not a measured survey or manufacturer-certified reconstruction.

## Priority findings

- P0: none observed.
- P1: full-room photoreal parity is not yet achieved; authored migration and a
  measured/textured room pass remain required.
- P2: tune composition, surface wear, labeling, cables, clutter density, indirect
  lighting, and depth cues after the remaining high-visibility assets are
  authored.

final result: current authored-hero phase passed; final photoreal target not yet passed.
