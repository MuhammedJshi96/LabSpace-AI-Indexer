import { afterEach, describe, expect, it } from "vitest";
import {
  clearStoredRoomPlans,
  planRoomLayout,
  searchLabAssets,
} from "../../src/agent/labspace-layout-actions";
import {
  approveStagedChange,
  cancelStagedChange,
  stageRoomLayout,
} from "../../src/agent/labspace-staging-actions";
import { getClosedWallFloorPolygon } from "../../src/domain/room-geometry";
import { createBlankProject } from "../../src/domain/room-factory";
import { useEditorStore } from "../../src/store/editor-store";

function blankLayoutFixture() {
  const project = createBlankProject({
    name: "Agent planning test",
    room: { name: "Empty planning room", code: "PLAN-01", width: 10_000, depth: 8_000 },
  });
  useEditorStore.setState({
    project,
    hydrated: true,
    selectedIds: [],
    selectedLocationId: null,
    history: [],
    future: [],
    pendingAgentChange: null,
    dirtyRevision: 4,
    saveStatus: "saved",
    saveError: null,
    toasts: [],
  });
  return project;
}

afterEach(() => {
  clearStoredRoomPlans();
  useEditorStore.setState({ pendingAgentChange: null });
});

describe("LabSpace browser-agent room planning", () => {
  it("searches canonical catalog assets with dimensions and indexing behavior", () => {
    const result = searchLabAssets({ query: "laboratory bench", categories: ["Furniture"] });

    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.results).toContainEqual(
      expect.objectContaining({
        assetId: "lab-bench",
        dimensionsMm: { width: 1800, depth: 750, height: 900 },
        indexingBehavior: "storage",
      }),
    );
    expect(() => searchLabAssets({ query: "", unexpected: true })).toThrow();
  });

  it("calculates a geometry-valid read-only furniture plan for the active room", () => {
    const project = blankLayoutFixture();
    const before = structuredClone(project);

    const plan = planRoomLayout({
      brief: "A preparation lab with perimeter storage and one central island.",
      aisleMm: 900,
      assets: [
        { assetId: "lab-bench", quantity: 1, placement: "perimeter" },
        { assetId: "center-island-bench", quantity: 1, placement: "island" },
      ],
    });

    expect(plan).toMatchObject({
      roomCode: "PLAN-01",
      requestedObjects: 2,
      plannedObjects: 2,
      requiresHumanApproval: true,
      unplaced: [],
      shell: {
        mode: "proposed",
        widthMm: 10_000,
        depthMm: 8_000,
        segments: expect.any(Array),
      },
    });
    expect(plan.shell.segments).toHaveLength(4);
    expect(plan.proposals.map((proposal) => proposal.assetId)).toEqual([
      "lab-bench",
      "center-island-bench",
    ]);
    expect(useEditorStore.getState().project).toEqual(before);
    expect(useEditorStore.getState().history).toEqual([]);
    expect(useEditorStore.getState().dirtyRevision).toBe(4);
  });

  it("stages a locked blueprint and cancellation restores the exact project", () => {
    const project = blankLayoutFixture();
    const before = structuredClone(project);
    const plan = planRoomLayout({
      assets: [{ assetId: "lab-bench", quantity: 1, placement: "perimeter" }],
    });

    const staged = stageRoomLayout({ planId: plan.planId });
    const preview = useEditorStore.getState();
    const proposed = preview.project.rooms[0].scene.objects.filter(
      (object) => object.metadata.agentPlanPreview === true,
    );

    expect(staged).toMatchObject({
      staged: true,
      objectCount: 5,
      wallCount: 4,
      assetCount: 1,
      floorGenerated: true,
      persisted: false,
      requiresHumanApproval: true,
    });
    expect(proposed).toHaveLength(5);
    expect(proposed.every((object) => object.locked)).toBe(true);
    expect(proposed.filter((object) => object.objectType === "wall")).toHaveLength(4);
    expect(getClosedWallFloorPolygon(preview.project.rooms[0].scene.objects)).not.toBeNull();
    expect(preview.history).toEqual([]);
    expect(preview.dirtyRevision).toBe(4);
    expect(preview.saveStatus).toBe("saved");

    cancelStagedChange(staged.stageId);
    expect(useEditorStore.getState().project).toEqual(before);
    expect(useEditorStore.getState().pendingAgentChange).toBeNull();
  });

  it("approves objects and index records as one undoable scene transaction", () => {
    blankLayoutFixture();
    const beforeScene = structuredClone(useEditorStore.getState().project.rooms[0].scene);
    const plan = planRoomLayout({
      brief: "Storage and analytical equipment",
      aisleMm: 700,
      roomShell: { widthMm: 7200, depthMm: 5400, wallHeightMm: 3200 },
      assets: [
        { assetId: "lab-bench", quantity: 1, placement: "perimeter" },
        { assetId: "floor-centrifuge", quantity: 1, placement: "open" },
      ],
    });
    const staged = stageRoomLayout({ planId: plan.planId });

    const approved = approveStagedChange(staged.stageId);
    const state = useEditorStore.getState();
    const scene = state.project.rooms[0].scene;

    expect(approved).toMatchObject({ status: "approved", persisted: false });
    expect(scene.objects).toHaveLength(6);
    expect(scene.objects.filter((object) => object.objectType === "wall")).toHaveLength(4);
    expect(getClosedWallFloorPolygon(scene.objects)).not.toBeNull();
    expect(state.project.rooms[0]).toMatchObject({ width: 7200, depth: 5400, wallHeight: 3200 });
    expect(scene.objects.every((object) => object.metadata.agentPlanPreview !== true)).toBe(true);
    expect(scene.objects.every((object) => object.locked === false)).toBe(true);
    expect(scene.storageLocations.length).toBeGreaterThan(1);
    expect(scene.equipmentRecords).toHaveLength(1);
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toMatchObject({ kind: "scene" });
    expect(state.dirtyRevision).toBe(5);
    expect(state.saveStatus).toBe("unsaved");

    state.undo();
    expect(useEditorStore.getState().project.rooms[0].scene).toMatchObject({
      ...beforeScene,
      updatedAt: expect.any(String),
    });
    expect(useEditorStore.getState().project.rooms[0].scene.objects).toEqual([]);
    expect(useEditorStore.getState().project.rooms[0].scene.storageLocations).toEqual([]);
    expect(useEditorStore.getState().project.rooms[0].scene.equipmentRecords).toEqual([]);
    expect(useEditorStore.getState().project.rooms[0]).toMatchObject({
      width: 10_000,
      depth: 8_000,
    });

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().project.rooms[0].scene.objects).toHaveLength(6);
    expect(useEditorStore.getState().project.rooms[0]).toMatchObject({
      width: 7200,
      depth: 5400,
      wallHeight: 3200,
    });
    expect(
      useEditorStore.getState().project.rooms[0].scene.storageLocations.length,
    ).toBeGreaterThan(1);
    expect(useEditorStore.getState().project.rooms[0].scene.equipmentRecords).toHaveLength(1);
  });

  it("builds a wall-only shell and refuses to replace an existing enclosure", () => {
    blankLayoutFixture();
    const shellPlan = planRoomLayout({
      brief: "Create the room enclosure before furnishing it.",
      roomShell: { widthMm: 6000, depthMm: 5000, wallThicknessMm: 180 },
      assets: [],
    });

    expect(shellPlan).toMatchObject({
      requestedObjects: 0,
      plannedObjects: 0,
      shell: { mode: "proposed", widthMm: 6000, depthMm: 5000, wallThicknessMm: 180 },
    });
    const staged = stageRoomLayout({ planId: shellPlan.planId });
    expect(staged).toMatchObject({ objectCount: 4, wallCount: 4, assetCount: 0 });
    approveStagedChange(staged.stageId);
    useEditorStore.setState({ saveStatus: "saved" });

    expect(() =>
      planRoomLayout({
        roomShell: { widthMm: 7000, depthMm: 5500 },
        assets: [],
      }),
    ).toThrow("already has walls");

    const furnishingPlan = planRoomLayout({
      assets: [{ assetId: "round-stool", quantity: 1, placement: "open" }],
    });
    expect(furnishingPlan.shell).toMatchObject({ mode: "existing", segments: [] });
  });

  it("plans a six-wall room with explicit rotation, elevation, and bench support", () => {
    blankLayoutFixture();
    const plan = planRoomLayout({
      brief: "L-shaped instrument preparation room",
      aisleMm: 700,
      roomShell: {
        vertices: [
          { xMm: 0, yMm: 0 },
          { xMm: 9000, yMm: 0 },
          { xMm: 9000, yMm: 4500 },
          { xMm: 6000, yMm: 4500 },
          { xMm: 6000, yMm: 7500 },
          { xMm: 0, yMm: 7500 },
        ],
        wallHeightMm: 3200,
      },
      assets: [
        {
          assetId: "lab-bench",
          quantity: 1,
          placement: "perimeter",
          position: { xMm: 2000, yMm: 900 },
          rotationDeg: 0,
        },
        {
          assetId: "rotary-evaporator",
          quantity: 1,
          placement: "surface",
          position: { xMm: 2000, yMm: 900 },
          rotationDeg: 180,
          elevationMm: 900,
        },
        {
          assetId: "floor-centrifuge",
          quantity: 1,
          placement: "open",
          position: { xMm: 4200, yMm: 5900 },
          rotationDeg: 90,
          elevationMm: 0,
        },
      ],
    });

    expect(plan.shell).toMatchObject({
      mode: "proposed",
      shape: "polygon",
      widthMm: 9000,
      depthMm: 7500,
    });
    expect(plan.shell.segments).toHaveLength(6);
    expect(plan.unplaced).toEqual([]);
    const rotary = plan.proposals.find((proposal) => proposal.assetId === "rotary-evaporator")!;
    const centrifuge = plan.proposals.find((proposal) => proposal.assetId === "floor-centrifuge")!;
    expect(rotary).toMatchObject({
      position: { zMm: 900 },
      rotationDeg: 180,
      placement: "surface",
    });
    expect(centrifuge).toMatchObject({
      position: { xMm: 4200, yMm: 5900, zMm: 0 },
      rotationDeg: 90,
    });
  });

  it("rejects self-crossing custom room polygons", () => {
    blankLayoutFixture();
    expect(() =>
      planRoomLayout({
        assets: [],
        roomShell: {
          vertices: [
            { xMm: 0, yMm: 0 },
            { xMm: 6000, yMm: 5000 },
            { xMm: 0, yMm: 5000 },
            { xMm: 6000, yMm: 0 },
          ],
        },
      }),
    ).toThrow("non-crossing polygon");
  });

  it("rejects stale or unsaved plans before changing the room", () => {
    blankLayoutFixture();
    const plan = planRoomLayout({
      assets: [{ assetId: "round-stool", quantity: 1, placement: "open" }],
    });
    useEditorStore.setState({ saveStatus: "unsaved" });
    expect(() => stageRoomLayout({ planId: plan.planId })).toThrow("finish saving");

    useEditorStore.setState({ saveStatus: "saved" });
    useEditorStore.getState().addAsset("round-stool", { x: 1000, y: 1000 });
    useEditorStore.setState({ saveStatus: "saved" });
    expect(() => stageRoomLayout({ planId: plan.planId })).toThrow("room changed");
  });
});
