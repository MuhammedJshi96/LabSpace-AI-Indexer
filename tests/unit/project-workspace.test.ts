import { afterEach, describe, expect, it, vi } from "vitest";

describe("multi-laboratory project workspace", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("creates laboratories and blank rooms, switches rooms, and resolves custom layers", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    });
    const [{ createBlankProject }, { useEditorStore }] = await Promise.all([
      import("../../src/domain/room-factory"),
      import("../../src/store/editor-store"),
    ]);
    const initial = createBlankProject({ name: "Professional lab network" });
    useEditorStore.getState().replaceProject(initial);

    const laboratoryId = useEditorStore.getState().createLaboratory({
      name: "Microscopy core",
      code: "MIC-01",
    });
    expect(laboratoryId).toBeTruthy();
    let state = useEditorStore.getState();
    const microscopy = state.project.laboratories.find(
      (laboratory) => laboratory.id === laboratoryId,
    )!;
    expect(microscopy.roomIds).toHaveLength(1);
    expect(state.project.activeRoomId).toBe(microscopy.roomIds[0]);
    expect(
      state.project.rooms.find((room) => room.id === microscopy.roomIds[0])?.scene.objects,
    ).toEqual([]);

    const secondRoomId = state.createRoom({
      laboratoryId: initial.laboratories[0].id,
      name: "Cell culture suite",
      code: "R210",
    });
    expect(secondRoomId).toBeTruthy();
    state = useEditorStore.getState();
    expect(state.project.activeRoomId).toBe(secondRoomId);
    expect(
      state.project.rooms.find((room) => room.id === secondRoomId)?.environmentProfileId,
    ).toBeNull();

    state.switchRoom(microscopy.roomIds[0]);
    expect(useEditorStore.getState().project.activeRoomId).toBe(microscopy.roomIds[0]);

    expect(useEditorStore.getState().deleteRoom(microscopy.roomIds[0])).toBe(true);
    state = useEditorStore.getState();
    expect(state.project.rooms.some((room) => room.id === microscopy.roomIds[0])).toBe(false);
    expect(
      state.project.laboratories
        .find((laboratory) => laboratory.id === laboratoryId)
        ?.roomIds.includes(microscopy.roomIds[0]),
    ).toBe(false);
    expect(state.project.activeRoomId).not.toBe(microscopy.roomIds[0]);

    const customProject = createBlankProject();
    customProject.rooms[0].scene.layers = [
      {
        id: "imported-instrument-layer",
        name: "Instruments",
        visible: true,
        locked: false,
        order: 7,
        color: "#345678",
        system: false,
      },
    ];
    useEditorStore.getState().replaceProject(customProject);
    const objectId = useEditorStore.getState().addAsset("benchtop-centrifuge");
    const current = useEditorStore.getState().project.rooms[0];
    expect(current.scene.objects.find((object) => object.id === objectId)?.layerId).toBe(
      "imported-instrument-layer",
    );
    expect(useEditorStore.getState().deleteRoom(customProject.rooms[0].id)).toBe(false);
  });
});
