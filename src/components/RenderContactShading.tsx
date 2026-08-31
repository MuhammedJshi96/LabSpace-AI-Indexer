import { lazy, Suspense } from "react";
import { useRenderSettings } from "../store/render-settings-store";

const HighContactShading = lazy(() => import("./HighContactShading"));

/** The extra shader code and GPU buffers are strictly opt-in, never Low/Balanced. */
export function RenderContactShading({ surface }: { surface: "room" | "studio" }) {
  const quality = useRenderSettings((state) => state.quality);
  return quality === "high" ? (
    <Suspense fallback={null}>
      <HighContactShading surface={surface} />
    </Suspense>
  ) : null;
}
