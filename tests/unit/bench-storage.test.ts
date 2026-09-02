import { beforeEach, describe, expect, it } from "vitest";
import { createSeedProject } from "../../src/domain/seed";
import { useEditorStore } from "../../src/store/editor-store";
import { readFileSync } from "node:fs";
import { getAssetDefinition } from "../../src/domain/assets";
import { STORAGE_RIGS } from "../../src/domain/storage-access";

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

  it("closes both rotated runs of the corner bench without moving its storage", () => {
    const data = readFileSync("public/models/hero/corner-lab-bench.glb");
    const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
    const root = gltf.nodes.find(
      (n: { extras?: { asset_id?: string } }) => n.extras?.asset_id === "corner-lab-bench",
    );
    expect(root.extras.corner_gable_joint_revision).toBe("closed-gable-r1");
    expect(root.extras.corner_gable_joint_runs).toBe(2);
  });

  it.each([
    "asymmetric-lab-bench",
    "lab-bench",
    "center-island-bench",
    "island-bench-service-bridge",
    "lab-bench-sink",
    "lab-bench-overhead",
    "base-cabinet",
    "base-drawer-cabinet",
    "sink-cabinet",
    "tall-cabinet",
    "mobile-bench",
    "wall-cabinet",
    "computer-lab-bench",
    "mobile-drawer",
    "chemical-cabinet",
    "flammable-cabinet",
    "locker",
    "refrigerator-storage",
    "freezer-storage",
    "stainless-enclosed-basin",
  ])("%s closes the overlay-to-gable channel with fixed returns", (id) => {
    const data = readFileSync(`public/models/hero/${id}.glb`);
    const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
    const root = gltf.nodes.find(
      (n: { extras?: { asset_id?: string } }) => n.extras?.asset_id === id,
    );
    expect(root.extras.gable_joint_revision).toBe("closed-gable-r1");
    const records = root.extras.gable_joint_records;
    expect(records.length).toBeGreaterThanOrEqual(2);
    for (const joint of records) {
      expect(joint.fronts.length).toBeGreaterThan(0);
      expect(joint.overlayClearance).toBeCloseTo(0.002);
      expect(joint.faceSetback).toBeCloseTo(0.005);
      expect(joint.fixedPanelOverlap).toBeGreaterThan(0);
      expect(joint.frontEdgeOverlap).toBeGreaterThan(0);
      expect(joint.upper).toBeGreaterThan(joint.lower);
    }
    if (id.includes("island"))
      expect([...new Set(records.map((r: { normal: number }) => r.normal))].sort()).toEqual([
        -1, 1,
      ]);
  });

  it("creates the standard Shimadzu bench drawer and cabinet anatomy", () => {
    const objectId = useEditorStore.getState().addAsset("lab-bench")!;
    const locations = locationsFor(objectId);

    expect(locations.filter((location) => location.type === "cabinet")).toHaveLength(1);
    expect(locations.filter((location) => location.type === "drawer")).toHaveLength(8);
    expect(locations.filter((location) => location.type === "compartment")).toHaveLength(1);
    expect(locations.filter((location) => location.type === "shelf")).toHaveLength(2);
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
    expect(locations.filter((location) => location.type === "shelf")).toHaveLength(14);
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
    expect(locations.filter((location) => location.type === "shelf")).toHaveLength(8);
  });

  it.each([
    "asymmetric-lab-bench",
    "lab-bench",
    "center-island-bench",
    "island-bench-service-bridge",
  ])("%s delivers genuinely recessed cabinets without moving the drawer datum", (id) => {
    const definition = getAssetDefinition(id);
    const constructionRevision =
      id === "center-island-bench" ? "recessed-casework-clean-top-r2" : "recessed-casework-r1";
    expect(definition.model3d?.revision).toBe(`${constructionRevision}-catalog-polish-r7`);
    const data = readFileSync(`public/models/hero/${id}.glb`);
    const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
    const root = gltf.nodes.find(
      (n: { extras?: { asset_id?: string } }) => n.extras?.asset_id === id,
    );
    expect(root.extras.cabinet_setback_m).toBe(0.075);
    expect(root.extras.revision).toBe(constructionRevision);
    const fixedJoints = root.extras.fixed_worktop_joints as {
      supportTop: number;
      bearingBottom: number;
      bearingTop: number;
      worktopBottom: number;
    }[];
    expect(fixedJoints).toHaveLength(
      id === "asymmetric-lab-bench" ? 0 : id === "lab-bench" ? 1 : 2,
    );
    for (const joint of fixedJoints) {
      expect(joint.bearingBottom).toBeLessThan(joint.supportTop);
      expect(joint.bearingTop).toBeGreaterThan(joint.worktopBottom);
      expect(joint.bearingTop - joint.bearingBottom).toBeLessThan(0.022);
    }
    const rig = STORAGE_RIGS[id];
    for (const door of rig.parts.filter((p) => p.kind === "hinge")) {
      const drawer = rig.parts.find((p) => p.kind === "drawer" && p.region.z * door.region.z > 0)!;
      const setbackMm =
        (Math.abs(drawer.region.z) - Math.abs(door.region.z)) * definition.defaultDimensions.depth;
      expect(setbackMm).toBeCloseTo(75, 1);
      // 90-degree opening avoids the neighboring forward drawer-bank side.
      expect(Math.abs(door.angle)).toBeCloseTo(Math.PI / 2, 5);
      const bay = rig.locations!.find(
        (l) => l.type === "compartment" && l.partIds.includes(door.id),
      )!;
      const shelves = rig.locations!.filter((l) => l.type === "shelf" && l.parentKey === bay.key);
      expect(shelves).toHaveLength(2);
      expect(shelves.every((s) => s.region.z * door.region.z > 0)).toBe(true);
    }
    // Opposite island faces must never reuse each other's physical shelves.
    const shelfKeys = rig.locations!.filter((l) => l.type === "shelf").map((l) => l.key);
    expect(new Set(shelfKeys).size).toBe(shelfKeys.length);
  });
});
