/** Explicit finish review, preserving every geometry byte and storage binding. */
import { readFileSync, writeFileSync, readdirSync, renameSync } from "node:fs";
import { setTimeout as pause } from "node:timers/promises";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { Buffer } from "node:buffer";
import { argv, stdout } from "node:process";
import { buildSurfaceMaps, SURFACE_REVISION, surfaceRevision } from "./build-surface-maps.mjs";

export const FINISH_REVISION = "catalog-polish-r7";
const root = fileURLToPath(new URL("../", import.meta.url));
const reviewedGroups = {
  architecture:
    "structural-column single-door double-door sliding-door narrow-lite-door cleanroom-glazed-door double-sliding-door standard-window wide-window sliding-window observation-window pass-through-window wide-lite-door single-transom-door double-transom-door double-egress-door integral-blind-window clerestory-window",
  casework:
    "lab-bench lab-bench-sink lab-bench-overhead stainless-wash-basin stainless-enclosed-basin island-bench-service-bridge corner-lab-bench center-island-bench mobile-bench asymmetric-lab-bench institutional-sink-cabinet base-cabinet base-drawer-cabinet sink-cabinet wall-cabinet glass-wall-cabinet tall-cabinet sliding-door-cabinet glazed-sliding-cabinet solvent-cabinet chemical-cabinet flammable-cabinet mobile-drawer locker",
  furniture:
    "office-desk rectangular-table steel-pedestal-desk wood-pedestal-desk maple-steel-desk black-utility-table round-stool laboratory-chair office-chair computer-workstation computer-lab-bench open-shelving heavy-duty-rack pegboard laboratory-drying-rack refrigerator-storage freezer-storage slotted-angle-storage-rack plastic-basket-tower wire-basket-trolley rolling-bottle-cart",
  instruments:
    "fume-hood biosafety-cabinet laminar-flow hplc-system gas-chromatograph benchtop-centrifuge floor-centrifuge microcentrifuge incubator shaking-incubator autoclave compound-microscope stereo-microscope analytical-balance top-loading-balance hotplate-stirrer water-bath dry-block-heater vortex-mixer pcr-machine real-time-pcr spectrophotometer plate-reader automated-microplate-reader electronic-pipette-station electrophoresis-tank gel-doc lab-refrigerator lab-freezer ultra-low-freezer chest-ultra-low-freezer ice-maker glassware-washer vacuum-pump rotary-evaporator vacuum-cold-trap-system multi-position-heating-bath stainless-process-vessel retort-stand-assembly forced-air-lab-oven gas-cylinder printer high-volume-multifunction-printer compact-ink-tank-printer gpu-analysis-workstation ultrasonic-cleaner recirculating-chiller",
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
  workstations:
    "office-desk rectangular-table steel-pedestal-desk wood-pedestal-desk maple-steel-desk black-utility-table computer-workstation gpu-analysis-workstation",
  racks:
    "open-shelving heavy-duty-rack pegboard laboratory-drying-rack slotted-angle-storage-rack plastic-basket-tower wire-basket-trolley rolling-bottle-cart",
  coldStorage:
    "refrigerator-storage freezer-storage lab-refrigerator lab-freezer ultra-low-freezer chest-ultra-low-freezer",
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
  benchStructure: { color: [0.36, 0.35, 0.37, 1], metal: 0, rough: 0.45 },
  benchFace: { color: [0.43, 0.415, 0.435, 1], metal: 0, rough: 0.43 },
  structure: { color: [0.53, 0.55, 0.55, 1], metal: 0, rough: 0.43 },
  face: { color: [0.68, 0.7, 0.69, 1], metal: 0, rough: 0.4 },
  stainless: { color: [0.57, 0.6, 0.62, 1], metal: 1, rough: 0.26 },
  hardware: { color: [0.7, 0.73, 0.75, 1], metal: 1, rough: 0.2 },
  lockerFace: { color: [0.34, 0.39, 0.42, 1], metal: 0, rough: 0.3 },
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

// These finishes name the visible coating, not the substrate below it. Never
// turn them into conductors, even if old authored data used a small metal factor.
const dielectricNames =
  /paint|powder coat|enamel|polymer|polyamide|laminate|vinyl|rubber|phenolic/i;

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
    pbr.metallicFactor = 1;
    pbr.roughnessFactor = 0.26;
    action = "brushed-satin-response";
  } else if (bright.has(result.name)) {
    pbr.metallicFactor = 1;
    pbr.roughnessFactor = 0.2;
    action = "controlled-hardware-reflections";
  } else if (enamel.has(result.name)) {
    pbr.metallicFactor = 0;
    pbr.roughnessFactor = 0.4;
    action = "smooth-enamel-no-photographic-overlay";
  } else if (
    ["Black phenolic worktop - satin", "Black phenolic exposed edge"].includes(result.name)
  ) {
    pbr.baseColorFactor = result.name.includes("exposed")
      ? [0.005, 0.007, 0.007, 1]
      : [0.009, 0.012, 0.011, 1];
    pbr.metallicFactor = 0;
    pbr.roughnessFactor = 0.3;
    if (result.extensions?.KHR_materials_clearcoat)
      result.extensions.KHR_materials_clearcoat.clearcoatFactor = 0.1;
    action = "satin-phenolic-physical-surface";
  } else if (result.name === "Graphite powder coat") {
    // Preserve the already-approved light mechanism body; encode it in the GLB
    // instead of relying on a hidden renderer-side recoloring rule.
    pbr.baseColorFactor = [0.23, 0.25, 0.26, 1];
    pbr.metallicFactor = 0;
    pbr.roughnessFactor = 0.36;
    action = "authored-light-mechanism-finish";
  }
  // Reviewed roles retain contrast, rather than whitening the whole catalog.
  const group = REVIEWED_ASSETS[assetId];
  if (result.name === "Room 809 light gray powder coat") {
    pbr.baseColorFactor = group === "architecture" ? [0.62, 0.64, 0.63, 1] : [0.53, 0.55, 0.55, 1];
    action = "neutral-grey-structural-enamel";
  } else if (result.name === "Warm gray powder coat highlight") {
    pbr.baseColorFactor = [0.68, 0.7, 0.69, 1];
    action = "porcelain-face-contrast";
  } else if (result.name === "Porcelain white instrument enamel") {
    pbr.baseColorFactor = [0.66, 0.68, 0.68, 1];
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
    if (familyFaces.has(result.name))
      role = family === "lockers" ? "lockerFace" : family === "benches" ? "benchFace" : "face";
    else if (familyStructures.has(result.name))
      role = family === "benches" ? "benchStructure" : "structure";
  }
  if (role) {
    const recipe = FAMILY_ROLES[role];
    pbr.baseColorFactor = [...recipe.color];
    pbr.metallicFactor = recipe.metal;
    pbr.roughnessFactor = recipe.rough;
    action = `family-role:${role}`;
  }
  // Paint is a dielectric; only exposed metal receives conductor response.
  // Tiny shared normal/roughness maps add finish, never an albedo recolor.
  let surface;
  if (
    steelAliases.has(result.name) ||
    hardwareAliases.has(result.name) ||
    satin.has(result.name) ||
    bright.has(result.name)
  )
    surface = "brushed";
  else if (result.name.startsWith("Black phenolic")) surface = "phenolic";
  else if (
    [
      "Dark sealed walnut laminate",
      "Dark walnut laminate edge",
      "Sealed light maple laminate",
      "Light maple edge band",
    ].includes(result.name)
  )
    surface = "woodgrain";
  else if (
    enamel.has(result.name) ||
    familyFaces.has(result.name) ||
    familyStructures.has(result.name)
  )
    surface = "enamel";
  else if (
    [
      "Black engineering polymer",
      "Black rubber",
      "Soft black rubber",
      "Black vinyl upholstery",
      "Blue vinyl upholstery",
    ].includes(result.name)
  )
    surface = "polymer";
  if (dielectricNames.test(result.name) && !/glass|glazing/i.test(result.name)) {
    pbr.metallicFactor = 0;
    if (!/rubber|vinyl|phenolic|seam|label/i.test(result.name)) {
      pbr.roughnessFactor = Math.max(pbr.roughnessFactor ?? 0.4, 0.4);
    }
    // An additional clearcoat lobe made paint/laminate look like silver lacquer.
    if (result.extensions?.KHR_materials_clearcoat)
      delete result.extensions.KHR_materials_clearcoat;
  }
  if (result.extras?.labspace_visible_finish) {
    // Authored part-specific finishes supersede legacy material-name recipes.
    // The source generator has already separated pulls from real fasteners.
    role = undefined;
    surface = result.extras.labspace_surface;
    action = `reference-surface:${result.extras.labspace_visible_finish}`;
    if (result.extras.labspace_visible_finish === "laminate") {
      result.name = "Soft grey laboratory laminate";
      pbr.baseColorFactor = [0.43, 0.415, 0.435, 1];
      pbr.roughnessFactor = 0.46;
    } else if (result.extras.labspace_visible_finish === "coated-pull") {
      result.name = "Satin grey coated casework pull";
      pbr.baseColorFactor = [0.37, 0.365, 0.385, 1];
      pbr.roughnessFactor = 0.42;
    }
  }
  if (family === "benches" && result.name === "Black phenolic worktop - satin") {
    // User's latest bench photo: cool charcoal with a restrained plum cast,
    // not bright white or a silver top. Still a nonmetallic resin surface.
    pbr.baseColorFactor = [0.014, 0.011, 0.019, 1];
    pbr.roughnessFactor = 0.34;
    action = "reference-charcoal-phenolic";
  }
  // The user's mesh-like white coating is a texture-only finish. Keep the
  // reference-grey bench colors, black handles, safety colors and bare metal intact.
  const rgb = (pbr.baseColorFactor ?? [1, 1, 1]).slice(0, 3);
  const whiteCoating =
    surface === "enamel" ||
    ["Warm white powder coat", "Powder-coated warm white"].includes(result.name);
  if (
    whiteCoating &&
    pbr.metallicFactor === 0 &&
    Math.min(...rgb) >= 0.32 &&
    Math.max(...rgb) - Math.min(...rgb) < 0.15 &&
    !(result.extensions?.KHR_materials_transmission?.transmissionFactor > 0)
  ) {
    surface = "micrograin";
  }
  const transmission = result.extensions?.KHR_materials_transmission?.transmissionFactor ?? 0;
  if (transmission > 0.5 && /glass|glazing/i.test(result.name)) {
    // Transmission already controls transparency. Multiplying by alpha .2
    // made real glazing disappear and caused incorrect sorting/double blending.
    if (pbr.baseColorFactor) pbr.baseColorFactor[3] = 1;
    result.alphaMode = "OPAQUE";
    if (
      /clear|laminated|safety|vision|low.?iron|borosilicate|observation/i.test(result.name) &&
      !/edge|frost|smok/i.test(result.name)
    ) {
      // Retain the authored cool-blue glass identity; clarity is a roughness /
      // transmission correction, not permission to bleach every pane white.
      pbr.baseColorFactor ??= [0.7, 0.9, 0.93, 1];
      pbr.roughnessFactor = 0.015;
      result.extensions.KHR_materials_transmission.transmissionFactor = 0.98;
    }
  }
  const clearcoat = result.extensions?.KHR_materials_clearcoat;
  if (clearcoat && !clearcoat.clearcoatFactor) delete result.extensions.KHR_materials_clearcoat;
  if (result.extensions && !Object.keys(result.extensions).length) delete result.extensions;
  result.extras = {
    ...result.extras,
    labspace_finish_revision: FINISH_REVISION,
    labspace_finish_action: action,
    labspace_finish_family: family,
    labspace_finish_role: role,
    labspace_env_intensity: 1.0,
    ...(surface
      ? { labspace_surface: surface, labspace_surface_revision: surfaceRevision(surface) }
      : {}),
  };
  return result;
}

export function polishGlb(buffer, id) {
  if (!REVIEWED_ASSETS[id]) throw new Error(`Unreviewed asset: ${id}`);
  const jsonLength = buffer.readUInt32LE(12);
  const doc = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString());
  doc.materials = (doc.materials ?? []).map((material) => reviewMaterial(material, id));
  doc.images ??= [];
  doc.textures ??= [];
  doc.samplers ??= [];
  let sampler = doc.samplers.findIndex((s) => s.name === SURFACE_REVISION);
  if (sampler < 0) {
    sampler = doc.samplers.length;
    doc.samplers.push({
      name: SURFACE_REVISION,
      magFilter: 9729,
      minFilter: 9987,
      wrapS: 10497,
      wrapT: 10497,
    });
  }
  const textureFor = (surface, type) => {
    const uri = `../../materials/pbr/${surface}-${surfaceRevision(surface)}-${type}.png`;
    let source = doc.images.findIndex((image) => image.uri === uri);
    if (source < 0) {
      source = doc.images.length;
      doc.images.push({ uri });
    }
    let index = doc.textures.findIndex(
      (texture) => texture.source === source && texture.sampler === sampler,
    );
    if (index < 0) {
      index = doc.textures.length;
      doc.textures.push({ source, sampler });
    }
    return {
      index,
      extensions: {
        KHR_texture_transform: {
          scale: surface === "micrograin" ? [8, 8] : surface === "woodgrain" ? [3, 3] : [4, 4],
        },
      },
    };
  };
  for (const m of doc.materials) {
    const surface = m.extras.labspace_surface;
    if (!surface) continue;
    m.normalTexture = { ...textureFor(surface, "normal"), scale: 1 };
    m.pbrMetallicRoughness.metallicRoughnessTexture = textureFor(surface, "roughness");
  }
  doc.extensionsUsed = [...new Set([...(doc.extensionsUsed ?? []), "KHR_texture_transform"])];
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
  buildSurfaceMaps(resolve(root, "public/materials/pbr"));
  const dir = resolve(root, "public/models/hero");
  const ids = readdirSync(dir)
    .filter((name) => name.endsWith(".glb"))
    .map((name) => name.slice(0, -4))
    .sort();
  if (ids.length !== Object.keys(REVIEWED_ASSETS).length || ids.some((id) => !REVIEWED_ASSETS[id]))
    throw new Error("Catalog review must cover every authored asset exactly once.");
  const selected = argv
    .slice(2)
    .flatMap((value, index, values) =>
      value === "--asset" && values[index + 1] ? [values[index + 1]] : [],
    );
  const selectedIds = selected.length ? [...new Set(selected)] : ids;
  for (const id of selectedIds) {
    if (!ids.includes(id)) throw new Error(`Unknown authored asset requested for polish: ${id}`);
    const path = resolve(dir, `${id}.glb`);
    // A running dev server may be serving this GLB. Never truncate its live
    // file while a reader is active; publish the complete replacement at once.
    const next = `${path}.next`;
    writeFileSync(next, polishGlb(readFileSync(path), id));
    for (let attempt = 0; ; attempt++) {
      try {
        renameSync(next, path);
        break;
      } catch (error) {
        if (attempt >= 8) throw error;
        await pause(150);
      }
    }
  }
  stdout.write(
    `Reviewed finish recipes written for ${selectedIds.length} assets; geometry and storage bindings preserved.\n`,
  );
}
