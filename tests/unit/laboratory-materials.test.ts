import { describe, expect, it } from "vitest";
import {
  DEFAULT_LABORATORY_FLOOR_FINISH_ID,
  findLaboratoryFloorFinish,
  LABORATORY_FLOOR_FINISHES,
  laboratoryFloorFinishLabel,
  resolveLaboratoryFloorFinish,
} from "../../src/domain/laboratory-materials";
import {
  DEFAULT_LABORATORY_WALL_FINISH_ID,
  findLaboratoryWallFinish,
  LABORATORY_WALL_FINISHES,
  resolveLaboratoryWallFinish,
  wallFinishForObject,
} from "../../src/domain/laboratory-wall-materials";

describe("laboratory floor finishes", () => {
  it("provides professional finish definitions for both 2D and 3D", () => {
    expect(LABORATORY_FLOOR_FINISHES.map((finish) => finish.id)).toEqual([
      "light-gray-epoxy",
      "sealed-concrete",
      "vinyl-sheet",
      "warm-welded-vinyl",
      "blue-gray-static-dissipative",
      "light-terrazzo-resin",
    ]);
    for (const finish of LABORATORY_FLOOR_FINISHES) {
      expect(finish.planColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(finish.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(finish.patternSpacingMm).toBeGreaterThan(0);
      expect(finish.roughness).toBeGreaterThan(0);
    }
  });

  it("resolves stable ids and legacy or imported aliases", () => {
    expect(findLaboratoryFloorFinish("sealed-concrete")?.label).toBe("Sealed concrete");
    expect(findLaboratoryFloorFinish("Epoxy")?.id).toBe(DEFAULT_LABORATORY_FLOOR_FINISH_ID);
    expect(findLaboratoryFloorFinish("sheet vinyl")?.id).toBe("vinyl-sheet");
    expect(findLaboratoryFloorFinish("warm vinyl")?.id).toBe("warm-welded-vinyl");
    expect(findLaboratoryFloorFinish("warm vinyl")?.textureKind).toBe("vinyl");
  });

  it("preserves unknown imported labels while rendering a safe default", () => {
    expect(findLaboratoryFloorFinish("Quartz flake resin")).toBeUndefined();
    expect(laboratoryFloorFinishLabel("Quartz flake resin")).toBe("Quartz flake resin");
    expect(resolveLaboratoryFloorFinish("Quartz flake resin").id).toBe(
      DEFAULT_LABORATORY_FLOOR_FINISH_ID,
    );
  });
});

describe("laboratory wall finishes", () => {
  it("provides a predefined professional wall library for plan and spatial rendering", () => {
    expect(LABORATORY_WALL_FINISHES).toHaveLength(6);
    expect(LABORATORY_WALL_FINISHES[0].id).toBe(DEFAULT_LABORATORY_WALL_FINISH_ID);
    for (const finish of LABORATORY_WALL_FINISHES) {
      expect(finish.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(finish.planColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(finish.planEdgeColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(finish.roughness).toBeGreaterThan(0);
    }
  });

  it("supports room defaults and explicit per-wall overrides", () => {
    expect(findLaboratoryWallFinish("satin steel")?.id).toBe("satin-stainless-steel");
    expect(resolveLaboratoryWallFinish("unknown-finish").id).toBe(
      DEFAULT_LABORATORY_WALL_FINISH_ID,
    );
    expect(wallFinishForObject({}, "cool-gray-resin-panel").id).toBe(
      "cool-gray-resin-panel",
    );
    expect(
      wallFinishForObject(
        { wallFinishId: "light-ceramic-tile" },
        "cool-gray-resin-panel",
      ).id,
    ).toBe("light-ceramic-tile");
  });
});
