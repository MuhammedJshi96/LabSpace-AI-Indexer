import rigs from "./storage-rigs.json";
import type { StorageLocation } from "./schema";
import { storageLocationHighlight } from "./storage-highlight";

export type StorageMechanism = {
  id: string;
  kind: string;
  bay: string;
  angle: number;
  travel: number;
  region: { x: number; y: number; z: number; width: number; height: number };
};
type Rig = { parts: StorageMechanism[]; shelfLevels: number[] };
export type StorageAccess = {
  parts: StorageMechanism[];
  description: string;
  reason: string | null;
  region: StorageMechanism["region"] | null;
};
const unavailable = (reason: string): StorageAccess => ({
  parts: [],
  description: "Access preview unavailable",
  reason,
  region: null,
});

function nestedRegion(
  region: StorageMechanism["region"],
  ancestor: StorageLocation,
  selected: StorageLocation,
  locations: readonly StorageLocation[],
) {
  if (ancestor.id === selected.id) return region;
  const dimensions = { width: 1000, depth: 1000, height: 1000 };
  const parent = storageLocationHighlight(ancestor.id, ancestor.objectId, locations, dimensions);
  const child = storageLocationHighlight(selected.id, selected.objectId, locations, dimensions);
  if (!parent || !child) return region;
  return {
    ...region,
    x: region.x + ((child.position[0] - parent.position[0]) / parent.width) * region.width,
    y: region.y + ((child.position[1] - parent.position[1]) / parent.height) * region.height,
    width: (region.width * child.width) / parent.width,
    height: (region.height * child.height) / parent.height,
  };
}

/** Resolve saved storage identities to actual authored moving parts. No writes,
 * fabricated inventory, reindexing, or assumptions about a generic door count. */
export function resolveStorageAccess(
  assetId: string,
  objectId: string,
  locationId: string | null,
  locations: readonly StorageLocation[],
): StorageAccess {
  const rig = (rigs as Record<string, Rig>)[assetId];
  if (!rig)
    return unavailable(
      "This asset has no verified opening mechanism. Its exact location remains highlighted.",
    );
  const selected = locations.find(
    (location) => location.id === locationId && location.objectId === objectId,
  );
  if (!selected) return unavailable("Select a stored shelf, compartment, or drawer first.");
  const chain: StorageLocation[] = [];
  const visited = new Set<string>();
  let current: StorageLocation | undefined = selected;
  while (current && current.objectId === objectId && !visited.has(current.id)) {
    visited.add(current.id);
    chain.unshift(current);
    current = locations.find((location) => location.id === current?.parentId);
  }
  const drawer = chain.find((location) => location.type === "drawer");
  if (drawer) {
    const drawers = rig.parts.filter((part) => part.kind === "drawer");
    const siblings = locations
      .filter(
        (location) =>
          location.objectId === objectId &&
          location.parentId === drawer.parentId &&
          location.type === "drawer",
      )
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    let part: StorageMechanism | undefined;
    if (drawer.normalizedBounds) {
      const region = storageLocationHighlight(drawer.id, objectId, locations, {
        width: 1000,
        height: 1000,
        depth: 1000,
      });
      if (region) {
        const [x, y] = region.position;
        part = drawers
          .filter(
            (candidate) =>
              Math.abs(candidate.region.x - x) <= candidate.region.width / 2 + 0.04 &&
              Math.abs(candidate.region.y + candidate.region.height / 2 - y - region.height / 2) <=
                candidate.region.height / 2 + 0.05,
          )
          .sort(
            (a, b) =>
              Math.abs(a.region.y + a.region.height / 2 - y - region.height / 2) -
              Math.abs(b.region.y + b.region.height / 2 - y - region.height / 2),
          )[0];
      }
    } else if (siblings.length <= drawers.length) {
      part = [...drawers].sort((a, b) => b.region.y - a.region.y || a.region.x - b.region.x)[
        siblings.indexOf(drawer)
      ];
    }
    if (!part)
      return unavailable(
        "The saved drawer layout does not match this model's physical drawers. No opening is invented and your records are unchanged.",
      );
    return {
      parts: [part],
      description: "1 drawer · tray and front move together",
      reason: null,
      region: nestedRegion(part.region, drawer, selected, locations),
    };
  }
  const doors = rig.parts.filter((part) => part.kind === "hinge");
  if (!doors.length)
    return unavailable(
      "This model has drawers, not a hinged door. Select a drawer to preview access.",
    );
  let candidates = doors;
  const compartment = chain.find(
    (location) => location.normalizedBounds && ["compartment", "cabinet"].includes(location.type),
  );
  if (compartment) {
    const bounds = storageLocationHighlight(compartment.id, objectId, locations, {
      width: 1000,
      height: 1000,
      depth: 1000,
    });
    if (bounds) {
      const nearest = [...doors].sort(
        (a, b) =>
          Math.abs(a.region.x - bounds.position[0]) - Math.abs(b.region.x - bounds.position[0]),
      )[0];
      candidates = doors.filter((part) => part.bay === nearest.bay);
    }
  } else if (new Set(doors.map((part) => part.bay)).size > 1) {
    return unavailable(
      "Choose a cabinet compartment so its door pair can be identified precisely.",
    );
  }
  const minX = Math.min(...candidates.map((part) => part.region.x - part.region.width / 2));
  const maxX = Math.max(...candidates.map((part) => part.region.x + part.region.width / 2));
  const region = {
    x: (minX + maxX) / 2,
    y: Math.min(...candidates.map((part) => part.region.y)),
    z: candidates[0].region.z,
    width: maxX - minX,
    height: Math.max(...candidates.map((part) => part.region.height)),
  };
  const shelf = chain.find((location) => location.type === "shelf");
  if (shelf && rig.shelfLevels.length) {
    const siblings = locations
      .filter(
        (location) =>
          location.objectId === objectId &&
          location.parentId === shelf.parentId &&
          location.type === "shelf",
      )
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    const level = rig.shelfLevels[siblings.indexOf(shelf)];
    if (level === undefined)
      return unavailable(
        "The saved shelf count exceeds this model's physical shelves. Your storage records are unchanged.",
      );
    region.y = level + 0.016;
    region.height = Math.max(
      0.06,
      (rig.shelfLevels[siblings.indexOf(shelf) - 1] ?? 0.94) - region.y - 0.018,
    );
    region.width *= 0.94;
  }
  return {
    parts: candidates,
    description: `${candidates.length} hinged doors${rig.shelfLevels.length ? ` · ${rig.shelfLevels.length} fixed internal shelves` : " · cabinet interior"}`,
    reason: null,
    region,
  };
}
