import { afterEach, describe, expect, it, vi } from "vitest";

describe("universal project inventory registry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("moves one canonical record between laboratories without recreating it", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    });
    const [{ createBlankProject }, { useEditorStore }] = await Promise.all([
      import("../../src/domain/room-factory"),
      import("../../src/store/editor-store"),
    ]);
    const project = createBlankProject({ name: "Shared inventory network" });
    useEditorStore.getState().replaceProject(project);

    const sourceRoom = useEditorStore.getState().project.rooms[0];
    const laboratoryId = useEditorStore.getState().createLaboratory({
      name: "Analytical core",
      code: "AIC-01",
    });
    const targetRoom = useEditorStore
      .getState()
      .project.rooms.find((room) => room.laboratoryId === laboratoryId)!;
    const itemId = useEditorStore.getState().addInventoryItemToRoom(sourceRoom.id, null, {
      name: "Shared reference material",
      quantity: 4,
      unit: "vials",
    });

    expect(itemId).toBeTruthy();
    expect(
      useEditorStore.getState().moveInventoryItemToRoom(sourceRoom.id, itemId!, targetRoom.id),
    ).toBe(true);

    const state = useEditorStore.getState();
    expect(
      state.project.rooms
        .find((room) => room.id === sourceRoom.id)
        ?.scene.inventoryItems.some((item) => item.id === itemId),
    ).toBe(false);
    expect(
      state.project.rooms
        .find((room) => room.id === targetRoom.id)
        ?.scene.inventoryItems.find((item) => item.id === itemId),
    ).toMatchObject({
      id: itemId,
      name: "Shared reference material",
      quantity: 4,
      unit: "vials",
      storageLocationId: null,
    });
  });
});
