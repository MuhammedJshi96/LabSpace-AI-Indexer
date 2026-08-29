import {
  Buildings,
  CaretDown,
  CheckCircle,
  CloudArrowUp,
  ClipboardText,
  Cube,
  Database,
  GearSix,
  HouseLine,
  PresentationChart,
  ShareNetwork,
  WarningCircle,
} from "@phosphor-icons/react";
import { selectActiveRoom, useEditorStore } from "../store/editor-store";
import { WebMCPHeaderButton } from "./AgentActivityPanel";
import { RoomNavigator } from "./RoomNavigator";

type TopBarProps = {
  activeArea?: "facility" | "layout" | "digital-twin" | "inventory" | "asset-studio";
  contextLabel?: string;
};

export function TopBar({ activeArea = "layout", contextLabel = "Editable Layout" }: TopBarProps) {
  const room = useEditorStore(selectActiveRoom);
  const hasSavedDemo = useEditorStore((state) =>
    state.project.rooms.some((entry) => entry.roomKind === "demo"),
  );
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const setDialog = useEditorStore((state) => state.setDialog);
  const openLatestDemoRoom = useEditorStore((state) => state.openLatestDemoRoom);
  const saveNow = useEditorStore((state) => state.saveNow);
  const demoActive = room.roomKind === "demo";
  const statusLabel =
    saveStatus === "unsaved"
      ? "Unsaved changes"
      : saveStatus === "saving"
        ? "Saving locally…"
        : saveStatus === "error"
          ? "Save error"
          : saveStatus === "loading"
            ? "Opening project…"
            : "All changes saved";

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <button
          className="brand-lockup"
          onClick={() => setDialog("project")}
          title="Open laboratories and rooms"
          aria-label="Open project workspace"
        >
          <img src="/labspace-mark.svg" alt="" />
          <span className="brand-name-full">LabSpace AI Indexer</span>
          <span className="brand-name-compact">LabSpace AI</span>
        </button>
        <span className="top-divider" />
        <RoomNavigator />
        <span className="editable-badge">{contextLabel}</span>
      </div>

      <nav className="primary-navigation" aria-label="Primary application navigation">
        <a
          className={activeArea === "layout" ? "active" : ""}
          href="/"
          aria-current={activeArea === "layout" ? "page" : undefined}
        >
          <HouseLine size={19} weight="duotone" />
          <span>Layout Editor</span>
        </a>
        <a
          className={activeArea === "facility" ? "active" : ""}
          href="/facility"
          aria-current={activeArea === "facility" ? "page" : undefined}
          aria-label="Facility Manager"
        >
          <Buildings size={19} weight="duotone" />
          <span>Facility</span>
        </a>
        <a
          className={activeArea === "digital-twin" ? "active" : ""}
          href="/digital-twin"
          aria-current={activeArea === "digital-twin" ? "page" : undefined}
        >
          <Database size={19} weight="duotone" />
          <span>Spatial Index</span>
        </a>
        <a
          className={activeArea === "inventory" ? "active" : ""}
          href="/inventory"
          aria-current={activeArea === "inventory" ? "page" : undefined}
        >
          <ClipboardText size={19} weight="duotone" />
          <span>Inventory</span>
        </a>
        <a
          className={activeArea === "asset-studio" ? "active" : ""}
          href="/asset-preview"
          aria-current={activeArea === "asset-studio" ? "page" : undefined}
        >
          <Cube size={19} weight="duotone" />
          <span>Asset Studio</span>
        </a>
      </nav>

      <div className="top-bar-right">
        {activeArea !== "asset-studio" && activeArea !== "facility" && <WebMCPHeaderButton />}
        <button
          data-testid="demo-room-action"
          className={`header-demo-button${demoActive ? " active" : ""}`}
          onClick={() => {
            const roomId = openLatestDemoRoom();
            if (roomId) window.setTimeout(() => void useEditorStore.getState().saveNow(), 0);
          }}
          title={hasSavedDemo ? "Open the most recently saved Demo Room" : "Create a Demo Room"}
          aria-label={hasSavedDemo ? "Open saved Demo Room" : "Create Demo Room"}
          aria-pressed={demoActive}
        >
          <PresentationChart size={18} weight="duotone" />
          <span>Demo room</span>
        </button>
        <div className="header-save-control" title={statusLabel}>
          <button onClick={() => void saveNow()} aria-label="Save now">
            {saveStatus === "saved" ? (
              <CheckCircle size={18} weight="fill" />
            ) : saveStatus === "error" ? (
              <WarningCircle size={18} weight="fill" />
            ) : (
              <CloudArrowUp size={18} />
            )}
            <span>Save</span>
          </button>
          <button
            className="header-save-menu"
            onClick={() => setDialog("version")}
            aria-label="Save a named room version"
            title="Save a named room version"
          >
            <CaretDown size={15} />
          </button>
        </div>
        <button
          className="header-icon-button"
          onClick={() => setDialog("reports")}
          title="Share or export project evidence"
          aria-label="Share or export"
        >
          <ShareNetwork size={21} />
        </button>
        <button
          className="header-icon-button"
          onClick={() => setDialog("settings")}
          title="Application settings"
          aria-label="Application settings"
        >
          <GearSix size={22} />
        </button>
        <button
          className="header-avatar"
          onClick={() => setDialog("project")}
          title="Local user and project"
          aria-label="Open local user and project"
        >
          AD
        </button>
      </div>
    </header>
  );
}
