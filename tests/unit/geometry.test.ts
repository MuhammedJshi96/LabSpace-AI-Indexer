import { describe, expect, it } from "vitest";
import { applyCommand, revertCommand, type SceneCommand } from "../../src/domain/history";
import {
  alignBenchObjectToCurrentSupport,
  metresToMm,
  mmToMetres,
  objectBounds,
  objectsOverlap,
  roomArea,
  roomPerimeter,
  snapPoint,
  snapValue,
  validatePlacement,
  wallLength,
} from "../../src/domain/geometry";
import { createSeedProject } from "../../src/domain/seed";

describe("millimetre geometry", () => {
  it("converts millimetres and metres without drift", () => {
    expect(mmToMetres(9600)).toBe(9.6);
    expect(metresToMm(8.4)).toBe(8400);
  });

  it("calculates Room 809 area and perimeter", () => {
    const room = createSeedProject().rooms[0];
    expect(roomArea(room)).toBe(68.611);
    expect(roomPerimeter(room)).toBe(34.8);
  });

  it("calculates wall length from endpoints", () => {
    const wall = createSeedProject().rooms[0].scene.objects.find((object) => object.wall)!;
    expect(wallLength(wall)).toBe(8710);
  });

  it("snaps to grid, centres, edges, and wall endpoints", () => {
    const scene = createSeedProject().rooms[0].scene;
    expect(snapValue(995, 200, 10)).toBe(1000);
    const result = snapPoint({ x: 1207, y: 510 }, scene, { gridSize: 200, tolerance: 60 });
    expect(result.x).toBe(1200);
    expect(result.guides.some((guide) => guide.axis === "x")).toBe(true);

    const endpoint = snapPoint({ x: 0, y: 75 }, scene, { gridSize: 200, tolerance: 80 });
    expect(endpoint).toMatchObject({ x: 0, y: 0 });
    expect(endpoint.guides).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "wall-endpoint" })]),
    );
  });

  it("ignores stacked equipment while detecting same-level overlaps", () => {
    const scene = createSeedProject().rooms[0].scene;
    const island = scene.objects.find((object) => object.name === "Analysis island")!;
    const instrument = scene.objects.find(
      (object) => object.assetDefinitionId === "analytical-balance",
    )!;
    expect(objectsOverlap(island, instrument)).toBe(false);
    expect(
      objectsOverlap(island, { ...instrument, position: { ...instrument.position, z: 0 } }),
    ).toBe(true);
    expect(
      objectsOverlap(island, {
        ...instrument,
        position: { ...instrument.position, z: 0 },
        parentObjectId: island.id,
      }),
    ).toBe(false);
    expect(
      objectsOverlap(island, {
        ...instrument,
        position: { ...instrument.position, z: 0 },
        metadata: { overlapExemptObjectIds: [island.id] },
      }),
    ).toBe(false);
  });

  it("aligns equipment only to a worktop already beneath its footprint", () => {
    const room = structuredClone(createSeedProject().rooms[0]);
    const equipment = room.scene.objects.find(
      (object) => object.assetDefinitionId === "analytical-balance",
    )!;
    const originalX = equipment.position.x;
    const originalY = equipment.position.y;

    const supported = alignBenchObjectToCurrentSupport(room, {
      ...equipment,
      position: { ...equipment.position, z: 0 },
    });
    expect(supported.position.x).toBe(originalX);
    expect(supported.position.y).toBe(originalY);
    expect(supported.position.z).toBeGreaterThan(0);

    const manualFloorDrop = alignBenchObjectToCurrentSupport(room, {
      ...equipment,
      position: { x: 500, y: 500, z: supported.position.z },
    });
    expect(manualFloorDrop.position).toEqual({ x: 500, y: 500, z: 0 });
  });

  it("uses the rotated footprint for service islands and room-boundary checks", () => {
    const room = createSeedProject().rooms[0];
    const island = room.scene.objects.find((object) => object.name === "Analysis island")!;
    const bounds = objectBounds(island);

    expect(bounds.right - bounds.left).toBeCloseTo(1200);
    expect(bounds.bottom - bounds.top).toBeCloseTo(3600);
    expect(validatePlacement(room)).toEqual([]);
  });

  it("reports the exact objects involved in visual placement conflicts", () => {
    const room = structuredClone(createSeedProject().rooms[0]);
    const island = room.scene.objects.find((object) => object.name === "Analysis island")!;
    const movable = room.scene.objects.find(
      (object) => object.assetDefinitionId === "eyewash",
    )!;
    movable.position = {
      ...movable.position,
      x: island.position.x,
      y: island.position.y,
      z: 0,
    };

    const overlap = validatePlacement(room).find((warning) => warning.id.startsWith("overlap-"));
    expect(overlap?.severity).toBe("warning");
    expect(overlap?.objectIds).toEqual(expect.arrayContaining([island.id, movable.id]));

    movable.position = { ...movable.position, x: -800, y: -800 };
    const outside = validatePlacement(room).find(
      (warning) => warning.id === `outside-${movable.id}`,
    );
    expect(outside?.severity).toBe("error");
    expect(outside?.objectIds).toEqual([movable.id]);
  });

  it("keeps the Room 809 reference shell, openings, islands, and curated evaporator station intact", () => {
    const room = createSeedProject().rooms[0];
    const objects = room.scene.objects;

    expect(objects.filter((object) => object.wall)).toHaveLength(8);
    expect(objects.filter((object) => object.objectType === "window")).toHaveLength(5);
    expect(objects.find((object) => object.name === "Main double entrance")?.opening?.width).toBe(
      2200,
    );
    expect(
      objects.filter((object) => object.assetDefinitionId === "island-bench-service-bridge"),
    ).toHaveLength(1);
    expect(
      objects.filter((object) => object.assetDefinitionId === "rotary-evaporator"),
    ).toHaveLength(1);
    const stagedObjects = objects.filter(
      (object) => !["wall", "door", "window"].includes(object.objectType),
    );
    expect(stagedObjects).toHaveLength(12);
  });

  it("applies and reverts a movement command", () => {
    const scene = createSeedProject().rooms[0].scene;
    const before = scene.objects.find((object) => object.name === "Analysis island")!;
    const after = { ...before, position: { ...before.position, x: before.position.x + 200 } };
    const command: SceneCommand = {
      id: "command-move-01",
      label: "Move",
      kind: "update",
      objectId: before.id,
      before,
      after,
    };
    const moved = applyCommand(scene, command);
    expect(moved.objects.find((object) => object.id === before.id)?.position.x).toBe(
      after.position.x,
    );
    expect(
      revertCommand(moved, command).objects.find((object) => object.id === before.id)?.position.x,
    ).toBe(before.position.x);
  });

  it("applies and reverts a batch that closes a room with a new wall", () => {
    const scene = createSeedProject().rooms[0].scene;
    const before = scene.objects.slice(0, 2);
    const added = { ...structuredClone(before[0]), id: "history-added-wall" };
    const command: SceneCommand = {
      id: "command-close-room",
      label: "Close room outline",
      kind: "batch",
      before,
      after: [...before, added],
    };

    const source = { ...scene, objects: before };
    const applied = applyCommand(source, command);
    expect(applied.objects.map((object) => object.id)).toContain(added.id);
    expect(revertCommand(applied, command).objects.map((object) => object.id)).not.toContain(
      added.id,
    );
  });
});
