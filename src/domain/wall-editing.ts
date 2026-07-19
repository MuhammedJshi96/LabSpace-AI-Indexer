import { hostOpeningAtPoint, resolveHostedOpening } from "./wall-openings";
import type { SceneObject } from "./schema";

export type WallEndpoint = "start" | "end";
export type PlanDelta = { x: number; y: number };

export const MIN_WALL_LENGTH_MM = 100;
export const WALL_CONNECTION_TOLERANCE_MM = 35;

function pointsAreConnected(
  first: { x: number; y: number },
  second: { x: number; y: number },
  tolerance: number,
) {
  return Math.hypot(first.x - second.x, first.y - second.y) <= tolerance;
}

function deriveWallObject(
  object: SceneObject,
  start: { x: number; y: number },
  end: { x: number; y: number },
): SceneObject {
  if (!object.wall) return object;
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  return {
    ...object,
    position: {
      ...object.position,
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    },
    dimensions: {
      ...object.dimensions,
      width: length,
      depth: object.wall.thickness,
      height: object.wall.height,
    },
    rotation: {
      ...object.rotation,
      z: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI,
    },
    wall: { ...object.wall, start, end },
    updatedAt: new Date().toISOString(),
  };
}

function requiredWallLength(objects: SceneObject[], wallId: string) {
  return Math.max(
    MIN_WALL_LENGTH_MM,
    ...objects
      .filter((object) => object.opening?.wallId === wallId)
      .map((object) => object.opening?.width ?? object.dimensions.width),
  );
}

function finishWallEdit(
  source: SceneObject[],
  wallUpdates: Map<string, { start: { x: number; y: number }; end: { x: number; y: number } }>,
) {
  for (const [wallId, geometry] of wallUpdates) {
    const length = Math.hypot(geometry.end.x - geometry.start.x, geometry.end.y - geometry.start.y);
    if (length < requiredWallLength(source, wallId)) return source;
  }

  let next = source.map((object) => {
    const geometry = wallUpdates.get(object.id);
    return geometry ? deriveWallObject(object, geometry.start, geometry.end) : object;
  });

  const affectedWallIds = new Set(wallUpdates.keys());
  next = next.map((object) => {
    if (!object.opening || !affectedWallIds.has(object.opening.wallId)) return object;
    const resolved = resolveHostedOpening(object, next);
    if (!resolved) return object;
    return {
      ...object,
      ...hostOpeningAtPoint(object, resolved),
      updatedAt: new Date().toISOString(),
    };
  });

  return next;
}

/**
 * Moves one wall endpoint and carries every coincident neighbouring endpoint
 * with it. This keeps ordinary closed-room corners joined while still allowing
 * a wall to be reshaped directly.
 */
export function editWallEndpoint(
  objects: SceneObject[],
  wallId: string,
  endpoint: WallEndpoint,
  nextPoint: { x: number; y: number },
  connectionTolerance = WALL_CONNECTION_TOLERANCE_MM,
) {
  const target = objects.find((object) => object.id === wallId && object.wall);
  if (!target?.wall) return objects;

  const previousPoint = target.wall[endpoint];
  const wallUpdates = new Map<
    string,
    { start: { x: number; y: number }; end: { x: number; y: number } }
  >();
  wallUpdates.set(target.id, {
    start: endpoint === "start" ? nextPoint : target.wall.start,
    end: endpoint === "end" ? nextPoint : target.wall.end,
  });

  for (const object of objects) {
    if (object.id === target.id || !object.wall) continue;
    const startConnected = pointsAreConnected(
      object.wall.start,
      previousPoint,
      connectionTolerance,
    );
    const endConnected = pointsAreConnected(object.wall.end, previousPoint, connectionTolerance);
    if (!startConnected && !endConnected) continue;
    wallUpdates.set(object.id, {
      start: startConnected ? nextPoint : object.wall.start,
      end: endConnected ? nextPoint : object.wall.end,
    });
  }

  return finishWallEdit(objects, wallUpdates);
}

/**
 * Translates a whole wall. Endpoints of walls joined to either end are carried
 * along, which makes dragging one side of a rectangular room resize it without
 * opening gaps at the corners.
 */
export function translateWall(
  objects: SceneObject[],
  wallId: string,
  delta: PlanDelta,
  connectionTolerance = WALL_CONNECTION_TOLERANCE_MM,
) {
  const target = objects.find((object) => object.id === wallId && object.wall);
  if (!target?.wall || (!delta.x && !delta.y)) return objects;

  const translatedStart = {
    x: target.wall.start.x + delta.x,
    y: target.wall.start.y + delta.y,
  };
  const translatedEnd = {
    x: target.wall.end.x + delta.x,
    y: target.wall.end.y + delta.y,
  };
  const wallUpdates = new Map<
    string,
    { start: { x: number; y: number }; end: { x: number; y: number } }
  >();
  wallUpdates.set(target.id, { start: translatedStart, end: translatedEnd });

  for (const object of objects) {
    if (object.id === target.id || !object.wall) continue;
    const startAtTargetStart = pointsAreConnected(
      object.wall.start,
      target.wall.start,
      connectionTolerance,
    );
    const startAtTargetEnd = pointsAreConnected(
      object.wall.start,
      target.wall.end,
      connectionTolerance,
    );
    const endAtTargetStart = pointsAreConnected(
      object.wall.end,
      target.wall.start,
      connectionTolerance,
    );
    const endAtTargetEnd = pointsAreConnected(
      object.wall.end,
      target.wall.end,
      connectionTolerance,
    );
    if (!startAtTargetStart && !startAtTargetEnd && !endAtTargetStart && !endAtTargetEnd) continue;
    wallUpdates.set(object.id, {
      start:
        startAtTargetStart || startAtTargetEnd
          ? {
              x: object.wall.start.x + delta.x,
              y: object.wall.start.y + delta.y,
            }
          : object.wall.start,
      end:
        endAtTargetStart || endAtTargetEnd
          ? {
              x: object.wall.end.x + delta.x,
              y: object.wall.end.y + delta.y,
            }
          : object.wall.end,
    });
  }

  return finishWallEdit(objects, wallUpdates);
}
