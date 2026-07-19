import { beforeEach, describe, expect, it } from "vitest";
import { createSeedProject } from "../../src/domain/seed";
import { ProjectSchema } from "../../src/domain/schema";
import { useEditorStore } from "../../src/store/editor-store";

function resetEditor() {
  const project = createSeedProject();
  useEditorStore.setState({
    project,
    selectedIds: [],
    selectedLocationId: null,
    cameraPreset: "isometric",
    presentation: "split",
    floorVisible: true,
    wallTransparent: false,
    environmentContextVisible: false,
    history: [],
    future: [],
    saveStatus: "saved",
    dirtyRevision: 0,
  });
}

describe("Demo Room ownership", () => {
  beforeEach(resetEditor);

  it("duplicates the immutable factory template into an independent user room", () => {
    const factoryBefore = createSeedProject().rooms.find(
      (room) => room.roomKind === "demo-template",
    )!;
    const demoId = useEditorStore.getState().createDemoFromTemplate();
    expect(demoId).not.toBeNull();

    const state = useEditorStore.getState();
    const demo = state.project.rooms.find((room) => room.id === demoId)!;
    const nonArchitectural = demo.scene.objects.filter(
      (object) => !["wall", "door", "window"].includes(object.objectType),
    );

    expect(demo.roomKind).toBe("demo");
    expect(demo.id).not.toBe(factoryBefore.id);
    expect(demo.environmentProfileId).toBeNull();
    expect(demo.viewState?.environmentContextVisible).toBe(false);
    expect(nonArchitectural).toHaveLength(12);
    expect(nonArchitectural.filter((object) => object.assetDefinitionId === "rotary-evaporator"))
      .toHaveLength(1);
    expect(ProjectSchema.parse(state.project).rooms.find((room) => room.id === demoId)).toBeTruthy();
  });

  it("reopens the latest demo without replacing its geometry or saved camera", () => {
    const store = useEditorStore.getState();
    const demoId = store.createDemoFromTemplate()!;
    const demo = useEditorStore.getState().project.rooms.find((room) => room.id === demoId)!;
    const rotary = demo.scene.objects.find(
      (object) => object.assetDefinitionId === "rotary-evaporator",
    )!;
    const movedX = rotary.position.x + 240;
    useEditorStore.getState().updateObject(rotary.id, {
      position: { ...rotary.position, x: movedX },
    });
    const pose = {
      position: { x: 4.2, y: 5.1, z: 6.3 },
      target: { x: 0.4, y: 0.9, z: -0.2 },
    };
    useEditorStore.getState().setCameraPose(pose);

    const starterId = useEditorStore
      .getState()
      .project.rooms.find((room) => room.name === "Empty lab plan")!.id;
    useEditorStore.getState().switchRoom(starterId);
    expect(useEditorStore.getState().openLatestDemoRoom()).toBe(demoId);

    const reopened = useEditorStore.getState().project.rooms.find((room) => room.id === demoId)!;
    expect(reopened.scene.objects.find((object) => object.id === rotary.id)?.position.x).toBe(movedX);
    expect(reopened.viewState?.cameraPose).toEqual(pose);
    expect(useEditorStore.getState().cameraPreset).toBe(reopened.viewState?.cameraPreset);

    const factoryAfter = createSeedProject().rooms.find(
      (room) => room.roomKind === "demo-template",
    )!;
    expect(
      factoryAfter.scene.objects.find((object) => object.assetDefinitionId === "rotary-evaporator")
        ?.position.x,
    ).not.toBe(movedX);
  });
});
