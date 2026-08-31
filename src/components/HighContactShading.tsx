import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { contactShadingSize, suppressNonOccluders } from "../lib/contact-shading";

function createShading(scene: THREE.Scene, camera: THREE.Camera, surface: "room" | "studio") {
  const pass = new GTAOPass(scene, camera, 1, 1);
  pass.output = GTAOPass.OUTPUT.Off;
  pass.gtaoRenderTarget.depthBuffer = false;
  pass.pdRenderTarget.depthBuffer = false;
  pass.updateGtaoMaterial({
    radius: surface === "studio" ? 0.045 : 0.18,
    thickness: surface === "studio" ? 0.18 : 0.4,
    distanceExponent: 1.3,
    distanceFallOff: 1,
    scale: 1,
    samples: 32,
    screenSpaceRadius: false,
  });
  pass.updatePdMaterial({ samples: 16, radius: 6, depthPhi: 2, normalPhi: 3 });
  pass.blendMaterial.uniforms.intensity.value = surface === "studio" ? 0.32 : 0.42;
  pass.blendMaterial.uniforms.tDiffuse.value = pass.pdRenderTarget.texture;
  const overlay = new FullScreenQuad(pass.blendMaterial);
  let disposed = false;
  return {
    resize: (width: number, height: number) => pass.setSize(width, height),
    draw: (renderer: THREE.WebGLRenderer) => {
      const restoreVisibility = suppressNonOccluders(scene);
      const target = renderer.getRenderTarget();
      const autoClear = renderer.autoClear;
      const shadowUpdate = renderer.shadowMap.autoUpdate;
      const override = scene.overrideMaterial;
      const clearColor = renderer.getClearColor(new THREE.Color());
      const clearAlpha = renderer.getClearAlpha();
      try {
        // The beauty pass already updated shadows. Reuse them and avoid a
        // second expensive shadow render while acquiring depth and normals.
        renderer.shadowMap.autoUpdate = false;
        pass.render(renderer, pass.gtaoRenderTarget, pass.pdRenderTarget, 0, false);
        renderer.setRenderTarget(target);
        renderer.autoClear = false;
        overlay.render(renderer);
      } finally {
        restoreVisibility();
        scene.overrideMaterial = override;
        renderer.setRenderTarget(target);
        renderer.autoClear = autoClear;
        renderer.shadowMap.autoUpdate = shadowUpdate;
        renderer.setClearColor(clearColor, clearAlpha);
      }
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      overlay.dispose();
      pass.dispose();
      // r185's pass.dispose() omits these two owned shader materials.
      pass.gtaoMaterial.dispose();
      pass.blendMaterial.dispose();
    },
  };
}

/** Render only on invalidation. There is no continuously running AO loop,
 * accumulation history, full-resolution composer or change to room geometry. */
export default function HighContactShading({ surface }: { surface: "room" | "studio" }) {
  const { gl, scene, camera, size, invalidate, viewport } = useThree();
  const shading = useRef<ReturnType<typeof createShading> | null>(null);
  useEffect(() => {
    let next: ReturnType<typeof createShading>;
    try {
      next = createShading(scene, camera, surface);
    } catch (error) {
      console.warn(
        "High contact shading could not initialize; using the standard renderer.",
        error,
      );
      return;
    }
    shading.current = next;
    invalidate(2);
    return () => {
      shading.current = null;
      next.dispose();
      gl.domElement.removeAttribute("data-contact-shading");
      gl.domElement.removeAttribute("data-contact-shading-size");
      invalidate(2);
    };
  }, [gl, scene, camera, surface, invalidate]);
  useEffect(() => {
    const resolution = contactShadingSize(size.width, size.height, viewport.dpr);
    shading.current?.resize(resolution.width, resolution.height);
    if (import.meta.env.DEV)
      gl.domElement.setAttribute(
        "data-contact-shading-size",
        `${resolution.width}x${resolution.height}`,
      );
    invalidate(2);
  }, [size.width, size.height, viewport.dpr, gl, scene, camera, surface, invalidate]);
  useFrame(({ gl, scene, camera }) => {
    const autoReset = gl.info.autoReset;
    gl.info.autoReset = false;
    gl.info.reset();
    try {
      gl.render(scene, camera);
      shading.current?.draw(gl);
      if (import.meta.env.DEV)
        gl.domElement.dataset.contactShading = shading.current ? "active" : "fallback";
    } catch (error) {
      console.warn(
        "High contact shading unavailable; retaining the standard room renderer.",
        error,
      );
      shading.current?.dispose();
      shading.current = null;
      gl.render(scene, camera);
    } finally {
      gl.info.autoReset = autoReset;
    }
  }, 1);
  return null;
}
