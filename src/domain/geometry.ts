import { ASSET_BY_ID } from "./assets";
import type { Room, Scene, SceneObject } from "./schema";
import { getClosedWallFloorPolygon, pointIsInsideFloorPolygon } from "./room-geometry";

export const MM_PER_METRE = 1000;

export function mmToMetres(value: number): number {
  return value / MM_PER_METRE;
}

export function metresToMm(value: number): number {
  return Math.round(value * MM_PER_METRE);
}

type RoomMetricsInput = Pick<Room, "width" | "depth"> & Partial<Pick<Room, "scene">>;

export function roomArea(room: RoomMetricsInput): number {
  const floorPolygon = room.scene ? getClosedWallFloorPolygon(room.scene.objects) : null;
  return (floorPolygon?.areaMm2 ?? room.width * room.depth) / 1_000_000;
}

export function roomPerimeter(room: RoomMetricsInput): number {
  const floorPolygon = room.scene ? getClosedWallFloorPolygon(room.scene.objects) : null;
  return (floorPolygon?.perimeterMm ?? room.width * 2 + room.depth * 2) / MM_PER_METRE;
}

export function wallLength(wall: SceneObject): number {
  if (!wall.wall) return wall.dimensions.width;
  return Math.hypot(wall.wall.end.x - wall.wall.start.x, wall.wall.end.y - wall.wall.start.y);
}

export function wallAngle(wall: SceneObject): number {
  if (!wall.wall) return wall.rotation.z;
  return (
    (Math.atan2(wall.wall.end.y - wall.wall.start.y, wall.wall.end.x - wall.wall.start.x) * 180) /
    Math.PI
  );
}

export function snapValue(value: number, gridSize: number, tolerance = 12): number {
  const candidate = Math.round(value / gridSize) * gridSize;
  return Math.abs(candidate - value) <= tolerance ? candidate : value;
}

export function snapPoint(
  point: { x: number; y: number },
  scene: Scene,
  options: { gridSize: number; tolerance: number; excludeId?: string },
): { x: number; y: number; guides: Array<{ axis: "x" | "y"; value: number; kind: string }> } {
  let x = snapValue(point.x, options.gridSize, options.tolerance);
  let y = snapValue(point.y, options.gridSize, options.tolerance);
  const guides: Array<{ axis: "x" | "y"; value: number; kind: string }> = [];
  const candidatesX: Array<{ value: number; kind: string }> = [];
  const candidatesY: Array<{ value: number; kind: string }> = [];
  const wallEndpoints: Array<{ x: number; y: number }> = [];

  for (const object of scene.objects) {
    if (object.id === options.excludeId || !object.visible) continue;
    const bounds = objectBounds(object);
    candidatesX.push(
      { value: object.position.x, kind: "center" },
      { value: bounds.left, kind: "edge" },
      { value: bounds.right, kind: "edge" },
    );
    candidatesY.push(
      { value: object.position.y, kind: "center" },
      { value: bounds.top, kind: "edge" },
      { value: bounds.bottom, kind: "edge" },
    );
    if (object.wall) {
      wallEndpoints.push(object.wall.start, object.wall.end);
      candidatesX.push(
        { value: object.wall.start.x, kind: "wall" },
        { value: object.wall.end.x, kind: "wall" },
      );
      candidatesY.push(
        { value: object.wall.start.y, kind: "wall" },
        { value: object.wall.end.y, kind: "wall" },
      );
    }
  }

  // Closing a room must resolve to the actual wall centreline endpoint. Generic
  // object bounds include the wall's thickness and can otherwise win by a few
  // pixels, leaving a visually closed outline topologically open.
  const nearestWallEndpoint = wallEndpoints.sort(
    (first, second) =>
      Math.hypot(first.x - point.x, first.y - point.y) -
      Math.hypot(second.x - point.x, second.y - point.y),
  )[0];
  if (
    nearestWallEndpoint &&
    Math.hypot(nearestWallEndpoint.x - point.x, nearestWallEndpoint.y - point.y) <=
      options.tolerance
  ) {
    return {
      x: nearestWallEndpoint.x,
      y: nearestWallEndpoint.y,
      guides: [
        { axis: "x", value: nearestWallEndpoint.x, kind: "wall-endpoint" },
        { axis: "y", value: nearestWallEndpoint.y, kind: "wall-endpoint" },
      ],
    };
  }

  const nearestX = candidatesX.sort(
    (a, b) => Math.abs(a.value - point.x) - Math.abs(b.value - point.x),
  )[0];
  const nearestY = candidatesY.sort(
    (a, b) => Math.abs(a.value - point.y) - Math.abs(b.value - point.y),
  )[0];
  if (nearestX && Math.abs(nearestX.value - point.x) <= options.tolerance) {
    x = nearestX.value;
    guides.push({ axis: "x", value: x, kind: nearestX.kind });
  }
  if (nearestY && Math.abs(nearestY.value - point.y) <= options.tolerance) {
    y = nearestY.value;
    guides.push({ axis: "y", value: y, kind: nearestY.kind });
  }
  return { x, y, guides };
}

export function objectBounds(object: SceneObject) {
  const angle = (object.rotation.z * Math.PI) / 180;
  const cosine = Math.abs(Math.cos(angle));
  const sine = Math.abs(Math.sin(angle));
  const halfWidth = object.dimensions.width / 2;
  const halfDepth = object.dimensions.depth / 2;
  const extentX = cosine * halfWidth + sine * halfDepth;
  const extentY = sine * halfWidth + cosine * halfDepth;
  return {
    left: object.position.x - extentX,
    right: object.position.x + extentX,
    top: object.position.y - extentY,
    bottom: object.position.y + extentY,
  };
}

export function requiresBenchSupport(object: SceneObject): boolean {
  return ASSET_BY_ID.get(object.assetDefinitionId)?.connection === "bench";
}

export function supportSurfaceElevation(object: SceneObject): number | null {
  const explicitHeight = Number(object.metadata.supportSurfaceHeight);
  if (Number.isFinite(explicitHeight)) return object.position.z + explicitHeight;

  const profile = ASSET_BY_ID.get(object.assetDefinitionId)?.profile;
  if (profile === "bench") return object.position.z + Math.min(900, object.dimensions.height);
  if (profile === "table") return object.position.z + Math.min(760, object.dimensions.height);
  if (profile === "workstation") return object.position.z + Math.min(740, object.dimensions.height);
  return null;
}

function horizontalOverlapCoverage(support: SceneObject, placed: SceneObject): number {
  const supportBounds = objectBounds(support);
  const placedBounds = objectBounds(placed);
  const width = Math.max(
    0,
    Math.min(supportBounds.right, placedBounds.right) -
      Math.max(supportBounds.left, placedBounds.left),
  );
  const depth = Math.max(
    0,
    Math.min(supportBounds.bottom, placedBounds.bottom) -
      Math.max(supportBounds.top, placedBounds.top),
  );
  const placedArea = Math.max(
    1,
    (placedBounds.right - placedBounds.left) * (placedBounds.bottom - placedBounds.top),
  );
  return (width * depth) / placedArea;
}

export function findBenchSupport(
  room: Room,
  placed: SceneObject,
): { object: SceneObject; elevationMm: number; coverage: number } | null {
  if (!requiresBenchSupport(placed)) return null;
  const candidates = room.scene.objects
    .filter((support) => support.id !== placed.id && support.visible)
    .flatMap((support) => {
      const elevationMm = supportSurfaceElevation(support);
      if (elevationMm === null) return [];
      const coverage = horizontalOverlapCoverage(support, placed);
      return coverage >= 0.55 ? [{ object: support, elevationMm, coverage }] : [];
    })
    .sort(
      (left, right) =>
        right.coverage - left.coverage || left.elevationMm - right.elevationMm,
    );
  return candidates[0] ?? null;
}

export function snapBenchObjectToAvailableSupport(
  room: Room,
  placed: SceneObject,
): SceneObject | null {
  if (!requiresBenchSupport(placed)) return placed;
  const placedAtOrigin = { ...placed, position: { ...placed.position, x: 0, y: 0 } };
  const placedBounds = objectBounds(placedAtOrigin);
  const halfWidth = (placedBounds.right - placedBounds.left) / 2;
  const halfDepth = (placedBounds.bottom - placedBounds.top) / 2;
  const clamp = (value: number, minimum: number, maximum: number) =>
    Math.min(maximum, Math.max(minimum, value));

  const candidates = room.scene.objects
    .filter((support) => support.id !== placed.id && support.visible)
    .flatMap((support) => {
      const elevationMm = supportSurfaceElevation(support);
      if (elevationMm === null) return [];
      const bounds = objectBounds(support);
      const minimumX = bounds.left + halfWidth;
      const maximumX = bounds.right - halfWidth;
      const minimumY = bounds.top + halfDepth;
      const maximumY = bounds.bottom - halfDepth;
      if (minimumX > maximumX || minimumY > maximumY) return [];
      const x = clamp(placed.position.x, minimumX, maximumX);
      const y = clamp(placed.position.y, minimumY, maximumY);
      const candidate: SceneObject = {
        ...placed,
        position: { ...placed.position, x, y, z: elevationMm },
      };
      const resolvedSupport = findBenchSupport(room, candidate);
      if (resolvedSupport?.object.id !== support.id) return [];
      const collides = room.scene.objects.some(
        (other) =>
          other.id !== placed.id &&
          other.id !== support.id &&
          other.visible &&
          !["wall", "door", "window", "label", "measurement"].includes(other.objectType) &&
          objectsOverlap(candidate, other, 15),
      );
      if (collides) return [];
      return [
        {
          candidate,
          distance: Math.hypot(x - placed.position.x, y - placed.position.y),
        },
      ];
    })
    .sort((left, right) => left.distance - right.distance);

  return candidates[0]?.candidate ?? null;
}

export function objectsOverlap(a: SceneObject, b: SceneObject, padding = 0): boolean {
  if (a.objectType === "wall" || b.objectType === "wall") return false;
  if (a.parentObjectId === b.id || b.parentObjectId === a.id) return false;
  const explicitlyAllowsOverlap = (source: SceneObject, target: SceneObject) => {
    const exemptIds = source.metadata.overlapExemptObjectIds;
    return Array.isArray(exemptIds) && exemptIds.includes(target.id);
  };
  if (explicitlyAllowsOverlap(a, b) || explicitlyAllowsOverlap(b, a)) return false;
  const restsOnSupportSurface = (support: SceneObject, placed: SceneObject) => {
    const explicitHeight = Number(support.metadata.supportSurfaceHeight);
    const explicitElevation = Number.isFinite(explicitHeight)
      ? support.position.z + explicitHeight
      : null;
    const elevationMm = explicitElevation ??
      (requiresBenchSupport(placed) ? supportSurfaceElevation(support) : null);
    return (
      elevationMm !== null &&
      horizontalOverlapCoverage(support, placed) >= 0.55 &&
      Math.abs(placed.position.z - elevationMm) <= Math.max(padding, 20)
    );
  };
  if (restsOnSupportSurface(a, b) || restsOnSupportSurface(b, a)) return false;
  const aTop = a.position.z + a.dimensions.height;
  const bTop = b.position.z + b.dimensions.height;
  if (aTop <= b.position.z + padding || bTop <= a.position.z + padding) return false;
  const aa = objectBounds(a);
  const bb = objectBounds(b);
  return !(
    aa.right <= bb.left + padding ||
    aa.left >= bb.right - padding ||
    aa.bottom <= bb.top + padding ||
    aa.top >= bb.bottom - padding
  );
}

export type ValidationWarning = {
  id: string;
  severity: "info" | "warning" | "error";
  objectIds: string[];
  title: string;
  message: string;
};

export function validatePlacement(room: Room): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const floorPolygon = getClosedWallFloorPolygon(room.scene.objects);
  const placed = room.scene.objects.filter(
    (object) =>
      object.visible &&
      !["wall", "door", "window", "label", "measurement"].includes(object.objectType),
  );
  for (const object of placed) {
    const bounds = objectBounds(object);
    const outsideFloor = floorPolygon
      ? [
          { x: bounds.left, y: bounds.top },
          { x: bounds.right, y: bounds.top },
          { x: bounds.right, y: bounds.bottom },
          { x: bounds.left, y: bounds.bottom },
          { x: object.position.x, y: object.position.y },
        ].some((point) => !pointIsInsideFloorPolygon(point, floorPolygon))
      : bounds.left < 0 ||
        bounds.top < 0 ||
        bounds.right > room.width ||
        bounds.bottom > room.depth;
    if (outsideFloor) {
      warnings.push({
        id: `outside-${object.id}`,
        severity: "error",
        objectIds: [object.id],
        title: "Outside room boundary",
        message: `${object.name} extends beyond the ${room.name} floor boundary.`,
      });
    }
    if (object.position.z < 0) {
      warnings.push({
        id: `below-floor-${object.id}`,
        severity: "error",
        objectIds: [object.id],
        title: "Below floor level",
        message: `${object.name} has a negative raised-from-floor value.`,
      });
    } else if (object.position.z + object.dimensions.height > room.wallHeight) {
      warnings.push({
        id: `above-ceiling-${object.id}`,
        severity: "warning",
        objectIds: [object.id],
        title: "Above room height",
        message: `${object.name} extends above the ${room.wallHeight} mm room height.`,
      });
    }
    if (requiresBenchSupport(object)) {
      const support = findBenchSupport(room, object);
      if (!support) {
        warnings.push({
          id: `unsupported-${object.id}`,
          severity: "error",
          objectIds: [object.id],
          title: "Bench support required",
          message: `${object.name} must rest on a laboratory bench or table at this location.`,
        });
      } else if (Math.abs(object.position.z - support.elevationMm) > 20) {
        warnings.push({
          id: `unsupported-${object.id}-${support.object.id}`,
          severity: "error",
          objectIds: [object.id, support.object.id],
          title: "Incorrect support elevation",
          message: `${object.name} must rest at ${support.elevationMm} mm on ${support.object.name}.`,
        });
      }
    }
  }
  for (let index = 0; index < placed.length; index += 1) {
    for (let next = index + 1; next < placed.length; next += 1) {
      const a = placed[index];
      const b = placed[next];
      if (objectsOverlap(a, b, 15)) {
        warnings.push({
          id: `overlap-${a.id}-${b.id}`,
          severity: "warning",
          objectIds: [a.id, b.id],
          title: "Placement overlap",
          message: `${a.name} overlaps ${b.name}.`,
        });
      }
    }
  }
  const codeGroups = new Map<string, SceneObject[]>();
  for (const object of room.scene.objects) {
    codeGroups.set(object.indexCode, [...(codeGroups.get(object.indexCode) ?? []), object]);
  }
  for (const [code, objects] of codeGroups) {
    if (objects.length > 1) {
      warnings.push({
        id: `duplicate-code-${code}`,
        severity: "error",
        objectIds: objects.map((object) => object.id),
        title: "Duplicate index code",
        message: `${code} is assigned to ${objects.length} objects.`,
      });
    }
  }
  const openings = room.scene.objects.filter((object) =>
    ["door", "window"].includes(object.objectType),
  );
  for (const object of openings) {
    if (!object.opening) {
      warnings.push({
        id: `opening-unhosted-${object.id}`,
        severity: "error",
        objectIds: [object.id],
        title: "Opening is not hosted",
        message: `${object.name} must be placed directly on a wall.`,
      });
      continue;
    }
    const wall = room.scene.objects.find(
      (entry) => entry.id === object.opening?.wallId && entry.wall,
    );
    if (!wall?.wall) {
      warnings.push({
        id: `opening-orphan-${object.id}`,
        severity: "error",
        objectIds: [object.id],
        title: "Hosted wall is missing",
        message: `${object.name} refers to a wall that no longer exists.`,
      });
      continue;
    }
    const width = object.opening.width;
    const length = wallLength(wall);
    if (
      width > length ||
      object.opening.offset < width / 2 ||
      object.opening.offset > length - width / 2
    ) {
      warnings.push({
        id: `opening-bounds-${object.id}`,
        severity: "error",
        objectIds: [object.id, wall.id],
        title: "Opening exceeds wall",
        message: `${object.name} does not fit completely inside ${wall.name}.`,
      });
    }
    if (object.opening.sillHeight + object.opening.height > wall.wall.height) {
      warnings.push({
        id: `opening-height-${object.id}`,
        severity: "error",
        objectIds: [object.id, wall.id],
        title: "Opening exceeds wall height",
        message: `${object.name} extends above ${wall.name}.`,
      });
    }
    if (
      object.opening.width !== object.dimensions.width ||
      object.opening.height !== object.dimensions.height
    ) {
      warnings.push({
        id: `opening-size-sync-${object.id}`,
        severity: "warning",
        objectIds: [object.id],
        title: "Opening size needs synchronization",
        message: `${object.name}'s wall cut differs from its visible dimensions.`,
      });
    }
  }
  for (let index = 0; index < openings.length; index += 1) {
    const a = openings[index];
    if (!a.opening) continue;
    for (let next = index + 1; next < openings.length; next += 1) {
      const b = openings[next];
      if (!b.opening || a.opening.wallId !== b.opening.wallId) continue;
      if (Math.abs(a.opening.offset - b.opening.offset) < (a.opening.width + b.opening.width) / 2) {
        warnings.push({
          id: `opening-overlap-${a.id}-${b.id}`,
          severity: "error",
          objectIds: [a.id, b.id],
          title: "Wall openings overlap",
          message: `${a.name} overlaps ${b.name} on their hosted wall.`,
        });
      }
    }
  }
  const equipmentIds = new Map<string, string[]>();
  const serials = new Map<string, string[]>();
  for (const record of room.scene.equipmentRecords) {
    equipmentIds.set(record.equipmentId, [
      ...(equipmentIds.get(record.equipmentId) ?? []),
      record.objectId,
    ]);
    if (record.serialNumber)
      serials.set(record.serialNumber, [
        ...(serials.get(record.serialNumber) ?? []),
        record.objectId,
      ]);
  }
  for (const [id, objectIds] of equipmentIds) {
    if (objectIds.length > 1)
      warnings.push({
        id: `equipment-${id}`,
        severity: "error",
        objectIds,
        title: "Duplicate equipment ID",
        message: `${id} is not unique.`,
      });
  }
  for (const [serial, objectIds] of serials) {
    if (objectIds.length > 1)
      warnings.push({
        id: `serial-${serial}`,
        severity: "warning",
        objectIds,
        title: "Duplicate serial number",
        message: `${serial} appears more than once.`,
      });
  }
  return warnings;
}
