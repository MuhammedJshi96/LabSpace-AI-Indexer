import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  LABORATORY_MATERIAL_TEXTURES,
  configureLaboratoryMaterialTexture,
  getLaboratoryMaterialTexture,
} from "../../src/lib/laboratory-material-textures";

describe("laboratory material textures", () => {
  it("configures color maps for repeated, filtered rendering", () => {
    const texture = configureLaboratoryMaterialTexture(new THREE.Texture(), "stainless", {
      repeat: [2.5, 3],
      anisotropy: 16,
      maxAnisotropy: 8,
    });

    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texture.mapping).toBe(THREE.UVMapping);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.wrapT).toBe(THREE.RepeatWrapping);
    expect(texture.repeat.toArray()).toEqual([2.5, 3]);
    expect(texture.anisotropy).toBe(8);
    expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(texture.magFilter).toBe(THREE.LinearFilter);
    expect(texture.generateMipmaps).toBe(true);
  });

  it("lists reusable public textures with their source provenance", () => {
    expect(LABORATORY_MATERIAL_TEXTURES).toEqual({
      epoxy: {
        url: "/materials/epoxy-floor-room809.jpg",
        repeat: [4, 4],
        provenance: "Kyushu University Room 809 reference photograph",
      },
      vinyl: {
        url: "/materials/epoxy-floor-room809.jpg",
        repeat: [3, 3],
        provenance:
          "Kyushu University Room 809 floor reference, color-tinted for welded laboratory vinyl",
      },
      phenolic: {
        url: "/materials/phenolic-black-room809.jpg",
        repeat: [1, 1],
        provenance: "Kyushu University Room 809 reference photograph",
      },
      stainless: {
        url: "/materials/brushed-stainless-room809.jpg",
        repeat: [1, 1],
        provenance: "Kyushu University Room 809 reference photograph",
      },
      powder: {
        url: "/materials/powder-coat-gray-room809.jpg",
        repeat: [1, 1],
        provenance: "Kyushu University Room 809 reference photograph",
      },
    });
  });

  it("falls back without touching the loader outside a browser", () => {
    expect(getLaboratoryMaterialTexture("phenolic")).toBeUndefined();
    expect(getLaboratoryMaterialTexture("glass")).toBeUndefined();
  });
});
