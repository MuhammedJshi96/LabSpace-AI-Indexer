import { describe, expect, it } from "vitest";
import { advanceWallChain } from "../../src/domain/wall-drawing";

describe("continuous wall drawing", () => {
  it("uses every committed endpoint as the next segment start", () => {
    const first = advanceWallChain(null, { x: 200, y: 400 });
    expect(first.segment).toBeNull();

    const second = advanceWallChain(first.nextStart, { x: 1200, y: 400 });
    expect(second.segment).toEqual({
      start: { x: 200, y: 400 },
      end: { x: 1200, y: 400 },
    });

    const third = advanceWallChain(second.nextStart, { x: 1200, y: 1600 });
    expect(third.segment).toEqual({
      start: { x: 1200, y: 400 },
      end: { x: 1200, y: 1600 },
    });
  });

  it("does not create a duplicate zero-length segment on a finishing double-click", () => {
    const result = advanceWallChain({ x: 1200, y: 400 }, { x: 1200, y: 400 });
    expect(result.segment).toBeNull();
    expect(result.nextStart).toEqual({ x: 1200, y: 400 });
  });
});
