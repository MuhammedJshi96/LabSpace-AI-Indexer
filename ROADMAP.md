# Roadmap

## Recommended next phase

1. Complete multi-laboratory management with guarded laboratory deletion, laboratory/room reordering, duplicate-as-template, and dependency handling. Creation, activation, deliberate renaming, and guarded room deletion are implemented today.
2. Continue reference-led fidelity and performance refinement across the 104 all-sided authored user-visible GLBs while preserving the exact top/isometric same-model render contract and progressing toward the `references/ref1.png` and `references/ref2.png` photoreal target.
3. Extend the project-wide Spatial Index Finder with governed/licensed item imagery, saved evidence viewpoints, richer authored internal storage geometry, optional measured/scan-derived room backgrounds, and controlled cross-room move workflows. Inventory already accepts an online image URL or a browser-embedded local image.
4. Register reusable non-showcase environment profiles for common chemistry, biology, instrument, and pilot-plant rooms. Keep the DEMO-01 reference-services profile optional and add measured MEP detail only to templates backed by survey data.
5. Field-check and photorealistically finish DEMO-01. Its concave shell, entrance recess, hosted openings, islands, perimeter casework, storage, and circulation were informed by Room 809 reference captures; measured dimensions, richer room materials, indirect light, and dense small-scale context remain.
6. Expand the current ten-floor/ten-wall shared material registry with governed role-specific worktop, casework, and service finish packs without splitting 2D/3D definitions or increasing runtime texture cost unnecessarily.
7. Extend the current single simple-loop floor topology into a computational geometry kernel that explicitly supports branches/partitions, multiple loops, holes, curves, and self-intersection repair.
8. Add room templates, cross-room equipment reporting, asset maintenance schedules, and controlled moves between rooms on top of the implemented project-level laboratory/room index.
9. Normalize organization, user, project, laboratory, room, and version records in PostgreSQL while retaining JSONB scene payloads.
10. Add authenticated organizations, role-based access, audit events, explicit project selection, collaborative presence, and conflict-aware object commands.
11. Add reusable custom asset authoring, import/export packages, and thumbnail caching in a worker.
12. Evolve the current WebMCP agent surface with authenticated organization policy, scoped evidence retention, and evaluated intent-to-tool workflows. Keep deterministic search and validation authoritative and never let generated text replace stored records.
13. Add barcode formats, template designers, batch print calibration, background report jobs, localization, accessibility passes, and large-scene virtualization.

## Prototype limitations to preserve honestly

- Single active local project record and single user, although that project can contain multiple laboratories and rooms.
- No cloud sync or concurrency.
- Laboratories and rooms can be created, activated, and renamed, and user rooms can be deleted with safeguards. Laboratory deletion and general laboratory/room reordering are not yet available.
- Planning geometry only; not a certified architectural, MEP, safety, or equipment-clearance system.
- Visual wall openings and connected plan segments are suitable for layout work but are not BIM solids.
- One simple closed straight-wall loop can define rectangular, concave, split-edge, or skewed floors. Open chains, branches/partitions, multiple loops, holes, curves, and self-crossing perimeters deliberately retain the rectangular fallback.
- Environment profiles are optional per room, but only the DEMO-01 showcase profile is bundled today; it is sparse 3D visual dressing, not selectable or measured MEP geometry.
- Light-gray epoxy includes photographic maps; sealed concrete and welded vinyl currently use procedural plan/PBR treatments.
- All 104 user-visible assets are authored GLBs; the two hidden variable-length wall primitives remain procedural. Catalog-wide construction and shader QA should continue against the `ref1`/`ref2` photoreal benchmark.
- The Spatial Index Finder is connected to canonical records, but item cards fall back to their containing spatial asset and the room view is not a measured or scan-derived facility capture.
- No embedded model provider ships in the current runtime. A compatible browser agent may invoke the current WebMCP tools, while LabSpace remains the deterministic source of project, geometry, inventory, and evidence facts.
- Browser print-to-PDF is the supported PDF path.
