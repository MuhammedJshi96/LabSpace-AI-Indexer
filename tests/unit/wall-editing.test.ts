import { describe, expect, it } from "vitest";
import { createSeedProject } from "../../src/domain/seed";
import { editWallEndpoint, translateWall } from "../../src/domain/wall-editing";

describe("direct wall editing", () => {
  it("moves a wall endpoint and keeps a connected room corner joined", () => {
    const objects = createSeedProject().rooms[0].scene.objects;
    const north = objects.find((object) => object.name === "Room wall 1")!;
    const west = objects.find((object) => object.name === "Room wall 4")!;

    const next = editWallEndpoint(objects, north.id, "start", { x: 300, y: 450 });
    const nextNorth = next.find((object) => object.id === north.id)!;
    const nextWest = next.find((object) => object.id === west.id)!;

    expect(nextNorth.wall?.start).toEqual({ x: 300, y: 450 });
    expect(nextWest.wall?.end).toEqual({ x: 300, y: 450 });
    expect(nextNorth.position.x).toBe(4505);
    expect(nextNorth.position.y).toBe(225);
    expect(nextNorth.dimensions.width).toBeCloseTo(Math.hypot(8410, -450));
  });

  it("translates one side of a room with its joined corners and hosted opening", () => {
    const objects = createSeedProject().rooms[0].scene.objects;
    const north = objects.find((object) => object.name === "Room wall 1")!;
    const east = objects.find((object) => object.name === "Room wall 2")!;
    const west = objects.find((object) => object.name === "Room wall 4")!;
    const window = objects.find((object) => object.name === "North window 1")!;

    const next = translateWall(objects, north.id, { x: 0, y: 500 });

    expect(next.find((object) => object.id === north.id)?.wall).toMatchObject({
      start: { x: 0, y: 500 },
      end: { x: 8710, y: 500 },
    });
    expect(next.find((object) => object.id === east.id)?.wall?.start).toEqual({ x: 8710, y: 500 });
    expect(next.find((object) => object.id === west.id)?.wall?.end).toEqual({ x: 0, y: 500 });
    expect(next.find((object) => object.id === window.id)?.position).toMatchObject({
      x: 1950,
      y: 500,
    });
  });

  it("rejects edits that make a hosted wall shorter than its opening", () => {
    const objects = createSeedProject().rooms[0].scene.objects;
    const north = objects.find((object) => object.name === "Room wall 1")!;

    const next = editWallEndpoint(objects, north.id, "end", { x: 600, y: 0 });

    expect(next).toBe(objects);
  });
});
