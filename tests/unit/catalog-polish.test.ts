import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { ASSET_CATALOG } from "../../src/domain/assets";
import { STORAGE_RIGS } from "../../src/domain/storage-access";
import { applyReviewedAuthoredFinish } from "../../src/lib/authored-finish";
import stableBindings from "../fixtures/catalog-storage-bindings.json";

function delivered(id: string) {
  const data = readFileSync(`public/models/hero/${id}.glb`);
  return JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
}

describe("reviewed full-catalog polish", () => {
  const assets = ASSET_CATALOG.filter((a) => a.model3d);
  it("covers every authored catalog family with revision-keyed, explicit PBR decisions", () => {
    expect(assets).toHaveLength(104);
    expect(readdirSync("public/models/hero").filter((n) => n.endsWith(".glb"))).toHaveLength(104);
    for (const asset of assets) {
      expect(asset.model3d!.revision).toContain("catalog-polish-r3");
      const doc = delivered(asset.id);
      expect(doc.asset.extras.labspace_finish_revision).toBe("catalog-polish-r3");
      for (const m of doc.materials) {
        expect(m.extras.labspace_finish_revision).toBe("catalog-polish-r3");
        expect(m.extras.labspace_finish_action).toBeTruthy();
        const pbr = m.pbrMetallicRoughness;
        for (const value of pbr.baseColorFactor ?? [1, 1, 1, 1]) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
        expect(pbr.roughnessFactor ?? 1).toBeGreaterThanOrEqual(0);
        expect(pbr.roughnessFactor ?? 1).toBeLessThanOrEqual(1);
      }
    }
  });

  it("does not repaint reviewed materials or replace their textures at runtime", () => {
    const m = new THREE.MeshPhysicalMaterial({
      color: "#efefea",
      metalness: 0.72,
      roughness: 0.34,
      transmission: 0.3,
    });
    m.name = "Brushed stainless steel";
    m.userData = { labspace_finish_revision: "catalog-polish-r3", labspace_env_intensity: 1 };
    m.map = new THREE.Texture();
    const color = m.color.clone(),
      map = m.map;
    expect(applyReviewedAuthoredFinish(m)).toBe(true);
    expect(m.color.equals(color)).toBe(true);
    expect(m.map).toBe(map);
    expect(m.metalness).toBe(0.72);
    expect(m.roughness).toBe(0.34);
    expect(m.transmission).toBe(0.3);
    expect(m.bumpMap).toBeNull();
    expect(applyReviewedAuthoredFinish(new THREE.MeshStandardMaterial())).toBe(false);
  });

  it("retains deliberate black polymer, safety red and yellow, and black phenolic", () => {
    const chair = delivered("office-chair").materials.find(
      (m: { name: string }) => m.name === "Black engineering polymer",
    );
    expect(chair.pbrMetallicRoughness.baseColorFactor[0]).toBeLessThan(0.025);
    const red = delivered("fire-extinguisher").materials.find(
      (m: { name: string }) => m.name === "Safety red powder coat",
    );
    expect(red.extras.labspace_finish_action).toBe("retain-authored-finish");
    const yellow = delivered("flammable-cabinet").materials.find(
      (m: { name: string }) => m.name === "Safety cabinet yellow",
    );
    expect(yellow.extras.labspace_finish_action).toBe("retain-authored-finish");
    const top = delivered("lab-bench").materials.find(
      (m: { name: string }) => m.name === "Black phenolic worktop - satin",
    );
    expect(Math.max(...top.pbrMetallicRoughness.baseColorFactor.slice(0, 3))).toBeLessThan(0.02);
  });

  it("keeps every authored drawer/door assembly bound to its existing storage rig", () => {
    for (const [id, rig] of Object.entries(STORAGE_RIGS)) {
      const parts = delivered(id).nodes.flatMap((n: { extras?: { storageMechanism?: unknown } }) =>
        n.extras?.storageMechanism ? [n.extras.storageMechanism] : [],
      );
      expect(parts, id).toEqual(rig.parts);
      expect(new Set(rig.parts.map((p) => p.id)).size, id).toBe(rig.parts.length);
    }
  });

  it("preserves all 31 existing storage identity graphs through construction changes", () => {
    expect(Object.keys(STORAGE_RIGS)).toEqual(Object.keys(stableBindings));
    for (const [id, rig] of Object.entries(STORAGE_RIGS)) {
      expect(
        {
          parts: rig.parts.map(({ id, kind, bay }) => ({ id, kind, bay })),
          locations: (rig.locations ?? []).map(({ key, type, parentKey, partIds }) => ({
            key,
            type,
            parentKey,
            partIds,
          })),
        },
        id,
      ).toEqual(stableBindings[id as keyof typeof stableBindings]);
    }
  });

  it("uses identical shared role finishes within and across each reviewed family", () => {
    const roles = new Map<string, unknown>();
    const families = new Set<string>();
    for (const asset of assets) {
      const doc = delivered(asset.id);
      const family = doc.asset.extras.labspace_finish_family;
      expect(family, asset.id).toBeTruthy();
      families.add(family);
      for (const material of doc.materials) {
        expect(material.extras.labspace_finish_family).toBe(family);
        const role = material.extras.labspace_finish_role;
        if (!role) continue;
        const pbr = material.pbrMetallicRoughness;
        const finish = [pbr.baseColorFactor, pbr.metallicFactor, pbr.roughnessFactor];
        if (roles.has(role))
          expect(finish, `${asset.id}/${material.name}`).toEqual(roles.get(role));
        else roles.set(role, finish);
      }
    }
    for (const family of [
      "benches",
      "sinks",
      "lockers",
      "bins",
      "seating",
      "instruments",
      "architecture",
    ])
      expect(families.has(family)).toBe(true);
    expect(roles.size).toBeGreaterThanOrEqual(5);
  });

  it.each(["institutional-sink-cabinet", "stainless-wash-basin"])(
    "%s uses continuous formed sink construction",
    (id) => {
      const root = delivered(id).nodes.find(
        (n: { extras?: { asset_id?: string } }) => n.extras?.asset_id === id,
      );
      expect(root.extras.construction_revision).toBe("formed-sink-r2");
    },
  );

  it.each([
    "chemical-cabinet",
    "flammable-cabinet",
    "locker",
    "mobile-drawer",
    "refrigerator-storage",
    "freezer-storage",
    "stainless-enclosed-basin",
  ])("%s retains a fixed front frame when hollowed for storage", (id) => {
    const root = delivered(id).nodes.find(
      (n: { extras?: { asset_id?: string } }) => n.extras?.asset_id === id,
    );
    expect(root.extras.closed_face_frame_revision).toBe("catalog-joinery-r2");
  });

  it.each(["lab-bench-sink", "lab-bench-overhead", "stainless-enclosed-basin"])(
    "%s closes the fixed worktop gap with an open bearing collar",
    (id) => {
      const root = delivered(id).nodes.find(
        (n: { extras?: { asset_id?: string } }) => n.extras?.asset_id === id,
      );
      expect(root.extras.fixed_joint_revision).toBe("catalog-polish-r1");
      expect(root.extras.fixed_worktop_gap_closed_m).toBeGreaterThan(0.009);
      expect(root.extras.fixed_worktop_gap_closed_m).toBeLessThan(0.06);
    },
  );
});
