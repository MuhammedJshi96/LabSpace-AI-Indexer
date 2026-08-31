import type { ThreeElements } from "@react-three/fiber";
import {
  renderQualityPreset,
  type RenderQuality,
  type RenderSurface,
} from "../domain/render-quality";

type Props = ThreeElements["directionalLight"] & {
  quality: RenderQuality;
  surface?: RenderSurface;
  "shadow-radius"?: number;
  "shadow-intensity"?: number;
};

/** Remount only the light when changing tier: Three's shadow map is otherwise
 * not resized after allocation. The old light disposes its GPU shadow targets;
 * the Canvas, loaded assets, camera and selection stay mounted. */
export function QualityKeyLight({ quality, surface = "room", ...props }: Props) {
  const settings = renderQualityPreset(quality, surface);
  return (
    <directionalLight
      {...props}
      key={quality}
      castShadow
      intensity={
        (typeof props.intensity === "number" ? props.intensity : 1) * settings.keyMultiplier
      }
      shadow-mapSize-width={settings.shadowSize}
      shadow-mapSize-height={settings.shadowSize}
      shadow-radius={settings.softShadows ? 6 : props["shadow-radius"]}
      shadow-intensity={
        settings.softShadows
          ? Math.min(0.7, props["shadow-intensity"] ?? 1)
          : props["shadow-intensity"]
      }
      shadow-blurSamples={8}
    />
  );
}
