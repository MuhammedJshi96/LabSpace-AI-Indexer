export const FACILITY_FLOORS = Array.from({ length: 15 }, (_, index) => index + 1);

export type FacilityRoomLayoutInput = {
  id: string;
  widthMm: number;
  depthMm: number;
  xMm: number;
  yMm: number;
  rotationDeg: number;
};

export type FacilityRoomLayoutEntry = {
  id: string;
  x: number;
  z: number;
  footprintWidth: number;
  footprintDepth: number;
};

export type FacilityFloorBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

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

function rotatedFootprint(room: FacilityRoomLayoutInput) {
  const width = room.widthMm / 1000;
  const depth = room.depthMm / 1000;
  const radians = (room.rotationDeg * Math.PI) / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  return {
    width: width * cosine + depth * sine,
    depth: width * sine + depth * cosine,
  };
}

function rawLayoutEntry(room: FacilityRoomLayoutInput): FacilityRoomLayoutEntry {
  const footprint = rotatedFootprint(room);
  return {
    id: room.id,
    x: room.xMm / 1000 + room.widthMm / 2000,
    z: room.yMm / 1000 + room.depthMm / 2000,
    footprintWidth: footprint.width,
    footprintDepth: footprint.depth,
  };
}

function entriesOverlap(
  first: FacilityRoomLayoutEntry,
  second: FacilityRoomLayoutEntry,
  clearance: number,
) {
  return (
    Math.abs(first.x - second.x) < (first.footprintWidth + second.footprintWidth) / 2 + clearance &&
    Math.abs(first.z - second.z) < (first.footprintDepth + second.footprintDepth) / 2 + clearance
  );
}

function normalizeLayout(entries: FacilityRoomLayoutEntry[]) {
  const bounds = facilityFloorBounds(entries);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  return entries.map((entry) => ({ ...entry, x: entry.x - centerX, z: entry.z - centerZ }));
}

/**
 * Preserve valid saved room coordinates, but replace intersecting placements
 * with a deterministic, clearance-aware grid for the shared floor view.
 */
export function resolveFacilityFloorLayout(
  rooms: FacilityRoomLayoutInput[],
  clearanceMetres = 1.2,
) {
  if (!rooms.length) return [];
  const raw = rooms.map(rawLayoutEntry);
  const hasConflict = raw.some((entry, index) =>
    raw.slice(index + 1).some((candidate) => entriesOverlap(entry, candidate, clearanceMetres)),
  );
  if (!hasConflict) return normalizeLayout(raw);

  const footprints = rooms.map(rotatedFootprint);
  let nextLeftEdge = 0;
  const packed = rooms.map((room, index) => {
    const footprint = footprints[index];
    const entry = {
      id: room.id,
      x: nextLeftEdge + footprint.width / 2,
      z: footprint.depth / 2,
      footprintWidth: footprint.width,
      footprintDepth: footprint.depth,
    };
    nextLeftEdge += footprint.width + clearanceMetres;
    return entry;
  });
  return normalizeLayout(packed);
}

export function facilityFloorBounds(entries: FacilityRoomLayoutEntry[]): FacilityFloorBounds {
  if (!entries.length) return { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };
  return {
    minX: Math.min(...entries.map((entry) => entry.x - entry.footprintWidth / 2)),
    maxX: Math.max(...entries.map((entry) => entry.x + entry.footprintWidth / 2)),
    minZ: Math.min(...entries.map((entry) => entry.z - entry.footprintDepth / 2)),
    maxZ: Math.max(...entries.map((entry) => entry.z + entry.footprintDepth / 2)),
  };
}

/** Place a room to the right of the current floor envelope without moving peers. */
export function nextFacilityRoomPlacement(
  existingRooms: FacilityRoomLayoutInput[],
  room: FacilityRoomLayoutInput,
  clearanceMm = 1200,
) {
  if (!existingRooms.length) return { x: 0, y: 0 };
  const existing = existingRooms.map(rawLayoutEntry);
  const candidate = rotatedFootprint(room);
  const rightEdge = Math.max(...existing.map((entry) => entry.x + entry.footprintWidth / 2));
  const nearEdge = Math.min(...existing.map((entry) => entry.z - entry.footprintDepth / 2));
  const centerX = rightEdge + clearanceMm / 1000 + candidate.width / 2;
  const centerZ = nearEdge + candidate.depth / 2;
  return {
    x: Math.round((centerX - room.widthMm / 2000) * 1000),
    y: Math.round((centerZ - room.depthMm / 2000) * 1000),
  };
}
