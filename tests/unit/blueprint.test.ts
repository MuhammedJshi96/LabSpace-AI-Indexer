import { describe, expect, it } from "vitest";
import {
  blueprintTraceToRoomVertices,
  suggestBlueprintRectangle,
} from "../../src/domain/blueprint";

describe("blueprint room import", () => {
  it("calibrates and normalizes a reviewed polygon without persisting image coordinates", () => {
    const result = blueprintTraceToRoomVertices(
      [
        { x: 40, y: 30 },
        { x: 180, y: 30 },
        { x: 210, y: 90 },
        { x: 180, y: 150 },
        { x: 40, y: 150 },
      ],
      50,
    );

    expect(result.vertices).toEqual([
      { xMm: 0, yMm: 0 },
      { xMm: 7000, yMm: 0 },
      { xMm: 8500, yMm: 3000 },
      { xMm: 7000, yMm: 6000 },
      { xMm: 0, yMm: 6000 },
    ]);
    expect(result.widthMm).toBe(8500);
    expect(result.depthMm).toBe(6000);
    expect(result.areaM2).toBe(46.5);
    expect(result.perimeterMm).toBeCloseTo(26_708.2, 0);
  });

  it("detects the strongest rectangular wall outline in a simple blueprint raster", () => {
    const width = 120;
    const height = 90;
    const rgba = new Uint8ClampedArray(width * height * 4).fill(255);
    const setDark = (x: number, y: number) => {
      const offset = (y * width + x) * 4;
      rgba[offset] = 20;
      rgba[offset + 1] = 24;
      rgba[offset + 2] = 26;
      rgba[offset + 3] = 255;
    };
    for (let y = 14; y <= 74; y += 1) {
      setDark(18, y);
      setDark(100, y);
    }
    for (let x = 18; x <= 100; x += 1) {
      setDark(x, 14);
      setDark(x, 74);
    }

    expect(suggestBlueprintRectangle(rgba, width, height)).toEqual({
      confidence: "detected",
      points: [
        { x: 18, y: 14 },
        { x: 100, y: 14 },
        { x: 100, y: 74 },
        { x: 18, y: 74 },
      ],
    });
  });

  it("rejects an uncalibrated or implausibly small room trace", () => {
    expect(() =>
      blueprintTraceToRoomVertices(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
        0,
      ),
    ).toThrow(/known dimension/i);

    expect(() =>
      blueprintTraceToRoomVertices(
        [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 20 },
          { x: 0, y: 20 },
        ],
        100,
      ),
    ).toThrow(/3.00 m/i);
  });
});
