import {
  ArrowClockwise,
  ArrowCounterClockwise,
  Blueprint,
  CaretDown,
  CornersOut,
  Cursor,
  GridFour,
  Hand,
  LineSegment,
  Magnet,
  Minus,
  Polygon,
  Plus,
  Rectangle,
  Ruler,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEditorStore, type EditorTool, type MeasurementOverlayKey } from "../store/editor-store";

function ToolButton({
  value,
  label,
  shortcut,
  icon,
}: {
  value: EditorTool;
  label: string;
  shortcut?: string;
  icon: ReactNode;
}) {
  const active = useEditorStore((state) => state.tool === value);
  const setTool = useEditorStore((state) => state.setTool);
  return (
    <button
      className={`tool-button ${active ? "active" : ""}`}
      onClick={() => setTool(value)}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-pressed={active}
    >
      {icon}
      <span>{label}</span>
      {shortcut && <kbd>{shortcut}</kbd>}
    </button>
  );
}

export function ToolRibbon() {
  const tool = useEditorStore((state) => state.tool);
  const setTool = useEditorStore((state) => state.setTool);
  const wallKind = useEditorStore((state) => state.wallDrawKind);
  const setWallKind = useEditorStore((state) => state.setWallDrawKind);
  const [wallMenuOpen, setWallMenuOpen] = useState(false);
  const wallMenuRef = useRef<HTMLDivElement>(null);
  const [measurementMenuOpen, setMeasurementMenuOpen] = useState(false);
  const measurementMenuRef = useRef<HTMLDivElement>(null);
  const history = useEditorStore((state) => state.history);
  const future = useEditorStore((state) => state.future);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const grid = useEditorStore((state) => state.gridEnabled);
  const snap = useEditorStore((state) => state.snapEnabled);
  const toggleGrid = useEditorStore((state) => state.toggleGrid);
  const toggleSnap = useEditorStore((state) => state.toggleSnap);
  const zoom = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const setPan = useEditorStore((state) => state.setPan);
  const presentation = useEditorStore((state) => state.presentation);
  const setPresentation = useEditorStore((state) => state.setPresentation);
  const setDialog = useEditorStore((state) => state.setDialog);
  const measurementOverlays = useEditorStore((state) => state.measurementOverlays);
  const toggleMeasurementOverlay = useEditorStore((state) => state.toggleMeasurementOverlay);
  const activeMeasurements = Object.values(measurementOverlays).filter(Boolean).length;
  const constructionActive = ["wall", "rectangle", "annex"].includes(tool);
  const constructionLabel =
    tool === "rectangle"
      ? "Room shape"
      : tool === "annex"
        ? "Draw annex"
        : wallKind === "half"
          ? "Half walls"
          : "Draw walls";
  const constructionIcon =
    tool === "rectangle" ? (
      <Rectangle size={19} />
    ) : tool === "annex" ? (
      <Polygon size={19} />
    ) : (
      <LineSegment size={19} />
    );

  useEffect(() => {
    if (!wallMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (!wallMenuRef.current?.contains(event.target as Node)) setWallMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWallMenuOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [wallMenuOpen]);

  useEffect(() => {
    if (!measurementMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (!measurementMenuRef.current?.contains(event.target as Node))
        setMeasurementMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) =>
      event.key === "Escape" && setMeasurementMenuOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [measurementMenuOpen]);

  const measurementOptions: Array<{ key: MeasurementOverlayKey; label: string; detail: string }> = [
    { key: "overall", label: "Overall room", detail: "Width and depth frame" },
    { key: "walls", label: "Wall lengths", detail: "Every visible wall segment" },
    { key: "openings", label: "Doors and windows", detail: "Width, height and sill" },
    { key: "clearance", label: "Selected clearance", detail: "Nearest straight-line gaps" },
  ];
  return (
    <nav className="tool-ribbon" aria-label="Editor tools">
      <section className="ribbon-module ribbon-module-draw" aria-label="Drawing tools">
        <span className="ribbon-module-label">Draft</span>
        <div className="tool-group principal-tools">
          <ToolButton
            value="select"
            label="Select"
            shortcut="V"
            icon={<Cursor size={19} weight="duotone" />}
          />
          <ToolButton value="pan" label="Pan" shortcut="H" icon={<Hand size={19} />} />
          <div className="wall-drawing-control" ref={wallMenuRef}>
            <button
              className={`tool-button construction-tool ${constructionActive ? "active" : ""}`}
              onClick={() => setTool(tool === "rectangle" || tool === "annex" ? tool : "wall")}
              title={`${constructionLabel} · construction options`}
              aria-pressed={constructionActive}
            >
              {constructionIcon}
              <span>{constructionLabel}</span>
            </button>
            <button
              className="wall-kind-trigger"
              aria-label="Room construction options"
              aria-expanded={wallMenuOpen}
              onClick={() => setWallMenuOpen(!wallMenuOpen)}
            >
              <CaretDown size={14} />
            </button>
            {wallMenuOpen && (
              <div className="wall-kind-menu" aria-label="Room construction options">
                <header>
                  <b>Build room geometry</b>
                  <span>Walls remain editable after placement.</span>
                </header>
                <button
                  aria-pressed={tool === "wall" && wallKind === "full"}
                  onClick={() => {
                    setWallKind("full");
                    setWallMenuOpen(false);
                  }}
                >
                  <LineSegment size={19} />
                  <span>
                    <strong>Full-height wall</strong>
                    <small>Click point to point · close the outline for a floor</small>
                  </span>
                  <kbd>W</kbd>
                </button>
                <button
                  aria-pressed={tool === "wall" && wallKind === "half"}
                  onClick={() => {
                    setWallKind("half");
                    setWallMenuOpen(false);
                  }}
                >
                  <LineSegment size={19} />
                  <span>
                    <strong>Half-height wall</strong>
                    <small>1.2 m partition · height remains editable</small>
                  </span>
                </button>
                <button
                  aria-pressed={tool === "rectangle"}
                  onClick={() => {
                    setTool("rectangle");
                    setWallMenuOpen(false);
                  }}
                >
                  <Rectangle size={19} />
                  <span>
                    <strong>Rectangular room</strong>
                    <small>Drag corner to corner · attached shapes become annexes</small>
                  </span>
                  <kbd>R</kbd>
                </button>
                <button
                  aria-pressed={tool === "annex"}
                  onClick={() => {
                    setTool("annex");
                    setWallMenuOpen(false);
                  }}
                >
                  <Polygon size={19} />
                  <span>
                    <strong>Connected annex</strong>
                    <small>Start and finish on the same main-room exterior wall</small>
                  </span>
                </button>
                <p>Use the Asset Library for hosted doors and windows.</p>
              </div>
            )}
          </div>
          <ToolButton value="measure" label="Measure" shortcut="M" icon={<Ruler size={19} />} />
          <button
            className="tool-button blueprint-tool"
            aria-label="Blueprint"
            onClick={() => setDialog("blueprint")}
            title="Import a measured blueprint"
          >
            <Blueprint size={19} weight="duotone" />
            <span>Blueprint</span>
          </button>
        </div>
      </section>
      <section className="ribbon-module ribbon-module-history" aria-label="Edit history">
        <span className="ribbon-module-label">History</span>
        <div className="tool-group compact-tools">
          <button
            className="tool-button compact"
            disabled={!history.length}
            onClick={undo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <ArrowCounterClockwise size={19} />
            <span>Undo</span>
          </button>
          <button
            className="tool-button compact"
            disabled={!future.length}
            onClick={redo}
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
          >
            <ArrowClockwise size={19} />
            <span>Redo</span>
          </button>
        </div>
      </section>
      <section className="ribbon-module ribbon-module-assist" aria-label="Drawing assistance">
        <span className="ribbon-module-label">Assist</span>
        <div className="tool-group compact-tools measurement-tools">
          <button
            className={`toggle-tool ${grid ? "active" : ""}`}
            onClick={toggleGrid}
            aria-pressed={grid}
          >
            <GridFour size={18} weight={grid ? "fill" : "regular"} />
            <span>Grid</span>
          </button>
          <button
            className={`toggle-tool ${snap ? "active" : ""}`}
            onClick={toggleSnap}
            aria-pressed={snap}
          >
            <Magnet size={18} weight={snap ? "fill" : "regular"} />
            <span>Snap</span>
          </button>
          <div className="measurement-menu" ref={measurementMenuRef}>
            <button
              className={`toggle-tool measurement-trigger ${measurementMenuOpen ? "active" : ""}`}
              onClick={() => setMeasurementMenuOpen((open) => !open)}
              aria-expanded={measurementMenuOpen}
              aria-haspopup="menu"
            >
              <Ruler size={18} weight={activeMeasurements ? "fill" : "regular"} />
              <span>Dimensions</span>
              <small>{activeMeasurements}</small>
              <CaretDown size={12} />
            </button>
            {measurementMenuOpen && (
              <div className="measurement-popover" role="menu" aria-label="Automatic measurements">
                <header>
                  <b>Automatic measurements</b>
                  <span>Choose the evidence visible on the 2D plan.</span>
                </header>
                {measurementOptions.map((option) => (
                  <label key={option.key}>
                    <input
                      type="checkbox"
                      checked={measurementOverlays[option.key]}
                      onChange={() => toggleMeasurementOverlay(option.key)}
                    />
                    <span>
                      <b>{option.label}</b>
                      <small>{option.detail}</small>
                    </span>
                  </label>
                ))}
                <footer>
                  Manual tape measure remains available with <kbd>M</kbd>.
                </footer>
              </div>
            )}
          </div>
        </div>
      </section>
      <div className="ribbon-spacer" />
      <section className="ribbon-module ribbon-module-view" aria-label="Workspace view">
        <span className="ribbon-module-label">View</span>
        <div className="ribbon-view-controls">
          <div className="zoom-control" aria-label="Plan zoom">
            <button onClick={() => setZoom(zoom * 0.9)} title="Zoom out">
              <Minus size={17} />
            </button>
            <button
              className="zoom-value"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={() => setZoom(zoom * 1.1)} title="Zoom in">
              <Plus size={17} />
            </button>
          </div>
          <div className="presentation-control" aria-label="Workspace presentation">
            <button
              className={presentation === "2d" ? "active" : ""}
              onClick={() => setPresentation("2d")}
            >
              2D
            </button>
            <button
              className={presentation === "split" ? "active" : ""}
              onClick={() => setPresentation("split")}
            >
              Split
            </button>
            <button
              className={presentation === "3d" ? "active" : ""}
              onClick={() => setPresentation("3d")}
            >
              3D
            </button>
          </div>
          <button
            className="fullscreen-control"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else void document.documentElement.requestFullscreen();
            }}
            title="Toggle fullscreen"
            aria-label="Toggle fullscreen"
          >
            <CornersOut size={18} />
          </button>
        </div>
      </section>
    </nav>
  );
}
