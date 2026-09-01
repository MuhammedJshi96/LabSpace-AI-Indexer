import { afterEach, describe, expect, it } from "vitest";
import {
  clearStoredAnnexPlans,
  planAnnex,
  stageAnnexPlan,
} from "../../src/agent/labspace-annex-actions";
import {
  clearStoredRoomPlans,
  planRoomLayout,
} from "../../src/agent/labspace-layout-actions";
import {
  approveStagedChange,
  cancelStagedChange,
  stageRoomLayout,
} from "../../src/agent/labspace-staging-actions";
import { getRoomSpaceFloorPlans } from "../../src/domain/room-geometry";
import { createBlankProject } from "../../src/domain/room-factory";
import { useEditorStore } from "../../src/store/editor-store";

function annexFixture() {
  const project = createBlankProject({
    name: "Annex planning test",
    room: { name: "Main laboratory", code: "MAIN-01", width: 8000, depth: 6000 },
  });
  useEditorStore.setState({
    project,
    hydrated: true,
    selectedIds: [],
    selectedLocationId: null,
    history: [],
    future: [],
    pendingAgentChange: null,
    dirtyRevision: 1,
    saveStatus: "saved",
    saveError: null,
    toasts: [],
  });
  const shell = planRoomLayout({
    brief: "Closed primary laboratory with one existing hosted opening",
    roomShell: { widthMm: 8000, depthMm: 6000 },
    assets: [
      {
        assetId: "standard-window",
        quantity: 1,
        host: { wallIndex: 1, offsetMm: 750, sillHeightMm: 900 },
      },
    ],
  });
  const staged = stageRoomLayout({ planId: shell.planId });
  approveStagedChange(staged.stageId);
  clearStoredRoomPlans();
  const committed = useEditorStore.getState();
  useEditorStore.setState({
    history: [],
    future: [],
    dirtyRevision: 9,
    saveStatus: "saved",
    selectedIds: [],
    pendingAgentChange: null,
  });
  const room = committed.project.rooms.find((entry) => entry.id === project.activeRoomId)!;
  const opening = room.scene.objects.find((object) => object.assetDefinitionId === "standard-window")!;
  const host = room.scene.objects.find((object) => object.id === opening.opening?.wallId)!;
  return { room, host, opening };
}

function request(hostWallId: string) {
  return {
    parentRoomCode: "MAIN-01",
    name: "Sample preparation annex",
    code: "MAIN-01-A",
    hostWallId,
    widthAlongWallMm: 4500,
    outwardDepthMm: 3600,
    offsetAlongWallMm: 1750,
    floorFinish: "Warm welded laboratory vinyl",
    connector: {
      assetId: "double-door",
      offsetMm: 2250,
      handing: "left",
      opensInto: "annex",
    },
    windows: [
      { assetId: "standard-window", wall: "outer", sillHeightMm: 900 },
    ],
    assets: [],
  };
}

afterEach(() => {
  clearStoredAnnexPlans();
  clearStoredRoomPlans();
  useEditorStore.setState({ pendingAgentChange: null });
});

describe("reviewed connected-space annex planning", () => {
  it("splits a stable host, remaps its existing opening, and validates independent areas", () => {
    const { room, host, opening } = annexFixture();
    const plan = planAnnex(request(host.id));

    expect(plan).toMatchObject({
      roomId: room.id,
      hostWallId: host.id,
      sharedWallId: host.id,
      remappedOpeningIds: [opening.id],
      areas: { primaryM2: 48, annexM2: 16.2, totalM2: 64.2 },
      requiresHumanApproval: true,
    });
    expect(plan.connectorId).toBeTruthy();
    expect(plan.windowIds).toHaveLength(1);
  });

  it("rejects a split junction that crosses an existing hosted opening", () => {
    const { host } = annexFixture();
    expect(() =>
      planAnnex({
        ...request(host.id),
        offsetAlongWallMm: 1000,
        widthAlongWallMm: 4500,
      }),
    ).toThrow(/crosses an annex wall junction/i);
  });

  it("stages a reviewed-only preview and cancellation restores the exact room", () => {
    const { host } = annexFixture();
    const before = structuredClone(
      useEditorStore.getState().project.rooms.find((room) => room.code === "MAIN-01")!,
    );
    const plan = planAnnex(request(host.id));
    const staged = stageAnnexPlan({ planId: plan.planId });
    const previewState = useEditorStore.getState();
    const previewRoom = previewState.project.rooms.find((room) => room.id === plan.roomId)!;

    expect(staged).toMatchObject({
      staged: true,
      requiresHumanApproval: true,
      autoCommitted: false,
      executionMode: "reviewed",
      executionDisposition: "review-required",
    });
    expect(previewRoom.spaces).toHaveLength(2);
    expect(previewState.history).toEqual([]);
    expect(previewState.pendingAgentChange).toMatchObject({
      tool: "layout",
      changeKind: "annex",
    });

    cancelStagedChange(staged.stageId);
    expect(useEditorStore.getState().project.rooms.find((room) => room.id === plan.roomId)).toEqual(
      before,
    );
    expect(useEditorStore.getState().pendingAgentChange).toBeNull();
  });

  it("commits spaces, connectivity, and geometry atomically, then one Undo restores all", () => {
    const { host } = annexFixture();
    const before = structuredClone(
      useEditorStore.getState().project.rooms.find((room) => room.code === "MAIN-01")!,
    );
    const plan = planAnnex(request(host.id));
    const staged = stageAnnexPlan({ planId: plan.planId });
    approveStagedChange(staged.stageId);

    const committedState = useEditorStore.getState();
    const committed = committedState.project.rooms.find((room) => room.id === plan.roomId)!;
    const floors = getRoomSpaceFloorPlans(committed);
    const connector = committed.scene.objects.find((object) => object.id === plan.connectorId)!;
    expect(committedState.history).toHaveLength(1);
    expect(committedState.history[0]).toMatchObject({ roomId: plan.roomId });
    expect(floors.map((floor) => floor.areaMm2 / 1_000_000).sort((a, b) => a - b)).toEqual([
      16.2,
      48,
    ]);
    expect(connector.opening?.connectsSpaceIds).toEqual([
      plan.primarySpaceId,
      plan.annexSpaceId,
    ]);
    expect(connector.opening?.opensIntoSpaceId).toBe(plan.annexSpaceId);

    useEditorStore.getState().undo();
    const restored = useEditorStore
      .getState()
      .project.rooms.find((room) => room.id === plan.roomId)!;
    expect({
      ...restored,
      updatedAt: before.updatedAt,
      scene: { ...restored.scene, updatedAt: before.scene.updatedAt },
    }).toEqual(before);
  });
});
