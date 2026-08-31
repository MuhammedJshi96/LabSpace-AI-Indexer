import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { ASSET_CATALOG } from "../../src/domain/assets";
import { STORAGE_RIGS } from "../../src/domain/storage-access";
import { applyReviewedAuthoredFinish } from "../../src/lib/authored-finish";
import stableBindings from "../fixtures/catalog-storage-bindings.json";

const documents = new Map<string, ReturnType<typeof JSON.parse>>();
function delivered(id: string) {
  if (documents.has(id)) return documents.get(id);
  const data = readFileSync(`public/models/hero/${id}.glb`);
  const doc = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
  documents.set(id, doc);
  return doc;
}

describe("reviewed full-catalog polish", () => {
  const assets = ASSET_CATALOG.filter((a) => a.model3d);
  it("covers every authored catalog family with revision-keyed, explicit PBR decisions", () => {
    expect(assets).toHaveLength(104);
    expect(readdirSync("public/models/hero").filter((n) => n.endsWith(".glb"))).toHaveLength(104);
    for (const asset of assets) {
      expect(asset.model3d!.revision).toContain("catalog-polish-r7");
      const doc = delivered(asset.id);
      expect(doc.asset.extras.labspace_finish_revision).toBe("catalog-polish-r7");
      for (const m of doc.materials) {
        expect(m.extras.labspace_finish_revision).toBe("catalog-polish-r7");
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

  it("uses ten small shared microfinish maps, not per-model photo overlays", () => {
    const uris = new Set<string>();
    for (const asset of assets) {
      const doc = delivered(asset.id);
      for (const mesh of doc.meshes)
        for (const primitive of mesh.primitives) {
          if (doc.materials[primitive.material].extras.labspace_surface === "micrograin")
            expect(primitive.attributes.TEXCOORD_0, `${asset.id} / ${mesh.name}`).toBeDefined();
        }
      for (const m of doc.materials) {
        if (!m.extras.labspace_surface) continue;
        expect(m.extras.labspace_surface_revision).toBe(
          m.extras.labspace_surface === "micrograin" ? "surface-r5" : "surface-r4",
        );
        for (const info of [m.normalTexture, m.pbrMetallicRoughness.metallicRoughnessTexture]) {
          const texture = doc.textures[info.index];
          const uri = doc.images[texture.source].uri;
          expect(uri).toMatch(
            /^\.\.\/\.\.\/materials\/pbr\/\w+-surface-r[45]-(normal|roughness)\.png$/,
          );
          if (uris.has(uri)) continue;
          uris.add(uri);
          const png = readFileSync(resolve("public/models/hero", uri));
          expect(png.readUInt32BE(16)).toBe(128);
          expect(png.readUInt32BE(20)).toBe(128);
        }
      }
    }
    expect(uris.size).toBe(10);
    const bytes = [...uris].reduce(
      (sum, uri) => sum + statSync(resolve("public/models/hero", uri)).size,
      0,
    );
    expect(bytes).toBeLessThan(250_000);
  });

  it("pools immutable microfinish maps across separately loaded models", () => {
    const make = () => {
      const m = new THREE.MeshStandardMaterial();
      m.userData = {
        labspace_finish_revision: "catalog-polish-r7",
        labspace_surface_revision: "surface-r4",
        labspace_surface: "brushed",
      };
      m.normalMap = new THREE.Texture();
      m.roughnessMap = new THREE.Texture();
      return m;
    };
    const a = make(),
      b = make();
    applyReviewedAuthoredFinish(a);
    applyReviewedAuthoredFinish(b);
    expect(a.normalMap).toBe(b.normalMap);
    expect(a.roughnessMap).toBe(b.roughnessMap);
    expect(a.metalnessMap).toBe(a.roughnessMap);
  });

  it("restores micrograin only to opaque white/light neutral coated surfaces", () => {
    const textured = new Set<string>();
    for (const asset of assets) {
      const doc = delivered(asset.id);
      for (const m of doc.materials) {
        if (m.extras.labspace_surface !== "micrograin") continue;
        textured.add(asset.id);
        const pbr = m.pbrMetallicRoughness;
        expect(pbr.metallicFactor).toBe(0);
        expect(Math.min(...pbr.baseColorFactor.slice(0, 3))).toBeGreaterThanOrEqual(0.32);
        expect(m.extras.labspace_visible_finish).not.toBe("black-handle");
        expect(m.extensions?.KHR_materials_transmission?.transmissionFactor ?? 0).toBe(0);
        expect(m.normalTexture.extensions.KHR_texture_transform.scale).toEqual([8, 8]);
        expect(pbr.baseColorTexture).toBeUndefined();
      }
    }
    expect(textured.size).toBeGreaterThan(35);
    expect(textured.has("fume-hood")).toBe(true);
    expect(textured.has("laminar-flow")).toBe(true);
  });

  it.each(["fume-hood", "biosafety-cabinet", "laminar-flow"])(
    "%s has a connected enclosure revision",
    (id) => {
      const root = delivered(id).nodes.find(
        (n: { extras?: { asset_id?: string } }) => n.extras?.asset_id === id,
      );
      expect(root.extras.construction_revision).toBe("connected-enclosure-r4");
    },
  );

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

  it("never gives a painted or polymer surface a bare-metal shader", () => {
    for (const asset of assets) {
      for (const material of delivered(asset.id).materials) {
        if (
          !/paint|powder coat|enamel|polymer|polyamide|laminate|vinyl|rubber|phenolic/i.test(
            material.name,
          )
        )
          continue;
        expect(material.pbrMetallicRoughness.metallicFactor, `${asset.id}/${material.name}`).toBe(
          0,
        );
        expect(material.extras.labspace_surface, `${asset.id}/${material.name}`).not.toBe(
          "brushed",
        );
      }
    }
  });

  it("reviews every asset for distinct matte-black handles at part level", () => {
    let handledAssets = 0;
    for (const asset of assets) {
      const doc = delivered(asset.id);
      const root = doc.nodes.find(
        (n: { extras?: { handle_finish_revision?: string } }) =>
          n.extras?.handle_finish_revision === "black-handles-r1",
      );
      expect(root, asset.id).toBeTruthy();
      const materials = doc.materials.filter(
        (m: { extras?: { labspace_visible_finish?: string } }) =>
          m.extras?.labspace_visible_finish === "black-handle",
      );
      if (!root.extras.black_handle_parts.length) continue;
      handledAssets++;
      expect(materials.length, asset.id).toBeGreaterThan(0);
      for (const m of materials) {
        expect(m.pbrMetallicRoughness.metallicFactor).toBe(0);
        expect(Math.max(...m.pbrMetallicRoughness.baseColorFactor.slice(0, 3))).toBeLessThan(0.015);
        expect(m.extras.labspace_surface).toBe("polymer");
      }
    }
    expect(handledAssets).toBeGreaterThan(35);
  });

  it.each([
    "lab-bench",
    "center-island-bench",
    "asymmetric-lab-bench",
    "corner-lab-bench",
    "island-bench-service-bridge",
  ])("%s separates laminate panels and coated pulls from actual metal hardware", (id) => {
    const materials = delivered(id).materials;
    for (const finish of ["laminate", "black-handle"]) {
      const material = materials.find(
        (m: { extras?: { labspace_visible_finish?: string } }) =>
          m.extras?.labspace_visible_finish === finish,
      );
      expect(material, `${id}/${finish}`).toBeTruthy();
      expect(material.pbrMetallicRoughness.metallicFactor).toBe(0);
      expect(material.pbrMetallicRoughness.roughnessFactor).toBeGreaterThanOrEqual(0.4);
    }
    // The corner model contains no separately authored exposed hardware. Do
    // not invent a metal part just to satisfy a material-family expectation.
    if (id !== "corner-lab-bench")
      expect(
        materials.some(
          (m: { name: string; pbrMetallicRoughness: { metallicFactor: number } }) =>
            /Zinc|stainless/i.test(m.name) && m.pbrMetallicRoughness.metallicFactor > 0.8,
        ),
      ).toBe(true);
  });

  it("uses the supplied grey/charcoal bench palette rather than bright white", () => {
    const materials = delivered("lab-bench").materials;
    const face = materials.find(
      (m: { extras?: { labspace_visible_finish?: string } }) =>
        m.extras?.labspace_visible_finish === "laminate",
    );
    const top = materials.find(
      (m: { name: string }) => m.name === "Black phenolic worktop - satin",
    );
    expect(Math.max(...face.pbrMetallicRoughness.baseColorFactor.slice(0, 3))).toBeLessThan(0.5);
    expect(top.pbrMetallicRoughness.baseColorFactor[2]).toBeGreaterThan(
      top.pbrMetallicRoughness.baseColorFactor[1],
    );
    expect(
      materials.some(
        (m: { extras?: { labspace_visible_finish?: string } }) =>
          m.extras?.labspace_visible_finish === "bench-plinth",
      ),
    ).toBe(true);
  });

  it.each([
    "single-door",
    "double-door",
    "wide-lite-door",
    "single-transom-door",
    "double-transom-door",
  ])("%s uses painted leaves and polyamide grips, not silver panels", (id) => {
    const materials = delivered(id).materials;
    for (const finish of ["door-paint", "black-handle"]) {
      const material = materials.find(
        (m: { extras?: { labspace_visible_finish?: string } }) =>
          m.extras?.labspace_visible_finish === finish,
      );
      expect(material, `${id}/${finish}`).toBeTruthy();
      expect(material.pbrMetallicRoughness.metallicFactor).toBe(0);
    }
  });

  it("keeps the actual stainless sink metal while its cabinet pull is coated", () => {
    const materials = delivered("institutional-sink-cabinet").materials;
    const steel = materials.find(
      (m: { name: string }) => m.name === "Wash assembly brushed 304 steel",
    );
    const pull = materials.find(
      (m: { extras?: { labspace_visible_finish?: string } }) =>
        m.extras?.labspace_visible_finish === "black-handle",
    );
    expect(steel.pbrMetallicRoughness.metallicFactor).toBe(1);
    expect(pull.pbrMetallicRoughness.metallicFactor).toBe(0);
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
