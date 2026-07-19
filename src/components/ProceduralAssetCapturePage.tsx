import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import { ASSET_CATALOG } from "../domain/assets";
import { waitForLaboratoryMaterialTextures } from "../lib/laboratory-material-textures";
import type { AssetRenderView } from "../lib/asset-render-path";
import { ProceduralAssetModel } from "./ProceduralAssetModel";

const ISO_SIZE = { width: 384, height: 256 } as const;
const TOP_SIZE = { width: 384, height: 384 } as const;
const MODEL_MARGIN = 1.16;

function boxCorners(box: THREE.Box3) {
  const { min, max } = box;
  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z),
  ];
}

function fitCatalogCamera(
  camera: THREE.OrthographicCamera,
  box: THREE.Box3,
  view: AssetRenderView,
  aspect: number,
) {
  const center = box.getCenter(new THREE.Vector3());
  const dimensions = box.getSize(new THREE.Vector3());
  const extent = Math.max(dimensions.x, dimensions.y, dimensions.z, 0.1);
  const distance = extent * 4 + 1;

  if (view === "top") {
    camera.up.set(0, 0, -1);
    camera.position.set(center.x, center.y + distance, center.z + distance * 0.00001);
  } else {
    camera.up.set(0, 1, 0);
    const direction = new THREE.Vector3(1.35, 1.1, 1.55).normalize();
    camera.position.copy(center).addScaledVector(direction, distance);
  }
  camera.lookAt(center);
  camera.near = 0.001;
  camera.far = distance * 3;
  camera.updateMatrixWorld(true);

  const projected = boxCorners(box).map((point) =>
    point.clone().applyMatrix4(camera.matrixWorldInverse),
  );
  const minX = Math.min(...projected.map((point) => point.x));
  const maxX = Math.max(...projected.map((point) => point.x));
  const minY = Math.min(...projected.map((point) => point.y));
  const maxY = Math.max(...projected.map((point) => point.y));
  const projectedWidth = Math.max(0.01, maxX - minX);
  const projectedHeight = Math.max(0.01, maxY - minY);

  // Center the projected geometry without changing the chosen camera angle.
  camera.translateX((minX + maxX) / 2);
  camera.translateY((minY + maxY) / 2);

  if (view === "top") {
    // Top renders are intentionally framed independently on X and Y. Konva
    // maps the square PNG back to the editable width/depth rectangle, which
    // restores the asset's real plan proportions without transparent gutters.
    camera.left = (-projectedWidth * MODEL_MARGIN) / 2;
    camera.right = (projectedWidth * MODEL_MARGIN) / 2;
    camera.top = (projectedHeight * MODEL_MARGIN) / 2;
    camera.bottom = (-projectedHeight * MODEL_MARGIN) / 2;
  } else {
    const height = Math.max(projectedHeight, projectedWidth / aspect) * MODEL_MARGIN;
    camera.left = (-height * aspect) / 2;
    camera.right = (height * aspect) / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
  }
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

function CaptureScene({
  assetId,
  view,
  onReady,
}: {
  assetId: string;
  view: AssetRenderView;
  onReady: () => void;
}) {
  const asset = ASSET_CATALOG.find((entry) => entry.id === assetId)!;
  const modelRef = useRef<THREE.Group>(null);
  const cameraRef = useRef<THREE.OrthographicCamera>(null);
  const texturesReadyRef = useRef(false);
  const fittedRef = useRef(false);
  const settledFramesRef = useRef(0);
  const announcedRef = useRef(false);
  const size = view === "top" ? TOP_SIZE : ISO_SIZE;
  const width = asset.defaultDimensions.width / 1000;
  const depth = asset.defaultDimensions.depth / 1000;
  const height = asset.defaultDimensions.height / 1000;
  const extent = Math.max(width, depth, height, 0.5);

  useEffect(() => {
    let active = true;
    void waitForLaboratoryMaterialTextures().then(() => {
      if (active) texturesReadyRef.current = true;
    });
    return () => {
      active = false;
    };
  }, []);

  useFrame(({ gl, scene }) => {
    const camera = cameraRef.current;
    const model = modelRef.current;
    if (!texturesReadyRef.current || !camera || !model || announcedRef.current) return;

    if (!fittedRef.current) {
      model.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(model, true);
      if (box.isEmpty()) return;
      fitCatalogCamera(camera, box, view, size.width / size.height);
      fittedRef.current = true;
      return;
    }

    settledFramesRef.current += 1;
    if (settledFramesRef.current < 5) return;
    gl.render(scene, camera);
    gl.getContext().finish();
    announcedRef.current = true;
    onReady();
  });

  return (
    <>
      <OrthographicCamera ref={cameraRef} makeDefault near={0.001} far={100} />
      <Environment resolution={64} frames={1} background={false}>
        <Lightformer
          form="rect"
          intensity={3.2}
          color="#ffffff"
          position={[extent * 1.4, extent * 2.6, extent * 1.8]}
          rotation={[-Math.PI / 4, 0.35, 0]}
          scale={[extent * 3.2, extent * 3.2, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.7}
          color="#d5f1ed"
          position={[-extent * 2, extent * 1.2, -extent * 1.8]}
          rotation={[0.2, -Math.PI / 3, 0]}
          scale={[extent * 2.4, extent * 1.8, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.2}
          color="#fff5e8"
          position={[0, extent * 3, -extent * 0.4]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[extent * 2.8, extent * 2.2, 1]}
        />
      </Environment>
      <hemisphereLight color="#f7fffd" groundColor="#65716f" intensity={0.72} />
      <ambientLight intensity={0.18} />
      <directionalLight
        castShadow
        color="#fffaf3"
        intensity={2.1}
        position={[extent * 2.2, extent * 3.4, extent * 2.4]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.00015}
      />
      <directionalLight
        color="#c9e5e2"
        intensity={0.8}
        position={[-extent * 2.4, extent * 1.5, -extent * 1.4]}
      />
      <group ref={modelRef}>
        <ProceduralAssetModel
          definition={asset}
          width={width}
          depth={depth}
          height={height}
          detail="preview"
        />
      </group>
      {view === "isometric" && (
        <ContactShadows
          position={[0, -0.004, 0]}
          opacity={0.28}
          scale={extent * 3.2}
          blur={2.4}
          far={extent * 3}
          resolution={512}
          frames={2}
          color="#233331"
        />
      )}
    </>
  );
}

export function ProceduralAssetCapturePage() {
  const parameters = new URLSearchParams(window.location.search);
  const requestedAssetId = parameters.get("asset") ?? "";
  const requestedView = parameters.get("view");
  const asset = ASSET_CATALOG.find((entry) => entry.id === requestedAssetId);
  const view: AssetRenderView | null =
    requestedView === "top" || requestedView === "isometric" ? requestedView : null;
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);

  if (!asset || !view) {
    return (
      <main
        id="procedural-catalog-capture"
        data-capture-error="invalid asset or view"
        style={{ width: ISO_SIZE.width, height: ISO_SIZE.height }}
      />
    );
  }

  const size = view === "top" ? TOP_SIZE : ISO_SIZE;
  return (
    <main
      id="procedural-catalog-capture"
      data-capture-ready={ready ? "true" : "false"}
      data-asset-id={asset.id}
      data-view={view}
      style={{ width: size.width, height: size.height }}
    >
      <Canvas
        shadows
        dpr={1}
        frameloop="always"
        gl={{
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <CaptureScene assetId={asset.id} view={view} onReady={markReady} />
      </Canvas>
    </main>
  );
}
