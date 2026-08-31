import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { LABORATORY_FLOOR_FINISHES } from "../../src/domain/laboratory-materials";
import { LABORATORY_WALL_FINISHES } from "../../src/domain/laboratory-wall-materials";
import { roomLightingLayout } from "../../src/domain/room-lighting";
import {
  floorSurfaceProfile,
  getRoomFloorMaterial,
  getRoomSurfaceMaps,
  getRoomWallMaterial,
  ROOM_SURFACE_PROFILES,
  ROOM_SURFACE_TEXTURE_SIZE,
  roomSurfaceBoxGeometry,
  wallSurfaceProfile,
} from "../../src/lib/room-surface-materials";

describe("room surface realism regression", () => {
  it("puts roughness in green, with no near-zero/mirror pixels", () => {
    for (const profile of ROOM_SURFACE_PROFILES) {
      const maps = getRoomSurfaceMaps(profile);
      expect(maps.roughnessMap.format).toBe(THREE.RGBAFormat);
      expect(maps.roughnessMap.colorSpace).toBe(THREE.NoColorSpace);
      const data = maps.roughnessMap.image.data as Uint8Array;
      let minimumRoughness = 255;
      let invalidMetalness = 0;
      let invalidAlpha = 0;
      for (let i = 0; i < data.length; i += 4) {
        minimumRoughness = Math.min(minimumRoughness, data[i + 1]);
        if (data[i + 2] !== 0) invalidMetalness += 1;
        if (data[i + 3] !== 255) invalidAlpha += 1;
      }
      // Inspect every texel without constructing ~440,000 assertion objects.
      // This keeps identical coverage within the default timeout on CI runners.
      expect(minimumRoughness, profile).toBeGreaterThanOrEqual(242);
      expect(invalidMetalness, profile).toBe(0);
      expect(invalidAlpha, profile).toBe(0);
    }
  });

  it("shares small mipmapped detail maps across all room finishes", () => {
    let bytes = 0;
    for (const profile of ROOM_SURFACE_PROFILES) {
      const maps = getRoomSurfaceMaps(profile);
      expect(getRoomSurfaceMaps(profile)).toBe(maps);
      for (const map of Object.values(maps)) {
        expect(map.image.width).toBe(ROOM_SURFACE_TEXTURE_SIZE);
        expect(map.image.height).toBe(128);
        expect(map.generateMipmaps).toBe(true);
        expect(map.minFilter).toBe(THREE.LinearMipmapLinearFilter);
        expect(map.wrapS).toBe(THREE.RepeatWrapping);
        expect(map.anisotropy).toBe(4);
        bytes += map.image.data!.byteLength;
      }
    }
    // All nine families resident, RGBA + full mip chains. Most rooms use two.
    expect((bytes * 4) / 3).toBeLessThan(2.5 * 1024 * 1024);
  });

  it("keeps floor colors and IDs while preventing mirror clearcoat", () => {
    for (const finish of LABORATORY_FLOOR_FINISHES) {
      const before = JSON.stringify(finish);
      const material = getRoomFloorMaterial(finish);
      expect(material).toBe(getRoomFloorMaterial(finish));
      expect(material.color.getHexString()).toBe(finish.color.slice(1));
      expect(material.metalness).toBe(0);
      expect((material.roughness * 242) / 255).toBeGreaterThan(0.47);
      expect(material.clearcoat).toBeLessThanOrEqual(0.06);
      expect(material.clearcoatRoughness).toBeGreaterThanOrEqual(0.5);
      expect(material.displacementMap).toBeNull();
      expect(material.map).toBe(getRoomSurfaceMaps(floorSurfaceProfile(finish)).map);
      expect(JSON.stringify(finish)).toBe(before);
    }
  });

  it("preserves painted versus exposed steel wall finishes and transparency", () => {
    for (const finish of LABORATORY_WALL_FINISHES) {
      const material = getRoomWallMaterial(finish);
      const transparent = getRoomWallMaterial(finish, 0.28);
      expect(material.color.getHexString()).toBe(finish.color.slice(1));
      expect(material.metalness).toBe(finish.id === "satin-stainless-steel" ? 0.78 : 0);
      expect(material.map).toBe(getRoomSurfaceMaps(wallSurfaceProfile(finish)).map);
      expect(transparent.map).toBe(material.map);
      expect(transparent.opacity).toBe(0.28);
      expect(transparent.depthWrite).toBe(false);
      expect(material.transparent).toBe(false);
      expect(material.opacity).toBe(1);
    }
  });

  it("uses metre-scale UVs and no subdivisions on walls and jambs", () => {
    for (const size of [
      [4, 3, 0.15],
      [0.2, 0.6, 0.15],
    ] as const) {
      const geometry = roomSurfaceBoxGeometry(size, [2, 1.5, 0]);
      expect(geometry.getAttribute("position").count).toBe(24);
      expect(geometry.index!.count / 3).toBe(12);
      const p = geometry.getAttribute("position");
      const n = geometry.getAttribute("normal");
      const uv = geometry.getAttribute("uv");
      for (let i = 0; i < p.count; i += 1) {
        if (Math.abs(n.getZ(i)) > 0.5) {
          expect(uv.getX(i)).toBeCloseTo(p.getX(i) + 2);
          expect(uv.getY(i)).toBeCloseTo(p.getY(i) + 1.5);
        }
      }
      geometry.dispose();
    }
  });

  it("fits shadows to large rooms and keeps contact shadows below cabinet height", () => {
    const small = roomLightingLayout(4000, 6000, 3000);
    const large = roomLightingLayout(20000, 12000, 4000);
    expect(large.shadowExtent).toBeGreaterThan(Math.hypot(20, 12) / 2);
    expect(large.shadowFar).toBeGreaterThan(large.keyPosition[1]);
    expect(large.shadowExtent).toBeGreaterThan(small.shadowExtent);
    expect(small.contactFar).toBeLessThan(0.8);
    expect(small.shadowIntensity).toBeLessThan(1);
  });
});
