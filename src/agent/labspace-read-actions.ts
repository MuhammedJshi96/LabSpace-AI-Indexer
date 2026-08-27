import {
  buildDigitalTwinIndex,
  filterDigitalTwinIndex,
  type DigitalTwinRecord,
  type DigitalTwinRecordKind,
  type DigitalTwinScope,
} from "../domain/digital-twin-index";
import type { Project, Room } from "../domain/schema";
import { useEditorStore } from "../store/editor-store";
import type {
  InspectLabRecordInput,
  LabContext,
  LabRecordInspection,
  LabRecordSearchResult,
  LabSpaceReadActions,
  LabSpaceReadState,
  LabSpaceStateReader,
  SearchLabRecordsInput,
  SearchLabRecordsResult,
} from "./labspace-action-types";

const DEFAULT_SEARCH_LIMIT = 8;
const MAX_SEARCH_LIMIT = 12;
const MAX_QUERY_LENGTH = 120;
const MAX_RECORD_ID_LENGTH = 300;
const SEARCH_OUTPUT_BUDGET = 1_450;
const RECORD_KINDS = new Set<DigitalTwinRecordKind>(["inventory", "equipment", "location"]);

export class LabSpaceActionError extends Error {
  override name = "LabSpaceActionError";
}

function readCurrentEditorState(): LabSpaceReadState {
  const state = useEditorStore.getState();
  return {
    project: state.project,
    selectedObjectIds: [...state.selectedIds],
    selectedStorageLocationId: state.selectedLocationId,
  };
}

function activeSearchableRoom(project: Project) {
  const active = project.rooms.find((room) => room.id === project.activeRoomId);
  if (active?.roomKind !== "demo-template") return active;
  return project.rooms.find((room) => room.roomKind !== "demo-template") ?? active;
}

function requireWorkspace(state: LabSpaceReadState) {
  const room = activeSearchableRoom(state.project);
  if (!room) throw new LabSpaceActionError("No active LabSpace room is available.");
  const laboratory = state.project.laboratories.find((entry) => entry.id === room.laboratoryId);
  if (!laboratory) {
    throw new LabSpaceActionError("The active room has no recorded laboratory.");
  }
  return { project: state.project, laboratory, room };
}

function requireObjectInput(input: unknown, allowedKeys: string[]) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new LabSpaceActionError("Tool input must be a JSON object.");
  }
  const record = input as Record<string, unknown>;
  const unexpected = Object.keys(record).find((key) => !allowedKeys.includes(key));
  if (unexpected) throw new LabSpaceActionError(`Unexpected input field: ${unexpected}.`);
  return record;
}

function normalizeSearchInput(input: unknown): Required<Omit<SearchLabRecordsInput, "kinds">> & {
  kinds: DigitalTwinRecordKind[];
} {
  const record = requireObjectInput(input, ["query", "scope", "kinds", "limit"]);
  if (typeof record.query !== "string") {
    throw new LabSpaceActionError("Search query must be a string.");
  }
  const query = record.query.trim();
  if (!query) throw new LabSpaceActionError("Search query cannot be empty.");
  if (query.length > MAX_QUERY_LENGTH) {
    throw new LabSpaceActionError(`Search query must be ${MAX_QUERY_LENGTH} characters or fewer.`);
  }

  const scope = record.scope ?? "project";
  if (scope !== "project" && scope !== "room") {
    throw new LabSpaceActionError('Search scope must be "project" or "room".');
  }

  if (record.kinds !== undefined && !Array.isArray(record.kinds)) {
    throw new LabSpaceActionError("Search kinds must be an array.");
  }
  const kinds = Array.from(new Set((record.kinds ?? []) as unknown[]));
  if (
    kinds.some(
      (kind) =>
        typeof kind !== "string" || !RECORD_KINDS.has(kind as DigitalTwinRecordKind),
    )
  ) {
    throw new LabSpaceActionError(
      'Search kinds may contain only "inventory", "equipment", or "location".',
    );
  }

  const limit = record.limit ?? DEFAULT_SEARCH_LIMIT;
  if (!Number.isInteger(limit) || Number(limit) < 1 || Number(limit) > MAX_SEARCH_LIMIT) {
    throw new LabSpaceActionError(`Search limit must be an integer from 1 to ${MAX_SEARCH_LIMIT}.`);
  }

  return {
    query,
    scope: scope as DigitalTwinScope,
    kinds: kinds as DigitalTwinRecordKind[],
    limit: Number(limit),
  };
}

function normalizeInspectInput(input: unknown): InspectLabRecordInput {
  const record = requireObjectInput(input, ["recordId"]);
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

function nullableText(value: string, maximum = 320) {
  const compact = compactText(value, maximum);
  return compact || null;
}

function compactSearchRecord(record: DigitalTwinRecord): LabRecordSearchResult {
  return {
    recordId: record.id,
    kind: record.kind,
    name: compactText(record.name, 120),
    laboratoryCode: record.laboratoryCode,
    roomCode: record.roomCode,
    indexCode: record.indexCode,
    path: record.path.map((part) => compactText(part, 80)),
    status: compactText(record.status, 80),
  };
}

function fitSearchResults(
  query: string,
  scope: DigitalTwinScope,
  totalMatches: number,
  candidates: LabRecordSearchResult[],
) {
  const results: LabRecordSearchResult[] = [];
  for (const candidate of candidates) {
    const next = [...results, candidate];
    const length = JSON.stringify({
      query,
      scope,
      totalMatches,
      returnedMatches: next.length,
      results: next,
    }).length;
    if (length > SEARCH_OUTPUT_BUDGET && results.length) break;
    results.push(candidate);
  }
  return results;
}

function entityId(record: DigitalTwinRecord) {
  const prefix = `${record.roomId}:${record.kind}:`;
  if (!record.id.startsWith(prefix)) {
    throw new LabSpaceActionError("The indexed record has an invalid canonical identifier.");
  }
  return record.id.slice(prefix.length);
}

function recordWorkspace(record: DigitalTwinRecord) {
  return {
    laboratory: {
      id: record.laboratoryId,
      name: compactText(record.laboratoryName, 120),
      code: record.laboratoryCode,
    },
    room: {
      id: record.roomId,
      name: compactText(record.roomName, 120),
      code: record.roomCode,
    },
    indexCode: record.indexCode,
    path: record.path.map((part) => compactText(part, 80)),
  };
}

function requireRecordRoom(project: Project, record: DigitalTwinRecord): Room {
  const room = project.rooms.find((entry) => entry.id === record.roomId);
  if (!room || room.roomKind === "demo-template") {
    throw new LabSpaceActionError("Record not found in the current LabSpace project.");
  }
  return room;
}

export function getLabContext(readState: LabSpaceStateReader = readCurrentEditorState): LabContext {
  const state = readState();
  const { project, laboratory, room } = requireWorkspace(state);
  const records = buildDigitalTwinIndex(project);
  return {
    project: { id: project.id, name: compactText(project.name, 120) },
    laboratory: {
      id: laboratory.id,
      name: compactText(laboratory.name, 120),
      code: laboratory.code,
    },
    room: {
      id: room.id,
      name: compactText(room.name, 120),
      code: room.code,
      kind: room.roomKind ?? "standard",
    },
    selection: {
      objectIds: [...state.selectedObjectIds],
      storageLocationId: state.selectedStorageLocationId,
    },
    counts: {
      inventory: records.filter((record) => record.kind === "inventory").length,
      equipment: records.filter((record) => record.kind === "equipment").length,
      locations: records.filter((record) => record.kind === "location").length,
      alerts: records.filter((record) => record.statusTone === "warning").length,
    },
  };
}

export function searchLabRecords(
  input: unknown,
  readState: LabSpaceStateReader = readCurrentEditorState,
): SearchLabRecordsResult {
  const normalized = normalizeSearchInput(input);
  const state = readState();
  const { project, room } = requireWorkspace(state);
  const records = buildDigitalTwinIndex(project);
  const searched = filterDigitalTwinIndex(records, {
    query: normalized.query,
    mode: "browse",
    scope: normalized.scope,
    activeRoomId: room.id,
  });
  const kindFiltered = normalized.kinds.length
    ? searched.filter((record) => normalized.kinds.includes(record.kind))
    : searched;
  const candidates = kindFiltered.slice(0, normalized.limit).map(compactSearchRecord);
  const results = fitSearchResults(
    normalized.query,
    normalized.scope,
    kindFiltered.length,
    candidates,
  );
  return {
    query: normalized.query,
    scope: normalized.scope,
    totalMatches: kindFiltered.length,
    returnedMatches: results.length,
    results,
  };
}

export function inspectLabRecord(
  input: unknown,
  readState: LabSpaceStateReader = readCurrentEditorState,
): LabRecordInspection {
  const { recordId } = normalizeInspectInput(input);
  const state = readState();
  const records = buildDigitalTwinIndex(state.project);
  const record = records.find((entry) => entry.id === recordId);
  if (!record) {
    throw new LabSpaceActionError("Record not found in the current LabSpace project.");
  }
  const room = requireRecordRoom(state.project, record);
  const id = entityId(record);
  const workspace = recordWorkspace(record);

  if (record.kind === "inventory") {
    const item = room.scene.inventoryItems.find((entry) => entry.id === id);
    if (!item) throw new LabSpaceActionError("Record not found in the current LabSpace project.");
    return {
      kind: "inventory",
      recordId: record.id,
      name: compactText(item.name, 120),
      quantity: { value: item.quantity, unit: compactText(item.unit, 40) },
      owner: nullableText(item.owner, 120),
      expiryDate: item.expiryDate,
      status: record.status,
      ...workspace,
      notes: nullableText(item.notes),
    };
  }

  if (record.kind === "equipment") {
    const equipment = room.scene.equipmentRecords.find((entry) => entry.id === id);
    if (!equipment) {
      throw new LabSpaceActionError("Record not found in the current LabSpace project.");
    }
    return {
      kind: "equipment",
      recordId: record.id,
      name: compactText(equipment.name, 120),
      equipmentId: equipment.equipmentId,
      status: record.status,
      manufacturer: nullableText(equipment.manufacturer, 120),
      model: nullableText(equipment.model, 120),
      serialNumber: nullableText(equipment.serialNumber, 120),
      responsiblePerson: nullableText(equipment.responsiblePerson, 120),
      service: {
        lastDate: equipment.lastServiceDate,
        nextDate: equipment.nextServiceDate,
      },
      utilities: {
        power: nullableText(equipment.powerRequirements, 120),
        water: nullableText(equipment.waterRequirements, 120),
        gas: nullableText(equipment.gasRequirements, 120),
        drainRequired: equipment.drainRequired,
        ventilationRequired: equipment.ventilationRequired,
      },
      ...workspace,
      notes: nullableText(equipment.notes),
    };
  }

  const location = room.scene.storageLocations.find((entry) => entry.id === id);
  if (!location) {
    throw new LabSpaceActionError("Record not found in the current LabSpace project.");
  }
  const contents = room.scene.inventoryItems.filter(
    (item) => item.storageLocationId === location.id,
  );
  return {
    kind: "location",
    recordId: record.id,
    name: compactText(location.name, 120),
    locationType: location.type,
    status: record.status,
    capacityNote: nullableText(location.capacityNotes, 180),
    ...workspace,
    contents: {
      totalItems: contents.length,
      items: contents.slice(0, 6).map((item) => ({
        name: compactText(item.name, 120),
        quantity: item.quantity,
        unit: compactText(item.unit, 40),
      })),
    },
  };
}

export function createLabSpaceReadActions(readState: LabSpaceStateReader): LabSpaceReadActions {
  return {
    getLabContext: () => getLabContext(readState),
    searchLabRecords: (input) => searchLabRecords(input, readState),
    inspectLabRecord: (input) => inspectLabRecord(input, readState),
  };
}

export const labSpaceReadActions = createLabSpaceReadActions(readCurrentEditorState);
