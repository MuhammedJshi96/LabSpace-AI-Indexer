import { useEffect, useRef, useState } from "react";
import { ArrowRight, ListChecks, MapPin, X } from "@phosphor-icons/react";
import {
  approveCollection,
  cancelCollectionReview,
  useCollectionStore,
} from "../agent/labspace-collection-actions";
import { useEditorStore } from "../store/editor-store";
import "./collection-review.css";

export function CollectionReviewDialog() {
  const pending = useCollectionStore((state) => state.pending);
  const projectId = useEditorStore((state) => state.project.id);
  const hydrated = useEditorStore((state) => state.hydrated);
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<{ proposalId: string; message: string } | null>(null);
  const proposal = hydrated && pending?.route.projectId === projectId ? pending : null;

  useEffect(() => {
    const element = dialog.current;
    if (!proposal || !element) return;
    element.showModal();
    return () => element.close();
  }, [proposal]);

  if (!proposal) return null;
  const { route } = proposal;
  const cancel = () => cancelCollectionReview(route.id);

  return (
    <dialog
      ref={dialog}
      className="collection-review"
      aria-labelledby="collection-review-title"
      aria-describedby="collection-review-summary"
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
    >
      <header>
        <ListChecks size={25} weight="duotone" aria-hidden="true" />
        <div>
          <small>Researcher review · guide not started</small>
          <h2 id="collection-review-title">Review collection</h2>
        </div>
        <button onClick={cancel} aria-label="Cancel collection review">
          <X size={20} />
        </button>
      </header>
      <div className="collection-review-body">
        <h3>{route.title}</h3>
        <p id="collection-review-summary">
          Check these indexed items and their locations before starting. This does not mark anything
          collected or change stock.
        </p>
        <ol className="collection-review-ledger" aria-label="Proposed collection items">
          {route.records.map((record, position) => (
            <li key={record.id}>
              <span className="collection-review-number">{position + 1}</span>
              <div>
                <strong>{record.name}</strong>
                <small>{record.path.join(" / ")}</small>
              </div>
              <span className="collection-review-amount">
                {record.recordedAmount}
                <small>{record.roomCode}</small>
              </span>
            </li>
          ))}
        </ol>
        {route.workspace && (
          <section className="collection-review-workspace" aria-label="Proposed final workspace">
            <MapPin size={22} weight="duotone" aria-hidden="true" />
            <div>
              <small>Finish at this work surface</small>
              <strong>{route.workspace.name}</strong>
              <p>{route.workspace.path.join(" / ")}</p>
            </div>
          </section>
        )}
        <p className="collection-review-notice">
          Review your approved method and local conditions separately. This is an evidence
          itinerary, not a protocol or a safety-approved walking route.
        </p>
        {error?.proposalId === route.id && <p role="alert">{error.message}</p>}
      </div>
      <footer>
        <button autoFocus onClick={cancel}>
          Cancel
        </button>
        <button
          className="primary"
          onClick={() => {
            try {
              approveCollection(route.id);
              setError(null);
            } catch (failure) {
              setError({
                proposalId: route.id,
                message: failure instanceof Error ? failure.message : "The guide could not start.",
              });
            }
          }}
        >
          Approve &amp; start guide <ArrowRight size={17} aria-hidden="true" />
        </button>
      </footer>
    </dialog>
  );
}
