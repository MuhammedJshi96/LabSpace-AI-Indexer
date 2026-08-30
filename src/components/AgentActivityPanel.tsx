import { useState } from "react";
import {
  Browser,
  ChatCircleText,
  Check,
  ClockCounterClockwise,
  Code,
  Copy,
  Path,
  Robot,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useAgentActivityStore } from "../agent/agent-activity-store";
import {
  executeReadOnlyToolCompat,
  type ExecutableModelContext,
} from "../webmcp/execute-tool-compat";

type InspectorTab = "activity" | "workflows" | "guide" | "tools";

const WEBMCP_WORKFLOWS = [
  {
    id: "inventory",
    mode: "Review",
    title: "Create an inventory record",
    outcome: "Verified destination · detailed entry · researcher approval",
    prompt:
      "Add 12 boxes of pipette tips to the current room. Find suitable recorded storage locations first, ask me to choose if ambiguous, then use labspace_add_inventory to stage the exact entry for my review. Do not invent an owner or expiry date.",
  },
  {
    id: "collection",
    mode: "Collect",
    title: "Prepare a grounded collection guide",
    outcome: "Proposed checklist · real stock · Next/Previous evidence",
    prompt:
      "Help prepare a collection checklist for my planned work. Ask for my approved protocol or material list if needed; label your suggestions clearly. Match the materials against LabSpace, report missing or ambiguous stock, then start a collection guide for the records I choose. Do not treat this as an experiment protocol or a safety-approved walking route.",
  },
  {
    id: "build",
    mode: "Create",
    title: "Build a complete room",
    outcome: "Polygon shell · hosted openings · supported equipment",
    prompt:
      "Create a six-wall sample-preparation room on Floor 8, about 36 square metres. Add one inward-opening double door, two observation windows, two laboratory benches, storage, and a rotary evaporator on a real worktop. Use LabSpace catalog assets and complete the first validated blueprint.",
  },
  {
    id: "evidence",
    mode: "Trace",
    title: "Find exact physical evidence",
    outcome: "Canonical record · storage path · focused 3D scene",
    prompt:
      "Find Reference standards in LabSpace, inspect the exact canonical record, and focus its room and storage location. Explain the laboratory, room, cabinet, shelf or drawer path using only the returned evidence.",
  },
  {
    id: "audit",
    mode: "Audit",
    title: "Audit and improve a room",
    outcome: "Deterministic issues · ranked alternative · review preview",
    prompt:
      "Audit the active LabSpace room. Summarize its deterministic readiness, identify the highest-priority geometry issue, and—if it involves a movable object—find valid alternatives and stage the best grounded correction for my review. Do not approve it for me.",
  },
  {
    id: "resize",
    mode: "Review",
    title: "Resize a hosted opening",
    outcome: "Wall-fit validation · accurate preview · human approval",
    prompt:
      "Inspect the current room's observation windows. Calculate equal widths that fit their shared wall without overlap, validate the new dimensions, then stage the resize previews for my review. Do not approve any change.",
  },
] as const;

const WEBMCP_TOOL_CATALOG = [
  {
    name: "labspace_add_inventory",
    label: "Add inventory",
    mode: "Review",
    description:
      "One-call entry: validate exact rooms and locations, then approve the visible inventory review.",
  },
  {
    name: "labspace_resolve_materials",
    label: "Ground a material list",
    mode: "Read",
    description:
      "Match suggested materials to actual stock and equipment. Missing and ambiguous items stay explicit.",
  },
  {
    name: "labspace_start_collection",
    label: "Start collection guide",
    mode: "Navigate",
    description:
      "Turn reviewed record IDs into a room-grouped Next/Previous checklist with exact-location focus.",
  },
  {
    name: "labspace_collection_step",
    label: "Follow collection guide",
    mode: "Navigate",
    description:
      "Next, previous, status or finish. Never consumes inventory or claims a safe walking path.",
  },
  {
    name: "labspace_audit_room",
    label: "Audit room readiness",
    mode: "Read",
    description:
      "Summarizes deterministic floor, boundary, support, opening, overlap, height, and identity checks.",
  },
  {
    name: "labspace_create_room",
    label: "Create a blank room",
    mode: "Create",
    description:
      "Creates, activates, and saves a blank room whose first complete blueprint may auto-commit.",
  },
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
    name: "labspace_validate_resize",
    label: "Validate a proposed resize",
    mode: "Simulate",
    description: "Checks dimensions, hosted-wall fit, sill height, and neighboring openings.",
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
    description:
      "Openings, furniture, storage, equipment, and safety assets with exact dimensions.",
  },
  {
    name: "labspace_plan_room",
    label: "Calculate a room plan",
    mode: "Simulate",
    description:
      "Builds a polygon shell with hosted openings, paired workstations, and support-aware transforms.",
  },
  {
    name: "labspace_inventory_locations",
    label: "Find inventory locations",
    mode: "Read",
    description: "Lists canonical storage destinations across editable rooms.",
  },
  {
    name: "labspace_plan_inventory",
    label: "Calculate inventory records",
    mode: "Simulate",
    description:
      "Validates names, quantities, rooms, and exact storage assignments without mutation.",
  },
  {
    name: "labspace_stage_inventory_plan",
    label: "Stage inventory for review",
    mode: "Review",
    description: "Shows proposed records and locations. Only a human can approve their creation.",
  },
  {
    name: "labspace_stage_room_plan",
    label: "Stage a room blueprint",
    mode: "Apply",
    description:
      "Auto-commits a new room's first complete blueprint; later plans remain human-reviewed.",
  },
  {
    name: "labspace_stage_object_move",
    label: "Stage a move for review",
    mode: "Review",
    description: "Shows a reversible preview. Only a human can approve and save it.",
  },
  {
    name: "labspace_stage_resize",
    label: "Stage a resize for review",
    mode: "Review",
    description: "Shows a dimension-accurate preview. Only a human can approve and save it.",
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
  const [copiedWorkflow, setCopiedWorkflow] = useState<string | null>(null);
  const registeredCount = registeredTools.length;

  const runReadOnlyCheck = async () => {
    const modelContext = document.modelContext as ExecutableModelContext | undefined;
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
      await executeReadOnlyToolCompat(modelContext, contextTool, {});
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : "The read-only WebMCP check could not run.",
      );
    } finally {
      setCheckingConnection(false);
    }
  };

  const copyWorkflow = async (id: string, prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedWorkflow(id);
      window.setTimeout(
        () => setCopiedWorkflow((current) => (current === id ? null : current)),
        1800,
      );
    } catch {
      setConnectionError(
        "The browser could not copy this prompt. Select the text and copy it manually.",
      );
    }
  };

  if (!open) return null;

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
            <b>Type this in your browser-agent conversation</b>
            <small>
              ChatGPT discovers LabSpace tools from this open page—there is no second chat box.
            </small>
            <span>
              “Build an L-shaped six-wall preparation room. Add a bench, place a rotary evaporator
              on its worktop, rotate the floor centrifuge 90°, then stage the blueprint for my
              approval.”
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
        <button role="tab" aria-selected={tab === "workflows"} onClick={() => setTab("workflows")}>
          Agent workflows <b>{WEBMCP_WORKFLOWS.length}</b>
        </button>
        <button role="tab" aria-selected={tab === "guide"} onClick={() => setTab("guide")}>
          Use WebMCP
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
      ) : tab === "workflows" ? (
        <div className="webmcp-workflows" role="tabpanel">
          <header>
            <span className="webmcp-workflow-mark" aria-hidden="true">
              <Path size={22} weight="duotone" />
            </span>
            <span>
              <b>Judge-ready human + agent journeys</b>
              <small>
                Copy one prompt into the browser-agent conversation controlling this page. LabSpace
                shows every structured call here.
              </small>
            </span>
          </header>
          {WEBMCP_WORKFLOWS.map((workflow, index) => (
            <article key={workflow.id}>
              <span className="webmcp-workflow-number">0{index + 1}</span>
              <div>
                <span className="webmcp-workflow-mode">{workflow.mode}</span>
                <strong>{workflow.title}</strong>
                <small>{workflow.outcome}</small>
                <p>{workflow.prompt}</p>
              </div>
              <button
                onClick={() => void copyWorkflow(workflow.id, workflow.prompt)}
                aria-label={`Copy ${workflow.title} prompt`}
              >
                {copiedWorkflow === workflow.id ? (
                  <Check size={16} weight="bold" />
                ) : (
                  <Copy size={16} />
                )}
                {copiedWorkflow === workflow.id ? "Copied" : "Copy prompt"}
              </button>
            </article>
          ))}
          <footer>
            <b>Human control remains visible</b>
            <span>
              Only a pristine room's first complete blueprint can auto-commit. Later layouts,
              movement, resizing, and inventory remain previews until a researcher approves them.
            </span>
          </footer>
        </div>
      ) : tab === "guide" ? (
        <div className="webmcp-guide" role="tabpanel">
          <header>
            <span className="webmcp-workflow-mark" aria-hidden="true">
              <ChatCircleText size={22} weight="duotone" />
            </span>
            <span>
              <b>Choose the right control surface</b>
              <small>
                LabSpace exposes the same tools everywhere. What changes is where you write the
                request.
              </small>
            </span>
          </header>

          <section className="webmcp-guide-card is-recommended">
            <div className="webmcp-guide-card-heading">
              <ChatCircleText size={18} weight="duotone" aria-hidden="true" />
              <span>
                <small>Natural language · recommended</small>
                <strong>ChatGPT in-app browser</strong>
              </span>
              <em>Fastest</em>
            </div>
            <ol>
              <li>Keep LabSpace open in ChatGPT&apos;s browser.</li>
              <li>Type your request in the ChatGPT conversation beside the page.</li>
              <li>Review every structured call here and approve staged changes in LabSpace.</li>
            </ol>
          </section>

          <section className="webmcp-guide-card">
            <div className="webmcp-guide-card-heading">
              <Browser size={18} weight="duotone" aria-hidden="true" />
              <span>
                <small>Natural language · optional extension</small>
                <strong>Chrome Model Context Tool Inspector</strong>
              </span>
            </div>
            <p>
              Enable <code>chrome://flags/#enable-webmcp-testing</code>, relaunch Chrome, then use
              Google&apos;s inspector extension when you want a chat-like prompt surface in Chrome.
            </p>
          </section>

          <section className="webmcp-guide-card">
            <div className="webmcp-guide-card-heading">
              <Code size={18} weight="duotone" aria-hidden="true" />
              <span>
                <small>Manual JSON · developer verification</small>
                <strong>Chrome DevTools WebMCP pane</strong>
              </span>
            </div>
            <ol>
              <li>
                Enable <code>#enable-webmcp-testing</code> and <code>#devtools-webmcp-support</code>
                .
              </li>
              <li>Open DevTools, then choose Application → WebMCP → Available Tools.</li>
              <li>
                Select a tool, enter its JSON arguments—for example <code>{"{}"}</code> for the room
                audit—and choose <b>Run tool</b>.
              </li>
            </ol>
          </section>

          <section className="webmcp-guide-card">
            <strong>Add stock, then find it physically</strong>
            <p>
              Ask: “Add 12 boxes of pipette tips to DEMO-01. Show me possible storage locations
              first.” The agent calls <code>labspace_inventory_locations</code>, then{" "}
              <code>labspace_add_inventory</code>
              with name, quantity, unit, exact room code and optional location, owner, notes and
              expiry date. Review the entries and press Approve to save them.
            </p>
            <p>
              For preparation: ask the agent to propose a materials checklist, use{" "}
              <code>labspace_resolve_materials</code>
              to verify actual records, and start a collection guide only with the candidates you
              approve. Next/Previous focuses the exact room and storage. Missing stock is never
              invented.
            </p>
          </section>
          <aside role="note">
            <b>Why Chrome can feel harder</b>
            <span>
              DevTools is a debugger, not an AI chat. Complete natural-language workflows belong in
              ChatGPT or the optional inspector; DevTools runs one tool at a time with JSON.
            </span>
          </aside>
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
              A new WebMCP-created room may auto-commit its first complete validated blueprint.
              Existing-room changes, later placements, moves, resizes, and inventory still require
              the researcher to approve or cancel them.
            </span>
          </footer>
        </div>
      )}
    </aside>
  );
}

export function WebMCPHeaderButton() {
  const events = useAgentActivityStore((state) => state.events);
  const bridgeStatus = useAgentActivityStore((state) => state.bridgeStatus);
  const registeredCount = useAgentActivityStore((state) => state.registeredTools.length);
  const setOpen = useAgentActivityStore((state) => state.setOpen);

  return (
    <button
      className={`agent-activity-trigger webmcp-status-${bridgeStatus}`}
      onClick={() => setOpen(true)}
      aria-label={`Open WebMCP Inspector, ${bridgeCopy(bridgeStatus, registeredCount)}${
        events.length ? `, ${events.length} recent events` : ""
      }`}
      title="Open WebMCP inspector"
    >
      <span className="webmcp-status-dot" aria-hidden="true" />
      <Robot size={17} weight="duotone" />
      <span>WebMCP</span>
      {bridgeStatus === "ready" && <small>{registeredCount}</small>}
      {events.length > 0 && <b>{events.length}</b>}
    </button>
  );
}
