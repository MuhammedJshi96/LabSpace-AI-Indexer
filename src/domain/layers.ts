import type { Layer, LayerRole, ObjectType, Project } from "./schema";

export const DEFAULT_LAYER_ROLES: readonly LayerRole[] = [
  "walls",
  "openings",
  "furniture",
  "storage",
  "equipment",
  "utilities",
  "safety",
  "labels",
  "measurements",
];

const DEFAULT_LAYER_SPECS: Record<LayerRole, Pick<Layer, "name" | "color" | "order" | "system">> = {
  walls: { name: "Walls", color: "#3a4244", order: 0, system: true },
  openings: { name: "Doors and windows", color: "#6f8a8c", order: 1, system: true },
  furniture: { name: "Furniture", color: "#7b8585", order: 2, system: true },
  storage: { name: "Storage", color: "#99a29f", order: 3, system: true },
  equipment: {
    name: "Laboratory equipment",
    color: "#3f7584",
    order: 4,
    system: true,
  },
  utilities: { name: "Utilities", color: "#887a5e", order: 5, system: true },
  safety: { name: "Safety", color: "#c35d52", order: 6, system: true },
  labels: { name: "Labels", color: "#675f7d", order: 7, system: true },
  measurements: { name: "Measurements", color: "#6f7778", order: 8, system: true },
};

const ROLE_NAME_ALIASES: Record<LayerRole, readonly string[]> = {
  walls: ["wall", "walls", "architectural shell", "room shell"],
  openings: ["opening", "openings", "doors and windows", "doors & windows", "doors / windows"],
  furniture: ["furniture", "furnishings", "fixtures"],
  storage: ["storage", "cabinets", "casework"],
  equipment: ["equipment", "laboratory equipment", "lab equipment", "instruments"],
  utilities: ["utility", "utilities", "services", "building services"],
  safety: ["safety", "emergency equipment"],
  labels: ["label", "labels", "annotations"],
  measurements: ["measurement", "measurements", "dimensions"],
};

type LayerFactoryOptions = {
  idForRole?: (role: LayerRole) => string;
};

function normalizeLayerName(name: string) {
  return name.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function createDefaultLayers(options: LayerFactoryOptions = {}): Layer[] {
  return DEFAULT_LAYER_ROLES.map((role) => ({
    id: options.idForRole?.(role) ?? crypto.randomUUID(),
    role,
    ...DEFAULT_LAYER_SPECS[role],
    visible: true,
    locked: false,
  }));
}

export function inferLayerRole(layer: Layer): LayerRole | null {
  if (layer.role) return layer.role;
  const name = normalizeLayerName(layer.name);
  return (
    DEFAULT_LAYER_ROLES.find((role) =>
      ROLE_NAME_ALIASES[role].some((alias) => normalizeLayerName(alias) === name),
    ) ?? null
  );
}

export function layerRoleForObjectType(type: ObjectType): LayerRole {
  if (type === "wall" || type === "architecture") return "walls";
  if (type === "door" || type === "window") return "openings";
  if (type === "storage") return "storage";
  if (type === "equipment") return "equipment";
  if (type === "safety") return "safety";
  if (type === "utility") return "utilities";
  if (type === "label") return "labels";
  if (type === "measurement") return "measurements";
  return "furniture";
}

export function resolveLayerForRole(layers: readonly Layer[], role: LayerRole): Layer | undefined {
  return (
    layers.find((layer) => layer.role === role) ??
    layers.find((layer) => inferLayerRole(layer) === role)
  );
}

export function resolveLayerIdForObjectType(layers: readonly Layer[], type: ObjectType): string {
  const role = layerRoleForObjectType(type);
  const resolved = resolveLayerForRole(layers, role) ?? resolveLayerForRole(layers, "furniture");
  const fallback = resolved ?? layers.find((layer) => !layer.locked) ?? layers[0];
  if (!fallback) throw new Error("The scene has no layers available for placed objects.");
  return fallback.id;
}

/**
 * Preserves every imported/custom layer and assigns semantic roles by explicit
 * metadata or well-known names. Missing professional defaults are appended with
 * fresh IDs, so projects never depend on IDs owned by the demonstration seed.
 */
export function ensureDefaultLayers(
  layers: readonly Layer[],
  options: LayerFactoryOptions = {},
): Layer[] {
  const normalized = layers.map((layer) => {
    const role = inferLayerRole(layer);
    return role && layer.role !== role ? { ...layer, role } : { ...layer };
  });
  const present = new Set(
    normalized.map(inferLayerRole).filter((role): role is LayerRole => Boolean(role)),
  );
  const defaults = createDefaultLayers(options);
  return [
    ...normalized,
    ...defaults
      .filter((layer) => !present.has(layer.role!))
      .map((layer, index) => ({ ...layer, order: normalized.length + index })),
  ];
}

export function ensureProjectLayers(project: Project): Project {
  return {
    ...project,
    rooms: project.rooms.map((room) => ({
      ...room,
      scene: { ...room.scene, layers: ensureDefaultLayers(room.scene.layers) },
    })),
  };
}
