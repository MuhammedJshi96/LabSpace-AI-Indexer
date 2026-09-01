import { afterEach, describe, expect, it, vi } from "vitest";
import { roomArea, roomPerimeter } from "../../src/domain/geometry";
import {
  getClosedWallFloorPolygon,
  getRectangularPerimeterBounds,
  getRoomFloorPlan,
  getRoomSpaceFloorPlans,
  normalizeRoomFloorEnvelope,
  synchronizeClosedRoomAfterWallEdit,
  synchronizeRectangularRoomAfterWallEdit,
} from "../../src/domain/room-geometry";
import type { Room, SceneObject } from "../../src/domain/schema";
import { createSeedProject } from "../../src/domain/seed";
import { editWallEndpoint, translateWall } from "../../src/domain/wall-editing";

function loopWalls(points: Array<[number, number]>, close = true): SceneObject[] {
  const template = createSeedProject().rooms[0].scene.objects.find((object) => object.wall)!;
  const edgeCount = close ? points.length : points.length - 1;
  return Array.from({ length: edgeCount }, (_, index) => {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    return {
      ...structuredClone(template),
      id: `custom-wall-${index.toString().padStart(4, "0")}`,
      name: `Custom wall ${index + 1}`,
      indexCode: `CUSTOM-WALL-${index + 1}`,
      position: { x: (start[0] + end[0]) / 2, y: (start[1] + end[1]) / 2, z: 0 },
      dimensions: { ...template.dimensions, width: length },
      rotation: {
        ...template.rotation,
        z: (Math.atan2(end[1] - start[1], end[0] - start[0]) * 180) / Math.PI,
      },
      wall: {
        ...template.wall!,
        start: { x: start[0], y: start[1] },
        end: { x: end[0], y: end[1] },
      },
    };
  });
}

const L_SHAPE: Array<[number, number]> = [
  [0, 0],
  [4000, 0],
  [4000, 1500],
  [2500, 1500],
  [2500, 3000],
  [0, 3000],
];

function rectangularRoomFixture(): Room {
  const template = createSeedProject().rooms[0];
  const walls = loopWalls([
    [0, 0],
    [9600, 0],
    [9600, 8400],
    [0, 8400],
  ]).map((entry, index) => ({ ...entry, name: `Room wall ${index + 1}` }));
  const cabinet = {
    ...structuredClone(
      template.scene.objects.find((object) => object.name === "North reagent cabinet")!,
    ),
    position: { x: 1350, y: 520, z: 0 },
  };
  const door = {
    ...structuredClone(
      template.scene.objects.find((object) => object.name === "West service entrance")!,
    ),
    name: "Preparation entrance",
    position: { x: 900, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    opening: {
      wallId: walls[0].id,
      offset: 900,
      width: 900,
      sillHeight: 0,
      height: 2100,
      handing: "left" as const,
      swing: "inward" as const,
    },
  };
  return {
    ...template,
    width: 9600,
    depth: 8400,
    scene: { ...template.scene, objects: [...walls, cabinet, door] },
  };
}

describe("closed wall floor geometry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("derives the concave Room 809 floor from its measured wall chain", () => {
    const room = createSeedProject().rooms[0];

    expect(getRectangularPerimeterBounds(room.scene.objects)).toBeNull();
    expect(getClosedWallFloorPolygon(room.scene.objects)).toMatchObject({
      areaMm2: 68_611_000,
      perimeterMm: 34_800,
      points: expect.arrayContaining([
        { x: 6300, y: 8690 },
        { x: 3200, y: 7600 },
      ]),
      bounds: {
        minX: 0,
        minY: 0,
        maxX: 8710,
        maxY: 8690,
        width: 8710,
        depth: 8690,
      },
    });
  });

  it("keeps the empty starter floorless until a wall loop is closed", () => {
    const project = createSeedProject();
    const room = project.rooms.find((entry) => entry.id === project.activeRoomId)!;

    expect(room.scene.objects).toHaveLength(0);
    expect(getClosedWallFloorPolygon(room.scene.objects)).toBeNull();

    const openWalls = loopWalls(
      [
        [1500, 1200],
        [6500, 1200],
        [6500, 5200],
        [1500, 5200],
      ],
      false,
    );
    expect(getClosedWallFloorPolygon(openWalls)).toBeNull();
    expect(getClosedWallFloorPolygon(loopWalls([
      [1500, 1200],
      [6500, 1200],
      [6500, 5200],
      [1500, 5200],
    ]))).toMatchObject({
      areaMm2: 20_000_000,
      bounds: { minX: 1500, minY: 1200, maxX: 6500, maxY: 5200 },
    });
  });

  it("repairs an older near-closed outline and replaces the starter envelope", () => {
    const project = createSeedProject();
    const starter = project.rooms.find((entry) => entry.id === project.activeRoomId)!;
    const walls = loopWalls([
      [1500, 1200],
      [6500, 1200],
      [6500, 5200],
      [1500, 5200],
    ]);
    walls.at(-1)!.wall!.end = { x: 1500, y: 1260 };

    const repaired = normalizeRoomFloorEnvelope({
      ...starter,
      scene: { ...starter.scene, objects: walls },
    });

    expect(repaired).toMatchObject({ width: 5000, depth: 4000 });
    expect(getClosedWallFloorPolygon(repaired.scene.objects)?.bounds).toMatchObject({
      minX: 0,
      minY: 0,
      maxX: 5000,
      maxY: 4000,
    });
  });

  it("derives area, perimeter, and bounds for a concave L-shaped loop", () => {
    const walls = loopWalls(L_SHAPE);
    const polygon = getClosedWallFloorPolygon(walls);

    expect(polygon).toMatchObject({
      bounds: { minX: 0, minY: 0, maxX: 4000, maxY: 3000, width: 4000, depth: 3000 },
      areaMm2: 9_750_000,
      perimeterMm: 14_000,
    });
    expect(polygon?.points).toHaveLength(6);

    const templateRoom = createSeedProject().rooms[0];
    const room = { ...templateRoom, scene: { ...templateRoom.scene, objects: walls } };
    expect(roomArea(room)).toBe(9.75);
    expect(roomPerimeter(room)).toBe(14);
    expect(getRoomFloorPlan(room).source).toBe("closed-walls");
  });

  it("accepts a simple skewed loop", () => {
    const polygon = getClosedWallFloorPolygon(
      loopWalls([
        [0, 0],
        [3600, 400],
        [3000, 2800],
        [300, 2400],
      ]),
    );

    expect(polygon).not.toBeNull();
    expect(polygon?.points).toHaveLength(4);
    expect(polygon?.areaMm2).toBeGreaterThan(7_000_000);
  });

  it("keeps the outer floor when partition branches split the room", () => {
    const templateRoom = createSeedProject().rooms[0];
    const open = loopWalls(L_SHAPE, false);
    const branch = {
      ...structuredClone(open[0]),
      id: "branch-wall-0001",
      name: "Branch wall",
      wall: {
        ...open[0].wall!,
        start: { x: 0, y: 0 },
        end: { x: 900, y: 700 },
      },
    };
    const closed = loopWalls(L_SHAPE);
    const partition = {
      ...structuredClone(closed[0]),
      id: "partition-wall-0002",
      name: "Partition wall",
      wall: {
        ...closed[0].wall!,
        start: { x: 0, y: 0 },
        end: { x: 2500, y: 1500 },
      },
    };

    expect(getClosedWallFloorPolygon(open)).toBeNull();
    expect(getClosedWallFloorPolygon([...closed, branch])?.areaMm2).toBe(9_750_000);
    expect(getClosedWallFloorPolygon([...closed, partition])?.areaMm2).toBe(9_750_000);
    expect(
      getRoomFloorPlan({
        ...templateRoom,
        scene: { ...templateRoom.scene, objects: [...closed, partition] },
      }).source,
    ).toBe("closed-walls");
  });

  it("uses the outer face when two room areas share an internal wall", () => {
    const outerWalls = loopWalls([
      [0, 0],
      [2000, 0],
      [4000, 0],
      [4000, 3000],
      [2000, 3000],
      [0, 3000],
    ]);
    const divider = {
      ...structuredClone(outerWalls[0]),
      id: "shared-divider-wall",
      name: "Shared divider wall",
      position: { x: 2000, y: 1500, z: 0 },
      dimensions: { ...outerWalls[0].dimensions, width: 3000 },
      rotation: { ...outerWalls[0].rotation, z: 90 },
      wall: {
        ...outerWalls[0].wall!,
        start: { x: 2000, y: 0 },
        end: { x: 2000, y: 3000 },
      },
    };

    const polygon = getClosedWallFloorPolygon([...outerWalls, divider]);
    expect(polygon).toMatchObject({
      areaMm2: 12_000_000,
      bounds: { minX: 0, minY: 0, maxX: 4000, maxY: 3000 },
    });
    expect(polygon?.wallIds).not.toContain(divider.id);
  });

  it("keeps primary and annex floors independent through one shared wall", () => {
    const template = createSeedProject().rooms[0];
    const primaryWalls = loopWalls([
      [0, 0],
      [8000, 0],
      [8000, 1200],
      [8000, 5700],
      [8000, 6000],
      [0, 6000],
    ]);
    const shared = primaryWalls[2];
    const annexExterior = loopWalls([
      [8000, 1200],
      [11600, 1200],
      [11600, 5700],
      [8000, 5700],
    ])
      .slice(0, 3)
      .map((wall, index) => ({ ...wall, id: `annex-wall-${index.toString().padStart(4, "0")}` }));
    const room: Room = {
      ...template,
      width: 11_600,
      depth: 6000,
      spaces: [
        {
          id: "space-primary-fixture",
          roomId: template.id,
          parentSpaceId: null,
          kind: "primary",
          name: "Primary room",
          code: "PRI",
          wallIds: primaryWalls.map((wall) => wall.id),
          floorFinish: template.floorFinish,
        },
        {
          id: "space-annex-fixture",
          roomId: template.id,
          parentSpaceId: "space-primary-fixture",
          kind: "annex",
          name: "Bioassay Annex",
          code: "ANN",
          wallIds: [...annexExterior.map((wall) => wall.id), shared.id],
          floorFinish: "warm-welded-vinyl",
        },
      ],
      scene: { ...template.scene, objects: [...primaryWalls, ...annexExterior] },
    };

    const floors = getRoomSpaceFloorPlans(room);
    expect(floors).toHaveLength(2);
    expect(floors.find((floor) => floor.kind === "primary")?.areaMm2).toBe(48_000_000);
    expect(floors.find((floor) => floor.kind === "annex")?.areaMm2).toBe(16_200_000);
    expect(floors.reduce((total, floor) => total + floor.areaMm2, 0)).toBe(64_200_000);
    expect(floors.every((floor) => floor.wallIds.includes(shared.id))).toBe(true);
    expect(new Set(floors.map((floor) => floor.spaceId))).toEqual(
      new Set(["space-primary-fixture", "space-annex-fixture"]),
    );
  });

  it("rejects a self-intersecting loop even when its signed area is non-zero", () => {
    const crossed = loopWalls([
      [0, 0],
      [4000, 3000],
      [0, 3000],
      [4000, 0],
      [2000, 4000],
    ]);

    expect(getClosedWallFloorPolygon(crossed)).toBeNull();
  });

  it("normalizes and resizes a valid irregular loop after wall dragging", () => {
    const before = loopWalls(L_SHAPE);
    const north = before[0];
    const marker = {
      ...structuredClone(createSeedProject().rooms[0].scene.objects[10]),
      id: "marker-object-0001",
      position: { x: 1000, y: 900, z: 0 },
    };
    const source = [...before, marker];
    const edited = translateWall(source, north.id, { x: 0, y: 500 });

    const synchronized = synchronizeClosedRoomAfterWallEdit(source, edited);

    expect(synchronized).toMatchObject({ width: 4000, depth: 2500 });
    expect(synchronized?.floorPolygon.bounds).toMatchObject({ minX: 0, minY: 0 });
    expect(synchronized?.objects.find((object) => object.id === north.id)?.wall).toMatchObject({
      start: { x: 0, y: 0 },
      end: { x: 4000, y: 0 },
    });
    expect(synchronized?.objects.find((object) => object.id === marker.id)?.position.y).toBe(400);
  });

  it("shrinks and normalizes the floor when the north boundary is dragged", () => {
    const room = rectangularRoomFixture();
    const before = room.scene.objects;
    const north = before.find((object) => object.name === "Room wall 1")!;
    const cabinet = before.find((object) => object.name === "North reagent cabinet")!;
    const edited = translateWall(before, north.id, { x: 0, y: 500 });

    const synchronized = synchronizeRectangularRoomAfterWallEdit(before, edited, {
      width: room.width,
      depth: room.depth,
    });

    expect(synchronized).not.toBeNull();
    expect(synchronized).toMatchObject({ width: 9600, depth: 7900 });
    expect(synchronized!.objects.find((object) => object.id === north.id)?.wall).toMatchObject({
      start: { x: 0, y: 0 },
      end: { x: 9600, y: 0 },
    });
    expect(
      synchronized!.objects.find((object) => object.name === "Room wall 3")?.wall,
    ).toMatchObject({ start: { x: 9600, y: 7900 }, end: { x: 0, y: 7900 } });
    expect(
      synchronized!.objects.find((object) => object.name === "Preparation entrance")?.position,
    ).toMatchObject({ x: 900, y: 0 });
    expect(synchronized!.objects.find((object) => object.id === cabinet.id)?.position.y).toBe(
      cabinet.position.y - 500,
    );
  });

  it("updates width without translating the origin when the east boundary is dragged", () => {
    const room = rectangularRoomFixture();
    const before = room.scene.objects;
    const east = before.find((object) => object.name === "Room wall 2")!;
    const cabinet = before.find((object) => object.name === "North reagent cabinet")!;
    const edited = translateWall(before, east.id, { x: -600, y: 0 });

    const synchronized = synchronizeRectangularRoomAfterWallEdit(before, edited, {
      width: room.width,
      depth: room.depth,
    });

    expect(synchronized).toMatchObject({ width: 9000, depth: 8400 });
    expect(synchronized!.objects.find((object) => object.id === cabinet.id)?.position).toEqual(
      cabinet.position,
    );
  });

  it("leaves skewed or partitioned layouts to wall-only editing", () => {
    const room = rectangularRoomFixture();
    const before = room.scene.objects;
    const north = before.find((object) => object.name === "Room wall 1")!;
    const skewed = editWallEndpoint(before, north.id, "start", { x: 300, y: 450 });
    const extraWall = { ...north, id: "partition-wall-0001" };

    expect(
      synchronizeRectangularRoomAfterWallEdit(before, skewed, {
        width: room.width,
        depth: room.depth,
      }),
    ).toBeNull();
    expect(getRectangularPerimeterBounds([...before, extraWall])).toBeNull();
  });

  it("does not overwrite dimensions when the existing floor and perimeter disagree", () => {
    const room = rectangularRoomFixture();
    const before = room.scene.objects;
    const east = before.find((object) => object.name === "Room wall 2")!;
    const edited = translateWall(before, east.id, { x: -600, y: 0 });

    expect(
      synchronizeRectangularRoomAfterWallEdit(before, edited, {
        width: room.width - 100,
        depth: room.depth,
      }),
    ).toBeNull();
  });

  it("commits room dimensions and normalized objects as one undoable gesture", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
    });
    const { useEditorStore } = await import("../../src/store/editor-store");
    const project = createSeedProject();
    const room = rectangularRoomFixture();
    project.rooms = [room];
    project.activeRoomId = room.id;
    const before = structuredClone(room.scene.objects);
    const north = before.find((object) => object.name === "Room wall 1")!;
    const cabinet = before.find((object) => object.name === "North reagent cabinet")!;
    const edited = translateWall(before, north.id, { x: 0, y: 500 });
    const synchronized = synchronizeRectangularRoomAfterWallEdit(before, edited, {
      width: room.width,
      depth: room.depth,
    })!;
    useEditorStore.setState({ project, history: [], future: [] });

    useEditorStore.getState().previewObjects(synchronized.objects, {
      width: synchronized.width,
      depth: synchronized.depth,
    });
    useEditorStore.getState().commitPreviewBatch(before, "Resize room", {
      width: room.width,
      depth: room.depth,
    });

    let currentRoom = useEditorStore
      .getState()
      .project.rooms.find((entry) => entry.id === room.id)!;
    expect(currentRoom.depth).toBe(7900);
    expect(currentRoom.scene.objects.find((object) => object.id === cabinet.id)?.position.y).toBe(
      cabinet.position.y - 500,
    );
    expect(useEditorStore.getState().history).toHaveLength(1);

    useEditorStore.getState().undo();
    currentRoom = useEditorStore.getState().project.rooms.find((entry) => entry.id === room.id)!;
    expect(currentRoom.depth).toBe(8400);
    expect(currentRoom.scene.objects.find((object) => object.id === cabinet.id)?.position.y).toBe(
      cabinet.position.y,
    );

    useEditorStore.getState().redo();
    currentRoom = useEditorStore.getState().project.rooms.find((entry) => entry.id === room.id)!;
    expect(currentRoom.depth).toBe(7900);
    expect(currentRoom.scene.objects.find((object) => object.id === cabinet.id)?.position.y).toBe(
      cabinet.position.y - 500,
    );
  });
});
