import { findBenchSupport, requiresBenchSupport } from "./geometry";
import type { Room, SceneObject } from "./schema";

/** One shared translation, never independent per-member snapping. */
export function translateSelection(
  room: Room,
  ids: readonly string[],
  delta: { x: number; y: number },
) {
  const locked = (object: SceneObject) =>
    object.locked || room.scene.layers.some((layer) => layer.id === object.layerId && layer.locked);
  const moving = new Set(
    room.scene.objects
      .filter((object) => ids.includes(object.id) && !locked(object))
      .map((object) => object.id),
  );
  for (const object of room.scene.objects) {
    if (!object.opening) continue;
    if (moving.has(object.opening.wallId)) {
      if (locked(object))
        return {
          error: "A hosted door or window is locked. Unlock it before moving its wall.",
          objects: [],
        };
      moving.add(object.id);
    } else if (moving.has(object.id)) {
      return {
        error: "Include the host wall when moving doors or windows as a group.",
        objects: [],
      };
    }
  }
  const objects = room.scene.objects.map((object) =>
    !moving.has(object.id)
      ? object
      : {
          ...object,
          position: {
            ...object.position,
            x: object.position.x + delta.x,
            y: object.position.y + delta.y,
          },
          ...(object.wall
            ? {
                wall: {
                  ...object.wall,
                  start: { x: object.wall.start.x + delta.x, y: object.wall.start.y + delta.y },
                  end: { x: object.wall.end.x + delta.x, y: object.wall.end.y + delta.y },
                },
              }
            : {}),
        },
  );
  const proposed = { ...room, scene: { ...room.scene, objects } };
  if (
    objects.some(
      (object) =>
        moving.has(object.id) &&
        requiresBenchSupport(object) &&
        !findBenchSupport(proposed, object),
    )
  )
    return {
      error: "Keep bench equipment on a supporting worktop. Include its bench in the selection.",
      objects: [],
    };
  return { error: null, objects };
}
