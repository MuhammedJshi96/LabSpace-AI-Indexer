import { create } from "zustand";
import type { PendingAgentChange } from "../agent/labspace-action-types";
import { getAssetDefinition } from "../domain/assets";
import { completeObjectStorage } from "../domain/storage-templates";
import { STORAGE_RIGS } from "../domain/storage-access";
import { applyCommand, revertCommand, type SceneCommand } from "../domain/history";
import {
  applyOrganizationCommand,
  inventoryAssignmentCommand,
  storageRenameCommand,
  type InventoryReference,
  type OrganizationCommand,
} from "../domain/inventory-organization";
type EditorCommand = SceneCommand | OrganizationCommand;
import {
  alignBenchObjectToCurrentSupport,
  requiresBenchSupport,
  snapChairToDesk,
} from "../domain/geometry";
import { ensureProjectLayers, resolveLayerIdForObjectType } from "../domain/layers";
import { normalizeRaisedFromFloorMm } from "../domain/object-transforms";
import { createBlankLaboratory, createBlankRoom } from "../domain/room-factory";
import {
  buildConnectedAnnex,
  buildRoomRectangle,
  type WallFactoryOptions,
} from "../domain/room-building";
import {
  getClosedWallFloorPolygon,
  normalizeClosedRoomFromWallLoop,
  normalizeRoomFloorEnvelope,
  type PlanPoint,
  type RoomPlanSize,
} from "../domain/room-geometry";
import {
  findNearestWallProjection,
  hostOpeningAtPoint,
  openingOverlapsSibling,
  resolveHostedOpening,
} from "../domain/wall-openings";
import {
  deriveDefaultEquipmentId,
  generateChildIndexCode,
  generateObjectIndexCode,
  type ReindexChange,
} from "../domain/indexing";
import { createSeedProject } from "../domain/seed";
import type {
  AssetDefinition,
  EquipmentRecord,
  InventoryItem,
  Layer,
  Project,
  Room,
  RoomViewState,
  RoomVersion,
  Scene,
  SceneObject,
  StorageLocation,
  StorageLocationType,
  Vector3,
} from "../domain/schema";
import {
  getPersistenceMode,
  getRoomVersion,
  listRoomVersions,
  loadProject,
  persistProject,
  saveRoomVersion,
} from "../lib/api";

export type EditorTool =
  "select" | "pan" | "wall" | "rectangle" | "annex" | "door" | "window" | "measure";
export type InspectorPanel =
  "room" | "layers" | "index" | "inventory" | "properties" | "validation";
export type CameraPreset =
  "perspective" | "orthographic" | "top" | "isometric" | "front" | "right" | "left" | "back";
export type SaveStatus = "loading" | "unsaved" | "saving" | "saved" | "error";
export type MeasurementOverlayKey = "overall" | "walls" | "openings" | "clearance";
export const LAB_ENVIRONMENT_CONTEXT_VISIBILITY_KEY = "labspace-environment-context-visible";
export type AppDialog =
  | null
  | "version"
  | "versions"
  | "project"
  | "settings"
  | "help"
  | "reports"
  | "labels"
  | "reindex"
  | "inventory"
  | "demos"
  | "blueprint";

export type AlignmentGuide = { axis: "x" | "y"; value: number; kind: string };

export type SpatialFocusRequest = {
  requestId: string;
  recordId: string;
  roomId: string;
  objectId: string;
  locationId: string | null;
  showStorageAccess: boolean;
};

type Toast = { id: string; tone: "success" | "error" | "info"; message: string };

type AssetTransformOverrides = Partial<
  Pick<SceneObject, "dimensions" | "rotation" | "flipHorizontal" | "flipVertical" | "opening">
>;

let pendingHydration: Promise<void> | null = null;
let pendingProjectSave: Promise<void> | null = null;
let saveRequestedWhilePending = false;

export type NewRoomInput = {
  laboratoryId?: string;
  name?: string;
  code?: string;
};

export type NewLaboratoryInput = {
  name?: string;
  code?: string;
  roomName?: string;
  roomCode?: string;
};

type EditorState = {
  project: Project;
  hydrated: boolean;
  selectedIds: string[];
  hoveredId: string | null;
  selectedLocationId: string | null;
  tool: EditorTool;
  wallDrawKind: "full" | "half";
  panel: InspectorPanel;
  dialog: AppDialog;
  zoom: number;
  pan: { x: number; y: number };
  gridEnabled: boolean;
  snapEnabled: boolean;
  gridSize: number;
  snapTolerance: number;
  measurementOverlays: Record<MeasurementOverlayKey, boolean>;
  cursor: { x: number; y: number };
  guides: AlignmentGuide[];
  cameraPreset: CameraPreset;
  presentation: "2d" | "split" | "3d";
  floorVisible: boolean;
  wallTransparent: boolean;
  environmentContextVisible: boolean;
  spatialFocus: SpatialFocusRequest | null;
  digitalTwinSelectedRecordId: string | null;
  digitalTwinSpatialMode: "3d" | "2d";
  pendingAgentChange: PendingAgentChange | null;
  history: EditorCommand[];
  future: EditorCommand[];
  clipboard: SceneObject[];
  saveStatus: SaveStatus;
  persistenceMode: "server" | "browser";
  saveError: string | null;
  dirtyRevision: number;
  versions: RoomVersion[];
  toasts: Toast[];
  assetSearch: string;
  favorites: string[];
  curatedAssetIds: string[];
  indexFilter: "all" | "occupied" | "empty" | "unassigned";
  hydrate: () => Promise<void>;
  setTool: (tool: EditorTool) => void;
  setWallDrawKind: (kind: "full" | "half") => void;
  setPanel: (panel: InspectorPanel) => void;
  setDialog: (dialog: AppDialog) => void;
  setSelected: (ids: string[], additive?: boolean) => void;
  setHovered: (id: string | null) => void;
  setSelectedLocation: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setCursor: (cursor: { x: number; y: number }) => void;
  setGuides: (guides: AlignmentGuide[]) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setGridSize: (size: number) => void;
  setSnapTolerance: (value: number) => void;
  toggleMeasurementOverlay: (key: MeasurementOverlayKey) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setCameraPose: (pose: RoomViewState["cameraPose"]) => void;
  applySpatialFocus: (focus: SpatialFocusRequest) => boolean;
  setSpatialStorageAccess: (open: boolean) => void;
  setDigitalTwinSelectedRecord: (recordId: string | null) => void;
  setDigitalTwinSpatialMode: (mode: "3d" | "2d") => void;
  setPresentation: (mode: EditorState["presentation"]) => void;
  toggleFloor: () => void;
  toggleWalls: () => void;
  toggleEnvironmentContext: () => void;
  addAsset: (
    assetId: string,
    position?: Partial<Vector3>,
    transform?: AssetTransformOverrides,
  ) => string | null;
  addWall: (start: { x: number; y: number }, end: { x: number; y: number }) => string;
  addRoomRectangle: (start: PlanPoint, end: PlanPoint) => boolean;
  addAnnexPath: (points: PlanPoint[]) => boolean;
  previewObject: (id: string, patch: Partial<SceneObject>) => void;
  previewObjects: (objects: SceneObject[], roomSize?: RoomPlanSize) => void;
  commitPreview: (before: SceneObject, label: string) => void;
  commitPreviewBatch: (before: SceneObject[], label: string, beforeRoomSize?: RoomPlanSize) => void;
  updateObject: (id: string, patch: Partial<SceneObject>, label?: string) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  undo: () => void;
  redo: () => void;
  toggleLayer: (id: string, key: "visible" | "locked") => void;
  updateLayer: (id: string, patch: Partial<Layer>) => void;
  addLayer: () => void;
  deleteLayer: (id: string) => void;
  updateRoom: (patch: Partial<Room>) => void;
  initializeStorageForObject: (objectId: string) => void;
  completeRoomStorage: (roomId?: string) => void;
  addStorageChild: (parentId: string, type: StorageLocationType, roomId?: string) => string | null;
  removeStorageLocation: (id: string, roomId?: string) => void;
  updateStorageLocation: (id: string, patch: Partial<StorageLocation>, roomId?: string) => void;
  renameStorageLocation: (roomId: string, locationId: string, name: string) => boolean;
  assignInventoryItems: (
    items: InventoryReference[],
    roomId: string,
    locationId: string | null,
  ) => boolean;
  bindStorageAnatomy: (id: string, anatomyKey: string | null, roomId?: string) => void;
  addInventoryItem: (locationId: string | null, name?: string) => void;
  updateInventoryItem: (id: string, patch: Partial<InventoryItem>) => void;
  removeInventoryItem: (id: string) => void;
  addInventoryItemToRoom: (
    roomId: string,
    locationId: string | null,
    item?: Partial<InventoryItem>,
  ) => string | null;
  updateInventoryItemInRoom: (roomId: string, id: string, patch: Partial<InventoryItem>) => void;
  moveInventoryItemToRoom: (sourceRoomId: string, id: string, targetRoomId: string) => boolean;
  removeInventoryItemFromRoom: (roomId: string, id: string) => void;
  updateEquipmentRecord: (id: string, patch: Partial<EquipmentRecord>) => void;
  applyReindex: (changes: ReindexChange[]) => void;
  saveNow: () => Promise<void>;
  saveVersion: (name: string, note?: string) => Promise<void>;
  loadVersions: () => Promise<void>;
  restoreVersion: (id: string) => Promise<void>;
  duplicateVersionToRoom: (id: string) => Promise<void>;
  replaceProject: (project: Project) => void;
  renameProject: (name: string) => void;
  renameLaboratory: (laboratoryId: string, name: string, code: string) => boolean;
  renameRoom: (roomId: string, name: string, code: string) => boolean;
  switchRoom: (roomId: string) => void;
  createLaboratory: (input?: NewLaboratoryInput) => string | null;
  createRoom: (input?: NewRoomInput) => string | null;
  deleteLaboratory: (laboratoryId: string) => boolean;
  deleteRoom: (roomId: string) => boolean;
  duplicateRoom: () => void;
  duplicateRoomAsDemo: (roomId?: string) => string | null;
  createDemoFromTemplate: () => string | null;
  openLatestDemoRoom: () => string | null;
  setFeaturedDemoRoom: (roomId: string) => boolean;
  saveAsDemoRoom: () => Promise<void>;
  resetActiveDemoFromTemplate: () => boolean;
  updateRoomFacilityPlacement: (
    roomId: string,
    patch: Partial<NonNullable<Room["facilityPlacement"]>>,
  ) => void;
  archiveAsset: (id: string) => boolean;
  restoreAsset: (id: string) => void;
  setAssetSearch: (value: string) => void;
  toggleFavorite: (id: string) => void;
  toggleCuratedAsset: (id: string) => void;
  setIndexFilter: (value: EditorState["indexFilter"]) => void;
  pushToast: (message: string, tone?: Toast["tone"]) => void;
  removeToast: (id: string) => void;
};

function readStoredStringArray(key: string) {
  if (typeof localStorage === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function writeStoredStringArray(key: string, value: string[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Favorites remain usable for the current session when browser storage is
    // blocked or full; persistence is a progressive enhancement here.
  }
}

function writeStoredBoolean(key: string, value: boolean) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, String(value));
}

function activeRoom(project: Project): Room {
  return project.rooms.find((room) => room.id === project.activeRoomId) ?? project.rooms[0];
}

function suggestedFacilityPlacement(project: Project, laboratoryId: string) {
  const rooms = project.rooms.filter(
    (room) => room.laboratoryId === laboratoryId && room.roomKind !== "demo-template",
  );
  const index = rooms.length;
  const column = index % 3;
  const row = Math.floor(index / 3);
  return {
    floor: 0,
    x: column * 13_000,
    y: row * 11_000,
    rotation: 0,
  };
}

const DEFAULT_ROOM_VIEW_STATE: RoomViewState = {
  cameraPreset: "isometric",
  presentation: "split",
  floorVisible: true,
  wallTransparent: false,
  environmentContextVisible: false,
  cameraPose: null,
};

function resolvedRoomViewState(room: Room): RoomViewState {
  return { ...DEFAULT_ROOM_VIEW_STATE, ...room.viewState };
}

function activeLaboratoryCode(project: Project, room: Room) {
  return (
    project.laboratories.find((laboratory) => laboratory.id === room.laboratoryId)?.code ??
    project.laboratories[0]?.code ??
    "LAB"
  );
}

function nextAvailableCode(existingCodes: readonly string[], prefix: string, pad: number) {
  const normalized = new Set(existingCodes.map((code) => code.trim().toLocaleUpperCase()));
  let index = 1;
  while (normalized.has(`${prefix}${String(index).padStart(pad, "0")}`)) index += 1;
  return `${prefix}${String(index).padStart(pad, "0")}`;
}

function roomSwitchState(project: Project) {
  const viewState = resolvedRoomViewState(activeRoom(project));
  return {
    project,
    selectedIds: [],
    selectedLocationId: null,
    hoveredId: null,
    history: [],
    future: [],
    versions: [],
    guides: [],
    tool: "select" as const,
    wallDrawKind: "full" as const,
    panel: "room" as const,
    pan: { x: 0, y: 0 },
    zoom: 1,
    cameraPreset: viewState.cameraPreset,
    presentation: viewState.presentation,
    floorVisible: viewState.floorVisible,
    wallTransparent: viewState.wallTransparent,
    environmentContextVisible: viewState.environmentContextVisible,
    spatialFocus: null,
    digitalTwinSelectedRecordId: null,
    digitalTwinSpatialMode: "3d" as const,
  };
}

function replaceRoom(project: Project, room: Room): Project {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    rooms: project.rooms.map((entry) => (entry.id === room.id ? room : entry)),
  };
}

function roomWithScene(room: Room, scene: Scene): Room {
  const now = new Date().toISOString();
  return { ...room, scene, updatedAt: now };
}

function projectWithRoomViewState(project: Project, patch: Partial<RoomViewState>): Project {
  const room = activeRoom(project);
  const now = new Date().toISOString();
  return replaceRoom(project, {
    ...room,
    viewState: { ...resolvedRoomViewState(room), ...patch },
    updatedAt: now,
  });
}

function cloneRoomFromScene(
  room: Room,
  sourceScene: Scene,
  name: string,
  code: string,
  shellOnly = false,
): Room {
  const now = new Date().toISOString();
  const roomId = crypto.randomUUID();
  const sourceObjects = shellOnly
    ? sourceScene.objects.filter((object) => object.objectType === "wall")
    : sourceScene.objects;
  const objectIds = new Map<string, string>(
    sourceObjects.map((object) => [object.id, crypto.randomUUID()]),
  );
  const zoneIds = new Map<string, string>(
    sourceScene.zones.map((zone) => [zone.id, crypto.randomUUID()]),
  );
  const locationSource = sourceScene.storageLocations.filter((location) =>
    objectIds.has(location.objectId),
  );
  const locationIds = new Map<string, string>(
    locationSource.map((location) => [location.id, crypto.randomUUID()]),
  );
  const locations = locationSource.map((location) => ({
    ...location,
    id: locationIds.get(location.id)!,
    roomId,
    objectId: objectIds.get(location.objectId)!,
    parentId: location.parentId ? (locationIds.get(location.parentId) ?? null) : null,
    childIds: location.childIds
      .map((id) => locationIds.get(id))
      .filter((id): id is string => Boolean(id)),
    createdAt: now,
    updatedAt: now,
  }));
  const objects = sourceObjects.map((object) => ({
    ...structuredClone(object),
    id: objectIds.get(object.id)!,
    roomId,
    zoneId: object.zoneId ? (zoneIds.get(object.zoneId) ?? null) : null,
    parentObjectId: object.parentObjectId ? (objectIds.get(object.parentObjectId) ?? null) : null,
    childLocationIds: object.childLocationIds
      .map((id) => locationIds.get(id))
      .filter((id): id is string => Boolean(id)),
    opening:
      object.opening && objectIds.has(object.opening.wallId)
        ? { ...object.opening, wallId: objectIds.get(object.opening.wallId)! }
        : undefined,
    createdAt: now,
    updatedAt: now,
  }));
  return {
    ...structuredClone(room),
    id: roomId,
    name,
    code,
    roomKind: "standard",
    demoSavedAt: null,
    scene: {
      ...structuredClone(sourceScene),
      id: crypto.randomUUID(),
      roomId,
      objects,
      zones: sourceScene.zones.map((zone) => ({ ...zone, id: zoneIds.get(zone.id)!, roomId })),
      storageLocations: locations,
      inventoryItems: shellOnly
        ? []
        : sourceScene.inventoryItems.map((item) => ({
            ...item,
            id: crypto.randomUUID(),
            storageLocationId: item.storageLocationId
              ? (locationIds.get(item.storageLocationId) ?? null)
              : null,
            createdAt: now,
            updatedAt: now,
          })),
      equipmentRecords: shellOnly
        ? []
        : sourceScene.equipmentRecords
            .filter((record) => objectIds.has(record.objectId))
            .map((record) => ({
              ...record,
              id: crypto.randomUUID(),
              objectId: objectIds.get(record.objectId)!,
            })),
      labelTemplates: sourceScene.labelTemplates.map((template) => ({
        ...template,
        id: crypto.randomUUID(),
      })),
      updatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function factoryDemoTemplate(): Room | null {
  return createSeedProject().rooms.find((room) => room.roomKind === "demo-template") ?? null;
}

function retargetClonedRoom(clone: Room, target: Room): Room {
  const now = new Date().toISOString();
  return {
    ...clone,
    id: target.id,
    laboratoryId: target.laboratoryId,
    name: target.name,
    code: target.code,
    roomKind: "demo",
    demoSavedAt: now,
    environmentProfileId: null,
    viewState: { ...DEFAULT_ROOM_VIEW_STATE },
    scene: {
      ...clone.scene,
      roomId: target.id,
      objects: clone.scene.objects.map((object) => ({ ...object, roomId: target.id })),
      zones: clone.scene.zones.map((zone) => ({ ...zone, roomId: target.id })),
      storageLocations: clone.scene.storageLocations.map((location) => ({
        ...location,
        roomId: target.id,
      })),
      updatedAt: now,
    },
    createdAt: target.createdAt,
    updatedAt: now,
  };
}

function commandId() {
  return crypto.randomUUID();
}

function createWallObject(
  project: Project,
  room: Room,
  start: PlanPoint,
  end: PlanPoint,
  kind: "full" | "half",
  options: WallFactoryOptions = {},
): SceneObject {
  const halfHeight = kind === "half";
  const definition = getAssetDefinition(halfHeight ? "half-height-wall" : "straight-wall");
  const template = options.template;
  const now = new Date().toISOString();
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const thickness = template?.wall?.thickness ?? definition.defaultDimensions.depth;
  const height =
    template?.wall?.height ?? (halfHeight ? Math.min(1200, room.wallHeight) : room.wallHeight);
  const laboratoryCode = activeLaboratoryCode(project, room);
  return {
    id: crypto.randomUUID(),
    indexCode: generateObjectIndexCode(
      room,
      room.scene,
      definition.objectType,
      room.scene.zones[0]?.id ?? null,
      laboratoryCode,
    ),
    name: options.name ?? definition.name,
    assetDefinitionId: halfHeight ? definition.id : (template?.assetDefinitionId ?? definition.id),
    objectType: definition.objectType,
    position: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2, z: 0 },
    dimensions: { width: length, depth: thickness, height },
    rotation: {
      x: 0,
      y: 0,
      z: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI,
    },
    flipHorizontal: false,
    flipVertical: false,
    layerId:
      template?.layerId ?? resolveLayerIdForObjectType(room.scene.layers, definition.objectType),
    roomId: room.id,
    spaceId: options.spaceId ?? template?.spaceId,
    zoneId: template?.zoneId ?? room.scene.zones[0]?.id ?? null,
    locked: false,
    visible: true,
    metadata: structuredClone(template?.metadata ?? {}),
    createdAt: now,
    updatedAt: now,
    parentObjectId: null,
    childLocationIds: [],
    zIndex: Math.max(0, ...room.scene.objects.map((entry) => entry.zIndex)) + 1,
    wall: { start: { ...start }, end: { ...end }, thickness, height, halfHeight },
  };
}

function createRoomWallFactory(project: Project, room: Room, kind: "full" | "half") {
  let stagedObjects = [...room.scene.objects];

  return (start: PlanPoint, end: PlanPoint, options: WallFactoryOptions = {}) => {
    const stagedRoom: Room = {
      ...room,
      scene: {
        ...room.scene,
        objects: stagedObjects,
      },
    };
    const wall = createWallObject(project, stagedRoom, start, end, kind, options);
    stagedObjects = [...stagedObjects, wall];
    return wall;
  };
}

function defaultEquipment(
  object: SceneObject,
  existingRecords: readonly EquipmentRecord[],
): EquipmentRecord {
  return {
    id: crypto.randomUUID(),
    objectId: object.id,
    equipmentId: deriveDefaultEquipmentId(object, existingRecords),
    name: object.name,
    manufacturer: "",
    model: "",
    serialNumber: "",
    status: "active",
    responsiblePerson: "",
    lastServiceDate: null,
    nextServiceDate: null,
    powerRequirements: "",
    waterRequirements: "None",
    gasRequirements: "None",
    drainRequired: false,
    ventilationRequired: false,
    notes: "",
  };
}

function defaultStorageLocations(
  definition: AssetDefinition,
  object: SceneObject,
  roomId: string,
  now: string,
): StorageLocation[] {
  const root: StorageLocation = {
    id: crypto.randomUUID(),
    roomId,
    objectId: object.id,
    parentId: null,
    type: "cabinet",
    name: object.name,
    indexCode: object.indexCode,
    order: 0,
    capacityNotes: "",
    childIds: [],
    createdAt: now,
    updatedAt: now,
  };
  const locations: StorageLocation[] = [root];
  const byTemplateKey = new Map<string, StorageLocation>();

  for (const entry of definition.storageTemplate ?? []) {
    const parent = entry.parentKey ? byTemplateKey.get(entry.parentKey) : root;
    if (!parent) continue;
    const siblings = locations.filter(
      (location) => location.parentId === parent.id && location.type === entry.type,
    );
    const location: StorageLocation = {
      id: crypto.randomUUID(),
      roomId,
      objectId: object.id,
      parentId: parent.id,
      type: entry.type,
      name: entry.name,
      indexCode: generateChildIndexCode(parent, entry.type, locations),
      order: siblings.length,
      capacityNotes: entry.capacityNotes ?? "",
      childIds: [],
      normalizedBounds: entry.normalizedBounds,
      anatomyKey: entry.anatomyKey,
      createdAt: now,
      updatedAt: now,
    };
    parent.childIds.push(location.id);
    locations.push(location);
    byTemplateKey.set(entry.key, location);
  }

  object.childLocationIds = [root.id];
  return locations;
}

function updateSceneInProject(
  project: Project,
  updater: (scene: Scene, room: Room) => Scene,
): Project {
  const room = activeRoom(project);
  return replaceRoom(project, roomWithScene(room, updater(room.scene, room)));
}

function applyHistoryCommandToProject(
  project: Project,
  command: EditorCommand,
  direction: "apply" | "revert",
) {
  if (
    command.kind === "inventory-creation" ||
    command.kind === "inventory-assignment" ||
    command.kind === "storage-name"
  )
    return applyOrganizationCommand(project, command, direction);
  const room =
    command.kind === "scene" && command.roomId
      ? project.rooms.find(
          (entry) => entry.id === command.roomId && entry.roomKind !== "demo-template",
        )
      : activeRoom(project);
  if (!room) throw new Error("The room for this change is no longer available.");
  const roomSize =
    command.kind === "batch" || command.kind === "scene"
      ? direction === "apply"
        ? command.roomAfter
        : command.roomBefore
      : undefined;
  const scene =
    direction === "apply" ? applyCommand(room.scene, command) : revertCommand(room.scene, command);
  return replaceRoom(project, roomWithScene({ ...room, ...roomSize }, scene));
}

function editableStorageRoom(state: EditorState, roomId = state.project.activeRoomId) {
  if (state.pendingAgentChange) {
    state.pushToast("Approve or cancel the agent preview first.", "info");
    return null;
  }
  return (
    state.project.rooms.find((room) => room.id === roomId && room.roomKind !== "demo-template") ??
    null
  );
}

function storageSceneChange(state: EditorState, room: Room, after: Scene, label: string) {
  const command: SceneCommand = {
    id: commandId(),
    kind: "scene",
    scope: "storage",
    roomId: room.id,
    label,
    before: room.scene,
    after,
  };
  return {
    project: replaceRoom(state.project, roomWithScene(room, after)),
    history: [...state.history, command],
    future: [],
    saveStatus: "unsaved" as const,
    dirtyRevision: state.dirtyRevision + 1,
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: createSeedProject(),
  hydrated: false,
  selectedIds: [],
  hoveredId: null,
  selectedLocationId: null,
  tool: "select",
  wallDrawKind: "full",
  panel: "room",
  dialog: null,
  zoom: 1,
  pan: { x: 0, y: 0 },
  gridEnabled: true,
  snapEnabled: true,
  gridSize: 200,
  snapTolerance: 80,
  measurementOverlays: {
    overall: true,
    walls: false,
    openings: false,
    clearance: false,
  },
  cursor: { x: 0, y: 0 },
  guides: [],
  cameraPreset: "isometric",
  presentation: "split",
  floorVisible: true,
  wallTransparent: false,
  environmentContextVisible: false,
  spatialFocus: null,
  digitalTwinSelectedRecordId: null,
  digitalTwinSpatialMode: "3d",
  pendingAgentChange: null,
  history: [],
  future: [],
  clipboard: [],
  saveStatus: "loading",
  persistenceMode: "server",
  saveError: null,
  dirtyRevision: 0,
  versions: [],
  toasts: [],
  assetSearch: "",
  favorites: readStoredStringArray("labspace-favorites"),
  curatedAssetIds: readStoredStringArray("labspace-curated-assets"),
  indexFilter: "all",

  hydrate: () => {
    if (get().hydrated) return Promise.resolve();
    if (pendingHydration) return pendingHydration;
    pendingHydration = (async () => {
      try {
        const layeredProject = ensureProjectLayers(await loadProject());
        const rooms = layeredProject.rooms.map((room) => normalizeRoomFloorEnvelope(room));
        const repairedFloorEnvelope = rooms.some(
          (room, index) => room !== layeredProject.rooms[index],
        );
        const normalizedProject = repairedFloorEnvelope
          ? { ...layeredProject, rooms, updatedAt: new Date().toISOString() }
          : layeredProject;
        const activeCandidate = normalizedProject.rooms.find(
          (room) => room.id === normalizedProject.activeRoomId,
        );
        const fallbackRoom = normalizedProject.rooms.find(
          (room) => room.roomKind !== "demo-template",
        );
        const project =
          activeCandidate?.roomKind === "demo-template" && fallbackRoom
            ? { ...normalizedProject, activeRoomId: fallbackRoom.id }
            : normalizedProject;
        set({
          ...roomSwitchState(project),
          hydrated: true,
          persistenceMode: getPersistenceMode(),
          saveStatus: repairedFloorEnvelope ? "unsaved" : "saved",
          saveError: null,
          dirtyRevision: repairedFloorEnvelope ? 1 : 0,
        });
      } catch (error) {
        set({
          hydrated: true,
          persistenceMode: getPersistenceMode(),
          saveStatus: "error",
          saveError: error instanceof Error ? error.message : "Unable to load saved project.",
        });
        get().pushToast(
          "Saved project could not be opened. No saved data was replaced. Saving is blocked until it can be loaded.",
          "error",
        );
      } finally {
        pendingHydration = null;
      }
    })();
    return pendingHydration;
  },
  setTool: (tool) => set({ tool, guides: [] }),
  setWallDrawKind: (wallDrawKind) => set({ wallDrawKind, tool: "wall", guides: [] }),
  setPanel: (panel) => set({ panel }),
  setDialog: (dialog) => set({ dialog }),
  setSelected: (ids, additive = false) =>
    set((state) => ({
      selectedIds: additive ? Array.from(new Set([...state.selectedIds, ...ids])) : ids,
      panel: ids.length ? "properties" : state.panel,
      ...(!additive && !ids.length
        ? {
            selectedLocationId: null,
            spatialFocus: null,
            digitalTwinSelectedRecordId: null,
            hoveredId: null,
          }
        : {}),
    })),
  setHovered: (hoveredId) => set({ hoveredId }),
  setSelectedLocation: (selectedLocationId) => {
    const room = activeRoom(get().project);
    const location = room.scene.storageLocations.find((entry) => entry.id === selectedLocationId);
    set({
      selectedLocationId,
      selectedIds: location ? [location.objectId] : get().selectedIds,
      panel: "index",
    });
  },
  setZoom: (zoom) => set({ zoom: Math.min(3.2, Math.max(0.35, zoom)) }),
  setPan: (pan) => set({ pan }),
  setCursor: (cursor) => set({ cursor }),
  setGuides: (guides) => set({ guides }),
  toggleGrid: () => set((state) => ({ gridEnabled: !state.gridEnabled })),
  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
  setGridSize: (gridSize) => set({ gridSize }),
  setSnapTolerance: (snapTolerance) => set({ snapTolerance }),
  toggleMeasurementOverlay: (key) =>
    set((state) => ({
      measurementOverlays: {
        ...state.measurementOverlays,
        [key]: !state.measurementOverlays[key],
      },
    })),
  setCameraPreset: (cameraPreset) =>
    set((state) => ({
      project: projectWithRoomViewState(state.project, { cameraPreset, cameraPose: null }),
      cameraPreset,
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    })),
  setCameraPose: (cameraPose) =>
    set((state) => ({
      project: projectWithRoomViewState(state.project, { cameraPose }),
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    })),
  applySpatialFocus: (focus) => {
    const state = get();
    const room = state.project.rooms.find(
      (entry) => entry.id === focus.roomId && entry.roomKind !== "demo-template",
    );
    const object = room?.scene.objects.find((entry) => entry.id === focus.objectId);
    const location = focus.locationId
      ? room?.scene.storageLocations.find(
          (entry) => entry.id === focus.locationId && entry.objectId === focus.objectId,
        )
      : null;
    if (!room || !object || (focus.locationId && !location)) return false;

    const project =
      state.project.activeRoomId === room.id
        ? state.project
        : { ...state.project, activeRoomId: room.id };
    const switched = state.project.activeRoomId !== room.id;
    set({
      ...(switched ? roomSwitchState(project) : {}),
      project,
      selectedIds: [object.id],
      selectedLocationId: location?.id ?? null,
      panel: location ? "index" : "properties",
      cameraPreset: "isometric",
      presentation: state.presentation === "2d" ? "split" : state.presentation,
      spatialFocus: focus,
      digitalTwinSelectedRecordId: focus.recordId,
      digitalTwinSpatialMode: "3d",
    });
    return true;
  },
  setSpatialStorageAccess: (open) =>
    set((state) => ({
      spatialFocus: state.spatialFocus ? { ...state.spatialFocus, showStorageAccess: open } : null,
    })),
  setDigitalTwinSelectedRecord: (digitalTwinSelectedRecordId) =>
    set({ digitalTwinSelectedRecordId }),
  setDigitalTwinSpatialMode: (digitalTwinSpatialMode) => set({ digitalTwinSpatialMode }),
  setPresentation: (presentation) =>
    set((state) => ({
      project: projectWithRoomViewState(state.project, { presentation }),
      presentation,
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    })),
  toggleFloor: () =>
    set((state) => {
      const floorVisible = !state.floorVisible;
      return {
        project: projectWithRoomViewState(state.project, { floorVisible }),
        floorVisible,
        saveStatus: "unsaved",
        dirtyRevision: state.dirtyRevision + 1,
      };
    }),
  toggleWalls: () =>
    set((state) => {
      const wallTransparent = !state.wallTransparent;
      return {
        project: projectWithRoomViewState(state.project, { wallTransparent }),
        wallTransparent,
        saveStatus: "unsaved",
        dirtyRevision: state.dirtyRevision + 1,
      };
    }),
  toggleEnvironmentContext: () =>
    set((state) => {
      const environmentContextVisible = !state.environmentContextVisible;
      writeStoredBoolean(LAB_ENVIRONMENT_CONTEXT_VISIBILITY_KEY, environmentContextVisible);
      return {
        project: projectWithRoomViewState(state.project, { environmentContextVisible }),
        environmentContextVisible,
        saveStatus: "unsaved",
        dirtyRevision: state.dirtyRevision + 1,
      };
    }),

  addAsset: (assetId, position = {}, transform = {}) => {
    const definition = getAssetDefinition(assetId);
    const state = get();
    const room = activeRoom(state.project);
    const now = new Date().toISOString();
    const defaultElevation = ["wall-cabinet", "glass-wall-cabinet"].includes(definition.id)
      ? 1400
      : definition.id === "pegboard"
        ? 1200
        : 0;
    let object: SceneObject = {
      id: crypto.randomUUID(),
      indexCode: generateObjectIndexCode(
        room,
        room.scene,
        definition.objectType,
        room.scene.zones[0]?.id ?? null,
        activeLaboratoryCode(state.project, room),
      ),
      name: definition.name,
      assetDefinitionId: assetId,
      objectType: definition.objectType,
      position: {
        x: position.x ?? room.width / 2,
        y: position.y ?? room.depth / 2,
        z: position.z ?? defaultElevation,
      },
      dimensions: transform.dimensions ?? definition.defaultDimensions,
      rotation: transform.rotation ?? { x: 0, y: 0, z: 0 },
      flipHorizontal: transform.flipHorizontal ?? false,
      flipVertical: transform.flipVertical ?? false,
      layerId: resolveLayerIdForObjectType(room.scene.layers, definition.objectType),
      roomId: room.id,
      zoneId: room.scene.zones[0]?.id ?? null,
      locked: false,
      visible: true,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      parentObjectId: null,
      childLocationIds: [],
      zIndex: Math.max(0, ...room.scene.objects.map((entry) => entry.zIndex)) + 1,
    };
    if (state.snapEnabled) object = snapChairToDesk(room, object);
    if (requiresBenchSupport(object)) object = alignBenchObjectToCurrentSupport(room, object);
    if (definition.objectType === "door" || definition.objectType === "window") {
      object.opening = transform.opening;
      const projection = findNearestWallProjection(
        room.scene.objects,
        object.position,
        object.dimensions.width,
        600,
      );
      if (!projection) {
        state.pushToast(`Place ${definition.shortName.toLowerCase()} directly on a wall.`, "info");
        return null;
      }
      Object.assign(object, hostOpeningAtPoint(object, projection));
      if (
        openingOverlapsSibling(
          room.scene.objects,
          projection.wall.id,
          projection.offset,
          object.dimensions.width,
        )
      ) {
        state.pushToast("That wall position overlaps another opening.", "error");
        return null;
      }
    }
    const command: SceneCommand = {
      id: commandId(),
      label: `Add ${definition.name}`,
      kind: "add",
      after: object,
    };
    const nextProject = updateSceneInProject(state.project, (scene) => {
      let next = applyCommand(scene, command);
      if (definition.indexingBehavior === "storage") {
        const storageLocations = defaultStorageLocations(definition, object, room.id, now);
        next = {
          ...next,
          objects: next.objects.map((entry) => (entry.id === object.id ? object : entry)),
          storageLocations: [...next.storageLocations, ...storageLocations],
        };
      }
      if (definition.objectType === "equipment")
        next = {
          ...next,
          equipmentRecords: [
            ...next.equipmentRecords,
            defaultEquipment(object, next.equipmentRecords),
          ],
        };
      return next;
    });
    set({
      project: nextProject,
      selectedIds: [object.id],
      history: [...state.history, command],
      future: [],
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
    return object.id;
  },

  addWall: (start, end) => {
    const state = get();
    const room = activeRoom(state.project);
    const halfHeight = state.wallDrawKind === "half";
    const object = createWallObject(state.project, room, start, end, halfHeight ? "half" : "full");
    let command: SceneCommand = {
      id: commandId(),
      label: halfHeight ? "Draw half wall" : "Draw wall",
      kind: "add",
      after: object,
    };
    const provisionalScene = applyCommand(room.scene, command);
    const hadClosedFloor = Boolean(
      getClosedWallFloorPolygon(
        room.scene.objects.filter((entry) => entry.wall && !entry.wall.halfHeight),
      ),
    );
    const normalizedRoom =
      halfHeight || hadClosedFloor
        ? null
        : normalizeClosedRoomFromWallLoop(provisionalScene.objects);
    let nextProject: Project;
    if (normalizedRoom) {
      const primary = room.spaces.find((space) => space.kind === "primary") ?? room.spaces[0];
      const spaces = room.spaces.map((space) =>
        space.id === primary?.id
          ? { ...space, wallIds: normalizedRoom.floorPolygon.wallIds }
          : space,
      );
      command = {
        id: command.id,
        label: "Close room outline",
        kind: "batch",
        before: room.scene.objects,
        after: normalizedRoom.objects,
        roomBefore: { width: room.width, depth: room.depth, spaces: room.spaces },
        roomAfter: { width: normalizedRoom.width, depth: normalizedRoom.depth, spaces },
      };
      nextProject = replaceRoom(
        state.project,
        roomWithScene(
          { ...room, width: normalizedRoom.width, depth: normalizedRoom.depth, spaces },
          { ...provisionalScene, objects: normalizedRoom.objects },
        ),
      );
    } else {
      nextProject = replaceRoom(state.project, roomWithScene(room, provisionalScene));
    }
    set({
      project: nextProject,
      selectedIds: [object.id],
      history: [...state.history, command],
      future: [],
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
    return object.id;
  },

  addRoomRectangle: (start, end) => {
    const state = get();
    if (state.pendingAgentChange) {
      state.pushToast("Approve or cancel the agent preview before editing the layout.", "info");
      return false;
    }
    const room = activeRoom(state.project);
    try {
      const createWall = createRoomWallFactory(state.project, room, "full");
      const change = buildRoomRectangle(room, start, end, createWall);
      const command: SceneCommand = {
        id: commandId(),
        kind: "scene",
        roomId: room.id,
        label: change.annexSpaceId ? "Draw connected annex" : "Draw rectangular room",
        before: room.scene,
        after: change.room.scene,
        roomBefore: {
          width: room.width,
          depth: room.depth,
          wallHeight: room.wallHeight,
          spaces: room.spaces,
        },
        roomAfter: {
          width: change.room.width,
          depth: change.room.depth,
          wallHeight: change.room.wallHeight,
          spaces: change.room.spaces,
        },
      };
      set({
        project: replaceRoom(state.project, change.room),
        selectedIds: change.createdWallIds,
        history: [...state.history, command],
        future: [],
        saveStatus: "unsaved",
        dirtyRevision: state.dirtyRevision + 1,
      });
      state.pushToast(
        change.annexSpaceId
          ? "Connected annex created as an independent room space."
          : "Rectangular room created. Drag from one corner to the opposite corner.",
        "success",
      );
      return true;
    } catch (error) {
      state.pushToast(
        error instanceof Error ? error.message : "The room could not be created.",
        "error",
      );
      return false;
    }
  },

  addAnnexPath: (points) => {
    const state = get();
    if (state.pendingAgentChange) {
      state.pushToast("Approve or cancel the agent preview before editing the layout.", "info");
      return false;
    }
    const room = activeRoom(state.project);
    try {
      const createWall = createRoomWallFactory(state.project, room, "full");
      const change = buildConnectedAnnex(room, points, createWall);
      const command: SceneCommand = {
        id: commandId(),
        kind: "scene",
        roomId: room.id,
        label: "Draw connected annex",
        before: room.scene,
        after: change.room.scene,
        roomBefore: {
          width: room.width,
          depth: room.depth,
          wallHeight: room.wallHeight,
          spaces: room.spaces,
        },
        roomAfter: {
          width: change.room.width,
          depth: change.room.depth,
          wallHeight: change.room.wallHeight,
          spaces: change.room.spaces,
        },
      };
      set({
        project: replaceRoom(state.project, change.room),
        selectedIds: change.createdWallIds,
        history: [...state.history, command],
        future: [],
        saveStatus: "unsaved",
        dirtyRevision: state.dirtyRevision + 1,
      });
      state.pushToast("Connected annex created as an independent room space.", "success");
      return true;
    } catch (error) {
      state.pushToast(
        error instanceof Error ? error.message : "The annex could not be created.",
        "error",
      );
      return false;
    }
  },

  previewObject: (id, patch) =>
    set((state) => ({
      project: updateSceneInProject(state.project, (scene) => ({
        ...scene,
        objects: scene.objects.map((object) =>
          object.id === id ? { ...object, ...patch, updatedAt: new Date().toISOString() } : object,
        ),
        updatedAt: new Date().toISOString(),
      })),
    })),
  previewObjects: (objects, roomSize) =>
    set((state) => {
      const room = activeRoom(state.project);
      const replacements = new Map(objects.map((object) => [object.id, object]));
      return {
        project: replaceRoom(
          state.project,
          roomWithScene(
            { ...room, ...roomSize },
            {
              ...room.scene,
              objects: room.scene.objects.map((object) => replacements.get(object.id) ?? object),
              updatedAt: new Date().toISOString(),
            },
          ),
        ),
      };
    }),
  commitPreview: (before, label) => {
    const state = get();
    const after = activeRoom(state.project).scene.objects.find((object) => object.id === before.id);
    if (!after || JSON.stringify(before) === JSON.stringify(after)) return;
    const command: SceneCommand = {
      id: commandId(),
      label,
      kind: "update",
      objectId: before.id,
      before,
      after,
    };
    set({
      history: [...state.history, command],
      future: [],
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
  },
  commitPreviewBatch: (before, label, beforeRoomSize) => {
    const state = get();
    const currentRoom = activeRoom(state.project);
    const currentObjects = currentRoom.scene.objects;
    const currentById = new Map(currentObjects.map((object) => [object.id, object]));
    const changedBefore = before.filter((object) => {
      const after = currentById.get(object.id);
      return after && JSON.stringify(object) !== JSON.stringify(after);
    });
    const roomSizeChanged = Boolean(
      beforeRoomSize &&
      (beforeRoomSize.width !== currentRoom.width || beforeRoomSize.depth !== currentRoom.depth),
    );
    if (!changedBefore.length && !roomSizeChanged) return;
    const command: SceneCommand = {
      id: commandId(),
      label,
      kind: "batch",
      before: changedBefore,
      after: changedBefore.map((object) => currentById.get(object.id)!),
      ...(roomSizeChanged
        ? {
            roomBefore: beforeRoomSize,
            roomAfter: { width: currentRoom.width, depth: currentRoom.depth },
          }
        : {}),
    };
    set({
      history: [...state.history, command],
      future: [],
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
  },
  updateObject: (id, patch, label = "Edit object") => {
    const state = get();
    if (state.pendingAgentChange) {
      state.pushToast("Approve or cancel the agent preview before editing the layout.", "info");
      return;
    }
    const room = activeRoom(state.project);
    const before = room.scene.objects.find((object) => object.id === id);
    if (!before) return;
    const normalizedPatch: Partial<SceneObject> = { ...patch };
    if (patch.position)
      normalizedPatch.position = {
        ...patch.position,
        z: normalizeRaisedFromFloorMm(patch.position.z, before.position.z),
      };
    if (patch.opening)
      normalizedPatch.opening = {
        ...patch.opening,
        sillHeight: normalizeRaisedFromFloorMm(
          patch.opening.sillHeight,
          before.opening?.sillHeight ?? 0,
        ),
      };
    let after: SceneObject = {
      ...before,
      ...normalizedPatch,
      updatedAt: new Date().toISOString(),
    };
    if (
      state.snapEnabled &&
      patch.position &&
      (patch.position.x !== before.position.x || patch.position.y !== before.position.y)
    )
      after = snapChairToDesk(room, after);
    if (
      requiresBenchSupport(after) &&
      patch.position &&
      (patch.position.x !== before.position.x || patch.position.y !== before.position.y)
    )
      after = alignBenchObjectToCurrentSupport(room, after);
    if (after.opening) {
      const resolved = resolveHostedOpening(after, room.scene.objects);
      if (resolved) after = { ...after, ...hostOpeningAtPoint(after, resolved) };
    }
    const codes = room.scene.objects
      .filter((entry) => entry.id !== id)
      .map((entry) => entry.indexCode);
    if (codes.includes(after.indexCode)) {
      state.pushToast(`Index code ${after.indexCode} is already in use.`, "error");
      return;
    }
    const command: SceneCommand = {
      id: commandId(),
      label,
      kind: "update",
      objectId: id,
      before,
      after,
    };
    set({
      project: updateSceneInProject(state.project, (scene) => applyCommand(scene, command)),
      history: [...state.history, command],
      future: [],
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
  },
  deleteSelected: () => {
    const state = get();
    if (state.pendingAgentChange) {
      state.pushToast("Approve or cancel the agent preview before editing the layout.", "info");
      return;
    }
    const room = activeRoom(state.project);
    const selected = new Set(state.selectedIds);
    const selectedWallIds = new Set(
      room.scene.objects
        .filter((object) => selected.has(object.id) && object.wall)
        .map((object) => object.id),
    );
    const retainedHostedOpening = room.scene.objects.find(
      (object) =>
        object.opening && selectedWallIds.has(object.opening.wallId) && !selected.has(object.id),
    );
    if (retainedHostedOpening) {
      state.pushToast(
        `Delete or select the hosted doors and windows before removing their wall.`,
        "error",
      );
      return;
    }
    const targets = room.scene.objects.filter(
      (object) => state.selectedIds.includes(object.id) && !object.locked,
    );
    if (!targets.length) return;
    const commands: SceneCommand[] = targets.map((before) => ({
      id: commandId(),
      label: `Delete ${before.name}`,
      kind: "delete",
      before,
    }));
    const next = updateSceneInProject(state.project, (scene) => {
      let result = scene;
      for (const command of commands) result = applyCommand(result, command);
      const deleted = new Set(targets.map((object) => object.id));
      const deletedLocations = new Set(
        result.storageLocations
          .filter((location) => deleted.has(location.objectId))
          .map((location) => location.id),
      );
      return {
        ...result,
        storageLocations: result.storageLocations.filter(
          (location) => !deletedLocations.has(location.id),
        ),
        inventoryItems: result.inventoryItems.map((item) =>
          item.storageLocationId && deletedLocations.has(item.storageLocationId)
            ? { ...item, storageLocationId: null }
            : item,
        ),
        equipmentRecords: result.equipmentRecords.filter((record) => !deleted.has(record.objectId)),
      };
    });
    set({
      project: next,
      selectedIds: [],
      history: [...state.history, ...commands],
      future: [],
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
  },
  duplicateSelected: () => {
    const state = get();
    if (state.pendingAgentChange) {
      state.pushToast("Approve or cancel the agent preview before editing the layout.", "info");
      return;
    }
    const originals = activeRoom(state.project).scene.objects.filter((object) =>
      state.selectedIds.includes(object.id),
    );
    const ids = originals.map((object) =>
      state.addAsset(
        object.assetDefinitionId,
        {
          x: object.position.x + 250,
          y: object.position.y + 250,
          z: object.position.z,
        },
        {
          dimensions: object.dimensions,
          rotation: object.rotation,
          flipHorizontal: object.flipHorizontal,
          flipVertical: object.flipVertical,
          opening: object.opening,
        },
      ),
    );
    set({ selectedIds: ids.filter((id): id is string => Boolean(id)) });
  },
  copySelected: () => {
    const state = get();
    set({
      clipboard: activeRoom(state.project).scene.objects.filter((object) =>
        state.selectedIds.includes(object.id),
      ),
    });
    state.pushToast(
      `${state.selectedIds.length} object${state.selectedIds.length === 1 ? "" : "s"} copied.`,
      "info",
    );
  },
  pasteClipboard: () => {
    const state = get();
    if (state.pendingAgentChange) {
      state.pushToast("Approve or cancel the agent preview before editing the layout.", "info");
      return;
    }
    const ids = state.clipboard.map((object) =>
      state.addAsset(
        object.assetDefinitionId,
        {
          x: object.position.x + 300,
          y: object.position.y + 300,
          z: object.position.z,
        },
        {
          dimensions: object.dimensions,
          rotation: object.rotation,
          flipHorizontal: object.flipHorizontal,
          flipVertical: object.flipVertical,
          opening: object.opening,
        },
      ),
    );
    set({ selectedIds: ids.filter((id): id is string => Boolean(id)) });
  },
  undo: () => {
    const state = get();
    if (state.pendingAgentChange) {
      state.pushToast("Approve or cancel the agent preview before using history.", "info");
      return;
    }
    const command = state.history.at(-1);
    if (!command) return;
    let project: Project;
    try {
      project = applyHistoryCommandToProject(state.project, command, "revert");
    } catch (error) {
      state.pushToast(
        error instanceof Error ? error.message : "This change can no longer be undone.",
        "error",
      );
      return;
    }
    set({
      project,
      history: state.history.slice(0, -1),
      future: [command, ...state.future],
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
  },
  redo: () => {
    const state = get();
    if (state.pendingAgentChange) {
      state.pushToast("Approve or cancel the agent preview before using history.", "info");
      return;
    }
    const command = state.future[0];
    if (!command) return;
    let project: Project;
    try {
      project = applyHistoryCommandToProject(state.project, command, "apply");
    } catch (error) {
      state.pushToast(
        error instanceof Error ? error.message : "This change can no longer be redone.",
        "error",
      );
      return;
    }
    set({
      project,
      history: [...state.history, command],
      future: state.future.slice(1),
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
  },
  toggleLayer: (id, key) => {
    const layer = activeRoom(get().project).scene.layers.find((entry) => entry.id === id);
    if (layer) get().updateLayer(id, { [key]: !layer[key] });
  },
  updateLayer: (id, patch) =>
    set((state) => ({
      project: updateSceneInProject(state.project, (scene) => ({
        ...scene,
        layers: scene.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
        updatedAt: new Date().toISOString(),
      })),
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    })),
  addLayer: () =>
    set((state) => ({
      project: updateSceneInProject(state.project, (scene) => ({
        ...scene,
        layers: [
          ...scene.layers,
          {
            id: crypto.randomUUID(),
            name: `Custom layer ${scene.layers.filter((layer) => !layer.system).length + 1}`,
            visible: true,
            locked: false,
            order: scene.layers.length,
            color: "#7b6d8c",
            system: false,
          },
        ],
        updatedAt: new Date().toISOString(),
      })),
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    })),
  deleteLayer: (id) =>
    set((state) => ({
      project: updateSceneInProject(state.project, (scene) => {
        const layers = scene.layers.filter((layer) => layer.id !== id || layer.system);
        const fallbackLayerId = resolveLayerIdForObjectType(layers, "furniture");
        return {
          ...scene,
          layers,
          objects: scene.objects.map((object) =>
            object.layerId === id ? { ...object, layerId: fallbackLayerId } : object,
          ),
          updatedAt: new Date().toISOString(),
        };
      }),
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    })),
  updateRoom: (patch) =>
    set((state) => {
      const room = activeRoom(state.project);
      const spaces =
        patch.spaces ??
        (patch.floorFinish
          ? room.spaces.map((space) =>
              space.kind === "primary" ? { ...space, floorFinish: patch.floorFinish! } : space,
            )
          : room.spaces);
      return {
        project: replaceRoom(state.project, {
          ...room,
          ...patch,
          spaces,
          updatedAt: new Date().toISOString(),
        }),
        saveStatus: "unsaved",
        dirtyRevision: state.dirtyRevision + 1,
      };
    }),

  initializeStorageForObject: (objectId) => {
    const state = get();
    if (state.pendingAgentChange) {
      state.pushToast("Approve or cancel the agent preview first.", "info");
      return;
    }
    const room = activeRoom(state.project);
    const sourceObject = room.scene.objects.find((object) => object.id === objectId);
    if (!sourceObject) return;
    const definition = getAssetDefinition(sourceObject.assetDefinitionId);
    if (definition.indexingBehavior !== "storage") {
      state.pushToast("This asset does not define indexable storage compartments.", "info");
      return;
    }
    const now = new Date().toISOString();
    const object: SceneObject = { ...sourceObject, childLocationIds: [], updatedAt: now };
    const completed = completeObjectStorage(
      definition,
      object,
      room.id,
      room.scene.storageLocations,
      now,
    );
    const storageLocations = completed.locations;
    object.childLocationIds = Array.from(
      new Set([...sourceObject.childLocationIds, completed.rootId]),
    );
    if (!completed.added && !completed.linked) {
      state.pushToast("Storage already matches the authored model.", "info");
      return;
    }
    const after = {
      ...room.scene,
      objects: room.scene.objects.map((entry) => (entry.id === objectId ? object : entry)),
      storageLocations,
      updatedAt: now,
    };
    const command: SceneCommand = {
      id: commandId(),
      kind: "scene",
      label: `Complete ${object.name} storage`,
      before: room.scene,
      after,
    };
    set({
      project: updateSceneInProject(state.project, () => after),
      history: [...state.history, command],
      future: [],
      selectedLocationId: completed.rootId,
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
    state.pushToast(
      `${completed.added} missing locations added; ${completed.linked} existing locations linked. Inventory preserved.`,
      "success",
    );
  },

  completeRoomStorage: (roomId) => {
    const state = get();
    const room = editableStorageRoom(state, roomId);
    if (!room) return;
    if (state.pendingAgentChange) {
      state.pushToast("Approve or cancel the agent preview first.", "info");
      return;
    }
    const now = new Date().toISOString();
    let locations = room.scene.storageLocations,
      added = 0,
      linked = 0;
    const objects = room.scene.objects.map((object) => {
      const definition = getAssetDefinition(object.assetDefinitionId);
      if (!definition.storageTemplate?.length) return object;
      const result = completeObjectStorage(definition, object, room.id, locations, now);
      locations = result.locations;
      added += result.added;
      linked += result.linked;
      return result.added || result.linked
        ? {
            ...object,
            childLocationIds: Array.from(new Set([...object.childLocationIds, result.rootId])),
            updatedAt: now,
          }
        : object;
    });
    if (!added && !linked) {
      state.pushToast("All room storage matches the authored models.", "info");
      return;
    }
    const after = { ...room.scene, objects, storageLocations: locations, updatedAt: now };
    const command: SceneCommand = {
      id: commandId(),
      kind: "scene",
      label: "Complete room storage",
      scope: "storage",
      roomId: room.id,
      before: room.scene,
      after,
    };
    set({
      project: replaceRoom(state.project, roomWithScene(room, after)),
      history: [...state.history, command],
      future: [],
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
    state.pushToast(
      `${added} missing storage locations added; ${linked} existing locations linked. Inventory preserved.`,
      "success",
    );
  },

  addStorageChild: (parentId, type, roomId) => {
    const state = get();
    const room = editableStorageRoom(state, roomId);
    if (!room) return null;
    const parent = room.scene.storageLocations.find((location) => location.id === parentId);
    if (!parent) return null;
    const allowed: Record<StorageLocationType, StorageLocationType[]> = {
      cabinet: ["compartment", "shelf", "drawer"],
      compartment: ["shelf", "bin"],
      shelf: ["bin"],
      drawer: ["bin"],
      bin: [],
    };
    if (!allowed[parent.type].includes(type)) {
      state.pushToast(`A ${type} cannot be added inside a ${parent.type}.`, "error");
      return null;
    }
    const siblings = room.scene.storageLocations.filter(
      (entry) => entry.parentId === parent.id && entry.type === type,
    );
    const now = new Date().toISOString();
    const child: StorageLocation = {
      id: crypto.randomUUID(),
      roomId: room.id,
      objectId: parent.objectId,
      parentId: parent.id,
      type,
      name: `${type[0].toUpperCase()}${type.slice(1)} ${String(siblings.length + 1).padStart(2, "0")}`,
      indexCode: generateChildIndexCode(parent, type, room.scene.storageLocations),
      order: siblings.length,
      capacityNotes: "",
      childIds: [],
      createdAt: now,
      updatedAt: now,
    };
    set(
      storageSceneChange(
        state,
        room,
        {
          ...room.scene,
          storageLocations: [
            ...room.scene.storageLocations.map((location) =>
              location.id === parent.id
                ? { ...location, childIds: [...location.childIds, child.id], updatedAt: now }
                : location,
            ),
            child,
          ],
          updatedAt: now,
        },
        `Add ${type}`,
      ),
    );
    if (!roomId) set({ selectedLocationId: child.id });
    return child.id;
  },
  removeStorageLocation: (id, roomId) => {
    const state = get();
    const room = editableStorageRoom(state, roomId);
    if (!room) return;
    const target = room.scene.storageLocations.find((entry) => entry.id === id);
    if (!target?.parentId) return;
    const descendants = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const location of room.scene.storageLocations)
        if (
          location.parentId &&
          descendants.has(location.parentId) &&
          !descendants.has(location.id)
        ) {
          descendants.add(location.id);
          changed = true;
        }
    }
    set(
      storageSceneChange(
        state,
        room,
        {
          ...room.scene,
          storageLocations: room.scene.storageLocations
            .filter((location) => !descendants.has(location.id))
            .map((location) => ({
              ...location,
              childIds: location.childIds.filter((childId) => !descendants.has(childId)),
            })),
          inventoryItems: room.scene.inventoryItems.map((item) =>
            item.storageLocationId && descendants.has(item.storageLocationId)
              ? { ...item, storageLocationId: null }
              : item,
          ),
          updatedAt: new Date().toISOString(),
        },
        "Remove storage location",
      ),
    );
    if (!roomId) set({ selectedLocationId: null });
  },
  bindStorageAnatomy: (id, anatomyKey, roomId) => {
    const state = get();
    if (state.pendingAgentChange) {
      state.pushToast("Approve or cancel the agent preview first.", "info");
      return;
    }
    const room = editableStorageRoom(state, roomId);
    if (!room) return;
    const location = room.scene.storageLocations.find((entry) => entry.id === id);
    const object = room.scene.objects.find((entry) => entry.id === location?.objectId);
    if (!location || !object || (location.anatomyKey ?? null) === anatomyKey) return;
    const slot = STORAGE_RIGS[object.assetDefinitionId]?.locations?.find(
      (entry) => entry.key === anatomyKey && entry.type === location.type,
    );
    if (anatomyKey && !slot) return;
    const now = new Date().toISOString();
    const after = {
      ...room.scene,
      storageLocations: room.scene.storageLocations.map((entry) =>
        entry.id === id ? { ...entry, anatomyKey: anatomyKey ?? undefined, updatedAt: now } : entry,
      ),
      updatedAt: now,
    };
    const command: SceneCommand = {
      id: commandId(),
      kind: "scene",
      label: "Link storage access",
      scope: "storage",
      roomId: room.id,
      before: room.scene,
      after,
    };
    set({
      project: replaceRoom(state.project, roomWithScene(room, after)),
      history: [...state.history, command],
      future: [],
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
    state.pushToast(
      "Physical access link updated. Inventory and location IDs are unchanged.",
      "success",
    );
  },
  renameStorageLocation: (roomId, locationId, name) => {
    const state = get();
    if (state.pendingAgentChange) {
      state.pushToast("Approve or cancel the agent preview first.", "info");
      return false;
    }
    try {
      const command = storageRenameCommand(state.project, roomId, locationId, name);
      if (command.kind === "storage-name" && command.before === command.after) return true;
      set({
        project: applyOrganizationCommand(state.project, command, "apply"),
        history: [...state.history, command],
        future: [],
        saveStatus: "unsaved",
        dirtyRevision: state.dirtyRevision + 1,
      });
      state.pushToast(
        "Storage name saved. Codes, contents and opening links are unchanged.",
        "success",
      );
      return true;
    } catch (error) {
      state.pushToast(
        error instanceof Error ? error.message : "Could not rename storage.",
        "error",
      );
      return false;
    }
  },
  assignInventoryItems: (items, roomId, locationId) => {
    const state = get();
    if (state.pendingAgentChange) {
      state.pushToast("Approve or cancel the agent preview first.", "info");
      return false;
    }
    try {
      const command = inventoryAssignmentCommand(state.project, items, roomId, locationId);
      set({
        project: applyOrganizationCommand(state.project, command, "apply"),
        history: [...state.history, command],
        future: [],
        saveStatus: "unsaved",
        dirtyRevision: state.dirtyRevision + 1,
      });
      state.pushToast(
        `${items.length} ${items.length === 1 ? "item" : "items"} assigned. Undo is available.`,
        "success",
      );
      return true;
    } catch (error) {
      state.pushToast(
        error instanceof Error ? error.message : "Could not assign inventory.",
        "error",
      );
      return false;
    }
  },
  updateStorageLocation: (id, patch, roomId) => {
    const state = get();
    const room = editableStorageRoom(state, roomId);
    if (!room || !room.scene.storageLocations.some((location) => location.id === id)) return;
    set(
      storageSceneChange(
        state,
        room,
        {
          ...room.scene,
          storageLocations: room.scene.storageLocations.map((location) =>
            location.id === id
              ? {
                  ...location,
                  ...(patch.indexCode !== undefined ? { indexCode: patch.indexCode } : {}),
                  ...(patch.capacityNotes !== undefined
                    ? { capacityNotes: patch.capacityNotes }
                    : {}),
                  updatedAt: new Date().toISOString(),
                }
              : location,
          ),
          updatedAt: new Date().toISOString(),
        },
        "Update storage details",
      ),
    );
  },
  addInventoryItem: (locationId, name = "New inventory item") =>
    set((state) => ({
      project: updateSceneInProject(state.project, (scene) => ({
        ...scene,
        inventoryItems: [
          ...scene.inventoryItems,
          {
            id: crypto.randomUUID(),
            name,
            quantity: 1,
            unit: "each",
            notes: "",
            owner: "",
            expiryDate: null,
            storageLocationId: locationId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      })),
      dialog: "inventory",
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    })),
  updateInventoryItem: (id, patch) =>
    set((state) => ({
      project: updateSceneInProject(state.project, (scene) => ({
        ...scene,
        inventoryItems: scene.inventoryItems.map((item) =>
          item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item,
        ),
        updatedAt: new Date().toISOString(),
      })),
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    })),
  removeInventoryItem: (id) =>
    set((state) => ({
      project: updateSceneInProject(state.project, (scene) => ({
        ...scene,
        inventoryItems: scene.inventoryItems.filter((item) => item.id !== id),
        updatedAt: new Date().toISOString(),
      })),
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    })),
  addInventoryItemToRoom: (roomId, locationId, item = {}) => {
    const state = get();
    const room = state.project.rooms.find(
      (entry) => entry.id === roomId && entry.roomKind !== "demo-template",
    );
    if (!room) {
      state.pushToast("Choose an editable room for this inventory item.", "error");
      return null;
    }
    if (locationId && !room.scene.storageLocations.some((location) => location.id === locationId)) {
      state.pushToast("That storage location does not belong to the selected room.", "error");
      return null;
    }
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const inventoryItem: InventoryItem = {
      id,
      name: item.name?.trim() || "New inventory item",
      imageSrc: item.imageSrc,
      quantity: Number.isFinite(item.quantity) ? Number(item.quantity) : 1,
      unit: item.unit?.trim() || "each",
      notes: item.notes ?? "",
      owner: item.owner ?? "",
      expiryDate: item.expiryDate ?? null,
      storageLocationId: locationId,
      createdAt: now,
      updatedAt: now,
    };
    set({
      project: replaceRoom(state.project, {
        ...room,
        updatedAt: now,
        scene: {
          ...room.scene,
          inventoryItems: [...room.scene.inventoryItems, inventoryItem],
          updatedAt: now,
        },
      }),
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
    return id;
  },
  updateInventoryItemInRoom: (roomId, id, patch) =>
    set((state) => {
      const room = state.project.rooms.find((entry) => entry.id === roomId);
      if (!room) return state;
      const now = new Date().toISOString();
      return {
        project: replaceRoom(state.project, {
          ...room,
          updatedAt: now,
          scene: {
            ...room.scene,
            inventoryItems: room.scene.inventoryItems.map((item) =>
              item.id === id ? { ...item, ...patch, updatedAt: now } : item,
            ),
            updatedAt: now,
          },
        }),
        saveStatus: "unsaved" as const,
        dirtyRevision: state.dirtyRevision + 1,
      };
    }),
  moveInventoryItemToRoom: (sourceRoomId, id, targetRoomId) => {
    const state = get();
    if (sourceRoomId === targetRoomId) return true;
    const sourceRoom = state.project.rooms.find(
      (room) => room.id === sourceRoomId && room.roomKind !== "demo-template",
    );
    const targetRoom = state.project.rooms.find(
      (room) => room.id === targetRoomId && room.roomKind !== "demo-template",
    );
    const item = sourceRoom?.scene.inventoryItems.find((entry) => entry.id === id);
    if (!sourceRoom || !targetRoom || !item) {
      state.pushToast("That inventory assignment is no longer available.", "error");
      return false;
    }
    const now = new Date().toISOString();
    const movedItem = { ...item, storageLocationId: null, updatedAt: now };
    set({
      project: {
        ...state.project,
        rooms: state.project.rooms.map((room) => {
          if (room.id === sourceRoom.id) {
            return {
              ...room,
              updatedAt: now,
              scene: {
                ...room.scene,
                inventoryItems: room.scene.inventoryItems.filter((entry) => entry.id !== id),
                updatedAt: now,
              },
            };
          }
          if (room.id === targetRoom.id) {
            return {
              ...room,
              updatedAt: now,
              scene: {
                ...room.scene,
                inventoryItems: [...room.scene.inventoryItems, movedItem],
                updatedAt: now,
              },
            };
          }
          return room;
        }),
        updatedAt: now,
      },
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
    state.pushToast(
      `${item.name} assigned to ${targetRoom.name}. Choose a storage location when ready.`,
      "success",
    );
    return true;
  },
  removeInventoryItemFromRoom: (roomId, id) =>
    set((state) => {
      const room = state.project.rooms.find((entry) => entry.id === roomId);
      if (!room) return state;
      const now = new Date().toISOString();
      return {
        project: replaceRoom(state.project, {
          ...room,
          updatedAt: now,
          scene: {
            ...room.scene,
            inventoryItems: room.scene.inventoryItems.filter((item) => item.id !== id),
            updatedAt: now,
          },
        }),
        saveStatus: "unsaved" as const,
        dirtyRevision: state.dirtyRevision + 1,
      };
    }),
  updateEquipmentRecord: (id, patch) =>
    set((state) => ({
      project: updateSceneInProject(state.project, (scene) => ({
        ...scene,
        equipmentRecords: scene.equipmentRecords.map((record) =>
          record.id === id ? { ...record, ...patch } : record,
        ),
        updatedAt: new Date().toISOString(),
      })),
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    })),
  applyReindex: (changes) =>
    set((state) => ({
      project: updateSceneInProject(state.project, (scene) => {
        const objectChanges = new Map(
          changes
            .filter((change) => change.type === "object")
            .map((change) => [change.id, change.after]),
        );
        const locationChanges = new Map(
          changes
            .filter((change) => change.type === "location")
            .map((change) => [change.id, change.after]),
        );
        return {
          ...scene,
          objects: scene.objects.map((object) =>
            objectChanges.has(object.id)
              ? {
                  ...object,
                  indexCode: objectChanges.get(object.id)!,
                  updatedAt: new Date().toISOString(),
                }
              : object,
          ),
          storageLocations: scene.storageLocations.map((location) =>
            locationChanges.has(location.id)
              ? {
                  ...location,
                  indexCode: locationChanges.get(location.id)!,
                  updatedAt: new Date().toISOString(),
                }
              : location,
          ),
          updatedAt: new Date().toISOString(),
        };
      }),
      dialog: null,
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    })),

  saveNow: async () => {
    if (get().pendingAgentChange) {
      get().pushToast("Agent preview is not saved. Approve or cancel it first.", "info");
      return;
    }
    if (pendingProjectSave) {
      saveRequestedWhilePending = true;
      await pendingProjectSave;
      return;
    }
    const state = get();
    const revisionAtStart = state.dirtyRevision;
    set({ saveStatus: "saving", saveError: null });
    let succeeded = false;
    pendingProjectSave = (async () => {
      try {
        const project = await persistProject(state.project);
        set((current) =>
          current.dirtyRevision === revisionAtStart
            ? { project, saveStatus: "saved", saveError: null }
            : { saveStatus: "unsaved", saveError: null },
        );
        succeeded = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to save project.";
        set({ saveStatus: "error", saveError: message });
        get().pushToast(message, "error");
      }
    })();
    await pendingProjectSave;
    pendingProjectSave = null;

    const newerRevisionExists = get().dirtyRevision !== revisionAtStart;
    const shouldSaveAgain = succeeded && (saveRequestedWhilePending || newerRevisionExists);
    saveRequestedWhilePending = false;
    if (shouldSaveAgain) await get().saveNow();
  },
  saveVersion: async (name, note = "") => {
    const state = get();
    const room = activeRoom(state.project);
    try {
      const version = await saveRoomVersion(state.project.id, room.id, name, note, room.scene);
      set({ versions: [version, ...state.versions], dialog: null });
      get().pushToast(`Version “${name}” saved.`, "success");
    } catch (error) {
      get().pushToast(
        error instanceof Error ? error.message : "Version could not be saved.",
        "error",
      );
    }
  },
  loadVersions: async () => {
    const state = get();
    const room = activeRoom(state.project);
    try {
      set({ versions: await listRoomVersions(state.project.id, room.id) });
    } catch (error) {
      state.pushToast(
        error instanceof Error ? error.message : "Version history could not be loaded.",
        "error",
      );
    }
  },
  restoreVersion: async (id) => {
    const state = get();
    try {
      const version = await getRoomVersion(id);
      set({
        project: updateSceneInProject(state.project, () => version.scene),
        history: [],
        future: [],
        dialog: null,
        saveStatus: "unsaved",
        dirtyRevision: state.dirtyRevision + 1,
      });
      get().pushToast(`Restored “${version.name}”.`, "success");
    } catch (error) {
      state.pushToast(
        error instanceof Error ? error.message : "Version could not be restored.",
        "error",
      );
    }
  },
  duplicateVersionToRoom: async (id) => {
    const state = get();
    const room = activeRoom(state.project);
    try {
      const version = await getRoomVersion(id);
      const nextRoom = cloneRoomFromScene(
        room,
        version.scene,
        `${room.name} — ${version.name}`,
        `${room.code}-V${state.project.rooms.length + 1}`,
      );
      set({
        project: {
          ...state.project,
          rooms: [...state.project.rooms, nextRoom],
          activeRoomId: nextRoom.id,
          updatedAt: nextRoom.updatedAt,
          laboratories: state.project.laboratories.map((lab) =>
            lab.id === room.laboratoryId ? { ...lab, roomIds: [...lab.roomIds, nextRoom.id] } : lab,
          ),
        },
        selectedIds: [],
        history: [],
        future: [],
        dialog: null,
        saveStatus: "unsaved",
        dirtyRevision: state.dirtyRevision + 1,
      });
      get().pushToast(`Created a room from “${version.name}”.`, "success");
    } catch (error) {
      state.pushToast(
        error instanceof Error ? error.message : "Version could not be duplicated.",
        "error",
      );
    }
  },
  replaceProject: (project) =>
    set({
      project: ensureProjectLayers(project),
      selectedIds: [],
      selectedLocationId: null,
      history: [],
      future: [],
      saveStatus: "unsaved",
      dirtyRevision: get().dirtyRevision + 1,
    }),
  renameProject: (name) =>
    set((state) => ({
      project: { ...state.project, name, updatedAt: new Date().toISOString() },
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    })),
  renameLaboratory: (laboratoryId, name, code) => {
    const state = get();
    const laboratory = state.project.laboratories.find((entry) => entry.id === laboratoryId);
    if (!laboratory) {
      state.pushToast("That laboratory is no longer available.", "error");
      return false;
    }
    const nextName = name.trim();
    const nextCode = code.trim();
    if (!nextName || !nextCode) {
      state.pushToast("Laboratory name and code are required.", "error");
      return false;
    }
    if (
      state.project.laboratories.some(
        (entry) =>
          entry.id !== laboratoryId &&
          entry.code.toLocaleUpperCase() === nextCode.toLocaleUpperCase(),
      )
    ) {
      state.pushToast(`Laboratory code ${nextCode} is already in use.`, "error");
      return false;
    }
    const now = new Date().toISOString();
    set({
      project: {
        ...state.project,
        laboratories: state.project.laboratories.map((entry) =>
          entry.id === laboratoryId ? { ...entry, name: nextName, code: nextCode } : entry,
        ),
        updatedAt: now,
      },
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
    state.pushToast(`${nextName} updated.`, "success");
    return true;
  },
  renameRoom: (roomId, name, code) => {
    const state = get();
    const room = state.project.rooms.find((entry) => entry.id === roomId);
    if (!room || room.roomKind === "demo-template") {
      state.pushToast("That protected room cannot be renamed.", "error");
      return false;
    }
    const nextName = name.trim();
    const nextCode = code.trim();
    if (!nextName || !nextCode) {
      state.pushToast("Room name and code are required.", "error");
      return false;
    }
    if (
      state.project.rooms.some(
        (entry) =>
          entry.id !== roomId &&
          entry.laboratoryId === room.laboratoryId &&
          entry.code.toLocaleUpperCase() === nextCode.toLocaleUpperCase(),
      )
    ) {
      state.pushToast(`This laboratory already has a room with code ${nextCode}.`, "error");
      return false;
    }
    const now = new Date().toISOString();
    set({
      project: replaceRoom(state.project, {
        ...room,
        name: nextName,
        code: nextCode,
        updatedAt: now,
      }),
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
    state.pushToast(`${nextName} updated.`, "success");
    return true;
  },
  switchRoom: (roomId) => {
    const state = get();
    if (state.pendingAgentChange && state.project.activeRoomId !== roomId) {
      state.pushToast("Approve or cancel the agent preview before changing rooms.", "info");
      return;
    }
    const room = state.project.rooms.find((entry) => entry.id === roomId);
    if (!room) {
      state.pushToast("That room is no longer available in this project.", "error");
      return;
    }
    if (room.roomKind === "demo-template") {
      state.pushToast(
        "The factory demo is read-only. Use Create demo from template to make an editable copy.",
        "info",
      );
      return;
    }
    set({
      ...roomSwitchState({
        ...state.project,
        activeRoomId: room.id,
        updatedAt: new Date().toISOString(),
      }),
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
      dialog: null,
    });
  },
  createLaboratory: (input = {}) => {
    const state = get();
    const code =
      input.code?.trim() ||
      nextAvailableCode(
        state.project.laboratories.map((laboratory) => laboratory.code),
        "LAB-",
        2,
      );
    if (
      state.project.laboratories.some(
        (laboratory) => laboratory.code.toLocaleUpperCase() === code.toLocaleUpperCase(),
      )
    ) {
      state.pushToast(`Laboratory code ${code} is already in use.`, "error");
      return null;
    }
    const name = input.name?.trim() || `Laboratory ${state.project.laboratories.length + 1}`;
    const laboratory = createBlankLaboratory(state.project.id, { name, code });
    const room = createBlankRoom({
      laboratoryId: laboratory.id,
      name: input.roomName?.trim() || "Room 1",
      code: input.roomCode?.trim() || "R001",
    });
    room.facilityPlacement = { floor: 0, x: 0, y: 0, rotation: 0 };
    laboratory.roomIds = [room.id];
    const project = {
      ...state.project,
      laboratories: [...state.project.laboratories, laboratory],
      rooms: [...state.project.rooms, room],
      activeRoomId: room.id,
      updatedAt: room.updatedAt,
    };
    set({
      ...roomSwitchState(project),
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
    get().pushToast(`${laboratory.name} created with a blank first room.`, "success");
    return laboratory.id;
  },
  createRoom: (input = {}) => {
    const state = get();
    const currentRoom = activeRoom(state.project);
    const laboratory =
      state.project.laboratories.find(
        (entry) => entry.id === (input.laboratoryId ?? currentRoom.laboratoryId),
      ) ?? state.project.laboratories[0];
    if (!laboratory) {
      state.pushToast("Create a laboratory before adding a room.", "error");
      return null;
    }
    const laboratoryRooms = state.project.rooms.filter(
      (room) => room.laboratoryId === laboratory.id,
    );
    const code =
      input.code?.trim() ||
      nextAvailableCode(
        laboratoryRooms.map((room) => room.code),
        "R",
        3,
      );
    if (
      laboratoryRooms.some((room) => room.code.toLocaleUpperCase() === code.toLocaleUpperCase())
    ) {
      state.pushToast(`${laboratory.name} already has a room with code ${code}.`, "error");
      return null;
    }
    const nextRoom = createBlankRoom({
      laboratoryId: laboratory.id,
      name: input.name?.trim() || `Room ${laboratoryRooms.length + 1}`,
      code,
    });
    nextRoom.facilityPlacement = suggestedFacilityPlacement(state.project, laboratory.id);
    const project = {
      ...state.project,
      rooms: [...state.project.rooms, nextRoom],
      activeRoomId: nextRoom.id,
      updatedAt: nextRoom.updatedAt,
      laboratories: state.project.laboratories.map((entry) =>
        entry.id === laboratory.id ? { ...entry, roomIds: [...entry.roomIds, nextRoom.id] } : entry,
      ),
    };
    set({
      ...roomSwitchState(project),
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
    get().pushToast(`${nextRoom.name} added to ${laboratory.name}.`, "success");
    return nextRoom.id;
  },
  deleteLaboratory: (laboratoryId) => {
    const state = get();
    if (state.pendingAgentChange) {
      state.pushToast("Approve or cancel the agent preview before deleting a laboratory.", "info");
      return false;
    }
    const laboratory = state.project.laboratories.find((entry) => entry.id === laboratoryId);
    if (!laboratory) {
      state.pushToast("That laboratory is no longer available.", "error");
      return false;
    }
    if (state.project.laboratories.length <= 1) {
      state.pushToast("Create another laboratory before deleting the final laboratory.", "info");
      return false;
    }
    const removedRoomIds = new Set(
      state.project.rooms
        .filter((entry) => entry.laboratoryId === laboratoryId)
        .map((entry) => entry.id),
    );
    const nextRooms = state.project.rooms.filter((entry) => !removedRoomIds.has(entry.id));
    const fallbackRoom =
      nextRooms.find((entry) => entry.roomKind !== "demo-template") ?? nextRooms[0];
    if (!fallbackRoom) {
      state.pushToast(
        "Create a room in another laboratory before deleting this laboratory.",
        "info",
      );
      return false;
    }
    const activeRoomRemoved = removedRoomIds.has(state.project.activeRoomId);
    const now = new Date().toISOString();
    const project: Project = {
      ...state.project,
      laboratories: state.project.laboratories.filter((entry) => entry.id !== laboratoryId),
      rooms: nextRooms,
      activeRoomId: activeRoomRemoved ? fallbackRoom.id : state.project.activeRoomId,
      featuredDemoRoomId:
        state.project.featuredDemoRoomId && removedRoomIds.has(state.project.featuredDemoRoomId)
          ? (nextRooms.find((entry) => entry.roomKind === "demo")?.id ?? null)
          : state.project.featuredDemoRoomId,
      updatedAt: now,
    };
    set({
      ...(activeRoomRemoved ? roomSwitchState(project) : { project }),
      selectedIds: [],
      selectedLocationId: null,
      history: [],
      future: [],
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
    get().pushToast(
      `${laboratory.name} and ${removedRoomIds.size} room${removedRoomIds.size === 1 ? "" : "s"} deleted.`,
      "success",
    );
    return true;
  },
  deleteRoom: (roomId) => {
    const state = get();
    const room = state.project.rooms.find((entry) => entry.id === roomId);
    if (!room || room.roomKind === "demo-template") {
      state.pushToast("That protected room cannot be deleted.", "error");
      return false;
    }
    const editableRooms = state.project.rooms.filter((entry) => entry.roomKind !== "demo-template");
    if (editableRooms.length <= 1) {
      state.pushToast("Create another room before deleting the final editable room.", "info");
      return false;
    }
    const nextRooms = state.project.rooms.filter((entry) => entry.id !== roomId);
    const fallbackRoom =
      state.project.activeRoomId === roomId
        ? editableRooms.find((entry) => entry.id !== roomId)
        : nextRooms.find((entry) => entry.id === state.project.activeRoomId);
    if (!fallbackRoom) return false;
    const now = new Date().toISOString();
    const project = {
      ...state.project,
      rooms: nextRooms,
      activeRoomId: fallbackRoom.id,
      featuredDemoRoomId:
        state.project.featuredDemoRoomId === roomId
          ? (nextRooms.find((entry) => entry.roomKind === "demo")?.id ?? null)
          : state.project.featuredDemoRoomId,
      updatedAt: now,
      laboratories: state.project.laboratories.map((laboratory) =>
        laboratory.roomIds.includes(roomId)
          ? { ...laboratory, roomIds: laboratory.roomIds.filter((id) => id !== roomId) }
          : laboratory,
      ),
    };
    set({
      ...(state.project.activeRoomId === roomId ? roomSwitchState(project) : { project }),
      selectedIds: [],
      selectedLocationId: null,
      history: [],
      future: [],
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
    get().pushToast(`${room.name} deleted.`, "success");
    return true;
  },
  duplicateRoom: () =>
    set((state) => {
      const room = activeRoom(state.project);
      const clone = cloneRoomFromScene(room, room.scene, `${room.name} copy`, `${room.code}-COPY`);
      clone.facilityPlacement = suggestedFacilityPlacement(state.project, room.laboratoryId);
      return {
        project: {
          ...state.project,
          rooms: [...state.project.rooms, clone],
          activeRoomId: clone.id,
          updatedAt: clone.updatedAt,
          laboratories: state.project.laboratories.map((lab) =>
            lab.id === room.laboratoryId ? { ...lab, roomIds: [...lab.roomIds, clone.id] } : lab,
          ),
        },
        selectedIds: [],
        history: [],
        future: [],
        saveStatus: "unsaved",
        dirtyRevision: state.dirtyRevision + 1,
      };
    }),
  duplicateRoomAsDemo: (roomId) => {
    const state = get();
    const source = state.project.rooms.find(
      (room) => room.id === (roomId ?? state.project.activeRoomId),
    );
    if (!source || source.roomKind === "demo-template") {
      state.pushToast("Choose an editable room to create a demo copy.", "error");
      return null;
    }
    const demos = state.project.rooms.filter((room) => room.roomKind === "demo");
    const name = `${source.name} demo ${demos.length + 1}`;
    const code = nextAvailableCode(
      state.project.rooms.map((room) => room.code),
      "DEMO-",
      2,
    );
    const now = new Date().toISOString();
    const demo = cloneRoomFromScene(source, source.scene, name, code);
    demo.roomKind = "demo";
    demo.demoSavedAt = now;
    demo.facilityPlacement = suggestedFacilityPlacement(state.project, source.laboratoryId);
    const project = {
      ...state.project,
      rooms: [...state.project.rooms, demo],
      activeRoomId: demo.id,
      featuredDemoRoomId: state.project.featuredDemoRoomId ?? demo.id,
      updatedAt: now,
      laboratories: state.project.laboratories.map((laboratory) =>
        laboratory.id === source.laboratoryId
          ? { ...laboratory, roomIds: [...laboratory.roomIds, demo.id] }
          : laboratory,
      ),
    };
    set({
      ...roomSwitchState(project),
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
      dialog: null,
    });
    state.pushToast(`${demo.name} created without changing ${source.name}.`, "success");
    return demo.id;
  },
  createDemoFromTemplate: () => {
    const state = get();
    const template = factoryDemoTemplate();
    if (!template) {
      state.pushToast("The factory demo template is unavailable.", "error");
      return null;
    }
    const currentRoom = activeRoom(state.project);
    const now = new Date().toISOString();
    const existingDemos = state.project.rooms.filter((room) => room.roomKind === "demo");
    const name = existingDemos.length
      ? `Build Week Demo ${existingDemos.length + 1}`
      : "Build Week Demo";
    const code = nextAvailableCode(
      state.project.rooms.map((room) => room.code),
      "DEMO-",
      2,
    );
    const clone = cloneRoomFromScene(template, template.scene, name, code);
    const demoRoom: Room = {
      ...clone,
      laboratoryId: currentRoom.laboratoryId,
      roomKind: "demo",
      demoSavedAt: now,
      environmentProfileId: null,
      viewState: { ...DEFAULT_ROOM_VIEW_STATE },
      facilityPlacement: suggestedFacilityPlacement(state.project, currentRoom.laboratoryId),
    };
    const project = {
      ...state.project,
      rooms: [...state.project.rooms, demoRoom],
      activeRoomId: demoRoom.id,
      featuredDemoRoomId: state.project.featuredDemoRoomId ?? demoRoom.id,
      updatedAt: now,
      laboratories: state.project.laboratories.map((laboratory) =>
        laboratory.id === currentRoom.laboratoryId
          ? { ...laboratory, roomIds: [...laboratory.roomIds, demoRoom.id] }
          : laboratory,
      ),
    };
    set({
      ...roomSwitchState(project),
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
      dialog: null,
    });
    get().pushToast("Editable demo created from the read-only factory template.", "success");
    return demoRoom.id;
  },
  openLatestDemoRoom: () => {
    const state = get();
    const latest =
      state.project.rooms.find(
        (room) => room.id === state.project.featuredDemoRoomId && room.roomKind === "demo",
      ) ??
      state.project.rooms
        .filter((room) => room.roomKind === "demo")
        .sort((a, b) =>
          (b.demoSavedAt ?? b.updatedAt).localeCompare(a.demoSavedAt ?? a.updatedAt),
        )[0];
    if (!latest) {
      state.pushToast("No saved Demo Room yet. Create one from the factory template.", "info");
      set({ dialog: "project" });
      return null;
    }
    if (latest.id === state.project.activeRoomId) return latest.id;
    const project = {
      ...state.project,
      activeRoomId: latest.id,
      updatedAt: new Date().toISOString(),
    };
    set({
      ...roomSwitchState(project),
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
      dialog: null,
    });
    return latest.id;
  },
  setFeaturedDemoRoom: (roomId) => {
    const state = get();
    const room = state.project.rooms.find(
      (entry) => entry.id === roomId && entry.roomKind === "demo",
    );
    if (!room) {
      state.pushToast("Only an editable demo can be featured.", "error");
      return false;
    }
    set({
      project: {
        ...state.project,
        featuredDemoRoomId: room.id,
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
    state.pushToast(`${room.name} is now the featured demo.`, "success");
    return true;
  },
  saveAsDemoRoom: async () => {
    const state = get();
    const room = activeRoom(state.project);
    if (room.roomKind === "demo-template") {
      state.pushToast("The factory template cannot be saved as a working room.", "error");
      return;
    }
    const now = new Date().toISOString();
    set({
      project: {
        ...replaceRoom(state.project, {
          ...room,
          roomKind: "demo",
          demoSavedAt: now,
          viewState: {
            ...resolvedRoomViewState(room),
            cameraPreset: state.cameraPreset,
            presentation: state.presentation,
            floorVisible: state.floorVisible,
            wallTransparent: state.wallTransparent,
            environmentContextVisible: state.environmentContextVisible,
          },
          updatedAt: now,
        }),
        featuredDemoRoomId: state.project.featuredDemoRoomId ?? room.id,
      },
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
    await get().saveNow();
    get().pushToast("This room is now the saved Demo Room.", "success");
  },
  resetActiveDemoFromTemplate: () => {
    const state = get();
    const room = activeRoom(state.project);
    if (room.roomKind !== "demo") {
      state.pushToast("Only a saved Demo Room can be reset from the template.", "error");
      return false;
    }
    const template = factoryDemoTemplate();
    if (!template) {
      state.pushToast("The factory demo template is unavailable.", "error");
      return false;
    }
    const clone = cloneRoomFromScene(template, template.scene, room.name, room.code);
    const resetRoom = retargetClonedRoom(clone, room);
    const project = replaceRoom(state.project, resetRoom);
    set({
      ...roomSwitchState(project),
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
      dialog: null,
    });
    get().pushToast("Demo Room reset from the factory template.", "success");
    return true;
  },
  updateRoomFacilityPlacement: (roomId, patch) => {
    const state = get();
    const room = state.project.rooms.find((entry) => entry.id === roomId);
    if (!room || room.roomKind === "demo-template") return;
    const now = new Date().toISOString();
    const current =
      room.facilityPlacement ?? suggestedFacilityPlacement(state.project, room.laboratoryId);
    set({
      project: replaceRoom(state.project, {
        ...room,
        facilityPlacement: { ...current, ...patch },
        updatedAt: now,
      }),
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
  },
  archiveAsset: (id) => {
    const state = get();
    const archivedAssetIds = Array.from(new Set([...(state.project.archivedAssetIds ?? []), id]));
    set({
      project: { ...state.project, archivedAssetIds, updatedAt: new Date().toISOString() },
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
    state.pushToast(
      "Asset archived from future placement. Existing room instances remain unchanged.",
      "success",
    );
    return true;
  },
  restoreAsset: (id) => {
    const state = get();
    set({
      project: {
        ...state.project,
        archivedAssetIds: (state.project.archivedAssetIds ?? []).filter((entry) => entry !== id),
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
      dirtyRevision: state.dirtyRevision + 1,
    });
    state.pushToast("Asset restored to the active library.", "success");
  },
  setAssetSearch: (assetSearch) => set({ assetSearch }),
  toggleFavorite: (id) =>
    set((state) => {
      const favorites = state.favorites.includes(id)
        ? state.favorites.filter((entry) => entry !== id)
        : [...state.favorites, id];
      writeStoredStringArray("labspace-favorites", favorites);
      return { favorites };
    }),
  toggleCuratedAsset: (id) =>
    set((state) => {
      const curatedAssetIds = state.curatedAssetIds.includes(id)
        ? state.curatedAssetIds.filter((entry) => entry !== id)
        : [...state.curatedAssetIds, id];
      writeStoredStringArray("labspace-curated-assets", curatedAssetIds);
      return { curatedAssetIds };
    }),
  setIndexFilter: (indexFilter) => set({ indexFilter }),
  pushToast: (message, tone = "info") =>
    set((state) => ({
      toasts: [...state.toasts.slice(-3), { id: crypto.randomUUID(), tone, message }],
    })),
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export const selectActiveRoom = (state: EditorState) => activeRoom(state.project);
export const selectScene = (state: EditorState) => activeRoom(state.project).scene;
export const selectSelectedObjects = (state: EditorState) => {
  const room = activeRoom(state.project);
  return room.scene.objects.filter((object) => state.selectedIds.includes(object.id));
};
