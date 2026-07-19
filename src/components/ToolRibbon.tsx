import {
  ArrowClockwise,
  ArrowCounterClockwise,
  CornersOut,
  Cursor,
  DoorOpen,
  FrameCorners,
  GridFour,
  Hand,
  LineSegment,
  Magnet,
  Minus,
  Plus,
  Ruler,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useEditorStore, type EditorTool } from "../store/editor-store";

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
        <ToolButton value="wall" label="Draw walls" shortcut="W" icon={<LineSegment size={19} />} />
        <ToolButton value="door" label="Door" shortcut="D" icon={<DoorOpen size={19} />} />
        <ToolButton value="window" label="Window" shortcut="O" icon={<FrameCorners size={19} />} />
        <ToolButton value="measure" label="Measure" shortcut="M" icon={<Ruler size={19} />} />
      </div>
      <span className="ribbon-divider" />
      <div className="tool-group compact-tools">
        <button
          className="tool-button compact"
          disabled={!history.length}
          onClick={undo}
          title="Undo (Ctrl+Z)"
        >
          <ArrowCounterClockwise size={19} />
          <span>Undo</span>
        </button>
        <button
          className="tool-button compact"
          disabled={!future.length}
          onClick={redo}
          title="Redo (Ctrl+Y)"
        >
          <ArrowClockwise size={19} />
          <span>Redo</span>
        </button>
      </div>
      <span className="ribbon-divider" />
      <div className="tool-group compact-tools">
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
