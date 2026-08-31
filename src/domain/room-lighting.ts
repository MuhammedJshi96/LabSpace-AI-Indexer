/** One shadowed overhead key, diffuse fill and the cached studio environment.
 * Fit the shadow camera to the room instead of cropping every room at ±8 m. */
export function roomLightingLayout(widthMm: number, depthMm: number, heightMm: number) {
  const width = Math.max(1, widthMm / 1000);
  const depth = Math.max(1, depthMm / 1000);
  const height = Math.max(2.4, heightMm / 1000);
  const diagonal = Math.hypot(width, depth);
  const extent = diagonal / 2 + height + 1;
  return {
    keyPosition: [width * 0.22, Math.max(10, diagonal + height * 2), depth * 0.3] as [
      number,
      number,
      number,
    ],
    shadowExtent: extent,
    shadowFar: Math.max(30, diagonal * 3 + height * 3),
    environmentIntensity: 0.65,
    keyIntensity: 1.35,
    shadowIntensity: 0.72,
    contactFar: 0.7,
  };
}
