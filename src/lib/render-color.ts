import * as THREE from "three";
import type { RenderQuality } from "../domain/render-quality";

type ColorRenderer = Pick<THREE.WebGLRenderer, "toneMapping" | "toneMappingExposure">;

/** Khronos PBR Neutral retains product hues and midtone contrast in High. This
 * changes no asset colors and needs no additional render target or draw pass. */
export function applyRenderColor(renderer: ColorRenderer, quality: RenderQuality, exposure = 1) {
  const previous = { toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure };
  renderer.toneMapping =
    quality === "high" ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  return () => {
    renderer.toneMapping = previous.toneMapping;
    renderer.toneMappingExposure = previous.exposure;
  };
}
