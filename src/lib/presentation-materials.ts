import * as THREE from "three";
import type { RenderQuality } from "../domain/render-quality";

const clearRoles = new Set([
  "analytical balance low iron glass",
  "low-iron cabinet glass",
  "clear laminated safety glass",
  "laminated laboratory safety glass",
  "clear molded laboratory acrylic",
  "chemically strengthened observation glass",
  "washer observation glass",
  "clear solvent bottle glass",
  "low iron refrigerator glazing",
  "low iron safety glass",
  "borosilicate equipment glass",
  "borosilicate process glass",
  "borosilicate glass",
]);

export function isClearGlazing(material: THREE.Material) {
  const role = String(material.userData.pbr_role ?? material.name)
    .replace(/\.\d+$/, "")
    .toLowerCase();
  return clearRoles.has(role);
}

function isRefractiveGlassware(material: THREE.Material) {
  const role = String(material.userData.pbr_role ?? material.name);
  return /borosilicate|solvent bottle/i.test(role);
}

export type RealisticSurface = "coating" | "brushed" | "phenolic" | "polymer";
export const REALISTIC_TEXTURE_SIZE = 256;
const textures = new Map<
  RealisticSurface,
  { normalMap: THREE.DataTexture; roughnessMap: THREE.DataTexture }
>();
function noise(x: number, y: number) {
  let n = Math.imul(x & 255, 374761393) ^ Math.imul(y & 255, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

/** Four illumination-free, tileable pairs shared by every High-mode material.
 * No albedo repainting, geometry subdivision or runtime image downloads. */
export function realisticSurfaceMaps(surface: RealisticSurface) {
  const existing = textures.get(surface);
  if (existing) return existing;
  const size = REALISTIC_TEXTURE_SIZE;
  const normal = new Uint8Array(size * size * 4);
  const rough = new Uint8Array(normal.length);
  const height = (x: number, y: number) => {
    const grain = (noise(x, y) + noise(x + 1, y) + noise(x, y + 1)) / 3;
    if (surface === "brushed") return noise(0, y) * 0.9 + grain * 0.1;
    if (surface === "coating") {
      const cross = Math.cos((x * Math.PI) / 2) * Math.cos((y * Math.PI) / 2);
      return grain * 0.78 + cross * 0.12;
    }
    return grain;
  };
  const amplitude =
    surface === "brushed"
      ? 0.095
      : surface === "coating"
        ? 0.14
        : surface === "phenolic"
          ? 0.055
          : 0.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = (height(x - 1, y) - height(x + 1, y)) * amplitude;
      const dy = (height(x, y - 1) - height(x, y + 1)) * amplitude;
      const length = Math.hypot(dx, dy, 1);
      normal.set(
        [
          Math.round(128 + (dx / length) * 127),
          Math.round(128 + (dy / length) * 127),
          Math.round(128 + 127 / length),
          255,
        ],
        i,
      );
      const grain = Math.max(0, Math.min(1, height(x, y)));
      rough.set([255, Math.round(216 + grain * 39), 255, 255], i);
    }
  }
  const make = (data: Uint8Array, suffix: string) => {
    const map = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    map.name = `realistic-finish-v1:${surface}:${suffix}`;
    map.colorSpace = THREE.NoColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(surface === "coating" ? 8 : 4, surface === "coating" ? 8 : 4);
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.anisotropy = 4;
    map.generateMipmaps = true;
    map.needsUpdate = true;
    return map;
  };
  const maps = { normalMap: make(normal, "normal"), roughnessMap: make(rough, "roughness") };
  textures.set(surface, maps);
  return maps;
}

function surfaceFor(material: THREE.MeshStandardMaterial): RealisticSurface | undefined {
  const surface = material.userData.labspace_surface;
  if (surface === "brushed" && material.metalness > 0.7) return "brushed";
  if (surface === "phenolic") return "phenolic";
  if (surface === "polymer") return "polymer";
  if (surface === "micrograin" || surface === "enamel") return "coating";
  return undefined;
}

type Entry = { material: THREE.MeshPhysicalMaterial; users: number };
const variants = new WeakMap<THREE.Material, Map<string, Entry>>();

export type PresentationBinding = {
  mesh: THREE.Mesh;
  materials: THREE.Material[];
  multiple: boolean;
};

/** Apply to per-instance scene clones, never the cached GLTF scene. The returned
 * cleanup restores original bindings before releasing the shared variants. */
export function bindPresentationMaterials(bindings: PresentationBinding[], quality: RenderQuality) {
  const acquired = new Map<THREE.Material, ReturnType<typeof acquirePresentationMaterial>>();
  for (const binding of bindings) {
    const materials = binding.materials.map((source) => {
      if (!acquired.has(source)) acquired.set(source, acquirePresentationMaterial(source, quality));
      return acquired.get(source)!.material;
    });
    binding.mesh.material = binding.multiple ? materials : materials[0];
    const clear = binding.materials.every(isClearGlazing);
    // VSM also considers receivers in its shadow pass. Clear panes must opt out
    // of both flags so shelves are visible without opaque pane-shaped shadows.
    binding.mesh.castShadow = binding.mesh.receiveShadow = !clear;
  }
  return () => {
    for (const binding of bindings) {
      binding.mesh.material = binding.multiple ? binding.materials : binding.materials[0];
    }
    acquired.forEach((entry) => entry.release());
  };
}

/** Reference-counted variants never mutate the cached authored source. */
export function acquirePresentationMaterial(source: THREE.Material, quality: RenderQuality) {
  const clear = isClearGlazing(source);
  const surface = source instanceof THREE.MeshStandardMaterial ? surfaceFor(source) : undefined;
  if (
    !(source instanceof THREE.MeshStandardMaterial) ||
    (!clear && (quality !== "high" || !surface))
  ) {
    return { material: source, release: () => {} };
  }
  const key = clear ? "clear-glass-v1" : "high-finish-v1";
  let cache = variants.get(source);
  if (!cache) {
    cache = new Map();
    variants.set(source, cache);
  }
  let entry = cache.get(key);
  if (!entry) {
    const material = new THREE.MeshPhysicalMaterial();
    if (source instanceof THREE.MeshPhysicalMaterial) material.copy(source);
    else {
      THREE.MeshStandardMaterial.prototype.copy.call(material, source);
      material.defines = { STANDARD: "", PHYSICAL: "" };
    }
    material.name = `${source.name} / ${key}`;
    if (clear) {
      // Thin panes use alpha transparency: the transmission buffer cannot see
      // other transparent surfaces (shelves, panes, plan grids), and overlapping
      // double-sided refractors blur the contents of cabinets. Glassware keeps
      // physical transmission. Never combine transmission and fractional alpha.
      const refractive = isRefractiveGlassware(source);
      // Preserve the user's readable cool-blue glass identity without turning
      // the pane into an opaque cyan panel. Alpha, not a milky roughness lobe,
      // controls the light tint on thin glazing.
      if (refractive) material.color.copy(source.color).lerp(new THREE.Color("#ffffff"), 0.65);
      else material.color.set("#9bcbd8");
      material.metalness = 0;
      material.roughness = refractive ? 0.018 : 0.065;
      material.transmission = refractive ? 0.985 : 0;
      material.opacity = refractive ? 1 : 0.14;
      material.transparent = !refractive;
      material.forceSinglePass = true;
      material.depthWrite = false;
      material.ior = /borosilicate/i.test(source.name) ? 1.474 : 1.5;
      material.specularIntensity = refractive ? 1 : 0.6;
      material.thickness = 0;
      material.clearcoat = 0;
      material.normalMap = material.roughnessMap = material.metalnessMap = material.bumpMap = null;
      material.envMapIntensity = 0.75;
    } else if (surface) {
      const maps = realisticSurfaceMaps(surface);
      material.normalMap = maps.normalMap;
      material.roughnessMap = material.metalnessMap = maps.roughnessMap;
      material.bumpMap = null;
      material.normalScale.setScalar(surface === "coating" ? 0.7 : 0.85);
      material.roughness =
        surface === "brushed"
          ? 0.29
          : surface === "phenolic"
            ? 0.34
            : surface === "coating"
              ? 0.43
              : Math.max(0.57, source.roughness);
      // Batched catalog geometry has no authored tangent frame. Enabling the
      // physical anisotropy lobe on degenerate generated UVs creates blown-out
      // metal faces. Directional normal/roughness grain is both robust and cheap.
      material.anisotropy = 0;
      // Paint/laminate stays dielectric; never silver lacquer. Keep authored
      // colors, maps, functional safety colors and matte-black handles intact.
      if (surface !== "brushed") {
        material.metalness = 0;
        material.clearcoat = 0;
      }
    }
    entry = { material, users: 0 };
    cache.set(key, entry);
  }
  entry.users++;
  let released = false;
  return {
    material: entry.material,
    release: () => {
      if (released) return;
      released = true;
      if (--entry.users === 0) {
        entry.material.dispose();
        cache.delete(key);
      }
    },
  };
}
