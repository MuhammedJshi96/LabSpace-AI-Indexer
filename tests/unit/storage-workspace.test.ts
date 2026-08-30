import { beforeEach, describe, expect, it } from "vitest";
import { createSeedProject } from "../../src/domain/seed";
import { ProjectSchema } from "../../src/domain/schema";
import { useEditorStore } from "../../src/store/editor-store";

describe("room-scoped storage management", () => {
  beforeEach(() =>
    useEditorStore.setState({
      project: createSeedProject(),
      history: [],
      future: [],
      pendingAgentChange: null,
      selectedIds: ["editor-selection"],
      selectedLocationId: "editor-location",
      pan: { x: 23, y: 41 },
      zoom: 1.3,
    }),
  );
  const target = () =>
    useEditorStore
      .getState()
      .project.rooms.find((room) => room.code === "DEMO-01" && room.roomKind !== "demo-template")!;
  it("completes storage in another room without changing the layout context", () => {
    const initial = useEditorStore.getState();
    const room = target();
    const inventory = room.scene.inventoryItems;
    initial.completeRoomStorage(room.id);
    const state = useEditorStore.getState();
    expect(state.project.activeRoomId).toBe(initial.project.activeRoomId);
    expect(state.selectedIds).toEqual(initial.selectedIds);
    expect(state.selectedLocationId).toBe(initial.selectedLocationId);
    expect(state.pan).toEqual(initial.pan);
    expect(state.zoom).toBe(initial.zoom);
    expect(target().scene.inventoryItems).toEqual(inventory);
    expect(target().scene.storageLocations.length).toBeGreaterThan(
      room.scene.storageLocations.length,
    );
    state.undo();
    expect(target().scene.storageLocations.map((entry) => entry.id)).toEqual(
      room.scene.storageLocations.map((entry) => entry.id),
    );
    expect(state.project.rooms.find((entry) => entry.id === initial.project.activeRoomId)).toEqual(
      initial.project.rooms.find((entry) => entry.id === initial.project.activeRoomId),
    );
    useEditorStore.getState().redo();
    expect(ProjectSchema.safeParse(useEditorStore.getState().project).success).toBe(true);
  });
  it("adding and removing a custom bin is undoable without restoring stale stock", () => {
    const room = target();
    const shelf = room.scene.storageLocations.find((entry) => entry.type === "shelf")!;
    const state = useEditorStore.getState();
    const id = state.addStorageChild(shelf.id, "bin", room.id)!;
    expect(id).toBeTruthy();
    expect(useEditorStore.getState().selectedLocationId).toBe("editor-location");
    const itemId = state.addInventoryItemToRoom(room.id, id, {
      name: "Test stock",
      quantity: 7,
      unit: "vials",
    })!;
    state.removeStorageLocation(id, room.id);
    expect(
      target().scene.inventoryItems.find((item) => item.id === itemId)?.storageLocationId,
    ).toBeNull();
    state.updateInventoryItemInRoom(room.id, itemId, { quantity: 11, notes: "Newer stock edit" });
    state.undo();
    expect(target().scene.inventoryItems.find((item) => item.id === itemId)).toMatchObject({
      storageLocationId: id,
      quantity: 11,
      notes: "Newer stock edit",
    });
    expect(target().scene.storageLocations.some((entry) => entry.id === id)).toBe(true);
    state.redo();
    expect(target().scene.inventoryItems.find((item) => item.id === itemId)).toMatchObject({
      storageLocationId: null,
      quantity: 11,
    });
    expect(target().scene.objects).toEqual(room.scene.objects);
  });
  it("metadata history preserves later names, stock and object transforms", () => {
    const room = target();
    const location = room.scene.storageLocations.find((entry) => entry.type === "shelf")!;
    const item = room.scene.inventoryItems[0];
    const state = useEditorStore.getState();
    state.updateStorageLocation(
      location.id,
      { capacityNotes: "Small vials", id: "must-not-change" },
      room.id,
    );
    state.updateInventoryItemInRoom(room.id, item.id, { quantity: 99 });
    state.undo();
    expect(
      target().scene.storageLocations.find((entry) => entry.id === location.id)?.capacityNotes,
    ).toBe(location.capacityNotes);
    expect(target().scene.inventoryItems.find((entry) => entry.id === item.id)?.quantity).toBe(99);
    expect(target().scene.objects).toEqual(room.scene.objects);
  });
  it("undoing a newly added bin keeps newer inventory without a dangling assignment", () => {
    const room = target();
    const shelf = room.scene.storageLocations.find((entry) => entry.type === "shelf")!;
    const state = useEditorStore.getState();
    const id = state.addStorageChild(shelf.id, "bin", room.id)!;
    const itemId = state.addInventoryItemToRoom(room.id, id, { name: "New stock", quantity: 4 })!;
    state.undo();
    expect(target().scene.storageLocations.some((entry) => entry.id === id)).toBe(false);
    expect(target().scene.inventoryItems.find((entry) => entry.id === itemId)).toMatchObject({
      quantity: 4,
      storageLocationId: null,
    });
  });
  it("protects templates and rejects edits while an agent preview is pending", () => {
    const state = useEditorStore.getState();
    const room = target();
    const location = room.scene.storageLocations[0];
    useEditorStore.setState({
      pendingAgentChange: {} as NonNullable<typeof state.pendingAgentChange>,
    });
    expect(state.addStorageChild(location.id, "drawer", room.id)).toBeNull();
    state.removeStorageLocation(location.id, room.id);
    state.updateStorageLocation(location.id, { indexCode: "BLOCKED" }, room.id);
    expect(target()).toEqual(room);
    useEditorStore.setState({ pendingAgentChange: null });
    const template = state.project.rooms.find((entry) => entry.roomKind === "demo-template");
    if (template) {
      state.completeRoomStorage(template.id);
      expect(
        useEditorStore.getState().project.rooms.find((entry) => entry.id === template.id),
      ).toEqual(template);
    }
  });
});
