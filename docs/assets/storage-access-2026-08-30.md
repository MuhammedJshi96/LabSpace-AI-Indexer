# Model-aware storage access

Access preview now moves actual authored geometry instead of covering the
closed model with a generic dark opening and an invented door or tray.

Verified coverage: 28 authored storage-bearing families.

- Wall cabinet: two outward-hinged framed glass doors, hollow folded carcass,
  two fixed internal shelves; shelf order selects the physical shelf.
- Base cabinet: two lower hinged leaves and two independent upper drawers.
- Base drawer cabinet: three independent drawer fronts with attached trays.
- Standard laboratory bench: two central doors and eight independent drawers.
- Mobile bench: two lower doors and two independent drawers.
- Double-sided islands: independent front/rear drawers and lower cabinet bays.
  The service-bridge island has 20 drawers, four lower compartments, and three
  shared upper glazed compartments with two shelves each (33 storage locations).
  Front/rear sliding leaves access the same hutch contents, not duplicated stock.
- Overhead laboratory bench: four glazed modules with eight shelves, eight
  lower drawers, and two lower cabinet compartments.
- Corner bench: separate face-normal drawer travel for both arms of the L.
- Sink benches and enclosed stainless wash cabinets: actual door assemblies,
  open cabinet interiors, and hardware that moves with its owning leaf.
- Glass wall cabinets and steel/glazed sliding cabinets: individual panels
  move on their tracks rather than crossing through each other.
- Tall, chemical, flammable, and solvent cabinets; lockers; refrigerator and
  freezer storage: hollow interiors, physical shelf levels, and opening leaves.
- Mobile drawer units and six-basket towers: independent sliding trays.
- Office desk: a usable pencil drawer; open shelving, heavy-duty racks and
  open stainless wash stations: directly accessible shelves without fake doors.

Each GLB carries hinge pivots, slide travel, part identity, and closed-face bounds.
`scripts/build-storage-rigs.mjs` derives the application manifest from these
delivered GLBs. Blender batches each moving assembly separately and compresses
the geometry with locally served Draco support. Catalog and plan renders come
from the same closed models. Existing material treatments are preserved.

`scripts/blender/build_storage_catalog.py` rebuilds only these storage families
using their original generator/material recipes. `storage_anatomy.py` articulates
the named mesh assemblies before batching. It preserves the closed exterior and
replaces solid interior filler only where real storage access requires a cavity.

## Usable storage records

New placements, including WebMCP-created furniture, receive geometry-derived
drawer, compartment and shelf records automatically. Stable `anatomyKey` values
connect records to real parts; nested bins inherit their parent's access.

For saved rooms, Layout Editor → Storage → **Complete room storage** adds
missing records and links unambiguous existing labels. Details also offers a
per-object completion action. Both are undoable, preserve existing IDs, custom
bins and inventory assignments, and do not move furniture or alter finishes.
No automatic migration replaces the user's room on load.

Legacy labels with incompatible counts are kept for review. Their **Physical
access target** selector can explicitly link a label to a real same-type slot.
This changes only the access binding and is undoable; no stock is moved or
invented. Multiple logical labels may intentionally refer to one physical slot.

Asset Studio includes **Preview storage location** and, for sliding cabinets,
an **Opening panel** selector for testing individual leaves. These previews are
transient and do not edit a project.

The published five-room snapshot includes the completed storage hierarchy:
DEMO-01 121 locations, DEMO-02 38, R809 128, R808 16, and 812 15.
Only storage records and object-to-storage links were updated; the previously
approved room geometry, inventory, materials and startup views are preserved.

The runtime clones object transforms per placed instance; cached geometry and
materials remain shared. Opening is opt-in, animated, reduced-motion aware,
reversible, and inherits the object's position, rotation, scale and flips.
It does not move the object or change history, inventory, storage IDs or saves.
No bottle counts or inventory contents are fabricated inside the cabinet.

Nested bins open their owning drawer. Normalized locations resolve within the
correct face region; legacy unbounded records use ordered physical slots.
Unsupported models and incompatible counts display an explanation and retain
the canonical exact-location highlight. For example, the saved North reagent
cabinet has three drawer records while its base-cabinet model has only two;
those records are preserved, not silently reassigned or deleted.

Coverage checks opposite hinge directions, individual drawer selection, nested
bins, model/record mismatch handling, private clones, exact closing transforms,
and delivered GLB/manifest agreement. Browser coverage verifies opt-in opening,
closing, selection reset, and unchanged persisted room data.
