# Changelog

## 0.1.13 — 2026-07-20

- Standardized the competition showcase identity as **DEMO-01** across the README, current architecture/submission documentation, seed-facing labels, and future design guidance. Room 809 is now described only as provenance from the author's laboratory where that reference history is relevant.

## 0.1.12 — 2026-07-19

- Reframed the second competition workspace as **Spatial Index Finder** and removed the floating conversational assistant, sample prompts, generated-answer UI, and runtime-provider claims without changing the canonical index, exact-location evidence, QR identity, camera focus, or opt-in storage access preview.
- Made index filtering deterministic and multi-term across stored rooms, equipment, inventory, nested storage, owners, notes, and identifiers. Explicit record selection remains the only source of evidence-panel and camera changes.
- Kept placement findings in the Layout Editor's direct selection status and Warnings inspector, where the canonical geometry validator remains authoritative.
- Documented GPT-5.6/Codex as the Build Week engineering and design collaborator and the optional LabSpace AI API as future architecture only. The shipped workflow remains self-contained and requires no API key or billing.
- Captured the user-approved split-view zoom and made its relaxed isometric framing the room-relative default for 3D entry when no saved camera pose exists. Saved poses, view-cube commands, and exact-record focus remain authoritative.
- Added a counted Favorites library tab and empty state, plus immediate star feedback, reload persistence, storage-failure fallback, and a focused browser regression.
- Updated public README, architecture, roadmap, testing, submission, licensing, attribution, and judge/video materials for the safe release path.
- Passed the complete release gate: zero-warning ESLint, strict TypeScript, all 96 asset definitions, 148 authored and 44 procedural catalog renders, 115 Vitest cases across 23 files, 21 browser workflows, and the production build.

## 0.1.11 — 2026-07-18

- Registered the July 18 modular asset sheets as composition/variant references and made `Lab Bench Shimadzu Ref2.png` the primary supplied reference for the double-sided island family. Generated sheets remain subordinate to official manufacturer dimensions and anatomy for equipment.
- Rebuilt `island-bench-service-bridge.glb` around that reference: independent drawer/door casework on both long faces, dark phenolic worktop, light metallic service spine, and a raised three-bay glazed sliding-door hutch with two internal shelves and credible end/top construction.
- Added six original all-sided analytical assets: modular HPLC system, gas chromatograph, UV-Vis spectrophotometer, microplate reader, microcentrifuge, and hotplate stirrer. Official Shimadzu, Thermo Scientific, Eppendorf, and IKA product dimensions guide their representative planning envelopes.
- Applied cool white, light instrument grey, brushed silver, and stainless primary finishes throughout the batch; dark material is limited to screens, seals, ports, working surfaces, and other functional details.
- Improved the Digital Twin presentation with tighter camera framing, a grid-free neutral surround, darker epoxy floor response, stronger contact shadows, and a camera-side architectural cutaway that keeps far walls opaque instead of washing out the entire room.
- Generated exact authored isometric/top catalog renders for the six new instruments and revised island, removed eight stale procedural images for the four migrated entries, and rebuilt the remaining 102 procedural renders.
- Expanded the catalog to 96 assets: 45 authored GLBs and 51 procedural models, with 192 same-geometry catalog renders in total.
- Verified 96 definitions, 45 GLBs, 90 authored renders, 102 procedural renders, strict type checking, zero-warning linting, 78 Vitest cases, the production build, and three focused browser workflows covering 3D/Asset Studio, Digital Twin trace, and large/small asset framing. Live port-3004 inspection confirmed the revised island, HPLC asset, and tighter Digital Twin presentation.

## 0.1.10 — 2026-07-18

- Adopted a neutral-light finish standard for upcoming assets: metallic grey, brushed silver/stainless, cool white and light instrument grey are the default body colors. Black is limited to small functional details or an explicit supplied/official reference requirement; the new hosted-opening frames were lightened to silver in the same pass.
- Added an official-reference fidelity batch for eight high-visibility assets: round stool, laboratory chair, office chair, analytical balance, top-loading balance, water bath, dual-block dry bath and vortex mixer. Each original logo-free GLB is real-scale, self-contained, floor-grounded, re-import validated and constructed for front/rear/side/top orbit inspection.
- Migrated the five bench instruments to representative official envelopes and anatomy from Shimadzu AP and UW/UX balances, Yamato BM200 water bath, Thermo Scientific two-block dry bath and Scientific Industries Vortex-Genie 2, while retaining the supplied Room 809/Digital Twin references for laboratory context and material language.
- Generated corrected six-view QA frames plus exact GLB-derived transparent isometric/top renders for the eight migrated assets. The authored library is now 39 GLBs with 78 catalog renders.
- Rechecked the signed-in Floorplanner Lab 809 editor read-only. Confirmed its hosted opening catalogs, 2D/3D preview toggle, immediate object-local action strip, matching inspector actions, exact size/rotation fields, raise-from-floor control, flip, duplicate and responsive category/search contracts without altering the user's project.
- Expanded Architecture to eleven professional hosted opening families: six doors (solid single, double, glazed single sliding, narrow-lite service, glazed cleanroom and double sliding) plus five windows/openings (fixed, wide three-pane, sliding, control-room observation and stainless pass-through).
- Replaced generic door/window 3D boxes with shared parametric frame, leaf, glazing, pane, track, hardware, sill and transfer-liner geometry. The same geometry now drives the material-aware Asset Library render and live 3D wall opening, while 2D distinguishes swing arcs, paired leaves, sliding tracks and pane/mullion divisions.
- Expanded the catalog to 94 assets: 39 authored and 55 procedural, with 188 same-geometry catalog renders. Eleven professional hosted architectural openings intentionally remain parametric so wall thickness, dimensions, sill, handing and flips remain editable.
- Verified all 94 definitions and 188 RGBA catalog renders, 39 GLB structures, 78 Vitest cases across 19 files, strict type checking, zero-warning linting, formatting, the production build and live port-3004 editor rendering. The signed-in Floorplanner comparison and local browser review were both completed without mutating the Floorplanner project.
- Kept the larger visual target active: high-use procedural equipment, richer photographic materials, room-wide indirect lighting, dense services and measured/scan-derived context still need to move closer to the supplied Digital Twin references.

## 0.1.9 — 2026-07-18

- Rebuilt the optional Room 809 demonstration around the five supplied 2026-07-15 Floorplanner references instead of the former rectangular seed. The authoritative eight-segment concave shell is now 8.71 × 8.69 m at its outer bounds, with a 68.611 m² floor, 34.8 m perimeter, and the projected main-entrance recess shown in the plan.
- Added wall-hosted openings for the 2.20 m main double entrance, 0.90 m west service entrance, and five 0.95 m north windows. The hosted relationships move and validate with their walls rather than behaving as independent decorations.
- Re-composed the demonstration with 63 scene objects: two long authored service-bridge islands, the six-position north rotary-evaporator row, perimeter casework, washing stations, fume hood, cold storage, reagent storage, racks, trolley, stools, equipment, safety, and retained entrance/circulation clearances.
- Retuned the optional Room 809 ceiling/services profile to the new footprint and aligned its light rows, rails, vents, duct, eight power drops, and incidental bench context with the two islands and perimeter runs. Duplicate generic service bridges were removed because the authored islands include their own construction.
- Made object bounds and snapping rotation-aware, so long benches rotated through 90 degrees use their real plan envelope. Added support-surface metadata so equipment placed on an authored 2.1 m service-bridge island validates against its 0.9 m worktop instead of the bridge canopy.
- Added regression coverage for the concave shell, hosted openings, rotated island bounds, support-surface placement, five-window north elevation, two service islands, and six rotary evaporators. The recomposed demonstration produces zero placement warnings.
- Verified strict type checking, zero-warning linting, formatting, 77 Vitest cases across 19 files, all 88 asset definitions, 31 authored GLBs, 176 same-geometry catalog renders, and a production build. Live browser visual inspection remains to be repeated when the local-preview browser policy permits access.
- Kept the larger visual target open: 57 catalog entries still need authored replacement, and the full room still needs denser PBR materials, realistic indirect lighting, and small-scale laboratory context to reach the supplied Digital Twin references.

## 0.1.8 — 2026-07-17

- Expanded the reusable catalog from 84 to 88 assets and the all-sided authored hero library from 26 to 31 GLBs; 57 catalog entries remain on recognizable procedural planning geometry.
- Replaced the previous generic/EYELA-influenced rotary evaporator with an original, logo-free Büchi R-300-class model based on the supplied references and official R-300 documentation. The new 607 × 429 × 947 mm planning envelope carries a compact open chassis, left process touchscreen, electric lift and angled drive, transparent vertical condenser with a saturated blue helical coil, receiving flask and stopcock, right-side charged evaporation flask, separate digital heating bath, rear service panels, hoses, supports, vents, cable routes, seams, and fasteners.
- Added distinct product-reference families for a steel sliding-door cabinet, upper-glazed/lower-steel sliding cabinet with visible bins, stainless wall drying rack with fifteen pegs and drain trough, PHCbi-class single-door biomedical freezer with rear condenser and casters, and compact ventilated solvent cabinet with spill-containment shelves.
- Added six all-sided authored storage assets from the preceding casework pass: two-door base cabinet, five-drawer base cabinet, true sink cabinet, framed-glass wall cabinet, split tall cabinet, and adjustable open shelving.
- Added normalized nested-storage bounds to the schema and seed so Digital Twin drawer and bin traces can align with authored casework geometry while scaling predictably with the placed asset.
- Generated and visually reviewed 62 exact authored GLB-derived isometric/top renders and retained 114 exact procedural renders, or 176 material-aware catalog images in total. The main library and Asset Studio expose all 88 assets at the same readable desktop density.
- Registered the five supplied 2026-07-15 Floorplanner captures as the required spatial references for the optional Room 809 demo. The top plan governs footprint and placement, the four orbit views govern orientation and clearances, and their simple objects are explicitly treated as placeholders for the authored LabSpace assets.
- Verified the rebuilt rotary in live Asset Studio isometric, front, back, left, right, and top presets. Asset validation passes for all 88 definitions, 31 GLBs, and 176 catalog renders; lint, formatting, 75 Vitest cases, and all 15 distinct Playwright workflows pass. The long serial browser invocation completed the first 13 before the command wrapper limit, and the three-workflow interaction file then passed separately, covering the remaining placement and wall cases.
- Kept the larger visual target open: 57 entries still need authored replacement, and arbitrary rooms still need denser authored context, photographic materials, and measured/scan-derived presentation where required.

## 0.1.7 — 2026-07-17

- Added a dedicated `/digital-twin` workspace modelled on the supplied spatial-index references while retaining LabSpace's own professional instrument visual language.
- Unified project-wide inventory, equipment, and storage locations into one searchable record surface with Browse, Inventory, Equipment, Locations, and Alerts filters.
- Added explicit All labs and This room scopes, searchable laboratory/room names and codes, and room-qualified record identities that remain unique when rooms are cloned or share local scene identifiers.
- Selecting a cross-laboratory result now switches the canonical live room before applying its object/location trace; editor links carry the room identity so the same record opens in the correct room.
- Connected each selected result to the exact project/laboratory/room/zone/storage breadcrumb, stable QR identity, material-aware spatial thumbnail, right-side record details, 3D object selection, and editor deep link.
- Added derived nested highlight envelopes so shelves, drawers, compartments, and bins trace a smaller region inside their parent asset instead of outlining the entire cabinet.
- Added camera navigation to exact object/location targets, automatic wall cutaway for visibility, performance/balanced/detail rendering modes, reset controls, and a real synchronized 2D fallback.
- Added a visible Digital Twin entry point to the editor top bar and preserved the selected object/location when returning to the Properties or Index inspector.
- Made project hydration single-flight to prevent React Strict Mode from racing duplicate loads and clearing deep-linked state.
- Made the development test reset deterministic by removing all test projects before reseeding the canonical demonstration project.
- Expanded automated coverage to 74 Vitest cases across 19 files and 15 Playwright workflows. The Digital Twin search/focus/fallback/deep-link workflow and the new cross-laboratory room-switch/editor-trace workflow pass, along with the existing focused editor regression set.
- Kept the final realism gap explicit: the Digital Twin room is still a real-time planning model, 64 assets remain procedural, and item-specific photography plus measured/scan-derived facility presentation remain open.

## 0.1.6 — 2026-07-17

- Expanded the reusable catalog from 80 to 84 assets and the all-sided authored hero library from 15 to 20 GLBs.
- Added five reference-driven casework and wash-station models: a sink bench, overhead service bench, open stainless wash basin, enclosed stainless basin, and island bench with a raised service bridge.
- Modelled real sink openings and basin cavities, rolled rims, drains, water, faucets, pre-rinse plumbing, casework seams, drawers, doors, pulls, rear service panels, feet, glazed overheads, shelves, outlets, guards, and raceways instead of using modular box silhouettes.
- Upgraded the rotary evaporator with a large angled touchscreen controller and denser glassware, bath, control, hose, fluid, side, and rear construction informed by the newly supplied references.
- Generated 10 new GLB-derived catalog renders for the five new assets and refreshed the rotary renders. The active catalog now contains 40 authored renders plus 128 exact procedural-geometry captures, or 168 PNGs total.
- Revalidated all 84 definitions, 20 authored GLBs, and 168 same-geometry renders; strict typecheck, lint, 67 Vitest cases, formatting, and production build pass. A post-batch focused Playwright rerun passes 4 of 4 startup, 3D, framing, and object-drag workflows.
- Kept the larger goal open: 64 entries still use procedural planning geometry, and a dedicated reference-style photoreal inventory-browse/digital-twin presentation remains future work.

## 0.1.5 — 2026-07-17

- Generalized LabSpace from a Room 809-centered prototype into a professional multi-laboratory project workspace. Room 809 remains an optional demonstration, reference scene, and future template source rather than a runtime feature boundary.
- Added a project navigator that lists every laboratory and room, switches the active room, creates a blank room under a selected laboratory, creates a new laboratory with its first blank room, and creates a generic blank project.
- Added generic `createBlankProject`, `createBlankLaboratory`, and `createBlankRoom` factories. New rooms receive professional scene-local defaults but no walls, assets, indexed content, or environment profile.
- Added semantic layer roles for walls, openings, furniture, storage, equipment, utilities, safety, labels, and measurements. Placement now resolves the active scene's role instead of depending on Room 809 seed IDs; imported/custom layers remain intact and missing defaults receive fresh IDs.
- Made laboratory identity explicit in object-index generation and controlled reindexing. Added full-width/case/punctuation normalization, normalized uniqueness checks, deterministic collision avoidance, and non-demo chemistry/genomics indexing coverage.
- Replaced random Room 809-derived equipment identifiers with default equipment IDs derived from the placed object's actual normalized index code.
- Generalized ceiling, lighting, duct, utility, and service dressing into optional per-room environment profiles selected through `Room.environmentProfileId`. Blank rooms default to no profile; the Room 809 reference-services profile is currently the only bundled registration.
- Added a reusable floor-material registry with light-gray epoxy, sealed concrete, and welded vinyl sheet. One finish definition now drives both the 2D plan pattern and the 3D PBR floor; epoxy uses photographic maps while concrete and vinyl currently use procedural treatments.
- Expanded automated validation to 67 Vitest cases across 17 files while retaining 13 of 13 Playwright workflows, 80 catalog definitions, 15 authored GLBs, and 160 same-geometry renders.
- Documented remaining product-management limits: laboratory/room rename, delete, and reorder are not yet implemented; advanced floor topology and 65 procedural-to-authored asset migrations remain open.

## 0.1.4 — 2026-07-17

- Changed new-room creation to return a genuinely blank planning canvas. It no longer seeds a perimeter, doors, windows, furniture, equipment, storage, zones, inventory, or equipment records; Room 809 remains the separate demonstration room.
- Added labeled, keyboard-accessible collapse and restore rails for the Asset Library and Inspector so either side panel can return its width to the canvas without losing panel state.
- Added direct Select-mode wall editing. A selected wall exposes draggable endpoint handles, and dragging the wall body translates the complete segment while preserving coincident endpoints on connected walls.
- Kept hosted openings attached during whole-wall translation and rejected endpoint edits that would shorten a wall below the space required by its hosted opening.
- Added simple closed-wall floor topology for rectangles, concave L-shapes, collinear split edges, and skewed loops. One polygon now drives the clipped 2D floor, Three.js `ShapeGeometry` floor, area/perimeter metrics, placement validation, and normalized one-step wall-resize undo/redo.
- Added deliberate rectangular fallbacks for unsupported or ambiguous topology: open chains, branches/partitions, multiple loops, holes, curves, and self-crossing perimeters.
- Reworked placed-object dragging around scene-coordinate pointer offsets so objects stay at their drop position instead of jumping to the plan origin or upper corner.
- Added Select-mode viewport navigation with middle-mouse drag, Arrow keys, and WASD. Shift uses a larger keyboard step, and editable fields retain normal text-input behavior.
- Added four Room 809 authored equipment models: an ULVAC-class yellow oil-rotary vacuum pump, Yamato-class forced-air oven, six-position turquoise heating bath, and stacked vacuum cold-trap/chiller station. Each is all-sided, floor-grounded, PBR grouped, logo-free, and shipped with exact GLB-derived isometric/top renders.
- Added 130 deterministic transparent PNGs captured from the actual 65 non-authored `ProceduralAssetModel` geometries. Asset Library cards now use their isometric captures and the 2D plan uses their top captures; the 15 authored assets retain their 30 exact Blender/GLB renders.
- Added a reproducible four-worker capture pipeline on dedicated port 4178 plus validation that all 160 catalog PNGs have the required dimensions and RGBA channel.
- Added a Room 809-only 3D context layer with ceiling light fixtures, vents, ductwork, coiled power drops, service rails/posts, and bottles, plus a default-visible 3D-toolbar toggle whose preference persists independently of walls, floors, and equipment.
- Expanded the automated surface to 53 Vitest cases across 14 files and 13 Playwright workflows across two spec files, including blank-room creation, closed-floor topology and metrics, wall-body and endpoint editing, hosted-opening movement, Room 809 context persistence, same-geometry render routing, Select-mode panning, and object-drag regression coverage.
- Recorded a read-only authenticated Floorplanner interaction audit covering collapsible workspaces, direct object transforms, wall editing, dimensions/elevation, hosted openings, and 2D/3D navigation.
- The `references/ref1.png` and `references/ref2.png` photoreal target remains open: 65 catalog entries now have exact same-procedural-geometry plan/library renders but still require manufacturer-informed, all-sided authored GLBs.

## 0.1.3 — 2026-07-17

- Expanded the original asset catalog from 70 to 80 dimension-driven planning assets.
- Added 11 Room 809 hero assets as authored, all-sided GLBs, with procedural representations retained as safe fallbacks.
- Added 22 Blender-generated transparent catalog renders: one material-aware isometric library image and one top-view plan image for each authored hero asset.
- Added a visible Asset Studio entry point with orbit controls and front, back, left, right, top, and isometric camera presets.
- Added continuous wall-chain drawing: every committed endpoint begins the next segment; Enter or double-click ends the chain, and Escape returns to Select.
- Added a draggable and keyboard-accessible split-view divider with persistent ratios, usable minimum pane widths, and double-click reset.
- Fixed child-object drag events bubbling into the Konva stage and snapping moved items toward the upper corner.
- Retained the 12px visible typography minimum, 13px labels, and 14px controls/body text across the denser asset and editor surfaces.
- Added `npm run assets:build` to reproduce the 11 authored GLBs and 22 static renders with Blender 4.5 LTS, plus validation for GLB structure, offline loading, file budgets, PNG dimensions, and alpha channels.
- Expanded automated coverage to 23 Vitest cases and 10 serial Playwright workflows, including authored thumbnails, nonblank 3D rendering, Asset Studio access, split resizing, drag-position regression, presentation modes, stale-autosave protection, typography, and screenshots.
- The full 80-asset photoreal target remains in progress; 69 catalog assets still use their procedural planning representations.

## 0.1.2 — 2026-07-16

- Prevented delayed autosave responses from overwriting newer 2D edits by comparing live and saved revisions and queuing a follow-up save when required.
- Fixed the empty 3D page caused by a hidden Konva stage receiving zero dimensions during presentation-mode changes.
- Conditionally mount only the renderers needed by 2D, Split, and 3D modes, clamp canvas measurements, and contain renderer errors inside the affected pane.
- Upgraded procedural equipment to reference-style product/CAD realism with shared rounded geometry and restrained physical glass, steel, worktop, rubber, and powder-coat materials.
- Added studio reflections, balanced key/fill lighting, improved contact grounding, and richer fume-hood doors, handles, baffles, vents, sash, control, worktop, and toe-kick details.
- Added end-to-end regressions for all presentation modes and for edits made while an earlier autosave request is still in flight; the full browser suite now passes 8/8 workflows.

## 0.1.1 — 2026-07-16

- Increased desktop typography to a 12px visible minimum, 13px labels, and 14px controls/body text.
- Changed the asset catalog to two readable columns at desktop widths.
- Added equipment-specific procedural 3D models and material details across all asset families.
- Added dynamic asset-preview camera framing for both large equipment and small instruments.
- Added accessible names to icon-only 3D controls and larger favorite hit targets.
- Expanded end-to-end coverage for typography, overflow, screenshots, and asset framing.

## 0.1.0 — 2026-07-16

- Created the complete LabSpace Indexer local prototype.
- Added the reference-matched desktop editor shell at 1440×900 and 1920×1080.
- Added canonical millimetre scene schema, migrations, SQLite repository, seed Room 809, and autosave.
- Added synchronized interactive React Konva 2D and React Three Fiber 3D rendering.
- Added wall/opening tools, snapping, history, layers, properties, cameras, and validation.
- Added 70 original starter assets and the searchable 2D/3D asset preview page.
- Added physical storage indexing, reindex preview, inventory, and equipment records.
- Added project/room lifecycle, named versions, restore, import/export, labels, reports, and QR codes.
- Added unit, repository, end-to-end, screenshot, asset-validation, lint, typecheck, and build workflows.
