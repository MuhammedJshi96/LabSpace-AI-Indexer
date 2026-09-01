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
  Plus,
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
  shortcut: string;
  icon: ReactNode;
}) {
  const active = useEditorStore((state) => state.tool === value);
  const setTool = useEditorStore((state) => state.setTool);
  return (
    <button
      className={`tool-button ${active ? "active" : ""}`}
      onClick={() => setTool(value)}
      title={`${label} (${shortcut})`}
      aria-pressed={active}
    >
      {icon}
      <span>{label}</span>
      <kbd>{shortcut}</kbd>
    </button>
  );
}

export function ToolRibbon() {
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
      <div className="tool-group principal-tools">
        <ToolButton
          value="select"
          label="Select"
          shortcut="V"
          icon={<Cursor size={19} weight="duotone" />}
        />
        <ToolButton value="pan" label="Pan" shortcut="H" icon={<Hand size={19} />} />
        <div className="wall-drawing-control" ref={wallMenuRef}>
          <ToolButton
            value="wall"
            label={wallKind === "half" ? "Half walls" : "Draw walls"}
            shortcut="W"
            icon={<LineSegment size={19} />}
          />
          <button
            className="wall-kind-trigger"
            aria-label="Wall drawing options"
            aria-expanded={wallMenuOpen}
            onClick={() => setWallMenuOpen(!wallMenuOpen)}
          >
            <CaretDown size={14} />
          </button>
          {wallMenuOpen && (
            <div className="wall-kind-menu" aria-label="Wall drawing options">
              <b>Draw a wall</b>
              {(["full", "half"] as const).map((kind) => (
                <button
                  key={kind}
                  aria-pressed={wallKind === kind}
                  onClick={() => {
                    setWallKind(kind);
                    setWallMenuOpen(false);
                  }}
                >
                  <LineSegment size={18} />
                  <span>
                    <strong>{kind === "full" ? "Full-height wall" : "Half-height wall"}</strong>
                    <small>
                      {kind === "full"
                        ? "Room height · defines the room outline"
                        : "1.2 m partition · editable in Details"}
                    </small>
                  </span>
                </button>
              ))}
              <p>Doors and windows are in the Asset Library.</p>
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
      <span className="ribbon-divider" />
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
      <span className="ribbon-divider" />
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
      <div className="ribbon-spacer" />
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
      <span className="ribbon-divider" />
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
    </nav>
  );
}
