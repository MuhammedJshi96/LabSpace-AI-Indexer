import { ClockCounterClockwise, Robot, Trash, X } from "@phosphor-icons/react";
import { useAgentActivityStore } from "../agent/agent-activity-store";

function eventTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export function AgentActivityPanel() {
  const events = useAgentActivityStore((state) => state.events);
  const open = useAgentActivityStore((state) => state.open);
  const setOpen = useAgentActivityStore((state) => state.setOpen);
  const clear = useAgentActivityStore((state) => state.clear);

  if (!open) {
    return (
      <button
        className="agent-activity-trigger"
        onClick={() => setOpen(true)}
        aria-label={`Open Agent Activity${events.length ? `, ${events.length} recent events` : ""}`}
      >
        <Robot size={17} weight="duotone" />
        <span>Agent activity</span>
        {events.length > 0 && <b>{events.length}</b>}
      </button>
    );
  }

  return (
    <aside className="agent-activity-panel" aria-label="Agent Activity">
      <header>
        <span className="agent-activity-icon" aria-hidden="true">
          <ClockCounterClockwise size={18} weight="duotone" />
        </span>
        <span>
          <b>Agent activity</b>
          <small>Deterministic action evidence</small>
        </span>
        {events.length > 0 && (
          <button onClick={clear} aria-label="Clear Agent Activity">
            <Trash size={15} />
          </button>
        )}
        <button onClick={() => setOpen(false)} aria-label="Close Agent Activity">
          <X size={16} />
        </button>
      </header>
      <div className="agent-activity-list" aria-live="polite">
        {events.length === 0 ? (
          <div className="agent-activity-empty">
            <Robot size={24} weight="duotone" />
            <b>No agent actions yet</b>
            <span>WebMCP tool evidence will appear here when an agent works with LabSpace.</span>
          </div>
        ) : (
          events.map((event) => (
            <article key={event.id} className={`activity-status-${event.status}`}>
              <div className="agent-activity-meta">
                <b>{event.actor}</b>
                <time dateTime={event.createdAt}>{eventTime(event.createdAt)}</time>
                <span>{event.status}</span>
              </div>
              <strong>{event.action}</strong>
              <p>{event.subject}</p>
              {event.evidence && <small>{event.evidence}</small>}
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
