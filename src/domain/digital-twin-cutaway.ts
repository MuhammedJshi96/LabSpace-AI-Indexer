import type { Room, SceneObject } from "./schema";

type HorizontalCameraPosition = { x: number; z: number };

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
