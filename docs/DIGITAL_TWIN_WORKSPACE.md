# Spatial Index Finder workspace

## Purpose

`/digital-twin` is the stable compatibility route for the user-facing **Spatial Index Finder** used by laboratory managers, technicians, facilities teams, and inventory owners. Its job is to find a canonical record and reveal its physical context without changing the editor data model.

The workspace is general to every LabSpace project. DEMO-01 supplies the current competition showcase data; selected laboratory character and spatial cues were informed by the author's Room 809 laboratory. The route builds one index from every laboratory, room, zone, scene object, storage hierarchy, inventory item, and equipment record in the active project at runtime.

DEMO-01 remains an optional showcase, separate from blank rooms. Spatial Index builds from the active project at runtime and never depends on Room 809-specific identifiers.

## Record and trace contract

The unified record set contains:

- inventory items, including quantity, unit, owner, expiry, notes, and assigned storage location;
- equipment records, including equipment ID, manufacturer, model, serial, service status, responsible person, and related scene object;
- cabinet, compartment, shelf, drawer, and bin locations, including stable index code, exact contents, capacity notes, and parent hierarchy.

Search splits the entered text into deterministic terms and matches names, notes, owners, units, identifiers, models, serials, laboratory names/codes, room names/codes, zones, and every location-path segment. Record identities include the owning room so cloned or repeated scene identifiers remain unambiguous across a project. A selected record synchronizes four visible surfaces:

1. selected result card;
2. 3D object or nested storage-region outline;
3. exact-location trace in the detail panel;
4. stable QR identity and editor deep link.

Navigate to location focuses the camera on the selected scene object while preserving enough neighboring casework for context. Wall cutaway remains an explicit user control. If the record points to a shelf, drawer, compartment, or bin, LabSpace derives a nested planning envelope from the storage hierarchy and uses its center as the camera target. The optional access preview remains closed until the user selects **Show access preview**. These envelopes communicate indexed spatial intent; they are not manufacturer-certified internal dimensions.

Selecting a result in another room switches the live canonical room before applying its object and nested-location selection. The editor deep link carries room, object, location, and target panel together, so the same spatial trace survives the transition.

## View controls

- Performance, Balanced, and Detail change the live canvas pixel-density budget.
- All labs searches the entire project. This room limits counts, filters, and results to the room currently shown in the spatial scene.
- 2D fallback mounts the canonical synchronized plan renderer and unmounts the 3D canvas.
- Reset camera returns to the room isometric view and clears object-level focus.
- The Layout Editor's first 3D entry uses a relaxed room-relative isometric overview when the room has no saved pose. A saved room pose, orientation-cube command, or exact-record focus remains authoritative.
- Wall cutaway maps to the same canonical wall-transparency preference used by the editor.
- Open record in editor carries the object, nested location, and target inspector panel through the page transition.
- Placement validity remains visible in the Layout Editor's selection status and Warnings tab; Spatial Index does not generate conversational safety answers.

Renderer failures remain isolated inside the spatial pane. Search, exact record details, and navigation remain available if either visual renderer pauses.

## Current fidelity boundary

The workspace implements the supplied references' interaction contract, but it remains a real-time planning visualization rather than a scan-derived or certified facility twin. Item cards use the containing spatial asset when an item-specific licensed photograph is unavailable. Exact normalized bounds align selected demonstration drawers and bins with authored casework, while broader internal-storage authoring, scan-derived rooms, saved viewpoints, and item-image management remain future production phases.

## Future AI API boundary

No conversational assistant or live model provider ships in the current application. GPT-5.6/Codex is documented as the Build Week engineering and design collaborator. A future optional LabSpace Atlas API may translate natural-language requests into calls to the canonical index and validator, but it must preserve the same evidence boundary and must never replace stored records or deterministic geometry with generated facts.
