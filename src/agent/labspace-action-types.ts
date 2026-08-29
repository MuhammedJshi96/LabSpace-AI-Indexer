import type { DigitalTwinRecordKind, DigitalTwinScope } from "../domain/digital-twin-index";
import type { Project, Scene, SceneObject } from "../domain/schema";

export type LabSpaceReadState = {
  project: Project;
  selectedObjectIds: string[];
  selectedStorageLocationId: string | null;
};

export type LabSpaceStateReader = () => LabSpaceReadState;

export type LabContext = {
  project: { id: string; name: string };
  laboratory: { id: string; name: string; code: string };
  room: { id: string; name: string; code: string; kind: string };
  selection: { objectIds: string[]; storageLocationId: string | null };
  counts: { inventory: number; equipment: number; locations: number; alerts: number };
};

export type SearchLabRecordsInput = {
  query: string;
  scope?: DigitalTwinScope;
  kinds?: DigitalTwinRecordKind[];
  limit?: number;
};

export type LabRecordSearchResult = {
  recordId: string;
  kind: DigitalTwinRecordKind;
  name: string;
  laboratoryCode: string;
  roomCode: string;
  indexCode: string;
  path: string[];
  status: string;
};

export type SearchLabRecordsResult = {
  query: string;
  scope: DigitalTwinScope;
  totalMatches: number;
  returnedMatches: number;
  results: LabRecordSearchResult[];
};

type RecordWorkspace = {
  laboratory: { id: string; name: string; code: string };
  room: { id: string; name: string; code: string };
  indexCode: string;
  path: string[];
};

export type InventoryRecordInspection = RecordWorkspace & {
  kind: "inventory";
  recordId: string;
  name: string;
  quantity: { value: number; unit: string };
  owner: string | null;
  expiryDate: string | null;
  status: string;
  notes: string | null;
};

export type EquipmentRecordInspection = RecordWorkspace & {
  kind: "equipment";
  recordId: string;
  name: string;
  equipmentId: string;
  status: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  responsiblePerson: string | null;
  service: { lastDate: string | null; nextDate: string | null };
  utilities: {
    power: string | null;
    water: string | null;
    gas: string | null;
    drainRequired: boolean;
    ventilationRequired: boolean;
  };
  notes: string | null;
};

export type LocationRecordInspection = RecordWorkspace & {
  kind: "location";
  recordId: string;
  name: string;
  locationType: string;
  status: string;
  capacityNote: string | null;
  contents: {
    totalItems: number;
    items: Array<{ name: string; quantity: number; unit: string }>;
  };
};

export type LabRecordInspection =
  InventoryRecordInspection | EquipmentRecordInspection | LocationRecordInspection;

export type InspectLabRecordInput = { recordId: string };

export type FocusLabRecordInput = { recordId: string };

export type FocusLabRecordResult = {
  recordId: string;
  kind: DigitalTwinRecordKind;
  name: string;
  laboratoryCode: string;
  roomCode: string;
  objectId: string;
  locationId: string | null;
  path: string[];
  focused: true;
};

export type FocusLabRecordOptions = {
  revealStorage?: boolean;
};

export type LabSpaceNavigationActions = {
  focusLabRecord: (input: unknown, options?: FocusLabRecordOptions) => FocusLabRecordResult;
};

export type ValidateObjectMoveInput = {
  objectId: string;
  target: { xMm: number; yMm: number };
  rotationDeg?: number;
};

export type PlacementConflict = {
  type:
    | "outside-room-boundary"
    | "object-collision"
    | "below-floor"
    | "above-room-height"
    | "missing-support-surface"
    | "opening-outside-wall"
    | "opening-overlap"
    | "restricted-object";
  objectId?: string;
  indexCode?: string;
  name?: string;
  message: string;
};

export type ValidateObjectMoveResult = {
  valid: boolean;
  objectId: string;
  objectName: string;
  objectIndexCode: string;
  roomCode: string;
  target: { xMm: number; yMm: number; zMm: number; rotationDeg: number };
  conflicts: PlacementConflict[];
};

export type ObjectDimensionsMm = {
  widthMm: number;
  depthMm: number;
  heightMm: number;
};

export type ValidateObjectResizeInput = {
  objectId: string;
  dimensions: Partial<ObjectDimensionsMm>;
};

export type ValidateObjectResizeResult = {
  valid: boolean;
  objectId: string;
  objectName: string;
  objectIndexCode: string;
  roomCode: string;
  current: ObjectDimensionsMm;
  proposed: ObjectDimensionsMm;
  conflicts: PlacementConflict[];
};

export type RecommendObjectPlacementsInput = {
  objectId: string;
  preferredTarget?: { xMm: number; yMm: number };
  rotationsDeg?: number[];
  limit?: number;
};

export type RecommendedPlacement = {
  rank: number;
  target: { xMm: number; yMm: number; zMm: number; rotationDeg: number };
  distanceFromPreferredMm: number;
  nearestObjectGapMm: number | null;
  rationale: string[];
};

export type RecommendObjectPlacementsResult = {
  objectId: string;
  objectName: string;
  objectIndexCode: string;
  roomCode: string;
  preferredTarget: { xMm: number; yMm: number };
  evaluatedTargets: number;
  candidates: RecommendedPlacement[];
  basis: string[];
};

export type AuditRoomInput = {
  roomCode?: string;
};

export type RoomAuditIssue = {
  severity: "info" | "warning" | "error";
  title: string;
  message: string;
  objectIds: string[];
  indexCodes: string[];
};

export type RoomAuditResult = {
  room: {
    id: string;
    name: string;
    code: string;
    laboratoryCode: string;
    floor: number;
  };
  status: "ready" | "attention" | "blocked";
  summary: {
    floorAreaM2: number;
    walls: number;
    openings: number;
    placedAssets: number;
    inventory: number;
    equipment: number;
    errors: number;
    warnings: number;
    information: number;
  };
  checks: {
    closedFloorShell: boolean;
    hostedOpenings: boolean;
    supportedBenchEquipment: boolean;
    objectsInsideBoundary: boolean;
    uniqueIndexCodes: boolean;
  };
  issues: RoomAuditIssue[];
  basis: string[];
};

export type LabSpaceSpatialActions = {
  auditRoom: (input: unknown) => RoomAuditResult;
  validateObjectMove: (input: unknown) => ValidateObjectMoveResult;
  validateObjectResize: (input: unknown) => ValidateObjectResizeResult;
  recommendObjectPlacements: (input: unknown) => RecommendObjectPlacementsResult;
};

export type SearchLabAssetsInput = {
  query: string;
  categories?: string[];
  limit?: number;
};

export type LabAssetSearchResult = {
  assetId: string;
  name: string;
  category: string;
  dimensionsMm: { width: number; depth: number; height: number };
  connection: string;
  indexingBehavior: string;
  tags: string[];
};

export type SearchLabAssetsResult = {
  query: string;
  totalMatches: number;
  returnedMatches: number;
  results: LabAssetSearchResult[];
};

export type RoomAssetRequest = {
  assetId: string;
  quantity: number;
  placement?: "auto" | "perimeter" | "island" | "open" | "surface" | "wall";
  position?: { xMm: number; yMm: number };
  rotationDeg?: number;
  elevationMm?: number;
  host?: {
    wallIndex?: number;
    offsetMm?: number;
    sillHeightMm?: number;
    handing?: "left" | "right";
    swing?: "inward" | "outward" | "sliding";
  };
};

export type PlanRoomLayoutInput = {
  brief?: string;
  assets: RoomAssetRequest[];
  aisleMm?: number;
  roomShell?: {
    widthMm?: number;
    depthMm?: number;
    vertices?: Array<{ xMm: number; yMm: number }>;
    wallHeightMm?: number;
    wallThicknessMm?: number;
  };
};

export type PlannedWallSegment = {
  proposalId: string;
  name: string;
  start: { xMm: number; yMm: number };
  end: { xMm: number; yMm: number };
  thicknessMm: number;
  heightMm: number;
  lengthMm: number;
};

export type PlannedRoomShell = {
  mode: "existing" | "proposed";
  shape: "rectangle" | "polygon" | "existing";
  widthMm: number;
  depthMm: number;
  wallHeightMm: number;
  wallThicknessMm: number;
  vertices: Array<{ xMm: number; yMm: number }>;
  segments: PlannedWallSegment[];
};

export type PlannedRoomObject = {
  proposalId: string;
  assetId: string;
  assetName: string;
  position: { xMm: number; yMm: number; zMm: number };
  rotationDeg: number;
  dimensionsMm: { width: number; depth: number; height: number };
  placement: "perimeter" | "island" | "open" | "surface" | "wall";
  nearestObjectGapMm: number | null;
  snappedTo?: {
    proposalId: string;
    name: string;
    relation: "workstation";
  };
  opening?: {
    hostWallProposalId: string;
    wallIndex: number | null;
    offsetMm: number;
    sillHeightMm: number;
    handing: "left" | "right";
    swing: "inward" | "outward" | "sliding";
  };
};

export type PlanRoomLayoutResult = {
  planId: string;
  roomId: string;
  roomName: string;
  roomCode: string;
  brief: string | null;
  requestedObjects: number;
  plannedObjects: number;
  unplaced: Array<{ assetId: string; assetName: string; reason: string }>;
  aisleMm: number;
  shell: PlannedRoomShell;
  proposals: PlannedRoomObject[];
  basis: string[];
  requiresHumanApproval: true;
};

export type StageRoomLayoutInput = { planId: string };

export type PendingAgentLayoutChange = {
  stageId: string;
  tool: "layout";
  planId: string;
  roomId: string;
  roomName: string;
  brief: string | null;
  beforeScene: Scene;
  proposedScene: Scene;
  proposedObjectIds: string[];
  proposedObjects: Array<{
    objectId: string;
    name: string;
    indexCode: string;
    kind: "wall" | "asset";
    position: { xMm: number; yMm: number; zMm: number; rotationDeg: number };
  }>;
  beforeRoomSize: { width: number; depth: number; wallHeight: number };
  proposedRoomSize: { width: number; depth: number; wallHeight: number };
  baselineDirtyRevision: number;
  createdAt: string;
  status: "pending";
  timestamps: {
    projectUpdatedAt: string;
    roomUpdatedAt: string;
    sceneUpdatedAt: string;
  };
};

export type StageRoomLayoutResult = {
  staged: boolean;
  stageId: string;
  planId: string;
  roomId: string;
  roomName: string;
  objectCount: number;
  wallCount: number;
  assetCount: number;
  floorGenerated: boolean;
  objects: PendingAgentLayoutChange["proposedObjects"];
  persisted: boolean;
  requiresHumanApproval: boolean;
  autoCommitted: boolean;
};

export type CreateLabRoomResult = {
  created: true;
  projectId: string;
  laboratoryId: string;
  laboratoryName: string;
  laboratoryCode: string;
  roomId: string;
  roomName: string;
  roomCode: string;
  floor: number;
  blank: true;
  active: true;
  persisted: true;
  initialLayoutAutoCommitEligible: true;
  requiresHumanApproval: false;
};

export type LabSpaceWorkspaceActions = {
  createRoom: (input: unknown) => Promise<CreateLabRoomResult>;
};

export type LabSpaceLayoutActions = {
  searchLabAssets: (input: unknown) => SearchLabAssetsResult;
  planRoomLayout: (input: unknown) => PlanRoomLayoutResult;
  getRoomPlan: (planId: string) => PlanRoomLayoutResult;
};

export type InventoryLocationSummary = {
  roomId: string;
  roomName: string;
  roomCode: string;
  laboratoryCode: string;
  locationId: string;
  indexCode: string;
  locationType: string;
  path: string[];
  occupiedItems: number;
};

export type ListInventoryLocationsResult = {
  query: string | null;
  roomCode: string | null;
  totalMatches: number;
  returnedMatches: number;
  locations: InventoryLocationSummary[];
};

export type InventoryEntryRequest = {
  roomCode: string;
  name: string;
  quantity: number;
  unit: string;
  storageLocationId?: string;
  owner?: string;
  notes?: string;
  expiryDate?: string | null;
};

export type PlannedInventoryEntry = {
  itemId: string;
  roomId: string;
  roomName: string;
  roomCode: string;
  name: string;
  quantity: number;
  unit: string;
  storageLocationId: string | null;
  locationPath: string[];
  locationIndexCode: string | null;
  owner: string;
  notes: string;
  expiryDate: string | null;
};

export type PlanInventoryResult = {
  planId: string;
  entries: PlannedInventoryEntry[];
  assignedEntries: number;
  unassignedEntries: number;
  warnings: string[];
  requiresHumanApproval: true;
};

export type PendingAgentInventoryChange = {
  stageId: string;
  tool: "inventory";
  planId: string;
  entries: PlannedInventoryEntry[];
  baselineDirtyRevision: number;
  createdAt: string;
  status: "pending";
  projectUpdatedAt: string;
};

export type StageInventoryPlanResult = {
  staged: true;
  stageId: string;
  planId: string;
  entryCount: number;
  assignedEntries: number;
  persisted: false;
  requiresHumanApproval: true;
};

export type LabSpaceInventoryActions = {
  listInventoryLocations: (input: unknown) => ListInventoryLocationsResult;
  planInventory: (input: unknown) => PlanInventoryResult;
  getInventoryPlan: (planId: string) => PlanInventoryResult;
};

export type PendingAgentMoveChange = {
  stageId: string;
  tool: "move";
  roomId: string;
  objectId: string;
  objectName: string;
  objectIndexCode: string;
  before: SceneObject;
  proposed: SceneObject;
  validation: ValidateObjectMoveResult;
  baselineDirtyRevision: number;
  createdAt: string;
  status: "pending";
  timestamps: {
    projectUpdatedAt: string;
    roomUpdatedAt: string;
    sceneUpdatedAt: string;
  };
};

export type PendingAgentResizeChange = {
  stageId: string;
  tool: "resize";
  roomId: string;
  objectId: string;
  objectName: string;
  objectIndexCode: string;
  before: SceneObject;
  proposed: SceneObject;
  validation: ValidateObjectResizeResult;
  baselineDirtyRevision: number;
  createdAt: string;
  status: "pending";
  timestamps: {
    projectUpdatedAt: string;
    roomUpdatedAt: string;
    sceneUpdatedAt: string;
  };
};

export type PendingAgentChange =
  | PendingAgentMoveChange
  | PendingAgentResizeChange
  | PendingAgentLayoutChange
  | PendingAgentInventoryChange;

export type StageObjectMoveResult = {
  staged: boolean;
  stageId: string | null;
  objectId: string;
  objectName: string;
  proposed: { xMm: number; yMm: number; zMm: number; rotationDeg: number };
  valid: boolean;
  persisted: false;
  requiresHumanApproval: boolean;
  conflicts: PlacementConflict[];
};

export type StageObjectResizeResult = {
  staged: boolean;
  stageId: string | null;
  objectId: string;
  objectName: string;
  current: ObjectDimensionsMm;
  proposed: ObjectDimensionsMm;
  valid: boolean;
  persisted: false;
  requiresHumanApproval: boolean;
  conflicts: PlacementConflict[];
};

export type AgentMoveReviewResult = {
  stageId: string;
  objectId: string;
  objectIds?: string[];
  status: "approved" | "cancelled";
  persisted: boolean;
};

export type LabSpaceStagingActions = {
  stageObjectMove: (input: unknown) => StageObjectMoveResult;
  stageObjectResize: (input: unknown) => StageObjectResizeResult;
  stageRoomLayout: (input: unknown) => StageRoomLayoutResult;
  stageInventoryPlan: (input: unknown) => StageInventoryPlanResult;
  approveStagedObjectMove: (stageId: string) => AgentMoveReviewResult;
  cancelStagedObjectMove: (stageId: string) => AgentMoveReviewResult;
  approveStagedChange: (stageId: string) => AgentMoveReviewResult;
  cancelStagedChange: (stageId: string) => AgentMoveReviewResult;
};

export type LabSpaceReadActions = {
  getLabContext: () => LabContext;
  searchLabRecords: (input: unknown) => SearchLabRecordsResult;
  inspectLabRecord: (input: unknown) => LabRecordInspection;
};
