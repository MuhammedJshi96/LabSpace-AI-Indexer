import type { InventoryItem, Project, StorageLocation } from "./schema";

export type InventoryReference = { roomId: string; itemId: string };
type Placement = InventoryReference & { locationId: string | null };
export type OrganizationCommand =
  | {
      id: string;
      label: string;
      kind: "inventory-creation";
      entries: Array<{ roomId: string; item: InventoryItem }>;
    }
  | {
      id: string;
      label: string;
      kind: "inventory-assignment";
      before: Placement[];
      after: Placement[];
    }
  | {
      id: string;
      label: string;
      kind: "storage-name";
      roomId: string;
      locationId: string;
      before: string;
      after: string;
      objectId: string | null;
      objectNameBefore: string | null;
    };

export function inventoryCreationCommand(
  entries: Array<{ roomId: string; item: InventoryItem }>,
): OrganizationCommand {
  if (!entries.length) throw new Error("Create at least one inventory record.");
  const itemIds = new Set(entries.map((entry) => entry.item.id));
  if (itemIds.size !== entries.length)
    throw new Error("Each inventory record must have a unique ID.");
  return {
    id: crypto.randomUUID(),
    kind: "inventory-creation",
    label: `Create ${entries.length} inventory ${entries.length === 1 ? "record" : "records"}`,
    entries: structuredClone(entries),
  };
}

export function storagePath(locations: readonly StorageLocation[], id: string | null) {
  const path: StorageLocation[] = [];
  const visited = new Set<string>();
  let current = locations.find((entry) => entry.id === id);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current);
    current = locations.find((entry) => entry.id === current?.parentId);
  }
  return path;
}

function editableRoom(project: Project, roomId: string) {
  const room = project.rooms.find(
    (entry) => entry.id === roomId && entry.roomKind !== "demo-template",
  );
  if (!room) throw new Error("This room is no longer available. Choose another room.");
  return room;
}

export function inventoryAssignmentCommand(
  project: Project,
  items: InventoryReference[],
  roomId: string,
  locationId: string | null,
): OrganizationCommand {
  const target = editableRoom(project, roomId);
  if (
    locationId !== null &&
    !target.scene.storageLocations.some((entry) => entry.id === locationId)
  )
    throw new Error("This storage location is no longer available. Choose another location.");
  if (!items.length) throw new Error("Select at least one inventory item.");
  const unique = new Set<string>();
  const before = items.map((reference) => {
    if (unique.has(reference.itemId)) throw new Error("Select each inventory record only once.");
    unique.add(reference.itemId);
    const source = editableRoom(project, reference.roomId);
    const matches = project.rooms.flatMap((room) =>
      room.scene.inventoryItems.filter((item) => item.id === reference.itemId),
    );
    const item = source.scene.inventoryItems.find((entry) => entry.id === reference.itemId);
    if (!item || matches.length !== 1)
      throw new Error(
        "An inventory record changed or is ambiguous. Reopen the assignment and try again.",
      );
    return { ...reference, locationId: item.storageLocationId };
  });
  return {
    id: crypto.randomUUID(),
    kind: "inventory-assignment",
    label: `Assign ${items.length} inventory ${items.length === 1 ? "item" : "items"}`,
    before,
    after: before.map((entry) => ({ ...entry, roomId, locationId })),
  };
}

export function storageRenameCommand(
  project: Project,
  roomId: string,
  locationId: string,
  requestedName: string,
): OrganizationCommand {
  const room = editableRoom(project, roomId);
  const location = room.scene.storageLocations.find((entry) => entry.id === locationId);
  if (!location) throw new Error("This storage location is no longer available.");
  const name = requestedName.trim();
  if (!name || name.length > 100) throw new Error("Use a name between 1 and 100 characters.");
  const object = !location.parentId
    ? room.scene.objects.find((entry) => entry.id === location.objectId)
    : null;
  return {
    id: crypto.randomUUID(),
    kind: "storage-name",
    label: `Rename ${location.type}`,
    roomId,
    locationId,
    before: location.name,
    after: name,
    objectId: object?.id ?? null,
    objectNameBefore: object?.name ?? null,
  };
}

/** Apply bounded inventory organization/creation deltas without restoring unrelated geometry. */
export function applyOrganizationCommand(
  project: Project,
  command: OrganizationCommand,
  direction: "apply" | "revert",
): Project {
  const now = new Date().toISOString();
  if (command.kind === "inventory-creation") {
    const ids = new Set(command.entries.map((entry) => entry.item.id));
    const existing = project.rooms.flatMap((room) => room.scene.inventoryItems);
    for (const entry of command.entries) editableRoom(project, entry.roomId);
    if (direction === "apply" && existing.some((item) => ids.has(item.id)))
      throw new Error("An inventory record with this ID already exists.");
    if (
      direction === "revert" &&
      command.entries.some(
        (entry) =>
          !project.rooms
            .find((room) => room.id === entry.roomId)
            ?.scene.inventoryItems.some((item) => item.id === entry.item.id),
      )
    )
      throw new Error("An inventory record created by this change no longer exists.");
    return {
      ...project,
      updatedAt: now,
      rooms: project.rooms.map((room) => {
        const additions = command.entries.filter((entry) => entry.roomId === room.id);
        if (!additions.length) return room;
        return {
          ...room,
          updatedAt: now,
          scene: {
            ...room.scene,
            updatedAt: now,
            inventoryItems:
              direction === "apply"
                ? [...room.scene.inventoryItems, ...additions.map((entry) => entry.item)]
                : room.scene.inventoryItems.filter((item) => !ids.has(item.id)),
          },
        };
      }),
    };
  }
  if (command.kind === "storage-name") {
    const room = editableRoom(project, command.roomId);
    if (!room.scene.storageLocations.some((entry) => entry.id === command.locationId))
      throw new Error("The renamed location no longer exists.");
    const name = direction === "apply" ? command.after : command.before;
    return {
      ...project,
      updatedAt: now,
      rooms: project.rooms.map((entry) =>
        entry.id !== room.id
          ? entry
          : {
              ...entry,
              updatedAt: now,
              scene: {
                ...entry.scene,
                updatedAt: now,
                storageLocations: entry.scene.storageLocations.map((location) =>
                  location.id === command.locationId
                    ? { ...location, name, updatedAt: now }
                    : location,
                ),
                objects: entry.scene.objects.map((object) =>
                  object.id === command.objectId
                    ? {
                        ...object,
                        name: direction === "apply" ? name : command.objectNameBefore!,
                        updatedAt: now,
                      }
                    : object,
                ),
              },
            },
      ),
    };
  }
  const placements = direction === "apply" ? command.after : command.before;
  const references = project.rooms.flatMap((room) =>
    room.scene.inventoryItems.map((item) => ({ room, item })),
  );
  const items = new Map(references.map(({ item }) => [item.id, item] as const));
  for (const placement of placements) {
    const target = editableRoom(project, placement.roomId);
    if (!items.has(placement.itemId))
      throw new Error("An assigned inventory record no longer exists.");
    const sources = references.filter(({ item }) => item.id === placement.itemId);
    if (sources.length !== 1 || sources[0].room.roomKind === "demo-template")
      throw new Error("An assigned inventory record is ambiguous or no longer editable.");
    if (
      placement.locationId !== null &&
      !target.scene.storageLocations.some((location) => location.id === placement.locationId)
    )
      throw new Error("The original storage location no longer exists.");
  }
  const targets = new Map(placements.map((entry) => [entry.itemId, entry]));
  return {
    ...project,
    updatedAt: now,
    rooms: project.rooms.map((room) => {
      const incoming = placements.filter((entry) => entry.roomId === room.id);
      const affected =
        incoming.length || room.scene.inventoryItems.some((item) => targets.has(item.id));
      if (!affected) return room;
      const inventoryItems = room.scene.inventoryItems.flatMap((item) => {
        const target = targets.get(item.id);
        if (!target) return [item];
        return target.roomId === room.id
          ? [{ ...item, storageLocationId: target.locationId, updatedAt: now }]
          : [];
      });
      for (const target of incoming)
        if (!inventoryItems.some((item) => item.id === target.itemId))
          inventoryItems.push({
            ...items.get(target.itemId)!,
            storageLocationId: target.locationId,
            updatedAt: now,
          });
      return { ...room, updatedAt: now, scene: { ...room.scene, inventoryItems, updatedAt: now } };
    }),
  };
}
