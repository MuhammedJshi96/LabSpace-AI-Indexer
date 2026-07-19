import type { RoomPlanSize } from "./room-geometry";
import type { Scene, SceneObject } from "./schema";

export type SceneCommand =
  | { id: string; label: string; kind: "add"; after: SceneObject }
  | { id: string; label: string; kind: "delete"; before: SceneObject }
  | {
      id: string;
      label: string;
      kind: "update";
      objectId: string;
      before: SceneObject;
      after: SceneObject;
    }
  | {
      id: string;
      label: string;
      kind: "batch";
      before: SceneObject[];
      after: SceneObject[];
      roomBefore?: RoomPlanSize;
      roomAfter?: RoomPlanSize;
    };

function replaceObject(scene: Scene, object: SceneObject): Scene {
  return {
    ...scene,
    objects: scene.objects.map((entry) => (entry.id === object.id ? object : entry)),
    updatedAt: new Date().toISOString(),
  };
}

function replaceAffectedObjects(
  objects: SceneObject[],
  before: SceneObject[],
  after: SceneObject[],
) {
  const affectedIds = new Set([...before, ...after].map((object) => object.id));
  const desiredById = new Map(after.map((object) => [object.id, object]));
  const emitted = new Set<string>();
  const nextObjects = objects.flatMap((object) => {
    if (!affectedIds.has(object.id)) return [object];
    const desired = desiredById.get(object.id);
    if (!desired) return [];
    emitted.add(desired.id);
    return [desired];
  });
  for (const object of after) {
    if (!emitted.has(object.id)) nextObjects.push(object);
  }
  return nextObjects;
}

export function applyCommand(scene: Scene, command: SceneCommand): Scene {
  if (command.kind === "add")
    return {
      ...scene,
      objects: [...scene.objects, command.after],
      updatedAt: new Date().toISOString(),
    };
  if (command.kind === "delete")
    return {
      ...scene,
      objects: scene.objects.filter((object) => object.id !== command.before.id),
      updatedAt: new Date().toISOString(),
    };
  if (command.kind === "update") return replaceObject(scene, command.after);
  return {
    ...scene,
    objects: replaceAffectedObjects(scene.objects, command.before, command.after),
    updatedAt: new Date().toISOString(),
  };
}

export function revertCommand(scene: Scene, command: SceneCommand): Scene {
  if (command.kind === "add")
    return {
      ...scene,
      objects: scene.objects.filter((object) => object.id !== command.after.id),
      updatedAt: new Date().toISOString(),
    };
  if (command.kind === "delete")
    return {
      ...scene,
      objects: [...scene.objects, command.before],
      updatedAt: new Date().toISOString(),
    };
  if (command.kind === "update") return replaceObject(scene, command.before);
  return {
    ...scene,
    objects: replaceAffectedObjects(scene.objects, command.after, command.before),
    updatedAt: new Date().toISOString(),
  };
}
