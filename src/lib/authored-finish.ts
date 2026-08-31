import * as THREE from "three";

/** Reviewed GLBs own their PBR finish. Never repaint them by a name heuristic. */
export function applyReviewedAuthoredFinish(material: THREE.MeshStandardMaterial): boolean {
  if (material.userData.labspace_finish_revision !== "catalog-polish-r3") return false;
  material.envMapIntensity = Number(material.userData.labspace_env_intensity ?? 1);
  // Keep authored color, metalness, roughness, glass transmission and maps intact.
  // This includes black rubber, safety colors and deliberate phenolic worktops.
  return true;
}
