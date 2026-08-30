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
};

export type DigitalTwinCameraApproach = {
  forwardX: number;
  forwardZ: number;
  lateralX: number;
  lateralZ: number;
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
 * The approach rotates with that facade, then chooses the equivalent inward-
 * facing side for perimeter casework so a disabled wall cutaway does not leave
 * the camera looking at the back of a cabinet from outside the room.
 */
export function digitalTwinCameraApproach({
  roomWidthMm,
  roomDepthMm,
  objectXmm,
  objectYmm,
  objectRotationDeg,
}: DigitalTwinCameraApproachInput): DigitalTwinCameraApproach {
  const angle = (-objectRotationDeg * Math.PI) / 180;
  let forwardX = Math.sin(angle);
  let forwardZ = Math.cos(angle);
  let lateralX = Math.cos(angle);
  let lateralZ = -Math.sin(angle);

  const inwardX = roomWidthMm / 2 - objectXmm;
  const inwardZ = roomDepthMm / 2 - objectYmm;
  const inwardLength = Math.hypot(inwardX, inwardZ);

  if (inwardLength > 1) {
    const normalizedInwardX = inwardX / inwardLength;
    const normalizedInwardZ = inwardZ / inwardLength;
    if (forwardX * normalizedInwardX + forwardZ * normalizedInwardZ < 0) {
      forwardX *= -1;
      forwardZ *= -1;
    }
    if (lateralX * normalizedInwardX + lateralZ * normalizedInwardZ < 0) {
      lateralX *= -1;
      lateralZ *= -1;
    }
  }

  return { forwardX, forwardZ, lateralX, lateralZ };
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
