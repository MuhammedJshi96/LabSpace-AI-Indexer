import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_ACTIVITY_EVENTS,
  agentActivityActions,
  recordControlledToolError,
  useAgentActivityStore,
} from "../../src/agent/agent-activity-store";
import { registerLabSpaceTools } from "../../src/webmcp/register-labspace-tools";

beforeEach(() => {
  useAgentActivityStore.setState({ events: [], open: false });
});

describe("Agent Activity evidence", () => {
  it("keeps a bounded newest-first evidence log", () => {
    for (let index = 0; index < MAX_ACTIVITY_EVENTS + 8; index += 1) {
      agentActivityActions.record({
        actor: "Agent",
        action: "Spatial search",
        subject: `Record ${index}`,
        status: "found",
        evidence: `${index} matches`,
      });
    }

    const events = useAgentActivityStore.getState().events;
    expect(events).toHaveLength(MAX_ACTIVITY_EVENTS);
    expect(events[0].subject).toBe(`Record ${MAX_ACTIVITY_EVENTS + 7}`);
    expect(events.at(-1)?.subject).toBe("Record 8");
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
