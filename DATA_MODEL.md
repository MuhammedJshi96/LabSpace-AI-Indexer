# Data model

The current scene schema version is `2`. Zod validates data at seed creation, import, API writes, repository reads, and version retrieval.

## Aggregate hierarchy

- **Project** — stable ID, name, schema version, laboratories, rooms, active room, timestamps.
- **Laboratory** — project ownership, code, name, ordered room IDs.
- **Room** — code, name, laboratory, optional environment-profile ID, width, depth, wall height, floor finish, notes, and one independent scene.
- **RoomVersion** — immutable named scene snapshot with project/room IDs, note, schema version, timestamp.
- **Scene** — objects, layers, zones, storage locations, inventory, equipment records, label templates.
- **SceneObject** — UUID, index code, asset definition, object type, position, dimensions, rotation, layer, room, zone, lock/visibility, metadata, parent/child links, z-order, timestamps, and optional wall/opening geometry.
- **AssetDefinition** — manifest ID, category, profile, material, default/min/max dimensions, tags, anchors, collision footprint, thumbnail and indexing metadata.
- **Layer** — name, optional semantic role, order, colour, visibility, lock, system/custom flag. Roles resolve object placement inside each scene without relying on demonstration layer IDs.
- **Zone** — room-scoped name, code, colour.
- **StorageLocation** — cabinet/compartment/shelf/drawer/bin node with parent, children, order, code, capacity notes.
- **InventoryItem** — name, quantity, unit, owner, notes, optional expiry date, exact optional location.
- **EquipmentRecord** — equipment/internal ID, manufacturer, model, serial, status, responsible person, service dates, utilities, notes.
- **LabelTemplate** — physical dimensions and barcode/description options.

## Coordinates and units

The 2D plane uses `x` and `y`; elevation is `z`. Width, depth, height, positions, wall endpoints, opening offsets, and tolerances are millimetres. Rotation is stored in degrees. The 3D renderer converts using `metres = millimetres / 1000`.

## Referential rules

- Every object belongs to one room and one layer.
- Every room belongs to one laboratory, and laboratory room IDs remain consistent with the project room collection.
- Zone references are nullable.
- Storage parents and children must form an allowed acyclic hierarchy.
- Inventory may be unassigned; a non-null location must exist.
- Equipment records reference equipment objects.
- Door/window openings reference an existing wall.
- Object and location index codes must be unique within a room. Generated indexes explicitly combine the owning laboratory, room, optional zone, and object type.

## Generic room configuration

Generic factories create a project, laboratory, or room without copying Room 809 scene content. Blank rooms have fresh semantic layers and label templates but no objects, zones, indexed storage, inventory, equipment records, or environment profile.

`Room.floorFinish` resolves through the laboratory-material registry. Light-gray epoxy, sealed concrete, and welded vinyl provide one synchronized definition for 2D plan treatment and 3D PBR appearance.

`Room.environmentProfileId` is nullable presentation metadata. It selects non-indexed ceiling/service context independently of walls, floors, and equipment. Only the optional DEMO-01 showcase profile is currently registered.

## Migration handling

`src/domain/migrations.ts` upgrades older saved documents before current-schema parsing. Migrations are explicit and sequential. A future schema change must increment the version, add an upgrade step, retain fixtures for the prior version, and add a migration test.
