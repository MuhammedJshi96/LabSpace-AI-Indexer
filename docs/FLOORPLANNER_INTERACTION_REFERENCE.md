# Floorplanner interaction reference

Date reviewed: 2026-07-17

## Why it is referenced

Floorplanner is used here as an interaction reference, not as a visual design to
copy. LabSpace keeps its existing CAD/clinical interface, canonical millimetre
scene, indexing model, and local-first persistence.

## Verified interaction patterns

- [Placed objects can be flipped vertically or horizontally](https://floorplanner.frontkb.com/en/articles/2398274)
  from controls that appear when the item is selected.
- [Doors are dragged onto the desired wall and auto-snap into it](https://floorplanner.frontkb.com/en/articles/2408642),
  so the user chooses only the position along the wall.
- [Windows use the same drag-to-wall and auto-snap behavior](https://floorplanner.frontkb.com/en/articles/2409474).
- [Door width, height, and raise-from-floor are typed measurements](https://floorplanner.frontkb.com/en/articles/2409154)
  in the selected door's settings.
- [Door vertical/horizontal flips change opening direction](https://floorplanner.frontkb.com/en/articles/2409026).
- Window settings also support width, height, raise-from-floor, flips, and
  stacking one opening above another in the official Windows help category.

## LabSpace adaptation

- `position.z` remains the single canonical raised-from-floor measurement for
  ordinary room objects.
- Horizontal and vertical flips are persistent scene transforms and participate
  in undo/redo, autosave, import/export, 2D, and 3D.
- A door or window stores a host-wall ID and a wall-relative offset. Its visible
  position and rotation are derived from that relationship, which prevents the
  wall cut and the opening model from drifting apart.
- Initial placement projects onto the nearest usable wall centreline. Dragging an
  existing opening moves it along its host or re-hosts it to the nearest wall.
- Offsets are clamped by half the opening width, so the full door/window stays
  inside the wall segment.
- Opening sill/raise-from-floor is kept synchronized with the object's vertical
  placement, while width and height continue to drive both the 2D symbol and 3D
  wall cut.
