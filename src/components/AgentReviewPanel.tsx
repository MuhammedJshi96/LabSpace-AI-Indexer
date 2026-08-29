import {
  ArrowRight,
  CheckCircle,
  Robot,
  Ruler,
  MapPin,
  Package,
  Square,
  Stack,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { labSpaceStagingActions } from "../agent/labspace-staging-actions";
import { useEditorStore } from "../store/editor-store";

function metres(value: number) {
  return `${(value / 1000).toFixed(2)} m`;
}

export function AgentReviewPanel() {
  const pending = useEditorStore((state) => state.pendingAgentChange);
  const pushToast = useEditorStore((state) => state.pushToast);
  const cancelButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pending) return;
    cancelButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      labSpaceStagingActions.cancelStagedChange(pending.stageId);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [pending]);

  if (!pending) return null;
  const proposedWalls =
    pending.tool === "layout"
      ? pending.proposedObjects.filter((object) => object.kind === "wall")
      : [];
  const proposedAssets =
    pending.tool === "layout"
      ? pending.proposedObjects.filter((object) => object.kind === "asset")
      : [];

  const approve = () => {
    try {
      labSpaceStagingActions.approveStagedChange(pending.stageId);
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "The staged move could not be approved.",
        "error",
      );
    }
  };
  const cancel = () => {
    try {
      labSpaceStagingActions.cancelStagedChange(pending.stageId);
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "The staged move could not be cancelled.",
        "error",
      );
    }
  };

  return (
    <div className="agent-review-scrim">
      <section
        className="agent-review-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="agent-review-title"
        aria-describedby="agent-review-summary"
        data-testid="agent-change-review"
      >
        <div className="agent-review-mark" aria-hidden="true">
          <Robot size={22} weight="duotone" />
        </div>
        <div className="agent-review-copy">
          <div className="agent-review-heading">
            <span className="agent-review-state">Preview · not saved</span>
            <span className="agent-review-valid">
              <CheckCircle size={15} weight="fill" />
              {pending.tool === "inventory" ? "Canonical targets" : "Geometry clear"}
            </span>
          </div>
          <h2 id="agent-review-title">
            {pending.tool === "layout"
              ? "Review room shell and layout"
              : pending.tool === "inventory"
                ? "Review inventory creation"
                : "Review agent move"}
          </h2>
          {pending.tool === "layout" ? (
            <>
              <p id="agent-review-summary">
                {proposedWalls.length > 0 && (
                  <>
                    <b>
                      {metres(pending.proposedRoomSize.width)} ×{" "}
                      {metres(pending.proposedRoomSize.depth)} room
                    </b>
                    {" · "}
                    {proposedWalls.length} connected walls{" · "}
                  </>
                )}
                <b>{proposedAssets.length} catalog assets</b> proposed for {pending.roomName}
                {pending.brief ? ` · ${pending.brief}` : ""}
              </p>
              <div className="agent-review-manifest" aria-label="Proposed room assets">
                {proposedWalls.length > 0 && (
                  <span className="agent-review-shell-item">
                    <Square size={14} weight="duotone" />
                    <b>Closed room shell</b>
                    <small>Walls generate the floor automatically</small>
                  </span>
                )}
                {proposedAssets.slice(0, proposedWalls.length > 0 ? 5 : 6).map((object) => (
                  <span key={object.objectId}>
                    <Stack size={14} weight="duotone" />
                    <b>{object.name}</b>
                    <small>
                      X {metres(object.position.xMm)} · Y {metres(object.position.yMm)} · Z{" "}
                      {metres(object.position.zMm)} · {Math.round(object.position.rotationDeg)}°
                    </small>
                  </span>
                ))}
                {proposedAssets.length > (proposedWalls.length > 0 ? 5 : 6) && (
                  <span className="agent-review-manifest-more">
                    +{proposedAssets.length - (proposedWalls.length > 0 ? 5 : 6)} more
                  </span>
                )}
              </div>
              <div className="agent-review-route" aria-label="Room plan evidence">
                <span>
                  <small>Blueprint layer</small>
                  Connected walls → derived floor
                </span>
                <Ruler size={18} aria-hidden="true" />
                <span>
                  <small>Commit</small>
                  Shell + assets in one undoable update
                </span>
              </div>
            </>
          ) : pending.tool === "inventory" ? (
            <>
              <p id="agent-review-summary">
                <b>{pending.entries.length} inventory record{pending.entries.length === 1 ? "" : "s"}</b>
                {" · "}
                {pending.entries.filter((entry) => entry.storageLocationId).length} assigned to exact locations
              </p>
              <div className="agent-review-manifest" aria-label="Proposed inventory records">
                {pending.entries.slice(0, 6).map((entry) => (
                  <span key={entry.itemId}>
                    <Package size={14} weight="duotone" />
                    <b>{entry.name}</b>
                    <small>{entry.quantity} {entry.unit} · {entry.roomCode}</small>
                    <small><MapPin size={12} /> {entry.locationPath.join(" → ") || "Unassigned"}</small>
                  </span>
                ))}
                {pending.entries.length > 6 && (
                  <span className="agent-review-manifest-more">+{pending.entries.length - 6} more</span>
                )}
              </div>
              <div className="agent-review-route" aria-label="Inventory plan evidence">
                <span><small>Source</small>WebMCP structured proposal</span>
                <ArrowRight size={18} aria-hidden="true" />
                <span><small>Commit</small>Canonical room inventory after approval</span>
              </div>
            </>
          ) : (
            <>
              <p id="agent-review-summary">
                <b>{pending.objectName}</b> <code>{pending.objectIndexCode}</code>
              </p>
              <div className="agent-review-route" aria-label="Proposed position change">
                <span>
                  <small>Current</small>X {metres(pending.before.position.x)} · Y{" "}
                  {metres(pending.before.position.y)} · Z {metres(pending.before.position.z)}
                </span>
                <ArrowRight size={18} aria-hidden="true" />
                <span>
                  <small>Proposed</small>X {metres(pending.proposed.position.x)} · Y{" "}
                  {metres(pending.proposed.position.y)} · Z {metres(pending.proposed.position.z)}
                </span>
              </div>
            </>
          )}
          <p className="agent-review-note">
            <WarningCircle size={15} /> Nothing is persisted until you approve.
          </p>
        </div>
        <div className="agent-review-actions">
          <button ref={cancelButton} className="button-secondary" onClick={cancel}>
            <X size={16} /> Cancel preview
          </button>
          <button className="button-primary" onClick={approve}>
            <CheckCircle size={16} weight="bold" />
            {pending.tool === "layout"
              ? "Approve room plan"
              : pending.tool === "inventory"
                ? "Approve inventory"
                : "Approve move"}
          </button>
        </div>
      </section>
    </div>
  );
}
