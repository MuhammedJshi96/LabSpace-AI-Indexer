# Indexing system

Indexing represents physical containment across a professional multi-laboratory project, not drawing order and not a Room 809-specific naming scheme.

```text
Project → Laboratory → Room → Zone → Cabinet → Compartment/Shelf/Drawer → Bin → Inventory
                                      └──────────────────────────────────────→ Equipment
```

## Code format

Examples from independent facilities:

- `CHEMISTRY-WEST-B-214-WET-PREP-CAB-001`
- `CHEMISTRY-WEST-B-214-WET-PREP-CAB-001-SH-01`
- `CHEMISTRY-WEST-B-214-WET-PREP-CAB-001-DR-02-BIN-03`
- `GENOMICS-CORE-C-317-CELL-CULTURE-EQ-001`

Some DEMO-01 records retain provenance-derived codes such as `LAB-R809-Z01-CAB-001`, but `LAB` and `R809` are data values rather than defaults imposed by the indexing domain or the showcase identity.

Object codes are allocated from an explicit laboratory code, room code, optional zone code, and object-type suffix. Child suffixes are allocated among siblings. Movement never changes a stable code. Manual edits and controlled reindexing use normalized case-insensitive uniqueness checks.

Normalization applies Unicode NFKC conversion, uppercasing, and separator cleanup. This makes full-width keyboard input, whitespace, and punctuation compare consistently while retaining letters and numbers. Empty/punctuation-only codes are rejected.

## Controlled reindex

The Reindex dialog resolves the active room's actual laboratory and computes a before/after preview. Nothing changes until the user applies it. The generator orders eligible objects deterministically, reserves codes belonging to other scene objects, and updates object and nested storage-location codes together without mutating the preview source.

Room 809 is not required for reindexing. Automated cases cover `CHEMISTRY-WEST / B-214` and `GENOMICS-CORE / C-317` to prevent a demonstration-code regression.

## Index Navigator

The panel provides search, all/occupied/empty/unassigned filters, statistics, a nested tree, exact path, capacity notes, contents, child creation/removal, label printing, reindexing, and 2D/3D highlighting. Selecting a location selects its physical object; selecting a storage object exposes its hierarchy.

Allowed child rules:

- Cabinet: compartment, shelf, drawer
- Compartment: shelf, bin
- Shelf: bin
- Drawer: bin
- Bin: none

Removing a location also removes descendants and safely marks their inventory as unassigned.

## Equipment uniqueness

When equipment is placed, its default human-facing `equipmentId` is derived from the object's normalized spatial index, for example `GENOMICS-CORE-C-317-CELL-CULTURE-EQ-001`. Existing equipment IDs are considered before allocation. The validation panel detects duplicate equipment IDs and duplicate serial numbers independently from physical location codes.

The equipment identifier remains editable and is not a manufacturer serial number. Manufacturer, model, serial, service, owner, and utility data remain separate equipment-record fields.
