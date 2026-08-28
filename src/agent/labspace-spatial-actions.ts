import { objectBounds, validatePlacement, type ValidationWarning } from "../domain/geometry";
import { getClosedWallFloorPolygon } from "../domain/room-geometry";
import type { Project, Room, SceneObject } from "../domain/schema";
import { useEditorStore } from "../store/editor-store";
import type {
  LabSpaceSpatialActions,
  PlacementConflict,
  RecommendObjectPlacementsInput,
  RecommendObjectPlacementsResult,
  RecommendedPlacement,
  ValidateObjectMoveInput,
  ValidateObjectMoveResult,
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

export type LabSpaceSpatialStateReader = () => Project;

function readCurrentProject() {
  return useEditorStore.getState().project;
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
    (key) => !["objectId", "preferredTarget", "rotationsDeg", "limit"].includes(key),
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

function warningType(warning: ValidationWarning): PlacementConflict["type"] | null {
  if (warning.id.startsWith("outside-")) return "outside-room-boundary";
  if (warning.id.startsWith("overlap-")) return "object-collision";
  if (warning.id.startsWith("below-floor-")) return "below-floor";
  if (warning.id.startsWith("above-ceiling-")) return "above-room-height";
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

function candidateObjectGap(room: Room, candidate: SceneObject) {
  const candidateBounds = objectBounds(candidate);
  let minimum = Number.POSITIVE_INFINITY;
  for (const other of room.scene.objects) {
    if (
      other.id === candidate.id ||
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

  const preferred = normalized.preferredTarget ?? {
    xMm: object.position.x,
    yMm: object.position.y,
  };
  const rotations = normalized.rotationsDeg ?? [
    normalizeRotation(object.rotation.z),
    normalizeRotation(object.rotation.z + 90),
  ];
  const limit = normalized.limit ?? 3;
  const positions = recommendationPositions(room, preferred);
  const evaluated: Array<RecommendedPlacement & { score: number }> = [];
  let evaluatedTargets = 0;

  outer: for (const position of positions) {
    for (const rotationDeg of rotations) {
      if (evaluatedTargets >= MAX_RECOMMENDATION_EVALUATIONS) break outer;
      const distanceFromCurrent = Math.hypot(
        position.xMm - object.position.x,
        position.yMm - object.position.y,
      );
      if (distanceFromCurrent < 200) continue;
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
        position: { ...object.position, x: position.xMm, y: position.yMm },
        rotation: { ...object.rotation, z: rotationDeg },
      };
      const distanceFromPreferredMm = Math.round(
        Math.hypot(position.xMm - preferred.xMm, position.yMm - preferred.yMm),
      );
      const nearestObjectGapMm = candidateObjectGap(room, candidate);
      const rotationPenalty = rotationDeg === normalizeRotation(object.rotation.z) ? 0 : 200;
      const clearanceCredit = Math.min(nearestObjectGapMm ?? 1_000, 1_000) * 0.2;
      evaluated.push({
        rank: 0,
        target: { ...position, rotationDeg },
        distanceFromPreferredMm,
        nearestObjectGapMm,
        rationale: [
          "Passes current room-boundary, overlap, elevation, and room-height rules.",
          distanceFromPreferredMm === 0
            ? "Matches the preferred target."
            : `${distanceFromPreferredMm} mm from the preferred target.`,
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
    evaluatedTargets,
    candidates,
    basis: [
      "Candidates reuse LabSpace's deterministic room-boundary, overlap, elevation, and room-height rules.",
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

  const candidate: SceneObject = {
    ...object,
    position: { ...object.position, x: target.xMm, y: target.yMm },
    rotation: { ...object.rotation, z: target.rotationDeg },
  };
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

export function createLabSpaceSpatialActions(
  readProject: LabSpaceSpatialStateReader,
): LabSpaceSpatialActions {
  return {
    validateObjectMove: (input) => validateObjectMove(input, readProject),
    recommendObjectPlacements: (input) => recommendObjectPlacements(input, readProject),
  };
}

export const labSpaceSpatialActions = createLabSpaceSpatialActions(readCurrentProject);
