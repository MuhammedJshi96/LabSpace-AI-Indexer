import { describe, expect, it } from "vitest";
import {
  assetPreviewCameraDistance,
  assetPreviewCameraPose,
  type AssetPreviewView,
} from "../../src/domain/asset-preview-camera";

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

  it("maps every named preset to a stable authored axis and common target", () => {
    const dimensions = { width: 0.58, depth: 0.48, height: 0.38 };
    const poses = Object.fromEntries(
      (["isometric", "front", "back", "left", "right", "top"] as AssetPreviewView[]).map((view) => [
        view,
        assetPreviewCameraPose(view, dimensions, 1.5),
      ]),
    ) as Record<AssetPreviewView, ReturnType<typeof assetPreviewCameraPose>>;

    for (const pose of Object.values(poses)) {
      expect(pose.target).toEqual([0, dimensions.height / 2, 0]);
      expect(
        Math.hypot(...pose.position.map((value, index) => value - pose.target[index])),
      ).toBeCloseTo(pose.distance);
    }

    expect(poses.front.position[2]).toBeGreaterThan(0);
    expect(poses.back.position[2]).toBeLessThan(0);
    expect(poses.left.position[0]).toBeLessThan(0);
    expect(poses.right.position[0]).toBeGreaterThan(0);
    expect(poses.top.position[1]).toBeGreaterThan(poses.top.target[1]);
    expect(poses.isometric.position.every((coordinate) => coordinate > 0)).toBe(true);
  });
});
