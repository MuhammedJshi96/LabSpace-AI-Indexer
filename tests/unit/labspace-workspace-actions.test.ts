import { afterEach, describe, expect, it, vi } from "vitest";
import { clearStoredRoomPlans, planRoomLayout } from "../../src/agent/labspace-layout-actions";
import {
  approveStagedChange,
  cancelStagedChange,
  stageRoomLayout,
} from "../../src/agent/labspace-staging-actions";
import {
  clearInitialRoomPlanCapabilities,
  createLabRoom,
} from "../../src/agent/labspace-workspace-actions";
import { createBlankProject } from "../../src/domain/room-factory";
import type { Project } from "../../src/domain/schema";
import { useEditorStore } from "../../src/store/editor-store";
import {
  resetWebMcpExecutionPolicyForTests,
  useWebMcpExecutionPolicyStore,
} from "../../src/agent/webmcp-execution-policy";

function workspaceFixture() {
  const project = createBlankProject({
    name: "WebMCP workspace test",
    laboratory: { name: "Student Laboratory", code: "LAB-STUDENT" },
    room: { name: "Existing room", code: "801" },
  });
  useEditorStore.setState({
    project,
    hydrated: true,
    selectedIds: [],
    selectedLocationId: null,
    history: [],
    future: [],
    pendingAgentChange: null,
    dirtyRevision: 5,
    saveStatus: "saved",
    saveError: null,
    toasts: [],
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const saved = JSON.parse(String(init?.body)) as Project;
      return new Response(JSON.stringify(saved), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return project;
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearStoredRoomPlans();
  clearInitialRoomPlanCapabilities();
  resetWebMcpExecutionPolicyForTests();
  useEditorStore.setState({ pendingAgentChange: null });
});

describe("WebMCP blank-room creation boundary", () => {
  it("defaults to a human-reviewed room proposal without mutating the workspace", async () => {
    const project = workspaceFixture();
    const beforeRoomIds = project.rooms.map((room) => room.id);
    const proposed = await createLabRoom({
      name: "Reviewed office",
      code: "814",
      laboratoryCode: project.laboratories[0].code,
    });

    expect(proposed).toMatchObject({
      created: false,
      staged: true,
      requiresHumanApproval: true,
      executionMode: "reviewed",
      executionDisposition: "review-required",
    });
    expect(useEditorStore.getState().project.rooms.map((room) => room.id)).toEqual(beforeRoomIds);
    expect(useEditorStore.getState().pendingAgentChange).toMatchObject({
      tool: "workspace",
      roomName: "Reviewed office",
      roomCode: "814",
    });

    if (proposed.created) throw new Error("Expected a reviewed proposal.");
    await expect(
      createLabRoom({
        name: "Reviewed office",
        code: "814",
        laboratoryCode: project.laboratories[0].code,
      }),
    ).resolves.toMatchObject({ stageId: proposed.stageId, staged: true });
    approveStagedChange(proposed.stageId);
    await vi.waitFor(() => expect(useEditorStore.getState().saveStatus).toBe("saved"));
    expect(useEditorStore.getState().project.rooms.at(-1)).toMatchObject({
      name: "Reviewed office",
      code: "814",
      facilityPlacement: { floor: 7 },
    });

    const plan = planRoomLayout({
      roomShell: { widthMm: 6000, depthMm: 5000 },
      assets: [{ assetId: "office-desk", quantity: 1 }],
    });
    const staged = stageRoomLayout({ planId: plan.planId });
    expect(staged).toMatchObject({
      autoCommitted: false,
      requiresHumanApproval: true,
      executionMode: "reviewed",
      executionDisposition: "review-required",
    });
    expect(useEditorStore.getState().pendingAgentChange?.tool).toBe("layout");
    cancelStagedChange(staged.stageId);
  });

  it("uses human-authorized Fast Draft for one complete initial blueprint only", async () => {
    const project = workspaceFixture();
    useWebMcpExecutionPolicyStore.getState().setModeFromHumanUi("fast-draft");
    const laboratory = project.laboratories[0];
    const created = await createLabRoom({
      name: "Office for Students",
      code: "812",
      laboratoryCode: laboratory.code,
    });

    expect(created).toMatchObject({
      created: true,
      staged: false,
      roomName: "Office for Students",
      roomCode: "812",
      floor: 8,
      blank: true,
      active: true,
      persisted: true,
      initialLayoutAutoCommitEligible: true,
      requiresHumanApproval: false,
      executionMode: "fast-draft",
      executionDisposition: "fast-applied",
    });
    if (!created.created) throw new Error("Fast Draft should create the validated room.");
    const blankRoom = useEditorStore
      .getState()
      .project.rooms.find((room) => room.id === created.roomId)!;
    expect(blankRoom.facilityPlacement?.floor).toBe(7);
    expect(blankRoom.scene.objects).toEqual([]);
    expect(useEditorStore.getState().saveStatus).toBe("saved");

    const plan = planRoomLayout({
      brief: "A six-wall student office with four complete workstations.",
      aisleMm: 700,
      roomShell: {
        vertices: [
          { xMm: 0, yMm: 0 },
          { xMm: 8000, yMm: 0 },
          { xMm: 8000, yMm: 3000 },
          { xMm: 6500, yMm: 3000 },
          { xMm: 6500, yMm: 5000 },
          { xMm: 0, yMm: 5000 },
        ],
      },
      assets: [
        { assetId: "office-desk", quantity: 4 },
        { assetId: "office-chair", quantity: 4 },
        {
          assetId: "tall-cabinet",
          quantity: 1,
          position: { xMm: 500, yMm: 2500 },
        },
        {
          assetId: "single-door",
          quantity: 1,
          placement: "wall",
          host: { wallIndex: 6, offsetMm: 1000, handing: "right", swing: "inward" },
        },
        {
          assetId: "standard-window",
          quantity: 1,
          placement: "wall",
          host: { wallIndex: 1, offsetMm: 5000, sillHeightMm: 900 },
        },
      ],
    });

    expect(plan.unplaced).toEqual([]);
    expect(plan.shell.segments).toHaveLength(6);
    expect(plan.proposals.filter((proposal) => proposal.assetId === "office-chair")).toHaveLength(
      4,
    );
    expect(
      plan.proposals
        .filter((proposal) => proposal.assetId === "office-chair")
        .every((proposal) => proposal.snappedTo?.relation === "workstation"),
    ).toBe(true);
    expect(
      plan.proposals.find((proposal) => proposal.assetId === "tall-cabinet")?.rotationDeg,
    ).toBe(270);

    const staged = stageRoomLayout({ planId: plan.planId });
    const state = useEditorStore.getState();
    const room = state.project.rooms.find((entry) => entry.id === created.roomId)!;
    const door = room.scene.objects.find((object) => object.objectType === "door")!;
    const window = room.scene.objects.find((object) => object.objectType === "window")!;

    expect(staged).toMatchObject({
      staged: true,
      objectCount: 17,
      wallCount: 6,
      assetCount: 11,
      autoCommitted: true,
      requiresHumanApproval: false,
    });
    expect(state.pendingAgentChange).toBeNull();
    expect(state.history).toHaveLength(1);
    expect(room.scene.objects.every((object) => object.locked === false)).toBe(true);
    expect(door.opening).toMatchObject({ handing: "right", swing: "inward" });
    expect(room.scene.objects.some((object) => object.id === door.opening?.wallId)).toBe(true);
    expect(window.opening).toMatchObject({ sillHeight: 900 });

    state.undo();
    useEditorStore.setState({ saveStatus: "saved" });
    const secondPlan = planRoomLayout({
      roomShell: { widthMm: 7000, depthMm: 5000 },
      assets: [],
    });
    const secondStage = stageRoomLayout({ planId: secondPlan.planId });
    expect(secondStage).toMatchObject({
      autoCommitted: false,
      requiresHumanApproval: true,
    });
    expect(useEditorStore.getState().pendingAgentChange?.tool).toBe("layout");
  });
});
