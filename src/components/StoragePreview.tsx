import { Component, Suspense, useState, type ReactNode } from "react";
import { Bounds, ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { getAssetDefinition } from "../domain/assets";
import type { Room, SceneObject } from "../domain/schema";
import { resolveStorageAccess } from "../domain/storage-access";
import { AssetVisual } from "./AssetVisual";

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert">
        3D preview unavailable. The storage map and named locations are still available.
      </p>
    ) : (
      this.props.children
    );
  }
}

/** Isolated preview: never writes the room, editor camera or selected object. */
export function StoragePreview({
  room,
  object,
  locationId,
}: {
  room: Room;
  object: SceneObject;
  locationId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [fit, setFit] = useState(0);
  const definition = getAssetDefinition(object.assetDefinitionId);
  const access = resolveStorageAccess(
    object.assetDefinitionId,
    object.id,
    locationId,
    room.scene.storageLocations,
  );
  const w = object.dimensions.width / 1000,
    h = object.dimensions.height / 1000,
    d = object.dimensions.depth / 1000;
  return (
    <section className="storage-preview" aria-label="Isolated cabinet preview">
      <header>
        <div>
          <b>{object.name}</b>
          <small>Original materials · orbit to inspect</small>
        </div>
        <button
          disabled={!access.parts.length || !ready}
          aria-pressed={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "Close access preview" : "Show access preview"}
        </button>
        <button onClick={() => setFit((value) => value + 1)}>Fit</button>
      </header>
      <div className="storage-preview-canvas">
        <PreviewBoundary>
          <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ position: [3, 2.5, 4], fov: 40 }}>
            <color attach="background" args={["#eef2f1"]} />
            <Environment resolution={128} frames={1}>
              <Lightformer
                form="rect"
                intensity={2.55}
                color="#ffffff"
                position={[3, 5, 4]}
                rotation={[-Math.PI / 4, 0.35, 0]}
                scale={[5, 5, 1]}
              />
              <Lightformer
                form="rect"
                intensity={1.25}
                color="#c9e5e1"
                position={[-4, 2, -3]}
                rotation={[0.1, -Math.PI / 3, 0]}
                scale={[4, 3, 1]}
              />
            </Environment>
            <hemisphereLight color="#f6fbfa" groundColor="#6f7a77" intensity={0.52} />
            <ambientLight intensity={0.18} />
            <directionalLight position={[5, 8, 6]} intensity={2.05} />
            <directionalLight position={[-4, 3, -3]} color="#d7ece8" intensity={0.48} />
            <Suspense fallback={null}>
              <Bounds key={fit} fit clip observe margin={1.35}>
                <AssetVisual
                  definition={definition}
                  width={w}
                  height={h}
                  depth={d}
                  detail="preview"
                  openStorageParts={open ? access.parts.map((part) => part.id) : []}
                  onReady={() => setReady(true)}
                />
              </Bounds>
            </Suspense>
            <ContactShadows
              position={[0, 0.005, 0]}
              opacity={0.35}
              scale={Math.max(w, d) * 3}
              blur={2.6}
              far={h * 2}
              resolution={256}
              frames={1}
            />
            <OrbitControls makeDefault minPolarAngle={0.1} maxPolarAngle={Math.PI / 2} />
          </Canvas>
          {!ready && (
            <div className="storage-preview-loading" role="status">
              Loading cabinet preview…
            </div>
          )}
        </PreviewBoundary>
      </div>
      <footer>
        <p>{access.reason ?? access.description}</p>
      </footer>
    </section>
  );
}
