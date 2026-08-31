import storageRigs from "./storage-rigs.json" with { type: "json" };
import type { StorageAnatomyLocation } from "./storage-access";
import type { AssetDefinition, SceneObject, StorageLocation } from "./schema";
import { generateChildIndexCode } from "./indexing";

/** Generate assignable locations from delivered geometry, not generic counts. */
export function authoredStorageTemplate(assetId: string): AssetDefinition["storageTemplate"] {
  const slots = (storageRigs as unknown as Record<string, { locations: StorageAnatomyLocation[] }>)[
    assetId
  ]?.locations;
  if (!slots?.length) return undefined;
  return slots.map((slot) => {
    const r = slot.region;
    const parent = slots.find((entry) => entry.key === slot.parentKey)?.region;
    return {
      key: slot.key,
      anatomyKey: slot.key,
      parentKey: slot.parentKey,
      type: slot.type,
      name: slot.name,
      normalizedBounds: {
        x: parent ? (r.x - parent.x) / parent.width : r.x,
        y: parent ? (r.y - parent.y) / parent.height : r.y,
        z: parent ? (r.z - parent.z) / (parent.depth ?? 0.03) : r.z,
        width: parent ? r.width / parent.width : r.width,
        depth: parent ? (r.depth ?? 0.03) / (parent.depth ?? 0.03) : (r.depth ?? 0.03),
        height: parent ? Math.min(1, r.height / parent.height) : r.height,
      },
    };
  });
}

/** Add missing anatomy only. Existing IDs, names, custom bins and assignments
 * survive. Unique matches acquire a binding; ambiguous records remain intact. */
export function completeObjectStorage(
  definition: AssetDefinition,
  object: SceneObject,
  roomId: string,
  existing: readonly StorageLocation[],
  now: string,
) {
  const locations = existing.map((location) => ({ ...location, childIds: [...location.childIds] }));
  let added = 0,
    linked = 0;
  let root = locations.find((location) => location.objectId === object.id && !location.parentId);
  if (!root) {
    root = {
      id: crypto.randomUUID(),
      roomId,
      objectId: object.id,
      parentId: null,
      type: "cabinet",
      name: object.name,
      indexCode: object.indexCode,
      order: 0,
      capacityNotes: "",
      childIds: [],
      createdAt: now,
      updatedAt: now,
    };
    locations.push(root);
    added++;
  }
  const mapped = new Map<string, StorageLocation>();
  const claimed = new Set<string>();
  for (const entry of definition.storageTemplate ?? []) {
    const parent = entry.parentKey ? mapped.get(entry.parentKey) : root;
    if (!parent) throw new Error(`Invalid storage template parent: ${entry.key}`);
    let match = locations.find(
      (location) =>
        location.objectId === object.id &&
        entry.anatomyKey &&
        location.anatomyKey === entry.anatomyKey,
    );
    if (!match) {
      const same = locations.filter(
        (location) =>
          location.objectId === object.id &&
          !location.anatomyKey &&
          !claimed.has(location.id) &&
          location.type === entry.type &&
          location.name.toLowerCase() === entry.name.toLowerCase(),
      );
      if (same.length === 1) match = same[0];
      // Existing generic shelves/drawers can be matched top-to-bottom only
      // where the entire family has one unambiguous parent and exact counts.
      if (!match && ["drawer", "shelf"].includes(entry.type)) {
        const targets = (definition.storageTemplate ?? []).filter((t) => t.type === entry.type);
        const candidates = locations
          .filter((l) => l.objectId === object.id && l.type === entry.type && !l.anatomyKey)
          .sort((a, b) => a.order - b.order);
        const all = existing
          .filter((l) => l.objectId === object.id && l.type === entry.type)
          .sort((a, b) => a.order - b.order);
        if (
          new Set(targets.map((t) => t.parentKey ?? "")).size === 1 &&
          all.length === targets.length &&
          new Set(all.map((l) => l.parentId)).size === 1
        ) {
          const candidate = all[targets.indexOf(entry)];
          match = candidates.find((l) => l.id === candidate?.id && !claimed.has(l.id));
        }
      }
    }
    if (match) {
      if (entry.anatomyKey && !match.anatomyKey) {
        match.anatomyKey = entry.anatomyKey;
        linked++;
      }
      claimed.add(match.id);
      mapped.set(entry.key, match);
      continue;
    }
    const child: StorageLocation = {
      id: crypto.randomUUID(),
      roomId,
      objectId: object.id,
      parentId: parent.id,
      type: entry.type,
      name: entry.name,
      indexCode: generateChildIndexCode(parent, entry.type, locations),
      order: locations.filter((l) => l.parentId === parent.id && l.type === entry.type).length,
      capacityNotes: entry.capacityNotes ?? "",
      childIds: [],
      normalizedBounds: entry.normalizedBounds,
      anatomyKey: entry.anatomyKey,
      createdAt: now,
      updatedAt: now,
    };
    parent.childIds.push(child.id);
    locations.push(child);
    mapped.set(entry.key, child);
    added++;
  }
  return { locations, rootId: root.id, added, linked };
}

export function missingStorageCount(
  definition: AssetDefinition,
  objectId: string,
  locations: readonly StorageLocation[],
) {
  return (definition.storageTemplate ?? []).filter(
    (entry) =>
      !locations.some(
        (location) =>
          location.objectId === objectId &&
          (entry.anatomyKey
            ? location.anatomyKey === entry.anatomyKey
            : location.type === entry.type && location.name === entry.name),
      ),
  ).length;
}
