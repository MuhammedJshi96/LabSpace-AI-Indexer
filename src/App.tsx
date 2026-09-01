import {
  Component,
  useEffect,
  useState,
  type CSSProperties,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { AssetLibrary } from "./components/AssetLibrary";
import { BlueprintImportDialog } from "./components/BlueprintImportDialog";
import { Dialogs, Toasts } from "./components/Dialogs";
import { InspectorPanels } from "./components/InspectorPanels";
import { StatusBar } from "./components/StatusBar";
import { SplitViewDivider } from "./components/SplitViewDivider";
import { ThreeDView } from "./components/ThreeDView";
import { ToolRibbon } from "./components/ToolRibbon";
import { TopBar } from "./components/TopBar";
import { TwoDEditor } from "./components/TwoDEditor";
import { laboratoryFloorFinishLabel } from "./domain/laboratory-materials";
import { getClosedWallFloorPolygon } from "./domain/room-geometry";
import { selectActiveRoom, useEditorStore } from "./store/editor-store";

const SPLIT_RATIO_STORAGE_KEY = "labspace-split-view-ratio";
const ASSET_LIBRARY_COLLAPSED_KEY = "labspace-asset-library-collapsed";
const INSPECTOR_COLLAPSED_KEY = "labspace-inspector-collapsed";

function getInitialSplitRatio() {
  const saved = Number(window.localStorage.getItem(SPLIT_RATIO_STORAGE_KEY));
  return Number.isFinite(saved) && saved >= 30 && saved <= 72 ? saved : 61;
}

function getStoredCollapsedState(key: string) {
  return window.localStorage.getItem(key) === "true";
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

class RendererBoundary extends Component<
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
        <div className="renderer-fallback" role="alert">
          <b>{this.props.label} paused</b>
          <span>The editor shell is still safe. Retry this view to continue.</span>
          <button onClick={() => this.setState({ failed: false })}>Retry view</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const [splitRatio, setSplitRatio] = useState(getInitialSplitRatio);
  const [assetLibraryCollapsed, setAssetLibraryCollapsed] = useState(() =>
    getStoredCollapsedState(ASSET_LIBRARY_COLLAPSED_KEY),
  );
  const [inspectorCollapsed, setInspectorCollapsed] = useState(() =>
    getStoredCollapsedState(INSPECTOR_COLLAPSED_KEY),
  );
  const hydrate = useEditorStore((state) => state.hydrate);
  const hydrated = useEditorStore((state) => state.hydrated);
  const dirtyRevision = useEditorStore((state) => state.dirtyRevision);
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const saveNow = useEditorStore((state) => state.saveNow);
  const presentation = useEditorStore((state) => state.presentation);
  const setTool = useEditorStore((state) => state.setTool);
  const room = useEditorStore(selectActiveRoom);
  const roomFloor = getClosedWallFloorPolygon(room.scene.objects);
  const planSummary = roomFloor
    ? `${(roomFloor.bounds.width / 1000).toFixed(2)} × ${(roomFloor.bounds.depth / 1000).toFixed(2)} m · ${laboratoryFloorFinishLabel(room.floorFinish)}`
    : "No floor yet · close walls to set the room area";

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || window.location.pathname !== "/") return;
    const params = new URLSearchParams(window.location.search);
    if (![...params.keys()].length) return;
    let state = useEditorStore.getState();
    const roomId = params.get("room");
    const objectId = params.get("object");
    const locationId = params.get("location");
    const panel = params.get("panel");
    const dialog = params.get("dialog");
    const presentationMode = params.get("presentation");
    if (
      roomId &&
      roomId !== state.project.activeRoomId &&
      state.project.rooms.some((entry) => entry.id === roomId)
    ) {
      state.switchRoom(roomId);
      state = useEditorStore.getState();
    }
    const room = state.project.rooms.find((entry) => entry.id === state.project.activeRoomId);

    if (objectId && room?.scene.objects.some((entry) => entry.id === objectId)) {
      state.setSelected([objectId]);
    }
    if (locationId && room?.scene.storageLocations.some((entry) => entry.id === locationId)) {
      state.setSelectedLocation(locationId);
    }
    if (
      ["room", "layers", "index", "inventory", "properties", "validation"].includes(panel ?? "")
    ) {
      state.setPanel(
        panel as "room" | "layers" | "index" | "inventory" | "properties" | "validation",
      );
    }
    if (["reports", "labels", "inventory"].includes(dialog ?? "")) {
      state.setDialog(dialog as "reports" | "labels" | "inventory");
    }
    if (["2d", "split", "3d"].includes(presentationMode ?? "")) {
      state.setPresentation(presentationMode as "2d" | "split" | "3d");
    }
    window.history.replaceState({}, "", "/");
  }, [hydrated]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(SPLIT_RATIO_STORAGE_KEY, splitRatio.toFixed(2));
    }, 150);
    return () => window.clearTimeout(timer);
  }, [splitRatio]);

  useEffect(() => {
    window.localStorage.setItem(ASSET_LIBRARY_COLLAPSED_KEY, String(assetLibraryCollapsed));
  }, [assetLibraryCollapsed]);

  useEffect(() => {
    window.localStorage.setItem(INSPECTOR_COLLAPSED_KEY, String(inspectorCollapsed));
  }, [inspectorCollapsed]);

  useEffect(() => {
    if (!hydrated || saveStatus !== "unsaved" || dirtyRevision === 0) return;
    const timer = window.setTimeout(() => void saveNow(), 900);
    return () => window.clearTimeout(timer);
  }, [dirtyRevision, hydrated, saveNow, saveStatus]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return;
      const state = useEditorStore.getState();
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        state.redo();
        return;
      }
      if (mod && event.key.toLowerCase() === "c") {
        event.preventDefault();
        state.copySelected();
        return;
      }
      if (mod && event.key.toLowerCase() === "v") {
        event.preventDefault();
        state.pasteClipboard();
        return;
      }
      if (mod && event.key.toLowerCase() === "d") {
        event.preventDefault();
        state.duplicateSelected();
        return;
      }
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void state.saveNow();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        state.deleteSelected();
        return;
      }
      if (
        !mod &&
        !event.altKey &&
        state.tool === "select" &&
        ["arrowleft", "arrowright", "arrowup", "arrowdown", "w", "a", "s", "d"].includes(
          event.key.toLowerCase(),
        )
      )
        return;
      const tools = {
        v: "select",
        h: "pan",
        w: "wall",
        r: "rectangle",
        d: "door",
        o: "window",
        m: "measure",
      } as const;
      const tool = tools[event.key.toLowerCase() as keyof typeof tools];
      if (tool) setTool(tool);
      if (event.key === "/") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".asset-search-row input")?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [setTool]);

  return (
    <div className="app-shell">
      <TopBar />
      <ToolRibbon />
      <main
        className={`editor-main presentation-${presentation}${
          assetLibraryCollapsed ? " asset-library-collapsed" : ""
        }${inspectorCollapsed ? " inspector-collapsed" : ""}`}
      >
        <AssetLibrary
          key={room.id}
          collapsed={assetLibraryCollapsed}
          onCollapsedChange={setAssetLibraryCollapsed}
        />
        <div
          className="workspace-surface"
          style={{ "--split-plan-basis": `${splitRatio}%` } as CSSProperties}
        >
          {presentation !== "3d" && (
            <section id="plan-view-pane" className="plan-pane" aria-label="2D laboratory plan">
              <div className="pane-label">
                <span>2D plan</span>
                <em aria-label={planSummary} style={{ fontSize: 0 }}>
                  <span className="pane-label-value">{planSummary}</span>
                  {planSummary}
                </em>
              </div>
              <RendererBoundary label="2D plan">
                <TwoDEditor />
              </RendererBoundary>
            </section>
          )}
          {presentation === "split" && (
            <SplitViewDivider value={splitRatio} onChange={setSplitRatio} />
          )}
          <aside
            id="spatial-view-pane"
            className={`spatial-pane${inspectorCollapsed ? " inspector-collapsed" : ""}`}
            aria-label="3D view and inspector"
          >
            {hydrated && presentation !== "2d" && (
              <RendererBoundary label="3D room">
                <ThreeDView />
              </RendererBoundary>
            )}
            <InspectorPanels
              collapsed={inspectorCollapsed}
              onCollapsedChange={setInspectorCollapsed}
            />
          </aside>
        </div>
      </main>
      <StatusBar />
      {!hydrated && (
        <div className="app-loading">
          <img src="/labspace-mark.svg" alt="" />
          <span>
            <b>Opening LabSpace Indexer</b>Loading your laboratory project from local storage…
          </span>
        </div>
      )}
      <Dialogs />
      <BlueprintImportDialog />
      <Toasts />
    </div>
  );
}
