import { DotsSixVertical } from "@phosphor-icons/react";
import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";

const MIN_PLAN_WIDTH = 390;
const MIN_SPATIAL_WIDTH = 380;
const DIVIDER_WIDTH = 10;
const MIN_RATIO = 30;
const MAX_RATIO = 72;

type SplitViewDividerProps = {
  value: number;
  onChange: (value: number) => void;
};

type DragState = {
  pointerId: number;
  left: number;
  width: number;
};

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return Math.min(max, Math.max(min, 57));
  return Math.min(max, Math.max(min, value));
}

function getRatioBounds(width: number) {
  const safeWidth = Number.isFinite(width) ? Math.max(width, 1) : 1;
  const min = Math.max(MIN_RATIO, (MIN_PLAN_WIDTH / safeWidth) * 100);
  const max = Math.min(
    MAX_RATIO,
    ((safeWidth - MIN_SPATIAL_WIDTH - DIVIDER_WIDTH) / safeWidth) * 100,
  );

  if (min > max) {
    const midpoint = 50;
    return { min: midpoint, max: midpoint };
  }

  return { min, max };
}

export function SplitViewDivider({ value, onChange }: SplitViewDividerProps) {
  const dividerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<DragState | null>(null);

  useEffect(() => {
    const workspace = dividerRef.current?.parentElement;
    if (!workspace || typeof ResizeObserver === "undefined") return;
    const keepRatioUsable = () => {
      const bounds = getRatioBounds(workspace.getBoundingClientRect().width);
      const next = clamp(value, bounds.min, bounds.max);
      if (Math.abs(next - value) > 0.01) onChange(next);
    };
    keepRatioUsable();
    const observer = new ResizeObserver(keepRatioUsable);
    observer.observe(workspace);
    return () => observer.disconnect();
  }, [onChange, value]);

  const updateFromClientX = (clientX: number, drag: DragState) => {
    const bounds = getRatioBounds(drag.width);
    const next = ((clientX - drag.left) / drag.width) * 100;
    onChange(clamp(next, bounds.min, bounds.max));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const workspace = event.currentTarget.parentElement;
    if (!workspace) return;

    event.preventDefault();
    const rect = workspace.getBoundingClientRect();
    const nextDrag = {
      pointerId: event.pointerId,
      left: rect.left,
      width: rect.width,
    };
    dragState.current = nextDrag;
    event.currentTarget.dataset.dragging = "true";
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromClientX(event.clientX, nextDrag);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    updateFromClientX(event.clientX, drag);
  };

  const finishPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragState.current = null;
    delete event.currentTarget.dataset.dragging;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const workspace = dividerRef.current?.parentElement;
    if (!workspace) return;
    const { width } = workspace.getBoundingClientRect();
    const bounds = getRatioBounds(width);
    const step = event.shiftKey ? 5 : 2;
    let next = value;

    if (event.key === "ArrowLeft") next -= step;
    else if (event.key === "ArrowRight") next += step;
    else if (event.key === "Home") next = bounds.min;
    else if (event.key === "End") next = bounds.max;
    else return;

    event.preventDefault();
    onChange(clamp(next, bounds.min, bounds.max));
  };

  const resetRatio = () => {
    const workspace = dividerRef.current?.parentElement;
    if (!workspace) return onChange(57);
    const bounds = getRatioBounds(workspace.getBoundingClientRect().width);
    onChange(clamp(57, bounds.min, bounds.max));
  };

  return (
    <div
      ref={dividerRef}
      className="split-view-divider"
      role="separator"
      aria-label="Resize 2D and 3D views"
      aria-orientation="vertical"
      aria-controls="plan-view-pane spatial-view-pane"
      aria-valuemin={MIN_RATIO}
      aria-valuemax={MAX_RATIO}
      aria-valuenow={Math.round(value)}
      aria-valuetext={`${Math.round(value)}% 2D plan, ${Math.round(100 - value)}% 3D and inspector`}
      tabIndex={0}
      title="Drag to resize the 2D and 3D views. Use arrow keys for precise sizing."
      onDoubleClick={resetRatio}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerDrag}
      onPointerCancel={finishPointerDrag}
      onLostPointerCapture={(event) => {
        dragState.current = null;
        delete event.currentTarget.dataset.dragging;
      }}
    >
      <span aria-hidden="true">
        <DotsSixVertical size={15} weight="bold" />
      </span>
    </div>
  );
}
