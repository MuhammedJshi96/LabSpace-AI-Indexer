import { beforeEach, describe, expect, it } from "vitest";
import {
  ACTIVITY_PAGE_SIZE,
  agentActivityActions,
  recordControlledToolError,
  recordWebMCPToolSuccess,
  useAgentActivityStore,
  serializeAgentActivityHistory,
} from "../../src/agent/agent-activity-store";
import { registerLabSpaceTools } from "../../src/webmcp/register-labspace-tools";

beforeEach(() => {
  useAgentActivityStore.setState({
    events: [],
    open: false,
    visibleCount: ACTIVITY_PAGE_SIZE,
    unreadCount: 0,
  });
});

describe("Agent Activity evidence", () => {
  it("keeps complete newest-first history while paging thirty entries at a time", () => {
    for (let index = 0; index < ACTIVITY_PAGE_SIZE + 8; index += 1) {
      agentActivityActions.record({
        actor: "Agent",
        action: "Spatial search",
        subject: `Record ${index}`,
        status: "found",
        evidence: `${index} matches`,
      });
    }

    const events = useAgentActivityStore.getState().events;
    expect(events).toHaveLength(ACTIVITY_PAGE_SIZE + 8);
    expect(events[0].subject).toBe(`Record ${ACTIVITY_PAGE_SIZE + 7}`);
    expect(events.at(-1)?.subject).toBe("Record 0");
    expect(useAgentActivityStore.getState().visibleCount).toBe(ACTIVITY_PAGE_SIZE);
    expect(useAgentActivityStore.getState().unreadCount).toBe(ACTIVITY_PAGE_SIZE + 8);
    useAgentActivityStore.getState().loadEarlier();
    expect(useAgentActivityStore.getState().visibleCount).toBe(ACTIVITY_PAGE_SIZE + 8);
  });

  it("compacts evidence and removes local filesystem paths", () => {
    recordControlledToolError(
      "Record inspection",
      new Error(
        `Unable to open C:\\Users\\Researcher\\private\\record.json ${"detail ".repeat(80)}`,
      ),
    );

    const event = useAgentActivityStore.getState().events[0];
    expect(event).toMatchObject({
      actor: "LabSpace",
      action: "Record inspection",
      status: "error",
    });
    expect(event.evidence).toContain("[local path hidden]");
    expect(event.evidence).not.toContain("Researcher");
    expect(event.evidence!.length).toBeLessThanOrEqual(220);
  });

  it("records the visible WebMCP tool name and bounded structured input and result", () => {
    recordWebMCPToolSuccess(
      "labspace_search_records",
      "Spatial search",
      "“Reference standards”",
      "found",
      { query: "Reference standards", privatePath: "C:\\Users\\Researcher\\secret.json" },
      { totalMatches: 1, results: [{ name: "Reference standards" }] },
    );

    const event = useAgentActivityStore.getState().events[0];
    expect(event).toMatchObject({
      actor: "WebMCP",
      toolName: "labspace_search_records",
      action: "Spatial search",
      status: "found",
    });
    expect(event.request).toContain("Reference standards");
    expect(event.request).toContain("[local path hidden]");
    expect(event.request).not.toContain("Researcher");
    expect(event.response).toContain('"totalMatches":1');
  });

  it("correlates plan calls and exports complete structured evidence", () => {
    recordWebMCPToolSuccess(
      "labspace_plan_annex",
      "Annex planning",
      "Preparation annex",
      "found",
      { parentRoomCode: "MAIN-01" },
      { planId: "plan-annex-1", roomId: "room-1", areas: { annexM2: 16.2 } },
    );
    const event = useAgentActivityStore.getState().events[0];
    expect(event).toMatchObject({
      correlationId: "plan-annex-1",
      roomId: "room-1",
    });
    expect(serializeAgentActivityHistory([event], "json")).toContain("plan-annex-1");
    expect(serializeAgentActivityHistory([event], "csv")).toContain('"labspace_plan_annex"');
  });

  it("publishes the browser registration state without creating a fake tool event", () => {
    agentActivityActions.setBridgeState("ready", [
      "labspace_get_context",
      "labspace_search_records",
    ]);

    expect(useAgentActivityStore.getState()).toMatchObject({
      bridgeStatus: "ready",
      registeredTools: ["labspace_get_context", "labspace_search_records"],
      events: [],
    });
  });

  it("does not create events merely by mounting and unmounting the bridge", async () => {
    const tools = new Map<string, WebMCP.ModelContextTool>();
    const modelContext = {
      registerTool: async (tool: WebMCP.ModelContextTool, options?: { signal?: AbortSignal }) => {
        tools.set(tool.name, tool);
        options?.signal?.addEventListener("abort", () => tools.delete(tool.name), { once: true });
      },
      getTools: async () => [...tools.values()],
    } as unknown as WebMCP.ModelContext;

    const first = registerLabSpaceTools({ modelContext });
    await first.ready;
    first.unregister();
    const second = registerLabSpaceTools({ modelContext });
    await second.ready;
    second.unregister();

    expect(useAgentActivityStore.getState().events).toEqual([]);
  });
});
