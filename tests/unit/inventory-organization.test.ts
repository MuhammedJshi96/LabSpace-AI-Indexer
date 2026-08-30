import { describe, expect, it } from "vitest";
import {
  createBlankProject,
  createBlankRoom,
  createBlankLaboratory,
} from "../../src/domain/room-factory";
import {
  applyOrganizationCommand,
  inventoryAssignmentCommand,
  storageRenameCommand,
  storagePath,
} from "../../src/domain/inventory-organization";
import { resolveStorageAccess } from "../../src/domain/storage-access";
import { buildDigitalTwinIndex } from "../../src/domain/digital-twin-index";
import { listInventoryLocations } from "../../src/agent/labspace-inventory-actions";
import { useEditorStore } from "../../src/store/editor-store";

function fixture() {
  const project = createBlankProject({ room: { name: "Student laboratory", code: "R816" } });
  const secondLab = createBlankLaboratory(project.id, {
    name: "Analytical laboratory",
    code: "ANAL",
  });
  const target = createBlankRoom({
    laboratoryId: secondLab.id,
    name: "Shared stock",
    code: "R812",
  });
  secondLab.roomIds = [target.id];
  project.laboratories.push(secondLab);
  project.rooms.push(target);
  useEditorStore.setState({
    project,
    selectedIds: [],
    selectedLocationId: null,
    history: [],
    future: [],
    pendingAgentChange: null,
    dirtyRevision: 0,
    saveStatus: "saved",
    toasts: [],
  });
  const objectId = useEditorStore.getState().addAsset("base-drawer-cabinet")!;
  const sourceId = project.activeRoomId;
  const first = useEditorStore.getState().addInventoryItemToRoom(sourceId, null, {
    name: "Student tips",
    quantity: 4,
    unit: "boxes",
    owner: "Teaching team",
    notes: "Keep sealed",
  })!;
  const second = useEditorStore.getState().addInventoryItemToRoom(target.id, null, {
    name: "Calibration vials",
    quantity: 12,
    unit: "vials",
  })!;
  const current = useEditorStore.getState().project;
  const source = current.rooms.find((room) => room.id === sourceId)!;
  const root = source.scene.storageLocations.find(
    (location) => location.objectId === objectId && !location.parentId,
  )!;
  const drawer = source.scene.storageLocations.find(
    (location) => location.objectId === objectId && location.type === "drawer",
  )!;
  useEditorStore.setState({ history: [], future: [], dirtyRevision: 0 });
  return { project: current, source, target, first, second, root, drawer, objectId };
}

describe("name-first inventory organization", () => {
  it("assigns a batch across laboratories atomically without duplicating stock or touching geometry", () => {
    const { project, source, target, first, second, drawer } = fixture();
    const before = JSON.stringify(project);
    const command = inventoryAssignmentCommand(
      project,
      [
        { roomId: source.id, itemId: first },
        { roomId: target.id, itemId: second },
      ],
      source.id,
      drawer.id,
    );
    const updated = applyOrganizationCommand(project, command, "apply");
    expect(JSON.stringify(project)).toBe(before);
    expect(updated.activeRoomId).toBe(project.activeRoomId);
    expect(updated.rooms[0].scene.objects).toBe(source.scene.objects);
    expect(updated.rooms[0].scene.storageLocations).toBe(source.scene.storageLocations);
    expect(updated.rooms[0].scene.inventoryItems).toHaveLength(2);
    expect(updated.rooms[1].scene.inventoryItems).toHaveLength(0);
    expect(updated.rooms[0].scene.inventoryItems.find((item) => item.id === first)).toMatchObject({
      name: "Student tips",
      quantity: 4,
      unit: "boxes",
      owner: "Teaching team",
      notes: "Keep sealed",
      storageLocationId: drawer.id,
    });
    expect(
      updated.rooms[0].scene.inventoryItems.every((item) => item.storageLocationId === drawer.id),
    ).toBe(true);
  });

  it("undoes and redoes one batch while preserving later stock detail changes", () => {
    const { source, target, first, second, drawer } = fixture();
    const store = useEditorStore.getState();
    expect(
      store.assignInventoryItems(
        [
          { roomId: source.id, itemId: first },
          { roomId: target.id, itemId: second },
        ],
        source.id,
        drawer.id,
      ),
    ).toBe(true);
    expect(useEditorStore.getState().history).toHaveLength(1);
    useEditorStore.getState().updateInventoryItemInRoom(source.id, first, { quantity: 17 });
    useEditorStore.getState().undo();
    const reverted = useEditorStore.getState().project;
    expect(reverted.rooms[0].scene.inventoryItems).toHaveLength(1);
    expect(reverted.rooms[1].scene.inventoryItems).toHaveLength(1);
    expect(reverted.rooms[0].scene.inventoryItems[0]).toMatchObject({
      id: first,
      quantity: 17,
      storageLocationId: null,
    });
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().project.rooms[0].scene.inventoryItems).toHaveLength(2);
    expect(useEditorStore.getState().project.rooms[0].scene.inventoryItems[0]).toMatchObject({
      id: first,
      quantity: 17,
      storageLocationId: drawer.id,
    });
  });

  it("renames cabinet and drawer labels without changing their anatomy, codes, contents or opening", () => {
    const { project, source, root, drawer, objectId } = fixture();
    const originalAccess = resolveStorageAccess(
      "base-drawer-cabinet",
      objectId,
      drawer.id,
      source.scene.storageLocations,
    );
    expect(
      useEditorStore.getState().renameStorageLocation(source.id, root.id, "  Student supplies  "),
    ).toBe(true);
    expect(
      useEditorStore.getState().renameStorageLocation(source.id, drawer.id, "Pipette tips"),
    ).toBe(true);
    const updated = useEditorStore.getState().project.rooms[0];
    expect(updated.scene.objects.find((object) => object.id === objectId)?.name).toBe(
      "Student supplies",
    );
    expect(updated.scene.objects.find((object) => object.id === objectId)?.position).toEqual(
      source.scene.objects[0].position,
    );
    expect(
      updated.scene.storageLocations.find((location) => location.id === drawer.id),
    ).toMatchObject({ ...drawer, name: "Pipette tips", updatedAt: expect.any(String) });
    expect(updated.scene.inventoryItems).toBe(source.scene.inventoryItems);
    expect(
      resolveStorageAccess(
        "base-drawer-cabinet",
        objectId,
        drawer.id,
        updated.scene.storageLocations,
      ),
    ).toEqual(originalAccess);
    expect(
      storagePath(updated.scene.storageLocations, drawer.id).map((location) => location.name),
    ).toEqual(["Student supplies", "Pipette tips"]);
    expect(
      buildDigitalTwinIndex(useEditorStore.getState().project).some(
        (record) => record.name === "Pipette tips",
      ),
    ).toBe(true);
    expect(
      listInventoryLocations({ query: "Pipette tips", roomCode: source.code }).locations.some(
        (location) => location.path.includes("Student supplies"),
      ),
    ).toBe(true);
    useEditorStore.getState().undo();
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.rooms[0].scene.objects[0].name).toBe(
      project.rooms[0].scene.objects[0].name,
    );
    expect(
      useEditorStore
        .getState()
        .project.rooms[0].scene.storageLocations.find((location) => location.id === drawer.id)
        ?.name,
    ).toBe(drawer.name);
  });

  it("rejects invalid, stale, duplicate and protected assignments before any project mutation", () => {
    const { project, source, target, first, drawer } = fixture();
    const refs = [{ roomId: source.id, itemId: first }];
    expect(() => inventoryAssignmentCommand(project, refs, target.id, drawer.id)).toThrow(
      /location/,
    );
    expect(() => inventoryAssignmentCommand(project, [], source.id, drawer.id)).toThrow(/at least/);
    expect(() =>
      inventoryAssignmentCommand(project, [...refs, ...refs], source.id, drawer.id),
    ).toThrow(/once/);
    expect(() =>
      inventoryAssignmentCommand(
        project,
        [{ roomId: target.id, itemId: first }],
        source.id,
        drawer.id,
      ),
    ).toThrow(/changed/);
    const protectedProject = structuredClone(project);
    protectedProject.rooms[0].roomKind = "demo-template";
    expect(() => inventoryAssignmentCommand(protectedProject, refs, source.id, drawer.id)).toThrow(
      /room/,
    );
    const before = JSON.stringify(project);
    expect(useEditorStore.getState().assignInventoryItems(refs, target.id, drawer.id)).toBe(false);
    expect(JSON.stringify(useEditorStore.getState().project)).toBe(before);
    expect(useEditorStore.getState().history).toHaveLength(0);
  });

  it("keeps history intact when an original destination disappears or record identity becomes ambiguous", () => {
    const { project, source, target, first, drawer } = fixture();
    const command = inventoryAssignmentCommand(
      project,
      [{ roomId: source.id, itemId: first }],
      source.id,
      drawer.id,
    );
    const duplicate = structuredClone(project);
    duplicate.rooms[1].scene.inventoryItems.push(structuredClone(source.scene.inventoryItems[0]));
    expect(() => applyOrganizationCommand(duplicate, command, "apply")).toThrow(/ambiguous/);
    useEditorStore.getState().assignInventoryItems(
      [
        {
          roomId: target.id,
          itemId: useEditorStore.getState().project.rooms[1].scene.inventoryItems[0].id,
        },
      ],
      source.id,
      drawer.id,
    );
    useEditorStore.setState((state) => ({
      project: {
        ...state.project,
        rooms: state.project.rooms.filter((room) => room.id !== target.id),
      },
    }));
    const before = useEditorStore.getState().project;
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project).toBe(before);
    expect(useEditorStore.getState().history).toHaveLength(1);
  });

  it("supports explicit unassignment, validates names, and does not add a no-op rename to history", () => {
    const { project, source, first, root, drawer } = fixture();
    for (const name of ["", "   ", "x".repeat(101)])
      expect(() => storageRenameCommand(project, source.id, drawer.id, name)).toThrow(/1 and 100/);
    expect(useEditorStore.getState().renameStorageLocation(source.id, root.id, root.name)).toBe(
      true,
    );
    expect(useEditorStore.getState().history).toHaveLength(0);
    expect(
      useEditorStore
        .getState()
        .assignInventoryItems([{ roomId: source.id, itemId: first }], source.id, drawer.id),
    ).toBe(true);
    expect(
      useEditorStore
        .getState()
        .assignInventoryItems([{ roomId: source.id, itemId: first }], source.id, null),
    ).toBe(true);
    expect(
      useEditorStore.getState().project.rooms[0].scene.inventoryItems[0].storageLocationId,
    ).toBeNull();
    useEditorStore.getState().undo();
    expect(
      useEditorStore.getState().project.rooms[0].scene.inventoryItems[0].storageLocationId,
    ).toBe(drawer.id);
  });

  it("blocks assignment and renaming while an agent preview is awaiting review", () => {
    const { project, source, first, drawer } = fixture();
    useEditorStore.setState({
      pendingAgentChange: {
        stageId: "pending-inventory-review",
        tool: "inventory",
        planId: "review-plan",
        entries: [],
        baselineDirtyRevision: 0,
        createdAt: new Date().toISOString(),
        status: "pending",
        projectUpdatedAt: project.updatedAt,
      },
    });
    expect(useEditorStore.getState().renameStorageLocation(source.id, drawer.id, "New name")).toBe(
      false,
    );
    expect(
      useEditorStore
        .getState()
        .assignInventoryItems([{ roomId: source.id, itemId: first }], source.id, drawer.id),
    ).toBe(false);
    expect(useEditorStore.getState().project).toBe(project);
    expect(useEditorStore.getState().history).toHaveLength(0);
  });
});
