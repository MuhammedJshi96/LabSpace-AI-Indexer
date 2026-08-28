import { describe, expect, it, vi } from "vitest";
import type {
  LabSpaceNavigationActions,
  LabSpaceReadActions,
  LabSpaceReadState,
  LabSpaceSpatialActions,
  LabSpaceStagingActions,
} from "../../src/agent/labspace-action-types";
import { createLabSpaceReadActions } from "../../src/agent/labspace-read-actions";
import { createSeedProject } from "../../src/domain/seed";
import {
  createLabSpaceToolDefinitions,
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

function fakeNavigationActions(): LabSpaceNavigationActions {
  return {
    focusLabRecord: vi.fn((input) => ({ source: "focus", input }) as never),
  };
}

function fakeSpatialActions(): LabSpaceSpatialActions {
  return {
    validateObjectMove: vi.fn((input) => ({ source: "validate", input }) as never),
    recommendObjectPlacements: vi.fn((input) => ({ source: "recommend", input }) as never),
  };
}

function fakeStagingActions(): LabSpaceStagingActions {
  return {
    stageObjectMove: vi.fn((input) => ({ source: "stage", input }) as never),
    approveStagedObjectMove: vi.fn(),
    cancelStagedObjectMove: vi.fn(),
  };
}

type ChromeCompatibleExecute = (
  input: Record<string, unknown>,
  executionContext?: WebMCP.ToolExecuteCallbackOptions,
) => WebMCP.MaybePromise<unknown>;

function executeLikeChrome151(tool: WebMCP.ModelContextTool): ChromeCompatibleExecute {
  return tool.execute as ChromeCompatibleExecute;
}

describe("LabSpace WebMCP registration", () => {
  it("keeps tool metadata within the competition quality budget", () => {
    const tools = createLabSpaceToolDefinitions(
      fakeActions(),
      fakeNavigationActions(),
      fakeSpatialActions(),
      fakeStagingActions(),
    );
    const schemaDescriptions = (value: unknown): string[] => {
      if (!value || typeof value !== "object") return [];
      const record = value as Record<string, unknown>;
      return [
        ...(typeof record.description === "string" ? [record.description] : []),
        ...Object.values(record).flatMap(schemaDescriptions),
      ];
    };

    for (const tool of tools) {
      expect(tool.name).toMatch(/^[A-Za-z0-9_.-]+$/);
      expect(tool.name.length).toBeLessThanOrEqual(30);
      expect(tool.description.length).toBeLessThanOrEqual(500);
      expect(tool.title?.length ?? 0).toBeLessThanOrEqual(80);
      for (const description of schemaDescriptions(tool.inputSchema)) {
        expect(description.length).toBeLessThanOrEqual(150);
      }
    }
  });

  it("is a no-op when document.modelContext is unavailable", async () => {
    const registration = registerLabSpaceTools({ modelContext: undefined });

    await expect(registration.ready).resolves.toBeUndefined();
    expect(registration.tools).toEqual([]);
    expect(registration.signal.aborted).toBe(false);
    expect(() => registration.unregister()).not.toThrow();
    expect(registration.signal.aborted).toBe(true);
  });

  it("registers the focused WebMCP tool set with accurate annotations and schemas", async () => {
    const modelContext = new MockModelContext();
    const registration = registerLabSpaceTools({ modelContext, actions: fakeActions() });
    await registration.ready;
    const tools = await modelContext.getTools();

    expect(tools.map((tool) => tool.name)).toEqual([...LABSPACE_WEBMCP_TOOL_NAMES]);
    expect(tools).toHaveLength(7);
    for (const tool of tools) {
      expect(tool.annotations?.untrustedContentHint).toBe(true);
      expect(tool.annotations?.readOnlyHint).toBe(
        !["labspace_focus_record", "labspace_stage_object_move"].includes(tool.name),
      );
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
    const recommendations = tools.find((tool) => tool.name === "labspace_find_valid_placements")!;
    expect(recommendations.inputSchema).toMatchObject({
      required: ["objectId"],
      properties: {
        rotationsDeg: { minItems: 1, maxItems: 4 },
        limit: { minimum: 1, maximum: 5 },
      },
    });
  });

  it("delegates execution to the read-action boundary and honors cancellation", async () => {
    const modelContext = new MockModelContext();
    const actions = fakeActions();
    const navigationActions = fakeNavigationActions();
    const spatialActions = fakeSpatialActions();
    const stagingActions = fakeStagingActions();
    const registration = registerLabSpaceTools({
      modelContext,
      actions,
      navigationActions,
      spatialActions,
      stagingActions,
    });
    await registration.ready;
    const signal = new AbortController().signal;
    const context = modelContext.activeTools.get("labspace_get_context")!;
    const focus = modelContext.activeTools.get("labspace_focus_record")!;
    const search = modelContext.activeTools.get("labspace_search_records")!;
    const inspect = modelContext.activeTools.get("labspace_inspect_record")!;
    const validate = modelContext.activeTools.get("labspace_validate_object_move")!;
    const recommend = modelContext.activeTools.get("labspace_find_valid_placements")!;
    const stage = modelContext.activeTools.get("labspace_stage_object_move")!;

    expect(await context.execute({}, { signal })).toEqual({ source: "context" });
    expect(await focus.execute({ recordId: "record-1" }, { signal })).toEqual({
      source: "focus",
      input: { recordId: "record-1" },
    });
    expect(await search.execute({ query: "evaporator" }, { signal })).toEqual({
      source: "search",
      input: { query: "evaporator" },
    });
    expect(await inspect.execute({ recordId: "record-1" }, { signal })).toEqual({
      source: "inspect",
      input: { recordId: "record-1" },
    });
    expect(
      await recommend.execute(
        { objectId: "object-1", preferredTarget: { xMm: 1000, yMm: 2000 } },
        { signal },
      ),
    ).toEqual({
      source: "recommend",
      input: { objectId: "object-1", preferredTarget: { xMm: 1000, yMm: 2000 } },
    });
    expect(
      await stage.execute({ objectId: "object-1", target: { xMm: 1000, yMm: 2000 } }, { signal }),
    ).toEqual({
      source: "stage",
      input: { objectId: "object-1", target: { xMm: 1000, yMm: 2000 } },
    });
    expect(
      await validate.execute(
        { objectId: "object-1", target: { xMm: 1000, yMm: 2000 } },
        { signal },
      ),
    ).toEqual({
      source: "validate",
      input: { objectId: "object-1", target: { xMm: 1000, yMm: 2000 } },
    });
    expect(actions.getLabContext).toHaveBeenCalledOnce();
    expect(navigationActions.focusLabRecord).toHaveBeenCalledWith({ recordId: "record-1" });
    expect(actions.searchLabRecords).toHaveBeenCalledWith({ query: "evaporator" });
    expect(actions.inspectLabRecord).toHaveBeenCalledWith({ recordId: "record-1" });
    expect(spatialActions.validateObjectMove).toHaveBeenCalledWith({
      objectId: "object-1",
      target: { xMm: 1000, yMm: 2000 },
    });
    expect(spatialActions.recommendObjectPlacements).toHaveBeenCalledWith({
      objectId: "object-1",
      preferredTarget: { xMm: 1000, yMm: 2000 },
    });
    expect(stagingActions.stageObjectMove).toHaveBeenCalledWith({
      objectId: "object-1",
      target: { xMm: 1000, yMm: 2000 },
    });

    const cancelled = new AbortController();
    cancelled.abort(new Error("Cancelled"));
    expect(() => context.execute({}, { signal: cancelled.signal })).toThrow(/Cancelled/);
  });

  it("executes every tool when Chrome omits the execution context", async () => {
    const modelContext = new MockModelContext();
    const actions = fakeActions();
    const navigationActions = fakeNavigationActions();
    const spatialActions = fakeSpatialActions();
    const stagingActions = fakeStagingActions();
    const registration = registerLabSpaceTools({
      modelContext,
      actions,
      navigationActions,
      spatialActions,
      stagingActions,
    });
    await registration.ready;
    const context = modelContext.activeTools.get("labspace_get_context")!;
    const focus = modelContext.activeTools.get("labspace_focus_record")!;
    const search = modelContext.activeTools.get("labspace_search_records")!;
    const inspect = modelContext.activeTools.get("labspace_inspect_record")!;
    const validate = modelContext.activeTools.get("labspace_validate_object_move")!;
    const recommend = modelContext.activeTools.get("labspace_find_valid_placements")!;
    const stage = modelContext.activeTools.get("labspace_stage_object_move")!;

    expect(await executeLikeChrome151(context)({})).toEqual({ source: "context" });
    expect(await executeLikeChrome151(focus)({ recordId: "record-1" })).toEqual({
      source: "focus",
      input: { recordId: "record-1" },
    });
    expect(await executeLikeChrome151(search)({ query: "Reference standards" })).toEqual({
      source: "search",
      input: { query: "Reference standards" },
    });
    expect(
      await executeLikeChrome151(inspect)({ recordId: "inventory:reference-standards" }),
    ).toEqual({
      source: "inspect",
      input: { recordId: "inventory:reference-standards" },
    });
    expect(
      await executeLikeChrome151(recommend)({
        objectId: "object-1",
        preferredTarget: { xMm: 1000, yMm: 2000 },
      }),
    ).toEqual({
      source: "recommend",
      input: { objectId: "object-1", preferredTarget: { xMm: 1000, yMm: 2000 } },
    });
    expect(
      await executeLikeChrome151(stage)({
        objectId: "object-1",
        target: { xMm: 1000, yMm: 2000 },
      }),
    ).toEqual({
      source: "stage",
      input: { objectId: "object-1", target: { xMm: 1000, yMm: 2000 } },
    });
    expect(
      await executeLikeChrome151(validate)({
        objectId: "object-1",
        target: { xMm: 1000, yMm: 2000 },
      }),
    ).toEqual({
      source: "validate",
      input: { objectId: "object-1", target: { xMm: 1000, yMm: 2000 } },
    });
  });

  it("contains unexpected internal failures behind a concise tool-facing error", async () => {
    const actions = fakeActions();
    vi.mocked(actions.inspectLabRecord).mockImplementation(() => {
      throw new Error("SQLITE_ERROR at C:\\private\\lab.sqlite\ninternal stack");
    });
    const inspect = createLabSpaceToolDefinitions(
      actions,
      fakeNavigationActions(),
      fakeSpatialActions(),
      fakeStagingActions(),
    ).find((tool) => tool.name === "labspace_inspect_record")!;

    let captured: Error | null = null;
    try {
      await executeLikeChrome151(inspect)({ recordId: "record-1" });
    } catch (error) {
      captured = error as Error;
    }

    expect(captured?.message).toBe("LabSpace could not complete this tool request.");
    expect(captured?.message).not.toContain("SQLITE");
    expect(captured?.message).not.toContain("private");
    expect(captured?.cause).toBeUndefined();
  });

  it("unregisters with AbortSignal and remounts without duplicate active tools", async () => {
    const modelContext = new MockModelContext();
    const first = registerLabSpaceTools({ modelContext, actions: fakeActions() });
    await first.ready;
    expect(modelContext.activeTools.size).toBe(7);

    first.unregister();
    expect(modelContext.activeTools.size).toBe(0);

    const second = registerLabSpaceTools({ modelContext, actions: fakeActions() });
    await second.ready;
    expect(modelContext.activeTools.size).toBe(7);
    expect([...modelContext.activeTools]).toHaveLength(7);
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
