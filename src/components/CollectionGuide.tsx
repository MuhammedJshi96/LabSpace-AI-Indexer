import { useEffect, useState } from "react";
import "./collection-guide.css";
import { ArrowLeft, ArrowRight, ListChecks, MapPin, X } from "@phosphor-icons/react";
import {
  controlCollection,
  confirmCollectionStop,
  focusCollectionRecord,
  useCollectionStore,
} from "../agent/labspace-collection-actions";
import { buildDigitalTwinIndex } from "../domain/digital-twin-index";
import { useEditorStore } from "../store/editor-store";

export function CollectionGuide({ embedded = false }: { embedded?: boolean }) {
  const route = useCollectionStore((state) => state.route);
  const project = useEditorStore((state) => state.project);
  const hydrated = useEditorStore((state) => state.hydrated);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!route || !hydrated || route.projectId !== project.id) return;
    const id = route.recordIds[route.step];
    if (useEditorStore.getState().digitalTwinSelectedRecordId === id) return;
    try {
      focusCollectionRecord(id);
    } catch {
      /* The guide renders an unavailable stop without inventing a replacement. */
    }
  }, [route, hydrated, project.id]);
  if (!route || !hydrated || route.projectId !== project.id) return null;
  const index = buildDigitalTwinIndex(project);
  const current = index.find((record) => record.id === route.recordIds[route.step]);
  const act = (action: "next" | "previous" | "finish") => {
    try {
      controlCollection({ action }, "Human");
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "This stop is unavailable.");
    }
  };
  return (
    <section
      className={`collection-guide${embedded ? " is-embedded" : ""}`}
      aria-label="Collection guide"
    >
      <header>
        <ListChecks size={22} />
        <span>
          <small>
            COLLECTION GUIDE · {route.step + 1} / {route.recordIds.length}
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
          {route.checked.length} of {route.recordIds.length} locations checked
        </span>
        <progress value={route.checked.length} max={route.recordIds.length} />
      </div>
      <div className="collection-current" aria-live="polite">
        <strong>{current?.name ?? "Record unavailable"}</strong>
        <span>
          {current?.path.join(" → ") ?? "This record was removed. Choose another stop or finish."}
        </span>
        <small>
          {current?.primaryValue} {current?.status ? `· ${current.status}` : ""}
        </small>
      </div>
      <nav aria-label="Collection steps">
        <button disabled={route.step === 0} onClick={() => act("previous")}>
          <ArrowLeft size={16} /> Previous
        </button>
        <button
          className="primary"
          disabled={route.step === route.recordIds.length - 1}
          onClick={() => act("next")}
        >
          Next <ArrowRight size={16} />
        </button>
      </nav>
      <button
        className="collection-confirm"
        disabled={
          !current?.objectId || route.checked.some((entry) => entry.recordId === current.id)
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
        {route.checked.some((entry) => entry.recordId === current?.id)
          ? "Location checked"
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
              focusCollectionRecord(route.recordIds[route.step]);
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
        </ol>
      )}
      {error && <p role="alert">{error}</p>}
      <footer>
        Collection only—not a safety-approved route or protocol. Stock is not deducted.
      </footer>
    </section>
  );
}
