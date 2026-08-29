export const FACILITY_FLOORS = Array.from({ length: 15 }, (_, index) => index + 1);

/**
 * Resolve common room-number conventions into a physical building floor.
 * Examples: 813 and R809 belong to Floor 8, while DEMO-01 belongs to Floor 1.
 */
export function inferFacilityFloorFromRoomCode(code: string) {
  const matches = code.match(/\d+/g);
  if (!matches?.length) return null;
  const numeric = Number(matches.at(-1));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const inferred = numeric >= 100 ? Math.floor(numeric / 100) : numeric;
  return inferred >= 1 && inferred <= 15 ? inferred : null;
}
