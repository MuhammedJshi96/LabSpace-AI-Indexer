import { describe, expect, it } from "vitest";
import {
  buildDigitalTwinIndex,
  filterDigitalTwinIndex,
  preferredDigitalTwinRecord,
  shouldAutoFocusDigitalTwinResult,
  inferInventoryRecordImage,
} from "../../src/domain/digital-twin-index";
import { createSeedProject } from "../../src/domain/seed";

function activateRoom809() {
  const project = createSeedProject();
  project.rooms[0].roomKind = "demo";
  project.rooms[0].name = "Build Week Demo";
  project.activeRoomId = project.rooms[0].id;
  return project;
}

function createMultiLaboratoryProject() {
  const project = activateRoom809();
  const annex = structuredClone(project.rooms[0]);
  annex.id = "room-annex-0001";
  annex.laboratoryId = "laboratory-annex-0001";
  annex.name = "Instrument Annex";
  annex.code = "ANNEX-12";
  annex.roomKind = "standard";
  annex.scene.id = "scene-annex-0001";
  annex.scene.roomId = annex.id;
  annex.scene.objects = annex.scene.objects.map((object) => ({ ...object, roomId: annex.id }));
  annex.scene.zones = annex.scene.zones.map((zone) => ({ ...zone, roomId: annex.id }));
  annex.scene.storageLocations = annex.scene.storageLocations.map((location) => ({
    ...location,
    roomId: annex.id,
  }));
  annex.scene.inventoryItems[0] = {
    ...annex.scene.inventoryItems[0],
    name: "Cross-room calibration tracer",
  };
  project.laboratories.push({
    id: annex.laboratoryId,
    projectId: project.id,
    name: "Analytical Instrument Core",
    code: "AIC-02",
    roomIds: [annex.id],
  });
  project.rooms.push(annex);
  return { project, annex };
}

describe("project-wide Digital Twin index", () => {
  it("restores catalog photography for legacy consumable records", () => {
    expect(
      inferInventoryRecordImage({
        name: "HPLC autosampler vials",
        notes: "Clear 2 mL laboratory vials",
      }),
    ).toBe("/images/inventory/hplc-vials.png");
    expect(
      inferInventoryRecordImage({
        name: "Unclassified sample",
        notes: "No matching photography",
      }),
    ).toBeNull();
  });

  it("builds unique, location-aware records across laboratories and rooms", () => {
    const { project, annex } = createMultiLaboratoryProject();
    const records = buildDigitalTwinIndex(project, Date.parse("2026-07-17T00:00:00Z"));
    const activeRoomRecords = records.filter((record) => record.roomId === project.activeRoomId);
    const annexRecords = records.filter((record) => record.roomId === annex.id);

    expect(activeRoomRecords.length).toBeGreaterThan(0);
    expect(annexRecords).toHaveLength(activeRoomRecords.length);
    expect(new Set(records.map((record) => record.id))).toHaveLength(records.length);
    expect(records[0].roomId).toBe(project.activeRoomId);
    expect(annexRecords[0]).toMatchObject({
      laboratoryName: "Analytical Instrument Core",
      laboratoryCode: "AIC-02",
      roomName: "Instrument Annex",
      roomCode: "ANNEX-12",
    });
    expect(annexRecords[0].id.startsWith(`${annex.id}:`)).toBe(true);
  });

  it("searches project location context while preserving a current-room scope", () => {
    const { project, annex } = createMultiLaboratoryProject();
    const records = buildDigitalTwinIndex(project, Date.parse("2026-07-17T00:00:00Z"));
    const projectMatches = filterDigitalTwinIndex(records, {
      query: "cross-room calibration tracer",
      mode: "browse",
      scope: "project",
      activeRoomId: project.activeRoomId,
    });
    const roomMatches = filterDigitalTwinIndex(records, {
      query: "analytical instrument core",
      mode: "browse",
      scope: "room",
      activeRoomId: project.activeRoomId,
    });

    expect(projectMatches).toHaveLength(1);
    expect(projectMatches[0].roomId).toBe(annex.id);
    expect(roomMatches).toEqual([]);
  });

  it("carries record photography into the searchable Digital Twin index", () => {
    const project = activateRoom809();
    const records = buildDigitalTwinIndex(project, Date.parse("2026-07-17T00:00:00Z"));
    const matches = filterDigitalTwinIndex(records, {
      query: "HPLC autosampler vials",
      mode: "inventory",
      scope: "room",
      activeRoomId: project.activeRoomId,
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      imageSrc: "/images/inventory/hplc-vials.png",
      locationId: "storage-location-0003",
      indexCode: "LAB-R809-Z01-CAB-001-SH-02",
    });
  });

  it("opens the default consumable record at a physical drawer location", () => {
    const project = activateRoom809();
    const records = buildDigitalTwinIndex(project, Date.parse("2026-07-17T00:00:00Z"));
    const matches = filterDigitalTwinIndex(records, {
      query: "Nitrile gloves, M",
      mode: "inventory",
      scope: "room",
      activeRoomId: project.activeRoomId,
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      locationId: "storage-location-0004",
      indexCode: "LAB-R809-Z01-CAB-001-DR-01",
    });
    expect(matches[0].path.at(-1)).toBe("Drawer 01");
  });

  it("prefers a focusable drawer or bin record in the active room", () => {
    const project = activateRoom809();
    const records = buildDigitalTwinIndex(project, Date.parse("2026-07-17T00:00:00Z"));
    const room = project.rooms.find((entry) => entry.id === project.activeRoomId)!;
    const preferred = preferredDigitalTwinRecord(records, room.id, room.scene.storageLocations);
    const location = room.scene.storageLocations.find((entry) => entry.id === preferred?.locationId);

    expect(preferred?.roomId).toBe(room.id);
    expect(location?.type === "drawer" || location?.type === "bin").toBe(true);
  });

  it("prefers a central focusable location for the default photographic view", () => {
    const project = activateRoom809();
    const records = buildDigitalTwinIndex(project, Date.parse("2026-07-17T00:00:00Z"));
    const room = project.rooms.find((entry) => entry.id === project.activeRoomId)!;
    const preferred = preferredDigitalTwinRecord(
      records,
      room.id,
      room.scene.storageLocations,
      room.scene.objects,
      { width: room.width, depth: room.depth },
    );
    const object = room.scene.objects.find((entry) => entry.id === preferred?.objectId);

    expect(preferred?.kind).toBe("inventory");
    expect(object?.assetDefinitionId).toBe("island-bench-service-bridge");
  });

  it("only auto-focuses meaningful search matches with spatial geometry", () => {
    const project = activateRoom809();
    const records = buildDigitalTwinIndex(project, Date.parse("2026-07-17T00:00:00Z"));
    const focusable = records.find((record) => record.objectId);
    const unassigned = { ...focusable!, objectId: null };

    expect(shouldAutoFocusDigitalTwinResult("gl", focusable)).toBe(true);
    expect(shouldAutoFocusDigitalTwinResult("g", focusable)).toBe(false);
    expect(shouldAutoFocusDigitalTwinResult("gl", unassigned)).toBe(false);
    expect(shouldAutoFocusDigitalTwinResult("   ", focusable)).toBe(false);
  });

  it("indexes authored analytical equipment in a second laboratory", () => {
    const project = createSeedProject();
    const records = buildDigitalTwinIndex(project, Date.parse("2026-07-17T00:00:00Z"));
    const matches = filterDigitalTwinIndex(records, {
      query: "Nexera-class modular stack",
      mode: "equipment",
      scope: "project",
      activeRoomId: project.activeRoomId,
    });

    expect(project.laboratories).toHaveLength(2);
    expect(project.rooms).toHaveLength(4);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      name: "Modular HPLC system A",
      laboratoryCode: "AIC",
      roomCode: "CHR-A",
      imageSrc: "/images/equipment/hplc-system-reference.png",
      objectId: expect.any(String),
    });
  });
});
