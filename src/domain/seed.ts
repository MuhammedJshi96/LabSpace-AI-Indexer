import { getAssetDefinition } from "./assets";
import demo01Showcase from "./demo-01-showcase.json" with { type: "json" };
import { ANALYTICAL_CORE_ENVIRONMENT_PROFILE_ID } from "./laboratory-environment";
import { createDefaultLayers } from "./layers";
import {
  ProjectSchema,
  RoomSchema,
  SCENE_SCHEMA_VERSION,
  type Project,
  type Room,
  type Scene,
  type SceneObject,
  type StorageLocation,
} from "./schema";

const CREATED = "2026-07-16T08:00:00.000Z";
export const PROJECT_ID = "project-labspace-demo";
export const LAB_ID = "laboratory-main-demo";
export const ROOM_ID = "room-809-demo";
export const SCENE_ID = "scene-room-809-demo";
export const STARTER_ROOM_ID = "room-empty-starter";
export const STARTER_SCENE_ID = "scene-empty-starter";
export const SHOWCASE_DEMO_ROOM_ID = "93f219ff-c437-4168-90d4-ddac2c100b38";
export const ZONE_PREP_ID = "zone-preparation-01";
export const ZONE_ANALYSIS_ID = "zone-analysis-02";
export const ROOM_809_WIDTH = 8710;
export const ROOM_809_DEPTH = 8690;
export const ANALYTICAL_LAB_ID = "laboratory-analytical-core";
export const ANALYTICAL_ROOM_ID = "room-chromatography-suite-a";
export const ANALYTICAL_SCENE_ID = "scene-chromatography-suite-a";
export const ANALYTICAL_ZONE_ID = "zone-instrument-analysis-01";
export const ANALYTICAL_SUPPORT_ZONE_ID = "zone-instrument-support-02";
export const ANALYTICAL_ROOM_WIDTH = 9000;
export const ANALYTICAL_ROOM_DEPTH = 6400;

export const LAYER_IDS = {
  walls: "layer-walls-001",
  openings: "layer-openings-002",
  furniture: "layer-furniture-003",
  storage: "layer-storage-004",
  equipment: "layer-equipment-005",
  utilities: "layer-utilities-006",
  safety: "layer-safety-007",
  labels: "layer-labels-008",
  measurements: "layer-measurements-009",
} as const;

export const DEFAULT_LAYERS = createDefaultLayers({
  idForRole: (role) => LAYER_IDS[role],
});

type ObjectOptions = Partial<
  Pick<
    SceneObject,
    | "position"
    | "rotation"
    | "dimensions"
    | "flipHorizontal"
    | "flipVertical"
    | "zoneId"
    | "layerId"
    | "metadata"
    | "indexCode"
    | "name"
    | "parentObjectId"
  >
>;

function seededId(seed: number) {
  return `00000000-0000-4000-8000-${seed.toString().padStart(12, "0")}`;
}

function sceneObject(seed: number, assetId: string, options: ObjectOptions = {}): SceneObject {
  const definition = getAssetDefinition(assetId);
  const id = seededId(seed);
  const typePrefix =
    definition.objectType === "storage"
      ? "CAB"
      : definition.objectType === "equipment"
        ? "EQ"
        : definition.objectType === "safety"
          ? "SAFE"
          : "OBJ";
  return {
    id,
    indexCode:
      options.indexCode ?? `LAB-R809-Z01-${typePrefix}-${seed.toString().padStart(3, "0")}`,
    name: options.name ?? definition.name,
    assetDefinitionId: assetId,
    objectType: definition.objectType,
    position: options.position ?? { x: 1000, y: 1000, z: 0 },
    dimensions: options.dimensions ?? definition.defaultDimensions,
    rotation: options.rotation ?? { x: 0, y: 0, z: 0 },
    flipHorizontal: options.flipHorizontal ?? false,
    flipVertical: options.flipVertical ?? false,
    layerId:
      options.layerId ??
      (definition.objectType === "wall"
        ? LAYER_IDS.walls
        : definition.objectType === "door" || definition.objectType === "window"
          ? LAYER_IDS.openings
          : definition.objectType === "storage"
            ? LAYER_IDS.storage
            : definition.objectType === "equipment"
              ? LAYER_IDS.equipment
              : definition.objectType === "safety"
                ? LAYER_IDS.safety
                : LAYER_IDS.furniture),
    roomId: ROOM_ID,
    zoneId: options.zoneId === undefined ? ZONE_PREP_ID : options.zoneId,
    locked: false,
    visible: true,
    metadata: options.metadata ?? {},
    createdAt: CREATED,
    updatedAt: CREATED,
    parentObjectId: options.parentObjectId ?? null,
    childLocationIds: [],
    zIndex: seed,
  };
}

function wall(seed: number, start: [number, number], end: [number, number]): SceneObject {
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const object = sceneObject(seed, "straight-wall", {
    name: `Room wall ${seed - 100}`,
    indexCode: `LAB-R809-WALL-${(seed - 100).toString().padStart(2, "0")}`,
    position: { x: (start[0] + end[0]) / 2, y: (start[1] + end[1]) / 2, z: 0 },
    dimensions: { width: length, depth: 150, height: 3000 },
    zoneId: null,
  });
  object.wall = {
    start: { x: start[0], y: start[1] },
    end: { x: end[0], y: end[1] },
    thickness: 150,
    height: 3000,
    halfHeight: false,
  };
  return object;
}

function location(
  seed: number,
  objectId: string,
  parentId: string | null,
  type: StorageLocation["type"],
  name: string,
  indexCode: string,
  order: number,
): StorageLocation {
  return {
    id: `storage-location-${seed.toString().padStart(4, "0")}`,
    roomId: ROOM_ID,
    objectId,
    parentId,
    type,
    name,
    indexCode,
    order,
    capacityNotes: "",
    childIds: [],
    createdAt: CREATED,
    updatedAt: CREATED,
  };
}

function analyticalObject(seed: number, assetId: string, options: ObjectOptions = {}): SceneObject {
  const definition = getAssetDefinition(assetId);
  const object = sceneObject(1000 + seed, assetId, {
    ...options,
    zoneId: options.zoneId === undefined ? ANALYTICAL_ZONE_ID : options.zoneId,
    indexCode:
      options.indexCode ??
      `AIC-CHR-A-${definition.objectType === "equipment" ? "EQ" : definition.objectType === "storage" ? "CAB" : "OBJ"}-${seed.toString().padStart(3, "0")}`,
  });
  object.roomId = ANALYTICAL_ROOM_ID;
  return object;
}

function analyticalWall(seed: number, start: [number, number], end: [number, number]): SceneObject {
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const object = analyticalObject(seed, "straight-wall", {
    name: `Chromatography suite wall ${seed}`,
    indexCode: `AIC-CHR-A-WALL-${seed.toString().padStart(2, "0")}`,
    position: { x: (start[0] + end[0]) / 2, y: (start[1] + end[1]) / 2, z: 0 },
    dimensions: { width: length, depth: 150, height: 3200 },
    zoneId: null,
    layerId: LAYER_IDS.walls,
  });
  object.wall = {
    start: { x: start[0], y: start[1] },
    end: { x: end[0], y: end[1] },
    thickness: 150,
    height: 3200,
    halfHeight: false,
  };
  return object;
}

function createAnalyticalCoreRoom(): Room {
  const walls = [
    analyticalWall(101, [0, 0], [ANALYTICAL_ROOM_WIDTH, 0]),
    analyticalWall(102, [ANALYTICAL_ROOM_WIDTH, 0], [ANALYTICAL_ROOM_WIDTH, ANALYTICAL_ROOM_DEPTH]),
    analyticalWall(103, [ANALYTICAL_ROOM_WIDTH, ANALYTICAL_ROOM_DEPTH], [0, ANALYTICAL_ROOM_DEPTH]),
    analyticalWall(104, [0, ANALYTICAL_ROOM_DEPTH], [0, 0]),
  ];
  const entrance = analyticalObject(110, "double-door", {
    name: "Chromatography suite entrance",
    indexCode: "AIC-CHR-A-DOOR-01",
    position: { x: 4500, y: ANALYTICAL_ROOM_DEPTH, z: 0 },
    rotation: { x: 0, y: 0, z: 180 },
    dimensions: { width: 1800, depth: 120, height: 2100 },
    zoneId: null,
  });
  entrance.opening = {
    wallId: walls[2].id,
    offset: 4500,
    width: 1800,
    sillHeight: 0,
    height: 2100,
    handing: "right",
    swing: "inward",
  };
  const windows = [2250, 4500, 6750].map((x, index) => {
    const object = analyticalObject(120 + index, "wide-window", {
      name: `Instrument-suite observation window ${index + 1}`,
      indexCode: `AIC-CHR-A-WIN-${(index + 1).toString().padStart(2, "0")}`,
      position: { x, y: 0, z: 900 },
      dimensions: { width: 1800, depth: 120, height: 1200 },
      zoneId: null,
    });
    object.opening = {
      wallId: walls[0].id,
      offset: x,
      width: 1800,
      sillHeight: 900,
      height: 1200,
      handing: "left",
      swing: "sliding",
    };
    return object;
  });

  const objects: SceneObject[] = [
    ...walls,
    entrance,
    ...windows,
    analyticalObject(1, "lab-bench-overhead", {
      position: { x: 2600, y: 520, z: 0 },
      dimensions: { width: 4300, depth: 750, height: 2100 },
      metadata: { supportSurfaceHeight: 900 },
      name: "Chromatography instrument bench",
      indexCode: "AIC-CHR-A-OBJ-001",
    }),
    analyticalObject(2, "lab-bench", {
      position: { x: 6850, y: 520, z: 0 },
      dimensions: { width: 3200, depth: 750, height: 900 },
      metadata: { supportSurfaceHeight: 900 },
      name: "Optical analysis bench",
      indexCode: "AIC-CHR-A-OBJ-002",
    }),
    analyticalObject(3, "island-bench-service-bridge", {
      position: { x: 4500, y: 3300, z: 0 },
      rotation: { x: 0, y: 0, z: 90 },
      dimensions: { width: 3600, depth: 1200, height: 2100 },
      metadata: { supportSurfaceHeight: 900 },
      name: "Analytical preparation island",
      indexCode: "AIC-CHR-A-OBJ-003",
    }),
    analyticalObject(4, "lab-bench-sink", {
      position: { x: 520, y: 3300, z: 0 },
      rotation: { x: 0, y: 0, z: 90 },
      dimensions: { width: 2400, depth: 750, height: 1600 },
      metadata: { supportSurfaceHeight: 900 },
      name: "West solvent-preparation sink",
      indexCode: "AIC-CHR-A-OBJ-004",
      zoneId: ANALYTICAL_SUPPORT_ZONE_ID,
    }),
    analyticalObject(5, "fume-hood", {
      position: { x: 8420, y: 1850, z: 0 },
      rotation: { x: 0, y: 0, z: 90 },
      name: "Analytical sample-preparation fume hood",
      indexCode: "AIC-CHR-A-EQ-001",
      zoneId: ANALYTICAL_SUPPORT_ZONE_ID,
    }),
    analyticalObject(6, "lab-freezer", {
      position: { x: 8260, y: 5050, z: 0 },
      rotation: { x: 0, y: 0, z: 90 },
      name: "Analytical standards freezer",
      indexCode: "AIC-CHR-A-EQ-002",
      zoneId: ANALYTICAL_SUPPORT_ZONE_ID,
    }),
    analyticalObject(7, "open-shelving", {
      position: { x: 6800, y: 5750, z: 0 },
      name: "Instrument consumables shelving",
      indexCode: "AIC-CHR-A-CAB-001",
      zoneId: ANALYTICAL_SUPPORT_ZONE_ID,
    }),
    analyticalObject(8, "base-drawer-cabinet", {
      position: { x: 1450, y: 5780, z: 0 },
      dimensions: { width: 1200, depth: 600, height: 850 },
      name: "Chromatography consumables cabinet",
      indexCode: "AIC-CHR-A-CAB-002",
      zoneId: ANALYTICAL_SUPPORT_ZONE_ID,
    }),
    analyticalObject(20, "hplc-system", {
      position: { x: 1900, y: 520, z: 900 },
      name: "Modular HPLC system A",
      indexCode: "AIC-CHR-A-EQ-020",
    }),
    analyticalObject(21, "gas-chromatograph", {
      position: { x: 3450, y: 520, z: 900 },
      name: "Gas chromatograph A",
      indexCode: "AIC-CHR-A-EQ-021",
    }),
    analyticalObject(22, "spectrophotometer", {
      position: { x: 6000, y: 520, z: 900 },
      name: "UV-Vis spectrophotometer",
      indexCode: "AIC-CHR-A-EQ-022",
    }),
    analyticalObject(23, "plate-reader", {
      position: { x: 7180, y: 520, z: 900 },
      name: "Multimode plate reader",
      indexCode: "AIC-CHR-A-EQ-023",
    }),
    analyticalObject(24, "microcentrifuge", {
      position: { x: 4210, y: 2500, z: 900 },
      rotation: { x: 0, y: 0, z: 90 },
      name: "Microcentrifuge",
      indexCode: "AIC-CHR-A-EQ-024",
    }),
    analyticalObject(25, "hotplate-stirrer", {
      position: { x: 4780, y: 4050, z: 900 },
      rotation: { x: 0, y: 0, z: 180 },
      name: "Hotplate stirrer",
      indexCode: "AIC-CHR-A-EQ-025",
    }),
    analyticalObject(26, "analytical-balance", {
      position: { x: 4210, y: 4200, z: 900 },
      rotation: { x: 0, y: 0, z: 180 },
      name: "Micro analytical balance",
      indexCode: "AIC-CHR-A-EQ-026",
    }),
    analyticalObject(30, "laboratory-chair", {
      position: { x: 3300, y: 1600, z: 0 },
      rotation: { x: 0, y: 0, z: 180 },
      name: "Chromatography operator chair",
    }),
    analyticalObject(31, "round-stool", {
      position: { x: 3500, y: 3250, z: 0 },
      name: "Island stool A",
    }),
    analyticalObject(32, "round-stool", {
      position: { x: 5500, y: 3250, z: 0 },
      name: "Island stool B",
    }),
  ];

  const consumablesCabinet = objects.find((object) => object.indexCode === "AIC-CHR-A-CAB-002")!;
  const storageLocations: StorageLocation[] = [
    {
      ...location(
        201,
        consumablesCabinet.id,
        null,
        "cabinet",
        "Chromatography consumables cabinet",
        consumablesCabinet.indexCode,
        0,
      ),
      id: "analytical-storage-cabinet-01",
      roomId: ANALYTICAL_ROOM_ID,
    },
    {
      ...location(
        202,
        consumablesCabinet.id,
        "analytical-storage-cabinet-01",
        "drawer",
        "Drawer 01",
        `${consumablesCabinet.indexCode}-DR-01`,
        0,
      ),
      id: "analytical-storage-drawer-01",
      roomId: ANALYTICAL_ROOM_ID,
      normalizedBounds: { x: 0, y: 0.65, z: -0.02, width: 0.9, depth: 0.88, height: 0.18 },
    },
    {
      ...location(
        203,
        consumablesCabinet.id,
        "analytical-storage-cabinet-01",
        "drawer",
        "Drawer 02",
        `${consumablesCabinet.indexCode}-DR-02`,
        1,
      ),
      id: "analytical-storage-drawer-02",
      roomId: ANALYTICAL_ROOM_ID,
      normalizedBounds: { x: 0, y: 0.42, z: -0.02, width: 0.9, depth: 0.88, height: 0.18 },
    },
  ];
  storageLocations[0].childIds = ["analytical-storage-drawer-01", "analytical-storage-drawer-02"];
  consumablesCabinet.childLocationIds = ["analytical-storage-cabinet-01"];

  const equipmentByIndex = new Map(objects.map((object) => [object.indexCode, object]));
  const equipmentRecords = [
    {
      id: "analytical-equipment-record-020",
      objectId: equipmentByIndex.get("AIC-CHR-A-EQ-020")!.id,
      equipmentId: "HPLC-AIC-020",
      name: "Modular HPLC system A",
      imageSrc: "/images/equipment/hplc-system-reference.png",
      manufacturer: "Shimadzu reference class",
      model: "Nexera-class modular stack",
      serialNumber: "AIC-HPLC-2026-020",
      status: "active" as const,
      responsiblePerson: "Analytical Core",
      lastServiceDate: "2026-05-22",
      nextServiceDate: "2026-11-22",
      powerRequirements: "100-240 V / 15 A",
      waterRequirements: "None",
      gasRequirements: "None",
      drainRequired: false,
      ventilationRequired: false,
      notes: "Modular pump, autosampler, detector, solvent tray, and rear service connections.",
    },
    {
      id: "analytical-equipment-record-021",
      objectId: equipmentByIndex.get("AIC-CHR-A-EQ-021")!.id,
      equipmentId: "GC-AIC-021",
      name: "Gas chromatograph A",
      imageSrc: "/images/equipment/gas-chromatograph-reference.png",
      manufacturer: "Shimadzu reference class",
      model: "Nexis-class GC",
      serialNumber: "AIC-GC-2026-021",
      status: "active" as const,
      responsiblePerson: "Analytical Core",
      lastServiceDate: "2026-04-12",
      nextServiceDate: "2026-10-12",
      powerRequirements: "200-240 V / 20 A",
      waterRequirements: "None",
      gasRequirements: "Helium, hydrogen, air",
      drainRequired: false,
      ventilationRequired: true,
      notes: "Instrument oven, dual injection ports, gas connections, and rear service clearance.",
    },
    {
      id: "analytical-equipment-record-022",
      objectId: equipmentByIndex.get("AIC-CHR-A-EQ-022")!.id,
      equipmentId: "UV-AIC-022",
      name: "UV-Vis spectrophotometer",
      imageSrc: "/images/equipment/spectrophotometer-reference.png",
      manufacturer: "Shimadzu reference class",
      model: "UV-1900i-class",
      serialNumber: "AIC-UV-2026-022",
      status: "active" as const,
      responsiblePerson: "Spectroscopy Group",
      lastServiceDate: "2026-03-18",
      nextServiceDate: "2027-03-18",
      powerRequirements: "100-240 V / 5 A",
      waterRequirements: "None",
      gasRequirements: "None",
      drainRequired: false,
      ventilationRequired: false,
      notes: "Sample compartment and optical bench require a vibration-stable support surface.",
    },
    {
      id: "analytical-equipment-record-023",
      objectId: equipmentByIndex.get("AIC-CHR-A-EQ-023")!.id,
      equipmentId: "MPR-AIC-023",
      name: "Multimode plate reader",
      imageSrc: "/models/hero/renders/plate-reader-isometric.png",
      manufacturer: "Thermo Fisher reference class",
      model: "Multiskan-class reader",
      serialNumber: "AIC-MPR-2026-023",
      status: "reserved" as const,
      responsiblePerson: "Bioanalysis Group",
      lastServiceDate: "2026-02-09",
      nextServiceDate: "2027-02-09",
      powerRequirements: "100-240 V / 5 A",
      waterRequirements: "None",
      gasRequirements: "None",
      drainRequired: false,
      ventilationRequired: false,
      notes: "Maintain front tray clearance and rear ventilation space.",
    },
    {
      id: "analytical-equipment-record-024",
      objectId: equipmentByIndex.get("AIC-CHR-A-EQ-024")!.id,
      equipmentId: "MCF-AIC-024",
      name: "Microcentrifuge",
      imageSrc: "/models/hero/renders/microcentrifuge-isometric.png",
      manufacturer: "Eppendorf reference class",
      model: "5425-class",
      serialNumber: "AIC-MCF-2026-024",
      status: "service-due" as const,
      responsiblePerson: "Analytical Core",
      lastServiceDate: "2025-08-14",
      nextServiceDate: "2026-08-14",
      powerRequirements: "100-240 V / 8 A",
      waterRequirements: "None",
      gasRequirements: "None",
      drainRequired: false,
      ventilationRequired: false,
      notes: "Annual rotor inspection and lid-latch verification are due.",
    },
    {
      id: "analytical-equipment-record-025",
      objectId: equipmentByIndex.get("AIC-CHR-A-EQ-025")!.id,
      equipmentId: "HPS-AIC-025",
      name: "Hotplate stirrer",
      imageSrc: "/models/hero/renders/hotplate-stirrer-isometric.png",
      manufacturer: "IKA reference class",
      model: "C-MAG-class",
      serialNumber: "AIC-HPS-2026-025",
      status: "active" as const,
      responsiblePerson: "Sample Preparation",
      lastServiceDate: "2026-01-12",
      nextServiceDate: "2027-01-12",
      powerRequirements: "100-240 V / 10 A",
      waterRequirements: "None",
      gasRequirements: "None",
      drainRequired: false,
      ventilationRequired: false,
      notes: "Ceramic surface; keep the control face clear and accessible.",
    },
  ];

  return {
    id: ANALYTICAL_ROOM_ID,
    laboratoryId: ANALYTICAL_LAB_ID,
    name: "Chromatography Suite A",
    code: "CHR-A",
    environmentProfileId: ANALYTICAL_CORE_ENVIRONMENT_PROFILE_ID,
    width: ANALYTICAL_ROOM_WIDTH,
    depth: ANALYTICAL_ROOM_DEPTH,
    wallHeight: 3200,
    floorFinish: "light-gray-epoxy",
    wallFinish: "clean-white-panel",
    notes:
      "Reusable analytical-instrument demonstration room showing authored equipment, service context, searchable records, and multi-laboratory navigation.",
    scene: {
      schemaVersion: SCENE_SCHEMA_VERSION,
      id: ANALYTICAL_SCENE_ID,
      roomId: ANALYTICAL_ROOM_ID,
      objects,
      layers: DEFAULT_LAYERS.map((layer) => ({ ...layer })),
      zones: [
        {
          id: ANALYTICAL_ZONE_ID,
          roomId: ANALYTICAL_ROOM_ID,
          code: "INSTR",
          name: "Instrument analysis",
          color: "#008f83",
        },
        {
          id: ANALYTICAL_SUPPORT_ZONE_ID,
          roomId: ANALYTICAL_ROOM_ID,
          code: "SUP",
          name: "Instrument support",
          color: "#5b7790",
        },
      ],
      storageLocations,
      inventoryItems: [
        {
          id: "analytical-inventory-vial-caps",
          name: "Autosampler vial caps, blue",
          imageSrc: "/images/inventory/hplc-vials.png",
          quantity: 18,
          unit: "bags",
          notes: "9 mm screw caps for chromatography autosampler vials.",
          owner: "Analytical Core",
          expiryDate: null,
          storageLocationId: "analytical-storage-drawer-01",
          createdAt: CREATED,
          updatedAt: CREATED,
        },
      ],
      equipmentRecords,
      labelTemplates: [
        {
          id: "analytical-label-standard",
          name: "Standard equipment label",
          widthMm: 70,
          heightMm: 36,
          showBarcode: false,
          showDescription: true,
        },
        {
          id: "analytical-label-compact",
          name: "Compact drawer label",
          widthMm: 50,
          heightMm: 25,
          showBarcode: false,
          showDescription: false,
        },
      ],
      updatedAt: CREATED,
    },
    createdAt: CREATED,
    updatedAt: CREATED,
  };
}

export function createSeedProject(): Project {
  const walls = [
    wall(101, [0, 0], [ROOM_809_WIDTH, 0]),
    wall(102, [ROOM_809_WIDTH, 0], [ROOM_809_WIDTH, 7200]),
    wall(103, [6300, ROOM_809_DEPTH], [3200, ROOM_809_DEPTH]),
    wall(104, [0, 7600], [0, 0]),
    wall(105, [ROOM_809_WIDTH, 7200], [6300, 7200]),
    wall(106, [6300, 7200], [6300, ROOM_809_DEPTH]),
    wall(107, [3200, ROOM_809_DEPTH], [3200, 7600]),
    wall(108, [3200, 7600], [0, 7600]),
  ];
  const sideDoor = sceneObject(110, "single-door", {
    name: "West service entrance",
    indexCode: "LAB-R809-DOOR-01",
    position: { x: 0, y: 6500, z: 0 },
    rotation: { x: 0, y: 0, z: -90 },
    zoneId: null,
  });
  sideDoor.opening = {
    wallId: walls[3].id,
    offset: 1100,
    width: 900,
    sillHeight: 0,
    height: 2100,
    handing: "left",
    swing: "inward",
  };
  const exitDoor = sceneObject(111, "double-door", {
    name: "Main double entrance",
    indexCode: "LAB-R809-DOOR-02",
    position: { x: 4750, y: ROOM_809_DEPTH, z: 0 },
    rotation: { x: 0, y: 0, z: 180 },
    dimensions: { width: 2200, depth: 120, height: 2100 },
    zoneId: null,
  });
  exitDoor.opening = {
    wallId: walls[2].id,
    offset: 1550,
    width: 2200,
    sillHeight: 0,
    height: 2100,
    handing: "right",
    swing: "inward",
  };
  const windows = [1950, 3050, 4150, 5250, 6350].map((x, index) => {
    const object = sceneObject(120 + index, "standard-window", {
      name: `North window ${index + 1}`,
      indexCode: `LAB-R809-WIN-${(index + 1).toString().padStart(2, "0")}`,
      position: { x, y: 0, z: 900 },
      dimensions: { width: 950, depth: 120, height: 1200 },
      zoneId: null,
    });
    object.opening = {
      wallId: walls[0].id,
      offset: x,
      width: object.dimensions.width,
      sillHeight: 900,
      height: 1200,
      handing: "left",
      swing: "sliding",
    };
    return object;
  });

  const authoredObjects: SceneObject[] = [
    ...walls,
    sideDoor,
    exitDoor,
    ...windows,
    sceneObject(1, "base-cabinet", {
      position: { x: 1200, y: 510, z: 0 },
      dimensions: { width: 900, depth: 600, height: 850 },
      indexCode: "LAB-R809-Z01-CAB-001",
      name: "North reagent cabinet",
    }),
    sceneObject(2, "lab-bench", {
      position: { x: 3000, y: 510, z: 0 },
      dimensions: { width: 2400, depth: 750, height: 900 },
      name: "North evaporator bench A",
      indexCode: "LAB-R809-Z01-OBJ-001",
    }),
    sceneObject(3, "lab-bench", {
      position: { x: 5400, y: 510, z: 0 },
      dimensions: { width: 2400, depth: 750, height: 900 },
      name: "North evaporator bench B",
      indexCode: "LAB-R809-Z01-OBJ-002",
    }),
    sceneObject(4, "fume-hood", {
      position: { x: 520, y: 1800, z: 0 },
      rotation: { x: 0, y: 0, z: 90 },
      indexCode: "LAB-R809-Z01-EQ-001",
    }),
    sceneObject(5, "glazed-sliding-cabinet", {
      position: { x: 8150, y: 2350, z: 0 },
      rotation: { x: 0, y: 0, z: 90 },
      indexCode: "LAB-R809-Z01-CAB-002",
      name: "East glazed reagent cabinet",
    }),
    sceneObject(6, "lab-bench", {
      position: { x: 470, y: 3500, z: 0 },
      rotation: { x: 0, y: 0, z: 90 },
      dimensions: { width: 1800, depth: 700, height: 900 },
      name: "West instrument bench",
      indexCode: "LAB-R809-Z02-OBJ-001",
    }),
    sceneObject(7, "stainless-enclosed-basin", {
      position: { x: 470, y: 5200, z: 0 },
      rotation: { x: 0, y: 0, z: 90 },
      name: "West enclosed wash basin",
      indexCode: "LAB-R809-Z02-OBJ-002",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(8, "lab-bench", {
      position: { x: 8250, y: 3700, z: 0 },
      rotation: { x: 0, y: 0, z: 90 },
      dimensions: { width: 1800, depth: 700, height: 900 },
      name: "East processing bench",
      indexCode: "LAB-R809-Z02-OBJ-003",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(9, "tall-cabinet", {
      // Keep indexed media storage on the east perimeter. The previous
      // position intersected the main entrance recess and made the staged
      // demonstration look broken in both plan and cutaway views.
      position: { x: 8050, y: 3600, z: 0 },
      rotation: { x: 0, y: 0, z: 90 },
      indexCode: "LAB-R809-Z01-CAB-003",
      name: "East media cabinet",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(10, "solvent-cabinet", {
      position: { x: 8200, y: 1050, z: 0 },
      rotation: { x: 0, y: 0, z: 90 },
      indexCode: "LAB-R809-Z01-CAB-004",
      name: "North-east solvent cabinet",
    }),
    sceneObject(11, "base-drawer-cabinet", {
      position: { x: 470, y: 7050, z: 0 },
      rotation: { x: 0, y: 0, z: 90 },
      dimensions: { width: 900, depth: 600, height: 850 },
      indexCode: "LAB-R809-Z02-CAB-001",
      name: "West drawer bank",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(12, "lab-freezer", {
      position: { x: 7500, y: 900, z: 0 },
      indexCode: "LAB-R809-Z02-EQ-001",
      name: "PHCbi-style biomedical freezer",
    }),
    sceneObject(13, "island-bench-service-bridge", {
      position: { x: 3000, y: 4100, z: 0 },
      rotation: { x: 0, y: 0, z: 90 },
      dimensions: { width: 3600, depth: 1200, height: 2100 },
      metadata: { supportSurfaceHeight: 900 },
      indexCode: "LAB-R809-Z01-OBJ-003",
      name: "Preparation island",
    }),
    sceneObject(14, "island-bench-service-bridge", {
      position: { x: 5400, y: 4100, z: 0 },
      rotation: { x: 0, y: 0, z: 90 },
      dimensions: { width: 3600, depth: 1200, height: 2100 },
      metadata: { supportSurfaceHeight: 900 },
      indexCode: "LAB-R809-Z02-OBJ-004",
      name: "Analysis island",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(15, "stainless-wash-basin", {
      position: { x: 8230, y: 5700, z: 0 },
      rotation: { x: 0, y: 0, z: 90 },
      dimensions: { width: 1800, depth: 700, height: 1300 },
      metadata: { supportSurfaceHeight: 1200 },
      indexCode: "LAB-R809-Z02-OBJ-005",
      name: "East stainless wash station",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(16, "benchtop-centrifuge", {
      position: { x: 3000, y: 3000, z: 900 },
      indexCode: "LAB-R809-Z01-EQ-002",
      name: "Centrifuge CF-02",
    }),
    sceneObject(17, "analytical-balance", {
      position: { x: 5400, y: 3000, z: 900 },
      indexCode: "LAB-R809-Z02-EQ-002",
      name: "Analytical balance AB-04",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(18, "compound-microscope", {
      position: { x: 5400, y: 4050, z: 900 },
      indexCode: "LAB-R809-Z02-EQ-003",
      name: "Compound microscope MS-12",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(19, "laboratory-chair", {
      position: { x: 2050, y: 3500, z: 0 },
      indexCode: "LAB-R809-Z02-OBJ-006",
    }),
    sceneObject(20, "laboratory-chair", {
      position: { x: 6650, y: 3500, z: 0 },
      indexCode: "LAB-R809-Z02-OBJ-007",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(21, "round-stool", {
      position: { x: 2100, y: 4700, z: 0 },
      indexCode: "LAB-R809-Z01-OBJ-004",
    }),
    sceneObject(22, "round-stool", {
      position: { x: 6600, y: 4700, z: 0 },
      indexCode: "LAB-R809-Z01-OBJ-005",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(23, "round-stool", {
      position: { x: 4100, y: 6200, z: 0 },
      indexCode: "LAB-R809-Z01-OBJ-006",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(24, "fire-extinguisher", {
      position: { x: 3420, y: 8020, z: 0 },
      rotation: { x: 0, y: 0, z: 90 },
      indexCode: "LAB-R809-Z02-SAFE-001",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(25, "eyewash", {
      position: { x: 7900, y: 5100, z: 1200 },
      rotation: { x: 0, y: 0, z: 90 },
      indexCode: "LAB-R809-Z01-SAFE-001",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(26, "rotary-evaporator", {
      position: { x: 2200, y: 510, z: 900 },
      indexCode: "LAB-R809-Z01-EQ-003",
      name: "North rotary evaporator 1",
    }),
    sceneObject(27, "vacuum-cold-trap-system", {
      position: { x: 3550, y: 510, z: 900 },
      indexCode: "LAB-R809-Z02-EQ-004",
      name: "North vacuum cold-trap station",
    }),
    sceneObject(28, "wire-basket-trolley", {
      position: { x: 1450, y: 6900, z: 0 },
      rotation: { x: 0, y: 0, z: 90 },
      indexCode: "LAB-R809-Z02-OBJ-008",
      name: "Room 809 wire trolley",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(29, "autoclave", {
      position: { x: 7050, y: 6600, z: 0 },
      indexCode: "LAB-R809-Z02-EQ-005",
      name: "Top-loading autoclave",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(30, "forced-air-lab-oven", {
      position: { x: 8250, y: 3150, z: 900 },
      rotation: { x: 0, y: 0, z: 90 },
      indexCode: "LAB-R809-Z02-EQ-006",
      name: "Forced-air laboratory oven",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(31, "slotted-angle-storage-rack", {
      position: { x: 2500, y: 6900, z: 0 },
      rotation: { x: 0, y: 0, z: 90 },
      indexCode: "LAB-R809-Z02-CAB-002",
      name: "Room 809 utility rack",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(32, "multi-position-heating-bath", {
      position: { x: 3000, y: 4100, z: 900 },
      indexCode: "LAB-R809-Z01-EQ-004",
      name: "Multi-position heating bath",
    }),
    sceneObject(33, "stainless-process-vessel", {
      position: { x: 3000, y: 4800, z: 900 },
      indexCode: "LAB-R809-Z01-EQ-005",
      name: "Stainless process vessel",
    }),
    sceneObject(34, "retort-stand-assembly", {
      position: { x: 3000, y: 5500, z: 900 },
      indexCode: "LAB-R809-Z01-EQ-006",
      name: "Preparation retort stand",
    }),
    sceneObject(35, "water-bath", {
      position: { x: 5400, y: 4700, z: 900 },
      indexCode: "LAB-R809-Z02-EQ-007",
      name: "Analysis water bath",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(36, "top-loading-balance", {
      position: { x: 5400, y: 5500, z: 900 },
      indexCode: "LAB-R809-Z02-EQ-008",
      name: "Top-loading balance",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(37, "rotary-evaporator", {
      position: { x: 3000, y: 510, z: 900 },
      indexCode: "LAB-R809-Z01-EQ-007",
      name: "North rotary evaporator 2",
    }),
    sceneObject(38, "vortex-mixer", {
      position: { x: 8250, y: 4000, z: 900 },
      rotation: { x: 0, y: 0, z: 90 },
      indexCode: "LAB-R809-Z02-EQ-010",
      name: "Vortex mixer",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(39, "dry-block-heater", {
      position: { x: 8250, y: 4480, z: 900 },
      rotation: { x: 0, y: 0, z: 90 },
      indexCode: "LAB-R809-Z02-EQ-011",
      name: "Dry block heater",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(40, "rolling-bottle-cart", {
      position: { x: 3500, y: 6700, z: 0 },
      rotation: { x: 0, y: 0, z: 90 },
      indexCode: "LAB-R809-Z02-OBJ-009",
      name: "Mobile reagent cart",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(41, "printer", {
      position: { x: 470, y: 4100, z: 900 },
      rotation: { x: 0, y: 0, z: 90 },
      indexCode: "LAB-R809-Z02-EQ-012",
      name: "East documentation printer",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(42, "plastic-basket-tower", {
      position: { x: 4450, y: 6900, z: 0 },
      indexCode: "LAB-R809-Z02-CAB-003",
      name: "Color basket tower",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    sceneObject(43, "lab-refrigerator", {
      position: { x: 6100, y: 6600, z: 0 },
      indexCode: "LAB-R809-Z02-EQ-013",
      name: "Laboratory refrigerator",
      zoneId: ZONE_ANALYSIS_ID,
    }),
    ...[3800, 4600, 5400, 6200].map((x, index) =>
      sceneObject(44 + index, "rotary-evaporator", {
        position: { x, y: 510, z: 900 },
        indexCode: `LAB-R809-Z01-EQ-${(8 + index).toString().padStart(3, "0")}`,
        name: `North rotary evaporator ${index + 3}`,
      }),
    ),
    sceneObject(48, "laboratory-drying-rack", {
      position: { x: 7890, y: 5700, z: 1550 },
      rotation: { x: 0, y: 0, z: 90 },
      indexCode: "LAB-R809-Z02-CAB-004",
      name: "East glassware drying rack",
      zoneId: ZONE_ANALYSIS_ID,
    }),
  ];

  const promoObjectIds = new Set(
    [1, 2, 4, 5, 9, 11, 12, 13, 14, 15, 16, 17, 18, 22, 24, 25, 26, 27, 33, 34, 48].map(seededId),
  );
  const objects = authoredObjects.filter(
    (object) =>
      ["wall", "door", "window"].includes(object.objectType) || promoObjectIds.has(object.id),
  );

  const cabinetOne = objects.find((object) => object.indexCode === "LAB-R809-Z01-CAB-001")!;
  const cabinetTwo = objects.find((object) => object.indexCode === "LAB-R809-Z01-CAB-002")!;
  const drawerBank = objects.find((object) => object.indexCode === "LAB-R809-Z02-CAB-001")!;
  const mediaShelving = objects.find((object) => object.indexCode === "LAB-R809-Z01-CAB-003")!;
  const preparationIsland = objects.find((object) => object.indexCode === "LAB-R809-Z01-OBJ-003")!;
  const analysisIsland = objects.find((object) => object.indexCode === "LAB-R809-Z02-OBJ-004")!;
  const dryingRack = objects.find((object) => object.indexCode === "LAB-R809-Z02-CAB-004")!;
  const storageLocations = [
    location(1, cabinetOne.id, null, "cabinet", "North reagent cabinet", cabinetOne.indexCode, 0),
    location(
      2,
      cabinetOne.id,
      "storage-location-0001",
      "shelf",
      "Shelf 01",
      `${cabinetOne.indexCode}-SH-01`,
      0,
    ),
    location(
      3,
      cabinetOne.id,
      "storage-location-0001",
      "shelf",
      "Shelf 02",
      `${cabinetOne.indexCode}-SH-02`,
      1,
    ),
    location(
      4,
      cabinetOne.id,
      "storage-location-0001",
      "drawer",
      "Drawer 01",
      `${cabinetOne.indexCode}-DR-01`,
      2,
    ),
    location(
      5,
      cabinetOne.id,
      "storage-location-0004",
      "bin",
      "Blue bin 01",
      `${cabinetOne.indexCode}-DR-01-BIN-01`,
      0,
    ),
    location(
      6,
      cabinetTwo.id,
      null,
      "cabinet",
      "East glazed reagent cabinet",
      cabinetTwo.indexCode,
      0,
    ),
    location(
      7,
      cabinetTwo.id,
      "storage-location-0006",
      "compartment",
      "Upper compartment",
      `${cabinetTwo.indexCode}-CP-01`,
      0,
    ),
    location(
      8,
      cabinetTwo.id,
      "storage-location-0006",
      "compartment",
      "Lower compartment",
      `${cabinetTwo.indexCode}-CP-02`,
      1,
    ),
    location(9, drawerBank.id, null, "cabinet", "West drawer bank", drawerBank.indexCode, 0),
    location(
      10,
      drawerBank.id,
      "storage-location-0009",
      "drawer",
      "Drawer 01",
      `${drawerBank.indexCode}-DR-01`,
      0,
    ),
    location(
      11,
      drawerBank.id,
      "storage-location-0009",
      "drawer",
      "Drawer 02",
      `${drawerBank.indexCode}-DR-02`,
      1,
    ),
    location(
      12,
      drawerBank.id,
      "storage-location-0011",
      "bin",
      "Sample bin 01",
      `${drawerBank.indexCode}-DR-02-BIN-01`,
      0,
    ),
    location(
      13,
      mediaShelving.id,
      null,
      "cabinet",
      "East media cabinet",
      mediaShelving.indexCode,
      0,
    ),
    location(
      14,
      mediaShelving.id,
      "storage-location-0013",
      "shelf",
      "Shelf 01",
      `${mediaShelving.indexCode}-SH-01`,
      0,
    ),
    location(
      15,
      mediaShelving.id,
      "storage-location-0013",
      "shelf",
      "Shelf 02",
      `${mediaShelving.indexCode}-SH-02`,
      1,
    ),
    location(
      16,
      mediaShelving.id,
      "storage-location-0013",
      "shelf",
      "Shelf 03",
      `${mediaShelving.indexCode}-SH-03`,
      2,
    ),
    location(
      17,
      preparationIsland.id,
      null,
      "cabinet",
      "Preparation island storage",
      `${preparationIsland.indexCode}-ST`,
      0,
    ),
    location(
      18,
      preparationIsland.id,
      "storage-location-0017",
      "drawer",
      "Rotor accessories drawer",
      `${preparationIsland.indexCode}-ST-DR-01`,
      0,
    ),
    location(
      19,
      preparationIsland.id,
      "storage-location-0017",
      "drawer",
      "Sample preparation drawer",
      `${preparationIsland.indexCode}-ST-DR-02`,
      1,
    ),
    location(
      20,
      preparationIsland.id,
      "storage-location-0017",
      "compartment",
      "Lower cabinet",
      `${preparationIsland.indexCode}-ST-CP-01`,
      2,
    ),
    location(
      21,
      analysisIsland.id,
      null,
      "cabinet",
      "Analysis island storage",
      `${analysisIsland.indexCode}-ST`,
      0,
    ),
    location(
      22,
      analysisIsland.id,
      "storage-location-0021",
      "drawer",
      "Calibration drawer",
      `${analysisIsland.indexCode}-ST-DR-01`,
      0,
    ),
    location(
      23,
      analysisIsland.id,
      "storage-location-0021",
      "drawer",
      "Reference standards drawer",
      `${analysisIsland.indexCode}-ST-DR-02`,
      1,
    ),
    location(24, dryingRack.id, null, "cabinet", "Glassware drying rack", dryingRack.indexCode, 0),
    location(
      25,
      dryingRack.id,
      "storage-location-0024",
      "shelf",
      "Drying positions",
      `${dryingRack.indexCode}-SH-01`,
      0,
    ),
  ];
  const authoredStorageBounds = new Map<string, NonNullable<StorageLocation["normalizedBounds"]>>([
    ["storage-location-0002", { x: 0, y: 0.53, z: 0, width: 0.84, depth: 0.82, height: 0.16 }],
    ["storage-location-0003", { x: 0, y: 0.27, z: 0, width: 0.84, depth: 0.82, height: 0.16 }],
    ["storage-location-0004", { x: 0, y: 0.12, z: -0.03, width: 0.88, depth: 0.86, height: 0.18 }],
    ["storage-location-0005", { x: 0, y: 0.16, z: 0, width: 0.72, depth: 0.68, height: 0.56 }],
    ["storage-location-0007", { x: 0, y: 0.54, z: 0, width: 0.88, depth: 0.86, height: 0.38 }],
    ["storage-location-0008", { x: 0, y: 0.1, z: 0, width: 0.88, depth: 0.86, height: 0.38 }],
    ["storage-location-0010", { x: 0, y: 0.765, z: -0.02, width: 0.9, depth: 0.88, height: 0.16 }],
    ["storage-location-0011", { x: 0, y: 0.594, z: -0.02, width: 0.9, depth: 0.88, height: 0.16 }],
    ["storage-location-0012", { x: 0, y: 0.16, z: 0, width: 0.72, depth: 0.66, height: 0.56 }],
    ["storage-location-0014", { x: 0, y: 0.76, z: 0, width: 0.9, depth: 0.86, height: 0.12 }],
    ["storage-location-0015", { x: 0, y: 0.5, z: 0, width: 0.9, depth: 0.86, height: 0.12 }],
    ["storage-location-0016", { x: 0, y: 0.24, z: 0, width: 0.9, depth: 0.86, height: 0.12 }],
    [
      "storage-location-0018",
      { x: -0.32, y: 0.22, z: -0.38, width: 0.26, depth: 0.82, height: 0.14 },
    ],
    [
      "storage-location-0019",
      { x: 0.32, y: 0.22, z: -0.38, width: 0.26, depth: 0.82, height: 0.14 },
    ],
    ["storage-location-0020", { x: 0, y: 0.12, z: 0.34, width: 0.44, depth: 0.72, height: 0.38 }],
    [
      "storage-location-0022",
      { x: -0.32, y: 0.22, z: -0.38, width: 0.26, depth: 0.82, height: 0.14 },
    ],
    [
      "storage-location-0023",
      { x: 0.32, y: 0.22, z: -0.38, width: 0.26, depth: 0.82, height: 0.14 },
    ],
    ["storage-location-0025", { x: 0, y: 0.5, z: 0, width: 0.9, depth: 0.72, height: 0.62 }],
  ]);
  for (const storageLocation of storageLocations) {
    storageLocation.normalizedBounds = authoredStorageBounds.get(storageLocation.id);
  }
  for (const parent of storageLocations)
    parent.childIds = storageLocations
      .filter((child) => child.parentId === parent.id)
      .map((child) => child.id);
  for (const object of objects)
    object.childLocationIds = storageLocations
      .filter((location) => location.objectId === object.id && !location.parentId)
      .map((location) => location.id);

  const scene = {
    schemaVersion: SCENE_SCHEMA_VERSION,
    id: SCENE_ID,
    roomId: ROOM_ID,
    objects,
    layers: DEFAULT_LAYERS,
    zones: [
      { id: ZONE_PREP_ID, roomId: ROOM_ID, code: "Z01", name: "Preparation", color: "#079987" },
      { id: ZONE_ANALYSIS_ID, roomId: ROOM_ID, code: "Z02", name: "Analysis", color: "#4e7792" },
    ],
    storageLocations,
    inventoryItems: [
      {
        id: "inventory-item-0001",
        imageSrc: "/images/inventory/nitrile-gloves.png",
        name: "Nitrile gloves, M",
        quantity: 8,
        unit: "boxes",
        notes: "Powder-free",
        owner: "Shared",
        expiryDate: null,
        storageLocationId: "storage-location-0004",
        createdAt: CREATED,
        updatedAt: CREATED,
      },
      {
        id: "inventory-item-0002",
        imageSrc: "/images/inventory/pipette-tips-200ul.png",
        name: "Pipette tips, 200 µL",
        quantity: 24,
        unit: "racks",
        notes: "Sterile",
        owner: "Molecular team",
        expiryDate: "2027-06-30",
        storageLocationId: "storage-location-0005",
        createdAt: CREATED,
        updatedAt: CREATED,
      },
      {
        id: "inventory-item-0003",
        imageSrc: "/images/inventory/reference-standards.png",
        name: "Reference standards",
        quantity: 12,
        unit: "vials",
        notes: "Store dry",
        owner: "Analytics",
        expiryDate: "2026-12-20",
        // Keep the competition's default exact-location evidence in the
        // organized analysis island instead of flying the camera to an
        // isolated perimeter drawer bank.
        storageLocationId: "storage-location-0023",
        createdAt: CREATED,
        updatedAt: CREATED,
      },
      {
        id: "inventory-item-0004",
        imageSrc: "/images/inventory/buffer-stock.png",
        name: "Unassigned buffer stock",
        quantity: 6,
        unit: "bottles",
        notes: "Awaiting location",
        owner: "Shared",
        expiryDate: null,
        storageLocationId: null,
        createdAt: CREATED,
        updatedAt: CREATED,
      },
      {
        id: "inventory-item-0005",
        imageSrc: "/images/inventory/hplc-vials.png",
        name: "HPLC autosampler vials, 2 mL",
        quantity: 12,
        unit: "boxes",
        notes: "Clear borosilicate vials with blue screw caps; staged for analytical runs.",
        owner: "Analytical chemistry",
        expiryDate: null,
        storageLocationId: "storage-location-0003",
        createdAt: CREATED,
        updatedAt: CREATED,
      },
      {
        id: "inventory-item-0006",
        imageSrc: "/images/inventory/rotary-evaporator-flask-set.png",
        name: "Rotary evaporator flask set",
        quantity: 6,
        unit: "flasks",
        notes:
          "Three evaporation flasks and three receiving flasks reserved for the BÜCHI R-300 demonstration station.",
        owner: "Organic synthesis",
        expiryDate: null,
        storageLocationId: "storage-location-0002",
        createdAt: CREATED,
        updatedAt: CREATED,
      },
      {
        id: "inventory-item-0007",
        imageSrc: "/images/inventory/rotary-evaporator-flask-set.png",
        name: "Clean round-bottom flasks",
        quantity: 8,
        unit: "flasks",
        notes: "Washed glassware ready for drying and inspection.",
        owner: "Shared glassware",
        expiryDate: null,
        storageLocationId: "storage-location-0025",
        createdAt: CREATED,
        updatedAt: CREATED,
      },
      {
        id: "inventory-item-0008",
        imageSrc: "/images/inventory/reference-standards.png",
        name: "Centrifuge rotor adapters",
        quantity: 12,
        unit: "adapters",
        notes: "Balanced adapter set for the CF-809-02 rotor.",
        owner: "Sample preparation",
        expiryDate: null,
        storageLocationId: "storage-location-0018",
        createdAt: CREATED,
        updatedAt: CREATED,
      },
      {
        id: "inventory-item-0009",
        imageSrc: "/images/inventory/reference-standards.png",
        name: "Balance calibration weight set",
        quantity: 1,
        unit: "set",
        notes: "Traceable calibration weights assigned to AB-809-04.",
        owner: "Analytical chemistry",
        expiryDate: null,
        storageLocationId: "storage-location-0022",
        createdAt: CREATED,
        updatedAt: CREATED,
      },
    ],
    equipmentRecords: [
      {
        id: "equipment-record-0001",
        objectId: objects.find((object) => object.assetDefinitionId === "fume-hood")!.id,
        equipmentId: "FH-809-01",
        name: "Fume hood",
        manufacturer: "Planning example",
        model: "FH-1500",
        serialNumber: "DEMO-FH-8091",
        status: "active" as const,
        responsiblePerson: "Facilities",
        lastServiceDate: "2026-02-10",
        nextServiceDate: "2027-02-10",
        powerRequirements: "230 V / 10 A",
        waterRequirements: "None",
        gasRequirements: "None",
        drainRequired: false,
        ventilationRequired: true,
        notes: "Dimensions are planning values.",
      },
      {
        id: "equipment-record-0002",
        objectId: objects.find((object) => object.assetDefinitionId === "benchtop-centrifuge")!.id,
        equipmentId: "CF-809-02",
        name: "Benchtop centrifuge",
        manufacturer: "LabSpace Demo",
        model: "Spin 24",
        serialNumber: "DEMO-CF-2402",
        status: "service-due" as const,
        responsiblePerson: "A. Tanaka",
        lastServiceDate: "2025-08-01",
        nextServiceDate: "2026-08-01",
        powerRequirements: "230 V / 8 A",
        waterRequirements: "None",
        gasRequirements: "None",
        drainRequired: false,
        ventilationRequired: false,
        notes: "Schedule annual rotor inspection.",
      },
      {
        id: "equipment-record-0003",
        objectId: objects.find((object) => object.assetDefinitionId === "analytical-balance")!.id,
        equipmentId: "AB-809-04",
        name: "Analytical balance",
        manufacturer: "LabSpace Demo",
        model: "Mass 220",
        serialNumber: "DEMO-AB-2204",
        status: "active" as const,
        responsiblePerson: "S. Mori",
        lastServiceDate: "2026-04-15",
        nextServiceDate: "2026-10-15",
        powerRequirements: "100–240 V",
        waterRequirements: "None",
        gasRequirements: "None",
        drainRequired: false,
        ventilationRequired: false,
        notes: "Keep isolated from vibration.",
      },
      {
        id: "equipment-record-0004",
        objectId: objects.find((object) => object.assetDefinitionId === "compound-microscope")!.id,
        equipmentId: "MS-809-12",
        name: "Compound microscope",
        manufacturer: "LabSpace Demo",
        model: "Scope C4",
        serialNumber: "DEMO-MS-1212",
        status: "active" as const,
        responsiblePerson: "K. Ito",
        lastServiceDate: "2026-01-20",
        nextServiceDate: "2027-01-20",
        powerRequirements: "100–240 V",
        waterRequirements: "None",
        gasRequirements: "None",
        drainRequired: false,
        ventilationRequired: false,
        notes: "Cover after use.",
      },
      {
        id: "equipment-record-0005",
        objectId: objects.find((object) => object.indexCode === "LAB-R809-Z01-EQ-003")!.id,
        equipmentId: "RE-809-01",
        name: "BÜCHI rotary evaporator R-300",
        manufacturer: "BÜCHI Labortechnik AG",
        model: "Rotavapor R-300 class",
        serialNumber: "DEMO-RE-3001",
        status: "active" as const,
        responsiblePerson: "Organic synthesis",
        lastServiceDate: "2026-05-12",
        nextServiceDate: "2027-05-12",
        powerRequirements: "100–240 V",
        waterRequirements: "Recirculating coolant loop",
        gasRequirements: "None",
        drainRequired: false,
        ventilationRequired: true,
        notes:
          "Build Week demonstration record. Operate with local exhaust and the indexed flask set from the north reagent cabinet.",
      },
      {
        id: "equipment-record-0006",
        objectId: objects.find((object) => object.indexCode === "LAB-R809-Z02-EQ-001")!.id,
        equipmentId: "FR-809-01",
        name: "Biomedical freezer",
        manufacturer: "PHCbi reference class",
        model: "MDF-U731M-class",
        serialNumber: "DEMO-FR-7311",
        status: "active" as const,
        responsiblePerson: "Shared facilities",
        lastServiceDate: "2026-03-08",
        nextServiceDate: "2027-03-08",
        powerRequirements: "100–240 V",
        waterRequirements: "None",
        gasRequirements: "None",
        drainRequired: false,
        ventilationRequired: true,
        notes: "Maintain rear ventilation clearance and record temperature excursions.",
      },
      {
        id: "equipment-record-0007",
        objectId: objects.find((object) => object.indexCode === "LAB-R809-Z02-EQ-004")!.id,
        equipmentId: "VC-809-01",
        name: "Vacuum cold-trap station",
        manufacturer: "Laboratory reference class",
        model: "Recirculating trap station",
        serialNumber: "DEMO-VC-8091",
        status: "service-due" as const,
        responsiblePerson: "Organic synthesis",
        lastServiceDate: "2026-06-02",
        nextServiceDate: "2026-08-02",
        powerRequirements: "100–240 V",
        waterRequirements: "Closed recirculating loop",
        gasRequirements: "None",
        drainRequired: false,
        ventilationRequired: true,
        notes: "Paired with the rotary evaporator workflow; coolant-loop service is due.",
      },
    ],
    labelTemplates: [
      {
        id: "label-template-standard",
        name: "Standard location label",
        widthMm: 70,
        heightMm: 36,
        showBarcode: false,
        showDescription: true,
      },
      {
        id: "label-template-compact",
        name: "Compact drawer label",
        widthMm: 50,
        heightMm: 25,
        showBarcode: false,
        showDescription: false,
      },
    ],
    updatedAt: CREATED,
  };
  const competitionObjectIds = new Set(
    [1, 2, 5, 9, 12, 14, 15, 17, 22, 25, 26, 27].map(seededId),
  );
  const competitionObjects = scene.objects.filter(
    (object) =>
      ["wall", "door", "window"].includes(object.objectType) ||
      competitionObjectIds.has(object.id),
  );
  const competitionObjectIdSet = new Set(competitionObjects.map((object) => object.id));
  const competitionLocations = scene.storageLocations.filter((location) =>
    competitionObjectIdSet.has(location.objectId),
  );
  const competitionLocationIdSet = new Set(competitionLocations.map((location) => location.id));
  const competitionScene: Scene = {
    ...scene,
    objects: competitionObjects,
    storageLocations: competitionLocations.map((location) => ({
      ...location,
      parentId:
        location.parentId && competitionLocationIdSet.has(location.parentId)
          ? location.parentId
          : null,
      childIds: location.childIds.filter((id) => competitionLocationIdSet.has(id)),
    })),
    inventoryItems: scene.inventoryItems.filter(
      (item) =>
        item.storageLocationId === null || competitionLocationIdSet.has(item.storageLocationId),
    ),
    equipmentRecords: scene.equipmentRecords.filter((record) =>
      competitionObjectIdSet.has(record.objectId),
    ),
  };
  const analyticalRoom = createAnalyticalCoreRoom();
  const starterRoom: Room = {
    id: STARTER_ROOM_ID,
    laboratoryId: LAB_ID,
    name: "Empty lab plan",
    code: "PLAN-01",
    environmentProfileId: null,
    width: 10_000,
    depth: 8_000,
    wallHeight: 3_000,
    floorFinish: "light-gray-epoxy",
    wallFinish: "clean-white-panel",
    notes:
      "Clean professional starting canvas. Use Demo room to open the curated Room 809 Build Week case study.",
    scene: {
      schemaVersion: SCENE_SCHEMA_VERSION,
      id: STARTER_SCENE_ID,
      roomId: STARTER_ROOM_ID,
      objects: [],
      layers: createDefaultLayers({
        idForRole: (role) => `starter-layer-${role}`,
      }),
      zones: [],
      storageLocations: [],
      inventoryItems: [],
      equipmentRecords: [],
      labelTemplates: [
        {
          id: "starter-label-standard",
          name: "Standard location label",
          widthMm: 70,
          heightMm: 36,
          showBarcode: false,
          showDescription: true,
        },
        {
          id: "starter-label-compact",
          name: "Compact drawer label",
          widthMm: 50,
          heightMm: 25,
          showBarcode: false,
          showDescription: false,
        },
      ],
      updatedAt: CREATED,
    },
    createdAt: CREATED,
    updatedAt: CREATED,
  };

  // DEMO-01 is the user's authored presentation room, exported as a sanitized
  // source-controlled fixture so a clean clone includes the exact video scene.
  // It remains an ordinary editable room; the immutable factory template above
  // continues to power explicit "Create demo from template" and reset actions.
  const showcaseDemoRoom = RoomSchema.parse({
    ...structuredClone(demo01Showcase),
    id: SHOWCASE_DEMO_ROOM_ID,
    laboratoryId: LAB_ID,
    roomKind: "demo",
    viewState: {
      ...demo01Showcase.viewState,
      environmentContextVisible: false,
    },
  });

  return ProjectSchema.parse({
    schemaVersion: SCENE_SCHEMA_VERSION,
    id: PROJECT_ID,
    name: "LabSpace Professional Laboratory Index",
    laboratories: [
      {
        id: LAB_ID,
        projectId: PROJECT_ID,
        name: "Advanced Research Laboratory",
        code: "LAB",
        roomIds: [STARTER_ROOM_ID, ROOM_ID, SHOWCASE_DEMO_ROOM_ID],
      },
      {
        id: ANALYTICAL_LAB_ID,
        projectId: PROJECT_ID,
        name: "Analytical Instrument Core",
        code: "AIC",
        roomIds: [ANALYTICAL_ROOM_ID],
      },
    ],
    rooms: [
      {
        id: ROOM_ID,
        laboratoryId: LAB_ID,
        name: "Room 809 demo template",
        code: "R809",
        roomKind: "demo-template",
        demoSavedAt: null,
        viewState: {
          cameraPreset: "isometric",
          presentation: "split",
          floorVisible: true,
          wallTransparent: false,
          environmentContextVisible: false,
          cameraPose: null,
        },
        environmentProfileId: null,
        width: ROOM_809_WIDTH,
        depth: ROOM_809_DEPTH,
        wallHeight: 3000,
        floorFinish: "warm-welded-vinyl",
        wallFinish: "clean-white-panel",
        notes:
          "Storage-first Build Week demonstration based on Room 809, staged as a simple equipment-to-cabinet Digital Twin workflow. New rooms remain blank.",
        scene: competitionScene,
        createdAt: CREATED,
        updatedAt: CREATED,
      },
      analyticalRoom,
      starterRoom,
      showcaseDemoRoom,
    ],
    activeRoomId: STARTER_ROOM_ID,
    createdAt: CREATED,
    updatedAt: CREATED,
  });
}
