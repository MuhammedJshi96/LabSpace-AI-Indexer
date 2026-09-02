import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assetThumbnailKind, HIGH_USE_DETAILED_THUMBNAILS } from "../../src/domain/asset-thumbnail";
import { ASSET_BY_ID, ASSET_CATALOG } from "../../src/domain/assets";
import { assetRenderSource } from "../../src/lib/asset-render-path";
import { authoredAssetRenderSource } from "../../src/lib/hero-render-path";

describe("asset library thumbnails", () => {
  it("routes every built-in fallback to recognizable Room 809 anatomy", () => {
    const genericAssets = ASSET_CATALOG.filter(
      (asset) => !asset.model3d && assetThumbnailKind(asset) === "generic",
    );
    expect(genericAssets.map((asset) => asset.id)).toEqual([]);
  });

  it("covers a meaningful batch of high-use furniture and equipment", () => {
    const kinds = new Set(
      HIGH_USE_DETAILED_THUMBNAILS.map((id) => assetThumbnailKind(ASSET_BY_ID.get(id)!)),
    );
    expect(HIGH_USE_DETAILED_THUMBNAILS.length).toBeGreaterThanOrEqual(18);
    expect(kinds.size).toBeGreaterThanOrEqual(10);
    expect(kinds.has("bench")).toBe(true);
    expect(kinds.has("centrifuge")).toBe(true);
    expect(kinds.has("pump")).toBe(true);
    expect(kinds.has("bench-instrument")).toBe(true);
  });

  it("keeps authored GLB assets on their material-aware isometric renders", () => {
    const authoredAssets = ASSET_CATALOG.filter((asset) => asset.model3d);
    expect(authoredAssets).toHaveLength(115);
    for (const asset of authoredAssets) {
      const source = authoredAssetRenderSource(asset, "isometric");
      expect(source).toMatch(/models\/hero\/renders\/.*-isometric\.png/);
      const diskPath = resolve(
        process.cwd(),
        "public",
        source!.replace(/^\//, "").replace(/\?.*$/, ""),
      );
      expect(existsSync(diskPath), `${asset.id} is missing its isometric render`).toBe(true);
    }
  });

  it("keeps the additive diversity pack on distinct authored envelopes", () => {
    const expectedDimensions = {
      "electronic-pipette-station": { width: 345, depth: 150, height: 260 },
      "automated-microplate-reader": { width: 520, depth: 500, height: 330 },
      "chest-ultra-low-freezer": { width: 900, depth: 760, height: 980 },
      "gpu-analysis-workstation": { width: 1200, depth: 600, height: 1250 },
      "steel-pedestal-desk": { width: 1200, depth: 700, height: 740 },
      "wood-pedestal-desk": { width: 1200, depth: 650, height: 750 },
      "maple-steel-desk": { width: 1400, depth: 700, height: 740 },
      "black-utility-table": { width: 1600, depth: 800, height: 740 },
      "high-volume-multifunction-printer": { width: 580, depth: 480, height: 380 },
      "compact-ink-tank-printer": { width: 480, depth: 420, height: 250 },
      "ultrasonic-cleaner": { width: 360, depth: 330, height: 330 },
    } as const;

    for (const [id, dimensions] of Object.entries(expectedDimensions)) {
      const asset = ASSET_BY_ID.get(id)!;
      expect(asset.defaultDimensions).toEqual(dimensions);
      expect(asset.model3d?.previewSrc).toBe(`/models/hero/${id}.glb`);
      expect(asset.model3d?.authoredDimensions).toEqual(dimensions);
      expect(asset.model3d?.revision).toBe(
        id === "gpu-analysis-workstation"
          ? "diversity-batch14-r14-catalog-polish-r7"
          : "diversity-batch14-r12-catalog-polish-r7",
      );
      for (const view of ["isometric", "top"] as const) {
        const source = authoredAssetRenderSource(asset, view)!;
        expect(source).toContain(`/models/hero/renders/${id}-${view}.png`);
        const diskPath = resolve(
          process.cwd(),
          "public",
          source.replace(/^\//, "").replace(/\?.*$/, ""),
        );
        expect(existsSync(diskPath), `${id} is missing its ${view} render`).toBe(true);
      }
      const deliveredPath = resolve(process.cwd(), "public", "models", "hero", `${id}.glb`);
      const buffer = readFileSync(deliveredPath);
      const jsonLength = buffer.readUInt32LE(12);
      const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString());
      const root = gltf.nodes.find(
        (node: { extras?: { asset_id?: string } }) => node.extras?.asset_id === id,
      );
      const lockedSonicator = id === "ultrasonic-cleaner";
      const upgradedWorkstation = id === "gpu-analysis-workstation";
      expect(root.extras.revision).toBe(
        lockedSonicator
          ? "diversity-batch14-r11"
          : upgradedWorkstation
            ? "diversity-batch14-r14"
            : "diversity-batch14-r12",
      );
      expect(root.extras.construction_continuity_revision).toBe("formed-connected-construction-r7");
      expect(root.extras.authored_form_revision).toBe(
        lockedSonicator
          ? "reference-product-model-r11"
          : upgradedWorkstation
            ? "reference-product-model-r14"
            : "reference-product-model-r12",
      );
      expect(root.extras.source_revision).toBe(
        lockedSonicator
          ? "batch14-product-source-r6"
          : upgradedWorkstation
            ? "batch14-product-source-r9"
            : "batch14-product-source-r7",
      );
      expect(root.extras.source_pbr_revision).toBe("batch14-source-pbr-r1");
      expect(root.extras.source_preserves_part_hierarchy).toBe(true);
      expect(root.extras.source_preserves_unapplied_bevels).toBe(true);
      expect(root.extras.reviewed_fixed_connections.length).toBeGreaterThan(0);
      for (const joint of root.extras.reviewed_fixed_connections) {
        expect(joint.maximumGapM, `${id}/${joint.joint}`).toBeLessThanOrEqual(0.002);
      }
      const sourcePath = resolve(process.cwd(), "assets", "blender", "batch14", `${id}.blend`);
      expect(existsSync(sourcePath), `${id} is missing its editable Blender source`).toBe(true);
      expect(statSync(sourcePath).size, `${id} source is unexpectedly small`).toBeGreaterThan(25_000);
    }
  });

  it("keeps the pipette rack passive and table work surfaces free of invented fittings", () => {
    const pipette = ASSET_BY_ID.get("electronic-pipette-station")!;
    expect(pipette.name).toBe("Laboratory pipette holder");
    expect(pipette.description).toContain("no charging hardware");

    const cleanSurfaceIds = [
      "electronic-pipette-station",
      "gpu-analysis-workstation",
      "steel-pedestal-desk",
      "wood-pedestal-desk",
      "maple-steel-desk",
      "black-utility-table",
      "office-desk",
      "rectangular-table",
      "computer-lab-bench",
      "center-island-bench",
    ] as const;

    for (const id of cleanSurfaceIds) {
      const deliveredPath = resolve(process.cwd(), "public", "models", "hero", `${id}.glb`);
      const buffer = readFileSync(deliveredPath);
      const jsonLength = buffer.readUInt32LE(12);
      const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString());
      const root = gltf.nodes.find(
        (node: { extras?: { asset_id?: string } }) => node.extras?.asset_id === id,
      );
      expect(root, `${id} is missing its authored root`).toBeTruthy();
      if (id === "electronic-pipette-station") {
        expect(root.extras.display_name).toBe("Laboratory Pipette Holder");
        expect(root.extras.holder_type).toBe("passive");
        expect(root.extras.electrical_charging_hardware).toBe(false);
        expect(root.extras.pipette_types).toEqual([
          "manual-micro",
          "manual-standard",
          "electronic",
          "repeater",
          "multichannel",
        ]);
      } else {
        expect(root.extras.clean_work_surface, `${id} worktop policy`).toBe(true);
        expect(root.extras.generic_surface_grommets, `${id} grommet policy`).toBe(false);
        expect(root.extras.decorative_service_markers, `${id} marker policy`).toBe(false);
      }
    }
  });

  it("keeps the remaining equipment fidelity batch on reference-correct envelopes", () => {
    const expectedDimensions = {
      "laminar-flow": { width: 1500, depth: 800, height: 2100 },
      "stereo-microscope": { width: 194, depth: 253, height: 403 },
      "electrophoresis-tank": { width: 405, depth: 180, height: 94 },
      "gel-doc": { width: 360, depth: 448, height: 353 },
      "ice-maker": { width: 633, depth: 506, height: 930 },
      "glassware-washer": { width: 610, depth: 686, height: 876 },
    } as const;

    for (const [id, dimensions] of Object.entries(expectedDimensions)) {
      const asset = ASSET_BY_ID.get(id)!;
      expect(asset.defaultDimensions).toEqual(dimensions);
      expect(asset.model3d?.previewSrc).toBe(`/models/hero/${id}.glb`);
      expect(asset.model3d?.authoredDimensions).toEqual(dimensions);
      expect(asset.model3d?.revision).toBe("remaining-equipment-batch11-r1-catalog-polish-r7");
    }
  });

  it("keeps the manufacturer-informed instrument batch on distinct authored envelopes", () => {
    const expectedDimensions = {
      "floor-centrifuge": { width: 700, depth: 805, height: 1048 },
      incubator: { width: 710, depth: 645, height: 913 },
      "shaking-incubator": { width: 1182, depth: 958, height: 938 },
      "pcr-machine": { width: 260, depth: 470, height: 230 },
      "real-time-pcr": { width: 270, depth: 500, height: 400 },
      "lab-refrigerator": { width: 770, depth: 830, height: 1955 },
    } as const;

    for (const [id, dimensions] of Object.entries(expectedDimensions)) {
      const asset = ASSET_BY_ID.get(id)!;
      expect(asset.defaultDimensions).toEqual(dimensions);
      expect(asset.model3d?.previewSrc).toBe(`/models/hero/${id}.glb`);
      expect(asset.model3d?.authoredDimensions).toEqual(dimensions);
      expect(asset.model3d?.revision).toBe("instruments-batch10-r1-catalog-polish-r7");
    }
  });

  it("keeps prominent Room 809 support equipment on one authored geometry source", () => {
    const supportIds = [
      "rolling-bottle-cart",
      "stainless-process-vessel",
      "retort-stand-assembly",
      "gas-cylinder",
      "eyewash",
      "fire-extinguisher",
    ] as const;

    for (const id of supportIds) {
      const asset = ASSET_BY_ID.get(id)!;
      expect(asset.model3d?.previewSrc).toBe(`/models/hero/${id}.glb`);
      expect(asset.model3d?.authoredDimensions).toEqual(asset.defaultDimensions);
      expect(authoredAssetRenderSource(asset, "isometric")).toContain(
        `/models/hero/renders/${id}-isometric.png`,
      );
      expect(authoredAssetRenderSource(asset, "top")).toContain(
        `/models/hero/renders/${id}-top.png`,
      );
    }
  });

  it("locks the reference-driven casework envelopes against cramped regressions", () => {
    const expectedDimensions = {
      "lab-bench": { width: 1800, depth: 750, height: 900 },
      "lab-bench-overhead": { width: 2400, depth: 750, height: 2100 },
      "center-island-bench": { width: 3000, depth: 1200, height: 900 },
      "island-bench-service-bridge": { width: 3600, depth: 1200, height: 2100 },
    } as const;

    for (const [id, dimensions] of Object.entries(expectedDimensions)) {
      const asset = ASSET_BY_ID.get(id)!;
      expect(asset.defaultDimensions).toEqual(dimensions);
      expect(asset.model3d?.authoredDimensions).toEqual(dimensions);
    }
  });

  it("keeps every professional wall opening on one authored wall-hosted asset", () => {
    const openingIds = [
      "single-door",
      "double-door",
      "sliding-door",
      "narrow-lite-door",
      "cleanroom-glazed-door",
      "double-sliding-door",
      "standard-window",
      "wide-window",
      "sliding-window",
      "observation-window",
      "pass-through-window",
    ] as const;

    for (const id of openingIds) {
      const asset = ASSET_BY_ID.get(id)!;
      expect(asset.connection).toBe("wall");
      expect(["door", "window"]).toContain(asset.objectType);
      expect(asset.model3d?.previewSrc).toBe(`/models/hero/${id}.glb`);
      expect(asset.model3d?.authoredDimensions).toEqual(asset.defaultDimensions);
      expect(authoredAssetRenderSource(asset, "top")).toContain(
        `/models/hero/renders/${id}-top.png`,
      );
    }
  });

  it("keeps only hidden wall-drawing primitives on same-geometry procedural renders", () => {
    const proceduralAssets = ASSET_CATALOG.filter((asset) => !asset.model3d);
    expect(proceduralAssets.map((asset) => asset.id)).toEqual([
      "straight-wall",
      "half-height-wall",
    ]);
    for (const asset of proceduralAssets) {
      for (const view of ["isometric", "top"] as const) {
        const source = assetRenderSource(asset, view);
        expect(source).toContain(`/models/procedural/renders/${asset.id}-${view}.png`);
        const diskPath = resolve(
          process.cwd(),
          "public",
          source.replace(/^\//, "").replace(/\?.*$/, ""),
        );
        expect(existsSync(diskPath), `${asset.id} is missing its ${view} render`).toBe(true);
      }
    }
  });
});
