import { existsSync } from "node:fs";
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
    expect(authoredAssets).toHaveLength(94);
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
      expect(asset.model3d?.revision).toBe("remaining-equipment-batch11-r1");
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
      expect(asset.model3d?.revision).toBe("instruments-batch10-r1");
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
