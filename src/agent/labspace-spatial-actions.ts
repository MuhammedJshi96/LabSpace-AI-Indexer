import {
  findBenchSupport,
  frontAccessRequirement,
  objectBounds,
  objectFrontVector,
  requiresBenchSupport,
  roomArea,
  validatePlacement,
  type ValidationWarning,
} from "../domain/geometry";
import { getClosedWallFloorPolygon, getRoomSpaceFloorPlans } from "../domain/room-geometry";
import { openingOverlapsSibling } from "../domain/wall-openings";
import type { Project, Room, SceneObject } from "../domain/schema";
import { useEditorStore } from "../store/editor-store";
import type {
  AuditRoomInput,
  LabSpaceSpatialActions,
  RoomAuditResult,
  PlacementConflict,
  RecommendObjectPlacementsInput,
  RecommendObjectPlacementsResult,
  RecommendedPlacement,
  ValidateObjectMoveInput,
  ValidateObjectMoveResult,
  ValidateObjectResizeInput,
  ValidateObjectResizeResult,
} from "./labspace-action-types";
import { LabSpaceActionError } from "./labspace-read-actions";

const MAX_OBJECT_ID_LENGTH = 200;
const MAX_COORDINATE_MM = 100_000;
const MAX_CONFLICTS = 8;
const MAX_RECOMMENDATION_LIMIT = 5;
const MAX_RECOMMENDATION_EVALUATIONS = 1_600;
const RECOMMENDATION_GRID_MM = 500;
const RECOMMENDATION_DIVERSITY_MM = 750;
const MOVABLE_OBJECT_TYPES = new Set(["furniture", "storage", "equipment"]);
const RESIZABLE_OBJECT_TYPES = new Set(["furniture", "storage", "equipment", "door", "window"]);

export type LabSpaceSpatialStateReader = () => Project;

function readCurrentProject() {
  return useEditorStore.getState().project;
}

function normalizeAuditInput(input: unknown): AuditRoomInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new LabSpaceActionError("Tool input must be a JSON object.");
  }
  const record = input as Record<string, unknown>;
  const unexpected = Object.keys(record).find((key) => key !== "roomCode");
  if (unexpected) throw new LabSpaceActionError(`Unexpected input field: ${unexpected}.`);
  if (record.roomCode === undefined) return {};
  if (typeof record.roomCode !== "string") {
    throw new LabSpaceActionError("Room code must be a string.");
  }
  const roomCode = record.roomCode.trim();
  if (!roomCode) throw new LabSpaceActionError("Room code cannot be empty.");
  if (roomCode.length > 40)
    throw new LabSpaceActionError("Room code must be 40 characters or fewer.");
  return { roomCode };
}

export function auditRoom(
  input: unknown,
  readProject: LabSpaceSpatialStateReader = readCurrentProject,
): RoomAuditResult {
  const normalized = normalizeAuditInput(input);
  const project = readProject();
  const room = normalized.roomCode
    ? project.rooms.find(
        (entry) =>
          entry.roomKind !== "demo-template" &&
          entry.code.localeCompare(normalized.roomCode!, undefined, { sensitivity: "accent" }) ===
            0,
      )
    : project.rooms.find((entry) => entry.id === project.activeRoomId);
  if (!room || room.roomKind === "demo-template") {
    throw new LabSpaceActionError("Editable room not found in the current LabSpace project.");
  }
  const laboratory = project.laboratories.find((entry) => entry.id === room.laboratoryId);
  if (!laboratory) throw new LabSpaceActionError("The room laboratory could not be resolved.");

  const warnings = validatePlacement(room);
  const objectsById = new Map(room.scene.objects.map((object) => [object.id, object]));
  const count = (severity: "info" | "warning" | "error") =>
    warnings.filter((warning) => warning.severity === severity).length;
  const errors = count("error");
  const warningCount = count("warning");
  const information = count("info");
  const openings = room.scene.objects.filter((object) =>
    ["door", "window"].includes(object.objectType),
  );
  const placedAssets = room.scene.objects.filter(
    (object) =>
      object.visible &&
      !["wall", "door", "window", "label", "measurement"].includes(object.objectType),
  );
  const spaceFloors = getRoomSpaceFloorPlans(room);
  const floorBySpaceId = new Map(spaceFloors.map((floor) => [floor.spaceId, floor]));
  const validSpaceIds = new Set(room.spaces.map((space) => space.id));
  const unassignedObjectIds = placedAssets
    .filter((object) => !object.spaceId || !validSpaceIds.has(object.spaceId))
    .map((object) => object.id);
  const spaceAudits = room.spaces.map((space) => {
    const floor = floorBySpaceId.get(space.id);
    return {
      id: space.id,
      kind: space.kind,
      name: space.name,
      code: space.code,
      areaM2: Number(((floor?.areaMm2 ?? 0) / 1_000_000).toFixed(2)),
      closedFloorShell: Boolean(floor),
      wallIds: [...space.wallIds],
      connectingOpeningIds: openings
        .filter((opening) => opening.opening?.connectsSpaceIds?.includes(space.id))
        .map((opening) => opening.id),
      unassignedObjectIds,
    };
  });
  const primaryAreaM2 = spaceAudits
    .filter((space) => space.kind === "primary")
    .reduce((total, space) => total + space.areaM2, 0);
  const annexAreaM2 = spaceAudits
    .filter((space) => space.kind === "annex")
    .reduce((total, space) => total + space.areaM2, 0);
  const hasIssue = (prefix: string) => warnings.some((warning) => warning.id.startsWith(prefix));

  return {
    room: {
      id: room.id,
      name: room.name,
      code: room.code,
      laboratoryCode: laboratory.code,
      floor: (room.facilityPlacement?.floor ?? 0) + 1,
    },
    status: errors > 0 ? "blocked" : warningCount > 0 ? "attention" : "ready",
    summary: {
      floorAreaM2: Number(
        (spaceFloors.length ? primaryAreaM2 + annexAreaM2 : roomArea(room)).toFixed(2),
      ),
      primaryAreaM2: Number(primaryAreaM2.toFixed(2)),
      annexAreaM2: Number(annexAreaM2.toFixed(2)),
      walls: room.scene.objects.filter((object) => object.objectType === "wall").length,
      openings: openings.length,
      placedAssets: placedAssets.length,
      inventory: room.scene.inventoryItems.length,
      equipment: room.scene.equipmentRecords.length,
      errors,
      warnings: warningCount,
      information,
    },
    checks: {
      closedFloorShell: getClosedWallFloorPolygon(room.scene.objects) !== null,
      hostedOpenings: openings.every((object) => Boolean(object.opening)),
      supportedBenchEquipment:
        !hasIssue("unsupported-") && !hasIssue("below-floor-") && !hasIssue("above-ceiling-"),
      objectsInsideBoundary: !hasIssue("outside-"),
      frontWorkingZonesClear: !hasIssue("access-front-"),
      uniqueIndexCodes: !hasIssue("duplicate-code-"),
    },
    spaces: spaceAudits,
    issues: warnings.slice(0, 12).map((warning) => ({
      severity: warning.severity,
      title: warning.title,
      message: warning.message,
      objectIds: warning.objectIds,
      indexCodes: warning.objectIds
        .map((id) => objectsById.get(id)?.indexCode)
        .filter((code): code is string => Boolean(code)),
    })),
    basis: [
      "Uses the same deterministic boundary, overlap, support, front-working-zone, hosted-opening, height, and identifier checks as the visible Layout Editor.",
      "This is a planning-readiness audit, not regulatory certification or a substitute for laboratory safety review.",
      warnings.length > 12
        ? `${warnings.length - 12} additional issues remain available in the Layout Editor validation panel.`
        : "All current deterministic issues are included in this compact result.",
    ],
  };
}

function requireFiniteNumber(value: unknown, label: string, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new LabSpaceActionError(`${label} must be a finite number.`);
  }
  if (value < minimum || value > maximum) {
    throw new LabSpaceActionError(`${label} must be between ${minimum} and ${maximum}.`);
  }
  return value;
}

function normalizeMoveInput(input: unknown): ValidateObjectMoveInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new LabSpaceActionError("Tool input must be a JSON object.");
  }
  const record = input as Record<string, unknown>;
  const unexpected = Object.keys(record).find(
    (key) => !["objectId", "target", "rotationDeg"].includes(key),
  );
  if (unexpected) throw new LabSpaceActionError(`Unexpected input field: ${unexpected}.`);
  if (typeof record.objectId !== "string") {
    throw new LabSpaceActionError("Object ID must be a string.");
  }
  const objectId = record.objectId.trim();
  if (!objectId) throw new LabSpaceActionError("Object ID cannot be empty.");
  if (objectId.length > MAX_OBJECT_ID_LENGTH) {
    throw new LabSpaceActionError(`Object ID must be ${MAX_OBJECT_ID_LENGTH} characters or fewer.`);
  }
  if (!record.target || typeof record.target !== "object" || Array.isArray(record.target)) {
    throw new LabSpaceActionError("Move target must be a JSON object.");
  }
  const target = record.target as Record<string, unknown>;
  const unexpectedTarget = Object.keys(target).find((key) => !["xMm", "yMm"].includes(key));
  if (unexpectedTarget) {
    throw new LabSpaceActionError(`Unexpected target field: ${unexpectedTarget}.`);
  }
  return {
    objectId,
    target: {
      xMm: requireFiniteNumber(target.xMm, "Target xMm", -MAX_COORDINATE_MM, MAX_COORDINATE_MM),
      yMm: requireFiniteNumber(target.yMm, "Target yMm", -MAX_COORDINATE_MM, MAX_COORDINATE_MM),
    },
    ...(record.rotationDeg === undefined
      ? {}
      : { rotationDeg: requireFiniteNumber(record.rotationDeg, "Rotation", -360, 360) }),
  };
}

function normalizeResizeInput(input: unknown): ValidateObjectResizeInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new LabSpaceActionError("Tool input must be a JSON object.");
  }
  const record = input as Record<string, unknown>;
  const unexpected = Object.keys(record).find((key) => !["objectId", "dimensions"].includes(key));
  if (unexpected) throw new LabSpaceActionError(`Unexpected input field: ${unexpected}.`);
  if (typeof record.objectId !== "string") {
    throw new LabSpaceActionError("Object ID must be a string.");
  }
  const objectId = record.objectId.trim();
  if (!objectId) throw new LabSpaceActionError("Object ID cannot be empty.");
  if (objectId.length > MAX_OBJECT_ID_LENGTH) {
    throw new LabSpaceActionError(`Object ID must be ${MAX_OBJECT_ID_LENGTH} characters or fewer.`);
  }
  if (
    !record.dimensions ||
    typeof record.dimensions !== "object" ||
    Array.isArray(record.dimensions)
  ) {
    throw new LabSpaceActionError("Resize dimensions must be a JSON object.");
  }
  const dimensions = record.dimensions as Record<string, unknown>;
  const unexpectedDimension = Object.keys(dimensions).find(
    (key) => !["widthMm", "depthMm", "heightMm"].includes(key),
  );
  if (unexpectedDimension) {
    throw new LabSpaceActionError(`Unexpected dimensions field: ${unexpectedDimension}.`);
  }
  if (Object.keys(dimensions).length === 0) {
    throw new LabSpaceActionError("At least one resize dimension is required.");
  }
  return {
    objectId,
    dimensions: {
      ...(dimensions.widthMm === undefined
        ? {}
        : { widthMm: requireFiniteNumber(dimensions.widthMm, "Width", 100, 20_000) }),
      ...(dimensions.depthMm === undefined
        ? {}
        : { depthMm: requireFiniteNumber(dimensions.depthMm, "Depth", 100, 20_000) }),
      ...(dimensions.heightMm === undefined
        ? {}
        : { heightMm: requireFiniteNumber(dimensions.heightMm, "Height", 100, 6_000) }),
    },
  };
}

function normalizeRotation(value: number) {
  const normalized = ((value % 360) + 360) % 360;
  return normalized === 360 ? 0 : normalized;
}

function normalizeRecommendationInput(input: unknown): RecommendObjectPlacementsInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new LabSpaceActionError("Tool input must be a JSON object.");
  }
  const record = input as Record<string, unknown>;
  const unexpected = Object.keys(record).find(
    (key) => !["objectId", "preferredTarget", "relativeTo", "rotationsDeg", "limit"].includes(key),
  );
  if (unexpected) throw new LabSpaceActionError(`Unexpected input field: ${unexpected}.`);
  if (typeof record.objectId !== "string") {
    throw new LabSpaceActionError("Object ID must be a string.");
  }
  const objectId = record.objectId.trim();
  if (!objectId) throw new LabSpaceActionError("Object ID cannot be empty.");
  if (objectId.length > MAX_OBJECT_ID_LENGTH) {
    throw new LabSpaceActionError(`Object ID must be ${MAX_OBJECT_ID_LENGTH} characters or fewer.`);
  }

  let preferredTarget: RecommendObjectPlacementsInput["preferredTarget"];
  if (record.preferredTarget !== undefined) {
    if (
      !record.preferredTarget ||
      typeof record.preferredTarget !== "object" ||
      Array.isArray(record.preferredTarget)
    ) {
      throw new LabSpaceActionError("Preferred target must be a JSON object.");
    }
    const preferred = record.preferredTarget as Record<string, unknown>;
    const unexpectedTarget = Object.keys(preferred).find((key) => !["xMm", "yMm"].includes(key));
    if (unexpectedTarget) {
      throw new LabSpaceActionError(`Unexpected preferred target field: ${unexpectedTarget}.`);
    }
    preferredTarget = {
      xMm: requireFiniteNumber(
        preferred.xMm,
        "Preferred xMm",
        -MAX_COORDINATE_MM,
        MAX_COORDINATE_MM,
      ),
      yMm: requireFiniteNumber(
        preferred.yMm,
        "Preferred yMm",
        -MAX_COORDINATE_MM,
        MAX_COORDINATE_MM,
      ),
    };
  }

  let relativeTo: RecommendObjectPlacementsInput["relativeTo"];
  if (record.relativeTo !== undefined) {
    if (
      !record.relativeTo ||
      typeof record.relativeTo !== "object" ||
      Array.isArray(record.relativeTo)
    ) {
      throw new LabSpaceActionError("relativeTo must be a JSON object.");
    }
    if (preferredTarget) {
      throw new LabSpaceActionError("Use either preferredTarget or relativeTo, not both.");
    }
    const relative = record.relativeTo as Record<string, unknown>;
    const unexpectedRelative = Object.keys(relative).find(
      (key) => !["objectId", "relation", "clearanceMm"].includes(key),
    );
    if (unexpectedRelative) {
      throw new LabSpaceActionError(`Unexpected relativeTo field: ${unexpectedRelative}.`);
    }
    if (typeof relative.objectId !== "string" || !relative.objectId.trim()) {
      throw new LabSpaceActionError("relativeTo objectId must be a non-empty string.");
    }
    const referenceObjectId = relative.objectId.trim();
    if (referenceObjectId.length > MAX_OBJECT_ID_LENGTH) {
      throw new LabSpaceActionError(
        `relativeTo objectId must be ${MAX_OBJECT_ID_LENGTH} characters or fewer.`,
      );
    }
    if (!["in-front-of", "behind", "left-of", "right-of"].includes(String(relative.relation))) {
      throw new LabSpaceActionError(
        "relativeTo relation must be in-front-of, behind, left-of, or right-of.",
      );
    }
    relativeTo = {
      objectId: referenceObjectId,
      relation: relative.relation as NonNullable<
        RecommendObjectPlacementsInput["relativeTo"]
      >["relation"],
      ...(relative.clearanceMm === undefined
        ? {}
        : {
            clearanceMm: requireFiniteNumber(
              relative.clearanceMm,
              "Relative clearance",
              100,
              5_000,
            ),
          }),
    };
  }

  let rotationsDeg: number[] | undefined;
  if (record.rotationsDeg !== undefined) {
    if (!Array.isArray(record.rotationsDeg) || record.rotationsDeg.length === 0) {
      throw new LabSpaceActionError("rotationsDeg must be a non-empty array.");
    }
    if (record.rotationsDeg.length > 4) {
      throw new LabSpaceActionError("rotationsDeg can contain at most 4 values.");
    }
    rotationsDeg = [
      ...new Set(
        record.rotationsDeg.map((value) =>
          normalizeRotation(requireFiniteNumber(value, "Rotation", -360, 360)),
        ),
      ),
    ];
  }

  let limit: number | undefined;
  if (record.limit !== undefined) {
    if (!Number.isInteger(record.limit)) {
      throw new LabSpaceActionError("Limit must be an integer.");
    }
    limit = requireFiniteNumber(record.limit, "Limit", 1, MAX_RECOMMENDATION_LIMIT);
  }

  return {
    objectId,
    ...(preferredTarget ? { preferredTarget } : {}),
    ...(relativeTo ? { relativeTo } : {}),
    ...(rotationsDeg ? { rotationsDeg } : {}),
    ...(limit ? { limit } : {}),
  };
}

function resolveObject(project: Project, objectId: string) {
  for (const room of project.rooms) {
    if (room.roomKind === "demo-template") continue;
    const object = room.scene.objects.find((entry) => entry.id === objectId);
    if (object) return { room, object };
  }
  throw new LabSpaceActionError("Object not found in the current LabSpace project.");
}

function restrictedConflict(room: Room, object: SceneObject): PlacementConflict | null {
  const layer = room.scene.layers.find((entry) => entry.id === object.layerId);
  if (object.locked || layer?.locked) {
    return {
      type: "restricted-object",
      objectId: object.id,
      indexCode: object.indexCode,
      name: object.name,
      message: `${object.name} is locked and cannot be staged by an agent.`,
    };
  }
  if (!MOVABLE_OBJECT_TYPES.has(object.objectType)) {
    return {
      type: "restricted-object",
      objectId: object.id,
      indexCode: object.indexCode,
      name: object.name,
      message: `${object.name} is structural or safety-critical and cannot be staged by an agent.`,
    };
  }
  return null;
}

function resizeRestriction(room: Room, object: SceneObject): PlacementConflict | null {
  const layer = room.scene.layers.find((entry) => entry.id === object.layerId);
  if (object.locked || layer?.locked) {
    return {
      type: "restricted-object",
      objectId: object.id,
      indexCode: object.indexCode,
      name: object.name,
      message: `${object.name} is locked and cannot be resized by an agent.`,
    };
  }
  if (!RESIZABLE_OBJECT_TYPES.has(object.objectType)) {
    return {
      type: "restricted-object",
      objectId: object.id,
      indexCode: object.indexCode,
      name: object.name,
      message: `${object.name} is structural or annotation geometry and cannot be resized by an agent.`,
    };
  }
  return null;
}

function warningType(warning: ValidationWarning): PlacementConflict["type"] | null {
  if (warning.id.startsWith("outside-")) return "outside-room-boundary";
  if (warning.id.startsWith("overlap-")) return "object-collision";
  if (warning.id.startsWith("access-front-")) return "front-access-obstruction";
  if (warning.id.startsWith("below-floor-")) return "below-floor";
  if (warning.id.startsWith("above-ceiling-")) return "above-room-height";
  if (warning.id.startsWith("unsupported-")) return "missing-support-surface";
  return null;
}

function placementConflicts(room: Room, candidate: SceneObject): PlacementConflict[] {
  const objectsById = new Map(room.scene.objects.map((entry) => [entry.id, entry]));
  return validatePlacement(room)
    .filter((warning) => warning.objectIds.includes(candidate.id))
    .flatMap((warning) => {
      const type = warningType(warning);
      if (!type) return [];
      const relatedId = warning.objectIds.find((id) => id !== candidate.id);
      const related = relatedId ? objectsById.get(relatedId) : undefined;
      return [
        {
          type,
          ...(related
            ? {
                objectId: related.id,
                indexCode: related.indexCode,
                name: related.name,
              }
            : {}),
          message: warning.message,
        } satisfies PlacementConflict,
      ];
    })
    .slice(0, MAX_CONFLICTS);
}

function recordValidation(result: ValidateObjectMoveResult) {
  return result;
}

function dimensionsMm(object: SceneObject) {
  return {
    widthMm: object.dimensions.width,
    depthMm: object.dimensions.depth,
    heightMm: object.dimensions.height,
  };
}

function hostedOpeningConflicts(room: Room, object: SceneObject): PlacementConflict[] {
  if (!object.opening) return [];
  const wall = room.scene.objects.find(
    (entry) => entry.id === object.opening?.wallId && entry.wall,
  );
  if (!wall?.wall) {
    return [
      {
        type: "opening-outside-wall",
        objectId: object.id,
        indexCode: object.indexCode,
        name: object.name,
        message: `${object.name} no longer has a valid host wall.`,
      },
    ];
  }
  const length = Math.hypot(
    wall.wall.end.x - wall.wall.start.x,
    wall.wall.end.y - wall.wall.start.y,
  );
  const conflicts: PlacementConflict[] = [];
  const start = object.opening.offset - object.dimensions.width / 2;
  const end = object.opening.offset + object.dimensions.width / 2;
  if (start < -0.001 || end > length + 0.001) {
    conflicts.push({
      type: "opening-outside-wall",
      objectId: wall.id,
      indexCode: wall.indexCode,
      name: wall.name,
      message: `${object.name} is ${object.dimensions.width} mm wide and does not fit at its current offset on the ${Math.round(length)} mm host wall.`,
    });
  }
  if (
    openingOverlapsSibling(
      room.scene.objects,
      wall.id,
      object.opening.offset,
      object.dimensions.width,
      object.id,
      0,
    )
  ) {
    conflicts.push({
      type: "opening-overlap",
      objectId: wall.id,
      indexCode: wall.indexCode,
      name: wall.name,
      message: `${object.name} would overlap another hosted door or window on ${wall.name}.`,
    });
  }
  const wallHeight = wall.wall.height || room.wallHeight;
  if (object.opening.sillHeight + object.dimensions.height > wallHeight + 0.001) {
    conflicts.push({
      type: "above-room-height",
      objectId: wall.id,
      indexCode: wall.indexCode,
      name: wall.name,
      message: `${object.name} would extend above the ${Math.round(wallHeight)} mm host wall.`,
    });
  }
  return conflicts.slice(0, MAX_CONFLICTS);
}

function candidateObjectGap(room: Room, candidate: SceneObject) {
  const candidateBounds = objectBounds(candidate);
  const supportingObjectId = findBenchSupport(room, candidate)?.object.id ?? null;
  let minimum = Number.POSITIVE_INFINITY;
  for (const other of room.scene.objects) {
    if (
      other.id === candidate.id ||
      other.id === supportingObjectId ||
      !other.visible ||
      ["wall", "door", "window", "label", "measurement"].includes(other.objectType) ||
      other.parentObjectId === candidate.id ||
      candidate.parentObjectId === other.id
    ) {
      continue;
    }
    const candidateTop = candidate.position.z + candidate.dimensions.height;
    const otherTop = other.position.z + other.dimensions.height;
    if (candidateTop <= other.position.z || otherTop <= candidate.position.z) continue;
    const otherBounds = objectBounds(other);
    const dx = Math.max(
      otherBounds.left - candidateBounds.right,
      candidateBounds.left - otherBounds.right,
      0,
    );
    const dy = Math.max(
      otherBounds.top - candidateBounds.bottom,
      candidateBounds.top - otherBounds.bottom,
      0,
    );
    minimum = Math.min(minimum, Math.hypot(dx, dy));
  }
  return Number.isFinite(minimum) ? Math.round(minimum) : null;
}

function rotationForFrontVector(vector: { x: number; y: number }) {
  return normalizeRotation((Math.atan2(-vector.x, vector.y) * 180) / Math.PI);
}

function angularDistance(first: number, second: number) {
  const distance = Math.abs(normalizeRotation(first) - normalizeRotation(second));
  return Math.min(distance, 360 - distance);
}

function resolveRelativePlacement(
  room: Room,
  object: SceneObject,
  relativeTo: NonNullable<RecommendObjectPlacementsInput["relativeTo"]>,
) {
  const reference = room.scene.objects.find((entry) => entry.id === relativeTo.objectId);
  if (!reference || !reference.visible) {
    throw new LabSpaceActionError(
      "The relative placement reference must be a visible object in the same room.",
    );
  }
  if (reference.id === object.id) {
    throw new LabSpaceActionError("An object cannot be placed relative to itself.");
  }
  const referenceFront = objectFrontVector(reference);
  const referenceRight = { x: referenceFront.y, y: -referenceFront.x };
  const direction =
    relativeTo.relation === "in-front-of"
      ? referenceFront
      : relativeTo.relation === "behind"
        ? { x: -referenceFront.x, y: -referenceFront.y }
        : relativeTo.relation === "right-of"
          ? referenceRight
          : { x: -referenceRight.x, y: -referenceRight.y };
  const referenceExtent = ["in-front-of", "behind"].includes(relativeTo.relation)
    ? reference.dimensions.depth / 2
    : reference.dimensions.width / 2;
  const clearanceMm = relativeTo.clearanceMm ?? (frontAccessRequirement(object) ? 600 : 300);
  const distance = referenceExtent + object.dimensions.depth / 2 + clearanceMm;
  const preferredTarget = {
    xMm: Math.round((reference.position.x + direction.x * distance) / 50) * 50,
    yMm: Math.round((reference.position.y + direction.y * distance) / 50) * 50,
  };
  const facingRotationDeg = rotationForFrontVector({ x: -direction.x, y: -direction.y });
  return {
    reference,
    preferredTarget,
    clearanceMm,
    facingRotationDeg,
    direction,
    referenceExtent,
    desiredDistanceMm: distance,
  };
}

function matchesRelativeCorridor(
  position: { xMm: number; yMm: number },
  object: SceneObject,
  relative: ReturnType<typeof resolveRelativePlacement>,
) {
  const dx = position.xMm - relative.reference.position.x;
  const dy = position.yMm - relative.reference.position.y;
  const along = dx * relative.direction.x + dy * relative.direction.y;
  const across = Math.abs(dx * -relative.direction.y + dy * relative.direction.x);
  const minimumDistance =
    relative.referenceExtent + object.dimensions.depth / 2 + relative.clearanceMm - 100;
  return (
    along >= minimumDistance &&
    along <= relative.desiredDistanceMm + 1_000 &&
    across <= Math.max(500, relative.reference.dimensions.width / 2)
  );
}

function recommendationPositions(room: Room, preferred: { xMm: number; yMm: number }) {
  const floor = getClosedWallFloorPolygon(room.scene.objects);
  const bounds = floor?.bounds ?? { minX: 0, minY: 0, maxX: room.width, maxY: room.depth };
  const keyed = new Map<string, { xMm: number; yMm: number }>();
  const add = (xMm: number, yMm: number) => {
    const x = Math.round(xMm / 50) * 50;
    const y = Math.round(yMm / 50) * 50;
    keyed.set(`${x}:${y}`, { xMm: x, yMm: y });
  };

  add(preferred.xMm, preferred.yMm);
  for (const radius of [250, 500, 750, 1_000, 1_500, 2_000]) {
    for (const [dx, dy] of [
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
      [radius, radius],
      [radius, -radius],
      [-radius, radius],
      [-radius, -radius],
    ]) {
      add(preferred.xMm + dx, preferred.yMm + dy);
    }
  }

  const firstX = Math.ceil(bounds.minX / RECOMMENDATION_GRID_MM) * RECOMMENDATION_GRID_MM;
  const firstY = Math.ceil(bounds.minY / RECOMMENDATION_GRID_MM) * RECOMMENDATION_GRID_MM;
  for (let y = firstY; y <= bounds.maxY; y += RECOMMENDATION_GRID_MM) {
    for (let x = firstX; x <= bounds.maxX; x += RECOMMENDATION_GRID_MM) add(x, y);
  }

  return [...keyed.values()].sort(
    (left, right) =>
      Math.hypot(left.xMm - preferred.xMm, left.yMm - preferred.yMm) -
      Math.hypot(right.xMm - preferred.xMm, right.yMm - preferred.yMm),
  );
}

export function recommendObjectPlacements(
  input: unknown,
  readProject: LabSpaceSpatialStateReader = readCurrentProject,
): RecommendObjectPlacementsResult {
  const normalized = normalizeRecommendationInput(input);
  const project = readProject();
  const { room, object } = resolveObject(project, normalized.objectId);
  const restriction = restrictedConflict(room, object);
  if (restriction) throw new LabSpaceActionError(restriction.message);

  const relative = normalized.relativeTo
    ? resolveRelativePlacement(room, object, normalized.relativeTo)
    : null;
  const preferred = normalized.preferredTarget ??
    relative?.preferredTarget ?? {
      xMm: object.position.x,
      yMm: object.position.y,
    };
  const currentRotation = normalizeRotation(object.rotation.z);
  const rotations =
    normalized.rotationsDeg ??
    (relative
      ? [relative.facingRotationDeg]
      : frontAccessRequirement(object)
        ? [
            currentRotation,
            normalizeRotation(currentRotation + 90),
            normalizeRotation(currentRotation + 180),
            normalizeRotation(currentRotation + 270),
          ]
        : [currentRotation, normalizeRotation(currentRotation + 90)]);
  const limit = normalized.limit ?? 3;
  const positions = recommendationPositions(room, preferred);
  const evaluated: Array<RecommendedPlacement & { score: number }> = [];
  let evaluatedTargets = 0;

  outer: for (const position of positions) {
    for (const rotationDeg of rotations) {
      if (evaluatedTargets >= MAX_RECOMMENDATION_EVALUATIONS) break outer;
      if (relative && !matchesRelativeCorridor(position, object, relative)) continue;
      const distanceFromCurrent = Math.hypot(
        position.xMm - object.position.x,
        position.yMm - object.position.y,
      );
      if (
        distanceFromCurrent < 20 &&
        angularDistance(rotationDeg, normalizeRotation(object.rotation.z)) < 1
      )
        continue;
      evaluatedTargets += 1;
      const validation = validateObjectMove(
        {
          objectId: object.id,
          target: position,
          rotationDeg,
        },
        () => project,
      );
      if (!validation.valid) continue;
      const candidate: SceneObject = {
        ...object,
        position: {
          ...object.position,
          x: position.xMm,
          y: position.yMm,
          z: validation.target.zMm,
        },
        rotation: { ...object.rotation, z: rotationDeg },
      };
      const distanceFromPreferredMm = Math.round(
        Math.hypot(position.xMm - preferred.xMm, position.yMm - preferred.yMm),
      );
      const nearestObjectGapMm = candidateObjectGap(room, candidate);
      const expectedRotation = relative?.facingRotationDeg ?? currentRotation;
      const rotationPenalty = angularDistance(rotationDeg, expectedRotation) * 5;
      const clearanceCredit = Math.min(nearestObjectGapMm ?? 1_000, 1_000) * 0.2;
      evaluated.push({
        rank: 0,
        target: validation.target,
        distanceFromPreferredMm,
        nearestObjectGapMm,
        rationale: [
          requiresBenchSupport(candidate)
            ? `Passes current geometry rules on a ${validation.target.zMm} mm support surface.`
            : "Passes current room-boundary, overlap, elevation, and room-height rules.",
          distanceFromPreferredMm === 0
            ? "Matches the preferred target."
            : `${distanceFromPreferredMm} mm from the preferred target.`,
          ...(relative
            ? [
                `Faces ${relative.reference.name} from the requested ${normalized.relativeTo!.relation} relation, interpreted from the reference object's authored front.`,
              ]
            : []),
          nearestObjectGapMm === null
            ? "No comparable neighboring object was found."
            : `Nearest axis-aligned plan gap is approximately ${nearestObjectGapMm} mm.`,
        ],
        score: distanceFromPreferredMm + rotationPenalty - clearanceCredit,
      });
    }
  }

  const candidates: RecommendedPlacement[] = [];
  for (const candidate of evaluated.sort((left, right) => left.score - right.score)) {
    if (
      candidates.some(
        (accepted) =>
          Math.hypot(
            accepted.target.xMm - candidate.target.xMm,
            accepted.target.yMm - candidate.target.yMm,
          ) < RECOMMENDATION_DIVERSITY_MM,
      )
    ) {
      continue;
    }
    candidates.push({
      rank: candidates.length + 1,
      target: candidate.target,
      distanceFromPreferredMm: candidate.distanceFromPreferredMm,
      nearestObjectGapMm: candidate.nearestObjectGapMm,
      rationale: candidate.rationale,
    });
    if (candidates.length >= limit) break;
  }

  return {
    objectId: object.id,
    objectName: object.name,
    objectIndexCode: object.indexCode,
    roomCode: room.code,
    preferredTarget: preferred,
    ...(relative && normalized.relativeTo
      ? {
          relativeTo: {
            objectId: relative.reference.id,
            objectName: relative.reference.name,
            relation: normalized.relativeTo.relation,
            clearanceMm: relative.clearanceMm,
            facingRotationDeg: relative.facingRotationDeg,
          },
        }
      : {}),
    evaluatedTargets,
    candidates,
    basis: [
      "Candidates reuse LabSpace's deterministic room-boundary, overlap, elevation, room-height, and front-working-zone rules.",
      ...(relative
        ? [
            `Relative directions use ${relative.reference.name}'s authored front, never the current camera or screen axes.`,
          ]
        : []),
      "Gap values are planning estimates from scene geometry, not regulatory or manufacturer-certified clearances.",
      "Recommendations are read-only; staging and explicit researcher approval remain separate steps.",
    ],
  };
}

export function validateObjectMove(
  input: unknown,
  readProject: LabSpaceSpatialStateReader = readCurrentProject,
): ValidateObjectMoveResult {
  const normalized = normalizeMoveInput(input);
  const project = readProject();
  const { room, object } = resolveObject(project, normalized.objectId);
  const target = {
    xMm: normalized.target.xMm,
    yMm: normalized.target.yMm,
    zMm: object.position.z,
    rotationDeg: normalized.rotationDeg ?? object.rotation.z,
  };
  const restriction = restrictedConflict(room, object);
  if (restriction) {
    return recordValidation({
      valid: false,
      objectId: object.id,
      objectName: object.name,
      objectIndexCode: object.indexCode,
      roomCode: room.code,
      target,
      conflicts: [restriction],
    });
  }

  let candidate: SceneObject = {
    ...object,
    position: { ...object.position, x: target.xMm, y: target.yMm },
    rotation: { ...object.rotation, z: target.rotationDeg },
  };
  if (requiresBenchSupport(candidate)) {
    const support = findBenchSupport(room, candidate);
    if (support) {
      target.zMm = support.elevationMm;
      candidate = {
        ...candidate,
        position: { ...candidate.position, z: support.elevationMm },
      };
    }
  }
  const hypotheticalRoom: Room = {
    ...room,
    scene: {
      ...room.scene,
      objects: room.scene.objects.map((entry) => (entry.id === candidate.id ? candidate : entry)),
    },
  };
  const conflicts = placementConflicts(hypotheticalRoom, candidate);
  return recordValidation({
    valid: conflicts.length === 0,
    objectId: object.id,
    objectName: object.name,
    objectIndexCode: object.indexCode,
    roomCode: room.code,
    target,
    conflicts,
  });
}

export function validateObjectResize(
  input: unknown,
  readProject: LabSpaceSpatialStateReader = readCurrentProject,
): ValidateObjectResizeResult {
  const normalized = normalizeResizeInput(input);
  const project = readProject();
  const { room, object } = resolveObject(project, normalized.objectId);
  const current = dimensionsMm(object);
  const proposed = {
    widthMm: normalized.dimensions.widthMm ?? current.widthMm,
    depthMm: normalized.dimensions.depthMm ?? current.depthMm,
    heightMm: normalized.dimensions.heightMm ?? current.heightMm,
  };
  const restriction = resizeRestriction(room, object);
  if (restriction) {
    return {
      valid: false,
      objectId: object.id,
      objectName: object.name,
      objectIndexCode: object.indexCode,
      roomCode: room.code,
      current,
      proposed,
      conflicts: [restriction],
    };
  }
  if (
    current.widthMm === proposed.widthMm &&
    current.depthMm === proposed.depthMm &&
    current.heightMm === proposed.heightMm
  ) {
    throw new LabSpaceActionError("Resize must change at least one object dimension.");
  }
  if (object.opening && proposed.depthMm !== current.depthMm) {
    return {
      valid: false,
      objectId: object.id,
      objectName: object.name,
      objectIndexCode: object.indexCode,
      roomCode: room.code,
      current,
      proposed,
      conflicts: [
        {
          type: "restricted-object",
          objectId: object.id,
          indexCode: object.indexCode,
          name: object.name,
          message:
            "Hosted opening depth follows wall construction and cannot be resized by an agent.",
        },
      ],
    };
  }

  const candidate: SceneObject = {
    ...object,
    dimensions: {
      width: proposed.widthMm,
      depth: proposed.depthMm,
      height: proposed.heightMm,
    },
    ...(object.opening
      ? {
          opening: {
            ...object.opening,
            width: proposed.widthMm,
            height: proposed.heightMm,
          },
        }
      : {}),
  };
  const hypotheticalRoom: Room = {
    ...room,
    scene: {
      ...room.scene,
      objects: room.scene.objects.map((entry) => (entry.id === candidate.id ? candidate : entry)),
    },
  };
  const conflicts = candidate.opening
    ? hostedOpeningConflicts(hypotheticalRoom, candidate)
    : placementConflicts(hypotheticalRoom, candidate);
  return {
    valid: conflicts.length === 0,
    objectId: object.id,
    objectName: object.name,
    objectIndexCode: object.indexCode,
    roomCode: room.code,
    current,
    proposed,
    conflicts,
  };
}

export function createLabSpaceSpatialActions(
  readProject: LabSpaceSpatialStateReader,
): LabSpaceSpatialActions {
  return {
    auditRoom: (input) => auditRoom(input, readProject),
    validateObjectMove: (input) => validateObjectMove(input, readProject),
    validateObjectResize: (input) => validateObjectResize(input, readProject),
    recommendObjectPlacements: (input) => recommendObjectPlacements(input, readProject),
  };
}

export const labSpaceSpatialActions = createLabSpaceSpatialActions(readCurrentProject);
