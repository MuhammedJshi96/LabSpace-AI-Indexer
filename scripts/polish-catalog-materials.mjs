/** Explicit finish review, preserving every geometry byte and storage binding. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { Buffer } from "node:buffer";
import { argv, stdout } from "node:process";

export const FINISH_REVISION = "catalog-polish-r3";
const root = fileURLToPath(new URL("../", import.meta.url));
const reviewedGroups = {
  architecture:
    "structural-column single-door double-door sliding-door narrow-lite-door cleanroom-glazed-door double-sliding-door standard-window wide-window sliding-window observation-window pass-through-window wide-lite-door single-transom-door double-transom-door double-egress-door integral-blind-window clerestory-window",
  casework:
    "lab-bench lab-bench-sink lab-bench-overhead stainless-wash-basin stainless-enclosed-basin island-bench-service-bridge corner-lab-bench center-island-bench mobile-bench asymmetric-lab-bench institutional-sink-cabinet base-cabinet base-drawer-cabinet sink-cabinet wall-cabinet glass-wall-cabinet tall-cabinet sliding-door-cabinet glazed-sliding-cabinet solvent-cabinet chemical-cabinet flammable-cabinet mobile-drawer locker",
  furniture:
    "office-desk rectangular-table round-stool laboratory-chair office-chair computer-workstation computer-lab-bench open-shelving heavy-duty-rack pegboard laboratory-drying-rack refrigerator-storage freezer-storage slotted-angle-storage-rack plastic-basket-tower wire-basket-trolley rolling-bottle-cart",
  instruments:
    "fume-hood biosafety-cabinet laminar-flow hplc-system gas-chromatograph benchtop-centrifuge floor-centrifuge microcentrifuge incubator shaking-incubator autoclave compound-microscope stereo-microscope analytical-balance top-loading-balance hotplate-stirrer water-bath dry-block-heater vortex-mixer pcr-machine real-time-pcr spectrophotometer plate-reader electrophoresis-tank gel-doc lab-refrigerator lab-freezer ultra-low-freezer ice-maker glassware-washer vacuum-pump rotary-evaporator vacuum-cold-trap-system multi-position-heating-bath stainless-process-vessel retort-stand-assembly forced-air-lab-oven gas-cylinder printer recirculating-chiller",
  safety: "eyewash safety-shower fire-extinguisher waste-bin biological-waste-bin",
};
export const REVIEWED_ASSETS = Object.fromEntries(
  Object.entries(reviewedGroups).flatMap(([group, ids]) => ids.split(" ").map((id) => [id, group])),
);

// Explicit families, independent of broad UI categories. These govern the same
// finish in the room GLB, Asset Studio and both generated catalog views.
const familyMembers = {
  benches:
    "lab-bench lab-bench-sink lab-bench-overhead island-bench-service-bridge corner-lab-bench center-island-bench mobile-bench asymmetric-lab-bench computer-lab-bench",
  sinks: "stainless-wash-basin stainless-enclosed-basin institutional-sink-cabinet sink-cabinet",
  storage:
    "base-cabinet base-drawer-cabinet wall-cabinet glass-wall-cabinet tall-cabinet sliding-door-cabinet glazed-sliding-cabinet solvent-cabinet mobile-drawer",
  lockers: "locker",
  bins: "waste-bin biological-waste-bin",
  safetyCabinets: "chemical-cabinet flammable-cabinet",
  seating: "round-stool laboratory-chair office-chair",
  workstations: "office-desk rectangular-table computer-workstation",
  racks:
    "open-shelving heavy-duty-rack pegboard laboratory-drying-rack slotted-angle-storage-rack plastic-basket-tower wire-basket-trolley rolling-bottle-cart",
  coldStorage:
    "refrigerator-storage freezer-storage lab-refrigerator lab-freezer ultra-low-freezer",
};
export const FINISH_FAMILIES = {
  ...REVIEWED_ASSETS,
  ...Object.fromEntries(
    Object.entries(familyMembers).flatMap(([family, ids]) =>
      ids.split(" ").map((id) => [id, family]),
    ),
  ),
};
export const FAMILY_ROLES = {
  structure: { color: [0.46, 0.52, 0.52, 1], metal: 0.035, rough: 0.34 },
  face: { color: [0.72, 0.76, 0.74, 1], metal: 0.035, rough: 0.34 },
  stainless: { color: [0.48, 0.54, 0.56, 1], metal: 0.92, rough: 0.28 },
  hardware: { color: [0.62, 0.67, 0.69, 1], metal: 0.94, rough: 0.24 },
  lockerFace: { color: [0.34, 0.41, 0.43, 1], metal: 0.035, rough: 0.34 },
};
const steelAliases = new Set([
  "Brushed stainless steel",
  "Brushed 304 stainless steel",
  "Brushed SUS304 stainless steel",
  "Studio-readable satin stainless steel",
  "Studio-readable satin stainless steel - reference pack",
  "Wash assembly brushed 304 steel",
]);
const hardwareAliases = new Set([
  "Satin anodized aluminum",
  "Reference satin aluminium hardware",
  "Wash assembly polished hardware",
]);
const familyFaces = new Set([
  "Warm gray powder coat highlight",
  "Porcelain white instrument enamel",
  "Institutional porcelain door enamel",
]);
const familyStructures = new Set([
  "Room 809 light gray powder coat",
  "Institutional warm grey casework",
]);

// Exact reviewed material names only. Unlisted finishes are deliberately retained,
// including safety colors, instrument-specific accents, glass, optics and rubber.
const satin = new Set([
  "Brushed stainless steel",
  "Brushed 304 stainless steel",
  "Brushed SUS304 stainless steel",
  "Brushed analytical silver",
  "Satin anodized aluminum",
  "Satin cast aluminum",
  "Machined aluminum heat block",
  "Light bead-blasted aluminum",
  "Clean brushed chamber stainless",
]);
const bright = new Set([
  "Bright brushed stainless steel",
  "Brushed stainless fasteners",
  "Polished stainless hardware",
  "Polished optical hardware",
]);
const enamel = new Set([
  "Room 809 light gray powder coat",
  "Warm gray powder coat highlight",
  "Porcelain white instrument enamel",
  "Cool white instrument polymer",
  "Cool white equipment powder coat",
  "Warm instrument polymer",
  "Cool instrument polymer",
  "Laboratory white polymer",
  "Powder-coated warm white",
]);

export function reviewMaterial(material, assetId) {
  const result = globalThis.structuredClone(material);
  const pbr = (result.pbrMetallicRoughness ??= {});
  let action = "retain-authored-finish";
  if (satin.has(result.name)) {
    pbr.metallicFactor = 0.88;
    pbr.roughnessFactor = 0.29;
    action = "brushed-satin-response";
  } else if (bright.has(result.name)) {
    pbr.metallicFactor = 0.9;
    pbr.roughnessFactor = 0.24;
    action = "controlled-hardware-reflections";
  } else if (enamel.has(result.name)) {
    pbr.metallicFactor = 0.035;
    pbr.roughnessFactor = 0.34;
    action = "smooth-enamel-no-photographic-overlay";
  } else if (
    ["Black phenolic worktop - satin", "Black phenolic exposed edge"].includes(result.name)
  ) {
    pbr.baseColorFactor = result.name.includes("exposed")
      ? [0.005, 0.007, 0.007, 1]
      : [0.009, 0.012, 0.011, 1];
    pbr.metallicFactor = 0;
    pbr.roughnessFactor = 0.36;
    if (result.extensions?.KHR_materials_clearcoat)
      result.extensions.KHR_materials_clearcoat.clearcoatFactor = 0.1;
    action = "satin-phenolic-physical-surface";
  } else if (result.name === "Graphite powder coat") {
    // Preserve the already-approved light mechanism body; encode it in the GLB
    // instead of relying on a hidden renderer-side recoloring rule.
    pbr.baseColorFactor = [0.23, 0.28, 0.27, 1];
    pbr.metallicFactor = 0.12;
    pbr.roughnessFactor = 0.36;
    action = "authored-light-mechanism-finish";
  }
  // Reviewed roles retain contrast, rather than whitening the whole catalog.
  const group = REVIEWED_ASSETS[assetId];
  if (result.name === "Room 809 light gray powder coat") {
    pbr.baseColorFactor = group === "architecture" ? [0.62, 0.66, 0.65, 1] : [0.46, 0.52, 0.52, 1];
    action = "neutral-grey-structural-enamel";
  } else if (result.name === "Warm gray powder coat highlight") {
    pbr.baseColorFactor = [0.72, 0.76, 0.74, 1];
    action = "porcelain-face-contrast";
  } else if (result.name === "Porcelain white instrument enamel") {
    pbr.baseColorFactor = [0.68, 0.73, 0.72, 1];
    action = "soft-instrument-enamel";
  } else if (result.name === "Studio-readable satin stainless steel") {
    pbr.baseColorFactor = [0.48, 0.54, 0.56, 1];
    pbr.metallicFactor = 0.9;
    pbr.roughnessFactor = 0.28;
    action = "true-satin-steel-not-paint";
  }
  const family = FINISH_FAMILIES[assetId];
  let role;
  if (steelAliases.has(result.name)) role = "stainless";
  else if (hardwareAliases.has(result.name)) role = "hardware";
  else if (["benches", "sinks", "storage", "lockers", "workstations"].includes(family)) {
    if (familyFaces.has(result.name)) role = family === "lockers" ? "lockerFace" : "face";
    else if (familyStructures.has(result.name)) role = "structure";
  }
  if (role) {
    const recipe = FAMILY_ROLES[role];
    pbr.baseColorFactor = [...recipe.color];
    pbr.metallicFactor = recipe.metal;
    pbr.roughnessFactor = recipe.rough;
    action = `family-role:${role}`;
  }
  result.extras = {
    ...result.extras,
    labspace_finish_revision: FINISH_REVISION,
    labspace_finish_action: action,
    labspace_finish_family: family,
    ...(role ? { labspace_finish_role: role } : {}),
    labspace_env_intensity: 1.0,
  };
  return result;
}

export function polishGlb(buffer, id) {
  if (!REVIEWED_ASSETS[id]) throw new Error(`Unreviewed asset: ${id}`);
  const jsonLength = buffer.readUInt32LE(12);
  const doc = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString());
  doc.materials = (doc.materials ?? []).map((material) => reviewMaterial(material, id));
  doc.asset.extras = {
    ...doc.asset.extras,
    labspace_finish_revision: FINISH_REVISION,
    labspace_finish_family: FINISH_FAMILIES[id],
  };
  const json = Buffer.from(JSON.stringify(doc));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(padded);
  const tail = buffer.subarray(20 + jsonLength); // Draco/binary data is untouched.
  const header = Buffer.from(buffer.subarray(0, 20));
  header.writeUInt32LE(20 + padded.length + tail.length, 8);
  header.writeUInt32LE(padded.length, 12);
  return Buffer.concat([header, padded, tail]);
}

if (argv[1] && resolve(argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = resolve(root, "public/models/hero");
  const ids = readdirSync(dir)
    .filter((name) => name.endsWith(".glb"))
    .map((name) => name.slice(0, -4))
    .sort();
  if (ids.length !== Object.keys(REVIEWED_ASSETS).length || ids.some((id) => !REVIEWED_ASSETS[id]))
    throw new Error("Catalog review must cover every authored asset exactly once.");
  for (const id of ids) {
    const path = resolve(dir, `${id}.glb`);
    writeFileSync(path, polishGlb(readFileSync(path), id));
  }
  stdout.write(
    `Reviewed finish recipes written for ${ids.length} assets; geometry and storage bindings preserved.\n`,
  );
}
