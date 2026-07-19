import type { Room, SceneObject } from "./schema";

export type PlanPoint = { x: number; y: number };
export type RoomPlanSize = { width: number; depth: number };

export type RoomPlanBounds = RoomPlanSize & {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type ClosedWallFloorPolygon = {
  points: PlanPoint[];
  bounds: RoomPlanBounds;
  areaMm2: number;
  perimeterMm: number;
  wallIds: string[];
};

export type RoomFloorPlan = ClosedWallFloorPolygon & {
  source: "closed-walls" | "rectangular-fallback";
};

export type RectangularPerimeterBounds = RoomPlanBounds & {
  wallIds: string[];
};

export type SynchronizedRectangularRoom = RoomPlanSize & {
  objects: SceneObject[];
};

export type SynchronizedClosedRoom = SynchronizedRectangularRoom & {
  floorPolygon: ClosedWallFloorPolygon;
};

// Match the editor's endpoint snapping tolerance so a wall outline that reads
// as closed on the plan is also topologically closed for floor generation.
const DEFAULT_TOLERANCE_MM = 80;
const MIN_ROOM_SPAN_MM = 100;
const MIN_ROOM_AREA_MM2 = MIN_ROOM_SPAN_MM * MIN_ROOM_SPAN_MM;

function nearlyEqual(first: number, second: number, tolerance: number) {
  return Math.abs(first - second) <= tolerance;
}

function pointDistance(first: PlanPoint, second: PlanPoint) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function polygonSignedArea(points: PlanPoint[]) {
  let twiceArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const next = points[(index + 1) % points.length];
    twiceArea += point.x * next.y - next.x * point.y;
  }
  return twiceArea / 2;
}

function polygonBounds(points: PlanPoint[]): RoomPlanBounds {
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  return { minX, minY, maxX, maxY, width: maxX - minX, depth: maxY - minY };
}

function cross(first: PlanPoint, second: PlanPoint, third: PlanPoint) {
  return (second.x - first.x) * (third.y - first.y) - (second.y - first.y) * (third.x - first.x);
}

function pointOnSegment(
  point: PlanPoint,
  start: PlanPoint,
  end: PlanPoint,
  tolerance = DEFAULT_TOLERANCE_MM,
) {
  if (Math.abs(cross(start, end, point)) > tolerance) return false;
  return (
    point.x >= Math.min(start.x, end.x) - tolerance &&
    point.x <= Math.max(start.x, end.x) + tolerance &&
    point.y >= Math.min(start.y, end.y) - tolerance &&
    point.y <= Math.max(start.y, end.y) + tolerance
  );
}

function segmentsIntersect(
  firstStart: PlanPoint,
  firstEnd: PlanPoint,
  secondStart: PlanPoint,
  secondEnd: PlanPoint,
  tolerance: number,
) {
  const firstSideA = cross(firstStart, firstEnd, secondStart);
  const firstSideB = cross(firstStart, firstEnd, secondEnd);
  const secondSideA = cross(secondStart, secondEnd, firstStart);
  const secondSideB = cross(secondStart, secondEnd, firstEnd);
  const oppositeFirstSides =
    (firstSideA > tolerance && firstSideB < -tolerance) ||
    (firstSideA < -tolerance && firstSideB > tolerance);
  const oppositeSecondSides =
    (secondSideA > tolerance && secondSideB < -tolerance) ||
    (secondSideA < -tolerance && secondSideB > tolerance);
  if (oppositeFirstSides && oppositeSecondSides) return true;
  return (
    (Math.abs(firstSideA) <= tolerance &&
      pointOnSegment(secondStart, firstStart, firstEnd, tolerance)) ||
    (Math.abs(firstSideB) <= tolerance &&
      pointOnSegment(secondEnd, firstStart, firstEnd, tolerance)) ||
    (Math.abs(secondSideA) <= tolerance &&
      pointOnSegment(firstStart, secondStart, secondEnd, tolerance)) ||
    (Math.abs(secondSideB) <= tolerance &&
      pointOnSegment(firstEnd, secondStart, secondEnd, tolerance))
  );
}

function polygonIsSimple(points: PlanPoint[], tolerance: number) {
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (Math.abs(cross(previous, current, next)) > tolerance) continue;
    const incomingFromVertex = { x: previous.x - current.x, y: previous.y - current.y };
    const outgoingFromVertex = { x: next.x - current.x, y: next.y - current.y };
    const dot =
      incomingFromVertex.x * outgoingFromVertex.x + incomingFromVertex.y * outgoingFromVertex.y;
    // Straight continuation has opposing vectors. A positive dot product means
    // adjacent walls fold back over the same span and do not define a simple edge.
    if (dot > tolerance) return false;
  }
  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length;
    for (let second = first + 1; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length;
      const adjacent =
        first === second ||
        firstNext === second ||
        secondNext === first ||
        (first === 0 && secondNext === 0);
      if (adjacent) continue;
      if (
        segmentsIntersect(
          points[first],
          points[firstNext],
          points[second],
          points[secondNext],
          tolerance,
        )
      ) {
        return false;
      }
    }
  }
  return true;
}

type WallGraphEdge = { id: string; start: number; end: number };

function getOuterWallBoundary(
  walls: SceneObject[],
  tolerance: number,
): { points: PlanPoint[]; wallIds: string[] } | null {
  const nodes: PlanPoint[] = [];
  const nodeForPoint = (point: PlanPoint) => {
    const existing = nodes.findIndex((node) => pointDistance(node, point) <= tolerance);
    if (existing >= 0) return existing;
    nodes.push({ ...point });
    return nodes.length - 1;
  };
  const edges: WallGraphEdge[] = walls.map((object) => ({
    id: object.id,
    start: nodeForPoint(object.wall!.start),
    end: nodeForPoint(object.wall!.end),
  }));
  if (edges.some((edge) => edge.start === edge.end)) return null;

  // Remove dangling partition branches. Chords that genuinely divide a room
  // remain in the graph, but they do not replace the outer face.
  const activeEdges = new Set(edges.map((_, index) => index));
  let pruned = true;
  while (pruned) {
    pruned = false;
    const degree = nodes.map(() => 0);
    for (const edgeIndex of activeEdges) {
      degree[edges[edgeIndex].start] += 1;
      degree[edges[edgeIndex].end] += 1;
    }
    for (const edgeIndex of [...activeEdges]) {
      const edge = edges[edgeIndex];
      if (degree[edge.start] < 2 || degree[edge.end] < 2) {
        activeEdges.delete(edgeIndex);
        pruned = true;
      }
    }
  }
  if (activeEdges.size < 3) return null;

  const adjacency = nodes.map(
    () => [] as Array<{ nodeId: number; edgeIndex: number; angle: number }>,
  );
  for (const edgeIndex of activeEdges) {
    const edge = edges[edgeIndex];
    const add = (from: number, to: number) =>
      adjacency[from].push({
        nodeId: to,
        edgeIndex,
        // Convert plan-down Y to mathematical-up Y for stable angular order.
        angle: Math.atan2(-(nodes[to].y - nodes[from].y), nodes[to].x - nodes[from].x),
      });
    add(edge.start, edge.end);
    add(edge.end, edge.start);
  }
  adjacency.forEach((neighbors) => neighbors.sort((first, second) => first.angle - second.angle));

  const visitedHalfEdges = new Set<string>();
  const candidates: Array<{ points: PlanPoint[]; wallIds: string[]; area: number }> = [];
  const keyFor = (from: number, to: number, edgeIndex: number) => `${from}:${to}:${edgeIndex}`;

  for (const startEdgeIndex of activeEdges) {
    const startEdge = edges[startEdgeIndex];
    for (const [startFrom, startTo] of [
      [startEdge.start, startEdge.end],
      [startEdge.end, startEdge.start],
    ] as const) {
      const startKey = keyFor(startFrom, startTo, startEdgeIndex);
      if (visitedHalfEdges.has(startKey)) continue;
      const nodeIds = [startFrom];
      const edgeIds: number[] = [];
      let from = startFrom;
      let to = startTo;
      let edgeIndex = startEdgeIndex;
      let closed = false;

      for (let step = 0; step <= activeEdges.size * 2 + 2; step += 1) {
        const key = keyFor(from, to, edgeIndex);
        if (step > 0 && key === startKey) {
          closed = true;
          break;
        }
        if (visitedHalfEdges.has(key)) break;
        visitedHalfEdges.add(key);
        nodeIds.push(to);
        edgeIds.push(edgeIndex);

        const neighbors = adjacency[to];
        const reverseIndex = neighbors.findIndex(
          (neighbor) => neighbor.nodeId === from && neighbor.edgeIndex === edgeIndex,
        );
        if (reverseIndex < 0 || neighbors.length < 2) break;
        // The neighbor immediately clockwise from the reverse half-edge traces
        // one planar face. Walking every half-edge yields the outer face and
        // any split-room faces; the largest simple face is the floor boundary.
        const next = neighbors[(reverseIndex - 1 + neighbors.length) % neighbors.length];
        from = to;
        to = next.nodeId;
        edgeIndex = next.edgeIndex;
      }

      if (!closed) continue;
      if (nodeIds.at(-1) === nodeIds[0]) nodeIds.pop();
      const points = nodeIds.map((nodeId) => nodes[nodeId]);
      if (points.length < 3 || !polygonIsSimple(points, tolerance)) continue;
      const area = Math.abs(polygonSignedArea(points));
      if (area < MIN_ROOM_AREA_MM2) continue;
      candidates.push({
        points,
        wallIds: [...new Set(edgeIds.map((id) => edges[id].id))],
        area,
      });
    }
  }

  const outer = candidates.sort((first, second) => second.area - first.area)[0];
  return outer ? { points: outer.points, wallIds: outer.wallIds } : null;
}

/**
 * Derives the outer floor boundary while allowing interior partition walls,
 * shared split-room walls, and harmless dangling divider branches.
 */
export function getClosedWallFloorPolygon(
  objects: SceneObject[],
  tolerance = DEFAULT_TOLERANCE_MM,
): ClosedWallFloorPolygon | null {
  const walls = objects.filter((object) => object.wall);
  if (walls.length < 3) return null;
  const boundary = getOuterWallBoundary(walls, tolerance);
  if (!boundary) return null;
  let points = boundary.points;
  const signedArea = polygonSignedArea(points);
  const areaMm2 = Math.abs(signedArea);
  const bounds = polygonBounds(points);
  if (
    areaMm2 < MIN_ROOM_AREA_MM2 ||
    bounds.width < MIN_ROOM_SPAN_MM ||
    bounds.depth < MIN_ROOM_SPAN_MM
  ) {
    return null;
  }
  if (signedArea < 0) points = [...points].reverse();
  const perimeterMm = points.reduce(
    (sum, point, index) => sum + pointDistance(point, points[(index + 1) % points.length]),
    0,
  );
  return {
    points,
    bounds,
    areaMm2,
    perimeterMm,
    wallIds: boundary.wallIds.sort(),
  };
}

/** A closed wall loop is authoritative; other layouts retain the room rectangle. */
export function getRoomFloorPlan(room: Pick<Room, "width" | "depth" | "scene">): RoomFloorPlan {
  const polygon = getClosedWallFloorPolygon(room.scene.objects);
  if (polygon) return { ...polygon, source: "closed-walls" };
  const points = [
    { x: 0, y: 0 },
    { x: room.width, y: 0 },
    { x: room.width, y: room.depth },
    { x: 0, y: room.depth },
  ];
  return {
    source: "rectangular-fallback",
    points,
    bounds: {
      minX: 0,
      minY: 0,
      maxX: room.width,
      maxY: room.depth,
      width: room.width,
      depth: room.depth,
    },
    areaMm2: room.width * room.depth,
    perimeterMm: room.width * 2 + room.depth * 2,
    wallIds: [],
  };
}

export function pointIsInsideFloorPolygon(
  point: PlanPoint,
  polygon: Pick<ClosedWallFloorPolygon, "points">,
  tolerance = DEFAULT_TOLERANCE_MM,
) {
  const points = polygon.points;
  for (let index = 0; index < points.length; index += 1) {
    if (pointOnSegment(point, points[index], points[(index + 1) % points.length], tolerance)) {
      return true;
    }
  }
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const currentPoint = points[index];
    const previousPoint = points[previous];
    if (
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Strict compatibility helper for callers that specifically require a rectangle. */
export function getRectangularPerimeterBounds(
  objects: SceneObject[],
  tolerance = DEFAULT_TOLERANCE_MM,
): RectangularPerimeterBounds | null {
  const polygon = getClosedWallFloorPolygon(objects, tolerance);
  if (!polygon || polygon.points.length !== 4) return null;
  const axisAligned = polygon.points.every((point, index) => {
    const next = polygon.points[(index + 1) % polygon.points.length];
    return nearlyEqual(point.x, next.x, tolerance) || nearlyEqual(point.y, next.y, tolerance);
  });
  if (
    !axisAligned ||
    !nearlyEqual(polygon.areaMm2, polygon.bounds.width * polygon.bounds.depth, 1)
  ) {
    return null;
  }
  return { ...polygon.bounds, wallIds: polygon.wallIds };
}

function translateObjectToRoomOrigin(object: SceneObject, offsetX: number, offsetY: number) {
  if (nearlyEqual(offsetX, 0, Number.EPSILON) && nearlyEqual(offsetY, 0, Number.EPSILON)) {
    return object;
  }
  return {
    ...object,
    position: {
      ...object.position,
      x: object.position.x - offsetX,
      y: object.position.y - offsetY,
    },
    wall: object.wall
      ? {
          ...object.wall,
          start: {
            x: object.wall.start.x - offsetX,
            y: object.wall.start.y - offsetY,
          },
          end: {
            x: object.wall.end.x - offsetX,
            y: object.wall.end.y - offsetY,
          },
        }
      : undefined,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Promotes a newly completed wall loop to the canonical room envelope. The
 * loop is normalized to (0,0), while every placed object moves by the same
 * offset so its relationship to the walls is preserved.
 */
export function normalizeClosedRoomFromWallLoop(
  objects: SceneObject[],
  tolerance = DEFAULT_TOLERANCE_MM,
): SynchronizedClosedRoom | null {
  const polygon = getClosedWallFloorPolygon(objects, tolerance);
  if (!polygon) return null;
  const normalizedObjects = objects.map((object) =>
    translateObjectToRoomOrigin(object, polygon.bounds.minX, polygon.bounds.minY),
  );
  const normalizedPolygon = getClosedWallFloorPolygon(normalizedObjects, tolerance);
  if (!normalizedPolygon) return null;
  return {
    width: normalizedPolygon.bounds.width,
    depth: normalizedPolygon.bounds.depth,
    objects: normalizedObjects,
    floorPolygon: normalizedPolygon,
  };
}

/** Repairs older saved rooms that closed visually before endpoint-priority snapping existed. */
export function normalizeRoomFloorEnvelope(
  room: Room,
  tolerance = DEFAULT_TOLERANCE_MM,
): Room {
  const normalized = normalizeClosedRoomFromWallLoop(room.scene.objects, tolerance);
  if (!normalized) return room;
  const objectsChanged = normalized.objects.some(
    (object, index) => object !== room.scene.objects[index],
  );
  const sizeChanged =
    !nearlyEqual(normalized.width, room.width, tolerance) ||
    !nearlyEqual(normalized.depth, room.depth, tolerance);
  if (!objectsChanged && !sizeChanged) return room;
  const now = new Date().toISOString();
  return {
    ...room,
    width: normalized.width,
    depth: normalized.depth,
    scene: { ...room.scene, objects: normalized.objects, updatedAt: now },
    updatedAt: now,
  };
}

/**
 * Synchronizes any valid simple closed wall perimeter after direct editing.
 * The loop's bounding box becomes room width/depth and all plan objects are
 * normalized to the schema's (0,0) origin as one history-ready result.
 */
export function synchronizeClosedRoomAfterWallEdit(
  beforeObjects: SceneObject[],
  afterObjects: SceneObject[],
  tolerance = DEFAULT_TOLERANCE_MM,
): SynchronizedClosedRoom | null {
  const beforePolygon = getClosedWallFloorPolygon(beforeObjects, tolerance);
  const afterPolygon = getClosedWallFloorPolygon(afterObjects, tolerance);
  if (!beforePolygon || !afterPolygon) return null;
  if (
    beforePolygon.wallIds.length !== afterPolygon.wallIds.length ||
    beforePolygon.wallIds.some((id, index) => id !== afterPolygon.wallIds[index])
  ) {
    return null;
  }
  return normalizeClosedRoomFromWallLoop(afterObjects, tolerance);
}

/** Retained for the strict first-phase rectangular API. */
export function synchronizeRectangularRoomAfterWallEdit(
  beforeObjects: SceneObject[],
  afterObjects: SceneObject[],
  currentSize: RoomPlanSize,
  tolerance = DEFAULT_TOLERANCE_MM,
): SynchronizedRectangularRoom | null {
  const beforeBounds = getRectangularPerimeterBounds(beforeObjects, tolerance);
  const afterBounds = getRectangularPerimeterBounds(afterObjects, tolerance);
  if (!beforeBounds || !afterBounds) return null;
  if (
    !nearlyEqual(beforeBounds.width, currentSize.width, tolerance) ||
    !nearlyEqual(beforeBounds.depth, currentSize.depth, tolerance)
  ) {
    return null;
  }
  const synchronized = synchronizeClosedRoomAfterWallEdit(beforeObjects, afterObjects, tolerance);
  return synchronized
    ? { width: synchronized.width, depth: synchronized.depth, objects: synchronized.objects }
    : null;
}
