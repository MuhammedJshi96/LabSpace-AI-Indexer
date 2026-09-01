import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLabSpaceNavigationActions,
  focusLabRecord,
  type LabSpaceNavigationPort,
} from "../../src/agent/labspace-navigation-actions";
import { buildDigitalTwinIndex, type DigitalTwinRecord } from "../../src/domain/digital-twin-index";
import { createSeedProject } from "../../src/domain/seed";
import { resolveStorageAccess } from "../../src/domain/storage-access";
import type { Project } from "../../src/domain/schema";
import { useEditorStore, type SpatialFocusRequest } from "../../src/store/editor-store";

function eligibleRecord(project: Project, kind: DigitalTwinRecord["kind"]) {
  const record = buildDigitalTwinIndex(project).find(
    (entry) => entry.kind === kind && Boolean(entry.objectId),
  );
  if (!record) throw new Error(`Seed is missing a focusable ${kind} record.`);
  return record;
}

function navigationHarness(project = createSeedProject()) {
  let currentProject = project;
  const focuses: SpatialFocusRequest[] = [];
  const port: LabSpaceNavigationPort = {
    readProject: () => currentProject,
    applyFocus: vi.fn((focus) => {
      focuses.push(focus);
      return true;
    }),
  };
  return {
    port,
    focuses,
    setProject: (next: Project) => {
      currentProject = next;
    },
  };
}

describe("LabSpace spatial record focus", () => {
  beforeEach(() => {
    const project = createSeedProject();
    const room = project.rooms.find((entry) => entry.roomKind === "demo")!;
    project.activeRoomId = room.id;
    useEditorStore.setState({
      project,
      hydrated: true,
      selectedIds: [],
      selectedLocationId: null,
      spatialFocus: null,
      history: [],
      future: [],
      dirtyRevision: 7,
      saveStatus: "saved",
      cameraPreset: "front",
      presentation: "2d",
    });
  });

  it.each(["inventory", "equipment", "location"] as const)(
    "focuses a canonical %s record with current room evidence",
    (kind) => {
      const project = createSeedProject();
      const record = eligibleRecord(project, kind);
      const harness = navigationHarness(project);

      const result = focusLabRecord({ recordId: record.id }, {}, harness.port);

      expect(result).toMatchObject({
        recordId: record.id,
        kind,
        roomCode: record.roomCode,
        laboratoryCode: record.laboratoryCode,
        objectId: record.objectId,
        locationId: record.locationId,
        focused: true,
      });
      expect(harness.focuses).toHaveLength(1);
      expect(harness.focuses[0]).toMatchObject({
        recordId: record.id,
        roomId: record.roomId,
        objectId: record.objectId,
        locationId: record.locationId,
      });
    },
  );

  it("switches across rooms and laboratories using fresh canonical record state", () => {
    const project = createSeedProject();
    const record = buildDigitalTwinIndex(project).find(
      (entry) => entry.objectId && entry.roomId !== project.activeRoomId,
    )!;
    const targetRoom = project.rooms.find((entry) => entry.id === record.roomId)!;
    const laboratoryId = crypto.randomUUID();
    targetRoom.laboratoryId = laboratoryId;
    project.laboratories.push({
      id: laboratoryId,
      projectId: project.id,
      name: "Satellite Laboratory",
      code: "LAB-02",
      roomIds: [targetRoom.id],
    });
    const refreshedRecord = buildDigitalTwinIndex(project).find((entry) => entry.id === record.id)!;
    const harness = navigationHarness(project);

    const result = focusLabRecord({ recordId: refreshedRecord.id }, {}, harness.port);

    expect(result.laboratoryCode).toBe("LAB-02");
    expect(harness.focuses[0].roomId).toBe(targetRoom.id);
  });

  it("rejects stale records and records without a physical object", () => {
    const project = createSeedProject();
    const room = project.rooms.find((entry) => entry.roomKind === "demo")!;
    const now = new Date().toISOString();
    const unassignedId = crypto.randomUUID();
    room.scene.inventoryItems.push({
      id: unassignedId,
      name: "Unassigned focus record",
      quantity: 1,
      unit: "item",
      notes: "",
      owner: "",
      expiryDate: null,
      storageLocationId: null,
      createdAt: now,
      updatedAt: now,
    });
    const unassigned = buildDigitalTwinIndex(project).find((entry) =>
      entry.id.endsWith(`:inventory:${unassignedId}`),
    )!;
    const harness = navigationHarness(project);

    expect(() => focusLabRecord({ recordId: "stale-record" }, {}, harness.port)).toThrow(
      "Record not found",
    );
    expect(() => focusLabRecord({ recordId: unassigned.id }, {}, harness.port)).toThrow(
      "no physical object",
    );
    expect(harness.focuses).toHaveLength(0);
  });

  it("re-resolves current state when the action executes", () => {
    const first = createSeedProject();
    const second = structuredClone(first);
    const record = eligibleRecord(second, "equipment");
    second.rooms = second.rooms.map((room) =>
      room.id === record.roomId
        ? {
            ...room,
            code: "CURRENT-ROOM",
            scene: {
              ...room.scene,
              equipmentRecords: room.scene.equipmentRecords.map((entry) =>
                record.id.endsWith(`:equipment:${entry.id}`)
                  ? { ...entry, name: "Current equipment name" }
                  : entry,
              ),
            },
          }
        : room,
    );
    const harness = navigationHarness(first);
    const actions = createLabSpaceNavigationActions(harness.port);
    harness.setProject(second);

    const currentRecord = buildDigitalTwinIndex(second).find((entry) => entry.id === record.id)!;
    const result = actions.focusLabRecord({ recordId: currentRecord.id });

    expect(result.name).toBe("Current equipment name");
    expect(result.roomCode).toBe("CURRENT-ROOM");
  });

  it("clears record, storage and camera focus together when the canvas selection is dismissed", () => {
    const state = useEditorStore.getState();
    const record = eligibleRecord(state.project, "inventory");
    focusLabRecord({ recordId: record.id });
    const before = useEditorStore.getState();
    useEditorStore.getState().setSelected([]);
    const after = useEditorStore.getState();
    expect(after.selectedIds).toEqual([]);
    expect(after.selectedLocationId).toBeNull();
    expect(after.digitalTwinSelectedRecordId).toBeNull();
    expect(after.spatialFocus).toBeNull();
    expect(after.project).toBe(before.project);
    expect(after.history).toBe(before.history);
    expect(after.dirtyRevision).toBe(before.dirtyRevision);
  });

  it("applies exact selection and camera focus without dirtying project data or history", () => {
    const beforeState = useEditorStore.getState();
    const record = buildDigitalTwinIndex(beforeState.project).find(
      (entry) =>
        entry.roomId === beforeState.project.activeRoomId && entry.objectId && entry.locationId,
    )!;
    const projectBefore = beforeState.project;

    const result = focusLabRecord({ recordId: record.id });
    const after = useEditorStore.getState();

    expect(result.focused).toBe(true);
    expect(after.project).toBe(projectBefore);
    expect(after.selectedIds).toEqual([record.objectId]);
    expect(after.selectedLocationId).toBe(record.locationId);
    expect(after.spatialFocus).toMatchObject({
      recordId: record.id,
      objectId: record.objectId,
      locationId: record.locationId,
      showStorageAccess: Boolean(
        resolveStorageAccess(
          beforeState.project.rooms
            .find((room) => room.id === record.roomId)!
            .scene.objects.find((object) => object.id === record.objectId)!.assetDefinitionId,
          record.objectId!,
          record.locationId!,
          beforeState.project.rooms.find((room) => room.id === record.roomId)!.scene
            .storageLocations,
        ).parts.length,
      ),
    });
    expect(after.cameraPreset).toBe("isometric");
    expect(after.presentation).toBe("split");
    expect(after.history).toEqual([]);
    expect(after.dirtyRevision).toBe(7);
    expect(after.saveStatus).toBe("saved");
  });
});
