import { buildDigitalTwinIndex } from "../domain/digital-twin-index";
import { ASSET_BY_ID } from "../domain/assets";
import { resolveLayerIdForObjectType } from "../domain/layers";
import {
  deriveDefaultEquipmentId,
  generateChildIndexCode,
  generateObjectIndexCode,
} from "../domain/indexing";
import type {
  AssetDefinition,
  EquipmentRecord,
  Project,
  Room,
  Scene,
  SceneObject,
  StorageLocation,
} from "../domain/schema";
import type { SceneCommand } from "../domain/history";
import { useEditorStore } from "../store/editor-store";
import type {
  AgentMoveReviewResult,
  LabSpaceStagingActions,
  PendingAgentChange,
  PendingAgentLayoutChange,
  PendingAgentMoveChange,
  PlannedWallSegment,
  StageRoomLayoutResult,
  StageObjectMoveResult,
} from "./labspace-action-types";
import { LabSpaceActionError } from "./labspace-read-actions";
import { validateObjectMove } from "./labspace-spatial-actions";
import { agentActivityActions } from "./agent-activity-store";
import { getStoredRoomPlan } from "./labspace-layout-actions";

function resolveObject(project: Project, objectId: string): { room: Room; object: SceneObject } {
  for (const room of project.rooms) {
    if (room.roomKind === "demo-template") continue;
    const object = room.scene.objects.find((entry) => entry.id === objectId);
    if (object) return { room, object };
  }
  throw new LabSpaceActionError("Object not found in the current LabSpace project.");
}

function sameObject(left: SceneObject | undefined, right: SceneObject) {
  return Boolean(left && JSON.stringify(left) === JSON.stringify(right));
}

function sameProposal(
  pending: PendingAgentMoveChange,
  objectId: string,
  target: { xMm: number; yMm: number; zMm: number; rotationDeg: number },
) {
  return (
    pending.objectId === objectId &&
    pending.proposed.position.x === target.xMm &&
    pending.proposed.position.y === target.yMm &&
    pending.proposed.position.z === target.zMm &&
    pending.proposed.rotation.z === target.rotationDeg
  );
}

function activeLaboratoryCode(project: Project, room: Room) {
  return (
    project.laboratories.find((laboratory) => laboratory.id === room.laboratoryId)?.code ?? "LAB"
  );
}

function createEquipmentRecord(object: SceneObject, existing: EquipmentRecord[]): EquipmentRecord {
  return {
    id: crypto.randomUUID(),
    objectId: object.id,
    equipmentId: deriveDefaultEquipmentId(object, existing),
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
    notes: "Added through an approved LabSpace room plan.",
  };
}

function createStorageLocations(
  definition: AssetDefinition,
  object: SceneObject,
  roomId: string,
  now: string,
) {
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
    const location: StorageLocation = {
      id: crypto.randomUUID(),
      roomId,
      objectId: object.id,
      parentId: parent.id,
      type: entry.type,
      name: entry.name,
      indexCode: generateChildIndexCode(parent, entry.type, locations),
      order: locations.filter(
        (candidate) => candidate.parentId === parent.id && candidate.type === entry.type,
      ).length,
      capacityNotes: entry.capacityNotes ?? "",
      childIds: [],
      normalizedBounds: entry.normalizedBounds,
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

function instantiatePlanObject(
  project: Project,
  room: Room,
  scene: Scene,
  planId: string,
  proposal: ReturnType<typeof getStoredRoomPlan>["result"]["proposals"][number],
) {
  const definition = ASSET_BY_ID.get(proposal.assetId);
  if (!definition)
    throw new LabSpaceActionError(`Catalog asset is unavailable: ${proposal.assetId}.`);
  const now = new Date().toISOString();
  const object: SceneObject = {
    id: crypto.randomUUID(),
    indexCode: generateObjectIndexCode(
      room,
      scene,
      definition.objectType,
      room.scene.zones[0]?.id ?? null,
      activeLaboratoryCode(project, room),
    ),
    name: definition.name,
    assetDefinitionId: definition.id,
    objectType: definition.objectType,
    position: {
      x: proposal.position.xMm,
      y: proposal.position.yMm,
      z: proposal.position.zMm,
    },
    dimensions: proposal.dimensionsMm,
    rotation: { x: 0, y: 0, z: proposal.rotationDeg },
    flipHorizontal: false,
    flipVertical: false,
    layerId: resolveLayerIdForObjectType(scene.layers, definition.objectType),
    roomId: room.id,
    zoneId: room.scene.zones[0]?.id ?? null,
    locked: true,
    visible: true,
    metadata: {
      agentPlanPreview: true,
      agentPlanId: planId,
      agentPlanPlacement: proposal.placement,
    },
    createdAt: now,
    updatedAt: now,
    parentObjectId: null,
    childLocationIds: [],
    zIndex: Math.max(0, ...scene.objects.map((entry) => entry.zIndex)) + 1,
  };
  return { definition, object, now };
}

function instantiatePlanWall(
  project: Project,
  room: Room,
  scene: Scene,
  planId: string,
  segment: PlannedWallSegment,
) {
  const definition = ASSET_BY_ID.get("straight-wall");
  if (!definition) throw new LabSpaceActionError("The canonical wall definition is unavailable.");
  const now = new Date().toISOString();
  const start = { x: segment.start.xMm, y: segment.start.yMm };
  const end = { x: segment.end.xMm, y: segment.end.yMm };
  const object: SceneObject = {
    id: crypto.randomUUID(),
    indexCode: generateObjectIndexCode(
      room,
      scene,
      "wall",
      null,
      activeLaboratoryCode(project, room),
    ),
    name: segment.name,
    assetDefinitionId: definition.id,
    objectType: "wall",
    position: {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
      z: 0,
    },
    dimensions: {
      width: segment.lengthMm,
      depth: segment.thicknessMm,
      height: segment.heightMm,
    },
    rotation: {
      x: 0,
      y: 0,
      z: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI,
    },
    flipHorizontal: false,
    flipVertical: false,
    layerId: resolveLayerIdForObjectType(scene.layers, "wall"),
    roomId: room.id,
    zoneId: null,
    locked: true,
    visible: true,
    metadata: {
      agentPlanPreview: true,
      agentPlanId: planId,
      agentPlanShell: true,
    },
    createdAt: now,
    updatedAt: now,
    parentObjectId: null,
    childLocationIds: [],
    zIndex: Math.max(0, ...scene.objects.map((entry) => entry.zIndex)) + 1,
    wall: {
      start,
      end,
      thickness: segment.thicknessMm,
      height: segment.heightMm,
      halfHeight: false,
    },
  };
  return object;
}

function stagedResult(change: PendingAgentMoveChange): StageObjectMoveResult {
  return {
    staged: true,
    stageId: change.stageId,
    objectId: change.objectId,
    objectName: change.objectName,
    proposed: change.validation.target,
    valid: true,
    persisted: false,
    requiresHumanApproval: true,
    conflicts: [],
  };
}

function invalidResult(validation: ReturnType<typeof validateObjectMove>): StageObjectMoveResult {
  return {
    staged: false,
    stageId: null,
    objectId: validation.objectId,
    objectName: validation.objectName,
    proposed: validation.target,
    valid: false,
    persisted: false,
    requiresHumanApproval: false,
    conflicts: validation.conflicts,
  };
}

export function stageObjectMove(input: unknown): StageObjectMoveResult {
  const validation = validateObjectMove(input);
  if (!validation.valid) return invalidResult(validation);

  const state = useEditorStore.getState();
  const existing = state.pendingAgentChange;
  if (existing) {
    if (
      existing.tool === "move" &&
      sameProposal(existing, validation.objectId, validation.target)
    ) {
      return stagedResult(existing);
    }
    throw new LabSpaceActionError(
      "Another agent change is awaiting human review. Approve or cancel it before staging a new move.",
    );
  }
  if (state.saveStatus !== "saved") {
    throw new LabSpaceActionError(
      "LabSpace must finish saving current human edits before an agent move can be staged.",
    );
  }

  const { room, object } = resolveObject(state.project, validation.objectId);
  const stageId = crypto.randomUUID();
  const record = buildDigitalTwinIndex(state.project).find(
    (entry) => entry.roomId === room.id && entry.objectId === object.id,
  );
  const focused = state.applySpatialFocus({
    requestId: crypto.randomUUID(),
    recordId: record?.id ?? `agent-stage:${stageId}`,
    roomId: room.id,
    objectId: object.id,
    locationId: null,
    showStorageAccess: false,
  });
  if (!focused) {
    throw new LabSpaceActionError("LabSpace could not present this move for review.");
  }

  const before = structuredClone(object);
  useEditorStore.getState().previewObject(object.id, {
    position: {
      ...object.position,
      x: validation.target.xMm,
      y: validation.target.yMm,
      z: validation.target.zMm,
    },
    rotation: { ...object.rotation, z: validation.target.rotationDeg },
  });
  const previewState = useEditorStore.getState();
  const previewRoom = previewState.project.rooms.find((entry) => entry.id === room.id)!;
  const proposed = structuredClone(
    previewRoom.scene.objects.find((entry) => entry.id === object.id)!,
  );
  const change: PendingAgentMoveChange = {
    stageId,
    tool: "move",
    roomId: room.id,
    objectId: object.id,
    objectName: object.name,
    objectIndexCode: object.indexCode,
    before,
    proposed,
    validation,
    baselineDirtyRevision: previewState.dirtyRevision,
    createdAt: new Date().toISOString(),
    status: "pending",
    timestamps: {
      projectUpdatedAt: state.project.updatedAt,
      roomUpdatedAt: room.updatedAt,
      sceneUpdatedAt: room.scene.updatedAt,
    },
  };
  useEditorStore.setState({ pendingAgentChange: change });
  return stagedResult(change);
}

function normalizeStageRoomLayoutInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new LabSpaceActionError("Tool input must be a JSON object.");
  }
  const record = input as Record<string, unknown>;
  const unexpected = Object.keys(record).find((key) => key !== "planId");
  if (unexpected) throw new LabSpaceActionError(`Unexpected input field: ${unexpected}.`);
  if (typeof record.planId !== "string" || !record.planId.trim()) {
    throw new LabSpaceActionError("planId must be a non-empty string.");
  }
  return { planId: record.planId.trim() };
}

function layoutStageResult(change: PendingAgentLayoutChange): StageRoomLayoutResult {
  const wallCount = change.proposedObjects.filter((object) => object.kind === "wall").length;
  return {
    staged: true,
    stageId: change.stageId,
    planId: change.planId,
    roomId: change.roomId,
    roomName: change.roomName,
    objectCount: change.proposedObjects.length,
    wallCount,
    assetCount: change.proposedObjects.length - wallCount,
    floorGenerated: wallCount > 0,
    objects: change.proposedObjects,
    persisted: false,
    requiresHumanApproval: true,
  };
}

export function stageRoomLayout(input: unknown): StageRoomLayoutResult {
  const { planId } = normalizeStageRoomLayoutInput(input);
  const stored = getStoredRoomPlan(planId);
  if (!stored.result.proposals.length && stored.result.shell.mode !== "proposed") {
    throw new LabSpaceActionError("That room plan contains no placeable objects or room shell.");
  }
  const state = useEditorStore.getState();
  const existing = state.pendingAgentChange;
  if (existing) {
    if (existing.tool === "layout" && existing.planId === planId)
      return layoutStageResult(existing);
    throw new LabSpaceActionError(
      "Another agent change is awaiting human review. Approve or cancel it before staging a room plan.",
    );
  }
  if (state.saveStatus !== "saved") {
    throw new LabSpaceActionError(
      "LabSpace must finish saving current human edits before a room plan can be staged.",
    );
  }
  const room = state.project.rooms.find((entry) => entry.id === stored.result.roomId);
  if (!room || room.roomKind === "demo-template" || room.id !== state.project.activeRoomId) {
    throw new LabSpaceActionError("Open the room used for this plan before staging it.");
  }
  const currentObjectIds = room.scene.objects.map((object) => object.id).sort();
  if (
    room.scene.updatedAt !== stored.baseline.sceneUpdatedAt ||
    JSON.stringify(currentObjectIds) !== JSON.stringify(stored.baseline.objectIds) ||
    JSON.stringify({ width: room.width, depth: room.depth, wallHeight: room.wallHeight }) !==
      JSON.stringify(stored.baseline.roomSize)
  ) {
    throw new LabSpaceActionError(
      "The room changed after this plan was calculated. Create a fresh plan before staging.",
    );
  }

  const stageId = crypto.randomUUID();
  const beforeScene = structuredClone(room.scene);
  const proposedScene = structuredClone(room.scene);
  const proposedObjects: PendingAgentLayoutChange["proposedObjects"] = [];
  const proposedObjectIds: string[] = [];
  if (stored.result.shell.mode === "proposed") {
    for (const segment of stored.result.shell.segments) {
      const wall = instantiatePlanWall(state.project, room, proposedScene, planId, segment);
      proposedScene.objects.push(wall);
      proposedObjectIds.push(wall.id);
      proposedObjects.push({
        objectId: wall.id,
        name: wall.name,
        indexCode: wall.indexCode,
        kind: "wall",
        position: {
          xMm: wall.position.x,
          yMm: wall.position.y,
          rotationDeg: wall.rotation.z,
        },
      });
    }
  }
  for (const proposal of stored.result.proposals) {
    const { definition, object, now } = instantiatePlanObject(
      state.project,
      room,
      proposedScene,
      planId,
      proposal,
    );
    proposedScene.objects.push(object);
    if (definition.indexingBehavior === "storage") {
      proposedScene.storageLocations.push(
        ...createStorageLocations(definition, object, room.id, now),
      );
    }
    if (definition.objectType === "equipment") {
      proposedScene.equipmentRecords.push(
        createEquipmentRecord(object, proposedScene.equipmentRecords),
      );
    }
    proposedObjectIds.push(object.id);
    proposedObjects.push({
      objectId: object.id,
      name: object.name,
      indexCode: object.indexCode,
      kind: "asset",
      position: {
        xMm: object.position.x,
        yMm: object.position.y,
        rotationDeg: object.rotation.z,
      },
    });
  }
  proposedScene.updatedAt = new Date().toISOString();
  const change: PendingAgentLayoutChange = {
    stageId,
    tool: "layout",
    planId,
    roomId: room.id,
    roomName: room.name,
    brief: stored.result.brief,
    beforeScene,
    proposedScene: structuredClone(proposedScene),
    proposedObjectIds,
    proposedObjects,
    beforeRoomSize: { width: room.width, depth: room.depth, wallHeight: room.wallHeight },
    proposedRoomSize: {
      width: stored.result.shell.widthMm,
      depth: stored.result.shell.depthMm,
      wallHeight: stored.result.shell.wallHeightMm,
    },
    baselineDirtyRevision: state.dirtyRevision,
    createdAt: new Date().toISOString(),
    status: "pending",
    timestamps: {
      projectUpdatedAt: state.project.updatedAt,
      roomUpdatedAt: room.updatedAt,
      sceneUpdatedAt: room.scene.updatedAt,
    },
  };
  const now = new Date().toISOString();
  useEditorStore.setState({
    project: {
      ...state.project,
      updatedAt: now,
      rooms: state.project.rooms.map((entry) =>
        entry.id === room.id
          ? {
              ...entry,
              width: stored.result.shell.widthMm,
              depth: stored.result.shell.depthMm,
              wallHeight: stored.result.shell.wallHeightMm,
              updatedAt: now,
              scene: proposedScene,
            }
          : entry,
      ),
    },
    selectedIds: proposedObjectIds,
    pendingAgentChange: change,
  });
  return layoutStageResult(change);
}

function requirePending(stageId: string): PendingAgentChange {
  const pending = useEditorStore.getState().pendingAgentChange;
  if (!pending || pending.stageId !== stageId) {
    throw new LabSpaceActionError("That staged change is no longer awaiting review.");
  }
  return pending;
}

function cancelMove(pending: PendingAgentMoveChange): AgentMoveReviewResult {
  const stageId = pending.stageId;
  const state = useEditorStore.getState();
  const room = state.project.rooms.find((entry) => entry.id === pending.roomId);
  const current = room?.scene.objects.find((entry) => entry.id === pending.objectId);

  if (room && sameObject(current, pending.proposed)) {
    useEditorStore.setState({
      project: {
        ...state.project,
        updatedAt: pending.timestamps.projectUpdatedAt,
        rooms: state.project.rooms.map((entry) =>
          entry.id === room.id
            ? {
                ...entry,
                updatedAt: pending.timestamps.roomUpdatedAt,
                scene: {
                  ...entry.scene,
                  updatedAt: pending.timestamps.sceneUpdatedAt,
                  objects: entry.scene.objects.map((object) =>
                    object.id === pending.objectId ? pending.before : object,
                  ),
                },
              }
            : entry,
        ),
      },
      pendingAgentChange: null,
    });
  } else {
    useEditorStore.setState({ pendingAgentChange: null });
  }
  useEditorStore.getState().pushToast("Agent move cancelled. The layout was not saved.", "info");
  agentActivityActions.record({
    actor: "Human",
    action: "Move rejected",
    subject: pending.objectName,
    status: "rejected",
    evidence: "Preview removed · project data unchanged",
  });
  return {
    stageId,
    objectId: pending.objectId,
    status: "cancelled",
    persisted: false,
  };
}

function approveMove(pending: PendingAgentMoveChange): AgentMoveReviewResult {
  const stageId = pending.stageId;
  const state = useEditorStore.getState();
  const room = state.project.rooms.find((entry) => entry.id === pending.roomId);
  const current = room?.scene.objects.find((entry) => entry.id === pending.objectId);
  if (
    state.dirtyRevision !== pending.baselineDirtyRevision ||
    !sameObject(current, pending.proposed)
  ) {
    cancelStagedObjectMove(stageId);
    throw new LabSpaceActionError(
      "The staged move became stale because the layout changed. It was not committed.",
    );
  }

  useEditorStore.setState({ pendingAgentChange: null });
  useEditorStore.getState().commitPreview(pending.before, "Approve agent move");
  useEditorStore
    .getState()
    .pushToast("Agent move approved. LabSpace is saving the change.", "success");
  agentActivityActions.record({
    actor: "Human",
    action: "Move approved",
    subject: pending.objectName,
    status: "approved",
    evidence: "Explicit researcher approval",
  });
  agentActivityActions.record({
    actor: "LabSpace",
    action: "Change committed",
    subject: pending.objectName,
    status: "committed",
    evidence: "One history entry · Undo available",
  });
  return {
    stageId,
    objectId: pending.objectId,
    status: "approved",
    persisted: false,
  };
}

function cancelLayout(pending: PendingAgentLayoutChange): AgentMoveReviewResult {
  const state = useEditorStore.getState();
  const room = state.project.rooms.find((entry) => entry.id === pending.roomId);
  if (
    room &&
    JSON.stringify(room.scene) === JSON.stringify(pending.proposedScene) &&
    room.width === pending.proposedRoomSize.width &&
    room.depth === pending.proposedRoomSize.depth &&
    room.wallHeight === pending.proposedRoomSize.wallHeight
  ) {
    useEditorStore.setState({
      project: {
        ...state.project,
        updatedAt: pending.timestamps.projectUpdatedAt,
        rooms: state.project.rooms.map((entry) =>
          entry.id === pending.roomId
            ? {
                ...entry,
                ...pending.beforeRoomSize,
                updatedAt: pending.timestamps.roomUpdatedAt,
                scene: pending.beforeScene,
              }
            : entry,
        ),
      },
      selectedIds: [],
      pendingAgentChange: null,
    });
  } else {
    useEditorStore.setState({ pendingAgentChange: null });
  }
  useEditorStore
    .getState()
    .pushToast("Agent room plan cancelled. The room was not changed.", "info");
  agentActivityActions.record({
    actor: "Human",
    action: "Room plan rejected",
    subject: `${pending.proposedObjects.length} proposed room elements`,
    status: "rejected",
    evidence: "Blueprint preview removed · project data unchanged",
  });
  return {
    stageId: pending.stageId,
    objectId: pending.proposedObjectIds[0] ?? pending.planId,
    objectIds: pending.proposedObjectIds,
    status: "cancelled",
    persisted: false,
  };
}

function committedLayoutScene(pending: PendingAgentLayoutChange, scene: Scene) {
  const proposedIds = new Set(pending.proposedObjectIds);
  return {
    ...scene,
    updatedAt: new Date().toISOString(),
    objects: scene.objects.map((object) => {
      if (!proposedIds.has(object.id)) return object;
      const metadata = { ...object.metadata };
      delete metadata.agentPlanPreview;
      delete metadata.agentPlanId;
      delete metadata.agentPlanPlacement;
      delete metadata.agentPlanShell;
      return { ...object, locked: false, metadata, updatedAt: new Date().toISOString() };
    }),
  };
}

function approveLayout(pending: PendingAgentLayoutChange): AgentMoveReviewResult {
  const state = useEditorStore.getState();
  const room = state.project.rooms.find((entry) => entry.id === pending.roomId);
  if (
    !room ||
    state.dirtyRevision !== pending.baselineDirtyRevision ||
    JSON.stringify(room.scene) !== JSON.stringify(pending.proposedScene) ||
    room.width !== pending.proposedRoomSize.width ||
    room.depth !== pending.proposedRoomSize.depth ||
    room.wallHeight !== pending.proposedRoomSize.wallHeight
  ) {
    cancelLayout(pending);
    throw new LabSpaceActionError(
      "The staged room plan became stale because the layout changed. It was not committed.",
    );
  }
  const after = committedLayoutScene(pending, room.scene);
  const command: SceneCommand = {
    id: crypto.randomUUID(),
    label: `Approve agent room plan (${pending.proposedObjects.length} elements)`,
    kind: "scene",
    before: pending.beforeScene,
    after,
    roomBefore: pending.beforeRoomSize,
    roomAfter: pending.proposedRoomSize,
  };
  const now = new Date().toISOString();
  useEditorStore.setState({
    project: {
      ...state.project,
      updatedAt: now,
      rooms: state.project.rooms.map((entry) =>
        entry.id === pending.roomId
          ? { ...entry, ...pending.proposedRoomSize, updatedAt: now, scene: after }
          : entry,
      ),
    },
    selectedIds: pending.proposedObjectIds,
    pendingAgentChange: null,
    history: [...state.history, command],
    future: [],
    saveStatus: "unsaved",
    dirtyRevision: state.dirtyRevision + 1,
  });
  useEditorStore
    .getState()
    .pushToast(
      `Room plan approved. LabSpace is saving the room shell and ${pending.proposedObjects.filter((object) => object.kind === "asset").length} assets.`,
      "success",
    );
  agentActivityActions.record({
    actor: "Human",
    action: "Room plan approved",
    subject: `${pending.proposedObjects.length} planned elements in ${pending.roomName}`,
    status: "approved",
    evidence: "Explicit researcher approval",
  });
  agentActivityActions.record({
    actor: "LabSpace",
    action: "Layout committed",
    subject: pending.roomName,
    status: "committed",
    evidence: "Objects and index records committed as one history entry · Undo available",
  });
  return {
    stageId: pending.stageId,
    objectId: pending.proposedObjectIds[0] ?? pending.planId,
    objectIds: pending.proposedObjectIds,
    status: "approved",
    persisted: false,
  };
}

export function cancelStagedChange(stageId: string): AgentMoveReviewResult {
  const pending = requirePending(stageId);
  return pending.tool === "layout" ? cancelLayout(pending) : cancelMove(pending);
}

export function approveStagedChange(stageId: string): AgentMoveReviewResult {
  const pending = requirePending(stageId);
  return pending.tool === "layout" ? approveLayout(pending) : approveMove(pending);
}

export function cancelStagedObjectMove(stageId: string): AgentMoveReviewResult {
  const pending = requirePending(stageId);
  if (pending.tool !== "move") throw new LabSpaceActionError("That staged change is a room plan.");
  return cancelMove(pending);
}

export function approveStagedObjectMove(stageId: string): AgentMoveReviewResult {
  const pending = requirePending(stageId);
  if (pending.tool !== "move") throw new LabSpaceActionError("That staged change is a room plan.");
  return approveMove(pending);
}

export const labSpaceStagingActions: LabSpaceStagingActions = {
  stageObjectMove,
  stageRoomLayout,
  approveStagedObjectMove,
  cancelStagedObjectMove,
  approveStagedChange,
  cancelStagedChange,
};
