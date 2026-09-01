import { beforeEach, describe, expect, it } from "vitest";
import { createSeedProject } from "../../src/domain/seed";
import { translateSelection } from "../../src/domain/selection-drag";
import { getClosedWallFloorPolygon } from "../../src/domain/room-geometry";
import { useEditorStore, selectActiveRoom } from "../../src/store/editor-store";
import type { SceneObject } from "../../src/domain/schema";

function fixture() {
  const project = createSeedProject();
  const room = project.rooms[0];
  const source = room.scene.objects.find((object) => object.objectType === "furniture")!;
  const a: SceneObject = {
    ...structuredClone(source),
    id: "selected-a",
    assetDefinitionId: "office-desk",
    name: "Desk A",
    locked: false,
    position: { x: 2200, y: 2200, z: 0 },
  };
  const b: SceneObject = {
    ...a,
    id: "selected-b",
    name: "Desk B",
    position: { x: 4600, y: 2200, z: 0 },
    rotation: { x: 0, y: 0, z: 90 },
  };
  room.scene.layers.forEach((layer) => (layer.locked = false));
  room.scene.objects = [
    ...room.scene.objects.filter((object) => object.wall || object.opening),
    a,
    b,
  ];
  project.activeRoomId = room.id;
  return { project, room, a, b };
}

beforeEach(() =>
  useEditorStore.setState({
    project: createSeedProject(),
    history: [],
    future: [],
    pendingAgentChange: null,
    selectedIds: [],
    wallDrawKind: "full",
  }),
);

describe("rigid multi-selection dragging", () => {
  it("translates every selected member equally without rotating, resnapping or mutating the input", () => {
    const { room, a, b } = fixture();
    const before = JSON.stringify(room);
    const result = translateSelection(room, [a.id, b.id], { x: 275, y: -150 });
    expect(result.error).toBeNull();
    for (const source of [a, b])
      expect(result.objects.find((object) => object.id === source.id)).toMatchObject({
        position: { x: source.position.x + 275, y: source.position.y - 150, z: 0 },
        rotation: source.rotation,
      });
    expect(JSON.stringify(room)).toBe(before);
    expect(result.objects.find((object) => object.wall)).toBe(
      room.scene.objects.find((object) => object.wall),
    );
  });
  it("keeps locked objects fixed", () => {
    const { room, a, b } = fixture();
    b.locked = true;
    const result = translateSelection(room, [a.id, b.id], { x: 500, y: 0 });
    expect(result.objects.find((object) => object.id === b.id)).toBe(b);
    expect(result.objects.find((object) => object.id === a.id)?.position.x).toBe(
      a.position.x + 500,
    );
  });
  it("carries hosted openings with their selected wall and rejects a detached opening drag", () => {
    const { room, a } = fixture();
    const opening = room.scene.objects.find((object) => object.opening)!;
    const wall = room.scene.objects.find((object) => object.id === opening.opening!.wallId)!;
    wall.locked = opening.locked = false;
    const result = translateSelection(room, [a.id, wall.id], { x: 200, y: 300 });
    expect(result.error).toBeNull();
    expect(result.objects.find((object) => object.id === opening.id)?.opening).toEqual(
      opening.opening,
    );
    expect(result.objects.find((object) => object.id === opening.id)?.position.x).toBe(
      opening.position.x + 200,
    );
    expect(result.objects.find((object) => object.id === wall.id)?.wall?.end.y).toBe(
      wall.wall!.end.y + 300,
    );
    expect(translateSelection(room, [a.id, opening.id], { x: 200, y: 300 }).error).toContain(
      "host wall",
    );
    opening.locked = true;
    expect(translateSelection(room, [a.id, wall.id], { x: 200, y: 300 }).error).toContain("locked");
  });
  it("commits as one undo/redo without changing inventory identities", () => {
    const { room, project, a, b } = fixture();
    useEditorStore.setState({ project });
    const before = structuredClone(room.scene.objects);
    const inventory = JSON.stringify(room.scene.inventoryItems);
    const result = translateSelection(room, [a.id, b.id], { x: 200, y: 300 });
    useEditorStore.getState().previewObjects(result.objects);
    useEditorStore.getState().commitPreviewBatch(before, "Move 2 selected items");
    expect(useEditorStore.getState().history).toHaveLength(1);
    useEditorStore.getState().undo();
    expect(selectActiveRoom(useEditorStore.getState()).scene.objects).toEqual(before);
    useEditorStore.getState().redo();
    expect(
      selectActiveRoom(useEditorStore.getState()).scene.objects.find((object) => object.id === b.id)
        ?.position.y,
    ).toBe(b.position.y + 300);
    expect(JSON.stringify(selectActiveRoom(useEditorStore.getState()).scene.inventoryItems)).toBe(
      inventory,
    );
  });
});

describe("half-height wall drawing", () => {
  it("draws an undoable 1200 mm partition without changing the room floor envelope", () => {
    const { project, room } = fixture();
    useEditorStore.setState({ project });
    const floorBefore = getClosedWallFloorPolygon(room.scene.objects);
    useEditorStore.getState().setWallDrawKind("half");
    expect(useEditorStore.getState().tool).toBe("wall");
    const id = useEditorStore.getState().addWall({ x: 2100, y: 2100 }, { x: 4400, y: 2100 });
    const after = selectActiveRoom(useEditorStore.getState());
    expect(after.scene.objects.find((object) => object.id === id)).toMatchObject({
      assetDefinitionId: "half-height-wall",
      dimensions: { height: 1200 },
      wall: { height: 1200, halfHeight: true },
    });
    expect(after.width).toBe(room.width);
    expect(after.depth).toBe(room.depth);
    expect(getClosedWallFloorPolygon(after.scene.objects)).toEqual(floorBefore);
    useEditorStore.getState().undo();
    expect(
      selectActiveRoom(useEditorStore.getState()).scene.objects.some((object) => object.id === id),
    ).toBe(false);
    useEditorStore.getState().redo();
    expect(
      selectActiveRoom(useEditorStore.getState()).scene.objects.find((object) => object.id === id)
        ?.wall?.halfHeight,
    ).toBe(true);
  });
});
