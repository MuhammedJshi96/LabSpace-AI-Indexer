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
    });
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
      objectCount: 1,
      persisted: false,
      requiresHumanApproval: true,
    });
    expect(proposed).toHaveLength(1);
    expect(proposed[0].locked).toBe(true);
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
    expect(scene.objects).toHaveLength(2);
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

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().project.rooms[0].scene.objects).toHaveLength(2);
    expect(useEditorStore.getState().project.rooms[0].scene.storageLocations.length).toBeGreaterThan(1);
    expect(useEditorStore.getState().project.rooms[0].scene.equipmentRecords).toHaveLength(1);
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
