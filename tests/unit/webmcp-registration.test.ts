import { describe, expect, it, vi } from "vitest";
import type { LabSpaceReadActions, LabSpaceReadState } from "../../src/agent/labspace-action-types";
import { createLabSpaceReadActions } from "../../src/agent/labspace-read-actions";
import { createSeedProject } from "../../src/domain/seed";
import {
  LABSPACE_WEBMCP_TOOL_NAMES,
  registerLabSpaceTools,
} from "../../src/webmcp/register-labspace-tools";

class MockModelContext extends EventTarget implements WebMCP.ModelContext {
  readonly activeTools = new Map<string, WebMCP.ModelContextTool>();
  ontoolchange: ((this: WebMCP.ModelContext, ev: Event) => unknown) | null = null;

  async registerTool(
    tool: WebMCP.ModelContextTool,
    options?: WebMCP.ModelContextRegisterToolOptions,
  ) {
    if (options?.signal?.aborted) return;
    this.activeTools.set(tool.name, tool);
    options?.signal?.addEventListener(
      "abort",
      () => {
        if (this.activeTools.get(tool.name) === tool) this.activeTools.delete(tool.name);
      },
      { once: true },
    );
  }

  async getTools() {
    return [...this.activeTools.values()]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(
        (tool) =>
          ({
            ...tool,
            title: tool.title ?? "",
            origin: "http://127.0.0.1:3004",
            window: {} as Window,
          }) satisfies WebMCP.RegisteredTool,
      );
  }
}

function fakeActions(): LabSpaceReadActions {
  return {
    getLabContext: vi.fn(() => ({ source: "context" }) as never),
    searchLabRecords: vi.fn((input) => ({ source: "search", input }) as never),
    inspectLabRecord: vi.fn((input) => ({ source: "inspect", input }) as never),
  };
}

describe("LabSpace WebMCP registration", () => {
  it("is a no-op when document.modelContext is unavailable", async () => {
    const registration = registerLabSpaceTools({ modelContext: undefined });

    await expect(registration.ready).resolves.toBeUndefined();
    expect(registration.tools).toEqual([]);
    expect(registration.signal.aborted).toBe(false);
    expect(() => registration.unregister()).not.toThrow();
    expect(registration.signal.aborted).toBe(true);
  });

  it("registers exactly three read-only, untrusted-content tools with focused schemas", async () => {
    const modelContext = new MockModelContext();
    const registration = registerLabSpaceTools({ modelContext, actions: fakeActions() });
    await registration.ready;
    const tools = await modelContext.getTools();

    expect(tools.map((tool) => tool.name)).toEqual([...LABSPACE_WEBMCP_TOOL_NAMES]);
    expect(tools).toHaveLength(3);
    for (const tool of tools) {
      expect(tool.annotations).toEqual({ readOnlyHint: true, untrustedContentHint: true });
      expect(tool.inputSchema).toMatchObject({
        type: "object",
        additionalProperties: false,
      });
    }
    const search = tools.find((tool) => tool.name === "labspace_search_records")!;
    expect(search.inputSchema).toMatchObject({
      required: ["query"],
      properties: {
        scope: { enum: ["project", "room"] },
        kinds: { items: { enum: ["inventory", "equipment", "location"] } },
        limit: { minimum: 1, maximum: 12 },
      },
    });
  });

  it("delegates execution to the read-action boundary and honors cancellation", async () => {
    const modelContext = new MockModelContext();
    const actions = fakeActions();
    const registration = registerLabSpaceTools({ modelContext, actions });
    await registration.ready;
    const signal = new AbortController().signal;
    const context = modelContext.activeTools.get("labspace_get_context")!;
    const search = modelContext.activeTools.get("labspace_search_records")!;
    const inspect = modelContext.activeTools.get("labspace_inspect_record")!;

    expect(await context.execute({}, { signal })).toEqual({ source: "context" });
    expect(await search.execute({ query: "evaporator" }, { signal })).toEqual({
      source: "search",
      input: { query: "evaporator" },
    });
    expect(await inspect.execute({ recordId: "record-1" }, { signal })).toEqual({
      source: "inspect",
      input: { recordId: "record-1" },
    });
    expect(actions.getLabContext).toHaveBeenCalledOnce();
    expect(actions.searchLabRecords).toHaveBeenCalledWith({ query: "evaporator" });
    expect(actions.inspectLabRecord).toHaveBeenCalledWith({ recordId: "record-1" });

    const cancelled = new AbortController();
    cancelled.abort(new Error("Cancelled"));
    expect(() => context.execute({}, { signal: cancelled.signal })).toThrow(/Cancelled/);
  });

  it("unregisters with AbortSignal and remounts without duplicate active tools", async () => {
    const modelContext = new MockModelContext();
    const first = registerLabSpaceTools({ modelContext, actions: fakeActions() });
    await first.ready;
    expect(modelContext.activeTools.size).toBe(3);

    first.unregister();
    expect(modelContext.activeTools.size).toBe(0);

    const second = registerLabSpaceTools({ modelContext, actions: fakeActions() });
    await second.ready;
    expect(modelContext.activeTools.size).toBe(3);
    expect([...modelContext.activeTools]).toHaveLength(3);
    second.unregister();
    expect(modelContext.activeTools.size).toBe(0);
  });

  it("reads current state when a registered tool executes, not when it registers", async () => {
    let state: LabSpaceReadState;
    const project = createSeedProject();
    const room = project.rooms.find((entry) => entry.roomKind === "demo")!;
    project.activeRoomId = room.id;
    state = { project, selectedObjectIds: [], selectedStorageLocationId: null };
    const actions = createLabSpaceReadActions(() => state);
    const modelContext = new MockModelContext();
    const registration = registerLabSpaceTools({ modelContext, actions });
    await registration.ready;
    const context = modelContext.activeTools.get("labspace_get_context")!;
    const signal = new AbortController().signal;

    const before = (await context.execute({}, { signal })) as { project: { name: string } };
    state = { ...state, project: { ...state.project, name: "Live project state" } };
    const after = (await context.execute({}, { signal })) as { project: { name: string } };

    expect(before.project.name).not.toBe("Live project state");
    expect(after.project.name).toBe("Live project state");
  });
});
