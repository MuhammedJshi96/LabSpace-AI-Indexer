import { describe, expect, it } from "vitest";
import { ASSET_CATALOG } from "../../src/domain/assets";
import { validatePlacement } from "../../src/domain/geometry";
import { migrateScene } from "../../src/domain/migrations";
import { deserializeProject, serializeProject } from "../../src/domain/serialization";
import { createSeedProject } from "../../src/domain/seed";
import { primaryRoomSpaceId, ProjectSchema, SceneSchema } from "../../src/domain/schema";

describe("scene validation and persistence", () => {
  it("validates the complete seeded project", () => {
    const project = createSeedProject();
    expect(ProjectSchema.parse(project).rooms[0].name).toBe("DEMO-01 factory template");
    expect(project.rooms[0].roomKind).toBe("demo-template");
    expect(project.rooms).toHaveLength(4);
    expect(SceneSchema.parse(project.rooms[0].scene).schemaVersion).toBe(2);
    expect(project.rooms.map((room) => validatePlacement(room))).toEqual([[], [], [], []]);
  });

  it("rejects invalid negative dimensions", () => {
    const scene = structuredClone(createSeedProject().rooms[0].scene);
    scene.objects[0].dimensions.width = -1;
    expect(() => SceneSchema.parse(scene)).toThrow();
  });

  it("round-trips project serialization", () => {
    const project = createSeedProject();
    expect(deserializeProject(serializeProject(project))).toEqual(project);
  });

  it("migrates existing rooms into one stable primary space without changing identities", () => {
    const current = createSeedProject();
    const legacy = structuredClone(current) as unknown as {
      rooms: Array<Record<string, unknown> & { scene: Record<string, unknown> }>;
    };
    for (const room of legacy.rooms) {
      delete room.spaces;
      const scene = room.scene as {
        objects: Array<Record<string, unknown>>;
        storageLocations: Array<Record<string, unknown>>;
        equipmentRecords: Array<Record<string, unknown>>;
      };
      scene.objects.forEach((object) => delete object.spaceId);
      scene.storageLocations.forEach((location) => delete location.spaceId);
      scene.equipmentRecords.forEach((record) => delete record.spaceId);
    }
    const beforeIds = current.rooms.flatMap((room) => [
      ...room.scene.objects.map((object) => object.id),
      ...room.scene.storageLocations.map((location) => location.id),
      ...room.scene.inventoryItems.map((item) => item.id),
    ]);

    const migrated = ProjectSchema.parse(legacy);
    expect(migrated.rooms.every((room) => room.spaces.length === 1)).toBe(true);
    for (const room of migrated.rooms) {
      expect(room.spaces[0]).toMatchObject({
        id: primaryRoomSpaceId(room.id),
        roomId: room.id,
        parentSpaceId: null,
        kind: "primary",
        name: room.name,
        code: room.code,
        floorFinish: room.floorFinish,
      });
      expect(room.scene.objects.every((object) => object.spaceId === room.spaces[0].id)).toBe(true);
      expect(
        room.scene.storageLocations.every((location) => location.spaceId === room.spaces[0].id),
      ).toBe(true);
    }
    expect(
      migrated.rooms.flatMap((room) => [
        ...room.scene.objects.map((object) => object.id),
        ...room.scene.storageLocations.map((location) => location.id),
        ...room.scene.inventoryItems.map((item) => item.id),
      ]),
    ).toEqual(beforeIds);
  });

  it("migrates version 1 scenes and adds label templates", () => {
    const scene = createSeedProject().rooms[0].scene;
    const legacy = { ...scene, schemaVersion: 1 } as unknown;
    delete (legacy as Record<string, unknown>).labelTemplates;
    const migrated = migrateScene(legacy);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.labelTemplates[0].name).toContain("location label");
  });

  it("provides every starter asset with one shared 2D/3D manifest", () => {
    expect(ASSET_CATALOG.length).toBeGreaterThanOrEqual(80);
    expect(new Set(ASSET_CATALOG.map((asset) => asset.id)).size).toBe(ASSET_CATALOG.length);
    for (const asset of ASSET_CATALOG) {
      expect(asset.defaultDimensions.width).toBeGreaterThan(0);
      expect(asset.profile).toBeTruthy();
      expect(asset.tags.length).toBeGreaterThan(0);
    }
  });
});
