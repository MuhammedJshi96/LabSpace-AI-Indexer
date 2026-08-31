import * as THREE from "three";

// GLTFLoader caches each document independently. Pool only our immutable,
// revisioned shared maps so 104 models do not upload 104 copies to the GPU.
const surfaceTextures = new Map<string, THREE.Texture>();
function sharedTexture(texture: THREE.Texture | null, key: string) {
  if (!texture) return null;
  const shared = surfaceTextures.get(key);
  if (shared) return shared;
  texture.anisotropy = 2;
  surfaceTextures.set(key, texture);
  return texture;
}

/** Reviewed GLBs own their PBR finish. Never repaint them by a name heuristic. */
export function applyReviewedAuthoredFinish(material: THREE.MeshStandardMaterial): boolean {
  if (
    ![
      "catalog-polish-r3",
      "catalog-polish-r4",
      "catalog-polish-r5",
      "catalog-polish-r6",
      "catalog-polish-r7",
    ].includes(material.userData.labspace_finish_revision)
  )
    return false;
  material.envMapIntensity = Number(material.userData.labspace_env_intensity ?? 1);
  const surface = material.userData.labspace_surface;
  const revision = material.userData.labspace_surface_revision;
  if (surface && ["surface-r4", "surface-r5"].includes(revision)) {
    material.normalMap = sharedTexture(material.normalMap, `${surface}:normal:${revision}`);
    material.roughnessMap = sharedTexture(
      material.roughnessMap,
      `${surface}:roughness:${revision}`,
    );
    material.metalnessMap = material.roughnessMap;
  }
  // Keep authored color, metalness, roughness, glass transmission and maps intact.
  // This includes black rubber, safety colors and deliberate phenolic worktops.
  return true;
}
