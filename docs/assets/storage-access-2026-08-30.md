# Model-aware storage access

Access preview now moves actual authored geometry instead of covering the
closed model with a generic dark opening and an invented door or tray.

Verified families:

- Wall cabinet: two outward-hinged framed glass doors, hollow folded carcass,
  two fixed internal shelves; shelf order selects the physical shelf.
- Base cabinet: two lower hinged leaves and two independent upper drawers.
- Base drawer cabinet: three independent drawer fronts with attached trays.
- Standard laboratory bench: two central doors and eight independent drawers.
- Mobile bench: two lower doors and two independent drawers.

Each GLB carries hinge pivots, slide travel, part identity, and closed-face bounds.
`scripts/build-storage-rigs.mjs` derives the application manifest from these
delivered GLBs. Blender batches each moving assembly separately and compresses
the geometry with locally served Draco support. Catalog and plan renders come
from the same closed models. Existing material treatments are preserved.

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
