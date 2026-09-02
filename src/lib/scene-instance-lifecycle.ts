import * as THREE from "three";

/**
 * Attach exactly one cloned asset scene to a dedicated viewer host.
 *
 * Asset Studio can change definitions while a previous GLTF suspense request
 * is still settling, and React StrictMode deliberately replays mount cleanup.
 * Replacing the host contents here makes scene ownership explicit: a late old
 * attachment cannot remain alongside the current model, and its stale cleanup
 * cannot remove the replacement.
 *
 * Geometry and materials are intentionally not disposed. Authored instances
 * share immutable GLTF resources and reference-counted presentation variants;
 * their respective caches own those resources.
 */
export function attachExclusiveScene(host: THREE.Group, scene: THREE.Object3D) {
  for (const child of [...host.children]) host.remove(child);
  host.add(scene);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (scene.parent === host) host.remove(scene);
  };
}
