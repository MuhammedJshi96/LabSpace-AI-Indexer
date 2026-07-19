import { describe, expect, it } from "vitest";
import { shouldCutawayWall } from "../../src/domain/digital-twin-cutaway";
import type { SceneObject } from "../../src/domain/schema";

const room = { width: 8000, depth: 8000 };

function wall(id: string, start: [number, number], end: [number, number]): SceneObject {
  return {
    id,
    indexCode: `LAB-ROOM-${id.toUpperCase()}`,
    name: id,
    objectType: "wall",
    assetDefinitionId: "straight-wall",
    layerId: "walls",
    roomId: "room",
    zoneId: null,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    dimensions: { width: 8000, depth: 150, height: 3000 },
    visible: true,
    locked: false,
    zIndex: 0,
    metadata: {},
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    parentObjectId: null,
    childLocationIds: [],
    flipHorizontal: false,
    flipVertical: false,
    wall: {
      start: { x: start[0], y: start[1] },
      end: { x: end[0], y: end[1] },
      thickness: 150,
      height: 3000,
      halfHeight: false,
    },
  };
}

describe("camera-aware Digital Twin cutaway", () => {
  it("removes only perimeter walls between the camera and room centre", () => {
    const east = wall("east", [8000, 0], [8000, 8000]);
    const west = wall("west", [0, 0], [0, 8000]);

    expect(shouldCutawayWall(east, room, { x: 6, z: 0 })).toBe(true);
    expect(shouldCutawayWall(west, room, { x: 6, z: 0 })).toBe(false);
  });

  it("updates the cutaway side when the camera orbits", () => {
    const north = wall("north", [0, 8000], [8000, 8000]);
    const south = wall("south", [0, 0], [8000, 0]);

    expect(shouldCutawayWall(north, room, { x: 0, z: 6 })).toBe(true);
    expect(shouldCutawayWall(south, room, { x: 0, z: 6 })).toBe(false);
    expect(shouldCutawayWall(north, room, { x: 0, z: -6 })).toBe(false);
    expect(shouldCutawayWall(south, room, { x: 0, z: -6 })).toBe(true);
  });

  it("preserves interior partitions even when they face the camera", () => {
    const partition = wall("partition", [4400, 2200], [4400, 5800]);
    expect(shouldCutawayWall(partition, room, { x: 6, z: 0 })).toBe(false);
  });
});
