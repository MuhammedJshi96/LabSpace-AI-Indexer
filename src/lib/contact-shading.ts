import * as THREE from "three";

export const CONTACT_MAX_PIXELS = 524288;
export const CONTACT_MAX_EDGE = 960;

/** Capped-resolution AO, even on 4K/retina displays. No full-size composer
 * targets are required: the filtered AO is blended over the native AA frame. */
export function contactShadingSize(width: number, height: number, pixelRatio = 1) {
  const w = Math.max(1, width * Math.min(1.25, Math.max(1, pixelRatio)));
  const h = Math.max(1, height * Math.min(1.25, Math.max(1, pixelRatio)));
  const scale = Math.min(
    1,
    CONTACT_MAX_EDGE / Math.max(w, h),
    Math.sqrt(CONTACT_MAX_PIXELS / (w * h)),
  );
  return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)) };
}

/** Exclude transparent glass, editor guides and decals from the occluder pass
 * only. Their normal beauty render remains untouched and fully visible. */
export function suppressNonOccluders(scene: THREE.Object3D) {
  const hidden: THREE.Object3D[] = [];
  scene.traverseVisible((object) => {
    const helper = object instanceof THREE.Line || object instanceof THREE.Points;
    const materials =
      object instanceof THREE.Mesh
        ? Array.isArray(object.material)
          ? object.material
          : [object.material]
        : [];
    const transparent =
      materials.length > 0 &&
      materials.every(
        (m) =>
          m.transparent ||
          m.opacity < 0.98 ||
          (m instanceof THREE.MeshPhysicalMaterial && m.transmission > 0.05),
      );
    if (helper || transparent) {
      hidden.push(object);
      object.visible = false;
    }
  });
  return () => {
    for (const object of hidden) object.visible = true;
  };
}
