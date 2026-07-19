import type { AssetDefinition } from "../domain/schema";
import { authoredAssetRenderSource, type AuthoredRenderView } from "./hero-render-path";

export type AssetRenderView = AuthoredRenderView;

/**
 * Bump this revision whenever ProceduralAssetModel geometry, materials, lighting,
 * or catalog framing changes. The query keeps long-lived browser caches from
 * mixing renders produced by different procedural-model revisions.
 */
export const PROCEDURAL_RENDER_REVISION = "labspace-procedural-r2";

export function proceduralAssetRenderSource(asset: AssetDefinition, view: AssetRenderView) {
  return `/models/procedural/renders/${asset.id}-${view}.png?v=${encodeURIComponent(PROCEDURAL_RENDER_REVISION)}`;
}

/**
 * Every built-in asset has a deterministic material-aware catalog render.
 * Authored heroes keep their Blender/GLB-derived paths; the remaining catalog
 * entries resolve to captures of the same ProceduralAssetModel used in 3D.
 */
export function assetRenderSource(asset: AssetDefinition, view: AssetRenderView) {
  return authoredAssetRenderSource(asset, view) ?? proceduralAssetRenderSource(asset, view);
}

export function assetRenderKind(asset: AssetDefinition) {
  return asset.model3d ? "authored" : "procedural";
}
