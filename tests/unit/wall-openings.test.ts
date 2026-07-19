import { describe, expect, it } from "vitest";
import {
  findNearestWallProjection,
  hostOpeningAtPoint,
  openingOverlapsSibling,
  projectPointToWall,
  resolveHostedOpening,
} from "../../src/domain/wall-openings";
import { createSeedProject } from "../../src/domain/seed";

describe("wall-hosted openings", () => {
  it("projects and clamps a door inside the nearest wall", () => {
    const room = createSeedProject().rooms[0];
    const northWall = room.scene.objects.find((object) => object.name === "Room wall 1")!;
    const projection = projectPointToWall(northWall, { x: 120, y: 420 }, 900)!;

    expect(projection.point).toEqual({ x: 450, y: 0 });
    expect(projection.offset).toBe(450);
    expect(projection.rotation).toBe(0);
  });

  it("selects the closest wall and creates a synchronized host patch", () => {
    const room = createSeedProject().rooms[0];
    const door = room.scene.objects.find((object) => object.name === "West service entrance")!;
    const projection = findNearestWallProjection(
      room.scene.objects,
      { x: 8600, y: 2600 },
      door.dimensions.width,
    )!;
    const patch = hostOpeningAtPoint(door, projection);

    expect(projection.wall.name).toBe("Room wall 2");
    expect(patch.opening!.wallId).toBe(projection.wall.id);
    expect(patch.position.x).toBe(8710);
    expect(patch.position.y).toBe(2600);
    expect(patch.rotation.z).toBe(90);
  });

  it("derives the rendered transform from the wall relationship", () => {
    const room = createSeedProject().rooms[0];
    const northWindow = room.scene.objects.find((object) => object.name === "North window 1")!;
    const resolved = resolveHostedOpening(
      { ...northWindow, position: { x: 1, y: 1, z: northWindow.position.z } },
      room.scene.objects,
    )!;

    expect(resolved.wall.name).toBe("Room wall 1");
    expect(resolved.point.x).toBe(1950);
    expect(resolved.point.y).toBe(0);
    expect(resolved.rotation).toBe(0);
  });

  it("rejects impossible wall fits and detects sibling overlap", () => {
    const room = createSeedProject().rooms[0];
    const wall = room.scene.objects.find((object) => object.name === "Room wall 1")!;
    const window = room.scene.objects.find((object) => object.name === "North window 1")!;

    expect(projectPointToWall(wall, { x: 500, y: 0 }, 10_000)).toBeNull();
    expect(
      openingOverlapsSibling(
        room.scene.objects,
        wall.id,
        window.opening!.offset + 200,
        window.dimensions.width,
        undefined,
      ),
    ).toBe(true);
  });

  it("assigns professional opening-family defaults when first hosted", () => {
    const room = createSeedProject().rooms[0];
    const wall = room.scene.objects.find((object) => object.name === "Room wall 1")!;
    const sourceDoor = room.scene.objects.find((object) => object.name === "Main double entrance")!;
    const projection = projectPointToWall(wall, { x: 4300, y: 0 }, 1800)!;

    const slidingPatch = hostOpeningAtPoint(
      {
        ...sourceDoor,
        id: "test-double-sliding-door",
        assetDefinitionId: "double-sliding-door",
        opening: undefined,
      },
      projection,
    );
    expect(slidingPatch.opening?.swing).toBe("sliding");
    expect(slidingPatch.opening?.sillHeight).toBe(0);

    const passThroughPatch = hostOpeningAtPoint(
      {
        ...sourceDoor,
        id: "test-pass-through",
        assetDefinitionId: "pass-through-window",
        objectType: "window",
        dimensions: { width: 900, depth: 300, height: 900 },
        opening: undefined,
      },
      projectPointToWall(wall, { x: 2500, y: 0 }, 900)!,
    );
    expect(passThroughPatch.opening?.sillHeight).toBe(1100);
    expect(passThroughPatch.position.z).toBe(1100);
  });
});
