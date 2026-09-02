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
  it("keeps automatic perimeter storage out of a hosted double-door opening", () => {
    blankLayoutFixture();
    const plan = planRoomLayout({
      roomShell: { widthMm: 6000, depthMm: 6000 },
      assets: [
        {
          assetId: "double-door",
          quantity: 1,
          host: { wallIndex: 1, offsetMm: 3000, swing: "inward" },
        },
        { assetId: "base-drawer-cabinet", quantity: 1, placement: "perimeter" },
      ],
    });
    expect(plan.unplaced).toEqual([]);
    const cabinet = plan.proposals.find((entry) => entry.assetId === "base-drawer-cabinet")!;
    const { xMm, yMm } = cabinet.position;
    expect(Math.abs(xMm - 3000) >= 1200 || yMm >= 1200).toBe(true);
  });
  it("offers the reference pack to WebMCP and shares the editor's high-level window default", () => {
    blankLayoutFixture();
    expect(searchLabAssets({ query: "chiller" }).results).toContainEqual(
      expect.objectContaining({ assetId: "recirculating-chiller", connection: "floor" }),
    );
    const plan = planRoomLayout({
      brief: "A laboratory with high-level glazing and a transom entrance.",
      assets: [
        { assetId: "clerestory-window", quantity: 1, host: { wallIndex: 1, offsetMm: 4000 } },
        { assetId: "double-transom-door", quantity: 1, host: { wallIndex: 2, offsetMm: 4000 } },
      ],
    });
    expect(plan.unplaced).toEqual([]);
    expect(
      plan.proposals.find((p) => p.assetId === "clerestory-window")?.opening?.sillHeightMm,
    ).toBe(2200);
    expect(
      plan.proposals.find((p) => p.assetId === "double-transom-door")?.dimensionsMm.height,
    ).toBe(2650);
    expect(plan.requiresHumanApproval).toBe(true);
  });
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
    const openings = searchLabAssets({
      query: "observation window",
      categories: ["Architecture"],
    });
    expect(openings.results).toContainEqual(
      expect.objectContaining({
        assetId: "standard-window",
        category: "Architecture",
        connection: "wall",
      }),
    );
    expect(searchLabAssets({ query: "computer table" }).results[0]).toMatchObject({
      assetId: "computer-workstation",
    });
    expect(searchLabAssets({ query: "laboratory scale" }).results[0]).toMatchObject({
      assetId: "analytical-balance",
    });
    expect(searchLabAssets({ query: "3 panel window" }).results[0]).toMatchObject({
      assetId: "wide-window",
    });
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

  it("plans the 44 square metre biological-assay suite and pairs chairs to office workstations", () => {
    blankLayoutFixture();
    const plan = planRoomLayout({
      brief: "Biological assays Laboratory, Bio-001, Floor 5",
      aisleMm: 700,
      roomShell: { widthMm: 8000, depthMm: 5500, wallHeightMm: 3000 },
      assets: [
        {
          assetId: "double-door",
          quantity: 1,
          host: { wallIndex: 1, offsetMm: 4000, swing: "inward" },
        },
        {
          assetId: "wide-window",
          quantity: 1,
          host: { wallIndex: 3, offsetMm: 4000, sillHeightMm: 900 },
        },
        {
          assetId: "wide-window",
          quantity: 1,
          host: { wallIndex: 4, offsetMm: 2750, sillHeightMm: 900 },
        },
        { assetId: "center-island-bench", quantity: 1, placement: "island" },
        { assetId: "lab-bench", quantity: 2, placement: "perimeter" },
        { assetId: "tall-cabinet", quantity: 1, placement: "perimeter" },
        { assetId: "lab-freezer", quantity: 1, placement: "perimeter" },
        { assetId: "wall-cabinet", quantity: 2, placement: "perimeter" },
        { assetId: "compound-microscope", quantity: 1, placement: "surface" },
        { assetId: "plate-reader", quantity: 1, placement: "surface" },
        { assetId: "vortex-mixer", quantity: 1, placement: "surface" },
        { assetId: "analytical-balance", quantity: 1, placement: "surface" },
        { assetId: "office-desk", quantity: 1, placement: "perimeter" },
        { assetId: "computer-workstation", quantity: 1, placement: "perimeter" },
        { assetId: "office-chair", quantity: 2, placement: "open" },
      ],
    });

    expect(plan.shell).toMatchObject({ widthMm: 8000, depthMm: 5500 });
    expect((plan.shell.widthMm * plan.shell.depthMm) / 1_000_000).toBe(44);
    expect(plan.requestedObjects).toBe(18);
    expect(plan.unplaced).toEqual([]);
    expect(plan.proposals).toHaveLength(18);
    const chairs = plan.proposals.filter((proposal) => proposal.assetId === "office-chair");
    const hostNames = chairs.map((chair) => chair.snappedTo?.name).sort();
    expect(hostNames).toEqual(["Computer workstation", "Office desk"]);
    expect(
      plan.proposals.find((proposal) => proposal.assetId === "double-door")?.opening,
    ).toMatchObject({ wallIndex: 1, offsetMm: 4000, swing: "inward" });
    expect(
      plan.proposals
        .filter((proposal) => proposal.assetId === "wide-window")
        .map((proposal) => proposal.opening?.wallIndex),
    ).toEqual([3, 4]);
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
