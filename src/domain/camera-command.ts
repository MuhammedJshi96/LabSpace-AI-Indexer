export type CameraCommandInput = {
  roomId: string;
  presentation: "editor" | "digital-twin";
  preset: string;
  focusObjectId?: string | null;
  focusLocationId?: string | null;
};

export function isCameraFocusClear(previous: CameraCommandInput | null, next: CameraCommandInput) {
  return Boolean(
    previous &&
    previous.roomId === next.roomId &&
    previous.presentation === next.presentation &&
    previous.preset === next.preset &&
    (previous.focusObjectId || previous.focusLocationId) &&
    !next.focusObjectId &&
    !next.focusLocationId,
  );
}

export type DigitalTwinCameraApproachInput = {
  roomWidthMm: number;
  roomDepthMm: number;
  objectXmm: number;
  objectYmm: number;
  objectRotationDeg: number;
  face?: { x: number; z: number };
  flipHorizontal?: boolean;
  flipVertical?: boolean;
};

export type DigitalTwinCameraApproach = {
  forwardX: number;
  forwardZ: number;
  lateralX: number;
  lateralZ: number;
};

export type DigitalTwinFocusObstacle = {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

export type DigitalTwinFocusCameraPosition = {
  x: number;
  y: number;
  z: number;
  lateralBias: number;
  blockerIds: string[];
};

export type EditorInitialIsometricPositionInput = {
  roomWidthMetres: number;
  roomDepthMetres: number;
  target: readonly [number, number, number];
};

// Captured from the user-approved split-view framing. Expressing the orbit as
// a room-relative scale keeps the same relaxed overview for small and large
// rooms without hard-coding DEMO-01 coordinates into the general editor.
export const EDITOR_INITIAL_ISOMETRIC_COMPONENT_SCALE = 1.256;

export function editorInitialIsometricPosition({
  roomWidthMetres,
  roomDepthMetres,
  target,
}: EditorInitialIsometricPositionInput): [number, number, number] {
  const component =
    Math.max(roomWidthMetres, roomDepthMetres) * EDITOR_INITIAL_ISOMETRIC_COMPONENT_SCALE;
  return [target[0] + component, target[1] + component, target[2] + component];
}

/**
 * Returns an object-relative approach direction for exact-location evidence.
 *
 * Authored LabSpace assets expose their cabinet/drawer facade on local +Z.
 * The physical facade is authoritative. Only the small lateral offset may
 * favor room context; the front must never be flipped toward the room centre.
 */
export function digitalTwinCameraApproach({
  roomWidthMm,
  roomDepthMm,
  objectXmm,
  objectYmm,
  objectRotationDeg,
  face = { x: 0, z: 1 },
  flipHorizontal = false,
  flipVertical = false,
}: DigitalTwinCameraApproachInput): DigitalTwinCameraApproach {
  const angle = (-objectRotationDeg * Math.PI) / 180;
  const localX = face.x * (flipHorizontal ? -1 : 1);
  const localZ = face.z * (flipVertical ? -1 : 1);
  const forwardX = localX * Math.cos(angle) + localZ * Math.sin(angle);
  const forwardZ = -localX * Math.sin(angle) + localZ * Math.cos(angle);
  let lateralX = forwardZ;
  let lateralZ = -forwardX;

  const inwardX = roomWidthMm / 2 - objectXmm;
  const inwardZ = roomDepthMm / 2 - objectYmm;
  const inwardLength = Math.hypot(inwardX, inwardZ);

  if (inwardLength > 1) {
    const normalizedInwardX = inwardX / inwardLength;
    const normalizedInwardZ = inwardZ / inwardLength;
    if (lateralX * normalizedInwardX + lateralZ * normalizedInwardZ < 0) {
      lateralX *= -1;
      lateralZ *= -1;
    }
  }

  return { forwardX, forwardZ, lateralX, lateralZ };
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

/**
 * Keeps exact-location evidence close enough to read. A wide host asset must
 * not multiply the camera distance without limit: the selected drawer or
 * shelf remains the subject, while the room stays as supporting context.
 */
export function digitalTwinFocusDistance({
  roomExtent,
  focusedEnvelope,
  exactLocation,
}: {
  roomExtent: number;
  focusedEnvelope: number;
  exactLocation: boolean;
}) {
  if (exactLocation) {
    const roomCap = Math.min(6.4, Math.max(4.6, roomExtent * 0.72));
    return Math.min(roomCap, Math.max(3.8, focusedEnvelope * 1.45 + 1));
  }
  const roomCap = Math.min(7.4, Math.max(5, roomExtent * 0.84));
  return Math.min(roomCap, Math.max(4.2, focusedEnvelope * 1.85 + 1.2));
}

function segmentBoxInterval(
  camera: { x: number; z: number },
  target: { x: number; z: number },
  obstacle: DigitalTwinFocusObstacle,
) {
  const deltaX = target.x - camera.x;
  const deltaZ = target.z - camera.z;
  let near = 0;
  let far = 1;
  const axes = [
    { start: camera.x, delta: deltaX, minimum: obstacle.minX, maximum: obstacle.maxX },
    { start: camera.z, delta: deltaZ, minimum: obstacle.minZ, maximum: obstacle.maxZ },
  ];

  for (const axis of axes) {
    if (Math.abs(axis.delta) < 1e-8) {
      if (axis.start < axis.minimum || axis.start > axis.maximum) return null;
      continue;
    }
    const first = (axis.minimum - axis.start) / axis.delta;
    const second = (axis.maximum - axis.start) / axis.delta;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (near > far) return null;
  }
  return { near, far };
}

function obstacleBlocksSightline(
  camera: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  obstacle: DigitalTwinFocusObstacle,
) {
  const interval = segmentBoxInterval(camera, target, obstacle);
  if (!interval || interval.far <= 0.035 || interval.near >= 0.985) return false;
  const near = clamp(interval.near, 0, 1);
  const far = clamp(interval.far, 0, 1);
  const nearHeight = camera.y + (target.y - camera.y) * near;
  const farHeight = camera.y + (target.y - camera.y) * far;
  const sightlineBottom = Math.min(nearHeight, farHeight);
  const sightlineTop = Math.max(nearHeight, farHeight);
  return sightlineTop >= obstacle.minY - 0.06 && sightlineBottom <= obstacle.maxY + 0.1;
}

function distanceToRoomEdge(
  target: { x: number; z: number },
  direction: { x: number; z: number },
  roomWidth: number,
  roomDepth: number,
) {
  const halfWidth = Math.max(0.4, roomWidth / 2 - 0.35);
  const halfDepth = Math.max(0.4, roomDepth / 2 - 0.35);
  const candidates: number[] = [];
  if (direction.x > 1e-6) candidates.push((halfWidth - target.x) / direction.x);
  if (direction.x < -1e-6) candidates.push((-halfWidth - target.x) / direction.x);
  if (direction.z > 1e-6) candidates.push((halfDepth - target.z) / direction.z);
  if (direction.z < -1e-6) candidates.push((-halfDepth - target.z) / direction.z);
  const positive = candidates.filter((value) => Number.isFinite(value) && value > 0);
  return positive.length ? Math.min(...positive) : 0;
}

/**
 * Selects a camera position on the authored front hemisphere, preferring the
 * clear side of nearby furniture. Candidates stay inside the room where the
 * available aisle permits it; no object visibility or saved geometry changes.
 */
export function chooseDigitalTwinFocusCameraPosition({
  target,
  desiredDistance,
  approach,
  roomWidth,
  roomDepth,
  exactLocation,
  obstacles = [],
}: {
  target: { x: number; y: number; z: number };
  desiredDistance: number;
  approach: DigitalTwinCameraApproach;
  roomWidth: number;
  roomDepth: number;
  exactLocation: boolean;
  obstacles?: readonly DigitalTwinFocusObstacle[];
}): DigitalTwinFocusCameraPosition {
  const lateralBiases = [0.22, -0.22, 0.44, -0.44, 0];
  const minimumDistance = exactLocation ? 1.65 : 2.15;
  const candidates = lateralBiases.map((lateralBias, preferenceIndex) => {
    const rawX = approach.forwardX * 0.94 + approach.lateralX * lateralBias;
    const rawZ = approach.forwardZ * 0.94 + approach.lateralZ * lateralBias;
    const length = Math.max(1e-6, Math.hypot(rawX, rawZ));
    const direction = { x: rawX / length, z: rawZ / length };
    const availableDistance = distanceToRoomEdge(target, direction, roomWidth, roomDepth);
    const distance = Math.min(
      desiredDistance,
      Math.max(minimumDistance, availableDistance || desiredDistance),
    );
    const rise = exactLocation
      ? clamp(distance * 0.44, 1.05, 2.05)
      : clamp(distance * 0.46, 1.25, 2.45);
    const position = {
      x: target.x + direction.x * distance,
      y: target.y + rise,
      z: target.z + direction.z * distance,
    };
    const blockerIds = obstacles
      .filter((obstacle) => obstacleBlocksSightline(position, target, obstacle))
      .map((obstacle) => obstacle.id);
    const outsidePenalty = Math.max(0, minimumDistance - availableDistance) * 20;
    return {
      ...position,
      lateralBias,
      blockerIds,
      score: blockerIds.length * 100 + outsidePenalty + preferenceIndex * 0.08,
    };
  });

  const selected = candidates.sort((first, second) => first.score - second.score)[0];
  return {
    x: selected.x,
    y: selected.y,
    z: selected.z,
    lateralBias: selected.lateralBias,
    blockerIds: selected.blockerIds,
  };
}

/**
 * Returns the complete set of inputs that are allowed to reframe the 3D view.
 * Scene geometry and object transforms are intentionally absent: editing the
 * room updates what is rendered, not how the user is looking at it.
 */
export function cameraCommandKey({
  roomId,
  presentation,
  preset,
  focusObjectId,
  focusLocationId,
}: CameraCommandInput) {
  return [roomId, presentation, preset, focusObjectId ?? "room", focusLocationId ?? "object"].join(
    ":",
  );
}
