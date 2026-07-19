import { wallAngle, wallLength } from "./geometry";
import type { SceneObject } from "./schema";

export type PlanPoint = { x: number; y: number };

export type WallProjection = {
  wall: SceneObject;
  point: PlanPoint;
  offset: number;
  distance: number;
  rotation: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Projects a plan point onto the usable centreline of a wall. The returned
 * offset is measured from the wall's start point and is clamped so the whole
 * opening remains inside the segment.
 */
export function projectPointToWall(
  wall: SceneObject,
  target: PlanPoint,
  openingWidth = 0,
): WallProjection | null {
  if (!wall.wall) return null;
  const dx = wall.wall.end.x - wall.wall.start.x;
  const dy = wall.wall.end.y - wall.wall.start.y;
  const length = wallLength(wall);
  if (!Number.isFinite(length) || length <= 0) return null;
  if (openingWidth > length) return null;

  const unitX = dx / length;
  const unitY = dy / length;
  const projectedOffset =
    (target.x - wall.wall.start.x) * unitX + (target.y - wall.wall.start.y) * unitY;
  const inset = Math.min(Math.max(0, openingWidth) / 2, length / 2);
  const offset = clamp(projectedOffset, inset, length - inset);
  const point = {
    x: wall.wall.start.x + unitX * offset,
    y: wall.wall.start.y + unitY * offset,
  };

  return {
    wall,
    point,
    offset,
    distance: Math.hypot(target.x - point.x, target.y - point.y),
    rotation: wallAngle(wall),
  };
}

export function findNearestWallProjection(
  objects: SceneObject[],
  target: PlanPoint,
  openingWidth = 0,
  maximumDistance = Number.POSITIVE_INFINITY,
): WallProjection | null {
  let nearest: WallProjection | null = null;
  for (const wall of objects) {
    if (!wall.wall || !wall.visible) continue;
    const projection = projectPointToWall(wall, target, openingWidth);
    if (projection && (!nearest || projection.distance < nearest.distance)) nearest = projection;
  }
  return nearest && nearest.distance <= maximumDistance ? nearest : null;
}

export function openingOverlapsSibling(
  objects: SceneObject[],
  wallId: string,
  offset: number,
  width: number,
  excludeId?: string,
  gap = 50,
) {
  return objects.some((object) => {
    if (
      object.id === excludeId ||
      object.opening?.wallId !== wallId ||
      !["door", "window"].includes(object.objectType)
    )
      return false;
    const siblingWidth = object.opening.width || object.dimensions.width;
    return Math.abs(object.opening.offset - offset) < (siblingWidth + width) / 2 + gap;
  });
}

export function resolveHostedOpening(
  object: SceneObject,
  objects: SceneObject[],
): WallProjection | null {
  if (!object.opening) return null;
  const wall = objects.find((entry) => entry.id === object.opening?.wallId && entry.wall);
  if (!wall?.wall) return null;

  const dx = wall.wall.end.x - wall.wall.start.x;
  const dy = wall.wall.end.y - wall.wall.start.y;
  const length = wallLength(wall);
  if (!Number.isFinite(length) || length <= 0) return null;
  const inset = Math.min(object.dimensions.width / 2, length / 2);
  const offset = clamp(object.opening.offset, inset, length - inset);
  const unitX = dx / length;
  const unitY = dy / length;
  const point = {
    x: wall.wall.start.x + unitX * offset,
    y: wall.wall.start.y + unitY * offset,
  };

  return {
    wall,
    point,
    offset,
    distance: 0,
    rotation: wallAngle(wall),
  };
}

export function hostOpeningAtPoint(
  object: SceneObject,
  projection: WallProjection,
): Pick<SceneObject, "position" | "rotation" | "opening"> {
  const defaultSillHeight =
    object.assetDefinitionId === "pass-through-window"
      ? 1100
      : object.assetDefinitionId === "observation-window"
        ? 1000
        : object.objectType === "window"
          ? 900
          : 0;
  const sillHeight = object.opening?.sillHeight ?? defaultSillHeight;
  return {
    position: {
      ...object.position,
      x: projection.point.x,
      y: projection.point.y,
      z: sillHeight,
    },
    rotation: { ...object.rotation, z: projection.rotation },
    opening: {
      wallId: projection.wall.id,
      offset: projection.offset,
      width: object.dimensions.width,
      sillHeight,
      height: object.dimensions.height,
      handing: object.opening?.handing ?? "left",
      swing:
        object.opening?.swing ??
        (object.assetDefinitionId.includes("sliding-door") ? "sliding" : "inward"),
    },
  };
}
