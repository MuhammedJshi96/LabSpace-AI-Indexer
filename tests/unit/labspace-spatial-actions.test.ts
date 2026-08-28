import { describe, expect, it } from "vitest";
import {
  createLabSpaceSpatialActions,
  recommendObjectPlacements,
  validateObjectMove,
} from "../../src/agent/labspace-spatial-actions";
import { createSeedProject } from "../../src/domain/seed";
import type { Project, Room, SceneObject } from "../../src/domain/schema";
import { useEditorStore } from "../../src/store/editor-store";

function spatialFixture() {
  const project = createSeedProject();
  const room = project.rooms.find((entry) => entry.roomKind === "demo")!;
  project.activeRoomId = room.id;
  const movable = room.scene.objects.filter((entry) =>
    ["furniture", "storage", "equipment"].includes(entry.objectType),
  );
  const first: SceneObject = {
    ...structuredClone(movable[0]),
    name: "Movable workstation",
    objectType: "equipment",
    locked: false,
    visible: true,
    position: { x: 1500, y: 1500, z: 0 },
    dimensions: { width: 600, depth: 600, height: 900 },
    rotation: { x: 0, y: 0, z: 0 },
    metadata: {},
  };
  const second: SceneObject = {
    ...structuredClone(movable[1]),
    name: "Plate reader station",
    objectType: "equipment",
    locked: false,
    visible: true,
    position: { x: 3500, y: 1500, z: 0 },
    dimensions: { width: 800, depth: 800, height: 900 },
    rotation: { x: 0, y: 0, z: 0 },
    metadata: {},
  };
  const preparedRoom: Room = {
    ...room,
    width: 6000,
    depth: 5000,
    scene: {
      ...room.scene,
      layers: room.scene.layers.map((layer) => ({ ...layer, locked: false })),
      objects: [first, second],
      equipmentRecords: [],
      storageLocations: [],
      inventoryItems: [],
    },
  };
  const preparedProject: Project = {
    ...project,
    rooms: project.rooms.map((entry) => (entry.id === preparedRoom.id ? preparedRoom : entry)),
  };
  return { project: preparedProject, room: preparedRoom, first, second };
}

describe("LabSpace hypothetical move validation", () => {
  it("returns a clean valid result without mutating the source project", () => {
    const { project, first } = spatialFixture();
    const before = structuredClone(project);

    const result = validateObjectMove(
      {
        objectId: first.id,
        target: { xMm: 2200, yMm: 3000 },
        rotationDeg: 90,
      },
      () => project,
    );

    expect(result).toMatchObject({
      valid: true,
      objectId: first.id,
      target: { xMm: 2200, yMm: 3000, rotationDeg: 90 },
      conflicts: [],
    });
    expect(project).toEqual(before);
    expect(project.rooms.find((room) => room.id === first.roomId)?.scene.objects[0]).toEqual(first);
  });

  it("reports deterministic collision evidence with the related object", () => {
    const { project, first, second } = spatialFixture();

    const result = validateObjectMove(
      { objectId: first.id, target: { xMm: second.position.x, yMm: second.position.y } },
      () => project,
    );

    expect(result.valid).toBe(false);
    expect(result.conflicts).toContainEqual(
      expect.objectContaining({
        type: "object-collision",
        objectId: second.id,
        indexCode: second.indexCode,
        name: second.name,
      }),
    );
  });

  it("reports room-boundary violations", () => {
    const { project, first } = spatialFixture();

    const result = validateObjectMove(
      { objectId: first.id, target: { xMm: 100, yMm: 100 } },
      () => project,
    );

    expect(result.valid).toBe(false);
    expect(result.conflicts).toEqual([expect.objectContaining({ type: "outside-room-boundary" })]);
  });

  it("rejects locked and structural objects without running a mutation", () => {
    const lockedFixture = spatialFixture();
    const lockedRoom = lockedFixture.project.rooms.find(
      (entry) => entry.id === lockedFixture.room.id,
    )!;
    lockedRoom.scene.objects[0] = { ...lockedRoom.scene.objects[0], locked: true };
    const locked = validateObjectMove(
      { objectId: lockedFixture.first.id, target: { xMm: 2000, yMm: 2000 } },
      () => lockedFixture.project,
    );
    expect(locked).toMatchObject({
      valid: false,
      conflicts: [{ type: "restricted-object" }],
    });

    const structuralFixture = spatialFixture();
    const structuralRoom = structuralFixture.project.rooms.find(
      (entry) => entry.id === structuralFixture.room.id,
    )!;
    structuralRoom.scene.objects[0] = {
      ...structuralRoom.scene.objects[0],
      objectType: "wall",
    };
    const structural = validateObjectMove(
      { objectId: structuralFixture.first.id, target: { xMm: 2000, yMm: 2000 } },
      () => structuralFixture.project,
    );
    expect(structural).toMatchObject({
      valid: false,
      conflicts: [{ type: "restricted-object" }],
    });
  });

  it("reads the current project at execution time", () => {
    const firstFixture = spatialFixture();
    const secondProject = structuredClone(firstFixture.project);
    const secondRoom = secondProject.rooms.find((entry) => entry.id === firstFixture.room.id)!;
    secondRoom.scene.objects[0] = {
      ...secondRoom.scene.objects[0],
      name: "Current movable workstation",
    };
    let project = firstFixture.project;
    const actions = createLabSpaceSpatialActions(() => project);
    project = secondProject;

    const result = actions.validateObjectMove({
      objectId: firstFixture.first.id,
      target: { xMm: 2200, yMm: 3000 },
    });

    expect(result.objectName).toBe("Current movable workstation");
  });

  it("does not change Zustand project, history, dirty revision, or previews", () => {
    const { project, first } = spatialFixture();
    useEditorStore.setState({
      project,
      history: [],
      future: [],
      dirtyRevision: 11,
      saveStatus: "saved",
    });
    const projectBefore = useEditorStore.getState().project;

    const result = validateObjectMove({
      objectId: first.id,
      target: { xMm: 2200, yMm: 3000 },
    });
    const after = useEditorStore.getState();

    expect(result.valid).toBe(true);
    expect(after.project).toBe(projectBefore);
    expect(after.history).toEqual([]);
    expect(after.future).toEqual([]);
    expect(after.dirtyRevision).toBe(11);
    expect(after.saveStatus).toBe("saved");
  });

  it("rejects invalid IDs, non-finite coordinates, bounds, and unexpected fields", () => {
    const { project, first } = spatialFixture();
    expect(() =>
      validateObjectMove(
        { objectId: "missing-object", target: { xMm: 1000, yMm: 1000 } },
        () => project,
      ),
    ).toThrow("Object not found");
    expect(() =>
      validateObjectMove(
        { objectId: first.id, target: { xMm: Number.NaN, yMm: 1000 } },
        () => project,
      ),
    ).toThrow("finite number");
    expect(() =>
      validateObjectMove({ objectId: first.id, target: { xMm: 100001, yMm: 1000 } }, () => project),
    ).toThrow("between -100000 and 100000");
    expect(() =>
      validateObjectMove(
        {
          objectId: first.id,
          target: { xMm: 1000, yMm: 1000 },
          unexpected: true,
        },
        () => project,
      ),
    ).toThrow("Unexpected input field");
  });

  it("keeps the structured output compact", () => {
    const { project, first, second } = spatialFixture();
    const result = validateObjectMove(
      { objectId: first.id, target: { xMm: second.position.x, yMm: second.position.y } },
      () => project,
    );
    expect(JSON.stringify(result).length).toBeLessThan(1500);
  });
});

describe("LabSpace valid-placement recommendations", () => {
  it("ranks diverse valid alternatives near a blocked preferred target without mutation", () => {
    const { project, first, second } = spatialFixture();
    const before = structuredClone(project);

    const result = recommendObjectPlacements(
      {
        objectId: first.id,
        preferredTarget: { xMm: second.position.x, yMm: second.position.y },
        rotationsDeg: [0, 90],
        limit: 3,
      },
      () => project,
    );

    expect(result).toMatchObject({
      objectId: first.id,
      preferredTarget: { xMm: second.position.x, yMm: second.position.y },
    });
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates.map((candidate) => candidate.rank)).toEqual([1, 2, 3]);
    expect(
      result.candidates.some(
        (candidate) =>
          Math.hypot(
            candidate.target.xMm - first.position.x,
            candidate.target.yMm - first.position.y,
          ) < 200,
      ),
    ).toBe(false);
    expect(result.candidates[0].distanceFromPreferredMm).toBeLessThanOrEqual(
      result.candidates[1].distanceFromPreferredMm,
    );
    for (const candidate of result.candidates) {
      expect(
        validateObjectMove(
          {
            objectId: first.id,
            target: { xMm: candidate.target.xMm, yMm: candidate.target.yMm },
            rotationDeg: candidate.target.rotationDeg,
          },
          () => project,
        ).valid,
      ).toBe(true);
    }
    for (let index = 1; index < result.candidates.length; index += 1) {
      const current = result.candidates[index];
      for (const previous of result.candidates.slice(0, index)) {
        expect(
          Math.hypot(
            current.target.xMm - previous.target.xMm,
            current.target.yMm - previous.target.yMm,
          ),
        ).toBeGreaterThanOrEqual(750);
      }
    }
    expect(project).toEqual(before);
  });

  it("rejects restricted objects and malformed recommendation inputs", () => {
    const fixture = spatialFixture();
    const room = fixture.project.rooms.find((entry) => entry.id === fixture.room.id)!;
    room.scene.objects[0] = { ...room.scene.objects[0], locked: true };
    expect(() =>
      recommendObjectPlacements({ objectId: fixture.first.id }, () => fixture.project),
    ).toThrow("locked");

    const fresh = spatialFixture();
    expect(() =>
      recommendObjectPlacements(
        { objectId: fresh.first.id, rotationsDeg: [] },
        () => fresh.project,
      ),
    ).toThrow("non-empty array");
    expect(() =>
      recommendObjectPlacements({ objectId: fresh.first.id, limit: 6 }, () => fresh.project),
    ).toThrow("between 1 and 5");
    expect(() =>
      recommendObjectPlacements(
        { objectId: fresh.first.id, unexpected: true },
        () => fresh.project,
      ),
    ).toThrow("Unexpected input field");
  });

  it("keeps ranked recommendation evidence compact", () => {
    const { project, first } = spatialFixture();
    const result = recommendObjectPlacements(
      { objectId: first.id, preferredTarget: { xMm: 3000, yMm: 2500 }, limit: 5 },
      () => project,
    );

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(JSON.stringify(result).length).toBeLessThan(5000);
    expect(result.basis).toContain(
      "Recommendations are read-only; staging and explicit researcher approval remain separate steps.",
    );
  });
});
