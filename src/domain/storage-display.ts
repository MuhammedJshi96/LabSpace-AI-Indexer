import { storagePath } from "./inventory-organization";
import type { StorageLocation, StorageLocationType } from "./schema";

/**
 * Makes authored storage names fit compact controls without changing the
 * canonical name. Callers must keep the full name available as a title or
 * accessible label.
 */
export function compactStorageLabel(name: string, type?: StorageLocationType) {
  const original = name.trim().replace(/\s+/g, " ");
  if (original.length <= 28) return original;

  let compact = original
    .replace(/\blaboratory\b/gi, "lab")
    .replace(/\bthree-drawer bank\b/gi, "bank")
    .replace(/\bpaired-door cabinet\b/gi, "cabinet")
    .replace(/\bwith overhead cabinets?\b/gi, "· overhead cabinets")
    .replace(/\bwith service bridge\b/gi, "· service bridge")
    .replace(/\bstorage cabinet\b/gi, "cabinet")
    .replace(/\btop drawer\s+(\d+)\b/gi, "· drawer $1")
    .replace(/\blower (?:hinged )?door\s+(\d+)\b/gi, "· door $1")
    .replace(/\s*·\s*·\s*/g, " · ")
    .replace(/\s+/g, " ")
    .trim();

  // Within a storage map the surrounding unit is already visible, so these
  // manufactured-part prefixes repeat context without adding meaning.
  if (type && type !== "cabinet") compact = compact.replace(/^(?:bench|island)\s+/i, "");

  if (/^[A-Z]/.test(original) && /^[a-z]/.test(compact))
    compact = compact[0].toUpperCase() + compact.slice(1);

  return compact;
}

export function storageMapMarker(name: string, type: StorageLocationType, fallbackIndex: number) {
  const normalized = name.trim();
  const bankDrawer = normalized.match(/drawer bank\s+(\d+).*drawer\s+(\d+)/i);
  if (bankDrawer) return `${bankDrawer[1]}.${bankDrawer[2]}`;

  const islandDrawer = normalized.match(
    /(?:island\s+)?(north|south).*module\s+(\d+).*drawer\s+(\d+)/i,
  );
  if (islandDrawer)
    return `${islandDrawer[1][0].toUpperCase()}${islandDrawer[2]}.${islandDrawer[3]}`;

  const namedNumber = normalized.match(
    /(?:drawer|shelf|door|bay|module|cabinet|compartment)\s*0*(\d+)\b/i,
  );
  const prefix: Record<StorageLocationType, string> = {
    cabinet: "U",
    compartment: "C",
    shelf: "S",
    drawer: "D",
    bin: "B",
  };
  return `${prefix[type]}${namedNumber?.[1] ?? fallbackIndex + 1}`;
}

export function storageFullPath(locations: StorageLocation[], locationId: string | null) {
  return storagePath(locations, locationId)
    .map((location) => location.name)
    .join(" / ");
}

export function storageOptionLabel(locations: StorageLocation[], locationId: string) {
  const path = storagePath(locations, locationId);
  if (!path.length) return "Unknown location";
  if (path.length === 1) return `Whole unit · ${compactStorageLabel(path[0].name, path[0].type)}`;

  const localPath = path
    .slice(1)
    .filter(
      (location, index, entries) =>
        index === 0 ||
        location.name.trim().toLowerCase() !== entries[index - 1].name.trim().toLowerCase(),
    )
    .slice(-2)
    .map((location) => compactStorageLabel(location.name, location.type));

  if (localPath.length === 2 && localPath[1].toLowerCase().startsWith(localPath[0].toLowerCase())) {
    const relative = localPath[1]
      .slice(localPath[0].length)
      .replace(/^\s*[·›:/-]\s*/, "")
      .trim();
    if (relative)
      localPath[1] = /^[a-z]/.test(relative)
        ? relative[0].toUpperCase() + relative.slice(1)
        : relative;
  }

  return localPath.join(" › ");
}
