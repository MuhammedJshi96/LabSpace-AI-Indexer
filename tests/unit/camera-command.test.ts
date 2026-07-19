import { describe, expect, it } from "vitest";
import {
  cameraCommandKey,
  digitalTwinCameraApproach,
  editorInitialIsometricPosition,
} from "../../src/domain/camera-command";

describe("3D camera command identity", () => {
  const command = {
    roomId: "room-809-demo",
    presentation: "editor" as const,
    preset: "isometric",
    focusObjectId: null,
    focusLocationId: null,
  };

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

  it("uses the inward equivalent facade for perimeter storage", () => {
    const approach = digitalTwinCameraApproach({
      roomWidthMm: 8000,
      roomDepthMm: 8000,
      objectXmm: 4000,
      objectYmm: 7600,
      objectRotationDeg: 0,
    });

    expect(approach.forwardZ).toBeCloseTo(-1);
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
