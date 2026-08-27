import { validatePlacement, type ValidationWarning } from "../domain/geometry";
import type { Project, Room, SceneObject } from "../domain/schema";
import { useEditorStore } from "../store/editor-store";
import type {
  LabSpaceSpatialActions,
  PlacementConflict,
  ValidateObjectMoveInput,
  ValidateObjectMoveResult,
} from "./labspace-action-types";
import { LabSpaceActionError } from "./labspace-read-actions";

const MAX_OBJECT_ID_LENGTH = 200;
const MAX_COORDINATE_MM = 100_000;
const MAX_CONFLICTS = 8;
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
      xMm: requireFiniteNumber(
        target.xMm,
        "Target xMm",
        -MAX_COORDINATE_MM,
        MAX_COORDINATE_MM,
      ),
      yMm: requireFiniteNumber(
        target.yMm,
        "Target yMm",
        -MAX_COORDINATE_MM,
        MAX_COORDINATE_MM,
      ),
    },
    ...(record.rotationDeg === undefined
      ? {}
      : { rotationDeg: requireFiniteNumber(record.rotationDeg, "Rotation", -360, 360) }),
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

function placementConflicts(
  room: Room,
  candidate: SceneObject,
): PlacementConflict[] {
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
  return { validateObjectMove: (input) => validateObjectMove(input, readProject) };
}

export const labSpaceSpatialActions = createLabSpaceSpatialActions(readCurrentProject);
