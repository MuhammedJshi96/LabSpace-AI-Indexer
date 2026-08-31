import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useRenderSettings } from "../store/render-settings-store";
import { applyRenderColor } from "../lib/render-color";

export function QualityColorManagement({ exposure = 1 }: { exposure?: number }) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const quality = useRenderSettings((state) => state.quality);
  useLayoutEffect(() => {
    const restore = applyRenderColor(gl, quality, exposure);
    invalidate(2);
    return restore;
  }, [gl, quality, exposure, invalidate]);
  return null;
}
