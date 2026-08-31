import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { ASSET_BY_ID, getAssetDefinition, searchAssets } from "../../src/domain/assets";
import { createSeedProject } from "../../src/domain/seed";
import { STORAGE_RIGS, resolveStorageAccess } from "../../src/domain/storage-access";
import {
  hostOpeningAtPoint,
  isDoubleLeafDoor,
  projectPointToWall,
  resolveHostedOpening,
} from "../../src/domain/wall-openings";
import {
  chairFitsUnderDesk,
  objectsOverlap,
  snapChairToDesk,
  supportSurfaceElevation,
} from "../../src/domain/geometry";
import { useEditorStore } from "../../src/store/editor-store";
import type { SceneObject } from "../../src/domain/schema";

const ids = [
  "wide-lite-door",
  "single-transom-door",
  "double-transom-door",
  "double-egress-door",
  "integral-blind-window",
  "clerestory-window",
  "asymmetric-lab-bench",
  "institutional-sink-cabinet",
  "computer-lab-bench",
  "recirculating-chiller",
];

describe("additive July-reference asset pack", () => {
  beforeEach(() =>
    useEditorStore.setState({
      project: createSeedProject(),
      selectedIds: [],
      history: [],
      future: [],
      pendingAgentChange: null,
    }),
  );

  it.each(ids)(
    "delivers %s as a dimension-matched authored GLB with local shared finish maps",
    (id) => {
      const definition = ASSET_BY_ID.get(id)!;
      expect(definition).toBeDefined();
      expect(definition.model3d?.authoredDimensions).toEqual(definition.defaultDimensions);
      const data = readFileSync(`public/models/hero/${id}.glb`);
      const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
      expect(gltf.meshes.length).toBeGreaterThan(2);
      expect(gltf.materials.length).toBeGreaterThan(3);
      expect(gltf.cameras ?? []).toHaveLength(0);
      for (const image of gltf.images ?? []) {
        expect(image.uri).toMatch(
          /^\.\.\/\.\.\/materials\/pbr\/\w+-surface-r[45]-(normal|roughness)\.png$/,
        );
        expect(readFileSync(`public/models/hero/${image.uri}`).length).toBeGreaterThan(0);
      }
      expect(data.length).toBeLessThan(600_000);
      const root = gltf.nodes.find(
        (n: { extras?: { asset_id: string } }) => n.extras?.asset_id === id,
      );
      const dims = definition.defaultDimensions;
      for (const [index, mm] of [dims.width, dims.depth, dims.height].entries())
        expect(root.extras.authored_bounds_m[index]).toBeCloseTo(mm / 1000, 4);
      expect(root.extras.manufacturer_certified).toBe(false);
      const parts = gltf.nodes.flatMap((n: { extras?: { storageMechanism?: unknown } }) =>
        n.extras?.storageMechanism ? [n.extras.storageMechanism] : [],
      );
      expect(parts).toEqual(STORAGE_RIGS[id]?.parts ?? []);
    },
  );

  it("makes the new families discoverable without substituting old definitions", () => {
    expect(searchAssets("transom").map((a) => a.id)).toEqual(
      expect.arrayContaining(["single-transom-door", "double-transom-door"]),
    );
    expect(searchAssets("chiller").map((a) => a.id)).toContain("recirculating-chiller");
    expect(getAssetDefinition("computer-workstation").defaultDimensions.width).toBe(1400);
    expect(getAssetDefinition("computer-lab-bench").defaultDimensions.width).toBe(1600);
    expect(
      getAssetDefinition("lab-bench").storageTemplate?.filter((s) => s.type === "drawer"),
    ).toHaveLength(8);
  });

  it.each([
    ["asymmetric-lab-bench", 5, 2, 1, 2],
    ["institutional-sink-cabinet", 0, 3, 2, 2],
    ["computer-lab-bench", 3, 0, 0, 0],
  ] as const)("binds every physical storage opening in %s", (id, drawers, doors, bays, shelves) => {
    const rig = STORAGE_RIGS[id];
    expect(rig.parts.filter((p) => p.kind === "drawer")).toHaveLength(drawers);
    expect(rig.parts.filter((p) => p.kind === "hinge")).toHaveLength(doors);
    expect(rig.locations?.filter((s) => s.type === "compartment")).toHaveLength(bays);
    expect(rig.locations?.filter((s) => s.type === "shelf")).toHaveLength(shelves);
    const objectId = useEditorStore.getState().addAsset(id)!;
    const room = useEditorStore
      .getState()
      .project.rooms.find((r) => r.id === useEditorStore.getState().project.activeRoomId)!;
    const locations = room.scene.storageLocations.filter((s) => s.objectId === objectId);
    const before = JSON.stringify(room);
    for (const location of locations.filter((s) => s.parentId)) {
      const access = resolveStorageAccess(id, objectId, location.id, locations);
      expect(access.reason).toBeNull();
      expect(access.parts.length).toBeGreaterThan(0);
      expect(access.region).not.toBeNull();
    }
    expect(JSON.stringify(room)).toBe(before);
  });

  it.each(ids.slice(0, 6))("hosts %s on real walls, retaining total opening size", (id) => {
    const room = createSeedProject().rooms[0];
    const wall = room.scene.objects.find((o) => o.wall)!;
    const source = room.scene.objects.find((o) => o.objectType === "door")!;
    const definition = getAssetDefinition(id);
    const object: SceneObject = {
      ...source,
      id,
      assetDefinitionId: id,
      objectType: definition.objectType,
      dimensions: definition.defaultDimensions,
      opening: undefined,
    };
    const projection = projectPointToWall(wall, { x: 4000, y: 0 }, object.dimensions.width)!;
    const hosted = { ...object, ...hostOpeningAtPoint(object, projection) };
    expect(hosted.opening?.height).toBe(object.dimensions.height);
    expect(hosted.opening?.width).toBe(object.dimensions.width);
    expect(hosted.position.z).toBe(
      id === "clerestory-window" ? 2200 : definition.objectType === "window" ? 900 : 0,
    );
    expect(resolveHostedOpening(hosted, room.scene.objects)?.point).toEqual(projection.point);
    expect(isDoubleLeafDoor(id)).toBe(id.startsWith("double-"));
  });

  it.each([0, 90, 180, 35])(
    "snaps a seat into the real computer bench knee space at %s degrees",
    (rotation) => {
      const room = createSeedProject().rooms[0];
      const source = room.scene.objects.find((o) => o.objectType === "furniture")!;
      const desk: SceneObject = {
        ...source,
        id: "new-desk",
        assetDefinitionId: "computer-lab-bench",
        metadata: {},
        dimensions: getAssetDefinition("computer-lab-bench").defaultDimensions,
        position: { x: 3000, y: 3000, z: 0 },
        rotation: { x: 0, y: 0, z: rotation },
        flipHorizontal: false,
        flipVertical: false,
      };
      const a = (rotation * Math.PI) / 180;
      const chair: SceneObject = {
        ...desk,
        id: "seat",
        assetDefinitionId: "office-chair",
        dimensions: { width: 620, depth: 620, height: 980 },
        position: { x: 3000 - Math.sin(a) * 560, y: 3000 + Math.cos(a) * 560, z: 0 },
        rotation: { x: 0, y: 0, z: rotation + 180 },
      };
      room.scene.objects = [desk];
      const snapped = snapChairToDesk(room, chair);
      expect(snapped).not.toBe(chair);
      expect(chairFitsUnderDesk(desk, snapped)).toBe(true);
      expect(objectsOverlap(desk, snapped)).toBe(false);
      const atPedestal = {
        ...snapped,
        position: {
          x: desk.position.x + Math.cos(a) * 500 - Math.sin(a) * 540,
          y: desk.position.y + Math.sin(a) * 500 + Math.cos(a) * 540,
          z: 0,
        },
      };
      expect(chairFitsUnderDesk(desk, atPedestal)).toBe(false);
      expect(supportSurfaceElevation(desk)).toBe(800);
      desk.flipHorizontal = true;
      const mirrored = snapChairToDesk(room, chair);
      expect(chairFitsUnderDesk(desk, mirrored)).toBe(true);
      expect(
        (mirrored.position.x - desk.position.x) * Math.cos(a) +
          (mirrored.position.y - desk.position.y) * Math.sin(a),
      ).toBeCloseTo(208);
    },
  );
});
