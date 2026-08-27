import { buildDigitalTwinIndex } from "../domain/digital-twin-index";
import type { Project } from "../domain/schema";
import { useEditorStore, type SpatialFocusRequest } from "../store/editor-store";
import type {
  FocusLabRecordInput,
  FocusLabRecordOptions,
  FocusLabRecordResult,
  LabSpaceNavigationActions,
} from "./labspace-action-types";
import { LabSpaceActionError } from "./labspace-read-actions";

const MAX_RECORD_ID_LENGTH = 300;

export type LabSpaceNavigationPort = {
  readProject: () => Project;
  applyFocus: (focus: SpatialFocusRequest) => boolean;
};

function defaultNavigationPort(): LabSpaceNavigationPort {
  return {
    readProject: () => useEditorStore.getState().project,
    applyFocus: (focus) => useEditorStore.getState().applySpatialFocus(focus),
  };
}

function normalizeFocusInput(input: unknown): FocusLabRecordInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new LabSpaceActionError("Tool input must be a JSON object.");
  }
  const record = input as Record<string, unknown>;
  const unexpected = Object.keys(record).find((key) => key !== "recordId");
  if (unexpected) throw new LabSpaceActionError(`Unexpected input field: ${unexpected}.`);
  if (typeof record.recordId !== "string") {
    throw new LabSpaceActionError("Record ID must be a string.");
  }
  const recordId = record.recordId.trim();
  if (!recordId) throw new LabSpaceActionError("Record ID cannot be empty.");
  if (recordId.length > MAX_RECORD_ID_LENGTH) {
    throw new LabSpaceActionError(`Record ID must be ${MAX_RECORD_ID_LENGTH} characters or fewer.`);
  }
  return { recordId };
}

function compactText(value: string, maximum: number) {
  const trimmed = value.trim();
  return trimmed.length <= maximum ? trimmed : `${trimmed.slice(0, maximum - 1)}…`;
}

export function focusLabRecord(
  input: unknown,
  options: FocusLabRecordOptions = {},
  port: LabSpaceNavigationPort = defaultNavigationPort(),
): FocusLabRecordResult {
  const { recordId } = normalizeFocusInput(input);
  const project = port.readProject();
  const record = buildDigitalTwinIndex(project).find((entry) => entry.id === recordId);
  if (!record) {
    throw new LabSpaceActionError("Record not found in the current LabSpace project.");
  }
  const room = project.rooms.find(
    (entry) => entry.id === record.roomId && entry.roomKind !== "demo-template",
  );
  if (!room) {
    throw new LabSpaceActionError("Record not found in the current LabSpace project.");
  }
  if (!record.objectId) {
    throw new LabSpaceActionError("This record has no physical object to focus.");
  }
  const object = room.scene.objects.find((entry) => entry.id === record.objectId);
  if (!object) {
    throw new LabSpaceActionError("The physical object for this record is unavailable.");
  }
  const location = record.locationId
    ? room.scene.storageLocations.find(
        (entry) => entry.id === record.locationId && entry.objectId === object.id,
      )
    : null;
  if (record.locationId && !location) {
    throw new LabSpaceActionError("The exact storage location for this record is unavailable.");
  }

  const applied = port.applyFocus({
    requestId: crypto.randomUUID(),
    recordId: record.id,
    roomId: room.id,
    objectId: object.id,
    locationId: location?.id ?? null,
    showStorageAccess: Boolean(options.revealStorage ?? record.locationId),
  });
  if (!applied) {
    throw new LabSpaceActionError("LabSpace could not focus the current physical record.");
  }

  return {
    recordId: record.id,
    kind: record.kind,
    name: compactText(record.name, 120),
    laboratoryCode: record.laboratoryCode,
    roomCode: record.roomCode,
    objectId: object.id,
    locationId: location?.id ?? null,
    path: record.path.map((part) => compactText(part, 80)),
    focused: true,
  };
}

export function createLabSpaceNavigationActions(
  port: LabSpaceNavigationPort,
): LabSpaceNavigationActions {
  return {
    focusLabRecord: (input, options) => focusLabRecord(input, options, port),
  };
}

export const labSpaceNavigationActions: LabSpaceNavigationActions = {
  focusLabRecord: (input, options) => focusLabRecord(input, options),
};
