import type {
  EquipmentRecord,
  Room,
  Scene,
  SceneObject,
  StorageLocation,
  StorageLocationType,
} from "./schema";

const locationSuffix: Record<StorageLocationType, string> = {
  cabinet: "CAB",
  compartment: "CP",
  shelf: "SH",
  drawer: "DR",
  bin: "BIN",
};

function pad(value: number, width: number) {
  return value.toString().padStart(width, "0");
}

/**
 * Produces a consistent, label-safe index code while retaining Unicode letters
 * and numbers. NFKC normalization also makes full-width codes entered on a
 * Japanese keyboard compare consistently with their ASCII equivalents.
 */
export function normalizeIndexCode(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) {
    throw new Error("An index code must contain at least one letter or number.");
  }
  return normalized;
}

function tryNormalizeIndexCode(value: string): string | null {
  try {
    return normalizeIndexCode(value);
  } catch {
    return null;
  }
}

export function baseRoomPrefix(laboratoryCode: string, roomCode: string, zoneCode?: string | null) {
  const segments = [normalizeIndexCode(laboratoryCode), normalizeIndexCode(roomCode)];
  if (zoneCode?.trim()) segments.push(normalizeIndexCode(zoneCode));
  return segments.join("-");
}

export function generateObjectIndexCode(
  room: Pick<Room, "code">,
  scene: Scene,
  objectType: SceneObject["objectType"],
  zoneId: string | null,
  laboratoryCode: string,
): string {
  const zone = scene.zones.find((entry) => entry.id === zoneId) ?? scene.zones[0];
  const suffix =
    objectType === "storage"
      ? "CAB"
      : objectType === "equipment"
        ? "EQ"
        : objectType === "safety"
          ? "SAFE"
          : "OBJ";
  const prefix = `${baseRoomPrefix(laboratoryCode, room.code, zone?.code)}-${suffix}`;
  const used = new Set(
    scene.objects
      .map((object) => tryNormalizeIndexCode(object.indexCode))
      .filter((code): code is string => code !== null),
  );
  let sequence = 1;
  while (used.has(`${prefix}-${pad(sequence, 3)}`)) sequence += 1;
  return `${prefix}-${pad(sequence, 3)}`;
}

export function ensureUniqueCode(
  code: string,
  usedCodes: Iterable<string>,
  currentCode?: string,
): string {
  const normalized = normalizeIndexCode(code);
  const normalizedCurrent = currentCode ? tryNormalizeIndexCode(currentCode) : null;
  const used = new Set<string>();
  let removedCurrent = false;

  for (const entry of usedCodes) {
    const normalizedEntry = tryNormalizeIndexCode(entry);
    if (!normalizedEntry) continue;
    if (!removedCurrent && normalizedCurrent && normalizedEntry === normalizedCurrent) {
      removedCurrent = true;
      continue;
    }
    used.add(normalizedEntry);
  }

  if (!used.has(normalized)) return normalized;
  let sequence = 2;
  while (used.has(`${normalized}-${sequence}`)) sequence += 1;
  return `${normalized}-${sequence}`;
}

/**
 * Creates the human-facing equipment identifier for a newly placed equipment
 * record from that object's real spatial index. Existing record identifiers are
 * considered so imported or manually edited data cannot create a duplicate.
 */
export function deriveDefaultEquipmentId(
  object: Pick<SceneObject, "indexCode">,
  existingRecords: Iterable<Pick<EquipmentRecord, "equipmentId">> = [],
): string {
  return ensureUniqueCode(
    object.indexCode,
    Array.from(existingRecords, (record) => record.equipmentId),
  );
}

export function generateChildIndexCode(
  parent: StorageLocation,
  type: StorageLocationType,
  siblings: StorageLocation[],
): string {
  const suffix = locationSuffix[type];
  const parentCode = normalizeIndexCode(parent.indexCode);
  const used = new Set(
    siblings
      .filter((location) => location.parentId === parent.id && location.type === type)
      .map((location) => tryNormalizeIndexCode(location.indexCode))
      .filter((code): code is string => code !== null),
  );
  let sequence = 1;
  while (used.has(`${parentCode}-${suffix}-${pad(sequence, 2)}`)) sequence += 1;
  return `${parentCode}-${suffix}-${pad(sequence, 2)}`;
}

export type ReindexChange = {
  id: string;
  type: "object" | "location";
  before: string;
  after: string;
};

export function previewReindex(room: Room, laboratoryCode: string): ReindexChange[] {
  const changes: ReindexChange[] = [];
  const objects = [...room.scene.objects].sort(
    (a, b) =>
      a.position.y - b.position.y || a.position.x - b.position.x || a.id.localeCompare(b.id),
  );
  const counters = new Map<string, number>();
  const objectCode = new Map<string, string>();
  const reindexedTypes = new Set<SceneObject["objectType"]>(["storage", "equipment", "safety"]);
  const usedObjectCodes = new Set(
    room.scene.objects
      .filter((object) => !reindexedTypes.has(object.objectType))
      .map((object) => tryNormalizeIndexCode(object.indexCode))
      .filter((code): code is string => code !== null),
  );

  for (const object of objects) {
    if (!reindexedTypes.has(object.objectType)) continue;
    const zone =
      room.scene.zones.find((entry) => entry.id === object.zoneId) ?? room.scene.zones[0];
    const suffix =
      object.objectType === "storage" ? "CAB" : object.objectType === "equipment" ? "EQ" : "SAFE";
    const prefix = `${baseRoomPrefix(laboratoryCode, room.code, zone?.code)}-${suffix}`;
    const key = prefix;
    let next = (counters.get(key) ?? 0) + 1;
    while (usedObjectCodes.has(`${prefix}-${pad(next, 3)}`)) next += 1;
    counters.set(key, next);
    const after = `${prefix}-${pad(next, 3)}`;
    usedObjectCodes.add(after);
    objectCode.set(object.id, after);
    if (after !== object.indexCode)
      changes.push({ id: object.id, type: "object", before: object.indexCode, after });
  }
  const byId = new Map(room.scene.storageLocations.map((location) => [location.id, location]));
  const locationCode = new Map<string, string>();
  const usedLocationCodes = new Set<string>();
  const resolving = new Set<string>();

  const reserveLocationCode = (candidate: string) => {
    const after = ensureUniqueCode(candidate, usedLocationCodes);
    usedLocationCodes.add(after);
    return after;
  };

  const resolveCode = (location: StorageLocation): string => {
    const cached = locationCode.get(location.id);
    if (cached) return cached;
    if (resolving.has(location.id)) {
      const fallback = reserveLocationCode(location.indexCode);
      locationCode.set(location.id, fallback);
      return fallback;
    }

    resolving.add(location.id);
    let result: string;
    if (!location.parentId) {
      const root =
        objectCode.get(location.objectId) ??
        tryNormalizeIndexCode(
          room.scene.objects.find((object) => object.id === location.objectId)?.indexCode ?? "",
        ) ??
        location.indexCode;
      result = root;
    } else {
      const parent = byId.get(location.parentId);
      if (!parent) {
        result = location.indexCode;
      } else {
        const parentCode = resolveCode(parent);
        const siblings = room.scene.storageLocations
          .filter((entry) => entry.parentId === parent.id && entry.type === location.type)
          .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
        const sequence = siblings.findIndex((entry) => entry.id === location.id) + 1;
        result = `${parentCode}-${locationSuffix[location.type]}-${pad(sequence, 2)}`;
      }
    }

    resolving.delete(location.id);
    const cycleCode = locationCode.get(location.id);
    if (cycleCode) return cycleCode;
    const after = reserveLocationCode(result);
    locationCode.set(location.id, after);
    return after;
  };
  for (const location of [...room.scene.storageLocations].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const after = resolveCode(location);
    if (after !== location.indexCode)
      changes.push({ id: location.id, type: "location", before: location.indexCode, after });
  }
  return changes;
}

export function getLocationPath(scene: Scene, locationId: string): StorageLocation[] {
  const byId = new Map(scene.storageLocations.map((location) => [location.id, location]));
  const path: StorageLocation[] = [];
  let current = byId.get(locationId);
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    path.unshift(current);
    visited.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

export function indexingStats(scene: Scene) {
  const occupied = new Set(
    scene.inventoryItems.map((item) => item.storageLocationId).filter(Boolean),
  );
  return {
    totalLocations: scene.storageLocations.length,
    occupiedLocations: occupied.size,
    emptyLocations: scene.storageLocations.filter(
      (location) => location.type !== "cabinet" && !occupied.has(location.id),
    ).length,
    unassignedItems: scene.inventoryItems.filter((item) => !item.storageLocationId).length,
    equipment: scene.equipmentRecords.length,
  };
}
