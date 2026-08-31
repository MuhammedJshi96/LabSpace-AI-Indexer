import * as THREE from "three";
import type { LaboratoryFloorFinish } from "../domain/laboratory-materials";
import type { LaboratoryWallFinish } from "../domain/laboratory-wall-materials";

export type RoomSurfaceProfile =
  "resin" | "concrete" | "stone" | "terrazzo" | "oak" | "panel" | "plaster" | "tile" | "steel";

export const ROOM_SURFACE_TEXTURE_SIZE = 128;
export const ROOM_SURFACE_PROFILES: readonly RoomSurfaceProfile[] = [
  "resin",
  "concrete",
  "stone",
  "terrazzo",
  "oak",
  "panel",
  "plaster",
  "tile",
  "steel",
];

type SurfaceMaps = {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
};
const mapCache = new Map<RoomSurfaceProfile, SurfaceMaps>();
const materialCache = new Map<string, THREE.MeshPhysicalMaterial>();

function noise(x: number, y: number, salt = 0) {
  let n = Math.imul(x + 177, 374761393) ^ Math.imul(y + 331, 668265263) ^ salt;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function texture(data: Uint8Array, label: string, color: boolean, repeat: [number, number]) {
  // Roughness is sampled from G by Three.js. RedFormat has G=0 and turns
  // even a satin floor into a mirror. Use explicit RGBA for every shared map.
  const result = new THREE.DataTexture(
    data,
    ROOM_SURFACE_TEXTURE_SIZE,
    ROOM_SURFACE_TEXTURE_SIZE,
    THREE.RGBAFormat,
  );
  result.name = `room-surface-v1:${label}`;
  result.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  result.wrapS = result.wrapT = THREE.RepeatWrapping;
  result.repeat.set(...repeat);
  result.minFilter = THREE.LinearMipmapLinearFilter;
  result.magFilter = THREE.LinearFilter;
  result.anisotropy = 4;
  result.generateMipmaps = true;
  result.needsUpdate = true;
  return result;
}

/** Small, seamless, illumination-free maps. UVs are in metres, not stretched
 * once per wall/room. Every instance of a finish shares these immutable maps.
 * Fine coating grain is normal detail; there is no displaced/dense mesh. */
export function getRoomSurfaceMaps(profile: RoomSurfaceProfile): SurfaceMaps {
  const cached = mapCache.get(profile);
  if (cached) return cached;
  const size = ROOM_SURFACE_TEXTURE_SIZE;
  const albedo = new Uint8Array(size * size * 4);
  const normal = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const heights = new Float32Array(size * size);
  const tau = Math.PI * 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      const fine = noise(x, y, 97);
      const cloud =
        Math.sin((x / size) * tau + Math.sin((y / size) * tau)) * Math.cos((y / size) * tau * 2);
      let value = 248 + (fine - 0.5) * 6;
      let height = fine * 0.12;
      if (profile === "resin") value = 244 + (fine - 0.5) * 12;
      if (profile === "concrete" || profile === "plaster") {
        value = 246 + cloud * 3 + (fine - 0.5) * 8;
        height = fine * 0.35;
      }
      if (profile === "panel") {
        // Shallow crossed coating grain, not visible wire cloth or white paint.
        height += (Math.sin((x * tau) / 4) + Math.cos((y * tau) / 4)) * 0.045;
      }
      if (profile === "stone") value = 245 + cloud * 5 + (fine - 0.5) * 5;
      if (profile === "terrazzo") {
        const chip = noise(Math.floor(x / 2), Math.floor(y / 2), 59);
        value = chip > 0.92 ? 189 + fine * 32 : chip < 0.06 ? 252 : 240 + (fine - 0.5) * 7;
      }
      if (profile === "oak") {
        const grain = Math.sin((y * tau) / 8 + Math.sin((x / size) * tau) * 1.4);
        value = 236 + grain * 10 + cloud * 3 + (fine - 0.5) * 4;
        height = grain * 0.08 + fine * 0.05;
      }
      if (profile === "tile") {
        const seam = x === 0 || y === 0;
        value = seam ? 209 : 250 + (fine - 0.5) * 2;
      }
      if (profile === "steel") {
        value = 249 + (noise(0, y, 45) - 0.5) * 7;
        height = noise(0, y, 45) * 0.16 + fine * 0.01;
      }
      const byte = Math.round(Math.max(0, Math.min(255, value)));
      albedo.set([byte, byte, byte, 255], i * 4);
      // Keep the multiplier near one. Detail must not silently halve the
      // finish's specified roughness (and expose the HDR's bright softboxes).
      roughness.set([255, Math.round(242 + fine * 13), 0, 255], i * 4);
      heights[i] = height;
    }
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const at = (u: number, v: number) =>
        heights[((v + size) % size) * size + ((u + size) % size)];
      const dx = at(x - 1, y) - at(x + 1, y);
      const dy = at(x, y - 1) - at(x, y + 1);
      const length = Math.hypot(dx, dy, 1);
      normal.set(
        [
          Math.round(128 + (dx / length) * 127),
          Math.round(128 + (dy / length) * 127),
          Math.round(128 + 127 / length),
          255,
        ],
        (y * size + x) * 4,
      );
    }
  }
  const macroRepeat: [number, number] =
    profile === "oak"
      ? [1 / 1.44, 1 / 0.72]
      : profile === "tile"
        ? [1 / 0.3, 1 / 0.3]
        : profile === "terrazzo"
          ? [2, 2]
          : [1, 1];
  const microRepeat: [number, number] =
    profile === "plaster" || profile === "concrete" ? [4, 4] : [12.5, 12.5];
  const maps = {
    map: texture(albedo, `${profile}:albedo`, true, macroRepeat),
    normalMap: texture(normal, `${profile}:normal`, false, microRepeat),
    roughnessMap: texture(roughness, `${profile}:roughness`, false, microRepeat),
  };
  mapCache.set(profile, maps);
  return maps;
}

export function floorSurfaceProfile(finish: LaboratoryFloorFinish): RoomSurfaceProfile {
  if (finish.id.includes("terrazzo")) return "terrazzo";
  if (finish.textureKind === "oak") return "oak";
  if (finish.textureKind === "limestone") return "stone";
  if (finish.id === "sealed-concrete") return "concrete";
  return "resin";
}

export function wallSurfaceProfile(finish: LaboratoryWallFinish): RoomSurfaceProfile {
  if (finish.textureKind === "oak") return "oak";
  if (finish.textureKind === "limestone") return "stone";
  if (finish.id === "satin-stainless-steel") return "steel";
  if (finish.id === "white-painted-masonry") return "plaster";
  if (finish.id === "light-ceramic-tile") return "tile";
  return "panel";
}

export function getRoomFloorMaterial(finish: LaboratoryFloorFinish) {
  const key = `floor:${finish.id}`;
  const cached = materialCache.get(key);
  if (cached) return cached;
  const profile = floorSurfaceProfile(finish);
  const material = new THREE.MeshPhysicalMaterial({
    name: key,
    color: finish.color,
    ...getRoomSurfaceMaps(profile),
    normalScale: new THREE.Vector2(0.22, 0.22),
    // These are sealed/honed walkable surfaces, never exposed metal or mirrors.
    metalness: 0,
    roughness: Math.max(0.5, finish.roughness),
    clearcoat: Math.min(0.06, finish.clearcoat),
    clearcoatRoughness: Math.max(0.5, finish.clearcoatRoughness),
    envMapIntensity: 0.65,
    side: THREE.DoubleSide,
  });
  materialCache.set(key, material);
  return material;
}

export function getRoomWallMaterial(finish: LaboratoryWallFinish, opacity = 1) {
  const key = `wall:${finish.id}:${opacity}`;
  const cached = materialCache.get(key);
  if (cached) return cached;
  const profile = wallSurfaceProfile(finish);
  const material = new THREE.MeshPhysicalMaterial({
    name: key,
    color: finish.color,
    ...getRoomSurfaceMaps(profile),
    normalScale: new THREE.Vector2(
      profile === "plaster" ? 0.45 : 0.2,
      profile === "plaster" ? 0.45 : 0.2,
    ),
    roughness: finish.roughness,
    metalness: profile === "steel" ? finish.metalness : 0,
    clearcoat: finish.clearcoat,
    clearcoatRoughness: Math.max(0.35, finish.clearcoatRoughness),
    envMapIntensity: profile === "steel" ? 0.85 : 0.65,
    opacity,
    transparent: opacity < 1,
    depthWrite: opacity >= 0.8,
  });
  materialCache.set(key, material);
  return material;
}

/** UV coordinates in metres on every box face. A 2 m wall and a 20 cm jamb
 * have the same grain size; neighbouring pieces keep the same local datum. */
export function roomSurfaceBoxGeometry(
  size: readonly [number, number, number],
  origin: readonly [number, number, number],
) {
  const geometry = new THREE.BoxGeometry(...size);
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i) + origin[0];
    const y = positions.getY(i) + origin[1];
    const z = positions.getZ(i) + origin[2];
    if (Math.abs(normals.getX(i)) > 0.5) uv.setXY(i, z, y);
    else if (Math.abs(normals.getY(i)) > 0.5) uv.setXY(i, x, z);
    else uv.setXY(i, x, y);
  }
  return geometry;
}
