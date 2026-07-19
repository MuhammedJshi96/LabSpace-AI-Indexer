import { describe, expect, it } from "vitest";
import {
  BUILD_WEEK_DEMO,
  BUILD_WEEK_DEMO_ASSET_IDS,
} from "../../src/domain/build-week-demo";
import { getAssetDefinition } from "../../src/domain/assets";
import { createSeedProject } from "../../src/domain/seed";
import {
  answerSpatialQuestion,
  reviewObjectPlacement,
} from "../../src/domain/spatial-assistant";

function competitionProject() {
  const project = createSeedProject();
  const template = project.rooms.find((room) => room.roomKind === "demo-template")!;
  template.roomKind = "demo";
  template.name = "Build Week Demo";
  template.demoSavedAt = new Date().toISOString();
  project.activeRoomId = template.id;
  return project;
}

describe("Build Week spatial assistant foundation", () => {
  it("keeps the storage-first demo at twelve intentional room instances", () => {
    expect(BUILD_WEEK_DEMO_ASSET_IDS).toHaveLength(12);
    for (const assetId of BUILD_WEEK_DEMO_ASSET_IDS) {
      expect(getAssetDefinition(assetId).model3d, assetId).toBeTruthy();
    }
    expect(BUILD_WEEK_DEMO.samplePrompts[0]).toContain("BÜCHI");

    const room = createSeedProject().rooms.find((entry) => entry.id === BUILD_WEEK_DEMO.roomId)!;
    const roomAssets = room.scene.objects.filter(
      (object) => !["wall", "door", "window"].includes(object.objectType),
    );
    expect(roomAssets).toHaveLength(12);
    expect(new Set(roomAssets.map((object) => object.id)).size).toBe(roomAssets.length);
  });

  it("answers the signature equipment-and-flasks question from stored records", () => {
    const project = competitionProject();
    const answer = answerSpatialQuestion(
      project,
      "Where is the Buchi rotary evaporator and which cabinet contains its flasks?",
    );

    expect(answer.mode).toBe("grounded-local");
    expect(answer.intent).toBe("locate");
    expect(answer.evidence).toHaveLength(2);
    expect(answer.evidence.map((record) => record.name)).toEqual(
      expect.arrayContaining([
        "BÜCHI rotary evaporator R-300",
        "Rotary evaporator flask set",
      ]),
    );
    const flaskRecord = answer.evidence.find((record) => record.kind === "inventory")!;
    expect(flaskRecord.path).toEqual(
      expect.arrayContaining(["Build Week Demo", "North reagent cabinet", "Shelf 01"]),
    );
    expect(answer.focus.objectIds).toHaveLength(2);
    expect(answer.focus.locationIds).toEqual(["storage-location-0002"]);
  });

  it("reports service and missing-location scenarios without fabricating records", () => {
    const project = competitionProject();
    const maintenance = answerSpatialQuestion(project, "Which equipment needs maintenance soon?");
    const missing = answerSpatialQuestion(
      project,
      "Which inventory item is missing a physical location?",
    );
    const unknown = answerSpatialQuestion(project, "Where is the imaginary moon spectrometer?");

    expect(maintenance.evidence.map((record) => record.name)).toContain(
      "Vacuum cold-trap station",
    );
    expect(missing.evidence.map((record) => record.name)).toContain("Unassigned buffer stock");
    expect(unknown.evidence).toEqual([]);
    expect(unknown.caveats.join(" ")).toMatch(/will not invent/i);
  });

  it("explains a deterministic conflict and proposes a validator-clean alternative", () => {
    const project = createSeedProject();
    const room = structuredClone(
      project.rooms.find((entry) => entry.id === BUILD_WEEK_DEMO.roomId)!,
    );
    const rotaryRecord = room.scene.equipmentRecords.find(
      (record) => record.id === BUILD_WEEK_DEMO.equipmentRecordId,
    )!;
    const rotary = room.scene.objects.find((object) => object.id === rotaryRecord.objectId)!;
    const neighbor = room.scene.objects.find((object) => object.name === "North reagent cabinet")!;
    rotary.position = { ...neighbor.position };

    const review = reviewObjectPlacement(room, rotary.id)!;
    expect(review.safe).toBe(false);
    expect(review.warnings.some((warning) => warning.id.startsWith("overlap-"))).toBe(true);
    expect(review.suggestion).not.toBeNull();

    const suggestedRoom = structuredClone(room);
    const suggestedObject = suggestedRoom.scene.objects.find((object) => object.id === rotary.id)!;
    suggestedObject.position = { ...review.suggestion!.position };
    expect(reviewObjectPlacement(suggestedRoom, rotary.id)?.safe).toBe(true);
  });
});
