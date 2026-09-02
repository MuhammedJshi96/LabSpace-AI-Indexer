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

export type FrontAccessRequirement = {
  clearanceMm: number;
  lateralMarginMm: number;
  allowsAlignedOperatorSeat: boolean;
};

const FRONT_ACCESS_BY_ASSET = new Map<string, FrontAccessRequirement>([
  ["biosafety-cabinet", { clearanceMm: 900, lateralMarginMm: 0, allowsAlignedOperatorSeat: true }],
  ["fume-hood", { clearanceMm: 900, lateralMarginMm: 0, allowsAlignedOperatorSeat: true }],
  ["laminar-flow", { clearanceMm: 900, lateralMarginMm: 0, allowsAlignedOperatorSeat: true }],
]);

const OPERATOR_SEAT_ASSETS = new Set(["office-chair", "laboratory-chair", "round-stool"]);

/**
 * Returns the authored front direction in the 2D room coordinate system.
 * Asset fronts use local +Y; Konva's positive rotation turns that direction
 * clockwise on the plan, matching the editor and chair-to-desk snap logic.
 */
export function objectFrontVector(object: SceneObject) {
  const rotation = object.rotation.z + (object.flipVertical ? 180 : 0);
  const angle = (rotation * Math.PI) / 180;
  return { x: -Math.sin(angle), y: Math.cos(angle) };
}

export function frontAccessRequirement(object: SceneObject): FrontAccessRequirement | null {
  return FRONT_ACCESS_BY_ASSET.get(object.assetDefinitionId ?? "") ?? null;
}

function objectFootprintCorners(object: SceneObject) {
  const rotation = object.rotation.z + (object.flipVertical ? 180 : 0);
  const angle = (rotation * Math.PI) / 180;
  const lateral = { x: Math.cos(angle), y: Math.sin(angle) };
  const forward = { x: -Math.sin(angle), y: Math.cos(angle) };
  const halfWidth = object.dimensions.width / 2;
  const halfDepth = object.dimensions.depth / 2;
  return [
    { across: -halfWidth, forward: -halfDepth },
    { across: halfWidth, forward: -halfDepth },
    { across: halfWidth, forward: halfDepth },
    { across: -halfWidth, forward: halfDepth },
  ].map((point) => ({
    x: object.position.x + lateral.x * point.across + forward.x * point.forward,
    y: object.position.y + lateral.y * point.across + forward.y * point.forward,
  }));
}

function frontAccessPolygon(object: SceneObject, requirement: FrontAccessRequirement) {
  const front = objectFrontVector(object);
  const lateral = { x: front.y, y: -front.x };
  const halfWidth = object.dimensions.width / 2 + requirement.lateralMarginMm;
  const near = object.dimensions.depth / 2 + 20;
  const far = object.dimensions.depth / 2 + requirement.clearanceMm;
  return [
    { across: -halfWidth, forward: near },
    { across: halfWidth, forward: near },
    { across: halfWidth, forward: far },
    { across: -halfWidth, forward: far },
  ].map((point) => ({
    x: object.position.x + lateral.x * point.across + front.x * point.forward,
    y: object.position.y + lateral.y * point.across + front.y * point.forward,
  }));
}

function polygonsIntersect(
  first: Array<{ x: number; y: number }>,
  second: Array<{ x: number; y: number }>,
) {
  const separatedOnAnyAxis = (source: Array<{ x: number; y: number }>) => {
    for (let index = 0; index < source.length; index += 1) {
      const start = source[index];
      const end = source[(index + 1) % source.length];
      const axis = { x: -(end.y - start.y), y: end.x - start.x };
      const firstProjection = first.map((point) => point.x * axis.x + point.y * axis.y);
      const secondProjection = second.map((point) => point.x * axis.x + point.y * axis.y);
      if (
        Math.max(...firstProjection) <= Math.min(...secondProjection) + 1 ||
        Math.max(...secondProjection) <= Math.min(...firstProjection) + 1
      ) {
        return true;
      }
    }
    return false;
  };
  return !separatedOnAnyAxis(first) && !separatedOnAnyAxis(second);
}

function isAlignedOperatorSeat(host: SceneObject, candidate: SceneObject) {
  if (!OPERATOR_SEAT_ASSETS.has(candidate.assetDefinitionId ?? "")) return false;
  if (candidate.assetDefinitionId === "round-stool") return true;
  const hostFront = objectFrontVector(host);
  const seatFront = objectFrontVector(candidate);
  return seatFront.x * -hostFront.x + seatFront.y * -hostFront.y >= Math.cos(Math.PI / 6);
}

export function requiresBenchSupport(object: SceneObject): boolean {
  return ASSET_BY_ID.get(object.assetDefinitionId)?.connection === "bench";
}

export function supportSurfaceElevation(object: SceneObject): number | null {
  const explicitHeight = Number(object.metadata.supportSurfaceHeight);
  if (Number.isFinite(explicitHeight)) return object.position.z + explicitHeight;

  if (object.assetDefinitionId === "computer-lab-bench")
    return object.position.z + object.dimensions.height * (800 / 1350);
  if (object.assetDefinitionId === "institutional-sink-cabinet")
    return object.position.z + object.dimensions.height * (900 / 1200);

  const profile = ASSET_BY_ID.get(object.assetDefinitionId)?.profile;
  if (profile === "bench") return object.position.z + Math.min(900, object.dimensions.height);
  if (profile === "corner") return object.position.z + Math.min(900, object.dimensions.height);
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
    .sort((left, right) => right.coverage - left.coverage || left.elevationMm - right.elevationMm);
  return candidates[0] ?? null;
}

/**
 * Align benchtop equipment only when its current footprint already overlaps a
 * work surface. Unlike the agent-only placement resolver below, this helper
 * never changes x/y or searches for a different bench.
 */
export function alignBenchObjectToCurrentSupport(
  room: Room,
  placed: SceneObject,
  unsupportedElevationMm = 0,
): SceneObject {
  if (!requiresBenchSupport(placed)) return placed;
  const support = findBenchSupport(room, placed);
  return {
    ...placed,
    position: {
      ...placed.position,
      z: support?.elevationMm ?? unsupportedElevationMm,
    },
  };
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
  if (chairFitsUnderDesk(a, b) || chairFitsUnderDesk(b, a)) return false;
  const restsOnSupportSurface = (support: SceneObject, placed: SceneObject) => {
    const explicitHeight = Number(support.metadata.supportSurfaceHeight);
    const explicitElevation = Number.isFinite(explicitHeight)
      ? support.position.z + explicitHeight
      : null;
    const elevationMm =
      explicitElevation ?? (requiresBenchSupport(placed) ? supportSurfaceElevation(support) : null);
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

const OPEN_KNEE_DESKS = new Set([
  "office-desk",
  "rectangular-table",
  "computer-workstation",
  "computer-lab-bench",
]);

function deskKneeSpace(desk: SceneObject) {
  // The reference computer bench has a real right-hand drawer pedestal.
  // Its knee space is offset to the left, never the whole worktop footprint.
  if (desk.assetDefinitionId === "computer-lab-bench") {
    const direction = desk.flipHorizontal ? -1 : 1;
    return {
      center: -desk.dimensions.width * 0.13 * direction,
      halfWidth: desk.dimensions.width * 0.28,
    };
  }
  return { center: 0, halfWidth: desk.dimensions.width / 2 - 100 };
}

/** Only the seat's front may tuck under an open knee-space desk; its back stays outside. */
export function chairFitsUnderDesk(desk: SceneObject, chair: SceneObject): boolean {
  if (
    !OPEN_KNEE_DESKS.has(desk.assetDefinitionId ?? "") ||
    !["office-chair", "laboratory-chair", "round-stool"].includes(chair.assetDefinitionId ?? "")
  )
    return false;
  if (Math.abs(chair.position.z - desk.position.z) > 20) return false;
  const surface = supportSurfaceElevation(desk);
  if (surface === null || chair.position.z + chair.dimensions.height * 0.68 > surface - 35)
    return false;
  const angle = ((desk.rotation.z + (desk.flipVertical ? 180 : 0)) * Math.PI) / 180;
  const dx = chair.position.x - desk.position.x;
  const dy = chair.position.y - desk.position.y;
  const across = dx * Math.cos(angle) + dy * Math.sin(angle);
  const forward = -dx * Math.sin(angle) + dy * Math.cos(angle);
  const turn =
    (((chair.rotation.z + (chair.flipVertical ? 180 : 0) - (angle * 180) / Math.PI) % 360) + 360) %
    360;
  const facingDesk = chair.assetDefinitionId === "round-stool" || Math.abs(turn - 180) <= 15;
  const knee = deskKneeSpace(desk);
  return (
    facingDesk &&
    Math.abs(across - knee.center) + chair.dimensions.width / 2 <= knee.halfWidth &&
    forward >= desk.dimensions.depth / 2 + chair.dimensions.depth * 0.22 &&
    forward <= desk.dimensions.depth / 2 + chair.dimensions.depth / 2 + 20
  );
}

export function snapChairToDesk(room: Room, chair: SceneObject, thresholdMm = 240): SceneObject {
  if (!["office-chair", "laboratory-chair", "round-stool"].includes(chair.assetDefinitionId ?? ""))
    return chair;
  const candidates = room.scene.objects
    .filter((desk) => desk.visible && OPEN_KNEE_DESKS.has(desk.assetDefinitionId ?? ""))
    .flatMap((desk) => {
      const rotation = desk.rotation.z + (desk.flipVertical ? 180 : 0);
      const angle = (rotation * Math.PI) / 180;
      const offset = desk.dimensions.depth / 2 + chair.dimensions.depth * 0.27;
      const across = deskKneeSpace(desk).center;
      const candidate: SceneObject = {
        ...chair,
        flipVertical: false,
        position: {
          x: desk.position.x + Math.cos(angle) * across - Math.sin(angle) * offset,
          y: desk.position.y + Math.sin(angle) * across + Math.cos(angle) * offset,
          z: desk.position.z,
        },
        rotation: { ...chair.rotation, z: (rotation + 180) % 360 },
      };
      const distance = Math.hypot(
        candidate.position.x - chair.position.x,
        candidate.position.y - chair.position.y,
      );
      if (distance > thresholdMm || !chairFitsUnderDesk(desk, candidate)) return [];
      if (
        room.scene.objects.some(
          (other) =>
            other.id !== chair.id &&
            other.id !== desk.id &&
            other.visible &&
            !["wall", "door", "window", "label", "measurement"].includes(other.objectType) &&
            objectsOverlap(candidate, other, 15),
        )
      )
        return [];
      return [{ candidate, distance }];
    })
    .sort((a, b) => a.distance - b.distance);
  return candidates[0]?.candidate ?? chair;
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
  for (const host of placed) {
    const requirement = frontAccessRequirement(host);
    if (!requirement) continue;
    const accessPolygon = frontAccessPolygon(host, requirement);
    const accessOutsideFloor = floorPolygon
      ? accessPolygon.some((point) => !pointIsInsideFloorPolygon(point, floorPolygon))
      : accessPolygon.some(
          (point) => point.x < 0 || point.y < 0 || point.x > room.width || point.y > room.depth,
        );
    if (accessOutsideFloor) {
      warnings.push({
        id: `access-front-boundary-${host.id}`,
        severity: "warning",
        objectIds: [host.id],
        title: "Front working zone faces a boundary",
        message: `${host.name}'s authored front does not provide its ${requirement.clearanceMm} mm planning access zone inside ${room.name}. Rotate or reposition it before use; this is planning evidence, not a certified clearance assessment.`,
      });
    }
    for (const other of placed) {
      if (
        other.id === host.id ||
        other.parentObjectId === host.id ||
        host.parentObjectId === other.id ||
        other.position.z >= Math.min(host.dimensions.height, 1_700) ||
        other.position.z + other.dimensions.height <= 0 ||
        !polygonsIntersect(accessPolygon, objectFootprintCorners(other)) ||
        (requirement.allowsAlignedOperatorSeat && isAlignedOperatorSeat(host, other))
      ) {
        continue;
      }
      warnings.push({
        id: `access-front-${host.id}-${other.id}`,
        severity: "warning",
        objectIds: [host.id, other.id],
        title: "Front working zone obstructed",
        message: `${other.name} occupies ${host.name}'s ${requirement.clearanceMm} mm front working zone. Keep the service face usable or align an operator seat toward it; this is planning evidence, not a certified clearance assessment.`,
      });
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
    // A conservative, wall-local envelope for the visible hinged leaf sweep.
    // This is planning evidence, not a code-compliant egress assessment. Use
    // the same positive local-Y / outward reflection as the 2D/3D opening.
    if (
      object.visible &&
      object.objectType === "door" &&
      object.opening.swing !== "sliding" &&
      length > 0
    ) {
      const angle = (wallAngle(wall) * Math.PI) / 180;
      const cos = Math.cos(angle),
        sin = Math.sin(angle);
      const centerX = wall.wall.start.x + cos * object.opening.offset;
      const centerY = wall.wall.start.y + sin * object.opening.offset;
      const direction = object.opening.swing === "outward" ? -1 : 1;
      const leafDepth = width / (object.assetDefinitionId.startsWith("double-") ? 2 : 1);
      for (const item of placed) {
        if (
          item.position.z >= object.opening.sillHeight + object.opening.height ||
          item.position.z + item.dimensions.height <= object.opening.sillHeight
        )
          continue;
        const dx = item.position.x - centerX,
          dy = item.position.y - centerY;
        const localBounds = objectBounds({
          ...item,
          position: {
            ...item.position,
            x: dx * cos + dy * sin,
            y: (-dx * sin + dy * cos) * direction,
          },
          rotation: { ...item.rotation, z: (item.rotation.z - wallAngle(wall)) * direction },
        });
        if (
          localBounds.right > -width / 2 + 15 &&
          localBounds.left < width / 2 - 15 &&
          localBounds.bottom > wall.wall.thickness / 2 + 15 &&
          localBounds.top < leafDepth - 15
        ) {
          warnings.push({
            id: `overlap-door-${object.id}-${item.id}`,
            severity: "warning",
            objectIds: [object.id, item.id],
            title: "Door opening obstructed",
            message: `${item.name} occupies ${object.name}'s hinged-door opening envelope. Keep this planning area clear; exact access and egress require review.`,
          });
        }
      }
    }
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
