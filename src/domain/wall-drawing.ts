export type WallPoint = { x: number; y: number };

export type WallSegment = {
  start: WallPoint;
  end: WallPoint;
};

/**
 * Advances a click-to-click wall chain. The first click only establishes the
 * start point; each later valid click emits one segment and becomes the start
 * of the next segment.
 */
export function advanceWallChain(
  currentStart: WallPoint | null,
  point: WallPoint,
  minimumLength = 1,
): { nextStart: WallPoint; segment: WallSegment | null } {
  if (!currentStart) return { nextStart: point, segment: null };

  const length = Math.hypot(point.x - currentStart.x, point.y - currentStart.y);
  if (length < minimumLength) return { nextStart: currentStart, segment: null };

  return {
    nextStart: point,
    segment: { start: currentStart, end: point },
  };
}
