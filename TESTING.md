# Testing

## Automated suites

```powershell
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run validate:assets
npm run build
```

The current Vitest suite contains 115 cases across 23 files. It covers generic project/laboratory/room factories, multi-laboratory workspace switching, project-wide Spatial Index record identity and scoping, deterministic multi-term filtering, semantic scene-local layer roles, laboratory-aware indexes and equipment IDs, optional room environment profiles, synchronized floor-material definitions, storage hierarchy, heuristic and exact normalized cabinet/drawer/bin highlight envelopes, deterministic repository reseeding, reindex previews, scene validation, serialization, migrations, the 96-entry asset manifest, millimetre conversion, polygon and rectangular area/perimeter, the Floorplanner-derived eight-wall Room 809 polygon, hosted demo openings, professional opening-family defaults, rotated asset bounds, support-surface placement, wall geometry, snapping, collisions, floor-aware placement, movement, transforms, wall-hosted openings, command history, continuous wall-chain advancement, the SQLite repository, blank-room construction, demonstration-room preservation, direct wall editing, connected endpoints, hosted-opening movement, minimum opening constraints, closed-floor synchronization, asset-render routing, and the room-relative initial isometric camera framing.

The Playwright suite defines 21 browser workflows across four spec files. It covers startup and synchronized demo views; persistent Asset Library favorites; the professional project navigator and non-demo laboratory/room creation; project-wide Spatial Index search, exact evidence selection, cross-laboratory focus and editor traces; direct Layout Editor placement warnings; optional environment-profile selection and the persisted context toggle; nonblank WebGL output; authored and procedural same-geometry thumbnails; safe Asset Studio access; split resizing; asset placement and synchronization; object-drag corner-snap regression; wall-body dragging with joined corners; Select-mode keyboard and middle-mouse panning; lab-aware indexing/inventory; undo/redo; versions and persistence; exports; presentation-mode renderer mounting; stale-autosave protection; readable typography; responsive overflow; principal screenshots; and large/small Asset Studio framing.

The 2026-07-19 submission verification covers all 21 browser workflows. The suite includes the Spatial Index equipment-to-drawer judge path, direct placement-validation handoff, persistent favorites, preserved user-demo loading, blank-room floor generation, object-drag corner-snap protection, viewport panning, connected-wall editing, split-pane sizing, and save/reload behavior. The authored WebGL room is intentionally exercised through the real local server and SQLite repository rather than mocked scene data.

`npm run validate:assets` checks all 96 catalog definitions and all 192 transparent RGBA PNG renders at the expected isometric and top-view dimensions. For the 45 authored hero assets it also validates binary glTF structure, mesh presence, offline-compatible no-Draco loading, and the 12 MB model budget.

The 51 non-authored entries use 102 deterministic captures of their actual `ProceduralAssetModel` geometry: one isometric Asset Library render and one top-view 2D plan render each. Unit and asset-validation coverage require both files for every entry. Eleven professional hosted doors/windows intentionally stay parametric; high-use procedural equipment still requires manufacturer-informed GLB migration.

The browser executable is installed project-locally by `package.json` configuration. The E2E suite resets only the development project through a localhost-only testing route.

## New regression coverage

### Room 809 reference layout

- The optional demonstration has eight walls, a concave 8.71 × 8.69 m outer envelope, 68.611 m² area, and 34.8 m perimeter.
- The main double entrance, west service entrance, and five north windows remain hosted on their intended walls.
- The scene contains two long rotated service-bridge islands and six rotary evaporators in the north equipment row.
- Rotation-aware bounds use the real plan envelope of the islands, and equipment placed at their 900 mm work surface does not collide with the taller bridge construction.
- The complete 63-object demonstration returns no placement warnings.

### Blank-room behavior

- A blank project contains a generic laboratory and empty room without demonstration data.
- A new laboratory receives its own code and first blank room; another room can be created under the selected laboratory and activated from the project navigator.
- A new room has no scene objects, zones, storage locations, inventory items, or equipment records.
- Semantic scene-local layer and label-template defaults remain available so the blank canvas is immediately usable.
- Creating a blank room does not mutate the DEMO-01 showcase scene.

### Layers, indexing, and materials

- Default and imported layers resolve asset types through semantic roles rather than Room 809 layer IDs.
- Object indexing and controlled reindexing use explicit laboratory, room, and optional zone codes.
- Normalization and uniqueness are verified with `CHEMISTRY-WEST / B-214` and `GENOMICS-CORE / C-317`, including full-width input and reserved-code collisions.
- A new equipment record derives its equipment ID from the object's actual spatial index.
- Light-gray epoxy, sealed concrete, and welded vinyl resolve through one registry with synchronized 2D and 3D material properties.

### Wall editing

- Moving one endpoint also moves coincident endpoints on connected walls.
- Dragging a complete wall side preserves its connected room corners.
- A hosted opening follows its wall during translation.
- An edit that would make the host wall shorter than the opening is rejected.
- A valid simple closed wall loop normalizes its edited bounds and floor dimensions as one undoable/redoable gesture.

### Closed floor topology

- Rectangular, concave L-shaped, collinear split-edge, and skewed straight-wall loops produce a single authoritative polygon.
- The polygon drives the clipped 2D floor, Three.js `ShapeGeometry` floor, area/perimeter metrics, and floor-aware placement warnings.
- Open chains, branches/partitions, multiple loops, holes, curves, and self-crossing walls deliberately retain the rectangular fallback.

### Optional environment profiles

- A room with no profile receives no environmental dressing.
- The currently registered DEMO-01 showcase profile stays inside its spatial envelope and includes lights, vents, ductwork, power drops, service rails/posts, and bottles.
- Profile assignment is driven by `environmentProfileId`, not room ID or name.
- The 3D toolbar toggle defaults visible, persists across reloads, and does not change walls, floors, or equipment.

### Object and viewport interaction

- A placed object changes coordinates after a drag and remains well away from the plan origin.
- Middle-mouse dragging pans the viewport while Select remains active.
- Arrow keys and WASD pan the viewport, with a larger Shift-modified step.
- Typing inside search and form fields does not trigger viewport shortcuts.

### Asset Library presentation

- Every non-authored built-in asset resolves to a static render of its reusable laboratory procedural geometry rather than an unrelated generic thumbnail.
- A representative high-use set spans furniture, centrifuges, pumps, bench instruments, and other equipment families.
- Every authored GLB continues to resolve to its material-aware isometric render on disk.
- Every procedural entry resolves to both its 384×256 isometric and 384×384 top PNG on disk.

## Asset regeneration

The authored hero source can be rebuilt separately from routine application validation:

```powershell
npm run assets:build
npm run assets:render-procedural
npm run validate:assets
```

The authored build uses Blender 4.5 LTS to regenerate 45 all-sided GLBs and 90 static catalog renders. It uses the project-local portable Blender executable by default; set `BLENDER_PATH` when validating with another compatible installation. The procedural command uses four isolated headless-browser workers on dedicated port 4178 to regenerate the other 102 renders without Blender.

## Visual QA

Current Layout Editor, WebMCP, Inventory, Spatial Index, and Asset Studio captures are stored in `docs/screenshots/submission-*.png`. The deterministic submission screenshot test regenerates them from the privacy-checked public fixture in High rendering quality. These images document the tested release; they do not claim manufacturer-certified geometry or arbitrary-room photorealism.

## Manual workflow

1. Open the project navigator, create a laboratory with a non-demo code, and confirm its first room is blank and active.
2. Add another room under that laboratory, switch between both rooms, and confirm their scenes remain independent.
3. Open a populated test room and confirm its authored shell, islands, perimeter functions, storage workflow, and circulation remain intact.
4. Collapse and restore the Asset Library and Inspector separately; confirm each rail is labeled, keyboard reachable, and returns width to the canvas.
5. Change a blank room among epoxy, sealed concrete, and vinyl; confirm both 2D and 3D update to the selected finish.
6. Add a furniture asset from the catalog.
7. Move it in Select mode and confirm it stays at the drop location instead of snapping to the upper corner.
8. Resize, rotate, raise, flip, undo, and redo it; confirm 2D and 3D stay synchronized.
9. Select a wall, drag one endpoint, and confirm the connected corner remains joined.
10. Drag a complete wall segment and confirm both joined corners and any hosted opening move predictably.
11. Confirm a wall cannot be shortened through a hosted opening.
12. Draw a simple closed L-shaped or skewed loop and confirm the 2D and 3D floors follow it, the area/perimeter update, and outside-floor placement warns correctly.
13. Undo and redo a closed-loop wall resize; confirm the polygon, bounding dimensions, and normalized contents change in one step.
14. Leave a wall chain open or add a branch and confirm the editor safely retains the rectangular floor fallback.
15. In Select mode, pan with middle-mouse drag, Space+drag, Arrow keys, WASD, and Shift-modified keyboard steps.
16. Focus Asset Search, type `wasd`, and confirm the viewport does not move.
17. Assign the DEMO-01 showcase environment profile to a blank test room, toggle it independently, then remove the profile and confirm indexed scene content is unchanged.
18. Browse authored and non-authored catalog entries; confirm no built-in card appears as an unrecognizable generic box.
19. Add a cabinet, then add a shelf, drawer, and bin.
20. Select the drawer in Index Navigator and assign inventory.
21. Add equipment in a non-demo laboratory and confirm its object code and equipment ID use that laboratory and room code.
22. Save a named version and restore it.
23. Reload and confirm persistence.
24. Export JSON and location/equipment CSV files.
25. Draw three connected wall segments, finish with Enter or double-click, then repeat and cancel with Escape.
26. Drag and keyboard-adjust the split divider, reload, and confirm its ratio persists without collapsing either pane.
27. Compare authored and procedural assets across their top-view 2D image, isometric library image, and orbitable Asset Studio model.
28. Switch repeatedly among 2D, Split, and 3D and confirm the application shell and live edits remain visible.
