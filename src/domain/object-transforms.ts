export const MAX_RAISED_FROM_FLOOR_MM = 30_000;

export function normalizeRaisedFromFloorMm(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return normalizeRaisedFromFloorMm(fallback, 0);
  return Math.min(MAX_RAISED_FROM_FLOOR_MM, Math.max(0, numeric));
}
