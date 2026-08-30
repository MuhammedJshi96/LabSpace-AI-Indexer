import { describe, expect, it } from "vitest";
import { createBlankProject } from "../../src/domain/room-factory";
import { STORAGE_RIGS } from "../../src/domain/storage-access";
import { buildStorageMap, storageMapMinimumWidth } from "../../src/domain/storage-map";
import { useEditorStore } from "../../src/store/editor-store";

function fixture(assetId: string) {
  const project = createBlankProject();
  useEditorStore.setState({
    project,
    history: [],
    future: [],
    pendingAgentChange: null,
    selectedIds: [],
    selectedLocationId: null,
    toasts: [],
  });
  const id = useEditorStore.getState().addAsset(assetId)!;
  const room = useEditorStore.getState().project.rooms.find((r) => r.id === project.activeRoomId)!;
  return {
    object: room.scene.objects.find((o) => o.id === id)!,
    locations: room.scene.storageLocations,
  };
}

describe("canonical visual storage map", () => {
  it("keeps adjacent numbered targets separated in dense island casework", () => {
    const { object, locations } = fixture("island-bench-service-bridge");
    const { slots } = buildStorageMap(object, locations);
    const front = slots.filter((slot) => slot.face === "front" && !slot.parentKey);
    const width = storageMapMinimumWidth(front, object.dimensions.width, object.dimensions.height);
    expect(width).toBeGreaterThan(500);
    const scale = width / object.dimensions.width;
    for (let a = 0; a < front.length; a++)
      for (let b = a + 1; b < front.length; b++) {
        const dx =
          (front[a].x + front[a].width / 2 - (front[b].x + front[b].width / 2)) *
          object.dimensions.width;
        const dy =
          (front[a].y + front[a].height / 2 - (front[b].y + front[b].height / 2)) *
          object.dimensions.height;
        expect(Math.hypot(dx, dy) * scale).toBeGreaterThanOrEqual(32);
      }
  });
  it("projects every verified family without adding or changing records", () => {
    for (const assetId of Object.keys(STORAGE_RIGS)) {
      const { object, locations } = fixture(assetId);
      const before = structuredClone(locations);
      const map = buildStorageMap(object, locations);
      expect(map.slots.length, assetId).toBe(STORAGE_RIGS[assetId].locations!.length);
      expect(map.unlinked, assetId).toHaveLength(0);
      for (const slot of map.slots) {
        expect(slot.location, `${assetId}/${slot.key}`).not.toBeNull();
        expect(slot.location!.anatomyKey).toBe(slot.key);
        expect(slot.width).toBeGreaterThan(0);
        expect(slot.height).toBeGreaterThan(0);
        expect([slot.x, slot.y, slot.width, slot.height].every(Number.isFinite)).toBe(true);
      }
      expect(locations).toEqual(before);
    }
  });
  it("separates opposing island faces and projects corner drawers along their real normals", () => {
    const island = fixture("center-island-bench");
    const map = buildStorageMap(island.object, island.locations);
    expect(map.faces).toEqual(["front", "back"]);
    const back = map.slots.find(
      (slot) => slot.key === "drawer:Island north module 2 top drawer 1",
    )!;
    const front = map.slots.find(
      (slot) => slot.key === "drawer:Island south module 2 top drawer 1",
    )!;
    expect(back.face).toBe("back");
    expect(front.face).toBe("front");
    expect(back.x).not.toBeCloseTo(front.x);
    const corner = fixture("corner-lab-bench");
    const cornerMap = buildStorageMap(corner.object, corner.locations);
    const drawer = cornerMap.slots.find((slot) => slot.key === "drawer:corner run drawer 1")!;
    expect(["left", "right"]).toContain(drawer.face);
    expect(drawer.width).toBeGreaterThan(0.5);
    expect(cornerMap.slots.find((slot) => slot.key === "drawer:return utility drawer")!.face).toBe(
      "front",
    );
  });
  it("keeps local face mapping stable after room rotation, elevation and naming changes", () => {
    const { object, locations } = fixture("wall-cabinet");
    const before = buildStorageMap(object, locations);
    const renamed = locations.map((location) => ({ ...location, name: `Our ${location.type}` }));
    const map = buildStorageMap(
      {
        ...object,
        rotation: { ...object.rotation, z: 180 },
        position: { ...object.position, z: 1200 },
      },
      renamed,
    );
    expect(map.slots.map((slot) => ({ ...slot, location: null }))).toEqual(
      before.slots.map((slot) => ({ ...slot, location: null })),
    );
    expect(map.slots.every((slot) => slot.location!.name.startsWith("Our "))).toBe(true);
    expect(map.slots.map((slot) => slot.location!.id)).toEqual(
      before.slots.map((slot) => slot.location!.id),
    );
  });
  it("never invents targets for unlinked, custom or ambiguously bound records", () => {
    const { object, locations } = fixture("base-drawer-cabinet");
    const root = locations.find((l) => !l.parentId)!;
    const drawer = locations.find((l) => l.type === "drawer")!;
    const custom = {
      ...drawer,
      id: "custom",
      anatomyKey: undefined,
      name: "User bin",
      type: "bin" as const,
      parentId: root.id,
    };
    const duplicate = { ...drawer, id: "duplicate" };
    const map = buildStorageMap(object, [...locations, custom, duplicate]);
    expect(map.slots.find((slot) => slot.key === drawer.anatomyKey)!.location).toBeNull();
    expect(map.unlinked.map((l) => l.id)).toEqual(
      expect.arrayContaining([custom.id, drawer.id, duplicate.id]),
    );
    const unknown = buildStorageMap({ ...object, assetDefinitionId: "unknown-model" }, locations);
    expect(unknown.slots).toEqual([]);
    expect(unknown.unlinked).toHaveLength(locations.length - 1);
  });
});
