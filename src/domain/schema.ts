import { z } from "zod";
import { MAX_RAISED_FROM_FLOOR_MM } from "./object-transforms";

export const SCENE_SCHEMA_VERSION = 2 as const;

export const IdSchema = z.string().min(8);
export const IsoDateSchema = z.string().datetime();

export const Vector3Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});

export const SceneObjectPositionSchema = Vector3Schema.extend({
  z: z.number().finite().min(0).max(MAX_RAISED_FROM_FLOOR_MM),
});

export const DimensionsSchema = z.object({
  width: z.number().positive().max(100_000),
  depth: z.number().positive().max(100_000),
  height: z.number().positive().max(30_000),
});

export const ObjectTypeSchema = z.enum([
  "wall",
  "door",
  "window",
  "architecture",
  "furniture",
  "storage",
  "equipment",
  "utility",
  "safety",
  "label",
  "measurement",
]);

export const LayerRoleSchema = z.enum([
  "walls",
  "openings",
  "furniture",
  "storage",
  "equipment",
  "utilities",
  "safety",
  "labels",
  "measurements",
]);

export const LayerSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  role: LayerRoleSchema.optional(),
  visible: z.boolean(),
  locked: z.boolean(),
  order: z.number().int(),
  color: z.string(),
  system: z.boolean().default(false),
});

export const ZoneSchema = z.object({
  id: IdSchema,
  roomId: IdSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  color: z.string(),
});

export const WallGeometrySchema = z.object({
  start: z.object({ x: z.number(), y: z.number() }),
  end: z.object({ x: z.number(), y: z.number() }),
  thickness: z.number().positive(),
  height: z.number().positive(),
  halfHeight: z.boolean().default(false),
});

export const OpeningSchema = z.object({
  wallId: IdSchema,
  offset: z.number().min(0),
  width: z.number().positive(),
  sillHeight: z.number().min(0).default(0),
  height: z.number().positive(),
  handing: z.enum(["left", "right"]).default("left"),
  swing: z.enum(["inward", "outward", "sliding"]).default("inward"),
});

export const SceneObjectSchema = z.object({
  id: IdSchema,
  indexCode: z.string().min(1),
  name: z.string().min(1),
  assetDefinitionId: z.string().min(1),
  objectType: ObjectTypeSchema,
  position: SceneObjectPositionSchema,
  dimensions: DimensionsSchema,
  rotation: Vector3Schema,
  layerId: IdSchema,
  roomId: IdSchema,
  zoneId: IdSchema.nullable(),
  locked: z.boolean(),
  visible: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
  parentObjectId: IdSchema.nullable(),
  childLocationIds: z.array(IdSchema),
  zIndex: z.number().int(),
  wall: WallGeometrySchema.optional(),
  opening: OpeningSchema.optional(),
  flipHorizontal: z.boolean().default(false),
  flipVertical: z.boolean().default(false),
});

export const StorageLocationTypeSchema = z.enum([
  "cabinet",
  "compartment",
  "shelf",
  "drawer",
  "bin",
]);

export const NormalizedStorageBoundsSchema = z.object({
  x: z.number().finite().min(-0.5).max(0.5),
  y: z.number().finite().min(0).max(1),
  z: z.number().finite().min(-0.5).max(0.5),
  width: z.number().positive().max(1),
  depth: z.number().positive().max(1),
  height: z.number().positive().max(1),
});

export const StorageLocationSchema = z.object({
  id: IdSchema,
  roomId: IdSchema,
  objectId: IdSchema,
  parentId: IdSchema.nullable(),
  type: StorageLocationTypeSchema,
  name: z.string().min(1),
  indexCode: z.string().min(1),
  order: z.number().int().min(0),
  capacityNotes: z.string(),
  childIds: z.array(IdSchema),
  normalizedBounds: NormalizedStorageBoundsSchema.optional(),
  /** Stable authored anatomy identity; independent of user names and record IDs. */
  anatomyKey: z.string().min(1).optional(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const InventoryItemSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  imageSrc: z.string().min(1).optional(),
  quantity: z.number().min(0),
  unit: z.string().min(1),
  notes: z.string(),
  owner: z.string(),
  expiryDate: z.string().nullable(),
  storageLocationId: IdSchema.nullable(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const EquipmentRecordSchema = z.object({
  id: IdSchema,
  objectId: IdSchema,
  equipmentId: z.string().min(1),
  name: z.string().min(1),
  imageSrc: z.string().min(1).optional(),
  manufacturer: z.string(),
  model: z.string(),
  serialNumber: z.string(),
  status: z.enum(["active", "service-due", "out-of-service", "reserved"]),
  responsiblePerson: z.string(),
  lastServiceDate: z.string().nullable(),
  nextServiceDate: z.string().nullable(),
  powerRequirements: z.string(),
  waterRequirements: z.string(),
  gasRequirements: z.string(),
  drainRequired: z.boolean(),
  ventilationRequired: z.boolean(),
  notes: z.string(),
});

export const LabelTemplateSchema = z.object({
  id: IdSchema,
  name: z.string(),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  showBarcode: z.boolean(),
  showDescription: z.boolean(),
});

export const SceneSchema = z.object({
  schemaVersion: z.literal(SCENE_SCHEMA_VERSION),
  id: IdSchema,
  roomId: IdSchema,
  objects: z.array(SceneObjectSchema),
  layers: z.array(LayerSchema),
  zones: z.array(ZoneSchema),
  storageLocations: z.array(StorageLocationSchema),
  inventoryItems: z.array(InventoryItemSchema),
  equipmentRecords: z.array(EquipmentRecordSchema),
  labelTemplates: z.array(LabelTemplateSchema),
  updatedAt: IsoDateSchema,
});

export const RoomSchema = z.object({
  id: IdSchema,
  laboratoryId: IdSchema,
  name: z.string().min(1),
  code: z.string().min(1),
  roomKind: z.enum(["standard", "demo-template", "demo"]).optional(),
  demoSavedAt: IsoDateSchema.nullable().optional(),
  facilityPlacement: z
    .object({
      floor: z.number().int().min(0).max(50).default(0),
      x: z.number().finite().min(-100_000).max(100_000).default(0),
      y: z.number().finite().min(-100_000).max(100_000).default(0),
      rotation: z.number().finite().min(-360).max(360).default(0),
    })
    .optional(),
  viewState: z
    .object({
      cameraPreset: z
        .enum(["perspective", "orthographic", "top", "isometric", "front", "right", "left", "back"])
        .default("isometric"),
      presentation: z.enum(["2d", "split", "3d"]).default("split"),
      floorVisible: z.boolean().default(true),
      wallTransparent: z.boolean().default(false),
      environmentContextVisible: z.boolean().default(false),
      cameraPose: z
        .object({
          position: Vector3Schema,
          target: Vector3Schema,
        })
        .nullable()
        .default(null),
    })
    .optional(),
  environmentProfileId: z.string().min(1).nullable().default(null),
  width: z.number().positive(),
  depth: z.number().positive(),
  wallHeight: z.number().positive(),
  floorFinish: z.string(),
  wallFinish: z.string().default("clean-white-panel"),
  notes: z.string(),
  scene: SceneSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const LaboratorySchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  name: z.string().min(1),
  code: z.string().min(1),
  roomIds: z.array(IdSchema),
});

export const ProjectSchema = z.object({
  schemaVersion: z.literal(SCENE_SCHEMA_VERSION),
  id: IdSchema,
  name: z.string().min(1),
  laboratories: z.array(LaboratorySchema),
  rooms: z.array(RoomSchema),
  activeRoomId: IdSchema,
  featuredDemoRoomId: IdSchema.nullable().optional(),
  archivedAssetIds: z.array(z.string().min(2)).optional(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const RoomVersionSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  roomId: IdSchema,
  name: z.string().min(1),
  note: z.string(),
  schemaVersion: z.number().int().positive(),
  scene: SceneSchema,
  createdAt: IsoDateSchema,
});

export const AssetCategorySchema = z.enum([
  "Architecture",
  "Furniture",
  "Storage",
  "Laboratory equipment",
  "Safety",
  "Utilities",
]);

export const AssetDefinitionSchema = z.object({
  id: z.string().min(2),
  name: z.string().min(2),
  shortName: z.string().min(1),
  category: AssetCategorySchema,
  objectType: ObjectTypeSchema,
  defaultDimensions: DimensionsSchema,
  minDimensions: DimensionsSchema,
  maxDimensions: DimensionsSchema,
  tags: z.array(z.string()),
  connection: z.enum(["free", "wall", "floor", "bench", "ceiling"]),
  indexingBehavior: z.enum(["none", "object", "storage", "equipment"]),
  anchor: z.enum(["center", "back-left", "wall-center"]),
  profile: z.enum([
    "wall",
    "column",
    "door",
    "window",
    "bench",
    "corner",
    "table",
    "seat",
    "cabinet",
    "shelf",
    "rack",
    "locker",
    "hood",
    "box",
    "round",
    "tall",
    "scope",
    "washer",
    "cylinder",
    "workstation",
    "safety",
  ]),
  material: z.enum(["white", "steel", "dark", "glass", "yellow", "red", "blue"]),
  accent: z.string(),
  description: z.string(),
  storageTemplate: z
    .array(
      z.object({
        key: z.string().min(1),
        parentKey: z.string().min(1).optional(),
        type: StorageLocationTypeSchema.exclude(["cabinet"]),
        name: z.string().min(1),
        capacityNotes: z.string().optional(),
        anatomyKey: z.string().min(1).optional(),
        normalizedBounds: NormalizedStorageBoundsSchema.optional(),
      }),
    )
    .optional(),
  model3d: z
    .object({
      previewSrc: z.string().min(1),
      roomSrc: z.string().min(1).optional(),
      authoredDimensions: DimensionsSchema,
      revision: z.string().min(1),
    })
    .optional(),
});

export type Vector3 = z.infer<typeof Vector3Schema>;
export type Dimensions = z.infer<typeof DimensionsSchema>;
export type ObjectType = z.infer<typeof ObjectTypeSchema>;
export type LayerRole = z.infer<typeof LayerRoleSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type Zone = z.infer<typeof ZoneSchema>;
export type SceneObject = z.infer<typeof SceneObjectSchema>;
export type StorageLocation = z.infer<typeof StorageLocationSchema>;
export type NormalizedStorageBounds = z.infer<typeof NormalizedStorageBoundsSchema>;
export type StorageLocationType = z.infer<typeof StorageLocationTypeSchema>;
export type InventoryItem = z.infer<typeof InventoryItemSchema>;
export type EquipmentRecord = z.infer<typeof EquipmentRecordSchema>;
export type LabelTemplate = z.infer<typeof LabelTemplateSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type RoomViewState = NonNullable<Room["viewState"]>;
export type Laboratory = z.infer<typeof LaboratorySchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type RoomVersion = z.infer<typeof RoomVersionSchema>;
export type AssetDefinition = z.infer<typeof AssetDefinitionSchema>;
export type AssetCategory = z.infer<typeof AssetCategorySchema>;
