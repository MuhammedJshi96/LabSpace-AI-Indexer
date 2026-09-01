import type { Room, SceneObject } from "./schema";

type HorizontalCameraPosition = { x: number; z: number };
type FocusPoint = { x: number; y?: number; z: number };

const cross2d = (ax: number, az: number, bx: number, bz: number) => ax * bz - az * bx;

function pointToSegmentDistance(
  point: HorizontalCameraPosition,
  start: HorizontalCameraPosition,
  end: HorizontalCameraPosition,
) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared < 1e-8) return Math.hypot(point.x - start.x, point.z - start.z);
  const amount = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared),
  );
  return Math.hypot(point.x - (start.x + dx * amount), point.z - (start.z + dz * amount));
}

/**
 * Returns true when a perimeter wall sits between the current camera and the
 * room centre. Interior partitions remain visible so the cutaway preserves
 * useful spatial context while removing only the foreground shell.
 */
export function shouldCutawayWall(
  wall: SceneObject | undefined,
  room: Pick<Room, "width" | "depth">,
  camera: HorizontalCameraPosition,
) {
  if (!wall?.wall) return false;

  const midpointX = (wall.wall.start.x + wall.wall.end.x) / 2 - room.width / 2;
  const midpointZ = (wall.wall.start.y + wall.wall.end.y) / 2 - room.depth / 2;
  const radialDistance = Math.hypot(midpointX, midpointZ);
  const perimeterThreshold = Math.min(room.width, room.depth) * 0.28;

  // Preserve internal partitions and service spines even when they happen to
  // fall on the camera-facing side of the room.
  if (radialDistance < perimeterThreshold) return false;

  const cameraLength = Math.hypot(camera.x, camera.z);
  if (cameraLength < 0.001) return false;

  const cameraDirectionX = camera.x / cameraLength;
  const cameraDirectionZ = camera.z / cameraLength;
  const cameraSideDistance = midpointX * cameraDirectionX + midpointZ * cameraDirectionZ;
  const deadZone = Math.min(room.width, room.depth) * 0.02;

  return cameraSideDistance > deadZone;
}

/**
 * Removes only a wall that crosses the active evidence sightline. Unlike the
 * optional room-shell cutaway, this also handles an interior partition beside
 * a selected cabinet. It is transient view logic and never changes wall data.
 */
export function shouldCutawayWallForFocus(
  wall: SceneObject | undefined,
  room: Pick<Room, "width" | "depth">,
  camera: FocusPoint,
  target: FocusPoint | null | undefined,
) {
  if (!wall?.wall || !target) return false;

  const start = {
    x: wall.wall.start.x / 1000 - room.width / 2000,
    z: wall.wall.start.y / 1000 - room.depth / 2000,
  };
  const end = {
    x: wall.wall.end.x / 1000 - room.width / 2000,
    z: wall.wall.end.y / 1000 - room.depth / 2000,
  };
  const rayX = target.x - camera.x;
  const rayZ = target.z - camera.z;
  const wallX = end.x - start.x;
  const wallZ = end.z - start.z;
  const denominator = cross2d(rayX, rayZ, wallX, wallZ);
  const wallLength = Math.hypot(wallX, wallZ);
  const thickness = Math.max(0.04, wall.wall.thickness / 1000);
  let intersectionAmount: number | null = null;

  if (Math.abs(denominator) > 1e-7) {
    const offsetX = start.x - camera.x;
    const offsetZ = start.z - camera.z;
    const rayAmount = cross2d(offsetX, offsetZ, wallX, wallZ) / denominator;
    const wallAmount = cross2d(offsetX, offsetZ, rayX, rayZ) / denominator;
    const endpointPadding = wallLength > 1e-6 ? (thickness * 0.65 + 0.04) / wallLength : 0;
    if (
      rayAmount > 0.025 &&
      rayAmount < 0.985 &&
      wallAmount >= -endpointPadding &&
      wallAmount <= 1 + endpointPadding
    ) {
      intersectionAmount = rayAmount;
    }
  } else {
    const midpoint = { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 };
    const distance = pointToSegmentDistance(midpoint, camera, target);
    const rayLengthSquared = rayX * rayX + rayZ * rayZ;
    const projected = rayLengthSquared
      ? ((midpoint.x - camera.x) * rayX + (midpoint.z - camera.z) * rayZ) / rayLengthSquared
      : 0;
    if (distance <= thickness / 2 + 0.05 && projected > 0.025 && projected < 0.985) {
      intersectionAmount = projected;
    }
  }

  if (intersectionAmount === null) return false;
  if (typeof camera.y === "number" && typeof target.y === "number") {
    const sightlineHeight = camera.y + (target.y - camera.y) * intersectionAmount;
    if (sightlineHeight > wall.wall.height / 1000 + 0.08) return false;
  }
  return true;
}
