import { describe, expect, it } from "vitest";
import {
  listInventoryLocations,
  planInventory,
} from "../../src/agent/labspace-inventory-actions";
import {
  approveStagedChange,
  cancelStagedChange,
  stageInventoryPlan,
} from "../../src/agent/labspace-staging-actions";
import { createSeedProject } from "../../src/domain/seed";
import { useEditorStore } from "../../src/store/editor-store";

function fixture() {
  const project = createSeedProject();
  const demo = project.rooms.find((room) => room.roomKind === "demo")!;
  project.activeRoomId = demo.id;
  useEditorStore.setState({
    project,
    hydrated: true,
    pendingAgentChange: null,
    dirtyRevision: 3,
    saveStatus: "saved",
    saveError: null,
    toasts: [],
  });
  return { project, demo };
}

describe("human-reviewed WebMCP inventory planning", () => {
  it("lists canonical editable-room locations and excludes factory templates", () => {
    const { project } = fixture();
    const result = listInventoryLocations({ query: "Shelf 01", roomCode: "DEMO-01" });

    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.locations.every((location) => location.roomCode === "DEMO-01")).toBe(true);
    expect(result.locations.some((location) => location.path.includes("Shelf 01"))).toBe(true);
    const templateIds = new Set(
      project.rooms.filter((room) => room.roomKind === "demo-template").map((room) => room.id),
    );
    expect(result.locations.every((location) => !templateIds.has(location.roomId))).toBe(true);
  });

  it("stages without mutation, cancels cleanly, and commits only after approval", () => {
    const { demo } = fixture();
    const location = demo.scene.storageLocations.find((entry) => entry.name === "Shelf 01")!;
    const beforeCount = demo.scene.inventoryItems.length;
    const plan = planInventory({
      entries: [
        {
          roomCode: demo.code,
          name: "WebMCP test tips",
          quantity: 2,
          unit: "boxes",
          storageLocationId: location.id,
          owner: "Shared",
        },
      ],
    });
    expect(plan).toMatchObject({ assignedEntries: 1, unassignedEntries: 0 });

    const firstStage = stageInventoryPlan({ planId: plan.planId });
    expect(useEditorStore.getState().project.rooms.find((room) => room.id === demo.id)!.scene.inventoryItems).toHaveLength(beforeCount);
    cancelStagedChange(firstStage.stageId);
    expect(useEditorStore.getState().pendingAgentChange).toBeNull();

    const secondStage = stageInventoryPlan({ planId: plan.planId });
    approveStagedChange(secondStage.stageId);
    const savedRoom = useEditorStore.getState().project.rooms.find((room) => room.id === demo.id)!;
    expect(savedRoom.scene.inventoryItems).toHaveLength(beforeCount + 1);
    expect(savedRoom.scene.inventoryItems.at(-1)).toMatchObject({
      name: "WebMCP test tips",
      quantity: 2,
      unit: "boxes",
      storageLocationId: location.id,
    });
    expect(useEditorStore.getState()).toMatchObject({
      pendingAgentChange: null,
      saveStatus: "unsaved",
      dirtyRevision: 4,
    });
  });
});
