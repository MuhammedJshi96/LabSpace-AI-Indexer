import rigs from "./storage-rigs.json" with { type: "json" };
import type { StorageLocation } from "./schema";
import { storageLocationHighlight } from "./storage-highlight";

export type StorageMechanism = {
  id: string;
  kind: string;
  bay: string;
  angle: number;
  travel: number;
  translation?: [number, number, number];
  region: { x: number; y: number; z: number; width: number; height: number; depth?: number };
};
export type StorageAnatomyLocation = {
  key: string;
  name: string;
  type: "drawer" | "shelf" | "compartment";
  parentKey?: string;
  region: StorageMechanism["region"];
  partIds: string[];
};
type Rig = {
  parts: StorageMechanism[];
  shelfLevels: number[];
  locations?: StorageAnatomyLocation[];
};
export const STORAGE_RIGS = rigs as unknown as Record<string, Rig>;
export function storageOpeningParts(parts: StorageMechanism[]) {
  if (parts[0]?.kind !== "slide") return parts;
  return [[...parts].sort((a, b) => b.region.z - a.region.z || a.region.x - b.region.x)[0]];
}
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

/** Compatibility with the original generated location names. Do not interpret
 * arbitrary user labels, unknown counts or multi-bank drawer orders as anatomy. */
function legacyAnatomySlot(assetId: string, location: StorageLocation, rig: Rig) {
  if (location.anatomyKey || location.normalizedBounds) return undefined;
  if (assetId === "glazed-sliding-cabinet" && location.type === "compartment") {
    const key = (
      { "upper compartment": "bay:Upper glass", "lower compartment": "bay:Lower steel" } as Record<
        string,
        string
      >
    )[location.name.trim().toLowerCase()];
    if (key) return rig.locations?.find((slot) => slot.key === key);
  }
  const ordinal =
    location.type === "drawer" && /^drawer\s+0*([1-9]\d*)$/i.exec(location.name.trim());
  const drawers =
    rig.locations
      ?.filter((slot) => slot.type === "drawer")
      .sort((a, b) => b.region.y - a.region.y) ?? [];
  const oneBank =
    drawers.length &&
    drawers.every(
      (slot) =>
        Math.abs(slot.region.x - drawers[0].region.x) < 0.02 &&
        Math.abs(slot.region.z - drawers[0].region.z) < 0.02,
    );
  if (ordinal && oneBank) return drawers[Number(ordinal[1]) - 1];
  return undefined;
}

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
  const rig = STORAGE_RIGS[assetId];
  if (!rig)
    return unavailable(
      "This asset has no verified opening mechanism. Its exact location remains highlighted.",
    );
  const selected = locations.find(
    (location) => location.id === locationId && location.objectId === objectId,
  );
  if (!selected) return unavailable("Select a stored shelf, compartment, or drawer first.");
  if (selected.anatomyKey && !rig.locations?.some((slot) => slot.key === selected.anatomyKey))
    return unavailable(
      "This location's saved physical link is no longer present. Link it to a real drawer or shelf in Storage.",
    );
  const chain: StorageLocation[] = [];
  const visited = new Set<string>();
  let current: StorageLocation | undefined = selected;
  while (current && current.objectId === objectId && !visited.has(current.id)) {
    visited.add(current.id);
    chain.unshift(current);
    current = locations.find((location) => location.id === current?.parentId);
  }
  const bound = [...chain]
    .reverse()
    .find(
      (location) =>
        (location.anatomyKey && rig.locations?.some((slot) => slot.key === location.anatomyKey)) ||
        (!location.anatomyKey &&
          rig.locations?.filter(
            (slot) =>
              slot.type === location.type &&
              slot.name.toLowerCase() === location.name.toLowerCase(),
          ).length === 1) ||
        legacyAnatomySlot(assetId, location, rig),
    );
  if (bound) {
    const slot =
      legacyAnatomySlot(assetId, bound, rig) ??
      rig.locations!.find((slot) =>
        bound.anatomyKey
          ? slot.key === bound.anatomyKey
          : slot.type === bound.type && slot.name.toLowerCase() === bound.name.toLowerCase(),
      )!;
    const parts = storageOpeningParts(rig.parts.filter((part) => slot.partIds.includes(part.id)));
    const description =
      parts.length === 0
        ? "Open shelf · directly accessible"
        : parts[0].kind === "drawer"
          ? "1 drawer · tray and front move together"
          : parts[0].kind === "slide"
            ? "1 sliding panel · moves along its track"
            : `${parts.length} hinged door${parts.length === 1 ? "" : "s"} · fixed interior shelves`;
    return {
      parts,
      description,
      reason: parts.length ? null : "This is open storage; no door needs to be opened.",
      region: nestedRegion(slot.region, bound, selected, locations),
    };
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
  const doors = rig.parts.filter((part) => part.kind === "hinge" || part.kind === "slide");
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
  } else if (selected.type === "cabinet" && !selected.parentId) {
    // A cabinet-root preview may expose its actual doors across every bay.
    // Sliders still open only one leaf per track; no drawer location is invented.
    candidates = [...new Set(doors.map((part) => part.bay))].flatMap((bay) =>
      storageOpeningParts(doors.filter((part) => part.bay === bay)),
    );
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
  // Sliding leaves share tracks: open one toward its stationary neighbour,
  // never cross both leaves through one another.
  if (candidates[0]?.kind === "slide" && selected.parentId)
    candidates = storageOpeningParts(candidates);
  return {
    parts: candidates,
    description: `${candidates.length} ${candidates[0]?.kind === "slide" ? "sliding panels" : "hinged doors"}${rig.shelfLevels.length ? ` · ${rig.shelfLevels.length} fixed internal shelves` : " · cabinet interior"}`,
    reason: null,
    region,
  };
}
