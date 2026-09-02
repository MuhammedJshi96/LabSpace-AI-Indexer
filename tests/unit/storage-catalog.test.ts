import { beforeEach, describe, expect, it } from "vitest";
import * as THREE from "three";
import { ASSET_CATALOG, getAssetDefinition } from "../../src/domain/assets";
import { createSeedProject } from "../../src/domain/seed";
import { ProjectSchema } from "../../src/domain/schema";
import { completeObjectStorage, missingStorageCount } from "../../src/domain/storage-templates";
import { resolveStorageAccess, STORAGE_RIGS } from "../../src/domain/storage-access";
import { applyStoragePose, cloneStorageScene } from "../../src/lib/storage-articulation";
import { useEditorStore } from "../../src/store/editor-store";

describe("complete authored storage catalog", () => {
  beforeEach(() =>
    useEditorStore.setState({
      project: createSeedProject(),
      history: [],
      future: [],
      pendingAgentChange: null,
      selectedIds: [],
      selectedLocationId: null,
    }),
  );
  it("creates assignable geometry-bound locations for every supported family", () => {
    expect(Object.keys(STORAGE_RIGS)).toHaveLength(34);
    for (const definition of ASSET_CATALOG.filter((asset) => STORAGE_RIGS[asset.id])) {
      const id = useEditorStore.getState().addAsset(definition.id)!;
      const state = useEditorStore.getState();
      const room = state.project.rooms.find((r) => r.id === state.project.activeRoomId)!;
      const locations = room.scene.storageLocations.filter((l) => l.objectId === id);
      expect(locations.length, definition.id).toBe((definition.storageTemplate?.length ?? 0) + 1);
      for (const location of locations.filter((l) => l.parentId)) {
        const access = resolveStorageAccess(definition.id, id, location.id, locations);
        expect(access.region, `${definition.id}/${location.name}`).not.toBeNull();
        if (access.reason) expect(access.reason).toContain("open storage");
        else expect(access.parts.length).toBeGreaterThan(0);
      }
      expect(ProjectSchema.safeParse(state.project).success, definition.id).toBe(true);
    }
  });
  it("adds missing records idempotently, preserving custom children and inventory identity", () => {
    const id = useEditorStore.getState().addAsset("mobile-bench")!;
    let state = useEditorStore.getState();
    const room = state.project.rooms.find((r) => r.id === state.project.activeRoomId)!;
    const object = room.scene.objects.find((o) => o.id === id)!;
    const root = room.scene.storageLocations.find((l) => l.objectId === id && !l.parentId)!;
    const custom = {
      ...root,
      id: "custom-bin",
      type: "bin" as const,
      parentId: root.id,
      name: "User-owned bin",
      indexCode: "USER-BIN",
      childIds: [],
    };
    const incomplete = [{ ...root, childIds: [custom.id] }, custom];
    const result = completeObjectStorage(
      getAssetDefinition("mobile-bench"),
      object,
      room.id,
      incomplete,
      root.createdAt,
    );
    expect(result.locations.find((l) => l.id === custom.id)).toEqual(custom);
    expect(result.added).toBe(3);
    const repeated = completeObjectStorage(
      getAssetDefinition("mobile-bench"),
      object,
      room.id,
      result.locations,
      root.createdAt,
    );
    expect(repeated.added).toBe(0);
    expect(repeated.linked).toBe(0);
    expect(repeated.locations).toEqual(result.locations);
    room.scene.storageLocations = incomplete;
    room.scene.inventoryItems = [
      {
        id: "stock",
        name: "Existing sample",
        quantity: 2,
        unit: "vials",
        notes: "",
        owner: "User",
        expiryDate: null,
        storageLocationId: custom.id,
        createdAt: root.createdAt,
        updatedAt: root.updatedAt,
      },
    ];
    useEditorStore.setState({
      project: {
        ...state.project,
        rooms: state.project.rooms.map((r) => (r.id === room.id ? room : r)),
      },
      history: [],
      future: [],
    });
    const before = structuredClone(room.scene);
    useEditorStore.getState().completeRoomStorage();
    state = useEditorStore.getState();
    expect(state.project.rooms.find((r) => r.id === room.id)!.scene.inventoryItems).toEqual(
      before.inventoryItems,
    );
    expect(state.history).toHaveLength(1);
    useEditorStore.getState().undo();
    expect(
      useEditorStore.getState().project.rooms.find((r) => r.id === room.id)!.scene.storageLocations,
    ).toEqual(before.storageLocations);
    useEditorStore.getState().redo();
    expect(
      useEditorStore.getState().project.rooms.find((r) => r.id === room.id)!.scene.storageLocations
        .length,
    ).toBeGreaterThan(before.storageLocations.length);
  });
  it("moves rear and corner drawers outward and keeps sliding leaves on their track", () => {
    for (const aid of ["corner-lab-bench", "island-bench-service-bridge", "glass-wall-cabinet"]) {
      const source = new THREE.Group();
      for (const mechanism of STORAGE_RIGS[aid].parts) {
        const node = new THREE.Group();
        node.userData.storageMechanism = mechanism;
        source.add(node);
      }
      const clone = cloneStorageScene(source);
      for (const part of clone.parts.filter((p) => p.mechanism.kind !== "hinge")) {
        applyStoragePose(part, 1);
        const delta = part.node.position.clone().sub(part.position);
        expect(delta.length()).toBeGreaterThan(0.1);
        if (part.mechanism.kind === "slide") {
          expect(delta.y).toBe(0);
          expect(delta.z).toBe(0);
        } else if (Math.abs(part.mechanism.region.z) > 0.4)
          expect(delta.z * part.mechanism.region.z).toBeGreaterThan(0);
        applyStoragePose(part, 0);
        expect(part.node.position.equals(part.position)).toBe(true);
      }
    }
  });
  it("links legacy labels explicitly without moving inventory and supports undo", () => {
    const objectId = useEditorStore.getState().addAsset("mobile-bench")!;
    const state = useEditorStore.getState();
    const room = state.project.rooms.find((r) => r.id === state.project.activeRoomId)!;
    const drawer = room.scene.storageLocations.find(
      (l) => l.objectId === objectId && l.type === "drawer",
    )!;
    const slots = STORAGE_RIGS["mobile-bench"].locations!.filter((slot) => slot.type === "drawer");
    const target = slots.find((slot) => slot.key !== drawer.anatomyKey)!;
    const original = structuredClone(room.scene);
    state.bindStorageAnatomy(drawer.id, target.key);
    const after = useEditorStore.getState().project.rooms.find((r) => r.id === room.id)!.scene;
    expect(after.storageLocations.find((l) => l.id === drawer.id)?.anatomyKey).toBe(target.key);
    expect(after.objects).toEqual(original.objects);
    expect(after.inventoryItems).toEqual(original.inventoryItems);
    expect(
      resolveStorageAccess("mobile-bench", objectId, drawer.id, after.storageLocations).parts.map(
        (p) => p.id,
      ),
    ).toEqual(target.partIds);
    const historyLength = useEditorStore.getState().history.length;
    useEditorStore.getState().bindStorageAnatomy(drawer.id, "not-a-real-part");
    expect(useEditorStore.getState().history).toHaveLength(historyLength);
    useEditorStore.getState().undo();
    expect(
      useEditorStore.getState().project.rooms.find((r) => r.id === room.id)!.scene.storageLocations,
    ).toEqual(original.storageLocations);
  });
  it("does not offer completion forever for ordinary unrigged storage templates", () => {
    const definition = getAssetDefinition("pegboard");
    const objectId = useEditorStore.getState().addAsset(definition.id)!;
    const state = useEditorStore.getState();
    const room = state.project.rooms.find((r) => r.id === state.project.activeRoomId)!;
    expect(missingStorageCount(definition, objectId, room.scene.storageLocations)).toBe(0);
  });
});
