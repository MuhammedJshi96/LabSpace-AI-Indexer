import { describe, expect, it } from "vitest";
import { chairFitsUnderDesk, objectsOverlap, snapChairToDesk } from "../../src/domain/geometry";
import { createSeedProject } from "../../src/domain/seed";
import type { SceneObject } from "../../src/domain/schema";
import { useEditorStore } from "../../src/store/editor-store";

function fixture(rotation = 0) {
  const room = createSeedProject().rooms[0];
  const source = room.scene.objects.find((entry) => entry.objectType !== "wall")!;
  const desk: SceneObject = {
    ...source,
    id: "desk",
    assetDefinitionId: "office-desk",
    objectType: "furniture",
    metadata: {},
    parentObjectId: null,
    position: { x: 3000, y: 3000, z: 0 },
    dimensions: { width: 1400, depth: 700, height: 740 },
    rotation: { x: 0, y: 0, z: rotation },
    flipVertical: false,
  };
  const angle = (rotation * Math.PI) / 180;
  const chair: SceneObject = {
    ...desk,
    id: "chair",
    assetDefinitionId: "office-chair",
    dimensions: { width: 620, depth: 620, height: 980 },
    position: { x: 3000 - Math.sin(angle) * 550, y: 3000 + Math.cos(angle) * 550, z: 0 },
    rotation: { x: 0, y: 0, z: rotation + 180 },
  };
  room.scene.objects = [desk];
  return { room, desk, chair };
}
describe("furniture knee-space snapping", () => {
  it.each([0, 90, 180, 270, 35])(
    "tucks a chair at %s degrees and retains floor elevation",
    (rotation) => {
      const { room, desk, chair } = fixture(rotation);
      const snapped = snapChairToDesk(room, chair);
      expect(chairFitsUnderDesk(desk, snapped)).toBe(true);
      expect(snapped.position.z).toBe(0);
      expect(objectsOverlap(desk, snapped)).toBe(false);
    },
  );
  it("rejects back-facing, side, deep and closed-casework intersections", () => {
    const { desk, chair } = fixture();
    expect(chairFitsUnderDesk(desk, { ...chair, rotation: { x: 0, y: 0, z: 0 } })).toBe(false);
    expect(chairFitsUnderDesk(desk, { ...chair, position: { x: 3500, y: 3550, z: 0 } })).toBe(
      false,
    );
    expect(chairFitsUnderDesk(desk, { ...chair, position: desk.position })).toBe(false);
    expect(chairFitsUnderDesk({ ...desk, assetDefinitionId: "standard-lab-bench" }, chair)).toBe(
      false,
    );
  });
  it("does not teleport distant chairs or snap into an occupied seat", () => {
    const { room, chair } = fixture();
    const distant = { ...chair, position: { x: 6000, y: 6000, z: 0 } };
    expect(snapChairToDesk(room, distant)).toBe(distant);
    room.scene.objects.push({ ...chair, id: "existing-chair" });
    expect(snapChairToDesk(room, chair)).toBe(chair);
  });
  it("preserves a deliberate elevation-only inspector edit", () => {
    const { room, chair } = fixture();
    chair.indexCode = "CHAIR-TEST";
    room.scene.objects.push(chair);
    const project = createSeedProject();
    project.rooms = [room];
    project.activeRoomId = room.id;
    useEditorStore.setState({
      project,
      snapEnabled: true,
      pendingAgentChange: null,
      history: [],
      future: [],
    });
    useEditorStore.getState().updateObject(chair.id, { position: { ...chair.position, z: 150 } });
    expect(
      useEditorStore.getState().project.rooms[0].scene.objects.find((item) => item.id === chair.id)
        ?.position.z,
    ).toBe(150);
  });
});
