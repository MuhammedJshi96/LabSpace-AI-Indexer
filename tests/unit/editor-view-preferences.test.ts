import { afterEach, describe, expect, it, vi } from "vitest";

describe("3D view preferences", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("defaults environment context off and stores the choice on the active room", async () => {
    const values = new Map<string, string>();
    const localStorage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    };
    vi.stubGlobal("localStorage", localStorage);

    const firstModule = await import("../../src/store/editor-store");
    expect(firstModule.useEditorStore.getState().environmentContextVisible).toBe(false);

    firstModule.useEditorStore.getState().toggleEnvironmentContext();
    expect(firstModule.useEditorStore.getState().environmentContextVisible).toBe(true);
    const activeRoom = firstModule.useEditorStore
      .getState()
      .project.rooms.find(
        (room) => room.id === firstModule.useEditorStore.getState().project.activeRoomId,
      );
    expect(activeRoom?.viewState?.environmentContextVisible).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      firstModule.LAB_ENVIRONMENT_CONTEXT_VISIBILITY_KEY,
      "true",
    );

    vi.resetModules();
    const restoredModule = await import("../../src/store/editor-store");
    expect(restoredModule.useEditorStore.getState().environmentContextVisible).toBe(false);
  });

  it("keeps the saved camera pose and presentation in room state", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    });

    const module = await import("../../src/store/editor-store");
    const pose = {
      position: { x: 3, y: 4, z: 5 },
      target: { x: 0.5, y: 0.8, z: -0.25 },
    };
    module.useEditorStore.getState().setPresentation("3d");
    module.useEditorStore.getState().setCameraPose(pose);
    const state = module.useEditorStore.getState();
    const room = state.project.rooms.find((entry) => entry.id === state.project.activeRoomId);
    expect(room?.viewState?.presentation).toBe("3d");
    expect(room?.viewState?.cameraPose).toEqual(pose);
  });
});
