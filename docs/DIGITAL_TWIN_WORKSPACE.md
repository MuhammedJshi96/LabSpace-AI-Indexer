# Digital Twin workspace

## Purpose

`/digital-twin` is the searchable spatial-index view for laboratory managers, technicians, facilities teams, and inventory owners. Its job is to find a record and reveal its physical context without changing the canonical editor data model.

The workspace is general to every LabSpace project. Room 809 supplies the current demonstration data and visual reference, but the route builds one index from every laboratory, room, zone, scene object, storage hierarchy, inventory item, and equipment record in the active project at runtime.

The Room 809 demonstration scene now follows the five supplied Floorplanner layout views: an eight-wall concave footprint with a recessed main entrance, hosted west and main doors, five north windows, two long service-bridge islands, six rotary evaporators along the north bench, perimeter casework and washing, cold storage, racks, equipment, and circulation. This improves the demonstration's spatial credibility without making the Digital Twin route depend on Room 809.

## Record and trace contract

The unified record set contains:

- inventory items, including quantity, unit, owner, expiry, notes, and assigned storage location;
- equipment records, including equipment ID, manufacturer, model, serial, service status, responsible person, and related scene object;
- cabinet, compartment, shelf, drawer, and bin locations, including stable index code, exact contents, capacity notes, and parent hierarchy.

Search matches names, notes, owners, units, identifiers, models, serials, laboratory names/codes, room names/codes, zones, and every location-path segment. Record identities include the owning room so cloned or repeated scene identifiers remain unambiguous across a project. A selected record synchronizes five visible surfaces:

1. selected result card;
2. 3D object or nested storage-region outline;
3. scene breadcrumb;
4. exact-location trace in the detail panel;
5. stable QR identity and editor deep link.

Navigate to location enables wall cutaway when required and focuses the camera on the selected scene object. If the record points to a shelf, drawer, compartment, or bin, LabSpace derives a nested planning envelope from the storage hierarchy and uses its center as the camera target. These envelopes communicate indexed spatial intent; they are not manufacturer-certified internal dimensions.

Selecting a result in another room switches the live canonical room before applying its object and nested-location selection. The editor deep link carries room, object, location, and target panel together, so the same spatial trace survives the transition.

## View controls

- Performance, Balanced, and Detail change the live canvas pixel-density budget.
- All labs searches the entire project. This room limits counts, filters, and results to the room currently shown in the spatial scene.
- 2D fallback mounts the canonical synchronized plan renderer and unmounts the 3D canvas.
- Reset camera returns to the room isometric view and clears object-level focus.
- Wall cutaway maps to the same canonical wall-transparency preference used by the editor.
- Open record in editor carries the object, nested location, and target inspector panel through the page transition.

Renderer failures remain isolated inside the spatial pane. Search, exact record details, and navigation remain available if either visual renderer pauses.

## Current fidelity boundary

The workspace implements the supplied references' interaction contract and now uses the Floorplanner-reconciled Room 809 composition, but it does not yet reach their final photographic fidelity. The current 3D room is a real-time planning scene with 45 authored GLBs and 51 procedural models, including professional parametric hosted openings. Item cards use the containing spatial asset when an item-specific licensed photograph is unavailable. Exact normalized bounds now align selected demonstration drawers and bins with authored casework, but broader internal-storage authoring, scan-derived rooms, saved viewpoints, and item-image management remain future production phases.
