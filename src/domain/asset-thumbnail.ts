import type { AssetDefinition } from "./schema";

export type AssetThumbnailKind =
  | "wall"
  | "column"
  | "door"
  | "window"
  | "bench"
  | "table"
  | "seat"
  | "cart"
  | "cabinet"
  | "shelving"
  | "hood"
  | "centrifuge"
  | "thermal"
  | "microscope"
  | "balance"
  | "bench-instrument"
  | "washer"
  | "pump"
  | "rotary"
  | "lab-rig"
  | "gas"
  | "workstation"
  | "safety"
  | "waste"
  | "generic";

const exactKinds: Partial<Record<string, AssetThumbnailKind>> = {
  "straight-wall": "wall",
  "half-height-wall": "wall",
  "structural-column": "column",
  "single-door": "door",
  "double-door": "door",
  "sliding-door": "door",
  "narrow-lite-door": "door",
  "cleanroom-glazed-door": "door",
  "double-sliding-door": "door",
  "standard-window": "window",
  "wide-window": "window",
  "sliding-window": "window",
  "observation-window": "window",
  "pass-through-window": "window",
  "lab-bench": "bench",
  "lab-bench-sink": "bench",
  "island-bench-service-bridge": "bench",
  "corner-lab-bench": "bench",
  "center-island-bench": "bench",
  "mobile-bench": "bench",
  "office-desk": "table",
  "rectangular-table": "table",
  "round-stool": "seat",
  "laboratory-chair": "seat",
  "office-chair": "seat",
  "wire-basket-trolley": "cart",
  "rolling-bottle-cart": "cart",
  "base-cabinet": "cabinet",
  "base-drawer-cabinet": "cabinet",
  "sink-cabinet": "cabinet",
  "wall-cabinet": "cabinet",
  "glass-wall-cabinet": "cabinet",
  "tall-cabinet": "cabinet",
  "chemical-cabinet": "cabinet",
  "flammable-cabinet": "cabinet",
  "mobile-drawer": "cabinet",
  "open-shelving": "shelving",
  "heavy-duty-rack": "shelving",
  locker: "cabinet",
  pegboard: "shelving",
  "refrigerator-storage": "thermal",
  "freezer-storage": "thermal",
  "slotted-angle-storage-rack": "shelving",
  "plastic-basket-tower": "shelving",
  "fume-hood": "hood",
  "biosafety-cabinet": "hood",
  "laminar-flow": "hood",
  "hplc-system": "bench-instrument",
  "gas-chromatograph": "bench-instrument",
  "benchtop-centrifuge": "centrifuge",
  "floor-centrifuge": "centrifuge",
  microcentrifuge: "centrifuge",
  incubator: "thermal",
  "shaking-incubator": "thermal",
  autoclave: "thermal",
  "compound-microscope": "microscope",
  "stereo-microscope": "microscope",
  "analytical-balance": "balance",
  "top-loading-balance": "balance",
  "hotplate-stirrer": "bench-instrument",
  "water-bath": "bench-instrument",
  "dry-block-heater": "bench-instrument",
  "vortex-mixer": "bench-instrument",
  "pcr-machine": "bench-instrument",
  "real-time-pcr": "bench-instrument",
  spectrophotometer: "bench-instrument",
  "plate-reader": "bench-instrument",
  "electrophoresis-tank": "bench-instrument",
  "gel-doc": "bench-instrument",
  "lab-refrigerator": "thermal",
  "lab-freezer": "thermal",
  "ultra-low-freezer": "thermal",
  "ice-maker": "thermal",
  "glassware-washer": "washer",
  "vacuum-pump": "pump",
  "rotary-evaporator": "rotary",
  "vacuum-cold-trap-system": "lab-rig",
  "multi-position-heating-bath": "lab-rig",
  "stainless-process-vessel": "lab-rig",
  "retort-stand-assembly": "lab-rig",
  "forced-air-lab-oven": "thermal",
  "gas-cylinder": "gas",
  "computer-workstation": "workstation",
  printer: "workstation",
  eyewash: "safety",
  "safety-shower": "safety",
  "fire-extinguisher": "safety",
  "waste-bin": "waste",
  "biological-waste-bin": "waste",
};

const profileKinds: Partial<Record<AssetDefinition["profile"], AssetThumbnailKind>> = {
  wall: "wall",
  column: "column",
  door: "door",
  window: "window",
  bench: "bench",
  corner: "bench",
  table: "table",
  workstation: "workstation",
  seat: "seat",
  cabinet: "cabinet",
  locker: "cabinet",
  tall: "cabinet",
  shelf: "shelving",
  rack: "shelving",
  hood: "hood",
  scope: "microscope",
  washer: "washer",
  cylinder: "gas",
  safety: "safety",
};

/**
 * Chooses recognizable fallback anatomy when an authored GLB catalog render is
 * not available. The exact map intentionally follows the Room 809 vocabulary;
 * profile fallback keeps imported/custom manifests useful without pretending
 * that an unknown asset is a manufacturer-specific model.
 */
export function assetThumbnailKind(asset: AssetDefinition): AssetThumbnailKind {
  return exactKinds[asset.id] ?? profileKinds[asset.profile] ?? "generic";
}

export const HIGH_USE_DETAILED_THUMBNAILS = [
  "lab-bench-sink",
  "mobile-bench",
  "base-drawer-cabinet",
  "laminar-flow",
  "floor-centrifuge",
  "microcentrifuge",
  "incubator",
  "analytical-balance",
  "hotplate-stirrer",
  "water-bath",
  "pcr-machine",
  "spectrophotometer",
  "electrophoresis-tank",
  "lab-refrigerator",
  "glassware-washer",
  "vacuum-pump",
  "vacuum-cold-trap-system",
  "forced-air-lab-oven",
  "computer-workstation",
] as const;
