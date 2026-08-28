import { ASSET_BY_ID, ASSET_CATALOG } from "../domain/assets";
import { objectBounds, validatePlacement } from "../domain/geometry";
import { getClosedWallFloorPolygon } from "../domain/room-geometry";
import { resolveLayerIdForObjectType } from "../domain/layers";
import type { AssetDefinition, Project, Room, SceneObject } from "../domain/schema";
import { useEditorStore } from "../store/editor-store";
import type {
  LabSpaceLayoutActions,
  PlanRoomLayoutInput,
  PlanRoomLayoutResult,
  PlannedRoomObject,
  RoomAssetRequest,
  SearchLabAssetsInput,
  SearchLabAssetsResult,
} from "./labspace-action-types";
import { LabSpaceActionError } from "./labspace-read-actions";

const MAX_QUERY_LENGTH = 120;
const MAX_REQUEST_GROUPS = 8;
const MAX_PLANNED_OBJECTS = 12;
const MAX_PLAN_REGISTRY = 12;
const PLAN_GRID_MM = 250;
const SUPPORTED_CONNECTIONS = new Set(["free", "floor"]);
const PLAN_CATEGORIES = new Set(["Furniture", "Storage", "Laboratory equipment", "Safety"]);

type ResolvedPlacement = "perimeter" | "island" | "open";

type StoredRoomPlan = {
  result: PlanRoomLayoutResult;
  baseline: {
    roomId: string;
    sceneUpdatedAt: string;
    objectIds: string[];
  };
};

const roomPlans = new Map<string, StoredRoomPlan>();

function currentProject() {
  return useEditorStore.getState().project;
}

function activeEditableRoom(project: Project) {
  const room = project.rooms.find((entry) => entry.id === project.activeRoomId);
  if (!room || room.roomKind === "demo-template") {
    throw new LabSpaceActionError("Open an editable LabSpace room before planning furniture.");
  }
  return room;
}

function plainObject(input: unknown, label: string) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new LabSpaceActionError(`${label} must be a JSON object.`);
  }
  return input as Record<string, unknown>;
}

function rejectUnexpected(record: Record<string, unknown>, allowed: string[]) {
  const unexpected = Object.keys(record).find((key) => !allowed.includes(key));
  if (unexpected) throw new LabSpaceActionError(`Unexpected input field: ${unexpected}.`);
}

function integer(value: unknown, label: string, minimum: number, maximum: number) {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new LabSpaceActionError(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
  return Number(value);
}

function normalizeAssetSearch(input: unknown): SearchLabAssetsInput {
  const record = plainObject(input, "Tool input");
  rejectUnexpected(record, ["query", "categories", "limit"]);
  if (typeof record.query !== "string" || !record.query.trim()) {
    throw new LabSpaceActionError("Asset search query cannot be empty.");
  }
  const query = record.query.trim();
  if (query.length > MAX_QUERY_LENGTH) {
    throw new LabSpaceActionError(`Asset search query must be ${MAX_QUERY_LENGTH} characters or fewer.`);
  }
  let categories: string[] | undefined;
  if (record.categories !== undefined) {
    if (!Array.isArray(record.categories) || record.categories.length === 0) {
      throw new LabSpaceActionError("categories must be a non-empty array when supplied.");
    }
    categories = record.categories.map((entry) => {
      if (typeof entry !== "string" || !PLAN_CATEGORIES.has(entry)) {
        throw new LabSpaceActionError(`Unsupported planning category: ${String(entry)}.`);
      }
      return entry;
    });
  }
  return {
    query,
    categories,
    limit: record.limit === undefined ? 8 : integer(record.limit, "Limit", 1, 12),
  };
}

function normalizePlanInput(input: unknown): PlanRoomLayoutInput {
  const record = plainObject(input, "Tool input");
  rejectUnexpected(record, ["brief", "assets", "aisleMm"]);
  let brief: string | undefined;
  if (record.brief !== undefined) {
    if (typeof record.brief !== "string" || !record.brief.trim()) {
      throw new LabSpaceActionError("Brief must be a non-empty string when supplied.");
    }
    brief = record.brief.trim();
    if (brief.length > 240) throw new LabSpaceActionError("Brief must be 240 characters or fewer.");
  }
  if (!Array.isArray(record.assets) || record.assets.length === 0) {
    throw new LabSpaceActionError("assets must contain at least one catalog request.");
  }
  if (record.assets.length > MAX_REQUEST_GROUPS) {
    throw new LabSpaceActionError(`assets can contain at most ${MAX_REQUEST_GROUPS} request groups.`);
  }
  const assets: RoomAssetRequest[] = record.assets.map((entry, index) => {
    const request = plainObject(entry, `Asset request ${index + 1}`);
    rejectUnexpected(request, ["assetId", "quantity", "placement"]);
    if (typeof request.assetId !== "string" || !request.assetId.trim()) {
      throw new LabSpaceActionError(`Asset request ${index + 1} needs a catalog assetId.`);
    }
    const placement = request.placement ?? "auto";
    if (!["auto", "perimeter", "island", "open"].includes(String(placement))) {
      throw new LabSpaceActionError(`Asset request ${index + 1} has an unsupported placement.`);
    }
    return {
      assetId: request.assetId.trim(),
      quantity: integer(request.quantity, `Asset request ${index + 1} quantity`, 1, 4),
      placement: placement as RoomAssetRequest["placement"],
    };
  });
  const requested = assets.reduce((total, entry) => total + entry.quantity, 0);
  if (requested > MAX_PLANNED_OBJECTS) {
    throw new LabSpaceActionError(`A room plan can contain at most ${MAX_PLANNED_OBJECTS} objects.`);
  }
  const aisleMm =
    record.aisleMm === undefined ? 900 : integer(record.aisleMm, "Aisle", 600, 2000);
  return { brief, assets, aisleMm };
}

function assetSearchText(asset: AssetDefinition) {
  return [asset.id, asset.name, asset.shortName, asset.category, asset.description, ...asset.tags]
    .join(" ")
    .toLowerCase();
}

export function searchLabAssets(input: unknown): SearchLabAssetsResult {
  const normalized = normalizeAssetSearch(input);
  const terms = normalized.query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = ASSET_CATALOG.filter(
    (asset) =>
      PLAN_CATEGORIES.has(asset.category) &&
      asset.objectType !== "wall" &&
      (!normalized.categories?.length || normalized.categories.includes(asset.category)) &&
      terms.every((term) => assetSearchText(asset).includes(term)),
  ).sort((left, right) => {
    const query = normalized.query.toLowerCase();
    const leftExact = left.name.toLowerCase() === query || left.id === query ? 0 : 1;
    const rightExact = right.name.toLowerCase() === query || right.id === query ? 0 : 1;
    return leftExact - rightExact || left.name.localeCompare(right.name);
  });
  return {
    query: normalized.query,
    totalMatches: matches.length,
    returnedMatches: Math.min(matches.length, normalized.limit ?? 8),
    results: matches.slice(0, normalized.limit ?? 8).map((asset) => ({
      assetId: asset.id,
      name: asset.name,
      category: asset.category,
      dimensionsMm: asset.defaultDimensions,
      connection: asset.connection,
      indexingBehavior: asset.indexingBehavior,
      tags: asset.tags.slice(0, 6),
    })),
  };
}

function resolvedPlacement(asset: AssetDefinition, requested: RoomAssetRequest["placement"]): ResolvedPlacement {
  if (requested && requested !== "auto") return requested;
  const identity = `${asset.id} ${asset.name}`.toLowerCase();
  if (identity.includes("island")) return "island";
  if (["bench", "cabinet", "shelf", "hood", "rack", "washer"].includes(asset.profile)) {
    return "perimeter";
  }
  return "open";
}

function nearestGap(candidate: SceneObject, objects: SceneObject[]) {
  const a = objectBounds(candidate);
  let closest = Number.POSITIVE_INFINITY;
  for (const object of objects) {
    if (!object.visible || ["wall", "door", "window", "label", "measurement"].includes(object.objectType)) continue;
    const b = objectBounds(object);
    const gapX = Math.max(0, b.left - a.right, a.left - b.right);
    const gapY = Math.max(0, b.top - a.bottom, a.top - b.bottom);
    closest = Math.min(closest, Math.hypot(gapX, gapY));
  }
  return Number.isFinite(closest) ? Math.round(closest) : null;
}

function spatiallyValid(room: Room, candidate: SceneObject) {
  const hypothetical: Room = {
    ...room,
    scene: { ...room.scene, objects: [...room.scene.objects, candidate] },
  };
  return !validatePlacement(hypothetical).some(
    (warning) =>
      warning.objectIds.includes(candidate.id) &&
      ["outside-", "below-floor-", "above-ceiling-", "overlap-"].some((prefix) =>
        warning.id.startsWith(prefix),
      ),
  );
}

function planningPositions(room: Room, asset: AssetDefinition, placement: ResolvedPlacement) {
  const floor = getClosedWallFloorPolygon(room.scene.objects);
  const bounds = floor?.bounds ?? { minX: 0, minY: 0, maxX: room.width, maxY: room.depth };
  const centre = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  const keyed = new Map<string, { x: number; y: number; rotation: number; edgeDistance: number }>();
  const add = (x: number, y: number, rotation: number) => {
    const snappedX = Math.round(x / 50) * 50;
    const snappedY = Math.round(y / 50) * 50;
    const edgeDistance = Math.min(
      Math.abs(snappedX - bounds.minX),
      Math.abs(bounds.maxX - snappedX),
      Math.abs(snappedY - bounds.minY),
      Math.abs(bounds.maxY - snappedY),
    );
    keyed.set(`${snappedX}:${snappedY}:${rotation}`, {
      x: snappedX,
      y: snappedY,
      rotation,
      edgeDistance,
    });
  };

  for (const rotation of [0, 90, 180, 270]) {
    const quarterTurn = rotation % 180 !== 0;
    const width = quarterTurn ? asset.defaultDimensions.depth : asset.defaultDimensions.width;
    const depth = quarterTurn ? asset.defaultDimensions.width : asset.defaultDimensions.depth;
    const insetX = width / 2 + 180;
    const insetY = depth / 2 + 180;
    if (placement === "perimeter") {
      for (let x = bounds.minX + insetX; x <= bounds.maxX - insetX; x += PLAN_GRID_MM) {
        add(x, bounds.minY + insetY, rotation);
        add(x, bounds.maxY - insetY, rotation);
      }
      for (let y = bounds.minY + insetY; y <= bounds.maxY - insetY; y += PLAN_GRID_MM) {
        add(bounds.minX + insetX, y, rotation);
        add(bounds.maxX - insetX, y, rotation);
      }
    } else {
      for (let y = bounds.minY + insetY; y <= bounds.maxY - insetY; y += PLAN_GRID_MM) {
        for (let x = bounds.minX + insetX; x <= bounds.maxX - insetX; x += PLAN_GRID_MM) {
          add(x, y, rotation);
        }
      }
    }
  }

  return [...keyed.values()].sort((left, right) => {
    const centreScore = (position: typeof left) =>
      Math.hypot(position.x - centre.x, position.y - centre.y);
    if (placement === "perimeter") {
      return left.edgeDistance - right.edgeDistance || centreScore(left) - centreScore(right);
    }
    if (placement === "island") return centreScore(left) - centreScore(right);
    return centreScore(left) - centreScore(right);
  });
}

function proposalObject(
  room: Room,
  asset: AssetDefinition,
  placement: ResolvedPlacement,
  position: { x: number; y: number; rotation: number },
): SceneObject {
  const now = new Date().toISOString();
  return {
    id: `plan-${crypto.randomUUID()}`,
    indexCode: `PLAN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    name: asset.name,
    assetDefinitionId: asset.id,
    objectType: asset.objectType,
    position: { x: position.x, y: position.y, z: 0 },
    dimensions: asset.defaultDimensions,
    rotation: { x: 0, y: 0, z: position.rotation },
    flipHorizontal: false,
    flipVertical: false,
    layerId: resolveLayerIdForObjectType(room.scene.layers, asset.objectType),
    roomId: room.id,
    zoneId: room.scene.zones[0]?.id ?? null,
    locked: false,
    visible: true,
    metadata: { agentPlanPlacement: placement },
    createdAt: now,
    updatedAt: now,
    parentObjectId: null,
    childLocationIds: [],
    zIndex: Math.max(0, ...room.scene.objects.map((entry) => entry.zIndex)) + 1,
  };
}

function storePlan(plan: StoredRoomPlan) {
  roomPlans.set(plan.result.planId, plan);
  while (roomPlans.size > MAX_PLAN_REGISTRY) {
    roomPlans.delete(roomPlans.keys().next().value as string);
  }
}

export function planRoomLayout(
  input: unknown,
  readProject: () => Project = currentProject,
): PlanRoomLayoutResult {
  const normalized = normalizePlanInput(input);
  const project = readProject();
  const room = activeEditableRoom(project);
  const workingRoom = structuredClone(room);
  const proposals: PlannedRoomObject[] = [];
  const unplaced: PlanRoomLayoutResult["unplaced"] = [];

  for (const request of normalized.assets) {
    const asset = ASSET_BY_ID.get(request.assetId);
    if (!asset || !PLAN_CATEGORIES.has(asset.category) || asset.objectType === "wall") {
      throw new LabSpaceActionError(`Unknown or unsupported planning asset: ${request.assetId}.`);
    }
    if (!SUPPORTED_CONNECTIONS.has(asset.connection)) {
      for (let index = 0; index < request.quantity; index += 1) {
        unplaced.push({
          assetId: asset.id,
          assetName: asset.name,
          reason: `${asset.connection}-connected assets require a host-aware placement workflow.`,
        });
      }
      continue;
    }
    const placement = resolvedPlacement(asset, request.placement);
    for (let index = 0; index < request.quantity; index += 1) {
      let accepted: SceneObject | null = null;
      let acceptedGap: number | null = null;
      for (const position of planningPositions(workingRoom, asset, placement)) {
        const candidate = proposalObject(workingRoom, asset, placement, position);
        if (!spatiallyValid(workingRoom, candidate)) continue;
        const gap = nearestGap(candidate, workingRoom.scene.objects);
        const minimumGap = placement === "perimeter" ? 80 : normalized.aisleMm ?? 900;
        if (gap !== null && gap < minimumGap) continue;
        accepted = candidate;
        acceptedGap = gap;
        break;
      }
      if (!accepted) {
        unplaced.push({
          assetId: asset.id,
          assetName: asset.name,
          reason: `No geometry-valid ${placement} position met the ${normalized.aisleMm} mm planning aisle.`,
        });
        continue;
      }
      workingRoom.scene.objects.push(accepted);
      proposals.push({
        proposalId: accepted.id,
        assetId: asset.id,
        assetName: asset.name,
        position: {
          xMm: accepted.position.x,
          yMm: accepted.position.y,
          zMm: accepted.position.z,
        },
        rotationDeg: accepted.rotation.z,
        dimensionsMm: accepted.dimensions,
        placement,
        nearestObjectGapMm: acceptedGap,
      });
    }
  }

  const result: PlanRoomLayoutResult = {
    planId: crypto.randomUUID(),
    roomId: room.id,
    roomName: room.name,
    roomCode: room.code,
    brief: normalized.brief ?? null,
    requestedObjects: normalized.assets.reduce((total, entry) => total + entry.quantity, 0),
    plannedObjects: proposals.length,
    unplaced,
    aisleMm: normalized.aisleMm ?? 900,
    proposals,
    basis: [
      "Uses canonical catalog dimensions and the active room's current wall/floor geometry.",
      "Rejects boundary, overlap, elevation, and room-height conflicts with LabSpace's deterministic validator.",
      "Aisle spacing is a planning preference, not a regulatory or manufacturer-certified clearance.",
      "This proposal is read-only until separately staged and explicitly approved in LabSpace.",
    ],
    requiresHumanApproval: true,
  };
  storePlan({
    result,
    baseline: {
      roomId: room.id,
      sceneUpdatedAt: room.scene.updatedAt,
      objectIds: room.scene.objects.map((object) => object.id).sort(),
    },
  });
  return result;
}

export function getRoomPlan(planId: string) {
  const plan = roomPlans.get(planId);
  if (!plan) throw new LabSpaceActionError("That room plan is unavailable or has expired.");
  return plan.result;
}

export function getStoredRoomPlan(planId: string) {
  const plan = roomPlans.get(planId);
  if (!plan) throw new LabSpaceActionError("That room plan is unavailable or has expired.");
  return plan;
}

export function clearStoredRoomPlans() {
  roomPlans.clear();
}

export function createLabSpaceLayoutActions(readProject: () => Project): LabSpaceLayoutActions {
  return {
    searchLabAssets,
    planRoomLayout: (input) => planRoomLayout(input, readProject),
    getRoomPlan,
  };
}

export const labSpaceLayoutActions: LabSpaceLayoutActions = {
  searchLabAssets,
  planRoomLayout,
  getRoomPlan,
};
