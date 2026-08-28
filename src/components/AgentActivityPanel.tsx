import { useState } from "react";
import { ClockCounterClockwise, Robot, Trash, X } from "@phosphor-icons/react";
import { useAgentActivityStore } from "../agent/agent-activity-store";

type InspectorTab = "activity" | "tools";

const WEBMCP_TOOL_CATALOG = [
  {
    name: "labspace_get_context",
    label: "Read workspace context",
    mode: "Read",
    description: "Current project, laboratory, room, selection, and indexed counts.",
  },
  {
    name: "labspace_search_records",
    label: "Search spatial records",
    mode: "Read",
    description: "Equipment, inventory, and nested storage locations from the canonical index.",
  },
  {
    name: "labspace_inspect_record",
    label: "Inspect exact record",
    mode: "Read",
    description: "Grounded record details, index code, status, and human-readable path.",
  },
  {
    name: "labspace_focus_record",
    label: "Focus room evidence",
    mode: "View",
    description: "Selects the indexed object or compartment and moves the spatial camera.",
  },
  {
    name: "labspace_validate_object_move",
    label: "Validate a proposed move",
    mode: "Simulate",
    description: "Runs deterministic boundary and overlap checks without changing the room.",
  },
  {
    name: "labspace_find_valid_placements",
    label: "Find valid placements",
    mode: "Simulate",
    description:
      "Ranks diverse geometry-valid alternatives near a preferred area without changing the room.",
  },
  {
    name: "labspace_search_assets",
    label: "Search planning assets",
    mode: "Read",
    description: "Furniture, storage, equipment, and safety assets with canonical dimensions.",
  },
  {
    name: "labspace_plan_room",
    label: "Calculate a room plan",
    mode: "Simulate",
    description: "Builds a geometry-checked furniture proposal without changing the room.",
  },
  {
    name: "labspace_stage_room_plan",
    label: "Stage a room blueprint",
    mode: "Review",
    description: "Shows all proposed assets in 2D and 3D for explicit human approval.",
  },
  {
    name: "labspace_stage_object_move",
    label: "Stage a move for review",
    mode: "Review",
    description: "Shows a reversible preview. Only a human can approve and save it.",
  },
] as const;

function eventTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function bridgeCopy(status: "unavailable" | "registering" | "ready" | "error", count: number) {
  if (status === "ready") return `${count} browser tools registered`;
  if (status === "registering") return "Registering browser tools";
  if (status === "error") return "Registration failed";
  return "WebMCP browser unavailable";
}

export function AgentActivityPanel() {
  const events = useAgentActivityStore((state) => state.events);
  const open = useAgentActivityStore((state) => state.open);
  const bridgeStatus = useAgentActivityStore((state) => state.bridgeStatus);
  const registeredTools = useAgentActivityStore((state) => state.registeredTools);
  const bridgeMessage = useAgentActivityStore((state) => state.bridgeMessage);
  const setOpen = useAgentActivityStore((state) => state.setOpen);
  const clear = useAgentActivityStore((state) => state.clear);
  const [tab, setTab] = useState<InspectorTab>("activity");
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const registeredCount = registeredTools.length;

  const runReadOnlyCheck = async () => {
    const modelContext = document.modelContext as
      | (WebMCP.ModelContext & {
          executeTool?: (tool: WebMCP.RegisteredTool, input: string) => Promise<string>;
        })
      | undefined;
    if (!modelContext?.executeTool) {
      setConnectionError("This browser can register tools but does not expose manual execution.");
      return;
    }
    setCheckingConnection(true);
    setConnectionError(null);
    setTab("activity");
    try {
      const tools = await modelContext.getTools();
      const contextTool = tools.find((tool) => tool.name === "labspace_get_context");
      if (!contextTool) throw new Error("The context tool is not registered.");
      await modelContext.executeTool(contextTool, "{}");
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : "The read-only WebMCP check could not run.",
      );
    } finally {
      setCheckingConnection(false);
    }
  };

  if (!open) {
    return (
      <button
        className={`agent-activity-trigger webmcp-status-${bridgeStatus}`}
        onClick={() => setOpen(true)}
        aria-label={`Open WebMCP Inspector, ${bridgeCopy(bridgeStatus, registeredCount)}${
          events.length ? `, ${events.length} recent events` : ""
        }`}
      >
        <span className="webmcp-status-dot" aria-hidden="true" />
        <Robot size={17} weight="duotone" />
        <span>WebMCP</span>
        {bridgeStatus === "ready" && <small>{registeredCount} tools</small>}
        {events.length > 0 && <b>{events.length}</b>}
      </button>
    );
  }

  return (
    <aside className="agent-activity-panel" aria-label="WebMCP Inspector">
      <header>
        <span className="agent-activity-icon" aria-hidden="true">
          <ClockCounterClockwise size={18} weight="duotone" />
        </span>
        <span>
          <b>WebMCP inspector</b>
          <small>{bridgeCopy(bridgeStatus, registeredCount)}</small>
        </span>
        {tab === "activity" && events.length > 0 && (
          <button onClick={clear} aria-label="Clear WebMCP Activity">
            <Trash size={15} />
          </button>
        )}
        <button onClick={() => setOpen(false)} aria-label="Close WebMCP Inspector">
          <X size={16} />
        </button>
      </header>

      <div className={`webmcp-connection webmcp-status-${bridgeStatus}`} role="status">
        <span className="webmcp-status-dot" aria-hidden="true" />
        <strong>
          {bridgeStatus === "ready"
            ? "Browser agent connected"
            : bridgeCopy(bridgeStatus, registeredCount)}
        </strong>
        <small>
          {bridgeStatus === "ready"
            ? "Calls use the same room, index, validator, and history as the visible interface."
            : (bridgeMessage ?? "LabSpace remains fully usable without browser-agent access.")}
        </small>
        {bridgeStatus === "ready" && (
          <button
            className="webmcp-check-button"
            onClick={() => void runReadOnlyCheck()}
            disabled={checkingConnection}
          >
            {checkingConnection ? "Running check…" : "Run read-only check"}
          </button>
        )}
        {connectionError && <em>{connectionError}</em>}
        {bridgeStatus === "ready" && (
          <p className="webmcp-example-prompt">
            <b>Try with your browser agent</b>
            <span>
              “Build an 8 × 6 m laboratory with 3 m walls, add a laboratory bench and floor
              centrifuge with a 900 mm aisle, then stage the blueprint for my approval.”
            </span>
          </p>
        )}
      </div>

      <div className="webmcp-flow" aria-label="WebMCP action flow">
        <span>Browser agent</span>
        <i aria-hidden="true">→</i>
        <span>WebMCP</span>
        <i aria-hidden="true">→</i>
        <span>LabSpace</span>
        <i aria-hidden="true">→</i>
        <span>Human review</span>
      </div>

      <div className="webmcp-tabs" role="tablist" aria-label="WebMCP inspector sections">
        <button role="tab" aria-selected={tab === "activity"} onClick={() => setTab("activity")}>
          Live activity <b>{events.length}</b>
        </button>
        <button role="tab" aria-selected={tab === "tools"} onClick={() => setTab("tools")}>
          Registered tools <b>{registeredCount}</b>
        </button>
      </div>

      {tab === "activity" ? (
        <div className="agent-activity-list" aria-live="polite" role="tabpanel">
          {events.length === 0 ? (
            <div className="agent-activity-empty">
              <Robot size={24} weight="duotone" />
              <b>No WebMCP calls yet</b>
              <span>
                Ask a compatible browser agent to build a connected room shell, derive its floor,
                arrange catalog assets, inspect spatial evidence, or stage a reviewed change. Every
                structured call appears here.
              </span>
            </div>
          ) : (
            events.map((event) => (
              <article key={event.id} className={`activity-status-${event.status}`}>
                <div className="agent-activity-meta">
                  <b>{event.actor}</b>
                  <time dateTime={event.createdAt}>{eventTime(event.createdAt)}</time>
                  <span>{event.status}</span>
                </div>
                {event.toolName && <code className="webmcp-tool-name">{event.toolName}</code>}
                <strong>{event.action}</strong>
                <p>{event.subject}</p>
                {event.evidence && <small>{event.evidence}</small>}
                {(event.request || event.response) && (
                  <dl className="webmcp-payloads">
                    {event.request && (
                      <div>
                        <dt>Input</dt>
                        <dd>{event.request}</dd>
                      </div>
                    )}
                    {event.response && (
                      <div>
                        <dt>Result</dt>
                        <dd>{event.response}</dd>
                      </div>
                    )}
                  </dl>
                )}
              </article>
            ))
          )}
        </div>
      ) : (
        <div className="webmcp-tools-list" role="tabpanel">
          {WEBMCP_TOOL_CATALOG.map((tool) => {
            const registered = registeredTools.includes(tool.name);
            return (
              <article key={tool.name} className={registered ? "is-registered" : undefined}>
                <div>
                  <code>{tool.name}</code>
                  <span>{tool.mode}</span>
                </div>
                <strong>{tool.label}</strong>
                <p>{tool.description}</p>
                <small>
                  {registered ? "Registered in this browser" : "Not available in this browser"}
                </small>
              </article>
            );
          })}
          <footer>
            <b>Safety boundary</b>
            <span>
              WebMCP can stage moves and complete room blueprints, but only the researcher can
              approve or cancel them.
            </span>
          </footer>
        </div>
      )}
    </aside>
  );
}
