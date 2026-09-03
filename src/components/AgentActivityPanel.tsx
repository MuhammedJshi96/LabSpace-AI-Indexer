import { useMemo, useState } from "react";
import {
  ArrowRight,
  Browser,
  ChatCircleText,
  Check,
  ClockCounterClockwise,
  Code,
  Copy,
  DownloadSimple,
  FileArrowDown,
  Lightning,
  MapPinLine,
  Path,
  Robot,
  ShieldCheck,
  Trash,
  Waveform,
  X,
} from "@phosphor-icons/react";
import {
  downloadAgentActivityHistory,
  MAX_ACTIVITY_EVENTS,
  useAgentActivityStore,
} from "../agent/agent-activity-store";
import {
  useWebMcpExecutionPolicyStore,
  type WebMcpExecutionMode,
} from "../agent/webmcp-execution-policy";
import {
  executeReadOnlyToolCompat,
  type ExecutableModelContext,
} from "../webmcp/execute-tool-compat";
import { downloadJudgeEvidenceBundle, summarizeJudgeEvidence } from "../agent/judge-evidence";
import { COMPETITION_EVIDENCE_LAYER_ENABLED } from "../config/competition-evidence";
import { selectActiveRoom, useEditorStore } from "../store/editor-store";

type InspectorTab = "mission" | "activity" | "workflows" | "guide" | "tools";

const webMcpOnlyPrompt = (task: string) =>
  `Use only the LabSpace WebMCP tools exposed by this page (the labspace_* tools). Do not click, drag, type into forms, or use browser/computer-control actions for this task. Start with labspace_get_context. If the labspace_* tools are unavailable, stop and tell me WebMCP is not connected; do not fall back to UI automation. ${task}`;

const DEMO_MISSIONS = [
  {
    id: "build-r003",
    step: "01 · Build",
    mode: "Create + review",
    title: "Create R-003 from one request",
    outcome: "38 m² shell · hosted openings · three paired workstations",
    prompt: webMcpOnlyPrompt(
      "In the currently opened laboratory, create a new room named Researcher Office, code R-003. Build a 7,600 by 5,000 millimetre four-wall shell (38 square metres), with one inward single laboratory door centered on wall 3 (the visually bottom wall), one wide three-panel window centered on wall 1 (the visually upper wall), and one wide three-panel window centered on wall 4 (the left wall). Add three office desks, pair one office chair with each desk, one locker, one fire extinguisher, and one waste bin. Use labspace_search_assets, labspace_create_room, labspace_plan_room, labspace_stage_room_plan, then labspace_audit_room. Pause at every human review boundary; never approve a change for me.",
    ),
    voicePrompt: webMcpOnlyPrompt(
      "In this laboratory, create Researcher Office R-003 as a 38 square metre room. Put a centered inward door on the bottom wall, three-panel windows on the upper and left walls, three desks with matching chairs, one locker, one fire extinguisher, and one waste bin. Plan and audit it with LabSpace tools, and stop for my approval.",
    ),
  },
  {
    id: "stock-enzymes",
    step: "02 · Stock",
    mode: "Stage + approve",
    title: "Stage two enzyme records",
    outcome: "Exact quantities · ISO expiry dates · no invented location",
    prompt: webMcpOnlyPrompt(
      "Add two inventory records to R-002: Alpha-glucosidase enzyme, 2 bottles, expiry 2026-10-06; and Lipase enzyme, 1 bottle, expiry 2026-10-16. Use labspace_get_context and labspace_add_inventory. Keep both records unassigned unless I provide an exact canonical storage location; do not invent an owner, storage position, or suitability. Stop at the visible review panel for my approval.",
    ),
    voicePrompt: webMcpOnlyPrompt(
      "Add two inventory records to R-002: alpha-glucosidase enzyme, two bottles, expiring October sixth 2026; and lipase enzyme, one bottle, expiring October sixteenth 2026. Leave storage unassigned and stop for my approval.",
    ),
  },
  {
    id: "find-dpph-work",
    step: "03 · Find the work",
    mode: "Search + assess",
    title: "Ground a DPPH collection",
    outcome: "Cross-room evidence · missing stock · route to a real work surface",
    prompt: webMcpOnlyPrompt(
      "Using my researcher-approved DPPH checklist, find DPPH reagent, methanol, 100 microlitre and 200 microlitre pipette tips, a laboratory pipette holder, and an automated microplate reader. Check chloroform separately and keep it explicitly unavailable if it is absent; chloroform is an availability check, not a DPPH requirement, so do not include it in labspace_assess_workflow. Use labspace_search_records and labspace_inspect_record to ground exact matches, then use labspace_assess_workflow with roomCode R-002 to rank a real work surface while still grounding stock across the laboratory. Report exact, ambiguous, and missing requirements. After I confirm the records, use labspace_start_collection so Next and Previous visit the reviewed items and end at the recommended workspace. Do not invent a protocol, substitution, safety approval, or stock consumption.",
    ),
    voicePrompt: webMcpOnlyPrompt(
      "For my approved DPPH checklist, find DPPH reagent, methanol, 100 and 200 microlitre tips, pipettes, and the plate reader. Check chloroform separately, without treating it as a DPPH requirement. Assess the R-002 equipment and work surfaces, show missing stock, and wait for me before starting the collection guide.",
    ),
  },
] as const;

const WEBMCP_WORKFLOWS = [
  {
    id: "lle-stock-check",
    mode: "Ground",
    title: "Check an LLE solvent set",
    outcome: "Four recorded solvents · chloroform remains visibly missing",
    prompt: webMcpOnlyPrompt(
      "For my researcher-approved LLE stock list, check Methanol Solvent 99.9%, Ethyl acetate Solvent, n-Hexane Solvent, n-Butanol Solvent, and Chloroform across the project. Use labspace_resolve_materials, inspect the exact records you find, and report Chloroform as missing if it is not recorded. Do not suggest a substitution, generate a procedure, or claim the laboratory is suitable or safe for the work.",
    ),
  },
  {
    id: "collection",
    mode: "Collect",
    title: "Prepare a grounded collection guide",
    outcome: "Proposed checklist · real stock · Next/Previous evidence",
    prompt: webMcpOnlyPrompt(
      "Help prepare a collection checklist for my planned work. Ask for my approved protocol or material list if needed; label your suggestions clearly. Match the materials against LabSpace, report missing or ambiguous stock, then start a collection guide for the records I choose. Do not treat this as an experiment protocol or a safety-approved walking route.",
    ),
  },
  {
    id: "annex",
    mode: "Review",
    title: "Add a connected annex",
    outcome: "Stable wall split · separate floor · one reviewed commit",
    prompt: webMcpOnlyPrompt(
      "Audit the current room, choose a suitable full-height exterior wall, and calculate a 16 square metre preparation annex with an internal narrow-lite door and one outer observation window. Show me the primary and annex areas, then stage the connected annex for my approval. Do not approve it for me.",
    ),
  },
  {
    id: "evidence",
    mode: "Trace",
    title: "Find exact physical evidence",
    outcome: "Canonical record · storage path · focused 3D scene",
    prompt: webMcpOnlyPrompt(
      "Find Reference standards in LabSpace, inspect the exact canonical record, and focus its room and storage location. Explain the laboratory, room, cabinet, shelf or drawer path using only the returned evidence.",
    ),
  },
  {
    id: "audit",
    mode: "Audit",
    title: "Audit and improve a room",
    outcome: "Deterministic issues · ranked alternative · review preview",
    prompt: webMcpOnlyPrompt(
      "Audit the active LabSpace room. Summarize its deterministic readiness, identify the highest-priority geometry or front-working-zone issue, and—if it involves a movable object—use labspace_find_valid_placements to find grounded alternatives and stage the best correction for my review. For requests such as in front of or behind another object, pass relativeTo so direction is based on the reference object's authored front. Do not approve it for me.",
    ),
  },
  {
    id: "resize",
    mode: "Review",
    title: "Resize a hosted opening",
    outcome: "Wall-fit validation · accurate preview · human approval",
    prompt: webMcpOnlyPrompt(
      "Inspect the current room's observation windows. Calculate equal widths that fit their shared wall without overlap, validate the new dimensions, then stage the resize previews for my review. Do not approve any change.",
    ),
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
    name: "labspace_assess_workflow",
    label: "Assess workflow readiness",
    mode: "Read",
    description:
      "Grounds a reviewed material/equipment checklist and ranks real work surfaces for a final highlighted handoff.",
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
      "Turn reviewed record IDs into a room-grouped Next/Previous checklist, optionally ending at an assessed work surface.",
  },
  {
    name: "labspace_collection_step",
    label: "Follow collection guide",
    mode: "Navigate",
    description:
      "Next, previous, status, finish or history. Timestamped navigation and human checkpoints stay separate. No stock is consumed.",
  },
  {
    name: "labspace_audit_room",
    label: "Audit room readiness",
    mode: "Read",
    description:
      "Summarizes deterministic floor, boundary, support, front-working-zone, opening, overlap, height, and identity checks.",
  },
  {
    name: "labspace_create_room",
    label: "Create a blank room",
    mode: "Controlled",
    description:
      "Reviewed pauses before creation. Fast Draft may apply the validated additive room proposal.",
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
      "Ranks geometry-valid alternatives near an area or relative to another object's authored front, with a usable service face.",
  },
  {
    name: "labspace_search_assets",
    label: "Search planning assets",
    mode: "Read",
    description:
      "Openings, furniture, storage, equipment, and safety assets with exact dimensions.",
  },
  {
    name: "labspace_plan_annex",
    label: "Calculate a connected annex",
    mode: "Simulate",
    description:
      "Splits one stable primary wall, remaps hosted openings, and validates separate closed floors without mutation.",
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
    name: "labspace_stage_annex_plan",
    label: "Stage an annex for review",
    mode: "Review",
    description:
      "Previews the shared boundary, connector, independent floor, openings, and assets as one undoable approval.",
  },
  {
    name: "labspace_stage_room_plan",
    label: "Stage a room blueprint",
    mode: "Controlled",
    description:
      "Reviewed pauses every plan. Fast Draft applies only a complete first blueprint in a pristine created room.",
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
  const projectName = useEditorStore((state) => state.project.name);
  const room = useEditorStore(selectActiveRoom);
  const events = useAgentActivityStore((state) => state.events);
  const open = useAgentActivityStore((state) => state.open);
  const bridgeStatus = useAgentActivityStore((state) => state.bridgeStatus);
  const registeredTools = useAgentActivityStore((state) => state.registeredTools);
  const bridgeMessage = useAgentActivityStore((state) => state.bridgeMessage);
  const visibleCount = useAgentActivityStore((state) => state.visibleCount);
  const unreadCount = useAgentActivityStore((state) => state.unreadCount);
  const setOpen = useAgentActivityStore((state) => state.setOpen);
  const clear = useAgentActivityStore((state) => state.clear);
  const loadEarlier = useAgentActivityStore((state) => state.loadEarlier);
  const executionMode = useWebMcpExecutionPolicyStore((state) => state.mode);
  const setExecutionMode = useWebMcpExecutionPolicyStore((state) => state.setModeFromHumanUi);
  const [tab, setTab] = useState<InspectorTab>(
    COMPETITION_EVIDENCE_LAYER_ENABLED ? "mission" : "activity",
  );
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [copiedWorkflow, setCopiedWorkflow] = useState<string | null>(null);
  const [activityQuery, setActivityQuery] = useState("");
  const [activityActor, setActivityActor] = useState("all");
  const [activityStatus, setActivityStatus] = useState("all");
  const registeredCount = registeredTools.length;
  const evidenceSummary = useMemo(() => summarizeJudgeEvidence(events), [events]);
  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        if (activityActor !== "all" && event.actor !== activityActor) return false;
        if (activityStatus !== "all" && event.status !== activityStatus) return false;
        const query = activityQuery.trim().toLowerCase();
        return (
          !query ||
          [event.action, event.subject, event.toolName, event.correlationId]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query))
        );
      }),
    [activityActor, activityQuery, activityStatus, events],
  );
  const visibleEvents = filteredEvents.slice(0, visibleCount);

  const chooseExecutionMode = (mode: WebMcpExecutionMode) => {
    setExecutionMode(mode);
  };

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

  const copyWorkflow = async (id: string, prompt: string, revealWorkspace = false) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedWorkflow(id);
      if (revealWorkspace) setOpen(false);
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

  const exportJudgeEvidence = () => {
    downloadJudgeEvidenceBundle(
      {
        projectName,
        roomName: room.name,
        roomCode: room.code,
        route: window.location.pathname,
        bridgeStatus,
        registeredTools,
        executionMode,
      },
      events,
    );
  };

  const clearActivity = () => {
    if (
      window.confirm(
        "Clear all retained WebMCP activity from this browser? Export it first if you need a copy.",
      )
    )
      clear();
  };

  if (!open) return null;

  return (
    <aside
      className={`agent-activity-panel${
        COMPETITION_EVIDENCE_LAYER_ENABLED ? " is-competition-evidence" : ""
      }`}
      aria-label="WebMCP Inspector"
    >
      <header>
        <span className="agent-activity-icon" aria-hidden="true">
          <ClockCounterClockwise size={18} weight="duotone" />
        </span>
        <span>
          <b>WebMCP inspector</b>
          <small>{bridgeCopy(bridgeStatus, registeredCount)}</small>
        </span>
        {tab === "activity" && events.length > 0 && (
          <button onClick={clearActivity} aria-label="Clear WebMCP Activity">
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
            ? "Ready for your browser agent"
            : bridgeCopy(bridgeStatus, registeredCount)}
        </strong>
        <small>
          {bridgeStatus === "ready"
            ? "Calls use the same room, index, validator, and history as the visible interface."
            : (bridgeMessage ?? "LabSpace remains fully usable without browser-agent access.")}
        </small>
        {bridgeStatus === "ready" && tab === "guide" && (
          <button
            className="webmcp-check-button"
            onClick={() => void runReadOnlyCheck()}
            disabled={checkingConnection}
          >
            {checkingConnection ? "Running check…" : "Run read-only check"}
          </button>
        )}
        {connectionError && <em>{connectionError}</em>}
        {bridgeStatus === "ready" && tab === "guide" && (
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

      <section
        className={`webmcp-execution-gate is-${executionMode}`}
        aria-labelledby="webmcp-execution-title"
      >
        <div className="webmcp-execution-heading">
          <span aria-hidden="true">
            {executionMode === "reviewed" ? (
              <ShieldCheck size={19} weight="duotone" />
            ) : (
              <Lightning size={19} weight="fill" />
            )}
          </span>
          <span>
            <small>Execution boundary</small>
            <strong id="webmcp-execution-title">Human-controlled agent mode</strong>
          </span>
          <em>Session only</em>
        </div>
        <div className="webmcp-mode-switch" role="radiogroup" aria-label="WebMCP execution mode">
          <button
            type="button"
            role="radio"
            aria-checked={executionMode === "reviewed"}
            onClick={() => chooseExecutionMode("reviewed")}
          >
            <ShieldCheck size={16} weight="duotone" />
            <span>
              <b>Reviewed</b>
              <small>Approve before change</small>
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={executionMode === "fast-draft"}
            onClick={() => chooseExecutionMode("fast-draft")}
          >
            <Lightning size={16} weight="fill" />
            <span>
              <b>Fast Draft</b>
              <small>Validated additive drafts</small>
            </span>
          </button>
        </div>
        <div className="webmcp-execution-rail" role="status" aria-live="polite">
          <span aria-hidden="true" />
          <div>
            <b>
              {executionMode === "reviewed"
                ? "Every project mutation stops for you"
                : "Validated additive room drafts can proceed"}
            </b>
            <small>
              {executionMode === "reviewed"
                ? "The agent may calculate and preview, but only you can commit."
                : "The complete first blueprint keeps Undo. Existing placements, dimensions, inventory, stock, deletes, and validation failures escalate to review."}
            </small>
          </div>
        </div>
        <p>
          The browser agent cannot select or override this mode. Reloading LabSpace returns to
          Reviewed.
        </p>
      </section>

      <div className="webmcp-tabs" role="tablist" aria-label="WebMCP inspector sections">
        {COMPETITION_EVIDENCE_LAYER_ENABLED && (
          <button role="tab" aria-selected={tab === "mission"} onClick={() => setTab("mission")}>
            Judge mission
          </button>
        )}
        <button role="tab" aria-selected={tab === "activity"} onClick={() => setTab("activity")}>
          {COMPETITION_EVIDENCE_LAYER_ENABLED ? "Evidence" : "Activity history"}{" "}
          <b>{events.length}</b>
        </button>
        {!COMPETITION_EVIDENCE_LAYER_ENABLED && (
          <button
            role="tab"
            aria-selected={tab === "workflows"}
            onClick={() => setTab("workflows")}
          >
            Agent workflows <b>{WEBMCP_WORKFLOWS.length}</b>
          </button>
        )}
        <button role="tab" aria-selected={tab === "guide"} onClick={() => setTab("guide")}>
          {COMPETITION_EVIDENCE_LAYER_ENABLED ? "Setup" : "Use WebMCP"}
        </button>
        <button role="tab" aria-selected={tab === "tools"} onClick={() => setTab("tools")}>
          {COMPETITION_EVIDENCE_LAYER_ENABLED ? "Tools" : "Registered tools"}{" "}
          <b>{registeredCount}</b>
        </button>
      </div>

      {tab === "mission" ? (
        <div className="webmcp-mission" role="tabpanel">
          <section className="webmcp-mission-hero">
            <span className="webmcp-mission-kicker">Three-part judge demonstration</span>
            <h2>Build. Stock. Find the work.</h2>
            <p>
              One live laboratory story: create R-003, stage two stock records, then ground a
              cross-room DPPH collection and finish at a real work surface.
            </p>
            <div className="webmcp-mission-context" aria-label="Active mission context">
              <span>
                <MapPinLine size={16} weight="duotone" />
                <b>{room.name}</b>
                <small>{room.code}</small>
              </span>
              <span className={`webmcp-mission-readiness is-${bridgeStatus}`}>
                <span className="webmcp-status-dot" aria-hidden="true" />
                {bridgeStatus === "ready" ? `${registeredCount} tools ready` : "Bridge not ready"}
              </span>
            </div>
          </section>

          <ol className="webmcp-evidence-path" aria-label="Signature WebMCP evidence path">
            <li>
              <span>1</span>
              <div>
                <small>Build</small>
                <b>Create R-003</b>
              </div>
              <ArrowRight size={14} aria-hidden="true" />
            </li>
            <li>
              <span>2</span>
              <div>
                <small>Stock</small>
                <b>Stage records</b>
              </div>
              <ArrowRight size={14} aria-hidden="true" />
            </li>
            <li>
              <span>3</span>
              <div>
                <small>Find</small>
                <b>Ground evidence</b>
              </div>
              <ArrowRight size={14} aria-hidden="true" />
            </li>
            <li>
              <span>4</span>
              <div>
                <small>Handoff</small>
                <b>Real workspace</b>
              </div>
            </li>
          </ol>

          <section className="webmcp-demo-missions" aria-label="Judge demonstration prompts">
            {DEMO_MISSIONS.map((mission, index) => (
              <article className="webmcp-signature-card" key={mission.id}>
                <header>
                  <span>
                    <small>{mission.step}</small>
                    <strong>{mission.title}</strong>
                  </span>
                  <em>{mission.mode}</em>
                </header>
                <p>{mission.prompt}</p>
                <small>{mission.outcome}</small>
                <div>
                  <button
                    className={index === 0 ? "webmcp-primary-action" : undefined}
                    onClick={() => void copyWorkflow(mission.id, mission.prompt, true)}
                    title="Copy this WebMCP-only prompt and close the panel so the workspace remains visible"
                  >
                    {copiedWorkflow === mission.id ? (
                      <Check size={16} weight="bold" />
                    ) : (
                      <Copy size={16} />
                    )}
                    {copiedWorkflow === mission.id ? "Copied" : "Copy + show workspace"}
                  </button>
                  <button
                    onClick={() =>
                      void copyWorkflow(`${mission.id}-voice`, mission.voicePrompt, true)
                    }
                    title="Copy the shorter voice-ready prompt and close the panel"
                  >
                    {copiedWorkflow === `${mission.id}-voice` ? (
                      <Check size={16} weight="bold" />
                    ) : (
                      <Waveform size={16} />
                    )}
                    {copiedWorkflow === `${mission.id}-voice` ? "Copied" : "Voice-ready"}
                  </button>
                </div>
              </article>
            ))}
          </section>

          <section className="webmcp-proof-strip" aria-label="Current session evidence summary">
            <header>
              <span>
                <small>Session evidence</small>
                <strong>
                  {evidenceSummary.toolCalls > 0
                    ? `${evidenceSummary.toolCalls} tool calls recorded`
                    : "Ready to record the first call"}
                </strong>
              </span>
              <button onClick={exportJudgeEvidence} aria-label="Export WebMCP session evidence">
                <FileArrowDown size={16} /> Export proof
              </button>
            </header>
            <div>
              <span>
                <b>{evidenceSummary.uniqueToolsUsed}</b>
                <small>tools used</small>
              </span>
              <span>
                <b>{evidenceSummary.correlatedRuns}</b>
                <small>grounded runs</small>
              </span>
              <span>
                <b>{evidenceSummary.humanDecisions}</b>
                <small>human decisions</small>
              </span>
              <span className={evidenceSummary.errors > 0 ? "has-errors" : undefined}>
                <b>{evidenceSummary.errors}</b>
                <small>errors</small>
              </span>
            </div>
            <p>
              Bounded tool evidence only—not hidden reasoning, a certified audit log, or an approved
              protocol.
            </p>
          </section>

          <details className="webmcp-more-missions">
            <summary>
              More judge workflows <b>{WEBMCP_WORKFLOWS.length}</b>
            </summary>
            <div>
              {WEBMCP_WORKFLOWS.map((workflow) => (
                <article key={workflow.id}>
                  <span>
                    <small>{workflow.mode}</small>
                    <strong>{workflow.title}</strong>
                    <em>{workflow.outcome}</em>
                  </span>
                  <button
                    onClick={() => void copyWorkflow(workflow.id, workflow.prompt)}
                    aria-label={`Copy ${workflow.title} prompt`}
                  >
                    {copiedWorkflow === workflow.id ? (
                      <Check size={15} weight="bold" />
                    ) : (
                      <Copy size={15} />
                    )}
                    {copiedWorkflow === workflow.id ? "Copied" : "Copy"}
                  </button>
                </article>
              ))}
            </div>
          </details>
        </div>
      ) : tab === "activity" ? (
        <div className="agent-activity-list" aria-live="polite" role="tabpanel">
          {events.length > 0 && (
            <div className="agent-activity-toolbar">
              <label className="agent-activity-search">
                <span>Find evidence</span>
                <input
                  value={activityQuery}
                  onChange={(event) => setActivityQuery(event.target.value)}
                  placeholder="Tool, room, action, plan…"
                />
              </label>
              <div className="agent-activity-filters">
                <select
                  value={activityActor}
                  onChange={(event) => setActivityActor(event.target.value)}
                  aria-label="Filter activity actor"
                >
                  <option value="all">All actors</option>
                  <option value="WebMCP">WebMCP</option>
                  <option value="Human">Human</option>
                  <option value="LabSpace">LabSpace</option>
                  <option value="Agent">Agent</option>
                </select>
                <select
                  value={activityStatus}
                  onChange={(event) => setActivityStatus(event.target.value)}
                  aria-label="Filter activity status"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="committed">Committed</option>
                  <option value="blocked">Blocked</option>
                  <option value="error">Error</option>
                </select>
                <button
                  onClick={() => downloadAgentActivityHistory(filteredEvents, "json")}
                  aria-label="Export filtered activity as JSON"
                  title="Export JSON"
                >
                  <DownloadSimple size={14} /> JSON
                </button>
                <button
                  onClick={() => downloadAgentActivityHistory(filteredEvents, "csv")}
                  aria-label="Export filtered activity as CSV"
                  title="Export CSV"
                >
                  <DownloadSimple size={14} /> CSV
                </button>
              </div>
              <small>
                Showing {visibleEvents.length} of {filteredEvents.length} matching events ·{" "}
                {events.length}
                total recorded
                {unreadCount > 0 ? ` · ${unreadCount} unread` : ""}
              </small>
              <small>
                Up to {MAX_ACTIVITY_EVENTS} newest events are retained. Exports use the current
                filtered history; if browser storage is unavailable, evidence remains only in this
                tab.
              </small>
            </div>
          )}
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
            visibleEvents.map((event) => (
              <article key={event.id} className={`activity-status-${event.status}`}>
                <div className="agent-activity-meta">
                  <b>{event.actor}</b>
                  <time dateTime={event.createdAt}>{eventTime(event.createdAt)}</time>
                  <span>{event.status}</span>
                </div>
                {event.correlationId && (
                  <code className="agent-activity-correlation" title={event.correlationId}>
                    Run · {event.correlationId.slice(0, 12)}
                  </code>
                )}
                <strong>{event.action}</strong>
                <p>{event.subject}</p>
                {(event.request || event.response) && (
                  <details className="webmcp-event-detail">
                    <summary>Tool evidence</summary>
                    {event.toolName && <code className="webmcp-tool-name">{event.toolName}</code>}
                    {event.evidence && <small>{event.evidence}</small>}
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
                  </details>
                )}
              </article>
            ))
          )}
          {visibleEvents.length < filteredEvents.length && (
            <button className="agent-activity-load" onClick={loadEarlier}>
              <ClockCounterClockwise size={15} /> Load 30 earlier events
            </button>
          )}
          {events.length > 0 && filteredEvents.length === 0 && (
            <div className="agent-activity-empty compact">
              <b>No matching evidence</b>
              <span>Change the actor, status, or search filter.</span>
            </div>
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
          {WEBMCP_WORKFLOWS.map((workflow) => (
            <article key={workflow.id}>
              <span className="webmcp-workflow-number">
                <Path size={18} />
              </span>
              <div>
                <span className="webmcp-workflow-mode">{workflow.mode}</span>
                <strong>{workflow.title}</strong>
                <small>{workflow.outcome}</small>
                <details className="webmcp-prompt-detail">
                  <summary>View prompt</summary>
                  <p>{workflow.prompt}</p>
                </details>
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
              Reviewed is the default. Fast Draft is a visible human authorization for validated
              additive room creation only; sensitive or existing-state changes still pause here.
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
              Execution mode has no WebMCP tool argument. The human-controlled switch above is the
              only authority, and Reviewed is restored on each application session.
            </span>
          </footer>
        </div>
      )}
    </aside>
  );
}

export function WebMCPHeaderButton() {
  const events = useAgentActivityStore((state) => state.events);
  const unreadCount = useAgentActivityStore((state) => state.unreadCount);
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
      {unreadCount > 0 && <b>{unreadCount}</b>}
    </button>
  );
}
