import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { ASSET_CATALOG } from "../src/domain/assets";
import { AssetDefinitionSchema } from "../src/domain/schema";
import { assetRenderSource } from "../src/lib/asset-render-path";

const ids = new Set<string>();
const errors: string[] = [];
const modelStats: string[] = [];
let authoredRenderCount = 0;
let proceduralRenderCount = 0;
const expectedProceduralRenderFiles = new Set<string>();

function inspectCatalogRender(
  assetId: string,
  source: string,
  publicPath: string,
  expectedWidth: number,
  expectedHeight: number,
  kind: "authored" | "procedural",
) {
  if (!existsSync(publicPath)) {
    errors.push(`${assetId}: ${kind} catalog render is missing at ${source}`);
    return;
  }
  const buffer = readFileSync(publicPath);
  const pngSignature = "89504e470d0a1a0a";
  if (buffer.length < 33 || buffer.subarray(0, 8).toString("hex") !== pngSignature) {
    errors.push(`${assetId}: ${source} is not a valid PNG`);
    return;
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const colorType = buffer[25];
  if (width !== expectedWidth || height !== expectedHeight) {
    errors.push(
      `${assetId}: ${source} is ${width}x${height}; expected ${expectedWidth}x${expectedHeight}`,
    );
  }
  if (colorType !== 6)
    errors.push(`${assetId}: ${source} must retain an RGBA transparency channel`);
  if (kind === "authored") authoredRenderCount += 1;
  else proceduralRenderCount += 1;
}

function inspectGlb(assetId: string, source: string, publicPath: string) {
  const buffer = readFileSync(publicPath);
  if (buffer.length < 20 || buffer.readUInt32LE(0) !== 0x46546c67) {
    errors.push(`${assetId}: ${source} is not a valid binary glTF file`);
    return;
  }
  if (buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length) {
    errors.push(`${assetId}: ${source} has an invalid glTF version or byte length`);
    return;
  }
  const jsonLength = buffer.readUInt32LE(12);
  if (buffer.readUInt32LE(16) !== 0x4e4f534a || 20 + jsonLength > buffer.length) {
    errors.push(`${assetId}: ${source} is missing its glTF JSON chunk`);
    return;
  }
  const document = JSON.parse(
    buffer
      .subarray(20, 20 + jsonLength)
      .toString("utf8")
      .trim(),
  );
  const extensions = new Set<string>(document.extensionsUsed ?? []);
  if (extensions.has("KHR_draco_mesh_compression")) {
    for (const decoderFile of [
      "draco_decoder.js",
      "draco_decoder.wasm",
      "draco_wasm_wrapper.js",
    ]) {
      const decoderPath = resolve(process.cwd(), "public", "draco", "gltf", decoderFile);
      if (!existsSync(decoderPath)) {
        errors.push(
          `${assetId}: ${source} uses Draco but the offline decoder is missing ${decoderFile}`,
        );
      }
    }
  }
  if (!Array.isArray(document.meshes) || document.meshes.length === 0) {
    errors.push(`${assetId}: ${source} contains no meshes`);
  }
  if (buffer.length > 12 * 1024 * 1024) {
    errors.push(`${assetId}: ${source} exceeds the 12 MB authored-model budget`);
  }
  const primitiveCount = (document.meshes ?? []).reduce(
    (count: number, mesh: { primitives?: unknown[] }) => count + (mesh.primitives?.length ?? 0),
    0,
  );
  modelStats.push(
    `${assetId}: ${(buffer.length / 1024 / 1024).toFixed(2)} MB, ${document.meshes?.length ?? 0} meshes, ${primitiveCount} primitives, ${document.materials?.length ?? 0} materials`,
  );
}

for (const asset of ASSET_CATALOG) {
  const parsed = AssetDefinitionSchema.safeParse(asset);
  if (!parsed.success)
    errors.push(`${asset.id}: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`);
  if (ids.has(asset.id)) errors.push(`${asset.id}: duplicate asset ID`);
  ids.add(asset.id);
  if (
    asset.minDimensions.width > asset.defaultDimensions.width ||
    asset.maxDimensions.width < asset.defaultDimensions.width
  )
    errors.push(`${asset.id}: default width is outside its allowed range`);
  if (!asset.tags.length) errors.push(`${asset.id}: search tags are required`);
  if (asset.model3d) {
    for (const source of [asset.model3d.previewSrc, asset.model3d.roomSrc].filter(Boolean)) {
      const publicPath = resolve(process.cwd(), "public", source!.replace(/^\//, ""));
      if (!existsSync(publicPath))
        errors.push(`${asset.id}: authored model is missing at ${source}`);
      else inspectGlb(asset.id, source!, publicPath);
    }
  }
  for (const [view, width, height] of [
    ["isometric", 384, 256],
    ["top", 384, 384],
  ] as const) {
    const source = assetRenderSource(asset, view).replace(/\?.*$/, "");
    if (!asset.model3d) expectedProceduralRenderFiles.add(`${asset.id}-${view}.png`);
    inspectCatalogRender(
      asset.id,
      source,
      resolve(process.cwd(), "public", source.replace(/^\//, "")),
      width,
      height,
      asset.model3d ? "authored" : "procedural",
    );
  }
}

const proceduralRenderDirectory = resolve(
  process.cwd(),
  "public",
  "models",
  "procedural",
  "renders",
);
if (existsSync(proceduralRenderDirectory)) {
  const deliveredProceduralRenders = readdirSync(proceduralRenderDirectory).filter((name) =>
    name.endsWith(".png"),
  );
  for (const name of deliveredProceduralRenders) {
    if (!expectedProceduralRenderFiles.has(name)) {
      errors.push(`stale or undeclared procedural catalog render: ${name}`);
    }
  }
  if (deliveredProceduralRenders.length !== expectedProceduralRenderFiles.size) {
    errors.push(
      `procedural render directory contains ${deliveredProceduralRenders.length} PNGs; expected exactly ${expectedProceduralRenderFiles.size}`,
    );
  }
}

const required = [
  "straight-wall",
  "single-door",
  "standard-window",
  "lab-bench",
  "lab-bench-sink",
  "base-cabinet",
  "tall-cabinet",
  "fume-hood",
  "biosafety-cabinet",
  "benchtop-centrifuge",
  "compound-microscope",
  "analytical-balance",
  "pcr-machine",
  "lab-refrigerator",
  "ultra-low-freezer",
  "autoclave",
  "vacuum-pump",
  "forced-air-lab-oven",
  "multi-position-heating-bath",
  "vacuum-cold-trap-system",
  "eyewash",
  "safety-shower",
  "fire-extinguisher",
];
for (const id of required)
  if (!ids.has(id)) errors.push(`${id}: required starter asset is missing`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${ASSET_CATALOG.length} original asset definitions and authored models.`);
  if (modelStats.length) console.log(modelStats.join("\n"));
  if (authoredRenderCount)
    console.log(`${authoredRenderCount} authored catalog renders validated.`);
  if (proceduralRenderCount)
    console.log(`${proceduralRenderCount} same-geometry procedural catalog renders validated.`);
}
