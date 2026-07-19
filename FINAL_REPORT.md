# LabSpace Indexer — Floorplanner-reconciled demonstration and Spatial Index milestone

Date: 2026-07-18 (Asia/Tokyo)

## Outcome

The current implementation runs locally at `http://127.0.0.1:3004/` as a professional multi-laboratory editor and indexing prototype. DEMO-01 is the optional competition showcase. Room 809 is retained only as reference provenance and is not the runtime boundary for project navigation, room creation, layers, indexing, materials, or 3D environment behavior.

A project can contain multiple laboratories and multiple blank rooms. The project workspace shows their hierarchy, creates new laboratories or rooms, and switches the active room. Every room owns its scene, semantic layers, floor finish, optional environment profile, indexed objects, storage hierarchy, inventory, and equipment records.

This milestone establishes the generalized product foundation and expands the reference-driven hero library. It does not claim the scan-like realism shown in `references/ref1.png` and `references/ref2.png`: 45 of 96 catalog assets have all-sided authored GLBs, while 51 use recognizable procedural planning geometry, including intentionally parametric hosted openings.

The Spatial Index Finder now implements the reference's core interaction contract—project-wide deterministic search, cross-laboratory room switching, selected spatial trace, exact location hierarchy, record detail, camera navigation, and room-aware editor handoff—using canonical LabSpace data. Its current room image remains a real-time planning renderer, not a photogrammetric or scan-derived facility twin. No live model provider ships in the runtime; an optional LabSpace AI API remains future architecture.

DEMO-01 uses selected spatial cues informed by the five supplied Room 809 Floorplanner views. The former generic rectangle was replaced by an eight-wall concave footprint with an entrance projection, hosted openings, two long islands, perimeter functions, and clear circulation. This remains reusable showcase content, not a dependency of blank rooms or the general editor.

## Delivered in this pass

### Analytical equipment and Shimadzu Ref2 casework

- Added original all-sided HPLC, gas chromatograph, UV-Vis spectrophotometer, microplate reader, microcentrifuge, and hotplate-stirrer GLBs with official-reference planning envelopes and functional front, rear, side, top, ventilation, interface, foot, and service construction.
- Standardized their primary bodies on cool white, light instrument grey, brushed silver, and stainless finishes. Dark material is reserved for small functional details and deliberate working surfaces.
- Rebuilt the service-bridge island around `Lab Bench Shimadzu Ref2.png`, preserving distinct casework on both long faces and replacing the open rack with a raised three-bay glazed sliding-door hutch and light service spine over the dark phenolic worktop.
- Tightened the Spatial Index presentation with a closer camera, grid-free neutral background, darker epoxy floor, stronger contact grounding, and a camera-side wall cutaway that leaves the far architecture solid.
- Generated exact material-aware top and isometric renders from the same GLBs used by the room and Asset Studio, then regenerated the remaining procedural render set after four equipment migrations.

### Reference-derived Room 809 spatial reconstruction

- Traced an 8.71 × 8.69 m concave shell with a 68.611 m² floor and 34.8 m perimeter from the authoritative top plan.
- Hosted a 2.20 m main double entrance, a 0.90 m west service entrance, and five 0.95 m north windows directly on their walls.
- Re-composed 63 scene objects, including two authored service-bridge islands and six authored modern rotary evaporators, plus perimeter benches, washing, fume extraction, cold storage, reagent storage, shelving, racks, equipment, seating, safety, and trolley context.
- Retuned the independent Room 809 ceiling/services profile to the new footprint, including the light grid, vents, duct, rails, eight power drops, and supporting scene context.
- Upgraded plan geometry so rotated objects snap and collide using their true axis-aligned plan envelope. Tall service islands expose an explicit 900 mm support surface for equipment placement.
- The reconstructed scene produces zero placement warnings in domain validation.

### Project, laboratory, and room workspace

- A generic project navigator lists every laboratory and its rooms, including room code and scene item count.
- Users can create a new blank project, create a laboratory with its first empty room, add another room under a selected laboratory, and switch the active workspace.
- `createBlankProject`, `createBlankLaboratory`, and `createBlankRoom` construct professional defaults without copying Room 809 objects or identifiers.
- New rooms start without walls, openings, zones, assets, storage locations, inventory, equipment records, or environmental dressing.
- Laboratory and room creation validates scoped code uniqueness. The current UI does not yet provide rename, delete, or reorder operations for laboratories and rooms.

### Semantic, room-local layers

- Default layers carry roles for walls, openings, furniture, storage, equipment, utilities, safety, labels, and measurements.
- Asset placement resolves a layer by semantic role from the active scene rather than relying on seed constants.
- Legacy and imported layers are retained; recognized names acquire a semantic role, and missing professional defaults receive fresh scene-local IDs.

### Laboratory-aware physical indexing

- Object allocation and controlled reindexing require the active laboratory code together with room and optional zone codes.
- Normalization unifies case, spacing, punctuation, and full-width keyboard input.
- Allocation checks normalized scene codes, skips reserved collisions, and produces deterministic object and nested storage codes.
- Default equipment identifiers derive from the placed object's actual normalized index code and remain unique among equipment records.
- The indexing domain is verified with independent chemistry and genomics laboratory/room examples, not only the supplied demonstration.

### Reusable floor-material system

- A generic registry defines light-gray epoxy, sealed concrete, and welded vinyl sheet.
- The same definition supplies the 2D plan treatment and 3D PBR properties, keeping room views synchronized when the finish changes.
- The epoxy finish uses photographic maps. Concrete and vinyl currently use procedural patterns/PBR parameters and still need authored photographic map sets.

### Optional room environment profiles

- Rooms select presentation-only ceiling, light, duct, utility, and service context through `environmentProfileId`.
- New blank rooms default to no environment profile.
- Assigned context remains independently hideable from the 3D toolbar and does not alter indexed objects, walls, or floors.
- The Room 809 reference-services profile is currently the only bundled registration. The profile registry and renderer are reusable for future laboratory templates.

### Reference-driven asset authoring

- Added five original all-sided casework assets based on the latest supplied references: sink bench, overhead service bench, open stainless wash basin, enclosed stainless basin, and island bench with a raised service bridge.
- Added credible worktop openings, basin interiors, water and drain detail, faucets, casework seams, drawers, doors, pulls, rear service panels, feet, glazing, shelves, outlets, guards, and service raceways.
- Added six authored storage workhorses: two-door base cabinet, five-drawer base cabinet, sink cabinet, framed-glass wall cabinet, split tall cabinet, and open shelving. Authored normalized drawer/bin bounds now give exact scalable Spatial Index traces for the demonstration hierarchy.
- Added five reference-specific families: steel sliding cabinet, upper-glazed/lower-steel sliding cabinet with bins, stainless glassware drying rack, PHCbi-class biomedical freezer, and compact ventilated solvent cabinet.
- Fully replaced the rotary evaporator with an original Büchi R-300-class model using the official 607 × 429 × 947 mm reference envelope and the supplied modern arrangement: left process interface, electric lift and angled drive, visible blue-coil vertical condenser and receiving train, right-side charged flask, separate digital bath, and detailed rear services.
- Generated new 384 × 256 isometric and 384 × 384 top renders directly from the authored GLBs so the Asset Library, 2D plan, room view, and Asset Studio keep one geometry source.

### Searchable Spatial Index workspace

- Added `/digital-twin` with a large live 3D room, disciplined spatial-index navigation, unified inventory/equipment/location search, scrollable result cards, and a full-height selected-record panel.
- The selected record drives one continuous teal trace across the result card, exact location breadcrumb, QR identity, nested storage region, and 3D scene selection.
- Nested cabinets, shelves, drawers, compartments, and bins receive derived sub-object highlight envelopes; the location path remains canonical even while authored internal cabinet geometry is still being expanded.
- Navigate to location focuses the camera on the selected record, enables wall cutaway when required, and supports performance, balanced, and detail pixel-density modes. A real 2D fallback uses the synchronized plan renderer.
- Record links return to the main editor with the same object, nested location, and inspector context selected. Concurrent Strict Mode hydration is now single-flight so a later project load cannot clear that deep link.

## Retained editor capabilities

- Blank-start drawing, continuous wall chains, direct wall-body and endpoint manipulation, connected-corner coherence, and hosted door/window behavior.
- Reliable object movement, middle-mouse and Space+drag panning, Arrow/WASD navigation, elevation, horizontal/vertical flip, undo/redo, and persistence.
- Collapsible main side panels, a resizable keyboard-accessible 2D/3D split, readable desktop typography, a visible Asset Studio, and isolated renderer failures.
- A simple closed straight-wall polygon shared by 2D floor clipping, 3D triangulation, area/perimeter reporting, placement validation, and one-step normalized room resizing.

## Asset and render coverage

- 96 catalog definitions.
- 45 all-sided authored GLBs.
- 90 exact GLB-derived renders: 45 isometric and 45 top views.
- 51 procedural models.
- 102 same-procedural-geometry renders: 51 isometric and 51 top views.
- 192 same-geometry catalog PNGs in total.

The room view, Asset Studio, Asset Library, and 2D plan therefore use one canonical geometry source per asset. This consistency does not make the remaining procedural assets photoreal or manufacturer-certified.

## Validation

- Strict TypeScript checking and zero-warning linting.
- 78 Vitest tests across 19 files.
- The Playwright workflows include focused 3D canvas/Asset Studio, Spatial Index search/focus/evidence/deep-link, direct placement-warning, and large/small Asset Studio framing coverage.
- Asset validation for 96 definitions, 45 GLBs, 90 authored renders, 102 procedural renders, and all 192 transparent PNGs.
- Production build validation.
- The local preview server remains on port 3004. Live browser inspection confirmed the tighter grid-free Spatial Index framing, darker epoxy floor, camera-side wall cutaway, 96-entry Asset Studio manifest, revised Shimadzu island, and new HPLC asset after the production build.

See `TESTING.md` for commands and the manual regression checklist.

## Goal status

- Full professional project/laboratory/room data model: implemented.
- Generic laboratory/room creation and active-workspace switching: implemented.
- Laboratory/room rename, delete, and reorder: still open.
- Scene-local semantic layer resolution: implemented.
- Laboratory-aware indexes and equipment IDs: implemented.
- Reusable material registry synchronized in 2D/3D: implemented for three finishes; photographic maps remain open for concrete and vinyl.
- Optional per-room environment profiles: implemented; only the DEMO-01 showcase profile is currently registered.
- Reference-style searchable Spatial Index interaction contract: implemented against canonical project-wide laboratory and room data; item-specific photography and scan-level room rendering remain open.
- Blank rooms with no inherited demo state: implemented.
- Reliable wall, object, viewport, split-view, and renderer interactions: implemented for the documented workflows.
- Advanced floor topology beyond one simple closed straight-wall loop: still open.
- Full `ref1`/`ref2` realism across all 96 assets and arbitrary laboratory scenes: still open.

## Recommended next production phase

Build management completeness and realism in parallel: add laboratory/room rename, delete, reorder, and reusable template workflows; field-check the inferred Room 809 dimensions when measured data becomes available; register at least two non-demo environment profiles; author photographic concrete/vinyl and room-surface materials; and convert the remaining high-use procedural equipment to all-sided GLBs while retaining dimension-driven hosted openings. Preserve the generalized project, semantic-layer, lab-aware-indexing, material, and environment contracts while extending floor topology to holes, multiple loops, partitions, and curves.
