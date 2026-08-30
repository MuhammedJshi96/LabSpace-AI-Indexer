import { describe, expect, it } from "vitest";
import { assetPreviewCameraDistance } from "../../src/domain/asset-preview-camera";

describe("asset preview framing", () => {
  it("fits the complete envelope inside both axes at wide and narrow aspect ratios", () => {
    for (const dimensions of [
      { width: 1.4, depth: 0.7, height: 0.74 },
      { width: 1.8, depth: 0.7, height: 1.3 },
      { width: 0.45, depth: 0.45, height: 3 },
    ]) {
      for (const aspect of [0.35, 0.5, 1, 2]) {
        const distance = assetPreviewCameraDistance(dimensions, aspect);
        const angularRadius = Math.asin(Math.hypot(...Object.values(dimensions)) / 2 / distance);
        const vertical = Math.PI / 10;
        const horizontal = Math.atan(Math.tan(vertical) * aspect);
        expect(angularRadius).toBeLessThan(Math.min(vertical, horizontal));
      }
    }
  });
});
