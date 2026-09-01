import type { Project, Room, StorageLocation } from "../domain/schema";
import { useEditorStore } from "../store/editor-store";
import type {
  InventoryEntryRequest,
  LabSpaceInventoryActions,
  ListInventoryLocationsResult,
  PlanInventoryResult,
  PlannedInventoryEntry,
} from "./labspace-action-types";
import { LabSpaceActionError } from "./labspace-read-actions";

type StoredInventoryPlan = {
  result: PlanInventoryResult;
  baseline: { projectUpdatedAt: string; roomUpdatedAt: Record<string, string> };
};

const plans = new Map<string, StoredInventoryPlan>();
const MAX_PLANS = 12;

function currentProject() {
  return useEditorStore.getState().project;
}

function objectInput(input: unknown, label = "Tool input") {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new LabSpaceActionError(`${label} must be a JSON object.`);
  }
  return input as Record<string, unknown>;
}

function rejectUnexpected(record: Record<string, unknown>, allowed: string[]) {
  const unexpected = Object.keys(record).find((key) => !allowed.includes(key));
  if (unexpected) throw new LabSpaceActionError(`Unexpected input field: ${unexpected}.`);
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function eligibleRooms(project: Project) {
  return project.rooms.filter((room) => room.roomKind !== "demo-template");
}

function resolveRoom(project: Project, roomCode: string) {
  const matches = eligibleRooms(project).filter(
    (room) => room.code.toLowerCase() === roomCode.trim().toLowerCase(),
  );
  if (matches.length !== 1) {
    throw new LabSpaceActionError(
      matches.length
        ? `Room code ${roomCode} is ambiguous.`
        : `Editable room ${roomCode} was not found.`,
    );
  }
  return matches[0];
}

function pathFor(room: Room, location: StorageLocation) {
  const names: string[] = [];
  const visited = new Set<string>();
  let current: StorageLocation | undefined = location;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    names.unshift(current.name);
    current = current.parentId
      ? room.scene.storageLocations.find((entry) => entry.id === current?.parentId)
      : undefined;
  }
  return names;
}

export function listInventoryLocations(
  input: unknown,
  readProject: () => Project = currentProject,
): ListInventoryLocationsResult {
  const record = objectInput(input);
  rejectUnexpected(record, ["query", "roomCode", "limit"]);
  const query = record.query === undefined ? null : String(record.query).trim();
  const roomCode = record.roomCode === undefined ? null : String(record.roomCode).trim();
  if (query !== null && (!query || query.length > 120)) {
    throw new LabSpaceActionError("query must contain 1 to 120 characters when supplied.");
  }
  if (roomCode !== null && (!roomCode || roomCode.length > 40)) {
    throw new LabSpaceActionError("roomCode must contain 1 to 40 characters when supplied.");
  }
  const limit = record.limit === undefined ? 20 : Number(record.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new LabSpaceActionError("limit must be an integer from 1 to 50.");
  }
  const project = readProject();
  const term = query?.toLowerCase() ?? "";
  const matches = eligibleRooms(project).flatMap((room) => {
    const laboratory = project.laboratories.find((entry) => entry.id === room.laboratoryId);
    if (roomCode && room.code.toLowerCase() !== roomCode.toLowerCase()) return [];
    return room.scene.storageLocations.flatMap((location) => {
      const path = pathFor(room, location);
      const searchable = [room.name, room.code, location.name, location.indexCode, ...path]
        .join(" ")
        .toLowerCase();
      if (term && !searchable.includes(term)) return [];
      return [
        {
          roomId: room.id,
          roomName: room.name,
          roomCode: room.code,
          laboratoryCode: laboratory?.code ?? "LAB",
          locationId: location.id,
          indexCode: location.indexCode,
          locationType: location.type,
          path,
          occupiedItems: room.scene.inventoryItems.filter(
            (item) => item.storageLocationId === location.id,
          ).length,
        },
      ];
    });
  });
  return {
    query,
    roomCode,
    totalMatches: matches.length,
    returnedMatches: Math.min(matches.length, limit),
    locations: matches.slice(0, limit),
  };
}

function normalizeInventoryInput(input: unknown): InventoryEntryRequest[] {
  const record = objectInput(input);
  rejectUnexpected(record, ["entries"]);
  if (!Array.isArray(record.entries) || record.entries.length < 1 || record.entries.length > 20) {
    throw new LabSpaceActionError("entries must contain 1 to 20 inventory records.");
  }
  return record.entries.map((raw, index) => {
    const entry = objectInput(raw, `Inventory entry ${index + 1}`);
    rejectUnexpected(entry, [
      "roomCode",
      "name",
      "quantity",
      "unit",
      "storageLocationId",
      "owner",
      "notes",
      "expiryDate",
    ]);
    const requiredText = (value: unknown, label: string, maximum: number) => {
      if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
        throw new LabSpaceActionError(`${label} must contain 1 to ${maximum} characters.`);
      }
      return value.trim();
    };
    if (
      typeof entry.quantity !== "number" ||
      !Number.isFinite(entry.quantity) ||
      entry.quantity < 0
    ) {
      throw new LabSpaceActionError(
        `Inventory entry ${index + 1} quantity must be zero or greater.`,
      );
    }
    const optionalText = (value: unknown, label: string, maximum: number) => {
      if (value === undefined) return undefined;
      if (typeof value !== "string" || value.length > maximum) {
        throw new LabSpaceActionError(`${label} must be ${maximum} characters or fewer.`);
      }
      return value.trim();
    };
    const expiryDate = entry.expiryDate;
    if (expiryDate !== undefined && expiryDate !== null && !isValidIsoDate(String(expiryDate))) {
      throw new LabSpaceActionError(
        `Inventory entry ${index + 1} expiryDate must be a real calendar date in YYYY-MM-DD format.`,
      );
    }
    return {
      roomCode: requiredText(entry.roomCode, `Inventory entry ${index + 1} roomCode`, 40),
      name: requiredText(entry.name, `Inventory entry ${index + 1} name`, 120),
      quantity: entry.quantity,
      unit: requiredText(entry.unit, `Inventory entry ${index + 1} unit`, 40),
      storageLocationId: optionalText(
        entry.storageLocationId,
        `Inventory entry ${index + 1} storageLocationId`,
        120,
      ),
      owner: optionalText(entry.owner, `Inventory entry ${index + 1} owner`, 120),
      notes: optionalText(entry.notes, `Inventory entry ${index + 1} notes`, 500),
      expiryDate: expiryDate === undefined || expiryDate === null ? null : String(expiryDate),
    };
  });
}

export function planInventory(
  input: unknown,
  readProject: () => Project = currentProject,
): PlanInventoryResult {
  const normalized = normalizeInventoryInput(input);
  const project = readProject();
  const entries: PlannedInventoryEntry[] = normalized.map((request) => {
    const room = resolveRoom(project, request.roomCode);
    const location = request.storageLocationId
      ? room.scene.storageLocations.find((entry) => entry.id === request.storageLocationId)
      : null;
    if (request.storageLocationId && !location) {
      throw new LabSpaceActionError(
        `Storage location ${request.storageLocationId} does not belong to ${room.code}.`,
      );
    }
    return {
      itemId: crypto.randomUUID(),
      roomId: room.id,
      roomName: room.name,
      roomCode: room.code,
      name: request.name,
      quantity: request.quantity,
      unit: request.unit,
      storageLocationId: location?.id ?? null,
      locationPath: location ? pathFor(room, location) : [],
      locationIndexCode: location?.indexCode ?? null,
      owner: request.owner ?? "",
      notes: request.notes ?? "",
      expiryDate: request.expiryDate ?? null,
    };
  });
  const result: PlanInventoryResult = {
    planId: crypto.randomUUID(),
    entries,
    assignedEntries: entries.filter((entry) => entry.storageLocationId).length,
    unassignedEntries: entries.filter((entry) => !entry.storageLocationId).length,
    warnings: entries
      .filter((entry) => !entry.storageLocationId)
      .map((entry) => `${entry.name} will be created unassigned in ${entry.roomCode}.`),
    requiresHumanApproval: true,
  };
  plans.set(result.planId, {
    result,
    baseline: {
      projectUpdatedAt: project.updatedAt,
      roomUpdatedAt: Object.fromEntries(
        [...new Set(entries.map((entry) => entry.roomId))].map((roomId) => [
          roomId,
          project.rooms.find((room) => room.id === roomId)?.updatedAt ?? "",
        ]),
      ),
    },
  });
  while (plans.size > MAX_PLANS) plans.delete(plans.keys().next().value as string);
  return result;
}

export function getStoredInventoryPlan(planId: string) {
  const plan = plans.get(planId);
  if (!plan) throw new LabSpaceActionError("That inventory plan is unavailable or has expired.");
  return plan;
}

export function getInventoryPlan(planId: string) {
  return getStoredInventoryPlan(planId).result;
}

export function createLabSpaceInventoryActions(
  readProject: () => Project,
): LabSpaceInventoryActions {
  return {
    listInventoryLocations: (input) => listInventoryLocations(input, readProject),
    planInventory: (input) => planInventory(input, readProject),
    getInventoryPlan,
  };
}

export const labSpaceInventoryActions: LabSpaceInventoryActions = {
  listInventoryLocations,
  planInventory,
  getInventoryPlan,
};
