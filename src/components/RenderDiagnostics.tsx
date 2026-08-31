import { useEffect, useRef } from "react";
import { addAfterEffect, useFrame, useThree } from "@react-three/fiber";
import type { Camera, WebGLRenderer } from "three";

function writeDiagnostics(gl: WebGLRenderer, camera: Camera, frames: number) {
  const canvas = gl.domElement;
  canvas.dataset.renderFrames = String(frames);
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
  canvas.dataset.toneMapping = String(gl.toneMapping);
}

/** Local QA evidence only: no render loop, readback, state update or production
 * overlay. DOM counters let tests verify that idle canvases actually sleep. */
export function RenderDiagnostics() {
  const frames = useRef(0);
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  useFrame(() => {
    if (import.meta.env.DEV) frames.current++;
  });
  useEffect(() => {
    if (import.meta.env.DEV)
      return addAfterEffect(() => writeDiagnostics(gl, camera, frames.current));
  }, [gl, camera]);
  return null;
}
