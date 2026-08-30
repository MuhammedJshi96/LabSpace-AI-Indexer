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
