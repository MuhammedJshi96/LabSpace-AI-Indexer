import { describe, expect, it } from "vitest";
import {
  cameraCommandKey,
  chooseDigitalTwinFocusCameraPosition,
  digitalTwinCameraApproach,
  digitalTwinFocusDistance,
  editorInitialIsometricPosition,
  isCameraFocusClear,
} from "../../src/domain/camera-command";
import { shouldCutawayWallForFocus } from "../../src/domain/digital-twin-cutaway";
import type { SceneObject } from "../../src/domain/schema";

describe("3D camera command identity", () => {
  const command = {
    roomId: "room-809-demo",
    presentation: "editor" as const,
    preset: "isometric",
    focusObjectId: null,
    focusLocationId: null,
  };

  it("preserves the viewpoint only when focus is dismissed in the same view", () => {
    const focused = { ...command, focusObjectId: "cabinet", focusLocationId: "shelf" };
    expect(isCameraFocusClear(focused, command)).toBe(true);
    expect(isCameraFocusClear(null, command)).toBe(false);
    expect(isCameraFocusClear(command, command)).toBe(false);
    expect(isCameraFocusClear(focused, { ...command, roomId: "another-room" })).toBe(false);
    expect(isCameraFocusClear(focused, { ...command, preset: "top" })).toBe(false);
    expect(isCameraFocusClear(focused, { ...command, presentation: "digital-twin" })).toBe(false);
  });

  it("does not include mutable scene geometry", () => {
    const beforeObjectMove = cameraCommandKey(command);
    const afterObjectMove = cameraCommandKey(command);

    expect(afterObjectMove).toBe(beforeObjectMove);
    expect(beforeObjectMove).toBe("room-809-demo:editor:isometric:room:object");
  });

  it("changes only for explicit room, preset, presentation, or focus commands", () => {
    const baseline = cameraCommandKey(command);

    expect(cameraCommandKey({ ...command, preset: "top" })).not.toBe(baseline);
    expect(cameraCommandKey({ ...command, roomId: "room-analytical" })).not.toBe(baseline);
    expect(cameraCommandKey({ ...command, presentation: "digital-twin" })).not.toBe(baseline);
    expect(cameraCommandKey({ ...command, focusObjectId: "asset-buchi" })).not.toBe(baseline);
    expect(cameraCommandKey({ ...command, focusLocationId: "drawer-01" })).not.toBe(baseline);
  });
});

describe("Spatial Index exact-location camera approach", () => {
  it("rotates the evidence camera with the selected asset facade", () => {
    const front = digitalTwinCameraApproach({
      roomWidthMm: 8000,
      roomDepthMm: 8000,
      objectXmm: 4000,
      objectYmm: 4000,
      objectRotationDeg: 0,
    });
    const quarterTurn = digitalTwinCameraApproach({
      roomWidthMm: 8000,
      roomDepthMm: 8000,
      objectXmm: 4000,
      objectYmm: 4000,
      objectRotationDeg: 90,
    });

    expect(front.forwardX).toBeCloseTo(0);
    expect(front.forwardZ).toBeCloseTo(1);
    expect(quarterTurn.forwardX).toBeCloseTo(-1);
    expect(quarterTurn.forwardZ).toBeCloseTo(0);
  });

  it("never substitutes a cabinet's back for its physical front at the perimeter", () => {
    const approach = digitalTwinCameraApproach({
      roomWidthMm: 8000,
      roomDepthMm: 8000,
      objectXmm: 4000,
      objectYmm: 7600,
      objectRotationDeg: 0,
    });

    expect(approach.forwardZ).toBeCloseTo(1);
  });

  it("honors rear island faces, side drawers, rotation and mirrored assets", () => {
    const input = {
      roomWidthMm: 8000,
      roomDepthMm: 8000,
      objectXmm: 4000,
      objectYmm: 4000,
      objectRotationDeg: 0,
    };
    expect(digitalTwinCameraApproach({ ...input, face: { x: 0, z: -1 } }).forwardZ).toBe(-1);
    expect(digitalTwinCameraApproach({ ...input, flipVertical: true }).forwardZ).toBe(-1);
    expect(
      digitalTwinCameraApproach({ ...input, face: { x: 1, z: 0 }, flipHorizontal: true }).forwardX,
    ).toBe(-1);
    expect(
      digitalTwinCameraApproach({ ...input, face: { x: 0, z: -1 }, objectRotationDeg: 90 })
        .forwardX,
    ).toBeCloseTo(1);
  });

  it("bounds wide storage framing instead of turning it into a room overview", () => {
    expect(
      digitalTwinFocusDistance({
        roomExtent: 8.7,
        focusedEnvelope: 3.6,
        exactLocation: true,
      }),
    ).toBeLessThanOrEqual(6.4);
    expect(
      digitalTwinFocusDistance({
        roomExtent: 8.7,
        focusedEnvelope: 0.45,
        exactLocation: true,
      }),
    ).toBeCloseTo(3.8);
  });

  it("keeps the evidence camera inside the available aisle", () => {
    const position = chooseDigitalTwinFocusCameraPosition({
      target: { x: 1.7, y: 1.8, z: 0.6 },
      desiredDistance: 6.2,
      approach: { forwardX: 1, forwardZ: 0, lateralX: 0, lateralZ: 1 },
      roomWidth: 8.6,
      roomDepth: 8.7,
      exactLocation: true,
    });

    expect(position.x).toBeLessThanOrEqual(8.6 / 2 - 0.34);
    expect(position.y).toBeLessThan(4);
  });

  it("chooses the clear lateral side when furniture crosses the preferred sightline", () => {
    const position = chooseDigitalTwinFocusCameraPosition({
      target: { x: 0, y: 1.4, z: 0 },
      desiredDistance: 5,
      approach: { forwardX: 1, forwardZ: 0, lateralX: 0, lateralZ: 1 },
      roomWidth: 8,
      roomDepth: 8,
      exactLocation: true,
      obstacles: [
        {
          id: "blocking-cabinet",
          minX: 0.8,
          maxX: 2.8,
          minY: 0,
          maxY: 2.4,
          minZ: 0.05,
          maxZ: 1.1,
        },
      ],
    });

    expect(position.lateralBias).toBeLessThan(0);
    expect(position.blockerIds).toEqual([]);
  });
});

describe("editor initial 3D framing", () => {
  it("reproduces the approved split-view zoom as a room-relative overview", () => {
    const target = [0, 0.55, 0] as const;
    const position = editorInitialIsometricPosition({
      roomWidthMetres: 8.635,
      roomDepthMetres: 8.705,
      target,
    });

    expect(position[0]).toBeCloseTo(10.933, 2);
    expect(position[1]).toBeCloseTo(11.483, 2);
    expect(position[2]).toBeCloseTo(10.933, 2);
  });
});

describe("Spatial Index focused wall occlusion", () => {
  const wall = {
    id: "partition",
    wall: {
      start: { x: 4000, y: 1000 },
      end: { x: 4000, y: 7000 },
      thickness: 120,
      height: 3000,
    },
  } as SceneObject;
  const room = { width: 8000, depth: 8000 };

  it("cuts an interior wall that crosses the focused evidence sightline", () => {
    expect(
      shouldCutawayWallForFocus(wall, room, { x: -3, y: 2.4, z: 0 }, { x: 2, y: 0.9, z: 0 }),
    ).toBe(true);
  });

  it("keeps nearby walls that do not block the selected object", () => {
    expect(
      shouldCutawayWallForFocus(wall, room, { x: -3, y: 2.4, z: -3.5 }, { x: -2, y: 0.9, z: 2.5 }),
    ).toBe(false);
  });

  it("keeps a half wall when the sightline passes above it", () => {
    const halfWall = {
      ...wall,
      wall: { ...wall.wall!, height: 900 },
    } as SceneObject;
    expect(
      shouldCutawayWallForFocus(halfWall, room, { x: -3, y: 3, z: 0 }, { x: 2, y: 2, z: 0 }),
    ).toBe(false);
  });
});
