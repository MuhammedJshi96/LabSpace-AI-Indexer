# Stepped cabinet and assembly refinement

User-approved scope: asymmetric five-drawer laboratory bench, standard laboratory
bench, center island bench and island laboratory bench with service bridge.
The supplied `Lab Bench Shimadzu ref 3.jpg` is the silhouette reference. A 75 mm
setback is an original representative choice, not a measurement from the photo.

## Construction

- Lower cabinet leaves, handles and hinge origins sit 75 mm behind the unchanged
  drawer fronts. Both working faces of the two islands use the same rule.
- Structural floors and plinths follow the stepped face. Cabinet liners, drawer
  soffits and shelves match the shallower lower cabinet volume. The asymmetric
  bench's exposed left gable also steps back below the upper drawers.
- Existing drawers, worktops, envelopes, storage-part names and materials remain
  unchanged. Each lower cabinet has two real shelves. Existing asymmetric shelf
  names are retained; shelves added to the other three models are new canonical
  locations, not a rewrite of saved inventory.
- Recessed leaves open to 90 degrees, avoiding the adjacent forward drawer bank.
  Geometry-derived storage regions and hinge pivots follow the real moved leaves.
- Fixed worktop bearings close the previous 11–15 mm support gaps; the service
  bridge has positive mounting plates. Feet sit under their inset plinths.
  Deliberate movement reveals are retained. No global material or lighting change.

## Verification and scope limits

`recessed_casework.py` runs before storage articulation and material batching and
is explicitly limited to the four named asset IDs. The original generators remain
the source; delivered GLBs and both catalog views are regenerated only for these
IDs. Root metadata records the chosen setback and bearing-joint extents.

Unit coverage checks the measured front-plane difference, 90-degree hinge limits,
separate physical shelves on opposing island faces, canonical storage counts,
and intersecting support/bearing/worktop extents. Before/after model comparison
checks that existing PBR material definitions, drawer metadata and storage-part
IDs have not changed. The live Asset Studio is used for exterior and access QA.

This is the first scoped fixed-joint cleanup, not a claim that the other 100
catalog families have all received a geometric assembly audit. Existing rooms,
laboratories, saved inventory and public deployment are not modified.

Completed local verification: `npm run release:check` passes lint, TypeScript,
all 280 tests across 47 files, all 208 authored render framing checks and the
production build. Final before/after checks found no changed existing materials,
drawer metadata, removed storage keys or unrelated storage rigs. Live previews
covered the four exteriors, lower cabinet access and both island working faces.
