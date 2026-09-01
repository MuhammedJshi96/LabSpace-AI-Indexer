import {
  getClosedWallFloorPolygon,
  getRoomSpaceFloorPlans,
  pointIsInsideFloorPolygon,
  type PlanPoint,
} from "./room-geometry";
import type { Room, RoomSpace, SceneObject } from "./schema";

const JOIN_TOLERANCE_MM = 120;
const MIN_ROOM_SPAN_MM = 1200;
const OPENING_JUNCTION_CLEARANCE_MM = 50;

export type WallFactoryOptions = {
  template?: SceneObject;
  name?: string;
  spaceId?: string;
};

export type WallFactory = (
  start: PlanPoint,
  end: PlanPoint,
  options?: WallFactoryOptions,
) => SceneObject;

export type BoundaryProjection = {
  wall: SceneObject;
  point: PlanPoint;
  offset: number;
  distance: number;
};

export type RoomBuildingChange = {
  room: Room;
  createdWallIds: string[];
  annexSpaceId: string | null;
};

function distance(first: PlanPoint, second: PlanPoint) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function primarySpace(room: Room) {
  return room.spaces.find((space) => space.kind === "primary") ?? room.spaces[0];
}

function primaryWallIds(room: Room) {
  const primary = primarySpace(room);
  return new Set(
    room.spaces.length === 1
      ? room.scene.objects
          .filter((object) => object.wall && !object.wall.halfHeight)
          .map((object) => object.id)
      : (primary?.wallIds ?? []),
  );
}

function projectToSegment(point: PlanPoint, wall: SceneObject): BoundaryProjection | null {
  if (!wall.wall || wall.wall.halfHeight) return null;
  const dx = wall.wall.end.x - wall.wall.start.x;
  const dy = wall.wall.end.y - wall.wall.start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return null;
  const ratio = Math.min(
    1,
    Math.max(
      0,
      ((point.x - wall.wall.start.x) * dx + (point.y - wall.wall.start.y) * dy) / lengthSquared,
    ),
  );
  const projected = {
    x: wall.wall.start.x + dx * ratio,
    y: wall.wall.start.y + dy * ratio,
  };
  return {
    wall,
    point: projected,
    offset: Math.sqrt(lengthSquared) * ratio,
    distance: distance(point, projected),
  };
}

export function projectPointToPrimaryBoundary(
  room: Room,
  point: PlanPoint,
  tolerance = JOIN_TOLERANCE_MM,
): BoundaryProjection | null {
  const wallIds = primaryWallIds(room);
  const nearest = room.scene.objects
    .filter((object) => wallIds.has(object.id))
    .flatMap((wall) => {
      const projection = projectToSegment(point, wall);
      return projection ? [projection] : [];
    })
    .sort((first, second) => first.distance - second.distance)[0];
  return nearest && nearest.distance <= tolerance ? nearest : null;
}

function wallLength(wall: SceneObject) {
  return wall.wall ? distance(wall.wall.start, wall.wall.end) : 0;
}

function pointAlong(wall: SceneObject, offset: number): PlanPoint {
  if (!wall.wall) return { x: wall.position.x, y: wall.position.y };
  const length = wallLength(wall) || 1;
  return {
    x: wall.wall.start.x + ((wall.wall.end.x - wall.wall.start.x) / length) * offset,
    y: wall.wall.start.y + ((wall.wall.end.y - wall.wall.start.y) / length) * offset,
  };
}

function translatedObject(object: SceneObject, x: number, y: number): SceneObject {
  if (!x && !y) return object;
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
    updatedAt: new Date().toISOString(),
  };
}

function normalizedEnvelope(room: Room, moveMinimumToOrigin = false) {
  const points = room.scene.objects.flatMap((object) =>
    object.wall ? [object.wall.start, object.wall.end] : [],
  );
  if (!points.length) return room;
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const shiftX = moveMinimumToOrigin ? -minX : minX < 0 ? -minX : 0;
  const shiftY = moveMinimumToOrigin ? -minY : minY < 0 ? -minY : 0;
  const objects = room.scene.objects.map((object) => translatedObject(object, shiftX, shiftY));
  const shiftedPoints = objects.flatMap((object) =>
    object.wall ? [object.wall.start, object.wall.end] : [],
  );
  return {
    ...room,
    width: Math.max(...shiftedPoints.map((point) => point.x)),
    depth: Math.max(...shiftedPoints.map((point) => point.y)),
    scene: { ...room.scene, objects, updatedAt: new Date().toISOString() },
    updatedAt: new Date().toISOString(),
  };
}

function hostedPoint(wall: SceneObject, offset: number) {
  const point = pointAlong(wall, offset);
  const rotation = wall.wall
    ? (Math.atan2(wall.wall.end.y - wall.wall.start.y, wall.wall.end.x - wall.wall.start.x) * 180) /
      Math.PI
    : wall.rotation.z;
  return { point, rotation };
}

function remapHostedOpening(
  object: SceneObject,
  original: SceneObject,
  prefix: SceneObject | null,
  shared: SceneObject,
  suffix: SceneObject | null,
  startOffset: number,
  endOffset: number,
) {
  if (!object.opening || object.opening.wallId !== original.id) return object;
  const halfWidth = object.opening.width / 2;
  const openingStart = object.opening.offset - halfWidth;
  const openingEnd = object.opening.offset + halfWidth;
  const crosses = [startOffset, endOffset].some(
    (junction) =>
      Math.abs(openingStart - junction) < OPENING_JUNCTION_CLEARANCE_MM ||
      Math.abs(openingEnd - junction) < OPENING_JUNCTION_CLEARANCE_MM ||
      (openingStart < junction && openingEnd > junction),
  );
  if (crosses) {
    throw new Error(
      `${object.name} crosses the new annex junction. Move the opening away from the connection first.`,
    );
  }
  let target = shared;
  let offset = object.opening.offset - startOffset;
  if (object.opening.offset < startOffset) {
    if (!prefix) throw new Error(`${object.name} could not be retained on the shortened wall.`);
    target = prefix;
    offset = object.opening.offset;
  } else if (object.opening.offset > endOffset) {
    if (!suffix) throw new Error(`${object.name} could not be retained on the shortened wall.`);
    target = suffix;
    offset = object.opening.offset - endOffset;
  }
  const hosted = hostedPoint(target, offset);
  return {
    ...object,
    position: { ...object.position, x: hosted.point.x, y: hosted.point.y },
    rotation: { ...object.rotation, z: hosted.rotation },
    opening: { ...object.opening, wallId: target.id, offset },
    updatedAt: new Date().toISOString(),
  };
}

function nextAnnexIdentity(room: Room) {
  const number = room.spaces.filter((space) => space.kind === "annex").length + 1;
  return { name: `Annex ${number}`, code: `${room.code}-A${number}` };
}

function samplesStayOutsidePrimary(points: PlanPoint[], primaryPoints: PlanPoint[]) {
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    for (const ratio of [0.25, 0.5, 0.75]) {
      const sample = {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
      if (pointIsInsideFloorPolygon(sample, { points: primaryPoints }, 10)) return false;
    }
  }
  return true;
}

/** Build a connected freeform annex. The path must begin and end on the same
 * primary exterior wall; the shared wall segment is reused rather than drawn
 * twice, keeping the resulting building watertight and independently zoned. */
export function buildConnectedAnnex(
  room: Room,
  path: PlanPoint[],
  createWall: WallFactory,
): RoomBuildingChange {
  if (path.length < 3) {
    throw new Error("An annex needs at least two exterior wall segments.");
  }
  const primary = primarySpace(room);
  if (!primary) throw new Error("This room has no primary space boundary.");
  const startProjection = projectPointToPrimaryBoundary(room, path[0]);
  const endProjection = projectPointToPrimaryBoundary(room, path[path.length - 1]);
  if (!startProjection || !endProjection || startProjection.wall.id !== endProjection.wall.id) {
    throw new Error("Begin and finish the annex on the same exterior wall of the main room.");
  }
  const host = startProjection.wall;
  const primaryIds = primaryWallIds(room);
  const primaryFloor = getClosedWallFloorPolygon(
    room.scene.objects.filter((object) => primaryIds.has(object.id)),
  );
  if (!primaryFloor) throw new Error("Close the main room outline before adding an annex.");

  const orderedPath = [
    startProjection.point,
    ...path.slice(1, -1).map((point) => ({ ...point })),
    endProjection.point,
  ];
  if (
    orderedPath.some((point, index) => index > 0 && distance(point, orderedPath[index - 1]) < 100)
  ) {
    throw new Error("Annex wall points are too close together.");
  }
  if (!samplesStayOutsidePrimary(orderedPath, primaryFloor.points)) {
    throw new Error("Draw the annex outside the main room; internal partitions remain room walls.");
  }

  const firstOffset = startProjection.offset;
  const secondOffset = endProjection.offset;
  const startOffset = Math.min(firstOffset, secondOffset);
  const endOffset = Math.max(firstOffset, secondOffset);
  if (endOffset - startOffset < MIN_ROOM_SPAN_MM) {
    throw new Error("The annex connection must be at least 1.2 m wide.");
  }
  const sharedStart = pointAlong(host, startOffset);
  const sharedEnd = pointAlong(host, endOffset);
  const annexSpaceId = `space-${crypto.randomUUID()}`;
  const identity = nextAnnexIdentity(room);

  const prefix =
    startOffset > 1
      ? createWall(host.wall!.start, sharedStart, {
          template: host,
          name: `${host.name} · main segment A`,
          spaceId: primary.id,
        })
      : null;
  const suffix =
    wallLength(host) - endOffset > 1
      ? createWall(sharedEnd, host.wall!.end, {
          template: host,
          name: `${host.name} · main segment B`,
          spaceId: primary.id,
        })
      : null;
  const generatedShared = createWall(sharedStart, sharedEnd, {
    template: host,
    name: `${host.name} · shared with ${identity.name}`,
    spaceId: primary.id,
  });
  const shared: SceneObject = {
    ...generatedShared,
    id: host.id,
    indexCode: host.indexCode,
    createdAt: host.createdAt,
  };

  const pathWalls = orderedPath.slice(0, -1).map((point, index) =>
    createWall(point, orderedPath[index + 1], {
      template: host,
      name: `${identity.name} wall ${index + 1}`,
      spaceId: annexSpaceId,
    }),
  );
  const testFloor = getClosedWallFloorPolygon([shared, ...pathWalls]);
  if (!testFloor) {
    throw new Error("The annex outline crosses itself or does not form a closed space.");
  }

  const objects = room.scene.objects
    .filter((object) => object.id !== host.id)
    .map((object) =>
      remapHostedOpening(object, host, prefix, shared, suffix, startOffset, endOffset),
    );
  if (prefix) objects.push(prefix);
  objects.push(shared);
  if (suffix) objects.push(suffix);
  objects.push(...pathWalls);

  const primaryWalls = new Set(primaryIds);
  if (prefix) primaryWalls.add(prefix.id);
  if (suffix) primaryWalls.add(suffix.id);
  primaryWalls.add(shared.id);
  const spaces = room.spaces.map((space) =>
    space.id === primary.id ? { ...space, wallIds: [...primaryWalls] } : structuredClone(space),
  );
  const annex: RoomSpace = {
    id: annexSpaceId,
    roomId: room.id,
    parentSpaceId: primary.id,
    kind: "annex",
    name: identity.name,
    code: identity.code,
    wallIds: [shared.id, ...pathWalls.map((wall) => wall.id)],
    floorFinish: room.floorFinish,
  };
  spaces.push(annex);

  const proposed = normalizedEnvelope(
    {
      ...room,
      spaces,
      scene: { ...room.scene, objects, updatedAt: new Date().toISOString() },
      updatedAt: new Date().toISOString(),
    },
    true,
  );
  const floors = getRoomSpaceFloorPlans(proposed);
  if (!floors.some((floor) => floor.spaceId === primary.id)) {
    throw new Error("The connection would break the main room boundary.");
  }
  if (!floors.some((floor) => floor.spaceId === annexSpaceId)) {
    throw new Error("The annex did not resolve to an independent closed floor.");
  }
  return {
    room: proposed,
    createdWallIds: [
      ...(prefix ? [prefix.id] : []),
      ...(suffix ? [suffix.id] : []),
      ...pathWalls.map((wall) => wall.id),
    ],
    annexSpaceId,
  };
}

function rectanglePoints(start: PlanPoint, end: PlanPoint) {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);
  if (right - left < MIN_ROOM_SPAN_MM || bottom - top < MIN_ROOM_SPAN_MM) {
    throw new Error("Room rectangles must be at least 1.2 m wide and deep.");
  }
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

/** A drag-created rectangle makes the first closed room, or becomes a new
 * annex when one complete rectangle edge lies on a main-room exterior wall. */
export function buildRoomRectangle(
  room: Room,
  start: PlanPoint,
  end: PlanPoint,
  createWall: WallFactory,
): RoomBuildingChange {
  const points = rectanglePoints(start, end);
  const primaryFloor = getClosedWallFloorPolygon(
    room.scene.objects.filter((object) => object.wall && !object.wall.halfHeight),
  );
  if (primaryFloor) {
    const sideCandidates = points.flatMap((point, index) => {
      const next = points[(index + 1) % points.length];
      const first = projectPointToPrimaryBoundary(room, point);
      const second = projectPointToPrimaryBoundary(room, next);
      return first && second && first.wall.id === second.wall.id
        ? [{ index, score: first.distance + second.distance }]
        : [];
    });
    const attached = sideCandidates.sort((first, second) => first.score - second.score)[0];
    if (!attached) {
      throw new Error("Connect one full rectangle edge to an exterior wall to create an annex.");
    }
    const index = attached.index;
    const path = [
      points[index],
      points[(index + 3) % 4],
      points[(index + 2) % 4],
      points[(index + 1) % 4],
    ];
    return buildConnectedAnnex(room, path, createWall);
  }

  const primary = primarySpace(room);
  if (!primary) throw new Error("This room has no primary space record.");
  const walls = points.map((point, index) =>
    createWall(point, points[(index + 1) % points.length], {
      name: `Room wall ${index + 1}`,
      spaceId: primary.id,
    }),
  );
  const objects = [...room.scene.objects, ...walls];
  const spaces = room.spaces.map((space) =>
    space.id === primary.id ? { ...space, wallIds: walls.map((wall) => wall.id) } : space,
  );
  const proposed = normalizedEnvelope(
    {
      ...room,
      spaces,
      scene: { ...room.scene, objects, updatedAt: new Date().toISOString() },
      updatedAt: new Date().toISOString(),
    },
    true,
  );
  if (!getRoomSpaceFloorPlans(proposed).some((floor) => floor.spaceId === primary.id)) {
    throw new Error("The rectangle did not produce a valid closed room.");
  }
  return {
    room: proposed,
    createdWallIds: walls.map((wall) => wall.id),
    annexSpaceId: null,
  };
}
