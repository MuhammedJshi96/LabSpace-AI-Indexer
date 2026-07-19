import { mmToMetres } from "./geometry";
import type { Dimensions, InventoryItem, StorageLocation, StorageLocationType } from "./schema";

export type StorageHighlight = {
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
};

export type StorageAccessContentStyle = "boxes" | "vials" | "glassware" | "bottles";

export function storageAccessContentStyle(
  selectedLocationId: string | null,
  locations: readonly StorageLocation[],
  inventoryItems: readonly InventoryItem[],
): StorageAccessContentStyle {
  if (!selectedLocationId) return "boxes";
  const descendantIds = new Set([selectedLocationId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const location of locations) {
      if (
        location.parentId &&
        descendantIds.has(location.parentId) &&
        !descendantIds.has(location.id)
      ) {
        descendantIds.add(location.id);
        changed = true;
      }
    }
  }
  const evidence = inventoryItems
    .filter((item) => item.storageLocationId && descendantIds.has(item.storageLocationId))
    .map((item) => `${item.name} ${item.notes} ${item.unit}`.toLowerCase())
    .join(" ");

  if (/\b(vial|autosampler|hplc|lc-ms)\b/.test(evidence)) return "vials";
  if (/\b(flask|glassware|beaker|cylinder|condenser)\b/.test(evidence)) return "glassware";
  if (/\b(bottle|reagent|solvent|buffer|standard)\b/.test(evidence)) return "bottles";
  return "boxes";
}

export function storageLocationSupportsAccessPreview(type: StorageLocationType) {
  return type === "drawer" || type === "bin" || type === "shelf" || type === "compartment";
}

export function storageLocationHighlight(
  selectedLocationId: string | null,
  objectId: string,
  locations: readonly StorageLocation[],
  dimensions: Dimensions,
): StorageHighlight | null {
  if (!selectedLocationId) return null;
  const selected = locations.find(
    (location) => location.id === selectedLocationId && location.objectId === objectId,
  );
  if (!selected) return null;

  const byId = new Map(locations.map((location) => [location.id, location]));
  const chain: StorageLocation[] = [];
  const visited = new Set<string>();
  let cursor: StorageLocation | undefined = selected;
  while (cursor && cursor.objectId === objectId && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    chain.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }

  let region = {
    x: 0,
    y: 0,
    z: 0,
    width: mmToMetres(dimensions.width),
    depth: mmToMetres(dimensions.depth),
    height: mmToMetres(dimensions.height),
  };

  for (const location of chain.slice(1)) {
    if (location.normalizedBounds) {
      const bounds = location.normalizedBounds;
      region = {
        x: region.x + bounds.x * region.width,
        y: region.y + bounds.y * region.height,
        z: region.z + bounds.z * region.depth,
        width: region.width * bounds.width,
        depth: region.depth * bounds.depth,
        height: region.height * bounds.height,
      };
      continue;
    }

    const siblings = locations
      .filter(
        (entry) =>
          entry.objectId === objectId &&
          entry.parentId === location.parentId &&
          entry.type === location.type,
      )
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    const siblingIndex = Math.max(
      0,
      siblings.findIndex((entry) => entry.id === location.id),
    );
    const siblingCount = Math.max(1, siblings.length);

    if (location.type === "bin") {
      const slotWidth = region.width / siblingCount;
      region = {
        x: region.x - region.width / 2 + slotWidth * (siblingIndex + 0.5),
        y: region.y + region.height * 0.16,
        z: region.z + region.depth * 0.08,
        width: slotWidth * 0.72,
        depth: region.depth * 0.72,
        height: region.height * 0.62,
      };
      continue;
    }

    const usableHeight = region.height * 0.82;
    const slotHeight = usableHeight / siblingCount;
    region = {
      x: region.x,
      y: region.y + region.height * 0.09 + usableHeight - slotHeight * (siblingIndex + 1),
      z: region.z + region.depth * 0.025,
      width: region.width * 0.9,
      depth: region.depth * 0.94,
      height: slotHeight * 0.82,
    };
  }

  return {
    position: [region.x, region.y, region.z],
    width: Math.max(0.08, region.width),
    depth: Math.max(0.08, region.depth),
    height: Math.max(0.08, region.height),
  };
}
