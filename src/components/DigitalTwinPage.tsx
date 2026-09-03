import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import QRCode from "qrcode";
import {
  ArrowRight,
  Bell,
  CaretLeft,
  CaretRight,
  ChartBar,
  CheckCircle,
  CirclesThreePlus,
  Cube,
  Database,
  FileCsv,
  Flask,
  ListBullets,
  MagnifyingGlass,
  MapPin,
  Package,
  PlugsConnected,
  SquaresFour,
  WarningCircle,
  Wrench,
  X,
} from "@phosphor-icons/react";
import { getAssetDefinition } from "../domain/assets";
import { resolveStorageAccess } from "../domain/storage-access";
import {
  buildDigitalTwinIndex,
  filterDigitalTwinIndex,
  shouldAutoFocusDigitalTwinResult,
  type DigitalTwinMode as TwinMode,
  type DigitalTwinRecord as TwinRecord,
  type DigitalTwinScope,
} from "../domain/digital-twin-index";
import { hasLaboratoryEnvironmentProfile } from "../domain/laboratory-environment";
import { labSpaceNavigationActions } from "../agent/labspace-navigation-actions";
import { selectActiveRoom, useEditorStore } from "../store/editor-store";
import { AssetThumbnail } from "./AssetThumbnail";
import { Dialogs, Toasts } from "./Dialogs";
import { ThreeDView } from "./ThreeDView";
import { RenderQualityControl } from "./RenderQualityControl";
import { TopBar } from "./TopBar";
import { CollectionGuide } from "./CollectionGuide";
import { ProcessTracker } from "./ProcessTracker";
import { TwoDEditor } from "./TwoDEditor";
import { useCollectionStore } from "../agent/labspace-collection-actions";

class TwinRendererBoundary extends Component<
  { children: ReactNode; label: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`${this.props.label} renderer failed`, error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="twin-renderer-fallback" role="alert">
          <WarningCircle size={28} weight="duotone" />
          <span>
            <b>{this.props.label} paused</b>
            The index and record details are still available. Retry this view when ready.
          </span>
          <button onClick={() => this.setState({ failed: false })}>Retry view</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function RecordImage({ record }: { record: TwinRecord }) {
  if (record.imageSrc) {
    return (
      <figure className="twin-record-image twin-record-image-photographic">
        <img
          src={record.imageSrc}
          alt={`${record.name} evidence image`}
          className="twin-record-photo"
        />
        <figcaption className="twin-image-caption">
          {record.imageCaption ?? "Record image"}
        </figcaption>
      </figure>
    );
  }
  if (!record.assetDefinitionId) {
    return (
      <div className="twin-record-image twin-record-image-empty">
        <Package size={42} weight="duotone" />
        <span>Assign a location to show its spatial asset.</span>
      </div>
    );
  }
  const asset = getAssetDefinition(record.assetDefinitionId);
  return (
    <div className="twin-record-image">
      <AssetThumbnail asset={asset} className="twin-record-thumbnail" />
      <span className="twin-image-caption">Spatial asset · {asset.shortName}</span>
    </div>
  );
}

function StatusPill({ record }: { record: TwinRecord }) {
  return (
    <span className={`twin-status twin-status-${record.statusTone}`}>
      {record.statusTone === "ok" ? (
        <CheckCircle size={14} weight="fill" />
      ) : record.statusTone === "warning" ? (
        <WarningCircle size={14} weight="fill" />
      ) : (
        <span className="twin-status-dot" />
      )}
      {record.status}
    </span>
  );
}

function readableRecordText(value: string) {
  return value
    .replaceAll("\u0622\u00b7", "·")
    .replaceAll("\u0623\u2014", "×")
    .replaceAll("\u00e2\u20ac\u0153", "“")
    .replaceAll("\u00e2\u20ac\u200c", "”")
    .replaceAll("\u00e2\u20ac\u00a6", "…");
}

const navItems: Array<{
  mode: TwinMode;
  label: string;
  icon: typeof SquaresFour;
}> = [
  { mode: "browse", label: "Browse", icon: SquaresFour },
  { mode: "inventory", label: "Inventory", icon: Package },
  { mode: "equipment", label: "Equipment", icon: Wrench },
  { mode: "locations", label: "Locations", icon: MapPin },
  { mode: "alerts", label: "Alerts", icon: Bell },
];

export function DigitalTwinPage() {
  const [processOpen, setProcessOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<TwinMode>("browse");
  const [scope, setScope] = useState<DigitalTwinScope>("project");
  const [wallCutaway, setWallCutaway] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const resultListRef = useRef<HTMLDivElement>(null);
  const [resultScrollState, setResultScrollState] = useState({ backward: false, forward: false });
  const hydrate = useEditorStore((state) => state.hydrate);
  const hydrated = useEditorStore((state) => state.hydrated);
  const dirtyRevision = useEditorStore((state) => state.dirtyRevision);
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const saveNow = useEditorStore((state) => state.saveNow);
  const project = useEditorStore((state) => state.project);
  const visibleRoomCount = project.rooms.filter(
    (entry) => entry.roomKind !== "demo-template",
  ).length;
  const room = useEditorStore(selectActiveRoom);
  const spatialFocus = useEditorStore((state) => state.spatialFocus);
  const setSpatialStorageAccess = useEditorStore((state) => state.setSpatialStorageAccess);
  const selectedRecordId = useEditorStore((state) => state.digitalTwinSelectedRecordId);
  const setSelectedRecordId = useEditorStore((state) => state.setDigitalTwinSelectedRecord);
  const spatialMode = useEditorStore((state) => state.digitalTwinSpatialMode);
  const setSpatialMode = useEditorStore((state) => state.setDigitalTwinSpatialMode);
  const setSelected = useEditorStore((state) => state.setSelected);
  const setSelectedLocation = useEditorStore((state) => state.setSelectedLocation);
  const pushToast = useEditorStore((state) => state.pushToast);
  const environmentContextVisible = useEditorStore((state) => state.environmentContextVisible);
  const toggleEnvironmentContext = useEditorStore((state) => state.toggleEnvironmentContext);
  const collectionRoute = useCollectionStore((state) => state.route);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || saveStatus !== "unsaved" || dirtyRevision === 0) return;
    const timer = window.setTimeout(() => void saveNow(), 900);
    return () => window.clearTimeout(timer);
  }, [dirtyRevision, hydrated, saveNow, saveStatus]);

  const laboratory = project.laboratories.find((entry) => entry.id === room.laboratoryId);
  const allRecords = useMemo(() => buildDigitalTwinIndex(project), [project]);
  const scopedRecords = useMemo(
    () =>
      scope === "room" ? allRecords.filter((record) => record.roomId === room.id) : allRecords,
    [allRecords, room.id, scope],
  );

  const filteredRecords = useMemo(
    () =>
      filterDigitalTwinIndex(allRecords, {
        query,
        mode,
        scope,
        activeRoomId: room.id,
      }),
    [allRecords, mode, query, room.id, scope],
  );
  const showResultStrip = Boolean(query.trim() || mode !== "browse");
  const resultModeLabel = navItems.find((item) => item.mode === mode)?.label ?? "Spatial Index";

  useEffect(() => {
    const list = resultListRef.current;
    if (!list || !showResultStrip) {
      setResultScrollState({ backward: false, forward: false });
      return;
    }
    const update = () => {
      const maximum = Math.max(0, list.scrollWidth - list.clientWidth);
      setResultScrollState({
        backward: list.scrollLeft > 2,
        forward: list.scrollLeft < maximum - 2,
      });
    };
    list.scrollLeft = 0;
    const frame = window.requestAnimationFrame(update);
    list.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(frame);
      list.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [filteredRecords.length, mode, query, showResultStrip]);

  const scrollResultList = (direction: -1 | 1) => {
    const list = resultListRef.current;
    if (!list) return;
    list.scrollBy({
      left: direction * Math.max(280, list.clientWidth * 0.72),
      behavior: "smooth",
    });
  };

  const effectiveSelectedRecordId = allRecords.some((record) => record.id === selectedRecordId)
    ? selectedRecordId
    : null;
  const selectedRecord = allRecords.find((record) => record.id === effectiveSelectedRecordId);
  const focusMatchesSelectedRecord = Boolean(
    selectedRecord &&
    spatialFocus?.recordId === selectedRecord.id &&
    spatialFocus.roomId === room.id,
  );
  const workflowWorkspaceFocus = Boolean(
    spatialFocus?.recordId.startsWith("workflow-workspace:") && spatialFocus.roomId === room.id,
  );
  const workflowWorkspaceObject = workflowWorkspaceFocus
    ? room.scene.objects.find((object) => object.id === spatialFocus?.objectId && object.visible)
    : undefined;
  const workflowWorkspaceAsset = workflowWorkspaceObject?.assetDefinitionId
    ? getAssetDefinition(workflowWorkspaceObject.assetDefinitionId)
    : undefined;
  const workflowWorkspaceSnapshot =
    workflowWorkspaceObject &&
    collectionRoute?.workspace?.objectId === workflowWorkspaceObject.id &&
    collectionRoute.workspace.roomId === room.id
      ? collectionRoute.workspace
      : undefined;
  const workflowWorkspacePath =
    workflowWorkspaceSnapshot?.path ??
    (workflowWorkspaceObject
      ? [
          laboratory?.name ?? "Laboratory",
          room.name,
          room.scene.zones.find((zone) => zone.id === workflowWorkspaceObject.zoneId)?.name,
          workflowWorkspaceObject.name,
        ].filter((entry): entry is string => Boolean(entry))
      : []);
  const focusedObjectId =
    focusMatchesSelectedRecord || workflowWorkspaceFocus ? (spatialFocus?.objectId ?? null) : null;
  const storageAccessOpen = Boolean(focusMatchesSelectedRecord && spatialFocus?.showStorageAccess);
  const accessRoom = project.rooms.find((entry) => entry.id === selectedRecord?.roomId);
  const accessObject = accessRoom?.scene.objects.find(
    (entry) => entry.id === selectedRecord?.objectId,
  );
  const storageAccess =
    accessObject && selectedRecord?.locationId && accessRoom
      ? resolveStorageAccess(
          accessObject.assetDefinitionId,
          accessObject.id,
          selectedRecord.locationId,
          accessRoom.scene.storageLocations,
        )
      : null;

  useEffect(() => {
    // An explicit focus/access action wins over a pending search debounce.
    // Otherwise the timer can silently close a drawer just opened by the user.
    if (focusMatchesSelectedRecord || !shouldAutoFocusDigitalTwinResult(query, selectedRecord))
      return;
    const handle = window.setTimeout(() => {
      setSpatialMode("3d");
      if (selectedRecord) {
        labSpaceNavigationActions.focusLabRecord(
          { recordId: selectedRecord.id },
          { revealStorage: true },
        );
      }
    }, 320);
    return () => window.clearTimeout(handle);
  }, [focusMatchesSelectedRecord, query, selectedRecord, setSpatialMode]);

  useEffect(() => {
    let active = true;
    if (!selectedRecord) {
      return () => {
        active = false;
      };
    }
    void QRCode.toDataURL(
      JSON.stringify({
        type: `labspace-${selectedRecord.kind}`,
        id: selectedRecord.id,
        indexCode: selectedRecord.indexCode,
      }),
      {
        width: 132,
        margin: 1,
        color: { dark: "#14211f", light: "#ffffff" },
      },
    ).then((url) => {
      if (active) setQrCode(url);
    });
    return () => {
      active = false;
    };
  }, [selectedRecord]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
        return;
      event.preventDefault();
      document.querySelector<HTMLInputElement>("#digital-twin-search")?.focus();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const selectRecord = (record: TwinRecord) => {
    setSelectedRecordId(record.id);
    if (!record.objectId) {
      setSelected([]);
      setSelectedLocation(null);
      return;
    }
    try {
      labSpaceNavigationActions.focusLabRecord({ recordId: record.id }, { revealStorage: true });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Record could not be focused.", "error");
    }
  };

  const submitIndexSearch = () => {
    const trimmed = query.trim();
    setQuery(trimmed);
    if (trimmed && filteredRecords.length === 1) selectRecord(filteredRecords[0]);
  };

  const navigateToRecord = () => {
    if (!selectedRecord?.objectId) return;
    setSpatialMode("3d");
    try {
      labSpaceNavigationActions.focusLabRecord(
        { recordId: selectedRecord.id },
        { revealStorage: true },
      );
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Record could not be focused.", "error");
    }
  };

  const counts = {
    inventory: scopedRecords.filter((record) => record.kind === "inventory").length,
    equipment: scopedRecords.filter((record) => record.kind === "equipment").length,
    locations: scopedRecords.filter((record) => record.kind === "location").length,
    alerts: scopedRecords.filter((record) => record.statusTone === "warning").length,
  };

  if (!hydrated) {
    return (
      <div className="digital-twin-shell twin-loading-shell" data-testid="digital-twin-page">
        <div className="twin-loading" role="status">
          <img src="/labspace-mark.svg" alt="" />
          <span>
            <b>Opening the spatial index</b>
            Loading the current project and laboratory records…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="digital-twin-shell" data-testid="digital-twin-page">
      <TopBar activeArea="digital-twin" contextLabel="Indexed Room Evidence" />
      <section className="twin-command-bar" aria-label="Spatial Index Finder command bar">
        <div className="twin-brand">
          <img src="/labspace-mark.svg" alt="" />
          <span>
            <b>Spatial Index Finder</b>
            <small>{project.name}</small>
          </span>
        </div>
        <form
          className="twin-search"
          onSubmit={(event) => {
            event.preventDefault();
            submitIndexSearch();
          }}
        >
          <Database size={20} weight="duotone" />
          <input
            id="digital-twin-search"
            aria-label="Search spatial index"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search equipment, inventory, rooms, cabinets, drawers, shelves, or codes…"
            autoComplete="off"
          />
          {query.trim() ? (
            <button
              className="twin-search-clear"
              type="button"
              aria-label="Clear command"
              onClick={() => {
                setQuery("");
              }}
            >
              <X size={15} />
            </button>
          ) : (
            <kbd>/</kbd>
          )}
          <button
            className="twin-search-submit"
            type="submit"
            aria-label="Find indexed records"
            disabled={!query.trim()}
          >
            Find
            <MagnifyingGlass size={16} weight="bold" />
          </button>
        </form>
        <div className="twin-top-actions">
          <RenderQualityControl />
          <button
            className={spatialMode === "2d" ? "active" : ""}
            onClick={() => setSpatialMode(spatialMode === "3d" ? "2d" : "3d")}
          >
            {spatialMode === "3d" ? <ListBullets size={18} /> : <Cube size={18} />}
            {spatialMode === "3d" ? "2D fallback" : "Return to 3D"}
          </button>
          <label className="twin-cutaway">
            <span>Wall cutaway</span>
            <input
              type="checkbox"
              aria-label="Wall cutaway"
              checked={wallCutaway}
              onChange={(event) => setWallCutaway(event.target.checked)}
            />
            <i aria-hidden="true" />
          </label>
          {hasLaboratoryEnvironmentProfile(room) && (
            <label className="twin-cutaway twin-context-toggle">
              <span>Room context</span>
              <input
                type="checkbox"
                aria-label="Room context"
                checked={environmentContextVisible}
                onChange={toggleEnvironmentContext}
              />
              <i aria-hidden="true" />
            </label>
          )}
        </div>
      </section>

      <div className="twin-body">
        <nav className="twin-nav" aria-label="Digital twin sections">
          <div className="twin-nav-heading">
            <Flask size={22} weight="duotone" />
            <span>Spatial index</span>
          </div>
          <fieldset className="twin-scope">
            <legend>Search scope</legend>
            <div>
              <button
                type="button"
                className={scope === "project" ? "active" : ""}
                aria-pressed={scope === "project"}
                onClick={() => setScope("project")}
              >
                All labs
              </button>
              <button
                type="button"
                className={scope === "room" ? "active" : ""}
                aria-pressed={scope === "room"}
                onClick={() => setScope("room")}
              >
                This room
              </button>
            </div>
            <small>
              {scope === "project"
                ? `${project.laboratories.length} ${project.laboratories.length === 1 ? "lab" : "labs"} · ${visibleRoomCount} ${visibleRoomCount === 1 ? "room" : "rooms"}`
                : `${laboratory?.code ?? "LAB"} · ${room.code}`}
            </small>
          </fieldset>
          <div className="twin-nav-items">
            {navItems.map((item) => {
              const Icon = item.icon;
              const count = item.mode === "browse" ? scopedRecords.length : counts[item.mode];
              return (
                <button
                  key={item.mode}
                  className={mode === item.mode ? "active" : ""}
                  onClick={() => setMode(item.mode)}
                  aria-current={mode === item.mode ? "page" : undefined}
                >
                  <Icon size={21} weight={mode === item.mode ? "duotone" : "regular"} />
                  <span>{item.label}</span>
                  <em>{count}</em>
                </button>
              );
            })}
          </div>
          <div className="twin-nav-secondary">
            <button
              className="process-tracker-trigger"
              aria-pressed={processOpen}
              onClick={() => setProcessOpen(!processOpen)}
            >
              <Database size={20} />
              <span>Process tracker</span>
            </button>
            <a href="/?dialog=reports">
              <FileCsv size={20} />
              <span>Reports</span>
            </a>
            <a href="/">
              <CirclesThreePlus size={20} />
              <span>Layout editor</span>
            </a>
          </div>
          <div className="twin-nav-room">
            <span>{scope === "project" ? "Viewing room" : "Current room scope"}</span>
            <b>{room.name}</b>
            <small>
              {laboratory?.name ?? "Laboratory"} · {laboratory?.code ?? "LAB"}/{room.code}
            </small>
          </div>
        </nav>

        <main className={`twin-workspace ${showResultStrip ? "with-results" : "scene-only"}`}>
          <section className="twin-scene" aria-label="Spatial laboratory index">
            <div className="twin-scene-mode">
              <span className="twin-live-dot" />
              {spatialMode === "3d" ? "Live spatial model" : "Canonical 2D fallback"}
            </div>
            {spatialMode === "3d" ? (
              <TwinRendererBoundary label="3D spatial index">
                <ThreeDView
                  focusObjectId={focusedObjectId}
                  focusLocationId={focusedObjectId ? spatialFocus?.locationId : null}
                  presentation="digital-twin"
                  wallTransparentOverride={wallCutaway}
                  showStorageAccess={Boolean(
                    storageAccessOpen &&
                    focusedObjectId &&
                    selectedRecord?.locationId &&
                    storageAccess?.parts.length,
                  )}
                />
              </TwinRendererBoundary>
            ) : (
              <TwinRendererBoundary label="2D plan">
                <div className="twin-plan-fallback">
                  <TwoDEditor />
                </div>
              </TwinRendererBoundary>
            )}
            <div className="twin-scene-legend">
              <span>
                <i /> Selected indexed asset
              </span>
              <span>
                <PlugsConnected size={15} /> Orbit, pan, and zoom to inspect
              </span>
            </div>
          </section>

          {showResultStrip && (
            <section className="twin-results" aria-label="Search results">
              <header>
                <span>
                  <b>{filteredRecords.length}</b>
                  {filteredRecords.length === 1 ? " matching record" : " matching records"}
                </span>
                <small>
                  {query
                    ? `Results for “${query}”`
                    : `${navItems.find((item) => item.mode === mode)?.label} · ${
                        scope === "project" ? "entire project" : room.name
                      }`}
                </small>
                <span
                  className="twin-result-scroll-controls"
                  aria-label={`Scroll ${resultModeLabel.toLowerCase()} result row`}
                >
                  <button
                    type="button"
                    aria-label={`Scroll ${resultModeLabel.toLowerCase()} row left`}
                    disabled={!resultScrollState.backward}
                    onClick={() => scrollResultList(-1)}
                  >
                    <CaretLeft size={16} weight="bold" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Scroll ${resultModeLabel.toLowerCase()} row right`}
                    disabled={!resultScrollState.forward}
                    onClick={() => scrollResultList(1)}
                  >
                    <CaretRight size={16} weight="bold" />
                  </button>
                </span>
              </header>
              <div
                ref={resultListRef}
                className="twin-result-list"
                tabIndex={0}
                aria-label={`${resultModeLabel} result row`}
                onWheel={(event) => {
                  const list = event.currentTarget;
                  if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
                  const maximum = Math.max(0, list.scrollWidth - list.clientWidth);
                  const canConsume =
                    event.deltaY > 0 ? list.scrollLeft < maximum - 2 : list.scrollLeft > 2;
                  if (!canConsume) return;
                  event.preventDefault();
                  list.scrollLeft += event.deltaY;
                }}
              >
                {filteredRecords.map((record) => (
                  <button
                    key={record.id}
                    className={selectedRecord?.id === record.id ? "selected" : ""}
                    onClick={(event) => {
                      if (event.detail > 1) return;
                      if (selectedRecord?.id === record.id) setSelected([]);
                      else selectRecord(record);
                    }}
                    aria-pressed={selectedRecord?.id === record.id}
                    data-testid="digital-twin-record"
                  >
                    {record.imageSrc ? (
                      <img
                        className="twin-result-photo"
                        src={record.imageSrc}
                        alt=""
                        loading="lazy"
                      />
                    ) : record.assetDefinitionId ? (
                      <AssetThumbnail asset={getAssetDefinition(record.assetDefinitionId)} />
                    ) : (
                      <span className="twin-result-empty">
                        <Package size={27} />
                      </span>
                    )}
                    <span className="twin-result-copy">
                      <b className="twin-result-name">{record.name}</b>
                      <em>{record.kicker}</em>
                      <small className="twin-result-index">{record.indexCode}</small>
                      <span className="twin-result-path" title={record.path.join(" / ")}>
                        {record.path.length
                          ? record.path.slice(-2).join(" / ")
                          : "Location not assigned"}
                      </span>
                      <span className="twin-result-room">
                        {record.laboratoryCode} / {record.roomCode}
                      </span>
                      <StatusPill record={record} />
                    </span>
                    <span className="twin-result-value">
                      <b>{record.primaryValue}</b>
                      <small>{record.primaryLabel}</small>
                    </span>
                  </button>
                ))}
                {!filteredRecords.length && (
                  <div className="twin-empty-results">
                    <MagnifyingGlass size={28} weight="duotone" />
                    <span>
                      <b>No indexed records match this search.</b>
                      Try an item name, equipment ID, owner, room, zone, cabinet, shelf, or drawer.
                    </span>
                    <button
                      onClick={() => {
                        setQuery("");
                        setMode("browse");
                      }}
                    >
                      Clear search
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}
        </main>

        <aside className="twin-detail" aria-label="Selected record details">
          {!processOpen && <CollectionGuide embedded />}
          {processOpen ? (
            <ProcessTracker onClose={() => setProcessOpen(false)} />
          ) : workflowWorkspaceObject ? (
            <>
              <header className="twin-detail-heading twin-workflow-heading">
                <span>
                  <small>
                    Workflow workspace · {laboratory?.code ?? "LAB"}/{room.code}
                  </small>
                  <h1>{workflowWorkspaceObject.name}</h1>
                </span>
                <span className="twin-status twin-status-ok">
                  <CheckCircle size={14} weight="fill" />
                  Ready to review
                </span>
              </header>
              <div className="twin-detail-scroll">
                <section className="twin-workflow-proof" aria-label="Workflow evidence handoff">
                  <header>
                    <span>Ask</span>
                    <span>Ground</span>
                    <span>Collect</span>
                    <span className="active">Decide</span>
                  </header>
                  <div>
                    <CheckCircle size={22} weight="fill" />
                    <span>
                      <small>Evidence handoff</small>
                      <b>Materials lead to a real work surface</b>
                      <p>
                        The itinerary ends here after its indexed inventory stops. Review the
                        surface, local clearance, and your approved method before work begins.
                      </p>
                    </span>
                  </div>
                </section>

                <dl className="twin-record-facts twin-workflow-facts">
                  <div>
                    <dt>Authored surface</dt>
                    <dd>{workflowWorkspaceAsset?.shortName ?? "Research workspace"}</dd>
                  </div>
                  <div>
                    <dt>Evidence itinerary</dt>
                    <dd>
                      {collectionRoute ? collectionRoute.recordIds.length + 1 : 1} stops ·{" "}
                      {collectionRoute?.checked.length ?? 0} human-confirmed
                    </dd>
                  </div>
                </dl>

                <section className="twin-location-card twin-workflow-location">
                  <header>
                    <MapPin size={18} weight="duotone" />
                    <span>
                      <small>Final workspace</small>
                      <b>{workflowWorkspaceObject.indexCode}</b>
                    </span>
                  </header>
                  <ol>
                    {workflowWorkspacePath.map((entry, index) => (
                      <li key={`${entry}-${index}`}>
                        <span />
                        {entry}
                      </li>
                    ))}
                  </ol>
                </section>

                <section className="twin-notes twin-workflow-boundary">
                  <small>Research boundary</small>
                  <p>
                    This is an ordered evidence itinerary—not a safe walking route, protocol,
                    suitability decision, reservation, or stock transaction. The researcher keeps
                    the final decision.
                  </p>
                </section>
              </div>
              <div className="twin-detail-actions twin-workflow-actions">
                <a
                  href={`/?room=${encodeURIComponent(room.id)}&object=${encodeURIComponent(workflowWorkspaceObject.id)}&panel=properties`}
                >
                  Open workspace in editor
                </a>
              </div>
            </>
          ) : selectedRecord ? (
            <>
              <header className="twin-detail-heading">
                <span>
                  <small>
                    {selectedRecord.kicker} · {selectedRecord.laboratoryCode}/
                    {selectedRecord.roomCode}
                  </small>
                  <h1>{selectedRecord.name}</h1>
                </span>
                <div className="twin-detail-heading-actions">
                  <StatusPill record={selectedRecord} />
                  <button
                    className="twin-clear-selection"
                    onClick={() => setSelected([])}
                    aria-label="Clear selection"
                    title="Clear selection (Escape)"
                  >
                    <X size={17} /> Clear
                  </button>
                </div>
              </header>
              <div className="twin-detail-scroll">
                <RecordImage record={selectedRecord} />
                <dl className="twin-record-facts">
                  <div>
                    <dt>{selectedRecord.primaryLabel}</dt>
                    <dd>{selectedRecord.primaryValue}</dd>
                  </div>
                  <div>
                    <dt>{selectedRecord.secondaryLabel}</dt>
                    <dd>{selectedRecord.secondaryValue}</dd>
                  </div>
                </dl>
                <section className="twin-location-card">
                  <header>
                    <MapPin size={18} weight="duotone" />
                    <span>
                      <small>Exact location</small>
                      <b>{selectedRecord.indexCode}</b>
                    </span>
                  </header>
                  <ol>
                    {selectedRecord.path.map((entry, index) => (
                      <li key={`${entry}-${index}`}>
                        <span />
                        {entry}
                      </li>
                    ))}
                  </ol>
                  {!selectedRecord.path.length && (
                    <p>This record still needs a physical location.</p>
                  )}
                </section>
                <section className="twin-notes">
                  <small>Record notes</small>
                  <p>{readableRecordText(selectedRecord.notes)}</p>
                </section>
                <div className="twin-qr-row">
                  {qrCode && <img src={qrCode} alt={`QR code for ${selectedRecord.indexCode}`} />}
                  <span>
                    <Database size={18} weight="duotone" />
                    <b>Stable indexed identity</b>
                    Scan or print this code for the selected record.
                  </span>
                </div>
              </div>
              <div className="twin-detail-actions">
                <button
                  className="primary"
                  onClick={navigateToRecord}
                  disabled={!selectedRecord.objectId}
                >
                  <MapPin size={18} weight="fill" />
                  Navigate to location
                  <ArrowRight size={17} />
                </button>
                {selectedRecord.locationId && selectedRecord.objectId && (
                  <>
                    <button
                      className="storage-preview-toggle"
                      type="button"
                      disabled={!storageAccess?.parts.length}
                      onClick={() => {
                        setSpatialMode("3d");
                        setSpatialStorageAccess(!storageAccessOpen);
                      }}
                      aria-pressed={storageAccessOpen && Boolean(storageAccess?.parts.length)}
                      aria-describedby="storage-access-note"
                      data-storage-parts={
                        storageAccess?.parts.map((part) => part.id).join("|") ?? ""
                      }
                    >
                      <Cube size={17} weight="duotone" />
                      {storageAccessOpen && storageAccess?.parts.length
                        ? "Close access preview"
                        : "Show access preview"}
                    </button>
                    <p id="storage-access-note" className="storage-access-note">
                      {storageAccess?.reason ??
                        `${storageAccess?.description}. Visual preview only; no inventory or room data changes.`}
                    </p>
                    {!storageAccess?.parts.length && !storageAccess?.region && (
                      <a
                        className="storage-repair-link"
                        href={`/inventory?view=storage&room=${encodeURIComponent(selectedRecord.roomId)}&object=${encodeURIComponent(selectedRecord.objectId)}&location=${encodeURIComponent(selectedRecord.locationId)}`}
                      >
                        Link this record to a physical location →
                      </a>
                    )}
                  </>
                )}
                <a
                  href={`/?room=${encodeURIComponent(selectedRecord.roomId)}&object=${encodeURIComponent(selectedRecord.objectId ?? "")}&location=${encodeURIComponent(selectedRecord.locationId ?? "")}&panel=${selectedRecord.kind === "location" ? "index" : "properties"}`}
                >
                  Open record in editor
                </a>
              </div>
            </>
          ) : (
            <div className="twin-detail-empty">
              <ChartBar size={34} weight="duotone" />
              <span>
                <b>Select an indexed record</b>
                Search inventory, equipment, or exact storage locations to reveal them in the room.
              </span>
            </div>
          )}
        </aside>
      </div>
      <footer className="twin-footer-status" aria-label="Spatial Index status">
        <span>
          Scope: <b>{scope === "project" ? "All laboratories" : room.name}</b>
        </span>
        <span>
          Indexed records: <b>{scopedRecords.length}</b>
        </span>
        <span>
          Scene: <b>{spatialMode === "3d" ? "Live 3D" : "Canonical 2D"}</b>
        </span>
        <span className="twin-footer-grounding">
          <Database size={15} weight="fill" /> Local spatial index
        </span>
      </footer>
      <Dialogs />
      <Toasts />
    </div>
  );
}
