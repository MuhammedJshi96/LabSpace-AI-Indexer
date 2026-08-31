import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

/** Local QA evidence only: no render loop, readback, state update or production
 * overlay. DOM counters let tests verify that idle canvases actually sleep. */
export function RenderDiagnostics() {
  const frames = useRef(0);
  useFrame(({ gl, camera }) => {
    if (!import.meta.env.DEV) return;
    const canvas = gl.domElement;
    canvas.dataset.renderFrames = String(++frames.current);
    canvas.dataset.renderCalls = String(gl.info.render.calls);
    canvas.dataset.renderTriangles = String(gl.info.render.triangles);
    canvas.dataset.renderTextures = String(gl.info.memory.textures);
    canvas.dataset.renderGeometries = String(gl.info.memory.geometries);
    canvas.dataset.cameraPosition = camera.position
      .toArray()
      .map((n) => n.toFixed(4))
      .join(",");
    canvas.dataset.cameraOrientation = camera.quaternion
      .toArray()
      .map((n) => n.toFixed(4))
      .join(",");
    canvas.dataset.shadowFilter = String(gl.shadowMap.type);
  });
  return null;
}
