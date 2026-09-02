import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  resolveStorageAccess,
  storageAccessFaceDirection,
} from "../../src/domain/storage-access";
import rigs from "../../src/domain/storage-rigs.json";
import type { StorageLocation } from "../../src/domain/schema";
import { applyStoragePose, cloneStorageScene } from "../../src/lib/storage-articulation";

function location(
  id: string,
  type: StorageLocation["type"],
  order = 0,
  parentId: string | null = "root",
): StorageLocation {
  return {
    id,
    roomId: "room",
    objectId: "object",
    parentId,
    type,
    name: id,
    order,
    indexCode: id,
    capacityNotes: "",
    childIds: [],
    createdAt: "2026-08-30",
    updatedAt: "2026-08-30",
  };
}
const root = location("root", "cabinet", 0, null);

describe("authored storage access", () => {
  it("uses the authored front face for every overhead module and shelf despite negative Z offsets", () => {
    const slots = rigs["lab-bench-overhead"].locations.filter((slot) =>
      slot.key.startsWith("bay:Overhead module"),
    );
    expect(slots).toHaveLength(12);
    expect(new Set(slots.map((slot) => slot.key.match(/module (\d)/)?.[1]))).toEqual(
      new Set(["1", "2", "3", "4"]),
    );
    expect(slots.every((slot) => slot.region.z < 0)).toBe(true);

    for (const [index, slot] of slots.entries()) {
      const selected = {
        ...location(`overhead-${index}`, slot.type as StorageLocation["type"], index),
        name: slot.name,
        anatomyKey: slot.key,
      };
      const access = resolveStorageAccess("lab-bench-overhead", "object", selected.id, [
        root,
        selected,
      ]);
      expect(access.accessFace, slot.key).toBe("front");
      expect(storageAccessFaceDirection(access.accessFace)).toEqual({ x: 0, z: 1 });
    }
  });

  it("keeps tall-cabinet shelves on the door face and opposing island storage on its authored face", () => {
    const tallShelves = rigs["tall-cabinet"].locations.filter(
      (slot) => slot.type === "shelf",
    );
    expect(tallShelves).toHaveLength(5);
    for (const [index, slot] of tallShelves.entries()) {
      const selected = {
        ...location(`tall-${index}`, "shelf", index),
        name: slot.name,
        anatomyKey: slot.key,
      };
      expect(
        resolveStorageAccess("tall-cabinet", "object", selected.id, [root, selected]).accessFace,
      ).toBe("front");
    }

    for (const assetId of ["center-island-bench", "island-bench-service-bridge"] as const) {
      const rig = rigs[assetId];
      const north = rig.locations.find((slot) => slot.key.startsWith("drawer:Island north"))!;
      const south = rig.locations.find((slot) => slot.key.startsWith("drawer:Island south"))!;
      const northLocation = {
        ...location(`${assetId}-north`, north.type as StorageLocation["type"]),
        name: north.name,
        anatomyKey: north.key,
      };
      const southLocation = {
        ...location(`${assetId}-south`, south.type as StorageLocation["type"]),
        name: south.name,
        anatomyKey: south.key,
      };
      expect(
        resolveStorageAccess(assetId, "object", northLocation.id, [root, northLocation])
          .accessFace,
      ).toBe("rear");
      expect(
        resolveStorageAccess(assetId, "object", southLocation.id, [root, southLocation])
          .accessFace,
      ).toBe("front");
    }
  });

  it("preserves explicitly authored side and rear access on the L-shaped corner bench", () => {
    const rig = rigs["corner-lab-bench"];
    const side = rig.locations.find((slot) => slot.key.startsWith("drawer:corner run"))!;
    const rear = rig.locations.find((slot) => slot.key === "drawer:return utility drawer")!;
    for (const [slot, expected] of [
      [side, "right"],
      [rear, "rear"],
    ] as const) {
      const selected = {
        ...location(slot.key, slot.type as StorageLocation["type"]),
        name: slot.name,
        anatomyKey: slot.key,
      };
      expect(
        resolveStorageAccess("corner-lab-bench", "object", selected.id, [root, selected])
          .accessFace,
      ).toBe(expected);
    }
  });

  it("maps original generated drawer labels despite additive anatomy rows, without touching identities", () => {
    const locations = [
      root,
      { ...location("legacy", "drawer"), name: "Drawer 01" },
      ...rigs["base-drawer-cabinet"].locations.map((slot, i) => ({
        ...location(`bound-${i}`, "drawer", i + 1),
        name: slot.name,
        anatomyKey: slot.key,
      })),
    ];
    const before = JSON.stringify(locations);
    const access = resolveStorageAccess("base-drawer-cabinet", "object", "legacy", locations);
    expect(access.parts).toHaveLength(1);
    expect(access.parts[0].id).toBe("Three-drawer bank drawer 3");
    expect(JSON.stringify(locations)).toBe(before);
    const invalid = { ...location("invalid", "drawer"), name: "Drawer 04" };
    expect(
      resolveStorageAccess("base-drawer-cabinet", "object", "invalid", [...locations, invalid])
        .parts,
    ).toHaveLength(0);
  });
  it("opens the correct legacy upper/lower sliding bay and one leaf per track", () => {
    const locations = [
      root,
      { ...location("upper", "compartment"), name: "Upper Compartment" },
      { ...location("lower", "compartment", 1), name: "Lower Compartment" },
    ];
    expect(
      resolveStorageAccess("glazed-sliding-cabinet", "object", "upper", locations).parts.map(
        (part) => part.bay,
      ),
    ).toEqual(["Upper glass"]);
    expect(
      resolveStorageAccess("glazed-sliding-cabinet", "object", "lower", locations).parts.map(
        (part) => part.bay,
      ),
    ).toEqual(["Lower steel"]);
    expect(
      resolveStorageAccess("glazed-sliding-cabinet", "object", "root", locations).parts.map(
        (part) => part.bay,
      ),
    ).toEqual(["Lower steel", "Upper glass"]);
  });
  it("never silently remaps an obsolete explicit physical binding", () => {
    const selected = {
      ...location("drawer", "drawer"),
      name: "Drawer 01",
      anatomyKey: "deleted-physical-drawer",
    };
    expect(
      resolveStorageAccess("base-drawer-cabinet", "object", selected.id, [root, selected]).reason,
    ).toContain("saved physical link");
  });
  it("opens the two actual opposing wall-cabinet leaves and selects its top shelf", () => {
    const locations = [root, location("shelf", "shelf")];
    const before = JSON.stringify(locations);
    const access = resolveStorageAccess("wall-cabinet", "object", "shelf", locations);
    expect(access.parts).toHaveLength(2);
    expect(access.parts.map((part) => Math.sign(part.angle))).toEqual([-1, 1]);
    expect(access.region?.y).toBeCloseTo(rigs["wall-cabinet"].shelfLevels[0] + 0.016);
    expect(access.description).toContain("2 fixed internal shelves");
    expect(JSON.stringify(locations)).toBe(before);
  });

  it("opens only the selected physical drawer, including a bin nested inside it", () => {
    const locations = [
      root,
      location("top", "drawer", 0),
      location("middle", "drawer", 1),
      location("bottom", "drawer", 2),
      location("bin", "bin", 0, "middle"),
    ];
    const access = resolveStorageAccess("base-drawer-cabinet", "object", "bin", locations);
    expect(access.parts).toHaveLength(1);
    expect(access.parts[0].id).toBe("Three-drawer bank drawer 2");
    expect(access.parts[0].travel).toBeGreaterThan(0.2);
    expect(access.region!.width).toBeLessThan(access.parts[0].region.width);
    const top = resolveStorageAccess("base-drawer-cabinet", "object", "top", locations);
    const bottom = resolveStorageAccess("base-drawer-cabinet", "object", "bottom", locations);
    expect(top.region!.y).toBeGreaterThan(bottom.region!.y);
  });

  it("does not invent openings for unknown assets or mismatched saved drawer/shelf counts", () => {
    const drawers = [root, ...[0, 1, 2].map((n) => location(`drawer-${n}`, "drawer", n))];
    expect(resolveStorageAccess("base-cabinet", "object", "drawer-2", drawers).reason).toContain(
      "does not match",
    );
    expect(resolveStorageAccess("unknown-cabinet", "object", "root", [root]).parts).toHaveLength(0);
    const shelves = [root, ...[0, 1, 2].map((n) => location(`shelf-${n}`, "shelf", n))];
    expect(resolveStorageAccess("wall-cabinet", "object", "shelf-2", shelves).reason).toContain(
      "shelf count",
    );
  });

  it("rejects wrong-object IDs and cyclic hierarchy safely", () => {
    expect(resolveStorageAccess("wall-cabinet", "other", "root", [root]).parts).toHaveLength(0);
    const loop = [location("root", "cabinet", 0, "shelf"), location("shelf", "shelf")];
    expect(resolveStorageAccess("wall-cabinet", "object", "shelf", loop).parts).toHaveLength(2);
  });

  it("matches each runtime mechanism to a real delivered GLB node, with compression intact", () => {
    for (const [assetId, rig] of Object.entries(rigs)) {
      const buffer = readFileSync(`public/models/hero/${assetId}.glb`);
      const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString());
      const parts = gltf.nodes.flatMap((node: { extras?: { storageMechanism?: unknown } }) =>
        node.extras?.storageMechanism ? [node.extras.storageMechanism] : [],
      );
      expect(JSON.parse(JSON.stringify(parts))).toEqual(rig.parts);
      expect(new Set(rig.parts.map((part) => part.id)).size).toBe(parts.length);
      expect(gltf.extensionsUsed).toContain("KHR_draco_mesh_compression");
    }
  });

  it("uses private transform clones, opens away from the face, and restores exactly", () => {
    const source = new THREE.Group();
    for (const mechanism of rigs["wall-cabinet"].parts) {
      const pivot = new THREE.Group();
      pivot.userData.storageMechanism = mechanism;
      const tip = new THREE.Object3D();
      tip.position.x = mechanism.angle < 0 ? 0.4 : -0.4;
      pivot.add(tip);
      source.add(pivot);
    }
    const a = cloneStorageScene(source),
      b = cloneStorageScene(source);
    a.scene.rotation.y = 1.2;
    a.scene.position.y = 1.6;
    a.scene.scale.x = -1;
    for (const part of a.parts) {
      applyStoragePose(part, 1);
      expect(
        part.node.children[0].position.clone().applyQuaternion(part.node.quaternion).z,
      ).toBeGreaterThan(0.3);
      applyStoragePose(part, 0);
      expect(part.node.quaternion.equals(part.quaternion)).toBe(true);
      expect(part.node.position.equals(part.position)).toBe(true);
    }
    expect(b.parts.every((part) => part.node.quaternion.equals(new THREE.Quaternion()))).toBe(true);
    expect(source.children.every((part) => part.quaternion.equals(new THREE.Quaternion()))).toBe(
      true,
    );
  });
});
