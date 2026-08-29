import { describe, expect, it, vi } from "vitest";
import { executeReadOnlyToolCompat } from "../../src/webmcp/execute-tool-compat";

const tool = { name: "labspace_get_context" } as WebMCP.RegisteredTool;

describe("manual WebMCP execution compatibility", () => {
  it("uses object input in ChatGPT-compatible runtimes", async () => {
    const executeTool = vi.fn(async () => ({ ok: true }));
    const modelContext = { executeTool } as never;

    await expect(executeReadOnlyToolCompat(modelContext, tool, {})).resolves.toEqual({ ok: true });
    expect(executeTool).toHaveBeenCalledOnce();
    expect(executeTool).toHaveBeenCalledWith(tool, {});
  });

  it("falls back to JSON-string input for current Chrome testing builds", async () => {
    const executeTool = vi.fn(async (_tool: WebMCP.RegisteredTool, input: unknown) => {
      if (typeof input !== "string") throw new TypeError("Object input unsupported");
      return { ok: true };
    });
    const modelContext = { executeTool } as never;

    await expect(executeReadOnlyToolCompat(modelContext, tool, {})).resolves.toEqual({ ok: true });
    expect(executeTool.mock.calls.map((call) => call[1])).toEqual([{}, "{}"]);
  });

  it("preserves the original tool-facing error if neither signature works", async () => {
    const original = new Error("Tool execution failed");
    const executeTool = vi
      .fn()
      .mockRejectedValueOnce(original)
      .mockRejectedValueOnce(new Error("String fallback failed"));
    const modelContext = { executeTool } as never;

    await expect(executeReadOnlyToolCompat(modelContext, tool, {})).rejects.toBe(original);
  });
});
