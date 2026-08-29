import { describe, expect, it } from "vitest";
import { inferFacilityFloorFromRoomCode } from "../../src/domain/facility";

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
