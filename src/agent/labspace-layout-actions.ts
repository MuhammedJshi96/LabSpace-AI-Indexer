import { ASSET_BY_ID, ASSET_CATALOG } from "../domain/assets";
import {
  objectBounds,
  requiresBenchSupport,
  snapBenchObjectToAvailableSupport,
  validatePlacement,
} from "../domain/geometry";
import { getClosedWallFloorPolygon } from "../domain/room-geometry";
import { resolveLayerIdForObjectType } from "../domain/layers";
import type { AssetDefinition, Project, Room, SceneObject } from "../domain/schema";
import { useEditorStore } from "../store/editor-store";
import type {
  LabSpaceLayoutActions,
  PlanRoomLayoutInput,
  PlanRoomLayoutResult,
  PlannedRoomShell,
  PlannedRoomObject,
  RoomAssetRequest,
  SearchLabAssetsInput,
  SearchLabAssetsResult,
} from "./labspace-action-types";
import { LabSpaceActionError } from "./labspace-read-actions";

const MAX_QUERY_LENGTH = 120;
const MAX_REQUEST_GROUPS = 16;
const MAX_PLANNED_OBJECTS = 24;
const MAX_PLAN_REGISTRY = 12;
const PLAN_GRID_MM = 250;
const SUPPORTED_CONNECTIONS = new Set(["free", "floor", "bench"]);
const PLAN_CATEGORIES = new Set(["Furniture", "Storage", "Laboratory equipment", "Safety"]);

type ResolvedPlacement = "perimeter" | "island" | "open" | "surface";

type StoredRoomPlan = {
  result: PlanRoomLayoutResult;
  baseline: {
    roomId: string;
    sceneUpdatedAt: string;
    objectIds: string[];
    roomSize: { width: number; depth: number; wallHeight: number };
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

function finiteNumber(value: unknown, label: string, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new LabSpaceActionError(`${label} must be a finite number from ${minimum} to ${maximum}.`);
  }
  return value;
}

type PlanVertex = { xMm: number; yMm: number };

function polygonArea(vertices: PlanVertex[]) {
  return Math.abs(
    vertices.reduce((sum, point, index) => {
      const next = vertices[(index + 1) % vertices.length];
      return sum + point.xMm * next.yMm - next.xMm * point.yMm;
    }, 0) / 2,
  );
}

function orientation(a: PlanVertex, b: PlanVertex, c: PlanVertex) {
  return (b.xMm - a.xMm) * (c.yMm - a.yMm) - (b.yMm - a.yMm) * (c.xMm - a.xMm);
}

function segmentsCross(a: PlanVertex, b: PlanVertex, c: PlanVertex, d: PlanVertex) {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  return abC * abD < 0 && cdA * cdB < 0;
}

function validatePolygon(vertices: PlanVertex[]) {
  if (vertices.length < 3 || vertices.length > 16) {
    throw new LabSpaceActionError("roomShell.vertices must contain 3 to 16 corners.");
  }
  if (vertices.some((point, index) => {
    const next = vertices[(index + 1) % vertices.length];
    return Math.hypot(next.xMm - point.xMm, next.yMm - point.yMm) < 500;
  })) {
    throw new LabSpaceActionError("Every room-shell wall segment must be at least 500 mm long.");
  }
  for (let first = 0; first < vertices.length; first += 1) {
    for (let second = first + 1; second < vertices.length; second += 1) {
      const firstNext = (first + 1) % vertices.length;
      const secondNext = (second + 1) % vertices.length;
      if (first === second || firstNext === second || secondNext === first) continue;
      if (segmentsCross(vertices[first], vertices[firstNext], vertices[second], vertices[secondNext])) {
        throw new LabSpaceActionError("roomShell.vertices must describe one simple non-crossing polygon.");
      }
    }
  }
  if (polygonArea(vertices) < 9_000_000) {
    throw new LabSpaceActionError("The closed room shell must contain at least 9 m² of floor area.");
  }
  const minX = Math.min(...vertices.map((point) => point.xMm));
  const minY = Math.min(...vertices.map((point) => point.yMm));
  if (minX !== 0 || minY !== 0) {
    throw new LabSpaceActionError("Polygon room coordinates must start at x=0 and y=0.");
  }
}

function normalizeAssetSearch(input: unknown): SearchLabAssetsInput {
  const record = plainObject(input, "Tool input");
  rejectUnexpected(record, ["query", "categories", "limit"]);
  if (typeof record.query !== "string" || !record.query.trim()) {
    throw new LabSpaceActionError("Asset search query cannot be empty.");
  }
  const query = record.query.trim();
  if (query.length > MAX_QUERY_LENGTH) {
    throw new LabSpaceActionError(
      `Asset search query must be ${MAX_QUERY_LENGTH} characters or fewer.`,
    );
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
  rejectUnexpected(record, ["brief", "assets", "aisleMm", "roomShell"]);
  let brief: string | undefined;
  if (record.brief !== undefined) {
    if (typeof record.brief !== "string" || !record.brief.trim()) {
      throw new LabSpaceActionError("Brief must be a non-empty string when supplied.");
    }
    brief = record.brief.trim();
    if (brief.length > 240) throw new LabSpaceActionError("Brief must be 240 characters or fewer.");
  }
  if (!Array.isArray(record.assets)) {
    throw new LabSpaceActionError("assets must be an array of catalog requests.");
  }
  if (record.assets.length > MAX_REQUEST_GROUPS) {
    throw new LabSpaceActionError(
      `assets can contain at most ${MAX_REQUEST_GROUPS} request groups.`,
    );
  }
  const assets: RoomAssetRequest[] = record.assets.map((entry, index) => {
    const request = plainObject(entry, `Asset request ${index + 1}`);
    rejectUnexpected(request, [
      "assetId",
      "quantity",
      "placement",
      "position",
      "rotationDeg",
      "elevationMm",
    ]);
    if (typeof request.assetId !== "string" || !request.assetId.trim()) {
      throw new LabSpaceActionError(`Asset request ${index + 1} needs a catalog assetId.`);
    }
    const placement = request.placement ?? "auto";
    if (!["auto", "perimeter", "island", "open", "surface"].includes(String(placement))) {
      throw new LabSpaceActionError(`Asset request ${index + 1} has an unsupported placement.`);
    }
    let position: RoomAssetRequest["position"];
    if (request.position !== undefined) {
      const target = plainObject(request.position, `Asset request ${index + 1} position`);
      rejectUnexpected(target, ["xMm", "yMm"]);
      position = {
        xMm: finiteNumber(target.xMm, `Asset request ${index + 1} xMm`, -20_000, 40_000),
        yMm: finiteNumber(target.yMm, `Asset request ${index + 1} yMm`, -20_000, 40_000),
      };
    }
    const quantity = integer(request.quantity, `Asset request ${index + 1} quantity`, 1, 4);
    if (position && quantity !== 1) {
      throw new LabSpaceActionError(
        `Asset request ${index + 1} must use quantity 1 when an exact position is supplied.`,
      );
    }
    return {
      assetId: request.assetId.trim(),
      quantity,
      placement: placement as RoomAssetRequest["placement"],
      position,
      rotationDeg:
        request.rotationDeg === undefined
          ? undefined
          : finiteNumber(request.rotationDeg, `Asset request ${index + 1} rotationDeg`, -360, 360),
      elevationMm:
        request.elevationMm === undefined
          ? undefined
          : finiteNumber(request.elevationMm, `Asset request ${index + 1} elevationMm`, 0, 6000),
    };
  });
  const requested = assets.reduce((total, entry) => total + entry.quantity, 0);
  if (requested > MAX_PLANNED_OBJECTS) {
    throw new LabSpaceActionError(
      `A room plan can contain at most ${MAX_PLANNED_OBJECTS} objects.`,
    );
  }
  const aisleMm = record.aisleMm === undefined ? 900 : integer(record.aisleMm, "Aisle", 600, 2000);
  let roomShell: PlanRoomLayoutInput["roomShell"];
  if (record.roomShell !== undefined) {
    const shell = plainObject(record.roomShell, "roomShell");
    rejectUnexpected(shell, ["widthMm", "depthMm", "vertices", "wallHeightMm", "wallThicknessMm"]);
    let vertices: PlanVertex[] | undefined;
    if (shell.vertices !== undefined) {
      if (!Array.isArray(shell.vertices)) {
        throw new LabSpaceActionError("roomShell.vertices must be an array of coordinate objects.");
      }
      vertices = shell.vertices.map((entry, index) => {
        const point = plainObject(entry, `Room corner ${index + 1}`);
        rejectUnexpected(point, ["xMm", "yMm"]);
        return {
          xMm: integer(point.xMm, `Room corner ${index + 1} xMm`, 0, 20_000),
          yMm: integer(point.yMm, `Room corner ${index + 1} yMm`, 0, 20_000),
        };
      });
      if (
        vertices.length > 3 &&
        vertices[0].xMm === vertices.at(-1)?.xMm &&
        vertices[0].yMm === vertices.at(-1)?.yMm
      ) {
        vertices = vertices.slice(0, -1);
      }
      validatePolygon(vertices);
    }
    if (!vertices && (shell.widthMm === undefined || shell.depthMm === undefined)) {
      throw new LabSpaceActionError(
        "roomShell needs widthMm and depthMm, or a vertices array for a custom closed polygon.",
      );
    }
    if (vertices && (shell.widthMm !== undefined || shell.depthMm !== undefined)) {
      throw new LabSpaceActionError(
        "Use either widthMm/depthMm or vertices for roomShell, not both.",
      );
    }
    roomShell = {
      widthMm:
        shell.widthMm === undefined ? undefined : integer(shell.widthMm, "Room width", 3000, 20_000),
      depthMm:
        shell.depthMm === undefined ? undefined : integer(shell.depthMm, "Room depth", 3000, 20_000),
      vertices,
      wallHeightMm:
        shell.wallHeightMm === undefined
          ? undefined
          : integer(shell.wallHeightMm, "Wall height", 2400, 6000),
      wallThicknessMm:
        shell.wallThicknessMm === undefined
          ? undefined
          : integer(shell.wallThicknessMm, "Wall thickness", 100, 300),
    };
  }
  if (assets.length === 0 && !roomShell) {
    throw new LabSpaceActionError(
      "A room plan needs at least one catalog request or an explicit roomShell.",
    );
  }
  return { brief, assets, aisleMm, roomShell };
}

function assetSearchText(asset: AssetDefinition) {
  return [asset.id, asset.name, asset.shortName, asset.category, asset.description, ...asset.tags]
    .join(" ")
    .toLowerCase();
}

export function searchLabAssets(
  input: unknown,
  readProject: () => Project = currentProject,
): SearchLabAssetsResult {
  const normalized = normalizeAssetSearch(input);
  const archived = new Set(readProject().archivedAssetIds ?? []);
  const terms = normalized.query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = ASSET_CATALOG.filter(
    (asset) =>
      !archived.has(asset.id) &&
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

function resolvedPlacement(
  asset: AssetDefinition,
  requested: RoomAssetRequest["placement"],
): ResolvedPlacement {
  if (requested && requested !== "auto") return requested;
  if (asset.connection === "bench") return "surface";
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
    if (
      !object.visible ||
      ["wall", "door", "window", "label", "measurement"].includes(object.objectType)
    )
      continue;
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
      ["outside-", "below-floor-", "above-ceiling-", "overlap-", "unsupported-"].some((prefix) =>
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
  position: { x: number; y: number; rotation: number; elevation?: number },
): SceneObject {
  const now = new Date().toISOString();
  return {
    id: `plan-${crypto.randomUUID()}`,
    indexCode: `PLAN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    name: asset.name,
    assetDefinitionId: asset.id,
    objectType: asset.objectType,
    position: { x: position.x, y: position.y, z: position.elevation ?? 0 },
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

function wallObject(
  room: Room,
  start: { x: number; y: number },
  end: { x: number; y: number },
  thickness: number,
  height: number,
) {
  const now = new Date().toISOString();
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const id = `plan-wall-${crypto.randomUUID()}`;
  const object: SceneObject = {
    id,
    indexCode: `PLAN-WALL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    name: "Straight wall",
    assetDefinitionId: "straight-wall",
    objectType: "wall",
    position: {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
      z: 0,
    },
    dimensions: { width: length, depth: thickness, height },
    rotation: {
      x: 0,
      y: 0,
      z: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI,
    },
    flipHorizontal: false,
    flipVertical: false,
    layerId: resolveLayerIdForObjectType(room.scene.layers, "wall"),
    roomId: room.id,
    zoneId: null,
    locked: false,
    visible: true,
    metadata: { agentPlanShell: true },
    createdAt: now,
    updatedAt: now,
    parentObjectId: null,
    childLocationIds: [],
    zIndex: Math.max(0, ...room.scene.objects.map((entry) => entry.zIndex)) + 1,
    wall: {
      start: { ...start },
      end: { ...end },
      thickness,
      height,
      halfHeight: false,
    },
  };
  return object;
}

function planRoomShell(room: Room, requested: PlanRoomLayoutInput["roomShell"]): PlannedRoomShell {
  const existingFloor = getClosedWallFloorPolygon(room.scene.objects);
  const existingWalls = room.scene.objects.filter(
    (object) => object.objectType === "wall" && object.visible,
  );
  if (existingWalls.length) {
    if (requested) {
      throw new LabSpaceActionError(
        "This room already has walls. Omit roomShell to plan within them; LabSpace will not replace an existing room automatically.",
      );
    }
    if (!existingFloor) {
      throw new LabSpaceActionError(
        "The active room has an open or invalid wall outline. Close it before planning furniture, or use a blank room for an agent-built shell.",
      );
    }
    return {
      mode: "existing",
      shape: "existing",
      widthMm: room.width,
      depthMm: room.depth,
      wallHeightMm: room.wallHeight,
      wallThicknessMm: existingWalls[0]?.wall?.thickness ?? 150,
      vertices: existingFloor.points.map((point) => ({ xMm: point.x, yMm: point.y })),
      segments: [],
    };
  }

  const customVertices = requested?.vertices;
  const widthMm = customVertices
    ? Math.max(...customVertices.map((point) => point.xMm))
    : (requested?.widthMm ?? room.width);
  const depthMm = customVertices
    ? Math.max(...customVertices.map((point) => point.yMm))
    : (requested?.depthMm ?? room.depth);
  const wallHeightMm = requested?.wallHeightMm ?? room.wallHeight;
  const wallThicknessMm = requested?.wallThicknessMm ?? 150;
  const points = customVertices
    ? customVertices.map((point) => ({ x: point.xMm, y: point.yMm }))
    : [
        { x: 0, y: 0 },
        { x: widthMm, y: 0 },
        { x: widthMm, y: depthMm },
        { x: 0, y: depthMm },
      ];
  const segments = points.map((start, index) => {
    const end = points[(index + 1) % points.length];
    const object = wallObject(room, start, end, wallThicknessMm, wallHeightMm);
    return {
      proposalId: object.id,
      name: `Wall ${index + 1}`,
      start: { xMm: start.x, yMm: start.y },
      end: { xMm: end.x, yMm: end.y },
      thicknessMm: wallThicknessMm,
      heightMm: wallHeightMm,
      lengthMm: Math.round(Math.hypot(end.x - start.x, end.y - start.y)),
    };
  });
  return {
    mode: "proposed",
    shape: customVertices ? "polygon" : "rectangle",
    widthMm,
    depthMm,
    wallHeightMm,
    wallThicknessMm,
    vertices: points.map((point) => ({ xMm: point.x, yMm: point.y })),
    segments,
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
  const shell = planRoomShell(room, normalized.roomShell);
  if (shell.mode === "proposed") {
    workingRoom.width = shell.widthMm;
    workingRoom.depth = shell.depthMm;
    workingRoom.wallHeight = shell.wallHeightMm;
    for (const segment of shell.segments) {
      workingRoom.scene.objects.push(
        wallObject(
          workingRoom,
          { x: segment.start.xMm, y: segment.start.yMm },
          { x: segment.end.xMm, y: segment.end.yMm },
          segment.thicknessMm,
          segment.heightMm,
        ),
      );
    }
  }
  const proposals: PlannedRoomObject[] = [];
  const unplaced: PlanRoomLayoutResult["unplaced"] = [];

  const orderedRequests = normalized.assets
    .map((request, order) => ({ request, order }))
    .sort((left, right) => {
      const leftBench = ASSET_BY_ID.get(left.request.assetId)?.connection === "bench" ? 1 : 0;
      const rightBench = ASSET_BY_ID.get(right.request.assetId)?.connection === "bench" ? 1 : 0;
      return leftBench - rightBench || left.order - right.order;
    });

  for (const { request } of orderedRequests) {
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
      const positions = request.position
        ? [
            {
              x: request.position.xMm,
              y: request.position.yMm,
              rotation: request.rotationDeg ?? 0,
              elevation: request.elevationMm,
              edgeDistance: 0,
            },
          ]
        : planningPositions(workingRoom, asset, placement).map((position) => ({
            ...position,
            rotation: request.rotationDeg ?? position.rotation,
            elevation: request.elevationMm,
          }));
      for (const position of positions) {
        let candidate = proposalObject(workingRoom, asset, placement, position);
        if (requiresBenchSupport(candidate)) {
          const supported = snapBenchObjectToAvailableSupport(workingRoom, candidate);
          if (!supported) continue;
          if (
            request.elevationMm !== undefined &&
            Math.abs(supported.position.z - request.elevationMm) > 20
          ) {
            continue;
          }
          candidate = supported;
        }
        if (!spatiallyValid(workingRoom, candidate)) continue;
        const gap = nearestGap(candidate, workingRoom.scene.objects);
        const minimumGap =
          asset.connection === "bench"
            ? 0
            : placement === "perimeter"
              ? 80
              : (normalized.aisleMm ?? 900);
        if (gap !== null && gap < minimumGap) continue;
        accepted = candidate;
        acceptedGap = gap;
        break;
      }
      if (!accepted) {
        unplaced.push({
          assetId: asset.id,
          assetName: asset.name,
          reason:
            asset.connection === "bench"
              ? "No compatible bench or table surface could support this equipment at the requested transform."
              : `No geometry-valid ${placement} position met the ${normalized.aisleMm} mm planning aisle.`,
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
    shell,
    proposals,
    basis: [
      shell.mode === "proposed"
        ? `Builds a validated closed ${shell.shape} wall outline with ${shell.segments.length} connected walls; the floor is derived from that loop.`
        : "Uses the active room's existing closed wall and floor geometry without replacing it.",
      "Uses canonical catalog dimensions and the active room's current wall/floor geometry.",
      "Preserves explicit x/y position, rotation, and elevation requests when they pass deterministic validation.",
      "Bench-connected equipment is placed on a compatible support surface at its actual worktop elevation.",
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
      roomSize: { width: room.width, depth: room.depth, wallHeight: room.wallHeight },
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
    searchLabAssets: (input) => searchLabAssets(input, readProject),
    planRoomLayout: (input) => planRoomLayout(input, readProject),
    getRoomPlan,
  };
}

export const labSpaceLayoutActions: LabSpaceLayoutActions = {
  searchLabAssets,
  planRoomLayout,
  getRoomPlan,
};
