import { ASSET_BY_ID } from "../domain/assets";
import { validatePlacement } from "../domain/geometry";
import { generateObjectIndexCode } from "../domain/indexing";
import { resolveLayerIdForObjectType } from "../domain/layers";
import {
  getClosedWallFloorPolygon,
  getRoomSpaceFloorPlans,
  pointIsInsideFloorPolygon,
  type PlanPoint,
} from "../domain/room-geometry";
import type {
  AssetDefinition,
  Project,
  Room,
  RoomSpace,
  Scene,
  SceneObject,
} from "../domain/schema";
import { openingOverlapsSibling } from "../domain/wall-openings";
import { useEditorStore } from "../store/editor-store";
import type {
  PendingAgentLayoutChange,
  PlanAnnexInput,
  PlanAnnexResult,
  StageRoomLayoutResult,
} from "./labspace-action-types";
import { agentActivityActions } from "./agent-activity-store";
import { LabSpaceActionError } from "./labspace-read-actions";
import { createEquipmentRecord, createStorageLocations } from "./labspace-staging-actions";
import { decideWebMcpMutation } from "./webmcp-execution-policy";

type StoredAnnexPlan = {
  result: PlanAnnexResult;
  baseline: {
    sceneUpdatedAt: string;
    objectIds: string[];
    spaces: RoomSpace[];
    roomSize: { width: number; depth: number; wallHeight: number };
  };
  proposedRoom: Room;
  affectedObjectIds: string[];
};

const annexPlans = new Map<string, StoredAnnexPlan>();
const MAX_ANNEX_PLANS = 20;
const MIN_SPACE_MM = 1200;
const MAX_SPACE_MM = 20_000;
const SPLIT_CLEARANCE_MM = 50;

function requireObject(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new LabSpaceActionError("Tool input must be a JSON object.");
  }
  return input as Record<string, unknown>;
}

function finiteNumber(value: unknown, name: string, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new LabSpaceActionError(`${name} must be between ${minimum} and ${maximum} mm.`);
  }
  return value;
}

function optionalFiniteNumber(value: unknown, name: string, minimum: number, maximum: number) {
  return value === undefined ? undefined : finiteNumber(value, name, minimum, maximum);
}

function requiredText(value: unknown, name: string, maximum = 120) {
  if (typeof value !== "string" || !value.trim()) {
    throw new LabSpaceActionError(`${name} must be a non-empty string.`);
  }
  if (value.trim().length > maximum) {
    throw new LabSpaceActionError(`${name} must be ${maximum} characters or fewer.`);
  }
  return value.trim();
}

function normalizeAnnexInput(input: unknown): PlanAnnexInput {
  const record = requireObject(input);
  const allowed = new Set([
    "parentRoomCode",
    "name",
    "code",
    "hostWallId",
    "widthAlongWallMm",
    "outwardDepthMm",
    "offsetAlongWallMm",
    "wallHeightMm",
    "wallThicknessMm",
    "floorFinish",
    "connector",
    "windows",
    "assets",
  ]);
  const unexpected = Object.keys(record).find((key) => !allowed.has(key));
  if (unexpected) throw new LabSpaceActionError(`Unexpected input field: ${unexpected}.`);

  let connector: PlanAnnexInput["connector"];
  if (record.connector !== undefined) {
    const value = requireObject(record.connector);
    const extra = Object.keys(value).find(
      (key) => !["assetId", "offsetMm", "handing", "opensInto"].includes(key),
    );
    if (extra) throw new LabSpaceActionError(`Unexpected connector field: ${extra}.`);
    const opensInto = value.opensInto;
    if (opensInto !== "primary" && opensInto !== "annex") {
      throw new LabSpaceActionError("connector.opensInto must be primary or annex.");
    }
    const handing = value.handing;
    if (handing !== undefined && handing !== "left" && handing !== "right") {
      throw new LabSpaceActionError("connector.handing must be left or right.");
    }
    connector = {
      assetId: requiredText(value.assetId, "connector.assetId"),
      offsetMm: optionalFiniteNumber(value.offsetMm, "connector.offsetMm", 0, MAX_SPACE_MM),
      handing,
      opensInto,
    };
  }

  const windows: NonNullable<PlanAnnexInput["windows"]> = Array.isArray(record.windows)
    ? record.windows.map((raw, index) => {
        const value = requireObject(raw);
        const wall = value.wall;
        if (wall !== "outer" && wall !== "start" && wall !== "end") {
          throw new LabSpaceActionError(`windows[${index}].wall must be outer, start, or end.`);
        }
        return {
          assetId: requiredText(value.assetId, `windows[${index}].assetId`),
          wall,
          offsetMm: optionalFiniteNumber(
            value.offsetMm,
            `windows[${index}].offsetMm`,
            0,
            MAX_SPACE_MM,
          ),
          sillHeightMm: optionalFiniteNumber(
            value.sillHeightMm,
            `windows[${index}].sillHeightMm`,
            0,
            5000,
          ),
        };
      })
    : [];
  if (windows.length > 6) throw new LabSpaceActionError("At most six annex windows are supported.");

  const assets = Array.isArray(record.assets)
    ? record.assets.map((raw, index) => {
        const value = requireObject(raw);
        const quantity = finiteNumber(value.quantity, `assets[${index}].quantity`, 1, 4);
        if (!Number.isInteger(quantity)) {
          throw new LabSpaceActionError(`assets[${index}].quantity must be an integer.`);
        }
        return {
          assetId: requiredText(value.assetId, `assets[${index}].assetId`),
          quantity,
        };
      })
    : [];
  if (assets.reduce((total, asset) => total + asset.quantity, 0) > 12) {
    throw new LabSpaceActionError("An annex plan may contain at most twelve placed assets.");
  }

  return {
    parentRoomCode: requiredText(record.parentRoomCode, "parentRoomCode", 40),
    name: requiredText(record.name, "name"),
    code: requiredText(record.code, "code", 40),
    hostWallId: requiredText(record.hostWallId, "hostWallId", 200),
    widthAlongWallMm: finiteNumber(
      record.widthAlongWallMm,
      "widthAlongWallMm",
      MIN_SPACE_MM,
      MAX_SPACE_MM,
    ),
    outwardDepthMm: finiteNumber(
      record.outwardDepthMm,
      "outwardDepthMm",
      MIN_SPACE_MM,
      MAX_SPACE_MM,
    ),
    offsetAlongWallMm: optionalFiniteNumber(
      record.offsetAlongWallMm,
      "offsetAlongWallMm",
      0,
      MAX_SPACE_MM,
    ),
    wallHeightMm: optionalFiniteNumber(record.wallHeightMm, "wallHeightMm", 2200, 6000),
    wallThicknessMm: optionalFiniteNumber(record.wallThicknessMm, "wallThicknessMm", 80, 400),
    floorFinish:
      record.floorFinish === undefined
        ? undefined
        : requiredText(record.floorFinish, "floorFinish", 120),
    connector,
    windows,
    assets,
  };
}

function wallLength(wall: SceneObject) {
  return wall.wall
    ? Math.hypot(wall.wall.end.x - wall.wall.start.x, wall.wall.end.y - wall.wall.start.y)
    : 0;
}

function pointAlong(wall: SceneObject, offset: number): PlanPoint {
  const length = wallLength(wall);
  if (!wall.wall || !length) throw new LabSpaceActionError("The selected host wall is invalid.");
  return {
    x: wall.wall.start.x + ((wall.wall.end.x - wall.wall.start.x) / length) * offset,
    y: wall.wall.start.y + ((wall.wall.end.y - wall.wall.start.y) / length) * offset,
  };
}

function segmentObject(
  project: Project,
  room: Room,
  scene: Scene,
  template: SceneObject,
  id: string,
  start: PlanPoint,
  end: PlanPoint,
  name: string,
  primarySpaceId: string,
) {
  const now = new Date().toISOString();
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const laboratoryCode =
    project.laboratories.find((laboratory) => laboratory.id === room.laboratoryId)?.code ?? "LAB";
  return {
    ...structuredClone(template),
    id,
    name,
    indexCode:
      id === template.id
        ? template.indexCode
        : generateObjectIndexCode(room, scene, "wall", null, laboratoryCode),
    position: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2, z: 0 },
    dimensions: {
      ...template.dimensions,
      width: length,
      depth: template.wall!.thickness,
      height: template.wall!.height,
    },
    rotation: {
      ...template.rotation,
      z: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI,
    },
    roomId: room.id,
    spaceId: primarySpaceId,
    metadata: { ...template.metadata, agentAnnexPlan: true },
    createdAt: id === template.id ? template.createdAt : now,
    updatedAt: now,
    wall: {
      ...template.wall!,
      start: { ...start },
      end: { ...end },
      halfHeight: false,
    },
  } satisfies SceneObject;
}

function hostedPosition(wall: SceneObject, offset: number) {
  const point = pointAlong(wall, offset);
  return {
    point,
    rotation: wall.wall
      ? (Math.atan2(wall.wall.end.y - wall.wall.start.y, wall.wall.end.x - wall.wall.start.x) *
          180) /
        Math.PI
      : 0,
  };
}

function createOpeningObject(
  project: Project,
  room: Room,
  scene: Scene,
  definition: AssetDefinition,
  wall: SceneObject,
  offset: number,
  sillHeight: number,
  spaceId: string,
  opening: {
    handing: "left" | "right";
    swing: "inward" | "outward" | "sliding";
    connectsSpaceIds?: [string, string] | null;
    opensIntoSpaceId?: string | null;
  },
) {
  const length = wallLength(wall);
  if (
    offset < definition.defaultDimensions.width / 2 + SPLIT_CLEARANCE_MM ||
    offset > length - definition.defaultDimensions.width / 2 - SPLIT_CLEARANCE_MM
  ) {
    throw new LabSpaceActionError(
      `${definition.name} does not fit its annex wall at the requested offset.`,
    );
  }
  if (openingOverlapsSibling(scene.objects, wall.id, offset, definition.defaultDimensions.width)) {
    throw new LabSpaceActionError(`${definition.name} overlaps another hosted opening.`);
  }
  const now = new Date().toISOString();
  const hosted = hostedPosition(wall, offset);
  const laboratoryCode =
    project.laboratories.find((laboratory) => laboratory.id === room.laboratoryId)?.code ?? "LAB";
  return {
    id: crypto.randomUUID(),
    indexCode: generateObjectIndexCode(room, scene, definition.objectType, null, laboratoryCode),
    name: definition.name,
    assetDefinitionId: definition.id,
    objectType: definition.objectType,
    position: { x: hosted.point.x, y: hosted.point.y, z: sillHeight },
    dimensions: { ...definition.defaultDimensions },
    rotation: { x: 0, y: 0, z: hosted.rotation },
    flipHorizontal: false,
    flipVertical: false,
    layerId: resolveLayerIdForObjectType(room.scene.layers, definition.objectType),
    roomId: room.id,
    spaceId,
    zoneId: null,
    locked: false,
    visible: true,
    metadata: { agentAnnexPlan: true },
    createdAt: now,
    updatedAt: now,
    parentObjectId: null,
    childLocationIds: [],
    zIndex: Math.max(0, ...scene.objects.map((object) => object.zIndex)) + 1,
    opening: {
      wallId: wall.id,
      offset,
      width: definition.defaultDimensions.width,
      sillHeight,
      height: definition.defaultDimensions.height,
      handing: opening.handing,
      swing: opening.swing,
      connectsSpaceIds: opening.connectsSpaceIds ?? null,
      opensIntoSpaceId: opening.opensIntoSpaceId ?? null,
    },
  } satisfies SceneObject;
}

function remapHostedOpening(
  object: SceneObject,
  originalWall: SceneObject,
  prefix: SceneObject | null,
  shared: SceneObject,
  suffix: SceneObject | null,
  startOffset: number,
  endOffset: number,
) {
  if (!object.opening || object.opening.wallId !== originalWall.id) return object;
  const halfWidth = object.opening.width / 2;
  const openingStart = object.opening.offset - halfWidth;
  const openingEnd = object.opening.offset + halfWidth;
  if (
    Math.abs(openingStart - startOffset) < SPLIT_CLEARANCE_MM ||
    Math.abs(openingEnd - startOffset) < SPLIT_CLEARANCE_MM ||
    Math.abs(openingStart - endOffset) < SPLIT_CLEARANCE_MM ||
    Math.abs(openingEnd - endOffset) < SPLIT_CLEARANCE_MM ||
    (openingStart < startOffset && openingEnd > startOffset) ||
    (openingStart < endOffset && openingEnd > endOffset)
  ) {
    throw new LabSpaceActionError(
      `${object.name} crosses an annex wall junction. Move it clear of the proposed split and recalculate.`,
    );
  }
  let wall = shared;
  let offset = object.opening.offset - startOffset;
  if (object.opening.offset < startOffset) {
    if (!prefix)
      throw new LabSpaceActionError(`${object.name} cannot be remapped before the annex.`);
    wall = prefix;
    offset = object.opening.offset;
  } else if (object.opening.offset > endOffset) {
    if (!suffix)
      throw new LabSpaceActionError(`${object.name} cannot be remapped after the annex.`);
    wall = suffix;
    offset = object.opening.offset - endOffset;
  }
  const hosted = hostedPosition(wall, offset);
  return {
    ...object,
    position: { ...object.position, x: hosted.point.x, y: hosted.point.y },
    rotation: { ...object.rotation, z: hosted.rotation },
    opening: { ...object.opening, wallId: wall.id, offset },
    updatedAt: new Date().toISOString(),
  };
}

function translateObject(object: SceneObject, x: number, y: number): SceneObject {
  return {
    ...object,
    position: { ...object.position, x: object.position.x + x, y: object.position.y + y },
    wall: object.wall
      ? {
          ...object.wall,
          start: { x: object.wall.start.x + x, y: object.wall.start.y + y },
          end: { x: object.wall.end.x + x, y: object.wall.end.y + y },
        }
      : undefined,
  };
}

function createFreeAsset(
  project: Project,
  room: Room,
  scene: Scene,
  definition: AssetDefinition,
  position: PlanPoint,
  rotation: number,
  spaceId: string,
) {
  const now = new Date().toISOString();
  const laboratoryCode =
    project.laboratories.find((laboratory) => laboratory.id === room.laboratoryId)?.code ?? "LAB";
  return {
    id: crypto.randomUUID(),
    indexCode: generateObjectIndexCode(room, scene, definition.objectType, null, laboratoryCode),
    name: definition.name,
    assetDefinitionId: definition.id,
    objectType: definition.objectType,
    position: { x: position.x, y: position.y, z: 0 },
    dimensions: { ...definition.defaultDimensions },
    rotation: { x: 0, y: 0, z: rotation },
    flipHorizontal: false,
    flipVertical: false,
    layerId: resolveLayerIdForObjectType(room.scene.layers, definition.objectType),
    roomId: room.id,
    spaceId,
    zoneId: null,
    locked: false,
    visible: true,
    metadata: { agentAnnexPlan: true },
    createdAt: now,
    updatedAt: now,
    parentObjectId: null,
    childLocationIds: [],
    zIndex: Math.max(0, ...scene.objects.map((object) => object.zIndex)) + 1,
  } satisfies SceneObject;
}

function storeAnnexPlan(plan: StoredAnnexPlan) {
  annexPlans.set(plan.result.planId, plan);
  while (annexPlans.size > MAX_ANNEX_PLANS) {
    annexPlans.delete(annexPlans.keys().next().value as string);
  }
}

export function planAnnex(input: unknown, readProject = () => useEditorStore.getState().project) {
  const normalized = normalizeAnnexInput(input);
  const project = readProject();
  const room = project.rooms.find(
    (candidate) =>
      candidate.roomKind !== "demo-template" &&
      candidate.code.localeCompare(normalized.parentRoomCode, undefined, {
        sensitivity: "accent",
      }) === 0,
  );
  if (!room) throw new LabSpaceActionError("Editable parent room not found.");
  if (room.spaces.some((space) => space.code.toLowerCase() === normalized.code.toLowerCase())) {
    throw new LabSpaceActionError(`Space code ${normalized.code} already exists in this room.`);
  }
  const primary = room.spaces.find((space) => space.kind === "primary");
  if (!primary) throw new LabSpaceActionError("The parent room has no primary space.");
  const host = room.scene.objects.find(
    (object) => object.id === normalized.hostWallId && object.wall && !object.wall.halfHeight,
  );
  if (!host?.wall) throw new LabSpaceActionError("The stable host wall ID was not found.");
  const primaryWallIds = new Set(
    room.spaces.length === 1
      ? room.scene.objects.filter((object) => object.wall).map((object) => object.id)
      : primary.wallIds,
  );
  if (!primaryWallIds.has(host.id)) {
    throw new LabSpaceActionError(
      "The selected host wall is not part of the primary space boundary.",
    );
  }
  const primaryFloor = getClosedWallFloorPolygon(
    room.scene.objects.filter((object) => object.wall && primaryWallIds.has(object.id)),
  );
  if (!primaryFloor) {
    throw new LabSpaceActionError(
      "The primary space must have a closed valid floor before adding an annex.",
    );
  }

  const hostLength = wallLength(host);
  if (normalized.widthAlongWallMm > hostLength) {
    throw new LabSpaceActionError("The annex width exceeds the selected host wall length.");
  }
  const startOffset =
    normalized.offsetAlongWallMm ?? (hostLength - normalized.widthAlongWallMm) / 2;
  const endOffset = startOffset + normalized.widthAlongWallMm;
  if (startOffset < 0 || endOffset > hostLength) {
    throw new LabSpaceActionError("The annex junctions fall outside the selected host wall.");
  }
  const start = pointAlong(host, startOffset);
  const end = pointAlong(host, endOffset);
  const unit = {
    x: (end.x - start.x) / normalized.widthAlongWallMm,
    y: (end.y - start.y) / normalized.widthAlongWallMm,
  };
  const rightNormal = { x: unit.y, y: -unit.x };
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const rightInside = pointIsInsideFloorPolygon(
    { x: midpoint.x + rightNormal.x * 200, y: midpoint.y + rightNormal.y * 200 },
    primaryFloor,
  );
  const leftInside = pointIsInsideFloorPolygon(
    { x: midpoint.x - rightNormal.x * 200, y: midpoint.y - rightNormal.y * 200 },
    primaryFloor,
  );
  if (rightInside === leftInside) {
    throw new LabSpaceActionError(
      "The selected wall does not expose one unambiguous exterior side of the primary space.",
    );
  }
  const outward = rightInside ? { x: -rightNormal.x, y: -rightNormal.y } : rightNormal;
  const outerStart = {
    x: start.x + outward.x * normalized.outwardDepthMm,
    y: start.y + outward.y * normalized.outwardDepthMm,
  };
  const outerEnd = {
    x: end.x + outward.x * normalized.outwardDepthMm,
    y: end.y + outward.y * normalized.outwardDepthMm,
  };
  const annexPoints = [start, end, outerEnd, outerStart];
  const annexProbe = {
    x: midpoint.x + outward.x * (normalized.outwardDepthMm / 2),
    y: midpoint.y + outward.y * (normalized.outwardDepthMm / 2),
  };
  if (pointIsInsideFloorPolygon(annexProbe, primaryFloor)) {
    throw new LabSpaceActionError("The proposed annex overlaps the primary space.");
  }
  const existingSpaceFloors = getRoomSpaceFloorPlans(room).filter(
    (floor) => floor.spaceId !== primary.id,
  );
  if (
    existingSpaceFloors.some(
      (floor) =>
        annexPoints.some((point) => pointIsInsideFloorPolygon(point, floor, 10)) ||
        floor.points.some((point) => pointIsInsideFloorPolygon(point, { points: annexPoints }, 10)),
    )
  ) {
    throw new LabSpaceActionError("The proposed annex overlaps an existing child space.");
  }

  const proposedScene = structuredClone(room.scene);
  const annexSpaceId = `space-${crypto.randomUUID()}`;
  const prefix =
    startOffset > 1
      ? segmentObject(
          project,
          room,
          proposedScene,
          host,
          crypto.randomUUID(),
          host.wall.start,
          start,
          `${host.name} · primary segment A`,
          primary.id,
        )
      : null;
  if (prefix) proposedScene.objects.push(prefix);
  const shared = segmentObject(
    project,
    room,
    proposedScene,
    host,
    host.id,
    start,
    end,
    `${host.name} · shared with ${normalized.name}`,
    primary.id,
  );
  const suffix =
    hostLength - endOffset > 1
      ? segmentObject(
          project,
          room,
          proposedScene,
          host,
          crypto.randomUUID(),
          end,
          host.wall.end,
          `${host.name} · primary segment B`,
          primary.id,
        )
      : null;
  if (suffix) proposedScene.objects.push(suffix);
  const remappedOpeningIds: string[] = [];
  proposedScene.objects = proposedScene.objects
    .filter((object) => object.id !== host.id)
    .map((object) => {
      const remapped = remapHostedOpening(
        object,
        host,
        prefix,
        shared,
        suffix,
        startOffset,
        endOffset,
      );
      if (remapped !== object) remappedOpeningIds.push(object.id);
      return remapped;
    });
  proposedScene.objects.push(shared);

  const wallThickness = normalized.wallThicknessMm ?? host.wall.thickness;
  const wallHeight = normalized.wallHeightMm ?? host.wall.height;
  const wallTemplate = {
    ...host,
    wall: { ...host.wall, thickness: wallThickness, height: wallHeight },
  };
  const endWall = segmentObject(
    project,
    room,
    proposedScene,
    wallTemplate,
    crypto.randomUUID(),
    end,
    outerEnd,
    `${normalized.name} end wall`,
    annexSpaceId,
  );
  endWall.spaceId = annexSpaceId;
  proposedScene.objects.push(endWall);
  const outerWall = segmentObject(
    project,
    room,
    proposedScene,
    wallTemplate,
    crypto.randomUUID(),
    outerEnd,
    outerStart,
    `${normalized.name} outer wall`,
    annexSpaceId,
  );
  outerWall.spaceId = annexSpaceId;
  proposedScene.objects.push(outerWall);
  const startWall = segmentObject(
    project,
    room,
    proposedScene,
    wallTemplate,
    crypto.randomUUID(),
    outerStart,
    start,
    `${normalized.name} start wall`,
    annexSpaceId,
  );
  startWall.spaceId = annexSpaceId;
  proposedScene.objects.push(startWall);

  const connectorDefinition = normalized.connector
    ? ASSET_BY_ID.get(normalized.connector.assetId)
    : undefined;
  if (normalized.connector && connectorDefinition?.objectType !== "door") {
    throw new LabSpaceActionError("The annex connector asset must be a catalog door.");
  }
  let connectorId: string | null = null;
  if (normalized.connector && connectorDefinition) {
    const connector = createOpeningObject(
      project,
      room,
      proposedScene,
      connectorDefinition,
      shared,
      normalized.connector.offsetMm ?? normalized.widthAlongWallMm / 2,
      0,
      annexSpaceId,
      {
        handing: normalized.connector.handing ?? "left",
        swing: connectorDefinition.id.includes("sliding") ? "sliding" : "inward",
        connectsSpaceIds: [primary.id, annexSpaceId],
        opensIntoSpaceId: normalized.connector.opensInto === "annex" ? annexSpaceId : primary.id,
      },
    );
    proposedScene.objects.push(connector);
    connectorId = connector.id;
  }

  const exteriorWalls = { outer: outerWall, start: startWall, end: endWall };
  const windowIds: string[] = [];
  for (const request of normalized.windows ?? []) {
    const definition = ASSET_BY_ID.get(request.assetId);
    if (definition?.objectType !== "window") {
      throw new LabSpaceActionError(`${request.assetId} is not a catalog window.`);
    }
    const wall = exteriorWalls[request.wall];
    const window = createOpeningObject(
      project,
      room,
      proposedScene,
      definition,
      wall,
      request.offsetMm ?? wallLength(wall) / 2,
      request.sillHeightMm ?? 900,
      annexSpaceId,
      { handing: "left", swing: "sliding" },
    );
    proposedScene.objects.push(window);
    windowIds.push(window.id);
  }

  const requestedDefinitions = (normalized.assets ?? []).flatMap((request) => {
    const definition = ASSET_BY_ID.get(request.assetId);
    if (
      !definition ||
      ["wall", "door", "window"].includes(definition.objectType) ||
      definition.connection === "ceiling" ||
      definition.connection === "bench"
    ) {
      throw new LabSpaceActionError(`${request.assetId} is not supported as an annex floor asset.`);
    }
    return Array.from({ length: request.quantity }, () => definition);
  });
  const assetIds: string[] = [];
  const fractions = [0.2, 0.5, 0.8];
  for (const [index, definition] of requestedDefinitions.entries()) {
    let placed: SceneObject | null = null;
    for (let candidateIndex = 0; candidateIndex < 9 && !placed; candidateIndex += 1) {
      const along = fractions[(candidateIndex + index) % fractions.length];
      const depth =
        fractions[(Math.floor(candidateIndex / fractions.length) + index) % fractions.length];
      const point = {
        x:
          start.x +
          unit.x * normalized.widthAlongWallMm * along +
          outward.x * normalized.outwardDepthMm * depth,
        y:
          start.y +
          unit.y * normalized.widthAlongWallMm * along +
          outward.y * normalized.outwardDepthMm * depth,
      };
      const candidate = createFreeAsset(
        project,
        room,
        proposedScene,
        definition,
        point,
        shared.rotation.z,
        annexSpaceId,
      );
      const hypothetical: Room = {
        ...room,
        spaces: [
          ...room.spaces,
          {
            id: annexSpaceId,
            roomId: room.id,
            parentSpaceId: primary.id,
            kind: "annex",
            name: normalized.name,
            code: normalized.code,
            wallIds: [shared.id, endWall.id, outerWall.id, startWall.id],
            floorFinish: normalized.floorFinish ?? room.floorFinish,
          },
        ],
        scene: { ...proposedScene, objects: [...proposedScene.objects, candidate] },
      };
      const blocking = validatePlacement(hypothetical).some(
        (warning) =>
          warning.objectIds.includes(candidate.id) &&
          ["outside-", "overlap-", "unsupported-", "above-ceiling-", "access-front-"].some(
            (prefix) => warning.id.startsWith(prefix),
          ),
      );
      if (!blocking) placed = candidate;
    }
    if (!placed) {
      throw new LabSpaceActionError(
        `${definition.name} could not be placed inside the annex with valid clearances.`,
      );
    }
    proposedScene.objects.push(placed);
    assetIds.push(placed.id);
    const now = new Date().toISOString();
    if (definition.indexingBehavior === "storage") {
      proposedScene.storageLocations.push(
        ...createStorageLocations(definition, placed, room.id, now).map((location) => ({
          ...location,
          spaceId: annexSpaceId,
        })),
      );
    }
    if (definition.objectType === "equipment") {
      proposedScene.equipmentRecords.push({
        ...createEquipmentRecord(placed, proposedScene.equipmentRecords),
        spaceId: annexSpaceId,
      });
    }
  }

  const primaryWallList = [
    ...primaryWallIds,
    ...(prefix ? [prefix.id] : []),
    ...(suffix ? [suffix.id] : []),
  ];
  const proposedSpaces = room.spaces.map((space) =>
    space.id === primary.id
      ? { ...space, wallIds: [...new Set(primaryWallList)] }
      : structuredClone(space),
  );
  proposedSpaces.push({
    id: annexSpaceId,
    roomId: room.id,
    parentSpaceId: primary.id,
    kind: "annex",
    name: normalized.name,
    code: normalized.code,
    wallIds: [shared.id, endWall.id, outerWall.id, startWall.id],
    floorFinish: normalized.floorFinish ?? room.floorFinish,
  });

  const allWallPoints = proposedScene.objects.flatMap((object) =>
    object.wall ? [object.wall.start, object.wall.end] : [],
  );
  const minX = Math.min(...allWallPoints.map((point) => point.x), 0);
  const minY = Math.min(...allWallPoints.map((point) => point.y), 0);
  const shiftX = minX < 0 ? -minX : 0;
  const shiftY = minY < 0 ? -minY : 0;
  if (shiftX || shiftY) {
    proposedScene.objects = proposedScene.objects.map((object) =>
      translateObject(object, shiftX, shiftY),
    );
  }
  const shiftedWallPoints = proposedScene.objects.flatMap((object) =>
    object.wall ? [object.wall.start, object.wall.end] : [],
  );
  const proposedRoom: Room = {
    ...structuredClone(room),
    width: Math.max(...shiftedWallPoints.map((point) => point.x)),
    depth: Math.max(...shiftedWallPoints.map((point) => point.y)),
    wallHeight: Math.max(room.wallHeight, wallHeight),
    spaces: proposedSpaces,
    scene: { ...proposedScene, updatedAt: new Date().toISOString() },
    updatedAt: new Date().toISOString(),
  };
  const floors = getRoomSpaceFloorPlans(proposedRoom);
  const primaryResult = floors.find((floor) => floor.spaceId === primary.id);
  const annexResult = floors.find((floor) => floor.spaceId === annexSpaceId);
  if (!primaryResult || !annexResult) {
    throw new LabSpaceActionError(
      "The proposed wall split did not produce two closed spaces. No preview was created.",
    );
  }
  const expectedAnnexArea = normalized.widthAlongWallMm * normalized.outwardDepthMm;
  if (
    Math.abs(primaryResult.areaMm2 - primaryFloor.areaMm2) > 1 ||
    Math.abs(annexResult.areaMm2 - expectedAnnexArea) > 1
  ) {
    throw new LabSpaceActionError(
      "The proposed annex changed the primary area or produced an unexpected annex area.",
    );
  }
  const newIds = new Set([
    ...(prefix ? [prefix.id] : []),
    ...(suffix ? [suffix.id] : []),
    shared.id,
    endWall.id,
    outerWall.id,
    startWall.id,
    ...(connectorId ? [connectorId] : []),
    ...windowIds,
    ...assetIds,
    ...remappedOpeningIds,
  ]);
  const planId = crypto.randomUUID();
  const result: PlanAnnexResult = {
    planId,
    roomId: room.id,
    roomName: room.name,
    roomCode: room.code,
    primarySpaceId: primary.id,
    annexSpaceId,
    annexName: normalized.name,
    annexCode: normalized.code,
    hostWallId: host.id,
    sharedWallId: shared.id,
    createdWallIds: [
      ...(prefix ? [prefix.id] : []),
      ...(suffix ? [suffix.id] : []),
      endWall.id,
      outerWall.id,
      startWall.id,
    ],
    remappedOpeningIds,
    connectorId,
    windowIds,
    assetIds,
    areas: {
      primaryM2: Number((primaryResult.areaMm2 / 1_000_000).toFixed(2)),
      annexM2: Number((annexResult.areaMm2 / 1_000_000).toFixed(2)),
      totalM2: Number(((primaryResult.areaMm2 + annexResult.areaMm2) / 1_000_000).toFixed(2)),
    },
    diagnostics: [
      "Stable host wall split and existing hosted openings remapped.",
      "Primary and annex closure and independent floor areas validated.",
      connectorId
        ? "Internal connector records both connected spaces and its opening destination."
        : "No internal connector was requested.",
      "Existing-room annex changes always require explicit human approval.",
    ],
    requiresHumanApproval: true,
  };
  storeAnnexPlan({
    result,
    baseline: {
      sceneUpdatedAt: room.scene.updatedAt,
      objectIds: room.scene.objects.map((object) => object.id).sort(),
      spaces: structuredClone(room.spaces),
      roomSize: { width: room.width, depth: room.depth, wallHeight: room.wallHeight },
    },
    proposedRoom,
    affectedObjectIds: [...newIds],
  });
  agentActivityActions.record({
    actor: "LabSpace",
    action: "Annex plan calculated",
    subject: `${normalized.name} · ${result.areas.annexM2.toFixed(2)} m²`,
    status: "valid",
    evidence: "Read-only geometry plan · explicit approval still required",
    correlationId: planId,
    roomId: room.id,
  });
  return result;
}

function normalizeStageInput(input: unknown) {
  const record = requireObject(input);
  if (Object.keys(record).some((key) => key !== "planId")) {
    throw new LabSpaceActionError("Only planId is accepted when staging an annex plan.");
  }
  return requiredText(record.planId, "planId", 200);
}

export function stageAnnexPlan(input: unknown): StageRoomLayoutResult {
  const planId = normalizeStageInput(input);
  const stored = annexPlans.get(planId);
  if (!stored) {
    throw new LabSpaceActionError("Annex plan not found. Recalculate it before staging.");
  }
  const state = useEditorStore.getState();
  if (state.pendingAgentChange) {
    if (state.pendingAgentChange.tool === "layout" && state.pendingAgentChange.planId === planId) {
      const pending = state.pendingAgentChange;
      return {
        staged: true,
        stageId: pending.stageId,
        planId,
        roomId: pending.roomId,
        roomName: pending.roomName,
        objectCount: pending.proposedObjects.length,
        wallCount: pending.proposedObjects.filter((object) => object.kind === "wall").length,
        assetCount: pending.proposedObjects.filter((object) => object.kind === "asset").length,
        floorGenerated: true,
        objects: pending.proposedObjects,
        persisted: false,
        requiresHumanApproval: true,
        autoCommitted: false,
        executionMode: "reviewed",
        executionDisposition: "review-required",
        executionReason: "Existing-room annex changes always require explicit human approval.",
      };
    }
    throw new LabSpaceActionError("Approve or cancel the current agent preview first.");
  }
  if (state.saveStatus !== "saved") {
    throw new LabSpaceActionError(
      "LabSpace must finish saving human edits before staging an annex.",
    );
  }
  const room = state.project.rooms.find((candidate) => candidate.id === stored.result.roomId);
  if (!room || room.id !== state.project.activeRoomId) {
    throw new LabSpaceActionError("Open the annex plan's parent room before staging it.");
  }
  if (
    room.scene.updatedAt !== stored.baseline.sceneUpdatedAt ||
    JSON.stringify(room.scene.objects.map((object) => object.id).sort()) !==
      JSON.stringify(stored.baseline.objectIds) ||
    JSON.stringify(room.spaces) !== JSON.stringify(stored.baseline.spaces) ||
    JSON.stringify({ width: room.width, depth: room.depth, wallHeight: room.wallHeight }) !==
      JSON.stringify(stored.baseline.roomSize)
  ) {
    throw new LabSpaceActionError(
      "The room changed after this annex was calculated. Recalculate before staging.",
    );
  }

  const beforeScene = structuredClone(room.scene);
  const proposedScene = structuredClone(stored.proposedRoom.scene);
  const affected = new Set(stored.affectedObjectIds);
  proposedScene.objects = proposedScene.objects.map((object) =>
    affected.has(object.id)
      ? {
          ...object,
          locked: true,
          metadata: { ...object.metadata, agentPlanPreview: true, agentPlanId: planId },
        }
      : object,
  );
  const proposedObjects: PendingAgentLayoutChange["proposedObjects"] = proposedScene.objects
    .filter((object) => affected.has(object.id))
    .map((object) => ({
      objectId: object.id,
      name: object.name,
      indexCode: object.indexCode,
      kind: object.wall ? "wall" : "asset",
      position: {
        xMm: object.position.x,
        yMm: object.position.y,
        zMm: object.position.z,
        rotationDeg: object.rotation.z,
      },
    }));
  const stageId = crypto.randomUUID();
  const change: PendingAgentLayoutChange = {
    stageId,
    tool: "layout",
    planId,
    roomId: room.id,
    roomName: room.name,
    brief: `Add ${stored.result.annexName} (${stored.result.annexCode})`,
    changeKind: "annex",
    beforeScene,
    proposedScene,
    beforeSpaces: structuredClone(room.spaces),
    proposedSpaces: structuredClone(stored.proposedRoom.spaces),
    proposedObjectIds: [...affected],
    proposedObjects,
    beforeRoomSize: { width: room.width, depth: room.depth, wallHeight: room.wallHeight },
    proposedRoomSize: {
      width: stored.proposedRoom.width,
      depth: stored.proposedRoom.depth,
      wallHeight: stored.proposedRoom.wallHeight,
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
      rooms: state.project.rooms.map((candidate) =>
        candidate.id === room.id
          ? {
              ...candidate,
              width: stored.proposedRoom.width,
              depth: stored.proposedRoom.depth,
              wallHeight: stored.proposedRoom.wallHeight,
              spaces: stored.proposedRoom.spaces,
              scene: proposedScene,
              updatedAt: now,
            }
          : candidate,
      ),
    },
    selectedIds: [...affected],
    pendingAgentChange: change,
  });
  const execution = decideWebMcpMutation("existing-room-layout", { valid: true });
  agentActivityActions.record({
    actor: "WebMCP",
    action: "Annex staged for review",
    subject: `${stored.result.annexName} · ${stored.result.areas.annexM2.toFixed(2)} m²`,
    status: "pending",
    evidence: "Atomic preview · one approval · one Undo after commit",
    correlationId: planId,
    roomId: room.id,
  });
  return {
    staged: true,
    stageId,
    planId,
    roomId: room.id,
    roomName: room.name,
    objectCount: proposedObjects.length,
    wallCount: proposedObjects.filter((object) => object.kind === "wall").length,
    assetCount: proposedObjects.filter((object) => object.kind === "asset").length,
    floorGenerated: true,
    objects: proposedObjects,
    persisted: false,
    requiresHumanApproval: true,
    autoCommitted: false,
    executionMode: execution.mode,
    executionDisposition: "review-required",
    executionReason: "Existing-room annex changes always require explicit human approval.",
  };
}

export function clearStoredAnnexPlans() {
  annexPlans.clear();
}

export const labSpaceAnnexActions = {
  planAnnex,
  stageAnnexPlan,
};
