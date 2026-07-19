# Roadmap

## Recommended next phase

1. Complete multi-laboratory management with laboratory/room rename, delete, reorder, duplicate-as-template, and guarded dependency handling. Creation and active-room switching are implemented today.
2. Replace the remaining high-use procedural equipment with manufacturer-informed, all-sided authored GLBs while preserving the exact top/isometric same-geometry render contract; keep professional hosted doors/windows parametric and continue toward the `references/ref1.png` and `references/ref2.png` photoreal target.
3. Extend the project-wide Spatial Index Finder with licensed item-specific imagery, saved evidence viewpoints, authored internal storage geometry, optional measured/scan-derived room backgrounds, and controlled cross-room move workflows.
4. Register reusable non-demo environment profiles for common chemistry, biology, instrument, and pilot-plant rooms. Keep the Room 809 reference-services profile optional and add measured MEP detail only to templates backed by survey data.
5. Field-check and photorealistically finish the now-reconciled optional Room 809 demonstration. The concave shell, entrance recess, hosted openings, two islands, six-position evaporator row, perimeter casework, sinks, racks, cold storage, and circulation are implemented from the five Floorplanner captures; measured dimensions, richer room materials, indirect light, and dense small-scale context remain.
6. Add photographic/authored map sets for sealed concrete and welded vinyl, then expand the shared material registry to wall, worktop, casework, and service finishes without splitting 2D/3D definitions.
7. Extend the current single simple-loop floor topology into a computational geometry kernel that explicitly supports branches/partitions, multiple loops, holes, curves, and self-intersection repair.
8. Add room templates, cross-room equipment reporting, asset maintenance schedules, and controlled moves between rooms on top of the implemented project-level laboratory/room index.
9. Normalize organization, user, project, laboratory, room, and version records in PostgreSQL while retaining JSONB scene payloads.
10. Add authenticated organizations, role-based access, audit events, explicit project selection, collaborative presence, and conflict-aware object commands.
11. Add reusable custom asset authoring, import/export packages, and thumbnail caching in a worker.
12. Add an optional LabSpace AI API adapter for model-driven intent resolution and evidence explanation over the canonical index and validator. Keep deterministic search and validation as the no-billing fallback and never let generated text replace stored records.
13. Add barcode formats, template designers, batch print calibration, background report jobs, localization, accessibility passes, and large-scene virtualization.

## Prototype limitations to preserve honestly

- Single active local project record and single user, although that project can contain multiple laboratories and rooms.
- No cloud sync or concurrency.
- Laboratories and rooms can be created and activated, but cannot yet be renamed, deleted, or reordered through the UI.
- Planning geometry only; not a certified architectural, MEP, safety, or equipment-clearance system.
- Visual wall openings and connected plan segments are suitable for layout work but are not BIM solids.
- One simple closed straight-wall loop can define rectangular, concave, split-edge, or skewed floors. Open chains, branches/partitions, multiple loops, holes, curves, and self-crossing perimeters deliberately retain the rectangular fallback.
- Environment profiles are optional per room, but only the Room 809 demonstration profile is bundled today; it is sparse 3D visual dressing, not selectable or measured MEP geometry.
- Light-gray epoxy includes photographic maps; sealed concrete and welded vinyl currently use procedural plan/PBR treatments.
- Thirty-nine assets are authored GLBs; the remaining procedural equipment and current room context do not yet reach the `ref1`/`ref2` photoreal benchmark.
- The Spatial Index Finder is connected to canonical records, but item cards fall back to their containing spatial asset and the room view is not a measured or scan-derived facility capture.
- No live model provider ships in the current runtime. LabSpace AI API support is future work rather than a hidden or partially configured feature.
- Browser print-to-PDF is the supported PDF path.
