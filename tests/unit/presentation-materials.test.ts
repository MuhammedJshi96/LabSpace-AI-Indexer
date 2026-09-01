import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  acquirePresentationMaterial,
  bindPresentationMaterials,
  isClearGlazing,
  realisticSurfaceMaps,
} from "../../src/lib/presentation-materials";

function coated(surface = "micrograin") {
  const m = new THREE.MeshStandardMaterial({ color: "#989394", roughness: 0.46, metalness: 0 });
  m.userData = { labspace_surface: surface };
  return m;
}

describe("local realistic material presentation", () => {
  it("corrects clear glazing in every tier without modifying the source", () => {
    const glass = new THREE.MeshPhysicalMaterial({
      color: "#98babb",
      roughness: 0.4,
      opacity: 0.34,
      transmission: 0.72,
    });
    glass.name = "Laminated laboratory safety glass";
    for (const quality of ["low", "balanced", "high"] as const) {
      const acquired = acquirePresentationMaterial(glass, quality);
      const m = acquired.material as THREE.MeshPhysicalMaterial;
      expect(m).not.toBe(glass);
      expect(m.roughness).toBeLessThan(0.07);
      expect(m.transmission).toBe(0);
      expect(m.opacity).toBe(0.14);
      expect(m.color.b).toBeGreaterThan(m.color.r);
      expect(m.transparent).toBe(true);
      expect(m.forceSinglePass).toBe(true);
      expect(m.depthWrite).toBe(false);
      expect(m.normalMap).toBeNull();
      expect(m.metalness).toBe(0);
      expect(glass.roughness).toBe(0.4);
      expect(glass.opacity).toBe(0.34);
      acquired.release();
    }
  });

  it("keeps physical transmission for glassware instead of making it invisible", () => {
    const source = new THREE.MeshPhysicalMaterial({ opacity: 0.3, transmission: 0.9 });
    source.name = "Borosilicate process glass";
    const acquired = acquirePresentationMaterial(source, "high");
    const material = acquired.material as THREE.MeshPhysicalMaterial;
    expect(material.transmission).toBe(0.985);
    expect(material.opacity).toBe(1);
    expect(material.transparent).toBe(false);
    expect(material.ior).toBe(1.474);
    acquired.release();
  });

  it("binds only instance meshes, suppresses pane shadows and restores source bindings", () => {
    const glass = new THREE.MeshPhysicalMaterial();
    glass.name = "Low-iron cabinet glass";
    const panel = coated();
    const pane = new THREE.Mesh(new THREE.BoxGeometry(), glass);
    const casework = new THREE.Mesh(new THREE.BoxGeometry(), panel);
    const release = bindPresentationMaterials(
      [
        { mesh: pane, materials: [glass], multiple: false },
        { mesh: casework, materials: [panel], multiple: false },
      ],
      "high",
    );
    expect(pane.material).not.toBe(glass);
    expect(pane.castShadow).toBe(false);
    expect(pane.receiveShadow).toBe(false);
    expect(casework.castShadow).toBe(true);
    expect(casework.receiveShadow).toBe(true);
    release();
    expect(pane.material).toBe(glass);
    expect(casework.material).toBe(panel);
    pane.geometry.dispose();
    casework.geometry.dispose();
  });

  it("does not clear frosted glazing, instrument displays, optical coatings or liquids", () => {
    for (const name of [
      "Frosted safety glass",
      "Ground glass joint",
      "Smoked controller glass",
      "Amber solvent bottle glass",
      "Coated optical glass",
      "Black glass ceramic work surface",
    ]) {
      const source = new THREE.MeshPhysicalMaterial();
      source.name = name;
      expect(isClearGlazing(source), name).toBe(false);
      expect(acquirePresentationMaterial(source, "high").material, name).toBe(source);
    }
    const source = new THREE.MeshPhysicalMaterial();
    source.name = "Low-iron cabinet glass.001";
    expect(isClearGlazing(source)).toBe(true);
  });

  it("keeps base finishes in Low/Balanced and adds dielectric detail only in High", () => {
    const source = coated();
    expect(acquirePresentationMaterial(source, "balanced").material).toBe(source);
    expect(acquirePresentationMaterial(source, "low").material).toBe(source);
    const high = acquirePresentationMaterial(source, "high");
    const material = high.material as THREE.MeshPhysicalMaterial;
    expect(material.color.equals(source.color)).toBe(true);
    expect(material.map).toBe(source.map);
    expect(material.normalMap).toBe(realisticSurfaceMaps("coating").normalMap);
    expect(material.metalness).toBe(0);
    expect(material.clearcoat).toBe(0);
    expect(material.anisotropy).toBe(0);
    expect(source.normalMap).toBeNull();
    expect(source.roughness).toBe(0.46);
    high.release();
  });

  it("uses directional response only on bare metal and keeps handles matte black", () => {
    const steel = coated("brushed");
    steel.metalness = 1;
    const high = acquirePresentationMaterial(steel, "high");
    expect((high.material as THREE.MeshPhysicalMaterial).anisotropy).toBe(0);
    expect((high.material as THREE.MeshPhysicalMaterial).normalMap).toBe(
      realisticSurfaceMaps("brushed").normalMap,
    );
    const handle = coated("polymer");
    handle.color.set("#080808");
    handle.roughness = 0.7;
    const pull = acquirePresentationMaterial(handle, "high");
    expect((pull.material as THREE.MeshPhysicalMaterial).color.getHexString()).toBe("080808");
    expect((pull.material as THREE.MeshPhysicalMaterial).roughness).toBeGreaterThanOrEqual(0.7);
    expect((pull.material as THREE.MeshPhysicalMaterial).metalness).toBe(0);
    high.release();
    pull.release();
  });

  it("shares variants and disposes them only after the final consumer leaves", () => {
    const source = coated();
    const a = acquirePresentationMaterial(source, "high");
    const b = acquirePresentationMaterial(source, "high");
    expect(a.material).toBe(b.material);
    let disposals = 0;
    a.material.addEventListener("dispose", () => disposals++);
    a.release();
    a.release();
    expect(disposals).toBe(0);
    b.release();
    expect(disposals).toBe(1);
    const c = acquirePresentationMaterial(source, "high");
    expect(c.material).not.toBe(a.material);
    c.release();
  });

  it("textures only explicit cabinet coating roles and preserves baseline, paint and glazing", () => {
    const source = coated();
    Object.assign(source.userData, {
      labspace_finish_family: "storage",
      labspace_finish_role: "face",
    });
    const high = acquirePresentationMaterial(source, "high");
    const m = high.material as THREE.MeshPhysicalMaterial;
    expect(m.normalMap).toBe(realisticSurfaceMaps("casework").normalMap);
    expect(m.color.equals(source.color)).toBe(true);
    expect(m.metalness).toBe(0);
    expect(acquirePresentationMaterial(source, "balanced").material).toBe(source);
    high.release();
  });
  it("bounds all High finish maps below 4 MiB and never encodes mirror roughness", () => {
    let bytes = 0;
    for (const kind of ["coating", "casework", "brushed", "phenolic", "polymer"] as const) {
      const maps = realisticSurfaceMaps(kind);
      expect(maps).toBe(realisticSurfaceMaps(kind));
      for (const map of Object.values(maps)) {
        expect(map.image.width).toBe(256);
        expect(map.colorSpace).toBe(THREE.NoColorSpace);
        expect(map.generateMipmaps).toBe(true);
        bytes += map.image.data!.byteLength;
      }
      const data = maps.roughnessMap.image.data as Uint8Array;
      let minimum = 255;
      for (let i = 1; i < data.length; i += 4) minimum = Math.min(minimum, data[i]);
      expect(minimum).toBeGreaterThanOrEqual(216);
    }
    expect((bytes * 4) / 3).toBeLessThan(4 * 1024 * 1024);
  });
});
