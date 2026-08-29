import { describe, expect, it } from "vitest";
import {
  inferFacilityFloorFromRoomCode,
  nextFacilityRoomPlacement,
  resolveFacilityFloorLayout,
  type FacilityRoomLayoutInput,
} from "../../src/domain/facility";

describe("facility floor inference", () => {
  it.each([
    ["813", 8],
    ["R809", 8],
    ["DEMO-01", 1],
    ["PLAN-15", 15],
  ])("maps %s to Floor %i", (roomCode, expectedFloor) => {
    expect(inferFacilityFloorFromRoomCode(roomCode)).toBe(expectedFloor);
  });

  it.each(["PLAN", "R000", "R1601"])("does not infer an unsupported floor from %s", (roomCode) => {
    expect(inferFacilityFloorFromRoomCode(roomCode)).toBeNull();
  });
});

const room = (
  id: string,
  xMm: number,
  yMm: number,
  widthMm = 8_000,
  depthMm = 6_000,
  rotationDeg = 0,
): FacilityRoomLayoutInput => ({ id, xMm, yMm, widthMm, depthMm, rotationDeg });

describe("facility floor layout", () => {
  it("packs distinct but geometrically overlapping saved rooms into separate bays", () => {
    const layout = resolveFacilityFloorLayout([
      room("one", 0, 0),
      room("two", 1_000, 0),
      room("three", 2_000, 0),
    ]);
    expect(layout).toHaveLength(3);
    for (let index = 0; index < layout.length; index += 1) {
      for (const candidate of layout.slice(index + 1)) {
        const first = layout[index];
        const separatedX =
          Math.abs(first.x - candidate.x) >=
          (first.footprintWidth + candidate.footprintWidth) / 2 + 1.2;
        const separatedZ =
          Math.abs(first.z - candidate.z) >=
          (first.footprintDepth + candidate.footprintDepth) / 2 + 1.2;
        expect(separatedX || separatedZ).toBe(true);
      }
    }
    expect(layout[0].x).toBeLessThan(layout[1].x);
    expect(layout[1].x).toBeLessThan(layout[2].x);
    expect(new Set(layout.map((entry) => entry.z - entry.footprintDepth / 2)).size).toBe(1);
  });

  it("preserves the relative separation of valid saved coordinates", () => {
    const layout = resolveFacilityFloorLayout([room("one", 0, 0), room("two", 10_000, 0)]);
    expect(layout[1].x - layout[0].x).toBe(10);
    expect(layout[1].z - layout[0].z).toBe(0);
  });

  it("places a room beyond the occupied right edge when it joins a floor", () => {
    const placement = nextFacilityRoomPlacement(
      [room("one", 0, 0)],
      room("two", 0, 0, 7_000, 5_000),
    );
    expect(placement.x).toBe(9_200);
    expect(placement.y).toBe(0);
  });
});
