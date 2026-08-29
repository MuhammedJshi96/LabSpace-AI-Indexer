import { inferFacilityFloorFromRoomCode } from "../domain/facility";
import type { Project, Room } from "../domain/schema";
import { useEditorStore } from "../store/editor-store";
import type { CreateLabRoomResult, LabSpaceWorkspaceActions } from "./labspace-action-types";
import { LabSpaceActionError } from "./labspace-read-actions";

type InitialLayoutCapability = {
  dirtyRevision: number;
  sceneUpdatedAt: string;
};

const initialLayoutCapabilities = new Map<string, InitialLayoutCapability>();

function plainObject(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new LabSpaceActionError("Tool input must be a JSON object.");
  }
  return input as Record<string, unknown>;
}

function requiredText(value: unknown, label: string, maximum: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new LabSpaceActionError(`${label} must be a non-empty string.`);
  }
  const normalized = value.trim();
  if (normalized.length > maximum) {
    throw new LabSpaceActionError(`${label} must be ${maximum} characters or fewer.`);
  }
  return normalized;
}

function optionalText(value: unknown, label: string, maximum: number) {
  if (value === undefined) return undefined;
  return requiredText(value, label, maximum);
}

function resolveLaboratory(project: Project, laboratoryId?: string, laboratoryCode?: string) {
  if (laboratoryId) {
    const laboratory = project.laboratories.find((entry) => entry.id === laboratoryId);
    if (!laboratory) throw new LabSpaceActionError("The requested laboratory was not found.");
    if (laboratoryCode && laboratory.code.toLowerCase() !== laboratoryCode.toLowerCase()) {
      throw new LabSpaceActionError(
        "laboratoryId and laboratoryCode refer to different laboratories.",
      );
    }
    return laboratory;
  }
  if (laboratoryCode) {
    const matches = project.laboratories.filter(
      (entry) => entry.code.toLowerCase() === laboratoryCode.toLowerCase(),
    );
    if (matches.length !== 1) {
      throw new LabSpaceActionError("The requested laboratory code was not found or is ambiguous.");
    }
    return matches[0];
  }
  const activeRoom = project.rooms.find((entry) => entry.id === project.activeRoomId);
  const laboratory = project.laboratories.find((entry) => entry.id === activeRoom?.laboratoryId);
  if (!laboratory) throw new LabSpaceActionError("Open a laboratory before creating a room.");
  return laboratory;
}

function normalizeCreateRoomInput(input: unknown) {
  const record = plainObject(input);
  const allowed = ["name", "code", "laboratoryId", "laboratoryCode", "floor"];
  const unexpected = Object.keys(record).find((key) => !allowed.includes(key));
  if (unexpected) throw new LabSpaceActionError(`Unexpected input field: ${unexpected}.`);
  const floor =
    record.floor === undefined
      ? undefined
      : Number.isInteger(record.floor) && Number(record.floor) >= 1 && Number(record.floor) <= 15
        ? Number(record.floor)
        : null;
  if (floor === null) throw new LabSpaceActionError("floor must be an integer from 1 to 15.");
  return {
    name: requiredText(record.name, "Room name", 120),
    code: requiredText(record.code, "Room code", 40),
    laboratoryId: optionalText(record.laboratoryId, "laboratoryId", 120),
    laboratoryCode: optionalText(record.laboratoryCode, "laboratoryCode", 40),
    floor,
  };
}

function isPristineRoom(room: Room) {
  return (
    room.roomKind !== "demo-template" &&
    room.scene.objects.length === 0 &&
    room.scene.storageLocations.length === 0 &&
    room.scene.inventoryItems.length === 0 &&
    room.scene.equipmentRecords.length === 0
  );
}

async function waitForWorkspaceHydration(timeoutMs = 10_000) {
  if (useEditorStore.getState().hydrated) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      reject(new LabSpaceActionError("LabSpace is still loading the project. Try again shortly."));
    }, timeoutMs);
    const unsubscribe = useEditorStore.subscribe((state) => {
      if (!state.hydrated) return;
      window.clearTimeout(timeout);
      unsubscribe();
      resolve();
    });
  });
}

export function isInitialRoomPlanAutoCommitEligible(
  roomId: string,
  dirtyRevision: number,
  room: Room,
) {
  const capability = initialLayoutCapabilities.get(roomId);
  const eligible = Boolean(
    capability &&
    capability.dirtyRevision === dirtyRevision &&
    capability.sceneUpdatedAt === room.scene.updatedAt &&
    isPristineRoom(room),
  );
  if (!eligible && capability) initialLayoutCapabilities.delete(roomId);
  return eligible;
}

export function consumeInitialRoomPlanAutoCommit(roomId: string) {
  initialLayoutCapabilities.delete(roomId);
}

export function clearInitialRoomPlanCapabilities() {
  initialLayoutCapabilities.clear();
}

export async function createLabRoom(input: unknown): Promise<CreateLabRoomResult> {
  const normalized = normalizeCreateRoomInput(input);
  await waitForWorkspaceHydration();
  let before = useEditorStore.getState();
  if (before.pendingAgentChange) {
    throw new LabSpaceActionError(
      "Approve or cancel the current agent preview before creating a room.",
    );
  }
  if (before.saveStatus !== "saved") {
    await before.saveNow();
    before = useEditorStore.getState();
  }
  if (before.saveStatus !== "saved") {
    throw new LabSpaceActionError(
      "LabSpace must finish saving current edits before WebMCP creates a room.",
    );
  }
  const laboratory = resolveLaboratory(
    before.project,
    normalized.laboratoryId,
    normalized.laboratoryCode,
  );
  if (
    before.project.rooms.some(
      (room) =>
        room.laboratoryId === laboratory.id &&
        room.code.toLowerCase() === normalized.code.toLowerCase(),
    )
  ) {
    throw new LabSpaceActionError(
      `${laboratory.name} already has a room with code ${normalized.code}.`,
    );
  }

  const roomId = useEditorStore.getState().createRoom({
    laboratoryId: laboratory.id,
    name: normalized.name,
    code: normalized.code,
  });
  if (!roomId) throw new LabSpaceActionError("LabSpace could not create the requested room.");

  const floor = normalized.floor ?? inferFacilityFloorFromRoomCode(normalized.code) ?? 1;
  useEditorStore.getState().updateRoomFacilityPlacement(roomId, { floor: floor - 1 });
  await useEditorStore.getState().saveNow();

  const state = useEditorStore.getState();
  const room = state.project.rooms.find((entry) => entry.id === roomId);
  if (!room || state.saveStatus !== "saved" || !isPristineRoom(room)) {
    throw new LabSpaceActionError(
      "The blank room was created locally, but LabSpace could not verify its saved initial state.",
    );
  }
  initialLayoutCapabilities.set(roomId, {
    dirtyRevision: state.dirtyRevision,
    sceneUpdatedAt: room.scene.updatedAt,
  });

  return {
    created: true,
    projectId: state.project.id,
    laboratoryId: laboratory.id,
    laboratoryName: laboratory.name,
    laboratoryCode: laboratory.code,
    roomId,
    roomName: room.name,
    roomCode: room.code,
    floor,
    blank: true,
    active: true,
    persisted: true,
    initialLayoutAutoCommitEligible: true,
    requiresHumanApproval: false,
  };
}

export function createLabSpaceWorkspaceActions(): LabSpaceWorkspaceActions {
  return { createRoom: createLabRoom };
}

export const labSpaceWorkspaceActions: LabSpaceWorkspaceActions = {
  createRoom: createLabRoom,
};
