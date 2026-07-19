import type { Room } from "./schema";

export type EnvironmentPoint = readonly [number, number, number];

export type EnvironmentBottle = {
  position: EnvironmentPoint;
  scale: number;
  material: "amber" | "clear" | "white";
  cap: "blue" | "black" | "white";
};

export type EnvironmentRail = {
  position: EnvironmentPoint;
  length: number;
  axis: "x" | "z";
};

export type EnvironmentMember = {
  position: EnvironmentPoint;
  rotation?: EnvironmentPoint;
  scale: EnvironmentPoint;
};

export type EnvironmentAreaLight = {
  position: EnvironmentPoint;
  rotation: EnvironmentPoint;
  width: number;
  height: number;
  intensity: number;
  color: string;
};

export type EnvironmentTray = {
  position: EnvironmentPoint;
  rotation?: EnvironmentPoint;
  size: EnvironmentPoint;
  color: "silver" | "white" | "blue" | "green";
  compartments?: number;
};

export type EnvironmentGlassware = {
  position: EnvironmentPoint;
  rotation?: EnvironmentPoint;
  scale: number;
  kind: "beaker" | "flask" | "cylinder";
  liquid?: "clear" | "blue" | "amber";
};

export type EnvironmentMonitor = {
  position: EnvironmentPoint;
  rotation?: EnvironmentPoint;
  scale?: number;
};

export type EnvironmentDocumentBoard = {
  position: EnvironmentPoint;
  rotation?: EnvironmentPoint;
  scale?: number;
  accent?: "teal" | "blue" | "green";
};

export type EnvironmentPipetteRack = {
  position: EnvironmentPoint;
  rotation?: EnvironmentPoint;
  scale?: number;
};

export type EnvironmentTubingRun = {
  points: readonly EnvironmentPoint[];
  color: "clear" | "white" | "blue";
  radius?: number;
};

export type EnvironmentConsumableBox = {
  position: EnvironmentPoint;
  rotation?: EnvironmentPoint;
  size: EnvironmentPoint;
  finish: "white" | "silver" | "cardboard";
  accent: "teal" | "blue" | "green" | "amber";
};

export type LaboratoryEnvironmentProfile = {
  id: string;
  name: string;
  ceilingHeight: number;
  lightFixtures: readonly EnvironmentPoint[];
  ceilingRails: readonly EnvironmentRail[];
  vents: readonly EnvironmentPoint[];
  powerDrops: readonly EnvironmentPoint[];
  servicePosts: readonly EnvironmentMember[];
  serviceCrossbars: readonly EnvironmentMember[];
  serviceRails: readonly EnvironmentMember[];
  ductRuns: readonly EnvironmentMember[];
  ductCollars: readonly EnvironmentMember[];
  ductTerminals: readonly EnvironmentMember[];
  bottles: readonly EnvironmentBottle[];
  trays: readonly EnvironmentTray[];
  glassware: readonly EnvironmentGlassware[];
  monitors: readonly EnvironmentMonitor[];
  documentBoards: readonly EnvironmentDocumentBoard[];
  pipetteRacks: readonly EnvironmentPipetteRack[];
  consumableBoxes: readonly EnvironmentConsumableBox[];
  tubingRuns: readonly EnvironmentTubingRun[];
  areaLights: readonly EnvironmentAreaLight[];
};

export const ROOM_809_DEMO_ENVIRONMENT_PROFILE_ID = "room-809-demo";
export const ANALYTICAL_CORE_ENVIRONMENT_PROFILE_ID = "analytical-core-standard";

/**
 * Environmental profiles are optional, room-level presentation data. They do
 * not participate in the selectable/indexed scene, so a laboratory can reuse
 * a profile without inheriting another room's equipment or identity.
 *
 * Room 809 is the first bundled example, not a feature boundary. Additional
 * laboratory templates can be registered here and assigned independently by
 * `Room.environmentProfileId`.
 */
export const ROOM_809_DEMO_ENVIRONMENT_PROFILE: LaboratoryEnvironmentProfile = {
  id: ROOM_809_DEMO_ENVIRONMENT_PROFILE_ID,
  name: "Room 809 reference services",
  ceilingHeight: 3,
  lightFixtures: [
    [-2.7, 2.91, -2.45],
    [0, 2.91, -2.45],
    [2.7, 2.91, -2.45],
    [-2.7, 2.91, 1.45],
    [0, 2.91, 1.45],
    [2.7, 2.91, 1.45],
  ],
  ceilingRails: [
    { position: [0, 2.84, -2.25], length: 7.5, axis: "x" },
    { position: [0, 2.84, 0], length: 7.5, axis: "x" },
    { position: [0, 2.84, 2.25], length: 7.5, axis: "x" },
  ],
  vents: [
    [-2.35, 2.9, 0.15],
    [2.35, 2.9, 0.15],
  ],
  powerDrops: [
    [-1.2, 2.84, -1.5],
    [-1.2, 2.84, 0],
    [-1.2, 2.84, 1.5],
    [1.2, 2.84, -1.5],
    [1.2, 2.84, 0],
    [1.2, 2.84, 1.5],
  ],
  servicePosts: [],
  serviceCrossbars: [],
  serviceRails: [],
  ductRuns: [
    {
      position: [0, 2.66, -3.58],
      rotation: [0, 0, Math.PI / 2],
      scale: [0.2, 7.2, 0.2],
    },
    { position: [3.58, 2.25, -2.05], scale: [0.2, 2.8, 0.2] },
  ],
  ductCollars: [-2.35, 0, 2.35].map((x) => ({
    position: [x, 2.66, -3.58],
    rotation: [0, Math.PI / 2, 0],
    scale: [0.41, 0.41, 0.41],
  })),
  ductTerminals: [{ position: [3.58, 1.78, -0.65], scale: [0.52, 0.14, 0.52] }],
  bottles: [
    { position: [-2.55, 0.91, -3.8], scale: 0.95, material: "amber", cap: "black" },
    { position: [-2.3, 0.91, -3.8], scale: 0.72, material: "clear", cap: "blue" },
    { position: [-2.08, 0.91, -3.8], scale: 0.82, material: "white", cap: "blue" },
    { position: [-1.58, 0.91, -1.25], scale: 0.72, material: "clear", cap: "blue" },
    { position: [-1.35, 0.91, -1.25], scale: 0.95, material: "amber", cap: "black" },
    { position: [0.82, 0.91, -1.25], scale: 0.76, material: "white", cap: "white" },
    { position: [1.05, 0.91, -1.25], scale: 0.66, material: "clear", cap: "blue" },
    { position: [-1.55, 0.91, 0.92], scale: 0.74, material: "amber", cap: "black" },
    { position: [-1.32, 0.91, 0.92], scale: 0.88, material: "clear", cap: "blue" },
    { position: [0.82, 0.91, 0.92], scale: 0.82, material: "white", cap: "blue" },
    { position: [-3.88, 1.15, -1.05], scale: 0.8, material: "amber", cap: "white" },
    { position: [-3.88, 1.48, -1.05], scale: 0.72, material: "white", cap: "blue" },
    { position: [-1.72, 0.91, -0.72], scale: 0.7, material: "clear", cap: "blue" },
    { position: [-1.5, 0.91, -0.72], scale: 0.76, material: "white", cap: "white" },
    { position: [0.72, 0.91, -0.72], scale: 0.74, material: "amber", cap: "black" },
    { position: [0.95, 0.91, -0.72], scale: 0.68, material: "clear", cap: "blue" },
    { position: [1.18, 0.91, 0.6], scale: 0.72, material: "white", cap: "blue" },
  ],
  trays: [
    {
      position: [-0.78, 0.925, -3.76],
      size: [0.42, 0.045, 0.28],
      color: "silver",
      compartments: 4,
    },
    { position: [-1.1, 0.925, -1.18], size: [0.36, 0.045, 0.25], color: "blue", compartments: 3 },
    { position: [1.2, 0.925, 0.92], size: [0.4, 0.045, 0.27], color: "green", compartments: 4 },
    { position: [-1.58, 0.925, -0.66], size: [0.38, 0.045, 0.25], color: "blue", compartments: 4 },
    { position: [0.92, 0.925, -0.66], size: [0.36, 0.045, 0.24], color: "silver", compartments: 4 },
    { position: [1.05, 0.925, 0.56], size: [0.34, 0.045, 0.23], color: "green", compartments: 3 },
  ],
  glassware: [
    { position: [-0.98, 0.94, -3.72], scale: 0.8, kind: "beaker", liquid: "clear" },
    { position: [-0.58, 0.94, -3.72], scale: 0.72, kind: "cylinder", liquid: "blue" },
    { position: [-1.02, 0.94, -1.07], scale: 0.72, kind: "flask", liquid: "amber" },
    { position: [1.33, 0.94, 0.94], scale: 0.66, kind: "beaker", liquid: "blue" },
    { position: [-1.84, 0.94, -0.55], scale: 0.68, kind: "flask", liquid: "clear" },
    { position: [0.65, 0.94, -0.55], scale: 0.72, kind: "beaker", liquid: "amber" },
    { position: [1.34, 0.94, 0.54], scale: 0.64, kind: "cylinder", liquid: "blue" },
  ],
  monitors: [
    { position: [-3.18, 0.92, -3.72], scale: 0.86 },
    { position: [-0.68, 0.92, -3.72], scale: 0.82 },
  ],
  documentBoards: [
    { position: [-3.42, 1.62, -4.18], scale: 0.72, accent: "teal" },
    { position: [2.9, 1.62, -4.18], scale: 0.68, accent: "blue" },
  ],
  pipetteRacks: [
    { position: [-1.58, 0.92, -3.7], scale: 0.88 },
    { position: [1.52, 0.92, -1.12], rotation: [0, Math.PI, 0], scale: 0.82 },
  ],
  consumableBoxes: [
    { position: [-0.35, 0.92, -3.72], size: [0.3, 0.13, 0.2], finish: "white", accent: "blue" },
    { position: [0.02, 0.92, -3.72], size: [0.24, 0.1, 0.18], finish: "silver", accent: "teal" },
    {
      position: [-0.45, 0.92, -1.18],
      rotation: [0, Math.PI, 0],
      size: [0.27, 0.12, 0.19],
      finish: "white",
      accent: "green",
    },
    {
      position: [0.18, 0.92, -1.18],
      rotation: [0, Math.PI, 0],
      size: [0.22, 0.09, 0.17],
      finish: "white",
      accent: "blue",
    },
    { position: [-0.45, 0.92, 0.92], size: [0.3, 0.13, 0.2], finish: "silver", accent: "teal" },
    { position: [1.48, 0.92, 0.92], size: [0.25, 0.1, 0.18], finish: "white", accent: "amber" },
    { position: [-1.28, 0.92, -0.66], size: [0.24, 0.1, 0.18], finish: "white", accent: "teal" },
    { position: [1.28, 0.92, -0.66], size: [0.22, 0.09, 0.17], finish: "silver", accent: "blue" },
    { position: [0.7, 0.92, 0.58], size: [0.25, 0.1, 0.18], finish: "white", accent: "green" },
  ],
  tubingRuns: [
    {
      points: [
        [-2.05, 1.2, -3.68],
        [-2.18, 1.48, -3.58],
        [-2.36, 1.26, -3.62],
        [-2.48, 0.98, -3.72],
      ],
      color: "clear",
      radius: 0.012,
    },
    {
      points: [
        [1.06, 1.26, -1.14],
        [1.2, 1.48, -1.02],
        [1.38, 1.25, -1.08],
        [1.54, 0.98, -1.16],
      ],
      color: "blue",
      radius: 0.01,
    },
  ],
  areaLights: [
    {
      position: [-2.8, 2.72, -1.75],
      rotation: [-Math.PI / 2, 0, 0],
      width: 4.5,
      height: 1.8,
      intensity: 2.1,
      color: "#eaffff",
    },
    {
      position: [2.65, 2.72, -0.35],
      rotation: [-Math.PI / 2, 0, 0],
      width: 4.2,
      height: 1.8,
      intensity: 1.85,
      color: "#f6ffff",
    },
    {
      position: [0, 2.72, 2.25],
      rotation: [-Math.PI / 2, 0, 0],
      width: 5.4,
      height: 1.6,
      intensity: 1.45,
      color: "#edf8f6",
    },
  ],
};

export const ANALYTICAL_CORE_ENVIRONMENT_PROFILE: LaboratoryEnvironmentProfile = {
  id: ANALYTICAL_CORE_ENVIRONMENT_PROFILE_ID,
  name: "Analytical instrument core services",
  ceilingHeight: 3.2,
  lightFixtures: [
    [-3.1, 3.11, -2.15],
    [0, 3.11, -2.15],
    [3.1, 3.11, -2.15],
    [-3.1, 3.11, 0.1],
    [0, 3.11, 0.1],
    [3.1, 3.11, 0.1],
    [-3.1, 3.11, 2.25],
    [0, 3.11, 2.25],
    [3.1, 3.11, 2.25],
  ],
  ceilingRails: [
    { position: [0, 3.04, -1.35], length: 8.45, axis: "x" },
    { position: [0, 3.04, 0.95], length: 8.45, axis: "x" },
    { position: [-3.9, 3.02, 0], length: 5.85, axis: "z" },
    { position: [3.9, 3.02, 0], length: 5.85, axis: "z" },
  ],
  vents: [
    [-2.35, 3.1, 1.15],
    [2.25, 3.1, -1.15],
  ],
  powerDrops: [
    [-1.2, 3.04, -1.0],
    [-1.2, 3.04, 1.1],
    [1.2, 3.04, -1.0],
    [1.2, 3.04, 1.1],
  ],
  servicePosts: [],
  serviceCrossbars: [],
  serviceRails: [
    { position: [0, 2.78, -2.9], scale: [8.1, 0.06, 0.07] },
    { position: [4.05, 2.55, 0.1], rotation: [0, Math.PI / 2, 0], scale: [5.25, 0.06, 0.07] },
  ],
  ductRuns: [
    {
      position: [3.95, 2.78, -0.35],
      scale: [0.22, 2.2, 0.22],
    },
    {
      position: [1.55, 2.86, -2.78],
      rotation: [0, 0, Math.PI / 2],
      scale: [0.22, 4.55, 0.22],
    },
  ],
  ductCollars: [-0.4, 1.15, 2.7].map((x) => ({
    position: [x, 2.86, -2.78],
    rotation: [0, Math.PI / 2, 0],
    scale: [0.42, 0.42, 0.42],
  })),
  ductTerminals: [{ position: [3.95, 1.83, -0.35], scale: [0.52, 0.14, 0.52] }],
  bottles: [
    { position: [-3.2, 0.91, -2.65], scale: 0.72, material: "amber", cap: "black" },
    { position: [-2.98, 0.91, -2.65], scale: 0.64, material: "clear", cap: "blue" },
    { position: [-2.76, 0.91, -2.65], scale: 0.8, material: "white", cap: "blue" },
    { position: [-0.75, 0.91, -0.55], scale: 0.72, material: "clear", cap: "blue" },
    { position: [-0.5, 0.91, -0.55], scale: 0.82, material: "amber", cap: "black" },
    { position: [0.68, 0.91, 0.58], scale: 0.7, material: "white", cap: "white" },
    { position: [0.92, 0.91, 0.58], scale: 0.76, material: "clear", cap: "blue" },
    { position: [3.65, 0.91, 1.5], scale: 0.72, material: "amber", cap: "black" },
  ],
  trays: [
    {
      position: [-3.83, 0.925, 0.2],
      rotation: [0, Math.PI / 2, 0],
      size: [0.38, 0.045, 0.26],
      color: "silver",
      compartments: 3,
    },
    {
      position: [-0.55, 0.925, 0.18],
      rotation: [0, Math.PI / 2, 0],
      size: [0.42, 0.045, 0.28],
      color: "blue",
      compartments: 4,
    },
    {
      position: [0.64, 0.925, 0.3],
      rotation: [0, Math.PI / 2, 0],
      size: [0.36, 0.045, 0.24],
      color: "green",
      compartments: 3,
    },
    { position: [2.72, 0.925, -2.65], size: [0.34, 0.045, 0.24], color: "white", compartments: 3 },
  ],
  glassware: [
    { position: [-3.82, 0.94, -0.05], scale: 0.8, kind: "beaker", liquid: "clear" },
    { position: [-0.52, 0.94, -0.05], scale: 0.68, kind: "flask", liquid: "blue" },
    { position: [0.7, 0.94, 0.08], scale: 0.72, kind: "cylinder", liquid: "clear" },
    { position: [2.8, 0.94, -2.62], scale: 0.66, kind: "beaker", liquid: "amber" },
  ],
  monitors: [
    { position: [-0.15, 0.92, -2.7], scale: 0.9 },
    { position: [0.68, 0.92, 0.08], rotation: [0, Math.PI / 2, 0], scale: 0.8 },
  ],
  documentBoards: [
    { position: [-4.37, 1.52, 1.72], rotation: [0, Math.PI / 2, 0], scale: 0.86, accent: "green" },
    { position: [4.37, 1.5, 1.15], rotation: [0, -Math.PI / 2, 0], scale: 0.82, accent: "blue" },
  ],
  pipetteRacks: [
    { position: [-3.78, 0.92, 0.48], rotation: [0, Math.PI / 2, 0], scale: 0.84 },
    { position: [0.58, 0.92, -0.18], rotation: [0, Math.PI / 2, 0], scale: 0.8 },
  ],
  consumableBoxes: [
    { position: [-2.25, 0.92, -2.65], size: [0.3, 0.13, 0.2], finish: "white", accent: "blue" },
    { position: [-1.85, 0.92, -2.65], size: [0.24, 0.1, 0.18], finish: "silver", accent: "teal" },
    {
      position: [-0.12, 0.92, 0.16],
      rotation: [0, Math.PI / 2, 0],
      size: [0.27, 0.12, 0.19],
      finish: "white",
      accent: "green",
    },
    {
      position: [1.35, 0.92, 0.38],
      rotation: [0, Math.PI / 2, 0],
      size: [0.22, 0.09, 0.17],
      finish: "white",
      accent: "blue",
    },
    { position: [2.22, 0.92, -2.65], size: [0.3, 0.13, 0.2], finish: "silver", accent: "teal" },
    {
      position: [3.64, 0.92, 0.95],
      rotation: [0, -Math.PI / 2, 0],
      size: [0.25, 0.1, 0.18],
      finish: "white",
      accent: "amber",
    },
  ],
  tubingRuns: [
    {
      points: [
        [-2.92, 1.42, -2.6],
        [-2.72, 1.62, -2.5],
        [-2.48, 1.44, -2.58],
        [-2.38, 0.99, -2.68],
      ],
      color: "clear",
      radius: 0.01,
    },
    {
      points: [
        [-1.35, 1.3, -2.6],
        [-1.17, 1.5, -2.45],
        [-0.96, 1.34, -2.5],
        [-0.82, 0.98, -2.64],
      ],
      color: "blue",
      radius: 0.01,
    },
    {
      points: [
        [-0.45, 1.08, 0.38],
        [-0.18, 1.34, 0.5],
        [0.08, 1.18, 0.36],
        [0.26, 0.98, 0.18],
      ],
      color: "white",
      radius: 0.012,
    },
  ],
  areaLights: [
    {
      position: [-2.6, 2.92, -0.85],
      rotation: [-Math.PI / 2, 0, 0],
      width: 4.2,
      height: 1.8,
      intensity: 2.15,
      color: "#f3ffff",
    },
    {
      position: [2.55, 2.92, -0.4],
      rotation: [-Math.PI / 2, 0, 0],
      width: 4.2,
      height: 1.8,
      intensity: 2.0,
      color: "#f8ffff",
    },
    {
      position: [0, 2.92, 2.1],
      rotation: [-Math.PI / 2, 0, 0],
      width: 5.2,
      height: 1.6,
      intensity: 1.55,
      color: "#eef9f6",
    },
  ],
};

export const LABORATORY_ENVIRONMENT_PROFILES: Readonly<
  Record<string, LaboratoryEnvironmentProfile>
> = {
  [ROOM_809_DEMO_ENVIRONMENT_PROFILE.id]: ROOM_809_DEMO_ENVIRONMENT_PROFILE,
  [ANALYTICAL_CORE_ENVIRONMENT_PROFILE.id]: ANALYTICAL_CORE_ENVIRONMENT_PROFILE,
};

export function getLaboratoryEnvironmentProfile(
  room: Pick<Room, "environmentProfileId">,
): LaboratoryEnvironmentProfile | null {
  const profileId = room.environmentProfileId;
  return profileId ? (LABORATORY_ENVIRONMENT_PROFILES[profileId] ?? null) : null;
}

export function hasLaboratoryEnvironmentProfile(room: Pick<Room, "environmentProfileId">) {
  return getLaboratoryEnvironmentProfile(room) !== null;
}
