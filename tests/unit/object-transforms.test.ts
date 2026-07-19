import { describe, expect, it } from "vitest";
import { applyCommand, revertCommand, type SceneCommand } from "../../src/domain/history";
import { migrateScene } from "../../src/domain/migrations";
import { normalizeRaisedFromFloorMm } from "../../src/domain/object-transforms";
import { createSeedProject } from "../../src/domain/seed";
import { deserializeProject, serializeProject } from "../../src/domain/serialization";
import { SceneObjectSchema } from "../../src/domain/schema";

describe("Floorplanner-style object transforms", () => {
  it("migrates older objects to unflipped defaults without changing their raised height", () => {
    const project = createSeedProject();
    const legacyScene = structuredClone(project.rooms[0].scene) as unknown as Record<
      string,
      unknown
    >;
    legacyScene.schemaVersion = 1;
    delete legacyScene.labelTemplates;
    const legacyObjects = legacyScene.objects as Array<Record<string, unknown>>;
    const originalRaisedHeight = (legacyObjects[0].position as { z: number }).z;
    delete legacyObjects[0].flipHorizontal;
    delete legacyObjects[0].flipVertical;

    const migrated = migrateScene(legacyScene);

    expect(migrated.objects[0].position.z).toBe(originalRaisedHeight);
    expect(migrated.objects[0].flipHorizontal).toBe(false);
    expect(migrated.objects[0].flipVertical).toBe(false);
  });

  it("validates and clamps raised-from-floor values in millimetres", () => {
    const object = structuredClone(createSeedProject().rooms[0].scene.objects[0]);
    expect(normalizeRaisedFromFloorMm(-250)).toBe(0);
    expect(normalizeRaisedFromFloorMm(31_000)).toBe(30_000);
    expect(normalizeRaisedFromFloorMm("900")).toBe(900);
    expect(() =>
      SceneObjectSchema.parse({ ...object, position: { ...object.position, z: -1 } }),
    ).toThrow();
  });

  it("keeps elevation and both mirror axes in history and serialized projects", () => {
    const project = createSeedProject();
    const scene = project.rooms[0].scene;
    const before = scene.objects.find((object) => object.objectType === "equipment")!;
    const after = {
      ...before,
      position: { ...before.position, z: 1_150 },
      flipHorizontal: true,
      flipVertical: true,
    };
    const command: SceneCommand = {
      id: "transform-command",
      label: "Transform object",
      kind: "update",
      objectId: before.id,
      before,
      after,
    };

    const applied = applyCommand(scene, command);
    expect(applied.objects.find((object) => object.id === before.id)).toMatchObject({
      position: { z: 1_150 },
      flipHorizontal: true,
      flipVertical: true,
    });
    expect(
      revertCommand(applied, command).objects.find((object) => object.id === before.id),
    ).toEqual(before);

    project.rooms[0].scene = applied;
    const restored = deserializeProject(serializeProject(project));
    expect(restored.rooms[0].scene.objects.find((object) => object.id === before.id)).toMatchObject(
      {
        position: { z: 1_150 },
        flipHorizontal: true,
        flipVertical: true,
      },
    );
  });
});
