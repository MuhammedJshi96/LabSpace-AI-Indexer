import { describe, expect, it } from "vitest";
import {
  auditRoom,
  createLabSpaceSpatialActions,
  recommendObjectPlacements,
  validateObjectMove,
  validateObjectResize,
} from "../../src/agent/labspace-spatial-actions";
import { createSeedProject } from "../../src/domain/seed";
import type { Project, Room, SceneObject } from "../../src/domain/schema";
import { useEditorStore } from "../../src/store/editor-store";
import { createPublicShowcaseProject } from "../../server/public-showcase";

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

function hostedWindowFixture() {
  const fixture = spatialFixture();
  const base = fixture.first;
  const wall: SceneObject = {
    ...structuredClone(base),
    id: "back-wall",
    name: "Back wall",
    objectType: "wall",
    dimensions: { width: 8000, depth: 150, height: 3000 },
    position: { x: 4000, y: 6000, z: 0 },
    wall: {
      start: { x: 0, y: 6000 },
      end: { x: 8000, y: 6000 },
      thickness: 150,
      height: 3000,
      halfHeight: false,
    },
  };
  const makeWindow = (id: string, offset: number): SceneObject => ({
    ...structuredClone(base),
    id,
    name: id === "window-left" ? "Left three-pane window" : "Right three-pane window",
    objectType: "window",
    assetDefinitionId: "wide-three-pane-window",
    locked: false,
    dimensions: { width: 2400, depth: 150, height: 1200 },
    position: { x: offset, y: 6000, z: 900 },
    opening: {
      wallId: wall.id,
      offset,
      width: 2400,
      sillHeight: 900,
      height: 1200,
      handing: "left",
      swing: "inward",
    },
  });
  const left = makeWindow("window-left", 2000);
  const right = makeWindow("window-right", 6000);
  const room: Room = {
    ...fixture.room,
    width: 8000,
    depth: 6000,
    wallHeight: 3000,
    scene: { ...fixture.room.scene, objects: [wall, left, right] },
  };
  const project: Project = {
    ...fixture.project,
    rooms: fixture.project.rooms.map((entry) => (entry.id === room.id ? room : entry)),
  };
  return { project, room, wall, left, right };
}

describe("LabSpace room readiness audit", () => {
  it("detects hinged door obstructions with rotation, swing side and elevation", () => {
    const { project, room, wall, left } = hostedWindowFixture();
    wall.wall!.start = { x: 0, y: 0 };
    wall.wall!.end = { x: 8000, y: 0 };
    left.objectType = "door";
    left.assetDefinitionId = "double-door";
    left.position = { x: 2000, y: 0, z: 0 };
    left.dimensions = { width: 1800, depth: 150, height: 2100 };
    left.opening = { ...left.opening!, width: 1800, height: 2100, sillHeight: 0 };
    const item: SceneObject = {
      ...structuredClone(left),
      id: "obstructing-cabinet",
      name: "Test cabinet",
      objectType: "storage",
      assetDefinitionId: "base-drawer-cabinet",
      opening: undefined,
      dimensions: { width: 600, depth: 600, height: 850 },
      position: { x: 2000, y: 500, z: 0 },
    };
    room.scene.objects = [wall, left, item];
    const conflicts = () =>
      validateObjectMove(
        { objectId: item.id, target: { xMm: item.position.x, yMm: item.position.y } },
        () => project,
      ).conflicts;
    expect(conflicts()).toContainEqual(
      expect.objectContaining({
        type: "object-collision",
        objectId: left.id,
        message: expect.stringContaining("opening envelope"),
      }),
    );
    left.opening.swing = "outward";
    expect(conflicts()).toEqual([]);
    left.opening.swing = "sliding";
    expect(conflicts()).toEqual([]);
    left.opening.swing = "inward";
    item.position.z = 2200;
    item.dimensions.height = 300;
    expect(conflicts()).toEqual([]);
    item.position.z = 0;
    wall.wall!.start = { x: 6000, y: 0 };
    wall.wall!.end = { x: 6000, y: 8000 };
    item.position = { x: 5500, y: 2000, z: 0 };
    expect(conflicts()).toContainEqual(
      expect.objectContaining({ type: "object-collision", objectId: left.id }),
    );
    left.visible = false;
    expect(conflicts()).toEqual([]);
  });
  it("reports the same one-based floor as room creation and Facility", () => {
    const { project, room } = spatialFixture();
    room.facilityPlacement = { x: 0, y: 0, rotation: 0, floor: 7 };
    expect(auditRoom({}, () => project).room.floor).toBe(8);
    room.facilityPlacement.floor = 0;
    expect(auditRoom({}, () => project).room.floor).toBe(1);
    room.facilityPlacement.floor = 14;
    expect(auditRoom({}, () => project).room.floor).toBe(15);
  });
  it("summarizes the same deterministic room state without mutation", () => {
    const project = createSeedProject();
    const room = project.rooms.find((entry) => entry.roomKind === "demo")!;
    const before = structuredClone(project);

    const result = auditRoom({ roomCode: room.code }, () => project);

    expect(result.room).toMatchObject({ id: room.id, code: room.code, name: room.name });
    expect(result.summary).toMatchObject({
      walls: expect.any(Number),
      openings: expect.any(Number),
      placedAssets: expect.any(Number),
      inventory: room.scene.inventoryItems.length,
      equipment: room.scene.equipmentRecords.length,
    });
    expect(result.summary.floorAreaM2).toBeGreaterThan(0);
    expect(result.checks).toEqual({
      closedFloorShell: expect.any(Boolean),
      hostedOpenings: expect.any(Boolean),
      supportedBenchEquipment: expect.any(Boolean),
      objectsInsideBoundary: expect.any(Boolean),
      frontWorkingZonesClear: expect.any(Boolean),
      uniqueIndexCodes: expect.any(Boolean),
    });
    expect(result.basis).toContainEqual(expect.stringContaining("not regulatory certification"));
    expect(project).toEqual(before);
  });

  it("keeps the published R-001 analytical room ready for a fresh judge session", () => {
    const project = createPublicShowcaseProject();

    const result = auditRoom({ roomCode: "R-001" }, () => project);

    expect(result.status).toBe("ready");
    expect(result.issues).toEqual([]);
    expect(result.checks).toEqual({
      closedFloorShell: true,
      hostedOpenings: true,
      objectsInsideBoundary: true,
      supportedBenchEquipment: true,
      frontWorkingZonesClear: true,
      uniqueIndexCodes: true,
    });
  });

  it("detects the authored R-002 biosafety service-face obstruction", () => {
    const project = createPublicShowcaseProject();
    const room = project.rooms.find((entry) => entry.code === "R-002")!;
    const biosafety = room.scene.objects.find(
      (entry) => entry.assetDefinitionId === "biosafety-cabinet",
    )!;
    const cornerBench = room.scene.objects.find(
      (entry) => entry.assetDefinitionId === "corner-lab-bench",
    )!;

    const result = auditRoom({ roomCode: "R-002" }, () => project);

    expect(result.status).toBe("attention");
    expect(result.checks.frontWorkingZonesClear).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        title: "Front working zone obstructed",
        objectIds: expect.arrayContaining([biosafety.id, cornerBench.id]),
      }),
    );
  });

  it("rejects hidden template rooms and unexpected input", () => {
    const project = createSeedProject();
    const template = project.rooms.find((entry) => entry.roomKind === "demo-template")!;
    expect(() => auditRoom({ roomCode: template.code }, () => project)).toThrow(
      "Editable room not found",
    );
    expect(() => auditRoom({ unexpected: true }, () => project)).toThrow("Unexpected input field");
  });
});

describe("LabSpace hypothetical resize validation", () => {
  it("allows two hosted windows to meet exactly at the centre of their wall", () => {
    const { project, left, right } = hostedWindowFixture();
    const leftResult = validateObjectResize(
      { objectId: left.id, dimensions: { widthMm: 4000 } },
      () => project,
    );
    expect(leftResult).toMatchObject({ valid: true, proposed: { widthMm: 4000 }, conflicts: [] });

    const room = project.rooms.find((entry) => entry.id === left.roomId)!;
    room.scene.objects = room.scene.objects.map((entry) =>
      entry.id === left.id
        ? {
            ...entry,
            dimensions: { ...entry.dimensions, width: 4000 },
            opening: { ...entry.opening!, width: 4000 },
          }
        : entry,
    );
    const rightResult = validateObjectResize(
      { objectId: right.id, dimensions: { widthMm: 4000 } },
      () => project,
    );
    expect(rightResult).toMatchObject({ valid: true, proposed: { widthMm: 4000 }, conflicts: [] });
  });

  it("rejects wall overflow, sibling overlap, excessive height, and hosted-opening depth changes", () => {
    const { project, left } = hostedWindowFixture();
    expect(
      validateObjectResize({ objectId: left.id, dimensions: { widthMm: 4200 } }, () => project)
        .conflicts,
    ).toContainEqual(expect.objectContaining({ type: "opening-outside-wall" }));
    const overlappingProject = structuredClone(project);
    const overlappingRoom = overlappingProject.rooms.find((entry) => entry.id === left.roomId)!;
    const right = overlappingRoom.scene.objects.find((entry) => entry.id === "window-right")!;
    right.opening = { ...right.opening!, offset: 3500 };
    right.position = { ...right.position, x: 3500 };
    expect(
      validateObjectResize(
        { objectId: left.id, dimensions: { widthMm: 4000 } },
        () => overlappingProject,
      ).conflicts,
    ).toContainEqual(expect.objectContaining({ type: "opening-overlap" }));
    expect(
      validateObjectResize({ objectId: left.id, dimensions: { heightMm: 2200 } }, () => project)
        .conflicts,
    ).toContainEqual(expect.objectContaining({ type: "above-room-height" }));
    expect(
      validateObjectResize({ objectId: left.id, dimensions: { depthMm: 300 } }, () => project)
        .conflicts,
    ).toContainEqual(expect.objectContaining({ type: "restricted-object" }));
  });

  it("is read-only and rejects malformed or no-op resize requests", () => {
    const { project, left } = hostedWindowFixture();
    const before = structuredClone(project);
    const result = validateObjectResize(
      { objectId: left.id, dimensions: { widthMm: 4000 } },
      () => project,
    );
    expect(result.current.widthMm).toBe(2400);
    expect(project).toEqual(before);
    expect(() =>
      validateObjectResize({ objectId: left.id, dimensions: {} }, () => project),
    ).toThrow("At least one resize dimension");
    expect(() =>
      validateObjectResize({ objectId: left.id, dimensions: { widthMm: 2400 } }, () => project),
    ).toThrow("must change");
  });
});

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

  it("keeps bench equipment on a real support surface and rejects floating floor moves", () => {
    const project = createSeedProject();
    const room = project.rooms.find((entry) => entry.roomKind === "demo")!;
    const rotary = room.scene.objects.find(
      (entry) => entry.assetDefinitionId === "rotary-evaporator",
    )!;

    const supported = validateObjectMove(
      {
        objectId: rotary.id,
        target: { xMm: rotary.position.x, yMm: rotary.position.y },
      },
      () => project,
    );
    expect(supported).toMatchObject({
      valid: true,
      target: { zMm: 900 },
      conflicts: [],
    });

    const unsupported = validateObjectMove(
      { objectId: rotary.id, target: { xMm: 7200, yMm: 1800 } },
      () => project,
    );
    expect(unsupported.valid).toBe(false);
    expect(unsupported.conflicts).toContainEqual(
      expect.objectContaining({ type: "missing-support-surface" }),
    );
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
  it("interprets in-front-of from the reference object and returns a facing rotation", () => {
    const { project, room, first, second } = spatialFixture();
    first.assetDefinitionId = "biosafety-cabinet";
    first.name = "Biosafety cabinet";
    first.dimensions = { width: 1500, depth: 800, height: 2250 };
    first.position = { x: 4600, y: 3900, z: 0 };
    second.assetDefinitionId = "laboratory-chair";
    second.name = "Laboratory chair";
    second.dimensions = { width: 560, depth: 560, height: 920 };
    second.position = { x: 2000, y: 2000, z: 0 };
    second.rotation.z = 0;
    room.scene.objects = [first, second];

    const result = recommendObjectPlacements(
      {
        objectId: first.id,
        relativeTo: {
          objectId: second.id,
          relation: "in-front-of",
          clearanceMm: 500,
        },
        limit: 2,
      },
      () => project,
    );

    expect(result.relativeTo).toMatchObject({
      objectId: second.id,
      relation: "in-front-of",
      clearanceMm: 500,
      facingRotationDeg: 180,
    });
    expect(result.preferredTarget).toEqual({ xMm: 2000, yMm: 3200 });
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].target.rotationDeg).toBe(180);
    expect(result.candidates[0].rationale.join(" ")).toContain("authored front");
    expect(
      validateObjectMove(
        {
          objectId: first.id,
          target: {
            xMm: result.candidates[0].target.xMm,
            yMm: result.candidates[0].target.yMm,
          },
          rotationDeg: result.candidates[0].target.rotationDeg,
        },
        () => project,
      ).valid,
    ).toBe(true);
  });

  it("returns no candidate instead of silently crossing to the wrong side", () => {
    const { project, room, first, second } = spatialFixture();
    first.assetDefinitionId = "biosafety-cabinet";
    first.dimensions = { width: 1500, depth: 800, height: 2250 };
    first.position = { x: 3000, y: 3500, z: 0 };
    second.assetDefinitionId = "laboratory-chair";
    second.dimensions = { width: 560, depth: 560, height: 920 };
    second.position = { x: 700, y: 2200, z: 0 };
    second.rotation.z = 90;
    room.scene.objects = [first, second];

    const result = recommendObjectPlacements(
      {
        objectId: first.id,
        relativeTo: { objectId: second.id, relation: "in-front-of", clearanceMm: 500 },
      },
      () => project,
    );

    expect(result.preferredTarget.xMm).toBeLessThan(0);
    expect(result.candidates).toEqual([]);
    expect(result.relativeTo?.facingRotationDeg).toBe(270);
  });

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
    expect(() =>
      recommendObjectPlacements(
        {
          objectId: fresh.first.id,
          preferredTarget: { xMm: 2000, yMm: 2000 },
          relativeTo: { objectId: fresh.second.id, relation: "in-front-of" },
        },
        () => fresh.project,
      ),
    ).toThrow("either preferredTarget or relativeTo");
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
