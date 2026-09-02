import type { AgentActivityEvent, WebMCPBridgeStatus } from "./agent-activity-store";
import type { WebMcpExecutionMode } from "./webmcp-execution-policy";

export const JUDGE_EVIDENCE_SCHEMA = "labspace.webmcp-session-evidence.v1";

export type JudgeEvidenceContext = {
  projectName: string;
  roomName: string;
  roomCode: string;
  route: string;
  bridgeStatus: WebMCPBridgeStatus;
  registeredTools: string[];
  executionMode: WebMcpExecutionMode;
};

export type JudgeEvidenceSummary = {
  retainedEvents: number;
  toolCalls: number;
  uniqueToolsUsed: number;
  humanDecisions: number;
  committedChanges: number;
  blockedCalls: number;
  errors: number;
  correlatedRuns: number;
};

export function summarizeJudgeEvidence(
  events: readonly AgentActivityEvent[],
): JudgeEvidenceSummary {
  const tools = new Set(events.flatMap((event) => (event.toolName ? [event.toolName] : [])));
  const runs = new Set(
    events.flatMap((event) => (event.correlationId ? [event.correlationId] : [])),
  );
  return {
    retainedEvents: events.length,
    toolCalls: events.filter((event) => event.actor === "WebMCP" || event.toolName).length,
    uniqueToolsUsed: tools.size,
    humanDecisions: events.filter(
      (event) =>
        event.actor === "Human" || event.status === "approved" || event.status === "rejected",
    ).length,
    committedChanges: events.filter((event) => event.status === "committed").length,
    blockedCalls: events.filter((event) => event.status === "blocked").length,
    errors: events.filter((event) => event.status === "error").length,
    correlatedRuns: runs.size,
  };
}

export function buildJudgeEvidenceBundle(
  context: JudgeEvidenceContext,
  events: readonly AgentActivityEvent[],
  exportedAt = new Date().toISOString(),
) {
  const registeredTools = [...new Set(context.registeredTools)].sort();
  return {
    schema: JUDGE_EVIDENCE_SCHEMA,
    exportedAt,
    product: "LabSpace Atlas",
    purpose:
      "Bounded WebMCP session evidence for product evaluation; not hidden model reasoning, a certified audit log, or an approved laboratory protocol.",
    workspace: {
      projectName: context.projectName,
      roomName: context.roomName,
      roomCode: context.roomCode,
      route: context.route,
    },
    browserBridge: {
      status: context.bridgeStatus,
      registeredToolCount: registeredTools.length,
      registeredTools,
    },
    humanControl: {
      executionMode: context.executionMode,
      reviewedByDefault: true,
      agentCanSelectMode: false,
      statement:
        context.executionMode === "reviewed"
          ? "Project mutations stop for explicit human approval."
          : "Only allowlisted validated additive room drafts may auto-apply; sensitive and existing-state changes still require review.",
    },
    summary: summarizeJudgeEvidence(events),
    timeline: [...events].reverse(),
  };
}

export function downloadJudgeEvidenceBundle(
  context: JudgeEvidenceContext,
  events: readonly AgentActivityEvent[],
) {
  const payload = buildJudgeEvidenceBundle(context, events);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `labspace-webmcp-session-evidence-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
