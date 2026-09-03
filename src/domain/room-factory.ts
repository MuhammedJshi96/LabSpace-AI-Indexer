import { createDefaultLayers } from "./layers";
import {
  LaboratorySchema,
  ProjectSchema,
  RoomSchema,
  SCENE_SCHEMA_VERSION,
  type Laboratory,
  type Project,
  type Room,
} from "./schema";

export const PROFESSIONAL_BLANK_ROOM_DEFAULTS = {
  width: 10_000,
  depth: 8_000,
  wallHeight: 3_000,
  floorFinish: "Light grey seamless epoxy",
  wallFinish: "clean-white-panel",
} as const;

export type BlankRoomOptions = {
  id?: string;
  laboratoryId?: string;
  name: string;
  code: string;
  width?: number;
  depth?: number;
  wallHeight?: number;
  floorFinish?: string;
  wallFinish?: string;
  notes?: string;
};

export type BlankLaboratoryOptions = {
  id?: string;
  name: string;
  code: string;
  roomIds?: string[];
};

export type BlankProjectOptions = {
  id?: string;
  name?: string;
  laboratory?: Partial<BlankLaboratoryOptions>;
  room?: Partial<Omit<BlankRoomOptions, "laboratoryId">>;
};

function standardLabelTemplates() {
  return [
    {
      id: crypto.randomUUID(),
      name: "Standard location label",
      widthMm: 70,
      heightMm: 36,
      showBarcode: false,
      showDescription: true,
    },
    {
      id: crypto.randomUUID(),
      name: "Compact drawer label",
      widthMm: 50,
      heightMm: 25,
      showBarcode: false,
      showDescription: false,
    },
  ];
}

export function createBlankLaboratory(
  projectId: string,
  options: BlankLaboratoryOptions,
): Laboratory {
  return LaboratorySchema.parse({
    id: options.id ?? crypto.randomUUID(),
    projectId,
    name: options.name,
    code: options.code,
    roomIds: options.roomIds ?? [],
  });
}

export function createBlankRoom(options: BlankRoomOptions): Room;
/** @deprecated Pass generic BlankRoomOptions without a template room. */
export function createBlankRoom(template: Room, options: BlankRoomOptions): Room;
export function createBlankRoom(
  templateOrOptions: Room | BlankRoomOptions,
  legacyOptions?: BlankRoomOptions,
): Room {
  const template = legacyOptions ? (templateOrOptions as Room) : null;
  const options = legacyOptions ?? (templateOrOptions as BlankRoomOptions);
  const now = new Date().toISOString();
  const roomId = options.id ?? crypto.randomUUID();
  const laboratoryId = options.laboratoryId ?? template?.laboratoryId;
  if (!laboratoryId)
    throw new Error("A laboratory ID is required when creating a professional blank room.");

  return RoomSchema.parse({
    id: roomId,
    laboratoryId,
    name: options.name,
    code: options.code,
    environmentProfileId: null,
    width: options.width ?? PROFESSIONAL_BLANK_ROOM_DEFAULTS.width,
    depth: options.depth ?? PROFESSIONAL_BLANK_ROOM_DEFAULTS.depth,
    wallHeight: options.wallHeight ?? PROFESSIONAL_BLANK_ROOM_DEFAULTS.wallHeight,
    floorFinish: options.floorFinish ?? PROFESSIONAL_BLANK_ROOM_DEFAULTS.floorFinish,
    wallFinish: options.wallFinish ?? PROFESSIONAL_BLANK_ROOM_DEFAULTS.wallFinish,
    notes: options.notes ?? "",
    scene: {
      schemaVersion: SCENE_SCHEMA_VERSION,
      id: crypto.randomUUID(),
      roomId,
      objects: [],
      layers: createDefaultLayers(),
      zones: [],
      storageLocations: [],
      inventoryItems: [],
      equipmentRecords: [],
      labelTemplates: standardLabelTemplates(),
      updatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  });
}

export function createBlankProject(options: BlankProjectOptions = {}): Project {
  const now = new Date().toISOString();
  const projectId = options.id ?? crypto.randomUUID();
  const laboratory = createBlankLaboratory(projectId, {
    id: options.laboratory?.id,
    name: options.laboratory?.name ?? "New laboratory",
    code: options.laboratory?.code ?? "LAB-NEW",
  });
  const room = createBlankRoom({
    id: options.room?.id,
    laboratoryId: laboratory.id,
    name: options.room?.name ?? "Room 1",
    code: options.room?.code ?? "R001",
    width: options.room?.width,
    depth: options.room?.depth,
    wallHeight: options.room?.wallHeight,
    floorFinish: options.room?.floorFinish,
    wallFinish: options.room?.wallFinish,
    notes: options.room?.notes,
  });
  laboratory.roomIds = [room.id];

  return ProjectSchema.parse({
    schemaVersion: SCENE_SCHEMA_VERSION,
    id: projectId,
    name: options.name ?? "Untitled laboratory project",
    laboratories: [laboratory],
    rooms: [room],
    activeRoomId: room.id,
    createdAt: now,
    updatedAt: now,
  });
}
