import { describe, expect, it } from "vitest";
import {
  buildConnectedAnnex,
  buildRoomRectangle,
  type WallFactory,
} from "../../src/domain/room-building";
import { getRoomSpaceFloorPlans } from "../../src/domain/room-geometry";
import { createBlankProject } from "../../src/domain/room-factory";
import type { Room, SceneObject } from "../../src/domain/schema";

function wallFactory(room: Room): WallFactory {
  let sequence = 0;
  return (start, end, options = {}) => {
    sequence += 1;
    const now = new Date().toISOString();
    const template = options.template;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const thickness = template?.wall?.thickness ?? 150;
    const height = template?.wall?.height ?? room.wallHeight;
    return {
      id: `wall-${sequence}`,
      indexCode: `W-${sequence}`,
      name: options.name ?? `Wall ${sequence}`,
      assetDefinitionId: "straight-wall",
      objectType: "wall",
      position: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2, z: 0 },
      dimensions: { width: length, depth: thickness, height },
      rotation: {
        x: 0,
        y: 0,
        z: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI,
      },
      flipHorizontal: false,
      flipVertical: false,
      layerId: room.scene.layers[0].id,
      roomId: room.id,
      spaceId: options.spaceId,
      zoneId: null,
      locked: false,
      visible: true,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      parentObjectId: null,
      childLocationIds: [],
      zIndex: sequence,
      wall: { start, end, thickness, height, halfHeight: false },
    } satisfies SceneObject;
  };
}

function blankRoom() {
  return createBlankProject({
    room: { name: "Room construction", code: "RC-01", width: 8000, depth: 6000 },
  }).rooms[0];
}

describe("direct room construction", () => {
  it("creates a rectangular primary room as one independently closed space", () => {
    const room = blankRoom();
    const result = buildRoomRectangle(
      room,
      { x: 500, y: 700 },
      { x: 8500, y: 6700 },
      wallFactory(room),
    );
    const floors = getRoomSpaceFloorPlans(result.room);

    expect(result.annexSpaceId).toBeNull();
    expect(result.createdWallIds).toHaveLength(4);
    expect(result.room).toMatchObject({ width: 8000, depth: 6000 });
    expect(floors).toHaveLength(1);
    expect(floors[0].areaMm2 / 1_000_000).toBe(48);
  });

  it("turns a rectangle attached to the primary boundary into a side-by-side annex", () => {
    const room = blankRoom();
    const primary = buildRoomRectangle(
      room,
      { x: 0, y: 0 },
      { x: 8000, y: 6000 },
      wallFactory(room),
    ).room;
    const result = buildRoomRectangle(
      primary,
      { x: 8000, y: 1000 },
      { x: 11_000, y: 5000 },
      wallFactory(primary),
    );
    const areas = getRoomSpaceFloorPlans(result.room)
      .map((floor) => floor.areaMm2 / 1_000_000)
      .sort((first, second) => first - second);

    expect(result.annexSpaceId).toBeTruthy();
    expect(result.room.spaces).toHaveLength(2);
    expect(areas).toEqual([12, 48]);
    expect(result.room.width).toBe(11_000);
  });

  it("accepts a freeform exterior outline but rejects an internal partition", () => {
    const room = blankRoom();
    const primary = buildRoomRectangle(
      room,
      { x: 0, y: 0 },
      { x: 8000, y: 6000 },
      wallFactory(room),
    ).room;
    const exterior = buildConnectedAnnex(
      primary,
      [
        { x: 0, y: 1000 },
        { x: -2200, y: 1400 },
        { x: -2600, y: 3800 },
        { x: 0, y: 4600 },
      ],
      wallFactory(primary),
    );

    expect(exterior.room.spaces).toHaveLength(2);
    expect(getRoomSpaceFloorPlans(exterior.room)).toHaveLength(2);
    expect(() =>
      buildConnectedAnnex(
        primary,
        [
          { x: 0, y: 1000 },
          { x: 2200, y: 1400 },
          { x: 2200, y: 3800 },
          { x: 0, y: 4600 },
        ],
        wallFactory(primary),
      ),
    ).toThrow(/outside the main room/i);
  });
});
