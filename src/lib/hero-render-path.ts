import type { AssetDefinition } from "../domain/schema";

export type AuthoredRenderView = "isometric" | "top";

/**
 * Resolve the deterministic Blender render generated beside the authored GLB.
 * Keeping this convention derived from previewSrc prevents a second manifest
 * from drifting away from the model revision used by the room renderer.
 */
export function authoredAssetRenderSource(asset: AssetDefinition, view: AuthoredRenderView) {
  const model = asset.model3d;
  if (!model) return null;
  const cleanSource = model.previewSrc.split(/[?#]/, 1)[0];
  const fileName = cleanSource.slice(cleanSource.lastIndexOf("/") + 1);
  const stem = fileName.replace(/\.glb$/i, "");
  if (!stem || stem === fileName) return null;
  return `/models/hero/renders/${stem}-${view}.png?v=${encodeURIComponent(model.revision)}`;
}
