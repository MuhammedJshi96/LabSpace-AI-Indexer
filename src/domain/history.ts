import type { RoomPlanSize } from "./room-geometry";
import type { RoomSpace, Scene, SceneObject } from "./schema";

type RoomHistoryState = RoomPlanSize & { wallHeight?: number; spaces?: RoomSpace[] };

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
      roomBefore?: RoomHistoryState;
      roomAfter?: RoomHistoryState;
    }
  | {
      id: string;
      label: string;
      kind: "scene";
      roomId?: string;
      scope?: "storage";
      before: Scene;
      after: Scene;
      roomBefore?: RoomHistoryState;
      roomAfter?: RoomHistoryState;
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

/** Storage history changes locations/links only, never rolls back later stock edits or geometry. */
function applyStorageDelta(scene: Scene, before: Scene, after: Scene): Scene {
  const now = new Date().toISOString();
  const removed = new Set(
    before.storageLocations
      .filter((entry) => !after.storageLocations.some((value) => value.id === entry.id))
      .map((entry) => entry.id),
  );
  const locations = scene.storageLocations
    .filter((entry) => !removed.has(entry.id))
    .map((entry) => {
      const previous = before.storageLocations.find((value) => value.id === entry.id);
      const next = after.storageLocations.find((value) => value.id === entry.id);
      if (!previous || !next || JSON.stringify(previous) === JSON.stringify(next)) return entry;
      const changes = Object.fromEntries(
        Object.keys({ ...previous, ...next })
          .filter(
            (key) =>
              key !== "updatedAt" &&
              JSON.stringify(previous[key as keyof typeof previous]) !==
                JSON.stringify(next[key as keyof typeof next]),
          )
          .map((key) => [key, next[key as keyof typeof next]]),
      );
      return { ...entry, ...changes, updatedAt: next.updatedAt };
    });
  for (const entry of after.storageLocations) {
    if (
      !before.storageLocations.some((value) => value.id === entry.id) &&
      !locations.some((value) => value.id === entry.id)
    )
      locations.push(entry);
  }
  return {
    ...scene,
    storageLocations: locations,
    objects: scene.objects.map((object) => {
      const previous = before.objects.find((value) => value.id === object.id);
      const next = after.objects.find((value) => value.id === object.id);
      return previous &&
        next &&
        JSON.stringify(previous.childLocationIds) !== JSON.stringify(next.childLocationIds)
        ? { ...object, childLocationIds: next.childLocationIds, updatedAt: next.updatedAt }
        : object;
    }),
    inventoryItems: scene.inventoryItems.map((item) => {
      if (item.storageLocationId && removed.has(item.storageLocationId))
        return { ...item, storageLocationId: null, updatedAt: now };
      const previous = before.inventoryItems.find((value) => value.id === item.id);
      const next = after.inventoryItems.find((value) => value.id === item.id);
      return previous && next && previous.storageLocationId !== next.storageLocationId
        ? { ...item, storageLocationId: next.storageLocationId, updatedAt: now }
        : item;
    }),
    updatedAt: now,
  };
}

export function applyCommand(scene: Scene, command: SceneCommand): Scene {
  if (command.kind === "scene" && command.scope === "storage")
    return applyStorageDelta(scene, command.before, command.after);
  if (command.kind === "scene") return { ...command.after, updatedAt: new Date().toISOString() };
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
  if (command.kind === "scene" && command.scope === "storage")
    return applyStorageDelta(scene, command.after, command.before);
  if (command.kind === "scene") return { ...command.before, updatedAt: new Date().toISOString() };
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
