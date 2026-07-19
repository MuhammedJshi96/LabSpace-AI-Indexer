# Floorplanner authenticated interaction audit

Date: 2026-07-17 JST
Scope: the signed-in Floorplanner project editor opened by the user, compared with the local LabSpace editor at `http://127.0.0.1:3004/`.
Method: read-only selection, panel toggles, and 2D/3D view changes. No object dimensions, positions, project structure, exports, or saved content were changed.

## 2026-07-18 focused recheck

The signed-in Lab 809 editor was rechecked read-only before the next polish
batch. The current Build surface exposes separate Draw room, Draw wall, Draw
surface, Place doors, Place windows and structural workflows without obscuring
the plan. Door browsing provides search, Single/Double/Large/Closet categories,
material-aware cutouts and a 2D/3D thumbnail toggle. Window browsing exposes 219
visual results across rectangular, round, half-round, arched, triangular and
various categories, including fixed panes, segmented panes, sliding/louvre
forms, glass walls and unframed openings.

Selecting the existing Room 809 trolley confirmed the most valuable smoothness
contract: selection immediately replaces the browse panel with a visual object
card and opens a floating object-local action strip. Duplicate, scale,
counter-clockwise/clockwise rotation, horizontal/vertical flip, push-down and
delete stay adjacent to the object while the side settings expose custom name,
2D label visibility, exact length, width, height, raise from floor and rotation.
No value was changed during this audit.

LabSpace now applies those contracts to its own professional architecture
language rather than copying Floorplanner's catalog. The Architecture family
contains six hosted doors (solid single, double, glazed single sliding,
narrow-lite service, glazed cleanroom and double sliding) plus five hosted
windows/openings (fixed, wide three-pane, sliding, control-room observation and
stainless pass-through). Their frames, leaves, glazing, tracks, hardware, sill
and plan symbols are shared between material-aware library captures, 2D and 3D.

## User goal

Identify proven interaction contracts that LabSpace should adopt for blank-room creation, direct manipulation, wall editing, collapsible workspaces, material-aware asset browsing, hosted openings, elevation, flip, viewport navigation, and project organization.

Floorplanner is used here as a behavior reference. LabSpace retains its own branding, visual language, indexing workflow, millimetre scene model, and implementation.

## Numbered flow and health

1. **Build workspace — healthy.** The editor separates room, wall, surface, door, window, and structural placement into a focused Build panel. Clicking the active navigation button hides the panel and immediately returns the recovered space to the canvas.

   ![Floorplanner Build workspace](screenshots/floorplanner-audit/01-floorplanner-start.png)

2. **Collapsed workspace — healthy.** Collapsing the active panel preserves a compact navigation rail. The rail remains discoverable while the canvas receives the panel width. This is the interaction model adopted for LabSpace's Asset Library and Inspector.

   ![Floorplanner Build panel collapsed](screenshots/floorplanner-audit/02-floorplanner-panel-collapsed.png)

3. **Object library — healthy.** Asset cards use recognizable material-aware cutout renders rather than symbolic geometry. Search, categories, group/brand filters, favorites, and 2D/3D display controls stay within the same collapsible surface.

   ![Floorplanner object library](screenshots/floorplanner-audit/03-floorplanner-object-library.png)

4. **Direct object selection — healthy.** Selecting an object reveals a compact floating transform bar next to the object and a visual detail panel. Duplicate, scale, clockwise/counter-clockwise rotate, horizontal flip, vertical flip, push down, and delete are one action away.

   ![Floorplanner selected object](screenshots/floorplanner-audit/04-floorplanner-selected-object.png)

5. **Object dimensions and elevation — healthy.** The settings surface exposes length, width, height, raise from floor, and rotation together. Values remain visible without opening a separate modal.

   ![Floorplanner object settings](screenshots/floorplanner-audit/05-floorplanner-object-settings.png)

6. **Wall editing — healthy.** A selected wall shows the complete segment, two endpoint handles, measured length, and contextual actions such as split, continue wall, curve, and delete. Wall settings include thickness, wall height, raise from floor, and axis offset.

   ![Floorplanner selected wall](screenshots/floorplanner-audit/06-floorplanner-wall-selected.png)

7. **2D/3D switching — healthy with fidelity limits in this project.** The same room can be viewed in 2D or 3D, with camera type, camera height, field of view, perspective, scene, and light controls. The inspected user project contains a mixture of detailed and visually simple objects, so Floorplanner is an interaction benchmark rather than the LabSpace asset-quality benchmark.

   ![Floorplanner 3D camera workspace](screenshots/floorplanner-audit/07-floorplanner-3d.png)

8. **Project organization — healthy.** The Project surface exposes floor creation, design history, design transformation, item lists, light controls, and duplicate/delete actions. These contracts support future LabSpace project-history and multi-floor work but were not copied wholesale during this pass.

9. **Information and annotations — healthy.** Room type, labels, signs/symbols, lines, and dimensions are grouped under a dedicated information surface. LabSpace already separates room data, indexing, validation, and measurement; annotation depth remains a future comparison area.

10. **Finishes and styleboards — healthy.** Materials, finishes, colors, and styleboards are browsed as visual choices rather than raw technical fields. This reinforces the requirement that LabSpace material selection and asset browsing stay recognizable and preview-led.

11. **Exports — available but intentionally not exercised.** The project exposes export options from a dedicated surface. No export was generated because the audit was read-only and the user's project data was not to be changed.

## LabSpace implementation status after the audit

| Floorplanner interaction contract                          | LabSpace status                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Blank new room                                             | Implemented. New rooms contain no seeded perimeter or content; Room 809 remains the demonstration room.       |
| Collapsible side workspace                                 | Implemented for both Asset Library and Inspector with labeled, keyboard-accessible restore rails.             |
| Direct object movement                                     | Implemented and corrected to preserve room-coordinate drop positions rather than snapping to the origin.      |
| Whole-wall selection and dragging                          | Implemented in Select mode.                                                                                   |
| Wall endpoint handles                                      | Implemented; coincident endpoints on connected walls remain joined.                                           |
| Hosted opening behavior during wall movement               | Implemented for translated host walls, with minimum-length protection.                                        |
| Select-mode viewport navigation                            | Implemented with middle-mouse drag, Space+drag, Arrow keys, and WASD.                                         |
| Elevation and horizontal/vertical flips                    | Implemented in the canonical scene transform workflow.                                                        |
| Material-aware asset cards                                 | Implemented with exact authored renders for 45 assets and same-procedural-geometry isometric captures for 51. |
| Material-aware 2D plan assets                              | Implemented for all 96 entries with authored or same-procedural-geometry top captures.                        |
| Professional hosted opening family                         | Implemented for six door and five window/opening types with shared 2D/3D/catalog geometry.                    |
| Full photoreal all-sided equipment catalog                 | In progress; high-use procedural equipment still requires manufacturer-informed authored GLBs.                |
| Full Floorplanner project/annotation/style workflow parity | Not a current target; adopt only contracts that support LabSpace's laboratory-planning and indexing goals.    |

### Blank-room evidence

The new-room implementation shows a clean floor/grid with no prebuilt square room or placed content.

![LabSpace blank new room](screenshots/floorplanner-audit/13-labspace-blank-room.png)

### Collapsible-panel evidence

The collapsed Asset Library and Inspector remain discoverable as narrow labeled rails while returning working width to the canvas.

![LabSpace collapsed Asset Library](screenshots/floorplanner-audit/11-labspace-collapsed-library.png)

![LabSpace collapsed Inspector](screenshots/floorplanner-audit/12-labspace-inspector-collapsed.png)

## Highest-impact contracts retained for further work

1. Keep direct manipulation near the selected object while detailed numeric fields remain in the Inspector.
2. Keep doors and windows wall-hosted during movement, resizing, flip/handing, re-hosting, deletion, and wall edits.
3. Preserve the same-geometry render contract while replacing high-use procedural equipment with authored GLBs and retaining hosted architectural openings as dimension-driven assemblies.
4. Keep dimensions, rotation, elevation, and flips canonical across 2D, 3D, undo/redo, persistence, import/export, and validation.
5. Consider Floorplanner's contextual split/continue/curve actions and project-level information surfaces only where they improve LabSpace's focused laboratory workflow.

## Remaining visual gap

Floorplanner demonstrates the usefulness of visual, material-aware asset browsing, but `references/ref1.png` and `references/ref2.png` remain the LabSpace fidelity source of truth. The 51 procedural entries guarantee that 2D and library images come from the same live 3D geometry, removing unrelated generic-card treatment; eleven are intentionally parametric hosted openings. Remaining procedural equipment still does not provide photoreal, manufacturer-informed, all-sided construction. Closing that gap requires authored GLBs, richer PBR materials, construction detail, and denser laboratory context.

## Accessibility risks and evidence limits

- Floorplanner's major controls had accessible names in the inspected DOM, including transform, wall, lock, measure, and view controls.
- Several controls are icon-only and visually small; screenshots alone cannot prove target size, keyboard order, focus visibility, or assistive-technology quality.
- Canvas object and wall manipulation cannot be fully assessed for keyboard equivalence from screenshots.
- Destructive editing, autosave recovery, premium functionality, multi-user behavior, and generated exports were intentionally not exercised.
- The audit covers the relevant signed-in editor surfaces that were safely inspectable; it is not a claim of exhaustive parity with every Floorplanner feature.

## Official behavior references

- Floorplanner: https://floorplanner.com/
- Place doors on walls: https://floorplanner.frontkb.com/en/articles/2408642
- Place windows on walls: https://floorplanner.frontkb.com/en/articles/2409474
- Raise a door from the floor: https://floorplanner.frontkb.com/en/articles/2409154
- Flip a door: https://floorplanner.frontkb.com/en/articles/2409026
- Flip an item: https://floorplanner.frontkb.com/en/articles/2398274
