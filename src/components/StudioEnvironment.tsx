import { Suspense, useEffect } from "react";
import { Environment, useEnvironment } from "@react-three/drei";
import { useThree } from "@react-three/fiber";

function LoadedEnvironment({ onReady, intensity }: { onReady?: () => void; intensity: number }) {
  const map = useEnvironment({ files: "/environments/studio-small-09-1k.hdr" });
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    // Environment attaches the texture imperatively. With demand rendering,
    // loading it must request a fresh frame or metals stay black until orbit.
    invalidate(2);
    onReady?.();
  }, [map, invalidate, onReady, intensity]);
  return (
    <Environment
      map={map}
      environmentIntensity={intensity}
      environmentRotation={[0, Math.PI / 3, 0]}
    />
  );
}

/** One locally bundled 1K HDR, cached by the loader and filtered by Three's
 * PMREM cache. No per-frame capture, remote runtime request or per-item probe.
 * Real softbox gradients give metal and glass a readable reflection field.
 */
export function StudioEnvironment({
  onReady,
  intensity = 0.55,
}: {
  onReady?: () => void;
  intensity?: number;
}) {
  return (
    <Suspense fallback={null}>
      <LoadedEnvironment onReady={onReady} intensity={intensity} />
    </Suspense>
  );
}
