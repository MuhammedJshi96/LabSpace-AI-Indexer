import { beforeEach, describe, expect, it } from "vitest";
import { createSeedProject } from "../../src/domain/seed";
import { useEditorStore } from "../../src/store/editor-store";

function resetEditor() {
  useEditorStore.setState({
    project: createSeedProject(),
    selectedIds: [],
    selectedLocationId: null,
    saveStatus: "saved",
    dirtyRevision: 0,
  });
}

function locationsFor(objectId: string) {
  const state = useEditorStore.getState();
  const room = state.project.rooms.find((entry) => entry.id === state.project.activeRoomId)!;
  return room.scene.storageLocations.filter((location) => location.objectId === objectId);
}

describe("reference-based bench storage", () => {
  beforeEach(resetEditor);

  it("creates the standard Shimadzu bench drawer and cabinet anatomy", () => {
    const objectId = useEditorStore.getState().addAsset("lab-bench")!;
    const locations = locationsFor(objectId);

    expect(locations.filter((location) => location.type === "cabinet")).toHaveLength(1);
    expect(locations.filter((location) => location.type === "drawer")).toHaveLength(8);
    expect(locations.filter((location) => location.type === "compartment")).toHaveLength(1);
    expect(locations.every((location) => location.objectId === objectId)).toBe(true);
    expect(
      locations
        .filter((location) => location.type !== "cabinet")
        .every((location) => Boolean(location.normalizedBounds)),
    ).toBe(true);
  });

  it("creates both working faces and the glazed bridge for the Ref2 island", () => {
    const objectId = useEditorStore.getState().addAsset("island-bench-service-bridge")!;
    const locations = locationsFor(objectId);

    expect(locations.filter((location) => location.type === "cabinet")).toHaveLength(1);
    expect(locations.filter((location) => location.type === "drawer")).toHaveLength(20);
    expect(locations.filter((location) => location.type === "compartment")).toHaveLength(7);
    expect(locations.filter((location) => location.type === "shelf")).toHaveLength(6);
    expect(
      locations
        .filter((location) => location.type === "drawer")
        .every((location) => location.anatomyKey),
    ).toBe(true);
    expect(locations.some((location) => location.name === "Service bridge bay 3")).toBe(true);
  });

  it("creates indexable storage on the plain center island", () => {
    const objectId = useEditorStore.getState().addAsset("center-island-bench")!;
    const locations = locationsFor(objectId);

    expect(locations.filter((location) => location.type === "drawer")).toHaveLength(20);
    expect(locations.filter((location) => location.type === "compartment")).toHaveLength(4);
  });
});
