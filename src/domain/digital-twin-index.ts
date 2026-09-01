import type {
  EquipmentRecord,
  InventoryItem,
  Laboratory,
  Project,
  Room,
  SceneObject,
  StorageLocation,
} from "./schema";

export type DigitalTwinMode = "browse" | "inventory" | "equipment" | "locations" | "alerts";
export type DigitalTwinRecordKind = "inventory" | "equipment" | "location";
export type DigitalTwinScope = "project" | "room";

export type DigitalTwinRecord = {
  id: string;
  kind: DigitalTwinRecordKind;
  name: string;
  kicker: string;
  laboratoryId: string;
  laboratoryName: string;
  laboratoryCode: string;
  roomId: string;
  roomName: string;
  roomCode: string;
  spaceId: string | null;
  spaceName: string | null;
  spaceCode: string | null;
  spaceKind: "primary" | "annex" | null;
  objectId: string | null;
  assetDefinitionId: string | null;
  locationId: string | null;
  path: string[];
  indexCode: string;
  status: string;
  statusTone: "ok" | "warning" | "muted";
  primaryValue: string;
  primaryLabel: string;
  secondaryLabel: string;
  secondaryValue: string;
  notes: string;
  imageSrc: string | null;
  imageCaption: string | null;
  searchText: string;
};

export type DigitalTwinFilter = {
  query: string;
  mode: DigitalTwinMode;
  scope: DigitalTwinScope;
  activeRoomId: string;
};

const inventoryImageRules: Array<{ terms: string[]; src: string }> = [
  { terms: ["nitrile", "glove"], src: "/images/inventory/nitrile-gloves.png" },
  { terms: ["pipette", "tip"], src: "/images/inventory/pipette-tips-200ul.png" },
  { terms: ["hplc", "vial"], src: "/images/inventory/hplc-vials.png" },
  { terms: ["autosampler", "vial"], src: "/images/inventory/hplc-vials.png" },
  { terms: ["buffer"], src: "/images/inventory/buffer-stock.png" },
  { terms: ["reference", "standard"], src: "/images/inventory/reference-standards.png" },
  { terms: ["calibration", "standard"], src: "/images/inventory/reference-standards.png" },
];

export function inferInventoryRecordImage(item: Pick<InventoryItem, "name" | "notes">) {
  const searchable = `${item.name} ${item.notes}`.toLocaleLowerCase();
  return (
    inventoryImageRules.find((rule) => rule.terms.every((term) => searchable.includes(term)))
      ?.src ?? null
  );
}

function locationPath(location: StorageLocation | undefined, locations: StorageLocation[]) {
  if (!location) return [];
  const byId = new Map(locations.map((entry) => [entry.id, entry]));
  const path: StorageLocation[] = [];
  const visited = new Set<string>();
  let cursor: StorageLocation | undefined = location;
  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    path.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return path;
}

function recordContext(laboratory: Laboratory | undefined, room: Room) {
  return {
    laboratoryId: laboratory?.id ?? room.laboratoryId,
    laboratoryName: laboratory?.name ?? "Laboratory",
    laboratoryCode: laboratory?.code ?? "LAB",
    roomId: room.id,
    roomName: room.name,
    roomCode: room.code,
  };
}

function objectPath(
  laboratory: Laboratory | undefined,
  room: Room,
  object: SceneObject | undefined,
  location: StorageLocation | undefined,
) {
  const zone = room.scene.zones.find((entry) => entry.id === object?.zoneId);
  const spaceId = location?.spaceId ?? object?.spaceId;
  const space = room.spaces.find((entry) => entry.id === spaceId);
  return [
    laboratory?.name ?? "Laboratory",
    room.name,
    space && (space.kind === "annex" || space.name !== room.name) ? space.name : undefined,
    zone?.name,
    ...locationPath(location, room.scene.storageLocations).map((entry) => entry.name),
  ].filter((entry): entry is string => Boolean(entry));
}

function recordSpace(
  room: Room,
  object: SceneObject | undefined,
  location: StorageLocation | undefined,
) {
  const spaceId = location?.spaceId ?? object?.spaceId;
  const space = room.spaces.find((entry) => entry.id === spaceId);
  return {
    spaceId: space?.id ?? null,
    spaceName: space?.name ?? null,
    spaceCode: space?.code ?? null,
    spaceKind: space?.kind ?? null,
  };
}

function inventoryRecord(
  item: InventoryItem,
  laboratory: Laboratory | undefined,
  room: Room,
  now: number,
): DigitalTwinRecord {
  const location = room.scene.storageLocations.find((entry) => entry.id === item.storageLocationId);
  const object = room.scene.objects.find((entry) => entry.id === location?.objectId);
  const expiry = item.expiryDate ? new Date(`${item.expiryDate}T00:00:00`) : null;
  const daysUntilExpiry = expiry
    ? Math.ceil((expiry.getTime() - now) / (24 * 60 * 60 * 1000))
    : null;
  const status = !location
    ? "Unassigned"
    : daysUntilExpiry !== null && daysUntilExpiry <= 180
      ? "Expiry review"
      : "In stock";
  const tone = !location || (daysUntilExpiry !== null && daysUntilExpiry <= 180) ? "warning" : "ok";
  const path = objectPath(laboratory, room, object, location);
  const indexCode = location?.indexCode ?? "Location required";
  const context = recordContext(laboratory, room);
  const spaceContext = recordSpace(room, object, location);
  const imageSrc = item.imageSrc ?? inferInventoryRecordImage(item);
  return {
    id: `${room.id}:inventory:${item.id}`,
    kind: "inventory",
    name: item.name,
    kicker: "Inventory",
    ...context,
    ...spaceContext,
    objectId: object?.id ?? null,
    assetDefinitionId: object?.assetDefinitionId ?? null,
    locationId: location?.id ?? null,
    path,
    indexCode,
    status,
    statusTone: tone,
    primaryLabel: "Quantity",
    primaryValue: `${item.quantity} ${item.unit}`,
    secondaryLabel: item.expiryDate ? "Expiry date" : "Owner",
    secondaryValue: item.expiryDate ?? item.owner,
    notes: item.notes || "No notes recorded.",
    imageSrc,
    imageCaption: item.imageSrc
      ? "Indexed record reference image"
      : imageSrc
        ? "Catalog reference photograph"
        : null,
    searchText: [
      item.name,
      item.notes,
      item.owner,
      item.unit,
      indexCode,
      context.laboratoryName,
      context.laboratoryCode,
      context.roomName,
      context.roomCode,
      ...path,
    ]
      .join(" ")
      .toLocaleLowerCase(),
  };
}

function equipmentRecord(
  record: EquipmentRecord,
  laboratory: Laboratory | undefined,
  room: Room,
): DigitalTwinRecord {
  const object = room.scene.objects.find((entry) => entry.id === record.objectId);
  const statusLabels: Record<EquipmentRecord["status"], string> = {
    active: "Operational",
    "service-due": "Service due",
    "out-of-service": "Out of service",
    reserved: "Reserved",
  };
  const statusTone =
    record.status === "active" ? "ok" : record.status === "reserved" ? "muted" : "warning";
  const path = objectPath(laboratory, room, object, undefined);
  const indexCode = object?.indexCode ?? record.equipmentId;
  const context = recordContext(laboratory, room);
  const spaceContext = recordSpace(room, object, undefined);
  return {
    id: `${room.id}:equipment:${record.id}`,
    kind: "equipment",
    name: record.name,
    kicker: "Equipment",
    ...context,
    ...spaceContext,
    objectId: object?.id ?? null,
    assetDefinitionId: object?.assetDefinitionId ?? null,
    locationId: null,
    path,
    indexCode,
    status: statusLabels[record.status],
    statusTone,
    primaryLabel: "Equipment ID",
    primaryValue: record.equipmentId,
    secondaryLabel: "Next service",
    secondaryValue: record.nextServiceDate ?? "Not scheduled",
    notes: record.notes || `${record.manufacturer} ${record.model}`.trim() || "No notes recorded.",
    imageSrc: record.imageSrc ?? null,
    imageCaption: record.imageSrc ? "Equipment reference image" : null,
    searchText: [
      record.name,
      record.equipmentId,
      record.manufacturer,
      record.model,
      record.serialNumber,
      record.responsiblePerson,
      indexCode,
      context.laboratoryName,
      context.laboratoryCode,
      context.roomName,
      context.roomCode,
      ...path,
    ]
      .join(" ")
      .toLocaleLowerCase(),
  };
}

function storageRecord(
  location: StorageLocation,
  laboratory: Laboratory | undefined,
  room: Room,
): DigitalTwinRecord {
  const object = room.scene.objects.find((entry) => entry.id === location.objectId);
  const contents = room.scene.inventoryItems.filter(
    (item) => item.storageLocationId === location.id,
  );
  const contentsImage = contents
    .map((item) => item.imageSrc ?? inferInventoryRecordImage(item))
    .find((image): image is string => Boolean(image));
  const path = objectPath(laboratory, room, object, location);
  const context = recordContext(laboratory, room);
  const spaceContext = recordSpace(room, object, location);
  return {
    id: `${room.id}:location:${location.id}`,
    kind: "location",
    name: location.name,
    kicker: location.type,
    ...context,
    ...spaceContext,
    objectId: object?.id ?? null,
    assetDefinitionId: object?.assetDefinitionId ?? null,
    locationId: location.id,
    path,
    indexCode: location.indexCode,
    status: contents.length ? "Occupied" : "Available",
    statusTone: contents.length ? "ok" : "muted",
    primaryLabel: "Contents",
    primaryValue: `${contents.length} ${contents.length === 1 ? "record" : "records"}`,
    secondaryLabel: "Capacity note",
    secondaryValue: location.capacityNotes || "Not specified",
    notes: contents.length
      ? contents.map((item) => `${item.name} · ${item.quantity} ${item.unit}`).join("; ")
      : "No inventory is assigned to this exact location.",
    imageSrc: contentsImage ?? null,
    imageCaption: contentsImage ? "Indexed contents photograph" : null,
    searchText: [
      location.name,
      location.type,
      location.indexCode,
      context.laboratoryName,
      context.laboratoryCode,
      context.roomName,
      context.roomCode,
      ...path,
    ]
      .join(" ")
      .toLocaleLowerCase(),
  };
}

export function buildDigitalTwinIndex(project: Project, now = Date.now()): DigitalTwinRecord[] {
  const laboratories = new Map(
    project.laboratories.map((laboratory) => [laboratory.id, laboratory]),
  );
  const rooms = project.rooms
    .filter((room) => room.roomKind !== "demo-template")
    .sort((left, right) => {
      if (left.id === project.activeRoomId) return -1;
      if (right.id === project.activeRoomId) return 1;
      return left.name.localeCompare(right.name);
    });

  return rooms.flatMap((room) => {
    const laboratory = laboratories.get(room.laboratoryId);
    return [
      ...room.scene.inventoryItems.map((item) => inventoryRecord(item, laboratory, room, now)),
      ...room.scene.equipmentRecords.map((record) => equipmentRecord(record, laboratory, room)),
      ...room.scene.storageLocations.map((location) => storageRecord(location, laboratory, room)),
    ];
  });
}

export function filterDigitalTwinIndex(
  records: DigitalTwinRecord[],
  { query, mode, scope, activeRoomId }: DigitalTwinFilter,
) {
  const normalized = query.trim().toLocaleLowerCase();
  const queryTerms = normalized.split(/\s+/).filter(Boolean);
  return records.filter((record) => {
    if (scope === "room" && record.roomId !== activeRoomId) return false;
    if (mode === "inventory" && record.kind !== "inventory") return false;
    if (mode === "equipment" && record.kind !== "equipment") return false;
    if (mode === "locations" && record.kind !== "location") return false;
    if (mode === "alerts" && record.statusTone !== "warning") return false;
    return !normalized || queryTerms.every((term) => record.searchText.includes(term));
  });
}

export function preferredDigitalTwinRecord(
  records: DigitalTwinRecord[],
  activeRoomId: string,
  storageLocations: StorageLocation[],
  sceneObjects: SceneObject[] = [],
  roomSize?: { width: number; depth: number },
) {
  const locationsById = new Map(storageLocations.map((location) => [location.id, location]));
  const objectsById = new Map(sceneObjects.map((object) => [object.id, object]));
  const focusableRecords = records.filter((record) => {
    if (!record.locationId || record.roomId !== activeRoomId) return false;
    const location = locationsById.get(record.locationId);
    return location?.type === "drawer" || location?.type === "bin";
  });

  if (roomSize && focusableRecords.length > 1) {
    focusableRecords.sort((left, right) => {
      const distanceFromRoomCenter = (record: DigitalTwinRecord) => {
        const object = record.objectId ? objectsById.get(record.objectId) : undefined;
        if (!object) return Number.POSITIVE_INFINITY;
        const x = object.position.x - roomSize.width / 2;
        const y = object.position.y - roomSize.depth / 2;
        return x * x + y * y;
      };
      const spatialDifference = distanceFromRoomCenter(left) - distanceFromRoomCenter(right);
      if (Math.abs(spatialDifference) > 1) return spatialDifference;
      if (left.kind !== right.kind) return left.kind === "inventory" ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
  }

  return (
    focusableRecords[0] ?? records.find((record) => record.roomId === activeRoomId) ?? records[0]
  );
}

export function shouldAutoFocusDigitalTwinResult(
  query: string,
  record: DigitalTwinRecord | undefined,
) {
  return query.trim().length >= 2 && Boolean(record?.objectId);
}
