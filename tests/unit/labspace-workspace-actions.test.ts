import { afterEach, describe, expect, it, vi } from "vitest";
import { clearStoredRoomPlans, planRoomLayout } from "../../src/agent/labspace-layout-actions";
import { stageRoomLayout } from "../../src/agent/labspace-staging-actions";
import {
  clearInitialRoomPlanCapabilities,
  createLabRoom,
} from "../../src/agent/labspace-workspace-actions";
import { createBlankProject } from "../../src/domain/room-factory";
import type { Project } from "../../src/domain/schema";
import { useEditorStore } from "../../src/store/editor-store";

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
  useEditorStore.setState({ pendingAgentChange: null });
});

describe("WebMCP blank-room creation boundary", () => {
  it("creates and saves a room, then auto-commits exactly one complete initial blueprint", async () => {
    const project = workspaceFixture();
    const laboratory = project.laboratories[0];
    const created = await createLabRoom({
      name: "Office for Students",
      code: "812",
      laboratoryCode: laboratory.code,
    });

    expect(created).toMatchObject({
      created: true,
      roomName: "Office for Students",
      roomCode: "812",
      floor: 8,
      blank: true,
      active: true,
      persisted: true,
      initialLayoutAutoCommitEligible: true,
      requiresHumanApproval: false,
    });
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
