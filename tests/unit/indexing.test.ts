import { describe, expect, it } from "vitest";
import {
  baseRoomPrefix,
  deriveDefaultEquipmentId,
  ensureUniqueCode,
  generateChildIndexCode,
  generateObjectIndexCode,
  getLocationPath,
  indexingStats,
  normalizeIndexCode,
  previewReindex,
} from "../../src/domain/indexing";
import { createSeedProject } from "../../src/domain/seed";
import type { Room, SceneObject } from "../../src/domain/schema";

function isolatedRoom(roomCode: string, zoneCode: string): Room {
  const room = structuredClone(createSeedProject().rooms[0]);
  room.code = roomCode;
  room.scene.objects = [];
  room.scene.storageLocations = [];
  room.scene.inventoryItems = [];
  room.scene.equipmentRecords = [];
  room.scene.zones = [{ ...room.scene.zones[0], code: zoneCode }];
  return room;
}

function exampleObject(objectType: SceneObject["objectType"], indexCode: string): SceneObject {
  const source = createSeedProject().rooms[0].scene.objects.find(
    (object) => object.objectType === objectType,
  );
  if (!source) throw new Error(`Missing seeded ${objectType} fixture.`);
  return structuredClone({ ...source, indexCode });
}

describe("physical indexing", () => {
  it("generates the next unique cabinet and equipment codes", () => {
    const room = createSeedProject().rooms[0];
    expect(
      generateObjectIndexCode(room, room.scene, "storage", room.scene.zones[0].id, "LAB"),
    ).toBe("LAB-R809-Z01-CAB-004");
    expect(
      generateObjectIndexCode(room, room.scene, "equipment", room.scene.zones[1].id, "LAB"),
    ).toBe("LAB-R809-Z02-EQ-003");
  });

  it("normalizes keyboard and punctuation variants into stable index segments", () => {
    expect(normalizeIndexCode("  ｂｉｏ　core / c-317  ")).toBe("BIO-CORE-C-317");
    expect(baseRoomPrefix("chemistry west", "b 214", "wet / prep")).toBe(
      "CHEMISTRY-WEST-B-214-WET-PREP",
    );
    expect(() => normalizeIndexCode(" -- / -- ")).toThrow(/letter or number/i);
    expect(() => baseRoomPrefix("", "B214")).toThrow(/letter or number/i);
  });

  it("prevents normalized duplicates while preserving only one current-code occurrence", () => {
    const used = ["LAB-R809-Z01-CAB-001", "LAB-R809-Z01-CAB-001-2"];
    expect(ensureUniqueCode(" lab r809 / z01 / cab 001 ", used)).toBe("LAB-R809-Z01-CAB-001-3");
    expect(ensureUniqueCode("LAB-R809-Z01-CAB-001", used, "LAB-R809-Z01-CAB-001")).toBe(
      "LAB-R809-Z01-CAB-001",
    );
    expect(
      ensureUniqueCode(
        "chem-b214-eq-001",
        ["CHEM-B214-EQ-001", " chem / b214 / eq / 001 "],
        "CHEM-B214-EQ-001",
      ),
    ).toBe("CHEM-B214-EQ-001-2");
  });

  it("uses explicit non-demo laboratory and room identities when allocating objects", () => {
    const chemistry = isolatedRoom("b 214", "wet prep");
    chemistry.scene.objects.push(
      exampleObject("equipment", "chemistry-west-b-214-wet-prep-eq-001"),
    );
    expect(
      generateObjectIndexCode(
        chemistry,
        chemistry.scene,
        "equipment",
        chemistry.scene.zones[0].id,
        "chemistry west",
      ),
    ).toBe("CHEMISTRY-WEST-B-214-WET-PREP-EQ-002");

    const genomics = isolatedRoom("c 317", "cell culture");
    expect(
      generateObjectIndexCode(
        genomics,
        genomics.scene,
        "storage",
        genomics.scene.zones[0].id,
        "genomics core",
      ),
    ).toBe("GENOMICS-CORE-C-317-CELL-CULTURE-CAB-001");
  });

  it("derives unique equipment IDs from the object's actual normalized index", () => {
    const object = { indexCode: " genomics core / c 317 / z02 / eq 004 " };
    expect(
      deriveDefaultEquipmentId(object, [
        { equipmentId: "GENOMICS-CORE-C-317-Z02-EQ-004" },
        { equipmentId: "genomics core c 317 z02 eq 004-2" },
      ]),
    ).toBe("GENOMICS-CORE-C-317-Z02-EQ-004-3");
  });

  it("creates deterministic child location codes", () => {
    const scene = createSeedProject().rooms[0].scene;
    const root = scene.storageLocations.find(
      (location) => location.indexCode === "LAB-R809-Z01-CAB-001",
    )!;
    expect(generateChildIndexCode(root, "shelf", scene.storageLocations)).toBe(
      "LAB-R809-Z01-CAB-001-SH-03",
    );
  });

  it("resolves a cabinet-to-bin hierarchy without cycles", () => {
    const scene = createSeedProject().rooms[0].scene;
    const bin = scene.storageLocations.find((location) => location.type === "bin")!;
    const path = getLocationPath(scene, bin.id);
    expect(path.map((location) => location.type)).toEqual(["cabinet", "drawer", "bin"]);
  });

  it("previews reindexing without mutating stable codes", () => {
    const room = createSeedProject().rooms[0];
    const before = room.scene.objects.map((object) => object.indexCode);
    const changes = previewReindex(room, "LAB");
    expect(changes.length).toBeGreaterThan(0);
    expect(room.scene.objects.map((object) => object.indexCode)).toEqual(before);
    expect(new Set(changes.map((change) => `${change.type}:${change.id}`)).size).toBe(
      changes.length,
    );
  });

  it("reindexes a second laboratory deterministically and skips reserved object codes", () => {
    const room = isolatedRoom("c-317", "cell culture");
    const reserved = exampleObject("furniture", "genomics-core-c-317-cell-culture-eq-001");
    reserved.id = "reserved-object-0001";
    const equipment = exampleObject("equipment", "legacy-equipment-code");
    equipment.id = "equipment-object-0001";
    equipment.position = { x: 1000, y: 1000, z: 0 };
    equipment.zoneId = room.scene.zones[0].id;
    room.scene.objects = [equipment, reserved];

    const before = structuredClone(room);
    const changes = previewReindex(room, "genomics core");
    expect(changes).toContainEqual({
      id: equipment.id,
      type: "object",
      before: "legacy-equipment-code",
      after: "GENOMICS-CORE-C-317-CELL-CULTURE-EQ-002",
    });
    expect(room).toEqual(before);
  });

  it("reports occupied, empty, and unassigned counts", () => {
    const stats = indexingStats(createSeedProject().rooms[0].scene);
    expect(stats.totalLocations).toBe(15);
    expect(stats.occupiedLocations).toBe(6);
    expect(stats.unassignedItems).toBe(1);
  });
});
