import { describe, expect, it } from "vitest";
import {
  createBlankLaboratory,
  createBlankProject,
  createBlankRoom,
} from "../../src/domain/room-factory";
import { createSeedProject } from "../../src/domain/seed";
import { RoomSchema } from "../../src/domain/schema";

describe("blank room creation", () => {
  it("creates a coherent generic project without Room 809 content or environment defaults", () => {
    const project = createBlankProject({ name: "Bioprocess facility" });
    const laboratory = project.laboratories[0];
    const room = project.rooms[0];

    expect(() => RoomSchema.parse(room)).not.toThrow();
    expect(project.name).toBe("Bioprocess facility");
    expect(project.activeRoomId).toBe(room.id);
    expect(laboratory.projectId).toBe(project.id);
    expect(laboratory.roomIds).toEqual([room.id]);
    expect(room.laboratoryId).toBe(laboratory.id);
    expect(room.name).toBe("Room 1");
    expect(room.environmentProfileId).toBeNull();
    expect(room.wallFinish).toBe("clean-white-panel");
    expect(room.scene.objects).toEqual([]);
    expect(room.scene.zones).toEqual([]);
    expect(room.scene.layers.every((layer) => layer.role)).toBe(true);
  });

  it("creates laboratories and rooms independently from any demonstration template", () => {
    const projectId = crypto.randomUUID();
    const laboratory = createBlankLaboratory(projectId, {
      name: "Analytical sciences",
      code: "AN-01",
    });
    const first = createBlankRoom({
      laboratoryId: laboratory.id,
      name: "LC-MS suite",
      code: "R101",
    });
    const second = createBlankRoom({
      laboratoryId: laboratory.id,
      name: "Sample preparation",
      code: "R102",
    });

    expect(first.laboratoryId).toBe(laboratory.id);
    expect(second.laboratoryId).toBe(laboratory.id);
    expect(first.scene.objects).toEqual([]);
    expect(second.scene.objects).toEqual([]);
    expect(new Set(first.scene.layers.map((layer) => layer.id))).not.toEqual(
      new Set(second.scene.layers.map((layer) => layer.id)),
    );
  });

  it("creates a schema-valid room without seeded layout or indexed content", () => {
    const seededRoom = createSeedProject().rooms[0];
    const blankRoom = createBlankRoom(seededRoom, {
      name: "Room 2",
      code: "R002",
    });

    expect(() => RoomSchema.parse(blankRoom)).not.toThrow();
    expect(blankRoom.scene.objects).toEqual([]);
    expect(blankRoom.scene.zones).toEqual([]);
    expect(blankRoom.scene.storageLocations).toEqual([]);
    expect(blankRoom.scene.inventoryItems).toEqual([]);
    expect(blankRoom.scene.equipmentRecords).toEqual([]);
    expect(blankRoom.environmentProfileId).toBeNull();
    expect(blankRoom.scene.layers).toHaveLength(seededRoom.scene.layers.length);
    expect(blankRoom.scene.labelTemplates).toHaveLength(seededRoom.scene.labelTemplates.length);
  });

  it("does not mutate the Room 809 demonstration scene", () => {
    const seededProject = createSeedProject();
    const seededRoom = seededProject.rooms[0];
    const seededObjectIds = seededRoom.scene.objects.map((object) => object.id);

    createBlankRoom(seededRoom, { name: "Blank room", code: "R002" });

    expect(seededProject.rooms[0].name).toBe("DEMO-01 factory template");
    expect(seededProject.rooms[0].scene.objects.map((object) => object.id)).toEqual(
      seededObjectIds,
    );
    expect(seededProject.rooms[0].scene.objects.length).toBeGreaterThan(0);
  });
});
