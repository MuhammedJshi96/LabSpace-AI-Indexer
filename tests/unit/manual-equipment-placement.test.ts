import { beforeEach, describe, expect, it } from "vitest";
import { createSeedProject } from "../../src/domain/seed";
import { selectActiveRoom, useEditorStore } from "../../src/store/editor-store";

beforeEach(() => {
  const project = createSeedProject();
  useEditorStore.setState({
    project,
    history: [],
    future: [],
    pendingAgentChange: null,
    selectedIds: [],
    snapEnabled: true,
  });
});

describe("manual benchtop-equipment placement", () => {
  it("keeps a new equipment asset at the user's floor drop point", () => {
    const id = useEditorStore
      .getState()
      .addAsset("analytical-balance", { x: 500, y: 500 });
    const placed = selectActiveRoom(useEditorStore.getState()).scene.objects.find(
      (object) => object.id === id,
    );

    expect(placed?.position).toEqual({ x: 500, y: 500, z: 0 });
  });

  it("does not relocate existing equipment when it is dragged away from a bench", () => {
    useEditorStore.getState().addAsset("lab-bench", { x: 3000, y: 3000 });
    const equipmentId = useEditorStore
      .getState()
      .addAsset("analytical-balance", { x: 3000, y: 3000 });
    const equipment = selectActiveRoom(useEditorStore.getState()).scene.objects.find(
      (object) => object.id === equipmentId,
    )!;
    expect(equipment.position.z).toBeGreaterThan(0);

    useEditorStore.getState().updateObject(equipment.id, {
      position: { x: 500, y: 500, z: equipment.position.z },
    });
    const moved = selectActiveRoom(useEditorStore.getState()).scene.objects.find(
      (object) => object.id === equipment.id,
    );

    expect(moved?.position).toEqual({ x: 500, y: 500, z: 0 });
  });

  it("recognizes the corner bench without treating a floor-standing freezer as a worktop", () => {
    useEditorStore.getState().addAsset("corner-lab-bench", { x: 3000, y: 3000 });
    const supportedId = useEditorStore
      .getState()
      .addAsset("analytical-balance", { x: 3000, y: 3000 });
    const supported = selectActiveRoom(useEditorStore.getState()).scene.objects.find(
      (object) => object.id === supportedId,
    );
    expect(supported?.position).toEqual({ x: 3000, y: 3000, z: 900 });

    const project = createSeedProject();
    useEditorStore.setState({ project, history: [], future: [], selectedIds: [] });
    useEditorStore.getState().addAsset("ultra-low-freezer", { x: 3000, y: 3000 });
    const floorStandingId = useEditorStore
      .getState()
      .addAsset("analytical-balance", { x: 3000, y: 3000 });
    const floorStanding = selectActiveRoom(useEditorStore.getState()).scene.objects.find(
      (object) => object.id === floorStandingId,
    );
    const freezer = selectActiveRoom(useEditorStore.getState()).scene.objects.find(
      (object) => object.assetDefinitionId === "ultra-low-freezer",
    );

    expect(freezer?.position.z).toBe(0);
    expect(floorStanding?.position).toEqual({ x: 3000, y: 3000, z: 0 });
  });
});
