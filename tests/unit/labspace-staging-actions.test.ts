import { afterEach, describe, expect, it, vi } from "vitest";
import {
  approveStagedObjectMove,
  cancelStagedObjectMove,
  stageObjectMove,
} from "../../src/agent/labspace-staging-actions";
import { createSeedProject } from "../../src/domain/seed";
import type { Project, Room, SceneObject } from "../../src/domain/schema";
import { useEditorStore } from "../../src/store/editor-store";

function stagingFixture() {
  const project = createSeedProject();
  const room = project.rooms.find((entry) => entry.roomKind === "demo")!;
  const movable = room.scene.objects.filter((entry) =>
    ["furniture", "storage", "equipment"].includes(entry.objectType),
  );
  const first: SceneObject = {
    ...structuredClone(movable[0]),
    name: "Mobile analysis cart",
    objectType: "equipment",
    locked: false,
    visible: true,
    position: { x: 1500, y: 1500, z: 0 },
    dimensions: { width: 600, depth: 600, height: 900 },
    rotation: { x: 0, y: 0, z: 0 },
    metadata: {},
  };
  const second: SceneObject = {
    ...structuredClone(movable[1]),
    name: "Plate reader station",
    objectType: "equipment",
    locked: false,
    visible: true,
    position: { x: 3500, y: 1500, z: 0 },
    dimensions: { width: 800, depth: 800, height: 900 },
    rotation: { x: 0, y: 0, z: 0 },
    metadata: {},
  };
  const preparedRoom: Room = {
    ...room,
    width: 6000,
    depth: 5000,
    scene: {
      ...room.scene,
      layers: room.scene.layers.map((layer) => ({ ...layer, locked: false })),
      objects: [first, second],
      equipmentRecords: [],
      storageLocations: [],
      inventoryItems: [],
    },
  };
  const preparedProject: Project = {
    ...project,
    activeRoomId: room.id,
    rooms: project.rooms.map((entry) => (entry.id === room.id ? preparedRoom : entry)),
  };
  useEditorStore.setState({
    project: preparedProject,
    hydrated: true,
    selectedIds: [],
    selectedLocationId: null,
    history: [],
    future: [],
    pendingAgentChange: null,
    dirtyRevision: 7,
    saveStatus: "saved",
    saveError: null,
    toasts: [],
  });
  return { project: preparedProject, room: preparedRoom, first, second };
}

function currentObject(id: string) {
  const state = useEditorStore.getState();
  return state.project.rooms
    .find((room) => room.id === state.project.activeRoomId)!
    .scene.objects.find((object) => object.id === id)!;
}

afterEach(() => {
  vi.unstubAllGlobals();
  useEditorStore.setState({ pendingAgentChange: null });
});

describe("human-reviewed LabSpace move staging", () => {
  it("creates a visible valid preview without history, dirty state, or persistence", () => {
    const { first } = stagingFixture();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = stageObjectMove({
      objectId: first.id,
      target: { xMm: 2200, yMm: 3000 },
      rotationDeg: 90,
    });
    const state = useEditorStore.getState();

    expect(result).toMatchObject({
      staged: true,
      valid: true,
      persisted: false,
      requiresHumanApproval: true,
      objectId: first.id,
    });
    expect(currentObject(first.id).position).toMatchObject({ x: 2200, y: 3000 });
    expect(currentObject(first.id).rotation.z).toBe(90);
    expect(state.pendingAgentChange).toMatchObject({
      stageId: result.stageId,
      before: { position: first.position },
      proposed: { position: { x: 2200, y: 3000 } },
    });
    expect(state.history).toEqual([]);
    expect(state.dirtyRevision).toBe(7);
    expect(state.saveStatus).toBe("saved");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns real conflicts and creates no preview for an invalid move", () => {
    const { project, first, second } = stagingFixture();
    const before = structuredClone(project);

    const result = stageObjectMove({
      objectId: first.id,
      target: { xMm: second.position.x, yMm: second.position.y },
    });

    expect(result).toMatchObject({ staged: false, valid: false, stageId: null });
    expect(result.conflicts).toContainEqual(
      expect.objectContaining({ type: "object-collision", objectId: second.id }),
    );
    expect(useEditorStore.getState().project).toEqual(before);
    expect(useEditorStore.getState().pendingAgentChange).toBeNull();
  });

  it("cancels the preview and restores the exact in-memory project", () => {
    const { project, first } = stagingFixture();
    const before = structuredClone(project);
    const staged = stageObjectMove({
      objectId: first.id,
      target: { xMm: 2200, yMm: 3000 },
    });

    const result = cancelStagedObjectMove(staged.stageId!);

    expect(result).toMatchObject({ status: "cancelled", persisted: false });
    expect(useEditorStore.getState().project).toEqual(before);
    expect(useEditorStore.getState().pendingAgentChange).toBeNull();
    expect(useEditorStore.getState().history).toEqual([]);
    expect(useEditorStore.getState().dirtyRevision).toBe(7);
  });

  it("requires the human action, creates one history entry, and supports undo and redo", () => {
    const { first } = stagingFixture();
    const staged = stageObjectMove({
      objectId: first.id,
      target: { xMm: 2200, yMm: 3000 },
    });

    const result = approveStagedObjectMove(staged.stageId!);

    expect(result).toMatchObject({ status: "approved", persisted: false });
    expect(useEditorStore.getState().pendingAgentChange).toBeNull();
    expect(useEditorStore.getState().history).toHaveLength(1);
    expect(useEditorStore.getState().history[0].label).toBe("Approve agent move");
    expect(useEditorStore.getState().dirtyRevision).toBe(8);
    expect(useEditorStore.getState().saveStatus).toBe("unsaved");
    expect(currentObject(first.id).position).toMatchObject({ x: 2200, y: 3000 });

    useEditorStore.getState().undo();
    expect(currentObject(first.id).position).toEqual(first.position);
    useEditorStore.getState().redo();
    expect(currentObject(first.id).position).toMatchObject({ x: 2200, y: 3000 });
  });

  it("persists only after approval through the existing save action", async () => {
    const { first } = stagingFixture();
    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
      const saved = JSON.parse(String(init?.body));
      return new Response(JSON.stringify(saved), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchSpy);
    const staged = stageObjectMove({
      objectId: first.id,
      target: { xMm: 2200, yMm: 3000 },
    });

    await useEditorStore.getState().saveNow();
    expect(fetchSpy).not.toHaveBeenCalled();

    approveStagedObjectMove(staged.stageId!);
    await useEditorStore.getState().saveNow();

    expect(fetchSpy).toHaveBeenCalledOnce();
    const init = fetchSpy.mock.calls[0][1];
    const saved = JSON.parse(String(init?.body)) as Project;
    const savedObject = saved.rooms
      .find((room) => room.id === saved.activeRoomId)!
      .scene.objects.find((object) => object.id === first.id)!;
    expect(savedObject.position).toMatchObject({ x: 2200, y: 3000 });
    expect(useEditorStore.getState().saveStatus).toBe("saved");
  });

  it("rejects stale approval and removes only the unchanged agent preview", () => {
    const { first } = stagingFixture();
    const staged = stageObjectMove({
      objectId: first.id,
      target: { xMm: 2200, yMm: 3000 },
    });
    useEditorStore.setState((state) => ({ dirtyRevision: state.dirtyRevision + 1 }));

    expect(() => approveStagedObjectMove(staged.stageId!)).toThrow("became stale");
    expect(currentObject(first.id).position).toEqual(first.position);
    expect(useEditorStore.getState().pendingAgentChange).toBeNull();
    expect(useEditorStore.getState().history).toEqual([]);
  });

  it("preserves a newer object preview when stale review is cancelled", () => {
    const { first } = stagingFixture();
    const staged = stageObjectMove({
      objectId: first.id,
      target: { xMm: 2200, yMm: 3000 },
    });
    useEditorStore.getState().previewObject(first.id, {
      position: { ...first.position, x: 2600, y: 3200 },
    });

    expect(() => approveStagedObjectMove(staged.stageId!)).toThrow("became stale");
    expect(currentObject(first.id).position).toMatchObject({ x: 2600, y: 3200 });
    expect(useEditorStore.getState().pendingAgentChange).toBeNull();
  });

  it("makes repeated identical stages idempotent and rejects a second proposal", () => {
    const { first } = stagingFixture();
    const input = { objectId: first.id, target: { xMm: 2200, yMm: 3000 } };
    const firstStage = stageObjectMove(input);
    const repeated = stageObjectMove(input);

    expect(repeated.stageId).toBe(firstStage.stageId);
    expect(useEditorStore.getState().history).toEqual([]);
    expect(() =>
      stageObjectMove({ objectId: first.id, target: { xMm: 2500, yMm: 3000 } }),
    ).toThrow("Another agent change");
  });

  it("refuses staging while human edits are unsaved", () => {
    const { first } = stagingFixture();
    useEditorStore.setState({ saveStatus: "unsaved" });

    expect(() =>
      stageObjectMove({ objectId: first.id, target: { xMm: 2200, yMm: 3000 } }),
    ).toThrow("finish saving current human edits");
    expect(useEditorStore.getState().pendingAgentChange).toBeNull();
    expect(currentObject(first.id).position).toEqual(first.position);
  });
});
