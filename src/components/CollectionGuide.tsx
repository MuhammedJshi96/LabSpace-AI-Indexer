import { useEffect, useState } from "react";
import "./collection-guide.css";
import { ArrowLeft, ArrowRight, ListChecks, MapPin, X } from "@phosphor-icons/react";
import {
  collectionCurrentStopId,
  collectionTotalSteps,
  controlCollection,
  confirmCollectionStop,
  focusCollectionStep,
  useCollectionStore,
} from "../agent/labspace-collection-actions";
import { buildDigitalTwinIndex } from "../domain/digital-twin-index";
import { useEditorStore } from "../store/editor-store";

export function CollectionGuide({ embedded = false }: { embedded?: boolean }) {
  const route = useCollectionStore((state) => state.route);
  const pending = useCollectionStore((state) => state.pending);
  const project = useEditorStore((state) => state.project);
  const hydrated = useEditorStore((state) => state.hydrated);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!route || !hydrated || route.projectId !== project.id || pending) return;
    const id = collectionCurrentStopId(route);
    if (
      useEditorStore.getState().spatialFocus?.recordId === id ||
      useEditorStore.getState().digitalTwinSelectedRecordId === id
    )
      return;
    try {
      focusCollectionStep(route);
    } catch {
      /* The guide renders an unavailable stop without inventing a replacement. */
    }
  }, [route, hydrated, project.id, pending]);
  if (!route || !hydrated || route.projectId !== project.id) return null;
  const index = buildDigitalTwinIndex(project);
  const totalSteps = collectionTotalSteps(route);
  const workspaceStep = Boolean(route.workspace && route.step === route.recordIds.length);
  const current = workspaceStep
    ? null
    : index.find((record) => record.id === route.recordIds[route.step]);
  const currentStopId = collectionCurrentStopId(route);
  const currentName = workspaceStep ? route.workspace?.name : current?.name;
  const currentPath = workspaceStep ? route.workspace?.path : current?.path;
  const currentAvailable = workspaceStep
    ? Boolean(
        project.rooms
          .find((room) => room.id === route.workspace?.roomId)
          ?.scene.objects.some(
            (object) => object.id === route.workspace?.objectId && object.visible,
          ),
      )
    : Boolean(current?.objectId);
  const act = (action: "next" | "previous" | "finish") => {
    try {
      controlCollection({ action }, "Human");
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "This stop is unavailable.");
    }
  };
  const checked = route.checked.some((entry) => entry.recordId === currentStopId);
  const confirmLabel = checked
    ? workspaceStep
      ? "Workspace reviewed"
      : "Location checked"
    : workspaceStep
      ? "Confirm workspace reviewed"
      : "Confirm location checked";
  const stops = (
    <ol className="collection-stop-list">
      {route.recordIds.map((id, step) => (
        <li key={id} aria-current={step === route.step ? "step" : undefined}>
          {route.checked.some((entry) => entry.recordId === id) ? "✓ " : "○ "}
          {index.find((record) => record.id === id)?.name ?? "Record unavailable"}
        </li>
      ))}
      {route.workspace && (
        <li aria-current={workspaceStep ? "step" : undefined}>
          Final workspace · {route.workspace.name}
        </li>
      )}
    </ol>
  );
  if (embedded)
    return (
      <section
        className={`collection-guide is-embedded${workspaceStep ? " is-workspace-step" : ""}`}
        aria-label="Collection guide"
      >
        <div className="collection-rail-main">
          <div className="collection-rail-subject" aria-live="polite">
            <small>
              {route.workspace ? "WORKFLOW ITINERARY" : "COLLECTION GUIDE"} · {route.step + 1} /{" "}
              {totalSteps}
              {workspaceStep ? " · FINAL WORKSPACE" : ""}
            </small>
            <strong title={currentName}>{currentName ?? "Record unavailable"}</strong>
          </div>
          <nav aria-label="Collection steps">
            <button disabled={route.step === 0} onClick={() => act("previous")}>
              <ArrowLeft size={16} /> Previous
            </button>
            <button
              className="primary"
              disabled={route.step === totalSteps - 1}
              onClick={() => act("next")}
            >
              Next <ArrowRight size={16} />
            </button>
            <button
              aria-label="Close collection guide"
              title="Finish guide without changing inventory"
              onClick={() => act("finish")}
            >
              <X size={16} />
            </button>
          </nav>
        </div>
        <div className="collection-rail-controls">
          <span>
            {route.checked.length} of {totalSteps} stops checked
          </span>
          <button
            disabled={!currentAvailable || checked}
            onClick={() => {
              try {
                confirmCollectionStop();
                setError("");
              } catch (failure) {
                setError(failure instanceof Error ? failure.message : "Cannot confirm this stop.");
              }
            }}
          >
            {confirmLabel}
          </button>
          <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
            {expanded ? "Hide stops" : "All stops"}
          </button>
          <button
            onClick={() => {
              try {
                focusCollectionStep(route);
                setError("");
              } catch (failure) {
                setError(failure instanceof Error ? failure.message : "Stop unavailable.");
              }
            }}
          >
            <MapPin size={14} /> Focus
          </button>
        </div>
        {expanded && stops}
        {error && <p role="alert">{error}</p>}
        <footer>
          Ordered evidence only—not a safety-approved route or protocol. Stock is not deducted.
        </footer>
      </section>
    );
  return (
    <section
      className={`collection-guide${embedded ? " is-embedded" : ""}${workspaceStep ? " is-workspace-step" : ""}`}
      aria-label="Collection guide"
    >
      <header>
        <ListChecks size={22} />
        <span>
          <small>
            {route.workspace ? "WORKFLOW ITINERARY" : "COLLECTION GUIDE"} · {route.step + 1} /{" "}
            {totalSteps}
          </small>
          <strong>{route.title}</strong>
        </span>
        <button
          aria-label="Close collection guide"
          title="Finish guide without changing inventory"
          onClick={() => act("finish")}
        >
          <X size={18} />
        </button>
      </header>
      <div className="collection-progress">
        <span>
          {route.checked.length} of {totalSteps} stops checked
        </span>
        <progress value={route.checked.length} max={totalSteps} />
      </div>
      <div className="collection-current" aria-live="polite">
        {workspaceStep && <small>FINAL WORKSPACE</small>}
        <strong>{currentName ?? "Record unavailable"}</strong>
        <span>
          {currentPath?.join(" → ") ?? "This stop was removed. Choose another stop or finish."}
        </span>
        <small>
          {workspaceStep
            ? "Assessed work surface · researcher review required"
            : `${current?.primaryValue ?? ""}${current?.status ? ` · ${current.status}` : ""}`}
        </small>
      </div>
      <nav aria-label="Collection steps">
        <button disabled={route.step === 0} onClick={() => act("previous")}>
          <ArrowLeft size={16} /> Previous
        </button>
        <button
          className="primary"
          disabled={route.step === totalSteps - 1}
          onClick={() => act("next")}
        >
          Next <ArrowRight size={16} />
        </button>
      </nav>
      <button
        className="collection-confirm"
        disabled={
          !currentAvailable || route.checked.some((entry) => entry.recordId === currentStopId)
        }
        onClick={() => {
          try {
            confirmCollectionStop();
            setError("");
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Cannot confirm this stop.");
          }
        }}
      >
        {route.checked.some((entry) => entry.recordId === currentStopId)
          ? workspaceStep
            ? "Workspace reviewed"
            : "Location checked"
          : workspaceStep
            ? "Confirm workspace reviewed"
            : "Confirm location checked"}
      </button>
      <div className="collection-links">
        <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          {expanded ? "Hide stops" : "All stops"}
        </button>
        {window.location.pathname !== "/digital-twin" && (
          <a href="/digital-twin">
            Open Spatial Index <ArrowRight size={14} />
          </a>
        )}
        <button
          onClick={() => {
            try {
              focusCollectionStep(route);
              setError("");
            } catch (failure) {
              setError(failure instanceof Error ? failure.message : "Stop unavailable.");
            }
          }}
        >
          <MapPin size={14} /> Focus
        </button>
      </div>
      {expanded && (
        <ol>
          {route.recordIds.map((id, step) => (
            <li key={id} aria-current={step === route.step ? "step" : undefined}>
              {route.checked.some((entry) => entry.recordId === id) ? "✓ " : "○ "}
              {index.find((record) => record.id === id)?.name ?? "Record unavailable"}
            </li>
          ))}
          {route.workspace && (
            <li
              key={`workflow-workspace:${route.workspace.objectId}`}
              aria-current={workspaceStep ? "step" : undefined}
            >
              {route.checked.some(
                (entry) => entry.recordId === `workflow-workspace:${route.workspace?.objectId}`,
              )
                ? "✓ "
                : "◇ "}
              Final workspace · {route.workspace.name}
            </li>
          )}
        </ol>
      )}
      {error && <p role="alert">{error}</p>}
      <footer>
        Ordered evidence only—not a safety-approved route or protocol. Stock is not deducted.
      </footer>
    </section>
  );
}
