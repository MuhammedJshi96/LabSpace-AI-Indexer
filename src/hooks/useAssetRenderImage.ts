import { useEffect, useState } from "react";
import type { AssetDefinition, Dimensions } from "../domain/schema";
import { assetRenderSource } from "../lib/asset-render-path";

type UseAssetRenderImageOptions = {
  dimensions?: Dimensions;
  enabled?: boolean;
  longestEdge?: number;
};

type PlanRenderImage = HTMLImageElement | HTMLCanvasElement;
export type AssetRenderImageState = {
  image: PlanRenderImage | null;
  status: "loading" | "ready" | "failed";
};

const decodedTopRenderCache = new Map<string, PlanRenderImage>();

/**
 * Catalog renders intentionally include studio breathing room. That padding is
 * useful in the Asset Library but makes a plan object occupy only a fraction of
 * its real millimetre footprint. Trim only transparent pixels here so the 2D
 * renderer can map the authored silhouette to its exact scene dimensions.
 */
function trimTransparentStudioPadding(image: HTMLImageElement): PlanRenderImage {
  const analysis = document.createElement("canvas");
  analysis.width = image.naturalWidth;
  analysis.height = image.naturalHeight;
  const context = analysis.getContext("2d", { willReadFrequently: true });
  if (!context || analysis.width === 0 || analysis.height === 0) return image;
  context.drawImage(image, 0, 0);

  const pixels = context.getImageData(0, 0, analysis.width, analysis.height).data;
  let minX = analysis.width;
  let minY = analysis.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < analysis.height; y += 1) {
    for (let x = 0; x < analysis.width; x += 1) {
      if (pixels[(y * analysis.width + x) * 4 + 3] <= 10) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return image;

  const padding = Math.max(2, Math.round(Math.max(analysis.width, analysis.height) * 0.012));
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(analysis.width - 1, maxX + padding);
  maxY = Math.min(analysis.height - 1, maxY + padding);
  if (minX === 0 && minY === 0 && maxX === analysis.width - 1 && maxY === analysis.height - 1)
    return image;

  const cropped = document.createElement("canvas");
  cropped.width = maxX - minX + 1;
  cropped.height = maxY - minY + 1;
  cropped
    .getContext("2d")
    ?.drawImage(
      image,
      minX,
      minY,
      cropped.width,
      cropped.height,
      0,
      0,
      cropped.width,
      cropped.height,
    );
  return cropped;
}

/**
 * Load the deterministic top render derived from the same authored GLB or
 * ProceduralAssetModel geometry used in 3D. Konva scales that image to the
 * object's editable millimetre dimensions. A missing image simply leaves the
 * existing vector footprint in place.
 */
export function useAssetRenderImage(
  asset: AssetDefinition,
  { enabled = true }: UseAssetRenderImageOptions = {},
): AssetRenderImageState {
  const source = assetRenderSource(asset, "top");
  const cached = source ? (decodedTopRenderCache.get(source) ?? null) : null;
  const [result, setResult] = useState<{
    source: string | null;
    image: PlanRenderImage | null;
    status: AssetRenderImageState["status"];
  }>(() => ({ source, image: cached, status: cached ? "ready" : "loading" }));
  const current =
    result.source === source
      ? result
      : { source, image: cached, status: cached ? ("ready" as const) : ("loading" as const) };

  useEffect(() => {
    if (!enabled || !source || current.status !== "loading") return;
    let active = true;
    const nextImage = new window.Image();
    nextImage.decoding = "async";
    nextImage.onload = () => {
      const planImage = trimTransparentStudioPadding(nextImage);
      decodedTopRenderCache.set(source, planImage);
      if (active) setResult({ source, image: planImage, status: "ready" });
    };
    nextImage.onerror = () => {
      if (active) setResult({ source, image: null, status: "failed" });
    };
    nextImage.src = source;
    return () => {
      active = false;
    };
  }, [current.status, enabled, source]);

  return { image: current.image, status: current.status };
}
