import { useState } from "react";
import { ArrowSquareOut, ClockCounterClockwise, DownloadSimple, X } from "@phosphor-icons/react";
import { useCollectionStore } from "../agent/labspace-collection-actions";
import { useAgentActivityStore } from "../agent/agent-activity-store";
import { useEditorStore } from "../store/editor-store";
import { buildDigitalTwinIndex } from "../domain/digital-twin-index";
import { focusLabRecord } from "../agent/labspace-navigation-actions";

export function ProcessTracker({ onClose }: { onClose: () => void }) {
  const project = useEditorStore((state) => state.project);
  const route = useCollectionStore((state) => state.route);
  const history = useCollectionStore((state) => state.history);
  const activity = useAgentActivityStore((state) => state.events);
  const [error, setError] = useState("");
  const runs = [route, ...history].filter((run) => run?.projectId === project.id);
  const index = buildDigitalTwinIndex(project);
  const download = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: "labspace-process-evidence-v1",
            exportedAt: new Date().toISOString(),
            project: project.name,
            notice:
              "Local, user-editable session evidence; not a certified audit log. Checkpoints do not consume stock or approve an experiment.",
            runs,
            recentSessionActivity: activity,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "labspace-process-evidence.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="process-tracker" aria-label="Process tracker">
      <header>
        <ClockCounterClockwise size={21} />
        <span>
          <b>Process tracker</b>
          <small>Recorded steps, visible decisions</small>
        </span>
        <button aria-label="Close process tracker" onClick={onClose}>
          <X size={17} />
        </button>
      </header>
      <div className="process-tracker-scroll">
        <p className="process-notice">
          A session trail, not a certified audit log. Viewing a stop is separate from confirming it.
          No stock is deducted.
        </p>
        {!runs.length && (
          <div className="process-empty">
            <b>Start with a material checklist</b>
            <p>
              Ask your browser agent to match a reviewed material list to real inventory, then start
              a collection guide. Its locations and your checkpoints will appear here.
            </p>
          </div>
        )}
        {runs.map(
          (run) =>
            run && (
              <details key={run.id} open={!run.endedAt} className="process-run">
                <summary>
                  <b>{run.title}</b>
                  <small>
                    {run.endedAt ? "Ended" : "In progress"} · {run.checked.length}/
                    {run.recordIds.length} checked
                  </small>
                </summary>
                <ol>
                  {run.recordIds.map((id) => {
                    const record = index.find((entry) => entry.id === id);
                    const snapshot = run.records.find((entry) => entry.id === id);
                    const checked = run.checked.find((entry) => entry.recordId === id);
                    return (
                      <li key={id}>
                        <span className={checked ? "is-checked" : ""}>{checked ? "✓" : "○"}</span>
                        <button
                          disabled={!record?.objectId}
                          onClick={() => {
                            try {
                              focusLabRecord({ recordId: id });
                              setError("");
                            } catch (failure) {
                              setError(
                                failure instanceof Error ? failure.message : "Location unavailable",
                              );
                            }
                          }}
                        >
                          <b>{snapshot?.name ?? record?.name ?? "Record unavailable"}</b>
                          <small>{(snapshot?.path ?? record?.path)?.join(" / ")}</small>
                          {!record?.objectId && (
                            <small>Recorded location no longer available</small>
                          )}
                          {checked && (
                            <small>
                              Checked by you · {new Date(checked.at).toLocaleTimeString()}
                            </small>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <details className="process-event-details">
                  <summary>Timestamped trail · {run.trail.length} events</summary>
                  {run.trail.map((entry, i) => (
                    <p key={`${entry.at}-${i}`}>
                      <time>{new Date(entry.at).toLocaleTimeString()}</time> · {entry.actor} ·{" "}
                      {entry.action}
                    </p>
                  ))}
                </details>
              </details>
            ),
        )}
        <details className="process-session-activity">
          <summary>Recent agent & human activity · {activity.length}</summary>
          {activity.slice(0, 12).map((event) => (
            <article key={event.id}>
              <small>
                {event.actor} · {new Date(event.createdAt).toLocaleTimeString()} · {event.status}
              </small>
              <b>{event.action}</b>
              <p>{event.subject}</p>
            </article>
          ))}
          <button onClick={() => useAgentActivityStore.getState().setOpen(true)}>
            Full tool evidence <ArrowSquareOut size={14} />
          </button>
        </details>
        {error && <p role="alert">{error}</p>}
      </div>
      <footer>
        <small>Retains 8 guides in this tab session.</small>
        <button onClick={download}>
          <DownloadSimple size={16} /> Export evidence
        </button>
      </footer>
    </section>
  );
}
