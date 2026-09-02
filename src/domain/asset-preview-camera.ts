export type AssetPreviewView = "isometric" | "front" | "back" | "left" | "right" | "top";

const ASSET_PREVIEW_DIRECTIONS: Record<AssetPreviewView, readonly [number, number, number]> = {
  isometric: [1.25, 0.9, 1.6],
  front: [0, 0, 1],
  back: [0, 0, -1],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  // The tiny forward component keeps the look-at basis deterministic while
  // retaining the familiar front-at-bottom orientation in a true top view.
  top: [0, 1, 0.0001],
};

/** Fit the complete asset envelope, including in a tall, narrow studio pane. */
export function assetPreviewCameraDistance(
  dimensions: { width: number; depth: number; height: number },
  aspect: number,
  verticalFovDegrees = 36,
) {
  const radius = Math.hypot(dimensions.width, dimensions.depth, dimensions.height) / 2;
  const verticalHalfFov = (verticalFovDegrees * Math.PI) / 360;
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * Math.max(0.1, aspect));
  return (Math.max(radius, 0.1) * 1.18) / Math.sin(Math.min(verticalHalfFov, horizontalHalfFov));
}

/**
 * Resolve a preset to one deterministic world-space pose. Keeping this outside
 * the React/OrbitControls lifecycle lets tests verify that product fronts and
 * tops cannot silently swap axes as authored GLBs change.
 */
export function assetPreviewCameraPose(
  view: AssetPreviewView,
  dimensions: { width: number; depth: number; height: number },
  aspect: number,
) {
  const distance = assetPreviewCameraDistance(dimensions, aspect);
  const direction = ASSET_PREVIEW_DIRECTIONS[view];
  const directionLength = Math.hypot(...direction);
  const target = [0, dimensions.height / 2, 0] as const;
  const scale = distance / directionLength;

  return {
    distance,
    target,
    position: [
      target[0] + direction[0] * scale,
      target[1] + direction[1] * scale,
      target[2] + direction[2] * scale,
    ] as const,
  };
}
