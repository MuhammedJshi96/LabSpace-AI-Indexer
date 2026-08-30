import type { SceneObject, StorageLocation } from "./schema";
import { STORAGE_RIGS, type StorageMechanism } from "./storage-access";

export type StorageFace = "front" | "back" | "left" | "right";
export type StorageMapSlot = {
  key: string;
  parentKey?: string;
  face: StorageFace;
  type: "drawer" | "shelf" | "compartment";
  x: number;
  y: number;
  width: number;
  height: number;
  location: StorageLocation | null;
  partIds: string[];
};

/** Keep numbered targets distinct even in dense casework. The caller may scroll
 * a large map instead of shrinking physical drawer spacing below target size. */
export function storageMapMinimumWidth(
  slots: readonly StorageMapSlot[],
  objectWidth: number,
  objectHeight: number,
  focusWidth = 1,
) {
  let pixelsPerMm = 0;
  for (let a = 0; a < slots.length; a++) {
    for (let b = a + 1; b < slots.length; b++) {
      const dx =
        (slots[a].x + slots[a].width / 2 - (slots[b].x + slots[b].width / 2)) * objectWidth;
      const dy =
        (slots[a].y + slots[a].height / 2 - (slots[b].y + slots[b].height / 2)) * objectHeight;
      const distance = Math.hypot(dx, dy);
      if (distance > 0.001) pixelsPerMm = Math.max(pixelsPerMm, 32 / distance);
    }
  }
  return Math.ceil(objectWidth * focusWidth * pixelsPerMm);
}

/** Object-local elevation, independent of room rotation. Sliding travel is along
 * a track, not a face normal, so use its physical facade for orientation. */
function faceFor(parts: StorageMechanism[], region: StorageMechanism["region"]): StorageFace {
  const part = parts[0];
  const direction = part?.kind !== "slide" ? part?.translation : undefined;
  if (direction && Math.abs(direction[0]) > Math.abs(direction[2]))
    return direction[0] < 0 ? "left" : "right";
  if (direction && Math.abs(direction[2]) > 0.0001) return direction[2] < 0 ? "back" : "front";
  if (region.width < (region.depth ?? 0) * 0.25) return region.x < 0 ? "left" : "right";
  return region.z < -0.15 ? "back" : "front";
}

/** Read-only projection of delivered anatomy. Only explicit, unique canonical
 * bindings are clickable; missing/custom/ambiguous records stay in the list. */
export function buildStorageMap(object: SceneObject, locations: readonly StorageLocation[]) {
  const rig = STORAGE_RIGS[object.assetDefinitionId];
  const objectLocations = locations.filter((location) => location.objectId === object.id);
  const slots: StorageMapSlot[] = (rig?.locations ?? [])
    .map((slot) => {
      const matches = objectLocations.filter((location) => location.anatomyKey === slot.key);
      const parts = rig.parts.filter((part) => slot.partIds.includes(part.id));
      const face = faceFor(parts, slot.region);
      const side = face === "left" || face === "right";
      const width = side ? (slot.region.depth ?? 0) : slot.region.width;
      const center = side
        ? slot.region.z * (face === "right" ? -1 : 1)
        : slot.region.x * (face === "back" ? -1 : 1);
      return {
        key: slot.key,
        parentKey: slot.parentKey,
        face,
        type: slot.type,
        x: 0.5 + center - width / 2,
        y: 1 - slot.region.y - slot.region.height,
        width,
        height: slot.region.height,
        location: matches.length === 1 ? matches[0] : null,
        partIds: slot.partIds,
      };
    })
    .filter(
      (slot) =>
        [slot.x, slot.y, slot.width, slot.height].every(Number.isFinite) &&
        slot.width > 0 &&
        slot.height > 0,
    );
  const mapped = new Set(slots.flatMap((slot) => (slot.location ? [slot.location.id] : [])));
  return {
    slots,
    faces: (["front", "back", "left", "right"] as StorageFace[]).filter((face) =>
      slots.some((slot) => slot.face === face),
    ),
    unlinked: objectLocations.filter((location) => location.parentId && !mapped.has(location.id)),
  };
}
