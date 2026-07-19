import { SCENE_SCHEMA_VERSION, SceneSchema, type Scene } from "./schema";

type LegacySceneV1 = {
  schemaVersion: 1;
  id: string;
  roomId: string;
  objects?: unknown[];
  layers?: unknown[];
  zones?: unknown[];
  storageLocations?: unknown[];
  inventoryItems?: unknown[];
  equipmentRecords?: unknown[];
  updatedAt?: string;
};

export function migrateScene(input: unknown): Scene {
  if (!input || typeof input !== "object") throw new Error("Scene data must be an object.");
  const raw = input as Record<string, unknown>;
  if (raw.schemaVersion === SCENE_SCHEMA_VERSION) return SceneSchema.parse(raw);
  if (raw.schemaVersion === 1) {
    const legacy = raw as LegacySceneV1;
    return SceneSchema.parse({
      ...legacy,
      schemaVersion: SCENE_SCHEMA_VERSION,
      objects: legacy.objects ?? [],
      layers: legacy.layers ?? [],
      zones: legacy.zones ?? [],
      storageLocations: legacy.storageLocations ?? [],
      inventoryItems: legacy.inventoryItems ?? [],
      equipmentRecords: legacy.equipmentRecords ?? [],
      labelTemplates: [
        {
          id: "label-template-standard",
          name: "Standard location label",
          widthMm: 70,
          heightMm: 36,
          showBarcode: false,
          showDescription: true,
        },
      ],
      updatedAt: legacy.updatedAt ?? new Date().toISOString(),
    });
  }
  throw new Error(`Unsupported scene schema version: ${String(raw.schemaVersion)}`);
}
