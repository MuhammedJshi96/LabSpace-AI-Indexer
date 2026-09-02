import { describe, expect, it } from "vitest";
import type { AgentActivityEvent } from "../../src/agent/agent-activity-store";
import {
  buildJudgeEvidenceBundle,
  JUDGE_EVIDENCE_SCHEMA,
  summarizeJudgeEvidence,
} from "../../src/agent/judge-evidence";

const event = (id: string, patch: Partial<AgentActivityEvent> = {}): AgentActivityEvent => ({
  id,
  createdAt: `2026-09-02T10:00:0${id}Z`,
  actor: "WebMCP",
  action: "Tool completed",
  subject: "Grounded evidence",
  status: "found",
  evidence: null,
  toolName: "labspace_search_records",
  request: "{}",
  response: "{}",
  correlationId: "run-1",
  roomId: "room-1",
  ...patch,
});

describe("judge evidence bundle", () => {
  it("summarizes real retained events without inventing success", () => {
    const events = [
      event("1"),
      event("2", { toolName: "labspace_focus_record", status: "focused" }),
      event("3", {
        actor: "Human",
        toolName: null,
        status: "approved",
        correlationId: "run-2",
      }),
      event("4", { status: "blocked", correlationId: "run-2" }),
      event("5", { status: "error", correlationId: null }),
    ];

    expect(summarizeJudgeEvidence(events)).toEqual({
      retainedEvents: 5,
      toolCalls: 4,
      uniqueToolsUsed: 2,
      humanDecisions: 1,
      committedChanges: 0,
      blockedCalls: 1,
      errors: 1,
      correlatedRuns: 2,
    });
  });

  it("exports sorted registrations, workspace context, policy, and chronological evidence", () => {
    const events = [event("2"), event("1")];
    const bundle = buildJudgeEvidenceBundle(
      {
        projectName: "Project",
        roomName: "Demo room",
        roomCode: "DEMO-01",
        route: "/digital-twin",
        bridgeStatus: "ready",
        registeredTools: ["z_tool", "a_tool", "a_tool"],
        executionMode: "reviewed",
      },
      events,
      "2026-09-02T12:00:00.000Z",
    );

    expect(bundle.schema).toBe(JUDGE_EVIDENCE_SCHEMA);
    expect(bundle.product).toBe("LabSpace Atlas");
    expect(bundle.browserBridge.registeredTools).toEqual(["a_tool", "z_tool"]);
    expect(bundle.browserBridge.registeredToolCount).toBe(2);
    expect(bundle.humanControl).toMatchObject({
      executionMode: "reviewed",
      reviewedByDefault: true,
      agentCanSelectMode: false,
    });
    expect(bundle.timeline.map((entry) => entry.id)).toEqual(["1", "2"]);
    expect(bundle.purpose).toContain("not hidden model reasoning");
  });
});
