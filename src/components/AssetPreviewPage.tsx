import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Grid,
  Lightformer,
  OrbitControls,
  PerspectiveCamera,
  useGLTF,
} from "@react-three/drei";
import {
  Archive,
  ArrowCounterClockwise,
  ArrowLeft,
  Cube,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import * as THREE from "three";
import { ASSET_CATALOG } from "../domain/assets";
import { BUILD_WEEK_DEMO_ASSET_IDS } from "../domain/build-week-demo";
import { resolveLayerIdForObjectType } from "../domain/layers";
import { createBlankRoom } from "../domain/room-factory";
import type { SceneObject } from "../domain/schema";
import { useEditorStore } from "../store/editor-store";
import { AssetThumbnail } from "./AssetThumbnail";
import { Toasts } from "./Dialogs";
import { Asset3D } from "./ThreeDView";

type PreviewView = "isometric" | "front" | "back" | "left" | "right" | "top";

const previewViews: Array<{ value: PreviewView; label: string }> = [
  { value: "isometric", label: "Iso" },
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "top", label: "Top" },
];

function PreviewCameraRig({
  view,
  extent,
  height,
}: {
  view: PreviewView;
  extent: number;
  height: number;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const controls = useRef<any>(null);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const eyeHeight = Math.max(extent * 0.65, height * 0.58);
    const positions: Record<PreviewView, [number, number, number]> = {
      isometric: [extent * 2.15, Math.max(extent * 1.65, height * 2.1), extent * 2.3],
      front: [0, eyeHeight, extent * 3],
      back: [0, eyeHeight, -extent * 3],
      left: [-extent * 3, eyeHeight, 0],
      right: [extent * 3, eyeHeight, 0],
      top: [0, extent * 3.2, 0.01],
    };
    camera.position.set(...positions[view]);
    camera.lookAt(0, height * 0.48, 0);
    camera.updateProjectionMatrix();
    controls.current?.target.set(0, height * 0.48, 0);
    controls.current?.update();
    invalidate();
  }, [extent, height, invalidate, view]);

  return (
    <>
      <PerspectiveCamera ref={cameraRef} makeDefault fov={36} near={0.01} far={100} />
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        minDistance={extent * 0.85}
        maxDistance={extent * 8}
        target={[0, height * 0.48, 0]}
      />
    </>
  );
}

export function AssetPreviewPage() {
  const hydrate = useEditorStore((state) => state.hydrate);
  const archivedAssetIds = useEditorStore((state) => state.project.archivedAssetIds);
  const archiveAsset = useEditorStore((state) => state.archiveAsset);
  const restoreAsset = useEditorStore((state) => state.restoreAsset);
  const [query, setQuery] = useState("");
  const [previewView, setPreviewView] = useState<PreviewView>("isometric");
  const requestedAssetId = new URLSearchParams(window.location.search).get("asset");
  const curatedAssetIdSet = useMemo(() => new Set<string>(BUILD_WEEK_DEMO_ASSET_IDS), []);
  const [showFullCatalog, setShowFullCatalog] = useState(
    Boolean(requestedAssetId && !curatedAssetIdSet.has(requestedAssetId)),
  );
  const [assetId, setAssetId] = useState(
    ASSET_CATALOG.some((entry) => entry.id === requestedAssetId)
      ? requestedAssetId!
      : ASSET_CATALOG[0].id,
  );
  useEffect(() => void hydrate(), [hydrate]);
  const archivedIdSet = useMemo(() => new Set(archivedAssetIds ?? []), [archivedAssetIds]);
  const archivedAssets = ASSET_CATALOG.filter((entry) => archivedIdSet.has(entry.id));
  const room = useMemo(
    () =>
      createBlankRoom({
        laboratoryId: "asset-preview-laboratory",
        name: "Asset Studio",
        code: "PREVIEW",
      }),
    [],
  );
  const availableAssets = useMemo(
    () =>
      showFullCatalog
        ? ASSET_CATALOG.filter((entry) => !archivedIdSet.has(entry.id))
        : ASSET_CATALOG.filter(
            (entry) => curatedAssetIdSet.has(entry.id) && !archivedIdSet.has(entry.id),
          ),
    [archivedIdSet, curatedAssetIdSet, showFullCatalog],
  );
  const fallbackAsset = availableAssets[0] ?? ASSET_CATALOG[0];
  const effectiveAssetId = availableAssets.some((entry) => entry.id === assetId)
    ? assetId
    : fallbackAsset.id;
  const asset =
    ASSET_CATALOG.find((entry) => entry.id === effectiveAssetId) ?? fallbackAsset;
  const previewSource = asset.model3d
    ? `${asset.model3d.previewSrc}?v=${encodeURIComponent(asset.model3d.revision)}`
    : null;
  const previousPreviewSource = useRef<string | null>(null);

  useEffect(() => {
    const previous = previousPreviewSource.current;
    previousPreviewSource.current = previewSource;
    if (previous && previous !== previewSource) useGLTF.clear(previous);
  }, [previewSource]);

  const object = useMemo<SceneObject>(
    () => ({
      id: `asset-preview-${asset.id}`,
      indexCode: "PREVIEW",
      name: asset.name,
      assetDefinitionId: asset.id,
      objectType: asset.objectType,
      position: { x: room.width / 2, y: room.depth / 2, z: 0 },
      dimensions: asset.defaultDimensions,
      rotation: { x: 0, y: 0, z: 0 },
      flipHorizontal: false,
      flipVertical: false,
      layerId: resolveLayerIdForObjectType(room.scene.layers, asset.objectType),
      roomId: room.id,
      zoneId: room.scene.zones[0]?.id ?? null,
      locked: false,
      visible: true,
      metadata: {},
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      parentObjectId: null,
      childLocationIds: [],
      zIndex: 1,
    }),
    [asset, room],
  );
  const matches = availableAssets.filter((entry) =>
    `${entry.name} ${entry.category} ${entry.tags.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const previewWidth = asset.defaultDimensions.width / 1000;
  const previewDepth = asset.defaultDimensions.depth / 1000;
  const previewHeight = asset.defaultDimensions.height / 1000;
  const previewExtent = Math.max(0.42, previewWidth, previewDepth, previewHeight);
  const gridCellSize = previewExtent < 0.8 ? 0.1 : previewExtent < 1.6 ? 0.25 : 0.5;

  return (
    <main className="asset-preview-page">
      <header>
        <a href="/">
          <ArrowLeft size={18} />
          Back to editor
        </a>
        <div>
          <span className="eyebrow">Asset creation pipeline</span>
          <h1>PBR Asset Studio & orbitable 3D preview</h1>
        </div>
        <span className="asset-preview-count">
          {availableAssets.length} active · {archivedAssets.length} archived
        </span>
      </header>
      <section className="asset-preview-layout">
        <aside>
          <label className="search-field">
            <MagnifyingGlass size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search asset manifest…"
            />
          </label>
          <div className="asset-preview-scope" aria-label="Asset Studio catalog scope">
            <button
              className={!showFullCatalog ? "active" : ""}
              aria-pressed={!showFullCatalog}
              onClick={() => setShowFullCatalog(false)}
            >
              Curated {BUILD_WEEK_DEMO_ASSET_IDS.length}
            </button>
            <button
              className={showFullCatalog ? "active" : ""}
              aria-pressed={showFullCatalog}
              onClick={() => setShowFullCatalog(true)}
            >
              Full catalog {ASSET_CATALOG.length}
            </button>
          </div>
          <div className="asset-preview-list">
            {matches.map((entry) => (
              <button
                key={entry.id}
                className={entry.id === asset.id ? "selected" : ""}
                onClick={() => setAssetId(entry.id)}
              >
                <AssetThumbnail asset={entry} />
                <span>
                  <b>{entry.name}</b>
                  <em>{entry.category}</em>
                </span>
              </button>
            ))}
          </div>
          <details className="asset-archive-list">
            <summary>
              <Archive size={16} /> Archived from library <em>{archivedAssets.length}</em>
            </summary>
            <p>Archived definitions remain safe in existing rooms but disappear from search and new placement.</p>
            {archivedAssets.map((entry) => (
              <div key={entry.id}>
                <span><b>{entry.name}</b><small>{entry.id}</small></span>
                <button onClick={() => restoreAsset(entry.id)}>
                  <ArrowCounterClockwise size={14} /> Restore
                </button>
              </div>
            ))}
            {!archivedAssets.length && <p>No catalog assets are archived.</p>}
          </details>
        </aside>
        <section className="asset-preview-stage">
          <div className="asset-preview-canvas">
            <Canvas
              shadows={{ type: THREE.PCFShadowMap }}
              dpr={[1, 1.5]}
              frameloop="demand"
              gl={{ antialias: true, powerPreference: "high-performance" }}
              onCreated={({ gl }) => {
                gl.toneMapping = THREE.ACESFilmicToneMapping;
                gl.toneMappingExposure = 1;
                gl.outputColorSpace = THREE.SRGBColorSpace;
              }}
            >
              <PreviewCameraRig view={previewView} extent={previewExtent} height={previewHeight} />
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
              <directionalLight
                position={[5, 8, 6]}
                intensity={2.05}
                castShadow
                shadow-mapSize-width={1536}
                shadow-mapSize-height={1536}
                shadow-bias={-0.0002}
                shadow-normalBias={0.02}
              />
              <directionalLight position={[-4, 3, -3]} color="#d7ece8" intensity={0.48} />
              <Asset3D
                object={object}
                room={room}
                selected={false}
                hovered={false}
                detail="preview"
              />
              <ContactShadows
                position={[0, 0.012, 0]}
                opacity={0.42}
                scale={Math.max(2.4, previewExtent * 3.2)}
                blur={2.6}
                far={Math.max(0.8, previewExtent * 1.8)}
                resolution={512}
                frames={1}
              />
              <Grid
                args={[Math.max(4, previewExtent * 8), Math.max(4, previewExtent * 8)]}
                cellSize={gridCellSize}
                cellColor="#c6cfcc"
                sectionSize={gridCellSize * 5}
                sectionColor="#9eaaa6"
                fadeDistance={Math.max(4, previewExtent * 6)}
                infiniteGrid
                position={[0, -0.004, 0]}
              />
            </Canvas>
            <div className="asset-preview-view-presets" aria-label="Asset view presets">
              {previewViews.map((view) => (
                <button
                  key={view.value}
                  className={previewView === view.value ? "active" : ""}
                  aria-pressed={previewView === view.value}
                  onClick={() => setPreviewView(view.value)}
                >
                  {view.label}
                </button>
              ))}
            </div>
            <div className="asset-preview-chip">
              <Cube size={16} weight="duotone" />
              Orbit · pan · zoom
            </div>
          </div>
          <div className="asset-preview-details">
            <div>
              <div className="asset-source-row">
                <span className="eyebrow">{asset.category}</span>
                {asset.model3d && <span className="authored-model-badge">Authored PBR GLB</span>}
              </div>
              <h2>{asset.name}</h2>
              <p>{asset.description}</p>
            </div>
            <dl>
              <div>
                <dt>Manifest ID</dt>
                <dd>{asset.id}</dd>
              </div>
              <div>
                <dt>Default size</dt>
                <dd>
                  {asset.defaultDimensions.width} × {asset.defaultDimensions.depth} ×{" "}
                  {asset.defaultDimensions.height} mm
                </dd>
              </div>
              <div>
                <dt>Profile</dt>
                <dd>{asset.profile}</dd>
              </div>
              <div>
                <dt>Material</dt>
                <dd>{asset.material}</dd>
              </div>
              <div>
                <dt>Anchor</dt>
                <dd>{asset.anchor}</dd>
              </div>
              <div>
                <dt>Indexing</dt>
                <dd>{asset.indexingBehavior}</dd>
              </div>
              <div>
                <dt>Visual source</dt>
                <dd>
                  {asset.model3d
                    ? "Current authored all-sided PBR GLB"
                    : "Procedural PBR geometry"}
                </dd>
              </div>
            </dl>
            <div className="asset-lifecycle-action">
              <span>
                <b>Catalog visibility</b>
                <small>Hide an unused definition from the Asset Library and WebMCP search. Existing room instances are always protected.</small>
              </span>
              <button onClick={() => archiveAsset(asset.id)}>
                <Archive size={16} /> Archive from library
              </button>
            </div>
          </div>
        </section>
      </section>
      <Toasts />
    </main>
  );
}
