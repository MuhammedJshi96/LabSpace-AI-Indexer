import { buildDigitalTwinIndex } from "../domain/digital-twin-index";
import type { Project, Room, SceneObject } from "../domain/schema";
import { useEditorStore } from "../store/editor-store";
import type {
  AgentMoveReviewResult,
  LabSpaceStagingActions,
  PendingAgentMoveChange,
  StageObjectMoveResult,
} from "./labspace-action-types";
import { LabSpaceActionError } from "./labspace-read-actions";
import { validateObjectMove } from "./labspace-spatial-actions";
import { agentActivityActions } from "./agent-activity-store";

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
  target: { xMm: number; yMm: number; rotationDeg: number },
) {
  return (
    pending.objectId === objectId &&
    pending.proposed.position.x === target.xMm &&
    pending.proposed.position.y === target.yMm &&
    pending.proposed.rotation.z === target.rotationDeg
  );
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

function invalidResult(
  validation: ReturnType<typeof validateObjectMove>,
): StageObjectMoveResult {
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
    if (sameProposal(existing, validation.objectId, validation.target)) return stagedResult(existing);
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

function requirePending(stageId: string) {
  const pending = useEditorStore.getState().pendingAgentChange;
  if (!pending || pending.stageId !== stageId) {
    throw new LabSpaceActionError("That staged change is no longer awaiting review.");
  }
  return pending;
}

export function cancelStagedObjectMove(stageId: string): AgentMoveReviewResult {
  const pending = requirePending(stageId);
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

export function approveStagedObjectMove(stageId: string): AgentMoveReviewResult {
  const pending = requirePending(stageId);
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
  useEditorStore.getState().pushToast("Agent move approved. LabSpace is saving the change.", "success");
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

export const labSpaceStagingActions: LabSpaceStagingActions = {
  stageObjectMove,
  approveStagedObjectMove,
  cancelStagedObjectMove,
};
