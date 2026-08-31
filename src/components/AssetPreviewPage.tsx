import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Grid, OrbitControls, PerspectiveCamera, useGLTF } from "@react-three/drei";
import {
  Archive,
  ArrowCounterClockwise,
  ArrowLeft,
  Cube,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import * as THREE from "three";
import { StudioEnvironment } from "./StudioEnvironment";
import { QualityKeyLight } from "./QualityKeyLight";
import { QualityColorManagement } from "./QualityColorManagement";
import { RenderDiagnostics } from "./RenderDiagnostics";
import { RenderQualityControl } from "./RenderQualityControl";
import { renderQualityPreset } from "../domain/render-quality";
import { useRenderSettings } from "../store/render-settings-store";
import { ASSET_CATALOG } from "../domain/assets";
import { assetPreviewCameraDistance } from "../domain/asset-preview-camera";
import { BUILD_WEEK_DEMO_ASSET_IDS } from "../domain/build-week-demo";
import { resolveLayerIdForObjectType } from "../domain/layers";
import { createBlankRoom } from "../domain/room-factory";
import type { SceneObject } from "../domain/schema";
import { useEditorStore } from "../store/editor-store";
import { AssetThumbnail } from "./AssetThumbnail";
import { Toasts } from "./Dialogs";
import { AssetVisual } from "./AssetVisual";
import { STORAGE_RIGS, storageOpeningParts } from "../domain/storage-access";

type PreviewView = "isometric" | "front" | "back" | "left" | "right" | "top";

const previewViews: Array<{ value: PreviewView; label: string }> = [
  { value: "isometric", label: "Iso" },
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "top", label: "Top" },
];

const ASSET_STUDIO_HIDDEN_ASSET_IDS = new Set(["straight-wall", "half-height-wall"]);
const ASSET_STUDIO_CATALOG = ASSET_CATALOG.filter(
  (asset) => !ASSET_STUDIO_HIDDEN_ASSET_IDS.has(asset.id),
);

function PreviewCameraRig({
  view,
  extent,
  height,
  width,
  depth,
  resetKey,
}: {
  view: PreviewView;
  extent: number;
  height: number;
  width: number;
  depth: number;
  resetKey: number;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const controls = useRef<any>(null);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const distance = assetPreviewCameraDistance({ width, depth, height }, size.width / size.height);
    const target = new THREE.Vector3(0, height / 2, 0);
    const positions: Record<PreviewView, [number, number, number]> = {
      isometric: [1.25, 0.9, 1.6],
      front: [0, 0, 1],
      back: [0, 0, -1],
      left: [-1, 0, 0],
      right: [1, 0, 0],
      top: [0, 1, 0.0001],
    };
    camera.position.copy(
      new THREE.Vector3(...positions[view]).normalize().multiplyScalar(distance).add(target),
    );
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    controls.current?.target.copy(target);
    controls.current?.update();
    invalidate();
  }, [width, depth, height, invalidate, view, size.width, size.height, resetKey]);

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
  const quality = useRenderSettings((state) => state.quality);
  const renderSettings = renderQualityPreset(quality, "studio");
  const hydrate = useEditorStore((state) => state.hydrate);
  const archivedAssetIds = useEditorStore((state) => state.project.archivedAssetIds);
  const archiveAsset = useEditorStore((state) => state.archiveAsset);
  const restoreAsset = useEditorStore((state) => state.restoreAsset);
  const [query, setQuery] = useState("");
  const [previewView, setPreviewView] = useState<PreviewView>("isometric");
  const [cameraResetKey, setCameraResetKey] = useState(0);
  const [readyAssetId, setReadyAssetId] = useState<string | null>(null);
  const [lightingReady, setLightingReady] = useState(false);
  const [storagePreview, setStoragePreview] = useState({ assetId: "", key: "" });
  const [panelId, setPanelId] = useState("");
  const requestedAssetId = new URLSearchParams(window.location.search).get("asset");
  const curatedAssetIdSet = useMemo(() => new Set<string>(BUILD_WEEK_DEMO_ASSET_IDS), []);
  const [showFullCatalog, setShowFullCatalog] = useState(
    Boolean(requestedAssetId && !curatedAssetIdSet.has(requestedAssetId)),
  );
  const [assetId, setAssetId] = useState(
    ASSET_STUDIO_CATALOG.some((entry) => entry.id === requestedAssetId)
      ? requestedAssetId!
      : ASSET_STUDIO_CATALOG[0].id,
  );
  useEffect(() => void hydrate(), [hydrate]);
  const archivedIdSet = useMemo(() => new Set(archivedAssetIds ?? []), [archivedAssetIds]);
  const archivedAssets = ASSET_STUDIO_CATALOG.filter((entry) => archivedIdSet.has(entry.id));
  const curatedAssets = useMemo(
    () => ASSET_STUDIO_CATALOG.filter((entry) => curatedAssetIdSet.has(entry.id)),
    [curatedAssetIdSet],
  );
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
        ? ASSET_STUDIO_CATALOG.filter((entry) => !archivedIdSet.has(entry.id))
        : curatedAssets.filter((entry) => !archivedIdSet.has(entry.id)),
    [archivedIdSet, curatedAssets, showFullCatalog],
  );
  const fallbackAsset = availableAssets[0] ?? ASSET_STUDIO_CATALOG[0];
  const effectiveAssetId = availableAssets.some((entry) => entry.id === assetId)
    ? assetId
    : fallbackAsset.id;
  const asset =
    ASSET_STUDIO_CATALOG.find((entry) => entry.id === effectiveAssetId) ?? fallbackAsset;
  const storageSlots = STORAGE_RIGS[asset.id]?.locations ?? [];
  const selectedSlot =
    storagePreview.assetId === asset.id
      ? storageSlots.find((slot) => slot.key === storagePreview.key)
      : undefined;
  const slotParts =
    STORAGE_RIGS[asset.id]?.parts.filter((part) => selectedSlot?.partIds.includes(part.id)) ?? [];
  const openParts =
    slotParts[0]?.kind === "slide" && slotParts.some((part) => part.id === panelId)
      ? slotParts.filter((part) => part.id === panelId)
      : storageOpeningParts(slotParts);
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
              Curated {curatedAssets.length}
            </button>
            <button
              className={showFullCatalog ? "active" : ""}
              aria-pressed={showFullCatalog}
              onClick={() => setShowFullCatalog(true)}
            >
              Full catalog {ASSET_STUDIO_CATALOG.length}
            </button>
          </div>
          <div className="asset-preview-list">
            {matches.map((entry) => (
              <button
                key={entry.id}
                className={entry.id === effectiveAssetId ? "selected" : ""}
                onClick={() => setAssetId(entry.id)}
              >
                <span className="asset-preview-thumbnail-frame">
                  <AssetThumbnail asset={entry} />
                </span>
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
            <p>
              Archived definitions remain safe in existing rooms but disappear from search and new
              placement.
            </p>
            {archivedAssets.map((entry) => (
              <div key={entry.id}>
                <span>
                  <b>{entry.name}</b>
                  <small>{entry.id}</small>
                </span>
                <button onClick={() => restoreAsset(entry.id)}>
                  <ArrowCounterClockwise size={14} /> Restore
                </button>
              </div>
            ))}
            {!archivedAssets.length && <p>No catalog assets are archived.</p>}
          </details>
        </aside>
        <section className="asset-preview-stage">
          <div
            className="asset-preview-canvas"
            data-asset-id={asset.id}
            data-model-ready={readyAssetId === asset.id}
            data-render-quality={quality}
            data-shadow-map-size={renderSettings.shadowSize}
          >
            <Canvas
              shadows={{
                type: renderSettings.softShadows ? THREE.VSMShadowMap : THREE.PCFShadowMap,
              }}
              dpr={renderSettings.dpr}
              frameloop="demand"
              gl={{ antialias: true, powerPreference: "high-performance" }}
              onCreated={({ gl }) => {
                gl.outputColorSpace = THREE.SRGBColorSpace;
              }}
            >
              <RenderDiagnostics />
              <QualityColorManagement />
              <PreviewCameraRig
                view={previewView}
                extent={previewExtent}
                height={previewHeight}
                width={previewWidth}
                depth={previewDepth}
                resetKey={cameraResetKey}
              />
              <color attach="background" args={["#eef2f1"]} />
              <StudioEnvironment
                intensity={0.55 * renderSettings.environmentMultiplier}
                onReady={() => setLightingReady(true)}
              />
              <hemisphereLight
                color="#ffffff"
                groundColor="#c5cbc8"
                intensity={0.32 * renderSettings.fillMultiplier}
              />
              <ambientLight intensity={0.06 * renderSettings.fillMultiplier} />
              <QualityKeyLight
                quality={quality}
                surface="studio"
                position={[5, 8, 6]}
                intensity={1.25}
                shadow-radius={5}
                shadow-camera-left={-previewExtent * 1.5}
                shadow-camera-right={previewExtent * 1.5}
                shadow-camera-top={previewExtent * 1.5}
                shadow-camera-bottom={-previewExtent * 1.5}
                shadow-normalBias={0.002}
                shadow-bias={-0.00005}
              />
              <directionalLight position={[-4, 3, -3]} color="#ffffff" intensity={0.35} />
              {lightingReady && (
                <AssetVisual
                  definition={asset}
                  width={object.dimensions.width / 1000}
                  depth={object.dimensions.depth / 1000}
                  height={object.dimensions.height / 1000}
                  detail="preview"
                  openStorageParts={openParts.map((part) => part.id)}
                  onReady={() => setReadyAssetId(asset.id)}
                />
              )}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.012, 0]}>
                <planeGeometry args={[200, 200]} />
                <meshBasicMaterial color="#eef2f1" toneMapped={false} />
              </mesh>
              <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.009, 0]}>
                <planeGeometry args={[200, 200]} />
                <shadowMaterial transparent opacity={0.16} depthWrite={false} />
              </mesh>
              {readyAssetId === asset.id && (
                <ContactShadows
                  key={`${asset.id}:${openParts.map((part) => part.id).join(",")}`}
                  position={[0, 0.001, 0]}
                  opacity={renderSettings.contactShadows ? 0.34 : 0}
                  scale={Math.max(2.4, previewExtent * 3.2)}
                  blur={3.2}
                  far={Math.max(0.3, previewHeight * 1.1)}
                  resolution={512}
                  frames={renderSettings.contactShadows ? 2 : 0}
                />
              )}
              <Grid
                args={[Math.max(4, previewExtent * 8), Math.max(4, previewExtent * 8)]}
                cellSize={gridCellSize}
                cellColor="#d4ddda"
                sectionSize={gridCellSize * 5}
                sectionColor="#bdcbc5"
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
                  onClick={() => {
                    setPreviewView(view.value);
                    setCameraResetKey((key) => key + 1);
                  }}
                >
                  {view.label}
                </button>
              ))}
              <button
                onClick={() => setCameraResetKey((key) => key + 1)}
                title="Fit the complete asset in view"
              >
                Fit
              </button>
            </div>
            <div className="asset-preview-chip">
              <Cube size={16} weight="duotone" />
              Orbit · pan · zoom
            </div>
            <RenderQualityControl className="render-quality-studio" />
          </div>
          <div className="asset-preview-details">
            {storageSlots.length > 0 && (
              <section className="asset-visibility-card" aria-label="Storage anatomy preview">
                <b>Explore storage · {storageSlots.length} locations</b>
                <p>
                  Open an actual drawer or door. Shelves stay fixed; this preview never changes your
                  room or inventory.
                </p>
                <label>
                  Storage location
                  <select
                    aria-label="Preview storage location"
                    value={selectedSlot?.key ?? ""}
                    onChange={(event) =>
                      setStoragePreview({ assetId: asset.id, key: event.target.value })
                    }
                  >
                    <option value="">Closed · exterior view</option>
                    {storageSlots.map((slot) => (
                      <option key={slot.key} value={slot.key}>
                        {slot.name}
                        {slot.parentKey
                          ? ` — ${storageSlots.find((parent) => parent.key === slot.parentKey)?.name}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {slotParts[0]?.kind === "slide" && (
                  <label>
                    Opening panel
                    <select
                      aria-label="Opening panel"
                      value={openParts[0]?.id ?? ""}
                      onChange={(event) => setPanelId(event.target.value)}
                    >
                      {slotParts.map((part, index) => (
                        <option key={part.id} value={part.id}>
                          {part.region.z < 0 ? "Rear" : "Front"} · panel {index + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {selectedSlot && (
                  <button onClick={() => setStoragePreview({ assetId: asset.id, key: "" })}>
                    Close storage preview
                  </button>
                )}
              </section>
            )}
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
                  {asset.model3d ? "Current authored all-sided PBR GLB" : "Procedural PBR geometry"}
                </dd>
              </div>
            </dl>
            <div className="asset-lifecycle-action">
              <span>
                <b>Catalog visibility</b>
                <small>
                  Hide this definition from future Asset Library and WebMCP placement. Existing room
                  instances stay exactly where they are.
                </small>
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
